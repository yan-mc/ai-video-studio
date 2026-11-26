/**
 * 换人任务创建 —— 只建记录，不启动。
 *
 * 校验放在提交那一秒：换人是长流程（切段 + N×8 分钟生成），
 * 不能跑到半小时才发现「参考图路径不存在」。
 */
import * as R from '../services/replace.js';

/** @returns {Promise<object>} 落盘后的任务记录 */
export async function createReplaceTask(body, cfg) {
  const sourceRel = String(body.sourceRel ?? '').trim();
  if (!sourceRel) throw new Error('PATH_REQUIRED: 必须指定源视频');
  const sourceAbs = R.resolveReplaceInput(sourceRel, cfg, true);

  // 参考图保持用户选择的顺序，不做重排：下标 +1 就是提示词里的 <Picture N>
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

  // 提示词整段优先（用户改过就用它），否则用结构化字段现场拼一段
  const prompt = String(body.prompt ?? '').trim()
    || R.buildReplacePrompt({
      roles: body.roles ?? [],
      shotBeats: body.shotBeats ?? '',
      extraNote: body.extraNote ?? '',
    });

  // continuation=true 走续写链路：段间用真实 AV latent 衔接，代价是严格串行
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
     * 续写链的抗身份漂移配方：`taperEnabled=false` 时后端完全不接线
     * （画面会抄上一段外观，但接缝更顺）。
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
