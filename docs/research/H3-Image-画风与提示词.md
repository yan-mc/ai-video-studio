# H3-Image 画风控制与提示词规范调研

> 调研对象：MiniMax **H3-Image**（33.1B DiT，6 步 PDD 蒸馏，Qwen3-VL-32B 文本编码器，cfg=1 无 CFG）
> 调研时间：2026-11-26　调研方式：官方模型卡 / 官方 API 文档 / ComfyUI 官方文档与**模板 JSON 源码** / HuggingFace 权重库 / Civitai API / 多份独立实测
> 范围：只做技术调研，未修改任何代码。本文件是本仓库内**新增**的调研文档。

## 证据等级约定

| 等级 | 含义 | 本文标记 |
|---|---|---|
| 官方文档 | MiniMax / ComfyUI 官方发布的文档、模型卡、模板 | 【官方文档】 |
| 源码 | 官方仓库/权重库里的代码、模板 JSON、OpenAPI schema | 【源码】 |
| 实测 | 第三方用真实机器跑出的对比（有具体数量/耗时/参数） | 【实测】 |
| 社区经验 | Civitai / HF 讨论 / 论坛 / 个人博客的经验性陈述，无严格对照 | 【社区】 |
| 推断 | 由前几类证据逻辑推出，未直接验证 | 【推断】 |
| 未找到 | 检索后没有可靠来源 | 【未找到可靠来源】 |

关键区分：**"官方文档说的"**、**"官方权重/模板里写的"**、**"别人跑出来的"** 三者经常不一致，本文分别标注，不混写。

---

## 结论速览（先看这六条）

1. **画风没有任何独立参数**。模型（`MiniMaxH3ImageConditioning` 只有 clip / prompt / width / height / vae / images 六个输入）、官方 API（`/v1/images/generations`、`/v1/images/edits`、`/v1/h3_image_context_ir` 的 OpenAPI 全字段）、ComfyUI 节点三层**都不存在 `style` / `style_preset` / `style_id` 字段**。【源码】【官方文档】
2. 画风实际上只有**三条真通道**：**提示词里的可见画法描述**（基础，必选，但弱）、**参考图**（最强，且成本为零）、**LoRA**（最强但最重）。**负面提示词不存在**（SGLang 对 `negative_prompt` 返回 400 拒绝，ComfyUI 官方 blog 明说"没有负面提示词可写"）。【官方文档】
3. **提示词必须写成"整幅图的完整英文描述"**，官方要求英文，长度上限 **4096 tokens**；写法顺序是「用途 → 布局 → 主体与动作 → 场景 → 光 → 相机 → 质感 → 画面文字」；风格要用**可观测的画法词**（`flat cel shading`、`two-tone shadows`、`clean dark linework`），不要用 `premium` / `cinematic` 这类形容词。【官方文档】（[SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/SKILL.md)、[t2i-en.txt](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/references/t2i-en.txt)）
4. **中文**：官方口径是英文（"Write the description in English. Text that appears in the image keeps its own language."）。中文能出图但遵循度更低；**官方 API 上层中文之所以"可用"，很大程度是因为 API 前置的 Context-IR / PE 会把中文改写成英文**——我们本地没有这一步，所以中文风险显著放大。【官方文档+实测+推断】
5. **prompt expander（PE）是一把双刃剑，不是必选项**：两份独立实测结论**方向相反**，但拆开看是一致的——**短提示词 / 用户随手一句 → 开 PE 更好；已经写全的详细提示词 → 关 PE 更好**（PE 会覆盖你已经定好的细节）。我们本地没有 PE，因此**必须自己承担"展开"的职责**（这正是本项目提示词编译器要做的事）。【实测】
6. **对本项目最划算的三件事**：① 给图像子系统补一个"风格句注入"（复用视频侧 11 条 `STYLE_PRESETS.en` 整串）；② 把"参考图当画风锚"做成一流路径（`<Picture N>` + 复用编辑模板的 Subject/关系写法）；③ 画风 LoRA 走已有的 `models/loras/h3img/30_style/` 单选槽。【推断，依据见第六章】

---

## 一、画风控制通道全景

### 1.1 六条候选通道逐条判定

| # | 通道 | 有 / 没有 / 有限 | 实际效果 | 证据 |
|---|---|---|---|---|
| 1 | **纯提示词（style words）** | **有**（唯一"永远在场"的通道） | **中偏弱**。写"怎么画"（平涂/双色阴影/干净线稿）有效；只写"anime style / high quality"会被模型自己挑成 3D 混血风。另有一个坑：**PE 开着时你写的风格词会被改写**（详见第四章） | 【官方文档】强调"Style through visible details"（[SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/SKILL.md)）；【实测】六种风格（工笔/水彩/像素/黏土/动画/厚涂油画）稳定（[首日通宵实测](https://aiyqx.cc/p/10801/)）；【社区】单写 "anime style" 锁不住、会漂 3D（[ArcLoop 动画指南](https://arcloop.ai/handbook/zh-CN/minimax-h3-anime-prompt-guide)），Civitai 上 2D↔Realism 滑块 LoRA 的作者原话也是"base H3 的 2D 动漫偏向 3D、不够平"（[civitai/2980230](https://civitai.com/models/2980230)） |
| 2 | **参考图当画风参考**（`<Picture N>`） | **有，且是最强最省的通道** | **强**。一张"已经是目标画风"的图，比任何风格文字都管用；接 VAE 时参考图还会被锚定成 reference latent（像素级约束），不接 VAE 时只经文本编码器（更"松散"，反而更适合"只借画风"） | 【官方文档】[ComfyUI 节点文档](https://docs.comfy.org/built-in-nodes/MiniMaxH3ImageConditioning)："With it the pictures are also anchored as reference latents; without it they only condition the text encoder."；【官方文档】[ComfyUI blog](https://blog.comfy.org/p/minimax-h3-image-is-now-available)；【社区】[ArcLoop](https://arcloop.ai/handbook/zh-CN/minimax-h3-anime-prompt-guide)："一张风格精准的干净 2D 角色插画……比任何一段风格描述文字都管用。这是最重要的输入，没有之一。" |
| 3 | **LoRA** | **有**（本地 ComfyUI / 第三方托管 API 都能挂） | **强、可复现、可调强度**；代价是需要触发词、生态小、**总强度不能超过约 1.5–2.0**（超过会出坏图）。另外 6 步是 PDD 头决定的，LoRA **不能**改变步数 | 【源码/官方文档】官方 API **没有** LoRA 字段；ComfyUI 本地可用 `LoraLoaderModelOnly`；【社区】Civitai 共 **58 个** baseModel=MiniMax H3 Image 的 LoRA（见 §5.1）；[rurudo style](https://civitai.com/models/3054448) 作者："H3 image model will reproduce bad image when the total lora strength (including other loras) is above 2.0"；【社区】第三方 API 版本提供 `loras`（[WaveSpeed](https://wavespeed.ai/docs/docs-api/wavespeed-ai/minimax-h3-image/text-to-image-lora) 最多 3 条、scale 0–4；[Atlas Cloud](https://www.atlascloud.ai/zh-TW/models/minimax/h3-image-developer/edit-lora) 最多 1 条） |
| 4 | **负面提示词** | **没有（已确认，且是硬拒绝）** | **完全无效**。SGLang 官方部署对 `negative_prompt` **直接返回 400**；`guidance_scale` 只能填 1，填别的也是 400 | 【官方文档】[模型卡 Request Parameters 表](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image)："`negative_prompt` / Not supported / **Rejected**"；【官方文档】[ComfyUI blog](https://blog.comfy.org/p/minimax-h3-image-is-now-available)："guidance 1 … there is nothing to tune and **no negative prompt to write**"；【官方文档】[ComfyUI 教程](https://docs.comfy.org/tutorials/image/minimax/minimax-h3-image)："Write everything you want, **including things to avoid**, into the positive prompt."；【源码】本仓库工作流 `dsh-jiuzhang-studio/data/workflows/h3-image.json` 用 `BasicGuider`，**没有 negative 分支** |
| 5 | **专门的 style 参数 / style preset** | **没有** | 不存在。API、ComfyUI 节点、本项目插件三层都没有 | 【源码】三份 OpenAPI（generations / edits / context-ir）字段全表见 §1.2，无任何 style 字段；【官方文档】[节点文档](https://docs.comfy.org/built-in-nodes/MiniMaxH3ImageConditioning) 的输入只有 clip / vae / prompt / width / height / images；【源码】本项目 `host/tools.js` 的 `studio_image` schema 也没有 style 参数（只有 prompt / sizeId / width / height / seed / count / refImages / loras） |
| 6 | （补充）**prompt embedding `embedding:name`** | **有限 / 未验证** | ComfyUI 支持在 H3 提示词里写 `embedding:xxx`，社区有 10 个"风格 embedding"；但它们是为 **H3 视频**训练的，**图像侧没有官方或社区的 style embedding** | 【源码】[ComfyUI PR #15697](https://github.com/Comfy-Org/ComfyUI/pull/15697)（`comfy/text_encoders/minimax.py`，图像与视频共用同一 tokenizer 类）；【官方文档】[ComfyUI H3 提示词指南](https://docs.comfy.org/tutorials/video/minimax/minimax-h3-prompt-guide) 列出 10 个 `minimaxh3_*` embedding；【源码】[Comfy-Org/MiniMax-H3-Image](https://huggingface.co/Comfy-Org/MiniMax-H3-Image) 仓库根目录**没有** `embeddings/` 目录（对比 [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main/embeddings) 有 10 个） |

**顺带排除掉的"伪通道"**（容易误以为是画风开关）：

| 嫌疑 | 为什么不是 | 证据 |
|---|---|---|
| 步数 / CFG / sampler | 6 步由 `pdd_fused_heads.safetensors` 的 6 个头决定，cfg 恒 1；SGLang 传别的值直接 400。本项目插件把 6 写进 `IMAGE_SAMPLING`，UI 无滑块 | 【源码】`host/services/h3-image.js` 的 `IMAGE_SAMPLING`；【官方文档】模型卡 "num_inference_steps: Omit or 6，other values return HTTP 400" |
| prompt_optimizer / enhance 开关（官方 API） | 那是 **PE 开关**，改的是"提示词被改写成什么"，不是"模型侧的画风旋钮" | 【官方文档】[图片生成指南](https://platform.minimax.io/docs/guides/image-generation) |
| 换 VAE（如社区 HDR VAE） | 社区自制 VAE，改的是重建算子（梯度能量/饱和度倾向），属于**后处理式观感修改**，不是画风控制；且有失真风险 | 【社区】[Civitai 3045662 Minmax Image HDR VAE](https://civitai.red/models/3045662)（原文：HDR VAE 是 enhancement-oriented reconstruction operator，不是 pixel-preservation） |
| ControlNet | H3-Image **目前没有可用的 ControlNet**。社区把视频侧 Fun ControlNet-Union 2.0 接到图像 DiT 上**失败**了（作者自述"perturbs, never steers"） | 【社区/实测】[akhaliq/MiniMax-H3-Image-Fun-Controlnet-Union-2.0](https://huggingface.co/akhaliq/MiniMax-H3-Image-Fun-Controlnet-Union-2.0) |

> **一句话**：H3-Image 的画风 = **提示词画法描述（弱） + 参考图（强） + LoRA（强）**，三者之外没有第四种。

### 1.2 官方 API 到底有哪些字段（有没有 style）

对三份 OpenAPI 逐字段核对（`/v1/images/generations`、`/v1/images/edits`、`/v1/h3_image_context_ir`）：

| 字段 | generations | edits | context-ir | 说明 |
|---|---|---|---|---|
| `model` | ✅ | ✅ | ✅ | `MiniMax-H3-Image` / `MiniMax-H3-Image-Highspeed`（context-ir 只支持前者） |
| `prompt` | ✅ | ✅ | ✅ | ≤ 32000 字符；关增强时只读前约 4096 token |
| `image` / `images` | — | ✅ 1–16 张 | ✅ 1–16 张 | 顺序即 `<Picture 1..16>` |
| `size` / `aspect_ratio` / `area` | ✅ | ✅ | ✅（仅影响编辑增强） | 只决定画布 |
| `n` | ✅ 1–10 | ✅ | — | 张数 |
| `output_format` / `output_compression` | ✅ | ✅ | — | 编码 |
| `response_format` / `stream` | ✅ | ✅ | — | 传输 |
| `disable_prompt_enhanced` | ✅ | ❌（编辑强制增强） | — | **PE 开关** |
| `seed` | ❌（官方 API 文段未列；SGLang 侧有） | ❌ | ❌ | — |
| **`style` / `style_preset` / `style_id` / `style_strength`** | **❌ 无** | **❌ 无** | **❌ 无** | — |
| **`negative_prompt`** | **❌ 无** | **❌ 无** | **❌ 无** | — |
| `loras` | **❌ 无** | **❌ 无** | **❌ 无** | 只有第三方托管 API 自己加了 `loras` |

证据：官方文档 [Text-to-Image](https://platform.minimax.io/docs/api-reference/image-generation-h3-generations)、[Image Edit](https://platform.minimax.io/docs/api-reference/image-generation-h3-edits)、[H3-Image-Context-IR](https://platform.minimax.io/docs/api-reference/image-generation-h3-context-ir)，以及中文站 [图片生成](https://platform.minimaxi.com/docs/guides/image-generation)（"暂不支持：预览图、局部编辑（mask）、透明背景"，**没有提任何风格参数**）。

**结论**：官方 API **没有任何画风独立参数，也没有 `style` 字段**。官方对"画风"的全部态度就是"写进 prompt"。（【官方文档】，确定）

> 补充：MiniMax 上一代 `image-01` 的 `/v1/image_generation` 同样没有 style 字段（只有 `prompt` / `aspect_ratio` / `width` / `height` / `seed` / `prompt_optimizer` / `subject_reference`），说明这是 MiniMax 一贯的产品取向，不是这一代漏了。【官方文档：[Text to Image Generation](https://platform.minimax.io/docs/api-reference/image-generation-t2i)】

### 1.3 ComfyUI 官方模板里画风是怎么处理的（源码级）

两个模板都是 **subgraph 封装**，我把 JSON 拉下来逐节点看了：

**T2I 模板**（[image_minimax_h3_image_t2i.json](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_minimax_h3_image_t2i.json)）

| 节点 | 类型 | 作用 |
|---|---|---|
| 1 / 2 / 3 | `UNETLoader` / `CLIPLoader`(qwen3vl_32b) / `VAELoader` | 主模型、文本编码器、图像 VAE |
| 5 | `MiniMaxH3ImageConditioning` | **prompt 真正的入口**（width/height 默认 3104×3104） |
| 6 | `ConditioningZeroOut` | 给 KSampler 的 negative 槽喂"零化条件"——**不是负面提示词**，只是满足 KSampler 的接口 |
| 7 | `KSampler` | seed / 6 steps / cfg **1** / euler / simple |
| 15 + 16 + 17 + 19 + 20 + 24 + 26 + 22 | `TextGenerateV2` + `CLIPLoader`(**qwen3.5_9b_w4a8_gptq**) + system/task/user prompt + `StringReplace` + `JsonExtractString` + `ComfySwitchNode` | **prompt expander 链**：小 LLM 读 `prompt/t2i/task_prompt.txt` 与 `system_prompt.txt`，输出 `{"expanded_caption":…, "aspect_ratio":…}`，抽出 caption 再经过 switch 决定是否覆盖用户输入 |
| 8 / 9 | `VAEDecode` / `SaveImage` | 出图 |

**Edit 模板**（[image_minimax_h3_image_edit.json](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_minimax_h3_image_edit.json)）在同样结构上多了：`LoadImage`(45) → `ResizeImageMaskNode`(48/56，**32 对齐 + 面积缩放**) → `MiniMaxH3ImageConditioning.images`；`PrimitiveBoolean`(61)=`True` 控制 expander；`ImageCompare`(62) 做前后对比。

**关键观察（这才是回答"模板里画风怎么处理"）**：

1. **模板里没有任何画风节点**。没有 style 注入、没有风格 LoRA、没有 style embedding。**画风 100% 落在 `prompt` 这一个字符串里**。【源码】
2. 模板自带的示例 prompt 是一段 **3308 字符**的长英文描述（`plush fox` 海报那张），风格词是嵌在正文里的（"drawn in a warm, fairly saturated palette … long-staple mohair-type plush … matte dark eyes with a dull highlight"），**不是**一个 `style=` 参数。【源码】
3. **expander 的位置很讲究**：它在 `MiniMaxH3ImageConditioning` 之前，用 `ComfySwitchNode` 二选一（用户原文 vs 扩写结果）。所以"模板默认开 PE"这句话的准确含义是：**默认把 prompt 整个换掉**，而不是"在 prompt 后面追加"。这一点决定了后面第四章的判断。【源码】
4. ⚠️ **一个需要实测确认的细节**：T2I 模板里 `ComfySwitchNode.widgets_values = False`，Edit 模板里 `PrimitiveBoolean.widgets_values = True`。而 [ComfyUI 教程](https://docs.comfy.org/tutorials/image/minimax/minimax-h3-image) 说"Both templates ship with the expander switched on"。两者**不一致**，且 T2I 里该 switch 被提升为 subgraph 输入、值可能被父图覆盖。→ 标【源码 + 待实测】：**不要在文档里断言"T2I 模板默认开 PE"**，要以界面上那个开关的实际状态为准。

**官方 API 侧的对应关系**（供对照）：API 的 `disable_prompt_enhanced: true` 就是同一个开关，且**文生图才允许关**；**编辑永远增强**（[图片生成指南](https://platform.minimax.io/docs/guides/image-generation)），第三方托管 API 也复述了同一条（[Runware](https://runware.ai/docs/models/minimax-h3-image/guides/prompt-optimizer)："Editing always uses the optimizer … `false` alongside reference images is rejected"）。

### 1.4 三条通道的实际强弱排序（结合实测）

| 排序 | 通道 | 适用场景 | 成本 | 备注 |
|---|---|---|---|---|
| 1 | **参考图**（`<Picture N>`） | 有"目标画风的成品图"时 | 0（NFE 不变，只多 VAE/vision 编码） | **不接 VAE** 时参考图只走文本编码器 → 更适合"只借画风不抄构图"【官方文档】 |
| 2 | **LoRA** | 需要**成百上千张**都一个画风、且能接受触发词与调权重 | 训练 8 分钟（Unsloth 60 张 150 步，RTX PRO 6000）/ 次 | 强度 0.6–1.0 常用；**总强度 >2.0 崩**；风格在训练分辨率（如 1024²）最强、2048² 会变弱【社区：[Unsloth](https://unsloth.ai/docs/models/minimax-h3-image/fine-tune-minimax-h3-image)】 |
| 3 | **提示词画法词** | 永远都要写（兜底） | 0 | 必须写"怎么画"；写了 PE 又开着会被改写 |

---

## 二、提示词格式要求

### 2.1 推荐结构（官方两处口径完全一致）

官方有两份权威说法，**互相印证**：

- **模型卡**："MiniMax-H3-Image expects a **detailed English description of the whole image**."（[模型卡](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image)）
- **官方 skill**："MiniMax-H3-Image renders best from a **complete description of the finished image**: what the image is for, what is in it and where, how it looks, and every word that appears on it."（[SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/SKILL.md)）

官方 skill 的**规划顺序**（写之前先在脑子里定好）：**用途与交付物 → 整体布局 → 宽高比 → 主体及其动作 → 视觉风格 → 文字**。

官方 skill 的三条**落笔铁律**（原文，值得逐字引用）：

> - **Task before style.** Open with what the image is and what it is for, then the main people or objects and their state or action. **Style comes after.**
> - **Layout before details.** Give the number of subjects, their positions, the viewpoint and the empty space. For dense content, name the regions first and then fill each one: "a title across the top; below it, a photo on the left and three short paragraphs on the right."
> - **Style through visible details.** Write color, material, light and texture, such as "**soft side light, brushed-metal reflections, generous white space**", instead of words like "**premium**" or "**high-end**". Keep the details that matter and drop contradictory ones.

社区侧给出了同构的**九段式**（对实操最友好，可当模板用，【社区】：[vyrekai MINIMAX_H3_IMAGE_PROMPT_GUIDE.md](https://huggingface.co/vyrekai/minimax-h3-image-comfyui-workflows/blob/main/MINIMAX_H3_IMAGE_PROMPT_GUIDE.md)）：

1. **媒介与镜头**："A candid photograph…" / "A 2D anime illustration…" / "A minimalist travel poster…"
2. **主主体**：数量、年龄、体型、脸、肤色、发型、表情、服装（颜色+材质）、配饰
3. **姿势与动作**：一个冻结瞬间；身体朝向（相对相机）；手在哪、在碰什么
4. **次要主体**
5. **场景**：背景、左、右、前、后；具体物件与材质、磨损、天气
6. **光**：光源、方向、时段、色温、阴影（"Low warm sun from screen-left, long shadows falling to the right."）
7. **相机**：镜头、机位高度、角度、对焦（"eye level with a 50mm lens, f/2.8"）
8. **质感与完成度**：皮肤毛孔、织物纹理、灰尘、划痕；插画则一句风格句
9. **画面文字**：原词加双引号 + 位置 + 字号 + 字体气质 + 颜色

> 注意第 1 段与第 8 段：**风格描述在官方体系里是分散在两处的**（"这是什么媒介" + "质感/完成度"），而不是"开头堆一堆风格词"。这与视频侧"开场风格句"的习惯不同。

### 2.2 长度：上限很硬，"短提示词"才是问题

| 层 | 上限 | 行为 | 证据 |
|---|---|---|---|
| 模型本身（SGLang / 权重） | **4096 tokens** | 超出**截断**（"truncated to 4096 tokens"） | 【官方文档】[模型卡](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image) Request Parameters |
| 官方 API（文生图） | prompt ≤ **32000 字符** | 关增强时**只读前约 4096 token**，其余无效；开增强时先改写再生成 | 【官方文档】[generations OpenAPI](https://platform.minimax.io/docs/api-reference/image-generation-h3-generations) |
| 官方 API（编辑） | prompt ≤ 32000 字符 | 强制增强；参考图另有格式/尺寸/数量限制（≤16 张、单张 ≤64MiB、边长 128–8192、长宽比 ≤4:1） | 【官方文档】[edits OpenAPI](https://platform.minimax.io/docs/api-reference/image-generation-h3-edits) |
| ComfyUI Partner 节点（`MiniMaxH3ImageNode`） | **8000 字符** | 有参考图时最大 8000 字符 | 【官方文档】[MinimaxH3ImageNode](https://docs.comfy.org/built-in-nodes/MinimaxH3ImageNode) |
| **本项目（本地 ComfyUI）** | **4096 字符** | 超长**直接 400 `PROMPT_TOO_LONG`，不静默截断** | 【源码】`host/services/h3-image.js` 的 `IMAGE_PROMPT_MAX_CHARS = 4096` |
| PE 生成本身 | `max_tokens = 4096`（含 thinking） | 超了会「思考吃光预算、返回空 caption」 | 【官方文档】PE [request_params.json](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE/blob/main/prompt/t2i/request_params.json) |
| 社区经验值 | 常规 **120–350 词**；复杂多参考 **400–900 词** | — | 【社区】[vyrekai 指南](https://huggingface.co/vyrekai/minimax-h3-image-comfyui-workflows/blob/main/MINIMAX_H3_IMAGE_PROMPT_GUIDE.md) |

**短提示词 vs 长提示词：官方明确站"长"。**

- 官方 API 默认**给你扩写**（PE），这本身就是"官方认为短提示词不够"的最强证据。【官方文档】
- ComfyUI 官方 blog："**Long, complete descriptions of the image work best.**"【官方文档：[blog.comfy.org](https://blog.comfy.org/p/minimax-h3-image-is-now-available)】
- 反面证据（短提示词的具体坏结果）：一句 "a food truck at a summer festival" 关掉增强后，**招牌文字全是乱码**；开增强后 PE 给卡车起名 "SUMMER BITES" 并填了价目表。【实测：[Runware prompt optimizer](https://runware.ai/docs/models/minimax-h3-image/guides/prompt-optimizer)】
- 中文短提示的反面证据：一句"赛博朋克风格的重庆夜景" → 画成"一个士兵站在金属门框前"，完全没有重庆；换成手写英文详细描述后才有穿楼轻轨、霓虹、江雾。【实测：[首日通宵实测](https://aiyqx.cc/p/10801/)】

**PE 的存在意味着什么**（这是本题的核心判断）：

> PE 的存在证明：**这个模型的"出厂用法"是吃长英文描述**。官方把"我该怎么写"这件事外包给了一个 27B 的改写模型——因为对 C 端用户来说写不出来。
> 对我们（自建流水线）意味着：**"展开提示词"这一步不能省，只能换人做**——要么部署 PE，要么自己写全（本项目走后者，见 §4.4）。

### 2.3 官方正例 / 反例（尽量引原文）

**反例（官方明令避免的写法）**——三处原文：

| 反模式 | 官方原文 | 出处 |
|---|---|---|
| 用形容词当风格 | "Write color, material, light and texture … instead of words like **'premium'** or **'high-end'**" | [SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/SKILL.md) |
| 用"有些图标 / 一段文案"敷衍版面 | "'Some icons' or 'a paragraph of copy' does not complete a design." | [t2i-en.txt](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/references/t2i-en.txt) |
| 把内容写成"给另一个作者的指令" | "Write what appears in the image, **not instructions for another writer** or a list of possible approaches." | 同上 |
| 拿形容词定画幅 | "A style word such as 'cinematic' does not fix the canvas." | 同上 |
| 无关堆砌 / 加支线主角 | "Concrete visual choices are more useful than generic quality claims, hidden backstory, or extra principal subjects." | 同上 |

**正例 1（物理接触，官方全文，可直接当范文）**——Query: `A woman potter shaping a bowl on a wheel in a sunlit workshop, seen from her left side. Emphasize her hands working the wet clay. No text.`

> `A naturalistic photograph of a woman potter seated at a pottery wheel in a sunlit workshop, viewed from her left side at approximately hand level. A medium composition includes her profile, shoulders, forearms, hands, and the complete bowl on the wheel, with enough of the wheel and stool visible to make her working posture clear. She leans slightly forward with relaxed shoulders and looks down at the clay. Capture one precise moment as her left hand supports the bowl's outer wall while the fingertips of her right hand shape the inner surface near the rim. … Soft sunlight enters from a side window, catching the moisture on the clay and casting gentle shadows beneath her wrists. A worn wooden workbench and quiet shelves recede out of focus, keeping attention on the hands and their contact with the bowl. Warm earth tones, believable skin texture, and subtle workshop wear give the scene a tactile, unposed quality. **No lettering or additional people appear.**`

**正例 2（数据看板，官方全文节选）**——注意它是**把数值写死在提示词里**，并且明确"不要自创数据"：

> `A clean 16:9 sales dashboard … The title "Quarterly sales" sits at the upper left. Two compact summary cards … "Total units" with the value "39", and "Best-performing product" with "B — 18 units". … Their heights correspond exactly to 12, 18, and 9 … **There are no invented dates, forecasts, percentage changes, or additional data series.**`

**正例 3（官方 API 的"改写前 → 改写后"，可当"短 vs 长"对照）**

| 阶段 | 文本 |
|---|---|
| 用户输入（[instruction.t2i.txt](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image/blob/main/examples/instruction.t2i.txt)） | `A rustic, overhead shot of a farm-to-table feast, showcasing a variety of colorful, seasonal vegetables, artisanal cheeses, and freshly baked bread on a weathered wooden table.`（约 41 词） |
| PE 产出（[revised_prompt.t2i.txt](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image/blob/main/examples/revised_prompt.t2i.txt)） | 约 **1500 字符**的英文长描述：把每样食材的位置（"In the center, a large woven basket…"、"To the left…"、"On the right side…"、"Below the bread in the lower center…"、"At the upper right…"）与光线（"natural and warm, coming from the upper left … casting soft, long shadows to the lower right"）全部补全 |

**正例 4（编辑，官方"改写后"全文里可见 Subject/关系语法）**：见 §2.5。

### 2.4 文字渲染（lettering）的写法要求

这是 H3-Image 最强项之一（原生 4K、16MP），官方规则非常具体：

| 规则 | 原文 / 依据 | 等级 |
|---|---|---|
| **每个要出现的字都放引号里**，保留其语言与空格 | "**Quote every word that appears.** Put the complete text in quotes, **in its own language and with its spacing as given**, together with its position, size hierarchy and line breaks." | 【官方文档】SKILL.md |
| 不要用全角空格替换原文空格 | "Keep its spaces exactly as given; **do not replace them with full-width spaces**." | 【官方文档】t2i-en.txt |
| 文字要"落地"在具体表面 | "**Put literal lettering on its intended surface.** Preserve its language, capitalization, punctuation, numbers, spelling, and line order." | 【官方文档】t2i-en.txt |
| **不要文字时要显式说** | t2i 加 `The image contains no text, letters or numbers.`；编辑则说"不新增其它文字"以保住原图文字 | 【官方文档】SKILL.md |
| 每处文字只出现一次、保持短 | "Each text item appears once. Keep each line short. **Long paragraphs on the image become scribbles**; use one-line captions." | 【社区】vyrekai（与官方规则一致） |
| 行数与列数要显式 | `2 rows and 3 columns` / `3×3 (rows × columns)`，**不能写裸的 "2×3"** | 【官方文档】SKILL.md / t2i-en.txt |
| 中文等非拉丁文字原样保留在引号内 | `The sign reads "居酒屋 とり吉".` | 【社区】vyrekai；【官方文档】"in its own language" |

**关于"大字准、小字乱"的实测边界**（重要，决定我们在什么场景能用它做文字）：

- 大字（海报标题、价签、杂志封面、菜单菜名+价格）**几乎全中**；小字（报纸正文、信息图说明、图注）**仍是"看起来像字的纹理"**。【实测：[首日通宵实测](https://aiyqx.cc/p/10801/)】
- 分辨率与文字准确度存在**非单调**关系：4MP 时拼写全对，**升到 8MP 反而出现 "Flat Whrite" 这种错拼**；把每个字母拆开写（`F-l-a-t`）对常用词有效、**对生造词（如 "LOAFMERE"）无效**。【实测：[韩语实测（n8n-diy）](https://n8n-diy.com/2026/11/minimax-h3-image-prompt-upsampler.html)】
- 一条实用经验：**不要写"不要有其它文字"来防乱码**（CFG=1 下反而容易招来文字），应该写"no text or logo on the product"这种**指向明确载体**的短句，或直接用 `The image contains no text, letters or numbers.`【社区：[image-2 实测](https://image-2.net/zh-cn/blog/minimax-h3-image-review/) + 官方 skill】

### 2.5 有参考图时（编辑 / 多参考）的写法

官方给了一条**与文生图不同的结构**，来自 `prompt/edit/task_prompt.txt`（PE 的编辑任务提示词）与 `references/edit-en.txt`：

**单段落 + 三段逻辑顺序**：

1. **定义（Part 1）**：`The red cup on the left in <Picture 1> is <Subject 1>.` —— 每个需要独立判断的"范围"给一个 `<Subject N>`；
2. **目标概述 + 逐个关系（Part 2）**：`The target image …` 开头，然后**每个 Subject 单独一句关系**，四选一：
   - **Fully preserved**：只写 `"<Subject N> is fully preserved."`，**不许**再补任何外观描述；
   - **Partially preserved**：说清"保留了什么 / 改成了什么"；
   - **Attribute transfer**：`<Subject 2> supplies the exact body color transferred to <Subject 1>.`；
   - **Weak reference**：只借气质/配色/构图原则，说明"可自由变化"的范围。
3. **只写变更与新增（Part 3）**：删掉的东西要写"原位置现在是什么"，**不要重述被保留对象的外观**（这是最容易被忽略的规则，官方专门给了对/错例子）。

官方给的对/错示例（原文）：

> **Correct**: `The black horse in <Picture 1> is <Subject 1>. The target image shows <Subject 1> beside a newly added luminous pearl. <Subject 1> is fully preserved. The pearl emits a cool glow onto the ground beside <Subject 1>.`
> **Incorrect**: `<Subject 1> is fully preserved. <Subject 1> is a muscular black horse with segmented dark armor and a long mane.` ← "must be omitted"（这是 T2I 式复述）

官方**改写后**的真实输出（[examples/revised_prompt.edit.txt](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image/blob/main/examples/revised_prompt.edit.txt)，一整个段落，**10 个 Subject**）：

> `The man on the left in a dark sweater and wristwatch in <Picture 1> is <Subject 1>. … The wooden desk sign with raised lettering reading 'MONEY TALKS' in <Picture 1> is <Subject 4>. … The podcast studio environment, including the wooden desk, shelves, lamps, books, and decor in <Picture 1>, is <Subject 10>. The target image shows <Subject 1> without the over-ear headphones … <Subject 1> is partially preserved; his identity, facial features, expression, dark sweater, and wristwatch remain, while his headphones are removed … <Subject 3> is fully preserved. <Subject 4> is fully preserved. … On <Subject 1>, the headband indentation across the top of his head is gone, replaced by natural, voluminous wavy brown curls …`

**编辑的社区简化版**（更短，适合"只改一处"的日常用法，【社区】vyrekai）：

```text
Edit <Picture 1>: keep <逐项点名要保住的东西>.
<把变更描述成结果的样子：位置、大小、颜色、材质、光>.
<变更如何与既有光/透视/阴影衔接>.
Everything else in <Picture 1> stays exactly the same.
```

四条实操要点：

1. **"keep 列表"要点名具体对象**（"keep the exact location, camera angle, perspective and daylight … the silver truck on the left edge, the cracked asphalt…"），而不是"keep everything"。【社区】
2. 要**描述结果**而不是**描述操作**："The sofa is now deep green velvet with brass legs" 优于 "change sofa colour"。【社区】
3. **一次只改一件事**；3 件以上互不相关的改动拆成多轮，但 ⚠️ **不要拿上一轮输出继续改**（见 §5.4 崩坏问题）。
4. **画风转换也要点名"保什么"**：`Redraw <Picture 1> as a 2D anime illustration with clean line art and soft cel shading. **Keep the same composition, poses, outfits and colours.**`【社区】

### 2.6 与视频侧规范的互斥点（我们最容易踩的坑）

| 项 | H3 视频 | H3-Image |
|---|---|---|
| 负面句 / "不要 X" | **禁止**（cfg=1，写了反而招来） | **允许且常用**——官方指南"Write everything you want, **including things to avoid**, into the positive prompt"；实测 `no text or logo on the product` / `no other people` 有效【官方文档 + 实测】 |
| 正文语言 | 英文；中文只能在 `<d>[Chinese]` 台词内 | 英文；中文只出现在**引号内的画面文字**（`<d>` 通道不存在） |
| 结构 | `integrated_multimodal_description` / `overall_soundscape` / `non_diegetic_music` 三段；或 Ref2VA 六段 | **没有字段名**，就是**一段（或几段）自由文本**；编辑是"一段话 + Subject 关系"，**不是**字段化的 `retention_analysis` |
| 长度 | 6000 字符（本插件收紧，官方 7000） | **4096 字符**（本插件），官方 4096 **tokens** |
| 时间轴 / 分镜 | 有 `[Shot N]` + 时间戳 | **没有**（单帧，无时间轴） |

> 结论：**不能把视频那套模板直接喂给 H3-Image**。特别是"正文禁写负面句"这条铁律**在图像上是错的**（本项目 `host/services/h3-image.js` 的注释里已经明确写了这个判断：`MiniMaxH3ImageConditioning` 没有 negative 输入通道，prompt 是自由文本，编码器正常理解"不要/禁止"）。

---

## 三、中英文问题

### 3.1 官方口径：英文（不拐弯）

| 出处 | 原文 |
|---|---|
| 模型卡 | "MiniMax-H3-Image expects a **detailed English description** of the whole image."（[链接](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image)） |
| 官方 skill 输出规范 | "**Write the description in English.** Text that appears in the image keeps its own language."（[SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/SKILL.md)） |
| PE（文生图）任务词 | "Rewrite input_text into a natural **English** detailed caption"（[task_prompt.txt](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE/blob/main/prompt/t2i/task_prompt.txt)） |
| PE（编辑）任务词 | "Write all descriptive and relationship prose in **fluent English**, regardless of the language of the user instruction."（[edit task_prompt](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE/blob/main/prompt/edit/task_prompt.txt)） |
| PE 输出契约 | 只输出 `{"expanded_caption": 英文, "aspect_ratio": …}`——**PE 的产物一定是英文** |

### 3.2 中文到底能不能用：证据链

| 证据 | 内容 | 等级 |
|---|---|---|
| HF 官方讨论区（H3 视频，同一编码器） | 有人问"中文提示词 + 中文 tag 行不行"，官方人员编辑后的回复倾向英文；其他用户实测："**直接用自然语言 '第一张图片背景作为参考' 都有用，提示词全用中文写也有效果，不过遵循度没对比测试**"；另一条："**支持，但是有时候会很奇怪，把中文描述的动作当作台词给念出来，所以最好还是英文**" | 【官方文档（讨论区）+ 社区】[discussion #32](https://huggingface.co/MiniMaxAI/MiniMax-H3/discussions/32) |
| 本地部署 240 张实测 | "一句中文短提示，效果和英文详细描述差很多"；举例："赛博朋克风格的重庆夜景"中文完全跑偏 vs 英文版有穿楼轻轨/霓虹/江雾 | 【实测】[aiyqx.cc](https://aiyqx.cc/p/10801/) |
| NGA 讨论 | "官方推荐除了台词和画面里的文字，都是英文"；"全英文的看起来真遭罪" | 【社区】[nga](https://ngabbs.com/read.php?tid=47345707) |
| 官方 API 行为 | 文生图**默认开 PE**，PE 一律改写成英文 → **上层"中文能用"的观感，很大比例是 PE 的翻译在工作** | 【推断，基于 PE task_prompt 的英文输出契约 + API 默认开增强】 |

### 3.3 为什么"我们本地没 PE"会放大中文风险（这条最重要）

推理链（标【推断】，但每一环有官方证据）：

1. ComfyUI 的 H3 文本编码器**不加 chat template**，prompt 的 token **原样**进 Qwen3-VL（源码注释：`The H3 presentation is NOT chat-templated: token ids are raw prompt/label text`）。【源码：[comfy/text_encoders/minimax.py](https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/minimax.py)】
2. 官方训练/示例指南全是英文；H3 视频侧的中文副作用（"把中文描述的动作当作台词念出来"）就是"非英文进编码器"的直接后果。【官方文档 + 社区】
3. 官方 API 用 PE 把中文**先变成英文**，所以我们平时感受到的"中文也行"是**PE 掩盖**的结果。
4. 我们本地**没有 PE** → 中文原样进编码器 → 落在"遵循度未测试 + 可能有怪行为"的区间。

### 3.4 中文结论与操作建议

| # | 结论 | 等级 |
|---|---|---|
| 1 | **正文（描述、风格、构图、光线）一律写英文** | 【官方文档】 |
| 2 | **画面里要出现的文字**保留其原语言，放**引号**里（这是唯一合法中文通道） | 【官方文档】 |
| 3 | 中文**能出图**，但遵循度低于英文；**不要**用它做精细控制（表情、微动作、精确构图） | 【实测+社区】 |
| 4 | 本地无 PE 时，**中文风险 > 官方 API 上的中文风险**（缺了改写/翻译这一层） | 【推断】 |
| 5 | 推荐工作流：用户用中文提需求 → **由 LLM/提示词编译器翻成英文长描述** → 模型只吃英文 | 【推断，与本项目现有"提示词编译器"职责一致】 |
| 6 | 一个反直觉的点：即使全英文，**PE 开着也可能把你的英文改写掉**——所以"英文 + 关 PE"才是"我写的字真的进去了"的配置 | 【实测：Runware】 |

---

## 四、提示词增强器（prompt expander / PE）

### 4.1 官方 PE 模型的细节

| 项 | 值 | 证据 |
|---|---|---|
| 仓库 | `MiniMaxAI/MiniMax-H3-Image-PE`（"optional"） | 【官方文档】[模型卡](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE) |
| 底座 | **Qwen3.8-27B** 微调（Apache 2.0 底座），**NVFP4** 量化 | 同上 |
| 体积 | 17.9 GB（FP4 权重，加载约 **19 GiB 显存**） | 同上 |
| 输入 | ① 文生图：一句 `input_text`；② 编辑：`user_query` + 1–16 张参考图（+ 每张的原图长宽比） | 同上 |
| 输出 | **JSON 两字段**：`{"expanded_caption": <英文整段>, "aspect_ratio": "3:2"}`（编辑版是 `target_aspect_ratio`） | 同上 |
| 采样参数 | `temperature 1.0 / top_p 0.95 / top_k 20 / min_p 0 / max_tokens 4096（含 thinking）/ reasoning_effort xhigh / enable_thinking true` | 【源码】[request_params.json](https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE/blob/main/prompt/t2i/request_params.json) |
| 约束方式 | SGLang + **XGrammar 强制 JSON schema**，`--reasoning-parser qwen3` | 【官方文档】PE README |
| 部署 | SGLang ≥0.5.23 / Diffusers `diffusers/minimax-h3-image-pe-blocks` | 同上 |
| ComfyUI 模板实际用的 | **不是 27B FP4**，而是更小的 **Qwen3.5 9B W4A8**（`qwen3.5_9b_w4a8_gptq.safetensors`），为的是跟 21GB 的 DiT 挤在一张卡上 | 【官方文档】[ComfyUI 教程](https://docs.comfy.org/tutorials/image/minimax/minimax-h3-image)；【源码】模板 JSON 的 `CLIPLoader` |
| 官方 API 侧同类能力 | `H3-Image-Context-IR`（`/v1/h3_image_context_ir`）：**只做增强不出图**，可单独调用、可返回 `revised_prompt` 复用 | 【官方文档】[Context-IR API](https://platform.minimax.io/docs/api-reference/image-generation-h3-context-ir) |

**PE 到底改写了什么**（读 `prompt/t2i/task_prompt.txt` 全文后的提炼，全部【源码】）：

1. 角色定位："act like an **expert visual designer and technical illustrator**, not a word expander"；
2. 先分类：**"被描绘的场景/照片"** vs **"传播物"**（海报、角色卡、产品板、网页/UI、图表、仪表盘、信息图、技术图、印刷页、包装、封面、多格合成）——后者要求"建成完整的信息架构，而不只是摆了几个物的场景"；
3. **先定宽高比再扩写**（4 档优先级：显式画布 > 交付物类型 > 主体构图 > 最小补全），定了就不许被后加的细节改掉；
4. 硬规则：保留所有显式文字/实体/计数/公式/数值/左右上下顺序；**要求的内容必须"可见"而不是"暗含"**（要字就写"它贴在哪个表面"）；求解镜头几何（人体朝向必须给 `front-facing` / `back-facing` / `left-facing profile` 这类相机相对词，**不许**只写 "facing square 2"）；
5. 手部接触、计数、世界知识"只能作为可见证据"、主体数量不许自行增多；
6. 传播物要"完整"：补上副标题、图例、单位、尺寸标注、色卡、页脚等**短标签**（不是长段落）；
7. **风格最后写**：`Style comes after content.`，且"用具体可见线索替代抽象情绪和泛化形容词"。

> 一句话：**PE 不是"把话说长"，而是"按一套设计规范把整幅图补齐"**。这也解释了为什么它有时会"覆盖"你已经写好的决定——它按自己的规范重排。

### 4.2 开 / 关 PE 的实测差异（两份结论相反，但可以统一）

| # | 实测 | 环境 | 开 PE | 关 PE | 结论 |
|---|---|---|---|---|---|
| A | [image-2（中文，50+ 张）](https://image-2.net/zh-cn/blog/minimax-h3-image-review/) | 官方 API（MiniMax 平台） | 黑板菜单拼写正确、颜色的"青瓷"对、"桌上不要有别的东西"做到、图标排列与价签完整 | 出现 `Flat Whitte` 拼写错误、**重复物体**、乱码标签、颜色跑偏、便利贴乱入、价签被裁 | **"每一组对比里，开启增强的结果都更好"**；关闭平均快约 5 秒（18 vs 23 秒） |
| B | [n8n-diy（韩语，7 提示词 / 8 张）](https://n8n-diy.com/2026/11/minimax-h3-image-prompt-upsampler.html) | ComfyUI 官方模板（本地，16GB 5070Ti，4MP，8 步） | 文字全对，但**衣服/姿势/道具被改**（该穿白T+蓝裤+凉鞋 → 换了整套；该靠着的姿态 → 分开坐） | **8 张里 7 张变好**：指令回来了（冰激凌色靴子、正确工具、正确国籍…） | 关 PE 后**指令遵循↑、单张 24.8s → 17.8s（−28%）** |
| C | [Runware（英文，逐条对照）](https://runware.ai/docs/models/minimax-h3-image/guides/prompt-optimizer) | 托管 API（`promptOptimizer`） | 短提示词 → 补全场景、给招牌起名、填价目表；**但完整提示词也会被重解释**（磨砂银转接头 → 圆的灰插头，纸张变浅） | 每一句都按原文抵达模型；招牌文字可能乱码 | **"Turn it off when the prompt is the spec"**；关掉必须给精确宽高；约 4096 tokens 上限；**编辑永远开** |
| D | [首日通宵实测（中文）](https://aiyqx.cc/p/10801/) | 本地 SGLang（BF16，4090） | 未跑 PE（NVFP4 在 Ada 无原生支持） | — | **明确结论**："本地部署时一定要准备一个提示词扩写环节，或者直接让 agent 做" |

**统一后的正确判断**（这条要写进我们的规范）：

> **PE 的价值 = 弥补"提示词写得不全"；PE 的代价 = 覆盖"提示词已经写得很准"的决定。**
> 判据不是"开还是关"，而是：**这份提示词是不是"规格说明书"？**
> - 短 / 随手 / 不想管细节 → 开（或等价地，自己用 LLM 补全）
> - 已经按规范写全、要精确复现 → **关**
>
> 顺带的两个硬事实：① **编辑模式永远开着**（API 层强制）；② 关掉时**必须自己给宽高**，否则 400。

### 4.3 我们本地没有 PE：意味着什么

**已核实的事实**（【源码】本仓库）：

- 出图工作流 `dsh-jiuzhang-studio/data/workflows/h3-image.json` 只有 11 个节点：`UNETLoader → CLIPLoader → VAELoader → MiniMaxH3ImageConditioning → RandomNoise / KSamplerSelect / BasicScheduler → BasicGuider → SamplerCustomAdvanced → VAEDecode → SaveImage`。**没有 `TextGenerateV2`，没有 expander。**
- 全仓库搜索 `expander|upsampl|prompt_enhanc|enhance` 在 `host/` 下**零命中**。
- 提示词唯一处理是 `normalizeImagePrompt()`：**只剥 Markdown + 压空白**，明确"不做语义改写、不截断"。
- 也就是说：**用户输入的字符串 = 模型实际吃的字符串**。

**后果（按严重度排序）**：

| # | 后果 | 严重度 | 依据 |
|---|---|---|---|
| 1 | 短提示词直接退化：拼写错、乱码标签、重复物体、颜色跑偏、"桌上不要有别的东西"做不到 | **高** | 实测 A |
| 2 | 中文短提示直接跑偏（场景都不对） | **高** | 实测 D |
| 3 | 宽高比不会"智能选择"（要用户自己选；我们有 12 档尺寸表，其实已经不是问题） | 低 | 官方 API 的 auto 由 PE 决定 |
| 4 | 不会自动补"设计完整性"（海报/信息图的副标题、图例、单位…） | 中 | PE task_prompt 规则 |
| 5 | （反向的好处）**提示词 100% 保真**，不会被 PE 改写 → 我们做"可复现出图"反而更可信 | 正收益 | 实测 C |

### 4.4 补偿方案（三档，按代价排序）

| 档 | 做法 | 代价 | 覆盖到什么 |
|---|---|---|---|
| **A（推荐，零新模型）** | **把"展开"搬到写入侧**：给图像提示词配一套"填写式模板"（§2.1 九段式 + PE 的硬规则清单），由 agent / 前端做结构化填写，生成的就是"已展开"的长英文 | 0 部署；只是规范与表单 | 覆盖 1、2、4；不覆盖"自动选比例"（我们有尺寸表，不需要） |
| **B（轻量本地 LLM）** | 用任意 OpenAI 兼容小模型 + **官方 `task_prompt.txt` 原文当 system prompt**（这正是社区 [animede/minimax-h3-image-server](https://github.com/animede/minimax-h3-image-server) 的做法："以 PE 同捆的官方规则为 system prompt，再叠加官方 skill 的指南正文"） | 一个 3–9B 模型的显存/时间（约 2–7 秒/张） | 覆盖 A 的全部 + 自动补设计完整性；**精度低于真 PE**（作者自述） |
| **C（真 PE）** | 部署 `MiniMax-H3-Image-PE`（19GiB FP4；非 Blackwell 卡回退 bitsandbytes FP4），或接官方 `H3-Image-Context-IR` 接口 | 显存/成本最高 | 与官方对齐 |

> **本项目的定位判断**：我们已经有"提示词编译器"（视频侧 9 个文件的 spec/route/styles/ref2va/lint），**图像侧的等价物是缺失的**——`studio_image` 只吃一段裸 prompt，没有风格句、没有结构模板、没有 lint。所以最划算的不是"上 PE"，而是**把 A 档做进编译器**（下一章）。

---

## 五、市面上的画风调整实践

### 5.1 Civitai / HF 生态现状（用 API 数出来的，不是猜的）

**Civitai `baseModel = "MiniMax H3 Image"` 统计**（2026-11-26 查询，`nsfw=false`）：

| 类型 | 数量 | 备注 |
|---|---|---|
| **LORA** | **58** | 全部是 `baseModel = MiniMax H3 Image` **单底座**（0 个多底座 alias） |
| Checkpoint | 4 | 均为量化/修包（INT8/INT6/INT4、NVFP4、fp8_scaled…），**没有社区融合大模型** |
| VAE | 1 | 社区 HDR VAE（改观感，不是画风） |
| Workflows | 9 | 角色卡/换脸/放大/局部重绘为主 |
| 合计 | **72** | 对比：H3 **视频**的 LoRA 数量在 600+ 量级（本项目 `lora-catalog.js` 记录 599 条视频 LoRA） |

**HF 侧**：`search=Minimax-H3-Image & filter=lora` 得 **15** 个仓库，其中大部分是**加速/工具类**（pDMD 2-step、训练 adapter、SimpleTuner 实验），真正的"画风"占少数（如 `syntaxdiffusion/tanaami-style-h3-image-lora`）。

**命名与触发词习惯**（58 个抽样）：

| 习惯 | 例子 |
|---|---|
| 后缀标明底座 | `Faetastic Style - **H3 Image**`、`Suideo's Graphic Novel Style for **H3-Image**`、`Abercrombie Style (**MiniMax H3 Image**)` |
| 用符号/短码当触发词 | `r3alm`、`DCVSTEXP.`、`DCINKYOK@I`、`Bradhamel art style.`、`ha8ir`、`ph0t0r34l`、`z1os`、`@rurudo`、`pwni style`、`ArsMovieStill` |
| 不带触发词（纯风格偏置） | `Seedream style for H3`、`Kodachrome Photo`、`60s Psychedelic Movie`、`mikkoph Style`、`Abercrombie Style`（作者明说"Don't mention the styling in prompts where you are using a style [LoRA]"） |
| 常用推荐强度 | **0.6–1.0**；滑块类可到 ±3；**总强度 >2.0 崩** |
| 风格"方向"集中 | 电影胶片（80s Fantasy / 70s Horror / 60s Psychedelic / Kodachrome / Early 1900s）、动漫（Anime Classic HD / Translucent Anime / Midjourney anime / 2.5d）、画家风（Bisley / rurudo / ningenmame / onineko / mikkoph / Daubrez / Faetastic）、写实（Photorealistic / CineVivid / Sharp Details） |

**一个重要的定性事实**：**社区 LoRA 的"风格方向"高度集中，而"画风是否足够平（2D 感）"是最大痛点**——2D↔Realism 滑块 LoRA 的作者原话：

> "The LoRA was originally created because **the base H3 model's 2D anime style leaned too heavily towards 3D and lacked a sufficiently flat, 2D look**. Consequently, its primary function is to push the style closer to 2D anime…"（[civitai/2980230](https://civitai.com/models/2980230)）

这个观察与 ArcLoop 的社区结论完全吻合（"没锚定的结果更像套了动画滤镜的 3D 渲染"）。→ **对我们是关键情报**：如果我们的 11 套画风里有 2D 扁平类（`helltaker*` / `ova90s` / `american-toon` / `ligne-claire` / `vivziepop`），**纯提示词很可能不够，需要参考图或 LoRA 兜底**。

### 5.2 典型 LoRA 案例（可直接借用的经验值）

| LoRA | 底座声明 | 触发词 | 强度 | 特别提示 | 来源 |
|---|---|---|---|---|---|
| Seedreamstyle-H3-6K | MiniMax H3 Image | `seedreamstyle.` | 1.0 | rank 16 / 1134 张 / 6000 步；**20 组四方对比**（无 LoRA / 2K / 6K / Seedream 5.5），同 seed；推荐 recipe：LCM 6 步 cfg1 simple；**H3 侧按 8448×4736 出图**（超 16MP） | [HF](https://huggingface.co/Nebsh/Seedreamstyle-H3-6K) |
| 2D Anime ↔ Realism Style Slider | MiniMax H3（视频） | 无 | **−5 … +5**（常用 ±3） | 正值偏 2D 动漫、负值偏写实；作者明确"base 2D 偏 3D" | [civitai/2980230](https://civitai.com/models/2980230) |
| [H3 image] rurudo style | MiniMax H3 Image | `@rurudo` | 0.8–1.5 | **"总强度（含其它 LoRA）>2.0 会出坏图；把步数从 6 提到 12 有帮助"** | [civitai/3054448](https://civitai.com/models/3054448) |
| pwni style | MiniMax H3 Image (pruned int8) | `pwni style` | 0.6–0.8 | 作者自述"早期实验版，可能不稳定" | [civitai/3059877](https://civitai.com/models/3059877) |
| SumiInk（水墨） | 多底座（MOSS/H3/Krea2） | `sumiink` 等 | — | **"开头写 'A sumiink painting style animation' 效果最好"**；"Turbo LoRA 会降低画质与遵循度"（视频侧经验） | [civitai/2952303](https://civitai.com/models/2952303) |
| Minimax H3 Photorealistic | H3（视频） | `ph0t0r34l` | — | 走"取视频首尾帧"路线出图，输出至 3840×2176 | [civitai/2884206](https://civitai.com/models/2884206) |
| Abercrombie Style | **MiniMax H3 Image** | **无** | 1.0 | 作者原话："Don't mention the styling in prompts where you are using a style [LoRA]"（**用了风格 LoRA 就不要再写风格词**） | [civitai/3060507](https://civitai.com/models/3060507) |
| 训练侧参考（Unsloth） | — | `trtcrd` | 1.0 / 0.6–0.8 | **60 张 / 150 步 / rank 32 / lr 5e-5 ≈ 100 秒**（RTX PRO 6000）；"风格在 1024² 最强，2048² 变弱"；"步数过多会"煮老"并让文字乱码" | [Unsloth 文档](https://unsloth.ai/docs/models/minimax-h3-image/fine-tune-minimax-h3-image) |

> ⚠️ **注意 5.2 里的底座混淆**：Civitai 上不少"看起来是 H3-Image 的画风 LoRA"其实 baseModel 写的是 **MiniMax H3（视频）**。视频 LoRA 与图像 LoRA **键集相同但不可混用**（本项目 `host/services/h3-image-lora.js` 的注释里已写明这一点，且用 `h3img/` 前缀做硬隔离）。**Civitai 上筛 `baseModel = "MiniMax H3 Image"` 才是对的**。

### 5.3 训练可行性（决定"我们能不能自产画风 LoRA"）

| 工具 | 支持度 | 关键数字 | 来源 |
|---|---|---|---|
| **Unsloth** | 官方文档级支持（`Images → Train`，Model family = MiniMax-H3-Image） | 60 张/150 步/rank 32 ≈ **100 秒**；显存 32GB+（bf16 峰值 45.5GB，int8 约 24GB）；磁盘约 95GB；**"更多步数会煮老风格并让文字乱码"** | 【官方文档（第三方）】[Unsloth](https://unsloth.ai/docs/models/minimax-h3-image/fine-tune-minimax-h3-image) |
| **Fizgig** | v9.6.0 起支持（LoRA / LoKR / **edit LoRA（前后图对）** / slider LoRA） | 预设 Standard/Style/Edit/Slider；Automagic v3 从 1e-4 自动找 lr | 【社区】[Fizgig release notes](https://github.com/shootthesound/fizgig/blob/43c88d8277291bece7f4d220568e3fe375093b50/docs/RELEASE_NOTES_v9.6.0.md) |
| **SimpleTuner / ai-toolkit** | 有实验仓库（`SimpleTuner/minimax-h3-image-LoRA-experiments`、`-domokun-2048/4096`、`-training-assistant`） | — | 【源码】[HF](https://huggingface.co/SimpleTuner) |
| 训练机理提示 | "H3 是 guidance-distilled，普通 flow 梯度一半是"学概念"、一半是"抵消蒸馏"；冻结的 assistant LoRA 垫在可训练 LoRA 下面可以把底座拉回 plain flow" | — | 【社区】Fizgig v5.2.0 release notes |

**结论**：自产画风 LoRA 的成本已经很低（**60 张 + 2 分钟**就能出一个能用的风格 LoRA），**"画风 LoRA 自建"是可行的备选路线**，尤其对"必须批量统一画风"的场景。

### 5.4 其它"类画风"通道的现状（都会影响观感，但不是画风控制）

| 手段 | 现状 | 对我们的意义 | 来源 |
|---|---|---|---|
| **Fun ControlNet-Union 2.0 接图像 DiT** | **失败**。作者：runtime 接线数学上精确（scale-0 与底座 bit-identical），但**视频训练的控制块在 6 步蒸馏轨迹上"只扰动、不导引"**；未来工作是"在 H3-Image DiT 上重训控制分支" | **现在不要指望 ControlNet 做构图/线稿控制** | 【实测/社区】[HF](https://huggingface.co/akhaliq/MiniMax-H3-Image-Fun-Controlnet-Union-2.0) |
| **多轮连续编辑** | **严重崩坏**：第 3 轮起皮肤/衣服出现高频噪点，第 5 轮过锐，第 10 轮脸碎成色块，20 轮后只剩彩色噪声（同题 Seedream 5.5 80 轮仍干净）。换分辨率/换语言/换 kernel 都一样 | **"每次编辑都从原图出发"，禁止链式迭代** | 【实测】[aiyqx.cc](https://aiyqx.cc/p/10801/) |
| **人脸一致性** | 编辑模式"人脸保持"不如 GPT Image 2.6；且**"挑脸"**——H3 自己 T2I 出来的脸保持得好，真实照片/别家模型的脸保持差 | 角色一致性不要指望编辑通道，走角色卡 + 多参考 | 【实测】[image-2](https://image-2.net/zh-cn/blog/minimax-h3-image-review/) + 【社区】[lcz.me 讨论](https://lcz.me/topic/2967/17) |
| **VAE 替换（HDR VAE）** | 社区自制，改变重建算子（梯度能量↑、饱和倾向↑），**不是保真** | 只能当"观感微调"，且会引入失真；不建议进默认路径 | 【社区】[Civitai 3045662](https://civitai.red/models/3045662) |
| **prompt embedding** | 视频侧 10 个风格 embedding（`minimaxh3_truman_show` 等）；图像侧**无** | 想在图像侧复用需自测；embedding 也是 5120 维（与 qwen3vl_32b 对齐），理论可行但**未验证** | 【源码】[PR #15697](https://github.com/Comfy-Org/ComfyUI/pull/15697) + [embeddings 目录](https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main/embeddings) |

### 5.5 与同类模型对比：画风控制手段（能借鉴什么）

| 能力 | **H3-Image** | FLUX.1 (dev/schnell) | SD3.5 (Large / Turbo) | Qwen-Image (2.1) |
|---|---|---|---|---|
| CFG / 负面提示词 | **没有**（cfg 恒 1，`negative_prompt` 400） | dev 是**蒸馏 guidance**，**不支持**负面；schnell 连 guidance 都不用 | **Large/Medium 有真 CFG，负面有效**；**Turbo 无 CFG，负面 inert** | 有真 CFG，`negative_prompt` 在 cfg>1 时有效；**turbo 版 cfg=1 时无效** |
| style 参数 | 无 | 无（靠 prompt + LoRA） | 无 | 无 |
| 风格 LoRA 生态 | **小**（Civitai 58 个，2026-11 起） | 极大 | 大 | 中 |
| 参考图当风格锚 | **强**（官方一等公民，16 张） | Kontext / Redux / USO 等变体 | 有 reference 流程 | **强**（Qwen-Image-Edit 系列主打） |
| ControlNet | **目前不可用**（试过，失败） | 成熟 | 成熟 | 成熟 |
| 提示词长度 | 4096 tokens | 较短（~512 T5） | 较长（T5-xxl） | 长 |
| 对"可见画法词"的敏感度 | **高**（Qwen3-VL 语义理解强） | 高 | 中 | 高 |

**可借鉴的四条**（【推断】，基于上表事实）：

1. **"无负面上限"是共同约束，不是 H3 独有**（FLUX schnell/dev、SD3.5 Turbo、Qwen-Image turbo 都一样）→ 行业通用解法是**"正向改写 + 具体可见线索"**，而不是想办法塞负面。→ 我们的图像提示词应当**内置一套"负面→正向"改写词表**（例如"不要塑料感皮肤" → "真实皮肤纹理与毛孔"）。
2. **参考图 > 文字**是跨模型的共性结论（FLUX 的 Redux/风格参考、Qwen-Image-Edit 的多图）。→ 我们应把"**把上一张满意的图当画风参考塞进 `<Picture N>`**"做成产品级能力（这正是 H3-Image 相对 FLUX 的优势：16 张参考 + 原生 16MP）。
3. **LoRA 是最终答案**，但只在"规模化统一画风"时才划算（ArcLoop 的判据：连续一个月每条都塞同样 9 张参考图时才该上 LoRA）。→ 我们现在**不应该**先建 LoRA 工厂，应先建"参考图 + 风格句"路径。
4. **2D 扁平是所有现代大模型的通病**（H3 如此，FLUX/SD3.5 也如此）。→ 我们那几套 2D 画风（`helltaker` / `ova90s` / `ligne-claire`）**必须配"反 3D 化"的负向→正向描述**（`flat colours, no volumetric lighting, no depth of field, hard-edged shadows`），否则会被拉成三渲二。

---

## 六、对本项目的建议

前提：本仓库现状（【源码】核实）

- 图像走 `host/services/h3-image.js` + `data/workflows/h3-image.json`（11 节点，**无 expander**）；
- 提示词上限 **4096 字符**，超长 **400 拒绝**（不截断）；
- `normalizeImagePrompt()` **只剥 Markdown + 压空白**，不做语义改写；
- LoRA 走 `h3img/30_style|32_quality|40_character|50_slider|60_concept|99_inbox`，**画风单选、总强度 ±2、最多 6 槽**；
- `studio_image` 参数里**没有任何 style 字段**；
- 视频侧的 11 条 `STYLE_PRESETS` / 7 条 `LIGHTING_PRESETS`（`host/bridge/prompt/styles.js`）**只服务视频编译器**，图像路径没有用到。

### 6.1 能立刻用（0 行代码，只改工作方式/文档）

| # | 做法 | 为什么 | 依据 |
|---|---|---|---|
| 1 | **图像提示词一律写英文长描述**，用 §2.1 的九段式当人工模板 | 官方唯一推荐格式；本地无 PE，长短差别被放大 | 官方 + 实测 D |
| 2 | **画风靠"可见画法词"**，禁止 `premium/cinematic/high-end` | 官方明令 | 官方 SKILL.md |
| 3 | **用参考图当画风锚**：把满意的一张图当 `<Picture 1>`（或额外一张）塞进去，并在 prompt 里点名"只借画风，不借构图/脸" | 社区一致认为这是最强且最省的手段 | ArcLoop + node 文档（不接 VAE 时只影响文本编码器，"只借风格"更干净） |
| 4 | **负面约束照写**（图像侧允许）：`no text or logo on the product` / `no other people` / `no watermarks` | cfg=1 下官方的解决办法就是"写进正面提示词" | 官方 ComfyUI 教程 + 实测 A |
| 5 | **画面文字必须加引号**、给位置/字号/字体气质；**不要文字就写 `The image contains no text, letters or numbers.`** | 官方规则；实测大字准、小字乱 | 官方 + 实测 D |
| 6 | **禁止链式多轮编辑**：每轮都回到原图 | 第 3 轮开始崩，第 10 轮报废 | 实测 D |
| 7 | **LoRA 用了风格就不要再写风格词**；强度 0.6–1.0，**总强度不要超 1.5**（本插件硬上限 2.0） | 社区作者原话 + 插件已有的看门狗 | Civitai + 源码 |
| 8 | 2D 画风场景**必须**加"反 3D 化"描述（`flat colours, hard-edged shadows, no volumetric light, no depth of field`） | H3 base 的 2D 天然偏 3D | Civitai 滑块作者 + ArcLoop |

### 6.2 需要小改造（1 天内，收益最大）

| # | 改造 | 具体做法 | 风险 |
|---|---|---|---|
| 1 | **给图像路径加"风格句注入"** | 复用 `host/bridge/prompt/styles.js` 的 `STYLE_PRESETS[i].en` **整串**（不缩写、不截断——和视频侧同一条理由：约束句在末尾），拼到 prompt 最前或最后一小段；新增 `styleId` / `styleEn` 两个可选参数给 `studio_image` | 低。注意：**11 条风格串里有 6 条自带 `NO subtitles, NO on-screen text…`**，在图像侧这是**正面可用的**（与视频的"压制行"逻辑不同），但仍建议在图像侧统一用短句 `The image contains no text…` 的表达，避免长压制串占 token |
| 2 | **把"风格句 vs 参考图"的冲突做成告警** | 有 `refImages` 且同时给了 style → 提示"风格词可能与参考图竞争，建议只保留参考图"（官方提醒过"堆叠风格词会与参考素材互相竞争"） | 低 |
| 3 | **补一个"图像提示词 lint"**（对齐视频侧 `lint.js`） | 检查：正文是否英文（引号内中文除外）、是否含 `premium/cinematic/8k/masterpiece` 这类空词、是否给了光源方向与镜头、是否引用了不存在的 `<Picture N>`、是否超过 4096 字符、**是否把视频侧的"不要 XX"误改成正向**（图像侧不该改） | 低 |
| 4 | **补一个 4096 字符的"预算提示"** | 我们的上限是**字符**，官方是 **token**。中文/长英文单词的 token 密度不同 → 4096 字符其实**远不到** 4096 token，**上限比官方更紧**。建议在 UI 上显示"约多少 token"，并明确"我们比官方紧，不是模型更紧" | 低（纯文案） |
| 5 | **把"短提示词 → 长描述"做成一键** | 用现有 agent（或用户自己的 LLM）+ **官方 `prompt/t2i/task_prompt.txt` 原文当 system prompt**（PE 规则原文，许可证允许阅读/遵循），产出 `expanded_caption` 后交给用户确认再提交 | 中：若用外部 LLM 需处理 API key / 速率；建议先做成"给用户一段可粘贴的模板" |

### 6.3 需要较大改造（评估后再做）

| # | 方向 | 值不值 |
|---|---|---|
| 1 | **部署真 PE**（或接 `h3_image_context_ir`） | **暂不建议**。19GiB 显存 + 与 21GB DiT 抢卡；且我们已有编译器路线能覆盖 80% 收益。若未来做"C 端一键出图"，再考虑 |
| 2 | **本地 image prompt upsampler 节点**（照抄 ComfyUI 模板的 `TextGenerateV2` + 9B W4A8） | **值得评估**。好处是"提示词在 ComfyUI 内部闭环"，坏处是 **6.4GB 的 upsampler 与 20GB DiT 要轮流上卡**，实测每张多 ~7 秒（其中 2–4 秒是权重换入换出）【实测 B】。若做，必须可一键关 |
| 3 | **画风 LoRA 自产流水线** | **值得评估但不要先做**。60 张/2 分钟即可出一个风格 LoRA（Unsloth），但需要"素材采集 + 打标 + 触发词 + 分辨率权衡（1024² 最强 / 2048² 变弱）"一整条链。建议等 §6.2-1、§6.2-2 落地、确认"提示词+参考图"不够用之后再上 |
| 4 | **i2i 风格转换专用流**（参考图 → 只改画风） | **值得做**。这是 H3-Image 相对 FLUX 的强项（16 参考 + 4K 原生），且能覆盖"把已有实拍/线稿转成 11 套画风之一"这个高频需求。要点：**不接 VAE**（只走文本编码器）时"借风格不抄构图"更干净；prompt 用官方风格转换句式 `Redraw <Picture 1> as <style> … Keep the same composition, poses, outfits and colours.` |

### 6.4 明确不建议

| 不做 | 原因 |
|---|---|
| 给 H3-Image 加负面提示词通道 / 参数 | 模型侧不存在（`BasicGuider` 无 negative 分支）；API 侧 400 拒绝；**加了就是骗人** |
| 寻找 / 期待 `style` 参数 | 三层都不存在，且不是"没找到"，是**确认没有** |
| 依赖 ControlNet 做构图控制 | 社区已验证在图像 DiT 上失败（"perturbs, never steers"） |
| 链式多轮编辑做"逐步精修" | 第 3 轮起崩坏，官方/第三方一致复现 |
| 把视频侧的"正文禁负面"铁律套到图像 | 图像侧官方明确要求"把要避免的也写进正面提示词"；套错会丢能力 |

### 6.5 验收清单（图像出图前自检）

- [ ] 正文是**英文**？中文只出现在**引号内的画面文字**？
- [ ] 提示词是"**整幅图的完整描述**"，而不是一句需求？（有用途/布局/主体/动作/场景/光/相机/质感）
- [ ] 画风用的是**可见画法词**（颜色/材质/光/笔触/上色方式），而不是 `premium/cinematic/8k`？
- [ ] 2D 类画风加了"反 3D 化"约束（`flat colours, hard-edged shadows, no volumetric light, no DOF`）？
- [ ] 需要文字时，**每个字都在引号里**并给了位置/层级？不需要文字时写了 `The image contains no text, letters or numbers.`？
- [ ] 有参考图时：每张都点名了**用途**（借什么 / 不借什么），`<Picture N>` 编号 = 实际槽位？
- [ ] 用了风格 LoRA 时：强度 ≤1.0、**总强度 ≤1.5**、**prompt 里不再重复风格词**、有**触发词**？
- [ ] 总长 ≤ **4096 字符**（本项目上限，比官方 4096 token 更紧）？
- [ ] 没有把上一轮的输出当输入做链式编辑？
- [ ] **PE 状态已知**：我们的工作流没有 expander → 出问题先怪"提示词没写全"，不要怪模型？

---

## 附录 A：来源清单

**官方（MiniMax / ComfyUI）**

1. 模型卡：https://huggingface.co/MiniMaxAI/MiniMax-H3-Image
2. PE 模型卡：https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE
3. PE 文生图任务词：https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE/blob/main/prompt/t2i/task_prompt.txt
4. PE 编辑任务词：https://huggingface.co/MiniMaxAI/MiniMax-H3-Image-PE/blob/main/prompt/edit/task_prompt.txt
5. 官方 prompt-writing skill：https://github.com/MiniMax-AI/MiniMax-H3-Image/blob/main/skills/h3-image-prompt-writing/SKILL.md
6. 官方 t2i 指南：…/references/t2i-en.txt
7. 官方 edit 指南：…/references/edit-en.txt
8. 官方示例（短→长对照）：…/examples/instruction.t2i.txt、revised_prompt.t2i.txt、instruction.edit.txt、revised_prompt.edit.txt、request.t2i.json
9. 发布博文：https://www.minimax.cn/blog/minimax-h3-image ／ H3 Family：https://www.minimax.cn/blog/minimax-h3-family
10. 图片生成指南：https://platform.minimax.io/docs/guides/image-generation （中文：https://platform.minimaxi.com/docs/guides/image-generation）
11. T2I API：https://platform.minimax.io/docs/api-reference/image-generation-h3-generations
12. Edit API：https://platform.minimax.io/docs/api-reference/image-generation-h3-edits
13. Context-IR API：https://platform.minimax.io/docs/api-reference/image-generation-h3-context-ir
14. ComfyUI 教程：https://docs.comfy.org/tutorials/image/minimax/minimax-h3-image
15. ComfyUI blog：https://blog.comfy.org/p/minimax-h3-image-is-now-available
16. 节点文档：https://docs.comfy.org/built-in-nodes/MiniMaxH3ImageConditioning （Partner 节点：/MinimaxH3ImageNode）
17. 官方模板 JSON：https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_minimax_h3_image_t2i.json ／ …_edit.json
18. ComfyUI 文本编码器源码：https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/minimax.py
19. embedding 支持 PR：https://github.com/Comfy-Org/ComfyUI/pull/15697
20. 图片 LoRA 权重库：https://huggingface.co/Comfy-Org/MiniMax-H3-Image

**实测（有具体数字）**

21. 首日通宵实测（240 张，4090/SGLang）：https://aiyqx.cc/p/10801/
22. image-2 实测（50+ 张，PE 开/关，1K/2K/4K）：https://image-2.net/zh-cn/blog/minimax-h3-image-review/
23. n8n-diy 实测（ComfyUI 模板，PE 开/关，含耗时）：https://n8n-diy.com/2026/11/minimax-h3-image-prompt-upsampler.html
24. Runware prompt optimizer 对照：https://runware.ai/docs/models/minimax-h3-image/guides/prompt-optimizer

**社区 / 生态**

25. ArcLoop 动画提示词指南：https://arcloop.ai/handbook/zh-CN/minimax-h3-anime-prompt-guide
26. promptif（24 组提示词实测）：https://promptif.fr/minimax-h3-image-prompts/
27. vyrekai 提示词指南：https://huggingface.co/vyrekai/minimax-h3-image-comfyui-workflows/blob/main/MINIMAX_H3_IMAGE_PROMPT_GUIDE.md
28. sceneWorks 提示词指南：https://github.com/sceneworks/sceneworks/blob/7bf521b/apps/web/public/prompt-guides/minimax-h3-image.md
29. HF 官方讨论区（中文）：https://huggingface.co/MiniMaxAI/MiniMax-H3/discussions/32
30. Civitai（API 统计 + 多个 LoRA 页）：https://civitai.com/models/2980230 ／3054448／3059877／2952303／2930448／3060507／2884206／3025511／3017030／2925944
31. Seedreamstyle LoRA：https://huggingface.co/Nebsh/Seedreamstyle-H3-6K
32. Unsloth 微调文档：https://unsloth.ai/docs/models/minimax-h3-image/fine-tune-minimax-h3-image
33. Fizgig 支持说明：https://github.com/shootthesound/fizgig/blob/43c88d8/docs/RELEASE_NOTES_v9.6.0.md
34. Fun ControlNet 失败证据：https://huggingface.co/akhaliq/MiniMax-H3-Image-Fun-Controlnet-Union-2.0
35. HDR VAE：https://civitai.red/models/3045662
36. 单机部署服务器（含"用官方 PE 规则当 system prompt"的做法）：https://github.com/animede/minimax-h3-image-server
37. awesome H3 integrations（索引）：https://github.com/MiniMax-AI/awesome-minimax-h3-integration
38. 第三方托管 LoRA API：https://wavespeed.ai/docs/docs-api/wavespeed-ai/minimax-h3-image/text-to-image-lora ／ https://www.atlascloud.ai/zh-TW/models/minimax/h3-image-developer/edit-lora

**跨模型对照**

39. FLUX dev 蒸馏 guidance 不支持负面：https://huggingface.co/ostris/OpenFLUX.1/discussions/7
40. SD3.5（Large/Medium 真 CFG、Turbo 无 CFG）：https://github.com/sceneworks/sceneworks/blob/7bf521b/apps/web/public/prompt-guides/sd3-5.md
41. Qwen-Image 负面在 cfg>1 才有效：https://raw.githubusercontent.com/maxfridbe/nextsycl/5712730/model-cards/guides/qwen-image-2.1.md

**本仓库代码（用于现状核对）**

42. `dsh-jiuzhang-studio/host/services/h3-image.js`（`IMAGE_PROMPT_MAX_CHARS=4096`、`normalizeImagePrompt` 不做语义改写、`IMAGE_SAMPLING` 6 步 cfg1）
43. `dsh-jiuzhang-studio/host/services/h3-image-lora.js`（`h3img/` 目录约定与 5 个分类轴）
44. `dsh-jiuzhang-studio/data/workflows/h3-image.json`（11 节点、无 expander、`BasicGuider` 无 negative）
45. `dsh-jiuzhang-studio/host/bridge/prompt/styles.js`（11 画风 + 7 打光，目前只服务视频）
46. `dsh-jiuzhang-studio/host/tools.js`（`studio_image` schema，无 style 参数）

## 附录 B：本调研未找到可靠来源的问题

| # | 问题 | 状态 |
|---|---|---|
| 1 | 官方是否在任何地方**明确禁止**中文提示词（而不是"推荐英文"） | **未找到可靠来源**。只有"expects English description"的推荐性表述与讨论区非正式回答 |
| 2 | 中文 vs 英文在同一提示词上的**定量**遵循度差异 | **未找到可靠来源**（HF 讨论区原话就是"遵循度没对比测试"） |
| 3 | PE 在**图像编辑**上的完整能力 | 官方明说 **Image editing PE is still under development; this release provides its prompt only**（只放了提示词，没放权重路径的完整流程） |
| 4 | `embedding:name` 在 **H3-Image** 上是否真的生效 | **未验证**。源码上共用 tokenizer，理论可用；但官方/社区都没有图像侧的 style embedding |
| 5 | ComfyUI T2I 模板的 expander **实际默认状态** | **源码不一致，未实测确认**（见 §1.3 第 4 点） |
| 6 | H3-Image 画风 LoRA 的**质量基准**（谁是"最好用"的那个） | **未找到可靠来源**。Civitai 上多为个人上传、无统一评测；seedreamstyle 有 20 组四方对比，是目前唯一相对严谨的 |
| 7 | 官方对"H3-Image 是否支持中文画面文字"的明确说明 | 间接支持：官方 skill 说"in its own language"，官方 showcase 有中文逻辑题；但**没有专门的中文文字渲染规范** |
| 8 | 我们的 4096 **字符**上限相对官方 4096 **token** 究竟紧多少 | **未实测**。仅能定性说"中文字符 token 更密，4096 字符远不到 4096 token"（本仓库 `h3-image.js` 注释亦如此判断），需要一次 token 计数实测才能定量 |