/**
 * H3 模式名归一 —— **全仓唯一实现**（无任何 IO 依赖）。
 *
 * 为什么必须单独一个文件：
 *   历史上「模式别名」有两份互不相干的实现：
 *     · `store/models.js`  `normalizeMode()`        —— 会剥 `h3:` 前缀
 *     · `services/ref-images.js` `normalizeImageMode()` —— 不剥前缀、少两个别名
 *   同一个镜头卡 `mode:'h3:T2V'`，提示词编译器判成文生视频，而槽位规划判成全参考，
 *   在 fl2va/i2va 下差 1–2 个槽位号 —— 正是"串脸"事故的成因。
 *
 *   两份实现的分离理由是"避免 ref-images 反向依赖 store"，那个理由成立；
 *   但它推出的结论错了：正确做法是把纯函数提取到**双方都能依赖**的模块，
 *   而不是各自再写一份。本文件没有 fs / config 依赖，两边都可以安全 import。
 *
 * @module store/mode-aliases
 */

/** 短名 → 规范长名。键区分大小写，见下方 normalizeMode 的三段回退。 */
export const H3_MODE_ALIASES = Object.freeze({
  t2v: 't2va', T2V: 't2va',
  i2v: 'i2va', I2V: 'i2va',
  fl2v: 'fl2va', FL2V: 'fl2va', flf: 'fl2va',
  l2v: 'l2va', L2V: 'l2va',
  ref: 'ref2va', ref2v: 'ref2va', ref2va: 'ref2va', REF: 'ref2va',
  t2va: 't2va', i2va: 'i2va', fl2va: 'fl2va', l2va: 'l2va',
});

/** H3 编译器认的规范模式名 */
export const H3_MODES = Object.freeze(['t2va', 'i2va', 'fl2va', 'l2va', 'ref2va']);

/**
 * 把任意写法归一成规范模式名。
 *
 * 支持带前缀的档位写法（`h3:T2V` → `t2va`）。
 *
 * @param {unknown} mode
 * @param {{hasRefImages?: boolean, fallback?: string}} [opts]
 * @returns {string}
 */
export function normalizeMode(mode, opts = {}) {
  const raw = String(mode ?? '').trim();
  const bare = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
  const hit = H3_MODE_ALIASES[bare]
    ?? H3_MODE_ALIASES[bare.toUpperCase()]
    ?? H3_MODE_ALIASES[bare.toLowerCase()];
  if (hit) return hit;
  // 未识别：有参考图走全参考，无图走文生（与画布 runner 的兜底一致）
  if (opts.fallback) return opts.fallback;
  return opts.hasRefImages ? 'ref2va' : 't2va';
}