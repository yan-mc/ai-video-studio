# 复用与 REA 深挖计划

> 注：本文件为历史归档，其中的软件名已中性化处理。

> 配套《方案总览.md》。原则：**能复用就不重写**；预演软件拆解产物大面积复用；节点动画软件/视频增强软件直接复用数据/schema；不确定处用 **REA** 继续拆解，不猜。
> 所有复用物登记 `vendor/PROVENANCE.md`（来源/版本/许可/修改/使用模块）。

## 1. 复用总原则

1. **优先源代码级复用**：预演软件 recovered JS（可读、可改、可测）→ port 进自研 Node 服务；比跑闭源 exe 更可控。
2. **二进制只做对照/过渡**：`预演引擎可执行文件`、`voice-sidecar.exe` 可先跑通协议，再逐步替换为 port 版本。
3. **Schema/数据直接复用**：节点动画软件/视频增强软件的 JSON 作为数据包；**运行时自研**，不链接其原生库。
4. **资产全部外置**：拆解资产打成可挂载包；内部资产 `forbidden` 仅本地。
5. **不确定就 REA**：任何"猜"的字段/算法/协议，先 REA 取证据，再写代码。

## 2. 预演软件产物复用清单（可直接用）

| 产物 | 路径 | 规模 | 复用方式 | 阶段 |
|---|---|---|---|---|
| **director 引擎** | `功能拆解\预演软件\03_反编译与代码\预演引擎进程_Bun\artifacts\recovered\app_director_engine_module.js` | 75,266 B | **port**：数据模型/求值器/动作/运镜/校验/Agent 逻辑 | P1 |
| **服务/store** | 同目录 `app_server_entry_module.js` | 21,592 B | **port**：store（project.json/history.json 原子写）、15 工具执行器、HTTP 路由 | P1 |
| **three.js** | 同目录 `vendor_three_r184_module.js` | 836,204 B | 直接 import（r184）；预演渲染 | P1 |
| MCP SDK/zod/ajv | 同目录 `vendor_mcp_sdk_and_ajv_zod.js` | 825,312 B | 用其 MCP 注册/输入校验逻辑；也可换新版 SDK | P1 |
| 原始 bundle | 同目录 `bundle_pretty_utf8.js`（1.70MB） | — | 对照/补充检索 | 按需 |
| 15 工具 schema | `artifacts\data\tool_catalog.json` | — | 工具定义/参数/描述直接映射 | P1 |
| 工程模型 | `artifacts\data_model.md` | — | Project/Plan/Shot/Element/Action/KF 字段与语义 | P1 |
| HTTP 契约 | `artifacts\http_api.md` | — | `/api/health|project|command|agent/chat` | P1 |
| 校验规则 | `artifacts\validation_rules.md` | — | 16+6 规则中文文案 | P1 |
| catalog | `artifacts\data\`（动作 58/运镜 28/人物 7/道具 10/表演 8） | — | 直接作为预演模板数据 | P1 |
| 主 UI | `02_报告\03_主UI_节点画布工作台.md` | — | 交互参考（镜头状态机/尾帧继承/分镜板） | P1—P3 |
| 3D 资产 | `04_解包资产\embedded-assets`（2198/224.84MiB）、`05_可重建资产库`（469/25.51MiB） | — | 打包挂载（CC0 可分发；guo 仅本地） | P1 打包 |
| 资产清单 | `05_可重建资产库\assets-library\manifest.json`（2198 条/sha256） | 2.0MB | `AssetRegistry` 直接读取 | P1 |
| 配音台 | `02_报告\08_voice-sidecar_预演配音台.md` | — | P3 接口设计；本期 H3 原生音频 | P3 |

### 2.1 Port 目标结构（自研预演服务）

```
services/previz/src/
├─ store/           # project.json/history.json 原子写、50 步撤销
├─ engine/          # 数据模型、求值器、动作/运镜、校验
├─ catalog/         # 58 动作/28 运镜/7 人物/10 道具/8 表演
├─ tools/           # 15 个 director_* 工具（HTTP + MCP 双形态）
├─ render/          # three.js 场景构建/截图/录制（参考 预演前端）
└─ server/          # HTTP 路由 + 静态托管（可选）
```

- 保留 env：`PREVIZ_HOME` 改为 `PREVIZ_HOME`（避免混淆）；数据格式保持 v1 兼容。
- 资产引用改为 `AssetResolver.resolve('previs-3d-core:guo.prop.sword-1')`，不写死相对路径。
- 渲染截图/录制：优先移植 `预演前端` 的 front-end 渲染；若成本高，P1 先只做"数据/校验/导出 JSON"，渲染用外部 DirectorDesk/预演软件 UI。
- 测试：与预演软件 `预演引擎可执行文件 --http` 对照同一输入的状态/校验输出（golden tests）。

## 3. 节点动画软件 / 视频增强软件直接复用

| 来源 | 文件 | 用法 | 边界 |
|---|---|---|---|
| 节点动画软件 | `04_资产\node-catalog.json`（1210161B/491 节点）、`script-api-reference.json`（307886B/408 API）、`docs-index.json`、`js-api-usage.json`、`mcp-hints-summary.md`、`shaders-index.json` | 打成 `node-schema-ref`；动效页按 schema 自动生成参数面板；MCP 工具模式参考 | 只参考字段/枚举/交互；**原文不随插件分发** |
| 视频增强软件 | `04_资产\model-catalog.json`（1373219B/89 模型）、`presets-catalog.json`（56008B/14 预设）、`configs.json`、`neuroserver.json`、`ai-runtime\*`（20 文件/1.81MB） | 打成 `enhance-schema-ref`；后处理页模型选择器/预设/tiling 估算/编码器矩阵 | 只参考 schema；权重 `.tz`/RLM 禁止 |

- 运行时：超分/补帧用 SeedVR2/Real-ESRGAN/RIFE；动效用 Remotion/Blender/FFmpeg。
- 数据包 manifest 标 `license.distribution=restricted` + `note`。

## 4. REA 深挖计划（不确定项）

> REA 工具（Ghidra 等）在本会话可用；下面每一项先 REA 取证据，再决定实现。

| # | 问题 | 目标文件/进程 | REA 动作 | 产出 |
|---|---|---|---|---|
| R1 | 预演软件 `预演引擎进程` 的导出/截图/录制在无 Tauri 时如何降级 | `预演引擎可执行文件` + `预演前端` | 反编译/字符串/动态探测 | 导出降级路径与可替代方案 |
| R2 | 预演软件 3D 子应用（预演工作台/fuka/previz）的渲染/导出接口 | `embedded-assets` 内 JS | JS 分析/动态 CDP | 可复用渲染代码清单 |
| R3 | 预演软件 200 pma 场景与 guo 资产的运行期加载路径 | `embedded-assets` + 反编译产物 | 静态分析 | 资产加载契约/转换器需求 |
| R4 | 预演软件主程序 `generate_*`/ComfyUI 镜像请求构造 | `预演软件.exe` | Ghidra 定向反编译 | 与 ComfyUI 的请求字段（供适配器参考） |
| R5 | 视频增强软件 tiling 选择算法/后端优先级/preflight 语义 | 视频增强软件载荷 DLL + QML | Ghidra/JS 分析 | 显存估算与 tile 选择规则 |
| R6 | 视频增强软件编码器 55 条实际参数与 FFmpeg 映射 | 视频增强软件 `video-encoders.json` + DLL | 提取/对照 | 编码器预设表（重写数值） |
| R7 | 节点动画软件 Chart 节点求值/绘制与 MCP 完整 schema | `Core.dll`/`ExtensionLayer.dll` + assets | Ghidra/JSON | 信息图节点最小实现参考 |
| R8 | 节点动画软件 `.cv` 工程 schema（若要导入用户工程） | `Core.dll` + `.cv` 样本 | 反编译/样本解析 | 导入器可行性 |
| R9 | Seedance API 完整字段（首尾帧/全模态/取消/查询） | 火山方舟文档 + 抓包（测试阶段） | web/抓包 | 适配器字段表 |
| R10 | H3 官方 API 2K/Regenerate 字段与限制 | MiniMax 文档 + 账号测试 | web | 2K 兜底适配器 |

> REA 执行时遵守：只分析本机文件/自有账号；不破解授权/DRM；结果写入 `docs/probes/REA-*.md`。

## 5. Vendor 与来源台账

- `vendor/<source>/` 放复用代码/数据，保留 LICENSE/NOTICE/来源说明/commit 或拆解版本。
- `vendor/PROVENANCE.md` 每条：来源、版本/哈希、许可、文件、修改、使用模块、日期。
- 内部/闭源拆解物：`distribution: forbidden`，仅本地；不进入任何公开分发包。
- 每次 REA 深挖记录到 `docs/probes/` 并回填 PROVENANCE。

## 6. 执行顺序

1. **P0**：搭插件骨架 + 资产挂载 + VideoBackend + mock；同时汇编 `vendor/previs-director/`（recovered JS + 数据 + 文档）。
2. **P1**：port 引擎/store/tools；打通"镜头卡→预演工程→校验→导出 JSON"；渲染先外部。
3. **P2**：REA R1/R2/R3；补渲染/导出；3D 资产包挂载。
4. **P3**：REA R5—R8；后处理/动效页；REA R9/R10（测试阶段）。

---
