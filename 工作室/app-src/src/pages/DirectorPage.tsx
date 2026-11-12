/**
 * 3D 导演台 —— 对齐洛书 `directorStudio` 域（501 键 / 88 子域）。
 *
 * 引擎实测能力：
 *  - 58 个动作模板 / 28 个运镜 / 7 个人物 / 10 个道具 / 8 个表演风格
 *  - 15 个 director_* 命令（元素/动作/机位/关键帧/镜头管理/锁定/撤销/校验）
 *
 * 本页做两件事：
 *  1. **嵌入引擎 UI**（真实 3D 操作）
 *  2. **编排层** —— 把镜头卡建成工程、把机位转运镜提示词（预演→控制信号）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import { useProjectStore } from '../store';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Tabs, useToast,
} from '../ui';

interface Cmd { name: string; desc: string; args: string[] }
interface Move { id: string; label: string }
interface CatalogItem { id: string; label: string; description?: string; category?: string }
interface DirectorCatalog {
  actions?: CatalogItem[]; cameras?: CatalogItem[]; actors?: CatalogItem[];
  props?: CatalogItem[]; performances?: CatalogItem[];
}
interface DirectorMeta {
  health: { ok: boolean; base?: string; detail?: string };
  commands: Cmd[];
  cameraMoves: Move[];
  fps: number;
  catalog: DirectorCatalog;
}
interface ShotInfo { id: string; name: string; durationSec?: number; fov?: number }

type TabKey = 'stage' | 'catalog' | 'pipeline';

export function DirectorPage() {
  const toast = useToast();
  const projectId = useProjectStore((s) => s.currentProjectId);
  const [meta, setMeta] = useState<DirectorMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<TabKey>('stage');
  const [nonce, setNonce] = useState(0);

  // 编排层状态
  const [shots, setShots] = useState<ShotInfo[]>([]);
  const [shotId, setShotId] = useState('');
  const [cameraPrompt, setCameraPrompt] = useState<{ shotName: string; motion: string; promptFragment: string; durationSec: number; fov?: number; keyframes?: number } | null>(null);
  const [validateMsg, setValidateMsg] = useState('');
  const [cmdName, setCmdName] = useState('director_validate');
  const [cmdArgs, setCmdArgs] = useState('{}');
  const [cmdResult, setCmdResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await api.directorMeta() as DirectorMeta;
      setMeta(m);
      setErr('');
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!projectId) { setShots([]); return; }
    void (async () => {
      try {
        const list = (await api.listShots(projectId)) as unknown as ShotInfo[];
        setShots(list ?? []);
        if (list?.length && !shotId) setShotId(list[0].id);
      } catch { /* ignore */ }
    })();
  }, [projectId, shotId]);

  const base = meta?.health?.base ?? 'http://127.0.0.1:4318';
  const online = Boolean(meta?.health?.ok);

  async function handleStart() {
    setBusy(true);
    try {
      await api.directorStart();
      await load();
      setNonce((n) => n + 1);
      toast.ok('导演台引擎已启动');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleBuild() {
    if (!projectId || !shotId) { toast.error('请先选项目与镜头'); return; }
    setBusy(true);
    try {
      await api.directorBuild({ projectId, shotId });
      toast.ok('已按镜头卡建导演台工程');
      setNonce((n) => n + 1);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCameraPrompt() {
    if (!shotId) { toast.error('请先选镜头'); return; }
    setBusy(true);
    try {
      const r = await api.directorCameraPrompt({ shotId }) as typeof cameraPrompt;
      setCameraPrompt(r);
      toast.ok('已生成运镜描述');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    setBusy(true);
    try {
      const r = await api.directorValidate() as { project?: unknown; issues?: unknown[] };
      const n = Array.isArray(r?.issues) ? r.issues.length : 0;
      setValidateMsg(n ? `发现 ${n} 个问题` : '校验通过，未发现问题');
      toast.ok('校验完成');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCommand() {
    if (!/^director_[a-z_]+$/.test(cmdName)) { toast.error('命令名必须是 director_*'); return; }
    setBusy(true);
    try {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(cmdArgs || '{}'); } catch { throw new Error('参数不是合法 JSON'); }
      const r = await api.directorCommand({ name: cmdName, arguments: args });
      setCmdResult(JSON.stringify(r, null, 2).slice(0, 4000));
      toast.ok('命令已执行');
      setNonce((n) => n + 1);
    } catch (e) {
      setCmdResult(`错误：${String((e as Error)?.message ?? e)}`);
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => ({
    actions: meta?.catalog?.actions?.length ?? 0,
    cameras: meta?.catalog?.cameras?.length ?? 0,
    actors: meta?.catalog?.actors?.length ?? 0,
    props: meta?.catalog?.props?.length ?? 0,
    performances: meta?.catalog?.performances?.length ?? 0,
  }), [meta]);

  if (loading) return <Page title="3D 导演台"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="3D 导演台"
      subtitle={`${counts.actions} 动作 · ${counts.cameras} 运镜 · ${counts.actors} 人物 · ${counts.props} 道具`}
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button
            icon={<Icon name="download" size={15} />}
            onClick={() => window.open(base, '_blank', 'noopener,noreferrer')}
            disabled={!online}
          >
            新窗口打开
          </Button>
          <Button variant="primary" icon={<Icon name="play" size={15} />} onClick={() => void handleStart()} disabled={busy || online}>
            {online ? '运行中' : busy ? '启动中…' : '启动引擎'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        {!online ? <Alert tone="warn">{`导演台引擎离线 · ${meta?.health?.detail ?? ''}`}</Alert> : null}

        <Tabs<TabKey>
          items={[
            { value: 'stage', label: '3D 舞台' },
            { value: 'catalog', label: '能力库' },
            { value: 'pipeline', label: '预演 → 提示词' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="导演台视图"
        />

        {tab === 'stage' ? (
          online ? (
            <iframe
              key={nonce}
              src={base}
              title="3D 导演台"
              style={{ width: '100%', minHeight: 680, border: 0, borderRadius: 'var(--jz-radius-md)', background: '#0e1012' }}
              allow="fullscreen"
            />
          ) : (
            <div className="jz-col" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, padding: 64 }}>
              <Icon name="cube" size={44} />
              <div className="jz-muted">引擎尚未启动</div>
              <Button variant="primary" onClick={() => void handleStart()} disabled={busy}>启动引擎</Button>
            </div>
          )
        ) : null}

        {tab === 'catalog' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title={`运镜（${counts.cameras}）`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
                {(meta?.catalog?.cameras ?? []).map((c) => (
                  <div key={c.id} className="jz-card" style={{ padding: '6px 8px' }}>
                    <b className="jz-sm">{c.label}</b>
                    <div className="jz-xs jz-muted">{c.id}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={`动作（${counts.actions}）`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                {(meta?.catalog?.actions ?? []).map((c) => (
                  <div key={c.id} className="jz-card" style={{ padding: '6px 8px' }}>
                    <div className="jz-sm">{c.label}</div>
                    <div className="jz-xs jz-muted">{c.category ?? ''}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={`人物 / 道具 / 表演（${counts.actors} / ${counts.props} / ${counts.performances}）`}>
              <div className="jz-row jz-wrap" style={{ gap: 6 }}>
                {[...(meta?.catalog?.actors ?? []), ...(meta?.catalog?.props ?? []), ...(meta?.catalog?.performances ?? [])].map((c) => (
                  <Badge key={c.id}>{c.label}</Badge>
                ))}
              </div>
            </Panel>
            <Panel title={`导演命令（${meta?.commands?.length ?? 0}）`}>
              <div className="jz-col" style={{ gap: 3 }}>
                {(meta?.commands ?? []).map((c) => (
                  <div key={c.name} className="jz-sm">
                    <code className="jz-mono">{c.name}</code>
                    <span className="jz-muted"> · {c.desc}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === 'pipeline' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="1 · 镜头 → 导演台工程">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--jz-sp-3)' }}>
                <Field label="镜头">
                  <Select<string>
                    value={shotId}
                    onChange={setShotId}
                    options={(shots.length ? shots : [{ id: '', name: '（无镜头）' }]).map((s) => ({ value: s.id, label: s.name }))}
                  />
                </Field>
              </div>
              <div className="jz-row" style={{ gap: 8, marginTop: 10 }}>
                <Button variant="primary" onClick={() => void handleBuild()} disabled={busy || !shotId}>
                  按镜头卡建工程
                </Button>
                <Button onClick={() => void handleValidate()} disabled={busy || !online}>校验</Button>
                {validateMsg ? <span className="jz-sm jz-muted">{validateMsg}</span> : null}
              </div>
            </Panel>

            <Panel title="2 · 机位 → 运镜提示词">
              <div className="jz-sm jz-muted" style={{ marginBottom: 8 }}>
                这是 3D 导演台的核心价值：把预演里的机位关键帧转成 H3 能读懂的运镜描述，
                而不是只丢一张参考图。
              </div>
              <Button variant="primary" onClick={() => void handleCameraPrompt()} disabled={busy || !shotId || !online}>
                生成运镜描述
              </Button>
              {cameraPrompt ? (
                <div className="jz-col" style={{ gap: 8, marginTop: 10 }}>
                  <div className="jz-row jz-wrap" style={{ gap: 8 }}>
                    <Badge>{cameraPrompt.shotName}</Badge>
                    <Badge>{cameraPrompt.durationSec}s</Badge>
                    <Badge>FOV {cameraPrompt.fov ?? '—'}</Badge>
                    <Badge>{cameraPrompt.keyframes} 关键帧</Badge>
                  </div>
                  <div className="jz-card" style={{ padding: '10px 12px' }}>
                    <div className="jz-sm">{cameraPrompt.motion}</div>
                  </div>
                  <Field label="可直接粘进镜头的运镜字段">
                    <Input value={cameraPrompt.promptFragment} readOnly mono />
                  </Field>
                </div>
              ) : null}
            </Panel>

            <Panel title="3 · 直接执行导演命令">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 'var(--jz-sp-3)' }}>
                <Field label="命令">
                  <Select<string>
                    value={cmdName}
                    onChange={setCmdName}
                    options={(meta?.commands ?? []).map((c) => ({ value: c.name, label: c.name }))}
                  />
                </Field>
                <Field label="参数（JSON）">
                  <Input value={cmdArgs} onChange={(e) => setCmdArgs(e.target.value)} mono />
                </Field>
              </div>
              <Button style={{ marginTop: 10 }} onClick={() => void handleCommand()} disabled={busy || !online}>执行</Button>
              {cmdResult ? (
                <pre className="jz-mono jz-xs" style={{ marginTop: 10, maxHeight: 260, overflow: 'auto', background: 'var(--jz-bg-sunken)', padding: 10, borderRadius: 6 }}>
                  {cmdResult}
                </pre>
              ) : null}
            </Panel>
          </div>
        ) : null}
      </div>
    </Page>
  );
}

export default DirectorPage;
