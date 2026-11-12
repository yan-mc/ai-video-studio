// 用真实静态服务验证构建产物：index.html + assets 能否被正确提供
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

const { serveSpa, serveStatic } = await import('../host/static.js');
const dist = path.join(import.meta.dirname, '..', 'app-dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.log('app-dist/index.html 不存在，跳过');
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/luoshu/app')) return serveSpa(req, res, { prefix: '/luoshu/app', distDir: dist }).catch(() => res.end());
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const check = (n, c, e) => { c ? (pass++, console.log('  PASS', n)) : (fail++, console.log('  FAIL', n, e ?? '')); };

// index
const idx = await fetch(`${base}/luoshu/app/`);
const html = await idx.text();
check('index 200', idx.status === 200);
check('标题正确', html.includes('<title>九章工作室</title>'));
check('相对资源路径', html.includes('./assets/'));

// 从 index 里解析出 js/css 并逐个取
const assets = [...html.matchAll(/\.\/assets\/([^"]+)"/g)].map((m) => m[1]);
check('至少 2 个资源', assets.length >= 2, assets.join(','));

for (const a of assets) {
  const r = await fetch(`${base}/luoshu/app/assets/${a}`);
  const buf = Buffer.from(await r.arrayBuffer());
  check(`资源可访问 ${a}`, r.status === 200 && buf.length > 0, `${r.status} ${buf.length}B`);
}

// 无扩展名回退 index
const fb = await fetch(`${base}/luoshu/app/canvas`);
check('无扩展名回退 index', fb.status === 200 && (await fb.text()).includes('<div id="root">'));

// Range 支持（大文件要能 seek）
const jsName = assets.find((a) => a.endsWith('.js'));
if (jsName) {
  const r = await fetch(`${base}/luoshu/app/assets/${jsName}`, { headers: { Range: 'bytes=0-99' } });
  const buf = Buffer.from(await r.arrayBuffer());
  check('Range 206', r.status === 206, r.status);
  check('Range 长度 100', buf.length === 100, buf.length);
  check('Content-Range 头', (r.headers.get('content-range') || '').startsWith('bytes 0-99/'), r.headers.get('content-range'));
}

// HEAD
const head = await fetch(`${base}/luoshu/app/assets/${jsName}`, { method: 'HEAD' });
check('HEAD 200', head.status === 200);
check('HEAD 有 Content-Length', Number(head.headers.get('content-length')) > 0);

server.close();
console.log(`\n结果：PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);