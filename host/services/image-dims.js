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
