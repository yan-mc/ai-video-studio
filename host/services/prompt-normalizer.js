/**
 * 提示词规范化 —— 把用户手写的自由文本整理成换人规范的四段式。
 *
 * ============================================================================
 * 为什么需要这一层
 * ============================================================================
 *
 * 换人流程要求固定结构（总结 / 身份绑定 / 时间轴 / 防漂移），但使用者
 * 常常手写一段中英混排的自由文本 —— 六个字段一个都没有，中文占三成。
 * 模型拿到散句，不知道哪句是身份定义、哪句是约束。
 *
 * 云端 AI 普遍拒绝处理这类内容（NSFW），所以只能本地解决。
 *
 * ============================================================================
 * 三层降级
 * ============================================================================
 *
 *   ① 规则引擎（本文件）—— 纯字符串，永远成功，<10ms
 *   ② 本地 7B 翻译模型    —— 规则切完后补翻译，离线、无拒答
 *   ③ 原文兜底           —— 前两步都失败时原样返回，绝不丢用户内容
 *
 * 关键设计：**规则引擎先跑，模型只做翻译**。
 * 让模型自由重写是不可控的 —— 它可能"优化"掉 LoRA 触发词，那是模型训练
 * 时绑定的描述句，改一个字效果就废了。
 *
 * @module prompt-normalizer
 */

/**
 * LoRA 触发词识别。
 *
 * 有些 LoRA（如 DR34ML4Y）训练时把一整段英文描述绑成触发条件，
 * 用户必须原样写进提示词。这类句子有两个特征：
 *   · 是完整英文长句（不是指令，是描述）
 *   · 出现在最开头
 *   · 不含 <Subject>/<Video> 这类占位符
 *
 * 识别出来就**逐字保留**，不参与翻译、不参与重排。
 */
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

/** 是否含中文（用于判断要不要走翻译） */
export function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text ?? ''));
}

/**
 * 把用户自由文本拆成四段式的各个槽位。
 *
 * @param {string} raw 用户原始输入
 * @returns {{
 *   trigger: string[],      // 触发词句（逐字保留）
 *   summary: string[],      // 第 1 段：总结 + 映射
 *   subjects: string[],     // 第 2 段：身份绑定
 *   video: string[],        // 第 2 段：源视频声明
 *   shots: string[],        // 第 3 段：时间轴
 *   guards: string[],       // 第 4 段：防漂移
 *   stray: string[],        // 无法归类的，塞进 detailed 位置
 *   needsTranslate: boolean,
 * }}
 */
export function splitReplacePrompt(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  const out = {
    trigger: [], summary: [], subjects: [], video: [],
    shots: [], guards: [], stray: [], needsTranslate: false,
  };
  if (!text.trim()) return out;

  /**
   * 按段落切，但保留"一句一行"的原文换行。
   *
   * ⚠️ 不能简单按 `\n` 切：触发词本身可能跨两行（作者排版造成），
   *    按行切会把它劈成两条，逐字保留就失效了。
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

  /**
   * ⚠️ `stray` 必须保持**原文顺序**。
   *
   * 早先这里把「含注意/强调的句子」单独抽进 `shots`，于是重排后那些句子
   * 跑到前面、普通散句跑到后面，读起来像被打乱过 —— 用户写的时候是有
   * 叙事顺序的（先说要强调什么，再说怎么做），打乱会让模型理解偏差。
   *
   * 现在统一按出现顺序进 `stray`，不再二次分流。
   */
  out.needsTranslate = hasCjk(text) || hasCjk(JSON.stringify(out));
  return out;
}

/**
 * 把拆分结果拼回四段式。
 *
 * @param {ReturnType<typeof splitReplacePrompt>} parts
 * @param {{ translated?: Record<string,string[]> }} [opts]
 *   `translated` 是模型返回的逐条翻译，key 是原文，
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

/**
 * 规则引擎版本：不做翻译，只重排结构。
 *
 * 这是**兜底路径** —— 模型不可用时靠它保证至少结构是对的。
 */
export function normalizeByRules(raw) {
  const parts = splitReplacePrompt(raw);
  return {
    prompt: joinReplacePrompt(parts),
    parts,
    translated: false,
  };
}

/**
 * 完整流程：规则拆分 → 模型翻译 → 重新拼装。
 *
 * ============================================================================
 * 为什么翻译只翻 summary 和 stray，不翻 trigger
 * ============================================================================
 *
 * - `trigger` 是 LoRA 训练时绑定的描述句 —— 改一个字效果就废，
 *   必须逐字保留，**不参与任何加工**。
 * - `subjects` / `video` / `guards` 含占位符（`<Subject N>`），
 *   翻译容易把占位符改坏，所以只翻纯自然语言的部分。
 *
 * 翻译失败时**退回规则版本** —— 绝不因为模型不可用而让用户卡住。
 *
 * @param {string} raw 用户原始输入
 * @param {object} cfg
 * @param {{ useLlm?: boolean }} [opts]
 * @returns {Promise<{ prompt:string, parts:object, translated:boolean, warnings:string[] }>}
 */
export async function normalizePrompt(raw, cfg, opts = {}) {
  const parts = splitReplacePrompt(raw);
  const warnings = [];
  const base = { parts, prompt: joinReplacePrompt(parts), translated: false, warnings };

  if (!opts.useLlm) return base;
  if (!parts.needsTranslate) return base;

  /**
   * 送翻的候选：**所有含中文的句子**，包括带占位符的那些。
   *
   * ⚠️ 早先这里排除了含 `<Subject N>` 的句子，理由是"怕模型把占位符改坏"。
   *    结果 `subjects` / `video` / `guards` 三段**整段保持中文**，
   *    输出里还剩 68 个中文字符 —— 而这三段恰恰是身份绑定和防漂移声明，
   *    是最该让模型读对的部分。
   *
   * 正确做法是**让模型翻，但在提示词里强调占位符逐字保留**，
   * 翻完再用正则校验：占位符数量对不上就丢掉这条译文、保留原文。
   * 这样既拿到了翻译，又不会因为模型手滑而破坏 `<Picture 1>`。
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
    const LLM = await import('./prompt-llm.js');
    const raw2 = await LLM.translateBatch(cfg, targets);
    if (!Object.keys(raw2).length) {
      warnings.push('本地翻译模型没有返回结果，已保留中文原文');
      return base;
    }

    /**
     * 校验：占位符数量必须一致。
     *
     * 模型偶尔会把 `<Picture 1>` 翻成"图片1"或加空格，那样 H3 就认不出了。
     * 数量对不上就**丢掉这条译文**（保留原文），宁可中英混排也不能破坏占位符。
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
