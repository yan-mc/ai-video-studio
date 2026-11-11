# AI 视频工作室

> 基于 [DeepSeek​ Harness](https://github.com/deepseek-ai) 的本地 AI 视频制作工作台。
> 从镜头卡到成片的全链路：**提示词编译 → 3D 预演 → 本地 MiniMax H3 生成 → 后处理 → 质检**。

**当前状态**：本地生成链路已跑通；前端待重构为浏览器 SPA（方案已敲定）。

👉 **接手请先读 [交接文档.md](交接文档.md)**

---

## 这是什么

一个 DSH 插件 + 本地服务的组合，把「用自然语言描述一个镜头」变成「得到带音频的视频文件」。

```
┌─────────────────────────────────────────────────┐
│  DSH 插件 @local/dsh-ai-video-studio             │
│  ├─ index.js   12 个 studio_* 工具 + REST API    │
│  └─ client.js  面板 UI（待重构为启动器）           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  本地服务                                         │
│  ├─ ComfyUI 0.44.0 :8188    跑 MiniMax H3        │
│  └─ 预演引擎      :4318     3D 导演台             │
└─────────────────────────────────────────────────┘
                      ↓
          ffmpeg 9.x（后处理 / 质检 / 抽帧）
```

### 核心能力

| 能力 | 状态 |
|---|---|
| 镜头卡（标题/时长/比例/风格/描述/运镜/声音） | ✅ |
| H3 提示词编译（六段式 I2VA / T2VA） | ✅ |
| 3D 预演（58 动作 / 20+ 运镜 / 13 工具） | ✅ |
| 本地 H3 生成（4 档分辨率 / 5-15 秒 / 带音频） | ✅ |
| 角色卡（外观 + 参考图 + 画风） | ✅ |
| 资产体系（外挂包只读 + 上传库可写） | ✅ |
| 后处理 / 质检（ffmpeg + ffprobe） | ✅ |
| **浏览器 SPA 工作台** | ⬜ 待重构 |
| **画布节点系统（React Flow）** | ⬜ 待重构 |

---

## 环境要求

| 项 | 要求 |
|---|---|
| **显卡** | NVIDIA，**12 GB 显存**可跑满全部官方档位（实测 RTX 4080 Laptop） |
| **DSH** | 0.2.2-rc.1 或更高 |
| **ComfyUI** | 0.44.0+ |
| **ffmpeg** | 9.x（放 `工作室/tools/ffmpeg`，或改 `ffmpegDir`） |
| **Python** | 3.12（仅 ComfyUI 侧需要） |

### 模型（73.37 GB，需自行下载）

放 `ai-runtime/models/`：

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

```bash
# 1. 安装插件：复制 工作室/dsh-ai-video-studio 到
#    ~/.dsh/profiles/desktop/node_modules/@local/
# 2. 在 DSH 里启用 @local/dsh-ai-video-studio

# 3. 配置
cp 工作室/data/config.example.json 工作室/data/config.json
# 按实际路径修改

# 4. 起 ComfyUI
& 'ai-runtime\start-h3.ps1'

# 5. 自检
$base='http://127.0.0.1:{DSH端口}/ai-video-studio/api'
curl "$base/selfcheck"     # 期望 12/13（seedance 缺 key 是预期）
```

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

长时长（608p）：10 秒 506s，15 秒（362 帧上限）836s。
同参数重复提交命中 ComfyUI 缓存约 **10 秒**。

---

## 踩过的坑（重要）

1. **H3 不认识角色名。** 写 `Sakiko Togawa` 得到随机路人。必须写全外观。
2. **不要用预演灰模帧做条件帧。** 灰模被当风格参考，输出会出现灰色方块、描白边。
3. **DSH 插件 UI 不能用 `@media`。** 侧栏吃掉 286 CSS px，用 `ResizeObserver` 实测。
4. **Grid 折叠不能把列设 0px。** `0px 1fr 0px` 会让 `1fr` 算出 0。
5. **`director_manage_shot` 参数是 `operation`**，无 `update`，时长用 `duration_frames`。
6. **相机关键帧同帧号不覆盖。** 必须先删旧帧。

完整清单见 [交接文档.md](交接文档.md) 与 [工作室/docs/SKILL.md](工作室/docs/SKILL.md)。

---

## 目录结构

```
F:\AI视频\
├── 交接文档.md                   ★ 接手先读
├── 工作室/
│   ├── dsh-ai-video-studio/     DSH 插件
│   ├── services/previz/         预演引擎
│   ├── studio-apps/director/    ★ 解包导演台（可用）
│   ├── data/                    运行数据
│   ├── docs/                    设计文档 + SKILL.md
│   └── tools/ffmpeg/            （不入库）
├── 教程资料/                     ★ 对标与方案
│   ├── 技术方案.md              重构方案（已敲定）
│   ├── 官方文档/                21 篇教程 PDF + 文本
│   └── 功能清单/                产品总览、对标清单、拆解报告
├── 资料归档/                    有价值的旧方案 6 份
├── 研究资料/                    调研原始资料
├── 数据表/                      模型与平台对比表
├── 模板/                        H3 输入包 schema
├── ai-runtime/                  （不入库，79.5 GB）
├── 功能拆解/                    （不入库，4 GB）
└── 资产包/                      （不入库）
```

---

## 文档

| 文档 | 内容 |
|---|---|
| [交接文档.md](交接文档.md) | **★ 接手必读**：状态、环境、坑、下一步 |
| [教程资料/技术方案.md](教程资料/技术方案.md) | 重构方案（已敲定） |
| [教程资料/功能清单/功能对标清单.md](教程资料/功能清单/功能对标清单.md) | 11 模块逐步对标 |
| [教程资料/官方文档/README.md](教程资料/官方文档/README.md) | 21 篇教程索引 |
| [工作室/docs/SKILL.md](工作室/docs/SKILL.md) | 项目技能手册 |
| [工作室/docs/project-status-review.md](工作室/docs/project-status-review.md) | 项目现状审查 |
| [工作室/docs/impl-audit.md](工作室/docs/impl-audit.md) | 逐函数实现审计 |
| [工作室/docs/plan-vs-actual.md](工作室/docs/plan-vs-actual.md) | 计划 vs 实际 |
| [工作室/docs/assets-and-characters.md](工作室/docs/assets-and-characters.md) | 资产体系与角色卡 |
| [工作室/docs/cbm-research.md](工作室/docs/cbm-research.md) | CBM 调研 |
| [工作室/docs/fix-previz.md](工作室/docs/fix-previz.md) | 预演链路修复记录 |
| [工作室/docs/fix-reliability.md](工作室/docs/fix-reliability.md) | 可靠性修复记录 |
| [工作室/docs/ui-verification.md](工作室/docs/ui-verification.md) | UI 验证记录 |

---

## 许可与来源

- 本项目代码：仅供学习研究
- **不包含任何第三方资产包、拆解产物或模型权重** —— 需自行获取
- 预演引擎基于对某闭源软件的行为学习重建，代码为独立实现
- three.js、React、React Flow 等遵循各自许可
