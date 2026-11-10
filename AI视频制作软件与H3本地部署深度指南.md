# AI 视频制作软件与 H3 本地部署深度指南

**——复杂制作链路需要传什么、用什么软件、怎么把 H3 跑起来（2026 年 11 月版）**

| 项目 | 说明 |
|---|---|
| 版本 | v1.0（2026-11-03） |
| 数据截止 | 2026-11-03；H3 部署与输入规格以 MiniMax 官方文档/模型卡/ComfyUI 官方教程/社区实测为准 |
| 面向 | 想搭"本地制作软件 + H3 本地推理"完整链路的个人创作者、小团队与工作室 |
| 配套 | 主报告《AI视频C端制作全景调研报告.md》；分方向研究 `研究资料/06—08`；模板 `模板/`（H3 输入包 schema、提示词模板、Blender 交付清单） |
| 阅读提示 | 文中 `⚠️` 表示未交叉核实；命令与参数为 2026-11 快照，部署前请以官方页面复核 |

---

## 执行摘要（先回答你的四个问题）

**问题一：复杂制作到底要往模型里传什么？**
不是"一段提示词"，而是**一个结构化的"镜头输入包"**：文字（结构化提示词）、参考图（角色三视图/场景/风格/道具）、首帧/尾帧（构图与起止状态）、参考视频（动作/运镜/节奏）、参考音频（音色/台词/演唱/音效）、控制视频（Blender 预演的 depth/canny/pose 序列），以及生成参数（时长、分辨率、步数、种子）。不同模型的差别在于"支持哪几类、上限多少、怎么引用"——H3 靠 `<Picture N>/<Video N>/<Audio N>/<Subject N>` 标签体系，Seedance 2.5 靠 50 项参考+时间戳，Kling 4.0 靠 15 项参考+10 关键帧，Wan 3.0 靠 20 项素材+文档输入。

**问题二：本地制作软件有哪些强方案？**
**开源**：ComfyUI（事实标准，H3/Wan/LTX 全生态）、ComfyUI + Blender MCP（预演→生成）、DiffSynth-Studio（H3 训练/推理，最低 7GB 显存跑 NF4）、Wan2GP、SwarmUI、Storyboarder/Kitsu/OpenTimelineIO（分镜与流程管理）、Remotion（代码成片）。**闭源**：Runway（Edit Studio/Aleph/Workflows）、Krea、LTX Studio（故事板→视频）、Higgsfield、Pika、Cascadeur、Wonder Studio、Unreal 虚拟制片、DaVinci/视频增强软件，以及国产 **预演软件 1.0.19**（已由用户拆解确认：小说→分段→分镜→H3 提示词→H3 视频，内置 3D 导演台/演员库/素材库/节点画布/配音台；`<原产品官网域名>` 是同名编程语言，不是该软件官网）。**结论：没有一款开源软件完整覆盖"复杂制作"全链路；最现实的组合是"ComfyUI/Blender 做生成与预演 + 自研（或 DSH 插件）前端做分镜/资产/任务/审片"。**

**问题三：能不能基于 DSH 或其他开源项目改造？**
**能，而且 DSH 适合做"上层制作软件"**：它自带 Agent 编排、工具注册、Client UI 插槽（可注册独立主面板/侧边栏/设置页）、工作区文件、子代理、工作流引擎、MCP 连接与审批机制；底层接 ComfyUI/H3 服务、Blender MCP、超分/剪辑工具即可。按 1 名有经验全栈估算：**跑通 demo 约 3—5 人月；可用 MVP 约 10—16 人月；完整生产版（协作/版本/发布/运维）约 20—30 人月**；DSH 可省 3—5 人月底座（Agent/工具/MCP/多智能体/审批/任务中心），但媒体资产、视频预览、时间线 UI 仍需自研。替代方案：纯 ComfyUI 工作流（最快但不像"软件"）、SwarmUI+自研插件、或直接买 SaaS（Runway/LTX Studio/即梦短剧工作室）。

**问题四：H3 本地部署怎么搞？**
三条路线：①**ComfyUI**（最省事，官方模板+pruned int8/NVFP4，社区口径 16GB 显存+32GB 内存可"稳定制作"，24GB 更好；24GB 单卡 768p/20 步约 5—7 分钟）；②**DiffSynth-Studio**（NF4 权重最低约 7GB 显存可跑，脚本化/可训练）；③**SGLang 服务化**（H3 支持仍是 Preview；官方参考 8×B200，4×H100/H200/2×5090 也有实测；适合团队共享 API，消费卡可用 vLLM-Omni 双卡 offload）。**关键限制**：开源 H3-Base 只出 **768p**，Context-IR 与 2K 再生成不开源（2K 需 MiniMax 平台 API，且要回传最终提示词）；单次 4—15 秒；许可排除美/欧/英/韩，中国大陆自用/商用需遵守社区许可（年收入 >2,000 万美元需书面授权、须标注模型名）。**官方 API 价格 $0.04—0.13/s（Lite 768P → 2K）**；本地 768p + 官方 2K 再生成约 $0.50/5s，比直接 2K 省约 23%。

---

## 0. 阅读地图：从"一句话"到"一条可交付的片子"

```
创意/剧本  →  分镜/镜头卡  →  资产（角色三视图/场景/道具）  →  3D 预演（Blender 机位/走位）
      →  结构化提示词 + 参考素材 + 控制信号  →  视频推理（H3 本地 / 外部 API）
      →  审片/QC（对比预演、身份/口型/物理）  →  重抽/局部重绘  →  超分/补帧/剪辑/音频  →  发布（AI 标识）
```

这条链路上，**"软件"负责 1—4、7—8，"模型 API"负责 5—6**。用户感知到的"AI 视频制作软件"，本质上是一个**镜头数据管理器 + 提示词编译器 + 生成任务调度器 + 审片工作流**；模型只是其中一个可替换的"渲染后端"。理解了这一点，就能理解为什么"接哪个模型"不该锁死——**应该让软件层支持多后端路由**。

| 层级 | 职责 | 关键数据/产物 | 可替换性 |
|---|---|---|---|
| ① 项目/剧本层 | 小说/剧本/章节/段落拆分 | 章节文本、分段剧本、角色设定 | 高（文本 LLM） |
| ② 分镜/镜头层 | 镜头列表、时长、景别、机位、动作节拍 | 镜头卡（shot card）、时间码、分镜图 | 高（结构化数据） |
| ③ 资产层 | 角色三视图、服装、场景、道具、声音 | 角色卡、场景卡、参考图、音频样本 | 中（依赖图像模型/素材库） |
| ④ 预演层 | 3D 摆位、相机运动、走位、动作 | 灰模渲染、depth/canny/pose 序列、相机参数 | 中（Blender/UE） |
| ⑤ 生成层 | 把输入包变成视频+音频 | MP4（视频+音频）、生成参数、种子 | 高（多模型可换） |
| ⑥ 审片层 | 与预演/设定对比，判定是否通过 | QC 记录、返修指令、版本 | 高（可用视觉模型辅助） |
| ⑦ 后期层 | 超分、补帧、剪辑、混音、字幕 | 成片、字幕、封面 | 高（工具链成熟） |
| ⑧ 分发层 | 多平台导出、AI 标识 | 多尺寸版本、标识元数据 | 高 |

> **一句话**：**模型决定"这一镜能有多真"，软件决定"一百个镜头能不能稳定、便宜、可复现地做完"。** 本文的重点就是后者，以及 H3 这个"本地渲染后端"怎么接进来。

---

# 1. 各模型"到底要传什么"：输入规格总表

> 同一个镜头，喂给不同模型的"数据形状"完全不同。原因不是 API 设计随意，而是**训练任务决定了模态接口**：以关键帧预测训练的模型只吃首/尾帧；以参考驱动训练的模型吃"参考图/视频/音频"；以指令编辑训练的模型吃"源视频+编辑指令"。
> 下表为 2026-11 公开口径整理；标 ⚠️ 的为未完全核实项。

## 1.1 总表（按"输入类型 × 模型"）

| 模型（形态） | 核心任务 | 文本输入 | 图像输入 | 视频输入 | 音频输入 | 首/尾帧 | 参考主体 | 控制信号 | 单次时长/分辨率 | 特殊语法/接口 |
|---|---|---|---|---|---|---|---|---|---|---|
| **MiniMax H3（开源 H3-Base）** | T2VA / I2VA / L2VA / FL2VA / Ref2VA | 结构化提示词（英文主体；台词/歌词/画面文字保留原语言） | Ref2VA 最多 **9 张**；关键帧模式 0—2 张 | Ref2VA 最多 **3 段**，每段 2—15s、合计 ≤15s | Ref2VA 最多 **3 段**，每段 2—15s、合计 ≤15s；不能单独作为唯一参考 | I2VA（首）、L2VA（尾）、FL2VA（首+尾）；**官方 API 最多 2 张，多锚点仅本地 AddGuide** | `<Subject N>` 从图/视频抽象人物/物体/服装/风格/动作 | **ComfyUI Fun ControlNet Union 2.0**：8 种条件（Canny/Depth/HED/MLSD/Pose/Scribble/Layout/Gray）+ mask inpaint；`MiniMaxH3AddGuide` 任意帧锚点（本地） | **4—15s**（整数）；768p 短边（1344×768 原生）；24fps；32kHz 立体声 | `<Picture N>`/`<Video N>`/`<Audio N>`/`<Subject N>`；Ref2VA 六段式；≤7,000 字符；≤64MB；≤12 个混合文件 |
| **Seedance 2.5（字节，闭源 API）** | 文/图/参考生视频+音频 | 支持时间戳级描述 | 最多 **30 张**参考图 | 最多 **10 段**参考视频 | 最多 **10 段**参考音频 | 首帧/尾帧（图生） | 多主体参考（合计 50 项） | 时间戳编辑、绿幕/白模参考、局部编辑 ⚠️ | 单次 **30s**、可续写；1080p；原生双声道 | 多模态参考 + 时间戳；需火山方舟/即梦渠道 |
| **Kling 4.0（快手，闭源）** | 文/图/视频/主体/音色参考 → 视频 | 支持 8,000 tokens 级长提示词 ⚠️ | 参考图 ≤10 + 关键帧 ≤10（合计 15 项素材） | 参考视频 ≤5（合计 30s） | 音色参考（计入 15 项） | 支持 **最多 10 张关键帧** | 主体参考（人/物）、动作控制 | 首尾帧/关键帧、运镜控制、多镜头 | 单次 **30s**，续拍最长 2 分钟；1080P/4K 10bit HDR | 全能参考（图≤10/视频≤5/主体≤7 等组合）⚠️ |
| **Wan 3.0（阿里，闭源 API）** | 文/图/视频/音频/文档→视频 | 支持结构化长提示词 | 最多 10 张 | 最多 5 段 | 最多 5 段 | 支持 | 多主体参考 | 多镜头分镜；文档/网页输入（PPT/Excel 转营销视频） | 2—30s；480P—1080P；30fps | 20 项素材合计；百炼托管 API |
| **Wan 2.2（开源，Apache-2.0）** | T2V/I2V/TI2V、S2V、Animate | 提示词 | 首帧/参考图 | VACE 控制视频 | S2V 音频驱动 | 支持 | 有限（靠参考图/首帧） | **VACE**（depth/pose/canny/ink 等 Annotator）+ ControlNet 生态；TI2V-5B 低显存 | 480p/720p；5s 级（可扩） | ComfyUI 节点；Apache 许可最自由 |
| **LTX-2.5（开放权重）** | T2V/I2V/视频→音视频 | 提示词 | 参考图 | 视频输入（V2V/续写） | 音频条件 ⚠️ | 支持 | 参考图 | 多镜头、HDR；IC-LoRA 控制（depth 等） | 10—20s；1080p/4K HDR；最高 50fps ⚠️ | ComfyUI 首日原生；许可有营收阈值 |
| **Veo 3.1（Google，闭源）** | 文/图生视频+原生音频 | 提示词 | **Ingredients**：最多 3 张参考图（场景/角色/物体） | 视频延长（用上一镜最后一秒） | — | 首帧+尾帧 | 参考图/角色一致性 | 镜头控制、outpainting、对象增删 | 4/6/8s；720p/1080p/4K；24fps | Gemini API/Vertex；SynthID |
| **Gemini Omni（Google）** | 任意模态→带音频视频+对话式编辑 | 对话式指令 | 图 | 视频输入（编辑/延长） | 音频输入 | — | — | 对话式视频编辑、4K 放大、10s 步进延长至 40s | 720p/约 10s；可延长 | Gemini App/Flow/YouTube；按 token 计费 |
| **Runway Gen-4.5 / Aleph 2.0** | 文/图生视频；视频编辑 | 提示词/编辑指令 | 参考图 | 源视频（Aleph 编辑） | 保留原音频 | 支持（Gen-4.5） | 参考图 | 文本指令编辑、图像级控制、多关键帧、最长 30s 1080p | 720p/10s（生成）；编辑 30s | Runway 平台/API；Aleph 是"编辑模型" |
| **Luma Ray3.2** | 文/图/V2V | 提示词 | 参考图 | V2V 输入 | 支持音频 ⚠️ | 多关键帧（最多 16） | 参考图 | Reframe、V2V、HDR/EXR | 5/10s；540p/720p/1080p | Luma API/Dream Machine |

## 1.2 读表要点

1. **"参考图"和"首帧"是两回事**：参考图是语义参考（身份/服装/风格），首帧是像素级锚点（第 0 秒必须长这样）。H3 明确把两者分成不同模式，且**一次请求不能混用**；Seedance/Kling 把两者都放进"参考"体系但语义不同。
2. **"视频参考"分三种用途**：动作迁移（学动作）、运镜/节奏参考（学镜头）、编辑/续写（改/接原片）。H3 的 Ref2VA 通过 `<Video N>` + retention 标记区分；Runway Aleph 是专门做"编辑"的模型。
3. **"音频"不是都能单独用**：H3 规定音频不能是 Ref2VA 的唯一参考（必须至少一张图或一段视频）；而 HeyGen/Synthesia 这类数字人则相反，音频是核心输入。
4. **"控制信号"是 3D 预演接入的关键**：H3 原生 API 没有 depth/pose 参数，但 ComfyUI 的 **Fun ControlNet Union** 补丁把 H3 变成"可控生成"；Wan 2.2 有 VACE；LTX-2.5 有 IC-LoRA。**没有 ControlNet 的模型，Blender 预演只能用作首帧/参考图，控制力弱一个量级。**
5. **时长决定"单镜 vs 多镜"**：H3 单次 4—15 秒（适合单镜/短镜头）；Seedance 2.5 30 秒、Kling 4.0 30 秒（可一条内多镜头）；Veo 3.1 只有 4/6/8 秒（必须分镜拼接）。
6. **分辨率决定后期链路**：H3-Base 768p、Wan 2.2 720p、Seedance/Kling 1080p+、LTX-2.5 4K。**本地 H3 路线必须配超分（SeedVR2/FlashVSR/视频增强软件）**，否则交付分辨率不够。
7. **"白模/灰模参考"只有 Seedance 2.5 官方原生支持**；H3 要靠 ComfyUI ControlNet 的 Gray/Layout/Depth 近似，Kling 用关键帧，Wan 3.0 用多模态素材。做 Blender 预演强控制时，这是选型的关键差异。
8. **渠道状态要单独核对**：Veo 3.1 在 Gemini API 的 Preview 渠道据官方文档已于 2026-10-22 关停，迁移方向是 Gemini Omni 1.1 Flash 或 Vertex/企业平台 GA；表中能力仍以官方模型卡为准，但"能否调用"要看你走哪个渠道 ⚠️。

---

# 2. H3 深挖：需要传什么素材、怎么组织（本次重点）

> 本章依据：MiniMax H3 官方模型卡/开源仓库、官方提示词指南（`skills/h3-prompt-writing`）、ComfyUI 官方 H3 原生/ControlNet 教程、社区 prompt guide 与格式规范（2026-08—10 快照）。所有上限/规则以官方文档为准，社区经验单独标注。

## 2.1 先选模式：H3 的五种"传入方式"（一次只能选一种）

H3 开源权重分为 **FL2VA** 与 **Ref2VA** 两个分区（DiT 与文本编码器权重不同，不能互换）。由此形成五种任务模式：

| 模式 | 用什么权重 | 输入 | 适用场景 | 一句话规则 |
|---|---|---|---|---|
| **T2VA** 文生音视频 | FL2VA | 仅提示词 | 无参考的创意镜头、空镜、氛围片 | 0 张图；提示词就是全部 |
| **I2VA** 图生视频 | FL2VA | 1 张精确**首帧** + 提示词 | 已有分镜图/角色定妆照，要它"动起来" | 图片 = 第 0 秒像素锚点 |
| **L2VA** 尾帧生视频 | FL2VA | 1 张精确**尾帧** + 提示词 | 已知落幅/结果，反推过程 | 视频向尾帧收敛 |
| **FL2VA** 首尾帧生视频 | FL2VA | 首帧 + 尾帧 + 提示词 | 镜头起止构图已定（Blender 预演最常用） | 补全两个端点之间的连续变化；官方偏好单镜头 |
| **Ref2VA** 参考生视频 | Ref2VA | 提示词 + 参考图/视频/音频（可组合） | 角色一致性、商品、动作迁移、运镜参考、音色/演唱 | 参考素材是"语义条件"，不是帧锚点 |

**四条硬规则（踩了直接失败或效果崩）**：

1. **一次请求只选一种模式**：首/尾帧模式与全参考模式**不能混用**（API 中 `first_frame`/`last_frame` 角色与 `reference_*` 角色互斥）。
2. **音频不能作为 Ref2VA 的唯一参考**：必须同时至少有一张图或一段视频；否则属于"可行性风险"。
3. **FL2VA 与 Ref2VA 权重不能混用**：SGLang 需要起两个服务（`--model-variant fl2va` / `ref2va`，不同端口）；ComfyUI 要分别加载对应 int8 文件。
4. **时长是 4—15 秒的整数**，最终会吸附到 `17k+5` 帧网格（24fps），请求 5 秒通常得到 124 帧 ≈ 5.17 秒。

### 2.1.5 完整系统三模块：为什么"2K 要第二次生成"

H3 完整系统由三个模块串成，**"传什么"取决于你用的是哪一段**：

| 模块 | 作用 | 输入 | 输出 | 是否开源 |
|---|---|---|---|---|
| **H3-Context-IR** | 把自由形式的多模态上下文（文本+图+视频+音频）理解/补全，转成结构化中间表示（最终是一段增强后的提示词） | text/image/video/audio + duration + ratio | **只返回增强提示词**（`/v2/h3_context_ir`，`task_type=h3_context_ir`） | ❌ 仅 API |
| **H3-Base（FL2VA / Ref2VA）** | 生成 768p 视频 + 同步立体声 | FL2VA：文本 + 0/1/2 张关键帧；Ref2VA：文本 + 参考图/视频/音频 | 768p、24fps、32kHz 立体声 MP4 | ✅ 开放权重 |
| **H3-Regenerate-2K** | 用原始上下文把 768p 结果 in-context 再生成到 2K（能恢复小字与细节，不是传统超分） | 源视频（`role=base_video`，必须带音轨）+ **当初生成它的全部输入（含最终提示词）** + `resolution=2K`；或 `source_task_id`（白名单） | 2K 视频 | ❌ 仅 API（`/v2/video_regeneration`） |

**含义**：① 本地部署只能做 768p；② 2K 必须把本地/API 的 768p 结果连同**最终提示词与素材**一起回传官方 API 再生成，**所以 `prompt_final.txt` 与素材哈希必须存档**；③ 再生成源视频有硬规格：带音轨、24fps、宽高 32 的倍数、面积在 768×768 与 768×1344 之间、总帧数 107—362 且为 17 的步进。

**官方 API 档位**（决定你能不能 2K、多长）：`MiniMax-H3`（768P/2K、4—15s、支持 2K 与再生成）> `MiniMax-H3-Max`（480/768P、**5—15s**、开放 `extra.prompt_expansion_mode`）> `MiniMax-H3-Highspeed`（480/768P、质量/速度折中）> `MiniMax-H3-Lite`（480/768P、参考模式不支持 adaptive 比例）。注意：API 档 `H3-Max` 与 fal 后训练的"H3 Max"（榜单/平台产品）**不是同一物**，引用时别混。

## 2.2 素材规格与上限（Ref2VA 最常被问）

| 项目 | 上限/规格 | 备注 |
|---|---|---|
| 参考图片 | **最多 9 张** | 短边缩放目标默认 2048（保持长宽比、允许放大、两轴取整到 32 的倍数） |
| 参考视频 | **最多 3 段**，每段 **2—15 秒**，合计 **≤15 秒** | 必须是 24fps；Pipeline 不做帧率重采样；不传声轨则视为无声 |
| 参考音频 | **最多 3 段**，每段 **2—15 秒**，合计 **≤15 秒** | 若视频自带声轨也要作为音频条件，必须显式走 `video_audio`（DiffSynth）或在 API 里分别传 |
| 混合参考总数 | **≤12 个文件** | 图+视频+音频合计 |
| 请求体大小 | **≤64 MB** | 参考视频多时注意压缩 |
| 提示词长度 | **≤7,000 Unicode 字符**；Ref2VA 描述正文通常 **350—500 英文词** | 英文为主体；台词/歌词/画面文字保留原语言 |
| 输出 | 4—15 秒；**768p 短边**（1344×768 原生 16:9）；24fps；32kHz 立体声 | 宽高必须是 32 的倍数；像素面积别超过 768×1344 |
| 分辨率预设 | ComfyUI 推荐 **0.98 MP**（如 1344×768）；**不要用 1.0 MP**（会解析成 1376×768，超上限） | 竖屏 768×1344、方形 768×768 也可 |
| 2K | **开源 H3-Base 不支持**；官方 `H3-Regenerate-2K` 未开源，需 MiniMax 平台 `/v2/video_regeneration` 接口 | 本地路线靠超分（SeedVR2/FlashVSR/视频增强软件） |

**官方 API 的文件级限制**（容易踩、务必核对）：图片 ≤30MB/张、边长 256—5760、比例 0.4—2.5；参考视频 ≤50MB、MP4/MOV、H.264/H.265 + AAC/MP3、23.976—60fps；参考音频 ≤15MB、WAV/MP3；整个请求体 ≤64MB（Base64 会膨胀约 33%，大文件用公网 URL）。

## 2.3 提示词结构：两种"官方格式"

### 2.3.1 关键帧模式（T2VA / I2VA / L2VA / FL2VA）

固定三段式：

```text
integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...
```

- `integrated_multimodal_description`：按播放顺序写风格、构图、主体、动作、镜头、对白、演唱、画内声音；
- `overall_soundscape`：1—4 句环境声/物理声/非语言人声，不重复对白与画内音乐；
- `non_diegetic_music`：1—3 句"只有观众听得到的配乐"（乐器/速度/节奏/动态），无配乐写 `N/A`。

关键帧模式还要在最前面加**官方对齐指令**，空一行后接正文：

```text
# FL2VA
How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture 2 (from [Shot N]) aligns with the S.SS-second mark of the target video.
```

I2VA / L2VA 同理，把 `Picture 1` 对齐到 0.00 秒或 `S.SS` 秒。**`S.SS` 必须用后端实际有效时长（帧网格换算后），不能写名义时长。**

### 2.3.2 Ref2VA 六段式（完整参考生成）

```text
subject_definitions:
<Subject 1> is ...

summary:
[reference generation] ...

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - ...

detailed_description:
The target video ...
[Shot 1] ...
[Shot 2] At 00:03.000, the shot cuts to ...

overall_soundscape:
...

non_diegetic_music:
...
```

- 六个字段名固定、顺序固定、不能加 Markdown 标题/列表/负向提示词；
- `summary` 必须以任务类型开头（`reference generation` / `keyframe completion` / `video editing` / `video continuation` / `audio reuse` / `audio reference`，可用 ` + ` 组合）；
- `detailed_description` 按播放顺序写镜头；`[Shot 1]` 不加时间戳，之后每个镜头 `[Shot N] At MM:SS.mmm, ...` 且切点严格递增；
- 每个镜头写清：构图、环境、光线、动作/状态变化、主运镜轨迹、景别连续性、同步声音；动作节拍建议"建立→准备→执行→收束→锁定"但不必机械套用；
- 对白/演唱：按首次发声顺序给稳定 ID `(S1)`、`(S2)`，原话放在 `<d>[Chinese] 原话</d>` 内，不翻译不改写；画外音写 `says in an off-screen voiceover` 并说明画面人物嘴唇闭合；跨切镜用 `<scenetrans>`，截断用 `<cutoff>`；画面可见文字用英文双引号逐字保留。

**H3 没有负向提示词**：官方 ComfyUI 模板走 `BasicGuider`、CFG 实际为 1，没有负向通道。「不要出现 X」必须改写成**正向约束或场景状态封口**（例如把「不要穿红衣服」写成「穿着深灰色外套」）。

## 2.4 素材标签体系：`@图片1` → `<Picture 1>`，以及 `<Subject N>`

本地 ComfyUI 的 `MiniMaxH3ReferenceToVideo` 节点按连接顺序生成标签，每种模态独立从 1 编号：

| 前端显示 | 模型标签 | 含义 |
|---|---|---|
| `@图片1` | `<Picture 1>` | 一张已连接的参考图（可作为帧锚点或画面参考） |
| `@视频1` | `<Video 1>` | 整段视频关系（剪辑/延续/运镜/节奏/时间结构） |
| `@音频1` | `<Audio 1>` | 音频复制或音色/节奏/音乐风格参考 |
| 自动抽象的"主体1" | `<Subject 1>` | 从图/视频中复用的人物、物体、环境、服装、风格、动作、表情、姿势 |

**关键区别（决定提示词怎么写）**：

- 图片只提供人物形象时，不必单独定义 `<Picture 1>`，而应写 `<Subject 1> is the person in <Picture 1> ...`；
- `<Video N>` 只表示"整段视频关系"；从视频里复用的动作/人物要另立 `<Subject N>`；
- 普通参考视频带声音，不代表一定要建 `<Audio N>`，只有需要复用/参考其声音时才连接音轨。

**保留程度标记（官方关键词）**：

| 视觉 | 含义 | 音频 | 含义 |
|---|---|---|---|
| `fully_preserved` | 身份/设计/帧角色完整保留 | `fully_copy` | 完整复制源音频 |
| `partially_preserved` | 可辨认但部分改变/只保留一部分 | `partially_copy` | 只复制部分/分层 |
| `attribute_transfer` | 把某属性迁移到新目标 | `reference` | 只参考音色/台词/节奏/风格/质感 |
| `weak_reference` | 只保留风格/类别/构图/氛围 | `weak_reference` | 只保留大类/氛围 |

**示例（角色+动作+运镜+音色）**：

```text
subject_definitions:
<Subject 1> is the woman in <Picture 1>; preserve facial identity, short black hair, red jacket, silver earrings.
<Subject 2> is the walking cadence and hand movement shown in <Video 1>.
<Video 1> provides the tracking-camera direction and broad beat timing.
<Audio 1> is the voice-timbre reference for <Subject 1> (S1).

summary:
[reference generation + audio reference] Generate a new cinematic street scene preserving <Subject 1>, transferring <Subject 2>'s movement, following <Video 1>'s broad camera rhythm, and using <Audio 1> as the voice reference.

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - preserve identity, hairstyle, jacket, earrings.
<Subject 2> ([Shot 1] movement): attribute_transfer - transfer walking cadence and hand timing to <Subject 1>.
<Video 1> (camera and pacing): weak_reference - follow broad tracking direction and beat timing without copying frames.
<Audio 1>: reference - follow timbre and delivery without copying the source waveform.

detailed_description:
Cinematic live-action street photography with soft morning light and restrained handheld movement. [Shot 1] A medium tracking shot follows <Subject 1> walking along a quiet covered market corridor. Her facial identity, short black hair, red jacket, and silver earrings remain consistent with <Picture 1>. She follows <Subject 2>'s relaxed cadence and synchronized right-hand gesture from <Video 1> while the camera follows <Video 1>'s broad forward tracking direction. The adult woman with the referenced calm, low voice (S1) says: <d>[Chinese] 今天早点回家。</d>

overall_soundscape:
Footsteps echo lightly beneath the covered walkway while fabric moves against the jacket. Distant vendors and a soft city hum remain in the background.

non_diegetic_music:
N/A
```

## 2.5 一个"复杂镜头"的完整输入包（推荐目录结构）

把素材按"项目→集→场→镜"组织，每个镜头一个文件夹，内含可复现的输入包：

```
project/
└─ EP01/
   └─ SC03/
      ├─ shot.json                  # 镜头卡（结构化字段，见附录 A）
      ├─ prompt.txt                 # 编译后的 H3 提示词（六段式/三段式）
      ├─ refs/
      │   ├─ char_lin_3view_front.png      # 角色三视图：正/侧/背/四分之三
      │   ├─ char_lin_3view_side.png
      │   ├─ char_lin_3view_back.png
      │   ├─ char_lin_3view_quarter.png
      │   ├─ costume_detail.png             # 服装/配饰细节
      │   ├─ scene_stage_wide.png           # 场景参考
      │   └─ prop_letter.png                # 道具/文字细节
      ├─ previz/
      │   ├─ frame_first.png                # Blender 机位 0.00s 渲染（首帧）
      │   ├─ frame_last.png                 # 机位末尾渲染（尾帧）
      │   ├─ depth_%04d.mp4                 # 深度序列（Fun ControlNet depth）
      │   ├─ pose_%04d.mp4                  # 姿态序列（若有真人动作参考）
      │   └─ camera.json                    # 相机轨迹/焦距/机位参数
      ├─ refs_motion/
      │   ├─ motion_ref.mp4                 # 动作/运镜参考（2—15s）
      │   └─ voice_ref.wav                  # 音色/台词参考（2—15s，32kHz）
      ├─ audio/
      │   ├─ dialogue_s1.wav                # 台词（如需精确对白）
      │   └─ bgm_hint.mp3                   # 配乐参考（可选）
      ├─ takes/                             # 生成结果（按 take 编号）
      └─ qc/
          ├─ qc_report.json                 # 对比预演的通过/返修记录
          └─ diff_depth.png                 # 深度/姿态偏差可视化
```

**输入→模式的映射**：

- 只想要"按首尾帧动起来"：`frame_first.png` + `frame_last.png` + `prompt.txt`（FL2VA）；
- 想要"角色一致 + 动作参考 + 运镜参考"：4 张角色图 + 场景图 + `motion_ref.mp4` + 六段式提示词（Ref2VA）；
- 想要"按 Blender 机位结构走"：`frame_first.png`（首帧）+ `depth_%04d.mp4`（Fun ControlNet depth）+ 角色参考（若用 Ref2VA 权重，则把 depth 作为 control video 与参考图一起进 ComfyUI）；
- 想要"精确对白/演唱"：`dialogue_s1.wav` 作为 `<Audio 1>`（Ref2VA 的音频参考）或在关键帧模式中写 `<d>` 台词；注意音频不能单独作唯一参考。

> **注意一**：H3 原生 API 不吃"相机参数/深度图"这类结构化控制；深度/姿态控制要经过 **ComfyUI Fun ControlNet Union 2.0**（8 种条件），也就是"软件层把 Blender 序列渲染成控制视频，再喂给 H3"。这是本地制作软件最该做的一层适配。

> **注意二（反直觉）**：**角色设定图不要直接塞一张 3×3 网格三视图**。H3 参考图短边最多按 2048px 处理，一张 3×3 网格摊薄后每格仅约 680px，且框线会干扰；社区实测 2—4 张独立的高分辨率单图（正面/四分之三/侧面/服装细节）身份保真度明显更好。

## 2.6 高级控制：把"H3 只能抽卡"变成"可导演"

### 2.6.1 `MiniMaxH3AddGuide`：任意帧锚点

ComfyUI 原生节点 `MiniMaxH3AddGuide` 可以把**任意帧**的图像/音频锚定到指定 `frame_idx`（负数表示从结尾倒数），并可链式串联多个锚点：

- 例：把一段 22 帧的参考片段锚定到第 0 帧，让音视频从该片段继续；把一张"第 60 帧的姿势图"锚定到第 60 帧，强制镜头经过该姿势；
- 这是**条件注入**，不是 video-to-video：采样仍从空 latent 开始，`denoise` 不会像 V2V 那样缩放引导强度。

### 2.6.2 Fun ControlNet Union 2.0：8 种条件 + 局部重绘

官方教程（ComfyUI 0.35.0+）明确：`alibaba-pai/MiniMax-H3-Fun-Controlnet-Union`（2.0，约 13.5GB）是单一 checkpoint，可对 H3 施加：

- **8 种条件控制视频**：Canny / Depth / HED / MLSD / Pose / Scribble / Layout / Gray（Blender 可渲 depth/canny/pose/灰度/布局，直接控制生成结构）；
- **mask 局部重绘**（区域=1 重新生成，其余保持；可配 `source_video`）；
- 可与 FL2VA/Ref2VA 两种 transformer 配合；`guidance_scale` 保持 1.0，控制强度用 patch strength 调；可选 4 步 Lightning LoRA（更快，但音频/运动质量略降）。

**这是"Blender 预演 → H3"最关键的落地能力**：你在 Blender 里拉相机、摆角色、渲染 depth/canny/pose，H3 按结构生成"写实版"，而不是自由发挥。

### 2.6.3 重绘/延长：latent noise mask 与 retake

- ComfyUI 的**逐 token 噪声遮罩**（`denoise_mask`：0 保留、1 重生成）可做局部重绘、物体移除、片段延长；视频遮罩吸附 2×2 latent patch，音频遮罩按整 latent 帧。
- DiffSynth-Studio 的 H3 pipeline 提供 `retake_video` / `retake_audio` 与 `frame_regions_to_retake` / `seconds_regions_to_retake`：保留区间外内容，只重生成指定帧/秒；**视频按 17 帧 clip 耦合，重绘任意一帧=重绘整个 clip**（区间会自动扩展到 clip 边界）；音频按 1/40 秒均匀压缩，可直接按秒指定。
- 实用组合：**首尾帧定稿 → 局部重绘改手/道具/文字 → 音频 retake 改台词**。

## 2.7 H3 的能力边界（别对它期待错）

| 边界 | 具体表现 | 应对 |
|---|---|---|
| 分辨率 | 开源 H3-Base 只出 768p 短边 | 后期超分（SeedVR2/FlashVSR/视频增强软件）；2K 需官方 API 再生成 |
| 时长 | 4—15 秒/次 | 长镜头分段生成，用尾帧接首帧或参考图做连续性 |
| 2K/Context-IR | 未开源 | 不要宣称本地可复现官方 2K 工作流 |
| 首帧处理 | `first_frame` 直接缩放（不保比例，可能拉伸）；`last_frame` 居中裁剪 | 先把首帧裁成目标画幅（如 1344×768）再上传；尾帧留足安全边 |
| 音频 | 原生 32kHz 立体声；但不能单独作 Ref2VA 唯一参考 | 配音/演唱可作"音频参考+至少一张图"组合 |
| 动作/物理 | 多人交互、手部、复杂物理仍弱 | 用 Blender depth/pose 控制 + 局部重绘 + 多 take 筛选 |
| 文字 | 画面文字渲染弱 | 文字后期贴图/字幕，不让模型生成品牌字 |
| 许可 | 排除美/欧/英/韩；>$2,000 万营收需授权；须标注模型名 | 中国大陆自用/商用合规核对；出海需单独授权 |
| 关键帧数量 | 官方 API 只支持首/尾 **2 张** | 需要 3 个以上中间锚点 → 本地 `MiniMaxH3AddGuide` 多锚点串联，或拆镜头 |
| 负向提示/CFG | 无负向提示词、CFG=1 | "不要"改写为正向约束；靠提示词与素材控制 |
| 相机参数 | 无焦段/位移/轨迹数值接口 | 写运镜词 + 参考视频 + 视差描述；Blender 相机参数只能转成控制视频/首尾帧 |
| 法线/分割 | 8 种 ControlNet 条件里**无法线**；分割只能用 Layout 近似 | 法线图只做后期对照；分割用色块布局或 mask |

## 2.8 素材准备速查清单（上传前逐项打勾）

- [ ] 首帧已裁成目标画幅（16:9 → 1344×768；竖屏 768×1344），避免被拉伸；
- [ ] 角色三视图：正面/侧面/背面/四分之三各一张，分辨率 ≥1024，背景干净，服装细节清晰；
- [ ] 场景图：与分镜构图一致的光线/色调；必要时加一张"空场景"和一张"带角色"；
- [ ] 参考视频：≤15 秒、24fps、动作清晰、无遮挡；需要声音就同时准备音频；
- [ ] 参考音频：≤15 秒、32kHz、单一声源、无背景音乐污染；
- [ ] 提示词：用官方结构；台词用 `<d>[Chinese] ...</d>`；每个 `<Subject N>` 有 `retention_analysis`；
- [ ] 控制视频：Blender depth/canny/pose 序列与目标时长对齐（不足补尾帧、超出截断）；
- [ ] 参数记录：模型文件、LoRA、步数、sampler/scheduler、seed、有效时长；
- [ ] 授权：真人肖像/声音有书面授权；IP/角色不侵权；发布时加 AI 标识。

## 2.9 三条出片路线（按预算/精度选）

| 路线 | 做法 | 适合 | 分辨率/成本 |
|---|---|---|---|
| **A. 首尾帧（快、纯 API 也可）** | Blender 渲首帧+尾帧 → FL2VA；提示词写清中间变化 | 构图已由 3D 锁死的镜头、对话/过场 | 768p；2K 走官方再生成 |
| **B. 参考一致性（对白/演唱/多主体）** | 2—4 张独立角色图 + 场景图 + 音色 + 限权运镜视频 → Ref2VA | 角色戏、演唱、多镜头叙事 | 768p；2K 走官方再生成 |
| **C. 结构硬控（本地）** | Blender depth/pose/canny 序列 → Fun ControlNet 2.0 + 首帧/参考图 | 强运镜、复杂调度、与 3D 场景严格对齐 | 本地 768p，后期超分或 API 2K |

> 三条路线**不要混在同一次请求里**（首尾帧与参考模式互斥）；一个项目可以按镜头分别选 A/B/C。

---

# 3. Blender 预演怎么真正接进 AI 生成（H3 / Wan / 其他模型）

> 群友那套软件（预演软件）里最"值钱"的部分，不是 3D 渲染，而是**把 Blender 的空间信息转成了模型能吃的控制信号**：机位、构图、角色走位、镜头运动。本章讲清楚"Blender 里做的预演，到底怎么变成 AI 视频的输入"。

## 3.1 Blender 能产出哪些"控制信号"

| Blender 产物 | 生成方式 | 能控制什么 | 对应模型接口 |
|---|---|---|---|
| **灰模/白模渲染**（Viewport/Workbench） | 直接渲染 | 构图、景别、机位、遮挡关系 | 首帧/尾帧（H3 FL2VA、Wan I2V、Veo 首尾帧）；参考图（Ref2VA 的构图参考） |
| **深度图序列**（Depth pass / Mist / 合成器） | View Layer 的 Z/Mist 通道或 Depth Anything 后处理 | 场景几何、透视、前后景关系 | **H3 Fun ControlNet `depth`**；Wan VACE depth；LTX IC-LoRA depth；ControlNet 类模型 |
| **线稿/Canny 序列** | Freestyle 线框 / 边缘检测后处理 | 轮廓、结构、建筑/道具边缘 | H3 Fun ControlNet `canny`；Wan VACE canny |
| **姿态/骨骼序列**（OpenPose/骨骼） | Blender 骨骼 + 开源姿态渲染（如 SDPose 预处理）；或真人参考视频提取 | 角色动作、关节位置、走位节奏 | H3 Fun ControlNet `pose`；Wan VACE pose；Animate 类 |
| **HED/MLSD/灰度/布局** | 预处理模型或渲染通道 | 软边缘、直线结构、明暗布局 | H3 Fun ControlNet 2.0 支持（HED/MLSD/Gray/Layout）；Wan VACE 近似 |
| **法线图** | 渲染 Normal pass | 表面朝向 | ❌ H3 的 8 种条件里**没有法线**；只能做后期对照，不能当输入 |
| **分割图/实例掩码** | 渲染 Object/Mat ID 或分割模型 | 物体区域 | ⚠️ H3 无原生分割条件；用 Layout 色块或 mask 局部重绘近似 |
| **相机参数/轨迹** | 相机关键帧导出（位置/旋转/焦距/时间） | 运镜路径、焦段、景深倾向 | 目前**没有模型直接收 JSON 相机参数**；需转成"控制视频/首尾帧 + 文字运镜描述" |
| **多机位定妆/三视图** | 多个相机渲染角色正/侧/背/四分之三 | 角色一致性、服装细节 | Ref2VA 的 `<Picture N>` + `<Subject N>` |
| **动作参考视频** | Blender 动画导出/渲染（低模也可） | 动作、节奏、时间结构 | Ref2VA 的 `<Video N>` + `<Subject N>`（动作迁移） |

> **核心认知**：目前主流视频模型都**没有"结构化 3D 场景输入"接口**（除世界模型/少数 3D 条件模型）。Blender 的价值是把 3D 信息"翻译"成模型认识的像素/视频条件：**首尾帧锁构图、控制视频锁结构/运动、参考图锁身份**。

## 3.2 三条接法，按控制力从弱到强

### 接法 A：首帧 / 尾帧（最简单，控制构图与起止）

- Blender 按目标机位渲染 `frame_first.png` / `frame_last.png`；
- H3 用 FL2VA（首+尾）或 I2VA（仅首帧），Wan 用 I2V，Veo 用首尾帧；
- **优点**：实现简单、构图/景别准确；**缺点**：中间过程仍由模型自由发挥，动作/运镜不受控。
- 适用：对话镜头、静态构图、转场、产品展示。

### 接法 B：参考图/参考视频（锁身份与动作，不锁构图）

- Blender 渲染多角度角色图 → Ref2VA 的 `<Picture N>`/`<Subject N>`；
- Blender 低模动画渲染成参考视频 → `<Video N>` 学动作/节奏；
- **优点**：角色一致性好、动作可参考；**缺点**：构图/机位仍可能漂移。
- 适用：角色特写、表演镜头、动作参考。

### 接法 C：控制视频（Fun ControlNet / VACE，控制力最强）

- Blender 渲染 **depth/canny/pose/灰度/布局序列**（与目标时长对齐，24fps），作为 `control_video` 喂给 H3 Fun ControlNet Union 2.0（8 种条件，约 13.5GB；或 Wan VACE）；
- 同时用 `frame_first.png` 锁首帧、角色图锁身份、`<d>` 台词锁对白；
- **优点**：构图、机位、走位、动作结构都能"按预演走"；**缺点**：需要 ComfyUI 节点、控制强度要调、控制过强会损失画面自然度/音频质量。
- 适用：复杂运镜、走位、动作戏、产品/建筑结构、需要和 3D 场景严格对齐的镜头。

**推荐组合（实战）**：

```
Blender 预演（机位+走位+动作）
   ├─ 首帧渲染 ───────────────→ H3 first_frame（锁构图）
   ├─ depth 序列（24fps）──────→ H3 Fun ControlNet depth（锁结构/运动）
   ├─ 角色三视图 ─────────────→ Ref2VA <Picture N> / <Subject N>（锁身份）
   ├─ 台词/音色 wav ──────────→ <Audio N> 或提示词 <d>（锁声音）
   └─ 结构化提示词（六段式）──→ 描述风格/动作/镜头/声音细节
```

## 3.3 具体流水线（Blender → ComfyUI H3）

1. **Blender 场景准备**：低模角色/场景即可（不需要高精度），关键是机位、走位、遮挡关系、动作节奏准确；建议 24fps、时长与目标一致（4—15 秒）。
2. **导出控制序列**：
   - 深度：View Layer 的 Z/Mist 通道渲染成 PNG 序列（或 Depth Anything V3 后处理），再编码为 24fps 视频；
   - 线稿：Freestyle 或 Canny 预处理；
   - 姿态：骨骼驱动 + 姿态渲染（或对参考视频跑 SDPose 提取骨骼）；
   - 首帧/尾帧：目标机位渲染，按目标画幅（1344×768 或 768×1344）输出。
3. **ComfyUI 工作流**：加载 H3 int8 pruned 模型（FL2VA 或 Ref2VA）+ Fun ControlNet Union 补丁 → 接入 `control_video`（depth/canny/pose）→ 接 `first_frame` 或参考图节点 → 填六段式/三段式提示词 → 采样（20 步或 4/8 步 Turbo）→ 输出 MP4（含音频）。
4. **参数**：`guidance_scale=1.0`；控制强度从 1.0 起调（漂移再加大，过强画面会"塑料感"）；4 步 Lightning LoRA 更快但音频/运动略降；分辨率 0.98MP（勿用 1.0MP 档）。
5. **QC 对比**：把生成视频抽帧，和 Blender 深度/姿态/首帧做对比（深度图相似度、姿态关键点距离、SSIM），不达标就调控制强度/提示词/重抽。
6. **多镜头连续性**：上一镜最后一帧 → 下一镜首帧（或作为参考图）；角色三视图全程固定；同一场景用同一组场景参考图；音频按镜头分段但在剪辑时保持连续（H3 支持 `<scenetrans>` 跨切镜声音连续）。

## 3.4 社区已有的"预演→视频"开源配方（可直接借鉴）

- **artokun/comfyui-mcp 的 previz-to-video**（2026-02 RFC/实现）：官方 Blender MCP 负责场景组装、导入、重定向、相机关键帧、viewport 渲染；Mixamo 提供动作、Meshy/Tripo 提供模型；Blender 粗渲 + 相机运动 → 作为 Seedance 2.0 R2V 的参考（角色/环境参考图 + 运镜），"camera motion survives"。
- **Blender → ComfyUI AI Renderer 2.0**：读取 Blender 的深度、轮廓、辅助通道，用 DepthAnything_V3 预处理成控制视频序列，再交给视频模型生成，实现"运动一致"的电影级输出。
- **LTX-2.3 IC-LoRA + Blender depth**：社区实测用 Blender 渲基础预览 + 深度图，交给 LTX-2.3 IC-LoRA 保留场景结构、转换成电影感画面。
- **Blender MCP（官方/社区）**：让 LLM（Claude/GPT/Codex）通过 MCP 直接操作 Blender——建场景、摆相机、设关键帧、渲 viewport；预演软件界面里的 "Codex MCP" 就是这一类用法。开源实现：`ahujasid/blender-mcp`（含 Poly Haven/Sketchfab/Hyper3D 等扩展）、`ifBars/blender-agent-studio`（把 Blender MCP 集成进 agent 工作流）。

> **给自建软件的建议**：把"Blender 预演"做成软件里的一个**镜头级步骤**，而不是外挂：镜头卡里存 `camera.json` + `first/last frame` + `depth/pose` 序列路径；生成任务自动把控制序列打包成 ComfyUI 工作流参数；QC 阶段自动对比预演与生成结果。预演软件的"实际 3D 截图 · revision 4 · male-full"与"空间精度验收"就是这个思路。

> **预演经验的三个坑**：①**纯灰白模比贴图预演更有效**——贴图预演容易被模型当成平面图，出现穿模/脖子翻转；②**闭源模型（Kling/Seedance/Veo/Runway）不开放 depth/pose 原生输入**，真控制只在开源 Wan 2.2 Fun Control（Canny/Depth/Pose/MLSD/轨迹）/VACE/Uni3C/ReCamMaster；③**"Blender 相机参数直接喂模型"目前不可行**，只能转成控制视频/首尾帧 + 提示词运镜描述。

## 3.5 局限与替代方案

| 局限 | 说明 | 替代/缓解 |
|---|---|---|
| 模型不吃结构化相机参数 | 只能转成像素/视频条件 | 用 Blender 渲 depth/canny + 首尾帧；文字描述运镜 |
| 控制过强导致画面僵 | 特别是 depth/canny 强度大时 | 控制强度 1.0 起调；分层控制（depth 管结构、参考图管身份、提示词管风格） |
| 多人/复杂动作仍弱 | H3 多人交互、手部、物理是短板 | 分段生成 + 局部重绘 + 多 take 筛选；关键动作拆镜头 |
| 768p 空间精度有限 | 细节/文字/远景结构糊 | 超分到 1080p/2K；近景/特写补细节；文字后期贴 |
| Blender 学习成本 | 机位/走位/渲染需要 3D 基础 | 用预设机位模板（如预演软件拆解中的 28 个运镜模板/多机位）、低模素材库、Mixamo 动作 |
| **白模不是 H3 原生输入** | H3 官方 API 没有 depth/pose/白模通道，只有本地 ControlNet 曲线 | 用 Gray/Layout/Depth/Canny/Pose 控制；若强依赖"白模直出"，考虑 Seedance 2.5（唯一官方原生支持白模参考） |

---

# 4. H3 本地部署实操：从 8GB 显存到 8×B200

> 目标：让 H3 成为你制作软件背后的"本地渲染后端"。本章覆盖四条路线（ComfyUI / DiffSynth / SGLang / vLLM-Omni）、硬件档位、实测性能、参数、服务化、成本与许可。
> 数据来源：MiniMax 官方部署文档（2026-08-28 修订）、SGLang H3 Cookbook、ComfyUI 官方教程、DiffSynth-Studio 文档、社区实测仓库；社区数据单独标注。

## 4.1 四条路线怎么选

| 路线 | 适合谁 | 优点 | 缺点 | 最低门槛 |
|---|---|---|---|---|
| **ComfyUI 原生 H3 节点** | 个人/小团队、制作软件原型 | 官方模板、图形化、生态全（Turbo LoRA、Fun ControlNet、AddGuide、Wan 混排） | 不是"服务"（要自己包 HTTP/鉴权）、多任务并发弱 | 社区口径：**16GB 显存 + 32GB 内存**可"稳定制作"；24GB 更顺；8GB 靠 GGUF 能跑但慢 |
| **DiffSynth-Studio** | 要脚本化/批量/训练 LoRA | NF4 权重最低 **约 7GB 显存**可跑；Python API 完整（keyframes/refs/control_video/retake）；支持训练 | 需要写代码；UI 生态弱 | 7GB+（NF4）；推荐 24GB |
| **SGLang 服务化** | 团队共享 API、多用户、生产 | 异步 `/v1/videos`、可多卡并行、官方基准最全 | H3 支持仍是 **Preview（v0.5.17+）**；官方参考配置 8×B200；消费卡支持弱 | 官方 8×B200；4×H100/H200、2×5090、1×4090 均有上游配方 |
| **vLLM-Omni（社区）** | 消费卡/2 卡 offload | **一个服务同时载 FL2VA+Ref2VA**、OpenAI 风格 `/v1/videos`（含 `/sync` 直返 MP4）、2×4090/5090 TP2 | 实验性、镜像大、系统内存要求高（≥200GiB，推荐 384GiB） | 单卡（大内存）+ 2×24GB 卡 |

**官方 API 还有 4 个视频档位**（决定你能不能 2K、最长多少）：`MiniMax-H3`（768P/2K、4—15s、支持 2K 与再生成）、`MiniMax-H3-Max`（480/768P、5—15s、开放 prompt 扩写模式）、`MiniMax-H3-Highspeed`（480/768P）、`MiniMax-H3-Lite`（480/768P）。**API 的 H3-Max 与 fal 后训练的"H3 Max"不是同一物**。

> **建议**：个人先走 **ComfyUI**；要"软件化"就把 ComfyUI 包一层 HTTP（或直接用 SGLang 若有多卡）；要训练角色 LoRA 用 **DiffSynth**。**不要一上来就追 8×B200**——那是"服务一个团队/对外提供 API"的配置，不是 C 端个人配置。

## 4.2 硬件与显存档位（社区实测 + 官方口径）

| 显存 | 代表硬件 | 能跑什么（社区/官方口径） | 5 秒视频体感速度 | 备注 |
|---|---|---|---|---|
| **8GB** | RTX 3060/4060 | Q2_K GGUF（约 6.7GB）+ 极限分层卸载 + 480p/5s | 分钟级，体验差 | 仅"能出片"验证 |
| **12GB** | RTX 4070/5070 | 480P 可跑（约 16.8—18.7 秒/步）；4 步 Turbo + Latent Upscaler | 约 3—8 分钟 | 需 ≤12GB 专用 low_vram 配置 |
| **16GB** | RTX 4080/5070Ti | 社区验证"稳定制作"（峰值约 11GiB、约 65 秒/条）；单步约 6 秒 | 约 1—5 分钟 | Windows 11 + 32GB 内存起；社区口径，非官方 |
| **24GB** | RTX 4090 | int8 权重 + 尾部 block 流式载入；768p/20 步约 **6.8 分钟**（int8 约 5 分钟；int8+Spectrum 50 步约 2.7 分钟） | 约 2—7 分钟 | 24GB 是"能出 768p 正片"的起点 |
| **32GB** | RTX 5090 | int8 常驻；480P/20 步约 **112 秒** | 约 1—3 分钟 | FP8 原生加速（compute capability ≥8.9） |
| **48GB** | RTX 6000 Ada / 双 4090 | 更高分辨率/更长时长/并行任务 | 约 1—3 分钟 | 小团队单机 |
| **80GB** | A100/H100 单卡 | 基本可常驻（FP8 更省）；4×H100 FL2VA 约 13 秒/条 | 十几秒级 | 服务化起点 |
| **8×B300** | 数据中心节点 | 官方/上游基准：FL2VA BF16 每卡峰值 83.6GB、FP8 51.9GB | **约 18—19 秒/条**（1344×768/124 帧/50 步） | 8×B200 官方**未公布**延迟/显存，别把 B300 数据写成 B200 |
| **2×RTX 5090** | 家用/小团队 | 768p/50 步约 **9 分 20 秒**；系统内存约 377GiB | 约 9 分钟 | 双卡 offload 方案 |
| **Apple Silicon** | M4 Pro 24GB | MLX 流式：BF16 1344×768/5s ≈ 48 分钟；INT8+Turbo 768×448/5s ≈ 23 分钟 | 很慢 | 只能验证，不适合量产 |
| **DGX Spark GB10（128GB 统一内存）** | 官方/社区 | INT8+NVFP4：608×352/4s≈97 秒、736×416/5s≈180 秒、864×480/5s≈256 秒 | 可用但慢 | 低功耗、适合离线批量 |

**官方/上游基准（单请求、1344×768、124 帧、50 步、5 秒 T2VA）**：

| 拓扑 | 精度 | 推理延迟 | 每卡峰值显存 |
|---|---|---|---|
| 8×B300（Ulysses 8） | FL2VA BF16 | 19.04 s | 83,578 MB |
| 8×B300 | FL2VA FP8 | 18.03 s | 51,926 MB |
| 8×B300 | Ref2VA BF16 | 29.12 s | 83,968 MB |
| 8×B300 | Ref2VA FP8 | 27.12 s | 52,816 MB |
| 4×H200（TP2+Ulysses2） | BF16 | 85.51 s | 63,490 MB |
| 4×H200（Ulysses4） | BF16 | 84.14 s | 94,288 MB |
| 4×H100（TP2+Ulysses2） | — | 13.25 s | 66.04 GB |
| 4×H100（TP4+Ulysses1） | — | 13.86 s | 49.80 GB |

> 注：H200 与 H100 的表不是同一 workload（H100 行上游未公布请求形状），**只能同表内比较**；FP8 主要买显存余量，不显著提速；`--use-fsdp-inference true` 可能静默产出损坏音视频（sglang#34227），**先别用 FSDP**。

**磁盘与内存**：SGLang BF16 权重约 **108GB**（DiT 61.73GB + 文本编码器 46.18GB）；vLLM-Omni 口径每分区约 134GiB（落盘 135GiB），双分区约 270GiB；Comfy-Org 量化包更小（社区整理：bf16 66.3G / pruned_bf16 40.2G / fp8·int8 21.0G / w6a8 16.0G / 文本编码器 15.69—27.14G ⚠️）。**双卡 offload 需 ≥200GiB 系统内存，推荐 384GiB。**

## 4.3 路线一：ComfyUI（最推荐个人/小团队）

### 4.3.1 需要下载的文件（Comfy-Org/MiniMax-H3）

| 组件 | 文件 | 放置目录 |
|---|---|---|
| FL2VA 扩散模型（T2V/I2V/首尾帧） | `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `ComfyUI/models/diffusion_models/` |
| Ref2VA 扩散模型（参考生成） | `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | 同上 |
| 文本编码器 | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `ComfyUI/models/text_encoders/` |
| 视频 VAE | `minimax_h3_video_vae_fp16.safetensors` | `ComfyUI/models/vae/` |
| 音频 VAE | `minimax_h3_audio_vae_fp32.safetensors`（**必须 fp32**） | `ComfyUI/models/vae/` |
| Turbo LoRA（可选） | FL2VA 8 步 / Ref2VA 4 步 | `ComfyUI/models/loras/` |
| Fun ControlNet（可选） | `alibaba-pai/MiniMax-H3-Fun-Controlnet-Union`（2.0，约 13.5GB） | 按模板放置 |

**模型体积参考**：Comfy-Org 量化后 FL2VA/Ref2VA 各约 **19.5GB**（int8 pruned；不同版本 16—21GB ⚠️）、文本编码器约 14.6GB（NVFP4）、视频 VAE 2.62GB、音频 VAE 0.58GB——**预留 60GB+ 磁盘**（含缓存与输出）。**官方模板**：T2V / I2V / I2V-continuation / R2V / Multiframe-reference / Fun-ControlNet-Union（不同版本模板清单略有差异，以官方 Template Library 为准）。

### 4.3.2 步骤与参数

1. **ComfyUI ≥ 0.35.0**（Fun ControlNet 需要；H3 原生节点从 0.30.0+ 起）；建议用 Template Library 自动下载模型。
2. 模板：T2V / I2V / R2V / Multiframe-reference / Fun-ControlNet-Union。
3. **分辨率**：Resolution Selector 用 **0.98 MP + 32 的倍数**，或直接 **1344×768**；**不要用 1.0 MP**（1376×768 超 768×1344 面积上限）。
4. **时长/帧数**：`17k+5` 网格，24fps；107—362 帧 ≈ 4.46—15.08s；124 帧 ≈ 5.17s。
5. **采样基线**：FL2VA 20 步；FL2VA Turbo 8 步（另有 4 步 768p 版）；Ref2VA 20 步、4 步 Turbo。**Turbo 必须同时改 `num_inference_steps` 与 `flow_shift`（768p Turbo 的 flow_shift 是 6，不是 12）**，否则可能被拒或输出崩坏。
6. **CFG=1、sampler `res_multistep`、scheduler `simple`**；shift video 12 / audio 3（Turbo 按配套 profile）。
7. **首帧/尾帧**：`first_frame` 直接缩放（不保比例，容易拉伸）→ 先裁成目标画幅；`last_frame` 居中裁剪 → 尾帧留安全边。
8. **参考生成（R2V）**：用 Ref2VA 模型（不能与 FL2VA 混用），按连接顺序写 `<Picture 1>/<Video 1>/<Audio 1>`。
9. **参考图缩放**：`ref_image_size` 可选 `match`（匹配画布）或 `max`（短边 2048，保细节）；角色特写/商品细节建议 `max`。
10. **控制**：Fun ControlNet Union 2.0 接 `control_video`（8 种条件：Canny/Depth/HED/MLSD/Pose/Scribble/Layout/Gray），`guidance_scale=1.0`，强度 1.0 起调；可配 mask 局部重绘。
11. **高级**：`MiniMaxH3AddGuide` 任意帧锚点；latent noise mask 做局部重绘/延长。

### 4.3.3 制作软件如何调用 ComfyUI

- 用 ComfyUI HTTP API：`POST /prompt` 提交 workflow JSON（把提示词/图片/时长/种子参数化），`GET /history/{prompt_id}` 轮询，`GET /view` 取结果；
- 为每种模式准备一个 workflow 模板（T2VA / I2VA / FL2VA / Ref2VA / ControlNet / 局部重绘），软件层只替换参数；
- 前面套一层自己的后端（FastAPI/Node）：鉴权、队列、并发限制、失败重试、结果存储、成本记录；
- **不要直接暴露 ComfyUI 到公网**（无鉴权）；ComfyUI 重启会丢任务记录，长任务必须做幂等与状态落盘。

### 4.3.4 2K 再生成（只有官方 API 能做）

- 接口：`POST /v2/video_regeneration`；输入源视频必须是 H3 768P 输出规格（**带音轨、24fps、宽高 32 倍数、面积 768×768 — 768×1344、帧数 107—362 且为 17 步进**）；
- 必须原样带上当初生成它的全部输入（**含最终提示词**）或 `source_task_id`（白名单）；
- 再生成接口 prompt 上限放宽到 **40,000 字符**，但必须是真正送入模型的最终提示词（不是用户原始话术）；
- **本地工作流的正确姿势**：本地批量出 768p → 人工筛选 → 只把选中的镜头回传 2K 再生成；`prompt_final.txt` 与素材哈希务必存档。

## 4.4 路线二：DiffSynth-Studio（脚本化/训练）

```python
import torch
from diffsynth.pipelines.minimax_h3_audio_video import MiniMaxH3Pipeline, ModelConfig
from diffsynth.utils.data.audio_video import write_video_audio

vram_config = {
    "offload_dtype": torch.bfloat16, "offload_device": "cpu",
    "onload_dtype": torch.bfloat16, "onload_device": "cpu",
    "preparing_dtype": torch.bfloat16, "preparing_device": "cuda",
    "computation_dtype": torch.bfloat16, "computation_device": "cuda",
}
pipe = MiniMaxH3Pipeline.from_pretrained(
    torch_dtype=torch.bfloat16, device="cuda",
    model_configs=[
        ModelConfig(model_id="DiffSynth-Studio/MiniMax-H3-NF4", origin_file_pattern="minimax-h3-fl2va-nf4.safetensors", **vram_config),
        ModelConfig(model_id="DiffSynth-Studio/MiniMax-H3-NF4", origin_file_pattern="minimax-h3-text-encoder-nf4.safetensors", **vram_config),
        ModelConfig(model_id="DiffSynth-Studio/MiniMax-H3-NF4", origin_file_pattern="video_vae_nf4.safetensors", **vram_config),
        ModelConfig(model_id="DiffSynth-Studio/MiniMax-H3-NF4", origin_file_pattern="audio_vae_nf4.safetensors", **vram_config),
    ],
    processor_config=ModelConfig(model_id="MiniMax/MiniMax-H3", origin_file_pattern="FL2VA/processor/"),
    vram_limit=torch.cuda.mem_get_info("cuda")[1] / (1024 ** 3) - 2,
)

video, audio = pipe(
    prompt="A girl is very happy, she is speaking in english: \"I enjoy working with DiffSynth-Studio.\"",
    height=480, width=832, num_frames=124, num_inference_steps=50, seed=0,
)
write_video_audio(video=video, audio=audio, output_path="t2va.mp4", fps=24, audio_sample_rate=32000)
```

- **最低约 7GB 显存**（NF4 + 显存管理，官方文档口径）；24GB 可跑更高分辨率；
- 支持 `keyframes/keyframe_indices`（首尾帧）、`references`（image/video/audio/video_audio）、`control_video/control_scale`（Fun ControlNet）、`retake_video/retake_audio`（局部重绘/延长）；
- 支持 LoRA/全参训练（两阶段：先 `sft:data_process` 再 `sft:train`；NF4 单阶段）；
- **适合**：批量脚本、角色 LoRA 训练、非实时后台任务。

## 4.5 路线三：SGLang 服务化（团队/多用户）

### 4.5.1 官方 Quickstart（8×B200 参考）

```bash
# 1) 固定 SGLang 源码版本
git clone https://github.com/sgl-project/sglang.git "$PWD/sglang"
cd "$PWD/sglang"
git checkout 2511743bd784e69e5a81ca3d926a000711dae4ab
python3 -m pip install --upgrade uv
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -e "python[diffusion]" --prerelease=allow
uv pip install "huggingface_hub==1.28.0"

# 2) 只下载 FL2VA 分区（固定 revision）
export HF_HOME="$PWD/hf-cache"
export MINIMAX_H3_MODEL_DIR="$PWD/model"
hf download MiniMaxAI/MiniMax-H3 \
  --revision 42ed227ee7df40d41602854ae760620d6eb651fe \
  --include "model_index.json" "FL2VA/*" \
  --local-dir "$MINIMAX_H3_MODEL_DIR"

# 3) 启动服务（--model-path 必须是仓库根目录，不能指向 FL2VA/ 子目录）
HF_HUB_OFFLINE=1 sglang serve \
  --model-path "$MINIMAX_H3_MODEL_DIR" \
  --model-variant fl2va \
  --num-gpus 8 --tp-size 1 --ulysses-degree 8 \
  --encoder-parallel auto --performance-mode speed \
  --host 127.0.0.1 --port 30010

# 4) 就绪探针（/health 返回 503 表示还在 warmup）
curl --fail --retry 60 --retry-delay 10 --retry-all-errors http://127.0.0.1:30010/health

# 5) 提交生成任务 → 轮询 → 下载 MP4
curl -fsS -X POST http://127.0.0.1:30010/v1/videos \
  -H "Content-Type: application/json" \
  -d '{"model":"MiniMaxAI/MiniMax-H3","prompt":"...","seconds":5,"task":"t2va",
       "conditions":[],"target":{"short_edge":768,"aspect_ratio":"16:9","duration_seconds":5.0},
       "num_outputs_per_prompt":1,"num_inference_steps":50,"flow_shift":12.0,"audio_flow_shift":3.0,"seed":1101}'
```

- **Ref2VA 要单独下载 `Ref2VA/*` 并起第二个服务**（`--model-variant ref2va`，另一个端口）；FL2VA 服务不能接 ref2va 请求。
- 输出：H.264 24fps + AAC 32kHz stereo 的 MP4；768 短边 16:9 → 1344×768。
- 跨节点 Ref2VA 必须 `--encoder-parallel replicate`；纯 Ulysses 会在每卡复制完整 DiT（不是小显存容量路径）；co-batching 对 H3 吞吐提升有限。
- 安全：默认只监听 127.0.0.1；对外必须加**鉴权反代/网关、TLS、配额、并发上限、输出留存、审计日志、只读素材目录**（H3 许可要求 hosted-service safeguard）。

### 4.5.2 服务化架构（给制作软件用）

```
制作软件（DSH/自研）
   │ HTTPS + API Key
   ▼
API 网关（FastAPI/Node，鉴权/限流/队列/重试/成本）
   ├─→ SGLang FL2VA :30010  （T2VA/I2VA/FL2VA）
   ├─→ SGLang Ref2VA :30011 （R2V）
   ├─→ ComfyUI :8188        （Fun ControlNet/AddGuide/局部重绘/超分）
   └─→ 外部 API 路由（Seedance/Kling/Wan/Veo，兜底或高端镜头）
   ▼
对象存储（生成结果/参考素材）+ 元数据库（任务/参数/种子/成本）
```

- **没有"零改造 OpenAI 兼容"**：SGLang 是 MiniMax 风格 JSON（`task/conditions/target`），vLLM-Omni 是 OpenAI Videos 风格 multipart（H3 专有参数放 `extra_params`，另有 `/v1/videos/sync` 直返 MP4）——无论哪条，都要自建网关。
- 任务尽量**异步**：提交→排队→轮询/Webhook→下载→入库；保存模型文件、LoRA、步数、seed、有效时长，保证可复现。
- 多用户并发时，request co-batching 对 H3 吞吐提升有限，**不要指望批处理翻倍**。

## 4.6 成本核算：本地 vs 云 vs API

**官方 API 价格（2026-11 口径）**：768P **$0.08/s**（5 秒 $0.40、10 秒 $0.80、15 秒 $1.20）；2K **$0.13/s**；Highspeed 768P **$0.06/s**；Lite 768P **$0.04/s**；768P→2K 再生成 **$0.05/s 输出 + $0.05/s 输入**（合计约 $0.10/s）。**统一口径写"$0.04—0.13/s（Lite 768P → 2K）"**，不要写成"$0.05—0.08/s"。

| 方式 | 单条 5 秒成本（估算） | 说明 |
|---|---|---|
| **MiniMax H3 官方 API** | $0.20—0.65/5s（按档位） | Lite $0.20、768P $0.40、2K $0.65 |
| **本地 768p + 官方 2K 再生成** | 约 **$0.50/5s** | 输入 $0.25 + 输出 $0.25；比直接 2K **省约 23%**（脚注：输入视频也按 $0.05/s 计） |
| **自有 RTX 4090** | 边际约 **¥0.35/条**（电费+折旧） | 但慢 8—10 倍（768p 5 秒约 5—7 分钟）；临界约 **5,900 条/年（16 条/天）** 才比 API 省 |
| **2×RTX 5090 自建** | 边际约 **¥1.6/条** | 临界约 **21,500 条/年（59 条/天）**；更适合"要质量+团队共享" |
| **云上 8×B200** | 5 秒约 **$0.32**（$7.5/卡·时、100% 利用率） | 50% 利用率约 $0.63，反超 API；只适合近满负荷 |
| **云上 4×H200** | 5 秒约 **$0.22** | 按 H200 云价 $2.68/卡·时估算 |

**结论**：**<20 条/天用 API 更省心**（加偶发本地）；**20—60 条/天**看是否有 24—48GB 卡；**>60 条/天且能跑满**再考虑多卡自建。不要只算电费——要算时间成本、失败重试、调试成本、运维成本。

## 4.7 许可与合规（务必先看）

- H3 采用 **MiniMax H3 Community License**：截至 2026-08-26 修订版，**美国、欧盟、英国、韩国为 Excluded Territories**，本地部署/托管需单独授权（**官方 API 使用不受此限制**）；
- 年收入 >2,000 万美元的商业产品或服务需 MiniMax 书面授权；商用 UI 必须显著标注 **"MiniMax H3"**；**不得用输出改进其他 AI 模型**；托管服务需具备滥用防护/内容安全/素材授权记录；管辖法为香港；
- Qwen3-VL 文本编码器为 Apache-2.0；
- **ComfyUI 官方文档**称"本地生成商用需 MiniMax 商业许可、Comfy 是唯一官方转售渠道"，与 H3 Community License 原文（营收门槛+标注义务）口径不完全一致 ⚠️——商用前建议法务确认；
- **中国大陆叠加义务**：按《AI 生成合成内容标识办法》做显式+隐式标识；按《生成式人工智能服务管理暂行办法》办理备案/安全评估（如面向公众提供服务）；肖像/声音/版权授权齐备。

## 4.8 常见坑清单（社区血泪，23 条精选）

1. `--model-path` 指向 `FL2VA/` 子目录 → 启动失败/加载错；必须指仓库根目录，用 `--model-variant` 选分区。
2. HF revision 与 SGLang commit 不可混用；固定 pin（revision `42ed227…`、commit `2511743…`）。
3. 首次启动 warmup 数分钟，`/health` 才 200；别用 `/liveness` 判断就绪。
4. 用 `--use-fsdp-inference true` → 可能静默损坏音视频（sglang#34227），先别用。
5. 分辨率用 1.0MP 档 → 1376×768 超过 768×1344 面积限制；用 0.98MP 或 1344×768。
6. **Turbo 只改步数、不改 `flow_shift`（768p Turbo=6）→ 输出崩坏/请求被拒**；steps 与 flow_shift 必须成对。
7. 音频 VAE 必须 **fp32**；用错精度会爆音/失败。
8. GGUF 文本编码器缺 `mmproj` → 必崩；GGUF 只能用于主模型。
9. 首帧不裁画幅 → 被拉伸；尾帧不留边 → 被裁掉关键内容。
10. 参考视频不是 24fps / 超过 15 秒 → 被拒或截断；音频同样限 2—15 秒、合计 15 秒。
11. 只传音频不传图/视频 → Ref2VA 可行性风险。
12. 显存不足还开 SageAttention/大 tile → 更慢；≤12GB 关掉费显存优化。
13. 笔记本 75—85°C 长时间满载 → 社区报告过 GPU 故障；量产用台式/服务器。
14. 15 秒长镜头不分段 → 角色漂移；用多段+尾帧接力。
15. 把 FL2VA 模型接到 R2V 工作流 → 效果异常；R2V 必须加载 Ref2VA。
16. 2×4090 无官方/上游实测（只有 4090 单卡、2×5090、4×H100/H200），不要照抄 5090 参数。
17. ComfyUI 重启丢任务记录；长任务要做幂等/状态落盘/结果入库。
18. 云上按需价 ≠ 实际成本：排队、冷启动、失败重试、出口带宽都要算。
19. 2K 再生成必须带"当初的最终提示词"；用用户原始话术会不匹配。
20. 别把"8×B300 19 秒"写成"8×B200 19 秒"（B200 官方未公布）。
21. Hosted 服务不做鉴权/配额/审计 → 违反许可的 hosted-service safeguard。
22. 商用 UI 不标注 "MiniMax H3" → 违反许可。
23. 用 H3 输出训练其他模型 → 违反许可。

## 4.9 三条落地路线（与第 7 章呼应）

| 路线 | 配置 | 适合 | 成本量级 |
|---|---|---|---|
| **A. 单机 ComfyUI** | 1×4090/5090（24—32GB）+ 64GB 内存 + ComfyUI + H3 int8 + Turbo + Fun ControlNet | 个人/小团队 | 硬件 ¥1.5—4 万 |
| **B. 服务化 SGLang** | 4×H100/H200 或 8×B200（云租）+ 双服务网关 + 制作软件 | 团队/对外服务 | 云 $2.7—7.5/卡·时 |
| **C. 混合** | 本地 768p 批量 + 官方 2K 再生成 + 外部 API 打高端 | 大多数实际项目 | 按量，可控 |

---

# 5. 本地/桌面制作软件盘点：开源有什么、闭源有什么

> 先明确一件事：**没有任何一个工具同时把"剧本→分镜→角色资产→3D 预演→生成→审片→剪辑"全做完且开源。** 现有方案要按"层"来选，再拼起来。
> 分类：①生成/工作流引擎；②分镜/预演/制作管理；③Blender 桥接；④一键成片/代码视频；⑤"一体化工作台"（闭源 SaaS 或未公开产品）。

## 5.1 开源方案

### 5.1.1 生成与工作流引擎

| 工具 | 定位 | 核心能力 | 是否自带模型 | 依赖外部 LLM | 适合 |
|---|---|---|---|---|---|
| **ComfyUI** | 节点式生成工作流（事实标准） | H3/Wan/LTX 原生或插件；生成/编辑/超分/补帧；HTTP API 可编程 | 否（需下载权重） | 否（可选接 LLM 节点） | 所有本地生成场景 |
| **ComfyUI MiniMax H3 原生节点** | H3 官方集成（≥0.30） | T2V / I2V+首尾帧（FL2VA）/ R2V（Ref2VA）/ V2V / 任意帧 `MiniMaxH3AddGuide` / latent 遮罩局部重绘 | 否 | 否 | H3 本地制作核心 |
| **ComfyUI_MiniMaxH3_Director**（AIMixer，Apache-2.0） | 第三方"导演台"插件 | 多段时间轴、t2v/i2v/fl2v/r2v/v2v/rv2v 任务、首尾帧分组、参考素材组（图≤9/视频≤3/音频≤3）、段间引导、二采/放大、导演包导入导出 | 否 | 否 | 在 ComfyUI 内做"多镜头时间轴" |
| **ComfyUI-BlenderAI-node v2.0.0** | Blender↔ComfyUI 桥接 | 把 ComfyUI 节点"翻译"成 Blender 节点；相机输入、合成数据输出、批量队列 | 否 | 否 | 在 Blender 内直接跑 AI |
| **Comfy MCP / Comfy CLI / Comfy Agent**（2026 官方） | 让 Agent 操作 ComfyUI | 把本地 ComfyUI 暴露给 Claude/Codex/Cursor，构建并运行工作流 | 否 | **是**（Agent） | 自动化/Agent 驱动 |
| **DiffSynth-Studio** | 推理+训练框架 | H3 NF4（最低约 7GB 显存）、LoRA/全参训练、retake/control_video | 否 | 否 | 批量、训练、脚本化 |
| **Wan2GP** | 低显存 WebUI | Wan 2.1/2.2、Hunyuan、LTX、Flux；内置离线 **Deepy Agent**；8GB 可跑 | 否 | 否（Deepy 为本地 Agent） | 低配机器/离线 |
| **FramePack** | 长视频生成 | 6GB 显存长视频 | 是（自带模型） | 否 | 低配长视频实验 |

### 5.1.2 分镜 / 预演 / 制作管理（2026 新秀，重点）

| 工具 | 定位 | 关键能力 | 成熟度/许可 |
|---|---|---|---|
| **OpenCinema** | 本地优先的 AI 视频工作室（画布 + Agent） | 13 类节点：脚本/参考/Blockout/3D Director/生成/视频分析/运动/深度/审片/编辑计划；Blockout 导出 **RGB + Depth + Normal + animatic**；Codex/Claude Code 通过 MCP 读写画布、与人共用命令/撤销；ComfyUI 工作流导入为"模型"；审片 6 项检查；编辑计划 2—16 镜头可替换单镜；资产库/项目包/协作 | **0.4.0 预览、未正式发布**；Windows 暂不支持，界面中文；MIT ⚠️ |
| **Timeline Studio**（ai-video-editor 白模原型） | 浏览器端 3D 白模预演 | Three.js 视口、角色走位/停留/切镜/剧本共用一条时间轴、场景 JSON、1280×720 WebM 导出；AI 通过 `blockout_scene_edit` 提交结构化修改建议，经校验+人工审阅后应用 | 原型；无 IK/碰撞/表情；"白模→一键成片"未打通 ⚠️ |
| **Whitebox Workbench** | 白膜场景搭建/分镜预演 | 6 种预设环境 + 33 个预设资产（人物/车/房间），可导入任意模型 | 2026-10 活跃新项目 ⚠️ |
| **Frametell** | 开源本地 AI 视频工作室 | 一句话启动本地浏览器 studio；导演 Agent 先出**分镜待批准**，再写旁白/字幕/发布说明 | 开源、2026-10 活跃 |
| **Storyboarder**（Wonder Unit） | 传统分镜/故事板 | 速写分镜、Shot Generator（3D 机位/镜头类型/IK 姿势/VR）、PDF/animatic | 最后正式版 v3.0.0，**维护基本停滞** |
| **Kitsu**（CGWire） | 动画/VFX 制作管理 | 镜头/资产/任务/审片/统计；开源自托管；云版约 €20—35/用户/月；2026 试水分镜拆解/剧本分析/MCP，社区有 `kitsu-mcp` | 成熟（非 AI 原生），适合团队协作层 |
| **OpenTimelineIO（OTIO）** | 时间线交换格式/库 | 剪辑/轨道/片段的可交换 JSON 模型；v0.17 支持 VFX Reference Platform 2023—2027 | 成熟基础件，**不是应用**；自建剪辑层正确底座 |

### 5.1.3 一键成片与代码视频

- **MoneyPrinterTurbo**：主题→脚本（LLM）→图库素材→TTS→字幕→合成，v1.3.3（2026-07）仍维护；**强依赖外部 LLM**、不接视频生成模型。
- **NarratoAI**：解说/混剪，v0.8.6（2026-07）新增 IndexTTS-2/MLX、短剧混剪脚本、剪映导出；依赖 LLM+TTS，仍是"素材拼装"。
- **ShortGPT**：**已停滞**（2025 初停更、转付费 ShortX），不建议新项目采用。
- **Remotion**：React/TS 代码化生成视频（确定性、可版本控制、可 CI 渲染），适合片头/数据可视化/程序化字幕；个人/小公司免费、公司版 $100/月起。2026 年"Vibe Video"使其回潮；**不依赖视频生成模型**，LLM 只用于写代码。
- **其他 2026 活跃项目**：`varg previz`（多镜头预演 Agent skill + app，先锁角色/场景卡）、`blender-shot-video`（Claude Code skill：文字→脚本→首帧→Blender 灰模预演→视频）、`blender-video-workflows`（Codex skills：参考视频复刻/白模动画→提示词→视频）。质量参差，选型前看 VALIDATION。

### 5.1.4 Blender 桥接

- **BlenderMCP**（ahujasid/mcp-for-blender）：MCP 服务器+Blender 插件，LLM（Claude/Codex）可自然语言建模、改材质、摆相机、截图、接 Poly Haven/Sketchfab/Hyper3D；2026 年约 **3 万 stars**、活跃，社区有"92 工具"增强分支。**必须依赖外部 LLM Agent**，Blender 侧本身不需联网。
- **ComfyUI-BlenderAI-node v2.0.0**、**Dream Textures**（Blender 内置 SD，维护放缓，只做贴图/概念图）。

## 5.2 闭源方案：先分清"制作层"与"生成/编辑层"

### 5.2.1 制作软件层（含明显的流程/分镜/时间线能力）

| 工具 | 定位 | 关键能力 | 价格 |
|---|---|---|---|
| **Runway** | 一体化创作平台 | Workflows + Edit Studio + Aleph 2.0 + Agent、App Studio、Runway Ads、多模型聚合 | $12—76/月（年付） |
| **LTX Studio** | 故事板→视频工作台 | 剧本/分镜/角色一致性/时间线/生成 | $15/35/125 每月 |
| **预演软件 1.0.19** | 国产本地 AI 影视工作台（已拆解确认） | 导演台/3D 导演台（WASD 掌镜、双轨时间轴、白模预演、导出参考视频/截图进资产库）、导演取景器（26 体素组件、8 运镜预设、4 预设场景）、AI 虚拟摄影机、全景一键生成、交互叙事、摄像机库、演员库/服装/地点/道具 | 闭源；已拆解确认 1.0.19 |
| **Unreal Engine 5.8** | 虚拟制片/实时预演 | 高精度场景、LED 虚拟制片、实时合成 | 免费+分成 |
| **DaVinci Resolve 21.1** | 专业剪辑/调色 | 剪辑/调色/混音；接入 Claude/ChatGPT Codex 助手 | 免费版/Studio ¥1,698 |
| **节点动画软件** | 动态图形 | 程序化动效；Canva 收购后个人免费 ⚠️ | 免费/付费 |
| **Flow Studio**（原 Wonder Studio） | AI 角色替换 | 视频中替换 CG 角色、匹配光照/动作 | Free / Lite $10/月 |

### 5.2.2 生成/编辑模型层（不是"制作软件"）

- **Krea**（实时画布/多模型）、**Pika**（H3 Flex：480p **$0.02/s**、768p **$0.04/s**，发布价半价）、**Higgsfield**（Soul/DoP/Speak + MCP）、**Hedra/HeyGen**（数字人）、**视频增强软件**（超分/补帧）、**Adobe Firefly/Substance**（设计/材质）、**Higgsfield**。
- **Sora 已关停**（网页/App 2026-04-26、API 2026-09-24），不应再列为可选方案。

## 5.3 功能矩阵：谁真正覆盖"复杂制作"

| 能力 | ComfyUI+H3 | DiffSynth | OpenCinema | Blender+MCP | Runway | LTX Studio | 预演软件 | DSH 自建 |
|---|---|---|---|---|---|---|---|---|
| 文/图/参考生成 | ✅ | ✅ | ✅（接后端） | — | ✅ | ✅ | ✅（H3） | ✅（接后端） |
| 首尾帧/多镜头 | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| 角色三视图/资产库 | 手动 | 手动 | ✅（资产库/项目包） | 部分（3D） | 部分 | 部分 | ✅（演员/服装/地点/道具） | ✅（自建） |
| 3D 预演/机位 | 插件 | — | ✅（Blockout/3D Director） | ✅ | 部分 | 部分 | ✅（3D 导演台/取景器） | ✅（接 Blender） |
| 分镜/故事板管理 | 弱 | 弱 | ✅（编辑计划 2—16 镜） | — | ✅ | ✅ | ✅ | ✅（自建） |
| 生成队列/批量 | 有限 | ✅（脚本） | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| 审片/QC | 手动 | 手动 | ✅（6 项人工检查） | — | 部分 | 部分 | ✅（空间精度验收） | ✅（自建） |
| 时间线/剪辑 | 需外接 | 需外接 | 部分（编辑计划） | 需外接 | 部分 | ✅ | ✅（素材与成片） | 需外接/自建 |
| 本地部署/私有化 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 部分（本地 H3） | ✅ |
| 依赖外部 LLM | 可选 | 否 | **是（Agent/MCP）** | **是** | 部分 | 是 | **是（Codex MCP）** | 可选 |
| 成熟度 | 高 | 中高 | **0.4 预览** | 高（Blender） | 高 | 高 | 内测 ⚠️ | 自研 |

## 5.4 依赖与断网可用性

| 层级 | 必须外部 LLM 的功能 | 必须外部视频 API 的功能 | 可全离线 |
|---|---|---|---|
| **A 全离线** | — | — | ComfyUI + 本地权重 + 本地 LLM（Ollama/Qwen/DeepSeek 蒸馏）+ 本地 TTS + Resolve/Blender VSE |
| **B 首次联网后离线** | — | — | ComfyUI 装完节点/权重后；DiffSynth/Wan2GP/FramePack 权重下载后 |
| **C 必须在线** | 剧本/分镜/提示词扩写、BlenderMCP、Comfy MCP、OpenCinema/Codex MCP、DaVinci 21.1 AI 助手、Krea Agent、Kitsu AI、一键成片类 | H3 官方 API、Wan 3.0、Kling 4.0、Seedance 2.5、Veo 3.1、所有 SaaS | 无 |

**结论**：**LLM 依赖集中在"上游文本 + Agent 操作"**；纯生成工作流（ComfyUI + 本地权重）不需要外部 LLM。**断网可用性 A 档是可能的**——这是本地化路线相对 SaaS 的核心优势。

## 5.5 关键结论

1. **"生成引擎"开源已足够强**：ComfyUI + H3/Wan/LTX + DiffSynth 覆盖生成、控制、重绘、训练；**短板在"制作管理"与"审片工作流"**。
2. **"制作软件层"正在 ComfyUI 内部生长**：H3 Director 插件把多段时间轴、首尾帧组、参考素材组整合进单节点，但仍缺项目/角色/QC/协作。
3. **开源最接近"用户设想"的是 OpenCinema**（本地优先、画布、Blockout→RGB/Depth/Normal/animatic、MCP Agent、审片/编辑计划），但 **0.4 预览/未发布/Windows 不支持**，短期不能当生产工具。
4. **闭源一体化工作台最接近的是预演软件 1.0.19**（3D 导演台/取景器/白模预演/演员库；已由用户拆解确认），但闭源、无公开价格与模型接入细节。
5. **依赖外部 LLM 不是缺点**：脚本/分镜/提示词编译/Agent 调度用外部 LLM（Claude/GPT/Codex/DeepSeek）效果远好于本地小模型；**关键是把"创意/编译"与"生成/渲染"解耦**。
6. **自建的正确姿势**：不自研模型、不自研 3D 引擎，**做"中间层"**——项目/分镜/资产/提示词编译/任务队列/审片/多后端路由。这是 DSH 这类 Agent Harness 的强项（见第 6 章）。

## 5.6 预演软件案例拆解（已核实 + 未核实分开）

> **更正（2026-11-05）**：预演软件 1.0.19 已由用户完整拆解确认（`F:\AI视频\功能拆解\预演软件\`），是真实的闭源 Windows 客户端；`<原产品官网域名>` 是"同名编程语言"，不是该视频软件官网。以下区分拆解证据与截图/公告推断。

**已公开核实**（官网/公告/文档中心口径）：

- **3D 导演台**：WASD 掌镜、双轨时间轴、白模预演、导出参考视频/截图进资产库；
- **导演取景器**：26 种体素组件、8 种运镜预设、4 个预设场景；
- **AI 虚拟摄影机**、**全景一键生成**、**交互叙事**、**摄像机库**；
- 资产侧：演员库、服装、地点、道具、素材/场景库；
- 内容形态：小说/名著阅读视频、AI 演唱、AI 圆桌会议、无限画板、画图。

**截图可见（未公开版本 ⚠️）**：五步流水线（分段剧本→分镜设计→故事板图片→H3 提示词→H3 视频，带完成计数）、13 段/45 秒规划、26 机位预设下拉、版本管理、Codex MCP、任务中心、空间精度验收（对比 3D 截图与生成画面）。

**推断架构**（与本文推荐方案高度一致）：

```
小说/剧本 → LLM 拆分章节/分段 → 分镜设计（镜头卡） → 故事板图（图像模型）
    → 3D 导演台（Blender/Three.js 场景 + 机位预设）→ 渲染色模/深度/机位图
    → H3 提示词编译器（结构化）→ H3 生成（本地或 API）→ QC（对比 3D 源图）
    → 素材与成片（剪辑/导出）
```

**启示**：预演软件把"3D 预演"做成了**镜头级、可版本化、可验收**的资产，而不是一次性工具；把"H3 提示词"做成**流水线的一步**（带完成计数、批量补齐），而不是让用户逐条手写。这两点是自建软件最值得抄的。

---

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

# 7. 三档落地方案与决策建议

> 目标不同，方案完全不同。下面按"个人 / 小团队 / 工作室"给三档，并在最后给"混合策略"——这也是面对字节 Seedance 闭源涨价最现实的答案。

## 7.1 方案 A：个人/单机（预算 1.5—4 万元）

**硬件**：RTX 4090 24GB 或 RTX 5090 32GB（台式，散热好）+ 64GB 内存 + 2TB NVMe；有 3D 需求再加一台普通显示器/数位板。

**软件栈**：
- 生成：**ComfyUI + H3 int8 pruned + Turbo LoRA（4/8 步）+ Fun ControlNet Union**；备选 Wan 2.2-TI2V-5B（低显存/控制）；
- 预演：**Blender**（灰模/机位/depth 渲染），可选 Blender MCP 让 Agent 操作；
- 制作管理：**DSH Studio 插件（或轻量自研 Web）+ 镜头卡 JSON**；初期可直接用 DSH Agent + 工具跑；
- 后期：**SeedVR2/FlashVSR 超分 + RIFE 补帧 + 剪映/DaVinci 剪辑 + Whisper 字幕**；
- 兜底：外部 API（MiniMax H3 API、可灵、即梦）用于高端镜头/赶工。

**工作流**：分镜 → Blender 摆机位渲首帧+depth → ComfyUI 用 FL2VA（首帧）或 Fun ControlNet（depth）生成 5—8 秒 768p → 4 步 Turbo 先出草稿、挑中后 8/20 步重出 → SeedVR2 超分到 1080p → 剪辑。
**成本/速度**：设备一次性 1.5—4 万；单条 5 秒约 2—8 分钟；电费可忽略；每月 100 条以内比 API 贵（设备折旧），但**可控、可私密、不会涨价/关停**。

**适合**：个人 IP、独立短片、角色一致性要求高、愿意折腾的创作者。

## 7.2 方案 B：小团队（预算 5—20 万元，或云租）

**硬件**：
- 路线 1：**4×RTX 4090/5090 工作站**（96—128GB 总显存）+ 256GB 内存 + NAS；用 vLLM-Omni（2 卡 TP+offload）或 ComfyUI 多实例；
- 路线 2：**1×H100 80GB**（云或自建）跑 SGLang/vLLM-Omni 单卡服务；H100 能常驻 int8 权重，出片快；
- 路线 3：**2×RTX 5090 + 384GB 内存**的 vLLM-Omni offload 方案（社区验证）。

**软件栈**：
- **SGLang（或 vLLM-Omni）双服务**：FL2VA + Ref2VA，暴露 `/v1/videos`；
- **API 网关**：鉴权、队列、并发、重试、成本台账、结果存储（FastAPI/Node）；
- **DSH Studio（或自研 React 前端）**：项目/镜头卡/资产库/生成队列/审片；
- **Blender 工作站** + Blender MCP：统一机位模板与渲染规范；
- **ComfyUI**：Fun ControlNet、局部重绘、超分、音频工具；
- 外部 API 作高端/兜底。

**成本**：4×4090 工作站约 8—12 万；单条 5 秒分摊成本可降到几毛—2 元；团队共享后产能 >50—100 条/天。
**适合**：短剧/漫剧小团队、广告工作室、MCN 内容组。

## 7.3 方案 C：工作室/对外服务（预算 50 万+ 或云租）

- **8×B200/B300 节点**（官方参考配置）或 **4×H100/H200**（实测可用）跑 SGLang；
- FL2VA 与 Ref2VA 双服务 + 跨节点 Ring（16 卡）扩展；监控/日志/配额/审计；
- 2K 精修镜头走 **MiniMax 平台 `/v2/video_regeneration`**（本地 H3-Base 只出 768p）；
- 高端写实/30 秒多镜头走 **Seedance 2.5 / Kling 4.0 / FLUX 3 Max**，本地 H3 负责批量/私密/角色一致性镜头——**混合路由**；
- 制作软件：DSH Studio 或自研平台 + Blender 预演 + QC 流水线 + 成本核算。

**成本**：8×B200 云节点按小时计费，适合"项目制"而非长期常驻；自建需机房/电力/运维。**只有日产能 >200—500 条或对外提供 API 时才划算。**

## 7.4 混合策略（最现实、也是本文推荐）

**不要二选一，做"多后端路由"**：

| 镜头类型 | 推荐后端 | 理由 |
|---|---|---|
| 角色一致性/私密/批量 | **本地 H3**（Ref2VA/FL2VA） | 无 API 费用、可训练 LoRA、许可内可控 |
| 需要 Blender 结构/运镜 | **本地 H3 + Fun ControlNet** 或 **Wan 2.2 VACE** | 有控制视频能力 |
| 30 秒多镜头/50 项参考 | **Seedance 2.5**（外部 API） | 开源没有同等能力 |
| 4K/HDR/长镜头 | **Kling 4.0 / LTX-2.5 / Luma Ray3** | 本地 H3 只有 768p |
| 高端写实/电影感 | **FLUX 3 Max / Veo 3.1 / Seedance** | 质量上限 |
| 草稿/低价值批量 | **H3 4 步 Turbo / Seedance mini / Vidu Q4** | 成本最低 |
| 交付级分辨率（2K） | **本地 H3 768p + 官方 Regenerate-2K** | 比直接 2K API 省约 23% |
| 编辑/重绘 | **Wan 2.2 VACE / H3 latent mask / Runway Aleph** | 局部修改不重生成 |

**路由原则**：先按"控制需求/时长/分辨率"筛，再按"成本/隐私/交期"选；**永远保留至少一个本地后端**（H3 或 Wan 2.2），避免被单一厂商"卡脖子"。

## 7.5 对"字节不做人"的应对

Seedance 2.5 的能力确实强（30 秒、50 项参考、时间戳），但闭源、按量计费、价格高（AA 折算 $34/分钟）、平台规则多变（即梦涨价、会员权益调整）。现实策略：

1. **本地 H3 打底**：日常镜头、角色一致性、私密素材用 H3；它的质量在开源里最强（AA 开放权重第一），许可在中国大陆可用；
2. **外部 API 只买"本地做不到的"**：30 秒多镜头、4K、极端写实；按项目预算设上限；
3. **关注开源替代进度**：H3 衍生模型（H3 Max、Hyperflow）、Wan 2.2 VACE（控制/编辑）、LTX-2.5（4K/音频）、MAGI-2（许可最干净但 8×H100）；每月看一次 AA 开放权重榜；
4. **把"提示词/镜头卡/角色库"资产化**：这些不随模型更换而贬值，换模型只需重编译；
5. **合规**：H3 区域限制、肖像/声音授权、AI 标识；商用前核对许可。

**算账（2026-11 官方口径）**：官方 API 768P **$0.08/s**（5 秒 $0.40）、Lite **$0.04/s**、2K **$0.13/s**；**本地 768p + 官方 2K 再生成约 $0.50/5s，比直接 2K 省约 23%**；自有 RTX 4090 边际约 **¥0.35/条**但慢 8—10 倍，临界约 **5,900 条/年（16 条/天）**；2×RTX 5090 临界约 **21,500 条/年（59 条/天）**；云 8×B200 5s≈**$0.32**（100% 利用率），50% 利用率反超 API。**<20 条/天优先 API；20—60 条/天看现有硬件；>60 条/天且能跑满再自建。**

## 7.6 决策树：你该选哪档

```
是否已有 24GB+ NVIDIA 显卡？
├─ 是 → 方案 A（ComfyUI + H3 + Blender）；产量大/要共享再升级 B
└─ 否 → 每月生成量？
   ├─ <100 条 → 外部 API（H3 API / 可灵 / 即梦）+ 轻量制作软件（DSH/自研）
   ├─ 100—1000 条 → 云租 4090/H100 自建 ComfyUI/SGLang（按项目）；或方案 B
   └─ >1000 条/对外服务 → 方案 C（多卡 SGLang + 混合路由）
```

**最后三条建议**：

1. **先跑通"一个镜头"再买硬件**：用云 4090 或 H3 API 验证你的提示词/输入包/QC 流程，确认能出片再投入；
2. **软件比模型重要**：同样的 H3，有镜头卡/提示词编译/QC 的团队，产出质量和效率高一个量级；
3. **保留退路**：任何单一模型/平台都可能涨价/关停（Sora 已示范），多后端 + 本地兜底是唯一稳妥解。

---

# 8. 附录：输入包模板、提示词模板与速查

## 附录 A H3 镜头输入包 JSON（精简 schema，完整版见 `模板/H3镜头输入包.schema.json`）

```json
{
  "shot_id": "EP01-SC03-SH012",
  "mode": "ref2va",
  "duration_s": 8,
  "ratio": "16:9",
  "canvas": [1344, 768],
  "engine": {
    "backend": "local_comfyui",
    "model": "minimax_h3_ref2va_pruned_int8",
    "mode": "ref2va",
    "steps": 4,
    "sampler": "res_multistep",
    "scheduler": "simple",
    "shift_video": 12,
    "shift_audio": 3,
    "seed": 1101
  },
  "assets": [
    {"label": "<Subject 1>", "role": "identity", "files": ["refs/charA_front_1536.png", "refs/charA_34_1536.png"], "retention": "fully_preserved"},
    {"label": "<Subject 2>", "role": "scene", "files": ["refs/scene_stage_wide.png"], "retention": "fully_preserved"},
    {"label": "<Video 1>", "role": "camera", "files": ["refs_motion/camera_ref.mp4"], "retention": "weak_reference"},
    {"label": "<Audio 1>", "role": "timbre", "files": ["audio/voice_s1.wav"], "retention": "reference"}
  ],
  "keyframes": {"first": "previz/frame_first.png", "last": null},
  "control": {"type": "depth", "file": "previz/depth.mp4", "strength": 1.0},
  "prompt_file": "prompt/prompt_final.txt",
  "speakers": {"S1": "charA"},
  "delivery": {"target": "1080p", "upscale": "SeedVR2"},
  "qc": {"checks": ["identity", "depth_similarity", "pose", "audio_sync", "text", "physics"]}
}
```

**schema 要点**：

- `mode` 只能是 `t2va | i2va | l2va | fl2va | ref2va`；`ref2va` 与关键帧模式互斥；
- `assets` 的 `label` 必须与提示词中的标签一一对应，编号按模态独立、按槽位顺序；
- `retention` 取 `fully_preserved | partially_preserved | attribute_transfer | weak_reference`（音频用 `fully_copy | partially_copy | reference | weak_reference`）；
- `control` 只在本地 ComfyUI/ControlNet 路线使用；官方 API 没有 depth/pose 输入；
- `prompt_file` 保存**最终送入模型的提示词**（不是用户草稿），2K 再生成必须原样回放。

## 附录 B 提示词模板

### B1 基础三段式（T2VA / I2VA / L2VA / FL2VA）

```text
integrated_multimodal_description: [Shot 1] Live-action cinematic, cold night tones, ... The camera pushes in with small amplitude at slow speed as ... [Shot 2] At 00:03.500, the camera cuts to ... The adult woman (S1) says: <d>[Chinese] 我们走吧。</d>

overall_soundscape: Rain hits the awning and pavement; distant traffic hums; footsteps approach.

non_diegetic_music: N/A
```

关键帧模式在正文前加对齐指令（空一行）：

```text
# FL2VA
How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture 2 (from [Shot 1]) aligns with the 8.00-second mark of the target video.
```

### B2 Ref2VA 六段式骨架

```text
subject_definitions:
<Subject 1> is the woman in <Picture 1>; preserve facial identity, hairstyle, red jacket, silver earrings.
<Subject 2> is the walking cadence and hand movement shown in <Video 1>.
<Video 1> provides the tracking-camera direction and broad beat timing.
<Audio 1> is the voice-timbre reference for <Subject 1> (S1).

summary:
[reference generation + audio reference] Generate ... preserving <Subject 1>, transferring <Subject 2>'s movement, following <Video 1>'s camera rhythm, using <Audio 1> as voice reference.

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - preserve identity, hairstyle, jacket, earrings.
<Subject 2> ([Shot 1] movement): attribute_transfer - transfer walking cadence and hand timing.
<Video 1> (camera and pacing): weak_reference - follow broad direction and beat timing without copying frames.
<Audio 1>: reference - follow timbre and delivery without copying the waveform.

detailed_description:
Cinematic live-action street photography, soft morning light, restrained handheld movement. [Shot 1] A medium tracking shot follows <Subject 1> walking along a quiet covered market corridor ... She follows <Subject 2>'s relaxed cadence and synchronized right-hand gesture ... The adult woman with the referenced calm voice (S1) says: <d>[Chinese] 今天早点回家。</d>

overall_soundscape:
Footsteps echo lightly beneath the covered walkway while fabric moves against the jacket. Distant vendors and soft city hum remain.

non_diegetic_music:
N/A
```

### B3 台词/演唱/画外音写法（要点）

- 说话人按首次发声顺序编号 `(S1)`、`(S2)`；沉默角色不编号；多人同声写 `(S1,S2)`；
- 原话放 `<d>[Chinese] 原话</d>`，不翻译、不改写；
- 画外音：`says in an off-screen voiceover`，并说明画面人物嘴唇闭合；
- 跨切镜的同一句：`<scenetrans>` 并说明声音连续；结尾截断：`<cutoff>`；
- 画面可见文字：英文双引号逐字保留（如 `a sign reading "营业中"`）；
- **不要写负向提示词**（H3 无负向通道），把"不要 X"改写成正向约束或场景状态。

## 附录 C Blender 预演交付清单（镜头级）

- [ ] 场景/角色为**纯灰白模**（避免贴图被当平面图）；机位、景别、遮挡关系准确；
- [ ] 首帧/尾帧按目标画幅渲染（16:9 → 1344×768；竖屏 768×1344）；
- [ ] 输出 **depth 序列**（24fps、与目标时长一致、≤15s）；需要动作控制再输出 **pose 序列**；需要硬边/建筑再输出 canny/MLSD；
- [ ] 导出 `camera.json`（机位/焦距/关键帧）供软件记录，并转成"运镜词 + 参考视频"写进提示词；
- [ ] 角色三视图另出 2—4 张独立高清图（2048 短边），**不要合成 3×3 网格**；
- [ ] 动作参考视频（playblast/动捕）2—15 秒、24fps；如含灰模外观，提示词声明"仅迁移动作/节奏，不迁移材质/光照"；
- [ ] 将上述文件放入 `previz/` 与 `refs/`，由软件写入 `shot.json`；
- [ ] QC：生成后抽帧与 depth/pose/首帧对比，记录偏差与返修结论。

## 附录 D 部署速查（2026-11 口径）

| 问题 | 答案 |
|---|---|
| 个人最低配置 | 16GB 显存 + 32GB 内存（社区"稳定制作"口径）；24GB 更顺 |
| 最省事路线 | ComfyUI + Comfy-Org 量化权重 + Template Library |
| 最低显存路线 | DiffSynth-Studio NF4（约 7GB 显存可跑） |
| 团队服务化 | SGLang 双服务（FL2VA/Ref2VA）+ 自建网关；官方参考 8×B200 |
| 单卡 4090 速度 | 768p/20 步约 6.8 分钟；int8 约 5 分钟；int8+Spectrum 50 步约 2.7 分钟 |
| 输出规格 | 768p 短边、24fps、32kHz 立体声、4—15s、107—362 帧 |
| 2K 怎么做 | 官方 `/v2/video_regeneration`（回传最终提示词）或后期超分 |
| 官方 API 价格 | $0.04—0.13/s（Lite 768P → 2K）；768P $0.08/s |
| 许可红线 | 排除美/欧/英/韩本地部署；>$2,000 万营收需授权；商用 UI 标注 "MiniMax H3" |
| 最常踩的坑 | model-path 指错、revision 混用、Turbo 不改 flow_shift、音频 VAE 非 fp32、FSDP 损坏输出 |

## 附录 E 主要来源

**H3 官方/生态**
- MiniMax H3 本地部署（官方）：https://platform.minimax.io/docs/guides/local-deploy-h3
- MiniMax H3 模型仓库：https://huggingface.co/MiniMaxAI/MiniMax-H3
- MiniMax H3 许可：https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE
- SGLang H3 Cookbook：https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3
- ComfyUI H3 原生教程：https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native
- ComfyUI H3 Fun ControlNet Union：https://docs.comfy.org/tutorials/video/minimax/minimax-h3-fun-controlnet
- Comfy-Org H3 模型索引：https://huggingface.co/Comfy-Org/MiniMax-H3
- DiffSynth H3 文档：https://github.com/modelscope/DiffSynth-Studio/blob/main/docs/zh/Model_Details/MiniMax-H3.md
- 官方提示词技能：https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills/h3-prompt-writing
- H3 提示词/素材引用指南（社区整理）：https://github.com/siyuan-liu31/minimax-h3-video-studio/blob/main/docs/h3-prompt-guide.md
- H3 Ref2VA 格式规范：https://github.com/dzesen/minimax-h3-reference-prompt/blob/main/references/format-spec.md
- 2K 再生成 API：https://platform.minimax.io/docs/api-reference/video-generation-v2-regeneration

**制作软件/Blender**
- BlenderMCP：https://github.com/ahujasid/blender-mcp
- blender-agent-studio：https://github.com/ifBars/blender-agent-studio
- ComfyUI：https://github.com/comfyanonymous/ComfyUI
- ComfyUI-BlenderAI-node：https://github.com/AIGODLIKE/ComfyUI-BlenderAI-node
- ComfyUI-MCP（previz-to-video 设计）：https://github.com/artokun/comfyui-mcp
- OpenTimelineIO：https://github.com/AcademySoftwareFoundation/OpenTimelineIO
- Kitsu：https://github.com/cgwire/kitsu
- Remotion：https://github.com/remotion-dev/remotion
- Blender→ComfyUI AI Renderer 2.0：https://www.runcomfy.com/comfyui-workflows/blender-to-comfyui-ai-renderer-2-0-workflow-cinematic-video-output

**软件/产品**
- 预演软件 1.0.19（拆解证据：`F:\AI视频\功能拆解\预演软件\`；`<原产品官网域名>` 为编程语言，勿当视频官网）
- Runway：https://runwayml.com
- LTX Studio：https://ltx.studio
- OpenCinema（仓库/状态以官方为准，⚠️ 0.4 预览）：可在 GitHub 搜索 "OpenCinema"
- Comfy Cloud：https://www.comfy.org/cloud

**本文未逐项核实的社区来源已在各章标 ⚠️；完整来源见 `研究资料/06-H3部署实操.md`、`07-H3输入素材与提示词规范.md`、`08-本地制作软件与Blender工作流.md`。**

## 附录 F 方法与局限

- 本文的 H3 规格以 MiniMax 官方文档/模型卡/ComfyUI 官方教程为主，社区实测单独标注；预演软件的公开公告与截图功能已分开标注；
- 部署性能数字来自官方/上游 benchmark，**不同请求形状/分辨率/步数不可直接比较**；8×B200 官方未公布延迟，文中 19 秒为 8×B300 上游数据；
- 成本为估算，云价/电价/折旧随地区与时间变化；
- 自建工作量估算基于 1 名有经验全栈，实际受团队能力、UI 复杂度、协作需求影响；
- 模型与价格每月变化，部署前请以官方页面复核。

---
