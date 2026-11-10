# CBM（概念瓶颈模型）调研报告 —— 与本项目的关系

> 2026-11-11 · 仅调研汇报，不含实现
> 结论先行：**CBM 本身不直接适用于你的项目，但它的思想已经被你项目里的「3D 预演」和「角色卡」实现了，只是没用这个名字。**

---

## 一、CBM 是什么

### 1.1 定义

**Concept Bottleneck Model**：在模型输入和输出之间插入一层「人类可理解的概念」，让模型先预测概念、再基于概念做决策。

```
传统模型：  输入 x ──[黑盒]──> 输出 y
CBM：      输入 x ──[f]──> 概念 c ──[g]──> 输出 y
                            ↑
                    「有翅膀、有喙、红色」这类人类词汇
```

原始论文：Koh et al. 2020, *Concept Bottleneck Models*。

### 1.2 两个核心价值

| 价值 | 说明 |
|---|---|
| **可解释** | 你能看到模型判为麻雀是因为「翅膀=0.9、喙=0.8、红色=0.1」 |
| **可干预** | 发现某概念错了，**直接改那个值**，输出随之改变，**不用重训** |

### 1.3 代价

- 需要概念标注数据（贵）
- 概念维度有限 → 信息损失 → 生成质量下降

---

## 二、CBM 在生成模型上的进展（关键）

CBM 原本是**判别模型**（分类）的方法。近两年才扩展到**生成模型**：

| 工作 | 年份 | 做法 | 局限 |
|---|---|---|---|
| **CBGM**（Concept Bottleneck Generative Models） | 2023 | 在 GAN/VAE/扩散模型里插入 CB 层，可 steering | **必须从头训练**（DDPM-256 需 240 V100-hours）；需真实图像概念标注 |
| **CB-AE / CC**（Post-hoc CBM，CVPR 2025） | 2025 | 后置方法：概念瓶颈自编码器 + 概念控制器，**不用重训** | 仍靠 vision cue 等非显式表示，透明性打折 |
| **CoBELa**（ICCV 2025 Workshop） | 2025 | 用**能量函数**做概念瓶颈，decoder-free，对冻结生成器做后置干预；概念能量可**加性组合**（与/非） | 仍需每概念训练一个能量函数 |

参考：
- [CoBELa: Steering Transparent Generation via Concept Bottlenecks on Energy Landscapes](https://arxiv.org/abs/2507.08334)
- [Interpretable Generative Models through Post-hoc Concept Bottlenecks (CVPR 2025)](https://arxiv.org/abs/2503.19377)
- [Concept Bottleneck Generative Models (OpenReview)](https://openreview.net/pdf?id=zFOdOChRPR)

### 2.1 视频生成领域的情况

**目前没有成熟的「CBM for video」方案。** 检索结果里与视频相关的只有：

- **CleanVideo**（2026）：用 concept erasure（概念擦除）做过 T2V 的内容安全，那不是 CBM，是「删掉某个概念」。
- 视频 CBM 的难点：概念要**随时间演化**（人物从走到跑、镜头从推到拉），概念层要变成时序的，标注成本爆炸。

**结论：CBM 在视频生成上还是学术空白区，没有可直接抄的方案。**

---

## 三、对咱们项目的可参考价值

### 3.1 直接判断：**不建议引入 CBM**

理由：
1. **你的模型是冻结的** —— H3 权重不能改，CBM 的「插一层概念」做法不成立
2. **训练成本** —— 即使做 post-hoc，也要为每个概念训练能量函数/控制器，你只有 12G 显存
3. **视频领域的空白** —— 没有现成方案可抄，等于要自己研究
4. **收益不确定** —— 你现在的瓶颈不是「不可解释」，而是「角色不像」「动作不准」

### 3.2 但它的**思想**已经在你项目里了

这是最重要的发现：**你做的 3D 预演就是一个人工版的概念瓶颈**。

```
CBM：      需求 → [概念层 c] → [生成器] → 图像
你的预演： 需求 → [3D 场景参数：位置/朝向/关节/机位] → [H3] → 视频
                ↑
          这是完全显式、可解释、可干预的中间层
```

对比 CBM 的三个特性，你都有：

| CBM 特性 | 你的对应实现 |
|---|---|
| 概念可解释 | 3D 场景里每个演员的位置/姿势/机位都是数字，看得见 |
| 概念可干预 | 改 3D 里的演员位置 → 重渲染首帧 → 生成结果跟着变，**不用重训模型** |
| 概念组合 | 多个角色 + 多个动作 + 多个机位组合 |

**你的预演比 CBM 更彻底** —— CBM 的概念还是模型学出来的隐向量，你的概念是物理参数。

### 3.3 另一个已经用上的地方：角色卡

角色卡也是概念瓶颈的一种：

```
角色卡：appearance(蓝发/黑裙/黑手套) + style(anime cel-shaded) + refs(参考图)
         ↓ 展开
       固定的提示词片段 + 固定参考图
         ↓
       H3 生成
```

实测证据（Ave Mujica 测试）：

| 写法 | 结果 |
|---|---|
| 只写名字 `Sakiko Togawa` | ❌ 角色跑偏成黑发红裙路人 |
| 写全外观 `pale blue hair, black ribbon, black dress, black gloves` | ✅ 正确还原 |

**这就是「概念完整度」直接决定生成质量** —— 和 CBM 论文的核心论点一致。

---

## 四、如果要借鉴，可以做什么（建议，非必须）

按性价比排序：

### 4.1 ⭐ 强烈建议：把角色卡做成「结构化概念表」

不用碰 CBM 算法，只借它的**表示思想**：把外观描述拆成**固定字段**。

```json
{
  "hair":  { "color": "pale blue", "length": "very long", "style": "straight" },
  "eyes":  { "color": "purple" },
  "outfit": { "type": "black dress", "sleeves": "white frilled", "gloves": "black" },
  "accessory": { "hairRibbon": "black" }
}
```

好处：
- 组合可控（换一个字段就是新角色）
- 可复用（同一发型配不同服装）
- 可校验（缺字段就提示）

这就是 CBM 的「概念向量」在提示词工程里的等价物。

### 4.2 可选：用视觉模型自动提取概念

如果有视觉模型，可以从参考图自动抽取上面的字段（「蓝发、黑裙」），减少手填。**但这需要额外的 VLM，你目前没有部署。**

### 4.3 不建议：真的实现 CBM

理由见 3.1。投入产出比太低，且没有视频领域的成熟方案。

---

## 五、一句话总结

> **CBM 是「让生成过程有可读可控的中间层」的方法论。你已经在用它了——3D 预演是物理层的概念瓶颈，角色卡是提示词层的概念瓶颈。真正值得借鉴的只有一点：把角色卡的外观描述做成结构化字段表，而不是一段自由文本。**

---

## 六、参考文献

| 文献 | 链接 |
|---|---|
| Koh et al. 2020, Concept Bottleneck Models | 原始 CBM 论文 |
| CoBELa (ICCV 2025 Workshop) | https://arxiv.org/abs/2507.08334 |
| Post-hoc CBM for generative models (CVPR 2025) | https://arxiv.org/abs/2503.19377 |
| Concept Bottleneck Generative Models | https://openreview.net/pdf?id=zFOdOChRPR |
| CBM Survey (IJCAI 2026) | https://www.ijcai.org/proceedings/2026/892 |
| CleanVideo (concept erasure for T2V) | https://arxiv.org/html/2609.20267v2 |
