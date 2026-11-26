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
import type {
  Asset, ImageProgressJob, InpaintMetaPayload,
} from '../api/types';
import { MaskEditor, type MaskIntensitySummary } from './MaskEditor';
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
  /** mask 的强度分布（前端自算，与后端 probeMaskIntensity 同判据） */
  const [maskIntensity, setMaskIntensity] = useState<MaskIntensitySummary | null>(null);
  /**
   * 分级重绘开关与档位。
   *
   * 放在面板而不是 MaskEditor 里：提交时要把它们一起发给后端，
   * 而提交逻辑在这里。放下面的话每次提交都要从子组件回捞状态。
   */
  const [graded, setGraded] = useState(false);
  const [gradedLevel, setGradedLevel] = useState('full');
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
      // 默认档位跟后端走（唯一真源），不在这里写死 'full'
      if (m?.gradedDefault) setGradedLevel((prev) => prev || m.gradedDefault);
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
      setMaskIntensity(null);
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
        /**
         * 分级：`graded=true` 时后端跳过 GrowMask、羽化只做边界、贴回先二值化。
         * 关掉时**不传这几个字段**，让缺省值（false）生效 ——
         * 显式传 `graded:false` 也行，但少发两个字段就少一份"被下游误读成 true"的风险。
         */
        ...(graded ? { graded: true, gradedLevel } : {}),
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
      toast.ok(
        `已提交（${mode === 'crop' ? '裁剪重绘' : '全图'} · ${r.strength}`
        + `${graded ? ` · 分级 ${r.gradedLevel?.label ?? gradedLevel}` : ''}）`,
      );
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
          graded={graded}
          onGradedChange={setGraded}
          levels={meta?.gradedLevels}
          level={gradedLevel}
          onLevelChange={setGradedLevel}
          onChange={(dataUrl, px, bb, inten) => {
            setMask(dataUrl);
            setStrokePixels(px);
            setBbox(bb);
            setMaskIntensity(inten ?? null);
          }}
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

        {/* 分级重绘：当前状态 + 与 strength 叠加的提醒 */}
        {graded ? (
          <div className="jz-xs" style={{ marginTop: 6, color: 'var(--jz-accent)' }}>
            本次按<b>分级</b>提交（档位「
            {meta?.gradedLevels?.find((l) => l.id === gradedLevel)?.label ?? gradedLevel}
            」，mask=
            {meta?.gradedLevels?.find((l) => l.id === gradedLevel)?.mask ?? '?'}）：
            后端会跳过 GrowMask、羽化只做边界、贴回权重先二值化。
            {strength !== 'full'
              ? ' ⚠️ 「改动强度」不是完全重绘：它砍全局步数、分级砍逐区域强度，两者会相乘衰减。'
              : ''}
          </div>
        ) : null}

        {/* 分级 mask 检测：后端会按像素自己判断，前端也先提示一遍 */}
        {!graded && maskIntensity?.graded ? (
          <div className="jz-xs" style={{ marginTop: 6, color: 'var(--jz-warn-text)' }}>
            这张 mask 里有 {(maskIntensity.gradedFraction * 100).toFixed(0)}% 的中间灰度，
            但分级模式没开 —— 灰度会被当成"选了/没选"两个值，强度信息丢失。
            建议回到上方打开「分级重绘」。
          </div>
        ) : null}

        {/* 可折叠的分级使用说明 */}
        <GradedDocs meta={meta} />

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

/**
 * 「分级重绘怎么用」—— 可折叠中文说明。
 *
 * 放在面板里而不是文档站，是因为**它回答的正是操作当下的疑问**：
 * "为什么我涂了但没效果"、"档位该选哪个"。用户在画布前不会跳去读 md。
 *
 * 内容里的数值全部来自实测（docs/research/00-总览.md §3.2），不是估算：
 * 1024² / full / 同一提示词下 mask 1.0 → 改动量 121.4/232、0.5 → 3.1/89、
 * 0.2 → 0.6/34。所以"0.5 以下没效果"是结论，不是保守说法。
 */
function GradedDocs({ meta }: { meta: InpaintMetaPayload | null }) {
  const [open, setOpen] = useState(false);
  const levels = meta?.gradedLevels ?? [];
  const collapse = meta?.gradedCollapseBelow ?? 0.5;

  return (
    <div style={{ marginTop: 10 }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} /> 分级重绘怎么用
      </Button>

      {open ? (
        <div
          className="jz-xs"
          style={{
            marginTop: 6, padding: '8px 10px', borderRadius: 'var(--jz-r-sm)',
            background: 'var(--jz-bg-sunken)', border: '1px solid var(--jz-border)',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>什么场景用分级</div>
          <div>
            一处改动里<b>有强有弱</b>的时候。典型三种：
            <br />
            ① <b>大范围调色但保留主体</b>——把整片背景压到 0.55 轻改，只把要换掉的
            那块设成 1.0；
            <br />
            ② <b>先框大范围再统一降强度</b>——先用大笔刷涂满一片，再用档位按钮
            「把选区设为 70%」，比一笔一笔控制力度快得多；
            <br />
            ③ <b>加"氛围级"细节</b>——想让光晕/雾气/雨丝只淡淡叠上去、不要盖掉原图，
            用 0.55–0.7。
            <br />
            只改一块、力度无所谓时，<b>别开分级</b>：普通涂抹的链路更短、更好预测。
          </div>

          <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>档位怎么选</div>
          <div>
            画笔的「强度」滑块涂出来多少，mask 里就是多少灰度，模型就按那个强度去噪。
            <b>档位是实测校准过的</b>，不是线性百分比：
            <table style={{ marginTop: 4, borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--jz-text-muted)' }}>
                  <th style={{ padding: '2px 8px 2px 0' }}>档位</th>
                  <th style={{ padding: '2px 8px 2px 0' }}>mask</th>
                  <th style={{ padding: '2px 8px 2px 0' }}>改动量（实测 mean/max）</th>
                  <th style={{ padding: '2px 0' }}>什么时候用</th>
                </tr>
              </thead>
              <tbody>
                {(levels.length ? levels : [
                  { id: 'full', mask: 1, label: '完全重绘', hint: '' },
                  { id: 'strong', mask: 0.85, label: '强', hint: '' },
                  { id: 'medium', mask: 0.7, label: '中', hint: '' },
                  { id: 'light', mask: 0.55, label: '轻', hint: '' },
                  { id: 'keep', mask: 0, label: '保留', hint: '' },
                ]).map((l) => (
                  <tr key={l.id}>
                    <td style={{ padding: '2px 8px 2px 0' }}>{l.label}</td>
                    <td style={{ padding: '2px 8px 2px 0' }} className="jz-mono">{l.mask}</td>
                    <td style={{ padding: '2px 8px 2px 0' }} className="jz-mono">
                      {l.mask >= 0.999 ? '121.4 / 232' : l.mask >= 0.8 ? '≈ 60 / 170'
                        : l.mask >= 0.65 ? '≈ 25 / 120' : l.mask >= 0.55 ? '≈ 8 / 95'
                          : '0 / 0（保留）'}
                    </td>
                    <td style={{ padding: '2px 0' }}>{l.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <span className="jz-muted">
              （0.85/0.7/0.55 三档的改动量是相邻实测点之间的插值估计，只用于判断"谁强谁弱"；
              1.0 与 0.5、0.2 是实测值。）
            </span>
          </div>

          <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>
            为什么 {collapse} 以下基本没效果
          </div>
          <div>
            H3-Image 是 <b>6 步 PDD 蒸馏</b>模型，每一步用一个预测头。
            mask 值决定该行的 sigma 落在哪个头的区间里 —— 而 <b>0.5 正好落在头与头的
            交界处</b>，模型那一块既没被"完全重绘"也没被"完全保留"，结果是<b>几乎不动</b>。
            <br />
            本机实测（1024²、full 模式、同一提示词）：
            <span className="jz-mono">
              {' '}mask 1.0 → 改动量 121.4/232；0.5 → 3.1/89；0.2 → 0.6/34。
            </span>
            <br />
            0.5 的改动量只有 1.0 的 <b>2.5%</b>，不是"一半"。所以可用区间是
            <b> 0.55–1.0</b>；想要更轻，请减少涂抹面积或提高档位后重绘，
            而不是把强度往下拖到 0.3。
          </div>

          <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>几个操作要点</div>
          <div>
            · <b>强度为 0 = 擦除</b>：滑块拖到 0 时落笔不会涂上任何强度（光标会变成
            禁止符号），这样"涂了没反应"不会被误解成 bug。
            <br />
            · <b>档位按钮会把已有选区整体改掉</b>：按住 Shift 点则是"按比例乘"，
            适合把已有渐变整体压暗一档。
            <br />
            · <b>撤销按整张 mask 回滚</b>：强度与形状一起回滚，不用担心撤不干净。
            <br />
            · <b>关掉分级不会丢笔画</b>：灰度仍留在 mask 里，只是链路按二值处理。
            <br />
            · <b>最小粒度约 32×32 像素</b>：模型按 2×2 latent patch 取最大值，
            比这更细的强度变化会被吃掉。
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 读图片真实像素尺寸（浏览器侧） */
function loadImageDims(url: string): Promise<{ w: number; h: number } | null> {  return new Promise((resolve) => {
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
