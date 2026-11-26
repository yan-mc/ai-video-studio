<div align="center">

<img src="icon.svg" width="96" height="96" alt="九章工作室" />

# 九章工作室 · Jiuzhang Studio

**跑在 DeepSeek Harness 里的本地 AI 视频制作终端**

一句话想法 → 智能分镜 → 角色卡 → 3D 白模走位 → H3 生成 → 跨镜头续写 → 成片

纯本地运行 · 音画同步 · 数据不出机器

[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-cinnabar)](https://github.com/yan-mc/ai-video-studio)
[![ComfyUI](https://img.shields.io/badge/ComfyUI-0.45.0-blue)](https://github.com/comfyanonymous/ComfyUI)
[![Model](https://img.shields.io/badge/MiniMax-H3%20·%2033B-purple)](https://huggingface.co/MiniMaxAI/MiniMax-H3)
[![License](https://img.shields.io/badge/license-see%20LICENSE-lightgrey)](LICENSE)

</div>

---

## 这是什么

不是"又一个 ComfyUI 前端"，而是一条**完整的视频制作流水线**。

ComfyUI 给你一个节点图；九章给你的是「从剧本到成片」的全套工序：写分镜、管角色、摆走位、控参数、跑续写、拼成片，并且把每一步的输入输出都锁在本地。

它解决的是一类具体问题：

| 你遇到过的 | 九章怎么做 |
|---|---|
| 221 个参数，不知道哪个有用 | 逐条对照上游源码审计，**无效的默认折叠并标注原因** |
| 角色换个镜头就换脸 | 角色卡仓库 + 参考图编号自动对齐 `<Picture N>` |
| 长视频接不上，动作断裂 | 段间 **AV latent 续接**，实测段间 PSNR 30.7 dB |
| 想让模型照着走位演 | Blender 渲灰模参考视频 → Ref2VA 的 `<Video N>` |
| 出片慢、画质还差 | DMAD 蒸馏学生 + 潜空间二采，**5 分钟出 1472×832** |
| 不知道这次到底提交了什么 | `job.params` 完整 221 参数快照 + 生效警告 |
| 提示词写得很好但成片不对 | 编译期 lint + 提交期一致性校验，**不静默降级** |

---

## 核心特色

### 🎬 三后端，覆盖视频 / 图像 / 拆解

| 后端 | 引擎 | 用途 |
|---|---|---|
| `h3-nanfeng` | 南风 V15（221 参数 → 内部展开 ~40 节点） | **主力视频生成**：二采 / 续写 / 全参数控制 |
| `h3-local` | 官方工作流模板替换 | 精简路径，排障对照用 |
| `h3-image` | H3-Image 33B | 文生图、**参考图编辑（≤16 张，第 1 张 = 编辑目标）**、批量出图、**图像 LoRA**、角色设定卡、立绘拆解 |

### 🧠 智能分镜：零 API Key

用 **DSH 内部 LLM** 看图 + 写分镜，复用你已经登录的模型，不写任何 `.env`、不要任何 API Key。

- 7 种输出模式（Ref2VA / 非首帧 I2V / I2VA / FL2VA / T2VA / 一镜到底续写 / 可切镜续写）
- 每种模式有**硬输出契约**（先规划段 N 尾镜与段 N+1 首镜，再分别落笔）
- 协议约束直接写进 system prompt，不靠"希望模型自觉"

### 🔗 跨镜头续写：AV latent 真续接

不是拼视频，是把上一段的**音视频联合 latent** 接进下一段：

- `context_length` 22 帧重叠，段间动作不断裂
- **段 1 也必须带续写任务**（`Load 0` / `Save 1`）—— 否则段 2 必然找不到 latent
- 严格串行执行，失败即停（后续段依赖前段 latent）
- 服务端有完整批次状态机，支持断点续跑与一键重置

### 🎨 画风 × 打光：两个正交通道

南风 221 参数里**没有画风参数，也没有打光参数** —— H3 是纯提示词驱动的。这两项由提示词通道实现，可任意组合：

- **画风 11 种**：`helltaker-look` / `helltaker-style` / `ova90s` / `shinkai` / `ghibli` / `american-toon` / `ufotable` / `toon3d-pbr` / `gohands` / `ligne-claire` / `vivziepop`
- **光比 7 种**：2:1 高调柔光 / 3:1 经典人像 / 4:1 戏剧低调 / **6:1 特写档** / **8:1 极低调**（母鸡卡剧场版那种强反差）/ 8:1 强边缘光 / 不指定

> 光比 = 主光 : 补光 = 亮面 : 暗面照度。光按「档」翻倍（1 档 = 2 倍），所以 8:1 是明暗差 8 倍 ≈ 3 档。

### ⚡ DMAD 加速：学生本体，不是风格补丁

DMAD（Distribution Matching as Adversarial Distillation，字节 + 德州农工，[arXiv:2610.02188](https://arxiv.org/abs/2610.02188)）把 50 步压到 4/8 步。

**关键是"成套"** —— LoRA、步数、采样器、CFG、shift 必须永远一起出现，错一个就是分布外采样：

| 项 | DMAD 4step | DMAD 8step |
|---|---|---|
| LoRA | `dmad_..._4step_...safetensors` | `dmad_..._8step_...safetensors` |
| 步数 | **4** | **8** |
| 采样器 | `lcm` | `lcm` |
| 调度器 | `simple` | `simple` |
| CFG | 1.0 | 1.0 |
| LoRA 强度 | **1.0**（永不衰减） | **1.0** |
| shift (video/audio) | 12 / 2 | 12 / 2 |

本插件为此做了三件事：

1. **启动前探测 ComfyUI 真实装了哪个学生**，文件缺失时**整套切换方案**（而不是"还用 8 步去跑 4 步学生"）
2. 加速学生固定占 **LoRA1** 槽位、强度 1.0；语义 LoRA 从槽 2 开始，按叠加规则衰减（单挂 0.7 / 两个 0.6 / 三个 0.5）
3. 所有槽位**每次生成都显式写死**，杜绝上一次的 LoRA 残留悄悄生效

### 🧩 LoRA 加载器：按功能分类，不是给一串文件名

南风 V15 有 8 个独立 LoRA 槽（`LoRA1..LoRA8`，各有独立启用位与强度）。注意 `启用LoRA` 总开关在 V15 上**是死的** —— 真正生效的是每个槽的 `LoRA{n}启用`。

**H3 的 LoRA 不是"一堆可自由叠加的补丁"，而是 12 个互相约束的功能轴：**

| 分类 | 目录 | 能否多挂 | 默认强度 | 为什么 |
|---|---|---|---|---|
| **加速蒸馏** | `00_turbo/` | ❌ 单选 | **1.0（锁定）** | 每条蒸馏绑一套 sigma 网格，叠两条 = 两套互不相容的去噪计划 |
| **运镜** | `10_camera/` | ❌ 单选 | 0.8 | 两条运镜会给相机两个矛盾目标 |
| **动作 / 物理** | `20_motion/` | ✅ 可多挂 | 0.7（第 2 条 ×0.6） | 可叠（武术+物理），但同向会抢动态 |
| **动作滑块** | `21_motion_slider/` | ✅ 有符号 | 0.5 | 0 = 不生效，正负是反方向 |
| **画风** | `30_style/` | ❌ 单选 | 0.7 | 风格是整体映射，两个会互相拉扯 |
| **影调滑块** | `31_look_slider/` | ✅ 有符号 | 0.5 | 曝光 / 昼夜 / 焦点 |
| **画质增强** | `32_quality/` | ✅ 可多挂 | 0.7（第 2 条 ×0.6） | 极易过度锐化，建议总量 ≤0.9 |
| **角色一致性** | `40_character/` | ❌ 单选 | 0.9 | 两个身份先验争同一张脸，必崩 |
| **音色** | `50_audio/` | ❌ 单选 | 0.75 | 两条声线会串音 |
| **特效 / 编辑** | `60_vfx/` | ✅ 可多挂 | 0.8 | 针对不同目标物 |
| **工具** | `70_utility/` | ❌ 单选 | 1.0 | 会改变输出格式（360/VR/字幕） |
| **未分类** | `99_inbox/` | ✅ 可多挂 | 0.7 | 放进来还没归类的 |

用户只要把文件放进对应子文件夹，面板就自动归类（ComfyUI 递归扫描，目录名成为路径前缀）。

**三条硬规则由后端 `solveLoraStack` 强制，不靠用户自觉：**

1. **单选类物理只留一个** —— 换选自动替换，并告诉你「谁被谁换了」
2. **多挂类自动衰减** —— 同类第 2 条起 ×0.6（依据：Motion Repair 官方 0.9 → 配 Combat 0.5–0.7）
3. **总强度看门狗** —— 不含加速学生，>1.5 警告、>1.8 剔除最弱的一条

> 加速学生的强度**恒 1.0，不可调**，也不计入总和 —— 它是学生本体，不是风格补丁。
> 官方原话："the LoRA is the distilled student, not a style"。

面板会实时显示「你填的值 → 实际生效的值」，以及每一处替换/衰减/剔除的原因。

#### 本机现状与可以再装什么

| 类型 | 本机 | 社区实名可下载的代表作 |
|---|---|---|
| **加速蒸馏** | ✅ DMAD 4step / 8step | LightX2V Turbo、HyperFlow、TaoMate 3-step、PDD Acc-8Step、FastH3 |
| **动作 / 物理** | — | `Wushu Action v7/v8`（`wushu_action`）、`Combat Base V2`（`prfight2`）、`GunFu`（`BUNNY`）、`Motion Continuity Repair`、`Spatial Physics`、`Better Human Motion` |
| **运镜** | — | `Camera Motion`（`camera motion`）、`Yunjing`（`yunjing`）、`Dolly Zoom`（`dolly_zm`）、`360 Orbit`、`Handheld Shaky Cam` |
| **动作迁移** | — | `Motion Transfer` / `TARA` / `FFP` —— 走 AddGuide 做逐帧对齐，与动作 LoRA 是**两套机制** |
| **画风** | — | `STUDIO 1939`（`gulliv3r`）、`Claymation`（`claymation`）、`2D Anime`（`2danime`）、`VHS`、`16Bit Pixel`、水墨 |
| **角色 / 换脸** | — | `Character Swap v1.5`、`FaceSwap REF2VA`（`Faceswap`）、`BFS Best Face Swap` |
| **音色** | — | 各类声线 LoRA（0.5–0.85，1.0 会明显劣化） |
| **滑块** | — | `[MMH3] Detail Slider`、`Exposure Slider`、`DayNight Slider`、`Motion-Speed-SLIDER` |
| **工具** | — | `360 Equirect`（`eqr360`）、`VR180 SBS`（`vr180sbs`）、`Turnaround` 转面 |

> 目录里有一份 `models/loras/README.md`，写明每类该放什么、触发词、推荐强度。

### 📐 3D 预演：Blender 只负责"走位"

Blender 在白模里渲一段参考视频，喂给 Ref2VA 当 `<Video N>`，让模型照着走位演。**不是**用 Blender 直接指挥 H3（那条路验证后已放弃）。

- **60 个内置动作**（base / locomotion / gaze / social / hands / posture / gesture / work / vehicle）
- 镜头卡坐标系用 `y = 高度`，转 Blender Z-up 只在**一处**做，避免"相机贴脸渲出一片灰"
- 帧数严格落在 `17k+5` 网格上，与 H3 的帧数语义完全一致
- 产物自动挂回 `shot.refs.videos[0]`，即 `<Video 1>`

### 🗂 角色卡仓库 + 参考图编号权威

参考图编号是最容易错的地方（编号错了就串脸，而且不报错）。本插件保证：

- 编号来自**真实提交顺序**（`resolveRefImages`），不是"第几张卡"
- 首/尾帧占用的槽位会**从参考图里剔除**，其余按原顺序补位
- 上限 9 张（H3 Ref2VA 硬约束），与提示词里的 `<Picture N>` 严格同源

### 🛡 不静默降级 —— 这个项目的核心工程原则

这个仓库里最反复出现的失败模式不是"报错"，而是"看起来成功、其实没做"。所以：

- 参考素材解析失败 → 写进 `job.warnings`，不假装成功
- 提示词超长 → 按**字段边界**截断（保住六个字段），而不是从中间砍断
- 环境修正（SageAttention / TRT）→ 每次都在 warnings 里说明改了什么、为什么
- 硬互斥组合 → 在**浪费 GPU 之前**就拦下，并把冲突项名字写进错误信息

---

## 快速开始

### 1. 装插件

```powershell
cd $env:USERPROFILE\.dsh\profiles\desktop
# package.json 的 dependencies 里加：
#   "@local/dsh-jiuzhang-studio": "link:<本仓库路径>"
```

重启 DSH，左侧栏出现「九章工作室」。

### 2. 准备 ComfyUI

**插件不含模型权重。**

- ComfyUI **0.45.0**（南风 GraphBuilder 依赖内部结构，升级需回归测试）
- 启动参数建议加 `--use-ck-attention`（ComfyUI 自带加速，实测 **-14.7%** 耗时）

```powershell
python main.py --lowvram --use-ck-attention --port 8488
```

> **端口怎么对上的**：插件不靠 `config.json` 猜端口 —— `resolveComfyUrl()` 的顺序是
> **环境变量 `DSH_COMFY_URL`/`COMFY_URL` > `ai-runtime/.comfy-port` > 配置里的 `comfyUrl` > 常见端口探测**。
> `start-h3.ps1` 启动成功后会写 `.comfy-port`，所以只要用插件的「顶栏启动按钮」或这个脚本起，
> 地址会自动对齐。手写 `config.json` 的 `comfyUrl` 只在端口文件缺失时才生效（默认 8488）。

### 3. 部署自定义节点

```powershell
pwsh -File vendor/nanfeng/deploy-vendor.ps1 -ComfyDir "<工作区>\ai-runtime\ComfyUI"
```

**必需**的第三方节点：

| 节点包 | 用途 | 必需性 |
|---|---|---|
| `ComfyUI-KJNodes` | 采样辅助 / 预览桥接 | ✅ |
| `ComfyUI-H3-Motion-Context` | 续写 latent 读写 | ✅ 续写必需 |
| `ComfyUI-VideoHelperSuite` | 输出 mp4 | ✅ |
| `Comfyui_Minimax_h3_latent_Upscaler` | 潜空间放大二采 | ✅ |
| `ComfyUI-H3-AudioRefine` | 续写音频精修 | 可选 |

> ⚠️ `latent_Upscaler` 上游 HEAD 已改名并删掉 `H3LatentUpscalerNodeMegapixels`，
> 必须用部署脚本还原的历史版本。

### 4. 模型清单

| 类别 | 文件 | 大小 |
|---|---|---|
| 扩散模型 | `minimax_h3_ref2va_pruned_fp8_scaled.safetensors` | 47 GB |
| 文本编码器 | `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | 25 GB |
| 视频 VAE | `minimax_h3_video_vae_fp16.safetensors` | — |
| 音频 VAE | `minimax_h3_audio_vae_fp32.safetensors` | — |
| 二采放大 | `minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors` | 659 MB |
| **加速 LoRA** | `dmad_minimax_h3_{4,8}step_full_critic_comfyui.safetensors` | 各 1.82 GB |

详细步骤见 **[部署 skill](skills/setup/SKILL.md)**；架构与 API 全表见 **[架构 skill](skills/architecture/SKILL.md)**。

---

## 架构

```
┌──────────────────────────────────────────────────────────────────┐
  ① DSH Host（Node ESM）                                             
    host/index.js        插件入口：路由 + 工具 + 启动编排              
    host/tools.js        14 个 studio_* Agent 工具                    
    host/api/            105 条精确路由 + 5 条参数化 + 5 个前缀族（/jiuzhang/api/*）+ SSE      
    host/bridge/         ★ H3 桥接层（唯一知道上游长什么样的地方）
host/services/*      业务层（执行器 / Blender / 素材 / LoRA / 剪辑…）   
└───────────┬───────────────────────────────┬──────────────────────┘
              REST + SSE                       spawn 子进程
            ▼                                ▼
┌──────────────────────────┐   ┌───────────────────────────────────┐
  ② Web SPA（React 18 + TS）      ④ Blender 5.2.4                    
    14 条路由 / 15 个页面文件 + 26 节点画布          渲灰模参考视频 → <Video N>        
    构建产物 app-dist/           └───────────────────────────────────┘
└──────────────────────────┘
              ComfyUI /prompt
            ▼
┌──────────────────────────────────────────────────────────────────┐
  ③ ComfyUI 0.45.0 + vendor/nanfeng                                  
    NanFengH3MultiReferenceGeneratorV15（221 参数巨型节点）            
      → GraphBuilder 内部展开 ~40 节点                                 
      → H3 出片（264×480 … 1472×832）                                 
└──────────────────────────────────────────────────────────────────┘
```

### 单镜生成的数据流

```
渲染页填表
 → POST /projects/:id/shots                保存镜头卡
 → POST /generate {projectId, shotId}
     → withVaultCards()                    解析角色卡 → shot.characterCards
     → resolveRefImages()                  算真实参考图顺序（含卡图）
     → compilePrompt(shot)                 h3-prompt.js 编译六段式
         ├ routeFormat()                   判定 ref / base
         ├ CONTINUATION_SWITCH             续写段顶部开关
         └ STYLE_PRESETS + LIGHTING        画风 + 光比
     → runH3Nanfeng()
         ├ 探测 ComfyUI loras              → 决定本次用哪个 DMAD 学生
         ├ planLoraStack()                 8 槽位：加速学生 + 语义 LoRA
         ├ planImageSlots()                首/尾帧占位，参考图避让
         ├ stageToComfyInput()             参考图/视频/音频上传到 input/
         ├ injectCardDefinitions()         只追加，绝不覆写官方英文段
         └ buildShotWorkflow()             221 参数快照 + 图组装 + 环境修正
             → POST {comfy}/prompt
 → SSE shot-updated / job-progress          推回浏览器
```

---

## 参数体系：221 个，其中 126 个真正生效

| 分类 | 含义 | 数量 |
|---|---|---|
| **A/B** | **有效**（B 类有效但默认没开，有收益建议开） | 126 |
| **C** | 死参数：上游硬编码关闭 / 完全无读取 | 47 |
| **D** | 缺依赖：本机未装节点，开了报错 | 48 |

界面默认**折叠全部无效参数**并标注原因，不让人在 95（47 死 + 48 缺依赖）个不响应的旋钮上瞎试。

> 完整逐条审计见 **[参数审计报告](docs/PARAM-AUDIT.md)**
> （逐项对照 `h3_generator.py` 源码核实）。

### 内置预设

| id | 用途 | 说明 |
|---|---|---|
| `draft` | 试提示词 | 480p / 4 步，约 1.5 分钟 |
| `standard` | 日常主力 | 480p → 0.8MP 二采，约 3 分钟 |
| `quality` | 成片 | 480p → 1.2MP 二采，**1472×832**，约 5.5 分钟 |
| `quality-preview` | 调试构图 | 同 quality + 采样预览 |
| `continuation` | 续写段 | 开启潜空间续写 |
| `continuation-quality` | 续写 + 高画质一采 | 续写不能开潜空间二采（上游硬互斥） |
| `low-vram` | 12GB 保守 | 开启运行时预留显存 |

预设支持四层叠加：**schema 默认 → 内置预设 → 项目/镜头覆盖 → 调用方 extra**。

---

## Agent 工具（14 个）

| 工具 | 用途 |
|---|---|
| `studio_meta` | 元信息（221 参数分组 / 预设 / 加速方案 / 节点类型） |
| `studio_config` | 读写配置（16 键白名单） |
| `studio_project` | 项目 CRUD |
| `studio_shot` | 镜头卡 CRUD（`list` / `create` / `save` / `delete`） |
| `studio_prompt` | H3 提示词编译（`meta` / `compile` / `fromShot`） |
| `studio_generate` | 提交生成（支持 preset / params / continuationTask） |
| `studio_jobs` | 任务查询 / 取消 |
| `studio_storyboard` | 智能分镜（看图 + 写分镜，走 DSH 内部 LLM） |
| `studio_h3_workshop` | 剧本 → 中性分段 + 资产提示词（**只产文本**） |
| `studio_blender` | 3D 预演渲染（health / assets / actions / spec / render） |
| `studio_post` | ffmpeg 后处理（含 **`stripAudio` 去音轨**） |
| `studio_image` | H3-Image 出图（`meta` / `lora` / `generate`：文生图 / 参考图编辑 / 批量 / LoRA）|
| `studio_toolbox` | 提示词模板 / 服化道 / 孤儿清理 / 日志 |

---

## 内置 Skill（11 个）

提示词规范在 `skills/prompt/`，由插件自己的 provider 注册（DSH 内置发现只扫一层，看不到两层嵌套）。

| Skill | 内容 |
|---|---|
| `jiuzhang-studio-prompt` | **唯一权威**提示词规范：模式路由 + 两套官方格式 + 11 画风 + 编号规则 |
| `h3-official-prompt` | MiniMax 官方英文六段式（含 references 细则） |
| `hailuo-prompt` | 海螺版（中文流程 + 本地 ComfyUI 结构） |
| `h3-group-master` | 社区实战总纲 v2.1（2105 行）：续写 / 画风池 / 光影七段式 / 禁词体系 |
| `h3-continuation` | 一镜到底续写 |
| `h3-continuation-cuts` | 续写·可切镜 |
| `h3-nonfirst-i2v` | 非首帧 I2V |
| **`h3-character-replace`** | **视频换人：保动作、换皮囊（专用四段式，与六字段规范互斥）** |
| `jiuzhang-studio-architecture` | 整体结构 + API 全表 + 安装流程 |
| `jiuzhang-studio-usage` | 完整操作手册 |
| `jiuzhang-studio-setup` | 从零部署 |

> ⚠️ 改 `SKILL.md` 的 frontmatter 时 `name` 必须是 kebab-case，否则会被静默丢弃。

---

## 实测性能（RTX 4080 Laptop 12GB）

| 场景 | 分辨率 | 耗时 |
|---|---|---|
| 单镜 draft（4 步） | 864×480 | **96 秒** |
| 二采 quality（6+4 步） | **1472×832** | **338 秒** |
| 续写段 1 | 864×480 | 96 秒 |
| 续写段 2（含裁剪） | 864×480 / 102 帧 | 111 秒 |

`--use-ck-attention` 相比不开启：116s → 99s（**-14.7%**）；二采场景 504s → 338s（**-33%**）。

**续写连续性**（PSNR，越高越相似）：

| 对比 | PSNR |
|---|---|
| 段间（段 1 末 → 段 2 首） | **30.7 dB** |
| 段 1 内部首末 | 18.8 dB |
| 段 2 内部首末 | 20.0 dB |

段间相似度显著高于段内动作变化幅度，证明续写真的生效了。

---

## 目录结构

```
dsh-jiuzhang-studio/
├─ host/                    Node 后端（66 文件 / ~27,700 行）
│  ├─ index.js             插件入口：路由 + 工具 + 启动编排
│  ├─ config.js            配置层（白名单 + 缓存 + comfyUrl SSRF 校验）
│  ├─ config-reader.js     ★ 配置读取约定（消灭"配置分裂脑"）
│  ├─ security.js          guard / safeId / safeJoin / resolveUserPath
│  ├─ static.js            SPA + 静态托管（Range / ETag / 301）
│  ├─ runtime.js           模块级单例（Host 服务挂载）
│  ├─ skills.js            Skill provider（绕开 DSH 的目录深度限制）
│  ├─ tools.js             14 个 Agent 工具
│  ├─ api/                 REST 层（拆成 9 个文件，105 条精确路由 + 参数化/前缀族 + SSE）
│  │  ├─ index.js          路由分发 + executeBackend
│  │  ├─ http.js           body 解析 / sendJson / Range / multipart
│  │  ├─ shots.js          镜头卡 CRUD
│  │  ├─ prompt-compile.js compilePrompt / deriveSubjectsFromShot
│  │  ├─ projects.js       项目投影 / 可写字段白名单
│  │  ├─ monitor.js        /monitor 负载
│  │  ├─ replace-tasks.js  换人任务创建
│  │  ├─ archive.js        产物归档 / 字体 / 路径白名单
│  │  └─ events.js         SSE 事件总线
│  ├─ bridge/              ★★ H3 桥接层：唯一知道「上游长什么样」的地方
│  │  ├─ index.js          门面 —— 业务层只 import 这里
│  │  ├─ README.md         职责边界 + 上游升级流程
│  │  ├─ vendors/nanfeng/  上游节点包镜像（221 参数 / 图组装 / 预设 / 续写）
│  │  ├─ prompt/           提示词通道（六段式编译器 / 换人规则化）
│  │  └─ llm/              DSH LLM 桥接（文本 / 视觉 / 智能分镜）
│  ├─ services/            业务服务层（30 文件）
│  │  ├─ ref-images.js     ★★ 参考图编号唯一实现（原 4 份合一）
│  │  ├─ generator.js      执行器（runH3Nanfeng / runH3Local）
│  │  ├─ comfy-client.js   ComfyUI 客户端（探测 / 上传 / 轮询 / 取消）
│  │  ├─ accel-plan.js     DMAD 加速方案 + LoRA 学生匹配
│  │  ├─ lora-catalog.js   LoRA 分类 / 互斥 / 衰减 / 看门狗（**视频**那套）
│  │  ├─ h3-image.js       H3-Image 出图（尺寸表 / 32 倍数自检 / 入参校验 / LoRA 注入 / 批量）
│  │  ├─ h3-image-lora.js  H3-Image LoRA 目录与求解（**独立于视频那套**，只有 5 个轴）
│  │  ├─ job-runner.js     任务状态机 + 并发闸门
│  │  ├─ blender-service.js Blender 子进程编排
│  │  └─ …                 素材 / 剪辑 / 后处理 / 换人 / 剧本工坊
│  ├─ store/               数据模型 + 原子 JSON 存储（.bak / .corrupt / 队列）
│  └─ blender/             render_shot.py / actions.py（内置动作目录）
├─ app-src/                 React 18 + TS 前端源码（85 文件 / ~21,300 行）
│  └─ src/{pages,canvas,components,api,ui}
├─ app-dist/                构建产物（入库，随插件分发）
├─ vendor/nanfeng/          南风 V15 Python 节点（部署时复制进 custom_nodes）
├─ vendor/inpaint-nodes/     局部重绘的 crop&stitch 节点（同上）
├─ skills/                  ★ 唯一 Skill 根目录
├─ docs/                    机制查明与参数审计
├─ client.js                DSH 侧栏入口
└─ cordis.patch.yml         DSH 加载补丁
```

---

## 开发

```powershell
pnpm run build          # 构建 SPA（vite build）
npm run typecheck       # 仅类型检查
```

**改动后必须做的五件事**：

1. `node --check` —— 只查语法，**必要但不充分**
2. **模拟 ctx 跑 `apply()`** —— 能抓未定义变量（漏一个 import 就让整个插件 fiber failed）
3. 重启 DSH 后确认 `fiberPhase` 是 `active`
4. 调一个真实工具 —— 能抓运行时字段丢失
5. 改 `inject` 后**必须重启 DSH**（HMR 不会重新解析 inject）

---

## 已知限制

| # | 限制 | 原因 |
|---|---|---|
| 1 | ComfyUI 版本锁 0.45.0 | 南风 GraphBuilder 依赖内部结构 |
| 2 | `H3SLAAttention` 节点上游缺失 | SLA 稀疏注意力不可用，已强制关闭 |
| 3 | 无 SageAttention | 用 ComfyUI 自带 `--use-ck-attention` 替代 |
| 4 | 续写段会短 0.92s | `context_length=22` 帧的裁切 |
| 5 | 主 mp4 无音轨 | VHS 设计：完整版在 `-audio.mp4` |
| 6 | ~~DMAD 的 shift 12/2 设不了~~ | **已修复（v2.9）**：放开 vendor 的 sigma 分支，`启用西格玛调节` 现在真的插入 `MiniMaxH3SigmaShift`。实测展开图里 `shift_video=12.0, shift_audio=2.0`，且位于 LoRA 链之后。12/2 与 12/3 的产物 PSNR 24.8 dB（差异显著但不崩） |
| 7 | 开二采时「采样步数」不生效 | 上游只读 `H3一采步数 + H3二采步数`，插件会按总步数自动拆分并告警 |
| 8 | **续写 × 潜空间二采不能同时开** | 不是功能互斥，是**分辨率在链上不能变**（latent 无法 resize）。要高清+连续，请提高一采「百万像素」 |

### 容易踩的坑（都不是 bug，但会让人以为坏了）

| 现象 | 原因 |
|---|---|
| 提示词/分镜 skill 明明写了，模型却说不知道 | `name` 必须是 kebab-case；两层嵌套需要 `host/skills.js` 才能被发现 |
| 改了模型/LoRA 但出片没变化 | 先看 `job.params.nanfengParams` 是你要的值；本版已修「目录驱动的 COMBO 被回退成默认值」 |
| 人物替换后输出里还有原视频的声音 | 源视频自带音轨会被 Ref2VA 自动接成 `<Audio 1>`。**先 `studio_post{op:'stripAudio'}`** |
| 页面白屏只剩「载入中…」 | 旧版无 ErrorBoundary。本版每个页面独立捕获并显示堆栈 |

---

## 许可

见 [LICENSE](LICENSE)。vendored 的南风组件许可见 [vendor/nanfeng/VENDOR.md](vendor/nanfeng/VENDOR.md)。

---

<div align="center">

**数据不出机器 · 提示词可审 · 参数可查 · 失败可归因**

</div>