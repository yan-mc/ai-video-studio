# H3-Image 接入方案（调研结论）

> 调研时间：2026-11-12
> 目标：给插件补上**图像生成**能力（模特工作台 / 漫画出图 / 画布 imageNode）
> 结论：**完全可行，且是当前最优解**

---

## 一、结论先说

**MiniMax H3-Image 是真实存在的开源模型，ComfyUI 原生支持。**

关键优势：**与 H3 视频共用同一个 Qwen3-VL 文本编码器** —— 我们本地已有（25.28 GB），
这意味着**只需再下 2 个文件**（扩散模型 + 图像 VAE），不用重复下载 25 GB 编码器。

| 项 | 值 |
|---|---|
| 参数规模 | 33.1B 扩散 Transformer（BF16） |
| 采样 | **固定 6 步**，guidance 1.0，无 CFG、无负面提示词 |
| 输出分辨率 | 原生 4096×4096（16 MP），最高 6272×2688 |
| 参考图 | **最多 16 张**（提示词里写 `<Picture 1>`…） |
| 能力 | **一个 checkpoint 同时覆盖文生图 + 图像编辑** |
| 提示词长度 | 最长 4096 token |

> 「4K 单次生成、不用放大链」——这对模特工作台和漫画出图是质变。

---

## 二、本地现状（已实测）

### 硬件
```
GPU: NVIDIA RTX 4080 Laptop — 12282 MiB (11.99 GB)
ComfyUI: 0.44.0
Python: 3.12.10
torch: 2.11.0+cu128
启动参数: --lowvram
磁盘: F 盘剩余 268 GB
```

### 已有模型（`F:\AI视频\ai-runtime\models\`）
| 类别 | 文件 | 大小 |
|---|---|---|
| diffusion_models | `minimax_h3_fl2va_pruned_fp8_scaled` | 19.52 GB |
| diffusion_models | `minimax_h3_ref2va_pruned_fp8_scaled` | 19.52 GB |
| text_encoders | `qwen3vl_32b_minimax_h3_int8_convrot` | **25.28 GB** ← **H3-Image 复用** |
| vae | `minimax_h3_video_vae_fp16` | 4.85 GB |
| vae | `minimax_h3_audio_vae_fp32` | 0.56 GB |
| loras | turbo 4step ×2 | 各 1.82 GB |
| checkpoints | — | **0 个（无任何图像模型）** |

### 缺口
1. **ComfyUI 0.44.0 没有 `MiniMaxH3Image` 节点**（实测 object_info 无此节点）
2. 缺扩散模型 `minimax_h3_image_pruned_int8_convrot.safetensors`
3. 缺图像 VAE `minimax_h3_image_vae_fp16.safetensors`

---

## 三、三条可选路线

### 路线 A：本地开源权重（推荐）

**优点**：完全免费、数据不出本机、可离线、和现有 H3 视频共用编码器
**缺点**：需要下载约 20-40 GB、需要升级 ComfyUI、12 GB 显存需验证

| 步骤 | 操作 | 预计耗时 |
|---|---|---|
| 1 | 升级 ComfyUI 到最新（git pull + 依赖） | 10 分钟 |
| 2 | 下载 `minimax_h3_image_pruned_int8_convrot`（约 18-20 GB） | 视带宽 |
| 3 | 下载 `minimax_h3_image_vae_fp16`（约 0.3-1 GB） | 快 |
| 4 | 验证节点可用 | 5 分钟 |
| 5 | 12 GB 显存跑通测试（**风险点**） | 调试 |
| 6 | 接进插件（imageNode / 模特 / 漫画） | 2-3 小时 |

**风险点：显存**。33.1B 参数 BF16 需要 66 GB，但我们用 **int8 量化版**（约 20 GB）。
ComfyUI 的 `--lowvram` 会分层加载，理论上能跑，但**速度会明显慢于 4K/10 秒的宣传值**。
实际可能：
- 1024×1024 出图：可跑，预计 1-3 分钟
- 4096×4096：**很可能 OOM 或极慢**，需要实测

### 路线 B：官方 API（最快见效）

MiniMax 官方 API 按 token 计费，无需下载、不占显存、速度稳定。

**优点**：立刻可用、无显存限制、4K 秒出
**缺点**：要 API key、要花钱、数据出门、离线不可用

价格参考（不同渠道差异大）：
- `image-01`（老模型）：约 $0.0035-0.01 / 张
- H3-Image API：按 token 计费

### 路线 C：ComfyUI Partner Nodes（折中）

在同一个 ComfyUI 画布上走 API，**不下载权重**，但保留"同一套工作流"的体验。
需要 ComfyUI 账号 + API key。

---

## 四、我的建议

**先做路线 B 打通链路，再决定要不要做路线 A 的重量级下载。**

理由：

1. **插件架构已经支持多后端**。`executeBackend` 里已有 `h3-local` / `seedance-cloud` / `mock`
   三条路径的分发模式，加一个 `h3-image-api` 只是照抄结构。
2. **先验证产品价值，再投资基础设施**。模特工作台、漫画出图、imageNode
   这三块能不能用起来，跟模型是本地还是云端无关。
3. **路线 A 的显存风险需要单独评估**。12 GB 跑 33B int8 模型，速度可能不理想。
   如果实测太慢，那还不如用 API。
4. **两条路线不冲突**。先接 API，后续把本地实现补上即可，代码结构一样。

---

## 五、如果走路线 A 的具体命令

### 5.1 升级 ComfyUI

```powershell
cd F:\AI视频\ai-runtime\ComfyUI
git pull
# 激活 venv 后更新依赖
F:\AI视频\ai-runtime\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 5.2 下载模型（二选一）

**方式 1：huggingface-cli**
```powershell
$env:HF_ENDPOINT = "https://hf-mirror.com"   # 国内加速
F:\AI视频\ai-runtime\venv\Scripts\python.exe -m pip install -U huggingface_hub
huggingface-cli download Comfy-Org/MiniMax-H3-Image `
  diffusion_models/minimax_h3_image_pruned_int8_convrot.safetensors `
  vae/minimax_h3_image_vae_fp16.safetensors `
  --local-dir F:\AI视频\ai-runtime\models
```

**方式 2：ModelScope（国内更快）**
```powershell
pip install modelscope
modelscope download --model MiniMaxAI/MiniMax-H3-Image `
  --local_dir F:\AI视频\ai-runtime\models
```

### 5.3 放置位置

```
F:\AI视频\ai-runtime\models\
├── diffusion_models\
│   └── minimax_h3_image_pruned_int8_convrot.safetensors
├── vae\
│   └── minimax_h3_image_vae_fp16.safetensors
└── text_encoders\
    └── qwen3vl_32b_minimax_h3_int8_convrot.safetensors   ← 已有，复用
```

### 5.4 工作流结构（文生图）

```
UNETLoader(minimax_h3_image_pruned_int8_convrot)
  ↓
CLIPLoader(qwen3vl_32b_minimax_h3_int8_convrot, type=minimax)
  ↓
MiniMaxH3ImageConditioning(width=0, height=0, prompt=...)
  ├→ （无图片连接 = 文生图）
  └→ （接 image_1..16 + VAE = 图像编辑）
  ↓
SamplerCustomAdvanced（6 步，guidance 1.0）
  ↓
VAEDecode(minimax_h3_image_vae_fp16)
  ↓
SaveImage
```

**关键参数**：
- steps = **6**（固定，不是 4 也不是 20）
- guidance = **1.0**（固定）
- 无负面提示词
- width/height = 0 → 自动 2048×2048

---

## 六、无论哪条路线，插件的改动

### 需要新增
1. `host/services/image-client.js` —— 图像生成客户端
   - `runH3ImageApi({cfg, job, shot, prompt})` （路线 B）
   - `runH3ImageLocal({cfg, workflow, job, prompt})` （路线 A）
2. `data/workflows/h3-image.json` —— 文生图工作流（路线 A）
3. `data/workflows/h3-image-edit.json` —— 图像编辑工作流（路线 A）
4. `executeBackend` 加 `h3-image` 分支
5. 配置项 `imageBackend: 'h3-image-local' | 'h3-image-api' | 'none'`

### 需要改
| 位置 | 改动 |
|---|---|
| `studio_generate` | 支持 `kind: 'image'` |
| `imageNode` | 接后端（目前只说"未接图像模型"） |
| 模特工作台 | 套件出图走图像后端 |
| 漫画工作台 | 线稿/上色走图像后端 |
| `studio_mw` | 新增 `generate` action |

### 显示尺寸映射
| 用途 | H3-Image 尺寸 |
|---|---|
| 电商方图 | 2048×2048 |
| 电商竖图 | 2368×1776 (4:3 竖) |
| 人物 13 张套件 | 1776×2368 |
| 影视 16:9 | 4096×2304 |
| 影视 21:9 | 6272×2688（若显存允许） |

---

## 七、待你决策

| 问题 | 选项 |
|---|---|
| **走哪条路线？** | A 本地 / B API / C Partner Nodes / 先 B 后 A |
| **有没有 MiniMax API key？** | 有 → 路线 B 立刻可用 |
| **能接受下载 20-40 GB 吗？** | 能 → 路线 A 值得试 |
| **对速度的容忍度？** | 本地可能 1-3 分钟/张，API 约 10 秒 |

---

## 八、参考链接

- [ComfyUI 官方公告：MiniMax H3 Image 已原生支持](https://blog.comfy.org/p/minimax-h3-image-is-now-available)
- [Comfy-Org/MiniMax-H3-Image 权重仓库](https://huggingface.co/Comfy-Org/MiniMax-H3-Image)
- [MiniMax 官方博客：H3-Image 4K 生成](https://www.minimax.io/blog/minimax-h3-image)
- [ComfyUI 文档：H3-Image 教程](https://github.com/comfy-org/docs/blob/main/tutorials/image/minimax/minimax-h3-image.mdx)
- [原模型仓库 MiniMaxAI/MiniMax-H3-Image](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image)

> ⚠️ **许可证提醒**：H3-Image 的许可与 H3 视频**不同**。
> 若年收入超过 100 万美元，或对外提供托管服务，需向 MiniMax 单独申请授权。
> 个人/内部使用不受此限制。
