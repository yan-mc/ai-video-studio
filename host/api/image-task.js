/**
 * 出图编排 —— REST 与 Agent 工具共用这一份。
 *
 * 两处各写一份的代价不是重复劳动，而是漂移：工具侧曾经漏了磁盘探测
 * （不存在的 LoRA 被静默接受）、漏了两类 warning、且不走 runAndArchive
 * （产物留在 outputs，素材库里查不到）。
 */
import { newJob, jobs as jobsStore } from '../services/job-store.js';
import { IMAGE_MAX_LORAS, splitBatchSeeds } from '../services/h3-image.js';
import { solveImageLoraStack } from '../services/h3-image-lora.js';
import { runH3ImageLocal } from '../services/generator.js';
import { safeId } from '../security.js';
import { runAndArchive } from './archive.js';
import { fireAndLog } from './errors.js';

export const EMPTY_SOLVED = Object.freeze({
  accepted: [], rejected: [], replaced: [], degraded: [], totalStrength: 0, warnings: [],
});

/** 求解图像 LoRA 栈（含一次磁盘探测） */
export function solveImageLoras(requested, { availableFiles = null, hasRefImages = false } = {}) {
  if (!Array.isArray(requested) || !requested.length) return EMPTY_SOLVED;
  return solveImageLoraStack(requested, {
    maxSlots: IMAGE_MAX_LORAS,
    ...(availableFiles ? { availableFiles } : {}),
    hasRefImages,
  });
}

/**
 * LoRA 求解结果 → 用户可见的 warnings。
 *
 * 五类缺一不可：单选类被替换、强度被夹紧、超槽被剔除、总强度过高、
 * 以及不在磁盘上的文件。少任何一类，Agent 触发的生成都会"看起来成功了"。
 */
export function imageLoraWarnings(solved) {
  const warnings = [];
  warnings.push(...(solved.warnings ?? []));
  for (const rp of solved.replaced ?? []) {
    warnings.push(`「${rp.category}」是单选类：「${rp.name}」被「${rp.by}」替换（同类只能挂 1 个）。`);
  }
  for (const rj of solved.rejected ?? []) {
    warnings.push(`LoRA「${rj.name}」未被使用：${rj.reason}`);
  }
  for (const dg of solved.degraded ?? []) {
    warnings.push(`LoRA「${dg.name}」强度 ${dg.from} → ${dg.to}（${dg.reason}）。`);
  }
  return warnings;
}

/** 把 ComfyUI 的三态进度写回 job（失败不阻断出图） */
export async function writeProgress(jobId, p) {
  try {
    const latest = await jobsStore().get(jobId);
    if (!latest) return;
    await jobsStore().upsert({
      ...latest,
      params: { ...(latest.params ?? {}), progress: { pct: p.pct, note: p.note, queue: p.queue ?? null } },
      updatedAt: Date.now(),
    });
  } catch { /* 进度失败不阻断 */ }
}

/**
 * 提交出图：拆批 → 建 job → runAndArchive 执行（产物自动进素材库）。
 *
 * @returns {Promise<{jobs: object[], batchId: string|null, seeds: number[]}>}
 */
export async function submitImageJobs({ body, cfg, ctx, req0, refResolved, solvedLoras, warnings, wf }) {
  const seeds = splitBatchSeeds({ seed: req0.seed, count: req0.count });
  const batchId = seeds.length > 1 ? `imgbatch_${Date.now().toString(36)}` : null;
  const jobs = [];

  for (let i = 0; i < seeds.length; i += 1) {
    const job = newJob({
      projectId: body.projectId ? safeId(String(body.projectId)) : null,
      shotId: body.shotId ?? null,
      backendId: 'h3-image',
      prompt: req0.prompt,
      params: {
        kind: 'image',
        imageSizeId: req0.sizeId,
        width: req0.width || undefined,
        height: req0.height || undefined,
        seed: seeds[i],
        count: 1,
        /** 图像专用参考图（绝对路径，已解析；第 1 张 = 编辑目标） */
        imageRefs: refResolved.ok.map((r) => r.abs),
        refRels: refResolved.ok.map((r) => r.rel),
        imageLoras: solvedLoras.accepted.map((a) => ({ name: a.name, strength: a.appliedStrength })),
        ...(batchId ? { batchId, batchIndex: i + 1, batchSize: seeds.length } : {}),
      },
      mode: refResolved.ok.length ? 'edit' : 't2i',
    });
    job.kind = 'image';
    if (warnings.length) job.warnings = [...warnings];
    await jobsStore().upsert(job);
    jobs.push(job);

    fireAndLog(
      runAndArchive(job, async (running, hooks) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt: req0.prompt,
        shot: { imageSizeId: req0.sizeId },
        cfg,
        onSubmitted: hooks?.onSubmitted,
        onProgress: (p) => writeProgress(running.id, p),
      }), ctx),
      ctx,
      `image job ${job.id}`,
    );
  }

  return { jobs, batchId, seeds };
}
