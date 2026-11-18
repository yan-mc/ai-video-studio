---
name: h3-group-master
description: H3 实战总纲 v2.1（社区实战验证，2105 行）。涵盖模式判定与提交参数、潜空间续写、六字段结构、画风池、人物档案、场景锚点、光影七段式（含镜面分级与 Bloom 域授权）、分镜与情绪写作法、声音与台词、Seedance→H3 转换规程、禁词与压制词体系。当需要写 H3 提示词、规划多段连续长视频、或排查接缝/运镜/质感/表演问题时使用。优先级高于 jiuzhang-prompt-spec（后者为本插件编译器的规范说明）。
version: 2.1.0
适配说明: |
  原始文件由群友整理，本插件只做了三处适配，正文逐字保留：
  1. 补 frontmatter（name/description/version），使其可被技能系统加载
  2. 在末尾追加「与本插件的对应关系」一节，说明哪些规则已固化进代码
  3. v2.1 的章节编号（第零章~第十六章）原样保留
---

# H3 Skill 总纲 v2.1（群友实战版）

> 这份文档是社区实战总结，**不是官方文档**，但里面的实测数字很硬
> （裁切 0.92s、九段 45.6s、四档光比模板、Bloom 域白名单等），
> 本插件已据此修正过多处代码。
>
> ⚠️ **参数层不能照抄**：v2.1 的分辨率/步数/6s 时长是**群友自己平台**的实测值，
> 本地南风 V15 的档位完全不同。规则层（禁词、光影、分镜、情绪、画风兼容性）
> 可以吸收，参数层一律以本插件渲染页的预设为准 —— 见文末「与本地参数的差异」。


**潜空间续写 · 六字段结构 · 画风池 · 人物档案 · 场景锚点 · 光影系统 · 分镜写作法 · 禁词体系 · Seedance 转换规程**

---

# 第零章　模式判定与提交参数

## 0.1 模式判定（先做，选错全废）

| | **基础模式** | **全参考模式 R2VA** |
|:---|:---|:---|
| 主字段 | `integrated_multimodal_description` | `detailed_description` |
| 字段数 | 3 | **6** |
| 参考图片 | 单张（首帧 / 尾帧） | 多张 |
| 参考视频 | 无 | 有 |
| 参考音频 | 无 | 有 |

**判定规则**：有 2 张以上参考图，或有音频参考 → **必走六字段**。

多图走基础模式属模式错配，图会被当成「首帧」处理，其余全丢。

## 0.2 六字段顺序（不可变更）

```
subject_definitions
summary
retention_analysis
detailed_description
overall_soundscape
non_diegetic_music
```

## 0.3 提交参数

| 项 | 值 |
|:---|:---|
| 单段请求时长 | 6s（段 1 可 5s） |
| 单段交付时长 | 请求 − 0.92s ≈ 5.08s |
| 画面比例 | 16:9 |
| 帧率 | 24fps |
| Prompt Optimizer | **关闭**（必须） |
| 种子 | 全片统一 |
| Motion | 中等（纯环境段调低） |
| CFG | 默认 |
| 参考图上限 | 9 张 |
| 参考视频上限 | 3 段 |
| 参考音频上限 | 3 段 |
| 提示词总长 | **≤ 6,000 字符**（本插件收紧；官方上限 7000，但实测 7000 会稀释注意力） |

## 0.4 分辨率与步数分配

| 类型 | 分辨率 | 步数 | 理由 |
|:---|:---|:---|:---|
| 全景 + 人物小 | 640p | 16 | 人脸像素少，需保像素 |
| 中景文戏 | 608p | 14 | 走路不算动作戏 |
| 肢体交互 | 608p | 16 | 手部、布料、接触 |
| 纯环境全景 | 640p | 16 | 无人物，640p 最优 |

## 0.5 分段策略

**无固定段数。** 每段请求 ≤6s，按叙事节拍切分。

| 排布 | 段数 | 总时长 |
|:---|:---|:---|
| 常规对话片 | 9 段 | ≈45.6s |
| 镜头较密（含内切） | 10–11 段 | ≈50–56s |

单段内允许 **1 次硬切**（两个 Shot）。单段内切超过 1 次 → 拆段。

---

# 第一章　潜空间续写

## 1.1 平台机制

| 项 | 结论 |
|:---|:---|
| 续写方式 | **潜空间续写（latent continuation）** |
| 状态来源 | 上一段的**实际生成结果**，不是文字描述，不是尾帧图，不是参考视频 |
| 段 1 | 独立起帧，**不裁切** |
| 段 2 起 | 生成时先重演上一段尾部，交付前裁掉 |
| 裁切量 | **固定 0.92s**（请求 6s → 交付 5.08s） |
| 段 1 请求 | 5s 或 6s 均可（不裁） |
| 段 2 起请求 | **6s**，交付 ≈5.08s |

## 1.2 三个必然

**必然 1：latent 是保守的。**
它倾向于「接着演」，而不是「发生新事」。不写变化，画面就维持不动。所有该发生的变化——太阳下落、表情逆转、起身、光档切换——**必须用文字推**。

**必然 2：文字覆盖不了实帧。**
上一帧她右脚在前，你写「左脚在前」，模型只能二选一。**写死首帧姿态，就是在制造矛盾。**

**必然 3：被裁的 1 秒是废区。**
写在第 0 秒的动作、台词、运镜，全部落进裁切区，交付画面里不存在。

## 1.3 续写开关（段 2 起，置于最顶部）

```
The actual carried latent motion from the previous segment governs the current action and camera state. No reference picture resets pose, body position, hand placement, expression, gaze or framing. The lighting direction and time of day continue unchanged from the previous segment.
```

三个组件，缺一不可：

| 组件 | 语义 | 缺了会怎样 |
|:---|:---|:---|
| `the actual carried latent motion governs...` | 状态权威交给实帧 | 模型按文字重新推导 → 接缝断裂 |
| `No reference picture resets pose...` | 禁止参考图把姿态拉回图中样子 | 人物摆回立绘姿势 |
| `The lighting... continue unchanged` | 光与时段继承 | 每次切镜色温跳变 |

**位置：必须在最顶部，任何字段之前。** 它是全局指令，放中段会被上下文稀释。

## 1.4 段 1 的开场声明（必写）

```
This is the opening segment of the film. No earlier segment exists; nothing is carried in, and both the camera and the figures start fresh.
```

这是唯一允许在首帧直接摆姿态的段落。段 1 不受 0.92s 裁切约束，第一秒是有效画面。

## 1.5 时序纪律句

**段 2 起（标准句）**

```
Timing discipline: the first second is the carried overlap region and carries no new event — no new gesture, no new head turn, no new line, and no camera move begins inside it. Every action described below begins at the one-second mark.
```

裁切实测 0.92s，**安全边界写 1.0s**。前 1 秒只允许「延续」。

**段 1（反向句）**

```
Timing discipline: this is the opening segment, so there is no carried overlap region and the first second is fully authored. Every action below may begin at the first frame.
```

## 1.6 承接与重述

### 能承接的（只声明，不写数值）

| 类别 | 例子 |
|:---|:---|
| 步态相位 | 哪只脚在前、迈到哪一步 |
| 身体朝向 | 侧身、正面、转身角度 |
| 坐姿 | 坐的位置、双腿方向、上身前倾程度 |
| 两人间距 | 肩距大约一手宽 |
| 机位 | 距离、角度、高度（未切镜时） |
| 光 | 方位、色温、光比、太阳高度 |
| 表情细节 | 微笑的幅度、眼睑位置 |
| 材质状态 | 布料高光的位置与长度 |

```
Carried state: the walking rhythm, the stride phase, the spacing between the two figures, both head angles, the light direction and the camera state are inherited and not re-derived.
```

### 必须重述的四类

**类 1：出画项** —— 上一帧没拍到，latent 里没有。

```
Must restate because it fell outside the previous frame: Sakiko's left hand is still flat on her own left knee and stays there; Mutsumi's hands stay on her own knees until she moves them.
```

触发条件：切镜后景别变化、构图变化、人物进出画。

**类 2：被遮挡的识别特征** —— 发卡在远离镜头那一侧时不可靠。

```
The light green hairpin sits above her left ear against her light green hair, and the right side of her head is bare.
```

头部可见的每一段都要重述睦子发卡方位。

**类 3：抽象规则** —— 不是画面信息，latent 不保存。

- 服装 / 腿部装束 / 鞋子继承哪张图
- 头发不能变短
- 胸围设定
- 声线归属

每段都要写。

**类 4：需要推进的变化** —— latent 保守，不写就不动。

```
Then the sun descends steadily until its lower edge touches the sea.
Then her eyelids lower into a narrowed, sly look.
Then Sakiko pushes up from the bench in one continuous motion.
```

凡是「然后」开头的变化，都必须显式写。

## 1.6.5 续写时的服饰一致性（强制要求）

> **为什么单开一节**：服饰是续写里最容易漂、也最容易被忽视的一类。
> latent 只携带「上一段的实际画面」，**不携带「这套衣服的设计说明」** ——
> 它会把上一段看到的布料颜色糊成一片，把蕾丝糊成一块布，
> 把「黑金刺绣长裙」慢慢漂成「黑色长裙」，再把开叉位置漂走。
>
> 上面「类 3：抽象规则」虽然提了一句「服装继承哪张图」，
> 但那只是**一句声明**，不足以钉住细节。服饰需要更具体的写法。

### 三类服饰信息，待遇完全不同

| 类型 | 例子 | 写法 |
|:---|:---|:---|
| **会自然延续的** | 布料整体色相、服装大致轮廓 | 只声明继承，不重述 |
| **会被逐段稀释的** | 刺绣纹样、蕾丝密度、金属件位置、开叉高度、褶皱走向 | **每段重述一次，且要用同一组词** |
| **必须锁死的** | 配饰的左右方位、图案方向、扣具位置、鞋跟高度 | **每段逐项复述，措辞不变** |

### 标准句式：服饰锚点行（每段必写，紧跟在 subject 定义之后）

```text
Outfit anchors, unchanged throughout and identical to every other segment: [角色] wears [上装] with [具体工艺/材质/纹样], [下装] with [开叉/褶皱/内衬描述], [腿部装束] with [透明感/花纹/光泽层级], [鞋] with [跟高/绑带/扣具], plus [配饰逐项，含左右方位]. The fabric is matte [或 silk/leather/lace]，它的 [关键材质反应] 与上一段完全相同。
```

具体到本地两个角色的写法（可直接复用）：

```text
Outfit anchors for <Subject 1>, unchanged throughout and identical to every other segment: a black off-shoulder corset top with gold frog-clasps and a black bow collar carrying a square emerald, white lace cuffs at both wrists, a floor-length black skirt whose stiff outer panel carries gold embroidered vinework with a vivid crimson silk lining visible at the high front slit, a black lace underskirt beneath it, knee-high black boots with cross-lacing and a stacked heel, a thin gold choker with a sapphire drop, gold earrings and rings, a gold chain at the waist and a black cummerbund. All fabric is matte with flat block shadows; the lace stays strictly matte and never turns glossy.
```

```text
Outfit anchors for <Subject 2>, unchanged throughout and identical to every other segment: a black lace off-shoulder top with a blue ribbon bow at the breast and lace ruffle sleeves, a layered black tulle skirt with tiny gold and violet floral embroidery and a black lace hem over a white petticoat, black semi-sheer tights carrying a small gold dot pattern, black ankle boots with metal buckles, a sapphire-and-gold chain at the throat, sapphire drop earrings, a gold bracelet, and a black lace open-front long cape. All fabric is matte with flat block shadows; the tights keep their scattered sheen only where the fabric is stretched, never a mirror gloss.
```

### 四条铁律

| # | 铁律 | 违反后果 |
|---|---|---|
| 1 | **同一件衣服在每一段用完全相同的词**（不要这段说 `corset`、下段说 `bodice`） | 模型会当成两件不同的衣服，中途换装 |
| 2 | **配饰必须带左右方位**（`above her left ear`，不是 `on her head`） | 左右互换，或每段漂一个位置 |
| 3 | **材质反应要显式写「与上段相同」** | latent 会把它平滑掉，蕾丝逐渐变成一块平布 |
| 4 | **不要用「同上段」省略** | 续写没有「同上」的通道，不写就是不写 |

### 与「镜面分级」的配合

服饰的镜面反应属于 §6.6 的镜面分级，但**分级可以按镜别变化，材质本身不能变**：

```text
镜面分级：本镜 2 级（a soft scattered sheen present only where the palm presses）
服饰锚点：the black nylon keeps its scattered sheen wherever the fabric is stretched, and nowhere else
```

分级变了（远景 1 级 → 特写 3 级）是**镜头语言**，
材质从「尼龙」变「乳胶」是**错误** —— 前者由镜别决定，后者绝不允许发生。

### 自查

- ☐ 每一段是否都有 `Outfit anchors` 行？
- ☐ 同一件衣服在不同段用的词是否**完全一致**？
- ☐ 配饰是否都带了左右方位？
- ☐ 是否写了「材质反应与上段相同」？
- ☐ 有没有用「同上段」偷懒？

---

## 1.7 段尾免责句

每段 `detailed_description` 末尾固定加：

```
The intended new beat is placed after the carried [承接物] overlap: [动作] begins only after the first second, and [细节] follows the carried [状态] without asserting the previous segment has ended at an exact [状态类型].
```

参数化取值：

| 承接物 | 状态类型 |
|:---|:---|
| walk | gait phase |
| approach | stride position |
| seated | hand position |
| contact | hand position |
| close-up | facial pose |
| two-shot | expression |
| wide-shot | light state |
| standing | state |

**核心**：`without asserting the previous segment has ended at an exact [state]` = 我不假定上段末帧的精确状态。把决定权交给实帧。

## 1.8 段 1 与段 2 起的分岔

| 项 | 段 1 | 段 2 起 |
|:---|:---|:---|
| 顶部 | 无开关，写「开场无承接」 | 三句开关 |
| 首帧姿态 | **可以写死** | **禁止写死** |
| 第一秒 | 有效，可放动作 | 废区，不得放动作 |
| 动作起点 | 0s | 1s |
| 时间纪律句 | 反向句 | 标准句 |
| 请求时长 | 5s 或 6s | 6s |

---

# 第二章　六字段结构

## 2.1 `subject_definitions`

只定义「引用素材是什么」。不写动作、不写姿态、不写机位、不写表情。

### 人物标准句式

```
<Subject N> is the visual content referenced from <Picture N>, [角色名], with [外观逐项]. Her clothing is inherited from <Picture N>.
```

外观必须逐项列，不可概括：

| 项 | 写法示例 |
|:---|:---|
| 发 | long grey-blue hair running the full length of the back of her head |
| 瞳 | golden eyes |
| 身高 | 160 cm tall |
| 胸围 | a C-cup chest |
| 神态 | Her gaze is calm and sharp, carrying an air of quiet authority. |
| 识别特征 | one light green hairpin clipped above her left ear on her own left side |
| 反向确认 | with the right side of her head bare and carrying no hairpin or ornament of any kind |
| 着装 | Her clothing is inherited from `<Picture N>`. |
| 装束锁定 | Her legwear and her shoes stay exactly as in `<Picture N>`. |
| 发长锁定 | Her hair stays long, reaching fully down the back of her head. |

### 场景标准句式

```
<Subject N> is the [场景名] referenced from <Picture N>, with [架构元素逐项].
```

场景元素必须列到可定位的程度：方位、数量、材质、朝向。

**排他声明（必写）：**

```
Exclude <Picture N>'s camera angle, its framing, its empty composition, its daytime sky, its white cumulus clouds, and all of its light.
```

不写这句 → 参考图的构图被锁死 → 中景、近景、推镜全部被拽回全景。

### 音频标准句式（社区成功语法，逐字使用）

```
<Audio N> is the voice-timbre reference for <Subject N> (SN): [音色]. Use only its vocal timbre; do not describe or reproduce any semantic content from the audio.
```

后半句不可省，不可改。省了模型会照抄参考音频里的台词。

### 禁止项

| ❌ | 原因 |
|:---|:---|
| 字段里写 `Sakiko stands with her hands on her knees` | 姿态属 `detailed_description`，且与 latent 冲突 |
| 顶部 `<Picture 1>` 写一次身份，字段里再写一次 | 双重绑定，互相打架 |
| `<Subject 1> is Sakiko, appearance from <Picture 1>` | 空洞定义，特征全丢 |
| 把 `<Picture N>` 单列成一行重复描述 | 应写在 `<Subject N>` 内部 |

### 绑定只做一次

```
顶部：只有续写开关，无身份
字段：<Subject 1> is the visual content referenced from <Picture 1>, Sakiko, with long grey-blue hair...
```

## 2.2 `summary`

一句话概括全片或本段内容与参考关系。

**一段纯描述，不加方括号前缀。**

```
[reference generation] Two young women walk along a seaside resort promenade at sunset...
```

**`[video continuation]` 禁止使用。** 语义是「延续已有源视频」，会触发 `<Video 1>` 引用；没传视频会误判。

| 段 | 内容配比 |
|:---|:---|
| 段 1 | 全片情境 + 素材分工 |
| 段 2 起 | 一句动作概括 |

禁止写分辨率、帧率、步数。

## 2.3 `retention_analysis`

### 保留标记（视觉）

| 标记 | 语义 |
|:---|:---|
| `fully_preserved` | 定义的角色完全保留 |
| `partially_preserved` | 仍在使用，但部分特征被改或只部分保留 |
| `attribute_transfer` | 特征转移到另一个主体 |
| `weak_reference` | 只保留风格 / 类别 / 构图 / 氛围的大致相似 |

### 保留标记（音频）

| 标记 | 语义 |
|:---|:---|
| `fully_copy` | 完整音频作为成片完整音轨 |
| `partially_copy` | 只复制部分时间轴或部分音层 |
| `reference` | 不复制，只参考音色 / 节奏 / 风格 / 台词内容 |
| `weak_reference` | 只保留类别或氛围的大致相似 |

### 四块结构（顺序固定）

**第 1 块：素材保留**

```
<Subject 1>: fully_preserved - appearance, hair, build and clothing from <Picture 1>.
<Subject 2>: fully_preserved - appearance, hair and full outfit from <Picture 2>. The hairpin stays above her left ear in every shot; the right side of her head stays bare.
<Subject 3>: partially_preserved - layout and materials from <Picture 3>; camera angle, composition, daytime sky and lighting replaced.
<Picture 1>, <Picture 2>, <Picture 3>: fully_preserved as references for their subjects.
<Audio 1>, <Audio 2>: reference - timbre only; no semantic content copied.
```

**第 2 块：承接声明**

```
Carried state: the walking rhythm, the stride phase, the spacing between the two figures, both head angles, the light direction and the camera state are inherited and not re-derived.
```

只声明类别，不写数值。

**第 3 块：重述项**

```
Must restate because the scale changed in the cut: the hand at the lower-left edge is Sakiko's right hand, still resting on the black tights, with exactly five distinct fingers and clear joints.
```

**第 4 块：机位意图**

```
The camera cuts to a new locked-off setup at the first frame.
```
或
```
There is no cut: this segment occupies the same setup as the previous one.
```

### 禁止项

| ❌ | 原因 |
|:---|:---|
| 堆放 `Forbidden: no extra fingers, no subtitles...` | 非官方字段，负面词无通道 |
| 重复 `subject_definitions` 里的外观全细节 | 冗余，稀释注意力 |
| 写具体首帧姿态数值 | 与 latent 冲突 |
| `Carried state` 写进 `detailed_description` | 挤占画面描述的注意力预算 |

## 2.4 `detailed_description`

### 七层结构（顺序固定）

```
第 1 层  画风串（逐字复制）
第 2 层  追加压制行
第 3 层  光影层（七段式，见第六章）
第 4 层  Timing discipline
第 5 层  节拍正文（[Shot N] + 景别 + 位置 + 动作 + 运镜 + 约束）
第 6 层  Sound 行
第 7 层  画面完整性句 + 免责句
```

### 长度

官方建议 **350–500 英文词**。

- 对话密集段：优先塞满台词时间轴，不为凑字数
- 超过 700 词：拆镜
- 低于 250 词：细节不足，易糊

### 画风串与机位冲突

画风串若自带机位句（如 `The camera holds a perfectly static shot throughout`），而该段需运镜：

```
[画风串，删除 static shot 句]
Camera note for this segment: it is the exception to the static-shot default — the camera performs one continuous truck right at slow speed, holding a constant distance and side-view angle, and does not zoom, pull out or reframe.
```

画风串其余部分一字不改。

### 光影层禁止复用指代

```
❌ same lighting and material rules as the opening
❌ as before
❌ unchanged from previous
```

每段是独立请求，模型手里不一定有上一段的文本。指代悬空 → 光影漂移。

## 2.5 `overall_soundscape`

1–4 句连续段落，概括全片环境音、物理动作音、非语言人声。

```
Steady sea waves against the shore, distant gulls, a light evening breeze, and soft footsteps on stone. All sounds are diegetic.
```

| ❌ | 原因 |
|:---|:---|
| 重复 `detailed_description` 里的台词 | 归属错误 |
| 重复叙事内音乐（角色能听见的） | 同上 |
| 写 `No BGM` | 负面词，改用 `non_diegetic_music: N/A` |
| 只写一个词 | 官方要求 1–4 句 |

## 2.6 `non_diegetic_music`

1–3 句，描述只有观众能听见的配乐。只写乐器、速度、节奏、动态变化。

```
Sparse piano notes at a slow tempo, joined by sustained low strings that gradually increase in volume before fading out.
```

| ❌ | 原因 |
|:---|:---|
| `Melancholic and nostalgic` | 官方明确禁止抽象情绪词 |
| `dark, epic, cinematic` | 同上 |
| 写角色能听见的音乐（收音机、手机） | 属叙事内，写进 `detailed_description` |

无配乐 → `N/A`。这是唯一正确的「无 BGM」写法。

---

# 第三章　画风池

## 3.1 使用规则

| 规则 | 说明 |
|:---|:---|
| 位置 | 只在 `detailed_description` 第 1 层 |
| 复制方式 | **逐字照抄**，不缩写、不改写、不合并 |
| 含负面词的属官方模板 | `NOT 3D`、`NO photorealistic textures` 原样保留 |
| 含 `4K / 8k` | 只写在 `detailed_description` 内合规范，不进 `summary` |
| 含机位句的 | 需运镜的段加 override 行（见 6.15） |
| 统一追加 | 所有画风串后**一律追加压制行**（见第十五章） |
| 是否改角色设计 | 标「改变」的可改比例，「不改变」的动作特征必须守参考图 |

## 3.2 画风 1：地狱把妹王（外观版）— 改变角色设计

```
Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cartoon character design with exaggerated proportions — slightly larger head, slender limbs, flat torso, simplified geometric shapes. Thick, bold, jagged black outlines. Flat cel-shaded coloring with heavy block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. NO photorealistic textures, NO realistic skin shading, NO 3D proportions, NO PBR materials. NO subtitles, NO on-screen text.
```

## 3.3 画风 2：地狱把妹王（画风版）— 不改变角色设计

```
Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cel-shaded coloring with heavy block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. DO NOT change character proportions.
```

## 3.4 画风 3：90 年代 OVA— 不改变角色设计

```
90s OVA retro cel-animation style. High saturation, hard cel-shaded shadows, soft gradient blush on cheeks (blending naturally from pink to warm red), film grain texture. Natural anime facial bone structure. Upper eyelid shadows rendered with natural gradients. Render characters as 2D hand-drawn anime, NOT 3D. NO photorealistic textures. NO subtitles, NO on-screen text.
```

## 3.5 画风 4：新海诚 / 吉卜力风 — 不改变角色设计

```
Studio Ghibli / Makoto Shinkai inspired cinematic anime style. Soft atmospheric lighting, bokeh depth of field, warm natural sunlight, gentle pastel gradients. Soft cel-shaded character rendering with gentle shadows. Render characters as 2D anime, NOT 3D. NO photorealistic textures. NO subtitles, NO on-screen text.
```

## 3.6 画风 5：经典美式卡通 — 改变角色设计

```
Classic American cel-animation style. Confident, evenly weighted outlines defining exaggerated, highly readable proportions. Flat color fill with minimal shading — no gradients, no complex shadows. Elastic, squash-and-stretch sense of form. Cheerful, uncomplicated composition. NO photorealistic textures. NO subtitles, NO on-screen text.
```

## 3.7 画风 6：三渲二 + PBR 混合 — 不改变角色设计

```
3D cel-shaded anime style with PBR physical rendering. Semi-realistic anime style, 3D character rendering with subtle dark thin contour lines (thin, NOT thick hand-drawn lines), soft cel-shaded coloring mixed with realistic material rendering. Subsurface scattering on skin. Soft studio lighting, smooth shadows with gentle transitions, soft diffuse shadows, no harsh blocks. Hair rendered as 3D physical strands. Clean render, delicate materials. NO thick black hand-drawn outlines, NO flat cel-shading only, NO photorealistic human textures.
```

## 3.8 画风 7：飞碟社风 （Ufotable）— 不改变角色设计

```
Ufotable animation style. Digital painting with high contrast cinematography. Photorealistic detailed backgrounds. 2D cel-shaded characters with large hard shadows. Dramatic lighting with strong sunlight and sharp contrast. Particle effects including flames, sparks, exhaust trails. Deep color palette with lower saturation. Render characters and vehicles as 2D cel-shaded, NOT realistic. NO photorealistic textures on characters. NO thick black outlines. NO gradients.
```

> 需 bloom 时删除串内 `NO soft lighting`（bloom 属光源本体，不属 soft lighting）。

## 3.9 画风 8：Ligne Claire — 不改变角色设计

```
Ligne claire style, clean line art, flat color fills, minimalist composition, muted pastel palette, whimsical digital illustration, children's book art style, painterly texture, dappled sunlight, magical glow, soft grain, floating dust particles, gentle light shifting, high quality, cinematic lighting, 8k, masterpiece.
```

> 使用时删去 `Slow camera pan, subtle motion` 两句（与本段机位指令冲突）。

## 3.10 画风 9：地狱客栈（Vivziepop）— 改变角色设计

```
Vivziepop style, Hazbin Hotel animation style, Jhonen Vasquez influence, jagged angular cartoon illustration, gothic-adjacent proportions, elongated limbs, spiky unstable silhouette, bold high-contrast shading in stark graphic blocks, thick confident black outlines, asymmetrical twitchy posing, darkly quirky kinetic energy, 2000s cult cartoon style, flat color, masterpiece, high quality.
```

## 3.11 画风 10：90 年代成人剧场 OVA — 当前主用

```
90s Japanese adult OVA theatrical animation style. Cel animation texture, high saturation, hard shadows. 4K resolution. CRITICAL: All hands must have exactly five distinct fingers with clear joints. No limb duplication. The camera holds a perfectly static shot throughout
```

> 本串**不含字幕压制句**，因此所有画风统一追加压制行（第十五章）。

## 3.12 取舍对照

| 需求 | 选 |
|:---|:---|
| 黄昏空气感、柔和 | 画风 4 |
| 复古赛璐璐、高饱和 | 画风 3 |
| 剧场级硬阴影、成人向 | **画风 10** |
| 纯黑剪影、高对比 | 画风 9 |
| 写实沉重、电影感背景 | 画风 7 |
| 硬朗图形化、色块 | 画风 1 / 2 |

## 3.13 画风与 bloom 拉满的兼容性

| 画风 | 兼容性 | 处理 |
|:---|:---|:---|
| **10 / 3** | ✅ 完全兼容 | 直接用 |
| 4 | ✅ 极度兼容（自带 bokeh、soft atmospheric lighting） | 直接用，可再加一档强度 |
| 7 | ⚠️ 串含 `NO soft lighting` | 删该句，其余保留 |
| 8 | ⚠️ 自带 `magical glow` `Slow camera pan` | 删 `Slow camera pan`，`magical glow` 保留 |
| 6 | ⚠️ 自带 `soft diffuse shadows` | 可用；硬边声明改 `smooth shadows with gentle transitions` |
| 1 / 2 / 5 / 9 | ❌ 含 `no gradients` 或 `stark graphic blocks` | 不用于 bloom 主导的段落 |

---

# 第四章　人物档案

## 4.1 祥子（Sakiko / S1）

| 项 | 内容 |
|:---|:---|
| 发色 | **灰青色** |
| 发长 | **后头部完整长发** |
| 瞳色 | **金色** |
| 身高 | 160 cm |
| 胸围 | **C 罩杯** |
| 神态 | 眼神冷静、锐利，带上位者的压迫感 |
| 声线 | 清澈、含气多、有品位的语调 |
| 禁项 | 变短发、巨乳、任何发卡 |

**`subject_definitions`**

```
<Subject 1> is the visual content referenced from <Picture 1>, Sakiko, with long grey-blue hair running the full length of the back of her head, and golden eyes. She is 160 cm tall with a C-cup chest. Her gaze is calm and sharp, carrying an air of quiet authority. Her clothing is inherited from <Picture 1>. Her hair stays long, reaching fully down the back of her head, and she carries no hairpin.
```

**`<Audio N>`**

```
<Audio 1> is the voice-timbre reference for <Subject 1> (S1): a clear voice carrying a great deal of breath, with a refined and composed manner of speech. Use only its vocal timbre; do not describe or reproduce any semantic content from the audio.
```

**`Sound:` 行**

```
Sound: <Subject 1> (S1), a clear voice carrying much breath with a refined and composed manner of speech, says, <d>[Japanese] 台词</d>
```

## 4.2 睦子（Mutsumi / S2）

| 项 | 内容 |
|:---|:---|
| 发色 | **浅绿色** |
| 发长 | **含后脑勺完整长发** |
| 睫毛 | **浅绿色** |
| 瞳色 | **琥珀色** |
| 特征 | 眼角带独特**倦怠感** |
| 身高 | 155 cm |
| 胸围 | **B 罩杯** |
| 发饰 | **仅左耳上方一只浅绿发卡；右侧无任何饰物** |
| 声线 | 轻、柔、略带沙哑 |
| 禁项 | 右耳出现发卡、双侧发卡、巨乳、短发 |

**`subject_definitions`**

```
<Subject 2> is the visual content referenced from <Picture 2>, Mutsumi, with long light green hair including the full back of the head, light green eyelashes, and amber eyes. A distinctive weary look sits at the outer corners of her eyes. She is 155 cm tall with a B-cup chest. One light green hairpin is clipped above her left ear on her own left side, with the right side of her head bare and carrying no hairpin or ornament of any kind. Her clothing is inherited from <Picture 2>. Her legwear and her shoes stay exactly as in <Picture 2>.
```

**`retention_analysis` 每段必带**

```
The hairpin stays above her left ear in every shot; the right side of her head stays bare.
```

**双侧都入画的近景，`detailed_description` 里再加一句**

```
The light green hairpin sits above her left ear against her light green hair, and the right side of her head is bare.
```

**`<Audio N>`**

```
<Audio 2> is the voice-timbre reference for <Subject 2> (S2): a light, soft voice with a slight husky rasp. Use only its vocal timbre; do not describe or reproduce any semantic content from the audio.
```

### 发卡的方位写法

**只写解剖方位，不写画面左右。**

```
✅ one light green hairpin clipped above her left ear on her own left side, with the right side of her head bare
❌ one light green hairpin on the left side of her hair
❌ the hairpin appears at frame-left when she faces the camera
```

理由：只写 `left side` 有歧义——是她的左还是画面左，模型每次自己选，各段可能选反。写画面映射更糟——她转头、坐下、侧脸，画面左右每镜都翻。只锁解剖方位，错了做一次镜像即可。

## 4.3 墨提斯（Mortis / 第二人格 / S3）

| 项 | 内容 |
|:---|:---|
| 发 | 与睦子极似的浅绿长发，**含后脑勺完整长发** |
| 睫毛 / 瞳 | 浅绿睫毛 / 琥珀色瞳 |
| 特征 | **同样带眼角倦怠感**（与睦子同脸） |
| 身高 / 胸围 | 155 cm / B 罩杯 |
| **差异 1** | **头上无发卡** |
| **差异 2** | **两耳及颈部无任何饰物** |
| **差异 3** | **胸口领结有椭圆形红色宝石** |
| 声线 | 略高，紧张时会颤 |
| 禁项 | 耳环、项链、发卡、白色连衣裙、短发 |

**`subject_definitions`**

```
<Subject 3> is the visual content referenced from <Picture 3>, Mortis, with long light green hair including the full back of the head, light green eyelashes, and amber eyes. A distinctive weary look sits at the outer corners of her eyes. She is 155 cm tall with a B-cup chest. She wears no hairpin anywhere on her head, no earrings, and no necklace. An oval red gem sits on the ribbon at her chest. Her clothing is inherited from <Picture 3>.
```

## 4.4 同框防混淆

### 睦子 + 墨提斯（最高风险）

`detailed_description` 开头必加：

```
Distinct identities in frame: <Subject 2> carries one light green hairpin above her left ear; <Subject 3> carries no hairpin anywhere and has an oval red gem on her chest ribbon. Both keep their own face structure and hair colour, and both show the weary cast at the outer eye corners.
```

三条硬规则：
1. 睦子：**左耳上方必有发卡**
2. 墨提斯：**头上绝对无发卡**、**胸前必有红宝石**
3. 两人：**都带眼角倦怠感**

### 祥子 + 睦子

```
Distinct identities in frame: <Subject 1> is the taller figure with grey-blue hair and no hairpin; <Subject 2> is the shorter figure with light green hair and one hairpin above her left ear only. Both keep their own face structure, hair colour and clothing from their own reference image.
```

### 三人以上

每人一条判别句，逐项对位，不合并。

### 判别句的位置

| 位置 | 是否需要 |
|:---|:---|
| `subject_definitions` | 各人独立定义，不分判别 |
| `retention_analysis` | 睦子发卡反向确认每段必写 |
| `detailed_description` 开头 | **同框段必写** |
| 无同框的段 | 可省 |

---

# 第五章　场景锚点：海滨度假村步行道

## 5.1 图内固定元素

| 层 | 元素 |
|:---|:---|
| 铺装 | 浅色石板，可见接缝与轻微高差 |
| **方位** | **海在画面左侧**（决定性，所有光向由此推出） |
| 栏杆 | 白色金属栏杆，**竖向柱条**，沿步道海侧 |
| 栏杆附件 | 救生圈挂在石阶顶端栏杆上 |
| 台阶 | 浅石阶，**画面中左**，下行至沙滩 |
| 海墙 | 石阶旁矮海堤 |
| 指示牌 | 木牌立于**画面左**，**牌面无任何可读文字** |
| 长椅 | **一张主要无靠背木椅**，长轴平行栏杆，**坐面朝海**，位于**画面中右** |
| 伞 | 浅色遮阳伞，立于椅后，**全程保持收起** |
| 垃圾桶 | 圆柱形，伞旁 |
| 路灯 | 深色路灯，沿陆侧等距排布 |
| 灌木 | 修剪低矮灌木带，**画面右侧** |
| 远景 | 远处岬角，**画面右侧海平线** |

## 5.2 标准引用写法

```
<Subject 3> is the seaside resort promenade referenced from <Picture 3>, with pale stone paving, the sea on the LEFT of frame, a white metal railing with vertical balusters, a lifebuoy at the head of shallow stone steps, a low sea wall, a wooden signpost whose board carries no legible lettering and no text of any kind, one backless wooden bench facing the sea at screen-center-right, a furled pale parasol behind it, remaining folded and furled throughout, a waste bin, spaced dark street lamps along the land side, low trimmed shrubs at frame-right, and a distant headland on the horizon. Exclude <Picture 3>'s camera angle, its framing, its empty composition, its daytime sky, its white cumulus clouds, and all of its light.
```

## 5.3 `retention_analysis`

```
<Subject 3>: partially_preserved - layout and materials from <Picture 3>; camera angle, composition, daytime sky and lighting replaced.
```

`partially_preserved` 而非 `fully_preserved`——正是「只继承一部分」的语义。

## 5.4 无靠背长椅的行为约束

长椅无靠背，任何「倚靠」动作都会穿模或造出不存在的东西。所有坐姿必须写成：

```
✅ She braces both palms flat on the bench seat behind her hips, and brings both hands up to clasp behind her head.
❌ She leans back against the backrest.
```

## 5.5 场景板出图三原则

**原则 1：中性漫射光出图**

```
Even neutral ambient light, no directional shadow, no sunlight, no sunset color, no rim light, no glow, no haze, no color cast on any surface. Uniform flat daylight exposure across the whole frame.
```

负面压制：

```
sunset, golden hour, warm color cast, directional sunlight, long shadows, rim light, god rays, volumetric light, bloom, lens flare, haze, fog
```

理由：带光出板，后续想改光比（6:1 / 8:1 / 2:1）改不动，图里自带的光会污染提示词。一张中性板能服务白天、黄昏、深夜。

**原则 2：只继承几何与材质**

光源方位、光比、色温、天空全部由每段文字重写。

**原则 3：天空必须显式覆盖**

场景板天空面积大，最容易被继承。每段必加天空锁（见 6.12）。

## 5.6 场景板负面清单

```
people, human figures, character, camera equipment, light stand, tripod, flight case, film crew, text, subtitles, sign lettering, watermark, logo, sunset, golden hour, warm color cast, directional sunlight, long shadows, rim light, god rays, volumetric light, bloom, lens flare, haze, fog, photograph, 3D render, photorealistic
```

特别压制：
- `camera equipment, light stand, tripod, film crew` —— 否则模型会往度假区补拍片器材
- `sign lettering, text` —— 牌子有手写痕迹，会长成文字

---

# 第六章　光影系统

## 6.1 分层分工

| 层 | 管什么 | 不管什么 |
|:---|:---|:---|
| 画风串 | 质感：赛璐璐、饱和度、硬阴影、手部约束 | 光源方位、光比、材质响应 |
| **光影层** | 布光、体积光、材质、镜面分级、bloom 域、人物干净、天空 | 动作、台词、机位 |

位置：`detailed_description` 第 3 层，紧跟压制行之后、时序纪律之前。

**一条铁律：每段写全，不复用指代。**

## 6.2 七段式结构（顺序固定）

| 序 | 段 | 内容 |
|:--|:---|:---|
| 1 | 主光系统 | 方位 / 高度 / 入射角 / 光比 / 硬边声明 |
| 2 | 体积光 | 介质 / 遮挡物 / 尘粒 |
| 3 | 材质响应 | 逐材质列 |
| 4 | **镜面分级** | 逐材质指定无/漫射/散乱/窄条 |
| 5 | **Bloom 域授权** | 白名单 + 强度档 |
| 6 | **人物干净声明** | 一句封死人物溢光 |
| 7 | 天空锁 | 渐变 + 云 + 排除白天 |

第 4 段独立的原因：镜面程度是**镜头级参数**，混在材质段里会被「统一材质」这个念头抹平。

## 6.3 主光系统

### 标准句（4:1 基准）

```
The key light is the low sun at screen-left over the sea, eight degrees above the horizon, striking from a three-quarter front-left angle: it lays a sharp warm rim light along the sea-side edge of heads and shoulders and drags long hard-edged shadows across the paving toward frame-right, while the land side falls into flat block cel shadow at a four-to-one ratio whose boundary with the lit zone is a single hard edge, never an airbrushed blend, and the shadow side keeps the individual hair strands and the folds of both skirts and jackets readable.
```

### 四个必写要素

| 要素 | 为什么必须写 |
|:---|:---|
| **方位** | `screen-left`——场景图海在左，夕阳必从左侧下沉 |
| **高度** | `eight degrees above the horizon`——决定投影长度与人脸受光角度 |
| **入射角** | `three-quarter front-left`——决定哪半边脸落影 |
| **光比** | `four-to-one`——决定暗部是否有细节 |

### 硬边声明（任何情况下不删）

```
whose boundary with the lit zone is a single hard edge, never an airbrushed blend
```

赛璐璐风 / 剧场 OVA 风必须有这句。没有它，模型会画成柔和渐变，质感立刻掉档。

**这与 bloom 不冲突**：bloom 管光晕，硬边管明暗分界。

### 暗部行为

| 光比 | 暗部行为 | 适用 |
|:---|:---|:---|
| **4:1** | `holds readable detail with the weave still faintly visible rather than crushed` | 常规对话、坐姿、日常 |
| **6:1** | `whose single hard boundary keeps her eye and eyelash detail clear` | 情绪特写、脸部压迫 |
| **8:1** | `falls into deep flat shadow` | 极暗调、日落尽头 |
| **2:1** | `soft and open with no crushed black` | 冷蓝夜色、压平反差 |

## 6.4 体积光

### 标准句

```
Sea haze fills the air, so the backlight renders as visible shafts between the railing balusters, with fine motes drifting slowly through the beams.
```

### 三要素

| 要素 | 作用 |
|:---|:---|
| **介质** | `sea haze` / `dust`——没有介质就没有体积光 |
| **遮挡物** | `between the railing balusters`——光柱要被切碎才可见 |
| **尘粒** | `fine motes drifting`——给出动态与纵深 |

### 物理光写法

```
✅ visible volumetric shafts / physical light rays / visible light shaft filled with floating dust
❌ god rays effect / soft light beams / glow overlay
```

### 各景别适配

| 景别 | 体积光处理 |
|:---|:---|
| 全景（建立） | 栏杆柱之间切碎，尘粒缓慢漂 |
| 中景（坐姿） | 竖柱在背后切成竖向光栅 |
| 近景（脸部） | 只用脸部边缘光，体积光退到背景 bokeh |
| 水面全景 | 高空斜射光柱，衬在暗水面上 |

## 6.5 材质响应

| 材质 | 标准写法 | 物理依据 |
|:---|:---|:---|
| **黑丝 / 尼龙** | `semi-sheer nylon carrying one narrow specular streak down the front of the thigh` | 半透明尼龙，单一窄条高光 |
| **棉布 / 外套** | `strictly matte with flat block shadows` | 粗糙纤维，无镜面反射 |
| **白栏杆** | `returns a soft painted-metal specular` | 喷涂金属，漫反射为主 |
| **木椅** | `matte with visible grain` | 木材，无高光 |
| **海面** | `carries a glitter path built from separate bright strokes` | 离散波纹，非连续辉光 |
| **金属刀刃** | `creating a sharp, solid specular highlight` | 镜面，锐利高光 |
| **皮革** | `flat, solid white highlights on the surface, with no smooth gradients` | 赛璐璐实色高光 |

禁止无物理依据的形容词：`glossy` / `shiny` / `silky` / `reflective surface`。

## 6.6 镜面分级（第 4 段）

### 四级表

| 级 | 写法 | 视觉效果 | 适用 |
|:---|:---|:---|:---|
| **0 无** | `no mirror specular anywhere on them` | 全哑 | 远景、腿部不承重 |
| **1 漫射** | `only a soft diffused sheen along the top of the nylon` | 一片柔光，无方向 | 全景、中景、非重点镜 |
| **2 散乱** | `a soft scattered sheen, present only where the palm presses` | 局部柔光，受压处集中 | 触碰镜（核心） |
| **3 窄条** | `one narrow specular streak down the front of the thigh` | 一条硬边高光，有方向 | 近景特写、腿部承重镜 |

**逐镜指定，不许一段统一。**

### 受压三态

```
常态：one narrow specular streak runs unbroken down the front of the nylon
受压：the sheen compresses into a short flattened band while the surrounding fabric pulls tight and draws a second faint sheen up the side of the leg
松手：the sheen springs back to its full unbroken length
```

这三句是全片最有效的物理证据。手指的重量、布料的弹性、光的走向，全靠它。

### 与 bloom 域的隔离

腿部/布料属**人物域**，bloom 不进：

```
✅ the sheen compresses under them as they pass
❌ the touch point glows
```

## 6.7 Bloom 域授权（第 5 段）

### 总原则

**Bloom 必须有主，人物必须干净。**

不是「不许 bloom」，是「bloom 只许出现在指定位置」。

### 三个域

| 域 | 内容 | 处理 |
|:---|:---|:---|
| **光源域** | 日轮、会场灯、街灯、霓虹、水面反射点 | 全部放行，写 core + halo + clip to pure white |
| **介质域** | 体积光柱、尘粒、海雾 | 放行，但不加 glow 滤镜 |
| **人物域** | 皮肤、头发、睫毛、衣物、腿部 | 死守，一句「绝不溢光」钉住 |

### 标准句式（四段结构）

```
Bloom is confined to [域 A] and [域 B]: [域 A 具体写法], [域 B 具体写法], both allowed to clip to pure white. [人物] stay clean, with no glow bleeding onto [器官列表].
```

1. `Bloom is confined to` —— 授权范围
2. 域 A 描写
3. 域 B 描写
4. `both allowed to clip` + 人物干净句

### 四个变体

**变体 A：单域（纯环境镜）**

```
Bloom is confined to the sun disc, its halo, and the glitter path on the sea.
```

**变体 B：双域（常规带人物镜）**

```
Bloom is confined to the sun disc and the sea glint: the sun burns as a hot white-gold core with a wide soft halo spreading over the horizon, and the glitter path frays into a blown bloom along its centre, both allowed to clip to pure white. The figures stay clean and no glow bleeds onto their hair, skin or clothing.
```

**变体 C：点光源域（夜景、会场灯）**

```
Bloom is confined to the venue lights, the street lamps and their reflections on the dark water: each burns as a hot core with a wide soft halo, the reflections frazzle into blown points that shift with the waves, and all of them are allowed to clip to pure white. That glow never spills onto the two figures.
```

**变体 D：极简双点（特写）**

```
Bloom is confined to two points only: the sun disc and the sea glint in the background, and one tiny pinpoint of sunset reflection inside her pupil. Nothing else glows, and her skin, lashes and clothing stay clean with no glow bleeding onto them.
```

### 强度三档

| 档 | 写法 | 适用 |
|:---|:---|:---|
| **clip** | `allowed to clip to pure white` | 日轮、会场灯、街灯（默认档） |
| **blown** | `frays into a blown bloom along its centre` | 海面 glitter path、水面倒影 |
| **frazzle** | `frazzles into blown points that shift with the waves` | 夜间水面反射、湿面反射 |

### 词汇纪律

```
✅ hot core / soft halo / clip to pure white / blown / frazzle
❌ glow overlay / lens flare / god rays / soft light beams / glowing orb
```

前者是光源本体状态，后者是滤镜词，会被渲成糊。

## 6.8 日轮：三档写法

**档 A：常规落日**

```
the sun burns as a hot white-gold core with a wide soft halo spreading over the horizon, allowed to clip to pure white
```

- `hot` 定温度，`white-gold` 定色相
- `core` + `halo` 是两层结构，缺 halo 就是白饼
- `spreading over the horizon` 给 halo 一个横向延展方向，否则会长成圆球

**档 B：触水瞬间**

```
The sun burns as a hot white-gold core with a wide soft halo that spreads across the horizon and is allowed to clip to pure white.
```

`spreads across`（不是 `over`），因为此时日轮贴着水线，halo 是横向铺开的。

**档 C：已没入**

```
a thin residual warm band at the waterline, glowing softly without a defined core
```

core 已消失，写 core 会造出不该存在的亮点。

## 6.9 海面反射：glitter path 三段式

```
[1 本体] The sea carries a glitter path built from separate bright strokes.
[2 溢光] the glitter path frays into a blown bloom along its centre.
[3 授权] both allowed to clip to pure white.
```

### 三种海面状态

| 状态 | 写法 | 适用 |
|:---|:---|:---|
| 常规 | `glitter path built from separate bright strokes, blooming along its centre` | 日间至日落 |
| 极暗调 | `stretched into a long amber blade of light built from separate bright strokes, blooming along its centre` | 日落触水 |
| 夜间倒影 | `reflections break into small bright points that shift with the waves` + `frazzle into blown points` | 入夜 |

`separate bright strokes` 不可省，省了海面会变成一条均匀发光的白带。

## 6.10 人物干净声明（第 6 段）

### 标准句

```
The figures stay clean and no glow bleeds onto their hair, skin or clothing.
```

### 变体

| 场景 | 写法 |
|:---|:---|
| 单人特写 | `Her face, lashes and clothing stay clean, with no glow bleeding onto them.` |
| 双人中景 | `The two figures stay clean, with no glow bleeding onto their hair, skin or clothing.` |
| 夜景 | `That glow never spills onto the two figures.` |
| 纯环境 | 不需要 |
| 特写 + 瞳孔光 | `Nothing else glows, and her skin, lashes and clothing stay clean.` |

### 位置

紧跟在 Bloom 域授权句之后，同一个句群内。分开会被模型当成两条独立指令，人物干净这条会被忽略。

## 6.11 瞳孔高光：唯一允许进入人物域的 bloom

```
one tiny pinpoint of sunset reflection inside her pupil
```

| 项 | 要求 |
|:---|:---|
| 尺寸 | 必须写 `tiny pinpoint` |
| 位置 | 必须写 `inside her pupil`，不是 `in her eye` |
| 数量 | 一段最多一处 |
| 配套 | 紧跟 `Nothing else glows` |

```
❌ her eyes glow with sunset light
❌ sparkles in her eyes
❌ catchlight with soft bloom
```

## 6.12 天空锁（第 7 段）

### 标准句

```
The sky is a warm sunset gradient from pale gold at the horizon through warm orange to muted violet at the top of frame, with one low dark cloud band just above the waterline. No daytime blue sky and no white cumulus clouds appear anywhere in frame; the reference image's blue upper sky is entirely overridden.
```

### 各阶段变体

| 阶段 | 天空状态 |
|:---|:---|
| 日落前段 | `pale gold at the horizon through warm orange to muted violet` |
| 日落中段 | `deepening slightly toward orange at the horizon` |
| 日落高潮 | `full sunset field of pale gold, orange and muted violet with low dark cloud banks just above the waterline` |
| 入夜 | `deep cool blue dusk with a thin residual warm band at the waterline, the violet having risen to the top of frame` |

### 排除句的关键

`the reference image's blue upper sky is entirely overridden` 是**主动覆盖指令**，比单纯否定有效。场景板有大片蓝天，不写这句必被继承。

## 6.13 四档光比模板

### 4:1（常规段）

```
The key light is the low sun at screen-left over the sea, eight degrees above the horizon, striking from a three-quarter front-left angle: it lays a sharp warm rim light along the sea-side edge of heads and shoulders and drags long hard-edged shadows across the paving toward frame-right, while the land side falls into flat block cel shadow at a four-to-one ratio whose boundary with the lit zone is a single hard edge, never an airbrushed blend, and the shadow side keeps the individual hair strands and the folds of both skirts and jackets readable. Sea haze fills the air, so the backlight renders as visible shafts between the railing balusters, with fine motes drifting slowly through the beams. Her black tights are semi-sheer nylon carrying one narrow specular streak down the front of the thigh. Cotton and jacket fabric are strictly matte with flat block shadows. The white railing returns a soft painted-metal specular. The bench wood is matte with visible grain. The sea carries a glitter path built from separate bright strokes. Bloom is confined to the sun disc and the sea glint: the sun burns as a hot white-gold core with a wide soft halo spreading over the horizon, and the glitter path frays into a blown bloom along its centre, both allowed to clip to pure white. The figures stay clean and no glow bleeds onto their hair, skin or clothing. The sky is a warm sunset gradient from pale gold at the horizon through warm orange to muted violet, with one low dark cloud band just above the waterline. No daytime blue sky and no white cumulus clouds appear anywhere in frame.
```

### 6:1（脸部特写）

```
The low sun at screen-left places a warm rim light along her sea-side cheekbone, jaw and the outer edge of her hair, while the front of her face falls into flat block cel shadow at a six-to-one ratio whose single hard boundary keeps her eye and eyelash detail clear, with the upper eyelid shadow rendered as a natural gradient inside the cel fill. Sea haze softens the far background into a single warm cel field with no visible shafts. Cotton and jacket fabric are strictly matte with flat block shadows. Bloom is confined to two points only: the sun disc and the sea glint in the background, and one tiny pinpoint of sunset reflection inside her pupil. Nothing else glows, and her skin, lashes and clothing stay clean with no glow bleeding onto them. The sky behind her reads only as the warm sunset cel field with one low dark cloud band at the waterline. No daytime blue sky and no white cumulus clouds appear anywhere in frame.
```

### 8:1（水面极暗调）

```
This beat runs at eight-to-one extreme contrast, rendered as flat blocks of colour. The whole frame is the sunset field and the sea, with no figure in it. The sun burns as a hot white-gold core with a wide soft halo that spreads across the horizon and is allowed to clip to pure white. The water beneath it falls into deep flat shadow, and the glitter path stretches into a long amber blade of light built from separate bright strokes, blooming along its centre. Distinct volumetric shafts slant down from the sun through the sea haze against the darker water. The cloud bank keeps tonal steps on its shadow side rather than flattening. Bloom is confined to the sun disc, its halo, and the glitter path on the sea. The sky is a full sunset field of pale gold along the horizon, deepening through warm orange, red and muted violet to indigo at the top of frame, with low dark cloud banks just above the waterline painted as flat simplified shapes. No daytime blue sky and no white cumulus clouds appear anywhere in frame.
```

### 2:1（冷蓝夜色）

```
The light is late dusk at roughly two-to-one with the contrast flattened into broad flat cel zones. A cool blue ambient key comes from the upper left, and a warm low accent comes from the far sea side where the venue lights stand. The shadow sides are soft and open with no crushed black, and both figures read as silhouettes that still hold readable skin tone instead of falling into pure black. Bloom is confined to the venue lights, the street lamps and their reflections on the dark water: each burns as a hot core with a wide soft halo, the reflections frazzle into blown points that shift with the waves, and all of them are allowed to clip to pure white. That glow never spills onto the two figures. The sky reads as deep cool blue dusk with a thin residual warm band at the waterline, the violet having risen to the top of frame. No daytime blue sky and no white cumulus clouds appear anywhere in frame; the reference image's blue upper sky is entirely overridden.
```

## 6.14 光比时间轴

九个切点上的太阳高度与色温必须接得上，否则切镜会闪。

| 阶段 | 太阳高度 | 光比 | 色温倾向 |
|:---|:---|:---|:---|
| 开场至坐定 | 8° | 4:1 | 暖金 |
| 触碰 / 特写 | 8° | 6:1 | 暖金 |
| 对话段 | 8° | 4:1 | 暖金 |
| 对话后段 | 8° | 4:1 | 暖金，略偏橙 |
| 日落流逝（唯一光级变化段） | **下沉至触水** | **8:1** | 白金色 → 琥珀 |
| 入夜 | **已没入** | **2:1** | 冷蓝 + 地平线余晖 |

**日落前所有段是同一时刻**：太阳高度、方位、色温完全不变。只有光比在群像 → 特写之间收紧。

**日落段是唯一的时间流逝段**，负责把太阳从「未落」推到「触水」。

**日落到入夜的色温跳变是叙事需要**，不是失误。

## 6.15 画风串与运镜冲突处理

冲突源：
- 画风 10 自带 `The camera holds a perfectly static shot throughout`
- 画风 8 自带 `Slow camera pan, subtle motion`

处理（不删原文，加 override）：

```
[画风串，删去冲突的机位句，其余逐字保留]
Camera note for this segment: it is the exception to the static-shot default — the camera performs one continuous truck right at slow speed, holding a constant distance and side-view angle, and does not zoom, pull out or reframe.
```

---

# 第七章　分镜写作法

## 7.1 每镜必写五件事

```
1. 景别      Close-up / Medium close-up / Medium two-shot / Wide shot
2. 位置      画面哪一侧、占画幅高度多少、前中后景
3. 主动作    物理轨迹（从A到B），不是状态
4. 运镜      官方动词 + 幅度 + 速度 + 落点（或无运镜声明）
5. 声音      SE + 台词
```

## 7.2 位置量化的三级

| 级别 | 写法 | 用于 |
|:---|:---|:---|
| 🟢 基础 | `Medium shot. She sits by the sea.` | 常规对话 |
| 🟡 进阶 | `Screen-left, occupying the lower half of the frame, in the foreground.` | 构图不明时 |
| 🔴 救命 | `Crouches in the bottom-left third, occupying two-thirds of the vertical frame height. One hand flat on the ground, fingers splayed.` | 手部特写、复杂交互 |

## 7.3 动作必须写成轨迹

```
❌ She is sitting on the bench.          (状态)
✅ She sits down on the left seat, settling her weight, both hands coming to rest on her knees.   (轨迹)
```

## 7.4 动作闭环（防复读机）

```
❌ 端着红茶杯          → 模型会一直端着
✅ 把红茶杯放在桌上，双手空空放松垂在身侧
```

凡是「持握」状态，必须给出**结束状态**。

## 7.5 肢体幅度约束（防夸张变形）

涉及推、扶、按等低幅动作时，必须写死运动范围：

```
Keeping both arms below shoulder height and close to her body, moving only from the forearm down, she slides the hand sideways off the thigh in one slow, low, unhurried movement. She does not lift her arm, she does not sweep outward, and her elbow never rises above her waist.
```

**不给范围约束，模型会做成大幅挥手——这是 AI 最常见的肢体夸张来源。**

## 7.6 末帧要收在静止

```
The final frame holds both seated, still and upright.
The final frame holds her smirk with her gaze settled back up at Subject 1.
The final frame holds the sun's lower edge resting on the water.
```

末帧就是下一段的起帧。停在动作中途 → 下段接不住。

## 7.7 切点与运镜分离

**切点在 0 秒，运镜从 1 秒起：**

```
The camera cuts to a medium two-shot in side view. The first second continues the carried walk with no new event. Then the camera trucks right at slow speed as one continuous move, holding a constant distance and constant side-view angle, without zooming, pulling out or reframing.
```

关键结构：切点句（瞬时的）→ 一秒延续句 → 运镜句（持续到段末）

## 7.8 每段只一个机位意图

| 写法 | 含义 |
|:---|:---|
| `The camera holds a perfectly static shot throughout.` | 全静止 |
| `The camera trucks right at slow speed, holding a constant distance and constant side-view angle, without zooming, pulling out or reframing.` | 单一横移，封死其他 |
| `The camera pushes in with small amplitude at slow speed toward her eyes and stops there.` | 单一推镜，带落点 |
| `The camera cuts to a locked-off medium two-shot.` | 切点，秒级完成 |
| `No cut and no camera move: the frame stays in the exact same medium two-shot as the previous segment.` | 同镜连续 |

禁止组合：

```
❌ continuous from the carried truck into this wider framing
❌ cut + move 同句
❌ truck + zoom 同时
❌ eases into / settles into / now holds
```

## 7.9 无切镜段必须写死

```
No cut and no camera move: the frame stays in the exact same medium two-shot as the previous segment, same distance, same angle, same composition.
```

不写这句，模型会自己造一个新构图，破坏对话连续性。

## 7.10 硬切策略

**能用硬切就别运镜。** AI 一运镜就容易穿模变形，硬切只换构图，不动几何。

段内允许多次切点，写法：

```
[Shot 1] ...
[Shot 2] At 00:03.000, the camera cuts to a locked-off close shot of ...
```

切点时间码严格递增，`At MM:SS.mmm`。

## 7.11 Rack Focus（移焦）

机位不动，转移视觉焦点。比推镜安全——避免运镜导致穿模变形。

```
The camera does not move; a rack focus is the only change in the image, shifting the sharp plane from [A] in the midground to [B] in the foreground, so [A] softens while [B] snaps into crisp resolution.
```

| 场景 | 从 | 到 |
|:---|:---|:---|
| 视线落点 | 面部 | 手 / 大腿 / 物件 |
| 反应转场 | 说话人 | 听者 |
| 揭示 | 环境 | 关键道具 |

禁忌：一段内多次移焦 → 拆镜；移焦与运镜同时进行 → 只留一个。

---

# 第八章　情绪写作法

## 8.1 核心原则

**情绪不写形容词，写物理证据。**

| ❌ 抽象 | ✅ 物理 |
|:---|:---|
| 气氛暧昧 | 手悬在布料上方不落下，影子盖住高光 |
| 她很紧张 | 下颌收紧，大腿肌肉在布料下绷起 |
| 他很犹豫 | 视线三次落回同一处，又抬起 |
| 愤怒 | 手指在膝上收紧，关节发白 |
| 隐忍 | 眼睛不往下看，只有胸口缓慢起伏 |

## 8.2 情绪的四个载体

| 载体 | 写法 |
|:---|:---|
| **视线路径** | 先看脸 → 再下移到喉 → 停在目标。路径本身就是欲望的语法 |
| **延迟** | 反应慢半拍。`She goes still first... Then her eyelids lower...` |
| **微动作** | 下颌收紧、呼吸停顿、一缕发丝飘动、手指不动 |
| **停顿** | `Neither of them speaks.` / `The fingers do not move after they land.` |

## 8.3 悬停法（最高张力）

```
She lifts her right hand and lets it hang suspended above the fabric, fingers loosely open, not yet touching. The hand stays there for a held moment, close enough that her shadow falls across the nylon and swallows the sheen.
```

手比接触更有力。落下之后要收住，不再给动作。

## 8.4 表情逆转三段式

```
Her eyes widen slightly and her breath pauses. Then her eyelids lower into a narrowed, sly look, the weary cast at her eye corners sharpening, and one corner of her mouth curves up into a knowing smirk.
```

**震动 → 下沉 → 定型**，顺序不能乱。

## 8.5 禁止

```
❌ she looks seductive
❌ an erotic atmosphere
❌ intense emotion
❌ romantic mood
❌ 任何以 -ous / -ic 结尾的抽象形容词
```

---

# 第九章　声音与台词

## 9.1 稳定 ID

```
( S1 ), ( S2 ), ( S3 )…
```

- 同一说话人跨段保持同 ID
- **从不发声的角色不给 ID**

## 9.2 台词格式

```
[说话人标识 + 音色] (SN), [交付方式], says, <d>[语言] 台词原文</d>
```

`<d>` 内只放语言标签和原词，不放描述、不翻译、不改标点。

## 9.3 台词可两处出现

**正文与 `Sound:` 行皆可带 `<d>`，不作数量限制。** 实测台词双处出现不招字幕。

标准写法：

```
<Subject 1> turns her head slightly toward <Subject 2> and speaks: <d>[Japanese] この現場、なかなかいいな。</d>
Sound: <Subject 1> (S1), a clear voice carrying much breath with a refined and composed manner of speech, says, <d>[Japanese] この現場、なかなかいいな。</d>
```

## 9.4 音色声明位置（只出现两处，各一次）

1. `<Audio N>` 定义里
2. 每条 `Sound:` 行的说话人标识里

**正文只写动作与表情，不重复音色措辞。**

```
❌ 正文：speaks in a clear, refined tone
   Sound：a clear voice carrying much breath with a refined and composed manner of speech
```

两份描述略有差异 → 模型折中 → 音色不稳定。

## 9.5 跨切点台词

同句台词跨两个镜头时，用 `<scenetrans>` 在两端标记，并明说音频延续。

## 9.6 画外音

固定短语 `says in an off-screen voiceover`，且 `<d>` 块后必须紧跟「嘴唇保持闭合」：

```
The man (S1) says in an off-screen voiceover: <d>[English] I still remember that road.</d> while his lips remain completely closed.
```

## 9.7 屏幕文字

可见文字（招牌、字幕、霓虹）用**英文双引号**，逐字保留原文：

```
A red neon sign reading "营业中" glows above the doorway.
```

台词不加引号，只用 `<d>`。

## 9.8 5 秒容量上限

| 内容 | 时长估算 |
|:---|:---|
| 一句短句（8–12 字） | ~1.5s |
| 一句极短（2–3 字） | ~0.5s |
| 一句中等（15–20 字） | ~2.0s |
| 换气与表情反应 | 每轮 ~0.5s |

5 秒最多容纳：三句短台词 + 一次换气。再多必抢话。

超载处理：拆成两段，或压成两句话。

## 9.9 对话段的机位

**优先静止。** 对话时运镜会让人物嘴型与身体动作脱节。

同镜连续无切无动的对话回合段，必须写明 `No cut and no camera move`。

## 9.10 音频投喂

| 项 | 规则 |
|:---|:---|
| 有台词的段 | 必挂对应 `<Audio N>` |
| 无台词的段 | 仍可挂作音色参考；出杂音则改不传 |
| 音频时长 | 2–15s |

---

# 第十章　完整模板

## 10.1 段 1（首段，无承接）

```text
subject_definitions:
<Subject 1> is the visual content referenced from <Picture 1>, [角色名], with [发色与发长], [瞳色], [身高], [胸围], [神态]. Her clothing is inherited from <Picture 1>. [识别特征与反向确认].
<Subject 2> is the visual content referenced from <Picture 2>, [角色名], with [发色与发长], [睫毛], [瞳色], [特征], [身高], [胸围]. [识别特征：解剖方位 + 反向确认]. Her clothing is inherited from <Picture 2>. [装束锁定].
<Subject 3> is the [场景名] referenced from <Picture 3>, with [架构元素逐项列出，含方位]. Exclude <Picture 3>'s camera angle, its framing, its empty composition, its daytime sky, its white cumulus clouds, and all of its light.
<Audio 1> is the voice-timbre reference for <Subject 1> (S1): [音色]. Use only its vocal timbre; do not describe or reproduce any semantic content from the audio.
<Audio 2> is the voice-timbre reference for <Subject 2> (S2): [音色]. Use only its vocal timbre; do not describe or reproduce any semantic content from the audio.

summary:
[reference generation] [一句情境概括]，appearance from <Picture 1> and <Picture 2>, layout from <Picture 3>, voice timbre from <Audio 1> and <Audio 2>. This is the opening segment; nothing is carried in.

retention_analysis:
<Subject 1>: fully_preserved - appearance, hair, build and clothing from <Picture 1>.
<Subject 2>: fully_preserved - appearance, hair and [装束] from <Picture 2>. [特征方位每段反向确认].
<Subject 3>: partially_preserved - layout and materials from <Picture 3>; camera angle, composition, daytime sky and lighting replaced.
<Picture 1>, <Picture 2>, <Picture 3>: fully_preserved as references for their subjects.
<Audio 1>, <Audio 2>: reference - timbre only; no semantic content copied.
Opening state: this is the first segment of the film; no earlier segment exists, nothing is carried in, and both the camera and the figures start fresh.

detailed_description:
[画风串，逐字复制]

Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.

[光影层七段式，本段写全]

Timing discipline: this is the opening segment, so there is no carried overlap region and the first second is fully authored. Every action below may begin at the first frame.

[Shot 1] [景别] [位置] [主动作，可从 0s 起] [运镜] [正面约束] [末帧收在静止状态]
Sound: SE - [音效]
Sound: [说话人] (SN), [音色], says, <d>[语言] 台词</d>

Every element inside the frame belongs to the physical scene: paving, railing, sea, sky, foliage and the figures themselves. Nothing floats over the image.

overall_soundscape:
[1–4 句环境音 + 物理音 + 非语言人声]. All sounds are diegetic.

non_diegetic_music:
N/A
```

## 10.2 段 2 起（承接段）

```text
The actual carried latent motion from the previous segment governs the current action and camera state. No reference picture resets pose, body position, hand placement, expression, gaze or framing. The lighting direction and time of day continue unchanged from the previous segment.

subject_definitions:
[同段 1 结构，完整外观，不含姿态]

summary:
[一句动作概括。不加方括号前缀。]

retention_analysis:
<Subject 1>: fully_preserved - appearance, hair and clothing from <Picture 1>.
<Subject 2>: fully_preserved - appearance, hair and [装束] from <Picture 2>. [特征方位每段反向确认].
<Subject 3>: partially_preserved - layout and materials; camera angle, sky and lighting replaced.
<Picture 1>, <Picture 2>, <Picture 3>: fully_preserved as references.
<Audio 1>, <Audio 2>: reference - timbre only; no semantic content copied.
Carried state: [承接类别，不写数值].
Must restate because [原因]: [出画项 / 被遮挡特征 / 抽象规则]
[机位意图：The camera cuts to a new locked-off setup at the first frame. / There is no cut: this segment occupies the same setup as the previous one.]

detailed_description:
[画风串，逐字复制；若自带 static shot 而本段需运镜，删该句并加 override 行]

Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.

[光影层七段式，本段写全]

Timing discipline: the first second is the carried overlap region and carries no new event — no new gesture, no new head turn, no new line, and no camera move begins inside it. Every action described below begins at the one-second mark.

[Shot 1] [景别] [位置] [一秒延续句] [主动作从 1s 起] [运镜] [正面约束] [末帧收在静止状态]

[Shot 2] At 00:03.000, the camera cuts to [新景别]. [位置] [动作] [运镜] [正面约束]

Sound: SE - [音效]
Sound: [说话人] (SN), [音色], says, <d>[语言] 台词</d>

The intended new beat is placed after the carried [承接物] overlap: [动作] begins only after the first second, and [细节] follows the carried [状态] without asserting the previous segment has ended at an exact [状态类型].

Every element inside the frame belongs to the physical scene: paving, railing, sea, sky, foliage and the figures themselves. Nothing floats over the image.

overall_soundscape:
[1–4 句]. All sounds are diegetic.

non_diegetic_music:
N/A
```

---

# 第十一章　Seedance → H3 转换规程

## 11.1 逐表对位

| Seedance 列 | H3 归位 |
|:---|:---|
| `#` | 决定合段：多镜压成一段（每段 ≤6s） |
| `時間` | 累计后按 6s 切段；单镜时长决定能否合段 |
| `サイズ`（大遠景/全景/中景/近景/特写） | 景别句 |
| `カメラ`（固定/移動） | 机位意图句；固定 → 沿用画风串 static 句 |
| `映像内容`（含光影指示） | 动作轨迹 + 光影层素材 |
| `台詞 / SE` | `Sound:` 行 |
| 表内 `bloom` / `glint` / `sheen` 措辞 | 进 bloom 域授权与镜面分级 |

## 11.2 合段规则

| 条件 | 处理 |
|:---|:---|
| 相邻两镜总时长 ≤5.5s | 可合为一段（段内 1 次切点） |
| 单镜 ≥5s | 独立成段 |
| 三个短镜 ≤5.5s | 可合为一段（1 次切点 + 1 次延续） |
| 合段后单段出现 3 个以上 Shot | 拆段 |

## 11.3 光影措辞转换表

| Seedance 原文 | H3 写法 |
|:---|:---|
| `Intense bloom on the sun disk and the sea glint only` | `Bloom is confined to the sun disc and the sea glint: ... both allowed to clip to pure white.` |
| `bloom on the venue lights ... never on the figures` | `Bloom is confined to the venue lights ... That glow never spills onto the two figures.` |
| `Soft diffused sheen only on the legs, no mirror specular` | 镜面分级 1 级：`only a soft diffused sheen along the top of the nylon, with no mirror specular anywhere on them` |
| `Only the touched area carries a soft scattered sheen` | 镜面分级 2 级：`a soft scattered sheen, present only where the palm presses` |
| `A tiny bloom point on the sunset reflection in the pupil` | 瞳孔光：`one tiny pinpoint of sunset reflection inside her pupil` |
| `Intense bloom on the sun disk`（无 halo 描述） | 补 `with a wide soft halo spreading over the horizon` |
| `4:1 lighting ratio` | 光比句 `at a four-to-one ratio` |
| `Long hard-edged shadows stretch to frame right` | 并入主光句 |
| `Shadow side retains hair strands and skirt folds` | 并入主光句暗部行为 |
| `Shadow side keeps fabric weave readable, not crushed` | 并入镜面分级句 |
| `Frame tilted 15 degrees and locked, no rotation` | 写入 Shot 句：`at a fifteen-degree tilt that stays locked with no rotation` |
| `Near backlit against the sea` | `the sea backlights her as a warm body contour with her facial features still readable inside the shadow` |
| `Figures read as silhouettes with readable skin tone, not crushed black` | `both figures read as silhouettes that still hold readable skin tone instead of falling into pure black` |

## 11.4 转换时的三处常见修正

| 问题 | 修正 |
|:---|:---|
| Seedance 写「倚靠背」但场景是无靠背长椅 | 改为双手撑在身后椅面，再交握脑后 |
| 抬手推开的动作会做成大幅挥手 | 补肢体幅度约束（7.5） |
| 多个 bloom 点未分主次 | 一律转成 `Bloom is confined to A and B` 白名单 |

## 11.5 段数与时长核对

转换后必算：

```
段数 × 5.08s = 交付总时长
```

与原表总时长差额 ≤1.5s 可接受（因裁切与合段）。超出则重新切段。

---

# 第十二章　提交前检查清单

## A. 模式与结构

- [ ] 多图 / 有音频 → **六字段全参考模式**
- [ ] 主字段是 `detailed_description`
- [ ] 六字段顺序正确
- [ ] `summary` 无 `[video continuation]`

## B. 续写开关

- [ ] 段 2 起开关在**最顶部**，任何字段之前
- [ ] 三句齐全：`actual carried latent motion governs` / `No reference picture resets` / `lighting...continue unchanged`
- [ ] 段 1 写了 `This is the opening segment`

## C. 绑定

- [ ] 身份**只绑一次**，在 `<Subject N>` 内
- [ ] 顶部无身份描述
- [ ] `subject_definitions` 内无姿态、动作、表情、机位
- [ ] 场景写了 `Exclude <Picture N>'s camera angle...`
- [ ] 音频写全 `Use only its vocal timbre; do not describe or reproduce any semantic content from the audio.`

## D. 承接与重述

- [ ] `Carried state:` 只声明类别，无具体姿态数值
- [ ] 出画项已 `Must restate because...`
- [ ] 睦子发卡方位每段重述 + 反向确认右侧无饰
- [ ] 所有需推进的变化写 `Then...`
- [ ] 无靠背长椅未出现倚靠动作

## E. 时序

- [ ] 段 2 起所有动作在 **1 秒后**开始
- [ ] 段 1 允许 0 秒起
- [ ] 有 `Timing discipline` 句（首段反向句）
- [ ] 无 `[Xs-Ys]`、无 `From 00:00 to 06:00`
- [ ] `[Shot 1]` 无时间戳
- [ ] 后续切点 `At MM:SS.mmm`，严格递增

## F. 画风

- [ ] 画风串**逐字复制**，未缩写未改写
- [ ] 含 `static shot` 而本段运镜 → 已删该句 + 加 override 行
- [ ] 画风 7 已删 `NO soft lighting`
- [ ] 画风 8 已删 `Slow camera pan, subtle motion`
- [ ] 无 `same as opening`

## G. 光影层（七段式）

- [ ] 七段齐全，顺序未乱
- [ ] 主光四要素：方位 / 高度 / 入射角 / 光比
- [ ] 硬边声明在（`single hard edge, never an airbrushed blend`）
- [ ] 体积光三要素：介质 / 遮挡物 / 尘粒
- [ ] 材质逐项列（黑丝 / 布料 / 栏杆 / 木椅 / 海面）
- [ ] 第 4 段镜面分级已写，按本镜指定（0/1/2/3 级）
- [ ] 第 5 段 Bloom 域授权已写，白名单明确
- [ ] 第 6 段人物干净声明已写，紧跟授权句
- [ ] 天空锁含 `entirely overridden`

## H. Bloom 域

- [ ] 日轮写 `hot white-gold core` + `wide soft halo`
- [ ] 日轮写 `allowed to clip to pure white`
- [ ] 海面写 `built from separate bright strokes`
- [ ] 海面写 `blooming along its centre`
- [ ] 点光源写 `each burns as a hot core`（独立成核）
- [ ] 倒影写 `frazzle into blown points that shift with the waves`
- [ ] 人物域写 `no glow bleeding onto`
- [ ] 夜景写 `never spills onto the two figures`
- [ ] 瞳孔光写 `tiny pinpoint` + `Nothing else glows`
- [ ] 无 `glow overlay` / `lens flare` / `god rays` / `soft light beams`
- [ ] 无 `no halo`

## I. 镜面分级

- [ ] 腿部本镜级别明确（0 无 / 1 漫射 / 2 散乱 / 3 窄条）
- [ ] 触碰镜用 2 级 `soft scattered sheen`
- [ ] 非重点镜用 1 级 `soft diffused sheen`
- [ ] 松手镜用 `sheen springs back`
- [ ] 无 `glossy` / `shiny` / `silky`

## J. 机位与分镜

- [ ] 一段一个意图
- [ ] 官方动词
- [ ] 带落点
- [ ] 无切镜段写明 `No cut and no camera move`
- [ ] 移焦未与运镜混用
- [ ] 无 `eases into` / `settles into` / `now holds`
- [ ] 每镜五件事齐全（景别 / 位置 / 动作 / 运镜 / 声音）
- [ ] 位置量化到级
- [ ] 动作是轨迹非状态
- [ ] 持握状态有闭环
- [ ] 大幅肢体动作已加幅度约束
- [ ] 末帧收在静止

## K. 情绪

- [ ] 无抽象形容词
- [ ] 有视线路径
- [ ] 有延迟与停顿
- [ ] 有微动作
- [ ] 表情逆转分三段

## L. 声音

- [ ] 说话人 ID 稳定，不发声者无 ID
- [ ] `<d>` 内只有语言标签与原词，无描述、无翻译、不改标点
- [ ] 音色措辞只在 `<Audio N>` 与 `Sound:` 行各一次
- [ ] 正文未重复音色措辞
- [ ] 台词量未超 5 秒容量
- [ ] `overall_soundscape` 1–4 句，无台词无叙事内音乐
- [ ] `non_diegetic_music` 只写乐器节奏，无情绪词

## M. 角色与场景

- [ ] 祥子：灰青发 / 后脑全长 / 金瞳 / 160 / C 杯 / 无发卡
- [ ] 睦子：浅绿发 / 绿睫 / 琥珀瞳 / 眼角倦怠 / 155 / B 杯 / **左耳上方发卡 / 右侧无饰** / 装束锁定
- [ ] 墨提斯：**无发卡 / 无耳饰 / 胸口红宝石** / 声略高
- [ ] 同框段有 `Distinct identities in frame` 判别句
- [ ] 场景元素逐项列，不概括
- [ ] 场景排他声明已写
- [ ] 天空锁已写
- [ ] 指示牌明确无可读文字
- [ ] 遮阳伞明确保持收起

### M-1 服饰一致性（续写必查，见 §1.6.5）

- [ ] 每段都有 `Outfit anchors` 行
- [ ] 同一件衣服在各段用的**英文词完全一致**（不换同义词）
- [ ] 配饰全部带**左右方位**
- [ ] 显式写了「材质反应与上段相同」
- [ ] 没有用「同上段」省略
- [ ] 镜面分级随镜别变，但**材质本身没变**

## N. 压制词

- [ ] 画风串后已追加 `Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.`
- [ ] 每段都写，无「同上段」
- [ ] 已写完整性句 `Every element inside the frame belongs to the physical scene...`
- [ ] 场景板负面清单含 `text, subtitles, sign lettering, watermark, logo`
- [ ] 指示牌写 `whose board carries no legible lettering and no text of any kind`
- [ ] 遮阳伞写 `remaining folded and furled throughout`
- [ ] 独立负面句只在三处合法位置

## O. 禁用词扫描

- [ ] 无 `subtitle / caption / lower third / text overlay / watermark / logo / UI`（压实行除外）
- [ ] 无 `pushes away / shoves / grabs / throws / sweeps / suddenly / violently`
- [ ] 无 `fingers intertwined / hands clasped together`（未拆写）
- [ ] 无 `eases into / settles into / now holds / begins to / starts to`
- [ ] 无 `whip pan / shake / handheld / orbit / 360 / dolly zoom`
- [ ] 无 `glossy / shiny / silky / reflective surface`
- [ ] 无 `glow overlay / lens flare / god rays / soft light beams`
- [ ] 无自加 `masterpiece / 8k / best quality`（画风 8 自带除外）
- [ ] 无 `[Xs-Ys]` / `From 00:00 to 06:00`
- [ ] 段 2 起无 `At frame one` / `In the first frame`

## P. 平台

- [ ] 请求 6s（段 2 起），交付约 5.08s
- [ ] Prompt Optimizer 关闭
- [ ] 种子统一
- [ ] 参考图 ≤ 9 张，参考视频 ≤ 3 段，参考音频 ≤ 3 段
- [ ] 提示词总长 **≤ 6,000 字符**（插件收紧值；官方 7000 过大，注意力会被稀释）
- [ ] 分辨率 / 帧率 / 步数 / CFG / seed 未进任何字段

---

# 第十三章　问题速查

## 生成层

| 症状 | 根因 | 修法 |
|:---|:---|:---|
| 发卡出现在右侧 | 只写 `left` 有歧义 | 改解剖方位 + `right side bare`；错了做镜像 |
| 角色特征丢失 | 身份绑两次或绑成空壳 | 只用 `<Subject N> is the visual content referenced from <Picture N>, 名字, with 完整特征` |
| 声线不对 | 音色与正文措辞打架 | `<Audio N>` 与 `Sound:` 行各一次，正文不重复音色 |
| 天空变蓝 | 场景板蓝天被继承 | 天空锁 + `entirely overridden` |
| 构图被锁死在全景 | 未写排他声明 | 加 `Exclude <Picture N>'s camera angle, its framing...` |
| 背景凭空出现器材 | 场景板残留拍片元素 | 场景板负面压 `camera equipment, light stand, tripod, film crew` |
| 牌子长出文字 | 指示牌手写痕迹被识别成字 | 写 `whose board carries no legible lettering and no text of any kind` |
| 遮阳伞被展开 | 未声明状态 | 写 `remaining folded and furled throughout` |
| 无靠背长椅出现靠背 | 动作写了倚靠 | 改为双手撑在身后椅面 |
| 出字幕 | 画风串缺压实行 | 画风串后追加 Text suppression 行 |
| 出 overlay | 缺完整性句 | 加 `Every element inside the frame belongs to the physical scene...` |

## 接缝层

| 症状 | 根因 | 修法 |
|:---|:---|:---|
| 接缝断裂、人物瞬移 | 写了首帧姿态，与实帧冲突 | 删 `At frame one` 类硬锚，改 `Carried state` 声明 |
| 动作被吃掉 | 动作写在 0 秒，落进裁切区 | 动作一律从 1 秒起 + `Timing discipline` 句 |
| 切镜闪、色温跳 | 光比与太阳高度各段不同 | 日落前所有段光与太阳高度完全一致 |
| 另一人的手出现在错误位置 | 出画项未重述 | `Must restate because it fell outside the previous frame: ...` |
| 对话被重演一遍 | 未写「第一秒延续」 | `The first second continues the carried walk with no new event.` |

## 运镜层

| 症状 | 根因 | 修法 |
|:---|:---|:---|
| 不知所谓的漂浮运镜 | cut + move 混写，或多意图叠加 | 一段一意图；切点在 0 秒，运镜从 1 秒起 |
| 镜头缓缓漂移 | 运镜指令被裁切吃掉前半段 | 运镜句放 1 秒后 |
| 该停的不停 | 未写落点 | `...toward her eyes and stops there.` |
| 自己造了新构图 | 无切镜段未写死 | `No cut and no camera move: ...` |
| 变焦与横移同时发生 | 画风串自带运镜未删 | 删画风串内机位句，加 override 行 |

## 光影层

| 症状 | 根因 | 修法 |
|:---|:---|:---|
| 画风很烂、像塑料 | 光影层太薄 | 补主光四要素 + 材质区分 |
| 暗部糊成一片灰 | 未写暗部行为 | 4:1 写 `holds readable detail`，8:1 写 `deep flat shadow` |
| 柔光渐变，不是赛璐璐 | 未写硬边声明 | `single hard edge, never an airbrushed blend` |
| 夕阳变成白饼 | 只写 core 不写 halo | 补 `with a wide soft halo` |
| 日轮变成圆球 | halo 没给方向 | 补 `spreading over the horizon` |
| 海面变贴纸白带 | 缺 `separate bright strokes` | 补离散笔画句 |
| 人物脸上有橘色光斑 | 缺人物干净声明 | 补 `no glow bleeding onto their hair, skin or clothing` |
| 人物变成纯黑剪影 | 夜景只写 silhouette | 补 `still hold readable skin tone instead of falling into pure black` |
| 会场灯糊成一片 | 未写 `each burns as a hot core` | 逐灯成核 |
| 水面倒影变静态噪点 | 缺 `shift with the waves` | 补随波句 |
| 腿部变塑料 | 拉了 bloom 仍写 specular + glossy | 改 `soft scattered sheen`，删 glossy |
| 整只眼睛发光 | 瞳孔光写 `her eyes glow` | 改 `one tiny pinpoint of sunset reflection inside her pupil` |
| 画面糊成一片雾 | 写了 `glow overlay` / `god rays` | 改 `hot core` + `soft halo` |

## 表演层

| 症状 | 根因 | 修法 |
|:---|:---|:---|
| 毫无情绪 | 全是摄影术语，没人 | 加视线路径、延迟、微动作、停顿 |
| 表情僵持不变 | latent 保守，未推变化 | 表情逆转三段：震动 → 下沉 → 定型 |
| 动作复读机 | 只写持握状态 | 动作闭环，给结束状态 |
| 肢体动作夸张变形 | 未写幅度约束 | 补 `keeping both arms below shoulder height, moving only from the forearm down` |
| 台词抢话 | 5 秒塞太多句 | 拆段，或压到两句 |

## 平台层

| 症状 | 根因 | 修法 |
|:---|:---|:---|
| 进度条卡在 0% | 整片直提 / 参数不被接受 / 音频超长 | 分段提交；先去掉 `steps`；检查音频 2–15s |
| 报错或空返回 | 字段名不被接受 | 试 `detailed_description` 与 `integrated_multimodal_description` 各一发对比 |
| 时长只有 4s | 请求 5s 被裁 0.92s | 改请求 6s |
| 音频被当台词复述 | 缺音频语义锁 | 补 `do not describe or reproduce any semantic content from the audio` |

---

# 第十四章　调试协议

## 14.1 链路验证顺序

1. 单图 + 无音频 + 5s + 静止单镜 → 能出片？
2. 加第二张图
3. 加场景图
4. 加一段音频
5. 换 608p
6. 加 `steps`
7. 才上正式分段内容

**哪一步卡住，问题就在那一步。**

## 14.2 两个必做 A/B

**对照 1：字段名是否被解析**

把任一段的 `detailed_description` 改名为 `integrated_multimodal_description`，其余一字不改，各跑一发。

- 效果一致 → 字段名不被解析，纯文本拼接；位置才是唯一变量
- 效果不同 → 平台认字段名，必须用官方名

**对照 2：0.92s 裁切在哪一层**

看 output 文件元数据。

- 文件时长 = 请求时长但内容被裁 → 裁在 skill 层
- 文件时长 = 请求时长 − 0.92s → 裁在平台层，必须请求 6s

---

# 第十五章　禁词与压制词体系

## 15.1 压制词的三处合法位置

禁词不是全局禁。同一个词在不同字段的合法性完全不同。

| 词性 | 例子 | 合法位置 |
|:---|:---|:---|
| **结构词** | 字段名、`At 00:03.000`、`<d>` | `detailed_description`、`Sound:` 行 |
| **描述词** | `narrow specular streak`、`hard-edged` | 全部字段（正向描述） |
| **压制词** | `NO subtitles`、`no legible lettering`、`no glow bleeds` | **只有三处** |

| # | 位置 | 例 |
|:--|:---|:---|
| 1 | 画风串后的追加压制行 | `Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.` |
| 2 | 场景板出图负面清单 | `people, text, subtitles, sign lettering, watermark, logo...` |
| 3 | 具名物的属性声明（正向句法） | `whose board carries no legible lettering and no text of any kind` |

**其余字段一律不得出现独立负面句。** `retention_analysis` 里堆 `Forbidden: no extra fingers, no subtitles` 是废的——那里没有通道，只占字数、稀释注意力。

### 判断口诀

```
句子主语是可画的东西 → 正向描述
句子主语是「不要什么」 → 只在上面三处
```

## 15.2 字幕与 overlay 防线（三条件）

### 防线 1：画风串追加压制行

画风 10 的串面**不含**字幕压制句。为不破坏「画风串逐字不改」，压实行**另起一行追加**，不动原文一字。

```text
90s Japanese adult OVA theatrical animation style. Cel animation texture, high saturation, hard shadows. 4K resolution. CRITICAL: All hands must have exactly five distinct fingers with clear joints. No limb duplication. The camera holds a perfectly static shot throughout

Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.
```

位置：画风串之后、光影层之前。**每段都写，不写「同上段」。**

实测状态：画风 10 + 压实行 → 无字幕（确认可用）。

### 防线 2：画面完整性句

```text
Every element inside the frame belongs to the physical scene: paving, railing, sea, sky, foliage and the figures themselves. Nothing floats over the image.
```

主语是「画面里的东西」，正向描述，不给 overlay 留位置。

位置：`detailed_description` 末尾、免责句之前。

**实测状态：overlay 出现率 0。每段必写。**

### 防线 3：场景文字属性声明

```text
a wooden signpost whose board carries no legible lettering and no text of any kind
```

正向句法（主语是牌子），属三处合法位置之一。场景板负面清单必须配套含 `sign lettering, text, subtitles, watermark, logo`。

## 15.3 禁用词总表（七类）

### 类 1：UI 与叠加层

理由：**raw negative 无通道 + 描述 UI 元素会画出 UI**。不是词本身触发。

| ❌ 禁用 | 原因 | ✅ 替代 |
|:---|:---|:---|
| `subtitle` / `caption` / `closed caption` | 描述叠加层本身 | 只在压实行出现 |
| `lower third` / `title card` / `banner` | 招图形层 | 删 |
| `text overlay` / `on-screen text` | 描述叠字行为 | 只在压实行出现 |
| `watermark` / `logo` / `credits` | 描述叠加层 | 只在压实行出现 |
| `UI` / `HUD` / `interface` / `timer` | 描述界面 | 删 |
| `label` / `sticker` / `badge` | 招小字块 | 改材质描述 |
| `subtitle-safe area` | 反向招字幕区 | 删 |

**允许**：`sign reading "营业中"` —— 确需可见文字时用英文双引号逐字保留，且必须配场景板负面。

### 类 2：表演夸张

| ❌ 禁用 | 原因 | ✅ 替代 |
|:---|:---|:---|
| `pushes away` / `shoves` / `flings` / `yanks` | 大幅位移，模型做成横扫 | `slides ... in one slow, low, unhurried movement` + 幅度约束 |
| `grabs` / `snatches` / `clutches` | 手指张力过大，多指崩 | `settles flat on` / `rests on` |
| `throws` / `swings` / `sweeps` | 动作弧过大 | 删，改静态或低幅 |
| `suddenly` / `instantly` / `in a flash` | latent 保守，突变成形 | `over a held beat` / `then` |
| `violently` / `wildly` / `fiercely` | 破形 | 删 |
| `seductive` / `sultry` / `erotic` / `passionate` | 抽象 + 破形 | 写物理证据（第八章） |
| `dramatic` / `intense` / `cinematic`（作形容词） | 抽象 | 写光比与机位事实 |

**唯一可靠解法是幅度约束：**

```text
Keeping both arms below shoulder height and close to her body, moving only from the forearm down, she ...
She does not lift her arm, she does not sweep outward, and her elbow never rises above her waist.
```

### 类 3：手部与解剖

| ❌ 禁用 | ✅ 替代 |
|:---|:---|
| `fingers intertwined` / `hands clasped together` | 逐手分开写，写清哪只在哪 |
| `a mass of hands` / `multiple hands` | 精确到 `exactly five distinct fingers with clear joints` |
| `several` / `many`（指人体部件） | 精确数量 |
| `blurred motion`（在手部） | 删，改静止 |

**画风串 CRITICAL 句是唯一防线，不可删：**

```text
CRITICAL: All hands must have exactly five distinct fingers with clear joints. No limb duplication.
```

### 类 4：镜头与运镜

| ❌ 禁用 | 原因 | ✅ 替代 |
|:---|:---|:---|
| `eases into` / `settles into` / `now holds` / `begins to` / `starts to` | 多意图，非官方动词 | 官方动词 + 落点 |
| `cut + move` 同句 | 切点与运镜混写 | 切点在 0s，运镜从 1s 起 |
| `truck + zoom` 同时 | 两种位移叠加 | 只留一个 |
| `whip pan` / `shake` / `handheld` / `vertigo` / `dolly zoom` | 极端运镜，必穿模 | 删 |
| `orbit` / `360` / `spiral` | 多轴旋转，几何全崩 | 删 |
| `continuous from the carried truck into...` | 跨段续运镜 | 删，本段重新声明机位意图 |

### 类 5：画质与风格

| ❌ 禁用 | 原因 |
|:---|:---|
| `photorealistic` / `realistic skin` / `realistic textures` | 与赛璐璐对抗 |
| `3D render` / `PBR`（画风 6 除外） | 同上 |
| `glossy` / `shiny` / `silky` / `reflective surface` | 无物理依据，腿部变塑料 |
| 自加 `masterpiece` / `8k` / `best quality` / `ultra detailed` | 只允许画风 8 自带 |
| `glow overlay` / `lens flare` / `god rays` / `soft light beams` / `glowing orb` | 滤镜词，画面糊成一片雾 |

### 类 6：参数与元信息

| ❌ 禁入 | 归属 |
|:---|:---|
| `1080p` / `60fps` / `24fps` | 平台参数 |
| `steps` / `CFG` / `seed` / `motion strength` | 平台参数 |
| `aspect ratio 16:9` | 平台参数 |
| `[reference generation]` 以外的方括号前缀 | 非官方 |
| `[video continuation]` | 会触发 `<Video 1>` 误判 |

### 类 7：时间与硬锚

| ❌ 禁用 | 原因 | ✅ 替代 |
|:---|:---|:---|
| `[0s-2s]` / `From 00:00 to 06:00` | 非官方时码格式 | 无时码，靠 `Timing discipline` |
| `At frame one` / `In the first frame`（段 2 起） | 写死首帧，与实帧冲突 | `Carried state:` 声明 |
| `[Shot 1] At 00:00.000` | Shot 1 不带时间戳 | 只有 Shot 2 起带 `At MM:SS.mmm` |
| 第 0 秒放动作（段 2 起） | 落进裁切废区 | 动作一律 1s 起 |

## 15.4 正向替代短语库

### 压制类

```text
Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.
```
```text
Every element inside the frame belongs to the physical scene: paving, railing, sea, sky, foliage and the figures themselves. Nothing floats over the image.
```
```text
a wooden signpost whose board carries no legible lettering and no text of any kind
```

### 解剖类

```text
CRITICAL: All hands must have exactly five distinct fingers with clear joints. No limb duplication.
```
```text
the pads of exactly five distinct fingers with clear joints lying flat on the nylon
```

### 幅度约束类

```text
Keeping both arms below shoulder height and close to her body, moving only from the forearm down, she slides her hand sideways in one slow, low, unhurried movement. She does not lift her arm, she does not sweep outward, and her elbow never rises above her waist.
```

### 收束类

```text
The final frame holds both seated, still and upright.
```
```text
No cut and no camera move: the frame stays in the exact same medium two-shot as the previous segment, same distance, same angle, same composition.
```

### 光域类

```text
Bloom is confined to the sun disc and the sea glint: ... both allowed to clip to pure white. The figures stay clean and no glow bleeds onto their hair, skin or clothing.
```
```text
That glow never spills onto the two figures.
```
```text
Nothing else glows, and her skin, lashes and clothing stay clean with no glow bleeding onto them.
```

### 具名物属性类

```text
a furled pale parasol behind it, remaining folded and furled throughout
```
```text
one backless wooden bench facing the sea
```

## 15.5 字段级合法性矩阵

| 词类 | `subject_definitions` | `summary` | `retention_analysis` | `detailed_description` | `overall_soundscape` | `non_diegetic_music` |
|:---|:---|:---|:---|:---|:---|:---|
| 画风串负面词 | ✗ | ✗ | ✗ | **✓ 仅画风串内** | ✗ | ✗ |
| 追加压实行 | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ |
| 完整性句 | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ |
| 具名物属性句 | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ |
| 独立 `Forbidden:` 列表 | ✗ | ✗ | **✗** | ✗ | ✗ | ✗ |
| 参数词 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 抽象情绪词 | ✗ | ✗ | ✗ | ✗ | ✗ | **✗** |
| 台词 `<d>` | ✗ | ✗ | ✗ | **✓ 正文与 `Sound:` 行皆可** | ✗ | ✗ |
| 音色措辞 | ✓ 仅 `<Audio N>` | ✗ | ✗ | **✓ 仅 `Sound:` 行** | ✗ | ✗ |
| 时间戳 | ✗ | ✗ | ✗ | **仅 Shot 2 起** | ✗ | ✗ |

---

# 第十六章　核心信条

1. **平台是潜空间续写。段 2 起裁 0.92s，动作从 1 秒起。**
2. **续写开关放最顶部，三句：latent 权威 / 禁止图重置 / 光继承。**
3. **段 2 起禁止写死首帧姿态，只声明承接。段 1 例外。**
4. **四类必须重述：出画项、被遮挡特征、抽象规则、需推进的变化。**
5. **身份只绑一次，在 `<Subject N>` 内，外观逐项列。**
6. **画风串逐字照抄；机位冲突用 override 行，不删原文。所有画风统一追加压制行。**
7. **光影层七段式，每段写全，主光四要素缺一必漂。**
8. **Bloom 必须有主，人物必须干净。光源域全放行（core + halo + clip），介质域放行（不上滤镜），人物域死守（no glow bleeding）。**
9. **镜面分级四级，按镜指定，不许一段统一。瞳孔 pinpoint 是唯一进入人物域的 bloom。**
10. **硬边声明不删。bloom 是光晕层，硬边是明暗分界层，两者不冲突。**
11. **情绪写物理证据，不写形容词；悬停比接触更有力。**
12. **一段一个机位意图，带落点，能用硬切就别运镜；大幅肢体动作必写幅度约束。**
13. **否定句转正面描述。措辞禁令的理由是 raw negative 无通道，不是词本身触发画面。**
14. **压制词只许出现在三处：画风串追加行、场景板负面清单、具名物属性句。其余字段不得出现独立负面句。**
15. **每段必写画面完整性句。台词 `<d>` 正文与 `Sound:` 行皆可，不招字幕。**

---

# 附：与本插件的对应关系（v2.1）

> 这一节是插件侧追加的，不是群友原文。

## 已固化进代码的规则

| 总纲条目 | 固化位置 | 说明 |
|---|---|---|
| 第一章·续写开关三组件（1.3） | `h3-prompt.js` 的 `CONTINUATION_SWITCH.carried` | 拼在提示词最顶部 |
| 第一章·裁切区时序纪律（1.5） | `TRIM_DISCIPLINE` | 前 1 秒不写新事件 |
| 第一章·段 1 开场声明（1.4） | `CONTINUATION_SWITCH.opening` | 开场段反向声明 |
| 第二章·人物标准句式（2.1） | `compileRef2VA` 的 subject 生成 | `<Subject N> is the <content> referenced from <Picture M>` |
| **第三章·画风池（3.2–3.11）** | `STYLE_PRESETS` 的 `en` | **2026-11-18 已换成官方原文逐字照抄**（此前是重写的简版，丢了 `NOT 3D` / `NO subtitles` 等约束） |
| 第三章·画风 × bloom 兼容性（3.13） | 人工参考 | 代码未自动校验，选画风时自查 |
| 第六章·四档光比模板（6.13） | `LIGHTING_PRESETS` | 2:1 / 3:1 / 4:1 / 6:1 / 8:1 / 边缘光 |
| 第六章·画风 × 打光取舍 | `styleLightingConflicts()` | 冲突时出 warning |

## 未固化、仍属「写作指导」的部分

下面这些需要**写提示词的人/模型**理解，代码无法自动执行：

- 第零章·模式判定（2 张以上参考图或有音频 → 必走六字段）
- 第一章·四类必须重述（出画项 / 遮挡特征 / 抽象规则 / 需推进的变化）
- **第六章·七段式光影**（主光 / 体积光 / 材质响应 / **镜面分级** / **Bloom 域授权** / **人物干净声明** / 天空锁）
- **第六章·镜面分级四级表 + 受压三态**
- **第六章·Bloom 域三域白名单 + 强度三档**
- 第七章·分镜写作法（动作轨迹、动作闭环、末帧收静止、**肢体幅度约束**）
- 第八章·情绪写作法（悬停法、**表情逆转三段式**）
- 第十章·九段三段式免责句变体
- 第十二章·总检查清单（A–P 16 组）、第十三章·问题速查表
- **第十五章·禁词与压制词体系**（七类禁用词 + 正向替代库 + **字段级合法性矩阵**）

## ⚠️ v2.1 新增但本插件**不适用**的部分

| 章节 | 为什么不适用 |
|---|---|
| **第十一章 Seedance → H3 转换规程** | 本插件的 `seedance-cloud` 后端已整体删除（它从来没有过 API key，是一条永远走占位产物的死链路）。转换表对「拿到别人 Seedance 分镜表要转成 H3」的场景仍有用，可作人工参考 |
| 第零章·提交参数表 | 群友平台的值（6s/16:9/24fps/Prompt Optimizer 关闭）与本地不同，见下表 |
| 第零章·分辨率与步数分配 | 640p/16 步、608p/14 步是群友平台档位；本地是 864×480（0.4MP）+ DMAD 4/8 步 |
| 第零章·分段策略「单段 ≤6s」 | 本地帧网格是 17k+5，6s 会吸附到 158 帧（6.58s）；正确做法见下表 |

## ⚠️ 与本地参数的差异（重要）

v2.1 的参数层是**群友自己平台**的实测值，本地不完全适用：

| 项 | 总纲 v2.1 | 本地南风 V15 |
|---|---|---|
| 6s 请求的采样帧数 | 144 帧（不做网格吸附） | **158 帧**（吸附 17k+5） |
| 段 1 交付 | 5.08s | **5.167s**（124 帧，不裁） |
| 段 2-9 交付 | 5.08s | **4.958s**（141 帧裁 22） |
| 九段总长 | 45.6s | **44.83s**（配 5.167 + 8×4.958） |
| 步数 | 14 / 16 | **DMAD 4 或 8 步**（蒸馏学生的训练设定） |
| 分辨率 | 608p / 640p | **864×480（0.4MP）**，二采可到 1472×832 |

**本地的 45s 正确配方**（`continuation.js` 的 `planSegments()` 自动算）：

```
段 1:   请求 5.167s → 124 帧 → 交付 5.167s（不裁）
段 2-9: 请求 5.875s → 141 帧 → 裁 22 帧 → 交付 4.958s
合计 = 5.167 + 8×4.958 = 44.83s ≈ 45s ✅
```

> 注意：不要按 v2.1 的「每段 6s」去提交 —— 6s 会被吸附到 158 帧，
> 九段就会变成 51.9s，比目标多 7 秒。

## 用法建议

- **写提示词时**：把本文件当权威参考，尤其第一章的续写开关、第六章的七段式光影、第十五章的禁词体系
- **要出片时**：参数按本插件渲染页的预设来，不要照抄第零章的参数表
- **排查问题时**：第十三章「问题速查」按症状查，按层次分组（生成/接缝/运镜/光影/表演/平台）
- **从别人的分镜表转换时**：用第十一章的转换表，但时长按本地网格重算
