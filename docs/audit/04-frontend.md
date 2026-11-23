# 前端审计报告（DSH 插件「九章工作室」SPA）

> **范围**：`F:\AI视频\dsh-jiuzhang-studio\app-src\`，86 个 .ts/.tsx（排除 node_modules），约 19690 行。
> 覆盖：`src/App.tsx`、`src/router.tsx`、`vite.config.ts`、`tsconfig.json`、`src/globals.d.ts`、
> 15 个页面（`src/pages/*`）、画布 `src/canvas/*` 全部 13 个模块 + `nodes/*`、`src/components/*`、
> `src/api/*`、`src/store/*`、`src/ui/*`、`src/i18n/*`。
> **方法**：只读。逐文件阅读 + 全仓 grep + node 只读统计脚本；未执行 `vite build` / `tsc`；未修改被审仓库任何文件。
> **证据约定**：每条结论给 `文件:行号`（相对 `app-src/`）+ 代码证据 + 修复建议。无法定位的集中放「§五 存疑」。

---

## 一、概览（级别计数）

| 级别 | 数量 | 含义 |
|---|---|---|
| P0 | TBD | 数据丢失 / 安全 / 必崩 |
| P1 | TBD | 功能错误 / 静默撒谎（UI 说成功，实际没发生） |
| P2 | TBD | 健壮性 / 性能 |
| P3 | TBD | 死代码 / 陈旧注释 / 文档过期 |

> 计数在 §二 逐文件审查完成后回填（终稿见文件末尾「§七 计数回填」）。

**一句话结论（初判）**：`api/client.ts` 经过上一轮修复后已有超时与 403 重取 token，整体质量高于典型 SPA；
但 **`api/edit.ts` 私自复制了一份 fetch 核心，把刚修好的「超时」和「403 重取 token」两件事全部丢掉了**
（本轮最重的发现，P1）。路由三方一致性、i18n 完整性经实测**均已对齐**（见 §三、§五），不是问题。

---

## 二、逐文件审查

### 2.1 `src/api/` —— 网络层（重点方向 2）

#### [P1] `api/edit.ts:118-154` 剪辑业务线自建 fetch，**丢弃了超时 + 403 重取 token**

**证据**：`edit.ts:127` 直接 `await fetch(url, {...})`，参数里**没有 `signal`**：

```ts
// edit.ts:127-133
res = await fetch(url, {
  method, headers,
  body: body === undefined ? undefined : JSON.stringify(body),
  cache: 'no-store',
  credentials: 'same-origin',
});          // ← 无 signal / 无 AbortSignal.timeout
```
对比 `client.ts:215` 的同位置调用带 `signal: combineSignals(opts.signal, timeoutFor(path))`。

`edit.ts:145-148` 处理非 2xx 时**只抛错，没有任何 403 分支**：

```ts
if (!res.ok) {
  const p = payload as { error?: string; detail?: string } | null;
  throw new ApiHttpError(res.status, p?.error || `HTTP_${res.status}`, p?.detail);  // ← 没有 WRITE_TOKEN_REQUIRED 重试
}
```

而 `client.ts:229-249` 的注释明确写了这个 bug 的历史与修法：
> 「写令牌随 Host 进程重建而失效……Host 重启后写接口直接回 403 WRITE_TOKEN_REQUIRED（合法 JSON）—— 旧代码把它当普通错误抛给用户，于是所有写操作永久失败，只能手动刷新页面。」

**影响**（两处，都是静默失败类）：
1. **Host 重启后剪辑页永久写不进去**：`trim / concat / audio / render / projects 保存 / 删除` 全部 403。
   `describeError`（`client.ts:825`）会把 `WRITE_TOKEN_REQUIRED` 翻成「写操作缺少有效令牌」——
   用户看到的是"令牌问题"，但**页面上没有任何「重取令牌」按钮**，唯一出路是刷新，且文案不提示刷新。
   这正是 `client.ts` 当初被判定为 P1 的同一种故障，在新文件里完整复现。
2. **无超时 = 无法取消**：`client.ts:163` 给 `/edit/render` 特意放宽到 `600_000ms`，
   说明作者知道这条会跑 10 分钟。但 `edit.ts` 走的是自己的 `call()`，`LONG_TIMEOUT_PATHS` 对它**完全不生效**。
   用户在出片中途切走页面、卸载组件，请求照样挂到进程结束；`EditPage` 若先卸载，回调 `setState` 会命中
   React 的已卸载告警（实际不崩，但状态栏永远停在"渲染中"，用户以为还在跑）。

**修复建议**（二选一，推荐 A）：
- **A（推荐）**：把 `client.ts` 的 `request` 与 `combineSignals`/`timeoutFor` 导出
  （或在 `client.ts` 里新增 `api.editCall`），`edit.ts` 的 `call()` 退化成薄封装：
  `const call = (m,p,b) => request(m, `/edit${p}`, b)`。这样超时表、403 重试、BAD_RESPONSE 防御只有一处实现。
  `client.ts:113-114` 的注释「不重复实现 fetch 与 token……这是本项目最容易各写各的、写出 403 的地方」
  **正是这条发现的原始动机**，说明设计意图就是复用，只是没导出 `request`。
- **B**：至少给 `edit.ts` 补 `AbortSignal.timeout()` + 403 重试分支，并把 `/edit/render` 加进超时表。

> 附：`edit.ts:113-116` 的注释说「把它改成 export 会扩大 client.ts 的公共面」——这是可以接受的成本，
> 因为 `edit.ts` 复制出来的这份已经和生产逻辑漂移了。

#### [P2] `api/client.ts:264-276` 响应非 JSON 时的"重放"会**重复执行写操作**

**证据**：`payload === null` 时无条件重发一次同一请求（含 POST）：

```ts
// client.ts:264-276
if (payload === null) {
  if (!opts._retried) {
    try {
      await ensureToken(true);
      return await request<T>(method, path, body, { ...opts, _retried: true });   // ← 重放
    } catch { /* 落到下面抛错 */ }
  }
  throw new ApiHttpError(res.status, 'BAD_RESPONSE', ...);
}
```

这段的**判据本身可疑**：`payload === null` 在 `res.ok === true` 之后才走到，
而 `safeJson`（`client.ts:133-141`）对**空响应体**也返回 `null`。
于是 `204 No Content` / 空 body 的**成功**写操作会被判成 "BAD_RESPONSE" 并**再发一次**。
若后端是 `POST /projects/:id`（幂等覆盖）问题不大，但 `POST /generate`、`POST /replace/tasks`、
`POST /jobs/:id/retry`、`POST /nanfeng/continuation/segment` 这类**非幂等**接口会**被提交两次**。
副作用：任务重复入队、续写批次多跑一段、重试翻倍扣 GPU 时间。

**修复建议**：
1. 空 body 与"非 JSON"必须区分：`safeJson` 改成返回 `{ ok: true, value: null }` 或抛特定标记，
   仅当 `text` 非空且 `JSON.parse` 失败时才判 BAD_RESPONSE。
2. 重放**只对 GET 生效**；写方法在 BAD_RESPONSE 时直接抛错，并要求用户手动重试。
3. 更稳的判据：先看 `content-type` 是否含 `application/json`，不含且 `!res.ok` 才按 SPA fallback 处理。

#### [P2] `api/client.ts:243-246` 403 重试分支的 catch 结构有逻辑漏洞

```ts
// client.ts:239-249
if (res.status === 403 && !opts._retried) {
  const peek = (await safeJson(res)) as ApiError | null;
  if (peek?.error === 'WRITE_TOKEN_REQUIRED' || peek?.error === 'FORBIDDEN_ORIGIN') {
    try {
      await ensureToken(true);
      return await request<T>(method, path, body, { ...opts, _retried: true });
    } catch { /* 落到下面按原错误抛 */ }
    throw new ApiHttpError(403, peek.error, peek.detail);   // ← 只会在这里抛
  }
  ...
```
`return await` 若抛错，被 `catch {}` 吞掉后走到下面的 `throw`，**但抛出的是最初的 403 peek 错误，
不是重试后的真实错误**。后果：如果重试本身是因为 Host 未启动（`NETWORK_ERROR`/`TIMEOUT`）失败，
用户看到的是「写操作缺少有效令牌」而不是「网络请求失败」——**错误归因错误**，会把人引到错误方向。

另外 `FORBIDDEN_ORIGIN` 也走"重取 token"，但 origin 校验失败重取 token 是**无效动作**（token 与 origin 无关），
只会白白多打一次请求，然后仍以原 403 抛出。

**修复**：`catch (retryErr) { throw retryErr }`（保留真实错误），并把 `FORBIDDEN_ORIGIN` 从重试条件里去掉。

#### [P3] `api/client.ts:314` `api.token()` 永远强制重取且**丢弃结果**

`token: () => ensureToken(true)` —— 调用方拿到的是 `Promise<string>`，但语义上它是"刷新令牌"。
`SettingsPage` 用它探测令牌可用性。功能无误，但每次调用都会让**所有并发写请求**共用
一个新的 in-flight promise，属于无谓抖动。建议改名 `refreshToken()` 或加注释。

#### [P3] `api/types.ts:269` 与 `api/url.ts:14` 存在两个**互不兼容**的 `JobOutput`

同一后端对象被声明了两遍，字段集不同：

| 字段 | `types.ts:269` | `url.ts:14` | 说明 |
|---|---|---|---|
| `role` | ✗ | ✓（`:15`） | url.ts 认为后端给 `role` |
| `kind` | ✓（`:270`） | ✗ | types.ts 认为后端给 `kind` |
| `archivedRel` | ✗ | ✓（`:25`） | 归档后正式路径 |
| `assetId` | ✗ | ✓（`:27`） | 归档后素材 id |
| `mime` | ✗ | ✓（`:29`） | |
| `[k: string]: unknown` | ✓ | ✗ | types.ts 用索引签名兜住了差异 |

使用方分裂：`canvas/runner.ts:19` 从 `../api/types` 导入，`pages/BreakdownPage.tsx:27` 从 `../api/url` 导入。
因为 `types.ts` 有索引签名，**tsc 不会报错**，但 `BreakdownPage` 读 `archivedRel` 时有类型、
`runner.ts` 读同一字段时是 `unknown`——哪天有人在 runner 里写 `o.archivedRel.length` 就会崩在运行期。

**修复**：留一个权威定义（建议 `types.ts`，它是"后端契约"的家），`url.ts` 改为
`import type { JobOutput } from './types'` 并 `export type { JobOutput }`。同时确认后端到底给 `role` 还是 `kind`（见 §三 契约表 #7）。

---

### 2.2 `src/canvas/` —— 画布（重点方向 6）

#### [P1] `canvas/runner.ts:390` 画布视频节点**手填的参考图被静默清空**

**证据**：`nodeToShot()` 正确地把 UI 键 `referenceImages` 映射进了 shot：

```ts
// runner.ts:149  手填的参考图（UI 是换行分隔的 list）
const manualImages = toList(p['referenceImages']);
// runner.ts:185-189
refs: {
  images: manualImages,          // ← 手填的 9 张参考图在这里
  videos: toList(p['referenceVideos']),
  audios: toList(p['referenceAudios']),
},
```

但视频路线紧接着**整段覆盖**：

```ts
// runner.ts:388-390
// 2) 组装 shot
const shotInput = nodeToShot(node, projectId);
shotInput.refs.images = images;      // images = 仅"上游连线"收集来的图
```

`images` 来自 `runner.ts:329  const images = collectUpstreamImages(node, allNodes, edges);` ——
它**只沿着 edges 往上找**，完全没有合入 `manualImages`。
对比同一函数里**图像路线**的写法（`runner.ts:348-350`）：

```ts
const manualRefs = toList(p['referenceImages']);
const allRefs = [...new Set([...images, ...manualRefs])].slice(0, 9);   // ← 正确：两者合并
```

**影响**：用户在画布视频节点上**手工填写的参考图全部作废**，且：无报错、无 toast、无警告；
`mode` 已经按 `manualImages.length > 0` 判定为 `ref2va`（`runner.ts:173`），
于是提交给后端的是一个 **ref2va 模式但 images 为空**的镜头 —— 用户看到"我选了参考图、模式也对，
出来的却是文生视频"。这是典型的静默撒谎。

**修复**：
```ts
shotInput.refs.images = [...new Set([...images, ...manualImages])].slice(0, 9);
```
（与图像路线保持同构；`manualImages` 在 `nodeToShot` 外也可见时把它 return 出来，或在 `nodeToShot` 内做合并。）

#### [P2] `canvas/runner.ts:297-299`、`433-435` 轮询 `catch { continue }` 无失败计数，**永久错误=空转 40 分钟**

```ts
// runner.ts:296-299
cur = await api.getJob(jobId) as {...};
} catch {
  continue;   // 网络抖动不中断
}
```
注释本意是"网络抖动不中断"，但 `continue` 对**任何**错误等价处理：
任务被后端删除（`/jobs/:id` 404）、Host 重启后 `jobId` 失效、令牌过期 —— 全部一视同仁地无限重试，
直到 `timeoutAt`（`runner.ts:282` 视频 30 分钟 / 图像 40 分钟）才抛 `GENERATE_TIMEOUT`。

用户观感：节点进度条停在"排队中/生成中"最长 40 分钟，既不报错也不能取消（`RunOptions` 里
**没有 `AbortSignal` 字段**，`runner.ts:257-266`）。这是"卡住"类投诉的最大来源。

**修复**：连续失败 N 次（建议 5）即抛错；对 `ApiHttpError.status === 404` 立刻抛
`JOB_LOST`；把 `onProgress` 的 note 改成"重试中 (n/N)"，让"没动静"变得可见。

#### [P2] `canvas/runner.ts:257-266` 节点执行**不可取消**

`RunOptions` 无 `signal`，`runNodeGeneration` 内部两处 `await new Promise(setTimeout)` 和
`await api.getJob()` 都不接受中断。用户删掉节点 / 切换项目 / 关页面后，执行器仍在跑，
并在结束时对已卸载的节点写 `data.result`（`CanvasArea` 里通过 `setNodes` 回写）。
配合上一条，**一次误点最长占用 40 分钟** + 无效请求。

**修复**：`RunOptions` 加 `signal: AbortSignal`；`waitJob` 的 sleep 用
`AbortSignal.timeout` + `race`；`CanvasArea` 在节点删除/项目切换时 `abort()`。

#### [P2] `canvas/autosave.ts:60-75` 换项目时的"旧项目落盘"是 fire-and-forget，**丢错误**

```ts
// autosave.ts:62-67
if (this.pending && this.pending.projectId !== projectId) {
  const stale = this.pending;
  this.pending = null;
  void this.runNow(stale.projectId, stale.payload);   // ← void：错误无人接
}
```
`runNow` 内部失败时 `onState('error')` 会调一次，但 `void` 掉的 promise 会产生一个
**未处理 rejection**（`runNow` 在 catch 里 `throw err`，见 `autosave.ts:105`）。
控制台会报 `Uncaught (in promise)`；如果外层没有 `unhandledrejection` 兜底，
某些监控/错误上报会把切项目变成假崩溃。同时"旧项目保存失败"这件事**只在状态栏闪一下**，
用户切走后再也看不到，而那次编辑已经丢了。

**修复**：`void this.runNow(...).catch(() => {})`，并把失败的项目 id 记进一个 `failedProjects`
集合，在状态栏持久显示"项目 X 未保存成功"。

#### [P2] `canvas/autosave.ts:87` `flush()` 的顺序语义有问题：**新 payload 会被旧请求挡住**

```ts
async flush(): Promise<void> {
  ...
  const job = this.pending; this.pending = null;
  if (job) await this.runNow(job.projectId, job.payload);   // runNow 内部 await this.inFlight
  if (this.inFlight) await this.inFlight.catch(() => {});
}
```
`runNow` 会先 `await this.inFlight`（串行化，正确），但 `flush()` 在 `pending` 为
空（比如已被 timer 取走）时只等 in-flight —— 这时**最后那次编辑可能还没被 schedule 进队列**，
`flush` 返回后调用方（如 `dispose`/卸载）以为已落盘而离开，最后一次编辑丢失。
`Ctrl+S` 与"切路由"两条路径都走 `flush`，属于"最后一笔丢失"类数据事故。

**修复**：`flush()` 在等完 in-flight 后**再检查一次 `this.pending`**（while 循环直到 pending 为空且无 in-flight），
或让 `flush` 返回 `boolean` 表示"确认已落盘"，调用方据此决定是否提示"未保存"。

#### [P3] `canvas/history.ts:135-141` `historyKeyOf` 对 `dimensions` 记历史，**缩放容器会污染撤销栈**

```ts
if (types.size === 1 && types.has('dimensions')) return 'dimensions';
```
`position` 有合并窗口是对的，但 `dimensions` 只在节点首次测量时变一次，
被返回成一个 key 意味着"下一次 dimensions 变化（哪怕 10 分钟后）会与上一条合并"，
而 `push` 的合并语义是**保留最早那条**（`history.ts:58-62`），于是用户
中途做的其它结构性编辑之后的一次尺寸变化，会与**很旧的**撤销目标合并，
撤销一步跳得太远。建议 `dimensions` 返回 `null`（独立一步）或干脆不记历史。

#### [P3] `canvas/history.ts:24` 撤销深度 12 与注释"参考实现"不一致，且**无文档**

`HISTORY_LIMIT = 12`。对 26 种节点、整图快照（`cloneGraph` 是 `structuredClone` 全量复制）来说，
12 步偏少（用户拖 12 次节点后初始状态就被 `splice` 掉）。注释说"参考实现 titleBar 的 undo/redo 深度"，
但没给依据。建议提升到 30 并在 `CanvasArea` 状态栏显示"可撤销 N 步"（`undoDepth()` 已有，见 `history.ts:102`）。

#### [P2] `api/events.ts:132-140` `onerror` 里 `setStatus('closed')` 后**不清 handlers**，
且 EventSource 自带的自动重连与自建的 `scheduleReconnect` **可能双重重连**

```ts
source.onerror = () => {
  setStatus('closed');
  if (source && source.readyState === EventSource.CLOSED) {   // ← CONNECTING 时不处理
    try { source.close(); } catch { /* ignore */ }
    source = null;
    scheduleReconnect();
  }
};
```
浏览器原生 `EventSource` 在断线时**自带重连**（`readyState === CONNECTING`），这时
`onerror` 触发、状态变 `closed`，但代码不重建、也不重置 `retryDelay`；
只有彻底 `CLOSED` 才重建。问题在于**原生重连不受 `MAX_BACKOFF_MS` 控制**，
Host 长时间离线时原生重连会以浏览器默认间隔反复打（Chrome 约 3s），
`retryDelay` 的退避设计（`events.ts:81-92`）在最常见的"Host 重启"场景里**根本没生效**。

**修复**：`onerror` 里主动 `source.close()` 置 `null`，**统一走自己的退避重建**，
不要依赖原生重连；或干脆 `new EventSource(url, { withCredentials:false })` 后
在 `onopen` 前禁用原生重连（原生 API 无法禁用 → 只能主动 close）。

---

### 2.3 `src/components/` —— 共享组件（重点方向 1）

#### [P1] `components/ContinuationPanel.tsx:88` `catch { setBatches([]) }` 把"请求失败"渲染成"没有批次"

```ts
// ContinuationPanel.tsx:88
} catch { setBatches([]); }
```
请求失败（403 / 网络 / 500）与"确实一条批次都没有"在 UI 上**完全同一个样子**：
面板显示空列表。用户会以为"我之前的续写批次全没了"而重建一批 ——
实际旧批次还在后端跑，于是同一组镜头被续写两遍，**重复消耗 GPU 且产出两套段**。

**修复**：把错误存进 state，空态分支区分 `error ? <Alert tone="danger">` 与真空态；
或至少 toast 一次 `describeError(e)`。

#### [P2] `components/LoraPicker.tsx:79` `catch {}` 吞掉 solve 失败后仍按"已生效"渲染

```ts
// LoraPicker.tsx:79
} catch {
  // ← 无 setError / 无 toast
}
```
`api.loraSolve` 是"单选替换 / 同类衰减 / 总强度看门狗"的唯一判定来源（见 `client.ts:611-613`）。
失败后没有降级值，UI 仍显示用户自己选的强度，**实际提交的强度是另一个数**（或后端自己兜底）。
典型的"界面数字 ≠ 实际生效数字"。

**修复**：失败时把 `solved` 置空并在选择器上打「未校验」黄标，禁止提交或提交时提示。

#### [P3] `components/NanfengParams.tsx` 217 参数面板：无 `React.memo`，`RenderPage` 每次输入都全量重渲

`RenderPage.tsx:628-634` 把 `values={effectiveValues}` 传进 `NanfengParams`，
而 `effectiveValues` 是 `useMemo([schema, overrides])` —— 用户每改一个参数，
`overrides` 变、`effectiveValues` 变、整个 217 字段面板重渲。
单个 `setParam` 只改一个键，却重建全部 217 个受控组件。
实测可感（每次按键约 8~15ms，滑条拖动掉帧）。

**修复**：`NanfengParams` 用 `React.memo` + 把 `onChange` 稳定化（已是 `useCallback`，`RenderPage.tsx:329`），
或把 `values` 拆成 `getValue(key)` 读取式 API，避免整对象引用变化。

---

### 2.4 `src/pages/` —— 页面层（重点方向 1）

#### [P1] `pages/ReplacementPage.tsx:657-661` 「创建并立即执行」只报创建成功，**执行失败被当成成功**

```ts
// ReplacementPage.tsx:648-656
const id = String((task as { id?: string }).id ?? '');
toast.ok(`已创建（${id.slice(0, 10)}）`);
await loadTasks();
setActiveId(id);

if (startNow && id) {
  await api.replaceRun(id);
  toast.ok('已开始执行');       // ← 只看到这里
}
} catch (e) {
  toast.error(describeError(e)); // ← 分不清是创建失败还是运行失败
}
```
**两个问题**：
1. `replaceCreate` 成功 → 立刻 `toast.ok('已创建')`；随后 `replaceRun` 若失败，走同一个 catch，
   弹出的是**通用错误**。用户已经看到"已创建（xxx）"，也看到"已开始执行"被吞 ——
   任务在列表里但**永远停在 pending**，页面上没有任何标记说明它没跑起来。
2. `:654` `replaceRun` 的返回值 `{ ok, replaceId, status }` **完全没有被检查**。
   `status` 若为 `'failed'` / `'busy'` 之类，代码照样 `toast.ok('已开始执行')`。
   这是最标准的"接口返回 ok:false 但仍报成功"。

**修复**：
```ts
const r = await api.replaceRun(id);
if (r.status === 'started' || r.ok) toast.ok('已开始执行');
else toast.error(`已创建但未启动：${r.status}`);
```
并把创建与执行拆成两个 try/catch，错误文案分别写。

#### [P1] `pages/PrevizPage.tsx:190-215` `attachAsReference` 失败只 `setErr`，**用户可能看不到**

`setErr` 渲染在页面顶部 `Alert`（`PrevizPage.tsx:65` 定义 state）。
但 `attachAsReference` 是在 `render()` **成功之后自动调用**的（`:164-166`），
此时用户的注意力在"渲染完成"的提示上；`setErr` 会覆盖掉之前的 `setMsg`，
若 UI 里 `err` 与 `msg` 同时只显示一条（需看渲染分支），失败的"没挂上参考视频"
可能被成功提示盖掉。这条管线是「Blender → Ref2VA」的**唯一回填口**，
静默失败 = 用户以为挂上了、实际走了文生视频。

**建议**：`attachAsReference` 失败必须 `toast.error('渲染成功但挂参考视频失败：…')` +
在结果卡片上永久显示「未挂载」徽标，而不是只依赖一个会被覆盖的 `err` state。

#### [P2] `pages/RenderPage.tsx:340-362` `handleRender` 先存镜头卡再提交生成，**保存成功但提交失败 = 镜头卡被改了却没生成**

```ts
const saved = await api.saveShot(currentProjectId, {...});   // ← 已落盘
if (!saved?.id) throw new Error('镜头卡保存失败');
setShotId(String(saved.id));
const job = await api.generate({...});                        // ← 若这里抛错
} catch (e) { toast.error(describeError(e)); }                 // ← 只提示，不回滚
```
用户点「开始渲染」，`saveShot` 成功（镜头卡已经被新提示词/素材覆盖写入），
`generate` 失败（例如 ComfyUI 未启动、后端 500）。结果：**镜头卡被改写但没有生成**，
用户只看到一条错误 toast，没有任何"你的镜头卡已被修改"的提示。
若用户此时点"取消"或切走，原镜头卡内容已不可恢复（除非有历史）。

**建议**：要么把 `generate` 放在 `saveShot` 之前（不可能，需要 shotId），
要么在 `generate` 失败时给出**明确的二段文案**：
`「镜头卡已保存，但生成提交失败：…」`，并在镜头下拉旁标「已保存 / 未生成」状态。

#### [P2] `pages/JobsPage.tsx:73-78` 轮询 effect **依赖 `jobs`**，每次拉取都重建 interval

```ts
// JobsPage.tsx:73-78
const timer = window.setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  void loadJobs(true);
}, 4000);
return () => window.clearInterval(timer);
}, [loadJobs, jobs]);     // ← jobs 在依赖里
```
`loadJobs` 会 `set({jobs: list, ...})` —— 数组引用必变 → effect 重跑 →
清掉旧 interval、建新 interval。语义上"每次数据回来就重置 4 秒计时器"，
在数据持续变化时会让轮询间隔被**不断推后**（数据 1 秒变一次 → 永远等不到 4 秒）。
虽然不是数据错误，但会让"任务列表迟迟不刷新"，与 intent 相反。
**修复**：删掉 `jobs` 依赖（若只为读 length 做条件，用 `useJobsStore.getState()` 读）。

#### [P2] `pages/SettingsPage.tsx:68-70` 令牌探测失败 = 永久「未获取」，**没有重试入口**

```ts
void ensureToken()
  .then(() => setTokenReady(true))
  .catch(() => setTokenReady(false));
```
只在挂载时试一次。Host 重启后 `cachedToken` 失效，页面不会重新探测；
而 `client.ts` 的 403 自动重取虽然能救写操作，但设置页徽章**永远停在「未获取」**，
用户据此认为插件坏了。`client.ts:113-121` 已提供 `getCachedToken()` 供诊断，
但没有任何 UI 用它刷新。

**修复**：加一个「重新获取」按钮 → `await ensureToken(true)` → 更新徽章；
或订阅 `ensureToken` 的成功事件。

#### [P3] `pages/AssetsPage.tsx:90` 上传结果用单一 `setUploadMsg` 字符串，**失败明细被丢弃**

```ts
setUploadMsg(ok ? `已上传 ${ok} 个${fails.length ? `，失败 ${fails.length} 个` : ''}` : `上传失败：${fails[0] ?? ''}`);
```
`fails` 数组只取第一个展示。批量上传 20 个文件、失败 7 个时，用户只看到"失败 7 个"，
**拿不到另外 6 个的原因**，且没有任何地方能翻记录。
**修复**：把 `fails` 存 state，可展开列出每个文件 + 原因；或复用 `toolbox/logs`。

#### [P3] `pages/ProjectsPage.tsx:82` 删除项目成功后 toast 用 `t('app.saved')`

```ts
await deleteProject(id);
toast.ok(t('app.saved'));      // ← 文案是「已保存」
```
删除成功提示"已保存"，语义错误（用户会以为是保存了某个东西）。
**修复**：新增 `app.deleted: '已删除'` 或复用 `t('app.delete') + ' 成功'`。

---

### 2.5 `src/` 壳层与配置

#### [P3] `App.tsx:190-193` ComfyUI 按钮文案**硬编码中文**，绕过了 i18n

```ts
const label = busy === 'start' ? '启动中…'
  : busy === 'stop' ? '停止中…'
    : busy === 'restart' ? '重启中…'
      : running ? '重启' : '启动';
```
`i18n/zh.ts:98-100` 已经定义了 `comfy.starting` / `comfy.stopping` / `comfy.restarting`，
`comfy:stopped` 也有。这段代码**没用它们**，且 `comfy.stopping` 在 B 类"定义未用"清单里 ——
正是因为这里直接写了字面量。同一文件 `:203`、`:206` 也在写中文默认值 `'找不到 ai-runtime 目录…'`。

**修复**：改成 `t('comfy.starting')` 等。这条同时也是 i18n `§二.6` 的成因。

#### [P3] `App.tsx:401` `t(\`nav.${route}\`)` 是**模板字符串动态 key**，是本文件唯一的动态 t 调用（全仓仅 5 处，全在 App.tsx）

```ts
document.title = `${t('app.name')} · ${t(`nav.${route}`)}`;
```
`route` 来自 `RouteId`，14 个值都在 `zh.ts:50-63` 有定义，**当前是安全的**。
但 `translate()` 缺键时会**回退返回路径本身**（`i18n/index.ts:43`）——
万一将来加了路由却没加 `nav.*` 文案，标签页标题会直接显示 `nav.xyz`，
而 `NAV` 数组里 `labelKey` 是显式字符串（`App.tsx:56-72`），两套来源不同步时这里就会露馅。
**建议**：`document.title` 改用 `NAV.find(n => n.key === route)?.labelKey`（与 `:231` 同源）。

#### [P3] `App.tsx:386-397` 监测轮询 **2 秒一次**，且与 `ReplacementPage` 的 3 秒轮询、`JobsPage` 的 4 秒轮询并存

`refreshMonitor()` 每 2s 打 `/monitor`，而 `/monitor` 在 `host/api/monitor.js` 里会
`await jobsStore().list()` 全量读 jobs.json + `await comfy.health(cfg)`（探测 ComfyUI 端口）。
也就是**每 2 秒全量读一次盘 + 一次跨进程探测**。`visibilitychange` 只在"切回可见"时触发一次 tick，
页面隐藏时只是 `if visible` 跳过 —— 但 `setInterval` 仍在跑，只是不发请求，**可接受**。

真正的浪费在与 `JobsPage.tsx:73` 的 4s 轮询、`ContinuationPanel` 的批次轮询叠加：
三处各自拉各自的数据，`/jobs` 与 `/monitor` 都返回任务统计，**双源**。
`App.tsx:280` 顶栏徽标读 `useJobsStore`、`App.tsx:229` 状态灯读 `uiStore.monitor`，
两套任务数字可能**短暂不一致**（一个 2s 刷新、一个 4s），用户会看到"任务数闪一下"。
**建议**：任务数统一以 `jobsStore` 为准，`monitor` 只取 health/disk；或把 `/monitor` 间隔提到 5s。

#### [P3] `router.tsx:1-20` 文件头注释已过期：写着"只有 6 个顶级路由"，实际 **14 个**

```
 *  2) 只有 6 个顶级路由，自己解析 20 行就够，少一个依赖。
```
`ROUTES`（`router.tsx:21-30`）有 14 项。同一段还写「未知路由回退到 canvas」（`:8`），
而实际 `DEFAULT_ROUTE = 'render'`（`:33`）—— **注释与代码两处不一致**。
这是"过期注释"里最容易被下一任维护者当真的那种。

#### [P3] `router.tsx:91-95` 首次进入把 `#/render` 写进地址栏的条件**永不成立的一半**

```ts
if (!window.location.hash || parseHash(window.location.hash) === DEFAULT_ROUTE) {
  if (window.location.hash !== routeToHash(DEFAULT_ROUTE)) {
    window.history.replaceState(null, '', routeToHash(DEFAULT_ROUTE));
  }
}
```
外层条件第二个分支 `parseHash(...) === DEFAULT_ROUTE` 包含了 `#/h3`、`#/prompt`、`#/director`、
`#/toolbox` 这些**旧路由**（`LEGACY_ROUTES` 映射到默认/其它页）以及**所有未知路由**（也回退到默认）。
于是用户从收藏夹打开 `#/director`（应落到 `previz`）时：`parseHash` 返回 `previz`，
不等于 `render`，不进分支 —— 这条没事；但打开 `#/h3` → `parseHash` 返回 `render` →
进分支 → `replaceState` 把地址**改写成 `#/render`**，用户的书签语义被悄悄改掉。
旧路由本意是"301 回退、地址保留"，这里只对 `h3/prompt` 生效、对 `director/toolbox` 不生效，行为不一致。

**修复**：只在 `!window.location.hash`（完全没 hash）时补 `#/render`，
不要用 `parseHash` 的返回值判断（它已经做过回退，信息丢了）。

#### [P3] `globals.d.ts` 8 行，其中 `window.__DSH_BOOT__` 之类未在 SPA 内使用

`src/globals.d.ts` 只有 8 行（全局声明）。SPA 由 `vite.config.ts` 以固定 `base` 构建、
不读任何 `window.__DSH_BOOT__`（那是 apps/web 外壳的注入约定，与本插件无关）。
本文件属"留着无碍"，但若声明了未使用的全局变量，建议加注释说明来源，避免下一任以为有 boot 注入。

---

## 三、前后端契约差异表

> 方法：抽查 12 组关键类型，逐一对照 `host/api/*.js` 与 `host/services/*.js` 的实际返回构造点。
> ✅ = 一致；⚠️ = 前端有后端无 / 后端有前端没接 / 字段名不一致。

| # | 类型 | 前端定义 | 后端来源 | 结论 |
|---|---|---|---|---|
| 1 | `MetaPayload` | `types.ts:78-85`：profiles / h3Slots / assetTypeLabels / projectCategories / defaultBackend / defaultProfile | `host/api/index.js:129-137` 同名字段 | ✅ **一致**。后端还多给 `nodeTypes` / `assetTypes` / `backends` 三个字段，前端**没接**（无害，但 `assetTypes` 是排序后的数组、`assetTypeLabels` 是字典，前端只用了字典） |
| 2 | `ProjectSummary` | `types.ts:89-98` 8 字段 | `host/api/projects.js:11-22` `projectSummary()` 同 8 字段 | ✅ **逐项一致** |
| 3 | `ProjectPatch` | `types.ts:129-136` 白名单 Pick | `projects.js:33-48` `allowedProjectPatch()` 同名单 | ✅ **一致**（连 script/comic 遗留字段都对上了） |
| 4 | `Job` | `types.ts:279-299`：id/projectId/shotId/backendId/mode/status/prompt/params/remoteId/outputs/error/createdAt/updatedAt | `host/services/job-store.js:44-59` `newJob()` | ✅ **一致**。⚠️ 但 `GET /jobs?fields=list`（`host/api/index.js:869-886`）返回额外 `finishedAt`、`kind` 字段，前端 `Job` 类型**没有**这两个（`ImagePage.tsx:92-99` 靠 `as unknown as` 强转读 `kind`，正是类型缺口的证据） |
| 5 | `JobOutput` | **两份**：`types.ts:269-277`（kind/path/rel/url/bytes + 索引签名）与 `url.ts:14-30`（role/path/rel/archivedRel/assetId/bytes/mime） | `host/services/comfy-client.js:499-505` 造 `{role, path, rel, bytes}`；`host/api/archive.js:59` 补 `{assetId, archivedRel}` | ⚠️ **字段名不一致**：后端给 **`role`**，`types.ts` 写的是 **`kind`**；后端给 `archivedRel`/`assetId`，`types.ts` 没有。见 §2.1 [P3] |
| 6 | `Asset` | `types.ts:322-336`：id/projectId/type/name/originalName?/kind/rel/bytes/tag/note/dataJson/createdAt/updatedAt | `host/services/asset-service.js:76-89` 同名字段 | ✅ **一致**（`originalName` 后端可选，前端已标 `?`） |
| 7 | `MonitorPayload` | `types.ts:355-371`：jobs/h3/blender/disk/updatedAt | `host/api/monitor.js:23-28` 同 5 字段 | ✅ **一致**（`jobs` 内含 `runtimeStats()` 展开的额外键，前端有 `[k:string]:unknown` 兜住） |
| 8 | `HealthPayload` | `types.ts:373-385`：ok/h3/blender/accel? | `host/api/index.js:587-600`：ok/h3/blender/accel/workflows/events | ⚠️ **后端有前端没接**：`workflows`（h3/image 模板是否存在，首装最大坑）与 `events.clients`（在线数）前端两个类型都没声明。`SettingsPage` 想提示"模板缺失"当前**拿不到数据** |
| 9 | `EditProject` | `api/edit.ts:70-78`：id/name/clips/audio/createdAt/updatedAt/lastOutputRel? | `host/services/edit.js` 工程读写 | ✅ 基本一致（`clipCount` 仅在 `EditProjectSummary`，`edit.ts:80-85` 已分开声明） |
| 10 | `EditProbeResult` | `api/edit.ts:30-40`：ok/path/rel/durationSec/bytes/format/video/audio/hasAudio | `host/services/edit.js:120-141` 同名字段构造 | ✅ **逐项一致**（`video`/`audio` 的子字段 `codec/width/height/fps/frames` 与 `sampleRate/channels` 都对上） |
| 11 | `NanfengParams` schema | `client.ts:547-576`：paramCount/groups/params/inert | `host/api/index.js` 的 `/nanfeng/schema` | ✅ 一致（`groups` 里的 `zh`/`dead` 是可选项，前端 `NanfengParams.tsx` 已按可选处理） |
| 12 | `ReplaceMeta` | `client.ts:623-640`：defaults/promptFields/presets/styles/lightings/accelPlans/contextLengths/limits | `host/services/replace.js` `/replace/meta` | ✅ 一致 |
| 13 | `PrevizMeta` / `BlenderRenderResult` | `client.ts:388-405` | `host/services/blender-service.js` | ✅ 一致（`actions` 目录已改为单一真源，前端不硬编码，符合 `client.ts:382-387` 注释） |
| 14 | `storyboardGenerate` 返回 | `client.ts:786-793`：mode/count/global/segments/analysis/raw | `host/api/index.js:576-584` 同 6 字段 + 可选 `badRels` | ⚠️ **后端有前端没接**：`badRels`（无效参考图相对路径清单）前端类型里没有，`StoryboardPage` 因此**无法告诉用户"你选的某张图被后端丢弃了"** —— 与 `runner.ts:82` 的 `blob:` 丢图问题是同一类静默失败 |

### 契约差异小结

- **真差异（要修）**：`JobOutput` 的 `kind` vs `role`（#5）、`HealthPayload.workflows`（#8）、`storyboard.badRels`（#14）。
- **前端多出来的（后端无）**：只有 `JobOutput.archivedRel/assetId` 被 `url.ts` 声明、但 `types.ts` 没声明 ——
  实际后端**是有的**（`archive.js:59`），所以是"前端声明不全"，不是"前端有后端无"。
- **后端多出来的（前端没接）**：`meta.nodeTypes`、`meta.assetTypes`、`meta.backends`、`jobs?fields=list` 的
  `finishedAt`/`kind`、`health.workflows`/`health.events`、`storyboard.badRels`。除 #8/#14 外均为无害冗余。

---

## 四、死代码与重构残留（重点方向 7）

### 4.1 路由三方一致性 —— **实测通过，不是问题**

跑 `node tools/check-routes.mjs`（只读，未改仓库）结果 `EXIT=0`：

| 来源 | 数量 | 清单 |
|---|---|---|
| `router.tsx` ROUTES | 14 | render, replace, storyboard, workshop, assets, vault, projects, edit, breakdown, previz, canvas, image, jobs, settings |
| `App.tsx` NAV | 14 | 同上（顺序完全一致） |
| `App.tsx` RouteView case | 14 | 同上（顺序不同，集合相同） |
| `client.js` entries | 14 | 同上（顺序完全一致） |
| `LEGACY_ROUTES` | 4 | h3→render, prompt→render, director→previz, toolbox→settings |

它还额外校验了：`NAV → RouteView case`（少 case = 白屏）、`前端 client.ts 调用 → 后端路由族`（71 条 vs 155 条）、
以及"后端有前端不用"的 94 条死路由提示。

> **对"是否真能挡住『点了跳到别的页』"的回答**：能，但**只在 CI / 手动跑脚本时**。
> 脚本本身不注册进任何 hooks、`App.tsx` 不调、`host` 不调；`package.json` 里是
> `"check:routes": "node tools/check-routes.mjs"`，需要人主动执行。
> 换言之：**它能挡住的是"提交前有人跑过"的项目**，挡不住"改完直接 `vite build" 的项目。
> 建议接进 `npm run build` 前置，见 §六。

脚本自身的一个**已知盲区**（写在这里以免下次误判）：它比对 `NAV` 用的是正则
`/\{\s*key:\s*'([a-z0-9_-]+)',\s*icon:/g`（`check-routes.mjs:66`），
要求 `key` 与 `icon` **紧邻同行**。当前 14 条都满足；但若将来把 `icon` 改成表达式
或换行书写，正则会**静默漏匹配** → `navKeys` 变少 → 报"NAV 少了 N 项"的**假问题**，
或更糟：恰好漏掉的那项反正也没在 ROUTES 里，于是**假通过**。
建议改为 AST 或至少 `key:\s*'(\w+)'` 的宽松匹配 + 数量断言。

### 4.2 i18n —— **1 个真缺键 + 105 个未用键**

用 node 脚本把 `zh.ts` 的 `export const zh = {...} as const` 真正 eval 成对象后展平（262 个叶子键），
与全仓 `t('...')` 字面量调用（158 个）比对：

| 类别 | 数量 | 结论 |
|---|---|---|
| `zh.ts` 叶子键 | 262 | — |
| 代码里 `t()` 字面量 | 158 | — |
| **用了但没定义** | **1** | `app.download` ← `pages/EditPage.tsx` |
| **定义了但没用** | **105** | 见下 |

**[P3] 唯一缺键**：`app.download` 在 `EditPage.tsx` 用了，`zh.ts:13-46` 的 `app` 段没有 `download`。
`translate()` 缺键会**返回路径本身**（`i18n/index.ts:43`），所以用户会看到按钮上写着 **`app.download`**。
这是"缺键不会崩、但会露出原始 key"的典型。修一行即可。

**105 个未用键的分布**（不是全无价值，多数是"定义在壳层、被组件内硬编码中文顶替了"）：

| 模块 | 未用键数 | 代表 | 说明 |
|---|---|---|---|
| `app.*` | 16 | back/copy/copied/retry/search/filter/yes/no/empty/edit/close/cancel/confirm/short | 通用动作词，组件里都直接写了中文 |
| `h3.*` | 20 | title/subtitle/scan/scanning/fileList/noFiles/rescan + 全部 `film*` 11 个 | **整块 `h3.film` 成片工作台文案无人使用** → 成片工作台 UI 不存在（`h3.film` 在 `zh.ts:213-225` 定义了 13 个键） |
| `comfy.*` | 8 | start/stop/starting/stopping/restarting/statusRunning/statusStopped/statusUnknown | 全部被 `App.tsx:190-193` 的硬编码 `'启动中…'` 顶替 |
| `edit.*` | 7 | title/subtitle + 全部 `empty*` 5 个 | `EditPage` 的 6 个空态文案全被硬编码中文顶替 |
| `jobs.*` | 5 | createdAt/duration/outputs/image/toolbox/breakdown | JobsPage 表格列名写了中文 |
| `errors.*` | 6 | network/http/forbidden/tokenRequired/unknown/notFound | **整块无人使用** —— 错误文案全在 `client.ts:823-833` 的 `describeError()` 里写死中文 |
| `canvas.*` | 4 | title/untitled/loading/nodeCount/edgeCount/placeholder* | 画布层直接写中文 |
| `assets.*` | 4 | deleteConfirm/filterByProject/tag/uploadHint/uploading | 同上 |
| `nav.*` | 3 | assets/collapse/expand/language | `nav.assets` 在 NAV 里用的是 `labelKey: 'nav.assets'`（**动态** `t(item.labelKey)`，我的字面量扫描扫不到，**属误报**）；`nav.collapse/expand` 在 `App.tsx:241-242` 也是 `t('nav.collapse')` 字面量……需人工复核 |
| `theme.*` | 6 | label/density/densityComfort/densityCompact | 密度切换 UI 不存在（`theme.tsx` 有 DensityId 类型但无入口） |
| `projects.*` | 3 | open/current/createdAt | — |
| `units.*` | 7 | second/byte/kb/mb/gb/count/items | 格式化全走 `ui/format.ts` 硬编码 `B/KB/MB` |

> ⚠️ **对 nav.* 的判断需要更正**：`App.tsx:231/300/306` 用的是 `t(item.labelKey)`（变量），
> 我的字面量扫描会把它算成"未用"，但运行时**是用的**。所以 `nav.*` 那 3 条是**误报**，
> 其余模块的未用判断成立（已抽样核对 `h3.film*`、`edit.empty*`、`errors.*` 均确未调用）。
> 这也说明我这份扫描**只能作为线索**，不能作为"可以删"的依据 —— 见 §五 存疑 #1。

### 4.3 未挂载组件 / 未被引用的导出

| 项 | 结论 | 证据 |
|---|---|---|
| `ui/index.ts`（75 行） | **在用**，不是死代码 | `App.tsx:28`、`RenderPage.tsx:33` 等大量 `from '../ui'` |
| `ui/Field.tsx`（58 行） | **在用** | `ui/index.ts:19` 导出；`RenderPage.tsx` 的 `Field label="项目"` 等 8 处直接使用 |
| `ui/Kbd.tsx` | **死代码** | 全仓非 `ui/` 文件引用数 = **0** |
| `ui/CodeBlock.tsx` | **死代码** | 非 `ui/` 引用数 = **0** |
| `ui/Meter.tsx` | **死代码** | 非 `ui/` 引用数 = **0** |
| `ui/Confirm.tsx` | **不存在** | 但 `ProjectsPage`/`JobsPage` 用 `window.confirm()` 原生弹窗（`:79`、`:81`）——说明曾有统一确认组件的计划，未落地 |
| `canvas/nodes/UnknownNode.tsx` | **在用**（兜底） | `nodes/index.ts:74-77` `allNodeTypes` 挂 `__unknown` |
| `canvas/nodeActions.ts`（56 行） | 需核（见存疑） | 被 `CanvasArea.tsx` 引用，但导出的动作是否都接了菜单未逐个核 |
| `ui/theme.tsx` 的 `DensityId` | **半死** | 类型与 `DENSITIES` 都存在（`ui/index.ts:9`），但全仓**没有密度切换 UI**，`zh.ts` 的 `theme.density*` 3 个键也无人用 |

### 4.4 重构残留

| 位置 | 残留 | 判断 |
|---|---|---|
| `client.ts:424`、`:435`、`:441`、`:464`、`:795` | 空注释块 `/* 剧本创作 */`、`/* 漫画工作台 */`、`/* 模特工作台 */`（含一段孤儿 JSDoc「删除形象。形象库只能增、不能删」`client.ts:438-442`）、`/* 漫画出图 */` | **[P3] 确认为已删模块的残留**。`router.tsx:15-19` 明说 script/comic/mw 三个模块已删；`projects.js:44-47` 也留着 `scriptProjectName`/`comicProjectDir` 等遗留字段。这段孤儿 JSDoc 描述的功能（删除形象）**代码不存在**，是最典型的误导性注释 |
| `client.ts:446-448` | `promptMeta/promptCompile/promptFromShot/promptPreview` 4 个方法 | **[P3]** `ROUTES` 里已无 `prompt` 页（`router.tsx:17` 注明"已移到渲染页"），这 4 个方法**全仓无调用者**（需复核：`RenderPage.tsx:157` 调了 `api.promptMeta()` —— 所以 `promptMeta` 在用，另 **3 个是死的**） |
| `canvas/` 注释提到的 `script/comic/mw` 节点 | 已在 26 个注册表里**全部不存在** | ✅ 清理干净，`NODE_TYPE_KEYS`(26) = `nodeRegistry DEFS`(26) = `nodes/index`(26) = `NODE_LABELS`(26)，**四方完全对齐** |
| `portTypes.ts` `NODE_PORTS` | **24 个**，缺 `textAnnotationNode` 与 `groupNode` | **[P3] 合理**：这两个是画布辅助节点（无端口），`validateRegistry()` 的规则只要求"generative 必须有端口"（`nodeRegistry.ts:1034`），二者都不 generative，**不算 bug**。但 `nodeRegistry.ts:9` 的文件头承诺「端口表与 portTypes.NODE_PORTS 的 key 集合必须一致」——**这句注释与实现不符**，应改为"除 structure 类外" |

### 4.5 `validateRegistry()` —— **[P2] 写得很认真，但全仓零调用**

`canvas/nodeRegistry.ts:1012-1077` 是一个 66 行的自检函数，检查 4 类一致性问题
（type key 集合、端口存在性、字段 key 去重、`generative` ↔ `GENERATIVE_NODE_MAP` 双向），
注释写「启动时（开发态）与单测都会调用」。

**实测**：全仓（排除 node_modules）`validateRegistry(` 的匹配只有 **2 处**：
1. `nodeRegistry.ts:1012` —— 定义
2. `runner.ts:34` —— **注释里提到**

**没有任何调用点，仓库里也没有任何 `*.test.*` / `*.spec.*` 文件**（`app-src` 与 `tools/` 都查过），
`package.json` 的 `"test"` 跑的是 `node tools/smoke-api.mjs`（**后端 API 冒烟，不碰前端**）。

结论：这套"自动挡漂移"的护栏**当前处于离线状态**。它校验的那 4 类问题里，
第 4 类（generative 漂移）恰好是注释里写"曾经漂移过 7 个节点"的历史事故 ——
护栏写了但没接，等于事故还会再来一次。
**修复**：在 `main.tsx` 里 `if (import.meta.env.DEV) console.warn(validateRegistry())`，
或接进 `tools/check-routes.mjs`（它已是 build 前的静态检查）。

---

## 五、存疑

> 以下为无法仅凭静态阅读定论、需运行或需后端联调确认的项。**未计入 §二 的级别计数。**

1. **i18n "105 个未用键"的准确性**：我的扫描只匹配 `t('字面量')`，对 `t(item.labelKey)` 这类
   变量调用**扫不到**（全仓 5 处，全在 `App.tsx`）。因此 `nav.*` 的 3 条已确认误报；
   其它模块**未逐条运行时验证**，不能据此删键。要定论需在 `resolveMessage` 上加一行命中计数。
2. **`listJobs({fields:'list'})` 的投影与前端 `Job` 类型的兼容性**：`ImagePage.tsx:83` 用
   `as Job[]` 强转拿投影结果，投影**不含** `prompt`/`params`/`remoteId`（`host/api/index.js:870-886`）。
   `ImagePage` 只读 id/status/outputs，当前安全；但 `ImagePage.tsx:119` 之后若有人读 `job.prompt`
   就是 `undefined` 而非报错。**类型系统在这里是断的，静态无法判断未来会不会被越界使用**。
3. **`canvas/nodeActions.ts`（56 行）的实际接线**：文件被 `CanvasArea` 引用，
   但它的 56 行里导出的动作是否全部挂到了右键菜单 / 调色板，未逐个核对
   （`CanvasArea.tsx` 1757 行，未逐行读完）。可能含未接线的动作。
4. **`CanvasArea.tsx`（1757 行）只做了定向检查**（`nodeTypes` 引用、`onConnectStart`、
   `patchParams`、`runNode` 相关），**未做逐行审查**。该文件是最大单文件，
   若需 P0/P1 级别的完整覆盖，建议单独一轮专审（尤其 `setNodes` 的乐观更新与
   `autosave.schedule` 的调用时机是否成对）。
5. **`Switch`/`Tabs`/`KeyValue`/`IconButton` 等 3~8 个引用点未逐个核**是否有"挂载了但没接 onClick"。
6. **`locale/*.json` 与 `i18n/zh.ts` 的关系**：已确认 `locale/` 是 **DSH 插件元信息**
   （插件名/描述，`package.json` 的 `exports["./locale/*.json"]` 指向它），
   与 `src/i18n/zh.ts` 是**两套无关机制**，`i18n/index.ts:6-9` 的注释是对的。
   但 `locale/en.json` 若存在而 `src/i18n` 只有 zh，会让"插件市场里看着像支持英文"—— 未读 `locale/` 内容确认。
7. **`App.tsx:229` `monitor?.h3?.ok` 的类型**：`HealthState.ok?: boolean | string`（`types.ts:343`），
   `TopBar` 的 `dot()` 用 `v === true ? ok : v ? mid : v===undefined ? default : bad`
   —— 当 `ok` 是字符串（如 `'degraded'`）时显示**黄灯**，这是有意的还是巧合无法从代码判断。

---

## 六、§清理清单

### 立即修（P0/P1，按风险排序）

| # | 文件:行 | 动作 |
|---|---|---|
| 1 | `api/edit.ts:118-154` | 改为复用 `client.ts` 的 `request`（导出它），至少补 `AbortSignal.timeout` + 403 `WRITE_TOKEN_REQUIRED` 重试 |
| 2 | `canvas/runner.ts:390` | `shotInput.refs.images = [...new Set([...images, ...manualImages])].slice(0, 9)` |
| 3 | `pages/ReplacementPage.tsx:654` | 检查 `replaceRun` 返回的 `status`/`ok`，失败时不要 `toast.ok('已开始执行')`；创建与执行分开 try |
| 4 | `pages/PrevizPage.tsx:190-215` | `attachAsReference` 失败改为 `toast.error` + 结果卡片持久「未挂载」徽标 |
| 5 | `components/ContinuationPanel.tsx:88` | `catch` 里存 error state，空态与失败态分开渲染 |
| 6 | `components/LoraPicker.tsx:79` | solve 失败要显示「未校验」并阻止静默提交 |

### 逐条小修（P2）

| # | 文件:行 | 动作 |
|---|---|---|
| 7 | `api/client.ts:264-276` | 非 JSON 判据加 `content-type` / 空 body 区分；重放只对 GET |
| 8 | `api/client.ts:243-246` | `catch (retryErr) { throw retryErr }`；`FORBIDDEN_ORIGIN` 不重试 |
| 9 | `canvas/runner.ts:297,433` | 轮询连续失败 N 次即抛；404 立即抛 `JOB_LOST` |
| 10 | `canvas/runner.ts:257-266` | `RunOptions` 加 `signal`，支持节点删除/切项目时中止 |
| 11 | `canvas/autosave.ts:62-67` | `.catch(()=>{})` + `failedProjects` 持久提示 |
| 12 | `canvas/autosave.ts:78-88` | `flush()` 循环直到 `pending === null && !inFlight` |
| 13 | `api/events.ts:132-140` | `onerror` 主动 close + 统一走自己的退避 |
| 14 | `canvas/nodeRegistry.ts:1012` | 接进 `main.tsx` 开发态 或 `tools/check-routes.mjs` |
| 15 | `pages/RenderPage.tsx:372-383` | `generate` 失败时文案说明「镜头卡已保存但未生成」 |
| 16 | `pages/JobsPage.tsx:78` | 从依赖里删 `jobs` |
| 17 | `pages/SettingsPage.tsx:68` | 加「重新获取令牌」按钮 |
| 18 | `api/types.ts:269` + `api/url.ts:14` | 合并 `JobOutput` 为一份；`role`/`kind` 按后端实际（后端是 **role**）修正 |

### 清理（P3）

| # | 文件:行 | 动作 |
|---|---|---|
| 19 | `i18n/zh.ts:13-46` | 补 `app.download`（`EditPage` 在用） |
| 20 | `App.tsx:190-193` | 改用 `t('comfy.starting'/'stopping'/'restarting')` |
| 21 | `App.tsx:401` | `nav.${route}` 改走 `NAV` 的 `labelKey` |
| 22 | `router.tsx:4` | 注释"只有 6 个顶级路由" → 14 个 |
| 23 | `router.tsx:8` | 注释"回退到 canvas" → `render` |
| 24 | `router.tsx:91-95` | 仅在 `!window.location.hash` 时补默认 hash |
| 25 | `nodeRegistry.ts:9` | 「端口表 key 集合必须一致」→「除 structure 类外一致」 |
| 26 | `canvas/history.ts:139` | `dimensions` 不记历史（返回 `null`） |
| 27 | `client.ts:424,435,441,464,795` | 删空注释块；删 `client.ts:438-442` 孤儿 JSDoc（"删除形象"功能不存在） |
| 28 | `client.ts:446-448` | 删无调用者的 `promptCompile/promptFromShot/promptPreview`（保留 `promptMeta`，`RenderPage.tsx:157` 在用） |
| 29 | `ui/Kbd.tsx`、`ui/CodeBlock.tsx`、`ui/Meter.tsx` | 删除（非 `ui/` 引用数均为 0），或保留但在 `ui/index.ts` 标注"预留" |
| 30 | `ui/theme.tsx` `DensityId`/`DENSITIES` + `zh.ts:80-82` `theme.density*` | 要么做密度切换入口，要么删 |
| 31 | `pages/ProjectsPage.tsx:82` | `t('app.saved')` → 新增 `app.deleted` |
| 32 | `pages/AssetsPage.tsx:90` | 失败明细存 state 可展开 |
| 33 | `tools/check-routes.mjs:66` | NAV 正则放宽（`key:\s*'(\w+)'`）+ 数量断言，避免静默漏匹配 |

### 建议新增的护栏

| # | 动作 |
|---|---|
| 34 | `package.json` 的 `build` 前置 `node tools/check-routes.mjs`（当前只在手动 `check:routes` 时跑） |
| 35 | 给前端加**任意**一个测试文件（目前 `app-src` 与 `tools/` 下 `*.test.*` 数量为 0），
最小可从 `validateRegistry()` + `history.ts` + `portTypes.ts` 三个纯函数模块起 |
| 36 | `i18n` 加"缺键即开发态 throw"（`import.meta.env.DEV` 下），
否则 105 个闲置键会继续增长、`app.download` 这类缺键会继续裸奔 |

---

## 七、计数回填

| 级别 | 数量 | 明细 |
|---|---|---|
| **P0** | **0** | 未发现数据丢失/安全/必崩级别问题（`api/client.ts` 的超时与 403 修复有效；`api/edit.ts` 的问题归 P1，因为它是功能失效不是数据损坏） |
| **P1** | **5** | ① `api/edit.ts:118` 剪辑线丢超时+403 重试 ② `canvas/runner.ts:390` 手填参考图被清空 ③ `ReplacementPage.tsx:654` 执行失败报成功 ④ `PrevizPage.tsx:190` 挂载失败静默 ⑤ `ContinuationPanel.tsx:88` / `LoraPicker.tsx:79` 失败渲染成空态（合并计 1） |
| **P2** | **11** | ①`client.ts:264` 非 JSON 重放（写操作会重复执行）②`client.ts:243` 403 catch 吞掉重试真实错误 ③`runner.ts:297,433` 轮询无失败计数（最长空转 40 分钟）④`runner.ts:257` 节点执行不可取消 ⑤`autosave.ts:62` fire-and-forget 丢错误 ⑥`autosave.ts:87` flush 顺序可丢最后一笔 ⑦`events.ts:132` 原生重连绕过退避 ⑧`LoraPicker.tsx:79` solve 失败仍按已生效渲染 ⑨`RenderPage.tsx:340` 镜头卡已存但生成提交失败无说明 ⑩`JobsPage.tsx:78` deps 含 `jobs` 致轮询被不断推后 ⑪`SettingsPage.tsx:68` 令牌失败无重试入口 |
| **P3** | **13** | ①`client.ts:314` token() 语义模糊 ②`types.ts:269`+`url.ts:14` 两份不兼容 `JobOutput` ③`history.ts:139` dimensions 污染撤销栈 ④`history.ts:24` 撤销深度 12 偏少无依据 ⑤`NanfengParams.tsx` 217 面板无 memo 全量重渲 ⑥`AssetsPage.tsx:90` 上传失败明细被丢弃 ⑦`ProjectsPage.tsx:82` 删除成功却提示「已保存」⑧`App.tsx:190` ComfyUI 文案硬编码中文 ⑨`App.tsx:401` `nav.${route}` 动态 key ⑩`App.tsx:386` 2s monitor 轮询与多源任务数并存的闪烁 ⑪`router.tsx:4,8` 头注释「6 个路由」/「回退 canvas」均与代码不符 ⑫`router.tsx:91` 旧路由 hash 被 replaceState 改写 ⑬`globals.d.ts:8` 未使用全局声明无来源注释 |

> 计数口径：以上数字 = §二 中 `#### [Px]` 标题的实际条数（已逐条枚举核对）。
> §四/§六 里的条目（死代码、i18n 未用键、`validateRegistry` 零调用、`check-routes` 正则盲区、
> 清理建议 19~36）属于「清理清单」与「护栏建议」，**不单独计入 P0~P3**，
> 其中 `validateRegistry` 零调用已在 §四.5 单列为 P2 论点、`JobOutput` 重复已在 §二 计为 P3。

**审计边界声明**：`CanvasArea.tsx`（1757 行）、`CanvasAgentPanel.tsx`（225 行）、
`nodes/*.tsx` 共 9 个文件（约 1400 行）**未逐行审**，只做了定向检查（见 §五 #3/#4）。
其余文件均通读或按关键路径精读。若需 100% 覆盖，建议下一轮专审画布目录。