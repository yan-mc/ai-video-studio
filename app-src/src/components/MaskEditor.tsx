/**
 * 局部重绘的 mask 画笔编辑器。
 *
 * 三层 canvas 叠放：
 *   ① 底图（源图，只读） ② mask 数据层（白色笔迹 + 透明底，接收指针事件）
 *   ③ 覆盖层（红色半透明，把 mask 染红便于预览，只读）
 *
 * 为什么拆三层而不是一个 canvas 上直接画：
 * mask 必须是**灰度图**（白=重绘），提交给 ComfyUI 的 `ImageToMask(red)`
 * 要求干净的黑底白区；而用户要看的是红色半透明覆盖 —— 那是视觉层，不是数据层。
 * 把红色直接画进 mask 就不是合法的 mask 了。
 *
 * 两条硬约束（违反会 400 或静默出错）：
 *   · mask 尺寸**必须与源图完全一致**（ComfyUI 会 bilinear 拉伸，区域会偏移）
 *   · 源图宽高最好是 32 的倍数：full 模式会被 VAE 居中裁边；crop 模式不受影响
 *
 * @module components/MaskEditor
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_BRUSH, drawStroke, hexToRgb, screenToCanvas, stampBrush,
  type BrushSettings, type Point,
} from '../lib/brush';
import { Badge, Button, Icon, Panel, useToast } from '../ui';

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
   *   dataUrl      mask 的黑底白区 PNG
   *   strokePixels 非零像素数（统计信息 + bbox 估算兜底）
   *   bbox         mask 的外接框（**auto 分辨率按它算，最准**）
   */
  onChange: (dataUrl: string, strokePixels: number, bbox: { w: number; h: number } | null) => void;
}

/**
 * 撤销栈的**内存预算**（字节），不是步数。
 *
 * 一帧 `ImageData` = W × H × 4 字节。本项目支持到 2560×1440 / 2400×1600：
 *   1024² ×4×10 步 = 40MB（还行）   2048² ×4×10 = 160MB（吃紧）
 *   2560×1440 ×4×10 = 147MB（吃紧）  4096² ×4×10 = 671MB（直接爆）
 * 固定步数在大图上会把标签页拖死，所以按预算动态决定能存几步
 * （96MB ≈ Chrome 单标签堆上限的 5~10%：1024² 存 24 步、4096² 只存 1 步）。
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

export function MaskEditor({
  imageUrl, imageWidth, imageHeight, value, onChange,
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

  /** 当前笔画累积的原始点 */
  const strokeRef = useRef<Point[]>([]);
  /** 已画到的最后一个点（用于增量绘制，避免每次重画整条） */
  const lastPointRef = useRef<Point | null>(null);
  /** 回灌短路：记录最近一次"画布内容所对应的 dataURL" */
  const loadedHashRef = useRef<string>('');
  /** 导出防抖定时器 */
  const exportTimerRef = useRef<number | null>(null);

  const W = imageWidth;
  const H = imageHeight;

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

  /* -------------------------------------------------- 同步外部 value → mask canvas */
  /**
   * 把外部的 mask（dataURL）回灌到 mask 画布。
   *
   * **必须做"黑底→透明底"的转换**：`exportMask()` 导出的是黑底白区的**不透明**
   * PNG（给后端 `ImageToMask(red)` 用，红通道白=255），而 mask 画布本身必须是
   * "白笔迹 + 透明背景"。直接 `drawImage` 回灌会让画布 alpha 全变 255 →
   * 覆盖层的 `destination-in` 判断 alpha>0 → 红层盖满整幅图 → 覆盖率恒 100%
   * → bbox 变成整幅图 → auto 分辨率被顶到 maxCrop，小选区"自动放大"设计失效。
   *
   * 修法：回灌时按**亮度**重建 alpha（亮=涂抹）。提交出去的 mask 仍然是对的，
   * 所以这类错误不报错、只出坏质量。
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
      refreshOverlay();
      setCoverage(0);
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

      // 把"黑底白区"转成"白 + 透明底"：alpha := 亮度（导出的 PNG 是 R=G=B）
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

      refreshOverlay();
    };
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, W, H]);

  /* -------------------------------------------------- 覆盖层：把 mask 染红 */
  /**
   * 只做绘制，**不统计覆盖率**：这个函数在 `pointermove` 里被调用，
   * 在里面 `getImageData(0,0,W,H)` 等于每个鼠标事件读一整张图（2048² = 16MB）。
   * 覆盖率统计只在 `exportMask()` 里做，与 strokePixels / bbox 复用同一次扫描。
   */
  const refreshOverlay = useCallback(() => {
    const mask = maskRef.current;
    const ov = overlayRef.current;
    if (!mask || !ov) return;
    if (ov.width !== W) ov.width = W;
    if (ov.height !== H) ov.height = H;
    const ctx = ov.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 用 mask 作为 alpha：红色只出现在涂过的地方
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 64, 64, 0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  }, [W, H]);

  /* -------------------------------------------------- 导出 mask */
  /**
   * 导出 mask，并**一次性**算出 strokePixels / bbox / 覆盖率。
   *
   * 三样都来自同一次 `getImageData` —— 分开算会让 2048² 多读几遍 16MB。
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
    try {
      const d = ctx0.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y += 1) {
        const rowBase = y * W * 4;
        for (let x = 0; x < W; x += 1) {
          if (d[rowBase + x * 4 + 3] > 127) {
            strokePixels += 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    } catch { /* 大图可能 OOM，忽略 */ }

    setCoverage(W * H > 0 ? strokePixels / (W * H) : 0);

    const bbox = strokePixels > 0 && maxX >= minX
      ? { w: maxX - minX + 1, h: maxY - minY + 1 }
      : null;

    // 导出为黑底白区的灰度 PNG（ComfyUI 的 ImageToMask(red) 取红通道）
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(mask, 0, 0);
    const url = out.toDataURL('image/png');
    loadedHashRef.current = url;
    onChange(url, strokePixels, bbox);
  }, [W, H, onChange]);

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
  }, []);

  /* -------------------------------------------------- 撤销 */
  /**
   * 压入一帧撤销快照。
   *
   * 粒度按**内存预算**动态算（见 UNDO_BUDGET_BYTES 的注释）：
   * 同样 96MB，1024² 能存 24 步，2048² 只能存 6 步，4096² 只有 1 步。
   * 这样大图上不会因为撤销栈把标签页撑爆。
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
    refreshOverlay();
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

    // 单击也要落一个点
    const color = hexToRgb('#ffffff');
    stampBrush(ctx, p, brush, color, erasing);
    refreshOverlay();
  }, [brush, erasing, pushUndo, refreshOverlay]);

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
    // 增量绘制：只画新增这一小段（带样条平滑），不重画整条
    const color = hexToRgb('#ffffff');
    drawStroke(ctx, last ? [last, p] : [p], brush, color, erasing);
    lastPointRef.current = p;
    refreshOverlay();
  }, [drawing, brush, erasing, refreshOverlay]);

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

  /* -------------------------------------------------- 清空 / 全选 */
  const clearMask = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, W, H);
    refreshOverlay();
    onChange('', 0, null);
  }, [W, H, pushUndo, refreshOverlay, onChange]);

  const fillAll = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d');
    if (!ctx) return;
    pushUndo();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    refreshOverlay();
    flushExport();
  }, [W, H, pushUndo, refreshOverlay, flushExport]);

  /* -------------------------------------------------- 渲染 */
  const pct = Math.round(coverage * 100);

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          局部重绘
          <Badge tone={pct > 0 ? 'accent' : 'default'}>已涂 {pct}%</Badge>
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

          <Button
            variant={erasing ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setErasing((v) => !v)}
          >
            <Icon name="swap" size={13} /> {erasing ? '橡皮' : '涂抹'}
          </Button>
        </div>
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
            cursor: 'crosshair', touchAction: 'none',
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
        {pct > 60 ? ' 当前选区超过 60%，建议改用「全图」模式或缩小范围。' : ''}
      </div>
    </Panel>
  );
}

export default MaskEditor;
