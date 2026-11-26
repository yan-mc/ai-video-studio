---
name: jiuzhang-studio-prompt
description: H3 视频 / H3-Image 图像 / 立绘拆解 的提示词书写规范。这是**唯一权威**的提示词文档：给出一套模式路由器 + 两套官方格式（基础格式三字段 / Ref2VA 六段），11 种本地画风 + 7 种打光，四类参考输入的编号规则，以及官方反模式清单与 lint 判定。当需要为视频生成、图像生成、立绘拆解、漫画分格、模特套件编写或审查提示词时使用。
---

# 提示词书写规范（H3 / H3-Image）

> 本 skill 是写提示词的**唯一依据**。实现是 `host/bridge/prompt/` 下的 9 个文件：
> `h3-prompt.js`（门面 + `compileH3Prompt`）· `spec.js`（段名/顺序/枚举/上限）· `route.js`（模式路由）·
> `styles.js`（画风 + 打光 + 冲突表）· `ref2va.js`（六段拼装）· `base.js`（三字段 + 对齐指令）·
> `shot-adapter.js`（镜头卡 → 输入包）· `lint.js`（反模式/截断）· `text-utils.js`（帧数/时间戳/运镜/说话人）。
> `studio_prompt` 工具与 `/prompt/*` 路由都走这一份代码。**改本文件时必须同步改代码。**

## 0. 四条铁律（避开 80% 的坑）

| # | 铁律 | 为什么 |
|---|---|---|
| 1 | **正文必须英文** | 官方 English-only。中文只允许在 `<d>[Chinese] …</d>` 台词内与画面文字双引号内。`lint.js` 在「中文 > 10 字且 > 拉丁字母 × 0.15」时告警 |
| 2 | **正文禁止写负面提示词** | CFG 固定 1.0，采样器 `BasicGuider` **没有 negative 分支**。写"不要 XX"反而把 XX 拉进画面 |
| 3 | **标签必须 `<Picture 1>` 这种形式** | 尖括号 + 半角空格 + 序号。`<Picture>` / `<Video>` / `<Audio>` **各自**从 1 起，`<Subject N>` 单独编号 |
| 4 | **先算帧数再写时间戳** | 帧数在 `17k+5` 网格上，夹到 [124, 362]。所有时间戳必须 < `frames / 24` |

## 1. 模式路由器（唯一判定点，`route.js` 的 `routeFormat()`）

**不要在别处再判断一遍模式。** 优先级自上而下，命中即返回：

```
① 有参考视频 或 参考音频             → ref（Ref2VA 六段）
② 声明 ref2va 且有参考图             → ref
③ 关键帧模式（i2va/fl2va/l2va 声明） → base（图是帧锚点）
④ 有参考图但未声明模式               → ref（图是外观参考，不是帧锚点）
⑤ 什么都没有                         → base（T2VA 文生视频）
```

- **只传 `subjects[].pictureIndex`、不传 `references.images` 也算"有参考素材"** —— 否则 `<Picture N>`
  与 `retention_analysis` 会整段消失
- 声明 `i2va` / `fl2va` / `l2va` 但没有首尾帧文件时**不退回 T2VA**：模式本身就说明第 1 张图是首帧
- **两条硬性互斥**：① 首尾帧 ⊥ 全参考（官方明确 `first_frame/last_frame` 与
  `ref_images/ref_videos/ref_audios` 不可同请求，`compileH3Prompt` 会 push warning）
  ② `fl2va` 权重 ⊥ `ref2va` 权重（两个 checkpoint 不通用）
- **五种模式**（`H3_MODES`）：`t2va` 文生 / `i2va` 1 张首帧 / `fl2va` 0–2 张 / `l2va` 1 张尾帧 /
  `ref2va` 图 ≤ 9 + 视频 ≤ 3 + 音频 ≤ 3。别名归一在 `store/mode-aliases.js`（`i2v`→`i2va`、
  `flf`→`fl2va`、`h3:T2V`→`t2va` 等）

## 2. 基础格式（T2VA / I2VA / FL2VA / L2VA）

```text
{对齐指令 —— 仅关键帧模式，第一行，后接恰好一个空行}

integrated_multimodal_description: {风格句}. {打光句}. [Shot 1] {景别}, {动作}. The camera {运镜}. {说话人} (S1) is visible on screen and says: <d>[Chinese] {台词}</d>

overall_soundscape: {1–4 句}

non_diegetic_music: {1–3 句} 或 N/A
```

整段正文是**一个字段一行**，字段名用**半角冒号**；`integrated_multimodal_description` 里用单空格串接
风格句（画风 `en` 整串）、打光句（打光 `en` 整串）、各镜句子，都不截断。

**三种对齐指令（逐字照抄，不要"顺手统一"—— 官方原文三种句式并不一致，I2VA 与 L2VA 带尖括号、FL2VA 不带）**：

| 模式 | 第一行 |
|---|---|
| **I2VA** | `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.` |
| **FL2VA** | `How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture 2 (from [Shot 1]) aligns with the {S.SS}-second mark of the target video.` |
| **L2VA** | `How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the {S.SS}-second mark of the target video.` |
| **T2VA** | 无对齐指令 |

`{S.SS}` = **实际有效时长** `frames / 24`，两位小数，**不是**用户填的秒数：填 5 秒 → 124 帧 → `5.17`；
填 15 秒 → 362 帧 → `15.08`。编号可由 `references.firstFrameIndex` / `lastFrameIndex` 显式覆盖；
`fl2va` 缺省是首帧 `Picture 1`、尾帧 `Picture 2`（**占槽**，见 §5.1）。

**分镜时间戳** —— 首镜不带时间戳，其余镜写 `[Shot 2] At 00:03.000, …`（**单点**，毫秒三位，值 = 该镜起点，
由前一镜 `endSec` 累加，`timecode()` 输出 `MM:SS.mmm`）。`At 00:03`（缺毫秒）与 `[3.5s-6.0s]`（区间）都**非法**。

**运镜** —— 用自然语言句，不用方括号标签。`cameraPhrase()` 内置中文 → 英文映射：推近/推镜/推进 →
`pushes in with small amplitude at slow speed`；拉远/拉镜/后拉 → `pulls back with moderate amplitude at slow speed`；
横摇/摇镜 → `pans horizontally at steady speed`；俯仰/上下摇 → `tilts vertically at steady speed`；
跟拍/跟镜 → `tracks the subject from a fixed distance`；环绕/旋转 → `orbits around the subject at constant radius`；
升降/摇臂 → `cranes vertically with a smooth arc`；手持 → `moves with a subtle handheld sway`；
固定/静止/不动 → `stays locked off on a tripod`；变焦 → `zooms with small amplitude at slow speed`。

英文形容词不能当动词：`fixed`/`static`/`locked` → `stays locked off on a tripod`；`slow`/`fast`/`smooth`/`steady`
→ `moves slowly and steadily`。认不出来的中文词 → `moves slowly and steadily`（**不编造运动**）；空 `camera`
→ `stays locked off on a tripod`。❌ `[Pan left]` / `[Zoom in]` 是上一代 `video-01-director` 语法，lint 会点名告警。

**台词** —— `{说话人} (Sx) is visible on screen and says: <d>[Chinese] {台词逐字}</d>`：

- `(S1)` / `(S2)` 按**首次发声顺序**编号，全篇不变；由 `ref2va.js` 的 `speakerIds` 统一分配，
  台词行必须与 `subject_definitions` 里的 `This subject speaks as (S1).` 一致
- 台词**逐字不改写**，不加引号。有情绪时写成 `... and says (angry):`（来自 `dialogue.emotion`）
- 画外音：`says in an off-screen voiceover` + 紧跟 `lips remain completely closed`；
  跨切台词两侧都写 `<scenetrans>` + 声明音频延续；被截断台词写 `<cutoff>`
- **`<d>` 后面必须带语言标签**（lint 检查 `<d>` 后不是 `[` 就告警）
- **台词时长超过镜时长是最常见的口型崩坏原因**。按约 4–5 字/秒反推

## 3. Ref2VA 六段格式（有参考素材时）

**段名与顺序固定不可调整**（lint 逐条检查：**缺字段**告警、**顺序错**告警）：

```text
subject_definitions:  →  summary:  →  retention_analysis:  →  detailed_description:  →  overall_soundscape:  →  non_diegetic_music:
```

**① `subject_definitions:`** —— 每个参考素材在这里被定义：

```text
<Subject 1> is the character shown in <Picture 1>, with red coat, 165cm tall. This subject speaks as (S1).
<Video 1> is the source for camera movement, blocking and motion timing. It does not define character appearance.
<Audio 1> is the voice-timbre reference for <Subject 1>.
```

`<Subject N>` 的英文描述**只取 ASCII 段**：中文 `description` / `traits` 不嵌英文句法，退回泛化写法
`is the character shown in <Picture M>`（外观由参考图承载）；无参考图的角色写
`... defined by the written description only (no reference picture supplied)`。`<Video N>` 的用途句由
`videoUses` 决定（§5.4），末尾恒接 `It does not define character appearance.`
**不要写第 7 段**：角色卡绑定行与 `mediaNotes` 都是**追加在本段内**的。

**② `summary:`** —— 一行：`[reference generation + audio reference] 一个少女在黄昏的码头等人`

**③ `retention_analysis:`** —— 每个素材一行，"标记 - 具体保住/借什么"：

```text
<Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - keep red coat.
<Video 1>: attribute_transfer - transfer motion and camera movement only; do not copy characters or set.
<Audio 1>: reference - follow timbre and delivery only; do not copy the waveform.
```

无参考图的角色**必须**用 `weak_reference - text_only`（没有东西可以"保住"）。这里**不写** `(Sx)`。

**④ `detailed_description:`** —— 主体内容区，拼装顺序：`{画风 en 整串}` / 空行 / `{Text suppression 压制行}` /
空行 / `{打光 en 整串}` / `[Shot 1] …` `[Shot 2] At 00:MM.SSS, …` / `{说话人行}` /
`Deliver a fully rendered frame …`（仅当 `videoUses` 含 `motion`）/ `{画面完整性句}`（编译器自动注入）。

**⑤⑥ 声音两段**（§4）—— `字段: 值` 单行，之间恰好一个空行。

官方建议生成任务 **350–500 英文词**。对白密集时优先保证台词时间轴完整，不要机械凑字数。
`ref2va.js` 在 `body.length <= 1`（只剩风格句、没有画面过程）时告警：**内容太少会退化成随机抽卡** ——
起码要有：主体 + 场景 + 动作 + 镜头 + 收束。

**四类引用标签**：`<Subject N>` 是从参考素材抽象出的**可见内容**（人/物/场景/服装/风格/动作/表情）；
`<Picture N>` 是**具体帧锚点**；`<Video N>` 提供**整段视频级关系**（剪辑源/续接起点/运镜节奏）；
`<Audio N>` 是被复制或被参考的音频信号。
> **`<Subject N>` 不是上传槽** —— 它由 `subject_definitions` 创建。上传槽是 `<Picture>` / `<Video>` / `<Audio>`。

**两套保留标记（不可混用）**：

| 视觉类（`<Subject>` / `<Picture>` / `<Video>`） | 音频类（`<Audio>`） |
|---|---|
| `fully_preserved` / `partially_preserved` / `attribute_transfer` / `weak_reference` | `fully_copy` / `partially_copy` / `reference` / `weak_reference` |

`weak_reference` 是两套唯一共有的。**拿 `fully_preserved` 描述音频是社区最常犯的错。**
`<Audio>` 的标记取自 `references.audioModes[i]`，不在音频枚举内就回落 `reference`。

**`summary` 前缀（6 个固定枚举，` + ` 连接去重）**：`keyframe completion` / `reference generation` /
`video editing` / `video continuation` / `audio reuse` / `audio reference`。可由 `summaryTasks` 显式给
（非法值被过滤）；不给时自动推导：有首/尾帧 → `keyframe completion`；有参考图或有效 `pictureIndex`
→ `reference generation`；某段视频 `videoUses` 是 `continuation` → `video continuation`；有参考音频
→ `audio reference`。

**续写段顶部两条机制句（编译器自动注入，不要手写）** —— 承接段写 `CONTINUATION_SWITCH`（latent 主导动作、
参考图不重置姿态、光向延续）+ `TRIM_DISCIPLINE`（第一秒是裁切区、无新事件，所有动作从 1 秒后开始）；
段 1（`continuationIndex === 1`）反过来写 `This is the opening segment of the film...` +
`...the first second is fully authored. Every action below may begin at the first frame.`
承接判定：`continuationTask.index > 1` 或显式 `isContinuation: true`；裁切帧取 `contextLength`（缺省 22 ≈ 0.92s）。
**这两句只出现一次**，写在正文里既无效又会被 lint 判为负面句；**不要自己重写** —— `lint.js` 按**值**整体
剥离它们，改写后剥离失效，每个续写段都会误报。

## 4. 音效两字段（不能空）

| 字段 | 写什么 | 数量 |
|---|---|---|
| `overall_soundscape` | 环境声、物理动作声、非语言人声（脚步/布料/碰撞/呼吸/笑）。**不含台词与配乐** | 1–4 句 |
| `non_diegetic_music` | 只有观众能听到的配乐：乐器 + 速度 + 节奏 + 动态 | 1–3 句，无则 `N/A` |

`overall_soundscape` 为空时编译器填兜底句 `Quiet environmental room tone with soft air movement.`
**并 push warning**（官方要求不能空）；`non_diegetic_music` 缺省即 `N/A`。
**不要写"不要 BGM"** —— 用 `N/A`，并且不要在别处提音乐氛围（提了会漏）。

## 5. 四类参考输入的编号规则（最容易错）

### 5.1 `<Picture N>` 的唯一权威：`services/ref-images.js` 的 `planImageSlots`

**编号 ≠ 参考图数组下标。** 首尾帧占槽，参考图从下一个空槽开始：`i2va` 首帧占 `图片1`、参考图从
`图片2` 起；`fl2va` 首帧 `图片1`、尾帧 `图片2`、参考图从 `图片3` 起；`ref2va` / `t2va` 不占槽，
参考图从 `图片1` 起。

`planImageSlots(mode, stagedRefs, stagedFirst, stagedLast)` 返回 `images`（**按槽位号定位的稀疏数组**，
长度恒 9，被占的槽是空串，**不是压缩列表**）、`pictureIndexMap`（参考图**原始下标 0-based** → 最终
`<Picture N>`）、`frameSlots` / `reserved`（首尾帧槽位与被占号）、`dropped`（槽位不足被丢的图，
调用方**必须告警，不能静默丢**）。

调用链固定：`resolveRefImages()`（角色卡 → 人设卡 → 手工 → 场景/道具，≤9）→ `resolvePrevizArtifacts()`
（首尾帧）→ `planImageSlots()`。不要包第四层快捷函数。

**必须遵守**：`<Picture N>` 一定取 `pictureIndexMap` 的值，**禁止用 `i+1`**。镜头卡里残留的
`subjects[].pictureIndex` 是**写入那一刻的快照**，参考图一增删就过期；`normalizeSubjects()` 一旦拿到本次
`pictureIndexMap` 就以 plan 为准，旧值丢弃并 push warning；没有 plan 时只能按下标兜底并**明确告警**
"该兜底不感知首/尾帧槽位，可能偏移"。

### 5.2 上限（`spec.js` 的 `H3_LIMITS`）

参考图 ≤ **9** 张、参考视频 ≤ **3** 段、参考音频 ≤ **3** 段（每段 2–15 s）。
**参考视频 + 音频合计 ≤ 14.8 s**（`render-plan.js` 的 `MAX_REFS_TOTAL_SEC`，贴 15 留 0.2 余量），
超出按「视频优先」自动裁并写 warning。**参考文件合计 ≤ 12 个**。

> 与 H3-**Image** 的 16 张**不是同一个概念**：9 是南风 `图片1..图片9` 的**槽位**上限（位置有限），
> 16 是 `MiniMaxH3ImageConditioning.images` 的 AUTOGROW 上限。两条通道各走各的。

### 5.3 `<Audio>` 是全局累加，视频音轨先占号 ★

1 个带音轨的参考视频 + 1 个独立音频 → `<Audio 1>` 是视频的音轨，`<Audio 2>` 才是独立音频。
`render-plan.js` 先给带音轨的视频分配 `audioIndex`，独立音频从 `audioCounter` 继续累加。
按"独立音频 = Audio 1"去写，提示词就全错 —— **编号由后端算，不要自己推。**
视频与其音轨**必须同号**（ComfyUI 按编号配对，不按数组顺序）；没有音轨的视频**不要**接
`ref_video_audios`。参考音频**不能作为唯一输入**（官方要求，本地节点不拦但音色会漂，编译器 push warning）。

### 5.4 参考视频必须声明用途，否则模型会照抄

`references.videoUses[]` 与 `subject_definitions` / `retention_analysis` 两处必须配对：

| 用途 | `subject_definitions` 里 | `retention_analysis` 标记 |
|---|---|---|
| `motion`（默认） | `is the source for camera movement, blocking and motion timing` | `attribute_transfer - transfer motion and camera movement only; do not copy characters or set` |
| `rhythm` | `is the source for editing rhythm and shot timing` | `weak_reference - follow edit rhythm only` |
| `mood` | `is the source for atmosphere and lighting only` | `weak_reference - follow atmosphere and lighting only` |
| `continuation` | `is the immediately preceding clip; the target video continues it directly` | `fully_preserved - continue characters, set and camera exactly` |
| `style` | `is the source for visual style only` | `attribute_transfer - transfer visual style only` |

`videoUses` 含 `motion` 时编译器额外追加灰模防泄漏句：
`Deliver a fully rendered frame in the target style; the reference video supplies motion and staging only.`

## 6. 画风库（**11 种**，`styles.js` 的 `STYLE_PRESETS`）

`en` 必须**整串照抄，不缩写、不改写、不合并** —— 截断会砍掉末尾的反模式约束
（`NOT 3D` / `NO subtitles` / `NO photorealistic textures`）。

| # | id | 名称 | 类别 | 改外观? | 自带 `NO subtitles`? |
|---|---|---|---|---|---|
| 1 | `helltaker-look` | 地狱把妹王（外观版） | 2D扁平卡通 | ✅ 会改 | ✅ |
| 2 | `helltaker-style` | 地狱把妹王（画风版） | 2D扁平卡通 | ❌ | ❌ |
| 3 | `ova90s` | 90年代OVA风 | 2D手绘赛璐珞 | ❌ | ✅ |
| 4 | `shinkai` | 新海诚风 | 2D手绘柔光 | ❌ | ✅ |
| 5 | `ghibli` | 吉卜力风 | 2D手绘柔光 | ❌ | ✅ |
| 6 | `american-toon` | 经典美式卡通 | 2D扁平弹性 | ✅ 会改 | ✅ |
| 7 | `ufotable` | 飞碟社风 | 3D背景+2D角色 | ❌ | ❌ |
| 8 | `toon3d-pbr` | 三渲二 + PBR混合 | 3D半写实 | ❌ | ❌ |
| 9 | `gohands` | GoHands 风 | 现代锐利 | ❌ | ❌ |
| 10 | `ligne-claire` | Ligne Claire（清晰线条 / 欧洲漫画） | 2D 平涂线条 | ❌ | ❌ |
| 11 | `vivziepop` | 地狱客栈（Vivziepop） | 2D 扁平卡通 | ✅ 会改 | ❌ |

> `shinkai` 与 `ghibli` 的 `en` 目前**逐字节相同**（都是 Ghibli/Shinkai 混合串）。选哪个只影响 `id`
> 与冲突判定，不影响画风文字。

**「不指定」不在上表里**：`/prompt/meta` 返回的 `styles` 是 **12 条** = 前置一个 `none`（「不指定（交给 LoRA）」）
+ 上表 11 条。`resolveStyle()` 优先级：`styleEn`（自定义英文）> `styleId` 命中 > `style`（自定义字符串）>
`none` > **回落 `STYLE_PRESETS[2]`（`ova90s`）**。用画风 LoRA 时必须显式选 `none`，否则内置 `ova90s` 会打架。

**字幕压制行（防线 1，编译器自动注入）**：上表里 6 种画风串不含 `NO subtitles`，由编译器**另起一行**追加
`Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.`
这不是画风串的一部分，所以不违反"逐字照抄"。**不要手写这一行。**

**选择建议**：要换角色长相 → 标了"会改"的三个；要保留原角色设计只换渲染风格 → 其余；
**有角色卡/参考图时优先选 `changesAppearance: false` 的**（否则风格会覆盖参考图里的设计）。
画风串 > `SHORT_STYLE_CHARS`（180 字符）时 `ref2va.js` **只给 warning，不截断** —— 官方串的约束句全在末尾，
砍了等于砍掉全部反模式约束；此时应简化 `subjects` 描述而不是砍画风串。

## 7. 打光库（**7 种**，`styles.js` 的 `LIGHTING_PRESETS`）

打光与画风**正交**，位置在风格之后、动作之前（基础格式并进开头风格句）。南风 221 参数里**没有任何打光参数**
—— H3 是纯提示词驱动，所以把「光比」翻成可观测的视觉描述。

| # | id | 名称 | 光比 | 档差 | 适用 |
|---|---|---|---|---|---|
| 1 | `none` | 不指定（跟随画风） | — | — | `en` 为空串，不写任何打光句 |
| 2 | `high-key-2-1` | 2:1 高调柔光 | 2:1 | 1 | 日系写真、清新日常、美妆、治愈系 |
| 3 | `classic-3-1` | 3:1 经典人像 | 3:1 | 1.7 | 对话戏、人物特写、常规叙事 |
| 4 | `dramatic-4-1` | 4:1 戏剧低调 | 4:1 | 2 | 悬疑、情绪戏、夜间场景 |
| 5 | `closeup-6-1` | 6:1 特写压迫 | 6:1 | 2.6 | 情绪特写、脸部压迫感 |
| 6 | `noir-8-1` | 8:1 极低调（黑色电影） | 8:1 | 3 | 黑色电影、暗黑美学、演唱会顶光 |
| 7 | `rim-backlit` | 强边缘光（逆光勾边） | 8:1 | 3 | 剪影、登场亮相、舞台、烟尘丁达尔 |

未知 id **静默回落到 `none`**（`resolveLighting`）。自定义：传 `{id:'custom', en:'…'}` 对象。

**画风 × 打光冲突（只进 warnings 不报错，两条格式路径都跑）**：`ligne-claire` ×
`dramatic-4-1`/`closeup-6-1`/`noir-8-1`/`rim-backlit`（平涂无强阴影）；`ghibli`/`shinkai` × `noir-8-1`
（柔光水彩 vs 沉入近黑）；`helltaker-look`/`helltaker-style`/`vivziepop` × `high-key-2-1`
（高对比块状阴影 vs 阴影几乎不存在）。

**光域授权（Bloom 只许出现在指定位置）**：光源域（日轮/会场灯/街灯/霓虹/水面反射点）放行，写
`hot core` + `soft halo` + `clip to pure white`；介质域（体积光柱/尘粒/海雾）放行但不加 `glow` 滤镜；
**人物域（皮肤/头发/睫毛/衣物/腿部）死守**，必须补一句"绝不溢光"。

```text
Bloom is confined to [域 A] and [域 B]: [A 具体写法], [B 具体写法],
both allowed to clip to pure white. [人物] stay clean, with no glow bleeding onto [器官列表].
```

强度三档：`clip` / `blown` / `frazzle`。✅ `hot core` `soft halo` `clip to pure white` `blown` `frazzle`；
❌ `glow overlay` `lens flare` `god rays` `soft light beams` `glowing orb`。
镜面分级是**镜头级参数**，逐镜指定（0 无 / 1 漫射 / 2 散乱 / 3 窄条），不许一段统一。

## 8. 压制词只有三处合法位置（`lint.js` 强制）

CFG 固定 1.0、采样器没有 negative 分支，所以正文里的"不要 X"**反而会把 X 拉进画面**。
但字幕/水印必须压 —— 解法是**按位置授权**，不是按词性豁免：

| # | 合法位置 | 例 | 谁写 |
|---|---|---|---|
| 1 | 画风串后的 `Text suppression:` 追加行 | `Text suppression: NO subtitles, NO on-screen text, …` | **编译器自动** |
| 2 | `detailed_description` 末尾的画面完整性句 | `Every element inside the frame belongs to the physical scene: … Nothing floats over the image.` | **编译器自动** |
| 3 | 具名物的属性声明（**正向句法**） | `a wooden signpost whose board carries no legible lettering and no text of any kind` | 你写 |

**其余字段一律不得出现独立负面句。** 口诀：句子主语是可画的东西 → 正向描述（"画面里只有…"）；
句子主语是「不要什么」→ 只在前两处（编译器注入）或第 3 处（`whose` / `with no` 句法）。

**反模式正则（`SUPPRESSION_RULES`）**：句首 `Do not xxx`（**区分大小写**）/ 句首 `Never` / `Avoid` /
两个以上连续大写 `NO a, NO b` / 句首句后 `不要` `禁止` `避免`。

扫描前按**值**整体剥离：四条机制句、两条压制句、`OFFICIAL_RELATIONS` 白名单
（`does not define character appearance` / `do not copy characters or set` / `do not copy the waveform` /
`do not follow characters or set` / `no reference picture was supplied` / `It carries no audio`）、
`Text suppression:` 整行、`whose|remaining …` 与 `with no xxx` 从句、以及**画风/打光串原文**。

> **v4 修过的误报**：`do-not` 规则**故意不加 `i` 标志**。官方画风串里 `DO NOT change…` 是句中大写，
> 加了 `i` 会命中句首规则（`helltaker-style` 的 `. DO NOT change character proportions.`）。
> 加上 `upper-NO-pair` 规则自身会命中 5 条（`helltaker-look` / `ova90s` / `shinkai` / `ghibli` /
> `american-toon` 自带 `NO subtitles, NO on-screen text`），**合计 6/11 画风固定误报**。
> 现在两道保险叠加：① `do-not` 不带 `i`；② 画风/打光串按值剥离（`bindAuthoredValues`）。
> 门面 `h3-prompt.js` 已调 `bindAuthoredValues([...STYLE_PRESETS.en, ...LIGHTING_PRESETS.en])` ——
> **绕过门面直接调 `lint.js` 时必须自己调它**，否则这 6 条仍会误报。

**lint 的其他检查**：① 字符上限（> 6000 给精简建议，> 7000 额外警告上游可能拒）② 时间区间 `[5s-8s]`
③ 方括号运镜 `[Pan left]` ④ 负面提示词（上节）⑤ 正文非英文（剥掉 `<d>…</d>` 与双引号后中文 > 10 且
> 拉丁 × 0.15）⑥ 结构字段（`ref` 查六段齐+序、`base` 查三字段齐）⑦ 字段名用了中文冒号 `：`
⑧ `<d>` 后不是 `[`（缺语言标签）。

## 9. 截断：保留尽可能多的完整块（`truncatePromptKeepFields`）

出口统一按**字段边界**截断 —— `slice(0, limit)` 会把六段从中间砍断（`overall_soundscape` /
`non_diegetic_music` 永远在最后，必丢）。算法：

1. 用 `FIELD_RE` 找出全部字段起点；**少于 2 个字段**时退回按句末截断（`truncateAtSentence`，绝不在单词中间切）
2. 每个字段按句末切成句子，对「保留句数上限 k」做**二分**（`lo=1, hi=maxSentences`）
3. 取「总长 ≤ limit 且 k 最大」的方案 → **字段不丢、顺序不变、每段尽量多留完整句**
4. 连 k=1 都放不下 → 退回 `truncateAtSentence(render(1), limit)`

实测：12517 字符输入 → 5951 字符输出，六个字段全在，末尾 `non_diegetic_music: N/A` 完好。

## 10. 硬约束速查

帧网格 **`17k+5`**（5, 22, …, 124, …, 345, 362）；最短 **124 帧 ≈ 5.17 s**（本地 `min` 取 5，官方口径 4），
最长 **362 帧 ≈ 15.08 s**；时长 5–15 s（`recommend = [5, 10]`，> 14 s 只告警）；分辨率宽高 **32 倍数**、
原生 1344×768、面积由档位 0.2–0.98 MP、2K 仅 API；CFG **1.0** 无 negative；步数 DMAD 4 或 8（蒸馏学生），
`none` 方案 20–80（推荐 50）；提示词 **≤ 6000 字符**（本插件收紧），官方硬上限 **7000**；
音频 VAE **必须 fp32**（fp16 会静音）。

**为什么收到 6000**：7000 是**硬性拒绝线**，不是**质量最优线**。实测 6500–7000 区间注意力开始被稀释：
`detailed_description` 的动作细节会被后段的光影与声音描述盖过，表现为「动作写得很细，但片子没做出来」。
压缩优先级：① 画风串后的重复描述（画风串本身**不可删减**）② 光影层里的解释性从句 ③ 声音行的重复
④ `retention_analysis` 的重复声明。

## 11. 官方反模式清单

| # | 反模式 | 后果 | 正确做法 |
|---|---|---|---|
| 1 | 写负面提示词 / ban list | `cfg=1` 无 negative 分支，**被点名的概念反而更容易出现** | 正向陈述；或用 `retention_analysis` |
| 2 | 只写一段话不分段 | 模型无法分配时间轴 | 按模式拆字段 |
| 3 | 素材上传了但没写用途 | 参考被静默忽略 | 每个素材写"参考什么 + 保留到什么程度" |
| 4 | 开头就写光线/形容词 | **模型对开头权重最高**，会拍成"关于光的镜头" | 顺序：主体 → 动作 → 镜头 → 光线 → 声音 |
| 5 | 堆叠风格词 | 与参考素材**互相竞争** | 有参考时风格词写少 |
| 6 | 一镜到底却写很多分镜 | 结构自相矛盾 | 删掉 `[Shot N]` 结构 |
| 7 | 台词时长超过镜时长 | **口型崩坏（最高频）** | 约 4–5 字/秒反推 |
| 8 | 时间戳写区间 `[5s-8s]` | 格式非法，区间被忽略 | 单点 `At 00:05.000,` |
| 9 | 把参考图都当关键帧 | 身份照当首帧，构图错位 | 身份参考写 `<Subject N>`；真要当帧才写 `<Picture N>` |
| 10 | 只写"用视频1做参考" | 模型连演员/背景/声音一起抄 | 用 `videoUses` 分别指派外观/动作/节奏/运镜/音频 |
| 11 | 同一声明的说话人重编号 | 路由错乱、角色说错台词 | `(Sx)` 全篇不变 |
| 12 | 音频标记用错 | 只想借音色却整轨照搬 | 复制用 `fully_copy`，借音色用 `reference` |
| 13 | 提示词过短（纯文生） | 官方明确列为失败模式 | 至少写全：主体外观 + 场景 + 动作 + 风格 |
| 14 | 中文提示词 | 非官方路径，效果不稳 | 正文英文；中文只在 `<d>` 与画面文字内 |
| 15 | 负面框写"不要 BGM" | 与"想要音乐"矛盾，仍会泄漏 | `non_diegetic_music: N/A` |
| 16 | 塞分镜标签 `[char:]`/`[shot:]` | 官方明确要求剥离 | 渲染前删干净 |
| 17 | 用 `i+1` 当 `<Picture N>` | 首尾帧占槽，整体差 1–2 位（串脸，不报错） | 取 `planImageSlots` 的 `pictureIndexMap` |
| 18 | 续写段手写"latent 承接"句 | lint 剥离失效 → 每段误报 | 交给编译器注入 |

## 12. H3-Image 专用规范

| 项 | H3 视频 | H3-Image |
|---|---|---|
| 步数 | DMAD 4 / 8，或 20–80 | **固定 6**（配置 4–12 仅排障，UI 无滑块） |
| CFG / 负面提示词 | 不支持（cfg=1） | **不支持**（`MiniMaxH3ImageConditioning` 无 negative 输入通道） |
| 参考图上限 | 9（槽位） | **16**（`MAX_IMAGE_EDIT_REFS`，第 1 张 = 被编辑原图） |
| 原生尺寸 / 面积上限 | 1344×768 / 0.98 MP | `auto` → 2048×2048（约 4.2 MP）/ `imageMaxMP` **4.3** |
| 尺寸表 | 档位表 | **12 档**（`IMAGE_SIZES`），宽高恒为 32 倍数 |
| 提示词长度 | 6000 | **4096 字符**（`IMAGE_PROMPT_MAX_CHARS`） |
| 超限行为 | 按字段边界截断 | **不截断**，直接 400 `PROMPT_TOO_LONG` |

**提示词写法**：① **参考图会直接进模型，不要用文字复述图片**（模型"看得见"，复述反而与图冲突）
② 只写**任务**：拆什么、怎么排、什么风格；数量必须与参数一致（选 3 个视角就写 3 个）
③ 不用 Markdown（`normalizeImagePrompt()` 会**自动剥掉**再压缩空白）④ **不用编号小标题**
（一、二、三 / 1. 2. 3.，实测图上会出现编号与乱码）⑤ **反向约束直接写"不要/禁止"** ——
H3-Image 的 prompt 是自由文本，编码器正常理解否定词；这与视频的铁律 2 **互斥**，不要混用。
语义不做改写：`normalizeImagePrompt()` 只剥 Markdown + 压空白，**不把"不要 X"改成"避免 X"**。

**4K 档会 OOM**：`h3-4k-sq`（4096²）/ `h3-4k-169`（5472×3072）是 **16.8 MP**，面积是 2048² 的 4 倍。
12 GB 卡实测 2048² 已用 11.4 GB；插件默认拦掉超过 `imageMaxMP`（4.3）的请求，要跑 4K 需 48 GB+ 并显式调大。

**LoRA**：`models/loras/h3img/<分类目录>/` 下按分类摆放；上限 **6** 槽、总强度 **±2**
（`IMAGE_LORA_STRENGTH_LIMIT`）。优先走 `LoraLoaderBypassModelOnly`（快 29%）；缺该节点时自动回退
`LoraLoaderModelOnly` 并写 warning（后者会随机重量化，脸/头发/线稿容易发糊）。

**局部重绘（`/image/inpaint`）**：`inpaintMode` = `crop`（推荐，外逐像素保真）/ `full`（源图必须 32 对齐）；
`inpaintStrength` = `full`/`strong`/`medium`/`light`（= SplitSigmas 切点 0/1/2/3，跑 6/5/4/3 步）；
`cropResolutionId` = `auto`（默认，按裁剪块长边 × 1.5 对齐 32）/ 512 / 768 / 1024 / 1280；
`bboxW`/`bboxH` 给了最准，否则从 mask 文件量，再不行按面积估算并写 warning。
**硬约束**：denoise 恒 1.0、步数恒 6（**忽略 `cfg.imageSteps`**）；mask 必须与源图**同尺寸**；
crop 模式要求 `vendor/inpaint-nodes` 已部署（否则提交前报 `INPAINT_NODES_MISSING`）；
提示词上限同样 **4096 字符**。

### 12.1 图像提示词的正确结构（编译器 `services/image-prompt/`）

本地**没有**官方那个 prompt expander（PE），所以「把一句话展开成完整描述」由编译器补。
官方推荐顺序（`spec.js` 的 `SECTION_ORDER`）：

```
用途 → 布局 → 主体 → 动作 → 场景 → 光线 → 相机 → 质感 → 文字
```

- **必须写英文**。中文能出图但遵循度明显更低；引号内的画面文字可以保留中文。
- **风格词放最后，且要用可观测的画法**：`flat cel shading` / `two-tone shadows` /
  `clean dark linework` / `35mm photo`。写 `masterpiece`/`cinematic`/`8k` 等于没写
  （`lint.js` 会列出来提示）。
- **`anime style` 不够**：底座在 2D 题材上天然偏 3D，2D 画风必须显式反着写
  （编译器按画风自动注入，见 §12.2）。
- **文字**：每个词进引号 + 说明位置；不想要文字就显式声明。
  ⚠️ 画面里有霓虹/招牌/海报/黑板这类"天然带字"元素时，**一句 `contains no text` 压不住**
  （实测会画出假名乱码），要用强化声明逐项点出"招牌表面只承载纯色"。

### 12.2 画风控制：只有三条通道，没有第四条

| 通道 | 强度 | 怎么用 |
|---|---|---|
| 提示词画法描述 | 中偏弱 | `styleId` 选预设，或自己写可观测的画法词 |
| **参考图（画风锚）** | **最强、零成本** | `styleAnchorImages` 传一张目标画风的成品图 |
| LoRA | 强但重 | `loras`，总强度 ≤2 |
| ~~负面提示词~~ | **不存在** | cfg=1；要避免的写进正面提示词 |
| ~~style 参数 / preset~~ | **不存在** | API / 节点 / 插件三层都没有 |

**画风锚的写法要点**（这是最容易翻车的一条）：

- 必须显式说明**只借画法与质感**，并**排除主体/构图/镜头角度的迁移** ——
  否则模型会把参考图里的人和物一起搬过来；
- 画风锚**不能混进 `refImages`**：那会占掉 `image_1`（决定画布尺寸 + 是被编辑的原图）；
- 只传 1 张（最多 2 张）。两张不同风格的图会互相拉扯，产出"既不 A 也不 B"的混合体；
- 参考图里有文字时，文字也可能被带进来。

正确示范：

```
a young woman reading by a window, soft afternoon light, 35mm photo,
matching the rendering style of <Picture 2> but with a different subject and composition
```

`anti3d.js` 会对 2D 类画风（11 套里的 9 套）自动追加反 3D 约束；
`ufotable`（3D 背景+2D 角色）与 `toon3d-pbr`（3D 半写实）**不注入** —— 它们本来就要 3D 打底，
硬加会与画风打架。

### 12.3 分级重绘：mask 的灰度就是重绘强度

H3-Image 的 mask **不是二值的**：`rows_t = 1 - m * sigma`，mask 值直接决定该像素的去噪强度。
所以可以做「有的地方大改、有的地方小改」。

**实测校准的可用档位**（`INPAINT_GRADED_LEVELS`）：

| 档 | mask | 实测改动量 | 用途 |
|---|---|---|---|
| `full` | 1.0 | 49.08 | 完全重新生成 |
| `strong` | 0.85 | 33.97 | 大改，保留大致构图 |
| `medium` | 0.7 | 5.07 | 换材质/换色/加装饰 |
| `light` | 0.55 | 2.31 | 小幅修饰 |
| `keep` | 0 | 0 | 完全不动（= 从选区擦掉）|

⚠️ **0.5 以下是塌陷区**：6 步 PDD 蒸馏下 `1 - m*sigma` 落在预测头交界处，
改动量只有 1.0 的 2.5%，几乎不可见。所以档位是**实测校准值，不是线性直觉**。

⚠️ 手动传灰度 mask 但不开 `graded` 时，`GrowMask` 会按邻域取最大值把档位压平
（连 0.55 都会被拉成 1.0）。要分级就必须 `graded: true`。

### 12.4 局部重绘的提示词要把「改完是什么样」写全

模型**没有 mask 感知**，它只知道"按提示词改这张图"。所以：

- 写「改完之后整幅图是什么样」，不是「在那个框里画什么」。
  `a red lantern` 可能得到「整幅图变成一个红灯笼」；
  正确是 `a night street with a red paper lantern hanging from the eaves, everything else unchanged`。
- 必须加保留句：`Keep everything else exactly the same.`
- 指向参考图时用 `<Picture 1>`：`Replace the car in <Picture 1> with the one in <Picture 2>.`
- **禁止链式多轮编辑**：实测第 3 轮开始崩、第 10 轮人已认不出。

## 13. 立绘拆解（角色设定卡）规范

**只有一个输入：整段提示词。** 后端**不做任何拼装、不改写、不追加**，只做 `trim` 与长度校验
（超 `BREAKDOWN_PROMPT_MAX_CHARS` = **4096** 直接 400，不静默截断）。前端与后端面对**同一个字符串**。
尺寸固定 `BREAKDOWN_SIZE`：申报 2368×1776，**提交时 32 对齐为 2368×1792**（4.24 MP）。

> ⚠️ 传 `character` / `outfit` / `parts` / `views` / `notes` / `level` / `expressions` 不会报错，
> 但**不再影响提示词**，响应里回 `legacyFieldsIgnored`。**必须至少 1 张参考图**，否则 400 `REF_IMAGE_REQUIRED`。

**五条原则**：① 不要用文字复述图片 ② 必须有"文字优先于参考图"的授权句 ③ 纯文本、不产 Markdown
④ 不要编号小标题（模型会把编号当成"要画在图上"的标签）⑤ 数量与文字一致（写三个视角就画三个）。

**授权句**（删掉这句，换装类改动必然失效）：文字里**明确写出**替换/新增 → 以文字为准，整体替换参考图
对应部分；文字**没有提到** → 严格照参考图还原。这样"不动 = 精准还原"和"改了 = 真的改"同时成立。

**细节锁**（拆解图最容易"简化"）：① 逐件单列（禁止合并/拆分）② 保持原比例与朝向（长裙不要画短、
斜挎不要画成正挂）③ 材质/纹样/五金/镶嵌逐项复刻（不要概括成"金色装饰"）④ 不丢小件（耳饰、戒指、
胸针、链扣、铆钉）⑤ 不做增删（只画参考图里存在的；不覆盖已明确要求替换的部分）。

## 14. 改分镜与检查清单

一镜一件事（动作多了会糊）；景别交替（别连着三镜都是中景）；时长 ≥ 5 秒（124 帧是物理下限，写 3 秒会被
抬到 5 秒并告警）；台词按 4–5 字/秒（5 秒镜头最多约 22 字）；参考视频里的人/道具/机位三样必须写进描述；
分段串联用 Ref2VA + AddGuide，不要用 FL2VA。

生成前逐条过：

- [ ] 模式选对了吗？（有视频/音频 → Ref2VA；有参考图 → Ref2VA；只有首尾帧 → 基础格式 + 对齐指令）
- [ ] 正文是英文吗？中文只在 `<d>` 与画面文字里？`<d>` 后带 `[Chinese]` 了吗？
- [ ] 有没有写"不要 XX"？（改成正向陈述，或交给编译器注入的压制行）
- [ ] `overall_soundscape` 填了吗？`non_diegetic_music` 填了吗？（无则 `N/A`，不是留空）
- [ ] 每个参考素材都在 `subject_definitions` 里有定义？`retention_analysis` 里有标记？
- [ ] `summary` 前缀用的是 6 个枚举之一，` + ` 连接？
- [ ] 音频用的是**音频那套**标记（`fully_copy` / `reference`），不是视觉标记？
- [ ] `<Picture N>` 是 `pictureIndexMap` 的值，不是数组下标？`<Audio N>` 把视频音轨算进去了吗？
- [ ] 时间戳是单点 `At 00:MM.SSS,`？帧数在 `17k+5` 网格且落在 [124, 362]？
- [ ] 总长 ≤ 6000 字符吗？（超了按 §10 压缩；出口会按字段边界截断，但那是兜底）
- [ ] 续写段：**没有**手写机制句（编译器自动注入）？
- [ ] 图像/局部重绘：反向约束直接写"不要"了吗（与视频相反）？提示词 ≤ 4096 字符？

**续写段的服饰一致性（强制）**：latent 只带「上一段的实际画面」，**不带这套衣服的设计说明**，不写就会
逐段漂。每段在 subject 定义之后加一行
`Outfit anchors, unchanged throughout and identical to every other segment: …`：
① 同一件衣服在各段用**完全相同的英文词**（否则模型当成两件、中途换装）② 配饰必须带**左右方位**
（否则左右互换或位置漂移）③ 显式写「材质反应与上段相同」（否则蕾丝被平滑成平布）④ 不要用「同上段」
省略（续写没有"同上"通道）。镜面分级可随镜别变（远景 1 级 → 特写 3 级），那是镜头语言；但材质本身
（尼龙 / 蕾丝 / 皮革）**绝不能变**。完整说明见 `h3-group-master` 的 §1.6.5。

## 15. 出处

- 官方 skill `h3-prompt-writing`：`references/base-en.txt`（基础格式）、`references/ref-en.txt`（六段格式）
  —— 本仓库同步副本在 `skills/prompt/h3-official/references/`
- ComfyUI 官方提示词指南 `docs.comfy.org/tutorials/video/minimax/`；官方模型卡
  `huggingface.co/MiniMaxAI/MiniMax-H3`；节点源码 `comfy_extras/nodes_minimax_h3.py`（帧网格、无 negative）

**明确属本地自造的**：`H3镜头输入包` schema、`OVA90s` / `Helltaker-look` / `toon3d-pbr` 等风格命名、
`LIGHTING_PRESETS` 的光比档位。这些不作为官方内容宣称。