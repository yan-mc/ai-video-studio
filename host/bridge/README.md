# host/bridge —— H3 桥接层

这一层是**唯一**允许知道「H3 模型 / 南风 V15 节点包长什么样」的地方。
业务层（`host/services/`、`host/api/`、`host/tools.js`）只面向镜头卡与 job，
不直接接触 221 个参数、节点名、latent 文件夹哈希这些上游私有知识。

## 唯一门面规则（硬约束）

> **业务层只能 `import` `host/bridge/index.js`。**

- ✅ `import { nanfeng, prompt, continuation } from '../bridge/index.js';`
- ❌ `import ... from '../bridge/vendors/nanfeng/graph.js'`（深路径）
- ❌ `import ... from '../bridge/prompt/h3-prompt.js'`（深路径）

理由：深路径意味着上游改名/重组时改动面会扩散到多个业务文件；从门面取，
改名只改 `bridge/index.js` 的一行 re-export。业务层需要而门面还没暴露的符号，
**先加门面导出**，不要绕过。

守卫（在 `tools/smoke-api.mjs` 的「桥接层自检」里）：

1. 扫描 `host/` 全树（排除 `bridge/`、`node_modules`），断言不出现
   `bridge/(vendors|prompt|llm)/` 形式的深路径 —— 覆盖 `host/tools.js`。
2. 反向断言 `host/bridge/**` 内不出现 `../services/` 或 `../api/`。

## 目录与职责边界

| 子目录 | 管什么 | 变化的原因 |
|---|---|---|
| `vendors/nanfeng/` | 上游节点包镜像：221 参数表、图组装、环境修正、预设、续写编排 | 上游发新版 / 节点改名 |
| `prompt/` | 提示词通道：六段式编译、画风 11 + 打光 7、lint、换人提示词规则化 | 提示词规范演进 |
| `llm/` | DSH 内部 LLM 桥接：文本/视觉调用、智能分镜的 SKILL 装配与解析 | DSH LLM 接口变化 |

**判据**：改一个文件时，问自己「这次改动是因为上游变了，还是因为我们的产品语义变了，
还是因为 DSH 的 LLM 接口变了？」—— 三者分别对应上面三行。答不出来就说明放错了层。

## 文件清单

```
bridge/
├─ index.js                  对外唯一门面（业务层只 import 这里）
├─ vendors/nanfeng/
│  ├─ schema.js              221 参数机读定义（group / type / default / options）
│  ├─ param-docs.js          221 参数中文释义 + flag（dead / banned / advanced）
│  ├─ graph.js               类型强制 / sanitize / applyFixes / 能力探测 / 图组装
│  ├─ presets.js             7 内置预设 + 3 层合并 + Sigma 序列校验
│  ├─ index.js               buildShotWorkflow / buildShotOverrides / CONSTRAINT_RULES
│  └─ continuation.js        续写：网格吸附 / 分段规划 / 批次状态机 / 租约 / 串行编排
├─ prompt/
│  ├─ h3-prompt.js           门面 + 编译入口（compileH3Prompt / toShotInputPackage）
│  ├─ spec.js                官方枚举 / 硬上限 / 机制句 / 续写上下文判定
│  ├─ styles.js              画风库（11）+ 打光库（7）+ 冲突检测
│  ├─ route.js               模式 → 格式 的唯一路由器
│  ├─ base.js                基础格式（三字段 + 对齐指令）
│  ├─ ref2va.js              六段式正文 + 参考绑定
│  ├─ lint.js                反模式落位 / 结构自查 / 按字段截断
│  ├─ text-utils.js          帧数 / 时间戳 / 运镜 / 说话人 / 镜头归一（纯函数）
│  ├─ shot-adapter.js        镜头卡 → 编译器输入包（业务语义 + 编号权威覆盖）
│  └─ prompt-normalizer.js   换人提示词规则化（翻译由调用方注入）
└─ llm/
   ├─ dsh-llm.js             DSH llm / attachments / agentDefaultModel 桥接
   └─ storyboard.js          智能分镜：SKILL.md 装配 + 7 模式契约 + 解析
```

### 为什么 `h3-prompt.js` 要拆

原来它是 2169 行的单体：画风/打光两个**数据表**与编译逻辑同文件（前端下拉也得整文件
re-export）、`compileRef2VA` 412 行单函数、`toShotInputPackage` 把「我们的镜头卡形状」
写进了「上游提示词怎么说话」的模块。拆分后每个文件只承担一种变化原因；
`bridge/index.js` 的导出面保持不变，下游零改动。

## 为什么从 `services/nanfeng/` 搬出来

改造前这批文件平铺在 `host/services/` 顶层，与素材库、ffmpeg、剪辑这些业务服务混在一起。
三个具体后果：

1. **上游改名会漏改**：`H3LatentUpscalerNodeMegapixels` 被上游删除后，`graph.js` 的图组装
   与 `schema.js` 的选项表需要同步改，但它们分散在两个目录层级里，靠人记。
2. **业务层反向依赖上游细节**：`api` 与 `tools` 直接 import 参数表与预设表，
   上游参数表一变，两个业务入口都要改。
3. **提示词通道被误认为服务**：编译器是纯函数（无副作用、无 IO），放在 `services/`
   里让人误以为它需要初始化。

## 依赖方向（不可逆）

```
host/api, host/tools, host/services  ──▶  host/bridge  ──▶  vendor/nanfeng (Python, 跨进程)
                                              │
                                              └─▶ host/store（只读模型常量）
```

`bridge/` **不允许** import `host/services/` 或 `host/api/`。

需要业务层能力时，一律**由调用方注入**：

- `prompt-normalizer.normalizePrompt(raw, cfg, { translate })` —— 翻译函数由 api 层传
  `services/prompt-llm.translateBatch`。未注入时跳过翻译并给出 warning（不静默）。
- 能力探测结果（`availableNodes` / `probeDegraded` / `probeReason`）由 services 侧传入。

`tools/smoke-api.mjs` 有结构性断言守着这条边界。

## 提示词编号的单一真源

`<Picture N>` 的编号**只能**来自 `services/ref-images.js:planImageSlots`
（首/尾帧会占槽，所以编号 ≠ 参考图数组下标）。

`compileH3Prompt(pkg)` 接受 `pkg.pictureIndexMap`（plan 的 `pictureIndexMap`）：

- 传了映射 → 以映射为准；镜头卡里残留的 `subjects[].pictureIndex` 被覆盖或丢弃，
  且**每一处丢弃都写进 `warnings`**。
- 没传映射 → 按 subject 下标兜底，但同样产生 warning（该兜底不感知首尾帧占槽）。

`toShotInputPackage(shot, { pictureIndexMap })` 负责把这个映射带进输入包。

## 参数通道的三道校验顺序（不可交换）

1. `coerceTypes` —— 类型强制（数值型 COMBO 必须是数字）
2. `sanitize(explicitKeys)` —— COMBO 合法性。**显式传入的非法值直接报错**，
   绝不回退成"上游默认值"（`SageAttention: 'foo'` 回退成 `'auto'` 正是本机必崩值）
3. `applyFixes` —— 环境修正（SageAttention / TRT 引擎名 / 可选加速）

`buildWorkflow` 会在修正**之后再校验一次**，保证修正结果也合法。

## 续写批次的租约

`runBatch` 在同一个同步块内完成「读批次 → 校验租约 → 写 `running` + `runnerId` +
`heartbeatAt`」。心跳超过 `LEASE_TIMEOUT_MS`（90s）未更新，视为上次执行崩溃遗留：

- 接管并把停在 `running` 的段退回 `pending` 重跑（否则批次会永久卡住）；
- 接管事实写进 `batch.warnings`。

批次文件读盘失败时：保留 `.corrupt` 副本，自动回退 `.bak`；写盘对齐
`host/store/json-store.js` 的原子写（重试期间**不删目标文件**，最终失败退回覆盖写）。

## 上游升级流程

1. 把新的 `vendor/nanfeng/*.py` 放进 `vendor/nanfeng/`，跑 `deploy-vendor.ps1`。
2. 跑 `npm run audit:params` —— 它会用 Python AST 从新的 `h3_generator.py`
   重建参数集合，与 `bridge/vendors/nanfeng/schema.js` 逐名比对，输出差异。
3. 按差异改 `schema.js` / `param-docs.js` / `graph.js`（三处必须同时改，`audit:params` 会查）。
4. **重校 `param-docs.js` 里所有 `h3_generator.py:<行号>` 引用** —— 它是 UI 的真相来源，
   行号过期会让整块参数面板撒谎。
5. 跑 `npm test` —— 桥接层的断言覆盖这一层。