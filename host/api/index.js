/**
 * REST 路由表。
 *
 * 全部挂在 /jiuzhang/api 前缀下（handler 路由，绕过 DSH 准入 → 必须自查 security）。
 * 前缀刻意与 DSH 自己的 /api 区分，绝不与 /api/* 冲突（审查实证 401 vs 200）。
 */
import path from 'node:path';
import { handleSse, emit, clientCount } from './events.js';
import fs from 'node:fs';
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from '../config.js';
import { guard, safeId, safeJoin, resolveUserPath, getWriteToken, isSameOrigin as _isSameOrigin, isLoopbackHost as _isLoopbackHost } from '../security.js';
import { dirs, projects, newProject, newShot, validateShot, PROFILES, resolutionFor, h3Length, H3_MODEL_SLOTS, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, normalizeMode, normalizeActors, normalizeProps, normalizeCamera3d, listActionCatalog } from '../store/models.js';
import * as comfy from '../services/comfy-client.js';
import * as mockBackend from '../services/mock-backend.js';
import { runJob, cancelJob, runtimeStats, CancelledError } from '../services/job-runner.js';
import { newJob, jobs as jobsStore, isLocalBackendOf } from '../services/job-store.js';
import { runH3Local, runH3Nanfeng, runH3ImageLocal, jobKind } from '../services/generator.js';
import { ACCEL_PLANS, ACCEL_PLAN_IDS, DEFAULT_ACCEL_PLAN } from '../services/accel-plan.js';
import { packGraph, unpackGraph, IMG_REF_PREFIX } from '../store/image-pool.js';
import { compileH3Prompt, toShotInputPackage, STYLE_PRESETS, LIGHTING_PRESETS, H3_MODES, H3_LIMITS } from '../services/h3-prompt.js';
import { H3_IMAGE_MODELS, H3_IMAGE_SIZES, IMAGE_VAE, IMAGE_CLIP, IMAGE_SAMPLING, checkImageModels } from '../services/h3-image.js';
import { BREAKDOWN_LEVELS, BREAKDOWN_SIZES, buildBreakdownPrompt, breakdownLevel, breakdownSize } from '../services/breakdown.js';
import {
  readProjectCards, writeProjectCards,
} from '../services/character-vault.js';
import { buildRenderPlan, subjectsForPrompt, buildMediaNotes } from '../services/render-plan.js';
import { probeMedia } from '../services/media-probe.js';
import { blenderStatus, buildSceneSpec, renderControl, listModelAssets, listAssetActions, openInBlender, prunePrevizRuns } from '../services/blender-service.js';
import { getCanvasPermissions, setCanvasPermissions, loadCanvasPermissions } from '../services/canvas-agent.js';
import { getRuntime } from '../runtime.js';
// 工作流模板定位 —— 单一真源（模板随插件分发，不跟随 dataDir）
import { readWorkflowCached, workflowDiagnostics } from '../services/workflow-paths.js';
// 生成入参准备 —— REST 与 Agent 工具共用同一份（角色卡解析 / 媒体探测 / 编号）
import {
  withVaultCards, resolveMediaRefs, writeBackProbe, resolvePictureIndices,
} from '../services/shot-context.js';

/* ------------------------------------------------------------- 工具函数 */

/** 合法后端枚举 —— 单一真源，路由与执行器共用 */
export const VALID_BACKENDS = new Set(['h3-nanfeng', 'h3-local', 'h3-image', 'mock']);

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

/**
 * 加速方案的对外投影（供前端下拉与排障展示）。
 *
 * 只暴露"用户需要知道的"：id / 标签 / 步数 / 采样器 / shift / 提示语。
 * 内部字段（strictSteps）不外泄，避免前端依赖实现细节。
 */
function accelPlanList() {
  return ACCEL_PLAN_IDS.map((id) => {
    const p = ACCEL_PLANS[id];
    return {
      id: p.id,
      label: p.label,
      family: p.family,
      steps: p.steps,
      sampler: p.sampler,
      scheduler: p.scheduler,
      shift: p.shiftVideo != null
        ? { video: `${p.shiftVideo}/${p.shiftAudio}` }
        : null,
      hint: p.hint,
      isDefault: id === DEFAULT_ACCEL_PLAN,
    };
  });
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
 * @param {object} ctx  插件上下文（含各服务）
 */
export async function handleApi(req, res) {
  const ctx = getRuntime();
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = url.pathname.replace(/^\/jiuzhang\/api/, '') || '/';

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

    // 画布 Agent 的权限位落盘在 dataDir 里，首次用到时载入一次。
    // （loadCanvasPermissions 只在文件不存在/损坏时静默回落默认值）
    if (route.startsWith('/canvas-agent')) loadCanvasPermissions(cfg);

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
        backends: [...VALID_BACKENDS],
      });
    }

    /**
     * SSE 事件流 —— 让「DSH 改了参数」在网页上立即看到。
     *
     * 这条路由必须放在 guard 之后（同源校验），但**不走 sendJson**：
     * 它保持长连接，持续写 `data: <json>\n\n`。
     */
    if (req.method === 'GET' && route === '/events') {
      return handleSse(req, res);
    }

    /* ---------------- 南风 V15 参数与预设 ---------------- */

    /**
     * 参数定义。前端据此自动生成表单，DSH Agent 据此了解可调项。
     * 只返回元信息（名/组/类型/默认值/选项），不含当前值。
     */
    if (req.method === 'GET' && route === '/nanfeng/schema') {
      const m = await import('../services/nanfeng/schema.js');
      /**
       * 用 enrichSchema() 而不是直接吐 PARAMS / GROUPS：
       * 参数的中文说明、调参建议、以及「死参数/禁用参数」标记都在
       * services/nanfeng/param-docs.js 里，前端要靠这些字段渲染说明面板。
       *
       * PARAMS 本身保持纯净（机读约束），graph.js 的类型强制依赖它。
       */
      const enriched = typeof m.enrichSchema === 'function'
        ? m.enrichSchema()
        : { paramCount: m.PARAM_COUNT, groups: m.GROUPS, params: m.PARAMS };
      return sendJson(res, 200, {
        ...enriched,
        // 前端「无效参数」提示条要用
        inert: typeof m.inertParams === 'function' ? m.inertParams() : [],
      });
    }

    /** 内置预设列表 */
    if (req.method === 'GET' && route === '/nanfeng/presets') {
      const m = await import('../services/nanfeng/presets.js');
      return sendJson(res, 200, {
        default: m.DEFAULT_PRESET,
        presets: m.listBuiltinPresets(),
        /**
         * V8.1 完整 Sigma 序列预设。
         *
         * `H3完整Sigma序列` 是 D 组的有效参数（别和 F 组的死参数 `手动西格玛` 搞混）。
         * 开潜空间二采时值的个数必须 = 一采步数 + 二采步数 + 1。
         */
        sigmas: Object.entries(m.SIGMA_PRESETS).map(([id, p]) => ({
          id, label: p.label, value: p.value,
          requiredSteps: p.requiredSteps ?? null,
          warning: p.warning ?? null,
        })),
        /** 加速方案（DMAD 等）—— 本轮的接线让它在南风路径上真正生效 */
        accelPlans: ACCEL_PLAN_IDS.map((id) => {
          const p = ACCEL_PLANS[id];
          return {
            id, label: p.label, family: p.family, steps: p.steps,
            sampler: p.sampler, scheduler: p.scheduler, lora: p.lora || null,
            hint: p.hint,
            shift: p.shiftVideo != null ? `${p.shiftVideo}/${p.shiftAudio}` : null,
            isDefault: id === DEFAULT_ACCEL_PLAN,
          };
        }),
      });
    }

    /** 取某预设合并后的完整参数（供前端"预览将提交什么"） */
    if (req.method === 'GET' && route.startsWith('/nanfeng/presets/')) {
      const id = safeId(decodeURIComponent(route.slice('/nanfeng/presets/'.length)));
      const p = await import('../services/nanfeng/presets.js');
      const g = await import('../services/nanfeng/graph.js');
      const { params, meta } = p.builtinPreset(id);
      if (!meta) return sendJson(res, 404, { error: 'PRESET_NOT_FOUND', id });
      const merged = g.mergeParams(params);
      const coerced = g.coerceTypes(merged);
      return sendJson(res, 200, { ...meta, params: coerced });
    }

    /* ---------------- 南风续写批次 ---------------- */

    /**
     * 续写批次 CRUD。
     *
     * 南风的续写靠「每段采样后把 AV latent 存进 ComfyUI/output/nanfeng_v15_context/
     * <sha256>/clip_<index>.safetensors，下一段再读上一段」实现跨镜头连续。
     * 批次状态由我们（而不是 ComfyUI 前端）管理，落盘在 <dataDir>/runs/。
     */

    /** 建批次 */
    if (req.method === 'POST' && route === '/nanfeng/continuation/batches') {
      const body = await readJsonBody(req);
      const pid = safeId(body.projectId);
      const cont = await import('../services/nanfeng/continuation.js');
      try {
        const batch = cont.createBatch({
          projectId: pid,
          shotIds: Array.isArray(body.shotIds) ? body.shotIds : [],
          preset: body.preset ?? 'continuation',
          contextLength: body.contextLength ?? '22',
          audioContextLength: body.audioContextLength ?? 24,
          trimFrames: body.trimFrames ?? null,
        });
        cont.saveBatch(cfg.dataDir, batch);
        return sendJson(res, 201, batch);
      } catch (e) {
        return sendJson(res, 400, { error: 'BATCH_INVALID', detail: String(e?.message || e) });
      }
    }

    /** 列批次 */
    if (req.method === 'GET' && route === '/nanfeng/continuation/batches') {
      const q = url.searchParams.get('projectId');
      const cont = await import('../services/nanfeng/continuation.js');
      const list = cont.listBatches(cfg.dataDir, q ? safeId(q) : null);
      return sendJson(res, 200, list);
    }

    /** 取单个批次 */
    if (req.method === 'GET' && route.startsWith('/nanfeng/continuation/batches/')) {
      const rest = route.slice('/nanfeng/continuation/batches/'.length);
      const cont = await import('../services/nanfeng/continuation.js');
      // /batches/<id>/next → 取下一段的任务 JSON
      if (rest.endsWith('/next')) {
        const id = safeId(rest.slice(0, -'/next'.length));
        const b = cont.loadBatch(cfg.dataDir, id);
        if (!b) return sendJson(res, 404, { error: 'BATCH_NOT_FOUND', id });
        const idx = cont.nextPendingIndex(b);
        if (idx == null) return sendJson(res, 200, { done: true, batch: b });
        return sendJson(res, 200, {
          done: false,
          index: idx,
          shotId: b.shots.find((s) => s.index === idx)?.shotId ?? null,
          task: cont.taskFor(b, idx),
          contextFolder: b.contextFolder,
        });
      }
      const id = safeId(rest);
      const b = cont.loadBatch(cfg.dataDir, id);
      if (!b) return sendJson(res, 404, { error: 'BATCH_NOT_FOUND', id });
      return sendJson(res, 200, b);
    }

    /** 更新某段状态 */
    if (req.method === 'POST' && route === '/nanfeng/continuation/segment') {
      const body = await readJsonBody(req);
      const cont = await import('../services/nanfeng/continuation.js');
      const b = cont.loadBatch(cfg.dataDir, safeId(body.batchId));
      if (!b) return sendJson(res, 404, { error: 'BATCH_NOT_FOUND' });
      const seg = b.shots.find((s) => s.index === Number(body.index));
      if (!seg) return sendJson(res, 404, { error: 'SEGMENT_NOT_FOUND' });
      for (const k of ['status', 'jobId', 'outputRel', 'frames', 'error']) {
        if (body[k] !== undefined) seg[k] = body[k];
      }
      cont.advanceStatus(b);
      cont.saveBatch(cfg.dataDir, b);
      // 广播批次进度：批量续写在跑时，前端要实时看到第几段
      emit({
        type: 'batch-progress',
        batchId: b.batchId,
        current: b.shots.filter((s) => s.status === 'completed').length,
        total: b.shots.length,
        status: b.status,
      });
      return sendJson(res, 200, b);
    }

    /* ---------------- 续写批次：服务端编排 ---------------- */

    /**
     * 规划分段：从目标总时长反推每段请求时长。
     *
     * 为什么是后端算而不是前端：帧数必须落在 17k+5 网格上，
     * 而 `context_length` 会吃掉固定帧数 —— 前端自己算必然对不上。
     */
    if (req.method === 'POST' && route === '/nanfeng/continuation/plan') {
      const body = await readJsonBody(req);
      const cont = await import('../services/nanfeng/continuation.js');
      try {
        const plan = cont.planSegments({
          targetSeconds: body.targetSeconds ?? 45,
          segments: body.segments ?? 9,
          contextLength: body.contextLength ?? '22',
        });
        return sendJson(res, 200, plan);
      } catch (e) {
        return sendJson(res, 400, { error: String(e?.message || e) });
      }
    }

    /**
     * 一键跑完整个续写批次。
     *
     * 立即返回（编排在后台跑），进度通过 SSE `batch-progress` 推送。
     * 断点续跑：已完成段会跳过，只跑未完成的。
     */
    if (req.method === 'POST' && route === '/nanfeng/continuation/batches/run') {
      const body = await readJsonBody(req);
      const cont = await import('../services/nanfeng/continuation.js');
      const batchId = safeId(body.batchId);
      const b0 = cont.loadBatch(cfg.dataDir, batchId);
      if (!b0) return sendJson(res, 404, { error: 'BATCH_NOT_FOUND' });
      if (b0.status === 'running') {
        return sendJson(res, 409, { error: 'BATCH_ALREADY_RUNNING', batchId });
      }

      // 允许显式重置失败段后重跑
      if (body.resetFailed) {
        cont.resetFromFailure(b0);
        cont.saveBatch(cfg.dataDir, b0);
      }

      const projectShots = listShots(b0.projectId);
      const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : undefined;

      // 后台跑，不阻塞 HTTP
      (async () => {
        try {
          await cont.runBatch({
            dataDir: cfg.dataDir,
            batchId,
            onProgress: (e) => emit({ type: 'batch-progress', ...e }),
            runOne: async (seg, taskJson, index) => {
              const shot = projectShots.find((s) => s.id === seg.shotId);
              if (!shot) throw new Error(`第 ${index} 段的镜头 ${seg.shotId} 不存在`);

              // 段 1 不开续写（没有前一段）；段 2+ 才带 continuationTask
              /**
               * 续写任务：**段 1 也必须带**（index=1）。
               *
               * ⚠️ 直觉上"段 1 没有上一段不该带"，但南风 V15 把读/写 latent
               *    都挂在同一个 `if continuation:` 下（h3_generator.py:1620/2043）。
               *    段 1 不带 → 不保存 latent → 段 2 Load clip_1 直接报
               *    "is neither a file nor a folder"。
               *
               * 官方设计就是首段 Load 0 / Save 1：
               *    Load clip_index=0 不读文件、条件透传、trim_frames=0（不裁）
               *    Save clip_index=1 把本段 AV latent 存成 clip_1
               */
              const job = newJob({
                projectId: b0.projectId,
                shotId: seg.shotId,
                backendId: 'h3-nanfeng',
                prompt: '',
                params: {
                  nanfengPreset: b0.preset,
                  nanfengMode: shot.mode,
                  continuationTask: taskJson,
                  ...(seed !== undefined ? { seed } : {}),
                  batchId,
                  batchIndex: index,
                },
                mode: shot.mode,
              });
              await jobsStore().upsert(job);
              emit({ type: 'batch-progress', batchId, index, status: 'segment-submitted', jobId: job.id });

              /**
               * ⚠️ **必须真正启动执行**，不能只 upsert 就等。
               *
               * 历史 bug（本轮引入并当场抓到）：这里只建了 job + 轮询，
               * 忘了调 runAndArchive —— 任务永远停在 `queued`，
               * 批次永远卡在第 1 段，前端看起来像"卡死"。
               *
               * 执行入口必须是 `executeBackend`（与 REST/工具共用同一实现），
               * 并包 runAndArchive 以做产物归档。
               * 注意**不要 await** 这个 Promise —— 它要跑几分钟，我们靠下面的
               * 轮询等待终态，await 会与轮询形成双重等待。
               */
              runAndArchive(
                job,
                (running, hooks) => executeBackend(running, shot, ctx, cfg, hooks),
                ctx,
              ).catch((e) => {
                ctx.logger?.warn?.(
                  `[jiuzhang] 续写批次 ${batchId} 第 ${index} 段执行失败：${String(e?.message || e)}`,
                );
              });

              // 等待这一段真正跑完（runBatch 是串行的，这里必须等）
              await new Promise((resolve, reject) => {
                const t0 = Date.now();
                const timer = setInterval(async () => {
                  let cur;
                  try {
                    cur = await jobsStore().get(job.id);
                  } catch { return; /* 读盘抖动，下一轮再试 */ }
                  const st = cur?.status;
                  if (st === 'completed') {
                    clearInterval(timer);
                    seg.outputRel = cur.outputs?.[0]?.rel ?? null;
                    seg.frames = cur.outputs?.[0]?.frames ?? null;
                    resolve();
                  } else if (st === 'failed' || st === 'cancelled') {
                    clearInterval(timer);
                    const e = new Error(cur?.error || `第 ${index} 段${st}`);
                    e.jobId = job.id;
                    reject(e);
                  } else if (Date.now() - t0 > 60 * 60 * 1000) {
                    clearInterval(timer);
                    reject(new Error(`第 ${index} 段超时（>1h）`));
                  }
                }, 2000);
              });

              return { jobId: job.id, outputRel: seg.outputRel, frames: seg.frames };
            },
          });
        } catch (e) {
          ctx.logger?.warn?.(
            `[jiuzhang] 续写批次 ${batchId} 编排失败：${String(e?.message || e)}`,
          );
          emit({ type: 'batch-progress', batchId, status: 'failed', error: String(e?.message || e) });
        }
      })();

      return sendJson(res, 202, { ok: true, batchId, status: 'starting' });
    }

    /** 重置失败段（供重跑） */
    if (req.method === 'POST' && route === '/nanfeng/continuation/batches/reset') {
      const body = await readJsonBody(req);
      const cont = await import('../services/nanfeng/continuation.js');
      const b = cont.loadBatch(cfg.dataDir, safeId(body.batchId));
      if (!b) return sendJson(res, 404, { error: 'BATCH_NOT_FOUND' });
      const r = cont.resetFromFailure(b);
      cont.saveBatch(cfg.dataDir, b);
      return sendJson(res, 200, { ...r, batch: b });
    }

    /* ---------------- 智能分镜（DSH 内部 LLM） ---------------- */

    /** 分镜能力状态 */
    if (req.method === 'GET' && route === '/nanfeng/storyboard/meta') {
      const sb = await import('../services/nanfeng/storyboard.js');
      const llm = await import('../services/nanfeng/dsh-llm.js');
      const m = await import('../services/nanfeng/schema.js').catch(() => null);
      return sendJson(res, 200, {
        modes: sb.STORYBOARD_MODES,
        skills: Object.entries(sb.SKILLS).map(([id, s]) => ({ id, label: s.label, desc: s.desc })),
        llm: llm.llmStatus(ctx, cfg),
        _schemaUnused: Boolean(m),
      });
    }

    /**
     * 生成分镜。
     *
     * 流程：逐图视觉分析 → 文本模型写分镜 → 解析成 segments。
     * 全程走 DSH 内部 LLM，不需要任何 API Key。
     */
    if (req.method === 'POST' && route === '/nanfeng/storyboard/generate') {
      const body = await readJsonBody(req);
      const sb = await import('../services/nanfeng/storyboard.js');
      const llm = await import('../services/nanfeng/dsh-llm.js');

      const count = Math.max(1, Math.min(12, Number(body.count) || 1));
      const mode = String(body.mode || 'ref2va');
      if (!sb.STORYBOARD_MODES[mode]) {
        return sendJson(res, 400, { error: 'UNKNOWN_MODE', mode, valid: Object.keys(sb.STORYBOARD_MODES) });
      }
      if (!llm.llmStatus(ctx, cfg).available) {
        return sendJson(res, 503, {
          error: 'LLM_UNAVAILABLE',
          detail: llm.llmStatus(ctx, cfg).reason,
        });
      }

      // 图片：把 dataDir 相对路径解析成绝对路径
      //
      // ⚠️ 不要静默吞异常：路径写错时调用方只会看到 images:0，
      //    完全不知道是哪张图、为什么没进来。收集到 badRels 一起返回。
      //
      // ⚠️ resolveUserPath 的签名是**对象参数** ({ root, input, allowSubdirs, mustExist })。
      //    历史 bug：这里曾写成 `resolveUserPath(cfg, rel)`，于是 `root` 收到整个 cfg
      //    对象、`input` 是 undefined → 内部 `String(input ?? '').trim()` 拿不到值，
      //    每次都在 catch 里被记成 badRels。表现是"传了图但 images:0，且不报错"，
      //    智能分镜的看图能力实际上完全不可用。
      const images = [];
      const badRels = [];
      for (const rel of (Array.isArray(body.imageRels) ? body.imageRels : [])) {
        try {
          const abs = resolveUserPath({
            root: cfg.dataDir, input: rel, mustExist: true,
          });
          images.push({ index: images.length + 1, absPath: abs, name: path.basename(abs) });
        } catch (e) {
          badRels.push(`${rel}（${String(e?.message || e)}）`);
        }
      }

      try {
        // 1) 逐图分析（有图才做）
        let analysis = '';
        if (images.length) {
          const parts = [];
          for (const img of images) {
            const text = await llm.callVision(ctx, cfg, {
              prompt: sb.visionPrompt(img.index),
              images: [img],
            });
            const clean = text.replace(/^\s*@图片\d+\s*[:：]\s*/, '').trim();
            parts.push(`@图片${img.index}：${clean}`);
          }
          analysis = parts.join('\n\n');
        }

        // 2) 生成分镜
        const messages = sb.buildStoryboardMessages({
          idea: body.idea,
          count,
          mode,
          // ⚠️ 必须透传 —— 以前漏了，导致 ns_storyboard（海螺版）永远不可达
          skillId: body.skillId ?? 'regular_storyboard',
          images,
          analysis,
          durationSeconds: Number(body.durationSec) || 5,
          contextLength: body.contextLength != null ? Number(body.contextLength) : undefined,
        });
        const outText = await llm.callText(ctx, cfg, {
          system: messages[0].content,
          user: messages[1].content,
          maxTokens: sb.outputBudget(count),
        });

        // 3) 解析
        const parsed = sb.parseStoryboard(outText, count);
        return sendJson(res, 200, {
          mode,
          count,
          global: parsed.global,
          segments: parsed.segments,
          analysis,
          raw: parsed.raw,
          ...(badRels.length ? { badRels } : {}),
        });
      } catch (e) {
        return sendJson(res, 400, {
          error: 'STORYBOARD_FAILED',
          detail: String(e?.message || e),
        });
      }
    }

    if (req.method === 'GET' && route === '/health') {
      const h3 = await comfy.health(cfg);
      // 工作流模板是否就位 —— 首装最容易踩的坑，直接在健康检查里暴露
      const wfH3 = workflowDiagnostics('h3', cfg);
      const wfImg = workflowDiagnostics('image', cfg);
      return sendJson(res, 200, {
        ok: true,
        h3,
        blender: blenderStatus(),
        // 当前生效的加速方案 + 全部可选方案（前端下拉直接用，不用硬编码）
        accel: {
          current: cfg.accelPlan,
          plans: accelPlanList(),
        },
        workflows: {
          h3: { exists: wfH3.exists, dir: wfH3.dir },
          image: { exists: wfImg.exists, dir: wfImg.dir },
          ok: wfH3.exists && wfImg.exists,
        },
        /** SSE 长连接数（前端据此判断"是否有人在看"） */
        events: { clients: clientCount() },
      });
    }
    // 加速方案列表（含每个方案的实际参数，便于前端展示与排障）
    if (req.method === 'GET' && route === '/accel/plans') {
      return sendJson(res, 200, {
        ok: true,
        current: cfg.accelPlan,
        plans: accelPlanList(),
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
      /**
       * sanitizeConfigPatch 会对 comfyUrl 做 SSRF 校验（只允许本机 http(s)），
       * 不合法时抛 INVALID_COMFY_URL。这里接住并返回 400 + 明确原因 ——
       * 否则会被顶层 catch 归成 500，用户只看到一串错误码。
       */
      let patch;
      try {
        patch = sanitizeConfigPatch(body);
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.startsWith('INVALID_COMFY_URL')) {
          return sendJson(res, 400, { error: 'INVALID_COMFY_URL', detail: msg });
        }
        throw e;
      }
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
          seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : 1101,
          // 加速方案：请求体可覆盖（单次尝试），否则由 shot/cfg 决定
          ...(typeof body.accelPlan === 'string' && body.accelPlan
            ? { accelPlan: body.accelPlan }
            : {}),
          ...(Number.isFinite(Number(body.steps)) ? { steps: Number(body.steps) } : {}),
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

    /* 剧本 / 漫画 / 模特三个模块已整体删除（2.0.0）。原路由与空壳服务不再保留，
       这里不写占位注释 —— 空标题会让人以为功能只是没接上。 */
    /* ---------------- 漫画出图 ---------------- */

    /* ---------------- Blender 预演渲染 ---------------- */
    //
    // 从镜头卡直接渲出 H3 的**控制序列**（depth / pose / canny / gray）。
    // 与 /previz/video 的区别：那条走的是旧的 three.js 预演引擎，只能出 RGB；
    // 这条走 Blender，能出 ControlNet 真正需要的条件通道。
    // 见 host/services/blender-service.js 顶部说明（含 GPL 边界）。
    if (req.method === 'GET' && route === '/blender/health') {
      return sendJson(res, 200, blenderStatus());
    }

    // 3D 资产库（glb/gltf/fbx/obj）—— 供走位编辑与动作选择用
    if (req.method === 'GET' && route === '/blender/assets') {
      return sendJson(res, 200, { assets: listModelAssets(cfg) });
    }

    // 动作目录 —— **单一真源**（host/blender/actions.py）下发给前端。
    //
    // 为什么需要这个接口：动作名的三份枚举（前端下拉 / 后端白名单 /
    // Python 实现）历史上各写各的，漂移到 57/59/27，导致 32 个动作
    // "能选但不生效"。现在 Python 是唯一真源，前端只渲染它给的东西。
    if (req.method === 'GET' && route === '/blender/actions/catalog') {
      const actions = listActionCatalog();
      return sendJson(res, 200, {
        actions,
        groups: [...new Set(actions.map((a) => a.group))].map((g) => ({
          id: g,
          label: actions.find((a) => a.group === g)?.groupLabel ?? g,
        })),
        count: actions.length,
      });
    }

    // 用桌面 Blender 打开最近的场景（.blend）—— 用户要"真能调"就走这条
    if (req.method === 'POST' && route === '/blender/open') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await openInBlender({
        blendPath: body.blendRel ? String(body.blendRel) : '',
        cfg,
      }));
    }

    // 读某个模型内部的动作名（真的启一次 Blender 去读，不让用户猜）
    if (req.method === 'POST' && route === '/blender/actions') {
      const body = await readJsonBody(req);
      const rel = String(body.assetRel || '');
      if (!rel) return sendJson(res, 400, { error: 'ASSET_REQUIRED' });
      return sendJson(res, 200, await listAssetActions({ assetRel: rel, cfg }));
    }

    if (req.method === 'POST' && route === '/blender/render') {
      const body = await readJsonBody(req);
      const mode = String(body.mode || 'blockout');
      const pid = body.projectId ? safeId(body.projectId) : '';
      const shot = body.shot ?? (pid && body.shotId
        ? listShots(pid).find((s) => s.id === body.shotId)
        : null);
      if (!shot) return sendJson(res, 404, { error: 'SHOT_NOT_FOUND' });
      const spec = body.spec ?? buildSceneSpec(shot, { frames: body.frames });
      const r = await renderControl({
        mode,
        spec,
        cfg,
        jobId: String(body.jobId || shot.id || ''),
        timeoutMs: Math.max(30000, Math.min(900000, Number(body.timeoutMs) || 600000)),
      });
      return sendJson(res, 200, r);
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
          // 接受 rel（dataDir 相对）或绝对路径，但都必须落在 dataDir 内。
          //
          // ⚠️ 历史漏洞：`path.isAbsolute(it.path) ? it.path : safeJoin(...)`
          //    对绝对路径**完全放行**。asset-service 的扩展名白名单含
          //    .json/.txt/.md/.svg，于是
          //      POST /assets/archive {"items":[{"path":"C:/Users/x/.docker/config.json"}]}
          //    能把任意本机文件复制进素材库再下载（实测成功读到 Windows hosts）。
          //    /file 有 SERVABLE_DATA_DIRS 白名单挡着，但 archive 是服务端自己
          //    把文件搬进 assets/，天然绕过那层。
          const abs = resolveUserPath({
            root: cfg.dataDir,
            input: typeof it.path === 'string' && it.path ? it.path : it.rel,
            mustExist: true,
          });
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

      // 视频/音频的用途说明交给编译器——它们属于 subject_definitions 段。
      //
      // ⚠️ 历史缺陷：这里曾把 `reference_notes:\n…` 拼在提示词**最前面**。
      //    `reference_notes` 不是官方字段，而且官方明确"模型对开头权重最高"，
      //    说明句堆在开头会与风格定调争权重。现在通过 pkg.mediaNotes 喂给
      //    subject_definitions（见 h3-prompt 的 compileRef2VA）。
      pkg.mediaNotes = buildMediaNotes(plan);

      const compiled = compileH3Prompt(pkg);

      return sendJson(res, 200, {
        ...compiled,
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
      // 只构建一次：以前 preview 和 chars 各调一次，纯性能浪费
      const prompt = buildBreakdownPrompt(body, lv.id);
      return sendJson(res, 200, {
        level: lv.id,
        prompt,
        chars: prompt.length,
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

      /**
       * 参考图：绝对路径或 dataDir 相对路径。
       *
       * ⚠️ 以前这里三种失败（空路径 / 不存在 / 越界）**全部静默跳过**，
       *    于是一个空输入也会照常提交 t2i 任务 —— 而提示词正文里还写着
       *    "参考图是《X》的立绘，据此绘制设定卡"。模型收到"指代一张不存在
       *    的图"的指令，产出随机角色，任务却是 completed，用户以为成功。
       *
       *    现在：一张都没解析出来直接 400；部分失败把原因回传给调用方。
       */
      const refAbs = [];
      const badRels = [];
      for (const r of (Array.isArray(body.refImages) ? body.refImages : [])) {
        const raw = String(r ?? '').trim();
        if (!raw) { badRels.push('（空路径）'); continue; }
        if (path.isAbsolute(raw)) {
          if (fs.existsSync(raw)) refAbs.push(raw);
          else badRels.push(`${raw}（文件不存在）`);
          continue;
        }
        try {
          const a = safeJoin(cfg.dataDir, raw);
          if (fs.existsSync(a)) refAbs.push(a);
          else badRels.push(`${raw}（文件不存在）`);
        } catch (e) {
          badRels.push(`${raw}（${String(e?.message || e)}）`);
        }
      }
      if (!refAbs.length) {
        return sendJson(res, 400, {
          error: 'REF_IMAGE_REQUIRED',
          detail: '立绘拆解必须提供至少一张参考图（原立绘或设定图）。'
            + '没有参考图时模型会凭空造一个角色，产出不可用。',
          badRels,
        });
      }

      // 尺寸超限在**请求期**就挡住，而不是等任务跑起来才在异步里炸
      const mp = (size.w * size.h) / 1e6;
      const maxMp = Number(cfg.imageMaxMP) || 4.3;
      if (mp > maxMp) {
        return sendJson(res, 400, {
          error: 'IMAGE_SIZE_TOO_LARGE',
          detail: `${size.w}×${size.h} ≈ ${mp.toFixed(2)}MP，超过上限 ${maxMp}MP。`,
          sizes: BREAKDOWN_SIZES,
        });
      }

      const job = newJob({
        projectId: body.projectId ? safeId(String(body.projectId)) : null,
        shotId: null,
        backendId: 'h3-image',
        prompt,
        params: {
          kind: 'image',
          // 标记这是立绘拆解任务 —— 图像页的「最近任务」要把它排除，
          // 否则两类任务混在一起看不出哪个是哪个（它们 backendId 相同）。
          breakdown: true,
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

      return sendJson(res, 200, {
        ...job, refCount: refAbs.length, level: lv.id, badRels,
      });
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

    /* ---------------- H3 提示词编译 ---------------- */
    if (req.method === 'GET' && route === '/prompt/meta') {
      return sendJson(res, 200, {
        styles: STYLE_PRESETS,
        /**
         * 打光通道（光比预设）。
         *
         * 南风 217 参数里**没有任何打光参数** —— H3 是纯提示词驱动的扩散模型，
         * 打光只能靠 detailed_description 的文字。这里把「4:1 / 8:1 打光」
         * 这种摄影术语翻译成模型能执行的视觉描述（光比、档数、阴影硬度）。
         * 与画风正交，可任意组合。
         */
        lightings: LIGHTING_PRESETS,
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

      /**
       * ⚠️ 必须走**与真实生成相同**的入参准备。
       *
       * 历史缺陷：这里用 `deriveSubjectsFromShot(shot)`，而 `/generate` 走的是
       * `withVaultCards()` → `resolvePictureIndices()`（角色卡优先）。
       * 后果：用户在预览里看到的提示词**没有角色卡**（`<Subject N>` 缺失、
       * 只有从 description 猜出来的空壳），但真正送进模型的却有。
       * 预览与实物不一致，是这个项目最难查的一类 bug。
       *
       * 现在：有 pid 就走 withVaultCards，与生成路径完全同一份逻辑。
       */
      let prepared = shot;
      if (pid) {
        prepared = await withVaultCards(shot, pid, ctx, cfg);
      }
      const cardSubjects = Array.isArray(prepared.characterCards)
        ? resolvePictureIndices(prepared, cfg)
        : [];
      const subjects = body.subjects
        ?? (cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(prepared));

      const pkg = toShotInputPackage(prepared, {
        styleId: body.styleId ?? prepared.styleId ?? null,
        subjects,
        scenes: body.scenes,
        seed: body.seed,
      });
      const r = compileH3Prompt(pkg);
      return sendJson(res, 200, {
        ...r,
        package: pkg,
        subjectCount: subjects.length,
        fromVault: cardSubjects.length > 0,
      });
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
    /**
     * 服化道 → 生成入参（参考图 + 提示词片段）。
     *
     * 为什么放在服务端而不是前端拼：渲染页、Agent 工具、以及将来任何入口
     * 都必须拿到同一份转换结果，否则又是"两处各写一份、慢慢漂移"。
     * 纯计算、无副作用，但仍然走 POST（要带 id 数组，放 query 不合适）。
     */
    if (req.method === 'POST' && route === '/wardrobe/resolve') {
      const body = await readJsonBody(req);
      const r = ctx.extras.wardrobeToGeneration(body.ids ?? []);
      return sendJson(res, 200, {
        ok: true,
        images: r.images,
        notes: r.notes,
        count: r.items.length,
        items: r.items.map((w) => ({ id: w.id, kind: w.kind, name: w.name, hasImage: Boolean(w.imageRel) })),
      });
    }

    /* ---------------- 工具箱数据健康 ---------------- */
    /**
     * 数据文件损坏报告。
     *
     * extras 的读路径遇到坏 JSON 会降级为空列表（否则整个工具箱打不开），
     * 但必须让用户看到"你的模板文件坏了、已备份"，而不是静默显示空列表。
     */
    if (req.method === 'GET' && route === '/toolbox/health') {
      return sendJson(res, 200, { ok: true, warnings: ctx.extras.warnings() });
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

    // 3D 预演渲染产物的占用情况 + 手动清理入口。
    //
    // ⚠️ 这块历史完全没有清理路径：实测 5 次渲染在
    //    data/previz/blender/ 留下 452 文件 / 74 MB，
    //    而 extras.findOrphans 只管 data/assets/，previz 不在视野内。
    //    现在渲染完成后自动按保留策略清理，同时提供手动入口。
    if (req.method === 'GET' && route === '/resources/previz') {
      const root = path.join(cfg.dataDir, 'previz', 'blender');
      let runs = [];
      try {
        runs = fs.readdirSync(root, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => {
            const abs = path.join(root, e.name);
            let bytes = 0;
            let files = 0;
            const walk = (d) => {
              for (const it of fs.readdirSync(d, { withFileTypes: true })) {
                const p = path.join(d, it.name);
                if (it.isDirectory()) walk(p);
                else { try { bytes += fs.statSync(p).size; files += 1; } catch { /* ignore */ } }
              }
            };
            try { walk(abs); } catch { /* ignore */ }
            return { name: e.name, bytes, files };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      } catch { /* 目录不存在 */ }
      return sendJson(res, 200, {
        runs,
        count: runs.length,
        totalBytes: runs.reduce((s, r) => s + r.bytes, 0),
        policy: { keepRuns: 8, maxBytes: 2 * 1024 ** 3 },
      });
    }
    if (req.method === 'POST' && route === '/resources/previz/clean') {
      const body = await readJsonBody(req);
      const result = prunePrevizRuns(cfg, {
        keepRuns: Math.max(1, Math.min(100, Number(body.keepRuns) || 8)),
        maxBytes: Math.max(0, Number(body.maxBytes) || 2 * 1024 ** 3),
      });
      return sendJson(res, 200, { ok: true, ...result });
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
      return sendJson(res, 200, { ...ctx.canvasAgent.meta(), permissions: getCanvasPermissions() });
    }
    /**
     * 授权写入口 —— **修 P0**。
     *
     * 历史缺陷：`setCanvasPermission()` 全仓库零调用，而 canSpend/canDelete
     * 的初值都是 false → generate_image / generate_video / delete_node /
     * call_skill 四个工具**永久不可用**，前端 4 个开关只改本地 state。
     *
     * 这条路由是 PUT/PATCH 语义的写操作，已经过 guard() 的
     * 同源校验 + X-JZ-Token 校验，所以可以放心接受调用。
     * 授权结果落盘（dataDir/canvas-permissions.json），重启后保留。
     */
    if ((req.method === 'POST' || req.method === 'PUT') && route === '/canvas-agent/permissions') {
      const body = await readJsonBody(req);
      const patch = body?.permissions ?? body ?? {};
      const next = setCanvasPermissions(patch, cfg);
      return sendJson(res, 200, { ok: true, permissions: next });
    }
    if (req.method === 'POST' && route === '/canvas-agent/exec') {
      const body = await readJsonBody(req);
      const name = String(body.name || '');
      const ctxIn = body.context ?? {};
      // 项目 id 可选：给了才去后端补资产/镜头，否则用前端传的 context
      const rawPid = body.projectId ? safeId(String(body.projectId)) : '';
      // ⚠️ permissions 一律用**服务端**的，忽略请求体里的同名字段。
      //    历史实现直接透传 body.context，调用方可以自报 canDelete:true
      //    绕过所有 need() 检查 —— 权限位本应是前端确认提示，
      //    真正的边界必须在服务端。
      //    其余字段（assets / shots / selection 等）仍可从前端带，
      //    但服务端会用项目数据覆盖关键项。
      const rest = { ...(ctxIn && typeof ctxIn === 'object' ? ctxIn : {}) };
      delete rest.permissions;                 // 请求体里的权限声明一律不认
      const enriched = { ...rest, permissions: getCanvasPermissions() };
      if (rawPid) {
        if (!ctxIn.assets) enriched.assets = await ctx.assets.list({ projectId: rawPid });
        if (!ctxIn.shots) enriched.shots = listShots(rawPid);
      }
      return sendJson(res, 200, await ctx.canvasAgent.exec(name, body.arguments ?? {}, enriched));
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
    //    safeJoin 挡住了 `../`，但 dataDir 根下还有 config.json（可能含明文
    //    密钥等敏感字段）、jobs.json、projects.json 等。实测
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
export function cleanupProjectArtifacts(cfg, projectId) {
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
  //
  // ⚠️ 只归一化**传了的字段**。以前无条件对 actors/props/camera3d 做
  //    normalize，部分保存（只改 nanfeng/description）会把这些字段
  //    重置成空数组/null，把镜头卡写坏。
  const next = {
    ...shot,
    ...(shot.mode !== undefined
      ? { mode: normalizeMode(shot.mode, { hasRefImages: (shot.refs?.images?.length ?? 0) > 0 }) }
      : {}),
    // 3D 预演结构化数据同样在落盘口收敛 —— 这三个字段决定 Blender 渲什么，
    // 形状错了整镜渲不出来（且错误信息会很难懂）。
    ...(shot.actors !== undefined ? { actors: normalizeActors(shot.actors) } : {}),
    ...(shot.props !== undefined ? { props: normalizeProps(shot.props) } : {}),
    ...(shot.camera3d !== undefined ? { camera3d: normalizeCamera3d(shot.camera3d) } : {}),
    updatedAt: Date.now(),
  };
  if (!next.id) next.id = newShot().id;

  const idx = list.findIndex((s) => s.id === next.id);
  /**
   * 先合并出**完整记录**，再校验。
   *
   * ⚠️ 顺序很重要：
   *    1) 部分保存时 next 只有几个字段，直接校验必然报"时长缺失"等假错
   *    2) 校验和夹取要作用在合并后的完整记录上，写盘后才是合法的镜头卡
   *
   * 合并语义：显式传 null 表示"清空"，不传（undefined）表示"保持不变"。
   * 直接 `{ ...old, ...next }` 会用 undefined 覆盖旧值 —— 只改 nanfeng
   * 的部分保存会把 durationSec/ratio/refs 全清掉，把镜头卡写坏。
   */
  const merged = idx >= 0 ? { ...list[idx] } : {};
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined) merged[k] = v;
  }

  // 落到合法区间（避免下游跑炸），警告挂到记录上
  const raw = Number(merged.durationSec);
  if (Number.isFinite(raw)) merged.durationSec = Math.min(15, Math.max(1, raw));
  if (Array.isArray(merged.refs?.images) && merged.refs.images.length > 9) {
    merged.refs = { ...merged.refs, images: merged.refs.images.slice(0, 9) };
  }
  merged.validation = validateShot(merged);

  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, f);

  // 广播给浏览器：DSH Agent 改了镜头卡 → 网页表单立即可见
  emit({ type: 'shot-updated', projectId, shotId: merged.id });

  // 返回落盘后的完整记录，而不是只含本次改动字段的 next
  return merged;
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
        /**
         * 续写上下文透传。
         *
         * `continuationTask` 存在 job.params 上（见 executeBackend 的 runH3Nanfeng 调用），
         * 但 compilePrompt 只拿到 shot —— 所以调用方需要先把它挂到 shot 上。
         * 见 executeBackend 里的 `shotForCompile`。
         */
        continuationTask: shot.continuationTask ?? null,
        continuationIndex: shot.continuationIndex ?? null,
        contextLength: shot.nanfeng?.overrides?.context_length ?? '22',
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

      // ⚠️ 参考视频/音频的**用途说明**必须走 buildMediaNotes。
      //
      // 历史缺陷：buildMediaNotes 只挂在 /render/compile 上，而那是个
      // 没人调用的死端点。真实生成路径（本函数）不产 mediaNotes，
      // 于是 compileRef2VA 只能退化到内置默认句 —— 所有参考视频都被写成
      // `transfer motion only`，"续篇 / 节奏 / 氛围"这三类用途永远表达不出来，
      // 参考音频也拿不到"谁的音色"绑定。
      try {
        const plan = buildRenderPlan(shot, cfg);
        const notes = buildMediaNotes(plan);
        if (Array.isArray(notes) && notes.length) pkg.mediaNotes = notes;
      } catch { /* 构建计划失败不影响编译 */ }

      const r = compileH3Prompt(pkg);
      if (r.prompt && r.prompt.length > 40) return r.prompt.slice(0, 7000);
    } catch {
      // 结构化编译失败 → 退回简单拼接，不让生成中断
    }  }
  // ==========================================================================
  // 兜底：结构化编译抛错时的极简组装
  // ==========================================================================
  //
  // ⚠️ 历史缺陷：这里曾拼出「风格：X\n运镜：Y\n台词：Z」这种中文标签串。
  //    那是**没有任何官方格式依据**的自由文本，模型拿到的是一堆冒号标签，
  //    既不是基础格式也不是六段格式 —— 属于最差的一种输出。
  //
  //    现在兜底也遵守官方基础格式：至少产出三字段，让模型能解析。
  //    宁可少写内容，也不能产出没有结构的东西。
  const fallbackDesc = [
    shot.description,
    shot.camera ? `The camera ${shot.camera}.` : '',
    shot.dialogue ? `The subject is visible on screen and says: <d>[Chinese] ${shot.dialogue}</d>` : '',
  ].filter(Boolean).join(' ').trim();

  const fb = [
    `integrated_multimodal_description: [Shot 1] ${fallbackDesc || 'A short scene.'}`,
    '',
    `overall_soundscape: ${shot.sound || 'Quiet environmental room tone with soft air movement.'}`,
    '',
    `non_diegetic_music: ${shot.music || 'N/A'}`,
  ].join('\n');

  return fb.slice(0, 7000);
}

/**
 * 从镜头卡推断 subjects（参考图 → 角色）。
 * 没有显式 subjects 时用这个兜底，让结构化编译器也能工作。
 *
 * ⚠️ 已导出：`host/tools.js` 的 `studio_prompt(fromShot)` 必须用同一份逻辑，
 *    否则"Agent 编译的提示词"与"REST 预览 / 真实生成"会漂移。
 *    任何新的预览入口都应调用这里，不要自己再写一份。
 */
export function deriveSubjectsFromShot(shot) {
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
    blender: blenderStatus(),
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


/* --------------------------------------------------- 后端执行分发 */


async function executeBackend(job, shot, ctx, cfg, hooks) {
  /**
   * 把续写上下文挂到 shot 上再编译提示词。
   *
   * ⚠️ 为什么必须在这里挂：`compilePrompt(shot)` 只接收 shot，
   *    而续写任务存在 `job.params.continuationTask` 里（由继续批次编排写入）。
   *    不挂的话，续写段的提示词**顶部不会有开关句** ——
   *    模型就按文字重新推导姿态，导致接缝断裂（这是续写失败最常见的根因）。
   */
  const shotForCompile = job.params?.continuationTask
    ? {
      ...shot,
      continuationTask: job.params.continuationTask,
      continuationIndex: job.params?.batchIndex ?? null,
    }
    : shot;

  const prompt = job.prompt || compilePrompt(shotForCompile);
  const outputsDir = path.join(cfg.dataDir, 'outputs');
  // 提交回调：把 remoteId 尽早落盘，否则"已提交未完成"期间取消无法通知远端
  const onSubmitted = hooks?.onSubmitted;

  /**
   * 南风 V15 后端 —— **默认视频路径**。
   *
   * 南风节点把所有模型加载、条件编码、二次采样、解码封装在节点内部，
   * 由 ComfyUI 的 GraphBuilder 展开。我们的后端只负责选预设、传参、接输出。
   *
   * 相对旧的 h3-local（模板替换）：
   *   · 支持潜空间放大二采（旧路径没有）
   *   · 支持跨镜头续写（旧路径没有）
   *   · 参数体系 217 个，由 nanfeng/schema.js 统一定义
   */
  if (job.backendId === 'h3-nanfeng') {
    return runH3Nanfeng({
      job,
      shot,
      prompt,
      cfg,
      onSubmitted,
      mode: job.params?.nanfengMode || shot.mode,
      preset: job.params?.nanfengPreset ?? shot?.nanfeng?.presets,
      extraParams: job.params?.nanfengExtra,
      continuationTask: job.params?.continuationTask,
    });
  }

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

  // ⚠️ 只有显式 backendId === 'mock' 才走 mock。
  //    mock 是**测试占位后端**（services/mock-backend.js）：它不做任何推理，
  //    只用 ffmpeg 出一张把提示词烧在画面上的色卡视频，供无显卡环境下跑通
  //    流程。真实产出必须走 h3-local / h3-image。
  //    修掉"未知 backend 静默降级成 mock"：以前任何拼错的后端名（如写 'h3'
  //    而不是 'h3-local'）都会落进 mock，生成 ffmpeg 占位视频且状态 completed，
  //    用户拿到"假视频"还以为成了。
  if (job.backendId === 'mock') {
    return mockBackend.runMock({ cfg, job, shot, prompt });
  }

  throw new Error(
    `UNKNOWN_BACKEND: ${JSON.stringify(job.backendId)} 不是有效后端。`
    + `可选：h3-local / h3-image / mock`,
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

















