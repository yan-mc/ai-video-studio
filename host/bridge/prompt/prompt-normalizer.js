/**
 * 提示词规范化 —— 把用户手写的自由文本整理成换人规范的四段式。
 *
 * 换人流程要求固定结构（总结 / 身份绑定 / 时间轴 / 防漂移），但使用者常常
 * 手写一段中英混排的自由文本 —— 一个字段都没有，中文占三成。模型拿到散句，
 * 不知道哪句是身份定义、哪句是约束。
 *
 * 三层降级：
 *   ① 规则引擎（本文件）—— 纯字符串，永远成功，<10ms
 *   ② 本地翻译模型（**由调用方注入**）—— 补翻译，离线、无拒答
 *   ③ 原文兜底 —— 前两步都失败时原样返回，绝不丢用户内容
 *
 * 关键设计：**规则引擎先跑，模型只做翻译**。让模型自由重写是不可控的 ——
 * 它可能"优化"掉 LoRA 触发词，那是模型训练时绑定的描述句，改一个字效果就废了。
 *
 * ⚠️ 本模块**不 import host/services/**：翻译能力由调用方通过 `opts.translate`
 *    注入（api 层传 services/prompt-llm 的 translateBatch）。bridge 不得反向
 *    依赖业务层，否则无法单独复用/测试，且未来会形成循环。
 *
 * @module prompt-normalizer
 */

/** LoRA 触发词识别：完整英文长句 + 出现在最开头 + 不含占位符 */
const TRIGGER_HINT = /^(video depicts|a video of|this video|the video shows)\b/i;

/**
 * 占位符与指令特征词。
 *
 * 用它们判断一行属于四段式的哪一段。宁可归错到"分镜"，也不要丢内容 ——
 * 丢一句约束比多一句描述严重得多。
 */
const RE_SUMMARY = /替换成|替换为|换成|复刻.*动作|replace .* with/i;
const RE_SUBJECT = /<Subject\s*\d+>|<Picture\s*\d+>/i;
const RE_VIDEO = /<Video\s*\d+>/i;
const RE_GUARD = /全程保持|完全一致|不添加新角色|keep .*consistent|same identity/i;
const RE_SHOT = /^\[Shot\s*\d+\]/i;
const RE_NOTE = /注意|强调|精细|保持|务必|确保|emphasi[sz]e|make sure|ensure/i;

/**
 * 六段式（Ref2VA）官方字段名。
 *
 * 换人提示词与六段式是**互斥**的两套规范（skill 明令不得混用）。
 * 一旦换人提示词里出现这些字段名，产出的既非四段也非六段 ——
 * 而换人链会把它原样当 `ref2va` 的 `提示词` 提交，`job.prompt` 非空会
 * 短路编译，lint / 字段完整性 / 语言检查全部跳过。所以必须在入口拦下。
 */
export const SIX_FIELD_NAMES = Object.freeze([
  'subject_definitions',
  'summary',
  'retention_analysis',
  'detailed_description',
  'overall_soundscape',
  'non_diegetic_music',
  'integrated_multimodal_description',
]);

const SIX_FIELD_RE = new RegExp(
  `(?:^|[\\n\\r])\\s*(?:${SIX_FIELD_NAMES.join('|')})\\s*[:：]`,
  'im',
);

/** 是否含中文（用于判断要不要走翻译） */
export function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text ?? ''));
}

/**
 * 检测换人提示词里是否混入了六段式字段。
 *
 * @param {string} raw
 * @returns {{ mixed: boolean, field: string|null }}
 */
export function detectSixFieldMixed(raw) {
  const m = SIX_FIELD_RE.exec(String(raw ?? ''));
  if (!m) return { mixed: false, field: null };
  const field = SIX_FIELD_NAMES.find((f) => new RegExp(`(?:^|[\\n\\r])\\s*${f}\\s*[:：]`, 'i').test(m[0]));
  return { mixed: true, field: field ?? null };
}

/**
 * 把用户自由文本拆成四段式的各个槽位。
 *
 * @param {string} raw 用户原始输入
 * @returns {{
 *   trigger: string[], summary: string[], subjects: string[], video: string[],
 *   shots: string[], guards: string[], stray: string[], needsTranslate: boolean,
 * }}
 * @throws {Error} REPLACE_PROMPT_MIXED —— 检测到六段式字段
 */
export function splitReplacePrompt(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');

  // 互斥守卫：发现即报错，不静默产出混合体
  const mixed = detectSixFieldMixed(text);
  if (mixed.mixed) {
    const err = new Error(
      `REPLACE_PROMPT_MIXED: 换人提示词不得包含六段式字段「${mixed.field ?? '未知'}」—— `
      + '换人规范（四段式）与 H3 官方六段式是两套互斥写法，混用会产出既非四段也非六段的畸形提示词，'
      + '且换人链会把 `job.prompt` 非空直接短路编译，lint 与字段完整性检查全部跳过。'
      + '请删掉所有 subject_definitions / summary / retention_analysis / detailed_description / '
      + 'overall_soundscape / non_diegetic_music 字段，只用四段式（总结 / 身份绑定 / 时间轴 / 防漂移）。',
    );
    err.code = 'REPLACE_PROMPT_MIXED';
    err.field = mixed.field;
    throw err;
  }

  const out = {
    trigger: [], summary: [], subjects: [], video: [],
    shots: [], guards: [], stray: [], needsTranslate: false,
  };
  if (!text.trim()) return out;

  /**
   * 按段落切，但保留"一句一行"的原文换行。
   *
   * 不能简单按 `\n` 切：触发词本身可能跨两行（作者排版造成），
   * 按行切会把它劈成两条，逐字保留就失效了。
   */
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  let i = 0;
  // 开头的触发词块：整块保留
  while (i < blocks.length && TRIGGER_HINT.test(blocks[i])) {
    out.trigger.push(blocks[i]);
    i += 1;
  }

  for (; i < blocks.length; i += 1) {
    const block = blocks[i];
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (RE_SHOT.test(line)) out.shots.push(line);
      else if (RE_GUARD.test(line)) out.guards.push(line);
      else if (RE_SUBJECT.test(line)) out.subjects.push(line);
      else if (RE_VIDEO.test(line)) out.video.push(line);
      else if (RE_SUMMARY.test(line)) out.summary.push(line);
      else out.stray.push(line);
    }
  }

  // `stray` 必须保持**原文顺序**：用户写的时候有叙事顺序，二次分流会打乱
  out.needsTranslate = hasCjk(text) || hasCjk(JSON.stringify(out));
  return out;
}

/**
 * 把拆分结果拼回四段式。
 *
 * @param {ReturnType<typeof splitReplacePrompt>} parts
 * @param {{ translated?: Record<string,string[]> }} [opts]
 *   `translated` 是模型返回的逐条翻译，key 是原文；
 *   有就用译文、没有就保留原文（**绝不丢**）。
 * @returns {string}
 */
export function joinReplacePrompt(parts, opts = {}) {
  const tr = opts.translated ?? {};
  const pick = (arr) => arr.map((x) => (tr[x] ?? x)).filter(Boolean);
  const L = [];

  // 触发词永远在最前，且不翻译
  if (parts.trigger.length) {
    L.push(parts.trigger.join('\n'), '');
  }

  const summary = pick(parts.summary);
  if (summary.length) L.push(summary.join(' '), '');

  const defs = [...pick(parts.subjects), ...pick(parts.video)];
  if (defs.length) L.push(defs.join('\n'), '');

  const shots = [...pick(parts.shots), ...pick(parts.stray)];
  if (shots.length) L.push(shots.join('\n'), '');

  const guards = pick(parts.guards);
  if (guards.length) L.push(guards.join('\n'), '');

  return L.join('\n').trim();
}

/** 规则引擎版本：不做翻译，只重排结构（兜底路径） */
export function normalizeByRules(raw) {
  const parts = splitReplacePrompt(raw);
  return {
    prompt: joinReplacePrompt(parts),
    parts,
    translated: false,
  };
}

/**
 * 完整流程：规则拆分 → 注入的翻译器 → 重新拼装。
 *
 * 为什么翻译不碰 trigger：那是 LoRA 训练时绑定的描述句 —— 改一个字效果就废，
 * 必须逐字保留。subjects / video / guards 含占位符，翻译容易把占位符改坏，
 * 所以翻完要按占位符数量校验。翻译失败时退回规则版本。
 *
 * @param {string} raw 用户原始输入
 * @param {object} cfg 插件配置
 * @param {object} [opts]
 * @param {boolean} [opts.useLlm]
 * @param {(cfg: object, texts: string[]) => Promise<Record<string,string>>} [opts.translate]
 *        翻译函数，由调用方注入（bridge 不 import services）
 * @returns {Promise<{ prompt:string, parts:object, translated:boolean, warnings:string[] }>}
 * @throws {Error} REPLACE_PROMPT_MIXED —— 检测到六段式字段
 */
export async function normalizePrompt(raw, cfg, opts = {}) {
  const parts = splitReplacePrompt(raw);
  const warnings = [];
  const base = { parts, prompt: joinReplacePrompt(parts), translated: false, warnings };

  if (!opts.useLlm) return base;
  if (!parts.needsTranslate) return base;
  if (typeof opts.translate !== 'function') {
    warnings.push(
      '未注入翻译器（opts.translate），已跳过翻译并保留中文原文。'
      + '要启用本地翻译，请由调用方传入 services/prompt-llm.translateBatch。',
    );
    return base;
  }

  /**
   * 送翻的候选：**所有含中文的句子**，包括带占位符的那些。
   * 排除带占位符的句子会让 subjects / video / guards 整段保持中文 ——
   * 而那恰是身份绑定与防漂移声明，最该让模型读对。
   * 正确做法是让模型翻、用正则校验占位符，对不上就丢掉译文保留原文。
   */
  const PH_ALL = /<(Subject|Video|Picture|Audio)\s*\d+>/gi;
  const countPh = (s) => (String(s).match(PH_ALL) || []).length;

  const targets = [
    ...parts.summary,
    ...parts.subjects,
    ...parts.video,
    ...parts.shots,
    ...parts.guards,
    ...parts.stray,
  ].filter((t) => hasCjk(t) && !parts.trigger.includes(t));   // 触发词永远不翻

  if (!targets.length) return base;

  try {
    const raw2 = await opts.translate(cfg, targets);
    if (!raw2 || !Object.keys(raw2).length) {
      warnings.push('本地翻译模型没有返回结果，已保留中文原文');
      return base;
    }

    /**
     * 校验占位符数量必须一致。
     *
     * 模型偶尔会把 `<Picture 1>` 翻成"图片1"或加空格，那样 H3 就认不出了。
     * 数量对不上就丢掉这条译文（保留原文），宁可中英混排也不破坏占位符。
     */
    const translated = {};
    let dropped = 0;
    for (const [src, dst] of Object.entries(raw2)) {
      if (countPh(src) === countPh(dst)) translated[src] = dst;
      else dropped += 1;
    }
    if (dropped) {
      warnings.push(`${dropped} 条译文改动了占位符，已保留原文（防止 <Picture N> 失效）`);
    }

    const prompt = joinReplacePrompt(parts, { translated });
    return { parts, prompt, translated: true, warnings };
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 120);
    warnings.push(`本地翻译失败（${msg}），已退回规则整理版本`);
    return base;
  }
}