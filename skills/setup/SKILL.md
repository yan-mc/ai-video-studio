---
name: jiuzhang-studio-setup
description: 从零部署九章工作室插件（DSH 视频/图像创作插件）。当用户要安装、部署、修复或迁移这个插件时使用，涵盖环境准备、本地模型下载（H3 视频 + H3-Image 图像，约 70 GB）、Blender 预演引擎安装、ComfyUI 配置、vendor 节点部署、插件挂载与人工验收。插件本体不含模型权重、不含 Blender，必须由使用者自行下载。
---

# 九章工作室 · 部署与本地模型配置

> 插件本体（`@local/dsh-jiuzhang-studio` v4.0.0）**不含模型权重**，也**不含 Blender**。
> 依赖：本地 ComfyUI 0.45.0 + MiniMax H3 模型（最小可用集 **约 70 GB**）+ 可选 Blender 5.2（约 390 MB）。
> v4 已删除全部测试脚本，验收一律走**人工步骤**（§7）。

## 0. 前置确认

| 项 | 要求 | 检查 |
|---|---|---|
| **GPU 显存** | ≥ 12 GB（H3 33B + H3-Image 33B 靠量化 + DynamicVRAM） | `nvidia-smi --query-gpu=memory.total --format=csv,noheader` |
| **磁盘** | ≥ 95 GB 空闲 | `Get-PSDrive` |
| **Python / torch** | 3.10+（实测 3.12.10）/ CUDA 版（实测 2.11.0+cu128） | `python -c "import torch;print(torch.__version__)"` |
| **PowerShell 7** | **必需**。`start-h3.ps1` 是 UTF-8，5.1 会解析失败 | `pwsh --version` |
| **ComfyUI** | **0.45.0**（H3 节点在 `comfy_extras/nodes_minimax_h3.py`） | `curl.exe -s http://127.0.0.1:8488/system_stats` |
| **Blender**（可选） | 5.2.x；不装则 3D 预演不可用，其它功能不受影响 | `blender --version` |

存算取舍：**12 GB** 必须 w4a8（12.55 GB）+ `maxConcurrentLocal:1` 串行；
**16–24 GB** 可换 int8_convrot（~21 GB）；**48 GB+** 可跑 bf16（~40 GB）。

## 1. 目录约定

```powershell
$ws = 'F:\AI视频'        # ← 改成你自己的根目录
```

```
<工作区>\
├── ai-runtime\
│   ├── ComfyUI\models\        # ★ ComfyUI 读这里
│   ├── models\                # ★ 插件探测这里（见 §1.1）
│   ├── venv\  .comfy-port     # ★ 端口由 start-h3.ps1 写入
│   └── start-h3.ps1           # ★ 插件「启动」按钮调它
├── tools\  ffmpeg\  blender-5.2.4-windows-x64\
└── dsh-jiuzhang-studio\       # 插件本体
```

### 1.1 模型根目录探测（`resolveModelRoot()`）

`host/services/h3-image.js`，取第一个真正存在 `diffusion_models/` 子目录的候选：
① `imageModelRoot` ② `comfyInputDir/../models` 与 `../../models`
③ `H3_MODEL_ROOT` / `COMFY_MODEL_ROOT` / `COMFYUI_MODEL_ROOT`
④ 从插件向上 6 层的 `models` / `ai-runtime/models` / `ComfyUI/models`

**⚠️ 关键**：插件扫 `<工作区>\ai-runtime\models`，ComfyUI 只读 `<ComfyUI>\models\`。
两者不通时表现为 **ComfyUI 模型下拉框全空**（插件自己能扫盘，所以不报缺模型）。

```powershell
# 方案 A（本机实际采用）：目录联接把 ComfyUI 的模型目录指过去
$c = "$ws\ai-runtime\ComfyUI\models"
foreach ($d in @('diffusion_models','text_encoders','vae','loras','latent_upscale_models')) {
  if (Test-Path "$c\$d") { Remove-Item "$c\$d" -Recurse -Force }
  cmd /c mklink /J "$c\$d" "$ws\ai-runtime\models\$d"
}
# 方案 B：写 ComfyUI 的 extra_model_paths.yaml
```

两头都绿才算接通：`/object_info/UNETLoader` 能看到模型名，**且** `/jiuzhang/api/image/meta` 的 `status.ready == true`。

### 1.2 二进制定位（都不接受 Web 配置注入，防 RCE）

- **ffmpeg**：`DSH_FFMPEG_DIR` / `FFMPEG_DIR` → `ffmpegDir` → 从插件向上 6 层找 `tools/ffmpeg`（认 `bin/` 与根目录两种布局）→ PATH
- **Blender**：`DSH_BLENDER` / `BLENDER_EXE` / `BLENDER_PATH` → `DSH_BLENDER_DIR` → `<插件>/../../..` 与 `<插件>/../..` 下的 `tools/blender-*` → PATH

`ffmpegDir` 默认值可用，但**不在** `WRITABLE_CONFIG_KEYS` 内（写了也不生效）。

## 2. ComfyUI 安装与启动

```powershell
git clone https://github.com/comfyanonymous/ComfyUI.git "$ws\ai-runtime\ComfyUI"
cd "$ws\ai-runtime"; python -m venv venv
$py = "$ws\ai-runtime\venv\Scripts\python.exe"
& $py -m pip install --upgrade pip
& $py -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
cd ComfyUI; & $py -m pip install -r requirements.txt
```

```powershell
curl.exe -s http://127.0.0.1:8488/system_stats                      # comfyui_version 应为 0.45.0
curl.exe -s http://127.0.0.1:8488/object_info/MiniMaxH3ImageConditioning
curl.exe -s http://127.0.0.1:8488/object_info/MiniMaxH3AddGuide
```

### 2.1 启动：**只用 `start-h3.ps1`**

插件的 `/jiuzhang/api/comfy/start` 就是 `pwsh -File ai-runtime/start-h3.ps1`。
**不要手写 `--lowvram`** —— 0.45.0 的 DynamicVRAM 下它是空操作，只会打出误导性的 `LOW_VRAM` 日志。

脚本实际传参：`--fast-disk --disable-pinned-memory --cache-none --vram-headroom 1 --use-ck-attention --listen 127.0.0.1 --port <自动>`

| 参数 | 为什么 |
|---|---|
| `--disable-pinned-memory` | Windows pin 上限 = ram×0.40，每模型预留 2 倍地址空间，泄漏 20–30 GB 且杀进程也释放不掉 |
| `--fast-disk` | 模型在 NVMe，权重由 VBAR 直接读文件；与关 pinned 是**互斥的两条后备路径**，此组合自洽 |
| `--cache-none` | 默认 RAM 缓存阈值 `min(128, ram/1024)` 在 32 GB 机器永不满足，每节点后都白清一遍 |
| `--vram-headroom 1` | 12 GB 卡填满时 WDDM 把权重降级到共享显存 → 功耗 100W→44W、算力空转 |
| `--use-ck-attention` | 自带，实测 −14.7%（116s→99s），零额外依赖 |

### 2.2 端口是**自动挑**的，默认不一定是 8488

Hyper-V / WSL / Docker 会**动态保留**大段 TCP 端口，绑定报 `WinError 10013`，且每次重启都可能变。脚本流程：

1. `.comfy-port` 里的端口还在监听 → 直接复用
2. 否则扫 `8488 / 8688 / 8888 / 8388 / 8188`，用 `/system_stats` 确认是 ComfyUI
3. 否则从 `8488 8688 8888 9088 9288 9488 9688 9888 10088 10288` 挑「未被保留且未被占用」的，兜底 11000–24000 按偶数找
4. 成功后把实际端口写入 `ai-runtime/.comfy-port`

**插件解析顺序**（`comfy-client.js`）：

```
环境变量 DSH_COMFY_URL / COMFY_URL
  > ai-runtime/.comfy-port（向上 8 层找，也认 DSH_COMFY_HOME / H3_HOME）
  > 配置项 comfyUrl（DEFAULTS = http://127.0.0.1:8488）
  > 常见端口探测 8488 8688 8888 9088 9288 8388 8188
```

每个候选先打 `/system_stats`，第一个通的才用。所以改 `comfyUrl` 通常**没有效果**，真正生效的是 `.comfy-port`。

## 3. 部署 vendor 节点（必做）

`vendor/` 下是 **ComfyUI 的 Python 自定义节点包**，不是插件代码。插件只通过 HTTP 提交参数。
它们必须复制到 `<ComfyUI>/custom_nodes/`。

### 3.1 `vendor/nanfeng` —— 视频链路（不部署 = `h3-nanfeng` 后端全不可用）

```powershell
cd <插件目录>
pwsh -File vendor/nanfeng/deploy-vendor.ps1 -ComfyDir "$ws\ai-runtime\ComfyUI"
pwsh -File vendor/nanfeng/deploy-vendor.ps1 -ComfyDir "..." -Force -Clean   # 覆盖 / 清残留
```

| 参数 | 行为 |
|---|---|
| `-ComfyDir` | **必填**。目标 = `<ComfyDir>\custom_nodes\nanfeng_prompt_nodes_v15_modified` |
| `-Force` | 目标已存在时**必须加**，否则 `exit 2` 拒绝覆盖（不静默覆盖） |
| `-Clean` | 复制前删掉目标里的 `*.py` 与 `__pycache__`。`Copy-Item -Force` **从不删除**残留旧文件，删过模块后必须用它；带路径校验，只动 `$DEST` |

- 复制范围：`*.py` + `*.json`（如 `dlss_schema.json`）+ 顶层 `VENDOR.md`；排除目录**只有 `__pycache__`**
- 覆盖后**必须重启 ComfyUI**（只在启动时扫描 `custom_nodes`）；脚本末自动跑依赖自检（`torch` / `torchaudio`）

### 3.2 `vendor/inpaint-nodes` —— 局部重绘 crop 模式（v4 起必需）

```powershell
pwsh -File vendor/inpaint-nodes/deploy-vendor.ps1 -ComfyDir "$ws\ai-runtime\ComfyUI"
pwsh -File vendor/inpaint-nodes/deploy-vendor.ps1 -ComfyDir "..." -Force -Clean
```

- 目标 = `<CustomNodes>\jiuzhang_inpaint_nodes`；缺 `__init__.py` 直接 `exit 1`
- 复制 `__init__.py` + `LICENSE-KJNodes.txt` + `VENDOR.md`；只提供
  `JZImageCropByMaskAndResize` / `JZImageUncropByMask`
- **只影响 crop 模式**。未部署时 `POST /image/inpaint` 在**提交前**报
  `INPAINT_NODES_MISSING`（`detail.missing` 列出缺的节点），不会等图展开才崩；`full` 模式不需要它
- 该包**自包含**，只依赖 ComfyUI 自带模块，不需要 KJNodes

### 3.3 第三方节点包

| 包 | 被引用的节点 | 用途 | 必需? |
|---|---|---|---|
| `ComfyUI-KJNodes` | `MiniMaxH3MemoryEfficientSageAttentionPatch`、`ModelPreviewOverrideKJ` | H3 专用 Sage 注意力、实时预览 | 必需（缺则自动关对应参数 + warning） |
| `ComfyUI-H3-Motion-Context` | `MiniMaxH3MotionContext` / `…LoadLatent` / `…SaveLatent` / `…Trim` | 续写 latent 读写 | **续写必需** |
| `ComfyUI-VideoHelperSuite` | `VHS_VideoCombine` | 输出 mp4（不接输出节点报 `prompt_no_outputs`） | 必需 |
| `Comfyui_Minimax_h3_latent_Upscaler` | `H3LatentUpscalerNodeMegapixels` | 潜空间二采 | 二采必需 |
| `ComfyUI-H3-AudioRefine` | `H3AudioRefineMask` | 续写音频精修 | 可选（`continuation*` 预设） |

> ⚠️ `latent_Upscaler` 上游 HEAD 已改名并删掉 `H3LatentUpscalerNodeMegapixels`，
> **不要**用该包最新 HEAD，必须用还原了该节点的历史版本。

**不要装** `ComfyUI-H3-upgrade-kit`（插件代码里零引用）。**不要另找第三方源**：
`MiniMaxH3ReferenceToVideo` / `MiniMaxH3ImageConditioning` / `MiniMaxH3AddGuide` / `MiniMaxH3SigmaShift`
由核心 `comfy_extras` 提供；`GrowMask` / `ImageBlur` / `SplitSigmas` / `SetLatentNoiseMask` /
`ImageToMask` / `MaskToImage` / `ImageCompositeMasked` 也是核心；`LoraLoaderBypassModelOnly`
在核心 `nodes_lora_debug.py`（缺则回退 `LoraLoaderModelOnly` + 告警 + 慢 29%）。
`vendor/nanfeng` 内部还会按需关闭 `H3SLAAttention` / `MiniMaxH3BlockCacheT8` /
`MiniMaxH3TRTVAELoader` / `NvidiaDLSS*` —— 缺哪个关哪个，不会整单失败。

### 3.4 验证

```powershell
$port = (Get-Content "$ws\ai-runtime\.comfy-port" -Raw).Trim()
foreach ($n in @('NanFengH3MultiReferenceGeneratorV15','JZImageCropByMaskAndResize','JZImageUncropByMask','VHS_VideoCombine','MiniMaxH3MotionContextLoadLatent')) {
  curl.exe -s "http://127.0.0.1:$port/object_info/$n"
}
curl.exe -s "http://127.0.0.1:<DSH端口>/jiuzhang/api/image/inpaint/meta"   # 期望 cropAvailable: true
```

## 4. 模型下载

来源：**Comfy-Org** 魔改版仓库（已适配 ComfyUI）：`Comfy-Org/MiniMax-H3`（视频）、
`Comfy-Org/MiniMax-H3-Image`（图像）、Qwen3-VL-32B（文本编码器）。

### 4.1 视频模型（默认名来自 `generator.js` 的 `MODEL_DEFAULTS`）

| 文件 | 大小 | 目录 | 作用 |
|---|---|---|---|
| `minimax_h3_ref2va_pruned_fp8_scaled.safetensors` | 19.5 GiB | `diffusion_models/` | **参考图/视频生成视频**（最常用） |
| `minimax_h3_fl2va_pruned_fp8_scaled.safetensors` | 19.5 GiB | `diffusion_models/` | 首尾帧模式 |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | 25.3 GiB | `text_encoders/` | **文本编码器（视频+图像共用）** |
| `minimax_h3_video_vae_fp16.safetensors` | 4.85 GiB | `vae/` | 视频 VAE |
| `minimax_h3_audio_vae_fp32.safetensors` | 0.56 GiB | `vae/` | **音频 VAE，必须 fp32（fp16 会静音）** |
| `dmad_minimax_h3_8step_full_critic_comfyui.safetensors` | 1.82 GiB | `loras/`（可子目录） | **DMAD 8 步加速（默认 `dmad8`）** |
| `dmad_minimax_h3_4step_full_critic_comfyui.safetensors` | 1.82 GiB | `loras/` | DMAD 4 步（草稿） |
| `minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors` | 0.64 GiB | `latent_upscale_models/` | **二采放大器（默认预设开二采，缺了必失败）** |

> `fl2va` 那 19.5 GiB 只做 Ref2VA 时可不下。同功能其它量化版（`int8_convrot` / `nvfp4_awq` / `bf16`）都能用 ——
> `resolveModelNames()` 按「配置 `modelNames` → 精确匹配 → 前缀 + 量化偏好」自动挑，
> 偏好序 `fp8_scaled > int8_convrot > fp8 > int8 > w4a8 > nvfp4_awq > bf16 > fp16`。

### 4.2 图像模型（三档选一，真实名来自 `IMAGE_MODELS` / `IMAGE_VAE` / `IMAGE_CLIP`）

| 文件 | 大小 | 目录 | 说明 |
|---|---|---|---|
| `minimax_h3_image_pruned_w4a8.safetensors` | 12.55 GB | `diffusion_models/` | **12 GB 首选**（`checkImageModels` 优先挑它） |
| `minimax_h3_image_pruned_int8_convrot.safetensors` | ~21 GB | `diffusion_models/` | 16 GB+ |
| `minimax_h3_image_pruned_bf16.safetensors` | ~40 GB | `diffusion_models/` | 48 GB+ |
| `minimax_h3_image_vae_fp16.safetensors` | 1.17 GB | `vae/` | **图像 VAE，与视频 VAE 不同** |

自动挑选顺序 **w4a8 → int8_convrot → bf16**；文本编码器与视频共用。
**最小可用总量**（ref2va + clip + 两 VAE + dmad8 + w4a8 + image vae + upscaler）
= **65.45 GiB ≈ 70.3 GB（十进制）**；加 fl2va + dmad4 约 **86.8 GiB**。

### 4.3 下载与校验

```powershell
$base = "$ws\ai-runtime\models"
curl.exe -L --fail --retry 10 --retry-delay 3 --retry-all-errors -C - `
  -o "$base\diffusion_models\minimax_h3_ref2va_pruned_fp8_scaled.safetensors" `
  "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors"

Get-ChildItem "$ws\ai-runtime\models" -Recurse -Filter *.safetensors |
  Where-Object { $_.Length -gt 1MB } | Sort-Object Length -Descending |
  Select-Object @{n='GiB';e={[math]::Round($_.Length/1GB,2)}}, Name
```

- `-C -` 是断点续传，中断后重跑同一条命令即可继续
- 镜像 `hf-mirror.com` 可用（需 `-L` 跟随 308）；ModelScope 上不一定有这个仓库
- 校验：`w4a8` 应为 **`12549794530` 字节**；其余对远端 `Content-Length`

## 5. Blender 安装（3D 预演，可选）

```powershell
$tools = "$ws\tools"; New-Item -ItemType Directory -Force -Path $tools | Out-Null; cd $tools
curl.exe -L --fail --retry 5 --retry-all-errors -C - -o "blender-5.2.4-windows-x64.zip" `
  "https://download.blender.org/release/Blender5.2/blender-5.2.4-windows-x64.zip"
Expand-Archive -Path "blender-5.2.4-windows-x64.zip" -DestinationPath "." -Force
& "$tools\blender-5.2.4-windows-x64\blender.exe" --version     # 期望 Blender 5.2.4 LTS
```

放 `<插件>/../../tools/blender-<版本>/` 即自动识别，否则设 `DSH_BLENDER`。

**只有两种渲染模式**（`host/blender/render_shot.py`）：

| mode | 用途 |
|---|---|
| `blockout` | **唯一喂模型的出口** → 镜头「参考视频」→ Ref2VA 的 `<Video N>` |
| `preview` | 彩色灰模动画，**人眼预览，不参与生成** |

> v4 已删除 `depth` / `pose` / `canny` / `gray` 四条「控制塔」通道 ——
> 别按旧文档找它们（要多下 4.22 GB 模型、单镜 +83% 耗时）。

验证：`/jiuzhang/api/blender/health` 期望
`{"ok":true,"available":true,"exe":"…","modes":["preview","blockout"],"referenceModes":["blockout"]}`。

许可证：Blender 本体 GPL-2.0-or-later，以 `blender -b --factory-startup --python` 子进程调用，不作库链接；
`host/blender/*.py` 自身按 GPL-3.0-or-later 释放；插件 JS 侧与产物（.blend / png / mp4）不受传染。

## 6. 插件安装与配置默认值

```powershell
# 开发态：%USERPROFILE%\.dsh\profiles\<profile>\package.json 里
#   "@local/dsh-jiuzhang-studio": "link:<插件绝对路径>"
# 或用 plugin_manager 工具：action="install_bundle", target="<插件绝对路径>"
```

挂载后**重启 DSH**。`cordis.patch.yml` 插入 id `jiuzhang-studio`，注册三个前缀：
`/jiuzhang/api`（REST + SSE）、`/jiuzhang/app`（SPA）、`/jiuzhang/assets`（素材）。

`host/config.js` 的 DEFAULTS（**改这些才是改默认行为**）：

| 键 | 默认 | 说明 |
|---|---|---|
| `comfyUrl` | `http://127.0.0.1:8488` | **只是兜底**，端口文件优先（§2.2） |
| `comfyTimeoutMin` | `120` | 单任务上限（分钟）；`JZ_COMFY_TIMEOUT_MIN` 优先 |
| `defaultBackend` | `h3-nanfeng` | 可选 `h3-nanfeng` / `h3-local` / `h3-image` / `mock` |
| `defaultProfile` | `P12-draft` | 0.4 MP = 864×480 / 4 步 |
| `accelPlan` | `dmad8` | `dmad8` / `dmad4` / `none`（原模型 50 步，可调 20–80） |
| `maxConcurrentLocal` | `1` | 12 GB 卡不能并行 |
| `imageSteps` | `6` | 蒸馏 checkpoint 决定；夹在 4–12，**仅排障，局部重绘忽略它** |
| `imageMaxMP` | `4.3` | 单张出图面积上限（2048² = 4.19 MP） |
| `imageSizeId` | `auto` | `auto` = 2048×2048（有参考图则继承原图） |
| `theme` / `accent` / `locale` | `inknight` / `cinnabar` / `zh` | UI |
| `modelNames` | `{}` | 空 = 自动从 ComfyUI 列表挑 |

> 「默认档位」有两个正交概念：`cfg.defaultProfile = 'P12-draft'`（分辨率/步数档）
> 与南风参数预设 `DEFAULT_PRESET = 'standard'`（含二采）。

## 7. 人工验收（v4 无测试脚本，按序走）

```powershell
$dsh = 8375                                              # 换成实际 DSH Web 端口
$port = (Get-Content "$ws\ai-runtime\.comfy-port" -Raw).Trim()
```

**① 插件健康** `/jiuzhang/api/health` — `ok:true`、`h3.ok:true`（连上 ComfyUI）、
`workflows.ok:true`（两个模板都在）、`blender.available:true`（若装了 Blender）、`accel.current:"dmad8"`。

**② 图像模型就绪** `/jiuzhang/api/image/meta` — `status.ready == true`、`status.unet` 是真实挑中的
文件名、`status.missing == []`、`effective.maxMP == 4.3`、`effective.steps == 6`、
`effective.samplingLocked == true`。

**③ 局部重绘节点就绪** `/jiuzhang/api/image/inpaint/meta` — `cropAvailable:true`、
`denoiseLocked:true`、`stepsLocked:true`、`steps:6`，且**没有** `vendorHint` 字段。

**④ 跑一次出图**

```powershell
curl.exe -s -X POST "http://127.0.0.1:$dsh/jiuzhang/api/image/generate" `
  -H "Content-Type: application/json" `
  -d '{"prompt":"a quiet seaside street at dusk, 2D anime style","sizeId":"sq-2048","count":1}'
```

拿返回的 job id 轮询，确认产物落 `data/outputs/` 且能打开。12 GB 卡 2048² 单张约 45–90 秒（首次含加载更久）。

**⑤ 跑一次局部重绘**（必须 `inpaintMode: "crop"`）

```powershell
curl.exe -s -X POST "http://127.0.0.1:$dsh/jiuzhang/api/image/inpaint" `
  -H "Content-Type: application/json" `
  -d '{"prompt":"a red paper lantern","sourceImage":"outputs/<上一步的图>","maskImage":"tmp-inline/<mask>.png","inpaintMode":"crop","inpaintStrength":"medium","cropResolutionId":"auto"}'
```

- mask 必须**与源图同尺寸**，否则 400 `MASK_SIZE_MISMATCH`
- 预期：bbox 外**逐像素不动**（差异 0.0000）；bbox 内、笔画外轻微改写（≈0.005，羽化尾部，**属正常**）
- 单次约 57–76 秒（2048² / 6 步）

**⑥ 视频链路（可选但建议）** 镜头挂 1 张参考图 → 画布建 AI 视频节点 → 出 5 秒片。
用 `ffprobe` 确认同时有 video 与 audio 两条流（只有视频流 = 音轨丢了，见 §9.1）。

**⑦ 视觉检查（别只看接口）** 「图像」页输一句提示词 → 1–2 分钟出 2048² 图；
「3D 预演」页「渲染预览」（preview）出彩色灰模动画、「渲染灰模」（blockout）把产物挂回镜头参考视频槽。

## 8. 常见问题

| 症状 | 原因 | 处理 |
|---|---|---|
| `IMAGE_MODEL_MISSING` 但文件确实在 | 模型目录不在探测路径内 | 设 `H3_MODEL_ROOT` 或填 `imageModelRoot`（§1.1） |
| **ComfyUI 模型下拉框为空** | 模型在 `ai-runtime\models`，ComfyUI 读 `ComfyUI\models` | 建目录联接或配 `extra_model_paths.yaml`（§1.1 A） |
| `INPAINT_NODES_MISSING` | 没部署 `vendor/inpaint-nodes`（或没重启） | 跑 §3.2 脚本后重启 ComfyUI |
| `prompt_no_outputs` | 南风输出没接 `VHS_VideoCombine` | 装 `ComfyUI-VideoHelperSuite` |
| `MiniMaxH3MotionContextLoadLatent not found` | 续写依赖缺失 | 装 `ComfyUI-H3-Motion-Context` |
| `WinError 10013` | 端口被 Hyper-V 动态保留 | 用 `start-h3.ps1` 自己挑；不要手写端口 |
| 启动即退出、报编码错 | 用了 Windows PowerShell 5.1 | 装 PowerShell 7（`pwsh`） |
| 日志 `LOW_VRAM` 却更慢 | 手加了 `--lowvram` | 删掉（DynamicVRAM 下是空操作） |
| 显存 OOM | 用了 int8/bf16 或调大了 `imageMaxMP` | 换 w4a8；`imageMaxMP` 保持 4.3 |
| 视频静音 | 音频 VAE 用了 fp16 | 必须 `minimax_h3_audio_vae_fp32` |
| `Value not in list`（模型名） | 装的是别的量化版 | 会自动降级；也可用 `modelNames` 覆盖 |
| 图像节点 404 / 挂 LoRA 慢 29% 且发糊 | ComfyUI < 0.45.0（缺 `LoraLoaderBypassModelOnly`） | 升到 0.45.0 |
| 中文标注显示方块 | ffmpeg drawtext 无中文字体 | 插件自动探测 `msyh.ttc`；手动调用传 `fontFile` |
| **3D 预演「未安装」** | Blender 不在探测路径 | 放 `tools/blender-<版本>/` 或设 `DSH_BLENDER` |
| 找不到 depth / pose / canny | 该功能已在 v4 删除 | 只用 `blockout` / `preview` |

## 9. 硬约束（改代码/改参数必须遵守）

| 约束 | 值 | 违反后果 |
|---|---|---|
| 视频帧数 | `17k+5` 网格，夹到 **[124, 362]** | 退化成噪声或时长错误 |
| 视频时长 | 5–15 s（≈5.17–15.08 s），> 14 s 只告警 | 超出即截断 |
| 视频分辨率 | 宽高 **32 倍数**；面积 0.2–0.98 MP | RuntimeError |
| CFG | **1.0**，采样器无 negative 分支 | 写负面提示词会反噬 |
| 视频步数 | DMAD 学生**只能 4 或 8**（`strictSteps`） | 分布外采样 |
| 音频 VAE | **必须 fp32** | 静音（不报错） |
| H3-Image 步数 | 训练态 **6**；配置 4–12 仅排障，**局部重绘恒用 6** | 出图塌陷 / 重绘抹平 |
| H3-Image 尺寸 | 32 倍数，边长 ≥ 256；`imageMaxMP` 4.3 | 报错 / OOM |
| 图像参考图 | ≤ **16**（第 1 张 = 被编辑原图） | `IMAGE_TOO_MANY_REFS` |
| 图像/重绘提示词 | ≤ **4096 字符**，超长 400（**不静默截断**） | 报错 |
| 视频参考图 | ≤ **9**（首尾帧占槽，见 prompt skill §5.1） | 超出被丢 + warning |
| 参考视频/音频 | 各 ≤ 3 段，每段 2–15 s；**合计 ≤ 14.8 s**（超出按「视频优先」自动裁 + warning） | 静默截断 |
| 参考文件总数 | ≤ 12 | warning |
| 重绘 mask / full 模式 | mask 与源图同尺寸；full 源图必须 32 对齐 | 400 `MASK_SIZE_MISMATCH` / `SOURCE_NOT_ALIGNED` |
| 重绘 denoise | 恒 **1.0**，强弱用 `strength`（切点 0/1/2/3） | 改 denoise 会把选区抹平 |
| **音轨必须接线** | `SamplerCustomAdvanced → VAEDecodeAudio(audio_vae) → CreateVideo.audio` | 产物静音（静默丢失） |
| **AUTOGROW 用点号路径** | `ref_images.ref_image_1` / `ref_videos.ref_video_1` | 被 ComfyUI **静默忽略** |
| **Ref2VA 没有 first_frame 口** | 首尾帧必须走 `MiniMaxH3AddGuide` | 静默丢弃 |
| **镜头卡坐标系** | (x, y=高度, z=深度)；Blender 是 Z-up | 人偶躺平 / 整图全黑 |

### 9.1 音轨丢失（最隐蔽的坑）

H3 是**音画同步模型**：采样器的 LATENT 是 AV latent，只接视频 `VAEDecode` 会把音轨整个丢掉，**且不报错**。

```json
"15": { "class_type": "VAELoader",      "inputs": { "vae_name": "minimax_h3_audio_vae_fp32.safetensors" } },
"16": { "class_type": "VAEDecodeAudio", "inputs": { "samples": ["11",0], "vae": ["15",0] } },
"13": { "class_type": "CreateVideo",    "inputs": { "images": ["12",0], "audio": ["16",0], "fps": 24 } }
```

验收（不要只看文件存在）：

```powershell
ffprobe -v error -print_format json -show_streams out.mp4     # 必须有 video + audio 两条流
ffmpeg -i out.mp4 -af volumedetect -f null -                  # mean_volume 不能是 -inf
```

### 9.2 参考视频要拆成帧序列

`ref_videos` 要的是 **IMAGE（帧序列）**，不是 VIDEO：

```
LoadVideo(file) → GetVideoComponents ─┬─ 0=IMAGE → ref_videos.ref_video_K
                                       └─ 1=AUDIO → ref_video_audios.ref_video_audio_K
```

视频与其音轨**必须同号**（按编号配对，不按数组顺序）。没有音轨的视频**不要**接 `ref_video_audios`。

### 9.3 两套编号不要混

- `<Picture N>` / `图片1..9` 的**唯一权威**是 `ref-images.js` 的 `planImageSlots`
  （首尾帧占槽；`images` 是**按槽位定位的稀疏数组**，`pictureIndexMap` 是下标 → 槽位号）
- `<Video K>` / `<Audio J>` 的权威是 `render-plan.js`（视频自带音轨**先占** `<Audio>` 号）

任何一处自己重写排序或编号，就会出现「预览是角色卡、实际提交是道具」这类无声错位。

### 9.4 分段串联：必须 Ref2VA + AddGuide

I2VA / FL2VA **没有 `ref_images` 输入口**，用了就没法挂角色卡 → 两张脸会飘。
Ref2VA 是基础（支持参考图 + 参考视频）；**Ref2VA + `MiniMaxH3AddGuide`** 是推荐（参考图锁身份，
AddGuide 在 `frame_idx=0` 锚首帧，两者共存）。节点 ID 由 `h3-graph.js` 的 `NodeGraph`
**统一分配 + `pruneUnreachable()` 兜底**（`GUIDE_IMG=70..79` / `GUIDE=80..99` 只是可读性分段），
不要再手写「AddGuide 必须 ≥80」式的约定 —— 那个约定已因编号冲突出过两次事故。

## 10. 许可证

**H3-Image 的许可与 H3 视频不同**：年收入 ≤ 100 万美元且不对外提供托管服务可直接使用，
否则需向 MiniMax 单独申请（https://platform.minimax.io/license）。个人与内部团队使用不受限制。

Blender 见 §5。`vendor/nanfeng` 与 `vendor/inpaint-nodes` 各自保留原 LICENSE
（inpaint 源自 KJNodes，GPL-3.0）。它们是**独立进程加载的独立节点包**，与插件 ESM 代码之间只有 HTTP。