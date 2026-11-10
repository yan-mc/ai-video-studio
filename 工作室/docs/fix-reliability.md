# 任务可靠性 / 数据持久化 / HTTP 语义 修复报告（6 个 BUG）

> 目标文件：`F:\AI视频\工作室\dsh-ai-video-studio\index.js`（唯一改动的源码文件）
> 最终状态：**1334 行 / 76,423 字节 / SHA256 `19FF40EF57AED22C4AF087ABD5D66EF2C74654CE5611E1C00A005D6CA38EBA55`**
> `node --check index.js` → **exit 0**
> 验证结果：**单元/集成 27 项 + 端到端 4 项 + 崩溃恢复 6 项 + 真实数据 HTTP 8 项，全部通过（0 失败）**

> 行号说明：以下行号对应当前最终文件。文件在改动期间曾被另一任务并发编辑预演区段，若后续再变动，以函数名/注释中的 `BUG-x` 标记为准。

## 0. 一句话总结

| BUG | 症状 | 修复要点 | 状态 |
|---|---|---|---|
| BUG-5 | `cancel` 只改 JSON，执行中任务继续跑并被轮询覆盖回 `completed` | 进程内 `cancelledJobs` Set + 适配器轮询循环检查点 + 可中断睡眠 | ✅ 已修 |
| BUG-6 | `maxConcurrentLocal` 定义后无人读取，本地后端无限并发 | `acquireSlot/releaseSlot` 队列闸门，只限 `mock`/`h3-local` | ✅ 已修 |
| BUG-7 | 崩溃后 `running`/`queued` 任务永挂 | 模块加载时 `recoverInterruptedJobs()` 标记 `interrupted`，不重跑 | ✅ 已修 |
| BUG-8 | `POST /config` 回传明文 `seedanceApiKey` | 抽出 `maskConfig()`，GET/POST/工具三处统一掩码 | ✅ 已修 |
| BUG-9 | `/file` 不支持 HEAD / Range，视频拖动退化 | `serveFile()` 统一处理 GET/HEAD/206/416 + `Accept-Ranges` | ✅ 已修 |
| BUG-10 | `/file` 缺文件返回纯文本 | 改 JSON `404 {error:'NOT_FOUND', path}` | ✅ 已修 |

---

## 1. BUG-5（🟠 高）`cancel` 不生效

### 根因
`cancel` 只做 `job.status = 'cancelled'; updateJob(job)`。执行中的 `runJob` 完全不知情：
- `runH3Local` 每 3s、`runSeedance` 每 10s 都会 `updateJob(job)`，用内存里的旧 `job` 对象**整个覆盖**磁盘记录 → 取消状态被冲掉；
- 即使不覆盖，轮询也会一直跑到 600×3s / 240×10s 才结束，GPU 与远端算力白烧。

### 修复
**L314** 进程内取消集合：
```js
const cancelledJobs = new Set();
function markCancelled(jobId) { cancelledJobs.add(jobId); }
function isCancelled(jobId) { return cancelledJobs.has(jobId); }
function clearCancelled(jobId) { cancelledJobs.delete(jobId); }
```

**L327 `cancelJob()`** —— 工具与 Web API 共用的唯一取消入口：
```js
function cancelJob(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('任务不存在');
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { ...job, cancelResult: 'ALREADY_TERMINAL' };   // 幂等，保持"cancel 总是 200"契约
  }
  markCancelled(jobId);
  job.status = 'cancelled'; job.error = CANCELLED_MSG;
  updateJob(job);
  // 排队中（还没拿到本地槽位）的任务：直接摘出等待队列并唤醒，不必傻等前一个任务
  const qi = pendingJobGates.findIndex((g) => g.jobId === jobId);
  if (qi >= 0) { const [g] = pendingJobGates.splice(qi, 1); g.resolve(); }
  return job;
}
```

**L346 `throwIfCancelled()`** —— 所有适配器轮询循环的检查点：命中则**先落盘 cancelled 再抛错**，保证状态不被后续 `updateJob` 覆盖。

**L359 `cancellableSleep()`** —— 把 3s / 10s 的长睡眠切成 ≤250ms 的片，每片检查取消。这是"取消要等满一整轮"的关键修复（实测把 seedance 取消延迟从 9973ms 压到 **218ms**）。

**L561 / L613** 两条轮询循环开头改为 `await cancellableSleep(job, 3000|10000)`。

**L472 / L475-L481** `runJob` 的收尾：取消错误**不降级为 failed**：
```js
if (isCancelled(job.id)) throw new Error(CANCELLED_MSG);
job.status = 'completed'; job.error = null;
} catch (e) {
  if (isCancelledError(e) || isCancelled(job.id)) { job.status = 'cancelled'; job.error = CANCELLED_MSG; }
  else { job.status = 'failed'; job.error = String(e.message || e); }
}
```

**L425-L428** `createJob` 的兜底 catch 同样区分取消，不会把 cancelled 改成 failed。

**L1090**（`studio_jobs` 工具）、**L1268**（`POST /jobs`）改为调用 `cancelJob()`。

### 取证
- 单元：`cancelJob` 落盘 + 标记；已终态幂等返回 `ALREADY_TERMINAL`；`throwIfCancelled` 抛 CANCELLED 且落盘。
- 端到端（假 ComfyUI / 假 Seedance，真实 `runJob`）：
  - h3-local：取消后 **0 次新轮询**，终态稳定 `cancelled`，3s 后仍是 `cancelled`（未被覆盖）；
  - seedance-cloud：取消生效 **218ms**（修复前 9973ms），`polls 1→1`（无新请求）。

---

## 2. BUG-6（🟠 高）`maxConcurrentLocal` 从未被读取

### 根因
`DEFAULTS.maxConcurrentLocal: 1` 只定义、全文无读取方。三个后端都直接 `await runXxx()`，N 个任务同时抢 GPU。

### 修复
**L372-L395** 队列闸门：
```js
const LOCAL_BACKENDS = new Set(['mock', 'h3-local']);   // seedance-cloud 在远端，不限流
const activeLocalJobs = new Set();
const pendingJobGates = [];                              // [{ jobId, backendId, resolve }]

function acquireSlot(jobId, backendId) {
  if (!isLocalBackend(backendId)) return Promise.resolve();          // 远端直接放行
  if (activeLocalJobs.size < maxLocal()) { activeLocalJobs.add(jobId); return Promise.resolve(); }
  return new Promise((resolve) => pendingJobGates.push({ jobId, backendId, resolve }));
}
function releaseSlot(jobId) {
  if (!activeLocalJobs.delete(jobId)) return;
  while (pendingJobGates.length && activeLocalJobs.size < maxLocal()) {
    const next = pendingJobGates.shift();
    activeLocalJobs.add(next.jobId);      // 名额直接转交，避免竞态多占
    next.resolve();
  }
}
```
`maxLocal()` 每次现读 `cfg().maxConcurrentLocal`（支持运行时改配置生效，非法值回退 1）。

**L452-L465** `runJob` 里在**实际执行处**（不是 `createJob`，因为 `createJob` 是同步返回的）申请槽位；`finally`（**L483-L486**）里 `releaseSlot` + 清除取消标记。

> ⚠️ 实现期间发现的真实缺陷：初版把 `jobId` 误传给 `isLocalBackend()`，导致闸门从不生效（任务 id 形如 `job_xxx`，永远不是后端名）。单元测试直接抓出（并发峰值 3），已改为 `acquireSlot(jobId, backendId)` 双参数。**这条记录在此，因为它正是"闸门看起来写了、实际没限流"这类假修复的典型。**

### 取证
- 单元：`max=1` 时 3 个 `acquireSlot` 严格串行 `+j1 -j1 +j2 -j2 +j3 -j3`（耗时 149ms ≥ 3×40ms）；`max=2` 时 2 并发、第 3 个排队后唤醒；远端后端不占槽位。
- 端到端：2 个真实 `mock` 任务（真 ffmpeg）同时 `runJob`，20ms 采样并发峰值 **= 1**，结束后槽位清零。

---

## 3. BUG-7（🟠 中）崩溃后 `running`/`queued` 永挂

### 根因
进程重启后 `jobs.json` 里的在途任务没人处理，UI 永远显示"运行中"。

### 修复
**L401 `recoverInterruptedJobs()`**：
```js
function recoverInterruptedJobs() {
  const list = readJson(DIRS.jobsFile(), []);
  if (!Array.isArray(list) || !list.length) return { recovered: 0, jobs: [] };
  const names = [];
  for (const j of list) {
    if (j && (j.status === 'running' || j.status === 'queued')) {
      j.status = 'interrupted';
      j.error = INTERRUPTED_MSG;
      j.updatedAt = now();
      names.push({ id: j.id, backendId: j.backendId, remoteId: j.remoteId ?? null });
    }
  }
  if (names.length) saveJobs(list);      // 无变更就不写盘（保持文件字节不变）
  return { recovered: names.length, jobs: names };
}
```
**L418** 模块加载时执行一次：
```js
const bootRecovery = recoverInterruptedJobs();
```
> 位置说明：必须放在函数定义**之后**（`const bootRecovery` 会触发 TDZ），因此不在 `initDirs()` 旁边而是在任务区段末尾。功能等价于"`loadJobs()` 之后、`apply()` 之前"。

**不自动重跑**（避免远端重复计费）——只标记，由用户显式 `retry`。
**L1009-L1010** `selfCheck` 增加 `jobRuntime` 项，暴露恢复数量与闸门占用，便于重载后一眼确认。

### 取证
- 6 项场景测试：3 个在途（h3 running + seedance running + queued）→ 全部 `interrupted`；
- `remoteId`（`comfy_pid_9` / `sd_task_7`）与已计费 `cost` **均保留**，便于人工追查上游；
- `completed`/`failed` 不被改写；任务总数仍 5 条（**证明没有自动重跑**）；
- 二次扫描 `recovered=0` 且文件**字节级不变**（幂等）；
- 用真实 `data\jobs.json` 加载：`recovered=0`（只有 1 条 completed），**文件 SHA256 前后一致，未被写坏**。

---

## 4. BUG-8（🟡 中）`POST /config` 回传明文

### 根因
`GET /config` 有 `'***'` 掩码，`POST /config` 直接 `return sendJson(res, 200, cfg())`。

### 修复
**L103 `maskConfig()`**（口径与旧 GET 完全一致：有值 `'***'`，无值 `''`）；**L112 `sanitizeConfigPatch()`** 反方向保护：
```js
const SECRET_FIELDS = ['seedanceApiKey'];
function maskConfig(c) { ... 有值→'***'，空→'' }
function sanitizeConfigPatch(patch) {
  // 写配置时剔除 '***' / 前端占位文案，避免把哨兵当成真 Key 存盘；空串保留（显式清空）
}
```
**L1248** `GET /config` → `maskConfig(c)`
**L1250-L1255** `POST /config` → 写盘前 `sanitizeConfigPatch(b)`，**响应体 `maskConfig(cfg())`**
**L1048-L1050** `studio_config` 工具：`set`/`get` 也都掩码。

### 关于 `studio_config` 工具侧的取舍（任务要求说明）
**决定：工具侧也掩码。** 理由：
1. 工具返回值会进入 Agent 上下文/日志/可能的对话导出，是比 HTTP 响应更长效的泄漏面；
2. Agent 并不需要明文 Key 才能工作 —— 生成/健康检查都在 Host 内部直接读 `cfg()`，工具只需回答"已配置/未配置"；
3. `set` 时 `sanitizeConfigPatch` 剔除 `'***'`，所以"Agent 只写 `'***'` 占位"也不会覆盖真实 Key（避免"回写哨兵即毁密钥"的经典事故）。
> 若将来需要"Agent 帮忙配 Key"，正确做法是让用户在 UI/环境变量里填，而不是让 Key 进模型上下文。

### 取证
- 单元：`maskConfig` 含 Key → `'***'`、无 Key → `''`；`sanitizeConfigPatch` 剔除 `'***'`/占位文案、保留真实 Key 与空串。
- HTTP（真实 server）：`GET /config` → `'***'`；**`POST /config` → `'***'`（泄漏已消除）**，同时磁盘真实 Key `SECRET123` 完好、正常字段 `maxConcurrentLocal:2` 已写入；POST 传 `'***'` 不覆盖磁盘真实 Key。

---

## 5. BUG-9（🟡 中）`/file` 不支持 HEAD / Range

### 根因
`route === '/file'` 只在 `req.method === 'GET'` 时命中；HEAD 落到 `unknown route` → JSON 404；无 `Range` 解析，永远返回 200 全量。

### 修复
**L1170 `parseRange()`** — 单区间解析，支持 `bytes=start-end` / `bytes=start-` / `bytes=-suffix`，越界 clamp，不可满足返回 `{unsatisfiable:true}`。
**L1193 `contentRange()`** → `bytes 0-99/12345`。
**L1205 `pipeFile()`** — 流的 `error` 兜底（stat 与读取之间文件被删/被占用时，不会抛未处理异常打断请求处理链；头未发时补 500 JSON，已发时断开连接）。
**L1214 `serveFile()`** — GET/HEAD 共用一套头：
```js
const baseHeaders = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
// Range 可满足 → 206 + Content-Range + Content-Length=区间长度 + 从 start 流式读取
// Range 不可满足 → 416 + Content-Range: bytes 0-0/size
// 无 Range → 200 + Content-Length=文件全长
// HEAD 一律 writeHead 后直接 end()，不发 body
```
**L1303** 路由改为 `route === '/file' && (GET || HEAD)`。
**路径越界防护保持**：仍用原 `safeResolve()`；越界返回 `400 FORBIDDEN_PATH`（不再把内部绝对路径回显）。

### 取证（对**真实** 2.8MB 输出文件 `<工作区>\工作室\data\outputs\job_mw3d1gbj952ft.mp4`）
```
HEAD /file                 → 200  Content-Length=2848208  Accept-Ranges=bytes  CT=video/mp4  body=0B
GET  Range bytes=0-99      → 206  Content-Range=bytes 0-99/2848208   Content-Length=100  body=100B
GET  Range bytes=-1024     → 206  Content-Range=bytes 2847184-2848207/2848208  body=1024B
GET  无 Range              → 200  Content-Length=2848208  body=2848208B（与磁盘实长一致）
GET  Range bytes=9999999-  → 416
路径越界 ../config.json     → 400 {"error":"FORBIDDEN_PATH"}
Range 字节与磁盘切片逐字节一致：true / 尾部一致：true
```

### 修复前基线（对**当前运行中**的旧实例实测，证明 bug 真实存在）
```
HEAD  → HTTP/1.1 404 Not Found（application/json）
Range → HTTP/1.1 200 OK（Transfer-Encoding: chunked，忽略 Range）
缺文件 → 404 纯文本 "not found"
```

---

## 6. BUG-10（🟡 低）`/file` 缺文件返回纯文本

### 修复
`serveFile()` 内所有失败分支统一 JSON：
```js
// 越界
return sendJson(res, 400, { error: 'FORBIDDEN_PATH', path: rel });
// 不存在 / 是目录 / stat 失败
return sendJson(res, 404, { error: 'NOT_FOUND', path: rel });
```
与其它路由的 `sendJson` 错误口径一致（`application/json; charset=utf-8` + `Cache-Control: no-store`）。

### 取证
```
GET  缺文件 → 404  application/json; charset=utf-8  {"error":"NOT_FOUND","path":"outputs/nope.bin"}
HEAD 缺文件 → 404  application/json; charset=utf-8  body=0B
GET  目录   → 404  {"error":"NOT_FOUND"}
```

### ⚠️ 对 client.js 的影响（client.js 不归本次改动，需同步标注）
`client.js` 的 `api()` 目前是：
```js
try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
if (!res.ok) throw new Error((data && data.error) || res.status + ' ' + res.statusText);
```
- **改后行为是更好的**：JSON 404 有 `data.error`，`throw new Error(data.error)` 会抛出 `"NOT_FOUND"`；原先纯文本会走 `{raw:'not found'}` → `data.error` 为 undefined → 回退成 `"404 Not Found"`。
- **真正需要注意**：`/file` 现在会返回 **206**（Range）与 **416**。`client.js` 只通过 `<img src>` / `<video src>` / `<a href>` 直接消费 `fileUrl()`，**不经过 `api()`**，所以 206/416 不会进入 `acceptance` 逻辑，**无需改动 client.js 即可兼容**。
- 唯一建议（非阻塞）：若 client.js 将来用 `fetch` 读 `/file` 做字节处理，需自行处理 206 部分内容与 416。

---

## 7. 静态与单元级验证汇总

### 7.1 `node --check`
```
F:\Deepseek_harness\rea-agent\runtime\node.exe --check F:\AI视频\工作室\dsh-ai-video-studio\index.js
→ exit=0
```

### 7.2 验证脚本（全部在 `%TEMP%\reliability-fixer\`，不污染项目）

| 脚本 | 覆盖 | 结果 |
|---|---|---|
| `verify.mjs` | 真实加载 index.js + 沙箱 dataDir + 真实 HTTP server：BUG-7/8/6/5/9/10 + 工具契约 | **27 passed, 0 failed** |
| `verify-e2e.mjs` | 真实 `runJob` + 假 ComfyUI/Seedance 上游：取消真终止、并发峰值、取消不覆盖 | **4 passed, 0 failed** |
| `verify-recovery.mjs` | 崩溃现场恢复：标记/保留 remoteId/不重跑/幂等 | **6 passed, 0 failed** |
| `verify-real-file.mjs` | 用**真实** `data\` 起临时 server 验证 HEAD/Range/404 + 字节一致性 | 全部符合预期，`jobs.json` SHA256 未变 |

> 验证方式：把真实 `index.js` 复制到临时目录、仅在末尾追加 `export {...}`（唯一差异），因此测的是**真实实现**，不是重写的副本。

### 7.3 关键数字
- 并发闸门：`maxConcurrentLocal=1` → 峰值 **1**；3 任务串行耗时 149ms（≥3×40ms）。
- 取消延迟：seedance **218ms**（修复前 9973ms）；h3 取消后 **0 次新轮询**。
- 崩溃恢复：3/3 在途 → `interrupted`，任务总数不变（无自动重跑），二次扫描文件字节不变。
- `/file`：HEAD 200 CL=2848208 body=0；Range 0-99 → 206 CL=100 逐字节一致；416/400/404 语义正确。
- 契约：**11 个 `studio_*` 工具名与 action 枚举全部未变**。

---

## 8. 需要 Lead 重载插件后实测的清单

我没有 `plugin_manager` 权限，以下需**重载插件后**验证（重载前旧实例仍是旧代码，见 §5 基线）。

| # | 实测项 | 命令 / 操作 | 期望 |
|---|---|---|---|
| 1 | **取消真终止** | 起一个 h3-local 任务（或 mock 慢任务）→ `POST /jobs {action:'cancel', jobId}` → 等 3s 再 `GET /jobs` | 该任务 `status` 保持 `cancelled`，**不再出现新轮询**（可看 ComfyUI 日志或 `GET /jobs` 的 `updatedAt` 不再变化）；`error` 为 `CANCELLED: 用户取消` |
| 2 | **取消后不覆盖** | 上一步后连续 10s 每 3s `GET /jobs` | 状态恒为 `cancelled`，绝不回到 `running`/`completed` |
| 3 | **并发闸门** | 连续 `POST /generate` 3 个 `mock` 任务（`maxConcurrentLocal=1`） | 任一时刻最多 1 个 `running`，其余 `queued`；总时长≈3 倍单任务 |
| 4 | **运行时改并发** | `POST /config {maxConcurrentLocal:2}` → 再起 2 个 mock 任务 | 允许 2 个同时 `running` |
| 5 | **远端不受限** | 配好 Key/模型后起 2 个 `seedance-cloud` | 2 个都直接进 `running`，不占本地槽位 |
| 6 | **崩溃恢复** | 起一个任务 → 杀进程/重载插件 → 重启后 `GET /jobs` | 原在途任务变 `interrupted` + `INTERRUPTED: 插件重启…`，**不会自动重新执行**；`selfCheck` 的 `jobRuntime` 项显示恢复条数 |
| 7 | **POST /config 掩码** | `curl -X POST .../config -d '{"maxConcurrentLocal":1}'` | 响应体 `seedanceApiKey` 为 `"***"`（或 `""`），**绝无明文**；磁盘 `config.json` 内真实 Key 未被改 |
| 8 | **掩码不毁 Key** | 先把 UI 配置文本原样保存（含 `***`/占位文案） | 磁盘 `seedanceApiKey` 仍为原真实值 |
| 9 | **HEAD** | `curl.exe -I ".../api/file?path=outputs/<某视频>"` | `200`，含 `Content-Length` / `Content-Type: video/mp4` / `Accept-Ranges: bytes`，**无 body**（修复前是 404） |
| 10 | **Range** | `curl.exe -r 0-99 -D - -o NUL ".../api/file?path=outputs/<某视频>"` | `206` + `Content-Range: bytes 0-99/<size>` + `Content-Length: 100`（修复前是 200 + chunked） |
| 11 | **视频拖动** | UI 里拖动 `<video>` 进度条到中段 | 正常跳转/秒开，不卡住（这是 Range 的真实用户价值） |
| 12 | **416/400** | `curl -r 99999999- .../file?path=outputs/<视频>`；`curl "...?path=../config.json"` | 416 / 400，且均为 JSON |
| 13 | **缺文件 JSON** | `curl ".../api/file?path=outputs/nope.mp4"` | `404` + `application/json` + `{"error":"NOT_FOUND","path":"outputs/nope.mp4"}` |
| 14 | **UI 回归** | `GET /jobs` 后看任务面板 | `interrupted` 状态显示为 warn 色（`client.js` 的 `statusClass` 对非 completed/failed 一律 warn，天然兼容）；`cancel` 按钮对 `interrupted` 禁用符合预期 |
| 15 | **11 工具契约** | 工具列表 | 仍是 11 个 `studio_*`，action 枚举未变 |

> 建议第 1-2 项用 `mock` 后端做（不依赖 ComfyUI）；若要验证"轮询真中断"，用 `h3-local` 指向一个会卡住的假 ComfyUI 更直观。

---

## 9. 已知边界与未做项

1. **取消是"协作式"而非"强杀"**：进程内的 `Set` 只能让**本进程**的轮询循环感知。若取消发生在 `fetch` 已发出、尚未返回的瞬间，那一次请求仍会完成（但结果被丢弃）。这是 Node 原生 `fetch` 无外部 AbortController 注入点的现实限制；把窗口压到 3s/10s 睡眠可中断后已足够小（实测 218ms）。
2. **不清理上游任务**：取消 h3/seedance 后，ComfyUI 队列里的任务与云端已提交任务**不会**被取消（没有相应的取消 API 约定，且强行调用可能产生计费歧义）。若将来需要，应在 `cancelJob` 里按 `remoteId` 调各后端自己的 cancel 接口。
3. **`maxConcurrentLocal` 改动即时生效但不会"降级"已运行任务**：从 2 调到 1 时，已在跑的 2 个不会被打断，只是下一个排队。
4. **`interrupted` 是新增状态值**：`client.js` 未显式枚举状态，靠 `statusClass` 兜底为 warn；`selfCheck` 已把 `interrupted` 计入统计。**未改动 `client.js`**（不归本次范围）。
5. **`/file` 的 400 语义**：越界原实现会走 `catch` → 500；现改为 400，更符合客户端错误语义。若前端有依赖 500 的逻辑需注意（经查 `client.js` 无此依赖）。
6. **测试脚本只在 `%TEMP%`**：`C:\Users\...\Temp\reliability-fixer\`，未写入项目仓库；`verify*.mjs` 可复现。

---

## 10. 改动文件清单

| 文件 | 改动 |
|---|---|
| `工作室/dsh-ai-video-studio/index.js` | 6 个 bug 的全部修复（+315 行） |
| `工作室/docs/fix-reliability.md` | 本报告 |

**未改动**：`client.js`、`services/previz/*`、资产包、11 个工具名与 action 名、任何 npm 依赖。

> 说明：编辑期间 `index.js` 的**预演区段**正被另一任务（BUG-A / previz-fixer 相关）并发修改。我的全部改动集中在配置/任务/工具/Web API 区段，与其编辑区域不重叠；最终文件已含对方的预演改动且 `node --check` 通过。文件最终 SHA256 已记录在文首。