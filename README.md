# 九章工作室 · DSH 视频创作插件

> 本地 AI 视频工作室，跑在 DeepSeek Harness 里。
> 从**一句话想法**到**成片**：智能分镜 → 镜头卡 → 南风 V15 生成 → 跨镜头续写。
>
> 完全本地运行，数据不出机器。

---

## 特性

| 能力 | 说明 |
|---|---|
| **渲染 V2** | 南风 V15 引擎，217 个参数分 12 组（**其中 95 个实测无效/缺依赖，界面已标注并默认折叠**），7 个预设，二次采样到 1472×832 |
| **智能分镜** | 用 DSH 内部大模型看图 + 写分镜提示词，**零 API Key**；7 种模式，输出结构受硬约束 |
| **跨镜头续写** | 段间 AV latent 续接（`context_length` 22 帧），动作连续不断裂；实测段间 PSNR 30.7 dB |
| **二次采样** | 480p 一采（6 步）→ 潜空间放大到 1.2MP → 二采（4 步），5 分钟出 1472×832 |
| **音画同步** | H3 原生音频 VAE，输出 **h264 + AAC 立体声** |
| **角色卡仓库** | 设定卡图 + 文字设定 + 原立绘，多角色一致性锚点 |
| **素材库** | 参考图 ≤9 / 参考视频 ≤3 / 参考音频 ≤3，槽位编号自动对齐 `<Picture N>` |
| **3D 预演** | Blender 渲灰模参考视频（blockout）喂 Ref2VA |
| **立绘拆解** | 立绘 → 全景式角色概念分解图 |
| **26 节点画布** | 节点式工作流，12 步撤销，自动保存 |
| **H3-Image** | 33B 扩散模型，6 步采样，12GB 显存可跑 |
| **图像工具** | 裁剪 / 切割 / 标注 / 抽帧 / 抽音 / 质检 |
| **实时同步** | SSE 推送：DSH Agent 改了参数，网页立即可见 |

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│  DSH Agent（对话）          Web SPA（浏览器）                 │
│  studio_* 工具              RenderPageV2 / StoryboardPage    │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               │      REST + SSE          │
               ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│  host/  (Node ESM)                                          │
│   · api/index.js      ~90 条 REST 路由                       │
│   · api/events.js     SSE 事件总线                            │
│   · tools.js          13 个 Agent 工具                        │
│   · services/                                                │
│       nanfeng/        ← 南风桥接层（1897 行）                  │
│         schema.js     217 参数定义                            │
│         graph.js      图组装 + 类型强制 + 环境修正             │
│         presets.js    7 预设 + 三层合并                       │
│         continuation.js  续写批次编排                         │
│         storyboard.js 智能分镜（移植南风提示词资产）           │
│         dsh-llm.js    DSH LLM 桥接（零凭据）                  │
└──────────────┬──────────────────────────────────────────────┘
               │ ComfyUI /prompt
               ▼
┌─────────────────────────────────────────────────────────────┐
│  ComfyUI 0.45.0 + vendor/nanfeng                            │
│   NanFengH3MultiReferenceGeneratorV15                       │
│     → GraphBuilder 内部展开 ~40 个节点                        │
│     → 出片                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 1. 安装插件

```powershell
cd $env:USERPROFILE\.dsh\profiles\desktop
# package.json dependencies 里加：
#   "@local/dsh-jiuzhang-studio": "link:<本仓库路径>"
```

重启 DSH，左侧栏出现「九章工作室」图标。

### 2. 准备 ComfyUI

**插件不包含模型权重。**

- ComfyUI **0.45.0**（版本锁定，升级需回归测试）
- 启动参数建议加 **`--use-ck-attention`**（ComfyUI 自带加速，实测快 15%）

```powershell
python main.py --lowvram --use-ck-attention --port 8188
```

### 3. 安装 vendor 里的自定义节点

把 `vendor/nanfeng/` 复制（或软链）到 `ComfyUI/custom_nodes/nanfeng_prompt_nodes_v15/`：

```powershell
Copy-Item -Recurse vendor\nanfeng ComfyUI\custom_nodes\nanfeng_prompt_nodes_v15
```

还需要这几个第三方节点：

| 节点包 | 用途 |
|---|---|
| `ComfyUI-KJNodes` | 采样辅助 |
| `ComfyUI-H3-Motion-Context` | 续写 latent 读写 |
| `ComfyUI-H3-AudioRefine` | 续写音频精修（可选） |
| `ComfyUI-VideoHelperSuite` | 输出 mp4（**必需**） |
| `Comfyui_Minimax_h3_latent_Upscaler` | 潜空间放大二采（**必需**） |

> ⚠️ `Comfyui_Minimax_h3_latent_Upscaler` 的上游 HEAD 已改名并删除了
> `H3LatentUpscalerNodeMegapixels`。本仓库的部署脚本会还原所需的历史版本文件，
> 不要用该包的最新 HEAD。

### 4. 模型清单

| 类别 | 文件 | 大小 |
|---|---|---|
| 扩散模型 | `minimax_h3_ref2va_pruned_fp8_scaled.safetensors` | 47 GB |
| 文本编码器 | `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | 25 GB |
| 视频 VAE | `minimax_h3_video_vae_fp16.safetensors` | — |
| 音频 VAE | `minimax_h3_audio_vae_fp32.safetensors` | — |
| 二采放大 | `minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors` | 659 MB |
| LoRA | DMAD 4step / 8step | 3.6 GB |

详细步骤见 **[部署 skill](skills/setup/SKILL.md)**；
架构与 API 全表见 **[架构 skill](skills/architecture/SKILL.md)**。

---

## 参数体系

南风 V15 有 **217 个参数**，分 12 组。但**真正能生效的只有 122 个（56%）**：

| 分类 | 含义 | 数量 |
|---|---|---|
| **A** | 有效，默认值也合理 | 114 |
| **B** | **有效但默认没开**（有收益，建议开） | 8 |
| **C** | 死参数：上游硬编码关闭 / 完全无读取 | 47 |
| **D** | 缺依赖：本机未装节点，开了报错 | 48 |

> 完整逐条审计见 **[参数审计报告](docs/PARAM-AUDIT.md)**
> （生成命令：`npm run audit:params`，逐项对照 `h3_generator.py` 源码核实）。
>
> 数字以 `inertParams()` 为准，自检：
> `node -e "import('./host/services/nanfeng/schema.js').then(m=>{const i=m.inertParams();console.log(i.length,i.filter(p=>p.flag==='dead').length,'dead')})"`
> → 期望 `95 47 dead`

### B 类：买了没用上的功能

这 8 个功能**实现了、能生效、有明确收益，但默认是关的**：

| 参数 | 收益 |
|---|---|
| `启用H3潜空间放大二采` | **唯一真正有效的画质提升路径**（已由 standard/quality 预设默认开启） |
| `启用潜空间续写` | **长视频的唯一正确做法**：AV latent 接续（已由 continuation 预设默认开启） |
| `启用运行时预留显存` | 12GB 卡最有效的省显存手段（已由 low-vram 预设默认开启） |
| `启用UniBlockSwap` | 真能省显存（已核实源码有消费） |
| `启用续写音频精修` | 消除续写接缝爆音 |
| `启用锁音频` | 参考音频原样作为输出音轨 |
| `开启音频驱动模式` | 用音频打点驱动画面节奏 |
| `启用TAEH3彩色预览` | TAE 快速彩色预览，省完整 VAE 解码 |

### C 类：47 个死参数

| 来源 | 数量 | 依据 |
|---|---|---|
| 旧「高清二采」整条链路 | 10 | `h3_generator.py:1689` `hd_second_pass = False` |
| 旧 V4 双采样 | 3 | `:1796` `elif False:` |
| Sigma 调节面板 | 6 | `:1687` `sigma_requested = False` |
| Sol-Attn + T8 缓存 | 15 | `:1472-1473` 无条件置 False |
| 小脸修复 / 全局修复 / 人物定位 | 15 | `generate()` 零读取 |
| 其它零星（固定随机种子 / 启动准备 / 低显存注意力分头数 等） | 6 | 零读取 |
| 分支不可达（Sigma策略 / H3二采Sigma / 尺寸倍数 / 参考图尺寸 / SageAttention / 启用LoRA / H3二采LoRA 系） | 7 | 见 PARAM-AUDIT §十 |

> ⚠️ **常见误区**：
> - 「二采步数」「二采百万像素」等是**旧实现**，已废弃；
>   真正管画质的是 `启用H3潜空间放大二采` + `H3一采步数` + `H3二采步数`
> - `手动西格玛`（F 组）是死参数，有效的是 `H3完整Sigma序列`（D 组）
> - **`固定随机种子` 是死参数** —— 上游 `generate()` 零读取它。
>   真正生效的是 `随机种子` 本身（旧文档说「必须打开固定随机种子」是错的）
> - **`Sigma策略` 是死参数** —— 三个选项只有「原生轨迹」可达，
>   所以 DMAD 要求的 shift 12/2 设不了（模型自带 12/3）

### 画风与打光（两个正交通道）

南风 217 参数里**没有画风参数，也没有打光参数** —— H3 是纯提示词驱动的。
这两项都由提示词通道实现，可任意组合：

**画风**（`STYLE_PRESETS`，9 种）：`helltaker-look` / `helltaker-style` / `ova90s` /
`shinkai` / `ghibli` / `american-toon` / `ufotable` / `toon3d-pbr` / `gohands`

**打光 / 光比**（`LIGHTING_PRESETS`，6 种）：

| id | 名称 | 光比 | 效果 |
|---|---|---|---|
| `none` | 不指定 | — | 跟随画风与参考图 |
| `high-key-2-1` | 2:1 高调柔光 | 1 档差 | 日系写真、治愈系 |
| `classic-3-1` | 3:1 经典人像 | 1.7 档 | 对话戏、人物特写 |
| `dramatic-4-1` | 4:1 戏剧低调 | **2 档差** | 悬疑、情绪戏、夜戏 |
| `noir-8-1` | 8:1 极低调 | **3 档差** | 黑色电影、母鸡卡剧场版那种强反差 |
| `rim-backlit` | 强边缘光 | 3 档差 | 剪影、登场亮相、舞台 |

> 光比 = 主光 : 补光 = 亮面 : 暗面照度。光按「档」翻倍（1 档 = 2 倍），
> 所以 8:1 是明暗差 8 倍 ≈ 3 档。
>
> **打光是纯提示词通道**，不需要任何模型支持，Ref2VA 与基础格式两条路径都生效。

### 内置预设

| id | 用途 | 说明 |
|---|---|---|
| `draft` | 试提示词 | 480p / 4 步，约 1.5 分钟 |
| `standard` | 日常主力 | 480p → 0.8MP 二采，约 3 分钟 |
| `quality` | 成片 | 480p → 1.2MP 二采，**1472×832**，约 5.5 分钟 |
| `quality-preview` | 调试构图 | 同 quality + 采样预览 |
| `continuation` | 续写段 | 开启潜空间续写 |
| `continuation-quality` | 续写 + 高画质一采 | 续写不能开潜空间二采（上游硬互斥），靠一采面积提画质 |
| `low-vram` | 12GB 保守 | 开启运行时预留显存（这是 12GB 卡唯一真正有效的省显存手段） |

预设支持三层叠加：**内置预设 → 项目预设 → 镜头覆盖**。

**加速方案**（与预设正交，可单镜覆盖）：

| id | 说明 | 步数 | LoRA |
|---|---|---|---|
| `dmad8` | DMAD 8 步学生，音画质量优先（**默认**） | 8 | `dmad_..._8step_...safetensors` |
| `dmad4` | DMAD 4 步学生，最快 | 4 | `dmad_..._4step_...safetensors` |
| `none` | 不挂 LoRA，原模型 50 步（仅供对照） | 50 | — |

> ⚠️ DMAD 要求 `shift 12/2`，但**南风 V15 的 SigmaShift 分支被上游硬编码关闭**
> （`h3_generator.py:1687`），实际会用模型自带的 `12/3`。LoRA 本身仍完整生效。
> 插件会在 `job.warnings` 里明确告知这条限制，不静默。

### 硬互斥约束（组装前就会拦下）

这些组合进到 ComfyUI 才会报错，且错误信息极难懂。插件在提交前就拦，
并把冲突项直接写进错误消息（见 `host/services/nanfeng/index.js` 的 `CONSTRAINT_RULES`）：

| 冲突 | 依据 |
|---|---|
| 潜空间续写 ✕ H3潜空间放大二采 | `h3_generator.py:1322` |
| 潜空间续写 ✕ 锁音频 / 音频驱动 / 空5分钟时间轴 | `h3_generator.py:1318` |
| 文生 / 图生 / 首尾帧 三选一 | `h3_generator.py:1361` |
| 图生视频必须恰好 1 张图 | `h3_generator.py:1378` |
| 首尾帧必须恰好 2 张图 | `h3_generator.py:1380` |
| 文生视频不接受任何参考图 | `h3_generator.py:1376` |
| 图生 / 首尾帧不接受视频与音频 | `h3_generator.py:1372` |
| 音频驱动必须同时锁音频 | `h3_generator.py:1351` |


---

## Agent 工具（13 个）

| 工具 | 用途 |
|---|---|
| `studio_meta` | 元信息（含南风参数分组 + 预设） |
| `studio_config` | 读写配置 |
| `studio_project` | 项目 CRUD |
| `studio_shot` | 镜头卡 CRUD |
| `studio_prompt` | H3 提示词编译（六段式/三段式） |
| `studio_generate` | 提交生成（支持 preset / params / continuationTask） |
| `studio_jobs` | 任务查询 / 取消 |
| `studio_storyboard` | **智能分镜**（看图 + 写分镜，走 DSH 模型） |
| `studio_h3_workshop` | 剧本 → 中性分段 + 资产提示词 |
| `studio_blender` | 3D 预演渲染 |
| `studio_post` | ffmpeg 后处理 |
| `studio_image` | H3-Image 生成 / 立绘拆解 |
| `studio_toolbox` | 提示词模板 / 服化道 / 孤儿清理 / 日志 |

---

## 实测性能（RTX 4080 Laptop 12GB）

| 场景 | 分辨率 | 耗时 |
|---|---|---|
| 单镜 draft（4 步） | 864×480 | **96 秒** |
| 二采 quality（6+4 步） | **1472×832** | **338 秒** |
| 续写段 1 | 864×480 | 96 秒 |
| 续写段 2（含裁剪） | 864×480 / 102 帧 | 111 秒 |

> `--use-ck-attention` 相比不开启：116s → 99s（**-14.7%**）；二采场景 504s → 338s（**-33%**）。

**续写连续性**（PSNR，越高越相似）：

| 对比 | PSNR |
|---|---|
| 段间（段 1 末 → 段 2 首） | **30.7 dB** |
| 段 1 内部首末 | 18.8 dB |
| 段 2 内部首末 | 20.0 dB |

段间相似度显著高于段内动作变化幅度，证明续写生效。

---

## 目录结构

```
dsh-jiuzhang-studio/
├─ host/                    Node 后端（42 个模块）
│   ├─ api/                 REST 路由 + SSE 事件总线
│   ├─ services/            业务服务
│   │   └─ nanfeng/         南风桥接层
│   ├─ store/               数据模型
│   ├─ blender/             3D 预演脚本
│   └─ tools.js             13 个 Agent 工具
├─ app-src/                 React 18 + TS 前端源码
│   └─ src/
│       ├─ pages/           页面
│       ├─ components/      组件（含 NanfengParams 参数引擎）
│       └─ api/             REST + SSE 客户端
├─ app-dist/                构建产物（入库）
├─ vendor/nanfeng/          南风 V15 Python 节点（见 VENDOR.md）
├─ skills/                  ★ Skill 根目录（唯一）
│   ├─ prompt/              提示词规范（官方/海螺/续写/群友总纲）
│   ├─ usage/               操作手册
│   ├─ setup/               部署手册
│   ├─ architecture/        整体结构 + API + 安装
│   └─ templates/           提示词模板（数据，可编辑）
├─ tools/                   开发工具（测试/审计/预览）
├─ client.js                DSH 客户端入口
└─ docs/                    审查报告与方案
└─ cordis.patch.yml         DSH 补丁
```

---

## 开发

```powershell
# 前端构建
pnpm run build

# 类型检查
pnpm run typecheck

# 后端测试
pnpm test
```

前端改动需要重新构建（`app-dist/` 入库）。开发时可先构建再用：

```powershell
pnpm run build && <重启 DSH>
```

---

## 已知限制

| # | 限制 | 说明 |
|---|---|---|
| 1 | ComfyUI 版本锁定 0.45.0 | 升级可能破坏南风的 GraphBuilder |
| 2 | `H3SLAAttention` 节点上游缺失 | SLA 稀疏注意力不可用，已强制关闭 |
| 3 | 无 SageAttention | 用 ComfyUI 自带 `--use-ck-attention` 替代 |
| 4 | 续写段时长会缩短 | 段 2 起裁掉 `context_length` 帧（默认 22 帧） |
| 5 | 主 mp4 无音轨 | VHS 设计：完整版在 `-audio.mp4` |
| 6 | SigmaShift 分支被上游关闭 | DMAD 要求 shift 12/2，实际用模型自带 12/3；LoRA 仍生效，`job.warnings` 会明说 |
| 7 | 开二采时「采样步数」不生效 | 上游只读 `H3一采步数 + H3二采步数`。插件现在会按总步数自动拆分并写入 warnings |

### 容易踩的坑（都不是 bug，但会让人以为坏了）

| 现象 | 原因 |
|---|---|
| 提示词/分镜 skill 明明写了，模型却说不知道 | skill 的 `name` 必须是 kebab-case；两层的 `skills/prompt/<x>/SKILL.md` 需要 `host/skills.js` 才能被发现。详见 [skills/README.md](skills/README.md) |
| 改了模型/LoRA 但出片没变化 | 先确认 `job.params.nanfengParams` 里是你要的值；本版已修「目录驱动的 COMBO 被回退成默认值」的缺陷 |
| 点侧栏入口提示"被浏览器拦截" | 旧版误报（DSH Desktop 的 `window.open` 恒返回 null 但已交给系统浏览器）。本版已改为不误报，并始终显示可点链接 |
| 页面白屏只剩「载入中…」 | 旧版没有 ErrorBoundary，任何渲染异常都会卸载整棵树。本版每个页面独立捕获并显示堆栈 |

---

## 许可

见 [LICENSE](LICENSE)。

vendored 的南风组件许可见 [vendor/nanfeng/VENDOR.md](vendor/nanfeng/VENDOR.md)。
