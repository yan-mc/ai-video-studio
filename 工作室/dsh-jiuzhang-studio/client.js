/* 九章工作室 —— DSH Client 插件
 *
 * 职责：在 DSH 里当「启动器 + 监测器」。
 * 真正的画布在浏览器全屏 SPA 里（/luoshu/app），因为 DSH 侧栏会挤压可用宽度。
 *
 * 关键实现约束（已从 DSH 源码核实）：
 *  - Desktop 的窗口 origin 是 dsh-app://app，window.open 只放行 http(s) 绝对 URL；
 *  - 端口是 --port 0 随机的，客户端拿不到 location.port；
 *  - 所以 origin 必须由 Host 注入：GET /luoshu/api/token 的响应里带 origin 字段。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-jiuzhang-studio',
  factory(require) {
    const React = require('react');
    const { useEffect, useState, useCallback } = React;
    const h = React.createElement;

    const API = '/luoshu/api';

    /* ------------------------------- 文案 ------------------------------- */
    const T = {
      title: '九章工作室',
      subtitle: '节点画布 · H3 与 Seedance 双后端',
      open: '打开',
      refresh: '刷新',
      canvas: '画布工作台',
      assets: '素材库',
      projects: '项目',
      h3: 'H3 工坊',
      h3film: 'H3 成片',
      jobs: '任务',
      settings: '设置',
      previz: '预演导演台',
      monBackend: '生成后端',
      monH3: 'H3 本地',
      monSeedance: 'Seedance',
      monPreviz: '预演引擎',
      monJobs: '任务队列',
      monRunning: '运行中',
      monQueued: '排队',
      monFailed: '失败',
      online: '在线',
      offline: '离线',
      mock: 'Mock',
      real: '已配置',
      notBuilt: 'SPA 未构建（先跑 pnpm build）',
      auto: '自动刷新 2s',
    };

    /* ------------------------------- 样式 ------------------------------- */
    const CSS = `
      .jz-panel { display:flex; flex-direction:column; gap:10px; padding:12px; height:100%;
        overflow:auto; font-size:13px; color:var(--dsw-alias-text-primary,#e8e4dc);
        background:var(--dsw-specific-sidebar-fill,#111316); }
      .jz-hd { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .jz-title { font-size:15px; font-weight:600; letter-spacing:.02em; }
      .jz-sub { font-size:11px; opacity:.62; margin-top:2px; }
      .jz-sec { font-size:11px; text-transform:uppercase; letter-spacing:.08em;
        opacity:.5; margin:6px 0 2px; }
      .jz-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      .jz-btn { display:flex; flex-direction:column; gap:3px; align-items:flex-start;
        padding:8px 9px; border-radius:8px; cursor:pointer; user-select:none;
        border:1px solid var(--dsw-alias-border,#2a2e34);
        background:var(--dsw-alias-bg-layer-2,#191c20); color:inherit;
        font:inherit; text-align:left; transition:border-color .12s, background .12s; }
      .jz-btn:hover { border-color:var(--dsw-alias-accent,#C8564A);
        background:var(--dsw-alias-bg-layer-3,#20242a); }
      .jz-btn:disabled { opacity:.45; cursor:not-allowed; }
      .jz-btn b { font-weight:600; font-size:12.5px; }
      .jz-btn span { font-size:10.5px; opacity:.6; }
      .jz-card { border:1px solid var(--dsw-alias-border,#2a2e34); border-radius:8px;
        padding:8px 10px; background:var(--dsw-alias-bg-layer-2,#191c20); }
      .jz-row { display:flex; align-items:center; justify-content:space-between;
        gap:8px; padding:3px 0; font-size:12px; }
      .jz-row + .jz-row { border-top:1px dashed rgba(255,255,255,.06); }
      .jz-k { opacity:.66; }
      .jz-v { font-variant-numeric:tabular-nums; font-weight:600; }
      .jz-dot { width:7px; height:7px; border-radius:50%; display:inline-block;
        margin-right:5px; vertical-align:middle; }
      .jz-ok { background:#4A6B52; } .jz-bad { background:#8a4038; } .jz-mid { background:#B8912F; }
      .jz-warn { margin-top:6px; padding:7px 9px; border-radius:7px; font-size:11.5px;
        background:rgba(184,145,47,.12); border:1px solid rgba(184,145,47,.35); }
      .jz-foot { margin-top:auto; font-size:10.5px; opacity:.42; }
    `;

    function injectStyle() {
      if (document.querySelector('style[data-jz-style]')) return undefined;
      const el = document.createElement('style');
      el.setAttribute('data-jz-style', '');
      el.textContent = CSS;
      document.head.appendChild(el);
      return () => { try { el.remove(); } catch { /* ignore */ } };
    }

    /* ------------------------------- 组件 ------------------------------- */

    function Dot({ ok }) {
      const cls = ok === true ? 'jz-ok' : ok === false ? 'jz-bad' : 'jz-mid';
      return h('i', { className: 'jz-dot ' + cls });
    }

    function Row({ k, v, ok }) {
      return h('div', { className: 'jz-row' },
        h('span', { className: 'jz-k' }, typeof ok === 'boolean' ? h('span', {}, h(Dot, { ok }), k) : k),
        h('span', { className: 'jz-v' }, v));
    }

    function LaunchBtn({ label, hint, disabled, onClick }) {
      return h('button', {
        className: 'jz-btn', disabled: !!disabled,
        onClick: disabled ? undefined : onClick,
        title: hint || label,
      }, h('b', {}, label), hint ? h('span', {}, hint) : null);
    }

    function App() {
      const [token, setToken] = useState('');
      const [origin, setOrigin] = useState('');
      const [mon, setMon] = useState(null);
      const [err, setErr] = useState('');
      const [busy, setBusy] = useState(false);

      const refresh = useCallback(async () => {
        try {
          const r = await fetch(`${API}/monitor`, { cache: 'no-store' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          setMon(await r.json());
          setErr('');
        } catch (e) {
          setErr(String(e.message || e));
        }
      }, []);

      useEffect(() => {
        let alive = true;
        (async () => {
          try {
            const r = await fetch(`${API}/token`, { cache: 'no-store' });
            if (r.ok) {
              const j = await r.json();
              if (alive) { setToken(j.token || ''); setOrigin(j.origin || ''); }
            }
          } catch { /* ignore */ }
        })();
        return () => { alive = false; };
      }, []);

      useEffect(() => {
        refresh();
        const t = setInterval(refresh, 2000);
        return () => clearInterval(t);
      }, [refresh]);

      const openApp = useCallback((hash) => {
        const base = origin || (typeof window !== 'undefined' && window.location.origin.startsWith('http')
          ? window.location.origin
          : '');
        if (!base) {
          setErr('拿不到 Host origin（请重试或检查 Host 是否注入）');
          return;
        }
        const url = `${base.replace(/\/$/, '')}/luoshu/app/#${hash || '/canvas'}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }, [origin]);

      const entries = [
        { key: 'canvas', label: T.canvas, desc: '26 节点' },
        { key: 'assets', label: T.assets, desc: '14 类' },
        { key: 'projects', label: T.projects, desc: '导入/新建' },
        { key: 'h3', label: T.h3, desc: '剧本→分段' },
        { key: 'h3film', label: T.h3film, desc: 'ASR+合成' },
        { key: 'jobs', label: T.jobs, desc: '队列' },
        { key: 'previz', label: T.previz, desc: '3D 预演' },
        { key: 'settings', label: T.settings, desc: '模型/API' },
      ];

      const jobs = mon?.jobs || {};
      const h3ok = mon?.h3?.ok;
      const pvok = mon?.previz?.ok;
      const sdMode = mon?.seedance?.mode;

      return h('div', { className: 'jz-panel' },
        h('div', { className: 'jz-hd' },
          h('div', {},
            h('div', { className: 'jz-title' }, T.title),
            h('div', { className: 'jz-sub' }, T.subtitle)),
          h('button', {
            className: 'jz-btn', style: { padding: '5px 9px', flexDirection: 'row', alignItems: 'center' },
            onClick: () => { setBusy(true); refresh().finally(() => setBusy(false)); },
            disabled: busy,
          }, h('b', {}, T.refresh))),

        err ? h('div', { className: 'jz-warn' }, err) : null,

        h('div', { className: 'jz-sec' }, T.open),
        h('div', { className: 'jz-grid' },
          entries.map((e) => h(LaunchBtn, {
            key: e.key, label: e.label, hint: e.desc,
            disabled: !origin, onClick: () => openApp('/' + e.key),
          }))),

        origin ? null : h('div', { className: 'jz-warn' }, T.notBuilt + ' · ' + '未取到 Host origin'),

        h('div', { className: 'jz-sec' }, T.monBackend),
        h('div', { className: 'jz-card' },
          h(Row, { k: T.monH3, v: h3ok ? T.online : T.offline, ok: !!h3ok }),
          h(Row, { k: T.monSeedance, v: sdMode === 'real' ? T.real : T.mock, ok: sdMode === 'real' }),
          h(Row, { k: T.monPreviz, v: pvok ? T.online : T.offline, ok: !!pvok }),
          h(Row, { k: T.monJobs, v: String(jobs.total ?? 0) }),
          h(Row, { k: T.monRunning, v: String(jobs.running ?? 0) }),
          h(Row, { k: T.monQueued, v: String(jobs.queued ?? 0) }),
          h(Row, { k: T.monFailed, v: String(jobs.failed ?? 0) })),

        h('div', { className: 'jz-foot' }, T.auto + (token ? ' · token 已就绪' : ' · token 缺失')),
      );
    }

    function Icon(props) {
      const size = (props && props.size) || 18;
      return h('svg', {
        viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', opacity: props && props.active ? 1 : 0.82 },
      },
        h('rect', { x: 4, y: 10, width: 56, height: 44, rx: 8, fill: 'currentColor', opacity: 0.14 }),
        h('rect', { x: 4, y: 10, width: 56, height: 44, rx: 8, fill: 'none', stroke: 'currentColor', strokeWidth: 3 }),
        h('line', { x1: 22.7, y1: 10, x2: 22.7, y2: 54, stroke: 'currentColor', strokeWidth: 2, opacity: 0.5 }),
        h('line', { x1: 41.3, y1: 10, x2: 41.3, y2: 54, stroke: 'currentColor', strokeWidth: 2, opacity: 0.5 }),
        h('line', { x1: 4, y1: 24.7, x2: 60, y2: 24.7, stroke: 'currentColor', strokeWidth: 2, opacity: 0.5 }),
        h('line', { x1: 4, y1: 39.3, x2: 60, y2: 39.3, stroke: 'currentColor', strokeWidth: 2, opacity: 0.5 }),
        h('circle', { cx: 22.7, cy: 24.7, r: 3.2, fill: 'currentColor' }),
        h('circle', { cx: 41.3, cy: 24.7, r: 3.2, fill: 'currentColor' }),
        h('circle', { cx: 22.7, cy: 39.3, r: 3.2, fill: 'currentColor' }),
        h('path', { d: 'M39.4 35.2 L48.6 39.6 L39.4 44.0 Z', fill: 'currentColor' }));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => injectStyle());
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: 'jiuzhang-studio', order: 31, label: T.title },
          Icon,
        ));
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: 'jiuzhang-studio' },
          App,
        ));
      },
    };
  },
});