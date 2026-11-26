# 图像提示词编译器与画风通道

> 对应代码：`host/services/image-prompt/`（6 个文件）+ `host/services/ref-images.js` 的 `appendStyleAnchors`
> 前端：`app-src/src/pages/ImagePage.tsx` 的「画风参考图」面板
> 调研依据：[`docs/research/H3-Image-画风与提示词.md`](../research/H3-Image-画风与提示词.md)

---

## 一、为什么需要它

H3-Image 官方两个模板在采样器**前面**都有一个 prompt expander（PE，Qwen3.8-27B），
默认开启，把一句简短需求改写成详细的英文描述。

**我们的工作流里没有这一步**（11 个节点，无 expander）。后果：

- 用户写「画一个在海边的女孩」→ 模型只得到这一句，缺场景细节、缺光线、缺质感，出图平庸；
- 官方模板「随便一句就出好图」，很大一部分功劳在 PE 上。

这个模块就是补上这一环。**不用外部模型**：规则 + 词典 + 模板，确定性、零延迟、可单测。

---

## 二、三条画风通道与它们在本项目里的落点

调研结论：H3-Image **只有三条**画风通道，没有任何 `style` 参数。

| 通道 | 强度 | 本项目落点 |
|---|---|---|
| 提示词里的画法描述 | 中偏弱 | `expand.js` 的画法词表 + `styles.js` 的 11 套预设 en |
| **参考图（画风锚）** | **最强、零成本** | `style-anchor.js` + 前端「画风参考图」独立面板 |
| LoRA | 强但重 | 已有的 `models/loras/h3img/30_style/` 单选槽 |
| ~~负面提示词~~ | **不存在** | cfg=1，无 CFG；要避免的写进正面提示词 |
| ~~style 参数 / preset~~ | **不存在** | API / 节点 / 插件三层都没有 |

### 2.1 画风锚为什么必须独立成一个通道

`image_1` 在 H3-Image 里有**特殊语义**：它决定输出画布尺寸，并且是"被编辑的原图"。
如果把画风参考图混进 `refImages` 数组：

- 文生图时画布会被画风图的尺寸带偏（用户选 2048² 却出 1024²）；
- 编辑时画风图会被当成被编辑对象，原图反而退到第 2 位。

所以 `appendStyleAnchors()` 把画风锚**永远追加在参考图末尾**，单独计数、单独回报。
前端也是独立面板（`styleAnchors` 与 `refs` 两个 state），并在提示词里显式排除
"主体 / 构图 / 镜头角度"的迁移 —— 这是这条通道最容易翻车的地方。

---

## 三、中文怎么变成英文描述

`expand.js` 的核心是一张**有序词典**（约 600 条）+ 中文语序重排。

### 3.1 语序重排是关键

中文修饰语在名词前：「穿红裙的少女」。逐字直译会得到
`a wearing red dress young woman` 这种病句。所以按角色重排：

```
数词 → 主体名词（复数）→ 颜色 → 穿着 → 姿态动作 → 位置 → 其它
```

「一个穿红裙的少女站在雨中」→ `a young woman wearing a red dress, standing in the rain`

冠词 `a/an` 按后接词首字母选择（`an orange cat` 而不是 `a orange cat`）。

### 3.2 主体 / 场景的切分

内容按原顺序流过主体与场景两段，在第一个**实质场景词**（地点 / 天气 / 时间 / 背景）处切开。
裸介词（在/于/从）本身不算场景起点 —— 它必须紧跟着场景词才有意义，
否则会产出 `in the wind` 这类错句。

「年轻女人在咖啡馆读书」→ 主体 `a young woman`、动作 `She is reading on a café`

### 3.3 未翻译的词怎么处理

**原样保留中文**并交给 lint 告警。不转拼音、不瞎编英文 ——
「看起来翻译了」比「明确告诉你没翻译」危险得多。

### 3.4 覆盖率实测

20 条中文短句压测：**20/20** 全部产出纯英文、≥2 段、不超长。
（典型输入：`赛博朋克少女站在霓虹街头，雨夜，特写` / `海面上的小船，暴风雨，俯视，冷光`）

---

## 四、2D 画风的反 3D 化约束

H3-Image 的底座在 2D 题材上**天然偏 3D**（社区口径一致）。只写 `anime style`
会得到塑料感 + PBR 混血。

`anti3d.js` 判定画风维度后自动追加约束。**判定不是简单的 `changesAppearance === false`**：

1. 先**挖掉**"不要 3D"这类否定表述 —— 绝大多数 2D 画风的 en 里都带
   `NOT 3D` / `NO 3D proportions`，直接 grep `3D` 会把 9 个 2D 画风全判成 3D，正好判反；
2. 明确要 3D / PBR / 写实 → **永不注入**（避免与画风本身打架）；
3. 2D 线索命中 → 注入。

| 结果 | 画风 |
|---|---|
| 注入反 3D（9 个） | helltaker-look / helltaker-style / ova90s / shinkai / ghibli / american-toon / gohands / ligne-claire / vivziepop |
| 不注入（2 个） | ufotable（3D 背景 + 2D 角色）、toon3d-pbr（3D 半写实） |

`anti3dApplied` 的三态：`true` = 已具备、`false` = 2D 但缺、`null` = 该画风不需要。

---

## 五、文字（lettering）的三分支

| 情况 | 行为 |
|---|---|
| 用户给了具体文字 | 逐字进引号并声明位置与拼写 |
| 用户提到有字但没给内容 | **不写 no-text**，改为 lint 提醒补全 |
| 都没提 | 追加 `The image contains no text, letters or numbers.` |

⚠️ 三者**二选一，不能并存**。曾经一边写「周围招牌的霓虹」一边写「画面无任何文字」，
模型照字面画出一块带乱码的招牌 —— 自相矛盾的指令比缺指令更糟。

### 5.1 「场景天然带字」时要用强化声明

实测三次迭代（同一提示词「少女站在霓虹街道上，雨夜，柔光，特写」+ ghibli 画风）：

| 版本 | 措辞 | 结果 |
|---|---|---|
| 初版 | `neon ... from the surrounding signage` + 普通 no-text | **画出日文假名与汉字乱码招牌** |
| 二版 | 改成 `glowing along the street edges`（去掉 signage 名词）| 仍出现招牌 + 假名 |
| 三版 | 上述 + **强化 no-text**（逐项点出 signboard/poster/label/screen 应为纯色）| **招牌只剩纯色光块，无任何文字** ✅ |

原因是「招牌」这个概念在训练数据里几乎总是带字的，**单靠一句 `contains no text` 压不住**。

所以 `noTextSentence(aggressive)` 会在命中霓虹/招牌/海报/黑板/标签/屏幕等题材时，
输出强化版声明：明确要求这些表面只承载纯色或简单几何形状。
普通场景（一只猫、一束花）仍用短句，避免提示词无谓变长。

---

## 六、两条输入路径

| 用户输入 | 行为 |
|---|---|
| 中文 / 短需求 | 走 `expand.js` 展开成完整英文描述 |
| 已完整的英文长描述（≥40 词、几乎无中文） | **只做 lint + 反 3D 注入，不重写** |

第二条很重要：重写只会覆盖用户已经定好的细节。官方实测里 PE 也会犯这个错
（把用户写好的"磨砂银插头"改写成"圆灰插头"）。

---

## 七、接口

### REST `POST /jiuzhang/api/image/generate` 新增字段

| 字段 | 说明 |
|---|---|
| `text` | 短需求 / 中文（与 `prompt` 二选一） |
| `styleId` | 画风 id（见 `/image/meta` 的 `promptCompiler.styles`） |
| `styleAnchorImages` | 画风参考图（最多 2 张） |
| `styleAnchorMode` | `style-only` / `style+palette` |
| `lettering` | 画面文字（字符串或数组） |
| `negativeHints` | 要避免的东西（图像侧合法，并进正面提示词） |
| `compile` | `false` = 跳过编译，按原文提交（排障用） |

响应里新增 `compiled`（用了哪个画风 / 是否注入反 3D / 字符数）与 `promptWarnings`。

### Agent 工具 `studio_image`

参数与 REST 同名；`action='meta'` 会带出 `promptCompiler`（画风表 / 段落 / 画风锚说明 / 反 3D 判定）。

---

## 八、验证记录

| 项 | 结果 |
|---|---|
| 中文 20 条压测 | 20/20 纯英文、≥2 段、不超长 |
| 反 3D 判定 | 9 注入 / 2 不注入，与 2D/3D 分类一致 |
| 幂等性 | 二次调用不重复追加 |
| 视频侧回归 | 22/22 编译无变化（编译器与视频侧零耦合） |
| 端到端出图 | 中文短句 → 吉卜力水彩 / 写实 / 线稿三种画风均生效 |
| 文字三分支 | 无字 / 提到字 / 给了字，三种行为均正确 |

> ⚠️ 编译器与视频侧编译器**完全独立**：不 import `bridge/prompt/*` 的任何逻辑模块
> （只读引用 `styles.js` 的数据表），因此改图像侧不会影响视频侧。
