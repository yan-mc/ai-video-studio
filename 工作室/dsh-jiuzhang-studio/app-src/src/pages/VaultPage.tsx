/**
 * 角色卡仓库 —— 一个角色 = 拆解图 + 设定文字（+ 可选原立绘）。
 *
 * 解决：角色一致性不该靠"每个镜头手动挂一遍图"。
 * 这里集中管理角色卡，项目选卡，分镜生成时自动注入图与文字。
 *
 * 关键 UI 决策：
 *  - 参考图预算**始终可见**（右上角显示 used/9）。超限是硬约束，不能藏起来。
 *  - 每个槽位独立选图，因为设定卡与原立绘用途不同。
 *  - 描述用"这是谁"，不用"长什么样"——外观交给图片。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, describeError } from '../api/client';
import { assetUrl } from '../api/url';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Textarea, useToast,
} from '../ui';

interface VaultSlot { id: string; name: string; desc: string }
interface VaultMode { id: string; name: string; desc: string }
interface VaultMeta {
  slots: VaultSlot[];
  refModes: VaultMode[];
  limits: { maxRefImages: number; maxTotalRefs: number };
}

interface CardImage { slot: string; rel: string }

interface Card {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  traits: string[];
  personality: string;
  voiceDesc: string;
  images: Record<string, string[]>;
  refPolicy: { mode: string; maxImages: number };
  resolvedImages: CardImage[];
  imageCount: number;
}

interface Asset { id: string; name: string; rel?: string; kind: string }

type Draft = Partial<Card> & { images: Record<string, string[]> };

const EMPTY: Draft = {
  name: '',
  description: '',
  traits: [],
  personality: '',
  aliases: [],
  voiceDesc: '',
  images: { sheet: [], origin: [], heads: [], extras: [] },
  refPolicy: { mode: 'sheet-first', maxImages: 1 },
};

export function VaultPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c, a] = await Promise.all([api.vaultMeta(), api.vaultCards(), api.listAssets({})]);
      setMeta(m as VaultMeta);
      setCards(c as Card[]);
      setAssets((a as Asset[]).filter((x) => x.kind === 'image' && x.rel));
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  function openCard(c: Card) {
    setSelectedId(c.id);
    setDraft({ ...c, images: { ...EMPTY.images, ...c.images } });
  }

  function openNew() {
    setSelectedId('');
    setDraft({ ...EMPTY, images: { ...EMPTY.images } });
  }

  async function save() {
    if (!String(draft.name ?? '').trim()) { toast.error('请填写角色名'); return; }
    setBusy(true);
    try {
      const payload = { ...draft, ...(selectedId ? { id: selectedId } : {}) };
      const saved = await api.vaultUpsert(payload as Record<string, unknown>) as Card;
      toast.ok(selectedId ? '已更新' : '已创建');
      setSelectedId(saved.id);
      setDraft({ ...saved, images: { ...EMPTY.images, ...saved.images } });
      await load();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.vaultDelete(selectedId);
      toast.ok('已删除');
      openNew();
      await load();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  /** 往某个槽位加图 */
  function addImage(slot: string, rel: string) {
    if (!rel) return;
    setDraft((d) => {
      const cur = d.images?.[slot] ?? [];
      if (cur.includes(rel)) return d;
      return { ...d, images: { ...d.images, [slot]: [...cur, rel] } };
    });
  }

  function removeImage(slot: string, rel: string) {
    setDraft((d) => ({
      ...d,
      images: { ...d.images, [slot]: (d.images?.[slot] ?? []).filter((x) => x !== rel) },
    }));
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return cards;
    return cards.filter((c) =>
      [c.name, c.description, ...(c.traits ?? []), ...(c.aliases ?? [])]
        .filter(Boolean).join(' ').toLowerCase().includes(kw));
  }, [cards, q]);

  // 预算估算：这轮选中的卡一共占几张
  const budgetHint = useMemo(() => {
    const max = meta?.limits.maxRefImages ?? 9;
    const per = Number(draft.refPolicy?.maxImages ?? 1);
    const mode = draft.refPolicy?.mode ?? 'sheet-first';
    const sheet = (draft.images?.sheet ?? []).length > 0;
    const origin = (draft.images?.origin ?? []).length > 0;
    let used = 0;
    if (mode === 'both') used = (sheet ? 1 : 0) + (origin ? 1 : 0);
    else if (mode === 'sheet-only') used = sheet ? 1 : 0;
    else if (mode === 'origin-first') used = origin ? 1 : 0;
    else used = sheet || origin ? 1 : 0;
    return { used: Math.min(used, per), max, per };
  }, [draft, meta]);

  if (loading) return <Page title="角色卡仓库"><Loading text="载入中" /></Page>;

  const imageAssets = assets;

  return (
    <Page
      title="角色卡仓库"
      subtitle="一个角色 = 拆解图 + 设定文字（+ 可选原立绘）；项目选卡后，分镜生成自动带上"
      actions={
        <>
          <Badge tone={budgetHint.used > budgetHint.max ? 'danger' : 'ok'}>
            本卡占用 {budgetHint.used} 张
          </Badge>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button onClick={openNew} disabled={busy}>新建</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? '保存中…' : selectedId ? '保存修改' : '创建'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--jz-sp-4)' }}>
        {/* 左：卡列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索角色名 / 标签…" />
          <div className="jz-xs jz-muted">共 {filtered.length} 张卡</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflow: 'auto' }}>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openCard(c)}
                className="jz-card"
                style={{
                  padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                  borderColor: selectedId === c.id ? 'var(--jz-accent)' : undefined,
                  borderWidth: selectedId === c.id ? 2 : 1,
                }}
              >
                <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <b className="jz-truncate">{c.name}</b>
                  <Badge>{c.imageCount} 图</Badge>
                </div>
                <div className="jz-xs jz-muted jz-truncate" style={{ marginTop: 3 }}>
                  {c.description || '（无描述）'}
                </div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="jz-sm jz-muted">还没有角色卡，点「新建」。</div>
            ) : null}
          </div>
        </div>

        {/* 右：编辑区 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jz-sp-4)' }}>
          <Panel title={selectedId ? `编辑：${draft.name}` : '新建角色卡'}>
            <Field label="角色名" hint="权威名字，会写进提示词">
              <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="例如：三角初华" />
            </Field>
            <Field label="别名（逗号分隔，可选）">
              <Input value={(draft.aliases ?? []).join('，')}
                onChange={(e) => setDraft({ ...draft, aliases: e.target.value.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean) })}
                placeholder="初华，Uika" />
            </Field>
            <Field label="文字设定" hint="写「这是谁」而不是「长什么样」—— 外观交给图片">
              <Textarea value={draft.description ?? ''} rows={3}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="金发紫瞳的少女，穿黑色哥特宫廷礼服。演出时气场强势。" />
            </Field>
            <Field label="标签（逗号分隔，可选）">
              <Input value={(draft.traits ?? []).join('，')}
                onChange={(e) => setDraft({ ...draft, traits: e.target.value.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean) })}
                placeholder="金发，紫瞳，哥特" />
            </Field>
            <Field label="性格 / 演出参考（可选）">
              <Input value={draft.personality ?? ''}
                onChange={(e) => setDraft({ ...draft, personality: e.target.value })}
                placeholder="冷静、克制" />
            </Field>
          </Panel>

          <Panel title="参考图与取用策略">
            <Alert tone="info">
              H3 参考图上限 <b>{meta?.limits.maxRefImages ?? 9}</b> 张，
              由所有角色 + 场景 + 首尾帧<b>共享</b>。多角色时每卡只带 1 张最稳。
            </Alert>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 'var(--jz-sp-3)', marginTop: 10 }}>
              <Field label="取用策略">
                <Select<string>
                  value={draft.refPolicy?.mode ?? 'sheet-first'}
                  onChange={(v) => setDraft({ ...draft, refPolicy: { mode: v, maxImages: draft.refPolicy?.maxImages ?? 1 } })}
                  options={(meta?.refModes ?? []).map((m) => ({ value: m.id, label: `${m.name} — ${m.desc}` }))}
                />
              </Field>
              <Field label="本卡最多占几张">
                <Select<string>
                  value={String(draft.refPolicy?.maxImages ?? 1)}
                  onChange={(v) => setDraft({ ...draft, refPolicy: { mode: draft.refPolicy?.mode ?? 'sheet-first', maxImages: Number(v) } })}
                  options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: `${n} 张` }))}
                />
              </Field>
            </div>

            {(meta?.slots ?? []).map((slot) => (
              <div key={slot.id} style={{ marginTop: 14 }}>
                <div className="jz-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <b className="jz-sm">{slot.name}</b>
                  <span className="jz-xs jz-muted">{slot.desc}</span>
                </div>
                <div className="jz-row jz-wrap" style={{ gap: 6 }}>
                  {(draft.images?.[slot.id] ?? []).map((rel) => (
                    <div key={rel} style={{ position: 'relative' }}>
                      <img src={assetThumb(imageAssets, rel)} alt={rel}
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--jz-line)' }} />
                      <button type="button" onClick={() => removeImage(slot.id, rel)}
                        style={{
                          position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9,
                          border: 'none', cursor: 'pointer', background: 'var(--jz-danger)', color: '#fff', fontSize: 11,
                        }}>×</button>
                    </div>
                  ))}
                  <Select<string>
                    value=""
                    onChange={(v) => addImage(slot.id, v)}
                    options={[
                      { value: '', label: '＋ 选择素材…' },
                      ...imageAssets
                        .filter((a) => !(draft.images?.[slot.id] ?? []).includes(a.rel ?? ''))
                        .map((a) => ({ value: a.rel ?? '', label: a.name })),
                    ]}
                  />
                </div>
              </div>
            ))}
          </Panel>

          {selectedId ? (
            <Panel title="危险操作">
              <Button variant="danger" onClick={() => void remove()} disabled={busy}>删除这张卡</Button>
              <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
                删除只移除卡片记录，素材库里的图片文件不受影响。
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </Page>
  );
}

/** rel → 可显示缩略图（走 assets/item 需要 id，这里用 /file 读 rel） */
function assetThumb(assets: Asset[], rel: string): string {
  const hit = assets.find((a) => a.rel === rel);
  if (hit) return assetUrl(hit.id);
  return `/jiuzhang/api/file?path=${encodeURIComponent(rel)}`;
}

export default VaultPage;
