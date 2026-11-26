/**
 * Agent 工具注册 —— 供模型直接驱动工作室。
 *
 * 命名沿 studio_ 前缀；执行路径与 REST 共用同一批 service，
 * 不在这里另写一套编排（重复实现必然漂移）。
 */
import path from 'node:path';
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from './config.js';
import {
  projects, newProject, newShot, PROFILES, resolutionFor, h3Length,
  NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, H3_MODEL_SLOTS,
} from './store/models.js';
import { jobs as jobsStore, newJob, isLocalBackendOf } from './services/job-store.js';
import { runJob, cancelJob, runtimeStats } from './services/job-runner.js';
import { listShots, upsertShot, writeShots, cleanupProjectArtifacts } from './api/shots.js';
import { compilePrompt, deriveSubjectsFromShot } from './api/prompt-compile.js';
import { allowedProjectPatch } from './api/projects.js';
import { promptMetaPayload } from './api/routes/prompt.js';
import { probeLoraFiles } from './api/routes/meta.js';
import { VALID_BACKENDS } from './api/backend.js';
import { runAndArchive } from './api/archive.js';
import { fireAndLog } from './api/errors.js';
import {
  imageLoraWarnings, solveImageLoras, submitImageJobs, writeProgress,
} from './api/image-task.js';
import { prepareInpaint, inpaintSubmitSummary } from './services/inpaint-task.js';
import { compileImagePrompt, imagePromptMeta } from './services/image-prompt/index.js';
import { withVaultCards, resolvePictureIndices } from './services/shot-context.js';
import { readWorkflowCached } from './services/workflow-paths.js';
import * as comfy from './services/comfy-client.js';
import * as mockBackend from './services/mock-backend.js';
import { runH3Local, runH3Nanfeng, runH3ImageLocal } from './services/generator.js';
import { blenderStatus, buildSceneSpec, renderControl, listModelAssets, listAssetActions } from './services/blender-service.js';
import { compileH3Prompt, toShotInputPackage } from './bridge/prompt/h3-prompt.js';
import { nanfengSchema, nanfengPresets, storyboard, llm as bridgeLlm } from './bridge/index.js';
import {
  IMAGE_MODELS as IMAGE_MODELS_MAP,
  IMAGE_VAE as IMAGE_VAE_NAME,
  IMAGE_CLIP as IMAGE_CLIP_NAME,
  IMAGE_SAMPLING as IMAGE_SAMPLING_PARAMS,
  IMAGE_SIZES as IMAGE_SIZES_LIST,
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_MAX_REF_IMAGES,
  IMAGE_MAX_BATCH,
  IMAGE_MAX_LORAS,
  checkImageModels,
  validateImageRequest,
  effectiveImageSteps,
  effectiveMaxMP,
} from './services/h3-image.js';
import { IMAGE_LORA_ROOT, IMAGE_LORA_CATEGORIES, catalogImageLoras } from './services/h3-image-lora.js';
import { runH3Inpaint, inpaintMeta } from './services/h3-inpaint.js';
import { resolveImageEditRefs } from './services/ref-images.js';
import { getRuntime } from './runtime.js';
import { safeId, resolveUserPath } from './security.js';

/** 统一的项目 id 校验（projects.get/remove 是内存查找，非法 id 只会静默返回 null） */
function requireProjectId(v) {
  const s = String(v ?? '').trim();
  if (!s) throw new Error('PROJECT_ID_REQUIRED');
  return safeId(s);
}

/**
 * 工具定义工厂。
 * DSH 的 ToolDefinition 要求 output = { schema, render }。
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
   * 幂等注册：同名工具只保留第一次。
   *
   * 重名时 warn 而不是 throw —— 抛错会让整个 registerTools 失败，
   * 14 个工具全部消失（这正是历史上"六段式编译器被静默吃掉"的代价）。
   */
  const registered = new Set();
  const reg = (def) => {
    if (registered.has(def.name)) {
      ctx.logger?.warn?.(`[jiuzhang] 工具重名已跳过：${def.name}`);
      return null;
    }
    registered.add(def.name);
    return ctx.tools.register(def);
  };

  const cfgNow = () => loadConfig();

  /** 加载图像工作流（带缓存；模板随插件分发，不跟随 dataDir） */
  function imageWorkflow() {
    try { return readWorkflowCached('image', loadConfig()); } catch { return null; }
  }

  /* ---------------------------------------------------------- 元信息 */
  disposers.push(reg(tool(
    'studio_meta',
    '查看工作室元信息：生成档位、H3 模型槽位、26 种节点、14 类资产、项目分类、'
    + '后端状态、南风参数分组与预设。',
    { type: 'object', properties: {}, additionalProperties: false },
    async () => {
      return {
        profiles: PROFILES,
        h3Slots: H3_MODEL_SLOTS,
        nodeTypes: NODE_TYPES.map((t) => ({ type: t, label: NODE_LABELS[t] })),
        assetTypes: ASSET_TYPES.map((t) => ({ type: t, label: ASSET_TYPE_LABELS[t] })),
        projectCategories: PROJECT_CATEGORY_LABELS,
        // `backends` 保持与 REST /meta 同源的**枚举数组**，健康状态另放 health
        backends: [...VALID_BACKENDS],
        health: { h3: await comfy.health(loadConfig()) },
        runtime: runtimeStats(),
        nanfeng: {
          paramCount: nanfengSchema.PARAM_COUNT,
          groups: nanfengSchema.GROUPS,
          presets: nanfengPresets.listBuiltinPresets(),
          defaultPreset: nanfengPresets.DEFAULT_PRESET,
        },
      };
    },
  )));

  /* ---------------------------------------------------------- 配置 */
  disposers.push(reg(tool(
    'studio_config',
    '读取或修改工作室配置（get 返回掩码后的配置；set 只接受白名单字段）。',
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
      if (args.action === 'get') return maskConfig(loadConfig());
      if (args.action !== 'set') throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(args.action)}`);
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
        case 'list': return projects.list();
        case 'create': {
          const created = await projects.upsert(newProject(args.patch || {}));
          return created;
        }
        case 'get': return projects.get(pid);
        case 'update': {
          const p = await projects.get(pid);
          if (!p) throw new Error('PROJECT_NOT_FOUND');
          // 与 REST 共用同一个可写字段白名单：未登记的字段（id / createdAt …）不可改
          return projects.upsert({ ...p, ...allowedProjectPatch(args.patch || {}), updatedAt: Date.now() });
        }
        case 'delete': {
          // 与 REST 同序：先清产物再删记录，避免"记录没了、磁盘还在"
          const cleaned = cleanupProjectArtifacts(cfgNow(), pid);
          const removed = await projects.remove(pid);
          return { ...removed, cleaned };
        }
        default: throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(args.action)}`);
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
        case 'list': return listShots(pid);
        case 'create': return upsertShot(pid, newShot(args.shot || {}));
        case 'save': {
          // save 必须认 shotId：否则 upsertShot 无 id 就新建，重复保存 = 镜头表爆炸
          const target = {
            ...(args.shot || {}),
            ...(args.shotId && !args.shot?.id ? { id: String(args.shotId) } : {}),
          };
          return upsertShot(pid, target);
        }
        case 'delete': {
          const before = listShots(pid);
          const after = before.filter((s) => s.id !== args.shotId);
          if (after.length === before.length) {
            return { ok: false, error: 'SHOT_NOT_FOUND', remaining: before.length };
          }
          await writeShots(pid, after);
          return { ok: true, removed: args.shotId, remaining: after.length };
        }
        default: throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(args.action)}`);
      }
    },
  )));

  /* ---------------------------------------------------------- 提示词 */
  disposers.push(reg(tool(
    'studio_prompt',
    'H3 提示词编译：按官方六段式(Ref2VA)/三段式(T2VA)规范生成结构化提示词。'
    + 'action=meta 取画风库与模式；compile 直接编译；fromShot 从镜头卡编译。',
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
      if (a.action === 'meta') return promptMetaPayload();
      if (a.action === 'compile') {
        const { action: _a, projectId: _p, shotId: _s, ...rest } = a;
        return compileH3Prompt(rest);
      }
      if (a.action !== 'fromShot') throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(a.action)}`);
      if (!a.projectId || !a.shotId) throw new Error('PROJECT_AND_SHOT_REQUIRED');
      const pid = requireProjectId(a.projectId);
      const shot = listShots(pid).find((s) => s.id === a.shotId);
      if (!shot) throw new Error('SHOT_NOT_FOUND');

      // 与 /prompt/from-shot、/generate 走同一条入参准备（角色卡优先）
      const prepared = await withVaultCards(shot, pid, z, cfgNow());
      const cardSubjects = Array.isArray(prepared.characterCards)
        ? resolvePictureIndices(prepared, cfgNow())
        : [];
      const subjects = a.subjects
        ?? (cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(prepared));

      const pkg = toShotInputPackage(prepared, {
        styleId: a.styleId ?? prepared.styleId ?? null,
        subjects,
        scenes: a.shots,
      });
      return {
        ...compileH3Prompt(pkg),
        resolution: resolutionFor(shot.profile, shot.ratio),
        h3Length: h3Length(shot.durationSec),
        package: pkg,
        subjectCount: subjects.length,
        fromVault: cardSubjects.length > 0,
      };
    },
  )));

  /**
   * 按后端分流执行一次生成。
   *
   * studio_generate 与 studio_jobs(retry) 共用这一段，避免两个入口各写一遍分流。
   */
  async function runGenerationFor(job, { shot, projectId, backendId }) {
    const cfg = cfgNow();
    const shotWithCards = await withVaultCards(shot, projectId, getRuntime(), cfg);
    return runAndArchive(job, async (running, hooks) => {
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
        return runH3Local({
          workflow: z.h3.loadWorkflow(),
          job: running,
          shot: shotWithCards,
          prompt: running.prompt,
          cfg,
          onSubmitted: hooks?.onSubmitted,
        });
      }
      if (backendId === 'h3-image') {
        const wf = imageWorkflow();
        if (!wf) throw new Error('WORKFLOW_MISSING: data/workflows/h3-image.json');
        return runH3ImageLocal({
          workflow: wf,
          job: running,
          prompt: running.prompt,
          shot: shotWithCards,
          cfg,
          onSubmitted: hooks?.onSubmitted,
        });
      }
      // mock 是测试占位后端：只出 ffmpeg 色卡，不做推理
      return mockBackend.runMock({ cfg, job: running, shot: shotWithCards, prompt: running.prompt });
    }, getRuntime());
  }

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
        preset: { type: 'string' },
        params: { type: 'object', description: '覆盖预设参数，键名同南风参数名' },
        mode: { type: 'string', enum: ['ref2va', 't2va', 'i2va', 'fl2va'] },
        continuationTask: { type: 'string' },
        /** 加速方案（单次尝试覆盖；与 REST /generate 同形） */
        accelPlan: { type: 'string' },
        /** 采样步数覆盖（与 REST /generate 同形） */
        steps: { type: 'number' },
      },
      required: ['projectId', 'shotId'],
      additionalProperties: false,
    },
    async (args) => {
      const pid = requireProjectId(args.projectId);
      const shot = listShots(pid).find((s) => s.id === args.shotId);
      if (!shot) throw new Error('SHOT_NOT_FOUND');
      const cfg = cfgNow();
      const backendId = args.backend || shot.backend || cfg.defaultBackend;

      // 后端名必须校验：拼错的名字不能静默降级成占位视频
      if (!VALID_BACKENDS.has(backendId)) {
        throw new Error(
          `UNKNOWN_BACKEND: ${JSON.stringify(backendId)} 不是有效后端。可选：${[...VALID_BACKENDS].join(' / ')}`,
        );
      }

      // 先解析角色卡再编译提示词，并收集 lint 警告（与 REST /generate 逐字一致）
      const shotWithCards = await withVaultCards(shot, pid, z, cfg);
      const compileWarnings = [];
      const prompt = compilePrompt(shotWithCards, compileWarnings);

      const job = newJob({
        projectId: pid,
        shotId: shot.id,
        backendId,
        prompt,
        ...(compileWarnings.length ? { warnings: compileWarnings } : {}),
        params: {
          durationSec: shot.durationSec,
          ratio: shot.ratio,
          profile: shot.profile,
          seed: Number.isFinite(Number(args.seed)) ? Number(args.seed) : 1101,
          ...(typeof args.accelPlan === 'string' && args.accelPlan ? { accelPlan: args.accelPlan } : {}),
          ...(Number.isFinite(Number(args.steps)) ? { steps: Number(args.steps) } : {}),
          ...(args.preset ? { nanfengPreset: args.preset } : {}),
          ...(args.params ? { nanfengExtra: args.params } : {}),
          ...(args.mode ? { nanfengMode: args.mode } : {}),
          ...(args.continuationTask ? { continuationTask: args.continuationTask } : {}),
        },
        mode: shot.mode,
      });
      if (backendId === 'h3-image') job.kind = 'image';
      await jobsStore().upsert(job);

      fireAndLog(runGenerationFor(job, { shot, projectId: pid, backendId }), ctx, `job ${job.id}`);
      return job;
    },
  )));

  /* ---------------------------------------------------------- 任务 */

  /** 重跑一条任务（与 REST /jobs/:id/retry 同语义） */
  async function retryJobById(jobId) {
    const old = await jobsStore().get(jobId);
    if (!old) throw new Error(`JOB_NOT_FOUND: ${jobId}`);
    const pid = requireProjectId(old.projectId);
    const shot = listShots(pid).find((s) => s.id === old.shotId);
    if (!shot) throw new Error(`SHOT_NOT_FOUND: ${old.shotId}`);
    const job = newJob({
      projectId: pid,
      shotId: old.shotId,
      backendId: old.backendId,
      prompt: old.prompt,
      params: old.params,
      mode: old.mode,
    });
    await jobsStore().upsert(job);
    fireAndLog(
      runGenerationFor(job, { shot, projectId: pid, backendId: old.backendId }),
      ctx,
      `retry ${job.id}`,
    );
    return job;
  }

  disposers.push(reg(tool(
    'studio_jobs',
    '任务查询 / 取消 / 重试。cancel 会真正通知远端（ComfyUI /interrupt）。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'cancel', 'retry'] },
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
      if (args.action === 'get') return jobsStore().get(args.jobId);
      if (args.action === 'cancel') {
        return cancelJob(args.jobId, async (job) => {
          // 只有真正提交到 ComfyUI 的本地后端才有远端可取消（mock 没有）
          if (job.remoteId && isLocalBackendOf(job.backendId)) {
            await comfy.cancelRemote(cfgNow(), job.remoteId);
          }
        });
      }
      if (args.action === 'retry') return retryJobById(args.jobId);
      throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(args.action)}`);
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
      const a = args.projectId ? { ...args, projectId: requireProjectId(args.projectId) } : args;
      if (a.action === 'analyze') return z.h3.analyze(a);
      if (a.action === 'import') return z.h3.importAssets(a);
      throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(args.action)}`);
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
        timeoutMs: { type: 'number', description: '渲染超时（30s–15min，默认 10min）' },
        jobId: { type: 'string', description: '本次渲染的目录名（缺省用 shotId）' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      const cfg = cfgNow();
      if (a.action === 'health') return blenderStatus();
      if (a.action === 'assets') return { assets: listModelAssets(cfg) };
      if (a.action === 'actions') {
        if (!a.assetRel) throw new Error('ASSET_REQUIRED');
        return listAssetActions({ assetRel: String(a.assetRel), cfg });
      }
      const pid = a.projectId ? requireProjectId(a.projectId) : '';
      const shot = a.shot ?? (pid && a.shotId ? listShots(pid).find((s) => s.id === a.shotId) : null);
      if (!shot) throw new Error('SHOT_NOT_FOUND');
      const spec = a.spec ?? buildSceneSpec(shot, { frames: a.frames });
      if (a.action === 'spec') return spec;
      return renderControl({
        mode: String(a.mode || 'blockout'),
        spec,
        cfg,
        jobId: String(a.jobId || a.shotId || shot.id || 'shot'),
        timeoutMs: Math.max(30000, Math.min(900000, Number(a.timeoutMs) || 600000)),
      });
    },
  )));

  /* ---------------------------------------------------------- 后处理 */
  disposers.push(reg(tool(
    'studio_post',
    'ffmpeg 后处理与图像工具：transcode / scale / crop / split（切割分镜）/ annotate（文字标注）/ '
    + 'extractFrame / extractAudio / stripAudio（去音轨，人物替换的必备前置）/ qc。',
    {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['transcode', 'scale', 'crop', 'split', 'annotate', 'extractFrame', 'extractAudio', 'stripAudio', 'qc'] },
        input: { type: 'string', description: '媒体文件路径（相对 dataDir 或 dataDir 内的绝对路径）' },
        /** qc 的 REST 形参别名（deprecated：等价于 input） */
        path: { type: 'string', description: '[deprecated] 等价于 input，仅为兼容 REST 调用方' },
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
      required: ['op'],
      additionalProperties: false,
    },
    async (a) => {
      const { op, path: pathAlias, ...rest } = a;
      // qc 收**一个字符串**（媒体路径），其余 op 收对象 —— 形状不同不能统一透传
      if (op === 'qc') {
        const target = rest.input ?? pathAlias;
        if (!target) throw new Error('INPUT_REQUIRED: qc 需要 input（媒体文件路径）');
        return z.post.qc(target);
      }
      const target = rest.input ?? pathAlias;
      if (!target) throw new Error('INPUT_REQUIRED: 该后处理需要 input');
      return z.post[op]({ ...rest, input: target });
    },
  )));

  /* ---------------------------------------------------------- 视频剪辑 */
  disposers.push(reg(tool(
    'studio_edit',
    '视频剪辑：probe（探测时长/分辨率/音轨）/ trim（按时间裁切）/ concat（多段拼接，可带转场）'
    + '/ audio（strip 剥原声 / volume 调音量 / bgm 换或混 BGM）/ render（按工程出片）'
    + '/ clips（列出可剪辑素材）/ projects（剪辑工程增删查改）。',
    {
      type: 'object',
      properties: {
        op: {
          type: 'string',
          enum: ['probe', 'trim', 'concat', 'audio', 'render', 'clips', 'projects'],
        },
        action: { type: 'string', description: 'projects 域的子操作：list / get / save / delete' },
        // ---- 通用 ----
        input: { type: 'string', description: '单个媒体路径（相对 dataDir 或 dataDir 内的绝对路径）' },
        inputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'concat 的片段列表，按拼接顺序排列',
        },
        // ---- trim ----
        startSec: { type: 'number', description: 'trim 的起点（秒）' },
        endSec: { type: 'number', description: 'trim 的终点（秒），不填则到片尾' },
        reencode: { type: 'boolean', description: 'trim/concat/render 是否强制重编码；不填则自动判断' },
        // ---- concat ----
        transitionSec: { type: 'number', description: 'concat 的淡入淡出转场时长（秒），0 为硬切' },
        // ---- audio ----
        audioOp: {
          type: 'string',
          enum: ['strip', 'volume', 'bgm'],
          // 与 REST /edit/audio 的 `op` 同名同义；工具顶层的 op 是动作分发器，故此处不叫 op
          description: 'audio 的子操作（等价于 REST 的 op）',
        },
        bgmInput: { type: 'string', description: 'audio/bgm 的背景音乐路径' },
        replaceOriginal: { type: 'boolean', description: 'audio/bgm 是否完全替换原声（false 则混音）' },
        bgmVolume: { type: 'number', description: 'BGM 音量 0~4' },
        originalVolume: { type: 'number', description: '原声音量 0~4' },
        fadeInSec: { type: 'number' },
        fadeOutSec: { type: 'number' },
        // ---- render / projects ----
        projectId: { type: 'string', description: '剪辑工程 id（projects 的 get/save/delete 必填）' },
        name: { type: 'string' },
        clips: {
          type: 'array',
          description: 'render/projects 的片段列表',
          items: {
            type: 'object',
            properties: {
              rel: { type: 'string' },
              name: { type: 'string' },
              startSec: { type: 'number' },
              endSec: { type: 'number' },
            },
            required: ['rel'],
          },
        },
        audio: {
          type: 'object',
          description: 'render 的音轨设置（mode: original/strip/bgm/volume）',
          additionalProperties: true,
        },
      },
      required: ['op'],
      additionalProperties: false,
    },
    async (a) => {
      const { op } = a;
      if (op === 'clips') return z.edit.listClips();
      if (op === 'probe') {
        if (!a.input) throw new Error('INPUT_REQUIRED: probe 需要 input');
        return z.edit.probe(a.input);
      }
      if (op === 'trim') {
        if (!a.input) throw new Error('INPUT_REQUIRED: trim 需要 input');
        return z.edit.trim({
          input: a.input,
          startSec: a.startSec,
          endSec: a.endSec,
          reencode: a.reencode,
        });
      }
      if (op === 'concat') {
        if (!Array.isArray(a.inputs) || !a.inputs.length) {
          throw new Error('NO_INPUTS: concat 需要至少一个 input');
        }
        return z.edit.concat({
          inputs: a.inputs,
          transitionSec: a.transitionSec,
          reencode: a.reencode,
        });
      }
      if (op === 'audio') {
        if (!a.input) throw new Error('INPUT_REQUIRED: audio 需要 input');
        if (!a.audioOp) throw new Error('AUDIO_OP_REQUIRED: audio 需要 audioOp（strip/volume/bgm）');
        return z.edit.audio({
          input: a.input,
          op: a.audioOp,
          bgmInput: a.bgmInput,
          replaceOriginal: a.replaceOriginal,
          bgmVolume: a.bgmVolume,
          originalVolume: a.originalVolume,
          fadeInSec: a.fadeInSec,
          fadeOutSec: a.fadeOutSec,
        });
      }
      if (op === 'render') {
        return z.edit.render({
          id: a.projectId,
          clips: a.clips,
          audio: a.audio,
          transitionSec: a.transitionSec,
          reencode: a.reencode,
          name: a.name,
        });
      }
      if (op === 'projects') {
        const action = a.action || (a.projectId ? 'get' : 'list');
        if (action === 'list') return z.edit.listProjects();
        if (!a.projectId) throw new Error('PROJECT_ID_REQUIRED: projects 的 get/save/delete 需要 projectId');
        const id = safeId(String(a.projectId));
        if (action === 'get') return { ok: true, project: z.edit.getProject(id) };
        if (action === 'delete') return z.edit.deleteProject(id);
        if (action === 'save') return { ok: true, project: z.edit.saveProject(id, a) };
        throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(action)}`);
      }
      throw new Error(`UNKNOWN_EDIT_OP: ${op}`);
    },
  )));

  /* ---------------------------------------------------------- 工具箱 */
  disposers.push(reg(tool(
    'studio_toolbox',
    '工具箱：promptTemplates 提示词模板（list/upsert/delete）/ wardrobe 服化道（list/upsert/delete）/ '
    + 'importScan 分镜目录导入（scan/preview）/ orphans 孤儿清理（list/clean）/ '
    + 'motionShots 动态条（list/upsert/delete）/ logs 运行日志（list/upsert）/ '
    + 'batchProgress 批量进度（仅 list）。',
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
          // batchProgress 是只读域：别的动作必须显式拒绝，否则模型会以为操作成功了
          if (a.action !== 'list') {
            throw new Error(`UNKNOWN_ACTION: batchProgress 只支持 list，收到 ${JSON.stringify(a.action)}`);
          }
          const jobs = await jobsStore().list();
          return e.batchProgress(jobs);
        }
        default: throw new Error(`UNKNOWN_DOMAIN: ${String(a.domain)}`);
      }
      throw new Error(`UNKNOWN_ACTION: ${a.domain}/${a.action}`);
    },
  )));

  /* ---------------------------------------------------------- 图像生成 */
  disposers.push(reg(tool(
    'studio_image',
    'H3-Image 图像生成：文生图 / 参考图编辑 / 批量 / LoRA。'
    + '6 步固定采样（checkpoint 的 PDD 头网格决定，不可调），guidance 1.0，无负面提示词。'
    + 'action=meta 查模型状态、尺寸表、真实生效参数与各项上限；'
    + 'action=lora 查图像 LoRA 目录；generate 出图；inpaint 局部重绘。'
    + 'refImages 的第 1 张是"被编辑的原图"（决定输出画布与编辑目标），最多 16 张；'
    + '不传 refImages 就走文生图。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['meta', 'lora', 'generate', 'inpaint'] },
        prompt: { type: 'string', description: '提示词（最长 4096 字符，超长会被拒绝而不是截断；建议详细完整）' },
        sizeId: { type: 'string', description: '尺寸 id（见 meta.sizes），默认 auto：有参考图时继承原图、否则 2048²' },
        width: { type: 'number', description: '显式宽（32 的倍数，与 height 必须同时给）' },
        height: { type: 'number', description: '显式高（32 的倍数）' },
        seed: { type: 'number', description: '种子；count>1 时其余样本按 seed+1、+2 递增' },
        count: { type: 'number', description: '出几张（1-4）。会拆成 N 个独立任务（DiT 不支持 batch>1）' },
        refImages: {
          type: 'array',
          items: { type: 'string' },
          description: '参考图（dataDir 相对路径或 dataURL；第 1 张 = 被编辑的原图，最多 16 张）',
        },
        loras: {
          type: 'array',
          description: 'LoRA 栈：[{name:"h3img/30_style/x.safetensors", strength:0.8}]（名字见 action=lora）',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              strength: { type: 'number' },
            },
            required: ['name'],
          },
        },
        projectId: { type: 'string' },

        /* ---- 提示词编译器 / 画风 ---- */
        text: { type: 'string', description: '短需求或中文描述（会展开成完整英文描述；与 prompt 二选一）' },
        styleId: { type: 'string', description: '画风 id（见 action=meta 的 styles，或 "none"）。2D 画风会自动注入反 3D 约束' },
        styleAnchorImages: {
          type: 'array',
          items: { type: 'string' },
          description: '画风参考图（最多 2 张，dataDir 相对路径）。只借画法不借内容，永远追加在参考图末尾，不占 image_1',
        },
        styleAnchorMode: {
          type: 'string',
          enum: ['style-only', 'style+palette'],
          description: '画风锚借用范围：style-only=只借画法与质感（推荐）/ style+palette=连配色一起借',
        },
        compile: { type: 'boolean', description: '是否编译提示词（默认 true）。false = 按原文提交，排障用' },

        /* ---- action=inpaint 专用 ---- */
        sourceImage: { type: 'string', description: 'inpaint：源图（dataDir 相对路径或 dataURL）' },
        maskImage: { type: 'string', description: 'inpaint：mask 图（白色=重绘区域，尺寸必须与源图一致）' },
        inpaintMode: { type: 'string', enum: ['crop', 'full'], description: 'inpaint：crop=裁剪重绘再贴回（推荐，mask 外逐像素保真）/ full=全图 latent 混合' },
        inpaintStrength: { type: 'string', enum: ['full', 'strong', 'medium', 'light'], description: 'inpaint：改动强弱（SplitSigmas 切片，不是 denoise）' },
        cropResolution: { type: 'number', description: 'inpaint：crop 模式的重绘分辨率（手动档），必须 32 倍数' },
        cropResolutionId: { type: 'string', enum: ['auto', '512', '768', '1024', '1280'], description: 'inpaint：分辨率档位。auto=按笔画面积自动算（推荐）' },
        strokePixels: { type: 'number', description: 'inpaint：mask 的非零像素数（auto 档估算 bbox 用）' },
        bboxW: { type: 'number', description: 'inpaint：mask 外接框宽（auto 档按这个算分辨率，最准）' },
        bboxH: { type: 'number', description: 'inpaint：mask 外接框高' },
        graded: { type: 'boolean', description: 'inpaint：分级重绘开关。mask 的灰度 = 该像素的重绘强度（1.0 全重绘，0.55 小幅修饰）' },
        gradedLevel: { type: 'string', enum: ['full', 'strong', 'medium', 'light', 'keep'], description: 'inpaint：分级档位（graded=true 时生效）。按实测校准：full=1.0 / strong=0.85 / medium=0.7 / light=0.55 / keep=0' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      const cfg = cfgNow();

      if (a.action === 'meta') {
        return {
          models: IMAGE_MODELS_MAP,
          vae: IMAGE_VAE_NAME,
          clip: IMAGE_CLIP_NAME,
          sampling: { ...IMAGE_SAMPLING_PARAMS, steps: effectiveImageSteps(cfg) },
          effective: {
            steps: effectiveImageSteps(cfg),
            declaredSteps: IMAGE_SAMPLING_PARAMS.steps,
            stepsOverridden: effectiveImageSteps(cfg) !== IMAGE_SAMPLING_PARAMS.steps,
            maxMP: effectiveMaxMP(cfg),
            promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
            maxRefImages: IMAGE_MAX_REF_IMAGES,
            maxBatch: IMAGE_MAX_BATCH,
            maxLoras: IMAGE_MAX_LORAS,
            samplingLocked: true,
          },
          sizes: IMAGE_SIZES_LIST,
          status: checkImageModels(cfg),
          loraCategories: IMAGE_LORA_CATEGORIES,
          loraRoot: IMAGE_LORA_ROOT,
          hint: `图像 LoRA 放在 models/loras/${IMAGE_LORA_ROOT}/<分类目录>/；`
            + 'Civitai 上必须用 baseModel = "MiniMax H3 Image" 过滤（视频 LoRA 键集相同但语义不同，不要混用）。',
          // 局部重绘能力：denoiseLocked 是关键声明（PDD 6 头网格的硬约束）
          inpaint: await inpaintMeta(cfg),
          /** 提示词编译器：画风表 / 段落顺序 / 画风锚说明 / 反 3D 判定 */
          promptCompiler: imagePromptMeta(),
        };
      }

      if (a.action === 'lora') {
        const { probed, probeError } = await probeLoraFiles(cfg);
        const items = catalogImageLoras(probed ?? []);
        return {
          ok: true,
          probed: probed != null,
          ...(probeError ? { probeError } : {}),
          root: IMAGE_LORA_ROOT,
          categories: IMAGE_LORA_CATEGORIES,
          items,
          total: items.length,
        };
      }

      const wf = imageWorkflow();
      if (!wf) throw new Error('WORKFLOW_MISSING: data/workflows/h3-image.json');

      if (a.action === 'inpaint') {
        // 编排只有一份实现（services/inpaint-task.js）：校验→解析→尺寸→crop→建 job
        let prepared;
        try {
          prepared = await prepareInpaint({
            prompt: a.prompt,
            source: a.sourceImage,
            mask: a.maskImage,
            mode: a.inpaintMode,
            strength: a.inpaintStrength,
            seed: a.seed,
            loras: a.loras,
            strokePixels: a.strokePixels,
            bboxW: a.bboxW,
            bboxH: a.bboxH,
            ...(a.graded ? { graded: true, gradedLevel: a.gradedLevel } : {}),
            ...(a.cropResolutionId || a.cropResolution
              ? { crop: { resolutionId: a.cropResolutionId, baseResolution: a.cropResolution } }
              : {}),
          }, cfg, { projectId: a.projectId ?? null });
        } catch (e) {
          throw new Error(`${e?.code || 'INPAINT_BAD_REQUEST'}: ${String(e?.message || e).replace(/^[A-Z_]+:\s*/, '')}`);
        }

        const { job, req: req0, sourceAbs, maskAbs } = prepared;
        await jobsStore().upsert(job);

        // Agent 侧走 runJob：产物留在 outputs，Agent 自己引用（不强制进素材库）
        fireAndLog(
          runJob(job, async (running, hooks) => runH3Inpaint({
            baseWorkflow: wf,
            job: running,
            req: req0,
            sourceAbs,
            maskAbs,
            cfg,
            onSubmitted: hooks?.onSubmitted,
            onProgress: (p) => writeProgress(running.id, p),
          })),
          ctx,
          `inpaint job ${job.id}`,
        );

        return inpaintSubmitSummary(prepared, { forAgent: true });
      }

      if (a.action !== 'generate') throw new Error(`UNKNOWN_ACTION: ${JSON.stringify(a.action)}`);

      /**
       * 提示词编译 —— 与 REST `/image/generate` 走**同一份**实现。
       *
       * Agent 最容易只给一句中文，而本地没有官方 prompt expander，
       * 不展开就会得到平庸结果。所以这里默认开启编译，规则完全复用。
       */
      let compiled = null;
      if (a.compile !== false) {
        try {
          compiled = compileImagePrompt({
            text: a.text ?? '',
            rawPrompt: a.rawPrompt ?? (a.text ? '' : (a.prompt ?? '')),
            styleId: a.styleId ?? 'none',
            aspect: a.aspect,
          });
          if (compiled.prompt) a.prompt = compiled.prompt;
        } catch (e) {
          compiled = { warnings: [`提示词编译失败，已按原文提交：${String(e?.message || e)}`] };
        }
      }

      // 入参校验规则与 REST 共用同一份
      const req0 = validateImageRequest(a, cfg);
      const refResolved = resolveImageEditRefs(req0.refImages ?? a.refImages ?? [], cfg);
      if (!refResolved.ok.length && refResolved.bad.length) {
        throw new Error(
          `REF_IMAGE_UNRESOLVED: ${refResolved.bad.map((b) => `${b.input}（${b.reason}）`).join('；')}`,
        );
      }

      // 探测磁盘后再求解：不存在的 LoRA 必须被 rejected，不能静默 accepted
      const solvedLoras = solveImageLoras(req0.loras, {
        availableFiles: (await probeLoraFiles(cfg)).probed,
        hasRefImages: refResolved.ok.length > 0,
      });

      const warnings = [
        ...refResolved.bad.map((b) => `参考图未使用：${b.input}（${b.reason}）`),
        ...(refResolved.dropped ? [`参考图超出上限 ${refResolved.max}，忽略 ${refResolved.dropped} 张`] : []),
        ...imageLoraWarnings(solvedLoras),
      ];

      const { jobs, batchId, seeds } = await submitImageJobs({
        body: a, cfg, ctx, req0, refResolved, solvedLoras, warnings, wf,
      });

      return {
        ok: true,
        jobId: jobs[0].id,
        jobIds: jobs.map((j) => j.id),
        batchId,
        count: jobs.length,
        mode: refResolved.ok.length ? 'edit' : 't2i',
        refCount: refResolved.ok.length,
        loraStack: solvedLoras.accepted.map((x) => `${x.name}@${x.appliedStrength}`),
        seed: seeds[0],
        warnings,
        /** 编译器实际做了什么（用了哪个画风、是否注入反 3D、字符数） */
        ...(compiled ? {
          compiled: {
            usedRaw: Boolean(compiled.usedRaw),
            styleId: compiled.styleId ?? 'none',
            anti3dApplied: compiled.anti3dApplied ?? null,
            chars: compiled.chars ?? null,
          },
          promptWarnings: compiled.warnings ?? [],
        } : {}),
        note: '用 studio_jobs 查进度；制品已自动归档进素材库',
      };
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
      const sb = storyboard;
      const llm = bridgeLlm;
      const cfg = cfgNow();

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

      // 解析参考图：绝对路径同样必须在 dataDir 内（不能让 Agent 读任意本机文件）
      const images = [];
      const badRels = [];
      for (const rel of (Array.isArray(args.imageRels) ? args.imageRels : [])) {
        try {
          const abs = resolveUserPath({ root: cfg.dataDir, input: rel, mustExist: true });
          images.push({ index: images.length + 1, absPath: abs, name: path.basename(abs) });
        } catch (e) {
          badRels.push(`${rel}（${String(e?.message || e)}）`);
        }
      }

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
      if (args.action === 'analyze') {
        return { analysis, images: images.length, ...(badRels.length ? { badRels } : {}) };
      }

      const messages = sb.buildStoryboardMessages({
        idea: args.idea,
        count,
        mode,
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
      // 与 REST 同构：raw 与 badRels 两个分支都要带
      return {
        mode,
        count,
        global: parsed.global,
        segments: parsed.segments,
        analysis,
        raw: parsed.raw,
        ...(badRels.length ? { badRels } : {}),
      };
    },
  )));

  return () => disposers.forEach((d) => d && d());
}

export default registerTools;
