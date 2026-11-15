# A 组审计 —— 立绘拆解 / 角色卡仓库 / 服化道 / 编号与参考图预算

> 审计对象：`F:\AI视频\工作室\dsh-jiuzhang-studio`（v1.5.0）
> 审计日期：2026-11-15
> 审计范围：
> - `host/services/breakdown.js` + `host/api/index.js` 的 `/breakdown/*`（L867/L873/L882）
> - `host/services/character-vault.js` + `/vault/*`（L671-714）、`/projects/:id/cards`（L717-736）
> - `host/services/extras.js`（模板 / 服化道 / 孤儿清理）+ `/templates*`（L1011-1021）、`/wardrobe*`（L1024-1034）、`/resources/*`（L1047-1099）
> - `host/services/render-plan.js`、`host/services/shot-context.js`（`<Picture N>` 编号 + 9 图预算）
> - 对应页面：`BreakdownPage.tsx`、`VaultPage.tsx`、`ToolboxPage.tsx`
> 方法：逐文件通读 + 脚本双向路由比对（`client.ts` 101 个方法 → `api/index.js` 106 条字面量路由 + 3 条正则路由）+ 调用链人工追踪。所有结论均附 `file:line`，均经实际读取确认。

---

## 一、结论摘要

> ### ⚠️ 重要时效说明（先读这一段）
>
> 本次审计期间，**另一路 agent 一直在并发修改同一批文件**。实测变化：
> `h3-prompt.js` 1039→1200、`extras.js` 386→441、`api/index.js` 2010→2051、
> `render-plan.js` 508→524、`BreakdownPage.tsx` 296→376、`VaultPage.tsx` 296→333、
> `RenderPage.tsx` 1381→1408、`client.ts` 505→522、`SettingsPage.tsx` 513→455 行。
>
> **11 条缺陷里有 7 条在我写完分析后、交付前被并发修掉了**：
> **A-01 / A-02 / A-03 / A-04 / A-06 / A-08 / A-09**。
> 这 7 条保留在清单里但标注「已修复」，附上修复后的实际代码位置与当前实现 —— 让 lead 知道
> "这些问题曾经真实存在且已解决"，而不是重复劳动。**所有结论与行号以最新文件状态为准**，交付前逐条复核。

| 模块 | 评分 | 一句话结论 |
|---|---|---|
| **角色卡仓库（vault）** | **4.5 / 5** | 数据模型、槽位、预算裁剪、`createdAt` 正序防编号漂移**都是真的做对了**，`cardImagesFor` 的 `both` 修复有**两道**回归盯着（`test-security.mjs:166-179`、`verify-all.mjs:724-729`）。原先的**预算提示算错（A-02）**已修复。唯一残留 **A-07：`/vault/plan` 后端建好了但前端从不调用**，预算口径仍有 `/render/plan` 与 `vault.plan()` 两套。 |
| **编号与参考图预算** | **4 / 5** | `resolvePictureIndices` 从**真实 refList 反推编号**这个核心思路是对的，`/render/plan` 与 `/render/compile` 共用同一份 plan，编号在主链路上**确实不会漂**（有 R22 回归测试）。**A-06 的编号退化路径已修**（`render-plan.js:511-516`）、**A-01 的首尾帧预算已修**（`RenderPage.tsx:327-331/357-360`）—— 但这两处修复**都没有测试覆盖**。这是本轮最值得补的地方。 |
| **立绘拆解（breakdown）** | **4.5 / 5** | 提示词构建器 `buildBreakdownPrompt` 质量很高（1.0.2 细节锁、去掉 Markdown、参数与正文一致，且有回归断言）。**归档路径取错（A-03）**、**无法一键建卡（A-04）**、**`full` 档虚假卖点（A-08）** 均已修复 —— 「立绘 → 拆解 → 建卡 → 仓库 → 注入」主线现已闭环。**这个模块目前基本健康。** |
| **服装 / 换衣 / 服化道（wardrobe）** | **1.5 / 5** | **「换衣」这个功能不存在，一行代码都没有。** 服化道是**纯数据表**：只有 `listWardrobe / upsertWardrobe / deleteWardrobe` 三个 CRUD，没有任何一处把它接进提示词、参考图或生成链路（全仓 grep：`换衣` 命中 **0** 处；`wardrobe` 读取方只有 `tools.js:616` 与 `api/index.js:1025`）。`imageRel` 可存图但 **UI 无选图入口**（`ToolboxPage.tsx` 中 `imageRel` 命中 0 处），恒为 `null`。**这是本组唯一的功能级缺口，也是唯一还没人动的 P1。** |

**一句话给 lead**：vault 与编号主链路的**工程质量明显高于本仓平均水平**（有针对性回归测试、有历史缺陷注释、有单一真源）。**并发修复已经干掉了 11 条里的 7 条**，剩下**真正需要你决策的只有 2 件事**：

1. **A-05 · 换衣（P1 功能缺口，唯一还没动的 P1）** —— 界面上有「服化道」分区，用户会以为录进去的衣服做视频时用得上，实际**零消费方**。30 秒降级（UI 标注"仅素材登记"）或真做（接进 `manualImages`，后端零改动，前端 ~40 行）。
2. **A-07 · `/vault/plan` 零调用（P2）** —— 它比 `/render/plan` 更完整（有 `reserved`、裁剪优先保 sheet），但没人用，导致同一件事有**两套预算算法**。接上它能顺手消除口径分歧。

其余 A-10 / A-11 为 P3。

---

## 二、缺陷清单

> 严重度口径（与 B 组一致）：**P0** = 功能必坏 / 数据损坏 / 安全越界；**P1** = 主要路径不可达或输出错误；**P2** = 局部错误、有替代路径 / 错误处理不当；**P3** = 文案 / 死代码 / 装饰性字段。

### A-01 · ~~P1~~ → **已修复（审计期间被并发修掉）** · 首尾帧从不进入渲染计划，9 图预算在首尾帧场景下系统性算错

> **状态**：本条在审计进行中**已被并发提交修复**（`RenderPage.tsx` 1381→1408 行）。修复方式与本报告原建议一致：两处请求体都补了 `previz`。**lead 无需再动手。**

| 项 | 内容 |
|---|---|
| **原 file:line** | `host/services/render-plan.js:197-199`（`previz?.firstRel / lastRel`）<br>`app-src/src/pages/RenderPage.tsx` 的 `refreshPlan` / `recompile`（原 L302-317 / L321-343，请求体**无 `previz`**） |
| **修复后位置** | `app-src/src/pages/RenderPage.tsx:322-340`（`refreshPlan`）、`:346-370`（`recompile`），关键在 **L327-331** 与 **L357-360** |
| **原缺陷（证据链）** | ① `buildRenderPlan` 完整实现了首尾帧作为 `PREVIZ_FIRST` / `PREVIZ_LAST` 两类参考图（`render-plan.js:197-199`），并在裁剪顺序里给了优先级（L211-212）。<br>② 但**没有任何调用方真的传 `previz`**：`/render/plan`（`api/index.js` 的 `previz: body.previz ?? null`）依赖请求体，而 `RenderPage.refreshPlan()` 只传 `cardIds / videos / audios / refImageSize` → `body.previz` 恒为 `null`。<br>③ 于是 `render-plan.js:198-199` 两个 `if` 恒不成立，`plan.images` 里**永远没有首尾帧**。<br>④ 而用户**确实**能在渲染页生成控制视频（`api.blenderRender` → `setControlRel`），也能在画布节点上设首帧（`canvas/runner.ts:171-178`）。<br>⑤ 结果：`plan.stats.total`（`render-plan.js:427`）**不含首尾帧**，顶栏徽标（`RenderPage.tsx` 的 `参考图 {budget.total}/{budget.limit}`）显示 **8/9 绿色安全**，实际提交 **9 张**；再加一张就静默超限。裁剪逻辑（L210-231）也永远不会因首尾帧触发，`warnings` 也就不提示。 |
| **当前实现（已修）** | `refreshPlan`（L327-331）：<br>```ts<br>// ⚠️ 首尾帧必须传：它们在 buildRenderPlan 里是 PREVIZ_FIRST/LAST 两类<br>//    参考图，占 9 图预算。不传 → 徽标与实际提交数量对不上。<br>previz: (previzRefs.firstRel \|\| previzRefs.lastRel)<br>  ? { firstRel: previzRefs.firstRel \|\| undefined, lastRel: previzRefs.lastRel \|\| undefined }<br>  : null,<br>```<br>`recompile`（L357-360）用**同一份** `previzRefs`，并注明"与 `/render/plan` 保持同一份 previz 输入，否则两处预算口径不一致"。两个 `useCallback` 的依赖数组（L340、L370）都加了 `previzRefs`。**两处口径一致，修法正确。** |
| **残留建议** | 补回归断言（`tests/verify-all.mjs` R23 旁边）：`buildRenderPlan({ cards:[…8 张], previz:{ firstRel:'x' } }).stats.total === 9`，且第 10 张触发 `warnings` 裁剪。目前只有前端传参的修复，**后端的首尾帧预算分支（`render-plan.js:197-199` + L211-212）仍无测试覆盖**。 |

---

### A-02 · ~~P1~~ → **已修复（审计期间被并发修掉）** · 角色卡仓库页的"本卡占用 N 张"预算提示与后端真实取图不一致

> **状态**：本条在审计进行中**已被并发提交修复**（`VaultPage.tsx` 296→333 行）。修复者把本报告的分析原样写进了 L153-166 的注释，并按建议改用后端真值。**lead 无需再动手。**

| 项 | 内容 |
|---|---|
| **原 file:line** | `app-src/src/pages/VaultPage.tsx:153-166`（`budgetHint` 本地近似算法） |
| **修复后位置** | `app-src/src/pages/VaultPage.tsx:153-171` |
| **原缺陷（证据链）** | 页面自己用 `useMemo` **重实现了一遍**"这张卡占几张"，但**只看了 `sheet` / `origin` 两个槽**，漏掉后端 `cardImagesFor` 的两个关键行为：<br>① **`heads` / `extras` 补位**：`character-vault.js:141-154` 在 `picked.length < max` 时**继续从 `heads` 和 `extras` 往里塞**。复现：`sheet-first` + `maxImages=3` + sheet 1 张 + heads 2 张 → 后端返回 **3 张**，页面显示 `min(1,3) = 1 张`。<br>② **`sheet-first` 只有 heads 时后端会取 heads**：`character-vault.js:133-138` 是 `if (sheet) … else if (origin) … else if (heads.length) picked.push(heads[0])`。页面 `else used = sheet \|\| origin ? 1 : 0` 算出 **0 张**，后端实际带 1 张。<br>③ **两个页面口径不同**：Projects 页用后端 `imageCount` 求和（`ProjectsPage.tsx:290`），Vault 页用本地近似 —— 同一个数字在两页不一致，用户无从判断哪个对。 |
| **当前实现（已修）** | `VaultPage.tsx:167-171`：<br>```ts<br>const budgetHint = useMemo(() => {<br>  const max = meta?.limits.maxRefImages ?? 9;<br>  const used = draft.resolvedImages?.length ?? draft.imageCount ?? 0;<br>  return { used, max, per: Number(draft.refPolicy?.maxImages ?? 1) };<br>}, [draft, meta]);<br>```<br>直接读后端 `enrich()`（`character-vault.js:190-197`）回填的 `resolvedImages` / `imageCount`。注释（L156-165）完整记录了两个漏算点与"本地未保存时是旧值（可接受）"的取舍。**与报告原建议一致。** |
| **残留** | 无。 |

---

### A-03 · ~~P1~~ → **已修复（审计期间被并发修掉）** · 拆解图完成后按 `path` 找产物，而归档后真正可用的是 `rel` / `assetId`

> **状态**：本条在审计进行中**已被另一路并发提交修复**（`BreakdownPage.tsx` 从 296 行扩到 376 行）。保留用于记录缺陷与修法的对应关系，**lead 无需再动手**。

| 项 | 内容 |
|---|---|
| **原 file:line** | `app-src/src/pages/BreakdownPage.tsx:113`（类型声明）、`:116-117`（取值）、`:47`（state 类型） |
| **修复后位置** | `app-src/src/pages/BreakdownPage.tsx:116`（改用 `JobOutput`）、**`:120-136`**（新判据 + 归档提示） |
| **原缺陷** | 成功判据写死成 `cur.outputs?.[0]?.path`，而 `outputUrl`（`app-src/src/api/url.ts:22-34`）**优先用 `rel`**。于是 **`path` 为空但 `rel` 有值**的产物被判成"生成失败"，哪怕图已成功产出。另外 `assetId`（`api/index.js` 在 `runAndArchive` 里回填，见 L1570）被丢弃 —— 归档的意义是"产物进素材库"（`api/index.js:738-742` 注释），页面却不告诉用户"已归档"。 |
| **当前实现（已修）** | `BreakdownPage.tsx:128-133`：<br>```ts<br>const out = cur.outputs?.[0] as (JobOutput & { assetId?: string }) \| undefined;<br>if (cur.status === 'completed' && (out?.rel \|\| out?.path)) {<br>  setResult(out ?? null);<br>  toast.ok(out?.assetId ? '拆解图完成，已归档到素材库' : '拆解图完成');<br>}<br>```<br>判据改为 `rel \|\| path`（与 `url.ts` 优先级一致），`assetId` 用于告知归档；类型也从内联对象换成 `api/url.ts:14-20` 已导出的 `JobOutput`（见 L16 的 `import type`、L48 的 `useState<JobOutput \| null>`）。**与报告原建议完全一致。** |
| **残留** | 无功能问题。可选打磨：`failed` 时应展示 `cur.error`（`job-runner.js:213` 会把失败原因写进 `job.error`），当前 L135 只显示笼统的「生成失败」。 |

---

### A-04 · ~~P2~~ → **已修复（审计期间被并发修掉）** · 设计文档承诺的 `from-sheet` 一键建卡不存在

> **状态**：本条在审计进行中**已被并发提交修复**。修复者选择了"前端直接用 `vaultUpsert` 建卡"的方案（即本报告原「最小修法」的等价变体），**未新增后端路由**。

| 项 | 内容 |
|---|---|
| **原 file:line** | `docs/角色卡仓库-设计.md:142`（承诺 `POST /vault/cards/:id/from-sheet`）<br>`host/api/index.js:688`（正则只处理 GET/POST 更新） |
| **修复后位置** | `app-src/src/pages/BreakdownPage.tsx:146-176`（`handleSaveAsCard`）<br>`app-src/src/pages/BreakdownPage.tsx:343-364`（「存为角色卡」UI） |
| **原缺陷** | 设计文档 `docs/角色卡仓库-设计.md:142` 承诺 `from-sheet` 一键建卡，但后端从无此路由、前端也无入口。用户做完拆解图后流程**在第三步断掉**：必须手动开「角色卡仓库」→ 新建 → 在 `sheet` 槽下拉里从几百张未命名素材（自动归档命名是 `图_${job.id}`，`api/index.js:1552`）中靠缩略图找。 |
| **当前实现（已修）** | `handleSaveAsCard()`（L156-176）：<br>```ts<br>const rel = result?.rel ?? result?.path ?? '';<br>if (!rel) { toast.error('还没有可用的拆解图'); return; }<br>await api.vaultUpsert({<br>  name, description: `由立绘拆解生成…`,
  images: { sheet: [rel] },
  refPolicy: { mode: 'sheet-first', maxImages: 1 },
});<br>```<br>UI 在结果图下方（L343-364）：角色名输入框 + 「存为角色卡」按钮 + 说明"拆解图已归档进素材库，建卡后即可在渲染页作为一致性锚点引用"。**「立绘 → 拆解 → 建卡 → 仓库 → 注入提示词」主线现已闭环。** |
| **残留建议** | ① `docs/角色卡仓库-设计.md:142` 仍写着 `POST /vault/cards/:id/from-sheet`，而实现走的是 `POST /vault/cards` —— **文档与实现不符**，建议改为 `POST /vault/cards（前端「存为角色卡」直接调用）`。<br>② `host/services/character-vault.js:336-348` 的 `buildSubjectDefinitions` 仍是**死导出**（除定义处与 `return` 语句 L360 外零调用；实际注入走 `generator.js:286-339` 的 `injectCardDefinitions`），建议删除以免误用。 |

---

### A-05 · P1 · 「换衣」功能完全不存在；服化道只是无消费方的数据表

| 项 | 内容 |
|---|---|
| **file:line** | `host/services/extras.js:47-52`（`WARDROBE_KINDS` 四类定义）<br>`host/services/extras.js:123-150`（`listWardrobe` / `upsertWardrobe` / `deleteWardrobe`）<br>`host/api/index.js:1024-1034`（`/wardrobe*` 三条 CRUD 路由）<br>`app-src/src/pages/ToolboxPage.tsx:190-224`（服化道 UI 分区）<br>**全仓 grep 结果**：`换衣` 命中 **0 处**；`换装` 仅命中 `comic-service.js:55`（漫画的"形态"蒙版，与此无关）；`wardrobe` 的消费方只有 `tools.js:616`（Agent 工具的 list）与 `api/index.js:1025`（HTTP list），**没有任何提示词/参考图/生成链路读取它**。 |
| **现在做什么** | 服化道是一个**纯陈列柜**：<br>· 数据层：`extras.js:123-150`，三函数 + 一个 `data/extras/wardrobe.json` 数组文件。<br>· 路由层：`api/index.js:1024-1034`，GET 列表（支持 `?kind=` 过滤）/ upsert / delete。<br>· UI 层：`ToolboxPage.tsx:190-224`，一个下拉选题材（服装/饰品/武器/道具，L194-199）+ 名称 + 描述，加一条就 `unshift` 进数组，列表里显示 `<Badge>` 和删除按钮。<br>· **字段 `imageRel`**（`extras.js:138`）**可以存图片路径，但 UI 没有任何选图入口** —— `ToolboxPage.tsx:87-97` 的 `saveWardrobe` 里，L91 只传 `{ kind: wdKind, name: wdName, desc: wdDesc }`，**从不传 `imageRel`**，所以它恒为 `null`。<br>· **它不产出任何东西**：不拼进提示词、不进 `resolveRefImages`、不影响 `buildRenderPlan`、不参与 `/generate`。 |
| **为什么是错的** | 这是一个**功能宣称与实现完全脱节**的问题，比 bug 更糟 —— 用户看到「服化道」分区和四个类别（服装/饰品/武器/道具），会合理地认为"我在这里录的衣服，做视频时会用上"。实际不行：<br>① `extras.js:125-128` 的 `listWardrobe` **唯一的调用方**是 `tools.js:616` 的 Agent 工具 `studio_toolbox` 和 `api/index.js:1025` 的 HTTP list —— 两者都只是**把数据读出来给人看**。<br>② 全仓 grep `wardrobe` 的读取点：`tools.js:616`、`api/index.js:1025`、`extras.js:377`（导出表）、`extras.js:391`（别名导出）。**没有任何一个 `generator.js` / `render-plan.js` / `character-vault.js` / `h3-prompt.js` 的代码路径读取它**。<br>③ 注意 `extras.js:6` 的模块头注释写着「`wardrobe`（68 键）服化道素材库」，`skills/jiuzhang-studio-usage/SKILL.md:45,242` 也把它列为工具箱的一个域 —— **文档在与用户确认"这功能存在"**，而它只是一个 CRUD。 |
| **最小修法** | 二选一，**不要保持现状**：<br><br>**(a) 如果这轮不做换衣** —— 在 `ToolboxPage.tsx:150` 的 tab label 与 `extras.js:6` 的注释里明确标注"（仅素材登记，暂不参与生成）"，避免用户误判。这是 30 秒的改动，能让"宣称 vs 实现"的差距消失。<br><br>**(b) 如果要真做换衣**（推荐，工作量可控），最小闭环是把它接成**提示词片段 + 参考图**，复用现有全部管道：<br>1. `WardrobeItem` 补 `imageRel` 的**选图入口**：`ToolboxPage.tsx:194-202` 加一个 `<Select>` 从 `api.listAssets({})` 里挑图（照抄 `VaultPage.tsx:292-301` 的写法）。<br>2. 新增一个"应用服化道到镜头"的入口：在 `RenderPage` 的参考图清单旁加一个 `WardrobePicker`，把选中条目的 `imageRel` 塞进 `manualImages`、把 `name`+`desc` 拼成一句写进 `summary`。<br>3. 后端**零改动** —— `buildRenderPlan` 的 `manualImages`（`render-plan.js:202`）与 `/generate` 的 `shot.refs.images` 已经能吃任意 rel。<br>这样它才真的影响出图，而不是一张永远读不到的表。 |

---

### A-06 · ~~P2~~ → **已修复（审计期间被并发修掉）** · `pictureIndex ?? (i+1)` 让"无图卡"重新获得编号

> **状态**：本条在审计进行中**已被并发提交修复**（`render-plan.js` 从 508 行扩到 524 行，修复者把这个缺陷的完整分析写进了 L499-510 的注释 —— 与本报告结论一致）。**lead 无需再动手。**

| 项 | 内容 |
|---|---|
| **原 file:line** | `host/services/render-plan.js:497-507` 的 **L501**：`pictureIndex: s.pictureIndex ?? (i + 1),` |
| **修复后位置** | `host/services/render-plan.js:497-524`，关键在 **L511-516** |
| **原缺陷（证据链）** | ① `buildRenderPlan` 在卡被完全裁掉时显式产出 `pictureIndex: null`（`render-plan.js:371-383`，L376 就是 `pictureIndex: null`，L372 注释"卡被完全裁掉 → 仍保留文字定义，但标注无图"）。<br>② 这个 `null` 传到 `subjectsForPrompt` 的 `s.pictureIndex ?? (i+1)` —— **`null ?? (i+1)` 等于 `i+1`**（`??` 对 `null` 生效）。于是"无图"被静默改写成"第 i+1 张图"。<br>③ 下游 `normalizeSubjects`（修复后位于 `h3-prompt.js:1071-1080`）用 `s.pictureIndex === null` 判断无图，拿到正整数就判成有图。于是 `subject_definitions` 写出 `<Picture N>`（`h3-prompt.js` 中 `subject_definitions` 段）、`retention_analysis` 写出 `fully_preserved`（L655 的 `if (!s.hasImage)` 不触发）—— **N 指向别的角色的图**。<br>④ 可达性：`/render/compile`（`api/index.js:838` `subjects: subjectsForPrompt(plan)`）是主链路，渲染页每次 `recompile`（`RenderPage.tsx:321-345`）都走这里。触发条件：多卡总图数超 9 且某张卡的图被全部裁掉（`render-plan.js:211-212` 的 `dropOrder` 里 `CARD_SHEET` 排最后，当其它来源删光仍超限时确实会出现"某张卡 0 张图"）。 |
| **当前实现（已修）** | `render-plan.js:511-516`：<br>```js<br>const explicitNull = s.pictureIndex === null;<br>const hasImage = s.hasImage !== false && !explicitNull;<br>return {<br>  …<br>  pictureIndex: explicitNull ? null : (s.pictureIndex ?? (hasImage ? i + 1 : null)),<br>  hasImage,<br>};<br>```<br>三态语义（`null` = 确实没图 / 有编号 = 有图 / `undefined` = 字段缺失才兜底）现在**原样传下去**，与 `h3-prompt.js:1068-1090` 的 `normalizeSubjects` 完全对齐。 |
| **残留建议** | 补一条回归断言（`tests/verify-all.mjs` R22 附近）：构造"一张有图卡 + 一张无图卡"，断言 `subjectsForPrompt(plan)[1].pictureIndex === null`。目前 L511-521 的修复**没有测试覆盖**，而它保护的是"角色串脸"这类最难排查的故障。 |

---

### A-07 · P2 · `/vault/plan` 是设计文档指定的核心预览接口，前端零调用

| 项 | 内容 |
|---|---|
| **file:line** | `host/api/index.js:702-714`（路由实现完整）<br>`app-src/src/api/client.ts:444-451`（`vaultPlan` 客户端方法完整）<br>`app-src/src` **全量语料**：`vaultPlan` 零引用（已脚本确认）<br>`docs/角色卡仓库-设计.md:147-150`（"`/vault/plan` 是关键"） |
| **现在做什么** | 这条路由做得相当完整 —— 会合并 URL 的 `cardIds` 与项目已绑定的卡（`api/index.js:707-708`）、支持 `extra` / `firstLast` 参数、返回 `ctx.vault.plan()` 的完整结构（`character-vault.js:307-323`：`ok/limit/reserved/used/total/characters/extras/warnings/cards`）。<br>**但没有任何前端代码调用它。** |
| **为什么是错的** | ① 设计文档把它定为"生成前看到会传几张图、分别哪张、超没超"的**唯一入口**（`docs/角色卡仓库-设计.md:150`）。<br>② 实际前端用的是**另一套**：渲染页走 `POST /render/plan`（`api/index.js:781`）→ `buildRenderPlan`（`render-plan.js`），这是**第二份**预算计算。<br>③ 于是同一件事有**三个口径**：<br>&nbsp;&nbsp;· `character-vault.plan()`（`/vault/plan`，用于 Projects 页？—— 不是，Projects 页用 `imageCount` 求和，见 `ProjectsPage.tsx:290`）<br>&nbsp;&nbsp;· `buildRenderPlan`（`/render/plan`，渲染页实际用的）<br>&nbsp;&nbsp;· `VaultPage.budgetHint`（本地近似，见 **A-02**）<br>④ 三者**语义还不完全一致**：`vault.plan()` 有 `reserved` 概念（首尾帧占位数，`character-vault.js:273`）且裁剪时**优先保 sheet**（L284-286 的 `sort`）；`buildRenderPlan` 的裁剪是**按来源分层**（`render-plan.js:211-212`），首尾帧根本不参与（见 **A-01**）。用户在不同页面看到的数字无法互相解释。<br>⑤ 顺带：`character-vault.js:336-348` 的 `buildSubjectDefinitions` 与 `plan()` 里的 `cards` 摘要（L316-322）同样无人消费 —— 整个 `vault` 服务里**只有 `list/get/upsert/remove/meta/cardImagesFor` 被真正用上**。 |
| **最小修法** | 二选一：<br>**(a) 删掉** `/vault/plan` 与 `client.ts:444-451` 的 `vaultPlan`，并在 `docs/角色卡仓库-设计.md:147` 注明"由 `/render/plan` 取代"，让文档与实现一致。<br>**(b) 接上它**：在 `VaultPage` 底部加一个「预览本卡在镜头里的占用」面板，调 `api.vaultPlan({ cardIds: [selectedId], firstLast: 0 })` 并把 `warnings` 原样展示 —— 这恰好能修 A-02（用后端真值代替本地近似）。<br>推荐 **(b)**：`/vault/plan` 的路由与 `ctx.vault.plan()` 都已写好且有测试覆盖，接上比删掉划算。但无论选哪个，**都要消除"三份预算算法"**。 |

---

### A-08 · ~~P2~~ → **已修复（审计期间被并发修掉）** · 拆解页把「完整设定卡 `full`」当作有独立效果

> **状态**：本条在审计进行中**已被并发提交修复**（`BreakdownPage.tsx` L282-291）。**lead 无需再动手。**

| 项 | 内容 |
|---|---|
| **原 file:line** | `host/services/breakdown.js:59-63`（`full` 档定义）、`:194`（`standard`/`full` 共用分支注释）<br>`app-src/src/pages/BreakdownPage.tsx:235-254`（原档位选择 UI） |
| **修复后位置** | `app-src/src/pages/BreakdownPage.tsx:282-309` |
| **原缺陷** | 后端 `buildBreakdownPrompt` 只把 `level === 'parts'` 单独分支（`breakdown.js:162`），**`standard` 与 `full` 走完全相同的代码**（L194 注释："1.0.2 起 standard 与 full 合并同一套内容"），`full` 的 `desc` 也诚实写着"与 standard 同内容…保留此档位仅为兼容旧调用"（L62）。**但前端把两者渲染成两个可选项**并给选中的显示绿色 `<Badge tone="ok">选中</Badge>` —— 用户点「完整设定卡」后 UI 高亮切换、toast 成功、请求发出，后端返回**逐字相同**的提示词。实际点两次「预览提示词」（`BreakdownPage.tsx:79-90` 对应后端 `/breakdown/preview`，`api/index.js:873-881`）会看到**同样的文本和同样的 `chars`**，矛盾在 UI 上可见却无任何说明。 |
| **当前实现（已修）** | `BreakdownPage.tsx:291`：<br>```ts<br>{levels.filter((l) => l.id !== 'full').map((l) => (<br>```<br>并加了 L282-289 的注释说明为什么过滤、以及"档位定义本身保留在后端（有回归断言盯着 desc 文案）"。**正确处理了"后端保留 + 前端不呈现"这个边界**，没有动 `BREAKDOWN_LEVELS`（避免让 `tests/verify-all.mjs` 的 R21 断言失败）。 |
| **残留** | 无。 |

---

### A-09 · ~~P3~~ → **已修复（审计期间被并发修掉）** · 模板 / 服化道 / 日志 JSON 是"读-改-写"非原子，且解析失败静默清空

> **状态**：本条在审计进行中**已被并发提交修复**（`extras.js` 391→441 行，`readJson`/`writeJson` 整体重写）。**lead 无需再动手。**

| 项 | 内容 |
|---|---|
| **原 file:line** | `host/services/extras.js:83-92`（旧 `readJson` / `writeJson`） |
| **修复后位置** | `host/services/extras.js:83-142` |
| **原缺陷** | ① `readJson` 的 `catch { return fallback; }` 是**静默数据丢失**：`prompt-templates.json` 一旦损坏（断电/杀进程/磁盘满），返回 `[]`，紧接着 `upsertTemplate` 把**只含新条目的数组**写回 —— 用户自定义模板**全部消失且无提示**。这与 `host/store/json-store.js:22-33` 的处理**完全相反**（那个模块专门修过同一问题，注释在 L4）。<br>② `writeJson` 用 pid+时间戳命名 tmp 并 `renameSync`，**没有 Windows 重试** —— 而 `json-store.js:41-57` 有专门的 `EPERM/EBUSY/EACCES` 重试（注释："Windows 上 rename 覆盖已存在文件可能因杀软扫描/句柄占用抛 EPERM/EBUSY"）。本仓主要面向 Windows，`extras` 的写入在杀软扫描时会**直接抛异常**给用户。 |
| **当前实现（已修）** | `readJson`（L97-111）：区分"文件不存在"（返回 fallback，正常）与"解析失败"（**备份 `.corrupt` 并抛 `CORRUPT_JSON`**，绝不写回空数组）。`writeJson`（L120-142）：加了 `RETRY = [0,10,30,80,150]` 的重试与 `EPERM/EBUSY/EACCES` 判定，失败时清理 tmp 并抛错。**与 `json-store.js` 的语义完全对齐。** |
| **残留** | 调用点（`listTemplates` / `upsertTemplate` / `listWardrobe` 等）现在会**收到 `CORRUPT_JSON` 异常**。需确认这些路径上有 UI 层 catch 并向用户显示原因（`ToolboxPage.tsx` 的 `load()` 在 L48-65 有 `catch` + `toast.error`，符合预期）。 |

---

### A-10 · P3 · 孤儿清理把"引用计数"和"受保护目录"混在同一个变量里

| 项 | 内容 |
|---|---|
| **file:line** | `host/services/extras.js:277-299`（`findOrphans` 的计数循环，特别是 **L283** 与 **L285-288**）<br>`app-src/src/pages/ToolboxPage.tsx:264-267`（展示 `referenced`） |
| **现在做什么** | ```js<br>const PROTECTED_DIRS = new Set(['3d', 'models']);   // L277<br>let referencedCount = 0;                          // L279<br>for (const full of files) {<br>  const relFromAssets = path.relative(assetsDir, full);<br>  const top = relFromAssets.split(path.sep)[0];<br>  if (PROTECTED_DIRS.has(top)) { referencedCount += 1; continue; }   // L283<br>  const norm = relFromAssets.replace(/\\\\/g, '/');<br>  if (referenced.has(norm) \|\| referenced.has(relFromAssets)) {<br>    referencedCount += 1; continue;                                  // L285-288<br>  }<br>``` |
| **为什么是错的** | `referenced` 徽标（`ToolboxPage.tsx:265`，文案「**{orphans.referenced} 个被引用**」）把两件不同的事混成了一个数字：<br>① L283 把 `assets/3d/` 与 `assets/models/` 下的**全部文件**（无论是否被 assets-index 引用）都计进了 `referencedCount`，理由是"Blender 直接扫盘的目录，一律不参与孤儿判定"（L247-248 注释）。这个**安全策略本身是对的**（避免误删 3D 资产）—— 但**把它算作"被引用"是在撒谎**：用户在面板上看到「120 个被引用」，其中可能 118 个是 `assets/3d/` 里根本没登记的模型文件。<br>② 数字对不上：`total` 是 `files.length`（L294），而 `fs.statSync` 失败的条目在 L290 `continue` 掉，既不计 `referencedCount` 也不进 `orphans` —— 所以 `ToolboxPage.tsx:264-267` 并排显示的 `total / referenced / orphanCount` **三者相加不等**，用户无从校验。 |
| **最小修法** | 拆成两个计数：<br>```js<br>let protectedCount = 0;                                              // 新增<br>if (PROTECTED_DIRS.has(top)) { protectedCount += 1; continue; }      // L283<br>...<br>return { total: files.length, referenced: referencedCount,<br>         protected: protectedCount,                                   // 新增<br>         orphanCount: orphans.length, orphanBytes: ..., orphans };   // L293-298<br>```<br>`ToolboxPage.tsx:265` 旁边加 `<Badge>{orphans.protected} 个受保护（3D）</Badge>`，`Orphans` 接口（L16-19）补 `protected?: number`。这样「referenced + protected + orphan = total」才对得上，用户也能理解为什么 3D 文件永远不会被清理。 |

---

### A-11 · P3 · `logs` 域：ToolboxPanel 与 Settings 各有一个日志面板，一个空一个满

| 项 | 内容 |
|---|---|
| **file:line** | `app-src/src/pages/ToolboxPage.tsx:289-303`（真实日志列表）<br>`app-src/src/pages/SettingsPage.tsx:410-427`（`section === 'logs'`，只有两行 `KeyValue` + 一句"实时日志在任务中心与预演页可查"）<br>`app-src/src/pages/SettingsPage.tsx:112`（tab `{ value: 'logs', label: '运行日志' }`） |
| **现在做什么** | 设置页有独立的「运行日志」tab（L112），点进去是一个**几乎空的面板**：一句 `Alert` 说"实时日志在任务中心与预演页可查"，然后 `KeyValue` **只有两项**（H3 后端 / 预演引擎的在线状态，L419-420），后面还留着两行注释掉的空槽（L421-422 是空的 `,` 行）。<br>真正的日志在**设置 → 工具 → ToolboxPanel → 运行日志**（`ToolboxPage.tsx:289-303`），那里调 `api.toolboxLogs()` 并渲染完整列表。 |
| **为什么是错的** | 同一个「运行日志」概念在一个页面里有两个入口，其中**显眼那个（顶级 tab）是空的**。用户点它看不到日志，会认为日志功能坏了。而且 `SettingsPage.tsx:415` 的文案说"在任务中心与预演页可查" —— 这句是**错的**：`JobsPage` 与 `PrevizPage` 都不读 `extras.logs.json`（`/logs` 的唯一前端消费者是 `ToolboxPage.tsx:53` 的 `api.toolboxLogs()`）。 |
| **最小修法** | 删掉 `SettingsPage.tsx:410-427` 的假日志段，把 tab 名改成「系统状态」并只保留那两项 `KeyValue`；或者直接把 `section === 'logs'` 指向 `<ToolboxPanel />` 并预设 `domain='logs'`（需要给 `ToolboxPanel` 加一个 `initialDomain` prop，`ToolboxPage.tsx:25-27` 的 `useState<Domain>('templates')` 改成 `useState<Domain>(initialDomain ?? 'templates')`）。**优先选后者**，一举消掉重复入口。 |

---

## 三、路由双向对照表

### 3.1 方向一：前端 `api.*` → 后端路由是否存在

`client.ts` 共 **101 个 api 方法**。脚本初筛出的 3 条「MISSING」经逐条人工核对**全部是归一化误报**（模板字符串里的 `${...}` 被我的脚本截断），真实承接处如下：

| 前端方法 | client.ts 行 | 声明路径 | 后端承接 | 判定 | 被哪些页面调用 |
|---|---|---|---|---|---|
| `breakdownMeta` | 433 | `GET /breakdown/meta` | `api/index.js:867` | ✅ 存在 | BreakdownPage |
| `breakdownPreview` | 434 | `POST /breakdown/preview` | `api/index.js:873` | ✅ 存在 | BreakdownPage |
| `breakdownGenerate` | 435 | `POST /breakdown/generate` | `api/index.js:882` | ✅ 存在 | BreakdownPage |
| `vaultMeta` | 438 | `GET /vault/meta` | `api/index.js:671` | ✅ 存在 | VaultPage, ProjectsPage |
| `vaultCards` | 439-440 | ``GET `/vault/cards${q?…}` `` | `api/index.js:674` | ✅ 存在（初筛误报） | VaultPage, ProjectsPage, RenderPage |
| `vaultCard` | 441 | `/vault/cards/:id` | `api/index.js:688` 正则 | ✅ 存在 | **零调用** ⚠️ |
| `vaultUpsert` | 442 | `POST /vault/cards` | `api/index.js:678` | ✅ 存在 | VaultPage |
| `vaultDelete` | 443 | `POST /vault/cards/delete` | `api/index.js:682` | ✅ 存在 | VaultPage |
| `vaultPlan` | 444-451 | ``GET `/vault/plan?${qs}` `` | `api/index.js:702` | ✅ 存在 | **零调用** ⚠️（见 A-07） |
| `projectCards` | 454-455 | `/projects/:id/cards` | `api/index.js:718` 正则 GET | ✅ 存在 | ProjectsPage, RenderPage |
| `saveProjectCards` | 456-457 | `/projects/:id/cards` | `api/index.js:718` 正则 POST | ✅ 存在 | ProjectsPage |
| `renderPlan` | 460-461 | `POST /render/plan` | `api/index.js:781` | ✅ 存在 | RenderPage |
| `renderCompile` | 462-463 | `POST /render/compile` | `api/index.js:806` | ✅ 存在 | RenderPage |
| `toolboxTemplates` | 400 | `GET /templates` | `api/index.js:1011` | ✅ 存在 | ToolboxPage, RenderPage |
| `toolboxTemplateUpsert` | 401-402 | `POST /templates/upsert` | `api/index.js:1014` | ✅ 存在 | ToolboxPage |
| `toolboxTemplateDelete` | 403 | `POST /templates/delete` | `api/index.js:1018` | ✅ 存在 | ToolboxPage |
| `toolboxWardrobe` | 405-406 | ``GET `/wardrobe${kind?…}` `` | `api/index.js:1024` | ✅ 存在（初筛误报） | ToolboxPage |
| `toolboxWardrobeUpsert` | 407-408 | `POST /wardrobe/upsert` | `api/index.js:1027` | ✅ 存在 | ToolboxPage |
| `toolboxWardrobeDelete` | 409 | `POST /wardrobe/delete` | `api/index.js:1031` | ✅ 存在 | ToolboxPage |
| `toolboxImportScan` | 411 | `POST /import/scan` | `api/index.js:1037` | ✅ 存在 | ToolboxPage |
| `toolboxImportPreview` | 412-413 | `POST /import/preview` | `api/index.js:1041` | ✅ 存在 | ToolboxPage |
| `toolboxOrphans` | 415 | `GET /resources/orphans` | `api/index.js:1047` | ✅ 存在 | ToolboxPage |
| `toolboxOrphansClean` | 416-417 | `POST /resources/clean` | `api/index.js:1095` | ✅ 存在 | ToolboxPage |
| `toolboxMotionShots` | 419-420 | ``GET `/motionshots${projectId?…}` `` | `api/index.js:1102` | ✅ 存在（初筛误报） | **零调用** ⚠️ |
| `toolboxMotionUpsert` | 421-422 | `POST /motionshots/upsert` | `api/index.js:1105` | ✅ 存在 | **零调用** ⚠️ |
| `toolboxMotionDelete` | 423 | `POST /motionshots/delete` | `api/index.js:1109` | ✅ 存在 | **零调用** ⚠️ |
| `toolboxLogs` | 425 | ``GET `/logs?limit=` `` | `api/index.js:1115` | ✅ 存在 | ToolboxPage |
| `toolboxBatchProgress` | 426 | `GET /jobs/batch-progress` | `api/index.js:1124` | ✅ 存在 | ToolboxPage |

**结论：本组范围内没有"前端调了但后端没实现"的死路由。** 0 条真·MISSING。

### 3.2 方向二：后端路由 → 前端是否有调用

在 `app-src/src` **全量语料**（非仅 `client.ts`）中搜索该路径字符串：

| 后端路由 | 位置 | 调用情况 | 判定 |
|---|---|---|---|
| `POST /assets/archive` | `api/index.js:743` | 仅 `tests/test-security.mjs:91,104` 调用 | ⚠️ **无前端消费者**（服务端内部走 `archiveBatchOutput:1536` / `runAndArchive:1530` 函数，不经 HTTP） |
| `GET /resources/previz` | `api/index.js:1058` | 零引用 | ⚠️ **死路由**：3D 预演产物占用查看**无 UI 入口**（ToolboxPage 的 resources 域只用了 `/resources/orphans`） |
| `POST /resources/previz/clean` | `api/index.js:1087` | 零引用 | ⚠️ **死路由**：手动清理入口无前端 |
| `GET /workflows/diagnostics` | `api/index.js:260` | 仅 `tests/postinstall-check.mjs:96` | ⚠️ 首装排障用，**无前端**（可接受，但要知道它在） |
| `POST /vault/cards/:id/from-sheet` | **不存在** | — | ❌ **设计文档承诺但未实现**（`docs/角色卡仓库-设计.md:142`，见 A-04） |
| `POST /post/scale|crop|split|annotate|extractFrame|extractAudio` | `api/index.js:1456-1480` | `postOp` 零调用 | ⚠️ 六条死路由（与 B 组结论一致，不重复计缺陷） |
| `POST /mw/figure/delete` | `api/index.js:1273` | 零引用 | ⚠️ 与 B-10 重复，不重复计 |

**本组范围内（`/breakdown` `/vault` `/projects/:id/cards` `/templates` `/wardrobe` `/resources`）的真·死路由 = 2 条**：`/resources/previz` 与 `/resources/previz/clean`。另加 1 条**该有但没有**的 `/vault/cards/:id/from-sheet`。

---

## 四、需要修改的文件清单（blast radius）

> **A-01 / A-02 / A-03 / A-04 / A-06 / A-08 / A-09 已在审计期间被并发修掉**，不计入工作量。

### 4.1 必改（剩余真正需要动手的）

| 文件 | 涉及缺陷 | 改动性质 | 预估行数 |
|---|---|---|---|
| `app-src/src/pages/ToolboxPage.tsx` | **A-05(a)** 降级：tab label（`{ value: 'wardrobe', label: \`服化道（${wardrobe.length}）\` }`）标注"仅素材登记"；或 **(b)** 真做换衣 | (a) 1 行；(b) ~40 行（接进 `manualImages`，后端零改动） | 1 ~ 40 |
| `host/services/extras.js` | **A-05(a)** 降级：L6 模块头注释「`wardrobe`（68 键）服化道素材库」需注明"仅登记，不参与生成" | 改 1 行注释 | 1 |

### 4.2 建议改（清理与一致性，可选）

| 文件 | 涉及 | 说明 |
|---|---|---|
| `app-src/src/api/client.ts` + `host/api/index.js` | **A-07** | 二选一：删 `vaultPlan`（client.ts:444-451）+ `/vault/plan` 路由（api/index.js:702-714）；**或**在 `VaultPage` 底部加"预览本卡占用"面板接上它（推荐，一次消掉两套预算口径） |
| `host/services/extras.js` | **A-10** | L346 附近：拆 `protectedCount`，让 `referenced + protected + orphan = total` 对得上 |
| `app-src/src/pages/ToolboxPage.tsx` | **A-10** | L16-19 的 `Orphans` 接口补 `protected?: number`；L265 旁加徽标 |
| `app-src/src/pages/SettingsPage.tsx` | **A-11** | L410-427 的假日志段：要么删，要么改为复用 `ToolboxPanel`（已在 L10 导入、L374 使用） |
| `host/services/character-vault.js` | **A-04 残留** | 删 L336-348 的死导出 `buildSubjectDefinitions`（或接回 `injectCardDefinitions`） |
| `docs/角色卡仓库-设计.md` | **A-04 / A-07** | L142 的 `from-sheet` 承诺与实现不符（实际走 `POST /vault/cards`）；L147 的 `/vault/plan` 需与实现对齐 |

### 4.3 新增测试（防止回归）—— **这是本轮最有价值的一节**

> 7 条修复里，**只有 A-02 与 A-04 有间接覆盖**（`imageCount` 有现成断言、建卡走已测试的 `vaultUpsert`）。
> 其余修复**全部零测试**，而它们保护的恰恰是最难排查的两类故障：**角色串脸**与**预算静默超限**。

| 优先级 | 目标 | 建议位置 | 断言 |
|---|---|---|---|
| **最高** | **A-06（已修但零测试）** | `tests/verify-all.mjs`，R22 附近 | 构造 1 张有图卡 + 1 张无图卡，断言 `subjectsForPrompt(plan)[1].pictureIndex === null` 且 `hasImage === false`。`render-plan.js:511-521` 保护的是"角色串脸"，目前**完全无覆盖**。 |
| **最高** | **A-01（已修但后端分支零测试）** | `tests/verify-all.mjs`，R23 旁边 | `buildRenderPlan({ cards:[…8 张], previz:{ firstRel:'x' } }).stats.total === 9`，且第 10 张触发 `warnings` 裁剪。前端传参已修，但 `render-plan.js:197-199` + L211-212 的预算分支本身无断言。 |
| 中 | **A-09（已修）** | `tests/test-security.mjs` 或新建 | 写入损坏的 `prompt-templates.json`（`{{{`），断言 `upsertTemplate` **抛 `CORRUPT_JSON`** 且生成 `.corrupt` 副本，而不是静默清空 |
| 低 | **A-02 / A-03 / A-04 / A-08（已修）** | 无需新增 | 改动是"改用后端真值""按 rel 判定""加按钮""过滤一个选项"，回归风险低 |

### 4.4 不需要改的（明确确认健康的部分）

为避免 lead 误判，以下**经实际读取确认是正确的**，不要动：

1. **`character-vault.js:100-156` 的 `cardImagesFor`** —— `both` 模式的 `max` 兜底（L109-111）与 `heads`/`extras` 补位（L141-154）逻辑正确，且有 `test-security.mjs:166-179` + `verify-all.mjs:724-729` **两道回归**盯着。A-02 的问题是**页面另写了一份**，不是这个函数的错。
2. **`character-vault.js:174-186` 的 `createdAt` 正序排序** —— 注释（L174-182）把"为什么不能用 updatedAt"讲得很清楚（编辑会打乱 `<Picture N>`），且 `verify-all.mjs:1359-1399` 的 R22 有完整断言（改卡后顺序不变、编号不漂）。**这是全仓质量最高的修复之一。**
3. **`shot-context.js:188-217` 的 `resolvePictureIndices`** —— 从 `resolveRefImages` 的**真实输出**反推编号（L194-201），而不是"第几张卡"，思路与实现都对。它唯一的瑕疵是 L194 把 `characterRefs/sceneRefs/itemRefs` 清空后调用（`{...shot, characterRefs: [], sceneRefs: [], itemRefs: []}`），但这一步是**故意的**（保证与 plan 的图源一致），且 `/render/compile` 路径本来就用 `subjectsForPrompt(plan)` 而不用它。
4. **`breakdown.js:149-255` 的提示词构建** —— 四条设计原则（不文字复述图片、纯文本、不编号小标题、数量与参数一致）在代码里**逐条落实**了（L155-157 动态 views、L187/243 禁文字、L92-104 的 `DETAIL_LOCK`），`verify-all.mjs:1339-1357` 有对应断言。模块头部的"改之前务必读完"注释也保留着关键的踩坑记录（L44-49 关于"不要 X"不该改写成"避免 X"）。**这个文件是本组质量最高的。**
5. **`render-plan.js:311-354` 的参考视频+音频合计 14.8s 预算** —— 裁剪优先级（先砍音频再砍视频）、裁剪后**重新编号**（L349-352）、时长未知项单独告警（L319-325）都做对了，`verify-all.mjs:1403-1424` 有 R23 断言覆盖。

---

## 五、给 lead 的话

### 5.1 现在只剩 1 件必修 + 1 件可排期

1. **A-05 · 换衣（P1 功能缺口，唯一还没动的 P1）** —— 界面上有「服化道」分区（`ToolboxPage.tsx:190`）和四个类别（服装/饰品/武器/道具），用户会合理认为录进去的衣服做视频时用得上，实际**零消费方**（全仓 grep 确认）。这不是 bug 是"没做"，但**宣称与实现的落差比 bug 更难被用户发现**。
   - 30 秒降级：tab label 加"（仅素材登记）"+ `extras.js:6` 注释补一句。
   - 真做：接进 `manualImages`（`render-plan.js:202` 已能吃任意 rel，**后端零改动**，前端约 40 行）。
2. **A-07 · `/vault/plan` 零调用（P2 可排期）** —— 它比 `/render/plan` 更完整（有 `reserved` 概念、裁剪优先保 sheet），但目前是死路由，导致同一件事有**两套预算算法**。接上它能顺手消除口径分歧。

### 5.2 需要 lead 知道的三件事实

1. **审计期间并发修复干掉了 7 条**（A-01 / A-02 / A-03 / A-04 / A-06 / A-08 / A-09）。我把它们保留在清单里并标注「已修复」，附了修复后的实际代码位置 —— 因为这些缺陷**曾经真实存在**，而且**其中 2 条修复完全没有测试覆盖**（A-01 的首尾帧预算分支、A-06 的编号三态），保护的恰是最难排查的"预算静默超限"与"角色串脸"。
   **教训**：审计期间对同一批文件做并发重构，会让交付物与实现持续脱节（本次是靠交付前逐条复核 124 处引用才对齐的）。
2. **vault 与编号主链路的底子是好的**（4.4 列了 5 处明确健康的实现，其中 `createdAt` 正序排序与 `resolvePictureIndices` 是全仓质量最高的两处）。修的时候**不要重写它们**。
3. **本组范围内没有"前端调了但后端没实现"的死路由**（101 个 api 方法全部有承接）。方向二有 **2 条真·死路由**：`GET /resources/previz`（`api/index.js:1061`）与 `POST /resources/previz/clean`（`:1090`）—— 3D 预演产物占用查看**无任何 UI 入口**，产物堆积只能靠自动保留策略。另加 1 条**该有但没有**的 `/vault/cards/:id/from-sheet`（设计文档 `docs/角色卡仓库-设计.md:142` 承诺；实际已由 A-04 的修复以 `POST /vault/cards` 的方式覆盖，**文档待改**）。
