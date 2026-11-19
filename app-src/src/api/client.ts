/**
 * HTTP 客户端 —— 全站唯一的 fetch 出口。
 *
 * 为什么必须自己管 token：
 *   host/security.js 的 guard() 对 POST/PUT/PATCH/DELETE 强制校验 X-JZ-Token，
 *   而 token 是进程级随机值，只能从 GET /jiuzhang/api/token 取。
 *   所以这里统一拦截"写方法"，自动补头；token 取一次后缓存并复用。
 *
 * 为什么 base 是相对路径：
 *   SPA 挂在 /jiuzhang/app 且由 DSH Host 同源服务（端口随机），
 *   相对路径天然跟着当前 origin 走，无需任何端口配置。
 */
import type {
  ApiError,
  AppConfig,
  Asset,
  AssetQuery,
  CancelResult,
  GenerateInput,
  H3Analysis,
  H3AnalyzeInput,
  H3FilmRenderInput,
  H3FilmStatus,
  H3ImportInput,
  H3ImportResult,
  H3LengthResult,
  HealthPayload,
  Job,
  MetaPayload,
  MonitorPayload,
  Project,
  ProjectPatch,
  ProjectSummary,
  QcResult,
  ResolutionResult,
  Shot,
  ShotInput,
  ShotValidation,
  TokenPayload,
  TranscodeInput,
  CreateProjectInput,
  BlenderHealth,
  BlenderRenderResult,
  LoraCategory,
  LoraItem,
  LoraSolveResult,
} from './types';

/* ------------------------------------------------------------ 基础设置 */

export const API_BASE = '/jiuzhang/api';

const TOKEN_HEADER = 'X-JZ-Token';

/** 写方法集合：与 host/security.js 的 WRITE_METHODS 保持完全一致 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;

  constructor(status: number, code: string, detail?: string) {
    super(`${code}${detail ? ` · ${detail}` : ''}`);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/* --------------------------------------------------------------- token */

let tokenPromise: Promise<string> | null = null;
let cachedToken = '';
let cachedOrigin = '';

/**
 * 取写操作令牌。并发调用共享同一个 in-flight promise，避免启动时打多次。
 * 失败时清空缓存，允许下一次调用重试。
 */
export function ensureToken(force = false): Promise<string> {
  if (!force && cachedToken) return Promise.resolve(cachedToken);
  if (!force && tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const res = await fetch(`${API_BASE}/token`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const body = (await safeJson(res)) as ApiError | null;
      throw new ApiHttpError(res.status, body?.error || 'TOKEN_FAILED', body?.detail);
    }
    const payload = (await res.json()) as TokenPayload;
    if (!payload?.token) throw new ApiHttpError(500, 'TOKEN_EMPTY');
    cachedToken = payload.token;
    if (payload.origin) cachedOrigin = payload.origin;
    return cachedToken;
  })();

  tokenPromise.catch(() => {
    tokenPromise = null;
    cachedToken = '';
  });

  return tokenPromise;
}

/** 供调试/诊断用：当前缓存的令牌（空串表示尚未取到） */
export function getCachedToken(): string {
  return cachedToken;
}

/** 供调试/诊断用：后端下发的 origin（可能为空） */
export function getCachedOrigin(): string {
  return cachedOrigin;
}

/* ------------------------------------------------------------ fetch 核心 */

interface RequestOptions {
  /** 是否自动附带写令牌；默认按方法自动判断 */
  withToken?: boolean;
  signal?: AbortSignal;
  /** 内部使用：标记已经重试过一次，避免无限递归 */
  _retried?: boolean;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isWrite = WRITE_METHODS.has(method);
  const needToken = opts.withToken ?? isWrite;

  if (needToken) {
    headers[TOKEN_HEADER] = await ensureToken();
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    // 网络层失败（Host 未启动、被中断等）
    throw new ApiHttpError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : String(err));
  }

  if (!res.ok) {
    const payload = (await safeJson(res)) as ApiError | null;
    throw new ApiHttpError(
      res.status,
      payload?.error || `HTTP_${res.status}`,
      payload?.detail,
    );
  }

  const payload = await safeJson(res);

  // 关键防御：后端路由未挂载 / 被 SPA fallback 吃掉时，会返回 HTML 而不是 JSON。
  // 若不在这里报错，调用方会拿到 null 并在 .find/.map 上崩掉（曾实测复现）。
  if (payload === null) {
    // 常见诱因：页面是旧端口/旧版本的缓存，或 Host 刚重启导致 token 失效。
    // 自动做一次 token 刷新 + 重试，仍失败才抛错。
    if (!opts._retried) {
      try {
        ensureToken(true);
        await ensureToken(true);
        return await request<T>(method, path, body, { ...opts, _retried: true });
      } catch { /* 落到下面抛错 */ }
    }
    throw new ApiHttpError(
      res.status,
      'BAD_RESPONSE',
      '接口返回的不是 JSON。请刷新页面（Ctrl+Shift+R）；若仍失败，说明页面缓存了旧端口地址。',
    );
  }

  return payload as T;
}

/* -------------------------------------------------------------- 具体接口 */

/**
 * multipart 上传（不能走 request()，因为要 FormData + 不设 Content-Type）。
 * 后端要求写操作带 X-JZ-Token。
 */
export async function uploadAsset(
  file: File,
  opts: { type?: string; name?: string; projectId?: string; tag?: string; note?: string } = {},
): Promise<{ ok: boolean; saved: Asset[]; count: number }> {
  const token = await ensureToken();
  const form = new FormData();
  form.append('file', file, file.name);
  if (opts.type) form.append('type', opts.type);
  form.append('name', opts.name || file.name);
  if (opts.projectId) form.append('projectId', opts.projectId);
  if (opts.tag) form.append('tag', opts.tag);
  if (opts.note) form.append('note', opts.note);

  const res = await fetch(`${API_BASE}/assets/upload`, {
    method: 'POST',
    headers: { 'X-JZ-Token': token },
    body: form,
  });
  const payload = await safeJson(res);
  if (!res.ok) {
    const obj = (payload ?? {}) as { error?: string; detail?: string };
    throw new ApiHttpError(res.status, obj.error || `HTTP_${res.status}`, obj.detail);
  }
  return payload as { ok: boolean; saved: Asset[]; count: number };
}

export const api = {
  /* 令牌 / 元信息 / 健康 */
  token: () => ensureToken(true),
  meta: () => request<MetaPayload>('GET', '/meta'),
  health: () => request<HealthPayload>('GET', '/health'),
  monitor: () => request<MonitorPayload>('GET', '/monitor'),

  /* 配置 */
  getConfig: () => request<AppConfig>('GET', '/config'),
  saveConfig: (patch: Partial<AppConfig>) => request<AppConfig>('POST', '/config', patch),

  /* 项目 */
  listProjects: () => request<ProjectSummary[]>('GET', '/projects'),
  getProject: (id: string) => request<Project>('GET', `/projects/${encodeURIComponent(id)}`),
  createProject: (input: CreateProjectInput) =>
    request<ProjectSummary>('POST', '/projects', input),
  updateProject: (id: string, patch: ProjectPatch) =>
    request<ProjectSummary>('POST', `/projects/${encodeURIComponent(id)}`, patch),
  deleteProject: (id: string) =>
    request<{ ok: boolean; removed: string }>('DELETE', `/projects/${encodeURIComponent(id)}`),

  /* 镜头 */
  listShots: (projectId: string) =>
    request<Shot[]>('GET', `/projects/${encodeURIComponent(projectId)}/shots`),
  saveShot: (projectId: string, shot: ShotInput) =>
    request<Shot>('POST', `/projects/${encodeURIComponent(projectId)}/shots`, { shot }),

  /* 生成 / 任务 */
  generate: (input: GenerateInput) => request<Job>('POST', '/generate', input),
  listJobs: () => request<Job[]>('GET', '/jobs'),
  cancelJob: (jobId: string) =>
    request<CancelResult>('POST', `/jobs/${encodeURIComponent(jobId)}/cancel`),
  retryJob: (jobId: string) =>
    request<Job>('POST', `/jobs/${encodeURIComponent(jobId)}/retry`),

  /* 分辨率 / 时长换算 */
  resolution: (profile: string, ratio: string) =>
    request<ResolutionResult>('POST', '/resolution', { profile, ratio }),
  h3Length: (durationSec: number, fps?: number) =>
    request<H3LengthResult>('POST', '/h3/length', { durationSec, fps }),

  /* 预演 */
  /**
   * Blender 预演渲染 —— 渲一段灰模参考视频（blockout），喂给 Ref2VA 的参考视频输入。
   * 旧 three.js 预演引擎与控制塔路线均已下线。
   */
  blenderHealth: () => request<BlenderHealth>('GET', '/blender/health'),
  /** 3D 资产库（glb/gltf/fbx/obj） */
  blenderAssets: () => request<{ assets: Array<{ rel: string; name: string; ext: string; kind: 'actor' | 'prop'; bytes: number }> }>('GET', '/blender/assets'),
  /**
   * 动作目录 —— **单一真源**（host/blender/actions.py）下发。
   *
   * 前端不要再硬编码动作名：历史上前端/后端/Python 三份枚举漂移到 57/59/27，
   * 导致 32 个动作"能选但不生效"。
   */
  blenderActionCatalog: () =>
    request<{
      actions: Array<{ name: string; label: string; group: string; groupLabel: string; kind: 'static' | 'hold' | 'animated' }>;
      groups: Array<{ id: string; label: string }>;
      count: number;
    }>('GET', '/blender/actions/catalog'),
  /** 读某个模型内部的动作名（会启动一次 Blender，约 1—3 秒） */
  blenderActions: (assetRel: string) =>
    request<{ rel: string; actions: Array<{ name: string; frames: [number, number]; durationFrames: number }> }>(
      'POST', '/blender/actions', { assetRel },
    ),
  blenderRender: (opts: { mode: string; projectId?: string; shotId?: string; shot?: unknown; frames?: number }) =>
    request<BlenderRenderResult>('POST', '/blender/render', opts),
  /** 用桌面 Blender 打开最近的场景（.blend）—— 页面负责"看"，这条负责"改" */
  blenderOpen: (blendRel?: string) =>
    request<{ ok: boolean; pid?: number; file?: string; detail?: string }>(
      'POST', '/blender/open', blendRel ? { blendRel } : {},
    ),

  /* H3 提示词工坊 / 成片 */
  h3Analyze: (input: H3AnalyzeInput) => request<H3Analysis>('POST', '/h3/workshop/analyze', input),
  h3Import: (input: H3ImportInput) =>
    request<H3ImportResult>('POST', '/h3/workshop/import', input),
  h3FilmStatus: () => request<H3FilmStatus>('GET', '/h3/film/status'),
  h3FilmRender: (input: H3FilmRenderInput) =>
    request<H3FilmStatus>('POST', '/h3/film/render', input),

  /* 资产 */
  listAssets: (query: AssetQuery = {}) => {
    const qs = new URLSearchParams();
    if (query.type) qs.set('type', query.type);
    if (query.projectId) qs.set('projectId', query.projectId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Asset[]>('GET', `/assets${suffix}`);
  },

  /* 剧本创作 */

  /* 图像工具 */
  postOp: (op: string, input: Record<string, unknown> = {}) =>
    request<unknown>('POST', `/post/${op}`, input),
  postFonts: () => request<{ fonts: string[] }>('GET', '/post/fonts'),

  /* 资产删除 */
  deleteAsset: (id: string) =>
    request<{ ok: boolean; removed: string }>('POST', '/assets/delete', { id }),

  /* 漫画工作台 */

  /* 模特工作台 */
  /**
   * 删除形象。
   *
   *    形象库只能增、不能删，figures.json 只增不减。
   */

  /* H3 提示词编译 */
  promptMeta: () => request<unknown>('GET', '/prompt/meta'),
  promptCompile: (input: Record<string, unknown>) => request<unknown>('POST', '/prompt/compile', input),
  promptFromShot: (input: Record<string, unknown>) => request<unknown>('POST', '/prompt/from-shot', input),
  promptPreview: (input: Record<string, unknown>) => request<unknown>('POST', '/prompt/preview', input),

  /* 画布内置 Agent */
  canvasAgentMeta: () => request<unknown>('GET', '/canvas-agent/meta'),
  canvasAgentExec: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/canvas-agent/exec', input),
  /**
   * 设置画布 Agent 的权限位。
   *
   * ⚠️ 这条之前不存在，而服务端的 setCanvasPermission() 也没有调用者 ——
   *    结果 canSpend / canDelete 恒为 false，generate_image /
   *    generate_video / delete_node / call_skill 四个工具永久不可用。
   *    权限位必须由服务端持有，这是它唯一的写入口。
   */
  canvasAgentSetPermissions: (permissions: Record<string, boolean>) =>
    request<unknown>('POST', '/canvas-agent/permissions', { permissions }),

  /* 工具箱（剩余域） */
  toolboxTemplates: () => request<unknown>('GET', '/templates'),
  toolboxTemplateUpsert: (item: Record<string, unknown>) =>
    request<unknown>('POST', '/templates/upsert', item),
  toolboxTemplateDelete: (id: string) => request<unknown>('POST', '/templates/delete', { id }),

  toolboxWardrobe: (kind?: string) =>
    request<unknown>('GET', `/wardrobe${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`),
  toolboxWardrobeUpsert: (item: Record<string, unknown>) =>
    request<unknown>('POST', '/wardrobe/upsert', item),
  toolboxWardrobeDelete: (id: string) => request<unknown>('POST', '/wardrobe/delete', { id }),
  /**
   * 服化道 → 生成入参。
   *
   * 服化道以前是**纯陈列柜**（只有 CRUD，没有任何生成链路读它）。
   * 这条是它真正参与出图的通道：返回选中条目的参考图 rel 与
   * 可直接拼进提示词的中文描述。
   */
  toolboxWardrobeResolve: (ids: string[]) =>
    request<{ ok: boolean; images: string[]; notes: string[]; count: number }>(
      'POST', '/wardrobe/resolve', { ids },
    ),
  /** 工具箱数据健康（JSON 损坏会在这里暴露，而不是静默空列表） */
  toolboxHealth: () => request<{ ok: boolean; warnings: string[] }>('GET', '/toolbox/health'),

  toolboxImportScan: (input: { dir: string }) => request<unknown>('POST', '/import/scan', input),
  toolboxImportPreview: (input: { path: string; limit?: number }) =>
    request<unknown>('POST', '/import/preview', input),

  toolboxOrphans: () => request<unknown>('GET', '/resources/orphans'),
  toolboxOrphansClean: (input: { confirm: boolean }) =>
    request<unknown>('POST', '/resources/clean', input),

  toolboxMotionShots: (projectId?: string) =>
    request<unknown>('GET', `/motionshots${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  toolboxMotionUpsert: (item: Record<string, unknown>) =>
    request<unknown>('POST', '/motionshots/upsert', item),
  toolboxMotionDelete: (id: string) => request<unknown>('POST', '/motionshots/delete', { id }),

  toolboxLogs: (limit = 100) => request<unknown>('GET', `/logs?limit=${limit}`),
  toolboxBatchProgress: () => request<unknown>('GET', '/jobs/batch-progress'),

  /* 图像生成（H3-Image） */
  imageMeta: () => request<unknown>('GET', '/image/meta'),
  imageGenerate: (input: Record<string, unknown>) => request<unknown>('POST', '/image/generate', input),

  /* 立绘拆解 */
  breakdownMeta: () => request<unknown>('GET', '/breakdown/meta'),
  breakdownPreview: (input: Record<string, unknown>) => request<unknown>('POST', '/breakdown/preview', input),
  breakdownGenerate: (input: Record<string, unknown>) => request<unknown>('POST', '/breakdown/generate', input),

  /* 角色卡仓库 */
  vaultMeta: () => request<unknown>('GET', '/vault/meta'),
  vaultCards: (q?: string) =>
    request<unknown>('GET', `/vault/cards${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  vaultCard: (id: string) => request<unknown>('GET', `/vault/cards/${encodeURIComponent(id)}`),
  vaultUpsert: (input: Record<string, unknown>) => request<unknown>('POST', '/vault/cards', input),
  vaultDelete: (id: string) => request<unknown>('POST', '/vault/cards/delete', { id }),
  vaultPlan: (opts: { projectId?: string; cardIds?: string[]; extra?: string[]; firstLast?: number }) => {
    const qs = new URLSearchParams();
    if (opts.projectId) qs.set('projectId', opts.projectId);
    if (opts.cardIds?.length) qs.set('cardIds', opts.cardIds.join(','));
    if (opts.extra?.length) qs.set('extra', opts.extra.join(','));
    if (opts.firstLast) qs.set('firstLast', String(opts.firstLast));
    return request<unknown>('GET', `/vault/plan?${qs.toString()}`);
  },

  /* 项目 ⇄ 角色卡 */
  projectCards: (projectId: string) =>
    request<unknown>('GET', `/projects/${encodeURIComponent(projectId)}/cards`),
  saveProjectCards: (projectId: string, cardIds: string[]) =>
    request<unknown>('POST', `/projects/${encodeURIComponent(projectId)}/cards`, { cardIds }),

  /* 渲染计划（编号 / 预算 / 超限裁剪由后端统一算） */
  renderPlan: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/render/plan', input),
  renderCompile: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/render/compile', input),

  /* ---------------------------- 南风 V15 ---------------------------- */

  /** 217 个参数的定义（分组 / 类型 / 默认值 / 选项） */
  nanfengSchema: () => request<{
    paramCount: number;
    /**
     * 分组元信息。
     * zh   分组级的中文说明（比 desc 更详细）
     * dead 本组内「无效参数」个数（上游硬编码关闭 / 缺依赖）
     */
    groups: Record<string, {
      id: string; name: string; desc: string; count: number;
      zh?: string; dead?: number;
    }>;
    /**
     * 每个参数的机读元信息 + 面向用户的说明。
     * zh   一句话说明它做什么
     * hint 调参建议
     * flag dead = 上游硬编码关闭，调了完全没反应
     *      banned = 缺依赖/被上游主动禁用，开了会报错
     */
    params: Record<string, {
      group: string;
      type: 'INT' | 'FLOAT' | 'BOOLEAN' | 'STRING' | 'COMBO';
      default: unknown;
      options?: Array<string | number>;
      zh?: string;
      hint?: string;
      flag?: 'dead' | 'banned';
    }>;
    /** 全量无效参数清单（用于页面顶部的提示条） */
    inert?: Array<{ name: string; flag: string; zh: string; hint: string }>;
  }>('GET', '/nanfeng/schema'),

  /** 内置预设列表 */
  nanfengPresets: () => request<{
    default: string;
    presets: Array<{ id: string; label: string; desc: string; isDefault?: boolean }>;
  }>('GET', '/nanfeng/presets'),

  /** 某预设合并后的完整参数（用于"预览将提交什么"） */
  nanfengPreset: (id: string) => request<{
    id: string;
    label: string;
    desc: string;
    params: Record<string, unknown>;
  }>('GET', `/nanfeng/presets/${encodeURIComponent(id)}`),

  /* ------------------------------ LoRA ------------------------------ */

  /**
   * LoRA 目录：分类定义 + 当前装了哪些文件 + 自动归类结果。
   *
   * `probed=false` 表示"没探测到"（ComfyUI 不可达），**不是**"一个都没装" ——
   * 两者必须区分，否则用户会以为自己的 LoRA 全丢了。
   */
  loraCatalog: () => request<{
    ok: boolean;
    probed: boolean;
    probeError?: string;
    categories: LoraCategory[];
    limits: { warn: number; block: number };
    items: LoraItem[];
    byCategory: Record<string, number>;
    total: number;
  }>('GET', '/lora/catalog'),

  /** 把候选 LoRA 摊开校验（单选替换 / 同类衰减 / 总强度看门狗） */
  loraSolve: (input: { items: Array<{ name: string; strength?: number }>; maxSlots?: number }) =>
    request<LoraSolveResult>('POST', '/lora/solve', input),

  /* ------------------------- 南风续写批次 ------------------------- */

  continuationCreate: (input: {
    projectId: string;
    shotIds: string[];
    preset?: string;
    contextLength?: string;
    audioContextLength?: number;
  }) => request<unknown>('POST', '/nanfeng/continuation/batches', input),

  continuationList: (projectId?: string) =>
    request<unknown[]>('GET', `/nanfeng/continuation/batches${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),

  continuationGet: (batchId: string) =>
    request<unknown>('GET', `/nanfeng/continuation/batches/${encodeURIComponent(batchId)}`),

  /** 取下一段的任务 JSON */
  continuationNext: (batchId: string) =>
    request<{ done: boolean; index?: number; shotId?: string | null; task?: string; contextFolder?: string }>(
      'GET',
      `/nanfeng/continuation/batches/${encodeURIComponent(batchId)}/next`,
    ),

  continuationSegment: (input: {
    batchId: string;
    index: number;
    status?: string;
    jobId?: string;
    outputRel?: string;
    frames?: number;
    error?: string;
  }) => request<unknown>('POST', '/nanfeng/continuation/segment', input),

  /* --------------------------- 智能分镜 --------------------------- */

  storyboardMeta: () => request<{
    modes: Record<string, string>;
    skills: Array<{ id: string; label: string; desc: string }>;
    llm: { available: boolean; text: unknown; vision: unknown; reason: string };
  }>('GET', '/nanfeng/storyboard/meta'),

  storyboardGenerate: (input: {
    idea?: string;
    count: number;
    mode: string;
    skillId?: string;
    imageRels?: string[];
    durationSec?: number;
    contextLength?: number;
  }) => request<{
    mode: string;
    count: number;
    global: string;
    segments: string[];
    analysis: string;
    raw: string;
  }>('POST', '/nanfeng/storyboard/generate', input),

  /* 漫画出图 */

  /* 后处理 */
  transcode: (input: TranscodeInput) => request<unknown>('POST', '/post/transcode', input),
  qc: (path: string) => request<QcResult>('POST', '/post/qc', { path }),

  /**
   * 校验镜头（后端已有 validateShot，但当前路由表未单独暴露；
   * 这里保留纯前端兜底实现，规则与 host/store/models.js 一致）。
   */
  validateShot: (shot: ShotInput): ShotValidation => {
    const warnings: string[] = [];
    const dur = Number(shot.durationSec);
    if (!Number.isFinite(dur) || dur < 1 || dur > 15) warnings.push('时长需为 1—15 秒');
    const imgs = shot.refs?.images?.length ?? 0;
    if (imgs > 9) warnings.push('参考图超过 9 张');
    if (shot.mode === 'i2v' && imgs < 1) warnings.push('首帧模式需要 1 张参考图');
    if (shot.mode === 'fl2v' && imgs < 2) warnings.push('首尾帧模式需要 2 张参考图');
    return { ok: warnings.length === 0, warnings };
  },
};

export default api;

/**
 * 把任意异常归一成一句可展示的中文提示。
 * 组件层只用这个，不直接读 ApiHttpError，避免文案散落。
 */
export function describeError(err: unknown): string {
  if (err instanceof ApiHttpError) {
    if (err.status === 403 && err.code === 'WRITE_TOKEN_REQUIRED') return '写操作缺少有效令牌';
    if (err.status === 403) return '当前来源被后端拒绝（Origin 校验失败）';
    if (err.status === 0) return '网络请求失败，请检查 Host 是否在运行';
    if (err.code.startsWith('HTTP_')) return `请求失败（HTTP ${err.status}）`;
    return err.detail ? `${err.code} · ${err.detail}` : err.code;
  }
  if (err instanceof Error) return err.message;
  return '发生未知错误';
}




