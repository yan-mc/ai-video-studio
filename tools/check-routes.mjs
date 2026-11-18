/**
 * 路由一致性检查 —— 前端 SPA / DSH 侧栏入口 / 后端路由三方对齐。
 *
 * 为什么单独做一个检查：这三份列表在三个不同的语言/进程里，没有编译器
 * 能保证它们一致。历史上 client.js 里留着 `script` / `comic` / `mw`
 * 三个**已删除页面**的入口，用户点进去看到的是渲染页（SPA 的
 * parseHash 静默回退），以为"入口坏了"，但没有任何报错。
 *
 * 用法：node tools/check-routes.mjs
 * 退出码：0 一致；1 有偏差。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const problems = [];
const notes = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/* ------------------------------------------------ 1. SPA 的权威路由表 */

const routerSrc = read('app-src/src/router.tsx');

// 抓 `export const ROUTES = [ ... ] as const;` 里的字符串字面量
const routesBlock = /export const ROUTES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(routerSrc);
if (!routesBlock) {
  problems.push('app-src/src/router.tsx：找不到 ROUTES 定义（正则失配，请更新本脚本）');
}
const SPA_ROUTES = routesBlock
  ? [...routesBlock[1].matchAll(/'([a-z0-9_-]+)'/g)].map((m) => m[1])
  : [];

// 旧路由映射
const legacyBlock = /LEGACY_ROUTES[^=]*=\s*\{([\s\S]*?)\};/.exec(routerSrc);
const LEGACY = legacyBlock
  ? Object.fromEntries([...legacyBlock[1].matchAll(/([a-z0-9_-]+)\s*:\s*'([a-z0-9_-]+)'/g)].map((m) => [m[1], m[2]]))
  : {};

notes.push(`SPA ROUTES（${SPA_ROUTES.length}）：${SPA_ROUTES.join(', ')}`);
notes.push(`SPA LEGACY（${Object.keys(LEGACY).length}）：${Object.entries(LEGACY).map(([k, v]) => `${k}→${v}`).join(', ')}`);

/* ------------------------------------------------ 2. App.tsx 的 NAV */

const appSrc = read('app-src/src/App.tsx');
const navKeys = [...appSrc.matchAll(/\{\s*key:\s*'([a-z0-9_-]+)',\s*icon:/g)].map((m) => m[1]);
notes.push(`App.tsx NAV（${navKeys.length}）：${navKeys.join(', ')}`);

// RouteView 的 case 分支
const caseKeys = [...appSrc.matchAll(/case\s+'([a-z0-9_-]+)':/g)].map((m) => m[1]);
notes.push(`App.tsx RouteView case（${caseKeys.length}）：${caseKeys.join(', ')}`);

/* ------------------------------------------------ 3. client.js 的 entries */

const clientSrc = read('client.js');
const entryKeys = [...clientSrc.matchAll(/\{\s*key:\s*'([a-z0-9_-]+)',\s*label:/g)].map((m) => m[1]);
notes.push(`client.js entries（${entryKeys.length}）：${entryKeys.join(', ')}`);

/* ---------------------------------------------------------- 4. 交叉核对 */

const spaSet = new Set(SPA_ROUTES);
const navSet = new Set(navKeys);
const caseSet = new Set(caseKeys);
const entrySet = new Set(entryKeys);

// 4a. client.js 里有 SPA 不认识的 key → 点进去会静默回退（最恶劣）
const legacyKeys = new Set(Object.keys(LEGACY));
for (const k of entrySet) {
  if (spaSet.has(k)) continue;
  if (legacyKeys.has(k)) {
    problems.push(
      `client.js 入口 '${k}' 是已废弃路由（SPA 会重定向到 '${LEGACY[k]}'）。`
      + '请从 entries 里删掉，否则用户点进去看到的是别的页面。',
    );
  } else {
    problems.push(`client.js 入口 '${k}' 在 SPA 的 ROUTES 里不存在 —— 点进去会落到默认页。`);
  }
}

// 4b. SPA 有但 client.js 没给入口 → 用户认为功能不存在
for (const k of spaSet) {
  if (!entrySet.has(k)) problems.push(`SPA 路由 '${k}' 没有出现在 client.js 的 entries 里（侧栏无法直达）。`);
}

// 4c. NAV 与 ROUTES 必须完全一致（导航少一项 = 页面可达但没有入口按钮）
for (const k of spaSet) {
  if (!navSet.has(k)) problems.push(`SPA 路由 '${k}' 不在 App.tsx 的侧边导航 NAV 里。`);
}
for (const k of navSet) {
  if (!spaSet.has(k)) problems.push(`App.tsx NAV 里的 '${k}' 不是合法 SPA 路由。`);
}

// 4d. NAV 里每个 key 都要有 RouteView case，否则渲染 undefined
for (const k of navSet) {
  if (!caseSet.has(k)) problems.push(`App.tsx NAV 里的 '${k}' 在 RouteView 中没有 case 分支（会白屏）。`);
}

// 4e. RouteView 里的 case 也不能是非法路由
for (const k of caseSet) {
  if (!spaSet.has(k)) problems.push(`App.tsx RouteView 的 case '${k}' 不是合法 SPA 路由。`);
}

/* --------------------------------------------------- 5. 后端 API 交叉 */

// 前端 client.ts 里调用的路径 vs 后端 index.js 里声明的路径
const clientTs = read('app-src/src/api/client.ts');
const apiSrc = read('host/api/index.js');

const fePaths = new Set(
  [...clientTs.matchAll(/request<[^>]*>\(\s*'(?:GET|POST|PUT|PATCH|DELETE)'\s*,\s*[`']\/([a-zA-Z0-9_\-/]*)/g)]
    .map((m) => '/' + m[1].replace(/\/$/, '')),
);
const bePaths = new Set(
  [...apiSrc.matchAll(/route\s*===\s*'(\/[a-zA-Z0-9_\-/]+)'/g)].map((m) => m[1]),
);
// 正则/前缀路由（/projects/:id/shots 之类）单独收
const bePrefixes = [...apiSrc.matchAll(/route\.match\(\s*\/\^\\\/([a-zA-Z0-9_\-\\\/]+)/g)].map((m) => m[1]);

notes.push(`前端调用路径（${fePaths.size}），后端精确路由（${bePaths.size}），后端正则路由（${bePrefixes.length}）`);

// 只报"前端调用了、后端完全没有同名前缀"的，避免大量误报
for (const p of fePaths) {
  if (!p) continue;
  const head = p.split('/').filter(Boolean)[0] || '';
  const hit = [...bePaths].some((bp) => bp === p || bp.startsWith(p + '/') || p.startsWith(bp + '/'))
    || bePrefixes.some((pre) => pre.replace(/\\\//g, '/').startsWith(head))
    || [...bePaths].some((bp) => bp.split('/').filter(Boolean)[0] === head);
  if (!hit) problems.push(`前端调用 ${p}，后端未找到对应路由。`);
}

/* ------------------------------------------------------------- 输出 */

console.log('\n===== 路由一致性检查 =====\n');
for (const n of notes) console.log('  · ' + n);

if (problems.length === 0) {
  console.log('\n✅ 三方路由完全一致\n');
  process.exit(0);
}

console.log(`\n❌ 发现 ${problems.length} 处不一致：\n`);
for (const p of problems) console.log('  - ' + p);
console.log('');
process.exit(1);
