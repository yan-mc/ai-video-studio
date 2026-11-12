---
name: jiuzhang-studio-setup
description: 从零部署九章工作室插件（DSH 视频/图像创作插件）。当用户要安装、部署、修复或迁移这个插件时使用，涵盖环境准备、本地模型下载（H3 视频 + H3-Image 图像，约 60GB）、ComfyUI 配置、插件挂载与验收。插件本体不含模型权重，必须由使用者自行下载。
---

# 九章工作室 · 部署与本地模型配置

> 插件本体（`@local/dsh-jiuzhang-studio`）**不包含任何模型权重**。
> 生成能力依赖本地 ComfyUI + MiniMax H3 系列开源模型，需单独下载约 60 GB。
> 本 skill 描述完整部署流程，供 AI 代理按步骤执行。

---

## 0. 前置确认

部署前必须确认三件事，缺一不可：

| 项 | 要求 | 检查方式 |
|---|---|---|
| **GPU 显存** | ≥ 12 GB（H3 视频 33B + H3-Image 33B 均靠量化+lowvram 运行） | `nvidia-smi --query-gpu=memory.total --format=csv,noheader` |
| **磁盘** | ≥ 80 GB 空闲（模型约 60 GB + 工作区） | `Get-PSDrive` / `df -h` |
| **ComfyUI** | 0.45.0 或更高（0.44 无 `MiniMaxH3ImageConditioning` 节点） | `curl http://127.0.0.1:8188/system_stats` |

显存不足时的取舍：
- **12 GB**：只能跑 w4a8 量化（推荐路径，已验证）
- **16-24 GB**：可用 int8 量化，质量更好
- **48 GB+**：可跑 bf16

---

## 1. 目录约定

推荐布局（路径可改，但下文以此为例）：

```
F:\AI视频\
├── ai-runtime\                 # 运行时（含模型，不进插件仓库）
│   ├── ComfyUI\                # ComfyUI 源码（git 仓库）
│   ├── venv\                   # Python 虚拟环境
│   └── models\                 # ★ 模型放这里
│       ├── diffusion_models\
│       ├── text_encoders\
│       ├── vae\
│       └── loras\
└── 工作室\dsh-jiuzhang-studio\  # 插件本体
```

**关键**：插件通过 `resolveModelRoot()` 自动探测模型目录，探测顺序：
1. 配置项 `imageModelRoot`
2. `comfyInputDir` 的兄弟目录 `models`
3. 环境变量 `H3_MODEL_ROOT`
4. 常见路径 `F:\AI视频\ai-runtime\models`
5. 从插件位置向上 6 层找 `models` 或 `ai-runtime\models`

所以**只要 `models` 目录符合上述任一形态就能被找到**，无需手工配置。

---

## 2. ComfyUI 安装与升级

```powershell
# 克隆（或用已有的）
git clone https://github.com/comfyanonymous/ComfyUI.git F:\AI视频\ai-runtime\ComfyUI

# 建 venv（Python 3.10+，实测 3.12 可用）
cd F:\AI视频\ai-runtime
python -m venv venv

# 装依赖（torch 用 CUDA 版本，实测 cu128 + torch 2.11 可用）
F:\AI视频\ai-runtime\venv\Scripts\python.exe -m pip install --upgrade pip
F:\AI视频\ai-runtime\venv\Scripts\python.exe -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
cd ComfyUI
F:\AI视频\ai-runtime\venv\Scripts\python.exe -m pip install -r requirements.txt
```

**升级到 0.45.0+**（必须，否则没有 H3-Image 节点）：

```powershell
cd F:\AI视频\ai-runtime\ComfyUI
git fetch origin
git pull origin master
F:\AI视频\ai-runtime\venv\Scripts\python.exe -m pip install -r requirements.txt
```

验证节点存在：
```powershell
curl http://127.0.0.1:8188/object_info/MiniMaxH3ImageConditioning
# 应返回：输出 CONDITIONING, LATENT；必需 clip/prompt/width/height；可选 vae/images
```

启动（12 GB 显存必须 `--lowvram`）：

```powershell
F:\AI视频\ai-runtime\venv\Scripts\python.exe main.py --lowvram --listen 127.0.0.1 --port 8188
```

---

## 3. 模型下载（约 60 GB）

来源：**Comfy-Org** 的魔改版仓库（已适配 ComfyUI 加载），比原版更适合直接使用。

- 仓库：`Comfy-Org/MiniMax-H3`（视频）与 `Comfy-Org/MiniMax-H3-Image`（图像）

### 3.1 视频模型（H3，约 47 GB）

| 文件 | 大小 | 存放目录 | 作用 |
|---|---|---|---|
| `minimax_h3_ref2va_pruned_fp8_scaled.safetensors` | 19.5 GB | `diffusion_models/` | **参考图生成视频**（最常用） |
| `minimax_h3_fl2va_pruned_fp8_scaled.safetensors` | 19.5 GB | `diffusion_models/` | 首尾帧生成视频 |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | 25.3 GB | `text_encoders/` | **文本编码器（视频+图像共用）** |
| `minimax_h3_video_vae_fp16.safetensors` | 4.9 GB | `vae/` | 视频 VAE |
| `minimax_h3_audio_vae_fp32.safetensors` | 0.6 GB | `vae/` | 音频 VAE（**必须 fp32**） |
| `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | 1.8 GB | `loras/` | Ref2VA 加速 LoRA |
| `minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors` | 1.8 GB | `loras/` | FL2VA 加速 LoRA |

> 只做 Ref2VA 的话，`fl2va` 那 19.5 GB 可以不下载，省一半空间。

### 3.2 图像模型（H3-Image，约 12.7 GB）

| 文件 | 大小 | 存放目录 | 说明 |
|---|---|---|---|
| `minimax_h3_image_pruned_w4a8.safetensors` | 12.55 GB | `diffusion_models/` | **12 GB 显存首选** |
| `minimax_h3_image_pruned_int8_convrot.safetensors` | 20.98 GB | `diffusion_models/` | 16 GB+ 可用 |
| `minimax_h3_image_pruned_bf16.safetensors` | 40.23 GB | `diffusion_models/` | 48 GB+ |
| `minimax_h3_image_vae_fp16.safetensors` | 1.17 GB | `vae/` | **图像 VAE，与视频 VAE 不同** |

**三档只需选一个**（插件会自动按 w4a8 → int8 → bf16 顺序挑可用的）。
文本编码器与视频**共用**，不用重复下载。

### 3.3 下载方法（重要：踩坑记录）

**推荐用 curl 直连**，不要用 `hf_hub_download`（实测会卡在 0 字节）：

```powershell
$base='F:\AI视频\ai-runtime\models'
$repo='https://huggingface.co/Comfy-Org/MiniMax-H3-Image/resolve/main'

# 图像 VAE（1.17 GB）
curl.exe -L --fail --retry 10 --retry-delay 3 --retry-all-errors -C - `
  -o "$base\vae\minimax_h3_image_vae_fp16.safetensors" `
  "$repo/vae/minimax_h3_image_vae_fp16.safetensors"

# 图像扩散模型（12.55 GB）
curl.exe -L --fail --retry 10 --retry-delay 3 --retry-all-errors -C - `
  -o "$base\diffusion_models\minimax_h3_image_pruned_w4a8.safetensors" `
  "$repo/diffusion_models/minimax_h3_image_pruned_w4a8.safetensors"
```

**镜像与源的选择**（实测数据）：

| 源 | 速度 | 备注 |
|---|---|---|
| `huggingface.co` 直连 | **3-5 MB/s** | 推荐 |
| `hf-mirror.com` | 3 MB/s | 需 `-L` 跟随 308 重定向 |
| ModelScope | 404 | 该仓库不一定有 |

`-C -` 是断点续传，中断后重跑同一条命令即可继续。

**校验**：下载完检查字节数是否与远端一致。`w4a8` 应为 `12549794530` 字节。

### 3.4 快速自检脚本

```powershell
$m='F:\AI视频\ai-runtime\models'
foreach($d in @('diffusion_models','text_encoders','vae','loras')){
  $p=Join-Path $m $d
  if(Test-Path $p){
    "--- $d ---"
    Get-ChildItem $p -Filter '*.safetensors' | Where-Object{$_.Length -gt 1MB} |
      Select-Object Name, @{n='GB';e={[math]::Round($_.Length/1GB,2)}} | Format-Table -AutoSize
  }
}
```

---

## 4. 插件安装

插件以 **bundle** 形式挂在 DSH 上：

```powershell
# 方式一：本地路径（开发态）
# 在 DSH 的 profile 里把插件目录加入 bundle 列表，或用 plugin_manager 工具启用

# 方式二：如果已发布到 npm
# plugin_manager(action="install_bundle", target="<包名>")
```

**代码**即启用，之后验证：

```powershell
# 拿到插件端口（DSH 每次启动端口不同）
$port = 7792   # 换成实际端口
curl.exe -s "http://127.0.0.1:$port/luoshu/api/health"
curl.exe -s "http://127.0.0.1:$port/luoshu/api/meta"
```

打开 `http://127.0.0.1:<端口>/luoshu/app/` 即可看到界面。

---

## 5. 验收清单

按顺序跑，全绿才算部署成功：

```powershell
# 1) 插件自检（88 项）
node dsh-jiuzhang-studio\_verify-all.mjs

# 2) 模型就绪检查
curl.exe -s "http://127.0.0.1:$port/luoshu/api/image/meta"
# 期望：{"status":{"ready":true, "unet":"...w4a8...", ...}}

# 3) ComfyUI 连通
curl.exe -s http://127.0.0.1:8188/system_stats
```

**视觉验证**（重要，别只看接口）：

- 打开「图像 → 图像生成」，输一句提示词，点生成 → 应在 1-2 分钟出 2048² 图
- 打开「画布」，建一个 AI 视频节点，点运行 → 应出 5 秒视频

---

## 6. 常见问题

| 症状 | 原因 | 处理 |
|---|---|---|
| `IMAGE_MODEL_MISSING` 但文件确实在 | 模型目录不在探测路径内 | 设 `H3_MODEL_ROOT` 环境变量，或在设置里填 `imageModelRoot` |
| 生成报 `COMFY_HTTP_500` | 工作流 JSON 里混入了非数字 key（如 `_comment`） | 插件已自动剔除；自建工作流时注意 |
| 图像节点 404 | ComfyUI 版本 < 0.45 | 升级 ComfyUI |
| 显存 OOM | 用了 int8/bf16 或没加 `--lowvram` | 换 w4a8 + `--lowvram` |
| 视频静音 | 音频 VAE 用了 fp16 | 必须 `minimax_h3_audio_vae_fp32` |
| 中文标注显示方块 | ffmpeg drawtext 没指定字体 | 插件会自动探测 `msyh.ttc`；手动调用时传 `fontFile` |
| 页面报 `BAD_RESPONSE` | 浏览器缓存了旧端口页面 | `Ctrl+Shift+R` 硬刷新 |
| 下载卡 0 字节 | `hf_hub_download` 与镜像不兼容 | 改用 curl 直连 |

---

## 7. 硬件与性能基线（实测数据）

测试机：**RTX 4080 Laptop 12 GB / 24 核 / 64 GB RAM**

| 任务 | 分辨率 | 耗时 | 显存峰值 |
|---|---|---|---|
| H3 视频（5 秒，Ref2VA） | 864×480 | 130 秒 | 11.5 GB |
| H3-Image 文生图 | 2048×2048 | 45-85 秒 | 11.4 GB |
| H3-Image 文生图 | 1024×1024 | ~9 分钟（含首次加载） | 11.4 GB |
| 人设卡拆解图 | 2048×2048 | 80-90 秒 | 11.4 GB |
| 漫画单格 | 2048×2048 | 75 秒 | 11.4 GB |
| 预演白模→成片 | 2048×1344 | 75 秒 | 11.4 GB |

**注意**：
- 首次加载模型很慢（1024² 那次 9 分钟基本都在加载）
- 模型常驻后单张约 45-90 秒
- 12 GB 显存**不能并行**，插件内部串行执行

---

## 8. 硬约束（改代码时必须遵守）

这些是从实际报错反推出来的，违反会直接失败：

| 约束 | 值 | 违反后果 |
|---|---|---|
| H3 视频分辨率 | 必须是 32 的倍数，且在官方档位（864×480 / 960×544 / 1056×608 / 1344×768） | RuntimeError |
| H3 视频帧数 | 必须在 17k+5 网格（124 / 243 / 362） | 报错或时长错误 |
| H3 guidance | 必须 1.0（CFG 蒸馏模型） | 画面崩坏 |
| 视频采样步数 | Turbo LoRA 只能 4 或 8 | 质量差 |
| 音频 VAE | 必须 fp32 | 静音 |
| H3-Image 步数 | 固定 6（checkpoint 蒸馏） | 无此参数 |
| H3-Image guidance | 固定 1.0 | 同上 |
| H3-Image 负面提示 | **不支持** | 写了也没用，改成正向描述 |
| H3-Image 尺寸 | 32 的倍数；0 = 自动 2048² | 报错 |
| 参考图上限 | Ref2VA 9 张；H3-Image 16 张 | 报错 |
| 参考视频/音频 | 各 3 段，每段 2-15 秒 | 报错 |
| 参考文件总数 | ≤ 12 | 报错 |

---

## 9. 许可证提醒

**H3-Image 的许可与 H3 视频不同。**

- 年收入 ≤ 100 万美元 且 不对外提供托管服务 → 可直接使用
- 超出上述任一条件 → 需向 MiniMax 单独申请授权（https://platform.minimax.io/license）

个人与内部团队使用不受限制。
