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
import { H3Page } from './pages/H3Page';
import { SettingsPage } from './pages/SettingsPage';
import { JobsPage } from './pages/JobsPage';
import { PrevizPage } from './pages/PrevizPage';

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
}

const NAV: ReadonlyArray<NavEntry> = [
  { key: 'canvas', icon: 'canvas', labelKey: 'nav.canvas' },
  { key: 'assets', icon: 'assets', labelKey: 'nav.assets' },
  { key: 'projects', icon: 'projects', labelKey: 'nav.projects' },
  { key: 'h3', icon: 'h3', labelKey: 'nav.h3' },
  { key: 'previz', icon: 'cube', labelKey: 'nav.previz' },
  { key: 'jobs', icon: 'jobs', labelKey: 'nav.jobs' },
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
  const previzOk = monitor?.previz?.ok;
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
        <span className="jz-status__item" title={t('settings.healthPreviz')}>
          <i className={dot(previzOk)} />
          {t('settings.healthPreviz')}
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
      <div className="jz-nav__group">{t('app.short')}</div>
      {NAV.map((item) => (
        <button
          key={item.key}
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
    case 'assets':
      return <AssetsPage />;
    case 'projects':
      return <ProjectsPage />;
    case 'h3':
      return <H3Page />;
    case 'settings':
      return <SettingsPage />;
    case 'jobs':
      return <JobsPage />;
    case 'previz':
      return <PrevizPage />;
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
