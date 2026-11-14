# 变更日志

本文件记录九章工作室插件的所有重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

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
