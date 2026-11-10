---
name: ai-video-studio
description: 在 F:\AI视频 项目中开发或调试 DSH 视频工作室插件（12 个 studio_* 工具 + Web UI）、本地 MiniMax H3 视频生成链路、3D 预演引擎、H3 提示词编译。用于扩展插件工具/面板、排查 H3 生成失败或画质问题、操作预演导演台、管理角色卡与资产，以及处理该项目的硬约束（分辨率档位、cfg=1.0、帧数网格、ComfyUI 路径）。
---

# AI 视频工作室 · 项目 Skill

## 这套系统是什么

三层：

```
DSH 插件（@local/dsh-ai-video-studio）
  ├─ index.js   12 个 studio_* 工具 + Web API（/ai-video-studio/api/*）
  └─ client.js  导演台式 UI（React，三栏布局）
        ↓
本地服务
  ├─ ComfyUI 0.44.0  :8188   跑 MiniMax H3
  └─ 预演引擎        :4318   3D 导演台（three.js r184）
        ↓
媒体工具：ffmpeg 9.0.2（后处理 / QC / 抽帧）
```

## 硬约束（违反会直接报错或出废片）

| 约束 | 说明 |
|---|---|
| **分辨率必须在 32 倍数且是官方 MP 档** | 只认这几个：864×480 / 960×544 / 1056×608 / 1344×768。任意值会触发 `shape '[1, 24, 1, 1, 15, 2, 26, 2]' is invalid` |
| **`cfg` / `guidance_scale` 必须 1.0** | H3 是 CFG 蒸馏模型，非 1.0 画质崩坏 |
| **`length` 必须在 17k+5 帧网格** | 合法值：124 / 244 / 362 等。用 `lengthFromSeconds()` 算，别手写 |
| **Turbo LoRA 只能 4 或 8 步** | 是时间步蒸馏，其他步数出废片 |
| **音频 VAE 必须 fp32** | 用 `minimax_h3_audio_vae_fp32`，fp16 会静音或爆音 |
| **FL2VA 与 Ref2VA 不可互换** | 首尾帧/R2V 用 Ref2VA，纯文生视频用 FL2VA |
| **`LoadImage` 只接受 ComfyUI `input/` 内的文件名** | 绝对路径会报 `Invalid image file`。用 `stageToComfyInput()` |
| **禁止 GGUF / NVFP4 文本编码器** | NVFP4 需 CC 10.0+，本机 4080 是 8.9 |

## 环境事实（本机实测）

| 项 | 值 |
|---|---|
| 显卡 | RTX 4080 Laptop，**12 GB 显存** |
| 模型目录 | `F:\AI视频\ai-runtime\models`（7 文件 / 73.37 GB） |
| ComfyUI | `F:\AI视频\ai-runtime\ComfyUI`，启动脚本 `ai-runtime\start-h3.ps1` |
| venv | `F:\AI视频\ai-runtime\venv`（torch 2.11.0+cu128） |
| 数据目录 | `F:\AI视频\工作室\data` |
| 系统缩放 | **175% DPI** —— UI 开发必须考虑（见下） |

### 性能基线（4 步 Turbo / 5 秒片）

| 分辨率 | 耗时 | 显存 |
|---|---|---|
| 864×480 | 140s | 10.1 G |
| 960×544 | 170s | ~10.5 G |
| 1056×608 | 211s | ~11 G |
| 1344×768 | 336s | ~11.5 G |

时长：608p 下 10 秒 = 506s，15 秒（362 帧，H3 上限）= 836s。

**12 GB 能跑满全部官方档位，包括 768p。** 同参数重复提交命中 ComfyUI 缓存约 10 秒。

## 关键陷阱（都是踩过的）

1. **H3 不认识角色名。** 写 `Sakiko Togawa` 会得到随机路人。必须写全外观：
   `pale blue hair, black hair ribbon, black dress with white frilled sleeves, black gloves`。
   用角色卡把验证过的描述固化下来。

2. **不要用预演灰模帧做 H3 条件帧。** 灰模会被当成风格参考，导致画面里出现灰色方块、角色描白边。
   正确做法：预演只用来设计站位和运镜，把结果**转成文字**写进 `camera` / `description`。

3. **UI 不能用 `@media`。** DSH 侧栏会吃掉 286 CSS px，面板实际只剩 ~326 px，而视口是 844 px。
   用 `ResizeObserver` 实测 `.avs-root` 宽度分档（`narrow` 0/1/2）。

4. **Grid 折叠不能把列设 0px。** `grid-template-columns: 0px 1fr 0px` 会让 `1fr` 算出 **0**。
   折叠时整体替换 `--avs-cols`，且**不渲染**该列 DOM。

5. **容器查询不能查自己。** `container-type` 加在 `.avs-root` 上时，`.avs-root` 自身规则不生效（只作用于后代）。

6. **改完插件要重载。** 用 plugin_manager `set_bundle` 先 disable 再 enable；只改 `client.js` 时页面刷新即可。

7. **`director_manage_shot` 参数是 `operation` 不是 `action`**，且只支持 `add/duplicate/rename/reorder/delete`（**无 update**）。时长用 `duration_frames`。

8. **相机关键帧同帧号不会覆盖。** 必须先 `director_delete` 删旧帧再写新的，否则旧帧胜出。

9. **`/previz/render` 必须传 `projectId`**，否则报 `The "path" argument must be of type string`。

## 常用操作

### 起服务

```powershell
& 'F:\AI视频\ai-runtime\start-h3.ps1'          # ComfyUI（幂等，自动等端口）
# 预演引擎由插件自启（previzAutoStart=true），或 POST /previz/start
```

### 生成一条视频（工具）

```
studio_shot(action='create', projectId, shot={title, mode:'t2v', durationSec, ratio, style, description, camera, backend:'h3-local', profile})
studio_prompt(action='compile', projectId, shotId)     # 先看编译结果再生成
studio_generate(projectId, shotId, backend='h3-local')
studio_jobs(action='get', jobId)                        # 轮询
studio_qc(path='outputs/xxx.mp4')
```

### 生成一条视频（HTTP）

```powershell
$base='http://127.0.0.1:7560/ai-video-studio/api'
# 端口 = DSH Web GUI 端口，不是固定的 8670
curl -s -X POST -H 'Content-Type: application/json' `
  -d '{"projectId":"...","shotId":"...","backend":"h3-local"}' "$base/generate"
```

### 抽帧检查（必做）

```powershell
$ff='F:\AI视频\工作室\tools\ffmpeg\bin\ffmpeg.exe'
& $ff -y -ss 1.0 -i output.mp4 -frames:v 1 -update 1 frame.png
```
然后用 `read_image` 看。**文件名不要带点号**（`t1.0.png` 会解析失败），用 `t1.png`。

### 角色卡

```
studio_character(action='save', card={name, appearance, style, seedPrompt})
studio_character(action='expand', id)   # → prompt + 参考素材绝对路径
```
`appearance` 越具体越好：发色 + 发型 + 瞳色 + 服装 + 配饰。

### 资产

外挂包（只读）与上传库（可写）分离：
- `data/assets/<kind>/` — 上传资产，`index.json` 索引，kind ∈ image/video/audio/model3d/font/doc/other
- `F:\AI视频\资产包/<packId>/manifest.json` — 外挂包

上传：`POST /assets/upload`，multipart（`file` 可多选 + `kind`/`tag`）或 raw body + 查询参数。上限 512 MB。

## 修改 UI 时的验证方法

不要靠截图猜。项目带 harness：

```powershell
# 1) 起 harness（把 client.js 当插件跑在可控宽度的容器里）
Start-Process 'F:\Deepseek_harness\rea-agent\runtime\node.exe' `
  -ArgumentList 'serve-harness.mjs','4477' -WorkingDirectory 'F:\AI视频\工作室\docs\harness'

# 2) 复制源码过去
Copy-Item 'F:\AI视频\工作室\dsh-ai-video-studio\client.js' 'F:\AI视频\工作室\docs\harness\client.js' -Force

# 3) 按指定面板宽度验证（模拟 175% DPI 真实场景）
& 'F:\Deepseek_harness\rea-agent\runtime\node.exe' 'F:\AI视频\工作室\docs\harness\verify-width.mjs' 326 out.png
```

`verify-width.mjs` 返回 JSON 报告：`narrow` / `mainCols` / `stage.w` / `leftPane` / `rightPane` / `timelineCollapsed` / `errors`。
判断标准：**326px 时 `stage.w` 必须等于 326**（曾经是 0）。

## 代码地图

| 文件 | 作用 |
|---|---|
| `工作室/dsh-ai-video-studio/index.js` | 12 工具 + Web API + 生成编排（`runH3Local`、`resolutionFor`、`stageToComfyInput`、`compilePrompt`） |
| `工作室/dsh-ai-video-studio/client.js` | UI（`CSS` 数组 + `React.createElement` 组件，无 JSX） |
| `工作室/data/workflows/h3.json` | ComfyUI 工作流模板（17 节点，含音频 + 首尾帧） |
| `工作室/services/previz/engine.mjs` | 预演引擎（内置，MCP 风格 command 接口） |
| `工作室/docs/*.md` | 设计与审计文档 |

### 插件工具清单（12 个）

`studio_config` `studio_project` `studio_shot` `studio_prompt` `studio_generate` `studio_jobs`
`studio_assets` `studio_character` `studio_backend` `studio_previz` `studio_post` `studio_qc`

## 文档索引

| 文档 | 内容 |
|---|---|
| `工作室/docs/project-status-review.md` | 功能进度与实现状态 |
| `工作室/docs/impl-audit.md` | 实现审计（逐函数） |
| `工作室/docs/plan-vs-actual.md` | 方案 vs 实际差异 |
| `工作室/docs/assets-and-characters.md` | 资产体系与角色卡 |
| `工作室/docs/cbm-research.md` | CBM 调研 |
| `工作室/docs/fix-previz.md` | 预演修复记录 |
| `工作室/docs/fix-reliability.md` | 可靠性修复记录 |
| `工作室/docs/ui-verification.md` | UI 验证记录 |
| `ai-runtime/DEPLOY-LOG.md` | 部署台账、11 个坑、性能基线 |

## 完成后自检

```powershell
$base='http://127.0.0.1:7560/ai-video-studio/api'
curl -s "$base/selfcheck"    # 期望 12/13（seedance 缺 key 是预期的）
```
