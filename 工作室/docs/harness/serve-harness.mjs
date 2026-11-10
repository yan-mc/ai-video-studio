/**
 * UI harness 服务器：同源托管客户端 bundle + 反向代理插件 API。
 * 目的：在真实浏览器里渲染 client.js 的 React 组件树，并让它调用真实后端。
 *
 * 用法：node serve-harness.mjs [port]
 *   GET /                        → harness/index.html
 *   GET /client.js 等静态文件     → harness/
 *   ANY /ai-video-studio/api/*   → 代理到 127.0.0.1:12616（插件 Web API，免认证）
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 4477);
const UPSTREAM_HOST = '127.0.0.1';
const UPSTREAM_PORT = Number(process.env.STUDIO_API_PORT || 12616);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function proxy(req, res) {
  const opts = {
    host: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: `${UPSTREAM_HOST}:${UPSTREAM_PORT}` }),
  };
  const up = http.request(opts, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers);
    ur.pipe(res);
  });
  up.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('upstream error: ' + e.message);
  });
  req.pipe(up);
}

function serveStatic(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const abs = path.resolve(HERE, '.' + path.posix.normalize(rel));
  if (abs !== HERE && !abs.startsWith(HERE + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(abs).pipe(res);
  });
  return undefined;
}

http.createServer((req, res) => {
  if (req.url.startsWith('/ai-video-studio/api')) return proxy(req, res);
  return serveStatic(req, res);
}).listen(PORT, '127.0.0.1', () => {
  process.stderr.write(`HARNESS http://127.0.0.1:${PORT}/  (upstream ${UPSTREAM_HOST}:${UPSTREAM_PORT})\n`);
});
