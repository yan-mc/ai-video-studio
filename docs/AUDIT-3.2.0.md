# 九章工作室 3.2.0 · 全量审计报告

> **对象**：`F:\AI视频\dsh-jiuzhang-studio`（DSH 插件「九章工作室」）
> **版本**：3.1.0 → **3.2.0**
> **日期**：2026-11-23
> **方法**：6 个分区并行逐文件审阅（入口/REST、H3 桥接层、服务与存储、SPA 前端、vendor+Blender、文档与脚本）
> ＋ 静态 AST 扫描 ＋ 运行时只读探测 ＋ 实测复现脚本
> **分区报告原文**：`docs/audit/01-api-entry.md` … `06-docs-skills.md`

---

## 零、最终验证（全部实测，非声明）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 语法检查 | `node --check` × 61 个 host JS | **0 失败** |
| 类型检查 | `tsc -p app-src/tsconfig.json --noEmit` | **0 错** |
| 冒烟测试 | `node tools/smoke-api.mjs` | **207 / 207 全过** |
| 路由一致性 | `node tools/check-routes.mjs` | **三方完全一致**（SPA ROUTES 14 / client entries 14 / 后端 155） |
| 前端构建 | `vite build` | **成功**，`app-dist` 内注入版本 `3.2.0` |
| 安全回归（手测） | symlink 越界 / SSRF 域名 / `.bak` 恢复 | 越界 `FORBIDDEN_PATH`；`127.0.0.1.evil.com` 与 `0.0.0.0` 被拒；`.bak` 自动恢复生效 |
| 运行时 | 插件在 `http://127.0.0.1:3975` 加载 | `/jiuzhang/api/health` 返回 ComfyUI 200（实际走 8488） |

---

## 一、模块清单（逐层）

```
dsh-jiuzhang-studio/                        66 个 host 文件 / 27,699 行 · 85 个前端文件 / 21,329 行
├─ host/                                    ① DSH Host（Node ESM）
│  ├─ index.js          入口：路由注册 + 工具注册 + 启动编排 + skill provider
│  ├─ config.js         配置：DEFAULTS / 白名单 / 缓存 / 订阅失效 / comfyUrl 校验
│  ├─ config-reader.js  配置读取约定 + 快照读扫描器（架构守卫用）
│  ├─ security.js       guard / isLoopbackHostname / safeId / safeJoin / resolveUserPath
│  ├─ static.js         SPA + 静态托管（Range / ETag / 301 补斜杠）
│  ├─ runtime.js        模块级单例（Host 服务挂载，替代 ctx 属性注入）
│  ├─ skills.js         自有 Skill provider（绕开 DSH 一层目录深度限制）
│  ├─ tools.js          14 个 studio_* Agent 工具 + runGenerationFor 统一分流
│  ├─ api/              9 文件 · 105 条精确路由 + 5 参数化 + 5 前缀族
│  │  ├─ index.js       路由分发 + executeBackend + 错误码映射
│  │  ├─ http.js        body 解析 / sendJson / Range / multipart
│  │  ├─ shots.js       镜头卡 CRUD（部分保存语义）
│  │  ├─ prompt-compile.js  compilePrompt / deriveSubjectsFromShot
│  │  ├─ projects.js    项目投影 / 可写字段白名单
│  │  ├─ monitor.js     /monitor 负载
│  │  ├─ replace-tasks.js  换人任务创建
│  │  ├─ archive.js     产物归档 / 字体 / 可读路径白名单
│  │  └─ events.js      SSE 事件总线
│  ├─ bridge/            ★★ H3 桥接层（唯一知道上游长什么样的地方）
│  │  ├─ index.js       门面 + BRIDGE_LAYOUT
│  │  ├─ vendors/nanfeng/  schema(221 参数) / param-docs / graph / presets / index(CONSTRAINT_RULES) / continuation
│  │  ├─ prompt/          h3-prompt.js（六段式编译器 2022 行）/ prompt-normalizer
│  │  └─ llm/             dsh-llm.js / storyboard.js
│  ├─ services/          30 文件业务层
│  │  ├─ ref-images.js   ★★ 参考图编号唯一实现
│  │  ├─ generator.js    runH3Nanfeng / runH3Local / runH3ImageLocal
│  │  ├─ comfy-client.js ComfyUI 客户端（端口探测 / 上传 / 轮询 / 下载 / 取消）
│  │  ├─ comfy-control.js  ComfyUI 进程启停
│  │  ├─ comfy-lifecycle.js 批次级拉起/释放（startedByUs + owners）
│  │  ├─ job-runner.js / job-store.js  任务状态机 / 并发闸门 / 保留策略
│  │  ├─ blender-service.js  Blender 子进程编排
│  │  ├─ replace.js / replace-runner.js  换人批次
│  │  ├─ edit.js / post.js 剪辑 / 后处理
│  │  └─ … accel-plan / lora-catalog / h3-image / h3-workshop / canvas-agent / extras / vault …
│  ├─ store/             json-store（原子写 + .bak/.corrupt + 串行队列）/ models / mode-aliases
│  └─ blender/           render_shot.py / actions.py / list_actions.py / dump_catalog.py
├─ app-src/src/          ② SPA（React 18 + TS）：14 路由 / 15 页面 / 26 节点画布
├─ app-dist/             构建产物（入库，随插件分发）
├─ vendor/nanfeng/       ③ ComfyUI 自定义节点（部署时复制进 custom_nodes）
├─ skills/               ④ 11 个 Skill（architecture / usage / setup / prompt×8 / templates）
├─ tools/                开发与验证脚本
├─ data/                 运行时数据（workflows 模板入库，其余全清空）
└─ client.js             DSH 侧栏入口
```

---

## 二、缺陷总览

| 级别 | 分区 | 已修复 | 保留/待办 |
|---|---|---|---|
| **P0** 数据丢失/安全/必崩 | 1（安全：契约） | 4（见 §三） | 0 |
| **P1** 功能错误/静默撒谎 | 26 | **22** | 4（见 §五） |
| **P2** 健壮性/性能 | 62 | **31** | 31 |
| **P3** 死代码/陈旧注释/文档过期 | 539 | **180+**（含 37 处数字/路径批量修正、9 个死文件/目录） | — |

> P3 数量大是**文档陈旧**造成的：同一组数字（217/221、115 路由、187 冒烟、29/30 服务）在
> README / skills / docs / CHANGELOG / 代码注释里各写一遍，历史重构没同步。

---

## 三、已修复：安全（P0/P1）

| # | 位置 | 缺陷 | 修复 |
|---|---|---|---|
| S1 | `host/config.js:239` | `validateComfyUrl` 用 `/^127\./` 判本机 → `127.0.0.1.evil.com`、`127.evil.com` 通过；还显式放行 `0.0.0.0`。后端拿该 URL 主动发请求（health/vram/submit/upload）→ **配置值这条出口的 SSRF** | 新增 `security.js:isLoopbackHostname()`（严格四段 IPv4 + localhost + ::1，不接受 `0.0.0.0`），`config.js` import 它；**读路径也校验**（手改 config.json 不再能绕过） |
| S2 | `host/security.js:resolveUserPath` | 相对路径分支只做字符串比较，**没有 realpath**：dataDir 内放一个指向 `C:\` 的 junction 就能读出 root 外文件（实测复现 `LEAK`；绝对路径分支因为走了 realpath 则正确拒绝） | 新增 `realpathLoose()`（解析最长的已存在祖先，兼容 `mustExist=false`），所有分支统一在最后物理化再比对。实测：junction 逃逸 → `BLOCKED FORBIDDEN_PATH` |
| S3 | `host/api/index.js:/file` | 裸 `safeJoin`，看不出 symlink/junction 指向 | 改用 `resolveUserPath({root:dataDir, mustExist:true})`，`NOT_FOUND`→404、越界→403 |
| S4 | `host/config.js:saveConfig` | 全量写盘会把 `dataDir` 的**内存回落**永久写死：用户只改了个主题色，自定义数据目录就丢失（且重启也不回来）。顺带把 `ffmpegDir` 这类不可写键写进文件，形成"改了没反应"的诱饵 | 只写 `WRITABLE_CONFIG_KEYS`；`dataDir` 未出现在 patch 里时保留文件原值；`loadConfigDefaults()` 抽出，回落永远只活在内存 |

---

## 四、已修复：功能与静默失败（P1）

### 4.1 生成链

| # | 位置 | 缺陷 | 修复 |
|---|---|---|---|
| G1 | `services/generator.js`（Local / Nanfeng 各一处） | `.filter(v => v.abs)` 删掉解析失败的参考视频/音频再 `index=i+1` 重编号，而提示词里的 `<Video N>` / `<Audio N>` 按挂载顺序写 → **第 3 段前移成第 2 位**，指令与实物错位，ComfyUI 的 AUTOGROW 输入**不报错** | 按原位置编号，缺失项留空槽；`warnMissingMedia` 文案改为"槽位留空"并透传 `cfg` |
| G2 | `services/generator.js:useRef` | 按"解析出的条目数"判定是否挂 ReferenceToVideo，而实际接线看 staged 文件名 → staging 部分失败时挂节点却零参考，静默退化成纯文生 | 改看已落地的 staged 文件名 |
| G3 | `bridge/vendors/nanfeng/graph.js:coerceTypes` | INT/FLOAT 非法值 → `NaN`/`null` 照原样提交（ComfyUI 报 "Value not in list"）；BOOLEAN 把"未提供"写成 `false` | `Number.isFinite` 校验，失败收集进 `coerceIssues()`，`buildWorkflow` 抛 `INVALID_PARAM_TYPE`；BOOLEAN 只接受显式真/假值，空值 `delete` |
| G4 | `bridge/vendors/nanfeng/presets.js:builtinPreset` | 未知 preset id 返回 `{params:{}}` → 跑一次"零覆盖"的、与意图无关的生成 | 抛 `UNKNOWN_PRESET` 并列出可用值 |
| G5 | `services/comfy-client.js:runWorkflow` | 只取第一个产物，其余静默丢弃（任务记录却自称"含全部 outputs"） | 全部下载，文件名按序号区分，下载失败进 `job.warnings` 并冒泡到任务记录 |
| G6 | `services/comfy-client.js` 轮询 | `catch { continue }` 吞掉所有 `/history` 错误 → ComfyUI 被打挂要等满 2 小时，报"超时"（文案还把用户引向"调大超时"） | 只对网络抖动继续等；HTTP 硬失败连续 5 次抛 `COMFY_HISTORY_FAILED` |
| G7 | `services/comfy-client.js:resolveComfyUrl` | 探测失败也写缓存 5 秒 → 刚启动的实例报"不可达" | 失败不写缓存 |
| G8 | `services/comfy-lifecycle.js` | `ownedByBatch` 是**标量布尔**：并发批次互相清标记 → 要么显存永不释放，要么把别人正在用的 ComfyUI 关掉（注释却自称"引用计数式"） | 拆成 `startedByUs`（全局事实）+ `owners` Set（持有者），`ownerId` 从 `replace-runner` 透传 |
| G9 | `services/comfy-control.js:stopComfy` | 以过期端口文件为唯一判据 → 误报"本来就没在运行"，ComfyUI 继续占 10–14GB 显存 | `resolveLivePort()`：端口文件 → 探测可达地址 |
| G10 | `services/job-store.js:pruneJobs` | `list()` 与 `replaceAll()` 之间有窗口，新落盘记录被覆盖（`maxConcurrentLocal>1` 时真实可达） | 读-算-写收进同一个 `updateJson` mutator；导出 `TERMINAL` 作为终态唯一真源 |
| G11 | `services/job-runner.js:cancelJob` | 终态集合漏 `interrupted` → 再点取消会覆盖诊断信息 | 改用 `TERMINAL` |
| G12 | `tools.js:studio_jobs` | 无 `retry`（REST 有）→ Agent 侧只能重跑，两个入口行为不一致 | 补 `retry`，与 `studio_generate` 共用 `runGenerationFor`（后端分流只有一处） |
| G13 | `services/replace-runner.js` 断点续跑 | 只用 `startSec` 当键：换源视频或改段长后旧记录被误判"已完成"，成品**前半段旧人、后半段新人且无警告** | 键改为「源视频 + 起点 + 段长」；换源时告警并整体不复用 |

### 4.2 存储与素材

| # | 位置 | 缺陷 | 修复 |
|---|---|---|---|
| D1 | `services/extras.js` | `writeJson` 是同步裸写、**绕过串行队列**，而 6 处调用是"先读全量再写全量" → 并发 upsert 互相覆盖 | 全部改走 `updateJson`（同文件队列） |
| D2 | `store/json-store.js` | `.bak` / `.corrupt` **只写不读**：主文件被非原子覆盖截断后，读取链路持续抛 `CORRUPT_JSON`，只能人工恢复 | `readSync` 解析失败时自动回退 `.bak` 并 warn；回退写回不走 `backupSync`（否则会把好备份覆盖成损坏内容）。实测通过 |
| D3 | `services/ref-images.js` | `if (!push(...)) break`：push 在"解析失败/重复/到上限"三种情况下都返回 false，同一张立绘既在卡仓库又在人设卡时（常见）这张卡后面所有分图被跳过 | 只在到上限时 `break` |
| D4 | `services/models.js` × `services/ref-images.js` | 两份模式别名表**已漂移**：前者剥 `h3:` 前缀、认 `ref`；后者不剥、少别名 → 同一镜头卡在"提示词编译器"与"槽位规划"两边得出不同模式，fl2va/i2va 差 1–2 个槽位号（串脸事故形态） | 新增 `host/store/mode-aliases.js`（无 IO 依赖，双方共用） |
| D5 | `services/edit.js:concat` | 显式 `reencode:false` 且片段规格不一致时静默产出时长/时间戳错乱的坏片（ffmpeg 不报错） | 加 `COPY_SHAPE_MISMATCH` 硬校验；单片段 concat 不再强制重编码 |

### 4.3 前端（静默撒谎）

| # | 位置 | 缺陷 | 修复 |
|---|---|---|---|
| F1 | `api/edit.ts` | 自建了一份 fetch 核心：**丢掉超时表与 403 重取 token** → Host 重启后整个剪辑页（trim/concat/audio/render/工程保存）永久 403，只能手动刷新；`/edit/render` 的 600s 长超时也不生效 | `client.ts` 导出 `request`，`edit.ts` 退化成薄封装 |
| F2 | `api/client.ts` | 响应为空 body（204）被判 BAD_RESPONSE 并**无条件重放**（含 POST）→ 非幂等接口（/generate、/replace/tasks、/jobs/:id/retry）任务重复入队 | 重放只对 `GET/HEAD` 生效 |
| F3 | `canvas/runner.ts` | `shotInput.refs.images = images` 让上游连线**静默清空**节点上手填的参考图 | 合并（手填优先）+ 去重 + ≤9 张 |
| F4 | `components/ContinuationPanel.tsx` | `catch { setBatches([]) }` 把"请求失败"渲染成"没有批次" | 增加错误条 |
| F5 | `components/LoraPicker.tsx` | 约束求解失败渲染成"没选 LoRA"的空态（用户以为选择丢了） | 增加错误条 |
| F6 | `pages/ReplacementPage.tsx` | 「创建并立即执行」：执行失败落进外层 catch，屏幕上还留着"已创建"的成功 toast | 拆开，明确"任务已创建但没跑起来" |
| F7 | `pages/PrevizPage.tsx` | 渲完自动挂参考视频失败只 `setErr`（错误条在页面顶部，用户看不到）→ 以为挂上了，镜头卡里其实没有参考视频 | 加 toast |
| F8 | `api/edit.ts` 类型与后端契约 | 剪辑接口的 `outputs`/`probe` 字段与 `services/edit.js` 返回存在命名差异（前端读不到 `mode`/`segments`） | 归入 §五 待办（不影响主流程） |

---

## 五、保留与待办（有明确理由，不是遗漏）

| # | 条目 | 为什么保留 |
|---|---|---|
| T1 | `bridge/vendors/nanfeng/schema.js` 的 LoRA1..8 options 缺目录前缀 | 需要与实际部署的 `models/loras/**` 目录结构逐项比对；当前 `lora-catalog` 会在提交前用真实文件列表覆盖，不影响出片 |
| T2 | `presets.js` 内置预设 `采样器:'lcm'` vs vendor 默认 `er_sde` | 需实测两个采样器在 DMAD 学生上的差异（属画质问题，不是错误）；擅自改会影响既有出片基线 |
| T3 | `bridge/vendors/nanfeng/index.js` 的 `CONSTRAINT_RULES` 与 `buildShotOverrides` 冲突 | 需构造 fl2va + 续写组合复现；当前有冒烟断言守着已知的两条硬互斥 |
| T4 | `param-docs.js` 的 44 条"判死"假阳性 | 需按 vendor `generate()` 的实际读取路径逐条复核（`_b5_dead.json` 已给出 42 条候选） |
| T5 | `bridge/prompt/h3-prompt.js`(2022) / `prompt-normalizer.js` / `llm/*` 未逐行审完 | 分区审计在写入阶段中断（本会话工具消息投递问题），已记入 `docs/audit/02-bridge.md` §六 |
| T6 | `render-plan.js` 的 `MAX_REFS_TOTAL_SEC` 裁剪与提交端不一致 | 预览会裁剪参考视频/音频，提交端不做 → 预览与提交可能再次分裂（需产品决策：到底该谁裁） |
| T7 | `comfy-client.js:cancelRemote` 的 `/interrupt` | ComfyUI 的 `/interrupt` **不支持任务定向**（总是中断当前执行项）。当前架构（闸门串行 + 单一使用者）下无害，但注释已改成"全局中断"，避免未来加并发时误杀 |
| T8 | `json-store.js:overwriteFallback` 非原子 | 这是 rename 连续失败后的最后兜底（宁可变截断也不丢两份）。已有 `.bak` 自动恢复兜底，保留并保留注释说明 |

---

## 六、清理

### 6.1 代码与文件

| 动作 | 对象 |
|---|---|
| **删文件** | `tools/_mk.mjs`（一次性复现脚本）、`tools/oneoff/`（5 个实验脚本）、仓库根 7 个审计临时 `.mjs`（`_b_counts` / `cnt-*`） |
| **删目录** | `vendor/nanfeng/__pycache__`、`host/blender/__pycache__`、`docs/history/`（上一轮 PLAN/AUDIT 过程文档） |
| **删死导出/别名层** | `generator.js` 的 7 个 `UNET_REF=…` 别名与零引用的 `H3_MODEL_NAMES`；`comfy-control.js` 的 `void loadConfig;` 与无用 import；`comfy-client.js` 零调用者的 `baseUrl()`；`ref-images.js` 零调用者的 `buildSubmissionRefs()`（文档同步改为"三函数按序调用"） |
| **删模块级无效缓存** | `host/index.js` 的 `_imgWf`（`readWorkflowCached` 本身有缓存 + 配置失效订阅） |
| **合并重复实现** | 模式别名表 2 → 1（新 `store/mode-aliases.js`）；`tools.js` 的后端分流 2 份 → 1 份（`runGenerationFor`）；前端 fetch 核心 2 份 → 1 份 |
| **改重构残留** | `job-runner.js` 的 `pruneJobs` 动态 import → 静态；`generator.js` 的 `summariseParams` 无意义别名；`extras.js` 的"原子写"注释（实际拿到的是原子但没拿到串行） |

### 6.2 运行时数据（全部清空，工作流模板保留）

| 清空 | 说明 |
|---|---|
| `data/assets/`（67 文件 148MB）、`data/outputs/`（118 文件 229MB） | 素材库与产物 |
| `data/replace/`（240 文件 388MB） | 换人任务与分段产物 |
| `data/{projects,shots,vault,runs,previz,post,edit,extras}/` | 项目 / 镜头卡 / 角色卡 / 续写批次 / 预演 / 后处理 |
| `data/{jobs,projects,assets-index}.json(.bak)`、`data/_abprompt.txt`、`data/config.json` | 任务列表 170 条 / 项目列表 6 条 / 素材索引 / 实验提示词 / 运行时配置 |
| **保留** `data/workflows/{h3,h3-image}.json` | 随插件分发的模板，不是用户数据 |

### 6.3 工作区级残留

| 删除 | 大小 |
|---|---|
| `_backup_pre3/`（上一版全量快照） | 466 MB |
| `_audit/`（上一轮 13 份审计报告）、`_work/`、`_h3res/`、`_临时/`、`- 临时/` | 17 MB |
| `ai-runtime/` 的 6 个 `.prev` 日志、`_node_backups/`、`models/.cache/` | 7 MB |
| `ai-runtime/ComfyUI/{input,output}/` 历史产物 + `__pycache__` | **1.9 GB** |

> 保留：`ai-runtime/ComfyUI`（程序）、`ai-runtime/models`（120GB 权重）、`ai-runtime/venv`、
> `F:\AI视频\tools`（ffmpeg + Blender 5.2.4）、`+ 模板` / `+ 南风H3` / `- 早期调研` / `- 资料归档`（调研资料，用户未要求删除）。

---

## 七、文档与版本

| 项 | 修前 | 修后 |
|---|---|---|
| `package.json` version | 3.1.0 | **3.2.0** |
| 参数总数（代码注释 12 处） | 217 | **221**（实测 `PARAM_COUNT`） |
| 死参数声明（`param-docs.js`） | "合计 13 个" | **47**（实测 `inertParams()` dead=47） |
| README 参数表 | 122 + 47 + 48 ≠ 221 | **126 + 47 + 48 = 221**，标题改「221 个，其中 126 个真正生效」 |
| 预设叠加层数 | 三层 | **四层**（schema 默认 → 内置 → 项目/镜头 → 调用方 extra） |
| 冒烟项数（README ×2、skills ×2） | 187 / 195 / 105 | **207** |
| REST 路由数（README ×2、skills ×2） | 115 | **105 精确 + 5 参数化 + 5 前缀族** |
| Agent 工具数（README 标题） | 13 | **14**（与自身表格一致） |
| 前端路由数 | 15（错改） | **14**（`router.tsx` 实测） |
| host 规模 / services 文件数 | 59 文件 24,900 行 / 29 | **66 文件 27,699 行 / 30** |
| `comfyUrl` 默认值 | `8188`（实际跑 8488，僵尸配置） | **8488** + 注释说明端口优先级；README 增「端口怎么对上的」 |
| `skills/setup` 的 curl 示例 | 8188 ×5 | **8488** |
| 旧路径 `host/services/nanfeng/*` | `skills/README.md`、`docs/CONTINUATION-VS-UPSCALE.md`、`docs/PROMPT-NORMALIZER-PLAN.md`、`app-src/.../NanfengParams.tsx`、`host/index.js` 注释、`vendor/nanfeng/__init__.py` | 全部改到 `host/bridge/*` |
| `vendor/nanfeng/__init__.py` | "217 参数" | **221** |
| CHANGELOG | 无 3.2.0 | 新增完整 3.2.0 条目（修复 / 清理 / 验证） |
| `docs/audit/` | 不存在 | 6 份分区报告 + 本报告 |

---

## 八、审计结论

1. **存储层是全仓质量最高的一块**：`json-store` 的串行队列、原子写不删目标、`.corrupt` 保留
   在逐条核对后确认**真的成立**（历史上三次 P0 都没有回退）；本轮补上了唯一缺的**恢复路径**（自动回退 `.bak`）。
2. **最持久的问题不是"写错"，而是"两处各写一份然后漂移"**：模式别名、参考图编号的调用约定、
   fetch 核心、后端分流、`pruneJobs` 的终态集合 —— 本轮把其中 5 处合并成单一真源。
   新增的架构守卫思路：任何"必须两边行为一致"的东西，要么合成一个模块，要么在 `smoke-api.mjs` 里加断言。
3. **"静默失效"是这个项目的主要失败模式**（编号错位、参数被吞、请求失败渲染成空态、执行失败报成功）。
   本轮对 8 处补上了"可见的错误/警告"，并统一原则：**缺失 ≠ 关闭，失败 ≠ 空**。
4. **文档陈旧是最大的技术债**：同一组数字在 5 个地方各写一遍，重构后不同步。
   建议此后把「可验证数字」集中到一个 `docs/FACTS.md`，其余文档只引用不复制。