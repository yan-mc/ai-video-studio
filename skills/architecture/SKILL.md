---
name: jiuzhang-studio-architecture
description: 九章工作室插件的整体结构与运行原理。涵盖目录布局、四层架构（DSH Host / SPA / 南风桥接 / ComfyUI）、REST API 全表、Agent 工具全表、数据目录结构、安装与依赖流程、以及"改哪里改什么"的定位表。当需要理解插件怎么跑起来的、要加功能、要排查"某个功能在哪实现"、或部署到新机器时使用。
version: 1.0.0
---

# 九章工作室 · 架构与安装

> 面向 AI 代理与维护者：这份说明回答三个问题 ——
> **它由什么组成**、**数据怎么流动**、**改东西该动哪个文件**。
>
> 提示词写法见 `skills/prompt/*`；日常操作见 `skills/usage`；部署细节见 `skills/setup`。

---

## 一、四层架构

```
┌───────────────────────────────────────────────────────────────────┐
│ ① DSH Host 进程（Node ESM）                                        │
│    host/index.js         插件入口：注册路由 + 工具 + 启动编排        │
│    host/tools.js         14 个 studio_* Agent 工具                  │
│    host/api/index.js     105 精确 + 5 参数化 + 5 前缀族路由（/jiuzhang/api/*）         │
│    host/services/*       业务服务层（南风桥接 / Blender / 素材 …）    │
│    host/blender/*.py     Blender 子进程脚本                         │
└────────────────┬──────────────────────────────────┬───────────────┘
                 │ REST + SSE                       │ spawn 子进程
                 ▼                                  ▼
┌────────────────────────────────┐   ┌──────────────────────────────┐
│ ② Web SPA（React 18 + TS）     │   │ ④ Blender 5.2.4              │
│    app-src/src/                │   │    渲灰模参考视频 → <Video N> │
│    构建产物 app-dist/           │   └──────────────────────────────┘
│    由 Host 静态托管             │
└────────────────────────────────┘
                 │ ComfyUI /prompt
                 ▼
┌───────────────────────────────────────────────────────────────────┐
│ ③ ComfyUI 0.45.0 + vendor/nanfeng 自定义节点                       │
│    NanFengH3MultiReferenceGeneratorV15（221 参数巨型节点）          │
│      → GraphBuilder 内部展开 ~40 个节点                            │
│      → H3 模型出片（264×480 … 1472×832）                          │
└───────────────────────────────────────────────────────────────────┘
```

---

## 二、目录布局

```
dsh-jiuzhang-studio/
├─ host/                        ← ① Host 侧（Node ESM）
│  ├─ index.js                  插件入口
│  ├─ config.js                 配置层（白名单 + 缓存 + comfyUrl 校验）
│  ├─ security.js               guard / safeJoin / resolveUserPath / 写令牌
│  ├─ static.js                 SPA + 静态文件（Range/ETag/301 补斜杠）
│  ├─ runtime.js                模块级单例（Host 服务挂载）
│  ├─ tools.js                  14 个 Agent 工具定义
│  ├─ config-reader.js          ★ 配置读取约定（configReader / 快照读扫描器）
│  ├─ api/                      REST 层（路由 + 薄 HTTP 工具，拆成 9 个文件）
│  │  ├─ index.js               路由分发（handleApi）+ executeBackend
│  │  ├─ http.js                body 解析 / sendJson / Range / multipart
│  │  ├─ shots.js               镜头卡 CRUD（listShots / upsertShot / writeShots）
│  │  ├─ prompt-compile.js      compilePrompt / deriveSubjectsFromShot
│  │  ├─ projects.js            项目摘要投影 / 可写字段白名单
│  │  ├─ monitor.js             /monitor 负载
│  │  ├─ replace-tasks.js       换人任务创建
│  │  ├─ archive.js             产物归档 / 字体 / 路径白名单
│  │  └─ events.js              SSE 事件总线
│  ├─ bridge/                   ★★ H3 桥接层（唯一知道「上游长什么样」的地方）
│  │  ├─ index.js               门面：业务层只 import 这里
│  │  ├─ README.md              职责边界 + 上游升级流程
│  │  ├─ vendors/nanfeng/       上游节点包镜像
│  │  │  ├─ schema.js           221 参数定义（机读约束）
│  │  │  ├─ param-docs.js       221 参数中文释义 + 有效性标记
│  │  │  ├─ graph.js            图组装 + 类型强制 + 能力探测
│  │  │  ├─ presets.js          7 预设 + 3 层合并 + Sigma 序列校验
│  │  │  ├─ index.js            buildShotWorkflow / CONSTRAINT_RULES
│  │  │  └─ continuation.js     续写批次编排 + 分段规划 + runBatch
│  │  ├─ prompt/                提示词通道（与参数通道正交）
│  │  │  ├─ h3-prompt.js        ★ 六段式编译器（2100+ 行，纯代码）
│  │  │  └─ prompt-normalizer.js 换人提示词规则化
│  │  └─ llm/                   DSH LLM 桥接
│  │     ├─ dsh-llm.js          文本 / 视觉调用（零凭据）
│  │     └─ storyboard.js       智能分镜（装配 skills/prompt/*）
│  ├─ services/                 业务服务层
│  │  ├─ ref-images.js          ★★ 参考图编号唯一实现（原 4 份合一）
│  │  ├─ generator.js           执行器（runH3Nanfeng / runH3Local）
│  │  ├─ comfy-client.js        ComfyUI 客户端（探测/上传/轮询/取消）
│  │  ├─ comfy-control.js       ComfyUI 进程启停
│  │  ├─ comfy-lifecycle.js     批次级拉起/释放
│  │  ├─ blender-service.js     Blender 子进程编排
│  │  ├─ character-vault.js     角色卡仓库
│  │  ├─ breakdown.js           立绘拆解：默认三视图提示词
│  │  ├─ render-plan.js         渲染计划（消费 ref-images 的结果）
│  │  ├─ shot-context.js        入参准备（REST 与工具共用）
│  │  ├─ job-runner.js          任务队列 + 并发闸门
│  │  ├─ job-store.js           jobs.json 串行集合
│  │  ├─ accel-plan.js          DMAD 加速方案
│  │  ├─ lora-catalog.js        LoRA 分类 / 互斥 / 衰减
│  │  ├─ media-probe.js         ffprobe 探测
│  │  ├─ edit.js / post.js      剪辑 / 后处理
│  │  ├─ replace.js / -runner   视频换人
│  │  ├─ h3-workshop.js         剧本 → 分段 + 成片
│  │  ├─ h3-image.js            H3-Image 出图
│  │  ├─ asset-service.js       素材库
│  │  ├─ extras.js              模板 / 服化道 / 导入 / 日志
│  │  ├─ canvas-agent.js        画布 17 工具 + 权限位
│  │  ├─ workflow-paths.js      工作流模板定位
│  │  ├─ ffmpeg-tools.js        ffmpeg 定位
│  │  └─ prompt-llm.js          本地翻译（被 bridge/prompt 调用）
│  ├─ store/                    数据模型与存储
│  │  ├─ json-store.js          原子写 + 串行队列 + .bak/.corrupt
│  │  └─ models.js              档位 / 节点 / 资产 / 槽位 / 镜头校验
│  └─ blender/                  render_shot.py / actions.py / list_actions.py
│
├─ app-src/                     ← ② SPA 源码
│  ├─ src/App.tsx               壳（顶栏 + 侧导航 + 路由出口）
│  ├─ src/router.tsx            hash 路由表（14 条）
│  ├─ src/pages/                15 个页面
│  ├─ src/canvas/               26 节点画布（最大模块）
│  ├─ src/components/           NanfengParams / AssetPicker / ContinuationPanel
│  ├─ src/api/                  REST 客户端 + SSE
│  └─ src/ui/                   设计系统（只用主题令牌）
├─ app-dist/                    ← 构建产物（入库）
├─ client.js                    ← DSH 侧栏入口（启动器 + 监测器）
│
├─ vendor/nanfeng/              ← ③ ComfyUI 节点（部署时复制进 custom_nodes）
│  ├─ *.py (10 个)
│  ├─ VENDOR.md                 改造记录
│  └─ _removed/                 已移除模块（历史参考，不加载）
│
├─ skills/                      ← Skill 根目录（唯一）
│  ├─ README.md                 体系说明
│  ├─ prompt/                   提示词规范（给 LLM 看）
│  │  ├─ h3-official/           官方六段式 + references/
│  │  ├─ h3-hailuo/             海螺版
│  │  ├─ h3-continuation/       一镜到底续写
│  │  ├─ h3-continuation-cuts/  可切镜续写
│  │  ├─ h3-character-replace/  人物替换（视频换人）
│  │  ├─ h3-nonfirst-i2v/       非首帧 I2V
│  │  ├─ group-master/          群友实战总纲
│  │  └─ jiuzhang-prompt-spec.md 本插件编译器规范
│  ├─ usage/                    操作手册
│  ├─ setup/                    部署手册
│  ├─ architecture/             本文（结构 + API + 安装）
│  └─ templates/                提示词模板（数据，可编辑）
│
│  ⚠️ prompt/ 是两层嵌套，DSH 内置发现（只扫一层）看不到它。
│     由 host/skills.js 注册自有 provider 来收录，共 11 个 skill。
│     改 SKILL.md 的 frontmatter 时 name 必须是 kebab-case，否则静默丢弃。
│
├─ data/                        ← 运行时数据（不在 git 里）
│  ├─ workflows/                h3.json / h3-image.json 模板
│  ├─ extras/                   用户自定义模板 / 服化道
│  ├─ projects/ shots/ vault/   项目 / 镜头 / 角色卡
│  ├─ assets/ outputs/ previz/  素材 / 产物 / 预演
│  ├─ runs/                     续写批次状态
│  └─ config.json               配置（运行时生成）
│
├─ tools/                       ← 开发工具
│  ├─ smoke-api.mjs             冒烟测试（207 项）
│  ├─ check-routes.mjs          三方路由一致性
│  ├─ audit-params.mjs          221 参数有效性审计
│  └─ preview-server.mjs        独立预览服务器
│
├─ docs/                        审查报告与方案
├─ cordis.patch.yml             DSH 加载补丁
├─ package.json                 插件清单（version 2.3.0）
└─ README.md / CHANGELOG.md
```

---

## 三、数据流

### 3.1 单镜生成（最常见路径）

```
渲染页填表单
  → POST /projects/:id/shots            保存镜头卡
  → POST /generate {projectId, shotId}
      → withVaultCards()                解析角色卡 → shot.characterCards
      → resolveRefImages()              算真实参考图顺序（含卡图）
      → compilePrompt(shot)             h3-prompt.js 编译六段式
          ├ routeFormat()               判定 ref / base
          ├ CONTINUATION_SWITCH         续写段顶部开关
          ├ STYLE_PRESETS + LIGHTING    画风 + 光比
          └ compileRef2VA()             六段正文
      → runH3Nanfeng()
          ├ planForShot(accelPlan)      DMAD → LoRA/sampler/steps
          ├ stageToComfyInput()         参考图上传到 ComfyUI input/
          ├ nanfeng.buildShotWorkflow() 221 参数快照 + 图组装
          │   ├ coerceTypes()            数值型 COMBO 转数字
          │   ├ applyFixes()             环境修正 + 能力探测
          │   ├ checkConstraints()       硬互斥校验
          │   └ sanitize()               选项合法性
          └ comfy.runWorkflow()         提交 + 轮询 + 归档
              → POST {comfy}/prompt
                  → NanFengH3MultiReferenceGeneratorV15
                      → GraphBuilder 展开 ~40 节点 → 出片
  → SSE shot-updated / job-progress      推回浏览器
```

### 3.2 续写批次（长视频）

```
POST /nanfeng/continuation/plan          targetSeconds → 每段请求秒数
POST /nanfeng/continuation/batches       建批次（记录 batchId/runId/folder）
POST /nanfeng/continuation/batches/run   服务端编排
  → continuation.runBatch()
      for seg in shots:                  严格串行（链式依赖）
        → taskFor(batch, index)          段 1 也带 index=1（Load 0/Save 1）
        → newJob + runAndArchive         真正执行
        → 轮询终态
        → 段 n 的 latent 存到 clip_n
  → SSE batch-progress                   实时进度
```

**关键约束**：
- 段 1 必须带 `index=1` 任务，否则 latent 不落盘、段 2 必然失败
- 段 2+ 的提示词顶部自动加续写开关
- 失败即停（后续段依赖前段 latent）

### 3.3 Blender 预演

```
POST /blender/render {mode, projectId, shotId}
  → buildSceneSpec()          镜头卡坐标（y=高度）→ Blender Z-up
  → renderControl()
      → spawn blender -b --python render_shot.py
          → 写 _running 哨兵 → 渲 PNG → pad 帧号 → 校验帧数 == spec.frames → 删哨兵
      → ffmpeg PNG 序列 → mp4
  → 前端 attachAsReference()  自动挂进 shot.refs.videos
```

---

## 四、REST API 全表

> 全部挂在 `/jiuzhang/api`。写方法（POST/PUT/PATCH/DELETE）需 `X-JZ-Token`
> （`GET /token` 拿，免 token）。跨源请求会被 `isSameOrigin()` 拒绝。
>
> **实测 105 条精确路径 + 5 条参数化 + 5 个前缀族**（下表的 `:id` 展开）。
> 本文与 `host/api/index.js` 逐条核对过（2026-11-18）；
> 前端调用与后端路由的一致性由 `pnpm run check:routes` 守护。

### 4.1 基础 / 元信息

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/token` | 写令牌 + origin（**本身免 token**）|
| GET | `/health` | 深度健康（ComfyUI / Blender / 加速方案 / 磁盘）|
| GET | `/monitor` | 任务 + 后端 + 磁盘监测（侧栏轮询用，**最坏 10s+**，客户端须去重）|
| GET | `/meta` | 档位 / 26 节点 / 15 资产类型 / H3 19 槽位 / 后端枚举 |
| GET | `/events` | SSE 长连接（参数变更、任务状态推给网页）|
| GET · POST | `/config` | 配置（读有掩码；写有白名单 + comfyUrl 校验）|
| GET | `/accel/plans` | 加速方案列表（dmad8 / dmad4 / none）|
| GET | `/workflows/diagnostics` | 工作流模板诊断（h3.json / h3-image.json 是否齐全）|
| GET | `/toolbox/health` | 工具箱自检（模板 / 服化道 / 日志 / 孤儿）|

### 4.2 项目 / 镜头 / 项目绑卡

| 方法 | 路径 | 用途 |
|---|---|---|
| GET · POST | `/projects` | 列表 / 新建 |
| GET · POST · DELETE | `/projects/:id` | 单项目 CRUD（DELETE 会连带清理 shots / vault / runs）|
| GET · POST | `/projects/:id/shots` | 镜头列表 / 保存（**部分保存语义**：只覆盖提交的字段）|
| GET · POST | `/projects/:id/cards` | 项目绑定的角色卡（GET 返回 `{projectId, cardIds, cards}`）|

> ⚠️ 镜头**没有** `DELETE /projects/:pid/shots/:sid`。删镜头走
> `studio_shot {action:'delete'}`（工具层），或保存时置空。前端若直接发
> DELETE 会拿到 `UNKNOWN_ROUTE`。

### 4.3 生成 / 任务

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/generate` | 提交生成（`{projectId, shotId, backend, seed, preset, params}`）|
| GET | `/jobs` | 任务列表（按 createdAt 倒序）|
| POST | `/jobs/:id/cancel` | 取消（**真发** `/interrupt` + 删队列项）|
| POST | `/jobs/:id/retry` | 重试 |
| GET | `/jobs/batch-progress` | 批量进度汇总 |
| POST | `/resolution` | 档位 + 比例 → 分辨率 |
| POST | `/h3/length` | 时长 → 帧数（`17k+5` 网格）|

### 4.4 南风 V15（核心）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/nanfeng/schema` | 221 参数 + 中文释义 + 无效标记 |
| GET | `/nanfeng/presets` | 预设 + Sigma 序列 + 加速方案 |
| GET | `/nanfeng/presets/:id` | 预设合并后的参数快照（**未经** applyFixes，见下方注）|
| POST | `/nanfeng/continuation/plan` | 分段规划（从目标时长反推每段帧数）|
| GET · POST | `/nanfeng/continuation/batches` | 列 / 建批次 |
| GET | `/nanfeng/continuation/batches/:id` | 单批次（含进度）|
| POST | `/nanfeng/continuation/batches/run` | **一键跑完整组**（后台串行，不 await）|
| POST | `/nanfeng/continuation/batches/reset` | 重置失败段 |
| POST | `/nanfeng/continuation/segment` | 更新单段状态（outputRel / frames）|
| GET | `/nanfeng/storyboard/meta` | 分镜 7 模式 + 2 skill + LLM 状态 |
| POST | `/nanfeng/storyboard/generate` | 智能分镜（DSH 内部 LLM，零 API Key）|

> ⚠️ `/nanfeng/presets/:id` 返回的是"预设合并值"，**未经** `applyFixes`
> 的环境修正（SageAttention / TRT 引擎名等）。它不等于实际提交值 ——
> 真实提交值看 `job.params.nanfengParams`。

### 4.5 渲染计划 / 提示词

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/render/plan` | 渲染计划（参考图编号 `<Picture N>` 的**权威来源**）|
| POST | `/render/compile` | 按计划编译提示词 |
| GET | `/prompt/meta` | 画风 11 种 + 打光 7 种 + 模式 + 硬约束 |
| POST | `/prompt/compile` | 完整输入包 → 提示词 |
| POST | `/prompt/from-shot` | 从镜头卡编译（**走角色卡**，与真实生成同一份入参）|
| POST | `/prompt/preview` | 只编译不落盘 |

### 4.6 角色卡 / 立绘拆解 / 图像

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/vault/meta` | 槽位定义（covers / sheets / origin）|
| GET · POST | `/vault/cards` | 卡列表 / 建卡 |
| GET | `/vault/cards/:id` | 单卡 |
| POST | `/vault/cards/delete` | 删卡 |
| GET | `/vault/plan` | 参考图预算规划（≤9 张约束）|
| GET | `/breakdown/meta` | 默认提示词 + 上限字符数 + 固定尺寸 |
| POST | `/breakdown/preview` | 回显提交用提示词（**不拼装**）|
| POST | `/breakdown/generate` | 出拆解图（**无参考图直接 400**；超长 400 `PROMPT_TOO_LONG`）|
| GET | `/image/meta` | H3-Image 模型状态 + 12 种尺寸 |
| POST | `/image/generate` | H3-Image 出图 |

### 4.7 Blender 预演

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/blender/health` | 引擎状态（exe / 通道 / 脚本是否存在）|
| GET | `/blender/assets` | 3D 资产库（glb / gltf / fbx / obj）|
| GET | `/blender/actions/catalog` | 内置动作目录（不启 Blender）|
| POST | `/blender/actions` | 读某模型的内置动作名（**会启一次 Blender**）|
| POST | `/blender/open` | 用桌面 Blender 打开 .blend |
| POST | `/blender/render` | 渲灰模参考视频（blockout / preview）|

### 4.8 素材 / 文件 / 后处理

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/assets` | 素材列表（可按 type / projectId 过滤）|
| GET | `/assets/item?id=` | 单条素材（支持 Range / HEAD）|
| POST | `/assets/upload` | 上传（multipart，图片/音频/视频/模型）|
| POST | `/assets/archive` | 把产物归档进素材库 |
| POST | `/assets/delete` | 删素材 |
| GET · HEAD | `/file?path=` | 读 dataDir 内文件（**子目录白名单**）|
| POST | `/post/transcode` | 转码（crf / 编码器）|
| POST | `/post/scale` | 缩放 |
| POST | `/post/crop` | 裁剪 |
| POST | `/post/split` | 切割分镜（rows × cols）|
| POST | `/post/annotate` | 文字标注（中文需 fontFile）|
| POST | `/post/extractFrame` | 抽帧 |
| POST | `/post/extractAudio` | 抽音轨 |
| POST | `/post/qc` | 质检（ffprobe 元信息 + 音轨检查）|
| GET | `/post/fonts` | 可用中文字体 |

> ⚠️ `qc` 的 REST 入参是 `{path}` 或 `{input}`，而 `studio_post` 工具是
> `{op:'qc', input}` —— 两处入参形状不同，工具层已单独处理。

### 4.9 剧本工坊 / 成片合成

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/h3/workshop/analyze` | 剧本 → 中性分段 + 资产提示词（**只产文本**）|
| POST | `/h3/workshop/import` | 把分析结果导入素材库 |
| GET | `/h3/film/status` | 成片合成进度 |
| POST | `/h3/film/render` | 多段拼接成片（`{inputs[], output, subtitleFile?}`）|

> ⚠️ `inputs` 里的路径走 `resolveUserPath`，**必须在 dataDir 之内**（绝对路径也受限）。

### 4.10 工具箱 / 资源 / 画布

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/templates` | 提示词模板（20 条，来自 `skills/templates/templates.json`）|
| POST | `/templates/upsert` · `/templates/delete` | 增改 / 删模板 |
| GET | `/wardrobe` | 服化道条目 |
| POST | `/wardrobe/upsert` · `/wardrobe/delete` · `/wardrobe/resolve` | 增改 / 删 / 解析引用 |
| GET | `/motionshots` | 动态镜头条目 |
| POST | `/motionshots/upsert` · `/motionshots/delete` | 增改 / 删 |
| GET · POST | `/logs` | 运行日志（读 / 追加）|
| GET | `/resources/orphans` | 孤儿产物扫描（不在任何引用的文件）|
| GET | `/resources/previz` | 预演产物占用 |
| POST | `/resources/clean` | 清理孤儿 |
| POST | `/resources/previz/clean` | 清理预演产物 |
| POST | `/import/scan` | 扫描分镜目录（批量导入）|
| POST | `/import/preview` | 导入预览（不落盘）|
| GET | `/canvas-agent/meta` | 画布 Agent 17 工具 + 4 权限位 |
| POST | `/canvas-agent/exec` | 执行画布 Agent 动作 |

### 4.11 视频剪辑

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/edit/clips` | 可剪辑素材（outputs / assets / edit/outputs）|
| POST | `/edit/probe` | 探测时长 / 分辨率 / 帧率 / 音轨 |
| POST | `/edit/trim` | 裁切（输入端粗 seek + 输出端精 trim）|
| POST | `/edit/concat` | 拼接（形状一致走流复制，否则滤镜重编码；可带 xfade 转场）|
| POST | `/edit/audio` | 音轨：`strip` / `volume` / `bgm`（可替换或混音，带淡入淡出）|
| POST | `/edit/render` | 按工程出片（逐段裁切 → 拼接 → 应用音轨）|
| GET · POST | `/edit/projects` | 工程列表 / 保存 |
| GET · POST · DELETE | `/edit/projects/:id` | 单工程 CRUD |

> 编辑模型是**有序片段列表**，不是多轨时间轴 —— 理由见 `host/services/edit.js` 文件头。
> 产物写 `data/edit/outputs/`，工程写 `data/edit/*.json`；
> `edit` 已在 `/file` 的 `SERVABLE_DATA_DIRS` 白名单里（内联播放依赖它）。

### 4.12 已删除的路由（不存在，别照旧文档调用）

`/script/*`、`/comic/*`、`/mw/*` 共 30+ 条已在 2.0.0 随页面删除。
剧本类需求改用 `/h3/workshop/*`（只产文本）。

---

## 五、14 个 Agent 工具

| 工具 | 作用 | 关键限制 |
|---|---|---|
| `studio_meta` | 元信息（221 参数 / 12 组 / 7 预设 / 26 节点）| — |
| `studio_config` | 读/写配置 | 写有 16 键白名单 |
| `studio_project` | 项目 CRUD | — |
| `studio_shot` | 镜头卡 CRUD | `list/create/save/delete`（**删镜头走这里**，没有 REST DELETE）|
| `studio_prompt` | 提示词编译（meta/compile/fromShot）| `fromShot` 与 REST 共用同一份入参（含角色卡）|
| `studio_generate` | 触发生成 | 异步，立即返回 job |
| `studio_jobs` | 任务查询/取消/重试 | `retry` 与 REST 同语义（cancel 会真发 `/interrupt`）|
| `studio_h3_workshop` | 剧本 → 分段 + 资产 | **只产文本**，不出图 |
| `studio_blender` | Blender 预演 | `render` 会启子进程（~21s）|
| `studio_post` | 图像/视频后处理 | `qc` 的入参形状与 REST 不同 |
| `studio_edit` | 视频剪辑：probe/trim/concat/audio/render/clips/projects | 音轨子操作走 `audioOp`（顶层 `op` 已被占用）|
| `studio_toolbox` | 模板/服化道/清理/日志 | `batchProgress` 只支持 `list` |
| `studio_image` | H3-Image 出图 | 无负面提示词 |
| `studio_storyboard` | 智能分镜 | 走 DSH 内部 LLM，零凭据 |

---

## 六、安装与依赖

### 6.1 三步走

```
① 装插件（DSH profile）
   cd %USERPROFILE%\.dsh\profiles\desktop
   package.json dependencies 里加：
     "@local/dsh-jiuzhang-studio": "link:<本仓库路径>"
   重启 DSH，左侧栏出现「九章工作室」

② 装 ComfyUI + 模型
   见 skills/setup（模型清单、显存档位、常见错误）

③ 装 vendor 节点（**必做，否则 h3-nanfeng 后端不可用**）
   pwsh -File vendor/nanfeng/deploy-vendor.ps1 -ComfyDir "<工作区>\ai-runtime\ComfyUI"
   （脚本只复制 .py + dlss_schema.json，跳过 _removed/；目标已存在时拒绝覆盖，加 -Force）
   详见 skills/setup 的 §2.5 与 vendor/README.md
```

### 6.2 第三方节点依赖

| 节点包 | 用途 | 必需 |
|---|---|---|
| `ComfyUI-KJNodes` | 采样辅助 / Sage patch | ✅ |
| `ComfyUI-H3-Motion-Context` | **续写 latent 读写** | ✅ 续写必需 |
| `ComfyUI-H3-AudioRefine` | 续写音频精修 | 可选 |
| `ComfyUI-VideoHelperSuite` | 输出 mp4 | ✅ |
| `Comfyui_Minimax_h3_latent_Upscaler` | 潜空间二采 | ✅ |

> ⚠️ `latent_Upscaler` 上游 HEAD 已改名并删掉 `H3LatentUpscalerNodeMegapixels`，
> 必须用部署脚本还原的历史版本。

### 6.3 版本锁定

| 组件 | 版本 | 为什么锁 |
|---|---|---|
| ComfyUI | 0.45.0 | 南风 GraphBuilder 依赖内部结构 |
| Blender | 5.2.4 LTS | 脚本用的 bpy API 在 5.x 验证过 |
| DSH | 当前 | 插件用 Cordis 服务 |

---

## 七、「改哪里改什么」定位表

| 想改… | 动这里 |
|---|---|
| 参数默认值 / 选项 | `host/bridge/vendors/nanfeng/schema.js` |
| 参数中文说明 | `host/bridge/vendors/nanfeng/param-docs.js` |
| 预设档位 | `host/bridge/vendors/nanfeng/presets.js` |
| 图组装 / 环境修正 | `host/bridge/vendors/nanfeng/graph.js` |
| 硬互斥约束 | `host/bridge/vendors/nanfeng/index.js` 的 `CONSTRAINT_RULES` |
| 续写批次逻辑 | `host/bridge/vendors/nanfeng/continuation.js` |
| 提示词格式 / 画风 / 打光 | `host/bridge/prompt/h3-prompt.js` |
| 换人提示词规则化 | `host/bridge/prompt/prompt-normalizer.js` |
| 桥接层对外契约（**改上游先改这里**）| `host/bridge/index.js` |
| 参考图编号 / 上限 9 张 | `host/services/ref-images.js` |
| 配置读取约定 / 分裂脑扫描 | `host/config-reader.js` |
| 原子写 / .bak / 队列 | `host/store/json-store.js` |
| 单任务查询 / 列表投影 | `host/api/index.js` 的 `/jobs/:id` 与 `?fields=list` |
| 智能分镜的 LLM 提示词 | `skills/prompt/h3-*/SKILL.md` |
| 生成执行器 | `host/services/generator.js` |
| ComfyUI 通信 | `host/services/comfy-client.js` |
| 剪辑（裁切/拼接/音轨）| `host/services/edit.js` |
| 剪辑页 UI | `app-src/src/pages/EditPage.tsx` + `app-src/src/api/edit.ts` |
| Blender 脚本 | `host/blender/render_shot.py` |
| REST 路由 | `host/api/index.js` |
| Agent 工具 | `host/tools.js` |
| 前端页面 | `app-src/src/pages/*.tsx` |
| 画布节点 | `app-src/src/canvas/nodeRegistry.ts` + `nodes/*.tsx` |
| 侧栏入口 | `client.js` |
| 提示词模板 | `skills/templates/templates.json` |

---

## 八、开发与验证

```powershell
npm run build          # 构建 SPA（tsc --noEmit && vite build）
npm test               # 冒烟测试（207 项真执行，含 19 项架构守卫）
# ↑ 架构守卫守的是「结构性约束」：桥接层边界 / 参考图编号唯一实现 /
#   配置无快照读 / json-store 不删目标 / 前端 fetch 超时 / 相对 import 可解析。
#   这些不是在测功能，是在防「以后又不小心退回旧形态」。
npm run typecheck      # 仅类型检查
npm run check:routes   # SPA/NAV/client 三方路由一致性
node tools/verify-edit.mjs   # 剪辑功能验收（需 DSH 已重启并加载新路由）
npm run audit:params   # 221 参数有效性审计
npm run preview        # 独立预览服务器（不启动 DSH）
```

### ⚠️ 改动后必须做的五件事

1. `node --check` —— 只查语法，**必要但不充分**
2. **模拟 ctx 跑 `apply()`** —— `npm test` 会做，能抓未定义变量
3. 重启 DSH 后看 `plugin_manager list_plugins` 的 `fiberPhase` 是否 `active`
4. 调一个真实工具 —— 能抓运行时字段丢失
5. 改 `inject` 后**必须重启 DSH**（HMR 不会重新解析 inject）

---

## 九、已知限制

| # | 限制 | 原因 |
|---|---|---|
| 1 | 221 参数中 47 个是死参数 | 上游硬编码关闭（见 docs/PARAM-AUDIT.md §十）|
| 2 | 48 个参数缺依赖 + 47 个死参数 = 95 个无效 | 本机没装 DLSS/TRT/SLA 节点；其余是上游关闭 |
| 3 | DMAD 的 shift 12/2 设不了 | `sigma_requested=False` 硬编码，模型自带 12/3 |
| 4 | ComfyUI 版本锁 0.45.0 | GraphBuilder 依赖内部结构 |
| 5 | 主 mp4 无音轨 | VHS 设计，完整版在 `-audio.mp4` |
| 6 | 续写段会短 0.92s | context_length=22 帧的裁切 |