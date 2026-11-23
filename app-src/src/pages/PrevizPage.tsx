/**
 * 3D 预演 —— Blender 渲染灰模参考视频 + 预览。
 *
 * 页面职责（三层）：
 *   1. **看**：渲一段彩色灰模预览（preview），用户能直接看到"我到底做了个什么动画"
 *   2. **渲**：把同一场景渲成灰模参考视频（blockout），填进镜头「参考视频」
 *   3. **改**：一键用桌面 Blender 打开 .blend，真·随便调
 *
 * 为什么不做内嵌 WASM Blender：
 *   浏览器里跑 WASM Blender 需要 COOP/COEP 跨源隔离头（会限制整个 SPA 的跨源资源），
 *   且它在 12GB 笔记本上的编辑流畅度未验证。装桌面版的人直接开原生窗口体验更好，
 *   也真能调；没装的人看预览 + 在渲染页改走位参数即可。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, describeError } from '../api/client';
import { Alert, Badge, Button, Field, Icon, Page, Panel, Select, useT, useToast } from '../ui';
import { fileUrl } from '../api/url';
import { useProjectStore } from '../store/project';
import type { BlenderHealth, BlenderRenderResult } from '../api/types';

/**
 * 产出路线 —— 名称与后端 BLENDER_MODES 对齐。
 *
 * Blender 在这个项目里**只做一件事**：渲灰模参考视频喂给 Ref2VA。
 * 历史说明：曾经还有一条「控制塔」路线（depth / pose / canny / gray + Fun ControlNet），
 * 要多下 4.22 GB 的 control patch、单镜耗时 +83%、通道之间还会互相打架
 * （skip 相加 → 过饱和）。该路线经测试后放弃，已整条移除。
 */
const REFERENCE_MODES: Array<{ id: string; label: string; desc: string }> = [
  {
    id: 'blockout',
    label: 'blockout',
    desc: '灰模参考视频。填进「参考视频」走 Ref2VA，不需要额外模型；平光无阴影，只表达运动与空间',
  },
];

type ShotLite = {
  id: string;
  title?: string;
  updatedAt?: number;
  durationSec?: number;
  ratio?: string;
  actors?: unknown[];
  refs?: { images?: string[]; videos?: Array<string | { rel?: string }>; audios?: string[] };
};

/** 从 refs.videos 里取出 rel 字符串（历史数据可能是 string 或 {rel}） */
function videoRel(v: string | { rel?: string } | null | undefined): string {
  if (!v) return '';
  return typeof v === 'string' ? v : (v.rel ?? '');
}


export function PrevizPage() {
  const t = useT();
  const toast = useToast();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const projects = useProjectStore((s) => s.projects);

  const [health, setHealth] = useState<BlenderHealth | null>(null);
  const [busy, setBusy] = useState('');
  /** 「挂到参考视频」独立于渲染忙碌态：两者会并发（渲染完自动挂），共用一个 state 会互相覆盖 */
  const [attaching, setAttaching] = useState(false);
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
            `${r.warnings[0]}\n\n仍要把这段产物当参考视频用吗？\n`
            + '（点「取消」可先去渲染页配好走位再回来渲）',
          );
          if (!ok) {
            setResults((prev) => {
              const next = { ...prev };
              delete next[mode];
              return next;
            });
            setErr('已放弃使用这份占位人偶产物。请先在「渲染页 → 3D 走位」配好角色。');
            return;
          }
        }
      }
      /**
       * 渲完直接挂到镜头卡，不留"用户自己去渲染页找"这一步。
       *
       * 没警告（也就是走位配全了）时自动挂；有警告时用户已经在上面的
       * confirm 里明确选择"仍要用"，所以也挂。预览不挂。
       *
       * ⚠️ 必须把 `r` 传进去 —— 不能靠 `results` state（此刻还没提交）。
       */
      if (mode !== 'preview') {
        await attachAsReference(r);
      }
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy('');
    }
  }

  /**
   * 把渲好的 blockout 视频写回镜头卡的 `refs.videos`。
   *
   * 为什么必须做：页面文案一直写着「渲完去渲染页『参考视频』里选它」，
   * 但**没有任何代码把它填进去** —— 用户渲完发现参考视频列表里根本没有这段，
   * 只能去素材库里猜哪个文件是它。这是整条「Blender → Ref2VA」管线上
   * 唯一的断点，也是"管线不清晰"最直观的来源。
   *
   * ⚠️ 参数 `r` 必须是**显式传进来**的产物，不能从 `results` state 读。
   *    渲染刚结束就调用本函数时，`setResults(...)` 还没触发 re-render，
   *    闭包里捕获的是渲染**之前**的 `results` —— 读出来永远是 undefined，
   *    于是每次都报"这只产物还没有可用的相对路径"，参考视频永远挂不上。
   *    （这是把"根本没人回填"修成"回填"时引入的回归，已用参数传值修掉。）
   *
   * 语义：顶部插入（保证最新渲的排在 视频1，即 <Video 1>），去重，最多 3 条。
   */
  async function attachAsReference(r: BlenderRenderResult | null) {
    /**
     * ⚠️ 失败必须用 toast，不能只 `setErr`。
     *
     * 渲染成功后自动挂载这条路径在 `render()` 内部，此时页面已经滚到预览区，
     * 而错误条只在页面顶部 —— 用户根本看不到，以为"视频渲好了也挂上了"，
     * 结果镜头卡里没有任何参考视频（Ref2VA 的 <Video 1> 静默失效）。
     */
    if (!r?.rel) { setErr('这只产物还没有可用的相对路径'); toast.error('参考视频挂载失败：产物没有相对路径'); return; }
    if (!currentProjectId || !shotId) {
      setErr('先选项目和镜头');
      toast.error('参考视频挂载失败：还没选项目或镜头');
      return;
    }
    setAttaching(true);
    setErr('');
    try {
      const list = (await api.listShots(currentProjectId)) as unknown as ShotLite[];
      const shot = list.find((s) => s.id === shotId);
      if (!shot) throw new Error('镜头不存在（可能已被删除）');
      const existing = (shot.refs?.videos ?? []).map(videoRel).filter(Boolean);
      const next = [r.rel, ...existing.filter((v) => v !== r.rel)].slice(0, 3);
      await api.saveShot(currentProjectId, {
        id: shotId,
        refs: {
          images: shot.refs?.images ?? [],
          videos: next,
          audios: shot.refs?.audios ?? [],
        },
      } as never);
      setMsg(`已挂到镜头的「参考视频」：${r.rel}（提示词里用 <Video 1> 引用）`);
      await loadShots(currentProjectId);
    } catch (e) {
      setErr(describeError(e));
      toast.error(`参考视频挂载失败：${describeError(e)}`);
    } finally {
      setAttaching(false);
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
            不需要任何额外模型。<b>渲完会自动挂进当前镜头的「参考视频」</b>，
            到渲染页就能直接生成；提示词里用 <code>&lt;Video 1&gt;</code> 声明
            「只取运镜/走位/节奏」。
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
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Button
                          variant="primary"
                          disabled={!shotId || attaching}
                          onClick={() => void attachAsReference(r)}
                          title="把这段灰模视频写进当前镜头的「参考视频」槽位"
                        >
                          {attaching ? '写入中…' : '挂到本镜头参考视频'}
                        </Button>
                        {(() => {
                          const already = (currentShot?.refs?.videos ?? []).map(videoRel).includes(r.rel);
                          return already ? <Badge tone="ok">已挂上</Badge> : null;
                        })()}
                      </div>
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
            ① 渲染页「3D 走位」配好角色/道具/机位 →
            ② 这里渲预览确认动画 →
            ③ 渲 <code>blockout</code> 灰模视频（<b>自动挂进镜头参考视频</b>）→
            ④ 回渲染页直接生成。提示词用 <code>&lt;Video 1&gt;</code> 声明只取运镜/走位/节奏。
            <br />
            提示词要描述画面里<b>真实存在</b>的东西（人数、主要道具、机位方向），
            否则前几秒会被提示词抢走。
          </div>
        </div>
      </div>
    </Page>
  );
}

export default PrevizPage;
