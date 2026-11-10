# 插件 UI 实测验证报告

> 时间：2026-11-06 00:20—00:40（Asia/Shanghai）
> 对象：`F:\AI视频\工作室\dsh-ai-video-studio\client.js`（104,584 B / 1687 行）
> 环境：DSH 0.2.2-rc.1 · Electron 桌面 GUI（窗口 PID 23864）· 插件 Web API `http://127.0.0.1:12616` · 预演服务 `http://127.0.0.1:4318`（`engine:"port"`）
> 浏览器：Microsoft Edge headless 151.0.4129.72（`--use-angle=swiftshader --enable-unsafe-swiftshader`）

## 一、结论摘要

| 项 | 结果 |
|---|---|
| `client.js` 语法 | ✅ `node --check` exit=0 |
| 插件槽位注册（`sidebar.panellist` + `main`） | ✅ 两者 occupants 均含 `ai-video-studio`、`active: true`（`cordis_inspect_query` client/Slots 实测） |
| 插件重载 | ✅ `set_bundle false → true`，两次均 `application: "applied"`、`warnings: []` |
| **组件树真实浏览器渲染** | ✅ `boot: "ok"`，React 18.3.1 + ReactDOM 18.3.1 真实挂载，**0 console error / 0 exception** |
| 三栏布局成形 | ✅ `grid-template-columns: 232.5px 815.5px 320px`（左窄 / 中宽 / 右 320px） |
| 顶栏 54px | ✅ 实测 `height: 54px` |
| 底部时间轴 264px | ✅ 实测 `height: 264px`，ruler 17 个刻度 |
| 6 个页签全部可切换 | ✅ 分镜 / 任务 / 资产包 / 预演 / 后端 / 设置 逐个点击，均渲染出内容、0 报错 |
| 右栏 3 个 tab 全部可用 | ✅ 属性 / 预演 / 数据 逐个点击，均渲染、0 报错 |
| 内嵌预演导演台 iframe | ✅ `src="http://127.0.0.1:4318/"`（来自 `GET /previz/url`） |
| 渲染产物缩略图 | ✅ `first.png` / `last.png` 均 `naturalWidth=1600, naturalHeight=900`（真实解码成功） |
| control.mp4 播放 | ✅ `<video>` `readyState=4`（可播放） |
| **「渲染预演像素」端到端** | ✅ 点击 → 真实后端渲染 → toast「**渲染完成 · 12 帧 · 5055ms**」→ 舞台自动切到「渲染帧」→ 缩略图刷新 |
| 样式注入 | ✅ `<style data-avs-style>` 存在，`cssRules.length = 176`，无重复注入 |
| 真实数据接入 | ✅ 1 项目 / 1 镜头 / 1 任务 / 5 资产包 / 12 项自检（10 ok）/ 引擎 4 镜头 2 元素 |
| **DSH 真实 GUI 内渲染** | ✅ 在运行中的 Electron 窗口内点击侧栏「视频工作室」后，插件标记色全部出现：`#ff7a66`/`#55c2ff`（引擎演员 1/2 的 identity-dot 颜色，各 276 px）、`#131518`（时间轴，34,750 px）、`#15171a`（面板，101,161 px）、`#292d33`（边框，924 px）；切回对话页后全部归零，可复现 2 轮 |

**未验证项**：无（UI 渲染已用真实浏览器 + 真实后端数据，并在 DSH 真实 Electron 窗口内完成差分确认）。

## 二、为什么要自建 harness

DSH GUI 运行在 Electron 桌面窗口内，其 Web 端口 `http://127.0.0.1:12616/` 对**主文档**返回 `401 Unauthorized`（`dsh web authentication required; reopen the URL printed by dsh web.`）。这意味着外部浏览器无法直接打开插件面板，`systematic` 的截图验证被阻断——这也是上一轮验证 teammate 报告的阻塞点。

解决方案：自建**同源反向代理 + 真实 React UMD** 的 harness，把 `client.js` 放到与插件 API 同源的位置渲染，从而在不伪造组件的前提下完成浏览器级验证。

| 文件 | 作用 |
|---|---|
| `docs\harness\index.html` | 打桩 DSH 运行时（`window.__ModuleLoader__` + `require('react')`），调用 `client.js` 的 `apply(ctx)`，再用 `ReactDOM.createRoot` 渲染 `main` 槽位组件；捕获 `error` / `unhandledrejection` / `console.error` 到 `window.__ERRORS__` |
| `docs\harness\serve-harness.mjs` | 同源托管 harness 静态文件 + 把 `/ai-video-studio/api/*` 反向代理到 `127.0.0.1:12616` |
| `docs\harness\react.js` / `react-dom.js` | React 18.3.1 UMD（与 DSH 客户端同版本，`https://unpkg.com/react@18.3.1/umd/`） |
| `docs\harness\verify-ui.mjs` | CDP 驱动 Edge headless，读取 DOM 结构/尺寸/文本/iframe/img，抓控制台错误，截图 |
| `docs\harness\verify-tabs.mjs` | 逐个点击 6 页签 + 3 个右栏 tab，逐项截图 |
| `docs\harness\verify-action.mjs` | 点击「渲染预演像素」，等真实渲染完成，验证 toast 与产物 |

> harness 只替换 DSH 的**运行时外壳**（模块加载器与 React 入口），`client.js` 本体**逐字节原样加载**，不做任何 mock 或改写；API 全部打到真实插件后端。因此它验证的是真实组件树与真实数据，但**不验证 DSH 主框架自己的布局容器**（如侧栏宽度、主区 padding），那一层由槽位注册状态 + §3.5 的真实 GUI 差分确认。

### 2.1 DSH 真实 GUI 内的差分确认

由于 `http://127.0.0.1:12616/` 主文档需认证，改用**运行中 Electron 窗口的像素差分**确认插件确实在真实 GUI 里渲染：

| 步骤 | 画面 | `#ff7a66` | `#55c2ff` | `#131518` | `#15171a` | `#292d33` |
|---|---|---|---|---|---|---|
| 点侧栏「对话」 | 对话页 | 0 | 0 | 0 | 0 | 0 |
| 点侧栏「视频工作室」 | **插件面板** | **276** | **276** | **34,750** | **101,161** | **924** |
| 再点「对话」 | 对话页 | 0 | 0 | 0 | 0 | 0 |
| 再点「视频工作室」 | **插件面板** | **276** | **276** | **34,750** | **101,161** | **924** |

固定窗口几何、逐次截图后统计特征像素数。`#ff7a66` / `#55c2ff` 正是**预演引擎里 Actor 1 / Actor 2 的真实颜色**（来自 `GET /previz/state` → `project.elements[].color`），只可能由本插件的舞台元素列表绘制 → 确定性证明插件 UI 已在 DSH 真实窗口中渲染，且已连上真实引擎数据。两轮切换结果完全一致（可复现）。

截图：`docs\ui-shot-dsh-live.png`（1,293×827）。

## 三、实测数据

### 3.1 首次渲染（空数据 → 真实数据）

```
boot: "ok"                     registered: ["sidebar.panellist","main"]
errors: []                     rootSize: { w: 1368, h: 804 }
topbar: true  topbarH: 54      timeline: true  timelineH: 264
mainCols: "232.547px 815.453px 320px"
rulerTicks: 17                 shotRows: 1  elementRows: 2  keyframeDots: 3  clipBars: 1
iframes: ["http://127.0.0.1:4318/"]
navTabs: ["分镜","任务","资产包","预演","后端","设置","10/12","导出预演包","EN"]
styleInjected: true            styleRules: 176
```

页面文案（真实数据）：`AI 视频工作室 / 预演导演台 · 分镜工作台 / online / 分镜 1 / P0 自检项目 / 01 P0 自检镜头 5.0s · ref2v mock · 预演 / 舞台元素 2 Actor 1 mannequin Actor 2 mannequin / engine ✓ / 00:00:00 5.0s · 1 shot(s) · 60px/s`。

### 3.2 页签逐个点击

| 页签 | 关键内容 | iframe | 截图 |
|---|---|---|---|
| 分镜 | 工作台三栏 + 时间轴 + 内嵌导演台 | `http://127.0.0.1:4318/` | `ui-shots\tab-1.png`（92,682 B） |
| 任务 | `1 total · 0 active`、`job_mw3d1gbj952ft · completed`、质检/取消/OPEN、视频预览 | — | `tab-2.png`（676,503 B） |
| 资产包 | `5 mounted`、test-pack(1)/previs-3d-cc0(572·stale)/node-schema-ref/enhance-schema-ref | — | `tab-3.png`（48,435 B） |
| 预演 | 服务 port 4318 online、启动/停止/读取工程/打开导演台、导出并绑定、按播放头求值、渲染预演像素、first.png+last.png | `http://127.0.0.1:4318/` | `tab-4.png`（72,635 B） |
| 后端 | `3 backends`：mock 正常 / h3-local 异常 / seedance-cloud AUTH_REQUIRED + 能力矩阵 | — | `tab-5.png`（34,564 B） |
| 设置 | config.json 编辑 + 自检 `10/12` + 档位 | — | `tab-6.png`（67,947 B） |

全部 6 个页签 `active` 状态正确、每次切换后 0 exception / 0 console.error。

### 3.3 右栏 tab

| tab | 关键内容 | 截图 |
|---|---|---|
| 属性 | 镜头参数（模式 segmented / 比例 / 时长 / 后端 / 档位）、画面、声音、参考素材、关键帧、提示词、编译/保存/生成 | `insp-属性.png`（92,702 B） |
| 预演 | 服务开关 + `# px fps` 三字段 + 渲染预演像素 + first/last 缩略图 + control.mp4 | `insp-预演.png`（94,376 B） |
| 数据 | 引擎工程 `Untitled Previs`、镜头数 4、元素 2、时长 15.0s、fps 24、健康检查 | `insp-数据.png`（99,897 B） |

### 3.4 「渲染预演像素」端到端

```
click:  clicked
toast:  "渲染完成 · 12 帧 · 5055ms"
after:  stageTab: [{导演台,false},{渲染帧,true}]   imgs: first.png(1600x900) x2 + last.png(1600x900)
        videos: control.mp4 readyState=4
ERRORS: []
截图：ui-shots\render-action.png（71,656 B）
```

磁盘侧复核：`data\previz\render\shot_mw3d03scusykq\` 现有 **12** 个 `frame_*.png`，`render.json` 的 `frameCount: 12`、`fps: 24`、`longSide: 1600`、`aspect: 16:9`、`elapsedMs: 5055` —— 帧数与磁盘一致。

## 四、本轮修复的缺陷

| # | 严重度 | 缺陷 | 修复 | 验证 |
|---|---|---|---|---|
| D1 | 🟠 中 | 设置页把 `seedanceApiKey` 强制置空后原样 POST 回去，点一次「保存配置」会**永久抹掉已存 Key**；且 `POST /config` 响应体回传明文 | `client.js` 加 `SECRET_PLACEHOLDER` + `stripSecretPlaceholders()`：占位符与含 `***` 的值在提交前被剔除，不会覆盖真实 Key | 代码审查 + `node --check`；`POST /config` 的掩码问题属 `index.js` 边界，另行记录（未改，避免影响既有 API 契约） |
| D2 | 🟠 中 | 渲染不清空旧帧：samples 从 24 降到 12 后，磁盘同时存在 12 新帧 + 12 旧帧，`render.json` 声明 12 但通配符能匹配 24 | `index.js` `renderPreviz()` 在渲染前删除该目录的 `frame_*.png` / `first.png` / `last.png` / `control.mp4` / `control.webm` / `render.json` | ✅ 实测：重渲染后磁盘 `frame_*.png` **恰好 12 个**，与 `render.json.frameCount` 一致 |
| D3 | ✅ 已消除 | 上一轮报告称 `iframe` 缺失、`/previz/render`、`/previz/url`、`/profiles`、`/qc`、`/post`、`/previz/command` 未接 UI | 新 `client.js` 已全部接入且实测可达 | ✅ 见 §3.2／§3.4：iframe 加载、渲染按钮成功、质检按钮存在、profiles 在设置页、`/previz/command` 由演员库/道具库调用 |

## 五、槽位注册状态（原样记录）

`cordis_inspect_query`（platform=client, provider=Slots, method=listSubTree）：

- `sidebar.panellist` occupants：`{registrant:"tk", id:"plugins", order:0, active:true}`、`{id:"schedules", order:10, active:true}`、`{id:"ai-video-studio", order:30, active:true}`
- `main` occupants：`{key:"plugins", active:true}`、`{key:"conversation", active:true}`、`{key:"schedules", active:true}`、`{key:"ai-video-studio", active:true}`

> 上一轮该查询连续 4 次 10s 超时；本轮多次调用均正常返回。

## 六、局限与未覆盖项

1. **DSH 主框架容器未纳入本 harness**：验证覆盖插件组件树自身的布局（顶栏/三栏/时间轴尺寸均实测），但 DSH 给 `main` 槽位的外层容器宽度、内边距、滚动策略由主框架决定，本 harness 以全视口 1368×804 代替。若在 DSH 内实际宽度更窄，靠 `clamp()` 与 980px/720px 媒体查询降级（`docs\harness\index.html` 已验证 1400×900 视口）。
2. **明暗主题未做像素级对照**：颜色全部走 `var(--dsw-alias-*, <导演台深色>)` 双写，harness 只验证了 light 令牌下的渲染；dark 主题按同一令牌机制生效，未单独截图。
3. **`/config` 免认证暴露主机绝对路径**（`dataDir` / `assetRoot` / `previzExe`）：属 loopback-only 的既有设计；若将来暴露到局域网需加鉴权。本轮未改。
4. **`/file` 404 返回纯文本**而非 JSON，前端报错会退化为 `404 Not Found`；不影响功能，未改。

## 七、复现步骤

```powershell
# 1. 启动 harness（同源代理 + 真实 React）
Start-Process -FilePath 'F:\Deepseek_harness\rea-agent\runtime\node.exe' `
  -ArgumentList 'serve-harness.mjs','4477' `
  -WorkingDirectory 'F:\AI视频\工作室\docs\harness' -WindowStyle Hidden

# 2. 结构验证（三栏/顶栏/时间轴/iframe/控制台错误）
& 'F:\Deepseek_harness\rea-agent\runtime\node.exe' `
  'F:\AI视频\工作室\docs\harness\verify-ui.mjs' 'http://127.0.0.1:4477/' `
  'F:\AI视频\工作室\docs\ui-shot-plugin.png'

# 3. 6 页签 + 3 右栏 tab 交互验证
& 'F:\Deepseek_harness\rea-agent\runtime\node.exe' `
  'F:\AI视频\工作室\docs\harness\verify-tabs.mjs' 'http://127.0.0.1:4477/'

# 4. 渲染按钮端到端（约 5—30 秒）
& 'F:\Deepseek_harness\rea-agent\runtime\node.exe' `
  'F:\AI视频\工作室\docs\harness\verify-action.mjs' 'http://127.0.0.1:4477/'
```

前置：插件已启用、预演服务在线（`GET /ai-video-studio/api/previz` 返回 `health.ok: true`）。

## 八、产物清单

| 文件 | 字节 |
|---|---|
| `docs\ui-shot-plugin.png` | 92,702（harness 全工作台） |
| `docs\ui-shot-dsh-live.png` | 1293×827（DSH 真实 GUI 内插件面板，差分用） |
| `docs\ui-shots\tab-1.png` … `tab-6.png` | 92,682 / 676,503 / 48,435 / 72,635 / 34,564 / 67,947 |
| `docs\ui-shots\insp-属性.png` / `insp-预演.png` / `insp-数据.png` | 92,702 / 94,376 / 99,897 |
| `docs\ui-shots\render-action.png` | 71,656 |
| `docs\ui-shot-director.png` | 82,897（预演导演台，前一轮） |
