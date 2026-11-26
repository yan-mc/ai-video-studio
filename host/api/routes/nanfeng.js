/**
 * 南风域：续写批次 / 分段 / 规划 / 智能分镜。
 */
import { newJob, jobs as jobsStore } from '../../services/job-store.js';
import { continuation, storyboard, llm } from '../../bridge/index.js';
import { runAndArchive } from '../archive.js';
import { executeBackend } from '../backend.js';
import { emit } from '../events.js';
import { readJsonBody } from '../http.js';
import { listShots } from '../shots.js';

const PRESETS_BATCH = '/nanfeng/continuation/batches/';

/**
 * 正在跑的续写批次。
 *
 * 409 的判据必须是**内存里的 in-flight 集合**：`batch.status='running'` 是
 * runBatch 异步写回的，第二次 POST 可能落在写回之前，两套编排会抢同一段 latent。
 */
const runningBatches = new Set();

/** 等待一段跑到终态（串行批次必须等），定时器用 finally 兜住 */
function waitSegment(jobId, index) {
  return new Promise((resolve, reject) => {
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
        const cur = await jobsStore().get(jobId);
        const st = cur?.status;
        if (st === 'completed') return finish(resolve, cur);
        if (st === 'failed' || st === 'cancelled') {
          const e = new Error(cur?.error || `第 ${index} 段${st}`);
          e.jobId = jobId;
          return finish(reject, e);
        }
        if (Date.now() - t0 > 60 * 60 * 1000) {
          return finish(reject, new Error(`第 ${index} 段超时（>1h）`));
        }
      } catch {
        /* 读盘抖动：下一轮再试；超时判定仍然生效 */
      }
      return undefined;
    }, 2000);
  });
}

async function runContinuationBatch({ dataDir, batchId, body, ctx, cfg }) {
  const projectShots = listShots(body.__projectId);
  const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : undefined;

  await continuation.runBatch({
    dataDir,
    batchId,
    onProgress: (e) => emit({ type: 'batch-progress', ...e }),
    runOne: async (seg, taskJson, index) => {
      const shot = projectShots.find((s) => s.id === seg.shotId);
      if (!shot) throw new Error(`第 ${index} 段的镜头 ${seg.shotId} 不存在`);

      /*
       * 段 1 也要带续写任务：南风把读/写 latent 挂在同一个 `if continuation:` 下，
       * 段 1 不带 → 不保存 latent → 段 2 Load clip_1 直接报文件不存在。
       * 官方设计就是首段 Load 0 / Save 1。
       */
      const job = newJob({
        projectId: body.__projectId,
        shotId: seg.shotId,
        backendId: 'h3-nanfeng',
        prompt: '',
        params: {
          nanfengPreset: body.__preset,
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

      /*
       * 两条并行路径必须 join：一条是真执行（runAndArchive），一条是轮询终态。
       * 只轮询的话，runAndArchive 自身 reject（归档抛错、job 写盘抛错）会让 job
       * 永远停在 running，批次挂满 1 小时才失败，用户看到"卡住但无报错"。
       */
      const done = runAndArchive(
        job,
        (running, hooks) => executeBackend(running, shot, ctx, cfg, hooks),
        ctx,
      ).catch(async (e) => {
        ctx?.logger?.warn?.(`[jiuzhang] 续写批次 ${batchId} 第 ${index} 段执行失败：${String(e?.message || e)}`);
        try {
          const cur = await jobsStore().get(job.id);
          if (cur && (cur.status === 'running' || cur.status === 'queued')) {
            await jobsStore().upsert({ ...cur, status: 'failed', error: String(e?.message || e), updatedAt: Date.now() });
          }
        } catch { /* 写回失败也不能吞掉原异常 */ }
        throw e;
      });

      const cur = await Promise.race([done.then(() => null), waitSegment(job.id, index)]);
      seg.outputRel = cur?.outputs?.[0]?.rel ?? null;
      seg.frames = cur?.outputs?.[0]?.frames ?? null;
      return { jobId: job.id, outputRel: seg.outputRel, frames: seg.frames };
    },
  });
}

export async function handleNanfeng(req, res, R) {
  const { route, url, cfg, ctx, json, safeId } = R;

  /** 建批次 */
  if (req.method === 'POST' && route === '/nanfeng/continuation/batches') {
    const body = await readJsonBody(req);
    const pid = safeId(body.projectId);
    try {
      const batch = continuation.createBatch({
        projectId: pid,
        shotIds: Array.isArray(body.shotIds) ? body.shotIds : [],
        preset: body.preset ?? 'continuation',
        contextLength: body.contextLength ?? '22',
        audioContextLength: body.audioContextLength ?? 24,
        trimFrames: body.trimFrames ?? null,
      });
      continuation.saveBatch(cfg.dataDir, batch);
      return json(201, batch);
    } catch (e) {
      return json(400, { error: 'BATCH_INVALID', detail: String(e?.message || e) });
    }
  }

  /** 列批次 */
  if (req.method === 'GET' && route === '/nanfeng/continuation/batches') {
    const q = url.searchParams.get('projectId');
    return json(200, continuation.listBatches(cfg.dataDir, q ? safeId(q) : null));
  }

  /** 取单个批次 / 取下一段任务 */
  if (req.method === 'GET' && route.startsWith(PRESETS_BATCH)) {
    const rest = route.slice(PRESETS_BATCH.length);
    if (rest.endsWith('/next')) {
      const id = safeId(rest.slice(0, -'/next'.length));
      const b = continuation.loadBatch(cfg.dataDir, id);
      if (!b) return json(404, { error: 'BATCH_NOT_FOUND', id });
      const idx = continuation.nextPendingIndex(b);
      if (idx == null) return json(200, { done: true, batch: b });
      return json(200, {
        done: false,
        index: idx,
        shotId: b.shots.find((s) => s.index === idx)?.shotId ?? null,
        task: continuation.taskFor(b, idx),
        contextFolder: b.contextFolder,
      });
    }
    const id = safeId(rest);
    const b = continuation.loadBatch(cfg.dataDir, id);
    if (!b) return json(404, { error: 'BATCH_NOT_FOUND', id });
    return json(200, b);
  }

  /** 更新某段状态 */
  if (req.method === 'POST' && route === '/nanfeng/continuation/segment') {
    const body = await readJsonBody(req);
    const b = continuation.loadBatch(cfg.dataDir, safeId(body.batchId));
    if (!b) return json(404, { error: 'BATCH_NOT_FOUND' });
    const seg = b.shots.find((s) => s.index === Number(body.index));
    if (!seg) return json(404, { error: 'SEGMENT_NOT_FOUND' });
    for (const k of ['status', 'jobId', 'outputRel', 'frames', 'error']) {
      if (body[k] !== undefined) seg[k] = body[k];
    }
    continuation.advanceStatus(b);
    continuation.saveBatch(cfg.dataDir, b);
    emit({
      type: 'batch-progress',
      batchId: b.batchId,
      current: b.shots.filter((s) => s.status === 'completed').length,
      total: b.shots.length,
      status: b.status,
    });
    return json(200, b);
  }

  /** 规划分段：帧数必须落在 17k+5 网格上，只有后端算得准 */
  if (req.method === 'POST' && route === '/nanfeng/continuation/plan') {
    const body = await readJsonBody(req);
    try {
      return json(200, continuation.planSegments({
        targetSeconds: body.targetSeconds ?? 45,
        segments: body.segments ?? 9,
        contextLength: body.contextLength ?? '22',
      }));
    } catch (e) {
      return json(400, { error: String(e?.message || e) });
    }
  }

  /** 一键跑完整个批次（立即返回，进度走 SSE） */
  if (req.method === 'POST' && route === '/nanfeng/continuation/batches/run') {
    const body = await readJsonBody(req);
    const batchId = safeId(body.batchId);
    const b0 = continuation.loadBatch(cfg.dataDir, batchId);
    if (!b0) return json(404, { error: 'BATCH_NOT_FOUND' });
    if (runningBatches.has(batchId)) {
      return json(409, { error: 'BATCH_ALREADY_RUNNING', batchId });
    }

    // 允许显式重置失败段后重跑
    if (body.resetFailed) {
      continuation.resetFromFailure(b0);
      continuation.saveBatch(cfg.dataDir, b0);
    }

    runningBatches.add(batchId);
    runContinuationBatch({
      dataDir: cfg.dataDir,
      batchId,
      body: { ...body, __projectId: b0.projectId, __preset: b0.preset },
      ctx,
      cfg,
    }).catch((e) => {
      ctx?.logger?.warn?.(`[jiuzhang] 续写批次 ${batchId} 编排失败：${String(e?.message || e)}`);
      emit({ type: 'batch-progress', batchId, status: 'failed', error: String(e?.message || e) });
    }).finally(() => runningBatches.delete(batchId));

    return json(202, { ok: true, batchId, status: 'starting' });
  }

  /** 重置失败段 */
  if (req.method === 'POST' && route === '/nanfeng/continuation/batches/reset') {
    const body = await readJsonBody(req);
    const b = continuation.loadBatch(cfg.dataDir, safeId(body.batchId));
    if (!b) return json(404, { error: 'BATCH_NOT_FOUND' });
    const r = continuation.resetFromFailure(b);
    continuation.saveBatch(cfg.dataDir, b);
    return json(200, { ...r, batch: b });
  }

  /** 分镜能力状态 */
  if (req.method === 'GET' && route === '/nanfeng/storyboard/meta') {
    return json(200, {
      modes: storyboard.STORYBOARD_MODES,
      skills: Object.entries(storyboard.SKILLS).map(([id, s]) => ({ id, label: s.label, desc: s.desc })),
      llm: llm.llmStatus(ctx, cfg),
    });
  }

  /** 生成分镜（逐图视觉分析 → 写分镜 → 解析） */
  if (req.method === 'POST' && route === '/nanfeng/storyboard/generate') {
    const body = await readJsonBody(req);
    const count = Math.max(1, Math.min(12, Number(body.count) || 1));
    const mode = String(body.mode || 'ref2va');
    if (!storyboard.STORYBOARD_MODES[mode]) {
      return json(400, { error: 'UNKNOWN_MODE', mode, valid: Object.keys(storyboard.STORYBOARD_MODES) });
    }
    if (!llm.llmStatus(ctx, cfg).available) {
      return json(503, { error: 'LLM_UNAVAILABLE', detail: llm.llmStatus(ctx, cfg).reason });
    }

    /*
     * 图片路径写错时收集到 badRels 一起返回 —— 静默吞掉的话调用方只看到
     * images:0，完全不知道是哪张图、为什么没进来。
     */
    const images = [];
    const badRels = [];
    for (const rel of (Array.isArray(body.imageRels) ? body.imageRels : [])) {
      try {
        const abs = R.resolveUserPath({ root: cfg.dataDir, input: rel, mustExist: true });
        images.push({ index: images.length + 1, absPath: abs, name: R.path.basename(abs) });
      } catch (e) {
        badRels.push(`${rel}（${String(e?.message || e)}）`);
      }
    }

    try {
      let analysis = '';
      if (images.length) {
        const parts = [];
        for (const img of images) {
          const text = await llm.callVision(ctx, cfg, {
            prompt: storyboard.visionPrompt(img.index),
            images: [img],
          });
          const clean = text.replace(/^\s*@图片\d+\s*[:：]\s*/, '').trim();
          parts.push(`@图片${img.index}：${clean}`);
        }
        analysis = parts.join('\n\n');
      }

      const messages = storyboard.buildStoryboardMessages({
        idea: body.idea,
        count,
        mode,
        skillId: body.skillId ?? 'regular_storyboard',
        images,
        analysis,
        durationSeconds: Number(body.durationSec) || 5,
        contextLength: body.contextLength != null ? Number(body.contextLength) : undefined,
      });
      const outText = await llm.callText(ctx, cfg, {
        system: messages[0].content,
        user: messages[1].content,
        maxTokens: storyboard.outputBudget(count),
      });

      const parsed = storyboard.parseStoryboard(outText, count);
      return json(200, {
        mode,
        count,
        global: parsed.global,
        segments: parsed.segments,
        analysis,
        raw: parsed.raw,
        ...(badRels.length ? { badRels } : {}),
      });
    } catch (e) {
      return json(400, { error: 'STORYBOARD_FAILED', detail: String(e?.message || e) });
    }
  }

  return false;
}
