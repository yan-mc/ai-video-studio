/**
 * Agent 工具注册 —— 供模型直接驱动工作室。
 *
 * 命名沿用 studio_（与旧插件兼容），但全部走新实现。
 */
import fs from 'node:fs';
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from './config.js';
import { projects, assets, newProject, newShot, PROFILES, resolutionFor, h3Length, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, H3_MODEL_SLOTS, dirs } from './store/models.js';
import { jobs as jobsStore, newJob } from './services/job-store.js';
import { runJob, cancelJob, runtimeStats } from './services/job-runner.js';
import { compilePrompt, listShots, upsertShot, writeShots } from './api/index.js';
import * as comfy from './services/comfy-client.js';
import * as seedanceClient from './services/seedance-client.js';
import { extractAssets, segmentScript } from './services/h3-workshop.js';
import { runH3Local } from './services/generator.js';
import { SCRIPT_GENRES, SCRIPT_STAGES, checkConsistency } from './services/script-service.js';
import { DIRECTOR_COMMANDS, CAMERA_MOVES, DIRECTOR_FPS } from './services/director3d.js';
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

function ok(value) {
  return { value, content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
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
    '查看工作室元信息：生成档位、H3 模型槽位、26 种节点、14 类资产、项目分类、后端状态。',
    { type: 'object', properties: {}, additionalProperties: false },
    async () => ({
      profiles: PROFILES,
      h3Slots: H3_MODEL_SLOTS,
      nodeTypes: NODE_TYPES.map((t) => ({ type: t, label: NODE_LABELS[t] })),
      assetTypes: ASSET_TYPES.map((t) => ({ type: t, label: ASSET_TYPE_LABELS[t] })),
      projectCategories: PROJECT_CATEGORY_LABELS,
      backends: { h3: await comfy.health(loadConfig()), seedance: { mode: seedanceClient.isAvailable(loadConfig()) ? 'real' : 'mock' } },
      runtime: runtimeStats(),
    }),
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
      switch (args.action) {
        case 'list': return (await projects.list());
        case 'create': return (await projects.upsert(newProject(args.patch || {})));
        case 'get': return (await projects.get(args.projectId));
        case 'update': {
          const p = await projects.get(args.projectId);
          if (!p) throw new Error('PROJECT_NOT_FOUND');
          return await projects.upsert({ ...p, ...(args.patch || {}), updatedAt: Date.now() });
        }
        case 'delete': return (await projects.remove(args.projectId));
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
      const pid = args.projectId;
      switch (args.action) {
        case 'list': return (listShots(pid));
        case 'create': return (upsertShot(pid, newShot(args.shot || {})));
        case 'save': return (upsertShot(pid, args.shot || {}));
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
      const pkg = toShotInputPackage(shot, {
        styleId: a.styleId ?? shot.styleId ?? null,
        subjects: a.subjects,
        scenes: a.shots,
      });
      const compiled = compileH3Prompt(pkg);
      // 兼容旧返回：附上分辨率与帧数建议
      return {
        ...compiled,
        prompt: compiled.prompt || compilePrompt(shot),
        resolution: resolutionFor(shot.profile, shot.ratio),
        h3Length: h3Length(shot.durationSec),
        package: pkg,
      };
    },
  )));

  /* ---------------------------------------------------------- 生成 */
  disposers.push(reg(tool(
    'studio_generate',
    '提交生成任务。backend=h3-local|seedance-cloud|mock。立即返回 job，异步执行。',
    {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        shotId: { type: 'string' },
        backend: { type: 'string', enum: ['h3-local', 'seedance-cloud', 'mock'] },
        seed: { type: 'number' },
      },
      required: ['projectId', 'shotId'],
      additionalProperties: false,
    },
    async (args) => {
      const shot = listShots(args.projectId).find((s) => s.id === args.shotId);
      if (!shot) throw new Error('SHOT_NOT_FOUND');
      const cfg = loadConfig();
      const backendId = args.backend || shot.backend || cfg.defaultBackend;
      const job = newJob({
        projectId: args.projectId,
        shotId: shot.id,
        backendId,
        prompt: compilePrompt(shot),
        params: { durationSec: shot.durationSec, ratio: shot.ratio, profile: shot.profile, seed: args.seed ?? 1101 },
        mode: shot.mode,
      });
      await jobsStore().upsert(job);

      runJob(job, async (running) => {
        if (backendId === 'h3-local') {
          // 统一走 services/generator.js —— 与 REST 路径共用同一实现，
          // 杜绝"工具漏填占位符"这类漂移（审查 G7）
          return runH3Local({
            workflow: z.h3.loadWorkflow(),
            job: running,
            shot,
            prompt: running.prompt,
            cfg,
          });
        }
        if (backendId === 'seedance-cloud') return seedanceClient.runSeedance({ cfg, job: running, shot, prompt: running.prompt });
        return seedanceClient.runMock({ cfg, job: running, shot, prompt: running.prompt });
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
          // 旧实现在这里不校验 backendId，对 mock / seedance 也会去调 /interrupt。
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
    'studio_previz',
    '3D 预演：start / stop / health / state / command。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop', 'health', 'state', 'command'] },
        name: { type: 'string' },
        args: { type: 'object' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      switch (a.action) {
        case 'start': return (await z.previz.start());
        case 'stop': return (z.previz.stop());
        case 'health': return (await z.previz.health());
        case 'state': return (await z.previz.state());
        case 'command': return (await z.previz.command(a.name, a.args));
        default: throw new Error('UNKNOWN_ACTION');
      }
    },
  )));

  /* ---------------------------------------------------------- 后处理 */
  disposers.push(reg(tool(
    'studio_post',
    'ffmpeg 后处理与图像工具：transcode / scale / crop / split（切割分镜）/ annotate（文字标注）/ extractFrame / extractAudio / qc。',
    {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['transcode', 'scale', 'crop', 'split', 'annotate', 'extractFrame', 'extractAudio', 'qc'] },
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
      return await z.post[op](rest);
    },
  )));

  /* ---------------------------------------------------------- 剧本 */
  disposers.push(reg(tool(
    'studio_script',
    '剧本创作（5 阶段）：outline 大纲 / bios 人物小传 / chapters 章节目录 / body 章节正文 / storyboard 视觉分镜；也可 runAll 一键跑完。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'stage', 'runAll', 'check', 'meta'] },
        projectId: { type: 'string' },
        stage: { type: 'string', enum: ['outline', 'bios', 'chapters', 'body', 'storyboard'] },
        title: { type: 'string' },
        premise: { type: 'string', description: '一句话故事' },
        genre: { type: 'string', description: '题材 id（见 meta）' },
        episodes: { type: 'number', description: '集数（1-200）' },
        episodeIndex: { type: 'number', description: 'body/storyboard 针对第几集' },
        consistencyLimit: { type: 'number' },
        characters: { type: 'array', items: { type: 'object' } },
      },
      required: ['action', 'projectId'],
      additionalProperties: false,
    },
    async (a) => {
      const { action, projectId, ...rest } = a;
      if (action === 'meta') return { genres: SCRIPT_GENRES, stages: SCRIPT_STAGES };
      if (action === 'get') return z.script.load(projectId);
      if (action === 'stage') return await z.script.runStage(projectId, rest.stage, rest);
      if (action === 'runAll') return await z.script.runAll(projectId, rest);
      if (action === 'check') {
        const doc = z.script.load(projectId) ?? {};
        return checkConsistency(doc, { limit: rest.consistencyLimit ?? 10 });
      }
      throw new Error('UNKNOWN_ACTION');
    },
  )));

  /* ---------------------------------------------------------- 模特工作台 */
  disposers.push(reg(tool(
    'studio_mw',
    '模特工作台：电商拍摄 / 影视角色双模式。action=meta 取元信息；jobs 列表；create 建作业；replan 重算镜头；plans/savePlan/applyPlan 方案库；figures 形象库。',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['meta', 'jobs', 'create', 'update', 'replan', 'delete', 'plans', 'savePlan', 'applyPlan', 'figures', 'upsertFigure'],
        },
        id: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' } },
        name: { type: 'string' },
        mode: { type: 'string', enum: ['ecom', 'film'] },
        styleId: { type: 'string' },
        customStyle: { type: 'string' },
        sizeId: { type: 'string' },
        count: { type: 'number' },
        kind: { type: 'string', enum: ['person', 'beast'] },
        jobId: { type: 'string' },
        planId: { type: 'string' },
        patch: { type: 'object' },
        figure: { type: 'object' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      switch (a.action) {
        case 'meta': return z.mw.meta();
        case 'jobs': return z.mw.listJobs();
        case 'create': return z.mw.createJob(a);
        case 'update': return z.mw.updateJob(String(a.id), a.patch ?? {});
        case 'replan': return z.mw.replanJob(String(a.id));
        case 'delete': return z.mw.deleteJobs(a.ids ?? []);
        case 'plans': return z.mw.listPlans();
        case 'savePlan': return z.mw.savePlan(String(a.jobId), a.name);
        case 'applyPlan': return z.mw.applyPlan(String(a.jobId), String(a.planId));
        case 'figures': return z.mw.listFigureItems();
        case 'upsertFigure': return z.mw.upsertFigure(a.figure ?? {});
        default: throw new Error('UNKNOWN_ACTION');
      }
    },
  )));

  /* ---------------------------------------------------------- 3D 导演台 */
  disposers.push(reg(tool(
    'studio_director',
    '3D 导演台：58 动作 / 28 运镜 / 7 人物 / 10 道具。action=meta 取能力；state 读工程；command 执行导演命令；build 从镜头卡建工程；cameraPrompt 把机位转运镜提示词；validate 校验。',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['meta', 'state', 'command', 'build', 'cameraPrompt', 'validate', 'start', 'stop'],
        },
        name: { type: 'string', description: 'director_* 命令名（action=command 时）' },
        args: { type: 'object', description: '命令参数' },
        projectId: { type: 'string' },
        shotId: { type: 'string' },
        shot: { type: 'object', description: '镜头卡（action=build 时可直接给）' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async (a) => {
      switch (a.action) {
        case 'meta': {
          const [health, catalog] = await Promise.all([
            z.director.health(),
            z.director.catalog().catch(() => ({})),
          ]);
          return { health, commands: DIRECTOR_COMMANDS, cameraMoves: CAMERA_MOVES, fps: DIRECTOR_FPS, catalog };
        }
        case 'state': return await z.director.getState();
        case 'command': {
          const name = String(a.name || '');
          if (!/^director_[a-z_]+$/.test(name)) throw new Error('INVALID_COMMAND');
          return await z.director.command(name, a.args ?? {});
        }
        case 'build': {
          const shot = a.shot ?? listShots(a.projectId || '').find((s) => s.id === a.shotId);
          if (!shot) throw new Error('SHOT_NOT_FOUND');
          return await z.director.buildFromShot(shot, a);
        }
        case 'cameraPrompt': return await z.director.toCameraPrompt(a.shotId);
        case 'validate': return await z.director.validate();
        case 'start': return await z.director.start();
        case 'stop': return await z.director.stop();
        default: throw new Error('UNKNOWN_ACTION');
      }
    },
  )));

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
          const jobs = await jobsStore().list();
          return e.batchProgress(jobs);
        }
        default: throw new Error('UNKNOWN_DOMAIN');
      }
      throw new Error('UNKNOWN_ACTION');
    },
  )));

/** 加载图像工作流（带缓存） */
  let _imgWf = null;
  function imageWorkflow() {
    if (_imgWf) return _imgWf;
    try {
      const f = `${dirs().root}/workflows/h3-image.json`;
      if (!fs.existsSync(f)) return null;
      _imgWf = JSON.parse(fs.readFileSync(f, 'utf8'));
      return _imgWf;
    } catch { return null; }
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

      runJob(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt: String(a.prompt ?? ''),
        shot: { refs: { images: a.refImages ?? [] }, imageSizeId: a.sizeId },
        cfg,
      })).catch(() => {});

      return { ok: true, jobId: job.id, status: job.status, note: '用 studio_jobs 查进度' };
    },
  )));

  return () => disposers.forEach((d) => d && d());
}

export default registerTools;









