/**
 * 面板 harness 服务器 —— 用**真实 client.js** 渲染 DSH 侧栏面板，并把它接到真实插件 API。
 *
 * 为什么需要：DSH 主文档（http://127.0.0.1:<port>/）需要认证，外部浏览器打不开；
 * 而插件面板是 `main` 槽位的 React 组件，只有放进 DSH 运行时才渲染得出来。
 * 这里只替换 DSH 的**运行时外壳**（模块加载器 + React 入口 + 令牌），
 * client.js 逐字节原样加载，API 全部打到真实的 DSH 端口，因此验证的是真实组件树与真实数据。
 *
 * 用法：
 *   node serve-panel.mjs [port] [dshOrigin]
 *   node serve-panel.mjs 4478 http://127.0.0.1:11712
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 4478);
const UPSTREAM = (process.argv[3] || process.env.DSH_ORIGIN || 'http://127.0.0.1:11712').replace(/\/$/, '');
const UP = new URL(UPSTREAM);

const PLUGIN_ROOT = path.resolve(HERE, '..', '..');
const HARNESS_ROOT = path.resolve(HERE, '..', 'harness');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/** 把请求转发到真实 DSH，改写 Host/Origin 让它通过插件的同源校验 */
function proxy(req, res) {
  const headers = { ...req.headers, host: UP.host, origin: UPSTREAM };
  delete headers['accept-encoding'];
  const up = http.request({
    host: UP.hostname,
    port: UP.port || 80,
    path: req.url,
    method: req.method,
    headers,
  }, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers);
    ur.pipe(res);
  });
  up.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('upstream error: ' + e.message);
  });
  req.pipe(up);
}

function serveFile(res, abs) {
  let st;
  try { st = fs.statSync(abs); } catch { st = null; }
  if (!st || !st.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found: ' + path.basename(abs));
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': 'no-store',
  });
  return fs.createReadStream(abs).pipe(res);
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');

  // 插件 API → 真实 DSH
  if (u.pathname.startsWith('/jiuzhang/api')) return proxy(req, res);

  // 面板本体：用插件仓库里真实的 client.js（不是副本）
  if (u.pathname === '/client.js') return serveFile(res, path.join(PLUGIN_ROOT, 'client.js'));

  // React UMD（本目录自带一份 18.3.1，与 DSH 客户端同版本）
  if (u.pathname === '/react.js') return serveFile(res, path.join(HERE, 'react.js'));
  if (u.pathname === '/react-dom.js') return serveFile(res, path.join(HERE, 'react-dom.js'));

  if (u.pathname === '/' || u.pathname === '/index.html') {
    return serveFile(res, path.join(HERE, 'index.html'));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  return res.end('Not found');
}).listen(PORT, '127.0.0.1', () => {
  process.stderr.write(`PANEL-HARNESS http://127.0.0.1:${PORT}/  (upstream ${UPSTREAM})\n`);
});
