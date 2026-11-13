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
  const [exprText, setExprText] = useState('平静，微笑，微怒，惊讶');
  const [notes, setNotes] = useState('');
  const [level, setLevel] = useState('standard');
  const [sizeId, setSizeId] = useState('square');

  const [preview, setPreview] = useState('');
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState<{ path?: string; rel?: string } | null>(null);

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
    expressions: exprText.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean),
    notes,
    level,
    sizeId,
    refImages: refRel ? [refRel] : [],
  }), [character, outfitText, partsText, viewText, exprText, notes, level, sizeId, refRel]);

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
          const jobs = await api.listJobs() as { id: string; status: string; outputs?: { path?: string }[] }[];
          const cur = jobs.find((j) => j.id === jobId);
          if (cur && ['completed', 'failed'].includes(cur.status)) {
            if (cur.status === 'completed' && cur.outputs?.[0]?.path) {
              setResult(cur.outputs[0]);
              toast.ok('拆解图完成');
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
                      src={`/luoshu/api/assets/item?id=${encodeURIComponent(a.id)}`}
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
              <Field label="表情集（完整档才用，逗号分隔）">
                <Input value={exprText} onChange={(e) => setExprText(e.target.value)} />
              </Field>
            </Panel>
          </div>
        ) : null}

        {step === 'options' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="拆解档位">
              <div className="jz-col" style={{ gap: 8 }}>
                {levels.map((l) => (
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
              <img src={previewUrl} alt="拆解图" style={{ maxWidth: '100%', borderRadius: 6 }} />
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
