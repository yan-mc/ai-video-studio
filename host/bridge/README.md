# host/bridge —— H3 桥接层

这一层是**唯一**允许知道「H3 模型 / 南风 V15 节点包长什么样」的地方。
业务层（`host/services/`、`host/api/`、`host/tools.js`）只面向镜头卡与 job，
不直接接触 221 个参数、节点名、latent 文件夹哈希这些上游私有知识。

## 目录与职责边界

| 子目录 | 管什么 | 变化的原因 |
|---|---|---|
| `vendors/nanfeng/` | 上游节点包镜像：221 参数表、图组装、环境修正、预设、续写编排 | 上游发新版 / 节点改名 |
| `prompt/` | 提示词通道：六段式编译器、画风 11 + 打光 7、换人提示词规则化 | 提示词规范演进 |
| `llm/` | DSH 内部 LLM 桥接：文本/视觉调用、智能分镜的 SKILL 装配与解析 | DSH LLM 接口变化 |

**判据**：改一个文件时，问自己「这次改动是因为上游变了，还是因为我们的产品语义变了，
还是因为 DSH 的 LLM 接口变了？」—— 三者分别对应上面三行。答不出来就说明放错了层。

## 文件清单

```
bridge/
├─ index.js                 对外唯一门面（业务层只 import 这里）
├─ vendors/nanfeng/
│  ├─ schema.js             221 参数机读定义（group / type / default / options）
│  ├─ param-docs.js         221 参数中文释义 + flag（dead / banned / advanced）
│  ├─ graph.js              类型强制 coerceTypes / sanitize / applyFixes / 能力探测 / 图组装
│  ├─ presets.js            7 内置预设 + 3 层合并 + Sigma 序列校验
│  ├─ index.js              buildShotWorkflow / buildShotOverrides / CONSTRAINT_RULES
│  └─ continuation.js       续写：网格吸附 / 分段规划 / 批次状态机 / 串行编排
├─ prompt/
│  ├─ h3-prompt.js          六段式编译器（模式路由 / 画风 / 打光 / references 编号 / lint）
│  └─ prompt-normalizer.js  换人提示词规则化（四段式 + 触发词保序）
└─ llm/
   ├─ dsh-llm.js            DSH llm / attachments / agentDefaultModel 桥接
   └─ storyboard.js         智能分镜：SKILL.md 装配 + 7 模式契约 + 解析
```

## 为什么从 `services/nanfeng/` 搬出来

改造前这 8 个文件 + `h3-prompt.js` + `prompt-normalizer.js` 平铺在
`host/services/` 顶层，与素材库、ffmpeg、剪辑这些业务服务混在一起。三个具体后果：

1. **上游改名会漏改**：`H3LatentUpscalerNodeMegapixels` 被上游删除后，
   `graph.js` 的图组装与 `schema.js` 的选项表需要同步改，但它们分散在两个
   目录层级里，靠人记。
2. **业务层反向依赖上游细节**：`api/index.js` 直接 `import '../services/nanfeng/schema.js'`
   取参数表，`tools.js` 也直接取 —— 上游参数表一变，两个业务入口都要改。
3. **提示词通道被误认为服务**：`h3-prompt.js` 是纯函数编译器（2,142 行），
   没有副作用、没有 IO，放在 `services/` 里让人误以为它需要初始化。

搬进 `bridge/` 之后，业务层统一从 `bridge/index.js` 取，上游改名只需改门面一行。

## 依赖方向（不可逆）

```
host/api, host/tools, host/services  ──▶  host/bridge  ──▶  vendor/nanfeng (Python, 跨进程)
                                              │
                                              └─▶ host/store（只读模型常量）
```

`bridge/` **不允许** import `host/services/` 或 `host/api/`。
（`prompt/h3-prompt.js` 只 import `host/store/models.js` 的常量，这是唯一的横向依赖。）

`tools/smoke-api.mjs` 有结构性断言守着这条边界。

## 上游升级流程

1. 把新的 `vendor/nanfeng/*.py` 放进 `vendor/nanfeng/`，跑 `deploy-vendor.ps1`。
2. 跑 `npm run audit:params` —— 它会用 Python AST 从新的 `h3_generator.py`
   重建参数集合，与 `bridge/vendors/nanfeng/schema.js` 逐名比对，输出差异。
3. 按差异改 `schema.js` / `param-docs.js` / `graph.js`（三处必须同时改，`audit:params` 会查）。
4. 跑 `npm test` —— 桥接层的 177 项断言里有 60+ 项覆盖这一层。