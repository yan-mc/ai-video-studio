# Skill 体系审查报告

> 审查时间：2026-11-17
> 结论先行：**当前 skill 体系是散的，有 5 个真相源、8 个目录只有 5 份不同内容、
> 1 个目录已丢失、1 套模板用的是被官方否定的旧字段。** 建议重建。

---

## 一、全景盘点：现在到底有哪些"skill"

按**运行时是否真的被加载**分三类：

### ✅ 真正在跑的（2 个入口）

| 名称 | 物理位置 | 谁在读 | 内容 |
|---|---|---|---|
| **h3-prompt.js** | `host/services/h3-prompt.js`（1700+ 行） | `compilePrompt` / `studio_prompt` / `/prompt/*` | **纯内联代码**，不读任何文件 |
| **storyboard 系 skill** | `vendor/nanfeng/*-skill/SKILL.md` | `nanfeng/storyboard.js` 的 `loadSkill()` | 读文件，作为 LLM 的 system prompt |

### 📄 存在但没人加载的（文档）

| 名称 | 位置 | 状态 |
|---|---|---|
| `jiuzhang-studio-prompt` | `skills/` | **❌ 目录已被删除**（git 显示 `D`）|
| `jiuzhang-studio-usage` | `skills/` | **❌ 目录已被删除** |
| `jiuzhang-studio-setup` | `skills/` | **❌ 目录已被删除** |

⚠️ **但 `package.json` 的 `files` 里还写着 `"skills/**"`** —— 打包时会指向不存在的目录。
代码里也没有任何地方读 `skills/`，所以删了不影响运行，只是**文档丢了**。

### 🗄️ 数据里的模板

| 名称 | 位置 | 谁在读 |
|---|---|---|
| `SYSTEM_PROMPT_TEMPLATES` | `host/services/extras.js` 内联 22 条 | `/templates`、工具箱页 |
| 用户自定义模板 | `<dataDir>/extras/prompt-templates.json` | 同上（`data/extras/` 当前是空的）|

### 📥 未接入的

| 名称 | 位置 | 状态 |
|---|---|---|
| 群友 skill 总纲 v2.0 | `群友/# H3 Skill 总纲 v2.0.txt`（2041 行） | ❌ 完全未接入（内容我上轮手工吸收了一部分进代码）|

---

## 二、vendor/nanfeng 下那 8 个 skill 到底是个啥

### 实测：8 个目录 → 只有 **5 份不同内容**，其中 3 份是纯重复

| 目录 | SHA256 前缀 | 大小 | 真相 |
|---|---|---|---|
| `storyboard-skill` | `4AF4284AB41D` | 10.4 KB | **H3 官方提示词**（有 `references/`）|
| `audio-drive-skill` | `4AF4284AB41D` | 10.4 KB | **与 storyboard-skill 逐字节相同！** |
| `storyboard-skill/references/*` | — | 16+24 KB | base-en.txt / ref-en.txt（官方格式细则）|
| `ns-storyboard-skill` | `794B98D08F9B` | 26.7 KB | **海螺 H3 提示词**（中文版，无 references）|
| `oneshot-continuation-skill` | `2BA1B1B3BE35` | 9.7 KB | 一镜到底续写 |
| `oneshot-continuation-ns-skill` | `2BA1B1B3BE35` | 9.7 KB | **逐字节相同** |
| `continuation-cuts-skill` | `9479118D0FC7` | 10.8 KB | 续写·可切镜 |
| `continuation-cuts-ns-skill` | `9479118D0FC7` | 10.8 KB | **逐字节相同** |
| `nonfirst-i2v-skill` | `BF31090554ED` | 13.8 KB | 非首帧 I2V |
| `nonfirst-i2v-ns-skill` | `BF31090554ED` | 13.8 KB | **逐字节相同** |

### 三个严重问题

**① `audio-drive-skill` 是个错误命名的副本**

它和 `storyboard-skill` **SHA256 完全相同**，里面**没有任何音频/音频驱动内容**
（搜「音频|audio|音轨|锁音」只有 2 处，与 storyboard-skill 数字一致）。
南风原包里应该有一个真正的音频驱动 skill，但这份显然**拷错了**。

**② 4 个 `-ns-` 变体是死副本**

`oneshot-continuation` / `continuation-cuts` / `nonfirst-i2v` 三对的
ns 版与 regular 版**逐字节相同**。也就是说「NS 版」只是目录名不同，
内容一模一样。代码里 `CONTINUATION_SKILL_DIRS` 还专门为此写了个二分表：

```js
continuation_cuts: { regular: 'continuation-cuts-skill', ns: 'continuation-cuts-ns-skill' },
```

**③ `storyboard.js` 的 `skillId` 是死参数**

```js
// tools.js:708 —— schema 里暴露了
skillId: { type: 'string', enum: ['regular_storyboard', 'ns_storyboard'] }
// storyboard.js:237 —— 但硬编码传 regular
const skill = loadSkill(mode, 'regular_storyboard');   // ← skillId 根本没往下传
```

所以 **`ns_storyboard`（海螺版，26.7 KB 那份）永远不可达**。
用户选「NS 提示词分镜」实际拿到的是 regular 版。

### 它们分别是什么（内容层）

| skill | 名称（frontmatter）| 用途 |
|---|---|---|
| `storyboard-skill` | H3官方提示词 | 官方英文六段/三段格式，**有 references 细则** |
| `ns-storyboard-skill` | hailuo-prompt（海螺） | 中文流程 + 本地 ComfyUI 结构，26.7 KB 最完整 |
| `oneshot-continuation-skill` | H3一镜到底续写 | 连续长镜头，latent 优先的软动作轨迹 |
| `continuation-cuts-skill` | H3一镜到底续写 | 同上，但**允许用户显式要求的切镜** |
| `nonfirst-i2v-skill` | H3官方提示词 | 非首帧 I2V（图片是参考不是关键帧）|

> 这 5 份是**真的有用**，是南风的提示词资产。问题不在内容，在**组织方式**。

---

## 三、`h3-prompt.js` 到底是个啥

**它是代码，不是 skill 文件。** 这是最容易混淆的地方。

```
h3-prompt.js（1700 行）
├─ STYLE_PRESETS       9 种画风（上轮补到 11）
├─ LIGHTING_PRESETS    光比预设（上轮新建，7 种）
├─ CONTINUATION_SWITCH 续写开关三组件（上轮新建）
├─ TRIM_DISCIPLINE     裁切区时序纪律（上轮新建）
├─ routeFormat()       模式路由（ref/base）
├─ compileRef2VA()     六段式编译器
├─ compileBase()       基础格式编译器
└─ lintCompiledPrompt() 输出后自查
```

**它和 vendor skill 的关系**：`h3-prompt.js` 头注释写着
「官方 skill `h3-prompt-writing`：references/base-en.txt / ref-en.txt」——
但它**从来不读这些文件**（grep `readFileSync` 零命中）。

也就是说：
- **vendor 的 `*-skill/SKILL.md`** → 喂给**智能分镜的 LLM**（让它写出分镜文本）
- **`h3-prompt.js`** → 把分镜/镜头卡**编译成最终提示词**（纯代码规则）

两者是**不同阶段**，不冲突。但 `h3-prompt.js` 的规则是**人肉从 skill 抄进代码的**，
抄的时候没有单一真源，所以它对官方格式的引用全是**注释里的行号**
（`ref-en.txt:278`、`ref-en.txt:126`…），无法自动校验。

---

## 四、`vendor/` 目录下面都是干啥的

```
vendor/
└─ nanfeng/                     ← 南风 V15 的 vendored 副本
    ├─ *.py  (10 个)             ← ComfyUI 自定义节点的实际代码，部署时复制进 custom_nodes
    ├─ VENDOR.md                 ← 改造记录（删了 7026 行哪些、为什么）
    ├─ dlss_schema.json          ← DLSS 参数 schema
    └─ *-skill/  (8 个目录)      ← 提示词资产，仅 storyboard 系 5 份有用
```

**关键理解**：

| 部分 | 是否必需 | 去向 |
|---|---|---|
| 10 个 `.py` | ✅ **必需** | 部署时复制到 `ComfyUI/custom_nodes/nanfeng_prompt_nodes_v15_modified/` |
| `VENDOR.md` | ✅ 有价值 | 应进 docs/ |
| `*-skill/`（8 目录 → 5 份） | ⚠️ **只有 5 份有用** | 应进 skills/ |
| `_removed/` | 📦 历史参考 | 可删或归档 |

---

## 五、`data/extras` 的 promptTemplates 情况

### 现状

- `SYSTEM_PROMPT_TEMPLATES`：**22 条内联在 `extras.js` 里**
- 用户自定义：`<dataDir>/extras/prompt-templates.json`（当前目录是**空的**）
- 暴露入口：`GET /templates`、`POST /templates/upsert`

### 一个真实问题：`tpl-h3-ref2va` 用的是**被否定的旧字段**

```js
// extras.js:30
{ id: 'tpl-h3-ref2va', name: 'H3 Ref2VA 提示词',
  content: '按六段式生成：CRITICAL STYLE RULE / CRITICAL REFERENCE RULE / '
         + 'subject_definitions / CHARACTER DEFINITION / summary / '
         + 'retention_analysis / SCENE LAYOUT / MOTION DESCRIPTION。' }
```

`CRITICAL STYLE RULE` / `CHARACTER DEFINITION` / `SCENE LAYOUT` /
`MOTION DESCRIPTION` 是**旧本地骨架**，`h3-prompt.js` 头注释里已明确否定
（"已被判定为非官方"）。真正的六段式是：

```
subject_definitions / summary / retention_analysis /
detailed_description / overall_soundscape / non_diegetic_music
```

**用户点这个模板会拿到错误的字段名。**

### 22 条里哪些还有价值

| 类别 | 条数 | 评价 |
|---|---|---|
| H3 专用 5 条 | `tpl-h3-ref2va`（错）/ `i2va` / `fl2va` / `style-en` / `audio` | 除 ref2va 外基本对 |
| 通用写作 | 电影感/分镜拆分/情绪曲线/台词润色/运镜… | ✅ 有价值 |
| 电商/影视/漫画 | 6 条 | ✅ 有价值 |
| 质检 | 3 条 | ✅ 有价值 |

---

## 六、群友 skill（2041 行）

**内容质量极高**，5 批结构：

| 批 | 主题 | 价值 |
|---|---|---|
| 1 | 潜空间续写机制 + 开关三组件 | ⭐⭐⭐ **已吸收进代码** |
| 2 | 六字段结构 + 绑定规范 | ⭐⭐⭐ 部分吸收 |
| 3 | 画风池 10 种 + 人物档案 + 场景锚点 | ⭐⭐⭐ 画风已吸收 2 种 |
| 4 | 光影五段式 + 四档光比 + 分镜/情绪写作法 | ⭐⭐⭐ 光比已吸收 6:1 |
| 5 | 完整模板 + 参数表 + 检查清单 + 问题速查 | ⭐⭐⭐ **未吸收** |

**当前状态**：只有部分被手工吸收进 `h3-prompt.js`，原文在 `群友/` 躺着。

---

## 七、五个真相源的问题

| # | 真相源 | 状态 |
|---|---|---|
| 1 | `h3-prompt.js`（代码） | ✅ 运行中，但没有对应的可读规范文档 |
| 2 | `vendor/*-skill/SKILL.md`（5 份） | ✅ 运行中，但组织混乱、3 份是死副本 |
| 3 | `skills/`（3 份） | ❌ **已删除** |
| 4 | `extras.js` 的 22 条模板 | ⚠️ 其中 1 条用错字段 |
| 5 | `群友/`（1 份 2041 行） | ❌ 未接入 |

**任何一条改了，另外几条不会跟着改。** 这就是"skill 这块需要整理"的根因。

---

## 八、建议方案

### 目标结构

```
dsh-jiuzhang-studio/
├─ skills/                          ← 唯一 skill 根目录（重建）
│  ├─ README.md                     ← skill 体系说明：谁加载哪个、什么阶段用
│  ├─ prompt/                       ← 提示词书写（给 LLM 看的规范）
│  │  ├─ h3-official/               ← 官方六段式（原 storyboard-skill + references）
│  │  │  ├─ SKILL.md
│  │  │  └─ references/base-en.txt, ref-en.txt
│  │  ├─ h3-hailuo/                 ← 海螺版（原 ns-storyboard-skill，26.7KB）
│  │  │  └─ SKILL.md
│  │  ├─ h3-continuation/           ← 一镜到底续写（原 oneshot-continuation-skill）
│  │  ├─ h3-continuation-cuts/      ← 可切镜续写（原 continuation-cuts-skill）
│  │  ├─ h3-nonfirst-i2v/           ← 非首帧 I2V（原 nonfirst-i2v-skill）
│  │  └─ group-master/              ← 群友总纲（2041 行，适配进体系）
│  │     └─ SKILL.md
│  ├─ usage/                        ← 操作手册（原 skills/jiuzhang-studio-usage）
│  ├─ setup/                        ← 部署手册（原 skills/jiuzhang-studio-setup）
│  └─ architecture/                 ← 插件整体结构 + API + 安装（新建）
│     ├─ SKILL.md
│     └─ references/api.md, install.md, architecture.md
├─ vendor/nanfeng/                  ← 只留 Python + VENDOR.md，**skill 全部移走**
│  ├─ *.py (10)
│  └─ VENDOR.md
└─ data/extras/prompt-templates.json ← 模板改为**数据文件**，不再内联
```

### 具体动作

| # | 动作 | 理由 |
|---|---|---|
| 1 | **删 4 个死副本**：`audio-drive-skill`（错拷）+ 3 个 `-ns-` 变体 | 逐字节相同，纯重复 |
| 2 | **vendor skill 迁到 `skills/prompt/`** | vendor 只该放 Python |
| 3 | **重建 `skills/usage` + `skills/setup`**（从 git 恢复） | 文档丢了 |
| 4 | **`skills/prompt/group-master/`** 放群友 skill（适配头部，正文保留） | 内容质量最高 |
| 5 | **`skills/architecture/`** 新建：整体结构 + API 表 + 安装流程 | 用户明确要求 |
| 6 | **修 `tpl-h3-ref2va`** 的字段名 | 现在给用户错误的字段 |
| 7 | **修 `skillId` 死参数** | NS 版永远不可达 |
| 8 | **`loadSkill()` 改指向 `skills/prompt/`** | 单一根目录 |
| 9 | **`package.json` files 加 `skills/**`**（已声明，但目录得有）| |

---

## 九、需要你拍板的三个决策

### 决策 1：vendor skill 是"移走"还是"保留 + 链接"

- **A. 全部移走**（推荐）：vendor 只剩 Python，skills/ 是唯一 skill 根目录。
  代价：要改 `storyboard.js` 的 `VENDOR_ROOT`。
- **B. 保留 + 复制一份到 skills/**：不改代码，但有两份会漂移。

### 决策 2：群友 skill 怎么"适配"

- **A. 整份放进去，只改头部 frontmatter**（推荐）：保住 2041 行完整内容，
  加上 `name/description/适用条件`，让它成为一个可加载的 skill。
- **B. 拆成 5 批分别放**：更细，但 5 批之间互相引用会断。

### 决策 3：22 条模板要不要搬出代码

- **A. 搬到 `skills/templates/templates.json`**（推荐）：模板是数据不是代码，
  用户可以编辑、可以加，不用改代码重新构建。
- **B. 保持内联**：简单，但用户改不了。

---

## 十、执行顺序（等你确认后）

```
1. 建 skills/ 骨架 + README（说明谁加载哪个）
2. 删 4 个死副本
3. vendor skill → skills/prompt/（含 references）
4. 从 git 恢复 usage / setup
5. 群友 skill → skills/prompt/group-master/（适配头部）
6. 新建 skills/architecture/（整体结构 + API + 安装）
7. 模板搬出为数据文件 + 修 tpl-h3-ref2va
8. 改 storyboard.js 的加载路径 + 修 skillId 死参数
9. 全量测试 + 构建
```