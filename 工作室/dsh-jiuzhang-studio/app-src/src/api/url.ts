/**
 * 任务产出的读取地址。
 *
 * 后端 `outputs[]` 同时给 `rel`（相对 dataDir 的正斜杠路径）与 `path`（绝对路径）。
 * 读取只认 `rel` —— `/luoshu/api/file` 用 safeJoin 把请求限制在 dataDir 内，
 * 传绝对路径会被 403 拒绝。
 *
 * 这里兼容三种历史形态，避免各页面各写一套正则：
 *   1. { rel }                        —— 新实现，直接用
 *   2. { path: "…/outputs/x.png" }    —— 老数据，从 outputs/ 之后截取
 *   3. { path: "outputs/x.png" }      —— 已是 rel 形态
 */
/** 任务产出对象（后端 outputs[] 的元素） */
export interface JobOutput {
  role?: string;
  path?: string;
  rel?: string;
  bytes?: number;
  mime?: string;
}

export function outputUrl(o: JobOutput | null | undefined): string {
  if (!o) return '';
  const raw = String(o.rel || '');
  if (raw) return fileUrl(raw);

  const p = String(o.path || '');
  if (!p) return '';
  const norm = p.replace(/\\/g, '/');
  const at = norm.lastIndexOf('/outputs/');
  if (at >= 0) return fileUrl(`outputs/${norm.slice(at + '/outputs/'.length)}`);
  if (norm.startsWith('outputs/')) return fileUrl(norm);
  return '';
}

/** dataDir 相对路径 → 同源读取地址 */
export function fileUrl(rel: string): string {
  return `/luoshu/api/file?path=${encodeURIComponent(String(rel).replace(/\\/g, '/'))}`;
}

/** 素材读取地址 */
export function assetUrl(id: string): string {
  return `/luoshu/api/assets/item?id=${encodeURIComponent(String(id))}`;
}
