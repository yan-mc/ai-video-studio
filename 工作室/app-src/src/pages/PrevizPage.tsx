/**
 * 预演 / 导演台宿主页 —— 把内置预演引擎的 UI 以 iframe 嵌入。
 *
 * 背景：预演引擎（services/previz/server.mjs，端口 4318）与 5 条 API 路由都已就绪，
 * 缺的只是 SPA 里一个能打开它的页面（审查 G1）。本页就是那个页面。
 *
 * 设计要点：
 *  - 引擎是**跨源**（4318 vs DSH 端口），父页面拿不到子页面状态，故只做嵌入 + 服务控制；
 *  - 服务未就绪时给出「启动服务」按钮（调 POST /previz/start），不白屏；
 *  - 提供「新窗口打开」作为兜底（iframe 在窄屏下体验不佳时）。
 */
import { useCallback, useEffect, useState } from 'react';

import { api, describeError } from '../api/client';
import { Alert, Button, Icon, Page } from '../ui';
import { useT } from '../ui/useT';

interface PrevizHealth {
  ok?: boolean;
  running?: boolean;
  url?: string;
  detail?: string;
}

export function PrevizPage() {
  const t = useT();
  const [health, setHealth] = useState<PrevizHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

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
  const url = String(health?.url ?? 'http://127.0.0.1:4318/');

  return (
    <Page
      title="预演导演台"
      subtitle="3D 白模预演 · 站位与运镜设计"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void refresh()} disabled={busy}>
            {t('app.refresh')}
          </Button>
          <Button
            icon={<Icon name="external" size={15} />}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
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
          <Alert tone="warn">{`预演引擎未运行 · ${health.detail ?? '不可达'}`}</Alert>
        ) : null}

        <div className="jz-col" style={{ flex: 1, minHeight: 420, gap: 'var(--jz-sp-3)' }}>
          <div className="jz-row" style={{ justifyContent: 'space-between' }}>
            <span className="jz-label" style={{ margin: 0 }}>导演台</span>
            <span className="jz-sm jz-muted">{running ? `引擎在线 · ${url}` : '引擎离线'}</span>
          </div>
          {running ? (
            <iframe
              key={reloadNonce}
              src={url}
              title="预演导演台"
              style={{ flex: 1, width: '100%', minHeight: 520, border: 0, borderRadius: 'var(--jz-radius-md)', background: '#0e1012' }}
              allow="fullscreen"
            />
          ) : (
            <div className="jz-col" style={{ alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48 }}>
              <Icon name="cube" size={40} />
              <div className="jz-muted">预演引擎尚未启动</div>
              <Button variant="primary" onClick={() => void handleStart()} disabled={busy}>
                {busy ? '启动中…' : '启动预演引擎'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

export default PrevizPage;

