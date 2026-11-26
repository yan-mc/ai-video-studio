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
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 60,
  hardness: 0.7,
  opacity: 1,
  stepSize: 25,
  shape: 'arc',
};

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
