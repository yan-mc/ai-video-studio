/**
 * 自研预演服务（预演引擎 port）—— Node HTTP 入口
 *
 * 与闭源预演引擎可执行文件的 HTTP API 契约一致，便于 golden 对照与无缝替换：
 *   GET  /api/health    → { ok, service:"previs-engine", transport:"http", engine:"port" }
 * （注：`service` 的值是既有 API 契约字面量，为兼容既有客户端而保留原样。）
 *   GET  /api/project   → 裸 State { project, runtime, catalog, health, agent_rules }
 *   POST /api/command   { name, arguments } → { ok, result }
 *   POST /api/agent/chat{ messages }        → { ok, result }
 *
 * 环境：
 *   PREVIZ_HOME  数据目录（project.json / history.json）
 *   PREVIZ_HOST  默认 127.0.0.1
 *   PREVIZ_PORT  默认 4318
 *   PREVIZ_WEB   前端目录（默认 ./web，提供预演导演台 UI）
 */
import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import * as cp from 'node:child_process';
import * as url from 'node:url';
import * as crypto from 'node:crypto';
import { engineSource } from './engine.mjs';

const HOME = process.env.PREVIZ_HOME || path.join(process.cwd(), 'data', 'previz');
const HOST = process.env.PREVIZ_HOST || '127.0.0.1';
const PORT = Number(process.env.PREVIZ_PORT || 4318);
const MAX_BODY = 32_000_000;
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = process.env.PREVIZ_WEB || path.join(HERE, 'web');

const { buildService } = engineSource({
  mkdir: fsp.mkdir, readFile: fsp.readFile, rename: fsp.rename, writeFile: fsp.writeFile,
  homedir: os.homedir, dirname: path.dirname, join: path.join,
  createReadStream: fs.createReadStream, access: fsp.access, stat: fsp.stat, createServer: http.createServer,
  extname: path.extname, normalize: path.normalize, resolve: path.resolve, fileURLToPath: url.fileURLToPath,
  spawn: cp.spawn, mkdtemp: fsp.mkdtemp, rm: fsp.rm, tmpdir: os.tmpdir, webcrypto: crypto.webcrypto,
});
const service = buildService({ home: HOME });

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};
/** 把 URL 路径安全解析到 WEB 目录内（拒绝越界与 ..） */
function safeWebPath(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const abs = path.resolve(WEB, '.' + path.posix.normalize(rel));
  const rootWithSep = WEB.endsWith(path.sep) ? WEB : WEB + path.sep;
  if (abs !== WEB && !abs.startsWith(rootWithSep)) return null;
  return abs;
}
function serveStatic(res, urlPath) {
  const abs = safeWebPath(urlPath);
  if (!abs) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden'); }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(abs).pipe(res);
  });
  return undefined;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > MAX_BODY) { reject(new Error('Request body exceeds 2MB')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  const route = u.pathname;
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5173', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' });
      return res.end();
    }
    if (req.method === 'GET' && route === '/api/health') return sendJson(res, 200, { ok: true, service: 'previs-engine', transport: 'http', engine: 'port', home: HOME });
    if (req.method === 'GET' && route === '/api/project') return sendJson(res, 200, await service.execute('director_get_state', {}));
    if (req.method === 'POST' && route === '/api/command') {
      const b = await readBody(req);
      if (!b || typeof b.name !== 'string' || !b.name) return sendJson(res, 400, { ok: false, error: 'Command name is required' });
      try { return sendJson(res, 200, { ok: true, result: await service.execute(b.name, b.arguments || {}) }); }
      catch (e) { return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    }
    if (req.method === 'POST' && route === '/api/agent/chat') {
      const b = await readBody(req);
      if (!Array.isArray(b?.messages) || b.messages.length === 0) return sendJson(res, 400, { ok: false, error: '对话消息不能为空' });
      try { return sendJson(res, 200, { ok: true, result: await service.agentChat(b.messages) }); }
      catch (e) { return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    }
    // 预演导出（port 版新增；sidecar 无此路由）
    if (req.method === 'GET' && route === '/api/frame') {
      const t = u.searchParams.get('timeSec');
      try { return sendJson(res, 200, { ok: true, result: await service.evaluate(t === null ? undefined : Number(t)) }); }
      catch (e) { return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    }
    if (req.method === 'POST' && route === '/api/previz-package') {
      const b = await readBody(req).catch(() => ({}));
      try { return sendJson(res, 200, { ok: true, result: await service.previzPackage(b?.shotId, b?.samples) }); }
      catch (e) { return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    }
    // 导出预演包到磁盘（供渲染器读取）
    if (req.method === 'POST' && route === '/api/export-package') {
      const b = await readBody(req).catch(() => ({}));
      try {
        const pkg = await service.previzPackage(b?.shotId, b?.samples);
        const dir = b?.outDir || path.join(HOME, 'packages');
        await fsp.mkdir(dir, { recursive: true });
        const name = `${b?.shotId || pkg?.shot?.id || 'shot'}.previz.json`;
        const file = path.join(dir, name);
        await fsp.writeFile(file, JSON.stringify(pkg, null, 2), 'utf8');
        return sendJson(res, 200, { ok: true, file, package: pkg });
      } catch (e) { return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    }
    // 静态前端（预演导演台 UI）——放在 API 之后，其余路径都尝试静态
    if (req.method === 'GET') return serveStatic(res, route);
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, HOST, () => {
  process.stderr.write(`PREVIZ (port) stage: http://${HOST}:${PORT}  home=${HOME}\n`);
});
