/**
 * REST 路由表。
 *
 * 全部挂在 /luoshu/api 前缀下（handler 路由，绕过 DSH 准入 → 必须自查 security）。
 * 前缀刻意与 DSH 自己的 /api 区分，绝不与 /api/* 冲突（审查实证 401 vs 200）。
 */
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from '../config.js';
import { guard, safeId, safeJoin, getWriteToken, isSameOrigin as _isSameOrigin, isLoopbackHost as _isLoopbackHost } from '../security.js';
import { dirs, projects, newProject, newShot, validateShot, PROFILES, resolutionFor, h3Length, H3_MODEL_SLOTS, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS } from '../store/models.js';
import * as comfy from '../services/comfy-client.js';
import * as seedance from '../services/seedance-client.js';
import { runJob, cancelJob, runtimeStats, markCancelled, CancelledError } from '../services/job-runner.js';
import { newJob, jobs as jobsStore } from '../services/job-store.js';
import { getRuntime } from '../runtime.js';

/* ------------------------------------------------------------- 工具函数 */

async function readJsonBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error(`BAD_JSON: ${e.message}`)); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

/* ------------------------------------------------- 二进制/流 辅助 */

const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

function readRawBody(req, limit = 256 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 极简 multipart/form-data 解析（够用：文件 + 文本字段） */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (m?.[1] || m?.[2] || '').trim();
  if (!boundary) return [];
  const delim = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buf.indexOf(delim);
  if (start < 0) return [];
  start += delim.length;

  for (;;) {
    // 结束标记 --
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;
    // 跳过 CRLF
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;

    const nextDelim = buf.indexOf(delim, start);
    if (nextDelim < 0) break;
    const headEnd = buf.indexOf('\r\n\r\n', start);
    if (headEnd < 0 || headEnd > nextDelim) { start = nextDelim + delim.length; continue; }

    const headers = buf.toString('utf8', start, headEnd);
    const bodyStart = headEnd + 4;
    // 去掉尾部的 CRLF
    let bodyEnd = nextDelim;
    if (buf[bodyEnd - 2] === 0x0d && buf[bodyEnd - 1] === 0x0a) bodyEnd -= 2;

    const nameM = /name="([^"]*)"/i.exec(headers);
    const fileM = /filename="([^"]*)"/i.exec(headers);
    parts.push({
      name: nameM?.[1] || '',
      filename: fileM?.[1] || null,
      data: buf.subarray(bodyStart, bodyEnd),
    });

    start = nextDelim + delim.length;
    if (start >= buf.length) break;
  }
  return parts;
}

function parseRangeHeader(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  if (m[1] === '' && m[2] === '') return null;
  let start; let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(m[1]); end = m[2] === '' ? size - 1 : Number(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { invalid: true };
  }
  if (start > end || start >= size) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

function pipeStream(res, abs, range) {
  const stream = fs.createReadStream(abs, range ? { start: range.start, end: range.end } : {});
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

/* ---------------------------------------------------------------- 路由 */

/**
 * 处理一次 API 请求。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {object} ctx  插件上下文（含 previz 控制器等）
 */
export async function handleApi(req, res) {
  const ctx = getRuntime();
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = url.pathname.replace(/^\/luoshu\/api/, '') || '/';

  try {
    // token 端点必须免 token（SPA / 客户端启动时取）
    // 同时返回 origin：Desktop 下窗口是 dsh-app://app，客户端拿不到真实端口，
    // 必须由 Host 用 webServer.getOrigin() 注入（DSH 端口是 --port 0 随机的）。
    if (req.method === 'GET' && route === '/token') {
      if (!guardNoToken(req)) return sendJson(res, 403, { error: 'FORBIDDEN_ORIGIN' });
      let origin = '';
      try { origin = ctx.webServer?.getOrigin?.() || ''; } catch { /* 可能未绑定 */ }
      return sendJson(res, 200, { token: getWriteToken(), origin });
    }

    const denied = guard(req, route);
    if (denied) return sendJson(res, denied.status, denied.body);

    const cfg = loadConfig();

    /* ---------------- 监测器 / 元信息 ---------------- */
    if (req.method === 'GET' && route === '/monitor') {
      return sendJson(res, 200, await monitorPayload(ctx));
    }
    if (req.method === 'GET' && route === '/meta') {
      return sendJson(res, 200, {
        profiles: PROFILES,
        h3Slots: H3_MODEL_SLOTS,
        nodeTypes: NODE_TYPES.map((t) => ({ type: t, label: NODE_LABELS[t] })),
        assetTypes: ASSET_TYPES.map((t) => ({ type: t, label: ASSET_TYPE_LABELS[t] })),
        assetTypeLabels: ASSET_TYPE_LABELS,
        projectCategories: PROJECT_CATEGORY_LABELS,
        defaultBackend: cfg.defaultBackend,
        defaultProfile: cfg.defaultProfile,
      });
    }
    if (req.method === 'GET' && route === '/health') {
      const [h3, sd] = await Promise.all([
        comfy.health(cfg),
        Promise.resolve({ ok: seedance.isAvailable(cfg) ? true : 'mock', detail: seedance.isAvailable(cfg) ? 'Seedance 已配置' : 'Seedance 走 Mock（无 key）' }),
      ]);
      return sendJson(res, 200, { ok: true, h3, seedance: sd, previz: await previzHealth(ctx) });
    }

    /* ---------------- 配置 ---------------- */
    if (req.method === 'GET' && route === '/config') return sendJson(res, 200, maskConfig(cfg));
    if (req.method === 'POST' && route === '/config') {
      const body = await readJsonBody(req);
      const patch = sanitizeConfigPatch(body);
      resetConfigCache();
      saveConfig(patch);
      return sendJson(res, 200, maskConfig(loadConfig()));
    }

    /* ---------------- 项目 ---------------- */
    if (req.method === 'GET' && route === '/projects') {
      const list = await projects.list();
      return sendJson(res, 200, list.map(projectSummary));
    }
    if (req.method === 'POST' && route === '/projects') {
      const body = await readJsonBody(req);
      const created = newProject(body);
      await projects.upsert(created);
      return sendJson(res, 200, projectSummary(created));
    }
    {
      const m = route.match(/^\/projects\/([^/]+)$/);
      if (m) {
        const id = safeId(decodeURIComponent(m[1]));
        if (req.method === 'GET') {
          const p = await projects.get(id);
          if (!p) return sendJson(res, 404, { error: 'PROJECT_NOT_FOUND' });
          return sendJson(res, 200, p);
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          const p = await projects.get(id);
          if (!p) return sendJson(res, 404, { error: 'PROJECT_NOT_FOUND' });
          const next = { ...p, ...allowedProjectPatch(body), updatedAt: Date.now() };
          await projects.upsert(next);
          return sendJson(res, 200, projectSummary(next));
        }
        if (req.method === 'DELETE') {
          await projects.remove(id);
          return sendJson(res, 200, { ok: true, removed: id });
        }
      }
    }

    /* ---------------- 镜头 ---------------- */
    {
      const m = route.match(/^\/projects\/([^/]+)\/shots$/);
      if (m && req.method === 'GET') {
        const pid = safeId(decodeURIComponent(m[1]));
        return sendJson(res, 200, listShots(pid));
      }
      if (m && req.method === 'POST') {
        const pid = safeId(decodeURIComponent(m[1]));
        const body = await readJsonBody(req);
        const shot = body.shot || newShot(body);
        const saved = upsertShot(pid, shot);
        return sendJson(res, 200, saved);
      }
    }

    /* ---------------- 生成 ---------------- */
    if (req.method === 'POST' && route === '/generate') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId);
      const shots = listShots(pid);
      const shot = shots.find((s) => s.id === body.shotId);
      if (!shot) return sendJson(res, 404, { error: 'SHOT_NOT_FOUND' });

      const backendId = body.backend || shot.backend || cfg.defaultBackend;
      const job = newJob({
        projectId: pid,
        shotId: shot.id,
        backendId,
        prompt: compilePrompt(shot),
        params: {
          durationSec: shot.durationSec,
          ratio: shot.ratio,
          profile: shot.profile,
          seed: Number(body.seed) || 1101,
        },
        mode: shot.mode,
      });
      await jobsStore().upsert(job);

      // 异步执行，立即返回 job
      runJob(job, (running) => executeBackend(running, shot, ctx, cfg)).catch(() => {});
      return sendJson(res, 200, job);
    }
    if (req.method === 'GET' && route === '/jobs') {
      const list = await jobsStore().list();
      return sendJson(res, 200, list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }
    {
      const m = route.match(/^\/jobs\/([^/]+)\/(cancel|retry)$/);
      if (m && req.method === 'POST') {
        const jobId = safeId(decodeURIComponent(m[1]), /^job_[A-Za-z0-9]+$/);
        if (m[2] === 'cancel') {
          const result = await cancelJob(jobId, async (job) => {
            if (job.remoteId && String(job.backendId) === 'h3-local') {
              await comfy.cancelRemote(cfg, job.remoteId);
            }
          });
          return sendJson(res, 200, result);
        }
        // retry
        const old = await jobsStore().get(jobId);
        if (!old) return sendJson(res, 404, { error: 'JOB_NOT_FOUND' });
        const shots = listShots(old.projectId);
        const shot = shots.find((s) => s.id === old.shotId);
        if (!shot) return sendJson(res, 404, { error: 'SHOT_NOT_FOUND' });
        const job = newJob({
          projectId: old.projectId, shotId: old.shotId, backendId: old.backendId,
          prompt: old.prompt, params: old.params, mode: old.mode,
        });
        await jobsStore().upsert(job);
        runJob(job, (running) => executeBackend(running, shot, ctx, cfg)).catch(() => {});
        return sendJson(res, 200, job);
      }
    }

    /* ---------------- 分辨率 / 提示词 ---------------- */
    if (req.method === 'POST' && route === '/resolution') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, resolutionFor(body.profile, body.ratio));
    }
    if (req.method === 'POST' && route === '/h3/length') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, { length: h3Length(body.durationSec, body.fps) });
    }

    /* ---------------- 预演 ---------------- */
    if (req.method === 'GET' && route === '/previz/health') return sendJson(res, 200, await previzHealth(ctx));
    if (req.method === 'POST' && route === '/previz/start') return sendJson(res, 200, await ctx.previz.start());
    if (req.method === 'POST' && route === '/previz/stop') return sendJson(res, 200, await ctx.previz.stop());
    if (req.method === 'GET' && route === '/previz/state') return sendJson(res, 200, await ctx.previz.state());
    if (req.method === 'POST' && route === '/previz/command') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.previz.command(body.name, body.args || {}));
    }

    /* ---------------- H3 工坊 / 成片 ---------------- */
    if (req.method === 'POST' && route === '/h3/workshop/analyze') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.h3.analyze(body));
    }
    if (req.method === 'POST' && route === '/h3/workshop/import') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.h3.importAssets(body));
    }
    if (req.method === 'GET' && route === '/h3/film/status') {
      return sendJson(res, 200, ctx.h3.filmStatus());
    }
    if (req.method === 'POST' && route === '/h3/film/render') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.h3.filmRender(body));
    }

    /* ---------------- 资产 ---------------- */
    if (req.method === 'GET' && route === '/assets') {
      const type = url.searchParams.get('type') || undefined;
      const projectId = url.searchParams.get('projectId') || undefined;
      return sendJson(res, 200, await ctx.assets.list({ type, projectId }));
    }
    if (req.method === 'POST' && route === '/assets/upload') {
      const ct = String(req.headers['content-type'] || '');
      let parts;
      if (ct.includes('multipart/form-data')) {
        const raw = await readRawBody(req, 256 * 1024 * 1024);
        parts = parseMultipart(raw, ct);
      } else {
        return sendJson(res, 400, { error: 'USE_MULTIPART', detail: '请用 multipart/form-data 上传' });
      }
      const fields = {};
      const files = [];
      for (const p of parts) {
        if (p.filename) files.push(p);
        else fields[p.name] = p.data.toString('utf8');
      }
      if (!files.length) return sendJson(res, 400, { error: 'UPLOAD_EMPTY' });

      // 支持字段名 file / files 或任意（取第一个文件）
      const saved = [];
      for (const f of files) {
        try {
          saved.push(await ctx.assets.saveUploaded(f.data, {
            filename: f.filename,
            type: fields.type,
            name: fields.name || f.filename,
            projectId: fields.projectId,
            tag: fields.tag,
            note: fields.note,
          }));
        } catch (e) {
          return sendJson(res, 400, { error: String(e.message || e), file: f.filename });
        }
      }
      return sendJson(res, 200, { ok: true, saved, count: saved.length, fields });
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && route === '/assets/item') {
      const id = url.searchParams.get('id');
      try {
        const abs = await ctx.assets.resolveFile(id);
        const stat = fs.statSync(abs);
        const ext = path.extname(abs).toLowerCase();
        const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
        const range = parseRangeHeader(req.headers.range, stat.size);
        if (range && range.invalid) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
          return res.end();
        }
        if (range) {
          const len = range.end - range.start + 1;
          res.writeHead(206, {
            'Content-Type': mime, 'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
            'Content-Length': len, 'Cache-Control': 'no-store',
          });
          return pipeStream(res, abs, range);
        }
        res.writeHead(200, {
          'Content-Type': mime, 'Content-Length': stat.size,
          'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
        });
        if (req.method === 'HEAD') return res.end();
        return pipeStream(res, abs);
      } catch (e) {
        return sendJson(res, 404, { error: String(e.message || e) });
      }
    }
    if (req.method === 'POST' && route === '/assets/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.assets.remove(body.id));
    }

    /* ---------------- 后处理 ---------------- */
    if (req.method === 'POST' && route === '/post/transcode') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.transcode(body));
    }
    if (req.method === 'POST' && route === '/post/qc') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.qc(body.path));
    }

    return sendJson(res, 404, { error: `UNKNOWN_ROUTE: ${req.method} ${route}` });
  } catch (err) {
    const status = err instanceof CancelledError ? 409 : 500;
    return sendJson(res, status, { error: String(err?.message || err) });
  }
}

/* ------------------------------------------------------------ 辅助实现 */

function guardNoToken(req) {
  // /token 只做 Origin 校验，不需要 token
  return _isLoopbackHost(req) && _isSameOrigin(req);
}

function projectSummary(p) {
  return {
    id: p.id, name: p.name, category: p.category,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
    nodeCount: p.nodeCount || 0,
    rootPath: p.rootPath || '',
    description: p.description || '',
  };
}

function allowedProjectPatch(body) {
  const out = {};
  for (const k of ['name', 'category', 'rootPath', 'description', 'nodes', 'edges', 'viewport', 'nodeCount',
    'scriptProjectName', 'scriptProjectDir', 'comicProjectName', 'comicProjectDir']) {
    if (body && k in body) out[k] = body[k];
  }
  return out;
}

function shotsFile(projectId) {
  return path.join(dirs().root, 'shots', projectId, 'shots.json');
}

export function listShots(projectId) {
  const f = shotsFile(projectId);
  if (!fs.existsSync(f)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function upsertShot(projectId, shot) {
  const f = shotsFile(projectId);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const list = listShots(projectId);
  const next = { ...shot, updatedAt: Date.now() };
  if (!next.id) next.id = newShot().id;
  const idx = list.findIndex((s) => s.id === next.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, f);
  return next;
}

export function compilePrompt(shot) {
  const parts = [];
  if (shot.style) parts.push(`风格：${shot.style}`);
  if (shot.description) parts.push(shot.description);
  if (shot.camera) parts.push(`运镜：${shot.camera}`);
  if (shot.dialogue) parts.push(`台词：${shot.dialogue}`);
  if (shot.sound) parts.push(`环境声：${shot.sound}`);
  if (shot.music) parts.push(`配乐：${shot.music}`);
  if (shot.prompt) parts.push(shot.prompt);
  return parts.join('\n').slice(0, 7000);
}

async function monitorPayload(ctx) {
  const stats = runtimeStats();
  const allJobs = await jobsStore().list();
  const running = allJobs.filter((j) => j.status === 'running').length;
  const queued = allJobs.filter((j) => j.status === 'queued').length;
  const failed = allJobs.filter((j) => j.status === 'failed').length;
  const cfg = loadConfig();
  const [h3] = await Promise.all([comfy.health(cfg)]);
  return {
    jobs: { total: allJobs.length, running, queued, failed, ...stats },
    h3,
    seedance: { mode: seedance.isAvailable(cfg) ? 'real' : 'mock' },
    previz: await previzHealth(ctx),
    disk: diskFree(cfg.dataDir),
    updatedAt: Date.now(),
  };
}

function diskFree(dir) {
  try {
    const st = fs.statfsSync ? fs.statfsSync(dir) : null;
    if (!st) return null;
    return { freeBytes: Number(st.bfree) * Number(st.bsize), totalBytes: Number(st.blocks) * Number(st.bsize) };
  } catch { return null; }
}

async function previzHealth(ctx) {
  try { return await ctx.previz.health(); } catch (e) { return { ok: false, detail: String(e.message || e) }; }
}

/* --------------------------------------------------- 后端执行分发 */

/** 从镜头卡的 previz 绑定里解析出首尾帧/控制视频的绝对路径 */
function resolvePrevizArtifacts(ctx, shot) {
  const out = {};
  const p = shot?.previz;
  if (!p) return out;
  const base = loadConfig().dataDir;
  const abs = (rel) => {
    if (!rel) return '';
    try {
      const a = path.isAbsolute(rel) ? rel : safeJoin(base, rel);
      return fs.existsSync(a) ? a : '';
    } catch { return ''; }
  };
  if (p.firstFramePath) out['{{FIRST_FRAME}}'] = abs(p.firstFramePath);
  if (p.lastFramePath) out['{{LAST_FRAME}}'] = abs(p.lastFramePath);
  if (p.controlVideoPath) out['{{CONTROL_VIDEO}}'] = abs(p.controlVideoPath);
  return out;
}

/**
 * 解析镜头的参考图绝对路径。
 * 来源优先级：shot.refs.images（资产 id 或绝对路径）→ shot.characterRefs。
 * 最多 9 张（H3 ref_images 上限）。
 */
function resolveRefImages(ctx, shot) {
  const cfg = loadConfig();
  const out = [];
  const toAbs = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'string') {
      if (path.isAbsolute(ref)) return fs.existsSync(ref) ? ref : '';
      try {
        // 可能是 dataDir 相对路径（如 assets/asset_xxx.png）
        const a = safeJoin(cfg.dataDir, ref);
        if (fs.existsSync(a)) return a;
      } catch { /* ignore */ }
      return '';
    }
    if (ref && typeof ref === 'object') {
      if (ref.absPath && fs.existsSync(ref.absPath)) return ref.absPath;
      if (ref.rel) {
        try {
          const a = safeJoin(cfg.dataDir, ref.rel);
          if (fs.existsSync(a)) return a;
        } catch { /* ignore */ }
      }
    }
    return '';
  };

  for (const ref of (shot.refs?.images || [])) {
    const a = toAbs(ref);
    if (a) out.push({ key: `{{REF_${out.length + 1}}}`, abs: a });
    if (out.length >= 9) break;
  }
  return out;
}

async function executeBackend(job, shot, ctx, cfg) {
  const prompt = job.prompt || compilePrompt(shot);
  const outputsDir = path.join(cfg.dataDir, 'outputs');

  if (job.backendId === 'h3-local') {
    const wf = ctx.h3.loadWorkflow();
    if (!wf) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3.json');
    const res = resolutionFor(shot.profile, shot.ratio);
    const prof = PROFILES[shot.profile] || PROFILES['P12-draft'];

    // 参考图：从镜头卡的 refs.images 取，暂存进 ComfyUI input
    const refList = resolveRefImages(ctx, shot);
    const staged = comfy.stageToComfyInput(
      cfg,
      Object.fromEntries(refList.map((r) => [r.key, r.abs])),
      job.id,
    );

    const map = {
      '{{PROMPT}}': prompt,
      '{{WIDTH}}': res.width,
      '{{HEIGHT}}': res.height,
      '{{LENGTH}}': h3Length(shot.durationSec),
      '{{STEPS}}': prof.steps,
      '{{FPS}}': 24,
      '{{SEED}}': job.params?.seed ?? 1101,
      '{{REF_IMAGE_SIZE}}': 'match',
      // 有参考图走 ReferenceToVideo（Ref2VA），否则文生视频（FL2VA）
      '{{UNET_NAME}}': refList.length
        ? 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors'
        : 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors',
      '{{CLIP_NAME}}': 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors',
      '{{VAE_NAME}}': 'minimax_h3_video_vae_fp16.safetensors',
      '{{LORA_NAME}}': refList.length
        ? 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors'
        : 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
      '{{LORA_STRENGTH}}': Number(prof.steps) <= 8 ? 1.0 : 0.0,
    };

    // 参考图转成 staged 文件名（LoadImage 只认 input 目录内文件名）
    const names = refList.map((r) => staged[r.key]).filter(Boolean);
    if (names[0]) map['{{REF_IMAGE_1}}'] = names[0];
    if (names[1]) map['{{REF_IMAGE_2}}'] = names[1];

    const wfCopy = structuredClone(wf);

    // 把 ref_images 接到 ReferenceToVideo 节点上（AUTOGROW 用数组形式）
    const refNode = wfCopy['9'];
    if (refNode?.class_type === 'MiniMaxH3ReferenceToVideo') {
      if (names.length === 0) {
        // 没有参考图 → 退回文生视频节点
        wfCopy['9'] = {
          class_type: 'MiniMaxH3ImageToVideo',
          inputs: {
            clip: ['2', 0], vae: ['3', 0], prompt: '{{PROMPT}}',
            width: '{{WIDTH}}', height: '{{HEIGHT}}', length: '{{LENGTH}}',
          },
        };
      } else {
        refNode.inputs.ref_images = names.map((_, i) => [String(20 + i), 0]);
      }
    }
    // 多余的 LoadImage 节点要删掉（未接线会报错）
    for (let i = names.length; i < 2; i++) delete wfCopy[String(20 + i)];

    return comfy.runWorkflow({ cfg, workflow: wfCopy, map, job, outputsDir });
  }

  if (job.backendId === 'seedance-cloud') {
    return seedance.runSeedance({ cfg, job, shot, prompt });
  }

  return seedance.runMock({ cfg, job, shot, prompt });
}


