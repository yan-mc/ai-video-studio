/**
 * 素材库服务 —— 14 类资产的持久化与上传。
 *
 * 修掉审查确认的严重缺陷：原实现上传保留原始扩展名且落盘路径可被
 * 后续配置改写 → 结合 POST /config 可达成执行链。本实现：
 *  - 落盘只接受白名单扩展名；
 *  - 文件名由服务端生成（不含用户可控片段）；
 *  - 原始文件名只作为展示字段保存。
 */
import fs from 'node:fs';
import path from 'node:path';
import { assets, ASSET_TYPES } from '../store/models.js';
import { safeId, safeJoin } from '../security.js';

const ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff',
  '.mp4', '.webm', '.mov', '.m4v',
  '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg',
  '.glb', '.gltf', '.fbx', '.obj',
  '.woff2', '.woff', '.ttf', '.otf',
  '.json', '.txt', '.md', '.svg',
]);

const KIND_BY_EXT = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.svg'],
  video: ['.mp4', '.webm', '.mov', '.m4v'],
  audio: ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'],
  model3d: ['.glb', '.gltf', '.fbx', '.obj'],
  font: ['.woff2', '.woff', '.ttf', '.otf'],
  doc: ['.json', '.txt', '.md'],
};

export function createAssetService({ cfg }) {
  function assetRootDir() {
    const d = path.join(cfg.dataDir, 'assets');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function kindOfExt(ext) {
    const e = String(ext || '').toLowerCase();
    for (const [kind, list] of Object.entries(KIND_BY_EXT)) if (list.includes(e)) return kind;
    return 'other';
  }

  /**
   * 保存上传的资产。
   * @param {Buffer} data
   * @param {{filename?:string, type?:string, name?:string, projectId?:string, tag?:string, note?:string}} opts
   */
  async function saveUploaded(data, opts = {}) {
    const original = String(opts.filename || 'upload.bin');
    const ext = path.extname(original).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error(`UNSUPPORTED_FILE_TYPE: ${ext || '(none)'}`);

    const id = assets.newId();
    const stored = `${id}${ext}`;                 // 服务端生成，无用户可控片段
    const dir = assetRootDir();
    const abs = safeJoin(dir, stored);
    fs.writeFileSync(abs, data);

    const type = ASSET_TYPES.includes(opts.type) ? opts.type : 'general';
    const item = {
      id,
      projectId: opts.projectId || null,
      type,
      name: String(opts.name || original),
      originalName: original,
      kind: kindOfExt(ext),
      rel: path.relative(cfg.dataDir, abs).replace(/\\/g, '/'),
      bytes: data.length,
      tag: opts.tag || '',
      note: opts.note || '',
      dataJson: '{}',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await assets.upsert(item);
    return item;
  }

  /**
   * 把**已存在的文件**登记进素材库（复制一份，不动源文件）。
   *
   * 用途：生成产物（`data/outputs/`）本来是临时区，画布与渲染页都看不到。
   * 归档后它变成正式资产，任何页面都能引用。
   *
   * 与 saveUploaded 的区别：那个接 Buffer（上传），这个接路径（已有产物）。
   *
   * @param {string} absPath 源文件绝对路径
   * @param {{type?:string,name?:string,projectId?:string,tag?:string,note?:string}} opts
   */
  async function archiveFile(absPath, opts = {}) {
    const src = String(absPath ?? '');
    if (!src || !fs.existsSync(src)) throw new Error(`SOURCE_NOT_FOUND: ${src}`);
    const ext = path.extname(src).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error(`UNSUPPORTED_FILE_TYPE: ${ext || '(none)'}`);

    const id = assets.newId();
    const stored = `${id}${ext}`;
    const dir = assetRootDir();
    const abs = safeJoin(dir, stored);
    fs.copyFileSync(src, abs);

    const type = ASSET_TYPES.includes(opts.type) ? opts.type : 'general';
    const item = {
      id,
      projectId: opts.projectId || null,
      type,
      name: String(opts.name || path.basename(src, ext)),
      originalName: path.basename(src),
      kind: kindOfExt(ext),
      rel: path.relative(cfg.dataDir, abs).replace(/\\/g, '/'),
      bytes: fs.statSync(abs).size,
      tag: opts.tag || '',
      note: opts.note || '',
      dataJson: '{}',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await assets.upsert(item);
    return item;
  }

  async function list({ type, projectId } = {}) {
    const all = await assets.list();
    return all.filter((a) => {
      if (type && a.type !== type) return false;
      if (projectId && a.projectId && a.projectId !== projectId) return false;
      return true;
    });
  }

  async function get(id) {
    return assets.get(safeId(id, /^asset_[A-Za-z0-9]+$/));
  }

  /**
   * 直接用给定的完整对象覆盖资产记录。
   *
   * 用途：上传/归档后补写探测出来的元数据（时长、是否有音轨、分辨率）。
   * 与 saveUploaded 的区别：那个负责建记录，这个只负责更新已有记录。
   */
  async function upsertRaw(item) {
    if (!item?.id) throw new Error('ASSET_ID_REQUIRED');
    return assets.upsert({ ...item, updatedAt: Date.now() });
  }

  /** 解析资产的可读绝对路径（供静态服务用） */
  async function resolveFile(id) {
    const a = await assets.get(safeId(id, /^asset_[A-Za-z0-9]+$/));
    if (!a) throw new Error('ASSET_NOT_FOUND');
    const abs = safeJoin(cfg.dataDir, a.rel);
    if (!fs.existsSync(abs)) throw new Error('ASSET_FILE_MISSING');
    return abs;
  }

  async function remove(id) {
    const safe = safeId(id, /^asset_[A-Za-z0-9]+$/);
    const a = await assets.get(safe);
    if (!a) return { ok: false, error: 'ASSET_NOT_FOUND' };
    try {
      const abs = safeJoin(cfg.dataDir, a.rel);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch { /* 文件不存在不阻断记录删除 */ }
    await assets.remove(safe);
    return { ok: true, removed: safe };
  }

  return { saveUploaded, archiveFile, list, get, upsertRaw, resolveFile, remove, kindOfExt };
}