/**
 * 画风锚（style anchor）的提示词生成 —— "把参考图当画风参考"这一通道的语言层。
 *
 * ============================================================================
 * 为什么这件事值得单独一个模块
 * ============================================================================
 *
 * 调研结论：H3-Image 只有三条画风通道 —— 提示词画法词（弱）、**参考图（最强且零成本）**、
 * LoRA（强但重）。其中"参考图"这条最容易翻车：
 *
 *   用户传一张想要的画风的图，然后写"画成这张图的风格"。
 *   模型的反应通常是**把这张图里的人/物/构图一起搬过来** ——
 *   因为参考图在接 VAE 时是被锚定为 reference latent 的像素级约束。
 *
 * 所以提示词必须显式做三件事：
 *   ① 指明借的是「画法 / 质地」，不是内容；
 *   ② **显式排除**主体、构图、镜头角度的迁移；
 *   ③ 把"要画什么"重新完整说一遍（模型不会自动区分）。
 *
 * ============================================================================
 * 接 VAE / 不接 VAE 的区别（决定措辞）
 * ============================================================================
 *
 * 官方节点文档原话：
 *   "With it the pictures are also anchored as reference latents,
 *    without it they only condition the text encoder."
 *
 *   · 接 VAE   → 像素级强约束。必须更明确地写"目标场景是什么"，否则参考图会渗进来。
 *   · 不接 VAE → 只经文本编码器，是"松散"的风格信号。构图靠文字决定。
 *
 * 本项目统一接 VAE，所以默认按强约束措辞。
 *
 * @module services/image-prompt/style-anchor
 */
import { ANCHOR_MODES, ANCHOR_STRENGTHS } from './spec.js';

/** 强度 → 措辞力度 */
const STRENGTH_WORDING = {
  light: 'Loosely',
  medium: 'Consistently',
  strong: 'Closely',
};

/** 取模式的显示名（未知模式回落 style-only） */
function modeOf(id) {
  return ANCHOR_MODES.find((m) => m.id === id) ?? ANCHOR_MODES[0];
}

/** 取强度的显示名 */
function strengthOf(id) {
  return ANCHOR_STRENGTHS.find((s) => s.id === id) ?? ANCHOR_STRENGTHS[1];
}

/**
 * 生成"画风锚"提示词片段。
 *
 * @param {object} o
 * @param {number} o.anchorIndex 该参考图在 `<Picture N>` 里的编号（1-based）
 * @param {'style-only'|'style+palette'} [o.mode]
 * @param {'light'|'medium'|'strong'} [o.strength]
 * @param {boolean} [o.vae] 该参考图是否接了 VAE（像素级锚定）。默认 true。
 * @returns {string} 英文片段；编号非法时返回空串
 */
export function styleAnchorClause({ anchorIndex, mode, strength, vae = true } = {}) {
  const n = Number(anchorIndex);
  if (!Number.isInteger(n) || n < 1) return '';

  const m = modeOf(mode);
  const s = strengthOf(strength);
  const adv = STRENGTH_WORDING[s.id] ?? STRENGTH_WORDING.medium;
  const ref = `<Picture ${n}>`;

  const lines = [];

  // ① 定性：这是风格样张，不是内容参考
  lines.push(
    `Style reference: ${ref} is a style exemplar only — it shows how this picture should be drawn, not what it should contain.`,
  );

  // ② 借什么（按模式分岔）
  if (m.id === 'style+palette') {
    lines.push(
      `${adv} borrow ${ref}'s painting method and surface quality: its linework, the way colour is blocked in, `
      + 'its shading language and canvas finish — and also its colour palette, meaning the actual hues, '
      + 'their saturation and the warm/cool balance between them.',
    );
  } else {
    lines.push(
      `${adv} borrow ${ref}'s painting method and surface quality only: its linework, `
      + 'the way colour is blocked in, its shading language and canvas finish. '
      + 'Do not copy its colour scheme; choose colours from the description below.',
    );
  }

  // ③ 显式排除内容迁移 —— 这是最容易失败的一条
  lines.push(
    `Do not copy the content of ${ref}: its people, objects, scene, layout, framing, camera angle and `
    + 'background stay out of this image entirely. The subject, pose and composition here are defined by the text below.',
  );

  // ④ 按 VAE 与否补一句行为差异
  if (vae) {
    lines.push(
      `${ref} is supplied as a pixel-level reference, so it constrains appearance strongly. `
      + 'Describe every part of the target scene explicitly so that nothing from the reference leaks in by inertia.',
    );
  } else {
    lines.push(
      `${ref} reaches the model through the text encoder only, so it influences the look rather than the pixels; `
      + 'the wording below carries the composition.',
    );
  }

  return lines.join(' ');
}

/**
 * 给前端/文档用的中文说明。
 *
 * 写成结构化对象而不是一段长文：前端要分块渲染（要点 / 两种模式 / 提示词示范）。
 *
 * @returns {{summary:string, why:string, modes:Array<{id:string,name:string,desc:string}>,
 *            strengths:Array<{id:string,name:string,desc:string}>,
 *            promptExample:string, pitfalls:string[]}}
 */
export function styleAnchorAdvice() {
  return {
    summary: '传一张「已经是目标画风」的图，比写一百个风格词都管用。这是最强且零成本的一条画风通道。',
    why: 'H3-Image 只有三条画风通道：提示词画法词（弱）、参考图（最强）、LoRA（强但重）。'
      + '参考图接 VAE 时会被锚定为 reference latent，是像素级约束 —— 所以它效果最好，也最容易把内容一起带过来。',
    modes: ANCHOR_MODES.map((m) => ({ id: m.id, name: m.name, desc: m.desc })),
    strengths: ANCHOR_STRENGTHS.map((s) => ({ id: s.id, name: s.name, desc: s.desc })),
    promptExample:
      'a young woman reading by a window, soft afternoon light, 35mm photo, '
      + 'matching the rendering style of <Picture 2> but with a different subject and composition',
    pitfalls: [
      '只写「画成这张图的风格」→ 模型会把参考图里的人/物一起搬过来。',
      '写「same as the reference」→ 构图、镜头角度也会被复制。',
      '传多张不同风格的图 → 互相拉扯，产出既不 A 也不 B 的混合体。要换风格就换图，不要叠。',
      '参考图里出现文字时，文字也可能被带进来。不想出现文字就显式写 no text。',
    ],
  };
}

/**
 * 从整段提示词里找出已被引用的 `<Picture N>` 编号。
 * 用于 lint：画风锚编号没被提示词提及时给出提示。
 *
 * @param {string} text
 * @returns {number[]}
 */
export function referencedPictures(text) {
  const out = new Set();
  const re = /<Picture\s+(\d+)>/gi;
  let m = re.exec(String(text ?? ''));
  while (m) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 1) out.add(n);
    m = re.exec(String(text ?? ''));
  }
  return [...out].sort((a, b) => a - b);
}
