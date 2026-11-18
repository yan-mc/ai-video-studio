/**
 * 精确改写：处理 build-prompts.mjs 里**跨行切断**的负面表述。
 *
 * 上一版 fix-negations.mjs 用「整句匹配」，但源文件把句子切成多段
 * 模板字符串（`` + `...` ``），断点常落在单词中间，所以整句匹配会 miss。
 * 这里改用**更短、落在单段内**的片段做替换。
 */
import fs from 'node:fs';

const P = new URL('./build-prompts.mjs', import.meta.url);
let s = fs.readFileSync(P, 'utf8');

const RULES = [
  // 段 1 — 开场句里的 "no carried overlap region"
  ['This is the opening segment, so there is no carried overlap region and the first second ',
    'This is the opening segment, so the first second stands free of any carried overlap and it '],

  // 段 1 — 走路描述（跨行在 "no " 后断开）
  ['arms hanging relaxed, no `\n      + `gestures, no turning toward each other. ',
    'arms hanging relaxed, both gazes `\n      + `fixed ahead toward the water. '],

  // 段 2 — 停步（跨行在 "reframing." 前）
  ['constant side-view angle, without zooming, pulling out or reframing.',
    'constant side-view angle, settling into stillness at a fixed framing.'],

  // 段 5 — 高光纪律（跨行）
  ['Every highlight is a single hard edge and never blooms; there is no `\n      + `lens flare, no glow overlay, and ',
    'Every highlight is a single hard edge that stays inside its own shape, with a clean flat `\n      + `cel-painted surface and '],

  // 段 5 — 裁切区（跨行在 "no new " 后断开）
  ['The first second continues the carried seated state with no new `\n      + `event. ',
    'The first second continues the carried seated state as pure continuation. '],

  // 段 6 — 裁切区（同型）
  ['The first second continues the carried facial pose with no new `\n      + `event. ',
    'The first second continues the carried facial pose as pure continuation. '],

  // 段 6 — 天空锁改成正向
  ['one low dark cloud band. No daytime blue sky and no white cumulus clouds appear anywhere in frame.',
    'one low dark cloud band filling the entire upper frame with sunset colour only.'],
];

let applied = 0;
const missed = [];
for (const [from, to] of RULES) {
  if (s.includes(from)) {
    s = s.split(from).join(to);
    applied += 1;
  } else {
    missed.push(from.slice(0, 50).replace(/\n/g, '\\n'));
  }
}

fs.writeFileSync(P, s, 'utf8');
console.log(`应用 ${applied}/${RULES.length}`);
if (missed.length) {
  console.log('未命中：');
  for (const m of missed) console.log('  - ' + m);
}
