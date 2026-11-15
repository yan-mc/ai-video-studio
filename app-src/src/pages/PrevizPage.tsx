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
import { Alert, Badge, Button, Field, Icon, Page, Panel, Select, useT } from '../ui';
import { fileUrl } from '../api/url';
import { useProjectStore } from '../store/project';
import type { BlenderHealth, BlenderRenderResult } from '../api/types';

/**
 * 三条产出路线 —— 名称与后端 BLENDER_MODES 对齐。
 *
 * ⚠️ 这里刻意把「灰模参考视频」放在最前并标成推荐。
 *    以前页面只列四个控制通道，用户看到的就是"必须渲 depth/pose/canny/gray"，
 *    而那条路要多下 4.22 GB 的 control patch、单镜耗时 +83%、通道之间还会
 *    互相打架（skip 相加 → 过饱和）。
 *
 *    社区主流其实简单得多：**渲一段灰模视频，当参考视频喂给 Ref2VA**。
 *    零额外模型、实测 180° 环绕 6/6 成功（纯文字 0/6 稳定）。
 *    控制塔只在"必须硬锁结构"时才用。
 */
const REFERENCE_MODES: Array<{ id: string; label: string; desc: string }> = [
  {
    id: 'blockout',
    label: 'blockout',
    desc: '灰模参考视频 · 推荐。填进「参考视频」走 Ref2VA，不需要额外模型；平光无阴影，只表达运动与空间',
  },
];

const CONTROL_MODES: Array<{ id: string; label: string; desc: string }> = [
  { id: 'depth', label: 'depth', desc: '逆深度 · 控制塔用，锁走位/遮挡/景深（近白远黑）' },
  { id: 'pose', label: 'pose', desc: 'OpenPose 骨架 · 控制塔用，锁动作与站位（黑底彩线）' },
  { id: 'canny', label: 'canny', desc: '硬边缘 · 控制塔用，锁建筑/道具结构（黑底白线）' },
  { id: 'gray', label: 'gray', desc: '灰模整体 · 控制塔用，锁光影布局' },
];

type ShotLite = {
  id: string;
  title?: string;
  updatedAt?: number;
  durationSec?: number;
  ratio?: string;
  actors?: unknown[];
};


export function PrevizPage() {
  const t = useT();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const projects = useProjectStore((s) => s.projects);

  const [health, setHealth] = useState<BlenderHealth | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<Record<string, BlenderRenderResult>>({});
  const [preview, setPreview] = useState<BlenderRenderResult | null>(null);
  const [shots, setShots] = useState<ShotLite[]>([]);
  const [shotId, setShotId] = useState('');
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
  useEffect(() => { if (!projects.length) void loadProjects(); }, [projects.length, loadProjects]);

  /**
   * 载入当前项目的镜头列表。
   *
   * ⚠️ 历史缺陷（P0）：这个页面**完全不读项目上下文**，
   *    「渲染」按钮调用的是 `api.blenderRender({ mode })` —— 只带 mode。
   *    后端 /blender/render 在既无 shot 又无 projectId/shotId 时
   *    直接 404 SHOT_NOT_FOUND，所以四个控制通道按钮**必然失败**，
   *    且用户只看到一个裸错误码。
   *
   * 现在：跟随当前项目，列出它的镜头，默认选最近一张。
   */
  const loadShots = useCallback(async (projectId: string) => {
    try {
      const list = (await api.listShots(projectId)) as unknown as ShotLite[];
      const sorted = [...list].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
      setShots(sorted);
      setShotId((prev) => (prev && sorted.some((s) => s.id === prev) ? prev : (sorted[0]?.id ?? '')));
      return sorted;
    } catch {
      setShots([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!currentProjectId) { setShots([]); setShotId(''); return; }
    void loadShots(currentProjectId);
  }, [currentProjectId, loadShots]);

  /** 渲一路（preview 走同一条路，只是 mode 不同） */
  async function render(mode: string) {
    if (!currentProjectId) { setErr('先在顶部选一个项目'); return; }
    if (!shotId) {
      setErr('这个项目还没有镜头卡。请先到「渲染页 → 3D 走位」配好走位并保存，或先渲一次预览。');
      return;
    }
    setBusy(mode);
    setErr('');
    setMsg('');
    try {
      const r = await api.blenderRender({ mode, projectId: currentProjectId, shotId });
      if (mode === 'preview') setPreview(r);
      else setResults((prev) => ({ ...prev, [mode]: r }));
      setMsg(`${mode}：${r.frames} 帧 / ${r.seconds}s`);
      /**
       * ⚠️ 占位人偶必须显式警告。
       *
       * 镜头卡没配 actors 时 Blender 会渲"两人对峙"占位人偶 —— 而 H3 会把
       * 参考视频里的这两个人当成**真实主体**，输出里真的出现两个人形剪影。
       * 实测截图见 docs/probes/。用户以为只要求了一个角色，结果多出两个人。
       *
       * 这是**渲染成功但结果不可用**的一类失败，不能只写在 msg 里。
       */
      if (Array.isArray(r.warnings) && r.warnings.length) {
        setErr(r.warnings.join('；'));
        if (mode !== 'preview') {
          const ok = window.confirm(
            `${r.warnings[0]}\n\n仍要把这段产物当参考/控制视频用吗？\n`
            + '（点「取消」可先去渲染页配好走位再回来渲）',
          );
          if (!ok) {
            setResults((prev) => {
              const next = { ...prev };
              delete next[mode];
              return next;
            });
            setErr('已放弃使用这份占位人偶产物。请先在「渲染页 → 3D 走位」配好角色。');
          }
        }
      }
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
  const currentShot = shots.find((s) => s.id === shotId);
  const canRender = ready && Boolean(currentProjectId) && Boolean(shotId) && !busy;

  return (
    <Page
      title="3D 预演"
      subtitle="Blender 建模 → 控制序列 → H3"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void refresh()}>
            {t('app.refresh')}
          </Button>
          <Button disabled={!canRender} onClick={() => void render('preview')}>
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
              <Button disabled={!canRender} onClick={() => void render('preview')}>
                {busy === 'preview' ? '渲染中…' : preview ? '重渲' : '渲染预览'}
              </Button>
              <Button
                disabled={!ready || !preview?.blendRel}
                onClick={() => void openBlender(preview?.blendRel)}
                title={preview?.blendRel
                  ? '用桌面 Blender 打开这个场景，可以随便调'
                  : '先渲一次，才有对应的 .blend 可以打开'}
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
        {/* ---------------- 场景来源（项目 + 镜头） ---------------- */}
        <Panel title="渲染哪个场景">
          {!currentProjectId ? (
            <Alert tone="warn">
              还没选项目。3D 预演要用镜头卡里的走位与机位，请先在顶部选择项目。
            </Alert>
          ) : shots.length === 0 ? (
            <Alert tone="warn">
              项目里还没有镜头卡。先去「渲染页 → 3D 走位」配好角色/道具/机位并保存
              （或直接渲染一次），回来这里才有东西可渲。
            </Alert>
          ) : (
            <div className="jz-col" style={{ gap: 6 }}>
              <Field label="镜头">
                <Select<string>
                  value={shotId}
                  onChange={setShotId}
                  options={shots.map((s) => ({
                    value: s.id,
                    label: `${s.title || s.id} · ${s.durationSec ?? '?'}s · ${s.actors?.length ?? 0} 人`,
                  }))}
                />
              </Field>
              {currentShot ? (
                <div className="jz-xs jz-muted">
                  当前镜头：{currentShot.title || currentShot.id}
                  {' · '}{currentShot.actors?.length ?? 0} 个角色
                  {' · '}{currentShot.durationSec ?? '?'} 秒
                  {' · '}{currentShot.ratio ?? '16:9'}
                  {(currentShot.actors?.length ?? 0) === 0 ? (
                    <span style={{ color: 'var(--jz-warn-text, #e0a030)' }}>
                      {' '}（没有走位数据，Blender 会用「默认两人对峙」占位）
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </Panel>

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

        {/* ---------------- 参考视频（常规路线）---------------- */}
        <Panel title="灰模参考视频（推荐路线）">
          <div className="jz-xs jz-muted" style={{ marginBottom: 10 }}>
            Blender 只负责<b>运动与空间</b>，出一段灰模视频当参考视频。
            不需要任何额外模型；渲完在「渲染页 → 参考视频」里选它，
            提示词用 <code>&lt;Video 1&gt;</code> 声明「只取运镜/走位/节奏」。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {REFERENCE_MODES.map((m) => {
              const r = results[m.id];
              return (
                <div key={m.id} className="jz-card" style={{ padding: 10, borderColor: 'var(--jz-accent)' }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <b className="jz-sm">{m.label}</b>
                    <Button variant="primary" disabled={!canRender} onClick={() => void render(m.id)}>
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

        {/* ---------------- 控制通道 ---------------- */}
        <Panel title="控制通道（ControlNet · 需要额外模型）">
          <div className="jz-xs jz-muted" style={{ marginBottom: 10 }}>
            与预览同一场景，渲成 Fun ControlNet 需要的条件图。
            <b> 需要额外 4.22 GB 控制模型</b>，单镜耗时 +83%；通道叠加会互相打架
            （建议 depth 0.3 + pose 0.7）。<br />
            渲完在「渲染页 → 控制视频」里选它 —— <b>不是</b>参考视频那一栏。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {CONTROL_MODES.map((m) => {
              const r = results[m.id];
              return (
                <div key={m.id} className="jz-card" style={{ padding: 10 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <b className="jz-sm">{m.label}</b>
                    <Button disabled={!canRender} onClick={() => void render(m.id)}>
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
            <b>常规路线（推荐）</b>：① 渲染页「3D 走位」配好角色/道具/机位 →
            ② 这里渲预览确认动画 →
            ③ 渲 <code>blockout</code> 灰模视频 → ④ 渲染页「参考视频」里选它 →
            ⑤ 生成。提示词用 <code>&lt;Video 1&gt;</code> 声明只取运镜/走位/节奏。
            <br />
            <b>控制塔路线</b>（只在必须硬锁结构时）：③′ 渲 depth/pose →
            ④′ 渲染页「控制视频」里选它 → ⑤′ 生成，并按 depth 0.3 + pose 0.7 配比。
            <br />
            两条路都要：提示词描述画面里<b>真实存在</b>的东西（人数、主要道具、机位方向），
            否则前几秒会被提示词抢走 —— 实测见
            <code> docs/probes/h3-controlnet-2026-11-14/REPORT.md</code>。
          </div>
        </div>
      </div>
    </Page>
  );
}

export default PrevizPage;
