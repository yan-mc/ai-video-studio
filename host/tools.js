/**
 * Agent 工具注册 —— 供模型直接驱动工作室。
 *
 * 命名沿用 studio_（与旧插件兼容），但全部走新实现。
 */
import path from 'node:path';
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from './config.js';
import { projects, assets, newProject, newShot, PROFILES, resolutionFor, h3Length, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, H3_MODEL_SLOTS } from './store/models.js';
import { jobs as jobsStore, newJob, isLocalBackendOf } from './services/job-store.js';
import { runJob, cancelJob, runtimeStats } from './services/job-runner.js';
import { compilePrompt, listShots, upsertShot, writeShots, cleanupProjectArtifacts, deriveSubjectsFromShot } from './api/index.js';
import { withVaultCards, resolvePictureIndices } from './services/shot-context.js';
import { readWorkflowCached } from './services/workflow-paths.js';
import * as comfy from './services/comfy-client.js';
import * as mockBackend from './services/mock-backend.js';
import { runH3Local, runH3Nanfeng } from './services/generator.js';
import { blenderStatus, buildSceneSpec, renderControl, listModelAssets, listAssetActions } from './services/blender-service.js';
import { compileH3Prompt, toShotInputPackage, STYLE_PRESETS, H3_MODES, H3_LIMITS } from './services/h3-prompt.js';
import {
  IMAGE_MODELS as IMAGE_MODELS_MAP,
  IMAGE_VAE as IMAGE_VAE_NAME,
  IMAGE_CLIP as IMAGE_CLIP_NAME,
  IMAGE_SAMPLING as IMAGE_SAMPLING_PARAMS,
  IMAGE_SIZES as IMAGE_SIZES_LIST,
  checkImageModels,
} from './services/h3-image.js';
import { runH3ImageLocal } from './services/generator.js';
import { getRuntime } from './runtime.js';
import { safeId, safeJoin, resolveUserPath } from './security.js';

function ok(value) {
  return { value, content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/**
 * 统一的项目 id 校验。
 *
 * 为什么不依赖下游：`listShots` 已经会拦，但那是在**拼路径时**才抛，
 * 而且 `projects.get/remove` 是内存数组查找、不会抛 —— 传 `../../x` 只会
 * 静默返回 null，用户看到的是"项目不存在"，根本想不到是非法 id。
 * 在工具入口统一校验，错误信息才可操作。
 */
function requireProjectId(v) {
  const s = String(v ?? '').trim();
  if (!s) throw new Error('PROJECT_ID_REQUIRED');
  return safeId(s);
}

/**
 * 工具定义工厂。
 * DSH 的 ToolDefinition 要求 output = { schema, render }：
 *  - schema: 输出 JSON Schema（这里统一宽松 object）
 *  - render: (args, value) => content blocks
 */
const OUTPUT_SCHEMA = { type: 'object', additionalProperties: true };

function renderOutput(_args, value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }];
}

function tool(name, description, parameters, execute) {
  return {
    name,
    description,
    parameters,
    output: { schema: OUTPUT_SCHEMA, render: renderOutput },
    async execute(args, execCtx) {
      const value = await execute(args, execCtx);
      return { value, content: renderOutput(args, value) };
    },
  };
}

export function registerTools(ctx) {
  const z = getRuntime();
  const disposers = [];

  /**
   * 幂等注册。
   *
   * 两点都修过：
   *  1) 用本地 Set 去重，不再依赖 `ctx.tools.get` 是否存在 ——
   *     某些 DSH 版本没有 `get`，旧实现探不到就会重复 register 并抛
   *     "already registered"，连带整个 registerTools 失败（所有 studio_* 工具全没）。
   *  2) 同名工具只保留第一次注册的；调用方要保证名字唯一（见下方 studio_prompt 合并）。
   */
  const registered = new Set();
  const reg = (def) => {
    if (registered.has(def.name)) {
      // 静默跳过是旧 bug 的温床（六段式编译器就是这样被吃掉的）——这里直接报出来
      throw new Error(`DUPLICATE_TOOL: ${def.name} 被注册了两次，请合并为单一定义`);
    }
    registered.add(def.name);
    return ctx.tools.register(def);
  };

  /* ---------------------------------------------------------- 元信息 */
  disposers.push(reg(tool(
    'studio_meta',
    '查看工作室元信息：生成档位、H3 模型槽位、26 种节点、14 类资产、项目分类、'
    + '后端状态、南风参数分组与预设。',
    { type: 'object', properties: {}, additionalProperties: false },
    async () => {
      const nf = await import('./services/nanfeng/schema.js');
      const nfPre = await import('./services/nanfeng/presets.js');
      return {
        profiles: PROFILES,
        h3Slots: H3_MODEL_SLOTS,
        nodeTypes: NODE_TYPES.map((t) => ({ type: t, label: NODE_LABELS[t] })),
        assetTypes: ASSET_TYPES.map((t) => ({ type: t, label: ASSET_TYPE_LABELS[t] })),
        projectCategories: PROJECT_CATEGORY_LABELS,
        backends: { h3: await comfy.health(loadConfig()) },
        runtime: runtimeStats(),
        /** 南风 V15 参数体系 */
        nanfeng: {
          paramCount: nf.PARAM_COUNT,
          groups: nf.GROUPS,
          presets: nfPre.listBuiltinPresets(),
          defaultPreset: nfPre.DEFAULT_PRESET,
        },
      };
    },
  )));

  /* ---------------------------------------------------------- 配置 */
  disposers.push(reg(tool(
    'studio_config',
    '读取或修改工作室配置（Get 返回掩码后的配置；Set 只接受白名单字段）。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set'] },
        patch: { type: 'object' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (args) => {
      const cfg = loadConfig();
      if (args.action === 'get') return (maskConfig(cfg));
      resetConfigCache();
      saveConfig(sanitizeConfigPatch(args.patch || {}));
      return maskConfig(loadConfig());
    },
  )));

  /* ---------------------------------------------------------- 项目 */
  disposers.push(reg(tool(
    'studio_project',
    '项目 CRUD：list / create / get / update / delete。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'get', 'update', 'delete'] },
        projectId: { type: 'string' },
        patch: { type: 'object' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (args) => {
      const pid = args.projectId ? requireProjectId(args.projectId) : '';
      switch (args.action) {
        case 'list': return (await projects.list());
        case 'create': return (await projects.upsert(newProject(args.patch || {})));
        case 'get': return (await projects.get(pid));
        case 'update': {
          const p = await projects.get(pid);
          if (!p) throw new Error('PROJECT_NOT_FOUND');
          return await projects.upsert({ ...p, ...(args.patch || {}), updatedAt: Date.now() });
        }
        case 'delete': {
          // ⚠️ 与 REST 的 DELETE /projects/:id 保持一致：REST 会调
          //    cleanupProjectArtifacts 清掉 shots/<pid>/、script/<pid>.json、
          //    comic/<pid>.json；Agent 工具这条路原来只删 projects.json 里那一行，
          //    磁盘上全留着 —— 用户"删掉了"但重名项目会捡到旧镜头。
          const removed = await projects.remove(pid);
          const cleaned = cleanupProjectArtifacts(loadConfig(), pid);
          return { ...removed, cleaned };
        }
        default: throw new Error('UNKNOWN_ACTION');
      }
    },
  )));

  /* ---------------------------------------------------------- 镜头 */
  disposers.push(reg(tool(
    'studio_shot',
    '镜头卡 CRUD：list / create / save / delete。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'save', 'delete'] },
        projectId: { type: 'string' },
        shotId: { type: 'string' },
        shot: { type: 'object' },
      },
      required: ['action', 'projectId'],
      additionalProperties: false,
    },
    async (args) => {
      const pid = requireProjectId(args.projectId);
      switch (args.action) {
        case 'list': return (listShots(pid));
        /**
         * ⚠️ save 必须认 `shotId`。
         *
         * 历史缺陷：`case 'save': return upsertShot(pid, args.shot || {})`
         * —— `args.shotId` 完全没用。而 upsertShot 里 `if (!next.id) next.id = newShot().id`，
         * 于是 Agent 按 schema 语义传 `{action:'save', projectId, shotId:'shot_abc', shot:{...}}`
         * **不会更新 shot_abc，而是每次都新建一个镜头**。重复保存 = 镜头表爆炸。
         *
         * 现在把 shotId 合并进 shot 记录，交给 upsertShot 的"有 id 就更新"分支。
         */
        case 'create': return (upsertShot(pid, newShot(args.shot || {})));
        case 'save': {
          const target = {
            ...(args.shot || {}),
            ...(args.shotId && !args.shot?.id ? { id: String(args.shotId) } : {}),
          };
          return (upsertShot(pid, target));
        }
        case 'delete': {
          // 修复 G5：原先只算 remaining 不落盘
          const before = listShots(pid);
          const after = before.filter((s) => s.id !== args.shotId);
          if (after.length === before.length) {
            return { ok: false, error: 'SHOT_NOT_FOUND', remaining: before.length };
          }
          writeShots(pid, after);
          return { ok: true, removed: args.shotId, remaining: after.length };
        }
        default: throw new Error('UNKNOWN_ACTION');
      }
    },
  )));

  /* ---------------------------------------------------------- 提示词（已合并） */
  // ⚠️ 原有两个 `studio_prompt`：早期这个简化版先注册，后面功能完整的六段式
  //    编译器（action=meta|compile|fromShot）被幂等逻辑静默跳过 → 永远不可达。
  //    现在合并成一个：保留六段式编译器的完整能力，同时兼容旧的
  //    `{projectId, shotId}` 无 action 调用（等价于 fromShot 的简化输出）。
  disposers.push(reg(tool(
    'studio_prompt',
    'H3 提示词编译：按官方六段式(Ref2VA)/三段式(T2VA)规范生成结构化提示词。'
    + 'action=meta 取画风库与模式；compile 直接编译；fromShot 从镜头卡编译；'
    + '不带 action 时按 {projectId, shotId} 返回提示词 + 分辨率 + 帧数（兼容旧调用）。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['meta', 'compile', 'fromShot'] },
        projectId: { type: 'string' },
        shotId: { type: 'string' },
        mode: { type: 'string', enum: ['t2va', 'i2va', 'fl2va', 'l2va', 'ref2va'] },
        styleId: { type: 'string', description: '画风 id（见 meta）' },
        styleEn: { type: 'string', description: '自定义英文画风描述' },
        durationSec: { type: 'number' },
        sceneLayout: { type: 'string' },
        subjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              pictureIndex: { type: 'number' },
              gender: { type: 'string' },
              heightCm: { type: 'number' },
              traits: { type: 'string' },
              personality: { type: 'string' },
              voiceDesc: { type: 'string' },
              audioIndex: { type: 'number' },
            },
          },
        },
        shots: { type: 'array', items: { type: 'object' } },
        references: { type: 'object' },
        overall_soundscape: { type: 'string' },
        non_diegetic_music: { type: 'string' },
        summary: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    async (a) => {
      if (a.action === 'meta') {
        return { styles: STYLE_PRESETS, modes: H3_MODES, limits: H3_LIMITS };
      }
      if (a.action === 'compile') {
        const { action, projectId, shotId, ...rest } = a;
        void action; void projectId; void shotId;
        return compileH3Prompt(rest);
      }
      // fromShot + 无 action 的兼容路径
      if (!a.projectId || !a.shotId) throw new Error('PROJECT_AND_SHOT_REQUIRED');
      const shot = listShots(a.projectId).find((s) => s.id === a.shotId);
      if (!shot) throw new Error('SHOT_NOT_FOUND');

      /**
       * ⚠️ 必须与 `/prompt/from-shot` 和 `studio_generate` 走**同一条入参准备**。
       *
       * 历史缺陷：REST 侧已经改成 `withVaultCards()` → `resolvePictureIndices()`
       * （角色卡优先），但这条工具路径还是直接拿原始 shot 编译 ——
       * 于是"页面预览的提示词"和"Agent 生成时用的提示词"在**绑定了角色卡**的
       * 项目上不一致：预览里没有 `<Subject N>`，真实生成里却有。
       * 这正是 api/index.js:1394-1404 那段注释痛陈过的"预览与实物不一致"，
       * 当时只修了 REST，工具侧漏了。
       */
      const prepared = await withVaultCards(shot, a.projectId, getRuntime(), loadConfig());
      const cardSubjects = Array.isArray(prepared.characterCards)
        ? resolvePictureIndices(prepared, loadConfig())
        : [];
      const subjects = a.subjects
        ?? (cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(prepared));

      const pkg = toShotInputPackage(prepared, {
        styleId: a.styleId ?? prepared.styleId ?? null,
        subjects,
        scenes: a.shots,
      });
      const compiled = compileH3Prompt(pkg);
      // 兼容旧返回：附上分辨率与帧数建议
      return {
        ...compiled,
        prompt: compiled.prompt || compilePrompt(prepared),
        resolution: resolutionFor(shot.profile, shot.ratio),
        h3Length: h3Length(shot.durationSec),
        package: pkg,
        subjectCount: subjects.length,
        fromVault: cardSubjects.length > 0,
      };
    },
  )));

  /* ---------------------------------------------------------- 生成 */
  disposers.push(reg(tool(
    'studio_generate',
    '提交视频/图像生成任务。立即返回 job，异步执行。'
    + 'backend=h3-nanfeng（默认，支持二采/续写）|h3-local（旧模板路径）|h3-image|mock。'
    + 'preset 可选：draft / standard / quality / quality-preview / continuation / '
    + 'continuation-quality / low-vram。'
    + 'params 用于覆盖预设里的单项参数（键名见 studio_meta 的 nanfeng.params）。',
    {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        shotId: { type: 'string' },
        backend: { type: 'string', enum: ['h3-nanfeng', 'h3-local', 'h3-image', 'mock'] },
        seed: { type: 'number' },
        /** 预设 id */
        preset: { type: 'string' },
        /** 单个参数覆盖（南风 217 参数里的任意项） */
        params: { type: 'object', description: '覆盖预设参数，键名同南风参数名' },
        /** 生成模式（覆盖镜头卡的 mode） */
        mode: { type: 'string', enum: ['ref2va', 't2va', 'i2va', 'fl2va'] },
        /** 续写任务 JSON（由 studio_continuation 生成） */
        continuationTask: { type: 'string' },
      },
      required: ['projectId', 'shotId'],
      additionalProperties: false,
    },
    async (args) => {
      const pid = requireProjectId(args.projectId);
      const shot = listShots(pid).find((s) => s.id === args.shotId);
      if (!shot) throw new Error('SHOT_NOT_FOUND');
      const cfg = loadConfig();
      const backendId = args.backend || shot.backend || cfg.defaultBackend;

      // ⚠️ 必须校验后端名。
      //    旧实现不校验，任何拼错的名字（甚至 'h3-image'）都会掉进最后的
      //    runMock 分支 → 产出 ffmpeg 占位视频且状态 completed，
      //    用户拿到"假视频"还以为成了。REST /generate 有这道校验，工具没有。
      const VALID = new Set(['h3-nanfeng', 'h3-local', 'h3-image', 'mock']);
      if (!VALID.has(backendId)) {
        throw new Error(`UNKNOWN_BACKEND: ${JSON.stringify(backendId)} 不是有效后端。可选：${[...VALID].join(' / ')}`);
      }

      // ⚠️ 必须先解析角色卡再编译提示词（与 REST /generate 完全一致）。
      //    旧实现直接 compilePrompt(shot)：项目/镜头绑定的角色卡完全丢失，
      //    导致"页面点渲染"和"让 AI 生成"同一个镜头结果不一样。
      //    generator.js 顶部注释骂过这种漂移 —— 执行器统一了，入参也要统一。
      const ctx = z;
      const shotWithCards = await withVaultCards(shot, pid, ctx, cfg);

      const job = newJob({
        projectId: pid,
        shotId: shot.id,
        backendId,
        prompt: compilePrompt(shotWithCards),
        params: {
          durationSec: shot.durationSec,
          ratio: shot.ratio,
          profile: shot.profile,
          seed: Number.isFinite(Number(args.seed)) ? Number(args.seed) : 1101,
          ...(args.preset ? { nanfengPreset: args.preset } : {}),
          ...(args.params ? { nanfengExtra: args.params } : {}),
          ...(args.mode ? { nanfengMode: args.mode } : {}),
          ...(args.continuationTask ? { continuationTask: args.continuationTask } : {}),
        },
        mode: shot.mode,
      });
      if (backendId === 'h3-image') job.kind = 'image';
      await jobsStore().upsert(job);

      runJob(job, async (running, hooks) => {
        // ⭐ 南风后端：支持二采 / 续写 / 217 参数
        if (backendId === 'h3-nanfeng') {
          return runH3Nanfeng({
            job: running,
            shot: shotWithCards,
            prompt: running.prompt,
            cfg,
            onSubmitted: hooks?.onSubmitted,
            mode: running.params?.nanfengMode,
            preset: running.params?.nanfengPreset,
            extraParams: running.params?.nanfengExtra,
            continuationTask: running.params?.continuationTask,
          });
        }
        if (backendId === 'h3-local') {
          // 统一走 services/generator.js —— 与 REST 路径共用同一实现，
          // 杜绝"工具漏填占位符"这类漂移（审查 G7）
          return runH3Local({
            workflow: z.h3.loadWorkflow(),
            job: running,
            shot: shotWithCards,
            prompt: running.prompt,
            cfg,
            onSubmitted: hooks?.onSubmitted,
          });
        }
        if (backendId === 'h3-image') return runH3ImageLocal({
          workflow: imageWorkflow(),
          job: running,
          prompt: running.prompt,
          shot: shotWithCards,
          cfg,
          onSubmitted: hooks?.onSubmitted,
        });
        // mock 是**测试占位后端**（services/mock-backend.js）：只出 ffmpeg 色卡，
        // 不做推理。真实产出走 h3-nanfeng / h3-local / h3-image。
        return mockBackend.runMock({ cfg, job: running, shot: shotWithCards, prompt: running.prompt });
      }).catch(() => {});

      return job;
    },
  )));

  /* ---------------------------------------------------------- 任务 */
  disposers.push(reg(tool(
    'studio_jobs',
    '任务查询 / 取消 / 重试。cancel 会真正通知远端（ComfyUI /interrupt）。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'cancel'] },
        jobId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (args) => {
      if (args.action === 'list') {
        const list = await jobsStore().list();
        return list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, args.limit || 50);
      }
      if (args.action === 'get') return (await jobsStore().get(args.jobId));
      if (args.action === 'cancel') {
        return (await cancelJob(args.jobId, async (job) => {
          // 与 API 层保持一致：只有真正提交到 ComfyUI 的本地后端才有远端可取消。
          // 旧实现在这里不校验 backendId，对 mock 也会去调 /interrupt。
          if (job.remoteId && isLocalBackendOf(job.backendId)) {
            await comfy.cancelRemote(loadConfig(), job.remoteId);
          }
        }));
      }
      throw new Error('UNKNOWN_ACTION');
    },
  )));

  /* ---------------------------------------------------------- H3 工坊 */
  disposers.push(reg(tool(
    'studio_h3_workshop',
    'H3 提示词工坊：把一集剧本分析成中性分段 + 资产提示词，并可导入资产库。'
    + '注意：本工具**只产出文本**（分段、提示词、角色/场景/道具清单），不生成任何图片；'
    + '要得到角色形象请用 studio_image / 立绘拆解 / 角色卡仓库。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['analyze', 'import'] },
        projectId: { type: 'string' },
        text: { type: 'string' },
        file: { type: 'string' },
        episode: { type: 'number' },
        aspect: { type: 'string' },
        style: { type: 'string' },
        language: { type: 'string' },
        durationMin: { type: 'number' },
        durationMax: { type: 'number' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (args) => {
      if (args.action === 'analyze') return (await z.h3.analyze(args));
      if (args.action === 'import') return (await z.h3.importAssets(args));
      throw new Error('UNKNOWN_ACTION');
    },
  )));

  /* ---------------------------------------------------------- 预演 */
  disposers.push(reg(tool(
    'studio_blender',
    'Blender 预演渲染：从镜头卡渲一段灰模参考视频（blockout），喂给 Ref2VA 的参考视频输入；'
    + '并可列出 3D 资产与模型内置动作。'
    + 'action=health 查引擎；assets 列 3D 资产库；actions 读某模型的动作名；'
    + 'spec 预览场景 JSON；render 渲染参考视频（返回 rel，可填 shot.refs.videos）。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['health', 'assets', 'actions', 'render', 'spec'] },
        mode: { type: 'string', enum: ['blockout', 'preview'] },
        assetRel: { type: 'string', description: 'action=actions 时的模型路径（dataDir 相对）' },
        projectId: { type: 'string' },
        shotId: { type: 'string' },
        shot: { type: 'object', description: '直接给镜头卡（不给 projectId/shotId 时用这个）' },
        frames: { type: 'number', description: '覆盖帧数（默认 durationSec×24）' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      if (a.action === 'health') return blenderStatus();
      if (a.action === 'assets') return { assets: listModelAssets(loadConfig()) };
      if (a.action === 'actions') {
        if (!a.assetRel) throw new Error('ASSET_REQUIRED');
        return await listAssetActions({ assetRel: String(a.assetRel), cfg: loadConfig() });
      }
      const pid = a.projectId ? safeId(String(a.projectId)) : '';
      const shot = a.shot ?? (pid && a.shotId ? listShots(pid).find((s) => s.id === a.shotId) : null);
      if (!shot) throw new Error('SHOT_NOT_FOUND');
      const spec = buildSceneSpec(shot, { frames: a.frames });
      if (a.action === 'spec') return spec;
      return await renderControl({ mode: String(a.mode || 'blockout'), spec, jobId: String(a.shotId || 'shot') });
    },
  )));

  /* ---------------------------------------------------------- 后处理 */
  disposers.push(reg(tool(
    'studio_post',
    'ffmpeg 后处理与图像工具：transcode / scale / crop / split（切割分镜）/ annotate（文字标注）/ extractFrame / extractAudio / stripAudio（去音轨，人物替换的必备前置）/ qc。',
    {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['transcode', 'scale', 'crop', 'split', 'annotate', 'extractFrame', 'extractAudio', 'stripAudio', 'qc'] },
        input: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' },
        rows: { type: 'number', description: 'split 的行数' },
        cols: { type: 'number', description: 'split 的列数' },
        text: { type: 'string', description: 'annotate 的文字' },
        fontSize: { type: 'number' },
        color: { type: 'string' },
        fontFile: { type: 'string', description: 'annotate 的字体文件（中文必填）' },
        timeSec: { type: 'number' },
        crf: { type: 'number' },
      },
      required: ['op', 'input'],
      additionalProperties: false,
    },
    async (a) => {
      const { op, ...rest } = a;
      /**
       * ⚠️ 每个 op 的入参形状并不相同，不能统一 `z.post[op](rest)`。
       *
       * `qc(input)` 收的是**一个字符串**（媒体路径），其余 op 收的是
       * 带 `input/width/height/...` 的**对象**。旧实现一股脑把 rest 对象
       * 传给 qc，`resolveUserPath({ input: {input:'...'} })` 会把对象
       * String() 成 "[object Object]" → 报 FILE_NOT_FOUND，
       * 用户完全看不出是参数形状不对。
       */
      if (op === 'qc') {
        const target = rest.input ?? rest.path;
        if (!target) throw new Error('INPUT_REQUIRED: qc 需要 input（媒体文件路径）');
        return await z.post.qc(target);
      }
      return await z.post[op](rest);
    },
  )));

  /* ---------------------------------------------------------- 剧本 */

  /* ---------------------------------------------------------- 模特工作台 */

  /* ---------------------------------------------------------- 3D 导演台 */

  /* ---------------------------------------------------------- 工具箱（剩余域） */
  disposers.push(reg(tool(
    'studio_toolbox',
    '工具箱：promptTemplates 提示词模板 / wardrobe 服化道 / importScan 分镜目录导入 / orphans 孤儿清理 / motionShots 动态条 / logs 运行日志 / batchProgress 批量进度。',
    {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          enum: ['promptTemplates', 'wardrobe', 'importScan', 'orphans', 'motionShots', 'logs', 'batchProgress'],
        },
        action: { type: 'string', enum: ['list', 'upsert', 'delete', 'scan', 'preview', 'clean'] },
        id: { type: 'string' },
        item: { type: 'object' },
        kind: { type: 'string' },
        dir: { type: 'string' },
        path: { type: 'string' },
        confirm: { type: 'boolean' },
        projectId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['domain', 'action'],
      additionalProperties: false,
    },
    async (a) => {
      const e = z.extras;
      switch (a.domain) {
        case 'promptTemplates':
          if (a.action === 'list') return e.listTemplates();
          if (a.action === 'upsert') return e.upsertTemplate(a.item ?? {});
          if (a.action === 'delete') return e.deleteTemplate(String(a.id));
          break;
        case 'wardrobe':
          if (a.action === 'list') return e.listWardrobe(a.kind ?? null);
          if (a.action === 'upsert') return e.upsertWardrobe(a.item ?? {});
          if (a.action === 'delete') return e.deleteWardrobe(String(a.id));
          break;
        case 'importScan':
          if (a.action === 'scan') return e.scanImportDir(String(a.dir || ''));
          if (a.action === 'preview') return e.previewImportFile(String(a.path || ''), a.limit ?? 2000);
          break;
        case 'orphans': {
          const all = await z.assets.list({});
          if (a.action === 'list') return e.findOrphans(all);
          if (a.action === 'clean') return e.cleanOrphans(all, { confirm: Boolean(a.confirm) });
          break;
        }
        case 'motionShots':
          if (a.action === 'list') return e.listMotionShots(a.projectId ?? null);
          if (a.action === 'upsert') return e.upsertMotionShot(a.item ?? {});
          if (a.action === 'delete') return e.deleteMotionShot(String(a.id));
          break;
        case 'logs':
          if (a.action === 'list') return e.listLogs(a.limit ?? 100);
          if (a.action === 'upsert') return e.appendLog(a.item ?? {});
          break;
        case 'batchProgress': {
          /**
           * batchProgress 是**只读**域：它只有一个查询动作。
           *
           * 旧实现完全不看 action —— 传 `delete` / `clean` 也会返回进度，
           * 看起来"执行成功"。统一 schema 的 action 枚举有 6 个值，
           * 每个域各自只支持其中几个，所以每个域都必须显式拒绝不属于它的动作，
           * 否则模型会以为一个不存在的操作成功了。
           */
          if (a.action !== 'list') {
            throw new Error(`UNKNOWN_ACTION: batchProgress 只支持 list，收到 ${JSON.stringify(a.action)}`);
          }
          const jobs = await jobsStore().list();
          return e.batchProgress(jobs);
        }
        default: throw new Error('UNKNOWN_DOMAIN');
      }
      throw new Error('UNKNOWN_ACTION');
    },
  )));

/** 加载图像工作流（带缓存；模板随插件分发，不跟随 dataDir） */
  function imageWorkflow() {
    try { return readWorkflowCached('image', loadConfig()); } catch { return null; }
  }

  /* ---------------------------------------------------------- 图像生成 */
  disposers.push(reg(tool(
    'studio_image',
    'H3-Image 图像生成：文生图 / 参考图编辑。6 步固定采样，guidance 1.0，无负面提示词。action=meta 查模型状态与尺寸表；generate 出图。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['meta', 'generate'] },
        prompt: { type: 'string', description: '提示词（最长 4096 token，建议详细完整）' },
        sizeId: { type: 'string', description: '尺寸 id（见 meta.sizes），默认 auto=2048²' },
        width: { type: 'number', description: '显式宽（32 倍数）' },
        height: { type: 'number', description: '显式高（32 倍数）' },
        seed: { type: 'number' },
        refImages: {
          type: 'array',
          items: { type: 'string' },
          description: '参考图绝对路径（接上即进入编辑模式，最多 16 张）',
        },
        projectId: { type: 'string' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      if (a.action === 'meta') {
        return {
          models: IMAGE_MODELS_MAP,
          vae: IMAGE_VAE_NAME,
          clip: IMAGE_CLIP_NAME,
          sampling: IMAGE_SAMPLING_PARAMS,
          sizes: IMAGE_SIZES_LIST,
          status: checkImageModels(loadConfig()),
        };
      }
      const cfg = loadConfig();
      const wf = imageWorkflow();
      if (!wf) throw new Error('WORKFLOW_MISSING: data/workflows/h3-image.json');
      const job = newJob({
        projectId: a.projectId ?? null,
        shotId: null,
        backendId: 'h3-image',
        prompt: String(a.prompt ?? ''),
        params: {
          kind: 'image',
          imageSizeId: a.sizeId ?? cfg.imageSizeId ?? 'auto',
          width: a.width,
          height: a.height,
          seed: a.seed ?? Math.floor(Math.random() * 2147483647),
        },
        mode: 't2i',
      });
      job.kind = 'image';
      await jobsStore().upsert(job);

      runJob(job, async (running, hooks) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt: String(a.prompt ?? ''),
        shot: { refs: { images: a.refImages ?? [] }, imageSizeId: a.sizeId },
        cfg,
        onSubmitted: hooks?.onSubmitted,
      })).catch(() => {});

      return { ok: true, jobId: job.id, status: job.status, note: '用 studio_jobs 查进度' };
    },
  )));

  /* ------------------------------------------------------ 智能分镜 */

  disposers.push(reg(tool(
    'studio_storyboard',
    '智能分镜：用 DSH 内部 LLM（无需 API Key）看图并写分镜提示词。'
    + 'action=meta 查可用模式与 LLM 状态；'
    + 'action=analyze 只做逐图分析；'
    + 'action=generate 生成完整分镜（看图 + 写词 + 解析）。'
    + 'mode 决定输出结构：ref2va / i2va / fl2va / t2va / '
    + 'oneshot_continuation（一镜到底续写）/ continuation_cuts（可切镜续写）。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['meta', 'analyze', 'generate'] },
        projectId: { type: 'string' },
        idea: { type: 'string', description: '用户对这段戏的想法' },
        count: { type: 'number', description: '要几段，1-12' },
        mode: { type: 'string', enum: ['ref2va', 'reference_i2va', 'i2va', 'fl2va', 't2va', 'oneshot_continuation', 'continuation_cuts'] },
        skillId: { type: 'string', enum: ['regular_storyboard', 'ns_storyboard'] },
        imageRels: { type: 'array', items: { type: 'string' }, description: '参考图（dataDir 相对路径）' },
        durationSec: { type: 'number', description: '每段时长' },
        contextLength: { type: 'number', description: '续写重叠帧数 5/22/39/56' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (args) => {
      const sb = await import('./services/nanfeng/storyboard.js');
      const llm = await import('./services/nanfeng/dsh-llm.js');
      const cfg = loadConfig();

      if (args.action === 'meta') {
        return {
          modes: sb.STORYBOARD_MODES,
          skills: Object.entries(sb.SKILLS).map(([id, s]) => ({ id, label: s.label, desc: s.desc })),
          llm: llm.llmStatus(z, cfg),
        };
      }

      if (!llm.llmStatus(z, cfg).available) {
        throw new Error(`LLM_UNAVAILABLE: ${llm.llmStatus(z, cfg).reason}`);
      }

      const count = Math.max(1, Math.min(12, Number(args.count) || 1));
      const mode = String(args.mode || 'ref2va');

      // 解析参考图
      //
      // ⚠️ 这里不能 `catch {}` 静默吞异常。曾经 tools.js 用了未导入的
      //    `safeJoin`，ReferenceError 被吞掉 → images 恒为 0 →
      //    视觉分析永远"跳过"，而且没有任何报错线索。
      const images = [];
      const badRels = [];
      for (const rel of (Array.isArray(args.imageRels) ? args.imageRels : [])) {
        try {
          // ⚠️ 不能给绝对路径开绿灯。
          //    旧写法 `path.isAbsolute(rel) ? rel : safeJoin(...)` 等于"绝对路径
          //    完全放行" —— Agent（或被提示词注入的 Agent）传一个
          //    C:/Users/.../.ssh/id_rsa 就能让后端把它读进视觉模型。
          //    security.js 注释里明确记载过这个坑（"6 处各写各的，其中 5 处
          //    漏掉绝对路径分支"），这里是漏改的第 6 处。
          //    统一走 resolveUserPath：绝对路径也必须在 dataDir 内，且做 realpath 核对。
          const abs = resolveUserPath({
            root: cfg.dataDir, input: rel, mustExist: true,
          });
          images.push({ index: images.length + 1, absPath: abs, name: path.basename(abs) });
        } catch (e) {
          badRels.push(`${rel}（${String(e?.message || e)}）`);
        }
      }

      // 逐图分析
      let analysis = '';
      if (images.length) {
        const parts = [];
        for (const img of images) {
          const text = await llm.callVision(z, cfg, {
            prompt: sb.visionPrompt(img.index),
            images: [img],
          });
          parts.push(`@图片${img.index}：${text.replace(/^\s*@图片\d+\s*[:：]\s*/, '').trim()}`);
        }
        analysis = parts.join('\n\n');
      }
      // badRels 让调用方知道哪张图没进（以前静默跳过，排查无从下手）
      if (args.action === 'analyze') return { analysis, images: images.length, ...(badRels.length ? { badRels } : {}) };

      // 生成分镜
      const messages = sb.buildStoryboardMessages({
        idea: args.idea,
        count,
        mode,
        // ⚠️ 必须透传 —— 以前漏了，导致 ns_storyboard（海螺版）永远不可达
        skillId: args.skillId ?? 'regular_storyboard',
        images,
        analysis,
        durationSeconds: Number(args.durationSec) || 5,
        contextLength: args.contextLength != null ? Number(args.contextLength) : undefined,
      });
      const outText = await llm.callText(z, cfg, {
        system: messages[0].content,
        user: messages[1].content,
        maxTokens: sb.outputBudget(count),
      });
      const parsed = sb.parseStoryboard(outText, count);
      return {
        mode,
        count,
        global: parsed.global,
        segments: parsed.segments,
        analysis,
      };
    },
  )));

  return () => disposers.forEach((d) => d && d());
}

export default registerTools;









