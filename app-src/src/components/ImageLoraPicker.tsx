/**
 * H3-Image LoRA 选择器 —— 按**功能分类**选，而不是给一串文件名让人瞎猜。
 *
 * ============================================================================
 * 与视频版 `LoraPicker` 的关系
 * ============================================================================
 *
 * 结构几乎一样，但**刻意不复用同一个组件**：
 *   · 视频那套有 11 个轴（含加速蒸馏 / 运镜 / 音色），图像上这 4 个轴不存在；
 *   · 视频的求解器会做「加速学生钉死槽 1」这类图像没有的逻辑。
 * 用同一个组件 + 传不同分类，会让"这个轴为什么没有"变成运行时问题；
 * 拆成两个组件、各自读各自的 `/…/lora/catalog` 更直白。
 *
 * 共同点：**前端不重复实现约束规则** —— 每次选择变化都调后端 `imageLoraSolve`，
 * 面板只负责展示"哪条会被替换 / 衰减 / 剔除"。
 *
 * ============================================================================
 * 为什么不做"多选下拉"
 * ============================================================================
 *
 * 图像 LoRA 的冲突模式与视频不同但同样真实：
 *   · 两个画风 → 风格互相拉扯，出"既不 A 也不 B"的混合体
 *   · 两个角色 → 同一张脸被两个身份先验争夺 → 面部崩坏
 *   · 画风 × 角色 → 风格把脸往风格方向拉（有参考图时尤其明显）
 *   · 总强度 >1.5 → 链式叠加是加法，画面过曝、边缘光晕
 *
 * 不做这层约束的后果不是报错，而是"能出图但不对"。
 *
 * @module components/ImageLoraPicker
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, describeError } from '../api/client';
import type { ImageLoraCatalogPayload, ImageLoraItem, ImageLoraSolvePayload, LoraCategory } from '../api/types';
import { Alert, Badge, Button, Panel, Select, Spinner, useToast } from '../ui';

/** 用户选中的一条（`strength` 为 null 表示"用该类默认值"） */
export interface ImageLoraChoice {
  name: string;
  strength?: number;
}

export interface ImageLoraPickerProps {
  value: ImageLoraChoice[];
  onChange: (next: ImageLoraChoice[]) => void;
  /** 是否已有参考图（影响"画风 × 角色 / 角色 × 参考图"的冲突提示） */
  hasRefImages?: boolean;
  /** 最多几条（与后端 IMAGE_MAX_LORAS 一致） */
  maxSlots?: number;
}

export function ImageLoraPicker({ value, onChange, hasRefImages = false, maxSlots = 6 }: ImageLoraPickerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<LoraCategory[]>([]);
  const [items, setItems] = useState<ImageLoraItem[]>([]);
  const [probed, setProbed] = useState(true);
  const [probeError, setProbeError] = useState('');
  const [hint, setHint] = useState('');
  const [solved, setSolved] = useState<ImageLoraSolvePayload | null>(null);
  /** 求解失败原因。空串 = 正常。失败不能渲染成"没选 LoRA"的空态。 */
  const [solveErr, setSolveErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.imageLoraCatalog() as ImageLoraCatalogPayload;
      setCategories(r.categories ?? []);
      setItems(r.items ?? []);
      setProbed(Boolean(r.probed));
      setProbeError(r.probeError ?? '');
      setHint(r.hint ?? '');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** 每次选择变化都让后端跑一遍约束求解 —— 前端不重复实现规则 */
  useEffect(() => {
    let alive = true;
    if (!value.length) { setSolved(null); setSolveErr(''); return () => { alive = false; }; }
    void (async () => {
      try {
        const r = await api.imageLoraSolve(
          value.map((v) => ({ name: v.name, ...(v.strength != null ? { strength: v.strength } : {}) })),
          { hasRefImages },
        );
        if (alive) { setSolved(r); setSolveErr(''); }
      } catch (e) {
        // ⚠️ 失败时只 setSolved(null) 会渲染成"没选任何 LoRA" —— 用户以为选择丢了
        if (alive) { setSolved(null); setSolveErr(describeError(e)); }
      }
    })();
    return () => { alive = false; };
  }, [value, hasRefImages]);

  const selected = useMemo(() => new Set(value.map((v) => v.name)), [value]);

  const byCategory = useMemo(() => {
    const m = new Map<string, ImageLoraItem[]>();
    for (const it of items) {
      if (!m.has(it.categoryId)) m.set(it.categoryId, []);
      m.get(it.categoryId)!.push(it);
    }
    return m;
  }, [items]);

  const pickOf = useCallback(
    (catId: string): ImageLoraItem | undefined => items.find((i) => i.categoryId === catId && selected.has(i.name)),
    [items, selected],
  );

  const setStrength = useCallback((name: string, strength: number) => {
    onChange(value.map((v) => (v.name === name ? { ...v, strength } : v)));
  }, [value, onChange]);

  const handlePick = useCallback((cat: LoraCategory, item: ImageLoraItem | null) => {
    let next = value;
    if (cat.mode === 'single') {
      const sameCat = new Set(items.filter((i) => i.categoryId === cat.id).map((i) => i.name));
      next = next.filter((v) => !sameCat.has(v.name));
    }
    if (item) {
      if (next.some((v) => v.name === item.name)) return;
      if (next.length >= maxSlots) { toast.error(`最多 ${maxSlots} 条 LoRA`); return; }
      next = [...next, { name: item.name }];
    }
    onChange(next);
  }, [items, maxSlots, onChange, toast, value]);

  if (loading) {
    return <Panel title="LoRA"><div className="jz-row" style={{ gap: 8 }}><Spinner /> 载入中…</div></Panel>;
  }

  if (error) {
    return (
      <Panel title="LoRA">
        <Alert tone="danger">{error}</Alert>
        <Button variant="ghost" onClick={() => void load()}>重试</Button>
      </Panel>
    );
  }

  /** ComfyUI 不可达 ≠ 一个都没装 —— 必须区分，否则用户会去翻目录找"丢了的 LoRA" */
  if (!probed) {
    return (
      <Panel title="LoRA">
        <Alert tone="warn">
          没探测到 ComfyUI 的 LoRA 列表{probeError ? `（${probeError}）` : ''}。
          这**不代表**一个都没装 —— 请先启动 ComfyUI 再刷新。
        </Alert>
        <Button variant="ghost" onClick={() => void load()}>刷新</Button>
      </Panel>
    );
  }

  const showLora = (cat: LoraCategory) => {
    const list = byCategory.get(cat.id) ?? [];
    const cur = pickOf(cat.id);
    if (!list.length) {
      return (
        <div key={cat.id} className="jz-xs jz-muted" style={{ paddingLeft: 4 }}>
          <b>{cat.label}</b>（0 个）· 目录 <code className="jz-mono">{cat.folder}</code>
        </div>
      );
    }
    return (
      <div key={cat.id} style={{ display: 'grid', gap: 4 }}>
        <div className="jz-row" style={{ gap: 6, alignItems: 'baseline' }}>
          <b className="jz-sm">{cat.label}</b>
          <Badge tone={cat.mode === 'single' ? 'warn' : 'default'}>
            {cat.mode === 'single' ? '单选' : '可多挂'}
          </Badge>
          <span className="jz-xs jz-muted">{list.length} 个</span>
        </div>
        <Select<string>
          value={cur?.name ?? ''}
          onChange={(v) => handlePick(cat, v ? (list.find((i) => i.name === v) ?? null) : null)}
          options={[
            { value: '', label: '（不挂）' },
            ...list.map((i) => ({ value: i.name, label: i.base.replace('.safetensors', '') })),
          ]}
        />
        {cur ? (
          <div className="jz-row" style={{ gap: 6, alignItems: 'center', paddingLeft: 4 }}>
            <span className="jz-xs jz-muted">强度</span>
            <input
              type="range"
              min={cat.strength.min}
              max={cat.strength.max}
              step={cat.strength.step}
              value={value.find((v) => v.name === cur.name)?.strength ?? (cat.signed ? (cat.defaultOnSelect ?? 0) : cat.strength.def)}
              onChange={(e) => setStrength(cur.name, Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="jz-mono jz-xs" style={{ minWidth: 44, textAlign: 'right' }}>
              {(value.find((v) => v.name === cur.name)?.strength ?? (cat.signed ? (cat.defaultOnSelect ?? 0) : cat.strength.def)).toFixed(2)}
            </span>
          </div>
        ) : null}
        <div className="jz-xs jz-muted" style={{ paddingLeft: 4 }}>{cat.why}</div>
      </div>
    );
  };

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          LoRA
          <Badge tone={value.length ? 'accent' : 'default'}>{value.length}/{maxSlots}</Badge>
          {solved ? <Badge tone={solved.totalStrength > 1.5 ? 'warn' : 'ok'}>总强度 {solved.totalStrength.toFixed(2)}</Badge> : null}
        </span>
      }
      actions={<Button variant="ghost" onClick={() => void load()}>刷新</Button>}
      tight
    >
      {items.length === 0 ? (
        <div className="jz-col" style={{ gap: 8 }}>
          <Alert tone="info">
            还没有 H3-Image 专用的 LoRA。把文件放进 ComfyUI 的
            {' '}<code className="jz-mono">models/loras/h3img/&lt;分类目录&gt;/</code>
            {' '}后重启 ComfyUI，再点刷新。
          </Alert>
          {hint ? <div className="jz-xs jz-muted">{hint}</div> : null}
        </div>
      ) : (
        <div className="jz-col" style={{ gap: 'var(--jz-sp-3)' }}>
          {categories.map(showLora)}
        </div>
      )}

      {solveErr ? <Alert tone="warn">LoRA 约束求解失败：{solveErr}</Alert> : null}

      {solved?.warnings?.length ? (
        <div className="jz-col" style={{ gap: 4, marginTop: 8 }}>
          {solved.warnings.map((w, i) => <Alert key={i} tone="warn">{w}</Alert>)}
        </div>
      ) : null}
      {solved?.replaced?.length ? (
        <div className="jz-col" style={{ gap: 2, marginTop: 8 }}>
          {solved.replaced.map((r, i) => (
            <div key={i} className="jz-xs jz-muted">「{r.category}」单选：{r.name} → {r.by}</div>
          ))}
        </div>
      ) : null}
      {solved?.rejected?.length ? (
        <div className="jz-col" style={{ gap: 2, marginTop: 8 }}>
          {solved.rejected.map((r, i) => (
            <div key={i} className="jz-xs" style={{ color: 'var(--jz-danger)' }}>{r.name}：{r.reason}</div>
          ))}
        </div>
      ) : null}
      {solved?.degraded?.length ? (
        <div className="jz-col" style={{ gap: 2, marginTop: 8 }}>
          {solved.degraded.map((d, i) => (
            <div key={i} className="jz-xs jz-muted">{d.name}：强度 {d.from} → {d.to}（{d.reason}）</div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

export default ImageLoraPicker;