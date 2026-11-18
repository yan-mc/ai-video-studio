# 续写与二采「冲突」的真实机制

> 2026-11-18 深挖结论。**这条禁令是正确的，不是过度保守。**

## 一句话结论

不是「续写」和「二采」这两个功能在概念上互斥，
而是**二采会改变本段末 latent 的分辨率**，而续写要求**相邻两段的 latent 分辨率完全相同**
（latent 无法缩放）。所以链一旦用了二采，下一段的一采画布就和上一段的末 latent 对不上。

## 完整证据链

### ① 续写读取上一段 latent，并**强制比对宽高**

`ComfyUI-H3-Motion-Context/nodes.py:412-426`：

```python
if context_latent is not None:
    src_video = _video_from_latent(context_latent)
    src_w = int(src_video.shape[4]) * 16
    src_h = int(src_video.shape[3]) * 16
    if src_w != width or src_h != height:
        # a latent cannot be resized. ...
        # a resolution change mid-chain is nearly always a mistake
        raise ValueError(
            "h3_motion_context: context_latent is %dx%d but this "
            "clip is %dx%d. A latent cannot be resized, so the "
            "previous clip has to be regenerated at this "
            "resolution, or the chain restarted here."
            % (src_w, src_h, width, height))
```

关键两句注释：
- **"a latent cannot be resized"** —— latent 不是图片，不能插值缩放
- **"a resolution change mid-chain is nearly always a mistake"** —— 中途换分辨率几乎总是错误

### ② 二采确实把采样画布放大了

`vendor/nanfeng/h3_generator.py:1892-1905`：

```python
if bool(kwargs.get("启用H3潜空间放大二采", False)):
    upscale_input = sampled.out(1)
    latent_upscaled = g.node(
        "NanFengH3LowPeakLatentUpscalerV15",
        latent=upscale_input,
        model_name=...,
        target_megapixels=float(kwargs.get("H3潜空间目标百万像素", 1.0)),   # ← 目标面积
        ...
    )
```

一采在 `百万像素`（例如 0.4MP）画布上采样，
放大到 `H3潜空间目标百万像素`（例如 1.2MP），二采在 1.2MP 上精修。

### ③ 保存给下一段的是**放大后**的 latent

`vendor/nanfeng/h3_generator.py:2048-2052`：

```python
committed = g.node(
    "NanFengV15CommitContinuation",
    latent=sampled.out(0),        # ← sampled 在二采分支里已被重赋值成 1885 行的结果
    images=trimmed.out(0), audio=trimmed.out(1),
    folder=continuation["folder"], clip_index=continuation["index"],
)
```

`sampled` 在 1885-1889 行被二采重新赋值，所以 commit 的是 **1.2MP 的 latent**。

### ④ 于是下一段必然失败

| 段 | 一采画布 | 末 latent 分辨率 |
|---|---|---|
| 段 N（开二采） | 0.4MP | **1.2MP**（放大后二采的结果） |
| 段 N+1（读上段 latent） | 0.4MP | — |

段 N+1 的 MotionContext：`src 1.2MP != current 0.4MP` → 抛 `ValueError`。

### ⑤ 上游在入口处提前拦截（避免浪费一次 GPU 排队）

`vendor/nanfeng/h3_generator.py:1322-1323`：

```python
if bool(kwargs.get("启用H3潜空间放大二采", False)):
    raise ValueError("V15 潜空间续写要求前后采样画布相同，请关闭潜空间放大二采；像素域RTX超分不受影响。")
```

插件侧同口径（`host/services/nanfeng/index.js:356-364` 的 `CONSTRAINT_RULES`），
好处是在提交 GPU 之前就报错。

## 那有没有「合法」的用法？

理论上只有一种：**让二采不改变尺寸** ——
即 `H3潜空间目标百万像素 == 百万像素`。但那样二采等于原地重采样，
没有放大收益，只剩额外开销。

**段 1 单独开、后面都不开** 也不行：段 1 末 latent 是放大后的尺寸，段 2 一采对不上。

## 想要「高清 + 连续」该怎么做

这 4 条按推荐度排序：

| # | 做法 | 效果 |
|---|---|---|
| 1 | **提高一采 `百万像素`**（如 0.4 → 0.6 / 0.8），不开二采 | 全片同尺寸，续写成立。本次「礼帽与角」就是用 0.6MP。代价：一采变慢、显存变高 |
| 2 | 先低分辨率续写出全片 → 再整片过一次**像素域**超分（RTX VSR / DLSS） | 二采是 latent 域，超分是像素域；**像素域不受这条禁令限制**（源码注释明说「像素域RTX超分不受影响」）|
| 3 | 每段独立生成（不开续写），后期靠剪辑接 | 可以二采到高分辨率，但段与段之间会有跳变 |
| 4 | 续写批次 + 提高 DMAD 步数（4 → 8） | 不加分辨率，只提画质。本次已用 8 步 |

## 常见误区

- ❌「续写和二采是两套互斥的采样流程」—— 不是。两者都是 `SamplerCustomAdvanced`，
  二采只是在它前面多插了一个 latent 放大器。
- ❌「把二采关掉就不能高清了」—— 能，提高一采 `百万像素` 即可。
- ❌「先二采再续写会更好」—— 会在第二段直接 ValueError，且已经浪费一次排队。
- ✅ 「RTX 视频超分」（`启用RTX视频超分`）是**像素域**的，与续写**不冲突**，可以叠。