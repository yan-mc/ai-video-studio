# 09 预演软件拆解 → 可复用模块与 DSH 集成摘要

> 输入：`F:\AI视频\功能拆解\预演软件\`（预演软件 1.0.19 静态拆解成果库，2026-11-04 整理；含 README 与 `02_报告` 13 份分册）。
> 用途：并入《AI 视频本地制作软件与 DSH 插件工程规划 v2》的单镜头闭环路线（RTX 4080 Laptop 12GB、本地 H3 为主、DSH Web 面板）。
> 标注：【观察】=拆解报告直接证据；【推断】=多证据推理；【未知】=静态无法确认。每项附来源（`00`=总报告、`02`=导演台前端、`03`=主 UI、`04`=3D 子应用、`07`=预演引擎进程、`08`=voice-sidecar、`09`=资产库）。本文只做复用评估，不复制代码，不给出实现代码。

---

## 0 结论与优先级

1. **P0（本周可做）**：把 `预演引擎可执行文件` 当作**外部预演参考服务**跑通——两种用法：`--http 4318` 提供 `/api/project`+`/api/command`；或默认无参启动走 **MCP stdio**（15 个 `director_*` 工具）。只做 PoC、不 vendor、不写进交付仓库，来源台账登记。【观察+推断，07 §2/§3】
2. **P1 主路径**：3D 预演用**开源 DirectorDesk（mangfufu/预演工作台，MIT，v0.5.2，452★，2026-10-24 活跃）**，而不是预演软件的 预演工作台 Web 子应用。开源版有源码、深度视频导出、内置 MCP 与 AI 助手、桌面安装包；预演软件版是构建产物 + Tauri 宿主桥，独立运行能力弱。【观察：两条来源；推断：版本关系】
3. **P1 不接配音台**：H3 原生音频（对白/环境声）可覆盖单镜头闭环；voice-sidecar 需要外部 IndexTTS-2.5 + ComfyUI Qwen3-TTS，都会和 H3 争 12GB 显存，必须串行，得不偿失。只借它的**章节切分/角色台词抽取/情绪档位**数据设计。【观察，08 §4/§6】
4. **资产种子只取 CC0 部分**：fuka 154 个 CC0 道具（Kenney/Quaternius 等）与 132 个 CC0 场景模板可直接种子进资产库；fuka 111 姿势/24 循环动作是预演软件自研资产、许可不明，仅私下参考；**guo 三包（180 道具/200 场景/37 骨架）是产品内部资产，不导入、不分发**。【观察，09 §7；04 §6】
5. **不复刻 26 节点画布与 6 套 Studio**：只借 5 个交互模式——镜头状态机、尾帧继承、分镜切割/故事板、剧集画布批量提交、审片对比。其余（漫画工坊、模特台、服化道、直播/演唱等）与单镜头闭环无关。【观察，03 §4】
6. **最大风险不是技术而是来源**：三个 sidecar/子应用均为闭源二进制或构建产物，无公开许可；二进制未签名、端口无鉴权、`PREVIZ_HOST` 可改 `0.0.0.0`。自用可以，**不要进公开分发包**，不要把 exe/资产 vendor 进仓库。【观察，07 §11；09 §7】

---

## 1 架构、端口与数据格式（可直接采信的事实）

| 组件 | 形态/端口 | 关键事实 | 来源/置信 |
|---|---|---|---|
| 预演软件主程序 | Tauri 2.11.2 + Rust + WebView2，x64 | 内嵌多套 SPA（2197 资产/224MB）、SQLite `projects.db`、License 一机一码、relay 客户端 | 【观察】00 §2/§3/§8 |
| 预演引擎进程 | Bun 1.3.14 单文件，HTTP 4318 / MCP stdio | 单 exe 双形态；默认 stdio MCP（服务名 `previs-engine@0.2.0`），`--http [port]` 起 HTTP；托管 `预演前端` 静态页；工程存 `PREVIZ_HOME`（默认 `~/.previs-engine`）的 `project.json`+`history.json` | 【观察+动态实测】07 §2/§4 |
| 预演前端 | 818KB React/Vite 构建，由 4318 同源托管 | 三接口：`GET /api/project`、`POST /api/command {name,arguments}`、`POST /api/agent/chat {messages}`；900ms 轮询；无 SSE/WS | 【观察】02 §4 |
| voice-sidecar | PyInstaller + CPython 3.14，FastAPI，8765 | 34 个 path/39 操作；SQLite 7 表；TTS 走 IndexTTS-2.5 Gradio、音色铸造走 ComfyUI Qwen3-TTS VoiceDesign；内置 ffmpeg 7.1；无鉴权 | 【观察】08 §4/§5/§6 |
| 3D 子应用 | 4 套 Web 构建：预演工作台（77.8MB/991 文件）、fuka、pose-studio（86MB MakeHuman 包）、previz | 预演工作台 = 摆位+运镜+动作+截图/录制；fuka=符卡/故事板/运镜播放器；pose-studio=OpenPose→2D→3D lift→IK；previz=预演（工程存取未开放） | 【观察】04 §2–§5 |
| Phone Pilot | 主程序 axum + rustls，动态端口 | `/api/{health,state,frame,recording,reset}` + `/stream`(MJPEG)，`x-pilot-token` 鉴权 | 【观察】00 §3.1 |
| 云端 relay | `<预演软件 relay 地址，已隐去>`（new-api 网关） | 文本 `deepseek-v4-flash/-pro`、图像 `gpt-image-2.5`/`nano-banana`、视频 `grok-video`；编译期兜底 8444 | 【观察】00 §3.2 |

**导演台数据模型（最值得抄的契约）**【观察，07 §4；02 §7】：
- `Project{version:1,id,name,aspect,currentFrame,elements[],plans[],activePlanId,activeShotId}`；`Plan{shots[]}`；`Shot{startSec,durationSec,cameraMove,position,target,fov,rollDeg,cameraEnd,cameraKeyframes[],actions[],elementStates{}}`；`Element{kind:mannequin|crowd|box|sphere|cylinder|wall,…,poseId,joints,heightM,identitySource,characterId,performanceProfileId}`。
- 时间基准**固定 24fps 整数帧**；时长归一；撤销上限 **50** 份完整快照；校验 **16 类镜头规则 + 6 类工程规则**（越轴、碰撞、动作超时长等，中文 issue）。
- `catalog` 全量且静态/动态一致：**动作 58（8 类）/运镜 28（8 类）/人物 7/道具 10/表演气质 8**，另有姿势 12、情绪 7；模板均带默认时长/强度/位移建议。

---

## 2 可复用模块清单（含“改什么/风险/工作量”）

| 模块 | 复用方式 | 需要改什么 | 风险 | 估工 |
|---|---|---|---|---|
| **预演引擎进程** | P0：DSH Host 起子进程，二选一——a) **MCP stdio**（推荐，DSH 的 MCP 客户端直接拿到 15 工具）；b) HTTP 直连 `/api/project|command` | 设 `PREVIZ_HOME` 指到 DSH 数据目录；端口固定 4318 冲突检测；只监听 127.0.0.1；把 DSH 镜头卡与 `project.json` 做单向映射/快照 | 闭源二进制、无签名、无鉴权；`/api/agent/chat` 需 DeepSeek key 或 Codex CLI；project v1 无公开 schema；升级即可能不兼容 | PoC 1—2 人日；生产化 3—5 人日 |
| **预演前端（iframe）** | 可选：4318 托管静态页，DSH 主面板 iframe 嵌入；或 DSH 路由反代到 4318 保持同源 | 处理 `window.__TAURI__` 缺失的降级（截图/录制会退化）；CORS 白名单是 dev 5173，需同源方案；保存走 DSH 文件路由 | 嵌 Tauri 页面进浏览器有 IPC 依赖；交互与 DSH 风格割裂；仍在用闭源前端 | PoC 1—2 人日；不建议生产 |
| **3D 预演（预演工作台）** | 用开源 **DirectorDesk**（MIT）替代；预演软件 预演工作台 只作功能对照/素材参考 | DirectorDesk 是桌面向；DSH 通过“文件交换+MCP/Skill”联动（导出参考视频/深度视频/首尾帧到 DSH 任务） | 预演软件版无源码、依赖 Tauri；两者是否同源未证实；guo 资产许可不明 | 评估 0.5—1 人日；接入 3—5 人日 |
| **voice-sidecar** | P2 可选：HTTP 8765 直接调（项目/章节/抽取/铸造/合成/导出）；或只抄数据模型与切章 prompt | 需单独部署 IndexTTS-2.5 Gradio + ComfyUI Qwen3-TTS 工作流；12GB 下与 H3 串行；补鉴权 | 无鉴权、无 ASR、Py3.14 闭源包；情绪向量中文键/英文 `VEC_KEYS` 疑似 bug；与 H3 原生音频重复 | 跑通 2—3 人日；生产化 8—12 人日 |
| **节点画布（26 节点）** | 仅借鉴交互与数据模型（镜头状态机/尾帧继承/分镜切割/剧集画布），不复刻 React Flow 画布 | 把“镜头状态机 + 批量提交/通过/退回 + 尾帧继承”映射到 DSH 镜头卡与任务 | 26 节点体系与 DSH 工具模型冲突，复刻成本高 | 设计借鉴 0；若复刻 ≥15 人日（不做） |
| **资产库（14 类）** | 借鉴类型划分：character/scene/item/reference/previz/costume/accessory/weapon/voice_tone 等；DSH 资产库取子集 | DSH 资产 schema 增加 type/三视图/服装/引用计数；fuka CC0 种子导入脚本 | 资产格式多（GLB/FBX/PMA/PNG/SVG）；引用检查需自研 | 2—3 人日 |
| **浏览器录制/截图** | 借鉴 `MediaRecorder + canvas.captureStream`（24fps、1080p、12Mbps、PNG 规则）+ 落库管线 | DSH Client 面板录制预览；后端存 MP4/PNG 到 take | 浏览器编码器差异；需与 H3 输出统一转码 | 1—2 人日（低优先） |
| **校验规则** | 直接借鉴 16+6 类规则（越轴/碰撞/超时长/入地等）的实现思路与阈值 | 用我们自己的数据结构重写；中文 issue 文案可参考 | 阈值来自其白模尺度；换成真人资产需重标定 | 1—2 人日 |

---

## 3 三个关键问题的直接回答

### Q1 预演引擎进程 能否作为独立 HTTP/MCP 服务被 DSH 直接调用？
**能。**【观察+推断，07 §2/§3/§11】
- 单 exe 双形态：无参 = MCP stdio（15 个 `director_*` 工具，标准 `initialize/tools/list/tools/call`）；`--http [port]` = 本地 HTTP（默认 4318，含静态托管）。
- 动态实测已确认：`--http 4319` 可启动、`/api/health` 正常、首次 `/api/project` 懒创建 `project.json`（12,270 B）。
- 24fps、project.json、catalog（58/28/7/10/8）静态与动态严格一致，可作为契约依据。
- **iframe 直接用的可行性**：技术上可（4318 同源托管 818KB 前端，DSH iframe 指向它即可），但页面里 3 处图片/资产能力依赖 `window.__TAURI__`，纯浏览器会降级；若要“打开即用”需 DSH 侧提供保存路由并接受交互割裂。**建议 PoC 用、不进生产**。
- 必设环境：`PREVIZ_HOME`（工程目录）、可不开 `PREVIZ_WEB_ROOT`（纯 API/MCP 不需要静态页）；**不要**设 `PREVIZ_HOST=0.0.0.0`。

### Q2 voice-sidecar 能否跑/改造成本地配音服务？
**能跑，但不建议在 P1 接。**【观察，08 §4/§5/§6】
- 独立运行即 FastAPI 8765，34 path/39 操作、SQLite 7 表（projects/chapters/characters/voice_assets/lines/line_audio_versions/settings），`/openapi.json` 完整，无鉴权、仅绑 127.0.0.1，CORS 允许 5173。
- 但它本身**不做 TTS 推理**：TTS 走外部 IndexTTS-2.5 Gradio 协议（上传参考音频→`gen_single`→SSE→下载 wav），音色铸造走外部 ComfyUI Qwen3-TTS-12B/1.7B VoiceDesign 工作流；LLM 抽取默认 DeepSeek `deepseek-v4-pro`（可用 `VOICE_LLM_*` 覆盖）。内置的只有 ffmpeg 7.1 和 HTTP 编排。
- 12GB 现实：H3 生成时无法同时跑 ComfyUI Qwen3-TTS 与 IndexTTS；必须串行，增加整条链路时长。**P1 用 H3 原生音频**；P2 若需要多角色音色稳定，再考虑“本地 IndexTTS 单服务 + 串行”或云 TTS。
- 可借的设计：7 表模型、章节切分正则、LLM 抽取 prompt（12 键音色 instruct、8 情绪×4 档）、合成组（同角色同情绪连续短句合并）、SRT/CSV 台词对照表导出。

### Q3 预演软件 预演工作台 与开源 DirectorDesk 的关系？
- 开源 **DirectorDesk**：`mangfufu/预演工作台`，MIT，v0.5.2（2026-10-24），452★，桌面向（Windows/Linux），功能含白模搭景、动作/走位、时间轴、多机位、POV/变焦/手持、景深、粒子/物理、**普通参考视频 + 灰度深度视频导出**、内置 AI 助手、**本机 MCP + 配套 Skill**、插件、历史版本、自动避障、内置场景。【观察，GitHub README】
- 预演软件 **预演工作台**：Web 构建（991 文件/77.8MB），命名空间与存储键保留 `storyai-3d-预演工作台-demo`、`standalone-3d-预演工作台-*`，iframe 协议前缀 `storyai:预演工作台:*`；报告明确其资产库来自 guo/mixamo/fuka，且由预演软件主程序以 Tauri WebView 打开。【观察，04 §1/§2】
- **【推断】** 预演软件 预演工作台 与早期 `StoryAI-3D-Director-Desk` / 现 `mangfufu/预演工作台` 属同一代码谱系（命名空间残留是最强证据），但预演软件版本经过大量私有改造（guo 包、语义骨骼映射、retargetClip、二创协议、Tauri 桥）。**不是同一份可直接替换的构建**；也**未发现**预演软件 README 声明开源或保留 MIT 许可文件（其 Web 构建是否为 MIT 派生【未知】）。
- **建议**：预演主路径用开源 DirectorDesk（源码可维护、允许改造、支持深度视频，正好喂 Wan/H3 的控制需求）；预演软件 预演工作台 仅用于“功能对照 + 交互/数据模型参考”。需要预演软件式“多机位+WASD+截图落库”时，优先在 DirectorDesk 上二次开发，而不是嵌闭源构建。

---

## 4 资产库种子与许可

| 资产包 | 规模 | 许可 | 建议 | 依据 |
|---|---|---|---|---|
| fuka 道具库 | 154 GLB + 154 SVG（18.4MB），catalog 记录 source/license/author | **全 CC0-1.0**（Kenney 126、Quaternius 25、Teh_Bucket 1、3D Assets 2） | ✅ 直接种子进 DSH 资产库（道具/场景装饰） | 【观察】04 §6.4；09 §7 |
| fuka 场景模板 | 132 JSON + 132 PNG（15 组；473 墙/2355 体块/1399 道具引用） | 报告口径 **CC0-1.0** | ✅ 可种子（作为“场景卡”模板） | 【观察】04 §6.4；09 §7 |
| fuka 姿势/动作 | 111 姿势（9 类）、24 循环动作（52 关节、≈20.2fps、48 文件） | **自研资产，许可不明**【推断】 | ⚠️ 仅私下参考；要进库需确认许可或自行重制 | 【观察】04 §6.4；09 §7 |
| guo 道具包 | 180 FBX + 180 PNG（10.2MB/5.1MB） | 产品内部 mounted 包，无公开许可 | ❌ 不导入、不分发 | 【观察】04 §6.2 |
| guo 骨架模型 | 37 FBX（96/110/76/33/36/85 骨；Mixamo 命名） | 内部资产 | ❌ 不导入；用 DirectorDesk/CC0 角色替代 | 【观察】04 §2.4/§6.2 |
| guo 场景预置 | 200 pma（639 对象；XOR 0xFF JSON） | 内部资产，且 1.0.19 代码**未引用** | ❌ 不导入（也说明是预留/外部产品用） | 【观察】04 §6.1；09 §6 |
| pose-studio 栈 | VNCCS 编辑器 + MakeHuman morph 包 86MB + 12 起步姿势 | VNCCS **MIT**（AHEKOT/ComfyUI_VNCCS_Utils）+ MakeHuman **CC0**；three r160 MIT | ✅ 可复用/借鉴（OpenPose→3D lift 值得抄） | 【观察】04 §4/§6.6；09 §7 |
| three.js | r160/r180/r184/r185/r186 多版本 | **MIT** | ✅ 统一到 r18x 后使用 | 【观察】04 §9 |
| Mixamo 角色/动作 | camille/xbot/robot/soldier + 6 动作 FBX | Mixamo/Adobe 许可，来源见 SOURCES.md | ⚠️ 内部预览可用；再分发/商用需逐项核对 | 【观察】04 §6.3 |
| UE 素体 | ue-mannequin-retopology.glb | Sketchfab 下载，许可【未知】 | ⚠️ 仅测试 | 【观察】04 §2.4 |
| 预演工作台 builtin 18 低模 | 只有清单，文件缺失 | — | 不可用 | 【观察】04 §2.6 |

**结论**：只把“154 CC0 道具 + 132 CC0 场景模板”作为首批种子（约 20MB，导入成本低、许可干净）；角色/动作优先用 DirectorDesk 自带/CC0 或自建，避免 guo 包污染资产台账。

---

## 5 主 UI / 节点画布：值得复刻的 5 件事（优先级）

| 预演软件模块 | 内容 | DSH 对应 | 优先级 | 说明 |
|---|---|---|---|---|
| 镜头状态机/批量流转 | 待创建→待审核→生成中→已完成/失败；批量提交/通过/退回 | `studio_shot.status` + `studio_jobs` | **P1** | 单镜头闭环直接需要 |
| 尾帧继承 | 前一镜尾帧作为参考图传入 | 镜头卡 `continuity.firstFrame` 指向上一 take 末帧 | **P1** | 10/30 秒一致性的关键 |
| 分镜切割/故事板 | storyboardNode（导出分镜/合并/网格样式）、storyboardGenNode（行×列） | P2 新增 `studio_storyboard`（图片网格+镜头编号） | P2 | 低成本高感知 |
| 剧集画布（镜头表） | 镜头表批量通过/退回/提交、Seedance 串行生成 | P3 `studio_episode` + 批量队列 | P3 | 30 秒作品编排 |
| 审片/QC | 视觉锚、缺参考预检、过期检测、对比审片 | `studio_qc` + 审片页（P2 已有规划） | P2 | 只借“检查清单”思路 |
| 26 节点画布 / 6 Studio | 节点画布、漫画工坊、模特台、服化道、时间线等 | 不复刻 | ❌ | 与闭环无关，成本高 |
| 剧本/章节抽取 | 切章、角色/台词/情绪抽取、60 集进度 | `studio_script`（P2 规划） | P2 | 借 7 表与 prompt 设计即可 |
| 3D 预演入口 | blueprint/previz/poseStudio 节点 | `studio_previz`（v2 的 studio_blender 改名） | P1/P3 | 用 DirectorDesk 导出替代 |

---

## 6 单镜头闭环 / 10 秒 / 30 秒：接入点与改动量

| 阶段 | 预演软件可借 | DSH 接入点（v2 已有/新增） | 改动 | 新增估工 |
|---|---|---|---|---|
| **P1 单镜头** | project.json 的 Shot/Element 字段；58 动作/28 运镜/12 姿势数据（仅作参考）；白模截图；24fps 时间码 | `studio_shot` 增 `camera.elements[]`（站位/动作/机位）；`studio_previz`（P1 先文件导出，不嵌 UI） | 镜头卡加“预演字段”；预演产物路径进 take；H3 提示词加“参考视频/首帧/尾帧”来源 | 3—5 人日 |
| 预演→H3 | 白模参考视频/首帧；DirectorDesk 深度视频；fuka 动作（若许可） | ComfyUI 适配器已支持 `{{FIRST_FRAME}}/{{CONTROL_VIDEO}}`（附录 C4.1） | 只需在 DSH 增加“预演导出→资产绑定” | 1—2 人日 |
| 超分/导出 | MediaRecorder 导出参数（1080p/12Mbps）；fuka 手绘/录制思路 | `studio_post`（Real-ESRGAN/FlashVSR + FFmpeg） | 已规划 | 0（沿用） |
| **P2 10 秒（2 镜）** | 镜头状态机、尾帧继承、分镜板 | `studio_episode`（镜头顺序）、`studio_shot.continuity` | 尾帧→首帧链路；拼接/字幕 | 3—4 人日 |
| **P3 30 秒（4—6 镜）** | 剧集画布批量流转、审片对比、版本 | `studio_episode` 批量队列 + `studio_qc` + `studio_timeline`（OTIO） | 批量重试/失败隔离/成片拼装 | 5—8 人日 |
| 配音（可选） | voice-sidecar 7 表 + IndexTTS 协议 + 情绪档位 | 新增 `studio_voice`（P2/P3） | 需先部署 IndexTTS 服务；12GB 串行 | 8—12 人日 |

**总增量**：在 v2 的 8—12 周（1 人）基础上，预演接入约 +1 周；10 秒作品 +2—3 天；30 秒作品 +1 周；配音后置。**12GB 约束不变**：sidecar/浏览器不占显存，可与 H3 共存；voice/TTS 与 H3 不能并行。

---

## 7 未解 / 不能依赖的点

1. **预演引擎进程【未知】**：无公开 schema/源码；`project.json` v1 字段是观察所得；升级后兼容未知；`/api/agent/chat` 依赖外部 DeepSeek 或本机 Codex CLI（且 prompt 硬编码 20 轮工具循环），不适合作为我们唯一 Agent 通道。
2. **预演引擎进程 安全【观察】**：无鉴权、CORS 写死 dev 源、可改绑 0.0.0.0、二进制无签名；只能 loopback + 自用，禁止暴露。
3. **iframe 方案【推断】**：预演前端 依赖 `window.__TAURI__` 保存资产/读本地图；纯浏览器嵌入会降级；跨 origin iframe + CORS 需代理或同源托管。
4. **预演工作台【未知】**：与开源 DirectorDesk 是否同源未证实；预演软件 Web 构建是否保留 MIT 许可未证实；guo 资产许可不明；18 个 builtin 低模文件缺失。
5. **voice-sidecar【未知/缺陷】**：无鉴权；情绪向量可能因中文键匹配不到英文 `VEC_KEYS` 而退化（报告标“疑似缺陷，待动态验证”）；PyInstaller 包不便二次开发。
6. **资产【未知】**：fuka 111 姿势/24 动作、guo 三包、Mixamo/UE 素体的再分发/商用许可均未确认；`.previz` 正式 schema 未公开；200 个 pma 场景在 1.0.19 无代码引用。
7. **品牌/来源【未知】**：v2 曾怀疑 `<原产品官网域名>` 是另一产品（同名编程语言）；本次拆解确认安装包标识 `com.previs.copilot`、relay `<预演软件 relay 域名>`、UI 文案“预演导演台/预演配音台/预演智创镜像”，但**公司主体与“预演软件短剧漫剧平台”的品牌关系仍【未知】**，只按“预演软件 1.0.19”记录。

---

## 8 对 v2 工程规划的增量建议

1. **新增 P0.5 预演 PoC（3—5 人日）**：装开源 DirectorDesk 0.5.2 → 做一个 5 秒镜头，导出白模参考视频 + 深度视频 + 首尾帧 → 喂 H3；同时用 `预演引擎进程 --http` 做一次 catalog/工程对照（只读）。
2. **P3 的 `studio_blender` 改为 `studio_previz`**：主路径 DirectorDesk（导出视频/深度/首尾帧），Blender 作为进阶（depth/pose 序列）；预演软件 sidecar 只作对照服务，不进交付。
3. **镜头卡增加 3 个字段**：`previz`（参考视频/深度视频/首尾帧路径）、`continuity`（尾帧继承来源）、`catalogRefs`（运镜/动作模板 id，可自建一套 28+58 数据，参考其命名而非复制）。
4. **资产库 schema 增三类**：角色三视图（front/side/back）、场景模板（fuka 132）、道具（fuka 154 CC0）；导入时强制写 license 字段。
5. **来源台账新增“预演软件拆解”条目**：记录本次拆解来源、可复用结论、明确“未复制代码/未导入内部资产”；禁止 vendor 任何 exe/构建产物。
6. **P1 不排 voice**：H3 原生音频验收项（对白/环境声）已覆盖；把 voice-sidecar 放 P2 可选，先做“是否真的需要独立配音”的 A/B（H3 原生 vs IndexTTS）。

---

## 来源

- `F:\AI视频\功能拆解\预演软件\README.md`（预演软件 1.0.19 拆解总览，2026-11-04）
- `02_报告/00_总报告_功能拆解与代码提取.md`（总报告：端口/架构/数据格式）
- `02_报告/02_前端_AI导演台_预演前端.md`（三接口/28 运镜/58 动作/24fps/求值/导出）
- `02_报告/03_主UI_节点画布工作台.md`（26 节点/资产 14 类/剧本/分镜师/画布）
- `02_报告/04_内嵌3D创作子应用.md`（预演工作台/fuka/pose-studio/previz、ProjectJSON、资产与许可）
- `02_报告/07_预演引擎进程_Bun导演台.md`（进程/HTTP/MCP/15 工具/project.json/catalog/安全）
- `02_报告/08_voice-sidecar_预演配音台.md`（7 表/34 path/IndexTTS/ComfyUI/导出）
- `02_报告/09_资产库可重建格式.md`（pma/guo/fuka/许可与缺口）
- 开源 DirectorDesk：https://github.com/mangfufu/预演工作台（MIT，v0.5.2，2026-10-24 核验）
- 工程规划：`F:\AI视频\AI视频本地制作软件与DSH插件工程规划-v2.md`、`F:\AI视频\附录C-DSH插件接口与数据模型.md`
- 声明：本文为自用科研工程评估；预演软件软件著作权归原权利人，未复制/分发其代码或资产，只记录静态分析结论与复用判断。
