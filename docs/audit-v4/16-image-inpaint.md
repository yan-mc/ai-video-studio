# M6 图像子系统审计

> 审计对象：`F:\AI视频\dsh-jiuzhang-studio`（v3.3.0，工作区未提交改动）
> 审计范围：普通 H3-Image 出图 + 图像 LoRA + 局部重绘（inpaint）+ vendor/inpaint-nodes + 相关文档
> 审计方式：逐行通读源码；对 ComfyUI 侧契约（`F:\AI视频\ai-runtime\ComfyUI`）做了只读交叉核对
> 审计时间：2026-11-26

---

## 一、模块结构（文件 → 职责 → 行数 → 被谁调用）

### 1.1 后端（host/）

| 文件 | 行数 | 职责 | 被谁调用 |
|---|---|---|---|
| `host/services/h3-image.js` | 865 | 普通出图：尺寸表/自检、模型探测、提示词清洗、入参校验、节点图注入（LoRA + 参考图）、`runH3Image()`、批量种子拆分 | `generator.runH3ImageLocal`（唯一执行入口）、`api/index.js`（meta/generate）、`tools.js`（studio_image）、`h3-inpaint.js`（复用常量与 LoRA 探测） |
| `host/services/h3-image-lora.js` | 419 | 图像 LoRA 目录（`h3img/` 前缀过滤）、分类（6 类）、约束求解（单选替换 / 衰减 / 总强度看门狗 / 画风×角色冲突） | `api/index.js`（catalog/solve/meta）、`tools.js`（lora/meta/generate）、`h3-inpaint.js` 只 import 常量 |
| `host/services/image-dims.js` | 128 | 只读文件头取 PNG/JPEG/WebP/GIF/BMP 尺寸；给出 mask 与源图「是否同尺寸 / 是否不可验证」 | `inpaint-task.js`、`tools.js` |
| `host/services/h3-inpaint.js` | 1002 | 局部重绘：常量（denoise/强度/羽化/crop 默认）、入参校验、auto 分辨率、crop 参数解析、节点图组装、`runH3Inpaint()`、`inpaintMeta()` | `api/index.js`（inpaint/meta）、`tools.js`（inpaint/meta）、`inpaint-task.js` |
| `host/services/inpaint-task.js` | 196 | 局部重绘任务编排：校验 → 路径解析 → mask 尺寸核对 → 定分辨率 → 建 job；统一提交投影 | `api/index.js:1748/1781`（**唯一实际调用方**） |
| `host/services/comfy-client.js` | 679 | ComfyUI 客户端：地址探测、上传 staging、`queueStatus`、`runWorkflow` 提交+轮询+下载、`cancelRemote` | 三条链共用 |
| `host/services/ref-images.js` | 449 | 参考素材路径解析唯一实现；`MAX_IMAGE_EDIT_REFS=16`；`resolveImageEditRefs`（保序、不占槽） | `generator`、`h3-image`（常量）、`inpaint-task`、`tools.js` |
| `host/api/index.js` | 2819（M6 段约 1460–1832） | 路由：`/image/meta`、`/image/lora/catalog`、`/image/lora/solve`、`/image/generate`、`/image/inpaint/meta`、`/image/inpaint`、`/image/progress` | SPA / 外部脚本 |
| `host/tools.js` | 1302（M6 段 861–1182） | `studio_image` 工具：meta / lora / generate / inpaint | Agent |
| `host/api/http.js` | 181 | `readJsonBody(limit=4MB)`、`readRawBody`、`sendJson` | 所有路由 |

### 1.2 前端（app-src/src/）

| 文件 | 行数 | 职责 | 被谁调用 |
|---|---|---|---|
| `pages/ImagePage.tsx` | 629（HEAD 250，本工作区 +379 净增；`git diff --numstat` = +508/−129） | 文生图/参考图编辑页：参考图增删排序、提示词、尺寸/种子/张数、LoRA、任务轮询与结果、预览；`tab` 切换挂 `InpaintPanel` | 路由页 |
| `components/InpaintPanel.tsx` | 483 | 局部重绘面板：源图选择、MaskEditor、提示词/模式/强度/分辨率/种子、LoRA、提交、轮询、结果与继续重绘 | `ImagePage:251` |
| `components/MaskEditor.tsx` | 484 | 三层 canvas 画笔：底图 / mask 数据层 / 红色覆盖；导出黑底白区 PNG + strokePixels + bbox；撤销栈按字节预算 | `InpaintPanel` |
| `components/ImageLoraPicker.tsx` | 271 | 图像 LoRA 分类选择器；每次变更调后端 `imageLoraSolve` 展示替换/衰减/剔除 | `ImagePage`、`InpaintPanel` |
| `lib/brush.ts` | 360 | Catmull-Rom 样条、按间距重采样、径向渐变笔刷、纹理缓存、屏幕→canvas 坐标 | `MaskEditor` |

### 1.3 vendor / 数据

| 文件 | 行数 | 职责 | 被谁调用 |
|---|---|---|---|
| `vendor/inpaint-nodes/__init__.py` | 325 | 两个 ComfyUI 自定义节点：`JZImageCropByMaskAndResize`（mask→bbox→裁剪→缩放，输出 IMAGE/MASK/BBOX）、`JZImageUncropByMask`（按 bbox 混合贴回） | ComfyUI 进程（插件只通过 HTTP 引用） |
| `vendor/inpaint-nodes/deploy-vendor.ps1` | 89 | 复制到 `<ComfyUI>/custom_nodes/jiuzhang_inpaint_nodes`，`-Force`/`-Clean` | 人手执行 |
| `vendor/inpaint-nodes/VENDOR.md` | 193 | 与 KJNodes 的差异、节点说明、羽化链路、验收记录 | 文档 |
| `data/workflows/h3-image.json` | 67 | 出图模板（1..11）；普通出图与 inpaint 都从它 clone | `h3-image`、`h3-inpaint` |

**分层结论**：M6 的服务层边界基本成立——`h3-inpaint.js` 与 `h3-image.js` 各自组图，前端只经 REST。真正的破口有两处：① `host/tools.js` 复制了一份 inpaint 编排（见 P1-1），② `ImagePage` 与 `InpaintPanel` 形成两个互不知情的任务状态源。

---

## 二、功能清单（14 条审查点逐条结论）

| # | 审查点 | 结论 | 证据 |
|---|---|---|---|
| 1 | 出图节点图 vs 重绘节点图是否分离；三条硬约束是否真强制 | **分离成立**（`buildInpaintWorkflow` 独立组图，`latent_image` 走 `SetLatentNoiseMask`，conditioning 的 latent 无消费者）。约束①denoise 强制 ✅；约束②mask=源图 强制 ✅；约束③32 倍数 **只覆盖 crop 的 base_resolution，full 模式画布（=源图尺寸）无任何校验** ❌ | `h3-inpaint.js:678-883`、`794-795`、`866`；`image-dims.js`（全文无 32 检查）；`h3-inpaint.js:508-529`（sourceDims 只记不校验） |
| 2 | denoise 是否有配置/前端/参数覆盖路径 | **无旁路**。全仓 `denoise` 仅 4 类：模板常量、`INPAINT_DENOISE`、替换链（无关）、文档。`validateInpaintRequest` 完全不读 `body.denoise`；`runWorkflow({map:{}})` 不替换占位符；模板节点 7 被整节点覆盖 | grep `denoise` 全量结果；`h3-inpaint.js:74,851`；`h3-image.json:39` |
| 3 | mask 画布坐标 ↔ 源图像素是否严格一致；DPR/缩放/letterbox | **一致，无偏移**。canvas 备份尺寸直接设为源图像素 `W/H`，容器 `aspectRatio: W/H` 保证无 letterbox，`screenToCanvas` 用 `canvas.width/rect.width` 比例映射，与 DPR 无关；无坐标累加（每点独立乘比例） | `MaskEditor.tsx:104-106,444,452-472`；`brush.ts:349-360`；`h3-inpaint.js` 提交侧不做任何缩放 |
| 4 | 32 倍数是否覆盖 crop 的**实际裁剪尺寸**；crop base_res 是否漏 | **设计上裁剪块不需要 32**（vendor 只对 `tw/th` 对齐，`_bbox_from_mask` 明确不对齐并给了理由），这一点已修好；但 `base_resolution/min/max_crop` 的 32 对齐只在 JS 侧做，vendor `INPUT_TYPES` 的 step=32 只是 UI 元数据，后端不校验 → **任何绕过插件直接提交的图都可能非 32 对齐** | `vendor/__init__.py:130-151,178-187`；`h3-inpaint.js:442-446,481-484` |
| 5 | auto 公式是否与注释一致；bbox 极小/贴边/全图；面积上限 | **实现与注释一致**（`longEdge × max(1,scale)` → 面积夹 → `[min,max]` 夹 → 对齐 32 → 下限 256）。边界：极小 bbox→256；全图→被 maxMP/maxCrop 夹到 1024；贴边无影响（分辨率只取决于 bbox 尺寸）。**注释里的数值例子错**（说 450→480，实际 round(450/32)=14→448；说按"短边<683"放大，代码用长边） | `h3-inpaint.js:236-256,198,202,223-226` |
| 6 | 羽化：blur 缩放与夹取；GrowMask=16 是否也该缩放 | blur **应缩放且已缩放**，夹取正确（radius 1..31、sigma 0.1..10，1024→31/10.0，448→14/4.4）。**grow 不应缩放但被缩放了 → 缺陷**：GrowMask 作用在**裁剪块**（已是 crop 分辨率）上，1 latent 格恒等于 16 像素，故 expand=16 本身就是"一格"，与分辨率无关；按 `res/1024` 缩放后 448² 档只剩 7px（0.44 格），膨胀几乎失效 | `h3-inpaint.js:135-150`（正确）、`764-773`（grow 错误）、`789` |
| 7 | crop&stitch 是否逐像素保真；padding/minCrop/maxCrop 冲突；bbox 越界 | 越界安全（padding 只取剩余空间、x0/y0 夹紧、越界不缩）；但 **①"mask 外逐像素保真"只在裁剪块之外成立**——贴回用的是**羽化后**的 mask 做 alpha 混合，块内全程被轻微改写（实测 0.005 而非 0.0000）；**② `max_crop_resolution` 会把裁剪块从 bbox 缩到 1024，被裁掉的那部分涂区根本不会重绘**（见 P0-1） | `vendor/__init__.py:120-151,293-294` |
| 8 | LoRA 分类/互斥/衰减/看门狗/画风×角色；bypass 语义；MAX_LORAS vs 16 参考图 | 分类与求解器**实现完整且质量高**（单选替换、第 2 条起衰减、>1.5 告警 />1.8 剔最弱、画风×角色、角色×参考图）；`probeBypassLora` + `bypassLoraFallbackWarning` 语义正确。`IMAGE_MAX_LORAS=6` 与参考图 16 **不冲突**（节点号段 20..35 vs 40..45）。**但 inpaint 链路完全不走求解器**（见 P1-4） | `h3-image-lora.js:232-419`；`h3-image.js:344-362,645-646,693-723`；`h3-inpaint.js:419-438,722-744` |
| 9 | 参考图保序/第 1 张=被编辑原图/上限 16；与 inpaint 是否重复上传编号 | 普通出图 ✅：`resolveImageEditRefs` 严格保序、不去重、上限 16；`images.image_N` 用点号路径正确；staging 用 `文件名+内容哈希` 防中文名塌缩碰撞。inpaint **不复用该通道**，source/mask 各 staged 一次，**无重复上传、无编号冲突** | `ref-images.js:409-438`；`h3-image.js:605-611,751-776`；`comfy-client.js:318-322,341-397`；`h3-inpaint.js:932-939` |
| 10 | 三态进度会不会卡死/误判；onProgress 泄漏 | 不会卡死：`queueStatus` 的 `unknown` 只影响文案，`/history` 仍每 3s 轮询；history 硬失败连续 5 次才抛；超时按 deadline（默认 120min）。`onProgress` 全部 try/catch 包裹，REST 侧写 job 也 catch。**但 Agent 入口（tools.js）根本没传 onProgress** | `comfy-client.js:434-454,512-573`；`api/index.js:1768-1778`；`tools.js:1076-1084` |
| 11 | REST 与工具是否共用 prepareInpaint；参数名偏差 | **没有共用**：`tools.js:972-1103` 是 `prepareInpaint` 的手抄副本，`tools.js:47` 的 import 是死代码（无任何调用）。参数名映射本身一致（`cropResolutionId`→`crop.resolutionId`、`cropResolution`→`crop.baseResolution`），但两者同时给时 `auto` 档会**静默丢掉 baseResolution** | `tools.js:47,972-1103`；`h3-inpaint.js:473-495` |
| 12 | ImagePage 是否膨胀；状态是否互污；错误是否被吞 | 629 行、6 块状态 + 2 套任务轮询，**已到该拆的体量**；`tab` 切换直接卸载 `InpaintPanel` → 源图/mask/任务全丢（P1-5）；轮询 catch 后静默重试（合理）但无「轮询连续失败」提示；`toast.error` 只显示前 3 条 warnings | `ImagePage.tsx:92-111,190,251`；`InpaintPanel.tsx:132-145` |
| 13 | vendor 节点契约是否严格匹配；部署脚本会不会误覆盖 | 契约**完全匹配**：`image/mask/base_resolution/padding/min_crop_resolution/max_crop_resolution` ↔ wf['70']；输出 `image→[70,0]`、`mask→[70,1]`、`bbox→[70,2]` ↔ uncrop 的 `destination/source/mask/bbox`。部署脚本默认**拒绝**已存在目标（exit 2），`-Clean` 只删 $DEST 下 `*.py` 与 `__pycache__` → 不会误删兄弟目录；但**不校验 `$ComfyDir` 是不是 ComfyUI**（传错会新建目录树） | `vendor/__init__.py:72-96,209-223`；`h3-inpaint.js:777-787,872-876`；`deploy-vendor.ps1:32,54-65` |
| 14 | 文档与实现一致性 | 大量不一致，见 P3 组。最关键：`INPAINT-RESEARCH.md` 全篇主张 **denoise 固定 0.85**（与实现 1.0 相反）、`INPAINT-PLAN.md` 头部写「**代码未开始实现**」、羽化写 `GrowMaskWithBlur blur=32`（实际核心 `ImageBlur` 上限 31）、`H3-IMAGE-接口与LoRA使用手册.txt` **完全没有 inpaint 章节** | 见 P3-1…P3-5 |

---

## 三、问题清单

### P0（静默错误结果 / 数据丢失 / 插件崩溃）

#### P0-1｜`vendor/inpaint-nodes/__init__.py:120-125`｜选区大于 maxCrop 时，**超出部分的涂区根本不会重绘**，且提示文案把"被裁掉"说成"被缩小"

- **症状**：用户涂了一条横跨 2000px 的长笔画（bbox 2000×300），crop 模式下 `width=min(2000,1024)=1024`，裁剪块以 bbox 中心放置、只覆盖中间 1024px。剩下 976px 的涂区既不在 mask 里、也不在贴回范围里——**那部分像素保持原样，无任何报错**。而 `h3-inpaint.js:596-600` 生成的是"笔画会被缩小到 51%，细部细节会损失"，用户会以为整条笔画都被重绘了、只是糊一点。
- **根因**：`_bbox_from_mask` 用 `width = min(width, max_res)` 把**意图边界**当成了**裁剪窗口上限**，随后 `x0` 只是平移不改尺寸；而"被缩小"的语义属于 `tw/th`（`crop()` 里的 `common_upscale`），两者被混为一谈。JS 侧 `resolveCropResolution` 的 `downscaled/downscaleRatio` 与 warning 也建立在错误前提上。
- **修复建议**：① 让 crop 节点在 `bbox 长边 > max_crop_resolution` 时**保持裁剪块覆盖整条笔画**、只缩小 `tw/th`（即去掉 `min(width,max_res)`，把它挪到 `tw/th` 的计算里，下限用 `base_resolution`）；② 若坚持当前语义，则必须让 JS 侧算出"覆盖比例/被裁掉面积"写进 warning，文案改成"选区过大，仅中间 X% 会被重绘，请分次涂抹"；③ 补一条冒烟断言：bbox 大于 maxCrop 时 uncrop 的混合区域必须覆盖全部 mask 非零像素。

#### P0-2｜`h3-inpaint.js:254`＋`image-dims.js`（无 32 校验）｜full 模式对**源图尺寸**没有任何 32 倍数校验，产物尺寸与源图不一致、mask 与 latent 错位

- **症状**：源图 1000×1000 + `mode:'full'` → `VAEEncode` 内部 `vae_encode_crop_pixels` 把画布**居中裁到 16 的倍数**（1000→992×992），latent 62×62；而 mask 仍是 1000×1000，`reshape_mask` 把 1000 映射到 62 格 → 相对图像内容整体偏移最多 15px；`VAEDecode` 输出 992×992，与源图不同尺寸，用户拿到一张"缩了 8 像素、区域略偏"的图，**全程无 warning**。
- **根因**：硬约束③只写成了"crop 的 base_resolution 要 32 倍数"，`SourceDims` 只被用来缩放羽化参数（`h3-inpaint.js:528,764`），从没被校验。crop 分支侥幸安全（裁剪块被缩放到 32 对齐的 `tw/th`），full 分支完全裸奔。
- **修复建议**：`prepareInpaint` 在拿到 `dims.src` 后加一道：`src.w % 32 || src.h % 32` → 400 `SOURCE_NOT_ALIGNED`，提示"源图 1000×1000 不是 32 的倍数，full 模式会被裁边并导致区域偏移；请改用 crop 模式或先裁到 992×992"。或退一步：full 模式自动 `ImageScale` 到最近的 32 倍数并把该尺寸回写给前端。

---

### P1（功能失效 / 违反契约）

#### P1-1｜`host/tools.js:972-1103`（编排副本）＋`host/tools.js:47`（死 import）｜"双入口共用 prepareInpaint"只做了一半，Agent 入口仍在跑手抄副本

- **症状**：`inpaint-task.js` 的头注释与 `api/index.js:1742-1744` 都声称"编排只有一份实现，REST 与 Agent 工具共用"，但 `tools.js` 里是 130 行手写副本；`prepareInpaint / inpaintSubmitSummary` 被 import 后**零调用**（全仓 grep 只有 line 47）。两边的差异已经是事实：① tools 版**不传 `onProgress`**（Agent 发起的任务永远没有 `params.progress`）；② tools 版把 `unverifiable` 告警放在 `resolveCropResolution` **之后**（REST 在之前），顺序不同；③ tools 版自己拼提交响应（`tools.js:1086-1102`），漏了 `jobIds`、`cropResolution` 的 `warnings` 合并逻辑与 REST 不完全等价。这正是 `inpaint-task.js` 文件头警告过的那种漂移。
- **根因**：重构只改了 REST 一侧，Agent 一侧留了"以后再换"的旧实现，而 import 已经先加上了——死代码即证据。
- **修复建议**：删掉 `tools.js:972-1103` 的整段，改为 `const prepared = await prepareInpaint({...a 映射}, cfg, { projectId: a.projectId ? requireProjectId(a.projectId) : null });` + `return inpaintSubmitSummary(prepared, { forAgent: true })`；`onProgress` 由 `runJob` 侧统一写入 `job.params.progress`（与 REST 抽成同一个 helper）。

#### P1-2｜`h3-inpaint.js:770-773,789,822`｜GrowMask 的 expand 随分辨率缩放，低分辨率档萎缩到不足 1 个 latent 格

- **症状**：`growPx = max(2, round(16 × featherRes / 1024))`：1024→16、768→12、512→8、448→7（auto 档小选区常落在 448/480）。GrowMask 的输入是**已经缩放到 crop 分辨率**的 mask（`['70',1]`），此时 1 latent 格恒为 16 像素，所以 7~8px 的膨胀连一格都不到——量化误差与边缘漏白完全没被覆盖，接缝羽化失效。文件自己的注释（`h3-inpaint.js:768`）写的就是"基准 16px = latent 16× 下采样的一个格子"，结论应是**不缩放**。
- **根因**：把"像素空间的视觉宽度"（blur，该缩放）与"latent 网格常数"（grow，不该缩放）当成同一类参数处理。
- **修复建议**：`growPx` 恒取 `INPAINT_GROW`（16），最多按 crop 分辨率的整数倍向下取（`max(16, round(...))`）；把 `764-773` 的注释改成"grow 是 latent 网格常数，不随分辨率缩放；只有 blur 需要缩放"。同时在 `inpaintMeta` 里回**实际生效值**（见 P1-6）。

#### P1-3｜`h3-inpaint.js:851`＋`h3-image.js:305-310`｜denoise 锁死了，但"总步数必须是 6"这条同源约束没有任何守卫

- **症状**：`BasicScheduler` 的 PDD 网格错配由 `total_steps` 决定，`denoise<1` 与 `steps≠6` 是**同一个失败模式**（文件头 ① 自己写了"6 步 = 每步一个头 = 训练态；4 步/12 步已离开训练分布"）。但 inpaint 用的是 `effectiveImageSteps(cfg)`，配置可设 4..12，前端没有任何拦截，`/image/inpaint/meta` 还把这个值当"真实生效值"回给前端（`h3-inpaint.js:997`）。用户把 `imageSteps=8` 调了一次排障忘了改回，之后每一次局部重绘都在分布外出图——表现和"denoise=0.5 只剩 3 个头"一模一样。
- **根因**：把"排障开关"直接接到了 inpaint 这条必须以训练态运行的链路上。
- **修复建议**：inpaint 侧**不接受** `cfg.imageSteps`，恒用 `IMAGE_SAMPLING.steps`（6）；若确需排障，要求显式传 `allowOffGridSteps: true` 并在 job.warnings 里写明"已离开训练态"。同时在 `inpaintMeta` 增加 `stepsLocked: true` 与原因，与 `denoiseLocked` 对称。

#### P1-4｜`h3-inpaint.js:419-438,722-744`＋`InpaintPanel.tsx:169-171,353-358`｜inpaint 链路的 LoRA **不走求解器**：分类默认强度失效、滑块类 -5..5 被静默夹到 ±2

- **症状**：① `validateInpaintRequest` 注释（410-418）声称"保留 undefined，交给调用方用 solveImageLoraStack 补齐默认值"，但 REST/tools 两条 inpaint 路径**都没有调用 `solveImageLoraStack`**；`buildInpaintWorkflow:732-733` 的兜底是 `1.0`。于是同一条画风 LoRA：普通出图 0.8、局部重绘 1.0（总强度直接把 1.5 告警线踩穿，画面过曝）。② 滑块类允许 -5..5，组装期 `Math.max(-2, Math.min(2, …))` 静默夹紧，而 `job.params.imageLoras` 与前端徽章仍显示原值——这正是 `h3-image-lora.js:309-320` 记录为"已修"的那个缺陷，在 inpaint 侧原样复现。③ `InpaintPanel` 把 `maxSlots={6}` 写死，不用 `meta.effective.maxLoras`。
- **根因**：图像 LoRA 求解器只被接到 `/image/generate`，inpaint 链路复用了常量却漏了求解步骤。
- **修复建议**：在 `validateInpaintRequest`（或 `prepareInpaint`）里对 `loras` 调 `solveImageLoraStack(..., { maxSlots: IMAGE_MAX_LORAS, hasRefImages: false })`，用 `accepted[].appliedStrength` 覆盖，并把 `replaced/degraded/rejected` 全部并入 `req.warnings`；`buildInpaintWorkflow` 里去掉静默 clamp，改成"超范围直接报错"（求解器已经夹过了，再夹说明有 bug）。

#### P1-5｜`ImagePage.tsx:251`｜切换 tab 直接卸载 `InpaintPanel`，源图/mask/提示词/正在跑的任务全部丢失

- **症状**：`{tab === 'inpaint' ? <InpaintPanel /> : null}`——`generate` 与 `inpaint` 二选一渲染。用户涂了 5 分钟 mask、想看下调色参数再回来，mask 与源图选择全没了；如果任务正在跑，`InpaintPanel` 的轮询 effect 随之卸载，回来时组件重新挂载、`job` 状态为 null，**结果再也找不回来**（只能去素材库翻）。
- **根因**：用"条件渲染"实现"分栏"，把组件生命周期当成了状态存储。
- **修复建议**：两个面板都常驻、用 `display:none`/`hidden` 切换（保留 DOM 与 canvas 像素），或把 `InpaintPanel` 的 `source/mask/job` 提升到 `ImagePage` 或一个 `useInpaintStore`（zustand，与 `useProjectStore` 同构）；轮询移到页面级，按 `jobIds` 统一驱动（顺便消除现在两套轮询）。

#### P1-6｜`h3-inpaint.js:955-966`｜`runH3Inpaint` 的 meta 回报的是**基准常量**而不是实际生效值

- **症状**：`meta.blur = INPAINT_BLUR`（恒 31/10.0）、`meta.grow = INPAINT_GROW`（恒 16），而实际提交的是 `blurForResolution(featherRes)` 与缩放后的 `growPx`（448² 时 14/4.4 与 7）。排障时按 meta 反推"这次接缝为什么硬"必然得出错误结论；这与 `/image/meta` 已经修好的"declared vs effective"原则直接冲突（`h3-image.js` 里对此有专门注释）。
- **根因**：meta 在 `runH3Inpaint` 里手写常量，而真实值是在 `buildInpaintWorkflow` 内部算的、没有回传。
- **修复建议**：让 `buildInpaintWorkflow` 把 `{ featherRes, blur, grow, cropBox }` 挂到返回值的旁路字段（或直接写进 `req.crop.applied`），`runH3Inpaint` 用它填 meta；并把 `INPAINT_BLUR` 这个兼容别名删掉（见 P2-6）。

#### P1-7｜`vendor/__init__.py:293-294`＋`VENDOR.md:127-128`｜"mask 外逐像素保真（差异 0.0000）"不成立

- **症状**：贴回是 `destination*(1-mm) + canvas_src*mm`，其中 `mm` 是**羽化后**的 mask（`h3-inpaint.js:875` 传的是 `['75',0]`，即经过 GrowMask+ImageBlur 的软 mask）。高斯模糊的尾部在整块裁剪区内都非零，因此**裁剪块内、笔画之外的区域也被轻微改写过**（文档自己记的实测 0.005，而不是 0.0000）。真正逐像素保真的只是"裁剪块之外"。这不是数值 bug，是**对外承诺与实测口径不一致**，会让人在验收时按 0.0000 判失败、或在该区域做叠加时踩坑。
- **根因**：文档把"块外保真"写成了"mask 外保真"，而 mask 与裁剪块是两个不同范围。
- **修复建议**：文档改成"**裁剪块之外**逐像素等于原图（实测 0.0000）；块内、笔画之外的差异 ≤0.01（羽化尾部）"；并在 `VENDOR.md` 的验收表里标明测量范围。若要真正做到 mask 外 0 改动，需要把贴回用的 mask 换成未模糊的硬 mask（另开一路），或用 `mask_after_blur` 与 `mask_before_blur` 的差做保护。

---

### P2（可维护性：耦合 / 重复 / 补丁注释 / 死代码）

| 编号 | 文件:行 | 症状 | 根因 | 修复建议 |
|---|---|---|---|---|
| P2-1 | `h3-image.js:103,151-169` | 注释称尺寸表"由 `assertImageSizes()` 在启动期守"，但全仓只有 `tools/smoke-api.mjs:2448,2463` 调用它——**运行期从未自检** | 自检写成了纯函数，没人接进启动 | 在 `h3-image.js` 模块顶层或 `host/index.js` 的 apply 里跑一次，失败直接 throw（这是"表写错→产物尺寸不符"唯一能机器拦住的地方） |
| P2-2 | `ref-images.js:109-119` | dataURL 落盘到 `data/tmp-inline/<hash>.<ext>`，全仓**没有任何清理逻辑**（`extras.js` 的 orphan 扫描只看 `assets/`）；`InpaintPanel` 每次提交都传新的 mask dataURL → 永久堆积 | 临时目录只进不出 | 提交成功后按 `maskRel` 删除；或把 tmp-inline 纳入 orphan 清理并按 mtime 过期（>24h） |
| P2-3 | `MaskEditor.tsx:226-267` | 每次 `pointerup` 都做 `getImageData(W,H)` + 全画布 `toDataURL('image/png')`，父组件 setState 后又触发 `useEffect` 再做一次 `getImageData + putImageData`——2048² 上每笔两轮全图扫描 | 用"导出成品"当"中间状态" | 笔画期间只维护 canvas，导出延迟到提交前（或 debounce 300ms）；回灌路径加"内容哈希相同则跳过"的短路 |
| P2-4 | `h3-inpaint.js:971-1002` | `inpaintMeta()` 每次调用都真去 `probeInpaintNodes`（2 次 `/object_info`，各 6s 超时）；`InpaintPanel` 挂载即调、`studio_image action=meta` 也调 → 面板刷新/Agent 查询都吃这个延迟 | 探测无缓存 | 复用 `resolveComfyUrl` 那样的 5s TTL 缓存；探测失败时才即时重试 |
| P2-5 | `InpaintPanel.tsx:469-481` | 前端 `estimateRes` 复刻了后端 `autoCropResolution` 的**一部分**：缺 `maxMP` 面积夹取，`min/max` 默认值也与 `cropDefaults` 的取值路径不一致（`meta.cropDefaults` 缺失时回落 256/1024）。maxMP 被调小或 maxCrop>2048 时预估与真实值分叉 | 公式两处实现 | 由 `inpaintMeta` 直接回一个 `estimate(bboxW,bboxH)` 的**样例公式串**或干脆回预置表；至少把 maxMP 一起传进前端并照抄夹取顺序 |
| P2-6 | `h3-inpaint.js:152-153` | `export const INPAINT_BLUR = INPAINT_BLUR_BASE`（"兼容旧引用"）——全仓除自身 meta 外无消费者，且正是 P1-6 误导的来源 | 重构残留 | 删掉别名，要求所有调用点用 `blurForResolution()` |
| P2-7 | `h3-inpaint.js:1-54,156-206,581-601,688-721` | 单文件 1002 行里塞了：常量表 + 5 段长篇"历史缺陷"复盘 + 3 个纯数学函数 + 校验 + 组图 + 执行 + meta。**补丁注释占比极高**（"历史缺陷（P1，审查发现）"出现 6 次、"⚠️"出现 40+ 次），真正的代码被淹没 | 每次修 bug 都在原地写论文 | 拆 `inpaint-params.js`（常量+blur/auto/grow 纯函数，可单测）、`inpaint-graph.js`（组图）、`inpaint-run.js`（执行+meta）；"历史缺陷"统一搬到 `docs/`，代码里只留一句"为什么是这样"（当前 `h3-image.js` 已经做到这个度，`h3-inpaint.js` 没做到） |
| P2-8 | `ImagePage.tsx`（629 行）/ `InpaintPanel.tsx`（483）/ `MaskEditor.tsx`（484） | 三个组件共 1596 行；`ImagePage` 内含 6 块状态 + 2 套轮询 + 预览 + 下载；`InpaintPanel` 自己又有一份"源图选择 + 提示词 + 参数 + 任务结果"，与 `ImagePage` 的对应块高度同构 | 复制粘贴式长页面 | 抽 `ImagePromptPanel` / `ImageTaskList`（含轮询）/ `SourcePicker`，两个页面共用；页面只留布局与 tab |
| P2-9 | `h3-inpaint.js:982-983`、`tools.js:904` | `resolutionHint` 与工具描述都写"auto 档按**笔画面积**反推"——与本文件 163-206 行刚论证过的"按面积算是错的、已改成长边"直接矛盾，而这条字符串会经 `/image/inpaint/meta` 与 `studio_image action=meta` 直接展示给用户/Agent | 改了算法没改文案 | 改成"按选区外接框**长边** × 1.5，保证笔画不被缩小" |
| P2-10 | `tools.js:904-907` | `cropResolution` 描述"必须 32 倍数"，但 `validateInpaintRequest` 的 `align32()` 会**静默四舍五入**（1000→992），从不报错；`cropResolution` 与 `cropResolutionId:'auto'` 同时给时 `baseResolution` 被静默丢弃（`h3-inpaint.js:473-481`） | 校验策略前后不一 | 二选一：要么显式拒绝非 32 倍数（与描述一致），要么把描述改成"会四舍五入到 32 倍数"；`auto` + `baseResolution` 同时出现时直接 400 `INPAINT_BAD_CROP` |
| P2-11 | `comfy-client.js:553-573` | history 硬失败计数只对 `COMFY_HTTP_4xx/5xx` 与坏 JSON 计数；**网络类错误（ECONNREFUSED/超时）会无限重试直到 120min 超时**，而超时文案会引导用户"调大超时"，方向相反 | 只区分了 HTTP 层失败 | 对"连续 N 次网络错误 + `/queue` 也拿不到"合并成一个更快的失败判定（例如连续 20 次 = 60s） |
| P2-12 | `InpaintPanel.tsx:173-177` | 分辨率只在前端拼 `crop`，`padding/minCrop/maxCrop` 完全没有 UI 入口；用户无法在"选区被裁掉"时调大 `maxCrop`（P0-1 的唯一自救手段） | UI 未跟上参数 | P0-1 修好后至少把 `maxCrop` 暴露出来并显示"当前选区需要 1536²，上限 1024" |

---

### P3（文档与代码不符）

| 编号 | 文件:行 | 文档说法 | 代码事实 |
|---|---|---|---|
| P3-1 | `docs/INPAINT-RESEARCH.md:19,24,78,211,261,288` | "denoise 必须固定 **0.85**"、"0.85 是唯一安全窗口" | 实现固定 **1.0**，且 `h3-inpaint.js:24-30` 已论证 0.85 同样是网格错配以外的猜测。这份文档现在是**最危险的一份**——按它改代码就会踩回已知的坑 |
| P3-2 | `docs/INPAINT-PLAN.md:5` | "状态：**方案已定稿，代码未开始实现**" | 代码已完整实现并随 3.3.0 分发 |
| P3-3 | `docs/INPAINT-PLAN.md:24,165`＋`INPAINT-RESEARCH.md` 相关段落 | 羽化用 `GrowMaskWithBlur(blur_radius=32)` | 实际用核心节点 `GrowMask + MaskToImage + ImageBlur`，**radius 上限 31**（`comfy_extras/nodes_post_processing.py:89` 实测 `max=31`），sigma 上限 10.0。写 32 会被节点校验拒绝 |
| P3-4 | `docs/INPAINT-PLAN.md:110-121,126-149` | 节点图为 `51 GrowMask → 32`（无模糊）与 `71 GrowMaskWithBlur` | 实际是 `72 GrowMask → 73 MaskToImage → 74 ImageBlur → 75 ImageToMask`，节点号与拓扑都不同 |
| P3-5 | `docs/H3-IMAGE-接口与LoRA使用手册.txt`（758 行） | 号称"接口与 LoRA 使用手册" | **完全没有 inpaint 章节**（grep `inpaint|重绘|mask|crop` 只命中 4 处无关行）。局部重绘的接口契约只存在于 `skills/usage/SKILL.md` 与代码注释里 |
| P3-6 | `h3-inpaint.js:198,202` | "bbox 300×200：300 × 1.5 = 450 → 对齐 **480**，放大 1.6 倍" | `Math.round(450/32)*32 = 448`（14×32），放大 1.49 倍。`skills/usage/SKILL.md:186` 写的 448/1.49 才是对的——同一事实两个数字 |
| P3-7 | `h3-inpaint.js:223-226` | "小选区（bbox **短边** < 683）会被放大到 1.5 倍" | 代码用 `Math.max(bw,bh)` 即**长边**；短边不参与任何判断 |
| P3-8 | `vendor/inpaint-nodes/__init__.py:66-68` vs `:199` | 类文档说 bbox 输出 `(x0, y0, x1, y1)` | 实际返回 `(x0, y0, x0 + w, y0 + h)`（xyxy ✓），但同文件 100-102 行的 `_bbox_from_mask` docstring 又写 `(x0, y0, w, h)`，与返回值不符（易诱导后来者写错） |
| P3-9 | `VENDOR.md:111-113` | "外扩 padding，但**不允许扩出画布**"、"**越界时平移而非缩小**" | padding 部分正确；但"不缩小"只对 padding 成立——`max_crop_resolution` 会把块从 bbox 尺寸缩小（P0-1 的根因），文档未提这一条 |
| P3-10 | `INPAINT-PLAN.md:325,352` | "启动期探测节点存在性" | 实际是每次 `runH3Inpaint` + 每次 `inpaintMeta` 现探（无缓存，见 P2-4），不是启动期 |

---

## 四、结构性问题与重构建议

### 4.1 该合并的

1. **`tools.js` 的 inpaint 段与 `inpaint-task.js` 合并**（P1-1）。这是本次审计里"结构性重复"最确凿的一处：注释、import、文件头三处都声称已合并，实际只有 REST 走了新路。合并后 `inpaintSubmitSummary(prepared, { forAgent: true })` 天然消除两边响应字段的差异。
2. **两套轮询合成一套**：`ImagePage.tsx:92-111` 与 `InpaintPanel.tsx:132-145` 是同一件事（`/image/progress` + 终态判定 + interval 清理），而且 `ImagePage` 那份的依赖数组是 `batch.length ? batch[0].id : ''`（eslint 已 disable），生命周期最容易出错。抽 `useJobPolling(ids)` 一个 hook，页面级驱动。
3. **`estimateRes`（前端）与 `autoCropResolution`（后端）合成一份**（P2-5）。要么后端把公式作为字符串/预置表下发，要么前端干脆不预估、只显示"提交后由后端决定"。

### 4.2 该拆分的

1. **`h3-inpaint.js`（1002 行）三段拆开**（P2-7）：`inpaint-params.js`（常量 + `blurForResolution` / `autoCropResolution` / `estimateBboxFromStroke` / `inpaintStrength`，全是纯函数，最需要单测）、`inpaint-graph.js`（`buildInpaintWorkflow`）、`inpaint-run.js`（`runH3Inpaint` + `inpaintMeta` + `probeInpaintNodes`）。当前"改一个常量要滚过 600 行注释"是它最容易改错的原因。
2. **`ImagePage.tsx`（629 行）拆块**（P2-8）：`ReferenceImagesPanel`（含上传/排序/编辑目标徽章）、`ImageOutputSettings`、`ImageTaskList`。拆分后 `InpaintPanel` 可以直接复用 `SourcePicker` 与 `ImageTaskList`，两个页面的"选图 + 看图"体验才会真正一致。
3. **`MaskEditor` 的"导出/回灌"从渲染路径里拿出来**（P2-3）：`exportMask` 应该只被提交动作调用，笔画期间只维护 canvas。

### 4.3 该删的

1. `tools.js:47` 的死 import（`prepareInpaint` / `inpaintSubmitSummary`）——合并完成后自然消失，但**合并前它就是"重构未完成"的活证据**。
2. `h3-inpaint.js:152-153` 的 `INPAINT_BLUR` 兼容别名（P2-6）。
3. `vendor/inpaint-nodes/__pycache__/__init__.cpython-312.pyc`（已 `.gitignore:47`，但目录在仓库里）——部署脚本 `-Clean` 会删目标端的，仓库里的这份纯噪声。
4. `h3-inpaint.js` 里 6 处"历史缺陷（P1，审查发现）"长篇复盘：结论保留一句、复盘搬 `docs/`。当前`h3-image.js` 的注释密度是合适的参照物。

### 4.4 该补的（当前完全缺失的能力）

1. **启动/提交前的尺寸守卫**（P0-2）：源图 32 倍数校验 + `assertImageSizes()` 接进启动（P2-1）。
2. **inpaint 的 LoRA 求解**（P1-4）——现在这条链路上"分类默认强度/单选互斥/过曝看门狗"三项全不生效，等于图像 LoRA 的一半设计在 inpaint 上是摆设。
3. **inpaint 的分辨率/选区自适应提示**：P0-1 修好后，"选区超出 maxCrop"应该给出**可执行的下一步**（"当前选区 2000×300，上限 1024；请分 2 次涂，或把 maxCrop 调到 2048 并接受 ~2× 耗时"），而不是现在这句会误导人的"笔画会被缩小到 51%"。

### 4.5 值得一提的已修好项（不要回退）

- 入参三处 NaN 陷阱（`padding` / LoRA 强度 / `strengthId` 规范化）都已有针对性修复且有冒烟断言支撑：`h3-inpaint.js:396-401,410-433,448-461`。
- `auto` 档的"只传 baseResolution 必须当手动档"已修（`h3-inpaint.js:466-476`），这条以前会让 Agent 传的分辨率被静默忽略。
- 模板占位符不再依赖调用方传 map：`buildInpaintWorkflow:698-703` 直接把模型名写进节点，`runWorkflow({ map: {} })` 也不会漏 `{{VAE_NAME}}`。
- `probeBypassLora` 已抽成模块级并被 inpaint 复用（`h3-image.js:344-353`、`h3-inpaint.js:722`），不再写死 bypass 节点。
- 上传文件名的中文塌缩碰撞已修（`comfy-client.js:318-322` 内容哈希后缀）——这是"传 3 张只用上 2 张"那类静默丢图的根治点。
- `MaskEditor` 的"黑底不透明 PNG 回灌 → alpha 全 255 → bbox 变整幅图"这条链已修（`MaskEditor.tsx:160-173`），修复说明也写在注释里，值得保留。
- `queueStatus` 的 `ok:false / state:'unknown'` 语义处理干净（不因探测失败而报错），且 `/image/progress` 已改为按 id 逐个取（`api/index.js:1802`），不再每 1.5s 读整个 jobs.json。

---

## 五、结论

### 5.1 能否放行

**不能直接放行。** M6 的工程质量在"单点正确性"上是本仓最好的一块——denoise 的锁定理由、mask 尺寸校验的双入口、中文文件名哈希、黑底 mask 回灌这些都是真机踩坑后的正确修法，注释也把"为什么"讲清楚了。但存在两类**必须修完才能交付**的问题：

1. **两处会静默产出错误结果**（P0-1 选区被裁掉一半却不报错；P0-2 full 模式源图非 32 倍数导致产物缩水 + 区域偏移）。这两条的共同特征是"出图了、看着像成功、但其实没按用户意图做"，正是本仓一直在防的那类失败。
2. **一处结构性未完成**（P1-1 双入口没真正合并）+ **一处参数失效**（P1-4 inpaint 的 LoRA 默认强度/衰减/看门狗全不生效）。前者意味着"修一处要改两遍"的状态还在，后者意味着图像 LoRA 的一半设计在重绘链路上是装饰。

### 5.2 必须先修的顺序（建议）

| 顺序 | 编号 | 为什么排这个位置 |
|---|---|---|
| 1 | **P0-1** | 影响最大、修复面最小（vendor 一个函数 + 一句文案），且修完用户立刻能感知 |
| 2 | **P0-2** | 一行校验即可拦住；不修则 full 模式永远不可信 |
| 3 | **P1-1** | 不先合并，后面所有 inpaint 修复都要写两遍 |
| 4 | **P1-4** | 合并后一行调用即可；不修则 LoRA 在重绘上是"假开关" |
| 5 | **P1-2** | 影响所有 512/768/auto 档的出图质量，改动极小（去掉缩放） |
| 6 | **P1-3** | 与 P1-2 同一类"训练态"约束，一起改省一次回归 |
| 7 | **P1-5 / P1-6 / P1-7** | 体验与诚实性：切 tab 丢工作、meta 说谎、文档夸大 |
| 8 | P2-1 / P2-2 / P3-1 | 自检接入启动、临时目录止损、把 RESEARCH 的 0.85 改掉（**这条虽是 P3，但留着会诱导下一个人改错代码，建议和 P0 一批处理**） |

### 5.3 一句话结论

> 骨架是对的（重绘与出图确实分离、denoise 确实锁死、双入口的**校验规则**确实同源），但"共用编排"只完成了文档与 import，且 crop 的包围盒语义与 32 倍数守卫生效范围都有洞；修完 P0-1、P0-2、P1-1、P1-4 四条后可放行，其余按上表排期。

---

## 六、修复记录（v4）

修复范围：M6 图像子系统（普通出图 + 局部重绘 + vendor 节点 + 前端面板）。
不含 `host/tools.js`（Agent 工具层由另一位修复者负责，见 §6.4）。

### 6.1 逐条改动

#### P0-1｜vendor 把 bbox 当裁剪窗口 → 超出部分永不重绘【已修】

| 项 | 内容 |
|---|---|
| 文件 | `vendor/inpaint-nodes/__init__.py` |
| 行 | `_bbox_from_mask` 签名去掉了 `max_res` 参数（原 100-151）；`crop()` 新增 `sample_edge` 计算（约 L155-168） |
| 行为变化 | **`max_crop_resolution` 不再参与 bbox 计算**，只用于把采样长边 `tw/th` 封顶。bbox 现在**只增不减**（`min_crop_resolution` 撑下限、`padding` 外扩、画布夹紧），因此**一定覆盖 mask 的全部非零像素**。块比 `maxCrop` 大时**整块等比缩小**（覆盖完整、只损失细节），而不是裁掉一部分。 |
| 证据 | vendor 测试用例「长笔画 bbox 完整宽度」：2048² 画布 + 2000×300 笔画 + `maxCrop=1024` → bbox 仍为 `2000×300`，采样画布 1024（32 对齐）。修复前该用例 bbox 宽会是 1024、976px 涂区丢失。 |

配套文案（第 2 项要求）：`h3-inpaint.js` 的 `resolveCropResolution` 警告改为
「**整块会被等比缩小到 X%**（覆盖范围是完整的，涂过的地方都会被重绘；但细节会损失）」，
并删掉了全部「笔画会被缩小到 X%」的措辞 —— 后者会被读成"只有中间一部分被重绘"。
同时新增 `crop.sampleEdge / sampleBlock / sampleCanvas / blockDownscaled` 四个字段，
让"到底缩到多大"有可核对的数字（前端与 Agent 都能看到）。

#### P0-2｜full 模式源图无 32 倍数校验【已修】

| 项 | 内容 |
|---|---|
| 文件 | `host/services/image-dims.js`、`host/services/h3-inpaint.js`、`host/services/inpaint-task.js` |
| 行 | `image-dims.js:19-65`（`CANVAS_ALIGN` / `normalizeCanvasSize` / `canvasAlignMessage`）；`h3-inpaint.js:223-268`（`guardFullCanvas`）；`inpaint-task.js:139-142`（接入编排） |
| 行为变化 | `prepareInpaint` 拿到 `dims.src` 后**先过 `guardFullCanvas`**：full 模式且源图非 32 倍数 → 抛 `SOURCE_NOT_ALIGNED`（400），文案给出安全尺寸与两个可执行选项（改 crop / 先裁到 992×992）。显式传 `fullCanvasTrim: true` 可放行，但 job.warnings 里写明「会被裁成 W×H、左右各裁 N 像素」。**crop 分支保持原有正确行为，不受影响**（非 32 源图照常通过，已有用例覆盖）。 |
| 证据 | e2e 用例：1000×1000 + full → `SOURCE_NOT_ALIGNED`；同请求 + `fullCanvasTrim` → 200 且 `job.params.canvas = {992,992}`；同图 + crop → 正常建 job。`trim` 按 ComfyUI 的 `(dims%ratio)//2` 居中语义算出（左右各 4、上下各 4）。 |

#### P1-2｜GrowMask expand 随分辨率缩放【已修】

| 项 | 内容 |
|---|---|
| 文件 | `host/services/inpaint-params.js`（常量注释）、`host/services/inpaint-graph.js:114-122` |
| 行为变化 | `growPx = INPAINT_GROW`（恒 16），删掉 `Math.round(INPAINT_GROW * featherRes / 1024)`。注释改为「grow 是 latent 网格常数（1 格 = 16px），不随分辨率缩放；需要缩放的只有 blur」。 |
| 证据 | 组图用例：crop 512 档下 `blur_radius=16/sigma=5`（缩放生效）而 `GrowMask.expand` 仍是 **16**（不缩放）。修复前该值是 8。 |
| meta 回报 | `inpaintMeta().grow = 16`，并新增 `blurForDefaultRes` 明确"基准值"与"实际值"的区别；执行期 meta 回的是 `applied.grow`。 |

#### P1-3｜denoise 锁死但 steps≠6 无守卫【已修】

| 项 | 内容 |
|---|---|
| 文件 | `host/services/h3-image.js:308-330`（`effectiveImageSteps(cfg, {forInpaint, allowOffGridSteps})`）、`inpaint-graph.js:72`、`inpaint-run.js`（meta） |
| 行为变化 | inpaint 链路**忽略 `cfg.imageSteps`，恒用 `IMAGE_SAMPLING.steps = 6`**。要离开训练态必须显式 `allowOffGridSteps: true`。`inpaintMeta` 新增 `stepsLocked: true` + `stepsReason`，与 `denoiseLocked` 对称；`steps` 回报的是真实生效值 6。 |
| 兼容性 | 普通出图路径（不传 `forInpaint`）行为完全不变 —— 已用 `cfg.imageSteps=8` 验证：generate 得 8、inpaint 得 6。 |
| 证据 | 组图用例「BasicScheduler steps 恒 6（尽管 cfg=8）」；selftest「inpaint steps 恒 6 / allowOffGrid 放行 / 夹 4..12」。 |

#### P1-4｜inpaint 的 LoRA 不走求解器【已修】

| 项 | 内容 |
|---|---|
| 文件 | `host/services/h3-inpaint.js:100-160`（`validateInpaintRequest` 内接 `solveImageLoraStack`）、`host/services/inpaint-graph.js:86-102`（改为**报错式断言**）、`inpaint-task.js`（传 `availableLoraFiles`） |
| 行为变化 | ① 入参阶段就调 `solveImageLoraStack({maxSlots: IMAGE_MAX_LORAS, hasRefImages:false})`，`accepted[].appliedStrength` 写回 `loras[].strength`；`replaced/degraded/rejected/warnings` **全部并入 `req.warnings`**（Agent 与 REST 都能看到）。② 组图期的 `Math.max(-2, Math.min(2, …))` 静默夹紧**删除**，改为越界即抛 `INPAINT_LORA_STRENGTH`。③ 传入 ComfyUI 的 loras 列表时探测文件列表，拼错的名字在求解阶段就被拒。 |
| 证据 | selftest：画风未给强度 → **0.8**（不再是 1.0）；滑块 5 → 求解器兜底到 2 **且 warnings 写明「模型只接受 [-2, 2]」**；画风单选取后者替换并写 warning；越界 9 → `INPAINT_LORA_STRENGTH`。组图用例「LoRA 强度取求解器的 0.8」。 |
| 未做 | `InpaintPanel` 的 `maxSlots` 已改为读 `meta.maxLoras`（原来是写死 6）。 |

#### P1-5｜切 tab 卸载 InpaintPanel 丢状态【已修】

| 项 | 内容 |
|---|---|
| 文件 | `app-src/src/pages/ImagePage.tsx:251-262` |
| 行为变化 | 两个面板**都常驻挂载**，用 `hidden` + `display:none` 切换。源图 / mask / 提示词 / LoRA / job / 轮询 effect 全部保留；MaskEditor 的三层 canvas 像素也不会丢（切回来不重载底图）。 |
| 备注 | 轮询仍在 `InpaintPanel` 内部（未按建议上提到页面级）。上提会动到 ImagePage 的两套轮询，属于 §4.1 的结构性重构，超出 M6 缺陷修复范围，已列为未修项。 |

#### P1-6｜meta 回报基准常量而非实际值【已修】

| 项 | 内容 |
|---|---|
| 文件 | `host/services/inpaint-graph.js`（返回值改为 `{workflow, applied}`）、`host/services/inpaint-run.js:198-230` |
| 行为变化 | `buildInpaintWorkflow` 把 `{featherRes, blur, grow, steps, denoise, loraMode, sampleEdge, sampleCanvas}` 挂在 `applied` 上；`runH3Inpaint` 用它填 meta。`meta.blur` 现在是 `blurForResolution(featherRes)` 的结果、`meta.grow` 是实际提交值、`meta.steps` 是 6。 |
| 证据 | 组图用例：`applied.blur = {radius:31,sigma:10}`、`applied.grow = 16`、`applied.steps = 6`、512 档 `applied.blur = {16,5}`。 |
| 附带 | 删掉了 `INPAINT_BLUR` 兼容别名（P2-6）——全仓除自身 meta 外无消费者，而它正是"meta 说谎"的来源。 |

#### P1-7｜"mask 外逐像素保真 0.0000" 失实【已修】

| 项 | 内容 |
|---|---|
| 文件 | `vendor/inpaint-nodes/VENDOR.md`（新增「保真范围（实测口径，别读错）」小节 + 验收表拆成两行）、`vendor/inpaint-nodes/__init__.py`（`ImageUncropByMask` 类文档） |
| 行为变化 | 统一改为「**bbox 之外**逐像素等于原图（0.0000）；bbox 之内、笔画之外的差异 ≈ 0.005（羽化尾部）」，并说明要做到 mask 外 0 改动需要换成未模糊的硬 mask。验收表增加「bbox 内侧」一行，测量范围不再含糊。 |
| 证据 | vendor 测试用例「bbox 外逐像素保真（差异 0.0000）」用硬 mask 验证块外 `max|diff| = 0.0`；「bbox 内、笔画外也被轻微改写」用软 mask 验证该区域 `max|diff| > 0`，即文档新口径。 |

#### P2｜值得做的四项

| 编号 | 改动 | 文件 |
|---|---|---|
| P2-4 探测缓存 | `probeInpaintNodes` 加 60s TTL 缓存，**只缓存成功结果**（失败即时重试，避免 ComfyUI 刚起好被误判）。`/image/inpaint/meta` 与 `studio_image action=meta` 不再每次吃 2×6s 超时；成功时回 `probeCached: true`。另导出 `resetInpaintProbeCache()`。 | `inpaint-run.js:28-90` |
| P2-3 画笔降频 | `MaskEditor` 的 `exportMask` 拆成 `exportMask`（立即）/ `scheduleExport`（**150ms 防抖**，用于 pointerup）/ `flushExport`（立即，用于撤销/清空/全选）。回灌 effect 增加**内容短路**：`loadedHashRef` 记录"画布内容对应的 dataURL"，自己刚导出的不再回灌一次，父组件 setState 不再引发第二轮全图 `getImageData + putImageData`。卸载时清定时器。 | `MaskEditor.tsx:57-80,108-275,360-390` |
| P2-2 tmp-inline 清理 | 新增 `cleanTmpInline(cfg, {keepAbs, ttlMs})`：staging 成功后回收本次 mask + 超过 24h 的残留（素材库 orphan 扫描只看 `assets/`，这个目录此前只进不出）。失败不影响出图。 | `inpaint-run.js:92-130,190-196` |
| P2-12 maxCrop 入口 | `InpaintPanel` 新增「选区上限（maxCrop）」输入（仅 crop 模式），与提示文案联动显示"当前选区需要多少、会被缩到多少"。同时把 P2-5 的前端 `estimateRes` 补齐 `maxMP` 面积夹取，夹取顺序与后端 `autoCropResolution` 一致。 | `InpaintPanel.tsx:300-350,520-550` |

#### P3 顺带修正（落在 M6 文件内）

| 编号 | 改动 |
|---|---|
| P3-6 / P3-7 | `inpaint-params.js` 的 auto 注释改为「bbox **长边** × 1.5」（原先写"短边<683"，且数值例子 450→480 实际是 448，已删掉具体数字）。 |
| P2-9 | `resolutionHint` 改为「按 bbox **长边** × 1.5」（原先写"按笔画面积反推"，与本文件算法自相矛盾）。 |
| P2-10 后半 | `crop.resolutionId='auto'` 与 `crop.baseResolution` 同时给 → 直接 400 `INPAINT_BAD_CROP`（原先静默丢弃 baseResolution）。前半（`align32` 静默四舍五入 vs 文档写"必须 32 倍数"）未动 —— 那条描述在 `tools.js`，不在我的文件边界内。 |
| P3-8 | vendor `_bbox_from_mask` 的 docstring 统一为 `(x0, y0, w, h)`（内部约定），`crop()` 输出与 uncrop 消费统一 `(x0,y0,x1,y1)`，两处都写明了。 |
| P3-9 | `VENDOR.md` 的「行为」段补齐「采样长边 = min(base, maxCrop)，整块等比缩放，不裁剪」。 |

### 6.2 结构拆分（报告 §4.2 第 1 条）

`h3-inpaint.js` 从 1002 行拆成 4 个文件，**导出名全部保留**（`import { ... } from './h3-inpaint.js'` 无需改动）：

| 文件 | 行数 | 职责 |
|---|---|---|
| `inpaint-params.js` | 207 | 常量 + 纯数学：`blurForResolution` / `autoCropResolution` / `estimateBboxFromStroke` / `estimateCropBlock` / `cropSampleEdge` / `sampleCanvasFor` / `inpaintStrength`。**零 IO，可单测。** |
| `inpaint-graph.js` | 246 | `buildInpaintWorkflow`（crop / full 两条分支），返回 `{workflow, applied}`。 |
| `inpaint-run.js` | 275 | `runH3Inpaint` / `inpaintMeta` / `probeInpaintNodes`（带缓存）/ `cleanTmpInline` / `resetInpaintProbeCache`。 |
| `h3-inpaint.js` | 386 | 入参校验（`validateInpaintRequest` / `guardFullCanvas` / `resolveCropResolution` / `resolveStrokePixels`）+ 兼容 re-export。 |

验证：`node -e "import('.../h3-inpaint.js')"` 确认 23 个历史导出名全部存在，`INPAINT_BLUR` 别名已消失。

### 6.3 注释清理

删掉全部「历史缺陷（P1，审查发现）」「旧实现……」「⚠️⚠️」「修复前是……」这类讲述修改史的段落，
只保留「为什么必须这样」的当前约束（原始复盘内容已在本审计报告的三、四章存档）。
新写的文件不再出现"曾经/历史/修复前"字样。

注释占比（注释行 / 总行数，含空行）：

| 文件 | 修前 | 修后 |
|---|---|---|
| `h3-inpaint.js` | ~48% | 26% |
| `inpaint-params.js` | （新） | 38% |
| `inpaint-graph.js` | （新） | 28% |
| `inpaint-run.js` | （新） | 27% |
| `inpaint-task.js` | 41% | 29% |
| `image-dims.js` | 43% | 36% |
| `MaskEditor.tsx` | 30% | 22% |
| `ImagePage.tsx` | 14% | 10% |
| `vendor/__init__.py` | 33%（按 tokenize 计） | 27% |

后端文件仍在 26–38%，未压到 15% 以下。原因：这些文件里带实测数据的"为什么"（blur 31 是节点上限、
bbox 不能被裁、latent 格恒 16px、夹取顺序不能改）如果删掉，下一次改动极可能踩回原来的坑，
而审计报告 §4.3/§5 也把"注释把为什么讲清楚"列为本模块的优点。取舍是按"删历史叙事、留当前约束"执行，
条目化的实测表格搬到了本报告与 `VENDOR.md`。如需强制到 15%，剩余可压缩的是各函数的 JSDoc 参数说明。

### 6.4 未修项及原因

| 编号 | 项 | 原因 |
|---|---|---|
| **P1-1** | `tools.js` 的 inpaint 编排副本 | **不在我的文件边界内**（任务明确要求不碰 `host/tools.js`）。当前状态：另一修复者已把它改为调用 `prepareInpaint` / `inpaintSubmitSummary`（`tools.js:926-975`），并传了 `onProgress`。但 **Agent 入口不会得到 P1-4 的 LoRA 求解之外的额外差异**——因为求解已下沉到 `validateInpaintRequest`，两个入口自动同源。需确认的点：`tools.js` 传的是 `{ projectId }`，与 `prepareInpaint` 的语义一致 ✅。建议该修复者补一条：`studio_image action=meta` 的 `inpaint` 段现在多了 `stepsLocked` / `maxLoras` / `blurForDefaultRes`，无需改动即自动透出。 |
| P2-1 | `assertImageSizes()` 接入启动 | 不在 M6 缺陷清单优先级内，且启动期自检属 `host/index.js`（超出边界）。 |
| P2-5 全量 | 前端 `estimateRes` 与后端公式合一 | 已补齐 `maxMP` 与夹取顺序（**数值现在一致**），但仍保留两份实现。彻底合一需后端下发公式或预置表，属结构性重构。 |
| P2-8 | ImagePage 拆块 | 结构性重构，超出本次缺陷修复范围；本次只做了 P1-5 的常驻挂载。 |
| P2-11 | history 网络错误快速失败 | 在 `comfy-client.js`（跨模块共用），不在 M6 边界内。 |
| §4.1-2 | 两套轮询合一 | 见 P1-5 备注。 |
| §4.3-3 | 仓库里的 `vendor/inpaint-nodes/__pycache__` | 目录当前不存在（已被清理或从未提交），无需处理。 |
| 前端构建产物 | `app-dist/` 已重建 | 旧哈希 `index-CdFChX8T.js` 已删除，新产物 `index-x9DHqggx.js` 已生成；`index.html` 指向正确。**注意**：重建是全量覆盖，若其他修复者同时改了 `app-src`，需要最后一次统一重建。 |

### 6.5 验证

| 项 | 方式 | 结果 |
|---|---|---|
| 语法 | `node --check` × 7 个改动的 js + 全 `host/**.js` 扫描 | 全部通过 |
| 纯函数 | 临时脚本（`%TEMP%`，未入库）：`validateInpaintRequest` / `resolveCropResolution` / `autoCropResolution` / `blurForResolution` / `normalizeCanvasSize` / `estimateCropBlock` / `sampleCanvasFor` / `effectiveImageSteps` 边界值 | **119/119** |
| 组图 | 临时脚本：crop / full 两条分支的节点接线、steps 锁 6、blur 缩放、grow 不缩放、LoRA 强度与越界报错、4 档强度 | **41/41** |
| 编排 | 临时脚本：`prepareInpaint` 端到端（真实 PNG 文件 + 真实 dataDir）：mask 尺寸校验、full 32 守卫与放行、crop 非 32 放行、大选区 warning、提交摘要字段、探测缓存、tmp-inline 清理、LoRA 求解 | **31/31** |
| vendor | 临时脚本（ComfyUI venv 的 torch）：2000×300 长笔画在 maxCrop=1024 下 bbox 完整、250² 全图不被截、minCrop+padding、空 mask / 空 bbox / 退化 bbox 报错、bbox 外 0.0000 保真、bbox 内软 mask 被改写、batch=2 | **17/17** |
| 前端类型 | `tsc -p app-src/tsconfig.json --noEmit` | 通过 |
| 前端构建 | `vite build` | 成功；产物内含新 UI 文案（已 grep 确认） |
| 兼容性 | 普通出图 `effectiveImageSteps(cfg)` 不受影响；`h3-inpaint.js` 23 个导出名齐全 | 通过 |

合计 **208 条断言全绿**，未在仓库留下任何测试脚本。

### 6.6 需要下游注意的两处契约变化

1. **`full` 模式新增拒绝路径**：`POST /image/inpaint` 在 `mode: 'full'` + 源图非 32 倍数时返回
   **400 `SOURCE_NOT_ALIGNED`**（此前静默出图）。Agent 工具与前端都会透出该 code；
   前端 `InpaintPanel` 已在选源图时提示"full 模式会被裁成 W×H"。
2. **`/image/meta` 的 `steps` 与 `/image/inpaint/meta` 的 `steps` 现在是两个值**：
   前者为配置值（可为 4/8/12），后者**恒为 6**（新增 `stepsLocked: true`）。
   前端 `ImagePage` 的徽章仍读 `/image/meta`（正确），`InpaintPanel` 的说明文字已改为
   "配置里的 imageSteps 在重绘上不生效"。
