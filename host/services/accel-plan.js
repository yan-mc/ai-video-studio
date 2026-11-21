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
 * 把 ComfyUI 返回的 LoRA 名拆成"目录 + 纯文件名"。
 *
 * ⚠️ ComfyUI 的 `folder_paths.recursive_search` 是 `os.walk(followlinks=True)`，
 * 子目录会被递归扫描，返回的名字**带目录前缀**：
 *   `00_turbo\dmad_..._8step_....safetensors`（Windows 反斜杠）
 *
 * 而 `ACCEL_PLANS` 里声明的是**纯文件名**。两边的形状不一致，直接 `includes()`
 * 永远匹配不到 —— 表现就是"明明装了却报没装"。
 */
function splitLoraName(name) {
  const s = String(name ?? '').replace(/\\/g, '/');
  const i = s.lastIndexOf('/');
  return i >= 0
    ? { dir: s.slice(0, i), base: s.slice(i + 1) }
    : { dir: '', base: s };
}

/**
 * 从文件名推断一个加速 LoRA 属于哪个学生（步数 / 家族）。
 *
 * ============================================================================
 * 为什么必须有这一层
 * ============================================================================
 *
 * DMAD 发布的是**两个互相独立的学生**：
 *   `..._4step_full_critic_...`  按 4 步从零训练
 *   `..._8step_full_critic_...`  按 8 步从零训练
 * 它们**不是**"同一个模型的粗细两档"，而是两份不同的权重。
 *
 * 把 8step 文件配 4 步采样（或反过来）不会报错，只是整条采样轨迹
 * 落在这个学生没见过的训练分布外 —— 画面"看起来能出、就是不对"。
 *
 * 本机 `models/loras` 目前只有这两个文件（已实测 object_info 确认），
 * 但用户随时可能再装 LightX2V / PDMD / FastH3 等其它家族，
 * 所以这里按**文件名**识别，识别不出就返回 unknown 而不是瞎猜。
 *
 * @param {string} fileName
 * @returns {{ family: string, steps: number|null, strength: number, confidence: 'exact'|'guess'|'unknown' }}
 */
export function classifyAccelLora(fileName) {
  const name = String(fileName ?? '').toLowerCase();
  if (!name) return { family: 'none', steps: null, strength: 1, confidence: 'exact' };

  /** 从文件名里抠步数：`4step` / `4_step` / `_4-step_` / `8steps` */
  const stepMatch = /(?:^|[_\-.l])?(\d{1,2})\s*[-_]?\s*steps?(?:[_\-.l]|$)/.exec(name);
  const steps = stepMatch ? Number(stepMatch[1]) : null;

  const family = name.includes('dmad') ? 'dmad'
    : name.includes('lightx2v') ? 'lightx2v'
      : name.includes('pdmd') ? 'pdmd'
        : name.includes('fasth3') ? 'fastvideo'
          : name.includes('turbo') ? 'turbo'
            : 'unknown';

  /**
   * 强度：蒸馏学生是**学生本体**，不是风格补丁。
   *
   * 官方原话（DMAD comfyui README）："the LoRA is the distilled student,
   * not a style"。压到 0.5 等于让一个"半蒸馏"的混合体去跑 4 步 ——
   * 去噪不干净，表现为糊、油、动态粘滞。
   * 所以加速 LoRA 的强度恒为 1.0，任何方案都不该改它。
   */
  const strength = 1.0;

  if (steps == null) return { family, steps: null, strength, confidence: family === 'unknown' ? 'unknown' : 'guess' };
  return { family, steps, strength, confidence: family === 'unknown' ? 'guess' : 'exact' };
}

/**
 * 按 ComfyUI 里**实际存在**的 LoRA 文件挑选加速方案。
 *
 * ============================================================================
 * 为什么需要自动匹配
 * ============================================================================
 *
 * 历史缺陷：`ACCEL_PLANS` 里的 `lora` 字段是**写死的文件名**。用户换机、
 * 重命名、或只装了一个学生时，写死的名字在 ComfyUI 里不存在 —— 
 * ComfyUI 会在 `/prompt` 阶段返回 `value_not_in_list`，
 * 而错误信息里只有一个文件名，用户完全看不出"是我的加速方案没配对"。
 *
 * 更糟的静默版本：如果 `sanitize()` 把不存在的 LoRA 回退成「未选择」，
 * 蒸馏栈变空 —— 4/8 步跑在未蒸馏原模型上，**能出片但质量悄悄崩**。
 * 这正是 accel-plan.js 反复警告的分布外采样。
 *
 * 这里改成：先看 ComfyUI 真实有哪些文件，再按"家族 + 步数"匹配。
 * 匹配不到就**保留方案声明**并产生一条明确的 warning（交给 job 层展示），
 * 绝不静默换成「未选择」。
 */

/**
 * 按"ComfyUI 里到底装了哪个学生"反查最合适的方案。
 *
 * 这是**防错配**的核心：LoRA 与 (步数 / 采样器 / 调度器 / shift) 必须永远成套。
 * 少装一个学生时，正确做法不是"还用原方案的步数去跑另一个学生"
 * （那是分布外采样，能出片但质量崩），而是**整套换到匹配的方案上**。
 *
 * @param {string} planId
 * @param {string[]|null} loraFiles
 * @returns {{ plan: object, lora: string, steps: number, sampler: string, scheduler: string,
 *             shiftVideo: number|null, shiftAudio: number|null, needShiftNode: boolean,
 *             warnings: string[], matched: string, loraMeta: object }}
 */
export function resolveAccelForFiles(planId, loraFiles) {
  const base = planForShot(planId);
  const warnings = [...base.warnings];
  const files = Array.isArray(loraFiles)
    ? loraFiles.filter((x) => typeof x === 'string' && x).map(splitLoraName)
    : null;

  // none 方案：不挂 LoRA，不需要匹配
  if (!base.lora) {
    return { ...base, matched: 'declared', loraMeta: classifyAccelLora('') };
  }

  // 没探测到文件列表（ComfyUI 不可达）：按声明的名字提交，让 ComfyUI 自己报错
  if (!files || !files.length) {
    return {
      ...base,
      matched: 'no-lora-dir',
      loraMeta: classifyAccelLora(base.lora),
      warnings: [...warnings,
        `未能从 ComfyUI 读取 LoRA 目录，"${base.lora}" 将按原样提交。`
        + '如果 ComfyUI 不可达或该文件已被改名，任务会在提交阶段失败。'],
    };
  }

  /**
   * ⚠️ 比对用**纯文件名**，提交用**完整名（含目录）**。
   *
   * `ACCEL_PLANS` 声明的是 `dmad_..._8step_....safetensors`，
   * 而 ComfyUI 现在返回 `00_turbo\dmad_..._8step_....safetensors`。
   * 只按字符串全等比对会永远 miss（"装了却说没装"）。
   */
  const byBase = new Map(files.map((f) => [f.base, f]));

  // 1) 声明名存在（纯名比对）→ 用**带目录的完整名**提交
  const exactFile = byBase.get(base.lora);
  if (exactFile) {
    const meta = classifyAccelLora(base.lora);
    const resolved = exactFile.dir ? `${exactFile.dir}/${exactFile.base}` : exactFile.base;
    const note = exactFile.dir
      ? []
      : warnings;
    return { ...base, lora: resolved, matched: 'declared', loraMeta: meta, warnings: note };
  }

  // 2) 声明名不存在 → 优先找"同家族 + 同步数"的替代文件
  const wanted = classifyAccelLora(base.lora);
  const candidates = files
    .map((f) => ({ file: f, meta: classifyAccelLora(f.base) }))
    .filter((c) => c.meta.family === wanted.family);

  const same = candidates.find((c) => c.meta.steps === wanted.steps);
  if (same) {
    const resolved = same.file.dir ? `${same.file.dir}/${same.file.base}` : same.file.base;
    warnings.push(
      `加速方案声明的是「${base.lora}」，但 ComfyUI 里只有「${same.file.base}」——`
      + `已自动改用它（同家族、同为 ${wanted.steps} 步）。`,
    );
    return { ...base, lora: resolved, matched: 'auto', loraMeta: same.meta, warnings };
  }

  // 3) 同家族但步数不同 → **整套换成匹配的方案**（LoRA 与步数必须成套）
  for (const c of candidates) {
    if (c.meta.steps == null) continue;
    const alt = Object.values(ACCEL_PLANS).find((p) => p.lora === c.file.base);
    if (!alt) continue;
    const resolved = c.file.dir ? `${c.file.dir}/${c.file.base}` : c.file.base;
    warnings.push(
      `加速方案「${base.plan.label}」所需的「${base.lora}」不在 ComfyUI 里，`
      + `但同家族的「${c.file.base}」存在（${c.meta.steps} 步学生）。`
      + `已整套切换到「${alt.label}」：LoRA=${alt.lora} · 步数=${alt.steps} · `
      + `采样器=${alt.sampler} · 调度器=${alt.scheduler}。`
      + '——批次采样必须落在学生训练时用的步数上，只换文件不换步数属于分布外采样。',
    );
    const switched = planForShot(alt.id);
    return {
      ...switched,
      lora: resolved,
      matched: 'switched-plan',
      loraMeta: c.meta,
      warnings: [...warnings, ...switched.warnings],
    };
  }

  // 4) 家族都没有 → 保留声明名，明确警告（不静默降级成「未选择」）
  warnings.push(
    `加速方案「${base.plan.label}」需要 LoRA「${base.lora}」，`
    + `但 ComfyUI 的 loras 目录里既没有这个文件，也没有同家族的替代品。`
    + `当前可用的 LoRA：${files.map((f) => f.base).join('、') || '（空）'}。`
    + '请装回该文件，或改用别的加速方案 —— 否则任务会在提交阶段被 ComfyUI 拒绝。',
  );
  return { ...base, matched: 'declared-missing', loraMeta: wanted, warnings };
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

  /**
   * 不加速（`none`）时的步数校验。
   *
   * ==========================================================================
   * 为什么这条必须补
   * ==========================================================================
   *
   * 以前这里直接 `return { ok: true, warning: '' }` —— 不加速方案**不校验步数**。
   * 于是「选 none 但前端 steps 仍是 8」这种组合一路绿灯跑到 ComfyUI，
   * 结果是原模型只用 8 步去噪，远未收敛，出片一片模糊。
   *
   * 而这不是「分布外」那么轻：蒸馏学生在 8 步是**训练设定**，
   * 原模型在 8 步是**没跑完**。前者质量下滑，后者是废片。
   *
   * 阈值取 50%（默认 50 步 → 25 步）：低于这个量级基本不可能收敛。
   */
  if (plan.family === 'none' && n < Math.ceil(plan.steps * 0.5)) {
    return {
      ok: false,
      warning: `不加速却只跑 ${n} 步 —— 原模型默认 ${plan.steps} 步，`
        + `低于 ${Math.ceil(plan.steps * 0.5)} 步去噪远未完成，出片会明显模糊。`
        + '要么把步数提到推荐值，要么改回 DMAD 加速方案。',
    };
  }
  return { ok: true, warning: '' };
}
