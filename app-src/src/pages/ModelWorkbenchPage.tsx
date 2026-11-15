/**
 * 模特工作台 —— 对齐参考实现 `mw` 域（270 键 / 35 子域）。
 *
 * 双模式：
 *  - 电商拍摄：主品先出图 → 过检 → 并行其余
 *  - 影视角色：定妆照锁定 → 三视图 → 表情/姿态
 *
 * 三栏：作业 / 形象库 / 方案库
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, describeError } from '../api/client';
import {
  Alert, Badge, Button, EmptyState, Field, Icon, IconButton, Input, Loading, Page, Panel,
  Select, Tabs, Textarea, useToast,
} from '../ui';

interface Style { id: string; name: string; hint: string }
interface SizeOpt { id: string; name: string; ratio: string; profile: string }
interface Mode { id: string; name: string; hint: string }
interface StatusOpt { id: string; name: string }

interface Shot {
  index: number; key: string; name: string; camera: string; desc: string;
  stage?: string; custom?: string; status?: string; result?: { path?: string; rel?: string } | null;
  attempts?: number;
}
interface Plan { index: number; name: string; ratio: string; profile: string; prompt: string; key: string; stage: string }
interface MWJob {
  id: string; name: string; mode: string; status: string;
  styleId: string; customStyle: string; sizeId: string; count: number; kind: string;
  shots: Shot[]; plan?: Plan[];
  model?: { desc?: string } | null;
  role?: { desc?: string } | null;
  createdAt: number;
}
interface SavedPlan { id: string; name: string; mode: string; count: number; usedCount: number; createdAt: number }
interface Figure { id: string; name: string; locked?: boolean; kind?: string; createdAt?: number }

interface MWMeta {
  modes: Mode[]; status: StatusOpt[];
  ecomStyles: Style[]; filmStyles: Style[];
  sizes: SizeOpt[];
  suite: { ecom: string[]; person: string[]; beast: string[] };
}

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'default'> = {
  draft: 'default', queued: 'default', preparing: 'warn', generating: 'warn',
  done: 'ok', interrupted: 'warn', canceled: 'default', failed: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', queued: '排队中', preparing: '备料中', generating: '生成中',
  done: '已完成', interrupted: '已中断', canceled: '已取消', failed: '失败',
};

type NavKey = 'jobs' | 'figures' | 'plans';

export function ModelWorkbenchPage() {
  const toast = useToast();
  const [nav, setNav] = useState<NavKey>('jobs');
  const [meta, setMeta] = useState<MWMeta | null>(null);
  const [jobs, setJobs] = useState<MWJob[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [current, setCurrent] = useState<MWJob | null>(null);
  /** 正在出图的作业 id（用于按钮 loading 态；后端是异步的，不会阻塞其它操作） */
  const [generatingId, setGeneratingId] = useState('');

  // 新建表单
  const [creating, setCreating] = useState(false);
  const [fMode, setFMode] = useState<'ecom' | 'film'>('ecom');
  const [fStyle, setFStyle] = useState('studio-clean');
  const [fSize, setFSize] = useState('ecom-sq');
  const [fCount, setFCount] = useState('6');
  const [fKind, setFKind] = useState<'person' | 'beast'>('person');
  const [fCustom, setFCustom] = useState('');
  const [fModelDesc, setFModelDesc] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, j, p, f] = await Promise.all([
        api.mwMeta(), api.mwJobs(), api.mwPlans(), api.mwFigures(),
      ]);
      setMeta(m as MWMeta);
      setJobs(j as MWJob[]);
      setPlans(p as SavedPlan[]);
      setFigures(f as Figure[]);
      setErr('');
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function handleCreate() {
    setBusy(true);
    try {
      const job = await api.mwCreateJob({
        mode: fMode,
        styleId: fStyle,
        customStyle: fCustom,
        sizeId: fSize,
        count: Number(fCount) || 6,
        kind: fKind,
        model: fMode === 'ecom' && fModelDesc ? { desc: fModelDesc } : undefined,
        role: fMode === 'film' && fModelDesc ? { desc: fModelDesc } : undefined,
      }) as MWJob;
      setJobs((prev) => [job, ...prev]);
      setCurrent(job);
      setCreating(false);
      toast.ok(`已建作业「${job.name}」· ${job.count} 张`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`删除选中的 ${ids.length} 个作业？此操作不可撤销。`)) return;
    setBusy(true);
    try {
      const r = await api.mwDeleteJobs(ids) as { removed: number };
      setJobs((prev) => prev.filter((j) => !ids.includes(j.id)));
      setCurrent((c) => (c && ids.includes(c.id) ? null : c));
      toast.ok(`已删除 ${r.removed} 个作业`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  /** 删除形象 —— 后端 /mw/figure/delete 一直存在但前端没有入口，形象库只增不减 */
  async function handleDeleteFigure(id: string, name: string) {
    if (!window.confirm(`删除形象「${name}」？`)) return;
    setBusy(true);
    try {
      await api.mwDeleteFigure(id);
      setFigures((prev) => prev.filter((f) => f.id !== id));
      toast.ok('已删除形象');
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePlan(job: MWJob) {
    const name = window.prompt('方案名称', `${job.name} 方案`);
    if (name === null) return;
    setBusy(true);
    try {
      const p = await api.mwSavePlan({ jobId: job.id, name }) as SavedPlan;
      setPlans((prev) => [p, ...prev]);
      toast.ok('已存为方案');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * 生成套图。
   *
   * 为什么以前出不了图：后端 `/mw/job/generate` 一直是通的，
   * 但前端**没有调用点**（api.mwGenerateJob 定义了却全站零引用）。
   * 这里补上入口；后端立即返回、异步跑，所以这里只负责提交 + 起轮询。
   */
  async function handleGenerate(id: string) {
    setGeneratingId(id);
    try {
      await api.mwGenerateJob({ id });
      toast.ok('已提交出图，完成后会自动刷新');
      // 立刻拉一次，让状态从 draft 变 queued
      await refreshJobs();
      // 之后靠轮询（见下方 effect）跟进
      pollUntilDone(id);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setGeneratingId('');
    }
  }

  /** 重算提示词（改了风格/描述之后要手动触发） */
  async function handleReplan(id: string) {
    setBusy(true);
    try {
      const job = await api.mwReplanJob(id) as MWJob;
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)));
      setCurrent((c) => (c?.id === id ? job : c));
      toast.ok('提示词已重算');
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  /** 只刷 jobs 列表（不碰 loading，避免整页闪一下） */
  const refreshJobs = useCallback(async () => {
    try {
      const j = await api.mwJobs() as MWJob[];
      setJobs(j);
      setCurrent((c) => (c ? (j.find((x) => x.id === c.id) ?? c) : c));
    } catch { /* 轮询失败不打扰用户 */ }
  }, []);

  /**
   * 出图轮询。
   *
   * 为什么用轮询而不是等 generate 返回：后端把 runGeneration 挂在
   * `void (async () => …)` 上立即返回，一次套图要 10 张 × 45–90 秒，
   * 不可能在一个 HTTP 请求里等完。
   * 到终态（done/failed/canceled）就停。
   */
  const pollTimer = useRef<number | null>(null);
  /**
   * jobs 的最新快照。
   *
   * 轮询回调是在 setInterval 里跑的，闭包捕获的 `jobs` 会停在注册那一刻。
   * 用 ref 跟住最新值，避免"刚生成完却判断成还没完"。
   */
  const jobsRef = useRef<MWJob[]>([]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  function pollUntilDone(id: string) {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    let ticks = 0;
    pollTimer.current = window.setInterval(() => {
      ticks += 1;
      void (async () => {
        await refreshJobs();
        const j = (jobsRef.current ?? []).find((x) => x.id === id);
        const settled = j && ['done', 'failed', 'canceled', 'interrupted'].includes(j.status);
        // 最多轮 20 分钟（10 张 × 90 秒 + 余量），或到终态
        if (settled || ticks > 240) {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      })();
    }, 5000);
  }

  useEffect(() => () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
  }, []);

  const styles = useMemo(
    () => (fMode === 'film' ? meta?.filmStyles : meta?.ecomStyles) ?? [],
    [fMode, meta],
  );
  const sizes = useMemo(
    () => (meta?.sizes ?? []).filter((s) => s.id.startsWith(fMode === 'film' ? 'film-' : 'ecom-')),
    [fMode, meta],
  );

  /** 当前作业里已出的张数（出图进度用） */
  const doneCount = useMemo(
    () => (current?.shots ?? []).filter((s) => s.status === 'done').length,
    [current],
  );

  if (loading) return <Page title="模特工作台"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="模特工作台"
      subtitle="电商拍摄 · 影视角色 · 双模式套件"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void loadAll()} disabled={busy}>刷新</Button>
          <Button variant="primary" icon={<Icon name="plus" size={15} />} onClick={() => setCreating((v) => !v)} disabled={busy}>
            新建作业
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {err ? <Alert tone="danger">{err}</Alert> : null}

        <Tabs<NavKey>
          items={[
            { value: 'jobs', label: `作业（${jobs.length}）` },
            { value: 'figures', label: `形象库（${figures.length}）` },
            { value: 'plans', label: `方案库（${plans.length}）` },
          ]}
          value={nav}
          onChange={setNav}
          ariaLabel="模特工作台导航"
        />

        {/* 新建表单 */}
        {creating ? (
          <Panel title="新建作业">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--jz-sp-3)' }}>
              <Field label="模式">
                <Select<string>
                  value={fMode}
                  onChange={(v) => {
                    setFMode(v as 'ecom' | 'film');
                    setFStyle(v === 'film' ? 'ancient' : 'studio-clean');
                    setFSize(v === 'film' ? 'film-169' : 'ecom-sq');
                  }}
                  options={(meta?.modes ?? []).map((m) => ({ value: m.id, label: m.name }))}
                />
              </Field>
              <Field label="风格">
                <Select<string>
                  value={fStyle}
                  onChange={setFStyle}
                  options={styles.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <Field label="尺寸">
                <Select<string>
                  value={fSize}
                  onChange={setFSize}
                  options={sizes.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              {fMode === 'ecom' ? (
                <Field label="张数" hint="改张数自动换套件">
                  <Input value={fCount} onChange={(e) => setFCount(e.target.value)} mono />
                </Field>
              ) : (
                <Field label="套件">
                  <Select<string>
                    value={fKind}
                    onChange={(v) => setFKind(v as 'person' | 'beast')}
                    options={[
                      { value: 'person', label: '人物 · 13 张' },
                      { value: 'beast', label: '神兽 · 10 张' },
                    ]}
                  />
                </Field>
              )}
            </div>
            <Field label="自定义风格" hint="写了就用你的原文，覆盖预设">
              <Input value={fCustom} onChange={(e) => setFCustom(e.target.value)} placeholder="一句话，如：法式慵懒，奶油色调" />
            </Field>
            <Field label={fMode === 'ecom' ? '模特描述' : '角色描述'}>
              <Textarea value={fModelDesc} onChange={(e) => setFModelDesc(e.target.value)} rows={2}
                placeholder={fMode === 'ecom' ? '年轻女性，中长发，自然妆容' : '古装男主，束发，剑眉，玄色长袍'} />
            </Field>
            <div className="jz-row" style={{ gap: 8, marginTop: 10 }}>
              <Button variant="primary" onClick={() => void handleCreate()} disabled={busy}>
                {busy ? '创建中…' : '创建作业'}
              </Button>
              <Button onClick={() => setCreating(false)}>取消</Button>
              <span className="jz-sm jz-muted">
                将生成 {fMode === 'film' ? (fKind === 'person' ? 13 : 10) : Number(fCount) || 6} 张
              </span>
            </div>
          </Panel>
        ) : null}

        {nav === 'jobs' ? (
          jobs.length === 0 ? (
            <EmptyState icon="cube" title="还没有作业"
              hint="拍一件衣服的正面、背面、细节，丢进来，选个风格，剩下交给它。" />
          ) : (
            <Panel flush>
              <div className="jz-table__wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="jz-table">
                  <thead>
                    <tr>
                      <th>作业名</th>
                      <th style={{ width: 80 }}>模式</th>
                      <th style={{ width: 90 }}>状态</th>
                      <th style={{ width: 60, textAlign: 'right' }}>张数</th>
                      <th style={{ width: 140 }}>时间</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} onClick={() => setCurrent(j)} style={{ cursor: 'pointer' }}>
                        <td><span className="jz-truncate">{j.name}</span></td>
                        <td><Badge>{j.mode === 'film' ? '影视' : '电商'}</Badge></td>
                        <td><Badge tone={STATUS_TONE[j.status] ?? 'default'}>{STATUS_LABEL[j.status] ?? j.status}</Badge></td>
                        <td style={{ textAlign: 'right' }} className="jz-mono jz-xs">{j.count}</td>
                        <td className="jz-xs jz-muted">{new Date(j.createdAt).toLocaleString('zh-CN')}</td>
                        <td>
                          <div className="jz-row" style={{ gap: 4 }}>
                            <IconButton label="存为方案" onClick={(e) => { e.stopPropagation(); void handleSavePlan(j); }}>
                              <Icon name="check" size={14} />
                            </IconButton>
                            <IconButton label="删除" onClick={(e) => { e.stopPropagation(); void handleDelete([j.id]); }}>
                              <Icon name="trash" size={14} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )
        ) : nav === 'figures' ? (
          figures.length === 0 ? (
            <EmptyState icon="image" title="还没有形象"
              hint="填一张属性表，先出定妆图给你看；锁定后这张脸就用遍全剧。" />
          ) : (
            <Panel title={`形象库（${figures.length}）`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {figures.map((f) => (
                  <div key={f.id} className="jz-card" style={{ padding: 10 }}>
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <b>{f.name}</b>
                      <Badge tone={f.locked ? 'ok' : 'warn'}>{f.locked ? '已锁定' : '未锁定'}</Badge>
                    </div>
                    <div className="jz-sm jz-muted" style={{ marginTop: 4 }}>{f.kind ?? '人物'}</div>
                    <div className="jz-row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                      <IconButton
                        label={`删除 ${f.name}`}
                        size={15}
                        onClick={() => void handleDeleteFigure(f.id, f.name)}
                      >
                        <Icon name="trash" size={15} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )
        ) : plans.length === 0 ? (
          <EmptyState icon="file" title="还没有方案"
            hint="在作业里点「存为方案」，这里就会出现——下次同款拍摄一键复用。" />
        ) : (
          <Panel title={`方案库（${plans.length}）`}>
            <div className="jz-col" style={{ gap: 6 }}>
              {plans.map((p) => (
                <div key={p.id} className="jz-card" style={{ padding: '8px 10px' }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                    <div className="jz-row" style={{ gap: 8 }}>
                      <b>{p.name}</b>
                      <Badge>{p.mode === 'film' ? '影视' : '电商'}</Badge>
                      <span className="jz-sm jz-muted">{p.count} 张 · 用过 {p.usedCount} 次</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* 作业详情 */}
        {current ? (
          <Panel
            title={`作业详情 · ${current.name}`}
            actions={<Button onClick={() => setCurrent(null)}>关闭</Button>}
          >
            <div className="jz-col" style={{ gap: 10 }}>
              <div className="jz-row jz-wrap" style={{ gap: 8 }}>
                <Badge tone={STATUS_TONE[current.status] ?? 'default'}>{STATUS_LABEL[current.status] ?? current.status}</Badge>
                <Badge>{current.mode === 'film' ? '影视' : '电商'}</Badge>
                <Badge>{current.count} 张</Badge>
                {current.customStyle ? <Badge tone="warn">自定义风格</Badge> : null}
              </div>
              <div className="jz-label" style={{ margin: 0 }}>镜头清单 · {current.shots.length} 张</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {current.shots.map((s) => (
                  <div key={s.key} className="jz-card" style={{ padding: '7px 9px' }}>
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <b className="jz-sm">{s.index}. {s.name}</b>
                      <Badge tone={s.status === 'done' ? 'ok' : s.status === 'failed' ? 'danger' : 'default'}>
                        {s.status ?? 'queued'}
                      </Badge>
                    </div>
                    <div className="jz-xs jz-muted" style={{ marginTop: 3 }}>{s.camera}</div>
                    <div className="jz-xs jz-muted">{s.desc}</div>
                  </div>
                ))}
              </div>

              {current.plan?.length ? (
                <>
                  <div className="jz-label" style={{ margin: 0 }}>提示词计划</div>
                  <div className="jz-col" style={{ gap: 4 }}>
                    {current.plan.map((p) => (
                      <details key={p.key} className="jz-card" style={{ padding: '6px 9px' }}>
                        <summary className="jz-sm" style={{ cursor: 'pointer' }}>
                          {p.index}. {p.name} <span className="jz-muted">[{p.ratio}]</span>
                        </summary>
                        <div className="jz-xs jz-muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{p.prompt}</div>
                      </details>
                    ))}
                  </div>
                </>
              ) : null}

              {/* ⚠️ 这里以前只有一句提示「图像生成等待接入后即可自动跑通」，
                  但 H3-Image 其实早就接通了（/mw/job/generate → runH3Image）。
                  问题的真身是：前端**没有出图按钮**，api.mwGenerateJob 定义了
                  却全站零调用 → 用户建完作业只能看提示词，永远出不了图。
                  现在补上按钮，并把过期的 Alert 换成真实进度。 */}
              <div className="jz-row jz-wrap" style={{ gap: 8 }}>
                <Button
                  variant="primary"
                  icon={<Icon name="image" size={15} />}
                  onClick={() => void handleGenerate(current.id)}
                  disabled={busy || generatingId === current.id}
                >
                  {generatingId === current.id ? '出图中…' : '生成套图'}
                </Button>
                <Button
                  icon={<Icon name="refresh" size={15} />}
                  onClick={() => void handleReplan(current.id)}
                  disabled={busy}
                >
                  重算提示词
                </Button>
                <span className="jz-sm jz-muted">
                  共 {current.shots.length} 张，已出 {doneCount}
                </span>
              </div>

              {doneCount < current.shots.length ? (
                <Alert tone="info">
                  「生成套图」会按「定妆/主图先行 → 过检 → 并行其余」的顺序串行出图；
                  单张约 45–90 秒（12GB 显存），可随时关闭本页，任务在后端继续。
                </Alert>
              ) : null}
            </div>
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

export default ModelWorkbenchPage;