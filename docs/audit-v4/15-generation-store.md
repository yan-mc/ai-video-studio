# M5 生成执行链 + M13 持久化 审计

> 审计对象：`F:\AI视频\dsh-jiuzhang-studio`（v3.3.0，工作区有未提交改动）
> 审计范围：`host/services/generator.js` `comfy-*` `job-*` `accel-plan` `lora-catalog`
> `ref-images` `shot-context` `render-plan` `media-probe` `workflow-paths` `ffmpeg-tools`
> `mock-backend` `h3-graph` + `host/store/**` + `host/config*.js`
> 审计方式：逐行只读 + `node --check` 语法校验 + 对纯函数做**独立实测**（构造镜头卡跑
> `resolveRefImages / planImageSlots / buildShotWorkflow / compilePrompt`，与 `data/jobs.json`
> 的真实历史记录对照）。**未修改任何源文件**。
> 行号以当前工作区为准（部分文件比任务书标注的多出几十行，见 §一 备注）。

---

## 一、模块结构（文件→职责→行数→调用方）

行数为 `read` 工具统计的实际末行号；任务书给的行数是旧版本，差异已标注。

| 文件 | 职责 | 行数 | 主要调用方 |
|---|---|---|---|
| `services/generator.js` | 三个执行器：`runH3Nanfeng`(:623) / `runH3Local`(:200) / `runH3ImageLocal`(:561)；`jobKind`(:586) | **1066**（书 990） | `api/index.js:2765/2780/2790`、`tools.js:508/522/532`、`index.js:181`、`replace-runner.js:588` |
| `services/comfy-client.js` | 地址探测(:135) / 模型列表(:253) / stage 上传(:341) / `runWorkflow`(:469) / `queueStatus`(:434) / `cancelRemote`(:656) | **680**（书 631） | 上述全部执行器 + `api/index.js:951` 取消 |
| `services/comfy-control.js` | `comfyStatus`/`stopComfy`(:240)/`purgeComfyState`(:371)/`startComfy`(:486)/`restartComfy`(:586)/`withLock` | **618**（书 570） | `api/index.js:643-681`（/comfy/*）、`comfy-lifecycle.js:54/92` |
| `services/comfy-lifecycle.js` | 批次级 `startedByUs` + `owners` 引用计数 | **106**（书 100） | **仅** `replace-runner.js:119/121/659/675` |
| `services/job-runner.js` | 并发闸门(:26)/取消(:78)/启动恢复(:127)/`runJob`(:148)/`cancellableSleep`(:55) | **240**（书 219） | `api/archive.js:29`(runAndArchive)、`tools.js`、`index.js:273` |
| `services/job-store.js` | `LOCAL_BACKENDS`(:22)/惰性单例(:34)/`pruneJobs`(:93)/`TERMINAL`(:81) | **128**（书 114） | job-runner、api、tools、monitor |
| `services/accel-plan.js` | 方案表(:52)/`classifyAccelLora`(:182)/`resolveAccelForFiles`(:245)/`checkSteps`(:395) | **449**（书 419） | generator :290/:683、`replace-runner`、api `/accel/plans` |
| `services/lora-catalog.js` | 12 类目(:64)/文件名规则(:216)/`solveLoraStack`(:384) | **593**（书 561） | generator :791、api `/lora/*` |
| `services/h3-image-lora.js` | 图像侧 6 类目(:65)/`solveImageLoraStack`(:232) | **419** | api `/image/lora/*`、tools :1120 |
| `services/ref-images.js` | `resolveAssetPath`(:94)/`resolveRefImages`(:177)/`resolveMediaEntries`(:239)/`planImageSlots`(:300)/`resolveImageEditRefs`(:409) | **449**（书 419） | generator、render-plan、prompt-compile、shot-context、api、tools、inpaint-task |
| `services/shot-context.js` | `withVaultCards`(:145)/`resolveMediaRefs`(:40)/`writeBackProbe`(:108)/`resolvePictureIndices`(:198) | **228**（书 213） | api `/generate`、tools、prompt-compile |
| `services/render-plan.js` | `buildRenderPlan`(:159)/`decideRefImageSize`(:109)/`buildMediaNotes`(:511) | **568**（书 535） | api `/render/plan`、prompt-compile:110 |
| `services/h3-graph.js` | `NodeGraph`(:62) — 旧模板 `h3.json` 的 ID 分配 / 剪枝 / 连线校验 | **260**（书 244） | **仅** `generator.js:373`（`runH3Local`） |
| `services/media-probe.js` | ffprobe 探测 + 60s 缓存 | 173 | shot-context、api、asset 上传回写 |
| `services/workflow-paths.js` | 模板定位(:57)/缓存读(:121)/诊断(:139) | 153 | api、tools、index.js、h3-workshop |
| `services/ffmpeg-tools.js` | 可执行解析 + `runProcess` | 97 | media-probe、post、edit、mock |
| `services/mock-backend.js` | ffmpeg 色卡占位 | 45 | api `/generate`(backend=mock)、tools |
| `store/json-store.js` | 原子写(:180)/异步写(:214)/`updateJson`(:266)/`collectionStore`(:311) | **367**（书 324） | 全部 store |
| `store/models.js` | 常量 + `dirs()` + 惰性 store + 3D 规范化 + `validateShot`(:613) | **629**（书 586） | api、tools、全部 services |
| `store/mode-aliases.js` | `normalizeMode` 唯一实现 | 50 | models、ref-images、nanfeng/index |
| `config.js` | 白名单(:112)/`loadConfig`(:162)/`saveConfig`(:216)/`validateComfyUrl`(:290) | 379 | 全局 |
| `config-reader.js` | `configReader`(:56) + 静态检查器 `findConfigSnapshotReads`(:125) | 205 | 6 个服务工厂 + `tools/smoke-api.mjs:3618` |

**依赖方向（实测）**：`api/tools/services → comfy-client → job-runner → job-store → json-store`。
`comfy-client` **反向 import `job-runner`**（`cancellableSleep` / `throwIfCancelled`，
comfy-client.js:13），而 `job-runner` 不 import comfy-client —— 单向但**层次倒置**（客户端依赖执行器）。

---

## 二、三条链路的实际执行顺序

### A. 单镜生成（`POST /generate` 或 `studio_generate`）

```
api/index.js:831  读 body → listShots 找 shot
  ↓ :838  backendId = body.backend || shot.backend || cfg.defaultBackend（:840 白名单校验）
  ↓ :850  withVaultCards(shot, pid, ctx, cfg)       ← 角色卡 + 视频/音频探测（probeMedia 会写回 assets-index）
  ↓ :852  compilePrompt(shotWithCards, 警告数组)
  │        └ prompt-compile.js:34  >200 字直接采用
  │          :53  resolvePictureIndices(shot)        ← ★P0-1：不传 previz，编号错位
  │          :110 buildRenderPlan(...) → buildMediaNotes
  │          :123 compileH3Prompt(pkg) → lint → truncatePromptKeepFields
  ↓ :853  newJob(...)          持久化 1（status=queued）
  ↓ :883  jobsStore().upsert
  ↓ :886  runAndArchive(job, …) → job-runner.runJob
  │        :163 queued → :167 acquireSlot（activeLocal < maxConcurrentLocal）
  │        :177 running → 持久化 2
  │        ↓ executeBackend (api/index.js:2726)
  │        │   :2735 把 continuationTask 挂到 shot 副本
  │        │   :2764 backendId==='h3-nanfeng' → runH3Nanfeng
  │        │     generator.js:659  加速方案（job > shot > cfg > 默认）
  │        │     :677  listModelFiles（探测 LoRA 目录）
  │        │     :683  resolveAccelForFiles
  │        │     :686  checkSteps（dmad 只警告不回退）
  │        │     :717  accelOverrides() → 采样器/调度器/步数/Sigma
  │        │     :787  solveLoraStack([加速学生@1.0, ...shot.nanfeng.loras])
  │        │     :859  resolveRefImages + :860 resolvePrevizArtifacts
  │        │     :868  resolveMediaEntries(videos/audios)    ← 保位，不 filter
  │        │     :882  stageToComfyInput（上传/复制进 ComfyUI input）
  │        │     :945  planImageSlots(mode, stagedImages, first, last)   ← 唯一权威槽位
  │        │     :987  nanfeng.buildShotWorkflow（extraParams 最高优先级）
  │        │     :1032 comfy.runWorkflow
  │        │            :470 deepReplace → :472 POST /prompt
  │        │            :490 onSubmitted(remoteId) → 持久化 3（立刻落盘 remoteId）
  │        │            :519 轮询循环：cancellableSleep → queueStatus → /history
  │        │            :598 下载全部产物 → outputs[]
  │        :181 throwIfCancelled(job)                ← ★P1-4：与取消竞态
  │        :185 completed + warnings → 持久化 4
  │        :223 pruneJobs()                          ← ★P2-3：无删除也整份重写
  ↓ 归档：archive.js:29 → ctx.assets.archiveFile（复制进 data/assets，写 assets-index）
```

共用点：`ref-images.*`（编号）、`accel-plan`（参数）、`comfy-client`（IO）、`job-store`（落盘）。

### B. 续写批次（`POST /nanfeng/continuation/batches/run`）

```
api/index.js:344  loadBatch → :350 状态非 running → :364 后台 IIFE（不阻塞 HTTP）
  └ continuation.runBatch (continuation.js:519)
      :530 nextPendingIndex（严格按序，前面有未完成就 null）
      :541 for seg of shots（串行，O(n) 但依赖链强制）
        :560 taskFor(batch, index)   ← 段 1 也必须带（Load 0 / Save 1）
        :561 runOne(seg, taskJson, index)  → api/index.js:370
          :387 newJob(h3-nanfeng, params.continuationTask)
          :402 jobsStore().upsert → :417 runAndArchive(...)  ← 不 await
          :440 await new Promise(setInterval 2s 轮询 jobsStore().get)   ← ★P1-5 超时 1h
        :576 advanceStatus + saveBatch（★P0-3 裸写 + 先删目标）
      :572 失败即停（后面的段依赖本段 latent）
      :597 resetFromFailure 供重跑
```

共用点：与 A 完全共用 `executeBackend → runH3Nanfeng`（`:419` 调的就是它），
因此 A 的所有缺陷（P0-1/P0-2）在 B 上同样成立，且**每段都多一次全量读 jobs.json**。

### C. 图像（`POST /image/generate` / `/image/inpaint` / `/breakdown/generate`）

```
api/index.js:1555 /image/generate
  :1557 loadImageWorkflow() → readWorkflowCached('image')（★P2-5 缓存键）
  :1567 validateImageRequest（h3-image.js:424；提示词超长 400 不截断）
  :1578 resolveImageEditRefs（16 张、只保序、第 1 张=编辑目标）
  :1610 solveImageLoraStack（★P1-9/P2-2 与视频版漂移）
  :1618 splitBatchSeeds（DiT 拒绝 batch>1 → 拆 N 个 job）
  :1660 runAndArchive → runH3ImageLocal → h3-image.runH3Image
     :516 checkImageModels → :546 面积闸 → :570 显存闸（vram.ok 才判）
     :605 stageToComfyInput → :693 LoRA 链（bypass 优先）→ :758 images.image_N
     :798 comfy.runWorkflow

api/index.js:1736 /image/inpaint → inpaint-task.prepareInpaint → h3-inpaint.runH3Inpaint
     :713 独立 LoRA 链（40..45），强度 **不在求解器里夹**（★P1-9）
api/index.js:1328 /breakdown/generate → runH3ImageLocal(shot:{refs:{images:refAbs}})
     ★ generator.js:575 回退到 resolveRefImages（视频语义，9 张上限）
```

共用点：C 与 A 共用 `comfy-client` / `job-runner` / `asset-service`；
**不共用** `ref-images` 的编号（图像走 `resolveImageEditRefs`，正确），
但 `runH3ImageLocal` 的 fallback 会把 C 拉回 A 的解析器（见 P1-6）。

---

## 三、问题清单

### P0 —— 静默错误结果 / 数据丢失 / 插件崩溃

**P0-1｜`host/services/shot-context.js:198-227`（核心在 :204、:210）｜参考图编号仍有第二套实现，`<Picture N>` 与实物错位**

- 症状：`fl2va` + 2 张角色卡 + 首尾帧时，提示词写 `<Subject 1> = <Picture 1>`，
  实际提交 `planImageSlots` 给的是 `图片3/图片4` → 模型把「首帧」当角色。串脸、丢角色，全程不报错。
- 根因：`resolvePictureIndices` 只调 `resolveRefImages`，**从不调 `planImageSlots`、从不传
  `previz.firstFramePath/lastFramePath`**，然后 `byCard.get(r.cardId).push(i + 1)`
  —— 用「参考图数组下标 +1」冒充「最终槽位号」。这正是 `ref-images.js:36-37` 自己写下的铁律：
  「`<Picture N>` **不等于** 参考图数组里的第 N 个，而是 `planImageSlots` 分配的最终槽位号」。
- 可验证证据（实测，非推测）：
  ```
  mode=fl2va，cards=[甲,乙]，refs.images=[]，previz={first,last}
  resolvePictureIndices  → 甲=1, 乙=2
  planImageSlots(fl2va)  → 甲=3, 乙=4   (reserved=[1,2])
  buildRenderPlan(i2va)  → 甲=2, 乙=3
  compilePrompt 输出     → <Picture 1> / <Picture 2>
  ```
  即**同一个镜头，三个模块给出三套编号**（1/2、3/4、2/3）。
  `render-plan.js:411-420` 是对的（它调了 `planImageSlots`），
  `prompt-compile.js:53-56` 优先取 `resolvePictureIndices` 的结果 → 提示词错。
- 修复建议：删除 `resolvePictureIndices` 里的编号计算，改为
  `resolveRefImages → resolvePrevizArtifacts → planImageSlots`，用 `pictureIndexMap.get(i)`；
  或直接让它复用 `render-plan.buildRenderPlan` 的 `subjects`（那才是唯一权威）。

**P0-2｜`host/services/generator.js:623-1040`（全函数无 `随机种子`）｜南风主链路 seed 完全不生效，所有任务用同一个种子**

- 症状：用户在渲染页/画布填 seed，任务记录里 `params.seed` 是对的，
  **但提交给南风的 `随机种子` 永远是 schema 默认 `470115107471061`**。
  改 seed 不改变结果；不同镜头共用同一噪点 → 运动/构图高度雷同，且无法复现。
- 根因链（三处断点）：
  1. `generator.js` 的 `map` 里只有 `{{SEED}}`（`:335`，**仅 `runH3Local` 用**），
     `runH3Nanfeng` 的 `accelParams` / `extraParams` **从未写入 `随机种子`**（grep 确认全文件无该键）。
  2. `bridge/vendors/nanfeng/index.js:347` 是从 **`shot.seed`** 读的，
     而 `store/models.js:313-389` 的 `newShot()` **不产出 `seed` 字段**（实测 `'seed' in newShot(...) === false`）。
  3. `/generate` 把 seed 写进 `job.params.seed`（`api/index.js:874`），但 `executeBackend`
     （`:2765`）只透传 `nanfengMode / nanfengPreset / nanfengExtra / continuationTask`，**没有 seed**。
- 可验证证据：
  ```
  buildShotWorkflow(shot 无 seed)  → workflow['1'].inputs['随机种子'] = 470115107471061
  data/jobs.json 全部 44 条 h3-nanfeng：params.seed = 1101，nanfengParams 里无 随机种子
  ```
- 修复建议：`runH3Nanfeng` 里 `...(Number.isFinite(Number(job.params?.seed)) ? { 随机种子: Number(job.params.seed) } : {})`
  放进 `accelParams`（与步数同层）；同时给 `newShot` 补 `seed` 字段并让 `buildShotOverrides` 不再独吞这个语义。

**P0-3｜`host/bridge/vendors/nanfeng/continuation.js:202-236`（关键在 :229）｜续写批次状态文件沿用「先删目标再 rename」的历史 P0 写法**

- 症状：Windows 上 rename 偶发 `EPERM/EBUSY` 时，重试分支**先把目标 JSON 删掉**；
  若后续 8 次重试全部失败，`tmp` 也在 `:234` 被删 → **批次状态整份消失**。
  下一次 `loadBatch`（`:238-246`）解析失败返回 `null` → 上层一律当 `BATCH_NOT_FOUND`，
  用户看到「批次不存在」，而已生成的段与 latent 目录仍在（`data/runs/` 现在为空）。
- 根因：这段是照着 `json-store.js` 的注释改的，**但把最关键的禁令做反了**。
  `json-store.js:17-25` 明确写：「旧实现在 Windows EPERM 重试里**先 `fs.rmSync(file)` 删掉目标文件**再 rename
  …… 新旧两份数据同时消失 …… 现在：重试只针对同一个 tmp 的 rename，**全程绝不删除目标文件**」。
  `continuation.js:229` 正是被禁的那一行。
- 附加缺陷：`loadBatch` 没有 `.bak` 回退、没有 `.corrupt` 保留（对比 `json-store.js:132-155`），
  一次截断就永久丢批次。
- 修复建议：删掉 `:229` 的 `fs.rmSync`，改为 `json-store.updateJson` / `writeJson`；
  若要保留独立实现，至少抄齐「不删目标 + .bak + .corrupt + 异步退避」。

**P0-4｜`host/services/comfy-client.js:318-322、:355、:363`｜上传名只由 jobId + basename 决定 + `overwrite=true` → 同 job 内同名文件互相覆盖**

- 症状：同一个 job 的参考图里若有两张**不同目录、同名**的文件
  （`角色/正面.png` 与 `场景/正面.png`，或两张不同卡的 `sheet.png`），
  上传名都是 `jzpreviz_<jobId>_<safeStem('正面')>.png` → 后传的覆盖先传的。
  `LoadImage` 找得到文件 → 正常跑 → **两张参考图变成同一张**，无任何报错。
- 根因：`safeStem` 只哈希 **basename**（`:318-321`），`name` 拼装里没有源路径也没有内容哈希；
  上传时显式 `form.append('overwrite', 'true')`（`:363`），把 ComfyUI 的去重改名
  （`:372-373` 注释「服务端可能改名（去重追加序号）」）彻底关掉。
- 可验证证据：`safeStem('立绘')` 两次调用恒等（`img_3ba83ed2`），
  两张同 basename 文件生成完全相同的 `name`；`ref-images.js:182` 的去重键是 **abs**，
  不同目录同名文件 abs 不同 → 都会进 `refList` → 必然撞名。
- 修复建议：`name` 用 `sha1(abs + 内容前 N 字节).slice(0,10)` 或哈希整个 `abs`；
  或去掉 `overwrite=true` 并采用服务端返回名（已有 `:373` 的处理）。

---

### P1 —— 功能失效 / 违反契约

**P1-1｜`host/services/job-runner.js:127-135` + `data/jobs.json`｜`queued` 僵尸任务永不执行、永不清理**

- 症状：现存 10 条 `status=queued` 的 h3-nanfeng 任务，创建时间 2026-11-24 00:41–11:23
  （**两天前**，今天 11-26），`remoteId` 全为 `null`，`params` 里带 `replaceId/replaceSegment`
  → 它们在等并发槽位，而插件重启后 `pending` 数组（job-runner.js:13）**是纯内存**，一起消失。
- 根因：`recoverInterruptedJobs` **只处理 `running`**（注释解释了为什么不碰 queued，理由成立），
  但没有任何「queued 超时 → failed」的补偿；`pruneJobs` 的 `TERMINAL`（job-store.js:81）
  也不含 queued → 这 10 条**永远留在 jobs.json**，既不能跑也不被裁。
- 证据：`data/jobs.json` 108 条：completed 89 / queued 10 / interrupted 5 / failed 2 / cancelled 2；
  queued 全为 h3-nanfeng 且 `createdAt` 一致为两天前。
- 修复：启动时把「非本进程 `pending` 里的 queued」改为 `interrupted` 或 `failed(QUEUE_ORPHANED)`；
  或给 queued 加 TTL 扫描。

**P1-2｜`host/services/job-runner.js:127-135`｜启动恢复不清理远端：ComfyUI 继续烧卡，产物成孤儿**

- 症状：插件 fiber 重启（不是 DSH 进程退出）时，被标 `interrupted` 的任务在 ComfyUI 侧仍在跑。
  跑完后 `output/<...>.mp4` 落地，但**本地记录已中断、`remoteId` 不再被轮询** → 产物永远不进 `outputs[]`，
  也不会进素材库；用户只看到「插件重启，任务未完成」。
- 根因：`recoverInterruptedJobs` 只 `upsert` 状态（`:132`），从不读 `j.remoteId`、
  也不调 `cancelRemote` / `/queue {delete}`。`index.js:273` 在每次 `apply()` 都跑它。
- 修复：恢复扫描时对每个 `running && remoteId` 调一次 `cancelRemote`（或至少 `/queue` 查一次
  并把仍在排队的 delete 掉），并在 `error` 里写明「远端已尝试中断/仍可能产出」。

**P1-3｜`host/services/comfy-control.js:240-296、:586-608` + `host/api/index.js:647-681`｜「停止/重启」无归属判定，会误杀用户自己的 ComfyUI 与其他任务**

- 症状：用户在别的终端手动起了 ComfyUI（或端口文件残留指向它），点顶栏「停止」或「重启」，
  `stopComfy` 会 `SIGTERM` 那个 pid（`:274`），先 `interrupt` 再 `queue {clear:true}`（`:252/:260`）
  —— **把用户自己的任务和别人的排队项一起清掉**。
- 根因：`comfy-lifecycle.js:40-41` 有 `startedByUs` 这个正确设计，
  但**只有 `replace-runner` 用它**；`/comfy/stop` 与 `/comfy/restart` 直接调 `stopComfy`，
  唯一的保护是 `withLock`（防并发点击，不防误杀）。
- 修复：对外暴露 `stopComfy` 时要求 `force` 或校验 `startedByUs`；
  API 层返回「这个实例不是你拉起的，确认要杀吗」的二次确认分支。

**P1-4｜`host/services/job-runner.js:180-196`｜取消与完成竞态：已成功的产物被丢弃、任务被标 cancelled**

- 症状：`runWorkflow` 已经 return（文件已下载、`outputs` 已就绪），
  紧接着 `throwIfCancelled(job)`（`:182`）抛 `CancelledError` → 走 catch → `status='cancelled'`、
  `outputs` 不写入。用户看到「已取消」，`data/outputs/job_x.mp4` 其实躺在盘上但没人认领。
- 根因：取消标志是内存 Set（`:41-43`），检查点在**结果之后**，没有「已提交终态优先」的判定。
- 证据：`api/index.js:951` 的取消与 `:886` 的 `runAndArchive` 完全并发，中间没有锁。
- 修复：`if (cancelled && !result) throw`；或 catch 里若 `result?.outputs?.length` 则按 completed 落盘并附警告。

**P1-5｜`host/api/index.js:462` vs `host/services/comfy-client.js:41`｜批次段等待上限 1h < 单任务超时 2h → 长片批次必然误判**

- 症状：不加速（50 步）或 `quality` 预设跑 5 秒片很容易 >1h。
  批次轮询先到 1h 抛 `第 N 段超时（>1h）` → `runBatch` 把该段标 `failed` 并 `return`（continuation.js:573）。
  而此时 `runAndArchive` 仍在跑，稍后该 job 变 `completed` —— **批次 failed、任务 completed**，
  且下一段因 `continuation.js:543-546`「前面有非 completed 段」永久卡死，必须手工 `reset`。
- 根因：两处超时独立硬编码，没有单一真源。
- 修复：批次超时改为读 `comfyTimeoutMin + 余量`，或直接 await `runAndArchive` 的 Promise 而不是轮询。

**P1-6｜`host/services/generator.js:575-577` + `host/api/index.js:1431-1437`｜图像链路回退到视频解析器：16 张上限被 9 张截断、顺序被角色卡优先重排**

- 症状：`runH3ImageLocal` 在 `params.imageRefs` 为空时回退
  `resolveRefImagesCore(shot).map(r => r.abs)` —— 那是**视频语义**（≤9 张、角色卡优先、去重）。
  立绘拆解（`api/index.js:1435` 传 `shot:{refs:{images:refAbs}}`，**没有 `params.imageRefs`**）
  与画布 Agent（`index.js:186` 同样形状）都走这条回退。
  结果：传 10–16 张被静默截到 9 张；若 shot 上带了 `characterCards`，第 1 张（被编辑原图）会被卡图顶掉。
- 铁证：`generator.js:555-560` 的注释自己写着「不要在 shots 里找参考图 …… 两者混用会把编辑对象换成角色卡里的立绘」，
  然后 `:577` 的 fallback 正是这么做的。
- 修复：fallback 改为 `resolveImageEditRefs(shot.refs.images).ok`（保序、≤16、不去重合并），
  或在 `runH3Image` 入口断言 `params.imageRefs` 必填。

**P1-7｜`host/services/edit.js:519-539`（:537）｜剪辑工程 JSON 裸写，无原子、无队列、无备份**

- 症状：`saveProject` 直接 `fs.writeFileSync(projectFile, ...)`，
  网页自动保存与 `/edit/render` 的回写（`:656` 也调 `saveProject`）并发时互相覆盖/截断；
  截断后 `:516` 的 `JSON.parse` 抛错 → 工程永久不可读，且**没有 .bak**。
- 根因：`api/shots.js:6-8` 的注释明确要求「所有写操作必须走 json-store 的 updateJson」，
  剪辑模块没跟上（它是另一条业务线，但同一进程、同一磁盘）。
- 修复：改用 `updateJson(projectFile(safe), {}, () => next)`。

**P1-8｜`host/services/character-vault.js:377-385`（:381）｜tmp 名含 pid，同进程并发写同一文件必冲突**

- 症状：`const tmp = \`${f}.${process.pid}.tmp\`` —— 同进程内两次并发写 `cards.json`
  （项目页快速勾选两张卡）用**同一条 tmp 路径**，后写覆盖先写的 tmp，再各自 rename → 一方修改丢失。
- 根因：这正是 `api/shots.js:78-82` 注释里骂过的那个 bug（「tmp 名是 `${f}.${pid}.tmp` —— 同进程两次并发写用同一个 tmp 路径」），
  `canvas-agent.js:147/165` 是同样的写法。
- 修复：加自增序号（`json-store.js:90-93` 的 `tmpNameFor` 已有正确实现），或直接走 `writeJson`。

**P1-9｜`host/services/lora-catalog.js:506-513`｜带符号滑块类永不夹取强度，数值直送南风**

- 症状：`motion_slider` / `look_slider` 声明 `min:-5,max:5`（`:112`、`:134`），
  但夹取被 `if (!category.signed)` 整体跳过 → 用户传 `strength: 999` 或分类外的 `±30`
  原样写入 `LoRA{n}强度`。图像侧有 `[-2,2]` 兜底（`h3-image-lora.js:338-347`）、
  `h3-image.js:713` 也有 `Math.max(-2,Math.min(2,...))`，**视频侧完全没有**。
- 可验证证据：`h3-inpaint.js:732-733` 与 `h3-image.js:713` 都有 `[-2,2]` 夹取，
  `generator.js:804` 直接写 `entry.appliedStrength`，无夹取。
- 修复：signed 类也夹到 `[min,max]`（按绝对值比较），并在 `generator.js:804` 前加 `[-2,2]` 兜底。

**P1-10｜`host/api/shots.js:86-89` 与 `:145-151`｜`writeShots` 完全绕过校验；`upsertShot` 不裁视频/音频**

- 症状：`upsertShot` 只裁 `durationSec` 与 `refs.images.slice(0,9)`（`:146-150`），
  **不裁 `refs.videos`/`refs.audios` 到 3**；`writeShots`（`:86`）更是零校验直接整体替换。
  超量的视频/音频在第 3 段之后被 `generator.js:869` 的 `.slice(0, MAX_REF_VIDEOS)` 静默丢弃，
  而提示词里仍写着 `<Video 4>`。
- 对比：`models.js:361-362` 的 `newShot` 是裁的 —— 两条写入路径不一致。
- 修复：把裁剪与 `validateShot` 下沉到 `writeShots`/`upsertShot` 共用的一次 `normalizeShot()`。

**P1-11｜`host/api/index.js:736` vs `host/services/generator.js:791`｜LoRA 预演面板不检查文件是否存在，真实提交才拒 → 预演说「能挂」实际被丢**

- 症状：`/lora/solve` 调 `solveLoraStack(requested, { maxSlots })`，**不传 `availableFiles`**
  → `canonicalByBase.size === 0` → `lora-catalog.js:438` 的存在性检查整段跳过 → 面板显示 accepted。
  真实生成时 `generator.js:684/791` 传了 `availableFiles` → 同一个 LoRA 被 `rejected`，
  只在 `job.warnings` 里出现。
- 对比：`/image/lora/solve`（`:1530-1536`）是传 `availableFiles` 的 —— 两条线不对称。
- 修复：`/lora/solve` 也探测一次 `listModelFiles`（失败则不传，保持「不误杀」语义）。

---

### P2 —— 可维护性（耦合 / 重复 / 补丁注释 / 死代码）

**P2-1｜`h3-graph.js` + `generator.js:373-490` + `data/workflows/h3.json`｜桥接层之外的第二处「上游知识」**

- 判定（对应审查点 1）：**不是两份图组装实现**。两者目标不同：
  - `h3-graph.js` + `generator.js:373-490` 组装**原生节点模板**（`UNETLoader→LoRA→SigmaShift→ReferenceToVideo→AddGuide→CreateVideo`）；
  - `bridge/vendors/nanfeng/graph.js:439` 组装**单巨型节点** `NanFengH3MultiReferenceGeneratorV15` + `VHS_VideoCombine`。
- 但**违反边界**这一点成立：`bridge/README.md:3-5` 声明「业务层不直接接触节点名」，
  而 `generator.js` 里硬写了 `'9'`（判定 `refNode.class_type === 'MiniMaxH3ReferenceToVideo'`，`:376`）、
  `'103'`（SigmaShift，`:503`）、`'4'`/`'1'`（LoRA/UNET，`:503-510`）、
  `ref_images.ref_image_N`（`:411`）、`ref_videos.ref_video_K`（`:431`）、
  `AddGuide` 的 `latent` 必须取 `['9', 1]`（`:462`）—— 全是上游契约，不是业务语义。
- 死代码判定：`runH3Local` **没有任何真实使用记录** —— `data/jobs.json` 现存 108 条里
  `h3-local` **0 条**（64 h3-image + 44 h3-nanfeng）；SPA 两个提交入口写死 `backend:'h3-nanfeng'`
  （`RenderPage.tsx:375`、`ContinuationPanel.tsx:179`），只有画布下拉还留着 `h3-local`
  （`nodeRegistry.ts:586-590`，且是唯一选项）。
  所以它不是死代码，而是**一条没人走、但必须维护的并行显卡路径**。
- 建议：把整个 h3-local 图装配 + 模板读取下沉到 `bridge/vendors/h3-native/`，
  或在 3.4 里正式废弃（前端只留两个下拉项 → 一个）。

**P2-2｜`lora-catalog.js:384-586` vs `h3-image-lora.js:232-419`｜两套 LoRA 求解器约 70% 重复，且已漂移**

- 重复：`canonicalByBase` 构建、`canonical()`、重复剔除、单选替换、`maxSlots`、总强度看门狗（`STRENGTH_LIMITS`）、
  `degraded/replaced/rejected` 四元组 —— 结构逐行对应。
- 已漂移（这就是「该合并」的实证）：
  | 行为 | 视频 | 图像 |
  |---|---|---|
  | signed 夹取 | **不夹**（`:507`） | 夹（`:322-336`） |
  | `[-2,2]` 兜底 | 无 | 有（`:338-347`） |
  | 衰减记录 `from` 值 | 写 `category.strength.def`（`:500`，与实际值不符） | 写实际 `before`（`:331`） |
  | accelerator 角色 | 有（强度锁 1.0、不计入总和） | 无 |
- 建议：抽出 `solveStack(categories, requested, { maxSlots, availableFiles, special })`，
  两侧只提供 `categories` 与少量钩子；顺带修掉上表的漂移。

**P2-3｜`host/services/job-store.js:93-127` + `host/store/json-store.js:266-277`｜`pruneJobs` 无可删项仍整份重写；`.bak` 与主文件内容相同 → 备份窗口≈0**

- 症状：`updateJson` **无条件** `writeAsyncAtomic`（`json-store.js:270`），
  所以 `job-store.js:120` 的 `if (removed <= 0) return list;` 拦不住写盘
  —— 注释（`:85`「只在真的删了东西时才写盘」）与行为不符。
  每次任务终结 → 重写 522,869 字节（6095 行）+ `backupSync` 再复制 522,869 字节。
- 实证：`data/jobs.json` 与 `data/jobs.json.bak` **SHA256 完全相同**（`5836EDE1…C5E211E9`）。
  这直接说明 `.bak` 是「上一次写的同内容副本」，不是「上一版」——
  一旦主文件被 `overwriteFallback`（`:169-177`，非原子）截断，`.bak` **救不回来**。
- 建议：`updateJson` 增加 `changed` 判定（深比较或 mutator 返回 `undefined` 表示不写）；
  `backupSync` 改成「内容变化时才备份」，并给 `.bak` 加时间戳轮转。

**P2-4｜`host/store/json-store.js:321-334` + `host/api/index.js:452`｜全量读放大：批次每 2 秒解析 522KB**

- 症状：`collectionStore.get(id)` 内部就是 `await this.list()`（`:331-334`）→ 每次 get 全量读盘 + `JSON.parse`。
  `/jobs`（`:890`）、`/monitor`（`monitor.js:16`）、批次段轮询（`api/index.js:452`，**每 2 秒**）、
  `/image/progress`（`:1795` 注释已改为逐个取，但逐个取仍是逐个全量）都在放大。
  续写 9 段 × 每段 5–20 分钟 → 单批次 ≈ 数万次全量解析。
- 证据：`data/jobs.json` 522,869 字节 / 6095 行 / 108 条；
  `api/index.js:896-898` 的注释自认「单次响应实测 328,437 字节」。
- 建议：加进程内 `{mtimeMs,size}` 缓存 + 增量（按 id 建 Map）；
  批次轮询改为监听 `onSubmitted`/`onProgress` 回调而不是轮询盘。

**P2-5｜`host/services/workflow-paths.js:57-61、:120-127`｜`dirCache` 键只有 `dataDir`，不含 `workflowDir`**

- 症状：解析结果的缓存键是 `String(cfg?.dataDir)`（`:58`）。**改 `workflowDir` 而 `dataDir` 不变时，
  `resolveWorkflowDir` 直接返回旧的目录**，直到 `resetWorkflowCache()`。
  通过 `POST /config` 改是能清掉的（`config.js:368` 订阅了），
  但**直接改 `data/config.json` 或设 `DSH_JZ_WORKFLOW_DIR` 必须重启**才生效 —— 这个隐含契约没有任何地方写明。
- 实证：
  ```
  resolveWorkflowDir({dataDir:X, workflowDir:'<正确>'}      ) → F:\...\data\workflows
  resolveWorkflowDir({dataDir:X, workflowDir:'C:\not-exist'}) → F:\...\data\workflows  ← 同一个（旧）结果
  ```
- 另：`jsonCache` 的键是解析后的**文件绝对路径**（`:123`），所以模板文件本身不会「旧内容残留」——
  只有目录解析会。审查点 12 的第二个问号答案：**文件级缓存是安全的，目录级缓存不安全**。
- 建议：`dirCache` 键改为 `dataDir + '\0' + workflowDir + '\0' + env`。

**P2-6｜死字段 / 死代码成片（逐条已 grep 确认零消费）**

| 位置 | 符号 | 消费点 |
|---|---|---|
| `host/runtime.js:18` + `host/index.js:124/131/151` | `state.cfg`（注释自认的「兼容字段」） | **0**（全仓无 `z.cfg` / `state.cfg` 读取）→ 可直接删 |
| `services/accel-plan.js:72/87/124` | `strictSteps` | **0**（`api/index.js:69` 只注释说「不外泄」）→ 「DMAD 必须 4/8 步」没有任何代码强制 |
| `services/generator.js:788` | `forceRole:'accelerator'` | **0**（`solveLoraStack` 只读 `name`/`strength`） |
| `store/models.js:129-132` | `PROFILES[].backend` | **0**（且全是 `h3-local`，与实际默认 `h3-nanfeng` 矛盾） |
| `store/models.js:107` | `RESULT_KINDS` | **0** |
| `store/models.js:113` | `JOB_STATUS` | **0**（且与 `job-store.js:81` 的 `TERMINAL` 是两套状态枚举） |
| `services/mock-backend.js:18` | `PLACEHOLDER` | **0** |
| `store/json-store.js:280` | `flushJsonStore` | **0** |
| `store/json-store.js:361` | `collectionStore.replaceAll` | **0** |
| `store/json-store.js:326` / `models.js:271,282` | `listSync` | **0**（只被 models 转发，没人调） |
| `services/lora-catalog.js:288` | `toComfyLoraName` | **0** |
| `store/models.js:462` | `isKnownAction` | **0** |
| `services/h3-graph.js:249` | `NodeGraph.summary()` | **0** |
| `services/comfy-lifecycle.js:104` | `isOwnedByBatch` | **0** |
| `services/character-vault.js:335` | `buildSubjectDefinitions` | **0**（`generator.js:146` 自己实现了 `injectCardDefinitions` —— **第 5 份卡文字注入实现**） |
| `services/generator.js:262` | `useFirstLast` | **0**（注释说「供日志/计划展示」，但没进 `job.params`） |
| `services/generator.js:8` | `import fs` | **未使用**（唯一出现是 `:1027` 的注释） |
| `services/job-runner.js:9` | `import isLocalBackendOf` | **未使用** |
| `host/index.js:155` | `createH3Workshop({ root, ... })` | `root` 已废弃（`h3-workshop.js:139` 自认） |

---

### P3 —— 文档与代码不符

**P3-1｜`store/models.js:25-30`、`tools.js:121`、`api/index.js:140`｜「14 类资产」实为 15 个**

`ASSET_TYPES` 数组实测 `.length === 15`（`general` + 14 类），注释与两处工具描述都写「14 类」。
且 `data/assets-index.json` 现存 35 条**全部是 `general`** —— 其余 14 类定义了但从未被使用。

**P3-2｜`host/services/replace-runner.js:684-690`｜sigma 注释已过时（且它决定了一段真实行为）**

该注释仍称「V15 把 `sigma_requested` 硬编码为 False …… 手动序列完全不生效」，
并据此在 `buildOverrides` 里刻意不写 `H3完整Sigma序列`。
实测 `vendor/nanfeng/h3_generator.py:1727` 已改为 `sigma_requested = bool(kwargs.get("启用西格玛调节", False))`，
`:1743-1754` 真的会插 `MiniMaxH3SigmaShift`。结论（不写手动序列）大致仍成立，但**理由错误**。
另：`generator.js:823-838` 的注释也说「那条『设不了』的警告在改 vendor 之后就是假的了」——
即同仓库里两处注释互相矛盾，一处已更新、一处没更新。

**P3-3｜`host/services/comfy-control.js:581`｜承诺的 `/comfy/purge`（`deep:true`）路由不存在**

注释：「确实要连 latent 一起清，用 `/comfy/purge` 的 `deep:true`（见 api 层）」。
`api/index.js` 实际只有 `/comfy/status`、`/comfy/stop`、`/comfy/start`、`/comfy/restart` 四条
（grep `'/comfy/[a-z]+'` 唯一结果集）。用户按文档找不到这个按钮/接口。

**P3-4｜`host/services/generator.js:1042-1065`｜`summariseParams` 名不符实**

注释：「只保留『非默认值』的参数」，实现是 `const schema = params;`（`:1049`，只是别名）
+ 13 个硬编码键 + 素材槽正则。既没比较默认值，也没过滤非默认项。

**P3-5｜`store/models.js:190-211` + `tools.js:129` + `api/index.js:138`｜19 个 H3 槽位是纯展示数据**

`H3_MODEL_SLOTS` 只有两处消费，都是原样回给前端做「元信息」展示；
后端实际只认 4 个 backendId（`api/index.js:63`）。19 槽位与实际能力没有任何对应关系。

**P3-6｜仓库根两个 0 字节垃圾文件**

`{console.log('ASSET_TYPES` 与 `{console.log('BUILTIN`（各 0 字节，shell 重定向事故），
`git status` 里是两个未跟踪项。删除即可。

---

## 四、重复实现与死代码清单

### 4.1 图组装：`h3-graph.js` vs `bridge/vendors/nanfeng/graph.js`（审查点 1 结论）

| 维度 | `services/h3-graph.js` | `bridge/vendors/nanfeng/graph.js` |
|---|---|---|
| 组装对象 | 原生节点模板（`data/workflows/h3.json`） | 单巨型节点 `NanFengH3MultiReferenceGeneratorV15` + `VHS_VideoCombine` |
| 入口 | `NodeGraph`（:62）+ `pruneUnreachable`（:192）+ `validateLinks`（:225） | `buildWorkflow`（:439）+ `coerceTypes`/`sanitize`/`applyFixes` |
| 唯一调用方 | `generator.js:373`（`runH3Local`） | `nanfeng/index.js:253`（`buildShotWorkflow`）→ `generator.js:987` |
| 实际使用 | **0 条历史任务** | 44 条（全部视频任务） |

**结论：不是两份同一件事的实现，但确实是「桥接层之外的第二套上游契约」。**
上游节点名/槽位/连线规则同时存在于三个地方：`bridge/vendors/nanfeng/*`、
`services/h3-graph.js` + `services/generator.js:373-490`、`data/workflows/h3.json`。
`h3-graph.js` 不是死代码（可被 `backend='h3-local'` 触达），但它是**没有用户走、又不能删的维护负担**。

### 4.2 参考图编号：历史上 4 份 → 现在是 **1 份权威 + 1 份错的 + 2 份合法的独立语义**

| 位置 | 编号算法 | 判定 |
|---|---|---|
| `ref-images.js:300-354` `planImageSlots` | 唯一权威（避开首尾帧槽位） | ✅ 权威 |
| `shot-context.js:198-227` `resolvePictureIndices` | `i + 1`（**不传 previz**） | ❌ **P0-1，必须删** |
| `render-plan.js:411-420` | 调 `planImageSlots` | ✅ 正确（预览侧） |
| `prompt-compile.js:202-216` `deriveSubjectsFromShot` | 调 `planImageSlots` + `resolvePrevizArtifacts` | ✅ 正确 |
| `h3-prompt.js:2089-2101` `toShotInputPackage` 的 `cardSubjects` | `pictureIndexBase + i` | ⚠️ 仅当调用方没传 `subjects` 时生效（`tools.js:310` 的 `action=compile` 会走到），是占位语义，注释已声明 |
| `replace-tasks.js:41`、`replace.js:210`、`api/index.js:2492` | `i + 1` | ✅ 换人线**刻意**「顺序即语义」，注释写明与常规渲染不共享 |
| `generator.js:146-191` `injectCardDefinitions` | 用 `pictureIndexMap` 换算 | ✅ 正确（唯一正确的消费方式） |
| `character-vault.js:335-347` `buildSubjectDefinitions` | 直接用传入的 `pictureIndex` | ⚠️ 零调用（P2-6） |

`<Picture` / `<Video` / `<Audio` 的 grep 另外命中 `bridge/prompt/h3-prompt.js`（生成侧，
`<Video N>`/`<Audio N>` 编号在 `:1124-1149`）与 `param-docs.js`（纯文档）—— 这些是**输出**，不是解析。

### 4.3 `MAX_REF_IMAGES=9` 与 `MAX_IMAGE_EDIT_REFS=16` 会不会串用（审查点 2 结论）

- **定义层不串**：`ref-images.js:76` 定义 16，`h3-image.js:78` 从它派生 `IMAGE_MAX_REF_IMAGES`，
  `h3-inpaint.js` 只用 `max:1` 的 `resolveImageEditRefs`（源图/mask）。注释（`:64-75`）解释得很清楚。
- **运行时会串**：`generator.js:575-577` 的 fallback 把图像链路拉回 `resolveRefImages`（≤9），
  立绘拆解与画布 Agent 都走这里 → **16 张上限在真实路径上不可达，实际是 9**。见 P1-6。
- 另有：`/image/generate` 主路径正确（`params.imageRefs` 已解析），但 `h3-image.js:522` 的
  `IMAGE_TOO_MANY_REFS` 检查用的是 `IMAGE_MAX_REF_IMAGES`（16），与 fallback 的 9 不一致。

### 4.4 LoRA：两套并行实现

见 P2-2。补充：**视频侧的 `solveLoraStack` 有一个「加速学生删不掉」的保护**（`:539` 过滤
`role !== 'accelerator'`，`:544` 循环里 `if (!candidates.length) break`）—— 图像侧没有对应逻辑，
因为图像生态没有 turbo 类。这个差异是**合理的**，其余差异（signed 夹取、`[-2,2]` 兜底、衰减记录）
都是漂移，应合并。

### 4.5 其它死代码 / 补丁点（按「该删还是该留」判定）

| 位置 | 内容 | 判定 |
|---|---|---|
| `store/models.js:107/113` | `RESULT_KINDS` / `JOB_STATUS` | **删**（JOB_STATUS 与 `TERMINAL` 重复） |
| `services/mock-backend.js:18` | `PLACEHOLDER` | **删**（零消费） |
| `store/json-store.js:326/361`、`models.js:271/282` | `listSync` / `replaceAll` | **删**（零消费） |
| `services/lora-catalog.js:288` | `toComfyLoraName` | **删**（注释说「保留原始串」，实现是个没人调的分隔符替换） |
| `store/models.js:462` | `isKnownAction` | **删**（`listActionCatalog` 仍在用，保留后者） |
| `services/h3-graph.js:249` | `NodeGraph.summary()` | **删**（`byType` 统计无人消费） |
| `services/comfy-lifecycle.js:104` | `isOwnedByBatch` | **留**（排障入口，接上监控即有价值） |
| `store/json-store.js:280` | `flushJsonStore` | **留**（注释声明「测试/退出用」，是有意的 API 面） |
| `services/accel-plan.js:72/87` | `strictSteps: true` | **删或接线**（现在既没外泄也没强制，留着误导） |
| `services/generator.js:788` | `forceRole` | **删**（求解器不读） |
| `services/generator.js:262` | `useFirstLast` | **删或写进 job.params** |
| `runtime.js:18` `cfg` | 配置快照 | **删**（审查点 3 的答案见 §4.6） |
| `api/index.js:2626` `void runReplaceBatch(...)` | `void` 用法 | **留但可去掉 `void`**（不 await 本身已表达 fire-and-forget，`.catch` 已处理；`void` 只是风格噪音） |
| `services/generator.js:368-372`、`h3-graph.js:1-44` | 大段「历史实现怎么炸的」注释 | **留**（每段都对应一个真实 P0 事故，是可追溯的设计依据） |
| `services/ref-images.js:380-384` | 「曾经有 `buildSubmissionRefs()`，零调用者，已删除」 | **留**（声明式墓碑，防止有人再加回来） |
| `config.js:89-109` `DEPRECATED_CONFIG_KEYS` | 已废弃配置键 | **留**（且确实只有 2 处引用，:`106` 定义 + `:256` 注释，无人读 → 可视为纯文档常量） |
| `workflow-paths.js:74-75`（`cfg.dataDir/workflows` 兜底） | 「兼容老版本」 | **留但实际不可达**（插件根永远存在且在它之前）→ 建议改成「仅当插件根缺失时」 |

### 4.6 配置「分裂脑」（审查点 3 结论，全部实测）

- **`saveConfig` 是替换缓存对象**：`config.js:247` `cache = { ...loadConfigDefaults(next) }`
  —— **不是原地修改**。所以任何在启动时捕获的 `cfg` 引用都会永久停留在旧对象上。
  这个语义在 `config.js:143-148`（`index.js:143-148` 注释）里写得很清楚。
- **`create*Service({ getCfg })` 全部每次现取**：6 个服务全部用 `configReader(getCfg)`
  （`asset-service.js:45`、`edit.js:53`、`extras.js:109`、`h3-workshop.js:149`、`post.js:24`）
  或直接 `getCfg()`（`character-vault.js:167/199/207/230/239/355`）。**没有一处捕获快照**。
- **还剩几处快照**：
  1. `host/index.js:124` → `initRuntime({ cfg })` → `runtime.js:18` `state.cfg`：
     **生产 1 处，消费 0 处**（全仓 grep 无 `z.cfg`/`state.cfg`）。这是死字段，可删。
  2. `host/api/index.js:125` `const cfg = loadConfig()`：**每个 HTTP 请求一次**，请求内一致 → 合规。
  3. `generator.js:200/561/627` 的 `cfg = loadConfig()` 默认参数：合规（config-reader.js:113-119 的「合规 2」）。
     但调用方都显式传入，所以一次生成跑 2 小时期间用户的配置变更**不会生效** —— 这是可接受的语义。
- 结论：**「配置分裂脑」在服务层已根治**；残留只有 1 个零消费字段 + 1 处旧注释
  （`index.js:151` 说「保留 cfg 字段兼容尚未改造的服务」，实际上没有任何服务用它）。

---

## 五、结构性问题与重构建议

1. **`generator.js` 同时是「参数装配器」和「上游图装配器」（1066 行）**。
   `runH3Nanfeng` 的 620 行里有 200 行是上游契约（221 参数映射、LoRA 槽位 ≤8、`Sigma策略` 枚举值、
   `图片N/视频N/音频N` 保位语义）。建议拆成
   `services/generate/{prepare.js(取参) → reference.js(素材+槽位) → nanfeng.js(委托 bridge) → legacy.js(h3-local)}`，
   并把 `h3-graph` 与 `h3.json` 的契约搬进 `bridge/vendors/h3-native/`。
2. **编号只有一条流水线，却有 4 个消费者各自取字段**。
   `ref-images.js:371-384` 的注释给出「三个入口必须按序调用」，
   但没有任何类型/断言强制。建议把三步打包成一个**纯函数返回值**
   （`planReferenceSet(shot, cfg)` → `{refList, previz, slots, pictureIndexMap}`），
   让 `shot-context` / `prompt-compile` / `render-plan` / `generator` 都只读这一个结果。
   —— 这正是 `ref-images.js:380-384` 说「已删除 `buildSubmissionRefs`」的那个方向；
   删除的理由（「零调用者」「语义混杂」）是对的，但**结论错了**：应该修语义，不是留 4 个手拼点。
3. **持久化分层不彻底**：`jobs/shots/projects/assets/vault` 走 `json-store`，
   而 `edit` / `continuation` / `canvas-permissions` / `project-cards` / `config` 各自裸写。
   建议给 `json-store` 增加一个 `jsonDoc(file)` 便捷封装（同步/异步、自动 .bak、唯一 tmp），
   然后把 5 处旁路逐个替换 —— 顺序按风险：`continuation`（P0-3）→ `edit`（P1-7）→
   `project-cards`/`canvas-permissions`（P1-8）→ `config`（可接受）。
4. **job 状态机缺一处真源**：`models.JOB_STATUS`（6 态）、`job-store.TERMINAL`（4 态）、
   `continuation.shots[].status`（pending/running/completed/failed/cancelled）、
   `replace.segments[].status`（+cutting/joining）**四套并存**。
   建议在 `store/` 里定义 `JOB_STATUS` + `TERMINAL` + `isTerminal()`，其余模块 import。
5. **超时/重试常量散落**：`comfyTimeoutMin`（2h，comfy-client）、批次段 1h（api/index.js:462）、
   画布 30min（runner.ts:444）、`STOP_TIMEOUT_MS` 30s、`START_TIMEOUT_MS` 180s、
   `PURGE_*` 20s。至少把「单任务超时」与「批次段超时」的派生关系写死在一处（P1-5）。
6. **`render-plan.js` 与 `ref-images.js` 的职责重叠**：前者自带一套 `pushImage`/
   `H3_MAX_REF_IMAGES`/去重/裁剪（`:182-234`），后者有 `resolveRefImages` 的同语义实现
   （`:177-229`）。虽然 `render-plan` 最终调了 `planImageSlots`（编号对），
   但**「谁进参考图清单」仍有两套规则**（`render-plan` 含 previz 且裁到 9，`resolveRefImages` 不含 previz）。
   这是 P0-1 能长期存活的土壤：只要两套规则并存，就一定会有人再写第三套。
7. **`comfy-lifecycle` 只在换人线生效**。A/B/C 三条主链完全不按需拉起/释放 GPU，
   而它是本仓库唯一实现了「不误杀用户进程」的地方（`startedByUs`）。
   建议把 `ensureComfyRunning/releaseComfy` 接到 `runJob` 的 local 分支（按 job 计数），
   同时把 `startedByUs` 的归属判定补进 `/comfy/stop`（P1-3）。

---

## 六、结论

- **三条链汇合点的实际风险集中在「参考素材」与「任务状态」两处**：
  - 参考素材：编号有 1 份权威 + 1 份错的实现（P0-1），上传名会撞（P0-4），
    图像链路回退到视频语义（P1-6）。这四项的共同后果都是**「素材挂上了但没按预期生效，且不报错」**，
    正是本仓库反复声明要消灭的失败模式。
  - 任务状态：queued 僵尸（P1-1）、恢复不清理远端（P1-2）、取消竞态（P1-4）、
    批次超时错配（P1-5）—— 四条都会让「界面状态」与「ComfyUI/磁盘上的事实」分叉。
- **P0 有一条是纯粹的回归**：`continuation.saveBatch` 把 `json-store` 头注释明令禁止的
  「先删目标再 rename」原样抄了回来（P0-3）。这说明「禁止事项写在注释里」不足以防止复发，
  需要静态检查（`tools/smoke-api.mjs` 已有 `findConfigSnapshotReads` 这类检查器，
  可以照抄一个 `findDangerousRename`）。
- **配置分裂脑已根治**（服务层 0 处捕获，只剩 1 个零消费的 `runtime.cfg`），
  **但持久化纪律没有**：5 处旁路写盘，其中 2 处（`continuation`、`edit`）会造成真实的整份数据丢失。
- **重复实现比任务书预期的少**：`h3-graph` 与 `nanfeng/graph` 不是同一件事（P2-1）；
  参考图编号从 4 份降到「1 权威 + 1 错 + 2 合法」；LoRA 是 2 套且**已漂移**（P2-2），
  这是唯一一处「应当合并而未合并」的重复。
- **测试覆盖与风险不匹配**：`tools/smoke-api.mjs` 有 3600+ 行断言守着配置/路由/分片，
  却没有任何断言覆盖「`<Picture N>` = `planImageSlots` 的结果」与「seed 被提交到南风参数」——
  两个 P0 都在这条缝里。

**建议修复顺序**（lead 统一执行时）：
`P0-3 → P0-1 → P0-2 → P0-4 → P1-6 → P1-7/P1-8 → P1-1/P1-2/P1-4/P1-5 → P1-3 → P1-9/P1-10/P1-11 → P2-2/P2-3/P2-4 → 其余`。
前三项都能用 10 行以内的补丁修掉，且都能立刻用现有 `data/jobs.json` / 构造镜头卡回归验证。

---

## 七、修复记录（v4）

> 执行者：fix-gen（M5 生成执行链 + M13 持久化）
> 依据：本报告 §三 / §四 / §六。**只改任务书授权的 17 个文件**。
> 验证：`node --check` 17/17 通过；纯函数自测 **79/79 通过**（临时文件跑在 `%TEMP%`，未入库）。

### 7.1 P0 修复

#### P0-1｜`shot-context.js` `resolvePictureIndices` 改为 `planImageSlots` 唯一编号源

- **改法**：删除 `i + 1` 编号算法，改为与提交端**同序、同源**的一整条流水线：
  `resolveRefImages(shot)` → `resolvePrevizArtifacts(shot)` → `planImageSlots(mode, refs, first, last)`
  → 取 `pictureIndexMap.get(i)`。首尾帧**已传入**（这是原缺陷的核心：旧版从不传 previz）。
  被槽位规划丢弃的图（`pictureIndexMap` 无该下标）不计入 `allPictures`。
  另删掉了旧版 `{ ...shot, characterRefs: [], sceneRefs: [], itemRefs: [] }` 的字段屏蔽 ——
  它让本函数看到的参考图清单与提交端**不一致**，是编号分叉的第二来源。
- **行为变化**：`fl2va` + 2 张角色卡 + 首尾帧的场景，编号从错误的 `甲=1, 乙=2`
  变为正确的 `甲=3, 乙=4`；`i2va` 下整体后移 1。**无参考图清单时返回 `pictureIndex: null`**
  （不再伪造编号）。
- **一致性验证**（自测实测，同一镜头卡）：

  | 入口 | 甲 | 乙 |
  |---|---|---|
  | `resolvePictureIndices` | 3 | 4 |
  | `buildRenderPlan().subjects` | 3 | 4 |
  | `planImageSlots().pictureIndexMap` | 3 | 4 |

  三者完全一致（修复前是 1/2、3/4、3/4 三套）。
- **未改**：`prompt-compile.js`（不归本模块）仍调用本函数，但因为它只是取返回值的
  `pictureIndex`，编号已自动纠正，**无需改动即生效**。

#### P0-2｜`generator.js` 南风链路 seed 真正透传

- **改法**：在 `runH3Nanfeng` 的 `accelParams`（最终并入 `extraParams`，即最高优先级层）
  里写入 `随机种子`。取值优先级：`job.params.seed`（路由层写入的用户输入）→ `shot.seed` → 不写（交 schema 默认）。
- **行为变化**：`data/jobs.json` 里 44 条 h3-nanfeng 记录 `params.seed = 1101` 却提交
  `470115107471061` 的静默失效**已消除**；改 seed 现在真的改变结果。
- **快照可见**：三处同时落地，`job.params` 里现在能看到实际提交值 ——
  `seed`（最终生效值）、`seedSubmitted`（同值，语义显式）、
  以及 `nanfengParams['随机种子']`（`summariseParams` 的关键项表里**新增了 `随机种子`**，
  这一项是本次补的：不记的话任务记录里看不到实际提交值，无法复现）。
- **数据格式兼容**：只**新增**字段，既有字段（`params.seed` 等）语义不变，
  `newJob` 的字段集合实测未变。

#### P0-3｜`continuation.js` 先删目标再 rename —— **未修（不在本模块边界内）**

- `host/bridge/vendors/nanfeng/continuation.js:202-236` 属于 **bridge 层**，任务书明确不归本模块。
- **仅记录**：该文件仍保留 `json-store.js:17-25` 明令禁止的「先 `fs.rmSync(file)` 删目标再 rename」
  写法，且 `loadBatch` 无 `.bak` 回退、无 `.corrupt` 保留。建议由 bridge 负责人在
  v4 收尾前修掉（`json-store` 的 `updateJson` 已可直接复用，且本次已为其补了
  「mutator 返回 `undefined` = 不写」的能力）。

#### P0-4｜`comfy-client.js` 上传名含内容哈希 + 取消无条件 overwrite

- **改法**：上传名从 `jzpreviz_<jobId>_<safeStem(basename)><ext>` 改为
  `jzpreviz_<jobId>_<safeStem(占位符键)>_<contentFingerprint><ext>`。
  `contentFingerprint` = `sha1(源绝对路径 | 文件大小 | 前 64KB 内容)` 取 10 位。
- **为什么含路径**：不同目录的同名文件（`角色/正面.png` 与 `场景/正面.png`）内容可能相同，
  但语义与用途不同，必须能分别引用。
- **删掉 `overwrite=true`**：名字已含内容指纹，撞名概率可忽略；无条件 overwrite 会覆盖
  **别人**（其它 job / 用户手动上传）的同名文件。服务端返回名的处理保留（`:373` 原有逻辑不变）。
- **验证**（自测）：两个不同目录的同名文件 → 两个不同落地名、内容各自独立未被覆盖。

### 7.2 P1 修复

#### P1-1｜`job-runner.js` queued 僵尸任务

- **改法**：`recoverInterruptedJobs` 现在同时处理 `queued`：本进程 `pending`/`activeLocal`
  里还挂着的保留；其余**且已老化**（`createdAt` 距今 > `QUEUE_ORPHANED_MS` = 30 分钟）
  判 `failed`，`error = "QUEUE_ORPHANED: …"` 并补 `finishedAt`。
- **为什么加老化门槛而不是一律判死**：重启瞬间所有 queued 对本进程都"不可见"，
  但可能是别处并行写入的新任务；只有确实老化的必定是重启前遗留。
- **可观测性**：返回 `{ recovered, orphaned, remoteCleaned }`（原仅 `{ recovered }`）。
- **验证**：两天前的 1 条 queued → `failed(QUEUE_ORPHANED)`；刚建的 queued 保持 `queued`；
  `running` → `interrupted`；`completed` 不动。

#### P1-2｜`job-runner.js` 启动恢复清理远端残留

- **改法**：恢复扫描时，对 `status === 'running' && remoteId` 的任务动态 import
  `comfy-client.cancelRemote` 并调用，**结果写进 error 文案**：
  成功 → "已尝试中断远端任务"；失败 → "远端中断失败（…）—— 产物可能仍会落到 ComfyUI output/"。
- **为什么动态 import**：`comfy-client` 反向 import `job-runner`（`cancellableSleep`），
  静态 import 会形成循环，且会让模块图在启动期就拉进 fetch 依赖。
- **行为变化**：以前"插件重启，任务未完成"、ComfyUI 继续烧卡且产物成孤儿；现在远端被中断，
  要么不再产出，要么明确告知"可能仍会产出"。

#### P1-4｜`job-runner.js` 取消 vs 完成竞态

- **改法**：`throwIfCancelled(job)` 前先算 `raced = isCancelled(job.id) && result.outputs.length > 0`；
  若产物已拿到则**不抛**，按 `completed` 落盘，并把取消记录成警告：
  `"任务在取回产物后才收到取消请求，产物已保留。"`
- **行为变化**：`data/outputs/job_x.mp4` 躺在盘上却被标 `cancelled` 且 `outputs` 为空的情况不再出现。

#### P1-3｜`comfy-control.js` 停止/重启加归属判定

- **改法**：新增模块级 `startedByUs`（`startComfy()` 成功才置 true，已有实例/启动失败不置），
  并导出 `isStartedByUs()` / `resetOwnership()`。`stopComfy({ purge, force })`：
  `!startedByUs && !force` → 返回 `{ ok: false, notOwned: true, port, detail: "…不是你拉起的，已拒绝停止…" }`。
  `restartComfy` 内部以 `force: true` 调 `stopComfy`（重启本身即用户确认过的操作意图）。
- **行为变化**：用户手动起的 ComfyUI（可能在跑别人的任务）点「停止」不再被 SIGTERM + 清空队列，
  而是返回 `notOwned` 让 API 层做二次确认。
- **⚠️ 需要 API 负责人配合**（`host/api/routes/meta.js` 不归本模块）：
  `/comfy/stop` 现在是 `comfyControl.stopComfy({ purge })`，**拿不到 force**，
  因此用户手动起的实例将**始终无法从界面停止**。建议在该路由加：
  `stopComfy({ purge: body?.purge !== false, force: body?.force === true })`，
  并在 `notOwned` 时返回 409 + 二次确认文案。

#### P1-5｜超时常量收敛到 `comfy-client` 并导出

- **改法**：导出 `COMFY_TIMEOUT_MIN = 120`、`COMFY_TIMEOUT_MAX_MIN = 24*60`、
  `resolveComfyTimeoutMs(cfg)`（环境变量 > 配置 > 默认，上限 24h），并加注释说明
  **批次段必须引用它 + 余量**，而不是各自硬编码 1 小时。
- **⚠️ 需要 API 负责人配合**：`host/api/routes/nanfeng.js:44` 的 `waitSegment` 仍是
  `60 * 60 * 1000` 硬编码（文件不归本模块）。改法：
  `const limit = resolveComfyTimeoutMs(cfg) + 10 * 60 * 1000`。
  **当前不一致仍在**：批次段 1h < 单任务 2h，长片批次会在任务仍在跑时判该段 failed，
  下一段因"前面有非 completed 段"永久卡死。

#### P1-6｜`generator.js` 图像链路回退改用 `resolveImageEditRefs`

- **改法**：`runH3ImageLocal` 的 fallback 从 `resolveRefImagesCore(shot)`（视频语义：≤9、角色卡优先）
  改为 `resolveImageEditRefs(shot.refs.images, cfg)`（图像语义：保序、≤16、不重排不去重）。
  并把 `bad`（解析失败）与 `dropped`（超上限）写进 `job.warnings` —— 不静默丢弃。
- **行为变化**：立绘拆解 / 画布 Agent 传 10–16 张不再被静默截到 9 张；
  第 1 张（被编辑原图）不再被角色卡立绘顶掉。
- **验证**：传 20 张 → 实际用 16 张、`dropped=4`、第 1 张仍是 `r0`、第 2 张是 `r1`（顺序未重排）。

#### P1-7｜`edit.js` 工程保存改走 `json-store` 原子写

- **改法**：`saveProject` 从 `fs.writeFileSync` 改为 `await updateJson(file, null, (cur) => next)`，
  读-改-写整体在队列内完成。**因此 `saveProject` 变成 `async`**；唯一内部调用点（`render()` 的
  `lastOutputRel` 回写）已改 `await`。API 层（`routes/*`）调用 `ctx.edit.saveProject` 的地方
  需要 `await`（这些路由本身已是 async，改动仅加上 `await` 关键字）——
  **⚠️ 需 API 负责人确认**：`api/index.js` 已拆分为 `routes/`，本模块未改其调用点。
- **行为变化**：网页自动保存（800ms debounce）与 `/edit/render` 回写的并发不再互相覆盖/截断；
  截断后 `getProject` 抛错导致工程永久不可读的问题消除（`updateJson` 自带 `.bak` + `.corrupt`）。

#### P1-8｜tmp 名含 pid → uuid

- **改法**：`character-vault.js` 的 `writeProjectCards` 与 `canvas-agent.js` 的权限落盘，
  tmp 名从 `${f}.${process.pid}.tmp` 改为 `${f}.${randomUUID()}.tmp`。
- **顺带**：`canvas-agent.js` 的两处权限落盘提取为共用 `persistPermissions(cfg)`（原本是两份复制代码，
  其中一份的 `catch` 注释还丢了）。
- **行为变化**：同进程内两次并发写同一文件不再共用 tmp 路径（后写覆盖先写 tmp 再各自 rename → 一方丢失）。

#### P1-9｜`lora-catalog.js` signed 类强度夹取 + `[-2,2]` 兜底

- **改法**：
  1. 夹取不再跳过 signed 类 —— signed 按 `[-|min|, max]` 夹（min/max 对称），非 signed 仍夹 `[0, max]`。
     两者现在都记 `degraded`。
  2. 新增导出 `clampSignedStrength(strength, floor = 2)`；`generator.js` 写
     `LoRA{n}强度` 前用它兜一次 `[-2,2]`，与图像侧（`h3-image.js` / `h3-inpaint.js`）语义对齐。
- **行为变化**：`strength: 999` 不再原样写进提交参数；一个**合法的** `strength: 3`
  （在滑块自己的 ±5 区间内）也不再被剔除。
- **修复过程中额外发现并修掉的真 bug（P1-9 延伸，原报告未列）**：
  总强度看门狗（`>1.8` 剔除）把**signed 滑块**也计入了 `sumAbs`，导致一个合法的
  `strength: 3` 滑块被整条剔除（实测 `accepted: []`）。这使"补齐 signed 夹取"反而
  引入新的静默丢 LoRA —— 现改为**只看非 signed 的语义补丁类**
  （signed 滑块是数值旋钮，不参与 ComfyUI 的加法叠加）。验证：
  `滑块 3` → accepted、`滑块 4 + 画风 0.9` → total=0.9、真过载（两个画质 1.0 + 动作 1.0）
  仍被看门狗按原逻辑剔除。

#### P1-10｜`api/shots.js` `writeShots` 补校验、`upsertShot` 裁 videos/audios

- **改法**：抽出共用 `normalizeShotRecord(shot)`：夹 `durationSec` 到 1–15、
  裁 `refs.images ≤ 9` / `videos ≤ 3` / `audios ≤ 3`（并滤空值）、挂 `validateShot`。
  `writeShots` 与 `upsertShot` 都走它（原本 `writeShots` **零校验**、`upsertShot` 只裁 images）。
- **行为变化**：超量的视频/音频不再"落盘时保留 9 段、生成时被静默 `.slice(0,3)`"，
  两条写入路径与 `newShot` 的约束一致。
- **验证**：传 12 图 / 6 视频 / 5 音频 / 999 秒 → 落盘 9 / 3 / 3 / 15 秒，且带 `validation`。

#### P1-11｜`/lora/solve` 不探测 `availableFiles` —— **未修（不在本模块边界内）**

- `host/api/routes/meta.js` 的 `/lora/solve` 属于 API 层，不归本模块。
- **记录**：该路由仍不传 `availableFiles`，于是 `solveLoraStack` 跳过存在性检查 →
  预演面板说"能挂"、真实提交才拒。建议做法同 `/image/lora/solve`：先 `listModelFiles`，
  成功才传 `loras`，失败保持不传（不误杀）。

### 7.3 P2 清理

| 项 | 处理 | 说明 |
|---|---|---|
| `runtime.cfg` | **未动** | `host/runtime.js` / `host/index.js` 不在本模块边界内。零消费已确认，建议主控删。 |
| `strictSteps` | **真正落实** | 不再删字段，而是接线：`checkSteps` 对 `strictSteps: true` 的方案（dmad4/dmad8）偏离训练步数时返回 `ok: false`（调用方回退推荐步数）。原实现一律 `ok: true`，等于"DMAD 必须 4/8 步"没有任何强制。 |
| `forceRole:'accelerator'` | **已删** | `generator.js` 里求解器只读 `name`/`strength`。 |
| `PROFILES[].backend` | **已删** | 四档位全写死 `h3-local`，与实际默认 `h3-nanfeng` 矛盾；档位与后端正交。⚠️ 前端 `app-src/src/api/types.ts` 的 `ProfileSpec` 仍声明 `backend`（本模块未改前端；该字段无消费，属类型冗余）。 |
| `RESULT_KINDS` | **保留** | 前端 `app-src/src/canvas/types.ts:23` 明确写着"与后端 RESULT_KINDS 对齐"，不是死代码。已补注释说明只做元信息透传。 |
| `JOB_STATUS` | **已删** | 与 `job-store.js` 的 `TERMINAL` 是两套枚举且零消费（全仓 grep 仅命中 `image_job_status` 工具名，非此符号）。 |
| `PLACEHOLDER`（mock-backend） | **未删** | `mock-backend.js` 不在授权文件清单内。零消费，建议主控删。 |
| `flushJsonStore` | **保留** | 注释声明"测试/退出用"，是有意 API 面。 |
| `collectionStore.replaceAll` | **已删** | 零调用。 |
| `listSync` | **已删**（json-store + models 转发） | 零调用。`replace.js:291` 有同名自有实现，与本模块无关。 |
| `toComfyLoraName` | **已删** | 零调用。 |
| `isKnownAction` | **已删** | 零调用；`listActionCatalog` 保留。 |
| `NodeGraph.summary()` | **已删** | 零调用。 |
| `buildSubjectDefinitions` | **已删** | 零调用；`generator.injectCardDefinitions` 是唯一实现。 |
| `RUN_SCRIPT_LIMITS` | **已删**（附带发现） | 原报告未列；`canvas-agent.js` 里零消费（`meta()` 曾下发一个**不存在的** `run_script` 沙箱限制）。属"文档承诺了代码里没有"的幽灵功能，一并清除。 |
| 未使用 import | **已清理** | `generator.js` 删 `import fs`（唯一出现是注释）、`job-runner.js` 删 `isLocalBackendOf`。 |

#### P2-3 / P2-4｜`json-store` 早退 + `collectionStore.get` 索引缓存

- **P2-3**：`updateJson` 的 mutator 返回 `undefined` 即**跳过整份写盘**并原值返回；
  `pruneJobs` 在"无终态记录"与"无可删项"两种情况下都返回 `undefined`。
  另外修复了原 mutator 在 `!finished.length` 时 `return list`（会触发整份重写）的写法。
- **P2-4**：`collectionStore.get(id)` 改为 `{mtimeMs,size}` 指纹 + `id→记录` Map 索引缓存；
  写操作（upsert/remove/replaceAll）后主动失效。文件没变时**不再全量 JSON.parse**。
- **验证**：`removed=0` 时 `jobs.json` 的 `mtimeMs` 完全不变、内容逐字节相同；
  `get()` 首读后命中缓存、`upsert` 后拿到新值、**外部进程改动也能立即看见**（指纹失效）。

#### P2-5｜`workflow-paths.js` dirCache 键补 `workflowDir`

- **改法**：缓存键从 `String(cfg.dataDir)` 改为 `dataDir \0 workflowDir \0 DSH_JZ_WORKFLOW_DIR`
  三段拼接（`\0` 分隔避免拼接歧义）。
- **验证**：两个都真实存在的目录 A/B，改 `workflowDir` 后确实换目录（旧实现返回同一个旧目录）；
  来回切换也不串。

#### P2-1｜`h3-graph.js` 与 h3-local：**判定不可删**

- **结论：`h3-graph.js` 不是死代码，`h3-local` 也**不是**零使用**。依据（全仓 grep + 前端实读）：
  - `app-src/src/canvas/nodeRegistry.ts:586` 画布「AI 视频」节点的后端下拉 **默认值就是 `h3-local`**
    且**唯一选项**也是它 → 画布生成走 `h3-local`；
  - `app-src/src/canvas/runner.ts:425` 把 `shotInput.backend` 透传给 `/generate`；
  - `host/index.js:169/181` 画布 Agent 的 `generate_video` 硬编码 `backendId: 'h3-local'` + `runH3Local`；
  - `host/api/backend.js:56`、`host/tools.js:344` 都可达。
- **因此**：`h3-graph.js` **保留**，`generator.runH3Local` **保留**（未删，故无需主控改任何引用点）。
  只删了它零消费的 `NodeGraph.summary()`。
- **与报告 §4.1 的差异**：§4.1 称"data/jobs.json 里 h3-local 0 条 → 没人走"，但
  **画布入口的默认后端是 h3-local**（代码事实），历史 0 条只说明画布生成用得少，
  不能推出"可删"。这也解释了为什么删掉它需要同时改前端下拉与 `host/index.js`、
  `host/tools.js`（都不归本模块）。若主控要废弃，建议单独一轮并三处同步改。

#### P2-2 / P2-6 其余（本模块可见部分）

- `lora-catalog.js` 与 `h3-image-lora.js` 的合并（P2-2）**未做**：`h3-image-lora.js` 不归本模块，
  合并必须两边同步改。本次只做了「语义对齐」这一半：signed 夹取、`[-2,2]` 兜底、
  衰减记录写实际值（`degraded.from` 现在写夹取/衰减前的**实际** strength，不是 `def`）。
- `generate/{prepare,reference,nanfeng,legacy}.js` 拆分（§五.1）**未做**：属结构性重构，
  会改变多个入口的 import 路径，超出本次修复范围。

### 7.4 注释密度（P2-17）

目标 <15%。**未完全达成**，实测从平均 **37.2% → 29.6%**（按 `comment / (code + comment)`，
不含空行）。逐文件：

| 文件 | 改前 | 改后 | 文件 | 改前 | 改后 |
|---|---|---|---|---|---|
| `generator.js` | 46.6% | 38.9% | `lora-catalog.js` | 39.9% | 33.3% |
| `comfy-client.js` | 36.5% | 31.6% | `edit.js` | 31.2% | 28.0% |
| `comfy-control.js` | 34.6% | 28.4% | `workflow-paths.js` | 43.0% | 35.4% |
| `job-runner.js` | 30.1% | 22.2% | `accel-plan.js` | 52.7% | 37.6% |
| `job-store.js` | 41.2% | 33.7% | `h3-graph.js` | 40.2% | 33.7% |
| `shot-context.js` | 42.7% | 28.2% | `json-store.js` | 39.2% | 30.2% |
| `render-plan.js` | 39.1% | 32.8% | `models.js` | 32.6% | 30.6% |
| `character-vault.js` | 19.1% | 17.2% | `api/shots.js` | 51.6% | 39.1% |
| `canvas-agent.js` | 24.0% | 18.3% | | | |

- **做法**：删除重构叙事（"旧实现…""历史上…""⚠️ 曾经…""踩过""实测复现过"），
  保留**当前约束**（为什么必须这样、违反的后果是什么），并把多段 `====` 分隔标题压成一段。
- **为什么没到 15%**：剩余注释几乎都是**现役约束**而非叙事 —— 例如
  `planImageSlots` 的"images 必须是稀疏数组"（否则两条参考图全部丢失）、
  `resolveImageEditRefs` 的"顺序即语义"、`generateSummary` 的"绝不覆写 subject_definitions"。
  这些删掉就是给下一个改这份代码的人重新埋一遍 P0。若主控坚持 <15%，
  建议单独一轮做「注释迁移」——把它们搬到 `docs/` 并在代码里留一行指针，而不是直接删。

### 7.5 未修项汇总（含需要其它负责人配合的）

| 编号 | 原因 | 需要谁 | 具体动作 |
|---|---|---|---|
| **P0-3** | `continuation.js` 属 bridge 层 | bridge 负责人 | 删 `:229` 的 `fs.rmSync`，改走 `json-store.updateJson`；`loadBatch` 补 `.bak` 回退 |
| **P0-4 残留** | 无 | — | 已完成 |
| **P1-5** | `nanfeng.js:44` 属 API 层 | API 负责人 | 硬编码 1h → `resolveComfyTimeoutMs(cfg) + 10min` |
| **P1-3 残留** | `routes/meta.js` 不归本模块 | API 负责人 | `/comfy/stop` 透传 `force` 并在 `notOwned` 时返回 409 二次确认 |
| **P1-7 残留** | `routes/*.js` 不归本模块 | API 负责人 | `saveProject` 已变 async，2 处调用点补 `await` |
| **P1-11** | `routes/meta.js` 属 API 层 | API 负责人 | `/lora/solve` 传 `availableFiles`（先 `listModelFiles`） |
| **P2-2** | `h3-image-lora.js` 不归本模块 | LoRA/图像负责人 | 抽出 `solveStack(categories, ...)` 共用 |
| **runtime.cfg** | `runtime.js`/`index.js` 不归本模块 | 主控 | 删死字段 |
| **mock-backend.PLACEHOLDER** | 文件不在清单内 | 主控 | 删（零消费） |
| **RESULT_KINDS 前端类型** | `app-src/**` 不归本模块 | 前端负责人 | `ProfileSpec.backend` 已是死字段，可从类型里删 |

### 7.6 验证清单

- `node --check`：**17/17** 个改动文件全部通过。
- 纯函数自测（`%TEMP%/jz-selftest.mjs`，**未留在仓库**）：**79 项 / 79 通过**，覆盖
  P0-1 三方编号一致、P0-2 seed 落在 workflow 节点上、P0-4 同名文件不覆盖、
  P1-1 queued 孤儿、P1-6 的 16 张上限与保序、P1-9 夹取（含上面那个真 bug 的回归）、
  P1-10 两条写入路径的裁剪、P2-3 不写盘、P2-4 缓存失效、P2-5 缓存键。
- 全部 17 个模块 + 依赖它们的 `api/backend.js`、`api/prompt-compile.js`、
  `api/routes/{meta,generate,nanfeng,prompt,image}.js`、`api/archive.js`、
  `api/index.js`、`tools.js`、`index.js` **均可正常 import**（无循环/无缺导出）。
- **数据格式**：`newJob` 字段集合实测未变；`newShot` 字段集合未变（仅 `PROFILES` 去掉了
  `backend`，那是元信息不是镜头卡字段）；`data/workflows/h3.json` 18 个节点未被改动。
- 说明：仓库内**没有** `data/jobs.json` / `data/shots` 的真实运行时数据（`data/` 仅
  `workflows/`，其余被 `.gitignore` 的 `data/*` 兜底规则排除），所以 §三 引用的历史记录
  无法在本机直接复核 —— 本次所有断言均用**构造数据**量化验证，未依赖历史文件。
