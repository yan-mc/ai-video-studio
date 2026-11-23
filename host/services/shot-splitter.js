/**
 * 按段切分分镜提示词 —— 让「N 段视频 ↔ N 个 [Shot N]」真正对上。
 *
 * ============================================================================
 * 设计前提（用户明确约定）
 * ============================================================================
 *
 * **`[Shot N]` 一定独占一行，且该段的所有内容都在这一行内，不跨行。**
 *
 * 这条约定让切分变得极简：
 *   · 以 `[Shot N]` 开头的行  = 某个镜头的动作描述（只属于那一段）
 *   · 其余所有行              = 全局要求（**每一段都要带**）
 *
 * 所以切分 = **删掉不属于本段的 `[Shot N]` 行，其他一个字节都不动**。
 *
 * ============================================================================
 * 为什么不是「按块切分」
 * ============================================================================
 *
 * 早先的实现按 `[Shot N]` 位置把文本切成若干块，每块包含「该 Shot 行 +
 * 到下一个 Shot 之间的所有文字」。这在用户这种排版下是**错的**：
 *
 *   [Shot 7] 动作描述
 *                       ← 空行
 *   Fine detail of woman vagina.          ┐
 *   Emphasize the trembling...            │ 这些是「所有幕都要遵守」
 *   Only modifications will be made...    │ 的通用要求，却被算进了 Shot 7
 *   Pay close attention...                │
 *   Pay attention to the details...       ┘
 *   Maintain <Subject 1> identity...      ← 这条碰巧被识别成 tail
 *
 * 实测后果：段 1–6 各丢失 5 条通用要求，只有段 7 完整。
 * 而这些恰恰是画质、表情、服装细节的约束 —— 丢了就等于没写。
 *
 * 现在的行过滤法不会有这个问题：非 Shot 行一律保留。
 *
 * @module shot-splitter
 */

/** 匹配「以 [Shot N] 开头的整行」 */
const SHOT_LINE_RE = /^\s*\[Shot\s*(\d+)\]/i;

/**
 * 扫描提示词，找出所有 `[Shot N]` 行。
 *
 * @param {string} prompt
 * @returns {{ lines: string[], shotLines: Array<{ lineIdx: number, n: number }> }}
 */
function scan(prompt) {
  const lines = String(prompt ?? '').split('\n');
  const shotLines = [];
  lines.forEach((l, i) => {
    const m = l.match(SHOT_LINE_RE);
    if (m) shotLines.push({ lineIdx: i, n: Number(m[1]) });
  });
  return { lines, shotLines };
}

/**
 * 拆出分镜信息（供编号校验与数量统计用）。
 *
 * @param {string} prompt
 * @returns {{ shots: Array<{ n: number, text: string }> }}
 */
export function parseShots(prompt) {
  const { lines, shotLines } = scan(prompt);
  return {
    shots: shotLines.map((s) => ({ n: s.n, text: lines[s.lineIdx].trim() })),
  };
}

/**
 * 按段号取对应的提示词。
 *
 * @param {string} prompt 完整提示词
 * @param {number} segIndex 段序号（**从 1 开始**）
 * @param {number} segTotal 总段数
 * @returns {{ prompt: string, mode: 'one-to-one'|'grouped'|'whole', shots: number[], warning: string }}
 */
export function splitPromptForSegment(prompt, segIndex, segTotal) {
  const text = String(prompt ?? '');
  const { lines, shotLines } = scan(text);

  // 没有分镜 → 整份发
  if (!shotLines.length) {
    return { prompt: text, mode: 'whole', shots: [], warning: '' };
  }

  const M = shotLines.length;
  const N = Math.max(1, Number(segTotal) || 1);
  const idx = Math.max(1, Math.min(N, Number(segIndex) || 1));

  /**
   * 决定这一段保留哪些**行**（用行下标，不用 Shot 编号）。
   *
   * ⚠️ 必须用行下标：用户可能写出两个 `[Shot 6]`（手误），
   *    按编号匹配会把两条都留下，等于那段演了两个镜头。
   */
  let keepLineIdx;
  let mode;

  if (M === N) {
    // ① 一对一：最自然的用法
    keepLineIdx = new Set([shotLines[idx - 1].lineIdx]);
    mode = 'one-to-one';
  } else if (M > N && M % N === 0) {
    // ② 分组：每段分 M/N 个
    const per = M / N;
    const from = (idx - 1) * per;
    keepLineIdx = new Set(shotLines.slice(from, from + per).map((s) => s.lineIdx));
    mode = 'grouped';
  } else {
    // ③ 配不上 → 不切（瞎猜比不切更糟），并明确告知
    return {
      prompt: text,
      mode: 'whole',
      shots: shotLines.map((s) => s.n),
      warning:
        `提示词里有 ${M} 个 [Shot N]，但视频切成 ${N} 段 —— 数量对不上，`
        + '无法把分镜映射到段。已把完整提示词发给每一段（每段都会试图演完整场戏）。'
        + `要让每段只演自己那部分，请让分镜数等于段数（当前需 ${N} 个），`
        + '或写成能被段数整除的分组。',
    };
  }

  /**
   * 核心：**只删不属于本段的 Shot 行，其余原样保留**。
   *
   * 非 Shot 行（触发词、身份绑定、通用要求、防漂移声明）每一段都要带 ——
   * 它们不是"某个镜头的描述"，而是"整条片子的规则"。
   */
  const kept = [];
  lines.forEach((l, i) => {
    const isShotLine = shotLines.some((s) => s.lineIdx === i);
    if (!isShotLine) { kept.push(l); return; }
    if (keepLineIdx.has(i)) kept.push(l);
  });

  // 删行后可能留下连续空行，压成一个空行即可（不要压得更多，避免把分段结构弄乱）
  const out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    prompt: out,
    mode,
    shots: shotLines
      .filter((s) => keepLineIdx.has(s.lineIdx))
      .map((s) => s.n),
    warning: '',
  };
}

/**
 * 检查分镜编号是否连续（缺号/重号会导致模型困惑）。
 *
 * 注意：这两个问题都**不阻断执行**，只是提醒 —— 用户可能有意为之。
 */
export function checkShotNumbering(prompt) {
  const { shots } = parseShots(prompt);
  if (!shots.length) return { ok: true, warning: '' };

  const ns = shots.map((s) => s.n);
  const dup = ns.filter((n, i) => ns.indexOf(n) !== i);
  if (dup.length) {
    return {
      ok: false,
      warning: `分镜编号有重复：[Shot ${[...new Set(dup)].join('], [Shot ')}] 出现了不止一次，`
        + '模型会按出现顺序理解，重复编号会打乱它对齐时间轴的依据。',
    };
  }

  const sorted = [...ns].sort((a, b) => a - b);
  const expected = sorted.map((_, i) => i + 1);
  if (sorted.join(',') !== expected.join(',')) {
    return {
      ok: false,
      warning: `分镜编号不连续（实际 ${sorted.join(',')}），建议改成从 [Shot 1] 开始连续编号。`,
    };
  }
  return { ok: true, warning: '' };
}
