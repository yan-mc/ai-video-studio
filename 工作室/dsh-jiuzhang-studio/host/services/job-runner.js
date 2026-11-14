/**
 * 任务执行器 —— 修复审查发现的三个真实缺陷：
 *  1) 取消只停本地轮询、不通知 ComfyUI（GPU 继续满载）→ 本实现真发 /interrupt;
 *  2) jobs.json 并发写丢字段 → 走串行 store;
 *  3) 崩溃恢复缺失 → 启动时标记 interrupted。
 *
 * 并发闸门（本地后端 limit=1）沿用原实现的正确设计：按 jobId 记账、按 backendId 判定。
 */
import { jobs as jobStore, isLocalBackendOf, LOCAL_BACKENDS } from './job-store.js';
import { loadConfig } from '../config.js';

const activeLocal = new Set();
const pending = [];                 // [{ jobId, resolve }]
const cancelled = new Set();
const CANCELLED_MSG = 'CANCELLED: 已取消';
const INTERRUPTED_MSG = 'INTERRUPTED: 插件重启，任务未完成，可重试';
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

export function markCancelled(jobId) { cancelled.add(jobId); }
export function isCancelled(jobId) { return cancelled.has(jobId); }
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
 * ⚠️ 远端取消**失败必须可见**。
 *    旧实现把 onRemoteCancel 的异常整个吞掉（`catch { /* 远端不可达不阻断取消 *\/ }`），
 *    结果是一种最坏的静默失败：UI 显示"已取消"、本地轮询确实停了，
 *    但 ComfyUI 那边 GPU 继续烧到跑完 —— 12GB 单卡串行下等于把后面的任务全堵死，
 *    而用户完全不知道。
 *    现在：本地取消照常成功（不能因为远端不可达就取消不掉），
 *    但把失败原因通过 remoteCancel / remoteCancelError 一并返回，让上层能提示。
 *
 * @param {(job)=>Promise<void>} [onRemoteCancel] 用于通知远端（ComfyUI /interrupt 等）
 */
export async function cancelJob(jobId, onRemoteCancel) {
  const job = await jobStore().get(jobId);
  if (!job) throw new Error('任务不存在');
  if (['completed', 'failed', 'cancelled'].includes(job.status)) {
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

/** 启动恢复：把残留 running/queued 标记为 interrupted（只标记不重跑） */
export async function recoverInterruptedJobs() {
  const list = await jobStore().list();
  const stale = list.filter((j) => j && (j.status === 'running' || j.status === 'queued'));
  if (!stale.length) return { recovered: 0 };
  for (const j of stale) {
    await jobStore().upsert({ ...j, status: 'interrupted', error: INTERRUPTED_MSG, updatedAt: Date.now() });
  }
  return { recovered: stale.length };
}

/**
 * 执行一个任务。runner(job) 返回 { outputs, remoteId }。
 *
 * runner 会收到第二个参数 `hooks`，其中 `onSubmitted(remoteId)` 用于
 * **提交成功后立刻**把远端 ID 落盘（见 comfy-client.runWorkflow 的说明）。
 * 不这样做的话，"已提交但未完成"期间取消任务无法通知远端，
 * GPU 会继续跑完 —— 实测复现过。
 *
 * @param {object} job
 * @param {(job:object, hooks:{onSubmitted:(remoteId:string)=>Promise<void>})=>Promise<{outputs?:any[],remoteId?:string}>} runner
 */
export async function runJob(job, runner) {
  const local = isLocalBackend(job.backendId);

  /**
   * 提交回调：把 remoteId 写进 job 存储。
   * 注意要更新**闭包里的 job 引用**，避免后续收尾时用旧值把它覆盖回 null。
   */
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
        return;
      }
    } else if (isCancelled(job.id)) {
      await jobStore().upsert({ ...job, status: 'cancelled', error: CANCELLED_MSG, updatedAt: Date.now() });
      return;
    }

    job = { ...job, status: 'running', startedAt: Date.now(), updatedAt: Date.now() };
    await jobStore().upsert(job);

    try {
      const result = await runner(job, { onSubmitted });
      throwIfCancelled(job);
      // 收尾时优先用 runner 返回的 remoteId，其次用中途已落盘的那个
      const finalRemoteId = result?.remoteId ?? job.remoteId ?? null;
      job = {
        ...job,
        status: 'completed',
        error: null,
        outputs: result?.outputs ?? job.outputs ?? [],
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
