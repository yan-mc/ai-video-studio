# AI 视频工作室

> 基于 [DeepSeek Harness](https://github.com/deepseek-ai) 的本地 AI 视频制作工作台。
> 从镜头卡到成片的全链路：**提示词编译 → 3D 预演 → 本地 MiniMax H3 生成 → 后处理 → 质检**。

---

## 这是什么

一个 DSH 插件 + 本地服务的组合，把「用自然语言描述一个镜头」变成「得到带音频的视频文件」。

```
┌─────────────────────────────────────────────────────────┐
│  DSH 插件 @local/dsh-ai-video-studio                     │
│  ├─ index.js   12 个 studio_* 工具 + Web API             │
│  └─ client.js  导演台式 UI（三栏 + 时间轴）               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  本地服务                                                 │
│  ├─ ComfyUI 0.44.0 :8188    跑 MiniMax H3                │
│  └─ 预演引擎      :4318     3D 导演台（three.js r184）    │
└─────────────────────────────────────────────────────────┘
                          ↓
              ffmpeg 9.0.2（后处理 / 质检 / 抽帧）
```

### 核心能力

| 能力 | 说明 |
|---|---|
| **镜头卡** | 标题/时长/比例/风格/描述/运镜/声音，一套结构化输入 |
| **H3 提示词编译** | 自动编译成 MiniMax H3 要求的六段式格式（I2VA / T2VA） |
| **3D 预演** | 内置预演引擎，摆位、排动作、设机位，导出首尾帧与控制视频 |
| **本地生成** | MiniMax H3 全参数驱动（分辨率档位、时长网格、Turbo LoRA、音频 VAE） |
| **角色卡** | 把「外观描述 + 参考图/音 + 画风」打包，避免每次重写提示词 |
| **资产体系** | 外挂资产包（只读）与上传资产库（可写）分离 |
| **后处理/质检** | ffmpeg 转码/缩放/拼接/混音 + ffprobe 质检 |

---

## 环境要求

| 项 | 要求 |
|---|---|
| **显卡** | NVIDIA，**12 GB 显存**可跑满全部官方档位（实测 RTX 4080 Laptop） |
| **DSH** | 0.2.2-rc.1 或更高 |
| **ComfyUI** | 0.44.0+ |
| **ffmpeg** | 9.x（放在 `工作室/tools/ffmpeg`，或改 `ffmpegDir` 指向系统安装） |
| **Python** | 3.12（仅 ComfyUI 侧需要） |

### 模型（73.37 GB，需自行下载）

放在 `ai-runtime/models/`：

| 文件 | 大小 | 用途 |
|---|---|---|
| `minimax_h3_fl2va_pruned_fp8_scaled.safetensors` | 20.96 GB | 文生视频 |
| `minimax_h3_ref2va_pruned_fp8_scaled.safetensors` | 20.96 GB | 参考图/首尾帧 |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | 27.14 GB | 文本编码器 |
| `minimax_h3_video_vae_fp16.safetensors` | 5.21 GB | 视频 VAE |
| `minimax_h3_audio_vae_fp32.safetensors` | 0.61 GB | 音频 VAE（**必须 fp32**） |
| `minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors` | 1.96 GB | 加速 LoRA |
| `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | 1.96 GB | 加速 LoRA |

---

## 硬约束（违反直接报错或出废片）

| 约束 | 说明 |
|---|---|
| **分辨率必须 32 倍数且在官方档位** | 只认 864×480 / 960×544 / 1056×608 / 1344×768 |
| **`cfg` / `guidance_scale` 必须 1.0** | H3 是 CFG 蒸馏模型 |
| **`length` 必须在 17k+5 帧网格** | 合法：124 / 244 / 362 |
| **Turbo LoRA 只能 4 或 8 步** | 时间步蒸馏 |
| **音频 VAE 必须 fp32** | fp16 会静音 |
| **FL2VA 与 Ref2VA 不可互换** | 首尾帧/R2V 用 Ref2VA |
| **`LoadImage` 只接受 ComfyUI `input/` 内文件名** | 绝对路径会失败 |
| **禁止 GGUF / NVFP4 编码器** | NVFP4 需 CC 10.0+ |

---

## 快速开始

### 1. 安装插件

```bash
# 复制到 DSH profile 的 node_modules
cp -r 工作室/dsh-ai-video-studio ~/.dsh/profiles/desktop/node_modules/@local/
```

在 DSH 里启用 `@local/dsh-ai-video-studio`。

### 2. 配置

复制 `工作室/data/config.example.json` 为 `config.json`，按实际路径修改。

### 3. 起 ComfyUI

```powershell
# 项目自带启动脚本（幂等，自动等端口）
& 'ai-runtime\start-h3.ps1'
```

### 4. 自检

```powershell
$base='http://127.0.0.1:7560/ai-video-studio/api'   # 端口 = DSH Web GUI 端口
curl "$base/selfcheck"
```

期望 **12/13**（`seedance` 缺 API Key 是预期的）。

---

## 使用

### 通过 DSH 工具

```
studio_shot(action='create', projectId, shot={
  title: '雨夜街头', mode: 't2v', durationSec: 5, ratio: '16:9',
  style: 'cinematic anime style', description: '...',
  backend: 'h3-local', profile: 'P24-quality'
})
studio_prompt(action='compile', projectId, shotId)
studio_generate(projectId, shotId, backend='h3-local')
studio_jobs(action='get', jobId)
studio_qc(path='outputs/xxx.mp4')
```

### 通过 UI

DSH 侧栏 → 「视频工作室」→ 六个页签：

| 页签 | 功能 |
|---|---|
| **分镜** | 主工作台（左栏镜头列表 / 中间舞台 / 右栏属性，底部时间轴） |
| **任务** | 生成任务列表、质检、重试、取消 |
| **资产包** | 三个子页签：资产库（上传）/ 资产包（外挂）/ 角色卡 |
| **预演** | 预演服务控制、渲染、绑定 |
| **后端** | mock / h3-local / seedance-cloud 健康检查 |
| **设置** | 配置编辑、12 项自检、档位表 |

### 12 个工具

`studio_config` `studio_project` `studio_shot` `studio_prompt` `studio_generate` `studio_jobs`
`studio_assets` `studio_character` `studio_backend` `studio_previz` `studio_post` `studio_qc`

---

## 性能基线（RTX 4080 Laptop 12G / 4 步 Turbo / 5 秒片）

| 分辨率 | 耗时 | 显存 |
|---|---|---|
| 864×480 | 140s | 10.1 G |
| 960×544 | 170s | ~10.5 G |
| **1056×608** | **211s** | ~11 G |
| 1344×768 | 336s | ~11.5 G |

长时长（608p）：10 秒 = 506s，15 秒（362 帧，H3 上限）= 836s。

同参数重复提交命中 ComfyUI 缓存约 **10 秒**。

---

## 踩过的坑（重要）

1. **H3 不认识角色名。** 写 `Sakiko Togawa` 得到随机路人。必须写全外观：`pale blue hair, black hair ribbon, black dress, black gloves`。

2. **不要用预演灰模帧做 H3 条件帧。** 灰模会被当作风格参考，导致画面出现灰色方块、角色描白边。预演只用来设计站位和运镜，把结果**转成文字**。

3. **UI 不能用 `@media`。** DSH 侧栏吃掉 286 CSS px，面板实际只剩 ~326 px。用 `ResizeObserver` 实测宽度分档。

4. **Grid 折叠不能把列设 0px。** `grid-template-columns: 0px 1fr 0px` 会让 `1fr` 算出 **0**。折叠时整体替换列定义，且不渲染该列 DOM。

5. **`director_manage_shot` 参数是 `operation`**，只支持 `add/duplicate/rename/reorder/delete`（无 update），时长用 `duration_frames`。

6. **相机关键帧同帧号不覆盖。** 必须先删除旧帧。

完整清单见 [SKILL.md](工作室/docs/SKILL.md)。

---

## 目录结构

```
F:\AI视频\
├── 工作室/
│   ├── dsh-ai-video-studio/     ← DSH 插件（index.js + client.js）
│   ├── services/previz/         ← 预演引擎（engine.mjs + server.mjs + web/）
│   ├── data/
│   │   ├── workflows/h3.json    ← ComfyUI 工作流模板
│   │   └── config.example.json
│   ├── docs/                    ← 设计与审计文档 + SKILL.md
│   └── tools/ffmpeg/            ← ffmpeg（不入库，需自行安装）
├── ai-runtime/                  ← ComfyUI + 模型 + venv（不入库，156 GB）
├── 资产包/                       ← 外挂资产包（不入库）
├── 功能拆解/                     ← 拆解产物（不入库）
├── 研究资料/                     ← 调研原始资料
├── 数据表/                       ← 模型与平台对比表
├── 模板/                         ← H3 输入包 schema / 提示词模板
└── 存档-旧方案/                  ← 历史方案
```

---

## 文档

| 文档 | 内容 |
|---|---|
| [工作室/docs/SKILL.md](工作室/docs/SKILL.md) | **项目技能手册**：约束、陷阱、操作、代码地图 |
| [方案总览.md](方案总览.md) | 目标/范围/架构/剩余阶段 |
| [插件实现与接口规范.md](插件实现与接口规范.md) | 工具/API/数据模型/错误码 |
| [P0验收报告与剩余工作.md](P0验收报告与剩余工作.md) | 验收清单与剩余工作 |
| [工作室/docs/project-status-review.md](工作室/docs/project-status-review.md) | 项目现状审查 |
| [工作室/docs/impl-audit.md](工作室/docs/impl-audit.md) | 逐函数实现审计 |
| [工作室/docs/plan-vs-actual.md](工作室/docs/plan-vs-actual.md) | 计划 vs 实际对照 |
| [工作室/docs/assets-and-characters.md](工作室/docs/assets-and-characters.md) | 资产体系与角色卡 |
| [工作室/docs/cbm-research.md](工作室/docs/cbm-research.md) | CBM（概念瓶颈模型）调研 |
| [工作室/docs/fix-previz.md](工作室/docs/fix-previz.md) | 预演链路修复记录 |
| [工作室/docs/fix-reliability.md](工作室/docs/fix-reliability.md) | 可靠性修复记录 |
| [工作室/docs/ui-verification.md](工作室/docs/ui-verification.md) | UI 验证记录 |

---

## 许可与来源

- 本项目代码：仅供学习研究
- **不包含任何第三方资产包、拆解产物或模型权重** —— 这些需自行获取
- 预演引擎基于对某闭源预演软件的行为学习重建，代码为独立实现
- three.js r184、React 等第三方库遵循各自许可，详见 [工作室/vendor/PROVENANCE.md](工作室/vendor/PROVENANCE.md)
