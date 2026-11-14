# 画布模块测试

26 种节点 / 端口兼容矩阵 / 撤销与自动保存的 **纯逻辑** 单测。
不依赖 vitest / jsdom，用 node 24 自带的 type-stripping 直接跑 `.ts` 源码。

## 为什么需要 `register.mjs`

源码用的是 bundler 风格的无扩展名相对导入（`from './portTypes'`），这是 Vite/TS 的约定，
但 node 的 ESM 解析要求写全扩展名。`ts-resolver.mjs` 加一层 resolve 钩子，只在
"相对导入 + 无扩展名"时补 `.ts` / `.mjs`；`register.mjs` 把它装进进程。

生产构建完全走 Vite，与这些文件无关。

## 跑全部测试

在 `app-src` 目录下：

```powershell
# node 不在 PATH 时先补（与环境说明一致）
$env:Path = '<你的 Node 目录>;' + $env:Path

node --import ./tests/register.mjs tests/runAll.mjs
```

Windows 注意：`--import` 只接受 **相对路径或 file:// URL**。
传绝对路径 `F:\...` 会被当成 URL scheme `f:`，报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。

## 跑单个文件

```powershell
node --import ./tests/register.mjs --test tests/portTypes.test.mjs
```

## 最终验收（4 条验收标准一次跑完）

```powershell
npm run build                                            # tsc --noEmit + vite build
node --import ./tests/register.mjs tests/acceptance.mjs  # 26 项 / 无 hex / 产物校验 / 全部单测
```

## 测试文件

| 文件 | 覆盖 |
|---|---|
| `portTypes.test.mjs` | **isConnectable 的正/反用例（20+ 组）**、矩阵自洽、26 节点端口表完整性、handle 解析、"拖线到空白处只列可连节点"的产品行为、7 条官方工作流端到端 |
| `nodeRegistry.test.mjs` | 26 项验收、与后端 `models.js` 的 `NODE_TYPES`/`NODE_LABELS` 逐字对齐、定义完整性、默认参数可序列化、videoGeneratorNode 参数面 |
| `graph.test.mjs` | 连线结构约束（自连/重复/成环）、分组解组坐标可逆、序列化往返、脏数据容错、结果回流 |
| `historyAutosave.test.mjs` | **撤销 12 步上限**、合并窗口、**debounce 800ms**、**保存串行化**、**切项目 flush 给旧项目** |
| `videoParams.test.mjs` | 19 档 H3 + 4 档 Seedance、五段流 1~5 段边界、时长/参考图/模式校验、档位与模式一致性 |
| `verifyNodeTypes.mjs` | `nodes/index.ts` 的 26 个组件映射（静态解析）、组件真实存在、无重复映射 |

合计 **179 个用例**。
