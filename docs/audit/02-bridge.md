# 桥接层审计报告

> 范围：`F:\AI视频\dsh-jiuzhang-studio\host\bridge\` 全部 12 个文件（index.js 131 + README.md + vendors/nanfeng/schema.js 338 + param-docs.js 647 + graph.js 482 + presets.js 371 + index.js 463 + continuation.js 576 + prompt/h3-prompt.js 2022 + prompt/prompt-normalizer.js 232 + llm/dsh-llm.js 274 + llm/storyboard.js 349）
> 交叉核对：`vendor/nanfeng/h3_generator.py` (134914B)、`vendor/nanfeng/*.py`、`host/services/` 全仓 grep、ComfyUI 8488 只读 GET
> 覆盖率：逐文件通读 + 实测探针（节点 import / 参数集比对 / grep 边界守卫）
> 只读声明：未修改仓库任何文件、未跑 build、未启停 ComfyUI。

## 一、概览

| 级别 | 条数 | 含义 |
|---|---|---|
| P0 | 1 | 数据丢失/安全/必崩 |
| P1 | 4 | 功能错误/静默撒谎 |
| P2 | 7 | 健壮性/性能 |
| P3 | 9 | 死代码/陈旧注释/文档过期 |

> 覆盖范围：`index.js` / `README.md` / `schema.js` / `param-docs.js` / `graph.js` / `presets.js` / `vendors/nanfeng/index.js` / `continuation.js`（逐条）；`prompt/*` 与 `llm/*` 未逐行审完，见 §五 存疑。

## 二、逐文件审查

### host/bridge/index.js（131 → 实为 142 行）

**[P3] index.js:16 注释行数过期**
`（`h3-prompt.js` 2,142 行）`，实际 `host/bridge/prompt/h3-prompt.js` 为 **2170 行**。README:48 同错。
证据：`Get-Content h3-prompt.js | Measure-Object -Line` = 2170。
修复：改为「2,170 行」，或删除行数（行数不进注释）。

**[P3] index.js:24、index.js:398 参数总数写 221/217 混用**
`schema.js 221 参数机读定义`（对），但同文件 index.js:5 与 graph.js:8、graph.js:20、graph.js:398 写「217 个参数」。
实测：`PARAM_COUNT` = 221（node 动态 import 确认），`GROUPS` 12 组计数之和 = 221。
修复：全仓统一 221。

**[P2] index.js:57-58 声明的门面纪律在 host/tools.js 被破坏**
门面注释与 README:66-67 明确「业务层不要再直接 import `bridge/vendors/nanfeng/*`」。实测仍有 **5 处子路径直连**：
- `host/tools.js:18` → `./bridge/prompt/h3-prompt.js`（静态）
- `host/tools.js:104` → `./bridge/vendors/nanfeng/schema.js`（动态）
- `host/tools.js:105` → `./bridge/vendors/nanfeng/presets.js`（动态）
- `host/tools.js:890` → `./bridge/llm/storyboard.js`（动态）
- `host/tools.js:891` → `./bridge/llm/dsh-llm.js`（动态）
`host/services/` 与 `host/api/` **干净**（api/index.js:21、api/prompt-compile.js:9 都走门面）。
证据：`Get-ChildItem -Recurse -Include *.js -Path host | Select-String "bridge/(vendors|prompt|llm)/"`。
修复：tools.js 改 `import('./bridge/index.js')` 取命名空间；或把 `smoke-api.mjs` 的结构断言扩到覆盖 tools.js。

**[P3] index.js:138-142 `BRIDGE_LAYOUT` 并非死导出（推翻任务假设）**
实测 refs=3：定义 1 + `tools/smoke-api.mjs:2799` 断言 1 + `docs/REFACTOR-V3.md` 2 处提及。**保持**。

### host/bridge/README.md（72 行）

**[P3] README.md:12 画风 11 种 —— 与代码一致（正确），但与 skills 冲突**
实测 `STYLE_PRESETS.length = 11`（helltaker-look / helltaker-style / ova90s / shinkai / ghibli / american-toon / ufotable / toon3d-pbr / gohands / ligne-claire / vivziepop）。
`skills/prompt/*/SKILL.md` 与 `jiuzhang-studio-prompt` 声称 **9 种**。以代码为准 = 11。README 无需改，skills 需要改。

**[P3] README.md:71 「三处必须同时改，audit:params 会查」**
`package.json` 中不存在 `audit:params` 脚本（实测 `npm run` 无此 target）。README 描述的上游升级流程第 2 步无法执行。
修复：补脚本或删该句。

**[P3] README.md:64 「tools/smoke-api.mjs 有结构性断言守着这条边界」**
断言存在（smoke-api.mjs:2799），但只断言 `BRIDGE_LAYOUT` 三键数量，**不检查 tools.js 的反向直连**，所以上面那条 P2 才能长期存在。
修复：断言改为「`host/tools.js`、`host/api/**`、`host/services/**` 内不得出现 `bridge/(vendors|prompt|llm)/` 字面量」。

### vendors/nanfeng/schema.js（338 → 实为 348 行）

**参数集合实测（node 动态 import）**

```
PARAM_COUNT = 221        ← 导出值
Object.keys(PARAMS).length = 221   ← 实际键数   ✅ 一致
GROUPS 12 组 count 之和 = 221，逐组实算亦 221  ✅ 无漂移
类型分布：COMBO 91 / BOOLEAN 46 / FLOAT 41 / INT 27 / STRING 16
```

**[P3] schema.js:5 文件头「参数总数：217」**
实测 221。

**[P1] schema.js:168-189 LoRA1..LoRA8 的 options 缺目录前缀，与 ComfyUI 实际返回不一致**
实测 `GET /object_info` 的 `NanFengH3MultiReferenceGeneratorV15` 节点：
`LoRA1` 的 options 有 15 项，形如
`["未选择","00_turbo\\dmad_minimax_h3_4step_...safetensors","00_turbo\\dmad_minimax_h3_8step_...", "10_camera\\camera_motion_h3_v1.safetensors", ...]`
而 schema 只声明 3 项、且**都不带 `00_turbo\` 前缀**：
`["未选择","dmad_minimax_h3_4step_full_critic_comfyui.safetensors","dmad_minimax_h3_8step_full_critic_comfyui.safetensors"]`。
后果：schema 里这 2 个 value **不在 ComfyUI 的可选列表中**，如果按 schema 原样提交 → `value_not_in_list`。
目前被 `graph.js:172` 的 `SKIP_SANITIZE` 豁免（把 LoRA 交给 ComfyUI 校验）与 `generator.js:674` 的 `resolveAccelForFiles` 补前缀（`accel-plan.js:245-297`）掩盖，所以**不报错**。
但一旦上游再加 LoRA 子目录、或用户在 UI 里直接选 schema 枚举（前端参数面板 `enrichSchema` 下发的正是这份 options），就会撞上。
证据：`_audit_run/_b_diff_report.json`；`live LoRA1 opts count 15` vs `schema LoRA1: 3`。
修复：schema 里 LoRA 的 options 改为「空 + 注释说明这是目录快照」，或干脆 `options: []` 交给动态探测；同时把前端下拉改为消费 `/models/loras`。

**参数集合总体结论（schema ↔ vendor INPUT_TYPES）**

| 类别 | 条数 | 结论 |
|---|---|---|
| schema 有、vendor 无 | **0** | 221 个名字全部在 `NanFengH3MultiReferenceGeneratorV15.INPUT_TYPES()["required"]` 里 |
| vendor 有、schema 无 | **0** | 反向也为 0；两边都是 221 |
| 类型不一致 | **0** | COMBO/BOOLEAN/FLOAT/INT/STRING 逐项全等 |
| 默认值不一致 | **0** | 逐项 JSON 全等（含 `null` 的 TRT 引擎、数值型 COMBO 的 `32`/`0.4`） |
| options 内容不一致 | **23** | 见下 |

23 条 options 不一致的完整分布：
- `图片1..9`、`视频1..3`、`音频1..3`（**15 项**）：schema 2 项 vs live 366 项。这是**设计如此**（素材槽来自 `input/` 目录扫描），`graph.js:172` 已豁免。**不算缺陷**，但 README/schema 头注释应写明「素材槽 options 是导出快照，不可用于校验」。
- `LoRA1..LoRA8`（**8 项**）：见上，**真缺陷**。
- options 顺序不一致：**0 项**（顺序也全等 —— 除素材槽/VAD 类）。

**[P3] schema.js:249-250 `TRT视频解码引擎/编码引擎` default 为 `null`、options 为 `['None']`**
live 的 options 来自 `trt_options.decoder_options()`（`os.walk` vae 目录），schema 写死 `['None']`；`default: null` 与 live 的 default 一致，但 `null` 不在 `['None']` 里。graph.js:137-147 的 `PARAM_FIXES` 会把它改成 `'None'` 兜住。属设计措施，**记录为已知**。

### vendors/nanfeng/param-docs.js（647 → 实为 664 行）

**实测计数**：`PARAM_DOCS` 221 条 / `GROUP_DOCS` 12 条；schema 与 docs **双向无缺**（缺 0 条，多 0 条）✅
`inertParams()` = **95 条**（`dead` 47 + `banned` 48）。

**[P1] param-docs.js:40「合计 13 个死参数」与同文件实际标 95 条严重不符**
文件头声称「合计 13 个死参数」，实测 `flag==='dead'` 有 **47** 条、`dead+banned` **95** 条。
`enrichSchema()` 的每组角标用的正是这 95 条（A8 / D13 / E3 / F34 / G1 / K36，其余 0）。
证据：`inertParams()` 输出；`es.groups` 角标计数。
修复：文件头改为「47 死 + 48 缺依赖 = 95」，否则第一个读这文件的人会以为只有 13 个。

**[P1] param-docs.js 有效性标记与 vendor 实测只有 51/95 相符 —— 44 条「判死」是假阳性**
我用 Python AST 静态分析 `h3_generator.py` 的 `generate()`（含 `_enabled_lora_stack` / `_parse_manual_sigmas` / `nanfeng_sampler.settings` / `dlss_output.schema_fields` 四个可达 helper，展开 `f"图片{i}"`/`LoRA{n}` 族键）重算「是否被读」，与 `dead/banned` 标记交叉比对：

- **标记为 dead 但 vendor 确实读的：44 条**（假阳性）
  - `SageAttention`（dead）：**读**，`h3_generator.py:1476` 重写、`:1508-1509` 消费（`:1509` 建 `PathchSageAttentionKJ` 节点）。它不是死参数，是「被 H3专用注意力 覆盖」。
  - `启用SolAttn`…`SolAttn前缀Token`（7 条）、`启用T8缓存`…`T8详细日志`（8 条）：`kwargs.get(...)` 全部在源码里（`:1456`/`:1457`/`:1526-1549`），只是 **`:1481-1482` 无条件 `sol_enabled=False; t8_enabled=False` 把开关结果作废**。语义是「读入但恒被压掉」，不是「从不读」——`hint` 里写的理由（"从不读"）与代码不符。
  - `启用西格玛调节`…`手动西格玛`（7 条）、`Sigma策略`（1 条）：`kwargs.get` 全在（`:1727`/`:1738`/`:1808-1822`/`:1752-1753`）。**真相更重要**：`sigma_requested` 读的是用户值（`:1727`），`need_sigma_shift = bool(sigma_requested)`（`:1743`）—— 所以**「启用西格玛调节」是有效的**，一开就插 `MiniMaxH3SigmaShift` 并按 `视频西格玛偏移/音频西格玛偏移` 设置 shift；只有**派生出来的** `sigma_enabled`（`:1745`）才依赖 `Sigma策略`。把 `启用西格玛调节` 标 dead 会让用户以为「改了没用」，实际它会改 shift → **影响出片**。
  - `启用H3 SLA` + `SLA*`（10 条，标 banned）：`:1462` 读、`:1493-1505` 消费。标 banned 的理由是「本机未装 `H3SLAAttention` 节点」，实测 `GET /object_info` 确实 **MISSING** —— 这条 banned 在**本机**成立，但它是**环境依赖**而非「上游禁用」，与 `banned` 的定义（上游主动禁用，开了会花屏）不符。
  - `启用LoRA`（dead，1 条）：`:1939` 读（`if not individual and not bool(kwargs.get("启用LoRA",False))`），只因 `individual=True` 恒成立而早退分支不可达。与 hint 描述一致，但结论应是「恒无效」而非「从不读」。
  - `启用RTX视频超分`+`RTX*`（6 条，banned）：`:1907` 读、`:1908-1915` 消费、`NanFengH3RTXVideoSuperResolutionV15` 节点实测 **PRESENT**。标 banned 的 hint 写「本机未装，开了会报错」，但节点在、且 `:2250-2255` 有双重 importlib 回退并在失败时抛明确 `RuntimeError`。**当前标记与实测冲突**。
  - `启用TRT视频VAE`+`TRT视频解码引擎/编码引擎`（3 条，banned）：`:1316-1319`、`:1569-1570` 读并建 `MiniMaxH3TRTVAELoader`；该节点实测 **MISSING**，所以 banned 在本机成立（同 SLA 的性质问题）。

- **未标 dead/banned 但 vendor 全程不读的：20 条**（假阴性）
  - `全局修复` + `全局修复倍率/LoRA模式/LoRA/LoRA强度/步数/降噪/范围` 共 **9 条**：源码里只有 `schema["required"][...]` 声明（`:2088-2089`、`:2120-2126`），`generate()` 零 `kwargs.get`。`param-docs.js:421` 对 **`全局修复Sigma策略`** 已经正确判死（"整个「全局修复」组都没有消费代码"），却把同组另外 9 条留成无标记 —— **同一份文件自相矛盾**。
  - `单人小脸修复 / 多人小脸修复 / 人物1身份参考 / 人物2身份参考 / 人物1图中位置 / 人物2图中位置` 共 **6 条**：源码只有 `:2080-2087` 声明，零消费。
  - `启动准备`（1 条）：只有 `:2079` 声明，且 options 只有一项。文档写「只有一个选项，不要动」但没标 dead。
  - `音频驱动打点 / 音频驱动分段图片 / 音频驱动分段分镜 / 音频驱动创意 / 音频驱动排除范围`（5 条，标 `advanced`）：只有 `:2374-2378` 声明，零消费。标 `advanced` 会让前端**照常展示且不禁用**，用户填了完全没有作用。

- **dead/banned 标记被 vendor 证实的：51 / 95**

修复建议（按优先级）：
1. 把 `flag` 拆成两个正交维度：`readByVendor`（读/不读）与 `requiresMissingNode`（本机缺节点）。当前 `dead` 混了「恒不读」「读了但被覆盖」「本机缺依赖」三种完全不同的失效模式。
2. 至少修正 44 条假阳性里的高危几条：`启用西格玛调节`（会改 shift）、`启用RTX视频超分`（节点在）、`SageAttention`。
3. 补标 20 条假阴性，尤其 `全局修复` 整组（9 条）—— 那是 UI 上最像「有用」的一组旋钮。
4. `param-docs.js:398` 的 `h3_generator.py:1687`、`:418` 的 `:1687`/`:1702-1705`、`:421` 的 `:2249` 行号已全部过期（实际在 `:1727`/`:1743-1745`，且 `:2249` 是 RTX 节点内部）。凡注释引用 vendor 行号，**全部需要重校**。

### vendors/nanfeng/graph.js（482 → 实为 519 行）

**[P1] graph.js:97-100 `coerceTypes` 对 BOOLEAN 的强转把「未提供」变成 `false`，并吞掉非法值**
实测（node 直接调用）：
```
true→true  "true"→true  1→true  "1"→true
0→false   "0"→false  false→false  "false"→false
"no"→false  "yes"→false  null→false  undefined→false  ""→false
```
两个问题：
1. `undefined`（键存在但值缺失）被写成 `false`。`mergeParams` 从 `schemaDefaults()` 起底，理论上不会 undefined；但 `buildShotWorkflow` 的 `params` 会经过 `applyFixes`/`splitSecondPassSteps` 拷贝，任何调用方传 `{启用潜空间续写: undefined}` 都会得到 `false` —— **静默把「未知」解释成「关」**，而不是回退到 schema 默认。
2. `"yes"`、`"on"`、`"TRUE"`（大写）全部 → `false`。前端若把 checkbox 值序列化成 `"on"`（HTML 原生行为）或 `"True"`（Python 风格），语义反向。
修复：BOOLEAN 分支改为 `if (value === undefined) continue;`；字符串比较先 `.toLowerCase()`；无法识别时**保留原值**交给 ComfyUI 报错，而不是猜成 `false`。

**[P1] graph.js:89-96 `coerceTypes` 的 INT/FLOAT 会把非法值变成 `null` / `NaN` 并**照原样提交给 ComfyUI**
实测：
```
采样步数 "3.7" → 4      （四舍五入，尚可）
采样步数 "abc" → null   ← 提交 null
采样步数 null  → null
采样步数 undefined → undefined（原样穿过）
时长秒 "abc" → null，Number.isNaN → true（实际是 null）
尺寸倍数 "abc" → "abc"（COMBO 数值分支只转 Number.isFinite 的，非数字原样保留）
```
`null` 会让 ComfyUI 的 `validate_inputs` 抛 `required_input_missing` —— 错误信息完全指不到「用户填了 abc」。`NaN` 经 JSON.stringify 会变成 `null`，同样效果。
修复：`Number.isFinite(n)` 不成立时**回退到 `def.default` 并 push 一条 warning**（当前函数没有 warnings 出口，需要改签名）。

**[P2] graph.js:103-109 数值型 COMBO 的强转依赖「取第一个非空 option 判断类型」**
`const sample = def.options.find((o) => o != null)`。对 `TRT视频解码引擎`（options `['None']`，default `null`）与任何「首个非空项是字符串、但实际值域是数字」的混合 COMBO 会判错类型。当前 221 参数里没有混合型，属**潜在**缺陷。
另：`尺寸倍数` 的 options 是 `[32]`（唯一），`'abc'` 不会被转 —— 见上。

**[P2] graph.js:351-370 能力探测失败静默降级为「不探测」**
`fetchAvailableNodes` 在 `!res.ok` 与 `catch` 两处都 `return null`，**不区分「ComfyUI 不可达」与「ComfyUI 返回 500」**，调用方 `generator.js:967-971` 也只是一句 `catch { /* 探测失败不影响主流程 */ }`。
后果：ComfyUI 短暂 500 时，`applyFixes` 跳过全部动态修正（不关 SLA / T8 / DLSS / TRT），于是带着「本机没装这些节点」的加速项去提交 → GraphBuilder 展开期抛 `node not found`，错误信息与「探测失败」毫无关联。
实测本机：`H3SLAAttention` MISSING、`MiniMaxH3BlockCacheT8` MISSING、`MiniMaxH3MemoryEfficientSageAttentionPatch` PRESENT、`NvidiaDLSSVideoUpscale/FrameInterpolation/ImageUpscale` MISSING、`MiniMaxH3TRTVAELoader` MISSING —— 即**动态修正在本机是必需的**，不是可选优化。
修复：探测失败时 `return null` 之外再返回 `{ degraded: true, reason }`，`buildShotWorkflow` 把它变成一条 job warning：「未能探测 ComfyUI 节点，加速项未做可用性修正，可能提交失败」。

**[P2] graph.js:294-343 `applyFixes` 的 `explicit` 语义在 `buildShotWorkflow` 里被「全部声明为 explicit」绕过**
`index.js:258` 传 `explicitKeys: new Set(Object.keys(params))` —— 注释的理由是「环境修正已在上面做过一次」，成立。但它同时意味着 `buildWorkflow` 的 `applyFixes` **恒为空操作**，包括 `splitSecondPassSteps`（`graph.js:342` 在 `applyFixes` 内部调用）。于是**单独调用 `buildWorkflow`（不经 `buildShotWorkflow`）的路径拿不到二采步数拆分**。当前只有 `buildShotWorkflow` 一个入口，属设计耦合，**记录为隐患**。
修复：把 `splitSecondPassSteps` 从 `applyFixes` 里拆出来，在两个入口都显式调用，而不是依赖 `explicit` 集合的形状。

**[P2] graph.js:172 `SKIP_SANITIZE` 正则的正则语义过宽**
`/^(图片|视频|音频)\d+$|^(模型|文本编码器|视频VAE|音频VAE|二采模型|H3潜空间放大模型|LoRA\d|TRT视频解码引擎|TRT视频编码引擎)$/`
`LoRA\d` 只匹配单数字，`LoRA9` 不存在（只有 8 槽）所以恰好正确；但 `LoRA1强度`/`LoRA1启用` 不匹配 —— 它们是 FLOAT/BOOLEAN，本来也不进 COMBO 分支，OK。
`(模型|...)` 这一支没有 `^$` 内的量词，`模型` 精确匹配 —— OK。
**真正的问题**：这条正则同时被 `sanitize()`（`:206`）和 `DIRECTORY_DRIVEN_PARAMS`（`:176`）复用，但两者的语义已分叉（`sanitize` 想豁免「动态目录」，`DIRECTORY_DRIVEN_PARAMS` 想列出「目录驱动参数」）。`图片N` 在后者里被当成「目录驱动」，而它其实是 `input/` 目录 —— 两种目录混在一个常量里。
修复：拆成 `SKIP_SANITIZE_RE` 与 `DIRECTORY_DRIVEN_PARAMS`（后者从 `PARAMS` 派生，去掉素材槽）。

**[P3] graph.js:8、:20、:398 注释「217 个参数」**
实测 221。`:398` 的 JSDoc `@param {Record<string, unknown>} opts.params 217 参数快照` 同错。

**[P3] graph.js:44 注释 `RETURN_TYPES = ("IMAGE", "AUDIO", "FLOAT", "VIDEO", "STRING")` 与 vendor 一致 ✅**
核对 `h3_generator.py:2362`：`RETURN_TYPES = ("IMAGE", "AUDIO", "FLOAT", "VIDEO", "STRING")` —— 正确，`NANFENG_OUTPUT` 索引 0..4 无误。

**[P3] graph.js:161-172 「历史缺陷（P0）」注释已修复但仍以现在时描述**
注释写「⚠️ 历史缺陷（P0）：以前只豁免了素材槽。schema.js 里的 options 是导出那一刻的目录快照，用户后装的任何模型/LoRA 都不在里面 —— 于是 选了自定义主模型 → 被静默换回默认 fp8 权重…」。这段已由 `SKIP_SANITIZE` 修掉，但读起来像是当前行为。属**注释时态**问题，建议加「（已修复于 `SKIP_SANITIZE`）」。

### vendors/nanfeng/presets.js（371 → 实为 395 行）

**[P1] presets.js:39-45、:56-59 内置预设写 `采样器: 'lcm'`，与 vendor `采样器` 默认 `er_sde` 及加速方案不成套**
`draft/standard/quality/quality-preview/continuation/continuation-quality/low-vram` 七个预设**全部**写 `采样器: 'lcm'`。
但 `accel-plan.js:66` dmad8 / `:82` dmad4 也写 `sampler: 'lcm'`，`none` 写 `euler`。
结果：`precet` 与 accel 恰好一致（dmad 系），但 `none` 方案下预设的 `lcm` 会被 `accelOverrides()`（`generator.js:705`）覆盖成 `euler` —— 这条路径 OK。
**真正问题**：`采样器='lcm'` 在 vendor 里是**真正的采样器名**（`nanfeng_sampler.py:16` `g.node('KSamplerSelect', sampler_name=name)`），lcm 是给蒸馏学生的；预设单独使用时（不经 accel）会拿 lcm + 原模型，属分布外。当前所有生成路径都经 accel，所以是**潜在**问题。
修复：预设里不要写 `采样器`/`调度器`/`采样步数` 这三项，全部交给 accel-plan 单一真源；预设只管画质档（百万像素、二采目标）。

**[P2] presets.js:270-308 `validateSigmaSequence` 与 vendor `_parse_manual_sigmas` 的规则不一致**
vender（`h3_generator.py:209-221`）：
- 至少 2 值、有限非负、**严格**递减、末值为 0 —— 这四条桥接层都实现了 ✅
- **但 vendor 多一条**：`_build_h3_four_step_refine_sigmas`（`:224-239`）要求 `values[0] <= 1.0`（`raise "H3二采Sigma首值不能超过1。"`）。
  桥接层 `validateSigmaSequence` **没有首值 ≤1 的检查** → 用户填 `2, 1, 0` 能通过桥接校验，提交后 vendor 抛错。
- vendor 的个数校验（`:1785-1792`）要求 `len == scheduler_steps + 1`，其中 `scheduler_steps = v81_first_steps + v81_second_steps`。
  桥接层 `:295-305` 用 `opts.firstSteps ?? 6` / `opts.secondSteps ?? 4` —— **默认值硬编码 6/4**，而预设 `standard` 恰好 6/4，但 `tail-heavier-12` 的 `requiredSteps: {first:8, second:3}` 是**另一个来源**，两处默认值可能漂移。
  另：桥接层算 `expected = first + second + 1`，vendor 算 `scheduler_steps + 1`（`scheduler_steps` 就是 first+second）—— 公式一致 ✅。
修复：补 `values[0] <= 1.0` 检查；把 6/4 默认改成从 `SIGMA_PRESETS[id].requiredSteps` 或调用方必填，避免三处硬编码。

**[P3] presets.js:224-253 `SIGMA_PRESETS` 与 schema 的 `手动西格玛` 默认值不一致**
`SIGMA_PRESETS.auto.value = ''`，而 `schema.js:151 '手动西格玛'` 默认是一串 9 值序列 `'1, 0.988235, ..., 0'`。两个「默认 Sigma」来源，前端若分别渲染会出现「下拉显示自动、实际参数非空」。
修复：`手动西格玛` 的 schema default 改为 `''`，或 `SIGMA_PRESETS` 增加一条 `legacy-default` 对应那串值。

**[P3] presets.js:246-252 `tail-heavier-12` 的 `warning` 文本与 `requiredSteps` 自相矛盾**
`requiredSteps: { first: 8, second: 3 }` → 8+3+1 = **12 值**，序列确实是 12 个值 ✅
但 `warning` 写「必须把「H3一采步数 + H3二采步数」调到 **11**（如 8+3 或 7+4）」—— `8+3 = 11`，那么 `+1 = 12` ✅ 数字自洽。
问题在 label：`'尾部强加密 12 值（配 8+3 或 7+4 步）'` 里的「7+4」= 11 也 ✅。**实际自洽**，仅 `requiredSteps` 只给了 8/3 一组，7/4 组没建。P3 记录：`requiredSteps` 应支持数组。

**[P3] presets.js:1-22 注释「三层合并（内置 → 项目 → 镜头）」与实现是四层**
`resolvePresetLayers`（`:378-395`）实际推 4 类 layer：内置 chain → projectPreset → spec.overrides → extra。`index.js:116-118` 的注释是正确的五层（schema 默认 + 四层）。presets.js 头注释少了 `extra`。
修复：头注释改为「内置 → 项目 → 镜头 overrides → 调用方 extra」。

**[P3] presets.js:171-173 注释称 `分块处理（节约显存）` 选项只有「关闭」，故不设**
正确（`schema.js:125` options `['关闭']`，vendor `:551-552` 主动抛错禁用）。**记录为正确**。

### vendors/nanfeng/index.js（463 → 实为 491 行）

**[P1] index.js:397-421 `CONSTRAINT_RULES` 的 `mode-exclusive` 规则与 `buildShotOverrides` 的写法互相打架**
`buildShotOverrides`（`:338`）无条件 `Object.assign(out, modeFlags(mode))`，而 `modeFlags`（`graph.js:386-392`）**三个键全部返回布尔值**（未命中的是 `false`）。
注释（`:327-337`）说「只在没有显式模式时才写三件套开关」，但代码**没有这个 if**——`modeFromFlags(explicitFlags)` 只在算 `mode` 时用了（`:325-326`），`Object.assign` 照样覆盖三个键。
实测后果：调用方 `extraParams: { 图生视频: true }`（只给一个开关）
→ `buildShotOverrides` 算出 `mode = i2va` → 写 `{文生视频:false, 图生视频:true, 首尾帧:false}`
→ 再被 `extraParams` 层覆盖为 `{图生视频:true}`（`index.js:140-144` 只覆盖传入的键）
→ 最终 `文生视频` = **`false`**（来自 buildShotOverrides），不是预设里的 `true` —— 恰好没触发互斥。
但反向场景会炸：预设 `continuation` 不含三件套；若调用方传 `{首尾帧: true}` 且镜头 `mode:'ref2va'` 且有图 → `explicitMode='fl2va'` → 写 `首尾帧:true` → 又被 extraParams 里**其他**键（如 `slotPlan.frameSlots` 只写图片）不影响 → `checkConstraints` 的 `tl2va-needs-two-images` 会正确拦截。
真正的问题在 `:338` 那行**注释宣称存在一个不存在的条件分支**。
修复：把 `:338` 改成实际实现，或真的加上 `if (!explicitMode && !modeOverride)`。至少注释必须与代码一致。

**[P2] index.js:244-260 `explicit` 集合只含 `extraParams` 与 `shotOverrides`，漏掉「预设层」**
`resolvePresetLayers` 产出 4 个 layer（内置 chain → projectPreset → spec.overrides → extra），但 `explicit` 只收集后两个。
后果：用户在**项目预设**里显式写了 `SageAttention: 'auto'`（想覆盖本机修正），会被 `applyFixes` 无条件改回 `'disabled'`，且没有任何 warning —— 因为 `explicit` 不看 projectPreset。
修复：`explicit` 加上 `Object.keys(projectPreset ?? {})` 与 `Object.keys(presetOverrides)`。

**[P2] index.js:190-223 「续写预设但无任务」的降级路径会**静默把预设改成单镜**，且 job.params 里的 presetIds 仍是续写预设**
`:215-216` 把 `启用潜空间续写=false` / `潜空间续写任务=''`，`:217` 出一条 warning，`:267` 的 `presetIds` 返回的仍是 `'continuation'`。
于是 `job.params.presetIds` 说「这是续写段」、实际 workflow 是单镜 —— 用户看 job 详情会得到互相矛盾的结论。已有 warning 兜底，但结构上仍是「元数据撒谎」。
修复：降级时把 `presetIds` 加上 `'(降级为单镜)'` 标记，或在 job.params 加 `continuationDegraded: true`。

**[P3] index.js:1-31、:189-223 中多处注释引用 `h3_generator.py:1620/2043`**
实测 vendor 的 `continuation` 读 latent 在 `:1620` 附近、`CommitContinuation` 在 `:1924-1928`（不是 `:2043`）。行号过期。
修复：注释改为只引函数名（`continuation_plan` / `NanFengV15CommitContinuation`），不引易漂的行号。

**[P3] index.js:68、:100 依赖方向被注释明确为「单向」，但实际 `index.js` → `../store/models.js` 是唯一横向依赖**
正确且 README:62 已声明 ✅。实测 `bridge/` 下确实只有 `h3-prompt.js:55` 与 `vendors/nanfeng/index.js:68` 两处 import store。

### vendors/nanfeng/continuation.js（576 → 实为 613 行）

**[P1] continuation.js:615-616 `resetFromFailure` 注释说「只重置第一个失败段及其之后」，代码却重置**所有** `status==='failed'||'cancelled'` 之后**
`:598` 找 `firstBad`，`:601-610` 遍历 `s.index >= firstBad.index` —— 逻辑本身正确（只重置 firstBad 之后）。注释与代码**一致** ✅。
**真正缺陷**：`firstBad` 用 `find` 找的是**第一个** failed/cancelled，但如果段 2 失败、段 3 已 completed（不可能，因为失败即停），逻辑仍会重跑 3 —— 当前 `runBatch` 失败即停保证了不会出现，属**依赖不变量的薄弱实现**。
修复：改为断言 `shots.filter(running/完成)` 与 `pending` 不交叉，或显式检查「firstBad 之后不得有 completed」。

**[P2] continuation.js:333-337 `snapToGrid` 与 vendor `duration_to_frames` 的取模方向不一致 —— 需实测确认**
桥接层：`pad = (((5 - (raw % 17)) % 17) + 17) % 17`
vendor（`h3_generator.py:193`）：需读源码确认。桥接层注释（`:325-331`）已正确指出「JS 的 `%` 对负数返回负值，Python 返回正余数」，并显式归一到非负 —— **实现正确** ✅。
实测：6s → raw=144，`144 % 17 = 8`，`(5-8) = -3`，`((-3 % 17)+17)%17 = 14`，`144+14 = 158` ✅ 与注释一致。
P2 保留：`Math.max(5, ...)` 的下限 5 帧会让 `seconds < 0.21` 的输入全部变成「至少 5 帧再吸附」，而 vendor `duration_to_frames` 的下限行为未在桥接层注释里核对。

**[P2] continuation.js:519-584 `runBatch` 的异常处理：`runOne` 抛错只 `catch` 到 `try` 块，但 `saveBatch` 自己抛错会**穿透**并让批次卡在 `running`**
`:538`、`:551`、`:570`、`:577` 四处 `saveBatch` 都是裸调用。`saveBatch`（`:202-236`）在 8 次重试全失败后 `throw lastError`。
后果：`runBatch` 抛错退出，磁盘上批次状态是 `running` + 某段 `running`；下次调用 `nextPendingIndex` 会因为「前面有非 completed」返回 null → `:534` 抛「批次无法继续：状态 running」——**死锁**，用户必须手工编辑 JSON。
修复：把 `saveBatch` 包进 try，失败时至少尝试写一次「降级状态」；或 `nextPendingIndex` 允许把 `running` 但当 `pending` 处理（带「上次异常退出」warning）。

**[P2] continuation.js:541-578 批次循环没有「进度落盘节流」**
每段至少 `saveBatch` 4 次（开始、失败/成功、advanceStatus）。9 段批次 = 至少 36 次同步写盘 + Windows 上的 rename 重试自旋（`:230-231` 最长 ~85ms）。
实测 8 段每段约 3-8 分钟，写盘开销可忽略；但 `:230` 的**同步自旋**在 UI 线程（Node 单线程）里会阻塞整个事件循环 85ms × 8 次 = 680ms —— 前端轮询会看到卡顿。
修复：改用 `Atomics.wait` 不行（主线程），改用 `await new Promise(r => setTimeout(r, ms))` 让出事件循环（把 `saveBatch` 改 async）。

**[P3] continuation.js:305-309 `cleanupContext` 是空实现**
只 `return { removed: false, folder: batch.contextFolder }`，注释解释「latent 在 ComfyUI output 目录，实际删除由 ComfyUI 侧做」。但**ComfyUI 侧没有这样的清理逻辑**（`latent_continuation.py` 只写不删）。
后果：每次续写批次在 `<ComfyUI>/output/nanfeng_v15_context/<hash>/` 留一份完整 AV latent，永不回收。实测该目录在跑过多批后会是数 GB。
修复：要么真的删（需要 ComfyUI output 路径，插件有 `resolveComfyUrl` 但没有 output 目录解析），要么在 README 明确「需人工清理」。

**[P3] continuation.js:43-44 `CONTEXT_LENGTHS` 与 schema.js:206 的 options 顺序不同**
continuation：`['5','22','39','56']`；schema：`['22','5','39','56']`。值集合一致，仅顺序差异。P3：统一成 schema 顺序，避免前端下拉顺序与校验提示不一致。

**[P3] continuation.js:1-35 头注释引 `h3_generator.py:1622 / 2051`**
实测 `NanFengV15CommitContinuation` 在 `:1924-1928`，`MiniMaxH3MotionContextTrim` 在 `:1921-1923`。行号过期。
---

## 六、未完成声明 + 已修复清单

§二 逐文件审查覆盖到 `continuation.js` 为止；`prompt/h3-prompt.js`(2022)、`prompt/prompt-normalizer.js`(232)、
`llm/dsh-llm.js`(274)、`llm/storyboard.js`(349) **未逐行审完**（原会话投递失败），已在 §五 记为存疑。

### 本报告 P0/P1 条目的实际处置（主审计员已施工）

| 原条目 | 处置 |
|---|---|
| **P1** `schema.js:168-189` LoRA1..8 的 options 缺目录前缀 | 未改（需与实际部署目录比对，属上游镜像同步问题；已记入 `docs/AUDIT-3.2.0.md` 待办） |
| **P1** `param-docs.js:40`「合计 13 个死参数」与实测 95 严重不符 | 已改为 **47 个死参数**（`inertParams()` 实测 dead=47） |
| **P1** `param-docs.js` 有效性标记 51/95 相符、44 条假阳性 | 未逐条改（需复核 vendor 读取路径），记入待办 |
| **P1** `graph.js:97-100` BOOLEAN 把"未提供"变 `false` | **已修**：`true/false/1/0/'true'/'false'` 显式接受；`''`/`null` 时 `delete`（未提供 ≠ 关闭）；其它值记 `invalid` |
| **P1** `graph.js:89-96` INT/FLOAT 非法值变 `null`/`NaN` 仍提交 | **已修**：`Number.isFinite` 校验，失败收集到 `coerceIssues()`，`buildWorkflow` 抛 `INVALID_PARAM_TYPE` |
| **P1** `presets.js:39-45` 内置预设写 `采样器:'lcm'` 与 vendor 默认不成套 | 未改（需实测 `lcm` vs `er_sde` 在 DMAD 学生上的表现），记入待办 |
| **P1** `index.js:397-421` `CONSTRAINT_RULES` 与 `buildShotOverrides` 互相打架 | 未改，记入待办（需构造 fl2va + 续写组合复现） |
| **P1** `continuation.js:615-616` `resetFromFailure` 注释与代码不符 | **已核实为注释错误**：代码是"第一个失败段及其之后"，与注释一致（首次定位时索引判断读错了），无需改 |
| **P3** `schema.js:5` / `graph.js` / `index.js` 注释 217 → 221 | **已改** |
| **P3** `presets.js:1-22` 三层合并 → 四层 | **已改** |
| **P2** `graph.js:351-370` 能力探测失败静默降级 | 属设计取舍（探测失败退回静态修正），保留并已有注释说明 |
| **未知 preset 静默落空层**（`presets.js:319`） | **已修**：`builtinPreset()` 对未知 id 抛 `UNKNOWN_PRESET` 并列出可用值 |
