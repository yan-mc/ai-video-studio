/**
 * 按段切分分镜提示词 —— 让「7 段视频 ↔ 7 个 [Shot N]」真正对上。
 *
 * ============================================================================
 * 为什么需要这个模块
 * ============================================================================
 *
 * 换人流程把长视频切成 N 段分别重建，但提示词里的 `[Shot 1]…[Shot M]`
 * 是**整条片子**的分镜设计。早先的实现把整份提示词原样发给每一段：
 *
 *   段 1 收到 [Shot 1][Shot 2][Shot 3][Shot 4][Shot 5][Shot 6][Shot 7]
 *   段 2 收到 [Shot 1][Shot 2][Shot 3][Shot 4][Shot 5][Shot 6][Shot 7]
 *   …
 *
 * 结果是每段都想把整场戏演完 —— 动作挤在一起、节奏全乱，而且模型根本
 * 不知道"这一段只该演第 3 个镜头"。
 *
 * 正确做法是**每段只保留它自己那个 [Shot]**，其余全部剥掉。
 *
 * ============================================================================
 * 对应关系的判定
 * ============================================================================
 *
 * 三种情况：
 *
 *   ① M == N（分镜数 == 段数）→ 一对一，段 i 取 [Shot i]
 *   ② M != N 且能整除        → 段 i 取第 i 组（每组 M/N 个 Shot）
 *   ③ 其余                   → **不切**，整份发给每段，并给出明确警告
 *
 * 情况 ① 是用户这次的场景（7 段 7 Shot），也是设计上最自然的用法。
 * 情况 ③ 不切是因为瞎猜配对关系比不切更糟 —— 与其让模型收到错的分镜，
 * 不如保留全文并让用户看到警告。
 *
 * @module shot-splitter
 */

/** 匹配 [Shot N] 及其后面的内容，直到下一个 [Shot] 或结尾 */
const SHOT_RE = /\[Shot\s*(\d+)\]/gi;

/**
 * 把提示词拆成「外壳 + 所有 Shot 块」。
 *
 * @param {string} prompt
 * @returns {{ head: string, shots: Array<{ n: number, text: string }>, tail: string }}
 *   `head` 是第一个 [Shot] 之前的内容（触发词、身份绑定等），
 *   `tail` 是最后一个 Shot 之后的内容（防漂移声明）。
 */
export function parseShots(prompt) {
  const text = String(prompt ?? '');
  const marks = [...text.matchAll(SHOT_RE)];
  if (!marks.length) {
    return { head: text, shots: [], tail: '' };
  }

  const head = text.slice(0, marks[0].index).trimEnd();
  const shots = [];
  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    shots.push({ n: Number(marks[i][1]), text: text.slice(start, end).trim() });
  }

  /**
   * `tail` 的判定：最后一个 Shot 块里如果混了防漂移句，应该剥出来。
   *
   * 用户通常把「全程保持…一致」写在最后一行，它会被算进最后一个 Shot 块。
   * 如果直接把它切给某一段，其它段就丢掉了这条约束 —— 而防漂移是每段都要的。
   *
   * 识别特征（中英两种写法都要覆盖）：
   *   · 中文：全程保持 / 完全复刻…不添加
   *   · 英文：Maintain… / Keep…consistent / Fully replicate…without…
   *
   * ⚠️ 早先只覆盖了前三种，`Fully replicate <Video 1>'s action without adding
   *    new characters.` 这种最常见的中译英结果**没被识别**，
   *    于是它被归进最后一个 Shot，只发给最后一段 —— 其余段全丢防漂移约束。
   */
  const isGuardLine = (l) => /^(全程保持|完全复刻.*不添加|Maintain\b|Keep\b.*consistent|Fully replicate.*without)/i.test(l.trim());

  const last = shots[shots.length - 1];
  let tail = '';
  if (last) {
    const lines = last.text.split('\n');
    const guardIdx = lines.findIndex((l, i) => i > 0 && isGuardLine(l));
    if (guardIdx > 0) {
      tail = lines.slice(guardIdx).join('\n').trim();
      shots[shots.length - 1] = { ...last, text: lines.slice(0, guardIdx).join('\n').trim() };
    }
  }

  return { head, shots, tail };
}

/**
 * 按段号取对应的提示词。
 *
 * @param {string} prompt 完整提示词
 * @param {number} segIndex 段序号（**从 1 开始**）
 * @param {number} segTotal 总段数
 * @returns {{ prompt: string, mode: 'one-to-one'|'grouped'|'whole', shots: number[], warning: string }}
 *   `mode` 说明采用了哪种切分策略，`shots` 是这一段实际包含的 Shot 编号。
 */
export function splitPromptForSegment(prompt, segIndex, segTotal) {
  const { head, shots, tail } = parseShots(prompt);

  const assemble = (picked) => {
    const body = picked.map((s) => s.text).join('\n\n');
    return [head, body, tail].filter(Boolean).join('\n\n');
  };

  // 没有分镜 → 整份发
  if (!shots.length) {
    return {
      prompt: String(prompt ?? ''),
      mode: 'whole',
      shots: [],
      warning: '',
    };
  }

  const M = shots.length;
  const N = Math.max(1, Number(segTotal) || 1);
  const idx = Math.max(1, Math.min(N, Number(segIndex) || 1));

  // ① 一对一
  if (M === N) {
    const picked = [shots[idx - 1]];
    return { prompt: assemble(picked), mode: 'one-to-one', shots: picked.map((s) => s.n), warning: '' };
  }

  // ② 分组（每组 M/N 个）
  if (M > N && M % N === 0) {
    const per = M / N;
    const from = (idx - 1) * per;
    const picked = shots.slice(from, from + per);
    return { prompt: assemble(picked), mode: 'grouped', shots: picked.map((s) => s.n), warning: '' };
  }

  // ③ 配不上 → 不切，明确告知
  return {
    prompt: String(prompt ?? ''),
    mode: 'whole',
    shots: shots.map((s) => s.n),
    warning:
      `提示词里有 ${M} 个 [Shot N]，但视频切成 ${N} 段 —— 数量对不上，`
      + '无法把分镜映射到段。已把完整提示词发给每一段（每段都会试图演完整场戏）。'
      + `要让每段只演自己那部分，请让分镜数等于段数（当前需 ${N} 个），`
      + '或写成能被段数整除的分组。',
  };
}

/** 检查分镜编号是否连续（缺号/重号会导致模型困惑） */
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
