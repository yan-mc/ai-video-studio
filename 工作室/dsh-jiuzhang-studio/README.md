# 九章工作室 · DSH 插件

> 本地 AI 视频工作室。节点画布 / 素材库 / 剧本·漫画·分镜 / 六个导演台 / **H3 与 Seedance 双后端**。
>
> 基于对「洛书灵枢 1.0.59」的功能学习重写 —— **不含任何商业软件代码或资产**。

---

## 安装

```powershell
# 1) 让 DSH 加载插件（在 profile 里 link 本目录）
cd $env:USERPROFILE\.dsh\profiles\desktop
# package.json 的 dependencies 里加：
#   "@local/dsh-jiuzhang-studio": "link:F:/AI视频/工作室/dsh-jiuzhang-studio"

# 2) 构建 SPA（首次或前端改动后）
cd F:\AI视频\工作室\app-src
$env:Path = 'F:\Deepseek_harness\rea-agent\runtime;' + $env:Path
npm run build
```

重启 DSH 后，左侧栏出现「九章工作室」图标。

---

## 用法

1. 点侧栏图标 → 面板显示**启动器 + 监测器**
2. 点任意入口（画布/素材库/H3 工坊…）→ **浏览器新标签页全屏打开**
3. 画布、素材、生成都在浏览器里操作

> 为什么不用 DSH 面板直接画？DSH 侧栏会挤压可用宽度，画布在浏览器全屏体验才对。
> 面板里的监测器仍会实时显示 H3 / Seedance / 预演引擎 / 任务队列状态。

---

## 架构

```
DSH Host (Electron, 127.0.0.1:随机端口)
└─ @local/dsh-jiuzhang-studio
   ├─ host/           Node ESM：工具 + REST + 子进程
   │  ├─ index.js     插件入口（tools / webServer / 生命周期）
   │  ├─ security.js  Origin 同源校验 + 写操作 token + 路径穿越防护
   │  ├─ config.js    配置白名单（**可执行路径不接受外部注入**）
   │  ├─ static.js    SPA 静态服务（Range / HEAD / ETag）
   │  ├─ api/         REST 路由（全部 /luoshu/api 前缀）
   │  ├─ services/    job-runner / comfy / seedance / previz / h3-workshop / post / assets
   │  └─ store/       原子 JSON（串行队列 + tmp+rename）
   ├─ client.js       DSH 面板（启动器 + 监测器）
   └─ app-dist/       SPA 构建产物（进仓库，clone 即用）
```

**HTTP 路由**（全部 handler 注册，绕过 DSH 准入 → 自带鉴权）：

| 路径 | 用途 |
|---|---|
| `/luoshu/api/*` | REST |
| `/luoshu/app/*` | SPA 静态 |
| `/luoshu/assets/*` | 3D 资产静态 |

---

## 工具（Agent 可调用）

| 工具 | 说明 |
|---|---|
| `studio_meta` | 档位 / H3 19 槽位 / 26 节点 / 14 资产类型 |
| `studio_config` | 配置读写（白名单） |
| `studio_project` | 项目 CRUD |
| `studio_shot` | 镜头卡 CRUD |
| `studio_prompt` | 编译 H3 提示词 + 分辨率 + 帧数 |
| `studio_generate` | 提交生成（h3-local / seedance-cloud / mock） |
| `studio_jobs` | 任务查询 / 取消（**真终止远端**） |
| `studio_h3_workshop` | 剧本 → 中性分段 + 资产提示词 |
| `studio_previz` | 3D 预演 start/stop/state/command |
| `studio_post` | ffmpeg 转码/缩放/提帧/裁剪/抽音/质检 |

---

## H3 双后端

### 本地 H3（默认，需 ComfyUI）

- 需先启动 ComfyUI（`/system_stats` 可达即视为就绪）
- 工作流模板：`data/workflows/h3.json`（13 节点，含双 VAE、Turbo LoRA、首尾帧节点）
- 分辨率严格对齐 H3 画布表（32 倍数 + latent 网格），**否则会 RuntimeError**
- 帧数按 `17k+5` 网格自动计算（5s = 124 帧）

**档位**：

| 档位 | 分辨率 | 说明 |
|---|---|---|
| `P12-draft` | 864×480 | 12G 显存草稿 |
| `P16-std` | 960×544 | 标准 |
| `P24-quality` | 1056×608 | 高质（推荐） |
| `P768-quality` | 1344×768 | 官方档（显存吃紧） |

### Seedance（云端）

- 无 API key 时自动走 **Mock**（本地 ffmpeg 生成占位视频），**全流程可测**
- 填了 key（`seedanceApiKey`）自动切真实通道
- 接口与 H3 完全一致，画布节点里一键切换

---

## H3 工坊（核心增量）

把一集剧本变成可执行的镜头表：

1. **输入**：本地目录扫描 或 粘贴文本（互不依赖）
2. **参数**：集数 / 画幅 / 目标时长(最短-最长) / 台词语言 / 画面风格 / 平台 / 标题
3. **分析** → 中性分段 + 资产提示词（角色/场景/道具/音色）+ 镜头提示词
4. **导入** → 落成资产库条目 + 镜头卡

规则引擎本地可跑，不依赖 LLM；接 LLM 后可精修。

**成片工作台**：分段视频 concat + 可选字幕烧录 → 成片。

---

## 安全设计（重要）

DSH 的 `webServer` handler 路由**不经过** DSH 的连接准入，因此本插件自行实现：

- **Host 校验**：只接受 loopback
- **Origin 校验**：严格同源，跨源 403
- **写操作 token**：`POST/PUT/PATCH/DELETE` 必须带 `X-JZ-Token`（启动时随机生成，`GET /luoshu/api/token` 领取）
- **配置白名单**：`ffmpeg` / `previzExe` 等可执行路径**不接受**来自配置或接口的注入
- **id 白名单 + safeJoin**：所有资源 id 走正则校验，路径拼接防穿越

---

## 数据目录

```
data/
├─ config.json          自动创建（可编辑）
├─ projects.json
├─ jobs.json
├─ assets-index.json
├─ shots/<projectId>/shots.json
├─ outputs/             生成的视频
├─ previz/              预演工程与帧
├─ post/                后处理产物
├─ assets/              上传的素材
└─ workflows/h3.json    H3 工作流模板
```

---

## 开发

```powershell
# 前端热更新（可选）
cd F:\AI视频\工作室\app-src
$env:Path = 'F:\Deepseek_harness\rea-agent\runtime;' + $env:Path
npm run dev

# 构建
npm run build

# Host 侧自检
cd ..\dsh-jiuzhang-studio
node _selftest.mjs       # 模块级
node _integration.mjs    # HTTP 级（25 项断言）
node _distcheck.mjs      # 构建产物可服务性
```

---

## 许可与来源

- 本项目代码：仅供学习研究
- **不含任何商业软件代码、资产包、拆解产物或模型权重**
- 功能设计参考公开官方教程与用户操作观察，实现为独立编写
- React / React Flow / three.js / ffmpeg 遵循各自许可