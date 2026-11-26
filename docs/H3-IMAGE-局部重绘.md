# H3-Image 局部重绘（Inpaint）—— 实现、参数与实测

> 真机环境：RTX 4080 Laptop 12GB / ComfyUI 0.45.0 / 端口 8488
> 模型：`minimax_h3_image_pruned_w4a8` + VAE fp16 + Qwen3-VL 32B int8
> 本文件记录**参数语义**与**实测数据**，改代码前先读这里。

---

## 一、两条链路的结构差异

普通出图与局部重绘的节点图**结构不同**，不能合并：

```
普通出图   MiniMaxH3ImageConditioning[1] → 零 latent → SamplerCustomAdvanced
局部重绘   VAEEncode(裁剪图) → SetLatentNoiseMask → SamplerCustomAdvanced
```

重绘必须用**源图编码出的真实 latent** 替换零 latent，再挂 noise_mask 指明
"哪块重绘、哪块保留"。这也是为什么 `inpaint-graph.js` 独立于 `h3-image.js`。

---

## 二、三个硬约束（违反会静默出错，不是报错）

### ① denoise 固定 1.0，步数固定 6

`BasicScheduler` 在 `denoise < 1` 时算 `total_steps = int(6 / denoise)`，
再取 sigmas 末尾若干点。而 H3-Image 只有 **6 个 PDD 预测头、对应 7 点 sigma 网格**：

| denoise | total_steps | 实际工作的头 |
|---|---|---|
| 1.0 | 6 | 全部 6 个 |
| 0.5 | 12 | 只剩 3 个（跳过 3,4,5）|

denoise=0.5 的**表现不是"改得更少"，而是"区域被抹平、不按提示词生成"**——
模型失去了重建能力。所以：

- **改动强弱由 `splitAt`（SplitSigmas 切片）控制，不是 denoise。**
- `denoise` 与 `steps` 都不对用户暴露，也没有任何配置项能覆盖。

### ② mask 必须与源图完全同尺寸

ComfyUI 的 `reshape_mask` 会 bilinear 缩到 latent 尺寸。若 mask 与源图尺寸不同，
它会**先把 mask 拉伸到源图尺寸再缩**——重绘区域整体偏移，且**不报任何错**。
所以 `prepareInpaint` 在读不到同尺寸时直接 400 `MASK_SIZE_MISMATCH`。

### ③ 喂给 VAE 的画布必须 32 对齐

latent 是 16 倍下采样再叠 `patch_size=(1,2,2)` 的 2 倍 = **32**。
非 32 倍数会被 `pad_to_patch_size` 静默补边，边界 32px 内结果不可靠。

- **crop 模式**：裁剪块会被整块缩放成 32 对齐的采样画布，天然安全。
- **full 模式**：源图画布直接进 VAE。1000×1000 会被 `vae_encode_crop_pixels`
  居中裁成 992×992，而 mask 仍是 1000 → 区域偏移最多 15px、产物比源图小。
  → 默认**拒绝**并给 400 `SOURCE_NOT_ALIGNED`；显式 `fullCanvasTrim:true` 才放行，
  但仍写入 warning 说明裁掉了几像素。

---

## 三、参数语义

### 强度档（`strength`）—— 用 SplitSigmas 切点

sigmas 原始 7 点：`[1.0, 0.9675, 0.8875, 0.75, 0.5328, 0.2320, 0.0]`
`SplitSigmas(step=k)` 取 `sigmas[k:]`：

| id | splitAt | 跑的步数 | 实测 mask 内差异 |
|---|---|---|---|
| `full` | 0 | 6 | 121.2 |
| `strong` | 1 | 5 | 86.0 |
| `medium` | 2 | 4 | 50.4 |
| `light` | 3 | 3 | 28.1 |

单调递减。k=4/5（2 步 / 1 步）也能跑，但改动过小，暂不暴露。

### 分辨率（`crop.resolutionId`）

| id | 含义 |
|---|---|
| `auto`（默认） | 按**含 padding 的实际裁剪块长边 × 1.5** 取，保证缩放比 ≈ 1.5 |
| `512` / `768` / `1024` / `1280` | 手动指定采样画布长边 |

> ⚠️ `auto` 必须按**裁剪块**算，不能只看 bbox。padding 会撑大裁剪块，
> 若 base_res 只跟 bbox 走，块越大缩放比越小，同样的选区被稀释得越厉害。
> 实测 33×33 选区：padding=0 → 选区占画布 12.9%；padding=256 → 只剩 4.3%。

### padding / minCrop / maxCrop

| 参数 | 默认 | 作用 | 耦合 |
|---|---|---|---|
| `padding` | 64 | bbox 外扩，给模型上下文 | 撑大裁剪块 → 影响 auto 分辨率 |
| `minCrop` | 256 | 裁剪块下限（只放大不缩小） | 小选区会被顶到 256 |
| `maxCrop` | 1024 | **采样分辨率**上限，不是裁剪范围 | 块更大时整块等比缩小，**绝不裁掉涂区** |

**`maxCrop` 只封顶采样分辨率，不决定覆盖范围**——这是最容易改错的一条。
早先的实现把它当"裁剪窗口上限"，超出部分只平移不缩小，导致选区外的涂区
**永远不被重绘且不报错**。

### 羽化：blur 按分辨率缩放 + 按笔画宽度封顶

`GrowMask` 的 expand 固定 **16**（1 个 latent 格 = 16px，不随分辨率缩放；
缩放会让 448² 档只剩 7px，不足一格）。

`ImageBlur` 的 radius/sigma 有两道约束：

1. **按采样分辨率缩放**（基准 1024²: radius=31 / sigma=10）——
   固定值在小画布上羽化带相对过宽，贴边选区会出现矩形过渡带。
2. **按笔画宽度封顶，cap = 笔画宽度 / 2** —— 固定半径对细线是灾难。

实测（613×213 折线笔画、14869 px、画布 928×352）：

| 半径 | mask 峰值 | 平均强度 | 核心(>0.9)像素 | 出图效果 |
|---|---|---|---|---|
| 28（仅按分辨率）| 0.937 | 0.372 | 544 | 几乎不可见（选区内外差 2/255）|
| 17（按笔画封顶）| 0.996 | 0.492 | 20257 | 笔画清晰可见 |

核心像素多 **37 倍**。原因：半径 ≥ 笔画宽度时，线条中心也到不了满强度，
整条线被降成半透明。

### 贴回：用"原始选区 + 对称软边"，不能用采样用的羽化 mask

采样 mask 是「GrowMask(+16) → 羽化」的，比用户选区大一圈。
**拿它当贴回权重会把生成内容渗到选区外**：

| 贴回权重 | 选区外污染像素（2048² 图）| 视觉 |
|---|---|---|
| 采样 mask（外扩+羽化）| 58,335 | 一圈矩形硬边 |
| 原始选区（硬边）| — | 硬切边 |
| **原始选区 + 对称软边**（radius/2）| **2,018** | 自然过渡 |

最终节点图：

```
crop:  70(crop) → 76(MaskToImage 原始选区) → 77(ImageBlur r/2) → 78(ImageToMask)
       80(Uncrop: dest=20原图, source=10重绘, mask=78, bbox=70[2]) → 11(Save)
full:  50(ImageToMask) → 81(MaskToImage) → 82(ImageBlur r/2) → 83(ImageToMask)
       84(ImageCompositeMasked: dest=20, source=10, mask=83) → 11(Save)
```

> ⚠️ `ImageCompositeMasked` 的 `resize_source` 默认会把 source 缩放到 destination，
> 在 crop 链路里会把 576² 的裁剪结果拉到 2048² 再贴——**位置全错**。
> 所以 crop 链路必须用 `JZImageUncropByMask`（带 bbox），不能用它。

---

## 四、两种模式

| | `full` | `crop`（推荐） |
|---|---|---|
| 画布 | 源图整幅 | 裁剪块缩放到 base_res |
| 选区外保真 | 靠合成权重（实测 >2 灰阶占 0.108%）| 逐像素（裁剪块外完全不动）|
| 源图尺寸限制 | 必须 32 对齐 | 无 |
| 大选区 | 可用 | 整块等比缩小（细节损失） |
| 小选区 | 品质差（选区占比太小）| 小选区被放大，细节更好 |

**经验：替换画面里的物体用 crop；整体重绘风格用 full。**

---

## 五、实测结论（2048² 真实生成图）

源图由插件自身文生图产出（`sq-2048`，夜景街道）：

| 用例 | 选区 | baseRes | 耗时 | 选区外污染 |
|---|---|---|---|---|
| 挂红灯笼 | 141×141 | 576 | 57s | 0.054% |
| 粉色霓虹招牌 | 161×701 | 1024 | 70s | 0.341% |
| full 模式灯笼 | 141×141 | — | 76s | 0.108% |

单次重绘 57–76 秒（6 步 @ 4080 Laptop）。

### 已知限制

| 现象 | 原因 | 缓解 |
|---|---|---|
| 极小选区（<40px）改动微弱 | 选区占采样像素太少 | 稍微涂大一点，或用手动 1280 档 |
| 大选区（>1024px）细节损失 | 整块被缩小 | 拆成多次重绘 |
| 细线选区需封顶羽化 | 高斯半径 ≥ 线宽会整条糊掉 | 已自动处理，无需手动调 |
| 贴回边界仍是软的 | 对称软边 | 属预期，不是缺陷 |

---

## 六、调试方法

```powershell
# 只看 mask 子图（不跑采样），量最终 noise mask 强度
# 把 70/72/73/74 接成 MaskToImage → SaveImage 提交即可
```

`runH3Inpaint` 的 `meta` 回的是**实际生效值**：
`{ mode, strength, splitAt, denoise, steps, seed, loraStack, crop, grow, blur, feather }`
其中 `feather` 会标明是否被笔画宽度封顶（`capBy: 'strokeWidth'`）。