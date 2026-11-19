/**
 * LoRA 选择器 —— 按**功能分类**选，而不是给一串文件名让人瞎猜。
 *
 * ============================================================================
 * 为什么不能只做"多选下拉"
 * ============================================================================
 *
 * H3 的 LoRA 分成 11 个互相约束的轴，其中 6 个是**单选**：
 *   加速蒸馏 / 运镜 / 画风 / 角色一致性 / 音色 / 工具
 * 另外 5 个可多挂，但同一类叠挂要衰减（否则过曝、动作抢镜）。
 *
 * 不做这层约束的后果不是报错，而是"能出片但不对"：
 *   · 两个运镜 → 相机收到两个矛盾目标，既不环绕也不推近
 *   · 两个角色 → 同一张脸被两个身份先验争夺，面部与运动都崩
 *   · 总强度 >1.5 → 动作连贯性开始崩（社区实测阈值）
 *
 * 所以这个面板：
 *   1. 按分类分组展示（每个分类带一句"为什么"）
 *   2. 单选类**物理只允许一个**，换选自动替换并提示替换了谁
 *   3. 后端 `solveLoraStack` 统一算衰减与总强度，前端只负责展示结果
 *
 * @module components/LoraPicker
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, describeError } from '../api/client';
import type { LoraCategory, LoraItem, LoraSolveResult } from '../api/types';
import { Alert, Badge, Button, Panel, Select, Spinner, useToast } from '../ui';

/** 用户选中的一条（`strength` 为 null 表示"用该类默认值"） */
export interface LoraChoice {
  name: string;
  strength?: number;
}

export interface LoraPickerProps {
  value: LoraChoice[];
  onChange: (next: LoraChoice[]) => void;
  /** 最多几个（南风 8 个槽位，其中 1 个被加速学生占用） */
  maxSlots?: number;
}

export function LoraPicker({ value, onChange, maxSlots = 8 }: LoraPickerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<LoraCategory[]>([]);
  const [items, setItems] = useState<LoraItem[]>([]);
  const [probed, setProbed] = useState(true);
  const [probeError, setProbeError] = useState('');
  const [solved, setSolved] = useState<LoraSolveResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.loraCatalog();
      setCategories(r.categories ?? []);
      setItems(r.items ?? []);
      setProbed(Boolean(r.probed));
      setProbeError(r.probeError ?? '');
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
    if (!value.length) { setSolved(null); return () => { alive = false; }; }
    void (async () => {
      try {
        const r = await api.loraSolve({ items: value, maxSlots });
        if (alive) setSolved(r);
      } catch {
        if (alive) setSolved(null);
      }
    })();
    return () => { alive = false; };
  }, [value, maxSlots]);

  const selected = useMemo(() => new Set(value.map((v) => v.name)), [value]);

  /** 按分类分组 */
  const byCategory = useMemo(() => {
    const m = new Map<string, LoraItem[]>();
    for (const it of items) {
      if (!m.has(it.categoryId)) m.set(it.categoryId, []);
      m.get(it.categoryId)!.push(it);
    }
    return m;
  }, [items]);

  /** 某个分类里当前选中的是谁 */
  const pickOf = useCallback(
    (catId: string): LoraItem | undefined => items.find((i) => i.categoryId === catId && selected.has(i.name)),
    [items, selected],
  );

  const setStrength = useCallback((name: string, strength: number) => {
    onChange(value.map((v) => (v.name === name ? { ...v, strength } : v)));
  }, [value, onChange]);

  const handlePick = useCallback((cat: LoraCategory, item: LoraItem | null) => {
    // 单选类：先把同类清掉，再加入新的
    let next = value;
    if (cat.mode === 'single') {
      const sameCat = new Set(items.filter((i) => i.categoryId === cat.id).map((i) => i.name));
      next = next.filter((v) => !sameCat.has(v.name));
    }
    if (item) {
      if (next.some((v) => v.name === item.name)) {
        // 再点一次 = 取消（多选类）
        if (cat.mode === 'multi') next = next.filter((v) => v.name !== item.name);
      } else {
        if (next.length >= maxSlots) {
          toast.error(`最多 ${maxSlots} 个 LoRA`);
          return;
        }
        next = [...next, {
          name: item.name,
          ...(cat.signed && cat.defaultOnSelect != null ? { strength: cat.defaultOnSelect } : {}),
        }];
      }
    }
    onChange(next);
  }, [value, items, maxSlots, onChange, toast]);

  if (loading) return <Panel title="LoRA"><Spinner /></Panel>;

  return (
    <Panel title={`LoRA（已选 ${value.length} / ${maxSlots}）`} tight>
      <div style={{ display: 'grid', gap: 10 }}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!probed ? (
          <Alert tone="warn">
            未能从 ComfyUI 读取 LoRA 列表{probeError ? `（${probeError}）` : ''}。
            这不代表「一个都没装」—— 请确认 ComfyUI 在运行，然后重试。
            <div style={{ marginTop: 6 }}>
              <Button size="sm" onClick={() => void load()}>重新探测</Button>
            </div>
          </Alert>
        ) : null}

        {categories.map((cat) => {
          const list = byCategory.get(cat.id) ?? [];
          const picked = pickOf(cat.id);
          // 没有文件的分类也显示（灰掉），让用户知道"这一类可以放东西进来"
          return (
            <div key={cat.id} style={{
              border: '1px solid var(--jz-border)',
              borderRadius: 8,
              padding: 10,
              opacity: list.length ? 1 : 0.55,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <b className="jz-sm">{cat.label}</b>
                <Badge tone={cat.mode === 'single' ? 'accent' : 'default'}>
                  {cat.mode === 'single' ? '单选' : '可多挂'}
                </Badge>
                {cat.signed ? <Badge>有符号</Badge> : null}
                {list.length ? <Badge>{list.length}</Badge> : <Badge>空</Badge>}
                <span className="jz-xs jz-muted" style={{ marginLeft: 'auto' }}>
                  {cat.folder}/
                </span>
              </div>
              <div className="jz-xs jz-muted" style={{ lineHeight: 1.6, marginBottom: 6 }}>
                {cat.why}
              </div>

              {list.length === 0 ? (
                <div className="jz-xs jz-muted">
                  把 LoRA 放进 <code>models/loras/{cat.folder}/</code> 后刷新即可出现。
                </div>
              ) : cat.mode === 'single' ? (
                <Select
                  value={picked?.name ?? ''}
                  onChange={(v) => handlePick(cat, list.find((i) => i.name === v) ?? null)}
                  options={[
                    { value: '', label: '（不使用）' },
                    ...list.map((i) => ({ value: i.name, label: i.base })),
                  ]}
                />
              ) : (
                <div style={{ display: 'grid', gap: 4 }}>
                  {list.map((i) => {
                    const on = selected.has(i.name);
                    const chosen = value.find((v) => v.name === i.name);
                    return (
                      <div key={i.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="jz-btn jz-btn--sm"
                          onClick={() => handlePick(cat, i)}
                          style={{
                            opacity: on ? 1 : 0.5,
                            borderColor: on ? 'var(--jz-accent)' : undefined,
                            textAlign: 'left',
                            flex: '1 1 auto',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={i.name}
                        >
                          {on ? '✓ ' : ''}{i.base}
                        </button>
                        {on ? (
                          <input
                            type="number"
                            className="jz-input"
                            style={{ width: 74 }}
                            step={cat.strength.step}
                            min={cat.strength.min}
                            max={cat.strength.max}
                            value={String(chosen?.strength ?? cat.strength.def)}
                            onChange={(e) => setStrength(i.name, Number(e.target.value))}
                            title={`强度 ${cat.strength.min} … ${cat.strength.max}`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 单选类选中后也要能调强度 */}
              {cat.mode === 'single' && picked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span className="jz-xs jz-muted">强度</span>
                  <input
                    type="number"
                    className="jz-input"
                    style={{ width: 84 }}
                    step={cat.strength.step}
                    min={cat.strength.min}
                    max={cat.strength.max}
                    value={String(value.find((v) => v.name === picked.name)?.strength ?? cat.strength.def)}
                    onChange={(e) => setStrength(picked.name, Number(e.target.value))}
                  />
                  <span className="jz-xs jz-muted">
                    {cat.strength.min} … {cat.strength.max}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}

        {/* ---- 求解结果：让用户看到"我填的值实际变成了什么" ---- */}
        {solved ? (
          <div style={{ borderTop: '1px solid var(--jz-border)', paddingTop: 10, display: 'grid', gap: 6 }}>
            <div className="jz-sm">
              <b>实际生效</b>
              <span className="jz-xs jz-muted" style={{ marginLeft: 8 }}>
                总强度 {solved.totalStrength}（不含加速学生；建议 ≤1.5）
              </span>
            </div>
            {solved.accepted.map((a) => (
              <div key={a.name} className="jz-xs" style={{
                display: 'flex', gap: 6, alignItems: 'center',
              }}>
                <Badge tone={a.role === 'accelerator' ? 'accent' : 'default'}>{a.categoryLabel}</Badge>
                <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.base}</span>
                <code>@{a.appliedStrength}</code>
                {a.userStrength != null && a.userStrength !== a.appliedStrength ? (
                  <span className="jz-muted">（你填 {a.userStrength}）</span>
                ) : null}
              </div>
            ))}
            {solved.replaced.map((r) => (
              <div key={r.name} className="jz-xs jz-muted">
                · 「{r.category}」单选：{r.name.split(/[\\/]/).pop()} 已被 {r.by.split(/[\\/]/).pop()} 替换
              </div>
            ))}
            {solved.degraded.map((d) => (
              <div key={d.name} className="jz-xs jz-muted">
                · {d.name.split(/[\\/]/).pop()}：{d.from} → {d.to}（{d.reason}）
              </div>
            ))}
            {solved.rejected.map((r) => (
              <div key={r.name} className="jz-xs" style={{ color: 'var(--jz-warn-text, inherit)' }}>
                ✕ {r.name.split(/[\\/]/).pop()}：{r.reason}
              </div>
            ))}
            {solved.warnings.map((w) => (
              <Alert key={w} tone="warn">{w}</Alert>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={() => void load()}>刷新列表</Button>
          {value.length ? (
            <Button size="sm" onClick={() => onChange([])}>清空</Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
