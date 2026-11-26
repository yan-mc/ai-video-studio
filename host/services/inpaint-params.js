/**
 * 局部重绘的常量与纯数学 —— 不碰文件系统与网络，可单独单测。
 * 消费者：`inpaint-graph.js`（组图）与 `inpaint-run.js`（执行 + meta）。
 *
 * 三条硬约束（违反会静默出错）：
 *  ① denoise 固定 1.0、步数固定 6 —— BasicScheduler 在 denoise<1 时取
 *     total_steps=int(6/denoise)，而 H3-Image 只有 6 个 PDD 头 / 7 点 sigma 网格，
 *     偏离后只剩部分头工作（"区域被抹平"，不是"改得更少"）。强弱用 splitAt。
 *  ② mask 必须与源图同尺寸（否则 reshape_mask 先拉伸再缩，区域偏移且不报错）。
 *  ③ 喂给 VAE 的画布必须 32 对齐（16 倍下采样 × patch(1,2,2)）。
 *
 * @module services/inpaint-params
 */

/** 重绘 denoise —— 固定 1.0（见文件头 ①） */
export const INPAINT_DENOISE = 1.0;

/** 强度档位 = SplitSigmas 切点；7 点扫描线 [1.0…0.0]，切点 k 取 sigmas[k:] */
export const INPAINT_STRENGTHS = Object.freeze([
  { id: 'full', splitAt: 0, label: '完全重绘', hint: '按提示词重新生成整个选区（6 步全跑）' },
  { id: 'strong', splitAt: 1, label: '强', hint: '大幅改动，保留大致构图（5 步）' },
  { id: 'medium', splitAt: 2, label: '中', hint: '中等改动（4 步）' },
  { id: 'light', splitAt: 3, label: '轻微', hint: '只做小幅调整（3 步）' },
]);

/** 按 id 取强度档；找不到回落 medium */
export function inpaintStrength(id) {
  const key = String(id ?? '');
  return INPAINT_STRENGTHS.find((s) => s.id === key) ?? INPAINT_STRENGTHS[2];
}

/**
 * GrowMask 膨胀量。**latent 网格常数，不随分辨率缩放**：输入已是裁剪块分辨率，
 * 1 latent 格恒为 16px。按 res/1024 缩放会让 448² 档只剩 7px（不足一格），
 * 膨胀失效、接缝漏白。需要缩放的只有 blur。
 */
export const INPAINT_GROW = 16;

/** ImageBlur 基准参数（1024² 基准）。31/10.0 同时是节点硬上限。 */
export const INPAINT_BLUR_BASE = Object.freeze({ radius: 31, sigma: 10.0 });

/** 羽化参数的调参基准分辨率 */
export const INPAINT_BLUR_REF_RES = 1024;

/** ImageBlur 的合法区间（超出会被节点校验拒绝） */
export const IMAGE_BLUR_LIMITS = Object.freeze({ radius: 31, sigma: 10.0 });

/**
 * 按采样分辨率缩放羽化参数，保持相对宽度一致。不缩放时 448² 上羽化带
 * 占画布 6.9%，贴边选区会出现一圈矩形过渡带。
 * @param {number} baseResolution
 * @returns {{radius:number, sigma:number}}
 */
export function blurForResolution(baseResolution) {
  const res = Number.isFinite(baseResolution) && baseResolution > 0
    ? baseResolution
    : INPAINT_BLUR_REF_RES;
  const k = res / INPAINT_BLUR_REF_RES;
  const radius = Math.max(1, Math.min(
    IMAGE_BLUR_LIMITS.radius, Math.round(INPAINT_BLUR_BASE.radius * k),
  ));
  const sigma = Math.max(0.1, Math.min(
    IMAGE_BLUR_LIMITS.sigma, Number((INPAINT_BLUR_BASE.sigma * k).toFixed(1)),
  ));
  return { radius, sigma };
}

/** crop 模式的默认参数 */
export const INPAINT_CROP_DEFAULTS = Object.freeze({
  baseResolution: 1024, padding: 64, minCrop: 256, maxCrop: 1024,
});

/**
 * 分辨率档位。auto 的语义是"不低于原始像素且不超面积上限"：裁剪块整块缩放到
 * base_res，缩放比 = base_res / bbox 长边，<1 就丢细节且不可逆。
 * 按笔画总面积算是错的 —— 实测 S 形笔画 bbox 1024×469 按面积得 544²，
 * 笔画被缩到 0.53×，边缘过渡差 2 倍、选区外溢差 10 倍。
 */
export const INPAINT_RESOLUTION_PRESETS = Object.freeze([
  {
    id: 'auto',
    label: '自动（按选区尺寸）',
    hint: '按选区外接框长边 × 1.5 给分辨率，保证笔画不被缩小；小选区自动放大以获得更多细节。',
    value: null,
  },
  { id: '512', label: '512（快，细节少）', hint: '适合大范围粗改', value: 512 },
  { id: '768', label: '768', hint: '通用折中', value: 768 },
  { id: '1024', label: '1024（默认，细节好）', hint: '适合中等选区', value: 1024 },
  { id: '1280', label: '1280（慢，细节最好）', hint: '适合小而精细的选区', value: 1280 },
]);

/** auto 档的目标放大倍数（保证缩放比 ≥ 1） */
export const INPAINT_AUTO_SCALE = 1.5;

/** 面积上限（crop 出来的块同样受此约束） */
export const INPAINT_MAX_MP = 4.3;

/** padding 上限：它直接进 ComfyUI 的 INT(max=16384)，不夹会让 bbox 撑到远超画布 */
export const MAX_CROP_PADDING = 4096;

/** vendor 节点名（供探测与排错） */
export const VENDOR_NODES = Object.freeze({
  crop: 'JZImageCropByMaskAndResize',
  uncrop: 'JZImageUncropByMask',
});

/** 采样画布对齐基数（latent 16 倍下采样 × patch 的 2 倍） */
export const CANVAS_ALIGN = 32;

/**
 * auto 档的 base_resolution：bbox 长边 × scale → 面积夹 → [min,max] 夹 → 对齐 32。
 * 夹取顺序不能改：先夹 max 再夹面积会得偏小的值。
 * @param {{w:number, h:number}} bbox
 * @param {{min?:number, max?:number, scale?:number, maxMP?:number}} [opts]
 * @returns {number}
 */
export function autoCropResolution(bbox, opts = {}) {
  const min = Number.isFinite(opts.min) ? opts.min : INPAINT_CROP_DEFAULTS.minCrop;
  const max = Number.isFinite(opts.max) ? opts.max : INPAINT_CROP_DEFAULTS.maxCrop;
  const scale = Number.isFinite(opts.scale) ? opts.scale : INPAINT_AUTO_SCALE;
  const maxMP = Number.isFinite(opts.maxMP) ? opts.maxMP : INPAINT_MAX_MP;

  const bw = Math.max(1, Number(bbox?.w) || 1024);
  const bh = Math.max(1, Number(bbox?.h) || 1024);
  let res = Math.max(bw, bh) * Math.max(1.0, scale);
  res = Math.min(res, Math.sqrt(maxMP * 1e6));
  res = Math.max(min, Math.min(max, res));
  return Math.max(256, Math.round(res / CANVAS_ALIGN) * CANVAS_ALIGN);
}

/**
 * 由笔画像素数估算 bbox（Agent 拿不到真实 bbox 的兜底）。填充率取 0.35 中位数
 * （实测 0.149~1.0），并假设近正方形 —— 长边偏小 → 分辨率偏小，偏保守不会糊细节。
 * @param {number} strokePixels
 * @param {{w?:number,h?:number}} [maskDims]
 * @returns {{w:number, h:number}}
 */
export function estimateBboxFromStroke(strokePixels, maskDims = {}) {
  const n = Math.max(1, Math.floor(Number(strokePixels) || 0));
  const fullW = Math.max(1, Number(maskDims.w) || 1024);
  const fullH = Math.max(1, Number(maskDims.h) || 1024);
  const side = Math.sqrt(n / 0.35);
  return {
    w: Math.min(fullW, Math.max(64, Math.round(side))),
    h: Math.min(fullH, Math.max(64, Math.round(side))),
  };
}

/**
 * 估算 vendor 节点真正会裁出的块尺寸（含 padding 与 min_crop 下限），
 * 与 `_bbox_from_mask` 逐行对应。只用于 meta/warning 的如实回报。
 * @param {{w:number,h:number}} bbox
 * @param {{minCrop?:number, padding?:number, maskDims?:{w:number,h:number}|null}} opts
 * @returns {{w:number,h:number}}
 */
export function estimateCropBlock(bbox, opts = {}) {
  const minCrop = Number.isFinite(opts.minCrop) ? opts.minCrop : INPAINT_CROP_DEFAULTS.minCrop;
  const padding = Number.isFinite(opts.padding) ? opts.padding : INPAINT_CROP_DEFAULTS.padding;
  const cw = Math.max(1, Number(opts.maskDims?.w) || Number(bbox?.w) || 1024);
  const ch = Math.max(1, Number(opts.maskDims?.h) || Number(bbox?.h) || 1024);

  let w = Math.min(cw, Math.max(1, Number(bbox?.w) || 1));
  let h = Math.min(ch, Math.max(1, Number(bbox?.h) || 1));
  if (minCrop) {
    w = Math.max(w, Math.min(cw, minCrop));
    h = Math.max(h, Math.min(ch, minCrop));
  }
  const padX = Math.min(Math.max(0, Math.floor((cw - w) / 2)), Math.round(padding));
  const padY = Math.min(Math.max(0, Math.floor((ch - h) / 2)), Math.round(padding));
  w = Math.min(w + 2 * padX, cw);
  h = Math.min(h + 2 * padY, ch);
  return { w: Math.round(w), h: Math.round(h) };
}

/**
 * 采样长边 = base_resolution 被 max_crop_resolution 封顶后对 32 对齐。
 * 只决定"整块缩放到多大"，**不决定覆盖范围**：块更大时整块等比缩小，
 * 绝不裁掉一部分涂区（超出部分会永不重绘且不报错）。
 * @param {number} baseResolution
 * @param {number} maxCrop
 * @returns {number}
 */
export function cropSampleEdge(baseResolution, maxCrop) {
  const base = Number.isFinite(baseResolution) && baseResolution > 0
    ? baseResolution
    : INPAINT_CROP_DEFAULTS.baseResolution;
  const cap = Number.isFinite(maxCrop) && maxCrop > 0 ? maxCrop : INPAINT_CROP_DEFAULTS.maxCrop;
  const edge = Math.max(CANVAS_ALIGN, Math.min(base, cap));
  return Math.round(edge / CANVAS_ALIGN) * CANVAS_ALIGN;
}

/**
 * 由采样长边与块宽高比推算实际采样画布（向上对齐 32），与 vendor `crop()` 的
 * tw/th 算法逐行对应。
 * @param {{w:number,h:number}} block
 * @param {number} sampleEdge
 * @returns {{w:number,h:number}}
 */
export function sampleCanvasFor(block, sampleEdge) {
  const w = Math.max(1, Number(block?.w) || 1);
  const h = Math.max(1, Number(block?.h) || 1);
  const edge = Number.isFinite(sampleEdge) && sampleEdge > 0 ? sampleEdge : 1024;
  const aspect = w / h;
  const align = (v) => Math.max(CANVAS_ALIGN, Math.ceil(v / CANVAS_ALIGN) * CANVAS_ALIGN);
  if (aspect >= 1) return { w: align(edge), h: align(edge / aspect) };
  return { w: align(edge * aspect), h: align(edge) };
}