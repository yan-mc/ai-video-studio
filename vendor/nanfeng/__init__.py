"""九章工作室 · 南风 H3 V15 生成节点（vendored + 改造）

==========================================================================
这是什么
==========================================================================

从「南风 V15 干净迁移包」vendor 并以语义等价方式改造的 ComfyUI 节点包。

**只保留生成能力**。原始南风包里的以下模块已被移除（见 docs/VENDOR.md）：

  · storyboard_api.py       智能分镜（原实现调外部 LLM HTTP API）
  · audio_drive_api.py      智能音频驱动（同上）
  · audio_media_api.py      音频波形/文件 REST 路由
  · model_refresh_api.py    模型列表刷新 REST 路由
  · continuation_scheduler.py  进程内批次调度器
  · web/                    5438 行前端（由九章 SPA 取代）

为什么移除：九章的架构是「DSH 插件 + 独立浏览器 SPA」。这些模块是南风
为了在自己的 ComfyUI 前端里工作而写的服务端配套，与我们的架构重复且冲突。
智能分镜改由 DSH 内部 LLM 实现（见 host/services/nanfeng/storyboard.js）。

==========================================================================
保留的部分
==========================================================================

  h3_generator.py          生成主节点（217 参数）—— 已删 38 处版本判断
  nodes.py                 提示词节点
  latent_continuation.py   续写 latent 落盘（ComfyUI 侧约定不变）
  continuation_audio_refine.py  续写音频精修
  native_audio_lock.py     锁音频
  nanfeng_sampler.py       ER-SDE 采样器
  retired_mode_guard.py    退役字段守卫
  trt_options.py           TRT 选项
  dlss_output.py           DLSS 输出（无插件时自动降级）
  *-skill/                 8 个提示词技能书（供 DSH 侧读取）
"""

from .h3_generator import NODE_CLASS_MAPPINGS
from .h3_generator import NODE_DISPLAY_NAME_MAPPINGS

# 注意：不导入已移除的 API 模块。
# WEB_DIRECTORY 也不设置 —— 我们用九章自己的 SPA。

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
