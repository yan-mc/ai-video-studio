/**
 * 图像侧提示词 lint —— 只提示，不阻断提交。
 *
 * 与视频侧 lint 的区别：图像侧**允许**写"不要 X"（cfg=1 无负面通道，
 * 官方要求把要避免的也写进正面提示词），所以这里不把否定句当违规。
 * 真正要查的是：段落覆盖、无信息量风格词、中文未翻译、长度、文字声明。
 *
 * @module services/image-prompt/lint
 */
import {
  CJK_RE, IMAGE_PROMPT_MAX_CHARS, REQUIRED_SECTIONS, SECTION_ORDER,
  VAGUE_STYLE_WORDS, TEXT_MENTION_RE,
} from './spec.js';

/**
 * 检测文本里出现的无信息量风格词。
 *
 * ⚠️ 只检查**用户自己写的那部分**，不检查画风预设自带的英文串 ——
 * 预设里出现 `masterpiece` / `cinematic` 是画风作者的选择，
 * 拿它去告警用户属于误报（用户根本没写这些词）。
 *
 * @param {string} text 用户输入部分
 * @returns {string[]}
 */
function vagueHits(text) {
  const lower = String(text ?? '').toLowerCase();
  return VAGUE_STYLE_WORDS.filter((w) => lower.includes(w.toLowerCase()));
}

/**
 * 从自由文本里粗略判断段落覆盖（用于用户直接给整段英文的场景）。
 * 只做关键词启发，认不出就算没覆盖 —— 宁可多提示一句，不要假装检查过。
 */
const SECTION_PROBES = {
  subject: /\b(man|woman|girl|boy|child|person|figure|cat|dog|creature|robot|knight|character|subject)\b/i,
  setting: /\b(in|at|on|inside|outside|among)\b[^.]{0,40}\b(street|room|forest|field|beach|city|house|caf|garden|park|station|sky|desert|ruins|stage|studio)\b/i,
  lighting: /\b(light|lighting|lit|backlit|shadows?|sunlight|moonlight|neon|golden hour|contrast|glow|rim)\b/i,
};

/**
 * 跑一遍 lint。
 *
 * @param {string} prompt 最终提示词
 * @param {object} [ctx]
 * @param {Record<string,string>} [ctx.sections] 若由编译器展开，直接用它判断覆盖
 * @param {string[]} [ctx.untranslated] 未能翻译的中文片段
 * @param {boolean} [ctx.wantsText] 用户是否提到画面文字
 * @param {boolean} [ctx.hasLettering] 是否已生成 lettering 段
 * @param {string} [ctx.styleId]
 * @param {boolean} [ctx.anti3dApplied]
 * @returns {string[]} 中文告警（可能为空数组）
 */
export function lintImagePrompt(prompt, ctx = {}) {
  const text = String(prompt ?? '');
  const warnings = [];
  const sections = ctx.sections ?? null;

  /* ---- 1) 长度 ---- */
  if (text.length > IMAGE_PROMPT_MAX_CHARS) {
    warnings.push(
      `提示词 ${text.length} 字符，超过上限 ${IMAGE_PROMPT_MAX_CHARS}。`
      + '提交会被 400 拒绝（不会静默截断，以免你写的要求被悄悄丢掉）。',
    );
  }

  /* ---- 2) 段落覆盖 ---- */
  const missing = [];
  if (sections) {
    for (const id of REQUIRED_SECTIONS) {
      if (!String(sections[id] ?? '').trim()) missing.push(id);
    }
  } else {
    for (const id of REQUIRED_SECTIONS) {
      const probe = SECTION_PROBES[id];
      if (probe && !probe.test(text)) missing.push(id);
    }
  }
  if (missing.length) {
    const zh = { subject: '主体', setting: '场景', lighting: '光线' };
    warnings.push(
      `缺少${missing.map((m) => zh[m] ?? m).join('、')}的描述。`
      + '官方要求"整幅图的完整描述"：主体在做什么、在哪、光从哪来 —— 缺一项都会让模型自己猜。',
    );
  }

  /* ---- 3) 无信息量风格词（只看用户输入，不看画风预设自带的串） ---- */
  const vague = vagueHits(ctx.userText ?? text);
  if (vague.length) {
    warnings.push(
      `这些词模型无法据此做决定，写了等于没写：${vague.join('、')}。`
      + '换成**可观测的画法**，例如 flat cel shading / two-tone shadows / clean dark linework / 35mm photo。',
    );
  }

  /* ---- 4) 中文未翻译 ---- */
  const untranslated = (ctx.untranslated ?? []).filter(Boolean);
  if (untranslated.length) {
    warnings.push(
      `有中文未能翻译成英文并原样保留：${untranslated.slice(0, 6).join('、')}`
      + `${untranslated.length > 6 ? ` 等 ${untranslated.length} 段` : ''}。`
      + '模型要求英文描述，中文片段遵循度会明显下降 —— 建议改写成英文，或补进词典。',
    );
  } else if (CJK_RE.test(text.replace(/"[^"]*"/g, ''))) {
    // 引号内是画面文字，允许中文；引号外的中文是问题
    warnings.push('提示词里仍有引号外的中文。官方要求英文描述，中文只应出现在「画面文字」的引号内。');
  }

  /* ---- 5) 文字声明 ---- */
  const wantsText = Boolean(ctx.wantsText) || TEXT_MENTION_RE.test(text);
  const hasLettering = Boolean(ctx.hasLettering) || /lettering|the text "|reads "/i.test(text);
  if (wantsText && !hasLettering) {
    warnings.push(
      '提到了画面上的文字，但没有给出具体的文字内容。'
      + '请把要出现的字**逐字写进引号**并说明位置（例：the words "OPEN LATE" on a chalkboard by the door），'
      + '否则模型会自己编一串乱码。',
    );
  }

  /* ---- 6) 风格与反 3D ---- */
  // anti3dApplied === null 表示该画风不需要反 3D（写实类），不算问题
  if (ctx.styleId && ctx.styleId !== 'none' && ctx.anti3dApplied === false) {
    warnings.push(
      `画风 ${ctx.styleId} 属于 2D 类，但没有注入反 3D 约束。`
      + 'H3-Image 的底座在 2D 题材上天然偏 3D，不加约束容易出塑料感与 PBR 混血。',
    );
  }

  /* ---- 7) 结构提示（只给一次，避免刷屏） ---- */
  if (sections) {
    const order = SECTION_ORDER.filter((id) => String(sections[id] ?? '').trim());
    const expected = SECTION_ORDER.filter((id) => order.includes(id));
    if (order.join('>') !== expected.join('>')) {
      warnings.push('段落顺序与官方推荐不一致（用途→布局→主体→动作→场景→光线→相机→质感→文字）。');
    }
  }

  return warnings;
}

/**
 * 判断一段文本是否"已经是完整的英文长描述"。
 * 是的话编译器只做 lint 与反 3D 注入，**不重写** —— 避免覆盖用户已经定好的细节。
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeFullDescription(text) {
  const s = String(text ?? '').trim();
  if (!s) return false;
  // 引号内的画面文字不算中文内容
  const outsideQuotes = s.replace(/"[^"]*"/g, ' ');
  const cjk = (outsideQuotes.match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (cjk > Math.max(2, outsideQuotes.length * 0.02)) return false;
  const words = outsideQuotes.split(/\s+/).filter(Boolean);
  return words.length >= 40;
}
