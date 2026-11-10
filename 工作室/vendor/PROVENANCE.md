# 复用产物来源台账（PROVENANCE）

> **中性化说明（本文件口径）**：本台账中的「闭源商业软件（内部代号 *）」指用户本地持有的某商业预演软件，其名称、商标与品牌标识已从本项目全部交付物中移除；仅保留代码/资产来源的技术性登记（路径、哈希、许可证边界）。
>
> 原则：每项复用物记录来源、版本/哈希、许可、文件、修改、使用模块、日期。内部/闭源拆解物仅本地自用，标记 `distribution: forbidden`。
> **运行时接口兼容名**：`PREVIZ_DIRECTOR_HOME` / `PREVIZ_DIRECTOR_HOST` 为 ported engine 读取的既有环境变量名，属运行时兼容标识符（非新增品牌引用），保持原样以保证引擎可读数据目录。

## 1. 闭源商业软件（内部代号 *）预演引擎 1.0.19（闭源拆解，仅本地）

| 项 | 内容 |
|---|---|
| 来源 | 用户拆解：`F:\AI视频\功能拆解\预演软件\`（版本 1.0.19；安装包 SHA-256 `0f4668e7…1b0918`） |
| 复制到 | `F:\AI视频\工作室\services\previz\src\previs\`（目录名为历史标识符，内容为拆解产物）、`docs\` |
| 文件 | `app_director_engine_module.js`（75,266B）、`app_server_entry_module.js`（21,592B）、`vendor_three_r184_module.js`（836,204B）、`vendor_mcp_sdk_and_ajv_zod.js`（825,312B）+ docs（data_model/http_api/validation_rules/README_extraction/static_vs_dynamic_check/agent_backend）+ `data/`（tool_catalog 等） |
| 许可 | 无公开许可（闭源商业软件拆解产物） |
| distribution | **forbidden**（不随插件/分发包；仅本地自用） |
| 修改计划 | **已 port（2026-11-05）**：`tools/build-engine.mjs` 生成 `engine.mjs`（vendor+engine+server 合并、stdio 传输层剥离、依赖注入与别名兼容）；`server.mjs` 暴露 `/api/health|project|command|agent/chat`；与闭源预演引擎可执行文件 golden 对照一致（15 工具、catalog 58/28/7/10/8、中文校验） |
| 生成物 | `services/previz/engine.mjs`（924,405 B，生成物，勿手改）、`services/previz/server.mjs`、`services/previz/tools/build-engine.mjs` |
| 使用模块 | P2 3D 预演（自研服务，已替代闭源预演引擎可执行文件；后者保留为兜底/对照） |
| **中性化改写登记** | 为移除品牌引用，`src/previs/` 内仅对 **3 处字符串/注释** 做等价替换（未改任何逻辑、标识符、数据表）：`app_director_engine_module.js` 的临时目录前缀 `previs-engine-agent-` → `previs-engine-agent-`、stderr 横幅 `闭源预演软件 AI Director stage:` → `Previs engine stage:`；`app_server_entry_module.js` 的默认数据目录 `.previs-engine` → `.previs-engine`。**环境变量名 `PREVIZ_DIRECTOR_HOME` / `PREVIZ_DIRECTOR_HOST` / `PREVIZ_DIRECTOR_WEB_ROOT` 一律保留原样**（运行时契约）。`engine.mjs` 生成物已由 `tools/build-engine.mjs` 重建（924,405 B，SHA-256 `b1964ce1…2f768498`），与源码一致，并通过线上服务功能回归。 |
| 日期 | 2026-11-05 |

## 2. 闭源商业软件 B · 节点动画工具 2.8.0（闭源拆解，仅 schema 参考）

| 项 | 内容 |
|---|---|
| 来源 | `F:\AI视频\功能拆解\节点动画软件\拆解\04_资产\` |
| 计划 | 打成 `node-schema-ref` 资产包（node-catalog.json 491 节点、script-api-reference.json 408 API、docs-index、js-api-usage、mcp-hints、shaders-index、core-attribution） |
| 许可 | 闭源商业软件；**只参考字段/枚举/交互，原文不随插件分发** |
| 使用模块 | P3 动效页 |
| 日期 | 2026-11-05 |

## 3. 闭源商业软件 C · 视频增强工具 1.7.2（闭源拆解，仅 schema 参考）

| 项 | 内容 |
|---|---|
| 来源 | `F:\AI视频\功能拆解\视频增强软件\拆解\04_资产\` |
| 计划 | 打成 `enhance-schema-ref` 资产包（model-catalog.json 89 模型、presets-catalog.json 14 预设、configs.json、neuroserver.json、ai-runtime/*） |
| 许可 | 闭源商业软件；权重 `.tz`+RLM/OAuth 不可用；**只参考 schema，原文不随插件分发** |
| 使用模块 | P1 后处理页 |
| 日期 | 2026-11-05 |

## 4. 开源依赖（已落地 / 计划）

| 项目 | 许可 | 用途 | 方式 | 状态 |
|---|---|---|---|---|
| FFmpeg 9.0.2-essentials | LGPL/GPL（essentials build 含 GPL 组件：x264 等） | 后处理/质检/probe | 便携 CLI，置于 `工作室\tools\ffmpeg\` | ✅ **已落地**（2026-11-05；来源 `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`，109.5 MB；含 LICENSE 原文） |
| ComfyUI | GPL-3.0 | H3 本地生成 | 进程边界（HTTP） | ⏸ 待环境 |
| DiffSynth-Studio | Apache-2.0 | H3 NF4 备选 | 进程边界/CLI | ⏸ 计划 |
| DirectorDesk | MIT | 3D 预演替代 | 外部桌面 + 文件交换 | ⏸ 计划 |
| OpenCineAgent | Apache-2.0 | 流水线参考 | 进程边界（可选） | ⏸ 计划 |
| SeedVR2/FlashVSR/Real-ESRGAN/RIFE | Apache-2.0/BSD-3/MIT | 超分/补帧 | CLI/节点 | ⏸ 计划（`studio_post` 已留 `interpolate` 接入点） |
| OpenTimelineIO | Apache-2.0 | 时间线 | 依赖 | ⏸ 计划 |

> ffmpeg 为 LGPL/GPL 混合构建：**若分发本插件需附 LICENSE 并遵守 GPL 条款**；不分发时无影响。
> 详细许可见 `存档-旧方案\附录A-开源代码复用与许可证清单.md`（历史核查，后续按需更新）。

## 5. 维护规则

1. 任何新增复用物先在本文件登记，再进入 `vendor/` 或资产包。
2. 内部/闭源标记 `forbidden`；CC0/MIT/Apache 可用于可分发包。
3. REA 深挖结果写入 `docs/probes/` 并回填本文件。
4. 完工后按本台账做许可审计。

## 6. 闭源商业软件（内部代号 *）导演台前端包（闭源，仅本地）

| 项 | 内容 |
|---|---|
| 来源 | `F:\AI视频\功能拆解\预演软件\01_解包载荷\resources\`（导演台前端包目录）：`index.html`（原件 471B，SHA-256 `63d94d0a…ab5fe48`）、`assets/index-CBJ_xqSO.js`（原件 818,472B，`b7fe16ff…0617284`）、`assets/index-CPZsrFJ8.css`（24,817B，`3bed561a…d64718d2`） |
| vendored 到 | `F:\AI视频\工作室\services\previz\web\`。**中性化改写登记（重要）**：<br>① `index.html` 仅改写 `<title>` → 现 **467B**、SHA-256 `c9fd2d5e…394b2e9`；<br>② `assets/index-CBJ_xqSO.js` 仅对 5 处**界面文案/文件名**做中性化替换（`appName` 中英各 1、`localStorage` locale 键 2、下载文件名 2），未改任何逻辑/组件/API 调用 → 现 **818,452B**、SHA-256 `559a2310…74ccd23`；<br>③ `assets/index-CPZsrFJ8.css` **未改动**，与原件逐字节一致（24,817B，`3bed561a…d64718d2`）。<br>改写均为字符串级等价替换，已用「反向替换还原 === 原件」逐字节验证；`node --check` 通过。 |
| 用途 | 预演导演台 UI（由自研 `server.mjs` 静态托管 `GET /` 与 `GET /assets/*`；`/previz/url` 返回其地址）+ UI 设计依据 |
| 许可 | 闭源商业软件内部资产；**distribution: forbidden**；仅本地使用，不随插件/分发包 |
| 拆解证据 | `F:\AI视频\工作室\services\previz\docs\rea-预演前端-analysis.json`、`F:\AI视频\工作室\services\previz\docs\预演前端-render-extract.txt`（REA 分析 / 代码摘录）。**两文件名为历史技术标识符**：属闭源产物拆解证据原件，未改名以免破坏既有证据链与引用；其 `预演前端` 仅指「导演台前端」这一技术组件，不含品牌含义 |
| 渲染核心移植 | `web\render.html` 依据拆解结果**等价重写**（元素构建/人物骨架/关节应用/取景），未复制原混淆代码；渲染用 three.js r184 + Edge headless（见 §8） |
| **UI 设计依据** | `client.js`（插件界面）的**设计令牌与布局语言**取自该 CSS：配色（`#0e1012`/`#131518`/`#111316`/`#15171a`/`#1c1f23`、边框 `#292d33`/`#343940`）、尺寸（顶栏 54px、时间轴 264px、左栏 238px、右栏 320px、行高 42px、表头 48px）、组件形态（shot-row/element-row/timeline-ruler/action-block/keyframe-dot 等）。**实现为等价重写**：只用 CSS 类名与视觉参数，未复制其 JS 源码，且全部颜色以 `var(--dsw-alias-*, <导演台深色>)` 双写以适配 DSH 明暗主题 |
| 日期 | 2026-11-05（§6 主体）· 2026-11-06（补 UI 设计依据说明） |

## 7. three.js r184（MIT，离线渲染）

| 项 | 内容 |
|---|---|
| 来源 | `https://unpkg.com/three@0.184.0/build/`（本机为离线副本） |
| 文件 | `three.module.js`（648,961B，SHA-256 `61134198…f741f2`）、`three.core.js`（1,427,497B，`368dc788…aae9ccf13`） |
| 放置 | `F:\AI视频\工作室\services\previz\web\vendor\` |
| 许可 | MIT |
| 用途 | `web\render.html` 的离线预演渲染（WebGL2），经 Edge headless 驱动 |
| 日期 | 2026-11-05 |

## 8. Edge + SwiftShader（渲染后端，不随插件分发）

| 项 | 内容 |
|---|---|
| 使用 | 系统已装 Microsoft Edge：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（实测文件版本 **151.0.4129.72**） |
| 启动参数 | headless + `--use-angle=swiftshader --enable-unsafe-swiftshader`（另含 `--use-gl=angle`），由 `services/previz/tools/render-previz.mjs` 通过 CDP 驱动 |
| 作用 | 无 GPU 时提供 WebGL2，渲染 `web\render.html` 得到逐帧 PNG |
| 许可/分发 | Edge 为 Microsoft 产品，条款归 Microsoft；插件**不随包分发**，仅调用本机既有程序 |
| 日期 | 2026-11-05 |
