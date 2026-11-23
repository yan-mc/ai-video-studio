/**
 * 应用外壳 —— 顶栏 + 左侧导航 + 路由出口。
 *
 * 职责边界：
 *  - 这里只做"壳"：导航高亮、后端状态灯、主题/外观入口；
 *  - 具体页面在 src/pages/*，画布在 src/canvas/*（由另一路并行实现）。
 */
import { useCallback, useEffect, useState } from 'react';

import { CanvasPage } from './pages/CanvasPage';
import { AssetsPage } from './pages/AssetsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { JobsPage } from './pages/JobsPage';
import { PrevizPage } from './pages/PrevizPage';
import { ImagePage } from './pages/ImagePage';
import { BreakdownPage } from './pages/BreakdownPage';
import { VaultPage } from './pages/VaultPage';
import { RenderPage } from './pages/RenderPage';
import { EditPage } from './pages/EditPage';
import { ReplacementPage } from './pages/ReplacementPage';
import { StoryboardPage } from './pages/StoryboardPage';
import { ScriptAnalyzerPanel } from './pages/H3Page';

import { useRouter } from './router';
import type { RouteId } from './router';
import { useJobsStore, useProjectStore, useUiStore } from './store';
import { Icon, ThemeProvider, Toaster, useT, useToast, ErrorBoundary } from './ui';
import { useTheme } from './ui/theme';
import type { IconName } from './ui/Icon';
import { api, describeError } from './api/client';
import type { ComfyStatus, QwenStatus } from './api/types';

/* ------------------------------------------------------------- 导航定义 */

interface NavEntry {
  key: RouteId;
  icon: IconName;
  labelKey: string;
  /** 分组分隔：出现在这一项**之前** */
  groupBefore?: string;
}

/**
 * 导航 —— 按「制作 / 资源 / 工具 / 系统」四组排列。
 *
 * 之前是 16 项平铺的一维列表，同类功能散落各处、还有重复页：
 *   · H3 工坊与提示词工作台都叫"H3 提示词"，实际一个是剧本分析、一个是提示词编译器
 *   · 3D 导演台与预演页是同一个引擎的两个 iframe 入口
 *   · 工具箱是模板/服化道/清理/日志的杂物间
 *
 * 现在收敛为 11 项，职责单一。
 */
const NAV: ReadonlyArray<NavEntry> = [
  // ---- 制作 ----
  { key: 'render', icon: 'video', labelKey: 'nav.render', groupBefore: '制作' },
  { key: 'replace', icon: 'swap', labelKey: 'nav.replace' },
  { key: 'storyboard', icon: 'text', labelKey: 'nav.storyboard' },
  { key: 'workshop', icon: 'text', labelKey: 'nav.workshop' },
  // ---- 资源 ----
  { key: 'assets', icon: 'assets', labelKey: 'nav.assets', groupBefore: '资源' },
  { key: 'vault', icon: 'users', labelKey: 'nav.vault' },
  { key: 'projects', icon: 'projects', labelKey: 'nav.projects' },
  // ---- 工具 ----
  { key: 'edit', icon: 'scissors', labelKey: 'nav.edit', groupBefore: '工具' },
  { key: 'breakdown', icon: 'image', labelKey: 'nav.breakdown' },
  { key: 'previz', icon: 'cube', labelKey: 'nav.previz' },
  { key: 'canvas', icon: 'canvas', labelKey: 'nav.canvas' },
  { key: 'image', icon: 'image', labelKey: 'nav.image' },
  // ---- 系统 ----
  { key: 'jobs', icon: 'jobs', labelKey: 'nav.jobs', groupBefore: '系统' },
  { key: 'settings', icon: 'settings', labelKey: 'nav.settings' },
];

const ACCENT_SWATCHES: ReadonlyArray<{ id: string; labelKey: string; color: string }> = [
  { id: 'cinnabar', labelKey: 'theme.accentCinnabar', color: 'var(--jz-swatch-cinnabar)' },
  { id: 'indigo', labelKey: 'theme.accentIndigo', color: 'var(--jz-swatch-indigo)' },
  { id: 'gold', labelKey: 'theme.accentGold', color: 'var(--jz-swatch-gold)' },
  { id: 'pine', labelKey: 'theme.accentPine', color: 'var(--jz-swatch-pine)' },
];

/* --------------------------------------------------------- 外观切换组 */

function AppearanceMenu() {
  const t = useT();
  const { theme, accent, toggleTheme, setAccent } = useTheme();

  return (
    <div className="jz-topbar__actions">
      <div className="jz-row" style={{ gap: 4 }} role="group" aria-label={t('nav.accent')}>
        {ACCENT_SWATCHES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={t(item.labelKey)}
            aria-pressed={accent === item.id}
            title={t(item.labelKey)}
            onClick={() => setAccent(item.id as typeof accent)}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              cursor: 'pointer',
              padding: 0,
              border:
                accent === item.id
                  ? '2px solid var(--jz-text-primary)'
                  : '1px solid var(--jz-border-strong)',
              background: item.color,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="jz-btn jz-btn--icon jz-btn--ghost"
        onClick={toggleTheme}
        aria-label={t('nav.theme')}
        title={`${t('nav.theme')} · ${theme === 'inknight' ? t('theme.inknight') : t('theme.xuanpaper')}`}
      >
        <Icon name={theme === 'inknight' ? 'moon' : 'sun'} size={16} />
      </button>
    </div>
  );
}

/* --------------------------------------------------------- ComfyUI 电源 */

/**
 * 顶栏的 ComfyUI 启停按钮。
 *
 * 为什么需要它（不是"顺手做个开关"）：
 *   本地「取消」只对正在跑的那一单发 /interrupt，**已经排进 ComfyUI 队列
 *   但还没开始的任务不会被清掉**。用户看到界面停了，ComfyUI 侧后面还挂着
 *   上一单的段 —— 下一单提交后那些段仍会依次执行，表现就是
 *   "前面的续写还在"。重启进程能一次性清掉队列 + 显存碎片 + 节点缓存。
 *
 * 交互取舍：
 *   · **只在运行时才显示「重启」**。这是最常用的动作，但重启要等 30~180 秒，
 *     所以必须有进行中的禁用态和明确的 toast，不能让人以为卡住了。
 *   · 未运行时按钮是「启动」，一句话说清"点了会等一会儿"。
 *   · 状态每 10 秒自刷新一次 —— ComfyUI 可能被别处启停，按钮不能显示陈旧状态。
 */
function ComfyPowerButton() {
  const t = useT();
  const [status, setStatus] = useState<ComfyStatus | null>(null);
  const [busy, setBusy] = useState<'' | 'start' | 'stop' | 'restart'>('');
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.comfyStatus());
    } catch {
      // 状态查不到不等于 ComfyUI 挂了（可能是 Host 在重启），保持上一次的值
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      await refresh();
    };
    void tick();
    const id = window.setInterval(tick, 10000);
    return () => { alive = false; window.clearInterval(id); };
  }, [refresh]);

  const act = useCallback(async (kind: 'start' | 'stop' | 'restart') => {
    if (busy) return;
    setBusy(kind);
    try {
      const r = kind === 'start'
        ? await api.comfyStart()
        : kind === 'stop'
          ? await api.comfyStop()
          : await api.comfyRestart();
      if (r.ok) toast.ok(r.detail);
      else toast.error(r.detail);
      await refresh();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy('');
    }
  }, [busy, refresh, toast]);

  const running = status?.running === true;
  const canControl = status?.canControl !== false;
  const label = busy === 'start' ? '启动中…'
    : busy === 'stop' ? '停止中…'
      : busy === 'restart' ? '重启中…'
        : running ? '重启' : '启动';

  return (
    <button
      type="button"
      className="jz-btn jz-btn--sm jz-btn--ghost"
      disabled={Boolean(busy) || !canControl}
      onClick={() => void act(running ? 'restart' : 'start')}
      title={
        !canControl
          ? (status?.detail ?? '找不到 ai-runtime 目录，无法从界面启停')
          : running
            ? `${t('comfy.restartHint')}（端口 ${status?.port}）`
            : t('comfy.startHint')
      }
      aria-label={running ? t('comfy.restart') : t('comfy.start')}
      style={{ gap: 6, opacity: canControl ? 1 : 0.5 }}
    >
      <span
        className={running ? 'jz-dot jz-dot--ok' : 'jz-dot jz-dot--bad'}
        style={{ marginRight: 2 }}
      />
      <Icon name={running ? 'refresh' : 'play'} size={14} />
      {label}
    </button>
  );
}

/* ---------------------------------------------------- Qwen3-VL 本地推理开关 */

/**
 * 顶栏的 Qwen3-VL 启停按钮 + 状态。
 *
 * 为什么它和 ComfyUI 电源并排放在顶栏：
 *   12GB 单卡上「ComfyUI/H3 出片」与「Qwen3-VL 看图/写词」**不能同时跑**。
 *   用户必须在一个地方看到两者状态并一键切换，而不是去翻两个 ps1 脚本。
 *
 * 与 ComfyPowerButton 的差别（都是有意的）：
 *   · 显示**上下文长度**（128k）—— 这是用户最关心的配置，也是 DSH 侧
 *     `contextWindow` 必须对齐的那个值；
 *   · 两者同时运行时给**明确警告色**，而不是静默并排；
 *   · 状态每 15 秒刷新（Qwen 启停比 ComfyUI 快，10 秒太频繁）。
 */
function QwenPowerButton() {
  const [status, setStatus] = useState<QwenStatus | null>(null);
  const [busy, setBusy] = useState<'' | 'start' | 'stop' | 'restart'>('');
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.qwenStatus());
    } catch {
      // 查不到不等于服务挂了（可能是 Host 在重启），保持上一次的值
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => { if (alive) await refresh(); };
    void tick();
    const id = window.setInterval(tick, 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, [refresh]);

  const act = useCallback(async (kind: 'start' | 'stop' | 'restart') => {
    if (busy) return;
    setBusy(kind);
    try {
      const r = kind === 'start'
        ? await api.qwenStart()
        : kind === 'stop'
          ? await api.qwenStop()
          : await api.qwenRestart();
      if (r.ok) toast.ok(r.detail);
      else toast.error(r.detail);
      await refresh();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy('');
    }
  }, [busy, refresh, toast]);

  const running = status?.running === true;
  const canControl = status?.canControl !== false;
  // 两个都跑 = 抢显存，必须让用户看见
  const conflict = running && status?.comfyRunning === true;
  const [showDetail, setShowDetail] = useState(false);

  const ctxLabel = status?.nCtx ? `${Math.round(status.nCtx / 1024)}k` : '';
  const label = busy === 'start' ? '启动中…'
    : busy === 'stop' ? '停止中…'
      : busy === 'restart' ? '重启中…'
        : running ? `Qwen ${ctxLabel}` : 'Qwen';

  const title = !canControl
    ? (status?.detail ?? '找不到 ai-runtime，无法从界面启停')
    : conflict
      ? `⚠️ Qwen3-VL 与 ComfyUI 同时在运行，会抢 12GB 显存（出片必 OOM）。建议先停一个。\n当前：${status?.detail}`
      : running
        ? `${status?.detail}\n模型：${status?.model ?? '?'}\n点击重启（约 15 秒）`
        : '点一下启动本地 Qwen3-VL（约 15 秒），供 DSH 的 qwen3vl 模型使用';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <button
        type="button"
        className="jz-btn jz-btn--sm jz-btn--ghost"
        disabled={Boolean(busy) || !canControl}
        onClick={() => void act(running ? 'restart' : 'start')}
        title={title}
        aria-label={running ? '重启 Qwen3-VL' : '启动 Qwen3-VL'}
        style={{
          gap: 6,
          opacity: canControl ? 1 : 0.5,
          // 冲突时用警示色描边，而不是只靠 tooltip
          ...(conflict ? { color: 'var(--jz-warn, #d9822b)', borderColor: 'var(--jz-warn, #d9822b)' } : {}),
        }}
      >
        <span
          className={running ? 'jz-dot jz-dot--ok' : 'jz-dot jz-dot--bad'}
          style={{ marginRight: 2 }}
        />
        <Icon name={running ? 'refresh' : 'play'} size={14} />
        {label}
        {conflict ? <span aria-hidden>⚠</span> : null}
      </button>

      {/* 详情展开：顶栏按钮放不下模型名/端口/上下文，用一个极小的信息按钮切换 */}
      <button
        type="button"
        className="jz-btn jz-btn--icon jz-btn--ghost"
        onClick={() => setShowDetail((v) => !v)}
        title="查看 Qwen3-VL 服务详情"
        aria-label="查看 Qwen3-VL 服务详情"
        aria-expanded={showDetail}
        style={{ opacity: 0.65 }}
      >
        <Icon name="info" size={13} />
      </button>

      {showDetail ? (
        <div
          role="dialog"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 40,
            minWidth: 280, padding: '10px 12px',
            background: 'var(--jz-bg-raised)', border: '1px solid var(--jz-border)',
            borderRadius: 'var(--jz-r-sm)', boxShadow: 'var(--jz-shadow-md, 0 6px 20px rgba(0,0,0,.28))',
            fontSize: 12, lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Qwen3-VL（本地 llama.cpp）</div>
          <Row k="状态" v={status?.detail ?? '未知'} />
          <Row k="端口" v={status?.port ? String(status.port) : '—'} />
          <Row k="上下文" v={status?.nCtx ? `${status.nCtx.toLocaleString()} tokens` : '—'} />
          <Row k="模型" v={status?.model ?? '—'} />
          <Row k="服务地址" v={status?.url || '—'} />
          <Row k="运行时" v={status?.runtimeDir || '（找不到 ai-runtime）'} />
          <Row k="ComfyUI" v={status?.comfyRunning ? '运行中（会抢显存）' : '未运行'} />
          {conflict ? (
            <div style={{ marginTop: 6, color: 'var(--jz-warn, #d9822b)' }}>
              ⚠️ 两者同时运行会 OOM。出片前先停 Qwen3-VL。
            </div>
          ) : null}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--jz-border)', color: 'var(--jz-text-muted)' }}>
            DSH 侧 provider 名：<code>qwen3vl</code><br />
            上下文需与 <code>contextWindow</code> 一致（改了要重启 DSH）
          </div>
          {running ? (
            <button
              type="button"
              className="jz-btn jz-btn--sm jz-btn--ghost"
              style={{ marginTop: 8, width: '100%' }}
              disabled={Boolean(busy)}
              onClick={() => void act('stop')}
            >
              停止 Qwen3-VL
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 详情面板里的一行「键：值」 */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: 'var(--jz-text-muted)', flex: '0 0 68px' }}>{k}</span>
      <span style={{ wordBreak: 'break-all' }}>{v}</span>
    </div>
  );
}

/* --------------------------------------------------------------- 顶栏 */

function TopBar({ route }: { route: RouteId }) {
  const t = useT();
  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);
  const monitor = useUiStore((s) => s.monitor);

  const h3Ok = monitor?.h3?.ok;
  const previzOk = monitor?.blender?.ok;
  const currentLabel = t(NAV.find((n) => n.key === route)?.labelKey ?? 'nav.canvas');

  const dot = (v: boolean | string | undefined): string =>
    v === true ? 'jz-dot jz-dot--ok' : v ? 'jz-dot jz-dot--mid' : v === undefined ? 'jz-dot' : 'jz-dot jz-dot--bad';

  return (
    <header className="jz-topbar">
      <button
        type="button"
        className="jz-btn jz-btn--icon jz-btn--ghost"
        aria-label={navCollapsed ? t('nav.expand') : t('nav.collapse')}
        title={navCollapsed ? t('nav.expand') : t('nav.collapse')}
        onClick={toggleNav}
      >
        <Icon name="list" size={16} />
      </button>

      <div className="jz-topbar__brand">
        <span className="jz-topbar__name">{t('app.name')}</span>
        <span className="jz-topbar__sub">
          {currentLabel} · {t('app.subtitle')}
        </span>
      </div>

      <div className="jz-topbar__spacer" />

      <div className="jz-status" aria-live="polite">
        <span className="jz-status__item" title={t('settings.healthH3')}>
          <i className={dot(h3Ok)} />
          H3
        </span>
        <span className="jz-status__item" title={t('settings.healthBlender')}>
          <i className={dot(previzOk)} />
          {t('settings.healthBlender')}
        </span>
      </div>

      <ComfyPowerButton />
      <QwenPowerButton />

      <AppearanceMenu />
    </header>
  );
}

/* ------------------------------------------------------------- 侧导航 */

function NavRail({ route, onNavigate }: { route: RouteId; onNavigate: (r: RouteId) => void }) {
  const t = useT();
  const collapsed = useUiStore((s) => s.navCollapsed);
  const runningJobs = useJobsStore((s) => s.jobs.filter((j) => j.status === 'running').length);
  const projectName = useProjectStore((s) => {
    const p = s.projects.find((x) => x.id === s.currentProjectId);
    return p?.name ?? '';
  });

  return (
    <nav className={collapsed ? 'jz-nav jz-nav--collapsed' : 'jz-nav'} aria-label="主导航">
      {NAV.map((item) => (
        <div key={item.key}>
          {item.groupBefore && !collapsed ? (
            <div className="jz-nav__group" style={{ marginTop: 6 }}>{item.groupBefore}</div>
          ) : null}
          {item.groupBefore && collapsed ? (
            <div style={{ height: 1, margin: '6px 10px', background: 'var(--jz-border)' }} />
          ) : null}
          <button
            type="button"
            className={route === item.key ? 'jz-nav__item jz-nav__item--active' : 'jz-nav__item'}
            aria-current={route === item.key ? 'page' : undefined}
            title={t(item.labelKey)}
            onClick={() => onNavigate(item.key)}
          >
            <span className="jz-nav__icon">
              <Icon name={item.icon} size={17} />
            </span>
            <span className="jz-nav__label">{t(item.labelKey)}</span>
            {item.key === 'jobs' && runningJobs > 0 ? (
              <span className="jz-nav__badge">{runningJobs}</span>
            ) : null}
          </button>
        </div>
      ))}

      <div className="jz-nav__foot">
        {projectName && !collapsed ? (
          <div
            className="jz-xs jz-truncate"
            style={{ padding: '0 var(--jz-sp-3)', color: 'var(--jz-text-faint)' }}
            title={projectName}
          >
            {projectName}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------ 页面出口 */

function RouteView({ route }: { route: RouteId }) {
  switch (route) {
    case 'render':
      return <RenderPage />;
    case 'replace':
      return <ReplacementPage />;
    case 'storyboard':
      return <StoryboardPage />;
    case 'workshop':
      return <ScriptAnalyzerPanel />;
    case 'assets':
      return <AssetsPage />;
    case 'projects':
      return <ProjectsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'jobs':
      return <JobsPage />;
    case 'previz':
      return <PrevizPage />;
    case 'image':
      return <ImagePage />;
    case 'breakdown':
      return <BreakdownPage />;
    case 'edit':
      return <EditPage />;
    case 'vault':
      return <VaultPage />;
    case 'canvas':
    default:
      return <CanvasPage />;
  }
}

/* ------------------------------------------------------------- 启动编排 */

function AppBody() {
  const { route, navigate } = useRouter();
  const t = useT();

  const loadMeta = useProjectStore((s) => s.loadMeta);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const loadJobs = useJobsStore((s) => s.loadJobs);
  const refreshMonitor = useUiStore((s) => s.refreshMonitor);
  const monitorEnabled = useUiStore((s) => s.monitorEnabled);

  // 首屏并行拉取：元信息 + 项目列表 + 任务 + 监测
  useEffect(() => {
    void loadMeta();
    void loadProjects(true);
    void loadJobs(true);
    void refreshMonitor();
  }, [loadMeta, loadProjects, loadJobs, refreshMonitor]);

  // 页面可见时才轮询，切后台就停（省电，也不打扰 job-runner）
  useEffect(() => {
    if (!monitorEnabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') void refreshMonitor();
    };
    const timer = window.setInterval(tick, 2000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [monitorEnabled, refreshMonitor]);

  // 标签页标题跟随路由，方便多开窗口时辨认
  useEffect(() => {
    document.title = `${t('app.name')} · ${t(`nav.${route}`)}`;
  }, [route, t]);

  return (
    <div className="jz-app">
      <TopBar route={route} />
      <div className="jz-app__body">
        <NavRail route={route} onNavigate={navigate} />
        <main className="jz-app__content">
          {/* 每个页面单独兜错误：一个页面渲染炸了不能让整个外壳白屏 */}
          <ErrorBoundary scope={t(`nav.${route}`)} resetKey={route}>
            <RouteView route={route} />
          </ErrorBoundary>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppBody />
    </ThemeProvider>
  );
}
