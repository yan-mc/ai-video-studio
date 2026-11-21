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
 * 所以这里用「引用计数式」判断：批次开始时记录它进来时是不是已运行，
 * 结束时只在「进来时是关的、且是我们拉起的」情况下才关。
 *
 * @module comfy-lifecycle
 */

/** 记录当前批次是否由我们拉起 ComfyUI */
let ownedByBatch = false;

/**
 * 批次开始前确保 ComfyUI 在跑。
 *
 * @param {object} cfg
 * @param {(msg:string)=>void} [log]
 * @returns {Promise<{started:boolean, alreadyRunning:boolean, detail:string}>}
 */
export async function ensureComfyRunning(cfg, log = () => {}) {
  const C = await import('./comfy-control.js');

  const st = await C.comfyStatus();
  if (st?.running || st?.ok) {
    // 用户自己开着 —— 记下来，结束时不关
    ownedByBatch = false;
    log('ComfyUI 已在运行，本次批次不接管其生命周期');
    return { started: false, alreadyRunning: true, detail: '已在运行' };
  }

  log('ComfyUI 未运行，正在拉起…');
  const r = await C.startComfy();
  if (!r?.ok) {
    throw new Error(`COMFY_START_FAILED: ${r?.detail || '未知原因'}`);
  }
  ownedByBatch = true;
  log('ComfyUI 已就绪');
  return { started: true, alreadyRunning: false, detail: r.detail ?? '已启动' };
}

/**
 * 批次结束后释放 ComfyUI。
 *
 * 只在「本次批次自己拉起的」情况下才关 —— 用户手动开的绝不碰。
 *
 * @param {(msg:string)=>void} [log]
 * @returns {Promise<{stopped:boolean, skipped:boolean, detail:string}>}
 */
export async function releaseComfy(log = () => {}) {
  if (!ownedByBatch) {
    return { stopped: false, skipped: true, detail: 'ComfyUI 不是本批次拉起的，保持不动' };
  }
  const C = await import('./comfy-control.js');
  log('批次结束，正在关闭 ComfyUI 释放显存…');
  const r = await C.stopComfy();
  if (r?.ok) {
    ownedByBatch = false;
    log('ComfyUI 已关闭');
    return { stopped: true, skipped: false, detail: r.detail ?? '已停止' };
  }
  return { stopped: false, skipped: false, detail: r?.detail ?? '停止失败' };
}

/** 当前是否由批次持有 ComfyUI（排障用） */
export function isOwnedByBatch() {
  return ownedByBatch;
}
