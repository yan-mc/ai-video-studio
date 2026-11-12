/**
 * Agent 工具注册 —— 供模型直接驱动工作室。
 *
 * 命名沿用 studio_（与旧插件兼容），但全部走新实现。
 */
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from './config.js';
import { projects, assets, newProject, newShot, PROFILES, resolutionFor, h3Length, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, H3_MODEL_SLOTS } from './store/models.js';
import { jobs as jobsStore, newJob } from './services/job-store.js';
import { runJob, cancelJob, runtimeStats } from './services/job-runner.js';
import { compilePrompt, listShots, upsertShot, writeShots } from './api/index.js';
import * as comfy from './services/comfy-client.js';
import * as seedanceClient from './services/seedance-client.js';
import { extractAssets, segmentScript } from './services/h3-workshop.js';
import { runH3Local } from './services/generator.js';
import { SCRIPT_GENRES, SCRIPT_STAGES, checkConsistency } from './services/script-service.js';
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
   * 幂等注册：一次失败的重载可能把上一次的注册留在 registry 里，
   * 直接再 register 会报 "already registered"。这里先探一下同名工具，
   * 已存在就跳过（那必然是本插件上一次注册的）。
   */
  const reg = (def) => {
    try {
      if (typeof ctx.tools.get === 'function' && ctx.tools.get(def.name)) return () => {};
    } catch { /* get 可能不可用，忽略 */ }
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

  /* ---------------------------------------------------------- 提示词 */
  disposers.push(reg(tool(
    'studio_prompt',
    '编译镜头的 H3 提示词，并返回分辨率与帧数建议。',
    {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        shotId: { type: 'string' },
      },
      required: ['projectId', 'shotId'],
      additionalProperties: false,
    },
    async (args) => {
      const shot = listShots(args.projectId).find((s) => s.id === args.shotId);
      if (!shot) throw new Error('SHOT_NOT_FOUND');
      return ({
        prompt: compilePrompt(shot),
        resolution: resolutionFor(shot.profile, shot.ratio),
        h3Length: h3Length(shot.durationSec),
      });
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
          if (job.remoteId) await comfy.cancelRemote(loadConfig(), job.remoteId);
        }));
      }
      throw new Error('UNKNOWN_ACTION');
    },
  )));

  /* ---------------------------------------------------------- H3 工坊 */
  disposers.push(reg(tool(
    'studio_h3_workshop',
    'H3 提示词工坊：把一集剧本分析成中性分段 + 资产提示词。',
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

  return () => disposers.forEach((d) => d && d());
}

export default registerTools;





