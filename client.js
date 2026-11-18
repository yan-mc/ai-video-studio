/* 九章工作室 —— DSH Client 插件
 *
 * 职责：在 DSH 侧栏里当「启动器 + 监测器」。
 * 真正的画布在浏览器全屏 SPA 里（/jiuzhang/app），因为 DSH 侧栏会挤压可用宽度。
 *
 * 关键实现约束（已从 DSH 源码核实）：
 *  - Desktop 的窗口 origin 是 dsh-app://app，window.open 只放行 http(s) 绝对 URL；
 *  - 端口是 --port 0 随机的，客户端拿不到 location.port；
 *  - 所以 origin 必须由 Host 注入：GET /jiuzhang/api/token 的响应里带 origin 字段。
 *
 * ⚠️ 历史坑（已修）：entries 里曾经留着 `script` / `comic` / `mw` 三个路由，
 *    它们对应的页面在 2.0.0 已整体删除。点进去 SPA 的 parseHash() 认不出，
 *    会静默回退到 #/render —— 用户看到"点剧本打开了渲染页"，以为坏了。
 *    现在这张表与 app-src/src/router.tsx 的 ROUTES **逐项对齐**，
 *    并由 `pnpm run check:routes`（tools/check-routes.mjs）做静态校验。
 *    注意：host 的 /jiuzhang/api/meta **不**做这个校验（旧注释曾这么写，是假的）——
 *    真正跑校验的是工具脚本，它比对 SPA ROUTES / App.tsx NAV / 本文件的 entries 三方。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-jiuzhang-studio',
  factory(require) {
    const React = require('react');
    const { useEffect, useState, useCallback } = React;
    const h = React.createElement;

    const API = '/jiuzhang/api';

    /** 监测面板轮询间隔（毫秒）。与后端 /monitor 的最坏耗时解耦：见下方 tick 的去重逻辑。 */
    const POLL_MS = 3000;

    /* ------------------------------- 文案 ------------------------------- */
    const T = {
      title: '九章工作室',
      subtitle: '节点画布 · H3 本地后端',
      open: '打开',
      openInApp: '在应用内打开',
      openInTab: '新标签页',
      refresh: '刷新',
      render: '渲染页',
      storyboard: '智能分镜',
      workshop: 'H3 工坊',
      canvas: '画布工作台',
      assets: '素材库',
      projects: '项目',
      vault: '角色卡',
      breakdown: '立绘拆解',
      image: '图像生成',
      previz: '3D 预演',
      jobs: '任务',
      settings: '设置',
      monBackend: '生成后端',
      monH3: 'H3 本地',
      monH3Image: 'H3 图像',
      monPreviz: '预演引擎',
      monJobs: '任务队列',
      monRunning: '运行中',
      monQueued: '排队',
      monFailed: '失败',
      online: '在线',
      offline: '离线',
      notBuilt: 'SPA 未构建（先跑 pnpm build）',
      auto: '自动刷新 2s',
      lastOpened: '已打开（若没反应，点下面的链接）',
    };

    /* ------------------------------- 样式 -------------------------------
     *
     * ⚠️ 只用 DSH **真实存在**的主题 token。
     *
     * 历史缺陷：这里曾经写了三个根本不存在的变量名 ——
     *   --dsw-alias-text-primary  （真实是 --dsw-alias-label-primary）
     *   --dsw-alias-border        （真实是 --dsw-alias-border-l1 / -l2）
     *   --dsw-alias-accent        （真实是 --dsw-alias-brand-primary）
     * 因为有 fallback，面板不会崩，但会被**永久钉死成深色配色**。
     * DSH 默认跟随系统主题：本机是深色所以看着正常；一旦用户切到浅色，
     * .jz-panel 的背景会跟随 --dsw-specific-sidebar-fill 变浅，
     * 而文字仍是 fallback 的浅灰 #e8e4dc → 浅底浅字，几乎不可读。
     * 这就是"从左上角入口打开后页面看起来是坏的"最直接的视觉原因。
     *
     * 真实 token 清单可查：cordis_inspect_query { client, Theme, listTokens }
     */
    const CSS = `
      .jz-panel { display:flex; flex-direction:column; gap:10px; padding:12px; height:100%;
        overflow:auto; font-size:13px; color:var(--dsw-alias-label-primary,#e8e4dc);
        background:var(--dsw-specific-sidebar-fill,#111316); }
      .jz-hd { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .jz-title { font-size:15px; font-weight:600; letter-spacing:.02em; }
      .jz-sub { font-size:11px; color:var(--dsw-alias-label-secondary,rgba(232,228,220,.74));
        margin-top:2px; }
      .jz-sec { font-size:11px; text-transform:uppercase; letter-spacing:.08em;
        color:var(--dsw-alias-label-secondary,rgba(232,228,220,.55)); margin:6px 0 2px; }
      .jz-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      .jz-btn { display:flex; flex-direction:column; gap:3px; align-items:flex-start;
        padding:8px 9px; border-radius:8px; cursor:pointer; user-select:none;
        border:1px solid var(--dsw-alias-border-l1,rgba(232,228,220,.11));
        background:var(--dsw-alias-bg-layer-2,#191c20);
        color:var(--dsw-alias-label-primary,#e8e4dc);
        font:inherit; text-align:left; transition:border-color .12s, background .12s; }
      .jz-btn:hover { border-color:var(--dsw-alias-brand-primary,#C8564A);
        background:var(--dsw-alias-bg-layer-1,#20242a); }
      .jz-btn:disabled { opacity:.45; cursor:not-allowed; }
      .jz-btn b { font-weight:600; font-size:12.5px; }
      .jz-btn span { font-size:10.5px; color:var(--dsw-alias-label-secondary,rgba(232,228,220,.6)); }
      .jz-card { border:1px solid var(--dsw-alias-border-l1,rgba(232,228,220,.11));
        border-radius:8px; padding:8px 10px;
        background:var(--dsw-alias-bg-layer-2,#191c20); }
      .jz-row { display:flex; align-items:center; justify-content:space-between;
        gap:8px; padding:3px 0; font-size:12px; }
      .jz-row + .jz-row { border-top:1px dashed var(--dsw-alias-border-l1,rgba(232,228,220,.11)); }
      .jz-k { color:var(--dsw-alias-label-secondary,rgba(232,228,220,.66)); }
      .jz-v { font-variant-numeric:tabular-nums; font-weight:600; }
      .jz-dot { width:7px; height:7px; border-radius:50%; display:inline-block;
        margin-right:5px; vertical-align:middle; }
      .jz-ok { background:var(--dsw-alias-state-success-primary,#4A6B52); }
      .jz-bad { background:var(--dsw-alias-state-error-primary,#8a4038); }
      .jz-mid { background:var(--dsw-alias-state-warn-primary,#B8912F); }
      .jz-warn { margin-top:6px; padding:7px 9px; border-radius:7px; font-size:11.5px;
        background:var(--dsw-alias-bg-layer-2,rgba(184,145,47,.12));
        border:1px solid var(--dsw-alias-state-warn-primary,rgba(184,145,47,.35)); }
      .jz-foot { margin-top:auto; font-size:10.5px;
        color:var(--dsw-alias-label-secondary,rgba(232,228,220,.42)); }
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
      const [lastUrl, setLastUrl] = useState('');

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

      /**
       * ⚠️ 轮询必须去重，不能裸 setInterval。
       *
       * GET /monitor 每次都会同步探一次 ComfyUI：`resolveComfyUrl()` 要顺序试
       * 9 个候选端口（每个 1200ms 超时），探活缓存 TTL 只有 5s，命中后再打一次
       * 2500ms 的 /system_stats。ComfyUI 没开时**单次请求最坏 10 秒以上**。
       *
       * 旧实现是 `setInterval(refresh, 2000)` 且没有 in-flight 标记：
       * 2 秒压一个 10 秒的请求，请求会越堆越多，面板数字长期不刷新。
       * 现在改成"上一次没回来就跳过本次"，并改用 setTimeout 自调度，
       * 保证任何情况下同一时刻最多一个在飞。
       */
      useEffect(() => {
        let alive = true;
        let timer = null;
        let inFlight = false;

        const tick = async () => {
          if (!alive) return;
          // 后台标签页不轮询（省电，也不给 host 添负担）
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            timer = setTimeout(tick, POLL_MS);
            return;
          }
          if (!inFlight) {
            inFlight = true;
            try { await refresh(); } finally { inFlight = false; }
          }
          if (alive) timer = setTimeout(tick, POLL_MS);
        };

        void tick();
        return () => { alive = false; if (timer) clearTimeout(timer); };
      }, [refresh]);

      const openApp = useCallback((hash) => {
        const base = origin || (typeof window !== 'undefined' && window.location.origin.startsWith('http')
          ? window.location.origin
          : '');
        if (!base) {
          setErr('拿不到 Host origin（请重试或检查 Host 是否注入）');
          return;
        }
        const url = `${base.replace(/\/$/, '')}/jiuzhang/app/#${hash || '/render'}`;
        let win = null;
        try {
          win = window.open(url, '_blank');
        } catch {
          win = null;
        }
        if (win) {
          try { win.opener = null; } catch { /* 跨源时不可写，忽略 */ }
          setErr('');
        } else {
          /**
           * ⚠️ `window.open()` 返回 null **不等于被浏览器拦截**。
           *
           * DSH Desktop 主窗口装了 `setWindowOpenHandler`：对 http(s) 一律
           * `shell.openExternal(url)` 然后 `return { action: 'deny' }`。
           * deny 会让 window.open() 必然返回 null —— 但页面其实**已经在系统
           * 浏览器里打开了**。旧逻辑据此弹红字「新窗口被浏览器拦截」，
           * 于是每次点入口都在报一个不存在的错误。
           *
           * 所以这里不再判定"被拦截"，只把它们当成"已交给系统打开"，
           * 并始终把可点的真实链接留在面板上（浏览器真拦截时用户可以直接点）。
           */
          setErr('');
        }
        setLastUrl(url);
      }, [origin]);

      // ⚠️ 必须与 app-src/src/router.tsx 的 ROUTES **逐项一致**。
      //    历史上这里留了 script/comic/mw 三个已删除页面的入口，
      //    点进去 SPA 会静默回退到 #/render，用户以为"入口坏了"。
      //    漏一个入口 → 用户认为功能没有；多一个入口 → 点进去落错页。
      const entries = [
        // 制作
        { key: 'render', label: T.render, desc: '提示词→成片' },
        { key: 'storyboard', label: T.storyboard, desc: '看图+写分镜' },
        { key: 'workshop', label: T.workshop, desc: '剧本→分段' },
        // 资源
        { key: 'assets', label: T.assets, desc: '15 类素材' },
        { key: 'vault', label: T.vault, desc: '一致性锚点' },
        { key: 'projects', label: T.projects, desc: '导入/新建' },
        // 工具
        { key: 'breakdown', label: T.breakdown, desc: '立绘→设定卡' },
        { key: 'previz', label: T.previz, desc: 'Blender 灰模' },
        { key: 'canvas', label: T.canvas, desc: '26 节点' },
        { key: 'image', label: T.image, desc: 'H3-Image' },
        // 系统
        { key: 'jobs', label: T.jobs, desc: '队列/取消' },
        { key: 'settings', label: T.settings, desc: '模型/健康' },
      ];

      const jobs = mon?.jobs || {};
      const h3ok = mon?.h3?.ok;
      const blender = mon?.blender;
      const blenderOk = blender == null ? null : (blender.ok === true || blender.ok === 'true');

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
        // 保留可点的真实链接：Desktop 下 window.open 会被 shell.openExternal 接管，
        // 浏览器真拦截时用户也能直接点这里。文案不再谎报"被拦截"。
        lastUrl ? h('div', { className: 'jz-card' },
          h('div', { className: 'jz-xs jz-muted', style: { marginBottom: 4 } }, T.lastOpened),
          h('a', {
            href: lastUrl, target: '_blank', rel: 'noreferrer',
            style: { color: 'var(--dsw-alias-brand-primary,#C8564A)', wordBreak: 'break-all', fontSize: 11 },
          }, lastUrl)) : null,

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
          h(Row, { k: T.monPreviz, v: blenderOk == null ? '—' : blenderOk ? T.online : T.offline, ok: blenderOk }),
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