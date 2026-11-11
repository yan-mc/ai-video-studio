# 附录 A：开源代码复用与许可证清单

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《AI视频本地制作软件与DSH插件工程规划-v2.md》（v2.1）。本附录回答：**我们打算复制/改写哪些开源代码、它们是什么许可证、需要保留什么、风险在哪、怎么给律师看。**
> 闭源拆解（预演软件/节点动画软件/视频增强软件）不在本清单，见附录 D/E；本附录只覆盖开源/开放权重。
> 数据核实：2026-11-04 直接读取各仓库 `LICENSE`/`LICENSE.md`/`README` 原始文件；HuggingFace 模型卡读 `license` 标签。标 ⚠️ 的项需律师/仓库原文二次确认。
> **工程策略（按用户要求更新）**：工程阶段**不因许可证审查停工**；先把功能做出来，代码/模型/素材来源逐项登记；**完工后**再按本清单做一次审计，交给你的律师处理冲突项。**本附录不是法律意见**；"可直接拷贝"只是工程判断。

## A1. 许可证分类与总体策略

| 类别 | 许可证 | 项目 | 工程策略 | 法律关注点 |
|---|---|---|---|---|
| **宽松（可拷贝）** | MIT | BlenderMCP、**DirectorDesk**、OpenCinema、Open Cinema Studio、Storyboarder、Whisper、RIFE、MMAudio 代码 | 可放 `vendor/`，保留版权与许可声明 | 几乎无义务（保留声明） |
| 宽松 | Apache-2.0 | OpenCineAgent、ComfyUI_MiniMaxH3_Director、ComfyUI-WanVideoWrapper、DiffSynth-Studio、OpenTimelineIO、SeedVR2/SeedVR、FlashVSR、FILM、LatentSync、EchoMimicV2、InfiniteTalk、CosyVoice、DWPose、Krea? | 可拷贝/依赖，保留 LICENSE、NOTICE（如有）、修改声明 | 专利授权/终止条款；修改声明 |
| 宽松 | BSD-3-Clause | Real-ESRGAN、PySceneDetect | 可拷贝，保留版权/许可/不得背书 | 低 |
| **Copyleft（需隔离/律师）** | GPL-3.0 | ComfyUI、ComfyUI-BlenderAI-node、OpenShot | 优先进程边界；若拷贝，独立目录/独立进程，保留 GPL 与源码，评估"衍生作品"范围 | 分发时源码义务；私有使用通常不触发分发义务，但衍生边界需律师判断 |
| Copyleft | AGPL-3.0 | Kitsu | 进程边界/可选；若修改并通过网络提供，需提供源码 | 网络服务条款；本项目本地自用风险较低但需律师确认 |
| Copyleft | LGPL-2.1 | MLT、FFmpeg（部分构建） | 动态链接/CLI；保留许可；避免静态链接 | 替换库义务 |
| **自定义/受限** | MiniMax H3 Community License | H3 权重、Comfy-Org H3（标签 other） | 只作模型调用，不复制权重；登记区域/营收/标注义务 | 排除美/欧/英/韩本地部署；>$2,000 万营收需授权；标注 "MiniMax H3"；不得用输出改进其他模型 |
| 自定义 | Tencent Hunyuan Community License | HunyuanVideo-Foley | 慎用/可替代 | 区域（排除欧盟/英国/韩国）、使用限制 |
| 自定义 | bilibili Model Use License | IndexTTS | 慎用/可替代 | 商用/分发限制需读原文 |
| 自定义 | Remotion License | Remotion | 慎用/替代 | 按公司规模收费，非 OSI |
| 非商用权重 | CC-BY-NC 4.0 | MMAudio 权重 | 仅研究/自用，不商用 | 不可商用 |
| 其他 | Apache-2.0（模型权重） | SeedVR2、FlashVSR 权重等 | 按模型卡 | 分别核对权重许可 |

## A2. 逐项目台账（复制/引用清单）

### A2.1 生成与流水线

#### 1. ComfyUI
- 仓库：https://github.com/comfyanonymous/ComfyUI
- 许可证：**GPL-3.0**（2026-11-04 读取 LICENSE：GNU GPL v3）
- 用途：生成宿主、H3/Wan/LTX 节点执行、HTTP API、队列。
- 建议复用方式：**进程边界优先**（`http://127.0.0.1:8188`）。
- 若拷贝：只拷贝"工作流执行/队列/HTTP 路由"相关少量代码到 `vendor/comfyui/`，独立进程运行；保留 GPL LICENSE、版权声明、源码可得性；不把自研核心与 GPL 代码静态链接。
- 义务/风险：GPL-3.0 传染性强；分发时必须提供完整对应源码；私有自用通常不触发分发义务，但"衍生作品"边界需律师判断。
- 建议风险级别：**高**（优先进程边界）。

#### 2. ComfyUI_MiniMaxH3_Director
- 仓库：https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director
- 许可证：**Apache-2.0**（读取 LICENSE 确认）
- 用途：多段 H3 时间轴、首尾帧组、参考素材组、二采/放大。
- 复用：可直接拷贝节点/工作流封装到 `vendor/h3-director/`，改造成本插件可调用的工作流模板。
- 义务：保留 LICENSE、版权、修改声明；如有 NOTICE 保留。
- 风险：低（Apache-2.0），但依赖 ComfyUI（GPL）运行时；分开处理。

#### 3. ComfyUI-WanVideoWrapper（Kijai）
- 仓库：https://github.com/kijai/ComfyUI-WanVideoWrapper
- 许可证：**Apache-2.0**
- 用途：Wan/VACE/控制/超分/MultiTalk 等节点。
- 复用：拷贝需要的节点或直接依赖（ComfyUI 插件目录）；保留许可与版权。
- 风险：低-中（依赖上游 GPL 宿主）。

#### 4. DiffSynth-Studio
- 仓库：https://github.com/modelscope/DiffSynth-Studio
- 许可证：**Apache-2.0**
- 用途：H3 NF4 推理（最低约 7GB 显存）、LoRA/训练、retake、control_video。
- 复用：拷贝 H3 pipeline/vram 配置到 `vendor/diffsynth/`，或作为独立 Python 服务；保留许可/修改声明。
- 风险：低。

#### 5. OpenCineAgent
- 仓库：https://github.com/ProgramaGrueso/OpenCineAgent
- 许可证：**Apache-2.0（GitHub 页面/README 明示；仓库根 LICENSE 文件本次未取到，⚠️ 以仓库实际 LICENSE 为准）**
- 用途：14-agent 生产流水线（剧本→身份→关键帧→H3 视频→QC→超分→混音→成片），ComfyUI 集成，16GB 可跑。
- 复用：**建议作为流水线底盘**，拷贝/改写 agents、pipeline、ComfyUI client、QC、assembly；把模型配置换成本地/外部；保留许可与版权。
- 义务：保留 LICENSE/NOTICE、修改声明；模型权重单独遵守各自许可。
- 风险：低（代码），但需核实 LICENSE 文件与模型权重。

#### 6. OpenCinema
- 仓库：https://github.com/junjamrk/OpenCinema
- 许可证：**MIT**（读取 LICENSE 确认，Copyright 2026 HBAI-Ltd）
- 用途：本地优先画布、Blockout（RGB/Depth/Normal/animatic）、审片、编辑计划、项目包、MCP Agent。
- 复用：参考/改写其 Blockout 导出、审片 6 检查、编辑计划 2—16 镜的数据结构；MIT 允许拷贝，保留声明。
- 风险：低；成熟度低（0.4 预览、Windows 不支持）⚠️。

#### 7. Open Cinema Studio
- 仓库：https://github.com/afj176/open-cinema-studio
- 许可证：**MIT**（读取 LICENSE 确认）
- 用途：ComfyUI 原生工作室（故事/镜头/LTX 视频/成片）。
- 复用：参考/拷贝 shot/故事板数据结构和 ComfyUI 工作流组织。
- 风险：低。

#### 8. H3 权重与 Comfy-Org H3
- 仓库：https://huggingface.co/MiniMaxAI/MiniMax-H3 ；https://huggingface.co/Comfy-Org/MiniMax-H3
- 许可证：**MiniMax H3 Community License / 标签 other**（HF API 读取 license=other）
- 用途：本地/托管生成。
- 复用：**不复制权重到自己的代码库**；通过本地/API 调用；记录版本/revision；遵守区域/商用/标注/AUP。
- 义务：排除美/欧/英/韩本地部署；年收入 >2,000 万美元需书面授权；UI 显著标注 "MiniMax H3"；不得用输出改进其他 AI 模型；托管服务需防护。
- 风险：**高**（自定义许可+区域+商用门槛）。

#### 9. H3 Fun ControlNet Union
- 仓库：https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union
- 许可证：**other（待核）**
- 用途：H3 的 Canny/Depth/HED/MLSD/Pose/Scribble/Layout/Gray 控制 + inpaint。
- 复用：作 ComfyUI 模型文件使用；不复制权重；记录来源。
- 风险：中（模型许可待律师/模型卡确认）。

### A2.2 3D/预演/制作管理

#### 10. Blender
- 仓库：https://github.com/blender/blender
- 许可证：**GPL-2.0-or-later**
- 用途：3D 预演、机位、白模、depth/canny/pose 渲染。
- 复用：**进程边界**（`blender --background --python` 或 MCP），不复制引擎代码。
- 义务：若分发修改版需 GPL；自用脚本无影响。
- 风险：低（不拷贝）。

#### 11. BlenderMCP
- 仓库：https://github.com/ahujasid/blender-mcp
- 许可证：**MIT**（读取 LICENSE 确认，Copyright 2025 Siddharth Ahuja）
- 用途：LLM/Agent 通过 MCP 操作 Blender（建模/材质/相机/截图）。
- 复用：可直接拷贝/依赖；保留 MIT 声明；需外部 LLM Agent Host（DSH 可充当）。
- 风险：低。

#### 11b. DirectorDesk（新增，3D 预演替代）
- 仓库：https://github.com/mangfufu/预演工作台 （镜像/组织仓 https://github.com/anymouschina/tapcanvas ）
- 许可证：**MIT**（README 明示；第三方依赖/动作素材各自许可，见 NOTICE）
- 用途：3D 白模预演、人物调度、多机位、运镜、导出参考视频/截图；内置 AI 助手 + 外部 MCP Agent；Windows 安装包/免安装 ZIP。
- 复用：**直接依赖/拷贝**（MIT）；DSH 只负责调用/读取导出物；保留版权与 MIT 声明；第三方素材单独核对。
- 风险：低（自有代码）；注意动作库/NOTICE 的第三方许可。

#### 12. ComfyUI-BlenderAI-node
- 仓库：https://github.com/AIGODLIKE/ComfyUI-BlenderAI-node
- 许可证：**GPL-3.0**
- 用途：Blender↔ComfyUI 桥接。
- 复用：进程边界/独立插件；若拷贝需 GPL 处理。
- 风险：高（copyleft）。

#### 13. Kitsu
- 仓库：https://github.com/cgwire/kitsu
- 许可证：**AGPL-3.0**
- 用途：制作管理（镜头/资产/任务/审片/统计）。
- 复用：**不建议拷贝**；如需要，独立部署 + API 对接；AGPL 网络服务条款需律师。
- 风险：高。

#### 14. Storyboarder
- 仓库：https://github.com/wonderunit/storyboarder
- 许可证：**MIT（待确认；仓库根 LICENSE 未直接取到，package.json 未见 license 字段）⚠️**
- 用途：分镜速写、Shot Generator（3D 机位/IK）。
- 复用：参考 UI/数据模型；若拷贝需确认 LICENSE。
- 风险：低（维护停滞）。

#### 15. OpenTimelineIO
- 仓库：https://github.com/AcademySoftwareFoundation/OpenTimelineIO
- 许可证：**Apache-2.0**（LICENSE.txt 确认）
- 用途：时间线交换格式。
- 复用：直接依赖（Python/C++ 库）；保留许可。
- 风险：低。

### A2.3 后期/音频/增强

#### 16. FFmpeg
- 仓库：https://github.com/FFmpeg/FFmpeg
- 许可证：**LGPL-2.1+ 或 GPL（取决于构建选项）**
- 用途：转码/拼接/字幕/混音/抽帧。
- 复用：**CLI 进程边界**；记录构建配置；不复制源码。
- 风险：中（若链接/分发需遵守 LGPL/GPL；CLI 调用通常最安全）。

#### 17. MLT / OpenShot
- 仓库：https://github.com/mltframework/mlt ；https://github.com/OpenShot/openshot-qt
- 许可证：**LGPL-2.1 / GPL-3.0**
- 用途：剪辑（参考/可选）。
- 复用：不自研剪辑器；外部 Resolve/FFmpeg 为主；若用 MLT 动态链接 LGPL。
- 风险：中-高。

#### 18. SeedVR2 / SeedVR
- 仓库：https://github.com/ByteDance-Seed/SeedVR（SeedVR2 项目页/ComfyUI 节点）
- 许可证：**Apache-2.0**（SeedVR 仓库 LICENSE 确认；ComfyUI 文档确认 SeedVR2 权重 Apache-2.0）
- 用途：视频修复/超分。
- 复用：CLI/ComfyUI 节点；保留许可。
- 风险：低。

#### 19. FlashVSR
- 仓库：https://github.com/OpenImagingLab/FlashVSR
- 许可证：**Apache-2.0**
- 用途：视频超分。
- 复用：CLI/ComfyUI 节点。
- 风险：低。

#### 20. Real-ESRGAN
- 仓库：https://github.com/xinntao/Real-ESRGAN
- 许可证：**BSD-3-Clause**
- 用途：图像/视频超分。
- 复用：直接依赖/CLI。
- 风险：低。

#### 21. RIFE / FILM
- 仓库：https://github.com/hzwer/Practical-RIFE ；https://github.com/google-research/frame-interpolation
- 许可证：**MIT / Apache-2.0**
- 用途：补帧。
- 复用：直接依赖/CLI。
- 风险：低。

#### 22. Whisper / faster-whisper
- 仓库：https://github.com/openai/whisper
- 许可证：**MIT**
- 用途：字幕/台词校验。
- 复用：直接依赖。
- 风险：低。

#### 23. LatentSync / EchoMimicV2 / InfiniteTalk / Wan2.2-S2V
- 仓库：https://github.com/bytedance/LatentSync ；https://github.com/antgroup/echomimic_v2 ；https://github.com/MeiGen-AI/InfiniteTalk ；https://github.com/Wan-Video/Wan2.2
- 许可证：**Apache-2.0**（LICENSE 读取确认）
- 用途：口型/数字人/音频驱动。
- 复用：独立推理服务/CLI；保留许可；模型权重单独核对。
- 风险：低-中（权重许可另核）。

#### 24. CosyVoice / IndexTTS
- 仓库：https://github.com/FunAudioLLM/CosyVoice ；https://github.com/index-tts/index-tts
- 许可证：**Apache-2.0 / bilibili Model Use License（自定义）**
- 用途：TTS/配音。
- 复用：CosyVoice 可直接依赖；IndexTTS 慎用/登记，律师看自定义条款。
- 风险：中。

#### 25. MMAudio / HunyuanVideo-Foley
- 仓库：https://github.com/hkchengrex/MMAudio ；https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley
- 许可证：**MIT 代码 + CC-BY-NC 权重 / Tencent Hunyuan Community License**
- 用途：拟音/音效。
- 复用：仅研究/自用；不要商用；登记权重许可。
- 风险：中-高。

#### 26. DWPose / DepthAnything V3 / PySceneDetect
- 仓库：https://github.com/IDEA-Research/DWPose ；DepthAnything V3（ByteDance Seed，仓库待核 ⚠️）；https://github.com/Breakthrough/PySceneDetect
- 许可证：**Apache-2.0（DWPose 确认）/ 待核 / BSD-3-Clause**
- 用途：姿态、深度、镜头切分（QC/后期）。
- 复用：直接依赖。
- 风险：低-中。

#### 27. Remotion
- 仓库：https://github.com/remotion-dev/remotion
- 许可证：**Remotion License（自定义）**
- 用途：代码视频/片头/数据可视化。
- 复用：慎用；个人/小公司免费，公司规模需付费；记录版本与用途。
- 风险：中。

#### 28. 视频增强软件 / HeyGen / Hedra / Runway / 预演软件等闭源
- **不复制代码/权重/素材**；只做 API/CLI/黑盒功能参考；见附录 B。

## A3. 来源台账模板（实现阶段必须逐条填）

```json
{
  "id": "prov-0001",
  "upstream": "https://github.com/ProgramaGrueso/OpenCineAgent",
  "commit": "abc1234",
  "license": "Apache-2.0",
  "license_file": "vendor/OpenCineAgent/LICENSE",
  "files": ["pipeline/orchestrator.py", "agents/qc.py"],
  "modifications": "替换 ComfyUI 地址为本地配置；增加 SGLang 适配",
  "obligations": ["保留 LICENSE", "保留版权声明", "标注修改"],
  "used_by": ["agent-pipeline", "qc"],
  "reviewer": "待律师",
  "date": "2026-11-xx"
}
```

**每复制一个文件**必须：

1. 在 `vendor/<project>/` 保留原始 LICENSE 与 commit 记录；
2. 在文件头或 `PROVENANCE.md` 标注来源 URL、commit、许可证、修改点；
3. 在 `third_party/manifest.json` 加一条机器可读记录；
4. 不删除原版权声明；
5. 律师审阅后再决定是否需要替换为 clean-room 实现。

## A4. 律师重点审阅清单（给港大法律同学）

1. **GPL-3.0**：ComfyUI/ComfyUI-BlenderAI-node/OpenShot 的代码复制到自研项目，是否构成衍生作品？独立进程/HTTP 调用是否可隔离？私有自用未分发是否触发义务？将来若私下给朋友/团队使用是否算分发？
2. **AGPL-3.0**：Kitsu 修改后本地/局域网使用，是否触发"网络交互"条款？
3. **LGPL-2.1**：MLT/FFmpeg 动态链接与 CLI 调用的边界。
4. **Apache-2.0**：NOTICE 文件、修改声明、专利条款；OpenCineAgent 的 LICENSE 文件是否确实为 Apache-2.0。
5. **MIT/BSD**：保留声明即可；确认 Storyboarder 的 LICENSE 文件缺失问题。
6. **自定义许可**：H3 Community License（区域/营收/标注/AUP）、Comfy-Org H3（other）、HunyuanVideo-Foley（地域）、IndexTTS（bilibili）、Remotion（规模收费）、MMAudio 权重（CC-BY-NC）。
7. **模型权重 vs 代码**：代码 Apache-2.0 不代表权重可商用；逐模型卡核对。
8. **"自用"定义**：个人本机、家庭、封闭团队、局域网共享的差异；是否需要保留源码/许可随附。
9. **未来分发**：如果以后想开源/送人/商用，需要提前设计可替换模块，避免 copyleft 锁死。
10. **证据留存**：每个版本的来源台账、LICENSE 副本、commit 记录。

## A5. 复核状态

- 本清单于 2026-11-04 通过 raw.githubusercontent.com 读取 LICENSE 文件核实了 20+ 个项目；ComfyUI（GPL-3.0）、Kitsu（AGPL-3.0）、ComfyUI-BlenderAI-node（GPL-3.0）、OpenShot（GPL-3.0）、MLT（LGPL-2.1）、BlenderMCP（MIT）、OpenCinema（MIT）、Open Cinema Studio（MIT）、OpenCineAgent（README Apache-2.0）、ComfyUI_MiniMaxH3_Director（Apache-2.0）、DiffSynth（Apache-2.0）、Whisper（MIT）、RIFE（MIT）、FILM（Apache-2.0）、LatentSync/EchoMimicV2/InfiniteTalk/CosyVoice/DWPose/FlashVSR/SeedVR（Apache-2.0）、Real-ESRGAN（BSD-3）、PySceneDetect（BSD-3）、MMAudio 代码（MIT）等。
- 未确认项：Storyboarder 的 LICENSE 文件、OpenCineAgent 的实际 LICENSE 文件、SeedVR2 具体仓库路径、DepthAnything V3、H3 Fun ControlNet Union、Comfy-Org H3 的完整条款——已标 ⚠️，律师/实现前复核。
