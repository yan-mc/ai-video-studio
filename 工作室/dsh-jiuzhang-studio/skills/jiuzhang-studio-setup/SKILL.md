---
name: jiuzhang-studio-setup
description: 从零部署九章工作室插件（DSH 视频/图像创作插件）。当用户要安装、部署、修复或迁移这个插件时使用，涵盖环境准备、本地模型下载（H3 视频 + H3-Image 图像 + Fun ControlNet 控制模型，约 70GB）、Blender 预演引擎安装、ComfyUI 配置、插件挂载与验收。插件本体不含模型权重、不含 Blender，必须由使用者自行下载。
---

# 九章工作室 · 部署与本地模型配置

> 插件本体（`@local/dsh-jiuzhang-studio`）**不包含任何模型权重**，也**不包含 Blender**。
> 生成能力依赖：本地 ComfyUI + MiniMax H3 系列模型（约 **70 GB**）+ 可选的 Blender 5.2（约 390 MB）。
> 本 skill 描述完整部署流程，供 AI 代理按步骤执行。

---

## 0. 前置确认

部署前必须确认四件事：

| 项 | 要求 | 检查方式 |
|---|---|---|
| **GPU 显存** | ≥ 12 GB（H3 视频 33B + H3-Image 33B 靠量化 + lowvram 运行） | `nvidia-smi --query-gpu=memory.total --format=csv,noheader` |
| **磁盘** | ≥ 95 GB 空闲（模型约 70 GB + Blender 0.4 GB + 工作区） | `Get-PSDrive` / `df -h` |
| **ComfyUI** | **0.45.0 或更高**（0.35 起有 Fun ControlNet，0.44 无 `MiniMaxH3ImageConditioning`） | `curl http://127.0.0.1:8188/system_stats` |
| **Blender**（可选） | **5.2 或更高**；不装则 3D 预演不可用，其它功能不受影响 | `blender --version` |

显存不足时的取舍：

- **12 GB**：只能跑 w4a8/int8 量化 + `--lowvram`（推荐路径，已验证）
- **16-24 GB**：可用更大位宽，质量更好
- **48 GB+**：可跑 bf16

---

## 1. 目录约定

推荐布局（路径可改，但下文以此为例）：

> 下文用 `<工作区>` 代表你选的根目录（例如 `D:\AI视频`）。
> 请先把它设成变量，后面的命令直接复制即可：
>
> ```powershell
> $ws = 'D:\AI视频'        # ← 改成你自己的目录
> ```

```
<工作区>\
├── ai-runtime\                 # 运行时（含模型，不进插件仓库）
│   ├── ComfyUI\                # ComfyUI 源码（git 仓库）
│   ├── venv\                   # Python 虚拟环境
│   └── models\                 # ★ 模型放这里（见 §3）
└── 工作室\
    ├── dsh-jiuzhang-studio\    # 插件本体
    └── tools\                  # ★ 便携工具（不进插件仓库）
        ├── ffmpeg\             # ffmpeg / ffprobe
        └── blender-5.2.4-windows-x64\   # Blender 便携版
```

### 1.1 模型目录的自动探测

插件通过 `resolveModelRoot()` 自动找模型目录，顺序：

1. 配置项 `imageModelRoot`
2. `comfyInputDir` 的兄弟目录 `models`
3. 环境变量 `H3_MODEL_ROOT`
4. 常见路径 `<工作区>\ai-runtime\models`
5. 从插件位置向上 6 层找 `models` 或 `ai-runtime\models`

**⚠️ 关键**：ComfyUI 自己读的是 `<ComfyUI>\models\`，而插件探测的是 `<工作区>\ai-runtime\models`。
两者**可能不是同一个目录**！实测踩过：模型放在 `ai-runtime\models` 但 ComfyUI 读的是
`ai-runtime\ComfyUI\models`，表现为 ComfyUI 的模型下拉框里**什么都看不到**。

**推荐做法**：直接放进 **`<工作区>\ai-runtime\ComfyUI\models\`**（ComfyUI 的真实模型根），
这样两边都能用；或者用 `extra_model_paths.yaml` 把 `ai-runtime\models` 挂进去。

### 1.2 工具的二进制定位（都不接受配置注入）

| 工具 | 定位顺序 |
|---|---|
| **ffmpeg** | `DSH_FFMPEG_DIR` / `FFMPEG_DIR` → 配置项 `ffmpegDir` → `<插件>/../../tools/ffmpeg` → PATH |
| **Blender** | `DSH_BLENDER` / `BLENDER_EXE` / `BLENDER_PATH` → `DSH_BLENDER_DIR` → `<插件>/../../tools/blender-<版本>/` → PATH |

可执行路径**刻意不接受** Web 配置项注入（防 RCE）。

---

## 2. ComfyUI 安装与升级

```powershell
# 克隆（或用已有的）
git clone https://github.com/comfyanonymous/ComfyUI.git <工作区>\ai-runtime\ComfyUI

# 建 venv（Python 3.10+，实测 3.12 可用）
cd <工作区>\ai-runtime
python -m venv venv

# 装依赖（torch 用 CUDA 版，实测 cu128 + torch 2.11 可用）
<工作区>\ai-runtime\venv\Scripts\python.exe -m pip install --upgrade pip
<工作区>\ai-runtime\venv\Scripts\python.exe -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
cd ComfyUI
<工作区>\ai-runtime\venv\Scripts\python.exe -m pip install -r requirements.txt
```

**升级到 0.45.0+**（必须，否则没有 H3-Image 节点）：

```powershell
cd <工作区>\ai-runtime\ComfyUI
git fetch origin
git pull origin master
<工作区>\ai-runtime\venv\Scripts\python.exe -m pip install -r requirements.txt
```

验证节点存在：

```powershell
# H3-Image 图像节点
curl.exe -s http://127.0.0.1:8188/object_info/MiniMaxH3ImageConditioning

# 控制视频节点（0.35+ 才有）
curl.exe -s http://127.0.0.1:8188/object_info/MiniMaxH3FunControlNetApply
# 应返回 required: model, model_patch, vae, strength, start_percent, end_percent
#          optional: control_video, mask, source_video

# 任意帧锚定节点（Ref2VA 没有 first_frame 口，靠它）
curl.exe -s http://127.0.0.1:8188/object_info/MiniMaxH3AddGuide
```

启动（12 GB 显存必须 `--lowvram`）：

```powershell
<工作区>\ai-runtime\venv\Scripts\python.exe main.py --lowvram --listen 127.0.0.1 --port 8188
```

> 端口被 Hyper-V 占用时报 `WinError 10013`，换个端口即可（插件会自动跟随 `.comfy-port` 文件）。

---

## 3. 模型下载（约 70 GB）

来源：**Comfy-Org** 的魔改版仓库（已适配 ComfyUI 加载），比原版更适合直接使用。

- 仓库：`Comfy-Org/MiniMax-H3`（视频 + 控制模型）、`Comfy-Org/MiniMax-H3-Image`（图像）、
  `Comfy-Org/Depth-Anything-3`（深度估计，可选）

### 3.1 视频模型（H3，约 47 GB）

**全部放进 `<ComfyUI>\models\`**（见 §1.1 的坑）。

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

### 3.2 控制模型（Fun ControlNet Union 2.0，4.22 GB）★ 新增

**这是「Blender 白模指导 H3」的核心**。没有它，Blender 只能出 RGB 参考视频；
有了它，Blender 渲的 depth/pose/canny **逐帧约束** H3 的结构与运动。

| 文件 | 大小 | 存放目录 |
|---|---|---|
| `minimax_h3_fun_controlnet_union_2.0_pruned_int8_convrot.safetensors` | **4.22 GB** | **`model_patches/`** |

```powershell
# 注意目录是 model_patches，不是 controlnet
New-Item -ItemType Directory -Force -Path "$ws\ai-runtime\ComfyUI\models\model_patches" | Out-Null
curl.exe -L --fail --retry 10 -C - `
  -o "$ws\ai-runtime\ComfyUI\models\model_patches\minimax_h3_fun_controlnet_union_2.0_pruned_int8_convrot.safetensors" `
  "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/model_patches/minimax_h3_fun_controlnet_union_2.0_pruned_int8_convrot.safetensors"
```

**⚠️ 放好后必须重启 ComfyUI**：`folder_paths` 有目录缓存，新建的 `model_patches/`
不重启就读不到（表现为 `ModelPatchLoader` 的下拉框为空）。

**可选：更强控制**

| 版本 | 条件数 | 体积 | 差异 |
|---|---|---|---|
| v2（推荐） | **8** — Canny/Depth/HED/MLSD/Pose/**Scribble/Layout/Gray** | 4.22 GB (int8) / 7.81 GB (bf16) | 10 个注入层 |
| v1 | 5 — Canny/Depth/HED/MLSD/Pose | 2.14 GB (int8) | 5 个注入层 |

Union 的含义：**节点不区分类型**，喂什么图就是什么控制。

### 3.3 图像模型（H3-Image，约 12.7 GB）

| 文件 | 大小 | 存放目录 | 说明 |
|---|---|---|---|
| `minimax_h3_image_pruned_w4a8.safetensors` | 12.55 GB | `diffusion_models/` | **12 GB 显存首选** |
| `minimax_h3_image_pruned_int8_convrot.safetensors` | 20.98 GB | `diffusion_models/` | 16 GB+ 可用 |
| `minimax_h3_image_pruned_bf16.safetensors` | 40.23 GB | `diffusion_models/` | 48 GB+ |
| `minimax_h3_image_vae_fp16.safetensors` | 1.17 GB | `vae/` | **图像 VAE，与视频 VAE 不同** |

**三档只需选一个**（插件会自动按 w4a8 → int8 → bf16 顺序挑可用的）。
文本编码器与视频**共用**，不用重复下载。

### 3.4 深度估计（可选，1.7 GB）

如果**没有 Blender**，又想用 depth 控制视频，可以用 DepthAnything3 从现成视频反推深度。

| 文件 | 大小 | 存放目录 |
|---|---|---|
| `depth_anything_3_base.safetensors` | 0.50 GB | `geometry_estimation/` |
| `depth_anything_3_metric_large.safetensors` | 1.24 GB | `geometry_estimation/` |

```powershell
$repo = "https://huggingface.co/Comfy-Org/Depth-Anything-3/resolve/main/geometry_estimation"
New-Item -ItemType Directory -Force -Path "$ws\ai-runtime\ComfyUI\models\geometry_estimation" | Out-Null
curl.exe -L --fail --retry 10 -C - -o "$ws\ai-runtime\ComfyUI\models\geometry_estimation\depth_anything_3_base.safetensors" "$repo/depth_anything_3_base.safetensors"
```

> DepthAnything 出图**只要 4 秒/120 帧**，比 Blender 还快；但它是"猜"出来的深度，
> 构图上不如 Blender 精确。有 Blender 就优先用 Blender。

### 3.5 下载方法（重要：踩坑记录）

**推荐用 curl 直连**；也可以用 `huggingface_hub`（实测 200 MB/s，但需要 newer 版本）：

```powershell
$base = "$ws\ai-runtime\ComfyUI\models"

# 例：视频底模（19.5 GB）
curl.exe -L --fail --retry 10 --retry-delay 3 --retry-all-errors -C - `
  -o "$base\diffusion_models\minimax_h3_ref2va_pruned_fp8_scaled.safetensors" `
  "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors"
```

**镜像与源的选择**（实测数据）：

| 源 | 速度 | 备注 |
|---|---|---|
| `huggingface.co` 直连 | **3-5 MB/s**（curl）/ **200 MB/s**（hf_hub） | 推荐 |
| `hf-mirror.com` | 3 MB/s | 需 `-L` 跟随 308 重定向 |
| ModelScope | 404 | 该仓库不一定有 |

`-C -` 是断点续传，中断后重跑同一条命令即可继续。

**校验**：下载完检查字节数是否与远端一致。`w4a8` 应为 `12549794530` 字节。

### 3.6 快速自检脚本

```powershell
$m = "$ws\ai-runtime\ComfyUI\models"
foreach ($d in @('diffusion_models','text_encoders','vae','loras','model_patches','geometry_estimation')) {
  $p = Join-Path $m $d
  if (Test-Path $p) {
    "--- $d ---"
    Get-ChildItem $p -Filter '*.safetensors' -ErrorAction SilentlyContinue |
      Where-Object { $_.Length -gt 1MB } |
      Select-Object Name, @{n='GB';e={[math]::Round($_.Length/1GB,2)}} | Format-Table -AutoSize
  }
}
```

---

## 4. Blender 安装（3D 预演必需）

**Blender 5.2 LTS 便携版**，不改系统环境、不写注册表：

```powershell
$tools = "$ws\工作室\tools"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
cd $tools

# 下载便携版（约 387 MB）
curl.exe -L --fail --retry 5 --retry-all-errors -C - `
  -o "blender-5.2.4-windows-x64.zip" `
  "https://download.blender.org/release/Blender5.2/blender-5.2.4-windows-x64.zip"

# 解压
Expand-Archive -Path "blender-5.2.4-windows-x64.zip" -DestinationPath "." -Force

# 验证
& "$tools\blender-5.2.4-windows-x64\blender.exe" --version
# 应输出：Blender 5.2.4 LTS
```

**插件会自动在 `<插件>/../../tools/blender-<版本>/` 找它**，无需配置。
放在别处则设环境变量：

```powershell
$env:DSH_BLENDER = 'D:\your\path\blender.exe'
```

### 4.1 验证 Blender 可用

```powershell
# 插件健康检查（应有 available: true）
curl.exe -s "http://127.0.0.1:$port/jiuzhang/api/blender/health"
```

或在 SPA 的「3D 预演」页看状态徽章。

### 4.2 为什么不做内嵌 WASM Blender

浏览器里跑 WASM Blender 需要 **COOP/COEP 跨源隔离头**（会影响整个 SPA 的跨源资源），
12 GB 笔记本上的编辑流畅度未验证，包体 66.7 MB，且与「打开桌面 Blender」功能重叠。
当前方案：**页面渲预览让人看，桌面 Blender 负责改**。

### 4.3 许可证边界（重要）

| 内容 | 许可 | 说明 |
|---|---|---|
| Blender 本体 | GPL-2.0-or-later | **以子进程方式调用**（`blender -b --python`），不作为库链接 |
| `host/blender/*.py` | **GPL-3.0-or-later** | 它们 `import bpy`，属于 Blender 衍生脚本 |
| 插件本体（JS 侧） | 保持现有许可 | 与 Blender 只通过命令行/文件通信 |
| 产出的 .blend / 渲染图 / mp4 | **完全归用户** | GPL 不传染产出物 |

> ⚠️ 若改成 addon 形态（常驻 `import bpy` 的扩展），必须把整个插件改为 GPL 兼容。
> `tests/verify-all.mjs` 有一条断言专门锁住"必须是 `-b --python` 子进程"。

---

## 5. 插件安装

插件以 **bundle** 形式挂在 DSH 上：

```powershell
# 方式一：本地路径（开发态）—— 用 plugin_manager 工具
# plugin_manager(action="install_bundle", target="<插件绝对路径>")

# 方式二：如果已发布到 npm
# plugin_manager(action="install_bundle", target="<包名>")
```

**代码**即启用，之后验证：

```powershell
$port = 10038   # 换成实际端口
curl.exe -s "http://127.0.0.1:$port/jiuzhang/api/health"
curl.exe -s "http://127.0.0.1:$port/jiuzhang/api/meta"
curl.exe -s "http://127.0.0.1:$port/jiuzhang/api/blender/health"
```

打开 `http://127.0.0.1:<端口>/jiuzhang/app/` 即可看到界面。

---

## 6. 验收清单

按顺序跑，全绿才算部署成功：

```powershell
cd <插件目录>

# 1) 全量验收（351 项）
node tests/verify-all.mjs
# 期望 TOTAL PASS=351 FAIL=0

# 2) 装机后检查（需要 DSH 在跑）
node tests/postinstall-check.mjs http://127.0.0.1:<端口>
# 期望 PASS=11 FAIL=0

# 3) SPA 单测
cd app-src && node --import ./tests/register.mjs tests/runAll.mjs
# 期望 pass 179 fail 0

# 4) 模型就绪
curl.exe -s "http://127.0.0.1:<端口>/jiuzhang/api/image/meta"
# 期望：{"status":{"ready":true, ...}}

# 5) 控制模型就绪（决定 Blender 链路能不能用）
curl.exe -s "http://127.0.0.1:8188/object_info/ModelPatchLoader"
# 期望：options 里有 minimax_h3_fun_controlnet_union_2.0_pruned_int8_convrot

# 6) Blender 就绪
curl.exe -s "http://127.0.0.1:<端口>/jiuzhang/api/blender/health"
# 期望：{"ok":true,"available":true,"exe":"...","modes":[...]}
```

**视觉验证**（重要，别只看接口）：

- 「图像」页输一句提示词 → 应在 1-2 分钟出 2048² 图
- 「画布」建一个 AI 视频节点 → 应出 5 秒带音轨视频
- **「3D 预演」页点「渲染预览」→ 应在 5 秒内出彩色灰模动画**
- 「3D 预演」页点「渲染」depth → 应有灰度深度序列

---

## 7. 常见问题

| 症状 | 原因 | 处理 |
|---|---|---|
| `IMAGE_MODEL_MISSING` 但文件确实在 | 模型目录不在探测路径内 | 设 `H3_MODEL_ROOT`，或填 `imageModelRoot`；见 §1.1 |
| **ComfyUI 模型下拉框为空** | 模型放到了 `ai-runtime\models` 而非 `ComfyUI\models` | 移动文件，或配 `extra_model_paths.yaml` |
| **`ModelPatchLoader` 列表为空** | 新建的 `model_patches/` 未被扫描 | **重启 ComfyUI**（`folder_paths` 有缓存） |
| 生成报 `COMFY_HTTP_500` | 工作流 JSON 里混入非数字 key | 插件已自动剔除；自建工作流注意 |
| 生成报 `Value not in list`（模型名） | 装的是 int8 版但代码写死 fp8 名 | 插件会自动降级；也可在配置里覆盖 `modelNames` |
| 图像节点 404 | ComfyUI 版本 < 0.45 | 升级 ComfyUI |
| 显存 OOM | 用了 int8/bf16 或没加 `--lowvram` | 换 w4a8 + `--lowvram` |
| 视频静音 | 音频 VAE 用了 fp16 | 必须 `minimax_h3_audio_vae_fp32` |
| 中文标注显示方块 | ffmpeg drawtext 没指定字体 | 插件会自动探测 `msyh.ttc`；手动调用时传 `fontFile` |
| 页面报 `BAD_RESPONSE` | 浏览器缓存了旧端口页面 | `Ctrl+Shift+R` 硬刷新 |
| 下载卡 0 字节 | `hf_hub_download` 与镜像不兼容 | 改用 curl 直连 |
| **3D 预演显示"未安装"** | Blender 不在探测路径 | 放到 `<插件>/../../tools/blender-<版本>/`，或设 `DSH_BLENDER` |
| **控制视频没生效但没报错** | 控制模型缺失（插件会自动关掉控制通道） | 看 `job.params.controlSkipped`；装 §3.2 的模型 |
| **AddGuide 报 `image, received_type(CONDITIONING)`** | 节点编号冲突（已在 1.4.0 修复） | 升级插件 |
| **canny 产物和 gray 一样** | 边缘检测缺失（已在 1.4.0 修复） | 升级插件 |

---

## 8. 硬件与性能基线（实测数据）

测试机：**RTX 4080 Laptop 12 GB / 24 核 / 64 GB RAM**

| 任务 | 分辨率 | 耗时 | 显存峰值 |
|---|---|---|---|
| H3 视频（5 秒，Ref2VA，无控制） | 864×480 | **130 秒** | 11.5 GB |
| H3 视频（5 秒，Ref2VA + ControlNet） | 864×480 | **217–259 秒** | 11.5 GB（控制分支 staged 4304 MB） |
| H3 视频（3 秒，+ 角色卡 + 控制 + 首帧） | 864×480 | **240–300 秒** | 同上 |
| H3-Image 文生图 | 2048×2048 | 45-85 秒 | 11.4 GB |
| 立绘拆解图 | 2048×2048 | 80-90 秒 | 11.4 GB |
| 漫画单格 | 2048×2048 | 75 秒 | 11.4 GB |
| **Blender 渲 depth（124 帧）** | 864×480 | **20.7 秒** | 无（CPU/GPU 都很轻） |
| **Blender 渲 pose（124 帧）** | 864×480 | **20.8 秒** | 同上 |
| **Blender 渲 preview（72 帧）** | 864×480 | **4 秒** | 同上 |
| **DepthAnything3 出深度（120 帧）** | 1280×720 | **4 秒** | ~2 GB |

**结论**：Blender 渲染的耗时只占 H3 生成的 **< 10%**，不构成瓶颈。

**注意**：

- 首次加载模型很慢（1024² 那次 9 分钟基本都在加载）
- 模型常驻后单张约 45-90 秒
- 12 GB 显存**不能并行**，插件内部串行执行
- 加控制视频后单镜耗时 **+80%** 左右（控制分支每步都要多算 10 个 ControlDiTBlock）

---

## 9. 硬约束（改代码时必须遵守）

这些是从实际报错反推出来的，违反会直接失败：

| 约束 | 值 | 违反后果 |
|---|---|---|
| H3 视频分辨率 | 必须是 32 的倍数，且在官方档位（864×480 / 960×544 / 1056×608 / 1344×768） | RuntimeError |
| H3 视频帧数 | 必须在 17k+5 网格（124 / 243 / 362） | 报错或时长错误 |
| H3 视频时长 | 训练范围 **124–362 帧（≈5–15 秒）**，更长未经训练 | 质量崩坏 |
| H3 guidance | 必须 1.0（CFG 蒸馏模型） | 画面崩坏 |
| 视频采样步数 | Turbo LoRA 只能 4 或 8 | 质量差 |
| 音频 VAE | 必须 fp32 | 静音 |
| H3-Image 步数 | 固定 6（checkpoint 蒸馏） | 无此参数 |
| H3-Image guidance | 固定 1.0 | 同上 |
| H3-Image 负面提示 | **不支持** | 写了也没用，改成正向描述 |
| H3-Image 尺寸 | 32 的倍数；0 = 自动 2048² | 报错 |
| 参考图上限 | Ref2VA 9 张；H3-Image 16 张 | 报错 |
| 参考视频/音频 | 各 3 段，每段 2-15 秒 | 报错 |
| 参考视频+音频合计 | **≤ 14.8 秒**（超出自动裁剪） | 自动裁剪并告警 |
| 参考文件总数 | ≤ 12 | 报错 |
| **控制视频长度** | 比目标长 → 截前段；比目标短 → **重复最后一帧** | 时长对不上 |
| **控制模型目录** | 必须是 `models/model_patches/`（不是 `controlnet/`） | 加载器看不到 |
| **音轨必须接线** | `SamplerCustomAdvanced → VAEDecodeAudio(audio_vae) → CreateVideo.audio` | **产物静音**（不报错，静默丢失） |
| **AUTOGROW 用点号路径** | `ref_images.ref_image_1` / `ref_videos.ref_video_1` | 被 ComfyUI **静默忽略** |
| **Ref2VA 没有 first_frame 口** | 首尾帧必须走 `MiniMaxH3AddGuide` | 静默丢弃 |
| **AddGuide 节点编号** | 从 80 起（70/71 是 LoadImage 槽位） | 覆盖 LoadImage → `received_type(CONDITIONING)` |
| **坐标系** | 镜头卡用 (x, y=高度, z=深度)；Blender 是 Z-up | 人偶躺平 / 整张图全黑 |

### 9.1 音轨丢失（最隐蔽的坑）

H3 是**音画同步模型**：采样器输出的 LATENT 是 AV latent（音视频合一），
只接视频 `VAEDecode` 会**把音轨整个丢掉**，而且**不报错**。

工作流必须这样接：

```json
"15": { "class_type": "VAELoader",       "inputs": { "vae_name": "minimax_h3_audio_vae_fp32.safetensors" } },
"16": { "class_type": "VAEDecodeAudio",  "inputs": { "samples": ["11",0], "vae": ["15",0] } },
"13": { "class_type": "CreateVideo",     "inputs": { "images": ["12",0], "audio": ["16",0], "fps": 24 } },
"9":  { "inputs": { "audio_vae": ["15",0], ... } }
```

验收方法（不要只看文件存在）：

```powershell
ffprobe -v error -print_format json -show_streams out.mp4
# 必须同时有 video 和 audio 两条流
ffmpeg -i out.mp4 -af volumedetect -f null -
# mean_volume 不能是 -inf（-inf = 纯静音）
```

### 9.2 AUTOGROW 输入的写法

`ref_images` / `ref_videos` / `ref_video_audios` / `ref_audios` 都是 **Autogrow** 输入，
必须写成**带点号的平铺键**：

```
✅ "ref_images.ref_image_1": ["20", 0]
❌ "ref_images": [["20", 0]]        ← 会被静默忽略，参考图完全不生效
```

判断是否真的生效：同一 prompt+seed，有无参考图若输出哈希完全相同，说明没接上。

### 9.3 参考视频要拆成帧序列

`ref_videos` 要的是 **IMAGE（帧序列）**，不是 VIDEO。必须转：

```
LoadVideo(file) → GetVideoComponents ─┬─ 0=IMAGE → ref_videos.ref_video_K
                                       └─ 1=AUDIO → ref_video_audios.ref_video_audio_K
```

视频与其音轨**必须同号**（源码按编号配对，不按数组顺序）。

### 9.4 控制视频（Fun ControlNet）的三个要点

```json
"60": { "class_type": "LoadVideo",  "inputs": { "file": "control.mp4" } },
"61": { "class_type": "GetVideoComponents", "inputs": { "video": ["60",0] } },
"62": { "class_type": "ModelPatchLoader",   "inputs": { "name": "minimax_h3_fun_controlnet_union_2.0_pruned_int8_convrot.safetensors" } },
"63": { "class_type": "MiniMaxH3FunControlNetApply", "inputs": {
          "model": ["4",0], "model_patch": ["62",0], "vae": ["3",0],
          "strength": 1.3, "start_percent": 0.0, "end_percent": 0.85,
          "control_video": ["61",0] } }
```

1. **必须把 `BasicScheduler` 和 `BasicGuider` 的 `model` 改指向 63**
   —— 只挂一个孤立节点是死分支，控制完全不生效且**不报错**。
2. **`strength` 1.0 起调**；画面发僵往下调，控制不住往上调。
3. **`control_video` 是 IMAGE 批量，不是路径** —— 所以要走 LoadVideo → GetVideoComponents。

### 9.5 分段串联：为什么必须 Ref2VA + AddGuide

| 方案 | 能否用 | 原因 |
|---|---|---|
| I2VA / FL2VA | ❌ | **没有 `ref_images` 输入口**，用了就没法挂角色卡，两张脸会飘 |
| Ref2VA | ✅ 基础 | 支持参考图 + 参考视频 + 控制视频 |
| **Ref2VA + `MiniMaxH3AddGuide`** | ✅ **推荐** | 参考图锁身份，AddGuide 在 `frame_idx=0` 锚首帧，两者共存 |

```json
"80": { "class_type": "MiniMaxH3AddGuide",
        "inputs": { "positive": ["9",0], "latent": ["9",1], "vae": ["3",0],
                    "frame_idx": 0, "image": ["70",0] } },
"70": { "class_type": "LoadImage", "inputs": { "image": "上一段的末帧.png" } }
```

**⚠️ AddGuide 节点编号必须 ≥ 80**：70/71 已被 LoadImage 占用，
若 AddGuide 也从 70 开始编号会**覆盖掉 LoadImage**，ComfyUI 报
`image, received_type(CONDITIONING)`（把 conditioning 当图用了）。

**⚠️ 首尾帧必须是成片风格的图**：AddGuide 锚定强度非常高，
锚白模首帧会让整段输出都是白模。

---

## 10. 许可证提醒

**H3-Image 的许可与 H3 视频不同。**

- 年收入 ≤ 100 万美元 且 不对外提供托管服务 → 可直接使用
- 超出上述任一条件 → 需向 MiniMax 单独申请授权（https://platform.minimax.io/license）

**Blender** 是 GPL-2.0-or-later，以子进程调用不传染插件本体；但 `host/blender/*.py`
按 GPL-3.0-or-later 释放（见 §4.3）。产出的 .blend / 渲染图 / mp4 完全归用户。

个人与内部团队使用不受限制。
