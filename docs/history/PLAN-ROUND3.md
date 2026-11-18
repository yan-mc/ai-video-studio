# 第三轮方案（2026-11-17 晚）

四个问题的调查结论与执行计划。

---

## 问题 1：`h3_generator.py:1687` 那些能改吗？

### 结论：**不能改，也不该改 —— 但原因和你猜的不一样**

#### ① 这些文件是什么形态

| 位置 | 形态 | 说明 |
|---|---|---|
| `+ 南风H3\南风V15\` | 南风发布的**干净迁移包**（zip） | 不是 ComfyUI 完整环境，只是 custom_nodes 主体 |
| `vendor/nanfeng/` (插件内) | 从迁移包**改造**来的副本 | 删了 7026 行（HTTP API 层 + 前端） |
| `ai-runtime/ComfyUI/custom_nodes/nanfeng_prompt_nodes_v15_modified/` | **实体目录**（不是软链），内容 = vendor | 部署时复制进去的 |

**不是"外挂包"，是 vendor 进插件再复制进 ComfyUI**。所以它是可改的。

#### ② 那 `sigma_requested = False` 到底怎么回事

我做了逐行 diff。**原包第 1686 行是这样的**：

```python
sigma_requested = (
    isinstance(self, NanFengH3MultiReferenceGeneratorV4)
    and not isinstance(self, NanFengH3MultiReferenceGeneratorV81)
    and bool(kwargs.get("启用西格玛调节", False))
)
```

V15 继承链是 `V1→V2→…→V81→V9→V15`，所以对 V15：
- `isinstance(self, V4)` → **True**
- `not isinstance(self, V81)` → **False**
- 整个表达式 → **False**

**vendor 改造时把它化简成了常量 `False`，语义完全等价。** 这不是 bug，是"删掉恒假分支"的产物。

#### ③ 所以 SigmaShift 为什么插不上

原包和改造版都是同一个结论：**V15 在设计上就不走 V4 的 Sigma 面板**。

- V4 的 Sigma 调节是**早期实现**，V8.1 起改由 `H3完整Sigma序列` 独立控制
- V7 起 `Sigma策略` 接管，但 `sigma_enabled = sigma_requested and ...` 仍然恒假
- **三个 `MiniMaxH3SigmaShift` 调用点全在 `sigma_enabled` 分支下**

**能不能强行打开？** 技术上可以 —— 把 `sigma_requested` 改成读一个参数。但这是**修改上游语义**，风险：
- 上游明确写了"V8.1的完整轨迹只由H3完整Sigma序列或自动完整轨迹决定；旧V4/V7 Sigma字段即使存在于旧工作流也不得介入"
- 强行插 SigmaShift 会与 V8.1 的 `SplitSigmas` 二采路径冲突（两条 sigma 来源）

**我的判断：不做。** DMAD 的 audio_shift=2 差异收益远小于破坏 V8.1 二采的风险。

**但可以做一件安全的事**：给 `H3完整Sigma序列` 增加一个**音频路径说明**，
让用户知道视频 sigma 已经能精确控制（走完整序列），只有 audio_scale 那个标量控制不了。

#### ④ 「从 GitHub 完整拉取」这条路可行吗

**不可行**，原因：

1. **南风是闭源分发**（干净迁移包，不是 GitHub 仓库）。没有公开 repo 可拉。
2. **改造是必须的**：原包带 5 个 HTTP API 模块（`storyboard_api.py` 764 行、
   `audio_drive_api.py` 414 行等），它们要读 `.env` 里的外部 LLM 凭据。
   不删掉就与 DSH 自己的 LLM 桥接打架，而且要求用户填 API key。
3. **版本锁定**：南风的 GraphBuilder 依赖 ComfyUI 0.45.0 的内部结构，
   上游升级会静默破坏。

**结论**：vendor + 部署脚本是**正确的架构**，不该改成"在线拉取"。
但可以改进**部署体验**（见执行项）。

---

## 问题 2：续写批次的服务端编排循环

### 现状

`continuation.js` 有 `createBatch` / `taskFor` / `nextPendingIndex` / `advanceStatus`，
API 有 `POST /batches` / `GET /batches/:id/next` / `POST /segment`。

**但没有服务端循环** —— 三个原语要靠前端或 Agent 手动驱动。
实际表现：用户建了批次，得自己一段一段点，或者写脚本。

### 群友 skill 提供的实测依据

| 项 | 数值 | 本地差异 |
|---|---|---|
| 裁切量 | **固定 0.92s**（22 帧） | ✅ 一致（`context_length=22`） |
| 段 1 | 不裁 | ✅ 一致 |
| 段 2–9 | 请求 6s → 交付 5.08s | ⚠️ **本地网格吸附会变成 141 帧 = 5.875s** |
| 九段总交付 | ≈45.6s | ⚠️ **本地照搬 6s 会变 51.9s** |

**根因**：群友平台采样 144 帧（6.0s 整），**不做 17k+5 吸附**；
本地 `duration_to_frames()` 会吸附到 158 帧（6.58s），裁 22 帧后交付 5.67s。

**本地的 45s 正确配方**：
```
段 1:     请求 5.000s → 124 帧 → 交付 124 帧 = 5.167s
段 2–9:   请求 5.875s → 141 帧 → 裁 22 → 交付 119 帧 = 4.958s
合计 = 5.167 + 8 × 4.958 = 44.83s ≈ 45s ✅
```

### 执行计划

1. `continuation.js` 增加 **`planSegments()`**：给定目标总时长 + 段数，
   自动算出每段的请求时长（保证落网格且裁切后总长最接近目标）
2. 增加 **`runBatch()`** 服务端编排：串行跑完所有段，每段带 `continuationTask`，
   失败可断点续跑
3. 新增 `POST /nanfeng/continuation/batches/:id/run` 触发编排
4. `GET /batches/:id` 返回实时进度
5. 前端 `ContinuationPanel` 接上「一键跑完整组」

---

## 问题 3：角色卡在新提示词方案下还能进提示词吗

### 实测结论：**能，而且链路是通的，但有一个真实断点**

我上一轮已经用 fixture 验证过编号链路（`<Picture N>` 与 `图片N` 同源一致）。
现在要看的是**文字设定**有没有真的进提示词。

### 链路

```
角色卡 (name/description/traits/personality)
  → withVaultCards() 解析成 shot.characterCards
    → compilePrompt() 用 resolvePictureIndices() 算出每张卡的 <Picture N>
      → injectCardDefinitions() 写进 subject_definitions
```

`injectCardDefinitions`（`generator.js:250`）产出的格式：

```
subject_definitions:
爱丽丝：外观以 <Picture 1> 为准。白发少女；双马尾；性格：冷淡
```

### 与群友 skill 的差距

群友 skill 的 `subject_definitions` 标准句式（第 349-405 行）要求：

| 字段 | 群友要求 | 本插件现状 |
|---|---|---|
| 人物 | `<Subject N> is the <description> shown in <Picture M>.` + 外观细节 + **绑定只做一次** | ✅ 有，但格式不同（中文冒号式） |
| 场景 | `<Subject N> is the [scene], fully described in text…` + 排他声明 | ❌ **缺** |
| 音频 | `<Audio N> is the voice-timbre reference for <Subject M> (Sx).` | ⚠️ 有但拿不到 audioIndex |

**关键问题**：`injectCardDefinitions` 是**追加/替换**式的，
而 `h3-prompt.js` 的 `compileRef2VA` 也会自己生成 `subject_definitions`。
两者可能**同时存在** → 两套 Subject 定义打架。

### 执行计划

1. **统一入口**：让角色卡的描述走 `h3-prompt.js` 的 `subjects[]`，
   而不是在 generator 里事后注入字符串
2. **对齐群友 skill 的句式**：`<Subject N> is the … shown in <Picture M>.`
3. **补场景定义**：角色卡如果有 scene 关联，生成场景 Subject
4. **绑定只做一次**：避免同一张卡在多处重复声明

---

## 问题 4：提示词 skill 现状盘点

### 群友 skill（`群友/# H3 Skill 总纲 v2.0.txt`，2041 行）

**结构**：5 批 + 总检查清单 + 问题速查 + 调试协议 + 核心信条

| 批 | 主题 | 行数 |
|---|---|---|
| 第一批 | 潜空间续写（核心机制）、续写开关、承接/重述、时序、切点运镜、免责句 | 1-315 |
| 第二批 | 六字段结构、subject/summary/retention/detailed/soundscape/music、说话人 | 316-767 |
| 第三批 | **画风池（10 种）**、人物档案、同框防混淆、场景锚点 | 768-1180 |
| 第四批 | **光影系统（五段式 + 四档光比）**、分镜写作法、情绪写作法 | 1181-1680 |
| 第五批 | 完整模板、参数表、总检查清单、问题速查、调试协议 | 1681-2041 |

**与本地实现的重合度**：

| 群友 skill 内容 | 本地是否有 | 差异 |
|---|---|---|
| 六字段结构 | ✅ `h3-prompt.js` | 字段名一致 |
| 画风池 10 种 | ⚠️ 只有 9 种 | 本地缺 **Ligne Claire（欧洲漫画）** 和 **Vivziepop（地狱客栈）** |
| 续写开关（顶部三组件） | ❌ **完全没有** | 见下 |
| 光影五段式 | ❌ 只有我上一轮加的光比 | 缺方位/高度/入射角/材质响应/高光纪律/天空锁 |
| 四档光比模板 | ⚠️ 只有 2:1/3:1/4:1/8:1 简版 | 缺 6:1 |
| 承接/重述四类 | ❌ 没有 | |
| 时序规则（裁切区） | ❌ 没有 | |
| 段尾免责句 | ❌ 没有 | |
| 参数表（640p/608p、14/16 步） | ⚠️ 预设不同 | 本地是 0.4MP/4-10 步 + DMAD |

### 插件当前所有 skill 盘点

| skill | 位置 | 运行时是否加载 | 作用 |
|---|---|---|---|
| `jiuzhang-studio-prompt` | `skills/` | ❌ **不被任何代码加载** | 人/AI 阅读用 |
| `jiuzhang-studio-usage` | `skills/` | ❌ 同上 | 操作手册 |
| `jiuzhang-studio-setup` | `skills/` | ❌ 同上 | 部署手册 |
| `vendor/nanfeng/storyboard-skill` | `vendor/` | ✅ **智能分镜真正在用** | 分镜 LLM system prompt |
| `vendor/nanfeng/*-continuation-skill` | `vendor/` | ⚠️ 部分（按模式加载） | 续写提示词规范 |
| `promptTemplates`（数据库） | `data/extras` | ✅ 工具箱在用 | 提示词模板 |
| 群友 skill | `群友/` | ❌ **完全未接入** | — |

**真正的真相源只有两个**：
- **`h3-prompt.js`（内联）** → 编译链路
- **`vendor/nanfeng/storyboard-skill`** → 分镜链路

### 执行计划

1. **把群友 skill 的独有内容吸收进来**：
   - 续写开关三组件（顶部固定句）← 这是**最高价值**
   - 承接/重述四类判断表
   - 时序规则（裁切区）
   - 光影五段式（补齐方位/高度/材质/高光纪律/天空锁）
   - 6:1 光比
   - 画风补到 10 种（Ligne Claire + Vivziepop）
2. **落成代码**，而不是再写一份文档（避免第 5 个真相源）
3. 保留 vendored 的 skill 不动（分镜链路依赖它）

---

## 执行清单

| # | 任务 | 优先级 |
|---|---|---|
| 1 | 续写批次服务端编排（`planSegments` + `runBatch`） | P0 |
| 2 | 续写开关三组件进提示词编译器 | P0 |
| 3 | 承接/重述四类 + 时序规则进编译器 | P0 |
| 4 | 画风补到 10 种 | P1 |
| 5 | 光影五段式 + 6:1 光比 | P1 |
| 6 | 角色卡描述统一走 `subjects[]` | P1 |
| 7 | 部署体验改进（无需手工复制） | P2 |
| 8 | 回归测试 | P0 |