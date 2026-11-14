/**
 * 重启后安装验证 —— 确认 DSH 加载的是新代码（1.0.1）。
 *
 * 判据（旧代码必然不满足）：
 *   1. GET /luoshu/api/health 含 workflows.ok 与 previz.available
 *   2. GET /luoshu/api/workflows/diagnostics 可访问
 *   3. skills/LICENSE 等新文件在插件目录内可见
 *   4. SPA /luoshu/app/ 可服务
 *   5. 工作流模板真的能被这个进程读到
 *
 * 用法：node tests/postinstall-check.mjs [origin]
 *
 * ⚠️ DSH 用 `--port 0` 启动，**每次重启端口都会变**，所以不要写死端口。
 *    优先级：命令行参数 > DSH_PORT/DSH_HOST_PORT > DSL_GUI_URL > 常见端口探测。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** 从常见位置找 DSH 端口 */
function candidateOrigins() {
  const out = [];
  const push = (u) => { if (u && !out.includes(u)) out.push(u); };
  if (process.argv[2]) push(process.argv[2].replace(/\/$/, ''));
  if (process.env.DSH_PORT) push(`http://127.0.0.1:${process.env.DSH_PORT}`);
  if (process.env.DSH_HOST_PORT) push(`http://127.0.0.1:${process.env.DSH_HOST_PORT}`);
  if (process.env.DSH_GUI_URL) push(String(process.env.DSH_GUI_URL).replace(/\/$/, ''));
  // 环境里若注入了 GUI URL，从中取端口
  for (const k of Object.keys(process.env)) {
    if (/^DSH_.*URL$/i.test(k) && /^https?:\/\//.test(String(process.env[k]))) {
      push(String(process.env[k]).replace(/\/$/, ''));
    }
  }
  // 探测：从当前监听端口里找装了插件的那个
  putLocalCandidates(out);
  return out;
}

function putLocalCandidates(out) {
  // 无依赖获取监听端口：读 /proc 不可用于 Windows，改用常见端口段快速试
  // （不引第三方库；失败会自然跳过）
  const common = [4583, 2051, 7916, 3000, 5173, 8080, 8000];
  for (const p of common) {
    const u = `http://127.0.0.1:${p}`;
    if (!out.includes(u)) out.push(u);
  }
}

const results = [];
const add = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

async function getJson(origin, p, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${origin}${p}`, { signal: ctrl.signal });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return { status: r.status, json, text };
  } finally { clearTimeout(t); }
}

/** 找出真正挂着插件的 origin */
let ORIGIN = '';
let health = null;
const tried = [];
for (const o of candidateOrigins()) {
  try {
    const h = await getJson(o, '/luoshu/api/health');
    tried.push(`${o}(${h.status})`);
    if (h.status === 200 && h.json?.ok !== undefined) { ORIGIN = o; health = h; break; }
  } catch { tried.push(`${o}(不可达)`); }
}

if (!ORIGIN) {
  console.log('❌ 没找到挂着九章工作室插件的 DSH 实例。');
  console.log(`   试过：${tried.join(' · ')}`);
  console.log('   请用 URL 或端口显式指定：node tests/postinstall-check.mjs http://127.0.0.1:<端口>');
  console.log('   或设置环境变量 DSH_PORT=<端口>');
  process.exit(1);
}
console.log(`目标 DSH: ${ORIGIN}\n`);
add('插件已挂载（/luoshu/api/health 可达）', health.status === 200, `HTTP ${health.status}`);

// 1) 新代码标志字段
const h = health.json || {};
add('health 含 workflows 字段（1.0.1 新增）', h.workflows !== undefined, JSON.stringify(h.workflows ?? null));
add('health 含 previz.available（1.0.1 新增）', h.previz?.available !== undefined, String(h.previz?.available));
add('工作流模板就位', h.workflows?.ok === true,
  `h3=${h.workflows?.h3?.exists} image=${h.workflows?.image?.exists} dir=${h.workflows?.h3?.dir ?? ''}`);
add('ComfyUI 可达', h.h3?.ok === true, h.h3?.detail ?? '');

// 2) 新增端点
const diag = await getJson(ORIGIN, '/luoshu/api/workflows/diagnostics');
add('/workflows/diagnostics 可访问（1.0.1 新增）', diag.status === 200 && diag.json?.h3 !== undefined,
  `HTTP ${diag.status}`);

// 3) 元信息与工具面
const meta = await getJson(ORIGIN, '/luoshu/api/meta');
add('/meta 正常', meta.status === 200 && Array.isArray(meta.json?.nodeTypes), `${meta.json?.nodeTypes?.length ?? 0} 节点`);

// 4) SPA
try {
  const r = await fetch(`${ORIGIN}/luoshu/app/`);
  const html = await r.text();
  add('SPA 可服务', r.status === 200 && html.includes('assets/index-'),
    `HTTP ${r.status}${html.match(/assets\/index-[\w-]+\.js/)?.[0] ? ' · ' + html.match(/assets\/index-[\w-]+\.js/)[0] : ''}`);
} catch (e) {
  add('SPA 可服务', false, e.message);
}

// 5) 写令牌（写操作前置条件）
const tok = await getJson(ORIGIN, '/luoshu/api/token');
add('写令牌可获取', Boolean(tok.json?.token), tok.json?.origin ?? '');

// 6) 包内新增文件（确认加载的就是这份代码）
add('LICENSE 已就位（1.0.1 新增）', fs.existsSync(path.join(ROOT, 'LICENSE')));
// 版本断言改为"与 CHANGELOG 最新条目一致"，避免每次发版都改死数字
{
  const pkgVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const latest = changelog.match(/^## \[([\d.]+)\]/m)?.[1] ?? '';
  add('package.json 版本与 CHANGELOG 一致', pkgVer === latest, `pkg=${pkgVer} changelog=${latest}`);
}

console.log('========== 安装验证 ==========');
let pass = 0; let fail = 0;
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? `  · ${r.detail}` : ''}`);
  if (r.ok) pass++; else fail++;
}
console.log('------------------------------');
console.log(`PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
