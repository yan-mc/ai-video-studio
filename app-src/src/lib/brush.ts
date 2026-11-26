/**
 * 画笔绘制核心 —— 移植自 ComfyUI 官方 mask editor。
 *
 * ============================================================================
 * 出处
 * ============================================================================
 *
 * 算法来自 `comfyui_frontend_package` 里的 `packages/mask-editor/src/`：
 *   · `splineUtils.ts`        — Catmull-Rom 样条 + 按间距重采样
 *   · `brushDrawingUtils.ts`  — 径向渐变画笔 + 笔刷纹理缓存
 *   · `color.ts`              — hex/rgb 解析
 *
 * 官方是 Vue + GPU shader；这里改成**纯 Canvas 2D + TypeScript**，
 * 算法保留（尤其 resampleSegment 的 remainder 续接，是连续笔画不断点的关键）。
 *
 * ============================================================================
 * 为什么不能"在 pointermove 里直接画圆"
 * ============================================================================
 *
 * 鼠标/触控的 pointermove 事件频率受限于浏览器帧率（约 60Hz），
 * 快速拖动时相邻两次事件的间距可能是笔刷直径的 3–5 倍 ——
 * 直接在事件点画圆会得到**一串离散的圆点**，而不是一条连续笔画。
 *
 * 正确做法（官方做法）：
 *   1. 用 Catmull-Rom 样条把离散点连成平滑曲线
 *   2. 沿曲线**按固定间距重采样**（spacing ≈ 笔刷尺寸 × 系数）
 *   3. 在每个采样点画一个笔刷印（stamp）
 *   4. `remainder` 把上一次没走完的间距带到下一段，避免段间重复或断点
 *
 * @module lib/brush
 */

/* ============================================================ 类型 */

export interface Point {
  x: number;
  y: number;
}

export type BrushShape = 'arc' | 'rect';

export interface BrushSettings {
  /** 笔刷直径（画布像素） */
  size: number;
  /** 硬度 0..1，1 = 硬边，0 = 完全羽化 */
  hardness: number;
  /** 不透明度 0..1 */
  opacity: number;
  /** 间距档位 0..100（映射成 spacing = size × 系数） */
  stepSize: number;
  shape: BrushShape;
  /**
   * 笔压 / 强度 0..1 —— **只在分级重绘开启时生效**，涂出来的灰度就是 mask 值。
   *
   * 与 `opacity` 的区别不是叫法：`opacity` 是普通涂抹的叠色不透明度（同一处
   * 涂两遍会越来越白），而 `strength` 是**取最大值**合并（同一处涂两遍仍是
   * 那一档，不会越涂越强）—— 后者才是"分级"该有的语义，见 mergeShapeMax。
   */
  strength: number;
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 60,
  hardness: 0.7,
  opacity: 1,
  stepSize: 25,
  shape: 'arc',
  strength: 1,
};

/** 画布矩形（脏区重绘用） */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ============================================================ 颜色 */

export interface Rgb { r: number; g: number; b: number }

/** 解析 `#rgb` / `#rrggbb`；非法返回黑色 */
export function hexToRgb(hex: string): Rgb {
  if (hex.length === 4) {
    return {
      r: parseInt(hex[1] + hex[1], 16),
      g: parseInt(hex[2] + hex[2], 16),
      b: parseInt(hex[3] + hex[3], 16),
    };
  }
  if (hex.length === 7) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/* ============================================================ 样条与重采样 */

/**
 * 中心化 Catmull-Rom 样条（alpha = 0.5）。
 *
 * 为什么用 centripetal（alpha=0.5）而不是 uniform（alpha=0）：
 * uniform 在控制点间距不均时会**打结、自交、过冲**（快速甩笔时明显）。
 * alpha=0.5 是论文推荐值，能避免 cusp 与 loop。
 *
 * @param p0 前一个控制点  @param p1 段起点  @param p2 段终点  @param p3 下一个控制点
 * @param t 0..1
 */
export function catmullRomSpline(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const alpha = 0.5;
  const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const tj = (prev: number, a: Point, b: Point) => prev + Math.pow(dist(a, b), alpha);

  const t0 = 0;
  const t1 = tj(t0, p0, p1);
  const t2 = tj(t1, p1, p2);
  const t3 = tj(t2, p2, p3);
  const ti = t1 + (t2 - t1) * t;

  const lerp = (a: Point, b: Point, ta: number, tb: number): Point => {
    if (Math.abs(tb - ta) < 1e-4) return a;
    const k = (ti - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  // Barry-Goldman 金字塔插值
  const A1 = lerp(p0, p1, t0, t1);
  const A2 = lerp(p1, p2, t1, t2);
  const A3 = lerp(p2, p3, t2, t3);
  const B1 = lerp(A1, A2, t0, t2);
  const B2 = lerp(A2, A3, t1, t3);
  return lerp(B1, B2, t1, t2);
}

/**
 * 沿折线按固定间距重采样，返回采样点与**剩余间距**。
 *
 * `startOffset` 承接上一段的 remainder —— 这是跨段不断点的关键：
 * 若每次都从 0 开始，段与段的接缝处会多画一个点（叠色）或少画（空隙）。
 *
 * @param points 该段的控制点
 * @param spacing 目标间距
 * @param startOffset 距段首多远放第一个点（上一段剩下的）
 */
export function resampleSegment(
  points: Point[],
  spacing: number,
  startOffset: number,
): { points: Point[]; remainder: number } {
  if (points.length === 0) return { points: [], remainder: startOffset };
  const result: Point[] = [];
  let currentDist = 0;
  let nextSampleDist = startOffset;
  const step = Math.max(0.5, spacing);

  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segLen = Math.hypot(dx, dy);

    if (segLen < 1e-4) {
      // 零长度段：只在需要时补点，避免除零
      while (nextSampleDist <= currentDist) {
        result.push({ x: p1.x, y: p1.y });
        nextSampleDist += step;
      }
      continue;
    }

    while (nextSampleDist <= currentDist + segLen) {
      const t = (nextSampleDist - currentDist) / segLen;
      result.push({ x: p1.x + t * dx, y: p1.y + t * dy });
      nextSampleDist += step;
    }
    currentDist += segLen;
  }

  return { points: result, remainder: nextSampleDist - currentDist };
}

/**
 * 把一串原始采样点扩成"沿曲线均匀分布的点"。
 *
 * 这是 `resampleSegment` 的上层封装：给定原始点，自动补上前后控制点形成样条。
 *
 * @param raw 原始点（pointermove 收到的）
 * @param spacing 间距
 * @returns 均匀分布的点
 */
export function interpolateStroke(raw: Point[], spacing: number): Point[] {
  if (raw.length < 2) return raw.slice();
  const out: Point[] = [];
  let remainder = 0;

  for (let i = 0; i < raw.length - 1; i += 1) {
    const p0 = raw[Math.max(0, i - 1)];
    const p1 = raw[i];
    const p2 = raw[i + 1];
    const p3 = raw[Math.min(raw.length - 1, i + 2)];

    // 用样条把这一段细化成若干采样点（每段 8 个足够）
    const STEPS = 8;
    const curved: Point[] = [];
    for (let s = 0; s <= STEPS; s += 1) {
      curved.push(catmullRomSpline(p0, p1, p2, p3, s / STEPS));
    }
    const { points, remainder: rest } = resampleSegment(curved, spacing, remainder);
    out.push(...points);
    remainder = rest;
  }
  return out;
}

/** 间距换算：把 0..100 的档位映射成笔刷尺寸的百分比 */
export function spacingFor(size: number, stepSize: number): number {
  // 与官方一致：Math.pow(100, step/100) / 100
  const pct = Math.pow(100, Math.max(0, Math.min(100, stepSize)) / 100) / 100;
  return Math.max(1, size * pct);
}

/* ============================================================ 笔刷渲染 */

/** 笔刷纹理缓存（同参数复用，避免每次 stamp 都重建 ImageData） */
const brushTextureCache = new Map<string, HTMLCanvasElement>();
const CACHE_LIMIT = 24;

function getBrushTexture(
  radius: number,
  hardness: number,
  color: Rgb,
  opacity: number,
): HTMLCanvasElement {
  const key = `${radius}|${hardness}|${color.r},${color.g},${color.b}|${opacity}`;
  const hit = brushTextureCache.get(key);
  if (hit) return hit;

  const size = Math.max(1, Math.ceil(radius * 2));
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('无法创建画笔纹理 canvas');

  const cx = size / 2;
  const cy = size / 2;
  const hardRadius = radius * hardness;
  const fadeRange = Math.max(1e-6, radius - hardRadius);
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y += 1) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const idx = (y * size + x) * 4;
      const dist = Math.hypot(dx, dy);

      let a = 0;
      if (dist <= hardRadius) a = opacity;
      else if (dist <= radius) {
        // 二次衰减：比线性更接近真实笔刷的软边手感
        const t = (dist - hardRadius) / fadeRange;
        a = opacity * Math.pow(1 - t, 2);
      }

      d[idx] = color.r;
      d[idx + 1] = color.g;
      d[idx + 2] = color.b;
      d[idx + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  if (brushTextureCache.size >= CACHE_LIMIT) {
    const first = brushTextureCache.keys().next().value;
    if (first) brushTextureCache.delete(first);
  }
  brushTextureCache.set(key, cv);
  return cv;
}

/**
 * 在 canvas 上盖一个笔刷印。
 *
 * @param ctx 目标 2D 上下文
 * @param p 位置（canvas 像素坐标）
 * @param brush 笔刷设置
 * @param color 画什么颜色（mask 一般用白）
 * @param erase true = 擦除（destination-out）
 */
export function stampBrush(
  ctx: CanvasRenderingContext2D,
  p: Point,
  brush: BrushSettings,
  color: Rgb,
  erase = false,
): void {
  const radius = Math.max(0.5, brush.size / 2);
  const opacity = Math.max(0, Math.min(1, brush.opacity));
  const hardness = Math.max(0, Math.min(1, brush.hardness));

  ctx.save();
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';

  if (brush.shape === 'rect' && hardness < 1) {
    const tex = getBrushTexture(radius, hardness, color, opacity);
    ctx.drawImage(tex, p.x - radius, p.y - radius);
  } else if (hardness >= 1) {
    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${opacity})`;
    ctx.beginPath();
    if (brush.shape === 'rect') ctx.rect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    else ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${opacity})`);
    g.addColorStop(hardness, `rgba(${color.r},${color.g},${color.b},${opacity})`);
    g.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    if (brush.shape === 'rect') ctx.rect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    else ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 画一整条笔画（内部做样条插值 + 均匀重采样）。
 *
 * @param ctx 目标上下文
 * @param raw 原始点序列（至少 1 个）
 * @param brush 笔刷设置
 * @param color 颜色
 * @param erase 是否擦除
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  raw: Point[],
  brush: BrushSettings,
  color: Rgb,
  erase = false,
): void {
  if (raw.length === 0) return;
  const spacing = spacingFor(brush.size, brush.stepSize);
  const pts = raw.length === 1 ? raw : interpolateStroke(raw, spacing);
  for (const p of pts) stampBrush(ctx, p, brush, color, erase);
}

/* ============================================================ 坐标变换 */

/**
 * 屏幕事件坐标 → canvas 像素坐标。
 *
 * ⚠️ 必须按 `canvas.width / rect.width` 换算，不能直接用 clientX-rect.left：
 *    canvas 的内部像素尺寸（width/height 属性）与 CSS 显示尺寸
 *    （style.width/height）通常不同，直接用会得到偏移的坐标。
 */
export function screenToCanvas(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  return {
    x: (e.clientX - rect.left) * sx,
    y: (e.clientY - rect.top) * sy,
  };
}

/* ============================================================
 * 分级重绘（mask 灰度 = 逐区域去噪强度）
 * ============================================================
 *
 * 数据层约定（**动这里之前先读完**）：
 *
 *   · mask 画布上，一个像素的**灰度 = 该像素的重绘强度**（0=保留，1=满重绘），
 *     统一存在 **alpha 通道**里，RGB 恒为 255。
 *     为什么用 alpha 不直接用 RGB：`destination-out`（橡皮）只动 alpha，
 *     用 RGB 存灰度的话「擦除」这个语义就没了；而 alpha 天然表达
 *     "这个像素被选中多少"。导出时再把 alpha 写回 RGB 即可（见 MaskEditor）。
 *
 *   · 合并规则是**取最大值**，不是叠色：
 *     同一处涂 0.55 再涂 0.85 应该得到 0.85（用户想加大强度），
 *     而不是 0.55 + 0.85 或者越涂越脏。取最大值也让"补涂"可以反复进行，
 *     且不会因为多刷了两下把一档刷成另一档。
 *
 *   · 0 强度 = 不做任何事。视觉上等同擦除（MaskEditor 会把光标与提示切到
 *     "擦除"态），避免用户"涂了没反应"的困惑。
 */

/** 局部矩形裁剪（夹到画布内；空返回 null） */
export function clampRect(r: Rect, w: number, h: number): Rect | null {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(w, Math.ceil(r.x + r.w));
  const y1 = Math.min(h, Math.ceil(r.y + r.h));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 两个矩形的并集（任一方为空则返回另一方） */
export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * 分级笔刷印 —— **取最大值**合并，不是叠色。
 *
 * 为什么不用 `globalCompositeOperation = 'lighten'`：
 * lighten 比的是 **RGB 通道**（源 rgb 恒 255，永远赢），而且它完全忽略 alpha，
 * 结果是"一涂就整块变 255"。这里 alpha 才是数据，只能在 JS 里逐像素比。
 *
 * 为什么按脏区（`dirty`）而不是全画布：1024² 每帧全图 readback 是 4 MB ×
 * 每 pointermove 一次，2048² 直接卡死。脏区 = 这一笔的两个印子外接框。
 *
 * 软边由 `hardness` 决定（与 `stampBrush` 同一套衰减），只是把笔刷的 alpha
 * 剖面**乘以强度**而不是直接写成 opacity。
 *
 * @param ctx     mask 画布上下文
 * @param p       位置（canvas 像素）
 * @param brush   笔刷设置（用 size / hardness / strength）
 * @param canvasW 画布宽（脏区裁剪用）
 * @param canvasH 画布高
 * @returns 本次实际改动的矩形（可能为 null）
 */
export function stampStrength(
  ctx: CanvasRenderingContext2D,
  p: Point,
  brush: BrushSettings,
  canvasW: number,
  canvasH: number,
): Rect | null {
  const value = Math.max(0, Math.min(1, brush.strength));
  // 0 强度 = 什么都不做（UI 上会显示成"擦除"，见 MaskEditor）
  if (value <= 0) return null;

  const radius = Math.max(0.5, brush.size / 2);
  const hardness = Math.max(0, Math.min(1, brush.hardness));
  const hardRadius = radius * hardness;
  const fadeRange = Math.max(1e-6, radius - hardRadius);

  const rect = clampRect(
    { x: p.x - radius - 1, y: p.y - radius - 1, w: radius * 2 + 2, h: radius * 2 + 2 },
    canvasW,
    canvasH,
  );
  if (!rect) return null;

  const img = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
  const d = img.data;
  const cx = p.x - rect.x;
  const cy = p.y - rect.y;

  for (let y = 0; y < rect.h; y += 1) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < rect.w; x += 1) {
      const dx = x + 0.5 - cx;
      const dist = Math.hypot(dx, dy);
      let profile = 0;
      if (dist <= hardRadius) profile = 1;
      else if (dist <= radius) {
        const t = (dist - hardRadius) / fadeRange;
        profile = Math.pow(1 - t, 2);       // 与 stampBrush 的软边同一条曲线
      }
      if (profile <= 0) continue;

      const target = Math.round(value * profile * 255);
      const idx = (y * rect.w + x) * 4;
      if (target > d[idx + 3]) {
        d[idx] = 255;
        d[idx + 1] = 255;
        d[idx + 2] = 255;
        d[idx + 3] = target;
      }
    }
  }
  ctx.putImageData(img, rect.x, rect.y);
  return rect;
}

/**
 * 分级笔画（内部做样条插值 + 均匀重采样，与 `drawStroke` 同一套）。
 *
 * @returns 整条笔画覆盖的脏区
 */
export function drawStrengthStroke(
  ctx: CanvasRenderingContext2D,
  raw: Point[],
  brush: BrushSettings,
  canvasW: number,
  canvasH: number,
): Rect | null {
  if (raw.length === 0) return null;
  const spacing = spacingFor(brush.size, brush.stepSize);
  const pts = raw.length === 1 ? raw : interpolateStroke(raw, spacing);
  let dirty: Rect | null = null;
  for (const p of pts) dirty = unionRect(dirty, stampStrength(ctx, p, brush, canvasW, canvasH));
  return dirty;
}

/**
 * 把整块画布的选区**整体改档**（"一键分级"）。
 *
 * 语义（三个都要，缺一个就不好用）：
 *   · 只动**已有选区**（alpha>0）的像素，未涂区域保持 0 —— 否则一键降档会把
 *     整幅图变成选区；
 *   · `mode='set'`  把选区内所有像素**统一设为**该档（"先框大范围再统一降强度"）；
 *   · `mode='scale'`按比例**乘**（0.55 档对 1.0 的选区 = 乘 0.55），
 *     适合"已有渐变、整体压暗一档"。
 *
 * @returns 是否真的改动了像素（没选区时返回 false，UI 据此提示而不是静默无效）
 */
export function recolorSelection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  value: number,
  mode: 'set' | 'scale' = 'set',
): boolean {
  const v = Math.max(0, Math.min(1, value));
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let touched = false;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;                 // 没选中的像素一律不动
    let next;
    if (mode === 'set') {
      next = Math.round(v * 255);
    } else {
      next = Math.round(a * v);
    }
    if (next !== a) {
      d[i + 3] = Math.max(0, Math.min(255, next));
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      touched = true;
    }
  }
  if (touched) ctx.putImageData(img, 0, 0);
  return touched;
}

/**
 * 强度 0..1 → 覆盖层 RGBA（r,g,b 各 0..255，a 也 0..255）。
 *
 * **唯一实现**：`strengthToOverlayColor`（CSS 字符串）与 `paintOverlay`
 * （逐像素合成）都调它。分成两份的后果是"图例色块"与"画布上真实的红色"
 * 慢慢对不上，而那正是用户判断"我涂的是哪一档"的唯一依据。
 *
 * 视觉语义（与面板图例一致）：
 *   · 1.00 → 深朱红、alpha 0.75（一眼看出"这里会大改"）
 *   · 0.85 → 0.62
 *   · 0.70 → 0.48
 *   · 0.55 → 0.34（可用区间下沿，仍明显可见）
 *   · 0.30 → 0.15 且偏黄 —— **塌陷区用不同色相警示**，
 *            "涂了但很淡"与"涂了但没效果"必须能一眼区分
 *   · 0     → 完全无色
 *
 * 为什么 alpha 在上面那段是**线性**的：可用区间只有 0.55–1.0（见
 * `INPAINT_GRADED_COLLAPSE`），把整段 0..1 线性映射到 0..0.75 会让
 * 0.55 与 1.0 只差 0.4 个 alpha，深色底图上几乎分不出。所以把 0.5–1.0
 * 撑开到 0.30–0.75，塌陷区（<0.5）另用低 alpha + 偏黄色相。
 *
 * @param strength 0..1
 * @returns `[r, g, b, a]`（a 为 0..255）
 */
export function strengthToRgba(strength: number): [number, number, number, number] {
  const s = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0));
  if (s <= 0) return [255, 150, 40, 0];

  let alpha: number;
  let r: number;
  let g: number;
  let b: number;

  if (s >= 0.5) {
    const t = (s - 0.5) / 0.5;                    // 0..1，覆盖"可用区间"
    alpha = 0.30 + 0.45 * t;
    // 橙 (240,140,60) → 深朱红 (206,32,32)
    r = Math.round(240 - 34 * t);
    g = Math.round(140 - 108 * t);
    b = Math.round(60 - 28 * t);
  } else {
    const t = s / 0.5;                            // 0..1，塌陷区
    alpha = 0.30 * Math.pow(t, 1.1);
    // 更黄 (250,200,60) → 橙 (240,140,60)：色相偏移即"警告"
    r = Math.round(250 - 10 * t);
    g = Math.round(200 - 60 * t);
    b = Math.round(60);
  }

  return [r, g, b, Math.round(Math.max(0, Math.min(1, alpha)) * 255)];
}

/**
 * 分级色带：强度 0..1 → 覆盖层 CSS 颜色。
 *
 * @param strength 0..1
 * @returns `rgba(r,g,b,a)` 字符串
 */
export function strengthToOverlayColor(strength: number): string {
  const [r, g, b, a] = strengthToRgba(strength);
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

/**
 * 把 mask 画布按"灰度 = 强度"渲染成覆盖层。
 *
 * 直接在像素层合成而不是用 `destination-in`：后者只能整块乘一个 alpha，
 * 无法让 0.55 与 1.0 显示成不同深浅 —— 那正是分级 UI 的核心诉求。
 *
 * @param src    mask 画布（数据在 alpha 通道）
 * @param dst    覆盖层画布（同尺寸）
 */
export function paintOverlay(src: HTMLCanvasElement, dst: HTMLCanvasElement): void {
  const w = src.width;
  const h = src.height;
  if (dst.width !== w) dst.width = w;
  if (dst.height !== h) dst.height = h;
  const sctx = src.getContext('2d');
  const dctx = dst.getContext('2d');
  if (!sctx || !dctx) return;

  const s = sctx.getImageData(0, 0, w, h);
  const out = dctx.createImageData(w, h);
  const sd = s.data;
  const od = out.data;

  for (let i = 0; i < sd.length; i += 4) {
    const a = sd[i + 3];
    if (a === 0) continue;
    // 与图例共用 strengthToRgba：两处各写一套会让"色块"和"画布上的红"对不上
    const [r, g, b, oa] = strengthToRgba(a / 255);
    od[i] = r;
    od[i + 1] = g;
    od[i + 2] = b;
    od[i + 3] = oa;
  }
  dctx.putImageData(out, 0, 0);
}
