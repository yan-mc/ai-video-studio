# H3 Skill 总纲 v2.1 相对 v2.0 的变更清单

> 用途：精确记录群友从 v2.0（2041 行）升到 v2.1（2105 行）改了什么，
> 供本插件决定哪些要落进代码、哪些只进 skill 文档。

## 一、结构层变化（v2.0 → v2.1）

| 项 | v2.0 | v2.1 |
|---|---|---|
| 组织方式 | 五批（第一批…第五批），中间夹着混乱的 `v6.0` 标题 | **16 章**（第零章~第十六章），编号连续 |
| 开头 | 直接进第一批续写 | **新增第零章**：模式判定 / 六字段 / 提交参数 / 分辨率与步数 / 分段策略 |
| 六字段 | 第二批讲结构 | 第二章，并补「音频标准句式（社区成功语法，逐字使用）」 |
| `detailed_description` | **六层**结构 | **七层**结构（新增一层） |
| 光影层 | 五段式 | **七段式**（新增：镜面分级、Bloom 域授权、人物干净声明） |
| 声画章节 | 第八节「说话人与台词」 | 独立**第九章**「声音与台词」，新增「台词可两处出现」「音频投喂」 |
| Seedance | 无 | **新增第十一章**「Seedance → H3 转换规程」 |
| 检查清单 | 5 批各有一份 | **第十二章统一一份**，从 A~P 共 16 组（原 A~K 11 组） |
| 禁词体系 | 散在各批 | **新增第十五章**「禁词与压制词体系」（七类禁用词 + 正向替代库 + 字段级矩阵） |

## 二、真正的新增规则（需要落进代码/skill）

### 1. 第零章：模式判定与提交参数（全新）

- **判定规则**：有 2 张以上参考图，或有音频参考 → **必走六字段**（R2VA）；否则基础模式 3 字段
- 多图走基础模式属**模式错配**，图会被当成「首帧」处理，其余全丢
- 提交参数表：单段 6s / 交付 5.08s / 16:9 / 24fps / Prompt Optimizer **必须关闭** / 种子全片统一
- **分辨率与步数分配表**（新）：

  | 类型 | 分辨率 | 步数 |
  |---|---|---|
  | 全景+人物小 | 640p | 16 |
  | 中景文戏 | 608p | 14 |
  | 肢体交互 | 608p | 16 |
  | 纯环境全景 | 640p | 16 |

- **分段策略**：无固定段数，每段 ≤6s；单段内允许 **1 次硬切**，超过 1 次则拆段

### 2. 光影系统升级为七段式（核心变更）

v2.0 五段：主光 / 体积光 / 材质响应 / 高光纪律 / 天空锁

v2.1 七段（顺序固定）：

| 序 | 段 | 内容 |
|:--|---|---|
| 1 | 主光系统 | 方位 / 高度 / 入射角 / 光比 / **硬边声明** |
| 2 | 体积光 | 介质 / 遮挡物 / 尘粒 |
| 3 | 材质响应 | 逐材质列 |
| 4 | **镜面分级**（新） | 四级：无 / 漫射 / 散乱 / 窄条，逐镜指定 |
| 5 | **Bloom 域授权**（新） | 三个域（光源/介质/人物）+ 强度三档 |
| 6 | **人物干净声明**（新） | 一句封死人物溢光 |
| 7 | 天空锁 | 渐变 + 云 + 排除白天 |

**新增的镜面分级四级表**：

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

**Bloom 域授权三域**：

| 域 | 处理 |
|---|---|
| 光源域（日轮/灯/霓虹/水面反射点） | 放行，写 core + halo + clip to pure white |
| 介质域（光柱/尘粒/海雾） | 放行，不加 glow 滤镜 |
| 人物域（皮肤/头发/睫毛/衣物/腿部） | **死守**，一句"绝不溢光"钉住 |

标准句式（四段结构）：
```
Bloom is confined to [域 A] and [域 B]: [A 写法], [B 写法], both allowed to clip to pure white. [人物] stay clean, with no glow bleeding onto [器官列表].
```

强度三档：`clip`（clip to pure white）/ `blown`（frays into a blown bloom）/ `frazzle`（frazzles into blown points）

**词汇纪律**：
- ✅ `hot core` / `soft halo` / `clip to pure white` / `blown` / `frazzle`
- ❌ `glow overlay` / `lens flare` / `god rays` / `soft light beams` / `glowing orb`

### 3. 新增第十五章：禁词与压制词体系（全新，最重要的一章）

**压制词的三处合法位置**（其余字段一律不得出现独立负面句）：

| # | 位置 | 例 |
|:--|---|---|
| 1 | 画风串后的追加压制行 | `Text suppression: NO subtitles, NO on-screen text, NO captions, NO watermarks, NO logos, NO UI overlays.` |
| 2 | 场景板出图负面清单 | `people, text, subtitles, sign lettering...` |
| 3 | 具名物的属性声明（正向句法） | `whose board carries no legible lettering and no text of any kind` |

**判断口诀**：
```
句子主语是可画的东西 → 正向描述
句子主语是「不要什么」 → 只在上面三处
```

**字幕与 overlay 三道防线**：
1. 画风串后追加压制行（每段都写，不写"同上段"）
2. 画面完整性句：`Every element inside the frame belongs to the physical scene... Nothing floats over the image.`
3. 场景文字属性声明：`a wooden signpost whose board carries no legible lettering and no text of any kind`

**七类禁用词**（各带替代写法）：
- 类 1 UI 与叠加层：`subtitle` / `caption` / `watermark` / `logo` / `UI` / `HUD` / `label`
- 类 2 表演夸张：`pushes away` / `grabs` / `suddenly` / `violently` / `seductive` / `dramatic`
- 类 3 手部与解剖：`fingers intertwined` / `a mass of hands` / `several`
- 类 4 镜头与运镜：`eases into` / `settles into` / `whip pan` / `orbit` / `360`
- 类 5 画质与风格：`photorealistic` / `3D render` / `glossy` / `shiny` / `lens flare`
- 类 6 参数与元信息：`1080p` / `24fps` / `steps` / `CFG` / `aspect ratio`
- 类 7 时间与硬锚：`[0s-2s]` / `At frame one`（段 2 起）/ 第 0 秒放动作

**字段级合法性矩阵**：一张表规定每类词只能出现在哪个字段。

### 4. 画风串必须逐字照抄（v2.1 明确铁律）

`3.1 使用规则`：**逐字照抄，不缩写、不改写、不合并**。

并新增 `3.13 画风与 bloom 拉满的兼容性`：

| 画风 | 兼容性 | 处理 |
|---|---|---|
| 1 / 2 / 5 / 9 | ❌ 含 `no gradients` 或 `stark graphic blocks` | 不用于 bloom 主导的段落 |
| 6 | ⚠️ 自带 `soft diffuse shadows` | 硬边声明改 `smooth shadows with gentle transitions` |
| 8 | ⚠️ 自带 `magical glow` `Slow camera pan` | 删 `Slow camera pan`，`magical glow` 保留 |
| 7 | ⚠️ 串含 `NO soft lighting` | 删该句 |
| 4 | ✅ 极度兼容 | 直接用，可再加强度 |
| 10 / 3 | ✅ 完全兼容 | 直接用 |

### 5. 第七章新增：肢体幅度约束（防夸张变形）

v2.0 只有"动作闭环"，v2.1 新增 `7.5`：
```
Keeping both arms below shoulder height and close to her body, moving only from the forearm down...
She does not lift her arm, she does not sweep outward, and her elbow never rises above her waist.
```

### 6. 第五章新增：无靠背长椅的行为约束

场景里的长椅**无靠背**，任何"倚靠"都会穿模：
```
❌ She leans back against the backrest.
✅ She braces both palms flat on the bench seat behind her hips, and brings both hands up to clasp behind her head.
```

### 7. 情感：表情逆转三段式（v2.0 是"写法"，v2.1 明确三段式）

### 8. 第九章新增：台词可两处出现 / 音色声明只出现两处 / 音频投喂

### 9. 第十一章：Seedance → H3 转换规程（全新）

逐表对位（`時間`→累计切段、`サイズ`→景别句、`カメラ`→机位意图、`映像内容`→动作+光影、`台詞/SE`→`Sound:` 行）
+ 合段规则 + 光影措辞转换表（13 条）+ 三处常见修正 + 段数时长核对（`段数 × 5.08s`）

### 10. 人物档案细化

- 睦子发卡的方位写法：**只写解剖方位，不写画面左右**（`her own left side`）
- 新增墨提斯（Mortis/S3）档案：无发卡、胸口红宝石、同脸倦怠感
- 同框防混淆的**判别句位置表**（哪段必写、哪段可省）

## 三、与本地实现的冲突点（必须处理）

| 冲突 | v2.1 说 | 本地现状 |
|---|---|---|
| 画风串 | **逐字照抄，一字不改** | `h3-prompt.js` 的 `STYLE_PRESETS[].en` 是**重写的简版**，11 个全部丢了官方的 `NOT 3D` / `NO subtitles` / `NO photorealistic textures` 约束 |
| 光影层 | 七段式 | 代码只有 5 种光比预设，无镜面分级 / Bloom 域 / 人物干净声明 |
| 压制词位置 | 只有三处合法 | 代码的 lint 会检查负面词，但不知道"三处合法位置"这个规则 |
| 段长 | 6s 请求 → 5.08s 交付 | 本地帧网格是 17k+5，6s→158 帧→6.58s；**群友的 6s→144 帧是他自己平台的**（v2.0 已经标注过这个差异，v2.1 沿用） |
| 分辨率步数 | 640p/16 步、608p/14 步 | 本地是 864×480（0.4MP）、DMAD 4/8 步，**完全不同的档位** |
| Seedance | 有完整转换规程 | 本地已删除 seedance 后端 |

> 结论：**规则层（禁词/光影/分镜/情绪/画风兼容性）要吸收；
> 参数层（时长/分辨率/步数）必须保留本地值，不能照抄群友的**。
> 这条差异 v2.0 已经在 skill 末尾写过，v2.1 也需要保留。