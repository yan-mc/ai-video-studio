/**
 * 视频剪辑 —— REST 客户端。
 *
 * 为什么单独开一个文件而不是塞进 client.ts：
 *   client.ts 已经 700+ 行、60+ 个函数，再往里加会让"哪里定义了什么"变得难查。
 *   剪辑是一块相对独立的能力（工程 / 片段 / 音轨），单独一文件更好维护。
 *
 * 但**不重复实现 fetch 与 token**：一律复用 client.ts 的 request 核心，
 * 再导出一遍 ensureToken 口径。写令牌、错误形状、BAD_RESPONSE 重试
 * 都只有一处实现 —— 这是本项目最容易各写各的、写出 403 的地方。
 */
import { API_BASE, describeError, request } from './client';

/* ------------------------------------------------------------- 类型 */

export interface EditClipMeta {
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  frames: number | null;
}

export interface EditAudioMeta {
  codec: string | null;
  sampleRate: number | null;
  channels: number | null;
}

export interface EditProbeResult {
  ok: boolean;
  path: string;
  rel: string;
  durationSec: number | null;
  bytes: number;
  format: string | null;
  video: EditClipMeta | null;
  audio: EditAudioMeta | null;
  hasAudio: boolean;
}

export interface EditMediaItem {
  rel: string;
  name: string;
  kind: 'video' | 'audio';
  bytes: number;
  mtime: number;
}

export interface EditClip {
  id: string;
  rel: string;
  name: string;
  startSec: number;
  endSec: number | null;
}

export type EditAudioMode = 'original' | 'strip' | 'bgm' | 'volume';

export interface EditAudioSettings {
  mode: EditAudioMode;
  bgmRel: string;
  bgmVolume: number;
  originalVolume: number;
  replaceOriginal: boolean;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface EditProject {
  id: string;
  name: string;
  clips: EditClip[];
  audio: EditAudioSettings;
  createdAt: string;
  updatedAt: string;
  lastOutputRel?: string;
}

export interface EditProjectSummary {
  id: string;
  name: string;
  clipCount: number;
  updatedAt: string | null;
}

export interface EditRenderResult {
  ok: boolean;
  path: string;
  rel: string;
  bytes: number;
  segments: number;
  meta: {
    durationSec: number | null;
    video: EditClipMeta | null;
    audio: EditAudioMeta | null;
  };
}

export interface EditOpResult {
  ok: boolean;
  path: string;
  rel: string;
  bytes: number;
  [k: string]: unknown;
}

/* --------------------------------------------------------- fetch 核心 */

/**
 * 剪辑线的请求走 `client.ts` 的 `request` —— **不再自建一份**。
 *
 * ⚠️ 这里原本复制了 20 行 fetch，理由是"client.ts 的 request 是模块私有的"。
 *    后果是复制出来的那份把刚修好的两件事全丢了：
 *      · 没有 `AbortSignal.timeout()` → 出片中途切页，请求挂到进程结束，
 *        状态栏永远停在"渲染中"；`/edit/render` 的 600s 长超时对它也不生效。
 *      · 没有 403 `WRITE_TOKEN_REQUIRED` 重取 token → Host 重启后整个剪辑页
 *        （trim/concat/audio/render/工程保存）全部永久失败，只能手动刷新。
 */
function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request<T>(method, `/edit${path.startsWith('/') ? path : `/${path}`}`, body);
}

/* ------------------------------------------------------------- 接口 */

/** 可剪辑素材（outputs / assets / edit/outputs 里的音视频） */
export function listEditClips(): Promise<{ ok: boolean; clips: EditMediaItem[] }> {
  return call('GET', '/clips');
}

/** 探测单个媒体：时长 / 分辨率 / 帧率 / 音轨 */
export function probeEditMedia(input: string): Promise<EditProbeResult> {
  return call('POST', '/probe', { input });
}

/** 直接裁切（不落工程），立即返回产物 */
export function trimEditMedia(payload: {
  input: string;
  startSec: number;
  endSec?: number | null;
  reencode?: boolean;
}): Promise<EditOpResult> {
  return call('POST', '/trim', payload);
}

/** 直接拼接（不落工程） */
export function concatEditMedia(payload: {
  inputs: string[];
  transitionSec?: number;
  reencode?: boolean;
}): Promise<EditOpResult> {
  return call('POST', '/concat', payload);
}

/** 音轨操作：strip / volume / bgm */
export function audioEditMedia(payload: {
  input: string;
  op: 'strip' | 'volume' | 'bgm';
  bgmInput?: string;
  replaceOriginal?: boolean;
  bgmVolume?: number;
  originalVolume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}): Promise<EditOpResult> {
  return call('POST', '/audio', payload);
}

/** 按工程出片 */
export function renderEditProject(payload: {
  id?: string;
  name?: string;
  clips?: Array<{ rel: string; name?: string; startSec?: number; endSec?: number | null }>;
  audio?: Partial<EditAudioSettings>;
  transitionSec?: number;
  reencode?: boolean;
}): Promise<EditRenderResult> {
  return call('POST', '/render', payload);
}

export function listEditProjects(): Promise<{ ok: boolean; projects: EditProjectSummary[] }> {
  return call('GET', '/projects');
}

export function getEditProject(id: string): Promise<{ ok: boolean; project: EditProject }> {
  return call('GET', `/projects/${encodeURIComponent(id)}`);
}

export function saveEditProject(
  id: string,
  patch: Partial<EditProject> & { clips?: Array<Partial<EditClip> & { rel: string }> },
): Promise<{ ok: boolean; project: EditProject }> {
  return call('POST', `/projects/${encodeURIComponent(id)}`, patch);
}

export function deleteEditProject(id: string): Promise<{ ok: boolean; id: string }> {
  return call('DELETE', `/projects/${encodeURIComponent(id)}`);
}

export { describeError };

/** 成片的内联播放地址 —— 走既有 /file 通道（子目录白名单内） */
export function editFileUrl(rel: string): string {
  return `${API_BASE}/file?path=${encodeURIComponent(rel)}`;
}