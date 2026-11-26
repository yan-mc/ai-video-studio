/**
 * 反 3D 化约束 —— 让 2D 画风不被底座拉成 3D 混血。
 *
 * ============================================================================
 * 为什么需要这个模块
 * ============================================================================
 *
 * H3-Image 的底座在 2D 题材上**天然偏 3D**（社区实测口径一致，Civitai 上
 * 2D↔Realism 滑块 LoRA 的作者原话："base H3 的 2D 动漫偏向 3D、不够平"）。
 * 只写 "anime style" 会得到塑料感、体积雾、PBR 材质混合体 ——
 * 画风词写了却不像，是"提示词没生效"里最难自查的一类。
 *
 * 所以 2D 画风必须**显式**反着写：平涂、硬边阴影、无体积光、无 PBR。
 * 图像侧可以这么写，因为 H3-Image 没有负面提示词通道，
 * 官方明确要求"把要避免的也写进正面提示词"。
 *
 * ============================================================================
 * 判定规则（为什么不是简单的 changesAppearance === false）
 * ============================================================================
 *
 * 任务书给的初判是「changesAppearance === false 或 category 属于 2D 类」，
 * 但直接套用会把 `toon3d-pbr`（3D 半写实）、`ufotable`（3D 背景 + 2D 角色）
 * 也加上反 3D 约束 —— 那是在跟画风本身打架（两个画风都明确要 3D 打底）。
 *
 * 所以这里加一道 **3D 优先级**：
 *   ① category / en 里明确要 3D、PBR、写实的 → 判定为 3d，**永不注入**；
 *   ② 否则 category 含 2D、或 en 里是 anime / cel / line art → 2d，注入；
 *   ③ 都没有线索 → 看 changesAppearance：false 视为 2d（它表示"不改角色外观"，
 *      配套的都是风格化画法），true 视为 unknown，不注入。
 *
 * 这样 11 种画风里 9 种 2D 类会注入，2 种 3D 类不会 —— 与"2D 类应加、写实类不应加"
 * 的验收要求一致。
 *
 * @module services/image-prompt/anti3d
 */
import { STYLE_PRESETS } from '../../bridge/prompt/styles.js';

/** 明确的 3D / 写实线索：命中即永不注入 */
const CLUE_3D = /3D|PBR|photoreal|photo-real|subsurface scattering|global illumination/i;
/** 明确要求"不要 3D"的否定语境（含 3D 字样但语义相反） */
const NEGATED_3D = /\b(?:NOT|NO|no|not|without|avoid)\s+(?:3D|realistic|photoreal|PBR|CGI)/g;
/** 明确的 2D 线索 */
const CLUE_2D = /2D|anime|cel[- ]?shad|cartoon|line art|flat colou?r|manga|ink line/i;
/** 幂等标记：只要完整的基础约束句已在文本里，就不再重复追加 */

/**
 * 把"不要 3D"这类否定表述从文本里挖掉，再做 3D 判定。
 *
 * 为什么必须先挖：绝大多数 2D 画风的 en 里都带
 * `NOT 3D` / `NO 3D proportions` / `NOT realistic` —— 直接 grep `3D`
 * 会把 9 个 2D 画风全判成 3D，正好判反。
 */
function stripNegated3d(text) {
  return String(text ?? '').replace(NEGATED_3D, ' ');
}

/**
 * 基础约束句。措辞刻意用"可见的画法"而不是形容词 ——
 * 模型对 `no 3D render` 这种可判定的禁令响应，远好于 `less 3D`。
 */
const BASE_CLAUSE = 'Flat 2D illustration only: no 3D render, no CGI, no PBR materials, '
  + 'no ray-traced global illumination, no plastic shading.';

/** 按画风类别追加的细化约束（都是 2D 侧常见翻车点） */
const EXTRA_BY_CATEGORY = [
  { re: /平涂|扁平|卡通/, clause: 'Use flat colour fills with hard-edged shadow blocks instead of smooth volumetric shading, and no soft ambient occlusion.' },
  { re: /线条|线稿/, clause: 'Keep the linework even and deliberate; do not let the lines dissolve into rendered gradients.' },
  { re: /手绘|柔光/, clause: 'Keep the surface painterly and matte; no specular gloss, no lens flare bloom from a 3D renderer.' },
  { re: /半写实|厚涂/, clause: 'Keep brushwork visible and the shading directional; do not replace it with physically based material response.' },
];

/** 风格化画法的通用补充（阴影语言） */
const SHADING_CLAUSE = 'Shade with a fixed number of discrete tone steps rather than continuous physically based falloff.';

/**
 * 判定一个画风的维度。
 * @param {object} style  styles.js 里的一条 STYLE_PRESETS
 * @returns {'2d'|'3d'|'unknown'}
 */
export function styleDimensionality(style) {
  if (!style) return 'unknown';
  const cat = String(style.category ?? '');
  const enRaw = String(style.en ?? '');
  // 先挖掉"不要 3D"这类否定表述，否则 2D 画风会被自己的禁令判成 3D
  const catPos = stripNegated3d(cat);
  const enPos = stripNegated3d(enRaw);

  // ① 明确要 3D / 写实 → 3d（优先级最高：宁可少注入，不可与画风打架）
  if (CLUE_3D.test(catPos) || CLUE_3D.test(enPos)) return '3d';

  // ② 明确的 2D 线索
  if (/2D/.test(catPos) || CLUE_2D.test(enPos) || CLUE_2D.test(catPos)) return '2d';

  // ③ 无线索时看 changesAppearance
  return style.changesAppearance === false ? '2d' : 'unknown';
}

/** 按 id 找画风 */
function findStyle(styleId) {
  const id = String(styleId ?? '');
  if (!id) return null;
  return STYLE_PRESETS.find((s) => s.id === id) ?? null;
}

/** 「不需要注入」的判定（给 meta / 前端用） */
function shouldInject(style) {
  return styleDimensionality(style) === '2d';
}

/**
 * 生成某个画风的反 3D 约束串。
 * @param {string} styleId
 * @returns {string} 非 2D 画风返回空串
 */
export function anti3dClause(styleId) {
  const style = findStyle(styleId);
  if (!style || !shouldInject(style)) return '';

  const parts = [BASE_CLAUSE];
  const cat = String(style.category ?? '');
  for (const g of EXTRA_BY_CATEGORY) {
    if (g.re.test(cat)) parts.push(g.clause);
  }
  parts.push(SHADING_CLAUSE);
  return parts.join(' ');
}

/**
 * 幂等地把反 3D 约束追加到文本末尾。
 *
 * 幂等靠两个标记判断：画风文本自己已经声明过（ALREADY_ANTI3D），
 * 或我们这句已经在了（BASE_CLAUSE 的前缀）。重复调用不会越长越离谱。
 *
 * @param {string} text
 * @param {string} styleId
 * @param {{satisfied?: {value: boolean}}} [out] 回填"约束是否已具备"（含画风自带）
 * @returns {string}
 */
export function applyAnti3d(text, styleId, out) {
  const src = String(text ?? '');
  const clause = anti3dClause(styleId);
  if (!clause) {
    // 非 2D 画风：本就不需要反 3D 约束。标记为 notApplicable，
    // 不能记为 satisfied —— 否则"写实画风"会显示成"已加反 3D"，语义相反。
    if (out) out.satisfied = null;
    return src;
  }
  // 画风自带反 3D 声明，或我们的整句已经在里面 —— 都算"约束已具备"
  //
  // ⚠️ 用**整句**匹配而不是 `no 3D render` 这种片段：片段会误命中
  // 画风锚段落里的 "no 3D render"（那是描述参考图，不是本图的约束），
  // 导致明明没注入却报"已具备"，用户以为加了其实没加。
  const satisfied = src.includes(BASE_CLAUSE);
  if (out) out.satisfied = satisfied;
  if (satisfied) return src;
  if (!src.trim()) return clause;
  // 前面已有句子时补一个空格；末尾标点保留在句子中间不影响理解
  return `${src.trimEnd()} ${clause}`;
}

/**
 * 全部画风的维度表 —— 供 `/image/meta` 与前端展示"这个画风会自动补反 3D 约束"。
 * @returns {Array<{id:string, name:string, category:string, dimensionality:string, anti3d:boolean}>}
 */
export function anti3dCatalog() {
  return STYLE_PRESETS.map((s) => {
    const dim = styleDimensionality(s);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      dimensionality: dim,
      anti3d: dim === '2d',
    };
  });
}
