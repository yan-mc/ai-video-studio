/**
 * H3 加速方案（Acceleration Plan）。
 *
 * 本项目只维护 DMAD 一条路线：单个通用 LoRA（Ref2VA / FL2VA / T2VA 共用），
 * 采样器 `lcm`、调度 `simple`、shift **12 / 2**（音频是 2 不是 3），
 * 步数必须落在学生训练的那一档（4step / 8step）。
 *
 * shift 必须显式设：`MiniMaxH3` 模型的 `sampling_settings` 写死 `12.0 / 3.0`，
 * 那是**未蒸馏原模型**的取值；每个蒸馏 LoRA 都在特定 shift 上训出来，用错 sigma 网格
 * 会与训练分布错位（不报错，只是画质/动态变差）。所以方案声明了 shift 就必须插
 * `MiniMaxH3SigmaShift` 节点，不能依赖模型默认值。
 *
 * DMAD **不改变**任何输入要求：参考图 ≤9 / 视频 ≤3 / 音频 ≤3 / 总 ≤12 /
 * 帧数 17k+5 / 分辨率 32 倍数这些约束完全由插件层负责。
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
    /** 学生按 8 步从零训练：偏离即分布外，`checkSteps` 会拒绝并回退 */
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
    /** 学生按 4 步从零训练：偏离即分布外，`checkSteps` 会拒绝并回退 */
    strictSteps: true,
    hint: 'DMAD 4 步学生。最快，适合草稿与批量试错。',
  },

  // LightX2V Turbo 已移除（边缘锐度略好，但视频理解明显弱于 DMAD）。
  // 旧配置里若还写着 lightx2v，accelPlanOf() 会告警并回退到 dmad8。

  /**
   * 不做加速：用**原模型**跑，步数由用户决定。
   *
   * 50 只是**推荐值**（前端预填、`checkSteps` 校验基准），不是硬性要求 ——
   * 它在 5 秒片上慢到接近半小时级别，很多人要的其实是 25～30 步的折中。
   * 真正提交的步数由 `job.params.steps` 决定，`stepsRange.min` 是不能低于的安全线
   * （低于它去噪根本没收敛）。
   */
  'none': {
    id: 'none',
    label: '不加速（原模型，步数可调）',
    family: 'none',
    lora: '',
    sampler: 'euler',
    scheduler: 'simple',
    /** 推荐步数（前端预填、`checkSteps` 校验基准） */
    steps: 50,
    /** 步数可调范围 —— 前端据此渲染输入框的 min/max */
    stepsRange: { min: 20, max: 80, step: 1 },
    shiftVideo: null,
    shiftAudio: null,
    /** 原模型步数本就可调，按 stepsRange 校验而不是锁死 */
    strictSteps: false,
    hint: '不挂 LoRA，用原模型。步数可调（默认 50，建议 25–30 起试），单镜较慢。',
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
 * `folder_paths.recursive_search` 是 `os.walk(followlinks=True)`，子目录会被递归扫描，
 * 返回的名字**带目录前缀**（Windows 上还是反斜杠）：`00_turbo\dmad_..._8step_....safetensors`。
 * 而 `ACCEL_PLANS` 里声明的是纯文件名 —— 直接 `includes()` 永远匹配不到，
 * 表现就是"明明装了却报没装"。
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
 * DMAD 发布的是**两个互相独立的学生**（`_4step_` / `_8step_`），是两份不同的权重，
 * 不是"同一模型的粗细两档"。把 8step 文件配 4 步采样（或反过来）不会报错，
 * 只是整条采样轨迹落在学生没见过的分布外 —— 画面"看起来能出、就是不对"。
 *
 * 用户随时可能再装其它家族，所以按**文件名**识别，识别不出返回 unknown 而不是瞎猜。
 * 强度恒 1.0：蒸馏学生是学生本体，不是风格补丁。
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

  const strength = 1.0;

  if (steps == null) return { family, steps: null, strength, confidence: family === 'unknown' ? 'unknown' : 'guess' };
  return { family, steps, strength, confidence: family === 'unknown' ? 'guess' : 'exact' };
}

/**
 * 按"ComfyUI 里到底装了哪个学生"反查最合适的方案。
 *
 * `ACCEL_PLANS` 里的 `lora` 只是声明名，用户换机、重命名或只装一个学生时可能不存在。
 * 两种后果都不好：`/prompt` 阶段返回 `value_not_in_list`（错误信息只有一个文件名，
 * 看不出是方案没配对），或 `sanitize()` 回退成「未选择」→ 蒸馏栈变空 → 4/8 步跑在
 * 未蒸馏原模型上，能出片但质量悄悄崩。
 *
 * 所以先看真实文件、再按「家族 + 步数」匹配；匹配不到就保留方案声明并产生明确
 * warning，绝不静默换成「未选择」。LoRA 与 (步数 / 采样器 / 调度器 / shift) 必须
 * 永远成套 —— 少装一个学生时要**整套换方案**，而不是用原步数去跑另一个学生。
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

  // 比对用**纯文件名**，提交用**完整名（含目录）**：
  // 声明的是 `dmad_..._8step_....safetensors`，ComfyUI 返回的是
  // `00_turbo\dmad_..._8step_....safetensors`，全等比对会永远 miss。
  const byBase = new Map(files.map((f) => [f.base, f]));

  // 1) 声明名存在（纯名比对）→ 用**带目录的完整名**提交
  const exactFile = byBase.get(base.lora);
  if (exactFile) {
    const meta = classifyAccelLora(base.lora);
    const resolved = exactFile.dir ? `${exactFile.dir}/${exactFile.base}` : exactFile.base;
    // 命中子目录只追加一条说明，**不能清空**已累积的 warnings
    // （否则"未知方案已回退""声明名不存在已替换"这类提示会静默消失）
    const note = exactFile.dir
      ? [...warnings, `已按子目录完整名提交：${resolved}`]
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
 * `needShiftNode`：`shiftVideo == null` 表示"用模型默认"（只有 none 方案会这样）；
 * 其它方案一律必须插 SigmaShift 节点 —— 模型默认的 12/3 是按原模型 50 步标定的，
 * 不是给蒸馏学生用的。
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
 * `strictSteps` 的方案（dmad4 / dmad8）偏离训练步数会让整条采样轨迹落在学生
 * 没见过的分布上 —— 能出片，但质量悄悄崩。所以：
 *   · `strictSteps: true`  → **拒绝**（`ok: false`，调用方回退到方案推荐步数）
 *   · 其余                  → 允许，但给出警告并记录，绝不静默
 */
export function checkSteps(planId, steps) {
  const { plan } = accelPlanOf(planId);
  const n = Number(steps);
  if (!Number.isFinite(n) || n < 1) return { ok: false, warning: '步数非法' };
  if (n === plan.steps) return { ok: true, warning: '' };
  if (plan.family === 'dmad') {
    if (plan.strictSteps) {
      return {
        ok: false,
        warning: `${plan.label} 是按 ${plan.steps} 步从零训练的学生，不能改成 ${n} 步 —— `
          + '偏离训练步数属于分布外采样，画面能出但质感与动态会明显变差。'
          + `已按 ${plan.steps} 步执行；要别的步数请改用「不加速」方案。`,
      };
    }
    return {
      ok: true,
      warning: `${plan.label} 是按 ${plan.steps} 步训练的，你传了 ${n} 步 —— `
        + '可以跑，但属于分布外，质量不保证',
    };
  }

  /**
   * 不加速（`none`）的步数校验：安全线来自 `plan.stepsRange`（min 默认 20）。
   *
   *   · 低于 min → 拒绝（去噪没跑完，出片模糊）
   *   · 高于 max → 只警告（能跑，但收益递减、耗时线性增长）
   *   · 中间区间 → 放行
   *
   * 必须校验：蒸馏学生在 8 步是**训练设定**，原模型在 8 步是**没跑完**.
   * 「选 none 但 steps 仍是 8」一路绿灯的结果是废片。
   */
  if (plan.family === 'none') {
    const min = plan.stepsRange?.min ?? Math.ceil(plan.steps * 0.5);
    const max = plan.stepsRange?.max ?? plan.steps * 2;
    if (n < min) {
      return {
        ok: false,
        warning: `不加速却只跑 ${n} 步 —— 原模型建议 ${plan.steps} 步，`
          + `低于 ${min} 步去噪远未完成，出片会明显模糊。`
          + '要么把步数提到推荐值，要么改回 DMAD 加速方案。',
      };
    }
    if (n > max) {
      return {
        ok: true,
        warning: `不加速跑 ${n} 步超过了建议上限 ${max} 步 —— 能跑，但收益递减、`
          + '耗时线性增长，超出部分基本只是在烧时间。',
      };
    }
    return { ok: true, warning: '' };
  }
  return { ok: true, warning: '' };
}
