# 功能实现度审计报告（impl-audit）

> 审计对象：AI 视频制作 DSH 插件工程 `F:\AI视频\工作室\`
> 审计角色：impl-auditor（只读审计，未修改任何代码/数据文件；唯一写入 = 本文件）
> 审计时间：2026-11-10 11:05—11:35（Asia/Shanghai）
> 审计基线（实测固定的文件修订，审计期间有队友在改文件，故记录哈希以便复现）：
>
> | 文件 | 字节 | mtime | SHA-256 前 12 |
> |---|---|---|---|
> | `dsh-ai-video-studio\index.js` | 60,742 | 11:12:56 | `C57DEAA9E198` |
> | `dsh-ai-video-studio\client.js` | 104,583 | 11:11:49 | `37027B3F4B2F` |
> | `services\previz\server.mjs` | 8,044 | 11:15:48 | `C6A287D9FE7B` |
> | `services\previz\engine.mjs` | 924,403 | 2026-11-09 22:42 | `8200184A5271`（11:34 被队友改为 924,405B / `B1964CE1061B`，用于去原软件名；**关键行为已复核，结论不变**，见 §10 注） |
> | `services\previz\tools\render-previz.mjs` | 8,561 | 22:36 | `E0D8D17A535F` |
> | `services\previz\web\render.html` | 11,230 | 22:36 | `B071533074E0` |
> | `data\workflows\h3.json` | 2,121 | 21:37 | `A4D8D07C892D` |
>
> 运行环境：DSH Web GUI `http://127.0.0.1:8670`（插件 API 免认证 `…/ai-video-studio/api/*`）；预演服务 `http://127.0.0.1:4318`（`engine:"port"`，host 进程 PID 8808 的子进程 PID 15124 运行 `services\previz\server.mjs`）；ffmpeg/ffprobe 9.0.2（gyan build）在 `工作室\tools\ffmpeg\bin\`；node v24.22.2（`F:\Deepseek_harness\rea-agent\runtime\node.exe`）。
>
> **证据标注约定**：
> - 「读码确认」= 逐行读了源码/数据文件得出，未运行；
> - 「实测确认」= 本轮真实 HTTP/进程/ffmpeg 调用并记录返回值，命令与结果可在文末 §9 复现清单重跑；
> - 「静态校验」= `node --check` 通过（只验证语法，不证明功能）。

---

## 1. 总览

### 1.1 11 个工具 × action 实现度汇总

| 工具 | action 数 | ✅ 完整 | ⚠️ 部分 | 🚧 桩/占位 | ❌ 未实现 |
|---|---|---|---|---|---|
| `studio_config` | 3 | 3 | 0 | 0 | 0 |
| `studio_project` | 5 | 5 | 0 | 0 | 0 |
| `studio_shot` | 5 | 4 | 1 | 0 | 0 |
| `studio_prompt` | 3 | 3 | 0 | 0 | 0 |
| `studio_generate` | 1 | 1（仅 mock 端到端） | 0（后端另记：h3/seedance 见 §B） | 0 | 0 |
| `studio_jobs` | 4 | 2 | 2 | 0 | 0 |
| `studio_assets` | 5 | 5 | 0 | 0 | 0 |
| `studio_backend` | 2 | 1 | 1 | 0 | 0 |
| `studio_previz` | 12 | 10 | 2 | 0 | 0 |
| `studio_post` | 8（op） | 8（代码/滤镜链全通） | 0 | 0 | 0（**但无 UI 入口**，见 §5） |
| `studio_qc` | 1 | 1 | 0 | 0 | 0 |
| **合计** | **49 个可调用单元** | **43** | **6** | **0** | **0** |

**加权结论**：
- **工具层实现度 ≈ 88%（43/49 完整，6 个部分实现）**，**0 个动作是"返回假数据的桩"**：全部 handler 都有真实分支逻辑，也没有"直接抛错占位"的分支（所有抛错都是真实校验失败）。
- 但"工具层完整"≠"用户可用"：`studio_post` 虽然 8 个 op 全通，**插件 UI（client.js）完全没有调用 `/post`**（`grep "'/post'"` 命中 0），只能由 Agent 通过工具调用使用；`studio_previz` 的 12 个 action 里 UI 只接了 queue 中的一部分（详见 §1.2 与 §4）。
- 生成链路：3 个后端里 **只有 mock 端到端跑通**，H3/Seedance 适配器代码完整但"未接外部环境"（详见 §B）。

### 1.2 四大子系统进度

| 子系统 | 进度 | 依据（一句话） |
|---|---|---|
| **生成（Generation）** | **≈ 45%** | mock 真出片 ✅；提示词编译/校验 ✅；h3-local 代码闭环但 ComfyUI 不可达、模型/节点名占位 ⚠️；seedance 代码闭环但无 Key/模型 ID ⚠️；任务队列**无并发控制、无崩溃恢复、取消不生效** ❌ |
| **预演（Previz）** | **≈ 85%** | 15 个 `director_*` 全部可执行（实测 state/catalog/frame/package 返回真实求值）；像素渲染管线实测跑通（12 帧、4381ms、1600×900）；UI 侧实测接了 9 个 action（health/state/url/start/stop/frame/attach/render/command，见 §A.9）；缺：`catalog`/`tools`/`package` 3 个 action 仅 Agent 可用、UI 的 `/previz/command` **只调了 `director_add_element` 一个命令**（其余 14 个命令 UI 无入口）、`engineShotId` 字段从未写入导致 package 永远取第一个镜头、`attach` 不写 firstFramePath/lastFramePath ⚠️ |
| **后处理（Post/QC）** | **≈ 70%** | 8 个 op 的 ffmpeg 参数逐条实测跑通；qc 实测通过（含缺文件/无音频分支）；**缺 UI 入口**（client.js 0 处 `/post` 调用）⚠️ |
| **资产包（Assets）** | **≈ 80%** | mount/verify/list 实测通过（5 包、0 error）；2,102 条 manifest 条目全量静态校验 missing=0；缺：`resolve` **无任何调用方**（生成链路不使用资产）、无 sha256 校验、条目全为绝对路径指向拆解目录（不可迁移）⚠️ |
| （跨切面）**数据持久化** | **≈ 55%** | 原子写（tmp+rename）✅；但 `jobs.json`/`projects.json` 读-改-写**无锁**、并发丢更新；进程崩溃后 `running/queued` 任务**无恢复逻辑**；`cancel` 只改状态不中断执行 ⚠️ |

---

## 2. §A 工具 × action 完整矩阵

> 行号为 `index.js`（60,742B / 1,001 行）实测行号；「证据」列给函数名 + 行号；「验证」列标注 读码 / 实测。

### A.1 `studio_config`（L810–812）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `get` | ✅ | `cfg()` 合并 `DEFAULTS`(L19–35)+`config.json`(L88–94) | 无 | 实测 `GET /config` → 200，`dataDir/previzPort/ffmpegDir` 等 13 字段正确 |
| `set` | ✅ | `saveConfig`(L93) → `writeJson` 原子写(L67–72) + `initDirs()`(L108) | 无 | 读码（本次审计遵约束未调用 `POST /config`） |
| `selfcheck` | ✅ | `selfCheck()`(L773–801)，12 项检查（dataDir/assetRoot/ffmpeg/ffprobe/placeholder/previzExe/previzPortSrc/previz/comfyui/seedance/assetPacks/jobs） | ffmpeg、4318、ComfyUI | **实测** `GET /selfcheck` → `ok:true`，12 项里 10 ok、`comfyui:false`、`seedance:false`（符合未配环境预期） |

### A.2 `studio_project`（L813–823）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `list` | ✅ | `listProjects()`(L114) → `projects.json` | 无 | 实测 `GET /projects` → 1 条 `proj_mw3cyjed10x18` |
| `create` | ✅ | `createProject`(L116–122)：push + 原子写 + 建 shots 目录 | 无 | 读码 |
| `get` | ✅ | `getProject`(L123) | 无 | 读码 |
| `update` | ✅ | L820–822 `Object.assign` 白名单字段 + `updatedAt` | 无 | 读码 |
| `delete` | ✅ | L819 过滤后整体保存 | 无 | 读码；⚠️ 注：仅删 `projects.json` 记录，**不级联删除** `shots/<id>/` 目录与关联 job（孤儿数据），属设计缺口非功能缺失 |

### A.3 `studio_shot`（L824–833）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `list` | ✅ | `listShots`(L125) | 项目存在(L827) | 实测 `GET /projects/{id}/shots` → 1 条，`previz` 字段含渲染产物 |
| `create` | ✅ | `newShot()`(L127–142) 补齐 20+ 字段默认值 | 同上 | 读码 |
| `get` | ✅ | L830 | 同上 | 读码 |
| `save` | ⚠️ | L832 `upsertShot`。**`save` 是整体覆盖**（客户端传整个 shot 对象）；若客户端传的对象缺字段会丢字段。实测 `client.js` saveShot(L1458–1464) 传的是完整 state，可用；但 API 契约本身无字段合并/校验 | 同上 | 读码 + client 侧读码 |
| `delete` | ✅ | L831 过滤保存 | 同上 | 读码；同 project.delete 的孤儿数据缺口 |

### A.4 `studio_prompt`（L834–842）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `compile` | ✅ | `compilePrompt`(L154–185)：4 种模式（t2v/i2v/fl2v/ref2v）分支，ref2v 生成 H3 六段式（subject_definitions/summary/retention_analysis/detailed_description/overall_soundscape/non_diegetic_music），其余生成三段式 + 首尾帧对齐头 | 无 | **实测** `POST /compile` → 200，471 字符，`validation.ok=true`、`warnings=[]`，六段式结构正确（见 §9 复现） |
| `validate` | ✅ | `validateShot`(L186–202)：模式枚举、4–15s、参考文件数（9/3/3、合计 12）、i2v/fl2v 图片下限、7000 字符上限 | 无 | 读码；compile 响应内已带 validation，实测 ok |
| `save` | ✅ | L840 把编译结果写 `promptOverride` 并 `upsertShot` | 无 | 读码（写 `shots.json`，审计未调用以免改数据） |

### A.5 `studio_generate`（L843–845）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| 提交任务（唯一 action） | ⚠️ | `createJob`(L286–301) → `runJob`(L302–315) 分发到三后端；**任务立即在进程内 `runJob` 启动，不落队列**；`maxConcurrentLocal:1`(L30) **定义后从未被读取**（`grep` 命中 1 处=定义本身） | 见 §B | **实测**：`jobs.json` 有 1 条 completed 的 mock 任务，产物 `outputs/job_mw3d1gbj952ft.mp4` 存在（2,848,208B）；本次审计遵约束**未**调用 `POST /generate` |

### A.6 `studio_jobs`（L846–854）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `list` | ✅ | `listJobs()`(L273) 按 `createdAt` 倒序，limit 1–100 | 无 | 实测 `GET /jobs` → 1 条 |
| `get` | ✅ | `getJob`(L275) | 无 | 读码 |
| `retry` | ⚠️ | L852 **新建一个 job 重跑**，旧 job 保留；不复用 `remoteId`，也不检查旧 job 是否仍 running（可能对同一镜头并发起两个任务） | 镜头仍存在 | 读码 |
| `cancel` | ⚠️ | L851 / L946 **只把 `status` 改成 `cancelled`**，不 `kill` 子进程、不 abort fetch、不通知 ComfyUI/Seedance；`runJob` 完成时还会把状态覆盖回 `completed`（L309）。实测任务已完成，未触发；**读码确认是"假取消"** | — | 读码 |

### A.7 `studio_assets`（L855–863）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `list` | ✅ | `listPacks()`(L254–270)：实时重读 manifest，暴露 `entries`（实时）/`cachedEntries`（挂载时）/`stale`/`error`；**实测 5 包 0 error，其中 `previs-3d-cc0` 为 `entries:572 / cachedEntries:680 / stale:true`**（manifest 于 11:10 条目数由 680→572，挂载记录未刷新），其余 4 包 stale=false | `mounts.json` + 各包 `manifest.json` | **实测** `GET /assets` → 5 包，license 元数据完整；stale 判定工作正常 |
| `mount` | ✅ | `mountPack`(L214–222)：`fs.existsSync` → `readManifest` 校验 `id/entries` → 写 `mounts.json`（缓存 entries/license，`readonly:true`） | 目录 + manifest | 读码（遵约束未调用） |
| `unmount` | ✅ | `unmountPack`(L223–228)，未挂载返回 `{ok:false,error:'未挂载'}` | 同上 | 读码 |
| `verify` | ✅ | `verifyPack`(L229–241)：逐条 `path` 存在性检查 → `{ok, entries, missing, license}`；**比 mount 多一步真实存在性校验** | 同上 | 读码；另用 §E 的静态脚本对 5 包全量校验（4 包外置路径 missing=0） |
| `resolve` | ✅（代码）/ ⚠️（实际无人调用） | `resolveAsset`(L242–253)：`packId:entryId` → 校验挂载/条目/文件存在 → 返回 `absPath/type/meta`；错误码 `ASSET_PACK_NOT_MOUNTED`/`ASSET_ENTRY_NOT_FOUND`/`ASSET_FILE_MISSING` | 同上 | 读码；**全仓 grep `resolveAsset` 仅 L242 定义 + L862 工具出口，生成链路从不调用资产** |

### A.8 `studio_backend`（L864–866）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `health` | ✅（真实探测）/ ⚠️（mock 恒 true） | `backendHealth`(L461–471)：mock 硬编码 `ok:true`；h3-local 真打 `GET /system_stats`(2.5s 超时)；seedance 只查 Key+Model 是否配置（**不发请求验证 Key 有效性**） | ComfyUI | **实测** `GET /backends` → mock true、h3-local `fetch failed`(8188 拒绝)、seedance `AUTH_REQUIRED` |
| `capabilities` | ⚠️ | `backendCapabilities`(L472–478)：**硬编码常量表**（能力/分辨率/参考数），不随实际环境变化；例如 h3-local 宣称 firstFrame/lastFrame 支持，但工作流模板里首尾帧节点是占位 | 无 | 读码；UI 后端页读 `caps`(client L1065) 直接展示该表 |

### A.9 `studio_previz`（L867–890，12 个 action）

| action | 实现度 | 证据 | 依赖 | 验证 |
|---|---|---|---|---|
| `start` | ✅ | `previzStart`(L495–526)：优先 port 版 `server.mjs`（spawn 本进程 execPath + PREVIZ_HOME/PORT），回退闭源 exe；健康轮询 30×400ms | 4318 空闲 | 读码；**实测服务当前由 host 自动拉起并在线**（`GET /previz` health.ok=true, mode=port） |
| `stop` | ✅ | `previzStop`(L527–532) `child.kill()` | 有子进程 | 读码（遵约束未调） |
| `health` | ✅ | `previzHealth`(L485–494) → `GET /api/health` 2.5s 超时 + `mode: body.engine` | 4318 | **实测** `GET /previz` → `{ok:true,running:true,mode:"port"}` |
| `state` | ✅ | `previzState`(L533–538) → `GET /api/project` 5s 超时 | 4318 | **实测** `GET /previz/state` → 43,527B 裸 State，`project/runtime/catalog/health/agent_rules` 齐全 |
| `command` | ✅ | `previzCommand`(L539–548) → `POST /api/command` 15s；透传任意 `name`+`args` | 4318 | **实测** 经 `GET /previz/frame` 与 node 直调 service 验证 15 个命令分发器存在；另行实测未知命令返回 400 `Unknown Director command`（错误透传正确） |
| `catalog` | ✅ | L875：从 state 取 `catalog`+`health` | 4318 | **实测** state 内 catalog：actions 58 / cameras 28 / actors 7 / props 10 / performances 8 |
| `tools` | ✅ | L876：返回 `agent_rules`（4 条）+ 说明 | 4318 | **实测** agent_rules.count=4 |
| `frame` | ✅ | `previzFrame`(L549–556) → `GET /api/frame?timeSec=` 8s；缺 timeSec 时用镜头 startSec | 4318 | **实测** `GET /previz/frame?timeSec=1.5` → 真实求值：`camera{0,2.2,7.2}/fov50`，`Actor 1 poseId=walk`、7 个关节角度非零（见 §9） |
| `package` | ⚠️ | `previzPackage`(L557–566) → `POST /api/previz-package`；**`shotId` 透传的也是插件侧 ID，引擎内部按 `plan.shots.find(s.id===shotId)` 匹配，插件从不写入 `previz.engineShotId`（全仓仅 L572 读取，0 处写入）→ 实际永远走 `|| plan?.shots[0]`，只能导出第 1 个镜头** | 4318 | 读码 + **实测**（node 直调 engine：`previzPackage(undefined)` 与 `previzPackage('shot-kY8Z0HCT')` 都能正确导出；但插件路径下 `shot.previz.engineShotId` 为 undefined，只能拿 Shot 1） |
| `attach` | ⚠️ | `attachPrevizToShot`(L568–589)：取包 → 写 `data/previz/<shotId>/previz-package.json` → 更新 `shot.previz`（engine/packagePath/shotId/首尾帧时间/frames）。**不写 `firstFramePath`/`lastFramePath`/`controlVideoPath`**，而 `resolvePrevizArtifacts`(L341–356) 只认这 4 个字段 → **预演→生成联动在工作流层面实际不生效** | 4318 + shots.json | 读码；数据侧证据：`shots.json` 的 `previz` 只有 `render.firstFrame='first.png'`（相对 render 目录），无 `firstFramePath` |
| `render` | ✅ | `renderPreviz`(L599–652)：清旧帧 → spawn `render-previz.mjs`（--base/--out/--samples/--long/--fps/--video/--ffmpeg，300s 超时）→ 读 `render.json` → 回写 `shot.previz.render` | Edge headless + WebGL(SwiftShader) + ffmpeg | **实测** `POST /previz/render` → `ok:true, code:0, frameCount:12, first/last/control.mp4, aspect 16:9, longSide 1600, elapsedMs 4381, renderer.three=184, objects=2`，耗时 5s；产物已回写 `shots.json` |
| `url` | ✅ | L874 / L960 返回 `http://127.0.0.1:<previzPort>/` | 4318 | **实测** `GET /previz/url` → `{"url":"http://127.0.0.1:4318/"}` |

### A.10 `studio_post`（L891–905 / 实现 L704–751，8 个 op）

| op | 实现度 | ffmpeg 参数（代码原文摘要，L716–746） | 验证 |
|---|---|---|---|
| `transcode` | ✅ | `-c:v <videoCodec|libx264> -crf <crf|18> -preset <preset|medium> -c:a <audioCodec|aac> -b:a <audioBitrate|192k>` | 读码 + **实测滤镜链（§9）**：exit 0 |
| `scale` | ✅ | `-vf scale=W:H:flags=lanczos -c:a copy`，W/H 缺省 1280/720 | 同上 exit 0 |
| `fps` | ✅ | 与 `interpolate` 共用分支：`-vf minterpolate=fps=N:mi_mode=mci:mc_mode=aobmc:vsbmc=1 -c:a copy`（N 缺省 48） | 同上 exit 0；⚠️ **`fps` 与 `interpolate` 完全同一实现**，`fps` 语义（改帧率）应用 `-r` 或 `fps` 滤镜、`interpolate` 才该用 minterpolate；当前 `fps` 会用运动插值重算帧，慢且改变观感 |
| `concat` | ✅ | 写临时 list 文件（`file '<abs>'`，单引号转义）→ `-f concat -safe 0 -i list -c copy` | 同上 exit 0（2 段拼接 1,378,354B）；⚠️ 临时 list **不清理**，`data/post/` 会累积 `<uid>concat.txt` |
| `subtitle` | ✅ | 校验 `subtitleFile` 存在 → 路径 `/`化 + `\:` + `\'` 转义 → `-vf subtitles='<path>' -c:a copy` | 同上 exit 0（文案烧入成功）；ffmpeg 带 `--enable-libass --enable-fontconfig --enable-libfreetype`（实测 buildconf） |
| `extract-frame` | ✅ | `-ss t -i in -frames:v 1 -update 1 out.png`，返回前单独执行、返回 `output/…png` | 同上 exit 0（2,999,477B PNG）；⚠️ 输出名固定把 `.mp4` 后缀替换为 `.png`，`input` 为 png 时不会改后缀（边界小问题） |
| `mix` | ✅ | 要求 ≥2 输入；`-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest` | 同上 exit 0（607,778B） |

**实现度小结**：8 个 op **全部真实调用 ffmpeg**，无空分支、无 mock；`op` 非法时抛 `UNSUPPORTED_OP`（L745）。但：
1. **client.js 没有任何 `/post` 调用**（`grep "'/post'"` = 0）→ 用户在 UI 里用不到后处理，只有 Agent 工具可调；
2. `path.basename(outName)`（L714）会把用户传的任何输出路径压平到 `data/post/`，且不校验扩展名；
3. `fps`/`interpolate` 实现重合（见上）。

### A.11 `studio_qc`（L906–908 / 实现 L753–770）

| 检查项 | 实现 | 验证 |
|---|---|---|
| 文件存在 / 非空 | `existsSync` + `size===0` → `NOT_FOUND`/`EMPTY_FILE` | **实测** 缺文件 → `{ok:false, issues:[NOT_FOUND ...]}` |
| ffprobe 可解析 | `probeMedia`(L684–702) `-print_format json -show_format -show_streams` | **实测** mock 产物 → `probe.ok`，`duration 5.7585s / 1920×1080 / h264 / aac / hasAudio true` |
| 时长 ≥0.5s | `TOO_SHORT` | 实测短控制视频 0.5s 未误报（等于阈值不触发） |
| 有视频轨/宽高 | `NO_VIDEO` | 实测通过 |
| 音频轨 | `NO_AUDIO`（warn） | **实测** `control.mp4`（无音轨）→ `warn NO_AUDIO`，`ok:true`（warn 不判失败，符合设计） |
| 时长 ≤30s | `OVER_LIMIT`（warn） | 读码 |
| 「首帧可解码」 | **实际没有独立首帧解码检查**：只靠 ffprobe 能解析 + 有视频轨推断；工具描述（L906）写了"首帧可解码"，属**描述超出实现** | 读码 |

---

## 3. §B 后端适配器逐条

### B.1 `mock` —— ✅ 真实 ffmpeg 合成（不是 copy 样片），但历史产物是样片

`runMock`（index.js L316–334）：
```js
// L322 主路径：真调 ffmpeg 合成纯色+静音视频
runCommand(ffmpeg, ['-y','-f','lavfi','-i',`color=c=0x102a4c:s=1344x768:d=${dur}:r=24`,
                    '-f','lavfi','-i','anullsrc=r=32000:cl=stereo','-shortest',
                    '-c:v','libx264','-pix_fmt','yuv420p','-preset','ultrafast','-c:a','aac','-t',dur,out])
// L325–333 仅在 ffmpeg 抛错时兜底 copy <dataDir>/../assets/placeholder.mp4
```
- **结论（读码确认）**：mock **首选调 ffmpeg 合成**（纯色 `#102a4c` + 静音 AAC），只有 ffmpeg 不可用才 fallback 复制 `工作室\assets\placeholder.mp4`（2,848,208B）。**不是**"直接 copy 预置样片"。
- **实测佐证**：
  1. 用同样参数以 `-f null -` 跑通，exit=0（§9 复现 #4）；
  2. 现有 `data/outputs/job_mw3d1gbj952ft.mp4`（2,848,208B）与 `assets/placeholder.mp4` **SHA-256 完全相同**（`05BD857A…BBD8F5`），`jobs.json` 的 `note` 写「mock 占位视频（本地 5 秒样片；ffmpeg 不可用）」，且文件 mtime 2026-11-05 17:37 **早于** ffmpeg 安装时间 21:31 → 该历史产物确为 fallback 路径产物。
  3. 该产物 `1920×1080 / 30fps / 5.7585s`，与 mock 合成参数（1344×768 / 24fps / 5s）完全不同 → 进一步证明它是样片而非 ffmpeg 合成物。
- **缺口（读码确认）**：mock **忽略 `shot.ratio`/`profile`**，分辨率硬编码 1344×768（L322），而 UI 上档位/比例可调；mock 也不消费 `{{FIRST_FRAME}}` 等预演产物（本来也不需要）。

### B.2 `h3-local`（ComfyUI）—— ⚠️ 代码闭环完整，缺"真实环境"；**另有两处真实代码洞**

`runH3Local`（L358–402，55 行）逐环节：

| 环节 | 实现 | 评价 |
|---|---|---|
| 配置校验 | `if (!c.comfyUrl) throw CONFIG_MISSING` | ✅ |
| 工作流模板 | 读 `data/workflows/h3.json`，缺则 `MODEL_MISSING` | ✅（文件存在 2,121B） |
| 占位符注入 | `deepReplace`(L438–458)：字符串精确匹配、`{{X}}` 正则替换、数字表达式求值（`{{DURATION}}x{{FPS}}` → 120）；`{PROMPT,DURATION,SEED,WIDTH,HEIGHT,STEPS,CFG,FPS,PROFILE,RATIO}` + 预演 4 个占位符 | ✅ 逻辑完整；**实测** h3.json 里 14 类占位符与 map 键一一对应 |
| 分辨率/档位 | `resolutionFor(profile, ratio)`(L53–61) 按比例算面积、8 对齐；`profileOf` 取 steps/cfg | ✅ |
| 提交 | `POST {comfyUrl}/prompt`，`{prompt: wf, client_id: job.id}`；非 2xx → `BACKEND_ERROR: ComfyUI <status>` | ✅ |
| 轮询 | 600 次 × 3s（**最长 30 分钟**）`GET /history/{prompt_id}`，`!hr.ok` → `continue` | ✅ 但**网络错误/5xx 直接静默 continue**，会耗尽 30 分钟；**`job.status` 只在提交后更新一次**（L379），轮询期间 UI 看不到进度 |
| 产物提取 | 遍历 `entry.outputs[*].{videos,gifs,images}`，取第一个 `mp4/webm/mov/gif`，没有则第一个文件 | ✅ 兼容 VHS_VideoCombine 等常见节点 |
| 下载 | `GET /view?filename&subfolder&type` → 写 `outputs/<jobId><ext>` | ✅ |
| 超时/错误码 | `TIMEOUT: ComfyUI 任务超时`；`DOWNLOAD_FAILED`；`BACKEND_ERROR` | ✅ |

**代码洞（读码确认，按影响排序）**：
1. 🔴 **`h3.json` 的 `{{FIRST_FRAME}}/{{LAST_FRAME}}/{{CONTROL_VIDEO}}/{{PREVIZ_PACKAGE}}` 只出现在 `_comment` 注释里（各命中 1 次 = L2），没有任何节点引用**。实测当前 `shot.previz` 键只有 `engine/packagePath/shotId/firstFrameTimeSec/lastFrameTimeSec/frames/attachedAt/render`：`resolvePrevizArtifacts`(L341–356) 因此只产出 `{{PREVIZ_PACKAGE}}` 一项（`firstFramePath/lastFramePath/controlVideoPath` 从未被写入）；`{{FIRST_FRAME}}/{{LAST_FRAME}}/{{CONTROL_VIDEO}}` 三个占位符在工作流里**保持字面量原样**（`deepReplace` 找不到 key 就不替换），且没有任何节点会消费它们。→ **"预演→H3"联动在模板层是断的（双向都没通）**。
2. 🟠 **工作流是硬编码的"通用 H3"模板**：`CheckpointLoaderSimple` 载入 `minimax_h3.safetensors`、`CLIPTextEncode`、`EmptyHunyuanLatentVideo`、`KSampler`、`VAEDecode`、`VHS_VideoCombine`。**仓库内不存在任何 H3 模型文件**（全盘扫 `*.safetensors/*.ckpt/*.pt/*.pth` = 0 个）。模板注释自己也写「节点 ID 与 type 需按本机 ComfyUI 实际安装的 H3 节点名调整」。→ 即使 ComfyUI 在跑，这个模板大概率提交失败（取决于本机装的节点）。
3. 🟠 **不支持参考图/视频/音频注入**：`shot.refs.images/videos/audios`（镜头卡上有 9/3/3 容量）**根本没进工作流**，`{{...}}` map 里没有 refs。ref2v/i2v/fl2v 三个模式的语义在 H3 后端完全落空。
4. 🟠 **无并发闸门**：`maxConcurrentLocal:1` 定义了但从未读取（L30 是唯一命中）；连点两次生成会并行打两个 ComfyUI 任务（显存冲突）。
5. 🟡 `AbortSignal` 未用于 fetch（只用于 health），无请求级超时；`client_id` 未用于 `/queue` 取消，`cancel` 无法停 ComfyUI 任务。

**ComfyUI 可达性（实测）**：`GET http://127.0.0.1:8188/system_stats` → 连接被拒绝；`/backends` → h3-local `ok:false, detail:"fetch failed"`。

> **一句话结论**：`runH3Local` 的**提交/轮询/下载/超时/错误码框架写完了、写得不错**，缺的不只是"没有 ComfyUI 实例"，还有 3 个真实洞：**首尾帧/控制视频节点缺失**、**H3 节点名与模型未落地**、**参考素材不进工作流**、**并发无闸门**。

### B.3 `seedance-cloud` —— ⚠️ 提交/轮询/下载代码完整，缺 Key + 模型 ID，另有轮询语义风险

`runSeedance`（L403–436）：

| 环节 | 实现 | 评价 |
|---|---|---|
| 前置校验 | 缺 Key → `AUTH_REQUIRED`；缺 Model → `CONFIG_MISSING` | ✅ 实测 `/backends` seedance `AUTH_REQUIRED` |
| 请求体 | `{model, content:[{type:'text',text:prompt}], resolution: (P24→1080p else 720p), ratio, duration: min(30,dur), seed, watermark:false}` | ✅ 字段与火山方舟 Ark 契约一致 |
| 提交 | `POST {seedanceEndpoint}`，Bearer Key；非 2xx → `BACKEND_ERROR: Seedance <status>` | ✅ |
| 轮询 | 240 次 × 10s（**最长 40 分钟**）`GET {endpoint}/{id}` | ✅ 有 |
| 状态判定 | `succeeded/completed/success` → 下载；`failed/error` → 抛错；其它继续 | ⚠️ **Ark 实际状态枚举是 `queued/running/succeeded/failed/expired/cancelled`**，这里漏了 `expired`（超时/过期会一直轮询到 40 分钟） |
| 下载 | `content.video_url` 或 `video_url` → fetch → 写 `outputs/<jobId>.mp4` | ✅ |
| 成本 | `job.cost = {model, usage}` | ✅ 有记录 |
| 超时 | `TIMEOUT: Seedance 任务超时` | ✅ |

**缺什么（读码 + 实测）**：
- `seedanceApiKey=''`、`seedanceModel=''`（`GET /config` 实测），`data/config.json` **不存在**（全靠 env/默认值）；
- 只有 `content: [{type:'text'}]`，**不传参考图/视频**（Ark 支持 `image_url`/`image_tail_url`）→ i2v/fl2v/ref2v 语义同样落空；
- 轮询期间 `updateJob(job)`（L433）每次落盘，但没有 `job.status` 中间态（始终 running）；
- 无 `cancel` 打通（Ark 有 delete task 接口，未用）。

---

## 4. §C 预演链路逐条

### C.1 预演服务 `services/previz/server.mjs`（148 行）路由清单

| 路由 | 方法 | 实现 | 实测 |
|---|---|---|---|
| `/api/health` | GET | 静态返回 `{ok,service,transport:'http',engine:'port',home}`（service 为契约字面量） | ✅ `200`，与插件 `previzHealth` 对得上 |
| `/api/project` | GET | `service.execute('director_get_state',{})` 裸对象 | ✅ 43,527B（与插件 `/previz/state` 同源同尺寸） |
| `/api/command` | POST | `{name,arguments}` → `{ok,result}`；400 透传引擎错误 | ✅ 实测未知命令 → `400 {"ok":false,"error":"Unknown Director command: director_nope"}` |
| `/api/agent/chat` | POST | `service.agentChat(messages)`；空数组 400 | ✅ **实测** 返回 `400 {"ok":false,"error":"未找到 Codex CLI。请先安装或打开 Codex 桌面版。"}`（无 `DEEPSEEK_API_KEY` + 无 Codex → 两条路径都不可用，见 C.5） |
| `/api/frame` | GET | `service.evaluate(timeSec)` | ✅ 实测真实求值 |
| `/api/previz-package` | POST | `service.previzPackage(shotId,samples)` | ✅ node 直调实测 12 帧/5 帧均正确 |
| `/api/export-package` | POST | 调 package + 写 `<HOME>/packages/<shotId>.previz.json` | 读码（**写文件**，审计未调用） |
| 其他 GET | GET | `serveStatic` 静态托管 `web/`（含 `../` 越界防护 L61–68） | 读码 |
| OPTIONS | — | CORS 204（写死 `http://127.0.0.1:5173`） | 读码 |

**与闭源契约的偏差（读码确认）**：
- 闭源版 `/api/project` 超时时长/错误包装一致，但 port 版**多出** `/api/frame|previz-package|export-package` 三条（自研扩展，闭源无）；
- 闭源版「静态文件 SPA fallback 到 index.html」，port 版**无 fallback**（找不到就 404），对导演台 SPA 的前端路由（若有）可能不友好；实测首页 `/` 可直接出（index.html 存在）；
- 闭源版 `POST /api/agent/chat` 只取最后 12 条、每条 6000 字符（engine 内部实现，port 版沿用）。

### C.2 ported `engine.mjs`（924,403B / 24,902 行）能力边界

**生成方式（读码）**：`tools/build-engine.mjs` 把 `src/previs-src/` 的 vendor（zod/ajv）+ engine + server 三 chunk 拼接，剥离 stdio 传输层与 import，注入 deps 别名，末尾手写 `buildService({home})`（L24317–24901 之外的部分是生成器追加）。→ **engine.mjs 是生成物，不要手改**（文件头注释也这么写）。

**命令面（实测 `service.tools()`）**：15 个全在：

| 能力域 | 命令 | 读写 | 实测/读码 |
|---|---|---|---|
| 读状态 | `director_get_state`（含 project/runtime/catalog/health/agent_rules） | 读 | ✅ 实测 43,527B |
| 工程 | `director_create_project`（重置为 2 演员/4 镜头/15s 模板） | 写 | 读码 `repository.reset`(L24376–24387) |
| 选择 | `director_select`（shot_id / 整数帧 24fps） | 写（activeShotId/currentFrame） | 读码 L24513–24528 |
| 元素 | `director_add_element`（6 kind × 17 preset，支持 position/rotation/scale/color/performance） | 写 | 读码 L24529+；schema `kind enum mannequin/crowd/box/sphere/cylinder/wall`(L22463) |
| 元素 | `director_update_element`（位移/旋转/缩放/改名/换色/可见/身高/pose_id/朝向 facing 5 种/shot_only 单镜覆盖） | 写 | 读码；**shot_only 有 `elementStates` 支持**（L24576/L24595） |
| 动作 | `director_apply_action`（58 个动作模板 + emotion/intensity/from-to/target/facing/proximity/locked） | 写 | ✅ catalog.actions=58 |
| 动作 | `director_set_motion_keyframe`（Bezier path_in/out、path_mode、joints、interpolation 5 种、锁定/override） | 写 | 读码 |
| 相机 | `director_apply_camera`（28 个运镜模板） | 写 | ✅ catalog.cameras=28 |
| 相机 | `director_set_camera_keyframe`（frame/position/target/fov 5–140/roll ±180/interp） | 写 | 读码 |
| 分镜 | `director_manage_shot`（add/duplicate/rename/reorder/delete，时间自动归一化） | 写 | 读码 |
| 锁 | `director_set_lock`（action/motion_keyframe/camera_keyframe） | 写 | 读码 L24781–24799 |
| 删除 | `director_delete`（element/action/motion_kf/camera_kf，locked 需 override） | 写 | 读码 L24800–24828 |
| 历史 | `director_undo` / `director_redo`（最多 50 快照） | 写 | 读码 `R_=50`(L24317) + `past.slice(-50)`(L24370)；`history.json` 实测 58,199B、past=2 future=0 |
| 校验 | `director_validate`（= 重新 get_state 返回 health，**只报告不拦截**） | 读 | 读码 L24500；实测 `project_issues=0`、`plan_issues=3`（真实检出：2 条 walk 无路径 + 1 条动作重叠） |

**能改什么（回答 Lead 的"C 节能力边界"问题）**：能改 —— 镜头（增删改重排）、元素（增删改、单镜覆盖）、姿势（pose_id + joints 逐关节角度）、相机（模板运镜 + 逐关键帧机位/FOV/roll）、动作（58 模板 + 贝塞尔关键帧路径）、锁定、历史。**不是只能读**。

**不能做什么（边界，读码确认）**：
1. **不支持外部 3D 资产（glb/gltf/贴图）**：engine 全文 `glb|gltf|texture` 命中 0；元素几何是程序化 primitive（mannequin/crowd/box/sphere/cylinder/wall）。→ §E 的 572 个 CC0 GLB 资产**与预演引擎不互通**（两套资产体系）。渲染器 `render.html` 同理（`buildObject` 只认这 7 种 kind + billboard）。
2. **无骨骼/蒙皮动画**：mannequin 是胶囊体层级 + 关节旋转，faces 无表情、手无手指（`render.html` L40–80 实测结构）；`performance_profiles` 只调走路姿态参数。
3. **校验只报告**：`director_validate` 不会阻止非法写入（docs/validation_rules.md 也明确"仅碰撞/入地等 error 看起来严重，不拦截"）。
4. **未实现"首帧/尾帧"概念**：`previzPackage` 的 firstFrame/lastFrame 只是采样时长的 0 与 dur（见 C.4 实测），不是可编辑的镜头内关键画面。
5. **agentChat 依赖外部 LLM**：`DEEPSEEK_API_KEY` 或 Codex CLI（macOS 路径为主，Windows 下只有 `CODEX_CLI_PATH` 环境变量一条路）→ 当前**双路径都不通**（实测 400）。

### C.3 渲染管线 `tools/render-previz.mjs`（199 行）+ `web/render.html`（246 行）

**render-previz.mjs 做什么（读码确认）**：
1. `loadPackage()`：`--project` 直读 JSON，否则 `POST {base}/api/previz-package`；
2. `withBrowser()`：spawn Edge `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`，随机 CDP 端口 9300–9900 + 临时 profile，轮询 `/json/list` 60×500ms 拿 page target，连 WebSocket → `Runtime.enable/Page.enable`；
3. 导航 `{base}/render.html`，轮询 `window.__PREVIZ__.ready` 60×500ms；
4. 逐帧：`__PREVIZ__.apply(frame)` → sleep 120ms（等 GPU 提交）→ `__PREVIZ__.capture(aspect, longSide)` 回 base64 PNG → 写 `frame_XXXX.png`；
5. 首尾帧 copy 成 `first.png`/`last.png`；
6. `--video` 且 ffmpeg 可用 → `-framerate fps -i frame_%04d.png -c:v libx264 -crf 18` 出 `control.mp4`；
7. 写 `render.json`（schema/shot/aspect/longSide/fps/frameCount/frames[]/controlVideo/renderer{objects,elementIds,camera,canvas,three}/engine/elapsedMs），stdout 打一行 JSON。
   - 清理发生在**调用方** index.js `renderPreviz`（L609–613，删旧帧/first/last/control/render.json）→ D2 缺陷已修。

**render.html 做什么（读码确认）**：three.js r184（vendored `web/vendor/three.module.js` 648KB）程序化搭建 —— 7 种元素几何（含 mannequin 关节层级 hips/spine/neck/shoulder/elbow/hip/knee + crowd 阵列 + billboard）、关节旋转（度→弧度）、相机 pose（position/fov/lookAt/roll）、取景 `captureShot`（16:9/9:16/4:3/1:1，长边定宽/高，隐藏 grid/ground 后 `toDataURL('image/png')`）。**不加载任何外部模型/贴图**。

**产物实测确认（本轮重跑）**：

```
POST /ai-video-studio/api/previz/render  {"projectId":"proj_mw3cyjed10x18","shotId":"shot_mw3d03scusykq","samples":12,"longSide":1600,"fps":24}
→ {"ok":true,"code":0,"frameCount":12,"firstFrame":"first.png","lastFrame":"last.png","controlVideo":"control.mp4",
   "aspect":"16:9","longSide":1600,"elapsedMs":4381,
   "renderer":{"objects":2,"elementIds":["el-pvcKK2uD","el-AYB5irSI"],"camera":{"position":{x:2.6,y:2.2,z:6.2},"fov":42},
               "canvas":{"width":1248,"height":624},"three":"184"},"stderr":null}
耗时 5s
```
- 磁盘：12 个 `frame_*.png` + `first.png`/`last.png`（1600×900 PNG，ffprobe 实测）+ `control.mp4`（h264 1600×900 24fps **12 帧 = 0.5s**）+ `render.json`；
- **发现（读码+实测）**：`control.mp4` 时长 **0.5s**（12 帧 @24fps），而镜头时长 3.75s —— 采样帧是"关键帧序列"，控制视频按帧序导出 → **它不能直接当 3.75s 的控制视频用**，下游需要按时间轴拉伸/重采样。当前无任何代码做这件事。
- **发现（实测图片）**：`frame_0000.png` 视觉上是两个灰色胶囊人在深灰背景，**两个演员颜色都是灰白**（engine 里 Actor1 `#ff7a66`、Actor2 `#55c2ff`）。原因（读码）：`previzPackage/evaluate` 的输出**不含 `color` 字段**（engine 投影只给 id/name/kind/visible/position/rotationDeg/scale/poseId/joints），render.html `buildObject` 用 `el.color || '#e1e3e7'` → 颜色丢失；`billboard` 的 `heightM` 也同理丢失。
- **发现（实测字节数）**：`frame_0000.png` = `frame_0008/0009/0010.png` = `first.png`（全部 58,499B 且 SHA-256 相同 `7E5CE0D1…`），`frame_0011.png` = `last.png`。即 **12 帧里有 5 帧完全静止**（已知原因：动作 `walk` 的 from=to，位移 0，只做原地关节摆动；且 camera 在前 11 帧不动，只有第 12 帧跳到 Shot 2 的机位 —— 见 C.4）。
- **候选缺陷**：`render.html` 的 `capture()` 里 `renderer.setSize(w,h,false)` 后 `canvas` 实际像素 1248×624（render.json 的 `renderer.canvas` 记录的是**恢复前**？实测 canvas 1248×624 对应 16:9@**未按 longSide 缩放**），但输出 PNG 实测 1600×900 → 说明 `toDataURL` 前尺寸正确，`info()` 拿的是恢复后的画布，属记录口径问题，非功能缺陷。

### C.4 预演包/首尾帧语义（实测数据）

node 直调 engine（只读）实测：
```
previzPackage(undefined, 12) → schema previz.package.v1, frames=12, first.t=0, last.t=3.75, shot=shot-mK2nv54V
previzPackage('shot-kY8Z0HCT', 5) → shot=shot-kY8Z0HCT, start=11.25, frames=5, t0=11.25, tLast=15
evaluate(1.5) → camera {0,2.2,7.2}/fov50, Actor1 poseId=walk joints{hipL:2.47°,hipR:-2.47°,kneeL:12.52°,kneeR:16.76°,shoulderL:-2.12°,shoulderR:2.12°,spine:4°}
```
逐帧实测（12 帧）：
- 相机：**前 11 帧完全静止** `{0,2.2,7.2}/fov50`，第 12 帧跳到 `{2.6,2.2,6.2}/fov42` → 不是平滑运镜，是**跳变**（`shot.cameraMove='static'`，且 `Iz` 在 `t≥duration` 时落到了下一镜头的状态，见下）；
- 姿势：前 11 帧 `walk/stand` 有 7 个关节角度，第 12 帧 `poseId=stand/stand`、**joints 为空对象** → 尾帧与首帧**不是同一组姿态**；
- 原因（读码）：`previzPackage` 的采样公式 `t = startSec + durationSec*i/(n-1)`，最后一帧 t=duration=3.75，`Iz(plan, elements, 3.75)` 在镜头边界落入下一镜头（Shot 2 起始），因此 `lastFrame` 实际是 **Shot 2 的第一帧**！`previz.render.json` 的 `renderer.camera` 也印证（{2.6,2.2,6.2}/42 = Shot 2 机位）。
  → **这是一个真实缺陷**：首尾帧对（H3 首尾帧条件的关键输入）**尾帧取错镜头**。修复应把末帧 t 取 `startSec+durationSec-1/24` 或钳位到镜头内。

### C.5 agentChat（预演助手）实现度

| 路径 | 代码 | 实测 |
|---|---|---|
| DeepSeek API | engine 内 `kl()`：`DEEPSEEK_API_KEY` 存在则 `POST {DEEPSEEK_BASE_URL}/chat/completions`，模型**硬编码 `deepseek-v4-pro`**，600s 超时，最多 20 轮工具循环，变更后自动补 validate | 环境无 `DEEPSEEK_API_KEY`（实测 `$env:DEEPSEEK_API_KEY` 空）→ 不走此路 |
| Codex CLI | `zl()` 依次找 `CODEX_CLI_PATH` / macOS 三路径；`codex exec --ephemeral … --output-schema …`，180s | Windows 下无 macOS 路径、`CODEX_CLI_PATH` 未设 → **实测 400 `未找到 Codex CLI。请先安装或打开 Codex 桌面版。`** |

**结论**：agentChat **两条路径都不通**（环境未配置），但代码是完整移植的，不是桩。UI 未暴露 agentChat（client.js 无 `/previz/agent/chat` 调用）→ 用户在插件里也看不到。

---

## 5. §D 后处理与质检逐条

（`studio_post` 8 op 已在上表 A.10 列过 ffmpeg 参数，这里补"实测证据"与"参数透传完整性"）

**实测方式**：把每个 op 的**代码原文参数**抽出来，在 `%TEMP%` 里用同一 ffmpeg 对真实 mock 产物跑一遍（不写 `data/`）。结果：

| op | 实测 exit | 产出 | 参数透传评价 |
|---|---|---|---|
| transcode | 0 | 875,048B mp4 | 完整：`videoCodec/crf/preset/audioCodec/audioBitrate` 全部可覆盖，有默认值 |
| scale | 0 | 218,555B mp4 | 完整：`width/height` 可覆盖，缺省 1280×720；`flags=lanczos` 固定 |
| interpolate | 0 | 840,525B mp4 | 完整：`fps` 缺省 48，minterpolate 参数写死（质量/速度参数不可调） |
| **fps** | 0（同一链） | — | **语义错误**：应传递 `-r`，实际复用 minterpolate |
| concat | 0 | 1,378,354B | 完整：任意 N 个输入，`-safe 0`、单引号转义正确；**临时 list 文件不删除** |
| subtitle | 0 | 706,241B | 完整：`subtitleFile` 必填 + 存在性校验 + Win 路径转义（`/`、`\:`、`\'`）；实测中文烧录成功（ffmpeg 带 libass/fontconfig/freetype） |
| extract-frame | 0 | 2,999,477B png | 完整：`timeSec` 透传，`-update 1` 防多帧覆盖 |
| mix | 0 | 607,778B | 完整：`0:v:0`+`1:a:0`，`-shortest`；**只支持"第 1 个视频 + 第 2 个音频"，不支持多音轨混音/音量/淡入淡出** |
| （未知 op） | — | — | 抛 `UNSUPPORTED_OP: …（支持 …8 个）`，错误文案完整 |

**质检实测**：
- `POST /qc {path:"outputs\\job_mw3d1gbj952ft.mp4"}` → `{ok:true, probe:{durationSec:5.7585,1920×1080,h264,aac,hasAudio:true,bitrate:3956841}, issues:[]}`；
- `POST /qc {path:"outputs\\nope.mp4"}` → `{ok:false, issues:[{severity:'error',code:'NOT_FOUND'}]}`；
- `POST /qc {path:"previz\\render\\…\\control.mp4"}` → `{ok:true, issues:[{severity:'warn',code:'NO_AUDIO',message:'没有音频轨（H3 原生音频应存在）'}]}` → **warn 不影响 ok** 的分级正确。

**缺口清单（D 节）**：
1. 🔴 **UI 无入口**：`client.js` 中 `/post` 调用 = 0（`grep "'/post'"`），`studio_post` 只能被 Agent 调用；任务页只有「质检」按钮（`/qc` 已接）。
2. 🟠 `fps` 与 `interpolate` 实现重合（语义错位）。
3. 🟠 无超分/上采样（视频增强类）能力：代码里只有一句注释「若配置了 RIFE 可替换」（L722），**RIFE 未实现**。
4. 🟡 `concat` 临时 list 泄漏；`extract-frame` 输出扩展名硬编码 `.png`；`path.basename` 压平输出路径。
5. 🟡 `studio_qc` 工具描述宣称"首帧可解码"，实现只做 ffprobe 元数据（无逐帧解码）。

---

## 6. §E 资产包系统逐条

**实测清单**（`GET /assets` + 静态全量校验脚本）：

| packId | kind | manifest | entries（实时/缓存/stale） | license | 路径形态 | 条目真实存在（静态全量校验） |
|---|---|---|---|---|---|---|
| `test-pack` | template | ✅ | 1 / 1 / false | MIT（allowed） | 相对（`files/hello.txt`） | ✅ 1/1 存在 |
| `previs-3d-cc0` | 3d | ✅ | 572 / 680 / **true**（manifest 11:10 由 680 条减到 572 条，挂载记录仍缓存 680） | CC0-1.0（allowed） | **全部绝对路径指到 `功能拆解\预演软件\04_解包资产\…`** | ✅ 572/572 存在 |
| `node-schema-ref` | schema | ✅ | 191 / 191 / false | NOASSERTION（forbidden，仅本地） | 绝对路径 | ✅ 191/191 存在 |
| `enhance-schema-ref` | schema | ✅ | 870 / 870 / false | NOASSERTION（forbidden） | 绝对路径 | ✅ 870/870 存在 |
| `previs-asset-index` | 3d | ✅ | 468 / 468 / false | NOASSERTION（forbidden） | 绝对路径 | ✅ 468/468 存在 |

> 说明：审计开始时 `GET /assets` 曾返回改名前的 packId且 `manifest:null/error:"manifest.json 不存在"`，11:14 后另一 teammate 完成改名与重挂载，现 5 包全部有 manifest、0 error。**本报告以 11:14 之后状态为准**；`previs-3d-cc0` 的 `stale:true` 是「manifest 条目数变更后未重挂载」的**预期行为**（`listPacks` 设计如此，README 也写明“重新挂载即可消除”），不是 bug。

**逻辑完整度（读码）**：
1. `mountPack`(L214)：校验目录 + manifest `id/entries` → 缓存 `entries/license/readonly:true`。**不缓存 manifest 全文**，每次 `listPacks` 重读。
2. `verifyPack`(L229)：逐条 `path` 存在性 → `missing[]`。**不校验 sha256**（manifest 里 **0 条**带 sha256，字段从未生成）。
3. `listPacks`(L254–270)：实时 `entries` 为准 + `cachedEntries` + `stale` + `manifest` 摘要 + `error` —— 设计合理，实测 stale 检测正确（曾出现 680→572 的 stale:true）。
4. `resolveAsset`(L242)：`packId:entryId` → 挂载/条目/文件三重校验 → `{absPath,type,meta}`；错误码规范。
5. **`licenses` 分级在数据里齐全**（allowed / forbidden），但**代码对 `distribution:forbidden` 没有任何拦截或警告**：`resolve` 照样返回路径，`listPacks` 只透传字段。合规上缺一个"禁止分发包内容入成品"的闸门（读码确认）。

**关键缺口（E 节）**：
1. 🔴 **资产体系与生成/预演全链路不互通**：`resolveAsset` 无调用方；`runH3Local`/`runSeedance` 不消费资产；`engine` 不支持 glb（见 C.2）。→ 680+572+468 个条目目前只是"可查询、可校验"的目录，**没有任何一个进入实际生产流程**。
2. 🟠 manifest 绝对路径指向 `功能拆解\`（原始拆解目录）→ 资产包**不可迁移**（换机/移动目录即全 missing）；`verifyPack` 会暴露该问题但不会自动修复。实测 `previs-3d-cc0` 572 条、`node-schema-ref` 191 条、`enhance-schema-ref` 870 条、`previs-asset-index` 468 条的 `path` **全部是绝对路径**（只有 `test-pack` 1 条是相对路径）。
3. 🟠 无 sha256（**实测 5 包 2,102 条 manifest 条目 `sha256` 全为 0 条**，`resolveAsset` 里 `sha256: e.sha256 || null` 恒为 null）→ verify 只能证明"文件在"，不能证明"文件没被改"。条目字段只有 `id/path/type/bytes`（type/bytes 齐全）。
4. 🟡 `mountPack` 的 `packId` 与 manifest `id` 可不同（`packId || manifest.id`），可能造成同一根目录双挂载。

---

## 7. §F 数据模型与持久化逐条

### F.1 文件结构与实测状态

| 文件 | 结构 | 当前实测 | 写入方式 |
|---|---|---|---|
| `data/projects.json` | `[{id,name,description,category,createdAt,updatedAt}]` | 199B / 1 条 | `writeJson` tmp+rename 原子 |
| `data/shots/<projId>/shots.json` | 每镜头 ~30 字段（mode/durationSec/ratio/style/description/camera/dialogue/soundscape/music/subjects/refs/keyframes/control/previz/backend/profile/promptOverride/status/version/timestamps） | 1,264B / 1 条（含 `previz.render` 完整产物摘要） | 同上 |
| `data/jobs.json` | `[{id,projectId,shotId,shotTitle,backendId,mode,status,remoteId,paramsHash,prompt,promptPath,outputs[],cost,error,note,createdAt,updatedAt,params{...}}]` | 1,840B / 1 条 completed | 同上 |
| `data/mounts.json` | `{packId:{packId,root,enabled,mountedAt,entries,license,readonly}}` | 1,795B / 5 包 | 同上 |
| `data/previz/project.json` | 引擎工程 `{version,id,name,aspect,elements[],plans[{shots[{elementStates,cameraKeyframes,actions[]}]}],activePlanId,activeShotId,currentFrame,timestamps}` | 57,532B / 1 plan / 4 shots / 2 elements | 引擎 `qU()`（同样 tmp+rename，L24329–24339） |
| `data/previz/history.json` | `{past:[{label,project,createdAt}],future:[]}` 最多 50 | 58,199B，past=2 future=0 | 同上，**project+history 用 `Promise.all` 双写**（非原子事务） |
| `data/config.json` | 配置覆盖 | **不存在**（全用默认/env） | `writeJson` |

### F.2 并发安全

**插件侧（读码确认）**：
- `writeJson`(L67–72)：`<file>.<pid>.tmp` → `rename` → **单次写原子**（同盘 rename 原子），不会出现半截文件；**但读-改-写序列不原子**：
  - `updateJob`(L276–282)：读全量 → 改一条 → 写全量；
  - `upsertShot`(L143–150)、`saveMounts`、`saveProjects` 同模式。
- **无互斥锁/无队列**：Node 单线程下同步 `readFileSync/writeFileSync` 的临界区**不会被事件循环打断**（这是唯一救命点：因为全是同步 IO，单进程内两个并发 handler 不会交错）；但：
  - ① `runJob` 是 async，**await 期间另一个请求可以完成一次 updateJob** → 后写者覆盖先写者（经典 lost update）：例如 h3 轮询中每 3s 一次 `updateJob`，此时用户 cancel 改 status，轮询结束的 `updateJob` 会把 `cancelled` 覆盖回 `completed`（L309 实测代码路径）。
  - ② 多进程/多窗口（插件被两个 DSH 会话加载）会直接互相覆盖，无文件锁。
- 引擎侧：`history.json` 与 `project.json` 用 `Promise.all` 并行写（L24372）→ 如果只有一个写失败，两个文件会**不一致**（project 已改、history 没记）；无 fsync。

### F.3 崩溃恢复

**实测 + 读码确认：没有恢复逻辑**。
- 启动时（`apply()` L980–1001）只做三件事：注册工具、注册 Web API、自动拉起预演服务。**没有任何"扫描 `jobs.json` 把 running/queued 标为 interrupted"的代码**（`grep 'running'` 仅命中 L303 写状态、L799 自检统计）。
- 后果：进程在任务执行中崩溃/被杀 → `jobs.json` 永远留 `status:"running"`，`remoteId` 指向 ComfyUI 上一个已丢失的任务，**无法续跑也无法自动标记失败**；用户只能手动 retry（新建 job）。
- 预演侧：`project.json` 原子写 + history，崩溃最多丢最后一次快照（可接受）；但**渲染产物无清理/重入保护**（`renderPreviz` 先删旧帧再 spawn，若渲染中途失败，目录里只剩部分新帧 → 与 `render.json` 不一致；`okFlag = code===0 && !!meta` 能识别失败但**已删的旧产物无法回滚**）。

### F.4 其他数据层问题

1. 🟠 `data/previz-port/project.json`（12,270B）**无任何代码引用**（全仓 grep `previz-port` = 0）→ 历史遗留。
2. 🟠 `data/post/post_mw3lazehb1v26.mp4` / `post_mw3ligs8mca84.png` 存在，但 `post` 目录无索引/无 job 记录 → 后处理产物**不可溯源**（`postProcess` 不写任何 job/元数据，只返回结果）。
3. 🟡 `jobs.json` 无分页/无归档，`listJobs` 每次全量读+排序（1,840B 时无感，任务上千后会变慢）。
4. 🟡 `paramsHash` 生成后**从未用于去重/缓存判断**（`grep paramsHash` 只有定义与写入）→ 重复生成会重复烧钱/算力。
5. 🟡 `prompts/<jobId>.txt` 单独落盘但 jobs.json 也存全文 prompt → 数据冗余（可接受）。

---

## 8. 结论

### 8.1 ✅ 已实现能力清单（真的能用）

| # | 能力 | 证据级别 |
|---|---|---|
| 1 | 项目/镜头 CRUD（list/get/create/update|save/delete）+ 原子落盘 | 读码 + 实测（list/get 路径） |
| 2 | H3 提示词编译：4 模式、ref2v 六段式、三段式、首尾帧对齐头、模板式防注入（占位符整体替换） | 实测（471 字符、validation.ok） |
| 3 | 提示词校验：模式/时长/参考数量/字符上限 → warnings 分级 | 读码 + 实测（compile 内嵌 validate） |
| 4 | **mock 后端真出片**：ffmpeg lavfi 合成（纯色+静音 AAC，1344×768/24fps/dur），失败才回退样片 | 读码 + 实测（ffmpeg 链 exit 0、产物哈希比对） |
| 5 | 任务落盘 + 列表/查询 + 重试（新建任务） | 读码 + 实测（jobs list） |
| 6 | 自检 selfcheck 12 项（ffmpeg/ffprobe/占位片/预演服务/端口源码/资产包/任务数…） | 实测（10/12 ok） |
| 7 | 预演服务生命周期（start/stop/health）+ 自动拉起 | 实测（在线、mode=port） |
| 8 | 引擎状态全量读取（43,527B，project/runtime/catalog/health/agent_rules） | 实测 |
| 9 | 引擎 15 个 `director_*` 命令全可执行：改元素/姿势/动作/相机/分镜/锁/删除/undo/redo/validate | 读码（15 命令分发齐全）+ 实测（catalog 58/28/7/10/8、validate 检出 3 条真实问题） |
| 10 | 按秒求值（camera + elements + joints） | 实测（1.5s 真实关节角度） |
| 11 | 预演包导出（samples 2–48，首尾帧+逐帧） | 实测（12 帧/5 帧） |
| 12 | **预演像素渲染**：Edge headless + three r184 + SwiftShader → 首尾帧 PNG / 全帧序列 / control.mp4 / render.json | 实测（12 帧、4381ms、1600×900） |
| 13 | 渲染前清旧帧（D2 修复） | 读码 + 实测（恰好 12 帧） |
| 14 | 渲染产物回写镜头卡（`shot.previz.render`） | 实测（shots.json 已更新） |
| 15 | 导演台 UI 同源托管（`web/`，含路径越界防护） | 读码（index.html + assets 存在） |
| 16 | **后处理 8 个 op 全部真实调 ffmpeg** | 实测（8/8 exit 0） |
| 17 | 质检（ffprobe：时长/分辨率/编码/音频轨）+ 分级不影响 ok | 实测（3 个用例） |
| 18 | 资产包 mount/list/verify/resolve（含 stale 检测、错误码、license 透传） | 实测（5 包 0 个 manifest 错误；`previs-3d-cc0` stale:true 属缓存未刷新的预期行为）+ 静态全量校验（5 包 2,102 条目 missing=0） |
| 19 | Web API 29 条路由（GET 免认证、`/file` 安全解析、`/file` 流式 media） | 实测（`GET /file` → 200 `video/mp4` 2,848,208B；`../../etc/passwd` → 500 拒绝；**注意**：`/file` 不支持 HEAD，HEAD 返回 404；不支持 Range 请求——实测 `Range: bytes=0-1023` 仍返回 200 全量 2,848,208B 且无 `Content-Range` → 视频拖动进度条/断点续传会退化，但 `<video>` 仍能播放） |
| 20 | 插件 UI 6 页签 + 3 右栏 tab（任务/资产/预演/后端/设置/分镜） | 前序 ui-verification 已实测；本轮读码确认 API 对齐 |

### 8.2 ⚠️ 部分实现清单（逻辑在，依赖/接线未就绪）

| # | 能力 | 缺什么 | 严重度 |
|---|---|---|---|
| 1 | **h3-local（ComfyUI）** | ① `h3.json` 无首帧/尾帧/控制视频节点（4 占位符只在注释）；② H3 节点名与模型文件均未落地（全盘 0 个 safetensors）；③ refs（图/视频/音频）不进工作流；④ 无并发闸门；⑤ ComfyUI 实例不可达 | 🔴 高 |
| 2 | **seedance-cloud** | 无 API Key、无模型 ID、无 config.json；状态枚举漏 `expired`；不带参考图 | 🔴 高 |
| 3 | **预演→生成联动** | `attach` 不写 `firstFramePath/lastFramePath/controlVideoPath`；`engineShotId` 从不写入 → package 永远 Shot 1；workflow 无对应节点。整条"预演出首尾帧 → H3 条件生成"**断链** | 🔴 高 |
| 4 | **首尾帧语义** | `previzPackage` 末帧 t=duration 落到**下一镜头**（实测尾帧机位=fov42/Shot2，joints 为空）→ 尾帧取错 | 🟠 中 |
| 5 | **渲染控制视频** | `control.mp4` 只有 0.5s（12 帧 @24fps），不是镜头 3.75s 的时长对齐控制视频；无重采样逻辑 | 🟠 中 |
| 6 | **渲染颜色/外观** | engine 投影不含 `color/heightM/rows/cols` → 渲染出的演员全是默认灰白，与引擎/UI 显示的颜色不一致 | 🟠 中 |
| 7 | **任务取消** | 只改状态，不 kill 进程/不 abort/不撤 ComfyUI 任务；完成回调还会覆盖状态 | 🟠 中 |
| 8 | **任务并发/恢复** | `maxConcurrentLocal` 定义未用；无队列；崩溃后 running 永挂 | 🟠 中 |
| 9 | **后处理 UI** | `client.js` 0 处 `/post` 调用；`fps` 语义与 `interpolate` 重合；无 RIFE/超分 | 🟠 中 |
| 10 | **资产→生产链路** | `resolveAsset` 无调用方；引擎不支持 glb/gltf；资产包是"可校验目录"而非"可用素材库" | 🟠 中 |
| 11 | **agentChat 预演助手** | 代码完整移植，但无 DeepSeek Key 且 Windows 下无 Codex CLI 路径 → 实测 400；UI 也未暴露 | 🟡 低 |
| 12 | **`studio_backend` capabilities** | 硬编码常量表，与实际环境/工作流能力可能不符 | 🟡 低 |
| 13 | **`studio_qc` 首帧可解码** | 描述超出实现（只做 ffprobe 元数据） | 🟡 低 |

### 8.3 ❌ 未实现清单

| # | 能力 | 说明 |
|---|---|---|
| 1 | **真实 AI 视频生成（H3 本地 / Seedance 云端）** | 两适配器代码完整但**从未成功产出过一次真实 AI 视频**（`outputs/` 里唯一文件是 mock 的样片 fallback）；本轮实测 ComfyUI 不可达、Seedance 无凭据 |
| 2 | **预演→生成的自动条件注入（首尾帧/控制视频/参考图）** | 三处断链（字段未写、模板无节点、refs 不进 wf），**端到端不可用** |
| 3 | **多镜头/多方案批量生成与一致性** | 引擎有 4 镜头、插件只取 `shots[0]`；无批量镜头渲染、无跨镜头角色一致性（ref2v 的 retention 仅提示词层面） |
| 4 | **音频/配音生成** | 无 TTS、无音乐生成；`soundscape/music` 只进提示词，mock 输出静音 |
| 5 | **上采样/超分/RIFE 补帧（视频增强类）** | 仅 `minterpolate` 占位，无模型级增强；`enhance-schema-ref` 包只是 schema 参考 |
| 6 | **任务队列/并发调度/断点续跑** | 无队列、无并发控制、无崩溃恢复（见 F.3） |
| 7 | **资产包→预演引擎的 3D 模型加载** | 引擎不支持 glb/gltf/贴图（读码 0 命中），572 个 CC0 GLB 无法进入预演 |
| 8 | **合规模块（forbidden 资产拦截）** | license 字段齐全但无拦截逻辑 |

### 8.4 关键缺口排序（最影响"能真正用起来"）

> 排序依据：**是否阻断"从一句描述到一条可交付视频"的主链路** × 修复成本。

| 排名 | 缺口 | 为什么致命 | 修复建议（仅建议，未实施） |
|---|---|---|---|
| **#1** | 🔴 **真实生成后端从未跑通**（h3-local 模板/模型/节点未落地；seedance 无凭据） | 整个产品的主产出是"AI 视频"，现在端到端只能出**纯色占位视频**（2.8MB 的历史产物还是 fallback 样片）。所有 UI/预演/后处理都在为一个还不能出片的引擎服务 | 二选一先打通：① 装 ComfyUI + H3 节点 + 模型，按真实节点名重写 `h3.json`（并用 `shot.refs` 接图/视频）；② 或配 Seedance Key + Model，10 分钟可验证（代码已完整） |
| **#2** | 🔴 **预演→生成断链（首尾帧条件注入）** | 预演是这套工具最大的差异化（灰模+运镜+控制视频），但它产出的 `first.png/last.png/control.mp4` **没有一条路径进入生成后端**：`attach` 不写 `firstFramePath`、`h3.json` 无首帧节点、`seedance` 不带图。等于 85% 完成的预演子系统对最终成片**零贡献** | ① `attach` 同时写 `firstFramePath/lastFramePath/controlVideoPath`（render 目录相对路径）；② `h3.json` 加 `LoadImage`/`VHS_LoadVideo` 节点接这 3 个占位符；③ `runSeedance` 把 first/last 转 `image_url/image_tail_url` |
| **#3** | 🟠 **任务可靠性（取消/并发/崩溃恢复/去重）** | 一旦接上真后端（单条 3–30 分钟、可能烧钱），现在**取消是假的**、**并发无闸门**（连点两次=两个 GPU 任务）、**崩溃后任务永挂**、`paramsHash` 不用于去重 → 直接导致显存冲突/重复计费/状态谎报 | ① `cancel` 真 kill + `AbortController` + ComfyUI `/queue` delete；② 用 `maxConcurrentLocal` 建一个内存队列（`running`/`queued` 状态机）；③ 启动时把 running/queued 标 `interrupted` 并允许 retry；④ `paramsHash` 命中未变参数时提示复用上次产物 |
| #4 | 🟠 首尾帧语义 bug（尾帧落到下一镜头）+ 控制视频时长不对齐 | 即便修好 #2，#2 注入的**首尾帧本身就是错的**（尾帧是 Shot 2 的机位、0.5s 控制视频）→ H3 会按错误条件生成 | `previzPackage` 末帧 t 用 `min(start+duration-1/24, …)`；控制视频按 `durationSec` 重采样帧序列（ffmpeg `-vf fps=镜头帧率, -t duration` 或按时间轴复制帧） |
| #5 | 🟠 渲染丢失颜色/外观 | 产物是"全灰白胶囊人"，不利于导演在预演阶段做色彩/角色区分判断 | `evaluate/previzPackage` 投影补 `color/heightM/rows/cols/spacing` 字段，render.html 已支持这些字段（读码确认 `buildObject` 会读） |
| #6 | 🟠 资产库与生产链路不互通 | 2,102 个条目（572 CC0 GLB + schema 参考）完全没被使用；用户看不到"资产→画面"的价值 | 短期：把 `resolveAsset` 接进 `h3.json` 的 LoadImage/视频参考；中期：给预演引擎加 glb 加载（three.js GLTFLoader 已在 vendored three 里可用，`render.html` 现有 `buildObject` 可扩展） |
| #7 | 🟡 后处理/预演助手的 UI 缺口 | `studio_post` 8 op 全通但 UI 无按钮；`agentChat` 双路径不通且 UI 未接 | 任务页加「后处理」下拉（算子+参数）；预演页加"助手"入口（先配 `DEEPSEEK_API_KEY`） |
| #8 | 🟡 数据治理（post 产物无索引、`previz-port` 遗留、manifest 绝对路径、无 sha256） | 不影响主链路，但会让"可复现/可迁移/可审计"打折 | 后处理写 `post/post.json` 索引；删 `data/previz-port`；manifest 生成器改用相对路径 + sha256 |

---

## 9. 复现清单（本轮所有实测命令）

> 所有命令在 `F:\AI视频` 下用 PowerShell 执行；仅 GET/compile/qc/frame/render 与 ffmpeg-null/temp 操作，**未写任何代码或既有数据文件**（唯一数据变更：`POST /previz/render` 重渲染产物并回写 `shots.json` 的 `previz.render`，属任务允许项；`shots.json` mtime 11:16:31）。

1. **服务与自检**
   `GET http://127.0.0.1:4318/api/health` → `{"ok":true,"service":<契约字面量>,"transport":"http","engine":"port","home":"...\\data\\previz"}`
   `GET http://127.0.0.1:8670/ai-video-studio/api/selfcheck` → `ok:true`，12 项中 comfyui=false、seedance=false
   `GET …/api/backends` → `[mock ok:true, h3-local ok:false "fetch failed", seedance-cloud ok:false "AUTH_REQUIRED"]`
2. **读接口**：`/projects`、`/projects/{id}/shots`、`/profiles`、`/assets`、`/jobs`、`/previz`、`/previz/state`(43,527B)、`/previz/url`、`/config` 全 200
3. **提示词**：`POST /api/compile {"projectId":"proj_mw3cyjed10x18","shotId":"shot_mw3d03scusykq"}` → 471 字符、`validation.ok:true`
4. **mock ffmpeg 链验证**（不落文件）：`ffmpeg -y -f lavfi -i color=c=0x102a4c:s=1344x768:d=1:r=24 -f lavfi -i anullsrc=r=32000:cl=stereo -shortest -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -t 1 -f null -` → exit 0
   产物哈希：`Get-FileHash data/outputs/job_mw3d1gbj952ft.mp4` == `Get-FileHash assets/placeholder.mp4`（`05BD857A…BBD8F5`）
5. **预演求值/包**：`GET /api/previz/frame?timeSec=1.5` → 相机+2 元素+7 关节；node 直调 `buildService().previzPackage(undefined,12)` / `('shot-kY8Z0HCT',5)` → 12 帧 / 5 帧
6. **预演渲染**：`POST /api/previz/render {projectId,shotId,samples:12,longSide:1600,fps:24}` → 见 C.3 返回体（4381ms）；ffprobe 产物 `control.mp4` = 1600×900/24fps/0.4995s/12 帧
7. **后处理 8 op**：临时目录内按代码原文参数逐条跑 → 8/8 exit 0（见 §D 表）；`ffmpeg -filters` 确认 `minterpolate/scale/subtitles` 存在，`-buildconf` 确认 `libass/freetype/fontconfig` 已编入
8. **质检**：`POST /api/qc` 三个用例（正常 mp4 → ok；缺文件 → NOT_FOUND；无音轨控制视频 → warn NO_AUDIO 且 ok:true）
9. **错误路径**：`POST /api/previz/render {shotId only}`（无 projectId）→ HTTP 500 `The "path" argument must be of type string. Received undefined`（说明 `renderPreviz` L603 `listShots(opts.projectId)` 对缺参不健壮；正常 UI 都会带 projectId，故不阻断）
   `POST /api/command {"name":"director_nope"}` → 400 `Unknown Director command: director_nope`
   `POST /api/agent/chat {"messages":[{"role":"user","content":"hi"}]}` → 400 `未找到 Codex CLI。请先安装或打开 Codex 桌面版。`
10. **静态**：`node --check` 对 `index.js`/`server.mjs`/`render-previz.mjs`/`engine.mjs` 全部 exit 0；`GET /file?path=outputs%5C…mp4` → 200 `video/mp4` 2,848,208B；`GET /file?path=../../etc/passwd` → 500 拒绝

---

## 10. 审计方法说明与局限

1. **只读边界**：未调用 `POST /generate`、`POST /previz/attach`、`/assets/mount|unmount`、`POST /config`、`POST /assets/*`（任务禁止）；未启动/停止任何服务；未改任何代码。
2. **唯一数据变更**：`POST /previz/render` 按任务明确允许执行一次（重渲染产物 + 回写 `shots.json.previz.render`）。
3. **并发写入干扰**：审计期间队友在改 `server.mjs`/`index.html`/`engine.mjs`（去原软件名）与资源包名，故本报告 §0 记录了基线哈希；代码结论以基线为准，`mounts.json` 归档以 11:14 后状态为准。**engine.mjs 在审计末尾（11:34）被改为 924,405B / `B1964CE1061B`**，已重新直调复核三个关键结论，**全部仍然成立**：
   - `previzPackage(undefined,12)` 首帧 `t=0 cam={0,2.2,7.2} fov=50 joints=7`、尾帧 `t=3.75 cam={2.6,2.2,6.2} fov=42 joints=0` → **尾帧仍落到下一镜头**（§C.4 结论不变）；
   - `frames[].elements[].color` 实测为 `[null,null]` → **渲染仍丢颜色**（§C.3 结论不变）；
   - `buildService().tools()` 仍为 15 个、`director_get_state` 的 catalog 仍 58/28/7/10/8 → §C.2 结论不变。
4. **未覆盖**：UI 像素级验证沿用前序 `ui-verification.md`（本轮未重跑浏览器；该报告环境端口为 12616，本轮为 8670，属环境差异）；`agentChat` 真实模型调用未测（无凭据）；闭源 exe 回落路径未测（存在但 audit 不启动）。
5. **"实现度百分比"定义**：本文百分比是按 §A 的"可调用单元数"与 §1.2 的"主链路可用性"人工加权，非严格代码覆盖率；证据全部来自正文行号/实测返回体，可逐条复核。