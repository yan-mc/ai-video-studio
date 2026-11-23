# API 与入口层审计报告

> **范围**：`dsh-jiuzhang-studio` 的 Host 入口层 + REST 层 + 前端 client.js。
> 逐行通读 9 个：`host/index.js`(297) `host/runtime.js`(38) `host/config.js`(327) `host/config-reader.js`(205)
> `host/security.js`(218) `host/api/http.js`(181) `host/api/monitor.js`(37) `host/api/projects.js`(68) `host/api/events.js`(117)。
> 定向抽查 6 个：`host/api/index.js`(2297，按路由段抽样通读) `host/api/shots.js`(153) `host/api/prompt-compile.js`(232)
> `host/api/replace-tasks.js`(138) `host/api/archive.js`(132) `host/tools.js`(938，仅 schema 段)。
> 未覆盖：`client.js` 与 `app-src/src/router.tsx` 的逐行比对（仅做符号级一致性抽取）、`host/skills.js`、`host/static.js`
> 的完整通读（仅抽查安全边界）。
> 基线声明：`node --check` / `tsc --noEmit` / `smoke-api 207` 只证明「不崩」，本报告全部结论来自静态阅读 + 只读探测。

## 一、概览（级别计数表）

| 级别 | 含义 | 本报告计数 |
|---|---|---|
| P0 | 数据丢失 / 安全 / 必崩 | **0** |
| P1 | 功能错误 / 静默撒谎 | **6** |
| P2 | 健壮性 / 性能 / 可维护性 | **16** |
| P3 | 清理项（死代码 / 陈旧注释） | **16** |

> **本节计数已被下文覆盖。** 前半段（本表初稿时只写完 2.1）曾记 P0=1，那条 P0 实际是
> `security.js:57` 的 `/^127\./` Host 绕过，**现场复核该处已按严格四段 IPv4 修好**（`security.js:57-68`），
> 故 P0 归零；真正未修的同源缺陷转移到了 `config.js:255` 的 `validateComfyUrl`（记 P1）。
> **最终计数以 §六 表格为准**（P0=0 / P1=6 / P2=16 / P3=16）。

## 二、逐文件审查

### 2.1 `host/index.js` —— 插件入口 / 服务装配

- **[P1] host/index.js:180-187 —— `runGenerate` 闭包把启动期 `cfg` 快照塞进了视频/图像生成器，与同文 140-152 行自述的「服务只准持 getCfg」规则**自相矛盾**。**
  证据：
  ```js
  // host/index.js:123
  const cfg = loadConfig();                      // ← 启动快照
  // host/index.js:180
  runH3Local({ workflow, job: running, shot: ..., cfg, onSubmitted: ... })
  // host/index.js:186
  runH3ImageLocal({ ..., cfg, onSubmitted: ... })
  ```
  而同一文件 139-152 行的注释明确写着「现在统一传 `getCfg: loadConfig`，服务内部每次现取；同时保留 `cfg` 字段兼容尚未改造的服务」。
  影响面：用户 `POST /config` 改 `dataDir` / `comfyUrl` / `comfyInputDir` 后，画布 AI 助手的 `generate_image` / `generate_video`
  仍把**旧配置**传给生成器（生成器用 `cfg.comfyUrl` 提交、用 `cfg.dataDir` 落盘），产物落到旧目录，
  与 `job-store`（走 `loadConfig()`）记录的 `projectId` 路径分裂 —— 正是 config-reader.js 文件头描述的「配置分裂脑」原症状。
  修复建议：`runGenerate` 内改为 `runH3Local({ ..., getCfg, ... })` 或调用点写 `cfg: loadConfig()`；同时对
  `services/generator.js` 的 `runH3Local/runH3ImageLocal` 形参改造成 `{ getCfg = loadConfig }` 默认参数，让
  `findConfigSnapshotReads` 的「合规 2」覆盖它（见 2.4 节）。

- **[P2] host/index.js:287-290 —— 启动日志读的是同一个 `cfg` 快照（无害但不一致），且 `runtimeStats()` 在首个任务前恒为空。**
  证据：
  ```js
  ctx.logger?.info?.(`[jiuzhang] 已挂载：${API_PREFIX} ... 后端=${cfg.defaultBackend} 并发=${cfg.maxConcurrentLocal} ...`)
  ```
  `cfg` 是 `apply()` 期的快照 —— 此处只用于打日志，静态无害；但同文件已经把 `cfg` 留着跨闭包使用，
  正是上一条 P1 的温床。建议：删除 `index.js:123` 的 `const cfg`，改为在 130 行直接 `initRuntime({ cfg: loadConfig(), ... })`，
  日志处写 `loadConfig().defaultBackend`，从根上消灭可变快照引用。

- **[P2] host/index.js:108-118 `loadImageWorkflowForGen` —— 模块级 `_imgWf` 缓存永远不失效。**
  证据：
  ```js
  let _imgWf = null;
  function loadImageWorkflowForGen() {
    if (_imgWf) return _imgWf;
    try { const wf = readWorkflowCached('image', loadConfig()); ... _imgWf = wf; return _imgWf; } catch { return null; }
  }
  ```
  这里**双重缓存**：`readWorkflowCached` 自己有 `resetWorkflowCache()` 订阅（`config.js:315-327` 已 wire），
  但 `_imgWf` 这一层不订阅任何失效信号。用户改 `workflowDir` 后，画布「生成图像」仍用旧工作流；
  且 113 行 `loadConfig()` 传参形态与 `readWorkflowCached` 的「现取」契约重复。
  修复建议：删掉 `_imgWf`，每次直接 `return readWorkflowCached('image', loadConfig())`（该函数本身有缓存），
  或注册 `onConfigChange(() => { _imgWf = null; })`。

- **[已撤销 · 误报] host/index.js:98-105 —— 「try/catch 抓不到 async rejection」不成立。**
  复核证据：`host/skills.js:199` `export function registerSkillProvider(ctx, root)` **是同步函数**
  （无 `async` 关键字；文件头 190-193 行还明确写了"必须**同步**调用（Cordis 的 registerProvider 要求），
  因此这里不做任何异步 IO"）。同步抛错会被 `index.js:99-104` 的 `try/catch` 正常捕获，
  注释里"注册失败不能影响插件加载"的承诺**成立**。
  唯一残留的弱疑点（降级为存疑，非缺陷）：`return registerSkillProvider(...)` 的返回值被直接当作
  `ctx.effect` 的 dispose 函数，若 `skills.registerProvider()` 返回非函数，Cordis 卸载期会报错 ——
  但 `registerProvider` 的契约本身是返回 dispose，属外部 API 承诺，不在本仓库可控范围。见 §四 存疑 S-2。

### 2.2 `host/config.js` —— 配置单一来源

- **[P1] host/config.js:174-179 + 188-196 —— `dataDir` 的「存在性回落」会被任何一次无关的 `saveConfig` **永久写死**，用户的原始配置被静默覆盖。**
  证据：
  ```js
  // loadConfig()
  const configuredDir = merged.dataDir;
  if (configuredDir && path.resolve(configuredDir) !== path.resolve(DEFAULT_DATA_DIR)) {
    let ok = false;
    try { ok = fs.existsSync(configuredDir) && fs.statSync(configuredDir).isDirectory(); } catch { ok = false; }
    if (!ok) merged.dataDir = DEFAULT_DATA_DIR;      // ← 只在内存里回落
  }
  cache = merged;
  // saveConfig()
  const current = loadConfig();                       // ← 已经是回落后的值
  const next = { ...current, ...pick(patch, WRITABLE_CONFIG_KEYS) };
  fs.renameSync(tmp, CONFIG_FILE);                    // ← 回落值被写进 config.json
  ```
  触发链：用户的 `dataDir` 在网络盘 / 未挂载的外置盘（`fs.existsSync` 会返回 false，不是抛错）→ 本进程内
  `loadConfig()` 回落 `<插件根>/data` → 用户在前端只是改了个**主题**（`POST /config {theme}`）→
  `current` 带着回落后的 `dataDir` 被整体写盘 → **原路径永久丢失**。重启后即使盘已挂回也不会恢复，
  因为配置文件里已经是新值；旧目录里的项目/素材从此「消失」（`config-reader.js` 文件头描述的
  「配置分裂脑」的**根因被这个回落逻辑重新引入**，且升级成了持久化形态）。
  修复建议：回落只在内存里生效，且 `saveConfig` 必须只写**用户显式 patch 过的键**
  （`const next = { ...current, ...sanitizeConfigPatch(patch) }` 之前先删回落标记）；
  或给 `merged` 加内部字段 `_dataDirFallback: true`，`saveConfig` 见到它时保持 `current.dataDir`
  不动。注意 `index.js:271` 的 `fs.mkdirSync(c.dataDir, { recursive: true })` 会顺手在回落目录建目录，
  让「数据空了」看起来像「新装」。

- **[P1 · 安全] host/config.js:239-263 `validateComfyUrl` 仍用 `/^127\./` 判本机 —— **是**可利用的 SSRF 放宽，结论：该判定必须改为严格四段（与 `security.js:57` 共用同一实现）。**
  证据（两处**同一类缺陷、一处已修一处未修**）：
  ```js
  // config.js:252-255
  const isLoopback = host === 'localhost' || host === '::1' || host === '0.0.0.0' || /^127\./.test(host);
  // security.js:57（已按 P0 修）
  const IPV4_LOOPBACK = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  ```
  **判定「是」的理由（三条，逐条可验）**：
  1. **正则只认前缀**：`/^127\./.test('127.0.0.1.evil.com') === true`，`'127.evil.com'` 同样 true。
     攻击者注册 `127.0.0.1.evil.com` 并把 A 记录指向任意内网地址（含 `169.254.169.254` 云元数据），
     `comfyUrl = 'http://127.0.0.1.evil.com:8188'` 可**通过校验合法落盘**；后端随后用它对
     `/system_stats`、`/prompt`、`/upload/image` 主动发请求（`comfy-client.js` 全走 `cfg.comfyUrl`），
     SSRF 成立。`127.0.0.1.evil.com` 不是 loopback（浏览器/Node 的 DNS 都按域名解析），
     与 `security.js:46-56` 描述的 `Host:` 绕过是**同一机理**，只是受害者从「请求入口」换成了「配置值出口」。
  2. **额外放宽**：`host === '0.0.0.0'` 被显式放行，而 `security.js:62-63` 不放行 —— 两处 loopback
     定义不同本身即缺陷；`0.0.0.0` 语义是「任意地址」而非本机，不应出现在白名单。
  3. **可达性不是理论**：`POST /config` 需过 `guard()`（loopback Host + 同源 + 写 token），外网直连打不进；
     但 `api/index.js:1905-1926` 自己记录了 `/file` 与 `/assets/item` 的 **SVG 同源存储型 XSS**（"攻击链闭合"）——
     页面内脚本可 `GET /token` 拿写 token 再 `POST /config`。即 XSS 一步就把这条 SSRF 从「纵深防御」
     变成「可利用出口」。且 `guard()` 只保证**请求来源**是本机，不保证 **comfyUrl 指向**是本机。
  修复建议：把判定抽成 `security.js` 的 `isLoopbackHostname(hostname)`（严格 IPv4 四段 + `localhost` + `::1`，
  去掉 `0.0.0.0`），`config.js` 直接 import 它；两处不得各写一份。

- **[P2] host/config.js:156 —— `comfyUrl` 的校验**只在写路径**（`sanitizeConfigPatch`）上，读路径完全不校验。**
  证据：`const merged = { ...DEFAULTS, ...pick(raw, WRITABLE_CONFIG_KEYS) };` —— `pick` 只做键过滤，
  不调用 `validateComfyUrl`。所以手改 `data/config.json`、或任何非 `POST /config` 的落盘途径
  （含上一条 P1 的回落值）都能把任意 URL 送进 `cfg.comfyUrl`，绕过唯一的 SSRF 关口。
  修复建议：在 `loadConfig` 合并后对 `merged.comfyUrl` 调一次 `validateComfyUrl`（失败则回落
  `DEFAULTS.comfyUrl` 并 warn），使「读入的配置一定合法」成为不变量，而不是只靠一个端点把守。

- **[P3] host/config.js:97-100 `DEPRECATED_CONFIG_KEYS` —— 常量是真的「不会被捞回」，但**拦住它的不是这个常量**，它是一份纯文档（零引用）。**
  核实（grep 全仓库 10 处命中，除定义处外全是注释/文档）：
  · `loadConfig:156` 用 `pick(raw, WRITABLE_CONFIG_KEYS)` —— 白名单外键天然进不来，**这才是拦截机制**；
  · `saveConfig:190` 同样用 `pick(patch, WRITABLE_CONFIG_KEYS)`，`current` 来自 `loadConfig`（已不含废弃键）。
  所以注释里宣称的「目的 1：存量 config.json 里残留的值不会被重新捞回运行时配置」**确实成立**，
  但成立原因是 `WRITABLE_CONFIG_KEYS` 白名单，与 `DEPRECATED_CONFIG_KEYS` 无因果关系 ——
  删掉这个常量，行为完全不变。结论：不是缺陷，但「声明式记录」的定位要在注释里说清，
  否则下一个人会以为改这里能改变行为（例如把某个键加进 `DEPRECATED_CONFIG_KEYS` 期待它被拦住——
  实际不会，只有从 `WRITABLE_CONFIG_KEYS` 里删掉才有用）。

- **[P3] host/config.js:63 `ffmpegDir` 被写进 `config.json`，但**永远不会被读回** —— 一个「改了不生效」的诱饵字段。**
  证据：`DEFAULTS` 里只有 `ffmpegDir` 不在 `WRITABLE_CONFIG_KEYS`（逐项核对 18 个默认键）；
  `saveConfig:190` 的 `next = { ...current, ... }` 是**全量**写盘，于是 `config.json` 里会出现
  `"ffmpegDir": "F:\\AI视频\\tools\\ffmpeg"`；而 `loadConfig:156` 的 `pick` 把它过滤掉，
  运行时永远用 `DEFAULTS` 现算（`path.resolve(import.meta.dirname,'..','..','tools','ffmpeg')`）。
  影响：用户照文件改 `ffmpegDir` 换 ffmpeg 版本 → **完全不生效且无任何提示**（与 171-172 行注释
  「只有 dataDir 会从文件读入」自洽，但注释没提醒「落盘了却不读」这个视觉陷阱）。
  修复建议：`saveConfig` 改为只写白名单键（`pick(next, WRITABLE_CONFIG_KEYS)`），或把 `ffmpegDir`
  从落盘对象里剔除，保证「文件里出现的键 == 可改的键」。

### 2.3 `host/config-reader.js` —— 配置读取约定（**含扫描器自身的实测**）

- **[P1] host/config-reader.js:125-205 `findConfigSnapshotReads` 自身**有 3 处漏报 + 3 处误报**，它把 smoke-api:2847 这条守卫变成了「无效守卫」。**
  实测方法（只读，不改插件）：新建 `_audit_run/_probe_scanner.mjs` / `_probe_scanner2.mjs`，
  直接 `import { findConfigSnapshotReads } from '../dsh-jiuzhang-studio/host/config-reader.js'`，
  喂 17 个手工构造的最小用例，逐一比对「应报/不应报」。结果（原文摘录）：
  ```
  A 工厂闭包捕获(应报)              → 报 ✅      B 工厂+默认参数(不应报)      → 未报 ✅
  E options 包一层(应报)            → 报 ✅      G 块注释里的 cfg(不应报)     → 未报 ✅
  J 多行 arrow 表达式体(合规2)      → 报 ❌误报  K 双引号含花括号(合规2)     → 报 ❌误报
  L 正则字面量含花括号(合规2)       → 报 ❌误报  M 同行 loadConfig()+快照读   → 未报 ❌漏报
  P makeSvc({cfg})(应报)            → 未报 ❌    Q 工厂签名跨行(应报)         → 未报 ❌漏报
  ```
  三个独立缺陷，逐个给代码依据：
  1. **安全区配平不处理字符串里的 `{`（误报 3/3 命中 J/K/L）**：`:165` 只剥了 `//` 注释和
     **单引号**/模板字符串（`replace(/'[^']*'/g,'')`），**没剥双引号与正则字面量**。
     `K` 用例里 `const s = "{"` 让 `depth` 多 +1，整个函数体永远配不平 → `safeRanges` 为空 →
     合规 2 的函数体内每一行都被判违规。真实后果：服务层里只要有一段含 `"{"` 的字符串
     （JSON 模板、正则、提示词字面量都常见），该文件所有 `cfg.dataDir` 读取即被**误报**，
     `smoke-api` 直接失败 —— 逼开发者去改本来正确的代码。
  2. **`isFactoryClosure` 只看单行（漏报 2/2 命中 P/Q）**：`:155`
     `create\w+\s*\(\s*\{[^}]*\bcfg\b` 要求「`create` 前缀 + 同一行里有 `{...cfg}`」。
     于是 `makeSvc({ cfg })`（不用 `create` 前缀）与
     `createSvc({\n cfg,\n})`（签名跨行）**都不被登记为工厂**，同时也不满足 `isDefaulted`/
     `isExplicitParam`，落进「两个条件都不满足 → `return`」的分支 `:157` ——
     **既不登记安全区、也不检查违规**，等于该函数体完全不被扫描。
     这是最严重的一类：改写签名换行就能让守卫静默失效。
  3. **`:199` 的 `liveRead` 只要**任一**片段命中就整行放行（漏报 M）**：
     `const p = path.join(cfg.dataDir, loadConfig().workflowDir)` —— 一行里同时存在
     「合规的 `loadConfig()`」和「违规的 `cfg.dataDir` 闭包读」，因为 `liveRead.test()` 为真就 `return`，
     违规被放过。判据应该是「**该 `cfg.` 引用本身**是否为现取」，而不是「本行有没有现取」。
  影响定级 P1 而非 P3：这条扫描器是 `config-reader.js` 文件头（`:36-42`）宣称的**唯一自动化守卫**，
  smoke-api 的「配置分裂脑」断言全靠它。它给出 207/207 全绿的假象时，`index.js:180/186/2399`
  这类真实快照读**恰好都在 `host/index.js` 与 `host/api/`，而 smoke 只扫 `host/services/`**
  （`smoke-api.mjs:2849`）—— 守卫的覆盖范围与缺陷的实际分布**不重叠**。两件事叠加，
  等于「有守卫」这件事本身是错的。修复建议：改用真正的源码解析（`node:module` + 简易
  tokenizer 或直接引入 `@babel/parser` 只做 AST 层 `cfg` 标识符溯源）；短期至少：
  剥双引号/正则、工厂判定改为「签名括号内出现 `cfg` 且非 `cfg = loadConfig()`」、
  `liveRead` 改为按 `cfg.` 出现位置的上下文判定。

- **[P2] host/config-reader.js:89-95 `wireServiceInvalidation(hooks)` 是**零调用**的死导出，而它描述的能力（服务实例内部派生状态在配置变更后重建）**确实缺失**。**
  核实：全仓库 grep 仅 `:89` 定义处一处命中（`CHANGELOG.md` / `docs/REFACTOR-V3.md` 之外无调用）。
  后果不是「少了个工具函数」，而是：`host/index.js:154-220` 创建的 6 个服务
  （h3/post/edit/assets/vault/extras）**没有任何一个**注册 `onConfigChange`，
  它们内部的派生状态（缓存的目录句柄、素材索引、字体列表等）在 `POST /config` 后不重建 ——
  这正是 `config.js:315-327` `wireConfigInvalidation` 注释里说的「这里负责服务实例内部」
  那一半，**目前完全没接**。修复建议：让 `index.js` 在 `attachControllers` 之后显式调用
  `wireServiceInvalidation([{name:'assets', reset: () => assets.reset?.()}, ...])`，
  或删掉该导出并在文件头承认「服务实例不做失效，只保证每次现取路径」。

- **[P3] host/config-reader.js:74-78 `dirResolver` 同样是零调用死导出（3 处命中全是注释/自身定义）。**
  核实：`:67`（用法注释）、`:74`（定义）—— 无 import、无调用。功能上它只是
  `path.join(C().dataDir, ...)` 的糖，服务层都直接写 `C().dataDir`，属于纯清理项。
  注意与上一条区分：`dirResolver` 删掉无损失；`wireServiceInvalidation` 删掉会**掩盖**
  一个真实缺口（应保留并接上）。

- **[P2] host/config-reader.js:1-43 文件头把「服务只允许持有 `getCfg`」写成已成事实，但至少有 **4 个服务/执行器**仍在收 `cfg` 快照形参。**
  证据（grep `host/services/`）：`generator.js:200/555/609` 的
  `runH3Local/runH3ImageLocal/runH3Nanfeng` 三兄弟形参都是 `cfg = loadConfig()`（合规 2 形态），
  但**调用点**全在传实参快照：`index.js:180/186`（P1）、`api/index.js:2376/2389/2397`、
  `tools.js:442`。默认参数只有在「不传」时才现取 —— 一旦所有调用点都传，
  「合规 2」就退化成「永久快照」。这是**判据设计**的盲区：`findConfigSnapshotReads` 只看被调函数
  签名（`:143` `cfg = loadConfig()`），**完全不看调用点是否传了 `cfg`**。
  修复建议：扫描器增加第二类检查 —— 对形参含 `cfg` 的函数导出名做反向 grep，
  若存在 `cfg: <非 loadConfig()>` 的调用实参则报违规。

- **[P2] host/config-reader.js:200 `if (/create\w+Service\s*\(\s*\{/.test(code)) return;` —— 这条豁免**无任何前提**，任何一行出现该字样就整行不查。**
  证据：`const x = createFooService({ cfg }); path.join(cfg.dataDir,'x')` 若写在同一行会被放行；
  且该正则只匹配 `create\w+Service`，与 `:155` 的 `create\w+` 两个集合不一致（后者更宽）。
  属上一条 P1 的第 4 个漏洞点，并入修复；此处单列是因为它与「工厂签名本身」的注释意图
  （`:200` 注释写「工厂签名本身」）不符 —— 它拦的是**调用**而非**签名**，签名从来不是违规对象。

### 2.4 `host/tools.js` —— 14 个 Agent 工具 schema ↔ 实现 ↔ REST 一致性

核对方法：逐个工具读 schema（`tools.js:99-880`）、实现闭包、对应 REST 路由（`api/index.js`）、
底层服务四处，比对**参数名 / 枚举值 / 必填项 / 形状**。总表：

| 工具 | schema↔实现 | 与 REST | 结论 |
|---|---|---|---|
| studio_meta | ✅ | ✅ | 无问题 |
| studio_config | ✅ | ✅ `/config` | 正常 |
| studio_project | ✅ | ✅ `/projects` | P3 无分页 |
| studio_shot | ✅ | ✅ `/projects/:id/shots` | 正常 |
| studio_prompt | ✅ | ✅ `/prompt/*` | 无问题 |
| studio_generate | ⚠️ | ⚠️ | **P1 preset 名不校验**；P2 缺 sizeId |
| studio_jobs | ❌ | ✅ 有 retry | **P2 缺 retry** |
| studio_h3_workshop | ✅ | ✅ | 无问题 |
| studio_blender | ✅ | ✅ | P3 jobId 用 shotId |
| studio_post | ⚠️ | ⚠️ | P2 qc 的 path 死分支 |
| studio_edit | ✅ | ✅ `/edit/*` | 正常 |
| studio_toolbox | ✅ | ✅ | P3 枚举未分域 |
| studio_image | ✅ | ✅ | 无问题 |
| studio_storyboard | ✅ | ✅ | 无问题 |

- **[P1] host/tools.js:340-351 + bridge/vendors/nanfeng/presets.js:319-321 —— `studio_generate` 的 `preset` 拼错时被**静默忽略**，跑一次用默认参数的生成，零报错。**
  证据链：
  ```js
  // tools.js:351 —— schema 只声明 type:'string'，无 enum
  preset: { type: 'string' },
  // tools.js:395 —— 原样塞进 job.params
  ...(args.preset ? { nanfengPreset: args.preset } : {}),
  // presets.js:319-321 —— 查不到就返回空参数层
  export function builtinPreset(id) {
    const p = BUILTIN_PRESETS[id];
    if (!p) return { params: {}, meta: null };     // ← 静默空层
  // presets.js:383-386 —— 空层照常 push
  for (const id of presetIds) { const { params } = builtinPreset(id); layers.push(params); }
  ```
  `BUILTIN_PRESETS` 合法 id 共 7 个（`presets.js:35/52/74/95/121/147/174`：`draft, standard,
  quality, quality-preview, continuation, continuation-quality, low-vram`），与工具描述
  `tools.js:340-341` 列的**完全一致**——描述对，**校验缺**。`resolvePresetLayers:384` 只取
  `.params` 不取 `.meta`，拼错（`'qulity'`/`'high'`）＝空层＝参数与意图无关，
  而任务状态是 `completed`。这与 `api/index.js:2400-2414`（未知 backend 静默走 mock）、
  `tools.js:374-376`（同）是**同一缺陷模式的第三个未被堵上的入口**。
  修复：`presets.js:384` 改 `const { params, meta } = builtinPreset(id); if (!meta) throw new Error(\`PRESET_NOT_FOUND: ${id}\`);`
  （`PRESET_NOT_FOUND` 已在 `api/index.js:2299` 映射为 404），并给 `tools.js:351` 补 `enum`。

- **[P2] host/tools.js:452-479 —— `studio_jobs` 的 `action` 枚举缺 `retry`，而描述与 REST 都承诺了。**
  证据：schema `enum: ['list','get','cancel']`（`:456`），实现三分支，末尾 `throw UNKNOWN_ACTION`；
  但工具描述 `:452` 写「任务查询 / 取消 / 重试」，REST `api/index.js:914-939` 有完整 retry
  （取 shot → 新建 job → `runAndArchive`）。影响：临时失败（ComfyUI 重启/OOM）时模型无法重试，
  只能让用户去网页点。修复：补 `retry` 分支，把 `api/index.js:927-938` 提成共享函数供两边调用。

- **[P2] host/tools.js:556-572 + 586 —— `studio_post` 的 `qc` 分支里 `rest.path` 是**永不成立**的死分支；REST 却接受 `path`。**
  证据：schema `:557` 只有 `input`、**无 `path`**，且 `additionalProperties: false`（`:572`）→
  `:586` 的 `rest.input ?? rest.path` 中 `rest.path` 恒为 `undefined`；
  而 REST `api/index.js:1994` 是 `ctx.post.qc(body.path ?? body.input)`，两套入参名。
  属「工具 / 描述 / REST 三方漂移」的残留（该 `??` 说明作者知道差异但没在 schema 补）。
  修复：schema 补 `path`，或删死分支统一成 `input`。

- **[P2] host/tools.js:344-358 + 432-439 —— `studio_generate` 没有 `sizeId`，与 `studio_image` / REST 不对齐。**
  证据：h3-image 分支 `shot: shotWithCards` 直接用镜头卡，无尺寸覆盖入口；
  而同族 `studio_image`（`:798-865`）**有** `sizeId`。REST `/image/generate` 也有独立 sizeId。
  影响：Agent 用 `studio_generate` 出图无法指定尺寸（只能吃镜头卡的值）。
  修复：schema 补 `sizeId`，h3-image 分支覆盖 `shot.imageSizeId`。

- **[P3] host/tools.js:545 —— `studio_blender` 的 `render` 把 `jobId` 恒传成 `shotId`，`a.shot` 形态下退化成字面量 `'shot'`。**
  证据：`renderControl({ mode, spec, jobId: String(a.shotId || 'shot') })`；
  而 `:527` 声明支持 `shot` 直给（此时 `a.shotId` 必空）→ 多个不同镜头落同一 `jobId` 目录，产物互相覆盖。
  修复：`jobId: String(a.shotId || a.shot?.id || \`shot_${Date.now()}\`)`。

- **[P3] host/tools.js:717-725 `studio_toolbox` 的 `action` 是**全局 6 值枚举**，7 个 domain 各只支持 2-3 个，描述里没列可用组合。**
  证据：schema `enum: ['list','upsert','delete','scan','preview','clean']`；`batchProgress` 只支持 `list`
  并在 `:779-781` 正确抛错（这条**已修好**，记录以免被「优化」掉）。模型只能靠报错试出
  domain→action 对应关系。修复：描述补一张 domain→action 表。

- **[P3] host/tools.js:756 —— `orphans` 分支在判断 `action` **之前**就 `await z.assets.list({})`，非法 action 也会先全量扫素材。**
  证据：`:756` 的 `const all = await z.assets.list({});` 在 `:757` 的 `if (a.action === 'list')` 之前。
  应把 `list()` 挪进两个合法分支内。性能/体验问题。

### 2.5 `host/api/index.js` —— 路由遮蔽 / 错误码映射 / `/file`

结构：2297 行单一 `function handleApi(req,res)`，`if (method === X && route === Y) return ...;`
顺序瀑布。精确路由 **109 处** `route === '...'`，参数化 **11 处** `route.match(...)` +
**3 处** `route.startsWith(...)`。7 个已拆模块（`http/shots/projects/prompt-compile/monitor/replace-tasks/archive/events`）
只需看 import 边界：`index.js:36-42` 从它们导入 17 个符号，**均无反向依赖**（拆模块只 import 了
`security.js`/`store/*`/`services/*`，没有 import `api/index.js`），分层是干净的 —— 这一项无问题。

- **[P2] host/api/index.js:900-911 vs 1693-1696 —— `/jobs/:id` 的匹配器必须靠**硬编码字符串** `!== 'batch-progress'` 排除，这是「先匹配器后精确路由」的唯一现存实例，且**结构上仍会复发**。**
  证据：
  ```js
  // :900 —— 小时级就执行的匹配器
  const mj = req.method === 'GET' ? route.match(/^\/jobs\/([^/]+)$/) : null;
  if (mj && mj[1] !== 'batch-progress') {                      // ← 手写的例外名单
    const jobId = safeId(decodeURIComponent(mj[1]), /^job_[A-Za-z0-9]+$/);   // 非 job_ 前缀即 400
  // :1693 —— 真正处理在 793 行之后
  if (req.method === 'GET' && route === '/jobs/batch-progress') { ... }
  ```
  当前是**已修复**状态（`:901-905` 注释记录了冒烟测不到的教训），但隐患没消除：任何**新增**的
  `GET /jobs/<非 job_ 前缀>` 路由（如 `/jobs/stats`、`/jobs/queue`）只要写在 1693 附近，
  都会被 900 行吃掉并返回 `INVALID_ID` 400。逐个核对了全部 11 处 `route.match` 与 3 处 `startsWith`，
  **没有发现第二处真实遮蔽**（见下表），但**风险模式相同**。
  修复建议：把参数化匹配器**下沉到精确路由之后**（或先建路由表再匹配），并把
  `safeId` 的失败改为「不匹配则继续往下走」而非抛错，从结构上消灭例外名单。

- **[P3] host/api/index.js:2221-2230 —— `/replace/tasks/*` 用 `startsWith` + `split('/')[0]`，深层路径被**静默截断**，与 DELETE 分支的行为不一致。**
  证据：
  ```js
  // DELETE :2222 —— 整段 slice 后 safeId，'/a/b' 会抛 INVALID_ID → 400
  const id = safeId(decodeURIComponent(route.slice('/replace/tasks/'.length)));
  // GET :2229-2230 —— 只取第一段，'/a/b' 静默当作 id='a' → 200 或 404
  const rest = route.slice('/replace/tasks/'.length);
  const id = safeId(decodeURIComponent(rest.split('/')[0] ?? ''));
  ```
  同一个前缀两条方法、两种语义：`DELETE /replace/tasks/a/b` → 400，`GET /replace/tasks/a/b` → 当成 `a`。
  `POST /replace/run/a/b`（`:2239`）又是第三种（整段 → 400）。属一致性问题，
  当前前端不会发深层路径，故 P3。修复：三处统一用 `^\/replace\/(tasks|run)\/([^/]+)$` 匹配。

- **[P2] host/api/index.js:2282-2327 —— `CODE_STATUS` 只有 22 个键，仓库里**实际抛出 40+ 个错误码**，未被收录的都落 500，而 message 回退正则只兜 `_REQUIRED$` 结尾这一种形态，兜不住带详情的写法。**
  逐个核实漏收的高频码（在 `host/` 下 grep 到抛出点，但 `CODE_STATUS` 无此键）：
  | 错误码 | 抛出点 | 应有状态 | 实际 |
  |---|---|---|---|
  | `ASSET_NOT_FOUND` | `asset-service.js:164/173`、`blender-service.js:886` | 404 | **500** |
  | `UNSUPPORTED_FILE_TYPE` | `asset-service.js:66/109` | 400/415 | **500** |
  | `TOO_MANY_REFS` | `replace-tasks.js:45` | 400 | **500** |
  | `REPLACE_REFS_REQUIRED` | `replace-tasks.js:44` | 400 | **500** |
  | `IMAGE_SIZE_TOO_LARGE` | `api/index.js:1370`（此处已直接 sendJson，不入此表） | 400 | 正常 |
  | `COMFY_TIMEOUT` | `comfy-client.js:450/549` | 504 | **500** |
  | `CONFIRM_REQUIRED` / `CROP_SIZE_REQUIRED` / `ANNOTATE_TEXT_REQUIRED` / `BGM_REQUIRED` | `services/post.js` 等 | 400 | **500** |
  | `NO_INPUTS` / `NO_CLIPS` / `NOT_A_VIDEO` / `SPLIT_TOO_SMALL` | `services/edit.js`、`post.js` | 400 | **500** |
  根因在 `:2319` 的回退正则：`/^([A-Z][A-Z0-9_]{2,})/.exec(msg)` 拿到的 `msgCode` 只有
  「`err.code` 为空且 message 恰好等于纯错误码」时才有机会命中，而 `:2326` 的
  `/_REQUIRED$/` 要求**整条 message 以它结尾** —— 实际写法全是 `'CODE: 中文说明'`，
  永远不以 `_REQUIRED` 结尾。所以注释 `:2305-2311` 宣称的「按 code 优先、message 回退，
  一次覆盖全部既有写法」**只覆盖了这 22 个**。
  实测旁证：`replace-tasks.js:44` 的 `REPLACE_REFS_REQUIRED` 在用户「没传参考图」时
  返回 500，前端只能显示「服务端炸了」，而真实原因是他少选了一张图。
  修复建议：`statusFor` 的回退正则改为按 `^([A-Z][A-Z0-9_]{2,})\s*:` **截到冒号**再查表；
  并把上表 8 类码补进 `CODE_STATUS`。

- **[P3] host/api/index.js:1896 —— `/file` 403 的 `detail` 文案列的目录名与 `archive.js:111-124` 的 `SERVABLE_DATA_DIRS`**不一致**（漏 4 个、多 1 个）。**
  证据：
  ```js
  // 白名单实际值（archive.js:112-123）
  ['outputs','assets','previz','previz-shots','post','comic','tmp-inline','inputs','edit']
  // 报错文案（api/index.js:1896）
  detail: '只允许读取产物与素材子目录（outputs/assets/previz/post/edit/workflows）'
  ```
  文案里 **`workflows` 根本不在白名单**（用户照文案改路径 → 仍然 403，且被「你写的就在列表里」误导），
  而 `previz-shots / comic / tmp-inline / inputs` **在**白名单却没写。
  修复建议：文案改为 `[...SERVABLE_DATA_DIRS].join('/')` 动态生成，单一真源。

- **[核实通过 · 非缺陷] host/api/index.js:1920-1949 `/file` 的 `nosniff` / SVG 强制下载 / Range 分支**已与 `/assets/item` 完全对齐**，本轮未发现残留口子。**
  逐项核对：`X-Content-Type-Options: nosniff` 在 200/206 两条分支都注入（`:1924-1926` → `:1939/:1946`）；
  SVG 强制 `attachment` 且用固定文件名 `download.svg`（不拼用户文件名，避免 header 注入）；
  `416` 用规范的 `Content-Range: bytes */size`；`HEAD` 显式短路（`:1948`）。
  另核实**上游**：`SERVABLE_DATA_DIRS` 白名单挡住 `config.json`/`jobs.json`（`:1889-1899`，先 `safeJoin`
  再 `isServableDataPath`，两道）；`asset-service.js:17-23` 的 `ALLOWED_EXT` **显式包含 `.svg`** ——
  即「SVG 可上传」是既定设计，靠这两处 `attachment` 收敛，链路完整。

- **[P3] host/api/index.js:1058-1072 `/vault/cards/:id` 的正则 `[A-Za-z0-9_]+` 与 `safeId` 的默认 `^[A-Za-z0-9_-]{1,64}$` **字符集不同**（少 `-`，多无长度上限）。**
  证据：`:1059` `/^\/vault\/cards\/([A-Za-z0-9_]+)$/`；`:1061` `safeId(m[1], /^card_[A-Za-z0-9]+$/)`。
  路由层能匹配含 `_` 的 id，但 `safeId` 又要求 `card_` 前缀 —— 两层过滤叠加，目前**安全**（不放宽），
  只是路由正则无长度上限（超长字符串会先进入 `ctx.vault.get` 前的 `safeId`，仍会被拒），
  属冗余而非漏洞。同类冗余还出现在 `:1089` `/^\/projects\/([A-Za-z0-9_-]+)\/cards$/`。
  建议统一收敛到 `safeId` 一处，路由正则只做 `[^/]+`。

### 2.6 `host/security.js` —— 安全层（**含实测**）

- **[P1 · 安全，实测复现] host/security.js:203-209 —— `resolveUserPath` 的**相对路径分支只做字符串判定、不做 realpath**，`dataDir` 内的 symlink/junction 可让「必须落在 root 内」这个承诺失效。**
  实测方法（只读，`.mjs` 探针，不碰插件源码）：在允许根内造一个指向外部目录的 Windows junction，
  再用 `resolveUserPath` 解析穿越路径。原文输出：
  ```
  ① 相对路径穿 junction（mustExist=true）  返回 ...\_probe_base\link\secret.txt  内容: SECRET
                                            真实路径: ...\_probe_out\secret.txt   ← 已逃出 root
  ② 相对路径穿 junction（mustExist=false） 同上，同样可读 SECRET
  ③ 绝对路径指向同一文件                   拒绝: FORBIDDEN_PATH                    ← 挡住了
  ④ allowSubdirs 能否挡住                  同样可读 SECRET                          ← 挡不住
  ```
  代码依据（三处分支的**不对称**是本缺陷的核心）：
  ```js
  // :196-202 绝对路径分支 —— 有 realpath，安全
  } else if (path.isAbsolute(raw)) {
    const real = (() => { try { return fs.realpathSync(raw); } catch { return path.resolve(raw); } })();
    const rel = path.relative(base, real);  if (rel.startsWith('..') || path.isAbsolute(rel)) throw fail('FORBIDDEN_PATH');
  // :203-205 相对路径分支 —— 只有 safeJoin（纯字符串 resolve），**无 realpath**
  } else { target = safeJoin(base, raw); }
  // :207-209 「再核一次」注释说防 symlink —— 但它拿 target 和 base 比，
  //         target 本身没被 realpath 过，两个都是字面量，永远通过
  const relFinal = path.relative(base, target);  if (relFinal.startsWith('..') || path.isAbsolute(relFinal)) throw fail('FORBIDDEN_PATH');
  ```
  `:207` 的注释「再核一次（symlink / 大小写 / 短路径都可能绕过字符串比较）」**高估了自己**：
  这一行仍然只比较字符串，对 symlink 完全无效（实测 ① ② ④ 三条全过）。
  而 `:144` 文件头宣称「用 realpath 比较，防 symlink 逃逸」—— 只在绝对路径分支成立。
  可利用性：需要在 `dataDir` 内**已存在**一个指向外部的链接（本地用户或某个导入流程创建）。
  现实场景不罕见 —— 把 `data/outputs` 做成指向另一块盘的 junction 是常见运维做法，
  一旦如此，`/file`、`/post/*`、`/assets/*` 的边界就跟着那个 junction 目标走，而不是 dataDir。
  修复建议：把 `:207-209` 改成对 **target** 做 realpath 后再比：
  ```js
  const realTarget = (() => { try { return fs.realpathSync(target); } catch { return target; } })();
  const relFinal = path.relative(base, realTarget);
  ```
  注意 `mustExist=false` 时 `realpathSync` 会抛（目标不存在），此时应**逐段 realpath 父目录**
  再拼 basename，否则新文件写入路径仍可穿 junction。

- **[核实通过 · 非缺陷] host/security.js:157-178 `resolveUserPath` 的**递归分支**确实做了二次 root 校验。**
  任务点名要核实这一点。依据：`:174`（http URL 的 `?path=` 提取）与 `:193`（POSIX 风格 `?path=` 提取）
  两处递归都是 `return resolveUserPath({ root, input: p, ... })` —— **`root` 原样透传**，
  递归入口重新走 `:183-185` 的 `base = fs.realpathSync(path.resolve(root))`，
  因此 root 每一次都被重新解析与校验，不存在「内层用未校验的 root」的问题。
  剩余风险仅是上一条 P1（safeJoin 分支无 realpath），与递归无关。

- **[P2] host/security.js:36 —— `isSameOrigin` 的 `Sec-Fetch-Site` 兜底只认 `cross-site`，漏了 `same-site`，而 `:38` 的 `parsed.host !== host` 是**纯字符串**比对，不比对端口以外的语义差异。**
  证据：
  ```js
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false;
  if (parsed.host !== host) return false;
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  ```
  ① `same-site`（如 `a.evil.com` → `evil.com` 的子域关系）**不被拦**，而本插件跑在 `127.0.0.1`，
    正常前端永远是 `same-origin`，因此把 `same-site` 一并拒绝**不会影响任何合法用法**，却堵掉一整类
    子域攻击面。② `:39` 的返回只检查 protocol 是 http/https，但**没有校验 `parsed.host` 与
    `req.headers.host` 之外的 `Origin` 语义**（如 `Origin: null`）——`:31-33` 的 `new URL('null')`
    会抛，返回 false，这点是对的。③ 真正的短板是 `:28-29`：**无 `Origin` 头一律放行**，
    对非浏览器客户端（curl/脚本）等于没有同源校验 —— 这是**设计意图**（写操作另有 token），
    但注释 `:20` 只写「缺省视为同源导航」，没说明「因此 `GET` 类只读接口对任何本地脚本完全开放」。
  修复建议：`sec-fetch-site` 判定改为 `['cross-site','same-site'].includes(v)`；
  注释补一句「无 Origin 的客户端只受 loopback Host 约束」。

- **[P3] host/security.js:71 `WRITE_METHODS` 不含 `OPTIONS`，而 `:85-90` 的 token 校验只覆盖四个方法 —— 若将来加 CORS 预检会被绕过，当前无 CORS 头故无影响。**
  证据：`const WRITE_METHODS = new Set(['POST','PUT','PATCH','DELETE']);`。当前全仓库未设置
  `Access-Control-Allow-*`，预检不会被触发，故**不是现存缺陷**；记录为「若以后加 CORS 必须同步这条」。
  另核 `tokenEquals:94-99`：`Buffer.from` 后先比长度再 `timingSafeEqual`，长度差异用未加密比较，
  泄露的信息仅是「token 长度固定 32」这一公开常量，**可接受**。

- **[P3] host/security.js:122-132 `safeJoin` 的 `delta && (...)` 判定正确，但**空 rel 返回 base 本身**，调用方若不预期会拿到目录而非文件。**
  证据：`safeJoin('/a', '')` → `target === resolvedBase` → `delta === ''` → 假值 → 不抛 → 返回目录。
  当前调用点（`api/index.js:1889` 的 `/file`、`:1795` 的 upload 探测）后面都跟 `fs.statSync().isFile()`
  或 `mustExist`，**未发现可利用点**；记录为「不要把 safeJoin 当文件路径校验用」。

### 2.7 `host/static.js` / `host/skills.js` / `host/runtime.js` / `client.js`

- **[P2] host/static.js:122-126 —— 路径解析先 `path.resolve` 再 `isInside`，**没有 realpath**，SPA 静态服务的边界同样可被 symlink 穿越。**
  证据：
  ```js
  abs = path.resolve(baseDir, rel);              // :122  纯字符串
  if (!isInside(baseDir, abs)) return forbidden(res);   // :126 isInside 也是 path.resolve 后比前缀
  ```
  `isInside:45-50` 只用 `path.resolve` + `startsWith`，与 `security.js:122` 的 `safeJoin` 同一思路、
  同一个盲区（对照 2.6 的实测）。`baseDir` 分别是 `app-dist`（构建产物，风险低）与
  `<dataDir>/assets`（**用户可写**，`/assets/upload` 落盘于此）。因此这里比 SPA 那侧更值得修：
  用户若能往 assets 塞一个 junction（Windows 下 `mklink /J` 不需要管理员权限），
  `/jiuzhang/assets/...` 就能读到 dataDir 之外。
  注：`app-dist` 是 `pnpm build` 生成物，用户不直接写，风险低但不为零（构建脚本/解包工具可能造链接）。
  修复建议：与 2.6 同法 —— 解析后 `fs.realpathSync` 父目录再比，或直接复用修好的 `resolveUserPath`。

- **[P3] host/static.js:158-161 —— ETag 只做「强等于」比较，不看 `If-None-Match` 的 `*` 与弱比较语义；`isIndex` 时完全跳过 304。**
  证据：`isEtagMatch:91-94` 是 `String(inm) === etag`；`:158` 又额外排除 `isIndex`。
  因此 `If-None-Match: *`（规范要求任意表示存在即 304）永不命中，`W/"..."` 与 `"..."` 的弱比较
  也不成立（我们发的就是 `W/` 前缀，`W/` 对 `W/` 的字符串恰好相等，这一支侥幸可用）。
  影响：仅缓存效率，无正确性问题。`:156` 的 `isIndex` 强制 `no-store`（`:177`）**是对的**
  （避免用户拿到旧 index.html 配新 bundle），此处无需改。

- **[P3] host/static.js:213-216 —— 301 补斜杠把 `pathname` 原样拼进 `Location`，**未做任何转义**，且丢掉了 query 之外的 fragment（正常，fragment 不上行）。**
  证据：`res.writeHead(301, { Location: `${pathname}/${url.search}` })`。`pathname` 来自
  `new URL(req.url, ...)`，已百分号编码，直接回填是安全的（不会再被二次解码）；但若
  `pathname` 里含 `\r\n`（URL 解析器会拒绝，实际不可达），也无注入面。**判定：非缺陷**。
  真正的小瑕疵是 `!path.extname(pathname)` 会把 `/jiuzhang/app/v1.2` 当成「有扩展名」而不补斜杠 ——
  这符合意图（`.js`/`.css` 不该补），但目录名带点就会漏补。P3 记录。

- **[核实通过 · 非缺陷] host/skills.js:52-53 + 96-123 —— 两层深度扫描与 kebab-case 校验**实现正确，与文件头声明一致。**
  逐项核对：`MAX_DEPTH = 3`（`skills/` → `prompt/` → `<name>/SKILL.md` 正好 3 层，`:99` `if (depth > MAX_DEPTH) return`），
  实测路径深度吻合；`:157` `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` 与 `dsh-skill` 的
  校验一致；`:161-164` 重名去重保留先出现者并 warn；`:153-155` 缺 `name`/`description` 跳过并 warn；
  `:110-113` 目录命中 `SKILL.md` 后 `continue`（一目录一 skill，不继续下钻）—— 与注释一致。
  一个**残留观察**（P3，非缺陷）：`parseFrontmatter:69` 的正则要求 frontmatter 从文件**第一行**开始，
  若 SKILL.md 前有 BOM 或空行则解析失败 → `:148-151` 当「无 frontmatter」静默跳过（**不 warn**）。
  对比 `:154` 的「缺 name/description 会 warn」，这里静默是唯一不报警的跳过路径，排查成本最高。
  建议：`parseFrontmatter` 返回 null 且文件非 README 时也 warn 一次。

- **[P3] host/runtime.js:27 `isRuntimeReady` 是**零调用**死导出，而 `:23` `getRuntime` 抛错是对的做法。**
  全仓库 grep 仅定义处一处。功能上「有没有 ready」应靠 `getRuntime()` try/catch 判断
  （`tools.js`/`api/index.js` 都是直接调），故该导出确实无用。
  但**不要**据此删掉 `:18` 的 `cfg` 字段 —— `initRuntime({ cfg })` 存的快照被
  `api/index.js:95` 的 `const ctx = getRuntime()` 间接持有（虽然 `handleApi` 随后在 `:113`
  自己 `loadConfig()` 现取，`ctx.cfg` 实际未被读取）。核实：全仓库 `getRuntime()` 后取 `.cfg`
  的调用点**为 0**，故 `runtime.js:18` 的 `cfg` 字段也是死字段 —— 可清理，但属于
  「删了不影响」，属 P3。

- **[核实通过 · 非缺陷，独立复核] `client.js` entries ↔ `app-src/src/router.tsx` ROUTES ↔ `App.tsx` NAV **三方完全一致**，前端审计员的「已对齐」结论成立。**
  复核方法（**不采信 `check-routes.mjs`，自己独立抽取**）：写 `.mjs` 探针分别正则抽取三处数组，
  再逐项比对内容与顺序。原文输出：
  ```
  ROUTES  (14): render,replace,storyboard,workshop,assets,vault,projects,edit,breakdown,previz,canvas,image,jobs,settings
  ENTRIES (14): render,replace,storyboard,workshop,assets,vault,projects,edit,breakdown,previz,canvas,image,jobs,settings
  NAV     (14): render,replace,storyboard,workshop,assets,vault,projects,edit,breakdown,previz,canvas,image,jobs,settings
  entries 与 ROUTES 顺序+内容全等 : true
  NAV     与 ROUTES 顺序+内容全等 : true
  ```
  抽取位置：`ROUTES` = `router.tsx:21-30`（`export const ROUTES = [...] as const` 区间内的单引号串）；
  `ENTRIES` = `client.js:264-283`（`const entries = [...]` 区间内的 `{ key: '...' }`）；
  `NAV` = `App.tsx:54-73`（`const NAV ... = [...]` 区间内的 `{ key: '...' }`）。
  三方各 14 项，**集合与顺序均全等**，无重复项（探针含去重检查，未报重复）。
  另核 `router.tsx:36-41` 的 `LEGACY_ROUTES`（`h3/prompt→render, director→previz, toolbox→settings`）
  这四个旧名**都不在** `ROUTES` 中，不会与新路由冲突。
  `client.js:11-17` 的注释宣称「与 router.tsx 的 ROUTES 逐项对齐，并由 check:routes 静态校验」——**属实**。
  唯一残留（P3，非本次范围）：`App.tsx:231` 的兜底 `?? 'nav.canvas'` —— 当 `route` 不在 NAV 中时
  标题会错显示「画布」，但 `router.tsx:48-65` 已保证 `route` 必为合法 `RouteId`，故不可达。

- **[P3] host/index.js:287-290 —— 启动日志的 `runtimeStats()` 在首个任务前恒为空对象，日志里出现 `运行统计={}` 属正常但易被误读为故障。**
  证据：`runtimeStats()` 来自 `services/job-runner.js`，只统计进程内正在跑的任务，
  启动瞬间必然为空。此处 `cfg` 是 `:123` 的启动快照（已在 2.1 P2 记录），日志本身无害。
  **（本条与 2.1 的 P2 `host/index.js:287-290` 是同一处代码，此处不重复计数。）**

## 三、跨文件 / 结构性问题

- **[S-1 · P2] 「配置快照」这条规则有**四套并存的口径**，没有一套是全仓库有效的。**
  逐层清点：
  1. `config-reader.js:25` 文件头：服务**只准**持 `getCfg`，不准持 `cfg` 快照 —— 但 `:139-154`
     自己又承认「`cfg` 字段兼容尚未改造的服务」；
  2. `config-reader.js:113-116` 判据：`cfg = loadConfig()` 默认参数算合规 —— 但**不看调用点是否传了实参**，
     而 `index.js:180/186`、`api/index.js:2376/2389/2397`、`tools.js:442` 全都在传快照；
  3. `smoke-api.mjs:2849` 的守卫只扫 `host/services/` —— 而实际违规集中在 `host/index.js` 与 `host/api/`；
  4. `config.js:315-327` 的 `wireConfigInvalidation` 只重建**模块级**缓存，服务实例内部状态无人管
     （`wireServiceInvalidation` 零调用，见 2.3）。
  结论：同一个概念四处各说各话，且**每一处单独看都对，合起来漏掉全部真实违规**。
  这是本报告最重要的结构性问题 —— 比单个 P1 更值得优先处理，因为后续每次改动都会继续往四个口径之间钻。

- **[S-2 · P2] 「静默降级」是本项目**反复复发的缺陷模式**，已被修了三次，仍未收敛。**
  已修的三处：`api/index.js:2400-2414`（未知 backend 不再落 mock）、
  `tools.js:369-376`（工具侧补上同一校验）、`tools.js:771-781`（batchProgress 不再无视 action）。
  仍存在的三处：`presets.js:319-321`（未知 preset 落空层，见 2.4 P1）、
  `api/index.js:2313-2327`（未知错误码落 500，见 2.5 P2）、
  `client.js`/`App.tsx` 的旧路由（已修，但 `router.tsx:53-65` 只 warn 不回退 —— 正确方向）。
  建议：把「未知枚举值必须抛错而不是降级」写成一条 lint 规则或 smoke 断言（对 `enum` 类入参统一检查），
  否则第四个入口仍会出现。

- **[S-3 · P2] `/file` 与 `/assets/item` 的安全头**已经对齐**，但**两处实现是复制的**，没有共享函数。**
  `api/index.js:1839-1844`（assets/item）与 `:1920-1939`（file）两段代码结构相同、只差
  `Cache-Control`（`no-store` vs `no-cache`）。`:1906-1918` 的注释明确记录了「历史 P1：这条路径漏了」——
  正是复制导致漏改。建议抽成 `sendMediaFile(res, abs, { cacheControl })` 单一实现。

- **[核实通过 · 结构良好] `host/api/` 的 8 个拆出模块**没有循环依赖**。**
  逐一核对 import：`http.js`（仅 `node:fs`）、`shots.js`（`security/store/models`）、
  `projects.js`（零 import）、`prompt-compile.js`（`bridge/services`）、`monitor.js`（`config/services`）、
  `replace-tasks.js`（**零静态 import**，全走函数内动态 import）、`archive.js`（`security/services`）、
  `events.js`（零 import）。**没有任何一个 import `api/index.js`**，方向单调（index → 模块 → services）。
  与 `index.js:35-42` 的注释「拆分出的模块」一致。这一层是本次审计里结构最干净的部分。

## 四、存疑（无法在当前条件下证否/证实）

- **[存疑 S-1] `host/skills.js:258` `return skills.registerProvider(() => provider);`** 返回值被
  `index.js:99-104` 的 `ctx.effect` 直接当作 dispose 函数。若 `registerProvider` 的返回值不是函数
  （或返回 Promise），Cordis 卸载期会报错。`host/skills.js:199` 已确认**注册函数本身是同步的**
  （这也是本报告撤销 2.1 那条 P3 误报的依据），但 `registerProvider` 是**外部 DSH API**，
  其返回契约不在本仓库内，无法静态证实。**建议：加一行 `typeof ret === 'function' ? ret : () => {}` 防御。**

- **[存疑 S-2] `host/config.js:174-179` 的 `dataDir` 回落**与**「用户主动指定一个新的、尚不存在的目录」**
  无法区分。用户想先把 dataDir 指向 `D:\新目录`（还没建）→ 被回落 → 首次 `saveConfig` 又把它写死成默认值。
  本报告 2.2 P1 的修复建议会把「回落值不落盘」作为主修法，但这只解决「被写死」，
  不解决「想指定新目录却静默失效」。理想的取舍需要产品决策（是先 mkdir 还是先回落），故存疑。

- **[存疑 S-3] `host/tools.js:868-880` `studio_storyboard` 的 `imageRels` 语义**：
  schema 声明「dataDir 相对路径」，但 `services/nanfeng/storyboard.js` 内部是否也接受同源 URL 形态
  （`/jiuzhang/api/file?path=...`）未在本次范围内逐行核实。当前前端传相对路径，故不构成缺陷；
  若将来让画布直接传 blob URL 需再验。**未覆盖，据实列入存疑。**

- **[存疑 S-4] `host/api/index.js:1120-1160` 区间的 `/assets/archive` 与 `/assets/upload` 的 `type` 字段**
  是否校验 `ASSET_TYPES` 枚举未逐行核实（`archive.js:40-44` 有注释说「写 'video' 会被静默降级成
  general」，说明存在降级路径）。本次只核到 `asset-service.js:17-23` 的扩展名白名单，枚举校验留待补审。

## 五、清理清单（死导出逐个核实）

核实方法：`grep` 全仓库（含 `tools/`、`app-src/`、`docs/`），排除定义处自身与注释/文档命中，
再区分「真死」与「有真实语义缺口」。

| 符号 | 定义 | 调用点 | 判定 |
|---|---|---|---|
| `config-reader.js` `dirResolver` | :74 | **0**（仅 :67 注释） | **真死**，可删 |
| `config-reader.js` `wireServiceInvalidation` | :89 | **0** | **真死但别删** —— 服务实例失效能力确实缺失（见 2.3 P2），应接上 |
| `config-reader.js` `findConfigSnapshotReads` | :125 | 1（`smoke-api.mjs:2848`） | **在用但有缺陷**（见 2.3 P1），不可删，需修 |
| `config-reader.js` `createFooService` / `runX` | — | — | **不存在这两个符号**（是文件头 27-28 行的示例代码文字，不是导出）。误报，澄清 |
| `runtime.js` `isRuntimeReady` | :27 | **0** | **真死**，可删 |
| `config.js` `configFile` | :306 | **0** | **真死**，可删 |
| `config.js` `maskConfig` | :212 | 3（`tools.js:140/143`、`api/index.js:715/735`） | **在用**，不可删 |
| `bridge/index.js` `BRIDGE_LAYOUT` | :138 | 1（`smoke-api.mjs:2799` 断言键数为 3） | **在用（测试锚点）**，不可删 |
| `api/http.js` `decodeRfc2047` | :136 | 1（`http.js:118` 内部） | **在用**，不可删（虽只被内部调用，但非导出死码） |
| `api/monitor.js` `diskFree` | :31 | 1（`monitor.js:26` 内部） | **在用**，不可删 |
| `config.js` `DEPRECATED_CONFIG_KEYS` | :97 | **0**（仅自身 + 注释/文档） | **纯文档常量**，行为不受其影响（见 2.2 P3），保留作记录 |
| `runtime.js:18` `state.cfg` 字段 | :18 | **0**（`getRuntime().cfg` 无调用点） | **死字段**，可清理 |

**合计真死可删 4 个**：`dirResolver`、`isRuntimeReady`、`configFile`、`runtime.js` 的 `cfg` 字段。
**「假死」3 个**（看似无外部调用但内部在用或测试锚点）：`decodeRfc2047`、`diskFree`、`BRIDGE_LAYOUT`。
**「真死不建议删」1 个**：`wireServiceInvalidation`（删了会掩盖真实缺口）。

## 六、级别计数（最终）

| 级别 | 含义 | 条目 |
|---|---|---|
| **P0** | 数据丢失 / 安全 / 必崩 | **0** |
| **P1** | 功能错误 / 静默撒谎 | **6** |
| **P2** | 健壮性 / 性能 / 可维护性 | **16** |
| **P3** | 清理项（死代码 / 陈旧注释） | **15** |

计数口径（可复算）：对全文按 `**[P1]**`/`**[P2]**`/`**[P3]**` 标记与 `§三` 的 `S-n · Pn` 逐条统计。
P3 的 15 条 = 文件级 14 条（`config.js`×2、`config-reader.js`×1、`tools.js`×4、`api/index.js`×3、
`security.js`×3、`static.js`×3、`runtime.js`×1 … 去重后）+ `skills.js` frontmatter 静默跳过 1 条。
`host/index.js:287-290` 在 2.1 与 2.7 出现两次（同一处代码），只计一次。

P1 清单（便于复核）：`index.js:180-187` 启动 cfg 快照进生成器；`config.js:174-196` dataDir 回落被写死；
`config.js:255` `validateComfyUrl` 的 `/^127\./` SSRF；`config-reader.js:125-205` 扫描器自身 3 漏 3 误；
`tools.js:340-351`+`presets.js:319` 未知 preset 静默空层；`security.js:203-209` 相对路径分支无 realpath（实测）。

> 说明：§一 的计数表写于本报告前半段（当时只有 4 段已完成），本表为**全文终值**，以本节为准。
> 复核用探针脚本保留在 `_audit_run/_probe_scanner.mjs`、`_probe_scanner2.mjs`、`_probe_routes.mjs`、
> `_probe_symlink.mjs`、`_probe_symlink2.mjs`，均可重跑（只读，不写插件目录）。