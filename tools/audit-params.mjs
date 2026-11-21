/**
 * 参数有效性静态审计 —— 逐项判断 221 个参数在南风 V15 源码里是否真的被读取。
 *
 * 为什么需要这个工具：
 *   「哪些参数有用」不能靠读注释猜，也不能只 grep `kwargs.get("名字")` ——
 *   南风有一大批参数是**函数形参按位置读**的（`def generate(..., 采样步数=20, ...)`），
 *   还有一批是**动态族**（`kwargs.get(f"图片{i}")` / `kwargs.get(f"LoRA{index}")`）。
 *   只 grep 字面量会把它们全误判为死参数。
 *
 * 判据（命中任一即视为「有读取」）：
 *   1. kwargs.get("<名字>") / kwargs["<名字>"]  字面量读取
 *   2. generate() 签名里的同名形参（含类型注解形式）
 *   3. 动态族模板：图片{i} / 视频{i} / 音频{i} / LoRA{i}{强度,启用} / 人物{i}{身份参考,图中位置}
 *
 * 另外标注「被读取但被硬编码关闭」——这类参数有消费代码，但上游把开关写死了。
 *
 * 用法：node tools/audit-params.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const VENDOR = path.join(ROOT, 'vendor/nanfeng/h3_generator.py');

const src = fs.readFileSync(VENDOR, 'utf8');
/**
 * 同名参数还可能被**兄弟模块**读取：
 *   · nanfeng_sampler.py   → `kw.get(key)`，key 来自 FIELDS 的 '南风ER_*' 字面量
 *   · dlss_output.py       → `kw.get(f'DLSS_{prefix}_{k}')`
 *   · trt_options.py / continuation_audio_refine.py 同理
 * 只审 h3_generator.py 会把它们误判成死参数。
 */
const siblingFiles = [
  'nanfeng_sampler.py', 'dlss_output.py', 'trt_options.py',
  'continuation_audio_refine.py', 'native_audio_lock.py', 'nodes.py',
];
const siblingSrc = siblingFiles
  .map((f) => {
    try { return fs.readFileSync(path.join(path.dirname(VENDOR), f), 'utf8'); } catch { return ''; }
  })
  .join('\n');
const { PARAMS, GROUPS } = await import(`file://${path.join(ROOT, 'host/services/nanfeng/schema.js').replace(/\\/g, '/')}`);
const { PARAM_DOCS } = await import(`file://${path.join(ROOT, 'host/services/nanfeng/param-docs.js').replace(/\\/g, '/')}`);

/* ---------------------------------------------------------- 辅助判断 */

/** 转义正则元字符 */
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** generate() 的形参列表文本 */
function generateSignature() {
  /**
   * ⚠️ 必须支持**跨行**签名。
   *    南风 V15 的 `def generate(...)` 横跨 4 行（模型/文本编码器… 一长串），
   *    只写在单行里的正则会把整批"按位置读"的参数误判成死参数 ——
   *    实测 G 组 LoRA、A 组核心参数、L 组采样器全部踩过这个坑。
   */
  const m = /def generate\(([\s\S]{0,3000}?)\)\s*(?:->[^\n:]*)?:/.exec(src);
  return m ? m[1] : '';
}
const SIG = generateSignature();

/**
 * 上游硬编码关闭的标志 —— 命中说明该参数虽然有消费代码，但走不到。
 * 每条都带源码行号依据。
 */
const HARD_OFF = [
  {
    marker: 'sigma_requested = False',
    // 1687
    affects: ['视频西格玛偏移', '音频西格玛偏移', '西格玛模式', '低西格玛开始', '低西格玛结束', '手动西格玛'],
    reason: 'h3_generator.py:1687 `sigma_requested = False` 硬编码，sigma_enabled 恒 False',
  },
  {
    marker: 'hd_second_pass = False',
    // 1689
    affects: ['启用高清二采', '二采百万像素', '二采放大方法', '二采步数', '二采降噪',
      '二采采样器', '二采调度器', '二采模型', '二采起始Sigma', '一采步数'],
    reason: 'h3_generator.py:1689 `hd_second_pass = False`，整条旧高清二采分支不执行',
  },
  {
    marker: 'elif False:',
    // 1796
    affects: ['启用双采样', '双采后段比例', '双采后段采样器'],
    reason: 'h3_generator.py:1796 `elif False:`，V4 双采样分支写死关闭',
  },
  {
    marker: 'sol_enabled = False',
    // 1472-1473
    affects: ['启用SolAttn', 'SolAttn_tau', 'SolAttn阈值类型', 'SolAttn精确模式',
      'SolAttn完整末步', 'SolAttn末段比例', 'SolAttn前缀Token', '启用T8缓存', 'T8残差阈值',
      'T8开始比例', 'T8结束比例', 'T8连续命中', 'T8缓存设备', 'T8指标步幅', 'T8详细日志'],
    reason: 'h3_generator.py:1472-1473 无条件置 sol_enabled/t8_enabled = False',
  },
];

/* ------------------------------------------------------- 逐个参数判定 */

const rows = [];

for (const [name, def] of Object.entries(PARAMS)) {
  const reasons = [];

  // 1) 字面量 kwargs.get
  const kwCount = (src.match(new RegExp(`kwargs\\.get\\(\\s*["']${esc(name)}["']`, 'g')) || []).length;
  if (kwCount) reasons.push(`kwargs.get×${kwCount}`);

  // 2) generate() 形参（按位置读的那批）
  const asParam = new RegExp(`(?:^|[,(\\s])${esc(name)}\\s*[=:,)]`).test(SIG);
  if (asParam) reasons.push('函数形参');

  /**
   * 3) 直接变量引用（非 kwargs.get 形式）。
   *
   * 南风有一批参数是在函数体里以**裸变量名**使用的（`sampler_node(g, 采样器, kwargs)`），
   * 或包在 `True and bool(kwargs.get(...))` 里的。只看 kwargs.get 会漏掉它们。
   * 这里在"非 schema 声明行"之外再做一次裸名匹配。
   */
  const bodyAfterSig = src.slice(src.indexOf(SIG) + SIG.length);
  const bareUse = new RegExp(`(?:^|[,(\\s!&=])${esc(name)}(?=[,\\s)\\]&|]|$)`, 'm').test(bodyAfterSig);
  if (bareUse) reasons.push('裸名引用');

  // 3b) 兄弟模块里的字面量引用（南风 ER / DLSS / TRT / 音频精修）
  if (!reasons.length && siblingSrc) {
    const inSibling = new RegExp(`["']${esc(name)}["']`).test(siblingSrc);
    if (inSibling) reasons.push('兄弟模块引用');
  }

  // 3) 动态族
  const dynMap = [
    [/^图片(\d+)$/, (i) => [`kwargs.get(f"图片{i}")`, 'kwargs.get(f"图片{index}")', 'for i in range(1, 10)']],
    [/^视频(\d+)$/, (i) => ['f"视频{i}"', 'for i in range(1, 4)']],
    [/^音频(\d+)$/, (i) => ['f"音频{i}"', 'for i in range(1, 4)']],
    [/^LoRA(\d+)$/, () => ['f"LoRA{index}"']],
    [/^LoRA(\d+)强度$/, () => ['f"LoRA{index}强度"']],
    [/^LoRA(\d+)启用$/, () => ['f"LoRA{index}启用"']],
    [/^人物(\d+)身份参考$/, () => ['identity_slots']],
    [/^人物(\d+)图中位置$/, () => ['identity_positions']],
  ];
  for (const [pat, probes] of dynMap) {
    if (pat.test(name) && probes().some((p) => src.includes(p))) {
      reasons.push('动态族');
      break;
    }
  }

  // 4) 上游硬编码关闭
  let hardOff = null;
  for (const rule of HARD_OFF) {
    if (rule.affects.includes(name) && src.includes(rule.marker)) {
      hardOff = rule.reason;
      break;
    }
  }

  // 5) 依赖缺失（节点不在 ComfyUI 里）
  const doc = PARAM_DOCS[name] ?? {};
  const banned = doc.flag === 'banned';

  let cls;
  if (hardOff) cls = 'C';          // 上游硬编码关闭
  else if (banned) cls = 'D';      // 本机缺依赖
  else if (!reasons.length) cls = 'C';   // 完全无读取
  else cls = 'A';                  // 有效

  rows.push({
    name, group: def.group, type: def.type, default: def.default,
    cls, evidence: reasons.join(','), hardOff, zh: doc.zh ?? '',
  });
}

/* ---------------------------------------------- B 类：有效+默认关闭+有收益 */

/**
 * 「买回来没用上」的功能开关 —— 有效（A 类）但默认 false，
 * 且开起来确实有收益。数组里每条都注明收益与代价。
 */
const B_CANDIDATES = {
  '启用H3潜空间放大二采': '唯一真正有效的画质提升路径（一采→潜空间放大→二采）',
  启用运行时预留显存: '12GB 卡唯一有效的省显存手段，比关加速都管用',
  启用UniBlockSwap: '真能省显存（已核实 h3_generator.py:1546 有消费）',
  启用TAEH3彩色预览: 'TAE 快速解码彩色预览，省完整 VAE 解码时间',
  启用续写音频精修: '消除续写接缝处的爆音/咔哒声',
  启用锁音频: '把参考音频原封不动作为输出音轨（口型对齐/音乐卡点必用）',
  开启音频驱动模式: '用音频打点驱动画面节奏与分段',
  启用潜空间续写: '跨镜头无缝续接，长视频的唯一正确做法',
};

for (const r of rows) {
  if (B_CANDIDATES[r.name] && r.cls === 'A' && r.default === false) {
    r.cls = 'B';
    r.benefit = B_CANDIDATES[r.name];
  }
}

/* -------------------------------------------------------------- 输出 */

const counts = rows.reduce((a, r) => { a[r.cls] = (a[r.cls] || 0) + 1; return a; }, {});

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ counts, groups: GROUPS, rows }, null, 2));
} else {
  const LABEL = {
    A: '有效（默认值合理）',
    B: '有效但默认没开（有收益，建议开）',
    C: '死参数（上游硬编码关闭 / 完全无读取）',
    D: '缺依赖（本机未装节点，开了报错）',
  };
  console.log('\n===== 南风 V15 · 221 参数有效性审计 =====\n');
  for (const k of ['A', 'B', 'C', 'D']) {
    console.log(`  ${k} · ${LABEL[k]}：${counts[k] ?? 0} 个`);
  }
  console.log(`\n  合计：${rows.length} 个`);
  console.log(`  真正可用：${(counts.A ?? 0) + (counts.B ?? 0)} 个 / ${rows.length}`
    + `（${(((counts.A ?? 0) + (counts.B ?? 0)) / rows.length * 100).toFixed(0)}%）`);

  console.log('\n--- B 类：有效但默认没开 ---\n');
  for (const r of rows.filter((x) => x.cls === 'B')) {
    console.log(`  [${r.group}] ${r.name}`);
    console.log(`        收益：${r.benefit}`);
  }

  console.log('\n--- C 类：死参数 ---\n');
  const cGroups = {};
  for (const r of rows.filter((x) => x.cls === 'C')) {
    (cGroups[r.group] ||= []).push(r);
  }
  for (const [g, list] of Object.entries(cGroups)) {
    console.log(`  ${g} 组（${list.length}）: ${list.map((r) => r.name).join(', ')}`);
    const reasons = [...new Set(list.map((r) => r.hardOff).filter(Boolean))];
    for (const rsn of reasons) console.log(`      ↳ ${rsn}`);
  }

  console.log('\n--- D 类：缺依赖 ---\n');
  const dGroups = {};
  for (const r of rows.filter((x) => x.cls === 'D')) (dGroups[r.group] ||= []).push(r.name);
  for (const [g, list] of Object.entries(dGroups)) {
    console.log(`  ${g} 组（${list.length}）`);
  }
  console.log('');
}

process.exit(0);