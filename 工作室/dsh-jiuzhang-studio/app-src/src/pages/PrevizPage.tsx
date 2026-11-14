/**
 * 3D 预演 —— Blender 渲染控制序列 + 预览。
 *
 * 页面职责（三层）：
 *   1. **看**：渲一段彩色灰模预览（preview），用户能直接看到"我到底做了个什么动画"
 *   2. **渲**：把同一场景渲成 H3 的控制通道（depth / pose / canny / gray）
 *   3. **改**：一键用桌面 Blender 打开 .blend，真·随便调
 *
 * 为什么不做内嵌 WASM Blender：
 *   浏览器里跑 WASM Blender 需要 COOP/COEP 跨源隔离头（会限制整个 SPA 的跨源资源），
 *   且它在 12GB 笔记本上的编辑流畅度未验证。装桌面版的人直接开原生窗口体验更好，
 *   也真能调；没装的人看预览 + 在渲染页改走位参数即可。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, describeError } from '../api/client';
import { Alert, Badge, Button, Icon, Page, Panel, useT } from '../ui';
import { fileUrl } from '../api/url';
import type { BlenderHealth, BlenderRenderResult } from '../api/types';

/** 喂给 H3 的控制通道 */
const CONTROL_MODES: Array<{ id: string; label: string; desc: string }> = [
  { id: 'depth', label: 'depth', desc: '灰度深度 · 最通用，锁走位/遮挡/景深' },
  { id: 'pose', label: 'pose', desc: '人物剪影 · 锁动作与站位' },
  { id: 'canny', label: 'canny', desc: '硬边缘 · 锁建筑/道具结构' },
  { id: 'gray', label: 'gray', desc: '灰模整体 · 锁光影布局' },
];

export function PrevizPage() {
  const t = useT();
  const [health, setHealth] = useState<BlenderHealth | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<Record<string, BlenderRenderResult>>({});
  const [preview, setPreview] = useState<BlenderRenderResult | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setHealth(await api.blenderHealth());
      setErr('');
    } catch (e) {
      setErr(describeError(e));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /** 渲一路（preview 走同一条路，只是 mode 不同） */
  async function render(mode: string) {
    setBusy(mode);
    setErr('');
    setMsg('');
    try {
      const r = await api.blenderRender({ mode });
      if (mode === 'preview') setPreview(r);
      else setResults((prev) => ({ ...prev, [mode]: r }));
      setMsg(`${mode}：${r.frames} 帧 / ${r.seconds}s`);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy('');
    }
  }

  /** 用桌面 Blender 打开最近/指定场景 */
  async function openBlender(blendRel?: string) {
    setErr('');
    setMsg('');
    try {
      const r = await api.blenderOpen(blendRel);
      setMsg(r.detail ?? '已启动 Blender');
    } catch (e) {
      setErr(describeError(e));
    }
  }

  const ready = Boolean(health?.ok);
  const previewUrl = preview ? fileUrl(preview.rel) : '';

  return (
    <Page
      title="3D 预演"
      subtitle="Blender 建模 → 控制序列 → H3"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void refresh()}>
            {t('app.refresh')}
          </Button>
          <Button disabled={!ready || Boolean(busy)} onClick={() => void render('preview')}>
            {busy === 'preview' ? '渲染中…' : '渲预览'}
          </Button>
        </>
      }
    >
      {err ? <Alert tone="danger">{err}</Alert> : null}
      {msg && !err ? <Alert tone="info">{msg}</Alert> : null}

      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {/* ---------------- 预览：用户"看到自己做了什么" ---------------- */}
        <Panel
          title="动画预览"
          actions={(
            <>
              <Button
                disabled={!ready || Boolean(busy)}
                onClick={() => void render('preview')}
              >
                {busy === 'preview' ? '渲染中…' : preview ? '重渲' : '渲染预览'}
              </Button>
              <Button
                disabled={!ready}
                onClick={() => void openBlender(preview?.blendRel)}
                title="用桌面 Blender 打开这个场景，可以随便调"
              >
                在 Blender 中编辑
              </Button>
            </>
          )}
        >
          {previewUrl && preview ? (
            <div className="jz-col" style={{ gap: 8 }}>
              <video
                ref={videoRef}
                key={previewUrl}
                src={previewUrl}
                controls
                autoPlay
                loop
                muted
                style={{ width: '100%', borderRadius: 6, background: '#000' }}
              />
              <div className="jz-xs jz-muted jz-mono" style={{ wordBreak: 'break-all' }}>
                {preview.frames} 帧 · {preview.seconds}s · {preview.rel}
              </div>
            </div>
          ) : (
            <div className="jz-col" style={{ alignItems: 'center', gap: 10, padding: 36 }}>
              <Icon name="cube" size={40} />
              <div className="jz-muted">还没有预览。点「渲染预览」渲一段彩色灰模动画。</div>
              <div className="jz-xs jz-muted">
                预览用的是镜头卡里的走位与机位 —— 去「渲染页 → 3D 走位」调参数后再回来。
              </div>
            </div>
          )}
        </Panel>

        {/* ---------------- 状态 ---------------- */}
        <Panel title="引擎状态">
          <div className="jz-row" style={{ justifyContent: 'space-between' }}>
            <span className="jz-sm">Blender</span>
            <Badge tone={ready ? 'ok' : 'warn'}>{ready ? '已就绪' : '未安装'}</Badge>
          </div>
          {health?.exe ? (
            <div className="jz-xs jz-muted jz-mono" style={{ marginTop: 4, wordBreak: 'break-all' }}>
              {health.exe}
            </div>
          ) : null}
          {!ready ? (
            <Alert tone="warn">
              {health?.detail ?? '未找到 Blender'}
              <div className="jz-xs" style={{ marginTop: 6 }}>
                把 Blender 便携版放到 <code>工作室/tools/blender-&lt;版本&gt;/</code>，
                或设置环境变量 <code>DSH_BLENDER</code> 指向 blender.exe。
              </div>
            </Alert>
          ) : null}
        </Panel>

        {/* ---------------- 控制通道 ---------------- */}
        <Panel title="控制通道（喂给 H3）">
          <div className="jz-xs jz-muted" style={{ marginBottom: 10 }}>
            与预览同一场景，只是渲染成 ControlNet 需要的条件图。
            渲完在「渲染页 → 控制视频」里选它。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {CONTROL_MODES.map((m) => {
              const r = results[m.id];
              return (
                <div key={m.id} className="jz-card" style={{ padding: 10 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <b className="jz-sm">{m.label}</b>
                    <Button
                      disabled={!ready || Boolean(busy)}
                      onClick={() => void render(m.id)}
                    >
                      {busy === m.id ? '渲染中…' : '渲染'}
                    </Button>
                  </div>
                  <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>{m.desc}</div>
                  {r ? (
                    <div className="jz-xs jz-mono" style={{ marginTop: 6, wordBreak: 'break-all' }}>
                      {r.frames} 帧 / {r.seconds}s
                      <div className="jz-muted">{r.rel}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="jz-card" style={{ padding: '10px 12px' }}>
          <b className="jz-sm">工作流</b>
          <div className="jz-xs jz-muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
            ① 渲染页「3D 走位」配好角色/道具/机位 → ② 这里渲预览确认动画没问题 →
            ③ 渲 depth（或 pose/gray）当控制通道 → ④ 渲染页选该控制视频 → ⑤ 生成。
            <br />
            提示词要描述画面里**真实存在**的东西（人数、主要道具、机位方向），
            否则前几秒会被提示词抢走 —— 实测见
            <code> docs/probes/h3-controlnet-2026-11-14/REPORT.md</code>。
          </div>
        </div>
      </div>
    </Page>
  );
}

export default PrevizPage;
