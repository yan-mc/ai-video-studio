/**
 * 编译产物自查与截断 —— 反模式落位、字段完整性、语言、字符上限。
 * 格式靠字符串拼出来，拼错了只有模型表现变差，所以在收口处再查一遍。
 * @module prompt/lint
 */
import { H3_LIMITS, CONTINUATION_SWITCH, TRIM_DISCIPLINE, SUPPRESSION_GUARDS } from './spec.js';

/** 插件注入的机制句 —— 查否定词前必须整体剥离，否则每个续写段都误报 */
export const MECHANISM_BLOCKS = Object.freeze([
  CONTINUATION_SWITCH.carried,
  CONTINUATION_SWITCH.opening,
  TRIM_DISCIPLINE.carried,
  TRIM_DISCIPLINE.opening,
].filter(Boolean));

/** 插件注入的两道压制句（按值剥离：它们本身就是被授权的位置） */
const AUTHORED_BLOCKS = [SUPPRESSION_GUARDS.textSuppression, SUPPRESSION_GUARDS.frameIntegrity];

/**
 * 画风库 / 打光库的官方英文串（由门面注入）。它们自带 `NO subtitles` /
 * `DO NOT change…` 等官方约束句，按值剥离是唯一零误报的做法。
 */
let scannedValues = [];

/** @param {string[]} values 画风/打光串 */
export function bindAuthoredValues(values = []) {
  scannedValues = (Array.isArray(values) ? values : [])
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
}

/** 授权位置之外出现独立负面句即为违规（本地 CFG=1、无 negative 分支） */
export const SUPPRESSION_RULES = Object.freeze([
  { id: 'do-not', re: /(?:^|[.!?;]\s*|\n\s*)Do not\s+[a-z]/ },
  { id: 'never', re: /(?:^|[.!?;]\s*|\n\s*)Never\s+[a-z]/ },
  { id: 'avoid', re: /(?:^|[.!?;]\s*|\n\s*)Avoid\s+[a-z]/ },
  { id: 'upper-NO-pair', re: /\bNO\s+[a-z][\w-]*(?:\s*,\s*NO\s+[a-z][\w-]*)+/ },
  { id: 'cjk-negative', re: /(?:^|[。！？；：\n])\s*(?:不要|禁止|避免)/ },
]);

/** 官方参考关系说明（主语是参考素材的语义边界，不属压制词） */
const OFFICIAL_RELATIONS = [
  'does not define character appearance',
  'do not copy characters or set',
  'do not copy the waveform',
  'do not follow characters or set',
  'no reference picture was supplied',
  'It carries no audio',
];

/** 压制词落位检查。`Do not` 规则不加 `i`：官方画风串里是句中 `DO NOT change…`，
 * 加了会命中句首规则，产生 6/11 画风的固定误报。 */
export function scanSuppressionPlacement(prompt) {
  let hay = String(prompt ?? '');

  for (const b of MECHANISM_BLOCKS) hay = hay.split(b).join(' ');
  for (const s of OFFICIAL_RELATIONS) hay = hay.split(s).join(' ');
  hay = hay.replace(/^Text suppression:.*$/gm, ' ');
  // 授权位置 3：具名物属性声明（正向句法，主语是物）
  hay = hay.replace(/\b(?:whose|remaining)\b[^.;]*/g, ' ');
  hay = hay.replace(/\bwith no [a-z]+[^.;]*/gi, ' ');
  for (const b of AUTHORED_BLOCKS) hay = hay.split(b).join(' ');
  for (const b of scannedValues) if (b) hay = hay.split(b).join(' ');

  for (const rule of SUPPRESSION_RULES) {
    const m = rule.re.exec(hay);
    if (!m) continue;
    const hit = String(m[0]).trim();
    return {
      violation:
        `发现没有通道的负面句「${hit.slice(0, 60)}」—— 本地 CFG 固定 1.0、`
        + '采样器没有 negative 分支，写在正文里反而把该元素拉进画面。'
        + '压制词只有三处合法位置：'
        + '①画风串后的 Text suppression 追加行 ②场景板负面清单 ③具名物属性声明。'
        + '其余情况请改成正向陈述（"画面里只有…" / "whose board carries no …"）',
    };
  }
  return { violation: null };
}

const FIELD_RE = /^(subject_definitions|summary|retention_analysis|detailed_description|integrated_multimodal_description|overall_soundscape|non_diegetic_music)\s*:/gim;

/** 把单块按句末截到最多 `maxSentences` 句 */
function limitBlock(block, maxSentences) {
  const idx = block.indexOf(':');
  const label = idx >= 0 ? block.slice(0, idx + 1) : '';
  const body = idx >= 0 ? block.slice(idx + 1) : block;
  const sentences = body.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [body];
  if (sentences.length <= maxSentences) return block;
  return `${label}\n${sentences.slice(0, maxSentences).join('').trim()}\n\n`;
}

/** 无字段结构时的兜底：按句末截断，绝不在单词中间切 */
function truncateAtSentence(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > limit * 0.5) return cut.slice(0, lastStop + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

function countSentences(block) {
  const idx = block.indexOf(':');
  const body = idx >= 0 ? block.slice(idx + 1) : block;
  return (body.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [body]).length;
}

/**
 * 在保持字段完整的前提下把提示词压到上限以内。不能直接 slice：那会把六段从中间
 * 砍断（`overall_soundscape` / `non_diegetic_music` 永远在最后，必丢）。这里对每个
 * 字段的句数上限做二分，取能放下且留句最多的那个。
 */
export function truncatePromptKeepFields(prompt, limit = H3_LIMITS.promptOfficialMaxChars) {
  const text = String(prompt ?? '');
  if (text.length <= limit) return text;

  const marks = [...text.matchAll(FIELD_RE)];
  if (marks.length < 2) return truncateAtSentence(text, limit);

  const head = text.slice(0, marks[0].index);
  const blocks = marks.map((m, i) => ({
    name: m[1].toLowerCase(),
    body: text.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : text.length),
  }));
  const maxSentences = Math.max(...blocks.map((b) => countSentences(b.body)));
  const render = (keep) => head + blocks.map((b) => limitBlock(b.body, keep)).join('');

  let lo = 1;
  let hi = Math.max(1, maxSentences);
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const out = render(mid);
    if (out.length <= limit) {
      best = out;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best) return best;
  return truncateAtSentence(render(1), limit);
}

/**
 * 编译产物自查 —— 官方格式最容易踩的几条，全部做成可见警告。
 */
export function lintCompiledPrompt(prompt, format, warnings = []) {
  let p = String(prompt ?? '');
  const w = warnings;

  for (const b of MECHANISM_BLOCKS) if (b) p = p.split(b).join(' ');

  // 1) 字符上限（两道：本插件收紧值 / 官方硬上限）
  if (p.length > H3_LIMITS.promptMaxChars) {
    w.push(
      `提示词 ${p.length} 字符超过本插件上限 ${H3_LIMITS.promptMaxChars}`
      + '（官方 7000 过大，实测会稀释动作细节的注意力）。'
      + '建议优先压缩：画风串后的重复描述、光影层里的解释性从句、声音行的重复。',
    );
    if (p.length > H3_LIMITS.promptOfficialMaxChars) {
      w.push(`提示词 ${p.length} 字符也超过了官方硬上限 ${H3_LIMITS.promptOfficialMaxChars}，上游可能拒绝`);
    }
  }

  // 2) 时间区间非法（官方只接受单点时间戳）
  const range = /\[\s*\d+(?:\.\d+)?\s*s?\s*[-–~]\s*\d+(?:\.\d+)?\s*s?\s*\]/.exec(p);
  if (range) {
    w.push(`发现时间区间 ${range[0]} —— 官方只接受单点时间戳（如 At 00:05.000,），区间会被忽略`);
  }

  // 3) 方括号运镜是上一代 video-01-director 的语法
  if (/\[(Pan|Zoom|Tilt|Dolly|Truck|Orbit|Crane)\b/i.test(p)) {
    w.push('发现 [Pan left] 这类方括号运镜标签 —— 那是上一代 video-01-director 的语法，H3 请用自然语言句');
  }

  // 4) 负面提示词在本地 cfg=1 下会反噬
  const negScan = scanSuppressionPlacement(p);
  if (negScan.violation) w.push(negScan.violation);

  // 5) 正文非英文（中文只允许出现在 <d> 内与画面文字的双引号内）
  const outsideDialogue = p
    .replace(/<d>[\s\S]*?<\/d>/g, '')
    .replace(/"[^"]*"/g, '"..."');
  const cjk = (outsideDialogue.match(/[\u4e00-\u9fa5]/g) || []).length;
  const latin = (outsideDialogue.match(/[A-Za-z]/g) || []).length;
  if (cjk > 10 && cjk > latin * 0.15) {
    w.push(
      `正文里有 ${cjk} 个中文字符 —— 官方提示词规范是 English-only，`
      + '中文只允许出现在 <d>[Chinese] …</d> 台词内。中文正文效果不稳',
    );
  }

  // 6) 结构字段自查
  if (format === 'ref') {
    const order = ['subject_definitions:', 'summary:', 'retention_analysis:', 'detailed_description:', 'overall_soundscape:', 'non_diegetic_music:'];
    let last = -1;
    for (const key of order) {
      const at = p.indexOf(key);
      if (at < 0) {
        w.push(`Ref2VA 缺少官方字段 ${key.replace(':', '')}`);
        continue;
      }
      if (at < last) w.push(`Ref2VA 字段顺序错误：${key.replace(':', '')} 出现在前一个字段之前`);
      last = at;
    }
  } else {
    for (const key of ['integrated_multimodal_description:', 'overall_soundscape:', 'non_diegetic_music:']) {
      if (!p.includes(key)) w.push(`基础格式缺少官方字段 ${key.replace(':', '')}`);
    }
  }

  // 7) 字段名必须半角冒号
  if (/^(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music|integrated_multimodal_description)\s*：/m.test(p)) {
    w.push('字段名后面用了中文冒号 —— 必须是半角英文冒号');
  }

  // 8) 台词标记必须带语言标签
  if (/<d>(?!\[)/.test(p)) {
    w.push('<d> 后面缺语言标签，官方写法是 <d>[Chinese] …</d>');
  }

  return w;
}