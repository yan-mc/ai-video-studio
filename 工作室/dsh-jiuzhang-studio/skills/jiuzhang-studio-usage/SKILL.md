---
name: jiuzhang-studio-usage
description: 九章工作室插件的完整操作手册，供 AI 代理调用。涵盖 16 个 Agent 工具、104 条 REST 路由、15 个前端页面的调用方式与参数。当需要通过插件生成视频/图像、管理项目资产、做剧本漫画模特、操作 3D 导演台时使用。
---

# 九章工作室 · 操作手册（AI 调用向）

> 面向 AI 代理：本 skill 说明如何通过 **Agent 工具**、**REST API**、**前端页面** 使用插件的全部能力。
> 部署与模型下载见 `jiuzhang-studio-setup`；提示词写法见 `jiuzhang-studio-prompt`。

---

## 0. 三种调用方式怎么选

| 方式 | 适用场景 | 入口 |
|---|---|---|
| **Agent 工具** | AI 在对话中直接调用，最简单 | `studio_*` 工具（16 个） |
| **REST API** | 脚本/外部程序调用，粒度最细 | `http://127.0.0.1:<port>/luoshu/api/*` |
| **前端页面** | 人工操作，可视化 | `http://127.0.0.1:<port>/luoshu/app/` |

**端口**：DSH 每次启动随机分配，用 `webServer.getOrigin()` 或从 DSH 配置读。下文用 `<port>` 占位。

**鉴权**：所有 POST/PUT/PATCH/DELETE 需带 `X-JZ-Token` 头。
```js
const { token } = await (await fetch(`http://127.0.0.1:${port}/luoshu/api/token`)).json();
// 之后 headers: { 'X-JZ-Token': token, 'Content-Type': 'application/json' }
```

---

## 1. 16 个 Agent 工具速查

### 1.1 基础

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_meta` | — | 返回 26 节点 / 15 资产类型 / H3 19 槽位 / 档位表 |
| `studio_config` | `action: get\|set`, `patch` | 读写配置（16 个白名单字段） |

### 1.2 项目与素材

| 工具 | 关键参数 | 作用 |
|---|---|---|
| `studio_project` | `action: list\|create\|get\|update\|delete`, `id`, `patch` | 项目 CRUD |
| `studio_asset` | `action: list\|get\|upload\|delete`, `type`, `projectId` | 素材管理（15 类资产） |
| `studio_toolbox` | `domain: promptTemplates\|wardrobe\|importScan\|orphans\|motionShots\|logs\|batchProgress`, `action` | 工具箱 7 个域 |

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
| `studio_director` | `action: meta\|state\|command\|build\|cameraPrompt\|validate`, `name`, `args` | 3D 导演台 |
| `studio_prompt` | `action: meta\|compile\|fromShot`, `mode`, `styleId`, `subjects[]` | H3 提示词编译 |
| `studio_post` | `op: transcode\|scale\|crop\|split\|annotate\|extractFrame\|extractAudio\|qc`, `input` | 图像/视频工具 |
| `studio_h3_workshop` | `action: analyze\|import`, `text`/`dir`, `episode` | 剧本 → 分段 + 资产 |
| `studio_previz` | `action: health\|start\|stop\|state\|command` | 预演引擎控制 |

---

## 2. REST API 分组（104 条）

### 2.1 基础

```
GET  /luoshu/api/token              获取写令牌 + origin
GET  /luoshu/api/health             健康检查
GET  /luoshu/api/meta               元信息
GET  /luoshu/api/monitor            监控（含后端状态）
GET  /luoshu/api/config             读配置（key 掩码）
POST /luoshu/api/config             改配置
```

### 2.2 项目 / 镜头 / 素材

```
GET    /luoshu/api/projects
POST   /luoshu/api/projects
GET    /luoshu/api/projects/:id
POST   /luoshu/api/projects/:id      {patch}
DELETE /luoshu/api/projects/:id

GET  /luoshu/api/projects/:id/shots
POST /luoshu/api/projects/:id/shots  {shot}

GET  /luoshu/api/assets?type=&projectId=
POST /luoshu/api/assets/upload       multipart
GET  /luoshu/api/assets/item?id=     支持 Range/HEAD
POST /luoshu/api/assets/delete       {id}
GET  /luoshu/api/file?path=          通用文件（产物/资产）
```

### 2.3 视频生成

```
POST /luoshu/api/generate           {projectId, shotId, backend, seed}
GET  /luoshu/api/jobs
POST /luoshu/api/jobs/:id/cancel
POST /luoshu/api/jobs/:id/retry
GET  /luoshu/api/jobs/batch-progress
POST /luoshu/api/resolution         {profile, ratio}
POST /luoshu/api/h3/length          {durationSec, fps}
```

**backend 取值**：`h3-local`（本地）/ `seedance-cloud`（云端）/ `mock`（占位）

### 2.4 图像生成

```
GET  /luoshu/api/image/meta         模型状态 + 12 种尺寸
POST /luoshu/api/image/generate     {prompt, sizeId, seed, refImages[], projectId}
```

**sizeId**：`auto`（2048²）/ `sq-2048` / `p-4x3` / `l-4x3` / `p-3x4-film` / `v-16x9` / `h-16x9` / `ecom-sq` / `ecom-45` / `comic-page` / `h3-4k-sq` / `h3-4k-169`

### 2.5 人设卡拆解

```
GET  /luoshu/api/breakdown/meta
POST /luoshu/api/breakdown/preview  {character, outfit[], parts[], views[], expressions[], level}
POST /luoshu/api/breakdown/generate 同上 + refImages[] + sizeId
```

**level**：`standard`（三视图+服装+部件）/ `full`（+表情+材质）/ `parts`（纯部件）

### 2.6 提示词编译

```
GET  /luoshu/api/prompt/meta        9 种画风 + 5 种模式 + 硬约束
POST /luoshu/api/prompt/compile     完整输入包 → 提示词
POST /luoshu/api/prompt/from-shot   从镜头卡编译
POST /luoshu/api/prompt/preview     只编译不落盘
```

### 2.7 剧本

```
GET  /luoshu/api/script/meta        14 题材 + 5 阶段
GET  /luoshu/api/script?projectId=
POST /luoshu/api/script/stage       {projectId, stage, ...}
POST /luoshu/api/script/runAll      {projectId, title, premise, genre, episodes}
POST /luoshu/api/script/check       {projectId, limit}
POST /luoshu/api/script/save
```

### 2.8 漫画

```
GET  /luoshu/api/comic/meta         11 版式 + 15 站
GET  /luoshu/api/comic?projectId=
POST /luoshu/api/comic/extract      {projectId, text, pages, template}
POST /luoshu/api/comic/relayout     {projectId, pageIndex, template}
POST /luoshu/api/comic/preflight    {projectId}
POST /luoshu/api/comic/plan-prompts {projectId, style, scene}     ← 零费用
POST /luoshu/api/comic/render-panels {projectId, limit, sizeId}   ← 出图
GET  /luoshu/api/comic/image-progress?projectId=
POST /luoshu/api/comic/export/page  {projectId, pageIndex}
POST /luoshu/api/comic/export/all
```

### 2.9 模特工作台

```
GET  /luoshu/api/mw/meta
GET  /luoshu/api/mw/jobs
POST /luoshu/api/mw/jobs            {mode, styleId, sizeId, count, kind, model, garments}
POST /luoshu/api/mw/job/update      {id, patch}
POST /luoshu/api/mw/job/replan      {id}
POST /luoshu/api/mw/job/delete      {ids[]}
POST /luoshu/api/mw/job/generate    {id, seed}                    ← 出图
GET  /luoshu/api/mw/plans
POST /luoshu/api/mw/plan/save       {jobId, name}
POST /luoshu/api/mw/plan/apply      {jobId, planId}
POST /luoshu/api/mw/plan/delete     {id}
GET  /luoshu/api/mw/figures
POST /luoshu/api/mw/figure/upsert
POST /luoshu/api/mw/figure/delete
```

**mode**：`ecom`（电商）/ `film`（影视）
**ecom 风格**：`studio-clean` `lifestyle` `street` `french` `vintage` `minimal`
**film 风格**：`ink-wuxia` `ancient` `modern` `cyber` `wasteland` `fantasy` `noir` `pastel` `steampunk` `horror`

### 2.10 3D 导演台

```
GET  /luoshu/api/director/meta      15 命令 + 58 动作 + 28 运镜
GET  /luoshu/api/director/state
GET  /luoshu/api/director/shots
POST /luoshu/api/director/command   {name: 'director_*', arguments}
POST /luoshu/api/director/build     {projectId, shotId}
POST /luoshu/api/director/camera-prompt {shotId}   ← 机位→运镜描述
POST /luoshu/api/director/validate
POST /luoshu/api/director/start | stop
```

**28 个运镜 ID**：`static` `push` `pull` `zoom-in` `zoom-out` `dolly-zoom` `truck-left` `truck-right` `pan-left` `pan-right` `tilt-up` `tilt-down` `whip-pan-left` `whip-pan-right` `crane-up` `crane-down` `jib-up` `jib-down` `orbit` `arc-left` `arc-right` `follow` `tracking` `steadicam` `handheld` `handheld-intense` `roll-left` `roll-right`

### 2.11 预演

```
GET  /luoshu/api/previz/health | state
POST /luoshu/api/previz/start | stop | command
```

### 2.12 预演截图 → 出图

```
GET  /luoshu/api/previz-shot/meta
POST /luoshu/api/previz-shot/capture   {url, width, height, waitMs}  → 截图 + 裁剪
POST /luoshu/api/previz-shot/generate  {refPath | autoCapture, prompt, style, sizeId}
```

### 2.13 画布 Agent

```
GET  /luoshu/api/canvas-agent/meta   17 工具 + 4 权限位
POST /luoshu/api/canvas-agent/exec   {name, arguments, context, projectId}
```

**17 个工具**：
读：`resolve` `list_refs` `project_overview` `list_nodes` `get_node` `read_document` `search_assets` `list_skills` `image_job_status` `skill_task_status`
写：`update_node` `insert_image` `batch` `delete_node`
花钱：`generate_image` `generate_video` `call_skill`

**4 个权限位**：`canWriteCanvas`（默认 true）/ `canSpend`（默认 false）/ `canDelete`（默认 true）/ `autoRun`（默认 false）

### 2.14 工具箱

```
GET  /luoshu/api/templates  |  POST /templates/upsert  |  /templates/delete
GET  /luoshu/api/wardrobe   |  POST /wardrobe/upsert   |  /wardrobe/delete
POST /luoshu/api/import/scan | /import/preview
GET  /luoshu/api/resources/orphans | POST /resources/clean
GET  /luoshu/api/motionshots | POST /motionshots/upsert | /motionshots/delete
GET  /luoshu/api/logs | POST /logs
```

### 2.15 后处理

```
POST /luoshu/api/post/transcode | scale | crop | split | annotate
POST /luoshu/api/post/extractFrame | extractAudio | qc
GET  /luoshu/api/post/fonts
```

---

## 3. 前端 15 页面对应关系

| 路由 | 页面 | 主要 API |
|---|---|---|
| `#/canvas` | 画布（26 节点 + AI 助手） | `/projects/:id`、`/canvas-agent/*`、`/generate`、`/image/generate` |
| `#/assets` | 素材库（15 类） | `/assets*` |
| `#/projects` | 项目 | `/projects*` |
| `#/h3` | H3 工坊 | `/h3/workshop/*`、`/h3/film/*` |
| `#/script` | 剧本 5 阶段 | `/script/*` |
| `#/comic` | 漫画工作台 | `/comic/*` |
| `#/mw` | 模特工作台 | `/mw/*` |
| `#/director` | 3D 导演台 | `/director/*` |
| `#/prompt` | 提示词编译 | `/prompt/*` |
| `#/toolbox` | 工具箱 5 区 | `/templates|wardrobe|import|resources|logs` |
| `#/image` | 图像生成 | `/image/*` |
| `#/breakdown` | 人设卡拆解 | `/breakdown/*` |
| `#/previz` | 六个导演台入口 | `/previz/*` |
| `#/jobs` | 任务中心 | `/jobs*` |
| `#/settings` | 设置 8 区 | `/config` |

---

## 4. 典型调用链

### 4.1 从头做一条视频

```
1) studio_project  {action:'create', patch:{name:'测试'}}          → 得 projectId
2) studio_asset    {action:'list', type:'character'}                → 找角色参考图
3) studio_shot     {action:'create', projectId, shot:{title, durationSec:5, mode:'ref2v',
                     refs:{images:[参考图rel]}, description:'...', camera:'...'}}
4) studio_prompt   {action:'fromShot', projectId, shotId}           → 先看提示词对不对
5) studio_generate {projectId, shotId, backend:'h3-local'}          → 得 jobId
6) studio_jobs     {action:'get', jobId}                            → 轮询到 completed
7) 产物在 data/outputs/<jobId>.mp4，用 /file?path=outputs/... 取
```

### 4.2 出一张图

```
1) studio_image {action:'meta'}                                     → 确认模型就绪
2) studio_image {action:'generate', prompt:'...', sizeId:'sq-2048'}  → 得 jobId
3) studio_jobs  {action:'list'}                                     → 查状态
```

### 4.3 做人设卡

```
1) studio_asset {action:'list', type:'character'}                   → 选立绘
2) 调 REST POST /breakdown/preview {character, outfit[], parts[], level:'standard'}  → 先看提示词
3) 调 REST POST /breakdown/generate 同上 + refImages + sizeId       → 出图
```

### 4.4 剧本 → 漫画

```
1) studio_script {action:'runAll', projectId, title, premise, genre, episodes:12}
2) REST POST /comic/extract {projectId, text: <剧本分镜文本>, pages:2, template:'grid_2x2'}
3) REST POST /comic/plan-prompts {projectId, style, scene}          → 零费用先看
4) REST POST /comic/render-panels {projectId, sizeId:'sq-2048'}     → 真出图
5) REST POST /comic/export/all {projectId}                          → 导出内嵌 SVG
```

### 4.5 3D 预演控制构图

```
1) studio_director {action:'meta'}                                  → 拿 28 运镜 ID
2) studio_director {action:'command', name:'director_apply_camera',
                    args:{shot_id, move:'push'}}
3) studio_director {action:'cameraPrompt', shotId}                  → 得「运镜：轨道推近，机位前移」
4) REST POST /previz-shot/generate {autoCapture:true, prompt:'...'} → 白模变片
```

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

取文件：`GET /luoshu/api/file?path=outputs/<jobId>.mp4`（支持 Range）

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
