# 变更日志

本文件记录九章工作室插件的所有重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化版本。

---

## [1.0.0] — 2026-11-13

首个稳定版。相比早期的 P0 骨架（`dsh-ai-video-studio` v0.1.0），这是一次完整重写。

### 新增

**渲染页（主入口）**
- 三栏布局：左选素材、中预览、右参数；底部可折叠提示词编辑器
- 内嵌「成片合成」tab，可从项目镜头列表勾选并按顺序拼接
- 参考图保真档位（`match` / `max`）

**角色卡仓库**
- 四图片槽位（设定卡 / 原立绘 / 头部特写 / 额外）
- 引用策略：`sheet-first` / `sheet-only` / `origin-first` / `both`
- 项目级与镜头级两级绑定

**H3 四类参考输入**
- 参考图 ≤9、参考视频 ≤3（帧序列）、视频音轨、独立音频 ≤3
- 编号自动推算：`<Picture i>` / `<Video k>` / `<Audio j>`
- 超限裁剪有优先级（先砍场景 → 手工图 → 预演帧 → 原立绘 → 设定卡）

**媒体探测**
- ffprobe 自动识别时长、音轨、分辨率
- 上传时写回素材库；生成时补写（外部放入的文件也能补全）
- 无音轨视频不会被误接空音频槽

**3D 预演 → 白模视频**
- `/previz/video` 逐帧渲染成 mp4，可直接当参考视频
- 预演页「导出白模视频」按钮

**其他**
- 产物自动归档进素材库（`runAndArchive` / `archiveBatchOutput`）
- 显存感知的保真档位降级（不足 4G 时降级并说明原因）
- 参考视频/音频的 2–15 秒时长校验

### 修复

- **音轨丢失**：H3 是音画同步模型，工作流只接了视频 `VAEDecode`，
  音轨被整个丢弃且不报错。补 `VAELoader(audio_vae) → VAEDecodeAudio → CreateVideo.audio`。
  此前所有 H3 产物都是无声的。
- **参考图从未进模型**（7 处独立缺陷）：`comfyInputDir` 默认空导致直接返回 `{}`、
  `catch{}` 静默吞错、只建 2 个 LoadImage 却放开 9 张、AUTOGROW 用错写法等。
- **`<Audio>` 编号错位**：视频自带音轨会占用 `<Audio>` 序号，
  按"独立音频 = Audio 1"写会全错。改为后端统一算。
- **拆解提示词污染**：`normalizeImagePrompt` 会改写否定句语义；
  `一、二、三` 编号小标题会诱导模型在图上画标签（实测出过乱码）。
- **未知 backend 静默降级 mock**：产出假视频且状态 completed。改为 400 `UNKNOWN_BACKEND`。
- **`h3-image` 不在本地后端集合**：绕过并发闸门（可能 OOM）+ 取消不发 `/interrupt`。
- **`call_skill` 空壳**：改真实分发。
- **`post/scale` 对图片输出 `.mp4`**；`extractFrame` 对图片报内部 ENOENT。
- **UTF-8 文件名上传必失败**：PowerShell 把中文名编成 RFC2047，`path.extname()` 取不到。
- **端口冲突**：Hyper-V 动态保留 TCP 段导致 `WinError 10013`。
  改为启动脚本自动选端口 + 插件自发现。
- **成片合成路径解析**：`path.resolve(p)` 用进程 cwd（DSH profile 目录），
  ffmpeg 找不到文件。改为按 `dataDir` 解析。
- **`summary` 丢角色名**：`compilePrompt` 只看 `shot.subjects`，不看 `shot.characterCards`。
- **环境声/配乐被默认值覆盖**：镜头卡的 `sound`/`music` 没传给编译器。

### 变更

- 信息架构从 16 项收敛到 **13 项 / 4 组**：
  - 「H3 工坊」→ 剧本页的「剧本拆解」tab
  - 「提示词」→ 并入渲染页
  - 「3D 导演台」+「预演」→ 合并为「3D 预演」
  - 「工具箱」→ 并入设置的「工具」tab
  - 「人设卡」→ 改名「立绘拆解」
  - 新增「渲染页」与「角色卡」两个顶级入口
- 旧路由自动重定向（`h3→script`、`prompt→render`、`director→previz`、`toolbox→settings`）
- Agent 工具从 16 个收敛到 15 个（`studio_asset` 移除，素材走 REST）

### 移除

- `PromptPage.tsx`、`DirectorPage.tsx`（能力已并入渲染页与 3D 预演）
- `studio_asset` 工具（素材 API 仍在，只是不占工具名额）
- 早期骨架包 `dsh-ai-video-studio`（v0.1.0）

---

## [0.1.0] — 2026-11 之前

P0 骨架 + mock 后端。已被 1.0.0 完全取代，不再维护。
