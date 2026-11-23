# vendor 与 Blender 审计报告

> 范围：`F:\AI视频\dsh-jiuzhang-studio\vendor\`（nanfeng 包 + deploy-vendor.ps1）与
> `F:\AI视频\dsh-jiuzhang-studio\host\blender\`（render_shot.py / actions.py / list_actions.py / dump_catalog.py）。
> 方法：只读静态审查（AST / grep / py_compile 编译不执行）+ 只读 GET 探测 `http://127.0.0.1:8488/object_info`。
> 未修改被审仓库任何文件，未 import 节点代码。
> 覆盖率：vendor 11 个 .py + 1 json + 1 ps1 + 2 md + `_removed/` 5 个文件 + `__pycache__`；Blender 4 个 .py。
> 行数：h3_generator.py 约 5200 行（221 INPUT 参数），nodes.py 约 300 行，deploy-vendor.ps1 约 150 行，
> render_shot.py 约 1000 行，actions.py 约 1100 行。
> 状态：**已完成**（本文件分 5 批写入）。
> 判定脚本：`_audit_run/_b5_ast*.py`；实测快照：`_b5_live_schema.json`（221 键）、`_b5_final_table.txt`（逐参数）。

## 一、概览（级别计数）

| 级别 | 含义 | 计数 |
|---|---|---|
| P0 | 数据丢失 / 安全 / 必崩 | **0** |
| P1 | 功能错误 / 静默撒谎 | **6** |
| P2 | 健壮性 / 性能 | **6** |
| P3 | 死代码 / 陈旧注释 / 缓存 | **12** |

P0 = 0 的理由：vendor 与 ComfyUI 逐字节一致（§5.1 实测 11/11 SAME）；
`deploy-vendor.ps1` 的 `-Clean` 有路径护栏（`:64-74`），最坏情况是「覆盖掉目标侧热修」，
属 P1（可恢复，不是静默数据丢失）。Blender 侧的帧数/哨兵校验（`:840-874`）是正确且带防御的。

P1 六条（全在后续小节展开）：
1. `nodes.py` 是死文件却随包分发（§2.3 / §5.3）
2. `deploy-vendor.ps1:105` `Copy-Item -Force` 静默覆盖目标侧本地修改（§2.3）
3. `SageAttention` 输入永远无效（§3.2）
4. `启用SolAttn` + 6 个 `SolAttn*` 整组恒失效（§3.2）
5. `启用T8缓存` + 7 个 `T8*` 整组恒失效（§3.2）
6. `H3专用注意力` 相关 hint 与实际代码不符（`param-docs.js:368-373`）（§3.2）

P2 六条：md 白名单判定歧义、`$EXCLUDE_DIRS` 缺 `__pycache__`、`-Clean` 注释不全、
`一采步数` vs `H3一采步数` 双套字段、`folder_paths` 静默降级、`actions.py` 重复 `_walk_like`。

P3 十二条（逐条编号，便于验收销账）：
1. `__init__.py:26/:20` 陈旧注释（217 参数 / `host/services/nanfeng/storyboard.js`）—— §2.1、§7.3
2. `vendor/nanfeng/__pycache__/` 10 个 `.pyc` 随仓库 —— §2.1、§7.1
3. `_removed/` 5 个历史文件（且 `audio_drive_api.py:13` 有连锁 import 隐患）—— §2.1、§7.2
4. 探针「5 个类名解析不到」是误报，31/31 全部可解析 —— §2.2、§4.1
5. display name 只覆盖 14/31，17 个节点无中文名 —— §2.2、§4.2
6. 2 个类定义了但未注册（`PrepareReferences` / `ProgressSampler`）—— §2.2、§4.3、§4.4
7. 12 个 V1–V9 历史类需加「勿删」注释（schema 靠 super() 链式追加）—— §2.2、§4.3
8. `deploy-vendor.ps1:116` 依赖自检路径假定父目录叫 `venv` —— §2.3
9. 部署目录残留 9 个 `*-skill/` 目录（仓库 11-18 已迁出）—— §2.3、§7.1
10. 陈旧文档：`VENDOR.md:25/:26`、`package.json` description、`graph.js:8`、
    `skills/setup/SKILL.md:147`、`skills/architecture/SKILL.md:458`、`docs/history/SKILL-AUDIT.md:152`（217 vs 221、2590 vs 2475 行、copy 规则）—— §7.3
11. `host/blender/__pycache__/` 4 个 `.pyc` —— §7.1
12. `actions.py catalog()`（`dump_catalog.py` 用）与 `models.js:467 listActionCatalog()`（REST 用）
    两套输出不完全同构，字段名一致但前者多 `version/axis_contract/joints` —— 属观察，非缺陷 —— 附录

P3 共 12 条；其中「纯清理」项 5 条（#2 #3 #9 #11 以及 `nodes.py`，`nodes.py` 已升 P1）、
「需改文档」3 条（#1 #10 及各条 hint）、「防误删注释」1 条（#7）。

**总判定：vendor 包本身是健康的**——没有 P0，没有「两个版本在跑」，
221 个参数里 179 个真实生效、42 个是明确为旧工作流序列化兼容保留的占位。
主要风险集中在**部署流程（手工单文件拷贝导致漂移）**与**加速方案（Sol/T8/Sage）三套已废弃但 UI 仍暴露**。

## 二、逐文件审查

### 2.1 立即可确认的 3 条（第一批）

**[P3] `vendor/nanfeng/__init__.py:1-15` 文件头注释陈旧**
证据：注释仍写「217 参数」，而 `h3_generator.py` 的 `INPUT_TYPES` 实际 221 个键；
注释指向 `host/services/nanfeng/storyboard.js`，该路径已迁移到 `host/bridge/llm/storyboard.js`。
修复：把文件头注释改为「221 参数 / host/bridge/llm/storyboard.js」，或直接删掉路径描述只留职责。

**[P3] `vendor/nanfeng/__pycache__/` 与 `host/blender/__pycache__/` 应清理**
证据：两处 `__pycache__/*.pyc` 是本地运行残留，随仓库分发会误导 py_compile 缓存并污染部署比对。
修复：清理并加 `.gitignore`；`deploy-vendor.ps1` 的 `$EXCLUDE_DIRS` 应含 `__pycache__`。

**[P3] `vendor/nanfeng/_removed/` 历史文件**
证据：目录内 5 个模块（audio_drive_api / audio_media_api / continuation_scheduler /
model_refresh_api / storyboard_api）不在任何 `import` 路径上，仅作历史参考。
修复：保留但加 `_removed/README.md` 说明「不加载、不得 import」，或移出 vendor。

### 2.2 注册表一致性（AST 静态核对 + 只读 /object_info 交叉验证）

`vendor/nanfeng/h3_generator.py:2427` 的 `NODE_CLASS_MAPPINGS` 共 **31** 项；
`NODE_DISPLAY_NAME_MAPPINGS`（`:2460`）共 **14** 项。

**[P3] 逐项核对结果：31/31 全部可解析，探针「5 个类名解析不到」是误报**
证据：探针只扫了本文件的顶层 `ClassDef`。实际 5 个符号来自文件末尾的跨模块 import——
`h3_generator.py:2420-2425` 依次 `from .native_audio_lock import MiniMaxH3NativeAudioLockV15`、
`.latent_continuation → NanFengV15CommitContinuation`、`.context_taper_noise → NanFengH3ContextTaperNoiseV15`、
`.continuation_audio_refine → NanFengV15ContinuationAudioRefine`、`.dlss_output → NanFengV15DLSSOutput`。
这 5 个类名与 `/object_info` 实测全部注册成功（见下表 OK 行），不是缺陷。
修复：把「解析不到」的探针逻辑改为 `ast.walk` + `ImportFrom` 解析，避免后续再误报。

**[P3] 14/31 缺 display name（不影响运行，影响 ComfyUI 节点搜索/菜单可读性）**
17 个无中文名的键（`/object_info` 里会退回显示英文类名）：
`NanFengV15DLSSOutput`、`NanFengH3ContextTaperNoiseV15`、`MiniMaxH3NativeAudioLockV15`、
`NanFengH3RTXVideoSuperResolutionV15`、`NanFengH3KJPreviewBridgeV15`、`NanFengH3UpscaleForSecondPassV15`、
`NanFengH3TrimSigmasAtStartV15`、`NanFengH3LimitImageLongEdgeV15`、`NanFengH3ReleaseBeforeSecondModelV15`、
`NanFengH3TimedVideoVAEDecodeV15`、`NanFengH3TimedAudioVAEDecodeV15`、`NanFengH3ReleaseBeforeLatentUpscaleV15`、
`NanFengH3LowPeakLatentUpscalerV15`、`NanFengH3ReleaseLatentUpscalerBeforeSecondPassV15`、
`NanFengH3ClearUpscalerCacheResidentV15`、`NanFengH3LoadSecondModelAfterCleanupV15`、
`NanFengH3RebuildRefConditioningForUpscaledLatentV15`。
修复：内部节点（Release*/Decode*）可接受；但 DLSS/RTX/ContextTaper/AudioLock 是用户要拖的，建议补中文名。

**[P3] 1 个类定义了但未注册（真实，但无害）**
`NanFengH3PrepareReferences`（`h3_generator.py:456`）与 `NanFengH3ProgressSampler`（`:556`）都不在 `NODE_CLASS_MAPPINGS` 里；
前者 `INPUT_TYPES` 返回空 required，后者是子图内部节点。另 V1…V9 共 12 个历史版本类（`:1223/:1954/:1984/:2011/:2039/:2067/:2095/:2141/:2198/:2316`）
仅作为 `V15` 的继承基类存在——**不能删**（V15 的 schema 靠 `super().INPUT_TYPES()` 链式追加）。
修复：给 V1–V9 类加 `# 仅作继承基类，勿删` 注释，防止后人当死代码清理。

**[P3] `NanFengH3MultiReferenceGeneratorV15` 的 schema 分布在 12 个类的 `INPUT_TYPES` 里**
证据：`:2367` → `super()` 依次到 V9/V8.1/V8/V7/V6/V5/V4/V3/V2/V1。任何「221 参数」改动必须落到正确的 V 层，
否则会破坏 append-only 的序列化位置约定（`:1296`、`:1967`、`:2003`、`:2021`、`:2127`、`:2369` 均有该约定注释）。
修复：无；这是设计约束，报告保留以防误改。

| 注册键 | 符号来源 | object_info |
|---|---|---|
| NanFengH3MultiReferenceGeneratorV15 | ClassDef@2361（12 层继承） | OK |
| 5 个跨模块 import 类 | :2420–2425 | OK（实测） |
| 其余 25 个内部节点 ClassDef | :65–:2316 | OK（实测） |
| NanFengH3PromptDraft / NanFengPromptList / NanFengH3ReferenceNumbering | nodes.py（未部署） | 404 空 JSON |

### 2.3 部署一致性（repo ↔ ComfyUI）—— `nodes.py` 为什么没被部署

**[P1] `nodes.py` 与 `VENDOR.md` 确实未部署，且 `nodes.py` 是**死文件**
证据（SHA256 前缀，本次实测）：
```
__init__.py                     AE3920A0...  SAME
h3_generator.py                 EBF7C722...  SAME
dlss_schema.json                998F3E8B...  SAME
context_taper_noise.py         9E74FF24...  SAME
continuation_audio_refine.py     1B4A2789...  SAME
dlss_output.py                 5E1ACB66...  SAME
latent_continuation.py          06212CA6...  SAME
nanfeng_sampler.py              D06E2030...  SAME
native_audio_lock.py            1A17DD3C...  SAME
retired_mode_guard.py           BB2A1AC6...  SAME
trt_options.py                  EDDF5C83...  SAME
nodes.py                        B670AD0F...  MISSING
VENDOR.md                       D1AAD061...  MISSING
deploy-vendor.ps1               9AA4D685...  MISSING（正常，脚本不拷自己）
```
**为什么没在 —— 已用「脚本复制循环的逐行复刻」实测排除脚本嫌疑**：
我按 `deploy-vendor.ps1:96-107` 的循环原样复刻，写到 `%TEMP%` 下的临时目录（不动仓库、不动 ComfyUI），结果：
`copied = 13`，目标里**同时**出现 `nodes.py` 与 `VENDOR.md`。也就是说**当前版本的脚本会把这两个都复制过去**。
所以「nodes.py 缺失」不是脚本 bug，只能是「本次部署没有跑现脚本」：部署目录里存在 **9 个 `*-skill/` 目录**
（`audio-drive-skill`、`storyboard-skill`、`ns-storyboard-skill`、`oneshot-continuation-*`、`continuation-cuts-*`、`nonfirst-i2v-*`），
而这些目录按 `VENDOR.md:51-70` 早在 **2026-11-18 就已迁出 vendor**（现仓库 `vendor/nanfeng/` 只有 `_removed/` 与 `__pycache__/` 两个子目录）。
结论：该部署目录是**早期用旧版脚本铺的一次，之后靠逐个文件手工拷贝更新**——
证据是部署侧 mtime 与仓库逐个吻合却不连续：`context_taper_noise.py` 11-20 17:36:34、`latent_continuation.py` 11-20 17:37:19、
`__init__.py` 11-22 04:28:58、`h3_generator.py` 11-23 09:53:25，其余 8 个文件仍是 09-15 12:52:58 的原始 mtime。
`nodes.py` 自 09-15 起从未改动，因此那几次「只拷改过的文件」的手工更新永远不会带上它。
修复（见下 P1，按优先级）：**先删 `nodes.py`**（它是死文件，理由见 P1），再把部署流程固化为「一律跑脚本 + `-Force -Clean`」，
禁止手工单文件拷贝，否则下次还会漂。
**且 `nodes.py` 在 ComfyUI 里连注册都注册不上**：`__init__.py:37-38` 只 import `h3_generator` 的两个映射表，
`nodes.py` 从未被 import，所以它即使被复制过去，那 3 个节点（NanFengH3PromptDraft / NanFengH3ReferenceNumbering / NanFengPromptList）
也**永远不会出现在 ComfyUI 里**（实测 `/object_info` 三个都返回空 JSON）。
修复（三选一，按优先级）：
1. **删除 `vendor/nanfeng/nodes.py`**——它不属于本插件链路，全仓 `*.js/*.mjs/*.md` 对它零引用（已 grep 验证），
   插件走 `host/bridge/vendors/nanfeng/prompt.js` 自己编译提示词，不需要 ComfyUI 侧的提示词节点。
2. 若确实要保留给 ComfyUI 手工使用，就在 `__init__.py` 里合并注册：
   `from .nodes import NODE_CLASS_MAPPINGS as _N; NODE_CLASS_MAPPINGS = {**NODE_CLASS_MAPPINGS, **_N}`，
   并在 `deploy-vendor.ps1` 后补一条 `/object_info` 断言。
3. 折中：移到 `vendor/nanfeng/_removed/nodes.py`，并在 README 注明「不属于九章链路」。

**[P2] `deploy-vendor.ps1:101` 的 md 白名单判定逻辑错误（`$top` vs `$rel` 语义混用）**
证据同上：`$top = ($rel -split '\\')[0]` 取的是**相对路径首段**，判断 `$top -ne 'VENDOR.md'` 却按**文件名**语义写。
后果：顶层 `VENDOR.md` 也被跳过（实测目标目录无 VENDOR.md），任何未来新增的顶层 md 都会被静默丢弃。
修复：改用 `if ($_.Extension -eq '.md' -and $rel -ne 'VENDOR.md') { return }`（拿 `$rel` 直接比）。

**[P2] `deploy-vendor.ps1:88` `$EXCLUDE_DIRS` 未含 `__pycache__`，但仍会复制 `.pyc` 吗？不会——`$COPY_EXTS` 挡住**
证据：`$COPY_EXTS = @('.py','.json','.md')`（`:91`），`.pyc` 扩展名不在其中，所以本地 `__pycache__` 不会被复制。
但 `-Clean` 会在复制前删掉目标 `__pycache__`（`:81-82`），这点是对的。
修复：仍建议把 `'__pycache__'` 加进 `$EXCLUDE_DIRS`（`:88`）作为双保险，避免将来有人把 `.pyc` 加进 `$COPY_EXTS`。

**[P2] `deploy-vendor.ps1:79-82` `-Clean` 的删除范围：安全，但有一处小隐患**
证据：`:64-74` 先 `Resolve-Path` 取真实路径，断言 `$destFull` 严格以 `<ComfyDir>\custom_nodes\` 开头且不等于 `custom_nodes` 本身，
之后才 `Remove-Item -Recurse`。`-Recurse -File -Filter '*.py'` 只删 `.py`，不删 `.json/.md`，**不会误删用户自定义的 `dlss_schema.json` 修改**——但反过来说，
`dlss_schema.json` 的本地修改会**静默保留**（`Copy-Item -Force` 会覆盖，所以实际上会被覆盖）。
隐患：`-Clean` + 未加 `-Force` 时不会执行（`:62` 要求 `Test-Path $DEST`，而 `-Force` 缺失时 `:50-56` 已 `exit 2`），逻辑正确。
修复：无必须项；建议在 `:22-25` 的注释里补一句「`-Clean` 只删 `*.py` 与 `__pycache__`，`.json` 靠 `-Force` 覆盖」。

**[P1] `deploy-vendor.ps1:105` `Copy-Item -Force` 会静默覆盖目标侧的本地修改**
证据：`Copy-Item $_.FullName $to -Force`（`:105`）无任何备份或 diff 检查。若有人直接在
`F:\AI视频\ai-runtime\ComfyUI\custom_nodes\nanfeng_prompt_nodes_v15_modified\` 里热修过
（本次实测 `h3_generator.py` mtime 09:53:25 与仓库一致，说明目前没有本地热修），再跑一次 `-Force` 就永久丢失。
修复：加 `-WhatIf` 预览已有；建议 `-Force` 分支先 `Copy-Item $DEST "$DEST.bak-$(Get-Date -f yyyyMMddHHmmss)" -Recurse`，
或至少对每个将被覆盖的文件做 SHA256 比对，不一致时 `Write-Warning` 并列出。

**[P3] `deploy-vendor.ps1:116` 依赖自检路径假定 `ComfyDir` 的父目录叫 `venv`**
证据：`$venvPy = Join-Path (Split-Path $ComfyDir -Parent) "venv\Scripts\python.exe"`。
本机 `$ComfyDir=F:\AI视频\ai-runtime\ComfyUI` → 父目录 `ai-runtime` → `ai-runtime\venv\Scripts\python.exe` **存在**（实测 Python 3.12.10）。
但对任意其它布局会静默跳过。修复：加 `-PythonExe` 可选参数覆盖。

**[P3] 环境侧发现：部署目录还残留 9 个 `*-skill/` 目录（仓库早已删除）**
证据：`ai-runtime\ComfyUI\custom_nodes\nanfeng_prompt_nodes_v15_modified\` 下有 9 个 `*-skill` 目录；
仓库 `vendor/nanfeng/` 只有 `_removed/` 与 `__pycache__/`。`VENDOR.md:51-70` 记载它们于 2026-11-18 迁到 `skills/prompt/`。
后果：ComfyUI 会把这些目录当普通文件目录扫描，不影响加载但污染节点包、且让「部署一致性」无法靠目录比对。
修复：部署时加 `-Clean`（脚本确实会删，但只删 `*.py` 与 `__pycache__`，**不删这些目录**）——
建议 `-Clean` 改为「清空整个 `$DEST` 后再复制」，或手工删一次这 9 个目录。

## 三、221 参数有效性分类表

**方法声明（重要，避免复核误会）**：判定脚本 `_audit_run/_b5_ast13.py` 用 AST 取
`INPUT_TYPES()` **体内**所有 schema 键的行号作为「声明行」；消费判定 = 该键名以**带引号字面量**
出现在这些声明行**之外**的任何地方（跨全部 10 个 vendor `.py`），
外加两类「按设计就是动态的」键：
- 动态族：`图片{1..9}` ← `h3_generator.py:1351` `f"图片{i}"`；`视频{1..3}` ← `:1352`；`音频{1..3}` ← `:1353`；
  `LoRA{1..8}`/`LoRA{n}强度`/`LoRA{n}启用` ← `:1945-1948` 的 `f"LoRA{index}"` 三连。
- DLSS 27 键 ← `dlss_output.py:9-13` 用 `f"DLSS_{mode}_{k}"` 从 `dlss_schema.json` **生成** schema 键，
  `dlss_output.py:28` 又用 `f"DLSS_{prefix}_{k}"` **读回**——同一个 f-string 模板，静态 grep **永远**找不到字面量，
  这是正常设计，**不得**误删。
- 南风 ER 4 键 ← `h3_generator.py:2411-2414` 注入 `nanfeng_sampler.FIELDS`，由 `nanfeng_sampler.py:9` 反查。

结论：**有用 179 / 死参数 42 / 共 221**（原始 `/object_info` 实测也是 221）。

### 3.1 死参数 42 个（真·零消费，按组归类）

| 组 | 数量 | 参数 | 证据（仅声明，无消费点） |
|---|---|---|---|
| 全局修复 / 人脸修复（整组） | 16 | `启动准备`、`单人小脸修复`、`多人小脸修复`、`人物1身份参考`、`人物2身份参考`、`人物1图中位置`、`人物2图中位置`、`全局修复`、`全局修复倍率`、`全局修复LoRA模式`、`全局修复LoRA`、`全局修复LoRA强度`、`全局修复步数`、`全局修复降噪`、`全局修复Sigma策略`、`全局修复范围` | 全部只出现在 `h3_generator.py:2079-2126` 的 schema 声明；`generate()` 内零读取。`:2078` 注释已自认「前端不渲染，generate 不读取，节点包也不再注册任何人脸修复执行节点」 |
| V4/V5 双采与像素二采（整组） | 13 | `启用双采样`、`双采后段比例`、`双采后段采样器`、`启用高清二采`、`一采步数`、`二采百万像素`、`二采放大方法`、`二采步数`、`二采降噪`、`二采采样器`、`二采调度器`、`二采模型`、`二采起始Sigma` | 全部只出现在 `:2022-2061`；`:2046` 注释「V4 旧双阶段字段仅隐藏/忽略」、`:2064` DESCRIPTION 已改口说「开启后主控步数失效」（但代码里根本没这条路径） |
| H3 二采 LoRA/Sigma（部分） | 4 | `H3二采Sigma`、`H3二采LoRA模式`、`H3二采LoRA`、`H3二采LoRA强度` | 只在 `:2172-2194` 声明；`:1513-1515` 注释明确「该变量现在没有任何读取点，故不再赋值；旧字段仅保留序列化兼容」 |
| 音频驱动（部分） | 5 | `音频驱动打点`、`音频驱动分段图片`、`音频驱动分段分镜`、`音频驱动创意`、`音频驱动排除范围` | 只在 `:2374-2378` 声明。`音频驱动文件`/`当前起点`/`当前终点`/`开启音频驱动模式` **是**有用的（`:1360/:1369/:1620/:1678/:1679`），不要连带删 |
| 其它 | 4 | `固定随机种子`、`分块处理（节约显存）`、`分块卸载层数`、`低显存注意力分头数` | 前三个是纯占位：`:2005`、`:2110-2118`（`:2116` 注释「当前H3实现固定完整50层动态流式加载」）、`:2128` 零读取。注意 `分块处理` 对应的执行节点 `NanFengH3BlockOffloadPatchV15:543-553` 会**主动 raise**，是「故意封死」不是遗漏 |

### 3.2 「读了但读不出效果」——比死参数更危险的一类（P1）

这些参数**有**消费点，但消费点被上游硬编码短路，用户改了不会有任何反应，
而插件 UI（`host/bridge/vendors/nanfeng/param-docs.js`）已部分标注、部分没标注：

**[P1] `SageAttention` 输入无效（`h3_generator.py:1273` 声明 → `:1471` 覆写 → `:1476` 再覆写才被读）**
证据链：`:1273` schema 声明 `("SageAttention", (SAGE_MODES, {"default":"auto"}))`；
`:1471` `SageAttention = "disabled"`（SLA 分支）；
`:1476-1480` **无条件**覆盖 `SageAttention = "auto" if 自动 else ... else "disabled"`，完全不看形参 `SageAttention`；
`:1509` 才真正读。
后果：用户在「SageAttention」下拉里选什么都是死值；真正生效的是「H3专用注意力」（`:1458`）。
修复：要么删掉 `SageAttention` 这个 widget（与 V7 注释「V7统一下拉」一致），要么把它接回 `:1508` 的条件。
**注意 `param-docs.js:139` 已写了这条 hint，说明上游知道，但代码没清理。**

**[P1] `启用SolAttn` + 6 个 `SolAttn*` 全组恒失效（`h3_generator.py:1456` → `:1481` 硬置 False）**
证据：`:1456` 读 `启用SolAttn`；`:1481` `sol_enabled = False`；`:1524` `if sol_enabled:` 因此**永远不进入**，
`:1526-1531` 那 6 个 `SolAttn_*` 的读取点全部不可达（我的静态扫描把它们判为「有用」是因为有读取行，
实际是死分支——这是本表需要点名的一处**分类歧义**）。
`:1483` 的互斥 `raise` 也因此永不触发。修复：删 `启用SolAttn` + 6 个 `SolAttn*`，或恢复分支。

**[P1] 同理 `启用T8缓存` + 7 个 `T8*` 恒失效（`:1457` → `:1482` 硬置 False → `:1540` 不可达）**
证据：`:1457` 读、`:1482` 置 False、`:1540` `if t8_enabled:` 不可达、`:1543-1549` 读取点全部死。
修复同上。

**[P1] `H3专用注意力` 的 `H3专用Sage加速` 分支在 V15 上恒不可达（`:1463-1467`）**
证据：`h3_dedicated_attention = isinstance(self, (V6, V7)) and ...`。
V15 的 MRO 是 `V15→V9→V81→V8→V7→V6→…`，`isinstance` 对 V7/V6 的后代**为真**，所以这条**其实是通的**——
但 `:1471` 在 SLA 开启时把 `SageAttention` 置 `"disabled"`，`:1508` 的 `elif` 因此不会走 `PathchSageAttentionKJ`。
`param-docs.js:368-373` 的表述（「整组不产生任何作用」）与代码**不完全一致**，属**文档过时**。
修复：核对并更新 `param-docs.js` 这条 hint。

**[P2] `一采步数` 与 `H3一采步数` 是两套并行字段，容易改错**
证据：`一采步数`（`:2048`，V5 遗留）零消费；`H3一采步数`（`:2206`，V8.1）在 `:1771` 被读。
两者中文名极近。修复：在 `param-docs.js` 给 `一采步数` 打 `dead` 标记（目前**没有**），
并在前端隐藏它（`分块卸载层数` 已有同类处理）。

### 3.3 缺依赖（schema 有、运行时可能拿不到）

**[P2] `模型` / `文本编码器` / `视频VAE` / `音频VAE` / `LoRA*` / `实时预览*` 等下拉的选项来自 `folder_paths`**
证据：`h3_generator.py:1236-1244` 用 `try/except` 包住 `folder_paths.get_filename_list`，失败时**静默降级为空列表**。
`:1256-1259` 然后 `h3_models[0] if h3_models else None`；`:1265` `cls._live_combo(h3_models, source_model)` 在空列表时返回 `([], {})`。
后果：一旦 `folder_paths` 抛错或模型目录没挂上，节点仍会注册，但 `模型` 下拉是**空选项**——
ComfyUI 会直接拒收工作流，报错位置离根因很远。
修复：`:1241` 的 `except` 里 `logging.warning` 一次，别静默。

## 四、节点注册表核对表

**核对方法**：`_audit_run/_b5_ast7.py` 用 AST 把 `NODE_CLASS_MAPPINGS` / `NODE_DISPLAY_NAME_MAPPINGS`
两处模块级 `Assign` 解成字典（不 `import`），再把每个值符号回溯到「本文件 `ClassDef`」或
「文件末尾 `ImportFrom`」；最后与只读 `GET http://127.0.0.1:8488/object_info` 实测交叉验证。

### 4.1 复核结论：探针说的「5 个类名解析不到」是**误报**（P3，非缺陷）

`vendor/nanfeng/h3_generator.py:2427` 的 31 个注册键里，26 个指向本文件 `ClassDef`，
5 个指向文件**末尾**（`:2420-2425`）的跨模块 import：

| 注册键 | 定义位置 | 解析结论 |
|---|---|---|
| `MiniMaxH3NativeAudioLockV15` | `h3_generator.py:2420` `from .native_audio_lock import ...` | ✅ 可解析 |
| `NanFengV15CommitContinuation` | `:2421` `from .latent_continuation import ...` | ✅ 可解析 |
| `NanFengH3ContextTaperNoiseV15` | `:2422` `from .context_taper_noise import ...` | ✅ 可解析 |
| `NanFengV15ContinuationAudioRefine` | `:2423` `from .continuation_audio_refine import ...` | ✅ 可解析 |
| `NanFengV15DLSSOutput` | `:2425` `from .dlss_output import ...` | ✅ 可解析 |

误报根因：探针只 `for node in tree.body if isinstance(node, ast.ClassDef)`，**只扫顶层类定义**，
既不解析 `ImportFrom`，也不做符号回溯。修复：探针改为 `ast.walk` + `tree.body` 里的 `ImportFrom` 建符号表，
或在扫描前就断言「注册值必须能解析，否则先报错」。

**实测交叉验证**（`/object_info/<name>`，HTTP 200 且响应体非 `{}`）：

| 节点类 | 实测 |
|---|---|
| `NanFengH3MultiReferenceGeneratorV15` | ✅ 已注册（`display_name="南风H3 V15 多参视频生成"`，`python_module=custom_nodes.nanfeng_prompt_nodes_v15_modified`） |
| 上述 5 个跨模块类 + 其余内部节点（共 30 个） | ✅ 全部在 `/object_info` 顶层键里出现 |
| `NanFengH3PromptDraft` / `NanFengH3ReferenceNumbering` / `NanFengPromptList`（来自 `nodes.py`） | ❌ 返回 `{}`（未注册，因为 `nodes.py` 不被 import，见 §五） |

### 4.2 display name 覆盖：14 / 31（P3）

`NODE_DISPLAY_NAME_MAPPINGS`（`:2460-2475`）只有 14 项，且**全部**指向已注册键（无一悬空，这点是干净的）。
缺中文名的 17 个键，ComfyUI 侧会退回显示英文类名：

| 分类 | 键 |
|---|---|
| 用户可能真的会拖的（建议补名） | `NanFengV15DLSSOutput`、`NanFengH3ContextTaperNoiseV15`、`MiniMaxH3NativeAudioLockV15`、`NanFengH3RTXVideoSuperResolutionV15`、`NanFengH3KJPreviewBridgeV15` |
| 子图内部节点（可不补） | `NanFengH3UpscaleForSecondPassV15`、`NanFengH3TrimSigmasAtStartV15`、`NanFengH3LimitImageLongEdgeV15`、`NanFengH3ReleaseBeforeSecondModelV15`、`NanFengH3TimedVideoVAEDecodeV15`、`NanFengH3TimedAudioVAEDecodeV15`、`NanFengH3ReleaseBeforeLatentUpscaleV15`、`NanFengH3LowPeakLatentUpscalerV15`、`NanFengH3ReleaseLatentUpscalerBeforeSecondPassV15`、`NanFengH3ClearUpscalerCacheResidentV15`、`NanFengH3LoadSecondModelAfterCleanupV15`、`NanFengH3RebuildRefConditioningForUpscaledLatentV15` |

判据：`generate()` 的 `g.node(...)` 调用里引用到的类（`:1431/:1440/:1507/:1509/:1564/:1576/:1583/:1586/:1591/:1601/:1687/:1695/:1704/:1760/:1862/:1867/:1880/:1886/:1890/:1901/:1904/:1910/:1921/:1924/:1931`）
属「内部」，其余属「用户可见」。

### 4.3 定义了但没注册（P3，真实但无害）

| 类 | 行 | 判定 |
|---|---|---|
| `NanFengH3PrepareReferences` | `:456` | 定义了但不在注册表；`INPUT_TYPES` 返回空 required。属**真死代码**，可删 |
| `NanFengH3ProgressSampler` | `:556` | 不在注册表，但**:569 调 `_sample_progress_only`**；保留（子图内部用） |

**⚠️ 12 个历史版本类不是死代码，禁止清理**：
`NanFengH3MultiReferenceGenerator`（`:1223`）、`V2`（`:1954`）、`V3`（`:1984`）、`V4`（`:2011`）、
`V5`（`:2039`）、`V6`（`:2067`）、`V7`（`:2095`）、`V8`（`:2141`）、`V81`（`:2198`）、`V9`（`:2316`）。
它们全部是 `V15` 的继承链基类，V15 的 221 键 schema 就是靠 `super().INPUT_TYPES()` 逐层 append 出来的
（`:2368` 一层 `super()`，再经 V9/V81/V8/V7/V6/V5/V4/V3/V2/V1 共 10 层）。
删任何一层 → V15 少一批参数 → 旧工作流 `widgets_values` 位置整体错位（append-only 约定见 `:1296/:1967/:2003/:2021/:2127/:2369`）。
修复：给这 12 个类统一加注释 `# 仅作 V15 继承基类，勿删（schema 靠 super() 链式追加）`。

### 4.4 探针说的「1 个类定义了但没注册」——复核为 **2 个**

见 4.3 表。差异原因同上：探针可能把 `ProgressSampler` 当作已注册（或反之），
本次 AST 全量核对结果是 `PrepareReferences` + `ProgressSampler` 两个未进注册表。

## 五、部署一致性（repo ↔ ComfyUI）

### 5.1 SHA256 逐文件实测（本次复核，与上游结论一致）

源 `F:\AI视频\dsh-jiuzhang-studio\vendor\nanfeng\` → 目标 `F:\AI视频\ai-runtime\ComfyUI\custom_nodes\nanfeng_prompt_nodes_v15_modified\`

| 文件 | 源 SHA256(前16) | 目标 | 结论 |
|---|---|---|---|
| `h3_generator.py` | `EBF7C722AC310141` | `EBF7C722AC310141` | **SAME** |
| `__init__.py` | `AE3920A0085B1764` | 同 | SAME |
| `context_taper_noise.py` | `9E74FF24B8093F3E` | 同 | SAME |
| `continuation_audio_refine.py` | `1B4A278915868272` | 同 | SAME |
| `dlss_output.py` | `5E1ACB663653D641` | 同 | SAME |
| `dlss_schema.json` | `998F3E8B965216A7` | 同 | SAME |
| `latent_continuation.py` | `06212CA660BE907B` | 同 | SAME |
| `nanfeng_sampler.py` | `D06E20308A94A41C` | 同 | SAME |
| `native_audio_lock.py` | `1A17DD3C36A93D29` | 同 | SAME |
| `retired_mode_guard.py` | `BB2A1AC65C44EBD7` | 同 | SAME |
| `trt_options.py` | `EDDF5C8385FE9A7E` | 同 | SAME |
| `nodes.py` | `B670AD0F22728987` | **MISSING** | 未部署 |
| `VENDOR.md` | `D1AAD061AD81E48D` | **MISSING** | 未部署 |
| `deploy-vendor.ps1` | `9AA4D6859669247A` | MISSING | 正常（脚本不自拷） |

**结论：vendor 已正确部署，不存在「两个版本在跑」的问题。** 运行中的节点与仓库逐字节一致。

### 5.2 `nodes.py` 为什么没被部署 —— 已用「脚本循环逐行复刻」实测排除脚本嫌疑

我把 `deploy-vendor.ps1:96-107` 的复制循环原样复刻，输出写到 `%TEMP%` 下的临时目录
（**不动仓库、不动 ComfyUI**，脚本 `_audit_run/_b5_deploy_sim.ps1`），结果：
`copied = 13`，目标里**同时**出现 `nodes.py` 与 `VENDOR.md`。

所以「这两个文件缺失」**不是现脚本 bug**，只能是**部署目录不是用现脚本铺的**。证据链：

1. 部署目录里还留着 **9 个 `*-skill/` 目录**（`audio-drive-skill`、`storyboard-skill`、
   `ns-storyboard-skill`、`oneshot-continuation-skill`、`oneshot-continuation-ns-skill`、
   `continuation-cuts-skill`、`continuation-cuts-ns-skill`、`nonfirst-i2v-skill`、`nonfirst-i2v-ns-skill`）。
   而仓库 `vendor/nanfeng/` 下**只有** `_removed/` 与 `__pycache__/` 两个子目录；
   `VENDOR.md:51-70` 明确记载这 9 个目录于 **2026-11-18** 迁到 `skills/prompt/`。
   → 说明该部署目录是 **11-18 之前**用旧版脚本（当时 `$COPY_EXTS` 只有 `.py`/`.json`，且当时 skill 目录还在 vendor 里）铺的。
2. 之后的更新是**逐个手工拷改过的文件**，不是跑脚本：
   部署侧 mtime 不连续——`context_taper_noise.py` 11-20 17:36:34、`latent_continuation.py` 11-20 17:37:19、
   `__init__.py` 11-22 04:28:58、`h3_generator.py` 11-23 09:53:25，其余 8 个仍是原始 **09-15 12:52:58**。
   手工「只拷改过的」永远不会带上自 09-15 起就没改动过的 `nodes.py` / `VENDOR.md`。
3. **`nodes.py` 就算被拷过去也没用**：`__init__.py:37-38` 只 `from .h3_generator import NODE_CLASS_MAPPINGS / NODE_DISPLAY_NAME_MAPPINGS`，
   `nodes.py` 从未被 import。ComfyUI 只执行包根 `__init__.py` 的映射表，
   所以 `nodes.py` 里的 3 个节点（`NanFengH3PromptDraft`/`NanFengH3ReferenceNumbering`/`NanFengPromptList`）
   **永远不会注册**——`/object_info` 实测三者均返回 `{}`。

**`nodes.py` 是死文件的旁证**（全仓 grep）：
- 插件侧 `host/` 与 `tools/` 的 `*.js/*.mjs` 对 `NanFengH3PromptDraft`/`NanFengPromptList`/`NanFengH3ReferenceNumbering` **零引用**；
- 提示词编译走 `host/bridge/vendors/nanfeng/prompt.js`，不经 ComfyUI 的提示词节点；
- `package.json` 的 `files` 含 `vendor/**/*.py`，它只是被随包分发，从没被消费。

### 5.3 P1：`nodes.py` 与 9 个 skill 残留目录的处置（这是本次唯一的 P1 部署项）

**[P1] 死文件 `nodes.py` + 陈旧 skill 目录同时存在于仓库/部署两侧，制造「哪些才是真在跑的代码」的困惑**
证据：见 5.2。修复（按优先级）：
1. **删除 `vendor/nanfeng/nodes.py`**（287 行，3 个永不注册的类）。若担心丢功能，先确认
   `host/bridge/vendors/nanfeng/prompt.js` 已覆盖同功能（已覆盖：插件自己编译六段式/三字段提示词）。
2. 手工清一次部署目录里的 9 个 `*-skill/` 残留目录。
3. 部署流程固化为「一律跑脚本 + `-Force -Clean`」，并在 `:126` 的「下一步」里加一条
   `curl /object_info | 断言 31 个类齐全` 的验收命令，替代现在只有单节点 `curl` 的检查。

## 六、存疑

以下是我**没能证伪也没能证实**的点，列出来供后续决策，不作为结论使用：

1. **`deploy-vendor.ps1` 的 md 白名单分支到底是死是活，受 `$PSScriptRoot` 末尾斜杠影响**
   `:101` `if ($_.Extension -eq '.md' -and $top -ne 'VENDOR.md') { return }`，
   而 `$rel = $_.FullName.Substring($SRC.Length + 1)`、`$top = ($rel -split '\\')[0]`。
   我复刻时 `$SRC` 无末尾反斜杠，`$rel` 正确，`VENDOR.md` **能**通过白名单并被复制（实测 13 个文件含它）。
   但真跑时 `$PSScriptRoot` 是否带末尾反斜杠取决于调用方式（`. \deploy-vendor.ps1` vs 双击 vs `pwsh -File`），
   两者行为可能不同。**存疑**：我无法在不实际执行脚本的前提下确认它在 `$PSScriptRoot` 带斜杠时会不会全跳过 md。
   建议：直接在 `:101` 用 `$rel -ne 'VENDOR.md'` 消除歧义（这条与 §二 的 P2 重叠，但性质是「不确定」而非「已确认 bug」）。
2. **9 个 skill 目录是否真的完全无害**：它们不含 `.py`，ComfyUI 不会 import；
   但 ComfyUI 的 `custom_nodes` 扫描器版本间行为有差异，是否有副作用我没实测（不启停 ComfyUI 是硬约束）。
3. **`SolAttn` / `T8` 分支的「死」是我基于静态控制流（`:1481`/`:1482` 无条件赋 `False`）的判断**。
   如果 `h3_generator.py` 之外有代码（例如 ComfyUI 侧的 monkey-patch、或 `host/bridge` 下发的 overrides）
   能改这两个局部变量的值，分支就复活了。我 grep 过 `host/` 未发现这类注入，但不能穷举。
4. **`host/bridge/vendors/nanfeng/param-docs.js` 里若干 `h3_generator.py:<行号>` 引用已与当前源码错位**
   例：`param-docs.js:25` 说 `h3_generator.py:1689` 是 `hd_second_pass = False`，
   而当前 `:1689` 是 `TrimAudioDuration` 的 `start_index`；`:1729` 注释已写「hd_second_pass 不再存在」。
   这类行号引用**系统性地**过时，我抽查了 6 处都不对。属 P3 但影响面是「注释误导排查方向」，
   未逐条列全（约 40+ 处），建议后续跑 `npm run audit:params` 时一并校准。
5. **`参数 221` 与多处文档写「217」的差异**：`__init__.py:26`、`package.json` 的 `description`、
   `host/bridge/vendors/nanfeng/graph.js:8` 都写 217，实测 `/object_info` 是 **221**。
   我没有 Git 历史证据说明是哪 4 个后加的，但按 append-only 约定可推断是 V15 后期追加字段。
   属 P3 文档陈旧，建议统一为 221（或改成「200+」避免再次漂移）。

## 七、清理清单（§清理）

### 7.1 建议删除（P3，零风险）

| 项 | 位置 | 理由 |
|---|---|---|
| `__pycache__/`（10 个 `.pyc`） | `vendor/nanfeng/__pycache__/` | 本地运行残留，随仓库分发无意义；`.gitignore` 应覆盖 |
| `__pycache__/`（4 个 `.pyc`） | `host/blender/__pycache__/` | 同上 |
| `nodes.py`（287 行） | `vendor/nanfeng/nodes.py` | 死文件：不被 `__init__.py` import、全仓 JS 零引用、3 个类永不注册 |
| 9 个 `*-skill/` 残留目录 | `ai-runtime/ComfyUI/custom_nodes/nanfeng_prompt_nodes_v15_modified/`（**部署侧**，非仓库） | 仓库已于 11-18 迁出，部署侧是旧版脚本残留 |

### 7.2 建议保留但加说明（P3）

| 项 | 位置 | 处置 |
|---|---|---|
| `_removed/`（5 文件，约 83 KB） | `vendor/nanfeng/_removed/` | **确认不被主流程 import**：`__init__.py:37-38` 只 import `h3_generator`；`_removed` 不在 `$COPY_EXTS` 之外的处理路径上（被 `$EXCLUDE_DIRS:88` 排除）。但注意 `_removed/audio_drive_api.py:13` 有 `from . import storyboard_api as storyboard_core`——**若有人把 `_removed/` 加进包扫描就会连锁 import**。建议加 `_removed/README.md` 一行「不加载、不得 import」，或直接移出 vendor 归档到 `docs/history/` |
| 12 个历史版本类（V1–V9） | `h3_generator.py:1223-2356` | **禁止删除**（V15 schema 靠它们链式追加），加注释 |
| `NanFengH3PrepareReferences` | `h3_generator.py:456-492` | 真死代码，但只有 ~37 行；删或留均可，建议删 |

### 7.3 陈旧注释 / 文档（P3，需逐条改）

| 位置 | 现状 | 应改为 |
|---|---|---|
| `vendor/nanfeng/__init__.py:26` | 「生成主节点（217 参数）」 | 221 参数 |
| `vendor/nanfeng/__init__.py:20` | 「见 host/services/nanfeng/storyboard.js」 | `host/bridge/llm/storyboard.js`（该路径已迁移；`smoke-api.mjs:2803-2807` 有断言 `host/services/nanfeng` **必须不存在**） |
| `package.json` `description` | 「南风 V15，217 参数」 | 221 |
| `host/bridge/vendors/nanfeng/graph.js:8` | 「接收 217 个」 | 221 |
| `VENDOR.md:25` | 「h3_generator.py 2590 行（原 2596）」 | 实测 **2475 行** |
| `VENDOR.md:26` | 目录树里仍列 `nodes.py` | 删（文件建议删除） |
| `VENDOR.md:34-39` | 目录树里仍列 5 个 `*-skill/` 之前的描述 | 已迁出，与 `:51-70` 自相矛盾 |
| `skills/setup/SKILL.md:147` | 「脚本只复制 `.py` 和 `dlss_schema.json`」 | 实际 `$COPY_EXTS = '.py','.json','.md'` |
| `skills/architecture/SKILL.md:458` | 同上 | 同上 |
| `docs/history/SKILL-AUDIT.md:152` | 「10 个 `.py`」 | 现为 12 个 `.py`（含 `_removed`） |
| `h3_generator.py:1515` 等 5 处 | 「已废弃分支：V15 恒不启用」注释 | 保留（这是**有效**说明，不是陈旧） |

### 7.4 Blender 侧清理/校验项

| 项 | 位置 | 说明 |
|---|---|---|
| 重复函数定义 `_walk_like` | `host/blender/actions.py:235` 与 `:252` | **P2**：同名函数定义两次，后者覆盖前者。`:235` 版用 `cycles=1.4` + `_osc(u, cycles*2.0)` 双倍频；`:252` 版 `cycles=1` 并去掉双倍频。生效的是 `:252`。`:235` 是重构残留，建议删（保留 `:252` 的 docstring 说明「cycles 必须整数」，与 `_osc:88-98` 的约定一致） |
| `__pycache__/` | `host/blender/__pycache__/` | 4 个 `.pyc`，清理 |

## 附：Blender 专项结论摘要（详见 §二对应小节，此处给定位）

- **帧号 pad / 帧数校验 / `_running` 哨兵**：`render_shot.py:683-720` 只处理恰 4 位数字源文件、
  目标存在先 `os.remove` 再 `os.replace`（`:712-714`），单帧失败不中断（`:716-718`）；
  `:722-734` 只数 11 字符 5 位帧号；`:863-868` 校验 `n != FRAMES` 直接 `SystemExit`；
  `:840-855` 先写 `_running` 哨兵、`:870-874` 正常收尾才删。**这套设计是正确且必要的**，
  JS 侧 `blender-service.js:603-613` 的三重判定（帧数 >0 / 帧数 == spec.frames / 无 `_running`）与之对齐。
- **坐标转换**：`render_shot.py:554` 注释与 `blender-service.js:18-22` 的 `toBlenderVec()` 约定一致
  （宿主 y=高度 → Blender Z-up）。**唯一换算点**在 JS 侧，Python 侧假定已转换完毕——这是对的，但
  意味着任何新增坐标入口都必须走 `toBlenderVec()`，否则人偶躺平。
- **失败清理**：导入失败退回灰盒不炸整镜（`:787-790` 道具、`:808` 角色）；`.blend` 保存失败只
  `BLEND_SAVE_SKIP` 不中断（`:833-838`）。**哨兵在保存 .blend 之后、渲染之前写**（`:849`），
  即「保存失败也仍会留下哨兵」→ 不会误判成功，正确。
- **`actions.py` ↔ REST 契约**：`actions.py` 60 项 `_SPEC`，JS 侧 `host/store/models.js:434` 的正则
  实测**匹配 60/60、无缺无多**（我用 Python 复刻同一正则比对）。
  `list_actions.py` 输出 `JZ_ACTIONS:` / `JZ_SUMMARY:`，`blender-service.js:916/930` 用
  `/^JZ_ACTIONS:(\[[\s\S]*\])\s*$/m` 贪婪到行尾（`:911-913` 注释记录过 `*?` 截断的历史 bug），契约一致。
  `dump_catalog.py` 走 `python` 直跑（不启动 Blender），只被 `tests/verify-all.mjs` 用作一致性校验。
- **`/blender/actions/catalog` 与 `/blender/actions`**：`host/api/index.js:993` 返回
  `{actions, groups, count}`，数据源是 `models.js:467 listActionCatalog()`（读 `actions.py` 文本 + 正则）。
  **注意**：这里**不复用** `actions.catalog()` 的 `version/axis_contract/joints` 字段——
  `actions.py:828-846 catalog()` 是给 `dump_catalog.py` 用的完整版。两套输出不完全同构，
  但字段 `name/label/group/groupLabel/kind` 一致，前端够用。属 P3 观察，非缺陷。

---

> **审计声明**：全程只读。未修改 `dsh-jiuzhang-studio` 与 `ai-runtime` 下任何文件；
> 未 import 或执行任何节点代码（仅 `ast.parse` 静态解析与 `%TEMP%` 下的复制循环复刻）；
> 未启停 ComfyUI（仅只读 `GET /object_info`）。
> 判定脚本与中间数据留在 `F:\AI视频\_audit_run\`：`_b5_ast*.py`（AST 分析）、
> `_b5_live_schema.json`（221 键实测快照）、`_b5_final_table.txt`（逐参数判定表）、
> `_b5_dead.json`（42 个死参数）、`_b5_registry.txt`（注册表核对）、`_b5_deploy_sim.ps1`（部署复刻）。
### 7.5 42 个死参数的处置建议（**不要一次性删**）

这些参数**必须保留 schema 声明**，理由是同一条：ComfyUI 的 `widgets_values` 是**按位置**序列化的，
删一个键 = 后面所有键整体前移一位 = 已保存的旧工作流把「降噪强度」的值写进「参考图尺寸」。
上游自己在 `h3_generator.py:1296/:1967/:2003/:2021/:2127/:2369` 反复写了这条约定。

正确做法分三层：

| 层 | 动作 | 影响 |
|---|---|---|
| 上游 `h3_generator.py` | **不动**（保留 `required[...]` 声明） | 旧工作流位置不变 |
| 插件桥接 `host/bridge/vendors/nanfeng/schema.js` + `param-docs.js` | 给 42 个键打 `dead: true` / 隐藏标记 | 前端不渲染，用户改不到 |
| 插件前端 | 不渲染 `dead` 字段 | 面板从 221 项降到 ~179 项 |

**当前状态**：`param-docs.js` 只对其中一部分打了 `dead` 标记（如 `全局修复Sigma策略:421`），
另一些（`一采步数`、`音频驱动打点`、`音频驱动分段图片`、`音频驱动分段分镜`、`音频驱动创意`、
`音频驱动排除范围`）**没有标记**，仍会出现在面板里。

**建议落盘的具体清单**（42 个，分组给验收口径）：
- 全局修复/人脸修复 16 个 → 全部 `dead`（`:2078` 注释已自认不显示不读取）
- V4/V5 双采与像素二采 13 个 → 全部 `dead`（`启用H3潜空间放大二采`/`H3一采步数`/`H3二采步数` 是**活的替代品**，别混）
- H3 二采 LoRA/Sigma 4 个 → 全部 `dead`
- 音频驱动 5 个 → 全部 `dead`（但 `音频驱动文件`/`当前起点`/`当前终点` **不是**死参数）
- 其它 4 个（`固定随机种子`/`分块处理`/`分块卸载层数`/`低显存注意力分头数`）→ `dead`

**唯一可以真删的前提**：确认所有用户的旧工作流都已重新保存（`data/shots/*.json` 里不再有旧
`widgets_values` 长度）。在这之前删任何键都是 P0 级数据错位，**不是 P3**。

### 7.6 清理优先级（一次性执行顺序）

1. 清 `vendor/nanfeng/__pycache__/` + `host/blender/__pycache__/`，`.gitignore` 加 `**/__pycache__/`（零风险）
2. 删 `vendor/nanfeng/nodes.py`（死文件，P1）
3. 部署侧手工删 9 个 `*-skill/` 残留目录（P3）
4. 改 §7.3 表里的 6 处陈旧文档（P3）
5. 给 12 个 V1–V9 类加「勿删」注释（P3，防后人误清）
6. `param-docs.js` 补齐 42 个 `dead` 标记（P2，用户可感知）
7. **不要**动 42 个死参数在 `h3_generator.py` 里的声明（见 §7.5）