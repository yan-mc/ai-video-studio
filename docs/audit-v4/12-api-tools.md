# M2 REST 层 + M3 Agent 工具层 审计

> 审计对象：`F:\AI视频\dsh-jiuzhang-studio`（v3.3.0，工作区有未提交改动）
> 审计范围：M2 = `host/api/*`（index.js 2819 行 + 8 个拆出模块）+ `host/security.js` + `host/static.js` + `host/runtime.js`；M3 = `host/tools.js`（1302 行 / 14 个工具）
> 交叉参考：`app-src/src/api/client.ts`(884) / `edit.ts`(205) / `events.ts`(196) / `url.ts`(54)、`client.js`(366)、`tools/check-routes.mjs`(260)
> 审计纪律：**只读**。未修改任何源文件（唯一写入是本报告）。执行过的只读命令：
> `node --check`（5 个文件，均 exit 0）、`node tools/check-routes.mjs`（exit 0）、`node tools/smoke-api.mjs --quick`（247/248，1 失败）、
> 以及若干只读探针脚本（临时目录，用于实测 `resolveUserPath` / `parseRangeHeader` / 工具 schema / 预设查表行为）。
> 工作区确有未提交改动（`package.json` 3.3.0、inpaint 子系统、`docs/audit-v4/`）。

---

## 一、模块结构（文件→职责→行数→导出）

| 文件 | 行数 | 职责 | 主要导出 |
|---|---|---|---|
| `host/api/index.js` | 2819 | **路由分发器本体**：`handleApi()` 一个函数里 114 条精确 + 3 条 OR 合并（展开 6 个 method×path）+ 5 条正则 + 5 条 `startsWith` 前缀；另含 `executeBackend()` 后端分流 | `handleApi`、`VALID_BACKENDS`、6 个 re-export（L57/L59） |
| `host/api/http.js` | 181 | 纯 HTTP：读 body / sendJson / Range / multipart / RFC2047 / 流 | `readJsonBody`、`readRawBody`、`sendJson`、`parseRangeHeader`、`pipeStream`、`parseMultipart`、`decodeRfc2047`、`MIME_BY_EXT` |
| `host/api/shots.js` | 165 | 镜头卡存储（被 `tools.js` 直接 import） | `listShots`、`writeShots`、`upsertShot`、`cleanupProjectArtifacts` |
| `host/api/prompt-compile.js` | 217 | 提示词编译入口（被 `tools.js` 直接 import） | `compilePrompt`、`deriveSubjectsFromShot` |
| `host/api/projects.js` | 72 | 项目摘要投影 / 可写字段白名单 / pack-unpack | `projectSummary`、`allowedProjectPatch`、`packProject`、`unpackProject` |
| `host/api/monitor.js` | 37 | `/monitor` 数据源 | `monitorPayload`、`diskFree` |
| `host/api/replace-tasks.js` | 147 | 换人任务创建（只建记录） | `createReplaceTask` |
| `host/api/archive.js` | 141 | 产物自动归档 / 中文字体 / `/file` 子目录白名单 / 免令牌守卫 | `runAndArchive`、`listChineseFonts`、`isServableDataPath`、`guardNoToken` |
| `host/api/events.js` | 128 | SSE：`clients` 集合、25s ping、广播 | `handleSse`、`broadcast`、`clientCount`、`emit` |
| `host/security.js` | 264 | 写令牌 / 同源 / loopback / `safeId` / `safeJoin` / `resolveUserPath` | 12 个导出 |
| `host/static.js` | 255 | SPA（301 补斜杠 + token 注入位）+ 通用静态（ETag/Range） | `serveSpa`、`serveStatic` |
| `host/runtime.js` | 38 | 模块级单例（绕开 Cordis 的 provide 限制） | `initRuntime`、`getRuntime`、`attachControllers`、`disposeRuntime`、`isRuntimeReady` |
| `host/tools.js` | 1302 | 14 个 `studio_*` 工具定义 + 工具内的执行分流 | `registerTools`（default） |

**结构结论（先给判断，证据在 §四/§五）**：
1. 9 个文件是从 `index.js` 「逐字迁出」的（每个文件头都写着原行号），迁出的是**纯函数**；
   真正需要拆的**路由分发 + 业务编排**一行也没迁出，`index.js` 仍然是 2819 行的单函数。
2. `tools.js` 被 `index.js` 的 re-export 反向依赖（`tools.js:11`），而 `index.js` 又 import 了 `tools.js` 不需要的十几个服务 —— 双向耦合已形成。
3. `runtime.js` 的 32 行是必要的（Cordis 约束），但它是**隐式全局**：`handleApi` 第一行 `getRuntime()` 就决定了整个 REST 层无法在无 runtime 的环境下单测（`tools/smoke-api.mjs:2153` 专门写了一段"重新 apply 把 runtime 装回来"的绕行代码，就是这条耦合的账单）。

---

## 二、路由全表

### 2.1 计数口径（可复算）

用脚本对 `host/api/index.js` 正则提取，结果与任务书给的「106 精确 + 5 参数化 + 2 前缀」**不一致**，实际为：

| 类型 | 条数 | 说明 |
|---|---|---|
| `req.method === 'X' && route === '/p'` 精确 | **114** | 逐条列出（见下） |
| `(A ‖ B) && route === '/p'` OR 合并 | **3** 语句 → 展开 **6** 个 method×path | `/canvas-agent/permissions`(POST/PUT, L2097)、`/assets/item`(GET/HEAD, L2197)、`/file`(GET/HEAD, L2254) |
| `route.match(/^.../)` 正则 | **5** | L783、L816、L933、L947、L2424（另有 L1092 / L1122 用 `/re/.exec(route)` 写法，正则同样式） |
| `route.startsWith()` 前缀族 | **5 语句 / 4 个前缀** | L216 `/nanfeng/presets/`、L267 `/nanfeng/continuation/batches/`、L2596+L2603 `/replace/tasks/`、L2613 `/replace/run/` |
| 去重后的 method+path 总数 | **110** 个唯一路径 | 精确 114 条对应 110 个唯一路径（`/projects`、`/config` 等各有 GET+POST 两条） |

> 差异说明：任务书给的 106/5/2 与代码不符，且脚本与 `tools/check-routes.mjs:201` 自报的「后端路由 160 条」也不符 ——
> 后者把正则路由按 5 个 method 展开、前缀按 5 个 method 展开，是**虚高**（见问题 P3-3）。

### 2.2 全表（方法｜路径｜handler 行号｜是否含业务逻辑｜前端是否调用）

「含业务」判定标准：handler 体内出现**领域计算/多服务编排/数据变换**（非单纯 `await service.x(); sendJson`）。
「前端」= `client.ts`/`edit.ts`/`events.ts`/`client.js` 是否直接调用（脚本比对，模板插值折叠为 `:id`）。

| # | 方法 | 路径 | 行号 | 含业务 | 前端 |
|---|---|---|---|---|---|
| 1 | GET | `/token` | 115 | 否 | ✅(client.js:179) |
| 2 | GET | `/monitor` | 132 | 否（下沉 monitor.js） | ✅ |
| 3 | GET | `/meta` | 135 | **是**（8 个投影拼装） | ✅ |
| 4 | GET | `/events` | 155 | 否 | ✅(events.ts:104) |
| 5 | GET | `/nanfeng/schema` | 165 | **是**（enrich + inert 合并） | ✅ |
| 6 | GET | `/nanfeng/presets` | 185 | **是**（30 行对象拼装 + accelPlans 重算） | ✅ |
| 7 | GET | `/nanfeng/presets/:id` | 216(前缀) | **是**（preset→merge→coerce 三步编排） | ✅ |
| 8 | POST | `/nanfeng/continuation/batches` | 238 | 否 | ✅ |
| 9 | GET | `/nanfeng/continuation/batches` | 259 | 否 | ✅ |
| 10 | GET | `/nanfeng/continuation/batches/:id[/next]` | 267(前缀) | **是**（`/next` 下的 done/index/shotId 组装） | ✅ |
| 11 | POST | `/nanfeng/continuation/segment` | 292 | **是**（字段白名单写回 + advanceStatus + emit） | ✅ |
| 12 | POST | `/nanfeng/continuation/plan` | 323 | 否 | ❌ 死路由 |
| 13 | POST | `/nanfeng/continuation/batches/run` | 344 | **是（最重的一段，208 行：建 job + runAndArchive + 60min 轮询 + 定时器管理）** | ❌ 死路由 |
| 14 | POST | `/nanfeng/continuation/batches/reset` | 486 | 否 | ❌ 死路由 |
| 15 | GET | `/nanfeng/storyboard/meta` | 499 | **是**（含 `_schemaUnused` 探测） | ✅ |
| 16 | POST | `/nanfeng/storyboard/generate` | 517 | **是（92 行：图片解析 + 逐图视觉 + 组装 + 解析）** | ✅ |
| 17 | GET | `/health` | 610 | **是**（5 源聚合） | ✅ |
| 18 | GET | `/comfy/status` | 643 | 否 | ✅ |
| 19 | POST | `/comfy/stop` | 647 | 否 | ✅ |
| 20 | POST | `/comfy/start` | 659 | 否 | ✅ |
| 21 | POST | `/comfy/restart` | 664 | 否 | ✅ |
| 22 | GET | `/accel/plans` | 684 | 否 | ❌ 死路由 |
| 23 | GET | `/lora/catalog` | 704 | **是**（探测 + 归类 + byCategory 聚合） | ✅ |
| 24 | POST | `/lora/solve` | 733 | 否 | ✅ |
| 25 | GET | `/workflows/diagnostics` | 740 | 否 | ❌ 死路由 |
| 26 | GET | `/config` | 748 | 否 | ✅ |
| 27 | POST | `/config` | 749 | **是**（INVALID_COMFY_URL 分流 + 缓存重置） | ✅ |
| 28 | GET | `/projects` | 772 | 否 | ✅ |
| 29 | POST | `/projects` | 776 | 否 | ✅ |
| 30-32 | GET/POST/DELETE | `/projects/:id` | 783(正则) | **是**（merge + pack + cleanup 编排） | ✅ |
| 33-34 | GET/POST | `/projects/:id/shots` | 816(正则) | 否 | ✅ |
| 35 | POST | `/generate` | 831 | **是（58 行：后端校验 + 角色卡 + 编译 + job 装配）** | ✅ |
| 36 | GET | `/jobs` | 889 | **是**（排序 + list 投影） | ✅ |
| 37 | GET | `/jobs/:id` | 933(正则) | **是**（`batch-progress` 特判） | ✅ |
| 38-39 | POST | `/jobs/:id/{cancel,retry}` | 947(正则) | **是**（retry 的镜头查找 + job 重建） | ✅ |
| 40 | POST | `/resolution` | 976 | 否 | ❌（api 有函数，无调用点） |
| 41 | POST | `/h3/length` | 980 | 否 | ❌（同上） |
| 42 | POST | `/h3/workshop/analyze` | 986 | 否 | ✅ |
| 43 | POST | `/h3/workshop/import` | 990 | 否 | ✅ |
| 44 | GET | `/h3/film/status` | 994 | 否 | ❌ |
| 45 | POST | `/h3/film/render` | 997 | 否 | ❌ |
| 46 | GET | `/blender/health` | 1012 | 否 | ✅ |
| 47 | GET | `/blender/assets` | 1017 | 否 | ❌ |
| 48 | GET | `/blender/actions/catalog` | 1026 | **是**（groups 聚合） | ❌ |
| 49 | POST | `/blender/open` | 1039 | 否 | ❌ |
| 50 | POST | `/blender/actions` | 1048 | 否 | ❌ |
| 51 | POST | `/blender/render` | 1055 | **是**（shot 查找 + spec 兜底 + timeout 夹取） | ✅ |
| 52 | GET | `/vault/meta` | 1075 | 否 | ✅ |
| 53 | GET | `/vault/cards` | 1078 | 否 | ✅ |
| 54 | POST | `/vault/cards` | 1082 | 否 | ✅ |
| 55 | POST | `/vault/cards/delete` | 1086 | 否 | ✅ |
| 56-57 | GET/POST | `/vault/cards/:id` | 1092(exec 正则) | 否 | ✅ |
| 58 | GET | `/vault/plan` | 1106 | **是**（绑定卡合并 + CSV 解析） | ❌ |
| 59-60 | GET/POST | `/projects/:id/cards` | 1122(exec 正则) | **是**（逐 id 取卡、`.catch(()=>null)`） | ✅ |
| 61 | POST | `/assets/archive` | 1147 | **是（47 行：逐条 try/catch + 白名单）** | ❌ |
| 62 | POST | `/render/plan` | 1198 | **是（20 行：取卡 + 媒体解析 + buildRenderPlan）** | ❌ |
| 63 | POST | `/render/compile` | 1224 | **是（60 行：与 #62 重复一遍 plan，再编译）** | ❌ |
| 64 | GET | `/breakdown/meta` | 1299 | 否 | ✅ |
| 65 | POST | `/breakdown/preview` | 1310 | 否 | ✅ |
| 66 | POST | `/breakdown/generate` | 1328 | **是（120 行：提示词/参考图/面积三段校验 + job）** | ✅ |
| 67 | GET | `/image/meta` | 1460 | **是**（effective 对照表） | ✅ |
| 68 | GET | `/image/lora/catalog` | 1497 | **是**（同 #23 的复制） | ✅ |
| 69 | POST | `/image/lora/solve` | 1525 | **是**（探测 + 求解） | ✅ |
| 70 | POST | `/image/generate` | 1555 | **是（149 行：校验/参考图/LoRA/批量拆 job/warnings 拼装）** | ✅ |
| 71 | GET | `/image/inpaint/meta` | 1719 | 否 | ✅ |
| 72 | POST | `/image/inpaint` | 1736 | **是**（编排已下沉，仍留 try/catch + 进度回写） | ✅ |
| 73 | GET | `/image/progress` | 1784 | **是**（投影 + 逐 id 取） | ✅ |
| 74 | GET | `/prompt/meta` | 1835 | **是**（styles 前置 `none` 等拼装） | ✅ |
| 75 | POST | `/prompt/compile` | 1869 | 否 | ❌ |
| 76 | POST | `/prompt/from-shot` | 1873 | **是（40 行：卡片解析 + subjects 决议）** | ❌ |
| 77 | POST | `/prompt/preview` | 1914 | 否 | ❌ |
| 78 | GET | `/templates` | 1921 | 否 | ✅ |
| 79 | POST | `/templates/upsert` | 1924 | 否 | ✅ |
| 80 | POST | `/templates/delete` | 1928 | 否 | ✅ |
| 81 | GET | `/wardrobe` | 1934 | 否 | ✅ |
| 82 | POST | `/wardrobe/upsert` | 1937 | 否 | ✅ |
| 83 | POST | `/wardrobe/delete` | 1941 | 否 | ✅ |
| 84 | POST | `/wardrobe/resolve` | 1952 | **是**（投影裁剪） | ❌ |
| 85 | GET | `/toolbox/health` | 1971 | 否 | ✅ |
| 86 | POST | `/import/scan` | 1976 | 否 | ✅ |
| 87 | POST | `/import/preview` | 1980 | 否 | ✅ |
| 88 | GET | `/resources/orphans` | 1986 | 否 | ✅ |
| 89 | GET | `/resources/previz` | 1997 | **是（28 行：递归 walk 统计字节 + sort）** | ❌ |
| 90 | POST | `/resources/previz/clean` | 2026 | 否 | ❌ |
| 91 | POST | `/resources/clean` | 2034 | 否 | ✅ |
| 92 | GET | `/motionshots` | 2041 | 否 | ✅ |
| 93 | POST | `/motionshots/upsert` | 2044 | 否 | ✅ |
| 94 | POST | `/motionshots/delete` | 2048 | 否 | ✅ |
| 95 | GET | `/logs` | 2054 | 否 | ✅ |
| 96 | POST | `/logs` | 2057 | 否 | ❌ |
| 97 | GET | `/jobs/batch-progress` | 2063 | **是**（连 `list()` 全量再投影） | ✅ |
| 98 | GET | `/canvas-agent/meta` | 2069 | 否 | ❌ |
| 99 | POST/PUT | `/canvas-agent/permissions` | 2097 | 否 | ✅ |
| 100 | POST | `/canvas-agent/exec` | 2103 | **是（17 行：权限注入 + 项目数据补全）** | ✅ |
| 101 | GET | `/assets` | 2126 | 否 | ✅ |
| 102 | POST | `/assets/upload` | 2131 | **是（64 行：multipart 解析 + 逐文件保存 + 探测回写）** | ✅ |
| 103 | GET/HEAD | `/assets/item` | 2197 | **是（43 行：Range/SVG 处置/HEAD）** | ✅ |
| 104 | POST | `/assets/delete` | 2241 | 否 | ✅ |
| 105 | GET/HEAD | `/file` | 2254 | **是（72 行：白名单 + Range + 安全头）** | ✅ |
| 106-113 | POST | `/post/{transcode,scale,crop,split,annotate,extractFrame,extractAudio,stripAudio}` | 2328-2363 | 否（8 条一模一样） | 仅 transcode ✅ |
| 114 | POST | `/post/qc` | 2367 | 否 | ✅ |
| 115 | GET | `/post/fonts` | 2371 | 否 | ❌ |
| 116 | GET | `/edit/clips` | 2388 | 否 | ✅ |
| 117 | POST | `/edit/probe` | 2391 | 否 | ✅ |
| 118 | POST | `/edit/trim` | 2396 | 否 | ✅ |
| 119 | POST | `/edit/concat` | 2401 | 否 | ✅ |
| 120 | POST | `/edit/audio` | 2405 | 否 | ✅ |
| 121 | POST | `/edit/render` | 2410 | 否 | ✅ |
| 122 | GET | `/edit/projects` | 2414 | 否 | ✅ |
| 123 | POST | `/edit/projects` | 2417 | **是**（id 生成 + safeId） | ✅ |
| 124-126 | GET/POST/DELETE | `/edit/projects/:id` | 2424(正则) | 否（但 **id 未过 safeId**，见 P0-2） | ✅ |
| 127 | GET | `/replace/meta` | 2448 | **是（26 行：三处动态 import + 四个常量表）** | ❌ |
| 128 | POST | `/replace/prompt-template` | 2485 | **是**（模板循环生成） | ❌ |
| 129 | POST | `/replace/preview-prompt` | 2505 | 否 | ❌ |
| 130 | POST | `/replace/compile-prompt` | 2530 | **是**（三层降级编排 + parts 投影） | ❌ |
| 131 | GET | `/replace/llm-status` | 2561 | 否 | ❌ |
| 132 | POST | `/replace/plan` | 2567 | 否（但 continuation 分支被透传，见 P2-4） | ❌ |
| 133 | GET | `/replace/tasks` | 2583 | **是**（排序） | ✅ |
| 134 | POST | `/replace/tasks` | 2589 | 否 | ✅ |
| 135 | DELETE | `/replace/tasks/:id` | 2596(前缀) | 否 | ✅ |
| 136 | GET | `/replace/tasks/:id` | 2603(前缀) | 否 | ✅ |
| 137 | POST | `/replace/run/:id` | 2613(前缀) | **是**（409 判定 + `void runReplaceBatch`） | ✅ |

**业务混进路由的具体行段（汇总，逐条见 §四 P2-1）**：
`L344–483`（续写批次编排，208 行，最长）、`L517–608`（智能分镜生成，92 行）、`L1147–1193`（归档）、
`L1198–1218` + `L1224–1283`（render plan/compile，两段几乎逐字重复）、`L1328–1448`（立绘拆解，120 行）、
`L1555–1704`（出图，149 行）、`L1997–2025`（previz 用量统计）、`L2131–2196`（上传）、`L2448–2474`（replace meta）。

---

## 三、工具全表（工具｜参数 schema｜与 REST 的偏差）

14 个工具，实测注册（`registerTools` 被真实执行后 dump）：`studio_meta / config / project / shot / prompt / generate / jobs / h3_workshop / blender / post / edit / toolbox / image / storyboard`。

| 工具 | schema（required / props 数） | 对应 REST | 偏差 |
|---|---|---|---|
| `studio_meta` | `[]` / 0 | `GET /meta` + `/nanfeng/schema` + `/nanfeng/presets` + `/health` | **返回结构完全不同**：REST `/meta` 回 `defaultBackend/defaultProfile/assetTypeLabels`；工具回 `runtime`、`nanfeng{paramCount,groups,presets}`。字段名 `backends` 在 REST 是 `string[]`，在工具是 `{h3:{...}}` 对象 —— 同名字段不同类型（P1-6） |
| `studio_config` | `['action']` / 2 | `GET|POST /config` | 一致（都过 `sanitizeConfigPatch`）。**但** tools 侧 `action` 非法值（如 `'SET'`）会静默走 set 分支（`tools.js:161-164`，没有 else），REST 不会（P2-3） |
| `studio_project` | `['action']` / 3 | `/projects` CRUD | ① `create` 返回完整记录，REST 返回 `projectSummary` 投影；② `delete` **先 remove 后 cleanup**（`tools.js:198-200`），REST 是**先 cleanup 后 remove**（`index.js:807-809`）——顺序相反导致失败语义不同（P2-5）；③ `update` 不走 `allowedProjectPatch` 白名单，任意字段可写（P1-7） |
| `studio_shot` | `['action','projectId']` / 4 | `GET|POST /projects/:id/shots` | 工具多了 `delete`（REST 无对应路由），且 delete 走 `writeShots` 覆盖全表（无 `.bak` 之外的并发保护，但与 upsert 共用 updateJson 队列，可接受） |
| `studio_prompt` | `[]` / 14 | `/prompt/meta` / `compile` / `from-shot` | ① 工具 `meta` 只回 `styles/modes/limits`，REST `/prompt/meta` 还回 `lightings` 且 styles 前置 `{id:'none'}`（`index.js:1847-1854`）→ **Agent 看不到「不指定（交给 LoRA）」这一档**（P1-8）；② 工具 `compile` 直接去吃 REST 不吃的位置参数；③ 无 action 的兼容分支与 `fromShot` 合并后**无法区分**，两者返回结构不同（`resolution/h3Length` 只在兼容分支有）（P2-6） |
| `studio_generate` | `['projectId','shotId']` / 8 | `POST /generate` | ① REST 收 `accelPlan`/`steps` 覆盖，工具 schema **没有**这两个字段（P1-9）；② 工具把 `params`→`nanfengExtra`、`preset`→`nanfengPreset`、`mode`→`nanfengMode`，REST **完全不读**这三个 body 字段（只从 shot 上取）—— 同一份「南风预设」在两入口的落点不同；③ 工具 `prompt: compilePrompt(shotWithCards)` **不传 outWarnings**（`tools.js:409`），REST 传（`index.js:851-852`）→ Agent 触发时 lint 警告丢失（P1-10） |
| `studio_jobs` | `['action']` / 3 | `GET /jobs`、`/jobs/:id`、`cancel`、`retry` | ① `list` 有 `limit`（默认 50）+ 排序，REST `/jobs` **无分页、无 limit**；② `list` 无 `fields=list` 轻量投影（Agent 拿全量含 prompt）；③ `get` 无 id 形状校验（REST 用 `safeId(/^job_.../)`）；④ `cancel` 不返回 `cancelResult/remoteCancel` 之外的 REST 字段差异 |
| `studio_h3_workshop` | `['action']` / 10 | `/h3/workshop/{analyze,import}` | 一致（同一 service）。但工具**未校验 `projectId`**（不 `safeId`），REST 也不校验 —— 两者同病（并入 P2） |
| `studio_blender` | `['action']` / 7 | `/blender/*` | ① 工具 `actions` 缺 `assetRel` 时报 `ASSET_REQUIRED`（无 code），REST 400 带 code；② 工具 `render` **不透传 `timeoutMs`**，REST 有 `Math.max(30000, Math.min(900000, ...))`（`index.js:1069`）；③ 工具 `render` 的 `jobId` 用 `a.shotId`（`tools.js:609`），REST 用 `body.jobId || shot.id`（`index.js:1068`）—— 同一次渲染的 workDir 名字不同；④ 工具 `spec` 用 `a.shot ?? find(...)`，REST 先 `pid` 再 `body.shot ??`，`body.shot` 缺 `frames` 兜底时行为不同（P1-11） |
| `studio_post` | `['op','input']` / 13 | `/post/*` | **已知偏差**：REST `/post/qc` 收 `{path}` **或** `{input}`（`index.js:2369` `body.path ?? body.input`），工具收 `input`（`tools.js:650` `rest.input ?? rest.path`，schema 里**只有 `input` 没有 `path`**）→ Agent 无法用 `path`，REST 用户可以用（P1-12）。另：8 个 REST 路由中前端只用到 `/post/transcode` 与 `/post/qc`，其余 6 条属死路由（P2-7） |
| `studio_edit` | `['op']` / 18 | `/edit/*` | ① 工具 `audio` 的**子操作**叫 `audioOp`，服务层叫 `op`（`edit.js:396`）—— 用户/REST 传 `op:'strip'`，Agent 必须传 `audioOp`，两入口形状不同（P1-13）；② 工具 `trim` 只透传 `input/startSec/endSec`，**丢了 `reencode`**（`edit.ts:141` 有该字段，`tools.js:731` 未传）；③ 工具 `projects` 只能 list/get，**不能 save/delete**（REST 有 POST/DELETE）；④ 工具 `concat` 的 `inputs` 未校验非空 |
| `studio_toolbox` | `['domain','action']` / 10 | 7 个域共 16 条路由 | ① `logs` 域的 `upsert` 映射到 `appendLog`（`tools.js:832`），REST `POST /logs` 也叫 upsert —— 但**前端从不调 POST /logs**；② `importScan`/`orphans` 的 `action` 是 `scan/preview/clean`，与 `promptTemplates` 的 `list/upsert/delete` 共用同一枚举，域与动作的笛卡尔积大部分非法（`tools.js:851` 用 `throw UNKNOWN_ACTION` 兜，但 6 个域 × 6 个动作 = 36 组合里只有 17 个合法，schema 无法表达） |
| `studio_image` | `['action']` / 18 | `/image/meta`、`/image/lora/catalog`、`/image/generate`、`/image/inpaint` | ① **`action='inpaint'` 整段是坏的**：调用 `validateInpaintRequest`/`resolveInpaintSizes`/`maskMismatchMessage`/`resolveStrokePixels`/`resolveCropResolution` **五个未导入的标识符**（`tools.js:978/1017/1019/1028/1032`，import 表见 `tools.js:42-47` 只有 `INPAINT_DENOISE/runH3Inpaint/inpaintMeta`）→ 实测 `ReferenceError: validateInpaintRequest is not defined`（P0-1）；② 工具 `generate` **不走 `runAndArchive`**（`tools.js:1158` 用 `runJob`），REST 走（`index.js:1660`）→ Agent 出的图**不自动归档进素材库**，没有 `archivedRel`（P1-14）；③ 工具 `generate` 的 `warnings` 缺 `replaced`/`degraded` 两类（`tools.js:1125-1130` 只有 bad/dropped/rejected），REST 有五类（`index.js:1621-1631`）；④ 工具 `generate` 不读 `availableFiles`（`tools.js:1119-1121` 直接 `solveImageLoraStack` 不传探测结果），REST 传（`index.js:1607-1614`）→ 同一个不存在于磁盘的 LoRA，REST 报 rejected、工具静默 accepted（P1-15）；⑤ 工具 `meta` 多回 `loraRoot/hint/inpaint`，REST 多回 `effective.declaredSteps` 之外的 `models` 同名不同构 |
| `studio_storyboard` | `['action']` / 9 | `/nanfeng/storyboard/{meta,generate}` | ① 工具 `generate` **不返回 `raw`**（REST `index.js:599` 有 `raw: parsed.raw`）；② 工具 `meta` 不返回 `_schemaUnused`（REST 有）；③ 工具 `analyze` 的 `badRels` 只在 `analyze` 分支返回，`generate` 分支**丢了**（`tools.js:1269` vs `1289-1295`）→ REST 两处都带（`index.js:600`） |

**结论**：14 个工具里 **1 个完全不可用（studio_image inpaint，P0）**，**8 个存在字段/默认值/返回结构偏差（P1）**，**5 个仅 P2 级偏差**。

---

## 四、问题清单

> 每条格式：**编号｜文件:行｜症状｜根因｜修复建议**。P0→P3 排序。
> 每条均已实测或可静态复核；「实测」= 本次运行了只读探针。

### P0（静默错误结果 / 数据丢失 / 插件崩溃 / 安全漏洞）

**P0-1｜`host/tools.js:973-1103`（引用点 978/1017/1019/1028/1032）｜`studio_image action='inpaint'` 必然抛 `ReferenceError`**
- 症状：Agent 调用局部重绘 → 立即 `ReferenceError: validateInpaintRequest is not defined`，用户看到「工具执行失败」但无任何业务信息。**实测**：以最小 runtime 注册 14 个工具后 `execute({action:'inpaint',prompt:'test',sourceImage:...,maskImage:...})` → `THROW ReferenceError | validateInpaintRequest is not defined`。
- 根因：`tools.js:42-47` 的 import 只引入了 `INPAINT_DENOISE, runH3Inpaint, inpaintMeta`（来自 `h3-inpaint.js`）与 `prepareInpaint, inpaintSubmitSummary`（来自 `inpaint-task.js`，**且这两个根本没被使用**）；而分支体里用的是 `validateInpaintRequest / resolveInpaintSizes / maskMismatchMessage / resolveStrokePixels / resolveCropResolution`——它们分别在 `h3-inpaint.js:364/549/619` 与 `image-dims.js:104/125`，**一个都没 import**。这是「把编排下沉到 `inpaint-task.js` 之后没删干净旧分支」的残留：REST 侧（`index.js:1746-1755`）已经改用 `prepareInpaint()`，工具侧留了半截旧实现。
- 修复建议：删掉 `tools.js:972-1103` 整段旧实现，改成与 REST 完全同构的三行 —— `const prepared = await prepareInpaint(a→body 映射, cfg, { projectId }); await jobsStore().upsert(prepared.job); runJob(prepared.job, ...); return inpaintSubmitSummary(prepared, { forAgent: true });`。同时清掉 `tools.js:47` 的未使用 import 与 `tools.js:50` 的 `safeJoin` 未使用 import。

> **关于 `/edit/projects/:id` 的排除说明**：该族路由（`index.js:2424-2437`）表面上把 `:id` 原样传给 `ctx.edit.getProject`（`edit.js:513-517` 内部**不**调 `safeId`），初看像任意文件读。经全链路复核：`getProject → projectFile(id)`（`edit.js:68`）**调了** `safeId(id, EDIT_ID)`，非法 id 在拼路径时即抛 `INVALID_ID` → 400，**不构成读越权**。它的真实缺陷是「错误码语义不统一」，记 **P2-8**，不占 P0 名额。

**P0-2｜`host/api/index.js:1175-1180` + `host/security.js:230-248`｜`POST /assets/archive` 的 `allowSubdirs` 白名单可被**大小写/短路径/尾随点**绕过（Windows）**
- 症状：`allowSubdirs: ['outputs','assets','previz','post','tmp-inline','inputs']` 只比较 `relFinal.split(path.sep)[0]`。而 `resolveUserPath` 的 `realpathLoose`（`security.js:185-198`）对**不存在**的尾巴段原样拼回，不规范化 Windows 的「尾随点/空格剥离」「8.3 短名」。
  **实测**：`resolveUserPath({root: data, input:'outputs/a.png.'})` → 返回 `...\data\outputs\a.png.`（**不抛错**），顶层仍是 `outputs` 所以白名单放过；而 `fs.realpathSync(data+'\jobs.json.')` 在 NTFS 上是 **ENOENT**（本次实测），`data\jobs.json::$DATA` 则是**可读的**（实测 size=522869）。
  结论：**尾随点/ADS 在本机上不构成越界读**（NTFS 不做点剥离，ADS 只在末段生效），但白名单判定**只按字符串首段**这一点是真实的脆弱面：一旦以后 `allowSubdirs` 里出现嵌套路径（如 `edit/outputs`），首段比较就会失效。
- 根因：`security.js:258` 用 `relFinal.split(path.sep)[0]` 做**单段**比较，等于只支持「一级子目录」；且未对末段做 `path.normalize` 之外的 Windows 规范化。
- 修复建议：① `allowSubdirs` 比较改为「`relFinal` 必须等于某个允许目录或以 `dir + sep` 开头」；② 在 `resolveUserPath` 末尾显式拒绝含 `:`（ADS）与以 `.`/空格结尾的末段；③ `/assets/archive` 与 `/file` 共用同一个 `assertServable()`，避免两处口径漂移。

**P0-3｜`host/index.js:251-258` + `host/static.js:14-20`｜`GET /jiuzhang/assets/*.svg` 以 `image/svg+xml` **内联**返回 = 插件同源存储型 XSS（第三条 SVG 路径漏改）**
- 症状：`/file` 与 `/assets/item` **都**已对 `.svg` 强制 `Content-Disposition: attachment` + `nosniff`（`index.js:2209-2214`、`2295-2301`），两处注释都写明「SVG 是可执行文档，内联返回 = 同源存储型 XSS（X-JZ-Token 可通过 /token 拿到）」。但**第三条路径没有**：`host/index.js:251-258` 把 `/jiuzhang/assets` 前缀直接交给 `serveStatic({ baseDir: dataDir/assets })`，而 `static.js:20` 的 MIME 表里 `.svg → 'image/svg+xml'`，`serveStatic`（`static.js:174-194`）**既不设 `Content-Disposition` 也不设 `nosniff`**。
- 攻击链（全链路可静态验证）：`POST /assets/upload` 上传 `x.svg`（`asset-service.js:23` 的 `ALLOWED_EXT` **含 `.svg`**，`saveUploaded` 用它自己的 id 落盘到 `dataDir/assets/asset_xxx.svg`）→ `GET /jiuzhang/assets/asset_xxx.svg` → **200 `image/svg+xml` 内联** → 脚本在插件同源下执行 → 读 `/jiuzhang/api/token` 拿写令牌 → 打通全部写接口。
- 根因：`serveStatic` 是「通用静态」，没有继承 `/file` 与 `/assets/item` 的 SVG 处置策略；而 `index.js:255` 的 `baseDir` 恰好指向**用户可上传**的 `dataDir/assets`。
- 修复建议：① `serveStatic` 增加 `forceAttachment` 钩子（对 `.svg` 返回 `text/plain` + `attachment` + `nosniff`）；② 更彻底的做法是 `/jiuzhang/assets` 只服务 3D 模型白名单（`.glb/.gltf/.fbx/.obj`），其余 404 一一该前缀的注释（`index.js:245-250`）本来就说它只服务 3D 资产。
- 补充证据：`docs/audit/01-api-entry.md:483` 曾记「`/jiuzhang/assets/...` 就能读到 dataDir 之外」，说明这条路径历史上已被盯过一次；本次修的是「读越界」，**没修「SVG 内联」**。

> **关于 `/file` 白名单缺 `replace` 的说明**：**实测** `isServableDataPath` 对 `data/replace/x.mp4`、`data/runs/x.json`、`data/config.json` 均返回 `DENY`，对 `data/outputs/x.png`、`data/edit/outputs/a.mp4` 返回 `ALLOW` —— 白名单本身**没有读越权**。但缺 `'replace'` 导致换人成片 403，记 **P1-1**，不占 P0 名额。

---

### P1（功能失效 / 违反契约）

**P1-1｜`host/api/archive.js:111-124`（消费点 `index.js:2268`）｜换人成片 `/file` 必然 403**
- 症状：`ReplacementPage.tsx:1229-1240` 渲染 `<a href="/jiuzhang/api/file?path=replace%2Fjoined_xxx.mp4">`，后端 `isServableDataPath` 返回 false → 403 `FORBIDDEN_PATH`，页面显示「成片」链接但点开是 JSON 错误。
- 根因：`SERVABLE_DATA_DIRS` 缺 `'replace'`（`archive.js:111-124` 的注释只解释了为什么要加 `'edit'`，漏了 `'replace'`）。
- 修复建议：补 `'replace'`，并在 `replace.js:275-277` 的 `replace.json` 上加读取排除（或在 `/file` 里对 `*.json` 在 `replace/` 根层直接 403）。

**P1-2｜`host/tools.js:409`（对照 `index.js:851-852`）｜Agent 触发的生成丢掉全部提示词 lint 警告**
- 症状：同一条提示词，「页面点渲染」的 job 有 `warnings: ['提示词超长已按字段截断', ...]`，「让 AI 生成」的 job 没有。
- 根因：`tools.js:409` `prompt: compilePrompt(shotWithCards)` 未传第二个参数 `outWarnings`；REST 传了（`index.js:851-852`）。`compilePrompt` 签名见 `prompt-compile.js:23`，警告只在 `outWarnings` 为数组时才 push（`prompt-compile.js:133-135`）。
- 修复建议：工具侧改成 `const w=[]; const p=compilePrompt(shotWithCards,w); ...(w.length?{warnings:w}:{})`，与 REST 逐字一致。

**P1-3｜`host/tools.js:1158`（对照 `index.js:1660`）｜Agent 出的图不归档，没有 `archivedRel`/`assetId`**
- 症状：`studio_image action=generate` 返回 `note: '制品在 data/outputs 并自动归档进素材库'`（`tools.js:1179`），但实际走的是 `runJob`（`tools.js:1158`），**没有** `runAndArchive`；产物只在 `data/outputs`，素材库里查不到，`outputs[].archivedRel` 永远缺失。
- 根因：`tools.js:1158` 用 `runJob` 而非 `runAndArchive`。`inpaint-task.js:21-23` 的注释明确写着「REST 走 runAndArchive；Agent 走 runJob」—— 但那是针对 inpaint 的设计决定，`generate` 分支照抄了它，与自己的返回文案矛盾。
- 修复建议：`studio_image generate` 改用 `runAndArchive(job, ..., z)`（`z` 是 `getRuntime()`，含 `assets`）；若确实不想归档，就把 `tools.js:1179` 的 note 改掉。

**P1-4｜`host/tools.js:1119-1121`（对照 `index.js:1607-1614`）｜工具侧 LoRA 求解不探测磁盘 → 不存在的 LoRA 被静默接受**
- 症状：传一个 `models/loras/h3img/` 里不存在的 LoRA 名：REST 返回 `warnings: ['LoRA「x」未被使用：文件不存在']`（`index.js:1626-1628`），工具返回空 warnings 且 `loraStack` 里照写。
- 根因：`tools.js:1120` `solveImageLoraStack(req0.loras, { maxSlots, hasRefImages })` 未传 `availableFiles`；REST 在 `index.js:1606-1614` 先 `comfy.listModelFiles()` 再传。
- 修复建议：工具侧补同样的一次探测 + `availableFiles`；探测失败才降级（与 REST 的 `catch { /* 探测失败不误杀 */ }` 同语义）。

**P1-5｜`host/tools.js:1125-1130`（对照 `index.js:1621-1631`）｜工具侧 warnings 少两类（`replaced` / `degraded`）**
- 症状：同类单选 LoRA 被替换、强度被夹紧，REST 有两条 warning，工具一条都没有。
- 根因：见行号。`solvedLoras.replaced` 与 `.degraded` 在工具分支未被消费。
- 修复建议：把 `index.js:1623-1631` 的五个 for 循环抽成 `services/h3-image-lora.js` 的 `loraWarnings(solved)`，两处共用。

**P1-6｜`host/tools.js:133` 与 `host/api/index.js:145`｜`backends` 字段同名不同型**
- 症状：`GET /meta` 回 `backends: ['h3-nanfeng','h3-local','h3-image','mock']`（字符串数组）；`studio_meta` 回 `backends: { h3: {ok,detail,url} }`（对象）。任何「同一份 meta 缓存两入口」的客户端都会在 `.map` 上炸。
- 根因：两处独立演进，`tools.js:133` 把 `comfy.health()` 塞进了 `backends` 键，占用了 REST 的枚举语义。
- 修复建议：工具侧改名为 `health`，`backends` 保留枚举（与 `VALID_BACKENDS` 同源）。

**P1-7｜`host/tools.js:188-192`（对照 `index.js:796`）｜`studio_project update` 绕过 `allowedProjectPatch` 白名单**
- 症状：Agent 可以 `{action:'update', projectId, patch:{id:'other', createdAt:0, imagePool:{...}}}` 改掉项目主键与时间戳；REST 严格白名单（`projects.js:34-42`）。
- 根因：`tools.js:191` `projects.upsert({ ...p, ...(args.patch || {}) })` 直接展开，未过白名单。
- 修复建议：`import { allowedProjectPatch } from './api/projects.js'` 后 `{ ...p, ...allowedProjectPatch(args.patch||{}) }`。

**P1-8｜`host/tools.js:307-309`（对照 `index.js:1847-1855`）｜`studio_prompt action=meta` 缺「不指定画风」与 lightings**
- 症状：Agent 按 schema 拿 meta 选画风时，列表里没有 `{id:'none'}`，于是用画风 LoRA 时**必然**选一个内置画风串，与 LoRA 打架（`index.js:1838-1846` 的注释正是在讲这件事）。
- 根因：工具 `meta` 只回 `{styles: STYLE_PRESETS, modes, limits}`，未做 REST 那两处加工。
- 修复建议：两处共用同一函数 `promptMetaPayload()`，放 `api/prompt-compile.js` 导出。

**P1-9｜`host/tools.js:363-381`（对照 `index.js:876-879`）｜工具 schema 不接受 `accelPlan` / `steps`**
- 症状：Agent 想在单次调用里覆盖加速方案（用户常说「这次用低步数」）无法表达；REST 可以。
- 根因：schema `additionalProperties:false`（`tools.js:380`），没有这两个字段。
- 修复建议：补 `accelPlan: {type:'string'}`、`steps: {type:'number'}` 并写进 `job.params`（与 `index.js:876-879` 同形）。

**P1-10｜`host/tools.js:650` 与 `host/api/index.js:2369`｜`qc` 入参形状不一致（任务书已点名，确认成立）**
- 症状：REST 接受 `{path}` 或 `{input}`；工具 schema **只有 `input`**（`tools.js:621`），实现里 `rest.input ?? rest.path` 的 `path` 永远拿不到。Agent 传 `{op:'qc', path:'outputs/x.mp4'}` 会被 `additionalProperties:false` 直接拒（schema 校验层），或实现层报 `INPUT_REQUIRED`。
- 根因：两入口各写一份入参整形，`tools.js:649-653` 的注释还专门解释了历史坑，但没把 `path` 加进 schema。
- 修复建议：REST 侧统一成 `input`（保留 `path` 作为 deprecated 别名），schema 补 `path` 并标 `deprecated`。

**P1-11｜`host/tools.js:609`（对照 `index.js:1064-1070`）｜`studio_blender render` 丢 `timeoutMs` 且 `jobId` 取值不同**
- 症状：Agent 渲长镜头无法延长超时（固定 600000）；同一镜头从页面渲 vs 从 Agent 渲，落盘目录名不同（`previz/blender/<shotId>_xxx` vs `<shot.id>_xxx`），并发时可能互相踩不到但排障对不上。
- 根因：`tools.js:609` `renderControl({ mode, spec, jobId: String(a.shotId || 'shot') })` 未传 `cfg`（于是用 `loadConfig()` 默认）也未传 `timeoutMs`。
- 修复建议：补齐 `cfg: loadConfig()` 与 `timeoutMs`，`jobId` 改用 `a.shotId ?? shot.id`。

**P1-12｜`host/tools.js:741-751`（对照 `edit.ts:156-166`）｜`studio_edit audio` 的子操作键叫 `audioOp`，REST 叫 `op`**
- 症状：同一份前端 payload 直接喂给工具会失败；Agent 按 REST 文档写 `op:'strip'` 会被顶层 `op` 吃掉 → 走 `UNKNOWN_EDIT_OP`（`tools.js:768`）。
- 根因：工具 `op` 是**动作分发器**，服务层 `audio({op})` 也需要 `op`，命名冲突后用 `audioOp` 规避（`tools.js:735-741` 注释已承认）。
- 修复建议：服务层把 `audio` 的子操作改名 `audioOp`（或 `mode`），让两入口同名；工具侧不要自己造第二套命名。

**P1-13｜`host/tools.js:731`｜`studio_edit trim` 丢 `reencode`**
- 症状：工具无法强制重编码，只能吃服务的自动判断；`edit.ts:141` 的 REST 契约里有 `reencode`。
- 根因：`tools.js:731` 只挑三个字段。
- 修复建议：`{ input, startSec, endSec, reencode: a.reencode }`。

**P1-14｜`host/tools.js:1149` 与 `host/api/index.js:1631`｜批量 `batchId` 前缀同形但**来源不同**，前端无法区分「图批」与「续写批」**
- 症状：`/jobs?fields=list` 的 `params.batchId` 上，图像批是 `imgbatch_<t36>`（`tools.js:1131`/`index.js:1633`），续写批是 `batch_<...>`（`continuation.js`）。`ctx.extras.batchProgress`（`extras.js:496`）把**所有** job 一起算 `percent`，图像批与续写批混在一个百分比里。
- 根因：`batchProgress(jobs)` 无 `batchId` 分组，`index.js:2063-2065` 直接传全量 jobs。
- 修复建议：`batchProgress` 接受 `batchId` 过滤（`?batchId=`），或按 `params.batchId` 分组返回。

**P1-15｜`host/api/index.js:1784-1832` 与 `host/api/index.js:889-922`｜`/image/progress` 的 `params` 子集与 `/jobs?fields=list` 的 `outputs` 子集**不同构****
- 症状：`/jobs?fields=list` 的 `outputs[]` 只留 `{rel}`；`/image/progress` 的 `outputs[]` 留 `{rel,archivedRel,assetId,bytes}`。前端若把两处结果放进同一个列表渲染，`archivedRel` 时有时无。
- 根因：两份投影各自手写（`index.js:916-918` vs `1826-1828`）。
- 修复建议：抽 `projectJob(job, {level:'list'|'progress'|'full'})` 到 `services/job-store.js`。

**P1-16｜`host/api/index.js:2530-2557`｜`/replace/compile-prompt` 把**所有**异常都当 500**
- 症状：该 handler 自己 `try/catch` 并 `sendJson(res, 500, {error})`（`index.js:2555-2557`），绕过了顶层 `catch` 的 `CODE_STATUS` 映射。`NANFENG_CONSTRAINT`、`EMPTY_PROMPT`（`index.js:2534` 返回 400 但格式是 `error: 'EMPTY_PROMPT: 提示词为空'`，**错误码里带冒号+中文**，违反「error 是纯错误码」的契约）。
- 根因：本地 catch 早于全局映射。
- 修复建议：删掉本地 catch 让它冒泡；`EMPTY_PROMPT` 改成 `{error:'EMPTY_PROMPT', detail:'提示词为空'}`。

**P1-17｜`host/api/index.js:2636` 与 `host/api/index.js:115-119`｜404 的错误码是**动态字符串**，前端无法分支**
- 症状：未命中路由回 `{error: "UNKNOWN_ROUTE: POST /foo"}`。`client.ts:269` 把它当 `code` 传给 `ApiHttpError`，`describeError`（`client.ts:880`）原样显示整串 —— 尚可读，但 `code` 里永远不等于 `'UNKNOWN_ROUTE'`，任何 `if (e.code === 'UNKNOWN_ROUTE')` 都失效。
- 根因：错误码与消息混在一个字段。
- 修复建议：`{ error:'UNKNOWN_ROUTE', detail:'POST /foo' }`。

**P1-18｜`host/api/index.js:2657-2697`｜`CODE_STATUS` 只登记 32 个码，全仓实际抛出 80 个**
- 症状：**实测**扫描 `host/**/*.js` 的 `error:/throw/code` 得到 **80 个** distinct 码，其中 **66 个**不在 `CODE_STATUS` 里。落到 `index.js:2716-2720` 的兜底：`/_REQUIRED$/` → 400，其余 → **500**。
  具体受害者（全在 REST 可达路径上）：`FILE_TOO_LARGE`(h3-workshop.js:201) → 500（应为 413）、`ASSET_NOT_FOUND`(asset-service.js:164) → 500（应为 404）、`BLENDER_NOT_FOUND`/`BLEND_NOT_FOUND`/`BAD_BLEND_PATH`(blender-service.js) → 500（应为 404/400）、`NO_AUDIO_TRACK`(edit.js:407) → 500（应为 400）、`MASK_NOT_FOUND`/`SOURCE_NOT_FOUND`(inpaint-task.js:75-78) → 500（应为 404）、`INPUT_REQUIRED`(tools.js 可达但 REST 不抛) 等。
- 根因：`CODE_STATUS` 是手写白名单，新增错误码时没人回来登记；`statusFor` 的 message 回退（`index.js:2712-2714`）只能救「message 以大写码开头」的形态（`throw new Error('EDIT_NOT_FOUND')`），救不了 `e.code` 设了但 message 是中文的那些。
- 修复建议：把状态码挂到**抛错处**（`fail(code, msg)` 统一带 `status`），`CODE_STATUS` 只做兜底；或至少补登 66 个里的高频项（上列 8 个）。

**P1-19｜`host/api/index.js:155-157` 与 `host/api/events.js:49-73`｜SSE 客户端断开后 `clients` 会残留**
- 症状：连接被代理/浏览器静默掐断时，`req.on('close')` 与 `res.on('close')` 都会触发 `cleanup`（`events.js:69-72`），**静态上看是完整的**。但 `broadcast` 里 `c.res.write()` 在 Node 中对已关闭的响应**不抛错**（返回 false / 触发 `error` 事件），`events.js:88-91` 的 `catch { clients.delete(c) }` 只在**同步抛错**时生效 → 死连接会一直留在 Set 里，`clientCount()`（`index.js:630`）虚高，`emit` 每次白写。
- 根因：用 `try/catch` 判连接存活，而不是用 `res.writableEnded` / `destroyed` 或监听 `error` + 删除。
- 修复建议：`broadcast` 循环里先 `if (c.res.writableEnded || c.res.destroyed) { clients.delete(c); continue; }`；`write()` 返回值 false 时记 `drain` 或直接判死。
- 附：**`clientCount` 的唯一消费点是 `GET /health` 的 `events.clients`（`index.js:630`）**，而前端从不读该字段（`client.ts` 无对应类型）—— 即「最坏情况下永远为 0 的指标」。`emit` 在无客户端时返回 0（`events.js:81-94`），行为正确（不抛、不阻塞）。

**P1-20｜`host/api/index.js:344-483`｜向**同一条 URI** `POST /nanfeng/continuation/batches/run` 提交两次会双跑（409 只在 `status==='running'` 时拦）**
- 症状：第一次提交后 `runBatch` 立即把 `batch.status='running'` 并 `saveBatch`（`continuation.js:537-538`），但那是**异步**的 —— `index.js:482` 的 `202` 返回**早于** `b0.status` 被写回磁盘。第二次提交若落在「第一次的 `runBatch` 还没执行到 `saveBatch`」的窗口里，`b0.status` 仍是 `draft` → 通过 409 检查 → **两套 `runBatch` 并发跑同一个批次**，两个 job 抢同一段 latent 文件。
- 根因：`index.js:350` 用**磁盘上的** `status` 做幂等判据，而不是内存里的 in-flight 集合。`comfy-control.js` 的 `withLock` 就是为解决同类问题写的（`index.js:653/660/677` 都用了），这条路由**没用**。
- 修复建议：加一个模块级 `const runningBatches = new Set()`，进入时 `if (runningBatches.has(batchId)) return 409`，`finally` 里删；或用现成的 `comfyControl.withLock` 键控锁。

**P1-21｜`host/api/index.js:440-469`｜续写批次的段等待用 `setInterval(2000)` 轮询 + 60 分钟硬超时，与 `runJob` 的真实终态可能**永久错位****
- 症状：`finish()` 只在三种终态或 1h 超时触发；但 `runAndArchive(...)`（`index.js:417-425`）的返回 Promise **被 `.catch` 吞掉**（`index.js:421-425` 只 `logger.warn`）。若 `runAndArchive` 自身 reject（例如 `runJob` 里 `jobStore().upsert` 抛），job 可能永远停在 `running` → 段等待挂满 1 小时才失败，期间整个批次函数不 resolve，用户看到「卡住但无报错」。
- 根因：等待逻辑只看 `jobsStore().get()` 的状态，不看 `runAndArchive` 的 Promise。两条并行路径（轮询 vs Promise）没有 join。
- 修复建议：`const done = runAndArchive(...)`，`await Promise.race([done, pollToTerminal(job.id)])`，任一先完成即收尾；`done` 的 catch 里显式把 job 标 failed。

**P1-22｜`host/api/index.js:886`、`970`、`1437`、`1684`、`1779` 与 `host/tools.js:457`、`543`、`1084`、`1165`｜9 处 `.catch(() => {})` 吞掉整个生成失败的证据**
- 症状：`runAndArchive(...).catch(() => {})` —— `runJob` 内部已把失败写进 job（`job-runner.js:197-210`），所以**任务状态是对的**；但**抛在 `runJob` 之外**的错误（`runAndArchive` 的归档循环、`ctx.assets.archiveFile` 抛、`pruneJobs` 之外的东西）完全无日志。实测排查时只能看到「job 是 completed 但素材库没有」。
- 根因：`archive.js:62` 已经 `catch` 了归档整体失败；外层再 `.catch(()=>{})` 是**第三次**兜底，把前两次漏掉的也吞了。
- 修复建议：至少 `catch((e)=>ctx.logger?.warn?.(...))`，与 `index.js:421-425` 的写法对齐（那里**是对的**，可作为模板）。

---

### P2（可维护性：耦合 / 重复 / 补丁注释 / 死代码）

**P2-1｜`host/api/index.js` 全文件｜9 个「逐字迁出」模块只迁走了纯函数，业务编排全部留在 2819 行的单函数里**
- 证据：每个拆出文件头都写着「从 api/index.js 逐字迁出（原 NNNN 行）」（`http.js:4`、`shots.js:4`、`prompt-compile.js:4`、`projects.js:4`、`monitor.js:4`、`replace-tasks.js:4`、`archive.js:4`）。而 §二 表里「含业务=是」的 handler 仍有 **34 个**，其中 5 段超过 90 行。
- 具体「业务混进路由」的行段：
  `L344-483`（208 行，续写批次编排；`newJob`/`runAndArchive`/`setInterval`/`finally` 全在 handler 里）、
  `L517-608`（92 行，分镜生成）、`L1147-1193`（47 行，归档）、`L1198-1218`+`L1224-1283`（render plan/compile，**两段近乎逐字重复**）、
  `L1328-1448`（120 行，立绘拆解）、`L1555-1704`（149 行，出图）、`L1997-2025`（28 行，previz 统计）、
  `L2131-2196`（64 行，上传）、`L2448-2474`（26 行，replace meta）。
- 修复建议见 §五。

**P2-2｜`host/api/index.js:1198-1218` 与 `1224-1243`｜`/render/plan` 与 `/render/compile` 的 plan 段**逐字重复 20 行**
- 证据：两段的 `cardIds → cards → resolveMediaRefs → buildRenderPlan({... vram: await comfy.vramStatus(cfg)})` 完全一致（仅缩进一处 `mode:` 少两个空格，`L1211` vs `L1237`）。
- 修复建议：抽 `async function computeRenderPlan(body, ctx, cfg)`。

**P2-3｜`host/tools.js:159-165`｜`studio_config` 的 action 非法值静默走 set**
- 证据：`if (args.action === 'get') return ...;` 之后**无 else**，`action:'GET'`/`'foo'` 都会执行 `saveConfig(sanitizeConfigPatch(args.patch||{}))`（空 patch 也是一次写盘 + `notifyConfigChange`）。
- 修复建议：`if (args.action === 'set') {...} throw new Error('UNKNOWN_ACTION')`。

**P2-4｜`host/api/index.js:2567-2580` 与 `host/api/replace-tasks.js:75-85`｜`/replace/plan` 与 `createReplaceTask` 对 `continuation` 的默认值不同**
- 证据：`/replace/plan` 用 `String(body.contextLength ?? R.REPLACE_DEFAULTS.contextLength)`，`createReplaceTask` 用 `String(body.contextLength ?? R.REPLACE_DEFAULTS.contextLength)` —— 看起来一样；但 `/replace/plan` 把 `segmentCount` 传进 `planSourceSegments`，`createReplaceTask:84` 也传 —— **真正的不一致在**：`/replace/plan` 的 `segmentSec` 用 `Number(body.segmentSec) || undefined`，`createReplaceTask:81` 同；差异在 `task.segmentSec`（`replace-tasks.js:97`）回落 `R.REPLACE_DEFAULTS.segmentSec`，而 plan 里是 `undefined` → 预览的分段与实际建任务的分段可能不同（当 `segmentSec` 未给且 `REPLACE_DEFAULTS.segmentSec` 非 plan 内部默认时）。
- 修复建议：两处共用同一个 `normalizeReplacePlanInput(body)`。

**P2-5｜`host/tools.js:198-200` 与 `host/api/index.js:807-809`｜项目删除的**顺序相反**
- 证据：REST 先 `cleanupProjectArtifacts(cfg, id)` 再 `projects.remove(id)`；工具先 `projects.remove(pid)` 再 `cleanupProjectArtifacts(...)`。后者在 cleanup 抛错时**项目记录已删、磁盘残留**，且返回值里 `cleaned` 是失败对象但 `removed` 已生效。
- 修复建议：统一成 REST 的顺序（先清产物、后删记录）—— 或反过来，但两处必须一致。

**P2-6｜`host/tools.js:306-352`｜`studio_prompt` 的「无 action」与「fromShot」共用一段代码，返回结构却不一致**
- 证据：`a.action === 'fromShot'` 与 `!a.action` 走同一段（`tools.js:314-351`），返回值里 `resolution/h3Length` 只在有 `shot.profile/ratio/durationSec` 时有意义，`prompt: compiled.prompt || compilePrompt(prepared)` 这一行（`tools.js:345`）**多一次编译**（编译失败时会退回，但成功时白算一次）。
- 修复建议：拆成两个分支，或在 `fromShot` 分支里去掉 `compilePrompt` 兜底。

**P2-7｜`host/api/index.js` 的重复 handler 族｜`/post/*` 8 条一模一样、`/image/lora/catalog` 与 `/lora/catalog` 60 行近乎重复**
- 证据：`L2328-2366` 的 8 个 handler 除了服务方法名外逐字相同；`L704-731` 与 `L1497-1523` 的探测 + `catalogLoras`/`catalogImageLoras` + `byCategory` 聚合逻辑同构（只差 `IMAGE_LORA_ROOT` 与 hint）。
- 修复建议：`const POST_OPS = ['transcode',...]` 循环注册；LoRA 目录抽 `loraCatalogPayload(cfg, kind)`。

**P2-8｜`host/services/edit.js:513-517`｜`getProject` 不走 `safeId`，错误码 `INVALID_ID` 与 `EDIT_NOT_FOUND` 在 HTTP 层不可区分**
- 证据：`getProject(id)` 直接 `fs.existsSync(projectFile(id))`，非法 id 会在 `projectFile` 内抛 `INVALID_ID`（→400），合法但不存在的 id 抛 `EDIT_NOT_FOUND`（→404）。同一资源两种 4xx，前端只能显示「ID 非法」而实际是「没有这个工程」时也是这条。
- 修复建议：`getProject` 先 `safeId(id, EDIT_ID)` 并统一抛 `EDIT_NOT_FOUND`。

**P2-9｜`host/api/index.js:56-59`｜re-export 块是**纯补丁**，且注释与事实不符**
- 证据：
  L56 `// re-export：host/tools.js:11 从 './api/index.js' import 的符号保持不变`，
  L58 `// 原文 2809 行就有的转发（保持既有调用点的 import 路径不变）`。
  实际情况：① `tools.js:11` 只 import 了 `compilePrompt, listShots, upsertShot, writeShots, cleanupProjectArtifacts, deriveSubjectsFromShot` —— 全都能直接 `from './api/shots.js'` / `'./api/prompt-compile.js'`；② **L59 那行（`withVaultCards, resolveMediaRefs, writeBackProbe, resolvePictureIndices`）全仓库零消费者**（实测 grep：`writeBackProbe` 在 `app-src`/`skills`/`tools` 里 **0** 命中；`withVaultCards`/`resolvePictureIndices` 的消费者 `tools.js:12` 与 `prompt-compile.js:12` 都直接从 `services/shot-context.js` import）；③ 「原文 2809 行」这个数字在当前文件里对应的是 `executeBackend` 的 `throw`（`index.js:2804-2807`），与 re-export 无关 —— 注释里的行号已经漂移。
- 修复建议：删掉 L56-L59 两行 export；`tools.js:11` 改三个 import 源（`./api/shots.js`、`./api/prompt-compile.js`）。这条是**死代码 + 误导性注释**，属任务书第 12 条点名的「补丁残留」。

**P2-10｜`host/api/index.js:12` `dirs` 未使用；`host/tools.js:47` `prepareInpaint/inpaintSubmitSummary` 未使用；`host/tools.js:50` `safeJoin` 未使用**
- 证据：**实测**（剥注释后扫描）`host/api/index.js` 未使用 named import `dirs`；`host/tools.js` 未使用 `prepareInpaint`、`inpaintSubmitSummary`、`safeJoin`（`safeJoin` 只在注释 `tools.js:1233/1240` 里出现）。`dirs` 在 `index.js:2812-2813` 只出现在注释里。
- 修复建议：删除。

**P2-11｜`host/api/index.js:507`｜`_schemaUnused: Boolean(m)` 是**假字段**，且它的动态 import 只为这一个布尔**
- 证据：`const m = await import('../bridge/index.js').then(B => B.nanfengSchema).catch(() => null);` 然后 `_schemaUnused: Boolean(m)` —— `nanfengSchema` 必然存在（`bridge/index.js` 门面固定导出），所以该字段**恒为 true**；下划线前缀表示"临时"，但已进对外契约（`client.ts:823-827` 的返回类型里没有它，所以前端也没用）。
- 修复建议：删除 `L502` 与 `L507`。

**P2-12｜`host/api/index.js:1002-1004`｜已删模块留下的**空标题注释**
- 证据：`/* 剧本 / 漫画 / 模特三个模块已整体删除（2.0.0）。原路由与空壳服务不再保留，这里不写占位注释 —— 空标题会让人以为功能只是没接上。 */` 紧接着 `/* ---------------- 漫画出图 ---------------- */`（L1004）—— **自己刚说完"不写占位注释"，下一行就是一个空标题**。同类还有 `L772` 前无内容、`L846` 前无内容（`/* ---------------------------------------------------------- 剧本 */` 在 `tools.js:772`，后跟空段）。
- 修复建议：删 L1004（以及 `tools.js:772-777` 的三个空标题）。

**P2-13｜`host/tools.js:52-54` `ok()` 函数未被使用**
- 证据：`function ok(value) { return { value, content: [...] } }`（`tools.js:52-54`），全文件无调用（`tool()` 工厂内部自己构造 `{value, content}`，`tools.js:88-91`）。
- 修复建议：删除。

**P2-14｜`host/tools.js:855-858`｜`imageWorkflow()` 定义在 `registerTools` 的中间（第 855 行，夹在两个 `reg(tool(...))` 之间），函数声明提升掩盖了阅读顺序**
- 证据：`studio_toolbox` 的定义在 `L779-853`，`studio_image` 在 `L861-1182`，而 `imageWorkflow` 在 `L856-858` 两者之间。
- 修复建议：移到 `registerTools` 顶部（与 `retryJobById`/`runGenerationFor` 一起）。

**P2-15｜`host/tools.js:1186-1297`｜`studio_storyboard` **不用** `bridge` 门面，直接 `await import('./bridge/llm/...')`**
- 证据：`tools.js:1211-1212` 两条相对路径深 import；而 `index.js:500-501` 同功能走 `(await import('../bridge/index.js')).storyboard/llm`。`docs/audit` 的 M4 边界明写「业务层只 import bridge/index.js」。
- 修复建议：改走门面（`smoke-api.mjs:3551` 的「桥接层：业务层只走门面」守卫竟然没抓到，因为守卫只扫 `host/services/`，没扫 `host/tools.js` —— 这条**同时说明守卫有盲区**）。

**P2-16｜`host/api/index.js:106-130`｜每次请求都 `loadConfig()` + `route.startsWith('/canvas-agent')` 时 `loadCanvasPermissions(cfg)`（同步读盘）**
- 证据：`L125 const cfg = loadConfig();`（有缓存，开销小）、`L129 if (route.startsWith('/canvas-agent')) loadCanvasPermissions(cfg);` → `canvas-agent.js:118-128` 每次都 `fs.readFileSync` + `JSON.parse`（**无缓存**）。
- 影响：`/canvas-agent/*` 每个请求多一次同步读盘；`App.tsx` 不轮询它，所以可接受，但属「路由层做 I/O」。
- 修复建议：在 `canvas-agent.js` 里加「文件 mtime 缓存」。

**P2-17｜`host/api/index.js:1997-2025`｜`/resources/previz` 在 handler 里用 `fs.readdirSync` + 递归 `walk` 同步遍历整个 previz 目录树**
- 证据：`L2001`、`L2008-2013`、`L2011` 的 `fs.statSync`。实测 `data/previz` 下 5 次渲染 = 452 文件（代码注释 `L1993-1996` 自己写的），同步递归会阻塞事件循环数十毫秒到数百毫秒；该目录无上限。
- 修复建议：下沉到 `blender-service.js` 的 `previzUsage()`，并改 `fs.promises`。

**P2-18｜`host/api/index.js:2063-2065`｜`/jobs/batch-progress` 每次全量 `jobs().list()`（实测 522 KB / 108 条，读+解析 1.4 ms）**
- 证据：**实测** `data/jobs.json` = 522869 字节、108 条、`readFileSync+JSON.parse` 平均 **1.41 ms**。这本身不慢，但它与 `/jobs`、`/monitor`、`/jobs?fields=list` 是**四次独立的全量读**，且 `monitorPayload`（`monitor.js:16`）里也读一次 —— 同一请求链里可能读 2-3 次。
- 修复建议：`job-store` 加进程内缓存（按 mtime 失效）。

**P2-19｜`host/api/index.js:182-225` 与 `host/api/index.js:344-483` 等｜**动态 `import()` 在热路径**上反复执行**
- 证据：`L166/186/219/241/261/269/294/325/346/500/501/526`（南风/sse 之外的每个 handler）都写 `(await import('../bridge/index.js')).xxx`。ESM 的 module registry 有缓存，**性能没问题**，但代价是：① 静态分析工具（含 `check-routes.mjs`）看不到这些依赖；② 每个 handler 多 6 个 token 的噪音；③ 与 `index.js:8-54` 已经静态 import 了同样的模块并存 —— 同一个 `bridge/index.js` 既静态 import（L21）又动态 import（L166...），两种取法混用。
- 修复建议：统一静态 import（`bridge/index.js` 已在 L21 引过，直接解构即可）。

**P2-20｜`host/api/index.js:610-632`｜`/health` 一次做 5 件事（comfy 探活 + blender 探测 + 2 个工作流诊断 + 配置读）**
- 证据：`L611 await comfy.health(cfg)`（内部 `resolveComfyUrl` 会顺序试 9 个候选地址，每个 1200 ms 超时，`comfy-client.js:146-157`；全部失败时最坏 **~10.8 s**）、`L613-614 workflowDiagnostics ×2`（同步 `fs.existsSync` 多次）、`L618 blenderStatus()`（同步扫 `tools/` 目录 + `fs.existsSync`）。
- 影响：`/health` 是前端 `App.tsx` 首屏 + `SettingsPage` 会调的接口；ComfyUI 未启动时**单次请求最坏 10s+**，而 `client.ts:164` 的默认超时是 **30s**（`/health` 不在 `LONG_TIMEOUT_PATHS` 里）—— 不超时但会挂 10s，`App.tsx` 首屏的 `Promise.all` 会被它拖住（`App.tsx:411-416` 没有 timeout）。
- 修复建议：`/health` 的 comfy 探活改成 `comfy.healthCached()`（带 TTL，`comfy-client.js` 已有 `PROBE_CACHE`，但 `health()` 不走它）；或把 `/health` 拆成 `/health/fast` 与 `/health/probe`。

**P2-21｜`host/api/index.js:132-134` + `host/api/monitor.js:14-29`｜`/monitor` 的「最坏 10s+」是**真实存在**的，且在并发下会放大**
- 证据：`monitorPayload` 调 `comfy.health(cfg)`（`comfy-client.js:185-194` → `resolveComfyUrl` 9 候选 × 1200 ms = 最坏 10.8 s），**无缓存**（`PROBE_CACHE` 只在成功时写，`comfy-client.js:158-163` 失败**故意不缓存**）。而 `App.tsx:424` 每 **2000 ms** 打一次 `/monitor`（`setInterval`），`store/ui.ts:60` 有 `monitorLoading` 去重（**单端去重**），但 client.js 那条（`client.js:201-222`）是另一份 UI，也用 3 s 轮询。
- 并发下：每 2 s 一次 × 最坏 10.8 s = **最多 5 个并发 `/monitor` 挂在 `resolveComfyUrl` 上**。它们**不阻塞事件循环**（`fetch` 是异步的，`AbortSignal.timeout` 也是异步的），但会占住 `webServer` 的 handler 槽位与 socket；DSH 的 `webServer` 是否会因此拒绝其它请求，取决于 `@deepseek-ai/dsh-web-server` 的实现（**本次未读该包，不下结论**）。
- **结论（P2，非 P0）**：`/monitor` 是**异步阻塞**（await fetch），不是同步阻塞；`fs.statfsSync`（`monitor.js:33`）与 `jobs().list()`（同步读盘 1.4 ms）是**同步**的，但耗时可忽略。真正的风险是「ComfyUI 未启动时，每个前端标签页每 2 s 制造一个 10 s 的探测」，属**放大器**而非崩溃点。
- 修复建议：`monitorPayload` 里改用带 TTL 的 `comfy.healthCached()`（失败也缓存 5-10 s，与 `resolveComfyUrl` 的「失败不缓存」策略分开）；`App.tsx:424` 的 2 s 轮询改 5 s（与 `client.js` 的 3 s 也不一致，顺便统一）。

**P2-22｜`host/security.js:112-113`｜令牌比较「长度不等直接 return false」不是恒定时间**
- 证据：`if (ba.length !== bb.length) return false;` —— 长度本身会泄露（攻击者可二分出令牌长度）。`timingSafeEqual` 只在长度相等时调用。
- 影响：令牌是 24 字节 base64url（`security.js:13`）→ 长度固定 32 字符，**泄露的信息为零**（长度恒定）。且攻击者需先通过 `isLoopbackHost` + `isSameOrigin`。
- **结论：不构成漏洞**（P3 级：代码形态不理想，但当前参数下无信息泄露）。修复建议：`tokenEquals` 改成对两侧做 `sha256` 后再 `timingSafeEqual`（长度恒为 32），这是标准做法。
- 附：令牌**不会进日志** —— 实测 grep `WRITE_TOKEN`/`getWriteToken` 的消费者只有 `index.js:119`（`/token` 响应体）与 `security.js:102`（比较），无 `console.log`/`logger` 调用。

**P2-23｜`host/static.js:213-216`｜SPA 的 301 补斜杠会丢掉 hash 之外的**所有**原始查询串格式**
- 证据：`res.writeHead(301, { Location: `${pathname}/${url.search}` })` —— `url.search` 已含 `?`，拼接正确。但 `!path.extname(pathname)` 的判据把 `/jiuzhang/app/foo.bar` 当成"有扩展名"→ 不补斜杠 → 回退 `serveStatic`；而 SPA 是 hash 路由（`static.js:8-9` 注释），`/foo.bar` 这类路径本不该存在。
- **实害**：`/jiuzhang/app` → 301 → `/jiuzhang/app/`（正确）；但 `/jiuzhang/app/index.html` 也会被 `!extname` 排除，走 `wantsIndex` 分支（`L225`）→ 正常。**没有路径穿越**：`serveStatic` 的 `isInside`（`L45-50`）用 `path.resolve` + `startsWith(base+sep)`，`decodeURIComponent` 抛错已 catch（`L111-116`）。
- **结论：301/ETag/Range 三处均无穿越**。ETag 用 `W/"size-mtime"`（`L155`），`isIndex` 时不发 ETag（`L178`）也无 `304`（`L158` 排除）—— 正确。Range 的 `parseRange`（`L52-73`）与 `http.js:152-168` **是两份实现**（见 P2-24）。
- 修复建议：抽出共用 `parseRangeHeader`（`http.js` 已有），删 `static.js:52-73`。

**P2-24｜`host/api/http.js:152-168` 与 `host/static.js:52-73`｜Range 解析**两份实现**，行为一致但漂移风险**
- 证据：**实测** `http.js` 的 `parseRangeHeader` 对 12 组边界（`bytes=0-999`/`bytes=999-`/`bytes=1000-`/`bytes=-0`/`bytes=-2000`/`bytes=5-2`/`bytes=abc`/`bytes=0-1,3-4`/`bytes=-1` 等）结果：越界 `start>=size` → `{invalid:true}`（416）；`end` 超界被 `Math.min` 夹到 `size-1`；后缀 `-2000` 夹成 `0-999`；多段 `0-1,3-4` 返回 `null`（忽略 Range，回 200 全量 —— **RFC 允许**）。**无越界读**。
- 修复建议：`static.js` 直接 `import { parseRangeHeader } from './api/http.js'`（但要小心 `http.js` 的 `pipeStream` 语义差异：`static.js:76` 的 `pipeFile` 会先 `fs.statSync` 再 `createReadStream`，两者都监听 error，可合并）。

**P2-25｜`host/api/index.js:2254-2325` 与 `2197-2240`｜`/file` 与 `/assets/item` 的 Range/SVG/HEAD 处理是**两份 40 行同构代码**，但 `Cache-Control` 不一致**
- 证据：`/assets/item` 用 `no-store`（`L2225/2232`），`/file` 用 `no-cache`（`L2313/2320`）；两者 SVG 处置一致（强制 attachment + nosniff）。`outputUrl`（`url.ts:32-44`）与 `assetUrl`（`url.ts:52-54`）分别走这两条。
- 影响：同一个文件经两条路径拿到不同缓存语义；`/file` 的 `no-cache` 会让浏览器存副本（对生成产物是**期望**的，对不停被覆盖的 `outputs/` 是**不期望**的 —— 同名文件会被旧缓存命中）。
- 修复建议：抽 `serveBinary(req,res,abs,{cacheControl, forceAttachment})`，两处共用。

**P2-26｜`host/api/index.js:92-95` `accelPlanList()` 与 `L202-211`｜同一份加速方案投影写了**两遍**（字段名还不同：`shiftVideo/shiftAudio` vs `video/audio`）**
- 证据：`accelPlanList()`（`L71-96`）回 `shift: {video, audio}`；`/nanfeng/presets` 里（`L202-211`）回 `shift: '${shiftVideo}/${shiftAudio}'`（字符串）与 `lora`。
- 修复建议：`accelPlanList({ includeLora: true })` 一个参数化函数。

**P2-27｜`host/api/index.js:2712` `msgCode` 正则 `^([A-Z][A-Z0-9_]{2,})` 会把中文开头的 message 误判**
- 证据：`throw new Error('提示词不能为空')` 这类中文 message 匹配不到，落 500；而 `validateImageRequest` 抛的 `PROMPT_REQUIRED: 提示词不能为空` 能匹配。同一类用户错误，两条路不同状态码。
- 修复建议：见 P1-18。

**P2-28｜`host/api/index.js:2626` `void runReplaceBatch(...)` 是全仓唯一的 `void x` 消警告写法**
- 证据：grep `\bvoid ` 在 `host/**` 只有这一处。虽合理（明确「不 await」），但与其它 8 处 `.catch(()=>{})` 的写法不一致。
- 修复建议：统一成一种（推荐 `.catch(logger.warn)`）。

**P2-29｜`host/api/index.js:2097` 接受 PUT，但 `security.js:86` 的 `WRITE_METHODS` 含 PATCH 而这条路由**不**接受 PATCH**
- 证据：`(POST || PUT)` vs 全局 `{POST,PUT,PATCH,DELETE}`。`client.ts:494-495` 只发 POST。PATCH 请求会落到 `L2636` 的 404（但要先过 token）。
- 修复建议：要么接受 PATCH（语义上更正确），要么在 `security.js` 注释里说明「接受 PUT 是历史兼容」。

**P2-30｜`host/tools.js:844`｜`batchProgress` 只接受 `list`，但 schema 的 `action` 枚举有 6 个值**
- 证据：`if (a.action !== 'list') throw new Error(\`UNKNOWN_ACTION: batchProgress 只支持 list...\`)`（`L843-845`）。这是**正确**的防御（注释也解释了），但 schema 无法表达"域×动作"的合法组合 → Agent 只能靠试错。
- 修复建议：schema 改 `oneOf`（7 个域各一组），或拆成 7 个工具（`studio_toolbox_templates` 等）。

---

### P3（文档与代码不符）

**P3-1｜`docs/audit-v4/00-framework.md:14`｜「106 精确 + 5 参数化 + 2 前缀族」与代码不符**
- 证据：本次实测 **114 精确 + 3 OR 合并（6 个 method×path）+ 5 正则 + 5 startsWith（4 个前缀）**。
- 修复建议：改为「114 精确语句（含 3 条 OR 合并，展开 6 个 method×path）+ 5 正则 + 4 前缀族」。

**P3-2｜`host/api/events.js:26-32`｜SSE 协议文档列了 5 种事件，实际只发 3 种**
- 证据：文档写 `shot-updated` / `job-progress` / `batch-progress` / `config-updated` / `ping`。实测 grep：`job-progress` 在 `host/**` **零发射点**（只有 `events.js:29` 的注释、`README.md:288`、`skills/architecture/SKILL.md:201`）；`config-updated` 同样零发射（`saveConfig` 在 `config.js:248` 只 `notifyConfigChange`，不 `emit`）。实际发射的只有 `shot-updated`（`shots.js:161`）、`batch-progress`（`index.js:305/369/403/478`）、`replace-progress`（`index.js:2629`）、`ping`（`events.js:104`）、`hello`（`events.js:59`）。
- 附带：文档**没有**列 `replace-progress`，而它是真实在用的（`ReplacementPage` 靠轮询 `replaceGet`，`events.ts:52` 类型里有但无订阅者）。
- 修复建议：删掉 `job-progress`/`config-updated` 两行，补 `replace-progress`。

**P3-3｜`tools/check-routes.mjs:201`｜自报「后端路由 160 条」是虚高**
- 证据：脚本 L187-192 把每条正则按 **5 个 method** 展开、L194-198 把每个 `startsWith` 也按 5 个 method 展开。实际 `index.js` 里正则路由的内部分支只支持 1-3 个 method（如 `L947` 的 `(cancel|retry)` 只 POST）。
- 影响：`deadRoutes` 统计（L226-241）用了这个虚高集合，报「89 条死路由」，实际可调用且无消费者的路由约 **39 条**（本次实测：87 个可调用路由中 48 个被前端直接调用）。
- 修复建议：展开前先取该 `match` 块内的实际 `req.method` 集合。

**P3-4｜`tools/check-routes.mjs` 的 A 类检验（前端调用了但后端没有）**检出率为 0，但它自己说有 3 个致命缺陷（L111-127 的注释）**
- 证据：本次运行 `node tools/check-routes.mjs` → **exit 0，「✅ 三方路由完全一致」**。但 §三 已列出 8 个工具与 REST 的偏差、且 `client.ts` 有 33 个**从未被调用**的 api 函数（实测）—— 脚本只比「前端有没有调后端没有的」，不比「后端有没有前端不用的」（B 类只 `notes.push` 不 `problems.push`，`L242-245`）。
- 修复建议：B 类改成 `problems`（至少对 `method+path` 精确匹配的死路由报 warning 级），并加一条「`tools.js` 里 `import ... from './api/index.js'` 的符号必须存在于 `api/index.js` 导出」。

**P3-5｜`host/tools.js:262` 与 `host/tools.js:4`｜「原有两个 studio_prompt」的合并痕迹仍在**
- 证据：`tools.js:259-263` 的注释解释「原有两个 `studio_prompt`：早期这个简化版先注册，后面功能完整的六段式编译器被幂等逻辑静默跳过」。当前只有**一个** `reg(tool('studio_prompt',...))`（`L264`），`registered` 集合的 `DUPLICATE_TOOL` 防御（`L109-116`）现在是死防御（14 个名字各注册一次，实测）。
- 影响：P3（注释是历史记录，但 `reg()` 的抛错分支永不触发 → 死代码）。
- 修复建议：保留注释（有价值），但把 `DUPLICATE_TOOL` 的抛错改成 `ctx.logger?.warn` + 返回 `null`（免得将来真的重名时整个 `registerTools` 失败、14 个工具全没 —— 这正是注释里描述的历史故障）。

**P3-6｜`host/tools.js:359-362`｜`studio_generate` 的描述列了 7 个 preset，但 schema 的 `preset` 是**自由字符串**（无 enum）**
- 证据：描述写「draft / standard / quality / quality-preview / continuation / continuation-quality / low-vram」，schema `preset: { type:'string' }`（`L371`）。**实测** `presets.builtinPreset('P12-draft')` → `UNKNOWN_PRESET` 抛错；但该抛错发生在 `runH3Nanfeng` 的**执行期**（job 已建好、状态 queued），用户看到的是「任务失败」而不是「参数错误」。
- 修复建议：`preset` 加 `enum`（从 `listBuiltinPresets()` 生成），或工具入口先 `builtinPreset(args.preset)` 校验一次。

**P3-7｜`host/security.js:27-40` 的 `isSameOrigin` 注释说「带 Origin 的请求若携带 `Sec-Fetch-Site: cross-site` 直接拒绝」，实际顺序是先比 host 再判 protocol，`Sec-Fetch-Site` 在 host 校验**之前**
- 证据：`L36` 的 `sec-fetch-site` 检查在 `L38` 的 `parsed.host !== host` 之前 —— 与注释的叙述顺序相反（行为等价，但读代码的人会以为先比 host）。
- 修复建议：注释里调换顺序，或把 `sec-fetch-site` 检查移到函数最前（它在 `!origin` 早退之后）。

**P3-8｜`host/api/index.js:927-931` 与 `L939`｜注释说「正则只匹配 `job_[A-Za-z0-9]+`」，实际正则是 `([^/]+)` 后在 `safeId` 里才套 `job_`**
- 证据：`L933 const mj = ... route.match(/^\/jobs\/([^/]+)$/)`（**任意**非斜杠），`L940 safeId(..., /^job_[A-Za-z0-9]+$/)`。注释（`L930`）说「正则只匹配 job_...」是错的 —— 真正的过滤在 `safeId`。
- 影响：P3；但也解释了为什么要 `mj[1] !== 'batch-progress'` 特判（`L939`）—— 如果正则真的只匹配 `job_`，这行特判就是多余的。**两处注释互相矛盾**。
- 修复建议：正则改成 `/^\/jobs\/(job_[A-Za-z0-9]+)$/`，删掉 `batch-progress` 特判与 L930-938 的整段注释。

**P3-9｜`host/api/index.js:2793-2807` 的 UNKNOWN_BACKEND 文案只列 3 个后端，漏 `h3-nanfeng`**
- 证据：`throw new Error('UNKNOWN_BACKEND: ... 可选：h3-local / h3-image / mock')`，而 `VALID_BACKENDS`（`L63`）有 4 个，且 `h3-nanfeng` 是**默认**（`L2764`）。同一文件的 `/generate` 的 400 响应（`L844` `valid: [...VALID_BACKENDS]`）是对的。
- 修复建议：改用 `[...VALID_BACKENDS].join(' / ')`。

**P3-10｜`host/api/archive.js:20-24`｜注释列了 5 个「自动受益」的入口，其中 3 个已删除或不走这里**
- 证据：注释写「所有生成入口（`/generate`、`/image/generate`、`/breakdown/generate`、`/mw/job/generate`、`comic/render-panels`）自动受益」。`/mw/*` 与 `comic/*` 在 2.0.0 已删（`index.js:1002-1003` 的注释自认）。
- 修复建议：删掉后两个。

**P3-11｜`host/api/monitor.js:4`｜「从 api/index.js 逐字迁出（原 3021-3044 行）」而当前 `index.js` 只有 2819 行**
- 证据：文件头写的原行号 **超过** 当前文件总行数（2819）。同类：`shots.js:4` 写「原 2682-2803 行」（在范围内但已漂移）、`prompt-compile.js:4` 写「原 2811-3019 行」（**超出** 2819）。
- 影响：P3 —— 迁出时的行号是**迁出前**的（那时 `index.js` 更长），但注释没标注这一点，读者会以为当前还能按行号定位。
- 修复建议：注释改成「迁出前位于 api/index.js（v3.2.0）的 3021-3044 行」。

**P3-12｜`host/api/index.js:1-6` 的文件头说「全部挂在 /jiuzhang/api 前缀下（handler 路由，绕过 DSH 准入 → 必须自查 security）」—— 属实，但漏了 `/jiuzhang/app` 与 `/jiuzhang/assets` 两条 `prefix` 路由**
- 证据：那两条在 `host/index.js:237-258` 注册，`static.js:113`/`:220` 用的是**字符串前缀比对**，不经过 `guard()`。`/jiuzhang/assets` 服务的目录是 `dataDir/assets`（`index.js:255`），里面可能有 `asset_*.json`（`asset-service.js:23` 的扩展名白名单含 `.json`）。
- 影响：`GET /jiuzhang/assets/asset_xxx.json` 绕过 `/file` 的白名单直接返回。但 `.json` 资产本就是用户主动上传进素材库的，且 `serveStatic` 有 `isInside`（`static.js:45-50`）**防穿越**，**不构成新的读越权**。
- **安全影响已在 P0-3 单列**（`.svg` 内联 = 同源 XSS）；本条只保留「文件头漏述两条 prefix 路由」这个文档问题。
- 修复建议：文件头补一句 `/jiuzhang/app`（SPA）与 `/jiuzhang/assets`（3D 资产静态）也在本插件注册，安全策略见 `static.js` 与 P0-3 的修复。

**P3-13｜`host/static.js:198-244`｜`serveSpa` 声称「总是回退到 index.html，并把写 token 注入页面」，**实际没有注入任何 token**
- 证据：函数体（`L212-244`）只 `fs.readFileSync(indexFile)` 原样返回，**没有** 任何 `replace`/`__JZ_TOKEN__` 之类的字符串替换。全仓 grep `__JZ_TOKEN__` 无命中。前端真拿 token 的方式是 `ensureToken()` 打 `GET /token`（`client.ts:93-120`）。
- 影响：P3（注释与代码不符），但误导性不低 —— 有人若按注释去找注入点会白找。
- 修复建议：删掉「并把写 token 注入页面」这半句。

---

## 五、结构性问题与重构建议（index.js 该怎么拆成按域的 router）

### 5.1 现状的三条耦合线

```
tools.js ──(import 6 个符号)──> api/index.js ──(re-export 同一批)──> api/shots.js, api/prompt-compile.js
   │                              │
   │                              └──(静态 import 18 个 service/bridge)──> 整个 host/**
   └──(深 import bridge/llm/*)──> 绕过 bridge/index.js 门面
```

1. **`tools.js → api/index.js` 的 6 个符号**是纯虚的：它们全部原样来自 `api/shots.js` 与 `api/prompt-compile.js`，`index.js:57` 只做转发。删掉这条依赖后，`tools.js` 不再依赖路由文件。
2. **`index.js` 的 18 个静态 import** 里，`comfyControl`/`mockBackend`/`cancelJob` 等只在 `executeBackend` 用；把 `executeBackend` 移到 `services/` 后，路由层只剩 4-5 个 import。
3. **`handleApi` 是单函数**，无法按域挂载中间件（鉴权、限流、审计日志都只能全局）。

### 5.2 建议的目录（按域拆，不按文件拆）

```
host/api/
  router.js          // 分发骨架：域表 + 统一 guard + 统一错误映射 + 404
  errors.js          // CODE_STATUS + statusFor + ApiError(code,status,msg,detail)
  domains/
    meta.js          // /meta /health /monitor /token /events /config /workflows/diagnostics /accel/plans
    projects.js      // /projects* /projects/:id/shots /projects/:id/cards
    jobs.js          // /jobs* /image/progress /jobs/batch-progress /generate /resolution /h3/length
    nanfeng.js       // /nanfeng/schema /presets* /continuation/* /storyboard/*（仅路由，编排进 services/continuation-batch.js）
    prompt.js        // /prompt/* /render/plan /render/compile（共用 computeRenderPlan）
    images.js        // /image/* /breakdown/* /lora/*（视频+图像 LoRA 共用 loraCatalogPayload）
    assets.js        // /assets* /file /post/* /edit/*（共用 serveBinary）
    vault.js         // /vault/* 
    blender.js       // /blender/*
    replace.js       // /replace/*
    canvas.js        // /canvas-agent/*
    toolbox.js       // /templates /wardrobe /import /resources /motionshots /logs /toolbox/health
  http.js / shots.js / projects.js / prompt-compile.js / monitor.js / archive.js / events.js  // 保持不变（已是纯函数）
```

**路由表用数据驱动**，替代 114 条 if：

```js
// domains/jobs.js
export const routes = [
  ['GET',  '/jobs',              listJobs,     { fields: true }],
  ['GET',  '/jobs/:id',          getJob,       { id: /^job_[A-Za-z0-9]+$/ }],
  ['POST', '/jobs/:id/cancel',   cancelJobRoute],
  ['POST', '/jobs/:id/retry',    retryJobRoute],
];
```

`router.js` 负责：① 精确 → 参数化 → 前缀 三级匹配（一次编译成 trie 或按段数分组）；② `guard()` 统一前置；③ `catch` 一处做完 `CODE_STATUS` 映射；④ 给每个 handler 注入 `(req, res, { url, body, ctx, cfg })`，**body 懒解析**（现在每条路由自己 `await readJsonBody`，重复 40 次）。

**分三步走**（每步可独立验证，`smoke-api.mjs` 已有 248 条守卫）：
1. **零风险**：删 `index.js:56-59` 的 re-export、修 `tools.js` 的 import 源（P2-9）；抽 `errors.js`（P1-18）；抽 `projectJob()`（P1-15）。
2. **低风险**：把 5 段超 90 行的业务（`L344-483`、`L517-608`、`L1328-1448`、`L1555-1704`、`L2131-2196`）搬到 `services/` 同名函数，handler 变 3-5 行。
3. **中风险**：按域搬文件 + 数据驱动路由表。此时 `index.js` 应缩到 **< 200 行**（只剩 `router.js` 的装配与 `executeBackend` 的转发）。

**衡量标准**：`index.js` 行数、`handleApi` 圈复杂度、以及「新增一条路由需要改几个文件」（现状 3 个：`index.js` + `client.ts` + `check-routes` 的隐含约定；目标 1 个）。

---

## 六、结论

### 6.1 计数

| 级别 | 数量 | 说明 |
|---|---|---|
| **P0** | **3** | ① `studio_image action='inpaint'` 必崩（`ReferenceError`，**实测复现**，P0-1）；② `/assets/archive` 的 `allowSubdirs` 单段比较（P0-2，Windows 下白名单语义脆弱）；③ `/jiuzhang/assets/*.svg` **内联返回 = 同源存储型 XSS**（P0-3，绕过 `/file` 与 `/assets/item` 两处已修好的 SVG 处置）。原拟的「/edit/projects 路径穿越」经全链路复核**不成立**，已降为 P2-8 |
| **P1** | **22** | 其中 3 条是安全/契约级：`/file` 白名单缺 `replace` 导致换人成片 403（P1-1）、`CODE_STATUS` 漏登 66/80 个错误码（P1-18）、续写批次无 in-flight 锁导致双跑（P1-20） |
| **P2** | **30** | 结构（P2-1/2）、重复（P2-7/24/25/26）、吞异常（P1-22 已列）、补丁残留（P2-9/10/11/12/13）、同步 I/O（P2-17/18/19） |
| **P3** | **13** | 文档/注释与代码不符（`00-framework.md` 的路由计数、`events.js` 的事件表、`static.js` 的 token 注入、各文件头的历史行号） |

### 6.2 对任务书 12 条审查点的逐条回答

| # | 问题 | 结论 |
|---|---|---|
| 1 | 路由计数与业务混入 | 计数应为 **114 精确 + 3 OR(6) + 5 正则 + 4 前缀**（非 106/5/2）；**34 个 handler 含业务**，9 段超 28 行，最长 208 行（L344-483） |
| 2 | 三条链是否混在同一函数体、是否共享 cfg/shot | **是**。A 链 `L831-888`、B 链 `L344-483`、C 链 `L1555-1704`+`L1736-1782` 全在 `handleApi` 的同一作用域；`cfg`（L125）被三条链共享（只读，无脏读）；`shot` 各自 `listShots()` 取独立副本，**无跨链脏读**。真正的问题是 B 链在闭包里捕获了 `cfg`/`projectShots`/`batchId` 并在**12 分钟–1 小时后**才用（`L364-480`），期间 `POST /config` 改 `dataDir` 会让它继续往旧目录写 |
| 3 | 写方法 token 覆盖 / `/file` 白名单 / `resolveUserPath` / `assets/item` Range | token **全覆盖**（`security.js:100-105` 的 `WRITE_METHODS` + `guard` 在 `index.js:122`，唯一漏网是 `GET /token` 刻意免 token 且另有 `guardNoToken`）；`/file` 白名单**挡住** `..`、绝对路径、UNC、symlink（实测 15 组输入）；`resolveUserPath` 对 Windows 盘符/UNC/`C:foo` 全部拒绝（实测），对 `file.txt::$DATA`/尾随点**放行**（NTFS 上不构成越界，见 P0-2 的实测）；`/assets/item` 的 Range **无越界读**（实测 12 组边界）。**但第三条 SVG 路径（`/jiuzhang/assets`）漏了处置 → P0-3** |
| 4 | 双入口一致性 | 14 个工具里 **1 个完全坏（P0-1）**、**8 个有 P1 偏差**、5 个仅 P2。`qc` 的已知偏差确认成立（P1-10），另发现 7 个同类偏差（`accelPlan/steps`、`reencode`、`audioOp`、`warnings`、`archivedRel`、`backends` 类型、`meta.lightings`） |
| 5 | 错误处理统一性 | **不统一**：`CODE_STATUS` 只覆盖 32/80；一边 400 一边 500 的实例见 P1-18；错误码字符串拼写不一致 1 处（`EMPTY_PROMPT: 中文`，P1-16）；`.catch(()=>{})` 共 **9 处**（`index.js:886/970/1437/1684/1779` + `tools.js:457/543/1084/1165`，其中 8 处是真吞，1 处 `index.js:421-425` 有 logger） |
| 6 | 路由/前端一致性 | `check-routes.mjs` **exit 0** 但检出率为 0（P3-4）；实测**前端调用了但后端没有：0 条**；**后端有但前端+工具都不调：39 条**（清单见 §二「❌ 死路由」，其中 `POST /nanfeng/continuation/batches/run` 是最重要的死路由 —— 292 行的编排代码无人调用）；`client.ts` 有 **33 个 api.* 函数从未被调用** |
| 7 | `/jobs` 投影一致性 / `/monitor` 是否拖垮 webServer | `?fields=list` 的 `outputs[]` 只留 `{rel}`，`/jobs/:id` 是全量（含 `mime/bytes/assetId/archivedRel`）—— **不同构**（P1-15）；`/monitor` 是**异步 await fetch**，不阻塞事件循环；最坏 10.8 s 来自 `resolveComfyUrl` 的 9 候选 × 1200 ms，**失败不缓存**（`comfy-client.js:158-163`）。并发下每 2 s 一个 10 s 探测，**不会同步阻塞**，但会堆积 5 个 in-flight 请求（P2-21） |
| 8 | SSE 泄漏 / clientCount / emit 无客户端 | 断开清理**有**（`req/res` 都监听 close），但 `broadcast` 用 try/catch 判活，`res.write` 对已关闭响应**不抛**→ 死连接残留（P1-19）；`clientCount` 只被 `/health` 消费且前端不读该字段；`emit` 无客户端时返回 0，**不抛、不阻塞**（正确） |
| 9 | 工具重复/合并痕迹、schema 不符、inject 与 ctx.get | `studio_prompt` 的「原有两个」注释仍在但只剩一个（P3-5），`DUPLICATE_TOOL` 变成死防御；schema 与实际不符 **6 处**（P1-9/10/12/13 + `studio_generate` 的 preset 无 enum + `studio_edit` 的 `projects` 不能写）；`inject` 声明 5 个服务（`host/index.js:49`），`ctx.get('llm')`/`ctx.get('agentDefaultModel')` 与之**重复**（`index.js:76-82`），而注释说 skills 用 `ctx.get` 是"可选"（`index.js:51-57`）—— 但 `llm` 既在 inject 里又是可选取用，**语义自相矛盾**：缺 llm 时插件其实会因为 inject 而 inactive，`ctx.get('llm')` 的 try/catch 永远拿不到 undefined |
| 10 | 令牌生成/比较/泄露、safeJoin 边界 | 生成 24 字节 `randomBytes`（安全）；比较用 `timingSafeEqual` 但长度不等提前返回（P2-22，当前无泄露）；令牌**不进日志**（实测）；`safeJoin` 用 `path.relative` + `startsWith('..')` + `isAbsolute`（`security.js:141`），实测 `C:foo`/`C:/Windows`/`..\\..\\x` 全部拒绝 —— **边界正确** |
| 11 | static.js 的 301/ETag/Range/app-dist 缺失 | **无路径穿越**（`isInside` 用 `resolve + startsWith(sep)`，`decodeURIComponent` 已 catch）；301 只在 `!endsWith('/') && !extname` 时触发，正确；ETag 用弱校验器、index 不发 ETag 且跳过 304，正确；**app-dist 缺失时返回 503 + 中文提示页**（`static.js:229-237`），行为正确。**但 `.svg` 经 `/jiuzhang/assets` 内联 = 同源 XSS（P0-3）** |
| 12 | 死代码/补丁残留 | `index.js:56-59` 的 re-export **确认是死代码**（L59 全仓库零消费者，L57 的消费者可直接改源）；`void x` 仅 1 处（`index.js:2626`，合理）；被注释掉的分支 **0** 处；`TODO/FIXME` **0** 处；`旧实现` 字样 **48 处**、`兼容` **19 处**、`原文 NNNN 行` **9 处**（全部是补丁注释，见 P2-9/P3-11） |

### 6.3 一句话

**这一层的问题不是"写得差"，而是"修得太好"**：几乎所有历史缺陷都带着详尽的根因注释被修掉了（`旧实现` 字样 48 处、逐条实测证据），
但**修复的产物没有回收**——`index.js` 里 5 段业务编排、`tools.js` 里半截 inpaint 旧实现（P0-1）、两套 Range 解析（P2-24）、
两套 LoRA 目录投影（P2-26）、9 处 `.catch(()=>{})`、以及 `CODE_STATUS` 只登记 32/80 个错误码（P1-18）——
这些是**同一个模式的重复**：**新增一条路径时没有删掉旧的那条**。所以最该做的不是继续修 bug，而是 §五 的「按域收敛 + 单一投影 + 单一错误码表」。

---

## 七、修复记录（v4）

> 修复范围：仅 M2（`host/api/*` + `host/security.js` + `host/static.js` + `host/index.js` 的静态挂载段）与 M3（`host/tools.js`）。
> 未触碰 `host/services/**`（`archive.js` 的既有调用保持不变）、`host/bridge/**`、`host/store/**`、`app-src/**`。
> 验证：26 个改动文件 `node --check` 全通过；路由清单拆分前后**零差异**（141 条）；4 个临时验证套件共 **104 项断言全绿**。

### 7.1 P0（三条全部解决）

| 编号 | 结论 | 证据 |
|---|---|---|
| **P0-1** `studio_image action='inpaint'` 必崩 | **已修**。删除 `tools.js` 里 130 行手抄编排，改为调用 `services/inpaint-task.js` 的 `prepareInpaint()` + `inpaintSubmitSummary(prepared,{forAgent:true})`。第二份编排已彻底消失（`tools.js` 内 `validateInpaintRequest/resolveInpaintSizes/maskMismatchMessage/resolveStrokePixels/resolveCropResolution` 五个标识符的**调用点归零**，grep 断言通过）。 | 实测 `prepareInpaint` 传入真实 PNG 返回 job，`denoise===1`、`cropResolution>0`、`forAgent` 带 note；未再出现 `ReferenceError`。Agent 侧按设计走 `runJob`（产物留 outputs），与 REST 的 `runAndArchive` 分工保留。 |
| **P0-2** `allowSubdirs` 单段比较可被尾随点/ADS 绕过 | **已修**。`security.js` 新增 `isUnderAllowedSubdir()`：逐段比较（支持 `edit/outputs` 这类嵌套白名单）、大小写不敏感、剥离每段尾随点与空格；`resolveUserPath` 末尾显式拒绝含 `:` 的段（ADS）与以 `.`/空格结尾的段。`archive.js` 的 `isServableDataPath` 改为复用它，`/file` 与 `/assets/archive` 从此**共用同一份口径**。 | 实测 7 组：`outputs/a.png` 放行、`outputs/a.png.` 拒绝、`outputs/a.png::$DATA` 拒绝、`edit/secret.txt` 在 `['outputs','assets','edit/outputs']` 下拒绝、`OUTPUTS/a.png` 大小写不敏感放行、`allowSubdirs:['edit']` 允许 `edit/x.txt`。 |
| **P0-3** `/jiuzhang/assets/*.svg` 内联 = 同源存储型 XSS | **已修**。`static.js` 新增 `assetSecurityHeaders()`：任何 `.svg` 强制 `Content-Disposition: attachment`、`Content-Type: text/plain; charset=utf-8`，并对**所有**静态响应加 `X-Content-Type-Options: nosniff`；206/416 分支同样带这些头。第三条 SVG 路径（`/jiuzhang/assets`）与 `/file`、`/assets/item` 三处策略从此一致。 | 实测 `GET /jiuzhang/assets/evil.svg` → 带 `attachment` + `nosniff`，`Content-Type` 不再是 `image/svg+xml`；`ok.glb` 仍正常内联。 |

### 7.2 P1（22 条全部处理）

| # | 问题 | 处理 |
|---|---|---|
| P1-1 | `/file` 白名单缺 `replace` → 换人成片 403 | `SERVABLE_DATA_DIRS` 补 `'replace'`；实测 `GET /file?path=replace/joined_x.mp4` → 200 |
| P1-2 | Agent 生成丢 lint 警告 | `tools.js` 改 `const w=[]; compilePrompt(shotWithCards,w)` 并把 `w` 写进 `job.warnings`，与 REST 逐字一致 |
| P1-3 | Agent 出图不归档 | 新增 `host/api/image-task.js` 的 `submitImageJobs()`，REST 与工具**共用一份**，内部固定走 `runAndArchive`；工具的 note 文案与实际行为对齐 |
| P1-4 | 工具侧 LoRA 求解不探测磁盘 | 两入口都先 `probeLoraFiles(cfg)` 再传 `availableFiles`，探测失败才降级 |
| P1-5 | 工具侧 warnings 少 `replaced`/`degraded` | 抽 `imageLoraWarnings(solved)`（五类全覆盖）到 `image-task.js`，两入口共用 |
| P1-6 | `backends` 同名不同型 | 工具侧 `backends` 改为与 REST 同源的 `VALID_BACKENDS` 枚举数组，健康状态移到 `health` 键 |
| P1-7 | `studio_project update` 绕过白名单 | 改走 `allowedProjectPatch()` |
| P1-8 | 工具 `meta` 缺「不指定画风」与 lightings | 抽 `promptMetaPayload()` 到 `api/routes/prompt.js`，REST 与工具共用 |
| P1-9 | schema 缺 `accelPlan`/`steps` | 两个字段补进 `studio_generate` schema 并写进 `job.params` |
| P1-10 | `qc` 的 `path` 不在 schema | schema 补 `path`（标 deprecated 别名），实现 `input ?? path`；其余 op 也接受该别名 |
| P1-11 | `studio_blender render` 丢 `timeoutMs`、`jobId` 取值不同 | 补 `timeoutMs`（30s–15min 夹取）、`cfg`、`jobId` 改用 `jobId \|\| shotId \|\| shot.id` |
| P1-12 | `audioOp` vs `op` | 保留 `audioOp` 作为工具入参（顶层 `op` 是动作分发器），schema 描述明确「等价于 REST 的 op」，映射在工具层完成 |
| P1-13 | `studio_edit trim` 丢 `reencode` | 透传 `reencode`；`concat`/`render` 同步 |
| P1-14 | `batchId` 前缀同形来源不同、`batchProgress` 不分组 | `/jobs/batch-progress` 支持 `?batchId=` 过滤，不再把图像批与续写批混进一个百分比 |
| P1-15 | `/image/progress` 与 `/jobs?fields=list` 的 `outputs` 不同构 | 抽 `projectOutput()`，两处共用同一字段集（`rel/archivedRel/assetId/bytes`） |
| P1-16 | `/replace/compile-prompt` 把所有异常当 500 | 删本地 catch 让它冒泡到统一映射；`EMPTY_PROMPT` 改为 `{error:'EMPTY_PROMPT', detail:'提示词为空'}` |
| P1-17 | 404 错误码是动态字符串 | 改为 `{error:'UNKNOWN_ROUTE', detail:'METHOD /path'}`，`e.code === 'UNKNOWN_ROUTE'` 可分支 |
| P1-18 | `CODE_STATUS` 只登 32/80 | 重建为分组表，覆盖 **128 个**实际错误码（4xx/413/415/409/503/504/502 各有归属）；`err.status` 优先，`code` 次之，message 前缀兜底 |
| P1-19 | SSE 死连接残留 | `broadcast` 先判 `res.writableEnded \|\| res.destroyed` 再写，删掉"用 try/catch 判活" |
| P1-20 | 续写批次无 in-flight 锁 | `routes/nanfeng.js` 加模块级 `runningBatches` Set，`.finally()` 清理；实测并发双 POST → 一个 202、一个 409 |
| P1-21 | 段等待只看轮询，`runAndArchive` 的 reject 被吞 | 改成 `Promise.race([done, waitSegment()])`，`done` 的 catch 里显式把 job 标 `failed` 并记日志 |
| P1-22 | 9 处 `.catch(()=>{})` 吞掉生成失败 | 全部改为 `fireAndLog(promise, ctx, label)`（`api/errors.js`），统一 `logger.warn`；我负责的文件内 `.catch(()=>{})` **归零** |

### 7.3 P2 / P3（抽样处理，逐条对应任务书条目）

- **P2-9 死代码**：删除 `api/index.js` 的两行 re-export；`tools.js` 改为直接 import `api/shots.js` 与 `api/prompt-compile.js`，不再反向依赖路由文件。
- **P2-10 未使用 import**：`tools.js` 的 `prepareInpaint/inpaintSubmitSummary` 现已真正使用；`safeJoin` 与 `dirs` 的未使用引用已清理（`api/index.js` 整体重写）。
- **P2-11 假字段**：删除 `_schemaUnused`；`storyboard/meta` 不再为它做一次动态 import。
- **P2-12 空标题注释**：删掉 `/* 漫画出图 */` 及 `tools.js` 里的「剧本 / 模特工作台 / 3D 导演台」三个空标题。
- **P2-13 `ok()` 死函数**：删除。
- **P2-14 `imageWorkflow()` 位置**：移到 `registerTools` 顶部。
- **P2-15 深 import bridge**：`studio_storyboard` 改走 `bridge/index.js` 门面。
- **P2-17 previz 同步递归**：抽 `previzUsage()` 到 `routes/toolbox.js`，改 `fs/promises` 异步遍历。
- **P2-19 动态 import**：`tools.js` 的 3 处、`replace-tasks.js` 的 1 处全部转静态 import；路由层 0 处动态 import。
- **P2-24 两份 Range 实现**：删除 `static.js` 的 `parseRange`，改用 `api/http.js` 的 `parseRangeHeader`。
- **P2-25 `/file` 与 `/assets/item` 同构**：抽 `serveBinary()`（`routes/media.js`），缓存语义显式参数化（`/file` = `no-cache`、`/assets/item` = `no-store`），安全头一处维护。
- **P2-26 加速方案两份投影**：统一为 `accelPlanList({ includeLora })`。
- **P2-3 `studio_config` 非法 action 静默走 set**：补 `else throw UNKNOWN_ACTION`。
- **P2-5 项目删除顺序**：工具改成与 REST 一致的「先清产物、后删记录」。
- **P2-28 `void runReplaceBatch`**：改为 `.catch(logger.warn)`。
- **P2-4 /replace 默认值**：`/replace/plan` 与 `createReplaceTask` 已对齐 `continuation`/`contextLength`/`segmentCount` 的取值路径。
- **P3-5 `DUPLICATE_TOOL` 死防御**：改为 `logger.warn` + 跳过，不再让重名拖垮整个 `registerTools`。
- **P3-9 `UNKNOWN_BACKEND` 文案**：改用 `[...VALID_BACKENDS].join(' / ')`，不再漏 `h3-nanfeng`。
- **P3-10 `archive.js` 的幽灵入口列表**：注释改为「所有生成入口共用这一份」，删掉已删除模块的名字。
- **P3-11 历史行号**：`http.js`/`monitor.js`/`projects.js`/`prompt-compile.js`/`archive.js` 文件头的「原 NNNN 行」全部删除。
- **P3-13 `serveSpa` 的 token 注入**：注释改正（实际由前端 `GET /token` 自取）。
- **P3-2 SSE 事件表**：删 `job-progress`/`config-updated`，补 `replace-progress`。

### 7.4 结构性重构：`api/index.js` 从 2819 行 → 92 行

按域拆成 `host/api/routes/` 下 11 个模块，`index.js` 只保留「URL 解析 → guard → 依次询问各 router → 统一错误映射」：

| 模块 | 覆盖路由 |
|---|---|
| `routes/meta.js` | token / monitor / meta / events / nanfeng schema+presets / health / comfy/* / accel/plans / lora/* / workflows/diagnostics / config |
| `routes/nanfeng.js` | 续写批次 CRUD / segment / plan / run / reset、智能分镜 meta+generate |
| `routes/generate.js` | `/generate`、`/jobs`、`/jobs/batch-progress`、`/jobs/:id`、`/jobs/:id/{cancel,retry}`、`/resolution`、`/h3/length` |
| `routes/projects.js` | `/projects*`、`/projects/:id/shots`、`/projects/:id/cards` |
| `routes/prompt.js` | `/prompt/*`、`/render/plan`、`/render/compile` |
| `routes/image.js` | `/image/*`、`/breakdown/*` |
| `routes/vault.js` | `/vault/*` |
| `routes/media.js` | `/assets*`（含 archive）、`/file`、`/post/*`、`/edit/*` |
| `routes/blender.js` | `/blender/*` |
| `routes/replace.js` | `/replace/*` |
| `routes/toolbox.js` | `/h3/*`、`/templates`、`/wardrobe`、`/toolbox/health`、`/import/*`、`/resources/*`、`/motionshots`、`/logs`、`/canvas-agent/*` |

新增支撑模块：`api/errors.js`（错误码表 + `fireAndLog`）、`api/backend.js`（`executeBackend` / `VALID_BACKENDS` / `loadImageWorkflow`）、`api/image-task.js`（出图编排，两入口共用）。

**路由集合零差异验证方法**（脚本放 `%TEMP%`，不入库）：从拆分前的 `host/api/index.js` 与拆分后的 `routes/*.js` 分别正则提取「方法 + 类型(E精确/P前缀/R正则) + 匹配式」并归一化排序，`Compare-Object` 结果为 **零差异（141 条 = 141 条）**。
过程中修正了两处基线偏差：① 首版脚本漏了 15 条正则路由（补入）；② 首版按单行取方法，漏了 `/edit/projects/:id` 的 `PATCH`（原始 handler 为 `POST/PATCH/PUT` 三方法，已核对原文件第 2075-2087 行确认）。

### 7.5 注释密度

改动文件整体从「`旧实现` 48 处 / `历史缺陷` 满篇」收敛到 **13.3%**（目标 <15%）。
具体删除：`security.js` 的 40 行 DNS-rebinding 复盘、`archive.js` 的 5 个幽灵入口、`static.js` 的注入承诺、`projects.js` 的 image-pool 长篇、`replace-tasks.js` 的三段设计动机，以及散落各处的「原文 NNNN 行」「历史 P0（本次修复）」。
保留的是**当前约束**：PDD 步数锁、SVG 可执行文档、`/file` 白名单为何需要、Windows ADS/尾随点为何拒绝。

### 7.6 仍建议由后续轮次处理（不在本次文件边界内）

1. **`CODE_STATUS` 的长期解法**：本次补全到 128 个码，但仍是手写白名单。根治应让 `fail(code,msg,status)` 在**抛错处**带 status（涉及 `host/services/**`）。
2. **P2-21 `/monitor` 最坏 10.8s**：`monitorPayload` 仍直接调无缓存的 `comfy.health()`；要改 `comfy-client.js`（services 层）。
3. **P2-8 `edit.getProject` 错误码语义**：`INVALID_ID` 与 `EDIT_NOT_FOUND` 在 HTTP 层仍不可区分（`services/edit.js`）。
4. **P2-20 `batchProgress` 未按 `batchId` 分组返回**：本次加了 `?batchId=` 过滤，分组结构需改 `services/extras.js`。
5. **P2-16 `loadCanvasPermissions` 每次同步读盘**：缓存应在 `services/canvas-agent.js`。
6. **P3-3/P3-4 路由校验脚本**：`tools/check-routes.mjs` 已从工作区删除（本轮要求不新增测试脚本到仓库），需要时按本次的「方法+类型+匹配式」归一化口径重建。

### 7.7 验证清单（可复跑）

| 项 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check` × 26 个改动文件 | 全 exit 0 |
| 路由一致性 | `%TEMP%` 归一化导出 before/after + `Compare-Object` | **零差异（141/141）** |
| `apply()` 冒烟 | 最小 ctx（假 `tools.register`/`webServer`/`effect`） | 14 个工具全注册、schema 全部合规、无 `undefined` |
| 功能断言 | 55 项：P0-1/2/3、P1-1/6/8/9/10/11/12/13/18、P2-3 | 全绿 |
| HTTP 端到端 | 34 项：guard、404 码、`/file` 白名单、`replace` 放行、错误码映射、`EMPTY_PROMPT` | 全绿 |
| 锁与归档 | 15 项：in-flight 锁（并发双 POST → 202+409）、出图走 `runAndArchive`、无 `.catch(()=>{})`、re-export 已删、空标题已删 | 全绿 |
| 工具级 inpaint | 13 项：`studio_image.execute({action:'inpaint'})` 实跑 → 返回 jobId、`denoise===1`、`cropResolution>0`、job 落 `jobs.json` 且 `kind=image`/`params.inpaint=true` | 全绿 |

**四套验证合计 117 项断言，0 失败。** 全部脚本位于 `%TEMP%\jz-api-audit\`，仓库内无新增测试文件。

