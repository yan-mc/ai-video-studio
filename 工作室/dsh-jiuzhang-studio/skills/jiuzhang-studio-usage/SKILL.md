---
name: jiuzhang-studio-usage
description: 九章工作室插件的完整操作手册，供 AI 代理调用。涵盖 13 个 Agent 工具、101 条 REST 路由、13 个前端页面的调用方式与参数。当需要通过插件生成视频/图像（含参考图/视频/音频/控制视频）、管理角色卡与素材、做剧本漫画模特、用 Blender 白模指导视频生成、做分段串联时使用。
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

## 1. 13 个 Agent 工具速查

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
| `studio_jobs` | `action: list\|get\|cancel\|retry`, `jobId` | 任务查询/取消（真终止远端） |

### 1.4 专业工作台

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_script` | `action: meta\|get\|stage\|runAll\|check`, `projectId`, `stage`, `premise`, `genre` | 剧本 5 阶段 |
| `studio_mw` | `action: meta\|jobs\|create\|replan\|plans\|savePlan\|applyPlan\|figures`, `mode`, `styleId`, `count` | 模特工作台 |
| `studio_prompt` | `action: meta\|compile\|fromShot`, `mode`, `styleId`, `subjects[]` | H3 提示词编译 |
| `studio_post` | `op: transcode\|scale\|crop\|split\|annotate\|extractFrame\|extractAudio\|qc`, `input` | 图像/视频工具 |
| `studio_h3_workshop` | `action: analyze\|import`, `text`/`dir`, `episode` | 剧本 → 分段 + 资产 |
| `studio_blender` | `action: health\|assets\|actions\|render\|spec`, `mode`, `projectId`, `shotId`, `assetRel` | **Blender 预演**：渲控制通道 / 列资产 / 读动作名 |

---

## 2. REST API 分组（101 条）

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

**backend 取值**：`h3-local`（本地）/ `seedance-cloud`（云端）/ `mock`（占位）

### 2.4 图像生成

```
GET  /jiuzhang/api/image/meta         模型状态 + 12 种尺寸
POST /jiuzhang/api/image/generate     {prompt, sizeId, seed, refImages[], projectId}
```

**sizeId**：`auto`（2048²）/ `sq-2048` / `p-4x3` / `l-4x3` / `p-3x4-film` / `v-16x9` / `h-16x9` / `ecom-sq` / `ecom-45` / `comic-page` / `h3-4k-sq` / `h3-4k-169`

### 2.5 立绘拆解

```
GET  /jiuzhang/api/breakdown/meta
POST /jiuzhang/api/breakdown/preview  {character, outfit[], parts[], views[], expressions[], level}
POST /jiuzhang/api/breakdown/generate 同上 + refImages[] + sizeId
```

**level**：`standard`（三视图+服装+部件）/ `full`（与 standard 同内容，表情差分已移除）/ `parts`（纯部件）

### 2.6 提示词编译

```
GET  /jiuzhang/api/prompt/meta        9 种画风 + 5 种模式 + 硬约束
POST /jiuzhang/api/prompt/compile     完整输入包 → 提示词
POST /jiuzhang/api/prompt/from-shot   从镜头卡编译
POST /jiuzhang/api/prompt/preview     只编译不落盘
```

### 2.7 剧本

```
GET  /jiuzhang/api/script/meta        14 题材 + 5 阶段
GET  /jiuzhang/api/script?projectId=
POST /jiuzhang/api/script/stage       {projectId, stage, ...}
POST /jiuzhang/api/script/runAll      {projectId, title, premise, genre, episodes}
POST /jiuzhang/api/script/check       {projectId, limit}
POST /jiuzhang/api/script/save
```

### 2.8 漫画

```
GET  /jiuzhang/api/comic/meta         11 版式 + 15 站
GET  /jiuzhang/api/comic?projectId=
POST /jiuzhang/api/comic/extract      {projectId, text, pages, template}
POST /jiuzhang/api/comic/relayout     {projectId, pageIndex, template}
POST /jiuzhang/api/comic/preflight    {projectId}
POST /jiuzhang/api/comic/plan-prompts {projectId, style, scene}     ← 零费用
POST /jiuzhang/api/comic/render-panels {projectId, limit, sizeId}   ← 出图
GET  /jiuzhang/api/comic/image-progress?projectId=
POST /jiuzhang/api/comic/export/page  {projectId, pageIndex}
POST /jiuzhang/api/comic/export/all
```

### 2.9 模特工作台

```
GET  /jiuzhang/api/mw/meta
GET  /jiuzhang/api/mw/jobs
POST /jiuzhang/api/mw/jobs            {mode, styleId, sizeId, count, kind, model, garments}
POST /jiuzhang/api/mw/job/update      {id, patch}
POST /jiuzhang/api/mw/job/replan      {id}
POST /jiuzhang/api/mw/job/delete      {ids[]}
POST /jiuzhang/api/mw/job/generate    {id, seed}                    ← 出图
GET  /jiuzhang/api/mw/plans
POST /jiuzhang/api/mw/plan/save       {jobId, name}
POST /jiuzhang/api/mw/plan/apply      {jobId, planId}
POST /jiuzhang/api/mw/plan/delete     {id}
GET  /jiuzhang/api/mw/figures
POST /jiuzhang/api/mw/figure/upsert
POST /jiuzhang/api/mw/figure/delete
```

**mode**：`ecom`（电商）/ `film`（影视）
**ecom 风格**：`studio-clean` `lifestyle` `street` `french` `vintage` `minimal`
**film 风格**：`ink-wuxia` `ancient` `modern` `cyber` `wasteland` `fantasy` `noir` `pastel` `steampunk` `horror`

### 2.10 Blender 预演（渲染控制序列）

```
GET  /jiuzhang/api/blender/health                       引擎状态（exe / 支持的通道 / 脚本是否存在）
GET  /jiuzhang/api/blender/assets                       3D 资产库（glb/gltf/fbx/obj）
POST /jiuzhang/api/blender/actions  {assetRel}          读某模型内置的动作名（会启一次 Blender）
POST /jiuzhang/api/blender/render   {mode, projectId, shotId, frames?}
                                                        渲一路（depth/pose/canny/gray/preview）
POST /jiuzhang/api/blender/open     {blendRel?}         用桌面 Blender 打开 .blend
```

**五个通道**：

| mode | 用途 | 实现 |
|---|---|---|
| `depth` | **最通用**，锁走位/遮挡/景深 | EEVEE + `View Z Depth` + MapRange |
| `pose` | 锁动作与站位 | 纯白 Emission 只给人偶 |
| `canny` | 锁建筑/道具结构 | 灰模 + ffmpeg `edgedetect` + `negate`（白底黑线） |
| `gray` | 锁光影布局 | Workbench SINGLE 色 + studio 光 |
| `preview` | **给人看**，不进 H3 | Workbench MATERIAL 着色（彩色 + 阴影 + 描边） |

> `render` 返回 `{ok, mode, dir, mp4, rel, frames, seconds, spec, blend, blendRel, blender, exitCode, missingAssets}`。
> `rel` 可直接填进 `shot.control.videoRel`。

**性能**：124 帧 @864×480 — depth **20.7s** / pose **20.8s** / preview **4s**（72 帧）。
H3 单镜要 217-259s，Blender 占比 **< 10%**。


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

## 3. 前端 13 页面对应关系

按「制作 / 资源 / 工具 / 系统」四组组织。

| 组 | 路由 | 页面 | 主要 API |
|---|---|---|---|
| 制作 | `#/render` | **渲染（主入口）** 选角色卡+参考图/视频/音频/控制视频 + **3D 走位** → 编译 → 渲染 → 页面内预览；含「成片合成」tab | `/render/plan`、`/render/compile`、`/generate`、`/h3/film/*` |
| 制作 | `#/script` | 剧本 5 阶段 + **「剧本拆解」tab**（原 H3 工坊） | `/script/*`、`/h3/workshop/*` |
| 制作 | `#/comic` | 漫画工作台 | `/comic/*` |
| 制作 | `#/mw` | 模特工作台 | `/mw/*` |
| 资源 | `#/assets` | 素材库（15 类） | `/assets*` |
| 资源 | `#/vault` | **角色卡仓库** | `/vault/*` |
| 资源 | `#/projects` | 项目（含「本项目角色卡」） | `/projects*`、`/projects/:id/cards` |
| 工具 | `#/breakdown` | **立绘拆解**（原「人设卡」，仅工具本身） | `/breakdown/*` |
| 工具 | `#/previz` | **3D 预演**：渲预览 / 渲控制通道 / 在 Blender 中编辑 | `/blender/*` |
| 工具 | `#/canvas` | 画布（26 节点 + AI 助手） | `/projects/:id`、`/canvas-agent/*` |
| 工具 | `#/image` | 图像生成 | `/image/*` |
| 系统 | `#/jobs` | 任务中心 | `/jobs*` |
| 系统 | `#/settings` | 设置 8 区 + **「工具」tab**（原工具箱） | `/config`、`/templates`、`/wardrobe` 等 |

**旧路由自动重定向**（书签不会白屏）：`h3→script`、`prompt→render`、`director→previz`、`toolbox→settings`。

### 页面职责的边界（容易搞混的三组）

| 名字相似 | 实际做什么 | 不做什么 |
|---|---|---|
| 「H3 工坊」→ 剧本拆解 | 一集剧本 → 中性分段 + 抽角色/场景/道具清单 | **不出任何图**，只产文本 |
| 「立绘拆解」 | 立绘 → 多视角设定卡图（H3-Image） | 不做剧本分析 |
| 「角色卡」 | 存设定卡图 + 文字设定，供渲染时引用 | 不生成图 |



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
1) GET  /assets?type=character                                       → 选立绘
2) POST /breakdown/preview {character, outfit[], parts[], level}    → 先看提示词
3) POST /breakdown/generate 同上 + refImages + sizeId               → 出设定卡图
4) POST /assets/archive {items:[{rel, type:'character_sheet'}]}     → 设定卡入库
5) POST /vault/cards {name, traits, images:{sheet:[rel], origin:[rel]},
                      refPolicy:{mode:'sheet-first', maxImages:1}}  → 建卡
```

### 4.4 剧本 → 漫画

```
1) studio_script {action:'runAll', projectId, title, premise, genre, episodes:12}
2) REST POST /comic/extract {projectId, text: <剧本分镜文本>, pages:2, template:'grid_2x2'}
3) REST POST /comic/plan-prompts {projectId, style, scene}          → 零费用先看
4) REST POST /comic/render-panels {projectId, sizeId:'sq-2048'}     → 真出图（自动归档）
5) REST POST /comic/export/all {projectId}                          → 导出内嵌 SVG
```

### 4.5 Blender 白模 → 控制视频 → 成片（★ 推荐路径）

**这是当前最可靠的做法**：用 Blender 渲 depth 当结构约束，比纯提示词稳定得多。

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

# ④ 渲控制通道（20 秒）
studio_blender {action:"render", mode:"depth", projectId, shotId}
#    → 返回 {rel:"previz/blender/xxx/depth.mp4"}

# ⑤ 把 rel 写进镜头卡并生成
studio_shot {action:"save", projectId, shot:{
  id: shotId,
  control:{type:"depth", videoRel:"previz/blender/xxx/depth.mp4",
           strength:1.3, startPercent:0.0, endPercent:0.85}
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
  control:{type:"depth", videoRel:"...段2的depth.mp4", strength:1.3},
  previz:{firstFramePath:"assets/chain_s1_last.png"}
}}
studio_generate {...}

# 最后拼接
ffmpeg -f concat -safe 0 -i list.txt -c copy final.mp4
```

> **为什么必须 Ref2VA + AddGuide**：I2VA/FL2VA **没有 `ref_images` 输入口**，
> 用了就挂不上角色卡，两张脸会飘。Ref2VA 支持参考图，AddGuide 在 `frame_idx=0`
> 锚首帧，两者共存。插件已自动走这条路径（`generator.js` 的 80/81 节点）。

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
- 漫画格：`data/comic/panels/<projectId>_p<页>_<格>.png`

取文件：`GET /jiuzhang/api/file?path=outputs/<jobId>.mp4`（支持 Range）

---

## 6. 数据存储

```
data/
├── config.json          配置（含 API key，已掩码返回）
├── projects.json        项目列表
├── assets-index.json    素材索引
├── jobs.json            任务历史
├── workflows/           ★ 工作流模板（h3.json / h3-image.json）
├── assets/              上传的素材文件
├── outputs/             生成产物
├── shots/<projectId>/   镜头卡
├── comic/<projectId>.json   漫画文档
├── comic/panels/        漫画格图
├── mw/                  模特作业/方案/形象库
├── script/<projectId>.json  剧本
├── extras/              模板/服化道/日志
├── previz-shots/        预演截图
└── post/                后处理产物
```

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
| 视频步数 | Turbo LoRA 4 或 8 |
| 图像步数 | 固定 6 |
| 图像 guidance | 固定 1.0 |
| 图像负面提示 | **不支持** |
| 参考图 | Ref2VA ≤9 / H3-Image ≤16 |
| 参考文件总数 | ≤12 |
| 12GB 显存 | **不能并行**，串行执行 |
| 提示词上限 | 7000 字符（H3）/ 4096 token（H3-Image） |
| 控制视频长度 | 长则截前段，短则重复末帧 |
| 控制模型目录 | `models/model_patches/`（不是 `controlnet/`） |
| Ref2VA 首尾帧 | 必须走 `MiniMaxH3AddGuide`，节点号 ≥80 |
| 镜头卡坐标系 | (x, y=高度, z=深度)；Blender 是 Z-up |
