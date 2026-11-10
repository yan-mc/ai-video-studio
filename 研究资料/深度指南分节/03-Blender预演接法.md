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
| Blender 学习成本 | 机位/走位/渲染需要 3D 基础 | 用预设机位模板（如预演软件的 26 个机位）、低模素材库、Mixamo 动作 |
| **白模不是 H3 原生输入** | H3 官方 API 没有 depth/pose/白模通道，只有本地 ControlNet 曲线 | 用 Gray/Layout/Depth/Canny/Pose 控制；若强依赖"白模直出"，考虑 Seedance 2.5（唯一官方原生支持白模参考） |

---
