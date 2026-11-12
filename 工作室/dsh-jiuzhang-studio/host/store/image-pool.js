/**
 * 图片引用池 —— 洛书 1.0.59 的实测机制。
 *
 * 问题：画布节点里的图片是 base64 data URL，直接存进 projects.json 会让
 * 一个含 30 张参考图的项���从几 MB 膨胀到几百 MB。
 *
 * 洛书做法（bundle @465158）：存盘时把 base64 换成 `__img_ref__:<index>`，
 * 图片本体收集到顶层 `imagePool[]`；读盘时反向还原。相同图片复用同一索引。
 *
 * 本实现按此语义重写，不复制其代码。
 */

/** 引用前缀 —— 与洛书的字面量保持一致，便于将来数据互通 */
export const IMG_REF_PREFIX = '__img_ref__:';

/** base64 字符集（不含 data: 前缀部分） */
const BASE64_CHARS = /^[A-Za-z0-9+/]+={0,2}$/;
const DATA_URL_PREFIX = /^data:image\/[a-z0-9.+-]+;base64,/i;

/**
 * 判断一个字符串是否"看起来像内联图片"。
 * 宁松勿严：漏判会让文件膨胀，误判最多多存一个池条目。
 */
export function looksLikeBase64Image(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith(IMG_REF_PREFIX)) return false; // 已是引用
  if (DATA_URL_PREFIX.test(value)) return true;
  // 纯 base64 且足够长（短字符串不值得入池，也避免误判 id/哈希）
  if (value.length > 2000 && BASE64_CHARS.test(value)) return true;
  return false;
}

/**
 * 把图结构里的内联图片打包成引用。
 * @param {any} root            任意可 JSON 化的结构（nodes / edges / history / …）
 * @param {string[]} existingPool  已有的池（增量保存时传进来复用索引）
 * @returns {{ graph: any, pool: string[] }}
 */
export function packGraph(root, existingPool = []) {
  const pool = Array.isArray(existingPool) ? existingPool.slice() : [];
  // 反向索引：图片内容 → 池下标（首次出现的位置）
  const index = new Map();
  for (let i = 0; i < pool.length; i++) {
    const v = pool[i];
    if (typeof v === 'string' && !index.has(v)) index.set(v, i);
  }

  const walk = (node) => {
    if (typeof node === 'string') {
      if (!looksLikeBase64Image(node)) return node;
      const hit = index.get(node);
      if (typeof hit === 'number') return `${IMG_REF_PREFIX}${hit}`;
      const at = pool.length;
      pool.push(node);
      index.set(node, at);
      return `${IMG_REF_PREFIX}${at}`;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  };

  return { graph: walk(root), pool };
}

/**
 * 把引用还原成图片本体。
 * @param {any} root  已打包的结构
 * @param {string[]} pool
 */
export function unpackGraph(root, pool = []) {
  const list = Array.isArray(pool) ? pool : [];

  const walk = (node) => {
    if (typeof node === 'string') {
      if (!node.startsWith(IMG_REF_PREFIX)) return node;
      const idx = Number.parseInt(node.slice(IMG_REF_PREFIX.length), 10);
      if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) return node;
      return list[idx];
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  };

  return walk(root);
}

/**
 * 统计一个结构里内联图片的总字节数（用于诊断/守卫）。
 */
export function measureInlineImages(root) {
  let bytes = 0;
  let count = 0;
  const walk = (node) => {
    if (typeof node === 'string') {
      if (looksLikeBase64Image(node)) { bytes += node.length; count += 1; }
      return;
    }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(root);
  return { bytes, count };
}