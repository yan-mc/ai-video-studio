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
import { guard, safeId, safeJoin, resolveUserPath, getWriteToken } from '../security.js';
import { dirs, projects, newProject, newShot, PROFILES, resolutionFor, h3Length, H3_MODEL_SLOTS, NODE_TYPES, NODE_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS, listActionCatalog } from '../store/models.js';
import * as comfy from '../services/comfy-client.js';
import * as comfyControl from '../services/comfy-control.js';
import * as mockBackend from '../services/mock-backend.js';
import { cancelJob, CancelledError } from '../services/job-runner.js';
import { newJob, jobs as jobsStore, isLocalBackendOf } from '../services/job-store.js';
import { runH3Local, runH3Nanfeng, runH3ImageLocal, jobKind } from '../services/generator.js';
import { ACCEL_PLANS, ACCEL_PLAN_IDS, DEFAULT_ACCEL_PLAN } from '../services/accel-plan.js';
import { LORA_CATEGORIES, STRENGTH_LIMITS, catalogLoras, solveLoraStack } from '../services/lora-catalog.js';
import { compileH3Prompt, toShotInputPackage, STYLE_PRESETS, LIGHTING_PRESETS, H3_MODES, H3_LIMITS } from '../bridge/index.js';
import { H3_IMAGE_MODELS, H3_IMAGE_SIZES, IMAGE_VAE, IMAGE_CLIP, IMAGE_SAMPLING, checkImageModels } from '../services/h3-image.js';
import { BREAKDOWN_PROMPT_MAX_CHARS, BREAKDOWN_SIZE, DEFAULT_BREAKDOWN_PROMPT, buildBreakdownPrompt, isDefaultBreakdownPrompt, legacyBreakdownFields, breakdownSize } from '../services/breakdown.js';
import { readProjectCards, writeProjectCards } from '../services/character-vault.js';
import { buildRenderPlan, subjectsForPrompt, buildMediaNotes } from '../services/render-plan.js';
import { probeMedia } from '../services/media-probe.js';
import { blenderStatus, buildSceneSpec, renderControl, listModelAssets, listAssetActions, openInBlender, prunePrevizRuns } from '../services/blender-service.js';
import { getCanvasPermissions, setCanvasPermissions, loadCanvasPermissions } from '../services/canvas-agent.js';
import { getRuntime } from '../runtime.js';
// 工作流模板定位 —— 单一真源（模板随插件分发，不跟随 dataDir）
import { readWorkflowCached, workflowDiagnostics } from '../services/workflow-paths.js';
// 参考图编号的单一真源（不能再各写一份）
// 生成入参准备 —— REST 与 Agent 工具共用同一份（角色卡解析 / 媒体探测 / 编号）
import { withVaultCards, resolveMediaRefs, writeBackProbe, resolvePictureIndices } from '../services/shot-context.js';
// ── 拆分出的模块：HTTP 工具 / 镜头存储 / 提示词编译 / 项目辅助 / 监控 / 换人 / 归档
import { readJsonBody, readRawBody, sendJson, parseRangeHeader, pipeStream, parseMultipart, MIME_BY_EXT } from './http.js';
import { listShots, writeShots, upsertShot, cleanupProjectArtifacts } from './shots.js';
import { compilePrompt, deriveSubjectsFromShot } from './prompt-compile.js';
import { projectSummary, allowedProjectPatch, packProject, unpackProject } from './projects.js';
import { monitorPayload } from './monitor.js';
import { createReplaceTask } from './replace-tasks.js';
import { runAndArchive, listChineseFonts, isServableDataPath, guardNoToken } from './archive.js';

// re-export：host/tools.js:11 从 './api/index.js' import 的符号保持不变
export { compilePrompt, listShots, writeShots, upsertShot, cleanupProjectArtifacts, deriveSubjectsFromShot };
// 原文 2809 行就有的转发（保持既有调用点的 import 路径不变）
export { withVaultCards, resolveMediaRefs, writeBackProbe, resolvePictureIndices } from '../services/shot-context.js';
/* ------------------------------------------------------------- 工具函数 */

/** 合法后端枚举 —— 单一真源，路由与执行器共用 */
export const VALID_BACKENDS = new Set(['h3-nanfeng', 'h3-local', 'h3-image', 'mock']);

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
      /**
       * 步数可调范围。没有这个字段的方案 = 步数由训练设定决定，不可调
       * （蒸馏学生的步数是它的训练配置，改了就是分布外）。
       *
       * `none` 方案有它 —— 原模型步数是自由变量，前端据此渲染输入框的
       * min/max/step，并给出「25–30 是折中档」之类的提示。
       */
      ...(p.stepsRange ? { stepsRange: p.stepsRange } : {}),
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
      const m = (await import('../bridge/index.js')).nanfengSchema;
      /**
       * 用 enrichSchema() 而不是直接吐 PARAMS / GROUPS：
       * 参数的中文说明、调参建议、以及「死参数/禁用参数」标记都在
       * bridge/vendors/nanfeng/param-docs.js 里，前端要靠这些字段渲染说明面板。
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
      const m = (await import('../bridge/index.js')).nanfengPresets;
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
      const p = (await import('../bridge/index.js')).nanfengPresets;
      const g = (await import('../bridge/index.js')).nanfengGraph;
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
      const cont = (await import('../bridge/index.js')).continuation;
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
      const cont = (await import('../bridge/index.js')).continuation;
      const list = cont.listBatches(cfg.dataDir, q ? safeId(q) : null);
      return sendJson(res, 200, list);
    }

    /** 取单个批次 */
    if (req.method === 'GET' && route.startsWith('/nanfeng/continuation/batches/')) {
      const rest = route.slice('/nanfeng/continuation/batches/'.length);
      const cont = (await import('../bridge/index.js')).continuation;
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
      const cont = (await import('../bridge/index.js')).continuation;
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
      const cont = (await import('../bridge/index.js')).continuation;
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
      const cont = (await import('../bridge/index.js')).continuation;
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

              /**
               * 等待这一段真正跑完（runBatch 是串行的，这里必须等）。
               *
               * ⚠️ 定时器必须用 try/finally 兜住。
               *
               * 历史缺陷（定时器泄漏）：clearInterval 只写在三个分支里，
               * 一旦轮询回调本身抛异常（jobsStore().get 之外的路径）、
               * 或 job 被改成别的状态、或批次被取消，timer 永远不会被清，
               * 而 `await` 也永远不 settle —— 整个批次函数悬挂，
               * 后续段再也不会开始，界面上表现为"卡住但没有任何报错"。
               *
               * 现在：无论 resolve / reject / 异常，finally 一定清掉 timer。
               */
              await new Promise((resolve, reject) => {
                const t0 = Date.now();
                let settled = false;
                const finish = (fn, arg) => {
                  if (settled) return;
                  settled = true;
                  clearInterval(timer);
                  fn(arg);
                };
                const timer = setInterval(async () => {
                  if (settled) return;
                  try {
                    const cur = await jobsStore().get(job.id);
                    const st = cur?.status;
                    if (st === 'completed') {
                      seg.outputRel = cur.outputs?.[0]?.rel ?? null;
                      seg.frames = cur.outputs?.[0]?.frames ?? null;
                      finish(resolve);
                    } else if (st === 'failed' || st === 'cancelled') {
                      const e = new Error(cur?.error || `第 ${index} 段${st}`);
                      e.jobId = job.id;
                      finish(reject, e);
                    } else if (Date.now() - t0 > 60 * 60 * 1000) {
                      finish(reject, new Error(`第 ${index} 段超时（>1h）`));
                    }
                  } catch {
                    /* 读盘抖动：下一轮再试；但超时判定仍然生效 */
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
      const cont = (await import('../bridge/index.js')).continuation;
      const b = cont.loadBatch(cfg.dataDir, safeId(body.batchId));
      if (!b) return sendJson(res, 404, { error: 'BATCH_NOT_FOUND' });
      const r = cont.resetFromFailure(b);
      cont.saveBatch(cfg.dataDir, b);
      return sendJson(res, 200, { ...r, batch: b });
    }

    /* ---------------- 智能分镜（DSH 内部 LLM） ---------------- */

    /** 分镜能力状态 */
    if (req.method === 'GET' && route === '/nanfeng/storyboard/meta') {
      const sb = (await import('../bridge/index.js')).storyboard;
      const llm = (await import('../bridge/index.js')).llm;
      const m = await import('../bridge/index.js').then((B) => B.nanfengSchema).catch(() => null);
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
      const sb = (await import('../bridge/index.js')).storyboard;
      const llm = (await import('../bridge/index.js')).llm;

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
    /* ---------------------------------------------------- ComfyUI 进程控制 */

    /**
     * 顶栏那个「启动/关闭 ComfyUI」按钮用的三个路由。
     *
     * 为什么需要它：本地「取消」只对正在跑的那一单发 /interrupt，
     * 已经排进 ComfyUI 队列、还没开始的任务不会被清掉 —— 用户看到界面停了，
     * 但 ComfyUI 侧还挂着上一单的段，下一单提交后仍会依次执行，
     * 表现就是"前面的续写还在"。重启进程能一次性清掉队列、显存碎片与节点缓存。
     */
    if (req.method === 'GET' && route === '/comfy/status') {
      return sendJson(res, 200, { ok: true, ...(await comfyControl.comfyStatus()) });
    }

    if (req.method === 'POST' && route === '/comfy/stop') {
      const r = await comfyControl.withLock(() => comfyControl.stopComfy());
      return sendJson(res, r.ok ? 200 : 500, r);
    }

    if (req.method === 'POST' && route === '/comfy/start') {
      const r = await comfyControl.withLock(() => comfyControl.startComfy());
      return sendJson(res, r.ok ? 200 : 500, r);
    }

    if (req.method === 'POST' && route === '/comfy/restart') {
      const r = await comfyControl.withLock(() => comfyControl.restartComfy());
      return sendJson(res, r.ok ? 200 : 500, r);
    }

    // 加速方案列表（含每个方案的实际参数，便于前端展示与排障）
    if (req.method === 'GET' && route === '/accel/plans') {
      return sendJson(res, 200, {
        ok: true,
        current: cfg.accelPlan,
        plans: accelPlanList(),
      });
    }
    /**
     * LoRA 目录 —— 前端 LoRA 选择器的数据源。
     *
     * 返回：① 分类定义（单选/多选、强度区间、为什么）② 当前装了哪些 LoRA
     *       ③ 每个文件的自动归类结果 ④ 每个分类下有几个文件
     *
     * 归类依据是 ComfyUI 的 `loras` 列表（`object_info` 是唯一权威），
     * 而 ComfyUI 会递归扫描子目录，所以 `00_turbo/xxx.safetensors` 这种
     * 带目录前缀的名字天然带分类信息。
     *
     * `?validate=` 可选：传一组 `{name,strength}` 让后端跑一遍约束求解，
     * 前端在提交前就能看到"哪条会被替换/衰减/剔除"。
     */
    if (req.method === 'GET' && route === '/lora/catalog') {
      let files = null;
      let probeError = null;
      try {
        const comfyMod = await import('../services/comfy-client.js');
        const mf = await comfyMod.listModelFiles(cfg);
        if (mf?.ok) files = mf.loras;
        else probeError = mf?.reason || 'ComfyUI 不可达';
      } catch (e) {
        probeError = String(e?.message || e);
      }
      const items = catalogLoras(files ?? []);
      const byCategory = {};
      for (const it of items) {
        byCategory[it.categoryId] = (byCategory[it.categoryId] ?? 0) + 1;
      }
      return sendJson(res, 200, {
        ok: true,
        /** null 表示"没探测到"（ComfyUI 不可达），不是"一个都没装" */
        probed: files != null,
        ...(probeError ? { probeError } : {}),
        categories: LORA_CATEGORIES,
        limits: STRENGTH_LIMITS,
        items,
        byCategory,
        total: items.length,
      });
    }
    // 把候选 LoRA 摊开校验一遍（前端"将提交"面板用它做实时预演）
    if (req.method === 'POST' && route === '/lora/solve') {
      const body = await readJsonBody(req);
      const requested = Array.isArray(body.items) ? body.items : [];
      const solved = solveLoraStack(requested, { maxSlots: Number(body.maxSlots) || 8 });
      return sendJson(res, 200, { ok: true, ...solved });
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
        const saved = await upsertShot(pid, shot);
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
      const compileWarnings = [];
      const compiledPrompt = compilePrompt(shotWithCards, compileWarnings);
      const job = newJob({
        projectId: pid,
        shotId: shot.id,
        backendId,
        /**
         * ⚠️ 历史 P2（本次修复）：提交时编译的 lint 警告被**整条丢弃**。
         *
         *    旧写法 `prompt: compilePrompt(shotWithCards)` 不接收第二个参数，
         *    而 executeBackend 里的 `job.prompt || compilePrompt(..., promptWarnings)`
         *    因为有 job.prompt 而**永远走不到右边** —— 于是
         *    「提示词超长被截断」「字段缺失」「负面句误报」这些警告
         *    在真实生成路径上从来不会进 job.warnings，用户看不到。
         *
         *    现在：提交时把 warnings 一并收集，写进 job.warnings。
         */
        prompt: compiledPrompt,
        ...(compileWarnings.length ? { warnings: compileWarnings } : {}),
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
      const sorted = list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      /**
       * 轻量模式 `?fields=list`。
       *
       * 为什么需要：不带 fields 时单次响应实测 **328,437 字节**（126 条任务全量，
       * 含 prompt 全文 + 221 参数快照）。任务列表页 / 顶栏轮询只要 id+状态，
       * 拉全量纯属浪费（前端 4 处轮询合计约 470 KB/s）。
       *
       * 不带 fields 时行为**完全不变**（向后兼容）。
       */
      if (url.searchParams.get('fields') === 'list') {
        return sendJson(res, 200, sorted.map((j) => ({
          id: j.id,
          status: j.status,
          kind: j.kind ?? null,
          projectId: j.projectId ?? null,
          shotId: j.shotId ?? null,
          backendId: j.backendId ?? null,
          mode: j.mode ?? null,
          createdAt: j.createdAt ?? null,
          updatedAt: j.updatedAt ?? null,
          finishedAt: j.finishedAt ?? null,
          error: j.error ?? null,
          // 产物只留路径，去掉字节数之外的元信息
          outputs: Array.isArray(j.outputs)
            ? j.outputs.map((o) => ({ rel: o?.rel ?? null }))
            : [],
        })));
      }
      return sendJson(res, 200, sorted);
    }

    /**
     * GET /jobs/:id —— 单任务查询。
     *
     * 为什么需要：画布 runner / 图像页 / 分镜页都要「盯着一个任务」，
     * 旧实现只能拉全量再 `find`（单次 321 KB、2.5 秒一次）。
     *
     * 正则只匹配 `job_[A-Za-z0-9]+`，不会吃掉 `/jobs/:id/cancel` 那条参数化路由。
     */
    {
      const mj = req.method === 'GET' ? route.match(/^\/jobs\/([^/]+)$/) : null;
      /**
       * ⚠️ 必须排除 `batch-progress`：它也是 GET /jobs/<something>，
       *    会被上面的正则吃掉，然后 `safeId('batch-progress', /^job_.../)` 抛错
       *    → 工具箱的「批量进度」永久 400。冒烟测不到（GET 列表里没有它）。
       */
      if (mj && mj[1] !== 'batch-progress') {
        const jobId = safeId(decodeURIComponent(mj[1]), /^job_[A-Za-z0-9]+$/);
        const job = await jobsStore().get(jobId);
        if (!job) return sendJson(res, 404, { error: 'JOB_NOT_FOUND', id: jobId });
        return sendJson(res, 200, job);
      }
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
          /**
           * ⚠️ 必须再收紧一层子目录白名单。
           *
           * resolveUserPath 只保证"在 dataDir 内"，而 archive 是**服务端自己
           * 把文件搬进 assets/** —— 天然绕过 /file 的 SERVABLE_DATA_DIRS 白名单。
           * 于是：
           *   POST /assets/archive {"items":[{"path":"config.json"}]}
           * → 拿到 asset_xxx.json → GET /assets/item?id=... → 读到明文配置
           * 而 asset-service 的扩展名白名单含 .json/.txt/.md/.svg。
           *
           * 只允许那些**本来就是产物/素材**的目录。
           */
          const abs = resolveUserPath({
            root: cfg.dataDir,
            input: typeof it.path === 'string' && it.path ? it.path : it.rel,
            mustExist: true,
            allowSubdirs: ['outputs', 'assets', 'previz', 'post', 'tmp-inline', 'inputs'],
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
      mode: body.mode ?? null,
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
      mode: body.mode ?? null,
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

    /* ---------------- 立绘拆解 / 角色设定卡 ---------------- */
    /**
     * 这一组路由**只有一个可调项：提示词**。
     *
     * 档位（level）与尺寸（sizeId）已从产品里移除：
     *   · 档位里 `full` 与 `standard` 逐字相同（表情差分区 1.0.2 已移除），
     *     在卖一个不存在的差异；
     *   · 尺寸里能真正跑稳的只有横版这一档（2048² 已经吃满 12GB 卡的显存）。
     * 结构化字段（character / outfit / parts / views / notes）同样作废 ——
     * 它们把正文拼死了，用户想换衣服/加视角时改不动，见 breakdown.js 文件头。
     *
     * 现在前端与后端对提示词是**同一份字符串**：前端原样展示默认值，
     * 用户改完原样提交，后端不做任何拼装。
     */
    if (req.method === 'GET' && route === '/breakdown/meta') {
      return sendJson(res, 200, {
        // 默认提示词 —— 前端用它初始化那个大输入框
        defaultPrompt: DEFAULT_BREAKDOWN_PROMPT,
        maxChars: BREAKDOWN_PROMPT_MAX_CHARS,
        // 固定输出尺寸（只读，不再作为可选项）
        size: BREAKDOWN_SIZE,
        /** 已移除的旧字段；前端据此显示"这些不再影响提示词" */
        removedFields: ['character', 'outfit', 'parts', 'views', 'notes', 'level', 'sizeId'],
      });
    }
    if (req.method === 'POST' && route === '/breakdown/preview') {
      const body = await readJsonBody(req);
      const prompt = buildBreakdownPrompt(body);
      const legacyUsed = legacyBreakdownFields(body);
      return sendJson(res, 200, {
        prompt,
        chars: prompt.length,
        maxChars: BREAKDOWN_PROMPT_MAX_CHARS,
        isDefault: isDefaultBreakdownPrompt(prompt),
        size: BREAKDOWN_SIZE,
        ...(legacyUsed.length
          ? {
            legacyFieldsIgnored: legacyUsed,
            note: `字段 ${legacyUsed.join(' / ')} 已不再影响提示词，请直接改写 prompt。`,
          }
          : {}),
      });
    }
    if (req.method === 'POST' && route === '/breakdown/generate') {
      const body = await readJsonBody(req);
      if (!cfg) return sendJson(res, 500, { error: 'CONFIG_MISSING' });
      const wf = loadImageWorkflow();
      if (!wf) return sendJson(res, 500, { error: 'WORKFLOW_MISSING' });

      const prompt = buildBreakdownPrompt(body);
      const size = breakdownSize();
      const legacyUsed = legacyBreakdownFields(body);

      /**
       * 超长在**请求期**就挡住，而不是让 downstream 的
       * `normalizeImagePrompt` 静默 `slice(0, 4096)`。
       *
       * 静默截断是"改了提示词却没生效"最隐蔽的一种：用户在末尾加的
       * "换成红色礼裙"如果刚好被截掉，出图没变化，没有任何报错可查。
       */
      if (prompt.length > BREAKDOWN_PROMPT_MAX_CHARS) {
        return sendJson(res, 400, {
          error: 'PROMPT_TOO_LONG',
          detail: `提示词 ${prompt.length} 字符，超过上限 ${BREAKDOWN_PROMPT_MAX_CHARS}。`
            + '请精简后再提交（不会静默截断，以免你写的要求被悄悄丢掉）。',
          chars: prompt.length,
          maxChars: BREAKDOWN_PROMPT_MAX_CHARS,
        });
      }

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
        /**
         * ⚠️ 绝对路径必须限定在 dataDir 内（安全级）。
         *
         * 历史实现是 `if (path.isAbsolute(raw)) { if (fs.existsSync(raw)) ... }`
         * —— 任意本机文件都能读出来送进模型，且会被写进 job.params 与提示词，
         * 事后无从追责。security.js 的 resolveUserPath 就是为这件事写的，
         * 只是这三处漏了接线。
         */
        try {
          const a = resolveUserPath({ root: cfg.dataDir, input: raw, mustExist: true });
          refAbs.push(a);
        } catch (e) {
          const msg = String(e?.message || e);
          badRels.push(msg === 'FORBIDDEN_PATH' ? `${raw}（不在 dataDir 内，已拒绝）` : `${raw}（文件不存在）`);
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

      /**
       * 尺寸固定，但**仍然做请求期校验**：`imageMaxMP` 是用户可改的配置，
       * 有人把它调到 3.0 之后，这一档就该被显式拒绝，而不是等 ComfyUI OOM。
       */
      const mp = (size.w * size.h) / 1e6;
      const maxMp = Number(cfg.imageMaxMP) || 4.3;
      if (mp > maxMp) {
        return sendJson(res, 400, {
          error: 'IMAGE_SIZE_TOO_LARGE',
          detail: `${size.w}×${size.h} ≈ ${mp.toFixed(2)}MP，超过上限 ${maxMp}MP。`
            + '立绘拆解固定用这一档尺寸；要出图请调大设置里的「单张出图面积上限」。',
          size,
          maxMP: maxMp,
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
          imageSizeId: size.id,
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
        shot: { refs: { images: refAbs }, imageSizeId: size.id },
        cfg,
      }), ctx).catch(() => {});

      return sendJson(res, 200, {
        ...job,
        refCount: refAbs.length,
        chars: prompt.length,
        size,
        badRels,
        // 老脚本传了结构化字段 → 明确指出它们已不生效，不让调用方蒙在鼓里
        ...(legacyUsed.length ? { legacyFieldsIgnored: legacyUsed } : {}),
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
        styles: [
          /**
           * ⚠️ 「不指定」必须排在最前面、并且能被前端选中。
           *
           * 它不是"没有画风"这条路的开关那么简单 —— 用画风 LoRA 时必须
           * 选它，否则内置画风串（默认 ova90s）会和 LoRA 互相打架：
           * 提示词说 OVA、权重说 claymation，两头不到岸。
           *
           * 放在列表首位是为了让用户一眼看到"可以先不指定"。
           */
          {
            id: 'none',
            name: '不指定（交给 LoRA）',
            category: '无',
            changesAppearance: false,
            en: '',
          },
          ...STYLE_PRESETS,
        ],
        /**
         * 打光通道（光比预设）。
         *
         * 南风 221 参数里**没有任何打光参数** —— H3 是纯提示词驱动的扩散模型，
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
      return sendJson(res, 200, await ctx.extras.appendLog(body));
    }

    /* ---------------- 批量进度 ---------------- */
    if (req.method === 'GET' && route === '/jobs/batch-progress') {
      const all = await jobsStore().list();
      return sendJson(res, 200, ctx.extras.batchProgress(all));
    }

    /* ---------------- 画布内置 Agent ---------------- */
    if (req.method === 'GET' && route === '/canvas-agent/meta') {
      /**
       * ⚠️ 键名必须是 `current`，不能复用 `permissions`。
       *
       * meta() 里的 `permissions` 是**能力清单数组**（Perm[]，形如
       * ['read','write','generate','script']），前端用 `meta.permissions.map(...)`
       * 渲染开关列表。
       *
       * 历史实现写成 `{...meta, permissions: getCanvasPermissions()}`，
       * 把数组覆盖成 `Record<string, boolean>` 对象 —— 前端 `.map` 直接
       * TypeError，**画布 AI 面板首次打开即崩**。
       *
       * 前端读的是 `m.current ?? m.defaults`，所以用 `current` 即可，
       * 前端无需改动。
       */
      return sendJson(res, 200, { ...ctx.canvasAgent.meta(), current: getCanvasPermissions() });
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
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}`, ...baseHeaders });
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
        // ⚠️ 必须走 resolveUserPath 而不是裸 safeJoin：后者只做字符串层面的
        //    越界判断，**看不出 symlink / junction 指向 root 之外**
        //    （dataDir 里放一个指向 C:\ 的 junction 就能读任意文件）。
        //    resolveUserPath 会 realpath 之后再比对一次。
        abs = resolveUserPath({ root: cfg.dataDir, input: rel, mustExist: true });
      } catch (e) {
        const code = e?.code || 'FORBIDDEN_PATH';
        return sendJson(res, code === 'NOT_FOUND' ? 404 : 403, { error: code, path: rel });
      }
      if (!isServableDataPath(cfg.dataDir, abs)) {
        return sendJson(res, 403, {
          error: 'FORBIDDEN_PATH',
          detail: '只允许读取产物与素材子目录（outputs/assets/previz/post/edit/workflows）',
          path: rel,
        });
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        return sendJson(res, 404, { error: 'NOT_FOUND', path: rel });
      }
      const stat = fs.statSync(abs);
      const ext = path.extname(abs).toLowerCase();
      /**
       * ⚠️ 安全头必须与 `/assets/item` 一致（历史 P1：这条路径漏了）。
       *
       *   · 没有 X-Content-Type-Options: nosniff 时，浏览器可能忽略我们
       *     声明的 Content-Type 去做内容嗅探；
       *   · SVG 是**可执行文档**（内含 <script>），以 image/svg+xml 内联
       *     返回 = **同源存储型 XSS**：用户把 .svg 传进素材库，任何人打开
       *     /file?path=assets/x.svg 就在插件同源下执行脚本，而该源上挂着
       *     全部写接口（X-JZ-Token 可通过 /token 拿到）。
       *
       *   实测修复前：GET /file?path=assets/asset_x.svg → 200 image/svg+xml
       *   且 body 原样返回 —— 攻击链闭合。
       *
       *   现在与 /assets/item 完全对齐：SVG 强制 attachment、统一 nosniff。
       */
      const isSvgDoc = ext === '.svg';
      // 固定文件名：用途是"让浏览器下载而不是渲染"，名字本身不重要，
      // 也避免了把用户文件名拼进 header 带来的转义问题。
      const svgDisposition = 'attachment; filename="download.svg"';
      const secHeaders = isSvgDoc
        ? { 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': svgDisposition }
        : { 'X-Content-Type-Options': 'nosniff' };
      const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
      const range = parseRangeHeader(req.headers.range, stat.size);
      if (range && range.invalid) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}`, ...secHeaders });
        return res.end();
      }
      if (range) {
        const len = range.end - range.start + 1;
        res.writeHead(206, {
          'Content-Type': mime, 'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
          'Content-Length': len, 'Cache-Control': 'no-cache',
          ...secHeaders,
        });
        return pipeStream(res, abs, range);
      }
      res.writeHead(200, {
        'Content-Type': mime, 'Content-Length': stat.size,
        'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache',
        ...secHeaders,
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
    /**
     * 去音轨 —— 人物替换（视频换人）的必备前置。
     *
     * H3 Ref2VA 会把参考视频**自带的音轨**作为 <Audio j> 一起送进条件，
     * 所以源视频带声音时，即使提示词完全不写音频标签，输出音轨仍会被污染。
     * 换人任务要求「保动作、换皮囊、不生成音频」，必须先把音轨剥掉。
     */
    if (req.method === 'POST' && route === '/post/stripAudio') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.stripAudio(body));
    }
    if (req.method === 'POST' && route === '/post/qc') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.post.qc(body.path ?? body.input));
    }
    if (req.method === 'GET' && route === '/post/fonts') {
      return sendJson(res, 200, { fonts: listChineseFonts() });
    }

    /* ==================================================================
     * 视频剪辑 —— 裁切 / 拼接 / 音轨
     * ==================================================================
     *
     * 与 /h3/film/render 的分工：
     *   · film/render 是「成片合成」的一步式动作（给一串路径就拼出来）；
     *   · /edit/* 是「可反复编辑的工程」——片段有序列表 + 裁剪区间 + 音轨设置，
     *     能存盘、能改、能只重渲一次。
     * 两者共用同一套 ffmpeg 基础（ffmpeg-tools），但工程模型不同，不强行合并。
     *
     * 全部写方法都要 X-JZ-Token（由上面的 guard 统一校验），
     * 路径一律走 services/edit.js 的 resolveInput（dataDir 边界）。
     */
    if (req.method === 'GET' && route === '/edit/clips') {
      return sendJson(res, 200, ctx.edit.listClips());
    }
    if (req.method === 'POST' && route === '/edit/probe') {
      const body = await readJsonBody(req);
      if (!body.input) return sendJson(res, 400, { error: 'INPUT_REQUIRED' });
      return sendJson(res, 200, await ctx.edit.probe(body.input));
    }
    if (req.method === 'POST' && route === '/edit/trim') {
      const body = await readJsonBody(req);
      if (!body.input) return sendJson(res, 400, { error: 'INPUT_REQUIRED' });
      return sendJson(res, 200, await ctx.edit.trim(body));
    }
    if (req.method === 'POST' && route === '/edit/concat') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.edit.concat(body));
    }
    if (req.method === 'POST' && route === '/edit/audio') {
      const body = await readJsonBody(req);
      if (!body.input) return sendJson(res, 400, { error: 'INPUT_REQUIRED' });
      return sendJson(res, 200, await ctx.edit.audio(body));
    }
    if (req.method === 'POST' && route === '/edit/render') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await ctx.edit.render(body));
    }
    if (req.method === 'GET' && route === '/edit/projects') {
      return sendJson(res, 200, await ctx.edit.listProjects());
    }
    if (req.method === 'POST' && route === '/edit/projects') {
      const body = await readJsonBody(req);
      const id = safeId(String(body.id || `edit_${Date.now().toString(36)}`));
      return sendJson(res, 200, { ok: true, project: ctx.edit.saveProject(id, body) });
    }
    // 参数化：/edit/projects/:id —— 与 /projects/:id 同理，用 match 而非 ===
    {
      const m = route.match(/^\/edit\/projects\/([^/]+)$/);
      if (m) {
        const id = m[1];
        if (req.method === 'GET') {
          return sendJson(res, 200, { ok: true, project: ctx.edit.getProject(id) });
        }
        if (req.method === 'DELETE') {
          return sendJson(res, 200, ctx.edit.deleteProject(id));
        }
        if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, { ok: true, project: ctx.edit.saveProject(id, body) });
        }
      }
    }

    /* ==================================================================
     * 角色替换（换人）—— 独立业务线，与常规渲染不共享任何数据
     * ==================================================================
     *
     * 为什么整套 API 都挂在 /replace/* 下、且**完全不读** projects/ 与 shots/：
     * 见 services/replace.js 的文件头注释（角色卡会顶掉手工参考图编号）。
     * 这条线只有三个概念：源视频、参考图、提示词。少一层就少一类静默故障。
     */
    if (req.method === 'GET' && route === '/replace/meta') {
      const R = await import('../services/replace.js');
      const presets = (await import('../bridge/index.js')).nanfengPresets;
      return sendJson(res, 200, {
        ok: true,
        defaults: R.REPLACE_DEFAULTS,
        promptFields: R.PROMPT_FIELDS,
        presets: presets.listBuiltinPresets(),
        styles: (await import('../bridge/index.js')).prompt.STYLE_PRESETS
          .map((s) => ({ id: s.id, name: s.name, category: s.category })),
        lightings: (await import('../bridge/index.js')).prompt.LIGHTING_PRESETS
          .map((l) => ({ id: l.id, name: l.name, ratio: l.ratio, zh: l.zh })),
        accelPlans: accelPlanList(),
        contextLengths: [
          { id: '5', label: '5 帧 · 0.21s', seg: 0.21 },
          { id: '22', label: '22 帧 · 0.92s', seg: 0.92 },
          { id: '39', label: '39 帧 · 1.63s', seg: 1.63 },
          { id: '56', label: '56 帧 · 2.33s（最大）', seg: 2.33 },
        ],
        limits: {
          segmentSec: R.REPLACE_DEFAULTS.segmentSec,
          maxSourceSec: R.REPLACE_DEFAULTS.maxSourceSec,
          maxSegments: R.REPLACE_DEFAULTS.maxSegments,
          refImages: 9,
        },
      });
    }

    /**
     * 提示词模板 —— 前端那个**唯一的可编辑框**打开时预填的内容。
     *
     * 为什么把「谁换成谁」也并进这一个框：占位符表单只能表达一对一替换，
     * 而真实需求常有多角色、某角色只在某几段出现、某配角保持不动等情况。
     * 与其把表单做得越来越复杂，不如直接给一段改得动的文本 ——
     * 模板里 `<Picture N>` 的编号与参考图选择顺序一一对应，
     * 用户加一行就是多一个人，删一行就是少一个。
     */
    if (req.method === 'POST' && route === '/replace/prompt-template') {
      const R = await import('../services/replace.js');
      const body = await readJsonBody(req);
      const refCount = Math.max(1, Math.min(9, Number(body.refCount) || 1));
      const templates = [];
      for (let i = 0; i < refCount; i += 1) {
        templates.push({
          pictureIndex: i + 1,
          sourceDesc: `〔原角色${refCount > 1 ? i + 1 : ''}特征：发色/发型/服装/配饰〕`,
          targetDesc: `〔目标角色${refCount > 1 ? i + 1 : ''}特征：发色/发型/服装/配饰〕`,
        });
      }
      const prompt = R.buildReplacePrompt({
        roles: templates,
        shotBeats: '〔分段动作可选。每行一个 [Shot N]，不写就整段复刻原视频。〕',
      });
      return sendJson(res, 200, { ok: true, prompt, chars: prompt.length, refCount });
    }

    // 预览提示词（不改状态）—— 前端"可改字段"面板实时调用
    if (req.method === 'POST' && route === '/replace/preview-prompt') {
      const R = await import('../services/replace.js');
      const body = await readJsonBody(req);
      try {
        const prompt = R.buildReplacePrompt({
          roles: body.roles ?? [],
          shotBeats: body.shotBeats ?? '',
          extraNote: body.extraNote ?? '',
        });
        return sendJson(res, 200, { ok: true, prompt, chars: prompt.length });
      } catch (e) {
        return sendJson(res, 400, { error: String(e?.message || e) });
      }
    }

    /**
     * 提示词编译 —— 把用户手写的自由文本整理成规范结构。
     *
     * 三层降级（见 services/prompt-normalizer.js）：
     *   ① 规则引擎   永远成功，<10ms
     *   ② 本地 7B    补翻译，离线、无拒答，首次要下载 ~15GB
     *   ③ 原文兜底   前两步都失败时原样返回，绝不丢内容
     *
     * `useLlm=false` 只跑规则引擎。
     */
    if (req.method === 'POST' && route === '/replace/compile-prompt') {
      const body = await readJsonBody(req);
      const N = (await import('../bridge/index.js')).promptNormalizer;
      const raw = String(body.prompt ?? '');
      if (!raw.trim()) return sendJson(res, 400, { error: 'EMPTY_PROMPT: 提示词为空' });

      try {
        const r = await N.normalizePrompt(raw, cfg, { useLlm: body.useLlm !== false });
        return sendJson(res, 200, {
          ok: true,
          prompt: r.prompt,
          chars: r.prompt.length,
          translated: r.translated,
          needsTranslate: r.parts.needsTranslate,
          warnings: r.warnings,
          parts: {
            trigger: r.parts.trigger.length,
            summary: r.parts.summary.length,
            subjects: r.parts.subjects.length,
            video: r.parts.video.length,
            shots: r.parts.shots.length,
            guards: r.parts.guards.length,
            stray: r.parts.stray.length,
          },
        });
      } catch (e) {
        return sendJson(res, 500, { error: String(e?.message || e) });
      }
    }

    /** 本地翻译模型状态（前端据此显示"能不能用模型翻译"） */
    if (req.method === 'GET' && route === '/replace/llm-status') {
      const L = await import('../services/prompt-llm.js');
      return sendJson(res, 200, { ok: true, ...L.llmStatus(cfg) });
    }

    // 分析源视频 → 算分段（用户选完视频就能看到"会切成几段"）
    if (req.method === 'POST' && route === '/replace/plan') {
      const R = await import('../services/replace.js');
      const body = await readJsonBody(req);
      const abs = R.resolveReplaceInput(body.sourceRel, cfg);
      const useCont = Boolean(body.continuation);
      const plan = await R.planSourceSegments(abs, cfg, {
        segmentSec: Number(body.segmentSec) || undefined,
        // 续写模式必须一起传下去 —— 漏了会让预览显示"独立重绘"的分段，
        // 与实际执行（续写）完全对不上，用户看到的段数和交付时长全是错的
        continuation: useCont,
        contextLength: useCont ? String(body.contextLength ?? R.REPLACE_DEFAULTS.contextLength) : undefined,
        segmentCount: Number(body.segmentCount) || undefined,
      });
      return sendJson(res, 200, { ok: true, ...plan });
    }

    if (req.method === 'GET' && route === '/replace/tasks') {
      const R = await import('../services/replace.js');
      const list = await R.replaceStore(cfg).list();
      return sendJson(res, 200, list.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
    }

    if (req.method === 'POST' && route === '/replace/tasks') {
      const R = await import('../services/replace.js');
      const body = await readJsonBody(req);
      const task = await createReplaceTask(body, cfg);
      return sendJson(res, 200, task);
    }

    if (req.method === 'DELETE' && route.startsWith('/replace/tasks/')) {
      const id = safeId(decodeURIComponent(route.slice('/replace/tasks/'.length)));
      const R = await import('../services/replace.js');
      await R.replaceStore(cfg).remove(id);
      return sendJson(res, 200, { ok: true, removed: id });
    }

    if (req.method === 'GET' && route.startsWith('/replace/tasks/')) {
      const rest = route.slice('/replace/tasks/'.length);
      const id = safeId(decodeURIComponent(rest.split('/')[0] ?? ''));
      const R = await import('../services/replace.js');
      const task = await R.replaceStore(cfg).get(id);
      if (!task) return sendJson(res, 404, { error: 'REPLACE_NOT_FOUND' });
      return sendJson(res, 200, task);
    }

    // 启动执行（异步：立刻返回，进度靠轮询 GET /replace/tasks/:id）
    if (req.method === 'POST' && route.startsWith('/replace/run/')) {
      const id = safeId(decodeURIComponent(route.slice('/replace/run/'.length)));
      const R = await import('../services/replace.js');
      const store = R.replaceStore(cfg);
      const task = await store.get(id);
      if (!task) return sendJson(res, 404, { error: 'REPLACE_NOT_FOUND' });
      if (task.status === 'running' || task.status === 'cutting' || task.status === 'joining') {
        return sendJson(res, 409, { error: 'REPLACE_ALREADY_RUNNING' });
      }

      const { runReplaceBatch } = await import('../services/replace-runner.js');
      await store.upsert({ ...task, status: 'queued', error: null, updatedAt: Date.now() });
      // 不 await：批次要跑几十分钟，HTTP 不能挂着
      void runReplaceBatch({
        replaceId: id,
        cfg,
        onProgress: (evt) => emit({ type: 'replace-progress', replaceId: id, ...evt }),
      }).catch((e) => {
        ctx.logger?.warn?.(`[jiuzhang] 换人批次失败 ${id}: ${String(e?.message || e)}`);
      });
      return sendJson(res, 200, { ok: true, replaceId: id, status: 'queued' });
    }

    return sendJson(res, 404, { error: `UNKNOWN_ROUTE: ${req.method} ${route}` });
  } catch (err) {
    /**
     * 错误 → HTTP 状态码映射。
     *
     * ⚠️ 历史缺陷（P1）：这里原来**只按 message 前缀正则匹配**，
     *    于是所有带 code 但 message 不以那几个前缀开头的错误都落进 500。
     *    实测受害者：
     *      · resolveUserPath 的 NOT_FOUND（文件不存在）→ 本该 404，实际 500
     *      · INLINE_DATA_URL（传了 base64 而不是路径）→ 本该 400，实际 500
     *      · FILE_NOT_FOUND（剪辑/后处理）→ 本该 404，实际 500
     *      · BODY_TOO_LARGE → 本该 413，实际 400
     *    前端拿到 500 只能显示"服务端炸了"，用户完全不知道是自己路径写错了。
     *
     * 现在：**优先用 err.code**（安全层/存储层都带 code），message 正则只作兜底。
     */
    const msg = String(err?.message || err);
    if (err instanceof CancelledError) return sendJson(res, 409, { error: msg });

    const code = String(err?.code || '');
    /** code → 状态码（显式表，不靠正则猜） */
    const CODE_STATUS = {
      PATH_REQUIRED: 400,
      PROJECT_REQUIRED: 400,
      INVALID_ID: 400,
      INVALID_INPUT: 400,
      INLINE_DATA_URL: 400,
      BAD_JSON: 400,
      FORBIDDEN_PATH: 403,
      FORBIDDEN_HOST: 403,
      FORBIDDEN_ORIGIN: 403,
      WRITE_TOKEN_REQUIRED: 403,
      NOT_FOUND: 404,
      FILE_NOT_FOUND: 404,
      JOB_NOT_FOUND: 404,
      SHOT_NOT_FOUND: 404,
      PROJECT_NOT_FOUND: 404,
      BATCH_NOT_FOUND: 404,
      PRESET_NOT_FOUND: 404,
      REPLACE_NOT_FOUND: 404,
      EDIT_NOT_FOUND: 404,
      BODY_TOO_LARGE: 413,
      ALREADY_RUNNING: 409,
    };
    /**
     * 查表时**同时**试 `err.code` 和 message 本身。
     *
     * 为什么：仓库里大量错误是 `throw new Error('EDIT_NOT_FOUND')` ——
     * message 就是错误码，但没有 `err.code` 属性。逐个给 30+ 处补 code 既
     * 容易漏、又会把简单代码改复杂。这里统一按「code 优先、message 回退」查表，
     * 一次覆盖全部既有写法；新代码仍然推荐显式设 code。
     */
    const statusFor = (key) => CODE_STATUS[key]
      || CODE_STATUS[String(key).replace(/^([A-Z_]+?)(?::.*)?$/s, '$1')]
      || 0;
    const byCode = statusFor(code);
    if (byCode) return sendJson(res, byCode, { error: msg, code: code || msg });
    // message 本身就是错误码（或「CODE: 详情」形态）时同样命中
    const msgCode = /^([A-Z][A-Z0-9_]{2,})/.exec(msg)?.[1] ?? '';
    const byMsg = msgCode ? statusFor(msgCode) : 0;
    if (byMsg) return sendJson(res, byMsg, { error: msg, code: msgCode });

    // 兜底：没有 code 的老式 XXX_REQUIRED / 非法参数文案
    if (/^BODY_TOO_LARGE/.test(msg)) return sendJson(res, 413, { error: msg });
    const isValidation = /^(INVALID_\w+|BAD_JSON|FORBIDDEN_PATH|PROJECT_REQUIRED|PATH_REQUIRED)/.test(msg)
      || /_REQUIRED$/.test(msg);
    return sendJson(res, isValidation ? 400 : 500, { error: msg });
  }
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

  const promptWarnings = [];
  const prompt = job.prompt || compilePrompt(shotForCompile, promptWarnings);
  if (promptWarnings.length) {
    // lint 警告必须让用户看得见 —— 否则「超长被砍」「负面句误报」全被吞掉
    job.warnings = [...(job.warnings ?? []), ...promptWarnings];
  }
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
   *   · 参数体系 221 个，由 bridge/vendors/nanfeng/schema.js 统一定义
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

