/**
 * 局部重绘的**任务编排** —— REST 与 Agent 工具共用这一份。
 *
 * `prepareInpaint()` 是唯一入口：校验 → 解析路径 → 尺寸核对 → 32 对齐守卫
 * → 定分辨率 → 建 job。两个调用方只保留自己特有的部分：
 * REST 走 `runAndArchive`（产物进素材库），Agent 走 `runJob`（产物留 outputs）。
 *
 * 必须共用的理由：这些规则每加一条都要在两个入口同时生效。分开写的结果是
 * mask 同尺寸校验只加在 REST 上、Agent 入口裸奔 —— 而 Agent 最容易传错。
 *
 * @module services/inpaint-task
 */
import { loadConfig } from '../config.js';
import { newJob } from './job-store.js';
import { resolveImageEditRefs } from './ref-images.js';
import {
  resolveInpaintSizes, maskMismatchMessage, normalizeCanvasSize, probeMaskBbox,
  probeMaskIntensity,
} from './image-dims.js';
import {
  INPAINT_DENOISE, validateInpaintRequest, resolveCropResolution, resolveStrokePixels,
  guardFullCanvas,
} from './h3-inpaint.js';
import { effectiveMaxMP } from './h3-image.js';
import * as comfy from './comfy-client.js';
import { safeId } from '../security.js';

/** 抛一个带 code 的错误（调用方按 code 映射状态码 / 工具错误） */
function fail(code, message, detail) {
  const e = new Error(`${code}: ${message}`);
  e.code = code;
  if (detail) e.detail = detail;
  return e;
}

/**
 * Lora 文件列表（探测失败返回 null = 不校验，避免误杀）。
 *
 * 求解器只在拿到**非空**列表时才校验"文件是否真的在 loras 目录里"，
 * 拿不到列表时传空数组会退化成跳过校验（不会误杀，也不会误放行拼错的名字）。
 */
async function availableLoraFiles(cfg) {
  try {
    const mf = await comfy.listModelFiles(cfg);
    return mf?.ok && Array.isArray(mf.loras) && mf.loras.length ? mf.loras : null;
  } catch { return null; }
}

/**
 * 从一份原始请求体准备一次局部重绘任务。
 *
 * 不提交、不执行 —— 只做"校验 + 解析 + 建 job"。执行由调用方接 `runH3Inpaint()`。
 *
 * @param {object} body 原始请求体（REST 的 JSON body / 工具参数的映射结果）
 * @param {object} [cfg]
 * @param {{projectId?:string|null, probeLoras?:boolean}} [opts]
 *   `projectId` 已由调用方校验过的 id（Agent 工具会先查项目是否存在，
 *   REST 只做 id 形状校验 —— 两者都必须在**进入这里之前**完成各自的语义）。
 * @returns {Promise<{
 *   job: object, req: object, sourceAbs: string, maskAbs: string,
 *   sourceRel: string, maskRel: string, cropResolution: number|null,
 * }>}
 * @throws 带 code 的错误（PROMPT_REQUIRED / MASK_SIZE_MISMATCH / SOURCE_NOT_ALIGNED …）
 */
export async function prepareInpaint(body = {}, cfg = loadConfig(), opts = {}) {
  // ---- 1) 入参校验（规则在 h3-inpaint.js，唯一实现）
  //
  // LoRA 的求解也在这一步：分类默认强度、单选替换、衰减、总强度看门狗。
  // 不在这里做的话组装期只能静默兜底 1.0，同一条画风 LoRA 在普通出图是 0.8、
  // 在重绘是 1.0，而前端徽章显示的还是用户填的原值。
  const loraFiles = opts.probeLoras === false ? null : await availableLoraFiles(cfg);
  const req = validateInpaintRequest(body, cfg,
    loraFiles ? { availableLoraFiles: loraFiles } : {});

  // ---- 2) 源图 / mask 解析为绝对路径（路径解析的唯一实现在 ref-images.js）
  const srcRes = resolveImageEditRefs([req.sourceRel], cfg, { max: 1 });
  const maskRes = resolveImageEditRefs([req.maskRel], cfg, { max: 1 });
  if (!srcRes.ok.length) {
    throw fail('SOURCE_NOT_FOUND', `源图解析不到：${req.sourceRel}`);
  }
  if (!maskRes.ok.length) {
    throw fail('MASK_NOT_FOUND', `mask 解析不到：${req.maskRel}`);
  }
  const sourceAbs = srcRes.ok[0].abs;
  const maskAbs = maskRes.ok[0].abs;

  // ---- 3) mask 与源图必须同尺寸（不符时 ComfyUI 静默拉伸 → 区域整体偏移）
  const dims = await resolveInpaintSizes(sourceAbs, maskAbs).catch(() => null);
  if (dims?.mismatch) {
    throw fail('MASK_SIZE_MISMATCH', maskMismatchMessage(dims.src, dims.mask), {
      sourceSize: dims.src, maskSize: dims.mask,
    });
  }
  if (dims?.unverifiable) {
    req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
    req.warnings.push(
      '源图或 mask 的尺寸无法读取（格式不支持？），已跳过「mask 与源图同尺寸」校验。'
      + '若重绘区域偏移，请把图转成 PNG 后重试。',
    );
  }
  // full 模式的羽化参数按源图尺寸缩放
  if (dims?.src) req.sourceDims = dims.src;

  // ---- 4) full 模式：源图必须 32 对齐（否则 VAE 居中裁边 → 产物尺寸不符 + 区域偏移）
  const canvas = guardFullCanvas(req, dims?.src ?? null);

  // ---- 5) crop 模式的最终分辨率（auto 档按 bbox 长边算）
  //
  // ⚠️ bbox 的优先级：调用方显式给 > 从 mask 文件真实量出 > 按面积估算。
  //
  // "真实量出"这一步不能省。没有它时，任何 1024² mask 都估成同一个 774×774，
  // 于是涂一个小点时 auto 仍给 1024² 画布，选区只占 4% 采样像素，
  // 出图表现为"几乎没变"。Agent 与外部调用都不传 bbox，只能靠这一步。
  const stroke = resolveStrokePixels(body, dims?.mask ?? null);
  let bboxW = stroke.bboxW;
  let bboxH = stroke.bboxH;
  let bboxSource = stroke.bboxW != null ? 'caller' : null;

  /**
   * ---- 5.5) 分级 mask 自动识别
   *
   * 只认**像素**，不认前端状态：分级 mask 可能是 Agent 传的、脚本画的、
   * 别的工具导出的，前端那套强度 UI 管不到它们。
   *
   * 判据来自 `probeMaskIntensity`（选区里"既非全黑也非满白"的像素占比）。
   * 命中时**只写 warning 不阻断** —— 用户可能确实想用灰度 mask 走二值链路
   * （例如手绘时就想要硬边），拦下来等于替用户做决定。
   *
   * 注意这一步与 bbox 量取**共用同一次 PNG 解码**的语义：两次读盘略浪费，
   * 但两者判据不同（bbox 只看 >127，强度看分布），强行合并不值得。
   * 量不出来（非 PNG / 坏了）就静默跳过，不影响后续。
   */
  let maskIntensity = null;
  {
    const wantGraded = req.graded === true;
    const measured = await probeMaskIntensity(maskAbs).catch(() => null);
    if (measured) {
      maskIntensity = measured;
      if (measured.graded && !wantGraded) {
        req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
        req.warnings.push(
          `检测到分级 mask：选区里有 ${(measured.gradedFraction * 100).toFixed(0)}% 的像素是中间灰度`
          + `（均值 ${measured.meanInSelection}/255）。建议开启分级模式，`
          + '否则这些灰度会被当成"选了/没选"两个值处理，强度信息被丢掉。',
        );
      } else if (!measured.graded && wantGraded) {
        req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
        req.warnings.push(
          '已开启分级模式，但 mask 里几乎没有中间灰度（值域接近纯 0/255）：'
          + '这次所有选区都会按满强度重绘。想要分级效果，请用画笔的"强度"滑块涂出不同灰度。',
        );
      }
    }
  }

  if (bboxW == null) {
    const measured = await probeMaskBbox(maskAbs).catch(() => null);
    if (measured) {
      bboxW = measured.w;
      bboxH = measured.h;
      bboxSource = 'mask';
      // 真实像素数比估算准，顺带覆盖掉兜底值
      stroke.strokePixels = measured.strokePixels;
    } else {
      bboxSource = 'estimated';
      req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
      req.warnings.push(
        '无法从 mask 文件直接量出选区外接框（仅支持 8-bit 非隔行 PNG），'
        + '已按面积估算。若涂的是小选区，auto 分辨率会偏大、细节被稀释 —— '
        + '建议改用 PNG mask，或显式传 bboxW/bboxH。',
      );
    }
  }

  resolveCropResolution(req, {
    bboxW,
    bboxH,
    strokePixels: stroke.strokePixels,
    maskDims: dims?.mask ?? null,
  }, cfg);
  req.crop.bboxSource = bboxSource;

  // ---- 6) 面积上限（auto 档解析后仍可能超限）
  if (req.mode === 'crop') {
    const mp = (req.crop.baseResolution * req.crop.baseResolution) / 1e6;
    const capMP = effectiveMaxMP(cfg);
    if (mp > capMP + 1e-6) {
      throw fail('IMAGE_TOO_LARGE',
        `crop 分辨率 ${req.crop.baseResolution}² ≈ ${mp.toFixed(2)}MP，超过上限 ${capMP}MP`,
        { mp, maxMP: capMP });
    }
  }

  // ---- 7) 建 job
  const projectId = 'projectId' in opts
    ? (opts.projectId ? safeId(String(opts.projectId)) : null)
    : (body.projectId ? safeId(String(body.projectId)) : null);

  const job = newJob({
    projectId,
    shotId: null,
    backendId: 'h3-image',
    prompt: req.prompt,
    params: {
      kind: 'image',
      inpaint: true,
      inpaintMode: req.mode,
      inpaintStrength: req.strengthId,
      splitAt: req.strength.splitAt,
      denoise: INPAINT_DENOISE,
      /**
       * 分级字段必须落进 job.params —— 事后排障时"这次到底走没走分级链路"
       * 只能从这里查（`job.params.graded`）。只存在 req 里的话，
       * 任务跑完就没了，而 meta 与历史记录都读 job。
       */
      graded: req.graded === true,
      ...(req.graded ? { gradedLevel: req.gradedLevel, gradedByte: req.gradedByte } : {}),
      seed: req.seed,
      sourceRel: srcRes.ok[0].rel,
      maskRel: maskRes.ok[0].rel,
      ...(maskIntensity
        ? {
          maskIntensity: {
            graded: maskIntensity.graded,
            gradedFraction: maskIntensity.gradedFraction,
            meanInSelection: maskIntensity.meanInSelection,
            minInSelection: maskIntensity.minInSelection,
            maxInSelection: maskIntensity.maxInSelection,
            histogram: maskIntensity.histogram,
          },
        }
        : {}),
      imageLoras: req.loras,
      ...(req.mode === 'crop'
        ? { crop: req.crop, cropResolution: req.crop.baseResolution }
        : { canvas: canvas.safe ?? normalizeCanvasSize(dims?.src)?.safe ?? null }),
    },
    mode: 'inpaint',
  });
  job.kind = 'image';
  if (Array.isArray(req.warnings) && req.warnings.length) {
    job.warnings = [...(job.warnings ?? []), ...req.warnings];
  }

  return {
    job,
    req,
    sourceAbs,
    maskAbs,
    sourceRel: srcRes.ok[0].rel,
    maskRel: maskRes.ok[0].rel,
    cropResolution: req.mode === 'crop' ? req.crop.baseResolution : null,
  };
}

/**
 * 提交响应的统一投影 —— REST 回给前端、工具回给 Agent 的字段必须一致。
 *
 * 两处各写一份的后果：一边加了 `warnings` 另一边没加，Agent 就永远看不到
 * "整块被缩小"这类必须让用户知道的告警。
 *
 * @param {object} prepared
 * @param {{forAgent?:boolean}} [opts]
 */
export function inpaintSubmitSummary(prepared, opts = {}) {
  const { job, req, sourceRel, maskRel, cropResolution } = prepared;
  const warnings = Array.isArray(req.warnings) && req.warnings.length ? req.warnings : null;

  const base = {
    jobId: job.id,
    mode: 'inpaint',
    inpaintMode: req.mode,
    strength: req.strengthId,
    denoise: INPAINT_DENOISE,
    sourceRel,
    maskRel,
    promptChars: req.promptChars,
    cropResolution,
    cropResolvedByAuto: Boolean(req.crop?.resolvedByAuto),
    /**
     * 分级状态必须回给调用方：前端据此显示"这次是按分级跑的"，
     * Agent 据此确认自己的 `graded` 有没有被识别（传错类型时会被静默当成 false）。
     */
    graded: req.graded === true,
    ...(req.graded ? { gradedLevel: req.gradedLevel, gradedByte: req.gradedByte } : {}),
    ...(maskIntensity ? { maskLooksGraded: maskIntensity.graded } : {}),
    /**
     * auto 档算出来的实际采样画布：块被整块缩小时的唯一可信依据。
     * 不回这个，前端/Agent 只能拿 baseResolution 猜，而两者不是一回事。
     */
    ...(req.mode === 'crop'
      ? {
        cropSampleEdge: req.crop?.sampleEdge ?? null,
        cropSampleCanvas: req.crop?.sampleCanvas ?? null,
        cropBlockDownscaled: Boolean(req.crop?.blockDownscaled),
        ...(req.crop?.blockDownscaleRatio != null
          ? { cropBlockDownscaleRatio: req.crop.blockDownscaleRatio }
          : {}),
      }
      : {}),
    ...(warnings ? { warnings } : {}),
  };

  if (opts.forAgent) return { ok: true, ...base, note: '用 studio_jobs 查进度' };

  // REST：回完整 job 让前端能立刻进"轮询"分支，同时带上 jobIds 便于批量端点
  return { ...job, ...base, jobIds: [job.id] };
}
