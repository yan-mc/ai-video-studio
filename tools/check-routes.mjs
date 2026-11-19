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

// 前端 client.ts 里调用的（方法 + 路径），以及后端 index.js 里声明的（方法 + 路径）
const clientTs = read('app-src/src/api/client.ts');
const apiSrc = read('host/api/index.js');

/**
 * ⚠️ 旧实现有三个致命缺陷，导致这个脚本**对真 404 的检出率为 0**：
 *
 *  1) 匹配条件里有 `bp.split('/')[0] === head` —— 只要**首段同名**就算通过。
 *     于是 `/post/doesnotexist`、`/blender/whatever`、`/assets/archiveKKK`
 *     全部"一致"，而它们在真实后端都是 404。
 *  2) 正则 `request<[^>]*>` 遇到含 `>` 的泛型（`Record<string, unknown>`）
 *     就提前截断，漏掉 6 条真实路径。
 *  3) 不校验 HTTP 方法 —— `bePaths` 只有路径，没有任何 method 信息。
 *
 * 现在的做法：
 *  · 前端按**整行**匹配，取引号/反引号包住的那一段路径（平衡匹配，不截断）；
 *  · 模板插值 `${...}` 折叠成 `:id`，查询串 `?x=y` 整段剥掉；
 *  · 后端同时收「精确路由」「(method||method) 路由」「正则路由」「startsWith 前缀」；
 *  · 比对时允许"前端路径落在后端某个路由族下"（参数化路由的正则无法静态还原成
 *    单一模板，按族判断是唯一可靠的近似）；
 *  · **不再**按首段兜底——那一步把检出率变成了 0。
 */

/** 前端路径归一：`${...}` → :id，去查询串、去尾斜杠 */
function normalizeFePath(p) {
  return p
    .replace(/\$\{[^}]*\}/g, ':id')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '') || '/';
}

/** 把 `/projects/abc/shots` 归一成 `/projects/:id/shots` */
function normalizePath(p) {
  return p
    .replace(/\/[A-Za-z0-9_-]{8,}(?=\/|$)/g, '/:id')
    .replace(/\/:[A-Za-z0-9_]+/g, '/:id');
}

/** 该路径是否落在某个后端路由"族"下（/projects/:id/shots ⊂ /projects/:id） */
function underRouteFamily(fePath, bePath) {
  const a = fePath.split('/').filter(Boolean);
  const b = bePath.split('/').filter(Boolean);
  if (!b.length) return false;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const seg = b[i];
    if (seg.startsWith(':') || seg.startsWith('(')) continue;   // 后端参数段：任意值都算匹配
    if (a[i] !== seg) return false;
  }
  return true;
}

const feRoutes = new Map();
for (const line of clientTs.split(/\r?\n/)) {
  const m = /request<[\s\S]*?>\(\s*'(GET|POST|PUT|PATCH|DELETE)'\s*,\s*(`[^`]*`|'[^']*')/.exec(line);
  if (!m) continue;
  const raw = m[2].slice(1, -1);
  if (!raw.startsWith('/')) continue;
  const path = normalizeFePath(raw);
  feRoutes.set(`${m[1]} ${normalizePath(path)}`, `${m[1]} ${path}`);
}
// 模板字符串 / 直连 URL（/file、/events 等）单独收
for (const m of clientTs.matchAll(/`\$\{base\}\(\/[a-zA-Z0-9_\-/]+/g)) {
  const raw = m[0].slice(m[0].indexOf('(') + 1);
  feRoutes.set(`GET ${normalizePath(raw)}`, `GET ${raw}`);
}

const beRoutes = new Map();   // "METHOD /path" -> 原始
{
  // 精确路由：`if (req.method === 'GET' && route === '/x')`
  for (const m of apiSrc.matchAll(/req\.method\s*===\s*'(GET|POST|PUT|PATCH|DELETE)'\s*&&\s*route\s*===\s*'(\/[a-zA-Z0-9_\-/]+)'/g)) {
    beRoutes.set(`${m[1]} ${m[2]}`, `${m[1]} ${m[2]}`);
  }
  // OR 合并的方法：`(req.method === 'GET' || req.method === 'HEAD') && route === '/file'`
  for (const m of apiSrc.matchAll(/\((?:req\.method\s*===\s*'(\w+)'\s*\|\|\s*)+req\.method\s*===\s*'(\w+)'\)\s*&&\s*route\s*===\s*'(\/[a-zA-Z0-9_\-/]+)'/g)) {
    for (const meth of m[1] ? [m[1], m[2]] : [m[2]]) {
      beRoutes.set(`${meth} ${m[3]}`, `${meth} ${m[3]}`);
    }
  }
  // 参数化路由：`route.match(/^\/projects\/([^/]+)$/)` + 内部按 method 分支
  for (const m of apiSrc.matchAll(/route\.match\(\s*\/\^\\\/([a-zA-Z0-9_\-\\\/]+)/g)) {
    const tpl = normalizePath('/' + m[1].replace(/\\\//g, '/').replace(/\(\?:.*?\)/g, ':id').replace(/\(\^\|\$\)/g, ''));
    for (const meth of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      beRoutes.set(`${meth} ${tpl}`, `${meth} ${tpl}（正则路由）`);
    }
  }
  // startsWith 型前缀路由（/nanfeng/presets/:id 之类）
  for (const m of apiSrc.matchAll(/route\.startsWith\('(\/[a-zA-Z0-9_\-/]+)'\)/g)) {
    for (const meth of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      beRoutes.set(`${meth} ${normalizePath(m[1])}`, `${meth} ${m[1]}（前缀路由）`);
    }
  }
}

notes.push(`前端调用（${feRoutes.size} 条 method+path），后端路由（${beRoutes.size} 条）`);

/**
 * A 类：前端调用了、后端没有（真 404）。
 *
 * 匹配顺序：① (method, path) 完全一致 → ② 落在某个后端路由族下
 * （参数化路由无法静态还原成单一模板，按族判断）。
 */
const feKeys = [...feRoutes.entries()];
const beByMethod = new Map();
for (const [key, raw] of beRoutes) {
  const [meth, path] = key.split(' ');
  if (!beByMethod.has(meth)) beByMethod.set(meth, []);
  beByMethod.get(meth).push({ path, raw });
}

for (const [key, raw] of feKeys) {
  if (beRoutes.has(key)) continue;
  const [meth, fePath] = key.split(' ');
  const family = (beByMethod.get(meth) ?? []).find((b) => underRouteFamily(fePath, b.path));
  if (!family) {
    problems.push(`前端调用 ${raw}，后端没有对应的 ${meth} 路由（也没有可归属的路由族）。`);
  }
}

// B 类：后端有、前端与 Agent 工具都没用（潜在死路由，只提示不报错）
const toolsSrc = read('host/tools.js');
const shadowed = new Set();
for (const [key, raw] of feRoutes) {
  if (beRoutes.has(key)) shadowed.add(key);
}
const deadRoutes = [];
for (const [key, raw] of beRoutes) {
  if (shadowed.has(key)) continue;
  // 路径文本是否在 tools.js 里出现过（Agent 工具直接调 service，不经过 REST，
  // 这里只做"名字是否被提及"的弱检查）
  const pathOnly = key.split(' ')[1];
  if (pathOnly.includes(':id')) continue;          // 参数化路由无法可靠判定
  if (toolsSrc.includes(pathOnly)) continue;
  deadRoutes.push(raw);
}
if (deadRoutes.length) {
  notes.push(`后端有、前端与工具都不直接调用的路由（${deadRoutes.length} 条，仅供外部脚本/诊断）：`
    + deadRoutes.slice(0, 8).join('、') + (deadRoutes.length > 8 ? ' …' : ''));
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
