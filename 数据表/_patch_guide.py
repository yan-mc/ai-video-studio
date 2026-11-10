# -*- coding: utf-8 -*-
"""把 h3-input(07) 的官方细节补进深度指南分节。"""
import io, os

BASE = r"F:\AI视频\研究资料\深度指南分节"

def patch(name, pairs):
    p = os.path.join(BASE, name)
    t = io.open(p, encoding="utf-8").read()
    for old, new in pairs:
        if old not in t:
            raise SystemExit("NOT FOUND in %s: %s" % (name, old[:80]))
        t = t.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8", newline="\n").write(t)
    print("patched", name, len(t))

# ---------- 02 ----------
sys_modules = """### 2.1.5 完整系统三模块：为什么"2K 要第二次生成"

H3 完整系统由三个模块串成，**"传什么"取决于你用的是哪一段**：

| 模块 | 作用 | 输入 | 输出 | 是否开源 |
|---|---|---|---|---|
| **H3-Context-IR** | 把自由形式的多模态上下文（文本+图+视频+音频）理解/补全，转成结构化中间表示（最终是一段增强后的提示词） | text/image/video/audio + duration + ratio | **只返回增强提示词**（`/v2/h3_context_ir`，`task_type=h3_context_ir`） | ❌ 仅 API |
| **H3-Base（FL2VA / Ref2VA）** | 生成 768p 视频 + 同步立体声 | FL2VA：文本 + 0/1/2 张关键帧；Ref2VA：文本 + 参考图/视频/音频 | 768p、24fps、32kHz 立体声 MP4 | ✅ 开放权重 |
| **H3-Regenerate-2K** | 用原始上下文把 768p 结果 in-context 再生成到 2K（能恢复小字与细节，不是传统超分） | 源视频（`role=base_video`，必须带音轨）+ **当初生成它的全部输入（含最终提示词）** + `resolution=2K`；或 `source_task_id`（白名单） | 2K 视频 | ❌ 仅 API（`/v2/video_regeneration`） |

**含义**：① 本地部署只能做 768p；② 2K 必须把本地/API 的 768p 结果连同**最终提示词与素材**一起回传官方 API 再生成，**所以 `prompt_final.txt` 与素材哈希必须存档**；③ 再生成源视频有硬规格：带音轨、24fps、宽高 32 的倍数、面积在 768×768 与 768×1344 之间、总帧数 107—362 且为 17 的步进。

**官方 API 档位**（决定你能不能 2K、多长）：`MiniMax-H3`（768P/2K、4—15s、支持 2K 与再生成）> `MiniMax-H3-Max`（480/768P、**5—15s**、开放 `extra.prompt_expansion_mode`）> `MiniMax-H3-Highspeed`（480/768P、质量/速度折中）> `MiniMax-H3-Lite`（480/768P、参考模式不支持 adaptive 比例）。注意：API 档 `H3-Max` 与 fal 后训练的"H3 Max"（榜单/平台产品）**不是同一物**，引用时别混。

## 2.2 素材规格与上限（Ref2VA 最常被问）"""

patch("02-H3输入与素材.md", [
    ("## 2.2 素材规格与上限（Ref2VA 最常被问）", sys_modules),
    ("| 2K | **开源 H3-Base 不支持**；官方 `H3-Regenerate-2K` 未开源，需 MiniMax 平台 `/v2/video_regeneration` 接口 | 本地路线靠超分（SeedVR2/FlashVSR/视频增强软件） |",
     "| 2K | **开源 H3-Base 不支持**；官方 `H3-Regenerate-2K` 未开源，需 MiniMax 平台 `/v2/video_regeneration` 接口 | 本地路线靠超分（SeedVR2/FlashVSR/视频增强软件） |\n\n**官方 API 的文件级限制**（容易踩、务必核对）：图片 ≤30MB/张、边长 256—5760、比例 0.4—2.5；参考视频 ≤50MB、MP4/MOV、H.264/H.265 + AAC/MP3、23.976—60fps；参考音频 ≤15MB、WAV/MP3；整个请求体 ≤64MB（Base64 会膨胀约 33%，大文件用公网 URL）。"),
    ("- 对白/演唱：按首次发声顺序给稳定 ID `(S1)`、`(S2)`，原话放在 `<d>[Chinese] 原话</d>` 内，不翻译不改写；画外音写 `says in an off-screen voiceover` 并说明画面人物嘴唇闭合；跨切镜用 `<scenetrans>`，截断用 `<cutoff>`；画面可见文字用英文双引号逐字保留。",
     "- 对白/演唱：按首次发声顺序给稳定 ID `(S1)`、`(S2)`，原话放在 `<d>[Chinese] 原话</d>` 内，不翻译不改写；画外音写 `says in an off-screen voiceover` 并说明画面人物嘴唇闭合；跨切镜用 `<scenetrans>`，截断用 `<cutoff>`；画面可见文字用英文双引号逐字保留。\n\n**H3 没有负向提示词**：官方 ComfyUI 模板走 `BasicGuider`、CFG 实际为 1，没有负向通道。「不要出现 X」必须改写成**正向约束或场景状态封口**（例如把「不要穿红衣服」写成「穿着深灰色外套」）。"),
    ("> **注意**：H3 原生 API 不吃\"相机参数/深度图\"这类结构化控制；深度/姿态控制要经过 **ComfyUI Fun ControlNet Union**，也就是\"软件层把 Blender 序列渲染成控制视频，再喂给 H3\"。这是本地制作软件最该做的一层适配。",
     "> **注意一**：H3 原生 API 不吃\"相机参数/深度图\"这类结构化控制；深度/姿态控制要经过 **ComfyUI Fun ControlNet Union 2.0**（8 种条件），也就是\"软件层把 Blender 序列渲染成控制视频，再喂给 H3\"。这是本地制作软件最该做的一层适配。\n\n> **注意二（反直觉）**：**角色设定图不要直接塞一张 3×3 网格三视图**。H3 参考图短边最多按 2048px 处理，一张 3×3 网格摊薄后每格仅约 680px，且框线会干扰；社区实测 2—4 张独立的高分辨率单图（正面/四分之三/侧面/服装细节）身份保真度明显更好。"),
    ("### 2.6.2 Fun ControlNet Union：Canny / Depth / HED / MLSD / Pose + 局部重绘\n\n官方教程（ComfyUI 0.35.0+）明确：`alibaba-pai/MiniMax-H3-Fun-Controlnet-Union` 是单一 checkpoint，可对 H3 施加：\n\n- **Canny/Depth/HED/MLSD/Pose 控制视频**（用 Blender 渲染的深度/线稿/姿态序列直接控制生成）；",
     "### 2.6.2 Fun ControlNet Union 2.0：8 种条件 + 局部重绘\n\n官方教程（ComfyUI 0.35.0+）明确：`alibaba-pai/MiniMax-H3-Fun-Controlnet-Union`（2.0，约 13.5GB）是单一 checkpoint，可对 H3 施加：\n\n- **8 种条件控制视频**：Canny / Depth / HED / MLSD / Pose / Scribble / Layout / Gray（Blender 可渲 depth/canny/pose/灰度/布局，直接控制生成结构）；"),
    ("| 许可 | 排除美/欧/英/韩；>$2,000 万营收需授权；须标注模型名 | 中国大陆自用/商用合规核对；出海需单独授权 |",
     "| 许可 | 排除美/欧/英/韩；>$2,000 万营收需授权；须标注模型名 | 中国大陆自用/商用合规核对；出海需单独授权 |\n| 关键帧数量 | 官方 API 只支持首/尾 **2 张** | 需要 3 个以上中间锚点 → 本地 `MiniMaxH3AddGuide` 多锚点串联，或拆镜头 |\n| 负向提示/CFG | 无负向提示词、CFG=1 | \"不要\"改写为正向约束；靠提示词与素材控制 |\n| 相机参数 | 无焦段/位移/轨迹数值接口 | 写运镜词 + 参考视频 + 视差描述；Blender 相机参数只能转成控制视频/首尾帧 |\n| 法线/分割 | 8 种 ControlNet 条件里**无法线**；分割只能用 Layout 近似 | 法线图只做后期对照；分割用色块布局或 mask |"),
    ("- [ ] 授权：真人肖像/声音有书面授权；IP/角色不侵权；发布时加 AI 标识。\n\n---",
     "- [ ] 授权：真人肖像/声音有书面授权；IP/角色不侵权；发布时加 AI 标识。\n\n## 2.9 三条出片路线（按预算/精度选）\n\n| 路线 | 做法 | 适合 | 分辨率/成本 |\n|---|---|---|---|\n| **A. 首尾帧（快、纯 API 也可）** | Blender 渲首帧+尾帧 → FL2VA；提示词写清中间变化 | 构图已由 3D 锁死的镜头、对话/过场 | 768p；2K 走官方再生成 |\n| **B. 参考一致性（对白/演唱/多主体）** | 2—4 张独立角色图 + 场景图 + 音色 + 限权运镜视频 → Ref2VA | 角色戏、演唱、多镜头叙事 | 768p；2K 走官方再生成 |\n| **C. 结构硬控（本地）** | Blender depth/pose/canny 序列 → Fun ControlNet 2.0 + 首帧/参考图 | 强运镜、复杂调度、与 3D 场景严格对齐 | 本地 768p，后期超分或 API 2K |\n\n> 三条路线**不要混在同一次请求里**（首尾帧与参考模式互斥）；一个项目可以按镜头分别选 A/B/C。\n\n---"),
])

# ---------- 01 ----------
patch("01-模型输入总表.md", [
    ("I2VA（首）、L2VA（尾）、FL2VA（首+尾）",
     "I2VA（首）、L2VA（尾）、FL2VA（首+尾）；**官方 API 最多 2 张，多锚点仅本地 AddGuide**"),
    ("**ComfyUI Fun ControlNet Union**：Canny/Depth/HED/MLSD/Pose 控制视频 + mask inpaint；`MiniMaxH3AddGuide` 任意帧锚点",
     "**ComfyUI Fun ControlNet Union 2.0**：8 种条件（Canny/Depth/HED/MLSD/Pose/Scribble/Layout/Gray）+ mask inpaint；`MiniMaxH3AddGuide` 任意帧锚点（本地）"),
    ("6. **分辨率决定后期链路**：H3-Base 768p、Wan 2.2 720p、Seedance/Kling 1080p+、LTX-2.5 4K。**本地 H3 路线必须配超分（SeedVR2/FlashVSR/视频增强软件）**，否则交付分辨率不够。",
     "6. **分辨率决定后期链路**：H3-Base 768p、Wan 2.2 720p、Seedance/Kling 1080p+、LTX-2.5 4K。**本地 H3 路线必须配超分（SeedVR2/FlashVSR/视频增强软件）**，否则交付分辨率不够。\n7. **\"白模/灰模参考\"只有 Seedance 2.5 官方原生支持**；H3 要靠 ComfyUI ControlNet 的 Gray/Layout/Depth 近似，Kling 用关键帧，Wan 3.0 用多模态素材。做 Blender 预演强控制时，这是选型的关键差异。\n8. **渠道状态要单独核对**：Veo 3.1 在 Gemini API 的 Preview 渠道据官方文档已于 2026-10-22 关停，迁移方向是 Gemini Omni 1.1 Flash 或 Vertex/企业平台 GA；表中能力仍以官方模型卡为准，但\"能否调用\"要看你走哪个渠道 ⚠️。"),
])

# ---------- 03 ----------
patch("03-Blender预演接法.md", [
    ("| **法线/分割/HED/MLSD** | 渲染通道或预处理模型 | 表面朝向、材质区域、直线结构 | H3 Fun ControlNet 支持 HED/MLSD；Wan/其他 ControlNet |",
     "| **HED/MLSD/灰度/布局** | 预处理模型或渲染通道 | 软边缘、直线结构、明暗布局 | H3 Fun ControlNet 2.0 支持（HED/MLSD/Gray/Layout）；Wan VACE 近似 |\n| **法线图** | 渲染 Normal pass | 表面朝向 | ❌ H3 的 8 种条件里**没有法线**；只能做后期对照，不能当输入 |\n| **分割图/实例掩码** | 渲染 Object/Mat ID 或分割模型 | 物体区域 | ⚠️ H3 无原生分割条件；用 Layout 色块或 mask 局部重绘近似 |"),
    ("- Blender 渲染 **depth/canny/pose 序列**（与目标时长对齐，24fps），作为 `control_video` 喂给 H3 Fun ControlNet Union（或 Wan VACE）；",
     "- Blender 渲染 **depth/canny/pose/灰度/布局序列**（与目标时长对齐，24fps），作为 `control_video` 喂给 H3 Fun ControlNet Union 2.0（8 种条件，约 13.5GB；或 Wan VACE）；"),
    ("| Blender 学习成本 | 机位/走位/渲染需要 3D 基础 | 用预设机位模板（如预演软件的 26 个机位）、低模素材库、Mixamo 动作 |",
     "| Blender 学习成本 | 机位/走位/渲染需要 3D 基础 | 用预设机位模板（如预演软件的 26 个机位）、低模素材库、Mixamo 动作 |\n| **白模不是 H3 原生输入** | H3 官方 API 没有 depth/pose/白模通道，只有本地 ControlNet 曲线 | 用 Gray/Layout/Depth/Canny/Pose 控制；若强依赖\"白模直出\"，考虑 Seedance 2.5（唯一官方原生支持白模参考） |"),
])

# ---------- 04 ----------
api_note = """**官方 API 还有 4 个视频档位**（决定你能不能 2K、最长多少）：`MiniMax-H3`（768P/2K、4—15s、支持 2K 与再生成）、`MiniMax-H3-Max`（480/768P、5—15s、开放 prompt 扩写模式）、`MiniMax-H3-Highspeed`（480/768P）、`MiniMax-H3-Lite`（480/768P）。**API 的 H3-Max 与 fal 后训练的\"H3 Max\"不是同一物**。

> **建议**：个人先走 **ComfyUI**；要"软件化"就把 ComfyUI 包一层 HTTP（或直接用 SGLang 若有多卡）；要训练角色 LoRA 用 **DiffSynth**。**不要一上来就追 8×B200**——那是"服务一个团队/对外提供 API"的配置，不是 C 端个人配置。"""

patch("04-H3部署.md", [
    ("> **建议**：个人先走 **ComfyUI**；要\"软件化\"就把 ComfyUI 包一层 HTTP（或直接用 SGLang 若有多卡）；要训练角色 LoRA 用 **DiffSynth**。**不要一上来就追 8×B200**——那是\"服务一个团队/对外提供 API\"的配置，不是 C 端个人配置。",
     api_note),
    ("| Fun ControlNet（可选） | `alibaba-pai/MiniMax-H3-Fun-Controlnet-Union` | 按模板放置 |",
     "| Fun ControlNet（可选） | `alibaba-pai/MiniMax-H3-Fun-Controlnet-Union`（2.0，约 13.5GB） | 按模板放置 |\n\n**模型文件体积参考**（官方/Comfy-Org 口径）：FL2VA 与 Ref2VA 各约 **19.53GB**、Qwen3-VL 文本编码器约 **14.61GB（NVFP4）**、视频 VAE 约 2.62GB、音频 VAE 约 0.58GB——**预留 60GB+ 磁盘**（含缓存与输出）。**6 个官方模板**：T2V / I2V / I2V-continuation / R2V / Multiframe-reference / Fun-ControlNet-Union。"),
    ("9. **高级**：`MiniMaxH3AddGuide` 任意帧锚点；latent noise mask 做局部重绘/延长。",
     "9. **高级**：`MiniMaxH3AddGuide` 任意帧锚点；latent noise mask 做局部重绘/延长。\n10. **参考图缩放策略**：`ref_image_size` 可选 `match`（匹配画布）或 `max`（短边 2048，保细节）；角色特写/商品细节建议 `max`。\n11. **采样基线**：FL2VA 20 步（或 8 步 Turbo）、Ref2VA 20 步（或 4 步 Turbo）；CFG=1、`res_multistep`、shift video 12 / audio 3；参考密集时可换 beta/normal 调度器。"),
    ("### 4.3.3 制作软件如何调用 ComfyUI",
     """### 4.3.3 制作软件如何调用 ComfyUI"""),
    ("- **不要直接暴露 ComfyUI 到公网**（无鉴权）。\n\n## 4.4 路线二",
     """- **不要直接暴露 ComfyUI 到公网**（无鉴权）。

### 4.3.4 2K 再生成（只有官方 API 能做）

- 接口：`POST /v2/video_regeneration`；输入源视频必须是 H3 768P 输出规格（**带音轨、24fps、宽高 32 倍数、面积 768×768 — 768×1344、帧数 107—362 且为 17 步进**）；
- 必须原样带上当初生成它的全部输入（**含最终提示词**）或 `source_task_id`（白名单）；
- 再生成接口 prompt 上限放宽到 **40,000 字符**，但必须是真正送入模型的最终提示词（不是用户原始话术）；
- **本地工作流的正确姿势**：本地批量出 768p → 人工筛选 → 只把选中的镜头回传 2K 再生成（成本按需）；`prompt_final.txt` 与素材哈希务必存档。

## 4.4 路线二"""),
])
print("done")
