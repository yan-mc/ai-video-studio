/**
 * 人设卡 / 拆解图 —— 把一个立绘转成全景式角色概念分解图。
 *
 * 玩法来源：社区爆火的 Nano Banana Pro 像素级拆解图
 *  - 三视图 + 服装部件拆解 + 附属部件拆解（+ 表情集 / 材质细节）
 *
 * 三个档位：
 *  - 角色设定卡：三视图 + 服装部件 + 附属部件
 *  - 完整设定卡：+ 表情集 + 材质细节放大
 *  - 纯服装拆解：只拆衣服，平铺网格，无人无物
 */
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import { outputUrl } from '../api/url';
import type { JobOutput } from '../api/url';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Tabs, Textarea, useToast,
} from '../ui';

interface Level { id: string; name: string; desc: string }
interface SizeOpt { id: string; name: string; w: number; h: number }
interface Asset { id: string; type: string; name: string; kind: string; rel?: string }

type Step = 'source' | 'describe' | 'options' | 'result';

export function BreakdownPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('source');
  const [busy, setBusy] = useState(false);

  const [levels, setLevels] = useState<Level[]>([]);
  const [sizes, setSizes] = useState<SizeOpt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [refRel, setRefRel] = useState('');
  const [character, setCharacter] = useState('');
  const [outfitText, setOutfitText] = useState('');
  const [partsText, setPartsText] = useState('');
  const [viewText, setViewText] = useState('正面，侧面，背面');
  const [notes, setNotes] = useState('');
  const [level, setLevel] = useState('standard');
  const [sizeId, setSizeId] = useState('square');

  const [preview, setPreview] = useState('');
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState<JobOutput | null>(null);
  const [cardName, setCardName] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([api.breakdownMeta(), api.listAssets({})]);
      const meta = m as { levels: Level[]; sizes: SizeOpt[] };
      setLevels(meta.levels ?? []);
      setSizes(meta.sizes ?? []);
      const imgs = (a as Asset[]).filter((x) => x.kind === 'image' && x.rel);
      setAssets(imgs);
      if (imgs[0]?.rel) setRefRel(imgs[0].rel);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const buildInput = useCallback(() => ({
    character: character || '图中角色',
    outfit: outfitText.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean),
    parts: partsText.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean),
    views: viewText.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean),
    notes,
    level,
    sizeId,
    refImages: refRel ? [refRel] : [],
  }), [character, outfitText, partsText, viewText, notes, level, sizeId, refRel]);

  async function doPreview() {
    setBusy(true);
    try {
      const r = await api.breakdownPreview({ ...buildInput() }) as { prompt: string; chars: number };
      setPreview(r.prompt);
      toast.ok(`提示词已生成（${r.chars} 字符）`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function doGenerate() {
    if (!refRel) { toast.error('请先选一张立绘'); return; }
    setBusy(true);
    try {
      const r = await api.breakdownGenerate({ ...buildInput() }) as { id: string };
      setJobId(r.id);
      setStep('result');
      toast.ok('已提交，正在生成拆解图…');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // 轮询结果
  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const jobs = await api.listJobs() as { id: string; status: string; outputs?: JobOutput[] }[];
          const cur = jobs.find((j) => j.id === jobId);
          if (cur && ['completed', 'failed'].includes(cur.status)) {
            /**
             * ⚠️ 成功判据必须认 `rel`，不能只认 `path`。
             *
             * 历史缺陷：守卫写的是 `cur.outputs?.[0]?.path`，而
             * `outputUrl()` 优先用 `rel`（comfy-client 的 toRel 在跨盘/相对
             * 路径失败时会给空 rel，但也存在只有 rel 有值的产物）。
             * `path` 为空就判"生成失败"，哪怕图已经成功产出、rel 就在对象里。
             * 现在按 `rel || path` 判，与 url.ts 的优先级保持一致。
             */
            const out = cur.outputs?.[0] as (JobOutput & { assetId?: string }) | undefined;
            if (cur.status === 'completed' && (out?.rel || out?.path)) {
              setResult(out ?? null);
              toast.ok(out?.assetId
                ? '拆解图完成，已归档到素材库'
                : '拆解图完成');
            } else {
              toast.error('生成失败');
            }
            setJobId('');
            window.clearInterval(timer);
          }
        } catch { /* ignore */ }
      })();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobId, toast]);

  /**
   * 把刚出的拆解图直接存成角色卡。
   *
   * 设计文档承诺过 `POST /vault/cards/:id/from-sheet`，但那条路由从没实现，
   * 于是「立绘 → 拆解 → 设定卡 → 角色卡仓库」这条主线在第三步断掉：
   * 用户只能去仓库页手动新建，再从几百张自动归档的素材里靠缩略图找。
   *
   * 这里用已有的 `vaultUpsert` 直接建卡（后端无需新路由）。
   *
   * ⚠️ 必须用 **archivedRel**（素材库里的正式副本），不能用产物原始 rel。
   *    产物落在 `data/outputs/`，那是可清理的临时区 —— 用户跑一次「清理孤儿」
   *    或换个 dataDir，卡片图就全裂了。后端 runAndArchive 已经算好 archivedRel
   *    附在 output 上，直接用即可。
   */
  async function handleSaveAsCard() {
    const name = cardName.trim();
    if (!name) { toast.error('请先填角色名'); return; }
    // 优先用素材库里的正式副本；产物原始 rel 落在可清理的临时区
    const sheetRel = result?.archivedRel || result?.rel || result?.path || '';
    if (!sheetRel) { toast.error('还没有可用的拆解图'); return; }
    setSavingCard(true);
    try {
      await api.vaultUpsert({
        name,
        description: `由立绘拆解生成${character ? `（${character}）` : ''}`,
        // 拆解图进设定卡；原立绘如果有的话一并放进 origin 槽位，
        // 这样卡的 refPolicy 才有"两个来源"可选。
        images: {
          sheet: [sheetRel],
          ...(refRel ? { origin: [refRel] } : {}),
        },
        refPolicy: { mode: refRel ? 'both' : 'sheet-first', maxImages: refRel ? 2 : 1 },
      });
      toast.ok(`已建角色卡「${name}」，可在角色卡仓库查看`);
      setCardName('');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setSavingCard(false);
    }
  }

  if (loading) return <Page title="立绘拆解"><Loading text="载入中" /></Page>;

  const previewUrl = outputUrl(result);

  return (
    <Page
      title="立绘拆解"
      subtitle="立绘 → 全景式角色概念分解图"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button onClick={() => void doPreview()} disabled={busy}>预览提示词</Button>
          <Button variant="primary" icon={<Icon name="image" size={15} />} onClick={() => void doGenerate()} disabled={busy || !refRel}>
            {busy ? '提交中…' : '生成拆解图'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        <Tabs<Step>
          items={[
            { value: 'source', label: '① 选立绘' },
            { value: 'describe', label: '② 描述角色' },
            { value: 'options', label: '③ 档位与尺寸' },
            { value: 'result', label: '④ 结果' },
          ]}
          value={step}
          onChange={setStep}
          ariaLabel="拆解图步骤"
        />

        {step === 'source' ? (
          <Panel title="选择立绘">
            {assets.length === 0 ? (
              <Alert tone="warn">素材库里还没有图片，请先在「素材库」上传立绘。</Alert>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setRefRel(a.rel ?? '')}
                    className="jz-card"
                    style={{
                      padding: 6, cursor: 'pointer', textAlign: 'left',
                      borderColor: refRel === a.rel ? 'var(--jz-accent)' : undefined,
                      borderWidth: refRel === a.rel ? 2 : 1,
                    }}
                  >
                    <img
                      src={`/jiuzhang/api/assets/item?id=${encodeURIComponent(a.id)}`}
                      alt={a.name}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4, background: 'var(--jz-bg-sunken)' }}
                    />
                    <div className="jz-xs jz-truncate" style={{ marginTop: 4 }}>{a.name}</div>
                  </button>
                ))}
              </div>
            )}
            {refRel ? <div className="jz-xs jz-muted" style={{ marginTop: 8 }}>已选：{refRel}</div> : null}
          </Panel>
        ) : null}

        {step === 'describe' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="角色">
              <Field label="角色名" hint="只作为称呼使用；长相、发型、配色一律以参考图为准，无需用文字描述">
                <Input value={character} onChange={(e) => setCharacter(e.target.value)}
                  placeholder="角色名即可，如：三角初华（不要写外貌，长相交给参考图）" />
              </Field>
              <Field label="补充说明（可选）">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="画风/时代/材质偏好，如：维多利亚风格，哥特蕾丝" />
              </Field>
            </Panel>

            <Panel title="服装清单" >
              <div className="jz-sm jz-muted" style={{ marginBottom: 8 }}>
                一行一件，拆解图会按这个清单逐件平铺展示。
              </div>
              <Textarea value={outfitText} onChange={(e) => setOutfitText(e.target.value)} rows={6}
                placeholder={'蕾丝胸衣上身\n百褶长裙摆\n蕾丝颈饰\n蓝色缎面腰封\n蕾丝手套\n蓝色花朵发饰\n深蓝色平底鞋'} />
            </Panel>

            <Panel title="附属部件 / 三视图 / 表情">
              <div className="jz-sm jz-muted" style={{ marginBottom: 8 }}>
                附属部件指发饰、首饰、挂件、武器、披风等非服装本体。
              </div>
              <Field label="附属部件（一行一件）">
                <Textarea value={partsText} onChange={(e) => setPartsText(e.target.value)} rows={3}
                  placeholder={'蓝色花朵发饰\n细颈链\n金属腰扣'} />
              </Field>
              <Field label="三视图角度（逗号分隔）">
                <Input value={viewText} onChange={(e) => setViewText(e.target.value)}
                  placeholder="正面，侧面，背面" />
              </Field>
            </Panel>
          </div>
        ) : null}

        {step === 'options' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="拆解档位">
              <div className="jz-col" style={{ gap: 8 }}>
                {/*
                  ⚠️ 过滤掉 `full` 档。
                  「完整设定卡」自 1.0.2 起与「角色设定卡」**逐字相同**
                  （后端 breakdown.js 共用同一分支，表情差分区已移除），
                  但 UI 仍把它当独立选项卖 —— 用户选了以为得到了更多，
                  实际「预览提示词」两次看到的文本和字数完全一样。
                  档位定义本身保留在后端（有回归断言盯着 desc 文案），
                  这里只是不把它当作可选项呈现。
                */}
                {levels.filter((l) => l.id !== 'full').map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLevel(l.id)}
                    className="jz-card"
                    style={{
                      padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                      borderColor: level === l.id ? 'var(--jz-accent)' : undefined,
                      borderWidth: level === l.id ? 2 : 1,
                    }}
                  >
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <b>{l.name}</b>
                      {level === l.id ? <Badge tone="ok">选中</Badge> : null}
                    </div>
                    <div className="jz-xs jz-muted" style={{ marginTop: 3 }}>{l.desc}</div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="输出尺寸">
              <Select<string>
                value={sizeId}
                onChange={setSizeId}
                options={sizes.map((s) => ({ value: s.id, label: `${s.name} · ${s.w}×${s.h}` }))}
              />
            </Panel>

            {preview ? (
              <Panel title={`提示词预览（${preview.length} 字符）`}>
                <pre className="jz-mono jz-xs" style={{
                  whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto',
                  background: 'var(--jz-bg-sunken)', padding: 10, borderRadius: 6, lineHeight: 1.7,
                }}>{preview}</pre>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {step === 'result' ? (
          <Panel title={jobId ? '生成中…' : '拆解图结果'}>
            {jobId ? (
              <div className="jz-col" style={{ alignItems: 'center', gap: 10, padding: 40 }}>
                <Icon name="image" size={40} />
                <div className="jz-muted">正在拆解…（2048² 约 1-2 分钟）</div>
                <div className="jz-xs jz-mono">{jobId.slice(0, 20)}…</div>
              </div>
            ) : previewUrl ? (
              <div className="jz-col" style={{ gap: 12 }}>
                <img src={previewUrl} alt="拆解图" style={{ maxWidth: '100%', borderRadius: 6 }} />
                <div className="jz-row jz-wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ minWidth: 200, flex: '0 0 auto' }}>
                    <Field label="角色名" hint="填了就能一键建角色卡，省得去仓库页手动挂图">
                      <Input
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder={character || '如：三角初华'}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="primary"
                    icon={<Icon name="check" size={15} />}
                    onClick={() => void handleSaveAsCard()}
                    disabled={savingCard || !cardName.trim()}
                  >
                    {savingCard ? '建卡中…' : '存为角色卡'}
                  </Button>
                  <span className="jz-xs jz-muted">
                    拆解图已归档进素材库，建卡后即可在渲染页作为一致性锚点引用。
                  </span>
                </div>
              </div>
            ) : (
              <div className="jz-muted">还没有结果。回到「③ 档位与尺寸」点「生成拆解图」。</div>
            )}
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

export default BreakdownPage;
