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

/* ============================================================ 分级重绘 */

/**
 * 分级重绘 = **mask 的灰度值就是那一块的去噪强度**（模型原生能力，已实测）。
 *
 * 源码依据 `comfy/ldm/minimax/model.py:757-765`：
 *   `rows_t = (1.0 - m * sigma_v).clamp(max=t_pin_v)`
 * `m` 是 mask 值，**按浮点原样**参与逐行 timestep 计算，不做二值化；
 * `mask_row_values()` 还会做 2×2 最大池化，所以最小可控粒度约 32×32 像素。
 *
 * ⚠️ 与 `INPAINT_STRENGTHS` **不是同一件事**，不要混用：
 *   · `strength`（SplitSigmas 切点）改的是**全局** sigma 网格，砍步数；
 *   · `gradedLevel`（mask 灰度）改的是**逐区域**强度，步数不变。
 *   两个机制会叠加衰减，所以分级模式下建议 strength 保持 full。
 *
 * ⚠️ 档位值**必须按实测校准，不能按线性直觉**：1024² / full / 同一提示词实测
 *   mask 1.00 → 改动量 121.4 / 232
 *   mask 0.50 → 改动量   3.1 /  89   ← 只有 1.0 的 2.5%（塌陷区）
 *   mask 0.20 → 改动量   0.6 /  34
 * 原因是 6 步 PDD 蒸馏下 `1 - m*sigma` 落在哪个预测头区间决定实际效果，
 * 0.5 正好落在头与头的交界处。**可用区间是 0.55–1.0**，低于 0.5 基本不可见。
 */
export const INPAINT_GRADED_LEVELS = Object.freeze([
  {
    id: 'full',
    mask: 1.0,
    label: '完全重绘',
    hint: '整块按提示词重新生成（= 普通重绘满强度），改动最明显',
  },
  {
    id: 'strong',
    mask: 0.85,
    label: '强',
    hint: '大改，保留大致构图与色调（实测约 1.0 的一半效果）',
  },
  {
    id: 'medium',
    mask: 0.7,
    label: '中',
    hint: '中等改动：换材质/换色/加装饰性细节',
  },
  {
    id: 'light',
    mask: 0.55,
    label: '轻',
    hint: '小幅修饰（可用区间下沿，再低就进入塌陷区）',
  },
  {
    id: 'keep',
    mask: 0,
    label: '保留',
    hint: '这一块完全不动（= 从选区里擦掉）',
  },
]);

/** 分级档默认值（= 满强度，等价于"没分级"的普通重绘） */
export const INPAINT_GRADED_DEFAULT = 'full';

/**
 * 塌陷区上沿：mask 值低于它以后改动量**断崖式下降**（不是线性变弱）。
 * 前端据此画警示色带，后端据此写 warning。
 */
export const INPAINT_GRADED_COLLAPSE = 0.5;

/** 分级 mask 的最小可控粒度（像素，2×2 latent patch） */
export const INPAINT_GRADED_MIN_GRANULARITY_PX = 32;

/** 贴回用二值 mask 的阈值：低于它的像素视为"没选"，不参与贴回 */
export const INPAINT_GRADED_STITCH_THRESHOLD = 0.02;

/**
 * 按 id（或数值）取分级档；找不到回落默认档。
 *
 * 数值入参按**最近档**吸附：用户在滑块上给 0.62 时落到「中 0.7」而不是报错，
 * 但调用方要能从返回的 `id` 看出实际生效的是哪一档。
 *
 * 非法 id 一律回落 `INPAINT_GRADED_DEFAULT`（= 1.0，与"没分级"等价）并标
 * `snapped: true`：
 *   回落 0 会让拼错一个字母（`gradedLevel: 'strng'`）变成"整块不重绘"，
 *   用户看到的是"点了重绘但没反应"；回落 1.0 只是"改得比预期多"，
 *   而且 warning 里写清了实际档位，一眼能看出来。
 *
 * @param {string|number|null|undefined} id
 * @returns {{id:string, mask:number, label:string, hint:string, snapped:boolean}}
 */
export function gradedLevel(id) {
  const fallback = INPAINT_GRADED_LEVELS.find((l) => l.id === INPAINT_GRADED_DEFAULT)
    ?? INPAINT_GRADED_LEVELS[0];

  if (typeof id === 'number' && Number.isFinite(id)) return snapGradedValue(id);
  const key = String(id ?? '').trim().toLowerCase();
  if (!key) return { ...fallback, snapped: false };

  const byId = INPAINT_GRADED_LEVELS.find((l) => l.id === key);
  if (byId) return { ...byId, snapped: false };

  // 纯数字字符串也当数值（前端 select 的 value 一律是 string）
  if (/^-?\d+(\.\d+)?$/.test(key)) return snapGradedValue(Number(key));
  return { ...fallback, snapped: true };
}

/**
 * 数值 → 最近档。
 * @param {number} value
 * @returns {{id:string, mask:number, label:string, hint:string, snapped:boolean}}
 */
export function snapGradedValue(value) {
  const v = Math.max(0, Math.min(1, Number(value)));
  let best = INPAINT_GRADED_LEVELS[0];
  let bestD = Infinity;
  for (const l of INPAINT_GRADED_LEVELS) {
    const d = Math.abs(l.mask - v);
    if (d < bestD) { bestD = d; best = l; }
  }
  return { ...best, snapped: Math.abs(best.mask - v) > 1e-6 };
}

/**
 * 某一档的 8-bit mask 像素值（前端画笔与后端校验用同一个换算）。
 * @param {number} maskValue 0..1
 * @returns {number} 0..255
 */
export function gradedMaskByte(maskValue) {
  return Math.max(0, Math.min(255, Math.round(Number(maskValue) * 255)));
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

/**
 * 笔画平均宽度（采样画布上的像素）。用于给羽化带上限。
 *
 * 羽化是**像素空间固定半径**，它不区分"一米宽的大色块"和"两像素的发丝"。
 * 对细笔画，半径 28 的高斯会把整条线糊成一片半透明渐变 —— 实测一条
 * 613×213、14869 px 的笔画，羽化后膨胀到 131051 px、平均强度只剩 0.37。
 * 模型的 noise mask 因此几乎是"半透明"的，重绘效果趋近于零
 * （实测选区内外差值只有 2/255）。
 *
 * @param {{strokePixels:number, bbox:{w:number,h:number}}|null} info
 * @param {{w:number,h:number}|null} canvas 采样画布尺寸
 * @returns {number|null} 平均宽度（像素），信息不足返回 null
 */
export function estimateStrokeWidth(info, canvas) {
  const px = Number(info?.strokePixels) || 0;
  if (px <= 0) return null;
  const bw = Number(info?.bbox?.w) || 0;
  const bh = Number(info?.bbox?.h) || 0;
  if (bw <= 0 || bh <= 0) return null;

  // 笔画在裁剪块里的平均线宽 ≈ 面积 / (bbox 半周长估算的骨架长度)
  // 用 bbox 对角线近似骨架长度，对 L 形 / 折线足够稳；方块选区会得到
  // 接近短边的值（合理：方块没有"细线"问题，羽化本就该大一些）。
  const skeleton = Math.max(1, Math.hypot(bw, bh));
  const widthInCrop = px / skeleton;

  // 换算到采样画布坐标（裁剪块被整块缩放到 canvas 长边）
  const cw = Number(canvas?.w) || bw;
  const ch = Number(canvas?.h) || bh;
  const scale = Math.min(cw / bw, ch / bh);
  return Math.max(1, widthInCrop * scale);
}

/**
 * 计算**最终生效**的羽化参数：在 `blurForResolution` 的基础上，
 * 再按笔画宽度封顶，保证羽化带不超过笔画宽度的一半。
 *
 * 为什么是"一半"：GrowMask 已经把选区外扩 16px，羽化只负责最后一道软过渡。
 * 若羽化半径 ≥ 笔画宽度，线条中心也到不了满强度，等于把整个选区降成半透明。
 * 取一半能保留清晰的芯 + 一圈软化边。
 *
 * 实测（613×213 折线笔画，14869 px，采样画布 928×352）：
 *   radius=28 → noise mask 峰值 0.937、平均 0.372、核心(>0.9)仅 544 px
 *   radius=17 → 峰值 0.996、平均 0.492、核心(>0.9) 20257 px
 * 核心像素多 37 倍，出图才真正"改得动"。
 *
 * @param {number} baseResolution 采样分辨率
 * @param {{strokePixels:number, bbox:{w:number,h:number}}|null} [info]
 * @param {{w:number,h:number}|null} [canvas]
 * @returns {{radius:number, sigma:number, capBy:number|null, strokeWidth:number|null}}
 */
export function featherFor(baseResolution, info = null, canvas = null) {
  const base = blurForResolution(baseResolution);
  const width = estimateStrokeWidth(info, canvas);
  if (width == null) return { ...base, capBy: null, strokeWidth: null };

  const cap = Math.max(1, Math.round(width / 2));
  if (base.radius <= cap) return { ...base, capBy: null, strokeWidth: width };

  const radius = cap;
  // sigma 与 radius 保持基准比例，且不超节点上限
  const sigma = Math.max(0.1, Math.min(
    IMAGE_BLUR_LIMITS.sigma,
    Number((INPAINT_BLUR_BASE.sigma * (radius / INPAINT_BLUR_BASE.radius)).toFixed(1)),
  ));
  return { radius, sigma, capBy: 'strokeWidth', strokeWidth: width };
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