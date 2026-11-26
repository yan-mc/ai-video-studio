# M4 桥接层审计

> 范围：`host/bridge/` 全部 10 个代码文件 + README（逐行通读）
> 交叉核对：`vendor/nanfeng/*.py`（221 参数真源）、`host/services/{generator,render-plan,ref-images,replace,replace-runner,shot-context,accel-plan}.js`、`host/api/{index,prompt-compile}.js`、`host/tools.js`、`skills/prompt/jiuzhang-prompt-spec.md`、`docs/PARAM-AUDIT.md`
> 只读声明：未修改仓库任何源文件（唯一写入为本报告），未启动/停止 ComfyUI，未跑 build。
> 验证手段：`read`/`grep`/`glob` 逐行读 + PowerShell 正则统计（参数计数、flag 计数、画风串 lint 命中、vendor 消费点）+ 上游源码行号回查。
> 问题计数：**P0 2 / P1 12 / P2 14 / P3 12**（另有 3 条"已确认正确"的结论记在 §四.4，避免下一轮重复怀疑）。

---

## 一、模块结构（文件 → 职责 → 行数 → 对外导出 → 调用方）

| 文件 | 职责 | 实际行数（文件头声称） | 主要导出 | 调用方 |
|---|---|---|---|---|
| `bridge/index.js` | 唯一门面；9 个命名空间 + 直出符号 + `BRIDGE_LAYOUT` 自检表 | 142（注释称 131） | `nanfeng` `nanfengSchema` `nanfengGraph` `nanfengPresets` `continuation` `prompt` `promptNormalizer` `llm` `storyboard`；`buildShotWorkflow` `compileH3Prompt` `PARAM_COUNT` `CONSTRAINT_RULES` 等 | `api/index.js:21`、`api/prompt-compile.js:9`、`services/generator.js:635`、`services/replace.js:403`、`services/replace-runner.js:259/417`、`tools.js`（22 处动态 import） |
| `vendors/nanfeng/schema.js` | 221 参数机读定义（group/type/default/options）+ `enrichSchema` / `inertParams` | 348 | `PARAMS` `GROUPS` `PARAM_COUNT` `paramsOfGroup` `defaults` `enrichSchema` `inertParams` | 门面、`api/index.js:166`、`tools.js:125`、`tools/audit-params.mjs:42` |
| `vendors/nanfeng/param-docs.js` | 221 条中文释义 + `dead/banned/advanced` 标记 + `GROUP_DOCS` | 664 | `PARAM_DOCS` `GROUP_DOCS` `paramDoc` `groupDoc` `deadParamNames` | `schema.enrichSchema`（同层） |
| `vendors/nanfeng/graph.js` | `coerceTypes` / `sanitize` / `applyFixes` / `splitSecondPassSteps` / `fetchAvailableNodes` / `buildWorkflow` / `mergeParams` / `continuationTask` | 556 | 同上 + `NANFENG_NODE` `NANFENG_OUTPUT` `DIRECTORY_DRIVEN_PARAMS` `coerceIssues` `resetNodeCache` | 门面、`vendors/nanfeng/index.js`、`api/index.js:219` |
| `vendors/nanfeng/presets.js` | 7 内置预设 + `SIGMA_PRESETS`(4) + `validateSigmaSequence` + 3 层合并 | 409 | `BUILTIN_PRESETS` `DEFAULT_PRESET` `builtinPreset` `listBuiltinPresets` `parsePresetSpec` `resolvePresetLayers` `SIGMA_PRESETS` `validateSigmaSequence` | 门面、`api/index.js:186/218/2450`、`tools.js:126` |
| `vendors/nanfeng/index.js` | `buildShotWorkflow` / `buildShotOverrides` / `toComfyFileName` / `CONSTRAINT_RULES` / `checkConstraints` | 491（注释称 463） | 同上 | 门面直出、`generator.js:987`、`smoke-api.mjs` |
| `vendors/nanfeng/continuation.js` | 续写批次：folder hash / 网格吸附 / `planSegments` / `runBatch` / 落盘 / 状态机 | 613（注释称 576） | `CONTEXT_ROOT` `CONTEXT_LENGTHS` `contextFolder` `validateSettings` `createBatch` `taskFor` `saveBatch/loadBatch/listBatches` `advanceStatus` `nextPendingIndex` `cleanupContext` `snapToGrid` `planSegments` `runBatch` `resetFromFailure` | `api/index.js` 6 处、`services/replace.js:403`、`replace-runner.js:259/417` |
| `prompt/h3-prompt.js` | 六段式/三字段编译器 + 画风库 + 打光库 + 续写开关 + 压制词落位 + lint + 截断 + 镜头输入包适配 | **2169**（门面注释称 2,142） | `H3_LIMITS` `H3_MODES` `STYLE_PRESETS` `LIGHTING_PRESETS` `CONTINUATION_SWITCH` `TRIM_DISCIPLINE` `SUPPRESSION_GUARDS` `RETENTION_VISUAL/AUDIO` `SUMMARY_TASKS` `routeFormat` `compileH3Prompt` `resolveContinuation` `resolveLighting` `styleLightingConflicts` `truncatePromptKeepFields` `lintCompiledPrompt` `h3Frames` `timecode` `cameraPhrase` `toShotInputPackage` | `api/index.js:1871/1906`、`api/prompt-compile.js:123`、`tools.js:18/312/341` |
| `prompt/prompt-normalizer.js` | 换人自由文本 → 四段式；规则引擎 + 可选本地翻译 | 256（注释称 232） | `hasCjk` `splitReplacePrompt` `joinReplacePrompt` `normalizeByRules` `normalizePrompt` | 仅 `api/index.js:2532`（`POST /replace/compile-prompt`） |
| `llm/dsh-llm.js` | `ctx.llm.stream` 包装：文本/视觉 + 模型解析 + 状态 | 290（注释称 274） | `llmService` `attachmentsService` `defaultModelService` `resolveModel` `callText` `callVision` `guessMediaType` `llmStatus` | `api/index.js:501/520`、`tools.js:1212` |
| `llm/storyboard.js` | 7 模式契约 + SKILL 装配 + 逐图提示词 + 输出解析 + token 预算 | 379（注释称 349） | `STORYBOARD_MODES` `SKILLS` `visionPrompt` `modeContract` `outputBudget` `validateContinuationContext` `loadSkill` `buildStoryboardMessages` `parseStoryboard` `collectText` | `api/index.js:500/519`、`tools.js:1211` |

**依赖方向实测**：`bridge/ → host/store`（`h3-prompt.js:55`、`vendors/nanfeng/index.js:68`）合规；**`bridge/ → host/services` 存在一处违规**（见 P1-02）。

---

## 二、功能清单

### 2.1 参数通道（221 → ComfyUI `/prompt`）
`buildShotWorkflow`（`vendors/nanfeng/index.js:99`）的合并顺序实为 7 层：
schema 默认 → 内置预设（可 chain 叠加）→ 项目预设 → 镜头 `nanfeng.overrides` → `buildShotOverrides`（模式/时长/提示词/种子/素材槽）→ `extraParams`（含 `slotPlan.frameSlots`、accel、编译后的提示词）→ `applyFixes`。
`graph.mergeParams` 起底 `schemaDefaults()`，`if (k in base)` 过滤未知键（`graph.js:547-555`）。
出图前依次：`coerceTypes`（`graph.js:89`）→ `applyFixes`（`:326`，含 `splitSecondPassSteps`）→ `sanitize`（`:230`）→ 按 `PARAMS` 键序摊平成 221 键 inputs（`:471-474`）→ 固定节点 `'1'` + `VHS_VideoCombine`（`:476-504`）。

### 2.2 提示词通道
`routeFormat`（`h3-prompt.js:621`）五分支：有视频/音频 → ref；声明 ref2va 且有图/有角色卡编号 → ref；关键帧模式 → base；有图未声明 → ref；纯文本 → base。
`compileRef2VA`（`:1023`）固定六段：`subject_definitions` → `summary` → `retention_analysis` → `detailed_description` → `overall_soundscape` → `non_diegetic_music`；`compileBase`（`:876`）为「对齐指令 + 空行 + 三字段」。
输出出口统一过 `lintCompiledPrompt`（`:814`）→ 按字段边界截断到 6000（`:830-842`）。
参考图编号的唯一真源是 `services/ref-images.js:planImageSlots`（槽位号，首尾帧占 1/2），编译器只消费 `subjects[].pictureIndex`。

### 2.3 续写通道
`createBatch` → `contextFolder`（sha256 of json([workflow,node,group,run])，`continuation.js:59`）→ `taskFor`（每段 JSON，段 1 也带 index=1）→ `runBatch` 串行 + 每段落盘 → `<dataDir>/runs/<batchId>.json`。
提示词侧：`resolveContinuation`（`h3-prompt.js:390`）判 `index>1` → 顶部拼 `CONTINUATION_SWITCH.carried` + `TRIM_DISCIPLINE.carried`。
参数侧：`buildShotWorkflow` 有 `contTask` 时强制 `启用潜空间续写=true` + 写任务 JSON（`vendors/nanfeng/index.js:190-192`），无任务时降级为单镜并 warning（`:193-223`）。

### 2.4 LLM 通道
`llmStatus` → `callVision`（本地文件 → `attachments.saveImages` → `{type:'image',attachment}`）/ `callText` → `collectStream` 显式检查 `finish.reason.kind === 'error'|'aborted'` 与空输出（`dsh-llm.js:143-168`）。
`storyboard.buildStoryboardMessages` 装配 SKILL + 模式契约 + 时长/context 契约；`parseStoryboard` 校验段号连续，数量不符才退回 `---` 切分。

---

## 三、问题清单

> 严重度：P0 静默错误结果/数据丢失/崩溃｜P1 功能失效或违反契约｜P2 可维护性｜P3 文档与代码不符

### P0（2 条）

**P0-01｜`api/prompt-compile.js:56` + `h3-prompt.js:2001-2010`｜镜头卡残留的 `shot.subjects[].pictureIndex` 直接压过真实槽位规划，`<Picture N>` 静默指向别的素材**
- 症状：镜头卡一旦存过 `subjects`（带 `pictureIndex`），`compilePrompt` 就取 `shot.subjects` 而不是当前 `planImageSlots` 的结果；`normalizeSubjects` 对 `pictureIndex !== null` 的值原样采信。若之后用户增删了参考图、或 `fl2va` 开始占 1/2 号槽，提示词里的 `<Subject 1> … <Picture 1>` 仍指旧编号 → 串脸/把道具当人，全程无告警、无 lint 可查（lint 只查字段与语言，不查编号存在性）。
- 根因：编号「唯一真源」只在**生成时**被计算（`ref-images.planImageSlots`），但编译器对**持久化输入**不做二次核对；`shot.subjects` 是历史快照，没有版本标记也没有与 plan 的比对。
- 修复建议：`compilePrompt` 无论 `shot.subjects` 是否存在，都用 `planImageSlots` 的 `pictureIndexMap` 重写其 `pictureIndex`（编号永远由本次提交的图片清单决定）；或至少 `assert max(pictureIndex) <= images.length` 并在不符时 warning + 回退到 plan 值。

**P0-02｜`services/shot-context.js:207-211`（`resolvePictureIndices` 用 `i + 1`）｜有角色卡时 `pictureIndex` 变成"参考图序号"而不是"槽位号"，`fl2va/i2va` 下整体偏移 1–2；同一仓库里另有两条正确路径，三条并存**
- 症状：`resolvePictureIndices` 把 `resolveRefImages` 输出数组的下标当编号（`byCard.get(r.cardId).push(i + 1)`，`:210`），**完全没有经过 `planImageSlots`**，因此不知道首/尾帧占用 `图片1`/`图片2`。
  - `fl2va` + 1 张角色卡：真实提交 `planImageSlots` 给出 `图片3` → `<Picture 3>`（`ref-images.js:338-351`，`reserved=[1,2]`），而 `resolvePictureIndices` 返回 `pictureIndex: 1` → 提示词写 `<Subject 1> … <Picture 1>`，指向**首帧**。
  - `i2va` + 1 张角色卡：真实槽位 2，函数返回 1，同样错一格。
- 触发面（这是生成主路径，不是预览）：`api/prompt-compile.js:53-56`（`/generate` 与 `studio_generate` 都经 `compilePrompt`）、`api/index.js:1894-1898`（`/prompt/from-shot`）—— 只要 `shot.characterCards` 非空，`cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(shot)`（`prompt-compile.js:56`）就选中**错的那条**。
- 同一语义的三份实现实测：
  | 实现 | 位置 | 用 `planImageSlots`? | 结果 |
  |---|---|---|---|
  | `resolvePictureIndices` | `shot-context.js:198` | ❌ `i + 1` | 偏移 1–2 |
  | `deriveSubjectsFromShot` | `prompt-compile.js:202-216` | ✅ | 正确 |
  | `subjectsForPrompt` | `render-plan.js:540`（消费 `buildRenderPlan` 已算好的 `x.index`） | ✅ | 正确 |
  作者的修复注释（`prompt-compile.js:190-200`）已经痛陈"这是第三套编号实现…同一个镜头编译出的提示词认为角色是 1 号、实际提交是 3 号"，但**只修了 `deriveSubjectsFromShot`，没修被优先选中的 `resolvePictureIndices`**。
- 根因：编号"唯一真源" `planImageSlots` 在 `ref-images.js` 里，而 `shot-context.js` 属于另一条依赖线（工具/REST 共用），历史包袱让它自己数了一遍。
- 修复建议：`resolvePictureIndices` 内部改为调用 `planImageSlots(shot.mode, refs.map(r => r.abs), first, last)` 并用 `pictureIndexMap.get(i)`（照抄 `deriveSubjectsFromShot:201-216` 的写法），然后删掉 `deriveSubjectsFromShot`，只留一条；`smoke-api.mjs` 的"参考图编号全仓只有一份实现"断言（`:3598-3609`）现在只校验 `planImageSlots` 的定义数量，抓不到这种**逻辑重写**，应改为断言 `i + 1` 形式的编号在 `host/` 内零出现。

### P1（12 条）

**P1-01｜`host/tools.js:18,125,126,1211,1212`｜业务层绕过门面直连桥接子目录，且架构守卫不覆盖 tools.js**
- 症状：5 处深路径 import（`:18` 静态 `./bridge/prompt/h3-prompt.js`；`:125/126` 动态 `./bridge/vendors/nanfeng/{schema,presets}.js`；`:1211/1212` 动态 `./bridge/llm/{storyboard,dsh-llm}.js`）。门面注释（`bridge/index.js:57`）与 README:66-67 明令禁止。
- 根因：`tools/smoke-api.mjs:3584` 的守卫只遍历 `host/services` 与 `host/api` 两个目录，**不含 `host/tools.js`**，所以违规长期存在且自检为绿。
- 修复建议：改用 `const B = await import('./bridge/index.js')` 取命名空间；把守卫的扫描范围扩到 `host/` 全目录并排除 `bridge/` 自身。

**P1-02｜`prompt/prompt-normalizer.js:226`｜桥接层反向依赖业务层（`await import('../../services/prompt-llm.js')`）**
- 症状：违反 `bridge/README.md:61`「`bridge/` 不允许 import `host/services/`」。后果有二：① 该文件无法在无 services 的上下文里单测/复用；② 未来若 `prompt-llm.js` 反向依赖 bridge，将形成循环。
- 根因：翻译器只存在于 services，而调用者需要「规则 + 翻译」的组合；没有把「翻译能力」抽象成注入参数。
- 修复建议：`normalizePrompt(raw, cfg, { translate })` 由调用方（`api/index.js:2532`）注入 `translateBatch`；bridge 内不再出现 `services/` 路径。

**P1-03｜`h3-prompt.js:305-318` 定义、`:805-810` 从不使用｜段 1 的「开场声明」开关是死代码**
- 症状：只有 `CONTINUATION_SWITCH.carried` / `TRIM_DISCIPLINE.carried` 会被拼到顶部，`opening` 两个变体从未被注入。而 `:299-303` 注释明写「段 1 要反过来写」、`:803` 也是同一句；`skills/prompt/group-master/SKILL.md:2210` 把「段 1 开场声明」列为已实现。
- 根因：前缀拼接写成了 `cont.isContinuation ? carried : body`（二元），缺少 `else if (cont.index === 1) opening` 分支。
- 修复建议：补 `index === 1` → 拼 `opening + TRIM_DISCIPLINE.opening`；`resolveContinuation` 已能区分 `index===1` 与「无续写」（`:405`），逻辑够用。

**P1-04｜`api/index.js:247` 存了 `batch.contextLength`，但 `:392-401` 组 job 时没下传｜批次级 `context_length` 完全不生效**
- 症状：`createBatch` 把 `contextLength` 存进 batch（`api/index.js:247` → `continuation.js:139`），`runOne` 构造 `job.params` 时只有 `nanfengPreset / nanfengMode / continuationTask / seed / batchId / batchIndex`；`runH3Nanfeng` 的 `extraParams = job.params?.nanfengExtra`（`api/index.js:2773`）为 undefined。最终 `context_length` 来自预设 `presets.js:131/160` 写死的 `'22'`，提示词侧的裁切纪律也读 `'22'`（`prompt-compile.js:72`、`h3-prompt.js:2129`）。
- 症状补充：用户建批次时选 56（2.33s），`/nanfeng/continuation/plan` 也按 56 规划段时长（`:323-331`），实际每段只裁 22 帧 → 交付总时长比规划短一截，接缝比预期明显，**零报错**。同一 bug 的孪生版本已在换人链修过（`replace-runner.js:757-773`，注释里写着"设了 56 实际仍按 22 跑"）。
- 修复建议：`runOne` 里补 `nanfengExtra: { context_length: b0.contextLength, audio_context_length: b0.audioContextLength }`；`compilePrompt` 用 `job.params` 的批次值而不是 `shot.nanfeng.overrides`。

**P1-05｜`graph.js:461-468`（`applyFixes` 在前、`sanitize` 在后）+ `:245-247`｜非法显式值会被回退成**上游默认值**，从而重新打开会崩的加速项**
- 症状：用户显式传 `SageAttention: 'foo'`（拼错）或 `H3专用注意力: 'h3专用sage'`：`applyFixes` 因 `explicit` 跳过（`:366-367`），随后 `sanitize` 判非法并 `out[key] = def.default`（`:246`）。而 `SageAttention` 的 schema 默认是 `'auto'`（`schema.js:62`）、`H3专用注意力` 默认是 `'H3专用Sage加速'`（`:152`）—— 恰是 `PARAM_FIXES:152-180` 存在的唯一理由（本机未装 SageAttention，这两值必崩）。
- 根因：`sanitize` 不知道「这个键已被环境修正处理过」，回退目标选 schema 默认而非"修正后的值"；两函数顺序让修正被覆盖。
- 修复建议：① 顺序改为 `sanitize → applyFixes`；② 或让 `sanitize` 以 `applyFixes` 的结果为回退源；③ 最低成本：把 `PARAM_FIXES` 的 key 加入 `sanitize` 豁免集并给 warning。

**P1-06｜`vendors/nanfeng/index.js:397-463`｜`CONSTRAINT_RULES` 只覆盖上游 15 条硬校验里的 8 条；「槽位不连续」与「ref2va 零素材」会到 GPU 排队后才失败**
- 覆盖实测（逐条对比 `vendor/nanfeng/h3_generator.py:1335-1410` 的 `raise ValueError`）：

| vendor 行 | 上游硬校验 | 桥接是否拦截 |
|---|---|---|
| `:1338` | 续写 ⊥ 锁音频/音频驱动/时间轴 | ✅ `continuation-vs-audio-lock` |
| `:1340` | 续写 ⊥ 潜空间放大二采 | ✅ `continuation-vs-latent-upscale` |
| `:1368` | 音频驱动必须同时锁音频 | ✅ `audio-drive-needs-lock` |
| `:1378` | 三模式只能开一个 | ✅ `mode-exclusive` |
| `:1390` | 图生/首尾帧不接受视频音频 | ✅ `frame-modes-reject-video-audio` |
| `:1394/:1396/:1398` | 文生不带图 / 图生恰 1 图 / 首尾帧恰 2 图 | ✅ `t2va-rejects-images` / `i2va-needs-one-image` / `tl2va-needs-two-images` |
| `:1387` | **`图片/视频/音频` 槽位必须从 1 连续，不能跳号** | ❌ 缺 |
| `:1400` | **`ref2va` 至少要有一张图/一段视频/一段音频** | ❌ 缺 |
| `:1375` | 音频驱动模式必须给 `音频驱动文件` | ❌ 缺 |
| `:1403/:1405/:1407` | 锁音频只适用 ref2va / 必须给音频1 / 只能锁音频1 | ❌ 缺 |
| `:1410` | 「原图比例」只适用图生/首尾帧 | ❌ 缺 |

- 症状 A（跳号，最危险）：`generator.js:893-896` 用空串**保位**（注释明写"不能 `.filter(Boolean)` 压缩"），`toComfyFileName('')` → `'未选择'` → vendor `_clean_filename`（`:204-206`）还原成 `''`。「视频2 上传失败、视频3 成功」于是形成 `['v1','','v3']`，vendor `:1381-1387` 抛 `视频槽位必须从1开始连续添加，不能跳号` —— 在 ComfyUI 排队之后、以 `COMFY_EXEC_ERROR` 形式回传。保位与连续性两个要求**互相矛盾**，而插件只实现了保位。
- 症状 B（零素材）：镜头 `mode:'ref2va'` 但 `refs` 全空 → `modeFlags('ref2va')` 写三个 `false`（`graph.js:418-424`）→ vendor `:1400` 抛「请至少拖入一张图片」。`routeFormat` 此时其实已把格式路由成 `base`/`t2va`（`h3-prompt.js:687`），但**参数侧仍按 ref2va 提交**，提示词与参数不一致。
- 根因：`CONSTRAINT_RULES` 是"照着踩过的坑逐条补"，没有与 vendor 的 15 条 `raise` 做一次性对照。
- 修复建议：① 以 vendor 的 `raise ValueError` 清单为**待办列表**补齐规则（缺的 5 条各写 3 行）；② 提交前检查 `stagedVideos/stagedAudios` 连续性，不连续时要么压缩并重写 `<Video N>`，要么立刻抛可读错误；③ `checkConstraints` 应接受 `mode` 并校验「mode 与提示词格式」一致。

**P1-07｜`h3-prompt.js:1514-1520` + 画风串 `:146/155/164/173/182/191`｜lint 把官方画风串自带的「NO x, NO y」/「DO NOT …」判成「没有通道的负面句」→ 11 个画风里 6 个在 Ref2VA 主路径必误报**
- 症状（本轮实测）：把 `STYLE_PRESETS[*].en` 原文喂给 `scanSuppressionPlacement` 的三条强信号正则，命中 6/11：
  - `helltaker-look` / `ova90s` / `shinkai` / `ghibli` / `american-toon` → `NO subtitles, NO on-screen`（`/\bNO\s+[a-z][\w-]*(?:\s*,\s*NO\s+[a-z][\w-]*)+/`，`:1518`，**不要求句首**）
  - `helltaker-style` → `. DO NOT c`（`/(?:^|[.!?;]\s*|\n\s*)Do not\s+[a-z]/i`，`:1515`，`i` 标志使 `NOT` 命中，而原文是 `DO NOT change character proportions`）
- 剥离逻辑只移除 `^Text suppression:` 整行（`:1492`）与 `with no …` / `whose…` 从句（`:1500-1501`），**没有豁免画风块本身**；`lintCompiledPrompt` 只剥 `CONTINUATION_SWITCH/TRIM_DISCIPLINE`（`:1625-1628`）。
- 后果：主路径每条 Ref2VA 提示词都会带一条"发现没有通道的负面句…请改成正向陈述"进 `job.warnings`（`api/index.js:2745-2747`）。用户照做就会破坏「画风串逐字照抄，不缩写、不改写」铁律（spec §7 / v2.1 §3.1）。
- 修复建议：把编译器自己注入的段落（画风 `style.en`、打光 `lighting.en`、`SUPPRESSION_GUARDS`）按**值**加入剥离白名单，而不是靠"段落名/句首"匹配；`Do not` 规则去掉 `i` 标志或只认句首（原文的 `DO NOT` 出现在句中 `. ` 之后，是官方画风串的一部分）。

**P1-08｜`generator.js:186-190`（提交期）+ `:994`｜`injectCardDefinitions` 在六段提示词**末尾**追加非官方段，绕过 lint**
- 症状：`hasDefsField` 为真时返回 `${text.trimEnd()}\n\nAdditional reference bindings:\n${cardLines}` —— 追加在 `non_diegetic_music:` 之后，形成第 7 个非官方字段；`cardLines` 里 `card.description` 是中文（`:172`，注释自称"原文保留"），直接违反「正文必须英文」铁律；`<Subject identity: 名字>` 也不是官方标签形态。而 `lintCompiledPrompt` 跑在**编译期**（`h3-prompt.js:814`），注入发生在提交期，无人复检。
- 根因：桥接层已有唯一的六段组装器（`compileRef2VA`），服务层又保留了一份"补卡"逻辑；作者自己也写明"铁律：绝不覆写模型写好的 subject_definitions"，但"追加"同样是改写结构。
- 修复建议：把角色卡绑定下沉到编译期的 `subjects` 入参（`render-plan.subjectsForPrompt` 已是正确做法），删掉提交期注入；若必须保留，则注入后必须重跑 `lintCompiledPrompt` 并把 `Additional reference bindings` 排到 `subject_definitions` 段内。

**P1-09｜`param-docs.js:186-189`（标记 dead）vs `render-plan.js:109-128` / `generator.js:209-212` / `h3_generator.py:1604`｜「参考图尺寸 match/max」是死通道，产品却仍在给用户档位、给显存降级提示**
- 症状：vendor 在 ref2va 路径硬编码 `"ref_image_size": "max"`（`h3_generator.py:1604`，并在 `:1854` 注释确认"当前固定 ref_image_size=max"），`参考图尺寸` 只是形参零使用 —— `param-docs.js:186-189` 已正确标 `dead`。但 `render-plan.js:109-128 decideRefImageSize` 仍在按显存把用户的 `max` 降级成 `match` 并生成中文理由，`generator.js:209-212` 把它写进 `job.params.refImageSizeDowngraded`，渲染页 `REF_IMAGE_SIZE_MODES`（`render-plan.js:76-79`）仍展示两个档位。
- 后果：用户以为"显存不够所以降级了"，实际从来都是 max；"降成 match 省显存"的告警是**反向误导**（真实显存占用一直是 max）。
- 修复建议：删除 `decideRefImageSize` 的降级路径与 UI 档位（或把它接到真正的参数通道并回报上游已支持），`param-docs` 的 dead 标记与 UI 必须二选一。

**P1-10｜`param-docs.js:396-399` 标 `dead`，但插件自己靠它设 DMAD 的 shift（`generator.js:736-745` → `h3_generator.py:1727/1743/1750-1754`）**
- 症状：`启用西格玛调节` 被标「【已失效】…h3_generator.py:1687 硬编码 sigma_requested = False」。实测 `:1727` 是 `sigma_requested = bool(kwargs.get("启用西格玛调节", False))`（读用户值），`:1743` `need_sigma_shift = bool(sigma_requested)`，`:1746-1754` 据此插入 `MiniMaxH3SigmaShift` 并写 `shift_video/shift_audio`。而 `generator.js:737-741` 正是把 `启用西格玛调节=true` + `原生轨迹` + 12/2 灌进去，是 DMAD 不出分布外的唯一通道。文件头 `:25`、`:32`、`:36` 引用的 `hd_second_pass = False`/`elif False:` 在现版源码里已不存在（分别只剩 `:1729` 的一行注释、0 命中）。
- 后果：UI 把它灰显折叠 + 标「已失效」（`PARAM-AUDIT.md:37-38` 的 flag 语义），而它实际决定全片 sigma shift；用户想手动调 shift 时会被 UI 误导。
- 修复建议：撤掉 `启用西格玛调节` / `视频西格玛偏移` / `音频西格玛偏移` / `Sigma策略` 的 dead 标记（`Sigma策略` 仅 `sigma_enabled` 派生，属"部分生效"，应标 advanced 并在 hint 里写明「只有原生轨迹可达 shift 调节」）；同步重校 `param-docs` 里所有 `h3_generator.py:<行号>` 引用。

**P1-11｜`prompt-normalizer.js` 全文 + `replace-tasks.js:60-61` + `api/index.js:2744`｜换人提示词与六段式没有任何互斥守卫**
- 症状：`normalizePrompt` 只按「占位符/关键词」重排（`RE_SHOT/RE_GUARD/RE_SUBJECT/RE_VIDEO/RE_SUMMARY`，`prompt-normalizer.js:48-53`），对 `subject_definitions:` / `summary:` / `retention_analysis:` 这类六段字段**没有识别**，它们会落进 `stray` 并被打散到第 3 段；换人链随后把这段文本原样当 `ref2va` 的 `提示词` 提交（`replace-tasks.js:60-61` 只 prefer `body.prompt`），而 `job.prompt` 非空会短路编译（`api/index.js:2744` `job.prompt || compilePrompt(...)`），**lint、字段完整性、语言检查全部跳过**。结果是既非四段也非六段的混合体，中文正文 + 缺 `overall_soundscape` / `non_diegetic_music`，且无任何告警。
- 根因：换人线是独立业务（skill 明令"互斥、不得混用"），但契约没有落到代码里：既没有 `assertNoSixField`，也没有"换人提示词不得含官方字段名"的校验。
- 修复建议：`normalizePrompt` 入口检测六段字段名，命中即 `throw new Error('REPLACE_PROMPT_MIXED: 换人提示词不得包含六段式字段')`；提交前对 `replace` 任务的 prompt 跑一次"必须含 `<Subject N>` + `<Picture N>` + `<Video 1>`，且不得含 `subject_definitions:` 等"的结构断言。

**P1-12｜`api/index.js:350-352` + `continuation.js:525-538`｜批次并发保护只靠 API 层状态位，无租约、无进程内锁**
- 症状：唯一保护是 `if (b0.status === 'running') return 409`（`:350-352`）。`runBatch` 自身不校验、不写租约（`:525-538` 只 `loadBatch` → `status='running'`）。单进程内靠「同步 IO + 单线程」侥幸成立（`loadBatch`/`saveBatch` 都是同步），但：① 两个 DSH 会话/两个进程会各自跑同一批次，往同一 `clip_<index>` 目录写（vendor 侧 folder 由 batchId 决定，必冲突）；② 进程崩溃后状态永久停在 `running`，只能手工改 JSON。
- 修复建议：`runBatch` 开头做一次 compare-and-set（读 → 校验 `status !== 'running'` → 立刻写 `running` + `runnerPid` + `heartbeat`，两端都在同一同步块内），并把超过心跳阈值的 `running` 视为可接管。

### P2（14 条，列最严重 5 条于此并给全部清单）

**P2-01｜`graph.js:126-131`｜BOOLEAN 的"未提供就 `delete`"会让必填键消失**
`delete out[key]` 的语义是「未提供 ≠ 关闭」，但南风 221 个参数**全部**是 `required`（`h3_generator.py` 的 `INPUT_TYPES` 全在 `required` 下）。`buildWorkflow` 按 `PARAMS` 键摊平（`:471-474`）时该键变 `undefined`，`JSON.stringify` 直接丢弃 → ComfyUI `required_input_missing`。应回退到 `def.default`（与"显式 false"仍可区分：只对 `null/''` 生效）。

**P2-02｜`h3-prompt.js:2010` / `:2095` / `render-plan.js:559`｜编号兜底散在 3 处（`shot-context.js:210` 那处已升级为 P0-02）**
真源只有 `ref-images.planImageSlots`，但 `normalizeSubjects` 有 `i + 1` 兜底（`:2010`）、`toShotInputPackage` 有 `pictureIndexBase + i`（`:2095`）、`subjectsForPrompt` 有 `i + 1`（`render-plan.js:559`）。三者都**不感知首尾帧占槽**，一旦命中就整体偏移 1–2。建议把兜底改成 `throw` 或至少 warning，编号只允许来自 plan。

**P2-03｜`h3-prompt.js:1577-1585`｜截断算法"第一次试验就超限 → 直接掉到每块 1 句"，从 6001 字符砍到约 1/3**
循环从 `keep = 4` 起步：`limitBlock` 对句子数 ≤ keep 的块原样返回。若 6 个字段各保留 4 句后总长仍 > 6000（大六段提示词极常见），**第一次迭代就 `break`**，`best` 恒为 null，直接落到 `limitBlock(..., 1)` —— 每块只留 1 句。于是 6001 字符会被砍到约 1500–2000，而用户只看到"已截断到 N"，不知道砍掉了 2/3。另：`keep += 2` 的粒度让"刚好放得下"的解常被跳过。应按字符预算对**每个字段**做二分/等比压缩，而不是"句子数线性试 + 兜底 1 句"。

**P2-04｜`presets.js:270-308`｜`validateSigmaSequence` 在生产链路零调用，且校验不全**
全仓仅 `tools/smoke-api.mjs:2001-2038` 调用；`H3完整Sigma序列` / `V81一采使用手动Sigma` 提交前无人校验 → 格式错只能等 vendor `_parse_manual_sigmas`（`h3_generator.py:209-220`）在展开图时抛错。校验本身缺：首值 ≤1（vendor 对 `H3二采Sigma` 有 `:229-230`）、与当前 `H3一采步数+H3二采步数` 的联动（`opts.latentUpscale` 默认 false，调用方不传就完全不检查个数）。所谓"误报"风险低；真正的问题是**漏报 + 无调用点**。

**P2-05｜`graph.js:547-555` + `index.js:140-144`｜未知键被静默丢弃**
`mergeParams` 的 `if (k in base)` 与 `extraParams` 的 `if (k in params)` 都是静默 continue。Agent 传 `params: {'采样器r': 'lcm'}` 或用户镜头 overrides 里字段名拼错 → 参数根本没进去，`job.params` 里也看不到，出片参数与意图不符且零告警。建议收集 `unknownKeys` 进 warnings（这是本项目反复出现的"静默改值"同类）。

其余（同属 P2，证据齐全，按需修）：
- **P2-06** `continuation.js:538/551/570/577` 四处裸 `saveBatch`，`:202-236` 在 8 次重试后 `throw` → 批次永久停在 `running`，`nextPendingIndex` 返回 null，只能手改 JSON；且 `:230-231` 是同步自旋（最长 ~85ms×8），阻塞 Node 事件循环。
- **P2-07** `llm/storyboard.js:371-379 collectText` 复刻了 `dsh-llm.js:143-168` 已修掉的 bug（只看 `text-delta`、不查 finish、空输出不抛），且全仓 0 调用 —— 死代码 + 陷阱。同文件 `SKILLS[*].legacyTextKeys`（`:59/65`）无读取点。
- **P2-08** `continuation.js:305-309 cleanupContext` 恒 `removed:false`，latent 目录永不回收（vendor `latent_continuation.py` 只写不删），跑多批后是 GB 级残留；至少应在 README/接口返回里明确"需人工清理"。
- **P2-09** 死导出：`continuation.js:333 snapToGrid`（0 生产调用，`planSegments` 自己内联建网格）、`h3-prompt.js:60 RETENTION_VISUAL`（0 引用）、`graph.js:207 DIRECTORY_DRIVEN_PARAMS`（0 引用，且与 `SKIP_SANITIZE` 语义混用）。
- **P2-10** `h3-prompt.js` 2169 行单文件 11 个分区（详见第四节）。
- **P2-11** `graph.js:387-402` 能力探测 `!res.ok` 与 `catch` 都 `return null`，调用方 `generator.js:981-985` 只 `catch {}`；ComfyUI 短暂不可达时**动态修正全部跳过**（本机 `H3SLAAttention` / `MiniMaxH3BlockCacheT8` / `MiniMaxH3TRTVAELoader` / DLSS 全部 MISSING，修正是必需的），最终在 GraphBuilder 展开期以 `node not found` 失败，错误与"探测失败"无关联。应返回 `{set, degraded, reason}` 并转成 job warning。
- **P2-12** `continuation.js:61-64` 用 `JSON.stringify(...).replace(/,/g,', ').replace(/:/g,': ')` 模拟 `json.dumps` 默认分隔符；UUID 安全，但任何含 `,` / `:` / 转义字符的 id 都会算出与 Python 不同的 folder → 段 2 找不到 clip_1。
- **P2-13** 预设与加速方案是**两个真源**：`presets.js:41/58/80/101/127/155/180` 七套预设全写 `采样器:'lcm'` + `调度器` + `采样步数`，`accel-plan.js:66-125` 又写一遍。当前靠 `generator.js:749` 把 accel 放最后覆盖兜住；一旦合并顺序调整就静默错配（`none` 方案 + lcm 是典型的分布外）。
- **P2-14** `graph.js:152-180 PARAM_FIXES` 无条件把 `SageAttention→disabled`、`H3专用注意力→关闭` 写死为"本机未装"，与 `:333-364` 的能力探测设计自相矛盾：用户真装了 SageAttention 也开不了（只能靠显式传参绕过，而显式传参又会触发 P1-05）。

### P3（12 条）

- **P3-01** `bridge/index.js:16`、`README:48` 仍写「`h3-prompt.js` 2,142 行」，实测 **2169**；`bridge/index.js:57` 的"只 import 门面"同 README:11 的表也未提 `prompt-normalizer` 的 services 依赖。
- **P3-02** `param-docs.js:25/32/36` 引用的 `h3_generator.py:1689 hd_second_pass = False`、`:1796 elif False:` 在现版源码**只剩一行历史注释**（`:1729`）或 0 命中；`:398` 的 `:1687`、`:418` 的 `:1702-1705`、`:421` 的 `:2249` 同样过期（真值在 `:1727/1743-1745`）。凡注释引用 vendor 行号都需重校。
- **P3-03** `docs/PARAM-AUDIT.md` 三套计数**互相矛盾**：§一（`:19-25`）A114/B8/C47/D48，但 122+95=**217≠221**；§三（`:81`）写"`inertParams()` 返回 `flag==='dead'` 的 **37** 项"；§三合计（`:185-187`）算到 **46**；§十（`:387-392`）又写 C46 / 无效 94 / 可用 123。代码实测（本轮复核）：`PARAMS=221`、12 组计数合计 221、`PARAM_DOCS=221`（与 schema 双向零缺）、`dead=47`、`banned=48`、`inert=95` → 真正可用应为 **126**。**四张表没有一个全对**，只有 `dead=47 / banned=48 / inert=95` 这组数字与代码一致。
- **P3-04** `PARAM-AUDIT.md:367-371` 的打光表只有 6 条，缺 `closeup-6-1`（`h3-prompt.js:496`，代码 7 条；`bridge/README.md:12` 写"打光 7"是对的）。
- **P3-05** `skills/prompt/jiuzhang-prompt-spec.md:3`（frontmatter）写「9 种本地画风」，`:282` 正文与代码都是 **11** 种。
- **P3-06** spec `:135` 的 `subject_definitions` 示例含 `This subject is the on-screen speaker (S1).`，而代码只在真有台词时才写（`h3-prompt.js:1080`，依据 `ref-en.txt:278`「不要给每个 subject 都写 (Sx)」）—— 文档在教一个已被官方否定的写法。
- **P3-07** spec `:193`「detailed_description 官方建议 350–500 英文词」在代码里没有对应校验（`h3-prompt.js:1352` 只在"内容 ≤1 句"时 warning），`lintCompiledPrompt` 也不查词数。
- **P3-08** spec `:455` 反模式 16「`[char:]`/`[shot:]` 必须剥离」未进 `lintCompiledPrompt`（只查了 `[Pan left]` 与时间区间，`:1653/:1647`）。
- **P3-09** `continuation.js:44 CONTEXT_LENGTHS = ['5','22','39','56']` 与 `schema.js:206 options = ['22','5','39','56']` 顺序不一致；前端下拉与校验提示的信息源不同。
- **P3-10** `h3-prompt.js:2158-2165` 的 `engine:{backend,mode,format,steps,seed,ref_image_size}` 无任何消费者，`ref_image_size:'match'` 还与 vendor 实际硬编码的 `'max'` 冲突（见 P1-09）。
- **P3-11** `tools/audit-params.mjs:69/75/82` 的三条 `HARD_OFF.marker`（`sigma_requested = False` / `hd_second_pass = False` / `elif False:`）在现版 vendor 里 0 命中（`sigma_requested` 实测是读参数，`hd_second_pass` 已删），所以"审计结论"实际是按一份**不存在的源码**推出来的 —— 这是 `PARAM-AUDIT.md` 与代码脱节的机器原因。
- **P3-12** `graph.js:161-172` 的「⚠️ 历史缺陷（P0）：…」段落用现在时描述一个已被 `SKIP_SANITIZE` 修掉的行为，读代码的人会以为当前仍在静默换模型。

---

## 四、结构性问题与重构建议

### 4.1 `h3-prompt.js`（2169 行）的分区现状
按文件内注释分隔符实测 11 个区：

| 行范围 | 分区 | 性质 | 建议归属 |
|---|---|---|---|
| 1-56 | 文件头（两套官方格式说明 + 4 条铁律） | 文档 | 移到 `docs/` 或 spec，代码里只留 10 行摘要 |
| 57-126 | 官方枚举（retention 标记 / summary 任务 / 5 模式 / H3_LIMITS） | 常量 | `prompt/constants.js` |
| 127-274 | **画风库**（11 条，含长英文串 + `ban`/`best`/`note`） | 数据 | `prompt/styles.js`（纯数据，可被前端/测试单独 import） |
| 275-378 | **续写开关**（CONTINUATION_SWITCH / TRIM_DISCIPLINE / SUPPRESSION_GUARDS / resolveContinuation） | 机制句 + 判定 | `prompt/continuation-switch.js` |
| 447-598 | **打光库**（7 条）+ resolveLighting + 画风×打光冲突表 | 数据 + 规则 | `prompt/lighting.js` |
| 599-688 | **模式路由** `routeFormat` | 纯逻辑 | `prompt/route.js` |
| 690-861 | **编译主函数** `compileH3Prompt`（编排 + 硬约束自查 + lint + 截断） | 编排 | 保留在 `compile.js` |
| 863-1012 | 基础格式 `compileBase` + 对齐指令 + `frameSlots`/`frameIndex` | 编译器 | `prompt/format-base.js` |
| 1014-1427 | **Ref2VA 六段** `compileRef2VA`（412 行，单函数） | 编译器 | `prompt/format-ref.js`（内部再拆 6 个 `emitXxx`） |
| 1429-1607 | 压制词落位 + 截断 | 检查器 | `prompt/lint.js` / `prompt/truncate.js` |
| 1608-1731 | `lintCompiledPrompt`（8 类规则挤在一个函数里） | 检查器 | `prompt/lint.js`，拆成规则数组 |
| 1733-2067 | 工具函数（duration/frames/timecode/cameraMap/speaker/scene/style/subjects/refs/summary/dedupe） | 混杂 | `prompt/text-utils.js` + `prompt/subjects.js` |
| 2069-2169 | **`toShotInputPackage`（镜头卡 → 编译器输入包）** | **业务适配** | `prompt/shot-adapter.js` —— 它读 `shot.previz/characterCards/nanfeng`，是业务语义，不该和"H3 怎么说话"同文件 |

**该拆而没拆的三处最伤**：① 画风/打光两个**数据表**与编译逻辑同文件，导致 `bridge/index.js` 必须整文件 re-export 才能给前端下拉用（`api/index.js:2456-2459` 就是取 `prompt.STYLE_PRESETS`）；② `compileRef2VA` 412 行单函数，六段里任何一段的改动都要在同一个函数里找；③ `toShotInputPackage` 把「我们的镜头卡形状」写进了「上游提示词怎么说话」的模块，正是这层本该隔离的东西。

### 4.2 已确认的死代码 / 补丁分支（可安全删除）
- `CONTINUATION_SWITCH.opening` + `TRIM_DISCIPLINE.opening`（定义 + lint 白名单在用，但**从不注入**）→ 补注入或删。
- `frameSlots` 里空的 `if (implicit) { /* 注释 */ }`（`:993-996`），无任何语句。
- `refs.firstFrameIndex` 分支（`:962-963`）不可达：`toShotInputPackage`（`:2131-2138`）**从不填**这两个字段。
- `RETENTION_VISUAL`（0 引用）、`h3Frames` 与 `store/models.js:h3Length` 双实现（前者已改为转发，注释保留两套历史说明）。
- `SHORT_STYLE_CHARS` 现在只用于"超长 warning"，变量名仍叫 SHORT（误导）。
- `graph.js` 的 `coerceIssues` 模块级数组（`:59-60`）：`coerceTypes` 每次调用都 `invalid.length = 0`，并发调用（两个 job 同时 build）会互相清空 —— 目前 `buildWorkflow` 是"清空后立刻读"（`:447-451`），窗口极小但存在；建议改成返回值。

### 4.3 边界怎么守住
1. **把守卫从"抽查两个目录"改成"全仓断言"**：`tools/smoke-api.mjs:3582-3595` 现只扫 `host/services` 与 `host/api`，扩为 `host/` 全树（排除 `bridge/`、`node_modules`）并按正则 `bridge/(vendors|prompt|llm)/` 匹配，**同时**反向断言 `bridge/` 内不得出现 `../services/`（这条能当场抓住 P1-02）。
2. **门面收口后再删直出符号**：`bridge/index.js` 已有 9 个命名空间，`tools.js` 的 5 处深路径没有理由存在；改完后可在 `bridge/index.js` 注释里删掉"不要直接 import"这种**靠人记**的约定，因为机器会拦。
3. **编号单源**：把 `planImageSlots` 的返回作为 `compileH3Prompt` 的**必填**上下文（`package.pictureIndexMap`），删掉 `resolvePictureIndices` / `normalizeSubjects` / `toShotInputPackage` / `subjectsForPrompt` 里的 `i+1` 兜底（P0-01、P0-02、P2-02 由此根治）。
4. **提示词只允许一个写者**：`injectCardDefinitions`（提交期）与 `compileRef2VA`（编译期）必须合并到编译期；提交期只允许"原样透传 + 结构断言"，不允许追加字段。

### 4.4 复核确认「正确、无需再怀疑」的三条
避免下一轮审计重复怀疑，这三条已逐行核实为**正确**：
1. **段 1 带 `index=1` 的续写任务**（`vendors/nanfeng/index.js:190-192`、`continuation.js:183-191`、`api/index.js:387-401` 三处一致）：vendor 把读/写 latent 都挂在同一个 `if continuation:` 下（`h3_generator.py:1324-1333` + `:1620`/`:2043` 附近），段 1 必须 Save clip_1，否则段 2 Load 必报 "is neither a file nor a folder"。这条**没有**实现错误。
2. **`runBatch` 的失败即停**（`continuation.js:566-574`）：`catch` 里 `status='failed'` + `advanceStatus` + `saveBatch` + `return batch`，不会继续跑后续段；轮询终态判定（`api/index.js:449-468`）对 `completed/failed/cancelled` 三分支 + 1h 超时 + `finally` 清 timer 也都是对的（`settled` 防重入）。
3. **`contextFolder` 的 sha256 复刻**（`continuation.js:59-66`）：`JSON.stringify([w,node,group,run])` 后 `,`→`, `、`:`→`: `，与 Python `json.dumps(list)` 默认分隔符等价；batchId/runId 是 UUID（无逗号冒号），所以对当前输入**正确**（风险仅在 P2-12 描述的"未来换成含特殊字符的 id"）。

---

## 五、结论

**不能放行（有条件）。** 桥接层的**结构**是本仓库最好的一部分：门面清晰、参数/提示词/续写/LLM 四条通道职责分离、`planImageSlots` 确实是唯一编号真源、`applyFixes`/`sanitize`/`coerceIssues` 的意图都对。问题集中在三类：

1. **契约有文档没代码**（P1-03 段 1 开场声明、P1-11 换人互斥、P2-04 Sigma 校验无调用点）—— 属于"写了注释就当实现了"，这类问题在审计里最容易漏。
2. **单一真源被旁路**（**P0-02** `resolvePictureIndices` 自数一遍编号、P0-01 历史 `shot.subjects` 压过 plan、P1-04 批次 `contextLength` 没下传、P2-13 预设与 accel 双写步数/采样器、P2-02 三处 `i+1` 兜底）—— 全是**静默**类型，不报错，只让片子"看起来差一点"或"脸不对"。
3. **上游事实与本地标记脱节**（P1-09 参考图尺寸、P1-10 `启用西格玛调节`、P3-02/P3-11 行号与 marker 过期）—— `param-docs.js` 是 UI 的真相来源，它错了整块 UI 都在撒谎。

**必须先修（放行门槛）**：
1. **P0-02 + P0-01**（编号）—— 全仓**唯一**会造成静默串脸的两条，且 P0-02 就在 `/generate` 与 `studio_generate` 的主路径上，只影响"绑定了角色卡 + fl2va/i2va"这一最常见组合。
2. **P1-04**（批次 `contextLength`）—— 续写主功能的参数失效，已有孪生修复（`replace-runner.js:757-773`）可照抄。
3. **P1-10 + P1-09**（两个 marker 反向误导）—— 一个让 DMAD shift 在 UI 上"不存在"，一个让显存档位在 UI 上"存在"。
4. **P1-05**（sanitize 回退到危险默认）—— 会让"用户填错一个枚举"升级成"整单崩"。
5. **P1-06**（`CONSTRAINT_RULES` 缺口 + 槽位跳号）—— 保位与连续性互相矛盾，失败发生在 GPU 排队之后。
6. **P1-01 + P1-02**（边界破口）—— 不修则后续所有重构都会继续被绕过。

其余 P1（P1-03/07/08/11/12）可在一次小版本内集中处理；**P2-03（截断一刀切）**建议同批修，它是"6000 上限"这件事唯一真正会伤内容的地方。P3 全部是文档同步工作，建议一次性用**真实输出**回填，不要写死期望值。

### 本轮复核得到的确定性数字（供后续回填用）
```
PARAMS(Object.keys)        = 221        GROUPS 12 组 count 之和 = 221
PARAM_DOCS 条目            = 221        schema↔docs 双向缺失 = 0 / 0
flag dead / banned / advanced = 47 / 48 / 25   inertParams() = 95   真正可用 = 126
presets BUILTIN            = 7          SIGMA_PRESETS = 4
STYLE_PRESETS              = 11         LIGHTING_PRESETS = 7
H3_LIMITS.promptMaxChars   = 6000       promptOfficialMaxChars = 7000
continuation CONTEXT_LENGTHS = ['5','22','39','56']   schema options 顺序 = ['22','5','39','56']
vendor INPUT_TYPES 参数 = 221           显式 raise ValueError（generate 内）= 15
CONSTRAINT_RULES 条目 = 8（覆盖上游 8/15）
```
自检命令（可直接跑，`node` 不在本机 PATH 时用 DSH 自带的 node）：
```
node -e "import('./host/bridge/vendors/nanfeng/schema.js').then(async m=>{const d=await import('./host/bridge/vendors/nanfeng/param-docs.js');const i=m.inertParams();console.log('params',m.PARAM_COUNT,'docs',Object.keys(d.PARAM_DOCS).length,'inert',i.length,'dead',i.filter(p=>p.flag==='dead').length,'banned',i.filter(p=>p.flag==='banned').length)})"
```

其余 P1（P1-03/06/07/08/11/12）可在一次小版本内集中处理；**P2-03（截断一刀切）**建议同批修，它是"6000 上限"这件事唯一真正会伤内容的地方。P3 全部是文档同步工作，建议一次性用**真实输出**回填，不要写死期望值。
---

## 七、修复记录（v4）

> 边界：本轮只改 `host/bridge/**` + 本报告。未触碰 `host/services/**`、`host/api/**`、`host/tools.js`、`host/store/**`、`app-src/**`。
> 验证手段：`node --check` 全量 19 个 bridge 文件（0 失败）；拆分前后 `compileH3Prompt` 输出**逐字符**对比（真实镜头卡 6 个输入包）；门面导出清单 old→new 对比（只增不减）；业务修复点 42 项断言。
> 临时脚本放在 `%TEMP%\jz-bridge-v4\`，**未新增任何仓库内测试脚本**。

### 7.1 结论先行

| 编号 | 状态 | 落点 |
|---|---|---|
| P0-01（bridge 侧） | ✅ 已修 | `prompt/shot-adapter.js:normalizeSubjects` |
| P1-01（bridge 侧门面加强） | ✅ 已做 | `bridge/index.js` + `bridge/README.md` |
| P1-02 | ✅ 已修 | `prompt/prompt-normalizer.js` |
| P1-03 | ✅ 已修（选择"真正注入"） | `prompt/h3-prompt.js` |
| P1-04 | ✅ bridge 侧已修（api 侧待 fix-api 采用） | `vendors/nanfeng/continuation.js` |
| P1-05 | ✅ 已修 | `vendors/nanfeng/graph.js` |
| P1-06 | ✅ 已修（补齐至 15 条） | `vendors/nanfeng/index.js` |
| P1-07 | ✅ 已修 | `prompt/lint.js` |
| P1-08 | ✅ bridge 侧能力已提供（generator 侧待 fix-gen 采用） | `prompt/ref2va.js:cardBindingLines` |
| P1-09 | ✅ 已修 | `vendors/nanfeng/param-docs.js` |
| P1-10 | ✅ 已修 | `vendors/nanfeng/param-docs.js` |
| P1-11 | ✅ 已修 | `prompt/prompt-normalizer.js` |
| P1-12 | ✅ 已修（并额外修掉"崩溃段永久卡 running"） | `vendors/nanfeng/continuation.js` |
| P0-3（重命名/原子写） | ✅ 已修 | `vendors/nanfeng/continuation.js` |
| P2-01 / 03 / 04 / 05 / 11 | ✅ 已修 | graph / lint / index / graph |
| 结构性重构（h3-prompt 拆分） | ✅ 完成 | `prompt/{spec,styles,route,base,ref2va,lint,text-utils,shot-adapter}.js` |
| 注释清理 | ✅ 完成 | h3-prompt 家族注释密度 **41.5% → 14.6%** |

### 7.2 P0-01（bridge 侧）：plan 编号压过镜头卡陈旧值

**做法**：`compileH3Prompt` 接受 `input.pictureIndexMap`（`ref-images.planImageSlots` 的返回），
`normalizeSubjects(list, { pictureIndexMap, warnings })` 以它为权威：

| 情形 | 结果 | 是否告警 |
|---|---|---|
| plan 有槽位号，与卡片值不同 | 用 plan 值，正文写 plan 编号 | ✅ 说明"旧编号会给错素材" |
| plan 有该图但没分到槽位（`null`） | 按"无参考图"处理 | ✅ |
| plan 没有这条目 | 丢弃卡片编号 | ✅ |
| 完全没传 plan | 按下标兜底 `i+1`（**兜底不感知首尾帧占槽**） | ✅ 明确说明偏移风险 |

`toShotInputPackage(shot, { pictureIndexMap })` 负责把映射带进输入包。
**与 fix-gen 的接口**：`shot-context.resolvePictureIndices` / `prompt-compile` 只需把
`planImageSlots(...).pictureIndexMap` 塞进 `toShotInputPackage` 的 opts（或直接塞 pkg），
bridge 侧即完成覆盖。**bridge 不再自己数编号**（原来的 `i+1` 只在无映射时兜底且必告警）。

### 7.3 P1-01：门面加强（tools.js 深路径不归本模块，已记录）

- `bridge/index.js` 从 32 个直出符号扩到 **130**，覆盖业务层原先走深路径取的全部内容：
  `param-docs` 命名空间（`PARAM_DOCS/GROUP_DOCS/paramDoc/groupDoc/deadParamNames`）、
  `presets` 的 `BUILTIN_PRESETS/SIGMA_PRESETS/validateSigmaSequence`、
  `graph` 的 `sanitize/applyFixes/mergeParams/fetchAvailableNodes/probeAvailableNodes/...`、
  `continuation` 的全部编排函数、`llm`/`storyboard` 的全部符号，以及本轮新增的
  `checkSigmaSequences / buildShotWorkflowAsync / continuationParamsFor / leaseValid / cardBindingLines / normalizeSubjects / detectSixFieldMixed`。
- 新增 `BRIDGE_FACADE_RULE` 常量（机器可读的门面规则），并在 `bridge/README.md` 顶部
  单列「唯一门面规则（硬约束）」章节与守卫建议。
- **仍需 fix-api 处理**：`host/tools.js:33` 仍有
  `import { compileH3Prompt, toShotInputPackage } from './bridge/prompt/h3-prompt.js'`（深路径）。
  门面已提供同名导出，改一行即可（`:34` 那行已经是门面 form）。
  `host/index.js:71` 只是注释里提到路径，不是 import。

### 7.4 P1-02：normalizer 不再反向依赖 services

`normalizePrompt(raw, cfg, { useLlm, translate })` —— 翻译函数由调用方注入。
未注入时**跳过翻译并明确 warning**（不静默）。`splitReplacePrompt` / `normalizeByRules`
仍然只做规则重排，可用性不变。

**仍需 fix-api 处理**：`host/api/routes/replace.js:102` 目前只传 `{ useLlm }`，
需要补 `translate: (cfg, texts) => promptLlm.translateBatch(cfg, texts)` 才能恢复翻译能力
（否则会返回"未注入翻译器"的 warning，功能降级但不报错）。

### 7.5 P1-03：段 1「开场声明」真正注入（选定"注入"而非删码）

`compileH3Prompt` 由二元判断改为三分支：

```
isContinuation      → CONTINUATION_SWITCH.carried + TRIM_DISCIPLINE.carried
index === 1         → CONTINUATION_SWITCH.opening + TRIM_DISCIPLINE.opening
其它                → 原样正文
```

副作用在验证快照里可见：`pkg4-cont1`（段 1）从 1977 → 2274 字符，**新增部分恰好就是
两句开场声明**；其余 5 个包的输出与拆分前**逐字符完全一致**。

### 7.6 P1-04：批次级 contextLength 真正下传

`taskFor(batch, index)` 现在把 `context_length` / `audio_context_length` 写进任务 JSON，
并新增 `continuationParamsFor(batch)` 直接产出可塞进 `nanfengExtra` 的参数层：

```js
taskFor(b)        → {"workflow":…,"node":"1","group":…,"run":…,"index":2,
                     "context_length":"56","audio_context_length":30}
continuationParamsFor(b) → { context_length: '56', audio_context_length: 30 }
```

**仍需 fix-api 处理**：`api/index.js` 组 job 时补
`nanfengExtra: continuation.continuationParamsFor(b0)`（原来 `nanfengExtra` 完全不传）。
bridge 侧已就绪，api 读 `job.params.nanfengExtra` 的既有路径不用改。

### 7.7 P1-05：显式非法值不再回退成"必崩的默认值"

`buildWorkflow` 的执行顺序改为 **coerce → sanitize → applyFixes → sanitize（二次）**：

- `sanitize(snapshot, { explicitKeys })`：显式传入的非法 COMBO 值 → **抛 `INVALID_PARAM_VALUE`**；
  另外把 `PARAM_FIXES` 涉及的键（`SageAttention` / `H3专用注意力` / TRT 引擎名）也纳入"必须报错"集合
  —— 它们的 schema 默认值正是本机必崩值。
- 非显式传入的非法值仍可回退，但每次回退都写 warning。
- 二次 sanitize 保证环境修正后的值也合法。

### 7.8 P1-06：CONSTRAINT_RULES 8 → 15 条，并区分保位与连续

新增：`slots-must-be-contiguous`、`ref2va-needs-one-reference`、`audio-drive-needs-file`、
`audio-lock-only-ref2va`、`audio-lock-needs-audio1`、`audio-lock-only-audio1`、
`original-ratio-only-frame-modes`；`audio-drive-needs-lock` 补上"时间轴模式"豁免（对齐 vendor 分支）。

**槽位连续性按族区分语义**（关键：不能把保位误杀）：

| 族 | 规则 | 理由 |
|---|---|---|
| 图片 1..9 | 允许**前缀留空**，中间跳号报错 | `planImageSlots` 把首/尾帧写进 图片1/图片2 并保位，参考图从 图片3 起是合法的 |
| 视频 1..3 | 第一个填充位置必须是 1，中间不得有空 | 无任何保位场景；空串 = 上传失败/漏填，vendor 会抛"不能跳号" |
| 音频 1..3 | 同上 | 同上 |

回归验证：`fl2va` 场景（图片1/2=首尾帧、图片3/4=参考图）**不误报**；
`图片1,图片2,图片4` 这种中段跳号仍被拦；`视频1,v2为空,视频3` 被拦。

### 7.9 P1-07：lint 按**值**豁免官方画风串

- 新增 `bindAuthoredValues(values)`：门面在加载时把 11 条画风串 + 7 条打光串注入 lint。
- `Do not` 规则去掉 `i` 标志（官方串里是句中 `DO NOT change character proportions`，
  加了 `i` 必然命中句首规则）。
- 剥离顺序：机制句 → 官方参考关系句 → `Text suppression:` 行 → 具名物属性句 →
  两道压制句 → 画风/打光串取值白名单。

**实测**：11 条画风串单测误报 **6 → 0**；Ref2VA 主路径逐画风编译，负面句告警 **0/11**；
真实用户负面句（`Do not…` / `Never…` / `Avoid…` / `NO x, NO y` / 中文「不要…」句中）仍按**原语义**判定，
行为与修复前一致（未新增/减少这一侧的召回）。

### 7.10 P1-08：参考绑定落入合法段（接口供 fix-gen）

新增 `cardBindingLines(cards, pictureIndexMap)`（`prompt/ref2va.js`，已由门面直出）：

```js
cardBindingLines([{ name:'Chika', description:'white-haired girl', traits:'twin tails' }], new Map([[0,3]]))
// → ['Chika is the character shown in <Picture 3>, white-haired girl, twin tails.']
```

`compileRef2VA` 会把 `input.referenceBindings` 写进 **subject_definitions 段内**（不是末尾追加）。
中文 `description` 不进英文句法（外观由参考图承载）。

**接口给 fix-gen**：`generator.injectCardDefinitions` 的"第 7 段追加"可替换为
—— 编译期在 `toShotInputPackage(shot, { referenceBindings })` 传入上面的返回值；
若必须在提交期注入，则只允许写进 `subject_definitions` 段内并重跑 `lintCompiledPrompt`。

### 7.11 P1-09 / P1-10：param-docs 标记校正

| 参数 | 旧 | 新 | 依据 |
|---|---|---|---|
| 参考图尺寸 | dead | **dead（保留）** | `h3_generator.py:1604` 硬编码 `ref_image_size="max"`，`:1854` 注明"当前固定 max" |
| 启用西格玛调节 | dead | **advanced** | `:1727` 读用户值，`:1743/1751-1754` 据此插 `MiniMaxH3SigmaShift` |
| 视频西格玛偏移 / 音频西格玛偏移 | dead | **advanced** | `:1772-1773` 直接作为 shift_video/shift_audio |
| Sigma策略 | dead | **advanced** | `:1758-1765`：`need_sigma_shift` 与 `sigma_enabled` 分层，原生轨迹仍可达 shift |

同时把文件头"死参数清单"的 vendor 行号全部重校，并写明**反向注意**：
西格玛族不是死参数，标 dead 会让 UI 灰掉唯一可调的 shift。
`参考图尺寸` 的 hint 明确要求 UI 不再给档位、不再据此生成显存降级提示（该行为在 render-plan，属 fix-api/服务侧）。

死参数计数：**47 → 43**（`inertParams()` 91，可用 130）。

### 7.12 P1-11：换人提示词 × 六段式互斥守卫

新增 `detectSixFieldMixed(raw)` 与 `SIX_FIELD_NAMES`；`splitReplacePrompt` **入口即抛**
`REPLACE_PROMPT_MIXED`（带 `err.code` / `err.field`）。检出字段名：
`subject_definitions` / `summary` / `retention_analysis` / `detailed_description` /
`overall_soundscape` / `non_diegetic_music` / `integrated_multimodal_description`（行首 + 冒号，兼容中文冒号）。

合法四段式（总结 / 身份绑定 / 时间轴 / 防漂移）不受影响。

### 7.13 P1-12 + P0-3：租约、崩溃接管、原子写

`runBatch` 在**同一个同步块**内完成「读 → 校验租约 → 写 `running` + `runnerId` + `runnerPid` + `heartbeatAt`」：

- `leaseValid(batch)`：`running` 且心跳在 `LEASE_TIMEOUT_MS`（90s）内 → 有效。
- `leaseHeldByOther(batch, runnerId)`：有效租约且执行者不同 → 抛 `BATCH_ALREADY_RUNNING`。
- 心跳过期 → 接管，并把**停在 `running` 的段退回 `pending` 重跑**；
  没有这一步，`nextPendingIndex()` 会返回 null，批次永久卡住（本轮实测复现并修复）。
  接管事实写进 `batch.warnings`。
- 每段开始/结束/失败都刷新心跳。

落盘（P0-3）：改为与 `host/store/json-store.js` 一致的原子写 ——
唯一 tmp 名（pid + 进程内自增）· 写前留 `.bak` · `EPERM/EBUSY/EACCES` 重试 6 次且**全程不删除目标文件** ·
最终失败退回覆盖写 · 同步睡眠用 `Atomics.wait`（退到 ≤2ms 忙等）。
读盘失败：保留 `.corrupt`、自动回退 `.bak`、无备份才抛 `CORRUPT_JSON`。

### 7.14 P2 修复

- **P2-01** `coerceTypes` 的 BOOLEAN 分支：未提供（`null`/`''`）**显式写 schema 默认值**，
  不再 `delete`（南风 221 参数全是 required，delete 会让键消失 → `required_input_missing`）；
  "显式 false" 仍是 `false`，两者仍可区分。
- **P2-03** `truncatePromptKeepFields` 改为**对句数上限做二分**（`lo/hi` 收敛），
  取"能放下且留句最多"的解；实测 6481 字符压到 5849（保留 90%），六段结构完整；
  旧算法在同样输入下会从 6001 砍到约 1/3。
- **P2-04** `validateSigmaSequence` 接线到生产链路：新增 `checkSigmaSequences(params)`
  并在 `buildShotWorkflow` 中调用（与 `checkConstraints` 同级，失败抛 `NANFENG_CONSTRAINT`）。
  校验补齐：首值 ≤ 1、步数必须为正、个数 = 一采 + 二采 + 1（开二采时）、
  "序列填了但不会被消费"给出 warning。`H3二采Sigma` 也在开二采时校验。
- **P2-05** `mergeParams` 静默丢弃未知键 → 新增 `mergeParamsVerbose()` 返回
  `unknownKeys`；`buildShotWorkflow` 把它们汇总成 warning（`extraParams` 的未知键同样告警）。
  `mergeParams` 保持原签名（内部转调）。
- **P2-11** 新增 `probeAvailableNodes(cfg, resolveUrl)` 返回
  `{ set, reachable, reason }`：`!/res.ok` / `fetch 抛错` / 非 JSON / 空表 都归入
  `reachable:false` 并带可读原因；`fetchAvailableNodes` 保留为兼容包装（失败返回 null）。
  `buildShotWorkflow` 新增 `probeDegraded/probeReason`，把"探测失败 → 动态修正全部跳过"
  这一降级事实写进 warnings；新增 `buildShotWorkflowAsync` 自动探测。

### 7.15 结构性重构：h3-prompt.js 2169 行 → 9 个文件

| 文件 | 行数 | 职责 |
|---|---|---|
| `prompt/h3-prompt.js` | 205 | 门面 + `compileH3Prompt` 编排 |
| `prompt/spec.js` | 131 | 官方枚举 / 硬上限 / 机制句 / 续写判定 |
| `prompt/styles.js` | 279 | 画风库 11 + 打光库 7 + 冲突检测 |
| `prompt/route.js` | 66 | 模式 → 格式 路由 |
| `prompt/base.js` | 101 | 基础格式（三字段 + 对齐指令） |
| `prompt/ref2va.js` | 295 | 六段正文 + 参考绑定 |
| `prompt/lint.js` | 225 | 反模式落位 / 结构自查 / 按字段截断 |
| `prompt/text-utils.js` | 255 | 帧数 / 时间戳 / 运镜 / 说话人 / 镜头归一 |
| `prompt/shot-adapter.js` | 171 | 镜头卡 → 输入包（含编号权威覆盖） |

**导出清单零差异验证**：拆分前后对比 `bridge/index.js` 的 32 个根导出与
9 个命名空间，结果 **LOST = 0（根）/ 0（全部命名空间）**；`prompt` 命名空间的
23 个符号集合与拆分前**完全相同**（新增辅助符号挂在根门面，不改变原命名空间面）。

**输出逐字符验证**：6 个输入包（真实镜头卡 ref2va / 带角色卡 / 续写段 2 / 续写段 1 / fl2va 基础格式 / 超长截断）
在拆分前后对比，5 个 **IDENTICAL**，1 个（续写段 1）差异**仅**为 P1-03 新增的两句开场声明。

### 7.16 注释清理

- 清除"旧实现…""历史缺陷…""⚠️ 曾经…""本轮…"等叙事性注释，只保留当前约束与依据。
- `h3-prompt.js` 及其 8 个子模块合计（按审计口径 comment/total-lines）：**41.5% → 14.6%**；
  单个文件除 `spec.js`（21.5%，几乎全是官方枚举与机制句的取值依据）外均 ≤ 16.5%。
- 面向整个 `bridge/` 目录的密度仍约 30%（`vendors/nanfeng/*` 与 `llm/*` 未纳入本轮拆分，见 §7.18）。

### 7.17 本轮复核得到的确定性数字（供回填）

```
PARAMS = 221          PARAM_DOCS = 221        schema↔docs 双向缺失 = 0 / 0
flag dead / banned / advanced = 43 / 48 / 25   inertParams() = 91   可用 = 130
CONSTRAINT_RULES = 15（对齐 vendor 15 条 raise）
STYLE_PRESETS = 11     LIGHTING_PRESETS = 7    H3_MODES = 5
bridge 门面根导出 = 130（旧 32，只增不减）
桥接层 node --check = 19/19 通过
画风串 lint 误报 = 0/11（旧 6/11）
h3-prompt 家族注释密度 = 14.6%（旧 41.5%）
```

### 7.18 跨边界 / 未完成事项（交给对应模块）

1. **fix-api**：
   - `host/tools.js:33` 仍走深路径 `./bridge/prompt/h3-prompt.js` → 改 `./bridge/index.js`（门面已直出同名符号）。
   - `host/api/routes/replace.js:102` 补注入 `translate`，否则本地翻译能力降级为"规则版 + warning"。
   - `host/api/index.js` 组 job 时补 `nanfengExtra: continuation.continuationParamsFor(b0)`（P1-04 的 api 侧）。
   - `graph.buildWorkflow` 现在会对**显式**非法 COMBO 值抛 `INVALID_PARAM_VALUE`；
     上游若把用户表单原样当 explicit 传入，需要在此之前给出可读的 400 映射（`errors.js`）。
2. **fix-gen**：
   - P1-08 采用 `cardBindingLines` + `toShotInputPackage({ referenceBindings })`，删掉提交期"第 7 段追加"。
   - P0-02 修好后，把 `planImageSlots(...).pictureIndexMap` 传进 `toShotInputPackage` / `compileH3Prompt`
     （不传不会报错，但会得到"下标兜底 + 告警"，编号可能偏移）。
   - `buildShotWorkflow` 新增可选入参 `probeDegraded / probeReason`，建议改用
     `buildShotWorkflowAsync({ cfg, resolveUrl })`，让"ComfyUI 不可达"变成 job warning 而不是被 `catch {}` 吞掉。
3. **未纳入本轮**：`llm/dsh-llm.js`、`llm/storyboard.js`（P2-07 死代码、
   `collectText` 陷阱）与 `vendors/nanfeng/presets.js` 的 P2-13（预设与 accel-plan 双写步数/采样器）
   仍未处理 —— 均不属本轮必修项。
