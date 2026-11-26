/**
 * 生成域：/generate、/jobs*、/resolution、/h3/length。
 */
import { cancelJob } from '../../services/job-runner.js';
import { newJob, jobs as jobsStore, isLocalBackendOf } from '../../services/job-store.js';
import { resolutionFor, h3Length } from '../../store/models.js';
import * as comfy from '../../services/comfy-client.js';
import { runAndArchive } from '../archive.js';
import { executeBackend, VALID_BACKENDS } from '../backend.js';
import { fireAndLog } from '../errors.js';
import { readJsonBody } from '../http.js';
import { listShots } from '../shots.js';
import { compilePrompt } from '../prompt-compile.js';
import { withVaultCards } from '../../services/shot-context.js';

const JOB_ID = /^\/jobs\/([^/]+)$/;
const JOB_ACTION = /^\/jobs\/([^/]+)\/(cancel|retry)$/;

export async function handleGenerate(req, res, R) {
  const { route, url, cfg, ctx, json } = R;

  if (req.method === 'POST' && route === '/generate') {
    const body = await readJsonBody(req);
    const pid = R.safeId(body.projectId);
    const shot = listShots(pid).find((s) => s.id === body.shotId);
    if (!shot) return json(404, { error: 'SHOT_NOT_FOUND' });

    const backendId = body.backend || shot.backend || cfg.defaultBackend;
    // 早失败：后端名写错要立刻报，不能等任务跑完才产出"假视频"
    if (!VALID_BACKENDS.has(backendId)) {
      return json(400, {
        error: 'UNKNOWN_BACKEND',
        detail: `${JSON.stringify(backendId)} 不是有效后端`,
        valid: [...VALID_BACKENDS],
      });
    }

    // 顺序：先解析角色卡，再编译提示词 —— 否则卡的文字进不了 subject_definitions
    const shotWithCards = await withVaultCards(shot, pid, ctx, cfg);
    const compileWarnings = [];
    const compiledPrompt = compilePrompt(shotWithCards, compileWarnings);
    const job = newJob({
      projectId: pid,
      shotId: shot.id,
      backendId,
      prompt: compiledPrompt,
      ...(compileWarnings.length ? { warnings: compileWarnings } : {}),
      params: {
        durationSec: shot.durationSec,
        ratio: shot.ratio,
        profile: shot.profile,
        seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : 1101,
        // 加速方案：请求体可覆盖（单次尝试），否则由 shot / cfg 决定
        ...(typeof body.accelPlan === 'string' && body.accelPlan
          ? { accelPlan: body.accelPlan }
          : {}),
        ...(Number.isFinite(Number(body.steps)) ? { steps: Number(body.steps) } : {}),
        // 南风预设 / 参数 / 模式：与 studio_generate 同形，两入口落点一致
        ...(body.preset ? { nanfengPreset: String(body.preset) } : {}),
        ...(body.params && typeof body.params === 'object' ? { nanfengExtra: body.params } : {}),
        ...(body.mode ? { nanfengMode: String(body.mode) } : {}),
      },
      mode: shot.mode,
    });
    await jobsStore().upsert(job);

    fireAndLog(
      runAndArchive(job, (running, hooks) => executeBackend(running, shotWithCards, ctx, cfg, hooks), ctx),
      ctx,
      `job ${job.id}`,
    );
    return json(200, job);
  }

  if (req.method === 'GET' && route === '/jobs') {
    const list = await jobsStore().list();
    const sorted = list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 轻量模式：任务列表 / 顶栏轮询只要 id + 状态，全量响应含 prompt 全文
    if (url.searchParams.get('fields') === 'list') {
      return json(200, sorted.map(projectJobForList));
    }
    return json(200, sorted);
  }

  if (req.method === 'GET' && route === '/jobs/batch-progress') {
    // `?batchId=` 过滤：图像批（imgbatch_*）与续写批（batch_*）不能混进同一个百分比
    const batchId = url.searchParams.get('batchId') || null;
    const all = await jobsStore().list();
    const scoped = batchId ? all.filter((j) => j?.params?.batchId === batchId) : all;
    return json(200, ctx.extras.batchProgress(scoped));
  }

  /*
   * `/jobs/batch-progress` 也形如 /jobs/<x>，但它已在上面精确匹配返回，
   * 这里额外排除一次，避免将来调整顺序时被 safeId 吃掉变成 400。
   */
  const mj = req.method === 'GET' ? JOB_ID.exec(route) : null;
  if (mj && mj[1] !== 'batch-progress') {
    const jobId = R.safeId(decodeURIComponent(mj[1]), /^job_[A-Za-z0-9]+$/);
    const job = await jobsStore().get(jobId);
    if (!job) return json(404, { error: 'JOB_NOT_FOUND', id: jobId });
    return json(200, job);
  }

  const ma = JOB_ACTION.exec(route);
  if (ma && req.method === 'POST') {
    const jobId = R.safeId(decodeURIComponent(ma[1]), /^job_[A-Za-z0-9]+$/);
    if (ma[2] === 'cancel') {
      const result = await cancelJob(jobId, async (job) => {
        // h3-image 同样走 ComfyUI，也必须能真取消
        if (job.remoteId && isLocalBackendOf(job.backendId)) {
          await comfy.cancelRemote(cfg, job.remoteId);
        }
      });
      return json(200, result);
    }
    const old = await jobsStore().get(jobId);
    if (!old) return json(404, { error: 'JOB_NOT_FOUND' });
    const shot = listShots(old.projectId).find((s) => s.id === old.shotId);
    if (!shot) return json(404, { error: 'SHOT_NOT_FOUND' });
    const job = newJob({
      projectId: old.projectId, shotId: old.shotId, backendId: old.backendId,
      prompt: old.prompt, params: old.params, mode: old.mode,
    });
    await jobsStore().upsert(job);
    fireAndLog(
      runAndArchive(job, (running, hooks) => executeBackend(running, shot, ctx, cfg, hooks), ctx),
      ctx,
      `retry ${job.id}`,
    );
    return json(200, job);
  }

  if (req.method === 'POST' && route === '/resolution') {
    const body = await readJsonBody(req);
    return json(200, resolutionFor(body.profile, body.ratio));
  }
  if (req.method === 'POST' && route === '/h3/length') {
    const body = await readJsonBody(req);
    return json(200, { length: h3Length(body.durationSec, body.fps) });
  }

  return false;
}

/**
 * 产物的统一投影 —— `/jobs?fields=list` 与 `/image/progress` **必须同构**。
 *
 * 两处各写一份时，`archivedRel` 在一处有、另一处没有，
 * 前端把两个来源放进同一个列表渲染就会出现"有的图能点开、有的裂图"。
 */
export function projectOutput(o) {
  return {
    rel: o?.rel ?? null,
    archivedRel: o?.archivedRel ?? null,
    assetId: o?.assetId ?? null,
    bytes: o?.bytes ?? null,
  };
}

/** 任务列表投影（不含 prompt / 参数快照） */
export function projectJobForList(j) {
  return {
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
    outputs: Array.isArray(j.outputs) ? j.outputs.map(projectOutput) : [],
  };
}

/** 出图轮询投影 —— outputs 与列表投影共用 projectOutput */
export function projectJobForProgress(j, id) {
  if (!j) return { id, status: 'missing' };
  return {
    id: j.id,
    status: j.status,
    error: j.error ?? null,
    progress: j.params?.progress ?? null,
    params: {
      seed: j.params?.seed ?? null,
      batchIndex: j.params?.batchIndex ?? null,
      batchSize: j.params?.batchSize ?? null,
      cropResolution: j.params?.crop?.baseResolution ?? null,
    },
    warnings: Array.isArray(j.warnings) ? j.warnings : [],
    outputs: Array.isArray(j.outputs) ? j.outputs.map(projectOutput) : [],
  };
}

