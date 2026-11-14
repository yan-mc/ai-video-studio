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
import { dirs, projects, newProject, newShot, validateShot, PROFILES, resolutionFor, h3Length, H3_MODEL_SLOTS, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, normalizeMode } from '../store/models.js';
import * as comfy from '../services/comfy-client.js';
import * as seedance from '../services/seedance-client.js';
import { runJob, cancelJob, runtimeStats, markCancelled, CancelledError } from '../services/job-runner.js';
import { newJob, jobs as jobsStore, isLocalBackendOf } from '../services/job-store.js';
import { runH3Local, runH3ImageLocal, jobKind } from '../services/generator.js';
import { packGraph, unpackGraph, IMG_REF_PREFIX } from '../store/image-pool.js';
import { SCRIPT_GENRES, SCRIPT_STAGES, checkConsistency } from '../services/script-service.js';
import { COMIC_TEMPLATES, COMIC_STATIONS } from '../services/comic-service.js';
import { DIRECTOR_COMMANDS, CAMERA_MOVES, DIRECTOR_FPS } from '../services/director3d.js';
import { compileH3Prompt, toShotInputPackage, STYLE_PRESETS, H3_MODES, H3_LIMITS } from '../services/h3-prompt.js';
import { H3_IMAGE_MODELS, H3_IMAGE_SIZES, IMAGE_VAE, IMAGE_CLIP, IMAGE_SAMPLING, checkImageModels } from '../services/h3-image.js';
import { BREAKDOWN_LEVELS, BREAKDOWN_SIZES, buildBreakdownPrompt, breakdownLevel, breakdownSize } from '../services/breakdown.js';
import {
  CARD_IMAGE_SLOTS, CARD_REF_MODES, H3_MAX_REF_IMAGES,
  readProjectCards, writeProjectCards,
} from '../services/character-vault.js';
import { buildRenderPlan, subjectsForPrompt, buildMediaNotes } from '../services/render-plan.js';
import { probeMedia } from '../services/media-probe.js';
import { renderPrevizVideo } from '../services/previz-video.js';
import { findBrowser, screenshotPreviz, cropWithFfmpeg, buildPrevizStylePrompt } from '../services/previz-shot.js';
import { resolveFfmpeg } from '../services/seedance-client.js';
import { createCanvasAgent } from '../services/canvas-agent.js';
import { getRuntime } from '../runtime.js';
// 工作流模板定位 —— 单一真源（模板随插件分发，不跟随 dataDir）
import { readWorkflowCached, workflowDiagnostics } from '../services/workflow-paths.js';
// 生成入参准备 —— REST 与 Agent 工具共用同一份（角色卡解析 / 媒体探测 / 编号）
import {
  withVaultCards, resolveMediaRefs, writeBackProbe, resolvePictureIndices,
} from '../services/shot-context.js';

/* ------------------------------------------------------------- 工具函数 */

/** 合法后端枚举 —— 单一真源，路由与执行器共用 */
export const VALID_BACKENDS = new Set(['h3-local', 'h3-image', 'seedance-cloud', 'mock']);

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
      filename: fileM?.[1] ? decodeRfc2047(fileM[1]) : null,
      data: buf.subarray(bodyStart, bodyEnd),
    });

    start = nextDelim + delim.length;
    if (start >= buf.length) break;
  }
  return parts;
}

/**
 * 解码 RFC 2047 编码的中文文件名。
 *
 * 为什么要做：PowerShell 的 `-Form`、以及部分 HTTP 客户端会把非 ASCII 文件名
 * 编成 `=?utf-8?B?<base64>?=`。不过滤就会拿到一串编码字面量，
 * `path.extname()` 取不到扩展名 → 上传报 `UNSUPPORTED_FILE_TYPE: (none)`。
 * （实测：用 PowerShell 上传中文名立绘必失败，用 node 的 FormData 则正常。）
 */
function decodeRfc2047(value) {
  if (!value || !value.includes('=?')) return value;
  try {
    return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset, enc, text) => {
      const cs = String(charset).toLowerCase();
      if (enc.toUpperCase() === 'B') {
        const buf = Buffer.from(text, 'base64');
        return cs.includes('8859') ? buf.toString('latin1') : buf.toString('utf8');
      }
      // Q 编码：_ 代表空格
      const raw = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(raw, 'latin1').toString('utf8');
    });
  } catch { return value; }
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
      // 工作流模板是否就位 —— 首装最容易踩的坑，直接在健康检查里暴露
      const wfH3 = workflowDiagnostics('h3', cfg);
      const wfImg = workflowDiagnostics('image', cfg);
      return sendJson(res, 200, {
        ok: true,
        h3,
        seedance: sd,
        previz: await previzHealth(ctx),
        workflows: {
          h3: { exists: wfH3.exists, dir: wfH3.dir },
          image: { exists: wfImg.exists, dir: wfImg.dir },
          ok: wfH3.exists && wfImg.exists,
        },
      });
    }
    // 工作流诊断：缺文件时告诉用户找过哪里、该怎么配
    if (req.method === 'GET' && route === '/workflows/diagnostics') {
      return sendJson(res, 200, {
        h3: workflowDiagnostics('h3', cfg),
        image: workflowDiagnostics('image', cfg),
      });
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
          // ⚠️ 删除项目必须连带清理它名下的运行时数据。
          //    旧实现只删 projects.json 里的记录，`shots/<pid>/`、`data/script/<pid>.json`、
          //    `data/comic/<pid>.json`、`data/projects/<pid>/cards.json` 全留在磁盘上，
          //    长期使用后数据目录只增不减，且重建同名项目会"捡到"旧数据。
          const cleaned = cleanupProjectArtifacts(cfg, id);
          await projects.remove(id);
          return sendJson(res, 200, { ok: true, removed: id, cleaned });
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
      // 早失败：后端名写错要立刻报，不能等任务跑完才产出"假视频"
      if (!VALID_BACKENDS.has(backendId)) {
        return sendJson(res, 400, {
          error: 'UNKNOWN_BACKEND',
          detail: `${JSON.stringify(backendId)} 不是有效后端`,
          valid: [...VALID_BACKENDS],
        });
      }
      // ⚠️ 顺序很重要：**先**解析角色卡，**再**编译提示词。
      //    旧写法先 compilePrompt(shot) 后注入卡，导致卡的文字永远进不了 subject_definitions
      //    （编译时 subjects 为空，生成出空的 subject_definitions: 段）。
      const shotWithCards = await withVaultCards(shot, pid, ctx, cfg);
      const job = newJob({
        projectId: pid,
        shotId: shot.id,
        backendId,
        prompt: compilePrompt(shotWithCards),
        params: {
          durationSec: shot.durationSec,
          ratio: shot.ratio,
          profile: shot.profile,
          seed: Number(body.seed) || 1101,
        },
        mode: shot.mode,
      });
      await jobsStore().upsert(job);

      // 角色卡已在上面解析进 shotWithCards，直接用它执行
      runAndArchive(job, (running, hooks) => executeBackend(running, shotWithCards, ctx, cfg, hooks), ctx).catch(() => {});
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
            // h3-image 同样走 ComfyUI，也必须能真取消（旧代码只认 h3-local）
            if (job.remoteId && isLocalBackendOf(job.backendId)) {
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
        runAndArchive(job, (running, hooks) => executeBackend(running, shot, ctx, cfg, hooks), ctx).catch(() => {});
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
      // 与 /director/command 保持一致：引擎命令名必须匹配已知形态，
      // 不能把任意字符串原样透传给子进程。
      const name = String(body.name || '');
      if (!/^director_[a-z_]+$/.test(name)) {
        return sendJson(res, 400, { error: 'INVALID_COMMAND', name });
      }
      return sendJson(res, 200, await ctx.previz.command(name, body.args || {}));
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
              // 角色参考图必须真的传进去：漫画要保证多格之间角色一致，
              // 旧实现硬编码 images: [] → 每格都是纯文生图，角色必然漂移。
              shot: {
                refs: { images: body.refImages ?? doc.refImages ?? [] },
                characterRefs: body.characterRefs ?? doc.characterRefs ?? [],
                imageSizeId: body.sizeId ?? 'sq-2048',
              },
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
            // 同时登记进素材库 —— 否则漫画产物只存在于 comic/panels/，
            // 渲染页、角色卡仓库都引用不到。
            const archived = await archiveBatchOutput(ctx, cfg, out, {
              type: 'general',
              name: `漫画_${pid}_p${plan.pageIndex}_${plan.panelIndex}`,
              projectId: pid,
              note: String(plan.prompt ?? '').slice(0, 200),
            });
            const outputsWithArchive = archived
              ? [{ ...out, assetId: archived.id, archivedRel: archived.rel }]
              : (r.outputs ?? []);
            await jobsStore().upsert({ ...j, status: 'completed', outputs: outputsWithArchive, finishedAt: Date.now() });
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

    /* ---------------- 预演 → 白模视频 ---------------- */
    //
    // 逐帧渲染预演工程，输出 mp4。用途是把 3D 白模当 H3 的**参考视频**。
    // 详见 host/services/previz-video.js 顶部说明（含两个引擎行为坑）。
    if (req.method === 'POST' && route === '/previz/video') {
      const body = await readJsonBody(req);
      const fps = Math.max(6, Math.min(30, Number(body.fps) || 24));
      const width = Math.max(320, Math.min(1920, Number(body.width) || 1280));
      const height = Math.max(240, Math.min(1080, Number(body.height) || 720));
      const stamp = `previz_${Date.now().toString(36)}`;
      const outDir = path.join(cfg.dataDir, 'previz', stamp);

      try {
        const r = await renderPrevizVideo({
          previzBase: `http://127.0.0.1:${cfg.previzPort || 4318}`,
          outDir,
          fps,
          width,
          height,
          maxSeconds: Number(body.maxSeconds) || 0,
        });
        const rel = path.relative(cfg.dataDir, r.videoPath).replace(/\\/g, '/');
        return sendJson(res, 200, { ...r, rel, outDir: path.relative(cfg.dataDir, outDir).replace(/\\/g, '/') });
      } catch (e) {
        return sendJson(res, 400, { error: String(e?.message || e) });
      }
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

      runAndArchive(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt,
        shot: { refs: { images: [refAbs] }, imageSizeId: body.sizeId },
        cfg,
      }), ctx).catch(() => {});

      return sendJson(res, 200, { ...job, refPath: refAbs });
    }

    /* ---------------- 角色卡仓库 ---------------- */
    if (req.method === 'GET' && route === '/vault/meta') {
      return sendJson(res, 200, ctx.vault.meta());
    }
    if (req.method === 'GET' && route === '/vault/cards') {
      const q = url.searchParams.get('q') || '';
      return sendJson(res, 200, await ctx.vault.list({ q }));
    }
    if (req.method === 'POST' && route === '/vault/cards') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.vault.upsert(body));
    }
    if (req.method === 'POST' && route === '/vault/cards/delete') {
      const body = await readJsonBody(req);
      if (!body.id) return sendJson(res, 400, { error: 'ID_REQUIRED' });
      return sendJson(res, 200, await ctx.vault.remove(String(body.id)));
    }
    {
      const m = /^\/vault\/cards\/([A-Za-z0-9_]+)$/.exec(route);
      if (m) {
        const id = safeId(m[1], /^card_[A-Za-z0-9]+$/);
        if (req.method === 'GET') {
          const card = await ctx.vault.get(id);
          if (!card) return sendJson(res, 404, { error: 'CARD_NOT_FOUND' });
          return sendJson(res, 200, card);
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, await ctx.vault.upsert({ ...body, id }));
        }
      }
    }
    if (req.method === 'GET' && route === '/vault/plan') {
      const projectId = url.searchParams.get('projectId');
      const cardIds = (url.searchParams.get('cardIds') || '')
        .split(',').map((s) => s.trim()).filter(Boolean);
      // 项目已绑定的卡也并进来
      const bound = projectId ? readProjectCards(projectId, cfg) : [];
      const merged = [...new Set([...cardIds, ...bound])];
      return sendJson(res, 200, await ctx.vault.plan({
        cardIds: merged,
        extraImages: (url.searchParams.get('extra') || '').split(',').map((s) => s.trim()).filter(Boolean),
        firstLastCount: Number(url.searchParams.get('firstLast') || 0),
      }));
    }

    /* ---------------- 项目 ⇄ 角色卡 ---------------- */
    {
      const m = /^\/projects\/([A-Za-z0-9_-]+)\/cards$/.exec(route);
      if (m) {
        const pid = safeId(m[1]);
        if (req.method === 'GET') {
          const ids = readProjectCards(pid, cfg);
          const cards = [];
          for (const id of ids) {
            const c = await ctx.vault.get(id).catch(() => null);
            if (c) cards.push(c);
          }
          return sendJson(res, 200, { projectId: pid, cardIds: ids, cards });
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          const ids = writeProjectCards(pid, body.cardIds ?? [], cfg);
          return sendJson(res, 200, { ok: true, projectId: pid, cardIds: ids });
        }
      }
    }

    /* ---------------- 产物归档 ---------------- */
    //
    // 生成产物落在 data/outputs/（临时区），画布与渲染页都看不到。
    // 归档后变成正式素材，任何页面都能引用。
    // 这是「画布 ↔ 渲染页」打通的桥梁。
    if (req.method === 'POST' && route === '/assets/archive') {
      const body = await readJsonBody(req);
      const items = Array.isArray(body.items) ? body.items : [body];
      const saved = [];
      const failed = [];
      for (const it of items) {
        try {
          // 接受 rel（dataDir 相对）或绝对路径
          let abs = '';
          if (typeof it.path === 'string' && it.path) {
            abs = path.isAbsolute(it.path) ? it.path : safeJoin(cfg.dataDir, it.path);
          } else if (it.rel) {
            abs = safeJoin(cfg.dataDir, it.rel);
          }
          if (!abs) throw new Error('PATH_REQUIRED');
          saved.push(await ctx.assets.archiveFile(abs, {
            type: it.type ?? 'general',
            name: it.name,
            projectId: it.projectId ?? null,
            tag: it.tag ?? 'archived',
            note: it.note ?? '',
          }));
        } catch (e) {
          failed.push({ input: it, error: String(e?.message || e) });
        }
      }
      return sendJson(res, 200, { ok: failed.length === 0, saved, count: saved.length, failed });
    }

    /* ---------------- 渲染计划 ---------------- */
    // 一个镜头的"这次要传什么"由这里统一算：参考图清单、编号、超限裁剪、
    // 角色卡文字定义、推荐模式。前端渲染页直接消费它，不再自己算编号。
    if (req.method === 'POST' && route === '/render/plan') {
      const body = await readJsonBody(req);
      const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter(Boolean) : [];
      const cards = [];
      for (const id of cardIds) {
        const c = await ctx.vault.get(id).catch(() => null);
        if (c) cards.push(c);
      }
      const mediaRefs = await resolveMediaRefs(ctx, cfg, body.videos ?? [], body.audios ?? []);
      const plan = buildRenderPlan({
        cards,
        manualImages: body.manualImages ?? [],
        previz: body.previz ?? null,
        sceneImages: body.sceneImages ?? [],
        ...mediaRefs,
        refImageSize: body.refImageSize,
        vram: await comfy.vramStatus(cfg),
      });
      return sendJson(res, 200, plan);
    }

    /* ---------------- 渲染：编译提示词（按计划编号） ---------------- */
    //
    // 与 /prompt/compile 的区别：这个入口接受 cardIds，**由后端算编号**，
    // 保证提示词里的 <Picture N> 与最终上传顺序一致。
    if (req.method === 'POST' && route === '/render/compile') {
      const body = await readJsonBody(req);
      const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter(Boolean) : [];
      const cards = [];
      for (const id of cardIds) {
        const c = await ctx.vault.get(id).catch(() => null);
        if (c) cards.push(c);
      }
      const mediaRefs = await resolveMediaRefs(ctx, cfg, body.videos ?? [], body.audios ?? []);
      const plan = buildRenderPlan({
        cards,
        manualImages: body.manualImages ?? [],
        previz: body.previz ?? null,
        sceneImages: body.sceneImages ?? [],
        ...mediaRefs,
        refImageSize: body.refImageSize,
        vram: await comfy.vramStatus(cfg),
      });
      const pkg = toShotInputPackage(
        {
          id: body.shotId ?? 'render',
          mode: body.mode ?? plan.suggestedMode,
          durationSec: body.durationSec ?? 5,
          ratio: body.ratio ?? '16:9',
          styleId: body.styleId ?? null,
          description: body.summary ?? body.description ?? '',
          // 这里的 images 只用于编译器统计「有几张参考图」，
          // 真正的参考图由 plan 单独管理并接线（见 buildRenderPlan）。
          // 不是"丢图"——图片清单在 plan.images 里。
          refs: { images: plan.images.map((x) => x.rel) },
        },
        {
          subjects: subjectsForPrompt(plan),
          styleId: body.styleId ?? null,
          sceneLayout: body.sceneLayout ?? '',
        },
      );
      if (body.overall_soundscape) pkg.overall_soundscape = body.overall_soundscape;
      if (body.non_diegetic_music) pkg.non_diegetic_music = body.non_diegetic_music;
      // 自定义英文画风：直接覆盖画风预设（compileH3Prompt 里 styleEn 优先级最高）
      if (body.styleEn) pkg.styleEn = String(body.styleEn);
      if (body.shots) pkg.shots = body.shots;

      const compiled = compileH3Prompt(pkg);
      // 视频/音频的用途说明：H3 靠 <Video k> / <Audio j> 标签引用它们，
      // 但模型不知道"这段是参考什么"。补一句自然语言说明，效果明显更好。
      const mediaNotes = buildMediaNotes(plan);
      const finalPrompt = mediaNotes.length
        ? `reference_notes:\n${mediaNotes.join('\n')}\n\n${compiled.prompt}`
        : compiled.prompt;

      return sendJson(res, 200, {
        ...compiled,
        prompt: finalPrompt,
        chars: finalPrompt.length,
        plan,
        package: pkg,
      });
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

      runAndArchive(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt,
        shot: { refs: { images: refAbs }, imageSizeId: body.sizeId },
        cfg,
      }), ctx).catch(() => {});

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

      runAndArchive(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt: String(body.prompt ?? ''),
        shot: {
          refs: { images: Array.isArray(body.refImages) ? body.refImages : [] },
          imageSizeId: body.sizeId,
        },
        cfg,
      }), ctx).catch(() => {});

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
      // projectId 必须过 safeId：它会被拼进 shots 路径（见 shotsFile）
      const pid = body.projectId ? safeId(String(body.projectId)) : '';
      const shot = body.shot ?? (pid ? listShots(pid).find((s) => s.id === body.shotId) : null);
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
      const sizeId = job.mode === 'film' ? 'p-2x3-film' : 'ecom-sq';
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
              // 参考图必须真的传进去：模特/服装的一致性全靠它。
              // 旧实现硬编码 images: [] → 每套图都是纯文生图，形象库完全没用上。
              shot: {
                refs: { images: body.refImages ?? job.refImages ?? [] },
                characterRefs: body.characterRefs ?? job.characterRefs ?? resolveMwFigureRefs(ctx, job),
                imageSizeId: sizeId,
              },
              cfg,
            });
            // 登记进素材库，否则模特套图只落在 outputs/，渲染页引用不到
            const archived = await archiveBatchOutput(ctx, cfg, r.outputs?.[0], {
              type: 'general',
              name: `模特_${job.name ?? jobId}_${planItem.index}`,
              projectId: job.projectId ?? null,
              note: String(planItem.prompt ?? '').slice(0, 200),
            });
            const outs = archived
              ? [{ ...(r.outputs?.[0] ?? {}), assetId: archived.id, archivedRel: archived.rel }]
              : (r.outputs ?? []);
            // 记进 jobs 表以便前端查询（upsert 会合并同 id）
            await jobsStore().upsert({
              ...j,
              status: 'completed',
              outputs: outs,
              finishedAt: Date.now(),
            });
            return outs[0] ?? r;
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
          const item = await ctx.assets.saveUploaded(f.data, {
            filename: f.filename,
            type: fields.type,
            name: fields.name || f.filename,
            projectId: fields.projectId,
            tag: fields.tag,
            note: fields.note,
          });

          // 上传后立刻探测媒体信息（时长 / 是否有音轨 / 分辨率）。
          // 这样前端不用等到渲染时才发现"这段视频其实没有音轨"。
          if (item.kind === 'video' || item.kind === 'audio') {
            try {
              const abs = safeJoin(cfg.dataDir, item.rel);
              const probe = await probeMedia(abs, cfg);
              if (probe.ok) {
                const enriched = {
                  ...item,
                  durationSec: probe.durationSec,
                  hasAudio: probe.hasAudio,
                  mediaWidth: probe.width,
                  mediaHeight: probe.height,
                  fps: probe.fps,
                  codecs: { video: probe.videoCodec, audio: probe.audioCodec },
                  dataJson: JSON.stringify({
                    durationSec: probe.durationSec,
                    hasAudio: probe.hasAudio,
                    width: probe.width,
                    height: probe.height,
                    fps: probe.fps,
                  }),
                };
                await ctx.assets.upsertRaw(enriched);
                saved.push(enriched);
                continue;
              }
            } catch { /* 探测失败不影响上传 */ }
          }
          saved.push(item);
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
        // ⚠️ 主动下载/内联的取舍：
        //    SVG 里可以带 <script>，而 /assets/item 与 SPA 同源。
        //    直接以 image/svg+xml 内联返回 = 存储型 XSS（用户点"下载"就执行）。
        //    这里对 SVG 一律强制 attachment，浏览器不会在同源下渲染它。
        //    其它类型仍可内联（图片/视频要能在页面里直接显示）。
        const forceDownload = ext === '.svg';
        const disposition = forceDownload
          ? { 'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(abs))}"` }
          : {};
        // 统一加 nosniff，避免浏览器把声明外的内容当脚本执行
        const baseHeaders = { 'X-Content-Type-Options': 'nosniff', ...disposition };
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
            ...baseHeaders,
          });
          return pipeStream(res, abs, range);
        }
        res.writeHead(200, {
          'Content-Type': mime, 'Content-Length': stat.size,
          'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
          ...baseHeaders,
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
    //
    // ⚠️ 只允许 dataDir 下的**指定子目录**，不是整个 dataDir。
    //    safeJoin 挡住了 `../`，但 dataDir 根下还有 config.json（含明文
    //    seedanceApiKey）、jobs.json、projects.json 等。实测
    //    `/file?path=config.json` 会 200 并把掩码保护的密钥原样吐出来 ——
    //    等于绕过了 /config 的掩码。
    //    这些文件没有任何前端需要，直接排除。
    if ((req.method === 'GET' || req.method === 'HEAD') && route === '/file') {
      const rel = url.searchParams.get('path');
      if (!rel) return sendJson(res, 400, { error: 'PATH_REQUIRED' });
      let abs;
      try {
        abs = safeJoin(cfg.dataDir, rel);      // 只允许 dataDir 内
      } catch {
        return sendJson(res, 403, { error: 'FORBIDDEN_PATH', path: rel });
      }
      if (!isServableDataPath(cfg.dataDir, abs)) {
        return sendJson(res, 403, {
          error: 'FORBIDDEN_PATH',
          detail: '只允许读取产物与素材子目录（outputs/assets/previz/post/comic/workflows）',
          path: rel,
        });
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
      return sendJson(res, 200, { fonts: listChineseFonts() });
    }

    return sendJson(res, 404, { error: `UNKNOWN_ROUTE: ${req.method} ${route}` });
  } catch (err) {
    // 参数校验类错误应当回 400，而不是把所有异常都算成 500。
    // 这样前端能区分"请求写错了"和"服务端炸了"，也便于排查。
    const msg = String(err?.message || err);
    const isCancel = err instanceof CancelledError;
    const isValidation = /^(INVALID_ID|INVALID_\w+|BAD_JSON|BODY_TOO_LARGE|FORBIDDEN_PATH|PROJECT_REQUIRED|PATH_REQUIRED)/.test(msg)
      || /_REQUIRED$/.test(msg);
    return sendJson(res, isCancel ? 409 : (isValidation ? 400 : 500), { error: msg });
  }
}

/* ------------------------------------------------------------ 辅助实现 */

/**
 * 批量出图（漫画逐格 / 模特套图）的产物归档。
 *
 * 这两条链路不走 `runJob`（在循环里直接调 runH3ImageLocal），所以
 * `runAndArchive` 覆盖不到。抽一个共用函数，两处复用。
 *
 * 失败不抛：产物已经生成，归档只是"让它进素材库"，属于可接受的降级。
 *
 * @returns {object|null} 归档后的素材项；失败返回 null
 */
async function archiveBatchOutput(ctx, cfg, output, opts = {}) {
  if (!output?.path) return null;
  try {
    return await ctx.assets.archiveFile(output.path, {
      type: opts.type ?? 'general',
      name: opts.name ?? path.basename(output.path),
      projectId: opts.projectId ?? null,
      tag: opts.tag ?? 'auto-archived',
      note: opts.note ?? '',
    });
  } catch {
    return null;
  }
}

/**
 * 跑一个任务，成功后把产物**自动归档进素材库**。
 *
 * 为什么需要：生成产物落在 `data/outputs/`（临时区），画布产物写回节点后
 * 就没人管了；渲染页、素材库都看不到。"画布 ↔ 渲染页"打不通的根因就是这个。
 *
 * 统一在这里归档，所有生成入口（/generate、/image/generate、
 * /breakdown/generate、/mw/job/generate、comic/render-panels）自动受益，
 * 不用每个入口各写一遍。
 *
 * 归档失败**不影响任务结果**——产物已经生成，只是没进素材库，属于可接受的降级。
 */
function runAndArchive(job, run, ctx) {
  return runJob(job, async (running, hooks) => {
    const result = await run(running, hooks);
    try {
      const outs = Array.isArray(result?.outputs) ? result.outputs : [];
      const archived = [];
      for (const o of outs) {
        if (!o?.path) continue;
        try {
          const item = await ctx.assets.archiveFile(o.path, {
            // ASSET_TYPES 白名单里没有 'video'，视频产物用 video_segment
            // （写 'video' 会被 asset-service 静默降级成 general）
            type: job.kind === 'image' ? 'general' : 'video_segment',
            name: `${job.kind === 'image' ? '图' : '片'}_${running.id}`,
            projectId: job.projectId ?? null,
            tag: 'auto-archived',
            note: String(running.prompt ?? '').slice(0, 200),
          });
          // ⚠️ 记下**源产物路径**，回填时按它对账。
          //    旧实现回填时拿 o.path（outputs/job_x.mp4）去 endsWith 归档后的
          //    新文件名（asset_y.mp4）—— 永远不匹配，于是前端 outputs[] 里
          //    永远没有 assetId / archivedRel，"产物自动归档"等于只在磁盘上发生，
          //    用户界面上看不出来。
          archived.push({ id: item.id, rel: item.rel, assetId: item.id, sourcePath: o.path });
        } catch { /* 单条失败不阻断 */ }
      }
      if (archived.length) {
        // 把素材 id 附在产物上，前端可直接引用（按源路径精确对账）
        const norm = (p) => String(p ?? '').replace(/\\/g, '/');
        result.outputs = outs.map((o) => {
          const hit = archived.find((a) => a.sourcePath && norm(a.sourcePath) === norm(o.path));
          return hit ? { ...o, assetId: hit.assetId, archivedRel: hit.rel } : o;
        });
      }
    } catch { /* 归档整体失败不影响产物 */ }
    return result;
  });
}

/**
 * 把项目绑定的角色卡解析进 shot。
 *
 * 实现已下沉到 services/shot-context.js（与 Agent 工具共用同一份），
 * 这里只做转发，避免再次出现"两份实现各自漂移"。
 */

/**
 * 列出可用的中文字体文件（ffmpeg drawtext 需要真实字体路径）。
 *
 * 不再硬编码盘符：用系统字体目录 + 环境变量覆盖，
 * 这样换机器 / 换平台都不会失效。也可以用 DSH_POST_FONT 显式指定。
 */
function listChineseFonts() {
  const out = [];
  const push = (p) => {
    try { if (p && fs.existsSync(p) && !out.includes(p)) out.push(p); } catch { /* ignore */ }
  };

  if (process.env.DSH_POST_FONT) push(process.env.DSH_POST_FONT);

  const names = [
    'msyh.ttc', 'msyhbd.ttc', 'simhei.ttf', 'simsun.ttc',   // Windows
    'PingFang.ttc', 'Hiragino Sans GB.ttc',                 // macOS
    'NotoSansCJK-Regular.ttc', 'wqy-zenhei.ttc', 'DejaVuSans.ttf', // Linux
  ];
  const dirs = [];
  if (process.env.SystemRoot) dirs.push(path.join(process.env.SystemRoot, 'Fonts'));
  if (process.env.WINDIR) dirs.push(path.join(process.env.WINDIR, 'Fonts'));
  dirs.push(
    '/System/Library/Fonts',
    '/Library/Fonts',
    '/usr/share/fonts',
    '/usr/share/fonts/truetype',
    '/usr/local/share/fonts',
  );
  for (const d of dirs) {
    for (const n of names) push(path.join(d, n));
  }
  return out;
}

// 允许通过 /file 读取的 dataDir 子目录（产物与素材）。
// 白名单而非黑名单：新增运行时文件时默认不会被读到。
const SERVABLE_DATA_DIRS = Object.freeze([
  'outputs', 'assets', 'previz', 'previz-shots', 'post', 'comic', 'tmp-inline', 'inputs',
]);

/**
 * abs 是否落在 dataDir 的可读子目录内。
 * @param {string} dataDir
 * @param {string} abs 已由 safeJoin 解析过的绝对路径
 */
function isServableDataPath(dataDir, abs) {
  const rel = path.relative(path.resolve(dataDir), path.resolve(abs));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const top = rel.split(path.sep)[0];
  return SERVABLE_DATA_DIRS.includes(top);
}

function guardNoToken(req) {
  // /token 只做 Origin 校验，不需要 token
  return _isLoopbackHost(req) && _isSameOrigin(req);
}

/**
 * 删除项目时清理它名下的运行时数据。
 *
 * 只清理**确定由项目派生**的目录/文件，绝不碰 assets/（素材是用户的资产，
 * 可能被多个项目引用；要删素材请走 /assets/delete）。
 *
 * @returns {{removed:string[], failed:string[]}}
 */
function cleanupProjectArtifacts(cfg, projectId) {
  const removed = [];
  const failed = [];
  const targets = [
    { label: 'shots', abs: path.join(cfg.dataDir, 'shots', projectId) },
    { label: 'cards', abs: path.join(cfg.dataDir, 'projects', projectId) },
    { label: 'script', abs: path.join(cfg.dataDir, 'script', `${projectId}.json`) },
    { label: 'comic', abs: path.join(cfg.dataDir, 'comic', `${projectId}.json`) },
  ];
  for (const t of targets) {
    try {
      if (!fs.existsSync(t.abs)) continue;
      fs.rmSync(t.abs, { recursive: true, force: true });
      removed.push(t.label);
    } catch (e) {
      failed.push(`${t.label}: ${String(e?.message ?? e)}`);
    }
  }
  return { removed, failed };
}

function projectSummary(p) {  return {
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

/**
 * 镜头表文件路径。
 *
 * ⚠️ projectId 必须过 safeId —— 这里是 `path.join(..., projectId, ...)`，
 *    不校验的话 `../../..` 能跳出 dataDir。REST 路由有校验，但 Agent 工具
 *    （studio_shot / studio_director / studio_generate）是直接调 listShots/upsertShot，
 *    之前完全没校验，`studio_shot { projectId: '../../../../tmp' }` 可写出数据目录。
 */
function shotsFile(projectId) {
  return path.join(dirs().root, 'shots', safeId(projectId), 'shots.json');
}

export function listShots(projectId) {
  let f;
  try { f = shotsFile(projectId); } catch { return []; }   // 非法 id 当作没有镜头，不抛
  if (!fs.existsSync(f)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** 整体写回镜头表（原子写） */
export function writeShots(projectId, list) {
  const f = shotsFile(projectId);      // 非法 id 在这里抛，调用方必须处理
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, f);
  return list;
}

export function upsertShot(projectId, shot) {
  const f = shotsFile(projectId);      // 非法 id 在这里抛
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const list = listShots(projectId);
  // mode 归一化统一放在**落盘口**：
  //   REST 可以直接传 body.shot（绕过 newShot），工具也走这里，
  //   只在 newShot 里归一化覆盖不到这些路径。
  const next = {
    ...shot,
    mode: normalizeMode(shot.mode, { hasRefImages: (shot.refs?.images?.length ?? 0) > 0 }),
    updatedAt: Date.now(),
  };
  if (!next.id) next.id = newShot().id;

  // ⚠️ validateShot 以前只被 import 从未调用 —— 镜头卡保存不做任何校验，
  //    9 张参考图上限、时长 1-15s、模式与图数匹配全都不生效。
  //    这里做**两件事**：把硬约束夹到合法区间（避免下游跑炸），并把警告挂到返回体。
  const raw = Number(next.durationSec);
  if (Number.isFinite(raw)) next.durationSec = Math.min(15, Math.max(1, raw));
  if (Array.isArray(next.refs?.images) && next.refs.images.length > 9) {
    next.refs = { ...next.refs, images: next.refs.images.slice(0, 9) };
  }
  const check = validateShot(next);
  next.validation = check;

  const idx = list.findIndex((s) => s.id === next.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, f);
  return next;
}

/**
 * 共享的生成入参准备（已下沉到 services/shot-context.js）。
 * 这里重新导出，保持既有调用点与测试的 import 路径不变。
 */
export { withVaultCards, resolveMediaRefs, writeBackProbe, resolvePictureIndices } from '../services/shot-context.js';

/**
 * 编译提示词。
 *
 * 优先走 **H3 官方六段式/三段式编译器**（services/h3-prompt.js），
 * 它按用户提供的技能书规范生成结构化提示词。
 * 镜头卡没给够字段时（无 subjects / 无 shots）退回简单的段落拼接，
 * 保证旧数据仍能生成。
 */
export function compilePrompt(shot) {
  // ⚠️ 手工提示词优先级最高：直接整段使用，不再走编译。
  //
  // 为什么必须放在最前面：用户在渲染页的提示词编辑器里写好的完整六段式，
  // 是**成品**，不是素材。早先的实现在编译后用
  // `pkg.sceneLayout += shot.prompt` 把整段塞进 SCENE LAYOUT 字段，
  // 结果模型收到的是「自动编译的骨架 + 后面挂一坨完整提示词」的畸形文本，
  // 两套 subject_definitions 互相打架。
  //
  // 判据：长度超过 200 字符才认为是"用户手写的完整提示词"，
  // 避免老数据里 `prompt: "一句话描述"` 这类简短备注被误当成成品。
  if (typeof shot.prompt === 'string' && shot.prompt.trim().length > 200) {
    return shot.prompt.trim().slice(0, 7000);
  }

  // 走官方结构：需要有 mode 或 styleId，或显式给了 subjects。
  // mode 统一归一化，短名（t2v/i2v/fl2v）也能正确进编译器分支。
  const mode = normalizeMode(shot.mode, { hasRefImages: (shot.refs?.images?.length ?? 0) > 0 });
  const useStructured = Boolean(mode || shot.styleId || shot.subjects?.length || shot.h3mode);
  if (useStructured) {
    try {
      // ⚠️ subjects 优先级：显式 subjects > 角色卡 > 从 description 猜。
      //    早先只看 shot.subjects，导致用角色卡生成的镜头 **summary 里没有角色名**
      //    （deriveSummary 拿不到 subjects，拼出「的一段戏。」这种残句）。
      //
      // ⚠️ pictureIndex 必须来自**真实参考图顺序**（resolvePictureIndices），
      //    不能是"第几张卡"。之前用 i+1：一旦有卡没图 / 有手工图 /
      //    有视频音频占位，编号就整体错位，提示词里的 <Picture N> 指错人。
      //    渲染页展示的编号（/render/plan）与这里必须一致。
      const cardSubjects = Array.isArray(shot.characterCards)
        ? resolvePictureIndices(shot)
        : [];
      const subjects = shot.subjects ?? (cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(shot));

      const pkg = toShotInputPackage(shot, {
        styleId: shot.styleId ?? null,
        subjects,
        scenes: shot.scenes ?? undefined,
        seed: shot.seed,
      });
      // 兼容旧字段：description/camera/style 已在 toShotInputPackage 里映射。
      //
      // 注意：这里**不再**把 `shot.prompt` 追加到 sceneLayout。
      // 完整的用户提示词已在函数开头直接返回；能走到这里的 `prompt`
      // 只可能是不足 200 字的简短备注，把它当场景补充说明更合理，
      // 所以限制为短文本，避免长文本重复灌入导致提示词畸形。
      if (shot.prompt && String(shot.prompt).trim().length <= 200) {
        pkg.sceneLayout = `${pkg.sceneLayout}\n${String(shot.prompt).trim()}`;
      }

      // ⚠️ 环境声/配乐要显式带过去。
      //    早先它们被 workbench 的默认值覆盖（"环境底噪" / "N/A"），
      //    用户在镜头卡里填的真实值根本没进提示词。
      if (shot.sound) pkg.overall_soundscape = shot.sound;
      if (shot.music) pkg.non_diegetic_music = shot.music;

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


async function executeBackend(job, shot, ctx, cfg, hooks) {
  const prompt = job.prompt || compilePrompt(shot);
  const outputsDir = path.join(cfg.dataDir, 'outputs');
  // 提交回调：把 remoteId 尽早落盘，否则"已提交未完成"期间取消无法通知远端
  const onSubmitted = hooks?.onSubmitted;

  if (job.backendId === 'h3-local') {
    // 统一走 services/generator.js（与 Agent 工具共用同一实现）
    return runH3Local({
      workflow: ctx.h3.loadWorkflow(),
      job, shot, prompt, cfg, onSubmitted,
    });
  }

  // 图像生成（H3-Image）：与视频共用编码器，只换扩散模型 + 图像 VAE
  if (job.backendId === 'h3-image' || jobKind(job) === 'image') {
    const wf = loadImageWorkflow(cfg);
    if (!wf) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');
    return runH3ImageLocal({ workflow: wf, job, shot, prompt, cfg, onSubmitted });
  }

  if (job.backendId === 'seedance-cloud') {
    return seedance.runSeedance({ cfg, job, shot, prompt });
  }

  // ⚠️ 只有显式 backendId === 'mock' 才走 mock。
  //    修掉"未知 backend 静默降级成 mock"：以前任何拼错的后端名（如写 'h3'
  //    而不是 'h3-local'）都会落进 mock，生成 ffmpeg 占位视频且状态 completed，
  //    用户拿到"假视频"还以为成了。
  if (job.backendId === 'mock') {
    return seedance.runMock({ cfg, job, shot, prompt });
  }

  throw new Error(
    `UNKNOWN_BACKEND: ${JSON.stringify(job.backendId)} 不是有效后端。`
    + `可选：h3-local / h3-image / seedance-cloud / mock`,
  );
}

/** 加载图像生成工作流（带缓存） */
//
// ⚠️ 曾经写成 path.join(dirs().root, 'workflows', 'h3-image.json')：
//    dirs().root 就是 cfg.dataDir（用户可改的运行时数据目录），而工作流模板
//    随插件分发在 <插件根>/data/workflows。用户一改数据目录就 WORKFLOW_MISSING。
//    现在统一走 services/workflow-paths.js 的单一真源。
function loadImageWorkflow(cfg = loadConfig()) {
  return readWorkflowCached('image', cfg);
}

/**
 * 模特工作台 → 参考图。
 *
 * 形象库（figures.json）里的形象带封面图片，job 通过 figure/role/model 引用它。
 * 旧实现从不读这些字段，形象库等于死数据；这里把它接进 characterRefs。
 *
 * ⚠️ 必须显式接收 ctx。
 *    上一版写成了 `resolveMwFigureRefs(job)` 然后在体内用 `ctx.mw`，
 *    但这是**模块级函数**，`ctx` 是 handleApi 里的局部变量 ——
 *    于是 `ReferenceError: ctx is not defined`，被下面的 catch 吞成 `[]`。
 *    表现：形象库选了也没用，出图不带任何形象参考，且不报错。
 */
function resolveMwFigureRefs(ctx, job) {
  try {
    const key = job?.figure ?? job?.role ?? job?.model ?? null;
    if (!key) return [];
    const figures = ctx?.mw?.listFigureItems?.() ?? [];
    const hit = figures.find((f) => f.id === key || f.name === key);
    if (!hit) return [];
    const imgs = [];
    if (hit.rel) imgs.push(hit.rel);
    if (hit.imageRel) imgs.push(hit.imageRel);
    if (Array.isArray(hit.images)) imgs.push(...hit.images.filter(Boolean));
    return imgs;
  } catch (e) {
    // 不再无声失败：至少留一条日志，方便定位形象库为什么没生效
    try { ctx?.extras?.appendLog?.({ level: 'warn', msg: `形象库参考图解析失败：${String(e?.message ?? e)}` }); } catch { /* ignore */ }
    return [];
  }
}
















