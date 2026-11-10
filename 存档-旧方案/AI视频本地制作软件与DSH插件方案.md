# AI 视频本地制作软件 + DSH 插件：完整方案

> 注：本文件为历史归档，其中的软件名已中性化处理。

| 项目 | 说明 |
|---|---|
| 文档版本 | v1.0（2026-11-04） |
| 状态 | **仅方案，不含实现**；先前的 DSH PoC 插件已按要求卸载，测试数据已删除 |
| 范围 | 私人自用、本地优先、不公开分发、不商业化；单用户/小团队 |
| 配套 | 附录 A《开源代码复用与许可证清单》、附录 B《闭源独有功能清单》、附录 C《DSH 插件接口与数据模型》 |
| 声明 | 本文是工程与产品方案，不构成法律意见。所有许可证结论以仓库 LICENSE 原文与你的律师意见为准。 |

> **v2 更正（2026-11-04）**：本文关于 "预演软件" 的官网与功能描述已被《闭源软件真实性核查-2026-11-04.md》修正——`<原产品官网域名>` 是同名编程语言，不是视频软件；预演软件的证据是微信公众号与 CoolShowAI 文档，品牌关系未确认；3D 预演建议直接用 **DirectorDesk（MIT）**。**工程规划以 `AI视频本地制作软件与DSH插件工程规划-v2.md` 为准。**

---

## 0. 结论先行

1. **不要从零写。** 开源已经覆盖约 70% 的基础能力：ComfyUI（生成宿主）、OpenCineAgent（H3 的 14-agent 生产流水线，Apache-2.0）、OpenCinema / Open Cinema Studio（本地画布/Blockout/审片，MIT）、BlenderMCP（Blender Agent 控制，MIT）、OpenTimelineIO（时间线，Apache-2.0）、Kitsu（制作管理，AGPL）、FFmpeg、SeedVR2/FlashVSR、Whisper 等。
2. **真正要自研的只有四件事**：镜头卡数据模型、H3 提示词编译器、任务队列与多后端路由、制作台 UI。其余模块尽量"拷贝开源代码 + 适配接口"。
3. **推荐形态：DSH 插件（Host 编排 + Client 主面板）+ 外部生成服务（ComfyUI / SGLang H3）+ Blender 预演 + FFmpeg/Resolve 后期**。DSH 负责 Agent、工具、任务、审批、来源台账；不负责像素生成。
4. **代码复用策略**：按你的要求，工程上按"直接拷贝/改写"来规划，但所有来源逐文件登记（附录 A 的台账模板），并对 GPL/AGPL/自定义许可证项目保留"进程边界隔离"的降级方案，最终由你的律师定调整方式（copyleft 隔离、独立进程、替换为 permissive 实现等）。
5. **闭源软件独有的重要功能约 10 类**（3D 导演台/五步流水线/AI 视频编辑/剧本分镜时间线/AI 角色替换/虚拟制片/AI 剪辑调色/模型级超分/数字人/程序化动效等），详见附录 B；这些不属于基础功能，建议逐项决定"自研/开源替代/买/跳过"。
6. **工期**：1 名有经验全栈，MVP 8—12 周；完整版 4—6 个月（含 Blender 预演、时间线、多角色 Agent）。建议先做"单镜头闭环"，再扩到整集。

---

## 1. 目标与范围

### 1.1 要解决的问题

你设想的链路是：

> 本地制作软件（项目/分镜/角色三视图/3D 预演/逐镜头要求）→ 把复杂提示词与素材交给视频推理后端（本地 H3 或外部 API）→ 返回视频 → 审片/返修 → 超分/补帧/音频/剪辑 → 成片。

本方案要交付的是：**一个 DSH 插件化的本地制作台**，把这条链路里的数据、任务、模型、工具串起来，让 DSH 的 Agent 和人类用户在同一个工作台上协作。

### 1.2 必须功能（MVP）

- 项目 / 集 / 场 / 镜头卡（结构化字段 + 版本）；
- 剧本/小说拆分辅助（LLM 生成，可人工改）；
- 角色/场景/道具/服装资产库（参考图 + 提示词 + 版本）；
- H3 提示词编译器（Ref2VA 六段式 / 关键帧三段式，标签与保留强度）；
- 生成任务队列（ComfyUI H3 / SGLang H3 / 外部 API / mock）；
- 任务状态、结果预览、take 管理；
- 超分/补帧/转码/拼接（SeedVR2/FlashVSR/FFmpeg）；
- 审片（对比预演、身份、口型、音频、物理）与返修记录；
- 代码来源台账（此项目特殊要求，必须内建）。

### 1.3 应包含（完整版）

- Blender 预演：机位、走位、depth/canny/pose 控制序列导出；
- 多镜头连续性：首尾帧接力、角色参考库、场景锚点；
- 时间线/剪辑/字幕/混音（OTIO + FFmpeg + Resolve 外部）；
- 多角色 Agent（编剧/分镜/提示词/导演/审片/剪辑）；
- 成本台账、批量任务、失败重试、模型路由；
- 发布前 AI 标识与授权记录。

### 1.4 非目标

- 不做公开分发的 SaaS、多租户、账号计费；
- 不自研视频生成模型（只做推理集成与后处理）；
- 不做破解授权/DRM/绕过付费、不复制闭源代码或模型权重；
- 不追求"完全无人值守的 100% 一致性"——长片仍需要人审。

---

## 2. 现有软件调研结论（方案依据）

> 详细原始研究见 `研究资料/08-本地制作软件与Blender工作流.md`；本节只给影响方案选择的结论。

### 2.1 开源：能复用什么

| 层 | 项目 | 许可证 | 在方案中的角色 |
|---|---|---|---|
| 生成宿主 | **ComfyUI** | GPL-3.0 | 节点执行、H3/Wan/LTX 工作流、HTTP API；建议进程边界调用 |
| H3 生产流水线 | **OpenCineAgent**（14 agents） | Apache-2.0（README） | **最佳起点**：剧本→身份→关键帧→H3 视频→QC→超分→混音→成片；16GB 显卡可跑 |
| 本地工作室/画布 | **OpenCinema** | MIT | Blockout、审片、编辑计划、项目包、Agent 画布；可借鉴/改写 |
| 本地工作室（ComfyUI 版） | **Open Cinema Studio** | MIT | 剧本/镜头/LTX 视频/成片，ComfyUI 原生；可参考 |
| H3 多段导演节点 | **ComfyUI_MiniMaxH3_Director** | Apache-2.0 | 多段时间轴、首尾帧组、参考素材组；可直接复用 |
| H3 节点/Wan 节点 | ComfyUI-WanVideoWrapper | Apache-2.0 | Wan/VACE/控制节点；可拷贝/适配 |
| H3 推理/训练 | **DiffSynth-Studio** | Apache-2.0 | NF4 低显存、LoRA/训练、retake；可拷贝/CLI |
| 3D 预演 | **Blender** + **BlenderMCP** + ComfyUI-BlenderAI-node | Blender GPL / MCP MIT / 插件 GPL | 摆位、机位、depth/canny/pose 导出；Blender 进程边界 |
| 制作管理 | **Kitsu** | AGPL-3.0 | 镜头/资产/任务/审片；可选，进程边界或不用 |
| 分镜 | **Storyboarder** | MIT（待确认） | 分镜速写/Shot Generator；参考 UI 与数据结构 |
| 时间线 | **OpenTimelineIO** | Apache-2.0 | 时间线交换格式；直接依赖 |
| 剪辑 | **FFmpeg / MLT / OpenShot** | LGPL/GPL | FFmpeg CLI 为主；OpenShot 仅参考 |
| 代码视频 | **Remotion** | 自定义 | 片头/数据视频；许可证需单独评估 |
| 超分 | **SeedVR2 / FlashVSR / Real-ESRGAN** | Apache-2.0 / Apache-2.0 / BSD-3 | 后处理；CLI/ComfyUI |
| 补帧 | **RIFE / FILM** | MIT / Apache-2.0 | 后处理 |
| 音频/口型 | Whisper / CosyVoice / IndexTTS / LatentSync / EchoMimicV2 / InfiniteTalk / Wan2.2-S2V | MIT / Apache-2.0 / 自定义 / Apache-2.0 | 字幕、TTS、口型、数字人 |
| 音频拟音 | MMAudio / HunyuanVideo-Foley | MIT code+CC-BY-NC 权重 / 腾讯社区许可 | 音效；注意权重许可 |

**关键判断**：

- **OpenCineAgent 已经把"H3 复杂制作"的流水线做出来了**：脚本→镜头清单→身份注册→Krea 2 关键帧→H3 视频（原生音频）→QC（Whisper/VLM）→超分→混音→成片；16GB 显卡实测 45 秒集约 22 分钟。它是最值得"直接拿来改"的底盘。
- **ComfyUI 是生成层事实标准**，但它是 GPL-3.0；建议通过 HTTP/工作流进程边界使用，避免把 GPL 代码静态链接进闭源/自研代码。若你决定拷贝代码，需按 GPL 处理并在台账中标注。
- **OpenCinema / Open Cinema Studio / OpenCineAgent 都是 2026 年新项目**，成熟度有限（OpenCinema 0.4 预览、Windows 不支持），适合"参考/改造"，不建议当唯一依赖。
- **开源空白**：项目管理 UI、逐镜头审片工作流、3D 导演台交互、时间线可视化。——这些正是自研重点。

### 2.2 闭源：做得好的地方（只学功能，不抄代码）

| 软件 | 做得好的功能 | 可否开源替代 | 处理建议 |
|---|---|---|---|
| 预演软件 | 3D 导演台/导演取景器/白模预演、五步流水线、空间精度验收、演员/服装/地点/道具库 | 部分可用 Blender+OpenCinema 替代 | 功能拆解见附录 B；优先复刻"五步流水线+镜头卡+QC"，3D 导演台用 Blender 现成能力 |
| Runway | Aleph 2.0 in-context 编辑、Workflows/Agent、Edit Studio | Wan2.2 VACE/Uni3C + H3 latent mask 可替代大部分编辑 | 不自研，作为外部 API 可选；编辑功能用开源拼 |
| LTX Studio | 剧本→分镜→时间线→角色一致→导出 | OpenCinema/OpenCineAgent 可覆盖 60—70% | 参考其信息架构，自研分镜/时间线 |
| Flow Studio（原 Wonder Studio） | AI 角色替换/VFX、光照/动作匹配、自动抠像 | Wan-Animate/Animate-2 + 分割/深度/合成 | 中优先，需单独做 |
| Unreal Engine 5.8 | 虚拟制片/ICVFX、Live Link | Blender 可覆盖个人级预演 | 个人不做，工作室另议 |
| DaVinci Resolve 21.1 | AI 粗剪/素材整理/Magic Mask/深度图/Voice Isolation + Claude/Codex 助手 | Resolve 免费版本身可用；FFmpeg/MLT 替代基础剪辑 | **直接外接 Resolve**，不自研剪辑器 |
| 视频增强软件 | 模型级超分/补帧/修复（Starlight/Astra） | SeedVR2/FlashVSR/Real-ESRGAN/RIFE 可替代 | 可用开源替代；视频增强软件作为可选外部工具 |
| HeyGen/Hedra | 数字人/多语言口播/口型 API | LatentSync/EchoMimicV2/InfiniteTalk/Wan-S2V/CosyVoice | 本地开源为主，外部 API 兜底 |
| 节点动画软件 | 程序化动效/信息图 | Remotion/Blender/FFmpeg | 用 Remotion/Blender，不复刻 |
| 剪映/即梦 | 中文成片模板/字幕/翻译/数字人 | OpenCineAgent + FFmpeg + Whisper | 模板化功能自研 2—3 人月 |

> 详细功能拆解、闭源原因、开源替代与自研估算见 **附录 B**。

---

## 3. 总体架构

### 3.1 分层

```
┌──────────────────────────────────────────────────────────────┐
│ DSH（DeepSeek Harness）                                      │
│  ├─ Client 插件：制作台 UI（项目/剧本/分镜/镜头卡/资产/预演/  │
│  │   任务/审片/时间线/设置/来源台账）                          │
│  ├─ Host 插件：工具 + 服务 + 队列 + 适配器 + 存储 + 台账      │
│  ├─ Agent 角色：编剧/分镜/提示词/导演/审片/剪辑/法务来源检查   │
│  └─ 审批：花钱/生成/覆盖写/发布前检查（人工确认）              │
└───────────────▲──────────────────────────────┬───────────────┘
                │ 本地 HTTP/进程                │ 本地 HTTP
┌───────────────┴──────────────┐  ┌────────────▼──────────────┐
│ 生成服务层                    │  │ 制作/后期工具层            │
│  ├─ ComfyUI（H3/Wan/LTX/Krea）│  │  ├─ Blender + BlenderMCP   │
│  ├─ SGLang H3（/v1/videos）   │  │  ├─ FFmpeg / OTIO          │
│  ├─ 外部 API（可选，兜底）    │  │  ├─ SeedVR2/FlashVSR/RIFE  │
│  └─ mock（开发用）            │  │  ├─ Whisper/CosyVoice/口型 │
└──────────────────────────────┘  │  └─ Resolve（外部，可选）  │
                                   └───────────────────────────┘
```

### 3.2 职责边界（必须守住）

- **DSH 只做"数据/编排/审批/展示"**：不加载模型、不写视频编码器；通过 HTTP/CLI 调外部服务。
- **生成服务独立进程/端口**：ComfyUI、SGLang、Blender、FFmpeg 都是外部进程，崩溃不拖垮 DSH；许可证隔离也靠这一层。
- **媒体文件走文件系统**：DSH 只存元数据与相对路径，视频/图片由本地磁盘或 NAS 提供；预览通过本地文件路由。
- **一切可复现**：每个 take 记录模型/版本/LoRA/步数/flow_shift/seed/分辨率/时长/输入素材哈希/提示词哈希。

### 3.3 三种实现路线

| 路线 | 内容 | 工期 | 适合 |
|---|---|---|---|
| **A. 轻编排** | DSH Agent + 少量工具；ComfyUI/Blender 手动操作；DSH 负责写提示词、建镜头卡、调生成/查询、超分命令 | 2—4 周 | 先验证 H3+Blender |
| **B. 半自动工作台（推荐）** | A + Client 主面板（项目/镜头/任务/预览）+ 适配器 + 队列 + 审片 + 超分 + 来源台账 | 8—12 周 MVP | 个人/小团队量产 |
| **C. 完整制作软件** | B + 资产库/版本/时间线/多角色 Agent/协作/发布 | 4—6 个月 | 工作室级 |

**建议先做 B 的"单镜头闭环"**：镜头卡 → 提示词编译 → H3 生成 → 预览 → 超分 → 记录；跑通后再扩资产库、多镜头、Blender 预演、时间线。

---

## 4. 模块拆解与实现策略（12 个模块）

| # | 模块 | 必须功能 | 复用来源 | 复用方式 | 自研估时（人月） | 优先级 |
|---|---|---|---|---|---|---|
| 1 | 项目/工程 | 项目、集、场、镜头、版本、状态 | 自研（JSON/SQLite）；参考 Kitsu/OpenCinema | 自研 | 0.5 | P0 |
| 2 | 剧本/小说拆分 | 章节→分段→镜头清单；LLM 生成可改 | OpenCineAgent 的 Scriptwriter/Shotlist；Ollama/云端 LLM | 拷贝+改 | 0.5 | P1 |
| 3 | 分镜/故事板 | 镜头缩略图、景别、时间码、排序 | OpenCinema/Open Cinema Studio/Storyboarder | 参考重写 | 1.0 | P1 |
| 4 | 镜头卡/提示词编译 | 结构化字段→H3 六段式/三段式、标签/保留强度、校验 | 自研核心；复用 `研究资料/07` 模板 | 自研 | 1.0 | P0 |
| 5 | 资产库 | 角色三视图/服装/场景/道具/音频；版本、引用计数 | 自研 + ComfyUI 图像模型（Krea 2/FLUX/即梦外部） | 自研+复用生成 | 1.5 | P1 |
| 6 | 3D 预演/机位 | 白模摆位、机位预设、WASD 掌镜、depth/canny/pose 导出 | Blender + BlenderMCP + ComfyUI-BlenderAI-node；参考 OpenCinema Blockout/预演软件 | 进程边界+参考 | 2.5 | P2 |
| 7 | 生成队列/调度 | 提交/轮询/重试/并发/优先级/取消 | 自研；参考 OpenCineAgent state/ComfyUI queue | 自研 | 1.0 | P0 |
| 8 | 后端适配 | ComfyUI / SGLang H3 / 外部 API / mock；模型路由 | ComfyUI HTTP、OpenCineAgent ComfyUI client、SGLang `/v1/videos` | 拷贝+适配 | 1.5 | P0 |
| 9 | 审片/QC | 首帧/深度/姿态/SSIM、Whisper 台词、VLM 身份、音频同步 | OpenCineAgent QC（Critic/Healing）；DepthAnything/DWPose/SSIM | 拷贝+改 | 1.0 | P2 |
| 10 | 时间线/剪辑/导出 | 拼接、字幕、混音、转码、OTIO 输出 | FFmpeg + OTIO + Resolve 外部；参考 OpenCineAgent Assembly | 进程边界+适配 | 1.5 | P3 |
| 11 | 音频/配音/口型 | 字幕、TTS、口型、数字人、拟音 | Whisper/CosyVoice/IndexTTS/LatentSync/EchoMimicV2/InfiniteTalk/Wan-S2V；MMAudio/HunyuanVideo-Foley | 进程/拷贝 | 1.0 | P2 |
| 12 | 超分/修复/补帧 | 2×/4× 超分、补帧、修复 | SeedVR2/FlashVSR/Real-ESRGAN/RIFE/FILM | 进程/拷贝 | 0.5 | P1 |
| 13 | Agent 编排 | 多角色、多镜头并行、审批、技能 | DSH 自带 subagents/Agent Teams/skills/workflow | 直接用 | 1.0 | P2 |
| 14 | 来源台账/合规 | 每个模块/文件的上游来源、许可证、修改记录；AI 标识 | 自研 | 自研 | 0.5 | P0（贯穿） |

**说明**：

- "复用方式"分三档：**拷贝**（把代码放进 `vendor/` 并改）、**进程边界**（外部 HTTP/CLI 调用，不复制代码）、**参考重写**（只学行为/交互，clean-room 实现）。
- **P0 是单镜头闭环**；P1 是资产/分镜/超分；P2 是预演/QC/音频；P3 是时间线/多角色/发布。
- 自研总量约 **9—10 人月**（MVP）+ 复用整合 **2—3 人月**；完整版再加 4—6 人月（资产库/时间线/协作/优化）。

---

## 5. 开源代码复用方案（按你的"直接拷贝"要求设计）

### 5.1 四条原则

1. **能拷贝就拷贝，但必须可追溯**：每段复制/改写的代码都要登记到 `PROVENANCE.md`（附录 A 模板），记录仓库、commit、许可证、文件、修改、义务。
2. **GPL/AGPL 单独隔离**：ComfyUI、ComfyUI-BlenderAI-node（GPL-3.0）、Kitsu（AGPL-3.0）、OpenShot（GPL-3.0）、Blender（GPL-2.0+）等，优先"独立进程 + HTTP/CLI"；若直接拷贝，放在独立目录/独立进程，不与自研核心静态链接，保留 LICENSE 与源码，律师确认。
3. **自定义/受限许可单独标记**：H3 Community License（区域/商用/标注）、Comfy-Org H3（other）、HunyuanVideo-Foley、IndexTTS、Remotion、MMAudio 权重（CC-BY-NC）等；能不用就不用，必须用时登记。
4. **保留替换路径**：每个关键模块至少有一个 permissive（MIT/Apache/BSD）替代，避免被单一 copyleft/自定义许可锁死。

### 5.2 复用方式（逐项目）

| 项目 | 许可证 | 用途 | 建议方式 | 复制范围 | 备注 |
|---|---|---|---|---|---|
| ComfyUI | GPL-3.0 | 生成宿主/节点 | **进程边界优先**；若要拷贝，独立进程+完整 GPL | 工作流执行/队列/API 相关少量代码 | 拷贝会触发 GPL 义务 |
| ComfyUI-WanVideoWrapper | Apache-2.0 | Wan/VACE 节点 | 拷贝/适配 | 节点实现、控制预处理 | 注意依赖上游 ComfyUI GPL |
| ComfyUI_MiniMaxH3_Director | Apache-2.0 | H3 多段/首尾帧/参考组 | 拷贝/改写 | 节点与工作流封装 | 最值得复用 |
| DiffSynth-Studio | Apache-2.0 | H3 NF4/LoRA/retake | 拷贝/CLI | H3 pipeline、低显存配置 | 训练脚本可留 |
| OpenCineAgent | Apache-2.0 | 14-agent 生产流水线 | **作为底盘拷贝+改** | 编排、ComfyUI client、QC、assembly、prompt contract | 16GB 实测；代码与模型许可分开 |
| OpenCinema | MIT | 本地画布/Blockout/审片 | 拷贝/参考 | 画布、Blockout、review/edit plan | 0.4 预览、Windows 不支持 |
| Open Cinema Studio | MIT | ComfyUI 原生工作室 | 参考/拷贝 | story/shot/LTX 工作流 | 2026-11 活跃 |
| BlenderMCP | MIT | Agent 操作 Blender | 拷贝/进程 | MCP server + add-on | 需外部 LLM Host |
| ComfyUI-BlenderAI-node | GPL-3.0 | Blender↔ComfyUI | 进程边界/慎拷贝 | 桥接节点 | copyleft |
| Blender | GPL-2.0+ | 3D 预演 | 进程边界（bpy 脚本） | 不拷贝引擎 | 用 Python API 即可 |
| Kitsu | AGPL-3.0 | 制作管理 | 进程边界/可选 | API 对接 | AGPL 传染风险高 |
| Storyboarder | MIT（待核） | 分镜 | 参考 UI/数据结构 | 分镜模型/Shot Generator 思路 | 维护停滞 |
| OpenTimelineIO | Apache-2.0 | 时间线 | 直接依赖 | 库 | 低风险 |
| FFmpeg | LGPL-2.1/GPL（构建相关） | 媒体处理 | CLI 进程边界 | 不拷贝源码 | 注意构建选项 |
| MLT/OpenShot | LGPL-2.1/GPL-3.0 | 剪辑（参考） | 仅参考/进程 | — | 不自研剪辑器 |
| SeedVR2 / SeedVR | Apache-2.0 | 超分 | CLI/ComfyUI 节点 | 推理封装 | 模型权重单独看 |
| FlashVSR | Apache-2.0 | 超分 | CLI/节点 | 推理封装 | |
| Real-ESRGAN | BSD-3-Clause | 超分 | 直接依赖/CLI | 推理代码 | 低风险 |
| RIFE / FILM | MIT / Apache-2.0 | 补帧 | 直接依赖/CLI | 推理代码 | |
| Whisper / faster-whisper | MIT | 字幕/QC | 直接依赖 | 推理封装 | |
| CosyVoice | Apache-2.0 | TTS | 进程/直接依赖 | 推理 | 模型卡另核 |
| IndexTTS | bilibili 自定义 | TTS | 慎用/登记 | 推理 | 需律师看 |
| LatentSync / EchoMimicV2 / InfiniteTalk / Wan2.2-S2V | Apache-2.0 | 口型/数字人 | 进程/拷贝 | 推理封装 | 权重许可另核 |
| MMAudio | MIT code / CC-BY-NC 权重 | 拟音 | 慎用 | 推理 | 权重不可商用 |
| HunyuanVideo-Foley | 腾讯社区许可 | 拟音 | 慎用 | 推理 | 区域/商用限制 |
| DWPose / DepthAnything V3 | Apache-2.0（待核） | 姿态/深度 QC | 直接依赖 | 推理 | |
| PySceneDetect | BSD-3-Clause | 镜头切分 | 直接依赖 | 库 | |
| H3 权重/Comfy-Org H3 | MiniMax H3 Community License / other | 模型 | 进程/API | 不复制权重 | 区域/营收/标注义务 |
| H3 Fun ControlNet Union | other（待核） | 结构控制 | ComfyUI 模型 | 不复制权重 | 模型卡为准 |
| Remotion | 自定义 | 代码视频 | 慎用/替代 | — | 许可按公司规模收费 |

> 完整逐文件台账模板与每个项目的"复制什么/义务/风险"见 **附录 A**。

### 5.3 目录与来源台账

```
F:\AI视频\工作室\
├─ src\                        # 自研代码（Host/Client/适配器）
├─ vendor\                     # 直接拷贝的开源代码（每个项目一个目录）
│  ├─ OpenCineAgent\           # + LICENSE、COMMIT、PROVENANCE.md
│  ├─ ComfyUI_MiniMaxH3_Director\
│  └─ ...
├─ third_party\
│  ├─ manifest.json            # 机器可读：项目/commit/license/文件/用途
│  └─ licenses\                # 所有上游 LICENSE 原文
├─ PROVENANCE.md               # 人读的总台账
├─ data\                       # 项目/镜头/资产/任务/输出
└─ docs\                       # 本方案与接口文档
```

**台账每条记录**（实现阶段自动/半自动维护）：

| 字段 | 示例 |
|---|---|
| 上游仓库 | `https://github.com/ProgramaGrueso/OpenCineAgent` |
| commit/tag | `abc1234`（固定，不用 main） |
| 许可证 | Apache-2.0 |
| 复制文件 | `agents/*.py`、`pipeline/*.py` |
| 修改说明 | 替换模型配置、接入本地 SGLang、改路径 |
| 义务 | 保留版权/许可/变更声明 |
| 使用模块 | 剧本/分镜/生成/QC |
| 日期/审核人 | 2026-11-xx / 待律师 |

---

## 6. 闭源独有重要功能（摘要）

> 完整清单（做什么、为什么闭源、开源替代、自研估算、建议）见 **附录 B**。

| # | 功能 | 代表软件 | 价值 | 建议 |
|---|---|---|---|---|
| 1 | 3D 导演台/导演取景器/白模预演（WASD 掌镜、机位预设、26 体素组件） | 预演软件 | 把"镜头语言"变成可执行预演 | 用 Blender + 自研机位预设；不复刻完整 3D 编辑器 |
| 2 | 五步流水线 + 空间精度验收（小说→分段→分镜→故事板→H3 提示词→H3 视频） | 预演软件 | 中文短剧/漫剧的完整生产链 | **优先复刻**（2—3 人月） |
| 3 | In-context 视频编辑（文本+图像控制、局部替换、30s/1080p、保留音频） | Runway Aleph 2.0 | 改镜头不重生成整条 | 用 Wan2.2 VACE/Uni3C + H3 latent mask 拼；外部 API 兜底 |
| 4 | 剧本→分镜→时间线→角色一致→导出 | LTX Studio | 一体化叙事工作流 | 参考信息架构，自研分镜/时间线 |
| 5 | AI 角色替换/VFX（光照/动作匹配、自动抠像） | Flow Studio（原 Wonder Studio） | 真人视频换 CG 角色 | 中优先；Wan-Animate/Animate-2 + 分割/深度/合成 |
| 6 | 虚拟制片/ICVFX（LED 墙、实时合成） | Unreal Engine 5.8 | 影视级预演 | 个人不做；工作室另议 |
| 7 | AI 剪辑/调色/混音/Agent 助手（高光粗剪、Magic Mask、深度图、Voice Isolation） | DaVinci Resolve 21.1 | 后期效率 | **直接外接 Resolve**，不自研剪辑器 |
| 8 | 模型级超分/补帧/修复（Starlight/Astra） | 视频增强软件 | 交付画质 | 开源 SeedVR2/FlashVSR/RIFE 替代 |
| 9 | 数字人/多语言口播/口型 | HeyGen/Hedra | 口播、出海 | 本地 LatentSync/EchoMimicV2/InfiniteTalk + TTS；外部 API 兜底 |
| 10 | 程序化动效/信息图 | 节点动画软件 | 片头/数据视频 | Remotion/Blender 替代 |
| 11 | 平台级 Agentic Workflows（无代码节点+LLM 节点+Agent 构建/修改/运行） | Runway Workflows/Agent | 自动化 | DSH 本身就是更开放的替代 |
| 12 | 中文成片模板/字幕/翻译/数字人 | 剪映/即梦 | 低门槛量产 | 自研模板 + FFmpeg + Whisper |
| 13 | 专业审片/协作（帧级批注、版本、审片） | Frame.io/Kitsu | 团队协作 | Kitsu（AGPL）或自研简单审片 |

**边界**：以上只做黑盒功能拆解与 clean-room 规格；不破解授权/DRM、不绕过付费、不复制闭源代码/权重/素材。

---

## 7. DSH 插件设计（摘要）

> 接口、数据模型、Agent 工作流的完整定义见 **附录 C**。

### 7.1 Host 工具（Agent 可调用）

| 工具 | 作用 |
|---|---|
| `studio_project` | 项目/集/场 CRUD |
| `studio_shot` | 镜头卡 CRUD、版本、状态 |
| `studio_asset` | 角色/场景/道具/音频资产 |
| `studio_prompt` | 镜头卡→H3 提示词（六段式/三段式），校验标签/保留强度 |
| `studio_generate` | 提交生成（ComfyUI/SGLang/外部/mock），返回 job |
| `studio_jobs` | 查询/重试/取消 |
| `studio_post` | 超分/补帧/转码/拼接/字幕 |
| `studio_qc` | 对比预演、Whisper 台词、VLM 身份、音频同步 |
| `studio_timeline` | OTIO 时间线、导出 |
| `studio_blender` | 场景/机位/白模/depth/pose 导出（经 MCP 或 CLI） |
| `studio_route` | 按镜头需求选后端（成本/分辨率/控制/隐私） |
| `studio_cost` | 成本台账 |
| `studio_provenance` | 来源台账查询/追加 |

### 7.2 Client 主面板（人类操作）

- 左栏：项目/集/场/镜头树；中栏：镜头卡编辑器（模式/时长/风格/描述/运镜/台词/角色/参考图/首尾帧/手动提示词）；右栏：任务/预览/QC；
- 顶部：后端选择（mock/ComfyUI/SGLang/外部）、批量生成、超分、导出；
- 资产页：角色三视图/服装/场景/道具；
- 预演页：Blender 截图/机位预设/depth 预览；
- 审片页：take 对比（预演 vs 生成、上一版 vs 新版）；
- 设置页：服务地址、数据目录、并发、默认参数、来源台账。

### 7.3 Agent 角色与流程

| 角色 | 职责 | 工具 |
|---|---|---|
| 编剧 Agent | 小说/剧本→分段/镜头清单 | LLM + `studio_shot` |
| 分镜 Agent | 镜头卡、景别、时间码、故事板提示词 | `studio_shot`/`studio_prompt` |
| 提示词 Agent | H3 六段式/标签/保留强度/台词 | `studio_prompt` |
| 导演 Agent | 机位/预演/多镜头连续性 | `studio_blender`/`studio_shot` |
| 生成 Agent | 提交/轮询/重试/选 take | `studio_generate`/`studio_jobs` |
| 审片 Agent | QC/返修建议 | `studio_qc` |
| 剪辑 Agent | 时间线/字幕/混音/导出 | `studio_post`/`studio_timeline` |
| 来源检查 Agent | 每个生成/代码/素材的来源与授权 | `studio_provenance` |

**审批门**：花钱生成前、覆盖已有 take、发布前 AI 标识检查、外部 API 调用（可选）。

### 7.4 数据模型（核心）

```text
Project 1─n Episode 1─n Scene 1─n Shot 1─n Take
Shot 1─n AssetRef（角色/场景/道具/音频）
Shot 1─n Job（生成/超分/QC）
Take 1─n QcResult
Project 1─n ProvenanceEntry（代码/素材/模型来源）
```

镜头卡最小字段：`id/title/mode/duration/ratio/style/description/camera/dialogue/soundscape/music/subjects/refs/keyframes/control/promptOverride/backend/status/version`。

---

## 8. 实施计划

### 8.1 阶段

| 阶段 | 内容 | 工期 | 交付/验收 |
|---|---|---|---|
| **P0 方案/法务/环境** | 律师审附录 A；确定 copy/process 策略；安装/连接 ComfyUI/H3/FFmpeg/Blender；数据目录规范 | 1—2 周 | 决策记录、环境 checklist、来源台账模板 |
| **P1 单镜头闭环** | 项目/镜头卡/提示词编译/ComfyUI mock+H3/任务/预览/来源台账 | 3—4 周 | 一个镜头从卡到视频（mock+H3 各一次），≤10 分钟操作 |
| **P2 生产可用** | 资产库/角色三视图/多镜头/超分/QC/FFmpeg 成片/成本台账 | 3—4 周 | 60 秒成片端到端，成本/耗时记录 |
| **P3 Blender 预演** | 白模场景/机位/depth/canny/pose 导出/H3 ControlNet 接入 | 3—5 周 | 一个镜头"预演→生成"结构对齐验收 |
| **P4 完整工作台** | 时间线/多角色 Agent/批量/协作/发布前合规 | 4—6 周 | 整集批量生产、审片/版本/导出 |
| **P5 优化** | 性能/稳定性/成本/文档 | 2—4 周 | 连续 100 镜头无阻断；文档齐全 |

**总计**：MVP（P0—P2）约 8—12 周；完整（P0—P5）约 4—6 个月（1 名全栈；不含律师/硬件采购时间）。

### 8.2 验收指标

- 单镜头：镜头卡→提示词编译 ≤1 分钟；H3 5 秒生成在 4090 上 5—8 分钟、16GB 卡 3—4 分钟（8 步）/10—12 分钟（10 秒）；
- 60 秒成片：从镜头卡到导出 ≤2 小时（不含人工审片）；
- 来源台账：**100% 覆盖**所有拷贝/改写的代码与素材；
- QC：身份/深度/姿态/台词至少 4 项自动检查；
- 成本：每条 5 秒成本可追溯到模型/秒数/重试次数；
- 稳定性：ComfyUI/Blender 崩溃不丢任务记录。

### 8.3 角色与成本

- 1 名全栈（TypeScript/Node + React + Python 脚本）为主；可选 1 名前端/1 名视频工程；
- 硬件：现有 RTX 4090/5090（24—32GB）即可起步；16GB 可跑 H3 8 步；团队再上 2—4 卡或云；
- 软件成本：0（开源）+ 可选外部 API 费用；律师审阅另计。

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| GPL/AGPL 传染/违约 | 法律风险 | 进程边界优先；拷贝项目独立目录/独立进程；附录 A 逐项台账；律师审 |
| 自定义许可（H3/腾讯/IndexTTS/Remotion/MMAudio） | 商用/分发受限 | 自用可行但登记；不公开分发；必要时替换 |
| 上游 API/工作流漂移 | 功能失效 | 固定 commit/版本；适配器隔离；错误可观测 |
| H3 768p/15s/2K 限制 | 画质/时长不够 | 超分/SeedVR2；分段+尾帧接力；2K 走官方 API |
| ComfyUI 重启丢任务 | 任务丢失 | 任务状态落盘 + 幂等 + 结果入库 |
| GPU/显存不足 | 跑不动 | 16GB 起步、8 步 Turbo、低分辨率草稿、云 GPU 兜底 |
| 隐私/素材泄露 | 数据风险 | 全本地；外部 API 需显式开关；数据目录权限 |
| Agent 误操作 | 覆盖/乱花钱 | 审批门、只读默认、take 不覆盖、成本上限 |
| 长片一致性 | 角色漂移 | 角色库/RefMod/LoRA + 逐镜 QC + 人审 |

---

## 10. 需要你拍板的决策点

1. **底座**：是否以 **OpenCineAgent** 为流水线底盘（Apache-2.0，最省事）？还是以 OpenCinema/自研为主？
2. **后端**：本地 H3（什么卡）为主，外部 API（H3/Seedance/Kling）只兜底？还是反过来？
3. **范围**：先做"单镜头闭环"还是直接冲"整集流水线"？
4. **UI**：DSH 主面板（推荐，Agent 协同好）还是独立 Web/Electron（时间线更强）？
5. **闭源功能优先级**：附录 B 里哪些必须自研/替代，哪些可以跳过或买？
6. **许可策略**：GPL/AGPL 项目接受"拷贝+隔离+律师审"，还是优先进程边界？
7. **现有资产**：是否保留之前的 PoC 设计文档/测试数据（已删除，可重建）？

---

## 11. 下一步（等你确认后）

1. 你确认第 10 节的决策点；
2. 我按确认结果把附录 A 的台账细化为"逐文件复制清单 + 修改说明"（仍不写实现代码）；
3. 你的律师审附录 A，给出 copyleft/自定义许可的处理意见；
4. 再启动 P0/P1 实现（届时才写程序）。

---
