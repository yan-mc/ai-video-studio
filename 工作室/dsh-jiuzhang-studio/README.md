# 九章工作室 · DSH 视频/图像创作插件

> 本地 AI 视频与图像工作室。渲染页 / 角色卡 / 节点画布 / 素材库 / 剧本 / 漫画 / 模特 / 3D 预演 / 立绘拆解 / **H3 + H3-Image + Seedance 三后端**。
>
> 完全本地运行，数据不出机器。

---

## 特性

| 能力 | 说明 |
|---|---|
| **渲染页（主入口）** | 选角色卡 + 参考图/视频/音频 → 编译提示词 → 渲染 → 页面内预览；含成片合成 |
| **角色卡仓库** | 设定卡图 + 文字设定 + 原立绘，多角色一致性锚点，渲染时按优先级自动排布 |
| **26 节点画布** | 节点式工作流，8 种端口类型，拖线只列可连接节点，12 步撤销，自动保存 |
| **H3 视频生成** | MiniMax H3 本地（Ref2VA / FL2VA / T2V），**音画同步**，5 秒片约 130 秒 |
| **四类参考输入** | 参考图 ≤9 / 参考视频 ≤3（帧序列）/ 视频音轨 / 独立音频 ≤3，编号自动推算 |
| **H3-Image 图像生成** | 33B 扩散模型，6 步采样，原生 16MP，**12GB 显存可跑** |
| **立绘拆解** | 立绘 → 全景式角色概念分解图（服装分层/表情集/材质特写/随身物品） |
| **漫画工作台** | 分镜抽取 → 提示词计划 → 逐格出图 → 内含图片的 SVG 导出 |
| **模特工作台** | 电商 6 风格 / 影视 10 画风，套件批量出图（13 张 / 10 张） |
| **剧本 5 阶段** | 大纲 → 人物小传 → 章节目录 → 章节正文 → 视觉分镜，14 题材；含「剧本拆解」tab |
| **3D 预演** | 58 动作 / 28 运镜 / 7 人物 / 10 道具，白模可导出 mp4 当参考视频 |
| **H3 提示词工程** | 官方六段式/三段式编译器，9 种画风，硬约束校验 |
| **画布 AI 助手** | 17 个画布工具 + 4 个权限位，自然语言改画布 |
| **图像工具** | 裁剪 / 切割 / 标注 / 抽帧 / 抽音 / 质检 |
| **画布生成闭环** | 节点参数 → 镜头卡 → 生成 → 轮询 → 结果回写，产物自动归档进素材库 |

---

## 快速开始

### 1. 安装插件

```powershell
# 在 DSH profile 里 link 本目录
cd $env:USERPROFILE\.dsh\profiles\desktop
# package.json dependencies 里加：
#   "@local/dsh-jiuzhang-studio": "link:<本仓库路径>"
```

重启 DSH，左侧栏出现「九章工作室」图标。

### 2. 准备本地模型

**插件不包含模型权重。** 需要：

- ComfyUI ≥ 0.45.0
- MiniMax H3 视频模型（约 47 GB）
- MiniMax H3-Image 图像模型（约 13 GB）

详细步骤见 **[部署 skill](skills/jiuzhang-studio-setup/SKILL.md)**，包含：
- 完整模型清单与下载命令
- 显存/磁盘要求与量化档位选择
- 常见错误排查
- 硬件性能基线（实测数据）

> **3D 预演引擎是可选组件**：它属于第三方拆解产物，许可证不允许随插件分发。
> 需要时把引擎目录放到 `<dataDir>/previz-engine`，或用配置项 `previzDir` /
> 环境变量 `PREVIZ_HOME` 指定位置。未安装时预演页会明确显示"未安装"，
> 不影响其它功能。

### 3. 构建前端（可选）

仓库已包含构建好的 `app-dist`，clone 即用。若改了 `app-src`：

```powershell
cd app-src
npm install
npm run build
```

---

## 用法

点侧栏图标 → 面板显示**启动器 + 监测器** → 点任意入口，浏览器新标签页全屏打开。

**详细功能说明见 [使用指南](docs/使用指南.md)**，覆盖 13 个页面每一个窗口、每个输入框的作用。

> 为什么不在 DSH 面板里直接画？侧栏会挤压可用宽度，画布在浏览器全屏体验才正确。面板里的监测器仍实时显示后端状态。

---

## 架构

```
DSH Host (Electron, 127.0.0.1:随机端口)
└─ @local/dsh-jiuzhang-studio
   ├─ host/                Node ESM：工具 + REST + 子进程
   │  ├─ index.js          插件入口
   │  ├─ security.js       Origin 同源 + 写令牌 + 路径穿越防护
   │  ├─ config.js         配置白名单（可执行路径不接受外部注入）
   │  ├─ static.js         SPA 静态服务（Range / HEAD / ETag）
   │  ├─ api/index.js      108 条 REST 路由
   │  ├─ services/         19 个服务
   │  └─ store/            原子 JSON + 图片引用池
   ├─ client.js            DSH 面板（启动器 + 监测器）
   ├─ app-dist/            SPA 构建产物（进仓库）
   └─ app-src/             SPA 源码（React 18 + Vite）
```

**HTTP 路由**（全部 handler 注册，绕过 DSH 准入 → 自带鉴权）：

| 路径 | 用途 |
|---|---|
| `/luoshu/api/*` | REST（108 条） |
| `/luoshu/app/*` | SPA 静态 |
| `/luoshu/assets/*` | 素材文件静态（来自 `<dataDir>/assets`，供 3D 模型等直接内联加载） |

**排查入口**：`GET /luoshu/api/health` 会一并返回 `workflows.ok`
（H3 与 H3-Image 的工作流模板是否就位）与 `previz.available`（预演引擎是否安装）。
缺模板时可打 `GET /luoshu/api/workflows/diagnostics` 看它找过哪些目录、该怎么配。

---

## Agent 工具（15 个）

| 工具 | 说明 |
|---|---|
| `studio_meta` | 档位 / 19 H3 槽位 / 26 节点 / 15 资产类型 |
| `studio_config` | 配置读写（白名单） |
| `studio_project` | 项目 CRUD |
| `studio_shot` | 镜头卡 CRUD |
| `studio_generate` | 触发生成（h3-local / h3-image / seedance / mock） |
| `studio_jobs` | 任务查询 / 取消（真终止远端） |
| `studio_post` | 8 个后处理/图像工具 |
| `studio_h3_workshop` | 剧本 → 分段 + 资产（**只产文本，不出图**） |
| `studio_previz` | 3D 预演控制 |
| `studio_script` | 剧本 5 阶段 |
| `studio_mw` | 模特工作台（11 action） |
| `studio_director` | 3D 预演（8 action，58 动作 / 28 运镜） |
| `studio_prompt` | H3 提示词编译 |
| `studio_image` | H3-Image 出图 |
| `studio_toolbox` | 7 个域的工具箱 |

> 素材没有独立工具，走 REST（`/assets*`）。生成产物会自动归档进素材库。

---

## 本地模型要求

### H3 视频

| 文件 | 大小 | 目录 |
|---|---|---|
| `minimax_h3_ref2va_pruned_fp8_scaled` | 19.5 GB | `diffusion_models/` |
| `minimax_h3_fl2va_pruned_fp8_scaled` | 19.5 GB | `diffusion_models/` |
| `qwen3vl_32b_minimax_h3_int8_convrot` | 25.3 GB | `text_encoders/` |
| `minimax_h3_video_vae_fp16` | 4.9 GB | `vae/` |
| `minimax_h3_audio_vae_fp32` | 0.6 GB | `vae/` |
| Turbo LoRA ×2 | 3.6 GB | `loras/` |

### H3-Image 图像

| 文件 | 大小 | 目录 |
|---|---|---|
| `minimax_h3_image_pruned_w4a8` | 12.55 GB | `diffusion_models/` |
| `minimax_h3_image_vae_fp16` | 1.17 GB | `vae/` |

文本编码器**与视频共用**，不用重复下载。

> **模型目录自动探测**：插件会按 `imageModelRoot` → `comfyInputDir` 兄弟目录 → `H3_MODEL_ROOT` 环境变量 → 常见路径 → 向上搜索 的顺序找 `models` 目录，无需手工配置。

---

## 硬约束（改代码必读）

违反会直接失败：

| 约束 | 值 |
|---|---|
| H3 视频分辨率 | 必须 32 倍数 + 官方档位（864×480 / 960×544 / 1056×608 / 1344×768） |
| H3 视频帧数 | 17k+5 网格（124 / 243 / 362） |
| H3 guidance | 固定 1.0（CFG 蒸馏） |
| 视频采样步数 | Turbo LoRA 只能 4 或 8 |
| 音频 VAE | 必须 fp32（fp16 会静音） |
| H3-Image 步数 | 固定 6 |
| H3-Image guidance | 固定 1.0 |
| H3-Image 负面提示 | **不支持**，需改成正向描述 |
| 参考图上限 | Ref2VA 9 张 / H3-Image 16 张 |
| 参考文件总数 | ≤ 12（视频/音频各 ≤3，每段 2-15 秒） |

---

## 性能基线（RTX 4080 Laptop 12GB 实测）

| 任务 | 分辨率 | 耗时 | 显存 |
|---|---|---|---|
| H3 视频 5 秒 | 864×480 | 130 秒 | 11.5 GB |
| H3-Image | 2048² | 45-85 秒 | 11.4 GB |
| 立绘拆解 | 2048² | 80-90 秒 | 11.4 GB |
| 漫画单格 | 2048² | 75 秒 | 11.4 GB |
| 预演白模→成片 | 2048×1344 | 75 秒 | 11.4 GB |

12 GB 显存**不能并行**，插件内部串行执行。

---

## 测试

```powershell
cd tests
node verify-all.mjs        # 304 项全量验收（含 B-回归 106 条）
node test-image-pool.mjs   # 图片引用池 22 项
```

装机后 / 重启后验证插件是否正常加载（自动探测 DSH 端口）：

```powershell
node tests/postinstall-check.mjs
# 或显式指定：node tests/postinstall-check.mjs http://127.0.0.1:4583
```

SPA 侧：

```powershell
cd app-src
node --import ./tests/register.mjs tests/runAll.mjs   # 179 单测 + 2 跳过
npx tsc --noEmit                                     # 类型检查
```

> `verify-all.mjs` 对**可选运行时**（ffmpeg / ai-runtime）缺失时记 `SKIP` 而不是
> 假装通过 —— 看到 `SKIP` 说明对应检查没跑，不是成功。

---

## 安全设计

DSH 的 `webServer` handler 路由**不经过** DSH 的连接准入，因此插件自行实现：

- **Host 校验**：只接受 loopback
- **Origin 校验**：严格同源，跨源 403
- **写令牌**：POST/PUT/PATCH/DELETE 需 `X-JZ-Token`
- **路径穿越防护**：所有文件访问经 `safeJoin` 限制在数据目录内
- **读目录白名单**：`/luoshu/api/file` 只允许产物/素材子目录，
  `config.json` 等含密钥的运行时文件读不到
- **id 白名单**：项目/镜头/资产 id 一律正则校验后才拼进路径
- **上传类型白名单**：扩展名白名单；SVG 强制下载（`attachment` + `nosniff`），
  避免同源存储型 XSS
- **可执行路径**：不在配置白名单内，不接受外部注入
- **画布 Agent 权限位**：写/删/花钱分别授权，默认不允许花钱

---

## 许可证说明

本项目代码为原创，完整说明见 [LICENSE](LICENSE)。

运行时依赖的 MiniMax H3 与 H3-Image 模型有各自的许可：

- **H3**：MiniMax H3 Community License
- **H3-Image**：MiniMax-H3-Image Community License（**与 H3 不同**）
  - 年收入 ≤ 100 万美元且不对外提供托管服务 → 可直接使用
  - 超出 → 需向 MiniMax 申请授权

本项目**不包含**任何商业软件的代码或资产。

---

## 致谢

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) — 推理框架
- [MiniMax](https://www.minimax.io/) — H3 / H3-Image 模型
- [React Flow](https://reactflow.dev/) — 画布
