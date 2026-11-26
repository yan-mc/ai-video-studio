/**
 * 图像生成页 —— H3-Image 文生图 / 参考图编辑 / 批量 / LoRA。
 *
 * 模型能力决定 UI，不是反过来：
 *  - **6 步固定采样**：checkpoint 的 PDD 头网格（`pdd_sigmas`）写死在 safetensors
 *    元数据里，6 步 = 每步用一个头 = 训练态；4/12 步属于分布外。
 *    → 不给步数滑块，只显示**真实生效值**（配置覆盖过就一并说明）。
 *  - **guidance 1.0、无 CFG、无负面提示词**：`BasicGuider` 没有 negative 分支，
 *    写"不要 XX"反而会把 XX 拉进画面。→ 只给正向描述提示。
 *  - **参考图 = 编辑模式**：`image_1` 决定输出画布与编辑目标，最多 16 张。
 *    → 参考图区必须能"加图 + 排序 + 看第 1 张的语义"。
 *  - **DiT 拒绝 batch>1**：→ "出 N 张"拆成 N 个独立任务，UI 要说明这一点。
 *
 * ⚠️ 提交前的前端校验（提示词长度、32 倍数、面积上限）**不能省**：
 * 后端会拒，但用户已经等了一轮网络往返，且错误文案离输入框很远。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useProjectStore } from '../store';
import { api, uploadAsset, describeError } from '../api/client';
import type { ImageMetaPayload, ImageProgressJob } from '../api/types';
import { ImageLoraPicker, type ImageLoraChoice } from '../components/ImageLoraPicker';
import { InpaintPanel } from '../components/InpaintPanel';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Tabs, Textarea, useToast,
} from '../ui';

/** 已选参考图（`rel` 是 dataDir 相对路径，后端用它解析） */
interface PickedRef { rel: string; name: string }

/** 尺寸下拉里"自定义"的哨兵值 */
const CUSTOM_SIZE = '__custom__';
/** 画风参考图上限：多张不同风格会互相拉扯，1 张通常就够 */
const MAX_STYLE_ANCHORS = 2;

/** 页面模式：两条独立链路 */
type PageTab = 'generate' | 'inpaint';

export function ImagePage() {
  const toast = useToast();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const [tab, setTab] = useState<PageTab>('generate');

  const [meta, setMeta] = useState<ImageMetaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [prompt, setPrompt] = useState('');
  const [sizeId, setSizeId] = useState('auto');
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [seed, setSeed] = useState('');
  const [count, setCount] = useState(1);
  const [refs, setRefs] = useState<PickedRef[]>([]);
  /**
   * 画风参考图 —— 独立于 refs。
   * 语义是"照这个风格画"，不是"画这个内容"；后端会把它追加到参考图末尾，
   * 因此它永远不会占用 `image_1`（那会带偏画布尺寸 / 抢占被编辑对象）。
   */
  const [styleAnchors, setStyleAnchors] = useState<PickedRef[]>([]);
  const [styleMode, setStyleMode] = useState<'style-only' | 'style+palette'>('style-only');
  /** 画风 id（'none' = 不指定）。列表来自 /image/meta 的 promptCompiler.styles */
  const [styleIdSel, setStyleIdSel] = useState('none');
  /** 是否让后端编译提示词（中文/短句会被展开成完整英文描述） */
  const [compileOn, setCompileOn] = useState(true);
  const [loras, setLoras] = useState<ImageLoraChoice[]>([]);
  /** 最近一次提交返回的整组任务（批量时多个） */
  const [batch, setBatch] = useState<ImageProgressJob[]>([]);
  const [preview, setPreview] = useState('');
  const pollRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const styleFileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await api.imageMeta();
      setMeta(m);
      setErr('');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* -------------------------------------------------- 批量进度轮询 */
  useEffect(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (!batch.length) return;
    const ids = batch.map((j) => j.id);
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.imageProgress(ids);
        if (!alive) return;
        setBatch(r.jobs ?? []);
        // 全部终态就停止轮询（省掉无意义的 1.5s 请求）
        if ((r.jobs ?? []).every((j) => ['completed', 'failed', 'cancelled', 'interrupted', 'missing'].includes(j.status))) {
          if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* 轮询失败不改状态，下一轮重试 */ }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 1500);
    return () => { alive = false; if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } };
  }, [batch.length ? batch[0].id : '']); // eslint-disable-line react-hooks/exhaustive-deps

  /* -------------------------------------------------- 参考图：上传 / 增删 / 排序 */
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) { toast.error('只支持图片文件'); return; }
    const cap = meta?.effective?.maxRefImages ?? 16;
    if (refs.length + list.length > cap) {
      toast.error(`参考图最多 ${cap} 张（当前 ${refs.length} 张，还要加 ${list.length} 张）`);
      return;
    }
    for (const f of list) {
      try {
        /**
         * 走素材库上传（`/assets/upload`）而不是内联 dataURL：
         *   1) dataURL 会被塞进 job.params 落盘，jobs.json 会膨胀（一张 4MB 图 = 5MB base64）；
         *   2) 素材库上传后 `rel` 可以复用（下次直接从素材库挑，不用重传）。
         */
        const r = await uploadAsset(f, { type: 'general', name: f.name, projectId: currentProjectId ?? undefined });
        const saved = r.saved?.[0];
        if (saved?.rel) setRefs((prev) => [...prev, { rel: saved.rel, name: saved.name || f.name }]);
        else toast.error(`${f.name}: 上传成功但没拿到路径`);
      } catch (e) {
        toast.error(`${f.name}: ${describeError(e)}`);
      }
    }
  }, [currentProjectId, meta?.effective?.maxRefImages, refs.length, toast]);

  const moveRef = useCallback((i: number, dir: -1 | 1) => {
    setRefs((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const removeRef = useCallback((i: number) => {
    setRefs((prev) => prev.filter((_, k) => k !== i));
  }, []);

  /* -------------------------------------------------- 画风参考图（独立通道） */
  /**
   * 画风锚与普通参考图**分开管理**，原因：
   *   · `image_1` 决定输出画布、并且是被编辑的原图 —— 画风图绝不能排到第 1 位
   *   · 两者的语义也不同：参考图是"要画什么"，画风锚是"画成什么样"
   * 后端会把画风锚统一追加在参考图末尾（见 ref-images.js 的 appendStyleAnchors）。
   */
  const addStyleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) { toast.error('只支持图片文件'); return; }
    if (styleAnchors.length + list.length > MAX_STYLE_ANCHORS) {
      toast.error(
        `画风参考图最多 ${MAX_STYLE_ANCHORS} 张（多张不同风格会互相拉扯，产出"既不 A 也不 B"的混合体）`,
      );
      return;
    }
    for (const f of list) {
      try {
        const r = await uploadAsset(f, { type: 'general', name: f.name, projectId: currentProjectId ?? undefined });
        const saved = r.saved?.[0];
        if (saved?.rel) setStyleAnchors((prev) => [...prev, { rel: saved.rel, name: saved.name || f.name }]);
        else toast.error(`${f.name}: 上传成功但没拿到路径`);
      } catch (e) {
        toast.error(`${f.name}: ${describeError(e)}`);
      }
    }
  }, [currentProjectId, styleAnchors.length, toast]);

  /* -------------------------------------------------- 提交 */
  async function handleGenerate() {
    if (!prompt.trim()) { toast.error('请写提示词'); return; }
    if (!meta?.status?.ready) { toast.error('模型未就绪，请先完成下载'); return; }

    const custom = sizeId === CUSTOM_SIZE;
    const w = Number(customW);
    const h = Number(customH);
    if (custom) {
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        toast.error('自定义尺寸要同时填宽和高'); return;
      }
      if (w % 32 !== 0 || h % 32 !== 0) {
        toast.error('宽高必须是 32 的倍数（例如 1792 / 2368）'); return;
      }
      const mp = (w * h) / 1e6;
      const cap = meta?.effective?.maxMP ?? 4.3;
      if (mp > cap + 1e-6) {
        toast.error(`${w}×${h} ≈ ${mp.toFixed(2)}MP，超过面积上限 ${cap}MP`); return;
      }
    }

    setBusy(true);
    try {
      const r = await api.imageGenerate({
        prompt,
        ...(custom ? { width: w, height: h } : { sizeId }),
        ...(seed.trim() ? { seed: Number(seed) } : {}),
        ...(count > 1 ? { count } : {}),
        ...(refs.length ? { refImages: refs.map((x) => x.rel) } : {}),
        // 画风锚走独立字段，后端追加到参考图末尾（永不占用 image_1）
        ...(styleAnchors.length ? { styleAnchorImages: styleAnchors.map((x) => x.rel) } : {}),
        ...(styleIdSel !== 'none' ? { styleId: styleIdSel } : {}),
        ...(compileOn ? {} : { compile: false }),
        ...(styleAnchors.length ? { styleAnchorMode: styleMode } : {}),
        ...(loras.length ? { loras: loras.map((l) => ({ name: l.name, ...(l.strength != null ? { strength: l.strength } : {}) })) } : {}),
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
      });
      // 用 /image/progress 拿整组初始状态（它回的形状与轮询一致，避免两套类型）
      const ids = r.jobIds?.length ? r.jobIds : [r.id];
      const init = await api.imageProgress(ids).catch(() => null);
      setBatch(init?.jobs ?? ids.map((id) => ({ id, status: 'queued' })));
      if (r.warnings?.length) r.warnings.slice(0, 3).forEach((w2) => toast.error(w2));
      toast.ok(
        r.count && r.count > 1
          ? `已提交 ${r.count} 个任务（同 prompt 不同种子）`
          : `已提交任务 ${r.id.slice(0, 12)}…`,
      );
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(meta?.status?.ready);
  const maxChars = meta?.effective?.promptMaxChars ?? 4096;
  const maxRefs = meta?.effective?.maxRefImages ?? 16;
  const maxBatch = meta?.effective?.maxBatch ?? 4;
  const overLimit = prompt.length > maxChars;
  const curSize = meta?.sizes?.find((s) => s.id === sizeId);
  const doneJobs = batch.filter((j) => j.status === 'completed');
  const runningJob = batch.find((j) => j.status === 'running' || j.status === 'queued');

  if (loading) return <Page title="图像生成"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="图像生成"
      subtitle={
        meta?.effective?.stepsOverridden
          ? `MiniMax H3-Image · ${meta.effective.steps} 步（配置覆盖，声明值 ${meta.effective.declaredSteps}）`
          : 'MiniMax H3-Image · 6 步 PDD 蒸馏采样 · 文生图 / 参考图编辑 / 局部重绘'
      }
      actions={
        tab === 'generate' ? (
          <>
            <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
            <Button variant="primary" icon={<Icon name="image" size={15} />} onClick={() => void handleGenerate()} disabled={busy || !ready || overLimit}>
              {busy ? '提交中…' : count > 1 ? `生成 ${count} 张` : '生成'}
            </Button>
          </>
        ) : null
      }
    >
      {/**
       * 两个 tab 是**两条独立链路**，不是同一表单的两个选项：
       *   generate  文生图 / 参考图编辑（conditioning 的 zeros latent）
       *   inpaint   局部重绘（VAEEncode 的源图 latent + noise_mask）
       * 拆成 tab 而不是并排放，是为了避免"把 mask 误当参考图提交"这类混淆。
       */}
      <div style={{ marginBottom: 'var(--jz-sp-3)' }}>
        <Tabs<PageTab>
          items={[
            { value: 'generate', label: '文生图 / 参考图编辑' },
            { value: 'inpaint', label: '局部重绘' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="图像生成模式"
        />
      </div>

      {/**
       * 两个面板**都常驻挂载**，只切换可见性（`hidden` + display:none）。
       *
       * 条件渲染（`tab === 'inpaint' ? <InpaintPanel/> : null`）会让切 tab 时的
       * 卸载把 InpaintPanel 的源图 / mask / 提示词 / 正在轮询的 job 全部丢掉 ——
       * 用户涂了五分钟的选区，只是想看一眼出图参数就没了；任务在跑时连结果
       * 都找不回来（轮询 effect 随组件卸载）。
       *
       * 保留 DOM 还有个副作用是好事：MaskEditor 的三层 canvas 像素不会丢，
       * 切回来不需要重新加载底图。
       */}
      <div hidden={tab !== 'inpaint'} style={{ display: tab === 'inpaint' ? undefined : 'none' }}>
        <InpaintPanel />
      </div>

      <div
        hidden={tab !== 'generate'}
        className="jz-col"
        style={{ gap: 'var(--jz-sp-4)', display: tab === 'generate' ? undefined : 'none' }}
      >
        {err ? <Alert tone="danger">{err}</Alert> : null}

        {/* 模型状态 */}
        <Panel title="模型状态">
          <div className="jz-col" style={{ gap: 8 }}>
            <div className="jz-row jz-wrap" style={{ gap: 8 }}>
              <Badge tone={ready ? 'ok' : 'danger'}>{ready ? '模型就绪' : '模型缺失'}</Badge>
              {meta?.status?.unet ? <Badge>{meta.status.unet.replace('.safetensors', '')}</Badge> : null}
              <Badge>{meta?.effective?.steps} 步{meta?.effective?.stepsOverridden ? '（已覆盖）' : ''}</Badge>
              <Badge>guidance {meta?.sampling?.guidance}</Badge>
              <Badge>无 CFG · 无负面提示词</Badge>
              <Badge>面积上限 {meta?.effective?.maxMP} MP</Badge>
            </div>
            {!ready ? (
              <>
                <Alert tone="warn">缺少文件：{meta?.status?.missing?.join('、')}</Alert>
                <div className="jz-xs jz-muted jz-mono">模型根目录：{meta?.status?.root}</div>
              </>
            ) : null}
            <div className="jz-xs jz-muted">
              采样参数由 checkpoint 的 PDD 头网格决定（<b>不可调</b>）：6 步正好每步用一个预测头。
              该模型<b>不支持负面提示词</b>（采样器没有 negative 分支），请用正向描述。
            </div>
          </div>
        </Panel>

        {/* 参考图 */}
        <Panel
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              参考图
              <Badge tone={refs.length ? 'accent' : 'default'}>{refs.length}/{maxRefs}</Badge>
              {refs.length ? <Badge tone="ok">编辑模式</Badge> : <Badge>文生图</Badge>}
            </span>
          }
          actions={
            <>
              <Button variant="ghost" icon={<Icon name="upload" size={15} />} onClick={() => fileRef.current?.click()}>
                上传
              </Button>
              {refs.length ? <Button variant="ghost" onClick={() => setRefs([])}>清空</Button> : null}
            </>
          }
          tight
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files;
              if (f?.length) void addFiles(f);
              e.target.value = '';           // 允许重复选同一个文件
            }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
            style={{
              border: '1px dashed var(--jz-border)',
              borderRadius: 'var(--jz-r-sm)',
              padding: refs.length ? 8 : 18,
              textAlign: refs.length ? 'left' : 'center',
              background: 'var(--jz-bg-sunken)',
            }}
          >
            {refs.length === 0 ? (
              <div className="jz-sm jz-muted">
                拖入图片，或点右上「上传」。<br />
                <span className="jz-xs">
                  接图即进入<b>编辑模式</b>：<b>第 1 张是被编辑的原图</b>（决定输出画布尺寸与编辑目标），
                  其余作为参考。最多 {maxRefs} 张。
                </span>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {refs.map((r, i) => (
                  <div
                    key={`${r.rel}-${i}`}
                    className="jz-row"
                    style={{
                      gap: 8, alignItems: 'center', padding: '4px 6px',
                      border: `1px solid ${i === 0 ? 'var(--jz-accent)' : 'var(--jz-border)'}`,
                      borderRadius: 'var(--jz-r-sm)',
                      background: i === 0 ? 'var(--jz-accent-soft)' : 'transparent',
                    }}
                  >
                    <span className="jz-mono jz-xs" style={{ color: 'var(--jz-accent)', minWidth: 22 }}>#{i + 1}</span>
                    {i === 0 ? <Badge tone="accent">编辑目标</Badge> : null}
                    <img
                      src={`/jiuzhang/api/file?path=${encodeURIComponent(r.rel)}`}
                      alt={r.name}
                      style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, background: 'var(--jz-bg-sunken)' }}
                    />
                    <span className="jz-xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </span>
                    <span className="jz-xs jz-muted">可用 &lt;Picture {i + 1}&gt; 引用</span>
                    <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => moveRef(i, -1)}>↑</Button>
                    <Button variant="ghost" size="sm" disabled={i === refs.length - 1} onClick={() => moveRef(i, 1)}>↓</Button>
                    <Button variant="ghost" size="sm" onClick={() => removeRef(i)}><Icon name="trash" size={13} /></Button>
                  </div>
                ))}
                <div className="jz-xs jz-muted">
                  顺序即语义：第 1 张决定输出画布与"编辑谁"。用 ↑↓ 调整，别指望排序下拉。
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* 提示词 */}
        <Panel title="提示词">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            placeholder={`详细描述画面（最长 ${maxChars} 字符，越长越准；超长会被拒绝而不是截断）。\n\n有参考图时：不必用文字复述图里的长相/服装 —— 模型看得见；只写"要改什么"和对画面的要求。\n纯文生图时：主体外观 + 场景 + 动作 + 镜头 + 风格，缺一样就容易随机抽卡。`}
          />
          <div className="jz-row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span className="jz-xs" style={{ color: overLimit ? 'var(--jz-danger)' : undefined }}>
              {prompt.length} / {maxChars} 字符
            </span>
            {overLimit
              ? <Badge tone="danger">超长 {prompt.length - maxChars} 字符 — 提交会被拒绝</Badge>
              : prompt.length > maxChars * 0.9
                ? <Badge tone="warn">接近上限</Badge>
                : null}
          </div>
          {refs.length ? (
            <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>
              {refs.length > 1 ? `可用 <Picture 1> … <Picture ${refs.length}> 引用参考图。` : '可用 <Picture 1> 引用参考图。'}
              {' '}建议写法：<code className="jz-mono">Edit &lt;Picture 1&gt;: change the dress to red silk.</code>
            </div>
          ) : null}
        </Panel>

        {/* 画风参考图 —— 独立通道，与上面的「参考图」语义不同 */}
        <Panel
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              画风参考图
              <Badge tone={styleAnchors.length ? 'accent' : 'default'}>
                {styleAnchors.length}/{MAX_STYLE_ANCHORS}
              </Badge>
              {styleAnchors.length ? <Badge tone="ok">已启用</Badge> : null}
            </span>
          }
          actions={
            <>
              <Button variant="ghost" icon={<Icon name="upload" size={15} />} onClick={() => styleFileRef.current?.click()}>
                上传画风图
              </Button>
              {styleAnchors.length ? <Button variant="ghost" onClick={() => setStyleAnchors([])}>清空</Button> : null}
            </>
          }
          tight
        >
          <input
            ref={styleFileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files;
              if (f?.length) void addStyleFiles(f);
              e.target.value = '';
            }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) void addStyleFiles(e.dataTransfer.files);
            }}
            style={{
              border: '1px dashed var(--jz-border)',
              borderRadius: 'var(--jz-r-sm)',
              padding: styleAnchors.length ? 8 : 14,
              background: 'var(--jz-bg-sunken)',
            }}
          >
            {styleAnchors.length === 0 ? (
              <div className="jz-sm jz-muted">
                想让画面是某种画风？<b>传一张已经是那个风格的图</b>，比写一百个风格词都管用。
                <div className="jz-xs" style={{ marginTop: 4 }}>
                  这里传的是「画成什么样」，不是「画什么内容」——
                  它不会占 <code className="jz-mono">image_1</code>，因此不会影响输出画布或被编辑对象。
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {styleAnchors.map((r, i) => (
                  <div
                    key={`${r.rel}-${i}`}
                    className="jz-row"
                    style={{
                      gap: 8, alignItems: 'center', padding: '4px 6px',
                      border: '1px solid var(--jz-accent)', borderRadius: 'var(--jz-r-sm)',
                      background: 'var(--jz-accent-soft)',
                    }}
                  >
                    <Icon name="palette" size={14} />
                    <span className="jz-xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </span>
                    <span className="jz-mono jz-xs jz-muted">
                      将追加为参考图末尾
                    </span>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setStyleAnchors((prev) => prev.filter((_, k) => k !== i))}
                    >
                      移除
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <Field label="借用什么">
              <Select<'style-only' | 'style+palette'>
                value={styleMode}
                onChange={setStyleMode}
                options={[
                  { value: 'style-only', label: '只借画法与质感（推荐）' },
                  { value: 'style+palette', label: '画法 + 配色' },
                ]}
              />
            </Field>
          </div>

          {/* 画风预设 —— 与「参考图」正交：这里是画法，参考图是内容 */}
          <div style={{ marginTop: 8, display: 'grid', gap: 'var(--jz-sp-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Field label="画风预设">
              <Select<string>
                value={styleIdSel}
                onChange={setStyleIdSel}
                options={(meta?.promptCompiler?.styles ?? [{ id: 'none', name: '不指定画风', category: '—' }]).map((s) => ({
                  value: s.id,
                  label: s.id === 'none' ? s.name : `${s.name} · ${s.category}`,
                }))}
              />
            </Field>
            <Field label="提示词编译">
              <Select<'on' | 'off'>
                value={compileOn ? 'on' : 'off'}
                onChange={(v) => setCompileOn(v === 'on')}
                options={[
                  { value: 'on', label: '开启（中文/短句自动展开成英文描述）' },
                  { value: 'off', label: '关闭（按原文提交，排障用）' },
                ]}
              />
            </Field>
          </div>

          {styleIdSel !== 'none' ? (
            <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
              {(() => {
                const row = (meta?.promptCompiler?.anti3d ?? []).find((x) => x.id === styleIdSel);
                if (!row) return null;
                return row.anti3d
                  ? '该画风属于 2D 类，提交时会自动补上反 3D 约束（H3-Image 的底座在 2D 题材上天然偏 3D）。'
                  : '该画风自带 3D / 写实打底，不会追加反 3D 约束（避免与画风本身打架）。';
              })()}
            </div>
          ) : null}

          {styleAnchors.length ? (
            <div style={{ marginTop: 8 }}><Alert tone="info">
              <div className="jz-xs">
                <b>提示词该怎么写</b>：画风锚会说明「只借画法、不复制主体」，但你仍要在提示词里
                <b>写清自己要画什么</b>。例如：
                <div className="jz-mono" style={{ marginTop: 4, lineHeight: 1.6 }}>
                  a young woman reading by a window, soft afternoon light, 35mm photo,
                  matching the rendering style of &lt;Picture {refs.length + 1}&gt; but with different subject and composition
                </div>
                <div style={{ marginTop: 4 }}>
                  ⚠️ 最容易犯的错：只写「画成这张图的风格」，模型会把参考图的
                  <b>人和物一起搬过来</b>。务必写明主体可不同、构图可不同。
                </div>
              </div>
            </Alert></div>
          ) : null}
        </Panel>

        {/* 输出设置 */}
        <Panel title="输出设置">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--jz-sp-3)' }}>
            <Field label="尺寸">
              <Select<string>
                value={sizeId}
                onChange={setSizeId}
                options={[
                  ...(meta?.sizes ?? []).map((s) => ({
                    value: s.id,
                    label: `${s.name}${s.w ? ` · ${s.w}×${s.h}` : ''}`,
                  })),
                  { value: CUSTOM_SIZE, label: '自定义宽高（32 的倍数）' },
                ]}
              />
            </Field>
            {sizeId === CUSTOM_SIZE ? (
              <>
                <Field label="宽">
                  <Input value={customW} onChange={(e) => setCustomW(e.target.value)} mono placeholder="1792" />
                </Field>
                <Field label="高">
                  <Input value={customH} onChange={(e) => setCustomH(e.target.value)} mono placeholder="2368" />
                </Field>
              </>
            ) : null}
            <Field label="种子（留空随机）">
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} mono placeholder="留空 = 每次不同" />
            </Field>
            <Field label={`出几张（1-${maxBatch}）`}>
              <Select<string>
                value={String(count)}
                onChange={(v) => setCount(Number(v))}
                options={Array.from({ length: maxBatch }, (_, i) => ({
                  value: String(i + 1),
                  label: i === 0 ? '1 张' : `${i + 1} 张（拆成 ${i + 1} 个任务）`,
                }))}
              />
            </Field>
          </div>
          <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
            {sizeId === CUSTOM_SIZE
              ? '宽高必须是 32 的倍数 —— 节点按 16 取 latent 再按 2×2 打块，非 32 倍数会被补边，实际尺寸与请求不符。'
              : curSize && curSize.w === 0
                ? refs.length
                  ? '自动 + 有参考图：节点会用第 1 张参考图「缩放后」的尺寸决定画布（短边约 1024–2048）。想锁定尺寸请在上面选具体档位或填自定义宽高。'
                  : '自动 + 无参考图：输出 2048×2048。'
                : curSize ? `输出 ${curSize.w}×${curSize.h}（约 ${curSize.mp} MP）` : null}
          </div>
          {count > 1 ? (
            <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>
              H3-Image 的 DiT <b>不支持 batch &gt; 1</b>（模型内部硬性拒绝），
              所以"出 {count} 张"是拆成 {count} 个独立任务、种子按 +1 递增 —— 不是一次采样出 {count} 张。
            </div>
          ) : null}
        </Panel>

        {/* LoRA */}
        <ImageLoraPicker value={loras} onChange={setLoras} hasRefImages={refs.length > 0} maxSlots={meta?.effective?.maxLoras ?? 6} />

        {/**
         * ⚠️ 性能说明：数字来自真机对照实测，不是估算。
         *
         * w4a8 / 768² / 6 步 / 1 条 LoRA / 队列独占：
         *   无 LoRA                          69.2 秒   基准
         *   LoraLoaderModelOnly（改权重）    123.8 秒  ×1.79
         *   LoraLoaderBypassModelOnly        87.8 秒   ×1.27
         *
         * 改权重式会每层反量化→加权→随机重量化（416 张量 × 50 层 × 6 步），
         * 随机重量化还会让脸/头发/线稿发糊 —— 所以后端默认走 bypass 前向注入。
         * bypass **不是免费**（仍有钩子开销，×1.27 而非 ×1.0），不要承诺"不影响速度"。
         */}
        {loras.length ? (
          <Alert tone="info">
            挂了 {loras.length} 条 LoRA，走 <b>bypass 前向注入</b>（不动量化权重）。
            实测 768² 出图：无 LoRA 约 69 秒，1 条 LoRA 约 88 秒 —— 有开销但不反量化，
            画质也不会被随机重量化弄糊。若 ComfyUI 缺 bypass 节点会回退到改权重模式
            （约 124 秒且可能糊），届时后端会在任务 warnings 里说明。
          </Alert>
        ) : null}

        {/* 任务进度 / 结果 */}
        <Panel title={`本次任务（${batch.length}）`} tight>
          {batch.length === 0 ? (
            <div className="jz-sm jz-muted">还没有提交过任务。</div>
          ) : (
            <div className="jz-col" style={{ gap: 8 }}>
              {runningJob ? (
                <div className="jz-col" style={{ gap: 4 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                    <span className="jz-xs jz-muted">
                      {runningJob.progress?.note
                        ?? (runningJob.status === 'queued' ? '排队中' : '生成中')}
                    </span>
                    <span className="jz-xs jz-mono">{runningJob.progress?.pct ?? 5}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--jz-bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(2, Math.min(100, runningJob.progress?.pct ?? 5))}%`,
                        height: '100%',
                        background: 'var(--jz-accent)',
                        transition: 'width .4s ease',
                      }}
                    />
                  </div>
                  <div className="jz-xs jz-muted">
                    单张 4.2MP 实测约 148 秒；进度来自 ComfyUI 队列，只到"生成中 / 取回产物"两级。
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {batch.map((j) => {
                  const out = j.outputs?.[0];
                  const u = outUrl(out);
                  const st = jobStatusView(j.status);
                  return (
                    <div key={j.id} className="jz-card" style={{ padding: 8 }}>
                      <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                        <code className="jz-mono jz-xs">{j.id.slice(-8)}</code>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      {j.params?.batchSize && j.params.batchSize > 1 ? (
                        <div className="jz-xs jz-muted">#{j.params.batchIndex}/{j.params.batchSize} · seed {j.params.seed}</div>
                      ) : j.params?.seed ? (
                        <div className="jz-xs jz-muted">seed {j.params.seed}</div>
                      ) : null}
                      {u ? (
                        <button
                          type="button"
                          onClick={() => setPreview(u)}
                          style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                        >
                          <img
                            src={u}
                            alt="生成结果"
                            style={{ width: '100%', borderRadius: 4, background: 'var(--jz-bg-sunken)', aspectRatio: '1', objectFit: 'contain' }}
                          />
                        </button>
                      ) : (
                        <div style={{ height: 96, borderRadius: 4, background: 'var(--jz-bg-sunken)', display: 'grid', placeItems: 'center' }}>
                          <span className="jz-xs jz-muted">{st.label}</span>
                        </div>
                      )}
                      {j.error ? (
                        <div className="jz-xs" style={{ color: 'var(--jz-danger)', marginTop: 4 }}>{j.error}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {doneJobs.length ? (
                <div className="jz-row" style={{ gap: 8 }}>
                  <Button
                    variant="ghost"
                    icon={<Icon name="download" size={15} />}
                    onClick={() => {
                      doneJobs.forEach((j, i) => {
                        const u = outUrl(j.outputs?.[0]);
                        if (!u) return;
                        window.setTimeout(() => {
                          const a = document.createElement('a');
                          a.href = u;
                          a.download = `${j.id.slice(-8)}.png`;
                          a.click();
                        }, i * 250);
                      });
                    }}
                  >
                    下载全部（{doneJobs.length}）
                  </Button>
                  <span className="jz-xs jz-muted">产物同时已自动归档进素材库</span>
                </div>
              ) : null}
            </div>
          )}
        </Panel>

        {preview ? (
          <Panel title="预览" actions={<Button variant="ghost" onClick={() => setPreview('')}>关闭</Button>}>
            <img src={preview} alt="生成结果" style={{ maxWidth: '100%', borderRadius: 6 }} />
            <div className="jz-row" style={{ marginTop: 8, gap: 8 }}>
              <Button
                icon={<Icon name="swap" size={15} />}
                onClick={() => {
                  /**
                   * 继续编辑：把这张图填回参考图第 1 位。
                   *
                   * H3-Image 最爽的用法是"出图 → 改图 → 再出图"的迭代环，
                   * 但没有这个按钮时，用户必须自己下载再上传，环就断了。
                   */
                  const rel = preview.replace('/jiuzhang/api/file?path=', '');
                  let decoded = rel;
                  try { decoded = decodeURIComponent(rel); } catch { /* 保持原样 */ }
                  setRefs((prev) => [{ rel: decoded, name: '上一步产物' }, ...prev].slice(0, maxRefs));
                  toast.ok('已填回参考图第 1 位（可继续编辑）');
                }}
              >
                继续编辑这张
              </Button>
            </div>
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

/** 产物地址（兼容 rel / path 两种历史形态） */
function outUrl(out?: { rel?: string | null; archivedRel?: string | null }): string {
  if (!out) return '';
  if (out.rel) return `/jiuzhang/api/file?path=${encodeURIComponent(out.rel)}`;
  if (out.archivedRel) return `/jiuzhang/api/file?path=${encodeURIComponent(out.archivedRel)}`;
  return '';
}

function jobStatusView(status: string): { label: string; tone: 'ok' | 'danger' | 'warn' | 'default' } {
  switch (status) {
    case 'completed': return { label: '完成', tone: 'ok' };
    case 'failed': return { label: '失败', tone: 'danger' };
    case 'cancelled': return { label: '已取消', tone: 'warn' };
    case 'interrupted': return { label: '已中断', tone: 'warn' };
    case 'running': return { label: '生成中', tone: 'warn' };
    case 'queued': return { label: '排队', tone: 'warn' };
    case 'missing': return { label: '记录丢失', tone: 'danger' };
    default: return { label: status, tone: 'default' };
  }
}

export default ImagePage;