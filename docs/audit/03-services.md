# 业务服务层与存储层 审计报告

> 审计范围：`host/services/`（29 个 .js）+ `host/store/json-store.js` + `host/store/models.js`，共 30 个文件；
> 交接清单标称 11,000+ 行，实测 **12,064 行（非空行口径）/ 约 13.5k 总行**。
> 审计时间：2026-11-23。执行者：a3-services（只读审计，未修改仓库任何文件）。
>
> **覆盖面声明（重要，避免夸大）**
> - **逐行通读（9 个）**：`json-store.js`(343)、`models.js`(653)、`job-store.js`(135)、`job-runner.js`(237)、
>   `ref-images.js`(403)、`generator.js`(1075)、`comfy-client.js`(550)、`comfy-control.js`(365)、`comfy-lifecycle.js`(91)。
> - **定向抽查（6 个）**：`render-plan.js`(330–423 编号段)、`edit.js`(230–359 concat/xfade)、
>   `blender-service.js`(590–644 产物判定)、`extras.js`(140–180 写路径)、`replace-runner.js`(175–214 断点续跑)、
>   `replace.js`(函数清单)。
> - **未逐行覆盖（15 个）**：`h3-workshop` `h3-image` `character-vault` `breakdown` `shot-context` `shot-splitter`
>   `media-probe` `accel-plan` `lora-catalog` `canvas-agent` `workflow-paths` `ffmpeg-tools` `prompt-llm`
>   `asset-service` `post.js`（除 resolveUserPath 一行）。这些只在 grep 层面被交叉验证过，
>   **不对其内部逻辑下结论**，相关疑点集中放在 §四。
> - 行号为主汇报口径；交接清单里的行数（如 json-store 302）是 `Measure-Object -Line` 的**非空行**计数，
>   与 `read` 报告的总行数（343）差 41 行空行，两者都正确、口径不同。

---

## 一、概览

| 级别 | 数量 | 说明 |
|---|---|---|
| **P0** | **0** | 本轮**未发现新的 P0**。历史上三类 P0（删目标再 rename 丢数据 / `ref_video_undefined` 编号塌缩 / `planImageSlots` 压缩丢图）经代码核对**确实已修复且未被回退**，见 §二 的「正面确认」 |
| **P1** | **5** | 参考视频/音频编号仍会被压缩（注释宣称已保位，实际相反）· 批次生命周期用布尔而非引用计数 · 停止 ComfyUI 会误报"本来就没在运行" · 换人断点续跑不校验源视频身份 → 新旧素材混剪 · `buildSubmissionRefs` 自称"唯一入口"却零调用者（唯一真源在调用约定层失效） |
| **P2** | **27** | 写盘放大/非原子兜底/探测缓存吞失败/轮询吞异常/两套模式别名表/三处素材重编号约定/250 行双份实现等 |
| **P3** | **12** | 死代码、重复实现、注释与代码不符、冗余条件，详见 §五 清理清单 |
| **存疑** | **6** | 需运行时或读未覆盖文件才能定性（§四） |

**总体判断**：存储层的核心不变量（串行队列、原子写不删目标、损坏保留 `.corrupt`、`pruneJobs` 改批量）
**已经立住**，是本仓库质量最高的一块。真正的问题集中在**「编号/槽位」这条语义链的上游组合层**——
`ref-images.js` 单点设计是对的，但 3 个消费者各自在它外面又拼了一层过滤/重排，
于是"唯一实现"在**调用约定**上被重新写散了一遍。这是本轮最值得修的结构性缺陷。

---

## 二、逐文件审查

### host/store/json-store.js（343 行）
- **职责**：全仓唯一 JSON 落盘实现；per-file Promise 串行队列 + 原子写 + `.bak`/`.corrupt` + EPERM 重试。
- **结论：OK（正面确认，质量最高的一块）**

**正面确认（逐条核对历史事故的修复是否成立）**
- ✅ **「先 rmSync 删目标再 rename」已被根除**。`json-store.js:167-187` 重试循环内**只对同一 tmp 反复 rename**，
  第 174 行以注释形式把禁止事项钉死：`// ⚠️ 关键：这里不删目标文件。删了会让"重试失败"变成"数据丢失"。`
  失败路径 `:178` 只删 tmp，`:180-186` 退回 `overwriteFallback`。全文件 **grep 不到任何对 `file` 的 rmSync**。
- ✅ **`.corrupt` 保留**：`:127-131` 解析失败先 `copyFileSync(file, file+'.corrupt')` 再抛 `CORRUPT_JSON`，不再静默清空。
- ✅ **`.bak` 先备份**：`:96-103` + 在每次写之前 `:161` / `:195` 调用，且只对非空普通文件生效。
- ✅ **per-file 串行队列成立**：`:242-253` `updateJson` 读-改-写整体入队；`:250-251` 用 `prev.then(run, run)`
  保证**前一次失败也继续**，并让队尾自身不携带 rejection（避免 unhandled rejection 且不卡队列）。这个细节写对了。
- ✅ **tmp 名零碰撞**：`:90-93` 用进程内自增序号替代旧的"时间戳+4 位随机"。
- ✅ **TOCTOU 已消除**：`readSync`（`:115-132`）直接 readFile 再按 `err.code==='ENOENT'` 分支，不预先 existsSync。

**发现**
- **[P2] `json-store.js:271-273` + `extras.js:150` —— `writeJson` 是同步裸写，**完全绕过**串行队列，
  而它有一个真实的并发调用者。**
  证据：`export function writeJson(file, value) { writeSyncAtomic(file, value); }` —— 没有任何队列入队动作；
  对比 `updateJson`（`:242-253`）与 `replaceJson`（`:276-278`）都入队。
  `extras.js:150` 处是 `const writeJson = (f, v) => { writeJsonCore(f, v); return v; };`，
  被 `upsertTemplate`(:171)、`deleteTemplate`(:176)、服化道(:245,:250)、动态条(:451,:456) 使用，
  且都是**先 readJson 再 writeJson** 的读-改-写形态（例如 `:160-171`）。
  → 两个并发的 `upsertTemplate` 会互相覆盖（经典 last-write-wins），而 `extras.js:149` 的注释
  写着「原子写也统一走 json-store（它已经有 .bak + 正确的重试策略）」——只拿到了"原子"，
  **没拿到"串行"**，注释在这一点上是误导性的。
  修复建议：把 `extras.js:150` 的五处读-改-写改成 `await updateJson(file, [], mutator)`，
  `writeJson` 保留但加注释「仅限单写者，禁止用于读-改-写」。
- **[P2] `json-store.js:145-153` `overwriteFallback` 的"覆盖"不是原子的。**
  `fs.copyFileSync(tmp, file)` 在目标文件上原地覆写：若此进程在拷贝中途被杀，
  `.bak` 是上一版、但目标文件变成**截断 JSON**。注释（`:141-143`）已如实说明这一点，
  但注释的结论「绝不会出现旧实现那种两份都没了」只在"单次运行内"成立；
  下次启动 `readSync` 会对这个截断文件命中 `:127-131` → 抛 `CORRUPT_JSON`，
  **调用方若不 catch（`projects.list()` / `jobs.list()` 都直接 `readSync`），整个进程的读取路径会持续抛错**，
  需要人工删 `.corrupt`/`.bak` 才能恢复。修复建议：`updateJson` 的调用方统一 catch `CORRUPT_JSON` 并
  降级到 `${file}.bak` 重试一次（`.bak` 已经在写，恢复路径却不存在——见 §五 #10）。
- **[P2] `json-store.js:161` / `:195` 每次写都全量 `copyFileSync` 生成 `.bak`，写放大 2×。**
  `jobs.json` 实测 608KB（`job-store.js:118` 注释），每次任务收尾要写 1 次
  → 每次 rename + 每次 copyFile + 每次 608KB 序列化。低风险但可优化：
  只在 `file` 内容哈希或 mtime 变化时备份，或在 `pruneJobs` 这种批量写前才备份。
- **[P2] `json-store.js:297-310` `collectionStore.list()`/`get()`/`listSync()` 是**无队列读**。**
  rename 是原子的，所以不会读到半个文件；但 `overwriteFallback` 的 `copyFileSync` 期间（`:149`）
  另一协程 `readFileSync` 有很大概率读到**截断内容** → `CORRUPT_JSON` 被误报，
  并顺带生成一个假的 `.corrupt` 副本。这几率低但后果是"数据看起来损坏了"。
  修复建议：读路径命中 `CORRUPT_JSON` 且**没有** `tmp` 在途时再重试一次（延迟 20ms），或在
  `overwriteFallback` 里用 `fs.copyFileSync(tmp, file + '.partial')` + rename 二次兜底。
- **[P3] `json-store.js:256-259` `flushJsonStore` 只 snapshot 调用瞬间的队列，且有已 settle 竞争。**
  `:251` 把队尾替换成 `next.then(()=>{},()=>{})`，所以 `[...queues.values()]` 拿到的通常是
  **已经 settle 的代理**而非真实在途 promise；同时调用之后新入队的写不会被等待。
  当前唯一用途是"测试/退出"，影响可忽略，但注释「等待所有在途写完成」比实际能力强。

---

### host/store/models.js（653 行）
- **职责**：领域模型常量（14 类资产 / 26 节点 / 19 模型槽 / 4 档 profile）、模式归一化唯一真源、
  分辨率与帧数换算、镜头卡 `newShot`/`validateShot`、3D 预演数据规范化、动作清单从 `actions.py` 派生。
- **结论：有问题（P2×2）**

**发现**
- **[P2] `models.js:94-120` 与 `ref-images.js:345-354` 是两份**互不相同的**模式别名表，已在两处真实漂移。**
  证据（同一输入两种结果）：
  - `models.normalizeMode`：`:114` `const bare = raw.includes(':') ? raw.slice(raw.indexOf(':')+1) : raw;`
    → `'h3:T2V'` → 剥前缀 → `'t2va'`；
  - `ref-images.normalizeImageMode`：`:346` 只做 `trim().toLowerCase()`，**不剥前缀**
    → `'h3:t2v'` 不命中 `:350` 的任何分支 → 落 `:353` 的兜底 `'ref2va'`。
  → 同一个镜头卡 `mode:'h3:T2V'`，**提示词编译器认为是文生视频，槽位规划认为是全参考**，
    在 fl2va/i2va 下会差 1–2 个槽位号（正是 `prompt-compile.js:214-223` 记录过的串脸事故形态）。
  另有表内容差异：`models` 认 `t2v/T2V`、`ref/REF/ref2v`；`ref-images` 只认小写，**不认 `ref2v` 之外的
  `ref`**（`ref-images.js:352` 有 `ref2v` 但没有 `ref`；`models.js:99` 两个都有）。
  `ref-images.js:341-343` 的注释解释了自己造这份表的原因（"避免反向依赖 store"），
  这个理由成立，但**没做一致性约束**。
  修复建议：把别名表提到一个无依赖的 `host/services/mode-aliases.js`（或 `store/mode.js` 不含 fs 依赖），
  两边都 import；并加一条 `smoke-api` 断言：对 `H3_MODE_ALIASES` × `IMAGE_MODES` 全集，
  两个函数输出必须相同。
- **[P2] `models.js:216-236` `H3_MODEL_SLOTS` 19 档槽位表：本轮范围内 grep 不到消费者。**
  归属 P3/清理（见 §五 #5），此处记录因为它与 `generator.js` 的 7 个 `MODEL_DEFAULTS` 键
  （`:39-51`）在语义上重叠：一个说"19 个模型槽"，一个说"7 个文件名"，**没有映射关系**。
- **[P3] `models.js:288-318` / `job-store.js:30-41` / `json-store.js:287` 三处各自实现惰性单例。**
  `models.js:273-286` 的 `lazily()` 是最完整的一份（含 `reset`），
  `job-store.js:34-41` 是手写同构版本，`collectionStore` 又是另一种。可合并（§五 #12）。

**正面确认**
- ✅ `models.js:206-213` `h3Length` 已夹到 `[124,362]` 且注释明确写了旧实现只夹下限 5 的错误。
- ✅ `models.js:384-388` `newShot` 的 `refs` **继承** `rest.refs` 而非写死空数组（`:377-383` 注释记录的历史 P1）。
- ✅ `models.js:398-400` / `:410` 3D 预演字段与 `nanfeng` 覆盖字段都已显式保留，白名单构造没再丢字段。
- ✅ `models.js:432-485` `actionCatalog()` **真的**从 `host/blender/actions.py` 解析而非手抄
  （`:459` 正则 + `:469-474` 解析失败退化为不限制并暴露），这是本仓库少见的"单一真源"正确姿势。

---

### host/services/job-store.js（135 行）
- **职责**：任务集合存储、`LOCAL_BACKENDS` 单一真源、`pruneJobs` 保留策略。
- **结论：基本 OK（P2×2、P3×1）**

**正面确认**
- ✅ **`pruneJobs` 已不再是"逐条删导致 IO 放大"**。`job-store.js:113-134` 先算好保留集
  （`:131-132` `keptIds` 然后 `list.filter`），最后一次 `:133 store.replaceAll(kept)` 覆盖写。
  `:115-130` 的注释把旧方案的成本算清楚了（608KB/163 条 × 100 次读改写 + Windows EPERM 重试）。
- ✅ **`replaceAll` 没有绕过队列**：`json-store.js:337-339` `replaceAll → replaceJson → updateJson`，
  最终落在 `:242-253` 的同一 per-file 队列。`job-store.js:122-124` 的声明属实。

**发现**
- **[P2] `job-store.js:126-133` 的并发安全依赖**`maxConcurrentLocal===1`，**而这个前提是用户可改的**。**
  证据链：
  1. 注释承认窗口存在：「若中间有并发 upsert 在本函数 list() 之后、 replaceAll() 之前插入，
     那次写入会排在本次 replaceAll 之前执行、随后被覆盖」（`:126-127`）；
  2. 注释的免责理由：「并发闸门 maxConcurrentLocal=1 保证同一时刻只有一个本地任务在跑」（`:129`）；
  3. 但 `maxConcurrentLocal` 在 `config.js:107` 的 `WRITABLE_CONFIG_KEYS` 白名单内，
     `config.js:62` 默认 1 但可被 `/config` 写成 2+；`job-runner.js:21-24` 会直接采用该值。
  → 一旦用户调到 2，两个任务收尾就并发走到 `:219-222` 的 pruneJobs，
    **后完成的 replaceAll 会把先完成那次刚 upsert 的 completed 记录覆盖回旧快照**（丢一条任务历史）。
  修复建议：`pruneJobs` 改为在 mutator 内部完成裁剪，即
  `await updateJson(jobsFile(), [], (list) => computeKept(list))` —— 读与写落在同一队列项里，根除窗口，
  且代码量更少（不需要 `keptIds` 往返）。
- **[P2] `job-store.js:43-60` `newJob` 的 `params: params || {}` 是引用传递，未做快照。**
  `generator.js:223/:329-339/:841-857` 大量 `job.params = {...(job.params ?? {}), ...}` 是重新赋值所以安全，
  但 `runH3Nanfeng` 里 `extraParams` 合并（`:1001-1015`）持有调用方对象，
  且 `newJob` 返回对象被 `replace-runner.js:37-38` 的新 job 复用。
  修复建议：`params: params ? structuredClone(params) : {}`（`setImmediate` 级成本，避免上游后续改对象导致快照失真）。
- **[P3] `job-store.js:22` `LOCAL_BACKENDS` 包含 `'mock'`，会让 mock 也去抢真卡槽位。**
  `mock` 走 `mock-backend.js`，只出 ffmpeg 色卡（`tools.js:440-442`），不占显存。
  把它放进闸门会导致"测试任务排队等 GPU 空位"。语义上应拆成
  `GPU_BACKENDS = {h3-local,h3-image,h3-nanfeng}` 与 `LOCAL_BACKENDS = GPU_BACKENDS ∪ {mock}`，
  闸门只看前者。注意不要顺手删 `mock`——它**仍在生产路径**（见 §五 #16）。

---

### host/services/job-runner.js（237 行）
- **职责**：并发闸门、取消语义（含远端 `/interrupt`）、崩溃恢复、终态收尾触发裁剪。
- **结论：基本 OK（P2×3、P3×1）**

**正面确认**
- ✅ **取消不再吞远端异常**：`job-runner.js:96-111` 把 `onRemoteCancel` 的失败转成
  `remoteCancel:'failed' + remoteCancelError` 一并返回，`:68-74` 的注释把"UI 说已取消、GPU 还在跑"的
  静默失败说清楚了。
- ✅ **`remoteId` 在提交瞬间落盘**：`:148-159` 闭包内 `job = {...job, remoteId}` 后立即 upsert，
  `comfy-client.js:431-443` 有对应回调与理由。`:153` 的注「要更新闭包里的 job 引用，避免收尾时用旧值覆盖回 null」
  是这条链能成立的关键，写对了。
- ✅ **`queued` 不再被误标 interrupted**：`:114-135` 只处理 `status==='running'`，理由在 `:117-125`。
- ✅ **取消可打断休眠**：`:54-63` 切成 ≤250ms 片，配合 `comfy-client.js:457` 的 `cancellableSleep`。

**发现**
- **[P2] `job-runner.js:81` 终态判定漏了 `'interrupted'`。**
  `if (['completed','failed','cancelled'].includes(job.status))` 不含 `interrupted`，
  而 `interrupted` 是 `recoverInterruptedJobs`（`:132`）写的合法终态、也在 `models.js:138-140`
  的 `JOB_STATUS` 和 `job-store.js:80` 的 `TERMINAL` 里。
  后果：对一条已 `interrupted` 的任务再点取消，会走进 `:84-85` 把它改成 `cancelled`
  （覆盖掉"重启中断"这一有诊断价值的信息），并继续对可能为 `null` 的 remoteId 调远端取消。
  修复建议：把 `'interrupted'` 加入 `:81` 的数组（或直接用 `job-store.js:80` 的 `TERMINAL` 集合，见 §五 #6）。
- **[P2] `job-runner.js:172-175` 非本地后端**没有任何并发限制**，却在同一处收尾触发 `pruneJobs`（`:219-222`）。**
  链路：`local = isLocalBackend(job.backendId)`（`:149`）→ 非本地分支只查取消后立刻 `:177` 置 running。
  当前所有后端都在 `LOCAL_BACKENDS` 内，所以这是**潜在**问题（新增云端后端时触发）；
  与上一条 `maxConcurrentLocal>1` 叠加时，prune 的窗口会真实打开。修复同 job-store 那条（mutator 内裁剪）。
- **[P2] `job-runner.js:219-222` 用动态 `import('./job-store.js')` 只为拿 `pruneJobs`。**
  `:9` 已经从同一模块静态 import 了 `jobs`、`isLocalBackendOf`、`LOCAL_BACKENDS` —— 同模块内
  动态 import 不会打破任何循环依赖（模块早已加载完成）。注释说放在这里是为了"终态之后"，
  这个**位置**理由成立，但用动态 import 表达位置是重构残留。
  修复建议：`:9` 的静态 import 里加 `pruneJobs`，`:220` 改为直接调用。
- **[P2] `job-runner.js:226` 的 `finally` 在 `return job` 之后仍会执行，但失败路径的 job 从未回写。**
  具体：`:161-206` 的 catch 分支构造了新 `job` 并在 `:207` upsert；但若 `:207` 的 upsert 自身抛错，
  异常会从 `finally` 之前冒泡 → `:224-225` 仍 clear/release（正确），
  但**任务永久停在 `running`**，只能等下次启动 `recoverInterruptedJobs` 兜。可接受，但建议 `:207`
  用 `try{...}catch{ 记日志 }`，避免"存储写失败 → 任务卡 running"。
- **[P3] `job-runner.js:14` / `:41-43` `cancelled` Set 只靠 `finally` 清理，存在泄漏路径。**
  若 `cancelJob` 对一条**永不 runJob** 的任务（插件重启前排队）markCancelled，`:224` 的 clear 永不执行，
  Set 留下一个永久 id。量极小，但可用 `Map<jobId, deadline>` + TTL 清理。

---

### host/services/ref-images.js（403 行）
- **职责**：全仓唯一的参考素材解析 + `图片1..9` 槽位规划 + 首尾帧占槽。
- **结论：核心算法 OK，但"唯一实现"被调用方架空（P2×2）**

**正面确认（本轮抽查的重点，结论：槽位真的是定长 9 且不压缩）**
- ✅ **`planImageSlots` 返回稀疏定长数组**：`ref-images.js:321`
  `const images = new Array(MAX_REF_IMAGES).fill('')`，`:331` `images[slot - 1] = refs[i]`（**按槽位号定位**，
  注释 `:300-320` 完整记录了"三张参考图丢两张"的历史 P0 与稀疏数组的修复原理）。
  实测口径（`tools/smoke-api.mjs:3030-3046` 有对应断言）：
  `planImageSlots('fl2va',[c1,c2,c3],first,last)` → `images=[<空>,<空>,c1,c2,c3]`、`reserved=[1,2]`、
  `pictureIndexMap={0→3,1→4,2→5}`。**编号不压缩、不塌缩，确认。**
- ✅ **`reserved` 避让循环正确**：`:326-334` 每张图先 `while (reserved.includes(slot)) slot += 1`
  再写入，`dropped` 在 `slot > MAX_REF_IMAGES` 时记录、**不静默丢**（`:329`），
  上层 `:395-400` 有对应 warning。这是正确的失败可见设计。
- ✅ **四类模式占槽规则正确**：`:291-297` i2va 尾帧不占槽（只 `图片1`）、fl2va 首尾占 1/2、
  ref2va/t2va 不占槽（`reserved` 空）→ 与 `:32-34` 的文档表一致。
- ✅ **`resolveMediaEntries` 刻意保留 missing 占位**：`:217-219` 注释「filter 掉之后 `<Video 2>` 会变成
  `<Video 1>`，而提示词还是按原来的编号写的」，`:244` 用 `missing: !abs` 而非丢弃。**设计正确**——
  但调用方违反了它，见下方 P1。
- ✅ **`resolvePrevizArtifacts` 只认 previz 通道**：`:251-264`，不混进参考图，与 `:160` 的声明一致。

**发现**
- **[P2] `ref-images.js:190-193` `if (!push(...)) break;` 用"push 失败"当"应该停止"，
  会因**一张重复图**截断整条 `characterRefs` 列表。**
  证据：`push`（`:168-174`）在**三种**情况下返回 `false`：`!abs`（解析失败）、`seen.has(abs)`（重复）、
  已达上限。而 `:192` 的写法是
  `for (const img of ref.images) { if (!push(...)) break; }` ——
  只要人设卡的第 1 张图与前面角色卡仓库的图**路径相同**（这是常见情形：同一张立绘既在卡仓库又在人设卡），
  `push` 返回 false → `break` → 这张卡**后面所有分图被跳过**，而它们本来可以正常入选。
  对比 `:195`（`characterRefs` 非 images 形态）用的是直接 `push(...)` 不 break，`:`:200-209` 也是直接 push
  —— **只有这一个分支用了 break，是明显的不一致**。
  修复建议：`break` 改成 `continue`（`:192`），即 `for (const img of ref.images) { if (out.length >= MAX_REF_IMAGES) break; push(...); }`。
- **[P1] `ref-images.js:373-403` `buildSubmissionRefs` 是**死代码**，而它自称"上层唯一需要调的入口"。**
  证据：全仓 grep `buildSubmissionRefs` 只命中 `ref-images.js:373`（定义处），**零调用者**。
  真实调用方全部绕过它、各自手拼三步流水线：
  - `generator.js:860` + `:955` + `:1004`（南风路径，手拼 resolveRefImages → planImageSlots → inject）
  - `prompt-compile.js:211` + `:226`（编译预览路径，手拼同样的三步）
  - `render-plan.js:413`（预览路径，手拼同样的三步）
  - `shot-context.js:204`（只调 resolveRefImages）
  → 于是"四份实现合并成一份"这个重构**只完成了生产者一半**：函数合了，**调用约定没合**，
    已经出现真实分歧：`prompt-compile.js:229` 传的是 `refs.map(r=>r.abs)`（**绝对路径**），
    `generator.js:955` 传的是 `stagedImages`（**ComfyUI input 文件名**）。
    两条路径各自正确（因为下游消费方不同），但"同一份 result 结果由四个调用方取用"的承诺已经失效。
  修复建议：二选一 —— ① 删掉 `buildSubmissionRefs`（§五 #3），并把 `:363-365` 的文档改成"三个函数必须按序调用"；
  ② 真正让三条路径都走 `buildSubmissionRefs(shot,{mode,stage})`，用 `stage` 参数消除文件名/绝对路径分歧
  （该参数已存在且实现正确，`:388-392`）。推荐 ②，因为它是当初设计的本意。
- **[P2] `ref-images.js:345-354` `normalizeImageMode` 与 `models.normalizeMode` 漂移** —— 详见 `models.js` 那条，两处引用同一证据。

---

### host/services/generator.js（1075 行）
- **职责**：H3 执行器唯一实现（`runH3Local` 模板路径 / `runH3Nanfeng` 南风路径 / `runH3ImageLocal`）、
  模型名探测、加速方案接线、参考素材 staging、提示词卡定义注入。
- **结论：有问题（P1×1、P2×4、P3×3）**

**正面确认**
- ✅ **`ref_video_undefined` 已根除**。`generator.js:257` / `:261`（Local 路径）与 `:879` / `:883`（Nanfeng 路径）
  现在都显式写了 `index: i + 1`：
  `.map((v, i) => ({ ...v, index: i + 1, key: \`{{REF_VIDEO_${i + 1}}}\` }))`。
  下游拼键处 `:444` `ref_videos.ref_video_${v.index}` / `:446` / `:453` 因此恒为定义值。
  `:245-252` 与 `:865-875` 两处注释把历史事故（多个视频塌缩成同键、ComfyUI AUTOGROW 不报错）记录完整。
- ✅ **`injectCardDefinitions` 不再覆写官方 `subject_definitions`**：`:198-202` 有定义段时**只追加**
  `Additional reference bindings:`，无定义段才前置；新增文本全英文。`:135-157` 的 P0 说明与实现一致。
- ✅ **编号换算走 `pictureIndexMap`**：`:164-166` `toPictureNo` 用 Map，`:172` 被槽位丢弃的图返回 `null` 并跳过，
  不再直接 `i+1`（南风路径 `:1004` 确实传了 `slotPlan.pictureIndexMap`）。
- ✅ **`runH3Local` 的图编号链自洽**：`:377` `names = refList.map(r=>staged[r.key])` + `:424`
  `ref_images.ref_image_${i+1}` + `:231` `injectCardDefinitions(...)` 不传 map（退回 `i+1`）——
  三者一致，因为 Local 路径**不使用** `planImageSlots`。这一条我特意核对过，**不是缺陷**（易误报）。

**发现**
- **[P1] `generator.js:876-883` + `:903-906` + `:969-979` —— 参考视频/音频的编号**仍在被压缩**，
  而紧邻的注释宣称已"保位"，两者直接矛盾。**
  证据链（同一个函数内，三处互相打架）：
  1. `:876-883`（也见 Local 路径 `:254-261`）：
     `resolveMediaEntriesCore(shot.refs?.videos, cfg).filter((v) => v.abs).slice(...).map((v,i)=>({...v, index:i+1}))`
     —— `.filter(v => v.abs)` 把**解析失败**的条目删掉，然后 `index = i + 1` **重新从 1 编号**。
     这正是 `ref-images.js:217-219` 明令禁止的形态（它为此专门保留 `missing` 占位不删）。
  2. `:903` `const stagedSlot = (entries) => entries.map((e) => staged[e.key] ?? '')` —— 这里确实保位了，
     `:969-979` 的注释花了两段解释"不能 `.filter(Boolean)` 压缩，否则第 3 段前移成第 2 位"。
  3. 但压缩发生在**更上游的第 1 步**：`stagedSlot` 拿到的 `videoEntries` 已经是过滤+重编号后的数组。
     `entries.map(...)` 对一个**已被压缩**的数组做保位，等于什么都没保住。
  → 具体事故形态：`refs.videos = [v1(缺失), v2(存在)]` → `videoEntries=[{v2,index:1}]` →
  提交 `ref_videos.ref_video_1 = v2`，而提示词里写的是 `<Video 2>` → 模型把 v2 当第二号素材用，
  第一号空缺。**指令与素材错位，且 ComfyUI 不报错**（AUTOGROW 允许多余/缺失键）。
  附带：`warnMissingMedia`（`:112-120`）的告警文案是「已跳过（提示词里的引用会变成**悬空**）」——
  实际不是悬空，是**前移**；这句文案本身也在误导排障方向。
  修复建议：删掉两处 `.filter((v) => v.abs)`，改为保位后按 index 过滤：
  ```js
  const videoEntries = resolveMediaEntriesCore(shot.refs?.videos, cfg)
    .slice(0, MAX_REF_VIDEOS)
    .map((v, i) => ({ ...v, index: i + 1, key: `{{REF_VIDEO_${i + 1}}}` }));
  // 下游：staged[v.key] 为空即"该槽留空"，不重排 index
  ```
  并把 `warnMissingMedia` 文案改成「对应槽位留空（提示词里的 `<Video N>` 不会指向其它素材）」。
- **[P2] `generator.js:250-260` / `:624-1050` 两份执行链有约 250 行近乎逐字重复。**
  重复段：accel 选择（`:299-302` vs `:660-663`）、stepCheck/warnings（`:306-327` vs `:687-708`）、
  媒体解析+stage（`:254-270` vs `:876-892`）、toStage 组装（`:264-269` vs `:886-891`）、
  `job.params` 快照（`:329-339` vs `:841-857`）。
  **已经出现实质分歧**，不是纯美观问题：
  - Local 用 `planForShot(accelId)`（`:303`），Nanfeng 用 `resolveAccelForFiles(accelId, loraFiles)`（`:684`）
    → 同一镜头在两条后端上可能选中不同 LoRA 文件；
  - Local 的 `job.params` 无 `loraStack/loraTotalStrength/shiftApplied`（`:329-339`），
    Nanfeng 有（`:841-857`）→ 排查面板字段随后端变化；
  - Local 的 stage 不经过 `planImageSlots`（`:377` 直接用 `names`），Nanfeng 经过（`:955`）。
  最后这条正是上一条 P1 能长期存在的原因：**Local 路径从来没有"槽位"概念**，所以没人发现 Nanfeng 里
  "保位"是假的。
  修复建议：抽出 `prepareMedia(job, shot, cfg)` 返回 `{refList, videoEntries, audioEntries, toStage}`，
  两条路径共用；accel 解析统一收敛到 `resolveAccelForFiles`（它对 `loraFiles=null` 有回退，是超集）。
- **[P2] `generator.js:114-115` `warnMissingMedia` 内部调用 `resolveMediaEntriesCore` **没传 cfg**。**
  `:114` `...resolveMediaEntriesCore(shot.refs?.videos)...` —— 而 `warnMissingMedia(job, shot)` 的签名
  （`:112`）根本没有 `cfg` 参数，所以内部走 `ref-images.js:222` 的默认 `loadConfig()`。
  当调用方传入自定义 cfg（`runH3Local({cfg})` 的 `:212` 参数是显式收下的）且其 `dataDir` 与全局配置不同时
  （测试注入 `DSH_JZ_DATA_DIR`、或多项目多 dataDir 场景），**告警判定的路径与真实提交的路径不是同一套**
  → 会出现"警告说缺失但实际提交成功"或反之。修复建议：`warnMissingMedia(job, shot, cfg)` 并透传。
- **[P2] `generator.js:272-274` `useRef` 判定与真正接线的 `names` 脱节。**
  `const useRef = refList.length > 0 || videoEntries.length > 0 || audioEntries.length > 0;`
  但实际接 `ref_images.*` 的是 `names`（`:377`）与 `videoStage/audioStage`（`:435-436` 又过滤一次 `fileName`）。
  若 `stageToComfyInput` 整体失败会抛错（`comfy-client.js:397-399`），所以当前不会真的出现
  `useRef=true` 但零素材的静默退化；但**判断条件与实际接线条件不是同一个集合**，
  一旦 staging 改成"部分失败不抛"，这里就会变成 `MiniMaxH3ReferenceToVideo` + 零参考的静默纯文生。
  修复建议：`const useRef = names.length + videoStage.length + audioStage.length > 0;`（在 `:435` 之后判定）。
- **[P2] `generator.js:278-279` 三态返回值被当成对象用。**
  `const modelFiles = await comfy.listModelFiles(cfg).catch(() => ({ ok: false }));`
  → `const available = modelFiles ?? {}`（`modelFiles` 永远非 null，`??` 恒不生效）；
  而 `comfy-client.js:259-263` 特意设计了 `ok` 三态，**这里完全没有使用 `ok`**，
  直接把可能全 `[]` 的字段传给 `resolveModelNames`。当 ComfyUI 不可达时
  `available.diffusion_models` 是 `[]` → `pickModelName`（`:64`）`if (!Array.isArray(available)||!available.length) return want;`
  → 退回默认名 → 提交一个可能不存在的文件名。注释 `:259-262` 承认这两态必须区分，但消费端没区分。
  修复建议：`if (modelFiles?.ok) {...}`，`ok===false` 时把 `modelFiles.reason` 写进 `job.warnings`。
- **[P3] `generator.js:223` `refImageSizeDowngraded` 只写不删，重试会残留。**
  `if (refSizeDecision.downgraded) { job.params = {...job.params, refImageSizeDowngraded: reason}; }`
  —— 复用同一 job 对象重试（或用户把显存腾出来后再跑）时，旧降级原因不会被清掉，
  面板会显示"已降级"而实际这次是 max 档。
- **[P3] `generator.js:97-104` 七个 `const UNET_REF = MODEL_DEFAULTS.UNET_REF;` 纯别名层。**
  唯一消费者是 `:562` 的 `H3_MODEL_NAMES` 导出，而该导出**全仓零引用**（grep 确认）→ 八行可全删（§五 #1）。
- **[P3] `generator.js:1058-1074` `summariseParams` 的 `const schema = params; // 已是完整快照` 是无意义别名**，
  注释「只保留非默认值」与实现不符（实现是"白名单 + 非空素材"，并没有比对默认值）。

---

### host/services/comfy-client.js（550 行）
- **职责**：ComfyUI 探测/上传/提交/轮询/下载/取消、端口发现、模型清单、显存。
- **结论：有问题（P2×5、P3×2）**

**端口真源问题（交接重点）—— 证据链与定性**

**结论：这是一个**真实存在但后果轻微**的「配置真源分裂」，不是功能性故障。
端口实际走 `.comfy-port`，`comfyUrl=8188` 是**完全失效的僵尸配置**，但仍会被 UI/配置页当真展示。**

1. 事实基线（实测）：`F:\AI视频\ai-runtime\.comfy-port` 内容 `8488`；`data/config.json` 的
   `comfyUrl` 是 `"http://127.0.0.1:8188"`；`host/config.js:34` 的 `DEFAULTS.comfyUrl` 也是 8188。
2. 代码如何决定端口 —— **优先级链**（`comfy-client.js:142-168` `resolveComfyUrl`）：
   ```
   candidates = [ discoverComfyUrl(), configuredUrl(cfg), 8488/8688/8888/9088/9288/8388/8188 ]
   → 逐个 fetch `${u}/system_stats`（1.2s 超时），第一个 ok 的胜出
   ```
   - `discoverComfyUrl()`（`:101-119`）优先级：`DSH_COMFY_URL`/`COMFY_URL` 环境变量 > `.comfy-port`；
   - 端口文件如何被找到（`:81-98` `portFileCandidates`）：从 `import.meta.dirname`（`<plugin>/host/services`）
     向上最多 8 层，每层试 `<dir>/ai-runtime`。对本仓：`host/services` → `host` → `<plugin>` → **`F:\AI视频` ✔ 命中**
     （第 4 层），读到的就是 8488。
   - 所以 `:150 push(discoverComfyUrl())` 把 `http://127.0.0.1:8488` 排**第一位**且探测成功 → **实际全部请求走 8488**。
3. 谁还在用 8188：**只有 `configuredUrl(cfg)` 这一个消费者**，作为候选列表第 2 位 +
   `:165-167` "全部失败时返回 candidates[0]"的兜底（注意 candidates[0] 是端口文件，不是配置）。
   → 在正常机器上 `cfg.comfyUrl` **一次都不会被使用**。
4. 由此产生的真实缺陷（不是"选错端口"，而是"UI 撒谎 + 死代码"）：
   - **`comfy-client.js:121-126` `baseUrl(cfg)` 是死代码**：grep 全仓无调用者（只有定义处 1 处命中），
     而它恰恰是**唯一**实现「端口文件优先于配置」的**同步**函数（`return discovered || configured;`），
     与 `resolveComfyUrl` 的"逐个探活"是两套语义。留着它，下一个改端口逻辑的人很可能改错文件。
   - **配置页/`/config` 展示 8188，而实际连 8488**：`config.js:104` 把 `comfyUrl` 列入
     `WRITABLE_CONFIG_KEYS`，`sanitizeConfigPatch`（`:280-283`）只做 SSRF 校验后**原样写盘**。
     用户看到 `8188` → 手动改成 8488 → 存盘 → 但 `discoverComfyUrl` 仍排第一，
     **改配置对行为零影响**（除非删掉 `.comfy-port`）。这是"设置项无效但不报错"。
   - `:152-153` 的硬编码端口兜底列表**不含 8488 以外的任何真实动态端口**：脚本挑到 9488/8888 之外
     （比如 10000+）时，只能靠端口文件命中；端口文件若被清掉（`stopComfy` 不清，但用户重装/搬目录会丢），
     就再也找不到 → 表现为"ComfyUI 明明在跑，插件说不可达"。
  修复建议（三步，都很小）：
   1. 删 `baseUrl`（§五 #2）；
   2. `comfy-client.js:165-167` 失败兜底改为返回 `configuredUrl(cfg)` 优先或明确 `''`
      （现在返回 `candidates[0]`，注释 `:137` 说"让错误信息指向最可能的那个"，但 `:165` 的
      `mergeComfyUrl` 式兜底在候选为空时可能返回空串，语义含混）；
   3. `GET /config` 的响应里增加 `comfyUrlEffective`（= `resolveComfyUrl()` 的结果），
      并在 UI 上把 `comfyUrl` 标注为「仅当 ai-runtime/.comfy-port 不存在时生效」。
      或者更彻底：`comfyUrl` 从 `WRITABLE_CONFIG_KEYS` 移除，只留环境变量 `DSH_COMFY_URL`（部署者显式选择）。
- **[P2] `comfy-client.js:165-167` 探测失败也会被缓存 5 秒。**
  `PROBE_CACHE.url = candidates[0] || ''; PROBE_CACHE.at = Date.now();` ——
  失败结果与成功结果**共用同一个 TTL**（`:140` 5000ms）。
  真实时序：`startComfy()` 返回 ok 之后立刻有并发请求走到 `resolveComfyUrl`，若此刻 ComfyUI 刚 bind
  还很慢 → 失败被缓存 → 接下来 5 秒内 `health()`/`vramStatus()` 全部报"不可达"，
  用户看到"启动成功但状态不可达"。修复建议：失败不写缓存（或写 `at: Date.now() - TTL + 1000` 的短 TTL）。
- **[P2] `comfy-client.js:527-549` `cancelRemote` 的 `/interrupt` 带了 `{prompt_id}`，
  但 ComfyUI 的 `/interrupt` **不接受任务定向**——它总是中断当前正在执行的那一个。**
  证据：`body: JSON.stringify({ prompt_id: remoteId })`（`:545`）；而 `/queue` 的 `delete`（`:536`）只对
  **排队项**有效（正在跑的已不在队列里）。
  → 语义后果：取消任务 A 时，若 A 在排队而 ComfyUI 正在跑别人的 B，`:542` 的 interrupt 会把 **B 掐掉**。
  而 `:524` 的注释「真取消远端任务（修复原实现"取消只停本地轮询"）」给人的印象是能精确取消。
  这个行为在当前架构下**大概率无害**（闸门串行 + 单一使用者），但注释应写明"interrupt 是全局的"，
  否则未来加并发任务时会误杀。
  修复建议：`:540` 前先查 `/queue` 判断该 remoteId 是否仍 `pending`；只在 pending 时删队列、
  只在 running 且**确认是当前执行项**时才 interrupt（`/queue` 的 `queue_running[0]` 可读）。
- **[P2] `comfy-client.js:460-465` 轮询里 `catch { continue; }` 吞掉所有 `/history` 错误。**
  ```js
  let hist;
  try { hist = await getJson(`${url}/history/${encodeURIComponent(remoteId)}`); }
  catch { continue; }
  ```
  `getJson`（`:181-186`）会对非 2xx 抛 `COMFY_HTTP_<status>`、对坏 JSON 抛 `COMFY_BAD_JSON`。
  这些全部被吞 → 唯一的出口是 `:449-456` 的 2 小时超时。也就是说：
  **ComfyUI 中途被 404/500 打挂时，用户要等满 2 小时才拿到错误**，且错误是"超时"而非真实原因
  （`:451-455` 的文案会引导用户去"调大超时"，方向完全相反）。
  修复建议：只对网络类错误 `continue`，对 `COMFY_HTTP_4xx` 计数并在连续 N 次后抛出真实错误码。
- **[P2] `comfy-client.js:475-482` 只取第一个产物文件。**
  `for (const node of Object.values(entry.outputs||{})) for (const key of ['videos','gifs','images']) files.push(...)`
  然后 `const media = files.find(mp4|webm|mov|gif) || files[0];` ——
  如果有多个输出节点（南风二采 + 续写、或 SaveVideo + SaveImage 同时存在），
  **其余产物被静默丢弃**，`outputs` 数组恒为 1 条（`:497-507`）。`job-store.js:65-67` 的注释还写着
  "每次生成都会追加一条**完整**记录（…全部 outputs）"，与恒为 1 条的实现不符。
  修复建议：把 `files` 全部下载并 map 成 `outputs[]`，至少把"多产物被丢弃"写进 `job.warnings`。
- **[P3] `comfy-client.js:189-198` `health()` 与 `:213-242` `vramStatus()` 重复实现 `/system_stats` 请求+解析**，
  `:191` 与 `:217` 各自 `resolveComfyUrl`。可合并为一个 `systemStats(cfg)` 带缓存（§五 #11）。
- **[P3] `comfy-client.js:322-326` `safeStem` 的哈希设计正确**（保留 ASCII + 8 位 sha1，解决中文名塌缩），
  `:308-321` 的注释与实现完全一致 —— 这是正面确认项，不是问题。此处仅记录**已核对无误**。

---

### host/services/comfy-control.js（365 行）
- **职责**：ComfyUI 进程启停、端口/进程状态探测、pwsh 解析、启停互斥锁。
- **结论：有问题（P1×1、P2×2、P3×1）**

**正面确认**
- ✅ **停止顺序正确**：`comfy-control.js:217-233` 先 `/interrupt`（`:218-223`）→ 再 `/queue {clear:true}`（`:226-232`）
  → 再 `SIGTERM`（`:241`）→ 等端口释放（`:247-251`）→ 超时 `SIGKILL`（`:254-256`）。
  与 `:28-31` 的约束声明（"先 interrupt 再杀，只杀进程会留下半截 mp4/safetensors"）一致。
- ✅ **pwsh vs powershell 的编码问题处理到位**：`:62-93` 用 `where.exe` 解析真实路径（`:66-70` 注释解释了
  WindowsApps 重解析点 EACCES 的坑），找不到时明确报错而非退回 5.1（`:300-309` 的 ENOENT 文案解释了原因）。
- ✅ **detached 反直觉问题已记录**：`:284-290` 说明 Windows 上 `detached:true` 会让 powershell 立刻退出，
  改用 `unref()`。`stdout` 用 `stdio:'ignore'` + `child.on('exit')` 检测秒退（`:302-311`），正确。

**发现**
- **[P1] `comfy-control.js:211-215` `stopComfy` 以**过期的端口文件**为唯一判据，
  会在 ComfyUI 实际在别处运行时误报 `alreadyStopped`。**
  ```js
  const port = readPort();                       // ← 只认 .comfy-port
  if (!(await portListening(port))) {
    resetComfyProbe();
    return { ok: true, alreadyStopped: true, detail: '本来就没在运行' };
  }
  ```
  `readPort()`（`:129-139`）在以下情况返回 `0`：`findRuntimeDir()` 为空（目录被搬走）、
  `.comfy-port` 缺失、内容被清空/写坏。任一种情况下 `portListening(0)` 为 false（`:143`）→ 直接返回
  **`ok:true, alreadyStopped:true`**，尽管 `discoverComfyUrl()` 完全可能已找到一个在跑的实例
  （`comfy-client.js:101-119` 也认环境变量 `DSH_COMFY_URL`）。
  对比 `comfyStatus()`（`:160-183`）用的是 `alive = await portListening(port)` 但 `url` 是
  `alive ? 端口 : discoverComfyUrl()` —— **同一个文件里两种判定口径**。
  → 用户点"停止"，UI 回"本来就没在运行"，ComfyUI 继续占 10–14GB 显存；随后 `releaseComfy`
  （`comfy-lifecycle.js:73-86`）还会因为 `stopComfy().ok` 为 true 把 `ownedByBatch` 清掉，
  **彻底失去后续清理的机会**。
  修复建议：`port` 取 `readPort() || (await discoverComfyUrl())` 里解析出的端口；
  即先用 `resolveComfyUrl(cfg)` 拿到实际可达地址，再 `pidOnPort(该端口)`。判据从"端口文件"改成"可达地址"，
  与 `comfyStatus` 统一。
- **[P2] `comfy-control.js:319-321` / `:329-331` 启动成功后**没有**清 `spawnError`/`exitedCode` 的状态，
  且失败路径（`:333-344`）不 `resetComfyProbe()`。**
  后果：上一次启动失败留下的 `PROBE_CACHE`（`comfy-client.js:139`）指向旧端口，5 秒内新启动成功的实例
  不会被发现；`:325` 的 `if (exitedCode !== null)` 一旦成立就再也不会重新判断（脚本"已在运行"时退 code 0
  属正常，但此处会额外等 3 秒再报失败）。修复建议：失败分支统一 `resetComfyProbe()`。
- **[P2] `comfy-control.js:248-251` 停止等待用 `while` + `await setTimeout(800)`，无取消/无进度回调。**
  30 秒上限（`:44`）内 UI 无任何反馈；且 `:255` 强杀前没有二次确认。
  属健壮性问题，建议把 `:247-256` 的等待改成有 `onProgress` 回调的形式。
- **[P3] `comfy-control.js:364-365` 文件末尾 `void loadConfig;` 是**纯为消除未使用 import 的补丁式代码**。**
  `:40` `import { loadConfig } from '../config.js';` 全文无使用（`:365` 的注释也承认"此处不直接使用"）。
  应直接删掉 import + void 两行（§五 #4）。

---

### host/services/comfy-lifecycle.js（91 行）
- **职责**：批次级 ComfyUI 拉起/释放，只关"自己拉起的"。
- **结论：有问题（P1×1、P3×1）—— 交接重点「布尔 vs 集合」已被证实是真实缺陷**

- **[P1] `comfy-lifecycle.js:35` `ownedByBatch` 是**单个布尔**，没有引用计数，
  两个批次并发时会**互相取消对方的持有状态**，导致「关掉别人正在用的 ComfyUI」或「永远关不掉」。**
  证据（三种可复现交错，全部由现有代码推出）：
  1. `let ownedByBatch = false;`（`:35`）是模块级**标量**，无 `Set`/无计数、无 `batchId` 维度。
  2. 批次 A：`ensureComfyRunning` → 未运行 → `startComfy()` → `ownedByBatch = true`（`:60`）。
  3. 批次 B 并发进入：ComfyUI 已在跑 → 命中 `:48-53` 的早退 →
     **`ownedByBatch = false;`（`:50`）** ← 把 A 的持有标记清掉了。
  4. A 结束：`releaseComfy` → `:74 if (!ownedByBatch) return {skipped:true}` →
     **ComfyUI 永不关闭**，显存泄漏到用户手动关或重启。
  反向交错同理更危险：A 拉起(true) → A 结束关停（`:79` `stopComfy()`）→ 此时 B 正在跑 →
  **把 B 正在用的 ComfyUI 杀掉**，B 的生成中途失败（`comfy-client.js:460-465` 还会把它吞成 2 小时超时，
  见上文 P2）。
  实际触发面：`ensureComfyRunning` 的真实调用者是换人批次（`replace-runner.js`）与后续可能加的批量生成；
  `maxConcurrentLocal=1` 只串行**任务**，不串行**批次的 ensure/release 阶段**（这两个调用在 `runJob` 之外）。
  而 `comfy-lifecycle.js:28-29` 的注释自称「用**引用计数式**判断」——**实现是布尔，注释说的是计数，直接不符**。
  修复建议（最小改动，语义正确）：
  ```js
  const owners = new Set();            // 每个批次一个 ownerId
  let startedByUs = false;
  export async function ensureComfyRunning(cfg, log, ownerId = 'default') {
    const st = await C.comfyStatus();
    if (st?.running) { /* 已在跑：不登记持有 */ return {...} }
    const r = await C.startComfy();
    startedByUs = true; owners.add(ownerId);
    ...
  }
  export async function releaseComfy(log, ownerId = 'default') {
    owners.delete(ownerId);
    if (!startedByUs || owners.size) return { skipped: true, ... };
    startedByUs = false; ... await C.stopComfy();
  }
  ```
  即"是否我们拉起的"是全局事实（`startedByUs`），"谁在持有"是集合（`owners`），
  两者分离才能修好——这正是交接说明里"布尔 vs 集合"的要害。
- **[P3] `comfy-lifecycle.js:48` `st?.running || st?.ok` 里的 `st?.ok` 是**不存在的字段**。**
  `comfyStatus()` 的返回结构（`comfy-control.js:175-182`）只有
  `{running, port, url, runtimeDir, canControl, detail}`，**没有 `ok`**（那是 `health()` 的字段）。
  冗余条件，删掉即可（§五 #7）。

---

### host/services/replace-runner.js（820 行，定向抽查）
- **职责**：换人批次编排：切段 → 逐段提交 H3 → 收集 → 拼接 → 落状态机。
- **结论：有问题（P1×1）——以下结论基于 175–214 行的断点续跑段，以及 64–66/108–124/383–600 的
  grep 级结构核对；其余段（含 latent 续接细节）未逐行覆盖。**

- **[P1] `replace-runner.js:189-201` 断点续跑的复用判据**只比对段起点秒数**，
  不校验源视频身份/时长/模式 → 换源重跑会**新旧素材混剪**且完全静默。**
  ```js
  const prevByStart = new Map(
    plan.mode === 'continuation' ? []
    : (Array.isArray(current.segments) ? current.segments : [])
        .filter((s) => s && s.status === 'completed' && s.outputRel)
        .map((s) => [Number(s.startSec).toFixed(3), s]),   // ← key 只有 startSec
  );
  let segments = plan.segments.map((s) => {
    const hit = prevByStart.get(Number(s.startSec).toFixed(3));
    return hit ? { ...s, status: 'completed', outputRel: hit.outputRel, ... } : {...pending};
  });
  ```
  段起点由 `planSourceSegments` 按固定 `segmentSec` 计算（`replace.js:139` 有默认每段时长常量），
  所以**只要用户重新上传一个不同的源视频、或改了段长但起点恰好落在同一小数位**，
  `Number(s.startSec).toFixed(3)` 就会命中旧记录 → 那些段被标成 `completed` + `fromCache:true`，
  带着**上一个视频的产物路径**进入 `:383-600` 的逐段循环（`:384-386` 见 completed 直接 continue），
  最后 `:612` `joining` 把新旧片段一起 `concatSegments`。
  → 成片里前半段是旧视频的人、后半段是新视频的人，**没有任何 warning**（`:596-600` 只对本次真跑的段发进度）。
  `:29-30` 的注释把"已完成的段不会重跑"当作纯优点，没有提这条前提。
  修复建议：key 加上源身份与段长：
  `[`${current.sourceRel}|${s.startSec.toFixed(3)}|${s.durationSec.toFixed(3)}`]`，
  且在 `plan.sourceRel !== current.sourceRel` 时整体丢弃 `prevByStart` 并 `warnings.push('源视频已更换，历史分段不可复用，将从第 1 段重跑')`。
- **[P2] `replace-runner.js:160-166` 的 emit 时序依赖注释而非断言。**
  注释说 `emit({segments})` 会把 `current` 换成新计划（全 pending），所以阶段 2.5 必须
  「读快照」而不是读 `current.segments`；`:263` 用 `prevSnapshot.segments` 规避了。
  这是正确的规避，但**没有任何断言保护**——下次有人直接写 `current.segments` 就静默回归。
  建议在 `emit` 里加 dev 断言或在 2.5 处加注释锚点（`// 注意：不要读 current.segments`）。

---

### host/services/replace.js（623 行，定向抽查）
- **职责**：换人纯函数与素材工具（切段/拼接/提示词/存储）。
- **结论：未发现缺陷（仅核对了导出面与默认常量，见 §四 存疑 5）**
- 已核对：`:139` 默认段长、`:141` 单条参考视频硬上限、`:143` 分段数上限（注释均说明了"为什么"）；
  导出 `planSourceSegments`(:373)/`cutSegments`(:552)/`concatSegments`(:625)/`resolveReplaceInput`(:658)/
  `replaceStore`(:287) 与 `replace-runner.js:41-48` 的 import 一一对应，**无悬空导入**。

---

### host/services/blender-service.js（867 行，定向抽查 590–644）
- **职责**：Blender 子进程编排、帧序列校验、ffmpeg 合成。
- **结论：产物判定逻辑 OK（正面确认）；P2×1**

**正面确认（交接重点「帧数校验 / `_running` 哨兵」——实现正确且理由完整）**
- ✅ **三条判定缺一不可**：`blender-service.js:612-616`
  ```js
  const wantFrames = Number(spec?.frames) || 0;
  const sentinelLeft = fs.existsSync(sentinelPath);      // :613-614
  if (!pngs.length || sentinelLeft || (wantFrames > 0 && pngs.length !== wantFrames)) { ... throw }
  ```
  `:600-611` 的注释把历史缺陷讲清楚（只判 `pngs.length>0` → 崩在中途也会被判成功 →
  残缺运动被当完整参考 → "用户看到成功 124 帧"）。
- ✅ **stdout/stderr 分别匹配再合并**：`:618-621` `const log = \`${r.stdout||''}\n${r.stderr||''}\``，
  注释 `:618-620` 指出旧写法 `String(r.stderr||r.stdout||'')` 会被非空 stderr 短路、
  而 `BLENDER_RENDER_DONE` 在 stdout。这个修正是对的。
- ✅ **清理时机在产物判定之后**：`:636` 只在失败分支 cleanup，成功分支在 `:590-595` 说明的位置；
  `:592-595` 解释了"放前面会把正在收尾的并发渲染当最旧删掉"。

**发现**
- **[P2] `blender-service.js:616` 当 `spec.frames` 缺失/为 0 时，完整性校验退化成"有帧就算成功"。**
  `wantFrames > 0 && pngs.length !== wantFrames` —— `wantFrames===0` 时这一项**恒 false**，
  只剩"有帧"和"哨兵不在"两条。而 `_running` 哨兵是 `render_shot.py` 正常收尾才删的，
  如果脚本改版/异常路径没写/没删哨兵（例如 `os._exit` 跳过 finally），两条都会失效。
  `:612` 的 `Number(spec?.frames) || 0` 把"没给"和"给了 0"混成同一个值。
  修复建议：`if (!Number.isFinite(Number(spec?.frames)) || Number(spec.frames) <= 0) throw new BlenderError('SPEC_FRAMES_MISSING', ...)`
  —— 帧数是硬性契约，缺失应当直接拒绝而不是放宽校验。

---

### host/services/edit.js（756 行，定向抽查 230–359）
- **职责**：剪辑：有序片段列表、trim/concat/render、xfade 转场、音轨 strip/volume/bgm。
- **结论：concat/xfade 逻辑 OK（正面确认）；P2×1、P3×1**

**正面确认（交接重点「流复制 vs 重编码判定 / xfade offset」——实现正确）**
- ✅ **三优先级判定正确**：`edit.js:244-253`
  ```js
  const useTransition = Number(transitionSec) > 0;
  const doReencode = useTransition ? true
    : (reencode === false ? false : (reencode === true ? true : !sameShape(infos)));
  ```
  与 `:245-249` 的注释表（①要转场必须重编码 ②调用方显式 ③默认形状一致才 copy）逐条对应。
  `:242` 的理由"copy 路径根本表达不了 xfade"成立。
- ✅ **xfade offset 累计正确**：`:336-344`
  ```js
  let running = durs[0];
  for (i=1..n) { offset = running - T; ...; running = running + durs[i] - T; }
  ```
  这正是 xfade 的正确公式（第 i 个 offset = 前 i 段累计 − 已消耗重叠），
  与 `:313-315` 的注释一致。`:322` 还加了"转场不能超过最短片段"的前置校验，避免 ffmpeg 直接失败。
- ✅ **音频用 acrossfade 与视频转场对齐**：`:346-352` 同样串行累计，总时长语义与视频一致（Σd − (n−1)T）。
- ✅ **缺音轨的片段补静音而非跳过**：`:293-296` / `:330-332` `anullsrc + atrim=duration=...`，
  注释 `:294` 指出否则 `concat=n=` 计数对不上 —— 这是正确做法。

**发现**
- **[P2] `edit.js:251-253` `reencode === false`（调用方显式要求流复制）时**无条件**走 copy，
  即使各段形状/编码参数不同。**
  `-f concat -c copy` 要求片段 codec/profile/pix_fmt/sar/timebase 全一致，否则产出文件
  "能生成但时间戳/时长错乱"，这是 concat demuxer 的经典坑。`:258-271` 的 copy 分支没有任何一致性检查，
  `:261` 只做了路径转义。当前 `reencode===false` 只由显式调用方触发，风险可控，但应在
  `:258` 前加 `if (reencode === false && !sameShape(infos)) throw new Error('COPY_SHAPE_MISMATCH: ...')`
  或至少 `warnings` 提示。属"静默产出坏文件"类。
- **[P3] `edit.js:231-234` 单片段 concat 退化为 `trim(reencode: true)`，**强制重编码**。
  用户传 1 个片段做 concat，期望是"合并不该损失质量"，却得到一次无谓的 x264 转码。
  建议 `trim({..., reencode: false})`（`trim` 应支持 copy），或直接用调用方给的 `reencode`。

---

### host/services/post.js（297 行，仅核对 resolveUserPath 一行）
- **结论：路径约束**从调用点看成立**，实现未逐行验证（见 §四 存疑 4）。**
- `post.js:304-308` 注释「现在统一走 resolveUserPath，绝对路径也必须在 dataDir 内」，
  实现 `:308` `return resolveUserPath({ root: C().dataDir, input, mustExist: true });` ——
  调用点确实只走这一个函数，没有 `safeJoin` 之外的旁路。

---

### 其余 15 个服务文件
`h3-workshop` `h3-image` `character-vault` `breakdown` `shot-context` `shot-splitter` `media-probe`
`accel-plan` `lora-catalog` `canvas-agent` `workflow-paths` `ffmpeg-tools` `prompt-llm` `asset-service`
`h3-graph` —— **本报告不下结论**（覆盖率声明已列）。其中 `h3-graph.js` 与 `shot-context.js`
做了两项**具体的反向验证**（结论是"无缺陷"，见下）：

- ✅ **`h3-graph.js` 与 `bridge/vendors/nanfeng/graph.js` **不是**重复实现**（交接怀疑项，核实为否）。
  证据：`h3-graph.js:2` 自述是「H3 ComfyUI 节点图装配器」，服务于 `runH3Local` 的
  `data/workflows/h3.json` **模板占位符**路径（`generator.js:386` `new NodeGraph(workflow)`、
  `:409-424` 直接改 `refNode.inputs` 并 `graph.alloc` 分配 ID、`:543-551` pruneUnreachable + validateLinks）；
  而 `bridge/vendors/nanfeng/graph.js`(21,130B) 是南风节点内部的 **GraphBuilder**（参数 → 节点图展开），
  服务于 `runH3Nanfeng`（`generator.js:997` `nanfeng.buildShotWorkflow(...)`）。
  两者输入不同（模板 JSON vs 镜头卡 217 参数）、输出不同（同名节点图 vs 南风完整工作流）、
  消费方不同（Local vs Nanfeng）。全仓 `find -name graph.js` 只有 vendor 一份。
  → **不要删任何一个**（§五 #9 澄清）。
- ✅ **`shot-context.js:204` 没有第二份编号实现**：它调用 `resolveRefImages` 后
  **主动剥离** `characterRefs/sceneRefs/itemRefs`
  （`resolveRefImages({...shot, characterRefs: [], sceneRefs: [], itemRefs: []}, cfg)`）
  —— 目的是拿"纯手工图"的子集，属合理用法，**不是**重新实现排序规则。

---

## 三、跨文件/结构性问题

### 3.1 「参考素材编号」的单一真源在生产端成立，在**组合端**被写散（本轮最大结构问题）
`ref-images.js` 自己是干净的（§二 已验证稀疏槽位、reserved 避让、missing 占位）。问题在消费者：

| 环节 | 文件:行 | 约定 | 与其它环节一致？ |
|---|---|---|---|
| 解析顺序 | `ref-images.js:164-212` | 卡仓库→人设卡→手工→场景道具，**上限 9** | 基准 |
| 槽位规划 | `ref-images.js:283-337` | 定长 9 稀疏、首尾帧 `reserved` | 基准 |
| **视频/音频编号** | `generator.js:254-261`、`:876-883` | `filter(abs)` 后 **`index=i+1` 重排** | ❌ **与 ref-images 的 missing 占位原则相反** |
| 预览重编号 | `render-plan.js:352-356` | 超时长裁剪后 **主动重排** `<Video k>`/`<Audio j>` | ❌ 第三种约定 |
| 提交保位 | `generator.js:903`、`:969-979` | 声称保位 | ⚠️ 对**已压缩**数组保位 = 无效 |
| 编译预览 | `prompt-compile.js:226-240` | 传绝对路径给 planImageSlots | ✅ 内部自洽，但输入类型与 generator 不同 |
| 图片提交 | `generator.js:377`、`:955` | Local 用 `names`、Nanfeng 用 `slotPlan.images` | ⚠️ 两条后端语义不同 |

**统一建议**：在 `ref-images.js` 增加一个 `renumberMedia(entries)` 明确导出，
成为**唯一**的"视频/音频编号"入口（返回"保位后的 `视频1..3` 映射"），
让 `generator.js` / `render-plan.js` 都从它取；同时删掉 `generator.js` 的两处 `.filter(v=>v.abs)`。
这样"图片"与"视频/音频"两条链的编号语义就统一在同一个模块里。

### 3.2 「双份执行链」是 P1 的温床
`runH3Local`（`generator.js:212-560`，349 行）与 `runH3Nanfeng`（`:624-1050`，427 行）共享约 250 行
逻辑但各自演化。**本次确认的实际分歧**已在 P2 那条列出三条（accel 解析函数不同、params 快照字段不同、
是否过 planImageSlots 不同）。其中第三条直接导致 P1（视频编号压缩）没被发现 ——
因为 Local 路径根本没有槽位概念，改 Nanfeng 的人无从对照。

### 3.3 存储层的不变量是对的，但**恢复路径**缺失
`json-store.js` 精心维护 `.bak`（`:96-103`）与 `.corrupt`（`:127-131`），
但**全仓没有任何代码读取这两个文件**（grep `.bak` / `.corrupt` 作为**读**目标 —— 零命中）。
也就是说：事故现场被完整保留下来了，但**只有人工介入才能恢复**。
而 `overwriteFallback`（`:145-153`）的存在意味着"截断的 JSON"是一个**可达状态**，
此时 `readSync` 会持续抛 `CORRUPT_JSON`，`projects.list()`（`models.js:295`）等**不带 catch** 的调用方
会让整个读取链路持续报错，直到用户手动删文件。
**建议**：`readSync` 解析失败且存在 `${file}.bak` 时，自动尝试解析 `.bak`，
成功则返回该值并打一条显式 warning（"主文件损坏，已回退上一版备份"）；失败才抛。
这一改把"人工恢复"变成"自动降级 + 可见告警"，且不破坏"绝不静默清空"的初衷。

---

## 四、存疑（需运行时或读未覆盖文件才能确认）

1. **`json-store.overwriteFallback` 的触发频率**：需要知道这台机器上 `renameSync` 撞 EPERM
   （杀软/索引器）的真实概率。若几乎不触发，则该 P2 可降为 P3；若经常触发，则 §3.3 的恢复路径必须补。
   验证方式：临时在 `:184` 打点计数（**只读审计不做**）。
2. **`comfy-client.listModelFiles` 的三态在 UI 上是否可见**：`generator.js:278` 丢弃了 `ok`，
   但 `h3-image.js` 等是否另行使用了 `ok`，未读。
3. **`render-plan.js` 的 `MAX_REFS_TOTAL_SEC` 裁剪**（`:332-357`）与提交端**不一致**：
   预览会按总时长砍掉参考视频/音频，而 `generator.js:876-883` **完全没有这个裁剪**。
   若预览说"已移除视频 2"，提交端仍会提交 3 个 → 预览与提交再次分裂。
   需要读 `render-plan.js` 全文 + 确认 `MAX_REFS_TOTAL_SEC` 是否只是 UI 提示。
4. **`security.js:157-210` `resolveUserPath` 的实现细节**：只读了签名与调用点。
   `:174`/`:193` 两处递归（解 `?path=` / 同源 URL）**是否**对结果再做一次 root 校验，
   需要逐行读才能断言"绝对路径必须在 dataDir 内"真成立（交接重点 8）。当前只能说
   **调用点确实都走它，没有旁路**。
5. **`replace.js:552 cutSegments` / `:625 concatSegments`** 的 ffmpeg 参数（是否重编码、
   是否对齐 keyframe）未读，无法判断"无损拼接"的声明是否成立。
6. **`h3-workshop.js:373` / `:384`** 的 `resolveUserPath` 调用是否覆盖了所有入口，
   未逐行核对（该文件 436 行，不在本轮通读范围）。

---

## 五、清理清单（可删 / 可合并 / 可改名）

> 命名约定：**[删]** 零消费者，可直接移除；**[合]** 重复实现，合并到单一真源；
> **[改]** 保留但需改语义/注释；**[勿删]** 曾被怀疑重复、核实为不同职责。

| # | 位置（文件:行） | 动作 | 理由（证据） |
|---|---|---|---|
| 1 | `host/services/generator.js:97-104` + `:562` | **[删]** | 7 个 `const UNET_REF = MODEL_DEFAULTS.UNET_REF;` 纯别名，唯一消费者 `:562` 的 `H3_MODEL_NAMES` 导出**全仓零引用**（grep 只命中定义）。删后 `MODEL_DEFAULTS` 内部引用改短名即可。约 9 行 |
| 2 | `host/services/comfy-client.js:121-126` | **[删]** | `baseUrl(cfg)` 全仓**零调用者**（grep 只命中定义 `:121`）。它是唯一实现"端口文件优先于配置"的**同步**版本，与 `resolveComfyUrl`(:142-168) 是两套语义，留着必被误改。删 |
| 3 | `host/services/ref-images.js:373-403` | **[删] 或 [改]** | `buildSubmissionRefs` **零调用者**（grep 全仓只命中 `:373` 定义），而其文档 `:359-365` 自称"上层唯一需要调的入口"——与事实相反。二选一：删掉并把文档改为"三函数按序调用"；或（推荐）让 `generator.js`/`prompt-compile.js`/`render-plan.js` 真正改调它（`stage` 参数已实现且正确，`:388-392`）。 |
| 4 | `host/services/comfy-control.js:40` + `:364-365` | **[删]** | `import { loadConfig }` 全文未使用，`:365` 的 `void loadConfig;` 是纯补丁式消警告。两处一起删 |
| 5 | `host/store/models.js:216-236` | **[删]（待确认）** | `H3_MODEL_SLOTS` 19 档槽位表在本轮 30 个文件 + grep 范围内**无消费者**（交接清单 #9"死代码"候选）。删前请 grep `app-src/` 与 `api/`，若前端也不用则删。与 `generator.js:39-51` 的 7 个文件名**无映射关系**，是两套并存的模型描述 |
| 6 | `host/services/job-runner.js:81` + `host/services/job-store.js:80` | **[合]** | 终态集合有两份：`job-runner:81` 的 `['completed','failed','cancelled']`（**漏 `interrupted`**）与 `job-store:80` 的 `TERMINAL`。合并为从 `job-store` 导出 `TERMINAL` 并统一使用 → 顺手修掉 P2 |
| 7 | `host/services/comfy-lifecycle.js:48` | **[删]** | `st?.running \|\| st?.ok` —— `comfyStatus()`（`comfy-control.js:175-182`）**没有 `ok` 字段**，条件恒冗余 |
| 8 | `host/services/generator.js:212-375` vs `:624-917` | **[合]** | 约 250 行双份执行链。已实际分歧三条（accel 解析函数 / params 快照字段 / 是否过 planImageSlots）。抽 `prepareMedia(job,shot,cfg)` + 统一 accel 解析 |
| 9 | `host/services/h3-graph.js` vs `host/bridge/vendors/nanfeng/graph.js` | **[勿删]（澄清）** | 交接怀疑"重复"，**核实为否**：前者服务 `runH3Local` 的模板占位符工作流（`generator.js:386` 用 `NodeGraph`、`:543` pruneUnreachable），后者是南风 GraphBuilder（`generator.js:997` `buildShotWorkflow`）。输入/输出/消费方全不同。**两个都留** |
| 10 | `host/store/json-store.js:96-103`、`:127-131` | **[改]** | `.bak`/`.corrupt` 只写不读（全仓零读取者）→ 事故现场保留了但**没有恢复路径**。建议 `readSync` 在解析失败时自动回退 `.bak` 并 warning（详见 §3.3）。不是删除项，是补完项 |
| 11 | `host/services/comfy-client.js:189-198` vs `:213-242` | **[合]** | `health()` 与 `vramStatus()` 各自实现一次 `/system_stats` 请求+解析+超时。合并为带缓存的 `systemStats(cfg)`，`vramStatus` 从它取 `devices[0]` |
| 12 | `host/store/models.js:273-286`、`host/services/job-store.js:30-41`、`host/store/json-store.js:287` | **[合]** | 三处各自实现"惰性单例 + 路径变更重建"。`models.js` 的 `lazily()` 最完整（含 `reset`），其余两处是手写同构版本。抽成共享工具 |
| 13 | `host/services/extras.js:150` | **[改]** | `const writeJson = (f,v) => { writeJsonCore(f,v); return v; }` 走的是**同步裸写、绕过队列**，而 5 个调用点是"先 readJson 再 writeJson"的读-改-写（`:160-171`、`:175-176`、`:245-250`、`:451-456`）。改成 `await updateJson(file, [], mutator)`。`:149` 的注释「原子写也统一走 json-store（它已经有 .bak + 正确的重试策略）」只说了"原子"，**没拿到"串行"**，属注释误导 |
| 14 | `host/services/ref-images.js:63` vs `host/store/models.js:104` | **[合]** | `IMAGE_MODES`（`['ref2va','i2va','fl2va','t2va','l2va']`）与 `H3_MODES` 内容相同、两处维护。与 #15 一起做 |
| 15 | `host/services/ref-images.js:345-354` vs `host/store/models.js:94-120` | **[合]** | 两份模式别名表，**已真实漂移**：`models:114` 会剥 `h3:` 前缀、`ref-images:346` 不会；`models:99` 有 `ref` 别名、`ref-images:352` 没有。抽 `mode-aliases.js`（无 fs 依赖，满足 ref-images 的"不反向依赖 store"约束）+ smoke 断言两函数输出全等 |
| 16 | `host/services/mock-backend.js`（41 行） | **[勿删]** | **仍在生产路径**：`host/tools.js:15`+`:440-442` 与 `host/api/index.js:15`+`:2394-2408` 都有 `backendId==='mock'` 分支。不是死代码。但 `job-store.js:22` 把它算进 `LOCAL_BACKENDS` 会让测试任务抢 GPU 槽位（§二 job-store P3），应拆 `GPU_BACKENDS` |
| 17 | `host/services/generator.js:1058-1074` | **[改]** | `summariseParams` 的 `const schema = params; // 已是完整快照` 是无意义别名；注释「只保留非默认值」与实现不符（实现是白名单 + 非空素材，**没比对默认值**） |
| 18 | `host/services/job-runner.js:9` + `:219-222` | **[改]** | 为拿 `pruneJobs` 用动态 `import('./job-store.js')`，而同文件 `:9` 已静态 import 同模块的 3 个符号 → 动态 import 是重构残留。改为静态 |
| 19 | `host/services/generator.js:278-279` | **[改]** | `const available = modelFiles ?? {}` 恒不生效（`listModelFiles` 永不返回 null），且丢掉了 `:259-263` 特意设计的 `ok` 三态。改为 `if (modelFiles?.ok) {...} else warnings.push(reason)` |
| 20 | `host/services/generator.js:114-120` | **[改]** | `warnMissingMedia` 内部没传 `cfg`，默认 `loadConfig()` 与调用方 cfg 可能不同 → 告警与实际提交口径不一。加 `cfg` 参数透传 |

---

## 六、文档与实现不符

| 位置 | 文档/注释说什么 | 实现实际做什么 | 影响 |
|---|---|---|---|
| `comfy-lifecycle.js:28-29` | 「用**引用计数式**判断：批次开始时记录…结束时只在…才关」（并称"引用计数"） | `:35 let ownedByBatch = false` —— **标量布尔，无计数、无集合** | P1 的文本根源。读者会以为并发安全 |
| `ref-images.js:217-219` | 「解析不到的条目也保留占位……filter 掉之后 `<Video 2>` 会变成 `<Video 1>`」 | `generator.js:876-883` 与 `:254-261` **正好做了它禁止的 `.filter(v=>v.abs)` + `index=i+1`** | P1：视频/音频编号移位，提示词与素材错位 |
| `generator.js:969-979` | 「视频/音频必须保位，不能 `.filter(Boolean)` 压缩」 | 保位发生在 `:903` `stagedSlot`，但**输入数组 `:876-883` 已被压缩并重编号** → 保位无效 | 同上，注释给出**虚假的安全感** |
| `ref-images.js:359-365` | 「这是**上层唯一需要调的入口**」 | `buildSubmissionRefs`（`:373`）**零调用者**；三条路径各自手拼三步 | 唯一真源在调用约定层失效 |
| `extras.js:149` | 「原子写也统一走 json-store（它已经有 .bak + 正确的重试策略）」 | 用到的是 `writeJson`（`json-store.js:271`）—— **同步裸写、不入队**；`.bak` 和重试有，**串行没有** | P2：并发读-改-写丢字段 |
| `job-store.js:122-124` | 「replaceAll → replaceJson → updateJson，走的是**同一个 per-file 串行队列**，不会绕过队列」 | ✅ 属实（`json-store.js:337-339` → `:242-253`） | 正面：这条声明是对的 |
| `job-store.js:113-120` | 「不用逐条 remove(id)」（旧方案 100 次 608KB 读改写） | ✅ 属实（`:133` 一次 `replaceAll`） | 正面 |
| `generator.js:259-262` | 「`ok` 区分"探测成功但没有"与"压根没探到"…调用方无法判断…只能猜」 | `generator.js:278-279` **调用方正是丢弃了 `ok`、直接猜** | P2：三态设计在消费端未落地 |
| `comfy-client.js:524` | 「真取消远端任务（修复原实现"取消只停本地轮询"）」 | `/interrupt` 带 `{prompt_id}`（`:545`）但 ComfyUI **不支持任务定向**；`:536` 的 `delete` 只作用于排队项 | 注释暗示"精确取消"，实际"全局中断"。见 §二 P2 |
| `job-store.js:65-67` | 每条任务记录含「全部 outputs」 | `comfy-client.js:481` 只取**第一个** media → `outputs` 恒为 1 条（`:497-507`） | 多产物（二采/续写）静默丢弃 |
| `generator.js:272-274` 与 `:1053-1074` | 多处「只保留非默认值」「避免把 217 字段全塞进 job.params」 | `summariseParams` 是白名单 + 非空素材，**不比对默认值**；`:1059` 的 `schema` 只是 `params` 别名 | P3 注释与实现不符 |
| `comfy-function 端口注释` `comfy-client.js:68` | 「优先级：显式环境变量 > 端口文件 > 配置里的 comfyUrl」 | `resolveComfyUrl`（`:142-168`）实际是"候选列表逐个探活"，配置只排第 2 且**探活失败才继续**；`:165` 兜底返回 `candidates[0]`（端口文件）而非配置 | 注释描述的优先级只在"端口文件对应的服务确实在跑"时成立；配置里的 comfyUrl 在本机**实际上永不生效**（8188 vs 8488 僵尸配置） |
| `comfy-control.js:364` | 「loadConfig 在签名里保留，方便上层统一注入；此处不直接使用」 | 签名里**没有** loadConfig（`:210`/`:271`/`:348` 都无此参数） | 纯借口式注释，`void loadConfig;` 应删 |

---

## 附：本轮**正面确认**的 6 项（交接清单点名的历史事故均已修复且未回退）

1. **`json-store.js` P0（删除目标再 rename）** —— 已根除，`:167-186` 重试全程不碰目标文件。
2. **`planImageSlots` 定长 9、不压缩、首尾帧占槽避让** —— `ref-images.js:321-336` 稀疏数组 + `reserved` 循环，四类模式规则正确。
3. **`ref_video_undefined`（`.filter(Boolean)` 导致编号塌缩）** —— `generator.js:257/:261/:879/:883` 显式 `index: i+1`，已修。
4. **`pruneJobs` 逐条删的 IO 放大** —— `job-store.js:131-133` 已改"一次 replaceAll 覆盖写"，且确实走在同一串行队列上。
5. **Blender `_running` 哨兵 + 帧数严格相等 + stdout/stderr 分别匹配** —— `blender-service.js:612-638` 三条判定齐全，理由完整。
6. **`comfy-control.stopComfy` 先 `/interrupt` → 再清队列 → 再 SIGTERM/SIGKILL** —— `:217-256` 顺序正确，与注释一致。