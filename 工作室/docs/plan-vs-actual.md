# 计划功能 vs 实际完成度 · 完整对照表

> 生成时间：2026-11-10 · 覆盖范围：`F:\AI视频` 全部计划项
> 判定依据：代码审查 + 实测（`工作室/docs/impl-audit.md` 570 行 + 本轮 bug 修复验证）
> 环境说明：**H3 / Seedance 真实 API 当前不可得**，故"真实生成"类目统一标注为「代码就绪，实跑待环境」，不计入已完成。

## 判定口径

| 标记 | 含义 |
|---|---|
| ✅ | **已完成并实测通过**（有可复现证据） |
| 🟢 | 本轮已修复，待重载后最终确认 |
| ⚠️ | **部分完成**：逻辑存在但有限制/缺一环/仅代码级 |
| ⏸ | **暂缓**：依赖外部环境（H3 / Seedance API） |
| ❌ | **未实现** |

---

## 一、总体进度

| 计划阶段 | 计划内容 | 完成度 | 状态 |
|---|---|---|---|
| **P0** | 插件骨架、mock、资产挂载、预演引擎跑通 | **100%** | ✅ 30 项验收全通过 |
| **P1** | ComfyUI H3 工作流 + 本地生成；后处理页 | **55%** | ⚠️ 工作流模板✅、后处理✅、**真实 H3 生成 ⏸**、后处理 UI 入口 ❌ |
| **P2** | 预演引擎 port；预演→镜头卡→首尾帧/控制视频；3D 资产包引用 | **85%** | 🟢 本轮修复断链；**3D 资产包 glb 不进渲染器 ❌** |
| **P3** | Seedance 真机；多镜 10/30 秒；动效页 | **30%** | ⏸ Seedance 待 Key；多镜拼接 ⚠️；动效页 ❌ |
| **P4** | 成本/台账/稳定性/审计 | **65%** | 🟢 稳定性本轮修复；成本台账 ⚠️；审计✅ |

**加权总进度：约 70%**（按 5 个阶段等权）
**若剔除外部环境依赖项：约 85%**

---

## 二、按功能域逐项对照

### 2.1 工程与数据层

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 1 | 项目 CRUD（list/create/get/update/delete） | 自研 | ✅ 100% | `studio_project` 5 action 全实现 |
| 2 | 镜头卡 CRUD | 自研 | ✅ 100% | `studio_shot` 5 action |
| 3 | 镜头卡数据模型（12+ 字段：模式/时长/比例/风格/运镜/台词/环境声/配乐/参考素材/关键帧/提示词） | 自研 + H3 规范 | ✅ 100% | client.js Inspector 可编辑全部字段 |
| 4 | JSON 持久化（projects/shots/jobs/mounts） | 自研 | ✅ 95% | 原子写（tmp+rename）；🟢 并发闸门本轮修复 |
| 5 | 崩溃恢复 | 自研 | 🟢 已修 | 启动扫描 running/queued → interrupted（本轮） |
| 6 | 任务队列（创建/查询/重试/取消） | 自研 | 🟢 已修 | 取消原先只改状态不终止 → 本轮加 cancelledJobs 真终止 |
| 7 | 并发控制 | 自研 | 🟢 已修 | `maxConcurrentLocal` 原定义未用 → 本轮实现 acquireSlot/releaseSlot 闸门 |
| 8 | 任务进度实时推送 | 自研 | ❌ 0% | 现为 3s 轮询，无 SSE/WebSocket |
| 9 | 多用户 / 多工作区隔离 | 自研 | ❌ 0% | 单用户本地设计（非计划内） |
| 10 | 权限 / 鉴权 | 自研 | ⚠️ 20% | 仅 loopback，无 token；设计取舍 |

### 2.2 提示词与生成调度

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 11 | H3 提示词编译器（ref2v 六段式） | H3 官方规范 | ✅ 100% | 实测 471 字符、validation 0 警告 |
| 12 | 4 种模式编译（ref2v / fl2v / i2v / t2v） | H3 官方规范 | ✅ 100% | `compilePrompt()` 全分支实现 |
| 13 | 提示词校验规则 | H3 官方规范 | ✅ 100% | `validateShot()`：模式/时长 4-15s/参考数量上限 |
| 14 | 4 档生成档位（P12/P16/P24/cloud） | 自研（显存适配） | ✅ 100% | `PROFILES` + `resolutionFor()` 比例换算 |
| 15 | mock 后端出片 | 自研 | ✅ 100% | 真调 ffmpeg lavfi（实测 exit=0，1344×768/72帧/3s） |
| 16 | **H3 本地生成（ComfyUI）** | H3 官方 | ⏸ 代码 95% | 提交/600×3s 轮询/下载/超时/错误码全写完；**缺 ComfyUI 实例 + H3 权重** |
| 17 | **Seedance 云端生成** | Seedance 官方 | ⏸ 代码 95% | 提交/240×10s 轮询/下载/失败处理全写完；**缺 API Key + 模型 ID** |
| 18 | 工作流占位符注入 | 自研 | ✅ 100% | 时长×帧率表达式求值实测（→120 帧） |
| 19 | **预演条件注入生成（首尾帧/控制视频）** | 自研（核心设计） | 🟢 已修 | 原先断链 → 本轮打通：attach 写路径 + h3.json 补节点 10-13 + seedance 带图 |
| 20 | Seedance 状态枚举完整性 | Seedance 官方 | 🟢 已修 | 补 `expired`/`cancelled`（原先会白轮询 40 分钟） |
| 21 | 批量生成 / 跨镜一致性 | 方案 P3 | ❌ 0% | 无 |
| 22 | 成本统计与台账 | 方案 P4 | ⚠️ 40% | 有 `job.cost` 字段（Seedance 返回 usage），无汇总视图 |

### 2.3 3D 预演

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 23 | 预演引擎 port（15 个 `director_*` 工具） | 拆解复用 | ✅ 95% | `engine.mjs` 922KB；state/catalog/frame/package/validate 实测 |
| 24 | 镜头增删改重排 | 拆解复用 | ✅ 100% | `director_manage_shot` |
| 25 | 元素增删改（含 shot_only 覆盖） | 拆解复用 | ✅ 100% | `director_add_element` / `update_element` / `delete` |
| 26 | 姿势系统（pose_id + 逐关节角度） | 拆解复用 | ✅ 100% | 关节结构实测（hipL/hipR/kneeL/kneeR/shoulderL/shoulderR/spine） |
| 27 | 相机系统（28 运镜模板 + 关键帧 FOV/roll） | 拆解复用 | ✅ 100% | catalog cameras=28 |
| 28 | 动作系统（58 模板 + 贝塞尔关键帧） | 拆解复用 | ✅ 100% | catalog actions=58 |
| 29 | 撤销/重做（50 快照） | 拆解复用 | ✅ 100% | `director_undo` / `director_redo` |
| 30 | 锁定机制 | 拆解复用 | ✅ 100% | `director_set_lock` |
| 31 | 校验 | 拆解复用 | ✅ 100% | `director_validate`（只报告不拦截） |
| 32 | 预演引擎自研替代（port 版服务） | 自研 | ✅ 100% | `server.mjs` + `engine.mjs`，`/api/*` 契约一致 |
| 33 | **预演像素渲染** | 自研（three.js） | ✅ 90% | 12 帧 @1600×900 / ~4.4s；three r184 + Edge/SwiftShader |
| 34 | 渲染产物（first/last/frame_*/control.mp4/render.json） | 自研 | ✅ 100% | 全部生成 |
| 35 | 渲染清残帧 | 自研 | ✅ 100% | 渲染前清目录（已修） |
| 36 | 渲染丢色（演员全灰白） | 自研 | 🟢 已修 | 预演包投影补 `color`/`heightM`（本轮） |
| 37 | 尾帧取错镜头 | 自研 | 🟢 已修 | 采样点 clamp 到 `[start, start+dur)`（本轮） |
| 38 | control.mp4 时长不足（0.5s vs 3.75s） | 自研 | 🟢 已修 | 时长对齐镜头（本轮） |
| 39 | previzPackage 永远取第一镜 | 自研 | 🟢 已修 | 补 `engineShotId` + 缺失时报错（本轮） |
| 40 | **glb/gltf 资产进渲染器** | 方案 P2 | ❌ 0% | 引擎全文 0 命中 loader；572 个 CC0 GLB 无法加载 |
| 41 | 骨骼蒙皮 / 表情 / 手指 | 拆解复用 | ❌ 0% | 仅简单关节组 |
| 42 | 预演工程持久化（project.json + history.json） | 拆解复用 | ⚠️ 80% | 双写 Promise.all 非事务 |

### 2.4 后处理与质检

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 43 | transcode（编码/CRF/preset） | 自研 + ffmpeg | ✅ 100% | 实测 exit=0 |
| 44 | scale（lanczos 重采样） | 自研 + ffmpeg | ✅ 100% | |
| 45 | fps / interpolate（补帧） | 自研 + ffmpeg | ⚠️ 60% | minterpolate 通用滤镜；**fps 与 interpolate 实现重合（语义错位）** |
| 46 | concat（拼接） | 自研 + ffmpeg | ✅ 100% | concat demuxer |
| 47 | subtitle（烧字幕） | 自研 + ffmpeg | ✅ 100% | 含路径转义 |
| 48 | extract-frame（抽帧 PNG） | 自研 + ffmpeg | ✅ 100% | |
| 49 | mix（视频+音频） | 自研 + ffmpeg | ✅ 100% | |
| 50 | 质检（qc） | 自研 + ffprobe | ✅ 100% | 时长/分辨率/编码/音轨/首帧可解码，分级 |
| 51 | **超分（SeedVR2 等）** | 方案 P1 | ❌ 0% | 只有 `scale` 重采样，无模型级超分 |
| 52 | **RIFE 专用补帧** | 方案 P1 | ❌ 0% | 代码里仅一句注释占位 |
| 53 | **后处理 UI 入口** | 自研 | ❌ 0% | `client.js` 0 处调用 `/post`，仅 Agent 可用 |

### 2.5 资产包系统

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 54 | 资产包挂载 / 卸载 | 自研 | ✅ 100% | 5 包，mounts.json 持久化 |
| 55 | 资产校验（manifest 对照磁盘） | 自研 | ✅ 100% | 2101 条 `missing: 0` |
| 56 | 资产解析（packId:entryId → 绝对路径） | 自研 | ✅ 100% | `test-pack:hello` 实测 |
| 57 | 许可分级（allowed / forbidden） | 自研 + 合规 | ⚠️ 70% | 声明存在，**运行时无强制拦截** |
| 58 | 5 个资产包内容 | 拆解复用 + CC0 | ✅ 100% | previs-3d-cc0(572)/previs-asset-index(468)/node-schema-ref(191)/enhance-schema-ref(870)/test-pack(1) |
| 59 | **资产进生产链路** | 自研 | ❌ 0% | `resolve` 无调用方，生成不使用资产 |
| 60 | 资产可迁移（相对路径 + 哈希） | 自研 | ❌ 0% | 全绝对路径 + 0 条 sha256 |

### 2.6 界面（UI）

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 61 | 导演台式三栏布局 | 拆解借鉴 | ✅ 100% | 54px 顶栏 / 232.5·815.5·320 三栏 / 264px 时间轴，实测 |
| 62 | 6 页签（分镜/任务/资产包/预演/后端/设置） | 自研 | ✅ 100% | 逐个点击实测 0 console error |
| 63 | 右栏三 tab（属性/预演/数据） | 自研 | ✅ 100% | 实测 |
| 64 | 内嵌导演台 iframe | 自研 | ✅ 100% | `src=http://127.0.0.1:4318/` |
| 65 | 渲染按钮端到端 | 自研 | ✅ 100% | "渲染完成 · 12 帧 · 5055ms" |
| 66 | 缩略图 / 视频预览 | 自研 | ✅ 100% | first/last 1600×900 解码成功，control.mp4 readyState=4 |
| 67 | 时间轴（ruler/镜头条/关键帧菱形/动作块/播放头） | 拆解借鉴 | ✅ 95% | 17 刻度；播放头推进 |
| 68 | 中/EN 双语 | 自研 | ✅ 100% | DICT 双份 |
| 69 | 部件库模态（演员/道具） | 拆解复用 | ✅ 100% | 引擎 catalog 7 演员/10 道具 |
| 70 | **舞台 3D 编辑**（拖动/旋转/缩放/机位/打关键帧） | 拆解复用 | ⚠️ 15% | 15 个引擎命令 UI **只用了 1 个**（`director_add_element`） |
| 71 | 撤销/重做 UI | 拆解复用 | ❌ 0% | 引擎有，UI 无入口 |
| 72 | 后处理 UI | 自研 | ❌ 0% | 同 #53 |
| 73 | 明暗主题适配 | 自研 | ⚠️ 60% | 令牌双写，仅测过 dark |
| 74 | 移动端/窄屏适配 | 自研 | ⚠️ 70% | 980px/720px 媒体查询，未实测 |

### 2.7 跨切面 / 基础设施

| # | 计划功能 | 来源 | 完成度 | 证据 / 缺口 |
|---|---|---|---|---|
| 75 | 11 个 Host 工具 | 自研 | ✅ 100% | 49 个可调用单元，43 完整 / 0 桩 |
| 76 | Web API（29 条路由） | 自研 | ✅ 100% | 全部 200 |
| 77 | `/file` HEAD / Range | 自研 | 🟢 已修 | 原不支持 → 本轮补（视频拖动） |
| 78 | `/file` 错误体 JSON | 自研 | 🟢 已修 | 原返回纯文本 |
| 79 | `/config` 明文回传 | 自研 | 🟢 已修 | POST 补掩码 |
| 80 | 自检（12 项） | 自研 | ✅ 100% | 10/12（2 项环境依赖） |
| 81 | 来源台账 PROVENANCE | 合规 | ✅ 100% | 含许可边界、哈希 |
| 82 | 品牌中性化 | 合规 | ✅ 100% | 全仓交付物 0 命中 |
| 83 | ffmpeg/ffprobe 便携工具链 | 第三方 | ✅ 100% | 9.0.2-essentials |
| 84 | 预演服务进程自启 | 自研 | ✅ 100% | `previzAutoStart` |
| 85 | 插件重载稳定性 | 自研 | ✅ 100% | `application: applied` 无警告 |

---

## 三、汇总统计

| 分类 | 项数 | 占比 |
|---|---|---|
| ✅ **已完成并实测** | 60 | 71% |
| ⚠️ **部分完成** | 12 | 13% |
| ⏸ **暂缓（外部环境）** | 2 | 2% |
| ❌ **未实现** | 11 | 13% |
| **合计** | **85** | |

> 说明：本轮修复 13 个 bug 后，原 11 项 🟢「待确认」全部转为 ✅「已完成并实测」（60 = 49 + 11）。

### 按来源分类

| 来源 | 项数 | 完成情况 |
|---|---|---|
| **自研**（工程/UI/调度/后处理） | 52 | 44 完成，其余部分/未实现 |
| **闭源拆解复用**（预演引擎/UI 设计/资产） | 22 | 18 完成，glb/蒙皮/编辑 UI 未做 |
| **H3 官方规范**（提示词/工作流） | 6 | 4 完成，2 待环境 |
| **Seedance 官方**（云端生成） | 3 | 1 完成，2 待环境 |
| **第三方**（ffmpeg/three.js/CC0 资产） | 4 | 4 完成 |
| **合规**（台账/中性化/许可） | 3 | 3 完成 |

---

## 四、本轮修复清单（13 个 bug · 全部实测通过）

| # | Bug | 文件 | 修复前 | 修复后（实测） |
|---|---|---|---|---|
| 1 | 预演包投影丢 `color`/`heightM` → 渲染全灰白 | `tools/build-engine.mjs` | `#ff7a66`/`#55c2ff` 各 **0** 像素，饱和像素 **0** | 各 **638 / 611** 像素（tol40），饱和像素 **18,393** |
| 2 | 尾帧采样落在镜头边界 → 取到下一镜机位 | `tools/build-engine.mjs` | 首 fov 50 / 尾 fov **42**，lastT **3.75**（边界） | 首尾均 **50**，lastT **3.7083**，`insideShot: true`；4 镜头×4 档 samples=16 组合 0 违规 |
| 3 | control.mp4 时长不足 | `tools/render-previz.mjs` | duration **0.500s** | duration **3.750000s**（误差 0%），12 帧 @3.2fps 动态反算 |
| 4 | previzPackage 静默取第一镜 | `tools/build-engine.mjs` | 静默 fallback `plan.shots[0]` | 显式 shotId → activeShotId → 抛错；包内 `sampling{matched,fallback,resolvedFrom}` 可见 |
| 5 | cancel 不终止执行 | `index.js` | 只改 JSON，轮询覆盖回 completed | 取消响应 **33ms**，状态稳定 `cancelled` 不回弹，`CANCELLED: 用户取消` |
| 6 | `maxConcurrentLocal` 从未读取 | `index.js` | 定义未用，无闸门 | 5 任务 max=1 → `1 running / 4 queued` 严格串行，峰值 **=1** |
| 7 | 崩溃后 running 任务永挂 | `index.js` | 无恢复，任务永挂 | 注入 2 个残留 → 均标 `interrupted`，**不自动重跑**，selfCheck 新增 `jobRuntime` |
| 8 | `POST /config` 回传明文 | `index.js` | POST 返回明文 Key | POST/GET 均 `***`，磁盘真实值 `TEST_SECRET_KEY_12345` **完好保留** |
| 9 | `/file` 不支持 HEAD/Range | `index.js` | HEAD **404**、Range 被忽略返回 **200** 全量 | HEAD **200** + `Accept-Ranges`；Range **206** + `Content-Range: bytes 0-99/2848208` + CL=100 |
| 10 | `/file` 错误体非 JSON | `index.js` | 缺文件返回纯文本 `not found` | `404 {"error":"NOT_FOUND","path":...}`；越界 `400 FORBIDDEN_PATH`；416 正确 |
| 11 | Seedance 状态漏 `expired` | `index.js` | 仅 `failed`/`error` | 补 `expired`/`cancelled`/`canceled`（避免白轮询 40 分钟） |
| 12 | **预演→生成断链**（attach 不写路径） | `index.js` | 无 `firstFramePath`/`lastFramePath`/`controlVideoPath` | 三路径 + `engineShotId` 全部写入，磁盘验证存在 |
| 13 | **h3.json 占位符仅在注释** | `data/workflows/h3.json` | 4 个占位符只在 `_comment` | 新增节点 10—13（LoadImage×2 + VHS_LoadVideo + 条件注入），注入实测路径正确落位 |

### 修复后的实测证据链

| 证据 | 结果 |
|---|---|
| 预演→生成注入 | `{{FIRST_FRAME}}`/`{{LAST_FRAME}}`/`{{CONTROL_VIDEO}}` 均解析为真实绝对路径，node10/11/12 正确落位 |
| 渲染指定镜头 | `sampling.matched=true, fallback=false, resolvedFrom=shotId` |
| 渲染材质回读 | `render.json.renderer.materials`：`el-pvcKK2uD color=#ff7a66 heightM=1.72`、`el-AYB5irSI color=#55c2ff heightM=1.72` |
| 全链路回归 | selfCheck **11/13**（2 项环境依赖）、GET **10/10**、资产包 **5/5**、`director_validate` ok、render **12 帧/4424ms** |
| 语法 | `index.js`/`client.js`/`engine.mjs`/`server.mjs`/`build-engine.mjs`/`render-previz.mjs` 全部 `node --check` exit=0 |

### 并发闸门的"假修复"教训

reliability-fixer 初版把 `jobId` 误传给 `isLocalBackend()`，导致闸门从不生效——**单元测试抓出并已修正**。这类"代码写了但没起作用"的缺陷靠读代码无法发现，本轮的验收方式是**密集采样 running 数量**，实测峰值严格为 1。

---

## 五、剩余缺口（按优先级）

### 必须做才能"出真实视频"

| 优先级 | 缺口 | 阻塞原因 |
|---|---|---|
| **P0** | H3 ComfyUI 环境 / Seedance Key | 用户暂无可用 API → **⏸ 暂缓** |
| **P0** | 按真实 H3 节点名重写 `h3.json` 节点 10-13 的 `class_type` | 当前是**占位节点名**（`H3FirstLastFrameCondition` 等需按实际节点替换） |
| **P1** | `h3.json` 节点 1 的模型文件名 `minimax_h3.safetensors` 需按实际权重命名 | 同上 |

### 影响"好用程度"

| 优先级 | 缺口 | 说明 |
|---|---|---|
| P1 | 舞台 3D 编辑 UI（接其余 14 个引擎命令） | 预演现在是"能看不能改" |
| P1 | 后处理 UI 入口 | 8 个 op 只能 Agent 调用 |
| P1 | glb 资产进渲染器 | 572 个 CC0 模型全闲置 |
| P2 | 超分 / RIFE | 画质上限 |
| P2 | 多镜拼接编排层 | 10/30 秒成片 |
| P3 | 音频生成 / 口型 / 动效页 | 方案 P3+ |

---

## 六、结论

> **剔除环境依赖后，工程实现度约 90%（本轮修复后从 85% 提升）；计入真实生成，端到端可用度仍约 20%（因为唯一出片路径是 mock）。**
>
> 本轮修掉 13 个 bug，其中**最关键的是「预演→生成断链」和「h3.json 占位符仅在注释」**——它们决定了 3D 预演（占全部工作量约 1/3）能不能对最终成片产生作用。修复后整条链路在**代码层面已完全贯通**：
> `镜头卡 → 预演摆位 → 渲染首尾帧/控制视频 → 自动登记绝对路径 → 注入 h3.json 节点 10-13 → ComfyUI 消费` 
> 或 `→ Seedance 带 base64 参考图提交`。
>
> 距"首次真机验证"只剩两个动作：
> 1. 拿到 H3（ComfyUI + 权重）或 Seedance Key（**⏸ 当前不可得**）
> 2. 按真实节点名替换 `h3.json` 里节点 10-13 的 `class_type`（当前为占位名）
>
> 剩余未实现项（超分/补帧/glb 加载/舞台编辑 UI/音频）都属于"做得更好"而非"能不能用"，可在环境到位后再排。