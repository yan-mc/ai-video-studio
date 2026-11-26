/**
 * 南风 V15 潜空间续写 —— 批次编排。
 *
 * 南风机制（latent_continuation.py）：
 *   1. 解析「潜空间续写任务」JSON，校验 workflow / node / group / run / index
 *   2. `data["node"]` 必须等于 ComfyUI 注入的 unique_id
 *   3. folder = `nanfeng_v15_context/` + sha256(json([workflow, node, group, run]))
 *   4. 每段采样后把成对 AV latent 存到 `<folder>/clip_<index>.safetensors`
 *   5. 下一段用 MiniMaxH3MotionContextLoadLatent 读 clip_<index-1>
 *
 * 我们的策略：南风靠前端状态生成 workflow/node/group/run，我们用**后端批次对象**。
 * buildWorkflow 固定节点 ID 为 '1'，所以 `node` 恒为 '1'。
 * 批次状态落盘到 `<dataDir>/runs/<batchId>.json`。
 *
 * @module nanfeng/continuation
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

/** 续写 latent 的磁盘根目录名（南风硬编码，不能改） */
export const CONTEXT_ROOT = 'nanfeng_v15_context';

/** context_length 的合法取值（南风校验） */
export const CONTEXT_LENGTHS = Object.freeze(['5', '22', '39', '56']);

/** 租约心跳超时：超过这个时长没有心跳的 `running` 批次视为失效，可被接管 */
export const LEASE_TIMEOUT_MS = 90_000;

/**
 * 复刻南风的 folder 计算逻辑。
 *
 * 必须与 latent_continuation.py 完全一致：
 *   identity = json.dumps([workflow, node, group, run], ensure_ascii=False)
 *   folder = "nanfeng_v15_context/" + sha256(identity).hexdigest()
 *
 * Python 的 `json.dumps` 对列表的默认分隔符是 `, ` 和 `: `（带空格），
 * 而 JSON.stringify 不带 —— 这是行为等价的关键细节。
 *
 * ⚠️ 该等价性只对**不含** `,` `:` 转义字符的 id 成立。batchId/runId 是 UUID，
 *    所以当前输入正确；若将来换成含特殊字符的 id，folder 会与 Python 不一致。
 *
 * @param {{ workflow: string, node: string, group: string, run: string }} id
 * @returns {string} 形如 nanfeng_v15_context/<64位hex>
 */
export function contextFolder({ workflow, node, group, run }) {
  const identity = JSON.stringify([workflow, node, group, run])
    .replace(/,/g, ', ')
    .replace(/:/g, ': ');
  const hash = createHash('sha256').update(identity, 'utf8').digest('hex');
  return `${CONTEXT_ROOT}/${hash}`;
}

/** 校验一组续写参数 */
export function validateSettings({ contextLength = '22', audioContextLength = 24 }) {
  if (!CONTEXT_LENGTHS.includes(String(contextLength))) {
    throw new Error(`context_length 必须为 ${CONTEXT_LENGTHS.join('/')}，收到 ${contextLength}`);
  }
  const n = Number(audioContextLength);
  if (!Number.isInteger(n) || n < 0 || n > 240) {
    throw new Error(`audio_context_length 必须为 0～240 的整数，收到 ${audioContextLength}`);
  }
}

/**
 * 创建一个续写批次。
 *
 * `reuse={batchId, runId, contextLength}` 用于断点续跑：contextFolder 由
 * (batchId, node, group=batchId, runId) 四元组算出，换了 id 就找不到
 * 已经落盘的 `clip_00001..n`。
 *
 * 安全性由调用方保证：replace-runner 会先确认 clip_00001..n-1 都存在。
 */
export function createBatch({
  projectId,
  shotIds,
  preset = 'continuation',
  contextLength = '22',
  audioContextLength = 24,
  trimFrames = null,
  reuse = null,
}) {
  if (!Array.isArray(shotIds) || shotIds.length === 0) {
    throw new Error('续写批次至少需要一个镜头');
  }
  validateSettings({ contextLength, audioContextLength });

  const canReuse = reuse && typeof reuse.batchId === 'string' && typeof reuse.runId === 'string';
  const batchId = canReuse ? reuse.batchId : randomUUID();
  const runId = canReuse ? reuse.runId : randomUUID();

  return {
    batchId,
    runId,
    projectId,
    preset,
    contextLength: String(contextLength),
    audioContextLength: Number(audioContextLength),
    trimFrames,
    contextFolder: contextFolder({
      workflow: batchId,
      node: '1',
      group: batchId,
      run: runId,
    }),
    shots: shotIds.map((shotId, i) => ({
      index: i + 1,
      shotId,
      status: 'pending',
      jobId: null,
      outputRel: null,
      frames: null,
    })),
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 取某一段的续写任务 JSON（填进「潜空间续写任务」参数）。
 *
 * **段 1 也要给**（index=1）：南风把读写 latent 都挂在同一个 `if continuation:`
 * 下，段 1 不给任务 → 不保存 latent → 段 2 Load clip_1 报
 * "is neither a file nor a folder"。
 * 官方设计就是首段 Load 0 / Save 1（Load 0 不读文件、条件透传、trim_frames=0）。
 *
 * ⚠️ 批次级的 `contextLength` / `audioContextLength` 必须写进任务 JSON。
 *    预设里的 `context_length` 是写死的 '22'；批次选了 56 却只裁 22 帧，
 *    交付总时长会比规划短一截，接缝也更明显，而且零报错。
 *
 * @param {object} batch
 * @param {number} index 1-based
 * @returns {string}
 */
export function taskFor(batch, index) {
  const payload = {
    workflow: batch.batchId,
    node: '1',
    group: batch.batchId,
    run: batch.runId,
    index: Number(index),
  };
  const ctxLen = String(batch?.contextLength ?? '22');
  if (CONTEXT_LENGTHS.includes(ctxLen)) payload.context_length = ctxLen;
  const audioLen = Number(batch?.audioContextLength);
  if (Number.isInteger(audioLen) && audioLen >= 0 && audioLen <= 240) {
    payload.audio_context_length = audioLen;
  }
  return JSON.stringify(payload);
}

/**
 * 批次级续写参数的**参数覆盖层**（供 api/generator 直接塞进 nanfengExtra）。
 *
 * 上游 `context_length` 只认参数，不认任务 JSON 里的同名字段；
 * 所以必须在提交时把它们写进「潜空间续写」参数，否则批次值不生效。
 *
 * @param {object} batch
 * @returns {{ context_length: string, audio_context_length: number }}
 */
export function continuationParamsFor(batch) {
  const ctxLen = String(batch?.contextLength ?? '22');
  const audioLen = Number(batch?.audioContextLength ?? 24);
  return {
    context_length: CONTEXT_LENGTHS.includes(ctxLen) ? ctxLen : '22',
    audio_context_length: Number.isInteger(audioLen) && audioLen >= 0 && audioLen <= 240 ? audioLen : 24,
  };
}

/**
 * 批次落盘 / 读取。
 *
 * 路径：`<dataDir>/runs/<batchId>.json`
 */
export function batchFile(dataDir, batchId) {
  return path.join(dataDir, 'runs', `${batchId}.json`);
}

/* ==========================================================================
 * 原子写 —— 与 host/store/json-store.js 的策略保持一致
 * ========================================================================== */

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);
const SLEEPER = new Int32Array(new SharedArrayBuffer(4));

/** 同步睡眠（不烧 CPU；主线程不允许 Atomics.wait 时退到 ≤2ms 忙等） */
function sleepSync(ms) {
  if (ms <= 0) return;
  try {
    Atomics.wait(SLEEPER, 0, 0, ms);
    return;
  } catch { /* 主线程不允许，走短忙等 */ }
  const until = Date.now() + Math.min(ms, 2);
  while (Date.now() < until) { /* 最多 2ms */ }
}

let tmpSeq = 0;
function tmpNameFor(file) {
  tmpSeq += 1;
  return `${file}.${process.pid}.${tmpSeq}.tmp`;
}

/** 尽力而为地把原文件复制成 .bak（失败不影响主流程） */
function backupSync(file) {
  try {
    if (!fs.existsSync(file)) return;
    const st = fs.statSync(file);
    if (!st.isFile() || st.size === 0) return;
    fs.copyFileSync(file, `${file}.bak`);
  } catch { /* ignore */ }
}

/**
 * rename 失败时的兜底：直接覆盖写。
 *
 * 非原子（写到一半崩溃会留下截断文件），但它保证"旧数据要么被完整替换、
 * 要么原样保留 + 留下 .bak"，绝不会出现"目标被删、tmp 也被删、两份都没了"。
 */
function overwriteFallback(file, data) {
  const tmp = tmpNameFor(file);
  try {
    fs.writeFileSync(tmp, data, 'utf8');
    fs.copyFileSync(tmp, file);
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
  }
}

function writeSyncAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = JSON.stringify(value, null, 2);
  backupSync(file);

  const tmp = tmpNameFor(file);
  fs.writeFileSync(tmp, data, 'utf8');

  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      lastError = err;
      if (!RETRYABLE.has(err.code)) break;
      // 关键：这里**不删目标文件** —— 删了会让"重试失败"变成"数据丢失"
      sleepSync(5 + attempt * 8);
    }
  }
  try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
  try {
    overwriteFallback(file, data);
    return;
  } catch (err) {
    throw lastError || err || new Error(`BATCH_SAVE_FAILED: ${file}`);
  }
}

/** 读批次 JSON；解析失败时保留 .corrupt 并回退 `.bak` */
function readBatchFile(file) {
  let txt;
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  if (!txt.trim()) return null;
  try {
    return JSON.parse(txt);
  } catch (err) {
    try { fs.copyFileSync(file, `${file}.corrupt`); } catch { /* ignore */ }
    try {
      const bak = JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8'));
      console.warn(`[jiuzhang] 批次文件 ${file} 损坏，已回退到 .bak（上一版备份）`);
      try {
        const tmp = tmpNameFor(file);
        fs.writeFileSync(tmp, JSON.stringify(bak, null, 2), 'utf8');
        fs.renameSync(tmp, file);
      } catch { /* 写不回也不影响本次读取 */ }
      return bak;
    } catch { /* 没有可用备份 */ }
    throw new Error(`CORRUPT_JSON: ${file}: ${err.message}`);
  }
}

export function saveBatch(dataDir, batch) {
  batch.updatedAt = Date.now();
  writeSyncAtomic(batchFile(dataDir, batch.batchId), batch);
  return batch;
}

export function loadBatch(dataDir, batchId) {
  return readBatchFile(batchFile(dataDir, batchId));
}

/** 列出某项目下的所有批次 */
export function listBatches(dataDir, projectId = null) {
  const dir = path.join(dataDir, 'runs');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const b = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (!b || !b.batchId) continue;
      if (projectId && b.projectId !== projectId) continue;
      out.push(b);
    } catch { /* 跳过坏文件 */ }
  }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** 批次状态机推进（从 shots 的各自状态推导整体状态） */
export function advanceStatus(batch) {
  const st = batch.shots.map((s) => s.status);
  if (st.every((s) => s === 'completed')) batch.status = 'completed';
  else if (st.some((s) => s === 'running')) batch.status = 'running';
  else if (st.some((s) => s === 'failed')) batch.status = 'failed';
  else if (st.some((s) => s === 'cancelled')) batch.status = 'cancelled';
  else if (st.every((s) => s === 'pending')) batch.status = 'pending';
  else batch.status = 'partial';
  return batch.status;
}

/**
 * 找下一个待执行的段。
 *
 * 续写必须严格按序：第 n 段依赖第 n-1 段存下的 latent。
 */
export function nextPendingIndex(batch) {
  for (const s of batch.shots) {
    if (s.status === 'pending') return s.index;
    if (s.status !== 'completed') return null; // 前面有未完成，不能跳
  }
  return null;
}

/**
 * 清理某批次的 latent 目录。
 *
 * latent 存在 ComfyUI 的 output 目录下（不在我们的 dataDir），
 * 本插件**不做删除** —— vendor 的 latent_continuation.py 也只写不删，
 * 跑多批之后 <ComfyUI output>/nanfeng_v15_context/ 会累积到 GB 级。
 * 需要人工按 contextFolder 清理，这里只回报位置。
 *
 * @returns {{ removed: false, folder: string, hint: string }}
 */
export function cleanupContext(dataDir, batch) {
  return {
    removed: false,
    folder: batch.contextFolder,
    hint: 'latent 目录在 ComfyUI 的 output 下，插件不自动回收；'
      + '确认批次彻底结束后可手工删除该 folder（跑多批后会累积到 GB 级）。',
  };
}

/* ==========================================================================
 * 分段规划
 * ========================================================================== */

/**
 * 把请求秒数吸附到 H3 的 17k+5 帧网格（与 vendor `duration_to_frames()` 一致）。
 *
 * 不能用 store/models.js 的 `h3Length()`：那个有 124 帧下限，只适合"单镜至少
 * 5 秒"；规划需要不带下限的纯网格函数，否则短段会被强行抬到 5.17s。
 *
 * ⚠️ 取模必须先归一到非负：Python 的 `%` 对负数返回正余数，JS 的返回负值。
 *    6s → round(144)=144；`(5-144%17)%17` 在 Python 是 14（→158 帧），
 *    JS 直译是 -3（→141 帧，差 17 帧 = 0.7 秒）。
 */
export function snapToGrid(seconds, fps = 24) {
  const raw = Math.max(5, Math.round(Number(seconds) * fps));
  const pad = (((5 - (raw % 17)) % 17) + 17) % 17;
  return raw + pad;
}

/**
 * 规划一个续写批次的每段时长。
 *
 * 群友那套 9 段 45s 的配方在本地南风上不复现：`duration_to_frames(6.0)`
 * 会吸附到 158 帧 = 6.583s，裁 22 帧后交付 136 帧 = 5.667s。所以必须
 * **从目标总时长反推**每段请求时长，而不是照抄 6s。
 *
 * 算法：
 *   · 段 1 不裁，交付 = 采样帧数
 *   · 段 n>1 交付 = 采样帧数 − trimFrames（由 context_length 决定）
 *   · 采样帧数必须落在 5 + 17k 网格上
 *   · 目标：Σ交付帧数 最接近 targetSeconds × fps
 *   · 段 2..N 用同一请求时长（保证节奏一致），遍历候选网格点取最优
 *
 * @returns {{ segments: Array<{index:number, requestSec:number, sampleFrames:number,
 *            deliverFrames:number, deliverSec:number}>, totalSec:number,
 *            targetSec:number, trimFrames:number, warnings:string[] }}
 */
export function planSegments({
  targetSeconds,
  segments,
  contextLength = '22',
  fps = 24,
  /** 段 1 的最小采样帧数（叙事 124；换人任务可降到 56，段越短漂移越小） */
  minFirstFrames = 124,
  maxSegmentFrames = 362,
} = {}) {
  const warnings = [];
  const n = Math.max(2, Math.min(32, Math.round(Number(segments) || 9)));
  const target = Math.max(1, Number(targetSeconds) || 45);
  const ctx = String(contextLength);
  if (!CONTEXT_LENGTHS.includes(ctx)) {
    throw new Error(`context_length 必须为 ${CONTEXT_LENGTHS.join('/')}，收到 ${contextLength}`);
  }
  const trimFrames = Number(ctx);
  const f1Min = Math.max(5, Math.round(Number(minFirstFrames) || 124));
  const fMax = Math.max(f1Min, Math.round(Number(maxSegmentFrames) || 362));

  // 候选采样帧数：5 + 17k，k 从 3 起（至少 56 帧）到 maxSegmentFrames
  const grid = [];
  for (let k = 3; 5 + 17 * k <= fMax; k += 1) grid.push(5 + 17 * k);

  const restGrid = grid.filter((f) => f - trimFrames > 0);

  /**
   * 选点 = 三目标加权。只看"总时长最接近"会选出畸形组合
   * （15s/4 段/context=56 时选出段 1 只有 2.33s）；段 1 太短会导致身份锚定不足。
   * 权重 3:1 —— 总时长是硬指标，均衡是偏好。
   */
  let best = null;
  for (const f1 of grid) {
    for (const fr of restGrid) {
      if (f1 < f1Min) continue;
      const deliver1 = f1;
      const deliverRest = fr - trimFrames;
      const total = f1 + (n - 1) * deliverRest;
      const diffTotal = Math.abs(total - target * fps);
      const imbalance = Math.abs(deliver1 - deliverRest) / Math.max(1, deliver1, deliverRest);
      const cost = diffTotal * 3 + imbalance * fps;
      if (!best || cost < best.cost) {
        best = { f1, fr, total, diff: diffTotal, imbalance, cost };
      }
    }
  }

  if (!best) throw new Error('无法为该目标规划分段（参数不合理）');

  const out = [];
  for (let i = 0; i < n; i += 1) {
    const sampleFrames = i === 0 ? best.f1 : best.fr;
    const deliverFrames = i === 0 ? sampleFrames : sampleFrames - trimFrames;
    out.push({
      index: i + 1,
      requestSec: Math.round((sampleFrames / fps) * 1000) / 1000,
      sampleFrames,
      deliverFrames,
      deliverSec: Math.round((deliverFrames / fps) * 1000) / 1000,
    });
  }

  const totalSec = Math.round((best.total / fps) * 100) / 100;
  if (Math.abs(totalSec - target) > 1) {
    warnings.push(
      `目标 ${target}s，实际交付 ${totalSec}s（差 ${(totalSec - target).toFixed(2)}s）。`
      + '这是 17k+5 帧网格与裁切量共同约束的结果，无法更精确。',
    );
  }
  if (best.fr > 362) {
    warnings.push('单段采样帧数超过 H3 训练分布上限 362 帧，质量无保证。');
  }

  return { segments: out, totalSec, targetSec: target, trimFrames, fps, warnings };
}

/* ==========================================================================
 * 服务端编排
 * ========================================================================== */

/** 租约是否仍然有效（心跳未超时） */
export function leaseValid(batch, now = Date.now()) {
  if (!batch || batch.status !== 'running') return false;
  const at = Number(batch.heartbeatAt ?? batch.leaseAcquiredAt ?? 0);
  if (!at) return false;
  return now - at < LEASE_TIMEOUT_MS;
}

/** 某批次当前是否被别的执行者持有（有效租约且不是自己） */
export function leaseHeldByOther(batch, runnerId, now = Date.now()) {
  if (!leaseValid(batch, now)) return false;
  if (!runnerId) return true;
  return batch.runnerId !== runnerId;
}

/** 写一次租约（CAS 成功后调用） */
function claimLease(batch, runnerId, now = Date.now()) {
  batch.status = 'running';
  batch.runnerId = runnerId;
  batch.runnerPid = process.pid;
  batch.leaseAcquiredAt = now;
  batch.heartbeatAt = now;
  return batch;
}

/** 心跳：每段开始/结束时更新 */
function heartbeat(batch, now = Date.now()) {
  batch.heartbeatAt = now;
  batch.runnerPid = process.pid;
  return batch;
}

/**
 * 串行跑完一个续写批次。
 *
 * 为什么必须严格串行：续写是**链式依赖**，第 n 段的 latent 来自第 n-1 段的
 * 实际生成结果。并发跑会全部拿到空 context，等于各段独立生成，接缝全断。
 *
 * 谁能跑（租约 + CAS）：
 *   · 已完成的段跳过（断点续跑）
 *   · `running` 且租约**未过期** → 拒绝（另一个执行者正在跑）
 *   · `running` 但租约**已过期** → 视为崩溃遗留，抢占并把接管事实写进 warnings
 * 状态写入与租约获取在同一个同步块里完成（读 → 校验 → 写 running），
 * 避免"检查完到写之前"的窗口。
 *
 * @param {object} opts
 * @param {string} opts.dataDir
 * @param {string} opts.batchId
 * @param {(seg: object, taskJson: string, index: number) => Promise<object>} opts.runOne
 * @param {(evt: object) => void} [opts.onProgress]
 * @param {string} [opts.runnerId] 执行者标识（默认 "pid-<pid>-<随机>"）
 * @returns {Promise<object>} 完成后的批次对象
 */
export async function runBatch({
  dataDir,
  batchId,
  runOne,
  onProgress = () => {},
  runnerId = null,
}) {
  const me = runnerId || `pid-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const warnings = [];

  // ---- 读 → 校验 → 写 running + 租约（同一同步块，无 await） ----
  let batch = loadBatch(dataDir, batchId);
  if (!batch) throw new Error(`BATCH_NOT_FOUND: ${batchId}`);
  if (typeof runOne !== 'function') throw new Error('runOne 回调必填');

  const now = Date.now();
  if (leaseHeldByOther(batch, me, now)) {
    const err = new Error(
      `BATCH_ALREADY_RUNNING: ${batchId} 正被 ${batch.runnerId ?? '另一个执行者'} 持有`
      + `（心跳 ${Math.round((now - Number(batch.heartbeatAt || now)) / 1000)}s 前）。`
      + `租约超过 ${Math.round(LEASE_TIMEOUT_MS / 1000)}s 无心跳才会被判定失效。`,
    );
    err.code = 'BATCH_ALREADY_RUNNING';
    throw err;
  }
  if (batch.status === 'running') {
    /**
     * 崩溃遗留：状态仍是 running 但租约已过期。
     *
     * 光抢租约还不够 —— 崩溃那一刻正在跑的那一段会停在 `running`，
     * 而 `nextPendingIndex()` 遇到非 completed 且非 pending 的段会返回 null，
     * 于是批次被判定为"无法继续"、永久卡住（只能手改 JSON）。
     * 所以接管时必须把 `running` 段退回 `pending` 重跑：
     * 那一段的 latent 从未落盘，本来就没有可复用的产物。
     */
    const reclaimed = batch.shots.filter((s) => s.status === 'running');
    for (const s of reclaimed) {
      s.status = 'pending';
      s.error = `上次执行崩溃（租约过期），已重新排队`;
      s.jobId = null;
      s.outputRel = null;
      s.frames = null;
    }
    advanceStatus(batch);
    warnings.push(
      `批次此前停在 running，但心跳已超过 ${Math.round(LEASE_TIMEOUT_MS / 1000)}s 未更新 —— `
      + '判定为上次执行崩溃遗留，本次已接管'
      + (reclaimed.length ? `，并把第 ${reclaimed.map((s) => s.index).join('/')} 段重新排队` : '')
      + '。',
    );
  }

  const startIdx = nextPendingIndex(batch);
  if (startIdx == null) {
    advanceStatus(batch);
    if (batch.status === 'completed') {
      batch.warnings = [...(batch.warnings ?? []), ...warnings];
      saveBatch(dataDir, batch);
      return batch;
    }
    throw new Error(`批次无法继续：状态 ${batch.status}（有失败段，请先重置该段）`);
  }

  claimLease(batch, me, now);
  batch.warnings = [...(batch.warnings ?? []), ...warnings];
  saveBatch(dataDir, batch);
  onProgress({ batchId, status: 'running', current: completedCount(batch), total: batch.shots.length });

  for (const seg of batch.shots) {
    if (seg.status === 'completed') continue;   // 断点续跑跳过
    if (seg.index < startIdx) {
      throw new Error(`第 ${seg.index} 段状态为 ${seg.status}，续写必须按序完成`);
    }

    seg.status = 'running';
    seg.error = null;
    advanceStatus(batch);
    heartbeat(batch);
    saveBatch(dataDir, batch);
    onProgress({ batchId, status: 'running', index: seg.index, current: completedCount(batch), total: batch.shots.length });

    try {
      /**
       * taskFor 里的 index 是这个段在**连续组里**的序号，从 1 开始；
       * 段 1 没有前一段可读（Load 0 = 不读文件），但必须 Save clip_1。
       */
      const taskJson = taskFor(batch, seg.index);
      const r = await runOne(seg, taskJson, seg.index);
      seg.jobId = r?.jobId ?? seg.jobId;
      seg.outputRel = r?.outputRel ?? null;
      seg.frames = r?.frames ?? null;
      seg.status = 'completed';
    } catch (e) {
      seg.status = 'failed';
      seg.error = String(e?.message || e).slice(0, 500);
      advanceStatus(batch);
      heartbeat(batch);
      saveBatch(dataDir, batch);
      onProgress({ batchId, status: 'failed', index: seg.index, error: seg.error });
      // 失败即停 —— 后面的段依赖这一段的 latent，继续跑只会产出断链的片子
      return batch;
    }

    advanceStatus(batch);
    heartbeat(batch);
    saveBatch(dataDir, batch);
  }

  advanceStatus(batch);
  heartbeat(batch);
  saveBatch(dataDir, batch);
  onProgress({ batchId, status: batch.status, current: completedCount(batch), total: batch.shots.length });
  return batch;
}

/** 已完成段数 */
export function completedCount(batch) {
  return (batch?.shots ?? []).filter((s) => s.status === 'completed').length;
}

/**
 * 把失败的段重置成 pending，以便重跑。
 *
 * 只重置**第一个失败段及其之后**的段 —— 之前的 latent 还能用，
 * 重跑它们会白白重生成。
 */
export function resetFromFailure(batch) {
  const firstBad = batch.shots.find((s) => s.status === 'failed' || s.status === 'cancelled');
  if (!firstBad) return { reset: 0 };
  let n = 0;
  for (const s of batch.shots) {
    if (s.index >= firstBad.index) {
      s.status = 'pending';
      s.error = null;
      s.jobId = null;
      s.outputRel = null;
      s.frames = null;
      n += 1;
    }
  }
  advanceStatus(batch);
  // 失败段重置后租约不再有效，清掉执行者标记，允许新的执行者接管
  if (batch.status !== 'running') {
    batch.runnerId = null;
    batch.heartbeatAt = 0;
  }
  return { reset: n, fromIndex: firstBad.index };
}