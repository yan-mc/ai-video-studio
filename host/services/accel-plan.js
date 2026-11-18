/**
 * H3 加速方案（Acceleration Plan）。
 *
 * ============================================================================
 * 为什么需要这一层
 * ============================================================================
 *
 * H3 原模型是 50 步、无 CFG 的 guidance-distilled 模型。社区用**蒸馏 LoRA**
 * 把它压到 4–8 步。本项目统一采用 DMAD 一条路线：
 *
 *   ┌─ dmad ─────────────────────────────────────────────────────────────┐
 *   │ DMAD（ZhengmingYu/DMAD，arXiv:2610.02188，字节 + 德州农工）        │
 *   │   对抗蒸馏（两个判别器头 + 共享 backbone，不需要辅助扩散模型）      │
 *   │   **单个通用 LoRA**，Ref2VA / FL2VA / T2VA 都用它                   │
 *   │   采样器 **lcm**，调度 simple，shift **12 / 2**（注意音频是 2 不是 3）│
 *   │   步数必须严格 4（4step 学生）或 8（8step 学生）                    │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * 历史说明：早期还接过 LightX2V Turbo（轨迹蒸馏，ref/fl2v 各一个专用 LoRA，
 * 采样器 euler）。实测它在视频理解（角色形态 / 动作连续性 / 音频起伏）上
 * 明显弱于 DMAD，已整条移除，不再作为回退方案。
 *
 * ============================================================================
 * 为什么必须显式设 shift
 * ============================================================================
 *
 * 模型自带的 `sampling_settings`（ComfyUI `supported_models.py` 的
 * `MiniMaxH3`）写死 `shift: 12.0, audio_shift: 3.0`。这是**未经蒸馏的原模型**
 * 的取值。而每个蒸馏 LoRA 是在特定 shift 上训出来的（见上面表格），
 * 用错了 sigma 网格就会和训练分布错位 —— 不会报错，只是画质/动态变差。
 *
 * 所以：**只要方案声明了 shift，就必须插 `MiniMaxH3SigmaShift` 节点**，
 * 不能依赖模型默认值。
 *
 * 实测依据：
 *   · shift=12 时 simple 8 步的 video sigma = [1,.988,.973,.952,.923,.878,.800,.632]→0
 *   · 16 步**不是** 8 步的细分，而是整条曲线重采样 → 训练点对不上
 *   · audio_shift 不改变 video sigma，只改 `audio_scale = shift/audio_shift`
 *     这一个标量（2→6.0，3→4.0），它被传给 DiT 缩放音频目标
 *
 * ============================================================================
 * 输入约束（实测确认：DMAD **不改变**任何输入要求）
 * ============================================================================
 *
 * 2026-11-16 实测（scripts/dmad_capability*.mjs）：在 DMAD 下这些全部被
 * ComfyUI 接受 —— 参考图 1/2 张、首尾帧、参考视频、参考音频、图+视频+音频混合。
 * 所以参考图 ≤9 / 视频 ≤3 / 音频 ≤3 / 总 ≤12 / 帧数 17k+5 / 分辨率 32 倍数
 * 这些约束**完全由插件层负责**，与选哪个加速方案无关。
 */

/** 方案 id → 定义。默认方案由 config.accelPlan 决定（缺省 'dmad8'）。 */
export const ACCEL_PLANS = Object.freeze({
  /**
   * DMAD 8 步学生（推荐）。
   *
   * 官方原话：8step_full_critic "brings a clear step up in audio-video quality
   * over our 4-step students"，且是**专门按 8 步从零训练**的。
   * 实测（docs/probes/dmad-2026-11-16/）在这条复杂提示词上，
   * 它对角色形态（螺旋羊角、羊尾）、动作连续性（0 跳切）、音频起伏都明显更好。
   */
  'dmad8': {
    id: 'dmad8',
    label: 'DMAD 8步（推荐）',
    family: 'dmad',
    lora: 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors',
    sampler: 'lcm',
    scheduler: 'simple',
    steps: 8,
    shiftVideo: 12,
    shiftAudio: 2,
    // 这套组合是 DMAD 学生的训练设定；偏离它就是分布外
    strictSteps: true,
    hint: 'DMAD 8 步学生，音画质量优先。单镜比 4 步慢约一倍。',
  },

  /** DMAD 4 步学生：最快，质量略逊于 8 步。 */
  'dmad4': {
    id: 'dmad4',
    label: 'DMAD 4步（最快）',
    family: 'dmad',
    lora: 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors',
    sampler: 'lcm',
    scheduler: 'simple',
    steps: 4,
    shiftVideo: 12,
    shiftAudio: 2,
    strictSteps: true,
    hint: 'DMAD 4 步学生。最快，适合草稿与批量试错。',
  },

  // LightX2V Turbo（轨迹蒸馏，ref/fl2v 各一个专用 LoRA，采样器 euler）已移除：
  // 仅在边缘锐度上略好，视频理解明显弱于 DMAD。本项目只维护 DMAD 一条线，
  // 旧配置里若还写着 lightx2v，accelPlanOf() 会告警并回退到 dmad8。

  /** 不做加速：原模型 50 步。极慢，仅供对照与排障。 */
  'none': {
    id: 'none',
    label: '不加速（原模型 50 步）',
    family: 'none',
    lora: '',
    sampler: 'euler',
    scheduler: 'simple',
    steps: 50,
    shiftVideo: null,
    shiftAudio: null,
    strictSteps: false,
    hint: '不挂 LoRA，用 50 步原模型。单镜数十分钟，仅供对照。',
  },
});

/** 方案 id 列表（前端下拉用） */
export const ACCEL_PLAN_IDS = Object.freeze(Object.keys(ACCEL_PLANS));

/** 默认方案 */
export const DEFAULT_ACCEL_PLAN = 'dmad8';

/** 取方案定义；未知 id 回退默认，并给出提示（不静默变错）。 */
export function accelPlanOf(id) {
  const key = String(id ?? '').trim();
  if (ACCEL_PLANS[key]) return { plan: ACCEL_PLANS[key], unknown: false };
  return { plan: ACCEL_PLANS[DEFAULT_ACCEL_PLAN], unknown: Boolean(key) };
}

/**
 * 把方案解析成**本次生成实际要用的参数**。
 *
 * @param {string} planId
 * @returns {{plan, lora, sampler, scheduler, steps, shiftVideo, shiftAudio, warnings:string[]}}
 */
export function planForShot(planId) {
  const { plan, unknown } = accelPlanOf(planId);
  const warnings = [];
  if (unknown) {
    warnings.push(`未知加速方案「${planId}」，已回退到 ${plan.label}`);
  }

  const lora = plan.lora ?? '';
  const shiftVideo = plan.shiftVideo ?? null;
  const shiftAudio = plan.shiftAudio ?? null;

  /**
   * ⚠️ shift 显式性的判定。
   *
   * `null` 表示"用模型默认"（只有 none 方案会这样）。
   * 其它方案一律**必须**插 SigmaShift 节点 —— 模型默认的 12/3 是按原模型
   * 50 步标定的，不是给蒸馏学生用的。
   */
  const needShiftNode = shiftVideo != null;

  return {
    plan,
    lora,
    sampler: plan.sampler,
    scheduler: plan.scheduler,
    steps: plan.steps,
    shiftVideo,
    shiftAudio,
    needShiftNode,
    warnings,
  };
}

/**
 * 校验用户想改的步数是否与方案冲突。
 *
 * DMAD 学生是在**连续时间**上训的（官方明确说 --steps 自由），
 * 但 8step 学生是**按 8 步从零训**的，偏离 8 就是分布外。
 * 折中：允许改，但给出警告并记录，绝不静默。
 */
export function checkSteps(planId, steps) {
  const { plan } = accelPlanOf(planId);
  const n = Number(steps);
  if (!Number.isFinite(n) || n < 1) return { ok: false, warning: '步数非法' };
  if (n === plan.steps) return { ok: true, warning: '' };
  if (plan.family === 'dmad') {
    return {
      ok: true,
      warning: `${plan.label} 是按 ${plan.steps} 步训练的，你传了 ${n} 步 —— `
        + '可以跑，但属于分布外，质量不保证',
    };
  }
  return { ok: true, warning: '' };
}
