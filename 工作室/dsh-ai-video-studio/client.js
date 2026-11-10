/* AI Video Studio — DSH Client 插件
 * 布局语言对齐「预演导演台」：54px 顶栏 + 238/max400/320 三栏 + 264px 时间轴。
 * 颜色优先使用 DSH 主题令牌（--dsw-alias-*），导演台深色值仅作 fallback。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-ai-video-studio',
  factory(require) {
    const React = require('react');
    const { useEffect, useState, useCallback, useMemo, useRef } = React;
    const h = React.createElement;

    /* ---------------------------------- 常量 ---------------------------------- */
    const API = '/ai-video-studio/api';
    const STYLE_ATTR = 'data-avs-style';
    const MODES = ['ref2v', 'fl2v', 'i2v', 't2v'];
    const BACKENDS = ['mock', 'h3-local', 'seedance-cloud'];
    const RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'];
    const SECRET_PLACEHOLDER = '（保持不变；如需更换请填写新 Key）';
    const PROFILE_FALLBACK = ['P12-draft', 'P16-std', 'P24-quality', 'cloud-fallback'];
    const ACTOR_FALLBACK = [
      { id: 'person', label: '标准人物', kind: 'person' },
      { id: 'tall-person', label: '高个人物', kind: 'person' },
      { id: 'child', label: '儿童人物', kind: 'person' },
      { id: 'quadruped', label: '四足动物', kind: 'animal' },
      { id: 'small-animal', label: '小型动物', kind: 'animal' },
      { id: 'crowd-3', label: '小型群众', kind: 'crowd' },
      { id: 'crowd-5', label: '大型群众', kind: 'crowd' },
    ];
    const PROP_FALLBACK = [
      { id: 'table', label: '长桌', kind: 'box' },
      { id: 'round-table', label: '圆桌', kind: 'cylinder' },
      { id: 'chair', label: '椅子', kind: 'box' },
      { id: 'sofa', label: '沙发', kind: 'box' },
      { id: 'door', label: '门', kind: 'wall' },
      { id: 'wall', label: '墙体', kind: 'wall' },
      { id: 'column', label: '立柱', kind: 'cylinder' },
      { id: 'car', label: '车辆', kind: 'box' },
      { id: 'screen', label: '屏幕', kind: 'box' },
    ];

    const DICT = {
      zh: {
        nav_shots: '分镜', nav_jobs: '任务', nav_assets: '资产包', nav_previz: '预演', nav_backends: '后端', nav_settings: '设置',
        brand_name: 'AI 视频工作室', brand_sub: '预演导演台 · 分镜工作台',
        top_director: '导演台', top_export: '导出预演包', top_checks: '自检',
        panel_shots: '分镜', panel_elements: '舞台元素', panel_new_project: '新建项目', panel_new_shot: '新建镜头',
        panel_actors: '演员库', panel_props: '道具库',
        insp_props: '属性', insp_render: '预演', insp_data: '数据',
        sec_basic: '镜头参数', sec_look: '画面', sec_audio: '声音', sec_refs: '参考素材', sec_keyframes: '关键帧',
        sec_prompt: '提示词', sec_service: '预演服务', sec_render: '渲染预演像素', sec_result: '渲染产物',
        sec_engine: '引擎工程', sec_frame: '单帧求值', sec_health: '健康检查', sec_rules: '智能体规则',
        sec_caps: '能力', sec_profiles: '生成档位', sec_config: '配置', sec_jobs: '任务', sec_assets: '资产包',
        sec_backends: '后端', sec_project: '项目',
        fld_title: '标题', fld_mode: '模式', fld_duration: '时长', fld_ratio: '比例', fld_backend: '后端',
        fld_profile: '档位', fld_style: '风格', fld_desc: '画面描述', fld_camera: '运镜', fld_dialogue: '台词',
        fld_sound: '环境声', fld_music: '配乐', fld_images: '参考图', fld_videos: '参考视频', fld_audios: '参考音频',
        fld_first: '首帧', fld_last: '尾帧', fld_override: '手动提示词', fld_samples: '采样', fld_long: '长边',
        fld_fps: '帧率', fld_name: '名称', fld_pack: '资产包 ID', fld_root: '目录',
        btn_save: '保存镜头', btn_compile: '编译提示词', btn_generate: '生成视频', btn_start: '启动服务',
        btn_stop: '停止服务', btn_refresh: '刷新', btn_load_state: '读取工程', btn_attach: '导出预演包并绑定',
        btn_render: '渲染预演像素', btn_eval: '按播放头求值', btn_open: '打开导演台', btn_reload: '重载舞台',
        btn_mount: '挂载', btn_unmount: '卸载', btn_verify: '校验', btn_retry: '重试', btn_cancel: '取消',
        btn_qc: '质检', btn_save_cfg: '保存配置', btn_create: '创建', btn_check: '运行自检', btn_close: '关闭',
        empty_no_project: '还没有项目。点「新建项目」创建第一个。',
        empty_no_shot: '这个项目还没有镜头，点「新建镜头」。',
        empty_no_element: '引擎未返回舞台元素，启动预演服务后读取工程。',
        empty_no_jobs: '还没有生成任务。',
        empty_no_packs: '尚未挂载资产包。',
        empty_not_running: '预演服务未运行，舞台先显示占位。',
        empty_no_backends: '还没检测后端，点「刷新」。',
        empty_no_render: '这个镜头还没有渲染产物。',
        empty_no_sel: '先在左侧选择一个镜头。',
        empty_no_catalog: '引擎未返回目录，显示内置预设。',
        tl_shots: '镜头', tl_kf: '关键帧', tl_actions: '动作',
        msg_saved: '镜头已保存', msg_created: '已创建', msg_compiled: '已编译', msg_generated: '任务已提交',
        msg_attached: '预演包已绑定', msg_rendered: '渲染完成', msg_started: '预演服务已启动',
        msg_stopped: '预演服务已停止', msg_mounted: '已挂载', msg_unmounted: '已卸载', msg_verified: '校验通过',
        msg_cfg: '配置已保存', msg_checks: '自检', msg_evaluated: '单帧求值完成', msg_qc: '质检',
        lbl_live: '导演台', lbl_frames: '渲染帧', lbl_ok: '正常', lbl_bad: '异常', lbl_none: '无',
        lbl_service: '服务', lbl_port: '端口', lbl_mode: '模式', lbl_frames_n: '帧', lbl_shot: '引擎镜头',
        lbl_elements: '元素', lbl_shots_c: '镜头数', lbl_duration: '时长', lbl_bound: '预演', lbl_unbound: '未预演',
      },
      en: {
        nav_shots: 'Shots', nav_jobs: 'Jobs', nav_assets: 'Assets', nav_previz: 'Previz', nav_backends: 'Backends', nav_settings: 'Settings',
        brand_name: 'AI Video Studio', brand_sub: 'Previs director · shot workbench',
        top_director: 'Director', top_export: 'Export previz', top_checks: 'checks',
        panel_shots: 'Shots', panel_elements: 'Stage elements', panel_new_project: 'New project', panel_new_shot: 'New shot',
        panel_actors: 'Actors', panel_props: 'Props',
        insp_props: 'Properties', insp_render: 'Previz', insp_data: 'Data',
        sec_basic: 'Shot', sec_look: 'Look', sec_audio: 'Audio', sec_refs: 'References', sec_keyframes: 'Keyframes',
        sec_prompt: 'Prompt', sec_service: 'Previz service', sec_render: 'Render pixels', sec_result: 'Render output',
        sec_engine: 'Engine project', sec_frame: 'Frame evaluation', sec_health: 'Health', sec_rules: 'Agent rules',
        sec_caps: 'Capabilities', sec_profiles: 'Profiles', sec_config: 'Config', sec_jobs: 'Jobs', sec_assets: 'Assets',
        sec_backends: 'Backends', sec_project: 'Project',
        fld_title: 'Title', fld_mode: 'Mode', fld_duration: 'Duration', fld_ratio: 'Aspect', fld_backend: 'Backend',
        fld_profile: 'Profile', fld_style: 'Style', fld_desc: 'Description', fld_camera: 'Camera', fld_dialogue: 'Dialogue',
        fld_sound: 'Soundscape', fld_music: 'Music', fld_images: 'Ref images', fld_videos: 'Ref videos', fld_audios: 'Ref audio',
        fld_first: 'First', fld_last: 'Last', fld_override: 'Prompt override', fld_samples: 'Samples', fld_long: 'Long side',
        fld_fps: 'FPS', fld_name: 'Name', fld_pack: 'Pack ID', fld_root: 'Directory',
        btn_save: 'Save shot', btn_compile: 'Compile prompt', btn_generate: 'Generate', btn_start: 'Start service',
        btn_stop: 'Stop service', btn_refresh: 'Refresh', btn_load_state: 'Load project', btn_attach: 'Export & attach',
        btn_render: 'Render pixels', btn_eval: 'Evaluate at playhead', btn_open: 'Open director', btn_reload: 'Reload stage',
        btn_mount: 'Mount', btn_unmount: 'Unmount', btn_verify: 'Verify', btn_retry: 'Retry', btn_cancel: 'Cancel',
        btn_qc: 'QC', btn_save_cfg: 'Save config', btn_create: 'Create', btn_check: 'Run self-check', btn_close: 'Close',
        empty_no_project: 'No projects yet. Use “New project”.',
        empty_no_shot: 'No shots in this project. Use “New shot”.',
        empty_no_element: 'No stage elements returned. Start previz and load the project.',
        empty_no_jobs: 'No jobs yet.',
        empty_no_packs: 'No asset packs mounted.',
        empty_not_running: 'Previz service is not running. Showing a placeholder stage.',
        empty_no_backends: 'Backends not probed yet. Press Refresh.',
        empty_no_render: 'This shot has no rendered output yet.',
        empty_no_sel: 'Select a shot on the left first.',
        empty_no_catalog: 'No engine catalog. Showing built-in presets.',
        tl_shots: 'Shots', tl_kf: 'Keys', tl_actions: 'Actions',
        msg_saved: 'Shot saved', msg_created: 'Created', msg_compiled: 'Compiled', msg_generated: 'Job submitted',
        msg_attached: 'Previz package attached', msg_rendered: 'Render finished', msg_started: 'Previz service started',
        msg_stopped: 'Previz service stopped', msg_mounted: 'Mounted', msg_unmounted: 'Unmounted', msg_verified: 'Verified',
        msg_cfg: 'Config saved', msg_checks: 'Self-check', msg_evaluated: 'Frame evaluated', msg_qc: 'QC',
        lbl_live: 'Director', lbl_frames: 'Frames', lbl_ok: 'OK', lbl_bad: 'Failed', lbl_none: 'none',
        lbl_service: 'Service', lbl_port: 'Port', lbl_mode: 'Mode', lbl_frames_n: 'frames', lbl_shot: 'Engine shot',
        lbl_elements: 'elements', lbl_shots_c: 'shots', lbl_duration: 'duration', lbl_bound: 'previz', lbl_unbound: 'no previz',
      },
    };

    const ICONS = {
      play: { d: 'M8 5l11 7-11 7z', fill: true },
      stop: { d: 'M6 6h12v12H6z', fill: true },
      plus: { d: 'M12 5v14M5 12h14' },
      refresh: { d: 'M20 12a8 8 0 1 1-2.34-5.66M20 4.5V10h-5.5' },
      camera: { d: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 10.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z' },
      save: { d: 'M5 4h11l3 3v13H5zM8.5 4v5h7V4M8.5 13h7v7h-7z' },
      spark: { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' },
      link: { d: 'M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 5.6l-1.3 1.3M14 10a4 4 0 0 1 0 5.6l-2 2A4 4 0 0 1 6.4 12l1.3-1.3' },
      external: { d: 'M14 4h6v6M20 4l-8.5 8.5M18 14.5V20H4V6h5.5' },
      layers: { d: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5' },
      film: { d: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9.5h16M4 14.5h16' },
      cube: { d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' },
      gear: { d: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2' },
      list: { d: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
      dot: { d: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', fill: true },
      chevron: { d: 'M6 9l6 6 6-6' },
      trash: { d: 'M5 7h14M9.5 7V4.5h5V7M7.5 7l1 13h7l1-13' },
      close: { d: 'M6 6l12 12M18 6L6 18' },
      image: { d: 'M4 5h16v14H4zM4 15l4.5-4.5 3.5 3.5L15 11l5 5' },
    };

    /* ---------------------------------- CSS ---------------------------------- */
    const CSS = [
      '.avs-root{--avs-bg:var(--dsw-alias-bg-base,#0e1012);--avs-top:var(--dsw-alias-bg-layer-1,#131518);',
      '--avs-panel:var(--dsw-specific-sidebar-fill,#15171a);--avs-panel2:var(--dsw-alias-bg-layer-2,#1c1f23);',
      '--avs-sunken:var(--dsw-alias-bg-base,#111317);--avs-hover:var(--dsw-alias-bg-overlay,#2a2e34);',
      '--avs-bd:var(--dsw-alias-border-l1,#292d33);--avs-bd2:var(--dsw-alias-border-l2,#343940);',
      '--avs-tx:var(--dsw-alias-label-primary,#e7e9ed);--avs-mu:var(--dsw-alias-label-secondary,#9da4ad);',
      '--avs-brand:var(--dsw-alias-brand-primary,#8f98a3);--avs-ok:var(--dsw-alias-state-success-primary,#4bbf8a);',
      '--avs-warn:var(--dsw-alias-state-warn-primary,#d6a447);--avs-err:var(--dsw-alias-state-error-primary,#ff8f86);',
      '--avs-idle:var(--dsw-alias-state-idle-primary,#878d97);--avs-stage:var(--dsw-alias-bg-base,#17191d);',
      '--avs-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
      // 布局默认值（媒体查询会覆盖）；折叠时由 .is-*-collapsed 置 0
      '--avs-left-def:clamp(152px,17%,238px);--avs-right-def:clamp(236px,25%,320px);--avs-timeline-h:min(264px,34vh);',
      'position:relative;display:flex;flex-direction:column;height:100%;min-height:320px;background:var(--avs-bg);',
      // 注意：.avs-root 自己不能作为「查询自己」的容器（CSS 容器查询只作用于后代），
      // 所以这里不用 @container 驱动自身宽度的变量，改用 JS 测量面板实际宽度后
      // 通过内联 style 设置 --avs-left-w / --avs-right-w / --avs-timeline-h。
      'color:var(--avs-tx);font:12px/1.45 Inter,ui-sans-serif,system-ui,"Segoe UI","Microsoft YaHei",sans-serif;overflow:hidden}',
      '.avs-root *,.avs-root *::before,.avs-root *::after{box-sizing:border-box}',
      '.avs-root button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}',
      '.avs-root button:disabled{opacity:.5;cursor:not-allowed}',
      '.avs-root input,.avs-root select,.avs-root textarea{font:inherit}',
      '.avs-root ::-webkit-scrollbar{width:9px;height:9px}',
      '.avs-root ::-webkit-scrollbar-thumb{background:var(--avs-bd2);border-radius:6px}',
      '.avs-root ::-webkit-scrollbar-track{background:transparent}',
      /* 顶栏 */
      '.avs-topbar{flex:0 0 auto;height:54px;display:flex;align-items:center;justify-content:space-between;gap:12px;',
      'padding:0 14px;background:var(--avs-top);border-bottom:1px solid var(--avs-bd);position:relative;z-index:6}',
      '.avs-brand{display:flex;align-items:center;gap:9px;min-width:0}',
      '.avs-brand-mark{width:26px;height:26px;border-radius:6px;display:grid;place-items:center;background:var(--avs-panel2);',
      'border:1px solid var(--avs-bd2);color:var(--avs-tx);flex:0 0 auto}',
      '.avs-brand-text{display:flex;flex-direction:column;min-width:0}',
      '.avs-brand-text strong{font-size:14px;font-weight:650;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.avs-brand-text span{color:var(--avs-mu);font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.avs-health{display:inline-flex;align-items:center;gap:6px;color:var(--avs-mu);font-size:11px;margin-left:4px}',
      '.avs-health b{width:7px;height:7px;border-radius:50%;background:var(--avs-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--avs-ok) 22%,transparent)}',
      '.avs-health.is-bad b{background:var(--avs-err);box-shadow:0 0 0 3px color-mix(in srgb,var(--avs-err) 22%,transparent)}',
      '.avs-nav{display:flex;align-items:center;gap:2px;background:var(--avs-sunken);border:1px solid var(--avs-bd);border-radius:6px;padding:3px}',
      '.avs-nav button{height:28px;padding:0 11px;border-radius:4px;color:var(--avs-mu);font-size:11px;white-space:nowrap}',
      '.avs-nav button:hover{color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-nav button.is-active{color:var(--avs-tx);background:var(--avs-panel2);box-shadow:inset 0 0 0 1px var(--avs-bd2)}',
      '.avs-topbar-right{display:flex;align-items:center;gap:6px;flex:0 0 auto}',
      '.avs-text-button{display:inline-flex;align-items:center;gap:6px;color:var(--avs-tx);background:var(--avs-panel2);',
      'border:1px solid var(--avs-bd2);border-radius:5px;height:32px;padding:0 10px;font-size:11px;white-space:nowrap}',
      '.avs-text-button:hover:not(:disabled){background:var(--avs-hover);border-color:var(--avs-brand)}',
      '.avs-text-button.is-wide{width:100%;justify-content:center}',
      '.avs-icon-button{width:32px;height:32px;display:grid;place-items:center;border-radius:5px;border:1px solid transparent;color:var(--avs-mu)}',
      '.avs-icon-button:hover:not(:disabled){background:var(--avs-hover);color:var(--avs-tx)}',
      '.avs-badge{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:999px;',
      'background:var(--avs-panel2);border:1px solid var(--avs-bd2);color:var(--avs-mu);font:11px/1 var(--avs-mono)}',
      '.avs-badge.is-bad{color:var(--avs-err);border-color:color-mix(in srgb,var(--avs-err) 35%,var(--avs-bd2))}',
      /* 三栏 */
      '.avs-main{flex:1 1 auto;min-height:0;display:grid;min-width:0;position:relative;',
      // 三栏宽度由变量驱动：--avs-left/right-def 是「该断点下的默认宽」，
      // 折叠时置 0。这样媒体查询与折叠互不打架。
      // 中间列用 minmax(0,1fr)。注意：不能把两侧设为 0px —— 实测 `0px 1fr 0px`
      // 会让 1fr 拿到 0（Chromium 行为），必须直接切换 grid-template-columns。
      'grid-template-columns:var(--avs-cols,var(--avs-left-def,clamp(152px,17%,238px)) minmax(0,1fr) var(--avs-right-def,clamp(236px,25%,320px)))}',
      // 折叠时整体替换列定义（而不是把某一列设 0）
      '.avs-main.is-left-collapsed{--avs-cols:minmax(0,1fr) var(--avs-right-def,clamp(236px,25%,320px))}',
      '.avs-main.is-right-collapsed{--avs-cols:var(--avs-left-def,clamp(152px,17%,238px)) minmax(0,1fr)}',
      '.avs-main.is-left-collapsed.is-right-collapsed{--avs-cols:minmax(0,1fr)}',
      // 三列包装。踩坑：grid 子项同时带 flex-direction:column + overflow:hidden 时
      // 在窄轨道里会算出 0 宽。这里保留 flex column（内部组件需要撑高），但不加 overflow。
      '.avs-main > .avs-col{min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}',
      '.avs-main > .avs-col.is-mid{min-width:0;overflow:hidden}',
      '.avs-main > .avs-col.is-left,.avs-main > .avs-col.is-right{overflow:hidden}',
      '.avs-main.is-left-collapsed .avs-col.is-left{display:none}',
      '.avs-main.is-right-collapsed .avs-col.is-right{display:none}',
      '.avs-main.is-left-collapsed .avs-shots-panel{display:none}',
      '.avs-main.is-right-collapsed .avs-inspector{display:none}',
      // 折叠/展开按钮：悬浮在各栏边缘
      '.avs-collapse-btn{position:absolute;top:50%;transform:translateY(-50%);z-index:12;width:18px;height:56px;',
      'display:grid;place-items:center;cursor:pointer;background:var(--avs-panel2);border:1px solid var(--avs-bd2);',
      'color:var(--avs-mu);font-size:9px;line-height:1;padding:0;opacity:.55;transition:opacity .15s}',
      '.avs-collapse-btn:hover{opacity:1;color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-collapse-btn.is-left{left:0;border-radius:0 5px 5px 0;border-left:0}',
      '.avs-collapse-btn.is-right{right:0;border-radius:5px 0 0 5px;border-right:0}',
      // 折叠后的重新展开把手（贴在视口边缘）
      '.avs-expand-strip{position:absolute;top:50%;transform:translateY(-50%);z-index:12;width:14px;height:72px;',
      'display:grid;place-items:center;cursor:pointer;background:var(--avs-panel2);border:1px solid var(--avs-bd2);',
      'color:var(--avs-mu);font-size:9px;padding:0;opacity:.7}',
      '.avs-expand-strip:hover{opacity:1;color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-expand-strip.is-left{left:0;border-radius:0 5px 5px 0;border-left:0}',
      '.avs-expand-strip.is-right{right:0;border-radius:5px 0 0 5px;border-right:0}',
      '.avs-main.is-flat{display:block;overflow:auto;padding:14px;min-height:0}',
      '.avs-shots-panel{background:var(--avs-panel);border-right:1px solid var(--avs-bd);overflow:auto;min-height:0;display:flex;flex-direction:column}',
      '.avs-inspector{background:var(--avs-panel);border-left:1px solid var(--avs-bd);overflow:auto;min-height:0;display:flex;flex-direction:column}',
      '.avs-panel-title{display:flex;align-items:center;justify-content:space-between;height:42px;padding:0 12px;',
      'color:var(--avs-mu);font-size:12px;font-weight:650;letter-spacing:.02em}',
      '.avs-panel-title.is-sub{height:34px;font-size:11px;font-weight:600;border-top:1px solid var(--avs-bd)}',
      '.avs-panel-count{font:10px var(--avs-mono);color:var(--avs-idle);background:var(--avs-sunken);',
      'border:1px solid var(--avs-bd);border-radius:4px;padding:1px 6px}',
      '.avs-project-row{display:flex;gap:6px;padding:0 8px 8px}',
      '.avs-select{color:var(--avs-tx);background:var(--avs-panel2);border:1px solid var(--avs-bd2);border-radius:5px;',
      'height:30px;padding:0 7px;font-size:11px;min-width:0;outline:0;width:100%}',
      '.avs-select:focus{border-color:var(--avs-brand)}',
      '.avs-inline-form{display:flex;gap:6px;padding:0 8px 8px}',
      '.avs-inline-form input{flex:1 1 auto;min-width:0;color:var(--avs-tx);background:var(--avs-sunken);',
      'border:1px solid var(--avs-bd2);border-radius:5px;height:30px;padding:0 8px;font-size:11px;outline:0}',
      '.avs-shot-list{padding:0 8px 8px;flex:0 0 auto}',
      '.avs-shot-row{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;width:100%;text-align:left;',
      'min-height:54px;padding:7px;margin-bottom:5px;border-radius:6px;background:var(--avs-panel2);',
      'border:1px solid transparent;align-items:start}',
      '.avs-shot-row:hover{background:var(--avs-hover)}',
      '.avs-shot-row.is-active{background:var(--avs-hover);border-color:var(--avs-brand)}',
      '.avs-shot-index{width:30px;height:30px;border-radius:4px;background:var(--avs-sunken);color:var(--avs-mu);',
      'font:600 11px var(--avs-mono);display:grid;place-items:center}',
      '.avs-shot-main{min-width:0;display:block}',
      '.avs-shot-main strong{display:block;font-size:12px;font-weight:600;margin:1px 0 4px;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.avs-shot-main small{display:block;color:var(--avs-mu);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-shot-main small.is-dim{color:var(--avs-idle);font-family:var(--avs-mono)}',
      '.avs-new-shot-row{padding:0 8px 10px}',
      '.avs-element-list{border-top:1px solid var(--avs-bd);flex:1 1 auto;min-height:90px;overflow:auto;padding-bottom:6px}',
      '.avs-element-row{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:8px;align-items:center;',
      'width:calc(100% - 16px);height:34px;margin:2px 8px;padding:0 8px;border-radius:4px;font-size:12px;text-align:left}',
      '.avs-element-row:hover{background:var(--avs-hover)}',
      '.avs-element-row span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-element-row small{color:var(--avs-idle);font-size:9px;font-family:var(--avs-mono)}',
      '.avs-identity-dot{width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,.16);background:var(--avs-brand)}',
      '.avs-library-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 8px 14px;border-top:1px solid var(--avs-bd)}',
      '.avs-library-buttons button{height:34px;border-radius:5px;background:var(--avs-panel2);border:1px solid var(--avs-bd2);',
      'color:var(--avs-mu);font-size:10px}',
      '.avs-library-buttons button:hover{background:var(--avs-hover);color:var(--avs-tx);border-color:var(--avs-brand)}',
      /* 舞台 */
      '.avs-stage-area{position:relative;background:var(--avs-stage);overflow:hidden;min-width:0;min-height:0;flex:1 1 auto;width:100%}',
      '.avs-stage-toolbar{position:absolute;top:12px;left:12px;z-index:4;display:flex;gap:2px;padding:4px;border-radius:6px;',
      'background:color-mix(in srgb,var(--avs-top) 91%,transparent);border:1px solid var(--avs-bd2);backdrop-filter:blur(8px)}',
      '.avs-stage-toolbar button{width:34px;height:32px;display:grid;place-items:center;border-radius:4px;color:var(--avs-mu)}',
      '.avs-stage-toolbar button:hover:not(:disabled){background:var(--avs-tx);color:var(--avs-sunken)}',
      '.avs-stage-toolbar button.is-active{background:var(--avs-tx);color:var(--avs-sunken)}',
      '.avs-stage-modes{position:absolute;top:12px;right:12px;z-index:4;width:auto}',
      '.avs-stage-body{position:absolute;inset:0;padding:14px;display:flex;align-items:center;justify-content:center;',
      'container-type:size;min-width:0;min-height:0}',
      '.avs-stage-box{position:relative;width:min(100cqw,calc(100cqh * 16 / 9));max-width:100%;max-height:100%;',
      'aspect-ratio:16/9;background:var(--avs-sunken);border:1px solid var(--avs-bd);border-radius:8px;overflow:hidden}',
      '.avs-stage-frame{width:100%;height:100%;border:0;display:block;background:var(--avs-sunken)}',
      '.avs-stage-img{width:100%;height:100%;object-fit:contain;display:block;background:#0b0c0e}',
      '.avs-stage-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'gap:10px;padding:24px;text-align:center;color:var(--avs-mu);font-size:12px;line-height:1.6}',
      '.avs-stage-chip{position:absolute;left:14px;bottom:14px;z-index:5;display:flex;align-items:center;gap:7px;',
      'padding:5px 9px;border-radius:5px;background:color-mix(in srgb,var(--avs-top) 88%,transparent);',
      'border:1px solid var(--avs-bd2);color:var(--avs-mu);font:10px var(--avs-mono);backdrop-filter:blur(8px)}',
      /* 检查器 */
      '.avs-inspector-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;height:43px;padding:5px;',
      'background:var(--avs-panel);border-bottom:1px solid var(--avs-bd);position:sticky;top:0;z-index:3}',
      '.avs-inspector-tabs button{border-radius:4px;color:var(--avs-mu);font-size:11px}',
      '.avs-inspector-tabs button:hover{color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-inspector-tabs button.is-active{color:var(--avs-tx);background:var(--avs-panel2)}',
      '.avs-inspector-content{padding:14px}',
      '.avs-inspector-content h3{color:var(--avs-mu);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 7px;',
      'font-size:10px;font-weight:650}',
      '.avs-inspector-content h3:first-child{margin-top:0}',
      '.avs-selection-heading{display:flex;align-items:center;gap:9px;margin-bottom:16px;min-width:0}',
      '.avs-selection-heading strong{font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-selection-heading small{color:var(--avs-idle);font:9px var(--avs-mono);white-space:nowrap}',
      '.avs-field-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
      '.avs-field-grid.is-two{grid-template-columns:repeat(2,1fr)}',
      '.avs-wide-field{display:grid;grid-template-columns:88px 1fr;align-items:center;margin-bottom:8px;gap:8px}',
      '.avs-wide-field span{color:var(--avs-mu);font-size:9px}',
      '.avs-wide-field input,.avs-wide-field textarea,.avs-wide-field select{color:var(--avs-tx);background:var(--avs-sunken);',
      'border:1px solid var(--avs-bd2);border-radius:5px;height:34px;padding:0 9px;font-size:10px;outline:0;width:100%;min-width:0}',
      '.avs-wide-field textarea{height:auto;padding:7px 9px;resize:vertical;line-height:1.5;font-family:inherit}',
      '.avs-wide-field input:focus,.avs-wide-field textarea:focus,.avs-wide-field select:focus{border-color:var(--avs-brand)}',
      '.avs-number-field{display:grid;grid-template-columns:18px 1fr;height:30px;align-items:center;border-radius:4px;',
      'background:var(--avs-panel2);border:1px solid var(--avs-bd2);min-width:0}',
      '.avs-number-field span{color:var(--avs-idle);text-align:center;font-size:9px;font-family:var(--avs-mono)}',
      '.avs-number-field input{width:100%;height:100%;padding:0 5px;font-size:11px;color:var(--avs-tx);',
      'background:transparent;border:0;outline:0;font-family:var(--avs-mono);min-width:0}',
      '.avs-select-field{width:100%;height:34px;padding:0 8px;font-size:11px;outline:0;border-radius:5px;',
      'color:var(--avs-tx);background:var(--avs-panel2);border:1px solid var(--avs-bd2)}',
      '.avs-segmented{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;border-radius:5px;',
      'background:var(--avs-sunken);border:1px solid var(--avs-bd)}',
      '.avs-segmented button{height:29px;border-radius:3px;color:var(--avs-mu);font-size:10px}',
      '.avs-segmented button.is-active{color:var(--avs-tx);background:var(--avs-panel2)}',
      '.avs-wide-action{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:36px;',
      'margin-bottom:10px;border-radius:5px;background:var(--avs-panel2);border:1px solid var(--avs-bd2);',
      'color:var(--avs-tx);font-size:10px}',
      '.avs-wide-action:hover:not(:disabled){background:var(--avs-hover);border-color:var(--avs-brand)}',
      '.avs-wide-action.is-primary{background:var(--avs-brand);border-color:var(--avs-brand);color:var(--avs-sunken);font-weight:600}',
      '.avs-wide-action.is-primary:hover:not(:disabled){background:var(--avs-tx);border-color:var(--avs-tx)}',
      '.avs-delete-button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:34px;',
      'margin-top:18px;border-radius:5px;background:color-mix(in srgb,var(--avs-err) 12%,transparent);',
      'border:1px solid color-mix(in srgb,var(--avs-err) 34%,transparent);color:var(--avs-err);font-size:10px}',
      '.avs-delete-button:hover{background:color-mix(in srgb,var(--avs-err) 20%,transparent)}',
      '.avs-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.avs-spacer{flex:1 1 auto}',
      '.avs-thumb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}',
      '.avs-thumb{display:block;border:1px solid var(--avs-bd);border-radius:5px;overflow:hidden;background:var(--avs-sunken)}',
      '.avs-thumb img{display:block;width:100%;height:auto}',
      '.avs-thumb small{display:block;padding:4px 6px;color:var(--avs-idle);font:9px var(--avs-mono)}',
      '.avs-code{background:var(--avs-sunken);border:1px solid var(--avs-bd);border-radius:5px;padding:8px;',
      'font:10px/1.5 var(--avs-mono);color:var(--avs-mu);max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word}',
      '.avs-kv{display:flex;align-items:baseline;gap:6px;font-size:11px;padding:3px 0;color:var(--avs-mu)}',
      '.avs-kv b{color:var(--avs-tx);font-weight:600}',
      '.avs-help{color:var(--avs-mu);font-size:10px;line-height:1.55;margin:6px 0 10px}',
      '.avs-empty-panel{color:var(--avs-mu);padding:20px 12px;font-size:11px;line-height:1.6;text-align:center}',
      /* 资产库网格 */
      '.avs-nav-chip{cursor:pointer;height:24px;padding:0 9px;border-radius:12px;border:1px solid var(--avs-bd2);',
      'background:var(--avs-panel2);color:var(--avs-mu);font-size:10px;white-space:nowrap}',
      '.avs-nav-chip:hover{color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-nav-chip.is-active{background:var(--avs-tx);border-color:var(--avs-tx);color:var(--avs-bg)}',
      '.avs-asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:8px;margin-top:10px}',
      '.avs-asset-card{background:var(--avs-panel2);border:1px solid var(--avs-bd);border-radius:6px;padding:7px;min-width:0}',
      '.avs-asset-thumb{height:68px;border-radius:4px;background:var(--avs-sunken);display:grid;place-items:center;overflow:hidden}',
      '.avs-asset-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.avs-asset-kind{font:9px var(--avs-mono);color:var(--avs-mu);text-transform:uppercase}',
      '.avs-asset-meta{margin-top:5px;min-width:0}',
      '.avs-asset-meta b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.avs-asset-meta small{display:block;color:var(--avs-mu);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.avs-text-button.is-danger{color:var(--avs-err)}',
      /* 角色卡 */
      '.avs-char-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(106px,1fr));gap:8px;margin-top:10px}',
      '.avs-char-card{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 7px;cursor:pointer;',
      'background:var(--avs-panel2);border:1px solid var(--avs-bd);border-radius:6px;color:var(--avs-tx);text-align:center}',
      '.avs-char-card:hover{background:var(--avs-hover)}',
      '.avs-char-card.is-active{border-color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-char-card b{font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-char-card small{color:var(--avs-mu);font-size:9px}',
      '.avs-char-avatar{width:50px;height:50px;border-radius:50%;overflow:hidden;background:var(--avs-sunken);',
      'display:grid;place-items:center;color:var(--avs-mu)}',
      '.avs-char-avatar img{width:100%;height:100%;object-fit:cover}',
      '.avs-char-editor{margin-top:14px;padding-top:12px;border-top:1px solid var(--avs-bd)}',
      '.avs-ref-strip{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
      '.avs-ref-item{width:62px;text-align:center}',
      '.avs-ref-item img{width:62px;height:62px;object-fit:cover;border-radius:4px;border:1px solid var(--avs-bd)}',
      '.avs-ref-item small{display:block;color:var(--avs-mu);font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-empty-panel.is-slim{padding:10px 8px;font-size:10px;text-align:left}',
      /* 扁平页签面板 */
      '.avs-panel{background:var(--avs-panel);border:1px solid var(--avs-bd);border-radius:8px;margin-bottom:12px;overflow:hidden}',
      '.avs-panel-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;',
      'border-bottom:1px solid var(--avs-bd);background:var(--avs-panel)}',
      '.avs-panel-h2{margin:0;font-size:12px;font-weight:650;letter-spacing:.02em}',
      '.avs-panel-sub{display:block;color:var(--avs-idle);font:10px var(--avs-mono);margin-top:2px}',
      '.avs-panel-body{padding:12px 14px}',
      '.avs-list-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--avs-bd);font-size:11px}',
      '.avs-list-row:last-child{border-bottom:0}',
      '.avs-list-row .avs-list-main{flex:1 1 auto;min-width:0}',
      '.avs-list-row .avs-list-main b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-list-row .avs-list-main small{color:var(--avs-idle);font:10px var(--avs-mono)}',
      '.avs-is-ok{color:var(--avs-ok)}.avs-is-bad{color:var(--avs-err)}.avs-is-warn{color:var(--avs-warn)}.avs-is-idle{color:var(--avs-idle)}',
      '.avs-previz-frame{position:relative;width:100%;height:min(56vh,520px);background:var(--avs-sunken);',
      'border:1px solid var(--avs-bd);border-radius:8px;overflow:hidden}',
      '.avs-previz-frame iframe{width:100%;height:100%;border:0;display:block}',
      /* 时间轴 */
      '.avs-timeline{flex:0 0 auto;height:var(--avs-timeline-h);background:var(--avs-top);border-top:1px solid var(--avs-bd);',
      '.avs-timeline.is-collapsed{height:28px}',
      '.avs-timeline.is-collapsed .avs-timeline-body{display:none}',
      '.avs-timeline.is-collapsed .avs-timeline-header{height:28px;border-bottom:0}',
      '.avs-timeline-toggle{cursor:pointer;display:flex;align-items:center;gap:4px;height:22px;padding:0 8px;',
      'border-radius:4px;border:1px solid var(--avs-bd2);background:var(--avs-panel2);color:var(--avs-mu);font-size:9px}',
      '.avs-timeline-toggle:hover{color:var(--avs-tx);background:var(--avs-hover)}',
      'display:flex;flex-direction:column;overflow:hidden;min-width:0}',
      '.avs-timeline-header{flex:0 0 auto;display:flex;align-items:center;gap:10px;height:48px;padding:0 12px;',
      'background:var(--avs-panel);border-bottom:1px solid var(--avs-bd)}',
      '.avs-timeline-header strong{width:86px;font:600 12px var(--avs-mono);letter-spacing:.04em}',
      '.avs-timeline-header span.avs-tl-meta{color:var(--avs-idle);font:10px var(--avs-mono);white-space:nowrap}',
      '.avs-play-button{width:32px;height:32px;display:grid;place-items:center;border-radius:5px;',
      'background:var(--avs-tx);color:var(--avs-sunken)}',
      '.avs-play-button:hover:not(:disabled){background:var(--avs-brand);color:var(--avs-sunken)}',
      '.avs-timeline-body{flex:1 1 auto;display:grid;grid-template-columns:150px minmax(0,1fr);min-height:0}',
      '.avs-timeline-labels{background:var(--avs-panel);border-right:1px solid var(--avs-bd2);z-index:4;',
      'box-shadow:6px 0 12px rgba(0,0,0,.16);min-height:0;overflow:hidden}',
      '.avs-timeline-label{display:flex;align-items:center;gap:7px;height:42px;padding:0 11px;font-size:10px;',
      'color:var(--avs-mu);border-bottom:1px solid var(--avs-bd);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.avs-timeline-label.is-ruler{height:28px;color:var(--avs-idle);font:9px var(--avs-mono);letter-spacing:.1em}',
      '.avs-timeline-scroll{min-width:0;overflow:auto}',
      '.avs-timeline-tracks{position:relative;min-height:100%;',
      'background:repeating-linear-gradient(90deg,transparent 0 95px,rgba(255,255,255,.03) 96px),var(--avs-sunken)}',
      '.avs-ruler{position:relative;height:28px;border-bottom:1px solid var(--avs-bd);cursor:crosshair}',
      '.avs-ruler span{position:absolute;top:7px;padding-left:4px;border-left:1px solid var(--avs-bd2);',
      'color:var(--avs-idle);font:8px var(--avs-mono)}',
      '.avs-timeline-row{position:relative;height:42px;border-bottom:1px solid var(--avs-bd)}',
      '.avs-clip{position:absolute;top:5px;bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      'padding:0 7px;border-radius:3px;font-size:9px;text-align:left;color:var(--avs-mu);',
      'background:var(--avs-panel2);border:1px solid var(--avs-bd2)}',
      '.avs-clip:hover{color:var(--avs-tx);background:var(--avs-hover)}',
      '.avs-clip.is-active{color:var(--avs-sunken);background:var(--avs-tx);border-color:var(--avs-tx)}',
      '.avs-action-block{position:absolute;top:6px;height:30px;display:flex;align-items:center;gap:5px;',
      'padding:0 8px;border-radius:4px;font-size:9px;overflow:hidden;white-space:nowrap;',
      'color:var(--avs-tx);background:color-mix(in srgb,var(--avs-brand) 30%,var(--avs-panel2));',
      'border:1px solid var(--avs-bd2)}',
      '.avs-keyframe-dot{position:absolute;top:15px;width:13px;height:13px;margin-left:-6px;transform:rotate(45deg);',
      'border-radius:1px;background:var(--avs-mu);border:1px solid var(--avs-tx);z-index:6}',
      '.avs-keyframe-dot.is-active{background:var(--avs-tx);border-color:var(--avs-tx);',
      'box-shadow:0 0 0 2px color-mix(in srgb,var(--avs-tx) 20%,transparent)}',
      '.avs-playhead{position:absolute;top:0;bottom:0;width:1px;background:var(--avs-tx);z-index:8;',
      'box-shadow:0 0 6px color-mix(in srgb,var(--avs-tx) 40%,transparent);pointer-events:none}',
      '.avs-playhead span{position:absolute;top:0;left:-5px;width:11px;height:11px;background:var(--avs-tx);transform:rotate(45deg)}',
      /* 模态与提示 */
      '.avs-modal-backdrop{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:30px;',
      'background:rgba(0,0,0,.62);backdrop-filter:blur(5px)}',
      '.avs-modal{width:min(720px,92vw);max-height:min(760px,88vh);overflow:auto;border-radius:8px;',
      'background:var(--avs-top);border:1px solid var(--avs-bd2);box-shadow:0 24px 70px rgba(0,0,0,.55)}',
      '.avs-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;',
      'min-height:66px;padding:14px 16px;border-bottom:1px solid var(--avs-bd)}',
      '.avs-modal-header strong{display:block;font-size:13px}',
      '.avs-modal-header small{display:block;color:var(--avs-idle);font:10px var(--avs-mono);margin-top:3px}',
      '.avs-library-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px}',
      '.avs-library-grid>button{display:grid;grid-template-columns:38px 1fr;gap:10px;align-items:start;',
      'min-height:76px;padding:11px;text-align:left;border-radius:6px;background:var(--avs-panel2);',
      'border:1px solid var(--avs-bd2)}',
      '.avs-library-grid>button:hover{background:var(--avs-hover);border-color:var(--avs-brand)}',
      '.avs-library-icon{width:36px;height:36px;border-radius:5px;display:grid;place-items:center;',
      'background:var(--avs-sunken);color:var(--avs-mu)}',
      '.avs-library-text{min-width:0}',
      '.avs-library-text b{display:block;font-size:11px;font-weight:600}',
      '.avs-library-text small{display:block;color:var(--avs-idle);font:9px var(--avs-mono);margin-top:2px;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-toast{position:absolute;left:50%;bottom:calc(min(264px,34vh) + 16px);transform:translateX(-50%);',
      'z-index:30;max-width:min(560px,86%);padding:8px 12px;border-radius:6px;font-size:11px;',
      'background:var(--avs-panel2);border:1px solid var(--avs-bd2);color:var(--avs-tx);cursor:pointer;',
      'box-shadow:0 10px 26px rgba(0,0,0,.35);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.avs-toast.is-error{border-color:color-mix(in srgb,var(--avs-err) 45%,var(--avs-bd2));color:var(--avs-err)}',
      '.avs-toast.is-ok{border-color:color-mix(in srgb,var(--avs-ok) 40%,var(--avs-bd2));color:var(--avs-ok)}',
      '.avs-spin{animation:avs-spin 1s linear infinite}',
      '@keyframes avs-spin{to{transform:rotate(360deg)}}',
      /* 自适应 */
      /* 自适应交给 JS：.avs-main 上由 React 内联设置 --avs-left-w / --avs-right-w，
         .avs-root 上设置 --avs-timeline-h。见 useContainerWidth()。
         这里只保留与宽度无关的顶栏收缩。 */
      '.avs-root[data-narrow="1"] .avs-brand-text span{display:none}',
      '.avs-root[data-narrow="1"] .avs-nav button{padding:0 8px;font-size:10px}',
      '.avs-root[data-narrow="2"] .avs-topbar-right .avs-btn-label{display:none}',
      '.avs-root[data-narrow="2"] .avs-nav button{padding:0 6px;font-size:9px}',
      '@container (min-width:10px){.avs-stage-box{width:min(100cqw,calc(100cqh * 16 / 9))}}',
    ].join('');

    /* --------------------------------- 工具 --------------------------------- */
    const api = async (path, opt) => {
      const options = Object.assign({ headers: { 'Content-Type': 'application/json' } }, opt || {});
      const res = await fetch(API + path, options);
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
      if (!res.ok) throw new Error((data && data.error) || res.status + ' ' + res.statusText);
      return data;
    };
    const fileUrl = (rel) => API + '/file?path=' + encodeURIComponent(rel);
    const safeArr = (v) => (Array.isArray(v) ? v : []);
    const safeMsg = (e) => String((e && e.message) || e || 'unknown error');
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const pad2 = (n) => (n < 10 ? '0' + n : String(n));
    const toPosix = (v) => String(v || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const joinRel = (dir, name) => (dir ? toPosix(dir) + '/' + name : '');
    const fmtOne = (v) => (Math.round((Number(v) || 0) * 10) / 10).toFixed(1);
    const fmtSec = (v) => fmtOne(v) + 's';
    const timecode = (sec) => {
      const s = Math.max(0, Number(sec) || 0);
      const m = Math.floor(s / 60);
      const rest = s - m * 60;
      const whole = Math.floor(rest);
      const frames = Math.min(23, Math.round((rest - whole) * 24));
      return pad2(m) + ':' + pad2(whole) + ':' + pad2(frames);
    };
    const splitLines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const shotMode = (s) => (s && s.mode ? s.mode : 'ref2v');
    const shotDur = (s) => Math.max(0.5, num(s && s.durationSec, 5));
    /** 从提交给后端的配置里剔除未填写的密钥占位符，避免用空串覆盖已存 Key。 */
    const stripSecretPlaceholders = (obj) => {
      const out = Object.assign({}, obj);
      ['seedanceApiKey'].forEach((k) => {
        if (typeof out[k] === 'string' && (out[k] === SECRET_PLACEHOLDER || out[k].indexOf('***') >= 0)) delete out[k];
      });
      return out;
    };

    function Ico(props) {
      const def = ICONS[props.name] || ICONS.dot;
      const size = props.size || 14;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true,
        fill: def.fill ? 'currentColor' : 'none',
        stroke: def.fill ? 'none' : 'currentColor',
        strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'block', flex: '0 0 auto' },
      }, h('path', { d: def.d }));
    }

    function Btn(props) {
      return h('button', {
        className: 'avs-text-button' + (props.wide ? ' is-wide' : ''),
        onClick: props.onClick, disabled: props.disabled, title: props.title,
        style: props.style,
      }, props.icon ? h(Ico, { name: props.icon, size: 13 }) : null, props.label);
    }

    function IconBtn(props) {
      return h('button', {
        className: 'avs-icon-button' + (props.active ? ' is-active' : ''),
        onClick: props.onClick, disabled: props.disabled, title: props.title,
      }, h(Ico, { name: props.name, size: 15 }));
    }

    function WideAction(props) {
      return h('button', {
        className: 'avs-wide-action' + (props.primary ? ' is-primary' : ''),
        onClick: props.onClick, disabled: props.disabled, title: props.title,
      }, props.icon ? h(Ico, { name: props.icon, size: 13, className: props.spin ? 'avs-spin' : '' }) : null, props.label);
    }

    function NumberField(props) {
      return h('div', { className: 'avs-number-field', title: props.title },
        h('span', null, props.tag),
        h('input', {
          type: 'number', value: props.value, min: props.min, max: props.max, step: props.step,
          onChange: (e) => props.onChange(e.target.value),
        }));
    }

    function WideField(props) {
      return h('label', { className: 'avs-wide-field' },
        h('span', null, props.label),
        props.multiline
          ? h('textarea', { rows: props.rows || 3, value: props.value, placeholder: props.placeholder, onChange: (e) => props.onChange(e.target.value) })
          : h('input', { value: props.value, placeholder: props.placeholder, onChange: (e) => props.onChange(e.target.value) }));
    }

    function Segmented(props) {
      return h('div', { className: 'avs-segmented' }, props.options.map((o) => h('button', {
        key: o.value, className: props.value === o.value ? 'is-active' : '', onClick: () => props.onChange(o.value),
      }, o.label)));
    }

    function Empty(props) {
      return h('div', { className: 'avs-empty-panel' + (props.slim ? ' is-slim' : '') }, props.text);
    }

    function Panel(props) {
      return h('section', { className: 'avs-panel' },
        h('div', { className: 'avs-panel-header' },
          h('div', null,
            h('h2', { className: 'avs-panel-h2' }, props.title),
            props.subtitle ? h('small', { className: 'avs-panel-sub' }, props.subtitle) : null),
          props.actions ? h('div', { className: 'avs-row', style: { marginBottom: 0 } }, props.actions) : null),
        h('div', { className: 'avs-panel-body' }, props.children));
    }

    /* ------------------------------- 顶栏 ------------------------------- */
    function TopBar(props) {
      const S = props.S;
      const t = S.t;
      const checks = S.checks;
      const okCount = checks.filter((c) => c && c.ok).length;
      const healthy = Boolean(S.previzInfo && S.previzInfo.health && S.previzInfo.health.ok);
      const nav = [
        { key: 'shots', label: t('nav_shots') }, { key: 'jobs', label: t('nav_jobs') },
        { key: 'assets', label: t('nav_assets') }, { key: 'previz', label: t('nav_previz') },
        { key: 'backends', label: t('nav_backends') }, { key: 'settings', label: t('nav_settings') },
      ];
      return h('header', { className: 'avs-topbar' },
        h('div', { className: 'avs-brand' },
          h('span', { className: 'avs-brand-mark' }, h(Ico, { name: 'film', size: 15 })),
          h('span', { className: 'avs-brand-text' },
            h('strong', null, t('brand_name')),
            h('span', null, t('brand_sub'))),
          h('span', { className: 'avs-health' + (healthy ? '' : ' is-bad'), title: healthy ? 'previz online' : 'previz offline' },
            h('b', null), healthy ? 'online' : 'offline')),
        h('nav', { className: 'avs-nav' }, nav.map((item) => h('button', {
          key: item.key, className: S.tab === item.key ? 'is-active' : '', onClick: () => S.setTab(item.key),
        }, item.label))),
        h('div', { className: 'avs-topbar-right' },
          // 窄屏布局开关（面板 <600 CSS px 时中间舞台只剩 300 出头）
          S.tab === 'shots' ? h('button', {
            className: 'avs-text-button',
            title: S.showLeft ? '收起左侧分镜栏' : '展开左侧分镜栏',
            onClick: () => S.setLeftCollapsed(!S.leftCollapsed),
          }, h(Ico, { name: 'layers', size: 12 }), h('span', { className: 'avs-btn-label' }, S.showLeft ? '隐左' : '显左')) : null,
          S.tab === 'shots' ? h('button', {
            className: 'avs-text-button',
            title: S.showRight ? '收起右侧属性栏' : '展开右侧属性栏',
            onClick: () => S.setRightCollapsed(!S.rightCollapsed),
          }, h(Ico, { name: 'gear', size: 12 }), h('span', { className: 'avs-btn-label' }, S.showRight ? '隐右' : '显右')) : null,
          S.tab === 'shots' || S.tab === 'previz' ? h('button', {
            className: 'avs-text-button',
            title: S.timelineCollapsed ? '展开时间轴' : '收起时间轴',
            onClick: () => S.setTimelineCollapsed(!S.timelineCollapsed),
          }, h(Ico, { name: 'film', size: 12 }), h('span', { className: 'avs-btn-label' }, S.timelineCollapsed ? '显轴' : '隐轴')) : null,
          h('button', {
            className: 'avs-badge' + (checks.length && okCount === checks.length ? '' : ' is-bad'),
            onClick: () => S.setTab('settings'), title: t('top_checks'),
          }, h(Ico, { name: 'gear', size: 11 }), okCount + '/' + checks.length),
          S.previzUrl ? h('a', {
            className: 'avs-text-button', href: S.previzUrl, target: '_blank', rel: 'noreferrer', title: t('top_director'),
          }, h(Ico, { name: 'external', size: 13 }), t('top_director')) : null,
          h(Btn, { label: t('top_export'), icon: 'link', onClick: S.attachPreviz, disabled: Boolean(S.busy) || !S.shot }),
          h(Btn, { label: S.lang === 'zh' ? 'EN' : '中', onClick: () => S.setLang(S.lang === 'zh' ? 'en' : 'zh'), title: 'language' })));
    }

    /* ------------------------------ 左栏 ------------------------------ */
    function SideBar(props) {
      const S = props.S;
      const t = S.t;
      const elements = S.engine ? S.engine.elements : [];
      return h('aside', { className: 'avs-shots-panel' },
        h('div', { className: 'avs-panel-title' },
          h('span', null, t('panel_shots')),
          h('span', { className: 'avs-panel-count' }, String(S.shots.length))),
        h('div', { className: 'avs-project-row' },
          h('select', {
            className: 'avs-select', value: S.projectId, onChange: (e) => S.setProjectId(e.target.value),
            title: t('sec_project'),
          }, S.projects.length
            ? S.projects.map((p) => h('option', { key: p.id, value: p.id }, p.name || p.id))
            : h('option', { value: '' }, '—')),
          h(IconBtn, { name: 'plus', title: t('panel_new_project'), onClick: () => S.setNewProjectOpen(!S.newProjectOpen) })),
        S.newProjectOpen ? h('div', { className: 'avs-inline-form' },
          h('input', {
            value: S.newProjectName, placeholder: t('fld_name'),
            onChange: (e) => S.setNewProjectName(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') S.createProject(); },
          }),
          h(Btn, { label: t('btn_create'), onClick: S.createProject, disabled: Boolean(S.busy) })) : null,
        h('div', { className: 'avs-shot-list' },
          S.shots.length
            ? S.shots.map((s, i) => h('button', {
              key: s.id || 'shot-' + i,
              className: 'avs-shot-row' + (S.shot && S.shot.id === s.id ? ' is-active' : ''),
              onClick: () => S.selectShot(s), title: s.title || s.id || '',
            },
              h('span', { className: 'avs-shot-index' }, pad2(i + 1)),
              h('span', { className: 'avs-shot-main' },
                h('strong', null, s.title || s.id || '—'),
                h('small', null, fmtSec(shotDur(s)) + ' · ' + shotMode(s)),
                h('small', { className: 'is-dim' }, (s.backend || 'mock') + ' · ' + (s.previz ? t('lbl_bound') : t('lbl_unbound'))))))
            : h(Empty, { text: S.projectId ? t('empty_no_shot') : t('empty_no_project'), slim: true })),
        h('div', { className: 'avs-new-shot-row' },
          h(Btn, { label: t('panel_new_shot'), icon: 'plus', wide: true, onClick: S.createShot, disabled: Boolean(S.busy) || !S.projectId })),
        h('div', { className: 'avs-element-list' },
          h('div', { className: 'avs-panel-title is-sub' },
            h('span', null, t('panel_elements')),
            h('span', { className: 'avs-panel-count' }, String(elements.length))),
          elements.length
            ? elements.map((el, i) => h('button', {
              key: el.id || 'el-' + i, className: 'avs-element-row', onClick: () => S.loadEngineState(),
              title: (el.kind || '') + ' · ' + (el.id || ''),
            },
              h('span', { className: 'avs-identity-dot', style: { background: el.color || undefined } }),
              h('span', null, el.name || el.id || '—'),
              h('small', null, el.kind || '')))
            : h(Empty, { text: t('empty_no_element'), slim: true })),
        h('div', { className: 'avs-library-buttons' },
          h('button', { onClick: () => S.setModal('actors') }, t('panel_actors')),
          h('button', { onClick: () => S.setModal('props') }, t('panel_props'))));
    }

    /* ------------------------------ 舞台 ------------------------------ */
    function Stage(props) {
      const S = props.S;
      const t = S.t;
      const healthy = Boolean(S.previzInfo && S.previzInfo.health && S.previzInfo.health.ok);
      const showRender = S.stageTab === 'render';
      const firstUrl = S.renderDir ? fileUrl(joinRel(S.renderDir, 'first.png')) : '';
      let body;
      if (showRender) {
        body = firstUrl
          ? h('div', { className: 'avs-stage-box' }, h('img', { className: 'avs-stage-img', src: firstUrl, alt: 'first frame' }))
          : h('div', { className: 'avs-stage-box' }, h('div', { className: 'avs-stage-empty' },
            h(Ico, { name: 'image', size: 22 }), h('span', null, t('empty_no_render'))));
      } else if (healthy && S.previzUrl && S.showIframe) {
        body = h('div', { className: 'avs-stage-box' },
          h('iframe', {
            key: 'stage-' + S.reloadNonce, className: 'avs-stage-frame', src: S.previzUrl,
            title: 'Previs director', allow: 'fullscreen',
          }));
      } else {
        body = h('div', { className: 'avs-stage-box' }, h('div', { className: 'avs-stage-empty' },
          h(Ico, { name: 'cube', size: 24 }),
          h('span', null, t('empty_not_running')),
          h('div', { className: 'avs-row', style: { justifyContent: 'center' } },
            h(Btn, { label: t('btn_start'), icon: 'play', onClick: S.startPreviz, disabled: Boolean(S.busy) }),
            h(Btn, { label: t('btn_reload'), icon: 'refresh', onClick: S.bumpReload }))));
      }
      return h('section', { className: 'avs-stage-area' },
        h('div', { className: 'avs-stage-toolbar' },
          h(IconBtn, { name: 'play', title: t('btn_start'), onClick: S.startPreviz, disabled: Boolean(S.busy) }),
          h(IconBtn, { name: 'stop', title: t('btn_stop'), onClick: S.stopPreviz, disabled: Boolean(S.busy) }),
          h(IconBtn, { name: 'refresh', title: t('btn_reload'), onClick: S.bumpReload }),
          h(IconBtn, { name: 'camera', title: t('btn_render'), onClick: S.renderPixels, disabled: Boolean(S.busy) || !S.shot }),
          h(IconBtn, { name: 'link', title: t('btn_attach'), onClick: S.attachPreviz, disabled: Boolean(S.busy) || !S.shot })),
        h('div', { className: 'avs-stage-modes', style: { position: 'absolute', top: 12, right: 12, zIndex: 4, width: 168 } },
          h(Segmented, {
            value: S.stageTab, options: [{ value: 'live', label: t('lbl_live') }, { value: 'render', label: t('lbl_frames') }],
            onChange: S.setStageTab,
          })),
        h('div', { className: 'avs-stage-body' }, body),
        S.shot ? h('div', { className: 'avs-stage-chip' },
          h(Ico, { name: 'film', size: 11 }),
          h('span', null, (S.shot.title || S.shot.id) + ' · ' + fmtSec(shotDur(S.shot)) + ' · ' + (S.shot.ratio || '16:9')),
          S.engineShot ? h('span', { className: 'avs-is-ok' }, 'engine ✓') : null) : null);
    }

    /* ------------------------------ 右栏 ------------------------------ */
    function Inspector(props) {
      const S = props.S;
      const t = S.t;
      const shot = S.shot;
      const tabs = [
        { key: 'props', label: t('insp_props') },
        { key: 'render', label: t('insp_render') },
        { key: 'data', label: t('insp_data') },
      ];
      let content;
      if (!shot) content = h(Empty, { text: t('empty_no_sel') });
      else if (S.inspTab === 'props') content = h(InspectorProps, { S });
      else if (S.inspTab === 'render') content = h(InspectorRender, { S });
      else content = h(InspectorData, { S });
      return h('aside', { className: 'avs-inspector' },
        h('div', { className: 'avs-inspector-tabs' }, tabs.map((it) => h('button', {
          key: it.key, className: S.inspTab === it.key ? 'is-active' : '', onClick: () => S.setInspTab(it.key),
        }, it.label))),
        h('div', { className: 'avs-inspector-content' }, content));
    }

    function InspectorProps(props) {
      const S = props.S;
      const t = S.t;
      const shot = S.shot;
      const refs = shot.refs || { images: [], videos: [], audios: [] };
      const keyframes = shot.keyframes || { first: '', last: '' };
      return h('div', null,
        h('div', { className: 'avs-selection-heading' },
          h('span', { className: 'avs-shot-index' }, 'S'),
          h('div', { style: { minWidth: 0 } },
            h('strong', null, shot.title || shot.id),
            h('small', null, shot.id || ''))),
        h('h3', null, t('sec_basic')),
        h(WideField, { label: t('fld_title'), value: shot.title || '', onChange: (v) => S.upd({ title: v }) }),
        h('div', { className: 'avs-field-grid is-two', style: { marginBottom: 8 } },
          h('select', {
            className: 'avs-select-field', value: shotMode(shot), onChange: (e) => S.upd({ mode: e.target.value }), title: t('fld_mode'),
          }, MODES.map((m) => h('option', { key: m, value: m }, m))),
          h('select', {
            className: 'avs-select-field', value: shot.ratio || '16:9', onChange: (e) => S.upd({ ratio: e.target.value }), title: t('fld_ratio'),
          }, RATIOS.map((r) => h('option', { key: r, value: r }, r)))),
        h('div', { className: 'avs-field-grid', style: { marginBottom: 8 } },
          h(NumberField, {
            tag: 's', title: t('fld_duration'), value: num(shot.durationSec, 5), min: 4, max: 15, step: 0.5,
            onChange: (v) => S.upd({ durationSec: num(v, 5) }),
          }),
          h('select', {
            className: 'avs-select-field', value: shot.backend || 'mock', onChange: (e) => S.upd({ backend: e.target.value }), title: t('fld_backend'),
          }, BACKENDS.map((b) => h('option', { key: b, value: b }, b))),
          h('select', {
            className: 'avs-select-field', value: shot.profile || '', onChange: (e) => S.upd({ profile: e.target.value }), title: t('fld_profile'),
          }, (S.profileNames.length ? S.profileNames : PROFILE_FALLBACK).map((p) => h('option', { key: p, value: p }, p)))),
        h('h3', null, t('sec_look')),
        h(WideField, { label: t('fld_style'), value: shot.style || '', onChange: (v) => S.upd({ style: v }) }),
        h(WideField, { label: t('fld_desc'), value: shot.description || '', multiline: true, rows: 3, onChange: (v) => S.upd({ description: v }) }),
        h(WideField, { label: t('fld_camera'), value: shot.camera || '', onChange: (v) => S.upd({ camera: v }) }),
        h('h3', null, t('sec_audio')),
        h(WideField, { label: t('fld_dialogue'), value: shot.dialogue || '', onChange: (v) => S.upd({ dialogue: v }) }),
        h(WideField, { label: t('fld_sound'), value: shot.soundscape || '', onChange: (v) => S.upd({ soundscape: v }) }),
        h(WideField, { label: t('fld_music'), value: shot.music || '', onChange: (v) => S.upd({ music: v }) }),
        h('h3', null, t('sec_refs')),
        h(WideField, {
          label: t('fld_images'), value: safeArr(refs.images).join('\n'), multiline: true, rows: 2,
          placeholder: 'packId:entryId', onChange: (v) => S.setRefs('images', v),
        }),
        h(WideField, {
          label: t('fld_videos'), value: safeArr(refs.videos).join('\n'), multiline: true, rows: 2,
          placeholder: 'packId:entryId', onChange: (v) => S.setRefs('videos', v),
        }),
        h(WideField, {
          label: t('fld_audios'), value: safeArr(refs.audios).join('\n'), multiline: true, rows: 2,
          placeholder: 'packId:entryId', onChange: (v) => S.setRefs('audios', v),
        }),
        h('h3', null, t('sec_keyframes')),
        h(WideField, { label: t('fld_first'), value: keyframes.first || '', onChange: (v) => S.upd({ keyframes: Object.assign({}, keyframes, { first: v }) }) }),
        h(WideField, { label: t('fld_last'), value: keyframes.last || '', onChange: (v) => S.upd({ keyframes: Object.assign({}, keyframes, { last: v }) }) }),
        h('h3', null, t('sec_prompt')),
        h(WideField, {
          label: t('fld_override'), value: shot.promptOverride || '', multiline: true, rows: 3,
          placeholder: '留空自动编译', onChange: (v) => S.upd({ promptOverride: v }),
        }),
        h(WideAction, { label: t('btn_compile'), icon: 'spark', onClick: S.compileShot, disabled: Boolean(S.busy) }),
        S.prompt ? h('pre', { className: 'avs-code' }, S.prompt) : null,
        h('div', { style: { marginTop: 12 } },
          h(WideAction, { label: t('btn_save'), icon: 'save', onClick: S.saveShot, disabled: Boolean(S.busy) }),
          h(WideAction, { label: t('btn_generate'), icon: 'play', primary: true, onClick: S.generateShot, disabled: Boolean(S.busy) })));
    }

    function InspectorRender(props) {
      const S = props.S;
      const t = S.t;
      const shot = S.shot;
      const r = (shot && shot.previz) || {};
      const render = r.render || null;
      const dir = render && typeof render.dir === 'string' ? render.dir : '';
      const firstUrl = dir ? fileUrl(joinRel(dir, render.firstFrame || 'first.png')) : '';
      const lastUrl = dir ? fileUrl(joinRel(dir, render.lastFrame || 'last.png')) : '';
      const videoUrl = dir && render.controlVideo ? fileUrl(joinRel(dir, render.controlVideo)) : '';
      const healthy = Boolean(S.previzInfo && S.previzInfo.health && S.previzInfo.health.ok);
      return h('div', null,
        h('div', { className: 'avs-selection-heading' },
          h('span', { className: 'avs-shot-index' }, 'PV'),
          h('div', { style: { minWidth: 0 } },
            h('strong', null, t('sec_service')),
            h('small', null, 'port ' + num(S.previzInfo && S.previzInfo.port, 4318)))),
        h('div', { className: 'avs-row' },
          h('span', { className: 'avs-badge' + (healthy ? '' : ' is-bad') }, healthy ? t('lbl_ok') : t('lbl_bad')),
          h('span', { className: 'avs-help', style: { margin: 0 } },
            'mode ' + ((S.previzInfo && S.previzInfo.health && S.previzInfo.health.mode) || '—'))),
        h(WideAction, { label: t('btn_start'), icon: 'play', onClick: S.startPreviz, disabled: Boolean(S.busy) }),
        h(WideAction, { label: t('btn_stop'), icon: 'stop', onClick: S.stopPreviz, disabled: Boolean(S.busy) }),
        h(WideAction, { label: t('btn_load_state'), icon: 'refresh', onClick: S.loadEngineState, disabled: Boolean(S.busy) }),
        h(WideAction, { label: t('btn_attach'), icon: 'link', onClick: S.attachPreviz, disabled: Boolean(S.busy) }),
        h('h3', null, t('sec_render')),
        h('div', { className: 'avs-field-grid', style: { marginBottom: 8 } },
          h(NumberField, {
            tag: '#', title: t('fld_samples'), value: S.renderSettings.samples, min: 2, max: 60, step: 1,
            onChange: (v) => S.setRenderSettings(Object.assign({}, S.renderSettings, { samples: num(v, 12) })),
          }),
          h(NumberField, {
            tag: 'px', title: t('fld_long'), value: S.renderSettings.longSide, min: 320, max: 4096, step: 80,
            onChange: (v) => S.setRenderSettings(Object.assign({}, S.renderSettings, { longSide: num(v, 1600) })),
          }),
          h(NumberField, {
            tag: 'fps', title: t('fld_fps'), value: S.renderSettings.fps, min: 1, max: 60, step: 1,
            onChange: (v) => S.setRenderSettings(Object.assign({}, S.renderSettings, { fps: num(v, 24) })),
          })),
        h(WideAction, {
          label: t('btn_render'), icon: 'camera', primary: true, onClick: S.renderPixels,
          disabled: Boolean(S.busy) || !shot,
        }),
        render
          ? h('div', null,
            h('div', { className: 'avs-thumb-grid' },
              firstUrl ? h('a', { className: 'avs-thumb', href: firstUrl, target: '_blank', rel: 'noreferrer' },
                h('img', { src: firstUrl, alt: 'first' }), h('small', null, 'first.png')) : null,
              lastUrl ? h('a', { className: 'avs-thumb', href: lastUrl, target: '_blank', rel: 'noreferrer' },
                h('img', { src: lastUrl, alt: 'last' }), h('small', null, 'last.png')) : null),
            videoUrl ? h('video', {
              src: videoUrl, controls: true, style: { width: '100%', borderRadius: 6, background: '#000', display: 'block' },
            }) : null,
            h('div', { className: 'avs-kv' }, h('b', null, String(num(render.frames, 0))), t('lbl_frames_n'), '·',
              String(render.aspect || '—'), '·', String(num(render.longSide, 0)) + 'px'),
            h('div', { className: 'avs-kv' }, t('lbl_shot') + '：' + (r.shotId || '—')),
            h('div', { className: 'avs-kv' }, 'dir：' + (toPosix(dir) || '—')),
            render.elapsedMs ? h('div', { className: 'avs-kv' }, 'elapsed：' + Math.round(num(render.elapsedMs, 0)) + 'ms') : null)
          : h(Empty, { text: t('empty_no_render'), slim: true }),
        h('h3', null, t('sec_frame')),
        h(WideAction, { label: t('btn_eval'), icon: 'spark', onClick: S.evalFrame, disabled: Boolean(S.busy) }),
        h('div', { className: 'avs-kv' }, 'playhead：' + timecode(S.playhead)),
        S.previzFrame ? h('pre', { className: 'avs-code' }, JSON.stringify(S.previzFrame, null, 2).slice(0, 4000)) : null);
    }

    function InspectorData(props) {
      const S = props.S;
      const t = S.t;
      const shot = S.shot || {};
      const engine = S.engine;
      const issues = [];
      const collect = (list, severityDefault) => {
        safeArr(list).forEach((x) => {
          if (x === null || x === undefined) return;
          if (typeof x === 'string') { issues.push({ severity: severityDefault, text: x }); return; }
          const text = x.message || x.detail || x.id || '';
          if (text) issues.push({ severity: x.severity || severityDefault, text: String(text) });
        });
      };
      if (engine && engine.health) {
        collect(engine.health.project_issues, 'error');
        collect(engine.health.plan_issues, 'warning');
      }
      const previz = shot.previz || null;
      const engineShots = safeArr(engine && engine.shots);
      const engineElements = safeArr(engine && engine.elements);
      const engineRules = safeArr(engine && engine.rules);
      return h('div', null,
        h('h3', null, t('sec_engine')),
        engine && engine.project
          ? h('div', null,
            h('div', { className: 'avs-kv' }, h('b', null, engine.project.name || '—')),
            h('div', { className: 'avs-kv' }, t('lbl_shots_c') + '：' + engineShots.length),
            h('div', { className: 'avs-kv' }, t('lbl_elements') + '：' + engineElements.length),
            h('div', { className: 'avs-kv' }, t('lbl_duration') + '：' + fmtSec(num(engine.runtime && engine.runtime.duration_sec, 0))),
            h('div', { className: 'avs-kv' }, 'fps：' + num(engine.runtime && engine.runtime.fps, 24)),
            h('div', { className: 'avs-kv' }, 'aspect：' + (engine.project.aspect || '—')))
          : h(Empty, { text: t('empty_not_running'), slim: true }),
        h('h3', null, t('sec_health')),
        issues.length
          ? issues.slice(0, 12).map((x, i) => h('div', {
            key: 'issue-' + i,
            className: 'avs-kv ' + (x.severity === 'error' ? 'avs-is-bad' : 'avs-is-warn'),
          }, '· ' + x.text))
          : h('div', { className: 'avs-kv avs-is-ok' }, t('lbl_ok')),
        h('h3', null, 'SHOT PREVIZ'),
        previz
          ? h('div', null,
            h('div', { className: 'avs-kv' }, 'engine：' + (previz.engine || '—')),
            h('div', { className: 'avs-kv' }, t('lbl_shot') + '：' + (previz.shotId || '—')),
            h('div', { className: 'avs-kv' }, 'frames：' + num(previz.frames, 0) + ' · ' +
              fmtSec(num(previz.firstFrameTimeSec, 0)) + ' → ' + fmtSec(num(previz.lastFrameTimeSec, 0))),
            h('div', { className: 'avs-kv' }, 'package：' + (previz.packagePath || '—')))
          : h(Empty, { text: t('empty_no_sel'), slim: true }),
        h('h3', null, t('sec_rules')),
        engineRules.length
          ? engineRules.map((x, i) => h('div', { key: 'rule-' + i, className: 'avs-kv' }, '· ' + x))
          : h('div', { className: 'avs-kv avs-is-idle' }, '—'),
        S.previzState ? h('pre', { className: 'avs-code', style: { marginTop: 10 } }, JSON.stringify(S.previzState, null, 2).slice(0, 5000)) : null);
    }

    /* ------------------------------ 时间轴 ------------------------------ */
    function Timeline(props) {
      const S = props.S;
      const t = S.t;
      const pps = S.pxPerSec;
      const trackWidth = Math.max(320, Math.ceil(S.trackSec * pps) + 40);
      const ticks = [];
      const stepSec = pps >= 60 ? 1 : 2;
      for (let s = 0; s <= S.trackSec + 1; s += stepSec) ticks.push(s);
      const rows = [
        { key: 'shots', label: t('tl_shots'), icon: 'film' },
        { key: 'keys', label: t('tl_kf'), icon: 'spark' },
        { key: 'actions', label: t('tl_actions'), icon: 'list' },
      ];
      return h('section', { className: 'avs-timeline' + (S.timelineCollapsed ? ' is-collapsed' : '') },
        h('div', { className: 'avs-timeline-header' },
          h('button', {
            className: 'avs-play-button', title: S.playing ? 'pause' : 'play',
            onClick: () => S.setPlaying(!S.playing),
          }, h(Ico, { name: S.playing ? 'stop' : 'play', size: 15 })),
          h('strong', null, timecode(S.playhead)),
          h('span', { className: 'avs-tl-meta' }, fmtSec(S.totalSec) + ' · ' + S.shots.length + ' shot(s) · ' + S.pxPerSec + 'px/s'),
          h('span', { className: 'avs-spacer' }),
          S.busy ? h('span', { className: 'avs-tl-meta avs-is-warn' }, S.busy + ' …') : null,
          // 时间轴折叠：窄屏下可多出 150—264px 的舞台高度
          h('button', {
            className: 'avs-timeline-toggle',
            title: S.timelineCollapsed ? '展开时间轴' : '收起时间轴',
            onClick: () => S.setTimelineCollapsed(!S.timelineCollapsed),
          }, h('span', {
            style: S.timelineCollapsed ? { display: 'inline-block', transform: 'rotate(-90deg)' } : { display: 'inline-block', transform: 'rotate(90deg)' },
          }, h(Ico, { name: 'chevron', size: 10 })),
            S.timelineCollapsed ? '展开' : '收起'),
          h(Btn, { label: '−', onClick: () => S.setPxPerSec(Math.max(24, S.pxPerSec - 12)), title: 'zoom out' }),
          h(Btn, { label: '+', onClick: () => S.setPxPerSec(Math.min(180, S.pxPerSec + 12)), title: 'zoom in' })),
        h('div', { className: 'avs-timeline-body' },
          h('div', { className: 'avs-timeline-labels' },
            h('div', { className: 'avs-timeline-label is-ruler' }, 'TIME'),
            rows.map((r) => h('div', { key: r.key, className: 'avs-timeline-label' }, h(Ico, { name: r.icon, size: 11 }), r.label))),
          h('div', { className: 'avs-timeline-scroll' },
            h('div', { className: 'avs-timeline-tracks', style: { width: trackWidth + 'px' } },
              h('div', {
                className: 'avs-ruler',
                onClick: (e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  if (box.width > 0) S.setPlayhead(Math.max(0, (e.clientX - box.left) / pps));
                },
              }, ticks.map((s) => h('span', { key: 'tick-' + s, style: { left: (s * pps) + 'px' } }, s + 's'))),
              h('div', { className: 'avs-timeline-row' },
                S.spans.map((sp) => h('button', {
                  key: 'clip-' + sp.id,
                  className: 'avs-clip' + (S.shot && S.shot.id === sp.id ? ' is-active' : ''),
                  style: { left: (sp.start * pps) + 'px', width: Math.max(26, sp.dur * pps - 2) + 'px' },
                  title: (sp.shot.title || sp.id) + ' · ' + fmtSec(sp.dur),
                  onClick: () => S.selectShot(sp.shot),
                }, pad2(sp.index + 1) + ' ' + (sp.shot.title || sp.id))),
                S.spans.length ? null : h(Empty, { text: t('empty_no_shot'), slim: true })),
              h('div', { className: 'avs-timeline-row' },
                S.markers.map((mk, i) => h('span', {
                  key: 'kf-' + i,
                  className: 'avs-keyframe-dot' + (mk.active ? ' is-active' : ''),
                  style: { left: (mk.time * pps) + 'px' },
                  title: mk.label,
                }))),
              h('div', { className: 'avs-timeline-row' },
                S.actionBlocks.map((ab, i) => h('div', {
                  key: 'act-' + i, className: 'avs-action-block',
                  style: { left: (ab.start * pps) + 'px', width: Math.max(30, ab.dur * pps - 2) + 'px' },
                  title: ab.label,
                }, h(Ico, { name: 'spark', size: 9 }), ab.label))),
              h('div', { className: 'avs-playhead', style: { left: (S.playhead * pps) + 'px' } }, h('span', null))))));
    }

    /* ---------------------------- 扁平页签面板 ---------------------------- */
    function JobsPanel(props) {
      const S = props.S;
      const t = S.t;
      const jobs = S.jobs;
      const active = jobs.find((j) => j.status === 'running' || j.status === 'queued') || null;
      const previewJob = (active && safeArr(active.outputs).length ? active : jobs.find((j) => safeArr(j.outputs).length)) || null;
      const previewPath = previewJob && safeArr(previewJob.outputs)[0] ? safeArr(previewJob.outputs)[0].path : '';
      const statusClass = (s) => (s === 'completed' ? 'avs-is-ok' : s === 'failed' ? 'avs-is-bad' : 'avs-is-warn');
      return h('div', null,
        h(Panel, {
          title: t('sec_jobs'),
          subtitle: jobs.length + ' total · ' + jobs.filter((j) => j.status === 'running' || j.status === 'queued').length + ' active',
          actions: h(Btn, { label: t('btn_refresh'), icon: 'refresh', onClick: S.reloadJobs, disabled: Boolean(S.busy) }),
        },
          jobs.length
            ? jobs.map((j) => h('div', { key: j.id, className: 'avs-list-row' },
              h('div', { className: 'avs-list-main' },
                h('b', null, (j.shotTitle || j.shotId || j.id) + ' · ' + (j.backendId || '—')),
                h('small', null, j.id + ' · ' + new Date(num(j.createdAt, Date.now())).toLocaleString())),
              h('span', { className: statusClass(j.status) }, j.status),
              h(Btn, {
                label: t('btn_qc'), onClick: () => S.qcJob(j),
                disabled: Boolean(S.busy) || !safeArr(j.outputs).length,
              }),
              j.status === 'failed'
                ? h(Btn, { label: t('btn_retry'), onClick: () => S.retryJob(j), disabled: Boolean(S.busy) })
                : h(Btn, { label: t('btn_cancel'), onClick: () => S.cancelJob(j), disabled: Boolean(S.busy) || j.status !== 'running' && j.status !== 'queued' }),
              safeArr(j.outputs).length
                ? h('a', {
                  className: 'avs-text-button', href: fileUrl(safeArr(j.outputs)[0].path),
                  target: '_blank', rel: 'noreferrer',
                }, h(Ico, { name: 'external', size: 12 }), 'open')
                : null,
              j.error ? h('small', { className: 'avs-is-bad' }, j.error) : null))
            : h(Empty, { text: t('empty_no_jobs') })),
        previewPath ? h(Panel, { title: 'PREVIEW', subtitle: previewJob ? previewJob.id : '' },
          h('video', {
            src: fileUrl(previewPath), controls: true,
            style: { width: '100%', maxHeight: 420, borderRadius: 6, background: '#000', display: 'block' },
          })) : null);
    }

    /* ---------------------- 资产库（上传） ---------------------- */
    function AssetsLibrary(props) {
      const S = props.S;
      const items = S.assetItems || [];
      const kinds = S.assetKinds || ['image', 'video', 'audio', 'model3d', 'font', 'doc', 'other'];
      const filter = S.assetFilter || 'all';
      const shown = filter === 'all' ? items : items.filter((x) => x.kind === filter);
      return h('div', null,
        h(Panel, {
          title: '资产库（上传）',
          subtitle: items.length + ' 个',
          actions: h('div', { className: 'avs-row', style: { marginBottom: 0 } },
            h('label', { className: 'avs-text-button', style: { cursor: 'pointer' } },
              h(Ico, { name: 'plus', size: 12 }),
              h('span', { className: 'avs-btn-label' }, '上传'),
              h('input', {
                type: 'file', multiple: true, style: { display: 'none' },
                onChange: (e) => { S.uploadAssets(e.target.files); e.target.value = ''; },
              })),
            h(Btn, { label: '刷新', icon: 'refresh', onClick: S.reloadAssets, disabled: Boolean(S.busy) })),
        },
          h('div', { className: 'avs-row' },
            h('button', {
              className: 'avs-nav-chip' + (filter === 'all' ? ' is-active' : ''),
              onClick: () => S.setAssetFilter('all'),
            }, '全部 ' + items.length),
            kinds.map((k) => {
              const n = items.filter((x) => x.kind === k).length;
              return h('button', {
                key: k, className: 'avs-nav-chip' + (filter === k ? ' is-active' : ''),
                onClick: () => S.setAssetFilter(k),
              }, k + ' ' + n);
            })),
          h('div', { className: 'avs-help' }, '支持：图片 / 视频 / 音频 / 3D 模型（glb/gltf/fbx/obj）/ 字体 / 文档。拖入或点「上传」。'),
          shown.length
            ? h('div', { className: 'avs-asset-grid' }, shown.map((a) => h('div', { key: a.id, className: 'avs-asset-card' },
              h('div', { className: 'avs-asset-thumb' },
                (a.kind === 'image')
                  ? h('img', { src: '/ai-video-studio/api/assets/item?id=' + encodeURIComponent(a.id), alt: a.name })
                  : h('span', { className: 'avs-asset-kind' }, a.kind)),
              h('div', { className: 'avs-asset-meta' },
                h('b', { title: a.name }, a.name),
                h('small', null, a.kind + ' · ' + fmtBytes(a.bytes) + (a.tag ? ' · ' + a.tag : ''))),
              h('div', { className: 'avs-row', style: { marginTop: 6, marginBottom: 0 } },
                h('a', {
                  className: 'avs-text-button', style: { height: 24, fontSize: 10 },
                  href: '/ai-video-studio/api/assets/item?id=' + encodeURIComponent(a.id), target: '_blank', rel: 'noreferrer',
                }, '打开'),
                h('button', {
                  className: 'avs-text-button', style: { height: 24, fontSize: 10 },
                  onClick: () => S.setShot && S.attachAssetToShot(a).catch(() => {}),
                }, '用作参考'),
                h('button', {
                  className: 'avs-text-button is-danger', style: { height: 24, fontSize: 10 },
                  onClick: () => S.deleteAsset(a.id),
                }, '删除')))))
            : h(Empty, { text: '还没有上传资产。点右上角「上传」选文件。' })));
    }

    function fmtBytes(n) {
      const v = Number(n) || 0;
      if (v < 1024) return v + ' B';
      if (v < 1048576) return (v / 1024).toFixed(1) + ' KB';
      if (v < 1073741824) return (v / 1048576).toFixed(1) + ' MB';
      return (v / 1073741824).toFixed(2) + ' GB';
    }

    /* ---------------------- 角色卡 ---------------------- */
    function CharactersPanel(props) {
      const S = props.S;
      const chars = S.characters || [];
      const sel = S.charSel || null;
      return h('div', null,
        h(Panel, {
          title: '角色卡',
          subtitle: chars.length + ' 个',
          actions: h('div', { className: 'avs-row', style: { marginBottom: 0 } },
            h(Btn, { label: '新建角色', icon: 'plus', onClick: S.newCharacter, disabled: Boolean(S.busy) }),
            h(Btn, { label: '刷新', icon: 'refresh', onClick: S.reloadCharacters, disabled: Boolean(S.busy) })),
        },
          h('div', { className: 'avs-help' },
            '角色卡把一个角色的【外观描述 + 参考图 + 参考音频 + 画风】打包，生成时一键套用，避免每次重写提示词。'),
          h('div', { className: 'avs-char-grid' },
            chars.map((c) => h('button', {
              key: c.id,
              className: 'avs-char-card' + (sel && sel.id === c.id ? ' is-active' : ''),
              onClick: () => S.setCharSel(c),
            },
              h('div', { className: 'avs-char-avatar' },
                (c.refs || []).find((r) => r.kind === 'image')
                  ? h('img', {
                    src: '/ai-video-studio/api/characters/asset?id=' + encodeURIComponent(c.id) + '&rel=' + encodeURIComponent((c.refs.find((r) => r.kind === 'image')).rel),
                    alt: c.name,
                  })
                  : h(Ico, { name: 'cube', size: 20 })),
              h('b', null, c.name || '未命名'),
              h('small', null, ((c.refs || []).length) + ' 个素材')))),
          sel ? h('div', { className: 'avs-char-editor' },
            h('h3', null, '编辑：' + (sel.name || '')),
            h(WideField, { label: '名称', value: sel.name || '', onChange: (v) => S.setCharSel(Object.assign({}, sel, { name: v })) }),
            h(WideField, {
              label: '外观描述（会拼进提示词，必须具体：发色/发型/服装/瞳色）',
              value: sel.appearance || '', multiline: true, rows: 3,
              onChange: (v) => S.setCharSel(Object.assign({}, sel, { appearance: v })),
            }),
            h(WideField, {
              label: '画风（如 anime cel-shaded, consistent flat colors）',
              value: sel.style || '', onChange: (v) => S.setCharSel(Object.assign({}, sel, { style: v })),
            }),
            h(WideField, {
              label: '附加提示词（光线/景深等）',
              value: sel.seedPrompt || '', onChange: (v) => S.setCharSel(Object.assign({}, sel, { seedPrompt: v })),
            }),
            h('div', { className: 'avs-row' },
              h('label', { className: 'avs-text-button', style: { cursor: 'pointer' } },
                h(Ico, { name: 'plus', size: 12 }), '添加参考素材',
                h('input', {
                  type: 'file', multiple: true, style: { display: 'none' },
                  onChange: (e) => { S.uploadCharRef(sel.id, e.target.files); e.target.value = ''; },
                })),
              h(Btn, { label: '保存角色卡', icon: 'save', onClick: S.saveCharacterCard, disabled: Boolean(S.busy) }),
              h(Btn, { label: '应用到当前镜头', icon: 'link', onClick: S.applyCharacterToShot, disabled: Boolean(S.busy) || !S.shot }),
              h(Btn, { label: '删除', icon: 'trash', onClick: () => S.deleteCharacterCard(sel.id), disabled: Boolean(S.busy) })),
            (sel.refs || []).length
              ? h('div', { className: 'avs-ref-strip' },
                sel.refs.map((r) => h('div', { key: r.id, className: 'avs-ref-item' },
                  r.kind === 'image'
                    ? h('img', {
                      src: '/ai-video-studio/api/characters/asset?id=' + encodeURIComponent(sel.id) + '&rel=' + encodeURIComponent(r.rel),
                      alt: r.name,
                    })
                    : h('span', { className: 'avs-asset-kind' }, r.kind),
                  h('small', null, r.name || r.kind))))
              : h('div', { className: 'avs-help' }, '还没有参考素材。建议至少加 1 张正面立绘。'))
          : h(Empty, { text: '选一个角色卡编辑，或点「新建角色」。' })));
    }

    /* ---------------------- 资产包（外挂） ---------------------- */
    function AssetsPanel(props) {
      const S = props.S;
      const t = S.t;
      const packs = S.packs;
      return h('div', null,
        h(Panel, {
          title: t('sec_assets'),
          subtitle: packs.length + ' mounted',
          actions: h(Btn, { label: t('btn_refresh'), icon: 'refresh', onClick: S.reloadPacks, disabled: Boolean(S.busy) }),
        },
          h('div', { className: 'avs-row' },
            h('input', {
              className: 'avs-select', style: { maxWidth: 240 }, value: S.packForm.packId, placeholder: t('fld_pack'),
              onChange: (e) => S.setPackForm(Object.assign({}, S.packForm, { packId: e.target.value })),
            }),
            h('input', {
              className: 'avs-select', style: { maxWidth: 420 }, value: S.packForm.root, placeholder: t('fld_root'),
              onChange: (e) => S.setPackForm(Object.assign({}, S.packForm, { root: e.target.value })),
            }),
            h(Btn, { label: t('btn_mount'), icon: 'plus', onClick: S.mountPack, disabled: Boolean(S.busy) })),
          packs.length
            ? packs.map((p) => h('div', { key: p.packId, className: 'avs-list-row' },
              h('div', { className: 'avs-list-main' },
                h('b', null, p.packId + ' · ' + ((p.manifest && p.manifest.kind) || '?')),
                h('small', null, String(p.root || '')),
                h('small', { style: { display: 'block' } },
                  num(p.entries, 0) + ' entries · ' + ((p.manifest && p.manifest.license && p.manifest.license.spdx) || 'unknown license') +
                  (p.stale ? ' · stale' : '')),
                p.error ? h('small', { className: 'avs-is-bad', style: { display: 'block' } }, p.error) : null),
              h(Btn, { label: t('btn_verify'), onClick: () => S.verifyPack(p), disabled: Boolean(S.busy) }),
              h('button', {
                className: 'avs-delete-button', style: { width: 92, marginTop: 0 },
                onClick: () => S.unmountPack(p), disabled: Boolean(S.busy),
              }, h(Ico, { name: 'trash', size: 12 }), t('btn_unmount'))))
            : h(Empty, { text: t('empty_no_packs') })));
    }

    function PrevizPanel(props) {
      const S = props.S;
      const t = S.t;
      const healthy = Boolean(S.previzInfo && S.previzInfo.health && S.previzInfo.health.ok);
      const shot = S.shot;
      const r = (shot && shot.previz) || {};
      const render = r.render || null;
      const dir = render && typeof render.dir === 'string' ? render.dir : '';
      return h('div', null,
        h(Panel, {
          title: t('sec_service'),
          subtitle: 'port ' + num(S.previzInfo && S.previzInfo.port, 4318) + ' · ' + (healthy ? 'online' : 'offline'),
          actions: h('div', { className: 'avs-row', style: { marginBottom: 0 } },
            h(Btn, { label: t('btn_start'), icon: 'play', onClick: S.startPreviz, disabled: Boolean(S.busy) }),
            h(Btn, { label: t('btn_stop'), icon: 'stop', onClick: S.stopPreviz, disabled: Boolean(S.busy) }),
            h(Btn, { label: t('btn_load_state'), icon: 'refresh', onClick: S.loadEngineState, disabled: Boolean(S.busy) }),
            S.previzUrl ? h('a', { className: 'avs-text-button', href: S.previzUrl, target: '_blank', rel: 'noreferrer' },
              h(Ico, { name: 'external', size: 12 }), t('btn_open')) : null),
        },
          h('div', { className: 'avs-kv' }, t('lbl_service') + '：' + (healthy ? t('lbl_ok') : t('lbl_bad')) +
            ' · ' + t('lbl_mode') + '：' + ((S.previzInfo && S.previzInfo.health && S.previzInfo.health.mode) || '—')),
          h('div', { className: 'avs-kv' }, 'home：' + String((S.previzInfo && S.previzInfo.home) || '—')),
          h('div', { className: 'avs-row', style: { marginTop: 10 } },
            h(Btn, { label: t('btn_attach'), icon: 'link', onClick: S.attachPreviz, disabled: Boolean(S.busy) || !shot }),
            h(Btn, { label: t('btn_eval'), icon: 'spark', onClick: S.evalFrame, disabled: Boolean(S.busy) }),
            h(Btn, { label: t('btn_render'), icon: 'camera', onClick: S.renderPixels, disabled: Boolean(S.busy) || !shot })),
          h('div', { className: 'avs-previz-frame', style: { marginTop: 10 } },
            healthy && S.previzUrl
              ? h('iframe', { key: 'pv-' + S.reloadNonce, src: S.previzUrl, title: 'Previs director', allow: 'fullscreen' })
              : h('div', { className: 'avs-stage-empty' },
                h(Ico, { name: 'cube', size: 24 }), h('span', null, t('empty_not_running'))))),
        h(Panel, {
          title: t('sec_result'),
          subtitle: shot ? (shot.title || shot.id) : '—',
          actions: h(Btn, { label: t('btn_refresh'), icon: 'refresh', onClick: S.reloadShots, disabled: Boolean(S.busy) }),
        },
          render
            ? h('div', null,
              h('div', { className: 'avs-thumb-grid', style: { maxWidth: 560 } },
                dir ? h('a', { className: 'avs-thumb', href: fileUrl(joinRel(dir, 'first.png')), target: '_blank', rel: 'noreferrer' },
                  h('img', { src: fileUrl(joinRel(dir, 'first.png')), alt: 'first' }), h('small', null, 'first.png')) : null,
                dir ? h('a', { className: 'avs-thumb', href: fileUrl(joinRel(dir, 'last.png')), target: '_blank', rel: 'noreferrer' },
                  h('img', { src: fileUrl(joinRel(dir, 'last.png')), alt: 'last' }), h('small', null, 'last.png')) : null),
              dir && render.controlVideo
                ? h('video', {
                  src: fileUrl(joinRel(dir, render.controlVideo)), controls: true,
                  style: { width: '100%', maxWidth: 640, borderRadius: 6, background: '#000', display: 'block' },
                }) : null)
            : h(Empty, { text: t('empty_no_render') })));
    }

    function BackendsPanel(props) {
      const S = props.S;
      const t = S.t;
      const backends = S.backends;
      const health = safeArr(backends && backends.health);
      const caps = safeArr(backends && backends.capabilities);
      return h('div', null,
        h(Panel, {
          title: t('sec_backends'),
          subtitle: health.length ? health.length + ' backends' : '—',
          actions: h(Btn, { label: t('btn_refresh'), icon: 'refresh', onClick: S.reloadBackends, disabled: Boolean(S.busy) }),
        },
          health.length
            ? health.map((b) => h('div', { key: b.id, className: 'avs-list-row' },
              h('div', { className: 'avs-list-main' },
                h('b', null, b.id),
                h('small', null, String(b.detail || ''))),
              h('span', { className: b.ok ? 'avs-is-ok' : 'avs-is-bad' }, b.ok ? t('lbl_ok') : t('lbl_bad'))))
            : h(Empty, { text: t('empty_no_backends') })),
        h(Panel, { title: t('sec_caps') },
          caps.length
            ? caps.map((b) => h('div', { key: b.id, className: 'avs-list-row' },
              h('div', { className: 'avs-list-main' },
                h('b', null, b.id),
                h('small', null,
                  '≤' + num(b.maxDurationSec, 0) + 's · audio=' + String(Boolean(b.nativeAudio)) +
                  ' · refs=' + num(b.refImages, 0) + '/' + num(b.refVideos, 0) + '/' + num(b.refAudios, 0) +
                  ' · first/last=' + String(Boolean(b.firstFrame)) + '/' + String(Boolean(b.lastFrame)))),
              h('span', { className: 'avs-is-idle' }, safeArr(b.resolutions).join(' '))))
            : h(Empty, { text: t('empty_no_backends') })));
    }

    function SettingsPanel(props) {
      const S = props.S;
      const t = S.t;
      const checks = S.checks;
      const profiles = S.profiles;
      return h('div', null,
        h(Panel, {
          title: t('sec_config'),
          subtitle: 'config.json',
          actions: h('div', { className: 'avs-row', style: { marginBottom: 0 } },
            h(Btn, { label: t('btn_save_cfg'), icon: 'save', onClick: S.saveConfig, disabled: Boolean(S.busy) }),
            h(Btn, { label: t('btn_refresh'), icon: 'refresh', onClick: S.reloadConfig, disabled: Boolean(S.busy) })),
        },
          h('div', { className: 'avs-help' }, 'API Key 请用环境变量或凭据服务，不写入此处。'),
          h('textarea', {
            className: 'avs-code', style: { minHeight: 260, width: '100%', resize: 'vertical' },
            value: S.cfgText, onChange: (e) => S.setCfgText(e.target.value), spellCheck: false,
          })),
        h(Panel, {
          title: t('top_checks'),
          subtitle: checks.filter((c) => c && c.ok).length + '/' + checks.length,
          actions: h(Btn, { label: t('btn_check'), icon: 'spark', onClick: S.runSelfcheck, disabled: Boolean(S.busy) }),
        },
          checks.length
            ? checks.map((c, i) => h('div', { key: 'chk-' + i, className: 'avs-list-row' },
              h('div', { className: 'avs-list-main' },
                h('b', null, String(c.name || '—')),
                h('small', null, String(c.detail || ''))),
              h('span', { className: c.ok ? 'avs-is-ok' : 'avs-is-bad' }, c.ok ? t('lbl_ok') : t('lbl_bad'))))
            : h(Empty, { text: '—' })),
        h(Panel, { title: t('sec_profiles') },
          Array.isArray(profiles && profiles.profiles)
            ? Object.keys(profiles.profiles).map((k) => {
              const p = profiles.profiles[k];
              return h('div', { key: k, className: 'avs-list-row' },
                h('div', { className: 'avs-list-main' },
                  h('b', null, k + (k === (profiles.default || '') ? ' · default' : '')),
                  h('small', null, String((p && p.label) || '') + ' · ' + num(p && p.width, 0) + 'x' + num(p && p.height, 0) +
                    ' · steps ' + num(p && p.steps, 0))));
            })
            : h(Empty, { text: '—' })));
    }

    /* ------------------------------ 部件库模态 ------------------------------ */
    function LibraryModal(props) {
      const S = props.S;
      const t = S.t;
      const isActor = S.modal === 'actors';
      const catalog = S.engine && S.engine.catalog ? S.engine.catalog : {};
      const engineList = safeArr(isActor ? catalog.actors : catalog.props);
      const items = engineList.length ? engineList : (isActor ? ACTOR_FALLBACK : PROP_FALLBACK);
      const cards = items.map((it, i) => {
        const kindText = String(it.kind || '') + (it.description ? ' · ' + String(it.description) : '');
        return h('button', {
          key: String(it.id || 'item') + '-' + i,
          onClick: () => S.addElement(it.id),
          disabled: Boolean(S.busy),
        },
          h('span', { className: 'avs-library-icon' }, h(Ico, { name: isActor ? 'cube' : 'layers', size: 16 })),
          h('span', { className: 'avs-library-text' },
            h('b', null, it.label || it.id || '—'),
            h('small', null, kindText)));
      });
      const header = h('div', { className: 'avs-modal-header' },
        h('div', null,
          h('strong', null, isActor ? t('panel_actors') : t('panel_props')),
          h('small', null, items.length + ' presets · ' + (engineList.length ? 'engine catalog' : t('empty_no_catalog')))),
        h(IconBtn, { name: 'close', title: t('btn_close'), onClick: () => S.setModal(null) }));
      const modal = h('div', { className: 'avs-modal', onClick: (e) => e.stopPropagation() },
        header,
        h('div', { className: 'avs-library-grid' }, cards));
      return h('div', { className: 'avs-modal-backdrop', onClick: () => S.setModal(null) }, modal);
    }

    /* -------------------------------- App -------------------------------- */
    function App() {
      const [tab, setTab] = useState('shots');
      const [lang, setLang] = useState('zh');
      const [inspTab, setInspTab] = useState('props');
      // 默认看渲染帧：导演台 iframe 自带三栏，在窄面板里嵌套会二次挤压。
      const [stageTab, setStageTab] = useState('render');
      const [projects, setProjects] = useState([]);
      const [projectId, setProjectId] = useState('');
      const [shots, setShots] = useState([]);
      const [shot, setShot] = useState(null);
      const [jobs, setJobs] = useState([]);
      const [packs, setPacks] = useState([]);
      const [backends, setBackends] = useState(null);
      const [cfg, setCfg] = useState(null);
      const [cfgText, setCfgText] = useState('');
      const [profiles, setProfiles] = useState(null);
      const [checks, setChecks] = useState([]);
      const [previzInfo, setPrevizInfo] = useState(null);
      const [previzState, setPrevizState] = useState(null);
      const [previzUrl, setPrevizUrl] = useState('');
      const [previzFrame, setPrevizFrame] = useState(null);
      const [renderSettings, setRenderSettings] = useState({ samples: 12, longSide: 1600, fps: 24 });
      const [prompt, setPrompt] = useState('');
      const [busy, setBusy] = useState('');
      const [msg, setMsg] = useState('');
      const [err, setErr] = useState('');
      const [playhead, setPlayhead] = useState(0);
      const [playing, setPlaying] = useState(false);
      const [pxPerSec, setPxPerSec] = useState(60);
      const [modal, setModal] = useState(null);
      const [showIframe, setShowIframe] = useState(true);
      // 窄屏适配：左右栏与时间轴可折叠（175% DPI 笔记本上中间区会被挤到 300px 以内）
      const [leftCollapsed, setLeftCollapsed] = useState(false);
      const [rightCollapsed, setRightCollapsed] = useState(false);
      const [timelineCollapsed, setTimelineCollapsed] = useState(false);
      // 面板实际可用宽度（CSS 像素）。DSH 侧栏会吃掉 280+px，必须实测而非用视口宽度。
      const [panelW, setPanelW] = useState(1200);
      // 资产库 & 角色卡
      const [assetItems, setAssetItems] = useState([]);
      const [assetKinds, setAssetKinds] = useState(['image', 'video', 'audio', 'model3d', 'font', 'doc', 'other']);
      const [assetFilter, setAssetFilter] = useState('all');
      const [characters, setCharacters] = useState([]);
      const [charSel, setCharSel] = useState(null);
      const [assetTab, setAssetTab] = useState('lib');
      const rootRef = useRef(null);
      useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const apply = () => setPanelW(Math.round(el.getBoundingClientRect().width || 0));
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
      }, []);
      // 分档：>=900 宽敞；600-899 收紧；<600 极窄（自动折叠侧栏）
      const narrow = panelW < 900 ? (panelW < 600 ? 2 : 1) : 0;
      const [reloadNonce, setReloadNonce] = useState(0);
      const [newProjectOpen, setNewProjectOpen] = useState(false);
      const [newProjectName, setNewProjectName] = useState('');
      const [packForm, setPackForm] = useState({ packId: 'previs-3d-cc0', root: 'F:\\AI视频\\资产包\\previs-3d-cc0' });
      const cfgRef = useRef(null);

      const t = (key) => (DICT[lang] && DICT[lang][key]) || DICT.zh[key] || key;

      /* ---------- 数据加载 ---------- */
      const loadProjects = useCallback(async () => {
        const list = safeArr(await api('/projects'));
        setProjects(list);
        setProjectId((cur) => cur || (list.length ? list[0].id : ''));
        return list;
      }, []);
      const loadShots = useCallback(async (pid) => {
        if (!pid) { setShots([]); return []; }
        const list = safeArr(await api('/projects/' + encodeURIComponent(pid) + '/shots'));
        setShots(list);
        return list;
      }, []);
      const reloadJobs = useCallback(async () => { setJobs(safeArr(await api('/jobs'))); }, []);
      const reloadPacks = useCallback(async () => { setPacks(safeArr(await api('/assets'))); }, []);
      const reloadAssets = useCallback(async () => {
        const r = await api('/assets/items');
        setAssetItems(safeArr(r && r.items));
        if (Array.isArray(r && r.kinds)) setAssetKinds(r.kinds);
      }, []);
      const reloadCharacters = useCallback(async () => {
        setCharacters(safeArr(await api('/characters')));
      }, []);
      const reloadConfig = useCallback(async () => { setCfg(await api('/config')); }, []);
      const reloadBackends = useCallback(async () => { setBackends(await api('/backends')); }, []);
      const reloadChecks = useCallback(async () => {
        const r = await api('/selfcheck');
        setChecks(safeArr(r && r.checks));
        return r;
      }, []);
      const reloadPreviz = useCallback(async () => {
        try { setPrevizInfo(await api('/previz')); } catch (e) { setPrevizInfo(null); }
        try {
          const st = await api('/previz/state');
          setPrevizState(st && st.project ? st : null);
        } catch (e) { setPrevizState(null); }
        try {
          const u = await api('/previz/url');
          setPrevizUrl(u && u.url ? String(u.url) : '');
        } catch (e) { /* keep last known url */ }
      }, []);
      const reloadShots = useCallback(async () => {
        if (!projectId) return [];
        const list = await loadShots(projectId);
        setShot((cur) => {
          if (!cur) return list.length ? list[0] : null;
          return list.find((s) => s.id === cur.id) || (list.length ? list[0] : null);
        });
        return list;
      }, [projectId, loadShots]);

      /* ---------- 生命周期 ---------- */
      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        if (document.querySelector('style[' + STYLE_ATTR + ']')) return undefined;
        const el = document.createElement('style');
        el.setAttribute(STYLE_ATTR, '1');
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { try { el.remove(); } catch (e) { /* ignore */ } };
      }, []);

      useEffect(() => {
        let cancelled = false;
        (async () => {
          const guardLoad = async (fn) => { try { await fn(); } catch (e) { if (!cancelled) setErr(safeMsg(e)); } };
          await guardLoad(loadProjects);
          await guardLoad(reloadJobs);
          await guardLoad(reloadPacks);
          await guardLoad(reloadConfig);
          await guardLoad(reloadChecks);
          await guardLoad(reloadPreviz);
          await guardLoad(reloadAssets);
          await guardLoad(reloadCharacters);
          if (!cancelled) setErr('');
        })();
        return () => { cancelled = true; };
      }, [loadProjects, reloadJobs, reloadPacks, reloadConfig, reloadChecks, reloadPreviz, reloadAssets, reloadCharacters]);

      useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const list = await loadShots(projectId);
            if (cancelled) return;
            setShot((cur) => {
              if (cur && list.find((s) => s.id === cur.id)) return cur;
              return list.length ? list[0] : null;
            });
            setPrompt('');
            setPlayhead(0);
            setPrevizFrame(null);
          } catch (e) { if (!cancelled) setErr(safeMsg(e)); }
        })();
        return () => { cancelled = true; };
      }, [projectId, loadShots]);

      useEffect(() => {
        const timer = setInterval(() => { api('/jobs').then((l) => setJobs(safeArr(l))).catch(() => {}); }, 3000);
        return () => clearInterval(timer);
      }, []);

      useEffect(() => {
        // 密钥不进入可编辑文本：写入占位符说明，保存时被 stripSecretPlaceholders 剔除，避免回写空值覆盖真实 Key。
        if (cfg) setCfgText(JSON.stringify(Object.assign({}, cfg, { seedanceApiKey: SECRET_PLACEHOLDER }), null, 2));
      }, [cfg]);

      useEffect(() => {
        if (cfg) cfgRef.current = cfg;
      }, [cfg]);

      useEffect(() => {
        if (tab === 'backends' && !backends) { reloadBackends().catch((e) => setErr(safeMsg(e))); }
      }, [tab, backends, reloadBackends]);

      useEffect(() => {
        if (tab === 'settings' && !profiles) {
          api('/profiles').then((p) => setProfiles(p || null)).catch(() => {});
        }
      }, [tab, profiles]);

      useEffect(() => {
        if (tab === 'previz' && !previzState) { reloadPreviz().catch(() => {}); }
      }, [tab, previzState, reloadPreviz]);

      /* ---------- 派生数据 ---------- */
      const spans = useMemo(() => {
        let acc = 0;
        return shots.map((s, i) => {
          const dur = shotDur(s);
          const item = { id: s.id || ('shot-' + i), index: i, start: acc, dur: dur, shot: s };
          acc += dur;
          return item;
        });
      }, [shots]);
      const totalSec = useMemo(() => spans.reduce((a, b) => a + b.dur, 0), [spans]);
      const trackSec = Math.max(15, totalSec);

      const engine = useMemo(() => {
        const proj = previzState && previzState.project ? previzState.project : null;
        if (!proj) return null;
        const plans = safeArr(proj.plans);
        const plan = plans.find((p) => p.id === proj.activePlanId) || plans[0] || null;
        return {
          project: proj,
          plan: plan,
          shots: safeArr(plan && plan.shots),
          elements: safeArr(proj.elements),
          catalog: (previzState && previzState.catalog) || {},
          runtime: (previzState && previzState.runtime) || {},
          health: (previzState && previzState.health) || {},
          rules: safeArr(previzState && previzState.agent_rules),
        };
      }, [previzState]);

      const engineShot = useMemo(() => {
        if (!engine || !shot || !shot.previz || !shot.previz.shotId) return null;
        return engine.shots.find((s) => s.id === shot.previz.shotId) || null;
      }, [engine, shot]);

      const markers = useMemo(() => {
        const out = [];
        spans.forEach((sp) => {
          const pv = sp.shot.previz;
          if (!pv) return;
          const isActive = Boolean(shot && shot.id === sp.id);
          const firstT = Number(pv.firstFrameTimeSec);
          const lastT = Number(pv.lastFrameTimeSec);
          if (Number.isFinite(firstT)) {
            out.push({ time: sp.start + Math.max(0, firstT), active: isActive, label: 'first ' + fmtSec(firstT) });
          }
          out.push({ time: sp.start + sp.dur, active: isActive, label: 'shot end' });
          if (Number.isFinite(lastT)) {
            out.push({ time: sp.start + Math.max(0, lastT), active: isActive, label: 'last ' + fmtSec(lastT) });
          }
          if (sp.shot.keyframes && (sp.shot.keyframes.first || sp.shot.keyframes.last)) {
            out.push({ time: sp.start, active: isActive, label: 'kf first' });
          }
        });
        return out;
      }, [spans, shot]);

      const actionBlocks = useMemo(() => {
        const out = [];
        if (!engine) return out;
        spans.forEach((sp) => {
          const pv = sp.shot.previz;
          if (!pv || !pv.shotId) return;
          const es = engine.shots.find((x) => x.id === pv.shotId);
          if (!es) return;
          safeArr(es.actions).slice(0, 4).forEach((a) => {
            out.push({
              start: sp.start + num(a.startSec, 0),
              dur: Math.max(0.4, num(a.durationSec, 1)),
              label: String(a.action || 'action'),
            });
          });
        });
        return out;
      }, [engine, spans]);

      const profileNames = useMemo(() => {
        if (profiles && profiles.profiles) return Object.keys(profiles.profiles);
        return PROFILE_FALLBACK;
      }, [profiles]);

      /* ---------- 播放头推进 ---------- */
      useEffect(() => {
        if (!playing) return undefined;
        const timer = setInterval(() => {
          setPlayhead((p) => {
            const next = p + 0.25;
            return next > trackSec ? 0 : next;
          });
        }, 250);
        return () => clearInterval(timer);
      }, [playing, trackSec]);

      /* ---------- 动作 ---------- */
      const guard = async (key, fn) => {
        if (busy) return;
        setBusy(key);
        setErr('');
        try { await fn(); } catch (e) { setErr(safeMsg(e)); } finally { setBusy(''); }
      };

      const upd = (patch) => setShot((cur) => (cur ? Object.assign({}, cur, patch) : cur));
      const setRefs = (key, value) => {
        setShot((cur) => {
          if (!cur) return cur;
          const refs = Object.assign({ images: [], videos: [], audios: [] }, cur.refs || {});
          refs[key] = splitLines(value);
          return Object.assign({}, cur, { refs: refs });
        });
      };

      const selectShot = (s) => {
        setShot(s ? Object.assign({}, s) : null);
        setPrompt('');
        setPrevizFrame(null);
      };

      const createProject = () => guard('create-project', async () => {
        const name = String(newProjectName || '').trim() || ('项目 ' + (projects.length + 1));
        const p = await api('/projects', { method: 'POST', body: JSON.stringify({ name }) });
        setNewProjectName('');
        setNewProjectOpen(false);
        await loadProjects();
        if (p && p.id) setProjectId(p.id);
        setMsg(t('msg_created') + ' · ' + ((p && p.name) || name));
      });

      const createShot = () => guard('create-shot', async () => {
        if (!projectId) return;
        const s = await api('/shots', {
          method: 'POST',
          body: JSON.stringify({ projectId, shot: { title: '新镜头', mode: 'ref2v', durationSec: 5, ratio: '16:9' } }),
        });
        const list = await loadShots(projectId);
        if (s && s.id) setShot(s); else setShot(list.length ? list[list.length - 1] : null);
        setMsg(t('msg_created') + ' · ' + ((s && s.title) || ''));
      });

      const saveShot = () => guard('save', async () => {
        if (!projectId || !shot) return;
        const saved = await api('/shots', { method: 'POST', body: JSON.stringify({ projectId, shot }) });
        if (saved && saved.id) setShot(saved);
        await loadShots(projectId);
        setMsg(t('msg_saved'));
      });

      const compileShot = () => guard('compile', async () => {
        if (!projectId || !shot) return;
        const r = await api('/compile', { method: 'POST', body: JSON.stringify({ projectId, shotId: shot.id }) });
        const text = String((r && r.prompt) || '');
        setPrompt(text);
        const warns = safeArr(r && r.validation && r.validation.warnings);
        setMsg(t('msg_compiled') + ' · ' + text.length + ' chars · ' + warns.length + ' warn');
      });

      const generateShot = () => guard('generate', async () => {
        if (!projectId || !shot) return;
        const job = await api('/generate', {
          method: 'POST',
          body: JSON.stringify({ projectId, shotId: shot.id, backend: shot.backend }),
        });
        setMsg(t('msg_generated') + ' · ' + ((job && job.id) || ''));
        await reloadJobs();
      });

      const retryJob = (job) => guard('retry', async () => {
        await api('/jobs', { method: 'POST', body: JSON.stringify({ action: 'retry', jobId: job.id }) });
        await reloadJobs();
        setMsg(t('btn_retry') + ' · ' + job.id);
      });

      const cancelJob = (job) => guard('cancel', async () => {
        await api('/jobs', { method: 'POST', body: JSON.stringify({ action: 'cancel', jobId: job.id }) });
        await reloadJobs();
        setMsg(t('btn_cancel') + ' · ' + job.id);
      });

      const qcJob = (job) => guard('qc', async () => {
        const outputs = safeArr(job.outputs);
        if (!outputs.length) return;
        const r = await api('/qc', { method: 'POST', body: JSON.stringify({ path: outputs[0].path }) });
        const issues = safeArr(r && r.issues);
        setMsg(t('msg_qc') + ' · ' + (r && r.ok ? 'ok' : issues.length + ' issue(s)'));
      });

      const mountPack = () => guard('mount', async () => {
        const packId = String(packForm.packId || '').trim();
        const root = String(packForm.root || '').trim();
        if (!packId || !root) return;
        await api('/assets/mount', { method: 'POST', body: JSON.stringify({ packId, root }) });
        await reloadPacks();
        setMsg(t('msg_mounted') + ' · ' + packId);
      });

      const unmountPack = (pack) => guard('unmount', async () => {
        await api('/assets/unmount', { method: 'POST', body: JSON.stringify({ packId: pack.packId }) });
        await reloadPacks();
        setMsg(t('msg_unmounted') + ' · ' + pack.packId);
      });

      const verifyPack = (pack) => guard('verify', async () => {
        const r = await api('/assets/verify', { method: 'POST', body: JSON.stringify({ packId: pack.packId }) });
        const missing = safeArr(r && r.missing);
        setMsg(r && r.ok
          ? t('msg_verified') + ' · ' + num(r.entries, 0)
          : t('btn_verify') + ' · missing ' + missing.length);
      });

      /* ---------- 资产库（上传） ---------- */

      const uploadAssets = (fileList) => guard('upload', async () => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const fd = new FormData();
        for (const f of files) fd.append('file', f, f.name);
        const res = await fetch('/ai-video-studio/api/assets/upload', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((j && j.error) || ('上传失败 ' + res.status));
        await reloadAssets();
        setMsg('已上传 ' + num(j.count, files.length) + ' 个文件');
      });

      const deleteAsset = (id) => guard('asset-del', async () => {
        await api('/assets/delete', { method: 'POST', body: JSON.stringify({ id }) });
        await reloadAssets();
        setMsg('已删除');
      });

      /** 把资产库里的图片/视频/音频挂到当前镜头的参考素材上 */
      const attachAssetToShot = (a) => guard('attach-asset', async () => {
        if (!projectId || !shot) { setErr('先选一个镜头'); return; }
        const key = a.kind === 'image' ? 'images' : a.kind === 'video' ? 'videos' : a.kind === 'audio' ? 'audios' : null;
        if (!key) { setErr('该类型不能作为镜头参考素材'); return; }
        const refs = Object.assign({ images: [], videos: [], audios: [] }, shot.refs || {});
        // 用资产库 id 作为引用（后端生成时会解析）
        const token = 'asset:' + a.id;
        if (!refs[key].includes(token)) refs[key] = refs[key].concat([token]);
        const next = Object.assign({}, shot, { refs });
        const saved = await api('/shots', { method: 'POST', body: JSON.stringify({ projectId, shot: next }) });
        if (saved && saved.id) setShot(saved);
        setMsg('已挂到镜头参考素材：' + a.name);
      });

      /* ---------- 角色卡 ---------- */

      const newCharacter = () => {
        setCharSel({ name: '新角色', appearance: '', style: 'anime cel-shaded, consistent flat colors, anime background', seedPrompt: '', refs: [] });
      };

      const saveCharacterCard = () => guard('char-save', async () => {
        if (!charSel) return;
        const c = await api('/characters/save', { method: 'POST', body: JSON.stringify({ card: charSel }) });
        setCharSel(c);
        await reloadCharacters();
        setMsg('角色卡已保存：' + (c.name || c.id));
      });

      const deleteCharacterCard = (id) => guard('char-del', async () => {
        await api('/characters/delete', { method: 'POST', body: JSON.stringify({ id }) });
        setCharSel(null);
        await reloadCharacters();
        setMsg('角色卡已删除');
      });

      const uploadCharRef = (id, fileList) => guard('char-ref', async () => {
        const files = Array.from(fileList || []);
        if (!files.length || !id) { setErr('先保存角色卡再上传素材'); return; }
        const fd = new FormData();
        fd.append('id', id);
        for (const f of files) fd.append('file', f, f.name);
        const res = await fetch('/ai-video-studio/api/characters/ref', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((j && j.error) || ('上传失败 ' + res.status));
        if (j.card) setCharSel(j.card);
        await reloadCharacters();
        setMsg('已添加 ' + safeArr(j.added).length + ' 个参考素材');
      });

      /** 把角色卡应用到当前镜头：外观描述进 style/description，参考图进 refs */
      const applyCharacterToShot = () => guard('char-apply', async () => {
        if (!charSel || !charSel.id) { setErr('先保存角色卡'); return; }
        if (!projectId || !shot) { setErr('先选一个镜头'); return; }
        const ex = await api('/characters/expand?id=' + encodeURIComponent(charSel.id));
        const refs = Object.assign({ images: [], videos: [], audios: [] }, shot.refs || {});
        // 角色卡参考素材以绝对路径登记（后端生成时会复制到 ComfyUI input）
        for (const p of safeArr(ex.images)) if (!refs.images.includes(p)) refs.images.push(p);
        for (const p of safeArr(ex.videos)) if (!refs.videos.includes(p)) refs.videos.push(p);
        for (const p of safeArr(ex.audios)) if (!refs.audios.includes(p)) refs.audios.push(p);
        const next = Object.assign({}, shot, {
          style: [shot.style, ex.style].filter(Boolean).join(', '),
          description: [ex.prompt, shot.description].filter(Boolean).join(' '),
          refs,
        });
        const saved = await api('/shots', { method: 'POST', body: JSON.stringify({ projectId, shot: next }) });
        if (saved && saved.id) setShot(saved);
        setMsg('角色卡已应用到镜头：' + (charSel.name || ''));
      });

      const saveConfig = () => guard('save-config', async () => {
        const parsed = stripSecretPlaceholders(JSON.parse(cfgText));
        const next = await api('/config', { method: 'POST', body: JSON.stringify(parsed) });
        setCfg(next);
        setMsg(t('msg_cfg'));
      });

      const runSelfcheck = () => guard('selfcheck', async () => {
        const r = await reloadChecks();
        const list = safeArr(r && r.checks);
        setMsg(t('msg_checks') + ' · ' + list.filter((c) => c && c.ok).length + '/' + list.length);
      });

      const startPreviz = () => guard('start-previz', async () => {
        const r = await api('/previz/start', { method: 'POST', body: '{}' });
        await reloadPreviz();
        setShowIframe(true);
        setMsg(r && r.ok ? t('msg_started') + (r.pid ? ' · pid ' + r.pid : '') : (t('btn_start') + ' · ' + ((r && r.note) || 'pending')));
      });

      const stopPreviz = () => guard('stop-previz', async () => {
        await api('/previz/stop', { method: 'POST', body: '{}' });
        await reloadPreviz();
        setMsg(t('msg_stopped'));
      });

      const loadEngineState = () => guard('load-state', async () => {
        const st = await api('/previz/state');
        setPrevizState(st && st.project ? st : null);
        setMsg(t('sec_engine') + ' · ' + (st && st.project ? String(st.project.name || '—') : t('lbl_none')));
      });

      const evalFrame = () => guard('frame', async () => {
        const timeSec = Math.max(0, Number(playhead) || 0);
        const r = await api('/previz/frame?timeSec=' + encodeURIComponent(String(timeSec)));
        setPrevizFrame(r);
        setMsg(t('msg_evaluated') + ' · ' + fmtSec(timeSec));
      });

      const attachPreviz = () => guard('attach', async () => {
        if (!projectId || !shot) { setErr(t('empty_no_sel')); return; }
        const r = await api('/previz/attach', {
          method: 'POST',
          body: JSON.stringify({ projectId, shotId: shot.id, samples: 5 }),
        });
        const list = await loadShots(projectId);
        if (r && r.shot && r.shot.id) setShot(r.shot);
        else setShot((cur) => (cur ? list.find((s) => s.id === cur.id) || cur : (list[0] || null)));
        const frames = r && r.package ? num(r.package.frames, 0) : 0;
        setMsg(t('msg_attached') + ' · ' + frames + ' ' + t('lbl_frames_n'));
      });

      const renderPixels = () => guard('render', async () => {
        if (!projectId || !shot) { setErr(t('empty_no_sel')); return; }
        const r = await api('/previz/render', {
          method: 'POST',
          body: JSON.stringify({
            projectId, shotId: shot.id,
            samples: num(renderSettings.samples, 12),
            longSide: num(renderSettings.longSide, 1600),
            fps: num(renderSettings.fps, 24),
          }),
        });
        const list = await loadShots(projectId);
        const fresh = list.find((s) => s.id === shot.id);
        if (fresh) setShot(fresh);
        setStageTab('render');
        const frames = num(r && r.frameCount, 0);
        setMsg(r && r.ok
          ? t('msg_rendered') + ' · ' + frames + ' ' + t('lbl_frames_n') + ' · ' + num(r.elapsedMs, 0) + 'ms'
          : t('btn_render') + ' · code ' + num(r && r.code, -1));
      });

      const addElement = (preset) => guard('add-element', async () => {
        if (!preset) return;
        await api('/previz/command', {
          method: 'POST',
          body: JSON.stringify({ name: 'director_add_element', arguments: { preset: preset } }),
        });
        setModal(null);
        await reloadPreviz();
        setMsg(t('msg_created') + ' · ' + preset);
      });

      const bumpReload = () => setReloadNonce((n) => n + 1);

      /* ---------- 组装 ---------- */
      const S = {
        // 窄屏折叠状态
        leftCollapsed: leftCollapsed, setLeftCollapsed: setLeftCollapsed,
        rightCollapsed: rightCollapsed, setRightCollapsed: setRightCollapsed,
        timelineCollapsed: timelineCollapsed, setTimelineCollapsed: setTimelineCollapsed,
        // 实际生效状态（供顶栏按钮与把手判断）
        showLeft: narrow >= 2 ? leftCollapsed : !leftCollapsed,
        showRight: narrow >= 1 ? rightCollapsed : !rightCollapsed,
        panelW: panelW, narrow: narrow,
        // 资产库 / 角色卡
        assetItems: assetItems, assetKinds: assetKinds, assetFilter: assetFilter,
        setAssetFilter: setAssetFilter, reloadAssets: reloadAssets, uploadAssets: uploadAssets,
        deleteAsset: deleteAsset, attachAssetToShot: attachAssetToShot,
        characters: characters, charSel: charSel, setCharSel: setCharSel,
        reloadCharacters: reloadCharacters, newCharacter: newCharacter,
        saveCharacterCard: saveCharacterCard, deleteCharacterCard: deleteCharacterCard,
        uploadCharRef: uploadCharRef, applyCharacterToShot: applyCharacterToShot,
        assetTab: assetTab, setAssetTab: setAssetTab,
        t: t, lang: lang, setLang: setLang, tab: tab, setTab: setTab,
        inspTab: inspTab, setInspTab: setInspTab, stageTab: stageTab, setStageTab: setStageTab,
        projects: projects, projectId: projectId, setProjectId: setProjectId,
        shots: shots, shot: shot, selectShot: selectShot, upd: upd, setRefs: setRefs,
        jobs: jobs, packs: packs, backends: backends, cfg: cfg, cfgText: cfgText, setCfgText: setCfgText,
        profiles: profiles, profileNames: profileNames, checks: checks,
        previzInfo: previzInfo, previzState: previzState, previzUrl: previzUrl,
        previzFrame: previzFrame, renderSettings: renderSettings, setRenderSettings: setRenderSettings,
        prompt: prompt, busy: busy, msg: msg, err: err,
        playhead: playhead, setPlayhead: setPlayhead, playing: playing, setPlaying: setPlaying,
        pxPerSec: pxPerSec, setPxPerSec: setPxPerSec,
        modal: modal, setModal: setModal, showIframe: showIframe, setShowIframe: setShowIframe,
        reloadNonce: reloadNonce, bumpReload: bumpReload,
        newProjectOpen: newProjectOpen, setNewProjectOpen: setNewProjectOpen,
        newProjectName: newProjectName, setNewProjectName: setNewProjectName,
        packForm: packForm, setPackForm: setPackForm,
        engine: engine, engineShot: engineShot, spans: spans, totalSec: totalSec, trackSec: trackSec,
        markers: markers, actionBlocks: actionBlocks,
        renderDir: shot && shot.previz && shot.previz.render && typeof shot.previz.render.dir === 'string'
          ? shot.previz.render.dir : '',
        createProject: createProject, createShot: createShot, saveShot: saveShot,
        compileShot: compileShot, generateShot: generateShot,
        retryJob: retryJob, cancelJob: cancelJob, qcJob: qcJob,
        mountPack: mountPack, unmountPack: unmountPack, verifyPack: verifyPack,
        saveConfig: saveConfig, runSelfcheck: runSelfcheck, reloadConfig: reloadConfig,
        reloadJobs: reloadJobs, reloadPacks: reloadPacks, reloadBackends: reloadBackends,
        reloadShots: reloadShots, loadEngineState: loadEngineState,
        startPreviz: startPreviz, stopPreviz: stopPreviz, evalFrame: evalFrame,
        attachPreviz: attachPreviz, renderPixels: renderPixels, addElement: addElement,
      };

      const workbench = tab === 'shots';
      const showTimeline = tab === 'shots' || tab === 'previz';
      let flat = null;
      if (tab === 'jobs') flat = h(JobsPanel, { S: S });
      else if (tab === 'assets') flat = h('div', null,
        h('div', { className: 'avs-row', style: { marginBottom: 10 } },
          h('button', { className: 'avs-nav-chip' + (assetTab === 'lib' ? ' is-active' : ''), onClick: () => setAssetTab('lib') }, '资产库（上传）'),
          h('button', { className: 'avs-nav-chip' + (assetTab === 'packs' ? ' is-active' : ''), onClick: () => setAssetTab('packs') }, '资产包（外挂）'),
          h('button', { className: 'avs-nav-chip' + (assetTab === 'chars' ? ' is-active' : ''), onClick: () => setAssetTab('chars') }, '角色卡')),
        assetTab === 'lib' ? h(AssetsLibrary, { S: S })
          : assetTab === 'chars' ? h(CharactersPanel, { S: S })
            : h(AssetsPanel, { S: S }));
      else if (tab === 'previz') flat = h(PrevizPanel, { S: S });
      else if (tab === 'backends') flat = h(BackendsPanel, { S: S });
      else if (tab === 'settings') flat = h(SettingsPanel, { S: S });

      // 实际生效的折叠状态：
      //   <600px  极窄 → 左右栏都默认收起（用户可手动展开）
      //   <900px  偏窄 → 右栏默认收起
      //   >=900px 正常 → 都展开
      const autoLeftCollapsed = narrow >= 2;
      const autoRightCollapsed = narrow >= 1;
      const showLeftPane = autoLeftCollapsed ? leftCollapsed : !leftCollapsed;
      const showRightPane = autoRightCollapsed ? rightCollapsed : !rightCollapsed;
      const effectiveTimelineCollapsed = timelineCollapsed || narrow >= 2;

      return h('div', {
        ref: rootRef,
        className: 'avs-root',
        'data-narrow': String(narrow),
        style: narrow >= 2 ? { '--avs-timeline-h': '150px' } : (narrow >= 1 ? { '--avs-timeline-h': '180px' } : {}),
      },
        h(TopBar, { S: S }),
        workbench
          ? h('div', {
            className: 'avs-main'
              + (showLeftPane ? '' : ' is-left-collapsed')
              + (showRightPane ? '' : ' is-right-collapsed'),
          },
            // 折叠时不渲染该列 DOM，保证 grid 项数量与 --avs-cols 的列数一致
            showLeftPane ? h('div', { className: 'avs-col is-left' }, h(SideBar, { S: S })) : null,
            h('div', { className: 'avs-col is-mid' }, h(Stage, { S: S })),
            showRightPane ? h('div', { className: 'avs-col is-right' }, h(Inspector, { S: S })) : null)
          : h('div', { className: 'avs-main is-flat' }, flat),
        showTimeline ? h(Timeline, { S: { ...S, timelineCollapsed: effectiveTimelineCollapsed } }) : null,
        modal ? h(LibraryModal, { S: S }) : null,
        err ? h('div', { className: 'avs-toast is-error', onClick: () => setErr('') }, err) : null,
        msg ? h('div', { className: 'avs-toast is-ok', onClick: () => setMsg('') }, msg) : null);
    }

    function Icon(props) {
      const size = (props && props.size) || 18;
      return h('svg', {
        viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', opacity: props && props.active ? 1 : 0.82 },
      },
        h('rect', { x: 6, y: 14, width: 52, height: 38, rx: 7, fill: 'currentColor', opacity: 0.18 }),
        h('rect', { x: 6, y: 14, width: 52, height: 38, rx: 7, fill: 'none', stroke: 'currentColor', strokeWidth: 3 }),
        h('path', { d: 'M10 20 L54 14', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' }),
        h('path', { d: 'M27 28 L27 42 L39 35 Z', fill: 'currentColor' }));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'ai-video-studio', order: 30, label: '视频工作室' }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'ai-video-studio' }, App));
      },
    };
  },
});
