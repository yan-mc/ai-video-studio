/**
 * 局部重绘面板 —— 独立一块，挂在图像页。
 *
 * 为什么独立成组件而不是并进 ImagePage：ImagePage 已有「参考图 / 提示词 /
 * 输出设置 / LoRA / 任务 / 预览」六块状态，再塞进重绘（源图 + mask 画笔 +
 * 模式 + 强度 + 分辨率）会让"当前操作的是哪张图、走的是哪条链路"难以追踪。
 * 独立后状态完全隔离（不会把 mask 误当参考图提交），且单独可测。
 *
 * UI 上的硬约束（都在提交前拦，不依赖后端兜底）：
 *   · 源图与 mask 必须同尺寸 —— 后端会 400，前端先拦更好
 *   · 改动强度用 strength（SplitSigmas），**不提供 denoise 滑块**
 *   · crop 模式依赖 vendor 节点，不可用时禁用并给出部署提示
 *
 * ⚠️ 这个组件**不能因为切 tab 而卸载**（见 ImagePage 的常驻挂载）：
 * 源图 / mask / 提示词 / 正在轮询的 job 全在这里。
 *
 * @module components/InpaintPanel
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, describeError } from '../api/client';
import { outputUrl } from '../api/url';
import type { Asset, ImageProgressJob, InpaintMetaPayload } from '../api/types';
import { MaskEditor } from './MaskEditor';
import { ImageLoraPicker, type ImageLoraChoice } from './ImageLoraPicker';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Panel, Select, Textarea, useToast,
} from '../ui';

/** 源图信息（尺寸用于校验 mask） */
interface SourceInfo {
  rel: string;
  name: string;
  /** 图片的对外 URL（给 MaskEditor 当底图） */
  url: string;
  width: number;
  height: number;
}

export function InpaintPanel() {
  const toast = useToast();
  const [meta, setMeta] = useState<InpaintMetaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [loadingSrc, setLoadingSrc] = useState(false);

  const [mask, setMask] = useState('');
  /** mask 的非零像素数（统计 + bbox 估算兜底） */
  const [strokePixels, setStrokePixels] = useState(0);
  /** mask 的外接框（auto 分辨率按它算，最准） */
  const [bbox, setBbox] = useState<{ w: number; h: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'crop' | 'full'>('crop');
  const [strength, setStrength] = useState<'full' | 'strong' | 'medium' | 'light'>('full');
  /** 分辨率档位：auto 或具体数值 */
  const [resolutionId, setResolutionId] = useState('auto');
  /** crop 上限（选区超过它就会整块被缩小；P0-1 修好后这是唯一的自救手段） */
  const [maxCrop, setMaxCrop] = useState<number | null>(null);
  const [seed, setSeed] = useState('');
  const [loras, setLoras] = useState<ImageLoraChoice[]>([]);
  const [busy, setBusy] = useState(false);

  const [job, setJob] = useState<ImageProgressJob | null>(null);
  const [preview, setPreview] = useState('');

  /* -------------------------------------------------- 载入 meta 与素材 */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, list] = await Promise.all([
        api.inpaintMeta(),
        api.listAssets().catch(() => []),
      ]);
      setMeta(m);
      setMaxCrop((prev) => prev ?? m?.cropDefaults?.maxCrop ?? null);
      setAssets(Array.isArray(list) ? list.filter((a) => a.kind === 'image') : []);
      setErr('');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* -------------------------------------------------- 选源图（读真实尺寸） */
  const pickSource = useCallback(async (rel: string) => {
    // 收集所有与"当前源图"绑定的派生状态，统一清空 ——
    // 少清一个就会出现"换了图但 bbox 还是旧图的"这种错位。
    const resetDerived = () => {
      setMask('');
      setStrokePixels(0);
      setBbox(null);
    };

    if (!rel) { setSource(null); resetDerived(); return; }
    setLoadingSrc(true);
    try {
      const url = `/jiuzhang/api/file?path=${encodeURIComponent(rel)}`;
      const dims = await loadImageDims(url);
      if (!dims) {
        toast.error('读不到源图尺寸（文件可能损坏或格式不支持）');
        return;
      }
      const a = assets.find((x) => x.rel === rel);
      setSource({
        rel,
        name: a?.name || rel.split('/').pop() || '源图',
        url,
        width: dims.w,
        height: dims.h,
      });
      resetDerived();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setLoadingSrc(false);
    }
  }, [assets, toast]);

  /* -------------------------------------------------- 任务轮询 */
  useEffect(() => {
    if (!job?.id) return undefined;
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(job.status)) return undefined;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const r = await api.imageProgress([job.id]);
          const j = r.jobs?.[0];
          if (j) setJob(j);
        } catch { /* ignore */ }
      })();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  /* -------------------------------------------------- 提交 */
  async function handleSubmit() {
    if (!source) { toast.error('请先选源图'); return; }
    if (!mask) { toast.error('请先在图上涂抹要重绘的区域'); return; }
    if (!prompt.trim()) { toast.error('请写提示词（描述想在选区生成什么）'); return; }
    if (mode === 'crop' && !meta?.cropAvailable) {
      toast.error('crop 模式依赖的节点未部署，请改用「全图」模式');
      return;
    }

    setBusy(true);
    try {
      const r = await api.imageInpaint({
        prompt,
        source: source.rel,
        mask,                       // dataURL，后端会落盘到 tmp-inline
        mode,
        strength,
        /** auto 档按 bbox 算分辨率（最准）；strokePixels 是估算兜底 */
        ...(bbox ? { bboxW: bbox.w, bboxH: bbox.h } : {}),
        ...(strokePixels > 0 ? { strokePixels } : {}),
        ...(seed.trim() ? { seed: Number(seed) } : {}),
        ...(loras.length
          ? { loras: loras.map((l) => ({ name: l.name, ...(l.strength != null ? { strength: l.strength } : {}) })) }
          : {}),
        /** 分辨率档位：auto 交给后端算，其余传具体值 */
        ...(mode === 'crop'
          ? {
            crop: {
              ...(resolutionId === 'auto'
                ? { resolutionId: 'auto' }
                : { resolutionId, baseResolution: Number(resolutionId) }),
              ...(maxCrop != null && maxCrop !== meta?.cropDefaults?.maxCrop
                ? { maxCrop }
                : {}),
            },
          }
          : {}),
      });
      const init = await api.imageProgress([r.id]).catch(() => null);
      setJob(init?.jobs?.[0] ?? { id: r.id, status: 'queued' });
      toast.ok(`已提交（${mode === 'crop' ? '裁剪重绘' : '全图'} · ${r.strength}）`);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const maxChars = meta?.promptMaxChars ?? 4096;
  const overLimit = prompt.length > maxChars;
  const strengthOpt = useMemo(
    () => meta?.strengths?.find((s) => s.id === strength),
    [meta, strength],
  );
  const out = job?.outputs?.[0];
  // ImageProgressJob 的 rel 是 `string | null`，outputUrl 期望 `string | undefined`
  const outUrlStr = out?.rel ? outputUrl({ rel: out.rel }) : '';

  if (loading) return <Panel title="局部重绘"><Loading text="载入中" /></Panel>;

  if (err) {
    return (
      <Panel title="局部重绘">
        <Alert tone="danger">{err}</Alert>
        <Button variant="ghost" onClick={() => void load()}>重试</Button>
      </Panel>
    );
  }

  return (
    <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
      {/* crop 能力提示 */}
      {!meta?.cropAvailable ? (
        <Alert tone="warn">
          crop&stitch 依赖的节点未就绪：{meta?.vendorHint ?? '未知原因'}
          <br />
          仍可用「全图」模式（mask 外会有轻微 VAE 重编码损耗）。
        </Alert>
      ) : null}

      {/* 源图选择 */}
      <Panel title="① 选源图" tight>
        <div className="jz-row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <Field label="从素材库选">
              <Select<string>
                value={source?.rel ?? ''}
                onChange={(v) => void pickSource(v)}
                options={[
                  { value: '', label: '（请选择）' },
                  ...assets.map((a) => ({ value: a.rel, label: a.name || a.rel })),
                ]}
              />
            </Field>
          </div>
          <Button variant="ghost" onClick={() => void load()} disabled={loadingSrc}>
            刷新素材
          </Button>
        </div>
        {source ? (
          <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
            源图 {source.width}×{source.height}
            {source.width % 32 !== 0 || source.height % 32 !== 0
              ? (() => {
                const sw = Math.max(32, Math.floor(source.width / 32) * 32);
                const sh = Math.max(32, Math.floor(source.height / 32) * 32);
                return (
                  <>
                    <br />
                    <span style={{ color: 'var(--jz-warn-text)' }}>
                      不是 32 的倍数。crop 模式没问题（裁剪块会被缩放到 32 对齐的采样画布）；
                      <b>full 模式</b>会被 VAE 居中裁成 {sw}×{sh}，产物尺寸与区域都会有几像素偏差 ——
                      后端默认拒绝，需要显式放行。
                    </span>
                  </>
                );
              })()
              : ''}
          </div>
        ) : null}
      </Panel>

      {/* mask 画笔 */}
      {source ? (
        <MaskEditor
          imageUrl={source.url}
          imageWidth={source.width}
          imageHeight={source.height}
          value={mask}
          onChange={(dataUrl, px, bb) => { setMask(dataUrl); setStrokePixels(px); setBbox(bb); }}
        />
      ) : (
        <Panel title="② 涂抹区域" tight>
          <div className="jz-sm jz-muted">先选源图，然后在这里涂抹要重绘的区域。</div>
        </Panel>
      )}

      {/* 提示词与参数 */}
      <Panel title="③ 提示词与参数">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={`描述你希望在选区内生成什么（最长 ${maxChars} 字符）。\n\n例：a glowing blue magical circle, intricate runic patterns, soft blue light\n\n注意：只需描述"选区里要出现什么"，不用复述选区外的内容。`}
        />
        <div className="jz-row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <span className="jz-xs" style={{ color: overLimit ? 'var(--jz-danger)' : undefined }}>
            {prompt.length} / {maxChars}
          </span>
          {overLimit ? <Badge tone="danger">超长</Badge> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--jz-sp-3)', marginTop: 10 }}>
          <Field label="重绘模式">
            <Select<'crop' | 'full'>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'crop', label: '裁剪重绘（推荐，外围零改动）', disabled: !meta?.cropAvailable },
                { value: 'full', label: '全图混合' },
              ]}
            />
          </Field>
          <Field label="改动强度">
            <Select<'full' | 'strong' | 'medium' | 'light'>
              value={strength}
              onChange={setStrength}
              options={(meta?.strengths ?? []).map((s) => ({ value: s.id, label: s.label }))}
            />
          </Field>
          {mode === 'crop' ? (
            <Field label="重绘分辨率">
              <Select<string>
                value={resolutionId}
                onChange={setResolutionId}
                options={(meta?.resolutions ?? []).map((p) => ({ value: p.id, label: p.label }))}
              />
            </Field>
          ) : null}
          {mode === 'crop' ? (
            <Field label="选区上限（maxCrop）">
              <Input
                value={maxCrop == null ? '' : String(maxCrop)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMaxCrop(Number.isFinite(n) && n > 0 ? Math.round(n / 32) * 32 : null);
                }}
                mono
                placeholder={String(meta?.cropDefaults?.maxCrop ?? 1024)}
              />
            </Field>
          ) : null}
          <Field label="种子（留空随机）">
            <Input value={seed} onChange={(e) => setSeed(e.target.value)} mono placeholder="留空" />
          </Field>
        </div>

        {strengthOpt ? (
          <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>
            {strengthOpt.label}：{strengthOpt.hint}
          </div>
        ) : null}

        {/* 分辨率提示：auto 档显示预估，手动档说明稀释风险 */}
        {mode === 'crop' ? (
          <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>
            {resolutionId === 'auto' ? (
              (() => {
                const est = estimateRes(bbox, meta?.autoScale ?? 1.5, meta?.cropDefaults, {
                  max: maxCrop ?? meta?.cropDefaults?.maxCrop,
                  maxMP: meta?.maxMP,
                });
                const blockLong = bbox ? Math.max(bbox.w, bbox.h) : 0;
                return est
                  ? (
                    <>
                      自动：选区 {bbox!.w}×{bbox!.h} → 约 <b>{est}</b>²
                      {blockLong > est
                        ? `（整块会被等比缩小到约 ${Math.round((est / blockLong) * 100)}%，覆盖范围完整、只损失细节）`
                        : '（保证笔画不被缩小，小选区会自动放大）'}
                    </>
                  )
                  : <>自动：按选区外接框<b>长边</b>给分辨率（涂了之后这里会显示预估值）</>;
              })()
            ) : (
              <>
                手动 {resolutionId}²：若选区外接框比它大，整块图会被<b>等比缩小</b>再重绘 ——
                涂过的地方都会重绘，只是细节会损失。不确定就用「自动」。
              </>
            )}
          </div>
        ) : null}

        {/**
         * 这里**故意不提供 denoise / 步数滑块**：两者都决定 PDD 网格怎么被切，
         * 偏离训练态的表现是"区域被抹平、不按提示词生成"，而不是"改得更少"。
         * 改动强弱用上面的「强度」档位（SplitSigmas 切片，每档都落在网格上）。
         */}
        <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
          改动强弱由「强度」控制（SplitSigmas 切片），<b>没有 denoise 滑块</b> ——
          H3-Image 的 6 步 PDD 网格要求 denoise 恒为 1.0、步数恒为 6，
          调低任何一项都会让模型失去重建能力（配置里的 imageSteps 在重绘上不生效）。
        </div>
      </Panel>

      {/* LoRA（可选） */}
      <ImageLoraPicker
        value={loras}
        onChange={setLoras}
        hasRefImages={Boolean(source)}
        maxSlots={meta?.maxLoras ?? 6}
      />

      {/* 提交 */}
      <div className="jz-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <Button
          variant="primary"
          icon={<Icon name="image" size={15} />}
          onClick={() => void handleSubmit()}
          disabled={busy || !source || !mask || !prompt.trim() || overLimit}
        >
          {busy ? '提交中…' : '开始重绘'}
        </Button>
      </div>

      {/* 任务与结果 */}
      {job ? (
        <Panel title="结果" actions={
          <Badge tone={
            job.status === 'completed' ? 'ok'
              : job.status === 'failed' ? 'danger'
                : 'warn'
          }>
            {job.status}
          </Badge>
        }>
          {job.status === 'running' || job.status === 'queued' ? (
            <div className="jz-col" style={{ gap: 4 }}>
              <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                <span className="jz-xs jz-muted">{job.progress?.note ?? job.status}</span>
                <span className="jz-xs jz-mono">{job.progress?.pct ?? 5}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--jz-bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(2, Math.min(100, job.progress?.pct ?? 5))}%`,
                  height: '100%', background: 'var(--jz-accent)', transition: 'width .4s ease',
                }} />
              </div>
            </div>
          ) : null}

          {job.error ? <Alert tone="danger">{job.error}</Alert> : null}

          {/**
           * 后端的警告必须显示出来。
           * 提交时的 toast 一闪而过，很多信息（选区被缩小、LoRA 被剔除）
           * 需要用户能反复看到，所以这里常驻展示。
           */}
          {Array.isArray(job.warnings) && job.warnings.length ? (
            <Alert tone="warn">
              <div className="jz-col" style={{ gap: 4 }}>
                {job.warnings.map((w, i) => (
                  <div key={i} className="jz-xs">{w}</div>
                ))}
              </div>
            </Alert>
          ) : null}

          {outUrlStr ? (
            <>
              <img
                src={outUrlStr}
                alt="重绘结果"
                style={{ maxWidth: '100%', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => setPreview(outUrlStr)}
              />
              <div className="jz-row" style={{ marginTop: 8, gap: 8 }}>
                <Button
                  variant="ghost"
                  icon={<Icon name="swap" size={15} />}
                  onClick={() => {
                    // 结果继续作为源图 → 迭代重绘
                    if (out?.rel) void pickSource(out.rel);
                  }}
                >
                  以此结果继续重绘
                </Button>
              </div>
            </>
          ) : null}
        </Panel>
      ) : null}

      {preview ? (
        <Panel title="预览" actions={<Button variant="ghost" onClick={() => setPreview('')}>关闭</Button>}>
          <img src={preview} alt="预览" style={{ maxWidth: '100%', borderRadius: 6 }} />
        </Panel>
      ) : null}
    </div>
  );
}

/** 读图片真实像素尺寸（浏览器侧） */
function loadImageDims(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * 前端预估 auto 档的分辨率（**必须与后端 autoCropResolution 逐行一致**）。
 *
 * 公式：`max(bboxW, bboxH) × scale` → 面积上限夹取 → `[min, max]` 夹取 →
 * 对齐 32 → 下限 256。**顺序不能改**：先夹 max 再夹面积会得出偏小的值。
 *
 * ⚠️ 用 **bbox 长边**，不是笔画总面积 —— 后者会让 bbox 大而笔画细的情况
 *    算出过小的分辨率，把细线缩小糊掉（实测边缘差异差 2 倍）。
 *    放在前端只为「涂完就告诉用户会用多大」，真正的值仍由后端算。
 */
function estimateRes(
  bbox: { w: number; h: number } | null,
  scale: number,
  cropDefaults?: { minCrop: number; maxCrop: number },
  opts?: { max?: number | null; maxMP?: number },
): number | null {
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return null;
  const min = cropDefaults?.minCrop ?? 256;
  const max = opts?.max ?? cropDefaults?.maxCrop ?? 1024;
  const maxMP = opts?.maxMP ?? 4.3;
  const longEdge = Math.max(bbox.w, bbox.h);

  let res = longEdge * Math.max(1.0, scale);
  res = Math.min(res, Math.sqrt(maxMP * 1e6));   // 面积上限（与后端同序）
  res = Math.max(min, Math.min(max, res));
  return Math.max(256, Math.round(res / 32) * 32);
}

export default InpaintPanel;
