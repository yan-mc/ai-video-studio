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
import { Alert, Badge, Button, Icon, Page, Panel, Tabs, useT } from '../ui';
import { fileUrl } from '../api/url';

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
  const [rendering, setRendering] = useState(false);
  const [videoResult, setVideoResult] = useState<{ rel: string; seconds: number; frames: number } | null>(null);

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

  /**
   * 白模 → 参考视频。
   *
   * 逐帧渲染预演工程生成 mp4，可直接当 H3 的参考视频。
   * 耗时较长（282 帧约 80 秒），所以给明确的状态反馈。
   */
  async function handleRenderVideo() {
    setRendering(true);
    setErr('');
    setVideoResult(null);
    try {
      const r = await api.previzVideo({ fps: 24, width: 1280, height: 720 }) as {
        rel: string; seconds: number; frames: number;
      };
      setVideoResult(r);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRendering(false);
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
          {/* 白模 → 参考视频：把预演工程逐帧渲成 mp4，供 H3 当参考视频 */}
          <Button
            icon={<Icon name="video" size={15} />}
            onClick={() => void handleRenderVideo()}
            disabled={!running || rendering}
          >
            {rendering ? '渲染中…' : '导出白模视频'}
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

        {/* 白模视频产物：可直接拿去当 H3 的参考视频 */}
        {videoResult ? (
          <Panel title="白模视频已生成">
            <div className="jz-col" style={{ gap: 8 }}>
              <video
                src={fileUrl(videoResult.rel)}
                controls
                style={{ width: '100%', maxHeight: 300, borderRadius: 6, background: '#000' }}
              />
              <div className="jz-xs jz-muted">
                {videoResult.frames} 帧 · {videoResult.seconds.toFixed(2)}s · {videoResult.rel}
              </div>
              <div className="jz-xs jz-muted">
                在「渲染」页把它选作参考视频即可。
              </div>
            </div>
          </Panel>
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