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
      return sendJson(res, 400, { error: 'USE_MULTIPART', detail: '请用 POST /assets/upload 的 multipart 形式' });
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

async function executeBackend(job, shot, ctx, cfg) {
  const prompt = job.prompt || compilePrompt(shot);
  const outputsDir = path.join(cfg.dataDir, 'outputs');

  if (job.backendId === 'h3-local') {
    const wf = ctx.h3.loadWorkflow();
    if (!wf) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3.json');
    const res = resolutionFor(shot.profile, shot.ratio);
    const prof = PROFILES[shot.profile] || PROFILES['P12-draft'];
    const map = {
      '{{PROMPT}}': prompt,
      '{{WIDTH}}': res.width,
      '{{HEIGHT}}': res.height,
      '{{LENGTH}}': h3Length(shot.durationSec),
      '{{STEPS}}': prof.steps,
      '{{CFG}}': prof.cfg,
      '{{FPS}}': 24,
      '{{SEED}}': job.params?.seed ?? 1101,
      // 模型选择：ref2v 用 Ref2VA，其余用 FL2VA（两模型不通用）
      '{{UNET_NAME}}': shot.mode === 'ref2v'
        ? 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors'
        : 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors',
      '{{CLIP_NAME}}': 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors',
      '{{VAE_NAME}}': 'minimax_h3_video_vae_fp16.safetensors',
      '{{LORA_NAME}}': shot.mode === 'ref2v'
        ? 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors'
        : 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
      '{{LORA_STRENGTH}}': Number(prof.steps) <= 8 ? 1.0 : 0.0,
    };

    // 首尾帧：有产物才接线，没有就整节点剔除（否则 ComfyUI 会因空字符串报错）
    const previzAbs = resolvePrevizArtifacts(ctx, shot);
    const staged = comfy.stageToComfyInput(cfg, previzAbs, job.id);
    const merged = { ...previzAbs, ...staged };
    const hasFirst = Boolean(merged['{{FIRST_FRAME}}']);
    const hasLast = Boolean(merged['{{LAST_FRAME}}']);
    if (hasFirst) map['{{FIRST_FRAME}}'] = merged['{{FIRST_FRAME}}'];
    if (hasLast) map['{{LAST_FRAME}}'] = merged['{{LAST_FRAME}}'];

    const wfCopy = structuredClone(wf);
    if (hasFirst) {
      const node6 = wfCopy.nodes.find((n) => n.id === 6);
      if (node6) (node6.inputs ||= []).push({ name: 'first_frame', type: 'IMAGE', link: null });
    } else {
      wfCopy.nodes = wfCopy.nodes.filter((n) => n.id !== 20);
    }
    if (hasLast) {
      const node6 = wfCopy.nodes.find((n) => n.id === 6);
      if (node6) (node6.inputs ||= []).push({ name: 'last_frame', type: 'IMAGE', link: null });
    } else {
      wfCopy.nodes = wfCopy.nodes.filter((n) => n.id !== 21);
    }

    return comfy.runWorkflow({ cfg, workflow: wfCopy, map, job, outputsDir });
  }

  if (job.backendId === 'seedance-cloud') {
    return seedance.runSeedance({ cfg, job, shot, prompt });
  }

  return seedance.runMock({ cfg, job, shot, prompt });
}

