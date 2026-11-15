/**
 * 最终验收脚本 —— 一条命令跑完任务书的 4 条验收。
 *
 *   node tests/acceptance.mjs
 *
 * 1) nodeRegistry / nodeTypes 能导出 26 项
 * 2) isConnectable 单测全过（179 个断言组）
 * 3) 画布源码无硬编码 hex（配色必须走 var(--jz-*)）
 * 4) 构建产物包含 26 个 type key 与画布样式
 *
 * TypeScript 类型检查与 vite 构建由 npm run build 负责（本脚本只读产物做校验），
 * 因此这里不重复调用 tsc/vite，避免一次验收跑两遍构建。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.resolve(ROOT, '../app-dist');

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ ok: true, name, detail });
    console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    results.push({ ok: false, name, detail: err.message });
    console.log(`  ✖ ${name} — ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ---------------------------------------------------------------- 1. 26 项 */

console.log('\n[1/4] 注册表 26 项');

const { NODE_TYPE_KEYS } = await import('../src/canvas/nodeKeys.ts');
const { NODE_REGISTRY } = await import('../src/canvas/nodeRegistry.ts');
const { NODE_PORTS } = await import('../src/canvas/portTypes.ts');

check('NODE_TYPE_KEYS 恰好 26 项', () => {
  assert(NODE_TYPE_KEYS.length === 26, `实际 ${NODE_TYPE_KEYS.length}`);
  return NODE_TYPE_KEYS.length + ' 个 key';
});

check('NODE_REGISTRY 恰好 26 项', () => {
  const n = Object.keys(NODE_REGISTRY).length;
  assert(n === 26, `实际 ${n}`);
  return n + ' 个定义';
});

check('NODE_PORTS 恰好 26 项', () => {
  const n = Object.keys(NODE_PORTS).length;
  assert(n === 26, `实际 ${n}`);
  return n + ' 份端口表';
});

check('三处 key 集合完全一致', () => {
  const a = [...NODE_TYPE_KEYS].sort().join(',');
  const b = Object.keys(NODE_REGISTRY).sort().join(',');
  const c = Object.keys(NODE_PORTS).sort().join(',');
  assert(a === b && b === c, 'key 集合不一致');
  return 'nodeKeys == registry == ports';
});

/* ------------------------------------------------- 2. nodeTypes 映射 26 项 */

console.log('\n[2/4] nodeTypes 组件映射');
const nodesIndex = readFileSync(path.resolve(ROOT, 'src/canvas/nodes/index.ts'), 'utf8');
check('nodes/index.ts 的 nodeTypes 含 26 个映射', () => {
  const start = nodesIndex.indexOf('export const nodeTypes');
  assert(start >= 0, '找不到 nodeTypes');
  const body = nodesIndex.slice(start);
  const entries = [...body.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*[A-Za-z0-9_]+,$/gm)].map((m) => m[1]);
  assert(entries.length === 26, `实际 ${entries.length}：${entries.join(',')}`);
  return entries.length + ' 个组件映射';
});

check('含 __unknown 兜底', () => {
  assert(nodesIndex.includes('__unknown'), '缺 __unknown');
  return 'allNodeTypes 含兜底';
});

/* ------------------------------------------------------------ 3. 无 hex */

console.log('\n[3/4] 配色走 CSS 变量（无硬编码 hex）');
const canvasFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(entry.name)) canvasFiles.push(full);
  }
})(path.resolve(ROOT, 'src/canvas'));

check(`画布源码 ${canvasFiles.length} 个文件无 hex 字面量`, () => {
  const offenders = [];
  for (const f of canvasFiles) {
    const text = readFileSync(f, 'utf8');
    // 排除 rgba()/url()/#锚点；只找 #rrggbb / #rgb 形式的颜色字面量
    for (const m of text.matchAll(/'#[0-9a-fA-F]{3,8}'|"#[0-9a-fA-F]{3,8}"|:\s*#[0-9a-fA-F]{3,8}\s*[;}]/g)) {
      offenders.push(`${path.relative(ROOT, f)}: ${m[0].trim()}`);
    }
  }
  assert(offenders.length === 0, `发现 hex：${offenders.slice(0, 5).join(' | ')}`);
  return '全部 var(--jz-*)';
});

check('canvas.css 引用的 token 都存在于 tokens.css', () => {
  const tokens = readFileSync(path.resolve(ROOT, 'src/ui/tokens.css'), 'utf8');
  const css = readFileSync(path.resolve(ROOT, 'src/canvas/canvas.css'), 'utf8');
  const defined = new Set([...tokens.matchAll(/^\s*(--jz-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const missing = [];
  for (const m of css.matchAll(/var\((--jz-[a-z0-9-]+)/g)) {
    if (!defined.has(m[1])) missing.push(m[1]);
  }
  assert(missing.length === 0, `未定义的 token：${[...new Set(missing)].join(', ')}`);
  return '无缺失 token';
});

/* ------------------------------------------------------- 4. 构建产物校验 */

console.log('\n[4/4] 构建产物');
check('app-dist 存在（build 已跑过）', () => {
  assert(existsSync(DIST), `缺少 ${DIST}，请先 npm run build`);
  return DIST;
});

check('产物 JS 含全部 26 个 type key', () => {
  const assets = path.join(DIST, 'assets');
  const js = [...readdirSync(assets)].filter((f) => f.endsWith('.js'));
  assert(js.length > 0, '缺少 JS 产物');
  const text = js.map((f) => readFileSync(path.join(assets, f), 'utf8')).join('\n');
  const missing = NODE_TYPE_KEYS.filter((k) => !text.includes(`"${k}"`) && !text.includes(`'${k}'`));
  assert(missing.length === 0, `产物缺 key：${missing.join(', ')}`);
  return `${js.length} 个 JS chunk`;
});

check('产物 CSS 含画布样式', () => {
  const assets = path.join(DIST, 'assets');
  const css = [...readdirSync(assets)].filter((f) => f.endsWith('.css'));
  assert(css.length > 0, '缺少 CSS 产物');
  const text = css.map((f) => readFileSync(path.join(assets, f), 'utf8')).join('\n');
  for (const sel of ['.jz-canvas', '.jz-node', '.jz-ctxmenu', '.jz-node__segments']) {
    assert(text.includes(sel), `产物缺样式 ${sel}`);
  }
  return `${css.length} 个 CSS 文件`;
});

/* --------------------------------------------------------------- 测试套件 */

console.log('\n[附] 单元测试套件');
const testRun = spawnSync(
  process.execPath,
  ['--import', './tests/register.mjs', '--test', 'tests/portTypes.test.mjs', 'tests/nodeRegistry.test.mjs', 'tests/graph.test.mjs', 'tests/historyAutosave.test.mjs', 'tests/videoParams.test.mjs', 'tests/verifyNodeTypes.mjs'],
  { cwd: ROOT, encoding: 'utf8' },
);
const out = `${testRun.stdout ?? ''}${testRun.stderr ?? ''}`;
const passMatch = out.match(/ℹ pass (\d+)/);
const failMatch = out.match(/ℹ fail (\d+)/);
check('全部单测通过（含 isConnectable 8+ 组用例）', () => {
  assert(testRun.status === 0, `测试退出码 ${testRun.status}`);
  const pass = Number(passMatch?.[1] ?? 0);
  const fail = Number(failMatch?.[1] ?? 0);
  assert(fail === 0, `${fail} 个失败`);
  assert(pass >= 100, `只跑了 ${pass} 个用例，异常`);
  return `${pass} 个用例全部通过`;
});

/* ------------------------------------------------------------------ 汇总 */

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(56)}`);
if (failed.length === 0) {
  console.log(`✅ 验收通过：${results.length} 项全部成功`);
  process.exit(0);
} else {
  console.log(`❌ 验收失败：${failed.length}/${results.length} 项`);
  for (const f of failed) console.log(`   · ${f.name} → ${f.detail}`);
  process.exit(1);
}