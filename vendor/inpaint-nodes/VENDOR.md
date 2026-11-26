# vendor/inpaint-nodes —— 局部重绘的 crop / stitch 节点

## 一句话

这里是**局部重绘所需的两个 ComfyUI 自定义节点**：`JZImageCropByMaskAndResize`
（mask→bbox→裁剪缩放）与 `JZImageUncropByMask`（按 bbox 贴回）。
随插件分发，部署到 `<ComfyUI>/custom_nodes/jiuzhang_inpaint_nodes/` 后由 ComfyUI 加载。

---

## 为什么不用现成的 ComfyUI-KJNodes

这两个节点的算法源自 **KJNodes（kijai/ComfyUI-KJNodes）**，但只取了需要的部分：

| 理由 | 说明 |
|---|---|
| 体积 | KJNodes 有 24 个 `.py` / 约 1 MB，绝大多数与本插件无关 |
| 依赖 | 它的 `GrowMaskWithBlur` 依赖 `kornia`，`GrowMask` 依赖 `scipy`；我们不需要 |
| 可控 | 32 倍数对齐是 H3-Image 的硬要求，原版只对齐到 16，必须改 |
| 解耦 | 用户 clone 仓库即得完整节点，不用另外去 GitHub 装 KJNodes |

> **许可证**：源自 KJNodes（GPL-3.0），因此**本目录同样受 GPL-3.0 约束**，
> 见同目录 `LICENSE-KJNodes.txt`。这是独立进程加载的独立节点包，
> 与插件的 Node ESM 代码之间**只有 HTTP**、没有链接关系，
> 插件其余部分不受此许可证影响。

---

## 与 KJNodes 原版的差异（逐条）

### 1. 尺寸对齐：只在 `tw/th` 上，**不在 bbox 上**

H3-Image 的 latent 是 VAE **16 倍**下采样，再用 `patch_size=(1,2,2)` 的 **2 倍**打块，
保留出来的采样画布必须是 **32 的倍数**。原版 `crop_by_mask` 只对齐到 16：

```python
max_w = (max_w + 15) // 16 * 16     # ← 只对齐 16
```

本实现把 **32 对齐放在它该出现的地方：`tw/th`（喂给 VAE 的采样画布）**，
并把 `min/max_crop_resolution` 的 step 设成 32。

> **不要**把 32 对齐加到"裁剪块尺寸"（bbox）上：
> 源图宽 250（非 32 倍数）、mask 横跨全宽时，`width = min(_align_up(250), 250-(250%32))`
> 会算出 `min(256, 224) = 224` —— **整图 mask 只截到 224×224，边缘 12 像素被排除**。
> bbox 参与的是 `common_upscale`，任意尺寸都支持；一旦缩小就是切掉用户涂的一部分 ——
> 那是**数据错误**，不是精度问题。
>
> 验证：源图 250×250 + 全图 mask → bbox 是 `(0,0,250,250)`。

### 2. `max_crop_resolution` 只封顶**采样分辨率**，绝不裁掉涂区

这是本节点最重要的一条不变量：**bbox 必须覆盖 mask 的每一个非零像素**。

旧语义（错误）：`width = min(width, max_res)` —— 把"意图边界"当成"裁剪窗口上限"，
然后 `x0` 只平移不改尺寸。后果是**bbox 长边 2000px 的笔画在 maxCrop=1024 下
只有中间 1024px 被裁出来重绘**，剩下 976px 的涂区既不在 mask 里也不在贴回范围里，
像素保持原样、**无任何报错**。

现行语义（正确）：

```python
# bbox 只增不减：撑到 min_crop_resolution，外扩 padding，夹进画布
x0, y0, w, h = _bbox_from_mask(m, padding, min_crop_resolution)
# 采样长边 = base_resolution 被 max_crop_resolution 封顶，再对 32 对齐
sample_edge = min(base_resolution, max_crop_resolution)  # >= 32
# 块按长边等比缩放到 sample_edge（整块缩小，覆盖范围不变）
```

即：**块大 → 整块等比缩小（细节损失，覆盖完整）；块小 → 等比放大（更多像素）**。
"被缩小"属于 `tw/th` 的语义，与 bbox 无关 —— 两者混为一谈就是 P0-1 的根因。

插件侧（`host/services/inpaint-params.js` 的 `estimateCropBlock` / `sampleCanvasFor`）
用同一套算法算出预期块尺寸与实际采样画布，写进 meta 与 warning，
所以前端显示的是真值而不是基准常量。

### 3. bbox 类型收敛为 `(x0, y0, x1, y1)`

KJNodes 用 `BBOX_TYPES = "BBOX,BOUNDING_BOX"` 做类型协商，支持 4 元组、dict、嵌套列表。
这在独立包里容易因版本漂移而失配。本实现：

- `ImageCropByMaskAndResize` 输出 **`[(x0,y0,x1,y1), ...]`**（xyxy）
- `ImageUncropByMask` 消费时**只接受 xyxy / dict**，并在 `_normalize_bbox` 里显式说明

> ⚠️ **不能把 JZ 的 bbox 喂给 KJNodes 的 uncrop，反之亦然**
> （如果那边把 4 元组当 xywh 解释，会得到完全错误的区域）。
> 两者设计上不混用 —— 插件只用 JZ 这一套。

### 4. 空 mask / 空 bbox / 尺寸不一致都明确报错

静默降级的三种表现都是"改了但改错地方"，最难查：

| 情况 | 旧行为 | 现在 |
|---|---|---|
| mask 全黑 | 退化成 0×0 裁剪，下游报看不懂的错 | `INPAINT_EMPTY_MASK` |
| bbox 为空 | 负索引静默取错区域 | `INPAINT_BAD_BBOX` |
| mask 与 source 尺寸不同 | 各自缩到 bbox 尺寸 → 笔画面具与重绘内容错位 | `INPAINT_STITCH_SIZE` |

### 5. 去掉 `torchvision` / `kornia` / `scipy` 依赖

只依赖 `torch` / `numpy` / `comfy.utils.common_upscale` / `nodes.MAX_RESOLUTION`，
全部由 ComfyUI 自带。

---

## 节点说明

### `JZImageCropByMaskAndResize`

| 输入 | 说明 |
|---|---|
| `image` | 源图 `[B,H,W,C]` |
| `mask` | 涂抹的 mask（白色=重绘区域） |
| `base_resolution` | 采样分辨率的目标长边，默认 1024，step 32 |
| `padding` | bbox 外扩，默认 64 |
| `min_crop_resolution` | bbox 下限，默认 256（只放大不缩小） |
| `max_crop_resolution` | **采样分辨率**上限，默认 1024 |

| 输出 | 说明 |
|---|---|
| `image` | 裁剪并缩放后的图（宽高均为 32 倍数） |
| `mask` | 与 image 同尺寸的 mask |
| `bbox` | `[(x0,y0,x1,y1)]`，喂给 `JZImageUncropByMask` |

**行为**：

- mask → bbox（非零像素外接框，**覆盖全部非零像素**）
- 撑到 `min_crop_resolution`（只放大）
- 外扩 `padding`，但**不允许扩出画布**（`pad_x = min((w0-width)//2, padding)`）
- 以 mask 中心放置，**越界时平移而非缩小**
- 采样长边 = `min(base_resolution, max_crop_resolution)`，对 32 对齐
- 块按长边等比缩放到该长边（整块缩小/放大，不裁剪）

### `JZImageUncropByMask`

| 输入 | 说明 |
|---|---|
| `destination` | 原图 |
| `source` | 重绘结果（由 `VAEDecode` 出来的） |
| `mask` | 羽化后的 mask（**尺寸 = 采样块尺寸**，不是原图尺寸） |
| `bbox` | 来自 `JZImageCropByMaskAndResize` |

**行为**：`out = destination * (1 - mask) + resized_source * mask`

### 保真范围（实测口径，别读错）

真正的"逐像素等于原图"发生在 **bbox 之外**（差异 **0.0000**，>2 的像素 **0.00%**）。

**bbox 之内、笔画之外的区域也会被轻微改写**：贴回用的 mask 已经过
`GrowMask + ImageBlur`，高斯尾部在整个块内处处非零（实测最大差异 ≈ 0.005）。
这不是 bug，是软 mask 混合的必然结果；但把它说成"mask 外逐像素保真 0.0000"
会让你在验收时按错误标准判失败。

要做到"mask 外 0 改动"，需要把贴回用的 mask 换成未模糊的硬 mask（另开一路输入）。

---

## 部署

```powershell
# 在项目根目录
pwsh -File vendor/inpaint-nodes/deploy-vendor.ps1 -ComfyDir "F:\AI视频\ai-runtime\ComfyUI"

# 覆盖已有
pwsh -File vendor/inpaint-nodes/deploy-vendor.ps1 -ComfyDir "..." -Force -Clean
```

部署后**必须重启 ComfyUI**（只在启动时扫描 `custom_nodes`）。

验证：

```powershell
curl.exe -s http://127.0.0.1:8488/object_info/JZImageCropByMaskAndResize
curl.exe -s http://127.0.0.1:8488/object_info/JZImageUncropByMask
```

---

## 配套的羽化链路（用 ComfyUI 核心节点，不需要本包提供）

本包**只做裁剪与贴回**，羽化用核心节点组合：

```
JZImageCropByMaskAndResize[1] (mask)     ← 输入已是采样块分辨率
  → GrowMask(expand=16, tapered_corners=true)   ← 16 = 1 个 latent 格，**不随分辨率缩放**
  → MaskToImage
  → ImageBlur(blur_radius=31, sigma=10.0)       ← 按采样分辨率缩放（1024² 档 = 31/10）
  → ImageToMask(channel=red)
  → SetLatentNoiseMask 的 mask
  → 也作为 JZImageUncropByMask 的 mask
```

为什么 `grow` 不缩放、`blur` 要缩放：GrowMask 的输入已经是块分辨率，
**1 latent 格恒为 16 像素**，expand=16 就是"膨胀一格"；按 `res/1024` 缩放会让
448² 档只剩 7px（0.44 格），膨胀几乎失效、接缝漏白。而 blur 是像素空间的视觉宽度，
必须按画布缩放，否则低分辨率上羽化带相对过宽（448² 用 31px 占画布 6.9%）。

为什么不用 KJNodes 的 `GrowMaskWithBlur`：它依赖 `kornia`，
而核心的 `GrowMask + ImageBlur` 组合效果等价（已真机验证接缝不可见）。

---

## 真机验收记录（2026-11-25，1024² 档）

| 项 | 结果 |
|---|---|
| 节点注册 | ✅ 两个节点都被 ComfyUI 识别 |
| 裁剪产物尺寸 | ✅ 1024×1024（32 倍数）|
| **bbox 外**保真 | ✅ 差异 **0.0000**，>2 的像素 **0.00%** |
| **bbox 内、笔画外**差异 | ≈ 0.005（羽化尾部，见上「保真范围」）|
| bbox 内重绘 | ✅ 差异 78.84（确实重绘了）|
| 端到端耗时 | ✅ 76.5 秒（1024² / 6 步）|
| 依赖 KJNodes | ❌ **不需要**（纯核心 + 本包）|
| bbox 覆盖性（2000×300 选区 / maxCrop=1024）| ✅ bbox 仍为 2000×300，块整块缩到 1024 |

---

## 源码出处

| 文件 | 来源 | 修改 |
|---|---|---|
| `__init__.py` 的 `ImageCropByMaskAndResize` | KJNodes `nodes/image_nodes.py:4010` | 32 对齐挪到 tw/th、bbox 覆盖性、max_crop 语义、空 mask 报错、去依赖 |
| `__init__.py` 的 `ImageUncropByMask` | KJNodes `nodes/image_nodes.py:4198` | bbox 解析收敛、尺寸不符显式报错、去 `normalize_bboxes` 依赖 |
| 羽化（不在本包） | ComfyUI 核心 `GrowMask` / `ImageBlur` | — |

上游：https://github.com/kijai/ComfyUI-KJNodes （GPL-3.0）