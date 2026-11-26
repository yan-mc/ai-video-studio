"""
vendor/inpaint-nodes —— 局部重绘需要的两个 crop / stitch 节点。

这是 **ComfyUI 的自定义节点包**，不是插件代码：插件（Node ESM）从不 import 它，
只通过 HTTP 把图提交给 ComfyUI，由 ComfyUI 进程加载执行。

算法来自 KJNodes（kijai/ComfyUI-KJNodes，**GPL-3.0**）。只取这两个节点的原因：
KJNodes 有 24 个 .py / 约 1 MB 且 `GrowMaskWithBlur` 依赖 `kornia`、
`GrowMask` 依赖 `scipy`；而这里只需要「mask→bbox→裁剪缩放」和「按 bbox 贴回」。

**许可证**：本目录受 GPL-3.0 约束（见同目录 LICENSE-KJNodes.txt 与 VENDOR.md）。
这是独立进程加载的独立节点包，与插件的 ESM 代码没有链接关系，
插件其余部分不受此许可证影响。

与 KJNodes 原版的三处差异（详细记录在 VENDOR.md）：

1. **32 倍数对齐只加在 `tw/th`（喂给 VAE 的采样画布）上**。
   原版 `crop_by_mask` 只对齐到 16，而 H3-Image 的 latent 是 16 倍下采样
   再叠 patch_size=(1,2,2) 的 2 倍，实际要求 32；不对齐会让
   `pad_to_patch_size` 静默补边，边界 32 像素内不可靠。
   裁剪块本身**绝不能对齐/缩小** —— 那会切掉用户涂的一部分。

2. **bbox 输出固定 4 元组 xyxy `(x0, y0, x1, y1)`**，与 `ImageUncropByMask`
   的消费格式严格一致，不依赖 KJNodes 的 `BBOX_TYPES` 类型协商。

3. **空 mask 直接抛异常**。原版会退化成 0×0 裁剪，在下游报一个看不懂的错。

约束（改这个文件前必读）：
  · `_bbox_from_mask` 的返回值必须**完整覆盖 mask 的全部非零像素**。
    `max_crop_resolution` 只约束采样分辨率 `tw/th`，不允许裁掉或缩小 bbox ——
    被缩小的 bbox 会让那部分涂区**永远不被重绘且不报错**。
  · 采样画布 `tw/th` 必须是 32 的倍数。
"""

import math

import numpy as np
import torch
import torch.nn.functional as F
from comfy.utils import common_upscale
from nodes import MAX_RESOLUTION

# H3-Image: VAE 16× 下采样 × patch_size(1,2,2) 的 2 倍 = 32
CANVAS_ALIGN = 32


def _align_up(v: int, align: int = CANVAS_ALIGN) -> int:
    return int(math.ceil(max(int(v), 1) / align) * align)


class ImageCropByMaskAndResize:
    """从 mask 算 bbox，裁出该区域并缩放到目标分辨率；同时输出 bbox 供贴回。

    输出三联：`(images, masks, bbox)`
      images  裁剪并缩放后的图（宽高都是 32 倍数）
      masks   与 images 同尺寸的 mask
      bbox    `(x0, y0, x1, y1)` —— 喂给 `ImageUncropByMask` 贴回

    bbox 覆盖 mask 的全部非零像素；`max_crop_resolution` 只封顶采样分辨率，
    超出时整块等比缩小（细节损失），**绝不裁掉任何一部分涂区**。
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
                "base_resolution": ("INT", {
                    "default": 1024, "min": 256, "max": MAX_RESOLUTION, "step": 32,
                    "tooltip": "重绘时的目标分辨率（裁剪块的长边缩放目标）。"
                               "模型在 1024-2048 面积最稳。",
                }),
                "padding": ("INT", {
                    "default": 64, "min": 0, "max": MAX_RESOLUTION, "step": 8,
                    "tooltip": "bbox 外扩像素，给模型足够上下文。",
                }),
                "min_crop_resolution": ("INT", {
                    "default": 256, "min": 0, "max": MAX_RESOLUTION, "step": 32,
                    "tooltip": "bbox 的下限尺寸（只放大不缩小）。",
                }),
                "max_crop_resolution": ("INT", {
                    "default": 1024, "min": 0, "max": MAX_RESOLUTION, "step": 32,
                    "tooltip": "采样分辨率上限：裁剪块长边超过它就整块等比缩小。"
                               "只影响算力，不影响覆盖范围。",
                }),
            },
        }

    CATEGORY = "jiuzhang/inpaint"
    RETURN_TYPES = ("IMAGE", "MASK", "BBOX")
    RETURN_NAMES = ("image", "mask", "bbox")
    FUNCTION = "crop"

    # ------------------------------------------------------------------
    def _bbox_from_mask(self, mask2d: torch.Tensor, padding: int, min_res: int):
        """mask → 覆盖全部非零像素的 bbox `(x0, y0, w, h)`。

        **不变量：bbox 一定包含 mask 的每一个非零像素。**

        这个函数只做两件事：把 bbox 撑到 `min_res`（上下文下限）并外扩
        `padding`，两者都**只增不减**、且被画布边界夹紧。任何"缩小 bbox
        以适配某个上限"的写法都会让超出窗口的涂区**永远不被重绘且不报错** ——
        上限只属于采样分辨率（见 `crop()` 的 `tw/th`）。
        """
        h0, w0 = mask2d.shape
        idx = (mask2d > 0.5).nonzero(as_tuple=False)   # [N, 2] (y, x)

        if idx.numel() == 0:
            raise ValueError(
                "INPAINT_EMPTY_MASK: mask 全黑。至少涂抹一块区域再提交"
                "（不要依赖“全图重绘”，那个能力请走普通 /image/generate）。"
            )

        y_min, x_min = idx.min(dim=0).values.tolist()
        y_max, x_max = idx.max(dim=0).values.tolist()

        width = x_max - x_min + 1
        height = y_max - y_min + 1
        cx = (x_min + x_max) / 2.0
        cy = (y_min + y_max) / 2.0

        # 上下文下限：只放大不缩小
        if min_res:
            width = max(width, int(min_res))
            height = max(height, int(min_res))

        # 外扩，但**不允许扩出画布**
        pad_x = min(max(0, (w0 - width) // 2), int(padding))
        pad_y = min(max(0, (h0 - height) // 2), int(padding))
        width = min(width + 2 * pad_x, w0)
        height = min(height + 2 * pad_y, h0)

        # bbox **不对齐 32**：它参与的是 `common_upscale`，任意尺寸都支持；
        # 对齐（以及必须 32）的是下面的 tw/th。对齐会让 250 宽的图截到 224，
        # 边缘 12 像素被排除 —— 那是数据错误，不是精度问题。

        # 以 mask 中心为中心放置，并夹紧到画布内（**平移，不缩小**）
        x0 = int(max(0, min(round(cx - width / 2.0), w0 - width)))
        y0 = int(max(0, min(round(cy - height / 2.0), h0 - height)))

        return x0, y0, int(width), int(height)

    # ------------------------------------------------------------------
    def crop(self, image, mask, base_resolution, padding=64,
             min_crop_resolution=256, max_crop_resolution=1024):
        if image.dim() != 4:
            raise ValueError(f"image 应为 [B,H,W,C]，实际 {tuple(image.shape)}")
        if mask.dim() == 4:
            mask = mask[0]
        if mask.dim() == 2:
            mask = mask.unsqueeze(0)
        if mask.dim() == 3:
            mask = mask.reshape((-1, mask.shape[-2], mask.shape[-1]))

        H, W = image.shape[1], image.shape[2]

        # 采样分辨率的长边：请求值，受 max_crop_resolution 封顶（显存保护）。
        # 这只是**缩放比例**，与裁剪块尺寸无关 —— 块永远不会被裁小。
        sample_edge = int(base_resolution)
        if int(max_crop_resolution or 0) > 0:
            sample_edge = min(sample_edge, int(max_crop_resolution))
        sample_edge = max(CANVAS_ALIGN, sample_edge)

        images_out = []
        masks_out = []
        bboxes = []

        for i in range(image.shape[0]):
            m = mask[min(i, mask.shape[0] - 1)]
            x0, y0, w, h = self._bbox_from_mask(m, padding, min_crop_resolution)

            crop_img = image[i:i + 1, y0:y0 + h, x0:x0 + w, :]
            crop_mask = m[y0:y0 + h, x0:x0 + w].unsqueeze(0)

            # 目标分辨率：保持裁剪块宽高比，**长边 = sample_edge**，对齐 32。
            # 块比 sample_edge 大时整块等比缩小（细节损失），但**一像素都不裁掉**；
            # 块更小时等比放大以给模型更多像素。
            aspect = w / float(h)
            if aspect >= 1.0:
                tw = sample_edge
                th = max(CANVAS_ALIGN, int(round(sample_edge / aspect)))
            else:
                th = sample_edge
                tw = max(CANVAS_ALIGN, int(round(sample_edge * aspect)))
            tw = _align_up(tw)
            th = _align_up(th)

            if (tw, th) != (w, h):
                crop_img = common_upscale(
                    crop_img.movedim(-1, 1), tw, th, "bicubic", "disabled"
                ).movedim(1, -1)
                crop_mask = common_upscale(
                    crop_mask.unsqueeze(1), tw, th, "bilinear", "disabled"
                ).squeeze(1)

            images_out.append(crop_img)
            masks_out.append(crop_mask)
            bboxes.append((x0, y0, x0 + w, y0 + h))

        out_img = torch.cat(images_out, dim=0) if len(images_out) > 1 else images_out[0]
        out_mask = torch.cat(masks_out, dim=0) if len(masks_out) > 1 else masks_out[0]
        return (out_img, out_mask, bboxes)


class ImageUncropByMask:
    """把重绘结果按 bbox 贴回原图。

    `out = destination * (1 - mask) + source_resized * mask`

    **保真范围是「bbox 之外」**，不是「mask 之外」：mask 传入时已经过
    GrowMask + ImageBlur，高斯尾部在 bbox 内处处非零，所以 bbox 内、
    笔画之外的像素也会被轻微改写（实测最大差异 ~0.005）。
    bbox 之外完全没被触碰（差异 0.0000）。
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "destination": ("IMAGE",),
                "source": ("IMAGE",),
                "mask": ("MASK",),
                "bbox": ("BBOX",),
            },
        }

    CATEGORY = "jiuzhang/inpaint"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "uncrop"

    # ------------------------------------------------------------------
    def uncrop(self, destination, source, mask, bbox):
        if destination.dim() != 4:
            raise ValueError(f"destination 应为 [B,H,W,C]，实际 {tuple(destination.shape)}")

        # bbox 归一化：兼容 4 元组 / dict / 嵌套
        boxes = self._normalize_bbox(bbox)

        # 空 bbox 必须显式报错：下面的 `boxes[min(i, len(boxes)-1)]` 在空列表上
        # 会退化成 Python 负索引并静默取错区域。
        if not boxes:
            raise ValueError("INPAINT_BAD_BBOX: bbox 为空（裁剪节点没有产出 bbox？）")

        B, H, W, _ = destination.shape

        if mask.dim() == 4:
            mask = mask[0]
        if mask.dim() == 2:
            mask = mask.unsqueeze(0)
        if mask.dim() == 3:
            mask = mask.reshape((-1, mask.shape[-2], mask.shape[-1]))

        # mask 与 source 必须同尺寸：分别独立缩放到 bbox 尺寸会让"笔画面具"
        # 与"重绘内容"错位（改了但改错地方），且不报错 —— 所以宁可报错。
        src_h, src_w = source.shape[1], source.shape[2]
        msk_h, msk_w = mask.shape[-2], mask.shape[-1]
        if (src_h, src_w) != (msk_h, msk_w):
            raise ValueError(
                f"INPAINT_STITCH_SIZE: source {src_w}×{src_h} 与 mask {msk_w}×{msk_h} 尺寸不一致。"
                "两者必须同尺寸（同一个裁剪节点产出的），否则拼接会错位。"
            )

        out = []
        for i in range(source.shape[0]):
            a, b, c, d = boxes[min(i, len(boxes) - 1)]
            # 约定 **统一用 xyxy**（crop 节点就是这么输出的）
            x0, y0, x1, y1 = int(a), int(b), int(c), int(d)
            if x1 <= x0 or y1 <= y0:
                raise ValueError(f"INPAINT_BAD_BBOX: bbox={a,b,c,d} 退化（x1<=x0 或 y1<=y0）")

            bw, bh = x1 - x0, y1 - y0

            src = source[i:i + 1].movedim(-1, 1)
            src = common_upscale(src, bw, bh, "lanczos", "disabled").movedim(1, -1)

            m = mask[min(i, mask.shape[0] - 1)].unsqueeze(0).unsqueeze(0)
            m = common_upscale(m, bw, bh, "bilinear", "disabled").squeeze(0).squeeze(0)

            # pad 到整幅画布（越界部分自动裁掉）
            pad_l, pad_t = max(0, x0), max(0, y0)
            pad_r, pad_b = max(0, W - x1), max(0, H - y1)

            canvas_src = F.pad(
                src.movedim(-1, 1), (pad_l, pad_r, pad_t, pad_b), mode="constant", value=0.0
            ).movedim(1, -1)
            canvas_m = F.pad(m, (pad_l, pad_r, pad_t, pad_b), mode="constant", value=0.0)

            # 尺寸兜底（画布比 bbox 小时）
            canvas_src = canvas_src[:, :H, :W, :]
            canvas_m = canvas_m[:H, :W]
            if canvas_src.shape[1] != H or canvas_src.shape[2] != W:
                raise ValueError(
                    f"INPAINT_STITCH_SHAPE: 贴回尺寸不符 {tuple(canvas_src.shape)} vs {(B,H,W)}"
                )

            mm = canvas_m.unsqueeze(-1)
            out.append(destination[i] * (1.0 - mm) + canvas_src[0] * mm)

        return (torch.stack(out, dim=0),)

    # ------------------------------------------------------------------
    @staticmethod
    def _normalize_bbox(bbox):
        """把各种 bbox 形态统一成 `[(x0,y0,x1,y1), ...]`。"""
        if isinstance(bbox, dict):
            x, y = int(bbox["x"]), int(bbox["y"])
            return [(x, y, x + int(bbox["width"]), y + int(bbox["height"]))]

        if isinstance(bbox, (list, tuple)):
            if len(bbox) == 4 and all(isinstance(v, (int, float)) for v in bbox):
                a, b, c, d = (int(v) for v in bbox)
                # 单条 bbox：约定 xyxy（与 ImageCropByMaskAndResize 输出一致）
                return [(a, b, c, d)]
            # 嵌套
            return [ImageUncropByMask._normalize_bbox(x)[0] for x in bbox]

        raise ValueError(f"INPAINT_BAD_BBOX: 不支持的 bbox 类型 {type(bbox).__name__}")


NODE_CLASS_MAPPINGS = {
    "JZImageCropByMaskAndResize": ImageCropByMaskAndResize,
    "JZImageUncropByMask": ImageUncropByMask,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "JZImageCropByMaskAndResize": "Inpaint Crop (JZ)",
    "JZImageUncropByMask": "Inpaint Stitch (JZ)",
}
