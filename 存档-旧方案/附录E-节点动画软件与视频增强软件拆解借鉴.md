# 附录 E：节点动画软件 / 视频增强软件拆解借鉴清单

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《工程规划 v2.1》《研究资料/10-节点动画软件与视频增强软件拆解借鉴.md》。
> 依据：用户拆解 `F:\AI视频\功能拆解\节点动画软件\拆解\`（节点动画软件 2.8.0）与 `视频增强软件\拆解\`（视频增强软件 1.7.2）；标注【观察】/【推断】/【未知】。
> **边界**：两者均为闭源商业软件。只参考 schema/字段/交互/工程方法，**不拷贝** QML/JS/节点定义/预设原文/模型/加密容器，不绕 `.tz` 加密或 RLM/OAuth；自用插件合规，公开分发需全部重写。

## E1. 结论

| 项 | 结论 |
|---|---|
| **视频增强软件模型目录** | 89 模型 + 14 预设 + 1 条推荐规则的 **metadata schema** 最值钱；可直接转成我们的 `post-models.json`/`presets.json` |
| **视频增强软件权重** | ❌ 不可复用：加密 `.tz` + `<视频增强软件权重域名>` + RLM/OAuth；12GB 用 SeedVR2-3B int8/Real-ESRGAN/RIFE |
| **视频增强软件工程方法** | ✅ 多后端工厂+CPU 兜底、tile 候选+重叠融合、`baseGB+pixelsPerGB` 显存估算、vaip 处理图 DAG、55 编码器矩阵 |
| **节点动画软件节点** | ✅ 声明式节点定义（491 节点/3296 属性/triggers/UI 元数据）可借鉴；只做 10—20 个"片头/信息图"节点子集 |
| **节点动画软件引擎** | ❌ 不自研 V8+Skia+FFmpeg 引擎；动效用 Remotion/Blender/FFmpeg |
| **节点动画软件 MCP** | ✅ 17 工具模式（preamble/search/get/preflight/snapshot/cleanup）可移植为动效页/后处理页 Agent 协议 |
| **12GB** | 后处理与 H3 必须串行；SeedVR2-3B int8 约 8GB、Real-ESRGAN/RIFE 轻量；SeedVR2-7B/FlashVSR 不建议；4K 走云 |

## E2. 视频增强软件 → 后处理页

### E2.1 模型选择器数据源（建议字段）

```json
{
  "id": "seedvr2-3b-int8",
  "family": "seedvr2",
  "displayName": "SeedVR2 3B int8",
  "task": "enhance|upscale|restore|interp|denoise|stabilize|autoshot|hdr",
  "backends": ["cuda", "tensorrt", "cpu"],
  "precision": ["int8", "fp16"],
  "scales": [1, 2, 4],
  "blocks": [[288,288],[480,384],[672,576]],
  "blockOverlap": 8,
  "vram": {"baseGB": 2.0, "pixelsPerGB": 0.8},
  "deps": [],
  "processors": ["sr", "restore"],
  "preflight": 1,
  "keepColor": true,
  "recommend": {"maxHeight": 1440},
  "presets": ["default", "soft", "sharp"]
}
```

- 来源：视频增强软件 `model-catalog.json`/`presets-catalog.json`/`model-recommendation-rules.json` 的**结构**；值全部替换为开源模型实测值。
- 预设分节参考：stabilize/motionblur/slowmo/enhance/grain/output/hdr/secondEnhance；每项 `editable=false` 的一键预设 + 可编辑高级参数。
- 推荐规则参考（阈值）：≤480→轻量；481—720→中；721—1080→高质量；>1080→修复+降噪。用我们的素材校准。

### E2.2 12GB 开源替代映射

| 视频增强软件能力 | 开源替代 | 12GB 可行性 |
|---|---|---|
| 超分/增强 50 模型 | SeedVR2-3B int8（约 8GB，block swap）；Real-ESRGAN（快/轻） | ✅ 1440p 级；7B 不建议 |
| 降噪/去块/去模糊 | SeedVR2 restore + Real-ESRGAN | ✅ |
| 补帧/慢动作 14 | RIFE / FILM（ComfyUI 内置节点） | ✅ <2GB |
| 稳定 cpe/ref | FFmpeg `deshake`/`vidstab` | ⚠️ 基础可用 |
| HDR Hyperion | FFmpeg `zscale` 仅转换，无生成式 HDR | ⚠️ 不做生成式 |
| Starlight 生成式 6 | 无开源对等；SeedVR2 修复替代 | ❌ 不追 |
| AutoShot | PySceneDetect | ✅ |
| 55 编码器 | FFmpeg 自建清单：h264/hevc/av1/prores/dnxhr/ffv1/图像序列 | ✅ 数值实测重写 |

### E2.3 工程方法借鉴

- **多后端工厂**：统一 `backend=cuda/trt/cpu`，失败自动降级；暴露 ETA。
- **tile planner**：按 `baseGB + pixelsPerGB` 估算显存选块；块间重叠 8px + Gaussian/Linear 融合；接缝是主要风险，需 A/B 集。
- **处理图 DAG**：`pipeline.json`：decode→sr→interp→denoise→color→encode；每步可缓存/断点续跑；命名输出。
- **双执行路径**：ComfyUI HTTP 主链 + FFmpeg CLI 批处理/兜底；两边都要 ETA。
- **编码器矩阵**：`encoder-catalog.json` 声明容器/像素格式/位深/alpha/分辨率上限/码率模板/GPU 门槛；按硬件过滤。
- **预览/代理**：低码率代理 + A/B 分屏 + 入出点 trim；色彩先 sRGB/Rec.709，HDR 后置。

### E2.4 后处理页功能（P1/P2/P3）

| 优先级 | 功能 |
|---|---|
| P1 | 一键预设（清晰/修复/补帧/去噪）；目标分辨率+FPS；模型选择器（自动推荐+手动覆盖）；显存/tile 提示；任务队列/重试；A/B 分屏；编码器选择 |
| P2 | 分镜批量；QC（SSIM/LPIPS/PySceneDetect/口型）；响度/混音；字幕烧录；预览代理 |
| P3 | SR→补帧→色彩多级串联；LUT/OCIO；多卡/云 API 分流 |

## E3. 节点动画软件 → 动效/信息图页

### E3.1 可借鉴

- **声明式节点**：`nodeType/superType/attributes/triggers/ui`；参数面板由 schema 自动生成；只做 10—20 个节点：文字、形状、分布、渐变、数据、关键帧、Lottie 导出。
- **JS API 分层**：`scene.*`（场景/镜头）、`design.*`（动效元素）、`export.*`（导出）；不复制 408 API 原文，只借分层。
- **MCP 工具模式**：`read_preamble` 门闩 → `search_docs/search_api/get_*` → `preflight_script/shader` → `execute` → `snapshot_layer` → `cleanup_workspace`；直接移植为动效页 Agent 协议（改工具名）。
- **信息图**：bar/pie/line 三模板；CSV 列映射 + 自动配色；参考 `barChart` 9 属性/`pieChart` 11 属性，不复制节点定义原文。
- **导出**：Lottie/MP4/PNG 序列；转场用 FFmpeg `xfade`；不追求 Skia 引擎。

### E3.2 不做

- 491 节点全量、C++ 插件 ABI、V8+Skia 引擎、Canva OAuth/AI Studio、加密 `.jsc/.skslc`；
- 图表 C++ vfunc（本就【未知】）。

### E3.3 动效页功能

| 优先级 | 功能 |
|---|---|
| P1 | 片头/标题/字幕条模板 + Lottie/MP4 导出；文字动画预设；与镜头时间线叠加 |
| P2 | CSV→柱/饼/折线信息图三模板；转场模板；品牌色/字体包 |
| P3 | 10—20 节点程序化动效子集；表达式/数据绑定 |

## E4. 可直接参考 vs 不可拷贝

| 文件 | 可参考 | 边界 |
|---|---|---|
| 视频增强软件 `model-catalog.json`/`presets-catalog.json`/`configs.json` | 字段名/结构/推荐规则阈值 | 模型名/参数值/预设内容不随产品分发 |
| 视频增强软件 `qml-extracted/`（840 文件） | 页面结构/组件命名/交互（主窗/滤镜/导出/预览/对比） | 禁止拷贝 QML/JS |
| 视频增强软件 `ai-runtime/` | 多后端/处理链设计 | 仅参考 |
| 节点动画软件 `node-catalog.json`/`script-api-reference.json`/`stats.json` | 节点 schema/API 分层/文档索引 | 节点定义/文档有版权，不可复制 |
| 节点动画软件 `mcp-hints-summary.md`/MCPHints | Agent 工具协议/提示组织 | 借鉴设计，不复制原文 |
| 节点动画软件 `qml-features.md`/`ui-module-map.md` | 功能面/面板清单 | 参考功能，不抄 UI |

## E5. 未解/风险

1. 视频增强软件后端精确优先级、tiling 选择算法、`preflight/postflight` 语义、`.tz` 结构均为【未知】，不能当规范直接实现。
2. 推荐规则仅 1 条按目标高度；需用我们的素材校准。
3. 节点动画软件 Chart vfunc、MCP 完整 JSON Schema、`.cvx` 加密均为【未知】；节点 schema 需锚定 2.8.0。
4. 12GB 下 SR+补帧+音频模型串行耗时/温度待实测；建议建 10 镜头 A/B 集对标视频增强软件/开源。
5. 许可：两者 EULA 通常禁止逆向/再分发；只参考后重写，不拷贝原文、不绕许可、不复用商标/工具名。

---
