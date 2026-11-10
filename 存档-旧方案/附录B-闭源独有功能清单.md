# 附录 B：闭源独有重要功能清单（v2，已做真实性核查）

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《AI视频本地制作软件与DSH插件工程规划-v2.md》。本附录回答：**闭源软件里做得好的功能有哪些、分别做什么、属于谁、为什么开源没有、我们怎么替代或自研。**
> **真实性**：2026-11-04 初核，2026-11-05 根据用户拆解更新。详细证据见《闭源软件真实性核查-2026-11-04.md》与《附录D-预演软件拆解复用清单》。**预演软件 1.0.19 已由用户拆解证实真实存在**；<原产品官网域名> 是编程语言，不是视频官网；CoolShowAI 与预演软件的关系仍【未知】。
> **边界**：只做黑盒功能观察与 clean-room 功能规格，不破解授权/DRM、不绕过付费、不复制闭源代码/权重/素材；每个功能由你独立决定"自研 / 开源替代 / 买 / 跳过"。

## B0. 真实性核查结论（先看这一段）

| 软件 | 核查结果 | 处理 |
|---|---|---|
| **预演软件 1.0.19**（预演软件-短剧漫剧创作平台） | **已由用户完整拆解证实真实存在**（`F:\AI视频\功能拆解\预演软件\`）：Tauri 2.11.2 + Bun 预演引擎进程（4318/MCP 15 工具）+ Python voice-sidecar（8765/34 API）+ 6 Studio + 26 节点画布 + 4 套 3D 子应用；<原产品官网域名> 仍是编程语言，不是视频官网；CoolShowAI 与预演软件关系仍【未知】 | 只作**架构/功能对照**；3D 预演主路径用 **DirectorDesk（MIT）**；不 vendor 预演软件 exe/前端/资产 |
| **DirectorDesk** | 真实开源（mangfufu/预演工作台，MIT，v0.5.2），白模/机位/运镜/深度视频/内置 AI + MCP | **直接复用为 3D 预演模块** |
| Runway / LTX Studio / Autodesk Flow Studio / UE 5.8 / DaVinci Resolve 21.1 / 视频增强软件 / HeyGen / Hedra / 节点动画软件 / Kitsu / CapCut / 即梦 | 官网/官方页面已核实（详见核查备忘录） | 按 B2 逐项处理 |
| 旧研究中"预演软件官网 <原产品官网域名> 提供客户端" | **错误** | 已修正 |

## B1. 总表：闭源重要功能一览

| # | 功能 | 代表软件（已核实） | 做什么 | 价值 | 建议 |
|---|---|---|---|---|---|
| 1 | **3D 白模预演/导演台/机位** | **DirectorDesk（开源 MIT）**；参考预演软件/CoolShowAI、UE | 白模搭景、摆位、走位、多机位、运镜、导出参考视频/截图 | 把镜头语言变成可执行预演 | **直接用 DirectorDesk**，不自研 |
| 2 | **五步制作流水线 + 空间精度验收** | 预演软件 1.0.19（已拆解）；OpenCineAgent（开源） | 小说→分段剧本→分镜→故事板→H3 提示词→H3 视频；生成画面与 3D 截图对比 | 中文短剧/漫剧生产链 | 参考交互，自研看板/镜头卡/QC |
| 3 | **In-context 视频编辑** | Runway Aleph 2.0 / Edit Studio（2026-05-20） | 文本+图像控制改镜头、局部替换、保留原音频 | 改一处不重生成整条 | 开源 Wan VACE/H3 mask 拼；复杂走 API |
| 4 | **剧本→分镜→时间线→角色一致→导出** | LTX Studio（官网） | gen space/control/style/ELEMENTS；从概念到成片 | 一体化叙事工作流 | 参考信息架构，自研分镜/时间线 |
| 5 | **AI 角色替换/自动 VFX** | Autodesk Flow Studio（原 Wonder Studio） | 实拍→可编辑 CG 场景/角色替换 | 影视级 VFX 降门槛 | 中优先；Wan-Animate + 分割/深度/合成 |
| 6 | **虚拟制片/ICVFX** | Unreal Engine 5.8（2026-06-22） | LED 墙/实时合成/Live Link/nDisplay | 影视工业预演 | 个人跳过 |
| 7 | **AI 剪辑/调色/混音/AI 助手** | DaVinci Resolve 21.1（2026-10-07） | 剪辑/调色/Fairlight/IntelliSearch/CineFocus/Krokodove/AI assistant | 后期最后一公里 | **直接外接 Resolve**，不自研 |
| 8 | **模型级超分/补帧/修复** | 视频增强软件 | 超分/降噪/补帧/稳定/慢动作 | 交付画质 | 开源 SeedVR2/FlashVSR/RIFE 替代 |
| 9 | **数字人/多语言口播/口型** | HeyGen（Avatar V/Video Agent）、Hedra（Character 3 API） | 数字人、TTS、lip sync、多语言 | 口播/出海/培训 | 本地 LatentSync/EchoMimic/InfiniteTalk + TTS；API 兜底 |
| 10 | **程序化动效/信息图** | 节点动画软件（Canva 旗下，个人免费） | 程序化 2D 动效、数据驱动 | 片头/字幕/信息图 | Remotion/Blender 替代 |
| 11 | **平台级 Agentic Workflows** | Runway Workflows/Agent | 无代码节点+LLM 节点；Agent 构建/修改/运行 | 自动化 | DSH 本身替代 |
| 12 | **中文成片模板/字幕/翻译/数字人** | 剪映/CapCut、即梦 AI | 一键成片/模板/字幕/翻译/数字人 | 低门槛量产 | 自研模板 + FFmpeg + Whisper |
| 13 | **专业审片/协作** | Frame.io、Kitsu（开源 AGPL） | 帧级批注、版本、审片流 | 团队协作 | Kitsu 或自研简版 |
| 14 | **3D 资产/材质库** | Adobe Substance/Quixel、Poly Haven | PBR 材质/模型/HDRI | 场景质感 | 用现成资产 |

## B2. 逐项详解（修正版）

### B2.1 3D 白模预演/导演台/机位

- **已核实开源方案：DirectorDesk（MIT）**
  - 仓库：https://github.com/mangfufu/预演工作台 ；下载：https://github.com/mangfufu/预演工作台/releases/latest
  - 功能：白模搭景（人物/动物/家具/建筑/道路/道具）、16 种几何体、GLB/glTF/FBX/OBJ 导入、动作导入/动作库、人物走位/群演/道具绑定、多机位路径/视线/跟随/POV/切镜、运镜预设/希区柯克变焦/手持晃动/畸变/景深、灯光、图片/视频材质、粒子/光环/丝带/文字/形变、镜面/门户、时间轴/曲线、多场戏接拍、单场/批量导出视频、内置 AI 助手 + 外部 MCP Agent、每场保存提示词、自定义技能。
  - 用法：DSH 面板只做"选场景/选机位/调时间/导出参考视频或截图"；把导出物交给 H3（首帧/尾帧/参考视频/控制序列）。
- **参考产品：预演软件 1.0.19（已拆解确认）**
  - 预演软件有 3D 导演台（预演工作台）、AI 导演台（预演前端）、白模预演、4 套 3D 子应用、200 pma 场景、111 姿势/24 动作、58 动作/28 运镜/7 人物/10 道具/8 表演；但它是 Tauri WebView + 闭源构建，独立复用/生产集成风险高（无源码、Tauri 桥、无鉴权）。
  - 只作架构/交互对照；**主路径用 DirectorDesk（MIT）**；不 vendor 预演软件 exe/前端/资产。
- **结论**：**不自研 3D 编辑器**；DirectorDesk 做预演，DSH 做镜头卡/导出/调度。

### B2.2 五步制作流水线 + 空间精度验收

- **做什么**：小说/章节→分段剧本→分镜设计→故事板图片→H3 提示词→H3 视频；每步有完成计数、批量补齐；生成画面与 3D 截图并排做"空间精度验收"（身份/左右/焦段/透视）。
- **开源依据**：OpenCineAgent（Apache-2.0，剧本→镜头→身份→关键帧→H3→QC→成片）、OpenCinema（MIT，Blockout/审片/编辑计划）、DirectorDesk（MIT，3D 预演）；预演软件 1.0.19 拆解证实其"五步/6 Studio/镜头状态机/尾帧继承"交互，可参考但不必复刻。
- **自研**：流水线看板 + 镜头卡 + 提示词编译 + 3D 对比验收，约 **2—3 人月**。
- **建议**：**最高优先级**；这是"复杂制作"的主干。

### B2.3 Runway：In-context 视频编辑（Aleph 2.0 / Edit Studio）

- **已核实**：官方新闻（2026-05-20）Aleph 2.0 + Edit Studio；付费计划可用；帮助页确认 Agent 可构建/修改/发现/运行 Workflows。
- **做什么**：文本指令+图像级控制改镜头、局部替换、保留原音频。
- **开源替代**：Wan2.2 VACE/Uni3C/ReCamMaster + H3 latent mask 局部重绘；ComfyUI 组合覆盖 60—70%。
- **建议**：MVP 先做 H3 局部重绘 + Wan VACE 换背景/角色；复杂编辑走外部 API 兜底。

### B2.4 LTX Studio：剧本→分镜→时间线→角色一致

- **已核实**：官网 gen space（文/图/音→视频）、control（相机/关键帧/参考）、style、ELEMENTS（角色/物体/地点一致性）；平台闭源，**LTX-2 模型开放权重**。
- **开源替代**：OpenCinema/OpenCineAgent/Open Cinema Studio/DSH 自研。
- **建议**：参考信息架构；先做镜头卡列表+只读时间线+导出。

### B2.5 Autodesk Flow Studio（原 Wonder Studio）：AI 角色替换/VFX

- **已核实**：Autodesk 产品页；云端 3D 工具集，把实拍转成可编辑 CG 场景。
- **开源替代**：Wan2.2-Animate-2 + 分割（SAM 类）+ 深度（DepthAnything）+ 合成（Blender/FFmpeg）。
- **建议**：中优先；先绿幕/纯色背景替换。

### B2.6 Unreal Engine 5.8：虚拟制片/ICVFX

- **已核实**：官方新闻 2026-06-22 发布；UE5 最后大版本。
- **建议**：个人跳过；工作室另议。

### B2.7 DaVinci Resolve 21.1：AI 剪辑/调色/混音

- **已核实**：Resolve 21 官网（Photo 页、IntelliSearch、CineFocus、Krokodove 70+ 图形、Fairlight、AI Neural Engine）；21.1 更新（2026-10-07）AI assistant 集成、相机支持、多机位、25 个 Krokodove 工具。
- **建议**：**直接外接**，不自研剪辑器；DSH 输出 OTIO/EDL/素材给 Resolve。

### B2.8 视频增强软件：超分/补帧/修复

- **已核实**：官网；本地/云端；超分/降噪/补帧/稳定/慢动作；多模型；订阅档位。
- **开源替代**：SeedVR2（Apache-2.0）、FlashVSR（Apache-2.0）、Real-ESRGAN（BSD-3）、RIFE/FILM。
- **建议**：优先开源；视频增强软件可选。

### B2.9 HeyGen / Hedra：数字人/口播/口型

- **已核实**：HeyGen Avatar V（一致性/多角度/175+ 语言口型）、Video Agent、AI Studio、翻译；Hedra Character 3 API（最长 10 分钟、720p $0.05/s、1080p $0.0625/s）。
- **开源替代**：LatentSync/EchoMimicV2/InfiniteTalk/Wan2.2-S2V + CosyVoice/IndexTTS。
- **建议**：本地为主，多语言/高稳定走 API。

### B2.10 节点动画软件：程序化动效

- **已核实**：官网；个人免费；Canva 2026-02 收购；2.7 2026-04。
- **开源替代**：Remotion/Blender/FFmpeg。
- **建议**：不自研。

### B2.11 Runway Workflows/Agent：Agentic Workflows

- **已核实**：帮助页确认 Agent 可构建/修改/发现/运行 Workflows、Agent Skills。
- **替代**：DSH（Agent + 工具 + 工作流 + MCP）。
- **建议**：不复刻。

### B2.12 剪映/CapCut、即梦 AI：中文成片/模板/字幕/翻译/数字人

- **已核实**：CapCut 官网（AI 视频/图片编辑、自动字幕、背景移除、TTS、模板）；即梦官网（文/图生视频、首帧/尾帧、中文提示词、智能画布、Seedance 2.0 VIP、Seedance 2.5 720P 限时价）。
- **开源替代**：OpenCineAgent + FFmpeg + Whisper + 自研模板。
- **建议**：字幕/翻译/拼接优先；模板后置。

### B2.13 Frame.io / Kitsu：审片协作

- **已核实**：Kitsu 官方博客（review playlists/onion skin/annotation、2FA、插件菜单、AI 实验）；Frame.io 官方产品（未逐页核）。
- **建议**：Kitsu（AGPL）或自研简版审片。

### B2.14 Adobe Substance/Quixel：3D 资产/材质

- **建议**：直接用 Poly Haven/Blender 资产库/Quixel 免费资产，不自研。

## B3. 按软件归类速查

| 软件 | 已核实强项 | 开源替代 | 建议 |
|---|---|---|---|
| **预演软件 1.0.19**（已拆解确认） | 短剧/漫剧工作台、剧本/角色/分镜/3D导演台/节点画布/配音台（CoolShowAI 文档为公开参考；品牌关系未确认） | OpenCineAgent/OpenCinema/DirectorDesk | 参考交互，不依赖 |
| **DirectorDesk（开源 MIT）** | 3D 白模预演/机位/运镜/导出/MCP | —（本身即替代） | **直接复用** |
| Runway | Aleph 2.0/Edit Studio/Workflows/Agent | Wan VACE/H3 mask + DSH | 编辑用开源拼，复杂走 API |
| LTX Studio | gen space/control/style/ELEMENTS | OpenCinema/OpenCineAgent | 参考信息架构 |
| Autodesk Flow Studio | 实拍→可编辑 CG 场景 | Wan-Animate + 分割/深度/合成 | 中优先 |
| UE 5.8 | 虚拟制片/ICVFX | Blender（弱） | 跳过 |
| DaVinci Resolve 21.1 | 剪辑/调色/混音/AI 助手 | FFmpeg/MLT（弱） | 直接外接 |
| 视频增强软件 | 超分/补帧/修复 | SeedVR2/FlashVSR/RIFE | 开源替代 |
| HeyGen/Hedra | 数字人/口播/口型 | LatentSync/EchoMimic/InfiniteTalk/TTS | 本地为主，API 兜底 |
| 节点动画软件 | 程序化动效 | Remotion/Blender | 不自研 |
| 剪映/CapCut/即梦 | 成片/模板/字幕/翻译/数字人 | OpenCineAgent+FFmpeg+Whisper | 字幕/翻译/拼接优先 |
| Kitsu/Frame.io | 审片协作 | Kitsu 自托管/自研 | 简化自研或 Kitsu |
| Adobe Substance/Quixel | 3D 资产/材质 | Poly Haven/Blender 资产库 | 直接用 |

## B4. 不建议自研 / 建议直接外接

1. **DaVinci Resolve**（剪辑/调色/混音）——外接。
2. **Unreal Engine**（虚拟制片）——个人不做。
3. **视频增强软件**（超分/补帧）——开源替代足够。
4. **Adobe Substance/Quixel**（材质/资产）——用现成。
5. **完整 3D 编辑器**——DirectorDesk/Blender 足够。
6. **云渲染农场**——按需租。

## B5. 自研优先级（v2）

| 优先级 | 功能 | 估算 |
|---|---|---|
| **P0** | 五步流水线/镜头卡/提示词编译/空间精度验收（参考预演软件交互） | 2—3 人月 |
| **P1** | 分镜/资产库/生成队列/超分后处理 | 3—4 人月 |
| **P2** | DirectorDesk 集成/3D 预演/QC | 1—2 人月（比自研省 2—3） |
| **P3** | 时间线/审片/模板/翻译 | 2—3 人月 |
| **P4** | AI 角色替换/VFX、数字人 | 3—5 人月 |
| **跳过** | UE/完整 3D 编辑器/自研剪辑器/自研超分模型 | — |

## B6. 每个功能的独立决策 checklist

1. 我是否真的需要它？
2. 开源替代（DirectorDesk/OpenCineAgent/OpenCinema/Wan/H3）是否够用？
3. 外部 API 能否覆盖（成本/隐私/稳定性）？
4. 自研多少人月/维护成本？
5. 许可证/法律风险（完工后统一审计）？
6. 是否依赖某闭源生态？值得被锁定吗？
7. 不做会卡在哪一步？
8. 决策：自研/开源替代/买/跳过（写进决策记录）。

---
