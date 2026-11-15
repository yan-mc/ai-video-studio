/**
 * 剧本创作页 —— 对齐参考实现 `script` 域（5 阶段流水线）。
 *
 * 5 阶段：大纲 → 人物小传 → 章节目录 → 章节正文 → 视觉分镜
 * 支持 14 种题材、60 集长篇、一致性检查（上限可调）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, describeError } from '../api/client';
import { ScriptAnalyzerPanel } from './H3Page';
import { useProjectStore } from '../store';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Tabs, Textarea, useToast,
} from '../ui';

interface Genre { id: string; name: string; hints: string }
interface Stage { id: string; name: string; desc: string }
interface Char { name: string; role: string; want: string; need: string; wound: string; arc: string; relation: string }
interface Chapter { index: number; act: string; title: string; summary: string; characters: string[] }
interface Scene { no: number; slug: string; location: string; action: string; beats: string[]; dialogue: { speaker: string; line: string }[] }
interface Shot { index: number; sceneNo: number; location: string; shot: string; durationSec: number; description: string; camera: string; dialogue: string }
interface Issue { level: string; kind: string; detail: string }

type ScriptTab = 'write' | 'analyze';

interface ScriptDoc {
  projectId?: string;
  genre?: string;
  outline?: { title: string; premise: string; genre: string; episodes: number; logline: string; acts: { act: string; episodes: string; beat: string }[] };
  bios?: { characters: Char[] };
  chapters?: { chapters: Chapter[] };
  bodies?: { episode: number; title: string; act: string; scenes: Scene[] }[];
  storyboard?: { title: string; shots: Shot[] };
  consistency?: { ok: boolean; total: number; shown: Issue[] };
}

const STAGE_KEYS = ['outline', 'bios', 'chapters', 'body', 'storyboard'] as const;
const STAGE_LABEL: Record<string, string> = {
  outline: '大纲', bios: '人物小传', chapters: '章节目录', body: '章节正文', storyboard: '视觉分镜',
};

export function ScriptPage() {
  const toast = useToast();
  const projectId = useProjectStore((s) => s.currentProjectId);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tab, setTab] = useState<ScriptTab>('write');
  const [doc, setDoc] = useState<ScriptDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');


  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('urban-rebirth');
  const [episodes, setEpisodes] = useState('12');
  const [episodeIndex, setEpisodeIndex] = useState('1');
  const [limit, setLimit] = useState('10');

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await api.getScript(projectId) as ScriptDoc | null;
      // 后端对未创建的剧本返回 null —— 这是正常状态，不是错误
      setDoc(d && typeof d === 'object' ? d : null);
      if (d && typeof d === 'object' && d.outline) {
        setTitle(d.outline.title ?? '');
        setPremise(d.outline.premise ?? '');
        setGenre(d.genre ?? 'urban-rebirth');
        setEpisodes(String(d.outline.episodes ?? 12));
      }
      setErr('');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.scriptMeta() as { genres: Genre[]; stages: Stage[] };
        setGenres(m.genres ?? []);
        setStages(m.stages ?? []);
      } catch { /* 忽略 */ }
    })();
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runStage(stage: string) {
    if (!projectId) { toast.error('请先选择一个项目'); return; }
    setBusy(true);
    try {
      const r = await api.runScriptStage({
        projectId, stage,
        title, premise, genre,
        episodes: Number(episodes) || 12,
        episodeIndex: Number(episodeIndex) || 1,
        consistencyLimit: Number(limit) || 10,
      }) as { doc: ScriptDoc };
      setDoc(r.doc);
      toast.ok(`${STAGE_LABEL[stage]} 已生成`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function runAll() {
    if (!projectId) { toast.error('请先选择一个项目'); return; }
    setBusy(true);
    try {
      const r = await api.runScriptAll({
        projectId, title, premise, genre,
        episodes: Number(episodes) || 12, consistencyLimit: Number(limit) || 10,
      }) as { doc: ScriptDoc };
      setDoc(r.doc);
      toast.ok('5 阶段全部完成');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const completed = useMemo(() => ({
    outline: Boolean(doc?.outline),
    bios: Boolean(doc?.bios?.characters?.length),
    chapters: Boolean(doc?.chapters?.chapters?.length),
    body: Boolean(doc?.bodies?.length),
    storyboard: Boolean(doc?.storyboard?.shots?.length),
  }), [doc]);

  if (loading) return <Page title="剧本"><Loading text="载入中" /></Page>;

  // 剧本页有两个入口，都是"前期文本处理"：
  //   · 5 阶段流水线：从零创作
  //   · 剧本拆解：把已有的一集剧本切成分段 + 抽资产
  // 之前它们是两个并列的顶级页面（"剧本" 与 "H3 工坊"），职责重叠、名字还撞车。
  if (tab === 'analyze') {
    return (
      <Page
        title="剧本"
        subtitle="剧本拆解 · 把一集剧本切成分段，抽出角色/场景/道具清单"
        actions={
          <Tabs<ScriptTab>
            items={[
              { value: 'write', label: '5 阶段创作' },
              { value: 'analyze', label: '剧本拆解' },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="剧本模式"
          />
        }
      >
        <ScriptAnalyzerPanel />
      </Page>
    );
  }

  return (
    <Page
      title="剧本"
      subtitle="5 阶段流水线 · 14 种题材 · 一致性检查"
      actions={
        <>
          <Tabs<ScriptTab>
            items={[
              { value: 'write', label: '5 阶段创作' },
              { value: 'analyze', label: '剧本拆解' },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="剧本模式"
          />
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button variant="primary" icon={<Icon name="text" size={15} />} onClick={() => void runAll()} disabled={busy || !projectId}>
            {busy ? '生成中…' : '一键跑完'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        {!projectId ? <Alert tone="warn">请先在「项目」页选择一个项目</Alert> : null}

        {/* 输入区 */}
        <Panel title="故事设定">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--jz-sp-3)' }}>
            <Field label="作品名">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：雨夜归途" />
            </Field>
            <Field label="题材">
              <Select<string>
                value={genre}
                onChange={setGenre}
                options={genres.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Field>
            <Field label="集数">
              <Input value={episodes} onChange={(e) => setEpisodes(e.target.value)} mono />
            </Field>
            <Field label="一致性上限">
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} mono />
            </Field>
          </div>
          <Field label="一句话故事" hint="决定整个故事的走向">
            <Textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              rows={2}
              placeholder="例如：一个被冤枉的人回到十年前，用先知优势改写命运"
            />
          </Field>
          {genres.length ? (
            <div className="jz-sm jz-muted" style={{ marginTop: 6 }}>
              题材提示：{genres.find((g) => g.id === genre)?.hints}
            </div>
          ) : null}
        </Panel>

        {/* 5 阶段 */}
        <Panel title="五阶段流水线">
          <div className="jz-row jz-wrap" style={{ gap: 8 }}>
            {STAGE_KEYS.map((k) => (
              <div key={k} className="jz-card" style={{ padding: '8px 12px', minWidth: 150 }}>
                <div className="jz-row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <b>{STAGE_LABEL[k]}</b>
                  <Badge tone={completed[k] ? 'ok' : 'default'}>{completed[k] ? '✓' : '·'}</Badge>
                </div>
                <div className="jz-sm jz-muted" style={{ marginTop: 4 }}>
                  {stages.find((s) => s.id === k)?.desc ?? ''}
                </div>
                <Button
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={() => void runStage(k)}
                  disabled={busy || !projectId}
                >
                  生成
                </Button>
              </div>
            ))}
          </div>
          {completed.body || completed.storyboard ? (
            <div className="jz-row" style={{ gap: 8, marginTop: 8 }}>
              <span className="jz-label" style={{ margin: 0 }}>针对第几集</span>
              <Input value={episodeIndex} onChange={(e) => setEpisodeIndex(e.target.value)} mono style={{ width: 80 }} />
            </div>
          ) : null}
        </Panel>

        {/* 结果 */}
        {doc?.outline ? (
          <Panel title="大纲">
            <div className="jz-col" style={{ gap: 8 }}>
              <div><b>{doc.outline.title}</b> · {doc.outline.genre} · {doc.outline.episodes} 集</div>
              <div className="jz-sm jz-secondary">{doc.outline.logline}</div>
              <div className="jz-col" style={{ gap: 6, marginTop: 6 }}>
                {doc.outline.acts.map((a) => (
                  <div key={a.act} className="jz-card" style={{ padding: '8px 10px' }}>
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <b>{a.act}</b><Badge>{a.episodes}</Badge>
                    </div>
                    <div className="jz-sm jz-muted" style={{ marginTop: 4 }}>{a.beat}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        ) : null}

        {doc?.bios?.characters?.length ? (
          <Panel title="人物小传">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {doc.bios.characters.map((c) => (
                <div key={c.name} className="jz-card" style={{ padding: '10px 12px' }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                    <b>{c.name}</b><Badge>{c.role}</Badge>
                  </div>
                  <div className="jz-sm jz-muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                    <div>欲望：{c.want}</div>
                    <div>需求：{c.need}</div>
                    <div>创伤：{c.wound}</div>
                    <div>弧光：{c.arc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {doc?.chapters?.chapters?.length ? (
          <Panel title={`章节目录（${doc.chapters.chapters.length} 集）`}>
            <div className="jz-col" style={{ gap: 4 }}>
              {doc.chapters.chapters.map((c) => (
                <div key={c.index} className="jz-row" style={{ gap: 10, padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,.06)' }}>
                  <span className="jz-mono" style={{ width: 40, opacity: 0.6 }}>{String(c.index).padStart(2, '0')}</span>
                  <span style={{ width: 120 }}>{c.title}</span>
                  <span className="jz-sm jz-secondary" style={{ flex: 1 }}>{c.summary}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {doc?.bodies?.length ? (
          <Panel title="章节正文">
            {doc.bodies.map((b) => (
              <div key={b.episode} className="jz-col" style={{ gap: 8, marginBottom: 14 }}>
                <div className="jz-row" style={{ gap: 8 }}>
                  <b>第 {b.episode} 集</b>
                  <span className="jz-sm jz-muted">{b.act}</span>
                </div>
                {b.scenes.map((s) => (
                  <div key={s.no} className="jz-card" style={{ padding: '8px 10px' }}>
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <span className="jz-sm jz-mono">场 {s.no} · {s.slug}</span>
                      <Badge>{s.beats?.length ?? 0} 拍</Badge>
                    </div>
                    <div className="jz-sm" style={{ marginTop: 4 }}>{s.action}</div>
                    {s.dialogue?.length ? (
                      <div className="jz-sm jz-muted" style={{ marginTop: 4 }}>
                        {s.dialogue.map((d, i) => <div key={i}>{d.speaker}：「{d.line}」</div>)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </Panel>
        ) : null}

        {doc?.storyboard?.shots?.length ? (
          <Panel title={`视觉分镜（${doc.storyboard.shots.length} 镜）`}>
            <div className="jz-col" style={{ gap: 4 }}>
              {doc.storyboard.shots.map((s) => (
                <div key={s.index} className="jz-row" style={{ gap: 10, padding: '5px 0', borderBottom: '1px dashed rgba(255,255,255,.06)' }}>
                  <span className="jz-mono" style={{ width: 34, opacity: 0.6 }}>{s.index}</span>
                  <span style={{ width: 70 }} className="jz-sm">{s.camera}</span>
                  <span className="jz-sm jz-secondary" style={{ flex: 1 }}>{s.description}</span>
                  <span className="jz-sm jz-muted">{s.durationSec}s</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {doc?.consistency ? (
          <Panel title="一致性检查">
            <div className="jz-row" style={{ gap: 8, marginBottom: 8 }}>
              <Badge tone={doc.consistency.ok ? 'ok' : 'danger'}>
                {doc.consistency.ok ? '通过' : '有错误'}
              </Badge>
              <span className="jz-sm jz-muted">共 {doc.consistency.total} 条（显示前 {doc.consistency.shown.length}）</span>
            </div>
            {doc.consistency.shown.length ? (
              <div className="jz-col" style={{ gap: 4 }}>
                {doc.consistency.shown.map((i, k) => (
                  <div key={k} className="jz-sm" style={{ opacity: i.level === 'error' ? 1 : 0.75 }}>
                    <Badge tone={i.level === 'error' ? 'danger' : 'warn'}>{i.level}</Badge> {i.detail}
                  </div>
                ))}
              </div>
            ) : <div className="jz-sm jz-muted">没有发现问题</div>}
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

export default ScriptPage;


