# 6. 自建制作软件：基于 DSH 或其他开源项目怎么改造

> 结论先说：**能。** DSH 适合做"上层制作软件 + Agent 编排层"，ComfyUI/H3 做"生成渲染层"，Blender MCP 做"3D 预演层"，三者用 HTTP/MCP/文件系统拼起来。**不要自研模型、不要自研 3D 引擎**，把精力放在"镜头数据模型 + 提示词编译 + 任务队列 + 审片"上。

## 6.1 DSH 能提供什么（为什么适合做"制作软件外壳"）

DSH（DeepSeek Harness）本身是一个 **Agent Harness**：Cordis 插件体系 + Host 服务 + Client UI 插槽 + 工具注册 + MCP + 工作流引擎。对"制作软件"而言，可直接复用的能力：

| DSH 能力 | 对制作软件的价值 |
|---|---|
| **Client 插槽体系**（侧边栏 panel 图标、主面板 keyed slot、设置页、浮层/Toast） | 注册一个"视频工作室"侧栏入口 + 独立主面板（项目/分镜/生成/审片），不用从零写桌面应用 |
| **Host 服务与工具注册**（`tools.register`） | 把"生成视频/查询任务/渲染预演/对比 QC"做成 Agent 可调用的工具，也能被 UI 调用 |
| **Web Server / 路由 / 文件与附件服务** | 媒体流、项目文件、素材上传、结果下载 |
| **Agent / 子代理 / Agent Teams** | 编剧、分镜师、提示词工程师、审片员多角色协作；并行生成多个镜头 |
| **MCP 连接** | 直接接 Blender MCP（操作 Blender）、ComfyUI-MCP（操作 ComfyUI）、其他外部工具 |
| **工作流引擎 / 后台任务 / 终端** | 把"一个镜头的生成"做成可复现工作流；跑 ffmpeg/超分脚本；长任务后台执行 |
| **凭据/审批/权限** | 管理外部 API Key；生成花钱前审批；多用户隔离 |
| **Skill / Agent Preset** | 把"H3 六段式提示词""分镜规范""QC 清单"固化为技能，Agent 自动遵守 |
| **存储/工作区/会话日志** | 项目数据、生成记录、可追溯（哪个模型/种子/参数出的哪条） |

> 依据：当前 DSH 的 Host Service 目录包含工具注册、Web 服务、客户端模块、存储、工作流引擎、子代理、MCP 相关服务；Client Slot 树包含 `sidebar.panellist`（全局面板图标）、`main`（keyed：按 sidebar entry id 选中中央面板，keyDomain 开放）等插槽。**这意味着"注册一个自己的主面板 + 侧栏入口"是官方支持的扩展方式**，不需要 fork 外壳。

## 6.2 推荐架构（三层）

```
┌─────────────────────────────────────────────────────────────┐
│  DSH Studio Client 插件（React / Client half）               │
│  项目库 | 剧本/章节 | 镜头卡 | 角色/场景/道具库 | 3D预演面板  │
│  生成队列 | Take 对比/QC | 时间线/成片 | 成本看板             │
└───────────────▲──────────────────────────────┬──────────────┘
                │ Remote 服务调用               │ 事件/进度流
┌───────────────┴──────────────────────────────▼──────────────┐
│  DSH Studio Host 插件（Cordis / Node）                       │
│  ProjectService（SQLite/JSON）  PromptCompiler（H3六段式）    │
│  JobQueue（并发/重试/优先级）   BackendRouter（多模型路由）    │
│  AssetService（文件/缩略图/版本） QcService（深度/姿态/SSIM）  │
│  CostLedger（每次生成记成本）   WebRoutes（媒体流/上传/下载）  │
└───────┬─────────────────┬──────────────────┬─────────────────┘
        │ HTTP            │ MCP              │ CLI/文件
┌───────▼──────┐  ┌───────▼────────┐  ┌──────▼──────────────┐
│ ComfyUI       │  │ Blender MCP    │  │ SGLang H3 服务       │
│ H3/Wan/LTX    │  │ 场景/机位/渲染  │  │ /v1/videos（团队）    │
│ 超分/后处理    │  │ depth/pose     │  │ 或外部 API（兜底）    │
└───────────────┘  └────────────────┘  └─────────────────────┘
```

### 6.2.1 数据模型（核心是"镜头卡"）

建议的最小 schema（完整版见 `模板/H3镜头输入包.schema.json`）：

```json
{
  "project": "内线",
  "episode": "EP01",
  "scene": "SC03",
  "shot": "SH012",
  "duration_sec": 6,
  "mode": "ref2va",              // t2va | i2va | l2va | fl2va | ref2va
  "resolution": {"width": 1344, "height": 768},
  "style": "写实电影感，冷色调，雨夜",
  "subjects": [
    {"id": "S1", "name": "黄叶", "refs": ["refs/char_front.png", "refs/char_side.png"],
     "retention": "fully_preserved", "voice_ref": "audio/voice_s1.wav"}
  ],
  "references": {
    "images": ["refs/scene_stage.png", "refs/prop_letter.png"],
    "videos": ["refs_motion/motion_ref.mp4"],
    "audios": ["audio/dialogue_s1.wav"]
  },
  "previz": {
    "blender_scene": "previz/scene.blend",
    "camera": "previz/camera.json",
    "first_frame": "previz/frame_first.png",
    "last_frame": "previz/frame_last.png",
    "control": {"type": "depth", "path": "previz/depth.mp4", "strength": 1.0}
  },
  "prompt_sections": {
    "integrated_multimodal_description": "[Shot 1] ...",
    "overall_soundscape": "...",
    "non_diegetic_music": "N/A"
  },
  "generation": {"steps": 8, "seed": 1101, "flow_shift": 12.0, "audio_flow_shift": 3.0},
  "qc": {"status": "pending", "checks": ["identity", "depth_similarity", "pose", "audio_sync"]}
}
```

### 6.2.2 核心模块与工作量（MVP）

| 模块 | 功能 | Demo 级工作量 |
|---|---|---|
| 项目/剧本 | 项目、集、场、镜头 CRUD；章节拆分（LLM） | 0.4 人月 |
| 镜头卡/分镜 | 镜头卡字段、时间码、景别、状态流转 | 0.4 人月 |
| 资产库 | 角色三视图/服装/场景/道具/音频；缩略图/版本 | 0.5 人月 |
| 提示词编译器 | 镜头卡 → H3 六段式/三段式；标签编译与校验（`@图片1`→`<Picture 1>`） | 0.5 人月 |
| 后端适配 | ComfyUI HTTP（workflow 模板参数化）或 SGLang `/v1/videos`；外部 API 路由 | 0.8 人月 |
| 任务队列 | 提交/轮询/重试/并发/失败告警/结果入库 | 0.5 人月 |
| 审片/QC | Take 对比、深度/姿态/SSIM、人工通过/返修 | 0.5 人月 |
| 3D 预演 | 接 Blender MCP 或读取预设渲染；机位模板 | 0.8 人月 |
| 剪辑/导出 | 时间线（可用 OpenTimelineIO）、FFmpeg 拼接/字幕/AI 标识 | 1.0 人月 |
| 打包/权限 | 插件打包、多用户、API Key 管理 | 0.6 人月 |
| **合计（Demo 级）** | 能跑通"剧本→分镜→生成→审片→成片" | **约 3—5 人月**（正式 MVP 10—16 人月，完整 20—30 人月） |

**可用级（6—12 人月）**需补：时间线可视化、多人协作/审片批注、版本对比、角色 LoRA 训练管理、成本核算、权限/审计、崩溃恢复、Blender 实时预览。

### 6.2.3 两条实施路径

| 路径 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 先 Agent 后 UI**（推荐） | 先用 DSH Agent + 工具跑通：脚本→分镜→调用 ComfyUI/H3→审片；把 Skill/工具固化；再逐步做 Client 面板 | 最快见效（1—2 周可跑通单镜头），风险低 | 早期体验是"对话式"，不是"软件" |
| **B. 先 UI 后 Agent** | 先做 Client 面板 + 项目/镜头卡；再接生成后端；最后加 Agent | 更像产品 | 工作量大、容易在 UI 上过度投入 |

**建议**：A→B 混合。先把"镜头卡 + 提示词编译 + 生成队列 + QC"用 Agent 工具跑通（这部分是核心竞争力），再把这些能力暴露到 Client 面板。

### 6.2.4 替代方案对比

| 方案 | 适合 | 成本 | 风险 |
|---|---|---|---|
| **DSH 插件（推荐）** | 已有 DSH 环境、要 Agent+UI 一体 | Demo 3—5 人月；可用 MVP 10—16 人月（DSH 省 3—5 人月底座） | 受 DSH 插件体系约束；媒体资产/视频预览/时间线/渲染农场需自建；非 DSH 用户需另打包 |
| **ComfyUI + 自研 Web 前端** | 只要"生成工作台" | 6—10 人月 | 要自己写调度/鉴权/存储；Agent 能力弱 |
| **SwarmUI + 插件** | 小团队共享生成 | 2—3 人月（原型） | 制作管理弱 |
| **Electron/Tauri 桌面壳 + 本地服务** | 要"安装包"体验 | 10—15 人月 | 跨平台/更新/签名成本 |
| **买 SaaS（Runway/LTX Studio/即梦）** | 快速交付、不折腾 | 订阅费 | 数据/模型锁定、价格与政策风险（正是"字节不做人"的来源） |

## 6.3 工作量与 DSH 的边界（重要）

**完整工作量参照**（1 名有经验全栈、不含模型训练；来自 `08-本地制作软件与Blender工作流.md` 的 10 模块拆解）：

| 版本 | 范围 | 人月 |
|---|---|---|
| **Demo（跑通单链路）** | 项目/分镜/镜头卡 + 提示词编译 + 一个生成后端 + 人工审片 | **3—5** |
| **可用 MVP** | 上述 + 资产库 + 任务队列 + QC + 基础时间线/导出 + 版本 | **10—16** |
| **完整生产版** | 上述 + 多人协作/审片批注 + 权限/审计 + 多后端路由 + 成本核算 + 发布/运维 | **20—30** |

**DSH 能省什么（约 3—5 人月）**：Agent 循环、工具注册、MCP 连接、子代理/Agent Teams、审批、任务中心、凭据、会话与存储、工作流引擎、Client 插件表与 Slot（主面板/侧边栏/设置页/Toast）。**DSH 不提供、必须自建或外接**：媒体资产管理（缩略图/转码/版本/波形）、视频预览器、可视化时间线、渲染农场/多机调度、专业剪辑与调色。推荐分工：**DSH 做"编排层 + 任务中心 + 多角色评审（AI 圆桌）"，ComfyUI 做生成层，Blender MCP/bpy 做预演层。**

## 6.4 关键设计原则（少走弯路）

1. **模型可替换**：`BackendRouter` 抽象成统一接口（提交任务/查询/取结果/取消/成本），H3 本地、Seedance、Kling、Wan、Veo 都走同一层；按"镜头需求"路由（首帧/控制视频走 H3/Wan，30 秒多镜头走 Seedance/Kling，高端写实走 Veo/FLUX）。
2. **提示词是"编译产物"，不是用户手写**：用户填镜头卡，软件编译成 H3 六段式；保留"原始字段→编译结果"的映射，便于调试与复用。
3. **一切可复现**：记录模型文件/版本、LoRA、步数、采样器、seed、有效时长、控制强度；没有这些，审片返修就是玄学。
4. **QC 前置**：生成后先自动对比预演（深度/姿态/首帧/音频），不达标先自动重抽，减少人工看片量。
5. **成本可见**：每次生成记"模型/秒数/单价/重试次数"，项目级成本看板；避免"抽卡抽到破产"。
6. **合规内建**：素材授权记录、AI 标识、肖像/声音授权、模型许可（H3 区域/营收限制）做成字段与检查项。

---
