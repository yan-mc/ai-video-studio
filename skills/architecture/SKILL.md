---
name: jiuzhang-studio-architecture
description: 九章工作室插件的架构与代码地图。当需要理解插件怎么跑起来、排查"某个功能在哪实现"、加新功能、改 REST 路由/Agent 工具/提示词编译器/图像子系统，或部署到新机器时使用。涵盖四层架构（DSH Host / SPA / 南风桥接 / ComfyUI+Blender）、按域拆分的路由表、50+ 服务的职责边界、数据目录结构，以及"改哪里改什么"定位表。
---

# 九章工作室 · 架构与代码地图

> 本文回答三个问题：**它由什么组成**、**数据怎么流动**、**改东西该动哪个文件**。
> 操作细节见 `jiuzhang-studio-usage`；部署见 `jiuzhang-studio-setup`；
> 提示词写法见 `jiuzhang-studio-prompt`。

---

## 一、四层架构

```
① DSH Host（Node ESM）
     host/index.js        apply()：注册路由 / 14 工具 / skill provider / 启动编排
     host/api/            REST 分发器 + 11 个域 router
     host/bridge/         ★ 唯一知道「上游 ComfyUI 节点长什么样」的层
     host/services/       业务服务（37 文件）
     host/store/          模型与原子持久化
② Web SPA（React 18 + TS）→ 构建到 app-dist/
③ ComfyUI 0.45.0 + vendor/nanfeng（221 参数巨型节点）+ vendor/inpaint-nodes
④ Blender 5.2.4 灰模预演（子进程） + ffmpeg 后处理/剪辑
```

---

## 二、三条数据链（互不相干）

| 链 | 入口 | 关键路径 |
|---|---|---|
| **A 单镜生成** | `POST /generate` · `studio_generate` | shot-context → ref-images → 提示词编译 → accel-plan → `nanfeng.buildShotWorkflow` → comfy-client |
| **B 续写批次** | `POST /nanfeng/continuation/batches/run` | `continuation.runBatch` → 串行 job → latent 落盘 → 段 n+1 |
| **C 图像** | `POST /image/generate` · `POST /image/inpaint` | h3-image / h3-inpaint → comfy-client → 归档 |

三条链**共用** `comfy-client` / `job-runner` / `job-store` / `ref-images` / `asset-service`，
但各自持有独立的 shot 副本，不存在跨链改写。

---

## 三、目录布局

```
dsh-jiuzhang-studio/
├─ host/
│  ├─ index.js              插件入口（apply 编排）
│  ├─ config.js             配置（白名单 / 缓存 / comfyUrl SSRF 校验）
│  ├─ config-reader.js      ★ 配置读取约定（服务层禁止闭包快照）
│  ├─ security.js           三道闸：本机 / 同源 / 写令牌；safeJoin / resolveUserPath
│  ├─ static.js             SPA 与静态文件（Range / ETag / SVG 强制下载 / nosniff）
│  ├─ runtime.js            模块级单例（Host 服务挂载）
│  ├─ skills.js             ★ 自有 skill provider（绕开 DSH 单层扫描）
│  ├─ tools.js              14 个 studio_* Agent 工具
│  ├─ api/
│  │  ├─ index.js           84 行分发器：URL 解析 → guard → 问各 router → 错误映射
│  │  ├─ errors.js          128 个错误码 → HTTP 状态
│  │  ├─ backend.js         后端枚举 + executeBackend 分流
│  │  ├─ image-task.js      出图/重绘的提交编排（REST 与工具共用）
│  │  ├─ http.js / shots.js / prompt-compile.js / projects.js
│  │  ├─ monitor.js / replace-tasks.js / archive.js / events.js
│  │  └─ routes/            11 个域模块（见 §四）
│  ├─ bridge/               ★★ 上游契约层（见 §五）
│  ├─ services/             业务服务（见 §六）
│  ├─ store/                json-store.js（原子写）/ models.js / mode-aliases.js
│  ├─ blender/              render_shot.py / actions.py / list_actions.py / dump_catalog.py
│  └─ python/               translate_server.py（本地翻译子进程）
│
├─ app-src/src/             SPA 源码
│  ├─ App.tsx / router.tsx  壳与 14 条 hash 路由
│  ├─ pages/                15 个页面
│  ├─ canvas/               26 节点画布（最大前端模块）
│  ├─ components/           NanfengParams / AssetPicker / ContinuationPanel /
│  │                        LoraPicker / ImageLoraPicker / InpaintPanel / MaskEditor
│  ├─ api/                  REST 客户端 + SSE
│  ├─ lib/brush.ts          画笔内核（Catmull-Rom 样条 + 间距重采样）
│  └─ ui/                   设计系统（只用主题令牌）
├─ app-dist/                构建产物（随插件分发，不入 .gitignore）
├─ client.js                DSH 侧栏入口（启动器 + 监测器）
│
├─ vendor/nanfeng/          ComfyUI 节点（部署时复制进 custom_nodes）
├─ vendor/inpaint-nodes/    局部重绘 crop&stitch 节点（GPL-3.0，独立进程）
│
├─ skills/                  ★ 唯一 skill 根目录
│  ├─ prompt/               提示词规范（两层嵌套，由 host/skills.js 注册）
│  ├─ usage/ setup/ architecture/
│  └─ templates/templates.json
├─ data/                    运行时数据（不入库）
│  ├─ workflows/            h3.json / h3-image.json（随插件分发的模板）
│  ├─ projects/ shots/ vault/ assets/ outputs/ previz/ runs/ replace/ edit/ post/
│  └─ config.json           配置（运行时生成）
├─ docs/                    设计说明与机制文档
├─ cordis.patch.yml
└─ package.json             version 4.0.0
```

---

## 四、REST 层：按域拆分的 11 个 router

`host/api/index.js` 只做四件事（84 行）：URL 解析 → `guard()` → 依次询问各 router →
统一错误映射。**业务逻辑一律不在分发器里。**

| 文件 | 管什么 |
|---|---|
| `routes/meta.js` | `/token` `/health` `/monitor` `/meta` `/config` `/events` `/comfy/*` `/accel/plans` `/workflows/diagnostics` `/lora/catalog` `/lora/solve` |
| `routes/nanfeng.js` | `/nanfeng/schema` `/nanfeng/presets*` `/nanfeng/continuation/*` `/nanfeng/storyboard/*` |
| `routes/generate.js` | `/generate` `/jobs` `/jobs/:id` `/jobs/:id/cancel` `/jobs/:id/retry` `/resolution` `/h3/length` `/jobs/batch-progress` |
| `routes/projects.js` | `/projects` `/projects/:id` `/projects/:id/shots` `/projects/:id/cards` |
| `routes/prompt.js` | `/render/plan` `/render/compile` `/prompt/meta` `/prompt/compile` `/prompt/from-shot` `/prompt/preview` |
| `routes/image.js` | `/image/meta` `/image/lora/*` `/image/generate` `/image/inpaint` `/image/inpaint/meta` `/image/progress` `/breakdown/*` |
| `routes/vault.js` | `/vault/meta` `/vault/cards*` `/vault/plan` `/assets/archive` |
| `routes/media.js` | `/assets*` `/file` `/post/*` `/edit/*` |
| `routes/blender.js` | `/blender/health` `/assets` `/actions/catalog` `/actions` `/open` `/render` |
| `routes/replace.js` | `/replace/meta` `/prompt-template` `/preview-prompt` `/compile-prompt` `/llm-status` `/plan` `/tasks*` `/run/*` |
| `routes/toolbox.js` | `/templates*` `/wardrobe*` `/motionshots*` `/logs` `/resources/*` `/import/*` `/toolbox/health` `/canvas-agent/*` `/h3/workshop/*` `/h3/film/*` |

**router 契约**：`handle*(req, res, R) → 处理了返回 undefined/true；没处理返回 false`。
分发器按 `ROUTERS` 数组顺序询问，顺序即匹配优先级（精确路径必须先于参数化路径）。

**错误映射**：service 抛带 `code` 的 Error → `errors.js` 的 `statusForError()` 决定状态码。
128 个码全覆盖，未登记的码回落 500。

---

## 五、桥接层（唯一知道上游长什么样）

**硬约束：业务层只能 `import` `host/bridge/index.js`。** 深路径一律禁止。

```
bridge/
├─ index.js                  对外唯一门面（业务层只 import 这里）
├─ vendors/nanfeng/          上游节点包镜像
│  ├─ schema.js              221 参数机读定义
│  ├─ param-docs.js          221 参数中文释义 + flag（dead/banned/advanced）
│  ├─ graph.js               类型强制 / sanitize / applyFixes / 能力探测 / 图组装
│  ├─ presets.js             7 内置预设 + 3 层合并 + Sigma 序列校验
│  ├─ index.js               buildShotWorkflow / buildShotOverrides / CONSTRAINT_RULES
│  └─ continuation.js        续写：网格吸附 / 分段规划 / 批次状态机 / 租约 / 串行编排
├─ prompt/                   提示词通道（与参数通道正交）
│  ├─ h3-prompt.js           门面 + 编译入口（compileH3Prompt / toShotInputPackage）
│  ├─ spec.js                官方枚举 / 硬上限 / 机制句 / 续写上下文判定
│  ├─ styles.js              画风库（11）+ 打光库（7）+ 冲突检测
│  ├─ route.js               模式 → 格式 的唯一路由器
│  ├─ base.js                基础格式（三字段 + 对齐指令）
│  ├─ ref2va.js              六段式正文 + 参考绑定
│  ├─ lint.js                反模式落位 / 结构自查 / 按字段截断
│  ├─ text-utils.js          帧数 / 时间戳 / 运镜 / 说话人 / 镜头归一（纯函数）
│  ├─ shot-adapter.js        镜头卡 → 编译器输入包（业务语义 + 编号权威覆盖）
│  └─ prompt-normalizer.js   换人提示词规则化（翻译由调用方注入）
└─ llm/
   ├─ dsh-llm.js             DSH llm / attachments / agentDefaultModel 桥接
   └─ storyboard.js          智能分镜：SKILL.md 装配 + 7 模式契约 + 解析
```

**依赖方向不可逆**：`api/tools/services → bridge → store`（只读常量）。
`bridge/` 不允许 import `host/services/` 或 `host/api/`；需要业务能力时由调用方注入。

### 参数通道的三道校验（顺序不可交换）

1. `coerceTypes` —— 类型强制（数值型 COMBO 必须是数字）
2. `sanitize(explicitKeys)` —— COMBO 合法性，**显式传入的非法值直接报错**，
   绝不回退成上游默认值（`SageAttention: 'foo'` 回退成 `'auto'` 正是本机必崩值）
3. `applyFixes` —— 环境修正（SageAttention / TRT 引擎名 / 可选加速）

修正结果会在组图时**再校验一次**。

### 参考图编号的单一真源

`<Picture N>` 编号**只能**来自 `services/ref-images.js:planImageSlots`
（首尾帧占槽：i2va 占 图片1；fl2va 占 图片1、图片2 → 编号 ≠ 数组下标）。

`compileH3Prompt(pkg)` 接受 `pkg.pictureIndexMap`：传了就以它为准，镜头卡里残留的
`subjects[].pictureIndex` 被丢弃且**每处丢弃都写 warnings**；没传则按下标兜底并告警。

---

## 六、业务服务层（37 个文件）

### 6.1 生成执行链

| 文件 | 职责 |
|---|---|
| `generator.js` | `runH3Nanfeng` / `runH3Local` / `runH3ImageLocal`（三条执行器） |
| `comfy-client.js` | 探测 / 上传 / 轮询 / 取消 / `queueStatus` / `runWorkflow` |
| `comfy-control.js` | ComfyUI 进程启停 / 彻底重启（含 `startedByUs` 归属判定） |
| `comfy-lifecycle.js` | 批次级拉起 / 释放 |
| `accel-plan.js` | DMAD 加速方案（dmad8 / dmad4 / none） |
| `lora-catalog.js` | 视频 LoRA 分类 / 互斥 / 衰减 |
| `job-runner.js` | 任务队列 + 并发闸门 + `recoverInterruptedJobs` |
| `job-store.js` | `jobs.json` 串行集合 |
| `ref-images.js` | ★ 参考图编号**唯一实现**（`planImageSlots`） |
| `shot-context.js` | 入参准备（`withVaultCards` / `resolvePictureIndices` / 媒体探测） |
| `render-plan.js` | 渲染计划（消费 ref-images 的结果） |
| `media-probe.js` | ffprobe 探测 |
| `workflow-paths.js` | 工作流模板定位（随插件分发，不跟随 dataDir） |
| `ffmpeg-tools.js` | ffmpeg 定位 |

### 6.2 图像子系统（v4 拆成 8 个文件）

| 文件 | 职责 |
|---|---|
| `h3-image.js` | 普通出图：尺寸表 / 模型探测 / 显存闸 / 参数校验 |
| `h3-image-lora.js` | 图像 LoRA 分类 + 约束求解（单选 / 衰减 / 过曝看门狗 / 画风×角色冲突） |
| `h3-inpaint.js` | 局部重绘**门面 + 入参校验**（常量/数学/组图/执行已拆分） |
| `inpaint-params.js` | 常量 + 纯数学（auto 分辨率 / 羽化 / 笔画宽度 / 画布推算） |
| `inpaint-graph.js` | 重绘节点图组装（crop / full 两条分支） |
| `inpaint-run.js` | 重绘执行 + 能力探测 + meta |
| `inpaint-task.js` | 任务编排（校验→解析→尺寸核对→建 job），**REST 与工具唯一共用** |
| `image-dims.js` | 只读图片头取尺寸 + 从 mask 量真实 bbox（纯 zlib 解 PNG） |

### 6.3 其它

| 文件 | 职责 |
|---|---|
| `character-vault.js` | 角色卡仓库 |
| `breakdown.js` | 立绘拆解（默认三视图提示词） |
| `asset-service.js` | 素材库 |
| `replace.js` / `replace-runner.js` / `shot-splitter.js` | 视频换人 |
| `edit.js` / `post.js` | 剪辑 / 后处理 |
| `blender-service.js` | Blender 子进程编排 |
| `h3-workshop.js` | 剧本 → 分段（只产文本） |
| `extras.js` | 模板 / 服化道 / 导入 / 日志 |
| `canvas-agent.js` | 画布 17 工具 + 4 权限位 |
| `prompt-llm.js` | 本地 7B 翻译（子进程，脚本在 `host/python/`） |
| `h3-graph.js` | `h3-local` 原生模板组图（画布「AI 视频」节点在用） |
| `mock-backend.js` | 占位后端（ffmpeg 色卡） |

---

## 七、「改哪里改什么」

| 想改… | 动这里 |
|---|---|
| REST 路由 | `host/api/routes/<域>.js`（新域则在 `index.js` 的 `ROUTERS` 里注册） |
| 错误码 → 状态码 | `host/api/errors.js` |
| Agent 工具 | `host/tools.js` |
| 参数默认值 / 选项 | `host/bridge/vendors/nanfeng/schema.js` |
| 参数中文说明 | `host/bridge/vendors/nanfeng/param-docs.js` |
| 预设档位 | `host/bridge/vendors/nanfeng/presets.js` |
| 图组装 / 环境修正 | `host/bridge/vendors/nanfeng/graph.js` |
| 硬互斥约束 | `host/bridge/vendors/nanfeng/index.js` 的 `CONSTRAINT_RULES` |
| 续写批次逻辑 | `host/bridge/vendors/nanfeng/continuation.js` |
| 提示词格式 / 画风 / 打光 | `bridge/prompt/{spec,styles,ref2va,base}.js` |
| 提示词 lint / 截断 | `bridge/prompt/lint.js` |
| 桥接层对外契约 | `host/bridge/index.js`（**改上游先改这里**） |
| 参考图编号 / 上限 9 张 | `services/ref-images.js`（`MAX_REF_IMAGES`） |
| 图像参考图上限 16 张 | `services/ref-images.js`（`MAX_IMAGE_EDIT_REFS`） |
| 图像尺寸表 / 32 倍数自检 | `services/h3-image.js`（`IMAGE_SIZES` / `assertImageSizes`） |
| 重绘分辨率 / 羽化 / 笔画宽度 | `services/inpaint-params.js` |
| 重绘节点图 | `services/inpaint-graph.js` |
| 重绘编排（两个入口共用） | `services/inpaint-task.js` |
| crop&stitch 节点（Python） | `vendor/inpaint-nodes/__init__.py` |
| 出图进度（队列三态） | `services/comfy-client.js` 的 `queueStatus` / `runWorkflow({onProgress})` |
| 配置读取约定 | `host/config-reader.js` |
| 原子写 / .bak / 队列 | `host/store/json-store.js` |
| 生成执行器 | `services/generator.js` |
| ComfyUI 通信 | `services/comfy-client.js` |
| 剪辑 | `services/edit.js` + `app-src/src/pages/EditPage.tsx` + `api/edit.ts` |
| Blender 脚本 | `host/blender/render_shot.py` |
| 前端页面 | `app-src/src/pages/*.tsx` |
| 画布节点 | `app-src/src/canvas/nodeRegistry.ts` + `nodes/*.tsx` |
| 侧栏入口 | `client.js` |
| 提示词模板 | `skills/templates/templates.json` |
| 图像页 UI / LoRA 面板 / 重绘面板 | `pages/ImagePage.tsx` + `components/{ImageLoraPicker,InpaintPanel,MaskEditor}.tsx` |

---

## 八、数据目录

```
data/
├─ workflows/      h3.json / h3-image.json（模板，随插件分发）
├─ config.json     配置（运行时生成，白名单可写）
├─ projects.json   项目列表
├─ shots/<pid>/shots.json   镜头卡（按项目分目录）
├─ vault/          角色卡
├─ assets/         素材库 + assets-index.json
├─ outputs/        生成产物
├─ previz/         Blender 预演产物
├─ runs/           续写批次状态
├─ replace/        换人任务与分段
├─ edit/           剪辑工程与产物
├─ post/           后处理产物
└─ tmp-inline/     dataURL 落盘（重绘 mask 等）
```

`data/` 下**只有 `workflows/` 入库**，其余全部 `.gitignore`。

---

## 九、开发与验证

```powershell
npm run build        # 构建 SPA（vite build）
npm run typecheck    # 仅类型检查
```

v4 起已移除全部冒烟/路由/审计测试脚本。改完代码后按五步人工验证：

1. `node --check` 每个改动文件 —— 只查语法，**必要但不充分**
2. 起最小 ctx 模拟跑 `apply()` —— 能抓未定义变量
   （漏一个 import 就让整个插件 fiber failed，所有页面与工具同时 404）
3. 重启 DSH 后确认 `plugin_manager list_plugins` 的 `fiberPhase` 是 `active`
4. 调一个真实工具 —— 能抓运行时字段丢失
5. 改 `inject` 后**必须重启 DSH**（HMR 不会重新解析 inject）

### skill 自查

```powershell
node -e "import('./host/skills.js').then(m=>{const l=m.discoverSkills(process.cwd(),console.warn);console.log(l.length,l.map(x=>x.name))})"
```

预期 11 个。`name` 必须是 kebab-case（只允许 `a-z0-9-`），否则被**静默丢弃**。

---

## 十、已知限制

| # | 限制 | 原因 |
|---|---|---|
| 1 | 221 参数中 43 个是 dead | 上游 `h3_generator.py` 硬编码关闭 |
| 2 | DMAD 的 shift 12/2 设不了 | 上游 `sigma_requested=False` 硬编码，模型自带 12/3 |
| 3 | ComfyUI 锁 0.45.0 | 南风 GraphBuilder 依赖内部结构 |
| 4 | 主 mp4 无音轨 | VHS 节点设计，完整音轨在 `-audio.mp4` |
| 5 | 续写段短 0.92s | `context_length=22` 帧的裁切 |
| 6 | 重绘极小选区（<40px）改动弱 | 选区占采样像素太少，属模型特性 |
| 7 | 重绘结果严格局限于 mask 内 | masked inpaint 的固有语义（这正是它选区外逐像素保真的原因） |