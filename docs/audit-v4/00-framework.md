# 九章工作室 · v4 全量审计 —— 第一层：整体框架

> 审计对象：`F:\AI视频\dsh-jiuzhang-studio`（v3.3.0，工作区有未提交改动）
> 审计时间：2026-11-26
> 本文只定**骨架与边界**。每个模块的代码级审查见 `10-*.md` … `60-*.md`。

---

## 一、运行时四层（谁调谁）

```
① DSH Host 进程 (Node ESM)
     host/index.js          apply()：注册路由 / 工具 / skill provider / 启动编排
     host/api/index.js      2819 行路由分发器（106 精确 + 5 参数化 + 2 前缀族）
     host/tools.js          14 个 studio_* Agent 工具
     host/bridge/**         唯一知道「上游 ComfyUI 节点长什么样」的层
     host/services/**       业务服务（46 个文件）
     host/store/**          模型与持久化

② Web SPA (React 18 + TS，构建到 app-dist/)
     app-src/src/pages/     15 个页面
     app-src/src/canvas/    26 节点画布（最大模块）
     app-src/src/api/       REST 客户端 + SSE
     app-src/src/ui/        设计系统

③ ComfyUI 0.45.0 + vendor/nanfeng（221 参数巨型节点）
   + vendor/inpaint-nodes（局部重绘专用，新加入）

④ Blender 5.2.4（灰模预演，子进程）
   + ffmpeg（后处理 / 剪辑，子进程）
```

**数据流三条主链**（互相独立，审计时必须分开看）：

| 链 | 入口 | 关键路径 |
|---|---|---|
| A 单镜生成 | `POST /generate` / `studio_generate` | shot-context → ref-images → h3-prompt 编译 → accel-plan → nanfeng buildShotWorkflow → comfy-client |
| B 续写批次 | `POST /nanfeng/continuation/batches/run` | continuation.runBatch → 串行 job → latent 落盘 → 段 n+1 |
| C 图像 | `POST /image/generate` / `POST /image/inpaint` | h3-image / h3-inpaint → comfy-client → 归档 |

三条链**共用**：`comfy-client`、`job-runner`、`job-store`、`ref-images`、`asset-service`。
这是当前最大的耦合面，也是本层要盯的重点。

---

## 二、模块清单（M1–M14）

编号即审计单元。每个单元有一个审查员，产出一份 `docs/audit-v4/NN-*.md`。

### M1 · 插件外壳与配置
- `package.json` / `cordis.patch.yml` / `client.js`（DSH 侧栏启动器 + 监测器）
- `host/index.js`（apply 编排）/ `host/runtime.js`（模块级单例）
- `host/config.js`（白名单 + 缓存 + comfyUrl 校验）/ `host/config-reader.js`
- `host/security.js`（guard / safeJoin / 写令牌）/ `host/static.js`（SPA 静态）
- `host/skills.js`（自有 skill provider，绕开 DSH 单层扫描限制）
- `locale/*.json`
- **边界**：配置从 `getCfg: loadConfig` 现取，服务不得捕获快照。

### M2 · REST 层
- `host/api/index.js`（2819 行，分发器本体）
- `host/api/http.js` / `shots.js` / `prompt-compile.js` / `projects.js`
  / `monitor.js` / `replace-tasks.js` / `archive.js` / `events.js`
- **边界**：只做 HTTP 协议与入参校验，不含业务逻辑；路由表 ↔ SPA ↔ client.js 三方一致。
- **风险点**：index.js 单文件承载全部 handler，是「管线混在一起」的主要位置。

### M3 · Agent 工具层
- `host/tools.js`（1239 行，14 个工具）
- **边界**：工具只做参数整形，执行走 service；与 REST 共用同一份入参准备。
- **风险点**：工具与 REST 双入口的语义偏差（qc 入参形状、retry 语义）。

### M4 · 桥接层（上游契约）
- `host/bridge/index.js`（门面，唯一对外出口）
- `host/bridge/vendors/nanfeng/`：`schema.js`(221 参数) / `param-docs.js`
  / `graph.js`(图组装+环境修正) / `presets.js`(7 预设) / `index.js`(CONSTRAINT_RULES)
  / `continuation.js`(续写编排)
- `host/bridge/prompt/h3-prompt.js`（2021 行，六段式编译器）+ `prompt-normalizer.js`
- `host/bridge/llm/dsh-llm.js` + `storyboard.js`
- **边界**：业务层只 import `bridge/index.js`；上游升级只改这一层。
- **风险点**：h3-prompt.js 2000+ 行纯代码编译器，是第二大单体。

### M5 · 生成执行链
- `services/generator.js`（runH3Nanfeng / runH3Local / runH3ImageLocal）
- `services/comfy-client.js`（探测/上传/轮询/取消/queueStatus）
- `services/comfy-control.js`（进程启停/重启）
- `services/comfy-lifecycle.js`（批次级拉起释放）
- `services/accel-plan.js`（DMAD）/ `services/lora-catalog.js`
- `services/ref-images.js`（参考图编号唯一实现）
- `services/shot-context.js` / `services/render-plan.js`
- `services/job-runner.js` / `services/job-store.js`
- `services/media-probe.js` / `workflow-paths.js` / `ffmpeg-tools.js` / `mock-backend.js`
- **边界**：三条链（A/B/C）在此汇合，必须确认没有「谁改了谁的 shot」。

### M6 · 图像子系统（**本次重点**）
- 普通出图：`services/h3-image.js`（803 行）/ `services/h3-image-lora.js` / `image-dims.js`
- **局部重绘**：`services/h3-inpaint.js`（1002 行）/ `services/inpaint-task.js`
- 前端：`pages/ImagePage.tsx` / `components/InpaintPanel.tsx`
  / `components/MaskEditor.tsx` / `components/ImageLoraPicker.tsx` / `lib/brush.ts`
- vendor：`vendor/inpaint-nodes/`（`__init__.py` + 部署脚本）
- **边界**：重绘节点图与普通出图**必须**分离（h3-inpaint.js 头部已声明此约束）。
- 审查要点：denoise 固定 1.0、mask 尺寸一致、32 倍数、crop 贴回保真、auto 分辨率公式。

### M7 · 角色卡 / 立绘拆解 / 素材库
- `services/character-vault.js` / `services/breakdown.js` / `services/asset-service.js`
- 前端 `VaultPage` / `BreakdownPage` / `AssetsPage` / `components/AssetPicker.tsx`
- **边界**：卡 → 参考图预算 ≤9 张，编号由 ref-images 统一给出。

### M8 · 视频换人（Replace）
- `services/replace.js` / `replace-runner.js` / `services/shot-splitter.js`
- `host/api/replace-tasks.js` + `api/index.js` 的 `/replace/*` 族
- 前端 `pages/ReplacementPage.tsx`（1218 行）
- **边界**：换人是独立状态机（data/replace/），不复用 A/B 链的 job 语义。

### M9 · 剪辑与后处理
- `services/edit.js` / `services/post.js` / `services/media-probe.js`
- 前端 `pages/EditPage.tsx` + `api/edit.ts` + `pages/JobsPage` 引用
- **边界**：编辑模型是有序片段列表，非多轨时间轴。

### M10 · Blender 预演
- `services/blender-service.js` / `host/blender/*.py`（render_shot / actions / list_actions / dump_catalog）
- 前端 `pages/PrevizPage.tsx`
- **边界**：子进程 + 帧数校验 + `_running` 哨兵。

### M11 · 剧本工坊 / 智能分镜
- `services/h3-workshop.js`（只产文本）/ `bridge/llm/storyboard.js`
- 前端 `pages/H3Page.tsx` / `StoryboardPage.tsx` / `components/ContinuationPanel.tsx`

### M12 · 画布（最大前端模块）
- `app-src/src/canvas/*`（26 节点 / CanvasArea 1761 行 / nodeRegistry 1114 行
  / graph / runner / history / autosave / portTypes）
- `services/canvas-agent.js`（17 工具 + 4 权限位）
- **边界**：画布是独立执行器，不得反过来驱动 M5 的服务端 job。

### M13 · 持久化与数据模型
- `host/store/json-store.js`（原子写 / 串行队列 / .bak / .corrupt）
- `host/store/models.js`（档位 / 26 节点 / 14 资产 / H3 19 槽位 / 镜头校验）
- `host/store/mode-aliases.js`
- `data/` 运行时数据（workflows / projects / shots / vault / assets / outputs / runs）
- **边界**：所有写盘经 json-store；不得有旁路 `fs.writeFileSync`。

### M14 · 文档 / 技能 / 工具脚本 / 构建产物
- `README.md` / `CHANGELOG.md`（2683 行）/ `docs/*`（16 份，含旧审计 6 份）
- `skills/`（10 个 skill，两层嵌套，由 host/skills.js 注册）
- `tools/`（smoke-api 3608 行 / check-routes / audit-params / preview-server / verify-edit）
- `app-dist/`（构建产物，入库）
- `vendor/nanfeng/`（10 个 .py + `_removed/` 历史模块）、`vendor/inpaint-nodes/`
- **边界**：文档与代码一致性；技能目录的两层嵌套约定。

---

## 三、已确认的「结构性问题」（第一层观察）

以下不是 bug，是**分层被破坏**的证据，逐条交给对应审查员核实：

1. **`host/api/index.js` 2819 行 = 路由 + 业务 + 数据整形**。已抽出 8 个子文件，但主体仍是"一个 if 一个 handler"的巨型函数，A/B/C 三条链的 handler 混在同一函数体。
2. **`h3-prompt.js` 2021 行**，编译器与画风库、打光库、反模式表、续写开关全在一个文件，无子模块。
3. **`app-src/src/pages/ImagePage.tsx` 已从 594 → 1200+ 行**（本次 +637 行改动），局部重绘、LoRA、批量、进度全塞进一个组件。
4. **`host/services/ref-images.js` 有 4 个导出函数但历史上有 4 份实现**（曾合一），需确认无回退。
5. **配置「分裂脑」已修但留有 `cfg` 兼容字段**（index.js 注释自认），需确认还有多少服务在读快照。
6. **工具层 `not diegetic`**：`studio_qc` 入参与 REST 不同形，属补丁残留。
7. **垃圾文件**：仓库根有 `{console.log('ASSET_TYPES` 和 `{console.log('BUILTIN`（0 字节，shell 重定向事故）。
8. **工作区未提交**：+3563 / −377 行，跨 20 个文件，含新模块 inpaint + LoRA 分类器 + smoke 测试 +730 行。版本号已 bump 3.2.0 → 3.3.0 但未提交。
9. **旧审计文档 6 份**（`docs/audit/01–06`，11-23）描述的是 v3.2.0 之前的形态，与当前代码不符。
10. **`vendor/nanfeng/_removed/`** 保留 5 个历史模块（不加载），属"备份的过往版本"。

---

## 四、审查纪律

- 每个审查员**只读**自己那一份模块，不改代码；产出问题清单（含文件:行、严重度、根因、建议）。
- 严重度定义：
  - **P0** 静默产生错误结果 / 数据丢失 / 插件崩溃（fiber failed）
  - **P1** 功能失效或与契约不符，用户能感知
  - **P2** 可维护性：耦合、重复实现、补丁注释、死代码
  - **P3** 文档/文案与代码不符
- 全量修复在**全部审查回报之后**统一进行，由主控（lead）按模块顺序执行，不许并行改同一文件。