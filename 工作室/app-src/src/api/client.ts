/**
 * HTTP 客户端 —— 全站唯一的 fetch 出口。
 *
 * 为什么必须自己管 token：
 *   host/security.js 的 guard() 对 POST/PUT/PATCH/DELETE 强制校验 X-JZ-Token，
 *   而 token 是进程级随机值，只能从 GET /luoshu/api/token 取。
 *   所以这里统一拦截"写方法"，自动补头；token 取一次后缓存并复用。
 *
 * 为什么 base 是相对路径：
 *   SPA 挂在 /luoshu/app 且由 DSH Host 同源服务（端口随机），
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
  PrevizState,
} from './types';

/* ------------------------------------------------------------ 基础设置 */

export const API_BASE = '/luoshu/api';

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
    throw new ApiHttpError(
      res.status,
      'BAD_RESPONSE',
      '接口返回的不是 JSON（Host 可能未挂载 /luoshu/api）',
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
  previzHealth: () => request<PrevizState>('GET', '/previz/health'),
  previzStart: () => request<PrevizState>('POST', '/previz/start'),
  previzStop: () => request<PrevizState>('POST', '/previz/stop'),
  previzState: () => request<PrevizState>('GET', '/previz/state'),
  previzCommand: (name: string, args: Record<string, unknown> = {}) =>
    request<unknown>('POST', '/previz/command', { name, args }),

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
  scriptMeta: () => request<unknown>('GET', '/script/meta'),
  getScript: (projectId: string) =>
    request<unknown>('GET', `/script?projectId=${encodeURIComponent(projectId)}`),
  runScriptStage: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/script/stage', input),
  runScriptAll: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/script/runAll', input),
  checkScript: (projectId: string, limit = 10) =>
    request<unknown>('POST', '/script/check', { projectId, limit }),
  saveScript: (projectId: string, doc: unknown) =>
    request<unknown>('POST', '/script/save', { projectId, doc }),

  /* 图像工具 */
  postOp: (op: string, input: Record<string, unknown> = {}) =>
    request<unknown>('POST', `/post/${op}`, input),
  postFonts: () => request<{ fonts: string[] }>('GET', '/post/fonts'),

  /* 资产删除 */
  deleteAsset: (id: string) =>
    request<{ ok: boolean; removed: string }>('POST', '/assets/delete', { id }),

  /* 漫画工作台 */
  comicMeta: () => request<unknown>('GET', '/comic/meta'),
  getComic: (projectId: string) =>
    request<unknown>('GET', `/comic?projectId=${encodeURIComponent(projectId)}`),
  comicExtract: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/comic/extract', input),
  comicRelayout: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/comic/relayout', input),
  comicPreflight: (projectId: string) =>
    request<unknown>('POST', '/comic/preflight', { projectId }),
  comicExportPage: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/comic/export/page', input),
  comicExportAll: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/comic/export/all', input),

  /* 模特工作台 */
  mwMeta: () => request<unknown>('GET', '/mw/meta'),
  mwJobs: () => request<unknown>('GET', '/mw/jobs'),
  mwCreateJob: (input: Record<string, unknown>) => request<unknown>('POST', '/mw/jobs', input),
  mwUpdateJob: (id: string, patch: Record<string, unknown>) =>
    request<unknown>('POST', '/mw/job/update', { id, patch }),
  mwReplanJob: (id: string) => request<unknown>('POST', '/mw/job/replan', { id }),
  mwDeleteJobs: (ids: string[]) => request<unknown>('POST', '/mw/job/delete', { ids }),
  mwPlans: () => request<unknown>('GET', '/mw/plans'),
  mwSavePlan: (input: Record<string, unknown>) => request<unknown>('POST', '/mw/plan/save', input),
  mwApplyPlan: (input: Record<string, unknown>) => request<unknown>('POST', '/mw/plan/apply', input),
  mwDeletePlan: (id: string) => request<unknown>('POST', '/mw/plan/delete', { id }),
  mwFigures: () => request<unknown>('GET', '/mw/figures'),
  mwUpsertFigure: (figure: Record<string, unknown>) =>
    request<unknown>('POST', '/mw/figure/upsert', { figure }),

  /* 3D 导演台 */
  directorMeta: () => request<unknown>('GET', '/director/meta'),
  directorState: () => request<unknown>('GET', '/director/state'),
  directorShots: () => request<unknown>('GET', '/director/shots'),
  directorCommand: (input: { name: string; arguments?: Record<string, unknown> }) =>
    request<{ ok: boolean; result: unknown }>('POST', '/director/command', input),
  directorBuild: (input: Record<string, unknown>) => request<unknown>('POST', '/director/build', input),
  directorCameraPrompt: (input: Record<string, unknown>) =>
    request<unknown>('POST', '/director/camera-prompt', input),
  directorValidate: () => request<unknown>('POST', '/director/validate'),
  directorStart: () => request<unknown>('POST', '/director/start'),
  directorStop: () => request<unknown>('POST', '/director/stop'),

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
