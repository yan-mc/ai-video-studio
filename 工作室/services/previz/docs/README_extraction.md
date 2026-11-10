# 闭源预演引擎可执行文件（`预演引擎可执行文件`）提取方法与复现说明

> 说明：`预演引擎可执行文件` 为闭源商业预演软件的可执行文件名（技术性文件名，非品牌引用）；本项目已将其名称、商标与品牌标识从交付物中移除，此处仅保留提取与复现所需的技术性登记。

对象：`F:\AI视频\功能拆解\预演软件\01_解包载荷\预演引擎可执行文件`
SHA-256：`295a316ae411ee50a667cb08e0fab55f940687b0b9421d84a2c296ce8b3bd6f2`（99,034,624 B）
分析日期：2026-11-04；分析方式：**纯静态**（未运行该 exe；Lead 另做受控动态探测，见 `analysis\recon\runtime-probe-findings.md`）。

## 1. 结论：Bun 1.3.14 单文件可执行程序

- PE Version 资源（`.rsrc` 内 offset 97,557,616，664 B）：`FileDescription=Bun`, `ProductName=Bun`, `OriginalFilename=bun.exe`, `FileVersion/ProductVersion=1.3.14`, `CompanyName=Oven`（见 `pe_version_info.json`）。
- 运行时横幅字符串（文件 offset `0x38D3519`）：`Bun v1.3.14 (0d9b296a) Windows x64 (baseline)`。
- 无 `.dep-v0`（非 Rust）；导入表仅 Rust/Bun 运行时所需系统 DLL（见 `pe_layout.txt` 与 REA `inspect_pe_imports` 证据 `ev_ee7041…`）。
- 应用负载在自定义 PE 段 **`.bun`**：raw offset `0x5D38000`，大小 `0x13A600`（1,287,680 B），是 Bun standalone module graph。

## 2. `.bun` 段精确布局（本目录 `bun_section_edges.txt` 有十六进制证据）

| 段内偏移 | 文件偏移 | 内容 |
| --- | --- | --- |
| `+0x00` | `0x5D38000` | `u64` = `0x000000000013A5C0`（图声明长度；语义未完全解码） |
| `+0x08` | `0x5D38008` | ASCII + NUL：`B:/~BUN/root/` + 该可执行文件名（虚拟根路径，原样保留字节证据） |
| `+0x30` | `0x5D38030` | NUL 结束 |
| `+0x31` | `0x5D38031` | **JS bundle 明文源码**，`1,287,473 B`，`[0x5D38031, 0x5E72562)`；以 `// @bun\nvar x_=Object.create;…` 开头，以 `…await Xo();\n` 结尾（入口 `--http` 分支） |
| `+0x13A562` | `0x5E72562` | 尾部索引表 ≈90 B：`u32 40`、`u32 41`、`u64 0x13A531`（=1,287,473，JS 字节数）、若干 u64 偏移/长度、`(1,1,1)` 版本三元组 |
| `+0x13A5BC` | `0x5E725BC` | 标准 trailer：`"\n---- Bun! ----\n"`（16 B），其后补 0 至段尾 |
| `+0x13A600` | `0x5E72600` | 段结束 = 文件结束（**无 overlay**） |

JS 特性：非可打印字节仅 36 / 1,287,512（基本都在尾部表）；`// @bun` 标记仅 1 处；无 `sourceMappingURL`、无 sourcemap、无加密壳；源码为 Bun 打包后的单 bundle（内部内联 `ajv`/`ajv-formats`/`zod`/`@modelcontextprotocol/sdk`/`three.js r184` 等）。

## 3. 复现步骤（全部脚本在 `scripts\`，可重跑）

```powershell
$py  = 'C:\Users\28988\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
$node= 'F:\Deepseek_harness\rea-agent\runtime\node.exe'
$A   = 'F:\AI视频\功能拆解\预演软件\03_反编译与代码\预演引擎进程\artifacts'

# 1) PE 头/段表/熵/原始 strings（产出 pe_layout.txt, entropy_blocks_64k.tsv, embedded_magics.txt, strings_*.txt）
& $py scripts\analyze_pe.py

# 2) 按 .bun 段结构 carve 出 bundle_carved.js（含头部/尾部校验）
& $py scripts\carve_bun.py

# 3) 用 prettier 格式化（tools\jstools 内已安装 prettier 3.9.10）
& $node 'F:\AI视频\功能拆解\预演软件\tools\jstools\node_modules\prettier\bin\prettier.cjs' --parser babel --print-width 120 "$A\bundle_carved.js" > "$A\bundle_pretty.js"

# 4) 转中文可读版 + 应用区 outline/strings（产出 bundle_pretty_utf8.js, app_outline.txt, app_strings.txt, app_tool_defs_raw.js）
& $py scripts\app_extract.py

# 5) 提取结构化数据表 + tool_catalog.json + recovered/ 源码树
& $node scripts\extract_data.js
```

其它脚本：`bundle_contexts.py`（关键词上下文，早期勘察用）、`version_and_spawn.py`（PE 版本资源 + 主 exe spawn 上下文 + Bun 版本）——产物分别在 `bun_section_edges.txt`、`pe_version_info.json`、`main_exe_spawn_strings.txt`。

## 4. `recovered/` 源码树说明（按 prettier 行号切分）

| 文件 | prettier 行号 | 大小 | 内容 |
| --- | --- | --- | --- |
| `vendor_mcp_sdk_and_ajv_zod.js` | 1–22,439 | 825 KB | MCP TypeScript SDK（含 StdioServerTransport、zod 兼容 schema）+ ajv/ajv-formats + zod 等 |
| `app_director_engine_module.js` | 22,440–24,353 | 75 KB | ★ 应用模块 A：导演助手（DeepSeek/Codex）、HTTP 服务（4 路由 + 静态托管）、15 个工具的 zod 定义、运镜/动作/姿势/表演数据、求值器、校验器、`apply_*` 生成器 |
| `vendor_three_r184_module.js` | 24,354–48,657 | 836 KB | three.js r184（`IZ="184"`）+ OrbitControls/TransformControls 等 examples + 浏览器 3D 舞台类（`snapshotForDescription()`/`diagnostics()`，依赖 DOM/WebGL，服务端不可执行） |
| `app_server_entry_module.js` | 48,658–49,192 | 21.6 KB | ★ 应用模块 B：`~/.previs-engine` 工程仓库（默认数据目录名已中性化；project.json/history.json、50 步 undo）、15 工具的服务实现 `iE.execute()`、MCP stdio 注册、`--http` 入口 |

> 模块边界依据：两个应用模块均以 `import … from "node 内置模块"` 开头（prettier 第 22440、48658 行），第三方库区以其间/其前的大段库代码划分；三者的先后顺序符合 Bun bundler 的依赖拓扑序。

## 5. 关于 bun-demincer

Lead 下载的 `analysis\tools\bun-demincer`（vicnaum/bun-demincer）面向 Bun 多模块 standalone graph（extract → resplit → match-vendors → deobfuscate → cluster）。本次实测该 exe 的图里**只含一个明文 bundle 模块**（`// @bun` 仅 1 处，其余是内联库），因此采用"按 `.bun` 段结构直接 carve 原始字节"更完整、可审计（保留原始字节与偏移）。`bun-demincer` 未运行：其 `extract` 等价于 `carve_bun.py`，`resplit/deobfuscate` 对单 bundle 无增益；`recovered/` 已按"应用模块 / 第三方库"边界拆分，满足源码级分析需要。

## 6. 文件清单（本目录）

| 文件 | 说明 |
| --- | --- |
| `bundle_carved.js` | ★ 原始 carve 出的 JS（1,287,473 B，权威字节） |
| `bundle_pretty.js` / `bundle_pretty_utf8.js` | prettier 格式化版（后者把 `\uXXXX` 还原为中文） |
| `recovered/*.js` | 按模块拆分的源码树（见 §4） |
| `data/*.json` | 从源码求值提取的结构化数据（catalog/tool_catalog 等 10 个） |
| `static_vs_dynamic_check.md` | 静态提取 vs Lead 动态实测一致性核对（全部一致） |
| `pe_layout.txt` | PE 段表、数据目录、熵、overlay |
| `pe_version_info.json` | PE RT_VERSION（Bun 1.3.14 / bun.exe / Oven） |
| `bun_section.bin` / `bun_section_edges.txt` / `tail512.hex` | `.bun` 段原始字节与边界/尾部十六进制证据 |
| `entropy_blocks_64k.tsv` | 64 KB 块熵曲线（判断无大块压缩/模型数据） |
| `embedded_magics.txt` | 文件内 magic 扫描（无有效大块模型/资源） |
| `strings_ascii.txt` / `strings_utf16le.txt` | 原始字符串 dump（带文件偏移） |
| `app_strings.txt` / `app_outline.txt` / `app_tool_defs_raw.js` | 应用区字符串、符号大纲、工具 zod 定义原文 |
| `main_exe_spawn_strings.txt` | 主 exe 中 spawn/env/health 邻接字符串证据 |
| `http_api.md` / `agent_backend.md` / `data_model.md` / `validation_rules.md` | 协议、Agent 后端（含 prompt 全文）、数据模型、校验规则 |
| `scripts/*.py`, `scripts/*.js` | 全部提取脚本 |

## 7. 局限性

- 静态分析，未执行该 exe；运行期行为以 Lead 的受控探测为准（见 §1 引用）。
- prettier 只改变排版（字符串内 `\uXXXX` 保持原样；`bundle_pretty_utf8.js` 为阅读辅助，**权威字节以 `bundle_carved.js` 为准**）。
- `.bun` 尾部索引表字段语义未完全解码（不影响功能结论）。
- 浏览器 three.js 舞台模块为何被包含在该可执行文件的 bundle 中，未在服务端代码找到引用（未知，见 FEATURES §12）。
