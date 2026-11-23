---
name: jiuzhang-studio-usage
description: 九章工作室插件的完整操作手册，供 AI 代理调用。涵盖 14 个 Agent 工具、115+ 条 REST 路由、14 条前端路由的调用方式与参数。当需要通过插件生成视频/图像（含参考图/视频/音频）、管理角色卡与素材、用 Blender 白模指导视频生成、做分段续写串联时使用。
---

# 九章工作室 · 操作手册（AI 调用向）

> 面向 AI 代理：本 skill 说明如何通过 **Agent 工具**、**REST API**、**前端页面** 使用插件的全部能力。
> 部署与模型下载见 `jiuzhang-studio-setup`；提示词写法见 `jiuzhang-studio-prompt`。

---

## 0. 三种调用方式怎么选

| 方式 | 适用场景 | 入口 |
|---|---|---|
| **Agent 工具** | AI 在对话中直接调用，最简单 | `studio_*` 工具（13 个） |
| **REST API** | 脚本/外部程序调用，粒度最细 | `http://127.0.0.1:<port>/jiuzhang/api/*` |
| **前端页面** | 人工操作，可视化 | `http://127.0.0.1:<port>/jiuzhang/app/` |

**端口**：DSH 每次启动随机分配，用 `webServer.getOrigin()` 或从 DSH 配置读。下文用 `<port>` 占位。

**鉴权**：所有 POST/PUT/PATCH/DELETE 需带 `X-JZ-Token` 头。
```js
const { token } = await (await fetch(`http://127.0.0.1:${port}/jiuzhang/api/token`)).json();
// 之后 headers: { 'X-JZ-Token': token, 'Content-Type': 'application/json' }
```

---

## 1. 14 个 Agent 工具速查

### 1.1 基础

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_meta` | — | 返回 26 节点 / 15 资产类型 / H3 19 槽位 / 档位表 |
| `studio_config` | `action: get\|set`, `patch` | 读写配置（16 个白名单字段） |

### 1.2 项目与素材

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_project` | `action: list\|create\|get\|update\|delete`, `id`, `patch` | 项目 CRUD |
| `studio_toolbox` | `domain: promptTemplates\|wardrobe\|importScan\|orphans\|motionShots\|logs\|batchProgress`, `action` | 工具箱 7 个域 |

> **素材没有独立工具**。素材的增删查走 REST：`/assets`、`/assets/upload`、
> `/assets/archive`、`/assets/delete`。`studio_image` / `studio_generate` 的产物
> 会自动归档进素材库（带 `assetId`），所以多数场景不需要手动调素材 API。

### 1.3 镜头与生成

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_shot` | `action: list\|create\|save\|delete`, `projectId`, `shot` | 镜头卡 CRUD |
| `studio_generate` | `projectId`, `shotId`, `backend`, `seed` | 触发生成（**视频**，走镜头卡） |
| `studio_image` | `action: meta\|generate`, `prompt`, `sizeId`, `refImages[]` | H3-Image **出图** |
| `studio_jobs` | `action: list\|get\|cancel`, `jobId` | 任务查询/取消（**没有 retry**；cancel 会真发 /interrupt 终止远端） |

### 1.4 专业工作台

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_prompt` | `action: meta\|compile\|fromShot`, `mode`, `styleId`, `subjects[]` | H3 提示词编译 |
| `studio_post` | `op: transcode\|scale\|crop\|split\|annotate\|extractFrame\|extractAudio\|qc`, `input` | 图像/视频工具 |
| `studio_h3_workshop` | `action: analyze\|import`, `text`/`dir`, `episode` | 剧本 → 分段 + 资产 |
| `studio_blender` | `action: health\|assets\|actions\|render\|spec`, `mode`, `projectId`, `shotId`, `assetRel` | **Blender 预演**：渲灰模参考视频 / 列资产 / 读动作名 |
| `studio_storyboard` | `action: meta\|analyze\|generate`, `imageRels[]`, `mode`, `count` | **智能分镜**：DSH 模型看图 + 写分镜 |
| `studio_edit` | `op: probe\|trim\|concat\|audio\|render\|clips\|projects`, `input`/`inputs[]`, `startSec`/`endSec`, `transitionSec`, `audioOp`, `projectId` | **视频剪辑**：裁切 / 拼接 / 音轨 / 出片 |

> ⚠️ `studio_script` / `studio_mw` 已随剧本页、模特工坊一并删除，不再存在。
> 当前注册的工具**恰好 14 个**，以上五张表合起来就是全部。

### 视频剪辑（studio_edit）

最常用的三条链路：

```
# 1) 掐掉头尾，得到一段
studio_edit { op:'trim', input:'outputs/job_xxx.mp4', startSec:1.5, endSec:8 }

# 2) 按顺序把几段接起来（硬切快、带转场需重编码）
studio_edit { op:'concat', inputs:['outputs/a.mp4','outputs/b.mp4'], transitionSec:0.5 }

# 3) 一条命令从片段列表直接出片（带 BGM 替换）
studio_edit { op:'render',
  clips:[{rel:'outputs/a.mp4',startSec:0,endSec:2},{rel:'outputs/b.mp4',startSec:1}],
  audio:{mode:'bgm', bgmRel:'assets/bgm.mp3', bgmVolume:0.5, replaceOriginal:true},
  transitionSec:0.4 }
```

要点：
- 工具里音轨子操作用 **`audioOp`**（顶层 `op` 已被占用），取值 `strip|volume|bgm`。
- 只接受 `dataDir` 内的路径；外部素材先走素材库上传。
- `concat` 会自动判断能否流复制：形状一致才 copy，否则重编码（避免花静默屏）。
- 产物写 `data/edit/outputs/`，返回 `{rel, bytes, meta}`；用 `probe` 复核时长。

---

## 2. REST API 分组（115 条精确方法+路径，另有 5 条前缀族与 7 条参数化族）

### 2.1 基础

```
GET  /jiuzhang/api/token              获取写令牌 + origin
GET  /jiuzhang/api/health             健康检查
GET  /jiuzhang/api/meta               元信息
GET  /jiuzhang/api/monitor            监控（含后端状态）
GET  /jiuzhang/api/config             读配置（key 掩码）
POST /jiuzhang/api/config             改配置
```

### 2.2 项目 / 镜头 / 素材

```
GET    /jiuzhang/api/projects
POST   /jiuzhang/api/projects
GET    /jiuzhang/api/projects/:id
POST   /jiuzhang/api/projects/:id      {patch}
DELETE /jiuzhang/api/projects/:id

GET  /jiuzhang/api/projects/:id/shots
POST /jiuzhang/api/projects/:id/shots  {shot}

GET  /jiuzhang/api/assets?type=&projectId=
POST /jiuzhang/api/assets/upload       multipart
GET  /jiuzhang/api/assets/item?id=     支持 Range/HEAD
POST /jiuzhang/api/assets/delete       {id}
GET  /jiuzhang/api/file?path=          通用文件（产物/资产）
```

### 2.3 视频生成

```
POST /jiuzhang/api/generate           {projectId, shotId, backend, seed}
GET  /jiuzhang/api/jobs
POST /jiuzhang/api/jobs/:id/cancel
POST /jiuzhang/api/jobs/:id/retry
GET  /jiuzhang/api/jobs/batch-progress
POST /jiuzhang/api/resolution         {profile, ratio}
POST /jiuzhang/api/h3/length          {durationSec, fps}
```

**backend 取值**：`h3-nanfeng`（**默认**，南风 V15，支持二采与续写）/ `h3-local`（旧模板路径，仅回退用）/ `h3-image`（本地图像）/ `mock`（**测试占位**，只出纯色卡）

### 2.4 图像生成

```
GET  /jiuzhang/api/image/meta         模型状态 + 12 种尺寸
POST /jiuzhang/api/image/generate     {prompt, sizeId, seed, refImages[], projectId}
```

**sizeId**：`auto`（2048²）/ `sq-2048` / `p-4x3` / `l-4x3` / `p-3x4-film` / `v-16x9` / `h-16x9` / `ecom-sq` / `ecom-45` / `comic-page` / `h3-4k-sq` / `h3-4k-169`

### 2.5 立绘拆解

```
GET  /jiuzhang/api/breakdown/meta       → {defaultPrompt, maxChars, size}
POST /jiuzhang/api/breakdown/preview    {prompt}                 → {prompt, chars, isDefault}
POST /jiuzhang/api/breakdown/generate   {prompt, refImages[]}    → {id, refCount, chars}
```

**只有一个可调项：`prompt`（整段提示词）。**

- 不传 / 传空串 → 用 `meta.defaultPrompt`（三视图角色设定卡）
- 用户改什么就提交什么：后端**不拼装、不改写、不追加**，只 `trim`
- 超 `maxChars`（4096）→ **400 `PROMPT_TOO_LONG`**，不静默截断
- 尺寸固定横版 2368×1776（4.2MP），没有 sizeId

> ⚠️ 档位（`level`）与结构化字段（`character` / `outfit` / `parts` / `views` /
> `notes` / `expressions` / `sizeId`）**已作废**：传了不报错，但不影响提示词，
> 响应里回 `legacyFieldsIgnored` 提醒调用方改直接写 `prompt`。

**换装类改动必须有授权句**：默认提示词里写着「文字里明确写出的要求优先于参考图」，
用自定义提示词时也要保留同义的一句，否则参考图会把你的改动盖回去。

**页面**：`#/breakdown` 首屏直接落在「② 改提示词」，参考图在加载时自动选中
第一张可用的大图。提示词面板右上角有五个按钮：

| 按钮 | 作用 |
|---|---|
| 复制默认值 | 复制后端下发的默认提示词（不受输入框当前内容影响）|
| 复制当前 | 复制输入框里这段（= 实际提交的那段）；框为空时回落默认值 |
| 恢复默认 | 把输入框覆盖回默认提示词 |
| 清空 | 清空输入框（提交时后端回落默认值）|
| 校验 | 走 `preview`，回报提交用词字符数 |

> ⚠️ 复制走的剪贴板在 Windows 上会把 `\n` 规范化为 `\r\n`（平台约定），
> 复制结果的字节数会比页面显示的多，内容是一样的。

### 2.6 提示词编译

```
GET  /jiuzhang/api/prompt/meta        9 种画风 + 5 种模式 + 硬约束
POST /jiuzhang/api/prompt/compile     完整输入包 → 提示词
POST /jiuzhang/api/prompt/from-shot   从镜头卡编译
POST /jiuzhang/api/prompt/preview     只编译不落盘
```

### 2.7 剧本 / 漫画 / 模特工作台 —— **已整体删除**

这三个模块（`/script/*`、`/comic/*`、`/mw/*` 共 30+ 条路由）在 2.0.0 已随页面一起删除：
它们与「用南风 V15 出视频」这条主线无关，是早期对标别的软件时留下的。

```
GET  /jiuzhang/api/script/meta        ← 404（已删除）
GET  /jiuzhang/api/comic/meta         ← 404（已删除）
GET  /jiuzhang/api/mw/meta            ← 404（已删除）
```

> 如果你看到某份旧文档还在讲这三个模块，那是过期信息。
> 剧本类的**替代**是 `studio_h3_workshop`（剧本 → 中性分段 + 资产提示词，只产文本）。

### 2.8 续写批次（长视频的唯一正确做法）

```
GET  /jiuzhang/api/nanfeng/continuation/plan   {count?, durationSec?} → 分段方案
POST /jiuzhang/api/nanfeng/continuation/batches/run   {projectId, shotIds[], preset, contextLength}
GET  /jiuzhang/api/nanfeng/continuation/batches/:id
POST /jiuzhang/api/nanfeng/continuation/batches/reset
```

`contextLength`（段间重叠帧）可选 `5 / 22 / 39 / 56`，默认 22（约 0.92 秒）。
段 2 起会裁掉这 `context_length` 帧，所以交付时长比请求时长短。

> ⚠️ **单镜头渲染 vs 续写批次**
>
> 镜头卡挂着 `continuation` 预设时，直接在渲染页点「开始渲染」**不会**接上一段 ——
> 插件会关掉续写并给出警告（没有上一段的 AV latent，接不上）。
> 要真正衔接，必须用续写批次按顺序提交整组镜头。

### 2.9 加速方案

```
GET  /jiuzhang/api/accel/plans        可用加速方案（dmad8 / dmad4 / none）
```

方案决定挂哪个蒸馏 LoRA、采样器、步数。默认 `dmad8`。

> ⚠️ 开「H3潜空间放大二采」时，上游只读 `H3一采步数 + H3二采步数`，
> `采样步数` 不生效。插件会按总步数自动拆分，并把拆分明细写进 `job.warnings`。


### 2.10 Blender 预演（渲灰模参考视频）

```
GET  /jiuzhang/api/blender/health                       引擎状态（exe / 支持的通道 / 脚本是否存在）
GET  /jiuzhang/api/blender/assets                       3D 资产库（glb/gltf/fbx/obj）
POST /jiuzhang/api/blender/actions  {assetRel}          读某模型内置的动作名（会启一次 Blender）
POST /jiuzhang/api/blender/render   {mode, projectId, shotId, frames?}
                                                        渲一路（blockout / preview）
POST /jiuzhang/api/blender/open     {blendRel?}         用桌面 Blender 打开 .blend
```

**两个通道**：

| mode | 用途 | 实现 |
|---|---|---|
| `blockout` | **喂模型**：灰模参考视频 → Ref2VA 的 `<Video N>` | Workbench FLAT 平光、无阴影、多角色带身份色 |
| `preview` | **给人看**，不进 H3 | Workbench MATERIAL 着色（彩色 + 阴影 + 描边） |

> `render` 返回 `{ok, mode, dir, mp4, rel, frames, seconds, spec, blend, blendRel, blender, exitCode, missingAssets}`。
> `rel` 可直接填进 `shot.refs.videos`。

**性能**：124 帧 @864×480 — blockout **~21s** / preview **4s**（72 帧）。
H3 单镜要 130–260s，Blender 占比 **< 10%**。


### 2.11 画布 Agent

```
GET  /jiuzhang/api/canvas-agent/meta   17 工具 + 4 权限位
POST /jiuzhang/api/canvas-agent/exec   {name, arguments, context, projectId}
```

**17 个工具**：
读：`resolve` `list_refs` `project_overview` `list_nodes` `get_node` `read_document` `search_assets` `list_skills` `image_job_status` `skill_task_status`
写：`update_node` `insert_image` `batch` `delete_node`
花钱：`generate_image` `generate_video` `call_skill`

**4 个权限位**：`canWriteCanvas`（默认 true）/ `canSpend`（默认 false）/ `canDelete`（默认 true）/ `autoRun`（默认 false）

### 2.12 工具箱

```
GET  /jiuzhang/api/templates  |  POST /templates/upsert  |  /templates/delete
GET  /jiuzhang/api/wardrobe   |  POST /wardrobe/upsert   |  /wardrobe/delete
POST /jiuzhang/api/import/scan | /import/preview
GET  /jiuzhang/api/resources/orphans | POST /resources/clean
GET  /jiuzhang/api/motionshots | POST /motionshots/upsert | /motionshots/delete
GET  /jiuzhang/api/logs | POST /logs
```

### 2.13 后处理

```
POST /jiuzhang/api/post/transcode | scale | crop | split | annotate
POST /jiuzhang/api/post/extractFrame | extractAudio | qc
GET  /jiuzhang/api/post/fonts
```

---

## 3. 前端 12 页面对应关系

按「制作 / 资源 / 工具 / 系统」四组组织。
权威来源是 `app-src/src/router.tsx` 的 `ROUTES`，`pnpm run check:routes` 会校验
它 / `App.tsx` 的 NAV / `client.js` 的 entries 三方一致。

| 组 | 路由 | 页面 | 主要 API |
|---|---|---|---|
| 制作 | `#/render` | **渲染（主入口）** 选角色卡 + 参考图/视频/音频 → 编译 → 渲染 → 页面内预览；含「续写批次」面板 | `/render/plan`、`/render/compile`、`/generate`、`/nanfeng/continuation/*` |
| 制作 | `#/storyboard` | **智能分镜**：DSH 模型看图 + 写分镜提示词（零 API Key） | `/nanfeng/storyboard/*` |
| 制作 | `#/workshop` | **H3 工坊**：一集剧本 → 中性分段 + 资产提示词（**只产文本，不出图**） | `/h3/workshop/*`、`/h3/film/*` |
| 资源 | `#/assets` | 素材库（15 类） | `/assets*` |
| 资源 | `#/vault` | **角色卡仓库** | `/vault/*` |
| 资源 | `#/projects` | 项目（含「本项目角色卡」） | `/projects*`、`/projects/:id/cards` |
| 工具 | `#/breakdown` | **立绘拆解**（立绘 → 多视角设定卡图） | `/breakdown/*` |
| 工具 | `#/previz` | **3D 预演**：Blender 渲灰模参考视频 | `/blender/*` |
| 工具 | `#/canvas` | 画布（26 节点 + AI 助手） | `/projects/:id`、`/canvas-agent/*` |
| 工具 | `#/image` | 图像生成（H3-Image） | `/image/*` |
| 系统 | `#/jobs` | 任务中心 | `/jobs*` |
| 系统 | `#/settings` | 设置 8 区 +「工具」tab（模板 / 服化道 / 清理 / 日志） | `/config`、`/templates`、`/wardrobe` 等 |

**旧路由自动重定向**（书签不会白屏）：`h3→render`、`prompt→render`、`director→previz`、`toolbox→settings`。

> 已删除且**不再重定向**：`#/script`、`#/comic`、`#/mw`（点进去会走未知路由告警并回退到渲染页）。

### 页面职责的边界（容易搞混的四组）

| 名字相似 | 实际做什么 | 不做什么 |
|---|---|---|
| 「H3 工坊」(`#/workshop`) | 一集剧本 → 中性分段 + 抽角色/场景/道具清单 | **不出任何图**，只产文本 |
| 「智能分镜」(`#/storyboard`) | 给参考图 → LLM 看图 + 写分镜提示词 | 不生成视频 |
| 「立绘拆解」(`#/breakdown`) | 立绘 → 多视角设定卡图（走 H3-Image） | 不做剧本分析 |
| 「角色卡」(`#/vault`) | 存设定卡图 + 文字设定，供渲染时引用 | 不生成图 |




---

## 4. 典型调用链

### 4.1 从头做一条视频（推荐路径：走角色卡 + 渲染页那套）

```
1) GET  /vault/cards                                  → 拿已有角色卡 id
2) POST /render/plan  {cardIds, videos:[{rel}], audios:[{rel}], refImageSize}
                                                      → ★ 先看「这一镜到底传什么」
                                                        返回 images[{index,source,cardName}]、
                                                        videos[{index,audioIndex}]、warnings、stats
3) POST /render/compile {cardIds, ..., shots:[...]}    → 拿编译好的提示词（含 <Picture N>）
4) studio_project {action:'create', patch:{name}}      → 得 projectId
5) POST /projects/:id/cards {cardIds}                  → 项目级绑卡（可选，镜头级也行）
6) studio_shot {action:'create', projectId, shot:{title, durationSec, mode:'ref2va',
                  cardIds, refs:{images:[], videos:[{rel,hasAudio}], audios:[]},
                  refImageSize:'match', sound, music, description, camera}}
7) studio_generate {projectId, shotId, backend:'h3-local'}   → 得 jobId
8) studio_jobs {action:'get', jobId}                         → 轮询到 completed
9) 产物 data/outputs/<jobId>.mp4（**带音轨**），且已自动归档进素材库
```

> **务必先调 `/render/plan`**。编号（`<Picture N>` / `<Video K>` / `<Audio J>`）
> 由后端统一算，自己推极易错 —— 尤其 `<Audio>` 是**全局累加**，
> 视频自带的音轨会先占号。

### 4.2 出一张图

```
1) studio_image {action:'meta'}                                     → 确认模型就绪
2) studio_image {action:'generate', prompt:'...', sizeId:'sq-2048'}  → 得 jobId
3) studio_jobs  {action:'list'}                                     → 查状态
```

### 4.3 做角色卡（立绘 → 拆解 → 入库）

```
1) GET  /assets                                                     → 选立绘（拿 rel）
2) GET  /breakdown/meta                                             → 取默认提示词
   （要换装/加视角：在默认提示词上改，再把整段作为 prompt 提交）
3) POST /breakdown/preview  {prompt}                                → 先看提交用词
4) POST /breakdown/generate {prompt, refImages:[rel]}                → 出设定卡图
5) POST /assets/archive {items:[{rel, type:'character_sheet'}]}      → 设定卡入库
6) POST /vault/cards {name, traits, images:{sheet:[rel], origin:[rel]},
                      refPolicy:{mode:'sheet-first', maxImages:1}}   → 建卡
```

**提示词即唯一输入**：不传 `prompt` 就是用默认三视图设定卡。
想让角色换一套衣服，直接改提示词里对应的服装段落 —— 但必须保留
「文字里明确写出的要求优先于参考图」这条授权句，否则参考图会盖掉改动。

### 4.4 长视频：续写批次（替代已删除的剧本/漫画流水线）

早期有「剧本 → 漫画」的产线，那三个模块（script / comic / mw）已整体删除。
现在要把一段戏做成超过单镜时长的连续视频，走**潜空间续写批次**：

```
1) studio_shot  写镜头卡（每段一张，durationSec 建议 5.17 / 5.88）
2) POST /nanfeng/continuation/plan {count:3, durationSec:10}
                                       → 先看分段方案（每段多少帧、交付多长）
3) POST /nanfeng/continuation/batches/run
   {projectId, shotIds:['s1','s2','s3'], preset:'continuation', contextLength:'22'}
                                       → 后台串行跑完整组
4) GET  /nanfeng/continuation/batches/:id    → 轮询进度
5) POST /h3/film/render {inputs:['outputs/a.mp4','outputs/b.mp4']}  → 拼成一条
```

**为什么必须走批次**：段与段之间靠 AV latent 接续（`clip_1`、`clip_2`…）。
单镜头渲染拿不到上一段的 latent，接不上 —— 插件会关掉续写并警告。

> 各段编码参数需一致才能无损 concat；续写段本身已经是同一套编码。


### 4.5 Blender 白模 → 参考视频 → 成片（★ 推荐路径）

**这是当前最可靠的做法**：用 Blender 渲一段灰模视频当参考，比纯提示词稳定得多。

```
# ① 确认引擎
studio_blender {action:"health"}

# ② 写镜头卡（走位/道具/机位）—— 没有 actors 只能用默认两人占位
studio_shot {action:"save", projectId, shot:{
  title:"镜1", durationSec:3, ratio:"16:9", mode:"ref2va",
  actors:[
    {name:"初华", heightM:1.68, color:"#ffb347", position:[-1.1,0,0.85],
     action:"walk", startFrame:0, durationFrames:72,
     from:[-1.1,0,0.85], to:[-0.22,0,0.30]},
    {name:"祥子", heightM:1.66, color:"#a06cff", position:[0.9,0,0.85],
     action:"walk", startFrame:0, durationFrames:72,
     from:[0.9,0,0.85], to:[0.20,0,0.30]}
  ],
  props:[{kind:"box", name:"bench", position:[0,0.28,0.6], scale:[1.5,0.55,0.5]}],
  camera3d:{position:[0,1.55,-4.2], target:[0,0.95,0.4], fov:45},
  cardIds:["card_A","card_B"]
}}

# ③ 先渲预览确认动画（4 秒，人眼看）
studio_blender {action:"render", mode:"preview", projectId, shotId}

# ④ 渲灰模参考视频（约 21 秒）
studio_blender {action:"render", mode:"blockout", projectId, shotId}
#    → 返回 {rel:"previz/blender/xxx/blockout.mp4"}

# ⑤ 把 rel 写进镜头卡的参考视频，再生成
studio_shot {action:"save", projectId, shot:{  id: shotId,
  refs:{ videos:[{rel:"previz/blender/xxx/blockout.mp4", name:"blockout.mp4"}] }
}}
studio_generate {projectId, shotId, backend:"h3-local", seed:2024}
```

#### 分段串联（长片拆段，每段尾帧接下一段首帧）

```
# 段1 完成后，抽末帧：
ffmpeg -sseof -0.1 -i shot1.mp4 -frames:v 1 data/assets/chain_s1_last.png

# 段2：加 previz.firstFramePath 指向它
studio_shot {action:"save", projectId, shot:{
  title:"镜2", durationSec:3.7, mode:"ref2va",
  actors:[...],  # 起点必须 == 段1 的终点，否则瞬移
  refs:{ videos:[{rel:"...段2的blockout.mp4", name:"blockout.mp4"}] },
  previz:{firstFramePath:"assets/chain_s1_last.png"}
}}
studio_generate {...}

# 最后拼接
ffmpeg -f concat -safe 0 -i list.txt -c copy final.mp4
```

> **南风 V15 上这条结论不成立**：V15 的首尾帧就是「图片1/图片2」本身，
> 没有 AddGuide 节点。I2VA 必须恰好 1 张图、FL2VA 必须恰好 2 张图，
> 由插件在提交前自动把 previz 首尾帧填进对应槽位（见 generator.js 的 frameSlotOverrides）。h3-local 旧路径仍有 AddGuide，那是另一条链路。

> **提示词必须描述画面里真实存在的东西**（人数、主要道具、机位方向），
> 否则前几秒会被提示词抢走。实测见 `docs/probes/h3-controlnet-2026-11-14/REPORT.md`。


### 4.6 成片合成

```
1) POST /h3/film/render {inputs:['outputs/a.mp4','outputs/b.mp4'],
                          output:'film.mp4', subtitleFile?}
2) GET  /h3/film/status                              → 查进度
```

> `inputs` 里的相对路径按 `dataDir` 解析（不是进程 cwd）。
> 各段的编码参数需一致才能无损 concat。

---

## 5. 任务生命周期

```
queued → running → completed
                 ↘ failed
                 ↘ cancelled（用户取消）
                 ↘ interrupted（重启后恢复时检测到）
```

**轮询建议**：图像 5 秒一次，视频 10 秒一次。插件内部最长等 40 分钟。

**任务产物**：
- 视频：`data/outputs/<jobId>.mp4`
- 图像：`data/outputs/<jobId>.png`
- 画布产物：写回节点（data/canvas/）

取文件：`GET /jiuzhang/api/file?path=outputs/<jobId>.mp4`（支持 Range）

---

## 6. 数据存储

```
data/
├── config.json          配置（运行期写入；绝对路径会被校验，换机自动回退）
├── projects.json        项目列表
├── assets-index.json    素材索引
├── jobs.json            任务历史（终态自动裁剪：最近 500 条 / 30 天）
├── workflows/           ★ 工作流模板（h3.json / h3-image.json，随插件分发）
├── assets/              上传的素材文件
├── outputs/             生成产物
├── shots/<projectId>/   镜头卡
├── vault/               角色卡仓库
├── previz/              Blender 预演渲染产物
├── previz-shots/        预演截图
├── extras/              模板/服化道/日志
├── runs/                续写批次状态
└── post/                后处理产物
```

> 已删除的目录：`comic/`、`mw/`、`script/`（对应模块在 2.0.0 移除）。


---

## 7. 常见错误码

| 错误 | 含义 | 处理 |
|---|---|---|
| `SHOT_NOT_FOUND` | 镜头不存在 | 先 list 确认 id |
| `WORKFLOW_MISSING` | 缺 `data/workflows/*.json` | 从仓库恢复 |
| `IMAGE_MODEL_MISSING` | 图像模型没下载 | 见 setup skill |
| `COMFY_HTTP_500` | 工作流被拒（多为非数字 key） | 检查工作流 JSON |
| `COMFY_EXEC_ERROR @节点` | ComfyUI 执行报错 | 看错误里的节点名与消息 |
| `PERMISSION_DENIED` | 画布 Agent 权限不足 | 提升对应权限位 |
| `CONFIRM_REQUIRED` | 危险操作需确认 | 传 `confirm: true` |
| `BAD_RESPONSE` | 页面缓存了旧端口 | `Ctrl+Shift+R` |
| `GENERATE_TIMEOUT` | 超过 40 分钟 | 查 ComfyUI 队列是否卡住 |

---

## 8. 硬约束速查

| 约束 | 值 |
|---|---|
| 视频分辨率 | 32 倍数 + 官方档位 |
| 视频帧数 | 17k+5（124/243/362） |
| H3 guidance | 1.0 |
| 视频步数 | DMAD 学生 4 或 8 |
| 图像步数 | 固定 6 |
| 图像 guidance | 固定 1.0 |
| 图像负面提示 | **不支持** |
| 参考图 | Ref2VA ≤9 / H3-Image ≤16 |
| 参考文件总数 | ≤12 |
| 12GB 显存 | **不能并行**，串行执行 |
| 提示词上限 | 7000 字符（H3）/ 4096 token（H3-Image） |
| 控制模型目录 | `models/model_patches/`（不是 `controlnet/`） |
| Ref2VA 首尾帧 | **南风 V15**：直接占 图片1/图片2（无 AddGuide）；`h3-local` 旧路径才走 AddGuide |
| 镜头卡坐标系 | (x, y=高度, z=深度)；Blender 是 Z-up |
