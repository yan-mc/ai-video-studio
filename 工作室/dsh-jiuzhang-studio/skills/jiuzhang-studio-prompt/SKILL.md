---
name: jiuzhang-studio-prompt
description: H3 与 Seedance 的提示词书写规范，含 9 种画风库、5 种生成模式的完整模板、三字段音效、镜头/运镜/预演控制写法。当需要为视频生成、图像生成、立绘拆解、漫画分格、模特套件编写提示词时使用。
---

# 提示词书写规范（H3 / Seedance / H3-Image）

> 本 skill 是写提示词的唯一依据。插件 `studio_prompt` 工具与 `/prompt/*` 路由都按此规范实现。
> 核心原则：**画风用英文，其余全中文**。

---

## 0. 五条铁律

| # | 规则 | 原因 |
|---|---|---|
| 1 | **画风描述必须用英文** | 视觉模型对英文风格关键词响应更精准 |
| 2 | 其余全部中文（角色/规则/分镜/对白） | 中文描述更精确，且模型原生支持 |
| 3 | **音色只绑定一次**（CHARACTER DEFINITION 里） | 分镜里重复写会干扰 |
| 4 | **三字段音效不能空** | overall_soundscape / non_diegetic_music / 每段音效 |
| 5 | **无负面提示词** | H3-Image 不支持；H3 用正向约束表达 |

---

## 1. 五种生成模式

| 模式 | 输入 | 说明 |
|---|---|---|
| **T2VA** | 纯文本 | 文生视频 |
| **I2VA** | 1 张图（首帧） | 从首帧向前发展 |
| **FL2VA** | 0-2 张图 | 0=文生，1=首帧/尾帧，2=首尾帧控制 |
| **L2VA** | 1 张图（尾帧） | 推断开头，收敛到给定尾帧 |
| **Ref2VA** | 图≤9 + 视频≤3 + 音频≤3 | 全参考，**结构最完整** |

**选择建议**：
- 有角色立绘/角色卡 → **Ref2VA**（角色一致性最好）
- 只有首帧构图 → I2VA
- 需要精确起止画面 → FL2VA
- 纯创意 → T2VA

---

## 2. 画风库（9 种，英文原文）

### 2.1 地狱把妹王（外观版）
```
Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cartoon character design — slightly larger head, slender limbs, flat torso, simplified geometric shapes. Thick jagged black outlines. Flat cel-shaded coloring with block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. NO photorealistic textures, NO realistic skin shading, NO 3D proportions, NO PBR materials. NO subtitles, NO on-screen text.
```
禁止词：`写实质感、写实皮肤阴影、3D比例、PBR材质、渐变、柔光、模糊、照片级渲染`
**会改变人物比例** · 适用：暗黑戏剧、暴力动作、冲击力亮相

### 2.2 地狱把妹王（画风版）
```
Helltaker rendering style. High contrast black/white/deep red color palette. Flat cel-shaded coloring with block shadows, no gradients. Thick jagged black outlines. Render characters as 2D cartoons, NOT realistic. CRITICAL: Keep original character proportions unchanged. DO NOT exaggerate head size or limb length.
```
禁止词：`写实质感、写实皮肤阴影、PBR材质、渐变、柔光、比例改变、头部放大、四肢拉长`
**保持原比例** · 适用：需要 Helltaker 光影但角色比例不变

### 2.3 90年代OVA风
```
90s OVA animation style. Cel animation look. High saturation colors. Hard shadows (not block shadows). Film grain texture. Natural human proportions. Soft gradient blush. Thick but not jagged outlines. 4K.
```
禁止词：`写实质感、实拍质感、3D比例、粗黑锯齿轮廓、块状阴影`
适用：怀旧日常、喜剧、情感戏

### 2.4 新海诚风
```
Makoto Shinkai animation style. Soft atmospheric lighting. Shallow depth of field with bokeh background. Pale blue sky with translucent clouds. Lens flare. Water reflections. Natural human proportions. 4K.
```
禁止词：`硬阴影、粗黑轮廓、高对比、块状阴影、赛璐珞质感、胶片颗粒`
适用：治愈系、都市夜景、梦幻场景

### 2.5 吉卜力风
```
Studio Ghibli animation style. Warm atmospheric lighting. Hand-painted watercolor texture. Soft organic lines on buildings and trees. Natural light without overexposure. Warm color palette, moderate saturation. Natural proportions. 4K.
```
禁止词：`硬阴影、高对比、冷色过蓝、过曝、写实质感、数码感`
适用：田园、异世界、奇幻冒险

### 2.6 经典美式卡通
```
Classic American cartoon style. Even outlines (no jagged lines). Squash-and-stretch deformation. Flat fill colors. Minimal shadows. Bright saturated color palette. 2D flat animation.
```
禁止词：`锯齿状轮廓、日式腮红、胶片颗粒、赛璐珞质感、高对比阴影`
**会改变人物比例** · 适用：喜剧、合家欢、夸张搞笑

### 2.7 飞碟社风
```
Ufotable animation style. Digital painting with high contrast cinematography. Photorealistic detailed backgrounds. 2D cel-shaded characters with large hard shadows. Dramatic lighting. Particle effects. Deep color palette with lower saturation. 4K.
```
禁止词：`粗黑轮廓线、平涂无阴影、低对比、浅景深虚化、柔光、水彩质感`
适用：热血战斗、奇幻史诗、特效炫酷

### 2.8 三渲二 + PBR 混合
```
3D cel-shaded animation with PBR rendering. Thin dark outlines (not thick hand-drawn lines). Subsurface scattering on skin — soft, translucent, delicate. Soft studio lighting. Smooth shadow transitions, soft diffused shadows. Realistic fabric textures with wrinkles and bump. 3D physical hair strands with clear groups. Clean render, smooth surfaces.
```
禁止词：`粗黑手绘轮廓线、纯平涂赛璐珞、硬块状阴影、写实人类皮肤质感`
适用：3D VTuber、偶像演出、现代都市

### 2.9 GoHands 风
```
GoHands-inspired aesthetic, high-saturation color palette, strong urban contrast, sharp highlights on hair and glass, vibrant sky gradients, modern sleek anime lines.
```
禁止词：`低饱和、柔光、胶片颗粒、粗黑轮廓`
适用：现代都市、街头、强光影

### 画风选择决策树

```
参考图是什么类型？
├─ 已经是 2D 动画/卡通
│  ├─ 想保留原外观 → 用「画风版」（只改光影/色调）
│  └─ 想改成另一种卡通 → 用「外观版」（改比例/轮廓）
└─ 是 3D 模型/真人照片/写实图
   └─ 需要强制转 2D → 用「外观版」+ Render as 2D cartoon, NOT realistic
```

---

## 3. Ref2VA 六段式（完整模板）

```text
CRITICAL STYLE RULE:
[英文画风描述]
禁止：[中文禁止词]。
NO subtitles, NO on-screen text.

CRITICAL REFERENCE RULE:
- <Picture 1> 是 [角色名] 的外观参考 — 面部、发型、服装全部保持一致。
- <Picture 2> 是 [角色名] 的外观参考。
- <Video 1> 是动作与运镜参考 ONLY — 仅用于动作路径和镜头运动，不复制角色外观或场景。
- <Audio 1> 是 [角色名] 的声音参考 — [音色描述]，仅用于音色。

subject_definitions:
[角色名] = 外观来自 <Picture 1> — [发色、发型、瞳色、服装、配饰、身高]。此角色为说话人 (S1)。
[角色名] = 外观来自 <Picture 2> — [...]. 此角色为说话人 (S2)。

CHARACTER DEFINITION — [角色名] (S1):
- 性别：FEMALE
- 身高：[数字]cm
- 关键特征：[发色、瞳色、配饰]
- 性格：[性格]
- 声音：锁定 <Audio 1>，[音色描述]

CHARACTER DEFINITION — [角色名] (S2):
[...]

summary:
[一句话概括视频内容]

retention_analysis:
[角色A]（出现在 <Picture 1>）：fully_preserved — 保持 [特征] 一致。
[角色B]（出现在 <Picture 2>）：fully_preserved — 保持 [特征] 一致。
<Video 1>：attribute_transfer — 仅迁移动作与运镜。
<Audio 1>：reference — 仅跟随音色与语气。

non_diegetic_music: N/A 或 [时间段] [音乐描述]

SCENE LAYOUT:
[地点、空间布局、光线色调、角色站位]
[如首尾帧：起始画面 → 结束画面]

overall_soundscape: [1-4 句环境声/动作声/非语言人声，不能空]

MOTION DESCRIPTION:
[0.0s-2.5s] [景别]。[动作描述] 运镜：[运镜]。
音效：[环境音]（叙事内）。
音效：(S1) —— <d>[中文] 台词内容</d>（情绪）。
[2.5s-5.0s] [...]
```

### 结构铁律

| 字段 | 必须写 | 不要写 |
|---|---|---|
| `subject_definitions` | 外观一次性绑定 + 显式特征 | 分镜里反复提 `<Picture X>` |
| `CHARACTER DEFINITION` | 性别/身高/特征/性格/音色 | 重复外观描述 |
| 分镜 | 直接写人名 | `<Picture X>` + 外观特征 |
| `SCENE LAYOUT` | 集中写空间布局 | 分散在各时间段 |
| 参考视频 | 明确用途声明 | 不声明（模型会照抄视频角色） |
| 首尾帧 | 明确 START/END 标注 | 不标注 |

---

## 4. T2VA 三段式

```text
CRITICAL STYLE RULE:
[英文画风]

integrated_multimodal_description:
[Shot 1] [风格/介质/光线/色调]，[景别] frames [主体]，[主体外观与动作]。The camera [运镜类型+幅度+速度] toward [目标]。At 00:0X.XXX, [切镜/事件]。[角色] (S1) says: <d>[中文] [台词]</d>。

overall_soundscape: [1-4 句环境声/动作声]

non_diegetic_music: [1-3 句配乐；无则 N/A]
```

---

## 5. 关键帧模式（I2VA / FL2VA / L2VA）

```text
# FL2VA
How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture 2 (from [Shot 1]) aligns with the [S.SS]-second mark of the target video.

integrated_multimodal_description:
[Shot 1] [首帧状态] → [可观察的中间变化] → [逐步缩小差异] → [尾帧状态]。The camera [运镜]。[角色] (S1) says: <d>[中文] [台词]</d>。

overall_soundscape: [...]

non_diegetic_music: N/A
```

- I2VA 只写 Picture 1 对齐 0.00 秒
- L2VA 只写 Picture 1 对齐结尾实际时长
- `S.SS` 必须是后端实际有效时长（按 17k+5 帧网格换算，保留两位小数）

### 首尾帧注意事项

| 要点 | 说明 |
|---|---|
| 首尾帧图不要含字幕/文字 | 会干扰生成 |
| 首尾帧宽高比必须一致 | 确保画面平滑过渡 |
| 分镜聚焦"演变" | 描述从首帧→中段→尾帧的动态变化 |
| 首尾帧仅提供构图 | 角色外观仍由 `subject_definitions` 锁定 |

---

## 6. 音效三字段

| 字段 | 内容 | 位置 |
|---|---|---|
| `overall_soundscape` | 画内音：环境音、脚步声、引擎声 | 顶层字段 |
| `non_diegetic_music` | 画外音/配乐：N/A 或描述 | 顶层字段 |
| `音效：` | 每段分镜的同步音效和台词 | MOTION DESCRIPTION 内 |

**标准写法**
```text
non_diegetic_music: N/A
non_diegetic_music: [0s-5s] soft piano melody, melancholic mood
音效：distant applause echoes faintly, a drum cymbal vibrates softly. (Diegetic)
```

### 台词规范

| 要素 | 规范 |
|---|---|
| 说话人标识 | `(S1)` `(S2)`，按出场顺序分配 |
| 对话标签 | `<d>` 包裹 |
| 语言标注 | `<d>[中文]` `<d>[日语]` `<d>[English]` |
| 位置 | 写在 `音效：` 字段中 |

```text
音效：(S1) —— <d>[中文] 我明白了。</d>（语气从慌乱中恢复平静）
```

**音色不在分镜重复**——已在 CHARACTER DEFINITION 绑定。

---

## 7. 视频参考的四种用途

```text
# 续篇（最常用）
- <Video 1> 是**上一段视频**——本次生成 <Video 1> 的续篇

# 仅动作/运镜参考
- <Video 1> 是动作和运镜参考 ONLY — 仅用于动作路径和镜头运动，不复制角色外观或场景

# 仅节奏参考
- <Video 1> 是剪辑节奏参考 ONLY — 仅用于切镜时机和叙事节奏，不复制内容

# 仅氛围参考
- <Video 1> 是氛围与光线参考 ONLY — 仅用于气氛，不用于角色设计
```

**输入限制**：≤3 段，每段 2-15 秒，单段 ≤50MB，H.264/H.265

**⚠️ 合计时长硬限制**：参考视频 + 参考音频的**总时长 ≤ 14.8 秒**。超限时后端会自动裁剪（先砍音频、再砍视频）并写入 warnings。这是 H3 的参考输入共用时间预算，15 秒是理论边界，14.8 是留了测量误差余量的实用值。

---

## 7.5 四类参考的编号规则（最容易错的地方）

H3 的 Ref2VA 有**四类**参考输入，编号规则各不相同：

| 输入 | 类型 | 前缀 | 上限 | 提示词标签 |
|---|---|---|---|---|
| `ref_images` | IMAGE | `ref_image_` | 9 | `<Picture i>` |
| `ref_videos` | IMAGE（**帧序列**） | `ref_video_` | 3 | `<Video k>` |
| `ref_video_audios` | AUDIO | `ref_video_audio_` | 3 | `<Audio j>` |
| `ref_audios` | AUDIO | `ref_audio_` | 3 | `<Audio j>` |

### `<Picture>` / `<Video>` 按各自类型独立累加

```
第 1 张图 → <Picture 1>
第 2 张图 → <Picture 2>
第 1 段视频 → <Video 1>       ← 视频从 1 开始，不与图片混号
```

### `<Audio>` 是全局累加，视频音轨会先占号 ★

这是最容易算错的一点。**视频自带的音轨也算一个 `<Audio>`。**

实例：1 段带音轨的参考视频 + 1 段独立音频

```
<Picture 1>   ← 第 1 张图
<Audio 1>     ← 视频的音轨        ← 注意！它占了 Audio 1
<Video 1>     ← 第 1 段视频
<Audio 2>     ← 独立音频           ← 不是 Audio 1！
```

**如果按「独立音频 = Audio 1」去写提示词，模型指向的音源就全错了。**

### 编号不要自己推

调 `/render/plan` 或 `POST /render/compile`，后端会返回真实编号
（`images[].index`、`videos[].index`、`videos[].audioIndex`、`audios[].audioIndex`），
直接拿来写提示词。

前端渲染页左栏显示的 `P1/P2/V1` 就是这个编号。

### 视频与其音轨必须同号

`ref_video_3` 的音轨必须是 `ref_video_audio_3`（源码按编号配对，不按数组顺序）。
**没有音轨的视频不要接 `ref_video_audios`** —— 会收到"有音轨但内容是空"，效果比不接更差，
而且不报错。这一条要靠 ffprobe 探测，不能默认 `true`。

---

## 7.6 控制视频（Blender 白模）的提示词写法 ★

控制视频改变了提示词的作用方式：**结构由控制视频决定，提示词只负责"这是什么"**。

### 铁律：提示词必须描述画面里**真实存在**的东西

| 控制视频里有 | 提示词该写 | 提示词**不该**写 |
|---|---|---|
| 两个人 | 「两位少女」 | 「一个少女」（会硬塞一个人进画面） |
| 一张长椅 | 「木制长椅」 | 「沙发」「石台」 |
| 相机在人物前方 | 「正面视角」 | 「俯拍」 |
| 人物在走 | 「并肩漫步」 | 「静止站立」 |

**实测事故**：控制视频里是两人站立，提示词写了「一个金发少女」，
结果前 2 秒画面被提示词抢走，后半段才回到控制视频的构图。

### 推荐结构（控制视频模式）

```
[英文画风] + [场景/时间/光线] + [人数与角色身份] + [正在做什么] + [主要道具] + [机位方向]
```

示例（三段白模 → 成片）：

```
# 镜1（控制里有：两人从两侧走向长椅）
90s OVA animation style, cel animation look, high saturation. 
黄昏海滩，两位少女（金发礼帽、紫发羊角）从画面两侧并肩走向中间的一张木制长椅，
海浪在背景，暖色逆光，电影感构图。

# 镜2（控制里有：两人坐在长椅上）
...两位少女并肩坐在木制长椅上，面朝大海，肩膀自然靠在一起...

# 镜3（控制里有：两人相向倾身）
...两位少女坐在长椅上，相向倾身，脸贴近，闭上眼，就要亲吻，暖色逆光，特写。
```

### 控制强度与提示词自由度的权衡

| strength | 效果 | 提示词空间 |
|---|---|---|
| 0.6—1.0 | 柔和引导，模型仍有较大自由 | 大（但可能不跟构图） |
| **1.0—1.5** | **推荐区间**，结构与生成自由度平衡 | 中 |
| 1.5—2.5 | 强约束，画面容易发僵 | 小 |

`start_percent` / `end_percent` 控制生效区间：
默认 `0.0 → 0.85`，即前 85% 去噪步受控，尾部留给模型补细节。
画面发僵就缩短区间（如 `0.0 → 0.7`）。

### 控制视频 vs 参考视频（别混）

| | 参考视频 `ref_videos` | **控制视频 `control`** |
|---|---|---|
| 机制 | 语义参考（模型"看"过） | **逐帧结构约束**（ControlNet） |
| 会不会跟着走 | **不保证** | **会** |
| 输入 | IMAGE 帧序列 | IMAGE 帧序列（`GetVideoComponents` 拆出来） |
| 提示词影响 | 大 | 小（结构已定） |
| 耗时 | 基准 | **+80%** |

> 要"锁定构图/走位/时间点"用控制视频；要"给个风格/运镜参考"用参考视频。

---

## 8. 分镜设计规则

### 时长分配

| 总时长 | 推荐段数 | 每段时长 | 风险 |
|---|---|---|---|
| 4-5 秒 | 2 段 | 2-2.5 秒 | 低 |
| 6-7 秒 | 2-3 段 | 2-3 秒 | 低 |
| 8-10 秒 | 3-4 段 | 2.5-3 秒 | 中 |
| 11-13 秒 | 4 段 | 2.5-3.5 秒 | 高 |
| 14-15 秒 | 5 段 | 2.8-3 秒 | **极高，易崩溃** |

### 景别交替
```
全景 → 中景 → 特写 → 中景 → 远景
```

### 动作密度
| 复杂度 | 安全时长 |
|---|---|
| 单一动作 | 2-3 秒 |
| 2 个连续动作 | 2.5-3.5 秒 |
| 3 个以上连续动作 | 3.5-4 秒（高风险，需分割） |

---

## 9. 稳定性对策

| 问题 | 对策 |
|---|---|
| 人物崩坏 | `subject_definitions` 一次绑定 + 显式写明发色瞳色 + 分镜只提人名 |
| 手部畸形 | 特写不超过 3 秒，指定具体动作 |
| 跳切后服装突变 | `subject_definitions` 锁定服装参考图 |
| 性别漂移 | `CHARACTER DEFINITION` 中声明 `性别：FEMALE/MALE` |
| 面部不一致 | 锁定面部参考图 + 显式写明关键面部特征 |
| BGM/字幕残留 | `non_diegetic_music: N/A` + `NO subtitles` |
| 写实质感残留 | `CRITICAL STYLE RULE` 明确 `Render as 2D cartoon, NOT realistic` |
| 多角色串脸 | 每个角色绑定独立图片 + 双重锁定 |
| 参考视频抢特征 | 声明 `video ONLY for motion/camera, NOT for appearance` |
| 首尾帧构图错位 | 保持宽高比一致，明确动态路径 |

---

## 10. H3-Image 专用规范

### 与视频的差异

| 项 | H3 视频 | H3-Image |
|---|---|---|
| 步数 | Turbo 4/8，非 Turbo 20 | **固定 6** |
| guidance | 1.0 | **固定 1.0** |
| 负面提示 | 用正向约束 | **不支持** |
| 提示词长度 | ≤7000 字符 | ≤4096 token |
| 参考图 | Ref2VA ≤9 | **≤16** |
| 尺寸 | 32 倍数 + 官方档位 | 32 倍数，0=自动 2048² |

### 提示词写法

H3-Image **吃长提示词**，越详细越准。结构建议：

```text
[主体描述]：谁、什么样子、什么动作、什么表情
[服装/道具]：具体到颜色、材质、纹样
[场景/环境]：地点、时间、天气、周边元素
[光线]：光源方向、强度、色温
[构图/镜头]：景别、角度、透视、景深
[风格]：英文画风关键词
[质量]：高质量，细节清晰
```

**把否定句改成正向描述**：
- ❌ "不要写实质感" → ✅ "扁平赛璐珞渲染，色块平整"
- ❌ "禁止字幕" → ✅ 省略（模型不会主动加字幕）

---

## 11. 立绘拆解（角色设定图）规范

> 术语：这个**工具**叫「立绘拆解」，产出的**图**叫设定卡（sheet）。
> 把设定卡 + 文字设定登记进「角色卡」仓库，渲染时才能引用。

### 三档结构

| 档位 | 产出 |
|---|---|
| **角色设定卡** | 三视图（正/侧/背）+ 服装部件 + 附属部件 |
| **完整设定卡** | 与 standard 同内容（表情差分自 1.0.2 起已移除，保留档位名仅为兼容） |
| **纯部件拆解** | 只拆服装与配件，平铺，无人物 |

### 拆解时的四条原则（违反会出乱码/误导）

1. **不复述图片内容** —— 参考图是**直接进模型**的（`<Picture 1>` + vision block）。
   用文字再描述一遍外观会和图像冲突，造成误导。
2. **纯文本，不产 Markdown** —— `**加粗**`、`# 标题` 会原样进模型。
3. **不用编号小标题** —— `一、二、三` 会诱导模型**在图上画标签**，
   这是实测出过"图上乱码"的直接原因。用自然段落。
4. **数量随参数** —— 选 2 个视角就写"两个"，不能硬编码"三个"。

### 三视图要求

```text
三视图
- 同一角色，发型/服装/配饰/体型完全一致
- 统一站立姿势，自然站姿，双臂自然下垂
- 统一光照、统一背景、等高等比例并排
- 全身入画，不切头不切脚

服装部件拆解
- 每件单独平铺，保持原配色/纹样/剪裁/材质
- 正面朝上、完整展开、互不遮挡
- 与三视图中的对应部位能明确对应

附属部件拆解
- 发饰/首饰/挂件/武器/披风等逐一拆出

画面整体
- 干净设定稿风格，线条清晰，色块平整
- 纯色或浅灰背景，无场景、无投影
- 不留文字、标注、水印
- 严格还原参考图，不自行改动设计
```

### 明确不包含

设定卡**只做角色形象**，不包含：
- 内衣
- 化妆品
- 随身私人物品
- 生活用品

这些与角色设定无关，会稀释提示词并干扰模型。

### 设定卡的用途

设定卡是角色的**权威形象**，在做视频时作为角色卡的 `sheet` 槽位传入，
保证多镜之间角色外观一致。**一张设定卡 = 一张合成图**（三视图 + 部件在同一张），
这样只占 1 个参考图名额（H3 Ref2VA 上限 9 张）。

### 与角色卡的配合

```
立绘 → 立绘拆解 → 设定卡图（sheet）
                     ↓
        角色卡 { images: {sheet, origin}, traits, refPolicy }
                     ↓
        渲染时按 refPolicy 决定传几张：
          sheet-first（默认，每卡 1 张，最稳）
          sheet-only
          origin-first
          both（每卡 2 张，多角色时容易超 9 张）
```

**多角色时 `maxImages: 1` 最稳** —— 两张卡就占 2 个名额，
再叠参考视频/场景图很容易撞上限。

---

## 12. 可扩展模板格式

所有提示词模板遵循以下结构，便于扩展：

```yaml
id: template-id                    # 唯一标识
name: 模板中文名
category: H3 | Image | Sheet | Comic | Ecom | Film
mode: t2va | i2va | fl2va | l2va | ref2va | image | sheet
fields:                            # 需要填的字段
  - key: styleId
    label: 画风
    type: enum
    options: [ghilla, ova90s, ...]
  - key: subjects
    label: 角色
    type: list
    item:
      - name
      - pictureIndex
      - traits
sections:                          # 提示词由哪些段组成
  - CRITICAL STYLE RULE
  - CRITICAL REFERENCE RULE
  - subject_definitions
  - CHARACTER DEFINITION
  - summary
  - retention_analysis
  - non_diegetic_music
  - SCENE LAYOUT
  - overall_soundscape
  - MOTION DESCRIPTION
output: string                     # 拼接方式
```

**扩展新模板时**：
1. 复制上面的骨架
2. 按 `mode` 决定 `sections`
3. 实现时对应 `host/services/h3-prompt.js` 的 `compileXxx()` 函数

---

## 13. 检查清单

生成前逐条核对：

- [ ] 画风是英文？
- [ ] `subject_definitions` 写全了发色/瞳色/配饰？
- [ ] 每个角色有独立的 `<Picture N>`？
- [ ] `CHARACTER DEFINITION` 里绑定了音色（如果有音频参考）？
- [ ] 分镜里只写人名，没重复 `<Picture N>`？
- [ ] 参考视频声明了用途？
- [ ] 首尾帧标了 START / END？
- [ ] `overall_soundscape` 不为空？
- [ ] `non_diegetic_music` 写了 N/A 或具体描述？
- [ ] 每段分镜都有音效？
- [ ] 台词用 `<d>[中文] ...</d>`？
- [ ] 全文 ≤7000 字符？
- [ ] 没有负面提示词（或已改成正向表达）？
- [ ] 时长在 4-15 秒？
- [ ] 参考图 ≤9（视频）/ ≤16（图像）？
- [ ] 参考文件总数 ≤12？
