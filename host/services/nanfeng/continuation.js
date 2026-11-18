/**
 * 南风 V15 潜空间续写 —— 批次编排。
 *
 * ============================================================================
 * 南风的续写机制（读源码理解）
 * ============================================================================
 *
 *   latent_continuation.py:
 *     1. 解析「潜空间续写任务」JSON，校验五个字段：
 *          workflow / node / group / run / index
 *     2. 关键约束：`data["node"] != str(node_id)` → ValueError
 *        也就是 JSON 里的 node 必须等于 ComfyUI 注入的 unique_id
 *     3. 算目录：folder = "nanfeng_v15_context/" + sha256(json([workflow,node,group,run]))
 *     4. 每段采样后，NanFengV15CommitContinuation 把成对 AV latent 存到
 *        <folder>/clip_<index>.safetensors
 *     5. 下一段用 MiniMaxH3MotionContextLoadLatent 读 clip_<index-1>
 *
 *   图内部接线（h3_generator.py:1622 / 2051）：
 *     LoadLatent(folder, index-1) → MiniMaxH3MotionContext(conditioning, vae, latent)
 *     → 采样 → MiniMaxH3MotionContextTrim(images, trim_frames)
 *     → CommitContinuation(latent, images, audio, folder, index)
 *
 * ============================================================================
 * 我们的实现策略
 * ============================================================================
 *
 *   南风靠**前端状态**生成 workflow/node/group/run。我们用**后端批次对象**。
 *
 *   因为 buildWorkflow 固定节点 ID 为 '1'，`unique_id` 恒为 '1'，
 *   所以 `node` 字段恒填 '1' —— 完全由后端掌控，不依赖 ComfyUI 前端。
 *
 *   批次状态落盘到 <dataDir>/runs/<batchId>.json，比南风的内存 Map 更可靠。
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

/**
 * 复刻南风的 folder 计算逻辑。
 *
 * 必须与 latent_continuation.py 完全一致：
 *   identity = json.dumps([workflow, node, group, run], ensure_ascii=False)
 *   folder = "nanfeng_v15_context/" + sha256(identity).hexdigest()
 *
 * ⚠️ Python 的 json.dumps 对列表的默认分隔符是 `, ` 和 `: `（带空格），
 *    而 JSON.stringify 不带空格。这是行为等价的关键细节。
 *
 * @param {{ workflow: string, node: string, group: string, run: string }} id
 * @returns {string} 形如 nanfeng_v15_context/<64位hex>
 */
export function contextFolder({ workflow, node, group, run }) {
  // 复刻 json.dumps([...]) → '["a", "b", "c", "d"]'
  const identity = JSON.stringify([workflow, node, group, run])
    .replace(/,/g, ', ')
    .replace(/:/g, ': ');
  const hash = createHash('sha256').update(identity, 'utf8').digest('hex');
  return `${CONTEXT_ROOT}/${hash}`;
}

/**
 * 校验一组续写参数。
 *
 * @param {object} opts
 * @param {string} opts.contextLength
 * @param {number} opts.audioContextLength
 * @throws {Error}
 */
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
 * @param {object} opts
 * @param {string} opts.projectId
 * @param {string[]} opts.shotIds  按顺序生成的镜头 id
 * @param {string} [opts.preset]   批次使用的预设 id
 * @param {string} [opts.contextLength]
 * @param {number} [opts.audioContextLength]
 * @param {number} [opts.trimFrames]   段间裁剪帧数，默认由节点决定
 * @returns {object} 批次对象
 */
export function createBatch({
  projectId,
  shotIds,
  preset = 'continuation',
  contextLength = '22',
  audioContextLength = 24,
  trimFrames = null,
}) {
  if (!Array.isArray(shotIds) || shotIds.length === 0) {
    throw new Error('续写批次至少需要一个镜头');
  }
  validateSettings({ contextLength, audioContextLength });

  const batchId = randomUUID();
  const runId = randomUUID();

  return {
    batchId,
    runId,
    projectId,
    preset,
    contextLength: String(contextLength),
    audioContextLength: Number(audioContextLength),
    trimFrames,
    // 南风的 folder 由 (workflow=batchId, node='1', group=batchId, run=runId) 决定
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
 * ⚠️ **段 1 也要给**（index=1），这不是可选的。
 *
 * 南风 V15 把「读 latent」和「保存 latent」都挂在同一个 `if continuation:` 下
 * （h3_generator.py:1620 / 2043）。段 1 不给任务 → 不保存 latent →
 * 段 2 去 Load clip_1 直接报 "is neither a file nor a folder"。
 *
 * 官方设计就是"首段 Load 0 / Save 1"：
 *   · Load clip_index = 1-1 = 0 → 不读文件，条件透传，trim_frames=0（不裁）
 *   · Save clip_index = 1        → 把本段 AV latent 存成 clip_1
 *
 * 见 ComfyUI-H3-Motion-Context README：
 *   "First clip: Load 0, Save 1. … Do not mute it."
 *
 * @param {object} batch
 * @param {number} index 1-based
 * @returns {string}
 */
export function taskFor(batch, index) {
  return JSON.stringify({
    workflow: batch.batchId,
    node: '1',
    group: batch.batchId,
    run: batch.runId,
    index: Number(index),
  });
}

/**
 * 批次落盘 / 读取。
 *
 * 路径：<dataDir>/runs/<batchId>.json
 */
export function batchFile(dataDir, batchId) {
  return path.join(dataDir, 'runs', `${batchId}.json`);
}

export function saveBatch(dataDir, batch) {
  const f = batchFile(dataDir, batch.batchId);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.tmp`;
  batch.updatedAt = Date.now();
  fs.writeFileSync(tmp, JSON.stringify(batch, null, 2), 'utf8');
  fs.renameSync(tmp, f);
  return batch;
}

export function loadBatch(dataDir, batchId) {
  const f = batchFile(dataDir, batchId);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 列出某项目下的所有批次。
 */
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

/**
 * 批次状态机推进。
 *
 * 从 shots 的各自状态推导整个批次的状态。
 */
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
 * 续写必须**严格按序**：第 n 段依赖第 n-1 段存下的 latent。
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
 * ⚠️ 只在批次彻底结束后调用 —— 中途删会导致后续段无法续接。
 *
 * @param {string} dataDir
 * @param {object} batch
 * @returns {{ removed: boolean, folder: string }}
 */
export function cleanupContext(dataDir, batch) {
  // latent 存在 ComfyUI 的 output 目录下，不在我们的 dataDir；
  // 这里只标记，实际删除由 ComfyUI 侧的清理逻辑做（或手工）。
  return { removed: false, folder: batch.contextFolder };
}

/* ==========================================================================
 * 分段规划 —— 从「目标总时长」反推每段该请求多少秒
 * ========================================================================== */

/**
 * 把请求秒数吸附到 H3 的 17k+5 帧网格。
 *
 * 与 vendor 的 `duration_to_frames()` 保持完全一致：
 *   frames = round(sec * 24)，再向上补到 5 + 17k
 *
 * ⚠️ 不要用 store/models.js 的 `h3Length()` —— 那个有 124 帧下限，
 *    只适合"单镜至少 5 秒"的场景。这里做规划需要不带下限的纯网格函数，
 *    否则短段会被强行抬到 5.17s 导致总时长算不准。
 *
 * ⚠️⚠️ 取模必须先归一到非负。
 *    vendor 是 Python：`(5 - frames % 17) % 17` —— Python 的 % 对负数返回**正**余数。
 *    JS 的 % 对负数返回**负**值，直接照抄会算错：
 *      6s → round(144) = 144；144 % 17 = 8；(5-8)%17
 *         Python → 14 → 144+14 = **158** 帧 ✅
 *         JS 直译 → -3 → 144-3 = 141 帧 ❌（差 17 帧 = 0.7 秒）
 *    所以这里显式做 `((x % 17) + 17) % 17`。
 */
export function snapToGrid(seconds, fps = 24) {
  const raw = Math.max(5, Math.round(Number(seconds) * fps));
  const pad = (((5 - (raw % 17)) % 17) + 17) % 17;
  return raw + pad;
}

/**
 * 规划一个续写批次的每段时长。
 *
 * ============================================================================
 * 为什么需要它（实测依据）
 * ============================================================================
 *
 * 群友那套 9 段 45s 的配方是：
 *   段 1 请求 6s（不裁）→ 交付 6.0s
 *   段 2-9 请求 6s → 裁 0.92s → 交付 5.08s
 *   合计 ≈ 45.6s
 *
 * **但这套数字在本地的南风 V15 上不复现。** 原因是帧数网格：
 *   群友平台：6.0s × 24 = 144 帧（不做 17k+5 吸附）
 *   本地南风：`duration_to_frames(6.0)` 会吸附到 158 帧 = 6.583s
 *   → 段 2-9 裁 22 帧后交付 136 帧 = 5.667s
 *   → 九段合计 = 6.58 + 8 × 5.67 = **51.9s**，比 45s 多了 7 秒
 *
 * 所以要凑到目标总时长，必须**从目标反推**每段请求时长，而不是照抄 6s。
 *
 * ============================================================================
 * 算法
 * ============================================================================
 *
 * 已知：
 *   · 段 1 不裁，交付 = 采样帧数
 *   · 段 n>1 交付 = 采样帧数 − trimFrames（trimFrames 由 context_length 决定）
 *   · 采样帧数必须落在 5 + 17k 网格上
 *
 * 目标：让 Σ交付帧数 最接近 targetSeconds × fps
 *
 * 做法：段 2..N 用同一个请求时长（保证节奏一致），
 *       遍历候选网格点，取总交付最接近目标的那一组。
 *
 * @param {object} opts
 * @param {number} opts.targetSeconds     目标总时长（秒）
 * @param {number} opts.segments          段数（≥2）
 * @param {string} [opts.contextLength]   决定裁切帧数，默认 '22'
 * @param {number} [opts.fps]
 * @returns {{ segments: Array<{index:number, requestSec:number, sampleFrames:number,
 *            deliverFrames:number, deliverSec:number}>, totalSec:number,
 *            targetSec:number, trimFrames:number, warnings:string[] }}
 */
export function planSegments({
  targetSeconds,
  segments,
  contextLength = '22',
  fps = 24,
} = {}) {
  const warnings = [];
  const n = Math.max(2, Math.min(32, Math.round(Number(segments) || 9)));
  const target = Math.max(1, Number(targetSeconds) || 45);
  const ctx = String(contextLength);
  if (!CONTEXT_LENGTHS.includes(ctx)) {
    throw new Error(`context_length 必须为 ${CONTEXT_LENGTHS.join('/')}，收到 ${contextLength}`);
  }
  const trimFrames = Number(ctx);

  /**
   * 候选采样帧数：5 + 17k，k 从 3 起（至少 56 帧）到 362 帧（H3 训练上限）。
   * 段 1 也需要 ≥124 帧（5.17s）才有实际意义，但先把范围放开，下面再过滤。
   */
  const grid = [];
  for (let k = 3; 5 + 17 * k <= 362; k += 1) grid.push(5 + 17 * k);

  // 段 1 不裁；段 2..N 交付 = grid − trimFrames，必须 > 0
  const restGrid = grid.filter((f) => f - trimFrames > 0);

  let best = null;
  for (const f1 of grid) {
    for (const fr of restGrid) {
      // 段 1 至少 124 帧（约 5s）—— 太短没有叙事空间
      if (f1 < 124) continue;
      const total = f1 + (n - 1) * (fr - trimFrames);
      const diff = Math.abs(total - target * fps);
      if (!best || diff < best.diff) {
        best = { f1, fr, total, diff };
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
 * 服务端编排 —— 一次调用跑完整个批次
 * ========================================================================== */

/**
 * 串行跑完一个续写批次。
 *
 * ============================================================================
 * 为什么必须有这一层
 * ============================================================================
 *
 * 原来的三个原语（建批次 / 取下一段 / 报状态）只够"手动驱动"：
 * 用户建了 9 段批次，得自己一段段点，或者写脚本轮询。
 * 对「45 秒成片」这个核心用法来说，这个体验等于功能不可用。
 *
 * ============================================================================
 * 为什么必须严格串行
 * ============================================================================
 *
 * 续写是**链式依赖**：第 n 段的 latent 来自第 n-1 段的实际生成结果。
 * 并发跑会全部拿到空 context，等于 9 段各自独立生成，接缝全断。
 * 所以这里用 for + await，不并发。
 *
 * ============================================================================
 * 可恢复
 * ============================================================================
 *
 * 每段的状态实时落盘。中途失败后再次调用 runBatch 会从
 * `nextPendingIndex()` 继续，不会重跑已完成段（那些 latent 已经花时间生成了）。
 *
 * @param {object} opts
 * @param {string} opts.dataDir
 * @param {string} opts.batchId
 * @param {(seg: object, taskJson: string, index: number) => Promise<object>} opts.runOne
 *        执行单段的回调，返回 { jobId, outputRel, frames } 或抛错
 * @param {(evt: object) => void} [opts.onProgress]
 * @returns {Promise<object>} 完成后的批次对象
 */
export async function runBatch({
  dataDir,
  batchId,
  runOne,
  onProgress = () => {},
}) {
  const batch = loadBatch(dataDir, batchId);
  if (!batch) throw new Error(`BATCH_NOT_FOUND: ${batchId}`);
  if (typeof runOne !== 'function') throw new Error('runOne 回调必填');

  // 已完成的不动；只跑待跑的
  const startIdx = nextPendingIndex(batch);
  if (startIdx == null) {
    advanceStatus(batch);
    if (batch.status === 'completed') return batch;
    throw new Error(`批次无法继续：状态 ${batch.status}（有失败段，请先重置该段）`);
  }

  batch.status = 'running';
  saveBatch(dataDir, batch);
  onProgress({ batchId, status: 'running', current: completedCount(batch), total: batch.shots.length });

  for (const seg of batch.shots) {
    if (seg.status === 'completed') continue;   // 断点续跑跳过
    if (seg.index < startIdx) {
      // 前面有非 completed 的段（失败/取消），不能越过
      throw new Error(`第 ${seg.index} 段状态为 ${seg.status}，续写必须按序完成`);
    }

    seg.status = 'running';
    seg.error = null;
    advanceStatus(batch);
    saveBatch(dataDir, batch);
    onProgress({ batchId, status: 'running', index: seg.index, current: completedCount(batch), total: batch.shots.length });

    try {
      /**
       * ⚠️ taskFor 里的 index 是这个段在**连续组里**的序号。
       *    南风要求 `node` 与 ComfyUI 注入的 unique_id 一致（我们固定 '1'），
       *    index 从 1 开始，段 1 没有前一段可读（Load 0 = 不读文件）。
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
      saveBatch(dataDir, batch);
      onProgress({ batchId, status: 'failed', index: seg.index, error: seg.error });
      // 失败即停 —— 后面的段依赖这一段的 latent，继续跑只会产出断链的片子
      return batch;
    }

    advanceStatus(batch);
    saveBatch(dataDir, batch);
  }

  advanceStatus(batch);
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
 * 只重置 **第一个失败段及其之后** 的段 —— 之前的 latent 还能用，
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
  return { reset: n, fromIndex: firstBad.index };
}
