/**
 * 应用外壳 —— 顶栏 + 左侧导航 + 路由出口。
 *
 * 职责边界：
 *  - 这里只做"壳"：导航高亮、后端状态灯、主题/外观入口；
 *  - 具体页面在 src/pages/*，画布在 src/canvas/*（由另一路并行实现）。
 */
import { useEffect } from 'react';

import { CanvasPage } from './pages/CanvasPage';
import { AssetsPage } from './pages/AssetsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { JobsPage } from './pages/JobsPage';
import { PrevizPage } from './pages/PrevizPage';
import { ScriptPage } from './pages/ScriptPage';
import { ComicPage } from './pages/ComicPage';
import { ModelWorkbenchPage } from './pages/ModelWorkbenchPage';
import { ImagePage } from './pages/ImagePage';
import { BreakdownPage } from './pages/BreakdownPage';
import { VaultPage } from './pages/VaultPage';
import { RenderPage } from './pages/RenderPage';

import { useRouter } from './router';
import type { RouteId } from './router';
import { useJobsStore, useProjectStore, useUiStore } from './store';
import { Icon, ThemeProvider, Toaster, useT } from './ui';
import { useTheme } from './ui/theme';
import type { IconName } from './ui/Icon';

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
  { key: 'script', icon: 'text', labelKey: 'nav.script' },
  { key: 'comic', icon: 'image', labelKey: 'nav.comic' },
  { key: 'mw', icon: 'cube', labelKey: 'nav.mw' },
  // ---- 资源 ----
  { key: 'assets', icon: 'assets', labelKey: 'nav.assets', groupBefore: '资源' },
  { key: 'vault', icon: 'users', labelKey: 'nav.vault' },
  { key: 'projects', icon: 'projects', labelKey: 'nav.projects' },
  // ---- 工具 ----
  { key: 'breakdown', icon: 'image', labelKey: 'nav.breakdown', groupBefore: '工具' },
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

/* --------------------------------------------------------------- 顶栏 */

function TopBar({ route }: { route: RouteId }) {
  const t = useT();
  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);
  const monitor = useUiStore((s) => s.monitor);

  const h3Ok = monitor?.h3?.ok;
  const previzOk = monitor?.blender?.ok;
  const seedanceMode = monitor?.seedance?.mode;
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
        <span className="jz-status__item" title={t('settings.healthSeedance')}>
          <i className={seedanceMode === 'real' ? 'jz-dot jz-dot--ok' : 'jz-dot jz-dot--mid'} />
          Seedance {seedanceMode === 'real' ? '' : 'Mock'}
        </span>
        <span className="jz-status__item" title={t('settings.healthBlender')}>
          <i className={dot(previzOk)} />
          {t('settings.healthBlender')}
        </span>
      </div>

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
            <div style={{ height: 1, margin: '6px 10px', background: 'var(--jz-line)' }} />
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
    case 'assets':
      return <AssetsPage />;
    case 'projects':
      return <ProjectsPage />;
    case 'script':
      return <ScriptPage />;
    case 'settings':
      return <SettingsPage />;
    case 'jobs':
      return <JobsPage />;
    case 'previz':
      return <PrevizPage />;
    case 'comic':
      return <ComicPage />;
    case 'mw':
      return <ModelWorkbenchPage />;
    case 'image':
      return <ImagePage />;
    case 'breakdown':
      return <BreakdownPage />;
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
          <RouteView route={route} />
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








