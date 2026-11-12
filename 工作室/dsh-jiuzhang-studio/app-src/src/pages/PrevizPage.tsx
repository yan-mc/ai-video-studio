/**
 * 导演台 / 预演 —— 多工作室宿主页。
 *
 * 背景：预演引擎（services/previz/server.mjs，端口 4318）与 API 路由都已就绪，
 * 缺的只是 SPA 里能打开它的页面（审查 G1）。本页统一承载多个 3D 工作台入口。
 *
 * 洛书有六个导演台：3D 导演台 / AI 导演台 / 3D 预演 / 符卡 / 取景器 / 总导演台。
 * 当前引擎提供的是"预演导演台"（3D 白模 + 分镜 + 时间轴），
 * 其余入口在此明确标注状态，不假装可用。
 */
import { useCallback, useEffect, useState } from 'react';

import { api, describeError } from '../api/client';
import { Alert, Badge, Button, Icon, Page, Tabs, useT } from '../ui';

interface PrevizHealth {
  ok?: boolean;
  running?: boolean;
  url?: string;
  detail?: string;
}

interface StudioEntry {
  id: string;
  name: string;
  desc: string;
  /** 引擎里对应的 hash / 路径；null = 尚未接入 */
  hash?: string;
  ready: boolean;
}

/** 六个导演台（洛书 Sm） */
const STUDIOS: StudioEntry[] = [
  { id: 'previz', name: '预演导演台', desc: '3D 白模预演 · 站位与运镜', ready: true },
  { id: 'director3d', name: '3D 导演台', desc: '71 模型 · 行人系统 · 截图 handoff', ready: false },
  { id: 'aiDirector', name: 'AI 导演台', desc: '58 动作 · 28 运镜 · 三轨时间轴', ready: false },
  { id: 'fuka', name: '符卡导演台', desc: '画空间 → 找镜头 · 多轨录制', ready: false },
  { id: 'viewfinder', name: '导演取景器', desc: '26 体素组件 · 6 经典镜头', ready: false },
  { id: 'chief', name: '总导演台', desc: '场景条 · 对象树 · WebCodecs 出片', ready: false },
];

export function PrevizPage() {
  const t = useT();
  const [health, setHealth] = useState<PrevizHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [active, setActive] = useState<string>('previz');

  const refresh = useCallback(async () => {
    try {
      const r = await api.previzHealth();
      setHealth(r as PrevizHealth);
      setErr('');
    } catch (e) {
      setErr(describeError(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function handleStart() {
    setBusy(true);
    setErr('');
    try {
      await api.previzStart();
      await refresh();
      setReloadNonce((n) => n + 1);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const running = Boolean(health?.running ?? health?.ok);
  const base = String(health?.url ?? 'http://127.0.0.1:4318/');
  const current = STUDIOS.find((s) => s.id === active) ?? STUDIOS[0];
  const iframeUrl = current.hash ? `${base}#${current.hash}` : base;

  return (
    <Page
      title="导演台"
      subtitle="3D 预演 · 站位与运镜设计"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void refresh()} disabled={busy}>
            {t('app.refresh')}
          </Button>
          <Button
            icon={<Icon name="download" size={15} />}
            onClick={() => window.open(iframeUrl, '_blank', 'noopener,noreferrer')}
            disabled={!running}
          >
            新窗口打开
          </Button>
          <Button variant="primary" icon={<Icon name="play" size={15} />} onClick={() => void handleStart()} disabled={busy || running}>
            {running ? '运行中' : busy ? '启动中…' : '启动服务'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)', height: '100%' }}>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        {health && !running ? (
          <Alert tone="warn">{`导演台引擎未运行 · ${health.detail ?? '不可达'}`}</Alert>
        ) : null}

        <div className="jz-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs<string>
            items={STUDIOS.map((s) => ({
              value: s.id,
              label: s.ready ? s.name : `${s.name} ⏳`,
            }))}
            value={active}
            onChange={setActive}
            ariaLabel="导演台选择"
          />
          <span className="jz-sm jz-muted">{running ? `引擎在线 · ${base}` : '引擎离线'}</span>
        </div>

        {!current.ready ? (
          <Alert tone="info">
            「{current.name}」尚未接入：{current.desc}。
            当前引擎提供的是「预演导演台」，其余 5 个台需要各自的 3D 资产与交互层。
          </Alert>
        ) : null}

        {running && current.ready ? (
          <iframe
            key={`${active}-${reloadNonce}`}
            src={iframeUrl}
            title={current.name}
            style={{ flex: 1, width: '100%', minHeight: 640, border: 0, borderRadius: 'var(--jz-radius-md)', background: '#0e1012' }}
            allow="fullscreen"
          />
        ) : (
          <div className="jz-col" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, padding: 64 }}>
            <Icon name="cube" size={44} />
            <div className="jz-muted">{running ? `「${current.name}」未接入` : '导演台引擎尚未启动'}</div>
            {!running ? (
              <Button variant="primary" onClick={() => void handleStart()} disabled={busy}>
                {busy ? '启动中…' : '启动引擎'}
              </Button>
            ) : null}
          </div>
        )}

        <PanelHint />
      </div>
    </Page>
  );
}

/** 底部说明：讲清楚现状与差距，避免误以为六个台都能用 */
function PanelHint() {
  return (
    <div className="jz-card" style={{ padding: '10px 12px' }}>
      <div className="jz-row" style={{ gap: 8, marginBottom: 6 }}>
        <b className="jz-sm">六个导演台现状</b>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
        {STUDIOS.map((s) => (
          <div key={s.id} className="jz-row" style={{ gap: 6, opacity: s.ready ? 1 : 0.65 }}>
            <Badge tone={s.ready ? 'ok' : 'default'}>{s.ready ? '已接入' : '待接入'}</Badge>
            <span className="jz-sm">{s.name}</span>
            <span className="jz-xs jz-muted">· {s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PrevizPage;