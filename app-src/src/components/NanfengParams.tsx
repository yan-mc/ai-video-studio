/**
 * 南风参数面板 —— 从后端 schema 自动生成，并附带中文释义。
 *
 * ============================================================================
 * 为什么需要自动生成
 * ============================================================================
 *
 * 南风 V15 有 **217 个参数**，分 12 组。手写表单意味着：
 *   · 217 个 useState / onChange
 *   · 南风加一个参数就要改前端
 *   · 极易漏字段（漏了 ComfyUI 报 value_not_in_list，错误信息很难懂）
 *
 * 这里按后端 `/nanfeng/schema` 返回的元信息（名/组/类型/默认值/选项/释义）
 * 自动渲染控件，前端只负责「当前值」这一个 state。
 *
 * ============================================================================
 * 释义从哪来
 * ============================================================================
 *
 *   host/bridge/vendors/nanfeng/param-docs.js → enrichSchema() → GET /nanfeng/schema
 *
 * 每个参数带三个可选字段：
 *   zh    一句话说明它做什么
 *   hint  调参建议（什么时候动、往哪动）
 *   flag  dead（上游硬编码关闭，调了没反应）
 *         banned（缺依赖/被上游禁用，开了会报错）
 *
 * 「无效参数」默认**折叠隐藏**，并在组头显示数量角标。用户展开也能看到，
 * 但会先看到一条醒目提示 —— 这比让人在 61 个不响应的旋钮上瞎试好得多。
 *
 * @module components/NanfengParams
 */
import { useMemo, useState } from 'react';
import { Badge, Field, Input, Panel, Select, Switch } from '../ui';

/** 后端 schema 里的单个参数 */
export interface ParamDef {
  group: string;
  type: 'INT' | 'FLOAT' | 'BOOLEAN' | 'STRING' | 'COMBO';
  default: unknown;
  options?: Array<string | number>;
  /** 一句话说明 */
  zh?: string;
  /** 调参建议 */
  hint?: string;
  /** dead = 完全无效；banned = 缺依赖/被禁用 */
  flag?: 'dead' | 'banned';
}

/** 分组元信息 */
export interface GroupDef {
  id: string;
  name: string;
  desc: string;
  count: number;
  /** 分组级说明（比 desc 更详细） */
  zh?: string;
  /** 本组内 dead/banned 参数个数 */
  dead?: number;
}

/** 哪些组默认展开 */
const DEFAULT_OPEN = new Set(['A', 'B', 'C', 'D']);

/** 组顺序 */
const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** 无效参数默认折叠（用户可显式展开） */
const HIDE_INERT_DEFAULT = true;

export interface NanfengParamsProps {
  /** 后端 /nanfeng/schema 返回的 params */
  params: Record<string, ParamDef>;
  /** 后端返回的 groups */
  groups: Record<string, GroupDef>;
  /** 当前值（未出现的键用默认值） */
  values: Record<string, unknown>;
  /** 改动回调 */
  onChange: (key: string, value: unknown) => void;
  /** 只显示这些组（可选） */
  onlyGroups?: string[];
  /** 隐藏这些组 */
  hideGroups?: string[];
  /** 关键字过滤（按参数名/释义/建议模糊匹配） */
  filter?: string;
}

/** 一个参数是否是「无效」的（不会影响出片或被上游禁用） */
function isInert(def: ParamDef): boolean {
  return def.flag === 'dead' || def.flag === 'banned';
}

/**
 * 渲染全部参数分组。
 */
export function NanfengParams({
  params,
  groups,
  values,
  onChange,
  onlyGroups,
  hideGroups,
  filter = '',
}: NanfengParamsProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(onlyGroups ?? [...DEFAULT_OPEN]),
  );
  const [hideInert, setHideInert] = useState(HIDE_INERT_DEFAULT);

  const q = filter.trim().toLowerCase();

  // 按组归类参数（应用过滤）
  const byGroup = useMemo(() => {
    const m = new Map<string, Array<[string, ParamDef]>>();
    for (const [key, def] of Object.entries(params)) {
      if (onlyGroups && !onlyGroups.includes(def.group)) continue;
      if (hideGroups && hideGroups.includes(def.group)) continue;
      if (hideInert && isInert(def)) continue;
      if (q) {
        const hay = `${key} ${def.zh ?? ''} ${def.hint ?? ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      if (!m.has(def.group)) m.set(def.group, []);
      m.get(def.group)!.push([key, def]);
    }
    return m;
  }, [params, onlyGroups, hideGroups, hideInert, q]);

  // 每组「已改」计数（与默认值不同）
  const changedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const [key, def] of Object.entries(params)) {
      if (!(key in values)) continue;
      const cur = values[key];
      if (cur === def.default) continue;
      if (cur === undefined || cur === null) continue;
      m.set(def.group, (m.get(def.group) ?? 0) + 1);
    }
    return m;
  }, [params, values]);

  const toggle = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 搜索时强制全部展开，否则用户看不到命中项
  const forceOpen = Boolean(q);

  return (
    <>
      <Panel tight flush>
        <div className="jz-nf-bar">
          <label className="jz-nf-toggle" title="隐藏上游已废弃/缺依赖的参数，避免在无效旋钮上浪费时间">
            <input
              type="checkbox"
              checked={hideInert}
              onChange={(e) => setHideInert(e.target.checked)}
            />
            <span>隐藏无效参数</span>
          </label>
          {q ? <span className="jz-xs jz-muted">筛选中：{q}</span> : null}
        </div>
      </Panel>

      {GROUP_ORDER.map((gid) => {
        const list = byGroup.get(gid);
        if (!list || list.length === 0) return null;
        const meta = groups[gid];
        const open = forceOpen || openGroups.has(gid);
        const changed = changedCount.get(gid) ?? 0;
        const inertCount = meta?.dead ?? 0;

        return (
          <Panel
            key={gid}
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => toggle(gid)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--jz-text-muted)',
                    font: 'inherit',
                  }}
                  aria-expanded={open}
                >
                  {open ? '▾' : '▸'}
                </button>
                <span>
                  {gid} · {meta?.name ?? gid}
                </span>
                <Badge>{list.length}</Badge>
                {changed > 0 ? <Badge tone="accent">改 {changed}</Badge> : null}
                {inertCount > 0 && hideInert ? (
                  <Badge tone="default" >隐藏 {inertCount} 项无效</Badge>
                ) : null}
              </span>
            }
            tight
          >
            {open ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {meta?.zh ? <div className="jz-nf-groupdoc">{meta.zh}</div> : null}
                {list.map(([key, def]) => (
                  <ParamControl
                    key={key}
                    name={key}
                    def={def}
                    value={key in values ? values[key] : def.default}
                    onChange={(v) => onChange(key, v)}
                  />
                ))}
              </div>
            ) : null}
          </Panel>
        );
      })}
    </>
  );
}

/**
 * 单个参数控件 —— 按类型分派。
 *
 * 布局：标签行（名字 + 无效角标）→ 控件 → 说明 → 建议。
 * 说明总是显示（这是用户要的"这些参数大概都是干嘛的"）；
 * 建议折叠在 <details> 里，避免面板过长。
 */
function ParamControl({
  name,
  def,
  value,
  onChange,
}: {
  name: string;
  def: ParamDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const inertBadge = def.flag === 'dead'
    ? <Badge tone="default">已失效</Badge>
    : def.flag === 'banned'
      ? <Badge tone="default">不可用</Badge>
      : null;

  let control: JSX.Element;

  // BOOLEAN → Switch
  if (def.type === 'BOOLEAN') {
    control = (
      <Switch
        checked={Boolean(value)}
        onChange={(c) => onChange(c)}
        label={name}
      />
    );
  } else if (def.type === 'COMBO' && Array.isArray(def.options) && def.options.length) {
    // COMBO → Select（选项可能很多，数值型要转字符串喂给 Select）
    const opts = def.options.map((o) => ({ value: String(o), label: String(o) }));
    control = (
      <Field label={name}>
        <Select
          value={String(value ?? '')}
          onChange={(v) => {
            // 数值型 COMBO 要转回数字，否则 ComfyUI 报 value_not_in_list
            const sample = def.options!.find((o) => o != null);
            if (typeof sample === 'number') {
              const n = Number(v);
              onChange(Number.isFinite(n) ? n : v);
            } else {
              onChange(v);
            }
          }}
          options={opts}
        />
      </Field>
    );
  } else if (def.type === 'STRING') {
    // 长的用 textarea
    const isLong = name === '提示词' || name === '音频驱动创意'
      || (def.zh ?? '').length > 40 || name.includes('Sigma');
    if (isLong) {
      control = (
        <Field label={name}>
          <textarea
            className="jz-input"
            rows={4}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>
      );
    } else {
      control = (
        <Field label={name}>
          <Input
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            mono
          />
        </Field>
      );
    }
  } else {
    // INT / FLOAT → 数字输入
    const isInt = def.type === 'INT';
    control = (
      <Field label={name}>
        <Input
          type="number"
          step={isInt ? 1 : 'any'}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') { onChange(0); return; }
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            // ⚠️ 必须转成数字 —— ComfyUI 严格类型比较，字符串会被拒
            onChange(isInt ? Math.round(n) : n);
          }}
          mono
        />
      </Field>
    );
  }

  return (
    <div className={def.flag ? 'jz-nf-item jz-nf-item--inert' : 'jz-nf-item'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <code className="jz-nf-name">{name}</code>
        {inertBadge}
      </div>
      {control}
      {def.zh ? <div className="jz-nf-doc">{def.zh}</div> : null}
      {def.hint ? (
        <details className="jz-nf-hint">
          <summary>调参建议</summary>
          <div>{def.hint}</div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * 一句话速查表：把全部参数按「组 / 名字 / 说明 / 建议」平铺成可搜索表格。
 *
 * 渲染页的「参数速查」抽屉用它 —— 用户想"搜一下 T8 是啥"时，
 * 比在一堆折叠组里翻快得多。
 */
export function ParamReference({
  params,
  groups,
}: {
  params: Record<string, ParamDef>;
  groups: Record<string, GroupDef>;
}) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.entries(params)
      .filter(([k, d]) => {
        if (!needle) return true;
        return `${k} ${d.zh ?? ''} ${d.hint ?? ''} ${groups[d.group]?.name ?? ''}`
          .toLowerCase().includes(needle);
      })
      .map(([k, d]) => ({ key: k, def: d }));
  }, [params, groups, q]);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Input
        placeholder="搜索参数名 / 说明 / 建议，例如「二采」「注意力」「LoRA」"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="jz-xs jz-muted">
        共 {Object.keys(params).length} 个参数，匹配 {rows.length} 个
      </div>
      <div className="jz-nf-table">
        {rows.map(({ key, def }) => (
          <div key={key} className="jz-nf-row">
            <div className="jz-nf-row__head">
              <code>{key}</code>
              <Badge>{groups[def.group]?.name ?? def.group}</Badge>
              <Badge>{def.type}</Badge>
              {def.flag ? (
                <Badge tone="default">{def.flag === 'dead' ? '已失效' : '不可用'}</Badge>
              ) : null}
            </div>
            {def.zh ? <div className="jz-nf-row__zh">{def.zh}</div> : null}
            {def.hint ? <div className="jz-nf-row__hint">💡 {def.hint}</div> : null}
            <div className="jz-nf-row__def">
              默认：<code>{JSON.stringify(def.default)}</code>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <div className="jz-muted">没有匹配的参数</div> : null}
      </div>
    </div>
  );
}

/**
 * 预设选择器。
 */
export function PresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: Array<{ id: string; label: string; desc: string; isDefault?: boolean }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Field label="预设">
      <Select
        value={value}
        onChange={onChange}
        options={presets.map((p) => ({ value: p.id, label: p.label }))}
      />
    </Field>
  );
}
