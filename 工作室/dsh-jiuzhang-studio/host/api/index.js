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
import { runH3Local, runH3ImageLocal, jobKind } from '../services/generator.js';
import { packGraph, unpackGraph, IMG_REF_PREFIX } from '../store/image-pool.js';
import { SCRIPT_GENRES, SCRIPT_STAGES, checkConsistency } from '../services/script-service.js';
import { COMIC_TEMPLATES, COMIC_STATIONS } from '../services/comic-service.js';
import { DIRECTOR_COMMANDS, CAMERA_MOVES, DIRECTOR_FPS } from '../services/director3d.js';
import { compileH3Prompt, toShotInputPackage, STYLE_PRESETS, H3_MODES, H3_LIMITS } from '../services/h3-prompt.js';
import { H3_IMAGE_MODELS, H3_IMAGE_SIZES, IMAGE_VAE, IMAGE_CLIP, IMAGE_SAMPLING, checkImageModels } from '../services/h3-image.js';
import { BREAKDOWN_LEVELS, BREAKDOWN_SIZES, buildBreakdownPrompt, breakdownLevel, breakdownSize } from '../services/breakdown.js';
import { findBrowser, screenshotPreviz, cropWithFfmpeg, buildPrevizStylePrompt } from '../services/previz-shot.js';
import { resolveFfmpeg } from '../services/seedance-client.js';
import { createCanvasAgent } from '../services/canvas-agent.js';
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
          // 读盘时把 __img_ref__ 还原成图片本体（对前端透明）
          return sendJson(res, 200, unpackProject(p));
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          const p = await projects.get(id);
          if (!p) return sendJson(res, 404, { error: 'PROJECT_NOT_FOUND' });
          const merged = { ...p, ...allowedProjectPatch(body), updatedAt: Date.now() };
          // 写盘前把内联图片抽进 imagePool（否则项目 JSON 会膨胀百倍）
          const packed = packProject(merged, p.imagePool);
          await projects.upsert(packed);
          return sendJson(res, 200, projectSummary(packed));
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

    /* ---------------- 剧本创作 ---------------- */
    if (req.method === 'GET' && route === '/script/meta') {
      return sendJson(res, 200, { genres: SCRIPT_GENRES, stages: SCRIPT_STAGES });
    }
    if (req.method === 'GET' && route === '/script') {
      const pid = safeId(url.searchParams.get('projectId') || '');
      return sendJson(res, 200, ctx.script.load(pid));
    }
    if (req.method === 'POST' && route === '/script/stage') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      const stage = String(body.stage || '');
      return sendJson(res, 200, await ctx.script.runStage(pid, stage, body));
    }
    if (req.method === 'POST' && route === '/script/runAll') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, await ctx.script.runAll(pid, body));
    }
    if (req.method === 'POST' && route === '/script/check') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      const doc = ctx.script.load(pid) ?? {};
      return sendJson(res, 200, checkConsistency(doc, { limit: body.limit ?? 10 }));
    }
    if (req.method === 'POST' && route === '/script/save') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, ctx.script.save(pid, body.doc ?? {}));
    }

    /* ---------------- 漫画工作台 ---------------- */
    if (req.method === 'GET' && route === '/comic/meta') {
      return sendJson(res, 200, { templates: COMIC_TEMPLATES, stations: COMIC_STATIONS });
    }
    if (req.method === 'GET' && route === '/comic') {
      const pid = safeId(url.searchParams.get('projectId') || '');
      return sendJson(res, 200, ctx.comic.load(pid));
    }
    if (req.method === 'POST' && route === '/comic/extract') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, await ctx.comic.extract(pid, body));
    }
    if (req.method === 'POST' && route === '/comic/relayout') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, await ctx.comic.relayoutPage(pid, Number(body.pageIndex) || 1, String(body.template)));
    }
    if (req.method === 'POST' && route === '/comic/preflight') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, ctx.comic.runPreflight(pid));
    }
    if (req.method === 'POST' && route === '/comic/export/page') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      const r = ctx.comic.exportPageSvg(pid, Number(body.pageIndex) || 1, body.options ?? {});
      // 不把 SVG 正文塞进 JSON（可能很大），只回元信息 + 可通过 /file 取
      return sendJson(res, 200, { ok: r.ok, path: r.path, rel: r.rel, bytes: r.bytes });
    }
    if (req.method === 'POST' && route === '/comic/export/all') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, ctx.comic.exportAllSvg(pid, body.options ?? {}));
    }

    /* ---------------- 漫画出图 ---------------- */
    if (req.method === 'POST' && route === '/comic/plan-prompts') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      return sendJson(res, 200, await ctx.comic.planPrompts(pid, body));
    }
    if (req.method === 'GET' && route === '/comic/image-progress') {
      const pid = safeId(url.searchParams.get('projectId') || '');
      return sendJson(res, 200, ctx.comic.imageProgress(pid));
    }
    if (req.method === 'POST' && route === '/comic/render-panels') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      const doc = ctx.comic.load(pid);
      if (!doc) return sendJson(res, 404, { error: 'COMIC_NOT_FOUND' });
      if (!doc.planParts?.length) {
        return sendJson(res, 400, { error: 'PLAN_REQUIRED', detail: '请先执行「提示词计划」' });
      }

      const wf = loadImageWorkflow();
      if (!wf) return sendJson(res, 500, { error: 'WORKFLOW_MISSING' });
      const models = checkImageModels(cfg);
      if (!models.ready) return sendJson(res, 400, { error: 'IMAGE_MODEL_MISSING', missing: models.missing });

      // 只渲染指定页（默认全部）
      const onlyPage = body.pageIndex ? Number(body.pageIndex) : null;
      const targets = doc.planParts.filter((p) => !onlyPage || p.pageIndex === onlyPage);
      const limit = Math.max(1, Math.min(50, Number(body.limit) || targets.length));
      const todo = targets.slice(0, limit);

      // 异步跑
      void (async () => {
        for (const plan of todo) {
          try {
            const j = newJob({
              projectId: pid,
              shotId: null,
              backendId: 'h3-image',
              prompt: plan.prompt,
              params: {
                kind: 'image',
                imageSizeId: body.sizeId ?? 'sq-2048',
                seed: body.seed ?? Math.floor(Math.random() * 2147483647),
              },
              mode: 't2i',
            });
            j.kind = 'image';
            await jobsStore().upsert(j);

            const r = await runH3ImageLocal({
              workflow: wf,
              job: j,
              prompt: plan.prompt,
              shot: { refs: { images: [] }, imageSizeId: body.sizeId ?? 'sq-2048' },
              cfg,
            });
            const out = r.outputs?.[0];
            if (out?.path) {
              // 复制到 assets 目录，便于 SVG 内嵌引用
              const rel = `comic/panels/${pid}_p${plan.pageIndex}_${plan.panelIndex}.png`;
              const abs = path.join(cfg.dataDir, rel);
              fs.mkdirSync(path.dirname(abs), { recursive: true });
              try { fs.copyFileSync(out.path, abs); } catch { /* ignore */ }
              ctx.comic.setPanelImage(pid, plan.pageIndex, plan.panelIndex, {
                rel, path: abs, bytes: out.bytes,
              });
            }
            await jobsStore().upsert({ ...j, status: 'completed', outputs: r.outputs ?? [], finishedAt: Date.now() });
          } catch (e) {
            // 单格失败不中断整批
            ctx.extras?.appendLog?.({ level: 'error', msg: `漫画出图失败 p${plan.pageIndex}-${plan.panelIndex}: ${String(e?.message ?? e)}` });
          }
        }
      })();

      return sendJson(res, 200, { ok: true, queued: todo.length, total: targets.length });
    }

    /* ---------------- 预演截图 → 出图 ---------------- */
    if (req.method === 'GET' && route === '/previz-shot/meta') {
      return sendJson(res, 200, {
        browser: findBrowser(),
        defaultUrl: `http://127.0.0.1:${cfg.previzPort || 4318}/`,
        viewport: { width: 1600, height: 1000 },
      });
    }
    if (req.method === 'POST' && route === '/previz-shot/capture') {
      const body = await readJsonBody(req);
      const shot = await screenshotPreviz({
        cfg,
        url: body.url || `http://127.0.0.1:${cfg.previzPort || 4318}/`,
        width: Number(body.width) || 1600,
        height: Number(body.height) || 1000,
        waitMs: Number(body.waitMs) || 8000,
      });
      // 裁出 3D 视口
      let cropped = null;
      try {
        const ffmpeg = resolveFfmpeg(cfg);
        const dst = shot.path.replace(/\.png$/, '_crop.png');
        cropped = await cropWithFfmpeg(ffmpeg, shot.path, dst, {
          width: Number(body.width) || 1600,
          height: Number(body.height) || 1000,
        });
      } catch { /* 裁剪失败就用原图 */ }
      return sendJson(res, 200, { ...shot, cropped: cropped ?? null });
    }
    if (req.method === 'POST' && route === '/previz-shot/generate') {
      const body = await readJsonBody(req);
      const wf = loadImageWorkflow();
      if (!wf) return sendJson(res, 500, { error: 'WORKFLOW_MISSING' });
      const models = checkImageModels(cfg);
      if (!models.ready) return sendJson(res, 400, { error: 'IMAGE_MODEL_MISSING', missing: models.missing });

      // 参考图：优先用裁好的视口
      let refAbs = null;
      if (body.refPath) {
        const p = path.isAbsolute(body.refPath)
          ? body.refPath
          : safeJoin(cfg.dataDir, String(body.refPath));
        if (fs.existsSync(p)) refAbs = p;
      }
      if (!refAbs && body.autoCapture) {
        const shot = await screenshotPreviz({ cfg, url: body.url });
        try {
          const ffmpeg = resolveFfmpeg(cfg);
          const dst = shot.path.replace(/\.png$/, '_crop.png');
          const c = await cropWithFfmpeg(ffmpeg, shot.path, dst);
          refAbs = c.path;
        } catch {
          refAbs = shot.path;
        }
      }
      if (!refAbs) return sendJson(res, 400, { error: 'REF_REQUIRED', detail: '需要预演截图' });

      const prompt = buildPrevizStylePrompt(body.prompt ?? '', {
        style: body.style ?? '电影感写实风格，柔和自然光，高细节',
      });

      const job = newJob({
        projectId: body.projectId ? safeId(String(body.projectId)) : null,
        shotId: null,
        backendId: 'h3-image',
        prompt,
        params: {
          kind: 'image',
          imageSizeId: body.sizeId ?? 'h-16x9',
          seed: body.seed ?? Math.floor(Math.random() * 2147483647),
        },
        mode: 'edit',
      });
      job.kind = 'image';
      await jobsStore().upsert(job);

      runJob(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt,
        shot: { refs: { images: [refAbs] }, imageSizeId: body.sizeId },
        cfg,
      })).catch(() => {});

      return sendJson(res, 200, { ...job, refPath: refAbs });
    }

    /* ---------------- 拆解图 / 人设卡 ---------------- */
    if (req.method === 'GET' && route === '/breakdown/meta') {
      return sendJson(res, 200, {
        levels: BREAKDOWN_LEVELS,
        sizes: BREAKDOWN_SIZES,
      });
    }
    if (req.method === 'POST' && route === '/breakdown/preview') {
      const body = await readJsonBody(req);
      const lv = breakdownLevel(body.level ?? 'standard');
      return sendJson(res, 200, {
        level: lv.id,
        prompt: buildBreakdownPrompt(body, lv.id),
        chars: buildBreakdownPrompt(body, lv.id).length,
      });
    }
    if (req.method === 'POST' && route === '/breakdown/generate') {
      const body = await readJsonBody(req);
      if (!cfg) return sendJson(res, 500, { error: 'CONFIG_MISSING' });
      const wf = loadImageWorkflow();
      if (!wf) return sendJson(res, 500, { error: 'WORKFLOW_MISSING' });

      const lv = breakdownLevel(body.level ?? 'standard');
      const size = breakdownSize(body.sizeId ?? 'square');
      const prompt = buildBreakdownPrompt(body, lv.id);

      // 参考图：绝对路径或 dataDir 相对路径
      const refAbs = [];
      for (const r of (body.refImages ?? [])) {
        if (!r) continue;
        if (path.isAbsolute(r) && fs.existsSync(r)) { refAbs.push(r); continue; }
        try {
          const a = safeJoin(cfg.dataDir, String(r));
          if (fs.existsSync(a)) refAbs.push(a);
        } catch { /* ignore */ }
      }

      const job = newJob({
        projectId: body.projectId ? safeId(String(body.projectId)) : null,
        shotId: null,
        backendId: 'h3-image',
        prompt,
        params: {
          kind: 'image',
          imageSizeId: body.sizeId ?? 'square',
          width: size.w,
          height: size.h,
          seed: body.seed ?? Math.floor(Math.random() * 2147483647),
        },
        mode: 'edit',
      });
      job.kind = 'image';
      await jobsStore().upsert(job);

      runJob(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt,
        shot: { refs: { images: refAbs }, imageSizeId: body.sizeId },
        cfg,
      })).catch(() => {});

      return sendJson(res, 200, { ...job, refCount: refAbs.length, level: lv.id });
    }

    /* ---------------- 图像生成（H3-Image） ---------------- */
    if (req.method === 'GET' && route === '/image/meta') {
      return sendJson(res, 200, {
        models: H3_IMAGE_MODELS,
        vae: IMAGE_VAE,
        clip: IMAGE_CLIP,
        sampling: IMAGE_SAMPLING,
        sizes: H3_IMAGE_SIZES,
        status: checkImageModels(cfg),
      });
    }
    if (req.method === 'POST' && route === '/image/generate') {
      const body = await readJsonBody(req);
      const wf = loadImageWorkflow();
      if (!wf) return sendJson(res, 500, { error: 'WORKFLOW_MISSING' });

      const job = newJob({
        projectId: body.projectId ? safeId(String(body.projectId)) : null,
        shotId: body.shotId ?? null,
        backendId: 'h3-image',
        prompt: String(body.prompt ?? ''),
        params: {
          kind: 'image',
          imageSizeId: body.sizeId ?? cfg.imageSizeId ?? 'auto',
          width: body.width,
          height: body.height,
          seed: body.seed ?? Math.floor(Math.random() * 2147483647),
        },
        mode: 't2i',
      });
      job.kind = 'image';
      await jobsStore().upsert(job);

      runJob(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt: String(body.prompt ?? ''),
        shot: {
          refs: { images: Array.isArray(body.refImages) ? body.refImages : [] },
          imageSizeId: body.sizeId,
        },
        cfg,
      })).catch(() => {});

      return sendJson(res, 200, job);
    }

    /* ---------------- 3D 导演台 ---------------- */
    if (req.method === 'GET' && route === '/director/meta') {
      const [health, catalog] = await Promise.all([
        ctx.director.health(),
        ctx.director.catalog().catch(() => ({})),
      ]);
      return sendJson(res, 200, {
        health,
        commands: DIRECTOR_COMMANDS,
        cameraMoves: CAMERA_MOVES,
        fps: DIRECTOR_FPS,
        catalog,
      });
    }
    if (req.method === 'GET' && route === '/director/shots') {
      return sendJson(res, 200, await ctx.director.listShots());
    }
    if (req.method === 'GET' && route === '/director/state') {
      return sendJson(res, 200, await ctx.director.getState());
    }
    if (req.method === 'POST' && route === '/director/command') {
      const body = await readJsonBody(req);
      const name = String(body.name || '');
      if (!/^director_[a-z_]+$/.test(name)) {
        return sendJson(res, 400, { error: 'INVALID_COMMAND', name });
      }
      return sendJson(res, 200, { ok: true, result: await ctx.director.command(name, body.arguments ?? {}) });
    }
    if (req.method === 'POST' && route === '/director/build') {
      const body = await readJsonBody(req);
      const shot = body.shot ?? listShots(body.projectId || '').find((s) => s.id === body.shotId);
      if (!shot) return sendJson(res, 404, { error: 'SHOT_NOT_FOUND' });
      return sendJson(res, 200, await ctx.director.buildFromShot(shot, body));
    }
    if (req.method === 'POST' && route === '/director/camera-prompt') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.director.toCameraPrompt(body.shotId));
    }
    if (req.method === 'POST' && route === '/director/validate') {
      return sendJson(res, 200, await ctx.director.validate());
    }
    if (req.method === 'POST' && route === '/director/start') {
      return sendJson(res, 200, await ctx.director.start());
    }
    if (req.method === 'POST' && route === '/director/stop') {
      return sendJson(res, 200, await ctx.director.stop());
    }

    /* ---------------- H3 提示词编译 ---------------- */
    if (req.method === 'GET' && route === '/prompt/meta') {
      return sendJson(res, 200, {
        styles: STYLE_PRESETS,
        modes: H3_MODES,
        limits: H3_LIMITS,
      });
    }
    if (req.method === 'POST' && route === '/prompt/compile') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, compileH3Prompt(body));
    }
    if (req.method === 'POST' && route === '/prompt/from-shot') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId || '');
      const shot = body.shot ?? listShots(pid).find((s) => s.id === body.shotId);
      if (!shot) return sendJson(res, 404, { error: 'SHOT_NOT_FOUND' });
      const pkg = toShotInputPackage(shot, {
        styleId: body.styleId ?? shot.styleId ?? null,
        subjects: body.subjects ?? deriveSubjectsFromShot(shot),
        scenes: body.scenes,
        seed: body.seed,
      });
      const r = compileH3Prompt(pkg);
      return sendJson(res, 200, { ...r, package: pkg });
    }
    if (req.method === 'POST' && route === '/prompt/preview') {
      // 只编译不落盘，供前端实时预览（与 /compile 同，但接受 shot 直传）
      const body = await readJsonBody(req);
      return sendJson(res, 200, compileH3Prompt(body));
    }

    /* ---------------- 提示词模板 ---------------- */
    if (req.method === 'GET' && route === '/templates') {
      return sendJson(res, 200, ctx.extras.listTemplates());
    }
    if (req.method === 'POST' && route === '/templates/upsert') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.upsertTemplate(body));
    }
    if (req.method === 'POST' && route === '/templates/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.deleteTemplate(String(body.id)));
    }

    /* ---------------- 服化道 ---------------- */
    if (req.method === 'GET' && route === '/wardrobe') {
      return sendJson(res, 200, ctx.extras.listWardrobe(url.searchParams.get('kind') || null));
    }
    if (req.method === 'POST' && route === '/wardrobe/upsert') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.upsertWardrobe(body));
    }
    if (req.method === 'POST' && route === '/wardrobe/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.deleteWardrobe(String(body.id)));
    }

    /* ---------------- 分镜目录导入 ---------------- */
    if (req.method === 'POST' && route === '/import/scan') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.scanImportDir(String(body.dir || '')));
    }
    if (req.method === 'POST' && route === '/import/preview') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.previewImportFile(String(body.path || ''), Number(body.limit) || 2000));
    }

    /* ---------------- 资源清理 ---------------- */
    if (req.method === 'GET' && route === '/resources/orphans') {
      const all = await ctx.assets.list({});
      return sendJson(res, 200, ctx.extras.findOrphans(all));
    }
    if (req.method === 'POST' && route === '/resources/clean') {
      const body = await readJsonBody(req);
      const all = await ctx.assets.list({});
      return sendJson(res, 200, ctx.extras.cleanOrphans(all, { confirm: Boolean(body.confirm) }));
    }

    /* ---------------- 动态提示词条 ---------------- */
    if (req.method === 'GET' && route === '/motionshots') {
      return sendJson(res, 200, ctx.extras.listMotionShots(url.searchParams.get('projectId') || null));
    }
    if (req.method === 'POST' && route === '/motionshots/upsert') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.upsertMotionShot(body));
    }
    if (req.method === 'POST' && route === '/motionshots/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.deleteMotionShot(String(body.id)));
    }

    /* ---------------- 运行日志 ---------------- */
    if (req.method === 'GET' && route === '/logs') {
      return sendJson(res, 200, ctx.extras.listLogs(Number(url.searchParams.get('limit')) || 100));
    }
    if (req.method === 'POST' && route === '/logs') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.extras.appendLog(body));
    }

    /* ---------------- 批量进度 ---------------- */
    if (req.method === 'GET' && route === '/jobs/batch-progress') {
      const all = await jobsStore().list();
      return sendJson(res, 200, ctx.extras.batchProgress(all));
    }

    /* ---------------- 画布内置 Agent ---------------- */
    if (req.method === 'GET' && route === '/canvas-agent/meta') {
      return sendJson(res, 200, ctx.canvasAgent.meta());
    }
    if (req.method === 'POST' && route === '/canvas-agent/exec') {
      const body = await readJsonBody(req);
      const name = String(body.name || '');
      const ctxIn = body.context ?? {};
      // 项目 id 可选：给了才去后端补资产/镜头，否则用前端传的 context
      const rawPid = body.projectId ? safeId(String(body.projectId)) : '';
      const enriched = { ...ctxIn };
      if (rawPid) {
        if (!ctxIn.assets) enriched.assets = await ctx.assets.list({ projectId: rawPid });
        if (!ctxIn.shots) enriched.shots = listShots(rawPid);
      }
      return sendJson(res, 200, await ctx.canvasAgent.exec(name, body.arguments ?? {}, enriched));
    }

    /* ---------------- 模特工作台 ---------------- */
    if (req.method === 'GET' && route === '/mw/meta') {
      return sendJson(res, 200, ctx.mw.meta());
    }
    if (req.method === 'GET' && route === '/mw/jobs') {
      return sendJson(res, 200, ctx.mw.listJobs());
    }
    if (req.method === 'POST' && route === '/mw/jobs') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.createJob(body));
    }
    if (req.method === 'POST' && route === '/mw/job/update') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.updateJob(String(body.id), body.patch ?? {}));
    }
    if (req.method === 'POST' && route === '/mw/job/replan') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.replanJob(String(body.id)));
    }
    if (req.method === 'POST' && route === '/mw/job/generate') {
      const body = await readJsonBody(req);
      const jobId = String(body.id || '');
      const job = ctx.mw.listJobs().find((j) => j.id === jobId);
      if (!job) return sendJson(res, 404, { error: 'MW_JOB_NOT_FOUND' });

      const wf = loadImageWorkflow();
      if (!wf) return sendJson(res, 500, { error: 'WORKFLOW_MISSING' });
      const models = checkImageModels(cfg);
      if (!models.ready) {
        return sendJson(res, 400, { error: 'IMAGE_MODEL_MISSING', missing: models.missing });
      }

      // 尺寸按用途映射
      const sizeId = job.mode === 'film' ? 'p-3x4-film' : 'ecom-sq';
      const seed = body.seed ?? Math.floor(Math.random() * 2147483647);

      // 异步跑，立即返回
      void (async () => {
        try {
          await ctx.mw.runGeneration(jobId, async (planItem) => {
            const j = newJob({
              projectId: job.projectId ?? null,
              shotId: null,
              backendId: 'h3-image',
              prompt: planItem.prompt,
              params: {
                kind: 'image',
                imageSizeId: sizeId,
                seed: seed + planItem.index,
              },
              mode: 't2i',
            });
            j.kind = 'image';
            await jobsStore().upsert(j);

            const r = await runH3ImageLocal({
              workflow: wf,
              job: j,
              prompt: planItem.prompt,
              shot: { refs: { images: [] }, imageSizeId: sizeId },
              cfg,
            });
            // 记进 jobs 表以便前端查询（upsert 会合并同 id）
            await jobsStore().upsert({
              ...j,
              status: 'completed',
              outputs: r.outputs ?? [],
              finishedAt: Date.now(),
            });
            return r.outputs?.[0] ?? r;
          });
        } catch { /* runGeneration 内部已记录失败 */ }
      })();

      return sendJson(res, 200, { ok: true, jobId, total: job.count, message: '已开始出图' });
    }
    if (req.method === 'POST' && route === '/mw/job/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.deleteJobs(body.ids ?? []));
    }
    if (req.method === 'GET' && route === '/mw/plans') {
      return sendJson(res, 200, ctx.mw.listPlans());
    }
    if (req.method === 'POST' && route === '/mw/plan/save') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.savePlan(String(body.jobId), body.name));
    }
    if (req.method === 'POST' && route === '/mw/plan/apply') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.applyPlan(String(body.jobId), String(body.planId)));
    }
    if (req.method === 'POST' && route === '/mw/plan/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.deletePlan(String(body.id)));
    }
    if (req.method === 'GET' && route === '/mw/figures') {
      return sendJson(res, 200, ctx.mw.listFigureItems());
    }
    if (req.method === 'POST' && route === '/mw/figure/upsert') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.upsertFigure(body.figure ?? body));
    }
    if (req.method === 'POST' && route === '/mw/figure/delete') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, ctx.mw.deleteFigure(String(body.id)));
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

    /* ---------------- 文件服务（产物/资产，带 Range） ---------------- */
    if ((req.method === 'GET' || req.method === 'HEAD') && route === '/file') {
      const rel = url.searchParams.get('path');
      if (!rel) return sendJson(res, 400, { error: 'PATH_REQUIRED' });
      let abs;
      try {
        abs = safeJoin(cfg.dataDir, rel);      // 只允许 dataDir 内
      } catch {
        return sendJson(res, 403, { error: 'FORBIDDEN_PATH', path: rel });
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        return sendJson(res, 404, { error: 'NOT_FOUND', path: rel });
      }
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
          'Content-Length': len, 'Cache-Control': 'no-cache',
        });
        return pipeStream(res, abs, range);
      }
      res.writeHead(200, {
        'Content-Type': mime, 'Content-Length': stat.size,
        'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      return pipeStream(res, abs);
    }

    /* ---------------- 后处理 / 图像工具 ---------------- */
    if (req.method === 'POST' && route === '/post/transcode') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.transcode(body));
    }
    if (req.method === 'POST' && route === '/post/scale') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.scale(body));
    }
    if (req.method === 'POST' && route === '/post/crop') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.crop(body));
    }
    if (req.method === 'POST' && route === '/post/split') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.split(body));
    }
    if (req.method === 'POST' && route === '/post/annotate') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.annotate(body));
    }
    if (req.method === 'POST' && route === '/post/extractFrame') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.extractFrame(body));
    }
    if (req.method === 'POST' && route === '/post/extractAudio') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.extractAudio(body));
    }
    if (req.method === 'POST' && route === '/post/qc') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.qc(body.path ?? body.input));
    }
    if (req.method === 'GET' && route === '/post/fonts') {
      // 中文标注需要字体文件；给出候选列表供前端选择
      const candidates = [
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/simsun.ttc',
        'C:/Windows/Fonts/msyhbd.ttc',
      ].filter((f) => fs.existsSync(f));
      return sendJson(res, 200, { fonts: candidates });
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

/** 写盘前：把图里的内联图片抽进 imagePool，节点里只留 __img_ref__:<n> */
function packProject(project, existingPool) {
  // 只对可能含图片的字段做打包，其余原样（避免无谓遍历）
  const { graph: nodes, pool: p1 } = packGraph(project.nodes ?? [], existingPool);
  const { graph: history, pool: p2 } = packGraph(project.history ?? {}, p1);
  return { ...project, nodes, history, imagePool: p2 };
}

/** 读盘后：把 __img_ref__:<n> 还原成图片本体 */
function unpackProject(project) {
  if (!project) return project;
  const pool = project.imagePool ?? [];
  if (!pool.length && !JSON.stringify(project).includes(IMG_REF_PREFIX)) return project;
  return {
    ...project,
    nodes: unpackGraph(project.nodes ?? [], pool),
    history: unpackGraph(project.history ?? {}, pool),
  };
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

/** 整体写回镜头表（原子写） */
export function writeShots(projectId, list) {
  const f = shotsFile(projectId);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, f);
  return list;
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

/**
 * 编译提示词。
 *
 * 优先走 **H3 官方六段式/三段式编译器**（services/h3-prompt.js），
 * 它按用户提供的技能书规范生成结构化提示词。
 * 镜头卡没给够字段时（无 subjects / 无 shots）退回简单的段落拼接，
 * 保证旧数据仍能生成。
 */
export function compilePrompt(shot) {
  // 走官方结构：需要有 mode 或 styleId，或显式给了 subjects
  const useStructured = Boolean(shot.mode || shot.styleId || shot.subjects?.length || shot.h3mode);
  if (useStructured) {
    try {
      const pkg = toShotInputPackage(shot, {
        styleId: shot.styleId ?? null,
        subjects: shot.subjects ?? deriveSubjectsFromShot(shot),
        scenes: shot.scenes ?? undefined,
        seed: shot.seed,
      });
      // 兼容旧字段：description/camera/style 已在 toShotInputPackage 里映射
      if (shot.prompt) pkg.sceneLayout = `${pkg.sceneLayout}\n${shot.prompt}`;
      const r = compileH3Prompt(pkg);
      if (r.prompt && r.prompt.length > 40) return r.prompt.slice(0, 7000);
    } catch {
      // 结构化编译失败 → 退回简单拼接，不让生成中断
    }
  }
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

/**
 * 从镜头卡推断 subjects（参考图 → 角色）。
 * 没有显式 subjects 时用这个兜底，让结构化编译器也能工作。
 */
function deriveSubjectsFromShot(shot) {
  const imgs = shot.refs?.images ?? [];
  if (!imgs.length) return [];
  return imgs.map((_, i) => ({
    id: `S${i + 1}`,
    name: `角色${i + 1}`,
    pictureIndex: i + 1,
    gender: 'FEMALE',
    traits: '',
  }));
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


async function executeBackend(job, shot, ctx, cfg) {
  const prompt = job.prompt || compilePrompt(shot);
  const outputsDir = path.join(cfg.dataDir, 'outputs');

  if (job.backendId === 'h3-local') {
    // 统一走 services/generator.js（与 Agent 工具共用同一实现）
    return runH3Local({
      workflow: ctx.h3.loadWorkflow(),
      job, shot, prompt, cfg,
    });
  }

  // 图像生成（H3-Image）：与视频共用编码器，只换扩散模型 + 图像 VAE
  if (job.backendId === 'h3-image' || jobKind(job) === 'image') {
    const wf = loadImageWorkflow();
    if (!wf) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');
    return runH3ImageLocal({ workflow: wf, job, shot, prompt, cfg });
  }

  if (job.backendId === 'seedance-cloud') {
    return seedance.runSeedance({ cfg, job, shot, prompt });
  }

  return seedance.runMock({ cfg, job, shot, prompt });
}

/** 加载图像生成工作流（带缓存） */
let _imgWf = null;
function loadImageWorkflow() {
  if (_imgWf) return _imgWf;
  try {
    const f = path.join(dirs().root, 'workflows', 'h3-image.json');
    if (!fs.existsSync(f)) return null;
    _imgWf = JSON.parse(fs.readFileSync(f, 'utf8'));
    return _imgWf;
  } catch { return null; }
}
















