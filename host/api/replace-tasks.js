/**
 * 换人任务创建 —— 只建记录，不启动。
 *
 * 从 api/index.js 逐字迁出（原 2352-2486 行）。
 *
 * 校验放这里而不是等执行时：换人是长流程（切段 + N×8 分钟生成），
 * 参数错了必须在提交那一秒报出来。
 *
 * ⚠️ 无静态 import：它用到的全部符号都来自函数体内的动态 import
 *    （等价于 const R = await import('../services/replace.js')），无需额外依赖。
 */


/**
 * 创建一个换人任务（只是建记录，不启动）。
 *
 * 校验放在这里而不是等执行时：换人是长流程（切段 + N×8 分钟生成），
 * 参数错了要尽量在**提交那一秒**报出来，而不是跑了半小时才发现
 * 「参考图路径不存在」。
 *
 * @returns {Promise<object>} 落盘后的任务记录
 */
export async function createReplaceTask(body, cfg) {
  const R = await import('../services/replace.js');

  const sourceRel = String(body.sourceRel ?? '').trim();
  if (!sourceRel) throw new Error('PATH_REQUIRED: 必须指定源视频');
  const sourceAbs = R.resolveReplaceInput(sourceRel, cfg, true);

  /**
   * 参考图：保持用户选择的顺序，**不做任何重排**。
   *
   * 这是换人线存在的核心理由 —— 常规渲染里角色卡会插队，
   * 用户看到的 `<Picture 1>` 与实际提交的可能不是同一张。
   * 这里 `refs.images` 的数组下标 +1 就是提示词里的 `<Picture N>`。
   */
  const refImages = (Array.isArray(body.refImages) ? body.refImages : [])
    .map((r, i) => {
      const rel = String(typeof r === 'string' ? r : (r?.rel ?? '')).trim();
      if (!rel) return null;
      return { rel, pictureIndex: i + 1, name: String(r?.name ?? rel.split('/').pop()) };
    })
    .filter(Boolean);
  if (!refImages.length) throw new Error('REPLACE_REFS_REQUIRED: 至少需要一张目标角色参考图');
  if (refImages.length > 9) throw new Error(`TOO_MANY_REFS: 最多 9 张参考图，收到 ${refImages.length}`);
  // 逐张确认文件真的在（换人最贵，不能跑到一半才 FILE_NOT_FOUND）
  for (const r of refImages) R.resolveReplaceInput(r.rel, cfg, true);

  /**
   * 提示词：**两种来源，整段优先**。
   *
   *  - `body.prompt` 非空 → 直接用它（用户在前端那一个可编辑框里改过的内容）
   *  - 否则用结构化字段（roles / shotBeats / extraNote）现场拼一段
   *
   * 为什么要支持整段：占位符表单只能表达「一对一替换」。真实需求里
   * 常有多角色、指定某个角色只出现在某几段、要求某个配角保持不动等等，
   * 这些都没法用三个输入框表达。让用户直接改整段提示词是唯一不设上限的做法，
   * 同时也保留了「不想改就别改」的默认体验（打开就是填好的模板）。
   */
  const prompt = String(body.prompt ?? '').trim()
    || R.buildReplacePrompt({
      roles: body.roles ?? [],
      shotBeats: body.shotBeats ?? '',
      extraNote: body.extraNote ?? '',
    });

  /**
   * 分段模式。
   *
   * `continuation=true` 走续写链路：段间用真实 AV latent 衔接，
   * 段与段在源视频上有 `contextLength` 帧的重叠，采完裁掉。
   * 这是解决「独立重绘段间跳变」的正解 —— 但代价是严格串行、
   * 必须关二采、且任何一段失败后面全废。
   */
  const useContinuation = Boolean(body.continuation);
  const contextLength = useContinuation
    ? String(body.contextLength ?? R.REPLACE_DEFAULTS.contextLength)
    : null;

  const plan = await R.planSourceSegments(sourceAbs, cfg, {
    segmentSec: Number(body.segmentSec) || undefined,
    continuation: useContinuation,
    contextLength: contextLength ?? undefined,
    segmentCount: Number(body.segmentCount) || undefined,
  });

  const now = Date.now();
  const task = {
    id: R.newReplaceId(),
    title: String(body.title ?? '').trim() || `换人 ${new Date(now).toLocaleString('zh-CN')}`,
    status: 'draft',
    sourceRel,
    sourceHasAudio: plan.hasAudio,
    sourceWidth: plan.width,
    sourceHeight: plan.height,
    durationSec: plan.durationSec,
    segmentSec: Number(body.segmentSec) || R.REPLACE_DEFAULTS.segmentSec,
    /** 分段模式：independent（默认）| continuation */
    mode: plan.mode,
    continuation: useContinuation,
    contextLength,
    segmentCount: Number(body.segmentCount) || null,
    trimFrames: plan.trimFrames ?? null,
    overlapSec: plan.overlapSec ?? null,
    segments: plan.segments.map((s) => ({ ...s, status: 'pending', outputRel: null, jobId: null })),
    refImages,
    roles: body.roles ?? [],
    shotBeats: body.shotBeats ?? '',
    extraNote: body.extraNote ?? '',
    prompt,
    // 渲染参数：用户在页面上没改就是这一套
    accelPlan: body.accelPlan ?? R.REPLACE_DEFAULTS.accelPlan,
    preset: body.preset ?? R.REPLACE_DEFAULTS.preset,
    sampler: body.sampler ?? R.REPLACE_DEFAULTS.sampler,
    scheduler: body.scheduler ?? R.REPLACE_DEFAULTS.scheduler,
    steps: Number.isFinite(Number(body.steps)) ? Number(body.steps) : R.REPLACE_DEFAULTS.steps,
    megapixels: Number.isFinite(Number(body.megapixels)) ? Number(body.megapixels) : R.REPLACE_DEFAULTS.megapixels,
    denoise: Number.isFinite(Number(body.denoise)) ? Number(body.denoise) : R.REPLACE_DEFAULTS.denoise,
    secondPass: Boolean(body.secondPass ?? R.REPLACE_DEFAULTS.secondPass),
    /**
     * 续写链的抗身份漂移配方。
     *
     * `taperEnabled` 只有两种取值：true（用下面三个数）或 false（完全不接线，
     * 退回"干净上下文"的老行为 —— 画面会抄上一段外观，但接缝更顺）。
     * 后端读到 false 时会把 `启用续写上下文加噪` 传成 false。
     */
    taperEnabled: Boolean(body.taperEnabled ?? true),
    taperAlpha: Number.isFinite(Number(body.taperAlpha))
      ? Number(body.taperAlpha) : R.REPLACE_DEFAULTS.taperAlpha,
    taperAlphaEnd: Number.isFinite(Number(body.taperAlphaEnd))
      ? Number(body.taperAlphaEnd) : R.REPLACE_DEFAULTS.taperAlphaEnd,
    taperRampSteps: Number.isFinite(Number(body.taperRampSteps))
      ? Number(body.taperRampSteps) : R.REPLACE_DEFAULTS.taperRampSteps,
    styleId: body.styleId ?? R.REPLACE_DEFAULTS.styleId,
    lightingId: body.lightingId ?? R.REPLACE_DEFAULTS.lightingId,
    seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : 1101,
    loras: Array.isArray(body.loras) ? body.loras : [],
    overrides: body.overrides && typeof body.overrides === 'object' ? body.overrides : {},
    warnings: plan.warnings,
    finalRel: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  return R.replaceStore(cfg).upsert(task);
}
