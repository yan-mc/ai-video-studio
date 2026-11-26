/**
 * 只读图片文件头取像素尺寸 —— 不依赖图像库、不解码整图。
 *
 * 局部重绘有两条**必须在提交前拦住**的约束：
 *  ① mask 尺寸必须与源图一致。`reshape_mask` 会 bilinear 缩到 latent 尺寸，
 *     两者不同时它先拉伸到源图尺寸再缩 —— 重绘区域整体偏移且不报错。
 *  ② full 模式的源图宽高必须 32 的倍数。`vae_encode_crop_pixels` 会把
 *     非对齐输入**居中裁掉**（1000→992），而 mask 仍是 1000，`reshape_mask`
 *     把 1000 映射到 62 格 → 区域偏移最多 15px、产物比源图小，全程无 warning。
 *     crop 模式不受影响（裁剪块会被整块缩放到 32 对齐的采样画布）。
 *
 * 支持 PNG / JPEG / WebP / GIF / BMP；解析不出来返回 `null`
 * （调用方据此跳过校验，但应当告警，见 resolveInpaintSizes）。
 *
 * @module services/image-dims
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

/** 采样画布对齐基数（latent 16 倍下采样 × patch(1,2,2) 的 2 倍） */
export const CANVAS_ALIGN = 32;

/**
 * 把尺寸规整成"喂给 VAE 是安全的"尺寸：各边向下取到 32 的倍数。
 *
 * 向下而不是向上：向上需要真加 pad 节点/改像素，实现里没有；向下截正是
 * `vae_encode_crop_pixels` 本来就会做的事，这里只是把结果算出来让调用方
 * 有据可查，而不是静默发生。
 *
 * @param {{w:number,h:number}|null} dims
 * @returns {{aligned:boolean, req:{w:number,h:number}, safe:{w:number,h:number},
 *            trim:{left:number,top:number,right:number,bottom:number}}|null}
 */
export function normalizeCanvasSize(dims) {
  const w = Math.floor(Number(dims?.w) || 0);
  const h = Math.floor(Number(dims?.h) || 0);
  if (!(w > 0) || !(h > 0)) return null;

  const safeW = Math.max(CANVAS_ALIGN, Math.floor(w / CANVAS_ALIGN) * CANVAS_ALIGN);
  const safeH = Math.max(CANVAS_ALIGN, Math.floor(h / CANVAS_ALIGN) * CANVAS_ALIGN);
  // vae_encode_crop_pixels 是居中截：(dim % ratio) // 2
  const dw = w - safeW;
  const dh = h - safeH;

  return {
    aligned: safeW === w && safeH === h,
    req: { w, h },
    safe: { w: safeW, h: safeH },
    trim: {
      left: Math.floor(dw / 2), top: Math.floor(dh / 2),
      right: Math.ceil(dw / 2), bottom: Math.ceil(dh / 2),
    },
  };
}

/** full 模式源图未对齐的说明文案（拒绝用，含可执行的下一步） */
export function canvasAlignMessage(info) {
  const { req, safe, trim } = info;
  return `源图 ${req.w}×${req.h} 不是 ${CANVAS_ALIGN} 的倍数。`
    + `full 模式（全图混合）会由 VAE 把画布居中裁成 ${safe.w}×${safe.h}`
    + `（左右各裁 ${trim.left}/${trim.right}、上下各裁 ${trim.top}/${trim.bottom} 像素），`
    + '产物尺寸与你给的图不一致，mask 也会随之偏移几像素。'
    + `请改用 crop 模式（裁剪块会被缩放到 ${CANVAS_ALIGN} 对齐的采样画布，不受源图尺寸限制），`
    + `或先把源图缩/裁到 ${safe.w}×${safe.h} 再重试。`
    + '确实要按现状跑，请显式传 fullCanvasTrim: true。';
}

/**
 * 一次性读源图与 mask 的尺寸，并给出**是否一致**的判定。
 *
 * @param {string} sourceAbs
 * @param {string} maskAbs
 * @returns {Promise<{
 *   src: {w:number,h:number}|null,
 *   mask: {w:number,h:number}|null,
 *   mismatch: boolean,
 *   unverifiable: boolean,
 * }>}
 */
export async function resolveInpaintSizes(sourceAbs, maskAbs) {
  const [src, mask] = await Promise.all([
    probeImageDims(sourceAbs),
    probeImageDims(maskAbs),
  ]);

  /**
   * `unverifiable` = 至少一方读不出尺寸。
   *
   * 这时**不能静默放过** —— 但要区分两种情况：
   *   · 格式不支持（AVIF/HEIC 等）→ 让用户知道校验没做
   *   · 文件本身坏了 → 下游会报，这里不必抢跑
   * 所以只标记，由调用方决定是告警还是放行。
   */
  const unverifiable = !src || !mask;
  const mismatch = Boolean(src && mask && (src.w !== mask.w || src.h !== mask.h));

  return { src, mask, mismatch, unverifiable };
}

/** 读单个文件的尺寸；失败返回 null */
export async function probeImageDims(absPath) {
  try {
    const fd = await fs.promises.open(absPath, 'r');
    try {
      // 前 64KB 足够覆盖 PNG/JPEG/WebP/GIF/BMP 的头部与 SOF 段
      const buf = Buffer.alloc(65536);
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
      const b = buf.subarray(0, bytesRead);

      // PNG: 89 50 4E 47 | IHDR 宽高在 offset 16..24
      if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
        return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
      }
      // GIF: 'GIF8' 宽高小端在 6..10
      if (b.length >= 10 && b.toString('ascii', 0, 4) === 'GIF8') {
        return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
      }
      // BMP: 'BM' 宽高在 18..26（有符号）
      if (b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d) {
        return { w: Math.abs(b.readInt32LE(18)), h: Math.abs(b.readInt32LE(22)) };
      }
      // WebP: 'RIFF'....'WEBP'
      if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
        const fourcc = b.toString('ascii', 12, 16);
        if (fourcc === 'VP8 ') {
          return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
        }
        if (fourcc === 'VP8L') {
          const bits = b.readUInt32LE(21);
          return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (fourcc === 'VP8X') {
          return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
        }
      }
      // JPEG: 扫 SOF0/1/2 段
      if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
        let i = 2;
        while (i + 9 < b.length) {
          if (b[i] !== 0xff) { i += 1; continue; }
          const marker = b[i + 1];
          if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
          const segLen = b.readUInt16BE(i + 2);
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
          }
          i += 2 + segLen;
        }
      }
      return null;
    } finally {
      await fd.close();
    }
  } catch {
    return null;
  }
}

/** 把尺寸不符的说明文案统一到这里，避免两处措辞漂移 */
export function maskMismatchMessage(src, mask) {
  return `mask ${mask.w}×${mask.h} 与源图 ${src.w}×${src.h} 不一致。`
    + '尺寸不同会让重绘区域整体偏移（ComfyUI 会静默拉伸 mask，不报错）。';
}

/* ============================================================================
 * 从 mask 文件里**真正量出**笔画外接框
 * ============================================================================
 *
 * 为什么必须真解一次像素：`resolveStrokePixels` 在调用方没给 bbox 时只能用
 * "mask 面积 × 0.35"估算，而那个估算与真实选区无关 —— 任何 1024² mask 都
 * 得到同一个 774×774。后果直接反映在画质上：
 *
 *   真实 bbox 33×33（涂一个小点）→ 估算 774×774 → auto 给 1024² 画布
 *   → 那一小块只占 33/774 ≈ 4% 的采样像素 → 模型几乎没有预算去画它
 *   → 出图表现为"几乎没变"。
 *
 * 实测：同一张 mask、同一个提示词，用估算 bbox 出图几乎不可见；
 * 传入真实 bbox 后选区被放大到足够像素，细节清晰。
 *
 * 实现只用 Node 内置 zlib 解 PNG，不引入图像库（插件不依赖 sharp/canvas）。
 * 非 PNG 或解不出来返回 null，调用方继续走估算兜底。
 */

/**
 * 逐行扫描 PNG 的 8-bit 亮度（**内部共用实现**，不做任何判定）。
 *
 * 只支持 8-bit 灰度 / RGB / RGBA / 灰度+alpha 的非隔行 PNG —— 这正是
 * MaskEditor 导出的格式（黑底白区 RGBA）。其它格式返回 null。
 *
 * 为什么回调逐行而不是整体返回：2048² 的 RGBA 解出来是 16 MB，
 * 而两个消费者（bbox / 强度分布）都只需要**行内亮度**，没必要再留一份。
 *
 * @param {string} absPath
 * @param {(y:number, lum:Uint8Array, width:number) => void} onRow
 * @returns {Promise<{w:number,h:number}|null>}
 */
async function scanPngLuma(absPath, onRow) {
  let buf;
  try {
    buf = await fs.promises.readFile(absPath);
  } catch {
    return null;
  }

  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || PNG_SIG.some((b, i) => buf[i] !== b)) return null;

  // ---- 解析 IHDR
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8 || interlace !== 0) return null;

  /** colorType → 每像素通道数 */
  const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = CHANNELS[colorType];
  if (!channels) return null;

  // ---- 收集 IDAT
  const idat = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const dataStart = off + 8;
    if (type === 'IDAT') idat.push(buf.subarray(dataStart, dataStart + len));
    if (type === 'IEND') break;
    off = dataStart + len + 4;
  }
  if (!idat.length) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  // ---- 反过滤（PNG 的 5 种行过滤器）
  const bpp = channels;                 // bitDepth=8 → 每像素字节数 = 通道数
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) return null;

  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const lum = new Uint8Array(width);
  let p = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]; p += 1;
    raw.copy(cur, 0, p, p + stride); p += stride;

    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? cur[i - bpp] : 0;   // 左
      const b = prev[i];                       // 上
      const c = i >= bpp ? prev[i - bpp] : 0;  // 左上
      let v = cur[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 0xff;
    }

    // 亮度取最大值通道；MaskEditor 导出的是 R=G=B 的黑白图
    for (let x = 0; x < width; x += 1) {
      const o = x * bpp;
      lum[x] = channels >= 3 ? Math.max(cur[o], cur[o + 1], cur[o + 2]) : cur[o];
    }
    onRow(y, lum, width);

    cur.copy(prev);
  }

  return { w: width, h: height };
}

/**
 * 读 PNG 的像素数据并求非零区域的外接框。
 *
 * 阈值固定 127（与前端 canvas 的 alpha>127 判定同源）：bbox 只服务
 * 「auto 分辨率要按哪块算」，半透明边缘不该把 bbox 撑大。
 *
 * @param {string} absPath
 * @returns {Promise<{w:number,h:number,strokePixels:number}|null>}
 */
export async function probeMaskBbox(absPath) {
  let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
  let strokePixels = 0;

  const dims = await scanPngLuma(absPath, (y, lum, width) => {
    for (let x = 0; x < width; x += 1) {
      if (lum[x] > 127) {
        strokePixels += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  });
  if (!dims) return null;
  if (strokePixels === 0) return null;

  return {
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    strokePixels,
  };
}

/**
 * 量出 mask 的**强度分布** —— 判断用户给的是不是一张分级（灰度）mask。
 *
 * 为什么要真量而不是问前端：分级 mask 是**外部**送进来的文件（Agent、
 * 手写脚本、别的工具导出的 PNG），前端的强度状态管不到它们。
 * 后端只能靠像素自己判断，否则用户传了灰度 mask 却走二值链路，
 * 出图会是"该轻的地方没轻、该重的地方没重"，且不报错。
 *
 * 判据（`graded`）：存在**既非全黑也非满白**的选区像素，且这类像素
 * 占选区像素的比例超过 `minGradedFraction`。1% 的容忍度用来吸收
 * 抗锯齿边缘（普通铅笔刷在软边硬度下也会产生一点点灰边）。
 *
 * @param {string} absPath
 * @param {{minGradedFraction?:number}} [opts]
 * @returns {Promise<{
 *   w:number, h:number, sampledPixels:number,
 *   selectedPixels:number, meanInSelection:number,
 *   minInSelection:number, maxInSelection:number,
 *   midPixels:number, gradedFraction:number, graded:boolean,
 *   histogram:number[],
 * }|null>}
 *
 * `histogram` 是按 0.1 分 10 档的像素计数（下标 0..9），供 warning 文案
 * 与排障时看清"灰度到底分布在哪一段"。
 */
export async function probeMaskIntensity(absPath, opts = {}) {
  const minGradedFraction = Number.isFinite(opts.minGradedFraction)
    ? opts.minGradedFraction
    : 0.01;

  const histogram = new Array(10).fill(0);
  let selectedPixels = 0;
  let midPixels = 0;
  let sum = 0;
  let min = 255;
  let max = 0;
  let sampledPixels = 0;

  const dims = await scanPngLuma(absPath, (y, lum, width) => {
    for (let x = 0; x < width; x += 1) {
      const v = lum[x];
      sampledPixels += 1;
      if (v <= 0) continue;
      selectedPixels += 1;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
      // 「中间值」= 既不接近 0 也不接近 255
      if (v > 20 && v < 235) midPixels += 1;
      histogram[Math.min(9, Math.floor((v / 256) * 10))] += 1;
    }
  });
  if (!dims) return null;

  const gradedFraction = selectedPixels > 0 ? midPixels / selectedPixels : 0;
  return {
    w: dims.w,
    h: dims.h,
    sampledPixels,
    selectedPixels,
    meanInSelection: selectedPixels > 0 ? Number((sum / selectedPixels).toFixed(2)) : 0,
    minInSelection: selectedPixels > 0 ? min : 0,
    maxInSelection: selectedPixels > 0 ? max : 0,
    midPixels,
    gradedFraction: Number(gradedFraction.toFixed(4)),
    graded: selectedPixels > 0 && gradedFraction > minGradedFraction,
    histogram,
  };
}
