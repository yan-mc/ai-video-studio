/**
 * 参考图 / 参考素材解析 —— **全仓唯一实现**。
 *
 * 所有需要知道"一张镜头卡会提交哪些参考图、各是第几张"的地方，都必须调用本模块：
 * generator（真正提交）、render-plan（预览）、shot-context（Agent 工具）、
 * prompt-compile（提示词）。任何一处自己重写排序或编号，就会重新出现
 * "预览显示是角色卡、实际提交是道具"这类无声错位。
 *
 * ============================================================================
 * 编号规则（唯一权威）
 * ============================================================================
 *
 * 提交给南风 V15 的 `图片1..图片9` 是**固定编号槽位**，而 `<Picture N>`
 * 是提示词里的引用编号。两者必须一致，且**首尾帧会占用槽位**：
 *
 *   · i2va（图生视频）：首帧占 `图片1`，参考图从 `图片2` 开始
 *   · fl2va（首尾帧）：首帧 `图片1`、尾帧 `图片2`，参考图从 `图片3` 开始
 *   · ref2va / t2va：不占槽位，参考图从 `图片1` 开始
 *
 * → `<Picture N>` **不等于** "参考图数组里的第 N 个"，而是
 *    `planImageSlots` 分配的**最终槽位号**。全仓最容易写错的就是这一处。
 *
 * ============================================================================
 * 依赖方向
 * ============================================================================
 *
 *   ref-images.js ──▶ security.js（safeJoin / resolveUserPath）
 *                ──▶ config.js（只读 dataDir）
 *
 * **不依赖** generator / render-plan / api —— 那些是消费者，不是生产者。
 * 这样「改了顺序规则，四个入口同时生效」在结构上成立。
 *
 * @module services/ref-images
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadConfig } from '../config.js';
import { safeJoin, resolveUserPath } from '../security.js';
import { normalizeMode } from '../store/mode-aliases.js';

/** H3 Ref2VA 的参考图硬上限 */
export const MAX_REF_IMAGES = 9;
/** 参考视频 / 音频各自的上限（南风 V15 的 视频1..3 / 音频1..3） */
export const MAX_REF_VIDEOS = 3;
export const MAX_REF_AUDIOS = 3;

/**
 * H3-**Image** 编辑模式的参考图上限（16）。
 *
 * ⚠️ 与 `MAX_REF_IMAGES = 9` **不是同一个概念**，不要合并：
 *   · 9   是南风视频节点的 `图片1..图片9` 槽位上限 —— **位置**有限，超过就没槽位可放；
 *   · 16  是 H3-Image 的 `MiniMaxH3ImageConditioning.images` AUTOGROW 输入上限
 *          （节点声明 max=100，但提示词里能写清的 `<Picture N>` 引用到 16 张就到顶了，
 *          再多只会让每张图的注意力被稀释）。
 *
 * 两条通道各走各的：视频走 `resolveRefImages` + `planImageSlots`（9 槽 + 首尾帧保留），
 * 图像走 `resolveImageEditRefs`（16 张、只保序、不占槽）。**不要复用视频那份**。
 */
export const MAX_IMAGE_EDIT_REFS = 16;

function hashShort(text) {
  return createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
}

/**
 * 把一个"用户给的素材引用"解析成 dataDir 内的绝对路径。
 *
 * 支持形态（**顺序不可打乱**）：
 *   · data URL（内联 base64）→ 落盘到 `<dataDir>/tmp-inline/` 后返回路径
 *   · http(s) 同源 API URL（`/jiuzhang/api/file?path=x`）→ 取出 path 再解析
 *   · 相对路径 → 相对 dataDir
 *   · 绝对路径 → **必须在 dataDir 内**（越界返回空串，由调用方告警）
 *   · `{ absPath }` / `{ rel }` 对象
 *
 * @returns {string} 绝对路径；解析不到返回 ''
 */
export function resolveAssetPath(ref, cfg = loadConfig()) {
  const dataDir = String(cfg?.dataDir || '');
  if (!ref || !dataDir) return '';

  /* ---- 对象形态 ---- */
  if (typeof ref === 'object') {
    if (ref.absPath) return resolveAssetPath({ inline: ref.absPath }, cfg) || resolveAssetPath(ref.absPath, cfg);
    if (ref.rel) return resolveAssetPath(ref.rel, cfg);
    return '';
  }

  const raw = String(ref).trim();
  if (!raw) return '';

  /* ---- 内联 data URL ---- */
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(raw)) {
    try {
      const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(raw);
      const ext = m[1].replace('jpeg', 'jpg');
      const dir = path.join(dataDir, 'tmp-inline');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${hashShort(raw)}.${ext}`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
      return file;
    } catch { return ''; }
  }

  /* ---- 远程 URL：后端取不到 ---- */
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    // 同源 API URL 里带 path 参数时可以解出来（画布产物常见形态）
    try {
      const u = new URL(raw);
      const p = u.searchParams.get('path');
      if (p) return resolveAssetPath(p, cfg);
    } catch { /* ignore */ }
    return '';
  }

  /**
   * ---- 同源绝对路径（以 / 开头、无盘符）----
   *
   * ⚠️ win32 上 `path.isAbsolute('/jiuzhang/api/file?path=x')` 是 **true**，
   *    所以这一支必须**先于** isAbsolute 判断，否则会被当成盘路径。
   */
  if (raw.startsWith('/') && !/^[A-Za-z]:/.test(raw)) {
    try {
      const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
      const p = new URLSearchParams(q).get('path');
      if (p) return resolveAssetPath(p, cfg);
    } catch { /* ignore */ }
    try {
      const a = safeJoin(dataDir, raw);
      return fs.existsSync(a) ? a : '';
    } catch { return ''; }
  }

  /* ---- Windows 绝对路径：必须落在 dataDir 内 ---- */
  if (path.isAbsolute(raw)) {
    try {
      return resolveUserPath({ root: dataDir, input: raw, mustExist: true });
    } catch { return ''; }
  }

  /* ---- 相对路径 ---- */
  try {
    const a = safeJoin(dataDir, raw);
    return fs.existsSync(a) ? a : '';
  } catch { return ''; }
}

/**
 * 按优先级顺序解析镜头卡上的参考图，最多 9 张。
 *
 * 顺序（**唯一权威**，改这里四个入口同时生效）：
 *   0. 角色卡仓库（一致性锚点，最高优先级）
 *   1. characterRefs（历史字段，兼容老数据 / 人设卡多分图）
 *   2. 手工参考图 shot.refs.images
 *   3. 场景 / 道具 shot.sceneRefs + shot.itemRefs
 *
 * 首尾帧**不在此列** —— 它们走 previz 通道，由 planImageSlots 分配独立槽位。
 *
 * @returns {Array<{key:string, abs:string, source:string, cardId?:string, cardName?:string, slot?:string, ref:string}>}
 */
export function resolveRefImages(shot = {}, cfg = loadConfig()) {
  const out = [];
  const seen = new Set();

  const push = (abs, source, meta = {}, ref = '') => {
    if (!abs || seen.has(abs)) return false;
    if (out.length >= MAX_REF_IMAGES) return false;
    seen.add(abs);
    out.push({ key: `{{REF_${out.length + 1}}}`, abs, source, ref, ...meta });
    return true;
  };

  // 0) 角色卡仓库
  for (const card of (shot.characterCards || [])) {
    if (out.length >= MAX_REF_IMAGES) break;
    const imgs = Array.isArray(card?.resolvedImages) ? card.resolvedImages : [];
    for (const img of imgs) {
      if (out.length >= MAX_REF_IMAGES) break;
      push(resolveAssetPath(img, cfg), 'vault-card',
        { cardId: card.id, cardName: card.name, slot: img?.slot }, img?.rel ?? img);
    }
  }

  // 1) characterRefs（人设卡可能是资产 id / rel 路径 / 对象）
  for (const ref of (shot.characterRefs || [])) {
    if (out.length >= MAX_REF_IMAGES) break;
    if (ref && typeof ref === 'object' && Array.isArray(ref.images)) {
      for (const img of ref.images) {
        if (out.length >= MAX_REF_IMAGES) break;
        // ⚠️ 不能用 `if (!push(...)) break`：push 在"解析失败 / 与本卡前面的图重复 /
        //    已到上限"三种情况下都会返回 false，于是同一张立绘既在卡仓库又在人设卡时
        //    （很常见），这张卡后面所有分图都会被**跳过**。到上限才停。
        push(resolveAssetPath(img, cfg), 'character-sheet', {}, img);
      }
    } else {
      push(resolveAssetPath(ref, cfg), 'character-sheet', {}, ref);
    }
  }

  // 2) 手工参考图
  for (const ref of (shot.refs?.images || [])) {
    if (out.length >= MAX_REF_IMAGES) break;
    push(resolveAssetPath(ref, cfg), 'manual', {}, ref);
  }

  // 3) 场景 / 道具
  for (const ref of [...(shot.sceneRefs || []), ...(shot.itemRefs || [])]) {
    if (out.length >= MAX_REF_IMAGES) break;
    push(resolveAssetPath(ref, cfg), 'scene-item', {}, ref);
  }

  return out;
}

/**
 * 解析参考视频 / 音频为 `[{ rel, abs, name, hasAudio, missing }]`。
 *
 * **解析不到的条目也保留占位**（`missing: true`），因为槽位编号是位置相关的：
 * filter 掉之后 `<Video 2>` 会变成 `<Video 1>`，而提示词还是按原来的编号写的。
 *
 * 兼容三种历史形态：字符串 rel、`{ rel }`、`{ abs }`。
 */
export function resolveMediaEntries(list, cfg = loadConfig()) {
  const dataDir = String(cfg?.dataDir || '');
  const out = [];
  for (const item of (Array.isArray(list) ? list : [])) {
    const rel = typeof item === 'string' ? item : (item?.rel ?? '');
    let abs = '';
    if (typeof item === 'object' && item?.abs && fs.existsSync(item.abs)) {
      abs = item.abs;
    } else if (rel) {
      abs = resolveAssetPath(rel, cfg) || '';
      if (!abs && dataDir) {
        try {
          const a = safeJoin(dataDir, rel);
          if (fs.existsSync(a)) abs = a;
        } catch { /* 越界 → 保持 missing */ }
      }
    }
    out.push({
      rel: rel || '',
      abs,
      name: (typeof item === 'object' && item?.name) || (rel ? path.basename(rel) : ''),
      hasAudio: typeof item === 'object' && typeof item.hasAudio === 'boolean' ? item.hasAudio : null,
      missing: !abs,
    });
  }
  return out;
}

/** 从镜头卡 previz 绑定解析首尾帧绝对路径 */
export function resolvePrevizArtifacts(shot, cfg = loadConfig()) {
  const out = {};
  const p = shot?.previz;
  if (!p) return out;
  if (p.firstFramePath) {
    const a = resolveAssetPath(p.firstFramePath, cfg);
    if (a) out['{{FIRST_FRAME}}'] = a;
  }
  if (p.lastFramePath) {
    const a = resolveAssetPath(p.lastFramePath, cfg);
    if (a) out['{{LAST_FRAME}}'] = a;
  }
  return out;
}

/**
 * 规划 `图片1..9` 槽位分配。
 *
 * 这是全仓**唯一**决定"参考图是第几号"的地方。
 *
 * 返回：
 *   · images          最终要填进 图片1..9 的文件名（**已避开保留槽位**，保序）
 *   · frameSlots      首/尾帧要写的槽位对象 `{ '图片1': file, ... }`
 *   · reserved        被首尾帧占用的槽位号（1-based）
 *   · pictureIndexMap 参考图**原始下标（0-based）** → 最终 `<Picture N>` 编号
 *   · dropped         因槽位不足被丢弃的参考图（**调用方必须告警，不能静默丢**）
 *
 * @param {string} mode
 * @param {string[]} stagedRefs staged 后的参考图文件名（保序，可含空串）
 * @param {string} [stagedFirst] staged 后的首帧文件名
 * @param {string} [stagedLast]  staged 后的尾帧文件名
 */
export function planImageSlots(mode, stagedRefs, stagedFirst, stagedLast) {
  // 模式别名归一：镜头卡可能存短名 i2v/fl2v，认不出来首尾帧就不占槽位 → 静默丢失。
  const m = normalizeImageMode(mode);
  const refs = Array.isArray(stagedRefs) ? stagedRefs : [];
  const frameSlots = {};
  const reserved = [];

  if (m === 'i2va' && stagedFirst) {
    frameSlots['图片1'] = stagedFirst;
    reserved.push(1);
  } else if (m === 'fl2va') {
    if (stagedFirst) { frameSlots['图片1'] = stagedFirst; reserved.push(1); }
    if (stagedLast) { frameSlots['图片2'] = stagedLast; reserved.push(2); }
  }

  /**
   * `images` 必须是**按槽位号定位的稀疏数组**，不能是压缩后的列表。
   *
   * 南风的槽位参数是 `图片1..图片9`，而 `buildShotOverrides` 的写法是
   *   `images.slice(0,9).forEach((rel, i) => { out['图片' + (i+1)] = rel })`
   * —— **数组下标就是槽位号**。
   *
   * 若这里返回压缩数组 `['c1','c2','c3']`（首尾帧占了 1/2 槽），
   * buildShotOverrides 会写成 图片1/2/3，随后 `...frameSlots` 再把 图片1/2
   * 覆盖成首尾帧 —— c1、c2 被静默丢弃，而提示词里写的是 <Picture 3/4/5>。
   *
   * 正确形态：images = [ <空>, <空>, 'c1', 'c2', 'c3' ]。
   * 调用方若只想拿"有效图片列表"，用 `present` 字段。
   */
  const images = new Array(MAX_REF_IMAGES).fill('');
  const present = [];
  const pictureIndexMap = new Map();
  const dropped = [];
  let slot = 1;
  for (let i = 0; i < refs.length; i += 1) {
    if (!refs[i]) continue;                      // 空串 = staging 失败的占位
    while (reserved.includes(slot)) slot += 1;
    if (slot > MAX_REF_IMAGES) { dropped.push({ index: i, name: refs[i] }); continue; }
    pictureIndexMap.set(i, slot);
    images[slot - 1] = refs[i];                  // ← 按槽位号定位，不是 push
    present.push(refs[i]);
    slot += 1;
  }

  return { images, present, frameSlots, reserved, pictureIndexMap, dropped };
}

/**
 * 模式别名归一。
 *
 * 委托给 `store/mode-aliases.js` 的**唯一实现**（该模块无 fs / config 依赖，
 * 所以不会让 ref-images 反向依赖 store 的数据层）。
 *
 * 不要在这里另写一份别名表：编译器与槽位规划一旦用不同的模式判定，
 * fl2va/i2va 下会差 1–2 个槽位号，直接表现为 <Picture N> 指错人。
 */
export function normalizeImageMode(mode) {
  return normalizeMode(mode, { hasRefImages: true });
}

/**
 * 上层需要的三个入口（**必须按序调用**）：
 *
 *   1. `resolveRefImages(shot, cfg)`   → 参考图解析顺序（角色卡 → 人设卡 → 手工 → 场景道具，上限 9）
 *   2. `resolvePrevizArtifacts(shot,cfg)` → 首/尾帧绝对路径
 *   3. `planImageSlots(mode, refs, first, last)` → 定长 9 的槽位数组 + `pictureIndexMap`
 *
 * 这三步的**顺序规则只在这里定义**。不要把它们包成第四层快捷函数：
 * "传绝对路径"与"传 ComfyUI 文件名"两种语义混在一起只会再产生一个会漂移的副本。
 */

/**
 * H3-Image 编辑模式的参考图解析 —— **按序、上限 16、不占槽**。
 *
 * 与 `resolveRefImages` 的关系：**共用同一个 `resolveAssetPath`**（路径解析的
 * 唯一实现），但**排序语义完全不同**，所以不合并成一个函数：
 *
 *   视频 Ref2VA  的 `图片N` 是"素材槽位号"，首尾帧会抢占 1/2 号槽，
 *                且优先级固定为 角色卡 → 人设卡 → 手工 → 场景道具；
 *   图像编辑     的 `image_1` 是"**被编辑的那张原图**"，次序本身就是语义，
 *                所以必须**严格按用户给的顺序**，不做任何重排、不去重合并。
 *
 * ⚠️ 顺序即语义：用户传 [原图, 风格参考, 服装参考] 时，
 *    `image_1` 决定输出画布尺寸（节点 width/height=0 时按它缩放）与编辑目标。
 *    如果这里像视频那样按"角色卡优先"重排，编辑对象会变成角色卡里的立绘。
 *
 * 解析失败的条目**不静默丢弃**：返回 `{ ok: [], bad: [{ input, reason }] }`，
 * 调用方必须把 bad 回给用户（"传了 3 张实际只用上 2 张"是这类功能最隐蔽的失败）。
 *
 * @param {Array<string|{rel?:string, absPath?:string}>} list 用户给的顺序
 * @param {object} [cfg]
 * @param {{max?:number}} [opts] 默认上限 `MAX_IMAGE_EDIT_REFS`
 * @returns {{ok:Array<{abs:string, rel:string, index:number}>, bad:Array<{input:string, reason:string}>, dropped:number}}
 */
export function resolveImageEditRefs(list, cfg = loadConfig(), opts = {}) {
  const max = Number.isFinite(opts.max) && opts.max > 0 ? Math.floor(opts.max) : MAX_IMAGE_EDIT_REFS;
  const ok = [];
  const bad = [];
  let dropped = 0;

  for (const item of (Array.isArray(list) ? list : [])) {
    if (ok.length >= max) { dropped += 1; continue; }
    const raw = typeof item === 'string' ? item : (item?.rel ?? item?.absPath ?? '');
    const label = String(raw ?? '').slice(0, 160) || '（空）';
    if (!raw) { bad.push({ input: label, reason: '空路径' }); continue; }
    let abs = '';
    try {
      abs = resolveAssetPath(item, cfg) || '';
    } catch (e) {
      bad.push({ input: label, reason: String(e?.message ?? e) });
      continue;
    }
    if (!abs) {
      bad.push({
        input: label,
        reason: '解析不到（文件不存在、或路径不在 dataDir 内；绝对路径必须落在数据目录里）',
      });
      continue;
    }
    ok.push({ abs, rel: toDataRel(abs, cfg), index: ok.length + 1 });
  }

  return { ok, bad, dropped, max };
}

/** 绝对路径 → 相对 dataDir 的正斜杠路径（越界返回空串，不抛） */
function toDataRel(abs, cfg) {
  const dataDir = String(cfg?.dataDir || '');
  if (!dataDir) return '';
  try {
    const rel = path.relative(path.resolve(dataDir), path.resolve(abs));
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return '';
    return rel.split(path.sep).join('/');
  } catch { return ''; }
}