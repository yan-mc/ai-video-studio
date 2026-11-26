/**
 * H3-Image 局部重绘（Inpainting）—— **入参校验 + 兼容导出**。
 *
 * 实现拆成三个文件（改一处不必滚过一千行）：`inpaint-params.js`（常量 + 纯数学）、
 * `inpaint-graph.js`（组图）、`inpaint-run.js`（执行 + meta）。本文件保留全部
 * 历史导出名，`import { ... } from './h3-inpaint.js'` 无需改动。
 *
 * 三条硬约束的论证在 `inpaint-params.js` 文件头：
 *  ① denoise 固定 1.0、步数固定 6；② mask 与源图同尺寸；③ 画布 32 对齐。
 *
 * @module services/h3-inpaint
 */
import { loadConfig } from '../config.js';
import {
  IMAGE_PROMPT_MAX_CHARS, IMAGE_MAX_LORAS, effectiveMaxMP,
} from './h3-image.js';
import { solveImageLoraStack } from './h3-image-lora.js';
import { normalizeImagePrompt } from './h3-image.js';
import { normalizeCanvasSize, canvasAlignMessage } from './image-dims.js';
import {
  INPAINT_DENOISE, INPAINT_STRENGTHS, INPAINT_GROW, INPAINT_BLUR_BASE,
  INPAINT_BLUR_REF_RES, IMAGE_BLUR_LIMITS, INPAINT_CROP_DEFAULTS,
  INPAINT_RESOLUTION_PRESETS, INPAINT_AUTO_SCALE, INPAINT_MAX_MP, MAX_CROP_PADDING,
  VENDOR_NODES, inpaintStrength, blurForResolution, autoCropResolution,
  estimateBboxFromStroke, estimateCropBlock, cropSampleEdge, sampleCanvasFor,
} from './inpaint-params.js';

/* ---------------- 兼容导出（历史调用点不需要改 import） ---------------- */
export {
  INPAINT_DENOISE, INPAINT_STRENGTHS, INPAINT_GROW, INPAINT_BLUR_BASE,
  INPAINT_BLUR_REF_RES, IMAGE_BLUR_LIMITS, INPAINT_CROP_DEFAULTS,
  INPAINT_RESOLUTION_PRESETS, INPAINT_AUTO_SCALE, INPAINT_MAX_MP, MAX_CROP_PADDING,
  VENDOR_NODES, inpaintStrength, blurForResolution, autoCropResolution,
  estimateBboxFromStroke, estimateCropBlock, cropSampleEdge, sampleCanvasFor,
};
export { buildInpaintWorkflow } from './inpaint-graph.js';
export { runH3Inpaint, inpaintMeta, probeInpaintNodes, resetInpaintProbeCache } from './inpaint-run.js';

/* ============================================================ 入参校验 */

/** 32 对齐（向上取整到不小于 256 的倍数） */
function align32(v, def) {
  const n = Number(v);
  const base = Number.isFinite(n) && n > 0 ? n : def;
  return Math.max(256, Math.round(base / 32) * 32);
}

/**
 * 校验一次局部重绘请求。
 *
 * LoRA 在这一步就过 `solveImageLoraStack`（与普通出图同一套分类默认强度 /
 * 单选互斥 / 衰减 / 总强度看门狗），结果写回 `loras[].strength` 并把
 * replaced/degraded/rejected 全部并入 warnings —— 组装期不再静默夹取。
 *
 * @param {object} body
 * @param {object} [cfg]
 * @param {{availableLoraFiles?:string[]}} [opts] 传了才校验"文件是否真的在 loras 目录里"
 * @returns {object} 归一化后的请求
 * @throws 带 code 的 Error
 */
export function validateInpaintRequest(body = {}, cfg = loadConfig(), opts = {}) {
  const fail = (code, msg, detail) => {
    const e = new Error(`${code}: ${msg}`);
    e.code = code;
    if (detail) e.detail = detail;
    throw e;
  };

  // ---- prompt
  const rawPrompt = String(body.prompt ?? '');
  if (!rawPrompt.trim()) fail('PROMPT_REQUIRED', '局部重绘也要写提示词（描述你想在那个区域生成什么）');
  const prompt = normalizeImagePrompt(rawPrompt, { maxChars: IMAGE_PROMPT_MAX_CHARS });
  if (prompt.length > IMAGE_PROMPT_MAX_CHARS) {
    fail('PROMPT_TOO_LONG',
      `提示词 ${prompt.length} 字符，超过上限 ${IMAGE_PROMPT_MAX_CHARS}`,
      { chars: prompt.length, maxChars: IMAGE_PROMPT_MAX_CHARS });
  }

  // ---- 源图与 mask（必须都存在）
  const sourceRel = String(body.source ?? body.sourceImage ?? '').trim();
  const maskRel = String(body.mask ?? body.maskImage ?? '').trim();
  if (!sourceRel) fail('SOURCE_REQUIRED', '缺少源图（source）');
  if (!maskRel) fail('MASK_REQUIRED', '缺少 mask 图');

  // ---- 模式
  const mode = String(body.mode ?? 'crop');
  if (mode !== 'full' && mode !== 'crop') {
    fail('INPAINT_BAD_MODE', `mode 只能是 full 或 crop，实际 "${mode}"`);
  }

  // ---- 强度：必须取**规范化后**的 id，否则 job 记录与真实 splitAt 不一致
  const strength = inpaintStrength(body.strength);
  const strengthId = strength.id;

  // ---- seed
  let seed = Number(body.seed);
  if (!Number.isFinite(seed) || seed < 0) seed = Math.floor(Math.random() * 2147483647);
  seed = Math.floor(seed) % 2147483648;

  const warnings = [];

  // ---- loras：过求解器（分类默认强度 / 单选替换 / 衰减 / 总强度看门狗）
  const rawLoras = Array.isArray(body.loras)
    ? body.loras
      .map((x) => (typeof x === 'string' ? { name: x } : x))
      .filter((x) => x && typeof x.name === 'string' && x.name.trim())
      .map((x) => {
        const s = Number(x.strength);
        // 不给强度就保留 undefined：让求解器填分类默认值（画风 0.8 / 角色 0.85），
        // 而不是在这里变成 NaN 再落到兜底 1.0 —— 那会让同一条 LoRA 在两条链路上强度不同。
        return Number.isFinite(s)
          ? { name: x.name.trim(), strength: s }
          : { name: x.name.trim() };
      })
    : [];

  if (rawLoras.length > IMAGE_MAX_LORAS) {
    warnings.push(`最多只能挂 ${IMAGE_MAX_LORAS} 条 LoRA，已忽略末尾 ${rawLoras.length - IMAGE_MAX_LORAS} 条。`);
  }
  const requested = rawLoras.slice(0, IMAGE_MAX_LORAS);

  let loras = [];
  if (requested.length) {
    const solved = solveImageLoraStack(requested, {
      maxSlots: IMAGE_MAX_LORAS,
      ...(Array.isArray(opts.availableLoraFiles) ? { availableFiles: opts.availableLoraFiles } : {}),
      // 局部重绘没有"参考图"通道：源图就是被编辑的原图，不是身份参考
      hasRefImages: false,
    });
    loras = solved.accepted.map((a) => ({ name: a.name, strength: a.appliedStrength }));
    for (const rp of solved.replaced) {
      warnings.push(`「${rp.category}」是单选类：「${rp.name}」被「${rp.by}」替换（同类只能挂 1 个）。`);
    }
    for (const rj of solved.rejected) {
      warnings.push(`LoRA「${rj.name}」未被使用：${rj.reason}`);
    }
    for (const dg of solved.degraded) {
      warnings.push(`LoRA「${dg.name}」强度 ${dg.from} → ${dg.to}（${dg.reason}）。`);
    }
    warnings.push(...solved.warnings);
  }

  // ---- crop 参数
  const c = body.crop ?? {};

  /**
   * padding 必须 `Number.isFinite` 校验：`Math.max(0, Math.round(NaN))` 仍是 NaN，
   * 序列化成 JSON 变 null，提交给 ComfyUI 的 `INT padding` 会报一条与输入无关的类型错。
   */
  const padNum = Number(c.padding ?? INPAINT_CROP_DEFAULTS.padding);
  const padding = Number.isFinite(padNum)
    ? Math.max(0, Math.min(MAX_CROP_PADDING, Math.round(padNum)))
    : INPAINT_CROP_DEFAULTS.padding;

  /**
   * 分辨率档位判定：只传 `baseResolution` 不传 `resolutionId` 时**必须当成手动档**。
   * 否则调用方明确给的分辨率会被静默当成 auto 走估算，两者结果可能不同且看不出区别。
   */
  const hasExplicitRes = c.baseResolution != null;
  const rawId = c.resolutionId == null ? null : String(c.resolutionId);
  const resolutionId = rawId ?? (hasExplicitRes ? 'manual' : 'auto');
  const isAuto = resolutionId === 'auto';

  if (isAuto && hasExplicitRes) {
    fail('INPAINT_BAD_CROP',
      `crop.resolutionId='auto' 与 crop.baseResolution=${c.baseResolution} 不能同时给：`
      + 'auto 表示"由选区尺寸决定"，给了具体值就是手动档（省略 resolutionId 即可）。');
  }

  const crop = {
    resolutionId,
    baseResolution: isAuto ? null : align32(c.baseResolution, INPAINT_CROP_DEFAULTS.baseResolution),
    padding,
    minCrop: align32(c.minCrop, INPAINT_CROP_DEFAULTS.minCrop),
    maxCrop: align32(c.maxCrop, INPAINT_CROP_DEFAULTS.maxCrop),
  };
  if (crop.minCrop > crop.maxCrop) {
    fail('INPAINT_BAD_CROP', `minCrop(${crop.minCrop}) 不能大于 maxCrop(${crop.maxCrop})`);
  }
  // 档位 id 是数字（512/768/1024/1280）时当作手动分辨率
  if (!isAuto && c.baseResolution == null) {
    const byId = Number(resolutionId);
    crop.baseResolution = Number.isFinite(byId) && byId > 0
      ? align32(byId, INPAINT_CROP_DEFAULTS.baseResolution)
      : INPAINT_CROP_DEFAULTS.baseResolution;
  }

  // 显式给的分辨率要现在就检查面积上限；auto 档等 bbox 算出来后再检查
  if (crop.baseResolution != null) {
    const mp = (crop.baseResolution * crop.baseResolution) / 1e6;
    const capMP = effectiveMaxMP(cfg);
    if (mp > capMP + 1e-6) {
      fail('IMAGE_TOO_LARGE',
        `crop 分辨率 ${crop.baseResolution}² ≈ ${mp.toFixed(2)}MP，超过上限 ${capMP}MP`,
        { mp, maxMP: capMP });
    }
  }

  return {
    prompt,
    promptChars: prompt.length,
    sourceRel,
    sourceAbs: '',   // 由调用方解析（需要 cfg.dataDir）
    maskRel,
    maskAbs: '',
    mode,
    strength,
    strengthId,
    seed,
    loras,
    crop,
    /** 入参阶段的警告，调用方挂到 job.warnings */
    warnings,
    /** 源图尺寸（由调用方读到后回填；full 模式羽化与 32 校验都要它） */
    sourceDims: null,
    /** full 模式下显式放行"源图非 32 倍数" */
    fullCanvasTrim: body.fullCanvasTrim === true,
  };
}

/**
 * full 模式的源图画布守卫。
 *
 * `vae_encode_crop_pixels` 会把非 32 倍数的画布**居中裁掉几像素**，产物尺寸与源图
 * 不符、mask 与 latent 的相对位置也随之偏移，且全程无 warning。
 * crop 模式不受影响（裁剪块会整块缩放到 32 对齐的采样画布），所以只守 full。
 *
 * 策略：默认**拒绝**并给出可执行的下一步；显式传 `fullCanvasTrim: true` 才放行，
 * 但仍把"会被裁成多大、裁掉几像素"写进 warnings —— 不静默。
 *
 * @param {object} req  validateInpaintRequest 的结果（就地修改 warnings）
 * @param {{w:number,h:number}|null} srcDims
 * @returns {{aligned:boolean, safe:{w:number,h:number}|null, trim:object|null}}
 */
export function guardFullCanvas(req, srcDims) {
  const info = normalizeCanvasSize(srcDims);
  if (!info || info.aligned) return { aligned: true, safe: info?.safe ?? null, trim: null };
  if (req.mode !== 'full') return { aligned: false, safe: info.safe, trim: info.trim };

  const e = new Error(`SOURCE_NOT_ALIGNED: ${canvasAlignMessage(info)}`);
  e.code = 'SOURCE_NOT_ALIGNED';
  e.detail = {
    sourceSize: info.req,
    safeSize: info.safe,
    trim: info.trim,
    align: 32,
    allowedBy: 'fullCanvasTrim: true',
  };
  if (!req.fullCanvasTrim) throw e;

  req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
  req.warnings.push(
    `已按 fullCanvasTrim 放行：源图 ${info.req.w}×${info.req.h} 不是 32 的倍数，`
    + `VAE 会把画布居中裁成 ${info.safe.w}×${info.safe.h}`
    + `（左右各裁 ${info.trim.left}/${info.trim.right}、上下各裁 ${info.trim.top}/${info.trim.bottom} 像素），`
    + '产物尺寸会比源图小，重绘区域也可能偏移几像素。想要逐像素对齐请先裁好源图。',
  );
  req.canvasTrim = info;
  return { aligned: false, safe: info.safe, trim: info.trim };
}

/* ============================================================ 分辨率与笔画 */

/**
 * 定下 crop 模式的最终 baseResolution，并给出**如实**的覆盖/缩放警告。
 *
 * auto 档按**选区 bbox 长边**算（按笔画总面积算是错的，会让细笔画被缩小、
 * 边缘糊掉）；显式档位直接用。必须在知道 bbox **之后**做 ——
 * bbox 优先取调用方传的，否则由笔画面积估算。
 *
 * 两种情况都要算采样画布与"整块被缩小"的警告：手动选 512 却涂了 2000px
 * 和 auto 档夹到 maxCrop 是同一个后果，用户同样需要知道。
 *
 * 语义要点：base_res 只是**采样分辨率**，裁剪块会被整块缩放到它，
 * **不会**被裁掉一部分；所以警告说的是"整块被缩小、细节损失"。
 *
 * @param {object} req  validateInpaintRequest 的结果（就地修改 crop）
 * @param {{bboxW?:number, bboxH?:number, strokePixels?:number, maskDims?:object}} info
 * @param {object} [cfg]
 * @returns {object} 同一个 req
 */
export function resolveCropResolution(req, info = {}, cfg = loadConfig()) {
  if (req.mode !== 'crop') return req;

  const capMP = effectiveMaxMP(cfg);
  const hasBbox = Number.isFinite(info.bboxW) && Number.isFinite(info.bboxH)
    && info.bboxW > 0 && info.bboxH > 0;
  const bbox = hasBbox
    ? { w: info.bboxW, h: info.bboxH }
    : estimateBboxFromStroke(info.strokePixels, info.maskDims);

  if (req.crop.baseResolution == null) {
    const res = autoCropResolution(bbox, {
      min: req.crop.minCrop,
      max: req.crop.maxCrop,
      maxMP: capMP,
    });

    // 极端情况下 auto 也会超上限（例如 maxCrop 被设得很大）
    const mp = (res * res) / 1e6;
    if (mp > capMP + 1e-6) {
      const capped = Math.floor(Math.sqrt(capMP * 1e6) / 32) * 32;
      req.crop.baseResolution = Math.max(256, capped);
      req.crop.cappedByMP = true;
    } else {
      req.crop.baseResolution = res;
    }
    req.crop.resolvedByAuto = true;
  }

  req.crop.bbox = bbox;
  req.crop.bboxEstimated = !hasBbox;
  if (Number.isFinite(info.strokePixels)) req.crop.strokePixels = info.strokePixels;

  // 采样画布长边 = base_res 被 maxCrop 封顶（与 vendor 节点 `crop()` 一致）
  const sampleEdge = cropSampleEdge(req.crop.baseResolution, req.crop.maxCrop);
  const block = estimateCropBlock(bbox, {
    minCrop: req.crop.minCrop,
    padding: req.crop.padding,
    maskDims: info.maskDims,
  });
  const sampleCanvas = sampleCanvasFor(block, sampleEdge);
  req.crop.sampleEdge = sampleEdge;
  req.crop.sampleBlock = block;
  req.crop.sampleCanvas = sampleCanvas;

  /**
   * 块被整块等比缩小：这是 maxCrop / 面积上限的必然结果，必须如实告知。
   * 措辞必须是"整块被缩小"—— 说"笔画会被缩小到 51%"会让人以为
   * 整条笔画都被重绘了只是糊一点，而实际上覆盖范围是完整的，只有细节损失。
   */
  const blockLong = Math.max(block.w, block.h);
  const canvasLong = Math.max(sampleCanvas.w, sampleCanvas.h);
  if (blockLong > canvasLong) {
    const ratio = canvasLong / blockLong;
    req.crop.blockDownscaled = true;
    req.crop.blockDownscaleRatio = Number(ratio.toFixed(3));
    req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
    const estimated = hasBbox ? '' : '，bbox 由笔画面积估算';
    req.warnings.push(
      `选区外接框 ${bbox.w}×${bbox.h}（含 padding 后为 ${block.w}×${block.h}${estimated}）`
      + `超过重绘上限 ${canvasLong}px：整块会被等比缩小到 ${(ratio * 100).toFixed(0)}% 再重绘`
      + '（覆盖范围是完整的，涂过的地方都会被重绘；但细节会损失）。'
      + '想要更好画质请缩小选区（分多次涂），或调高「选区上限 / maxCrop」与面积上限。',
    );
  }

  return req;
}

/**
 * 归一化笔画像素数与 bbox。
 *
 * auto 分辨率按 bbox **长边**算，不是笔画总面积：按面积算会让 bbox 大而
 * 笔画细的情况被缩小 → 细线糊掉（实测边缘差异 11.43 vs 5.53，外溢 3.82% vs 0.36%）。
 *
 * @param {object} body 原始请求
 * @param {{w:number,h:number}|null} maskDims
 * @returns {{strokePixels:number, bboxW:number|null, bboxH:number|null, estimated:boolean}}
 */
export function resolveStrokePixels(body = {}, maskDims = null) {
  const c = body.crop ?? {};

  const bboxW = Number(body.bboxW ?? c.bboxW);
  const bboxH = Number(body.bboxH ?? c.bboxH);
  const hasBbox = Number.isFinite(bboxW) && Number.isFinite(bboxH) && bboxW > 0 && bboxH > 0;

  const given = Number(body.strokePixels ?? c.strokePixels);
  let strokePixels;
  let estimated = false;
  if (Number.isFinite(given) && given > 0) {
    strokePixels = Math.floor(given);
  } else {
    const w = Number(maskDims?.w) || 1024;
    const h = Number(maskDims?.h) || 1024;
    strokePixels = Math.floor(w * h * 0.2);
    estimated = true;
  }

  return {
    strokePixels,
    bboxW: hasBbox ? Math.round(bboxW) : null,
    bboxH: hasBbox ? Math.round(bboxH) : null,
    estimated: estimated || !hasBbox,
  };
}