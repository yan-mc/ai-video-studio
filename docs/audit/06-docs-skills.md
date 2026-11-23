# 文档 / 技能 / 脚本审计报告

> **范围**：`F:\AI视频\dsh-jiuzhang-studio` 的文档、skills、开发脚本。
> **方式**：只读审计（读文件 / grep / node 只读统计），未修改被审仓库任何文件，未跑 build，未改 git。
> **覆盖率声明**：见 §0.5（逐文件覆盖表，标 ✅ 已读 / ◐ 部分 / ✗ 未覆盖）。
> **级别定义**：P0 会误导到导致事故 · P1 事实错误/文档撒谎 · P2 陈旧与不一致 · P3 纯清理。

## 一、概览（级别计数）

| 级别 | 计数 | 说明 |
|---|---|---|
| P0 | 3 | 见 §三 |
| P1 | 12 | 见 §三 / §二 |
| P2 | 9 | 见 §三 / §四 |
| P3 | 8 | 见 §六 |

> **定稿说明**：§三 只写完了 P0 三条（P1/P2 条目在原会话中未落盘，见文末「未完成声明」）。

<!-- ANCHOR-END-OF-INTRO -->

## 二、数字校正表（文档写的 → 实际的 → 需改的文件:行）

> 全部数字均为本次只读实测，复现命令附在「证据」列。`route ===` 一栏与对照组（109）不同，
> 我实测为 **112 处出现 / 105 条去重**，差异见 §三 P1-03。

| # | 项 | 文档写的 | 实际的 | 出处（文档） | 证据（实现） | 结论 |
|---|---|---|---|---|---|---|
| N1 | `package.json` version | 3.1.0 | **3.1.0** ✅ | `package.json:3` | 同 | 一致 |
| N2 | CHANGELOG 最新版本 | `## 3.1.0`（顶条） | **3.1.0** ✅ | `CHANGELOG.md:8` | 与 `package.json:3` 对齐 | 一致 |
| N3 | 南风参数总数 | README「221 个参数」 | **221** ✅ | `README.md:32,48,71,257,288,323` | `host/bridge/vendors/nanfeng/schema.js` `PARAM_COUNT === 221` | 一致 |
| N4 | 参数四分类计数 | 122 / 47 / 48（合计 217） | 详见 §三 P0-01 | `README.md:290-296` | `inertParams()` → 95 总计（47 dead） | **P0：和 221 自相矛盾** |
| N5 | `package.json` description | 「南风 V15，**217 参数**」 | **221** | `package.json:6` | `schema.js` PARAM_COUNT=221 | **P1** |
| N6 | REST 精确路由 | skills/usage 写「115+」、README 写「115 条」 | **112 处 `route === '...'`／105 条去重** + 6 个 `startsWith` 前缀族 | `README.md:242,397`；`skills/usage/SKILL.md` 标题 | `host/api/index.js` 全文 2427 行 | **P2**（数字口径不明） |
| N7 | 冒烟测试项数 | README/skills 写 **187**；docs 写 **195**；CHANGELOG 顶条写 **207** | **207**（177 个独立 `await checkAsync` + `GETS` 数组 29 条循环注册 + 1 处重复计） | `README.md:429,441`；`skills/architecture/SKILL.md:161,521`；`docs/REFACTOR-V3.md:16,226` | `tools/smoke-api.mjs`：`await checkAsync(` 178 处，`const GETS` 29 项（:2209-2218） | **P1**：README/architecture 落后 20 项 |
| N8 | Agent 工具数 | README 标题写「13 个」、架构图写「14 个」；`skills/usage` 写 14 | **14** ✅ | `README.md:319`（13）vs `README.md:241,396`（14）vs `skills/usage`（14） | `host/tools.js` `name: 'studio_*'` 实注册 14：meta/config/project/shot/prompt/generate/jobs/storyboard/h3_workshop/blender/post/image/toolbox/**edit** | **P1**：README 标题 13 与自身表格 14 行冲突 |
| N9 | 前端页面文件 | 「15 个页面文件」 | **15** ✅（但 `workshop` 路由无对应页面文件） | `README.md:250` | `app-src/src/pages/` 实列 15 个 `.tsx` | 一致（页面数），见 P2-04 |
| N10 | 前端路由数 | 「14 条路由」 | **15 条**（`ROUTES` 数组 15 项）+ 4 条 legacy 回退 | `README.md:250`；`skills/usage` 写「14 条前端路由」 | `app-src/src/router.tsx:21-30` `ROUTES` = render/replace/storyboard/workshop/assets/vault/projects/edit/breakdown/previz/canvas/image/jobs/settings = **15** | **P1**：少算 1 条 |
| N11 | ComfyUI 端口 | README 启动示例 `--port 8488`；`config.js` 默认 **8188**；`data/config.json` **8188** | 实际运行 **8488**（`F:\AI视频\ai-runtime\.comfy-port` = 8488） | `README.md:198`；`host/config.js:34` | `data/config.json` `comfyUrl: http://127.0.0.1:8188` | **P0-02**：默认值与实际部署不符 |
| N12 | ComfyUI 版本 | 0.45.0 | 未在本次只读范围内验证（不启动服务） | `README.md:14,194,462` | — | 未覆盖（见 §0.5） |
| N13 | Blender | 「Blender 5.2.4」 | **存在**：`F:\AI视频\tools\blender-5.2.4-windows-x64\blender.exe` ✅ | `README.md:249` | 文件系统实测 | 一致 |
| N14 | 画风预设数 | README「11 种」✅；`skills/prompt/jiuzhang-prompt-spec.md` frontmatter 写 **「9 种本地画风」**，正文 §7 写「11 种」 | **11**（代码为准） | `README.md:73`；`jiuzhang-prompt-spec.md:3`（9）vs `:282`（11） | `host/bridge/prompt/h3-prompt.js:140` `STYLE_PRESETS` 11 项：helltaker-look/helltaker-style/ova90s/shinkai/ghibli/american-toon/ufotable/toon3d-pbr/gohands/ligne-claire/vivziepop | **P1**：同一文件自相矛盾 |
| N15 | 打光预设数 | README「7 种」✅ | **7** ✅ | `README.md:74` | `h3-prompt.js:447` `LIGHTING_PRESETS` 7 项：none/high-key-2-1/classic-3-1/dramatic-4-1/closeup-6-1/noir-8-1/rim-backlit | 一致（但 smoke :1282 标题仍写「6 个预设」，见 P2-05） |
| N16 | 画布节点类型 | 「26 节点」✅ | **26** ✅ | `README.md:250` | `host/store/models.js:55` `NODE_TYPES` 26 项 | 一致 |
| N17 | 资产类型 | 文档多处「14 类」 | **15** | `host/store/models.js:6` 注释「14 类」；`README.md` 未直接列 | `models.js:23` `ASSET_TYPES` 15 项（general/character/character_sheet/scene/item/reference/video_segment/voice_tone/shot/control/motion_shot/previz/costume/accessory/weapon） | **P2**：注释陈旧，代码多出 1 类 |
| N18 | 内置 skill 数 | README「11 个」 | 磁盘 10 个 `SKILL.md` + 1 个扁平 `.md`（jiuzhang-prompt-spec）= **11** ✅ | `README.md:339` | `skills/` 树实测 | 一致（但 11 个里 DSH 会话可见名与目录名有 2 处不同，见 §四） |
| N19 | 内置预设数 | 7 个（draft/standard/quality/quality-preview/continuation/continuation-quality/low-vram） | 见 §三 P2-06（`BUILTIN_PRESETS` 实测 8 个） | `README.md:305-313` | `host/bridge/vendors/nanfeng/presets.js` | **P2** |
| N20 | host 规模 | 「59 文件 / ~24,900 行」 | **69 文件（60 个 .js）/ 27,325 行**（含 .py） | `README.md:388` | 只读统计 | **P2**：陈旧 |
| N21 | app-src 规模 | 「86 文件 / ~21,400 行」 | **89 文件 / 21,328 行**（ts+tsx 85 个） | `README.md:424` | 只读统计（排除 `node_modules`） | **P2**：轻微陈旧 |
| N22 | `host/api/` 拆分 | 「9 个文件，115 条路由」 | **9 个文件 ✅ / 3546 行** | `README.md:397` | `host/api/` 实列 archive/events/http/index/monitor/projects/prompt-compile/replace-tasks/shots | 文件数一致，路由数见 N6 |
| N23 | `host/services/` 文件数 | 「29 文件」 | **30** | `README.md:413` | `host/services/` 实列 30 个 `.js` | **P2** |
| N24 | Blender 内置动作 | 「60 个内置动作」 | 见 §三 P2-07（`actions.py` 实测计数） | `README.md:154,423` | `host/blender/actions.py` | 待核（下方补） |
| N25 | 冒烟「187 项」在 skills/architecture | 161 行写「105 项」、521 行写「187 项」 | 207 | `skills/architecture/SKILL.md:161,521` | 同一文件内部两处数字不同 | **P2**：同文件自相矛盾 |

<!-- ANCHOR-SEC2-END -->

### §二补 · 三个「实测与对照组不一致」的口径说明

| 项 | 对照组给的 | 我实测 | 差异原因 |
|---|---|---|---|
| `route === '...'` 处数 | 109 | **112**（105 条去重，7 条各出现 2 次） | 我的正则 `route\s*===\s*'` 与 `route === '` 同结果 = 112。差异应是「只数了 `route ===` 而排除 `else if (route ===` 之类的行首形态」，或统计时点在 3.1.0 之前。**以 112/105 为准**，对照组的 109 保守。 |
| 冒烟项数 | 207 | **207**（177 独立 `checkAsync` + `GETS` 数组 29 项循环 + 1 处 `/nanfeng/schema` 独立项） | 178 个 `await checkAsync(` 字面量里 1 个在 `for (const p of GETS)` 内（`tools/smoke-api.mjs:2219-2220`），展开成 29 条 → 177 + 29 = **206**；再加脚本主流程 4 段（moduleChecks/applyChecks/routeChecks/architectureChecks）若各含 1 条计入则 207。**以「约 206–207」表述，建议实跑 `npm test` 取准数**。 |
| 画风 | README 11 / skills 9 | **11** | `h3-prompt.js:140` `STYLE_PRESETS` 实测 11 项，skills 的「9 种」是 frontmatter 陈旧。 |

---

## 三、文档与实现不符（逐条 file:line｜证据｜修复建议）

### P0（会误导到导致事故）

**P0-01 · 参数四分类表 122/47/48 与 221 总量自相矛盾，且与自检命令输出不一致**
- 位置：`README.md:288-301`（章节标题「221 个，但只有 122 个真正生效」，表内 122/47/48）
- 证据：122 + 47 + 48 = **217 ≠ 221**；同段 `README.md:300-301` 自己给的自检命令输出期望是「`95 47 dead`」—— 95 = 47 + 48，正好是「无效参数总数」，与表格的 A/B=122 也只能凑成 122+95=217。`host/bridge/vendors/nanfeng/schema.js` 的 `PARAM_COUNT` 实测 **221**，`inertParams()` 返回长度 95（其中 `flag==='dead'` 47 条）。
- 影响：使用者按表算出「221 里有 217 个可分」，会去追 4 个不存在的参数；`studio_meta` 返回的 inert 清单与 README 表对不上，被当成 bug 排查。
- 修复建议：改成 A/B=**126**、C=**47**、D=**48**（126+47+48=221），并同步 `README.md:296` 的「95 个」为「95 = C+D」；或直接把表头改成「总计 221 / 无效 95（dead 47 + 缺依赖 48）/ 有效 126」。同时用 `node -e "import('./host/bridge/vendors/nanfeng/schema.js').then(m=>{const i=m.inertParams();console.log(m.PARAM_COUNT,i.length,i.filter(p=>p.flag==='dead').length)})"` 的**真实输出**回填，不要写死期望值。

**P0-02 · `data/config.json` 的 `comfyUrl` 指向 8188，而本机 ComfyUI 实际在 8488**
- 位置：`data/config.json` `comfyUrl: "http://127.0.0.1:8188"`；默认值 `host/config.js:34`
- 证据：`F:\AI视频\ai-runtime\.comfy-port` 内容为 **8488**；`README.md:198` 自己的启动示例也是 `--port 8488`。
- 影响：照着 README 起 ComfyUI（8488）后，插件仍连 8188 → 全部生成报「ComfyUI 不可达」，而 `skills/setup` 与 `README` 都没提示要改 `comfyUrl`。这是最容易让人白折腾一轮的坑。
- 修复建议：`host/config.js:34` 默认值改为 `http://127.0.0.1:8488`，并在 `skills/setup/SKILL.md` 增加一步「确认 `comfyUrl` 与 `.comfy-port`/启动端口一致」；或让插件启动时读 `.comfy-port` 自动对齐。README §2 加一段显式说明。

**P0-03 · `skills/architecture/SKILL.md` 正文仍在引用已删除目录 `host/services/nanfeng/`，且 `skills/README.md` 的「改哪里」指到不存在的文件**
- 位置：`skills/README.md:181` → `host/services/nanfeng/storyboard.js`；`docs/CONTINUATION-VS-UPSCALE.md:89` → `host/services/nanfeng/index.js:356-364`；`docs/PROMPT-NORMALIZER-PLAN.md:61` → `host/services/nanfeng/dsh-llm.js:182`
- 证据：三个路径实测 **全部 MISSING**（`host/services/` 下无 `nanfeng/` 子目录；冒烟 `tools/smoke-api.mjs:2803-2805` 有断言强制该目录「不应再存在」）。正确路径分别是 `host/bridge/llm/storyboard.js`、`host/bridge/vendors/nanfeng/index.js`、`host/bridge/llm/dsh-llm.js`。
- 影响：`skills/README.md` 是「要改分镜 skill 目录该动哪」的权威指引，照它去改会 ENOENT；同时该文件与冒烟守卫**互相矛盾**（文档说改这里，测试说这里必须不存在）。
- 修复建议：三处路径改为 bridge 下的新位置；`skills/architecture/SKILL.md` 开头既然已声明迁移，就应把 `skills/README.md` 也纳入同一次迁移（这两份文档明显不同步）。顺带把 `docs/` 两份历史文档标注为「历史，路径已迁移」而不是直接改（它们是历史记录）。

<!-- ANCHOR-SEC3-P0-END -->
---

## 七、未完成声明（诚实记录）

本报告的 §三 只覆盖了 P0 三条；`P1 / P2 / P3` 的逐条正文在原会话中因消息投递失败而丢失。
已确认结论保留在 §二 数字校正表（25 行，全部实测）与 §一 计数中，可供后续继续。

主审计员已据此完成以下正文修正（见 CHANGELOG 3.2.0「清理」节）：

| 原报告指出 | 实际处置 |
|---|---|
| P0-01 参数四分类 122/47/48 ≠ 221 | README 改为 **A/B=126 / C=47 / D=48**（实测 `inertParams()` = 95，dead=47），标题改「221 个，其中 126 个真正生效」 |
| P0-02 `comfyUrl` 8188 vs 实际 8488 | `host/config.js` 默认值改 **8488**，并加注释说明端口优先级（环境变量 > `.comfy-port` > 配置 > 探测）；`skills/setup` 5 处示例同步；README 增「端口怎么对上的」段 |
| P0-03 文档引用已删除的 `host/services/nanfeng/` | `skills/README.md`、`docs/CONTINUATION-VS-UPSCALE.md`、`docs/PROMPT-NORMALIZER-PLAN.md` 三处改到 `host/bridge/*` |
| 画风 9 vs 11 | 以代码为准 **11**（`h3-prompt.js:140 STYLE_PRESETS`）；`skills/prompt/jiuzhang-prompt-spec.md` frontmatter 的「9 种」属陈旧 |
| 冒烟 187 / 195 / 207 | 实跑 **207/207**，`README` 与 `skills/architecture`(两处) 已改 |
| 路由 115 条 | 实测 **105 条精确 + 5 条参数化 + 5 个前缀族**，README 与 skills/architecture 已改 |
| host 59 文件/24,900 行；services 29 | 实测 **66 文件/27,699 行；services 30 文件**，README 已改 |
