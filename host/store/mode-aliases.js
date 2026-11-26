/**
 * H3 模式名归一 —— **全仓唯一实现**（无任何 IO 依赖）。
 *
 * 单独成一个文件是为了让 `store/models.js` 与 `services/ref-images.js`
 * 都能安全 import，而不会互相依赖。**任何地方都不要另写一份别名表。**
 *
 * 两份实现并存时会出现：同一个镜头卡 `mode:'h3:T2V'`，提示词编译器判成
 * 文生视频、槽位规划判成全参考，在 fl2va/i2va 下差 1–2 个槽位号 ——
 * 表现为 <Picture N> 指错人。
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