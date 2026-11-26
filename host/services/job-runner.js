/**
 * 任务执行器。
 *
 * 约束：
 *  1) 取消必须真发 `/interrupt`（否则 GPU 空烧到跑完）；
 *  2) tasks.json 的读-改-写走串行 store（并发写会丢字段）；
 *  3) 进程重启后 `running` → `interrupted`，`queued` 若无本进程在场则判为孤儿；
 *  4) 恢复扫描要清远端残留（ComfyUI 里还在跑的任务）；
 *  5) 取消与完成竞态：产物已拿到就按 completed 落盘，不丢 outputs。
 */
import { jobs as jobStore, LOCAL_BACKENDS, TERMINAL, pruneJobs } from './job-store.js';
import { loadConfig } from '../config.js';

const activeLocal = new Set();
const pending = [];                 // [{ jobId, resolve }]
const cancelled = new Set();
const CANCELLED_MSG = 'CANCELLED: 已取消';
const INTERRUPTED_MSG = 'INTERRUPTED: 插件重启，任务未完成，可重试';
/** queued 超过这个时长仍未开始 → 判为孤儿（等槽位不可能等这么久） */
const QUEUED_ORPHAN_MS = 30 * 60 * 1000;
const CANCEL_TICK_MS = 250;

export function isLocalBackend(id) { return LOCAL_BACKENDS.has(String(id || '')); }

function maxLocal() {
  const n = Number(loadConfig().maxConcurrentLocal);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function acquireSlot(jobId, backendId) {
  if (!isLocalBackend(backendId)) return Promise.resolve();
  if (activeLocal.size < maxLocal()) { activeLocal.add(jobId); return Promise.resolve(); }
  return new Promise((resolve) => pending.push({ jobId, resolve }));
}

function releaseSlot(jobId) {
  if (!activeLocal.delete(jobId)) return;
  while (pending.length && activeLocal.size < maxLocal()) {
    const next = pending.shift();
    activeLocal.add(next.jobId);
    next.resolve();
  }
}

function markCancelled(jobId) { cancelled.add(jobId); }
function isCancelled(jobId) { return cancelled.has(jobId); }
function clearCancelled(jobId) { cancelled.delete(jobId); }

export class CancelledError extends Error {
  constructor() { super(CANCELLED_MSG); this.name = 'CancelledError'; this.code = 'CANCELLED'; }
}

export function throwIfCancelled(job) {
  if (!isCancelled(job.id)) return;
  throw new CancelledError();
}

/** 可被取消打断的睡眠：切成 ≤250ms 片，取消后最多 250ms 抛出 */
export async function cancellableSleep(job, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    throwIfCancelled(job);
    const left = deadline - Date.now();
    if (left <= 0) return;
    await new Promise((r) => setTimeout(r, Math.min(CANCEL_TICK_MS, left)));
  }
}

/**
 * 统一取消入口。
 *
 * 本地取消必须成功（不能因为远端不可达就取消不掉），但远端取消失败要**可见**：
 * 把原因通过 remoteCancel / remoteCancelError 返回，让上层能提示。
 * 静默吞掉的后果是 UI 说已取消、ComfyUI 继续烧到跑完，后面的任务全被堵住。
 *
 * @param {(job)=>Promise<void>} [onRemoteCancel] 用于通知远端（ComfyUI /interrupt 等）
 */
export async function cancelJob(jobId, onRemoteCancel) {
  const job = await jobStore().get(jobId);
  if (!job) throw new Error('任务不存在');
  if (TERMINAL.has(job.status)) {
    return { ...job, cancelResult: 'ALREADY_TERMINAL', remoteCancel: 'skipped' };
  }
  markCancelled(jobId);
  await jobStore().upsert({ ...job, status: 'cancelled', error: CANCELLED_MSG, updatedAt: Date.now() });
  // 摘掉等待槽位的排队者
  const qi = pending.findIndex((g) => g.jobId === jobId);
  if (qi >= 0) {
    const [g] = pending.splice(qi, 1);
    g.resolve();
  }

  // 通知远端真正停止（修复原实现"远端不停"的缺陷）
  let remoteCancel = 'skipped';
  let remoteCancelError = '';
  if (onRemoteCancel) {
    try {
      await onRemoteCancel(job);
      remoteCancel = 'ok';
    } catch (e) {
      remoteCancel = 'failed';
      remoteCancelError = String(e?.message || e);
    }
  }

  return {
    ...(await jobStore().get(jobId)),
    cancelResult: 'CANCELLED',
    remoteCancel,
    ...(remoteCancelError ? { remoteCancelError } : {}),
  };
}

/**
 * 启动恢复：把残留的 `running` 标为 interrupted 并清理远端残留；
 * 老化的 `queued` 判为孤儿。
 *
 * `running` 只标记不重跑 —— 它可能已在 GPU 上跑、或已提交到 ComfyUI 但没等到结果。
 * 远端清理是必须的：带 `remoteId` 的任务在 ComfyUI 侧可能仍在执行，不清理的话
 * 产物会落到 `output/` 但本地已判中断、不再轮询 remoteId，产物永远进不了 outputs[]
 * 也不进素材库 —— 等于白烧卡。
 *
 * `queued` 分两种：本进程 `pending` 里还有的保留（正在等并发槽位）；其余
 * （重启前留下的，`pending` 是纯内存所以必然已丢）判 QUEUE_ORPHANED，
 * 否则它们既不执行也不会被 pruneJobs 裁掉，永久占着 jobs.json。
 *
 * @returns {Promise<{recovered:number, orphaned:number, remoteCleaned:number}>}
 */
export async function recoverInterruptedJobs() {
  const list = await jobStore().list();
  const slate = list.filter((j) => j && (j.status === 'running' || j.status === 'queued'));
  if (!slate.length) return { recovered: 0, orphaned: 0, remoteCleaned: 0 };

  let recovered = 0;
  let orphaned = 0;
  let remoteCleaned = 0;
  const now = Date.now();
  const pendingIds = new Set(pending.map((p) => p.jobId));
  const activeIds = new Set(activeLocal);

  // comfy-client 反向依赖 job-runner（cancellableSleep），所以这里必须动态 import
  let cancelRemote = null;
  const needRemote = slate.some((j) => j.status === 'running' && j.remoteId);
  if (needRemote) {
    try {
      ({ cancelRemote } = await import('./comfy-client.js'));
    } catch { /* ComfyUI 客户端不可用 → 只做状态收敛 */ }
  }

  for (const j of slate) {
    if (j.status === 'running') {
      recovered += 1;
      let remote = '';
      if (cancelRemote && j.remoteId) {
        try {
          await cancelRemote(loadConfig(), j.remoteId);
          remoteCleaned += 1;
          remote = '，已尝试中断远端任务';
        } catch (e) {
          remote = `，远端中断失败（${String(e?.message ?? e).slice(0, 120)}）—— 产物可能仍会落到 ComfyUI output/`;
        }
      }
      await jobStore().upsert({
        ...j,
        status: 'interrupted',
        error: `${INTERRUPTED_MSG}${remote}`,
        updatedAt: now,
      });
      continue;
    }

    // queued：只保留本进程确实还挂着的
    if (pendingIds.has(j.id) || activeIds.has(j.id)) continue;
    const created = Number(j.createdAt) || 0;
    const ageOk = !created || now - created > QUEUED_ORPHAN_MS;
    // 刚重启时所有 queued 都"对本进程不可见"，但刚提交的可能是别处并行写入，
    // 所以只把确实老化的判死；老化的必定是重启前的遗留。
    if (!ageOk) continue;
    orphaned += 1;
    await jobStore().upsert({
      ...j,
      status: 'failed',
      error: 'QUEUE_ORPHANED: 任务在队列中排队时插件重启，未开始执行。请重新提交。',
      finishedAt: now,
      updatedAt: now,
    });
  }
  return { recovered, orphaned, remoteCleaned };
}

/**
 * 执行一个任务。runner(job, hooks) 返回 { outputs, remoteId }。
 *
 * `hooks.onSubmitted(remoteId)` 用于**提交成功后立刻**把远端 ID 落盘 ——
 * 不这样做的话"已提交但未完成"期间取消任务无法通知远端，GPU 会继续跑完。
 *
 * @param {object} job
 * @param {(job:object, hooks:{onSubmitted:(remoteId:string)=>Promise<void>})=>Promise<{outputs?:any[],remoteId?:string}>} runner
 */
export async function runJob(job, runner) {
  const local = isLocalBackend(job.backendId);

  /** 提交回调：把 remoteId 写进 job 存储，并更新**闭包里的 job 引用**，
   *  避免后续收尾时用旧值把它覆盖回 null。 */
  async function onSubmitted(remoteId) {
    if (!remoteId || job.remoteId === remoteId) return;
    job = { ...job, remoteId, updatedAt: Date.now() };
    try { await jobStore().upsert(job); } catch { /* 落盘失败不阻断执行 */ }
  }

  try {
    if (local) {
      if (job.status !== 'queued') {
        job = { ...job, status: 'queued', updatedAt: Date.now() };
        await jobStore().upsert(job);
      }
      await acquireSlot(job.id, job.backendId);
      if (isCancelled(job.id)) {
        await jobStore().upsert({ ...job, status: 'cancelled', error: CANCELLED_MSG, updatedAt: Date.now() });
        return { outputs: [], remoteId: job.remoteId ?? null, cancelled: true };
      }
    } else if (isCancelled(job.id)) {
      await jobStore().upsert({ ...job, status: 'cancelled', error: CANCELLED_MSG, updatedAt: Date.now() });
      return { outputs: [], remoteId: job.remoteId ?? null, cancelled: true };
    }

    job = { ...job, status: 'running', startedAt: Date.now(), updatedAt: Date.now() };
    await jobStore().upsert(job);

    try {
      const result = await runner(job, { onSubmitted });
      // 取消与完成竞态：产物已拿到就不再理会取消。`runWorkflow` 可能已经下载完文件、
      // 填好 outputs 才被取消标志命中，此时照常抛 CancelledError 会让产物躺在盘上
      // 却无人认领（任务标 cancelled、outputs 为空）。文件是事实，以已提交的终态为准。
      const raced = isCancelled(job.id) && Array.isArray(result?.outputs) && result.outputs.length > 0;
      if (isCancelled(job.id) && !raced) throwIfCancelled(job);
      const finalRemoteId = result?.remoteId ?? job.remoteId ?? null;
      job = {
        ...job,
        status: 'completed',
        error: null,
        outputs: result?.outputs ?? job.outputs ?? [],
        warnings: [
          ...(job.warnings ?? []),
          ...(result?.warnings ?? []),
          ...(raced ? ['任务在取回产物后才收到取消请求，产物已保留。'] : []),
        ],
        remoteId: finalRemoteId,
        finishedAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (err) {
      const isCancel = err instanceof CancelledError || isCancelled(job.id);
      // 取消/失败也要保留已提交的 remoteId，否则用户无法据此排查远端残留
      const latest = await jobStore().get(job.id).catch(() => null);
      job = {
        ...job,
        remoteId: latest?.remoteId ?? job.remoteId ?? null,
        status: isCancel ? 'cancelled' : 'failed',
        error: isCancel ? CANCELLED_MSG : String(err?.message || err),
        finishedAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    await jobStore().upsert(job);

    // 任务终结后按保留策略裁剪 jobs.json（失败绝不影响已成功的任务）
    try {
      await pruneJobs();
    } catch { /* 保留策略失败不影响任务结果 */ }
  } finally {
    clearCancelled(job.id);
    if (local) releaseSlot(job.id);
  }
  return job;
}

export function runtimeStats() {
  return {
    activeLocal: activeLocal.size,
    pending: pending.length,
    maxLocal: maxLocal(),
    cancelled: cancelled.size,
  };
}
