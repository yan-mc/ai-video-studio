# @local/dsh-ai-video-studio

DSH 本地 AI 视频工作室插件。**软件端已基本完成**：项目/镜头卡/H3 提示词编译/生成任务队列/资产包挂载/3D 预演（预演导演台）/预演像素渲染/ffmpeg 后处理/质检。H3 本地与 Seedance 云端适配器已就绪（真实调用需相应环境与 Key）。

已验证环境：DSH `0.2.2-rc.1`（host 与 web 插件均启用）。

## 安装

在 DSH 会话中：

```
plugin_manager install_bundle target=F:\AI视频\工作室\dsh-ai-video-studio
```

改动后需重载（HMR 不会重新注册工具）：

```
plugin_manager set_bundle target=@local/dsh-ai-video-studio enabled=false
plugin_manager set_bundle target=@local/dsh-ai-video-studio enabled=true
```

安装后侧栏出现「视频工作室」，主面板为**对齐预演导演台**的工作台：54px 顶栏 + 238px 分镜栏 / 中间舞台 / 320px 属性栏 + 264px 底部时间轴。

## 界面（预演导演台式布局）

| 区域 | 内容 |
|---|---|
| 顶栏 54px | 应用名 + 在线状态点 + 6 页签导航（分镜/任务/资产包/预演/后端/设置）+ 自检徽标 `10/12` + 导演台外链 + 导出预演包 + 中/EN 切换 |
| 左栏 | 分镜列表（序号方块 + 标题 + `5.0s · ref2v` 副行 + `mock · 预演` 标记）、内联新建项目/镜头、舞台元素列表、演员库/道具库（2 列按钮） |
| 中间舞台 | 16:9 容器（容器查询自适应）+ 左上 `backdrop-filter: blur(8px)` 悬浮工具条（34×32）+ 右上「导演台 / 渲染帧」分段 + 底部镜头 chip；「导演台」模式内嵌预演导演台 iframe（地址来自 `GET /previz/url`），服务未运行时落占位不白屏 |
| 右栏 | 三 tab：**属性**（基本信息/画面/声音/参考素材/关键帧/提示词 + 编译/保存/生成）、**预演**（服务开关 + 采样/长边/帧率 + 「渲染预演像素」+ first.png/last.png 缩略图 + control.mp4 播放 + 元信息）、**数据**（引擎工程/健康检查/agent_rules/shot.previz 快照） |
| 底部时间轴 `min(264px, 34vh)` | 48px 表头（时间码 + 缩放）+ 150px 标签列 + 竖网格轨道；镜头条按累加 startSec 定位、关键帧菱形、动作块、可点 ruler 定位、播放头推进 |
| 扁平页签 | 任务（列表 + 视频预览 + 质检/重试/取消）、资产包（挂载表单/校验/卸载/许可标记）、预演（内嵌导演台 + 渲染产物）、后端（健康 + 能力 + 档位）、设置（config 编辑 + 自检 + profiles） |

配色以 `--dsw-alias-*` 主题令牌为主、导演台深色值为 fallback，明暗主题均可用；样式经 `<style data-avs-style>` 单次注入并在卸载时移除。


## 配置

环境变量（或面板「设置」写入 `data/config.json`）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_VIDEO_STUDIO_HOME` | `F:\AI视频\工作室\data` | 数据目录 |
| `DSH_VIDEO_ASSET_ROOT` | `F:\AI视频\资产包` | 资产包根目录 |
| `DSH_VIDEO_COMFY_URL` | `http://127.0.0.1:8188` | ComfyUI |
| `DSH_VIDEO_SGLANG_URL` | 空 | SGLang（可选） |
| `DSH_VIDEO_SEEDANCE_URL` | 火山方舟默认 | Seedance endpoint |
| `DSH_VIDEO_SEEDANCE_MODEL` | 空 | Seedance 模型 ID |
| `DSH_VIDEO_SEEDANCE_KEY` | 空 | Seedance API Key |
| `DSH_VIDEO_FFMPEG` | `ffmpeg` | ffmpeg（缺失时 mock 使用本地样片） |
| `DSH_VIDEO_FFMPEG_DIR` | `F:\AI视频\工作室\tools\ffmpeg` | 便携 ffmpeg 目录（含 `bin\ffmpeg.exe`） |
| `DSH_VIDEO_PREVIZ_EXE` | 闭源预演引擎可执行文件（路径见配置 `previzExe`） | 闭源回退（port 服务缺失时使用） |
| `DSH_VIDEO_PREVIZ_PORT` | `4318` | 预演服务端口 |
| `DSH_VIDEO_PREVIZ_AUTOSTART` | 开（`0` 关闭） | 插件加载时自动拉起预演服务 |

## 后端

- `mock`：无需外部依赖；优先 ffmpeg 合成，缺失时复制 `工作室/assets/placeholder.mp4`。
- `h3-local`：ComfyUI；需 `data/workflows/h3.json` 工作流模板（占位符 `{{PROMPT}}/{{DURATION}}/{{FPS}}/{{STEPS}}/{{CFG}}/{{WIDTH}}/{{HEIGHT}}/{{SEED}}/{{PROFILE}}/{{RATIO}}`）。
- `seedance-cloud`：火山方舟 `POST /api/v3/contents/generations/tasks`，需 Key + 模型 ID。

生成档位（`PROFILES`）：`P12-draft`（480p/8 步）、`P16-std`（768p/16 步）、`P24-quality`（1080p/24 步）、`cloud-fallback`（Seedance）。

## 资产包

`studio_assets` 工具或面板「资产包」页：`mount(packId, root)` → 读取 `root/manifest.json` → `verify` 校验 → 任务中通过 `packId:entryId` 引用。未挂载时报 `ASSET_PACK_NOT_MOUNTED`。

`listPacks` 以清单实时条目数为准（`entries`）；若清单更新过而挂载记录未刷新，会置 `stale: true` 并保留 `cachedEntries`，重新挂载即可消除。

## 预演（预演导演台）

`services/previz/` 为闭源商业软件（内部代号 *）预演引擎的 port 版（自研实现，非闭源可执行文件）：

- `engine.mjs`（生成物）、`server.mjs`（HTTP + 静态 UI）、`tools/build-engine.mjs`（生成器）
- `web/` 托管预演导演台 UI；`web/render.html` 为自研离线渲染 harness（three.js r184 + SwiftShader）

| action | 说明 |
|---|---|
| `start` / `stop` / `health` / `state` | 服务生命周期与工程状态 |
| `command` / `tools` / `catalog` | 代理 15 个 `director_*` 工具；查看动作/运镜/演员目录 |
| `frame` | 按秒求值（相机 + 元素 + 关节） |
| `package` / `attach` | 导出首尾帧/采样帧 JSON；绑定到镜头卡 |
| `render` | **渲染真实像素**：首尾帧 PNG + 全帧序列 + 控制视频 |
| `url` | 导演台 UI 地址（默认 `http://127.0.0.1:4318/`） |

> 渲染前会清空该镜头输出目录上一批次的 `frame_*.png` / `first.png` / `last.png` / `control.mp4` / `render.json`，避免 samples 变小后残帧导致下游按通配符消费到混杂帧数。

## 工具

`studio_config`、`studio_project`、`studio_shot`、`studio_prompt`、`studio_generate`、`studio_jobs`、`studio_assets`、`studio_backend`、`studio_previz`、`studio_post`、`studio_qc` —— 共 **11 个**。

## 说明

- 资产全部外置；插件本体不含模型/3D/素材。
- 闭源预演引擎可执行文件仅作闭源回退；port 版为默认引擎。
- 来源与复用台账：见 `工作室/vendor/PROVENANCE.md`。
