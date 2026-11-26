/**
 * 局部重绘的 mask 画笔编辑器。
 *
 * 三层 canvas 叠放：
 *   ① 底图（源图，只读） ② mask 数据层（白 + 透明底，接收指针事件）
 *   ③ 覆盖层（红色，深浅随强度变化，只读）
 *
 * 为什么拆三层而不是一个 canvas 上直接画：
 * mask 必须是**灰度图**（白=重绘），提交给 ComfyUI 的 `ImageToMask(red)`
 * 要求干净的黑底白区；而用户要看的是红色半透明覆盖 —— 那是视觉层，不是数据层。
 * 把红色直接画进 mask 就不是合法的 mask 了。
 *
 * 数据层约定（**分级重绘的地基，改之前先读**）：
 *   像素的**灰度 = 该像素的重绘强度**，统一存在 canvas 的 **alpha 通道**里，
 *   RGB 恒为 255。选 alpha 是因为 `destination-out`（橡皮）只动 alpha；
 *   导出时再把 alpha 写回 RGB（见 `exportMask`）。
 *   分级关闭时，涂出来永远是 alpha=255 —— 与历史行为**逐像素等价**。
 *
 * 两条硬约束（违反会 400 或静默出错）：
 *   · mask 尺寸**必须与源图完全一致**（ComfyUI 会 bilinear 拉伸，区域会偏移）
 *   · 源图宽高最好是 32 的倍数：full 模式会被 VAE 居中裁边；crop 模式不受影响
 *
 * @module components/MaskEditor
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_BRUSH, drawStroke, drawStrengthStroke, hexToRgb, paintOverlay,
  recolorSelection, screenToCanvas, stampBrush, stampStrength, strengthToOverlayColor,
  type BrushSettings, type Point,
} from '../lib/brush';
import type { InpaintGradedLevel } from '../api/types';
import { Badge, Button, Icon, Panel, Select, Switch, useToast } from '../ui';

/**
 * 分级档位的**前端兜底表**。
 *
 * 正常应当用后端 `meta.gradedLevels`（那是唯一真源，校准值改了就跟着变）。
 * 这里的副本只用于 meta 还没加载完的那一瞬间 —— 没有它，面板会在首帧
 * 闪一排空按钮。**数值必须与 `host/services/inpaint-params.js` 一致**。
 */
const GRADED_FALLBACK: InpaintGradedLevel[] = [
  { id: 'full', mask: 1, label: '完全重绘', hint: '整块按提示词重新生成' },
  { id: 'strong', mask: 0.85, label: '强', hint: '大改，保留大致构图' },
  { id: 'medium', mask: 0.7, label: '中', hint: '中等改动' },
  { id: 'light', mask: 0.55, label: '轻', hint: '小幅修饰' },
  { id: 'keep', mask: 0, label: '保留', hint: '完全不动' },
];

export interface MaskEditorProps {
  /** 源图 URL（显示在底层；同时决定 canvas 像素尺寸） */
  imageUrl: string;
  /** 源图原始尺寸（必须与 canvas 一致，后端会校验） */
  imageWidth: number;
  imageHeight: number;
  /** 当前 mask（dataURL，空串 = 还没涂） */
  value: string;
  /**
   * 涂抹变化时回调（**不是每帧**，而是笔画结束/清空/撤销时）。
   *
   * 参数说明：
   *   dataUrl      mask 的黑底灰度 PNG（灰度 = 强度）
   *   strokePixels 非零像素数（统计信息 + bbox 估算兜底）
   *   bbox         mask 的外接框（**auto 分辨率按它算，最准**）
   *   intensity    强度分布摘要（分级 mask 的判据；普通 mask 的 graded 为 false）
   */
  onChange: (
    dataUrl: string,
    strokePixels: number,
    bbox: { w: number; h: number } | null,
    intensity?: MaskIntensitySummary,
  ) => void;
  /**
   * 是否启用分级重绘。
   *
   * **受控**：开关在面板上（InpaintPanel），因为它要和"提交时传 graded"绑定。
   * 关掉时整个强度概念从 UI 消失，回到纯涂抹体验（灰阶仍保留在 mask 里，
   * 不会因为切换而丢笔画 —— 见 `handleGradedToggle`）。
   */
  graded: boolean;
  onGradedChange: (graded: boolean) => void;
  /** 可用档位（来自后端 meta，缺省用内置兜底表） */
  levels?: InpaintGradedLevel[];
  /** 当前选中的档位 id（受控，提交时要用） */
  level: string;
  onLevelChange: (level: string) => void;
}

/** 强度分布摘要（与后端 `probeMaskIntensity` 的字段同名，便于直接对照） */
export interface MaskIntensitySummary {
  mean: number;
  min: number;
  max: number;
  /** 选区里"中间灰度"（既不接近 0 也不接近 255）的像素占比 0..1 */
  gradedFraction: number;
  /** 选区像素数 */
  selectedPixels: number;
  /** 是否像分级 mask（有中间灰度） */
  graded: boolean;
}

/**
 * 撤销栈的**内存预算**（字节），不是步数。
 *
 * 一帧 `ImageData` = W × H × 4 字节。本项目支持到 2560×1440 / 2400×1600：
 *   1024² ×4×10 步 = 40MB（还行）   2048² ×4×10 = 160MB（吃紧）
 *   2560×1440 ×4×10 = 147MB（吃紧）  4096² ×4×10 = 671MB（直接爆）
 * 固定步数在大图上会把标签页拖死，所以按预算动态决定能存几步
 * （96MB ≈ Chrome 单标签堆上限的 5~10%：1024² 存 24 步、4096² 只存 1 步）。
 *
 * 分级重绘**没有**破坏这套机制：快照是整张 ImageData，alpha 通道（强度）
 * 原样被存进去，`putImageData` 回灌也是整张 —— 强度与形状一起回滚。
 */
const UNDO_BUDGET_BYTES = 96 * 1024 * 1024;

/** 至少保留 1 步（否则大图上撤销完全不可用） */
const UNDO_MIN_STEPS = 1;

/**
 * 笔画结束到导出 mask 的防抖时长。
 *
 * `exportMask` 要全量 `getImageData(W,H)` + 全画布 `toDataURL('image/png')`，
 * 在 2048² 上是两次 ~16MB 的扫描 + PNG 编码（几十到几百毫秒）。
 * 抬笔就同步做会让连续快笔明显卡顿；150ms 足够让一串连续笔画合并成一次导出，
 * 又短到用户不会感到"涂了但没生效"。
 */
const EXPORT_DEBOUNCE_MS = 150;

/** 覆盖层重绘的节流间隔（覆盖层要逐像素合成，比直接 drawImage 贵） */
const OVERLAY_THROTTLE_MS = 60;

export function MaskEditor({
  imageUrl, imageWidth, imageHeight, value, onChange,
  graded, onGradedChange, levels, level, onLevelChange,
}: MaskEditorProps) {
  const toast = useToast();
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [erasing, setErasing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  /** mask 覆盖率（0..1），用于提示"当前选中多少" */
  const [coverage, setCoverage] = useState(0);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  /** 强度分布摘要（分级开关的判据与提示文案都用它） */
  const [intensity, setIntensity] = useState<MaskIntensitySummary | null>(null);

  /** 当前笔画累积的原始点 */
  const strokeRef = useRef<Point[]>([]);
  /** 已画到的最后一个点（用于增量绘制，避免每次重画整条） */
  const lastPointRef = useRef<Point | null>(null);
  /** 回灌短路：记录最近一次"画布内容所对应的 dataURL" */
  const loadedHashRef = useRef<string>('');
  /** 导出防抖定时器 */
  const exportTimerRef = useRef<number | null>(null);
  /** 覆盖层重绘的节流状态 */
  const overlayTimerRef = useRef<number | null>(null);
  const overlayPendingRef = useRef(false);

  const W = imageWidth;
  const H = imageHeight;

  /** 实际可用的档位表（后端 meta 优先） */
  const levelList = useMemo<InpaintGradedLevel[]>(
    () => (Array.isArray(levels) && levels.length ? levels : GRADED_FALLBACK),
    [levels],
  );
  /**
   * 与当前 `level` 匹配的档位。
   *
   * `level` 为空串或是一个数值串时**没有匹配档**（用户把强度滑块拖到了
   * 预设之间）。这时不能让按钮高亮到某一档上 —— 否则会出现
   * "按钮亮着「强」、实际涂的是 0.62"，提交时按档位还是按画笔强度
   * 就变成一条猜不出的分歧。
   */
  const matchedLevel = useMemo(
    () => levelList.find((l) => l.id === level) ?? null,
    [levelList, level],
  );
  /** 离当前画笔强度最近的档（只用于 UI 默认值与提示，不参与提交） */
  const nearestLevel = useMemo(() => {
    let near = levelList[0];
    for (const l of levelList) {
      if (Math.abs(l.mask - brush.strength) < Math.abs(near.mask - brush.strength)) near = l;
    }
    return near;
  }, [levelList, brush.strength]);

  /**
   * 画笔实际使用的强度 0..1。
   *
   * 分级关闭时**恒为 1**（纯白涂抹，与历史行为一致）；
   * 分级开启时取滑块值，`保留` 档（mask 0）时真的取 0。
   */
  const effectiveStrength = graded ? Math.max(0, Math.min(1, brush.strength)) : 1;
  /**
   * 强度 0 + 分级开启 → **画笔自动变成橡皮**。
   *
   * 为什么不"什么都不做"：那正是用户最困惑的状态（涂了没反应，分不清是
   * 自己没涂上、还是软件坏了）。让它真的擦，落笔有可见反馈，
   * 且"强度 0 = 保留 = 从选区里擦掉"这个语义本来就是自洽的。
   * 光标同时切成 `cell` 提示这是擦除动作（见下面的 canvas style）。
   */
  const zeroStrength = graded && effectiveStrength <= 0;
  const effectiveErase = erasing || zeroStrength;

  /* -------------------------------------------------- 初始化底图 */
  useEffect(() => {
    const cv = baseRef.current;
    if (!cv || !W || !H) return;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H);
    };
    img.src = imageUrl;
  }, [imageUrl, W, H]);

  /* -------------------------------------------------- 回灌外部 value → mask canvas */
  /**
   * 把外部的 mask（dataURL）回灌到 mask 画布。
   *
   * 为什么用 alpha 通道存强度、回灌要把亮度搬进 alpha：
   * `exportMask()` 导出的是**不透明**的黑底灰度 PNG（给 ComfyUI 的
   * `ImageToMask(red)` 用，红通道 = 强度），而 mask 画布本身必须是
   * "白 + 透明底"（alpha = 强度）。直接 `drawImage` 回灌会让 alpha 全变 255
   * → 覆盖层判断 alpha>0 → 红层盖满整幅图 → 覆盖率恒 100% → bbox 变成整幅图
   * → auto 分辨率被顶到 maxCrop，小选区"自动放大"设计失效。
   *
   * 短路：内容哈希相同就跳过（父组件 setState 会用它再触发一次这个 effect，
   * 2048² 上每笔等于多两轮全图扫描）。
   */
  useEffect(() => {
    const cv = maskRef.current;
    if (!cv || !W || !H) return;
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    if (!value) {
      loadedHashRef.current = '';
      ctx.clearRect(0, 0, W, H);
      refreshOverlay(true);
      setCoverage(0);
      setIntensity(null);
      return;
    }
    // 自己刚导出的那份不必再回灌一次（内容与画布已一致）
    if (value === loadedHashRef.current) return;

    const img = new Image();
    img.onload = () => {
      if (value === loadedHashRef.current) return;
      loadedHashRef.current = value;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);

      // 把"黑底灰度"转成"白 + 透明底"：alpha := 亮度（导出的 PNG 是 R=G=B）
      try {
        const id = ctx.getImageData(0, 0, W, H);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i + 3] = d[i];
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        }
        ctx.putImageData(id, 0, 0);
      } catch { /* 大图可能 OOM，忽略 */ }

      refreshOverlay(true);
      setUndoStack([]);        // 换了 mask（例如换源图）→ 旧快照无意义
    };
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, W, H]);

  /* -------------------------------------------------- 覆盖层：把 mask 按强度染红 */
  /**
   * 分级开启时**逐像素**合成（0.55 与 1.0 必须看得出差别）；
   * 分级关闭时走原来的 `destination-in` 快路径 —— 那条路径只有"有/无"
   * 两种状态，正好是纯涂抹体验该有的样子，而且便宜得多。
   *
   * `force=false` 时按 OVERLAY_THROTTLE_MS 节流：覆盖层合成在 2048² 上是
   * 一次 16 MB 的读写，pointermove 里每帧做会让笔迹明显拖尾。
   */
  const refreshOverlay = useCallback((force = false) => {
    const mask = maskRef.current;
    const ov = overlayRef.current;
    if (!mask || !ov) return;

    const run = () => {
      overlayPendingRef.current = false;
      if (ov.width !== W) ov.width = W;
      if (ov.height !== H) ov.height = H;
      const ctx = ov.getContext('2d');
      if (!ctx) return;

      if (graded) {
        try {
          paintOverlay(mask, ov);
        } catch { /* 大图可能 OOM，忽略 */ }
        return;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      // 用 mask 作为 alpha：红色只出现在涂过的地方
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = strengthToOverlayColor(1);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
    };

    if (force) {
      if (overlayTimerRef.current) { window.clearTimeout(overlayTimerRef.current); overlayTimerRef.current = null; }
      run();
      return;
    }
    if (overlayPendingRef.current) return;
    overlayPendingRef.current = true;
    overlayTimerRef.current = window.setTimeout(run, OVERLAY_THROTTLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, graded]);

  /* -------------------------------------------------- 导出 mask */
  /**
   * 导出 mask，并**一次性**算出 strokePixels / bbox / 覆盖率 / 强度分布。
   *
   * 四样都来自同一次 `getImageData` —— 分开算会让 2048² 多读几遍 16 MB。
   * bbox 必须**全量精确扫**，不能采样：采样会漏掉单像素宽的笔画端点 →
   * bbox 偏小 → auto 分辨率偏小 → 笔画被缩小。
   *
   * 导出后把 dataURL 记成"已加载"，让回灌 effect 短路（否则父组件 setState
   * 会再触发一次全图 `getImageData` + `putImageData`）。
   */
  const exportMask = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx0 = mask.getContext('2d');
    if (!ctx0) return;

    let strokePixels = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // 强度统计：只统计**选区像素**（alpha>0），否则整幅图的 0 会把均值拉没
    let sumA = 0;
    let minA = 255;
    let maxA = 0;
    let midPixels = 0;

    try {
      const d = ctx0.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y += 1) {
        const rowBase = y * W * 4;
        for (let x = 0; x < W; x += 1) {
          const a = d[rowBase + x * 4 + 3];
          if (a > 0) {
            strokePixels += 1;
            sumA += a;
            if (a < minA) minA = a;
            if (a > maxA) maxA = a;
            // "中间灰度"= 既不接近 0 也不接近 255（与后端 probeMaskIntensity 同阈值）
            if (a > 20 && a < 235) midPixels += 1;
          }
          // bbox 仍按 >127 判（与后端 probeMaskBbox 同阈值）：
          // 半透明边缘不该把 bbox 撑大，否则 auto 分辨率会被稀释。
          if (a > 127) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    } catch { /* 大图可能 OOM，忽略 */ }

    setCoverage(W * H > 0 ? strokePixels / (W * H) : 0);

    const summary: MaskIntensitySummary = {
      mean: strokePixels > 0 ? sumA / strokePixels : 0,
      min: strokePixels > 0 ? minA : 0,
      max: strokePixels > 0 ? maxA : 0,
      gradedFraction: strokePixels > 0 ? midPixels / strokePixels : 0,
      selectedPixels: strokePixels,
      graded: strokePixels > 0 && midPixels / strokePixels > 0.01,
    };
    setIntensity(summary);

    const bbox = strokePixels > 0 && maxX >= minX
      ? { w: maxX - minX + 1, h: maxY - minY + 1 }
      : null;

    /*
     * 导出为黑底灰度的 PNG（ComfyUI 的 ImageToMask(red) 取红通道）。
     * alpha → RGB：分级 mask 的强度就藏在 alpha 里，这里搬回红通道，
     * 同时把 alpha 拉满（`ImageToMask` 只读通道值，alpha 无关，但半透明 PNG
     * 在某些查看器里会显示成"几乎看不见"，排障时容易误以为 mask 是空的）。
     */
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(mask, 0, 0);
    if (graded) {
      try {
        const id = ctx.getImageData(0, 0, W, H);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          d[i] = a; d[i + 1] = a; d[i + 2] = a; d[i + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);
      } catch { /* 大图可能 OOM，忽略 */ }
    }
    const url = out.toDataURL('image/png');
    loadedHashRef.current = url;
    onChange(url, strokePixels, bbox, summary);
  }, [W, H, onChange, graded]);

  /** 防抖版导出：连续快笔只触发一次（见 EXPORT_DEBOUNCE_MS） */
  const scheduleExport = useCallback(() => {
    if (exportTimerRef.current) window.clearTimeout(exportTimerRef.current);
    exportTimerRef.current = window.setTimeout(() => {
      exportTimerRef.current = null;
      exportMask();
    }, EXPORT_DEBOUNCE_MS);
  }, [exportMask]);

  /** 立即导出（撤销 / 清空 / 全选这类一步到位的操作不等防抖） */
  const flushExport = useCallback(() => {
    if (exportTimerRef.current) {
      window.clearTimeout(exportTimerRef.current);
      exportTimerRef.current = null;
    }
    exportMask();
  }, [exportMask]);

  // 组件卸载时别把待执行的定时器留下（它会去回调已经不存在的父组件）
  useEffect(() => () => {
    if (exportTimerRef.current) window.clearTimeout(exportTimerRef.current);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
  }, []);

  /* -------------------------------------------------- 撤销 */
  /**
   * 压入一帧撤销快照。
   *
   * 粒度按**内存预算**动态算（见 UNDO_BUDGET_BYTES 的注释）：
   * 同样 96MB，1024² 能存 24 步，2048² 只能存 6 步，4096² 只有 1 步。
   * 这样大图上不会因为撤销栈把标签页撑爆。
   *
   * 分级重绘不需要额外处理：快照是整张 `ImageData`，强度（alpha）与形状
   * 一起被存/回滚。已验证：涂 0.85 → 涂 0.55 → 撤销 → 回到只有 0.85 的状态。
   */
  const pushUndo = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    try {
      const snap = ctx.getImageData(0, 0, W, H);
      const bytesPerSnap = Math.max(1, snap.data.byteLength);
      const maxSteps = Math.max(UNDO_MIN_STEPS, Math.floor(UNDO_BUDGET_BYTES / bytesPerSnap));
      setUndoStack((prev) => {
        const next = [...prev, snap];
        return next.length > maxSteps ? next.slice(next.length - maxSteps) : next;
      });
    } catch { /* 大图可能 OOM，忽略 */ }
  }, [W, H]);

  const undo = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    if (!undoStack.length) { toast.error('没有可撤销的操作'); return; }
    const snap = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(snap, 0, 0);
    refreshOverlay(true);
    flushExport();
  }, [undoStack, refreshOverlay, flushExport, toast]);

  /* -------------------------------------------------- 指针事件 */
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;

    e.preventDefault();
    mask.setPointerCapture(e.pointerId);
    setDrawing(true);
    pushUndo();

    const p = screenToCanvas(e, mask);
    strokeRef.current = [p];
    lastPointRef.current = p;

    if (graded) {
      // 分级：强度 0（或橡皮）→ 擦除；否则按强度取最大值合并
      if (effectiveErase) {
        stampBrush(ctx, p, brush, hexToRgb('#ffffff'), true);
      } else {
        stampStrength(ctx, p, { ...brush, strength: effectiveStrength }, W, H);
      }
    } else {
      stampBrush(ctx, p, brush, hexToRgb('#ffffff'), effectiveErase);
    }
    refreshOverlay(true);
  }, [brush, erasing, effectiveErase, effectiveStrength, graded, zeroStrength, pushUndo, refreshOverlay, W, H]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;

    e.preventDefault();
    const p = screenToCanvas(e, mask);
    const last = lastPointRef.current;
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.5) return;

    strokeRef.current.push(p);
    const seg: Point[] = last ? [last, p] : [p];

    if (graded) {
      if (effectiveErase) {
        drawStroke(ctx, seg, brush, hexToRgb('#ffffff'), true);
      } else {
        drawStrengthStroke(ctx, seg, { ...brush, strength: effectiveStrength }, W, H);
      }
    } else {
      // 增量绘制：只画新增这一小段（带样条平滑），不重画整条
      drawStroke(ctx, seg, brush, hexToRgb('#ffffff'), effectiveErase);
    }
    lastPointRef.current = p;
    refreshOverlay();
  }, [drawing, brush, erasing, effectiveErase, effectiveStrength, graded, zeroStrength, refreshOverlay, W, H]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const mask = maskRef.current;
    if (mask) {
      try { mask.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    setDrawing(false);
    strokeRef.current = [];
    lastPointRef.current = null;
    // 防抖：连续快笔合并成一次全图扫描 + PNG 编码
    scheduleExport();
  }, [scheduleExport]);

  /* -------------------------------------------------- 清空 / 全选 / 一键分级 */
  const clearMask = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, W, H);
    refreshOverlay(true);
    onChange('', 0, null, {
      mean: 0, min: 0, max: 0, gradedFraction: 0, selectedPixels: 0, graded: false,
    });
  }, [W, H, pushUndo, refreshOverlay, onChange]);

  /**
   * 全选 —— 在分级模式下**按当前档位**铺满，而不是一律铺白。
   *
   * 否则"选 55% 档 → 点全选"会得到一张 100% 的 mask，与用户此刻的档位
   * 明显矛盾，且他多半看不出来（红色覆盖层在满档下最浓，反而像"成功了"）。
   *
   * 强度 0（"保留"档）时全选 = **清空**：这是唯一自洽的语义，
   * 铺一层 0 的 alpha 等于什么都没做，用户会以为按钮坏了。
   */
  const fillAll = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    pushUndo();
    if (graded) {
      const a = Math.round(effectiveStrength * 255);
      ctx.clearRect(0, 0, W, H);
      if (a > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(a / 255).toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        toast.info('当前强度为 0（保留档），全选等同于清空');
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    refreshOverlay(true);
    flushExport();
  }, [W, H, graded, effectiveStrength, pushUndo, refreshOverlay, flushExport, toast]);

  /**
   * 把已有选区**整体改档** —— "先框大范围，再统一降强度"的主路径。
   *
   * 语义选择（见 `recolorSelection`）：`set` 统一设成目标档；
   * 按住 Shift 时改成 `scale`（按比例压，保留原有相对关系）。
   * 有选区时才生效；没选区时提示用户先涂 —— 静默无效是最糟的体验。
   */
  const applyLevelToSelection = useCallback((levelId: string, mode: 'set' | 'scale' = 'set') => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    const target = (levels && levels.length ? levels : GRADED_FALLBACK).find((l) => l.id === levelId);
    if (!target) return;

    let hasSelection = false;
    try {
      const d = ctx.getImageData(0, 0, W, H).data;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 0) { hasSelection = true; break; } }
    } catch { /* ignore */ }

    if (!hasSelection) {
      toast.error('还没有选区：先涂一块，再用档位按钮整体改强度');
      return;
    }

    pushUndo();
    const changed = recolorSelection(ctx, W, H, target.mask, mode);
    refreshOverlay(true);
    if (!changed) {
      toast.info(
        mode === 'set'
          ? `选区已经是「${target.label}」，没有变化`
          : `选区强度已是 0，无法再乘 ${target.mask}`,
      );
      return;
    }
    onLevelChange(levelId);
    flushExport();
    toast.ok(
      mode === 'set'
        ? `选区整体设为「${target.label}」（mask=${target.mask}）`
        : `选区整体 × ${target.mask}（「${target.label}」）`,
    );
  }, [W, H, levels, pushUndo, refreshOverlay, flushExport, onLevelChange, toast]);

  /**
   * 切换分级开关时**保住已有 mask**。
   *
   * 两个方向都要处理，且都不能丢笔画：
   *   · 关 → 开：mask 里的像素可能全是 255（纯涂抹），此时把选区**按当前档位
   *     压一次**？不做 —— 那等于替用户改数据。只把画笔强度同步到当前档位，
   *     让下一次落笔是分级的；已有像素原样保留（它们本来就是 1.0 = 完全重绘，
   *     语义正确）。
   *   · 开 → 关：mask 里可能已有 0.55 的灰度。保留（关掉只是 UI 不再暴露
   *     强度，链路那边 `graded=false` 会把灰度当"选了/没选"，仍是有效 mask）。
   *     若用户希望"抹平"，面板上给了「一键拉满」的解释提示。
   *
   * 无论哪个方向都**不动 mask 画布**，只重绘覆盖层（渲染方式变了）。
   */
  const handleGradedToggle = useCallback((next: boolean) => {
    onGradedChange(next);
    if (next) {
      const lv = (levels && levels.length ? levels : GRADED_FALLBACK).find((l) => l.id === level);
      const v = lv ? lv.mask : 1;
      setBrush((b) => ({ ...b, strength: v }));
    }
    setErasing(false);
    refreshOverlay(true);   // 渲染链路切换（分级逐像素 / 普通 destination-in）
  }, [onGradedChange, levels, level, refreshOverlay]);

  /**
   * 强度滑块：手动拖动 = 脱离预设档位。
   *
   * 档位高亮必须跟着走，否则会出现"按钮亮着「强」、实际涂的是 0.62"——
   * 提交时按 `gradedLevel` 还是按画笔强度会变成一条猜不出的分歧。
   * 落在某档 ±0.02 内就吸附过去，否则把档位标成空串（所有按钮都不高亮）。
   */
  const onStrengthSlide = useCallback((v: number) => {
    setBrush((b) => ({ ...b, strength: v }));
    const list = levels && levels.length ? levels : GRADED_FALLBACK;
    let near = list[0];
    for (const l of list) {
      if (Math.abs(l.mask - v) < Math.abs(near.mask - v)) near = l;
    }
    onLevelChange(Math.abs(near.mask - v) < 0.02 ? near.id : '');
  }, [levels, onLevelChange]);

  /* -------------------------------------------------- 渲染 */
  const pct = Math.round(coverage * 100);
  const strengthPct = Math.round(effectiveStrength * 100);
  const showGradedHints = graded;

  /** 强度文案：0 档要明确说"等同擦除"，否则用户会反复涂却看不到反应 */
  const strengthText = !graded
    ? '—'
    : zeroStrength
      ? '0%（等同擦除）'
      : `${strengthPct}%（mask ${(effectiveStrength).toFixed(2)}）`;

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          局部重绘
          <Badge tone={pct > 0 ? 'accent' : 'default'}>已涂 {pct}%</Badge>
          {showGradedHints ? <Badge tone="ok">分级</Badge> : null}
          {pct > 60 ? <Badge tone="warn">面积过大</Badge> : null}
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={undo} disabled={!undoStack.length}>
            撤销
          </Button>
          <Button variant="ghost" size="sm" onClick={clearMask}>清空</Button>
          <Button variant="ghost" size="sm" onClick={fillAll}>全选</Button>
        </>
      }
      tight
    >
      {/* 画笔设置 */}
      <div className="jz-col" style={{ gap: 6, marginBottom: 8 }}>
        <div className="jz-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="jz-xs jz-muted">笔刷</span>
          <input
            type="range" min={4} max={300} step={1}
            value={brush.size}
            onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
            style={{ width: 110 }}
          />
          <span className="jz-mono jz-xs" style={{ minWidth: 32 }}>{brush.size}</span>

          <span className="jz-xs jz-muted">硬度</span>
          <input
            type="range" min={0} max={1} step={0.05}
            value={brush.hardness}
            onChange={(e) => setBrush((b) => ({ ...b, hardness: Number(e.target.value) }))}
            style={{ width: 80 }}
          />
          <span className="jz-mono jz-xs" style={{ minWidth: 32 }}>{brush.hardness.toFixed(2)}</span>

          {graded ? (
            <>
              <span className="jz-xs jz-muted">强度</span>
              <input
                type="range" min={0} max={1} step={0.01}
                value={brush.strength}
                onChange={(e) => onStrengthSlide(Number(e.target.value))}
                style={{ width: 100 }}
                aria-label="笔触强度"
              />
              <span
                className="jz-mono jz-xs"
                style={{
                  minWidth: 96,
                  color: zeroStrength
                    ? 'var(--jz-warn-text)'
                    : strengthPct >= 85 ? 'var(--jz-danger)' : undefined,
                }}
              >
                {strengthText}
              </span>
              {/* 强度取样色块：与覆盖层同一套配色，让"这一档涂出来什么颜色"所见即所得 */}
              <span
                aria-hidden="true"
                title={`当前笔触的覆盖层颜色（${strengthPct}%）`}
                style={{
                  display: 'inline-block', width: 22, height: 14, borderRadius: 3,
                  border: '1px solid var(--jz-border)',
                  background: strengthToOverlayColor(effectiveStrength),
                  backgroundImage: zeroStrength
                    ? 'repeating-linear-gradient(45deg,#888 0 3px,transparent 3px 6px)'
                    : undefined,
                }}
              />
            </>
          ) : null}

          <Button
            variant={erasing ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setErasing((v) => !v)}
          >
            <Icon name="swap" size={13} /> {erasing ? '橡皮' : '涂抹'}
          </Button>
        </div>

        {/**
         * 分级开关 + 档位预设按钮。
         * 关掉时整块消失（不留"强度"概念残留），这正是任务要求的
         * "回到现在的纯涂抹体验"。
         */}
        <div className="jz-row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Switch checked={graded} onChange={handleGradedToggle} label="分级重绘" />
          {graded && matchedLevel ? (
            <span className="jz-xs jz-muted">
              当前档位「{matchedLevel.label}」mask={matchedLevel.mask} —— {matchedLevel.hint}
            </span>
          ) : graded ? (
            <span className="jz-xs" style={{ color: 'var(--jz-warn-text)' }}>
              强度 {strengthPct}% 不在预设档上（最接近「{nearestLevel.label}」
              {' '}mask={nearestLevel.mask}）。画笔按 {strengthPct}% 生效，
              但提交时后端只认档位 —— 想要精确控制请点一个档位按钮。
            </span>
          ) : (
            <span className="jz-xs jz-muted">关闭时涂出来永远是满强度（普通重绘）</span>
          )}
        </div>

        {graded ? (
          <>
            {/* 档位预设：点一下 = 把**已有选区**整体设成该强度 */}
            <div className="jz-row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="jz-xs jz-muted">把选区设为</span>
              {levelList.map((l) => {
                const active = matchedLevel?.id === l.id;
                return (
                  <Button
                    key={l.id}
                    variant={active ? 'primary' : 'ghost'}
                    size="sm"
                    title={`${l.hint}（mask=${l.mask}）`}
                    onClick={(e) => applyLevelToSelection(l.id, e.shiftKey ? 'scale' : 'set')}
                  >
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                      marginRight: 4, background: strengthToOverlayColor(l.mask),
                      border: '1px solid var(--jz-border)',
                    }} />
                    {l.label}
                  </Button>
                );
              })}
              <Select<string>
                value={matchedLevel?.id ?? nearestLevel.id}
                onChange={(v) => {
                  onLevelChange(v);
                  const lv = levelList.find((l) => l.id === v);
                  if (lv) setBrush((b) => ({ ...b, strength: lv.mask }));
                }}
                options={levelList.map((l) => ({
                  value: l.id,
                  label: `${l.label}（mask ${l.mask}）`,
                }))}
                style={{ maxWidth: 190 }}
              />
            </div>

            {/* 分级色带图例 */}
            <div className="jz-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="jz-xs jz-muted">强度</span>
              <div
                aria-hidden="true"
                style={{
                  width: 220, height: 12, borderRadius: 3,
                  border: '1px solid var(--jz-border)',
                  background:
                    'linear-gradient(90deg, rgba(255,150,40,0.25) 0%, '
                    + 'rgba(240,90,40,0.55) 55%, rgba(214,40,40,0.85) 100%)',
                }}
              />
              <span className="jz-xs jz-muted">
                浅=轻（0.55）→ 深=强（1.0）；<b>低于 0.5 实测几乎不可见</b>
              </span>
            </div>

            {intensity && intensity.selectedPixels > 0 ? (
              <div className="jz-xs jz-muted">
                选区强度：均值 {(intensity.mean / 255).toFixed(2)}
                {' · '}范围 {(intensity.min / 255).toFixed(2)}–{(intensity.max / 255).toFixed(2)}
                {intensity.graded
                  ? ` · 分级像素占 ${(intensity.gradedFraction * 100).toFixed(0)}%`
                  : ' · 目前是满强度（还没有分级像素）'}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* 三层 canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          aspectRatio: `${W} / ${H}`,
          margin: '0 auto',
          borderRadius: 'var(--jz-r-sm)',
          overflow: 'hidden',
          background: 'var(--jz-bg-sunken)',
          border: '1px solid var(--jz-border)',
        }}
      >
        <canvas
          ref={baseRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        <canvas
          ref={maskRef}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            // 强度 0 时真的在擦除：光标用 cell 与橡皮区分"涂抹"的十字
            cursor: zeroStrength ? 'cell' : 'crosshair', touchAction: 'none',
            // mask 层本身不可见（透明），红覆盖层负责显示
            opacity: 0,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
        在图上涂抹要重绘的区域（红色显示）。mask 尺寸锁定为源图 {W}×{H}，
        与源图不一致会让重绘区域偏移（ComfyUI 会静默拉伸 mask，不报错）。
        {zeroStrength
          ? ' 当前强度为 0（保留档）：落笔等同擦除，光标是空心方块。把滑块拉到 55% 以上才会真正涂上强度。'
          : ''}
        {pct > 60 ? ' 当前选区超过 60%，建议改用「全图」模式或缩小范围。' : ''}
      </div>
    </Panel>
  );
}

export default MaskEditor;
