# Skill 体系说明

> 这是插件**唯一**的 skill 根目录。共 **11 个** skill。
> 提示词规范放在两层嵌套目录里，**必须**由 `host/skills.js` 注册，否则模型看不见（见 §三）。

---

## 一、目录结构

```
skills/
├─ README.md                      ← 本文（体系说明）
├─ prompt/                        ← 提示词规范（决定"怎么写提示词"）
│  ├─ h3-official/                H3 官方六段式
│  │  ├─ SKILL.md
│  │  └─ references/
│  │     ├─ base-en.txt           基础格式（T2VA/I2VA/FL2VA/L2VA）
│  │     ├─ ref-en.txt            六段格式（Ref2VA）
│  │     ├─ 修改分镜.txt           分镜改写要点
│  │     └─ Blender预演交付清单.md  预演产物交付规范
│  ├─ h3-hailuo/                  海螺版（中文流程 + 本地 ComfyUI 结构）
│  ├─ h3-continuation/            一镜到底续写
│  ├─ h3-continuation-cuts/       可切镜续写
│  ├─ h3-character-replace/       人物替换（与六段式规范互斥）
│  ├─ h3-nonfirst-i2v/            非首帧 I2V
│  ├─ group-master/               社区实战总纲
│  └─ jiuzhang-prompt-spec.md     本插件编译器规范（单文件，非目录）
├─ usage/                         操作手册（14 工具 / REST / 页面）
├─ setup/                         部署手册（ComfyUI / 模型 / 依赖）
├─ architecture/                  架构与代码地图
└─ templates/
   └─ templates.json              内置提示词模板（数据，可直接编辑）
```

---

## 二、11 个 skill 一览

| name | 路径 | 谁加载 | 用途 |
|---|---|---|---|
| `jiuzhang-studio-architecture` | `architecture/` | 仅 DSH 技能目录 | 架构与"改哪里改什么" |
| `jiuzhang-studio-usage` | `usage/` | 仅 DSH 技能目录 | 操作手册 |
| `jiuzhang-studio-setup` | `setup/` | 仅 DSH 技能目录 | 部署 |
| `jiuzhang-studio-prompt` | `prompt/jiuzhang-prompt-spec.md` | 仅 DSH 技能目录 | 编译器权威规范 |
| `h3-official-prompt` | `prompt/h3-official/` | **智能分镜** + DSH 目录 | 常规模式 system prompt |
| `hailuo-prompt` | `prompt/h3-hailuo/` | **智能分镜**（`skillId='ns_storyboard'`） | 海螺模式 |
| `h3-continuation` | `prompt/h3-continuation/` | **智能分镜**（`oneshot_continuation`） | 续写分镜 |
| `h3-continuation-cuts` | `prompt/h3-continuation-cuts/` | **智能分镜**（`continuation_cuts`） | 可切镜续写 |
| `h3-nonfirst-i2v` | `prompt/h3-nonfirst-i2v/` | **智能分镜**（`reference_i2va`） | 非首帧 I2V |
| `h3-character-replace` | `prompt/h3-character-replace/` | 仅 DSH 技能目录 | 视频换人 / 角色替换 |
| `h3-group-master` | `prompt/group-master/` | 仅 DSH 技能目录 | 写作时参考的实战总纲 |

**"仅 DSH 技能目录"的含义**：不会被 `storyboard.js` 拼进智能分镜的 system prompt，
但会出现在**模型的技能目录**里 —— 模型看到 description 后可主动调用。

**关键区分**：

- `prompt/` 下的 skill 是「喂给 LLM 的规范」，让模型知道**怎么写**分镜/提示词；
- `host/bridge/prompt/` 是「代码规则」，把输入**编译成**最终提示词。

```
用户说"我要一段夜景追逐戏"
  → prompt/h3-official/SKILL.md 让 LLM 输出分镜文本
      → bridge/prompt/* 把分镜编译成六段式提示词
          → 南风节点出片
```

`bridge/prompt/` 里的规则是**人肉从 skill 抄进代码的**（因为要可执行）。
改 `prompt/` 的规范时，要同步检查 `bridge/prompt/spec.js` / `styles.js` / `lint.js`
有没有对应实现。

---

## 三、为什么需要 `host/skills.js`

DSH 内置的 `dsh-skill-filesystem` 只扫 skill 根目录的**一层**：

```
skills/some-skill/SKILL.md          ← 会被发现
skills/flat-skill.md                ← 会被发现
skills/prompt/h3-official/SKILL.md  ← 永远不会被发现（两层嵌套）
```

而本插件 7 个提示词 skill 全在 `skills/prompt/<name>/` 下。**不注册自有 provider
的话它们对模型完全不可见** —— 用户说"用 H3 官方格式写"，模型根本不知道有这个规范。

另外 `dsh-skill` 强制 `name` 是 **kebab-case**（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`）。
写成 `name: H3官方提示词` 会被**静默丢弃**，只留一条 `logger.warn`。

所以 `host/skills.js` 做两件事：

1. 递归扫 `skills/`（最多 3 层），绕开单层限制；
2. 对 frontmatter 做与 `dsh-skill` 一致的校验，不合规就 `logger.warn` 跳过 ——
   绝不静默注册一个坏条目。

**自查命令**（改完 skill 必跑）：

```powershell
node -e "import('./host/skills.js').then(m=>{const l=m.discoverSkills(process.cwd(),console.warn);console.log(l.length,l.map(x=>x.name))})"
```

预期 `11 ['jiuzhang-studio-architecture', 'h3-group-master', ...]`。

### frontmatter 硬性要求

```yaml
---
name: kebab-case-唯一名     # 只能 a-z 0-9 和 -；中文/大写/空格都会被丢弃
description: 触发条件描述    # 必填；空字符串也会被丢弃
---
```

---

## 四、模板（templates.json）

可直接编辑，**改完重启 DSH 生效**，无需改代码或重新构建。

```json
{
  "version": 2,
  "templates": [
    { "id": "tpl-xxx", "name": "显示名", "category": "分类", "content": "模板正文" }
  ]
}
```

- 保留 `_readme` / `_schema` 两个说明字段（不加载，纯注释）
- 内置条目作为**默认值**
- 用户自建的模板存在 `<dataDir>/extras/prompt-templates.json`，**覆盖同名 id**

---

## 五、加新 skill 的方法

1. 在 `skills/prompt/` 下建目录，放 `SKILL.md`（带 frontmatter `name` / `description`）
2. **name 必须 kebab-case**（只允许 `a-z` `0-9` `-`），否则被丢弃
3. 如果要在**智能分镜**里可选，改两处：
   - `host/bridge/llm/storyboard.js` 的 `SKILLS` 或 `CONTINUATION_SKILL_DIRS`
   - `host/tools.js` 里 `studio_storyboard` 的 `skillId` enum
4. 如果只是**给模型/人阅读**，放进去即可，`host/skills.js` 自动收录，无需改代码
5. 改完用 §三 的一行命令自查

---

## 六、frontmatter 可选字段

```yaml
---
name: skill-kebab-case-name
description: 什么时候该用这个 skill（写给模型看的触发条件）
version: 1.0.0                  # 可选
disable-model-invocation: true  # 可选：禁止模型主动调用，只能用户点名
user-invocable: false           # 可选：禁止用户点名调用
---
```

`description` 要写**触发条件**，不要写"这是什么"。

- ✅ `当需要写 H3 提示词、规划多段连续长视频时使用`
- ❌ `这是一个提示词 skill`

> ⚠️ 驼峰写法的 `modelInvocable` / `userInvocable` / `disableModelInvocation`
> **会被直接拒绝**（`dsh-skill-filesystem` 的 `rejectLegacyInvocationKey`）。
> 只能用 kebab-case 的 `disable-model-invocation` / `user-invocable`。

---

## 七、维护纪律

| 做 | 不做 |
|---|---|
| 以**代码为唯一真源**写文档，改代码后同步改 skill | 凭记忆或上一版文档描述行为 |
| 改完跑 §三 的自查命令 | 假定"文件写好就等于加载到" |
| 画风/打光/参数等**数量**用代码 import 数一遍 | 把旧文档的"11 种"直接抄下来 |
| 新 skill 的 name 用 kebab-case | 用中文或大写（静默失效） |

已知教训：曾有 4 个 SKILL.md 因 name 含中文被静默丢弃，6 个因两层嵌套从未被加载 ——
两类故障的共同点是**没有任何报错**，只有"模型不知道"。所以自查命令是硬性要求。