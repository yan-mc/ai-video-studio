# AI 视频本地制作软件 + DSH 插件：工程规划 v2.1（整合预演软件/节点动画软件/视频增强软件拆解）

> 注：本文件为历史归档，其中的软件名已中性化处理。

| 项目 | 说明 |
|---|---|
| 版本 | v2.1（2026-11-05；文件名保留 v2 兼容） |
| 状态 | **仅工程规划，不写程序**；PoC 插件早已卸载 |
| 已锁定 | ① OpenCineAgent 为 AI 流水线底盘；② 本地 H3 为主；③ 当前 RTX 4080 Laptop 12GB，未来换魔改卡；④ 先单镜头闭环，10/30 秒内作品算成功；⑤ DSH Web 主面板；⑥ 许可证工程阶段不阻塞、完工后审计 |
| 新增依据 | 用户拆解：`F:\AI视频\功能拆解\预演软件\`（预演软件 1.0.19）、`节点动画软件\`、`视频增强软件\`；研究：`研究资料/09`、`10`；核查：`闭源软件真实性核查-2026-11-04.md` |
| 配套 | 附录 A（开源许可证）、B（闭源功能）、C（接口/数据模型）、**D（预演软件拆解复用）**、**E（节点动画软件/视频增强软件借鉴）**、`00-方案总览与索引.md` |

---

## 0. v2 → v2.1 变更摘要

1. **预演软件已由你的拆解证实为真实产品**（预演软件 1.0.19），不再是"待核实"。它的架构几乎就是本项目要做的形态：**Tauri 外壳 + 主 UI 节点画布 + director/voice 两个本地 sidecar + 4 套 3D 子应用 + 资产库**。DSH 插件可以把它当**现成蓝图 + 可选外部服务**，不必从零造 3D/配音/画布。
2. **方案升级为"双底座"**：
   - **OpenCineAgent** 负责 AI 生成流水线（剧本→镜头→身份→关键帧→H3→QC→成片）；
   - **预演软件拆解** 负责制作层能力（3D 预演/机位、配音台、资产库、节点画布 UX、录制导出）；
   - **ComfyUI/H3** 负责本地生成；DSH 负责项目/任务/UI/Agent。
3. **3D 预演主路径用开源 DirectorDesk（MIT），预演软件 sidecar 只做 P0 只读对照**：预演软件 `预演引擎进程`（HTTP 4318 + MCP + 15 工具）能在 P0 快速验证"白模/机位/动作/参考视频"能力，但其 iframe 依赖 Tauri、无鉴权、闭源、导出走浏览器下载，**不进生产**。主路径改为 **DirectorDesk 0.5.2（MIT）**：白模搭景/多机位/运镜/参考视频+深度视频/首尾帧导出，DSH 通过"打开 + 导入文件"联动；Blender 作兜底。P1 仍不做 3D，M0.5 先做预演 PoC。
4. **配音/资产/画布**：`voice-sidecar`（8765，34 API）仅作 P2/P3 可选配音参考；资产只种子 **fuka 154 CC0 道具 + 132 CC0 场景模板**，guo/pma/姿势/动作不导入；节点画布（26 节点/6 Studio）只做 UX 参考，P3 再做交互子集。
5. **后处理页吸收视频增强软件的方法论**：89 模型目录的 schema、14 预设分节、tiling/显存估算、55 编码器矩阵；模型本身用 SeedVR2/FlashVSR/Real-ESRGAN/RIFE 替代。
6. **动效页吸收节点动画软件的方法论**：声明式节点/408 JS API/MCP 工具模式/信息图节点；不自研 V8+Skia 引擎，用 Remotion/Blender/FFmpeg 做子集。
7. **许可证**：工程阶段继续不阻塞；所有拆解代码/资产/模型来源登记，完工后按附录 A/D/E 审计。

---

## 1. 目标与成功标准

### 1.1 总目标

一个 **DSH Web 插件**：在 DSH 主面板里完成"项目→镜头卡→H3 提示词→本地 H3 生成→（可选 3D 预演/配音）→QC→超分→成片"；Agent 与人类共用数据；生成/预演/配音都在外部服务，DSH 不加载模型。

### 1.2 分阶段验收

| 阶段 | 成功标准 |
|---|---|
| **P1 单镜头** | 镜头卡→H3 提示词→本地 H3（12GB profile）→5 秒视频→预览→2× 超分→1080p 导出；全程 DSH 面板；记录模型/seed/参数 |
| **P2 10 秒** | 2 镜×5 秒；角色/风格一致；H3 原生音频；可选 3D 预演参考帧；拼接/字幕/AI 标识；12GB ≤60 分钟 |
| **P3 30 秒** | 4—6 镜；至少 2 角色；场景锚点；逐镜 QC；可选配音；1080p；12GB ≤2—3 小时或云端兜底 ≤1 小时 |
| **P4 制作台增强** | 3D 预演（DirectorDesk；预演软件 sidecar 仅 P0 对照）、资产库、后处理页、动效页、批量/成本/来源台账 |

> **30 秒不是 H3 单次生成**：H3 单次 5—10 秒，30 秒 = 4—6 镜拼接。

### 1.3 质量指标

- 默认 480p 草稿（12GB）+ 超分 1080p 交付；未来 16GB+ 可 768p 直出再超分。
- 记录模型文件/LoRA/步数/flow_shift/seed/分辨率/时长/输入哈希/最终提示词。
- 12GB 现实：5 秒 480p 约 3—6 分钟；10 秒约 8—15 分钟（待实测）；768p 不纳入 P1 主路径。

---

## 2. 硬件与后端（不变，补 12GB 约束）

| Profile | 显存 | H3 模型/精度 | 分辨率/时长 | 步数 | 5 秒耗时 | 用途 |
|---|---|---|---|---|---|---|
| P12-draft | 12GB | H3 GGUF Q4/Q5 或 DiffSynth NF4 | 480p | 8 步 Turbo | 约 3—6 分钟 | 当前主力 |
| P12-long | 12GB | 同上 | 480p/10 秒 | 8 步 | 约 8—15 分钟 | 10 秒单镜 |
| P16-std | 16GB | int8 pruned + TE offload | 768p | 8 步 | 约 3—5 分钟 | 未来 16GB 卡 |
| P24-quality | 24GB | int8/FP8 | 768p/10 秒 | 8—20 步 | 约 5—10 分钟 | 未来 24GB 卡 |
| cloud-fallback | — | H3 API/云 GPU | 768p/10 秒 | — | 约 1—3 分钟 | 超时/超规格兜底 |

- 12GB 串行：关键帧→H3→超分→QC，不并行；笔记本注意热降频。
- 预演软件 sidecar 只在 P0 对照时运行（CPU/浏览器侧，不占 H3 显存）；voice-sidecar 只做编排，TTS 模型可外部；P2/P3 若用 voice，与 H3 串行。
- 视频增强软件类模型不可移植；12GB 超分用 SeedVR2-3B int8/Real-ESRGAN，补帧用 RIFE/FILM，4K 走云。

---

## 3. 双底座架构

### 3.1 总图

```
┌──────────────────────────── DSH Web 主面板 ────────────────────────────┐
│ 项目/镜头卡/提示词/任务/预览/审片/后处理/预演/配音/资产/设置            │
│  ├─ 原生面板：项目/镜头/任务/后处理/QC/来源台账                          │
│  └─ 外部窗口（可选）：DirectorDesk 预演/导出；预演软件 sidecar 仅 P0 对照    │
└───────────────▲──────────────────────────────────────┬─────────────────┘
                │ HTTP/JSON                             │ spawn/health
┌───────────────┴──────────────┐          ┌─────────────▼──────────────┐
│ DSH Host 插件                 │          │ 本地服务管理器              │
│  studio_* 工具/队列/适配器    │          │  DirectorDesk（外部桌面）   │
│  OpenCineAgent sidecar 客户端 │          │  voice-sidecar（P3 可选）   │
│  ComfyUI/SGLang/FFmpeg 客户端 │          │  OpenCineAgent (Python)    │
└───────────────▲──────────────┘          └─────────────┬──────────────┘
                │                                       │
┌───────────────┴──────────────┐          ┌─────────────▼──────────────┐
│ ComfyUI（H3/Wan/SDXL/超分）   │          │ 预演软件 3D 子应用/资产库      │
│ FFmpeg/SeedVR2/RIFE          │          │ DirectorDesk（MIT）/Blender│
└──────────────────────────────┘          └────────────────────────────┘
```

### 3.2 预演软件拆解：可直接用的部分（重点）

> 证据：`F:\AI视频\功能拆解\预演软件\02_报告\00、02、03、04、07、08、09`；详细清单见附录 D。

| 模块 | 事实（观察） | 复用方式 | 对 DSH 的价值 |
|---|---|---|---|
| **预演引擎可执行文件** | Bun 1.3.14 单文件；`--http 4318` + MCP stdio；15 个 `director_*` 工具；24fps；project.json+history.json（50 步）；58 动作/28 运镜/7 人物/10 道具/8 表演；16+6 校验 | **P0 只读对照/验证**（不进生产、不 vendor）；如需可接 MCP 给 Agent 读状态 | 快速验证"白模/机位/动作/参考视频"；不进交付链路 |
| **预演前端（iframe，仅 PoC）** | 818KB React/Vite；三接口 `/api/project|command|agent/chat`；900ms 轮询；依赖 `window.__TAURI__` 保存资产 | **仅 PoC**；CORS/iframe/导出降级风险 | 参考 UI/交互；不进生产 |
| **voice-sidecar.exe** | PyInstaller/Python 3.14.2；FastAPI 8765；34 path/39 操作；7 张表；章节导入→LLM 抽取→音色铸造→IndexTTS→队列→MP3/WAV/CSV/SRT 导出 | **直接运行（P3 可选）**；iframe 仅 PoC，不进生产 | 配音/有声剧/对白；与 H3 原生音频二选一或补录 |
| **3D 子应用**（预演工作台/fuka/pose-studio/previz） | 静态 SPA；three r160—r186；资产 200 pma/111 姿势/24 动作/154 CC0 道具/37 骨架；浏览器 MediaRecorder 导出 | **只作功能/数据对照**；不导入、不 iframe（Tauri 桥/许可不明）；资产只用 fuka CC0 | 白模/动作/姿势的交互参考；资产库只种子 CC0 |
| **主 UI 节点画布** | React Flow 26 节点；6 Studio；157 IPC；资产 14 类；剧本/漫画/模特/分镜工作台 | **UX/信息架构参考**，P3 做 8—12 节点子集 | "制作软件"感的工作台；不建议全量复刻 |
| **录制/导出** | 前端 MediaRecorder + captureStream；720p/1080p、30/60fps；PNG/MP4 | **复用思路**；在 DSH 面板/iframe 里用同样方式 | 预演参考视频/截图 |
| **云端 relay/模型矩阵** | 预演软件主 AI 通道是云端 new-api（deepseek/gpt-image/nano-banana/grok-video/即梦/Seedance 等） | **不复用**；我们本地 H3 为主 | 避免云端绑定/费用/隐私 |
| **License/授权/设备** | 一机一码、ECDH/Ed25519/AES、JWT | **不复用** | 我们不依赖其授权 |

### 3.3 3D 预演接入方案（P0.5 PoC + P2 主路径）

**主路径：开源 DirectorDesk（MIT，`mangfufu/预演工作台`）**
- 版本/许可：MIT；v0.5.2（2026-10-24，452★）；Windows/Linux 桌面安装包；源码可维护。
- 已核实功能：白模搭景、人物/动物/道具、走位/动作、时间轴、多机位、POV/变焦/手持/景深、粒子/物理、**普通参考视频 + 灰度深度视频导出**、内置 AI 助手、本机 MCP + 配套 Skill、插件/历史版本/自动避障/内置场景。
- 与 DSH 的联动（不做进程内嵌、不做 iframe）：
  1. DSH 镜头卡"预演"按钮 → 打开 DirectorDesk（外部桌面应用）；
  2. 用户/Agent 在 DirectorDesk 搭景、机位、导出参考视频/深度视频/首尾帧到 `data/previz/<shotId>/`；
  3. DSH `studio_previz` 导入这些文件，写入 `shot.refs.previz = {video, depth, firstFrame, lastFrame, projectFile}`；
  4. H3 生成时把首帧/尾帧/深度/参考视频映射到 ComfyUI 工作流占位符（`{{FIRST_FRAME}}/{{LAST_FRAME}}/{{CONTROL_VIDEO}}`）。
- 可选 MCP：DirectorDesk 自带本机 MCP + Skill；DSH 可作为 MCP 客户端连接（若版本/协议匹配），但**文件交换是主契约**，MCP 只作增强。
- 工作量：评估 0.5—1 人日；接入 3—5 人日（09 估算）。

**P0.5 只读对照：预演软件 `预演引擎进程`（不生产）**
- 目的：快速验证"白模/机位/动作/参考视频"能力与模板/校验规则；只读 `/api/project`、`/api/command`，或 MCP stdio 读状态。
- 启动：`预演引擎可执行文件 --http 4318`；`PREVIZ_HOME` 指向临时目录；只监听 127.0.0.1；不设 `0.0.0.0`。
- 不做：不 iframe `预演前端`（依赖 `window.__TAURI__`、CORS 写死 5173、交互割裂、导出走浏览器下载）；不 vendor exe/前端；不进交付仓库/分发包。
- 产出：对照报告（catalog 58/28/7/10/8、project.json v1、24fps、16+6 校验、与 DirectorDesk 的差异），供镜头卡字段设计参考。

**兜底：Blender + BlenderMCP**
- 需要 depth/canny/pose 序列或复杂运镜时用；P3 以后。

**决策**：P0.5 用 DirectorDesk 跑一个 5 秒白模参考 + 深度视频 + 首尾帧 → 喂 H3；预演软件 sidecar 只做只读对照；**P1 不做 3D**，P2 接 DirectorDesk 文件交换。若 DirectorDesk 导出/稳定性不达标，再评估预演软件 sidecar 或 Blender。

### 3.4 OpenCineAgent 适配（保留 v2 方案）

- **Python sidecar + HTTP/JSON**，不整体搬进 Node：
  - `/health /models /render-shot /render-project /qc /assemble /jobs /cancel`；
  - 内部保留 14-agent、ComfyUI client、QC、assembly；DSH 管项目/镜头/任务/UI。
- 改造 10 项：CLI→FastAPI、state→DSH 映射、模型 manifest（GGUF/NF4）、Krea2→SDXL/FLUX、Ollama→DSH Agent、QC 轻量化、profile 化、进度事件、成片、依赖打包；约 **4—5 人月**。
- P1 不接；P2 接 `/render-shot`；P3 接 `/render-project`；P4 可选把编排上移 DSH。

### 3.5 双底座数据流

```text
DSH ShotCard
  ├─(P1) studio_prompt → studio_generate → ComfyUI H3 → preview/upscale → DSH Take
  ├─(P2) studio_previz → DirectorDesk → frame/video/depth → shot.refs.previz → H3 first/last frame/control
  ├─(P2) studio_pipeline → OpenCineAgent /render-shot → take + qc_report
  ├─(P3) studio_voice → 预演软件 voice / 本地 TTS → shot.audio
  └─(P3) studio_post → SeedVR2/FFmpeg/OpenCineAgent assembly → master
```

- 单一事实源：DSH 项目/镜头库；OpenCineAgent/DirectorDesk 只做执行/参考；预演软件 sidecar 仅 P0 对照；导出物回写 `data/takes`。
- 幂等键：`shotId+version+promptHash+profile`；重启可恢复。

### 3.6 资产库种子（P2/P3）

- **只导入 CC0 的 fuka 资产**：154 个 GLB 道具 + 132 个场景模板 JSON（Kenney/Quaternius 等，约 20MB）；导入时强制写 `license` 字段。
- **不导入**：guo 180 道具/200 pma 场景/37 骨架（预演软件内部资产、无公开许可，且 200 pma 在 1.0.19 无代码引用）；fuka 111 姿势/24 循环动作（自研、许可不明，仅私下参考）；Mixamo/UE 素体（逐项许可未确认）。
- **可借鉴/参考**：pose-studio 的 VNCCS（MIT）+ MakeHuman（CC0）、three.js（MIT）；仅用于技术验证，不随插件分发。
- 方案：P2 先做 `studio_asset`（角色三视图/场景/道具/音频，参考预演软件 14 类取子集）；P3 做 `studio_asset_import` 导入 fuka CC0；`.pma` 仅在私下研究时转换，不入库/不分发。
- 来源台账：预演软件拆解条目记录"未复制代码/未导入内部资产"；CC0 资产记录来源/作者/许可。

---

## 4. DSH 插件工程结构（更新）

### 4.1 工具

| 工具 | 作用 | 阶段 |
|---|---|---|
| `studio_project` / `studio_shot` / `studio_prompt` | 项目/镜头卡/提示词 | P1 |
| `studio_generate` / `studio_jobs` | H3/ComfyUI 任务 | P1 |
| `studio_post` | 超分/补帧/转码/拼接/字幕 | P1/P2 |
| `studio_qc` | 文件/身份/SSIM/Whisper | P2 |
| `studio_previz` | DirectorDesk 文件交换：打开/导入参考视频/深度/首尾帧；预演软件 sidecar 只读对照 | P0.5/P2 |
| `studio_pipeline` | OpenCineAgent：render-shot/render-project/qc/assemble | P2/P3 |
| `studio_voice` | 预演软件 voice / 本地 TTS：项目/角色/合成/导出 | P3 |
| `studio_asset` / `studio_asset_import` | 资产库/导入预演软件 CC0 资产 | P2/P3 |
| `studio_timeline` | OTIO/FFmpeg 成片 | P3 |
| `studio_provenance` / `studio_config` | 台账/配置 | P1/P4 |

### 4.2 页面

- 项目/镜头卡、任务、QC、后处理、预演（DirectorDesk 外部）、配音（可选）、资产、设置、来源台账。
- P1 只做项目/镜头/任务/预览/导出；后处理页 P2；预演/配音/资产 P2/P3。

### 4.3 服务管理器

- 启动/停止/健康检查：OpenCineAgent（P2/P3）、voice-sidecar（P3 可选）、ComfyUI（外部）；预演软件 预演引擎进程 仅 P0 对照时临时启动。DirectorDesk 为外部桌面应用，不纳入服务管理。
- 端口冲突/崩溃/重启策略；日志目录；不把 sidecar 暴露到 0.0.0.0。
- 所有外部服务调用走 DSH Host，Client 不直连（外部桌面应用/预演导入除外）。

---

## 5. 单镜头闭环（P1，不变）

流程：新建项目→镜头卡→编译提示词→预检（ComfyUI/模型/显存/磁盘）→提交 H3→轮询→预览→超分→导出+记录。
12GB 初始参数：480p、5 秒（124 帧）、H3 GGUF Q4/Q5 或 DiffSynth NF4、8 步 Turbo、flow_shift 6、CFG=1、串行、单镜超时 15 分钟。
验收清单同 v2：提示词无悬空标签、视频含音频、超分 1080p、记录完整、失败可重试、全程 DSH 面板。

---

## 6. 10 秒/30 秒作品（更新）

- **10 秒**：2 镜×5 秒；角色卡+场景卡；可选预演软件预演参考帧；H3 原生音频；FFmpeg 拼接/字幕/AI 标识；≤60 分钟。
- **30 秒**：4—6 镜；至少 2 角色；场景锚点；逐镜 QC；可选配音（预演软件 voice 或本地 TTS）；拼接/混音/字幕；≤2—3 小时或云端兜底。
- 连续性：同一角色参考图（2—4 张）/同风格/尾帧→首帧；预演机位作为构图参考；每镜单独生成，不追 30 秒单次。
- 降级：12GB 超时/OOM→降 480p/短时长/换 seed；仍失败→云端 H3（需你确认预算）。

---

## 7. 里程碑（约 9—11 周）

| 阶段 | 周 | 内容 | 交付 |
|---|---|---|---|
| M0 环境/基准 | 1 | 12GB H3 基准（5s/10s/768p 试）、ComfyUI/模型/超分、DirectorDesk 试装与 5 秒预演导出、预演软件 sidecar 只读对照 | 基准报告 + 预演导出样例 |
| M1 单镜闭环 | 2—3 | DSH 项目/镜头/提示词/生成/任务/预览/超分 | P1 验收 |
| M2 10 秒 | 4—5 | 角色卡/资产、2 镜、QC、拼接/字幕 | 10 秒成片 |
| M2.5 预演/后处理 | 6—7 | `studio_previz` 导入 DirectorDesk 参考视频/深度/首尾帧；后处理页（SeedVR2/RIFE/编码器预设） | 预演→H3 控制链路 + 后处理页 |
| M3 30 秒/资产 | 8—9 | 4—6 镜、连续性、OpenCineAgent sidecar、CC0 资产导入、可选配音 | 30 秒成片 |
| M4 稳定/审计 | 10—11 | 错误恢复/成本/安全、来源台账审计、文档 | v1 交付 + 审计报告 |

> 若 DirectorDesk 导出/稳定性不达标，M2.5 切 Blender 或预演软件 sidecar 对照，时间不变。

---

## 8. 测试（新增）

- 12GB 基准：H3 480p/5s、480p/10s、768p 试；超分；温度/显存；连续 5 条。
- 预演软件 sidecar 只读对照：`/api/health`、`/api/project`、`/api/command`、catalog/校验差异；不测 iframe/生产集成。
- DirectorDesk：安装、5 秒白模参考/深度/首尾帧导出、文件命名与导入 DSH；H3 控制视频映射。
- 后处理：SeedVR2-3B int8/Real-ESRGAN/RIFE 的耗时/显存/接缝；编码器（H264/HEVC/ProRes）输出校验。
- 资产导入：CC0 道具/姿势/动作/pma 转换；引用检查。
- 任务恢复：ComfyUI/sidecar 重启；幂等重试。
- 来源台账：每个拷贝/运行的外部组件 100% 记录。

---

## 9. 风险（更新）

| 风险 | 对策 |
|---|---|
| 预演软件 sidecar 闭源/无鉴权 | 只做 P0 只读对照，不进生产、不 vendor；仅 127.0.0.1 |
| DirectorDesk 是外部桌面应用 | 文件交换为主；DSH 只做打开/导入；导出格式变化需适配 |
| sidecar 无鉴权/端口 | 仅 127.0.0.1；DSH 服务管理器；不暴露 LAN |
| 预演软件资产许可不明 | 只用 CC0/MIT 资产；guo 内部资产不随插件分发；台账 |
| 12GB 串行/热降频 | profile 降级、分镜、云端兜底、温度监控 |
| OpenCineAgent 假设不匹配 | sidecar 包装 + 改造清单；P1 绕过 |
| 视频增强软件/节点动画软件闭源 schema | 只参考字段/交互，重写；不拷贝 QML/节点定义/预设 |
| DSH 插件 API 演进 | 薄适配层、固定版本、测试 |

---

## 10. 需要你拍板

1. **3D 预演路线**：主路径 DirectorDesk（MIT，推荐）；预演软件 sidecar 只做 P0 只读对照；Blender 兜底。是否接受？
2. **资产**：只导入 fuka 154 CC0 道具 + 132 场景模板；guo/fuka 动作不导入。是否接受？
3. **配音**：P1 用 H3 原生音频；P2/P3 是否做？预演软件 voice-sidecar 还是本地 TTS（CosyVoice/IndexTTS）？
4. **节点画布**：只借 5 个交互（镜头状态机/尾帧继承/分镜切割/剧集镜头表/审片），不复刻 26 节点。是否接受？
5. **后处理**：P2 是否要 SeedVR2-3B int8（12GB，较慢）还是先用 Real-ESRGAN/FlashVSR？
6. 硬件细节：内存/磁盘/未来魔改卡 VRAM；云端兜底预算。

---

## 11. 下一步

1. 你拍板上面的路线；
2. 我先做 **M0**：12GB H3 基准 + DirectorDesk 5 秒预演导出 + 预演软件 sidecar 只读对照（不写业务代码）；
3. M1 再写 DSH 插件单镜闭环；
4. M4 完工后按附录 A/D/E 做许可证审计。

---
