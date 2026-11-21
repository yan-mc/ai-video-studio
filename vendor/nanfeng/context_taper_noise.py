"""续写上下文锥形加噪 —— 换人链路的抗身份漂移节点。

==========================================================================
它解决什么
==========================================================================

潜空间续写把上一段的 AV latent 钉成目标片段开头的关键帧条件
（`ComfyUI-H3-Motion-Context/nodes.py`，`ANCHOR_MODE = "head"`）：

    keyframes.append({"resolved_frame_index": p, "latent": blk})

这些关键帧携带的不只是动作，还有**上一段实际生成出来的外观**。
对「生成连续新镜头」这是优点；对**换人**是缺点 —— 要的恰恰是脸必须变。

实测现象（30s / 6 段 / context=56）：

    段#1 祥子 ✓   段#2 段中漂成金发 ✗   段#3 ✓   段#4 ✓
    段#5 段中漂成金发 ✗   段#6 ✓
    且第 0 帧必定是上一段末帧（直接拷贝），**第 5 帧（0.2s）就翻车**

根因不是提示词写得不够重 —— 关键帧是张量级硬条件，参考图只是
text-encoder 侧软约束。靠文字压不过张量。

==========================================================================
对策：损坏外观，保留运动
==========================================================================

既不传"干净上下文"（会原样拷贝上一段的外观），也不传"零上下文"
（段间硬跳变），而是传**外观被损坏、但运动仍然可读**的上下文：
模型无法照抄上一段的长相，只能从身份参考重新合成。

注入强度用**锥形**：窗口内保持平坦的 alpha，最后几步线性降到 alpha_end。
锥形是必要的 —— 平坦 0.45 会在接缝处留残影，平坦 0.20 又丢掉锐度收益。

    22 / 0.45 / 0.10 / 3  →  末三档 alpha = 0.333 / 0.217 / 0.100

==========================================================================
来源与归属
==========================================================================

配方来自 MacroSony/minimax-h3-chained-character-swap 的
`scripts/inject_tail_taper.py`（MIT），本文件是它在南风节点图内的实现，
免去 mp4 往返。时序常数（FRAME_PER_TOKEN / VIDEO_RUN_GRID）与
NikoDemon80/ComfyUI-H3-Motion-Context 保持一致，保证损坏的正是
Motion Context 即将钉住的那几个 latent step。

本节点只加 video 流，**audio 流原样透传** —— 换人线的音频上下文
本身没有价值（切段阶段已 `-an` 剥掉音轨），损坏它只会引入噪声。

==========================================================================
⚠️ 一次性
==========================================================================

加噪结果**只喂给 context_latent 一次**，绝不要把加噪后的 latent
再存回链条当作下一段的上下文 —— 否则损坏会沿链条累积。
"""

import torch

# H3 视频 VAE 的时序压缩：第 k 个 latent step 覆盖 FRAME_PER_TOKEN[k % 5] 个像素帧
FRAME_PER_TOKEN = (1, 4, 4, 4, 4)

# 只有这些帧数是整数个 latent step —— 也就是 Motion Context 提供的
# context_length 四档（5/22/39/56 → 2/7/12/17 步）
LATENT_SAFE_RUNS = (5, 22, 39, 56)


def steps_for_frames(n):
    """覆盖恰好 n 个像素帧所需的 latent step 数；不整除时返回 None。"""
    k, covered = 0, 0
    while covered < n:
        covered += FRAME_PER_TOKEN[k % 5]
        k += 1
    return k if covered == n else None


def alpha_at(position, total, alpha, alpha_end, ramp):
    """注入窗口内第 position 档（0 = 最旧）的 alpha。

    距接缝还有 >= ramp 步时保持平坦 alpha；最后 ramp 步线性降到 alpha_end。
    """
    if not 0 <= position < total:
        raise ValueError("position 必须落在注入窗口内")
    from_end = total - 1 - position
    if from_end >= ramp:
        return alpha
    return alpha + (alpha_end - alpha) * (ramp - from_end) / ramp


def validate_schedule(total, alpha, alpha_end, ramp):
    if total < 1:
        raise ValueError("注入窗口至少 1 步")
    if not 1 <= ramp <= total:
        raise ValueError("ramp_steps 必须在 1..%d 之间" % total)
    if not 0.0 <= alpha <= 1.0 or not 0.0 <= alpha_end <= 1.0:
        raise ValueError("alpha 与 alpha_end 必须落在 0..1")
    if alpha_end > alpha:
        raise ValueError("alpha_end 不得大于 alpha（否则就不是锥形了）")


class NanFengH3ContextTaperNoiseV15:
    """给续写上下文 latent 的尾部注入锥形高斯噪声（video 流），audio 不动。"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "context_latent": ("LATENT", {
                    "tooltip": "上一段的 AV latent，直接接 H3 Motion Context Load Latent 的输出。"
                               "只接受 video+audio 嵌套对。",
                }),
                "tail_frames": ([str(v) for v in LATENT_SAFE_RUNS], {
                    "default": "22",
                    "tooltip": "要注入的像素帧数，会换算成 latent step。"
                               "只有 5/22/39/56 是整数步：2/7/12/17。"
                               "**必须与 H3 Motion Context 的 context_length 取同一个值**，"
                               "否则没被加噪的那部分仍然是干净的上一段外观。",
                }),
                "alpha": ("FLOAT", {
                    "default": 0.45, "min": 0.0, "max": 1.0, "step": 0.01,
                    "tooltip": "窗口内的平坦注入强度。0.45 是社区验证值。"
                               "调低 = 保留更多上一段外观（更容易漂）；"
                               "调高 = 更强地迫使模型回到身份参考（可能丢动作锐度）。",
                }),
                "alpha_end": ("FLOAT", {
                    "default": 0.10, "min": 0.0, "max": 1.0, "step": 0.01,
                    "tooltip": "最后一档（贴着接缝的那一步）的强度，必须 <= alpha。"
                               "这一步是「模型紧跟着往下演」的起点，"
                               "它越干净，上一段的外观就越容易被抄过去。",
                }),
                "ramp_steps": ("INT", {
                    "default": 2, "min": 1, "max": 64,
                    "tooltip": "末尾多少步从 alpha 降到 alpha_end。"
                               "一步约等于 4 个像素帧，2 步对应像素配方里的 3 帧斜坡。",
                }),
                "seed": ("INT", {
                    "default": 0, "min": 0, "max": 0xffffffffffffffff,
                    "tooltip": "噪声种子。整段共享一条随机流，固定种子可复现同一段结果。",
                }),
            },
            "optional": {
                "noise_scale": (["match_latent_std", "unit"], {
                    "default": "match_latent_std",
                    "tooltip": "match_latent_std 按被注入窗口自身的标准差缩放噪声，"
                               "这样 alpha 的含义与 latent 的量纲无关；"
                               "unit 用原始 N(0,1)。",
                }),
            },
        }

    RETURN_TYPES = ("LATENT", "STRING")
    RETURN_NAMES = ("context_latent", "alpha_schedule")
    FUNCTION = "inject"
    CATEGORY = "南风节点/内部"
    DESCRIPTION = ("给续写上下文注入锥形噪声：损坏上一段的外观、保留其运动，"
                   "迫使模型从身份参考重新合成。仅用于 context_latent，"
                   "不可接 VAE 解码。结果一次性使用。")

    def inject(self, context_latent, tail_frames, alpha, alpha_end, ramp_steps,
               seed, noise_scale="match_latent_std"):
        frames = int(tail_frames)
        steps = steps_for_frames(frames)
        if steps is None:
            raise ValueError(
                "tail_frames=%d 不是整数个 latent step，请用 %s 之一。"
                % (frames, "/".join(str(v) for v in LATENT_SAFE_RUNS)))

        if not isinstance(context_latent, dict) or "samples" not in context_latent:
            raise ValueError("context_latent 必须是 LATENT dict（含 samples）")
        samples = context_latent["samples"]

        # 三种容器形状都要能过：NestedTensor（采样器直出）、list/tuple
        # （Motion Context Load Latent 的返回）、以及普通张量（必须拒绝）
        if isinstance(samples, torch.Tensor):
            raise ValueError(
                "这是单流 latent，不是 H3 的 video+audio 嵌套对。"
                "请接 H3 Motion Context Load Latent 的输出。")
        if isinstance(samples, (list, tuple)):
            parts, container = list(samples), list
        elif hasattr(samples, "unbind"):
            parts, container = list(samples.unbind()), type(samples)
        else:
            raise ValueError("无法识别的 samples 容器：%r" % type(samples))

        video = parts[0]
        if not isinstance(video, torch.Tensor):
            raise ValueError("video 流不是张量：%r" % type(video))
        unbatched = video.ndim == 4
        if unbatched:
            video = video.unsqueeze(0)
        if video.ndim != 5:
            raise ValueError("期望 video latent [B,C,T,H,W]，实际 %s"
                             % (tuple(video.shape),))

        total = int(video.shape[2])
        if steps > total:
            raise ValueError("要注入最后 %d 步，但 context_latent 只有 %d 步。"
                             % (steps, total))
        start = total - steps
        if start % 5 != 0:
            # 与 Motion Context 同口径：尾巴必须从 cycle 位置 0 起，
            # 否则它写出的位置和实际内容对不上，接缝会错位
            raise ValueError(
                "最后 %d 步的起点在 cycle 位置 %d 而不是 0，"
                "Motion Context 会拒收这个窗口。请调整片段长度或 tail_frames。"
                % (steps, start % 5))

        ramp = min(int(ramp_steps), steps)
        validate_schedule(steps, float(alpha), float(alpha_end), ramp)

        out = video.clone()
        tail = out[:, :, start:]
        if noise_scale == "match_latent_std":
            scale = float(tail.detach().float().std().item())
            if scale == 0.0 or scale != scale:  # 0 或 NaN
                scale = 1.0
        else:
            scale = 1.0

        gen = torch.Generator(device="cpu").manual_seed(int(seed) & 0xffffffffffffffff)
        alphas = []
        for k in range(steps):
            amount = alpha_at(k, steps, float(alpha), float(alpha_end), ramp)
            alphas.append(amount)
            block = out[:, :, start + k]
            noise = torch.randn(tuple(block.shape), generator=gen,
                                dtype=torch.float32)
            noise = noise.mul_(scale).to(device=block.device, dtype=block.dtype)
            out[:, :, start + k] = block * (1.0 - amount) + noise * amount

        if unbatched:
            out = out[0]
        parts[0] = out

        result = dict(context_latent)
        if container is list:
            result["samples"] = list(parts)
        else:
            try:
                result["samples"] = container(parts)
            except Exception:
                result["samples"] = list(parts)

        return (result, _format_schedule(alphas, steps, frames, scale))


def _format_schedule(alphas, steps, frames, scale):
    """把 alpha 序列压成人读的几行（相同值折叠成区间）。"""
    lines = [
        "续写上下文锥形加噪",
        "  %d 个 latent step（%d 像素帧），audio 流未改动" % (steps, frames),
        "  噪声尺度=%s (sigma=%.4f)" % ("按窗口标准差", scale),
    ]
    i = 0
    while i < len(alphas):
        j = i
        while j + 1 < len(alphas) and abs(alphas[j + 1] - alphas[i]) < 1e-9:
            j += 1
        span = "step %d" % i if i == j else "step %d..%d" % (i, j)
        seam = "   <- 接缝" if j == len(alphas) - 1 else ""
        lines.append("  %-14s alpha=%.3f%s" % (span, alphas[i], seam))
        i = j + 1
    return "\n".join(lines)


NODE_CLASS_MAPPINGS = {
    "NanFengH3ContextTaperNoiseV15": NanFengH3ContextTaperNoiseV15,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NanFengH3ContextTaperNoiseV15": "南风H3 续写上下文锥形加噪",
}