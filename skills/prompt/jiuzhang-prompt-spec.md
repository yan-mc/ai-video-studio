---
name: jiuzhang-studio-prompt
description: H3 视频 / H3-Image 图像 / 立绘拆解 的提示词书写规范。这是**唯一权威**的提示词文档：给出一套模式路由器 + 两套官方格式（基础格式三字段 / Ref2VA 六段），9 种本地画风，四类参考输入的编号规则，以及官方反模式清单。当需要为视频生成、图像生成、立绘拆解、漫画分格、模特套件编写或审查提示词时使用。
---

# 提示词书写规范（H3 / H3-Image）

> 本 skill 是写提示词的**唯一依据**。插件里的 `host/services/h3-prompt.js` 就是按它实现的，
> `studio_prompt` 工具与 `/prompt/*` 路由都走那一份代码。
>
> **改动本文件时必须同步改 `h3-prompt.js`** —— 两边不一致就会出现"文档说一套、代码产另一套"，
> 这正是这个项目此前混乱的根源。

---

## 0. 先读完这四条，能避开 80% 的坑

| # | 铁律 | 为什么 |
|---|---|---|
| 1 | **正文必须英文** | 官方提示词规范是 English-only。中文只允许出现在 `<d>[Chinese] 台词</d>` 内与画面文字双引号里。中文正文效果不稳，本地还有 tokenizer 坑 |
| 2 | **不写负面提示词** | 本地 CFG 固定 1.0，采样器（`BasicGuider`）**没有 negative 分支**。写"不要 XX"反而把 XX 拉进画面。要排除就写"画面里只有…" |
| 3 | **标签必须 `<Picture 1>` 这种形式** | 尖括号 + 半角空格 + 序号。Picture / Video / Audio 三类**各自**从 1 开始编号 |
| 4 | **先算帧数再写时间戳** | 帧数在 `17k+5` 网格上（124 / 141 / … / 362）。所有时间戳必须 < `frames / 24` |

---

## 1. 核心设计：一个模式路由器 + 两套官方格式

**这不是"哪个模板对"的选择题 —— 官方本来就是两套格式，按任务模式二选一。**

```
输入里有什么？
├─ 参考视频 或 参考音频                    → 【Ref2VA 六段格式】（必须）
├─ 参考图（≥1 张，且不是首/尾帧）          → 【Ref2VA 六段格式】
├─ 首/尾帧（I2VA / FL2VA / L2VA）          → 【基础格式】+ 对齐指令
└─ 什么都没有                               → 【基础格式】+ 三字段
```

代码里对应 `h3-prompt.js` 的 `routeFormat()`。**不要在别处再判断一遍模式。**

### 两条硬性互斥

| 互斥 | 说明 |
|---|---|
| 首尾帧 ⊥ 全参考 | 官方明确 `first_frame/last_frame` 与 `ref_images/ref_videos/ref_audios` **不可同请求**。要锁关键帧请改用 Ref2VA + `MiniMaxH3AddGuide` |
| `fl2va` 权重 ⊥ `ref2va` 权重 | 两个 checkpoint 不通用。有参考素材就必须用 `ref2va` |

---

## 2. 基础格式（T2VA / I2VA / FL2VA / L2VA）

### 2.1 结构

```text
{对齐指令 —— 仅关键帧模式需要，必须是第一行，后接恰好一个空行}

integrated_multimodal_description: [Shot 1] {风格}, {景别}, {主体外观与位置}, {场景与关键道具}, {动作}. The camera {运镜}. {说话人} (S1) is visible on screen and says: <d>[Chinese] {台词}</d>

overall_soundscape: {1–4 句环境声与物理声}

non_diegetic_music: {1–3 句配乐} 或 N/A
```

### 2.2 三种对齐指令（**逐字照抄，不要"顺手统一"**）

官方原文三种句式并不一致 —— I2VA 带尖括号、FL2VA 不带。这是原文如此，照抄。

| 模式 | 第一行 |
|---|---|
| **I2VA** | `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.` |
| **FL2VA** | `How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture 2 (from [Shot 1]) aligns with the {S.SS}-second mark of the target video.` |
| **L2VA** | `How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the {S.SS}-second mark of the target video.` |
| **T2VA** | 无对齐指令 |

`S.SS` = **实际有效时长**（`frames / 24`，两位小数），不是用户填的秒数。
例如填 5 秒 → 124 帧 → 5.17 秒 → 写 `5.17`。

### 2.3 分镜时间戳

```text
[Shot 1] ...                        ← 首镜不带时间戳
[Shot 2] At 00:03.500, ...          ← 单点时间戳，毫秒三位
```

| 写法 | 判定 |
|---|---|
| `At 00:03.500,` | ✅ 官方格式 |
| `[3.5s-6.0s]` | ❌ **非法**，区间会被忽略 |
| `At 00:03` | ❌ 缺毫秒，不是官方句式 |

### 2.4 运镜写法

用**自然语言句**，不要方括号标签：

| 写法 | 判定 |
|---|---|
| `The camera pushes in with small amplitude at slow speed.` | ✅ |
| `[Pan left]` / `[Zoom in]` | ❌ 那是上一代 `video-01-director` 的语法，H3 不认 |

常用运镜（中文词 → 英文句，编译器内置同一张表）：

| 中文 | 英文 |
|---|---|
| 推近 / 推镜 | `pushes in with small amplitude at slow speed` |
| 拉远 / 拉镜 | `pulls back with moderate amplitude at slow speed` |
| 横摇 / 摇镜 | `pans horizontally at steady speed` |
| 俯仰 | `tilts vertically at steady speed` |
| 跟拍 | `tracks the subject from a fixed distance` |
| 环绕 | `orbits around the subject at constant radius` |
| 升降 / 摇臂 | `cranes vertically with a smooth arc` |
| 手持 | `moves with a subtle handheld sway` |
| 固定 / 静止 | `stays locked off on a tripod` |

### 2.5 台词

```text
{说话人} (S1) is visible on screen and says: <d>[Chinese] {台词逐字}</d>
```

- `(S1)` / `(S2)` 按**发声顺序**编号，全篇不变。合声写 `(S1,S2)`。
- 台词**逐字不改写**，不要加引号包起来。
- 画外音：`says in an off-screen voiceover` + 紧跟一句声明 `lips remain completely closed`。
- 跨切台词：两侧都写 `<scenetrans>` + 声明音频延续。
- 被截断台词：写 `<cutoff>`。
- **台词时长超过镜时长是最常见的口型崩坏原因**。按约 4–5 字/秒反推。

---

## 3. Ref2VA 六段格式（有参考素材时）

### 3.1 结构（字段顺序固定，不可调整）

```text
subject_definitions:
<Subject 1> is the character shown in <Picture 1>, with {可识别特征}. This subject is the on-screen speaker (S1).
<Video 1> is the source for camera movement, blocking and motion timing. It does not define character appearance.
<Audio 1> is the voice-timbre reference for <Subject 1>.

summary:
[reference generation + audio reference] {一句话核心事件}

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved - keep {具体要保住的点}.
<Video 1>: attribute_transfer - transfer motion and camera movement only; do not copy characters or set.
<Audio 1>: reference - follow timbre and delivery only; do not copy the waveform.

detailed_description:
{1–2 句风格与影调定调}

[Shot 1] {景别}, {主体位置与动作}. The camera {运镜}. <Subject 1> (S1) says: <d>[Chinese] {台词}</d>
[Shot 2] At 00:05.000, the shot cuts to {景别}, {内容}.

overall_soundscape: {1–4 句}

non_diegetic_music: {N/A 或 1–3 句}
```

### 3.2 四类引用标签

| 标签 | 含义 |
|---|---|
| `<Subject N>` | 从参考素材抽象出的、可在目标视频中复用/修改的**可见内容**（人/物/场景/服装/风格/动作/表情） |
| `<Picture N>` | 作为**具体帧锚点**的参考图（首帧/关键帧/尾帧/构图锚点/故事板） |
| `<Video N>` | 提供**整段视频级关系**：剪辑源、续接起点、运镜/节奏/时间结构 |
| `<Audio N>` | 被复制或被参考的音频信号 |

> **`<Subject N>` 不是上传槽** —— 它由 `subject_definitions` 创建。素材上传槽是 `<Picture N>` / `<Video N>` / `<Audio N>`。

### 3.3 两套保留标记（**不可混用**）

| 视觉类（`<Subject>` / `<Picture>` / `<Video>`） | 音频类（`<Audio>`） |
|---|---|
| `fully_preserved` | `fully_copy` |
| `partially_preserved` | `partially_copy` |
| `attribute_transfer` | `reference` |
| `weak_reference` | `weak_reference` |

`weak_reference` 是两套唯一共有的。**拿 `fully_preserved` 描述音频是社区最常犯的错。**

### 3.4 `summary` 的任务类型前缀

固定 6 个枚举，用 ` + ` 连接，不可重复：

```text
keyframe completion / reference generation / video editing /
video continuation / audio reuse / audio reference
```

例：`[reference generation + audio reference] {核心事件}`

### 3.5 `detailed_description` 的长度

官方建议生成任务 **350–500 英文词**。对白密集时优先保证台词时间轴完整，不要机械凑字数。

**内容太少会退化成随机抽卡** —— 起码要有：主体 + 场景 + 动作 + 镜头 + 收束。

---

## 4. 音效两字段（不能空）

| 字段 | 写什么 | 数量 |
|---|---|---|
| `overall_soundscape` | 环境声、物理动作声、非语言人声（脚步/布料/碰撞/呼吸/笑）。**不含台词与配乐** | 1–4 句 |
| `non_diegetic_music` | 只有观众能听到的配乐：乐器 + 速度 + 节奏 + 动态 | 1–3 句，无则 `N/A` |

**不要写"不要 BGM"** —— 用 `non_diegetic_music: N/A`，并且**不要在别处提音乐氛围**（提了会漏，实测约 20% 仍加音乐）。

---

## 5. 四类参考输入的编号规则（最容易错）

### 5.1 各自独立累加

| 类型 | 编号 | 上限 | 时长约束 |
|---|---|---|---|
| 参考图 | `<Picture 1..9>` | ≤ 9 张 | — |
| 参考视频 | `<Video 1..3>` | ≤ 3 段 | 每段 2–15 s，合计 ≤ 15 s |
| 参考音频 | `<Audio 1..3>` | ≤ 3 段 | 每段 2–15 s，合计 ≤ 15 s |

**合计参考文件 ≤ 12 个。**

### 5.2 `<Audio>` 是全局累加，视频音轨先占号 ★

```text
1 个带音轨的参考视频 + 1 个独立音频
  → <Audio 1> 是视频的音轨
  → <Audio 2> 才是那个独立音频
```

按"独立音频 = Audio 1"去写，提示词就全错。**编号由后端算，不要自己推。**

### 5.3 视频与其音轨必须同号

ComfyUI 按编号配对，不按数组顺序。没有音轨的视频**不要**接 `ref_video_audios`，否则编号错位。

### 5.4 参考音频必须伴随图像或视频

官方模型卡要求音频不能作为唯一输入。**本地 ComfyUI 节点不拦这个**（能跑通），但违反官方语义，音色会漂。插件按官方约束拦。

### 5.5 参考视频必须声明用途，否则模型会照抄

| 用途 | `subject_definitions` 里怎么写 | `retention_analysis` 标记 |
|---|---|---|
| 动作/运镜 | `is the source for camera movement, blocking and motion timing` | `attribute_transfer` |
| 节奏 | `is the source for editing rhythm and shot timing` | `weak_reference` |
| 氛围 | `is the source for atmosphere and lighting only` | `weak_reference` |
| 续篇 | `is the immediately preceding clip; the target video continues it directly` | `fully_preserved` |

---

## 6. 灰模参考视频（blockout）的提示词写法 ★

这是本项目**推荐的 3D 预演路线** —— Blender 只负责运动与空间，渲一段灰模视频当参考视频。

### 6.1 三条必写

```text
<Video 1> is the source for camera movement, blocking and motion timing.
It does not define character appearance.
```

```text
Deliver a fully rendered frame in the target style; the reference video supplies motion and staging only.
```

```text
<Subject 1> path comes from the RED TALL CAPSULE in <Video 1>
```

### 6.2 铁律：提示词必须描述参考视频里**真实存在**的东西

人数、主要道具、机位方向这三样**必须一致**。实测：控制/参考约束的是**结构**，提示词约束的是**内容与语义**。两者冲突时前段（高 sigma）偏提示词，后段偏参考。

所以参考视频里有两个人，提示词写"一个少女在走" → 前几秒会被提示词抢走。

### 6.3 多角色必须上身份色

全灰 playblast 会丢失身份区分，实测多人同框时左右会互换。给每个角色饱和色（红/蓝/绿/黄/紫/青）并在提示词里引用色号。

---

## 7. 画风库（11 种，官方画风串逐字照抄）

> ⚠️ **画风串的 `en` 必须逐字照抄，不缩写、不改写、不合并**（群友 v2.1 §3.1）。
> 英文原文以 `h3-prompt.js` 的 `STYLE_PRESETS` 为准（唯一真源，前端下拉也读它）。
>
> **2026-11-18 之前这里是错的**：代码里的 `en` 是"重写的简版"，而且
> Ref2VA 分支下还会截断到 180 字符 —— 但官方串的**约束句全在末尾**
> （`NOT 3D` / `NO subtitles` / `NO photorealistic textures`），
> 截断就等于砍掉全部反模式约束，模型照样渲成 3D、照样出字幕。
> 现在：整串保留 + 不截断（超长只给 warning，不砍）。

| id | 名称 | 类别 | 改外观？ | 含 `NO subtitles`？ |
|---|---|---|---|---|
| `helltaker-look` | 地狱把妹王（外观版） | 2D扁平卡通 | ✅ 会改 | ✅ |
| `helltaker-style` | 地狱把妹王（画风版） | 2D扁平卡通 | ❌ | ❌ |
| `ova90s` | 90年代OVA风 | 2D手绘赛璐珞 | ❌ | ✅ |
| `shinkai` | 新海诚风 | 2D手绘柔光 | ❌ | ✅ |
| `ghibli` | 吉卜力风 | 2D手绘柔光 | ❌ | ✅ |
| `american-toon` | 经典美式卡通 | 2D扁平弹性 | ✅ 会改 | ✅ |
| `ufotable` | 飞碟社风 | 3D背景+2D角色 | ❌ | ❌ |
| `toon3d-pbr` | 三渲二+PBR混合 | 3D半写实 | ❌ | ❌ |
| `gohands` | GoHands 风 | 现代锐利 | ❌ | ❌（v2.1 无此画风，本地补充） |
| `ligne-claire` | Ligne Claire（欧洲漫画） | 2D 平涂线条 | ❌ | ❌ |
| `vivziepop` | 地狱客栈（Vivziepop） | 2D 扁平卡通 | ✅ 会改 | ❌ |

> **带 ❌ 的必须靠「防线 1」补上字幕压制**：编译器会在画风串后
> *另起一行*追加 `Text suppression: NO subtitles, …`（v2.1 §15.2）。
> 这不是画风串的一部分，所以不违反"逐字照抄"。

### 选择建议

- 要**换角色长相** → `helltaker-look` / `american-toon` / `vivziepop`（标了"会改"的）
- 要**保留原角色设计、只换渲染风格** → 其余
- **有角色卡/参考图时优先选 `changesAppearance: false` 的** —— 否则风格会覆盖参考图里的设计
- **要 bloom 主导的画面**（落日、水面、霓虹）→ v2.1 §3.13 的兼容性表：

  | 画风 | bloom 兼容性 | 处理 |
  |---|---|---|
  | `ova90s` / 画风 10 | ✅ 完全兼容 | 直接用 |
  | `shinkai` / `ghibli` | ✅ 极度兼容（自带 bokeh） | 直接用，可加强度 |
  | `toon3d-pbr` | ⚠️ 自带 `soft diffuse shadows` | 硬边声明改 `smooth shadows with gentle transitions` |
  | `ufotable` | ⚠️ 含 `NO soft lighting` | 需 bloom 时删该句（bloom 属光源本体） |
  | `ligne-claire` | ⚠️ 自带 `magical glow` `Slow camera pan` | 删 `Slow camera pan` |
  | `helltaker-look/-style` / `american-toon` / `vivziepop` | ❌ 含 `no gradients` / `stark graphic blocks` | **不用于 bloom 主导的段落** |

### 光域：Bloom 域授权（v2.1 §6.7）

Bloom **不是"不许有"**，是"**只许出现在指定位置**"。三个域：

| 域 | 内容 | 处理 |
|---|---|---|
| 光源域 | 日轮、会场灯、街灯、霓虹、水面反射点 | 放行，写 `hot core` + `soft halo` + `clip to pure white` |
| 介质域 | 体积光柱、尘粒、海雾 | 放行，但不加 `glow` 滤镜 |
| **人物域** | 皮肤、头发、睫毛、衣物、腿部 | **死守**，必须补一句"绝不溢光" |

标准句式（四段结构）：

```
Bloom is confined to [域 A] and [域 B]: [A 具体写法], [B 具体写法],
both allowed to clip to pure white. [人物] stay clean, with no glow bleeding onto [器官列表].
```

强度三档：`clip`（clip to pure white）/ `blown`（frays into a blown bloom）/ `frazzle`（frazzles into blown points）

词汇纪律：
- ✅ `hot core` / `soft halo` / `clip to pure white` / `blown` / `frazzle`
- ❌ `glow overlay` / `lens flare` / `god rays` / `soft light beams` / `glowing orb`

### 镜面分级（v2.1 §6.6）

镜面程度是**镜头级参数**，逐镜指定，不许一段统一：

| 级 | 写法 | 适用 |
|---|---|---|
| 0 无 | `no mirror specular anywhere on them` | 远景 |
| 1 漫射 | `only a soft diffused sheen along the top of the nylon` | 全景/中景 |
| 2 散乱 | `a soft scattered sheen, present only where the palm presses` | 触碰镜 |
| 3 窄条 | `one narrow specular streak down the front of the thigh` | 近景特写 |

**受压三态**（v2.1 称为"全片最有效的物理证据"）：

```
常态：one narrow specular streak runs unbroken down the front of the nylon
受压：the sheen compresses into a short flattened band while the surrounding fabric pulls tight
松手：the sheen springs back to its full unbroken length
```

---

## 7.5 压制词只有三处合法位置（v2.1 §15.1）

本地 CFG 固定 1.0、采样器没有 negative 分支，所以**正文里的"不要 X"反而会把 X 拉进画面**。
但字幕/水印必须压 —— v2.1 的解法是**按位置授权**，不是按词性豁免：

| # | 合法位置 | 例 |
|---|---|---|
| 1 | 画风串后的追加压制行 | `Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.` |
| 2 | 场景板出图负面清单 | `people, text, subtitles, sign lettering, watermark, logo...` |
| 3 | 具名物的属性声明（**正向句法**） | `a wooden signpost whose board carries no legible lettering and no text of any kind` |

**其余字段一律不得出现独立负面句。** 判断口诀：

```
句子主语是可画的东西 → 正向描述
句子主语是「不要什么」 → 只在上面三处
```

- 防线 1（追加压制行）**由编译器自动注入**，不需要手写
- 防线 2（画面完整性句）**由编译器自动注入**：
  `Every element inside the frame belongs to the physical scene: ... Nothing floats over the image.`
- 防线 3（具名物属性）由场景描述自己携带

> `lintCompiledPrompt()` 会检查这三处之外是否出现没有通道的负面句并报警。
> 它不再用"46 条白名单逐条豁免"的旧办法 —— 那漏一条就误报一次。

---

## 8. 硬约束速查

| 项 | 值 |
|---|---|
| 帧网格 | **`17k+5`** → 5, 22, …, 124, …, 362 |
| 最短 | **124 帧 ≈ 5.17 s**（不是 4 秒！官方口径 4–15s，但节点网格上 36 帧以下不可达） |
| 最长 | 362 帧 ≈ 15.08 s |
| 分辨率 | 短边 768；面积上限 768×1344；宽高 **32 倍数** |
| 16:9 原生 | 1344×768 |
| 2K | 仅 API，本地不可得 |
| CFG | **1.0**，无 negative 分支 |
| 步数 | 官方基线 20；DMAD 4 或 8（蒸馏学生） |
| 提示词长度 | **≤ 6000 字符**（官方 7000；本插件收紧，见下）|
| 音频 VAE | **必须 fp32**（fp16 会静音） |
| 输出音频 | 32 kHz 立体声 |

### 为什么收到 6000 而不是官方 7000

官方上限 7000 是**硬性拒绝线**，不是**质量最优线**。

实测在 6500–7000 字符区间，六字段的注意力分配开始被稀释：
`detailed_description` 里的动作细节会被后段的
光影描述和声音描述盖过，表现为「动作写得很细，但片子没做出来」。

6000 是「六字段齐全 + 动作细节写清」的实际上限。再多就只能靠堆砌形容词，
收益为负。压缩优先级：

1. 画风串后的重复描述（画风串本身**不可删减**，见 §7）
2. 光影层里的解释性从句
3. 声音行的重复
4. `retention_analysis` 的重复声明

> 代码里 `H3_LIMITS.promptMaxChars = 6000`、`promptOfficialMaxChars = 7000`，
> `lintCompiledPrompt()` 分两道提示：超 6000 给精简建议，超 7000 额外警告上游可能拒。

---

## 9. 官方反模式清单

| # | 反模式 | 后果 | 正确做法 |
|---|---|---|---|
| 1 | 写负面提示词 / ban list | `cfg=1` 无 negative 分支，**被点名的概念反而更容易出现** | 正向陈述；或用 Ref2VA 的 `retention_analysis` |
| 2 | 只写一段话不分段 | 模型无法分配时间轴 | 按模式拆字段 |
| 3 | 素材上传了但没写用途 | 参考被静默忽略 | 每个素材写"参考什么 + 保留到什么程度" |
| 4 | 开头就写光线/形容词 | **模型对开头权重最高**，会拍成"关于光的镜头" | 顺序：主体 → 动作 → 镜头 → 光线 → 声音 |
| 5 | 堆叠风格词 | 与参考素材**互相竞争** | 有参考时风格词写少 |
| 6 | 一镜到底却写很多分镜 | 结构自相矛盾 | 删掉 `[Shot N]` 结构 |
| 7 | 台词时长超过镜时长 | **口型崩坏（最高频）** | 约 4–5 字/秒反推 |
| 8 | 时间戳写区间 `[5s-8s]` | 格式非法 | 单点 `At 00:05.000,` |
| 9 | 把参考图都当关键帧 | 身份照当首帧，构图错位 | 身份参考写 `<Subject N>`；真要当帧才写 `<Picture N>` |
| 10 | 只写"用视频1做参考" | 模型连演员/背景/声音一起抄 | 外观/动作/节奏/运镜/音频分别指派 |
| 11 | 同一声明的说话人重编号 | 路由错乱、角色说错台词 | `(S1)` 全篇不变 |
| 12 | 音频标记用错 | 只想借音色却整轨照搬 | 复制用 `fully_copy`，借音色用 `reference` |
| 13 | 提示词过短（纯文生） | 官方明确列为失败模式 | 至少写全：主体外观 + 场景 + 动作 + 风格 |
| 14 | 中文提示词 | 非官方路径，效果不稳 | 正文英文；中文只在 `<d>` 与画面文字内 |
| 15 | 负面框写"不要 BGM" | 与"想要音乐"矛盾，且约 20% 仍泄漏 | `non_diegetic_music: N/A` |
| 16 | 塞分镜标签 `[char:]`/`[shot:]` | 官方明确要求剥离 | 渲染前删干净 |

---

## 10. H3-Image 专用规范

### 与视频的差异

| 项 | H3 视频 | H3-Image |
|---|---|---|
| 步数 | 4（Turbo）/ 20（基线） | **固定 6** |
| guidance | 1.0 | 1.0 |
| 负面提示词 | 不支持（cfg=1） | **不支持**（无 negative 输入通道） |
| 参考图上限 | 9 | 16 |
| 原生尺寸 | 1344×768 | 2048×2048（约 4.2 MP） |
| 最大面积 | — | **受 `imageMaxMP` 限制，默认 4.3 MP** |

### 提示词写法

- **参考图会直接进模型，不要用文字复述图片** —— 模型"看得见"，文字复述反而会与图冲突。
- 只写**任务**：拆什么、怎么排、什么风格。
- 不用 Markdown（`**粗体**`、`## 标题` 是噪声）。
- **不用编号小标题**（一、二、三 / 1. 2. 3.）—— 实测图上会出现编号与乱码。
- 数量必须与参数一致（选 3 个视角就写 3 个）。
- 反向约束直接写"不要/禁止" —— H3-Image 的 prompt 是自由文本，编码器正常理解否定词。

### 4K 档会 OOM

`4096²` / `5472×3072` 是 16.8 MP，面积是 2048² 的 4 倍。12 GB 卡实测 2048² 已用 11.4 GB。
插件默认拦掉超过 `imageMaxMP`（4.3）的请求。要跑 4K 需 48 GB+ 并显式调大配置。

---

## 11. 立绘拆解（角色设定图）规范

### 只有一个输入：整段提示词

**档位、尺寸、结构化字段全部移除。** 页面只给一个可整段编辑的文本框，
默认值是一份完整的**三视图设定卡**提示词；后端**不做任何拼装、不改写、不追加**，
只做 `trim` 与长度校验（超 `BREAKDOWN_PROMPT_MAX_CHARS` = 4096 直接 400，
不静默截断）。前端与后端面对的是**同一个字符串**。

尺寸固定为横版 `2368×1776`（4.2 MP）：档位里 `full` 与 `standard` 曾逐字相同，
尺寸里能跑稳的也只有这一档 —— 留着只会让人以为"调了会变"。

> ⚠️ 传 `character` / `outfit` / `parts` / `views` / `notes` / `level` /
> `sizeId` 不会报错，但**不再影响提示词**，响应里会回 `legacyFieldsIgnored`。

### 五条原则（违反会出乱码/误导）

1. **不要用文字复述图片** —— 参考图以视觉块进编码器，文字复述会与图冲突
2. **必须有"文字优先于参考图"的授权句** —— 否则用户改服装/配色一定失败
3. **纯文本**：不产 Markdown（`**`、`##` 是噪声）
4. **不要编号小标题** —— 模型会把编号当成"要画在图上"的标签
5. **数量与文字一致** —— 写三个视角就画三个，别在别处说"四视图"

### 授权句（本版新增，改之前务必理解）

参考图的约束力很强。只写"服装完全以参考图为准"，用户想换一套衣服就改不动；
只写"按文字改"，不做改动时又会跑偏。所以默认提示词里同时写死两条边界：

| 文字状态 | 处理 |
|---|---|
| 文字里**明确写出**替换/新增 | 以文字为准，整体替换参考图对应部分 |
| 文字**没有提到** | 严格照参考图还原 |

这样"不动 = 精准还原"和"改了 = 真的改"同时成立，两者不打架。
**删掉这句，换装类改动必然失效。**

### 细节锁

拆解图最容易"简化"：多层裙摆合并、小配饰省掉、纹样画成色块。所以提示词里有五条硬约束：

1. 逐件单列（禁止合并/拆分）
2. 保持原比例与朝向（长裙不要画短、斜挎不要画成正挂）
3. 材质/纹样/五金/镶嵌逐项复刻（不要概括成"金色装饰"）
4. 不丢小件（耳饰、戒指、胸针、链扣、铆钉）
5. 不做增删（只画参考图里存在的；这条不覆盖已经明确要求替换的部分）

---

## 12. 修改分镜时的注意事项

改分镜脚本时：

| 要点 | 说明 |
|---|---|
| 一镜一件事 | 一个镜头只做一件事，动作多了会糊 |
| 景别交替 | 别连着三镜都是中景 |
| 时长 ≥ 5 秒 | 124 帧是物理下限，写 4 秒会被抬到 5 秒 |
| 台词字数 | 按 4–5 字/秒，5 秒镜头最多约 22 字 |
| 参考视频里的东西必须写进描述 | 人数/道具/机位方向三样对齐 |
| 分段串联时上一镜末帧=下一镜首帧 | 用 Ref2VA + AddGuide，不要用 FL2VA |

---

## 13. 检查清单

生成前逐条过：

- [ ] 模式选对了吗？（有参考素材 → Ref2VA；只有首尾帧 → 基础格式 + 对齐指令）
- [ ] 正文是英文吗？中文只在 `<d>` 与画面文字里？
- [ ] 有没有写"不要 XX"？（改成正向陈述）
- [ ] `overall_soundscape` 填了吗？（不能空）
- [ ] `non_diegetic_music` 填了吗？（无则 `N/A`，不是留空）
- [ ] 每个参考素材都在 `subject_definitions` 里有定义？`retention_analysis` 里有标记？
- [ ] 音频用的是**音频那套**标记（`fully_copy` / `reference`），不是视觉标记？
- [ ] 时间戳是单点 `At 00:MM.SSS,`，不是区间？
- [ ] 台词字数 ÷ 4.5 ≤ 镜头秒数？
 - [ ] 参考视频里的人数、道具、机位，提示词里写对了吗？
- [ ] 有参考素材时风格词是不是太多了？
- [ ] 帧数是 `17k+5` 网格上的值吗？
- [ ] 总长 ≤ 6000 字符吗？（超了按 §8 的优先级压缩）
- [ ] **续写段：有 `Outfit anchors` 行吗？同一件衣服跨段用词完全一致吗？**（见下）

### 续写段的服饰一致性（强制）

latent 只带「上一段的实际画面」，**不带这套衣服的设计说明**。
所以不写就会逐段漂：刺绣糊成一块布、蕾丝变平布、开叉位置走位。

每段在 subject 定义之后加一行：

```text
Outfit anchors, unchanged throughout and identical to every other segment: [角色] wears [上装+工艺], [下装+开叉/内衬], [腿部装束+光泽层级], [鞋+跟高/绑带], plus [配饰逐项，带左右方位]. The fabric is matte ... 与上一段完全相同。
```

四条铁律：

| # | 要求 | 违反后果 |
|---|---|---|
| 1 | 同一件衣服在各段用**完全相同的英文词** | 模型当成两件，中途换装 |
| 2 | 配饰必须带**左右方位** | 左右互换或位置漂移 |
| 3 | 显式写「材质反应与上段相同」 | 蕾丝被平滑成平布 |
| 4 | 不要用「同上段」省略 | 续写没有"同上"通道 |

> 镜面分级可以随镜别变（远景 1 级 → 特写 3 级），那是镜头语言；
> 但材质本身（尼龙 / 蕾丝 / 皮革）**绝不能变**。
> 完整说明见 `h3-group-master` 的 §1.6.5。

---

## 14. 出处

本规范的证据链见 `docs/probes/h3-prompt-research/REPORT.md`（638 行，110 个来源链接）。核心一手来源：

- 官方 skill `h3-prompt-writing`：`references/base-en.txt`（基础格式）、`references/ref-en.txt`（六段格式）
- ComfyUI 官方提示词指南 `docs.comfy.org/tutorials/video/minimax/`
- 官方模型卡 `huggingface.co/MiniMaxAI/MiniMax-H3`
- 节点源码 `comfy_extras/nodes_minimax_h3.py`（帧网格、`BasicGuider` 无 negative）

**明确检索无结果、属本地自造的**：`H3镜头输入包` schema、`动画制作 Skill 2.3`、`OVA90s` / `Helltaker-look` / `toon3d-pbr` 风格命名。这些不作为官方内容宣称。
