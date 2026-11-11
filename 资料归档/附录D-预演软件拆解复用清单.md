# 附录 D：预演软件拆解复用清单与 DSH 集成方案

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《AI视频本地制作软件与DSH插件工程规划-v2.md》《研究资料/09-预演软件拆解可复用与DSH集成.md》。
> 依据：用户拆解 `F:\AI视频\功能拆解\预演软件\`（预演软件 1.0.19，2026-11-04 归档）及 09 摘要。标注【观察】/【推断】/【未知】。
> **边界**：预演软件是闭源商业软件；本文只做**本地自用、外部对照/文件交换**的工程评估，不 vendor 其 exe/前端/资产、不复制代码/资源、不绕过授权。是否使用其拆解代码/资产由你与律师决定；工程默认"不 vendor、只对照"。

## D1. 结论（先看）

| 项 | 结论 |
|---|---|
| **预演引擎进程** | 能独立跑（HTTP 4318 / MCP stdio，15 工具），但**只做 P0 只读对照**，不进生产；不 iframe `预演前端`、不 vendor |
| **3D 预演主路径** | **DirectorDesk（MIT，v0.5.2）**：外部桌面应用 + 文件交换（参考视频/深度/首尾帧）→ H3；DSH 只做"打开/导入/绑定" |
| **voice-sidecar** | 能独立跑（8765，34 path/7 表），但 TTS 依赖外部 IndexTTS/ComfyUI，12GB 与 H3 冲突；**P1 不接，用 H3 原生音频**；P2/P3 再评估 |
| **资产** | 只种子 **fuka 154 CC0 道具 + 132 CC0 场景模板**；guo 三包/fuka 姿势动作/Mixamo/UE 素体一律不导入、不分发 |
| **节点画布/6 Studio** | **不复刻**；只借 5 个交互：镜头状态机、尾帧继承、分镜切割/故事板、剧集镜头表、审片对比 |
| **来源** | 拆解只读、未复制；台账登记"预演软件拆解"条目；不进公开分发包 |

## D2. 预演软件 1.0.19 关键事实（可采信）

| 组件 | 形态/端口 | 事实 | 来源 |
|---|---|---|---|
| 主程序 | Tauri 2.11.2 / Rust / WebView2 | 内嵌多套 SPA（2197 资产/224MB）、SQLite `projects.db`、License 一机一码、云端 relay `<预演软件 relay 域名>` | 【观察】00 §2/§3/§8 |
| 预演引擎进程 | Bun 1.3.14 单文件；HTTP 4318 / MCP stdio | 无参=MCP stdio（`previs-engine@0.2.0`，15 个 `director_*` 工具）；`--http [port]` 起 HTTP；托管 `预演前端`；工程 `PREVIZ_HOME/project.json+history.json`（50 步） | 【观察+实测】07 |
| 预演前端 | 818KB React/Vite，4318 同源 | 三接口：`GET /api/project`、`POST /api/command`、`POST /api/agent/chat`；900ms 轮询；无 SSE/WS；依赖 `window.__TAURI__` 保存资产 | 【观察】02/07 |
| voice-sidecar | PyInstaller + CPython 3.14.2；FastAPI 8765 | 34 path/39 操作；SQLite 7 表；章节导入→LLM 抽取→音色铸造（ComfyUI Qwen3-TTS）→TTS（IndexTTS-2.5）→队列→MP3/WAV/CSV/SRT；内置 ffmpeg 7.1；无鉴权 | 【观察】08 |
| 3D 子应用 | 4 套静态 SPA：预演工作台 / fuka / pose-studio / previz | three r160–r186；资产 200 pma/111 姿势/24 动作/154 CC0 道具/37 骨架；MediaRecorder 导出；Tauri 桥落库 | 【观察】04 |
| 主 UI | React 18 + React Flow；7.25MB bundle | 26 种画布节点、6 Studio、157 IPC、资产 14 类、剧本/漫画/模特/分镜工作台 | 【观察】03 |
| 数据 | project.json v1 | 24fps 整数帧、Plan/Shot/Element/Action/MotionKF/CameraKF、16+6 校验、50 步撤销 | 【观察】07/02 |
| 目录 | catalog | 动作 58（8 类）/运镜 28（8 类）/人物 7/道具 10/表演 8；姿势 12、情绪 7 | 【观察+实测】07 |

## D3. 复用矩阵

| 模块 | 复用方式 | 需要改什么 | 风险 | 估工 | 阶段 |
|---|---|---|---|---|---|
| **预演引擎进程** | P0：DSH Host 起子进程，HTTP `/api/project|command` 或 MCP stdio 只读 | 设 `PREVIZ_HOME` 到临时目录；端口冲突检测；只 127.0.0.1；不设 `0.0.0.0` | 闭源/无签名/无鉴权；project v1 无公开 schema；升级不兼容 | PoC 1—2 人日 | P0.5 |
| **预演前端** | 仅 PoC iframe/新窗口 | 处理 `__TAURI__` 缺失；CORS 5173 写死；导出走浏览器下载 | Tauri 桥/交互割裂/闭源前端 | 1—2 人日 | 仅 PoC，不进生产 |
| **DirectorDesk（开源）** | **主路径**：外部桌面 + 文件交换 | 安装；导出参考视频/深度/首尾帧；DSH 导入并绑定镜头 | 桌面应用；导出版本变化；MCP/Skill 协议需核对 | 评估 0.5—1；接入 3—5 人日 | P0.5/P2 |
| **3D 子应用** | 只作功能/交互对照 | 不导入、不 iframe | Tauri 依赖、许可不明 | 0（只读） | — |
| **voice-sidecar** | P2/P3 可选：HTTP 8765 外部服务；或参考其流水线重写 | 部署 IndexTTS-2.5 + ComfyUI Qwen3-TTS；12GB 串行；补鉴权 | 无鉴权/闭源包/情绪向量疑似 bug | 跑通 2—3；生产 8—12 人日 | P2/P3 |
| **资产库** | 参考 14 类 → DSH 子集；只导入 fuka CC0 | 建资产 schema、三视图、引用计数；CC0 导入脚本 | 格式多；许可字段必须写 | 2—3 人日 | P2/P3 |
| **录制/截图** | 复用思路：MediaRecorder + captureStream（1080p/12Mbps/24fps） | DSH Client 录制预览；后端存 MP4/PNG | 浏览器编码差异；统一转码 | 1—2 人日 | 低优先 |
| **校验规则** | 借鉴 16+6 规则（越轴/碰撞/超时长/入地等） | 用 DSH 数据结构重写；阈值按真人资产重标定 | 白模尺度差异 | 1—2 人日 | P2 |
| **26 节点/6 Studio** | 只借 5 件事 | 镜头状态机/尾帧继承/分镜板/剧集镜头表/审片 | 与 DSH 工具模型冲突，不全做 | 设计 0；复刻 ≥15 人日（不做） | P1/P2/P3 逐步 |

## D4. 关键契约

### D4.1 预演引擎进程 HTTP/MCP

- 启动：`预演引擎可执行文件 --http 4318`；健康 `GET /api/health` → `{ok,service:"previs-engine",transport:"http"}`。
- `GET /api/project` → 裸 State `{project,runtime,catalog,health,agent_rules}`；`POST /api/command {name,arguments}` → `{ok,result}`；`POST /api/agent/chat {messages}` → `{ok,result:{message,commands,state}}`（需 DeepSeek key 或 Codex CLI，不建议依赖）。
- MCP stdio：15 工具 `director_get_state/create_project/select/add_element/update_element/apply_action/set_motion_keyframe/apply_camera/set_camera_keyframe/manage_shot/set_lock/delete/undo/redo/validate`。
- 工程：`Project{version:1,id,name,aspect,currentFrame,elements[],plans[],activePlanId,activeShotId}`；Plan/Shot/Element/Action/KF 字段见 07 §4；固定 24fps；50 步历史；16+6 校验。

### D4.2 镜头卡映射（建议）

```text
DSH ShotCard                    Director Project/Shot
id/name                     ↔    shot.id/name
duration                    →    Shot.durationSec
camera.description          →    cameraMove（28 模板）
description/action          →    Element/Action（58 模板）
subjects[]                  →    Element{kind:mannequin,characterId,poseId,heightM}
refs.previz                 ←    frame/video/depth 导出
continuity.firstFrame       ←    上一 take 末帧/previz 首帧
```

- 单向：DSH 生成 director 工程（可选）或用户手动搭景；**读回只用于参考**，不双向同步（避免状态冲突）。
- P2 文件交换：`data/previz/<shotId>/{ref.mp4,depth.mp4,first.png,last.png,director.project.json}`；`studio_previz.import` 写 `shot.refs.previz`。

### D4.3 voice-sidecar（可选）

- 34 path 摘要：projects/chapters/lines/import/extract/characters/cast/upload/confirm/synthesize/regenerate/revert/queue/export/settings/health；7 表；输出 MP3/WAV/CSV/SRT。
- 依赖：LLM（DeepSeek 默认，可覆盖）、ComfyUI Qwen3-TTS VoiceDesign、IndexTTS-2.5 Gradio；无 ASR。
- 接入：若 P2 做，DSH `studio_voice` 代理 HTTP；数据目录设 `PREVIZ_DATA_DIR` 到 `data/voice`；导出后绑定 `shot.audio`；12GB 与 H3 串行。
- 可借设计：7 表模型、切章正则、12 键音色 instruct、8 情绪×4 档、合成组合同角色同情绪、SRT/CSV 对照。

## D5. 资产与许可

| 资产 | 规模 | 许可 | 处理 |
|---|---|---|---|
| fuka 道具 | 154 GLB + SVG（18.4MB） | **CC0-1.0**（Kenney 126/Quaternius 25/Teh_Bucket 1/3D Assets 2） | ✅ 种子导入；写 license |
| fuka 场景模板 | 132 JSON + PNG | **CC0-1.0** | ✅ 种子导入 |
| fuka 姿势/动作 | 111 姿势 / 24 clip | 自研、许可不明【推断】 | ⚠️ 仅私下参考；不入库 |
| guo 道具/骨架/场景 | 180 FBX / 37 FBX / 200 pma | 内部资产、无公开许可 | ❌ 不导入、不分发 |
| pose-studio | VNCCS + MakeHuman | VNCCS MIT + MakeHuman CC0 | ✅ 技术参考/可选 |
| three.js | r160–r186 | MIT | ✅ 统一 r18x |
| Mixamo/UE 素体 | 角色/动作 | 逐项未确认 | ⚠️ 仅测试，不导入 |

## D6. 落地步骤

1. **P0.5（3—5 人日）**：装 DirectorDesk v0.5.2；导一个 5 秒白模参考视频 + 深度视频 + 首尾帧；DSH 手工导入并喂 H3；同时 `预演引擎进程 --http` 只读对照 catalog/工程（不 iframe、不 vendor）。
2. **P2（3—5 人日）**：`studio_previz` 实现"打开 DirectorDesk / 扫描导出目录 / 绑定镜头"；镜头卡加 `previz/continuity` 字段；H3 工作流占位符接首尾帧/控制视频。
3. **P3（5—8 人日）**：30 秒多镜；可选 voice；CC0 资产导入；审片/批量。
4. **来源台账**：记录"预演软件拆解（只读，未复制）"、DirectorDesk MIT、CC0 资产；禁止 vendor 预演软件 exe/前端/资产。

## D7. 未解/不能依赖

1. 预演引擎进程 无源码/无签名/无鉴权；project v1 无公开 schema，升级兼容未知；`/api/agent/chat` 依赖 DeepSeek/Codex，不适合唯一 Agent 通道。
2. 预演前端 依赖 `window.__TAURI__`，纯浏览器降级；CORS 写死 5173；iframe/导出不建议生产。
3. 预演软件 预演工作台 与开源 DirectorDesk 同谱系但非同一构建（`storyai-3d-预演工作台-*` 残留）；预演软件 Web 构建是否保留 MIT 未证实。
4. voice-sidecar 情绪向量中文键 vs 英文 `VEC_KEYS` 疑似缺陷；无 ASR；TTS 外部依赖重。
5. 资产许可：fuka 姿势/动作、guo 三包、Mixamo/UE 素体均未确认；`.previz` schema 未公开；200 pma 在 1.0.19 无代码引用。
6. 品牌/主体：安装包 `com.previs.copilot`、relay `<预演软件 relay 域名>` 已确认；公司主体与"预演软件短剧漫剧平台"关系仍【未知】；`<原产品官网域名>` 是编程语言，不是视频官网。

---

*本文是自用科研工程评估，不构成法律意见；不复制/分发预演软件代码或资产。*
