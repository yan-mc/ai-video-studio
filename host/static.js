/**
 * SPA 静态服务 + 通用静态文件（带 Range）。
 *
 * 修复审查发现的两个缺陷：
 *  - 原实现两处裸 pipe() 无 error 监听 → 并发删文件会杀死 Host 进程；
 *  - 416 的 Content-Range 写成 `bytes 0-0/size` → 规范应为 `bytes *&#47;size`。
 *
 * SPA 用 hash 路由，所以不需要把未知路径回退到 index.html；
 * 但只要请求不是已知静态文件且不带扩展名，仍回退 index.html（更稳）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseRangeHeader } from './api/http.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
  '.pma': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function isInside(baseDir, target) {
  const base = path.resolve(baseDir);
  const t = path.resolve(target);
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  return t === base || t.startsWith(prefix);
}

/**
 * 安全头 —— 与 `/file` / `/assets/item` 完全一致。
 *
 * SVG 是可执行文档（内含 <script>），以 image/svg+xml 内联返回等于
 * **同源存储型 XSS**：`/jiuzhang/assets` 服务的是用户可上传的 dataDir/assets，
 * 而该源上挂着全部写接口，令牌可从 /token 取到。
 * 所以任何静态路径下的 `.svg` 都必须强制下载 + nosniff。
 */
function assetSecurityHeaders(abs) {
  const headers = { 'X-Content-Type-Options': 'nosniff' };
  if (path.extname(abs).toLowerCase() === '.svg') {
    headers['Content-Disposition'] = 'attachment; filename="download.svg"';
    headers['Content-Type'] = 'text/plain; charset=utf-8';
  }
  return headers;
}

/** 安全地把文件流写进响应（有 error 监听） */
function pipeFile(res, abs, { start, end } = {}) {
  const size = fs.statSync(abs).size;
  const opts = start === undefined ? {} : { start, end };
  const stream = fs.createReadStream(abs, opts);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'READ_FAILED' }));
    } else {
      try { res.destroy(); } catch { /* ignore */ }
    }
  });
  stream.pipe(res);
}

function isEtagMatch(req, etag) {
  const inm = req.headers['if-none-match'];
  return Boolean(inm) && String(inm) === etag;
}

/**
 * 通用静态服务（带 Range / HEAD / ETag）
 * @param {object} opts.prefix  URL 前缀（用于剥掉）
 * @param {object} opts.baseDir 服务的根目录
 * @param {object} [opts.spaFallback] 找不到时回退该文件（用于 SPA）
 */
export async function serveStatic(req, res, { prefix, baseDir, spaFallback = null }) {
  const url = new URL(req.url, 'http://127.0.0.1');
  /**
   * ⚠️ decodeURIComponent 会抛 `URIError: URI malformed`。
   *
   * 历史缺陷：畸形百分号编码（如 `/jiuzhang/app/%E4%BD/`）让整个函数 reject，
   * 上层只有 `.catch(() => res.destroy())` → 客户端收到 ECONNRESET，
   * 服务器日志里也没有可读错误。这里改成返回 400。
   */
  let rel;
  try {
    rel = decodeURIComponent(url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname);
  } catch {
    return notFound(res, 'BAD_PATH');
  }
  rel = rel.replace(/^\/+/, '');
  if (!rel) rel = 'index.html';

  let abs;
  try {
    abs = path.resolve(baseDir, rel);
  } catch {
    return notFound(res, 'BAD_PATH');
  }
  if (!isInside(baseDir, abs)) return forbidden(res);

  let stat = null;
  try { stat = fs.statSync(abs); } catch { /* missing */ }

  if (stat && stat.isDirectory()) {
    const indexFile = path.join(abs, 'index.html');
    if (fs.existsSync(indexFile)) { abs = indexFile; stat = fs.statSync(indexFile); }
    else return notFound(res, 'DIR_NO_INDEX');
  }

  if (!stat || !stat.isFile()) {
    // SPA 回退：无扩展名路径交给 index.html（hash 路由下不影响正常资源）
    if (spaFallback && !path.extname(rel)) {
      const fb = path.resolve(baseDir, spaFallback);
      if (fs.existsSync(fb)) {
        const fst = fs.statSync(fb);
        res.writeHead(200, {
          'Content-Type': MIME['.html'],
          'Content-Length': fst.size,
          'Cache-Control': 'no-store',
        });
        if (req.method === 'HEAD') return res.end();
        return pipeFile(res, fb);
      }
    }
    return notFound(res, 'NOT_FOUND', rel);
  }

  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const isIndex = path.basename(abs).toLowerCase() === 'index.html';

  if (req.method === 'GET' && !isIndex && isEtagMatch(req, etag)) {
    res.writeHead(304, { ETag: etag });
    return res.end();
  }

  const range = req.method === 'GET' ? parseRangeHeader(req.headers.range, stat.size) : null;
  const secHeaders = assetSecurityHeaders(abs);

  if (range && range.invalid) {
    // 416：规范要求 Content-Range: bytes */size
    res.writeHead(416, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Range': `bytes */${stat.size}`,
      ...secHeaders,
    });
    return res.end(JSON.stringify({ error: 'RANGE_NOT_SATISFIABLE', size: stat.size }));
  }

  const baseHeaders = {
    'Content-Type': mimeOf(abs),
    'Accept-Ranges': 'bytes',
    'Cache-Control': isIndex ? 'no-store' : 'no-cache',
    ...(isIndex ? {} : { ETag: etag }),
    ...secHeaders,
  };

  if (range) {
    const len = range.end - range.start + 1;
    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
      'Content-Length': len,
    });
    if (req.method === 'HEAD') return res.end();
    return pipeFile(res, abs, { start: range.start, end: range.end });
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  return pipeFile(res, abs);
}

/** SPA 专用：总是回退到 index.html（前端靠 GET /token 自己取写令牌） */
export async function serveSpa(req, res, { prefix, distDir }) {
  const url = new URL(req.url, 'http://127.0.0.1');

  /**
   * 目录式路径缺尾斜杠要 301 补上。
   *
   * 为什么必须做：index.html 用相对路径 `./assets/index-xxx.js`（base: './'）。
   * 浏览器按 URL 规范解析相对路径：
   *   /jiuzhang/app/  → /jiuzhang/app/assets/xxx.js   ✅
   *   /jiuzhang/app   → /jiuzhang/assets/xxx.js       ❌ 404
   * 而本函数对两种形态都返回同一份 index.html，于是**不补斜杠的链接会白屏**
   * （#root:empty::after 停在"载入中…"，且没有任何错误提示）。
   * 分享/收藏的裸链接、用户手删斜杠都会踩到。
   */
  const pathname = url.pathname;
  if (!pathname.endsWith('/') && !path.extname(pathname)) {
    res.writeHead(301, { Location: `${pathname}/${url.search}` });
    return res.end();
  }

  let rel;
  try {
    rel = decodeURIComponent(pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname);
  } catch {
    return notFound(res, 'BAD_PATH');
  }
  rel = rel.replace(/^\/+/, '');
  const wantsIndex = !rel || rel === 'index.html' || !path.extname(rel);

  if (wantsIndex) {
    const indexFile = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexFile)) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        '<!doctype html><meta charset="utf-8"><title>九章工作室</title>'
        + '<body style="font:15px/1.6 system-ui;background:#111316;color:#e8e4dc;padding:40px">'
        + '<h1>SPA 尚未构建</h1>'
        + '<p>缺少 <code>app-dist/index.html</code>。请先运行 <code>pnpm build</code>。</p></body>',
      );
    }
    const html = fs.readFileSync(indexFile, 'utf8');
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    return res.end(html);
  }

  return serveStatic(req, res, { prefix, baseDir: distDir });
}

function notFound(res, code, detail) {
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: code, detail }));
}

function forbidden(res) {
  res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'FORBIDDEN_PATH' }));
}