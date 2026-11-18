# Skill 体系说明

> 这是插件**唯一**的 skill 根目录。
> 以前 skill 散在 `vendor/nanfeng/*-skill/`、`skills/`、`extras.js` 三处，
> 现在全部收敛到这里。

---

## 一、目录结构

```
skills/
├─ README.md                      ← 本文（体系说明）
├─ prompt/                        ← 提示词规范（给 LLM 看，决定"怎么写提示词"）
│  ├─ h3-official/                H3 官方六段式（含 references 细则）
│  │  ├─ SKILL.md
│  │  └─ references/
│  │     ├─ base-en.txt           基础格式（T2VA/I2VA/FL2VA/L2VA）
│  │     └─ ref-en.txt            六段格式（Ref2VA）
│  ├─ h3-hailuo/                  海螺版（中文流程 + 本地 ComfyUI 结构，26.7KB）
│  ├─ h3-continuation/            一镜到底续写
│  ├─ h3-continuation-cuts/       可切镜续写
│  ├─ h3-nonfirst-i2v/            非首帧 I2V
│  ├─ group-master/               群友实战总纲 v2.0（2041 行 + 适配说明）
│  └─ jiuzhang-prompt-spec.md     本插件提示词编译器规范
├─ usage/                         操作手册（工具 / API / 页面怎么用）
├─ setup/                         部署手册（ComfyUI / 模型 / 依赖）
├─ architecture/                  整体结构 + API 全表 + 安装流程
└─ templates/
   └─ templates.json              20 条提示词模板（数据，可直接编辑）
```

> `prompt/` 是**两层嵌套**（`prompt/<name>/SKILL.md`），DSH 内置发现扫不到。
> 它们由插件自己的 `host/skills.js` 注册（见 §二·五）。

---

## 二、谁在加载什么

| Skill | 运行时加载？ | 加载者 | 用途 |
|---|---|---|---|
| `prompt/h3-official` | ✅ **是** | `nanfeng/storyboard.js` 的 `loadSkill()` | 智能分镜的 LLM system prompt（常规模式）|
| `prompt/h3-official/references/*` | ✅ 是（拼接进上者）| 同上 | 官方格式细则 |
| `prompt/h3-hailuo` | ✅ 是 | 同上（`skillId='ns_storyboard'`）| 智能分镜（海螺模式）|
| `prompt/h3-continuation` | ✅ 是 | 同上（`mode='oneshot_continuation'`）| 续写分镜 |
| `prompt/h3-continuation-cuts` | ✅ 是 | 同上（`mode='continuation_cuts'`）| 可切镜续写 |
| `prompt/h3-nonfirst-i2v` | ✅ 是 | 同上（`mode='reference_i2va'`）| 非首帧 I2V |
| `prompt/group-master` | ⚠️ 仅 DSH 技能目录 | `host/skills.js` provider | 写作时参考（含潜空间续写/光比/画风池）|
| `prompt/jiuzhang-prompt-spec.md` | ⚠️ 仅 DSH 技能目录 | 同上 | `h3-prompt.js` 编译器的权威规范 |
| `usage/` `setup/` `architecture/` | ⚠️ 仅 DSH 技能目录 | 同上 | 文档，供 AI/人阅读 |
| `templates/templates.json` | ✅ **是** | `services/extras.js` 的 `loadBuiltinTemplates()` | 20 条内置提示词模板 |

> ⚠️ **"仅 DSH 技能目录"的含义**：它们不会被 `storyboard.js` 拼进智能分镜的
> system prompt，但会出现在**模型的技能目录**里 —— 模型看到描述后可以主动
> `skill` 调用。这一条能成立的前提是 `host/skills.js` 的 provider 注册成功，
> 见下面第四节。

### 关键区分

**`prompt/` 下的 skill 是"喂给 LLM 的规范"**，它让模型知道怎么写分镜/提示词。
**`h3-prompt.js` 是"代码规则"**，它把输入编译成最终提示词。

两者是**不同阶段**：

```
用户说"我要一段夜景追逐戏"
  → prompt/h3-official/SKILL.md 让 LLM 输出分镜文本
      → h3-prompt.js 把分镜编译成六段式提示词
          → 南风节点出片
```

`h3-prompt.js` 里的规则是**人肉从 prompt/ 抄进代码的**（因为它要可执行），
所以改 prompt/ 的规范时，可能要同步看 `h3-prompt.js` 有没有对应实现。

---

## 二·五、为什么需要 `host/skills.js`（重要）

DSH 内置的 `dsh-skill-filesystem` 只扫描 skill 根目录的**一层**：

```
skills/some-skill/SKILL.md     ← 会被发现
skills/flat-skill.md           ← 会被发现
skills/prompt/h3-official/SKILL.md  ← 永远不会被发现（嵌套两层）
```

而本插件的提示词规范全部放在 `skills/prompt/<name>/` 下面。
**如果不额外注册 provider，这 6 个提示词 skill 对模型完全不可见** ——
用户在对话里说"用 H3 官方格式写"，模型根本不知道有这么个规范。

另外 `dsh-skill` 强制要求 `name` 是 **kebab-case**
（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`，见 `@deepseek-ai/dsh-skill` 的 `SKILL_NAME`）。
写成 `name: H3官方提示词` 的会被**静默丢弃**，只留一条 logger.warn。
本项目曾有 4 个 SKILL.md 因此全部失效。

所以 `host/skills.js` 做两件事：

1. 自己递归扫 `skills/`（最多 3 层），绕开单层限制；
2. 对 frontmatter 做与 `dsh-skill` 一致的校验，不合规就 `logger.warn` 跳过 ——
   绝不静默注册一个坏条目。

**验证方法**（改完 skill 后自查）：

```powershell
node -e "import('./host/skills.js').then(m=>{const l=m.discoverSkills(process.cwd(),console.warn);console.log(l.length,l.map(x=>x.name))})"
```

预期输出 `10 ['jiuzhang-studio-architecture', 'h3-group-master', ...]`。

### frontmatter 硬性要求

```yaml
---
name: kebab-case-唯一名     # ← 只能 a-z 0-9 和 -，中文/大写/空格都会被丢弃
description: 触发条件描述    # ← 必填，空字符串也会被丢弃
---
```

---

## 三、模板（templates.json）

可以直接编辑，**改完重启 DSH 生效**，无需改代码或重新构建。

```json
{
  "version": 2,
  "templates": [
    { "id": "tpl-xxx", "name": "显示名", "category": "分类", "content": "模板正文" }
  ]
}
```

- 保留 `_readme` / `_schema` 两个说明字段（不加载，纯注释）
- 内置的 20 条作为**默认值**
- 用户自己加的模板存在 `<dataDir>/extras/prompt-templates.json`，**覆盖同名 id**

---

## 四、历史变迁（为什么现在是这样）

| 阶段 | 状态 |
|---|---|
| 最初 | skill 散在 `vendor/nanfeng/*-skill/`（8 个目录，其中 3 对重复、1 个错拷）|
| 2026-11-17 早 | `skills/` 建了 3 份文档，但**没有任何代码加载**；后来被移出仓库 |
| 2026-11-17 夜 | 删除重复、迁到 `skills/prompt/`、恢复文档、新增 architecture |
| **2026-11-18** | **修好"看起来在、实际加载不到"**：4 个 SKILL.md 的 name 非 kebab-case（全被静默丢弃）；`prompt/` 两层嵌套 DSH 扫不到 → 新增 `host/skills.js` provider |

### 2026-11-18 修的两个加载缺陷

| # | 缺陷 | 后果 | 修法 |
|---|---|---|---|
| 1 | `name: H3官方提示词` / `name: H3一镜到底续写提示词` 含中文与大写 | `dsh-skill` 的 `SKILL_NAME` 正则不匹配 → **静默丢弃**，只留一条 logger.warn。4 个文件（h3-official / h3-nonfirst-i2v / h3-continuation / h3-continuation-cuts）全部失效 | 改成 `h3-official-prompt` / `h3-nonfirst-i2v` / `h3-continuation` / `h3-continuation-cuts` |
| 2 | `skills/prompt/<name>/SKILL.md` 是两层嵌套 | `dsh-skill-filesystem` 只扫一层 → **6 个提示词 skill 对模型不可见** | 新增 `host/skills.js`，递归扫描并注册自有 provider |

> 第 1 条的隐蔽性值得记一笔：文件、路径、内容全对，`discoverSkills` 之外
> 没有任何地方会报错。用户看到的是"skill 明明写了，模型却说不知道"。
> 第 2 条同理 —— 页面和工具一切正常，只有模型的知识面悄悄少了一大块。

### 本次删除的重复

| 删除项 | 原因 |
|---|---|
| `audio-drive-skill` | 与 `storyboard-skill` **SHA256 完全相同**，且无任何音频内容（错拷）|
| `oneshot-continuation-ns-skill` | 与 regular 版**逐字节相同** |
| `continuation-cuts-ns-skill` | 同上 |
| `nonfirst-i2v-ns-skill` | 同上 |

> 「NS 版」原本只是目录名不同，内容一模一样。现在续写类 skill 只有一份，
> 只有分镜（storyboard）保留 regular / 海螺两个真正的不同版本。

---

## 五、加新 skill 的方法

1. 在 `skills/prompt/` 下建目录，放 `SKILL.md`（带 frontmatter：`name` / `description`）
2. **name 必须是 kebab-case**（只允许 `a-z` `0-9` `-`），否则会被丢弃
3. 如果要在**智能分镜**里可选，改两处：
   - `host/services/nanfeng/storyboard.js` 的 `SKILLS` 或 `CONTINUATION_SKILL_DIRS`
   - `host/tools.js` 里 `studio_storyboard` 的 `skillId` enum
4. 如果只是**给模型/人阅读**，放进去即可，`host/skills.js` 会自动收录，不用改代码
5. 改完用 §二·五 的一行命令自查，确认出现在列表里

---

## 六、frontmatter 规范

```yaml
---
name: skill-kebab-case-name    # ← 只能 a-z 0-9 和 -，见 §二·五
description: 什么时候该用这个 skill（写给模型看的触发条件）
version: 1.0.0                 # 可选
disable-model-invocation: true # 可选：禁止模型主动调用，只能用户点名
user-invocable: false          # 可选：禁止用户点名调用
---
```

`description` 要写**触发条件**，不要写"这是什么"。
例如：`当需要写 H3 提示词、规划多段连续长视频时使用` ✅
不要写：`这是一个提示词 skill` ❌

> 另外：`modelInvocable` / `userInvocable` / `disableModelInvocation`
> 这几个**驼峰写法的旧字段会被直接拒绝**（`dsh-skill-filesystem` 的
> `rejectLegacyInvocationKey`）。只能用 kebab-case 的
> `disable-model-invocation` / `user-invocable`。