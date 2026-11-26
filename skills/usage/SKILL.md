---
name: jiuzhang-studio-usage
description: 当需要通过九章工作室插件生成视频或图像、调用 studio_* 工具、直接打 REST 接口、管理项目/镜头/角色卡/素材、用 Blender 白模指导生成、或做跨镜头续写串联时使用。本文是插件的完整操作手册：14 个 Agent 工具的真实参数、124 组 REST 方法+路径（按 11 个域模块组织）、14 条前端路由，以及任务生命周期、数据目录与错误码。
---

# 九章工作室 · 操作手册（AI 调用向）

> 面向 AI 代理：如何通过 **Agent 工具** / **REST API** / **前端页面** 使用插件。
> 本文所有参数名、路由、字段均与 `host/` 代码逐条核对（v4.0.0）。
> 部署与模型下载见 `jiuzhang-studio-setup`；提示词写法见 `jiuzhang-studio-prompt`；
> 代码结构与"改哪里改什么"见 `jiuzhang-studio-architecture`。

---

## 0. 三种调用方式

| 方式 | 适用场景 | 入口 |
|---|---|---|
| **Agent 工具** | 对话中直接调用，最简单 | 14 个 `studio_*` 工具 |
| **REST API** | 脚本 / 外部程序，粒度最细 | `http://127.0.0.1:<port>/jiuzhang/api/*` |
| **前端页面** | 人工操作，可视化 | `http://127.0.0.1:<port>/jiuzhang/app/#/<route>` |

**端口**：DSH 每次启动随机分配。用 `GET /jiuzhang/api/token` 拿 `origin`（Desktop 窗口的
`location.port` 恒为空，`origin` 是唯一可靠来源）。下文 `<port>` 占位。

**鉴权**：写方法（POST/PUT/PATCH/DELETE）必须带 `X-JZ-Token`；GET/HEAD 不需要。

```js
const { token, origin } = await (await fetch(`http://127.0.0.1:${port}/jiuzhang/api/token`)).json();
// 之后 headers: { 'X-JZ-Token': token, 'Content-Type': 'application/json' }
```

`guard()` 的三道闸：仅本机（`FORBIDDEN_HOST`）→ 同源（`FORBIDDEN_ORIGIN`）→ 写令牌
（`WRITE_TOKEN_REQUIRED`）。

---

## 1. 14 个 Agent 工具

### 1.1 元信息 / 配置

| 工具 | 参数（字面） | 说明 |
|---|---|---|
| `studio_meta` | 无 | 26 节点 · 15 类资产 · 19 个 H3 模型槽 · 4 档位 · 后端枚举 · ComfyUI 健康 · 南风 221 参数/12 组/7 预设 |
| `studio_config` | `action: get\|set`，`patch` | 读写配置。`set` 走 17 键白名单（`WRITABLE_CONFIG_KEYS`） |

`patch` 白名单：`dataDir` · `workflowDir` · `comfyUrl` · `comfyInputDir` · `comfyTimeoutMin` ·
`defaultBackend` · `defaultProfile` · `maxConcurrentLocal` · `accelPlan` · `theme` · `accent` ·
`locale` · `imageModelRoot` · `imageSizeId` · `imageSteps` · `imageMaxMP` · `modelNames`。
白名单外的键被静默丢弃；`comfyUrl` 只接受本机 http(s)（否则 `INVALID_COMFY_URL`）。

### 1.2 项目 / 镜头 / 任务

| 工具 | 参数（字面） | 说明 |
|---|---|---|
| `studio_project` | `action: list\|create\|get\|update\|delete`，`projectId`，`patch` | 项目 CRUD。`update` 只写 `allowedProjectPatch` 白名单：`name / category / rootPath / description / nodes / edges / viewport / nodeCount / scriptProjectName / scriptProjectDir / comicProjectName / comicProjectDir` |
| `studio_shot` | `action: list\|create\|save\|delete`，`projectId`，`shotId`，`shot` | 镜头卡 CRUD。`save` 认 `shotId`（不传 id 会新建）。**删镜头只有这个入口**，REST 没有 DELETE |
| `studio_jobs` | `action: list\|get\|cancel\|retry`，`jobId`，`limit` | 任务查询/取消/重试。`cancel` 对本地后端会真发 ComfyUI `/interrupt`；`list` 默认 50 条 |

### 1.3 生成

| 工具 | 参数（字面） | 说明 |
|---|---|---|
| `studio_generate` | **必填** `projectId` `shotId`；可选 `backend` `seed` `preset` `params` `mode` `continuationTask` `accelPlan` `steps` | 提交视频/图像任务，立即返回 job |
| `studio_image` | 见 §1.4 | H3-Image 出图 / 局部重绘 |

`backend` 枚举：`h3-nanfeng`（默认，南风 V15，支持二采/续写）· `h3-local`（旧模板替换路径，
回退用）· `h3-image` · `mock`（占位，只出 ffmpeg 色卡）。写错名字 → `UNKNOWN_BACKEND`，
**不会静默降级**。

`preset` 枚举：`draft` `standard` `quality` `quality-preview` `continuation`
`continuation-quality` `low-vram`。`params` 覆盖预设里的单项参数（键名同南风参数名）。

### 1.4 `studio_image`（4 个 action）

| 参数 | 类型 | 适用 action | 说明 |
|---|---|---|---|
| `action` | `meta\|lora\|generate\|inpaint` | 全部 | 必填 |
| `prompt` | string | generate / inpaint | ≤4096 字符，超长 400 拒绝，**不截断** |
| `sizeId` | string | generate | `auto`（默认）\| 尺寸表 id，见 `meta.sizes` |
| `width` / `height` | number | generate | 显式尺寸，必须**成对**且是 32 的倍数，会抵消 `sizeId` |
| `seed` | number | generate / inpaint | 不给则随机；`count>1` 时其余按 `seed+1`、`+2` 递增 |
| `count` | number | generate | 1–4，**拆成 N 个独立任务**（DiT 拒绝 batch>1） |
| `refImages` | string[] | generate | ≤16 张（dataDir 相对路径或 dataURL）。**第 1 张 = 被编辑的原图**；不传即文生图 |
| `loras` | `[{name, strength}]` | generate / inpaint | ≤6 条，`name` 形如 `h3img/30_style/x.safetensors` |
| `projectId` | string | generate / inpaint | 可选归属 |
| `sourceImage` | string | **inpaint** | 源图（相对路径或 dataURL） |
| `maskImage` | string | **inpaint** | 白=重绘区。尺寸必须与源图**完全一致**，否则 `MASK_SIZE_MISMATCH` |
| `inpaintMode` | `crop\|full` | **inpaint** | `crop` 默认（裁剪重绘再贴回）/ `full`（全图 latent 混合） |
| `inpaintStrength` | `full\|strong\|medium\|light` | **inpaint** | SplitSigmas 切点 0/1/2/3 |
| `cropResolutionId` | `auto\|512\|768\|1024\|1280` | **inpaint** | `auto` 按 bbox 长边 ×1.5 自动算（推荐） |
| `cropResolution` | number | **inpaint** | 手动档分辨率（32 倍数）；只给它不给 id 即手动档 |
| `strokePixels` | number | **inpaint** | mask 非零像素数（兜底估 bbox） |
| `bboxW` / `bboxH` | number | **inpaint** | mask 外接框。**优先从 mask 文件实测**，实测失败才用它们 |
| `graded` | boolean | **inpaint** | 分级重绘开关。mask 的**灰度 = 该像素的重绘强度**（1.0 全重绘，0.55 小幅修饰） |
| `gradedLevel` | `full\|strong\|medium\|light\|keep` | **inpaint** | 分级档位，按实测校准 1.0 / 0.85 / 0.7 / 0.55 / 0 |
| `text` | string | generate | 短需求或**中文**描述；会被展开成完整英文描述（与 `prompt` 二选一） |
| `styleId` | string | generate | 画风 id（见 `action=meta` 的 `promptCompiler.styles`，或 `none`）。2D 画风自动注入反 3D 约束 |
| `styleAnchorImages` | string[] | generate | **画风参考图**（≤2 张）。只借画法不借内容，**永远追加在参考图末尾、不占 `image_1`** |
| `styleAnchorMode` | `style-only\|style+palette` | generate | 画风锚借用范围：只借画法 / 连配色一起借 |
| `compile` | boolean | generate | 是否编译提示词（默认 `true`）；`false` = 按原文提交，排障用 |

返回：`{ ok, jobId, jobIds, batchId, count, mode:'edit'|'t2i', refCount, loraStack, seed, warnings, compiled, promptWarnings, note }`。
`compiled` 告诉你编译器做了什么：`{ usedRaw, styleId, anti3dApplied, chars }`，
`anti3dApplied` 三态（`true` 已具备 / `false` 2D 但缺 / `null` 该画风不需要）。
Agent 出图产物留在 `data/outputs/`（**不进素材库**），REST `/image/generate` 才走归档。

#### 什么时候用哪个入参

| 你的输入 | 怎么传 |
|---|---|
| 中文一句话（「穿红裙的少女站在霓虹街道上」）| `text`，编译器展开成完整英文描述 |
| 已经写好的完整英文长描述 | `prompt`（≥40 词时**不会被重写**，只做 lint 与画风约束注入） |
| 想固定某种画风 | `styleId`（11 套预设）或 `styleAnchorImages`（传一张目标画风的成品图，**更强**） |
| 要画面上出现特定文字 | `lettering`（逐字进引号；不传会自动声明"画面无文字"） |
| 想跳过编译器排障 | `compile:false` |

> ⚠️ 画风锚**不要**混进 `refImages`：那会占掉 `image_1`（决定画布尺寸 + 是被编辑的原图），
> 导致文生图尺寸被带偏、编辑时画风图被当成编辑对象。

> ⚠️ 分级重绘的 `gradedLevel` 是**档位**，不是 mask 值；`graded` 关闭时它被忽略。
> 手动传灰度 mask 而不开 `graded`，`GrowMask` 会把档位压平（连 0.55 都会被拉成 1.0）。

### 1.5 提示词 / 分镜 / 工坊

| 工具 | 参数（字面） | 说明 |
|---|---|---|
| `studio_prompt` | `action: meta\|compile\|fromShot`，`projectId` `shotId` `mode` `styleId` `styleEn` `durationSec` `sceneLayout` `subjects[]` `shots[]` `references` `overall_soundscape` `non_diegetic_music` `summary` | H3 提示词编译。`mode` 枚举 `t2va\|i2va\|fl2va\|l2va\|ref2va`。`fromShot` 走角色卡（与真实生成同一份入参） |
| `studio_storyboard` | `action: meta\|analyze\|generate`，`projectId` `idea` `count` `mode` `skillId` `imageRels[]` `durationSec` `contextLength` | 智能分镜，走 DSH 内部 LLM（零 API Key） |
| `studio_h3_workshop` | `action: analyze\|import`，`projectId` `text` `file` `episode` `aspect` `style` `language` `durationMin` `durationMax` | 剧本 → 中性分段 + 资产提示词。**只产文本，不出图** |

`studio_storyboard` 的 `mode` 枚举（7 个）：`ref2va` `reference_i2va` `i2va` `fl2va` `t2va`
`oneshot_continuation` `continuation_cuts`；`skillId` 两个：`regular_storyboard` `ns_storyboard`；
`count` 夹在 1–12；`contextLength` 取 5/22/39/56。

`studio_subjects[]` 的字段：`id` `name` `pictureIndex` `gender` `heightCm` `traits` `personality`
`voiceDesc` `audioIndex`。

### 1.6 后处理 / 剪辑 / 预演

| 工具 | 参数（字面） | 说明 |
|---|---|---|
| `studio_post` | `op: transcode\|scale\|crop\|split\|annotate\|extractFrame\|extractAudio\|stripAudio\|qc`，`input` `path` `width` `height` `x` `y` `rows` `cols` `text` `fontSize` `color` `fontFile` `timeSec` `crf` | ffmpeg 后处理与图像工具 |
| `studio_edit` | `op: probe\|trim\|concat\|audio\|render\|clips\|projects`，见 §1.7 | 视频剪辑 |
| `studio_blender` | `action: health\|assets\|actions\|render\|spec`，`mode` `assetRel` `projectId` `shotId` `shot` `frames` `timeoutMs` `jobId` | Blender 预演 |

`studio_post` 的两处特例：
- **`qc` 的入参是 `path`**（`{op:'qc', path:'outputs/x.mp4'}`）；`input` 作为等价别名同时保留。
  其余 op 一律用 `input`。
- `path` 字段本身标注为 deprecated，仅为兼容 REST 调用方；新代码请用 `input`。

`studio_blender` 的 `mode` 枚举 `blockout`（唯一喂模型的通道）/ `preview`（人眼看）；
`timeoutMs` 夹取 30s–15min（默认 10min）；`jobId` 是本次渲染的目录名（缺省用 `shotId`）。

### 1.7 `studio_edit`（7 个 op）

| op | 必填 | 可选 | 说明 |
|---|---|---|---|
| `probe` | `input` | — | 时长/分辨率/帧率/音轨 |
| `trim` | `input` | `startSec` `endSec` **`reencode`** | 裁切 |
| `concat` | `inputs[]` | `transitionSec` `reencode` | 拼接；形状一致走流复制，否则重编码 |
| `audio` | `input` **`audioOp`** | `bgmInput` `replaceOriginal` `bgmVolume` `originalVolume` `fadeInSec` `fadeOutSec` | `audioOp: strip\|volume\|bgm`（顶层 `op` 已被动作分发占用，故子操作叫 `audioOp`） |
| `render` | — | `projectId` `clips[]` `audio{}` `transitionSec` `reencode` `name` | 按工程出片 |
| `clips` | — | — | 可剪辑素材（`outputs/` + `assets/` + `edit/outputs/`） |
| `projects` | — | `action: list\|get\|save\|delete`，`projectId` | 剪辑工程增删查改 |

```js
// 掐头尾
studio_edit { op:'trim', input:'outputs/job_x.mp4', startSec:1.5, endSec:8, reencode:true }
// 拼接（带转场必须重编码）
studio_edit { op:'concat', inputs:['outputs/a.mp4','outputs/b.mp4'], transitionSec:0.5 }
// 一条命令出片 + 换 BGM
studio_edit { op:'render',
  clips:[{rel:'outputs/a.mp4',startSec:0,endSec:2},{rel:'outputs/b.mp4',startSec:1}],
  audio:{mode:'bgm', bgmRel:'assets/bgm.mp3', bgmVolume:0.5, replaceOriginal:true},
  transitionSec:0.4 }
```

产物写 `data/edit/outputs/`，返回 `{rel, bytes, meta}`。只接受 `dataDir` 内的路径。

### 1.8 `studio_toolbox`（7 域）

| domain | 支持的 action | 关键参数 |
|---|---|---|
| `promptTemplates` | `list` `upsert` `delete` | `item` / `id` |
| `wardrobe` | `list` `upsert` `delete` | `kind` / `item` / `id` |
| `importScan` | `scan` `preview` | `dir` / `path` / `limit` |
| `orphans` | `list` `clean` | `confirm`（clean 必填 true） |
| `motionShots` | `list` `upsert` `delete` | `projectId` / `item` / `id` |
| `logs` | `list` `upsert` | `limit` / `item` |
| `batchProgress` | **仅 `list`** | — |

---

## 2. REST API（124 组方法+路径，11 个域模块）

> 全部挂在 `/jiuzhang/api` 前缀下。`host/api/index.js` 是 84 行分发器，
> 业务在 `host/api/routes/` 的 11 个域文件里。下表按域分块，**顺序即匹配顺序**。

### 2.1 `meta` — 元信息 / 配置 / ComfyUI 进程（16 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/token` | 写令牌 + `origin`（**本身免 token**） |
| GET | `/monitor` | 任务计数 + H3 健康 + Blender + 磁盘（侧栏 3s 轮询） |
| GET | `/meta` | 档位 / 26 节点 / 15 资产类型 / 19 槽位 / 后端枚举 |
| GET | `/events` | SSE 长连接（`job-progress` / `batch-progress` / `replace-progress`） |
| GET | `/health` | ComfyUI 健康 + Blender + 加速方案 + 工作流模板诊断 + SSE 连接数 |
| GET · POST | `/config` | 读（掩码）/ 写（白名单 + `comfyUrl` SSRF 校验） |
| GET | `/comfy/status` | ComfyUI 进程状态 |
| POST | `/comfy/stop` | 停止（`purge` 默认 true） |
| POST | `/comfy/start` | 启动 |
| POST | `/comfy/restart` | 重启（清队列 + 显存碎片 + 节点缓存） |
| GET | `/accel/plans` | 加速方案（`dmad8` / `dmad4` / `none`） |
| GET | `/lora/catalog` | **视频** LoRA 目录（分类 / 强度限 / 探活标志） |
| POST | `/lora/solve` | 视频 LoRA 约束求解 |
| GET | `/workflows/diagnostics` | `h3.json` / `h3-image.json` 是否就位 |
| GET | `/nanfeng/schema` | 221 参数 + 12 组 + 无效参数清单 |
| GET | `/nanfeng/presets` | 7 预设 + Sigma 序列 + 加速方案 |
| GET | `/nanfeng/presets/:id` | 某预设合并后的参数快照（**未经 applyFixes**） |

### 2.2 `nanfeng` — 续写批次 / 智能分镜（9 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/nanfeng/continuation/batches` | 建批次 `{projectId, shotIds[], preset, contextLength, audioContextLength, trimFrames}` → 201 |
| GET | `/nanfeng/continuation/batches` | 列批次（`?projectId=` 过滤） |
| GET | `/nanfeng/continuation/batches/:id` | 单批次（含各段状态） |
| GET | `/nanfeng/continuation/batches/:id/next` | 取下一段任务 `{done, index, shotId, task, contextFolder}` |
| POST | `/nanfeng/continuation/batches/run` | 一键跑完整组（立即 202，进度走 SSE；同批次已跑 → 409 `BATCH_ALREADY_RUNNING`） |
| POST | `/nanfeng/continuation/batches/reset` | 重置失败段 |
| POST | `/nanfeng/continuation/segment` | 手工更新单段 `{batchId, index, status, jobId, outputRel, frames, error}` |
| POST | `/nanfeng/continuation/plan` | 分段规划 `{targetSeconds, segments, contextLength}`（帧数落在 `17k+5`） |
| GET | `/nanfeng/storyboard/meta` | 7 模式 + 2 skill + LLM 状态 |
| POST | `/nanfeng/storyboard/generate` | 智能分镜 `{imageRels[], idea, count, mode, skillId, durationSec, contextLength}` |

`contextLength` 取 `'5' / '22' / '39' / '56'`（=0.21 / 0.92 / 1.63 / 2.33 秒），默认 `'22'`。
段 2 起裁掉这 N 帧，所以**交付时长比请求时长短**。

### 2.3 `generate` — 生成 / 任务（6 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/generate` | `{projectId, shotId, backend, seed, preset, params, mode, accelPlan, steps}` |
| GET | `/jobs` | 全量列表（按 `createdAt` 倒序）；`?fields=list` 走轻量投影（无 prompt 全文） |
| GET | `/jobs/batch-progress` | 批量进度 `{total, done, failed, running, queued, pending, percent}`；`?batchId=` 分组 |
| GET | `/jobs/:id` | 单任务（**必须** `job_*` 形状，否则 400 `INVALID_ID`） |
| POST | `/jobs/:id/cancel` | 取消（本地后端真发 `/interrupt`） |
| POST | `/jobs/:id/retry` | 以同参重开一条新 job |
| POST | `/resolution` | `{profile, ratio}` → `{width, height, mp}` |
| POST | `/h3/length` | `{durationSec, fps}` → `{length}`（`17k+5` 网格） |

### 2.4 `image` — 图像 / 局部重绘 / 立绘拆解（10 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/image/meta` | 模型状态 + 尺寸表 + **真实生效参数** + 各项上限 + LoRA 分类 + inpaint 元信息 |
| GET | `/image/lora/catalog` | **图像** LoRA 目录（只列 `models/loras/h3img/`） |
| POST | `/image/lora/solve` | 图像 LoRA 约束求解 `{items[], maxSlots, hasRefImages}` |
| POST | `/image/generate` | 出图（见 §3.2 入参表） |
| GET | `/image/inpaint/meta` | `denoiseLocked:true` + 4 档强度 + 5 档分辨率 + `cropAvailable` |
| POST | `/image/inpaint` | 局部重绘 `{prompt, source, mask, mode, strength, seed, loras[], crop, bboxW, bboxH, strokePixels}` |
| GET | `/image/progress?ids=` | 按 id 逐个取（轻量：status + progress + 产物 rel） |
| GET | `/breakdown/meta` | 默认提示词 + 字符上限 + 固定尺寸 |
| POST | `/breakdown/preview` | 回显提交用提示词（**不拼装、不改写**） |
| POST | `/breakdown/generate` | 出拆解图（无参考图 → 400 `REF_IMAGE_REQUIRED`） |

> **inpaint 的 REST 键是 `source` / `mask`**，而工具层与 `validateInpaintRequest` 同时接受
> `sourceImage` / `maskImage` 别名。`crop` 是对象：`{resolutionId, baseResolution, padding, bboxW, bboxH}`。

### 2.5 `projects` — 项目 / 镜头 / 项目绑卡（5 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET · POST | `/projects` | 列表（只回 `projectSummary`）/ 新建 |
| GET · POST · DELETE | `/projects/:id` | 单项目（DELETE 先清产物再删记录） |
| GET · POST | `/projects/:id/shots` | 镜头列表 / 保存（**部分保存**：只覆盖提交的字段） |
| GET · POST | `/projects/:id/cards` | 项目绑卡 `{projectId, cardIds, cards}` |

> 镜头**没有** `DELETE /projects/:pid/shots/:sid`；删镜头走 `studio_shot {action:'delete'}`。

### 2.6 `prompt` — 提示词编译 / 渲染计划（6 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/prompt/meta` | 11 画风（含 `none`）+ 7 打光 + 5 模式 + 硬约束 |
| POST | `/prompt/compile` | 完整输入包 → 提示词 |
| POST | `/prompt/from-shot` | 从镜头卡编译（**走角色卡**，与真实生成同源） |
| POST | `/prompt/preview` | 只编译不落盘 |
| POST | `/render/plan` | 渲染计划：`<Picture N>` / `<Video K>` / `<Audio J>` 编号的**唯一权威来源** |
| POST | `/render/compile` | 按计划编译（接受 `cardIds`，由后端算编号） |

### 2.7 `vault` — 角色卡（5 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/vault/meta` | 槽位 / 引用模式 / 默认策略 / 上限 / 目录 |
| GET · POST | `/vault/cards` | 列表（`?q=` 搜索）/ 建卡或更新 |
| GET · POST | `/vault/cards/:id` | 单卡（`card_*` 形状）/ 就地更新 |
| POST | `/vault/cards/delete` | 删卡 `{id}` |
| GET | `/vault/plan?projectId=&cardIds=&extra=&firstLast=` | 参考图预算规划（项目已绑卡自动并入） |

### 2.8 `media` — 素材 / 文件 / 后处理 / 剪辑（26 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/assets` | 素材列表（`?type=` / `?projectId=`） |
| POST | `/assets/upload` | multipart 上传；视频/音频上传后立刻 ffprobe 补 `durationSec`/`hasAudio` |
| GET · HEAD | `/assets/item?id=` | 单条素材二进制（Range / 缓存头） |
| POST | `/assets/delete` | 删素材 `{id}` |
| POST | `/assets/archive` | 产物归档进素材库；`items[]` 或单对象，**子目录白名单** `outputs/assets/previz/post/tmp-inline/inputs` |
| GET · HEAD | `/file?path=` | 读 dataDir 内文件（`SERVABLE_DATA_DIRS` 白名单） |
| POST | `/post/transcode` | `{input, crf, preset, videoCodec, audioCodec, audioBitrate}` |
| POST | `/post/scale` | `{input, width, height=-2}` |
| POST | `/post/crop` | `{input, x, y, width, height}` |
| POST | `/post/split` | `{input, rows=2, cols=2}` |
| POST | `/post/annotate` | `{input, text, fontSize, color, x, y, fontFile}`（中文需 fontFile） |
| POST | `/post/extractFrame` | `{input, timeSec}` |
| POST | `/post/extractAudio` | `{input}` |
| POST | `/post/stripAudio` | `{input}` —— 人物替换的必备前置 |
| POST | `/post/qc` | **入参 `{path}`**（`{input}` 亦可）；只回探测结果 |
| GET | `/post/fonts` | 可用中文字体 |
| GET | `/edit/clips` | 可剪辑素材 |
| POST | `/edit/probe` | `{input}` |
| POST | `/edit/trim` | `{input, startSec, endSec, reencode}` |
| POST | `/edit/concat` | `{inputs[], transitionSec, reencode}` |
| POST | `/edit/audio` | `{input, op: strip\|volume\|bgm, bgmInput, replaceOriginal, bgmVolume, originalVolume, fadeInSec, fadeOutSec}` |
| POST | `/edit/render` | `{id, clips[], audio{}, transitionSec, reencode, name}` |
| GET · POST | `/edit/projects` | 工程列表 / 保存 |
| GET · POST · DELETE | `/edit/projects/:id` | 单工程 CRUD（POST/PUT/PATCH 同义） |

> `/file` 白名单：`outputs assets previz previz-shots post comic tmp-inline inputs edit replace`。
> `/assets/archive` 白名单更窄：`outputs assets previz post tmp-inline inputs`。
> SVG 一律 `attachment` + `nosniff`（该源挂着全部写接口，内联 SVG = 存储型 XSS）。

### 2.9 `blender` — 3D 预演（6 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/blender/health` | exe / 通道 / 脚本 / 推荐模式 |
| GET | `/blender/assets` | 3D 资产库（glb/gltf/fbx/obj） |
| GET | `/blender/actions/catalog` | 动作目录（60 条，**不启 Blender**） |
| POST | `/blender/actions` | `{assetRel}` 读模型内置动作名（**会启一次 Blender**） |
| POST | `/blender/open` | `{blendRel}` 用桌面 Blender 打开 .blend |
| POST | `/blender/render` | `{mode, projectId, shotId, shot, spec, frames, jobId, timeoutMs}` |

`mode` 只有两个：`blockout`（**唯一喂模型的通道** → `shot.refs.videos`）/
`preview`（人眼验收，不要填进镜头卡）。`timeoutMs` 夹取 30s–15min。
返回 `{ok, mode, usage, dir, mp4, rel, frames, seconds, spec, blend, blendRel, blender, missingAssets, hint}`。

### 2.10 `replace` — 视频换人（11 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/replace/meta` | 默认值 / 提示词字段 / 预设 / 画风 / 打光 / 加速方案 / 重叠帧档 / 上限 |
| POST | `/replace/prompt-template` | `{refCount}` → 带 `<Picture N>` 的模板 |
| POST | `/replace/preview-prompt` | `{roles[], shotBeats, extraNote}` → 预览 |
| POST | `/replace/compile-prompt` | `{prompt, useLlm}` → 三层降级编译（规则 → 本地翻译 → 原文兜底） |
| GET | `/replace/llm-status` | 本地翻译服务状态 |
| POST | `/replace/plan` | `{sourceRel, segmentSec, continuation, contextLength, segmentCount}` → 分段方案 |
| GET · POST | `/replace/tasks` | 列任务 / 建任务（建库存盘，不启动） |
| GET · DELETE | `/replace/tasks/:id` | 单任务 / 删任务 |
| POST | `/replace/run/:id` | 启动执行（立即返回，进度走 SSE `replace-progress`） |

换人线**完全不读** `projects/` 与 `shots/`：只有源视频、参考图（≤9，下标 +1 = `<Picture N>`）、
提示词三个概念。`continuation` 默认开启（独立重绘必然段间跳变）。

### 2.11 `toolbox` — 工坊 / 模板 / 服化道 / 资源 / 画布（27 组）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/h3/workshop/analyze` | 剧本 → 分段 + 资产提示词（**只产文本**） |
| POST | `/h3/workshop/import` | 分析结果落盘进素材库 |
| GET · POST | `/h3/film/status` `/h3/film/render` | 成片合成 `{inputs[], output, subtitleFile, timeoutSec}` |
| GET | `/templates` | 提示词模板（内置 20 条 + 用户覆盖） |
| POST | `/templates/upsert` `/templates/delete` | 增改 / 删 |
| GET | `/wardrobe` | 服化道（`?kind=`） |
| POST | `/wardrobe/upsert` `/wardrobe/delete` `/wardrobe/resolve` | 增改 / 删 / → `{images, notes, count, items}` |
| GET | `/toolbox/health` | 数据健康（坏 JSON 降级清单） |
| POST | `/import/scan` `/import/preview` | 分镜目录扫描 / 预览（不落盘） |
| GET | `/resources/orphans` | 孤儿产物（`assets/` 里无索引引用的文件） |
| GET | `/resources/previz` | 预演产物占用（按 run 统计） |
| POST | `/resources/previz/clean` | `{keepRuns, maxBytes}` |
| POST | `/resources/clean` | `{confirm:true}` 清孤儿 |
| GET | `/motionshots` | 动态条（`?projectId=`） |
| POST | `/motionshots/upsert` `/motionshots/delete` | 增改 / 删 |
| GET · POST | `/logs` | 运行日志（`?limit=` / 追加） |
| GET | `/canvas-agent/meta` | 17 工具 + 4 权限位 + `current` 当前值 |
| POST · PUT | `/canvas-agent/permissions` | 改权限 `{permissions}` |
| POST | `/canvas-agent/exec` | `{name, arguments, context, projectId}` |

**画布 Agent 的 17 个工具**：
读 —— `resolve` `list_refs` `project_overview` `list_nodes` `get_node` `read_document`
`search_assets` `list_skills` `image_job_status` `skill_task_status`；
写 —— `update_node` `insert_image` `batch` `delete_node`；
花钱 —— `generate_image` `generate_video` `call_skill`。

**4 个权限位**：`canWriteCanvas`（默认 true）/ `canSpend`（默认 false）/ `canDelete`（默认 true）/
`autoRun`（默认 false）。`/exec` 一律用**服务端**权限，请求体里同名声明会被丢弃。

### 2.12 已删除的域（不存在，别照旧文档调用）

`/script/*`、`/comic/*`、`/mw/*` 共 30+ 条已随页面删除，现在打过去是 404 `UNKNOWN_ROUTE`。
剧本类需求用 `/h3/workshop/*`（只产文本）。

---

## 3. 生成入参细节

### 3.1 视频（`/generate` / `studio_generate`）

| 键 | 说明 |
|---|---|
| `projectId` `shotId` | 必填。`shotId` 必须在该项目的镜头表里 |
| `backend` | 缺省取 `shot.backend` → `cfg.defaultBackend`（默认 `h3-nanfeng`） |
| `seed` | 缺省 1101。南风链路真正透传到 `随机种子` |
| `preset` `params` `mode` | 与 `studio_generate` 同形，两入口落点一致 |
| `accelPlan` `steps` | 单次尝试覆盖（优先于 shot / cfg） |

流程：解析角色卡（`withVaultCards`）→ 编译提示词（带 lint 警告）→ 建 job → 异步执行。

### 3.2 图像（`/image/generate`）

除 `prompt` 外全部可选：`refImages ≤16`（第 1 张 = 被编辑的原图）· `sizeId` / `width`+`height` ·
`seed` · `count 1..4` · `loras ≤6` · `projectId`。

尺寸表 id：`auto` `sq-2048` `p-4x3` `l-4x3` `p-2x3-film` `v-16x9` `h-16x9` `ecom-sq` `ecom-45`
`comic-page` `h3-4k-sq` `h3-4k-169`。

**三条硬约束**：
- 采样 6 步写死在 checkpoint 的 PDD 头网格里（`effective.samplingLocked = true`），
  `cfg.imageSteps` 只影响普通出图，改了也只在 `/image/meta` 显示 `stepsOverridden: true`；
- 无负面提示词（`BasicGuider` 没有 negative 分支，写"不要 XX"反而把 XX 拉进画面）；
- 宽高必须 **32 的倍数**（latent 16× × patch(1,2,2)），非 32 倍数会被补边。

**批量**：`count=2..4` 返回 `jobIds[]` + `batchId`（`imgbatch_*`），用
`/image/progress?ids=` 一次轮询整组。返回里 `mode` 为 `edit`（有参考图）或 `t2i`。

### 3.3 局部重绘（`POST /image/inpaint` / `studio_image action=inpaint`）

`prompt` 必填，其余可选。**没有 denoise 参数，被锁在 1.0**——PDD 只有 6 个预测头 /
7 点 sigma 网格，`BasicScheduler` 在 `denoise<1` 时取 `int(6/denoise)`，实测 0.5 只剩 3 个头
工作（"区域被抹平"，不是"改得更少"）。改动强弱一律用 `strength`。

| 参数 | 说明 |
|---|---|
| `source` / `sourceImage` | 源图（相对路径或 dataURL） |
| `mask` / `maskImage` | 白=重绘区。**尺寸必须与源图完全一致**，否则 400 `MASK_SIZE_MISMATCH` |
| `mode` | `crop`（默认）· `full` |
| `strength` | `full`/`strong`/`medium`/`light` → SplitSigmas 切点 0/1/2/3（6/5/4/3 步） |
| `crop.resolutionId` | `auto`（推荐）/ `512` / `768` / `1024` / `1280` |
| `crop.padding` / `minCrop` / `maxCrop` | 默认 `64` / `256` / `1024` |
| `bboxW` + `bboxH` | 优先级：调用方显式给 > 从 mask 文件实测 > 按面积估算 |

**`auto` 档的算法**：`base_res = max(bbox_w, bbox_h) × 1.5`，保证**缩放比 ≥ 1**（笔画绝不
被缩小）。小选区会自动放大（bbox 300×200 → 448²）；大选区受 `maxCrop` 封顶，响应里带
`warnings` 说明，不静默。

| 模式 | mask 外像素变化 | 说明 |
|---|---|---|
| `crop` | ~0.005（0.00%） | 逐像素保真 |
| `full` | ~3.4（4.5%） | 有 VAE 重编码损耗 |

不规则选区（画笔拖出的 S 形）**必须用 crop**：实测 S 形笔画（覆盖率 6.84%），`crop` 有
99.5% 改动落在笔画内，`full` 有 52% 溢出到笔画外（16× 下采样的 latent 表达不了细笔画）。

**依赖**：`crop` 模式需要 `vendor/inpaint-nodes/` 的两个节点
（`JZImageCropByMaskAndResize` / `JZImageUncropByMask`）。先用 `GET /image/inpaint/meta` 看
`cropAvailable`，false 时只能用 `full`。部署：

```powershell
pwsh -File vendor/inpaint-nodes/deploy-vendor.ps1 -ComfyDir "<ComfyUI>"   # 之后重启 ComfyUI
```

**前端**：`#/image` 页的「局部重绘」tab，内置画笔画 mask（三层 canvas：底图 / mask 数据层 /
红色覆盖预览）。

### 3.4 立绘拆解（`/breakdown/*`）

**只有一个可调项：`prompt`（整段提示词）。**
不传 / 空串 → 用 `meta.defaultPrompt`（三视图角色设定卡）。后端**不拼装、不改写、不追加**，
只 trim。超 4096 字符 → 400 `PROMPT_TOO_LONG`（不静默截断）。尺寸固定 2368×1776，没有 sizeId。

已作废的结构化字段（`character` / `outfit` / `parts` / `views` / `notes` / `level` / `sizeId`）：
传了不报错，但不影响提示词，响应里回 `legacyFieldsIgnored`。

**换装类改动必须保留授权句**「文字里明确写出的要求优先于参考图」，否则参考图会把改动盖回去。

---

## 4. 前端 14 条路由

权威来源 `app-src/src/router.tsx` 的 `ROUTES`；`client.js` 的 `entries` 与 `App.tsx` 的 `NAV`
必须逐项一致（不一致会导致"点了 A 出现 B"）。

| 组 | 路由 | 页面 | 主要接口 |
|---|---|---|---|
| 制作 | `#/render` | **渲染（主入口）** 选角色卡 + 参考图/视频/音频 → 编译 → 渲染 → 页内预览；含续写批次面板 | `/render/plan` `/render/compile` `/generate` `/nanfeng/continuation/*` |
| 制作 | `#/replace` | **视频换人**：源视频 + 目标角色参考图 + 提示词 | `/replace/*` |
| 制作 | `#/storyboard` | **智能分镜**：DSH 模型看图 + 写分镜提示词 | `/nanfeng/storyboard/*` |
| 制作 | `#/workshop` | **H3 工坊**：剧本 → 中性分段 + 资产提示词（只产文本） | `/h3/workshop/*` `/h3/film/*` |
| 资源 | `#/assets` | 素材库（15 类） | `/assets*` |
| 资源 | `#/vault` | **角色卡仓库** | `/vault/*` |
| 资源 | `#/projects` | 项目（含"本项目角色卡"） | `/projects*` `/projects/:id/cards` |
| 工具 | `#/edit` | **视频剪辑**：裁切 / 拼接 / 音轨 / 出片 | `/edit/*` |
| 工具 | `#/breakdown` | **立绘拆解**（立绘 → 多视角设定卡） | `/breakdown/*` |
| 工具 | `#/previz` | **3D 预演**：Blender 渲灰模参考视频 | `/blender/*` |
| 工具 | `#/canvas` | 画布（26 节点 + AI 助手） | `/projects/:id` `/canvas-agent/*` |
| 工具 | `#/image` | **图像生成**（H3-Image，含局部重绘 tab） | `/image/*` |
| 系统 | `#/jobs` | 任务中心 | `/jobs*` |
| 系统 | `#/settings` | 设置 8 区 +「工具」tab（模板 / 服化道 / 清理 / 日志） | `/config` `/templates` `/wardrobe` 等 |

**旧路由重定向**（书签不白屏）：`h3 → render`、`prompt → render`、`director → previz`、
`toolbox → settings`。已删除且不重定向：`#/script` `#/comic` `#/mw`（走未知路由告警并回退 render）。

### 页面职责边界（容易搞混的四组）

| 页面 | 做什么 | 不做什么 |
|---|---|---|
| H3 工坊 `#/workshop` | 一集剧本 → 中性分段 + 抽角色/场景/道具清单 | **不出任何图** |
| 智能分镜 `#/storyboard` | 给参考图 → LLM 看图 + 写分镜提示词 | 不生成视频 |
| 立绘拆解 `#/breakdown` | 立绘 → 多视角设定卡图（走 H3-Image） | 不做剧本分析 |
| 角色卡 `#/vault` | 存设定卡图 + 文字设定，渲染时引用 | 不生成图 |

---

## 5. 典型调用链

### 5.1 从头做一条视频（推荐：角色卡 + 渲染页那套）

```
1) GET  /vault/cards                                    → 拿已有角色卡 id
2) POST /render/plan {cardIds, videos:[{rel}], audios:[{rel}], refImageSize}
     → ★ 先看"这一镜到底传什么"：images[{index,source,cardName}]、videos[{index,audioIndex}]、warnings
3) POST /render/compile {cardIds, ..., shots:[...]}     → 编译好的提示词（含 <Picture N>）
4) studio_project {action:'create', patch:{name}}       → 得 projectId
5) POST /projects/:id/cards {cardIds}                   → 项目级绑卡（可选）
6) studio_shot {action:'create', projectId, shot:{
     title, durationSec, mode:'ref2va',
     cardIds,
     refs:{ images:[], videos:[{rel, hasAudio}], audios:[] },
     refImageSize:'match', sound, music, description, camera }}
7) studio_generate {projectId, shotId, backend:'h3-nanfeng'}   → 得 jobId
8) studio_jobs {action:'get', jobId}                           → 轮询到 completed
9) 产物 data/outputs/<jobId>.mp4（带音轨），已自动归档进素材库
```

> **务必先调 `/render/plan`**。编号（`<Picture N>` / `<Video K>` / `<Audio J>`）由后端统一算，
> 自己推极易错 —— `<Audio>` 是**全局累加**（视频自带的音轨先占号）。规则见
> `jiuzhang-studio-prompt`。

### 5.2 出一张图

```
1) studio_image {action:'meta'}                                    → 确认模型就绪 + 看真实生效参数
2) studio_image {action:'generate', prompt:'...', sizeId:'sq-2048'} → 得 jobId
3) studio_jobs  {action:'list'}                                    → 查状态
```

**改图（编辑模式）**——第 1 张参考图就是"被编辑的原图"：

```
1) studio_image {action:'lora'}          → 看装了哪些图像 LoRA（可选）
2) studio_image {
     action:'generate',
     prompt:'Edit <Picture 1>: change the dress to red silk, keep the face and pose unchanged.',
     refImages:['assets/立绘.png','assets/红色礼服参考.png'],   ← 第 1 张决定画布与编辑目标
     sizeId:'auto',                                            ← auto 继承第 1 张尺寸
     loras:[{name:'h3img/30_style/xxx.safetensors', strength:0.8}],
     count:2                                                   ← 同 prompt 两个种子（拆 2 个任务）
   }                                        → 得 jobId + jobIds[]
3) GET /image/progress?ids=<jobIds 逗号连接>  → 排队 / 生成中 / 取回产物
```

> 编辑模式下**不要用文字复述图里的长相与服装** —— 模型看得见，只写"要改什么；什么保持不变"。

### 5.3 局部重绘

```
1) GET  /image/inpaint/meta                           → 确认 cropAvailable 与强度档
2) POST /image/inpaint {
     prompt:'a translucent blue crystal embedded in the skirt folds',
     source:'assets/立绘.png',
     mask:'assets/mask.png',                          ← 白=重绘区，尺寸与源图一致
     mode:'crop',
     strength:'strong',
     crop:{resolutionId:'auto'}                       ← 不给 bbox 时后端从 mask 实测
   }                                                  → {jobId, cropResolution, cropSampleEdge, warnings}
3) GET  /image/progress?ids=<jobId>
```

### 5.4 做角色卡（立绘 → 拆解 → 入库）

```
1) GET  /assets                                                → 选立绘（拿 rel）
2) GET  /breakdown/meta                                        → 取默认提示词
3) POST /breakdown/preview {prompt}                            → 先看提交用词
4) POST /breakdown/generate {prompt, refImages:[rel]}          → 出设定卡图
5) POST /assets/archive {items:[{rel, type:'character_sheet'}]} → 入库
6) POST /vault/cards {name, traits, images:{sheet:[rel], origin:[rel]},
                      refPolicy:{mode:'sheet-first', maxImages:1}}  → 建卡
```

### 5.5 长视频：续写批次

```
1) studio_shot 写镜头卡（每段一张）
2) POST /nanfeng/continuation/plan {targetSeconds:30, segments:6, contextLength:'22'}
                                      → 先看分段方案（每段帧数、交付多长）
3) POST /nanfeng/continuation/batches {projectId, shotIds:['s1','s2','s3'],
                                       preset:'continuation', contextLength:'22'}  → 201
4) POST /nanfeng/continuation/batches/run {batchId, resetFailed?}   → 202，后台串行
5) GET  /nanfeng/continuation/batches/:id                            → 轮询进度（或订 SSE batch-progress）
6) POST /h3/film/render {inputs:['outputs/a.mp4','outputs/b.mp4']}   → 拼成一条
```

**为什么必须走批次**：段间靠 AV latent（`clip_1`、`clip_2`…）接续，单镜头渲染拿不到上一段的
latent，接不上 —— 插件会关掉续写并给警告。**段 1 也必须带续写任务**（Load 0 / Save 1），
否则 latent 不落盘、段 2 必然失败。失败即停（后续段依赖前段）。

各段编码参数需一致才能无损 concat；续写段本身已经是同一套编码。

### 5.6 Blender 白模 → 参考视频 → 成片（★ 最可靠的路径）

```
# ① 确认引擎
studio_blender {action:'health'}

# ② 写镜头卡（走位 / 道具 / 机位）
studio_shot {action:'save', projectId, shot:{
  title:'镜1', durationSec:3, ratio:'16:9', mode:'ref2va',
  actors:[
    {name:'初华', heightM:1.68, color:'#ffb347', position:[-1.1,0,0.85],
     action:'walk', startFrame:0, durationFrames:72, from:[-1.1,0,0.85], to:[-0.22,0,0.30]},
    {name:'祥子', heightM:1.66, color:'#a06cff', position:[0.9,0,0.85],
     action:'walk', startFrame:0, durationFrames:72, from:[0.9,0,0.85], to:[0.20,0,0.30]}
  ],
  props:[{kind:'box', name:'bench', position:[0,0.28,0.6], scale:[1.5,0.55,0.5]}],
  camera3d:{position:[0,1.55,-4.2], target:[0,0.95,0.4], fov:45},
  cardIds:['card_A','card_B']
}}

# ③ 先渲预览确认走位（人眼看，4 秒级）
studio_blender {action:'render', mode:'preview', projectId, shotId}

# ④ 渲灰模参考视频（~21 秒）
studio_blender {action:'render', mode:'blockout', projectId, shotId, timeoutMs:600000}
#    → {rel:'previz/blender/<jobId>/blockout.mp4'}

# ⑤ 写进镜头卡再生成
studio_shot {action:'save', projectId, shot:{ id:shotId,
  refs:{ videos:[{rel:'previz/blender/<jobId>/blockout.mp4', name:'blockout.mp4'}] }}}
studio_generate {projectId, shotId, backend:'h3-nanfeng', seed:2024}
```

**提示词必须描述画面里真实存在的东西**（人数、主要道具、机位方向），否则前几秒会被提示词
抢走。首尾帧：**南风 V15** 直接占「图片1 / 图片2」，没有 AddGuide 节点（I2VA 恰好 1 张图、
FL2VA 恰好 2 张图，由插件在提交前填槽）；`h3-local` 旧路径才有 AddGuide。

### 5.7 视频换人

```
1) GET  /replace/meta                                            → 取默认值 / 上限 / 重叠帧档
2) POST /replace/prompt-template {refCount:1}                    → 拿模板（<Picture 1> = 目标角色）
3) POST /replace/preview-prompt {roles[], shotBeats, extraNote}  → 预览
4) POST /replace/compile-prompt {prompt}                         → 三层降级编译（可选）
5) POST /replace/tasks {sourceRel, refImages:[rel], prompt, continuation:true,
                        accelPlan:'dmad8', contextLength:'22'}    → 建任务（不启动）
6) POST /replace/run/<id>                                        → 启动，进度走 SSE replace-progress
7) GET  /replace/tasks/<id>                                      → 轮询（阶段：queued/cutting/running/joining/done）
```

> 源视频**必须先 `POST /post/stripAudio`**：自带音轨会被当作 `<Audio j>` 送进条件，
> 干扰换人结果。

---

## 6. 任务生命周期

```
queued → running → completed
                 ↘ failed
                 ↘ cancelled（用户取消）
                 ↘ interrupted（插件重启，可重试）
```

`TERMINAL = {completed, failed, cancelled, interrupted}`。`jobs.json` 只保留最近 **500** 条终态
且 **30 天**内的记录；**未终态的任务永不裁剪**。

**轮询建议**：图像 5 秒（或直接轮 `/image/progress?ids=`），视频 10 秒。后端单任务等待上限
由 `comfyTimeoutMin`（默认 120 分钟）控制。

**产物**：视频 `data/outputs/<jobId>.mp4`、图像 `data/outputs/<jobId>.png`。
取文件 `GET /file?path=outputs/<jobId>.mp4`（支持 Range）。

---

## 7. 数据目录

```
data/
├─ config.json           配置（只写 17 个白名单键；dataDir 的"不存在则回落"只在内存里）
├─ workflows/            ★ 工作流模板 h3.json / h3-image.json（随插件分发，不跟随 dataDir）
├─ projects.json         项目列表
├─ projects/<id>/cards.json   项目绑定的角色卡
├─ shots/<id>/shots.json 镜头卡
├─ assets-index.json     素材索引
├─ assets/               上传素材（含 3D 模型，同时被 /jiuzhang/assets 静态服务）
├─ outputs/              生成产物
├─ vault/cards.json      角色卡仓库
├─ previz/blender/<run>/ Blender 预演帧序列 + mp4 + .blend
├─ post/                 后处理产物
├─ edit/ + edit/outputs/ 剪辑工程与成片
├─ replace/              换人任务与切段
├─ runs/                 续写批次状态
├─ extras/               prompt-templates.json / wardrobe.json / motion-shots.json / logs.json
├─ tmp-inline/           dataURL 落盘的临时图（带 TTL 回收）
└─ jobs.json             任务历史
```

> `/file` 白名单里的 `comic/` `script/` `previz-shots/` `inputs/` 只用于兼容历史数据，
> 引擎不再写入这几个目录。

---

## 8. 错误码

`host/api/errors.js` 有 **141 个错误码 → HTTP 状态**映射。解析顺序：
`err.status` → `err.code` 查表 → message 的 `CODE:` 前缀查表 → `*_REQUIRED` 文案兜底 → 500。

| 状态 | 数量 | 典型码 |
|---|---|---|
| 400 | 71 | `INVALID_ID` `INPUT_REQUIRED` `PROMPT_TOO_LONG` `UNKNOWN_BACKEND` `MASK_REQUIRED` `INPAINT_BAD_CROP` `NANFENG_CONSTRAINT` |
| 403 | 6 | `FORBIDDEN_PATH` `FORBIDDEN_HOST` `FORBIDDEN_ORIGIN` `WRITE_TOKEN_REQUIRED` `PERMISSION_DENIED` |
| 404 | 24 | `SHOT_NOT_FOUND` `JOB_NOT_FOUND` `PROJECT_NOT_FOUND` `WORKFLOW_MISSING` `CARD_NOT_FOUND` |
| 409 | 6 | `CANCELLED` `REPLACE_ALREADY_RUNNING` `IMAGE_MODEL_MISSING` `IMAGE_VRAM_LOW` |
| 413 / 415 | 4 | `BODY_TOO_LARGE` `FILE_TOO_LARGE` `UNSUPPORTED_FILE_TYPE` |
| 499 | 1 | `LLM_ABORTED` |
| 500 | 9 | `CORRUPT_JSON` `RUNTIME_NOT_READY` `FFMPEG_MISSING` `INPAINT_NODES_MISSING` `WORKFLOW_SHAPE_CHANGED` |
| 502 | 12 | `COMFY_*` `BLENDER_NO_OUTPUT` `IMAGE_STAGE_INCOMPLETE` `PROBE_FAILED` |
| 503 | 6 | `LLM_UNAVAILABLE` `GENERATE_UNAVAILABLE` `SKILL_UNAVAILABLE` |
| 504 | 2 | `COMFY_TIMEOUT` `BLENDER_TIMEOUT` |

常见处置：

| 错误 | 含义 | 处理 |
|---|---|---|
| `UNKNOWN_ROUTE` | 路由不存在（含已删除的 script/comic/mw） | 查 §2 表 |
| `WORKFLOW_MISSING` | 缺 `data/workflows/*.json` | 从仓库恢复 |
| `IMAGE_MODEL_MISSING` | 图像模型没下载 | 见 setup skill |
| `INPAINT_NODES_MISSING` | 没部署 crop&stitch 节点 | 跑 `vendor/inpaint-nodes/deploy-vendor.ps1` |
| `MASK_SIZE_MISMATCH` | mask 与源图尺寸不符 | 重新导出同尺寸 mask |
| `PERMISSION_DENIED` | 画布 Agent 权限不足 | 提对应权限位 |
| `CONFIRM_REQUIRED` | 危险操作需确认 | 传 `confirm: true` |

---

## 9. 硬约束速查

| 约束 | 值 |
|---|---|
| 视频帧数 | `17k+5`（124 / 243 / 362），由 `h3Length()` 统一算 |
| 视频时长 | 5–15 秒（>14 警告）；官方范围 4–15 |
| 视频分辨率 | 32 倍数 + 官方档位（`P12-draft` 864×480 … `P768-quality` 1344×768） |
| H3 guidance | 固定 1.0（压制词只走 `SUPPRESSION_GUARDS` 授权位置） |
| 视频步数 | DMAD 学生 4 或 8（`dmad4` / `dmad8`）；`none` = 原模型 50 步 |
| 图像步数 | 6 步锁定（PDD 头网格），`cfg.imageSteps` 仅作用于普通出图 |
| 图像 guidance | 固定 1.0 |
| 图像负面提示 | **不支持**（`BasicGuider` 无 negative 分支） |
| 图像尺寸 | 宽高 **32 的倍数** |
| 图像批量 | 1–4，**拆成 N 个独立任务** |
| 局部重绘 denoise | **锁定 1.0**，强弱用 `strength`（SplitSigmas 切片） |
| 参考图 | Ref2VA ≤9 / H3-Image ≤16 / 换人 ≤9 |
| 参考文件总数 | ≤12（视频 ≤3、音频 ≤3，单段 2–15 秒，总量 ≤15 秒） |
| 提示词上限 | 7000 字符（官方）/ 6000（本地 lint 阈值）/ 4096（H3-Image，超长 400 不截断） |
| 图像 LoRA | ≤6 条，只在 `models/loras/h3img/` 下生效 |
| 12GB 显存 | **不能并行**，`maxConcurrentLocal` 默认 1 |
| 镜头卡坐标系 | (x, y=高度, z=深度)；Blender 是 Z-up |