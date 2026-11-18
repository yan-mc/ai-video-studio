/**
 * 一次性改写工具：把 build-prompts.mjs 里的负面表述改成正面陈述。
 *
 * 为什么必须改：本地 H3 是 guidance-distilled、CFG 固定、采样器没有
 * negative 分支 —— 写 "no specular" / "no lens flare" / "no gestures"
 * 反而会把这些元素拉进画面（插件 lint 会警告）。
 *
 * 群友 skill 里那些 "never bloom / no lens flare" 是给**人类读者**强调
 * 画质要求的，落到实际提示词里应改成"某材质呈现某种确定的、平的效果"。
 */
import fs from 'node:fs';

const P = new URL('./build-prompts.mjs', import.meta.url);
let s = fs.readFileSync(P, 'utf8');

/** [旧, 新] 逐条替换 —— 顺序有意义（长句先换） */
const RULES = [
  // 段 1
  ['is fully authored. Every action below may begin at the first frame.',
    'is fully authored. Every action below begins at the first frame.'],
  ['arms hanging relaxed, no gestures, no turning toward each other. Their shadows stretch forward-left across the pale stone ',
    'arms hanging relaxed, both gazes fixed ahead toward the water. Their shadows stretch forward-left across the pale stone '],
  ['the frame; no zoom, no pan, no reframing.',
    'the frame, holding one fixed framing throughout.'],
  ['a faint high wind. No dialogue.',
    'a faint high wind, with the two girls staying silent.'],

  // 段 2-6 的裁切区句（"no new event" 改成正面时间轴陈述）
  ['The first second continues the carried walk with no new event.',
    'The first second continues the carried walk as pure continuation, and the stop begins at the one-second mark.'],
  ['The first second continues the carried standing with no new event.',
    'The first second continues the carried standing as pure continuation, and the sit begins at the one-second mark.'],
  ['The first second continues the carried seated hand position with no new event.',
    'The first second continues the carried seated hand position as pure continuation, and the settle begins at the one-second mark.'],
  ['The first second continues the carried seated state with no new event.',
    'The first second continues the carried seated state as pure continuation, and the hand begins to enter at the one-second mark.'],
  ['The first second continues the carried facial pose with no new event.',
    'The first second continues the carried facial pose as pure continuation, and the smile begins at the one-second mark.'],

  // 其余散落的否定
  ['neither speaks and neither turns to the other.',
    'both stay silent and both keep facing the water.'],
  ['Neither hand grips or ',
    'Each hand rests with gentle weight, '],
  ['without stepping', 'staying planted in place'],
  ['without touching', 'hovering just off the skin'],
  ['never reframing or cutting', 'holding one continuous framing'],
  ['never blooms; there is no lens flare and no glow overlay',
    'with a clean flat cel-painted surface throughout'],
  ['Highlights never bloom; there is no lens flare and no ',
    'Every highlight is a single hard edge that stays inside its own shape, with '],
  ['and no soft airbrushed falloff', 'and a uniformly crisp painted finish'],
  ['Sound drops almost entirely away, leaving only the faintest surf and the smallest brush of ',
    'Sound thins almost to nothing, leaving only the faintest surf and the smallest brush of '],
];

let applied = 0;
const missed = [];
for (const [from, to] of RULES) {
  if (s.includes(from)) {
    s = s.split(from).join(to);
    applied += 1;
  } else {
    missed.push(from.slice(0, 55));
  }
}

fs.writeFileSync(P, s, 'utf8');
console.log(`应用 ${applied}/${RULES.length} 条替换`);
if (missed.length) {
  console.log('未命中（可能已改过或写法不同）：');
  for (const m of missed) console.log('  - ' + m);
}
