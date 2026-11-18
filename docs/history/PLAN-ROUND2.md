# 第二轮修复方案（2026-11-17 夜）

> 目标：把 DMAD 加速真正接线；回答群友提出的五个技术问题；
> 补齐 217 参数的「有用 / 该开没开 / 已废弃」判据；增加打光与画风通道。

---

## 0. 环境状态（已核实）

| 项 | 状态 |
|---|---|
| DSH | ✅ 已重启，`/nanfeng/schema` 返回 217 参数 + 85 无效 + 中文释义 |
| ComfyUI | ✅ 已重新拉起（0.45.0 / 8488 / 1428 节点 / 11GB 空闲） |
| 关键节点 | ✅ Motion Context 全套 / MiniMaxH3SigmaShift / ManualSigmas / SplitSigmas / SamplerER_SDE 均在 |
| 关键节点缺失 | ❌ H3SLAAttention / MiniMaxH3BlockCacheT8 / DLSS / TRT（与上一轮判定一致） |

---

## 1. 必须修：DMAD 加速完全没接线（P1，实为 P0 后果）

### 现状（已逐行核实）

- `accel-plan.js` 里 `dmad4/dmad8` 定义完整：`lora / sampler:lcm / scheduler:simple / steps:4|8 / shift 12:2`
- `runH3Local()`（旧路径）**完整接线**：`planForShot()` → `{{SAMPLER}}`/`{{LORA_NAME}}`/`{{SHIFT_VIDEO}}`…
- **`runH3Nanfeng()` 一行都没接**：既没有 `planForShot`，也没有把 LoRA 写进 217 参数快照

### 后果

预设全部是 `采样器: lcm` + `4-10 步`，但**不挂 DMAD LoRA** ——
用 LCM 采样器跑**未蒸馏的 50 步原模型**再硬压到 4 步。
这正是 `accel-plan.js` 注释里反复警告的「分布外」，也解释了为什么出片效果不好。

**实测佐证**：`_baseline-request.json` / `_final.json` / `_e2e-seg1.json` 三份历史请求
全部是 `启用LoRA=False, LoRA1=未选择, 采样器=lcm`。

### 修复方案

在 `runH3Nanfeng()` 里接 `planForShot(accelId)`，映射到南风参数：

| 方案字段 | 南风参数 | 说明 |
|---|---|---|
| `lora` | `LoRA1` + `LoRA1启用` + `LoRA1强度` | **必须设 `LoRA1启用=true`**（V15 走 `individual` 路径，`启用LoRA` 总开关**无效**） |
| `lora` 存在 | `启用LoRA` = true | 虽然 V15 不读它，但保持语义一致，便于排查 |
| `sampler` | `采样器` | `lcm` |
| `scheduler` | `调度器` | `simple` |
| `steps` | `采样步数` | 4 或 8 |
| `shiftVideo/shiftAudio` | **无对应参数** | 见下方「Sigma shift 无法接入」 |

### ⚠️ 发现：南风 V15 上 **shift 根本设不了**

逐行读过 `h3_generator.py`：

```
1687: sigma_requested = False          ← 硬编码
1702: sigma_enabled = (sigma_requested and sigma_strategy != "原生轨迹") if is_v7 else ...
1706: if sigma_enabled:               ← 恒假
1710:     sampling_model = MiniMaxH3SigmaShift(shift_video=..., shift_audio=...)
```

**三个 SigmaShift 调用点全部在 `sigma_enabled` 分支下，而 `sigma_requested` 恒 False。**

所以：
- `视频西格玛偏移` / `音频西格玛偏移` / `西格玛模式` / `低西格玛*` / `手动西格玛` —— **全是死参数**（上一轮已标 dead，正确）
- V15 永远用模型自带的 `shift=12 / audio_shift=3`
- 而 DMAD 要求 `12/2`（**音频 shift 必须是 2 不是 3**）

**结论**：`Sigma策略` 虽被读取（`:1701`），但 `sigma_enabled` 仍为 False，
所以切到「面板Sigma轨迹」也没用。

**能做的**：
1. 把 DMAD LoRA 接上（这是主要收益）
2. `音频西格玛偏移` 死参数的问题**无法在本节点解决** —— 需要上游修复。
   在文档与 UI 里明确告知，并记录为「已知限制」。
3. 若将来上游修复，`Sigma策略` 切到「面板Sigma轨迹」即可生效。

---

## 2. 217 参数的三分类审计（群友要的「哪些有用」）

重做一次更精细的分类，输出到 `docs/PARAM-AUDIT.md`：

| 分类 | 含义 | 数量（预估） |
|---|---|---|
| **A. 有效且默认正确** | 能改、默认值也合理 | ~120 |
| **B. 有效但默认没开（要点一下）** | 功能实现了但默认 false，需要手动开才有收益 | ~15 |
| **C. 死参数（上游硬编码）** | 改了完全没反应 | 37 |
| **D. 缺依赖（开了报错）** | 本机没装对应节点 | 48 |

**B 类是重点 —— 这是「买回来没用上的功能」**。目前已识别：

| 参数 | 为什么该开 | 怎么开 |
|---|---|---|
| `LoRA1启用` + `LoRA1` | DMAD 加速的本体 | 本轮接线后自动开 |
| `启用H3潜空间放大二采` | 唯一真正有效的画质提升 | 预设 standard/quality 已开 |
| `启用运行时预留显存` | 12GB 卡唯一有效的省显存手段 | low-vram 预设已开 |
| `启用TAEH3彩色预览` | 快速彩色预览，省 VAE 解码时间 | 调试时开 |
| `启用实时预览` | 采样中间帧预览 | 默认 true，但预设全关了 |
| `启用UniBlockSwap` | 真能省显存（已核实有效） | 显存紧张时开 |
| `启用续写音频精修` | 消除续写接缝爆音 | 续写时建议开 |

---

## 3. 群友五个问题的技术回答（写进 docs 与 UI）

### 3.1 「画风通道是哪个」→ `STYLE_PRESETS`（9 种）

位置：`host/services/h3-prompt.js:130-212`，运行时通过 `GET /prompt/meta` 下发。

9 种：`helltaker-look` / `helltaker-style` / `ova90s` / `shinkai` / `ghibli` /
`american-toon` / `ufotable` / `toon3d-pbr` / `gohands`

**关键机制**：画风是**纯文本通道**（不是 LoRA、不是模型 patch）。
`style.en` 会被 `styleBlock()` 拼进 `detailed_description` 开头；
Ref2VA 下只取前 **180 字符**（`SHORT_STYLE_CHARS`），避免与参考素材抢权重。

**注意**：`changesAppearance: true` 的两个（`helltaker-look` / `american-toon`）
会改角色比例，与角色卡一致性冲突；`changesAppearance: false` 的只改渲染质感。

### 3.2 「45s 一口气可连续视频」→ **部分成立，但有硬限制**

**核实结果**：

- 原生节点 `length` 上限 **3600 帧 = 150 秒**，但 tooltip 明写
  「trained range is ~124-362, **longer is untested**」
- 南风 V15 封装节点 `时长秒` 上限 **15 秒**（`min:1, max:15, step:1`）
- 显存随**时长平方**增长（官方：「每 +5s 翻倍」）

所以「45s 一口气」：
- ✅ **技术上节点允许**（150s 上限）
- ⚠️ **但超出训练分布**（124-362 帧 = 5-15s），质量无保证
- ❌ **12GB 显存绝无可能**（15s 1080p bf16 在 32GB 上都会溢出）

**正确做法（也是群友说的「潜空间生成」）**：走 **潜空间续写**（Motion Context），
分段生成 + latent 传递，每段在训练分布内，拼起来是连续长视频。

45s 怎么来：**3 段 × 15s**，或 **5 段 × 9s**。
本插件已实现（`continuation.js`），但**服务端没有编排循环**（上一轮 P2-12），
实际需要前端/Agent 逐段驱动。本轮补上编排。

### 3.3 「潜空间语法 the actual carried latent motion governs the current action」

**这是南风续写 skill 里的一条规则**，原文（`vendor/nanfeng/oneshot-continuation-skill/SKILL.md:14`）：

> User intent specifies the desired action trajectory. Write later openings as
> continuation from **the actual carried motion**, not a guessed exact endpoint.

**意思**：从第 2 段开始，**上一段真实生成的 latent 运动状态才是事实**，
你写的提示词只是"意图"。所以：

- ❌ 不要写「第 2 段开头是角色举起左手到肩膀高度」——你根本不知道第 1 段结束时手在哪
- ✅ 要写「承接上段动作继续，向前推进到下一个节拍」——从**实际承接的运动**出发

配套规则（同文件）：
- 分段 2+ **不得重新定义**手位、视线、接触、道具状态、构图、动作相位（那是图片的权威，不是 latent 的）
- 图片只保留**身份、脸、发型、服装、外观、场景身份**
- 禁止：切、反打、瞬移构图、擦除、淡入淡出、新 take、姿势重置

**一句话**：潜空间续写时，"怎么开始"由 latent 决定，"往哪去"由你的提示词决定。

### 3.4 「采样器 lcm + simple + CFG 1.0 + LoRA strength 1.0」→ 就是 DMAD

**逐项对应到代码**：

| 群友说法 | 南风参数名（217 里） | 位置 | 说明 |
|---|---|---|---|
| 采样器 `lcm` | **`采样器`** → 选 `lcm` | `schema.js:257`（L 组） | ✅ 有效 |
| 调度 `simple` | **`调度器`** → `simple` | `schema.js:60`（A 组） | ✅ 有效 |
| **CFG = 1.0** | **没有这个参数** | — | 见下 |
| LoRA strength `1.0` | **`LoRA1强度`** = 1.0 | `schema.js:159`（G 组） | ✅ 有效 |
| （隐含）步数 | **`采样步数`** = 4 或 8 | `schema.js:61` | ✅ 有效 |
| （隐含）LoRA 文件 | **`LoRA1`** + **`LoRA1启用`** | `schema.js:158,164` | ✅ 有效 |

**关于 CFG = 1.0**：**南风节点根本没有 CFG 参数**。它用 `BasicGuider`
（`:1726`），即 **guidance-distilled、单条件、无 CFG**。CFG=1.0 正是
「等效于不做 CFG」——所以群友说的 `CFG=1.0` 是对「这个模型没有 CFG」的口语化表达，
**不需要也不能设**。

`accel-plan.js:26` 的注释也明写：「H3 原模型是 50 步、**无 CFG** 的 guidance-distilled 模型」。

**但 `_baseline-request.json` 里出现过 `cfg` 字段** —— 那是旧 `h3-local` 模板路径的
遗留，南风路径不读它。

### 3.5 「8:1 打光 / 4:1 打光」→ 光比（lighting ratio），不是参数

**这是我的插件当前完全没有的能力** —— 没有任何参数控制打光，只有提示词。

**定义**（[维基](https://en.wikipedia.org/wiki/Lighting_ratio)、[影视灯光教程](https://cloud.wikis.utexas.edu/wiki/spaces/rtf318/pages/80022816/Lighting+ratios)）：

```
光比 = (主光 + 补光) : 补光
     = 亮面照度 : 暗面照度
```

| 光比 | 差几档 | 效果 |
|---|---|---|
| **2:1** | 1 档 | 高调、柔和、日韩写真 |
| **3:1** | 1.7 档 | 经典人像 |
| **4:1** | 2 档 | 低调、戏剧化、有明暗对比 |
| **8:1** | 3 档 | 极低调、黑色电影、强戏剧性（明暗差 8 倍） |

**母鸡卡（MyGO/Ave Mujica）剧场版那种效果**：高对比、硬边阴影、亮部很亮暗部很深 ——
对应 **4:1 ~ 8:1**，再叠加硬光 + 冷调 + 强边缘光。

**好消息**：这**可以纯用提示词做**，不需要模型支持。本轮把它做成
**打光预设（Lighting Preset）通道**，与画风通道并列。

---

## 4. 「8.1 完整 Sigma」序列是什么

群友给的：`1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579, 0.42, 0.18, 0`

**我算过了**（复刻 ComfyUI `simple` scheduler + `shift=12`）：

```
simple/shift12  8步: 1.000000, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.800000, 0.631579, 0
```

**前 8 个值与用户的序列 8/8 精确吻合**（误差 < 1e-5）。

所以这个序列的结构是：

```
[1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579]  ← simple/shift12 的 8 步标准网格
[0.42, 0.18]                                                          ← 尾部手工加密
[0]                                                                   ← 必须收尾于 0
```

**它是什么**：`H3完整Sigma序列`（D 组），用于 **V8.1 潜空间放大二采** 时
**手动指定整条 10 步轨迹**（6 步一采 + 4 步二采）。

**校验规则**（`h3_generator.py:1744-1751`）：
- 开二采时，值的个数必须 **= 一采步数 + 二采步数 + 1**
- 默认 `6+4+1 = 11` 个值 ← **正好是用户这 11 个**
- 必须**严格递减**，且**最后一个必须是 0**（`:209-212`）

**为什么要加密尾部**：低 sigma 阶段决定细节与噪点纹理。
在 0.63→0.42→0.18 之间加密，等于在"最后几笔"多给模型几次精修机会，
典型效果是**细节更实、暗部噪点更干净**。

**怎么用**：
1. 开 `启用H3潜空间放大二采`
2. `H3一采步数` = 6、`H3二采步数` = 4（合计 10 → 需要 11 个值）
3. `H3完整Sigma序列` 填这串
4. 留空则自动用 `simple/shift12` 的自动轨迹

**注意**：这与 `手动西格玛`（F 组）**不是同一个参数**！
- `H3完整Sigma序列` → **V8.1 二采专用，有效**
- `手动西格玛` → 旧 V4 Sigma 面板，`sigma_requested=False` → **死参数**

---

## 5. 本轮执行清单

| # | 任务 | 文件 | 状态 |
|---|---|---|---|
| 1 | DMAD 接线到 `runH3Nanfeng` | `generator.js` | ⬜ |
| 2 | 打光通道（4:1 / 8:1 等预设） | `h3-prompt.js` + 前端 | ⬜ |
| 3 | 参数审计文档 `PARAM-AUDIT.md` | `docs/` | ⬜ |
| 4 | 续写批次服务端编排 | `continuation.js` + `api` | ⬜ |
| 5 | Sigma 序列校验与预设 | `presets.js` + `schema` | ⬜ |
| 6 | 文档：群友五问 | `docs/H3-技术问答.md` | ⬜ |
| 7 | 前端：加速方案选择器 | `RenderPage.tsx` | ⬜ |
| 8 | 回归测试 | `smoke-api.mjs` | ⬜ |