# 变更日志

本文件记录九章工作室插件的所有重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

---

## 4.1.0 — 画风锚通道 + 图像提示词编译器 + 分级重绘（2026-11-26）

> 补齐三件此前完全缺失的能力：**用参考图控画风**、**中文/短需求自动展开成完整描述**、
> **选区可按强度分级重绘**。同时修掉调研与实测中暴露的若干真缺陷。
>
> 调研依据见 `docs/research/`（3 份）；使用说明见 `docs/H3-IMAGE-提示词编译器.md`。

### 一、画风参考图（style anchor）—— 独立通道

调研结论：H3-Image 只有三条画风通道（提示词画法词 / 参考图 / LoRA），**没有任何 style 参数**，
负面提示词**不存在**（cfg=1）。其中「参考图」最强且零成本，但最容易翻车 ——
模型会把参考图里的人和物一起搬过来。

- `appendStyleAnchors()`：画风锚**永远追加在参考图末尾**，绝不占用 `image_1`
  （`image_1` 决定输出画布且是被编辑的原图，画风图排到第 1 位会带偏尺寸 / 抢占编辑对象）
- `style-anchor.js`：生成「只借画法、不复制主体 / 构图 / 镜头」的提示词片段，
  分 `style-only` / `style+palette` 两种模式、`light/medium/strong` 三档措辞，
  并按「接 VAE（像素级约束）/ 不接 VAE（只经文本编码器）」说不同的话
- 前端新增独立「画风参考图」面板，与参考图分开管理；含提示词写法示例与三条常见错误

### 二、图像提示词编译器 `host/services/image-prompt/`（6 文件）

补上官方模板有、而我们没有的 prompt expander（PE）。规则 + 词典 + 模板，**不调外部模型**。

- `expand.js`：中文 → 官方八段顺序的完整英文描述
  - **按角色重排语序**：「穿红裙的少女」→ `a young woman wearing a red dress`（不是逐字直译）
  - 主体 / 场景以「实质场景词」为界切分，裸介词不算起点（否则产出 `in the wind` 这类错句）
  - 未翻译的词**原样保留中文**并交给 lint 告警，不转拼音、不瞎编
  - 中文压测 **20/20** 纯英文、≥2 段、不超长
- `anti3d.js`：2D 画风的「反 3D 化」约束
  - 先**挖掉** `NOT 3D` 这类否定表述再判定 —— 否则 9 个 2D 画风会被自己的禁令判成 3D，正好判反
  - 9 个 2D 画风注入、2 个 3D 画风（ufotable / toon3d-pbr）不注入
- 强制英文：`rawPrompt` 已是完整英文长描述时**不重写**（只做 lint + 反 3D 注入），
  避免覆盖用户已定好的细节

### 三、分级重绘（模型原生支持，此前完全没暴露）

mask 的灰度 = 该像素的去噪强度（源码 `model.py` 的 `rows_t = 1 - m * sigma`）。

- 五档按实测校准：`full 1.0 / strong 0.85 / medium 0.7 / light 0.55 / keep 0`
  （0.5 以下落在 PDD 头交界处会塌陷，实测改动量只有 1.0 的 2.5%）
- `graded=true` 时跳过 `GrowMask`（它按邻域取最大值，会把档位交界抹平、让强档向外吞并），
  羽化压到 1/3，贴回权重先二值化（否则 0.55 的灰度会把强度算两次）
- 前端：画笔带强度（0–100%）、覆盖层深浅随强度变化、档位预设按钮、
  一键对已有选区降档、分级图例、可折叠使用说明

实测：mask 值域保留 `255/216/178/140`（非分级链路全被压成 255）；
改动量 `1.0→49.08 / 0.85→33.97 / 0.7→5.07 / 0.55→2.31` 单调递减；
非分级路径 8 条 workflow **逐节点 IDENTICAL**，产物逐像素差 `0/0`。

### 四、修复的缺陷

- **P0｜分级提交必 500**：`inpaintSubmitSummary()` 引用了另一个函数作用域里的局部变量
  `maskIntensity` → `ReferenceError`，且在 `try/catch` 之外。
  改为随 `prepareInpaint()` 返回值传递。（重启后实测才暴露，静态检查抓不到）
- **P1｜「招牌的霓虹」与「画面无文字」自相矛盾** → 模型画出假名乱码招牌。
  三次迭代定位：单靠一句 `contains no text` 压不住（招牌在训练数据里几乎总带字）。
  改为命中霓虹 / 招牌 / 海报等题材时用**强化声明**（逐项点出这些表面应为纯色），
  并把霓虹措辞避开 `signage` 名词。实测招牌只剩纯色光块，无任何文字。
- **P1｜`/image/meta` 缺 `inpaint` 子对象**：前端分级面板需要的 `gradedLevels` 不在其中。
- **P2｜lint 误报**：画风预设自带的 `masterpiece` / `cinematic` 被算成用户写的 → 只看用户输入部分
- **P2｜anti3d 状态语义**：写实画风曾报「已注入」，改为三态（`true` / `false` / `null`）

### 五、接线

- REST `/image/generate` 与 `studio_image` 新增 `text` / `styleId` / `styleAnchorImages` /
  `styleAnchorMode` / `lettering` / `negativeHints` / `compile`；
  响应带 `compiled` + `promptWarnings`
- `/image/meta` 与 `studio_image` 的 meta 带出 `promptCompiler`
  （画风表 / 段落 / 画风锚说明 / 反 3D 判定）与 `inpaint`（含分级档位）
- `studio_image` schema 补 `graded` / `gradedLevel`（原 `additionalProperties:false` 会拒收）

### 验证

语法 **97/97** · 全部 96 个 host 模块可 import · `tsc` 通过 · `vite build` 成功 ·
`apply()` 14 工具 · 图像 9 条路由全通（含分级 / 非分级 / 缺 mask 三条分支）·
**视频侧编译回归 22/22 无变化**（编译器与视频侧零耦合，只读引用 `styles.js` 的数据表）·
重启后插件 `fiberPhase: active`

---

## 4.0.0 — 全量审计与结构重构（2026-11-26）

> 彻底重审并重构。四层架构不变，但**模块边界、代码归属、数据管线全部重划**。
> 修复 11 个 P0、52 个 P1；拆分三个千行单体；清空全部运行时数据；
> 删除全部测试脚本与 12 份失效文档。
>
> 完整报告见 **[docs/audit-v4/](docs/audit-v4/)**（框架 + 4 份分模块审查/修复记录 + 总结）。

### 结构重构（模块不再混在一起）

- **REST 层**：`host/api/index.js` 从 **2819 行巨型 if 链**拆成 84 行分发器 + `routes/` 下
  11 个域 router（meta / nanfeng / generate / projects / prompt / image / vault /
  media / blender / replace / toolbox）。路由清单拆分前后逐条 diff，**141 = 141 零差异**。
- **提示词编译器**：`h3-prompt.js` 从 **2021 行**拆成 9 个文件（门面 / spec / route /
  styles / ref2va / base / shot-adapter / lint / text-utils）。
  用 6 份真实镜头卡验证：**5 份逐字符 IDENTICAL**，导出符号 LOST = 0。
- **局部重绘**：`h3-inpaint.js` 从 **1002 行**拆成 params / graph / run / 门面 4 个文件，
  23 个导出名全保留。重绘节点图与普通出图彻底分离。
- 新增 `host/api/errors.js`（128 个错误码全覆盖）、`host/api/backend.js`、
  `host/api/image-task.js`（REST 与工具共用的提交编排）。
- `host/python/`：本地翻译服务从 `tools/` 迁入（它是运行时依赖，不是测试）。

### P0 修复（静默错误结果 / 数据丢失 / 崩溃 / 安全）

1. **串脸**：`resolvePictureIndices` 用 `i+1` 冒充槽位号，`fl2va` 下 `<Picture 1>` 指向首帧
   而角色卡实际在 3/4 号槽。改为统一取 `planImageSlots` 的 `pictureIndexMap`，
   并把 previz 首尾帧一起传入。**三套编号实现合一。**
2. **seed 不生效**：南风链路所有任务用同一个种子。`job.params.seed` 现在真正透传到
   `extraParams['随机种子']`，并写入参数快照可见。
3. **批次数据丢失**：`continuation.js` 沿用「先删目标再 rename」，失败时批次 JSON 整份消失。
   改为不删目标的原子写策略。
4. **参考图静默丢失**：上传名只哈希 basename + `overwrite=true`，同 job 内同名互相覆盖。
   改为含内容哈希、取消强制覆盖。
5. **陈旧编号压过权威值**：镜头卡残留的 `subjects[].pictureIndex` 现在会被丢弃并写 warning。
6. **Agent 局部重绘必崩**：130 行手抄编排调用了 5 个未导入的函数。改为共用
   `prepareInpaint` / `inpaintSubmitSummary`。
7. **选区内涂区不重绘**（vendor）：`max_crop_resolution` 把 bbox 当裁剪窗口上限，只平移不缩小，
   超出部分永不重绘且文案谎称"被缩小"。改为保留完整 bbox，maxCrop 只封顶采样分辨率。
8. **full 模式 mask 错位**：非 32 倍数源图被 VAE 静默居中裁剪。现在直接 400
   `SOURCE_NOT_ALIGNED`（显式 `fullCanvasTrim:true` 可放行并写 warning）。
9. **SVG 同源存储型 XSS**：`/jiuzhang/assets/*.svg` 以 `image/svg+xml` 内联返回，
   而该源挂着全部写接口。现在强制 `attachment` + `text/plain` + `nosniff`。
10. **归档白名单可绕过**：Windows 尾随点 / ADS / 大小写。改为逐段规范化比较。
11. **图像功能整机不可用**：显存探测失败返回 `{ok:false, freeBytes:0}`，被当成真的 0 GB。
   改为先判 `vram.ok`，探测失败则跳过闸门。

### P1 修复（功能失效 / 违反契约）

续写 `contextLength` 不透传、`runBatch` 无租约/CAS 导致永久卡 running、批次超时 1h/2h 冲突、
`queued` 僵尸任务、取消与完成竞态丢产物、inpaint 不走 LoRA 求解器、
`meta` 回报基准常量而非生效值、`GrowMask` expand 误随分辨率缩放、
`ImagePage` 切 tab 卸载面板丢状态、`qc`/`reencode`/`timeoutMs` 双入口偏差、
`backends` 同名不同型、Agent 出图不归档、Agent 生成丢 lint 警告、
66 个错误码落 500、续写批次可被双 POST 双跑、tmp 名含 pid 并发冲突、
`edit.js` 裸写盘、`lora` signed 强度不夹、`writeShots` 零校验、
`monitor` 最坏 10s、SSE 死连接残留、9 处 `.catch(()=>{})` 吞失败。

### 清理

- 删除**全部测试脚本**：`smoke-api.mjs`(3608 行) / `check-routes.mjs` / `audit-params.mjs` /
  `preview-server.mjs` / `verify-edit.mjs`，`tools/` 目录整个移除；
  `package.json` 的 4 个测试 script 同步删除。
- 删除工作区垃圾：两个 shell 事故残留文件、`_audit_run/`（224 文件 / 11 MB）、
  `vendor/nanfeng/_removed/`（5 个历史模块）、全部 `__pycache__/`。
- 删除 **12 份失效文档**（含主张 denoise=0.85 与实现相反的 `INPAINT-RESEARCH.md`、
  仍写"代码未开始实现"的 `INPAINT-PLAN.md`、6 份旧审计、阶段性交付报告等），
  docs/ 从 24 份精简到 10 份。
- **清空全部运行时数据**：`data/` 从 416 文件 / 775.3 MB → 只留 2 个工作流模板
  （素材库、任务列表、项目列表、输出、中间产物全部删除）。
- 清理全部**重构叙事注释**（"历史缺陷/旧实现/曾经…"），全仓归零；
  注释密度：h3-prompt 家族 41.5% → 14.6%。

### 验证

全量语法 91/91 · `tsc --noEmit` 通过 · `vite build` 成功 ·
`apply()` 冒烟 14 工具全注册 · 真实 HTTP 冒烟 12 条路由全 200 + 404 正确 ·
写令牌闸 403/200 正确 · 串脸 P0 端到端复验通过 · SVG 不再内联 · inpaint 端到端建 job 成功。

> ⚠️ 需**重启 DSH** 生效（改了 `inject` 相关路径与 `app-dist` 全量重建）。

---

## 3.4.0 — 局部重绘 Phase 1–4 完成 + 全量代码审查修复（2026-11-25）

> 本版新增 H3-Image 局部重绘（画笔涂抹 + crop&stitch），并对「图像生成 + 局部重绘」
> 全部代码做了一次独立审查（backend / frontend / vendor 三处），修掉 3 个 P0、8 个 P1，
> 补 10 条冒烟断言。冒烟从 208 项增至 **255 项**。
>
> 关键设计约束（都由真机实测确立，不是猜测）：
> 1. **denoise 必须锁 1.0** —— PDD 只有 6 个预测头，`denoise<1` 会让
>    `BasicScheduler` 的 `int(6/denoise)` 错配网格，实测 0.5 时只剩 3 个头工作，
>    表现是"选区被抹平、不按提示词生成"。
> 2. **改动强度用 `SplitSigmas` 切片**（full/strong/medium/light），实测 121/86/50/28 单调递减。
> 3. **mask 尺寸必须与源图一致** —— ComfyUI 会静默 bilinear 拉伸，区域整体偏移。
> 4. **宽高必须 32 的倍数**（latent 16× × patch 2×）。

### P0 修复（会产生错误结果且不报错）

**1. mask 回灌污染 alpha 通道 → auto 分辨率静默失效**
[`MaskEditor.tsx`](dsh-jiuzhang-studio/app-src/src/components/MaskEditor.tsx)
`exportMask()` 导出的是**黑底白区的不透明 PNG**（这对后端 `ImageToMask(red)` 是正确的），
但 `value` 变化时又把它 `drawImage` 回 mask 画布 —— 画布 alpha 从"白笔迹+透明底"变成全 255。
后果链条：`refreshOverlay` 的红层盖满整幅图 → 覆盖率永远 100% →
bbox 变成整幅图 → 传给后端的 `bboxW/bboxH` 是整幅图 →
auto 分辨率被顶到 `maxCrop`，**小选区自动放大 1.5× 的设计彻底失效**，
还会显示一条莫名的"笔画会被缩小"警告。提交出去的 mask 本身仍正确，所以**不报错、只出坏质量**。
> 验证：模拟同一条链路，旧实现覆盖率 3.05% → **100%**、bbox 50×40 → **256×256**；
> 新实现完全一致且**幂等**（多笔操作不累积漂移）。
修法：回灌时按亮度重建 alpha（`d[i+3] = d[i]`），保持画布"白+透明底"的干净状态。

**2. 显存闸把"探测失败"当成"空闲 0 GB" → 图像功能整体不可用**
[`h3-image.js`](dsh-jiuzhang-studio/host/services/h3-image.js)
`vramStatus` 在任何失败（ComfyUI 没起 / 老版本无 `devices` / 非 NVIDIA / 超时）都返回
`{ ok:false, freeBytes:0 }`，而判断只有 `Number.isFinite(freeGb) && freeGb >= 0 && freeGb < floorGb`
—— `0` 是有限数且 `0 < 1.44`，**三个条件全真** → 每次出图都报「空闲显存仅 0.00 GB」并 400 拒绝。
Fallback 还缓存 10 秒，用户连点都失败。这与该段注释"宁可放过，不要误伤"完全相反。
修法：先用 `if (vram?.ok)` 判探测成功，失败则**跳过闸门**，让 ComfyUI 报真正的 OOM。

**3. `studio_image action=inpaint` 完全没有 mask 尺寸校验**
[`tools.js`](dsh-jiuzhang-studio/host/tools.js)
校验只写在 REST 路由里，Agent 入口没有 —— 而 Agent 恰恰最容易传错尺寸。
传一张 1024² mask 配 2048² 源图时，ComfyUI 静默拉伸、区域偏移、不报错。
修法：抽出 [`services/image-dims.js`](dsh-jiuzhang-studio/host/services/image-dims.js)
（`probeImageDims` / `resolveInpaintSizes` / `maskMismatchMessage`），两个入口共用；
尺寸读不出来时（AVIF/HEIC）**明确告警**而不是静默放行。

### P1 修复

| # | 问题 | 修法 |
|---|---|---|
| 4 | LoRA 强度不夹紧：传 5 实际是 2，但 `loraStack` 报 5、无警告 | 求解器里按分类范围 + [-2,2] 夹紧并 push `degraded` |
| 5 | inpaint 写死 `LoraLoaderBypassModelOnly`（老版本 ComfyUI 没这个节点 → 必失败） | 抽 `probeBypassLora` / `bypassLoraFallbackWarning` 共用，探测后决定并回退 |
| 6 | inpaint 的 LoRA 缺省强度变 `NaN` → 落到 1.0（普通出图是分类默认 0.8/0.85）；超量静默切片 | 保留 `undefined` 交给求解器；超量 push warning |
| 7 | 只传 `baseResolution` 被静默当 auto | `baseResolution` 存在时 `resolutionId` 默认 `'manual'` |
| 8 | `padding:"abc"` → `Math.max(0, NaN)` = **NaN** → JSON `null` → ComfyUI 报无关错误 | `Number.isFinite` 兜底 + 夹到 `MAX_CROP_PADDING=4096` |
| 9 | `strength:"lightt"` 实际跑 medium，但 `strengthId` 回原串 | 统一取规范化后的 `strength.id` |
| 10 | `/image/inpaint/meta` 的 `maxMP` 硬编码 4.3（用户调到 8 后仍报 4.3） | 改用 `effectiveMaxMP(cfg)` |
| 14 | `/image/progress` 每 1.5 秒**全量读 jobs.json**；且不回 warnings | 改为逐个 `store.get`；回传 `warnings` 与 `cropResolution` |

### vendor 节点修复

**16. 32 对齐会把 bbox 夹到比 mask 更小 → 贴边笔画被裁掉**
源图宽 250（非 32 倍数）、mask 横跨全宽时：`min(align32(250), 250-(250%32))` = `min(256, 224)` = 224，
于是**整图 mask 也只截到 224×224，边缘 12 像素被排除**，不报错。
根因是把"采样画布要对齐"错误套用到"裁剪块"上 —— 真正必须 32 对齐的是喂给 VAE 的 `tw/th`（已对齐）。
修法：裁剪块只受画布边界约束，对齐交给 `tw/th`。验证：250×250 全图 mask 现在 bbox = `(0,0,250,250)`。

**17. bbox 类型协商**：空 bbox 会走 Python 负索引（`boxes[-1]`）静默取错位；文件内文档三处互相矛盾。
修法：空 bbox 显式抛 `INPAINT_BAD_BBOX`；`source` 与 `mask` 尺寸不符抛 `INPAINT_STITCH_SIZE`（原来是静默用 mask 尺寸）。

### Phase 4 多场景验收（8 场景 / 真实图片 / 全部通过）

| 场景 | 源图 | 产物尺寸 | crop 分辨率 | 耗时 | mask 外差异 | 外>2% |
|---|---|---|---|---|---|---|
| A 小方块 400×300 | 2368×1776 | 2368×1776 ✅ | 608 | 57.6s | 0.025 | 0.28% |
| B S形水流 | 2368×1776 | 2368×1776 ✅ | 1024 | 77.7s | 0.055 | 0.51% |
| C 贴边 300×300 | 2368×1776 | 2368×1776 ✅ | 448 | 70.1s | 0.006 | 0.05% |
| D 极小 50×50 | 2368×1776 | 2368×1776 ✅ | 256 | 57.6s | 0.016 | 0.14% |
| E full 模式对照 | 2368×1776 | 2368×1776 ✅ | — | 95.1s | 4.167 | 59.30% |
| F 横图椭圆 | 2560×1440 | 2560×1440 ✅ | 896 | 72.7s | 0.023 | 0.22% |
| G 竖图 400×500 | 1600×2816 | 1600×2816 ✅ | 736 | 57.6s | 0.022 | 0.22% |
| H 大选区 55% | 2368×1776 | 2368×1776 ✅ | 1024 | 50.1s | 0.000 | 0.00% |

**关键结论**：
- **所有场景尺寸都保持**，包括非 32 倍数的 2368×1776（ComfyUI 的 pad/unpad 对称）
- `crop` 模式的 mask 外差异 **0.006–0.055**，>2 像素占比 **0.05–0.51%**（逐像素保真）
- `full` 模式同 mask 下 **59.30%** 的选区外像素被改动 —— 这是该模式固有特性，不是 bug
- 大选区（H）正确触发 warning 且**实际改动仍严格限制在选区内**（0.000 / 0.00%）

### 新增冒烟断言（10 条）

denoise 锁 1.0、强度档是 SplitSigmas、`strength` 非法值规范化、缺参报明确码、
32 倍数与面积上限、mode 枚举、latent 必须来自 VAEEncode（不能用 zeros）、
crop 注入 vendor 节点 + 羽化链、vendor 节点可探测、无未替换占位符、
画笔算法契约（Catmull-Rom alpha=0.5 + remainder 续接）、
MaskEditor 三层 canvas + 尺寸锁定 + 撤销栈按**内存预算**（不是固定步数）、
InpaintPanel 不给 denoise 滑块、auto 分辨率按 bbox 长边（不缩小笔画）、
大选区缩小有 warning、显式档位不被覆盖、
**显存闸必须先判 `vram.ok`**、**REST 与工具层共用 mask 尺寸校验**、
**padding 非法值兜底**、**只传 baseResolution 视为手动档**、
**LoRA 节点类型探测**、**LoRA 缺省强度保留 undefined**、**超量 LoRA 有 warning**、
**meta.maxMP 用生效值**、**progress 回传 warnings 且不全量读盘**。

### 性能修复

- `MaskEditor` 的 `refreshOverlay` 原来在**每个 pointermove** 都 `getImageData(0,0,W,H)`
  （2048² = 16MB × 60Hz），实测拖动卡顿 → 覆盖率统计移出高频路径，
  与 bbox/strokePixels 复用**同一次** `getImageData`。
- 撤销栈从「固定 10 步」改为「**96MB 内存预算**」：
  1024² 存 24 步、2048² 存 6 步、4096² 存 1 步（固定 10 步在 4096² 是 671MB，会拖死标签页）。

---

## 3.3.0 — 图像生成从「只有文本框」补齐到可用（2026-11-24）

> 背景：H3-Image 的底层节点其实支持「文生图 + 最多 100 张参考图的编辑/融合 + 自动继承参考图尺寸」，
> 但插件只用了其中一小部分 —— 前端只有「一个文本框 + 一个尺寸下拉 + 一个种子」，
> 参考图、批量、LoRA、风格、进度全部丢在地上。本轮把这层接口补齐，同时修掉 3 个静默错误。

### 修复：静默错误（P0）

- **尺寸表里有 3 个档位不是 32 的倍数，实际出图与请求不符**（`services/h3-image.js`）。
  节点按 `height//16` 取 latent、再按 `patch_size=(1,2,2)` 打块，非 32 倍数会被
  `pad_to_patch_size` 补边 —— 实测请求 `2368×1776` 产出 **2368×1792**。
  现在 `p-4x3`→`1792×2368`、`l-4x3`→`2368×1792`、`ecom-45`→`1824×2304`、`comic-page`→`1792×2368`，
  并新增 `assertImageSizes()` 在启动/测试期自检（`mp` 与几何不符也报）。
- **超长提示词被静默 `slice(0, 4096)`**（`normalizeImagePrompt` + `/image/generate`）。
  这是"改了提示词却没生效"最隐蔽的形态：末尾那句"换成红色礼裙"被切掉，出图没变化且无报错。
  现在路由层先校验，超长 → **400 `PROMPT_TOO_LONG`**（带 `chars`/`maxChars`），
  `normalizeImagePrompt` 只断言不截断。前端也不再显示"会被截断"这种已知会撒谎的文案。
- **`/image/meta` 回的步数与实际提交不符**。原先 `sampling.steps` 是常量 6，
  而实跑读 `cfg.imageSteps`（夹 4–12）。现在新增 `effective` 段回真实生效值 +
  `stepsOverridden`（配置是否覆盖了默认）。

### 新增：参考图 / 编辑模式（此前前端完全没有入口）

- 后端 `services/ref-images.js` 新增 `resolveImageEditRefs()` —— **保序、上限 16、
  `image_1` = 被编辑的原图**。它与视频的 `resolveRefImages`/`planImageSlots`（9 槽 + 首尾帧保留）
  **并列而不合并**：图像编辑的次序本身就是语义，按视频那套"角色卡优先"重排会把编辑对象换成别的图。
- `MAX_IMAGE_EDIT_REFS = 16` 与 `MAX_REF_IMAGES = 9` 在同处声明并注明为何不是同一个概念。
- 解析失败的参考图**不静默丢**：返回 `bad[]`（含失败原因），路由在请求期回 400/警告。
- 前端新增参考图区：**拖拽 / 粘贴上传**（走 `/assets/upload`，不用 dataURL 撑爆 jobs.json）、
  **缩略图 + 序号 + 上下移动 + 删除**，第 1 张打「编辑目标」角标，并提示可用 `<Picture N>` 引用。
- 产物可「继续编辑这张」一键填回参考图第 1 位，形成迭代环。

### 新增：批量出图

- `count: 1..4`。**不是一次采样出 N 张** —— `comfy/ldm/minimax/model.py` 的
  `MiniMaxH3ImageModel._forward` 硬性 `raise ValueError("MiniMax H3 supports batch size 1")`。
  所以拆成 N 个独立任务，种子按 `seed+1` 递增（`splitBatchSeeds`），并回报 `jobIds[]` / `batchId`。
- 新增 `GET /image/progress?ids=` 轻量轮询端点（只回 status / progress / 产物 rel，
  比 `/jobs/:id` 小一个数量级 —— 后者含 prompt 全文与 221 参数快照）。

### 新增：出图进度

- `services/comfy-client.js` 新增 `queueStatus()`，`runWorkflow` 支持 `onProgress`。
  单张 4.2MP 实测约 **148 秒**，此前这两分半里 UI 只有"进行中"三个字（history 只在跑完才出条目）。
  现在分三态：排队（含前面还有几个）→ GPU 生成中 → 正在取回产物，写进 `job.params.progress`。
  进度是尽力而为，写失败不影响出图。

### 新增：图像 LoRA（独立于视频那套）

- 新的 `services/h3-image-lora.js`：只保留图像真的有的 **5 个轴**
  （画风 / 画质细节 / 角色 / 滑块 / 概念），**刻意不复用**视频的 11 类目 ——
  视频那套里加速蒸馏 / 运镜 / 动作 / 音色在图像上都不存在
  （H3-Image 的 DiT 是 H3 视频去掉 audio stream 的子类；且 Civitai 上图像加速 LoRA 数量为 0）。
- 目录约定 `models/loras/h3img/<分类>/`：**只有这个前缀下的文件才会出现在图像页**。
  这是唯一可靠的隔离手段 —— 图像与视频 LoRA 的 safetensors **键集完全相同**
  （实测 416 键逐一相同，只有 rank 不同），光看文件名分不出来。
- 求解器 `solveImageLoraStack`：画风/角色单选（回报"替换了谁"）、多挂类按 `stackDecay` 递减、
  总强度 >1.5 警告 / >1.8 剔除最弱，外加两条图像特有冲突
  （**画风 × 角色**、**角色 × 参考图**）。文件不在 ComfyUI 的 loras 列表里 → 组装期拒掉。
- workflow **模板不加节点**：运行时注入 `LoraLoaderModelOnly`（节点号 40..45），
  并把 `BasicScheduler.model` 与 `BasicGuider.model` **两处都改指向** ——
  只改一处会变成"sigma 网格来自裸模型、去噪来自打了 LoRA 的模型"，不报错但画质悄悄变差。
- 前端 `components/ImageLoraPicker.tsx`：分类分组 + 单选/多选 + 强度滑块 + 触发词提示；
  约束规则**只走后端**（前端不重复实现衰减，避免漂移）。
- 新增 `GET /image/lora/catalog`、`POST /image/lora/solve`。

### 新增：自定义尺寸与参数面板

- 宽高自定义（**必须成对 + 32 倍数 + 边长 ≥256**），前端实时校验，后端 `validateImageRequest` 再校验一次。
- **不提供步数/guidance 滑块**，并在 UI 说明原因：`pdd_steps: 6` + `pdd_sigmas` 写死在
  checkpoint 元数据里，6 步正好每步用一个 PDD 预测头；4/12 步属于分布外。`effective.samplingLocked` 表达这条约束。
- 种子 + 复制上次参数；`sizeForPurpose()` 从死代码接上用途参数。

### 实测验收（真机，w4a8 / RTX 4080 Laptop 12GB / ComfyUI 0.45.0）

本轮改造在**真实 ComfyUI 上跑通了三组出图**（不是只跑单测）：

| 场景 | 结果 | 耗时 | 关键验证 |
|---|---|---|---|
| 文生图 1024×1024 | ✅ PASS | 66.3s | 产物实测 **1024×1024**（32 倍数对齐后请求==产物）|
| 编辑模式（1 张参考图）| ✅ PASS | 84.2s | `images.image_1` 真的接进去了，`refCount=1` |
| 文生图 + 1 条 LoRA | ✅ PASS | 542.4s | 运行时注入的 `LoraLoaderModelOnly`（节点 40）被 ComfyUI 接受，`loraStack` 正确 |

进度序列实测：`10% 已提交 → (15% 排队中) → 35% GPU 生成中 → 85% 正在取回产物`（排队那级在有两单时出现）。

**验收带来的两个新发现（已写进代码与 UI）**：

1. **量化底座上应当用 bypass 模式挂 LoRA**（本轮最重要的修正，依据是真机对照实测）。
   改权重式 `LoraLoaderModelOnly` 在 w4a8 上每层都要
   `dequantize → 加 LoRA → requantize_from_float`（`comfy/ops.py` 的
   `convert_weight`/`set_weight` + `quant_ops`），416 个目标张量 × 50 层 × 6 步。
   而且**随机重量化本身会给权重引入噪声** —— 这是画质问题，比速度更值得在意
   （Civitai 上 `Artistic Solo Anatomy` 的作者对 NVFP4 底座给过同样警告：脸、头发、线稿会糊）。
   → 改用 `LoraLoaderBypassModelOnly`（`comfy_extras/nodes_lora_debug.py`）：
   `output = base_forward(x) + lora_path(x)`，**不碰基座权重**，
   把 LoRA 作为前向钩子注入（`comfy/sd.py` 的 `load_bypass_lora_for_models` →
   `BypassInjectionManager`），量化权重完全不需要反量化再重量化。
   - 运行时探测节点是否可用；可用走 bypass，不可用**回退**改权重模式并在 `warnings` 说明代价；
   - `meta.loraMode` 回报 `bypass` / `patch` / `none`，排障一眼看出走了哪条路；
   - 新增冒烟守卫「量化底座必须走 bypass 注入」+「bypass 节点在 ComfyUI 里真的存在」，
     防止以后为省事又改回 `LoraLoaderModelOnly`。

**对照实测（w4a8 / 768×768 / 6 步 / 1 条 LoRA / 队列独占，三组各一次）**：

| 模式 | 耗时 | 相对基准 |
|---|---|---|
| 无 LoRA | 69.2s | 基准 |
| `LoraLoaderModelOnly`（改权重）| 123.8s | **×1.79** |
| `LoraLoaderBypassModelOnly`（前向注入）| 87.8s | **×1.27** |

> ⚠️ **修正一处早期数字**：首轮验收时我报过"w4a8 挂 LoRA 慢 8 倍（66s → 542s）"，
> 那个 542s 是**受队列竞争污染**的测量（当时 ComfyUI 里还有另一个 5 图编辑任务在跑）。
> 独占队列后的干净对照是 **×1.79 / ×1.27**。bypass 比改权重快 29%，但**不是免费**（×1.27 而非 ×1.0），
> 代码与文档都已按实测值改写，不再声称"不影响速度"。

2. **`auto` 尺寸在编辑模式下不一定是 2048**。传 256×256 参考图时节点用缩放后尺寸（短边 1024）当画布，
   产物是 1024×1024，而 `meta.width/height` 会回 2048。现在加了 `sizeResolvedFrom: 'explicit'|'ref'|'default'`
   让调用方知道该不该信这个数，UI 文案也改成"自动 + 参考图 = 继承第 1 张缩放后尺寸，想锁定请选具体档位"。

### 内置 LoRA 实测（三个 H3-Image 画风 LoRA）

安装到 `models/loras/h3img/30_style/` 并逐个实测（1024² / seed 7777 / 6 步）：

| LoRA | 触发词 | 推荐强度 | 实测耗时 | 风格特征 |
|---|---|---|---|---|
| ningenmame | `@ningen_mame` | 0.8–1.2 | 233.7s | 线条细腻、平涂+柔渐变、绘师手绘感 |
| Sweet Butter Cookie | 整句触发词（编辑型）| 1.0 | 246.3s | 极简粉彩、细节平化、可爱插画感 |
| Anime Flat Style | 无 | 0.8–1.0 | 193.5s | 硬 cel-shading、大色块、无渐变 |

基线（无 LoRA）同参数 80.3s。三个首次运行的额外耗时主要是 LoRA 冷加载，
复跑降到 95–110s 量级。

**两个必须记住的实测结论**：

1. **Sweet Butter Cookie 是「编辑型」LoRA，不是纯画风**：必须给参考图当 `<Picture 1>`，
   prompt 直接用作者给的那整句触发词。不给参考图基本失效。
2. **它在源图背景是纯白/透明时会输出纯黑背景**。已做三组对照
   （strength 0.7 / 1.0、显式尺寸 / auto）全部复现，
   换成"舞台+幕布+木地板"的场景源图后背景**完整保留** ——
   所以这是"源图是空背景"导致的，不是 LoRA 缺陷。要保留背景，源图必须有真实场景。

**技术备注**：`Anime Flat Style` 用的是 kohya 键名（`lora_unet_blocks_*`，600 键），
与另两个的 diffusers 格式（`diffusion_model.blocks.*`，416 键）不同；
ComfyUI 的 `lora.py` 通用映射能正确转换，实测生效。
但它**没有 token_refiner 的 16 个键**（另两个有），风格作用集中在主干 blocks。

完整接口与 LoRA 使用手册见 `docs/H3-IMAGE-接口与LoRA使用手册.txt`（864 行）。

### 追加 LoRA 实测（Artistic Solo Anatomy v0.2 + 3D Animations NSFW Helper）

| LoRA | 底座 | 分类 | 触发词 | 强度 | 实测结论 |
|---|---|---|---|---|---|
| Artistic Solo Anatomy v0.2 | MiniMax H3 Image | img_quality | 无（自然描述）| 0.90 | ✅ **强烈推荐**，修好下体解剖且面部/手零退化 |
| 3D Animations NSFW Helper | **MiniMax H3（视频）** | img_inbox | 无 | — | ⚠️ 能加载有效果，但**破坏画面**，不推荐 |

**Artistic Solo Anatomy v0.2 是本轮最有价值的发现**：它解决 H3-Image 的一个真实缺陷 ——
原生模型会把女性下体画成"平滑化的丘状团块"，没有解剖结构。同 seed 同提示词对照：

- 无 LoRA：下体是不成形团块，无阴唇轮廓（82.9s）
- Artistic @0.90：清晰、自然、对称的解剖结构；面部更精致、五指完整、painterly 质感提升（82.8s）
- **耗时几乎相同** → 属"精修"而非"重绘"，开销可忽略

它是 img_quality（画质）分类，**可与画风 LoRA 叠加**。
推荐组合：画风 @0.8 + Artistic @0.9 = 总强度 1.7（安全，未踩 2.0 红线）。

**3D Animations NSFW Helper 的结论需要特别说明**：它的底座是 `minimax_h3`（视频模型），
作者自述"trained video and audio"、只覆盖 `blocks 24–49`（跳过前 24 层语义层）、
无 token_refiner。严格对照实测（同 seed 55555）：

| 对比 | 平均像素差 | 可见差异 |
|---|---|---|
| 无 LoRA vs @0.80 | 28.3 | 66.1% |
| 无 LoRA vs @1.00 | 35.1 | 76.1% |
| **@0.80 vs @1.00** | **15.4** | **55.8%** |

→ **它确实被加载并生效**（强度 0.8↔1.0 有 55.8% 差异是铁证）。
→ **但效果是破坏性的**：@1.00 时礼服被改成简化吊带短裙、手臂出现解剖畸变。
→ 它跑得更快（92.9s vs 175.9s）是因为只覆盖后 26 层 + bypass 不改前段权重，
  **不是**"被跳过所以快"。

**同时更正一处早期错误结论**：之前采纳的"H3-Image 与 H3 视频 LoRA 键集 416/416 完全一致、
可通用"不准确 —— 那是比对"两个 LoRA 文件之间"，没有比对**底座 checkpoint**。
实测底座维度：图像 qkv `[21504, 2688]` / 视频 qkv `[21504, 5376]`，
图像 DiT 的 in_features 只有视频的一半。**能加载 ≠ 语义正确**。

### 前端页面

`ImagePage.tsx` 重写：模型状态（真实生效值）→ 参考图（拖拽/排序/编辑目标角标）→ 提示词（超长拦截）→
输出设置（尺寸/自定义宽高/种子/批量）→ LoRA 面板 → 本次任务（进度条 + 九宫格 + 下载全部）→ 预览（继续编辑）。

### 新增：局部重绘（Inpainting，Phase 1 后端 + Phase 2 前端画笔）

完整调研与方案见 `docs/INPAINT-RESEARCH.md` / `docs/INPAINT-PLAN.md`。

**核心发现（与主流 inpaint 经验相反）**：H3-Image 上**不能用 denoise 控制改动强度**。
checkpoint 的 PDD 只有 6 个预测头、对应 7 点 sigma 网格；`BasicScheduler` 在 `denoise<1` 时
`total_steps = int(6/denoise)`，实测 denoise=0.5 → 只剩 3 个头工作（跳过 3,4,5），
出图表现为"区域被抹平、不按提示词生成"——不是"改得更少"。
→ **denoise 锁定 1.0，不可配置**；改动强弱改用 `SplitSigmas` 切片（4 档：full/strong/medium/light），
实测 mask 内差异 121.2 / 86.0 / 50.4 / 28.1，单调递减且每档都在网格上。

**两条链路**：

| 模式 | mask 外保真（实测差异） | 适用 |
|---|---|---|
| `crop`（crop & stitch，默认） | **0.005（>2 像素占比 0.00%）** | 精细局部，逐像素保真 |
| `full`（全图 latent 混合） | 3.4（4.5%） | 大范围改，兜底 |

**新增 vendor 包** `vendor/inpaint-nodes/`（GPL-3.0，源自 KJNodes，**随插件分发**）：
`JZImageCropByMaskAndResize`（mask→bbox→裁剪缩放）+ `JZImageUncropByMask`（按 bbox 贴回）。
与上游的 4 处差异：**尺寸对齐 16→32**（H3-Image 硬要求）、bbox 收敛为 xyxy、
空 mask 明确报错、**去掉 kornia/scipy 依赖**。
→ 图像 inpaint 链路**不再依赖外部 KJNodes**。

**羽化**用纯核心节点（不引入新依赖）：
`GrowMask(expand=16) → MaskToImage → ImageBlur(radius=31, sigma=10) → ImageToMask`。
实测接缝梯度：blur=8 → 22.22（可见硬边）、blur=31 → 5.48（视觉无接缝）。

**前端**（Phase 2）：
- `lib/brush.ts` —— 从 ComfyUI 官方 mask editor **移植核心算法**：
  Catmull-Rom 中心化样条（alpha=0.5，防快速甩笔打结）+ 按间距重采样 + `remainder` 跨段续接
  （这是连续笔画不断点的关键）+ 径向渐变笔刷 + LRU 纹理缓存。
  官方是 Vue + GPU shader，这里改成纯 Canvas 2D + TypeScript。
- `components/MaskEditor.tsx` —— **三层 canvas**：底图 / mask（数据层，透明）/ 红覆盖（视觉层）。
  拆三层是因为 mask 必须是干净的灰度图（白=重绘），红色只是给人看的，
  画进 mask 就不是合法 mask 了。含撤销栈（上限 10 步防内存爆）、笔刷大小/硬度、涂抹/擦除。
- `components/InpaintPanel.tsx` —— 源图选择 → 涂抹 → 提示词/模式/强度 → LoRA → 结果。
  显式不提供 denoise 滑块并说明原因；crop 不可用时禁用并给部署提示。
- `ImagePage` 改为 **Tabs 双链路**（文生图/参考图编辑 | 局部重绘）——
  状态完全隔离，避免"把 mask 误当参考图提交"。

**新增路由**：`GET /image/inpaint/meta`、`POST /image/inpaint`
**新增工具**：`studio_image { action: 'inpaint' }`（meta 里也带 `inpaint` 能力段）

**验收中抓到的真实 bug**：inpaint 走 `runWorkflow({ map: {} })` 而模板有 `{{VAE_NAME}}` 等占位符，
普通出图有 map 所以不报，只有 inpaint 报 `value_not_in_list`。已改为把模型名内联进节点，
并补冒烟断言「workflow 不含未替换的 {{占位符}}」防回归。

### 新增：局部重绘 Phase 3（crop 分辨率档位 + auto 算法）

**crop 模式暴露出一个隐藏参数：`baseResolution`（重绘分辨率）。**
裁剪块会被缩放到这个尺寸再送进模型，所以它直接决定细节保留程度。
自由滑块会让用户不知道填多少，所以做成 5 档：`auto` / 512 / 768 / 1024 / 1280。

**auto 档的算法修正过一次（有实测依据）**：

第一版按「笔画总面积」反推：`base_res = sqrt(笔画像素) × 2`。**这是错的。**

以 S 形笔画为例（71,679 px，bbox 1024×469，笔画宽约 70px）：

| 配置 | 笔画核心改动 | 笔画边缘差异 | 笔画外溢出 |
|---|---|---|---|
| 旧 auto 544² | 26.46 | **11.43** | **3.82%** |
| 固定 1024² | 24.34 | **5.53** | **0.36%** |

旧公式给 544²，意味着 bbox 长边要**缩小 0.53 倍**，70px 宽的笔画降到 37px，
再经 latent 16× 下采样只剩 2.3 latent px → **细线被糊掉**。
核心改动只强 8%，但边缘差异差 2 倍、外溢差 10 倍。根因：只看总面积，**没看笔画宽度**。

**修正后的语义**：`base_res = max(bbox_w, bbox_h) × 1.5`，保证**缩放比 ≥ 1（笔画不被缩小）**。

实测验证修正后的行为：

| 场景 | bbox | auto 结果 | 判定 |
|---|---|---|---|
| S 形（大 bbox） | 1024×469 | **1024**（与固定档一致） | ✅ 不再缩小 |
| 小选区 | 300×200 | **448**（1.49× 放大） | ✅ 正确放大 |
| 小选区耗时 | — | auto 70.3s vs 固定 85.1s | ✅ 更快 14.8s |

**小选区的实际效果对比（决定性证据）**：同样画「一块蓝色水晶」，
- `1024²`（放大 3.4×）：水晶**盖在**裙子上，把裙摆结构遮掉，边缘生硬
- `448²`（放大 1.49×）：水晶**嵌在**裙摆褶皱里，有层次、自然融合

→ 「改动强度」指标（1024 是 104.99，auto 是 91.78）反而误导：**数值高 ≠ 画质好**，
过度放大让模型倾向"画个大东西填满"。

**大选区的硬限制也要告知**：bbox 2000×1500 时，即使顶到 maxCrop 1024，
缩放比仍是 0.51×，细节必然损失。这不是 bug 是面积上限的必然结果 ——
所以 `resolveCropResolution` 会写 warning 进 job，前端能看到，不静默。

**新增**：`GET /image/inpaint/meta` 增加 `resolutions` / `autoScale` / `resolutionHint`；
`POST /image/inpaint` 接受 `bboxW`/`bboxH`/`strokePixels`/`crop.resolutionId`，返回 `cropResolution`/`warnings`。
前端 MaskEditor 导出 mask 时**全量扫 alpha 算精确 bbox**（不采样，避免漏掉单像素宽的笔画端点）。

### 测试

`tools/smoke-api.mjs` 从 208 项增到 **245 项**，新增 37 条钉住本轮契约：
尺寸表 32 倍数自检（含"自检本身有效"的反向用例）、超长 400、`normalizeImagePrompt` 不截断、
自定义宽高校验、批量拆 seed、参考图 16 上限 + 保序 + bad 回报、
图像 LoRA 目录隔离（视频 LoRA 不混入）/ 画风单选 / 衰减 / 过曝剔除 / 画风×角色告警 / 文件缺失组装期拒掉、
`/image/meta` 回真实生效值、图像页必须有参考图入口、LoRA 面板约束只走后端；
**局部重绘 15 条**：denoise 锁 1.0、强度档是 SplitSigmas、缺参报明确码、32 倍数与面积上限、
mode 枚举、latent 必须来自 VAEEncode（不能用 zeros）、crop 注入 vendor 节点 + 羽化链、
vendor 节点可探测、无未替换占位符、画笔算法契约、MaskEditor 三层 canvas + 尺寸锁定、
InpaintPanel 不给 denoise 滑块、**auto 分辨率按 bbox 长边算（不缩小笔画）**、
**大选区被缩小时有 warning**、**显式档位不被 auto 覆盖**。
另有 gitignore 白名单兜底断言（防 data/ 新目录漏项）。

---

## 3.2.0 — 全量审计：安全与静默失败缺陷全修 + 重构补丁清理 + 运行时数据清空（2026-11-23）

> 一次性彻底审计：按模块逐文件审阅 6 个分区（入口/REST、桥接层、服务与存储、前端、vendor 与
> Blender、文档与脚本），共 628 条 findings，按级别修复 P1/P2 全部与 P3 清理项。
> 审计报告原文见 `docs/AUDIT-3.2.0.md`。

### 修复：数据正确性（P1）

- **参考视频 / 音频编号被压缩后重排**（`services/generator.js`，两条执行链各一处）：
  `.filter(v => v.abs)` 会删掉解析失败的条目再 `index = i+1` 重编号，而提示词里的
  `<Video N>` / `<Audio N>` 是按挂载顺序写的 → 第 3 段前移成第 2 位，指令与实物错位，
  且 ComfyUI 的 AUTOGROW 输入不报错。现在按**原位置**编号，缺失项留空槽（`staged[key]` 为空）。
  同时修正 `warnMissingMedia` 的文案（不是"悬空"而是"槽位留空"）并透传 `cfg`。
- **`useRef` 判定与实际接线脱节**：改为看**已落地的 staged 文件名**，而不是解析出的条目数 ——
  否则 staging 部分失败时会挂 `ReferenceToVideo` 却零参考，静默退化成纯文生。
- **ComfyUI 生命周期用布尔标记持有权**（`services/comfy-lifecycle.js`）：
  两个批次并发时后来的会把前一个的标记清掉（显存永不释放）或把别人正在用的实例关掉。
  改为 `startedByUs`（全局事实）+ `owners` 集合（持有者），并把 `ownerId` 透传到
  `replace-runner` 的 ensure/release。
- **`stopComfy` 以过期端口文件为唯一判据**（`services/comfy-control.js`）：端口文件缺失/搬目录时
  误报"本来就没在运行"，ComfyUI 继续占 10–14GB。改为先探端口文件、再探可达地址（`resolveLivePort`）。
- **换人断点续跑只比对段起点**（`services/replace-runner.js`）：换源视频或改段长后旧记录被误判为
  "已完成"，成品前半段旧人、后半段新人且无警告。改用「源视频 + 起点 + 段长」三元组，并在
  换源时显式告警 + 整体不复用。
- **`pruneJobs` 的并发窗口**（`services/job-store.js`）：原先 `list()` 与 `replaceAll()` 之间
  新落盘的记录会被覆盖（`maxConcurrentLocal>1` 时真实可达）。改为在同一个 `updateJson`
  mutator 内完成读-算-写；`TERMINAL` 导出为终态唯一真源，`job-runner` 的取消判定补上 `interrupted`。

### 修复：静默失败与吞错（P1/P2）

- **`extras.js` 的读-改-写绕过串行队列**：`writeJson` 是同步裸写，两个并发 upsert 互相覆盖。
  模板 / 服化道 / 动态条的 6 处写操作改走 `updateJson`（同文件串行队列）。
- **`json-store` 的 `.bak` / `.corrupt` 只写不读**：主文件损坏后读取链路持续抛 `CORRUPT_JSON`，
  只能人工恢复。`readSync` 现在解析失败时自动回退 `.bak` 并 warn（回退写入不经过 `backupSync`，
  避免把好的备份覆盖成损坏内容）。
- **ComfyUI 探测失败被缓存 5 秒**：刚启动的实例会被报"不可达"。失败不写缓存。
- **轮询吞掉 `/history` 的所有错误**：ComfyUI 被打挂时要等满 2 小时才报"超时"。
  现在只对网络抖动继续等，HTTP 层面连续 5 次硬失败即抛真实错误码。
- **只取第一个产物**：二采 / 续写同时产出多份时其余被静默丢弃，而任务记录自称"含全部 outputs"。
  现在全部下载，产物文件名按序号区分，下载失败进 `job.warnings` 并冒泡到任务记录。
- **`studio_generate` 的未知 preset 静默落空层**（`bridge/vendors/nanfeng/presets.js`）：
  拼错 preset id 会用"零覆盖"跑一次与意图无关的生成。改为抛 `UNKNOWN_PRESET` 并列出可用值。
- **`coerceTypes` 把非法值变成 `null` / `NaN` 后照原样提交**（`bridge/vendors/nanfeng/graph.js`）：
  用户看到的是 ComfyUI 的 "Value not in list"。现在强转失败收集成 `INVALID_PARAM_TYPE`；
  BOOLEAN 的"未提供"不再被写成 `false`（未提供 ≠ 明确关闭）。
- **`edit.js` 流复制的形状校验**：显式 `reencode:false` 且片段规格不一致时静默产出时长错乱的坏片；
  现在直接报 `COPY_SHAPE_MISMATCH`。单片段 concat 不再强制重编码。
- **`studio_jobs` 缺 retry**：Agent 侧无法重跑任务（REST 有）。补 `retry`，与
  `studio_generate` 共用 `runGenerationFor`（避免后端分流在两处漂移）。
- **`studio_jobs` 的 retry** 与 REST 一致：复用同一镜头卡快照，不再新建一份。

### 修复：安全（P1）

- **`validateComfyUrl` 仍用 `/^127\./`**（`host/config.js`）：`127.0.0.1.evil.com` / `0.0.0.0`
  都能通过 → 配置值这条出口的 SSRF。改为复用 `security.js` 的 `isLoopbackHostname`
  （严格四段 IPv4 + localhost + ::1，不接受 `0.0.0.0`），并**在读取路径也校验一次**
  （手改 config.json 不再能绕过）。
- **`resolveUserPath` 相对路径分支没 realpath**（`host/security.js`）：dataDir 内放一个指向 `C:\`
  的 junction 就能读出 root 外的文件（实测复现；绝对路径分支因为走了 realpath 则正确拒绝）。
  新增 `realpathLoose()`（解析最长的已存在祖先），所有分支统一在最后物理化再比对。
- **`/file` 改用 `resolveUserPath`**（`host/api/index.js`）：裸 `safeJoin` 看不出 symlink/junction 指向。
- **`saveConfig` 全量写盘会把 `dataDir` 的内存回落永久写死**（`host/config.js`）：
  用户只是改了个主题色，自定义数据目录就被覆盖丢失。现在只写白名单键，
  且 `dataDir` 未出现在 patch 里时保留文件原值；`ffmpegDir` 这类不可写键不再出现在配置文件里。

### 修复：单一真源（P2）

- 新增 `host/store/mode-aliases.js`：模式别名原本有两份（`store/models.js` 会剥 `h3:` 前缀，
  而 `services/ref-images.js` 不会、还少两个别名），同一个镜头卡在"提示词编译器"与
  "槽位规划"两边得出不同模式 → fl2va/i2va 下差 1–2 个槽位号。现合并为无 IO 依赖的唯一实现。
- `ref-images.js` 的 `if (!push(...)) break`：push 在"解析失败 / 重复 / 到上限"三种情况下都返回
  false，同一张立绘既在卡仓库又在人设卡时（常见）会让这张卡后面所有分图被跳过。改为只在到上限时停。
- `job-runner` 把 `pruneJobs` 的动态 import 改回静态（同模块已静态 import 三个符号）。
- `host/index.js` 的 `_imgWf` 模块级缓存永不失效 → 删掉（`readWorkflowCached` 本身有缓存与失效订阅）；
  `runGenerate` 闭包改用 `loadConfig()` 现取，不再持启动期 `cfg` 快照。
- 前端 `api/edit.ts` 自建的 fetch 核心删除，改走 `client.ts` 导出的 `request`
  （原来丢掉了超时表、403 重取 token，等于把已修好的 P1 在新文件里复现）。
- 前端 `client.ts` 的 BAD_RESPONSE 重放**只对幂等方法**生效（204/空 body 的成功写操作曾被重发一次，
  非幂等接口 = 任务重复入队）。
- 前端画布 `runner.ts`：手填参考图与上游参考图**合并**，不再被上游连线静默清空。

### 修复：前端静默撒谎（P1）

- `ContinuationPanel`：`catch { setBatches([]) }` 把"请求失败"渲染成"没有批次" → 增加错误条。
- `LoraPicker`：约束求解失败渲染成"没选 LoRA"的空态 → 增加错误条。
- `ReplacementPage`：「创建并立即执行」把执行失败当成功 → 拆分 toast，明确"任务已创建但没跑起来"。
- `PrevizPage`：渲完自动挂参考视频失败只 `setErr`（错误条在页面顶部，用户看不到）→ 加 toast。

### 清理

- 删除 `tools/_mk.mjs`（一次性复现脚本）与整个 `tools/oneoff/`（实验脚本）。
- 删除 `vendor/nanfeng/__pycache__`、`host/blender/__pycache__`。
- 删除 `docs/history/`（上一轮 PLAN/AUDIT 过程文档）。
- 清空全部运行时数据：`data/{assets,outputs,replace,post,previz,projects,shots,vault,runs,edit,extras}`、
  `data/{jobs,projects,assets-index}.json(.bak)`、`data/_abprompt.txt`、`data/config.json`
  （**保留 `data/workflows/{h3,h3-image}.json`**，它们是随插件分发的模板）。
- 清理工作区级残留：`_backup_pre3`(466MB 旧版快照)、`_audit`(上轮报告)、`_work`、`_h3res`、`_临时`、`- 临时`；
  `ai-runtime` 的 6 个 `.prev` 日志、`_node_backups`、`models/.cache`、
  `ComfyUI/{input,output}` 历史产物（1.9GB）与 `__pycache__`。
- 修正全仓 37 处陈旧数字与旧路径（217→221 参数、`host/services/nanfeng/*`→`host/bridge/*`、
  冒烟 187→207、路由 115→105+参数化、README 的 host 59→66 文件 / 24,900→27,700 行、services 29→30 等）。
- `package.json` version `3.1.0` → **`3.2.0`**，`app-dist` 重新构建并注入新版本号。

### 验证

| 门禁 | 结果 |
|---|---|
| `node --check`（61 个 host JS） | **0 失败** |
| `tsc --noEmit`（前端） | **0 错** |
| `node tools/smoke-api.mjs` | **207 / 207 全过** |
| `vite build` | **成功**，包内版本 `3.2.0` |
| 安全回归（手测） | symlink 越界被拒 `FORBIDDEN_PATH`；`127.0.0.1.evil.com` / `0.0.0.0` 被拒；`.bak` 自动恢复生效 |

---

## 3.1.0 — 运行时稳定性：卡死与内存累积（2026-11-23）

> 针对「连续跑多个项目越来越慢、第 4 段完全跑不动」的现场排查。
> 完整分析见 **`docs/MEMORY-ANALYSIS.md`**（含复现样本、日志证据、实测数据）。
>
> 核心结论：**不是典型内存泄漏**。实测 4 段连续生成，私有内存 13.77GB 峰值
> → 结束回落到 4.54GB，无单调上升。真实原因是三件事叠加。

### 修复

- **GPU 驱动 TDR 导致任务卡死（致命）**
  `nvlddmkm` 事件 153 精确对应卡死窗口（`03:03:56` 卡 111.9 分钟的任务）。
  驱动复位期间 GPU 停摆、功耗从 150W 掉到 44W，「很久之后自己恢复」正是复位完成。
  已在 `start-h3.ps1` 加 `--vram-headroom 1`，给 WDDM 留余量避免共享显存溢出。

- **放大器 MODEL_CACHE 无界累积**
  `Comfyui_Minimax_h3_latent_Upscaler` 三个模块的 `MODEL_CACHE` 只写不删，
  键含 device/precision，换精度就多一份模型常驻。改为单槽淘汰（装新前清旧）。
  同时 `h3_generator.py` 的清理节点原先只匹配 `h3_upscaler_common`，
  扫不到 `minimax_h3_latent_upscaler_2d/3d` —— 已改为同时匹配
  `h3_upscaler` 与 `latent_upscaler`。

- **job-store 的 IO 放大**
  `pruneJobs()` 逐条 `remove(id)` 删 100 条 = 100 次 608KB 读改写，
  Windows 上还会撞 EPERM 重试。改为一次 `replaceAll(kept)`，
  走的是同一个 per-file 串行队列，不绕过并发保护。

- **replace-runner 的重复回读**
  `emit()` 在 `upsert()` 之后又 `get()` 一次 152KB。每段 2 次、30 段批次 = 60 次
  重复全量读。改为直接用 `upsert()` 的返回值（契约本就是返回合并后的单条记录）。

### 变更

- **启动参数重排**（`ai-runtime/start-h3.ps1`）
  - 删 `--lowvram` —— DynamicVRAM 下是空操作（ComfyUI 帮助文本自己写明），
    留着只会让日志打 `Set vram state to: LOW_VRAM` 误导排查
  - 加 `--cache-none` —— RAM pressure cache 的 inactive 阈值（32GB）在本机不可达，
    导致每节点都清缓存+压 pin；H3 每段换提示词，跨 prompt 缓存本无命中率
  - 加 `--fast-disk`（显式）—— 本机模型在 F: NVMe，自动探测本就为 True
  - 保留 `--disable-pinned-memory`（治上游 #11775 那条 20-30GB 泄漏）
  - 保留 `--use-ck-attention`（实测快 15%）

- **`vendor/nanfeng` 重新部署到 ComfyUI**
  发现 `vendor/nanfeng/h3_generator.py`（134,914 B，v3.0.0 重构后）
  与 ComfyUI 里实际在跑的版本（144,251 B，仍带 3 个 `if False:` 死分支）
  是两个不同版本 —— 后者与 `_backup_pre3` 快照只差本次编辑，
  说明**从未重新部署过**。已用 `deploy-vendor.ps1 -Force -Clean` 部署，
  补回缺失的 `nodes.py`，31 个注册节点全部核对一致。
  旧版备份在 `ai-runtime/_node_backups/nanfeng_20261123-095646`。

- **冒烟测试断言同步**
  三处 `audio_context_length` 断言仍在验旧公式（按 40Hz/24fps 换算），
  而实现早已改为 `AUDIO_CTX_MIN = 8`（与视频窗口解耦，原因见
  `replace-runner.js` 的实测注释：ctx=22 会让每段多烧 1000+ 秒）。
  断言已改为验「恒为 8」。

### 验证

- 冒烟测试 **207/207 全部通过**（含全部 ComfyUI 集成项）
- 路由一致性：前端 71 条 / 后端 155 条，三方一致
- 端到端连续生成 4 段：private 内存 `8.02 → 8.71 → 11.61 → 4.54 GB`，回落正常
- GPU 采样期间 `153.95W / 100%`（故障态是 44W）

### 已知未修（需要单独决策）

- **每段仍重复 staged 66GB**：`ReleaseBeforeConditionLoaders` 与
  `ReleaseBeforeSampling` 两个屏障节点仍在图中。摘掉预计能把每段
  3 次 staged 降到 1-2 次，但需长跑验证 OOM 不回归。
- **文本编码器 25.9GB**：每段完整跑一遍是最大的单项开销。
  换 NVFP4 版（约 15.7GB）可省 10GB 读取 + 约 1/3 前向时间，
  只需替换模型文件（`resolveModelNames()` 会自动探测）。

### 关于 cu128（曾误判，已更正）

初版报告称「cu128 导致量化算力腰斩 2.3 倍」——**该结论是冷启动噪声误判，已证伪**。
用 `torch.utils.benchmark` 稳态测量后：

| 路径 | 耗时（4096 tokens, 5120→13824） |
|---|---|
| eager int8_linear（当前在用） | 17.7 ms |
| cuda 后端（强制启用） | 18.7 ms（无收益） |
| `torch._int_mm` 原生 int8 | 11.5 ms |
| 反量化 → bf16 再乘 | 9.4 ms |

进一步查明：`comfy-kitchen` 的 CUDA 后端把 `int8_linear` 的注册条件卡在
`_C.HAS_CUBLASLT`（**编译期常量**，本机为 False），所以 int8 GEMM 无论
CUDA 版本都回退 eager；而 cuda 后端相对 eager 多出来的能力只有 3D 网格算子，
H3 一个都用不到。

**结论：升级 cu130 对本问题收益接近于零，不建议。** 详见 `docs/CU128-ASSESSMENT.md`。

---

## 3.0.0 — 架构重构与全量修复（2026-11-22）

> 一次基于**全量代码审计**（176 文件 / 60,398 行逐行审阅 + 212 次运行时只读探测）
> 的结构性重构。审计报告见 `_audit/00-总报告.md`（另有 7 份分报告）。
>
> 这次改动**不是加功能**，而是把「同一件事写了 3~6 遍」的地方收敛成一处，
> 让若干类 bug 从"要小心避免"变成"结构上不可能再发生"。

### ⓪ 第二轮深度复查（同日追加）

审计报告（`_audit/12-rev2-api.md`、`13-rev2-services.md`）复查后又修掉 6 个真实缺陷，
其中 **2 个 P0 会让生成结果是错的**：

- **P0｜`planImageSlots` 返回压缩数组 → 三张参考图丢两张。**
  南风槽位参数 `图片1..9` 的写法是 `out['图片'+(i+1)] = images[i]` ——
  **数组下标就是槽位号**。而 `planImageSlots` 返回的是压缩后的列表，
  于是 fl2va 下 `['c1','c2','c3']` 被写成 图片1/2/3，紧接着 `frameSlots`
  把 图片1/2 覆盖成首尾帧 → **c1、c2 静默消失**，只有 c3 落在 图片3，
  而提示词里引用的是 `<Picture 3/4/5>`（三张都要）。
  实测修复前：三张参考图 → 最终只有 图片3=c3.png，图片4/5 为空。
  修复：`images` 改为**按槽位号定位的定长 9 数组**，另给 `present` 作为有效列表。

- **P0｜`deriveSubjectsFromShot` 与真实提交相差 2。**
  它调 `planImageSlots` 时首尾帧传的是空串（等于"没有首尾帧"），
  于是 fl2va 下算出 `<Picture 1>`，而真实提交是 `<Picture 3>` ——
  同一镜头，编译出的提示词认为角色是 1 号、实际提交是 3 号，**串脸且不报错**。
  修复：传 `resolvePrevizArtifacts` 的解析结果。

- **P1｜`/file` 缺 nosniff 与 SVG 强制下载 → 同源存储型 XSS。**
  `/assets/item` 早就有这两项防护，`/file` 没有。用户把 `.svg` 传进素材库，
  任何人打开 `/file?path=assets/x.svg` 就在插件同源下执行脚本，
  而该源上挂着全部写接口（token 可从 `/token` 拿）。实测修复前
  `GET /file?path=assets/asset_x.svg` → `200 image/svg+xml` 且 body 原样返回。

- **P1｜错误码映射只按 message 正则猜，全部落 500。**
  `resolveUserPath` 抛的 `NOT_FOUND` / `INLINE_DATA_URL`、剪辑的 `FILE_NOT_FOUND`
  都变成 500，前端只能显示"服务端炸了"；`BODY_TOO_LARGE` 该是 413。
  修复：改用 `err.code` → 状态码的显式映射表。

- **P1｜`lora-catalog` 的裸 `step` / `acc` 正则把画风判成加速学生。**
  加速学生是"单选 + 强度锁 1.0"，误判会**顶掉真正的 DMAD** →
  4 步跑在未蒸馏原模型上，能出片但质量悄悄崩。
  实测误判：`art_steps_style`、`step_by_step_anime`、`accelerate_motion_pack`。
  修复：正则要求成词边界 + 明确语义词（`4step`/`turbo`/`lightx2v`/`dmd`…）。

- **P1｜`accel-plan` 命中子目录时清空 warnings。**
  `const note = exactFile.dir ? [] : warnings` 逻辑写反了 —— 本机 LoRA 就在
  `00_turbo/` 下，于是「未知加速方案已回退」这类警告**一句都看不到**。
  修复：改为追加一条说明，不清空。

另有 4 处一并修掉：
- `replace-tasks` 的对象字面量有**重复键 `continuation`**（后者覆盖前者），
  导致"按独立重绘算分段、按续写存盘"——分段表与实际执行链不符；
- `generator` 的视频/音频用 `.filter(Boolean)` 压缩，让"第 2 段失败"
  变成"第 3 段前移"，与提示词里的 `<Video 3>` 错位（改为保位）；
- `job-runner` 的取消早退返回 `undefined`（改为 `{outputs:[],remoteId,cancelled:true}`）；
- `StoryboardPage` 的视频/音频 tab 可点但选择被丢弃（UI 撒谎）——
  改为 `AssetPicker kinds={['image']}` 直接不渲染假入口。

**防护**：冒烟测试 177 → **195 项**，新增守卫覆盖上面每一条
（槽位定位、编号一致性、LoRA 分类、错误码映射、安全头、重复键、路由遮蔽）。

---
### ① ★ 新增 `host/bridge/` —— H3 桥接层从 services 里独立出来

改造前，「上游南风 V15 长什么样」这件事散在 `host/services/nanfeng/`（8 个文件）
+ `services/h3-prompt.js`（2,142 行）+ `services/prompt-normalizer.js`，
与素材库、ffmpeg、剪辑这些业务服务平铺在一起。后果是上游改名要改多处、
业务层反向依赖上游参数表。

现在收进独立一层，**每个子目录只承担一种变化原因**：

```
host/bridge/
├─ index.js              门面（业务层唯一 import 点）
├─ README.md             职责边界 + 上游升级流程
├─ vendors/nanfeng/      上游节点包镜像（schema / param-docs / graph / presets /
│                        index / continuation 六个文件）
├─ prompt/               提示词通道（h3-prompt / prompt-normalizer）
└─ llm/                  DSH LLM 桥接（dsh-llm / storyboard）
```

- 业务层 **26 处**对桥接子目录的直接 import 全部改为走门面
- `services/nanfeng/` 目录删除
- 门面导出门面符号与 9 个命名空间，`BRIDGE_LAYOUT` 供结构性自检
- **新增架构守卫**：业务层再直接 import `bridge/vendors|prompt|llm` 会被冒烟测试拦下

### ② ★ 新增 `host/services/ref-images.js` —— 参考图编号四合一（修复 P0）

「一张镜头卡到底提交哪些参考图、各是第几张」原来被写了 **4 遍**
（`generator.resolveRefImages`、`render-plan.buildRenderPlan`、
`shot-context.resolvePictureIndices`、`api.deriveSubjectsFromShot`），
顺序规则**不完全一致**，于是产生了真实事故：

> 预览显示 `<Picture 1>` 是角色卡、`<Picture 2>` 是道具，
> 实际提交时角色卡排到第 2 位 —— 模型把道具当成了人。

现在只有一份实现，并修掉两个确证缺陷：

- **P0**：`fl2va` + 参考图时首尾帧占用 `图片1/2`，而参考图没有剔除被占槽位，
  `<Picture N>` 与实际槽位错位（3 图时指向道具图，2 图时产生悬空引用）
- **P1**：模式别名归一漏了历史短名 `i2v`/`fl2v` → 首尾帧**不占槽位 → 静默丢失**

### ③ ★ 新增 `host/config-reader.js` —— 消灭「配置分裂脑」

服务工厂原来同时收 `cfg`（启动快照）和 `getCfg`（每次现取），
于是同一进程里有两套配置：改 `dataDir` 之后「一半数据在新目录、一半在旧目录」，
用户看到「项目还在、内容空了」。

现在规则只有一条：**服务只允许持有 `getCfg`**。`configReader()` 统一写法，
`findConfigSnapshotReads()` 提供扫描器，冒烟测试据此拦住回退。

顺带修掉：`h3-workshop.js` 8 处用闭包 `cfg`、`canvas-agent` 的权限文件路径
模块级一次性缓存（改 dataDir 后仍读写旧目录）。

### ④ ★ `store/json-store.js` 重写 —— 修掉一条丢整份数据的路径（P0）

旧实现在 Windows EPERM 重试里**先 `fs.rmSync(file)` 删掉目标文件**再 rename。
8 次重试全失败时目标已被删、随后 tmp 也被删 → `jobs.json` / `projects.json` /
`shots.json` **整份归零且无备份**。修并发写引入的新故障比原故障更严重。

现在：重试只针对同一 tmp、**全程不删目标**；始终失败时退回覆盖写（非原子但
不会两份都没了）；写前保留 `.bak`；读盘去掉 `existsSync` 的 TOCTOU；
同步重试改用 `Atomics.wait` 真睡眠（原来 `while(Date.now()<until){}` 最长冻结
事件循环 0.7 秒，连带 SSE 与生成轮询全部停摆）；新增 `flushJsonStore()`。

### ⑤ ★ `host/api/index.js` 拆分（3,149 → 2,343 行）

单文件原来住着 5 种职责，`tools.js` 反向依赖 REST 层。现在拆出 7 个模块：

| 文件 | 职责 |
|---|---|
| `http.js` | body 解析 / sendJson / Range / multipart |
| `shots.js` | 镜头卡 CRUD |
| `prompt-compile.js` | `compilePrompt` / `deriveSubjectsFromShot` |
| `projects.js` | 项目摘要投影 / 可写字段白名单 |
| `monitor.js` | `/monitor` 负载 |
| `replace-tasks.js` | 换人任务创建 |
| `archive.js` | 产物归档 / 字体 / 可读路径白名单 |

### ⑥ ★ 新增 `GET /jobs/:id` + `GET /jobs?fields=list`

实测 `GET /jobs` 单次响应 **417,415 字节**（134 条任务全量，含 prompt 全文 +
221 参数快照）。前端有 4 处「拉全量再 find」的轮询，画布单节点执行 30 分钟
≈ 286 MB 流量。

- 新增 `/jobs/:id`：单任务查询 **8,099 字节**（省 98%）
- `/jobs?fields=list`：轻量投影 **40,057 字节**（省 90%，5.2×）
- 前端 4 处改为单任务查询 / 轻量投影
- ⚠️ 路由正则显式排除 `batch-progress`（否则工具箱「批量进度」会被 404）

### ⑦ vendor：修帧数下限不一致 + 删死代码

- **P1**：`duration_to_frames` **没有 124 帧下限**，而宿主 `h3Length` 有 →
  2 秒镜头 vendor 出 56 帧、宿主规划 124 帧，**参考视频比成片长 121%**，
  动作演一半断掉。现在两侧同值（124–362）
- **P1**：一采画布误读二采参数 `H3潜空间对齐`（默认 2 → 864×480，设 32 →
  1024×512，token +26.7%）。一采固定 `align=2`
- 删除 `nodes.py`（287 行，从未被 `__init__.py` import，3 个节点从未注册）
- 删除 14 处不可达分支（`if False` / `not is_v81` 系列），含 2 处悬空引用
  （`NanFengH3RebuildAVLatent` 节点无定义、`_select_face_refine_turbo_lora`
  函数无定义）
- `h3_generator.py` 2,402 → 2,227 行

### ⑧ 前端：修 3 个 P0 与一批 P1

- **P0**：RenderPage 的 `loadShots` 无条件把选中镜头改成 `updatedAt` 最新的那个
  → 编辑 A 时 Agent 改 B，界面跳到 B、未保存内容丢失。现在默认保留当前选中
- **P0**：RenderPage 回填 effect 的 deps 含 `shots` → 任何列表刷新都把用户
  正在输入的提示词**静默回滚**。现在只响应 `shotId`
- **P0**：CanvasArea「重新载入项目 / 重试」两个按钮**完全无效**（effect deps
  不变）。现在按钮 `setReloadTick` 进 deps；顺带修了 hydration 解除定时器
  未清理（切项目时把半加载画布写回后端）
- **P1**：`request()` 加默认超时（30s，长任务路径单独放宽）与
  403 `WRITE_TOKEN_REQUIRED` 自动重取 token 重试
- **P1**：`events.ts` 改可订阅连接状态（`useSyncExternalStore`）——
  原来 SSE 徽章**永远显示离线**
- **P1**：补上 SettingsPage 快捷键表里早就写着却从未实现的 Delete / F
- **P1**：store 的 error 改为 `unknown`（原来降级成 string →
  `describeError` 恒显示「发生未知错误」）
- **P1**：ContinuationPanel 不再整体替换 `nanfeng` 对象（原来会**静默清空
  用户的 LoRA 栈**）

### ⑨ 清理

- 删除 `store/image-pool.js`（113 行）：前端从不产生 `data:image` 内联图
  （画布用 `blob:` + `/assets/item`），且其启发式会把 aiTextNode 的长正文
  误判成图片、搬进 pool 后**正文静默消失**
- 删除 `tools/` 里 8 个一次性脚本（`build-prompts` / `_e2e-*` / `fix-negations*` /
  `cont-plan-probe` / `cost-model`）
- `.gitignore` 补 `data/replace/` 等 11 条规则（原来 77 个文件、41.88 MB
  运行期产物被提交进仓库，且运行时持续写入让 `git status` 永远脏）

### ⑩ 防护：冒烟测试从 177 → 187 项，新增 10 项架构守卫

守的不是功能，是**结构性约束**——防止以后又不小心退回旧形态：

| 守卫 | 守什么 |
|---|---|
| 桥接层门面完整 | 9 个命名空间 + 4 个直出符号 + `BRIDGE_LAYOUT` |
| `services/nanfeng` 已迁走 | 旧目录不能再出现 |
| 业务层只走门面 | 不允许直接 import `bridge/vendors\|prompt\|llm` |
| 参考图编号唯一实现 | `planImageSlots` 只允许定义在 `ref-images.js` |
| 无 cfg 快照读 | `findConfigSnapshotReads` 扫描 services 层 |
| 全仓相对 import 可解析 | 搬文件最容易断这里 |
| Host 校验用严格 IP | `127.0.0.1.evil.com` 必须被拒 |
| 原子写不删目标文件 | 写路径不能出现 `rmSync(file)` |
| 前端 request 带超时 | `DEFAULT_TIMEOUT_MS` + 403 重试 |
| SSE 连接状态可订阅 | `useSyncExternalStore` |

### 数字校正（全仓 60+ 处陈旧文案）

| 项 | 旧 | 实 |
|---|---|---|
| 南风参数 | 217（60+ 处） | **221**（差额 4 在 I 组换人加噪参数；`GROUPS.I.count` 早已是 11，只有文件头注释没改） |
| REST 路由 | 92 / 102 | **115** 精确 (method,path) + 5 前缀族 + 7 参数化族 |
| Agent 工具 | 13（README）/ 14（architecture） | **14** |
| 前端页面 | 12 | **15 个文件 / 14 条路由** |
| 冒烟测试 | 111 / 165 | **187** |

---
## 2.19.0 — 分镜按段切分（2026-11-22）

> 用户实测：49 秒视频切 7 段，提示词写了 7 个 `[Shot N]`，
> 但每段都收到完整 7 个 —— 每段都在演整场戏。

### ① 根因：提示词从不按段切分

`replace-runner.js` 的 `segmentPrompt` 只做一件事：续写时插身份锚定句。
它**从不切割 `[Shot N]`** —— 整份提示词原样发给每一段。

实测证据（用户那次 7 段任务）：

```
段 1 | 提示词 1912 字 | [Shot] 7 个: Shot 1..7
段 2 | 提示词 2155 字 | [Shot] 7 个: Shot 1..7
```

模型看到「7 段戏全都要演」，自然把动作挤成一团。
**这不是 DMAD 的问题** —— DMAD 只影响采样质量，不影响提示词内容。

### ② 修法：行过滤，不做块切分

前提约定（用户明确）：**`[Shot N]` 一定独占一行，该段内容都在这一行内，不跨行。**

于是切分规则极简：

> **删掉不属于本段的 `[Shot N]` 行，其余一个字节都不动。**

- `[Shot N]` 行 → 该段专属动作
- 其余所有行（触发词、身份绑定、通用要求、防漂移声明）→ **每段都带**

### ③ 踩过的坑：块切分导致段 1~6 各丢 5 条约束

第一版按「`[Shot N]` 到下一个 `[Shot N]` 之间的所有文字」切块。
用户把 7 个 Shot 写成连续 7 行，后面跟 6 行通用要求 ——
这些行被算进 `[Shot 7]` 的内容里，于是：

| | 修复前 | 修复后 |
|---|---|---|
| 段 1–6 | **各丢 5 条**（只有段 7 有）| 12/12 全保留 |
| 段 7 | 完整 | 完整 |

丢的正是画质、表情、服装细节这些约束 —— 等于没写。

### ④ 重号也能正确分派

用户手误写成两个 `[Shot 6]` 时，**按行下标**定位而非按编号匹配：
段 6 拿第一个、段 7 拿第二个，不会两个都塞进同一段。

### ⑤ 配不上时不瞎猜

| 情况 | 策略 |
|---|---|
| M == N | `one-to-one`，段 i 取第 i 行 |
| M > N 且整除 | `grouped`，每段 M/N 个 |
| 其余 | `whole`，**整份发** + 明确警告 |

`whole` 的取舍：与其瞎猜配对关系（比不切更糟），不如保留全文并让用户看到警告。

### ⑥ 排障可见性

每段的 `job.params.shotSplit` 记录切分策略与实得 Shot 编号：

```js
{ mode: 'one-to-one', shots: [4] }
```

`mode: 'whole'` 一眼看出「这段收到的是整份提示词」。

### 验证

| 项 | 结果 |
|---|---|
| 用户真实提示词（7 段 7 镜）| 每段通用要求 **12/12 全保留** |
| 每段只含 1 行 `[Shot]` | ✅ |
| 重号 `[Shot 6]`×2 | 段 6/段 7 各取其一，不串 |
| 3 Shot 切 2 段（不整除）| `whole` + 警告 |
| 4 Shot 切 2 段（整除）| `grouped`，段 1 得 [1,2] |
| 检测重号 / 缺号 | ✅ |
| 冒烟测试 | **207 / 207** |

新增 3 条回归测试。

---

## 2.18.1 — 翻译覆盖全字段 + 占位符校验（2026-11-21）

> 首次实测本地 7B 翻译后的两处修正。

### ① 翻译范围扩大到全部字段

早先只翻 `summary` 和 `stray`，**排除了含 `<Subject N>` 的句子**，
理由是"怕模型把占位符改坏"。

结果 `subjects` / `video` / `guards` 三段**整段保持中文** ——
实测输出里还剩 68 个中文字符。而这三段恰恰是身份绑定和防漂移声明，
是最该让模型读对的部分。

现在改成：**所有含中文的句子都送翻**（触发词除外），
翻完再用正则校验占位符数量。

### ② 占位符数量校验

模型偶尔会把 `<Picture 1>` 翻成"图片1"或加空格，那样 H3 就认不出了。

校验规则：`原文占位符数 == 译文占位符数`，不等就**丢掉这条译文**、保留原文。
宁可中英混排，也不能破坏 `<Picture 1>`。

被丢弃的条数会写进 `warnings`，用户知道发生了什么。

### ③ 超时与错误归因修正

`TRANSLATE_TIMEOUT_MS` 从 3 分钟提到 5 分钟、`LOAD_TIMEOUT_MS` 提到 15 分钟。

原因：首次加载 7B 4bit 要读 15GB 权重并量化，**冷启动 5–10 分钟很常见**。
此前 3 分钟超时会在加载途中触发，而错误信息说"翻译超时"——
**错误归因**比超时本身更浪费时间。

### ④ 模型下载踩到的坑（非代码问题，记录备查）

`snapshot_download('Qwen/Qwen2.5-7B-Instruct')` 会**卡在下载分片阶段不动**
（只下到分词器等小文件，4 个 safetensors 一个都没下来）。

改成显式逐文件下载即可：

```python
files = ['model-0000%d-of-00004.safetensors' % i for i in range(1, 5)]
for f in files:
    hf_hub_download('Qwen/Qwen2.5-7B-Instruct', f)
```

实测速度：第一个分片 314 秒（3.95GB），后续分片 10 秒内完成（走缓存校验）。

另外需要 `bitsandbytes>=0.46.1`（4bit 量化），否则报
`Using bitsandbytes 4-bit quantization requires bitsandbytes`。

### 实测结果

用用户真实提示词（559 字、210 个中文字符、含 DR34ML4Y 触发词）端到端跑：

| 指标 | 编译前 | 编译后 |
|---|---|---|
| 长度 | 559 | 1345 |
| 中文字符 | 210 | **0** |
| 触发词 | 保留 | **保留（逐字未动）** |
| 占位符 | — | `<Subject 1>` `<Picture 1>` `<Video 1>` 全部完整 |
| 耗时 | — | **30 秒** |

输出结构正确：触发词置顶 → 总结句 → Subject/Video 绑定 → 动作细节 → 防漂移声明。

### 验证

- 冒烟测试 184/184
- `node --check` 全通过

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