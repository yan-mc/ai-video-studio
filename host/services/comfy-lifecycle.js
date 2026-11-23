/**
 * ComfyUI 生命周期编排 —— 让 GPU 资源按需占用。
 *
 * ============================================================================
 * 为什么要做这件事
 * ============================================================================
 *
 * 这台机器上同时住着两个吃显存的东西：
 *   · ComfyUI + H3        常驻约 10–14GB
 *   · 本地 7B 翻译模型     约 5GB
 *
 * 而它们的**使用时刻完全不重叠**：
 *   用户写提示词 → 点「编译」→ 需要翻译模型（ComfyUI 关着）
 *   用户看编译结果 → 点「开始跑」→ 需要 ComfyUI（翻译模型已退）
 *   批次跑完 → 都不需要（可以全关）
 *
 * 所以正确做法不是"两个都常驻，祈祷别 OOM"，而是**按阶段启停**。
 * 启停耗时（ComfyUI 约 30–90 秒、7B 约 20–60 秒）相对于 H3 本身的
 * 渲染时间（每段 5–20 分钟）可以忽略。
 *
 * ============================================================================
 * 关键约束：只关"自己拉起的"
 * ============================================================================
 *
 * 如果用户本来就手动开着 ComfyUI（可能在跑别的东西），批次结束后
 * **不能替他关掉** —— 那是破坏性操作。
 *
 * 所以状态分成两个正交的事实：
 *   · `startedByUs`  —— 全局事实：这个实例是不是**我们**拉起来的（只有它允许被关）
 *   · `owners`       —— 持有者集合：还有哪些批次在用它
 *
 * 必须在最后一个持有者离开、且实例确实是我们拉起的时候才关。
 * 只用一个布尔会丢信息：两个批次并发时，后来的批次看到「已在运行」就把标记清成
 * false，先来的批次结束后就永远不再关（显存泄漏）；反过来先来的批次结束时直接关，
 * 会把后来那个正在跑的批次掐死。
 *
 * @module comfy-lifecycle
 */

/** 这个 ComfyUI 实例是否由本进程拉起（只有 true 时才允许我们关它） */
let startedByUs = false;
/** 当前仍在使用 ComfyUI 的批次 id 集合 */
const owners = new Set();

/**
 * 批次开始前确保 ComfyUI 在跑，并把 ownerId 登记为持有者。
 *
 * @param {object} cfg
 * @param {(msg:string)=>void} [log]
 * @param {string} [ownerId] 批次标识；缺省用单一批次占位
 * @returns {Promise<{started:boolean, alreadyRunning:boolean, detail:string}>}
 */
export async function ensureComfyRunning(cfg, log = () => {}, ownerId = 'default') {
  const C = await import('./comfy-control.js');
  owners.add(ownerId);

  const st = await C.comfyStatus();
  if (st?.running) {
    // 用户自己开着（或别的进程开的）—— 记下来，结束时不关
    log('ComfyUI 已在运行，本次批次不接管其生命周期');
    return { started: false, alreadyRunning: true, detail: '已在运行' };
  }

  log('ComfyUI 未运行，正在拉起…');
  const r = await C.startComfy();
  if (!r?.ok) {
    owners.delete(ownerId);
    throw new Error(`COMFY_START_FAILED: ${r?.detail || '未知原因'}`);
  }
  startedByUs = true;
  log('ComfyUI 已就绪');
  return { started: true, alreadyRunning: false, detail: r.detail ?? '已启动' };
}

/**
 * 批次结束后释放 ComfyUI。
 *
 * 只在「本次批次自己拉起的 + 没有别的持有者」的情况下才关 —— 用户手动开的绝不碰。
 *
 * @param {(msg:string)=>void} [log]
 * @param {string} [ownerId] 与 ensureComfyRunning 传入的一致
 * @returns {Promise<{stopped:boolean, skipped:boolean, detail:string}>}
 */
export async function releaseComfy(log = () => {}, ownerId = 'default') {
  owners.delete(ownerId);
  if (!startedByUs) {
    return { stopped: false, skipped: true, detail: 'ComfyUI 不是本进程拉起的，保持不动' };
  }
  if (owners.size) {
    return { stopped: false, skipped: true, detail: `仍有 ${owners.size} 个批次在使用，暂不关闭` };
  }
  const C = await import('./comfy-control.js');
  log('批次结束，正在关闭 ComfyUI 释放显存…');
  const r = await C.stopComfy();
  if (r?.ok) {
    startedByUs = false;
    log('ComfyUI 已关闭');
    return { stopped: true, skipped: false, detail: r.detail ?? '已停止' };
  }
  return { stopped: false, skipped: false, detail: r?.detail ?? '停止失败' };
}

/** 当前是否由本进程拉起且有批次持有 ComfyUI（排障用） */
export function isOwnedByBatch() {
  return startedByUs && owners.size > 0;
}