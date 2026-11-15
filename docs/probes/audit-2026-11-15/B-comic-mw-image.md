# B 组审计 —— 漫画 / 模特 / H3-Image / 画布 Agent

> 审计对象：`F:\AI视频\工作室\dsh-jiuzhang-studio`（v1.5.0）
> 审计日期：2026-11-15
> 审计范围：`host/services/comic-service.js`、`host/services/model-workbench.js`、`host/services/h3-image.js`、`data/workflows/h3-image.json`、`host/services/canvas-agent.js`、`host/api/index.js` 中 `/comic/*` `/mw/*` `/image/*` `/breakdown/generate` `/canvas-agent/*` 路由、以及对应 4 个页面。
> 方法：逐文件通读 + 路由双向脚本比对 + 几何/占位符计算验证。所有结论均附 file:line。

---

## 一、结论摘要

| 模块 | 评分 | 一句话结论 |
|---|---|---|
| **H3-Image 出图链路** | **3 / 5** | 占位符映射**完整无误**（8/8 全填），工作流装配正确；但 `IMAGE_SIZES` 里 4096²/5472×3072 两档**无任何显存或面积守卫**，12GB 卡用户一点即 OOM，且 `mp` 字段是纯装饰、从不参与判断。 |
| **漫画工作台** | **2 / 5** | 「分镜抽取 → 提示词计划 → 逐格出图 → SVG 导出」四段**确实能串通**，SVG 内嵌 data URI 自包含（这点做得对）；但 `top_wide`/`bottom_wide`/`five_panel` 三套版式**几何算错**（越界与重叠），且 `exportAllSvg` 相比 `exportPageSvg` **漏掉路径守卫**，形成读任意文件的旁路。 |
| **模特工作台** | **2 / 5** | 6 电商 + 10 影视风格**定义齐全**，`createJob`/`replan` **确实产出真实提示词**（非 stub），硬伤重试逻辑也真实存在；但**自定义风格 `customStyle` 完全失效**（写入后从不读取），且页面**没有出图按钮**，`mwGenerateJob` 定义了却没人调 —— 整套出图链路前端不可达。 |
| **画布 Agent** | **2 / 5** | 17 工具/4 权限位结构完整，服务端强制权限（不复用请求体 `permissions`）这个安全修复是对的；但**4 个权限位在服务端恒为固定值、无任何 HTTP 入口可改**，导致 `canSpend`/`canDelete` 永远 `false` —— `generate_image`/`generate_video`/`delete_node` **永久不可用**；前端权限按钮是纯装饰。 |

---

## 二、缺陷清单

> 严重度口径：**P0** = 功能必坏/数据损坏/安全越界；**P1** = 主要路径不可达或明显错误；**P2** = 局部错误、有替代路径；**P3** = 计费/文案/死代码。

| id | 严重度 | file:line | 现象 | 根因 | 最小修法 |
|---|---|---|---|---|---|
| **B-01** | **P0** | `host/services/canvas-agent.js:60-65`<br>`host/services/canvas-agent.js:84-88`<br>`host/api/index.js:1147` | 画布 AI 的「删节点 / 出图 / 出视频 / 调技能」四个动作**永久返回 `PERMISSION_DENIED`**，用户无任何办法开启。前端权限按钮点了只改本地 `useState`，一次都不上送。 | 权限**唯一真源**是模块级 `SERVER_PERMISSIONS`（:77），初值 `canSpend:false, canDelete:false`（:60-65）。改写入口 `setCanvasPermission()`（:84-88）**全仓库零调用**（已 grep 确认，仅定义处出现）。`/canvas-agent/exec` 在 :1146 显式 `delete rest.permissions` 丢弃前端声明，再于 :1147 强行注入 `getCanvasPermissions()`。于是 `need()`（:113-119）对 `perm:'canSpend'`（`generate_image`/`generate_video`/`call_skill`）与 `perm:'canDelete'`（`delete_node`）**恒抛错**。 | 新增 `POST /canvas-agent/permissions` 路由（写操作已受 `X-JZ-Token` + Origin 保护），body 形如 `{canSpend:true}`，内部逐个调 `setCanvasPermission(k,v)` 并返回 `getCanvasPermissions()`；前端 `CanvasAgentPanel.tsx:151` 的 `onClick` 改为「先调接口成功，再更新本地 state」。 |
| **B-02** | **P0** | `host/services/comic-service.js:347` | `POST /comic/export/all` 可把**数据目录外的任意文件**读出来做 base64 内嵌进 SVG 并落盘导出。 | 同一功能的两条实现不对称：`exportPageSvg` 在 :311 已用 `resolveUserPath({root, input, mustExist:true})` 做了越界校验（防 symlink/`../`），注释 :308-310 明确写了这是补过的洞；但 `exportAllSvg` 在 :347 仍是裸 `path.join(C().dataDir, pn.imageRel)` —— `path.join` **不做越界检查**。`imageRel` 来自 `data/comic/<pid>.json`，`/comic/extract` 等写接口可写入 `../../../Windows/...`。 | 把 :347 改写为 `resolveUserPath({ root: C().dataDir, input: pn.imageRel, mustExist: true })`，与 :311 完全一致（最省事的做法是抽成 `inlinePanelImages(page)` 供两处共用，杜绝再次漂移）。 |
| **B-03** | **P1** | `host/services/h3-image.js:66-67`<br>`host/services/h3-image.js:260-262` | 12GB 显存用户在 `ImagePage` 下拉里选「4K 方图 4096²」或「4K 横 5472×3072」→ 直接提交 16.8MP 采样 → **显存打爆（OOM）**，ComfyUI 侧报错或整机卡死。README:20 却宣称「12GB 显存可跑」。 | `IMAGE_SIZES` 无条件暴露两档 4K（:66-67）。`runH3Image` 在 :260-262 只做 `/32` 对齐，**没有任何面积/显存上限判断**；`mp: 16.8` 字段（:66-67）**全仓库无任何读取处**（已 grep：`mp` 仅在 h3-image.js 定义处、`ImagePage.tsx:163,175` 拼 label 时出现，从不参与逻辑）。全仓也不存在 `MAX_IMAGE`/`maxSide` 类守卫。README:194 实测基线是 2048² 用掉 11.4GB，4096² 面积是它的 4 倍。 | 在 `runH3Image` 计算 `W/H` 后加一道闸：`const MAX_MP = Number(cfg.imageMaxMP) || 4.3; if ((W*H)/1e6 > MAX_MP) throw new Error('IMAGE_TOO_LARGE: ...')`；同时用已有的 `comfy.vramStatus(cfg)`（`comfy-client.js:184`，目前只在 `/render/plan` 用到）在提交前比对 `freeBytes`。并把 4K 两档标 `needsVramGb: 48`，`/image/meta` 下发，前端 `ImagePage.tsx:158-165` 据此禁用。 |
| **B-04** | **P1** | `host/services/comic-service.js:115` | 选「五格分布 `five_panel`」时，第 5、6 格**完全重叠**：实测 i=4 `{x:0, y:0.667, w:0.5, h:0.333}`、i=5 `{x:0, y:0.667, w:1, h:0.333}`，前者被后者整体覆盖。导出的 SVG 里两格图片叠在一起，且名字叫「五格」实际出 6 格。 | `five_panel` 定义为 `rows:3, cols:2` → 共 6 格（:32）。:115 把**最后一格**（i=5）改成整宽底栏 `{x:0, y:2/3, w:1, h:1/3}`，但第 5 格（i=4）走默认分支 :117 得 `{x:0, y:2/3, w:0.5, h:1/3}` —— 同 y 区间、同 x 起点，被完全盖住。 | `five_panel` 的 `rows` 改为 `2`（2×2=4 格）+ 底部整宽 = 5 格，与名字一致；或保留 6 格但把 i=4 特判为 `{x:1/2, y:2/3, w:1/2, h:1/3}`。 |
| **B-04b** | **P1** | `host/services/comic-service.js:114` | `bottom_wide` 版式第 3、4 格**重叠**：实测 i=2 `{x:0, y:0.5, w:0.5, h:0.5}` 与 i=3 `{x:0, y:0.5, w:1, h:0.5}` 左侧半边完全重合。 | :114 让最后一格（i=3）整宽置底 `{x:0, y:1-h, w:1, h}`（h=0.5），但上排只排了 i=0、i=1 两格，i=2 仍按默认 :117 落在 `{x:0, y:0.5}` —— 也就是被"底栏"占了的位置。整宽分支没有同步缩减其它格的排布位置。 | `bottom_wide` 改为 `rows:2` 且只排 3 格：i=0/i=1 上排各占 1/2，i=2 整宽置底；或 i=2 特判 `{x:1/2, y:0, w:1/2, h:1/2}`、仅 i=3 置底。 |
| **B-05** | **P1** | `host/services/comic-service.js:113` | `top_wide` 版式第 4 格（i=3）**横向越界**：实测 `{x:1, y:0.5, w:0.5, h:0.5}` → 右边界 `x+w = 1.5 > 1`，导出时被 SVG 画布裁掉一半。 | `top_wide` 是 `rows:2, cols:2`。:112 让 i=0 占满上排（`w:1, h:0.5`）；:113 对 i>0 硬编码 `r=1; c=i-1`，返回 `{x: c*0.5, y:h, w:0.5, h}`，但下排实际只有 2 个格位（c 应取 0..1），i=3 时 `c=2` → `x=1.0` 直接推出画布。 | `top_wide` 分支按下排格数取模：`const per = cols - 1; const c2 = (i - 1) % per; return { x: c2 / per, y: h, w: 1 / per, h };`。注意：此格越界**会被 preflight 抓到**（`:199` 检查 `x+w>1.001`），所以用户在体检面板能看到阻断，但版式本身仍是错的。 |
| **B-06** | P3 | `host/services/h3-image.js:66-67` | 尺寸表里 `mp` 字段（16.8 / 4.2 …）**纯装饰**，没有任何逻辑读取 —— 既不做显存预算，也不做面积校验。 | 全仓库 grep `mp`：仅 `h3-image.js:56-67` 定义、`ImagePage.tsx:163,175` 拼 label 文案。`imageSize()`（:76-80）只按 id 查表。 | 与 B-03 一并修：让 `mp` 参与 `runH3Image` 的面积守卫，否则应删除该字段以免误导（它看起来像容量指标）。 |
| **B-07** | **P1** | `host/services/model-workbench.js:149-151`<br>`host/services/model-workbench.js:264`<br>`app-src/src/pages/ModelWorkbenchPage.tsx:239-240` | 用户在「自定义风格」输入框写的文字**永远不会进入提示词**。页面提示「写了就用你的原文，覆盖预设」，实际完全不生效，且无任何报错。 | `planPrompts` 判断的是 `typeof job.style === 'string'`（:149），但 `createJob` 存的是 **`customStyle`**（:264），**从来没有 `job.style` 字段**。因此 :149 恒为假，恒走 :151 的 `styles.find(s => s.id === job.styleId)`。`customStyle` 只在 :264/:327/:351 被写入和搬运，**从不被读取进提示词**。 | `planPrompts` 改为优先读 `job.customStyle`：`const custom = String(job.customStyle ?? '').trim(); const style = custom ? { id:'custom', name:custom, hint:custom } : (styles.find(...) ?? styles[0]);`（`job.style` 分支保留做兼容）。 |
| **B-08** | **P1** | `host/api/index.js:1188`<br>`app-src/src/pages/ModelWorkbenchPage.tsx`（无出图入口） | 模特工作台**前端根本没有「出图」按钮**：`api.mwGenerateJob` 在 `client.ts:457` 定义了，但**全仓库零调用**。用户建完作业只能看提示词，永远出不了图。即便补上按钮，尺寸也**恒为固定的两个档**。 | ① 前端：`ModelWorkbenchPage.tsx` 通篇（:258-339 作业区、:342-393 详情区）只有「存为方案 / 删除」两个动作，无 generate。② 后端：`/mw/job/generate` 在 :1188 把 `sizeId` **硬编码**为 `job.mode === 'film' ? 'p-2x3-film' : 'ecom-sq'`，`job.sizeId` 与 `MW_SIZES` 里用户选的 `ecom-45`/`film-916`/`film-21` **全部被忽略**。 | 详情面板加按钮：`<Button onClick={async()=>{const r=await api.mwGenerateJob({id:current.id}); toast.ok(...)}}>出图</Button>`；后端 :1188 改成 `const sizeId = job.sizeId || (job.mode === 'film' ? 'p-2x3-film' : 'ecom-sq');`。 |
| **B-09** | **P2** | `host/services/canvas-agent.js:266-284`<br>`app-src/src/canvas/nodes/_shared.tsx:668-669,727` | `insert_image` 成功返回 `{nodeId}`，画布也插入了节点，但节点**显示为空占位**（看不到图）。 | `insert_image` 把图片地址写进 `data.params.fileUrl`（:275-277）。而画布渲染只认 `data.result?.url`：`PreviewBox` 在 `_shared.tsx:668-669` 取 `const url = result?.url`，`UploadBox` 在 :727 同样取 `data.result?.url`。`params.fileUrl` **无人读取**，故新建节点 `result` 为空 → 显示「尚无产物」。 | `insert_image` 的 `data` 改为 `{ title, result: { url: src } }`（与 `CanvasArea.tsx:1078` 上传后写 `{url, path}` 的形状保持一致）。 |
| **B-10** | **P2** | `host/api/index.js:1273` | 后端有 `POST /mw/figure/delete`，**前端无任何调用**（已用 `app-src/src` 全量语料确认）。形象库只能增、不能删，`figures.json` 只增不减。 | `client.ts`（:365-379 模特工作台段）**未定义**该方法；`ModelWorkbenchPage.tsx:301-319` 形象库分支只渲染卡片，无删除动作。注意 `/mw/plan/delete`（`api/index.js:1262`）**不存在此问题** —— 前端 `mwDeletePlan`（`client.ts:376`）传 `{id}`、后端 :1264 读 `String(body.id)`，契约一致。 | 补 `mwDeleteFigure: (id: string) => request('POST','/mw/figure/delete',{ id })`，并在 `ModelWorkbenchPage.tsx:309` 卡片上加删除按钮（`IconButton` + `window.confirm`）。 |
| **B-11** | **P2** | `host/api/index.js:743` | `POST /assets/archive` 这条**被安全审计专门加固过**的路由（:752-763 注释记录了「任意本机文件复制进素材库」的历史漏洞），**前端零调用**。 | 全量语料搜索 `/assets/archive` 只命中 `api/index.js` 自身。服务端真正在用的是函数 `archiveBatchOutput`（:1512）和 `runAndArchive`（:1539），都直接调 `ctx.assets.archiveFile`，不经过 HTTP。 | 保留路由（Agent 工具可能用），但要意识到它**不是**前端链路的一部分；若确认无外部使用者，建议下线以减少攻击面。 |
| **B-12** | **P2** | `app-src/src/pages/ImagePage.tsx:71` | 「最近任务」面板**可能长期为空**，且会把非图像任务混进来。 | :71 用 `/^h3-image$\|image/i.test(String(j.backendId ?? ''))` 过滤。`/i` 标志让 `\|image` 分支匹配任意含 "image" 的串 —— 本意是兜住 `kind`，实际只看 `backendId`。真正的隐患是：`/image/generate`（`api/index.js:962`）与 `/breakdown/generate`（:918）都会 `job.kind='image'` 并写 `backendId:'h3-image'`，**两者无法区分**，图像页把立绘拆解任务也算进来。 | 过滤条件改为 `j.backendId === 'h3-image' && j.params?.kind === 'image' && !j.params?.breakdown`；并在 `/breakdown/generate` 的 `params` 里加标记 `breakdown: true`。 |
| **B-13** | **P3** | `host/services/h3-image.js:139-153` | `sizeForPurpose()` 是**死导出**：全仓库除定义处外零调用（已 grep）。注释称「按用途推荐尺寸（模特/漫画/画布）」，实际模特在 `api/index.js:1188` 硬编码、漫画在 :544 硬编码 `'sq-2048'`。 | 三处各自写死尺寸字符串，没有一处调用这个「单一真源」。 | 要么删除该导出，要么让 `api/index.js:1188` / `:544` / `runH3Image` 默认值统一调 `sizeForPurpose()`。 |
| **B-14** | **P3** | `host/services/canvas-agent.js:10`<br>`host/services/canvas-agent.js:91-96`<br>`host/services/canvas-agent.js:345` | 注释与 `/canvas-agent/meta` 都对外宣称有「沙箱 `run_script`：10 秒、无网络、无 DOM」，**但 `run_script` 工具根本不存在**。 | `CANVAS_TOOLS`（:34-52）17 个工具里没有 `run_script`；`exec()` 的 switch（:154-337）也没有对应 case。`RUN_SCRIPT_LIMITS`（:91-96）只被 `meta()` 在 :345 原样吐出，**没有任何执行器**。 | 删除 `meta()` 里的 `runScript` 字段与 :10 的注释，或真正实现该工具（当前建议先删，避免误导与后续误接）。 |
| **B-15** | **P3** | `host/services/comic-service.js:401` | 提示词里「构图」恒为「横向构图」，因为判断条件恒真。 | `pn.geometry ? '横向构图' : '方形构图'` —— `geometry` 是 `extractBoardFromText` 在 :91 必填的对象，永远 truthy，故恒走前者。 | 改成基于实际宽高比：`const g = pn.geometry ?? {}; const wide = (g.w ?? 1) > (g.h ?? 1); parts.push(\`构图：单格漫画分镜，${wide ? '横向' : '纵向'}构图，...\`)` |
| **B-16** | **P3** | `host/services/canvas-agent.js:60-65`<br>`app-src/src/canvas/CanvasAgentPanel.tsx:63,72,99` | 画布 AI 面板顶部的 4 个权限开关是**纯视觉欺骗**：点了会变亮/变暗，但后端从不接收，用户以为授权成功了。 | `perms` 是组件本地 `useState`（:63），初值取 `meta.defaults`（:72）；:99 把它塞进 `context.permissions` 上送，但 `api/index.js:1146` 明确 `delete rest.permissions`。 | 与 B-01 一并修：把开关接到 `POST /canvas-agent/permissions`，并以服务端返回值回填 `perms`。 |
| **B-17** | **P3** | `app-src/src/pages/ModelWorkbenchPage.tsx:387-390` | 作业详情底部常驻一条**过期提示**：「当前 H3 只做视频；图像生成等待接入后即可自动跑通」。实际 H3-Image 已完全接通（见 `/mw/job/generate` :1174-1246）。 | 文案未随功能上线更新。 | 删除该 `Alert`，替换为实际状态（如「共 N 张，已出 M 张」）。 |
| **B-18** | **P3** | `app-src/src/pages/ComicPage.tsx:209` | 「逐格出图」按钮 `disabled` 依赖 `planCount`，而 `planCount` 初值 0 且**只在本次会话点过「提示词计划」后才非 0**。刷新页面后即使磁盘上已有 `planParts`，按钮仍是禁用的。 | `planCount` 是 `useState(0)`（:137），`load()`（:58-71）只回填 `doc`，不回填 `planCount`；`doc.planParts` 已在 `listPlans` 落盘但 `ComicDoc` 接口（:24-31）根本没声明 `planParts` 字段，页面拿不到。 | `ComicDoc` 加 `planParts?: unknown[]`；`load()` 里 `setPlanCount(d?.planParts?.length ?? 0)`；或直接把 `disabled` 条件换成 `!doc?.planParts?.length`。 |

---

## 三、路由双向对照表

### 3.1 方向一：前端 `client.ts` 调用 → 后端路由

**结论：无「前端调了但后端没实现」的死路由。** 98 个 `request()` 调用 + `/token` + `/assets/upload` 全部能在 `host/api/index.js` 找到承接（字面量 104 条 + 3 条正则路由 `/^\/projects\/([^/]+)$/`(L289)、`/^\/projects\/([^/]+)\/shots$/`(L322)、`/^\/jobs\/([^/]+)\/(cancel|retry)$/`(L381)）。

脚本初筛报出的 10 条「MISSING」经逐条人工核对**全部为归一化误报**：

| 初筛误报 | 实际承接处 | 判定 |
|---|---|---|
| `POST /jobs/:id/cancel`、`/retry` | `api/index.js:381` 正则 `(cancel\|retry)` | ✅ 有路由 |
| `GET /assets${suffix}` | `api/index.js:1279` 字面量 `/assets` | ✅ 有路由 |
| `POST /post/${op}` | `api/index.js:1452-1484` 八条字面量 | ✅ 有路由（但**前端零调用**，见下） |
| `GET /wardrobe${kind ?…}` | `api/index.js:1024` | ✅ 有路由 |
| `GET /motionshots${projectId ?…}` | `api/index.js:1102` | ✅ 有路由 |
| `GET /vault/cards${q ?…}` | `api/index.js:674` | ✅ 有路由 |
| `GET /vault/cards/:id` | `api/index.js:688` 正则 | ✅ 有路由 |
| `GET/POST /projects/:id/cards` | `api/index.js:718` 正则 | ✅ 有路由 |

### 3.2 方向二：后端路由 → 前端无任何引用（真·死路由）

在 `app-src/src` **全量语料**中搜不到该路径字符串（非仅 `client.ts`）：

| 路由 | 位置 | 说明 / 判定 |
|---|---|---|
| `POST /assets/archive` | `api/index.js:743` | **B-11**：被安全加固过但无消费者；实际归档走内部函数 `archiveBatchOutput`:1512 / `runAndArchive`:1539。 |
| `POST /mw/figure/delete` | `api/index.js:1273` | **B-10**：形象库无法删除。应补前端。 |
| `POST /post/scale` | `api/index.js:1456` | 前端 `postOp()` 定义了但**零调用**；`ToolboxPage` 的 `Domain` 只有 `templates/wardrobe/import/resources/logs`，无后处理页。 |
| `POST /post/crop` | `api/index.js:1460` | 同上 |
| `POST /post/split` | `api/index.js:1464` | 同上 |
| `POST /post/annotate` | `api/index.js:1468` | 同上 |
| `POST /post/extractFrame` | `api/index.js:1472` | 同上 |
| `POST /post/extractAudio` | `api/index.js:1476` | 同上 |
| `GET /resources/previz` | `api/index.js:1058` | 3D 预演产物占用查看无入口（`ToolboxPage` resources 域只用了 `/resources/orphans`）。 |
| `POST /resources/previz/clean` | `api/index.js:1087` | 手动清理入口无前端。 |
| `GET /workflows/diagnostics` | `api/index.js:260` | 首装排障路由，仅供人工/Agent 用，前端未接。 |

> 另有 `client.ts` 中**定义了但全站零调用**的方法（非路由缺陷，仅死代码）：`comicPreflight`:358、`comicExportAll`:362、`mwReplanJob`:371、`mwApplyPlan`:375、`mwUpsertFigure`:378、`mwGenerateJob`:457、`vaultCard`:434、`toolboxMotionShots/Upsert/Delete`:412-416、`postOp`:342、`promptCompile`:383、`promptFromShot`:384。
> **其中 `mwGenerateJob` 与 `mwReplanJob` 的缺失直接造成 B-08（模特台出不了图）与 B-07 的不可见性。**

---

## 四、工作流占位符对照表

`data/workflows/h3-image.json` 共 **8 个** `{{PLACEHOLDER}}`，逐一对照 `runH3Image()` 的 `map`（`host/services/h3-image.js:282-291`）：

| # | 占位符 | JSON 位置 | `map` 中已填？ | 填充来源 |
|---|---|---|---|---|
| 1 | `{{PROMPT}}` | `h3-image.json:19` | ✅ 是 | `h3-image.js:283` → `normalizeImagePrompt(prompt)` |
| 2 | `{{WIDTH}}` | `h3-image.json:20` | ✅ 是 | `h3-image.js:284` → `W`（:261，/32 对齐） |
| 3 | `{{HEIGHT}}` | `h3-image.json:21` | ✅ 是 | `h3-image.js:285` → `H`（:262） |
| 4 | `{{SEED}}` | `h3-image.json:27` | ✅ 是 | `h3-image.js:286` → `job.params.seed` 或随机 |
| 5 | `{{STEPS}}` | `h3-image.json:38` | ✅ 是 | `h3-image.js:287` → `steps`（:277-280，夹到 4–12） |
| 6 | `{{UNET_NAME}}` | `h3-image.json:5` | ✅ 是 | `h3-image.js:288` → `models.unet`（`checkImageModels` 探测） |
| 7 | `{{VAE_NAME}}` | `h3-image.json:13` | ✅ 是 | `h3-image.js:289` → `models.vae` |
| 8 | `{{CLIP_NAME}}` | `h3-image.json:9` | ✅ 是 | `h3-image.js:290` → `models.clip` |

**结论：h3-image.json 占位符 8/8 全部被填充，不存在「JSON 有、map 无」的 P0 漏填。**
替换由 `comfy-client.js:370-383` 的 `deepReplace()` 递归完成，未命中时会保留原样（:374 `return m`），因此**任何未来新增的占位符若忘记加进 map，会静默把字面量 `{{XXX}}` 送给 ComfyUI** —— 建议在 `runH3Image` 提交前加一道断言：deepReplace 后扫描残留 `{{` 并抛错。

> 附：`data/workflows/h3.json`（视频链路，不在本次范围但一并核过）含 21 个占位符，`generator.js:454-481` 的 map 覆盖率同样完整。其中 `{{REF_IMAGE_1}}`/`{{REF_IMAGE_2}}` 由 `resolveRefImages` 动态接线，非固定 map 键，属正常设计。

**model 实际就位情况**（本机实测，`F:\AI视频\ai-runtime\models`）：
- `diffusion_models/minimax_h3_image_pruned_w4a8.safetensors` (11.69 GB) ✅
- `vae/minimax_h3_image_vae_fp16.safetensors` (1.09 GB) ✅
- `text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors` (25.28 GB) ✅

`checkImageModels()`（`h3-image.js:156-194`）会 `ready:true`，故 **B-03 的 OOM 风险是真实可达的**，不是理论问题。

---

## 五、逐模块验证细节（支撑上表）

### 5.1 漫画流水线是否真能跑通
**能跑通，四个阶段都不是 stub：**

1. **分镜抽取** `comic-service.js:64-98`：真实正则切分（`:73-76` 按空行与中英句末标点），按模板 `rows*cols` 铺格，产出 `geometry`。是规则版而非 LLM 版，但功能真实。
2. **提示词计划** `comic-service.js:378-420`：逐格拼「画风 + 角色 + 场景 + 本格内容 + 构图 + 台词 + 质量」，落盘 `planParts`。真实。
3. **逐格出图** `api/index.js:513-599`：`planParts` 存在性校验（:518-520）→ 加载工作流（:522）→ 检查模型（:524-525）→ 在 `withLocalSlot('h3-image', …)`（:555）内串行执行，**正确借了并发槽位**（避免与视频抢 12GB 卡）→ 复制到 `comic/panels/`（:571-574）→ `setPanelImage` 回写（:575-577）→ 归档素材库（:581-586）。真实且完整。
4. **SVG 导出** `comic-service.js:298-332` / `renderPageSvg:126-156`：**图片确实以 base64 data URI 内嵌**（:311-317），SVG 自包含，不依赖外部路径 —— README:22 宣称的「内含图片的 SVG 导出」属实。

**但**：`exportAllSvg` 的路径守卫缺失（B-02），且 3 套版式几何算错（B-04/05/06）。

### 5.2 模特工作台的风格定义
**6 电商 + 10 影视全部存在且真实**：`ECOM_STYLES` `model-workbench.js:40-47`（studio-clean / lifestyle / street / french / vintage / minimal），`FILM_STYLES` `:50-61`（ink-wuxia / ancient / modern / cyber / wasteland / fantasy / noir / pastel / steampunk / horror）。`planPrompts` 在 `:172` 把 `style.hint` 拼进「画风：…」，**是真实生效的**。`createJob`（:255-284）与 `replanJob`（:304-315）都调 `planPrompts` 并落盘 `job.plan`，**均非 stub**。
`runGeneration`（:406-481）的「主图先行 → 硬伤重试 ≤3 次 → 其余依次」也是真实实现（:417-419 排序 base 优先，:448-466 重试循环）。
**失分点**：`customStyle` 失效（B-07）、前端无出图按钮（B-08）、尺寸被硬编码（B-08）。

### 5.3 画布 Agent
17 工具齐全（`canvas-agent.js:34-52`），`exec()` switch 全部有真实实现（含 `batch` 的防嵌套 DoS 限制 `:288-291`）。**服务端强制权限方向正确**（`api/index.js:1139-1147` 丢弃请求体 `permissions`）。
**致命失分**：权限位无生效通道（B-01），导致 4/17 工具永久不可用；`insert_image` 数据契约错误（B-09）；`run_script` 完全是注释里的幽灵功能（B-14）。

### 5.4 `mp` 是否被使用
**没有。** `mp` 只在两处出现：`h3-image.js:56-67` 的定义、`ImagePage.tsx:163,175` 拼 label 文案（`· ${s.mp}MP`）。**全仓库无任何逻辑读取 `mp`**，它既不做显存预算，也不做面积上限，也不参与 `imageSize()` 查找（:76-80 只按 id 匹配）。这正是 B-03 能发生的原因 —— 一个看起来像"容量指标"的字段实际是纯装饰。

---

## 六、需要修改的文件清单

| 文件 | 涉及缺陷 | 改动性质 |
|---|---|---|
| `host/services/canvas-agent.js` | B-01, B-14, B-16 | 权限写入口导出 / 删除 `runScript` 幽灵字段 |
| `host/api/index.js` | B-01, B-08, B-11, B-12 | 新增 `/canvas-agent/permissions`；:1188 尺寸改用 `job.sizeId`；`/breakdown/generate` 加 `breakdown` 标记 |
| `host/services/comic-service.js` | **B-02**, B-02, B-04, B-04b, B-05, B-15 | :347 换 `resolveUserPath`；修正 3 套版式几何；构图判断 |
| `host/services/h3-image.js` | **B-03**, B-06, B-13 | 新增面积/显存守卫并让 `mp` 参与判断；`sizeForPurpose` 删除或接线 |
| `host/services/model-workbench.js` | B-07 | `planPrompts` 读 `customStyle` |
| `app-src/src/pages/ModelWorkbenchPage.tsx` | B-08, B-10, B-17 | 加「出图」「重算提示词」「删除形象」按钮；更新过期文案 |
| `app-src/src/pages/ComicPage.tsx` | B-18 | `planCount` 从 `doc.planParts` 回填 |
| `app-src/src/canvas/CanvasAgentPanel.tsx` | B-01, B-16 | 权限开关接真实接口 |
| `app-src/src/api/client.ts` | B-10 | 补 `mwDeleteFigure`、`canvasAgentSetPermissions` |
| `app-src/src/canvas/nodes/_shared.tsx` 或 `canvas-agent.js` | B-09 | 二选一：节点读 `params.fileUrl`，或后端写 `result.url`（**建议改后端**，与上传链路一致） |
| `README.md` | B-03 | :20 「12GB 显存可跑」需注明仅限 ≤4.3MP，4K 档需 48GB+ |

---

## 七、复核方式（可复现）

1. **占位符**：`grep -o '{{[A-Z0-9_]*}}' data/workflows/h3-image.json | sort -u` → 8 个；对照 `h3-image.js:282-291` 的 8 个键，完全一致。
2. **几何**：对 `comic-service.js:104-118` 的 `panelGeometry` 逐模板跑 `top_wide`(4格) / `bottom_wide`(4格) / `five_panel`(6格)，检测 `x+w>1`、`y+h>1` 与两两矩形相交 → 复现 B-04/05/06。
3. **权限**：`grep -rn 'setCanvasPermission' host/ app-src/` → 仅 `canvas-agent.js:84` 定义处，零调用 → B-01。
4. **customStyle**：`grep -n 'customStyle\|job.style' host/services/model-workbench.js` → 写入 :264/:327/:351，判断处 :149 读的是 `job.style`，无赋值点 → B-07。
5. **路由**：见第三节脚本逻辑（对 `route === '...'` 字面量与 `route.match(/^.../)` 正则双向比对）。

---

*审计过程中曾创建临时脚本用于路由双向比对，已删除。除本报告外未改动任何文件。*
