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

function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  const startRaw = m[1];
  const endRaw = m[2];
  if (startRaw === '' && endRaw === '') return null;
  let start;
  let end;
  if (startRaw === '') {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === '' ? size - 1 : Number(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { invalid: true };
  }
  if (start > end || start >= size) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
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
  let rel = decodeURIComponent(url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname);
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

  const range = req.method === 'GET' ? parseRange(req.headers.range, stat.size) : null;

  if (range && range.invalid) {
    // 416：规范要求 Content-Range: bytes */size
    res.writeHead(416, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Range': `bytes */${stat.size}`,
    });
    return res.end(JSON.stringify({ error: 'RANGE_NOT_SATISFIABLE', size: stat.size }));
  }

  const baseHeaders = {
    'Content-Type': mimeOf(abs),
    'Accept-Ranges': 'bytes',
    'Cache-Control': isIndex ? 'no-store' : 'no-cache',
    ...(isIndex ? {} : { ETag: etag }),
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

/** SPA 专用：总是回退到 index.html，并把写 token 注入页面 */
export async function serveSpa(req, res, { prefix, distDir }) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname);
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