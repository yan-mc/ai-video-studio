/**
 * 图像侧提示词编译器 —— 门面。
 *
 * ============================================================================
 * 它解决的问题
 * ============================================================================
 *
 * H3-Image 官方两个模板在采样器前都有一个 prompt expander（PE，Qwen3.8-27B），
 * 默认开启，把一句简短需求改写成详细英文描述。**我们的工作流里没有这一步**。
 *
 * 没有 PE 意味着：用户写一句"画画一个在海边的女孩"，模型只能照字面理解，
 * 缺场景细节、缺光线、缺质感 —— 出图平庸。官方模板之所以随便一句就能出好图，
 * 一半功劳在 PE 上。
 *
 * 这个模块就是补上这一环，用**规则 + 词典 + 模板**（不调外部模型）：
 *   · 中文 → 完整英文描述（按官方八段顺序）
 *   · 自动补画风约束（含 2D 反 3D 化）
 *   · 自动补画风锚的提示词片段
 *   · lint 提示缺什么
 *
 * ============================================================================
 * 两种输入路径
 * ============================================================================
 *
 *   ① 用户写的是短需求 / 中文 → 走 expand 展开
 *   ② 用户写的是**已完整的英文长描述** → 只做 lint + 反 3D 注入，**不重写**
 *      （重写只会覆盖他已经定好的细节，官方实测 PE 也会犯这个错）
 *
 * @module services/image-prompt
 */
import { expandToSections } from './expand.js';
import { lintImagePrompt, looksLikeFullDescription } from './lint.js';
import { anti3dClause, applyAnti3d, anti3dCatalog } from './anti3d.js';
import { styleAnchorClause, styleAnchorAdvice, referencedPictures } from './style-anchor.js';
import {
  IMAGE_PROMPT_MAX_CHARS, SECTION_ORDER, SECTIONS, ANCHOR_MODES, ANCHOR_STRENGTHS,
  NO_TEXT_SENTENCE, noTextSentence, STYLE_NONE, TEXT_MENTION_RE,
} from './spec.js';
import { STYLE_PRESETS } from '../../bridge/prompt/styles.js';

/**
 * 清洗最终文本：去 Markdown 记号、压空白。
 * 与 `h3-image.js` 的 `normalizeImagePrompt` 同规则，但**不做长度断言**
 * （长度由 lint 报，最终拒绝在路由层，避免同一件事三处判断）。
 */
function sanitize(text) {
  return String(text ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** 取画风预设（含 none） */
function resolveStyle(styleId) {
  const id = String(styleId ?? STYLE_NONE);
  if (!id || id === STYLE_NONE) return null;
  return STYLE_PRESETS.find((s) => s.id === id) ?? null;
}

/** 段落拼成最终文本（按官方顺序） */
function joinSections(sections) {
  return SECTION_ORDER
    .map((id) => String(sections[id] ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 编译一次图像提示词。
 *
 * @param {object} input
 * @param {string} [input.text]        短需求 / 中文原文（会展开）
 * @param {string} [input.rawPrompt]   用户直接写的完整提示词（完整英文时不重写）
 * @param {string} [input.styleId]     画风 id（STYLE_PRESETS 的 id 或 'none'）
 * @param {object} [input.styleAnchor] `{ index, mode, strength }` 画风锚
 * @param {string} [input.aspect]      '3:4' / '16:9' …
 * @param {string|string[]} [input.lettering] 画面文字（逐字进引号）
 * @param {string[]} [input.negativeHints] 要避免的东西（图像侧合法，会并进正面提示词）
 * @param {boolean} [input.noText]     显式声明画面无文字
 * @param {object} [opts]
 * @returns {{
 *   prompt: string,
 *   warnings: string[],
 *   sections: Record<string,string>,
 *   styleId: string,
 *   usedAnchor: boolean,
 *   usedRaw: boolean,
 *   untranslated: string[],
 *   chars: number,
 *   anti3dApplied: boolean,
 * }}
 */
export function compileImagePrompt(input = {}, opts = {}) {
  const styleId = String(input.styleId ?? STYLE_NONE);
  const style = resolveStyle(styleId);
  const rawPrompt = String(input.rawPrompt ?? '').trim();
  const shortText = String(input.text ?? '').trim();

  const warnings = [];
  const usedRaw = Boolean(rawPrompt) && looksLikeFullDescription(rawPrompt);

  let sections = {};
  let untranslated = [];
  let baseText = '';

  if (usedRaw) {
    /* ---- 路径 ②：已完整的英文描述，不重写 ---- */
    baseText = rawPrompt;
  } else {
    /* ---- 路径 ①：展开 ---- */
    const source = [shortText, rawPrompt].filter(Boolean).join('，');
    const expanded = expandToSections(source, {
      aspect: input.aspect,
      lettering: input.lettering,
    });
    sections = expanded.sections;
    untranslated = expanded.untranslated;

    // 画风预设的英文串放进「质感」段（它本来就是画法描述）
    if (style) {
      sections.texture = [sections.texture, style.en].filter(Boolean).join(' ');
    }

    // 声明的负面要求并进正面提示词（图像侧允许这么写）
    const hints = (Array.isArray(input.negativeHints) ? input.negativeHints : [])
      .map((h) => String(h ?? '').trim())
      .filter(Boolean);
    if (hints.length) {
      const sentence = `Avoid the following in the image: ${hints.join('; ')}.`;
      sections.texture = [sections.texture, sentence].filter(Boolean).join(' ');
    }

    // 文字段：用户给了字就精确声明，没给就显式声明"无文字"
    //
    // ⚠️ 两者必须**二选一**，不能同时出现。曾经两者并存的后果：提示词里
    // 一边写"周围招牌的霓虹"、一边写"画面无任何文字"，模型照字面画出
    // 一块带乱码的招牌 —— 自相矛盾的指令比缺指令更糟。
    const wantsText = Boolean(input.lettering) || Boolean(sections.lettering);
    if (!wantsText && input.noText !== false) {
      // 画面里有霓虹 / 招牌 / 海报这类"天然带字"的元素时，用强化版声明：
      // 单写一句 contains no text 压不住（实测会画出假名乱码）。
      const textProne = /neon|sign|poster|banner|board|screen|label|newspaper|book cover|霓虹|招牌|海报|黑板|标签|屏幕|报纸/i
        .test(`${shortText} ${rawPrompt} ${joinSections(sections)}`);
      sections.lettering = noTextSentence(textProne);
    }

    // 用户提到了文字但没给具体内容 → 不让它落到"无文字"分支，交给 lint 提醒补全
    if (!wantsText && TEXT_MENTION_RE.test(`${shortText} ${rawPrompt}`)) {
      sections.lettering = '';
    }

    baseText = joinSections(sections);
  }

  /* ---- 画风锚 ---- */
  let usedAnchor = false;
  if (input.styleAnchor && Number.isFinite(Number(input.styleAnchor.index))) {
    const clause = styleAnchorClause({
      anchorIndex: Number(input.styleAnchor.index),
      mode: input.styleAnchor.mode,
      strength: input.styleAnchor.strength,
      // 本项目统一接 VAE，按像素级强约束措辞
      vae: input.styleAnchor.vae !== false,
    });
    if (clause) {
      // 锚说明放在最前：模型对开头的约束响应最强
      baseText = `${clause} ${baseText}`.trim();
      usedAnchor = true;
    }
  }

  /* ---- 反 3D（2D 画风） ---- */
  //
  // `satisfied` 回填"约束是否已具备"——它包含**画风预设自带**的反 3D 声明
  // （例如 ghibli 的 en 里已经有 "NOT 3D"）。只看"我们有没有追加"会误报
  // 「2D 画风但没注入反 3D」，而那其实已经满足了。
  const anti3dState = { satisfied: false };
  const withAnti3d = applyAnti3d(baseText, styleId, anti3dState);
  // applyAnti3d 的 satisfied 表示"追加前就已具备"；追加之后一定具备（或本就不需要）
  const anti3dSatisfied = anti3dState.satisfied === null
    ? null                                   // 写实类画风：不需要，也不算问题
    : Boolean(anti3dState.satisfied) || withAnti3d !== baseText;

  const prompt = sanitize(withAnti3d);

  /* ---- lint ---- */
  const finalSections = usedRaw
    ? { ...sections, raw: prompt }
    : { ...sections, texture: sections.texture ?? '' };
  const lintCtx = {
    /** 只把用户自己写的部分交给"无信息量风格词"检查：画风预设自带的词不算用户写的 */
    userText: `${shortText} ${rawPrompt}`.trim(),
    sections: usedRaw ? null : finalSections,
    untranslated,
    wantsText: Boolean(input.lettering) || Boolean(sections.lettering && sections.lettering !== NO_TEXT_SENTENCE),
    hasLettering: Boolean(sections.lettering),
    styleId,
    anti3dApplied: anti3dSatisfied,
  };
  warnings.push(...lintImagePrompt(prompt, lintCtx));

  // 画风锚编号没被引用时提醒（模型不知道要借哪张）
  if (usedAnchor) {
    const refs = referencedPictures(prompt);
    const idx = Number(input.styleAnchor.index);
    if (!refs.includes(idx)) {
      warnings.push(`画风锚编号 <Picture ${idx}> 未在提示词中出现，模型可能不知道该借哪张。`);
    }
  }

  return {
    prompt,
    warnings,
    sections: usedRaw ? { raw: prompt } : sections,
    styleId,
    usedAnchor,
    usedRaw,
    untranslated,
    chars: prompt.length,
    anti3dApplied: anti3dSatisfied,
  };
}

/**
 * 供 `/image/meta` 用的元信息。
 * @returns {object}
 */
export function imagePromptMeta() {
  const styles = STYLE_PRESETS.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    changesAppearance: s.changesAppearance,
  }));

  return {
    maxChars: IMAGE_PROMPT_MAX_CHARS,
    sections: SECTIONS,
    sectionOrder: SECTION_ORDER,
    styles: [{ id: STYLE_NONE, name: '不指定画风', category: '—' }, ...styles],
    anti3d: anti3dCatalog(),
    anchor: {
      modes: ANCHOR_MODES,
      strengths: ANCHOR_STRENGTHS,
      advice: styleAnchorAdvice(),
      maxAnchors: 2,
    },
    /** 中文能否直接提交：能，但会先被编译成英文描述 */
    acceptsChinese: true,
    note: '本地没有 prompt expander（官方模板有），所以中文/短需求由本编译器展开成完整英文描述。'
      + '已是完整英文长描述时不会重写，只做 lint 与画风约束注入。',
  };
}

export { STYLE_PRESETS };
