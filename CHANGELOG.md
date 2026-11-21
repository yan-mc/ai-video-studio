# 变更日志

本文件记录九章工作室插件的所有重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

---

## 2.18.0 — 提示词编译器 + GPU 按需启停（2026-11-21）

> 用户需求：换人提示词要求英文结构化，但 NSFW 内容云端 AI 普遍拒写，
> 只能手写中文自由文本。同时希望 ComfyUI 和翻译模型都按需启停，别常驻占显存。

### ① 提示词规范化：三层降级

| 层 | 手段 | 耗时 | 依赖 |
|---|---|---|---|
| ① | **规则引擎** | <10ms | 无 |
| ② | **本地 7B 翻译** | 3–10s | Qwen2.5-7B（首次下载 15GB） |
| ③ | 原文兜底 | 0 | 无 |

**关键设计：规则引擎先跑，模型只做翻译。**

让模型自由重写是不可控的 —— 它可能"优化"掉 LoRA 触发词。
`DR34ML4Y` 这类 LoRA 把一整段英文描述绑成触发条件，改一个字效果就废。

所以 `splitReplacePrompt()` 会：
1. 识别开头的触发词块（`Video depicts...` 等）→ **逐字保留，不翻译不重排**
2. 按 `<Subject N>` / `<Video N>` / `<Picture N>` 标签切分
3. 按语义归入四段式（总结 / 身份 / 时间轴 / 防漂移）
4. 含占位符的句子不送翻译（避免把 `<Subject 1>` 改坏）

实测你那段提示词：触发词正确保留、8 条散句保持书写顺序、四段式归位。

### ② 本地 7B 翻译服务

`tools/prompt-llm/translate_server.py` + `host/services/prompt-llm.js`：

- 模型 `Qwen2.5-7B-Instruct`，4bit 量化（~5GB）
- **进程模型：按需拉起、用完即退**，不常驻
- 走 stdin/stdout 单行 JSON，不开 HTTP 端口（省掉端口冲突）
- 单条失败不中断整批 —— 保留原文即可

系统提示词刻意写成"你是格式转换器，不是内容创作者"，
并要求"不新增、不删减、不评价" —— 任务描述越中性，拒答率越低。

### ③ GPU 按需启停

新增 `host/services/comfy-lifecycle.js`：

```
用户写提示词 → 点「编译」→ 拉起翻译模型（ComfyUI 关着）
            → 看结果 → 点「开始跑」→ 拉起 ComfyUI（翻译模型已退）
            → 批次完成 → 关掉 ComfyUI 释放显存
```

**核心约束：只关"自己拉起的"。**

如果用户本来就手动开着 ComfyUI（可能在跑别的东西），批次结束后
**不会替他关掉** —— 用 `ownedByBatch` 标志区分。

失败路径**也会释放** —— 否则一次失败会把 14GB 显存永久占住，
用户下次点编译时翻译模型直接 OOM，这个连锁反应比原错误更难排查。

### ④ 前端

提示词框下方新增两个按钮：

- **快速整理（规则）** —— 秒回，不依赖模型
- **编译 + 英文翻译** —— 模型不可用时禁用并显示原因

编译结果**不自动替换输入框**，先弹预览面板让用户确认。
理由：触发词一个字都不能改，自动替换出错难恢复。

面板还做了过期检测：如果用户在预览期间又改了输入框，
"应用"按钮会禁用并提示重新编译。

### 附带修复

`replace-runner.js` 的 `newJob` 补上 `steps` 透传 ——
此前用户设 25 步实际跑 50 步，且因为 `checkSteps` 未被调用而**完全静默**。

### 验证

| 项 | 结果 |
|---|---|
| 规则引擎拆分真实提示词 | ✅ 触发词保留、顺序正确、四段归位 |
| `/replace/compile-prompt` | ✅ 200，返回切片统计 |
| `/replace/llm-status` | ✅ 正确识别"模型未下载" |
| ComfyUI 已在运行时 ensure | ✅ started=false, ownedByBatch=false |
| release 在非自己拉起时 | ✅ skipped=true，不误关 |
| 冒烟测试 | **184 / 184** |
| 路由一致性 | ✅ 三方一致 |
| TypeScript | 0 错误 |

新增 2 条回归测试守护触发词保留与顺序保持。

---

## 2.17.0 — 超时改为可配置 + 不加速步数可调（2026-11-21）

> 用户实测：选「不加速（50 步）」跑长片直接报 `COMFY_TIMEOUT`。

### ① 根因：超时是「固定轮询次数」，不是「实际耗时上限」

`comfy-client.js` 早先是：

```js
const MAX_POLL = 600;
const POLL_MS  = 3000;   // 600 × 3s = 硬上限 30 分钟
```

问题不在「30 分钟太短」，而在**这个上限与任务实际需要无关**：

- 不加速方案（原模型 50 步）跑 5 秒片很容易超过 30 分钟 → 被 `COMFY_TIMEOUT` 打断
- 而打断时 **ComfyUI 还在继续跑**：GPU 白烧，产物也拿不到
- 反过来，4 步小图 10 秒就跑完，那 30 分钟的空头额度毫无意义

**修法**：改成按**截止时间**等。

```js
const deadline = Date.now() + resolveTimeoutMs(cfg);
for (;;) {
  if (Date.now() >= deadline) throw new Error('COMFY_TIMEOUT: ...');
  ...
}
```

超时值优先级：环境变量 `JZ_COMFY_TIMEOUT_MIN` > 配置 `comfyTimeoutMin` > 默认 **120 分钟**。
上限 24 小时（防止手滑写天文数字把进程挂死）。

错误信息也不再是干巴巴的 `COMFY_TIMEOUT`，而是明说「已等待 X 分钟、任务可能仍在跑、
怎么调大」。**超时不等于失败**，这一点必须在报错里讲清楚。

### ② 不加速的步数从写死 50 改成可调

`none` 方案新增 `stepsRange: { min: 20, max: 80, step: 1 }`：

- `steps: 50` 降级为**推荐值**（前端预填 + 校验基准），不再是硬性要求
- 低于 `min` → **拒绝**（去噪没跑完，废片）
- 高于 `max` → **警告**（能跑，但收益递减、耗时线性增长）
- 区间内 → 放行

面板上会显示「采样步数（可调 20–80）」并给出「想快可以先试 25–30 步」的提示。

`checkSteps()` 也随之改为读 `stepsRange`，不再硬编码 50% 阈值。

### ③ 蒸馏学生的步数仍然不可调

`dmad8` / `dmad4` 没有 `stepsRange` —— 它们的步数是**训练配置**，
改了就是分布外采样。偏离时仍只给黄色警告，不拒绝。

这个区分很重要：原模型偏离推荐值可能是「折中」，蒸馏学生偏离就是「跑错」。

### 验证

| 项 | 结果 |
|---|---|
| `resolveTimeoutMs` 读环境变量 | ✅ |
| 读 `cfg.comfyTimeoutMin` | ✅ |
| 用 deadline 判断 / 无固定轮询次数 | ✅ |
| `POST /config {comfyTimeoutMin:180}` | ✅ 200，可读写可还原 |
| `checkSteps('none', 8)` | 拒绝 |
| `checkSteps('none', 20/30/50/80)` | 放行 |
| `checkSteps('none', 90)` | 放行 + 警告 |
| `checkSteps('dmad8', 20)` | 放行 + 分布外警告 |
| 冒烟测试 | **181 / 181** |
| 路由一致性 | ✅ 三方一致 |
| TypeScript | 0 错误 |

新增 2 条回归测试守护超时机制与步数范围。

---

## 2.16.0 — 加速方案真正可选 + 步数/采样器联动（2026-11-21）

> 起因：用户问「能不能把替换流程的 dmad8 变成可选项」。
> 审查后发现选择器**本来就有**，但有两个静默出废片的缺陷。

### ① 缺陷：选「不加速」却只跑 8 步 —— 不报错，出废片

**现象**：`accelPlan` 下拉里早就有 `none`（不加速 / 50 步）选项，
但 `steps` 的初始值是写死的 `'8'`，切换方案时**不会变**。
于是「选 none + 8 步」一路绿灯跑到 ComfyUI，原模型只跑 8 步去噪 —— 远未收敛，
出片一片模糊，而且**没有任何警告**。

**根因**：`accel-plan.js` 的 `checkSteps()` 对 `family === 'none'` 直接
`return { ok: true, warning: '' }` —— 它只校验蒸馏学生，不校验原模型。

**修法（三处）**：

1. `checkSteps()` 补 `none` 分支：低于推荐步数 50%（50 → 25）判 `ok: false`
2. `generator.js` 在 `ok: false` 时额外写一条「已忽略你填的 X 步，实际按 Y 步执行」
   —— 否则用户填 8 步、系统跑 50 步，耗时涨 6 倍却没有任何解释
3. 前端加「加速方案 → 步数联动」：切方案自动同步推荐步数，
   但用户手动改过后不再覆盖（`stepsTouched` 标志）

### ② 缺陷：采样器漏进不加速方案

`buildOverrides()` 原先写 `task.sampler || d.sampler`，前端默认值 `lcm` 会顺带传进来，
于是「选不加速 + 采样器 lcm」成立 —— **原模型用 LCM 步进器跑 50 步**。
LCM 是为少步数设计的，在正常步数下反而会糊、丢细节。

`generator.js` 的 `accelOverrides()` 之后确实会用 `accel.sampler` 再覆盖一次，
但那是**靠执行顺序兜底**，调整合并顺序就会静默失效。

**修法**：`buildOverrides()` 改用 `samplerForPlan()` / `schedulerForPlan()`，
采样器与调度器**永远跟随加速方案**，不接受前端覆盖。

### ③ UI：加速方案与 LoRA 放进同一个面板

原本加速方案在右列「执行」面板、LoRA 在左列底部，两者隔得很远。
但它们**是耦合的**：挂某些语义 LoRA（尤其成人向）时加速会明显削弱效果，
用户需要同时看到两个选项才能权衡。

现在合并为「4 · 加速方案与 LoRA」，加速方案在上、LoRA 在下。
选 `none` 时会显示说明：「不挂加速 LoRA，跑满 50 步，慢 5–6 倍，
但这是画质上限 —— 部分语义 LoRA 在加速下会明显失效」。

### 审查结论：后端本来就支持，缺的是正确性

| 环节 | 状态 |
|---|---|
| `/replace/meta` 下发 `accelPlans` | ✅ 原本就有（含 none） |
| `createReplaceTask` 接收 `body.accelPlan` | ✅ 原本就有 |
| `replace-runner` 使用 `task.accelPlan ?? 默认值` | ✅ 原本就有 |
| **步数跟随方案** | ❌ 本次修复 |
| **采样器跟随方案** | ❌ 本次修复 |
| **UI 位置与提示** | ⚠️ 本次调整 |

### 验证

| 项 | 结果 |
|---|---|
| `checkSteps('none', 8)` | `ok:false` —— 拦住废片组合 |
| `checkSteps('none', 25)` | `ok:true` —— 50% 下限放行 |
| `buildOverrides({accelPlan:'none', sampler:'lcm'})` | 采样器 = **euler**（不再被污染） |
| `buildOverrides({accelPlan:'dmad8', sampler:'euler'})` | 采样器 = **lcm** |
| 冒烟测试 | **180 / 180** |
| 路由一致性 | ✅ 三方一致 |
| TypeScript | 0 错误 |

新增 2 条回归测试守护这两个缺陷。

---

## 2.15.0 — 顶栏 ComfyUI 启停 + 续写残留的正解（2026-11-21）
### ① 问题：换下一个项目时，"前面的续写还在"

先纠正一个我一开始也有的误判：**不是 latent 串味**。

核对过 `data/replace/replace.json` 与 ComfyUI 的
`output/nanfeng_v15_context/` —— 每个批次走 `createBatch` 生成新 UUID，
folder 是 `sha256([workflow,node,group,run])`，**13 个历史目录互不相同**。
续写 latent 不会跨任务互相污染。

真正残留的是**队列**：

- 本地「取消」只对**正在跑的那一单**发 `/interrupt`
- 已经排进 ComfyUI 队列、还没开始的任务**不会被清掉**
- 用户看到界面停了 → 下一单提交 → 上一单的段仍然依次执行

加上每段都要冷加载 11GB 模型（日志 `loaded_models 2→0`），进程跑久了
还有显存碎片。所以**重启进程确实是最干净的收口手段** —— 你的判断是对的，
只是原因是队列而不是 latent。

### ② 顶栏加启停按钮

`App.tsx` 顶栏右侧（在 H3 / Blender 状态灯之后、配色按钮之前）新增电源按钮：

| 状态 | 显示 | 点击行为 |
|---|---|---|
| 运行中（绿点） | ⟳ 重启 | `POST /comfy/restart` |
| 未运行（红点） | ▶ 启动 | `POST /comfy/start` |
| 进行中 | 启动中… / 重启中… | 禁用，防连点 |

- 状态**每 10 秒自刷新** —— ComfyUI 可能被别处启停，按钮不能显示陈旧值
- 悬停提示写明"重启会清空队列、显存碎片、节点缓存"，以及为什么要这么做
- 找不到 `ai-runtime/start-h3.ps1` 时按钮置灰并说明原因，不做成死按钮

### ③ 后端 `comfy-control.js`（新增）

四条路由：`GET /comfy/status`、`POST /comfy/start|stop|restart`。
写操作走既有 `guard()`，无令牌返回 403（已验证）；`/comfy/status` 是 GET，
不额外校验令牌（顶栏每 10 秒要读一次）。

**停止的顺序是刻意设计的**：

```
① POST /interrupt      让当前采样收尾（只杀进程会留半截 mp4/safetensors）
② POST /queue {clear}  清掉排队项 ← 这一步才是"续写残留"的解
③ 终止进程
④ 等端口释放，超时再强杀
```

**启动交给 `start-h3.ps1`，不在 Node 里拼命令行** —— 端口避让（Windows
Hyper-V 会动态保留整段 TCP）、`--lowvram --use-ck-attention`、端口文件落盘
都在脚本里，重复一份必然走样。

### ④ 过程中踩到并修掉的三个真问题

**a. 必须用 `pwsh`，不能用 `powershell.exe`**

`start-h3.ps1` 是 UTF-8 无 BOM 的中文脚本。Windows PowerShell 5.1 按系统
ANSI 代码页（中文机器 = GBK）读它，脚本里的中文全变乱码、连引号都被吞掉：

```
Unexpected token '鉁?ComfyUI' in expression or statement
The string is missing the terminator: ".
```

看起来像脚本语法坏了，实际是编码问题。同一脚本在 pwsh 7 里跑得好好的。
`findPwsh()` 用 `where.exe` 解析真实路径（`WindowsApps\pwsh.exe` 是重解析点，
`stat` 它 EACCES；`Program Files\WindowsApps` 整目录 EPERM 扫不了）。

**b. `detached: true` 会让 PowerShell 子进程立刻以 code 0 退出**

实测：spawn 后 4.6 秒就报"脚本已退出但端口未就绪"，而同一脚本在交互终端
跑得正常。改成不 detached、只 `unref()` —— ComfyUI 是脚本内部用
`Start-Process` 起的独立 python 进程，父进程退出不影响它。

**c. 子进程秒退时必须立刻报错，不能干等 180 秒**

初次实现只有超时分支，用户点了按钮会看到界面卡三分钟且没有任何提示。
现在监听 `exit`，退出后仍未就绪就直接返回失败原因。

### 验证（真跑，非静态检查）

| 项 | 结果 |
|---|---|
| `stop` | 1.7s，返回 `{ok:true,pid,port}`，端口真释放 |
| `start` | 12.1s（经 DSH API）/ 16.7s（直接调模块），端口 8488 就绪 |
| `restart` | 13.5s，`phase:'start'` |
| 无 token 调 `/comfy/start` | **403 拒绝** |
| 顶栏按钮渲染 | Edge headless 截图确认：运行中显示「绿点 ⟳ 重启」 |
| `/queue {clear:true}` | HTTP 200 |
| `POST /interrupt` | HTTP 200 |

`npm test` **178/178 通过**（新增 6 条启停护栏：四条路由注册、禁用
`powershell.exe`、interrupt→clear→kill 的顺序、判活走 `/system_stats`、
按钮挂载与自刷新、GET 不额外校验令牌）。`check:routes` 三方一致。

## 2.15.0-edit — 新增「视频剪辑」：裁切 / 拼接 / 音轨（2026-11-20）

### ① 为什么是「片段列表」而不是多轨时间轴

本插件的主流产出是 H3 生成的**顺序片段**（镜头 1 → 2 → 3），不是需要自由编排的
素材堆。所以编辑模型定为：素材池 → 有序片段序列 → 音轨设置 → 出片。

明确**不做**多轨时间轴 UI 与逐帧预览，原因是浏览器侧的硬限制：
WebCodecs + ffmpeg.wasm 要把整个文件读进内存，H3 的 1–2 GB 产出必然 OOM；
而本机已有原生 ffmpeg 9.0.2，处理大文件毫无压力。所以解码与编码全部在 Host 侧跑，
浏览器只负责组织片段。

### ② 后端（`host/services/edit.js`，9 条 REST 路由 + `studio_edit` 工具）

| 能力 | 实现要点 |
|---|---|
| `probe` | ffprobe → 时长/分辨率/帧率/音轨，字段缺失一律给 `null` |
| `trim` | 输入端粗 seek + 输出端精 trim：纯输入 seek 会吸附到关键帧，起点差 1–2 秒 |
| `concat` | 形状一致走流复制（秒级、无损），否则自动滤镜重编码；可带 `xfade` 转场 |
| `audio` | `strip` / `volume` / `bgm`（可替换或与原声混音，带淡入淡出）|
| `render` | 逐段裁切 → 拼接 → 应用音轨，产物落 `data/edit/outputs/` |
| `projects` | 工程 json 存 `data/edit/`，只存相对路径（换机器仍可用）|

几个必须记下来的判定：

- **`concat` 不能只有 copy 路径**。`film/render` 只实现了 copy，接不同来源的片段时
  会**静默产出花屏**。这里先用 ffprobe 比对 codec/宽高/帧率/音轨存在性，
  任一项不同就自动切滤镜重编码；音轨存在性不一致还会导致 concat 流映射错位。
- **`xfade` 的 offset 是累计时长减已消耗重叠**，算错会得到黑帧或时长不对。
  实现里显式维护 `running` 累计值，并拒绝"片段短于转场时长"。
- **归一化链必须带 `setsar=1`**。手机竖拍素材常带非 1:1 的 SAR，
  不带会直接报 "Input link parameters do not match"。

### ③ 前端（`EditPage.tsx` + `api/edit.ts`）

三栏：素材池 / 剪辑序列 / 输出设置+成片预览。功能：加入、上下移动、移除、
设裁剪区间（前端夹到 `[0, 片长]`，保证"看到的数字就是会用的数字"）、
选音轨模式、出片并内联播放。另有「剪辑工程」tab 做工程增删查改。

### ④ 接线与配套

- 路由三方一致：`router.tsx` ROUTES / `App.tsx` NAV+RouteView / `client.js` entries
  均加 `edit`，由 `tools/check-routes.mjs` 守护（现为 14 条）。
- 新增 `scissors` 图标；导航里放在「工具」分组首位。
- **`edit` 必须加进 `/file` 的 `SERVABLE_DATA_DIRS` 白名单** ——
  否则成片能出但 `<video>` 内联播放拿到 403，表现为"出片成功但播放器空白"。
- 样式只用已有 `--jz-*` 令牌（`--jz-r-md` 而非不存在的 `--jz-radius-*`），
  双主题与四强调色下都能正确跟随。
- `data/edit/` 加入 `.gitignore`（工程与产物都是运行时数据）。
- 新增 `tools/verify-edit.mjs`：真造素材跑通裁切/拼接/转场/音轨/工程 CRUD
  并用 ffprobe 复核时长，另含"拒绝 dataDir 外路径""写操作无 token 被拒"两项安全检查。

### ⑤ 验证

- `npm test` 165 / 165 通过（工具数断言从 13 更新为 14）。
- `tools/verify-edit.mjs` 21 / 21 通过（真实 DSH HTTP 接口 + 真实 ffmpeg）。
- 真实 ffmpeg 端到端：`trim 1→3s` 得 2.000s；`concat` 硬切 5+4=9.023s；
  `xfade 0.5s` 得 8.500s（5+4−0.5，精确）；`strip` 输出无 audio 流；
  `render` 两段裁切+转场+BGM 得 4.100s 且含音轨。
- 三镜头真实素材演示（1472×832 + 864×480 + 1056×608，含裁切/转场/剥音轨）：
  得 11.375s，期望 11.367s，**误差 0.008s**；内联播放 HTTP 200 video/mp4。
- `npm run typecheck` 无错误；`pnpm build` 成功；`check:routes` 三方一致。

### ⑥ 开发中自查修掉的严重缺陷

**`Number(null) === 0` 让默认路径全坏。**
`numOrNull(v)` 原实现 `const n = Number(v); return Number.isFinite(n) ? n : null;` ——
`Number(null)` / `Number('')` / `Number(false)` 都是**有限数字 0**，
于是"没设裁剪区间"的 `endSec: null` 被读成 `0`，而 `?? total` 不会对 0 回退
（0 不是 nullish）。"整段"变成"0 到 0"→ `trim` 抛 `EMPTY_RANGE` → **多段 render 直接 500**。

这是**默认路径**（用户不设裁剪区间直接出片），属于主流程全坏。
第一版验收 20/20 全绿却漏掉了它，因为每个用例都显式给了 `endSec`。
修复后新增专项用例「render 默认路径（不设裁剪区间）」守护。

另有三个已修：`render` 的 `name` 路径穿越（加 `sanitizeFileName`）、
首次出片因工程不存在而失败（改为就地建工程）、`lastOutputRel` 被 `saveProject` 静默丢弃。

验收脚本自身也修了两处：清理写在成功路径末尾（中途 throw 就跳过）、
只清返回值里的 rel（render 内部的 trim/concat/audio 中间产物不在返回值里）。
现改为 `finally` + 运行前目录快照 diff，只删本次新增文件，不清空目录。

### 已知边界

- 剪辑只接受 `dataDir` 内的文件（安全边界，与 `film/render` 一致）。
  外部素材需先经「素材库」上传。
- 转场只提供淡入淡出（`xfade=fade`）。其余转场类型上游支持，但未在 UI 暴露。
- 不做关键帧、调色、变速、字幕烧录的编辑界面（字幕仍走 `/h3/film/render`）。

---

## 2.14.0 — 换人接缝根治：续写链 + 每段重新锚定身份（2026-11-20）

### ① 问题：独立重绘的段间必然跳变

「切段 → 每段独立生成 → concat」这条路，每段都是**冷启动**：
段 2 的首帧是模型自己推断出来的，不可能是段 1 的末帧。
加重叠段也只缓解不根治 —— 重叠部分会生成两份不同的画面，拼接时还是得丢一份。

用户实测还发现：**单个 10 秒段的后几秒稳定性本身就不好**，段间更是硬跳。

### ② 方案 A：改用潜空间续写链

段间通过**真实 AV latent** 传递，不是靠提示词祈祷模型"接着演"：

```
段 N 采样完 → NanFengV15CommitContinuation 存 clip_N.safetensors
段 N+1 采样 → MotionContextLoadLatent 读 clip_N
            → MiniMaxH3MotionContext 把末尾 trimFrames 帧钉成关键帧条件
            → MiniMaxH3MotionContextTrim 把开头 trimFrames 帧裁掉（重放部分）
```

实测（12.25s / 3 段 / context=56）：

| 项 | 结果 |
|---|---|
| latent 落盘 | `clip_00001/2/3.safetensors` 全部生成 |
| 帧数 | 90 + 102 + 102 = **294 帧 = 12.28s**（源 12.25s） |
| trim 生效 | 段2 = 102 帧 = 158 − 56 ✅ |
| 段1→段2 接缝 | 发丝/羊角/项坠/窗棂光斑**完全对齐**，肉眼无断点 |

### ③ 但暴露了更关键的问题：身份随链条累积漂移

实测 **段2→段3 身份回退**：祥子变回源视频的金发礼帽角色。

根因：`nodes.py:519-529` 把上一段 latent 作为**关键帧条件**注入
（每个 latent step 一个 `resolved_frame_index` + latent block）。
这些关键帧携带的不只是动作，还有**上一段的角色外观**。
参考图与第 N-1 段的 latent 在同一段里竞争身份，污染随链条累积。

### ④ 对策：每段重新锚定身份（三管齐下）

**a. 参考图分辨率拉高**

⚠️ 先纠正一个坑：`参考图尺寸`（ref_image_size, match/max）在本地 V15 上是
**死参数** —— `h3_generator.py:1594-1599` 硬编码成 `"max"`，面板分支不读
（`param-docs` 已标 `flag: 'dead'`）。

真正接管分辨率的是 **`参考图最长边`**：
`h3_generator.py:1404` 读它，每个参考图都过一道
`NanFengH3LimitImageLongEdgeV15(max_long_edge=...)`。
源码原话："One sizing authority: upstream longest-edge 1920."

续写模式默认提到 **2560**（默认 1920），换人靠细节识别「这张脸是谁」。

**b. 每段都重新喂参考图**

`shot.refs.images` 在每个段循环里都从 `task.refImages` 重建，不是只在段 1 挂。
（这一条本来就有，但加了护栏测试防止被改断。）

**c. 段 2 起在提示词里插入身份锚定句**

官方 skill（h3-continuation §1）的语义是：

> Segment 2 onward: the actual previous latent motion and camera state take
> precedence over planned poses and picture poses.
> **Pictures retain identity, face, hair, costume.**

即「latent 管动作，参考图管身份」。但模型不会自己遵守，
必须在每段提示词里写成可执行指令：

```
Identity lock: the subject keeps the exact face, hair, horns, costume and
body shape shown in <Picture 1> for the entire clip. The carried motion from
the previous segment supplies movement, camera and timing only — it never
supplies appearance. Every frame shows the <Picture 1> character, not any
other person.
```

放在第一个空行之后（紧跟首句总结），保证注意力权重。**段 1 不加** ——
它没有上一段 latent，不存在身份竞争，加了只是浪费注意力。

### ⑤ 顺带修掉的两个 bug

**`context_length` 被预设覆盖（静默跑错参数）**

`presets.js` 的两套续写预设把 `context_length` 写死成 `'22'`，
而合并顺序是「预设 → 镜头 overrides → extraParams」。
换人线早先没写这个键 → 用户选 56（2.33s）实际跑 22（0.92s）：
重叠窗口只剩 40%，产物 136 帧而不是 102 帧，**零报错**。

**`replaceStore.upsert` 返回整个数组**

底层 `updateJson` 返回写入后的**完整集合**，不是单条记录。早先直接
`return updateJson(...)`，于是：

- `createReplaceTask` 返回给前端的是数组 → `task.id` 变成
  一串 id 拼起来的字符串 → 调 `/replace/run/` 必然 `INVALID_ID`
- `runReplaceBatch` 的 emit 同样中招 → `current.sourceRel` 变 undefined
  → 抛 `PATH_REQUIRED`

已在 store 层收口（回读单条），所有调用方都正确。

### ⑥ 新的默认值

| 项 | 值 | 理由 |
|---|---|---|
| `continuation` | `true` | 独立重绘段间必跳 |
| `contextLength` | `'56'` | 节点最大档 2.33s |
| `segmentSec` | `4` | 让重叠占比过半 |
| `refImageLongEdge` | 2560（续写）/ 1920（独立） | 续写要更高身份细节 |
| 二采 | 强制关 | latent 不可缩放，开了第二段直接 ValueError |

### 测试

**160 / 160 通过**。新增 4 条抗漂移护栏 + 10 条续写机制护栏，
覆盖 context_length 四档、段 1 不裁、trim 生效、任务 JSON 五字段、
身份锚定句必须真正提交（`prompt: segmentPrompt`）、每段重挂参考图。

---

## 2.12.0 — 角色替换独立业务线 + 两个静默失效修复（2026-11-20）

### ① 新增：独立「角色替换」页（与渲染页平行，互不干扰）

放在左侧导航「制作」组第二位（渲染页下一格），路由 `#/replace`。

**为什么必须独立成一条线**：常规渲染的参考图顺序是

`
角色卡 → 人设卡 → 手工图 → 场景道具
`

项目里只要绑着角色卡，用户手工挂的参考图就会被**顶到后面**，
`<Picture 1>` 指向另一个人 —— 而且**不报错**。换人对此零容忍。
所以这一页不读项目、不读镜头卡、不读角色卡，参考图编号 **= 选择顺序**。

| 项 | 实现 |
|---|---|
| 存储 | `data/replace/replace.json`，与 `jobs.json` / `shots/` 完全隔离 |
| 参数 | 独立一份，不读也不写 `config.json` 的渲染默认值 |
| 提示词 | 四段式结构（照 `h3-character-replace` skill），只留 3 个占位符 |
| 默认参数 | DMAD8 + lcm + simple + 8 步 + 0.6MP + 降噪 1.0 + 二采关 + 续写关 |
| 光影 | 默认 `none`（继承源视频），可显式改成 4:1 |

**通用换人提示词**（去掉所有特例触发词）：

`	ext
将参考视频1视频中的{原角色特征}替换成参考图{N}中的{目标角色特征}。完全复刻参考视频1内动作。

<Subject 1> 是 <Picture N> 中的{目标角色特征}，替换原视频中的{原角色特征}。
<Video 1> 是源视频，保留其完整动作、运镜和剪辑节奏。

{分镜或自动兜底句}

全程保持 <Subject 1> 的身份和外观与 <Picture N> 完全一致。完全复刻 <Video 1> 内动作，不添加新角色。
`

多角色时 `roles` 数组逐项展开，`<Subject N>` / `<Picture N>` 按顺序递增。

### ② 长视频自动分段

源视频超过 `segmentSec`（默认 10s）自动切段，逐段重绘后无损拼接。

- **切段用重编码**（`-ss` 输入侧 + `-t` + crf 16），不能用 `-c copy`：
  后者只能切在关键帧，实际段长会漂移到 8.3s / 11.7s，与 H3 的 17k+5 帧网格对不上
- **顺手剥音轨**（`-an`）：换人铁律 1，晚一步就会被当成 `<Audio 1>`
- 拼接走 concat demuxer `-c copy`（各段同编码同分辨率，来自同一源）
- **不走潜空间续写**：续写要吃上一段 AV latent，且与二采硬互斥；
  换人的源视频本身就是连续锚点，不需要 latent 链
- 末段 <1s 自动并入上一段，避免产出碎片

实测（2s/2s/1s 三段）：切段 2.000/2.000/1.000s，拼接 5.000s（150 帧 @30fps），全部无音轨。

### ③ 修复：画布侧语义 LoRA 被静默丢弃

`app-src/src/canvas/runner.ts` 发的是 `{ file, strength }`，
而 `solveLoraStack` 只认 `{ name, strength }`：

`js
.filter((x) => x && typeof x.name === 'string' && x.name.trim())
`

传 `{file}` 的条目在归一化时**整条消失** —— 不报错、不进 `rejected`、
总强度按 0 计，最终只有加速学生上机。实测：挂 2 个动作 LoRA，accepted = 0。

已改为 `name: file`，并加护栏测试（既验契约，也验源码里必须是 `name:`）。

### ④ 修复：≤200 字的手写提示词被整句丢弃

`compilePrompt` 只在 `prompt.length > 200` 时整段采用手写稿；
短稿被塞进 `pkg.sceneLayout`，但 `compileRef2VA` 的分支是

`js
if (scenes.length) { 逐镜头 }  else { 用 sceneLayout }
`

而 `toShotInputPackage` **永远**会造默认 `shots` 数组 → `scenes` 恒非空
→ `sceneLayout` 是死字段。实测提交 146 字符的 LoRA 触发词，提示词里一个字都没有。

已改为同时写入 `shots[0].action`（真正被读取的位置），并做去重。

### ⑤ 顺带确认的两个死参数

钢琴那组镜头里存着 `H3完整Sigma序列` + `V81一采使用手动Sigma: true`，
但 V15 把 `sigma_requested` 硬编码为 False（`h3_generator.py:1687`），
三个 Sigma 策略里只有「原生轨迹」可达，**手动序列完全不生效**。
换人线刻意不写这两项，避免误导排障。

真正起作用的 shift 由 DMAD8 学生的训练设定给出（video 12 / audio 2），
由 `generator.js` 的 accel-plan 自动写入。

### 测试

141 条全部通过（新增 8 条换人线 + 7 条 LoRA 栈 + 3 条提示词边界）。
`pnpm typecheck` 0 错误，`pnpm check:routes` 三方一致（13 条路由）。

---

## 2.13.0 — 立绘拆解：拆掉档位/尺寸/描述，只留一个可改的提示词（2026-11-20）

### 问题

立绘拆解原先是「填表」：角色名 / 服装清单 / 附属部件 / 三视图角度 / 补充说明
五个输入，加 `level`（standard / parts / full）与 `sizeId` 两块档位，
正文由 `breakdown.js` 按档位拼装。

**核心问题是改不动结构**：

| 想要 | 只能这样 | 为什么没用 |
|---|---|---|
| 换一套衣服 | 往「服装清单」塞词 | 正文口径仍是「逐件拆出参考图里**已有**的服装」，模型照图走 |
| 加一个视角 | 改「三视图角度」 | 正文里「三个视角」的措辞与排版说明不会跟着变 |
| 改排版/材质要求 | 写「补充说明」 | 该段拼在正文**末尾**，权重最低 |
| 换档位拿更多内容 | 选「完整设定卡」 | `full` 与 `standard` **逐字相同**（表情差分 1.0.2 已移除）|

### 改法

**去掉全部结构化字段与档位，只留一个巨大的提示词输入框。**

| 项 | 旧 | 新 |
|---|---|---|
| 输入 | 5 个字段 + level + sizeId | **一个字符串 `prompt`** |
| 正文 | 后端按档位拼装 | **后端不拼装**，只 `trim` |
| 默认值 | 由字段组合隐式产生 | `DEFAULT_BREAKDOWN_PROMPT`（1159 字符）|
| 尺寸 | 3 档下拉 | 固定 2368×1776（4.2MP）|
| 超长 | `normalizeImagePrompt` 静默 `slice(0,4096)` | **400 `PROMPT_TOO_LONG`**，不静默截断 |

### 默认提示词的关键设计：授权句

这是「改了能生效」的前提。参考图的约束力很强，只写「服装完全以参考图为准」
用户就改不动；只写「按文字改」又会在不动的时候跑偏。所以同时写死两条边界：

```
文字里明确写出的要求优先于参考图：凡是文字里要求替换或新增的服装、配色、部件，
都按文字执行并整体替换掉参考图中对应的部分；
文字没有提到的部分，一律严格照参考图还原。
```

**删掉这句，换装类改动必然失效** —— 冒烟测试有断言盯着它。

其余沿用 1.0.2 的细节锁（逐件单列 / 保持比例朝向 / 材质工艺逐项复刻 /
不丢小件 / 不增删），并保持「纯文本、不编号小标题」两条老约束
（编号会让产出图里出现编号与乱码）。

### 前端

`BreakdownPage.tsx` 从四步改成三步：① 选立绘 → ② 改提示词 → ③ 结果。

- 提示词框 `minHeight: 60vh`（截图实测 840px 高），等宽字体
- 顶部三个动作：**恢复默认 / 清空 / 校验**
- 计数字样 `N / 4096 字符`，改动后的徽章从「默认值」变「已改动」
- 草稿存 `localStorage`（键 `jz.breakdown.promptDraft.v1`），刷新不丢
- 结果页额外显示**本次实际提交的提示词** —— 改了没生效时能立刻自查提交的是哪一版

### 顺带修掉的两个真问题

**① 默认选中一张解码必失败的占位图**

素材列表首个元素是冒烟测试留下的 `jz-test.png`（155 字节，64×64），
页面原先直接 `imgs[0]?.rel` 预选它。ComfyUI 读它报

```
COMFY_EXEC_ERROR @LoadImage: [Errno 542398533] Generic error in an external library: 'avcodec_receive_frame()'
```

—— 一个完全看不出根因的错误，而用户每次进页面都默认选中它。
现在按 `MIN_REF_IMAGE_BYTES`（32 KB）过滤：可用的才预选，
不可用的仍列出但置灰并标「体积过小，不可用」（直接隐藏会让人以为素材丢了）。

**② 提示框里渲染出了字面量 `**`**

引导语里写了 `**提交给模型的全部提示词**`，但那是 JSX 文本节点不是 Markdown，
页面把星号原样显示出来了。改为 `<b>`。

### 兼容

`character` / `outfit` / `parts` / `views` / `notes` / `level` / `expressions` /
`sizeId` 传了**不报错**，但不再影响提示词，响应里回 `legacyFieldsIgnored`
明确告知调用方（不制造「我传了 outfit 却没生效」的黑箱）。

### 验证（真浏览器 + 真 ComfyUI）

用 Edge headless + CDP 驱动页面点真按钮，走真 ComfyUI，同一张立绘跑 A/B：

| | 提示词 | 结果 |
|---|---|---|
| **A 默认** | 1159 字符，未改动 | 条纹衬衫 + 黄色短裤 + 毛腿 + 羊角 + 耳饰，**与参考图一致**，另出服装/部件拆解 |
| **B 改衣** | 484 字符，服装段换成白色高领毛衣/米色外套/灰长裤/白短靴 | **整套换掉**；羊角、发色、毛腿（未提及项）保持原样 |

对应产物：`outputs/job_mwns4gpd67gcc4.png`（A）、`outputs/job_mwns7nteook3es.png`（B）。

### 提示词框旁加复制按钮

需求是"能把默认提示词复制出来"。做了两个入口（都在提示词面板标题栏，
紧挨着输入框）：

| 按钮 | 复制什么 | 用途 |
|---|---|---|
| **复制默认值** | 后端下发的 `DEFAULT_BREAKDOWN_PROMPT`，**不受输入框当前内容影响** | 备份、发给别人、粘到别处对照 |
| **复制当前** | 输入框里这段，即**实际会提交的那段** | 存档一个改好的版本 |

- 输入框为空时点「复制当前」会**回落到默认提示词**，不会复制一个空串
- 剪贴板走 `navigator.clipboard.writeText`，失败时降级到
  `textarea + execCommand('copy')` —— DSH Desktop 的窗口 origin 是
  `dsh-app://app`，那是自定义协议，剪贴板 API 未必可用；没有降级的话
  复制会静默失败，用户以为复制了、实际剪贴板还是旧的

**⚠️ Windows 剪贴板会把 `\n` 规范化为 `\r\n`。** 写进去 `A\n\nB`、读回来是
`A\r\n\r\nB`；`writeText` 与 `execCommand` **两条路径都如此**，这是 text/plain
的平台约定，不是缺陷。默认提示词有 14 个空行，所以复制结果的字节数会比
页面显示多 14 —— 比对/测试必须归一化换行，逐字节比会误报。

### 顺手改掉的一个可用性问题

页面原先默认停在「① 选立绘」，那个巨大的提示词框和它的几个按钮要点一次
「下一步」才看得到。但这一页的核心就是改提示词，而参考图在加载时已经自动
选中第一张可用的图了 —— 于是改成**首屏直接落在「② 改提示词」**。
选图仍可点步骤条或「换一张」回到 ①。

### 测试

137 条全部通过（新增 11 条：默认提示词完整性 / 授权句存在 / 原样返回 /
空值回落 / 作废字段回报 / 尺寸固定 / meta 契约 / preview 回显 /
超长 400 / 前端只留一个输入框）。`typecheck` 0 错误，`check:routes` 三方一致。

另加 2 条纯前端护栏（复制按钮存在 + 剪贴板降级 + 空输入回落 / 首屏落在提示词步骤），
以及一个真浏览器验证脚本 `tools/_e2e-copy.mjs`：
点按钮 → `navigator.clipboard.readText()` 读回 → 与页面/后端逐字比对（归一化换行），
12 项断言全绿。

---

## 2.11.0 — Sakuga 实战验证 + 二采/续写互斥确认（2026-11-19）


### ① 确认：潜空间续写与二采硬互斥

`vendor/nanfeng/h3_generator.py:1325` 写死：

```
V15 潜空间续写要求前后采样画布相同，请关闭潜空间放大二采
```

**所以「长镜头 + 高画质」在当前架构下无法同时满足。** 实测数据：

| 方案 | 分辨率 | 帧数 | 结论 |
|---|---|---|---|
| 续写 + 0.5MP 单采 | 960×544 | 124 | 动作一快就糊 |
| **二采 0.5→1.2MP，不续写** | **1472×832** | **158** | 边缘锐度 +9.5% |

边缘增强后亮度均值（同尺寸对比）：68.03 → **74.49**。

### ② Sakuga LoRA 的正确用法（实测总结）

`Sakuga Style — Anime Action & Fight Choreography`（Civitai id 3055989，
触发词 `sakuga_style`，rank 16，158 帧训练长度）三条硬规则：

1. **触发词必须放最前**，官方建议前缀 `2d anime style, sakuga_style, ...`
2. **帧数必须满足 `帧数 % 17 == 5`**，158 帧（6.58s）是训练长度最稳
3. **两人场景同一时刻只能一人动** ——
   官方原文："Keep one body in motion at a time in two-person scenes"

第 3 条最容易被忽略。违反它的表现是：两个角色同时高速动作 → 模型把"该切的地方"
渲染成模糊过渡，看起来就是"一快就糊"。

### ③ 两个语义 LoRA 叠加会互相拉扯

实测 `Combat BASE` + `Sakuga` 同挂（总强度 1.25，未超阈值）仍然糊。
原因是**目标相反**：

- Sakuga 求「断裂感 / 定格余韵」，官方描述含 *held aftermath*、*cuts that land on beats*
- Combat 求「连续物理链」，官方描述是"摆脱攻击→复位的回合制"

**结论：二选一。** 且两者 rank 差 8 倍（DMAD 128 vs Sakuga 16），混合时小 rank 贡献被稀释。

### ④ 最终成片参数（方案 A）

```
画风        = 90s OVA（提示词通道，styleId='ova90s'）
打光        = dramatic-4-1（4:1 两档，硬边阴影）
加速        = DMAD 8step @ 1.0，shift 12/2（已生效）
语义 LoRA   = sakuga_style_v1 @ 0.85（单个）
采样        = 8 步 lcm/simple
画布        = 0.5MP → 二采 1.2MP
续写        = 关闭
输出        = 1472×832 / 158 帧 / 6.58s
```

提示词 6155 字，采用钢琴那次的完整七段式打光写法（主光角度、光比、
硬边阴影边界、材质响应），而非一句 `dramatic-4-1`。

### ⑤ 清理与本轮工程状态

- 清理运行时缓存：`__pycache__`、Blender 预演中间帧（34.5MB → 0.1MB）
- 项目总体积 96.8MB → 62.3MB
- 全项目校验：**112/112 冒烟通过**、路由三方一致、host 0 语法错误、
  TypeScript 0 错误、vendor Python AST OK

---

## 2.10.1 — 画风通道解耦（2026-11-19）

> 用户实测反馈：想「关掉 OVA 画风、用画风 LoRA」，发现关不掉。

### ① `styleId: 'none'` 真的能关掉画风

**问题**：`resolveStyle()` 在没有 `styleId` 时**静默回退到 `STYLE_PRESETS[2]`**
（90 年代 OVA）。于是"不指定画风"这件事**做不到** —— 传空值、传 undefined
都会拿到整串 OVA 描述。而挂画风 LoRA 时，这串描述会和 LoRA 权重互相打架：
提示词说 OVA、权重说 claymation，产出"两边都不像"的中间态。

**修法**：加一个 `styleId === 'none'` 分支，返回 `en: ''` 的空画风。
`styleLeadSentence` 检测到空串就不注入任何定调句 —— 画风完全交给 LoRA。

实测：`ova90s` → 484 字（含画风串）；`none` → **111 字**（画风串完全消失）。

### ② `/prompt/meta` 下发「不指定」选项

以前前端只有 11 个画风，没有"关闭"。现在列表首位是
`none · 不指定（交给 LoRA）`。

### ③ 渲染页默认画风改为 `none`

默认塞一个画风串会让"用画风 LoRA"这条正常路径必然冲突。
默认不指定、需要时再挑，才是正确默认。

### ④ 画风冲突提示

同时选了内置画风 + 挂了 `30_style/` 的 LoRA 时，渲染页显示警告，
说明两者会互相拉扯，建议改成「不指定」。**不强行改用户选择，但必须让他看见。**

### ⑤ 补回上一轮被误回滚的修复

编辑 `STYLE_PRESETS` 时误操作导致 `git checkout` 回滚了整个 `h3-prompt.js`，
丢掉了 2.9/2.10 的两处修复，已逐条补回：

- `truncatePromptKeepFields()`（按字段边界截断，保住六个字段）
- 中文 `description` / `traits` 不进英文句法（避免中英混排）

### 验证：六组画风实测

统一条件：**同一提示词 2104 字、均不含任何画风词、同 seed、8 步 DMAD、`styleId=none`**。
差异只能来自画风 LoRA。

| 变体 | LoRA | 强度 | 观感 | 产物 |
|---|---|---|---|---|
| A 基线 | 无 | — | 中性 3D/2D 混合、冷调 | 1.30 MB |
| B | `claymation_style` | 0.85 | 高饱和暖橙、捏塑质感、边缘生硬 | 1.38 MB |
| C | `studio1939_old_animation` | 0.85 | 褪色胶片、扁平上色、1930s 赛璐珞 | 1.04 MB |
| D | `vh5tape_vhs` | 0.85 | 低对比、扫描线、录像带色偏 | 0.85 MB |
| E | `16bit_pixel` | 0.9 | 像素化、色阶量化 | 1.55 MB |
| F | `anime_2d_style` | 0.85 | 平涂 cel、清晰线稿、高饱和 | 1.57 MB |

六组**提示词逐字相同**（2104 字），产物与观感全部不同 ——
证明画风 LoRA 确实在起作用，且提示词通道没有污染。

### ⑥ Civitai 实况（供后续选型参考）

- H3 LoRA 总数 **1172**（NSFW 480 / SFW 692），有效 base model 只有 `MiniMax H3`
- Civitai Red 返回 **403**（需认证）
- Civitai 下载链接全部 `307 → /login?reason=download-auth` —— **需登录**
- 可用替代：**HuggingFace 镜像免认证**（本轮 6 个画风 LoRA 全部从 HF 取得）

---

## 2.10.0 — shift 真正生效 + LoRA 分类加载器（2026-11-19）

> 第十轮：把上一轮遗留的两件事做完 —— **DMAD 的 shift 12/2 真正落实**，
> 以及把 LoRA 从"一串文件名"升级成**按功能分类、带互斥与衰减的选择器**。

### ① shift 12/2 真正生效（改 vendor）

**问题**：`vendor/nanfeng/h3_generator.py:1687` 是 `sigma_requested = False`，
于是 `MiniMaxH3SigmaShift` 节点**永远不会被插入**，shift 只能用模型自带的 12/3。
而 DMAD 4/8step 都是在 **12/2** 上训练的（两个 `.safetensors` 的
`__metadata__.sampling` 里写着原文，可直接读文件核对）——
用 12/3 就是分布外采样，不报错，只是画质与动态悄悄变差。

**改法**：把一件事拆成两件：

```python
sigma_requested  = bool(kwargs.get("启用西格玛调节", False))   # 原：恒 False
need_sigma_shift = bool(sigma_requested)                      # 决定插不插节点
sigma_enabled    = sigma_requested and 策略 != 原生轨迹         # 决定要不要加密/手动序列
```

`Sigma策略=原生轨迹（不加步）` 现在的含义是「**不改步网格，但仍可指定 shift**」——
正是蒸馏学生需要的形态。

**实测验证**（直接在 ComfyUI 的 python 里跑 `INPUT_TYPES` + `generate` 展开图）：

| 配置 | SigmaShift 节点 | 参数 |
|---|---|---|
| `启用西格玛调节=False` | ❌ 无 | — |
| `=True, audio=2` | ✅ 有 | `shift_video=12.0, shift_audio=2.0` |
| `=True, audio=3` | ✅ 有 | `shift_video=12.0, shift_audio=3.0` |

链序也对：带 LoRA 时 `SigmaShift.model` 指向上游 LoRA 节点（LoRA → shift → sampler）。

**真实渲染对比**（同一张参考图、同 seed、8 步 DMAD）：

| | 12/2 | 12/3 |
|---|---|---|
| 规格 | 864×480 / 124 帧 / 5.167s | 同 |
| 大小 | 916 689 B | 926 747 B |
| 帧间 PSNR | — | **24.78 dB**（差异显著但都正常出片） |

结论：12/2 现在真正生效，且没有破坏原有行为。

### ② LoRA 分类体系（新增 `host/services/lora-catalog.js`）

**调研结论**：H3 的 LoRA 在 Civitai 上共 **1173 条**（`Base Model` 字符串只有
`MiniMax H3` 一个有效值），可归为 **12 个互斥功能轴**，其中 **6 个是单选**。

新增模块把这件事显式建模：

```js
LORA_CATEGORIES = [ {folder, id, label, mode, strength, stackDecay, signed, why}, ... ]
classifyLora(name)     // 目录优先 → 文件名正则 → 兜底 inbox
catalogLoras(files)    // 批量归类
solveLoraStack(items)  // 单选替换 / 同类衰减 / 总强度看门狗
```

**三条强制规则**（不靠用户自觉）：

1. **单选类只留一个** —— 换选自动替换，并说明「谁被谁换了」
2. **多挂类自动衰减** —— 同类第 2 条起 ×0.6
   （依据：Motion Repair 官方「单独 0.9 → 配 Combat 0.5–0.7」）
3. **总强度看门狗** —— 不含加速学生，>1.5 警告、>1.8 剔除最弱的一条
   （依据：社区实测「above ~1.5 often breaks motion coherence」）

**加速学生特殊处理**：

- 强度**恒 1.0**，用户填 0.7 会被纠正回 1.0 并说明原因
- **不计入**总强度（否则「DMAD + 一个动作 LoRA」就逼近上限，正常组合被误杀）
- 永远排槽 1（它要覆盖后续所有语义偏移）

### ③ 目录约定（ComfyUI 递归扫描，目录名成为路径前缀）

```
models/loras/
├─ 00_turbo/  10_camera/  20_motion/  21_motion_slider/
├─ 30_style/  31_look_slider/  32_quality/  40_character/
├─ 50_audio/  60_vfx/  70_utility/  99_inbox/
```

已实际创建这些目录，DMAD 两个文件已移入 `00_turbo/`，
并写了 `models/loras/README.md`（每类放什么、触发词、推荐强度）。

**踩到并修掉的坑**：ComfyUI 递归扫描后返回的名字**带目录前缀**
（`00_turbo\dmad_..._8step_....safetensors`），而 `ACCEL_PLANS` 里声明的是
**纯文件名** —— 直接 `includes()` 永远匹配不到，表现是「明明装了却报没装」。
现在比对用纯名、提交用完整名。

### ④ 新增 REST 路由

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/lora/catalog` | 12 类定义 + 当前装了哪些 + 自动归类结果 + 每类计数 |
| POST | `/lora/solve` | 传候选 LoRA，返回单选替换/衰减/剔除的完整决策 |

`probed=false` 明确表示「没探测到」（ComfyUI 不可达），**不是**「一个都没装」。

### ⑤ 前端 LoRA 选择器（新增 `components/LoraPicker.tsx`）

不再是"给一串文件名让人瞎猜"，而是：

- **按 12 个分类分组**，每个分类带一句「为什么是这个规则」
- 单选类用下拉（物理只能一个），多挂类用可勾选按钮 + 强度输入
- 滑块类标注「有符号」，0 = 不生效
- **实时显示「你填的值 → 实际生效的值」**，以及每处替换/衰减/剔除的原因
- 空分类也显示（灰掉），提示「把 LoRA 放进 `models/loras/xx_xxx/`」
- 未探测到 ComfyUI 时明确提示「这不代表一个都没装」+ 重新探测按钮

已接入渲染页，选择结果存进 `shot.nanfeng.loras`，随镜头卡走。

### 验证

| 项 | 结果 |
|---|---|
| 展开图含 SigmaShift | ✅ `shift_video=12.0, shift_audio=2.0` |
| LoRA → shift 链序 | ✅ `SigmaShift.model` 指向上游 LoRA |
| 12/2 vs 12/3 真实渲染 | ✅ 均正常出片，PSNR 24.78 dB |
| 分类器（15 个样例） | ✅ 全部归类正确（含目录优先、文件名回退、兜底） |
| 约束求解（8 个场景） | ✅ 单选替换/衰减/硬上限/滑块/冲突提示全对 |
| 冒烟测试 | **111 / 111** |
| 路由一致性 | ✅ 三方一致 |
| TypeScript | `tsc --noEmit` **0 错误** |
| 前端构建 | ✅ 通过 |

---

## 2.9.0 — 全链路审计修复 + LoRA 加载器 + 人物替换可用化（2026-11-19）

> 第九轮：五路并行审计（前后端一致性 / host 服务层 / Blender 管线 /
> 提示词编译器 / LoRA 生态调研），按"真实使用中爆炸概率 × 后果"排序修复。
>
> **一句话概括本轮**：把"看起来成功、其实没做"的静默失败模式挨个拆掉，
> 并把 LoRA 从"写死文件名"升级成"按实际安装情况成套匹配"。

### ① P0 · 参考视频/音频被整条丢弃（Blender→H3 硬断点）

`generator.js` 的两条执行路径都写成 `Array.isArray(shot.videos)`，
而镜头卡上**从来没有**这个顶层字段（只有 `shot.refs.videos`）：

- `videoEntries` 恒为空 → 不 stage → `视频1..3` 永远是「未选择」
- 南风路径更糟：`shotForNanfeng.refs.videos = stagedVideos.map(...)`
  把**本来正确的 `refs.videos` 覆盖成 `[]`**

后果：3D 预演渲出的白模视频在提示词里写着 `<Video 1>`，
提交时却根本没有这个素材 —— 用户看到「已挂上」、出片完全不含白模约束。

修法：新增 `resolveMediaEntries()` 统一从 `refs.videos/audios` 解析；
新增 `warnMissingMedia()` 把丢失的素材写进 `job.warnings`；
staged 结果**保位不压缩**（避免"第 2 个失败导致第 3 个前移"）。

### ② P0 · 角色卡注入覆写官方英文提示词

`injectCardDefinitions()` 只要"卡名没出现在提示词里"就整段替换
`subject_definitions:`。而智能分镜用英文名（`Chika`）、角色卡用中文名
（`三角初华`）—— 判据几乎恒 false，于是**每次生成都会**：

- 把官方英文 `<Subject N> is the visual content referenced from <Picture N>...`
  整段换成中文「三角初华：外观以 <Picture 1> 为准」
- 顺带吃掉同段里的 `<Video N>` / `<Audio N>` 定义句
- 净删数百字符已校验内容，产出中文正文（违反"正文必须英文"铁律）

实测：6280 字符 → 5623，英文 Subject 句消失。
而 `lintCompiledPrompt` 跑在编译期、注入在提交期，中文没人检查得到 ——
这是"提示词写得很好、出片却不像"的一个直接来源。

修法：**绝不覆写已有 `subject_definitions`**，只在缺失时前置，
且新增文本一律英文。

### ③ P0 · 首尾帧顶掉角色参考图

`frameSlotOverrides()` 直接写 `图片1`，而 `buildShotOverrides()` 已经把
`refs.images` 填进 `图片1..9`。extraParams 优先级最高 → 角色图被 previz 首帧
顶掉，但提示词里 `<Picture 1>` 仍写着"这是角色外观"。
南风的 `i2va-needs-one-image` 只查**总数 == 1**，覆盖后仍是 1，约束也拦不住。

修法：新增 `planImageSlots()` —— 首/尾帧占用的槽位从参考图里剔除，
其余按原顺序补位，并把 `pictureIndexMap` 传给注入层重新编号。

### ④ P0 · 数据丢失：shots.json 损坏时静默清空

`listShots()` 是 `catch { return [] }`，而 `upsertShot()` 紧接着用这个空数组
重建并**覆盖写** —— 用户的全部镜头卡就此消失，且没有 `.corrupt` 备份。

修法：改走 `json-store.readJson`（解析失败保留 `.corrupt` 并抛
`CORRUPT_JSON`）；`upsertShot` 的读-改-写整体放进 `updateJson` 串行队列，
并把 tmp 名从固定的 `${pid}.tmp` 改成"pid + 时间戳 + 随机"，
消除并发写同一 tmp 互相覆盖的窗口。

### ⑤ P0 · 路径穿越（三处）

| 位置 | 漏洞 | 实测 |
|---|---|---|
| `generator.js` 参考图 | `path.isAbsolute(ref)` 直接放行 | `refs:["C:/Windows/win.ini"]` 可读 |
| `api/index.js` 立绘拆解 | 同上 | 同上 |
| `blender-service.js` | `jobId` 未过 `safeId` 就拼路径 | `../../../../evil` 写出 dataDir |

修法：全部改走 `security.resolveUserPath` / `safeId`。

### ⑥ P0 · 画布 AI 面板首次打开即崩

`GET /canvas-agent/meta` 返回 `{...meta, permissions: getCanvasPermissions()}`
—— 把**能力清单数组** `permissions: Perm[]` 覆盖成 `Record<string,boolean>`
对象，前端 `meta.permissions.map(...)` 直接 TypeError。

修法：改用 `current` 键（前端已按 `m.current ?? m.defaults` 读取，零改动）。

### ⑦ P1 · 其它静默失败

- **中文文件名塌缩**：`safeStem` 把 `立绘.png`/`设定.png`/`侧面图.png` 全变
  `_____.png` → 多张参考图互相覆盖。改为「ASCII 段 + 内容哈希」
- **超长提示词硬切**：`slice(0,7000)` 从中间砍断六个字段（`overall_soundscape`
  与 `non_diegetic_music` 必丢）。改为 `truncatePromptKeepFields()`
  按字段边界截断，保住全部字段名
- **`buildRenderPlan(shot, cfg)` 签名错误**：该函数是解构对象入参 →
  `cards`/`manualImages` 全丢，`mediaNotes` 恒空。改为正确对象入参
- **`deriveSubjectsFromShot` 不看 9 张上限** → `<Picture 10..12>` 悬空
- **日志并发丢记录**：`appendLog` 读全量-改-写全量。改走 `updateJson`
- **续写批次定时器泄漏**：`clearInterval` 只在三个分支里，异常路径会悬挂
- **`saveBatch` 的 Windows `EPERM` 竞态**：裸 `writeFileSync + renameSync` 且 tmp 名
  固定为 `${f}.tmp`。冒烟测试实测偶发
  `EPERM: rename '.../<id>.json.tmp' -> '.../<id>.json'`
  （杀软扫描 / 句柄未释放），**12 次跑挂 1~2 次**。改为唯一 tmp 名 + 8 轮退避重试，
  与 `json-store` 同一套写法；修复后 12/12 全绿
- **body 过大/畸形 URL**：`req.destroy()` 后再 `sendJson(400)` →
  客户端只看到 ECONNRESET。改为 `req.pause()` / 解码失败返回 400
- **`studio_shot.save` 忽略 `shotId`** → 每次保存都新建镜头，镜头表爆炸
- **workshop 任意文件读**：`path.resolve(file)` 不设防。改为限定 dataDir
- **`/assets/archive` 绕过子目录白名单**：能把 `config.json` 归档进素材库再下载

### ⑧ LoRA 加载器（重写）

**问题**：`ACCEL_PLANS` 里的 `lora` 是写死的文件名；用户换机 / 重命名 /
只装一个学生时，轻则 `value_not_in_list`，重则被 sanitize 回退成「未选择」
→ 蒸馏栈变空 → **4/8 步跑在未蒸馏原模型上，能出片但质量悄悄崩**。

**现在**：

1. **启动前探测** ComfyUI 真实 `loras` 目录（`object_info` 是唯一权威）
2. `classifyAccelLora()` 从文件名识别家族与步数
3. `resolveAccelForFiles()` 四级匹配 —— 声明名存在 → 同家族同步数 →
   **同家族不同步数则整套切换方案**（LoRA 与步数必须成套）→ 都没有则明确告警
4. `planLoraStack()` 装配 8 个槽位：
   - **LoRA1 = 加速学生，强度恒 1.0**（它是学生本体，不是风格补丁）
   - LoRA2..8 = 语义 LoRA，按叠加规则衰减（1 个 0.7 / 2 个 0.6 / 3 个 0.5）
   - 每槽的 `LoRA{n}启用` / `LoRA{n}` / `LoRA{n}强度` **每次生成都显式写死**，
     杜绝残留
5. 加速学生必须放槽 1（`_enabled_lora_stack` 按 1→8 串，语义 LoRA 要叠在
   蒸馏后的权重上）

### ⑨ 人物替换 skill 可用化

原 skill 只在"提示词层"禁音频标签，但 **H3 Ref2VA 会把参考视频自带的音轨
自动接成 `<Audio j>`**（`nodes_minimax_h3.py:352` 的 `if soundtrack is not None:`）
—— 音频编号是**素材驱动**的，不写标签 ≠ 没有音频。

- 新增 `POST /post/stripAudio` + `studio_post{op:'stripAudio'}`
  （视频流 `-c:v copy` 原样复制，无重编码无画质损失）
- 实测：源 1246004 B 含 aac 音轨 → 产物 1158195 B，流类型 `["video"]`，
  1056×608 / 5.167s 完全保留
- skill 升级到 v1.1.0：把「音频必须从素材层剥掉」提到铁律 1，
  并补上为什么提示词层做不到

### ⑩ 前端与自检

- `motionLoraStrength`（动作 LoRA 强度）从**纯装饰**接线到语义 LoRA 强度；
  新增「语义 LoRA」列表字段
- 删除 4 个无后端能力的假开关（`generateAudio` / `returnLastFrame` /
  `freeVramBeforeRun` / `watermark`）与 `negativePrompt`
- 画布 `runner.ts` 补 `steps` / `accelPlan`（后端本就支持，画布从不传）
- 图片节点键名修正：UI 是 `size`、runner 读 `sizeId` → 恒兜底；
  新增 `pixelToSizeId()` 映射
- 版本号不再硬编码 `0.1.0`，构建期从 `package.json` 注入 `__APP_VERSION__`
- **`tools/check-routes.mjs` 重写**：旧实现的兜底条件
  `bp.split('/')[0] === head` 让**真 404 检出率归零**（实测
  `/post/doesnotexist`、`/blender/whatever` 全部"一致"）。
  现在按 (method, path) 双键 + 路由族匹配，并做反向死路由统计

### ⑪ 文档

- **README 全面重写**：从"参数说明书"改成"这个插件解决什么问题"，
  补 LoRA 分层、DMAD 成套表、人物替换前置条件
- 光比表补全到 7 项（原缺 `closeup-6-1`，且 `rim-backlit` 标错）
- 参数体系表述修正为 A/B/C/D 四类（C=47 死 / D=48 缺依赖，共 95 无效）

### 验证

| 项 | 结果 |
|---|---|
| 冒烟测试 | **111 / 111** |
| 路由一致性 | ✅ 三方一致（62 条前端 method+path 全部命中） |
| 参数审计 | 217 参数 / 95 无效（47 dead + 48 banned） |
| TypeScript | `tsc --noEmit` **0 错误** |
| 前端构建 | ✅ 单 bundle，无残留旧产物 |
| host 全模块语法 | 0 错误 |
| `apply()` 真跑 | 3 条路由 + 13 个工具全部注册 |
| 路径穿越 | 4 组恶意路径全部拒绝 |
| `stripAudio` | 真跑验证，音轨移除、视频流无损 |
| 11 个 skill | 全部被发现，含 `h3-character-replace` |

---

## 2.8.1 — 成片移出版本控制（2026-11-18）

> 生成的成片与抽帧不应出现在 GitHub 上。

### 改了什么

| 项 | 处理 |
|---|---|
| `docs/result/`（两轮成片 + 抽帧，约 14 MB） | `git rm --cached`，**本地文件保留** |
| `docs/probes/`（历史探针产物） | 加入 `.gitignore` |
| `.gitignore` | 新增两类规则（见下） |

新增的忽略规则：

```gitignore
docs/result/      # 生成的成片与抽帧
docs/probes/      # 历史探针产物
*.mp4  *.mov  *.webm  *.mkv  *.avi   # 任何位置的大媒体文件
```

### 为什么

- 这些是**运行产物**，不是源码。每轮实验产出几十 MB，累积会把仓库撑爆
- 二进制文件在 git 里**无法增量存储**，历史只增不减
- 想看效果应当自己跑一次——插件用的是本地模型，本来就该本地出片

保留的是**可审阅的文本**：`docs/VIDEO-ANALYSIS.md`（逐镜分析）、
`docs/prompts.json`（6 段提示词）、`docs/CONTINUATION-VS-UPSCALE.md`（机制查明）。
这些才是能被人 review、被 git 有效管理的部分。

### 未做的事（明确记录）

`.git` 目录里仍保留约 105 MB 历史 blob（以前的探针产物和两轮成片）。
**本次没有重写历史**——重写会改变所有 commit hash，
需要 force push，其他协作者必须重新 clone。

当前状态：仓库新提交里不再有媒体文件，但克隆下来的 `.git` 仍含历史。
若将来确实要瘦身，可以用 `git filter-repo --path docs/result --path docs/probes --invert-paths`
（会重写全部历史）。

### 验证

- `git ls-files | grep -E '\.(mp4|jpg|png)'` → **空**（仓库里已无媒体文件）
- 忽略规则校验：`docs/result/x.mp4` / `docs/probes/a/b.mp4` / `*.mp4` 全部 IGNORED
- `docs/` 下 9 个 md/json 文档全部完好
- 冒烟 111/111

---

## 2.8.0 — 人物替换 skill + 续写×二采机制查明 + 两条硬要求（2026-11-18）

> 第八轮：新增一个 skill，把一条被误传为「功能互斥」的限制查清楚，
> 并按实际使用反馈收紧提示词质量要求。

### ① 新增 `h3-character-replace`（人物替换）

来源：群友 `人物替换skill.txt`。视频换人 / 角色替换专用。

**它与本插件原有的六字段规范是互斥的**，这一点写进了 skill 里：

| 项 | 常规六字段 | 人物替换 |
|---|---|---|
| 字段数 | 6（含两个声音字段）| **4 段**（无声音字段）|
| `<Audio N>` | 可有 | **禁用** |
| 光影描述 | 七段式 | **禁用，100% 继承 `<Video 1>`** |
| `Forbidden` 列表 | 有三处合法位置 | **禁用** |

补了 5 节插件侧落地说明：提交参数、与续写的关系、与光影参数的关系、
常见失败与对策、四段式模板。现在 **11 个 skill**。

### ② 续写 × 二采「冲突」的真实机制

之前一直按「上游说互斥就是互斥」处理。这轮把源码读透了，结论是：

**不是两个功能互斥，是分辨率在链上不能变。**

证据链：

1. `ComfyUI-H3-Motion-Context/nodes.py:416` —— 比对 `context_latent` 的宽高，
   不等就 `raise ValueError`，注释写明 **"a latent cannot be resized"**
2. `h3_generator.py:1892-1905` —— 二采把一采 latent 放大到
   `H3潜空间目标百万像素`（如 0.4 → 1.2MP）
3. `h3_generator.py:2048-2052` —— `CommitContinuation` 存的是 **`sampled.out(0)`**，
   即放大后的 latent
4. 于是下一段一采还在 0.4MP，读上段 1.2MP 的 latent → 尺寸不符 → 报错

所以上游在 1322 行提前拦截是**正确的**，不是过度保守。

**结论：想高清+连续，提高一采 `百万像素`，不要开二采。**
（像素域 RTX 超分不受这条限制，可以叠。）

完整论证见新文档 **`docs/CONTINUATION-VS-UPSCALE.md`**（含 5 条证据链、3 种合法替代方案、4 条常见误区）。

### ③ 提示词上限从 7000 收紧到 6000

官方 7000 是**硬拒绝线**，不是**质量最优线**。

实测 6500–7000 区间，六字段注意力被稀释 ——
`detailed_description` 里的动作细节会被后段的光影/声音描述盖过，
表现为「动作写得很细，成片没做出来」。

代码改动：

- `H3_LIMITS.promptMaxChars: 7000 → **6000**`
- 新增 `H3_LIMITS.promptOfficialMaxChars: 7000`（区分"我们收紧"与"上游会拒"）
- `lintCompiledPrompt()` 分两道提示：超 6000 给压缩优先级建议，超 7000 额外警告上游可能拒

同步到 `h3-group-master` §0.3 / §P 检查清单、`jiuzhang-prompt-spec` §8。

### ④ 新增「续写时的服饰一致性」强制要求

`h3-group-master` 新增 **§1.6.5**，`jiuzhang-prompt-spec` 检查清单同步。

原因：latent 只带「上一段的实际画面」，**不带这套衣服的设计说明**。
不写就会逐段漂：刺绣糊成一块布、蕾丝变平布、开叉位置走位。

三类信息待遇不同：

| 类型 | 例子 | 写法 |
|---|---|---|
| 会自然延续的 | 布料色相、大致轮廓 | 只声明继承 |
| 会被稀释的 | 刺绣、蕾丝密度、金属件位置、开叉高度 | **每段重述，用同一组词** |
| 必须锁死的 | 配饰左右方位、图案方向、扣具位置 | **逐项复述，措辞不变** |

四条铁律 + 两个实际角色（初华 / 祥子）的 `Outfit anchors` 现成写法。

### 验证

- 冒烟 **111 / 111**（新增 2 项：6000/7000 两级长度、续写×二采拦截）
- 42 模块 + `client.js` 语法、`tsc --noEmit`、`check-routes` 三方一致
- 无头浏览器 12 路由全部 OK
- 11 个 skill 全部可发现

---

## 2.7.0 — 文档与代码对齐（2026-11-18）

> 第七轮：不写新功能，把**文档里与代码不符的数字和清单**全部对齐。
> 这一轮的价值在于：以后任何人（或 AI）照文档做事，不会再被坑。

### ① `skills/architecture` 的 API 全表重写

旧表声称「~100 条 REST 路由」，实际是 **92 条**（86 精确 + 6 参数化展开）。
逐条核对 `host/api/index.js` 后发现三类问题：

| 问题 | 具体 |
|---|---|
| **漏写整组** | `/h3/workshop/*`、`/h3/film/*`、`/import/*`、`/toolbox/health`、`/wardrobe/resolve`、`/resources/previz/clean` 都没写 |
| **缺方法** | `/templates` 等只写 `GET·POST`，实际有 `upsert` / `delete` 独立路径 |
| **不存在的路由** | 表里写了 `DELETE /projects/:pid/shots/:sid`，实际**没有**（删镜头走 `studio_shot {action:'delete'}`）|

现在按 11 个分组重写，每条注明方法 + 用途 + 关键限制，并补充：

- `/nanfeng/presets/:id` 返回的是**未经** `applyFixes` 的快照，不等于实际提交值
- `/post/qc` 的 REST 入参与工具入参**形状不同**
- `/h3/film/render` 的 `inputs` 必须在 `dataDir` 之内
- 新增「4.11 已删除的路由」—— `script/comic/mw` 共 30+ 条，避免照旧文档调用

### ② `docs/PARAM-AUDIT.md` 计数校正 + 10 个漏标参数补进代码

旧表记 A=107 / C=54，与 `inertParams()` 实际输出对不上。真实值：

```
217 = A 114 + B 8 + C(dead) 47 + D(banned) 48
无效合计 95（44%），真正可用 122（56%）
```

**旧 C=54 错在哪**：混入了 D 类的一部分；「小脸修复/全局修复」标题写 10 个
但正文列了 15 个；漏标 10 个实际零消费的参数。

**这一轮把这 10 个真正补标进 `param-docs.js`**（此前界面把它们当可调项，
用户调了没反应）：

| 参数 | 证据 |
|---|---|
| `Sigma策略` | `sigma_requested=False`（`:1687`）派生 → 恒 False |
| `全局修复Sigma策略` | 全局修复组零消费（`:2249` 仅声明）|
| `H3二采Sigma` | 只在 `else:` 可达（`:1998-2000`），V15 恒走 `if is_v81:` |
| `尺寸倍数` | 被 `if True` 短路（`:1400-1401`）|
| `参考图尺寸` | 形参零使用（`:1298`）；ref2va 硬编码 `"max"` |
| `SageAttention` | 用户值被覆盖（`:1462-1471`）|
| `启用LoRA` | 只在 `not individual` 生效（`:2063`），V15 恒 True |
| `H3二采LoRA模式` | 包在 `if False:` 里（`:1505-1508`）|
| `H3二采LoRA强度` | 在 `not is_v81` 分支（`:1945-1956`）|
| `固定随机种子` | `generate()` 零读取（`:2129` 仅声明）|

**顺带修了两条错误的 hint**：

- `随机种子` 原写「必须同时打开『固定随机种子』才生效」—— 上游**没有**这个逻辑，
  种子永远按 `随机种子` 的值走。已改为实际行为
- `固定随机种子` 原写「要复现结果必须打开」—— 同理，它是死参数

### ③ 其他过时数字

| 位置 | 旧 | 新 |
|---|---|---|
| `README.md` 特性表 | 85 个无效 | **95 个** |
| `README.md` 参数体系 | 可用 115 / A 107 / C 54 | **122 / 114 / 47** |
| `skills/architecture` 架构图 | `~100 条 REST` | **92 条** |
| `skills/architecture` | `h3-prompt.js 1700+ 行` | **2000+ 行** |
| `skills/architecture` 已知限制 | C 54 / D 48 | **C 47 / D 48 / 共 95 无效** |

> CHANGELOG 里 2.3.0 及更早的历史数字**保留不改** —— 那是当时的事实记录，
> 改了反而看不出"哪一轮修正了什么"。真正的对照表在
> `docs/PARAM-AUDIT.md` 新增的「十、计数校正记录」。

### ④ 顺带发现的文档偏差

- `skills/architecture` 的安装步骤还写着 `Copy-Item -Recurse vendor\nanfeng ...`，
  已改为 `deploy-vendor.ps1`（上一轮新增的脚本）
- `skills/architecture` 的工具表补充了每个工具的**关键限制**
  （如 `studio_shot` 才是删镜头的入口、`studio_jobs` 没有 retry）

### 验证

- 冒烟 **109 / 109**
- 42 模块 + `client.js` 语法、`tsc --noEmit`、`check-routes` 三方一致
- 无头浏览器 12 路由全部 OK（0 异常 0 控制台错误）
- **真实出片**：864×480 / 5.17s / h264+AAC，5 分钟完成
- `inertParams()` = 95（47 dead + 48 banned），与文档一致

---

## 2.6.0 — 群友总纲升到 v2.1 + vendor 归属澄清（2026-11-18）

> 第六轮：把社区总纲从 v2.0（2041 行）升到 v2.1（2105 行），
> 并把「vendor 里的 Python 到底是啥」写清楚。

### 群友 v2.1 相对 v2.0 改了什么

完整差异见 [docs/history/V21-DELTA.md](docs/history/V21-DELTA.md)。要点：

| 类别 | v2.1 的变化 |
|---|---|
| 结构 | 五批 → **16 章**，新增第零章（模式判定/提交参数/分辨率步数/分段策略） |
| 光影 | 五段式 → **七段式**（新增镜面分级 / Bloom 域授权 / 人物干净声明） |
| 禁词 | **新增第十五章**：压制词三处合法位置 + 七类禁用词 + 正向替代库 + 字段级合法性矩阵 |
| 转换 | **新增第十一章** Seedance → H3 转换规程 |
| 分镜 | 新增肢体幅度约束（7.5） |
| 场景 | 新增无靠背长椅行为约束（5.4） |

### 已落进代码的（能自动执行的）

**① 画风串换成官方原文，且不再截断**

`STYLE_PRESETS[].en` 之前是**重写的简版**，而且 Ref2VA 分支下会截断到
180 字符 —— 官方串的约束句**全在末尾**（`NOT 3D` / `NO subtitles` /
`NO photorealistic textures`），截断 = 砍掉全部反模式约束。
实测后果：模型照样渲成 3D、照样出字幕。

现在：10 个画风串逐字照抄官方原文（v2.1 §3.1），整串保留不截断，
超长只给 warning（提示可能抢权重）而不是砍掉。

**② 两道字幕/overlay 防线由编译器自动注入**（v2.1 §15.2）

```
防线 1（画风串后另起一行）：Text suppression: NO subtitles, NO on-screen text,
        NO captions, NO watermarks, NO logos, NO UI overlays.
防线 2（detailed_description 末尾）：Every element inside the frame belongs to
        the physical scene: ... Nothing floats over the image.
```

新增 `SUPPRESSION_GUARDS` 常量。官方 11 个画风串里只有 3/4/5/7 自带
`NO subtitles`，其余靠防线 1 补 —— 而防线 1 是**独立一行**，
不改画风串原文一字，所以不违反「逐字照抄」。

**③ lint 从「46 条白名单」改成「按位置判断」**（v2.1 §15.1）

旧 `lintCompiledPrompt` 用一张 SCAFFOLD 白名单把模板自己的句子逐条豁免，
已经长到 46 条 —— 每加一句模板就要加一条，漏一条就误报一次。

v2.1 给了有原则的判据：压制词只有三处合法位置。现在新增
`scanSuppressionPlacement()`，按位置判断，不再依赖穷举豁免。
实测 7 个用例（3 合法 / 4 非法）全部正确。

### 只进文档、不进代码的

- 七段式光影、镜面分级四级表、Bloom 三域白名单、受压三态、肢体幅度约束、
  表情逆转三段式、禁词七类表、字段级合法性矩阵 —— 这些需要**写提示词的人/模型**
  理解，代码无法自动执行，全部进了 `h3-group-master` 与 `jiuzhang-prompt-spec`
- Seedance 转换规程：本插件 `seedance-cloud` 后端已删除，转换表作为人工参考保留

### vendor/ 归属澄清（回答「这些 Python 为啥在这」）

`vendor/nanfeng/` 是 **ComfyUI 的自定义节点包**，不是本插件的代码。
插件只通过 HTTP 把参数交给 ComfyUI，由这个节点在 ComfyUI 进程内展开成 ~40 个原生节点。

**不能搬到 host/ 或 app-src/ 的原因**：那两处一个是 Node ESM、一个是浏览器代码，
Python 在那里永远不会被执行。唯一合法归宿是 ComfyUI 的 `custom_nodes/`，
而 `vendor/` 是「随包分发但由外部宿主执行」的第三方代码的标准位置。

新增：

- `vendor/README.md` —— 讲清调用链（Agent → 插件 → HTTP → ComfyUI）、
  每个 .py 的职责、运行时依赖（torch/folder_paths 都在 ComfyUI 侧）、
  需要另外装的第三方节点包
- `vendor/nanfeng/deploy-vendor.ps1` —— 一键部署到 `custom_nodes/`，
  目标已存在时拒绝覆盖（`-Force` 才覆盖），跳过 `_removed/`
- `skills/setup/SKILL.md` 新增 §2.5 —— 之前**完全没有**部署 vendor 的说明，
  用户装完插件会发现 `h3-nanfeng` 后端根本不可用

### 验证

- 冒烟测试 **109 / 109**（新增 3 项：画风约束句不丢、两道防线、压制词落位）
- `node --check` 42 个模块 + `client.js`、`tsc --noEmit`、`check-routes` 全过
- **真实出片验证**：864×480 / 5.17s / h264+AAC，画面无字幕无 overlay（防线生效）
- 10 个 skill 全部可发现且可加载正文

---

## 2.5.0 — 「看起来配好了、实际没生效」专项（2026-11-18）

> 第五轮：不做新功能，专门修一类 bug —— **代码跑得通、界面不报错、
> 但你要的那个设置根本没到模型那里**。这一轮找到 11 处。

### P0 — 静默产出错误结果

**① 目录驱动的 COMBO 被回退成默认值（`graph.js` 的 `sanitize`）**

`sanitize()` 用 `schema.js` 里的 options 当白名单，而那份 options 是
**导出那一刻的目录快照**。于是用户后装的任何模型/LoRA 都不在里面：

| 传入 | 实际提交 | 后果 |
|---|---|---|
| `模型: my_h3_int8.safetensors` | 默认 fp8 权重 | 用错权重出片 |
| `LoRA1: dmad_xxx`（新装的） | `未选择` | **蒸馏 LoRA 静默不挂** → 4/8 步跑在未蒸馏原模型上（分布外） |
| `文本编码器: ..._fp16` | 默认 int8 | 用错编码器 |

而 `job.params` 显示的还是用户选的值。现在把 31 个目录驱动参数
（模型/编码器/VAE/LoRA1-8/二采模型/TRT 引擎）列入 `SKIP_SANITIZE`，
交给 ComfyUI 自己校验 —— 它会在 `/prompt` 阶段明确报 `value_not_in_list`。

**② 开二采后「采样步数」完全不生效**

`h3_generator.py:1732-1736`：开二采时 `scheduler_steps` 只取
`H3一采步数 + H3二采步数`，`采样步数` 连读都不读。
而**所有预设和所有加速方案写的都是 `采样步数`** ——
声称 8 步的 DMAD 学生实际跑的是预设里残留的 6+4=10 步，第一段只用 6 步。

新增 `splitSecondPassSteps()`：开二采时按总步数拆成一采(60%)/二采(40%)，
并把拆分明细写进 `job.warnings`。用户显式指定过任意一项则完全不动。

**③ `/h3/film/render` 可读任意文件**

```js
const abs = path.isAbsolute(p) ? p : path.join(cfg.dataDir, p);   // 旧
```
绝对路径原样放行 → `{"inputs":["F:/任意/文件"]}` 能让 ffmpeg 读机器上任何文件
（审计实测读到了 `data/jobs.json`）。全仓其它入口早已收紧，这是漏掉的第 7 处。
现统一走 `resolveUserPath()`，`subtitleFile` 同样处理。

### P0 — skill 体系：文件都对，但模型看不到

**④ 4 个 `SKILL.md` 的 `name` 不是 kebab-case，被 DSH 静默丢弃**

`dsh-skill` 强制 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。`name: H3官方提示词` /
`name: H3一镜到底续写提示词` 全部不匹配 → 只留一条 `logger.warn`，
界面上什么也看不到。受影响：`h3-official` / `h3-nonfirst-i2v` /
`h3-continuation` / `h3-continuation-cuts`。

改为 `h3-official-prompt` / `h3-nonfirst-i2v` / `h3-continuation` /
`h3-continuation-cuts`。同时给 `h3-continuation-cuts` 写了**自己的**
description（原来和 `h3-continuation` 一字不差，两个 skill 无法区分）。

**⑤ `skills/prompt/<x>/SKILL.md` 两层嵌套，DSH 内置发现扫不到**

`dsh-skill-filesystem` 只扫 skill 根目录的**一层**。于是 6 个提示词 skill
（含 26 KB 的群友总纲、官方六段式规范）对模型**完全不可见** ——
用户在对话里说"用 H3 官方格式写"，模型根本不知道有这么个东西。

新增 `host/skills.js`：递归扫描 + 与 `dsh-skill` 一致的校验 + 自有 provider。
现在 10 个 skill 全部可发现。

> ⚠️ 实现时踩到的坑：`ctx.skills` 恒为 `undefined`，因为 `skills` 没写进
> `inject`（故意的，缺技能服务的 profile 里插件也要能用）。
> 必须 `ctx.get('skills')` 才能取到 —— 这一条让第一次尝试**静默失败**了。

### P1 — 用户可见的正确性

| # | 缺陷 | 修法 |
|---|---|---|
| ⑥ | 渲染页提示词框只有 **32px 高**（`rows={14}` 被 `.jz-input` 的 `height` 压掉），三处同源 | `textarea.jz-input` 单独复位 `height:auto` |
| ⑦ | 全站无 ErrorBoundary → 任何渲染异常都卸载整棵树，只剩「载入中…」 | 新增 `ui/ErrorBoundary.tsx`，每个路由独立捕获并显示堆栈 |
| ⑧ | 切镜头只回填时长/模式 → A 的提示词被静默写进 B 的镜头卡 | 回填**所有** `handleRender` 会提交的字段；`ShotLite` 补齐到与提交形状一致 |
| ⑨ | DSH Desktop 下每次点入口都误报「被浏览器拦截」 | `window.open` 返回 null 是 Desktop 的 `setWindowOpenHandler` deny 所致，页面其实已在系统浏览器打开。不再误报，始终留可点链接 |
| ⑩ | `client.js` 2s 轮询无去重，而 `/monitor` 最坏 10s+ → 请求无限堆叠 | 改自调度 + in-flight 标记 + 后台标签页跳过 |
| ⑪ | `BackendId` 联合类型缺 `h3-nanfeng`（正是默认后端）→ 设置页下拉显示空白 | 补类型 + `BACKEND_LABELS` 单一来源，两处下拉都改用它 |

### P1 — 其它正确性

| # | 缺陷 | 修法 |
|---|---|---|
| ⑫ | `callText`/`callVision` 只看 `text-delta`，DSH 的失败是终止性 `finish` chunk → **provider 报错返回空字符串** | 新增 `collectStream()`，检查 `finish.reason`，error/aborted/空输出都抛 |
| ⑬ | `config.json` 里的绝对 `dataDir` 让仓库不可克隆（换机后指向不存在的盘） | `loadConfig()` 校验存在性，不存在则回退 `<插件根>/data` |
| ⑭ | `data/prompts/` 与 `data/runs/` 被 git 跟踪（别人的提示词和 job 历史） | `git rm --cached`，只保留 `data/workflows/` |
| ⑮ | `jobs.json` 只增不减，而 `/jobs`、`/monitor` 每次全量读盘 | 新增 `pruneJobs()`：终态保留最近 500 条 / 30 天，进行中永不裁剪 |
| ⑯ | `recoverInterruptedJobs` 把 `queued` 也标成 `interrupted`（它从没开始过） | 只标 `running` |
| ⑰ | `studio_prompt(fromShot)` 不走 `withVaultCards` → 绑了角色卡的项目，Agent 编译结果与页面预览不一致 | 与 REST 共用同一份入参准备；`deriveSubjectsFromShot` 改为导出复用 |
| ⑱ | `studio_post op=qc` 把 rest 对象传给只收字符串的 `qc()` → 恒报 FILE_NOT_FOUND | 单独传 `rest.input` |
| ⑲ | `studio_toolbox` 的 `batchProgress` 不看 action，传 `delete` 也返回成功 | 显式拒绝非 `list` |

### 清理

| 项 | 原因 |
|---|---|
| `docs/PLAN-ROUND2.md` `PLAN-ROUND3.md` `SKILL-AUDIT.md` → `docs/history/` | 结论已过时，混在 `docs/` 里正是"文档说一套、代码做另一套"的来源 |
| `tools/fix-negations*.mjs` → `tools/oneoff/` | 一次性迁移脚本，已执行完 |
| `vendor/nanfeng/_removed/h3_generator.py.orig`（141 KB） | 无引用的改造前副本；差异在 VENDOR.md + git 历史里 |
| `host/blender/__pycache__/` | Python 字节码缓存，不该入库 |
| `resolveMwFigureRefs()` / `archiveBatchOutput()` | 死函数（零调用），前者还引用了早已删除的 `ctx.mw` |
| 12 个未使用的 import、3 处已删模块的空 section 标题 | 死代码 |
| `host/api/index.js` 顶部注释"由 /meta 在启动时校验路由" | 假的 —— 真正校验的是 `tools/check-routes.mjs` |

### 验证

- 冒烟测试 **106 / 106 全绿**（新增 1 项：单镜头渲染续写段的降级语义）
- `node --check` 42 个 host 模块 + `client.js` 全通过
- `tsc --noEmit` 通过
- `check-routes` 三方一致（12 页面 / 60 前端调用 / 89 精确 + 3 正则路由）
- 无头浏览器逐页验证 12 个路由：**0 异常、0 控制台错误、无白屏**
- 实测确认：提示词框 32px → 278px；10 个 skill 全部进入技能目录并可 `skill` 调用
- **真实出片验证**：864×480 / 5.17s / h264+AAC 立体声，与镜头卡参数一致；单镜头渲染续写段不再报错，改为降级+警告
- `skills/usage` 里已删除模块（script/comic/mw）的过时章节全部改写为「已删除」说明，路由数/页面数/目录树同步到实际值

---

## 2.4.0 — Skill 体系整理（2026-11-18）

> 第四轮：把散在三处的 skill 收敛到 `skills/` 唯一根目录，
> 删除重复，修复两个"永远不可达"的功能。

### 审查结论：8 个 skill 目录只有 5 份内容

逐项 SHA256 核实：

| 目录 | 哈希 | 真相 |
|---|---|---|
| `storyboard-skill` | `4AF4284A…` | H3 官方提示词（有 references）|
| `audio-drive-skill` | `4AF4284A…` | **逐字节相同，且无任何音频内容 —— 原包错拷** |
| `oneshot-continuation-skill` | `2BA1B1B3…` | 一镜到底续写 |
| `oneshot-continuation-ns-skill` | `2BA1B1B3…` | **逐字节相同** |
| `continuation-cuts-skill` | `9479118D…` | 可切镜续写 |
| `continuation-cuts-ns-skill` | `9479118D…` | **逐字节相同** |
| `nonfirst-i2v-skill` | `BF310905…` | 非首帧 I2V |
| `nonfirst-i2v-ns-skill` | `BF310905…` | **逐字节相同** |

> "NS 版"原本只是目录名不同。只有 storyboard 保留了 regular / 海螺两个真不同的版本。

### 修复 — 两个「永远不可达」

**① `skillId` 是死参数**

`tools.js` 的 schema 暴露了 `skillId` 枚举，但 `storyboard.js` 硬编码传
`'regular_storyboard'` —— 海螺版（26.7 KB 那份）**永远拿不到**。
现在 `buildStoryboardMessages()` 接收并透传 `skillId`，两条调用路径都修了。

**② 前端从来没有 skill 选择器**

`StoryboardPage` 的 `meta.skills` 类型声明了但从没渲染。现在加了
「提示词 Skill」下拉（续写模式下隐藏，因为续写走专用 skill）。

### 修复 — `skills/` 目录丢失

`skills/` 下 3 份文档被移出仓库，但 `package.json` 的 `files` 里还声明
`"skills/**"`，且代码无人引用（所以不影响运行，只是文档没了）。
从 `+ 模板/skills/` 备份恢复，改名为 `skills/usage` 与 `skills/setup`。

### 新增 — `skills/` 唯一根目录

```
skills/
├─ README.md                      体系说明（谁加载哪个）
├─ prompt/                        提示词规范（给 LLM 看）
│  ├─ h3-official/                官方六段式 + references/base-en,ref-en
│  ├─ h3-hailuo/                  海螺版（26.7KB）
│  ├─ h3-continuation/            一镜到底续写
│  ├─ h3-continuation-cuts/       可切镜续写
│  ├─ h3-nonfirst-i2v/            非首帧 I2V
│  ├─ group-master/               群友实战总纲（2041 行 + 适配说明）
│  └─ jiuzhang-prompt-spec.md     本插件编译器规范
├─ usage/  setup/                 操作 / 部署手册
├─ architecture/                  整体结构 + API 全表 + 安装流程（新建）
└─ templates/templates.json       20 条提示词模板（数据，可编辑）
```

**vendor/nanfeng 现在只放 Python**（10 个 .py + VENDOR.md），
`storyboard.js` 的 `SKILL_ROOT` 相应改为 `skills/prompt/`。

### 新增 — 群友 skill 整份纳入

`群友/# H3 Skill 总纲 v2.0.txt`（2041 行）→ `skills/prompt/group-master/SKILL.md`（2110 行）。

只做三处适配，正文逐字保留：
1. 补 frontmatter（`name` / `description` / `version`）
2. 末尾追加「与本插件的对应关系」一节：哪些规则已固化进代码、
   哪些仍是写作指导、以及**参数表与本地网格的差异**（群友 6s→45.6s，
   本地 6s→51.9s，必须改用 5.875s）
3. 保留原文分批标题（v2.0/v6.0 混用），按「第一~五批」顺序读

### 新增 — 架构 skill

`skills/architecture/SKILL.md`（19 KB）：
- 四层架构图（Host / SPA / 南风桥接 / ComfyUI）
- 完整目录布局
- 三条数据流（单镜生成 / 续写批次 / Blender 预演）
- **REST API 全表**（9 组 ~100 条）
- 13 个 Agent 工具
- 安装与依赖（ComfyUI 0.45.0 / Blender 5.2.4 版本锁定原因）
- **「改哪里改什么」定位表**
- 开发验证五步法 + 已知限制

### 修复 — 提示词模板改为数据文件

20 条模板从 `extras.js` 内联搬到 `skills/templates/templates.json`：
- 用户可直接编辑 JSON，改完重启生效，**无需改代码或重新构建**
- 内置的作为默认值，用户自定义仍存 `<dataDir>/extras/prompt-templates.json`
- 文件缺失时回退空数组 + warn，不崩溃

**顺带修正 `tpl-h3-ref2va`**：它用的是
`CRITICAL STYLE RULE / CHARACTER DEFINITION / SCENE LAYOUT / MOTION DESCRIPTION`
这套**已被废弃的旧骨架**（`h3-prompt.js` 头注释明确否定）。
现在改为真正的六段式字段名，并保留修正说明。

### 验证

- 冒烟测试 **105 项全绿**（新增 6 项 skill 结构回归）
- 真机：`/nanfeng/storyboard/meta` 两个 skill 都列出；
  海螺版 skill 实测加载 15266 字符（此前不可达）
- 模板从 JSON 加载 20 条，`tpl-h3-ref2va` 已无旧字段

---

## 2.3.0 — 续写编排 / 续写开关 / 群友 skill 吸收（2026-11-17 深夜）

> 第三轮：补齐续写的**服务端编排**与**提示词开关**，
> 吸收群友 skill（2041 行实战总纲）的独有内容，并回答「能不能改上游源码」。

### 关键结论：`h3_generator.py` 那些 `False` 不是 bug，是等价化简

逐行 diff 了南风原包与 vendor 版：

```python
# 原包 1686 行
sigma_requested = (
    isinstance(self, NanFengH3MultiReferenceGeneratorV4)
    and not isinstance(self, NanFengH3MultiReferenceGeneratorV81)
    and bool(kwargs.get("启用西格玛调节", False))
)
# vendor 1447 行（等价）
sigma_requested = False
```

V15 继承 `V4` 但也被 `V81` 继承，所以 `isinstance(V4) and not isinstance(V81)`
对 V15 **恒为 False**。改造时把它化简成常量，语义完全等价。

**结论：不该改，也不该从 GitHub 拉取**：
1. 南风是**闭源分发**（干净迁移包），没有公开 repo
2. vendor 改造删掉了 7026 行 HTTP API 层（它们要读 `.env` 外部 LLM 凭据，
   与 DSH 的 LLM 桥接打架）
3. GraphBuilder 依赖 ComfyUI 0.45.0 内部结构，在线拉取会静默破坏

### 修复 — 续写批次：服务端编排循环

**原来只有三个原语**（建批次 / 取下一段 / 报状态），需要用户手动逐段驱动。
对「45s 成片」这个核心用法来说，等于功能不可用。

新增：

- **`planSegments()`** — 从目标总时长反推每段请求时长
- **`runBatch()`** — 串行跑完整个批次，支持断点续跑、失败即停
- **`resetFromFailure()`** — 从失败段重置
- **`POST /nanfeng/continuation/plan`** — 分段规划
- **`POST /nanfeng/continuation/batches/run`** — 一键跑完整组
- **`POST /nanfeng/continuation/batches/reset`** — 重置失败段

### 修复 — 三个真实 bug（均为本机实测暴露）

| # | Bug | 后果 |
|---|---|---|
| 1 | `runBatch` 的 `runOne` 只 `upsert(job)` 没调 `runAndArchive` | job 永远停在 `queued`，批次卡死在第 1 段 |
| 2 | **段 1 被关掉了续写** | 南风把读/写 latent 都挂在同一个 `if continuation:` 下 → 段 1 latent 不落盘 → 段 2 报 "is neither a file nor a folder" |
| 3 | `snapToGrid` 照抄 Python 取模 | JS 的 `%` 对负数返回负值 → 6s 算成 141 帧（正确 158，差 17 帧 = 0.7s）|

**Bug 2 尤其反直觉**：官方设计是「首段 Load 0 / Save 1，别停用节点」
（ComfyUI-H3-Motion-Context README）。段 1 必须带 `index=1` 的任务，
Load 0 不读文件、Save 1 存下 latent。

### 新增 — 续写开关（群友 skill 最高价值的部分）

`CONTINUATION_SWITCH` 三组件，拼在提示词**最顶部**（任何字段之前）：

```
The actual carried latent motion from the previous segment governs the current
action and camera state. No reference picture resets pose, body position, hand
placement, expression, gaze or framing. The lighting direction and time of day
continue unchanged from the previous segment.
```

- 组件 1：状态权威交给实帧（缺 → 模型按文字重推 → 接缝断裂）
- 组件 2：禁止参考图拉回姿态（缺 → 人物摆回立绘姿势）
- 组件 3：光与时段继承（缺 → 每次切镜色温跳变）

配套 **`TRIM_DISCIPLINE`** 时序纪律：前 1 秒是裁切区，
动作/台词/运镜一律从 1 秒起（实测裁切 0.92s，安全边界写 1.0s）。

段 1 反向写「这是开场、没有承接」。

### 新增 — 分段规划的正确配方

群友的 9 段 45s 配方（6s 请求 × 9）**在本地不复现**：

| | 群友平台 | 本地南风 V15 |
|---|---|---|
| 6s 请求 | 144 帧（不吸附） | **158 帧**（吸附到 17k+5）|
| 段 2-9 交付 | 5.08s | 5.67s |
| 九段总长 | 45.6s | **51.9s**（多 7 秒）|

本地的正确配方（`planSegments` 自动算）：

```
段 1:     请求 5.167s → 124 帧 → 交付 5.167s
段 2-9:   请求 5.875s → 141 帧 → 裁 22 → 交付 4.958s
合计 = 44.83s ≈ 45s ✅
```

### 新增 — 画风补到 11 种 + 光比补到 7 种

- 画风新增 **`ligne-claire`**（清晰线条/欧洲漫画）与 **`vivziepop`**（地狱客栈）
- 打光新增 **`closeup-6-1`**（6:1 特写压迫，暗部压深但保留眼睛/睫毛细节）
- 新增 **`styleLightingConflicts()`**：画风×打光语义冲突检测
  （Ligne Claire 要求平涂无阴影，与 8:1 互相削弱），
  **两条编译路径都出提示**（此前只有 Ref2VA 有）

### 修复 — 角色卡 description 丢失

`normalizeSubjects()` 把角色卡的 `description`（"白发少女"这类身份描述）丢了，
只留 traits。后果：提示词里只剩"双马尾, 红瞳"这种零碎外观词，
模型不知道这是谁 —— **角色卡的身份锚点价值完全丢失**。

现在按群友 skill 标准句式输出：

```
<Subject 1> is the 白发少女 shown in <Picture 1>, with 双马尾, 红瞳.
<Subject 3> is the 神秘旅人, defined by the written description only (no reference picture supplied).
```

### 验证

- **真机 2 段续写完整跑通**：
  - 段 1：124 帧 / 5.167s（未裁切）
  - 段 2：**102 帧 / 4.25s** = 124 − 22 ✅
  - latent 落盘：`clip_00001.safetensors` + `clip_00002.safetensors`
- 提示词顶部开关实测注入（段 2 第一行即开关句）
- 冒烟测试 **99 项全绿**

---

## 2.2.0 — DMAD 接线 / 打光通道 / 参数审计（2026-11-17 夜）

> 第二轮：把上一轮标记为"未做"的 DMAD 接线补上，并新增打光通道与参数有效性审计。

### 修复 — DMAD 加速完全没接线（出片质量的主因）

- **`runH3Nanfeng()` 从 `runH3Local` 复制时漏了整段 accel-plan 接线**
  → 所有预设都是 `采样器:lcm` + 4-10 步，却**不挂 DMAD LoRA**。
  等于用 LCM 采样器跑未蒸馏的 50 步原模型再硬压到 4 步 ——
  正是 `accel-plan.js` 注释反复警告的「分布外」。
  实测佐证：历史请求 `_baseline-request.json` / `_final.json` / `_e2e-seg1.json`
  全部是 `启用LoRA=False, LoRA1=未选择, 采样器=lcm`。

  现在按 `accelPlan` 自动映射：
  | 方案字段 | 南风参数 |
  |---|---|
  | `lora` | `LoRA1` + **`LoRA1启用`**（V15 走独立槽位，`启用LoRA` 总开关无效）+ `LoRA1强度=1.0` |
  | `sampler` / `scheduler` / `steps` | `采样器` / `调度器` / `采样步数` |

- **加速方案必须放在 `extraParams` 最后一层**：预设里写着 `采样器:lcm 采样步数:4`，
  先合并会被覆盖回去。

### 修复 — SigmaShift 无法设置的真相

逐行核实 `h3_generator.py:1687/1702/1706`：`sigma_requested = False` 是**硬编码**，
三个 `MiniMaxH3SigmaShift` 调用点全在恒假分支下。

- 后果：**DMAD 要求的 `shift 12/2` 无法通过参数修正**（模型自带 12/3）
- `视频西格玛偏移` / `音频西格玛偏移` / `西格玛模式` / `低西格玛*` / `手动西格玛` 全部是死参数
- 现在会在 `job.warnings` 里**明确告知**这条上游限制，而不是静默

### 新增 — 打光通道（光比预设）

南风 217 参数里**没有任何打光参数** —— H3 是纯提示词驱动的。
新增 `LIGHTING_PRESETS`（`host/services/h3-prompt.js`），把摄影术语翻译成
模型能执行的句子（光比 + 档数 + 阴影硬度 + 暗部保留度）：

| id | 名称 | 光比 |
|---|---|---|
| `none` | 不指定 | — |
| `high-key-2-1` | 2:1 高调柔光 | 2:1 |
| `classic-3-1` | 3:1 经典人像 | 3:1 |
| `dramatic-4-1` | 4:1 戏剧低调 | 4:1 |
| `noir-8-1` | 8:1 极低调（黑色电影） | 8:1 |
| `rim-backlit` | 强边缘光（逆光勾边） | 8:1 |

- 与画风（`STYLE_PRESETS`）**正交组合**
- 镜头卡新增 `lightingId` 字段；`GET /prompt/meta` 返回 `lightings`
- 基础格式与 Ref2VA 两条路径都接入（否则关键帧模式下会静默失效）

### 新增 — V8.1 完整 Sigma 序列预设与校验

`H3完整Sigma序列` 是 D 组的**有效**参数（别和 F 组的死参数 `手动西格玛` 搞混）。

- 新增 `SIGMA_PRESETS`：`auto` / `tail-dense-10` / `plain-10` / `tail-heavier-12`
- 新增 `validateSigmaSequence()`：严格递减、收尾于 0、
  开二采时个数必须 = 一采 + 二采 + 1
- 已实测验证：`tail-dense-10` 的前 8 个值与 `simple/shift12` 的 8 步网格
  **8/8 精确吻合**（误差 < 1e-5）

### 新增 — 参数有效性审计工具

- **`tools/audit-params.mjs`**（`npm run audit:params`）
  逐项判断 217 个参数在 `h3_generator.py` 及兄弟模块里是否真的被读取。
  支持：`kwargs.get` 字面量 / `generate()` 跨行形参 / 动态族（`图片{i}`、`LoRA{index}`）/
  兄弟模块引用（南风 ER、DLSS、TRT、音频精修）/ 上游硬编码关闭 / 缺依赖。
- **`docs/PARAM-AUDIT.md`**：完整审计报告 + 群友五问的技术回答

  审计结果（217 个）：

  | 分类 | 数量 |
  |---|---|
  | A 有效（默认合理） | 107 |
  | B **有效但默认没开（有收益）** | 8 |
  | C 死参数 | 54 |
  | D 缺依赖 | 48 |
  | **真正可用** | **115 / 217（53%）** |

### 新增 — 前端

- 渲染页顶栏新增三个选择器：**画风 / 打光（光比）/ 加速（DMAD）**
- 「将提交的参数」面板显示完整生效配置（画风 · 打光 · 加速方案 · 实测步数与 LoRA）
- `GET /nanfeng/presets` 现在同时返回 `sigmas` 与 `accelPlans`

### 验证

- 真机出片：**DMAD 8 步** 292s / **DMAD 4 步** 130s，
  均 124 帧 h264 + AAC 立体声，参数快照里 `lora/sampler/steps` 完整
- 打光 8:1 实测生效（暗部沉入近黑，仅轮廓与霓虹被照亮）
- 冒烟测试 **76 项全绿**

---

## 2.1.0 — 全链路修复（2026-11-17）

> 逐项对照 `vendor/nanfeng/h3_generator.py` 源码 + 在真机（RTX 4080 12GB /
> ComfyUI 0.45.0 / 9 个真实模型）上实测后的一轮修复。
> 核心发现：南风 217 个参数里 **85 个在本版本上不产生任何效果**。

### 修复 — 会导致崩溃或静默失效

- **`h3-nanfeng` 不在 `LOCAL_BACKENDS`**（`host/services/job-store.js`）
  → 默认后端绕过了并发闸门（续写批次会把多个任务同时推给 12GB 卡 → OOM），
  且取消时不发 `/interrupt`（UI 显示已取消，GPU 继续跑满全程）。
- **智能分镜带图必崩**（`host/api/index.js`）
  `resolveUserPath(cfg, rel)` 用了位置参数，而函数签名是对象参数
  → 每次都在 catch 里被记成 `badRels`，**看图功能实际上完全不可用**。
- **首尾帧在 V15 路径被丢弃**（`host/services/generator.js`）
  南风节点没有 `first_frame` 输入口 —— 首尾帧就是 `图片1`/`图片2` 本身。
  旧代码复制自 `runH3Local`，把 previz 帧 stage 后**没有任何消费者**，
  而角色卡图却占住了 `图片1/2` → 南风报"图生视频必须上传1张图片"。
- **`continuation-quality` 预设必崩**（`host/services/nanfeng/presets.js`）
  它同时开「潜空间续写」和「潜空间放大二采」，而源码 `:1322` 硬校验两者互斥。
- **环境修正覆盖用户设置**（`host/services/nanfeng/graph.js`）
  `buildWorkflow()` 内部固定用 `new Set()` 重跑一遍 `applyFixes`，
  把调用方算好的 `explicitlySet` 丢掉 → 用户显式选的值被无条件冲掉。
- **`采样器` / `续写音频采样器` 的 options 缺 6 项**
  → `南风采样器` 这一档在学习界面无法选中，L 组 4 个 ER 参数整组不可达；
  选 `ddim`/`uni_pc`/`sa_solver` 会被静默回退成 `er_sdse`。
- **`studio_storyboard` 的 `imageRels` 绝对路径全放行**（`host/tools.js`）
  Agent 可让后端读任意本地文件并喂给视觉模型。
- **`POST /config` 的 `comfyUrl` 无校验（SSRF）**（`host/config.js`）
  可写入云元数据端点 / 内网端口 / `file://`。现只允许本机 http(s)。
- **`serveSpa` 缺尾斜杠不重定向**（`host/static.js`）
  `/jiuzhang/app`（无斜杠）会返回 index.html，但相对路径 `./assets/*`
  被浏览器解析成 `/jiuzhang/assets/*` → 404 → **永久"载入中…"白屏**。

### 修复 — 侧栏入口（用户反馈"左上角打开后页面有问题"）

- **`client.js` 的 entries 里留着 3 个已删除页面**（`script`/`comic`/`mw`）
  → SPA 的 `parseHash` 认不出，静默回退到渲染页。点"剧本"看到渲染页。
- **`window.open(url,'_blank','noopener,noreferrer')` 恒返回 `null`**
  → 无法判断被拦截，用户点了没反应且**毫无提示**。改为判返回值 + 显示可点链接。
- **侧栏面板用了 3 个不存在的 DSH 主题 token**
  （`--dsw-alias-text-primary` / `--dsw-alias-border` / `--dsw-alias-accent`，
  真实名字是 `--dsw-alias-label-primary` / `--dsw-alias-border-l1` /
  `--dsw-alias-brand-primary`）→ 有 fallback 不会崩，但会被**永久钉死成深色**。
  DSH 跟随系统主题，一旦切浅色就是浅底浅字、几乎不可读。
- `parseHash` 对未知路由**静默回退且无警告**（注释承诺的 warn 从未实现）。
  现补 `console.warn` 并指向 `tools/check-routes.mjs`。

### 新增 — 参数说明

- **`host/services/nanfeng/param-docs.js`**：217 个参数全覆盖的
  一句话说明 + 调参建议 + 有效性标记（`dead` / `banned`）。
- **`enrichSchema()` / `inertParams()`**（`schema.js`）：
  把文案合并进 `/nanfeng/schema` 下发，`PARAMS` 保持机读纯净。
- **渲染页参数面板**（`NanfengParams.tsx`）：
  · 每个参数显示中文说明，调参建议折叠在 `<details>` 里
  · 无效参数默认隐藏，组头显示被隐藏数量
  · 新增「参数速查表」可全局搜索
- **约束校验器 `CONSTRAINT_RULES`**：8 条硬互斥，在浪费 GPU 之前就拦下，
  错误信息直接点名冲突项。

### 新增 — 验证工具

- **`tools/smoke-api.mjs`**：53 项**真执行**冒烟测试
  （模块层 / 真跑 `apply()` / 逐条打 REST 路由 / 与 ComfyUI `object_info` 逐项比对）。
  能抓到 `node --check` 抓不到的未定义变量、字段丢失、运行时 null。
- **`tools/check-routes.mjs`**：SPA ROUTES / App.tsx NAV / client.js entries
  三方一致性检查（历史上正是这里漂移导致入口点到错误页面）。
- **`tools/preview-server.mjs`**：不启动 DSH 也能把插件跑起来做页面验证。

### 修复 — 其它

- **立绘拆解无参考图仍提交**：三种失败（空路径/不存在/越界）全部静默跳过，
  产出随机角色却标记 `completed`。现 400 + `badRels`。
- **立绘拆解 `DETAIL_LOCK` 用 `1.…5.` 编号**，违反同文件顶部"禁止编号小标题"
  的第一原则（实测会让图上出现数字和图例）。改为无编号自然段。
- **拆解→角色卡指向 `outputs/` 临时区**：改用 `archivedRel`（素材库正式副本），
  并把原立绘放进 `origin` 槽位。
- **提示词编译器 3 处偏离官方向导**（`h3-prompt.js`）：
  · 纯角色卡时 `summary` 缺 `[reference generation]` 前缀
  · `retention_analysis` 硬编码 `[Shot 1]`（多镜必错）
  · 每个 subject 都被断言为 speaker `(Sn)`，且编号用 subject 下标而非发声顺序
- **`buildMediaNotes` 只挂在死端点上**：真实生成路径永远没有参考视频/音频
  的用途说明，`<Video N>` 一律退化成 `transfer motion only`。
- **角色卡顺序不一致**：生成用"镜头卡在前"，页面用"createdAt 正序"
  → 人看到的名次与实际编号对不上。
- **`comfyUrl` 校验 / 构建脚本 / 前端类型**：`vite.config.ts` 缺 `root`
  导致插件根目录跑 `pnpm run build` 直接失败。

---

## 2.0.0 — 南风 V15 引擎重写（2026-11-17）

> **大版本**：后端换成南风 V15 生成引擎，移除三个非核心模块，新增智能分镜与跨镜头续写。

### 新增

- **南风 V15 生成引擎**（endor/nanfeng/，vendored）
  - 217 个参数，12 组，7 个预设
  - 支持潜空间放大二采（480p → 1472×832）
  - 支持跨镜头 AV latent 续写
- **桥接层** host/services/nanfeng/（1897 行）
  - schema.js 217 参数定义（从 ComfyUI object_info 实测导出）
  - graph.js 图组装 + 类型强制 + 环境修正
  - presets.js 7 预设 + 三层合并
  - continuation.js 续写批次编排（folder 算法复刻，与 Python 侧一致）
  - storyboard.js 智能分镜（移植南风提示词资产）
  - dsh-llm.js DSH LLM 桥接（**零凭据**）
- **智能分镜**：用 DSH 内部大模型看图 + 写分镜，7 种模式
- **跨镜头续写**：批次管理 + SSE 进度推送
- **SSE 实时同步**：GET /jiuzhang/api/events，DSH 改参数网页立即可见
- **前端**：
  - RenderPageV2（12 组折叠 + 预设 + 素材选择器）
  - StoryboardPage（智能分镜）
  - NanfengParams 参数表单引擎（从 schema 自动生成）
  - AssetPicker（9/3/3 槽位）
  - ContinuationPanel（批次创建 + 逐段执行）

### 移除

- **剧本模块**（script-service.js 343 行 + ScriptPage.tsx 381 行）
- **漫画模块**（comic-service.js 603 行 + ComicPage.tsx 376 行）
- **模特工作台**（model-workbench.js 520 行 + ModelWorkbenchPage.tsx 545 行）
- 对应 30 条 REST 路由 + 32 个前端 API 方法 + 2 个 Agent 工具
- 南风的 HTTP API 层（storyboard_api.py 766 行等共 7026 行）

### 变更

- **默认后端**：h3-local → h3-nanfeng
- **性能**：启动脚本加 --use-ck-attention（ComfyUI 自带加速，实测 -14.7%，二采场景 -33%）
- **Agent 工具**：15 → 13 个

### 修复

- **镜头覆盖不生效**：uildShotWorkflow 漏合 shot.nanfeng.overrides，
  导致网页改的参数被预设覆盖。UI 显示已改、实际未生效。
- **数值型 COMBO 类型丢失**：尺寸倍数: '32' not in [32]，
  ComfyUI 严格类型比较，字符串被拒。
- **两个独立注意力开关**：SageAttention 与 H3专用注意力 都会触发
  KJNodes 的 Sage Patch，只关一个不够。
- **TRT 空字符串非法**：TRT视频解码引擎: '' not in ['None']。

---

## 1.5.0 — 结构性修复（2026-11-14）

> 一次针对全量校验报告的结构性修复。凡"多个 bug 复合"的模块先重新设计再落地，
> 不做逐条打补丁。完整记录见 `docs/3D预演-修复记录-v1.5.0.md`。

### P0

- **首帧链路必然失败**（无参考图 + 首帧/尾帧 → `node_errors['9'] details "'20'"`）。
  新增 `host/services/h3-graph.js`：`NodeGraph` 统一分配节点 ID，
  收尾用**可达性剪枝**取代硬编码编号白名单；提交前 `validateLinks()` 拦住悬空连线。
- **动作系统三份枚举漂移**（前端 57 / 后端 59 / Python 27，32 个动作不生效）。
  新增 `host/blender/actions.py` 作为唯一真源（纯 Python，59 个动作全实现），
  `models.js` 与前端目录均从它派生。新增 `tests/test_actions.py`（6960 项断言）。
- **相机默认值坐标写错**（`normalizeCamera3d` 给 `[0,-4.2,1.6]`，相机落到地下 4.2 米，
  渲出纯灰空画面）。导出 `DEFAULT_CAMERA3D` 作为唯一真源。
- **Blender 帧号重命名崩溃**（重复渲染时 `WinError 183`，但产物已落盘 → 假成功）。
  改为幂等补齐 + 渲染前清目录 + 产物为空时真的抛错。

### P1

- **三个控制通道语义校正**：canny 去掉多余 `negate`（改为黑底白线，对齐 cv2.Canny）
  并把阈值从 0.06/0.18 提到 0.20/0.45；depth 改为**逆深度 1/z** 归一化，
  near/far 按场景几何包络推算；pose 从白剪影改为 **OpenPose COCO-18 彩色骨架**。
- **previz 产物无清理**（实测 5 次渲染 452 文件 / 74 MB）。
  新增 `prunePrevizRuns()` + `/resources/previz` 接口。
- **路径安全统一**：新增 `security.resolveUserPath()`，改造 6 处入口
  （`/assets/archive`、post、comic、blender blend/asset）。
  实测修复前可通过绝对路径把本机任意 `.json` 读进素材库。
- `openInBlender` 补 `--disable-autoexec`；`post.annotate` 校验 color/x/y/fontSize；
  `canvas-agent` 权限位改为服务端权威、`canDelete` 默认 false、`batch` 限深。
- 改 `dataDir` 后 8 个服务仍写旧目录（配置分裂脑）→ 服务改持 `getCfg`。
- 批量出图绕过并发闸门 → 导出 `withLocalSlot()`，漫画/模特链路各包一层。
- `listModelFiles` 改三态返回，`controlPatchOk` 不再把"探测失败"当作"没问题"。
- 角色卡 `both` 模式只生效 1 张；`seed=0` 被改成 1101；
  `findOrphans` 只扫一层且误删手工放入的 3D 模型；`studio_project{delete}` 不清理派生数据。

### 前端

- 3D 走位回填：进页面读回最近一张镜头卡（此前全站无人调 `listShots`，刷新即归零）。
- `saveShot` 带 `id` 复用（此前每点一次渲染就新建一张镜头卡，实测堆到 19 张重复）。
- **PrevizPage 四个通道按钮此前必然 404**（只传 `{mode}`、无项目上下文），
  现加项目/镜头选择器并按 `canRender` 门控。
- 动作下拉改为从 `GET /blender/actions/catalog` 渲染，不再硬编码。
- 轮询终态补 `interrupted`；`strength=0` 不再被 `|| 默认值` 改写。

### 测试

- `B-Blender` 从 35 条**源码字符串匹配**升级为 43 条，新增的三条会真的执行：
  跑 `tests/test_actions.py`、跑 `dump_catalog.py`、**真的启 Blender 渲 4 帧**。
- 新增 `tests/test-h3-graph.mjs`（40 项，打桩不提交 ComfyUI）。
- 两个新测试都做过反向验证：故意引入旧 bug，测试必须失败。

---

## [1.4.1] — 2026-11-14

文档与 skill 全面对齐；清理旧引擎残留。

### 变更

- **skills 三件套重写**：
  - `setup`：补 Blender 安装（§4）、控制模型下载（§3.2，4.22 GB 到 `model_patches/`）、
    深度估计可选路径（§3.4）、Blender 许可证边界（§4.3）、11 条新排错项、
    控制视频/AddGuide/坐标系的硬约束（§9）、更新性能基线（含 Blender 20.7s / H3 259s）
  - `usage`：工具数 15 → **13**、路由数 108 → **101**；删 `studio_previz`/`studio_director`，
    加 `studio_blender`；3D 章节重写为 Blender 五通道；新增
    **§4.5 Blender 白模 → 控制视频 → 成片**（含分段串联完整流程）
  - `prompt`：新增 **§7.6 控制视频的提示词写法**（"必须描述画面里真实存在的东西"、
    强度区间、控制视频 vs 参考视频的区别）
- `docs/3D预演与导演台-结构拆解.md` → 重写为 `docs/3D预演-Blender方案.md`
- `docs/使用指南.md`：3D 预演章节重写；场景 E 改为 Blender 流程 + 分段串联
- `README.md`：特性表加控制视频/分段串联；Blender 依赖说明

### 修复

- **前端调用已删除的 `/director/*` 路由**（9 个方法，会在访问时 404）
- **`config.js` 残留三个死配置** `previzPort`/`previzAutoStart`/`previzDir`
  （定义了但无人读取）
- **`tests/integration.mjs` 引用已删除的 `createPrevizController`**（脚本跑不通）

### 新增测试

- 7 项 `B-文档` 一致性断言：工具数与文档一致、无已删工具、三个 skill 都覆盖 Blender/
  控制模型/控制视频、文档无旧引擎残留。**这类断言能防止以后再出现"文档写 15 个实际 13 个"**。

### 清理

- 删除 data/previz（2462 个测试渲染文件，546 MB）
- 删除 4 个测试用 3D 资产（mixamo_test.fbx / skinned_wave.fbx / test_actor.glb / thin_wave.fbx）

### 验证

- `verify-all.mjs`：**351 PASS / 0 FAIL**（含 7 项 B-文档）
- `integration.mjs`：25 PASS
- SPA 单测：179 pass
- `tsc --noEmit`：0 error

---
## [1.4.0] — 2026-11-14

三段白模 → H3 成片；预演页可视化；canny 通道修复。

### 新增

- **预演页可视化**：新增 `preview` 模式（Workbench MATERIAL 着色，彩色灰模 + 阴影 + 描边）。
  72 帧 **4 秒**渲完，页面直接播放。
- **在 Blender 中编辑**：`POST /blender/open` 用桌面 Blender 打开渲染时保存的 `.blend`。
  页面负责"看"，原生窗口负责"改"。不做内嵌 WASM（需 COOP/COEP、12GB 笔记本未验证、与原生窗口功能重叠）。
- **三段白模脚本** `host/blender/beach-trilogy.js`：《海滩》三镜（散步 → 坐下 → 亲吻），
  含 `seamIssues()` 接缝检查（上一段 `to` 必须等于下一段 `from`）。
- 回归测试 +9 项（`B-Blender` 共 35 项）。

### 修复

- **AddGuide 节点 ID 冲突（阻断）**：`guideNode` 从 70 起编号，覆盖了刚建好的
  LoadImage（70/71），ComfyUI 报 `image, received_type(CONDITIONING)`。
  改为从 80 起。
- **canny 通道与 gray 产物完全相同（隐蔽）**：`renderControl` 只做 Blender 渲染，
  没做边缘检测 —— 用户以为在控边缘，其实喂的是灰模。
  现在 Blender 渲干净灰模 + ffmpeg `edgedetect` + `negate`（白底黑线）。
- **preview 配色失效**：Workbench 的 MATERIAL 模式读 `material.diffuse_color`，
  而 EEVEE 读 Principled BSDF。只设后者导致预览全灰。现在两套都设。

### 验证

- `verify-all.mjs`：**343 PASS / 0 FAIL**
- 实机：《海滩》三镜 9.87 秒成片跑通（角色一致 / 场景一致 / 叙事连贯 / 接缝连续）

详见 [docs/probes/blender-previz-2026-11-14/trilogy/REPORT.md](docs/probes/blender-previz-2026-11-14/trilogy/REPORT.md)。

---
## [1.3.0] — 2026-11-14

结构化走位 / 模型导入 / 动作库；旧 three.js 引擎下线。

### 新增

- **镜头卡结构化走位**：`actors[]` / `props[]` / `camera3d` 三字段。
  渲染页新增「3D 走位」面板（加删角色、身高、动作、XYZ）。
  没有这些字段时 Blender 只能渲"默认两人对峙"，而那是占位不是预演。
- **3D 模型导入**：glb / gltf / fbx / obj，按包围盒高度归一化
  （Mixamo/Sketchfab 单位五花八门）。只重挂顶层对象，保住骨架父子关系。
- **Mixamo 动作**：`host/blender/list_actions.py` 真的启一次 Blender 读动作名
  （导出名形如 `Armature|Armature|walk`，用户猜不到）。
  前端选中模型后自动加载动作列表，只有一个时自动选上。
- API：`GET /blender/assets`、`POST /blender/actions`。
- `studio_blender` 工具加 `assets` / `actions` 两个 action。
- 回归测试 +20 项 `B-Blender`。

### 修复

- **模型文件名硬编码（严重）**：写死 fp8 版，用户装 int8 版会报
  `Value not in list` 且错误看不出原因。现在 `resolveModelNames()`
  向 ComfyUI 查实际列表并按量化偏好降级；`cfg.modelNames` 可覆盖。
  控制模型缺失时自动关闭控制通道，并在 `job.params.controlSkipped` 记录原因。

### 移除（旧 three.js 预演引擎下线）

- 4 个 service：`previz-controller.js` / `previz-video.js` / `previz-shot.js` / `director3d.js`
- 20 条路由：`/previz/*` + `/previz-shot/*` + `/director/*`
- 2 个工具：`studio_previz` / `studio_director`
- 前端：六导演台 iframe 宿主页重写为 Blender 状态页；`api.previz*` 六个方法
- 配置项：`previzPort` / `previzAutoStart` / `previzDir`
- 对应测试：`B-导演台` 3 项 + `R18` 4 项

### 验证

- `verify-all.mjs`：**334 PASS / 0 FAIL**
- 端到端：Blender depth（真实走位）→ H3 Fun ControlNet → 成片，构图与走位跟随
- 旧路由 `/previz/health` / `/director/meta` 返回 404

详见 [docs/probes/blender-previz-2026-11-14/AUDIT.md](docs/probes/blender-previz-2026-11-14/AUDIT.md)。

---
## [1.2.0] — 2026-11-14

Blender 预演接入。

### 新增

- **Blender 无头渲染**：`blender -b --python` 子进程直出 H3 的控制通道（depth / pose / canny / gray）。
  **实测 124 帧 @864×480 仅 20.7 秒**（H3 一镜 217–250 秒），占比 < 10%。
- `host/blender/render_shot.py`：11 关节人偶 + 26 种程序化动作 + 深度/剪影材质。
- `host/services/blender-service.js`：Blender 定位（env → tools/blender-* → PATH）、镜头卡→场景 spec、渲染调度。
- API：`GET /blender/health`、`POST /blender/render`。
- Agent 工具：`studio_blender`（health / spec / render）。
- 渲染页「控制视频」面板加 **Blender 现渲按钮**（depth/pose/canny/gray），渲完自动填入控制视频字段。
- 回归测试 +10 项（`B-Blender`），总数 315 → **325**。

### 许可证

- `host/blender/render_shot.py` 按 **GPL-3.0-or-later** 释放（它 import bpy）。
- 插件本体通过**子进程**调用 Blender，不构成衍生作品，保持原许可。
- 产出的 .blend / 渲染图 / mp4 完全归用户，GPL 不传染产出物。

### 实测发现（踩坑记录见报告）

| 坑 | 结论 |
|---|---|
| Blender 5.2 合成器 API | `scene.node_tree` → `compositing_node_group`；`CompositorNodeComposite` 已移除 |
| Workbench Depth pass | 值域只 7 个灰阶，不可用 |
| Mist pass | Workbench 下不产生输出 |
| 视图变换 | 必须用 `Raw`，`Standard` 会把深度压成 50–90/255 |
| **坐标系** | Blender 是 Z-up；照抄参考产品的 y=高度会让**人偶躺平** |
| pose 世界光 | EEVEE world 强度非零 → 整图纯白 |

详见 [docs/probes/blender-previz-2026-11-14/REPORT.md](docs/probes/blender-previz-2026-11-14/REPORT.md)。

---

## [1.1.0] — 2026-11-14

控制视频通道。H3 从「抽卡」变成「按分镜执行」：用 Fun ControlNet Union 逐帧约束结构与时序。

### 新增

- **控制视频（Fun ControlNet Union 2.0）**：镜头卡新增 `control` 字段，渲染页新增「控制视频（结构约束）」面板。
  支持 8 种条件（Canny/Depth/HED/MLSD/Pose/Gray/Layout/Scribble）——模型是 Union 的，喂什么图就是什么控制。
- **首尾帧真正生效**：Ref2VA 没有 `first_frame`/`last_frame` 输入口，改走 `MiniMaxH3AddGuide` 任意帧锚定（0 与 -1）。
- 回归测试 +11 项（`B-控制视频`），总数 304 → **315**。

### 修复

- **首尾帧被静默丢弃（严重）**：`generator.js` 注入 `{{FIRST_FRAME}}`/`{{LAST_FRAME}}`，
  但模板里 20/21 挂的是 `{{REF_IMAGE_1}}`/`{{REF_IMAGE_2}}` 且 map 里没有这两个 key ——
  有参考图时走 Ref2VA 分支，该分支**根本没有首尾帧口**，代码不会执行。
  结果：传进去的首尾帧既不生效也不报错。
- 首尾帧不再复用参考图的 20/21 槽位（复用会互相覆盖），改用 70/71。
- 模板里未被使用的 20/21 现在会被正确删除（以前留着会让 ComfyUI 报 `Invalid file: {{{{REF_IMAGE_1}}}}`）。

### 实测数据

| 项 | 结果 |
|---|---|
| Canny 控制 | 箱子出现时刻、人数、景别全部跟随 |
| Depth 控制 | 比 Canny 更自然，透视正确 |
| 噪声基线 | 无控制时 15 帧几乎同一张图（「抽卡」） |
| 耗时 | 无控制 137s → 有控制 251s（124 帧 / 864×480 / 4 步） |
| 显存 | 12GB 可跑，控制分支 staged 4304 MB |
| AddGuide | 锚定强度过高——锚白模首帧会让整段输出都是白模，首尾帧必须是成片风格图 |

详见 [docs/probes/h3-controlnet-2026-11-14/REPORT.md](docs/probes/h3-controlnet-2026-11-14/REPORT.md)。

---

## [1.0.3] — 2026-11-14

去品牌化版本。移除对上游参考产品的名称引用，对外契约改名，功能行为不变。

### 变更（对外契约）

- **URL 前缀统一改为 `/jiuzhang/*`**：API、SPA、素材静态三条路由同步改名，Host、Client、SPA、skills、测试全部对齐。旧书签会 404，重启后从侧栏重新进入即可。
- **画布模型 id 去品牌化**：图像节点的模型枚举改用 `jiuzhang-comfy/*` 与 `jiuzhang/*` 前缀。这些 id 只是节点选择器的枚举值，后端从未按它分派（实际后端由 backend 字段决定），存量画布里的旧 id 仍能正常显示与运行。

### 变更（文案与注释）

- 代码注释、页面文案、README、docs、两个 skill 里的产品名引用统一改为中性表述；
- 设置页「关于」改写为工作室自述，不再提上游产品名。

### 未变

- 3D 预演/导演台子系统（引擎、15 条 director_* 命令、截图与白模视频渲染）行为完全不变，仅 URL 前缀跟随改名；
- Host 304 项验收与 SPA 179 项单测全部通过。

---

## [1.0.2] — 2026-11-14

实机联调版。在真实 ComfyUI + H3 模型上跑通「立绘拆解 → 角色卡 → 分段出片」全链路，
修复 5 个只有真实推理才暴露的缺陷，新增 2 项能力限制。回归总数 255 → **304**。

### 新增

- **参考音视频合计时长硬限制 14.8 秒**（`MAX_REFS_TOTAL_SEC`）。
  H3 的参考输入共用时间预算，超限会静默截断。现在超限时**自动裁剪并明确告警**：
  先砍独立音频、再砍视频，裁剪后重新编号保证 `<Video k>` / `<Audio j>` 连续。
  渲染页顶部新增「音视频 X.X/14.8s」徽章（接近上限变黄、超限变红）。
- `docs/H3参考输入契约.md`、`docs/角色卡仓库-设计.md` 补入插件（代码早有引用）。
- `LICENSE`（区分插件代码 / 第三方依赖 / 模型权重三套许可）。

### 修复（真实推理链路暴露）

- **手工提示词完全不生效（严重）**：渲染页提示词编辑器里写的内容，
  提交时被后端自动编译覆盖。两个原因叠加：
  1. 前端 `saveShot` **从不发送 `prompt` 字段**，`manualPrompt` 只活在 React state 里；
  2. 后端即使收到，也只是 `pkg.sceneLayout += shot.prompt` —— 把整段成品塞进
     SCENE LAYOUT 字段，形成「自动骨架 + 一坨完整提示词」的畸形文本。
  实测：填入 2151 字手写提示词，送进模型的是 1134 字自动编译版，摘要退化成「一段戏」。
  现在 `compilePrompt` 开头即判断长度 >200 的 `shot.prompt` 直接整段返回，前端也随卡保存。
- **角色卡排序会让 `<Picture N>` 静默漂移（严重）**：`vault.list()` 按 `updatedAt` 倒序，
  导致后创建的卡排前面；更要紧的是**编辑任意一张卡都会让它跳到最前**，
  两个角色的参考图编号因此互换。改为按 `createdAt` 正序，编辑不再打乱编号。
- **立绘拆解的表情差分**：`full` 档要求 4 个头部特写，实测只出 3 个且表情不符
  —— 它与三视图/部件拆解抢构图预算。已移除表情分区，改用 5 条「细节还原要求」
  强化服装与附件的保真（逐件单列 / 保持原比例朝向 / 逐项复刻材质工艺 /
  不丢小件 / 不做增删）。`standard` 与 `full` 现为同一内容。
- 拆解提示词里混入 Markdown `**加粗**`（与「模型不吃 Markdown」的设计原则自相矛盾），已清除。
- `loadImageWorkflow()` 调用未传 `cfg`（5 处中 4 处），依赖默认参数才没出错。

### 实测数据（本机 RTX 4080 Laptop 12GB + ComfyUI 0.45.0）

| 配置 | 耗时 | 结果 |
|---|---|---|
| H3 视频 5s（864×480，124 帧，含音轨） | 132–213s | ✅ |
| H3 视频 5s + 参考视频 | 614s | ✅ 但慢 2.9× |
| H3 视频 10s + 参考视频 | >1500s | ⚠️ 12GB 显存跑不完 |
| **分段渲染** 3.0s + 3.7s + 3.0s | 350 / 441 / 356s | ✅ 分镜可行路径 |
| H3-Image 文生图 2048² | 96s | ✅ |
| 立绘拆解 H3-Image | 60s | ✅ |

**结论**：12GB 卡上单段 ≤4 秒、参考视频同步切段是可行路线；
整段 10 秒参考不仅慢，还会**压制角色卡导致外观漂移**（实测产物变成白模小人）。

### 关键约束（写提示词/切片必读）

H3 帧数必须落在 **17k+5** 网格：

| 请求时长 | 实际帧数 | 实际时长 |
|---|---|---|
| 3.0s | 73 | 3.042s |
| 3.5s | 90 | 3.750s |
| 4.0s | 107 | 4.458s |

按网格设时长，否则实际时长与提示词里写的不一致。

---

## [1.0.1] — 2026-11-13

审查修复版。针对一轮全量结构与缺陷审查，修复 10 个功能缺陷 + 12 类健壮性问题。
新增 57 条回归断言（`tests/verify-all.mjs` 的 `B-回归` 分组），总数 197 → 255。

### 修复（真实推理链路暴露，本机 ComfyUI 0.45.0 实测）

- **`start-h3.ps1` 完全无法启动**：文件是无 BOM 的 UTF-8，Windows PowerShell 5.1
  按 GBK 读取 → 中文乱码 → 字符串未闭合，脚本直接解析失败。已写入 UTF-8 BOM，
  在 5.1 与 7.7 下均验证解析通过并实跑成功。
- **提交窗口期取消打不到远端（R19）**：`runWorkflow` 拿到 `prompt_id` 后只存在
  局部变量里，要等整个任务结束才写回 job。于是"已提交、未完成"这段窗口期
  `job.remoteId` 恒为 `null` —— 此时取消不会发 `/interrupt`，本地显示"已取消"
  但 ComfyUI 继续跑完，GPU 白烧 2 分多钟。
  实测复现：提交后 8 秒 `remoteId` 仍为 `null`，取消后队列里残留一个
  `running` 任务且其 `prompt_id` 与任何 job 都对不上、无从清理。
  现已新增 `onSubmitted` 回调链路（comfy-client → generator/h3-image →
  api/tools/index），提交成功即刻落盘 `remoteId`；取消/失败分支也保留该 ID
  以便排查远端残留。修复后 `remoteId` 在 **1 秒内**可见，取消后队列干净。

### 真实链路实测数据（供回归对照）

| 项目 | 结果 |
|---|---|
| H3 视频 5 秒（864×480 / 124 帧 / 含 AAC 音轨） | 132–162s |
| H3-Image 文生图 2048² | 96s，4.4MB |
| H3-Image 参考图编辑 | 147s，参考图确实影响结果 |
| 参考视频 / 独立参考音频 | 160s / 144s |
| t2va 确定性 | 同输入两次**逐字节相同** |
| ref2va 确定性 | 同输入多次结果不同（ComfyUI 侧 CUDA 非确定性，非插件缺陷） |

已用运行中的 ComfyUI `/object_info` 核对并确认：`ref_images.ref_image_1..N`、
`images.image_N` 等 AUTOGROW 键名与插件实现一致；`GetVideoComponents`
输出序（images/audio/fps/bit_depth/color_space）与插件接线一致。

### 修复（会真实破坏功能）

- **工作流模板不再跟随 `dataDir`**：`workflows/*.json` 是随插件分发的模板，
  之前四处实现里有三处绑在用户可改的 `dataDir` 上，改数据目录后 H3 视频 100%
  报 `WORKFLOW_MISSING`。新增 `services/workflow-paths.js` 作为单一真源。
- **取消任务能真正通知远端**：`isLocalBackendOf` 未 import，`ReferenceError`
  被 `catch {}` 吞掉 → UI 显示"已取消"但 ComfyUI 继续烧 GPU。
  同时远端取消失败不再静默，返回值带 `remoteCancel` / `remoteCancelError`。
- **模特工作台形象库生效**：`resolveMwFigureRefs` 在模块级函数里引用局部
  `ctx` → 恒抛 `ReferenceError` 并被吞成 `[]`，形象库是死数据。
- **`studio_generate` 不再产出假视频**：补后端名校验（原先任何未知后端都
  掉进 `runMock`）与 `h3-image` 分支。
- **`studio_generate` 解析角色卡**：原先不调 `withVaultCards`，同一镜头
  "页面点渲染"与"让 AI 生成"产物不一致。入参准备下沉到 `services/shot-context.js`。
- **`<Picture N>` 编号统一**：`pictureIndex` 原按"第几张卡"算，与真实参考图
  顺序（卡图 → 人设卡 → 手工图 → 场景图）错位。现在由
  `resolvePictureIndices()` 从真实清单反推；无图的卡不再写 `<Picture null>`。
- **改 `dataDir` 后项目/素材不再"消失"**：`projects`/`assets` 存储句柄在
  模块加载时被冻死，改目录后仍写旧路径。改为惰性单例。
- **`/file` 不再泄露 `config.json`**：加了子目录白名单（`outputs`/`assets`/
  `previz`/…），之前 `?path=config.json` 会把掩码保护的 `seedanceApiKey` 明文吐出。
- **mode 词表打通**：`t2v/i2v/fl2v` 与 `t2va/i2va/fl2va` 两套命名互不相认，
  导致 `i2v`/`fl2v` 的关键帧对齐指令丢失、`validateShot` 的图数校验永不触发。
  新增 `normalizeMode()`，在 `newShot` 与 `upsertShot`（落盘口）统一归一。
- **3D 预演可配置**：引擎原来写死在 `<插件>/../services/previz`，克隆仓库的
  用户永远没有预演。现在支持 `previzDir` / `PREVIZ_HOME` / `DSH_PREVIZ_DIR`，
  未安装时 `health()` 返回 `available:false` + 可操作提示，而不是莫名"离线"。

### 修复（健壮性）

- `imageSteps` 配置真正生效（原先硬编码 `IMAGE_SAMPLING.steps`）。
- 归档产物回填 `assetId`/`archivedRel` 改为按**源路径**对账（原先永远匹配不上）。
- 成片 `probe()` 桩函数修好（原先两个分支都 `return null`）。
- 尺寸表：`p-3x4-film` → `p-2x3-film`（几何本是 2:3），旧 id 保留为别名；
  `v-16x9` 补注历史命名问题。
- 维度 11.13-11.17：`studio_shot`/`studio_script`/`studio_generate`/
  `/director/build` 的 `projectId`、`script`/`comic` 的 `projectId` 文件名、
  `/previz/command` 的命令名，全部补校验。
- 导入预览：`/import/preview` 不再能读任意文件，只允许分镜/提示词/字幕类。
- 素材下载：SVG 强制 `Content-Disposition: attachment` + `nosniff`，
  避免同源存储型 XSS。
- 删除项目会连带清理 `shots/<pid>`、`data/projects/<pid>`、`script`、`comic`。
- 参数校验类错误返回 400（原先一律 500）。
- 移除死配置 `assetRoot`、`imageBackend`；新增 `workflowDir`、`previzDir`。
- 配置变更通过 `onConfigChange` 订阅统一失效各模块缓存。
- `package.json` 的 `files` 补上 `skills/`、`docs/`、`data/workflows/`、
  `CHANGELOG.md`、`LICENSE`（原先 npm 分发会缺工作流模板）。
- 补 `LICENSE`（模型权重与第三方依赖的许可边界）。

### 修复（测试与文档）

- `tests/verify-all.mjs` 去掉写死的 `F:\AI视频\...\ffmpeg.exe`，改用插件自己的
  ffmpeg 解析链；找不到时明确记为 **SKIP** 而非静默 `add(..., true)`。
- 修正 `start-h3.ps1` 检查的路径层级错误（`ROOT/../..` 少一层，这三项检查
  从未执行过）。
- `vite.config.ts` / `tests/browsercheck.mjs` 的端口改为读 `DSH_PORT`。
- 部署 skill 里的 `F:\AI视频` 全部改为 `<工作区>` 占位符。

---

## [1.0.0] — 2026-11-13

首个稳定版。相比早期的 P0 骨架（`dsh-ai-video-studio` v0.1.0），这是一次完整重写。

### 新增

**渲染页（主入口）**
- 三栏布局：左选素材、中预览、右参数；底部可折叠提示词编辑器
- 内嵌「成片合成」tab，可从项目镜头列表勾选并按顺序拼接
- 参考图保真档位（`match` / `max`）

**角色卡仓库**
- 四图片槽位（设定卡 / 原立绘 / 头部特写 / 额外）
- 引用策略：`sheet-first` / `sheet-only` / `origin-first` / `both`
- 项目级与镜头级两级绑定

**H3 四类参考输入**
- 参考图 ≤9、参考视频 ≤3（帧序列）、视频音轨、独立音频 ≤3
- 编号自动推算：`<Picture i>` / `<Video k>` / `<Audio j>`
- 超限裁剪有优先级（先砍场景 → 手工图 → 预演帧 → 原立绘 → 设定卡）

**媒体探测**
- ffprobe 自动识别时长、音轨、分辨率
- 上传时写回素材库；生成时补写（外部放入的文件也能补全）
- 无音轨视频不会被误接空音频槽

**3D 预演 → 白模视频**
- `/previz/video` 逐帧渲染成 mp4，可直接当参考视频
- 预演页「导出白模视频」按钮

**其他**
- 产物自动归档进素材库（`runAndArchive` / `archiveBatchOutput`）
- 显存感知的保真档位降级（不足 4G 时降级并说明原因）
- 参考视频/音频的 2–15 秒时长校验

### 修复

- **音轨丢失**：H3 是音画同步模型，工作流只接了视频 `VAEDecode`，
  音轨被整个丢弃且不报错。补 `VAELoader(audio_vae) → VAEDecodeAudio → CreateVideo.audio`。
  此前所有 H3 产物都是无声的。
- **参考图从未进模型**（7 处独立缺陷）：`comfyInputDir` 默认空导致直接返回 `{}`、
  `catch{}` 静默吞错、只建 2 个 LoadImage 却放开 9 张、AUTOGROW 用错写法等。
- **`<Audio>` 编号错位**：视频自带音轨会占用 `<Audio>` 序号，
  按"独立音频 = Audio 1"写会全错。改为后端统一算。
- **拆解提示词污染**：`normalizeImagePrompt` 会改写否定句语义；
  `一、二、三` 编号小标题会诱导模型在图上画标签（实测出过乱码）。
- **未知 backend 静默降级 mock**：产出假视频且状态 completed。改为 400 `UNKNOWN_BACKEND`。
- **`h3-image` 不在本地后端集合**：绕过并发闸门（可能 OOM）+ 取消不发 `/interrupt`。
- **`call_skill` 空壳**：改真实分发。
- **`post/scale` 对图片输出 `.mp4`**；`extractFrame` 对图片报内部 ENOENT。
- **UTF-8 文件名上传必失败**：PowerShell 把中文名编成 RFC2047，`path.extname()` 取不到。
- **端口冲突**：Hyper-V 动态保留 TCP 段导致 `WinError 10013`。
  改为启动脚本自动选端口 + 插件自发现。
- **成片合成路径解析**：`path.resolve(p)` 用进程 cwd（DSH profile 目录），
  ffmpeg 找不到文件。改为按 `dataDir` 解析。
- **`summary` 丢角色名**：`compilePrompt` 只看 `shot.subjects`，不看 `shot.characterCards`。
- **环境声/配乐被默认值覆盖**：镜头卡的 `sound`/`music` 没传给编译器。

### 变更

- 信息架构从 16 项收敛到 **13 项 / 4 组**：
  - 「H3 工坊」→ 剧本页的「剧本拆解」tab
  - 「提示词」→ 并入渲染页
  - 「3D 导演台」+「预演」→ 合并为「3D 预演」
  - 「工具箱」→ 并入设置的「工具」tab
  - 「人设卡」→ 改名「立绘拆解」
  - 新增「渲染页」与「角色卡」两个顶级入口
- 旧路由自动重定向（`h3→script`、`prompt→render`、`director→previz`、`toolbox→settings`）
- Agent 工具从 16 个收敛到 15 个（`studio_asset` 移除，素材走 REST）

### 移除

- `PromptPage.tsx`、`DirectorPage.tsx`（能力已并入渲染页与 3D 预演）
- `studio_asset` 工具（素材 API 仍在，只是不占工具名额）
- 早期骨架包 `dsh-ai-video-studio`（v0.1.0）

---

## [0.1.0] — 2026-11 之前

P0 骨架 + mock 后端。已被 1.0.0 完全取代，不再维护。