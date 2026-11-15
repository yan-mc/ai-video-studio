// 临时审计脚本（只读，分析用；审计结束后删除）
import fs from 'node:fs';

const root = 'F:/AI视频/工作室/dsh-jiuzhang-studio/';
const client = fs.readFileSync(root + 'app-src/src/api/client.ts', 'utf8');
const api = fs.readFileSync(root + 'host/api/index.js', 'utf8');

/** 把任意路径模板归一：去 query、把 ${...} 及其后紧跟的非斜杠字面量整体当成一个参数段 */
function norm(p) {
  let s = String(p);
  // 去掉插值表达式（含其内部可能的 ?），整体替换为 [P]
  s = s.replace(/\$\{[^}]*\}/g, '[P]');
  // 去掉 $ 前面的残余尾巴（如 /wardrobe[P] 已 ok）
  // 截断 query（真实 ? 而非 [P]）
  const qi = s.indexOf('?');
  if (qi >= 0) s = s.slice(0, qi);
  // [P] 后紧跟的字面量（比如 /assets[P] 里的 suffix 已在插值内）—— 直接删
  s = s.replace(/\[P\][^/]*/g, '[P]');
  // 结尾多余的 [P]
  return s.replace(/\/+$/, '') || '/';
}

// 客户端：抓所有 '...' 与 `...` 里以 / 开头的路径字面量
const clientPaths = new Set();
const litRe = /(['`])(\/[^'`]*)\1/g;
let m;
while ((m = litRe.exec(client))) {
  const p = m[2];
  if (p.startsWith('/jiuzhang')) continue;
  clientPaths.add(norm(p));
}
clientPaths.add('/token');
clientPaths.add('/assets/upload');

// 后端：字面量路由 + 正则路由
const routes = [];
api.split(/\r?\n/).forEach((l, i) => {
  const r = /route === '([^']+)'/g;
  let x;
  while ((x = r.exec(l))) routes.push({ line: i + 1, path: x[1] });
  const rr = /route\.match\((\/\^[^,]+?\/)\)/g;
  while ((x = rr.exec(l))) routes.push({ line: i + 1, path: x[1], regex: true });
});

const literalNorms = new Set(routes.filter((r) => !r.regex).map((r) => norm(r.path)));

console.log('客户端路径模板数:', clientPaths.size, ' 后端字面量路由数:', literalNorms.size);

console.log('\n=== [方向1] 前端有、后端无 ===');
let miss = 0;
for (const p of [...clientPaths].sort()) {
  if (literalNorms.has(p)) continue;
  // 再看正则路由能否覆盖（粗判：前缀命中）
  const covered = routes.filter((r) => r.regex).some((r) => p.startsWith(r.path.replace(/\\\//g, '/').replace(/\/\^|\$\/$/g, '').split('(')[0]));
  if (!covered) { console.log('  MISSING  ' + p); miss += 1; }
}
if (!miss) console.log('  (无)');

console.log('\n=== [方向2] 后端有、前端无 ===');
const extra = [];
for (const r of routes) {
  if (r.regex) continue;
  const n = norm(r.path);
  const hit = clientPaths.has(n)
    || (n === '/file' ) || (n === '/assets/item')
    || (n === '/token');
  if (!hit) extra.push({ ...r, n });
}
const seen = new Set();
for (const r of extra.sort((a, b) => a.n.localeCompare(b.n))) {
  if (seen.has(r.n)) continue;
  seen.add(r.n);
  console.log('  line ' + r.line + '  ' + r.path);
}
console.log('  合计', seen.size, '条');
