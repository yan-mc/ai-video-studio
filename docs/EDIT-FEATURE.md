# 视频剪辑功能 —— 实现说明

> 版本 2.15.0 · 2026-11-20
> 入口：侧栏「工具」分组 → **视频剪辑**（`#/edit`）
> Agent 工具：`studio_edit`

---

## 一、为什么不是"从插件市场搬一个现成的"

调研了 DSH 插件市场（无中央市场，只有 format 1 索引 JSON；拉取了两份索引共 9693 条），
视频相关只有 4 个，逐个评估后都不适合直接搬：

| 插件 | 结论 |
|---|---|
| **`dsh-video-editor`** v1.0.0 (MIT) | 唯一真正的多轨时间线剪辑器，但 **Windows 直接拒绝启动**：引擎 worker 启动路径上有 `if (process.platform === "win32") throw Error("POSIX only")`；还需 Google Chrome（本机只装了 Edge）；且它是完整插件（422 KB 手写 client bundle 自己注册 DSH slot），不是可内嵌库。 |
| `dsh-ffmpeg` v0.7.20 (MIT) | 10 个 ffmpeg 工具，**但完全没有 UI**，是给 LLM 调用的。 |
| `dsh-video-clip` v0.1.1 | yt-dlp 按区间下载片段，与剪辑无关。 |
| `dsh-shortvideo-export` v0.1.5 | 短视频转写导出，与剪辑无关。 |

外部候选也不行：

- **omniclip** (MIT)：纯 ES module，靠 importmap 解析裸模块名，要 vendor fabric / @ffmpeg / wavesurfer / mp4box 全套静态资源；导出走 **ffmpeg.wasm**，需要 `SharedArrayBuffer` → COOP/COEP 响应头（Host 静态服务没设）。
- **Twick**：**SUL 许可**，禁止重新分发。
- **OpenReel**：未上 npm。

**更根本的问题**：所有浏览器视频编辑器都依赖 WebCodecs + ffmpeg.wasm，要把素材读进内存。
H3 产出是 GB 级 mp4，这条路必然 OOM。而本机有**原生 ffmpeg 9.0.2** 和 Node 24 —— 处理大文件毫无压力。

**所以决定：原生实现。** 编码解码全在 Host 侧，浏览器只负责组织片段。

---

## 二、编辑模型：有序片段列表，不是多轨时间轴

本插件的主流产出是 H3 生成的**顺序片段**（镜头 1 → 2 → 3），不是需要自由编排的素材堆。
所以模型定为：

```
素材池（左）  →  剪辑序列（中，可排序/删除/设裁剪区间）  →  输出设置 + 成片预览（右）
```

**明确不做**：多轨自由编排、拖拽吸附、逐帧预览、关键帧、调色。
理由见上：浏览器侧的硬限制。给顺序片段配一条时间轴是过度设计。

---

## 三、后端

### 3.1 文件与路由

- 服务：`host/services/edit.js`（约 790 行）
- 路由：`host/api/index.js` 里 9 条 `/edit/*`
- 工具：`host/tools.js` 的 `studio_edit`（7 个 op）
- 挂载：`host/index.js` → `attachControllers({ ..., edit })`

| 路由 | 用途 |
|---|---|
| `GET /edit/clips` | 可剪辑素材（扫 `outputs` / `assets` / `edit/outputs`）|
| `POST /edit/probe` | 时长 / 分辨率 / 帧率 / 音轨 |
| `POST /edit/trim` | 裁切 |
| `POST /edit/concat` | 拼接（自动选流复制或重编码，可带转场）|
| `POST /edit/audio` | `strip` / `volume` / `bgm` |
| `POST /edit/render` | 按工程出片 |
| `GET·POST /edit/projects` | 工程列表 / 保存 |
| `GET·POST·DELETE /edit/projects/:id` | 单工程 CRUD |

### 3.2 四个关键技术判定

**① `concat` 不能只有流复制**

`/h3/film/render` 只实现了 `-c copy`，接不同来源的片段时**静默产出花屏**。

实测确认这在本项目是真实场景 —— 现有 H3 产出的分辨率是混的：

```
job_mwngbqenhvdgr1.mp4  1472x832@24
job_mwnlz0ycikdxbw.mp4   864x480@24
job_mwnoc0wptatzv1.mp4  1056x608@24
```

现在的做法：先 ffprobe 比对全部片段，`codec / width / height / fps / 音轨存在性`
任一不同 → 自动切滤镜重编码；全同 → 才走 copy（秒级、无损）。

音轨存在性必须一起比对：不一致会导致 concat 的流映射错位。

**② `trim` 要混合 seek**

纯输入端 `-ss` 会**吸附到前一个关键帧**，起点可能差 1–2 秒。
当前实现：先粗跳到 `start-2s`（保证落在目标之前的关键帧），再输出端精确 seek 剩下的 2 秒。

**③ `xfade` 的 offset 是累计值**

`offset = 累计时长 − 已消耗重叠`。算错会得到黑帧或总时长不对 —— 这是 xfade 最常见的坑。
实现里显式维护 `running` 累计值，并拒绝"片段短于转场时长"的输入。

**④ 归一化链必须带 `setsar=1`**

手机竖拍素材常带非 1:1 的 SAR，不带会直接报
`Input link parameters do not match`。

---

## 四、前端

- 页面：`app-src/src/pages/EditPage.tsx`
- 客户端：`app-src/src/api/edit.ts`
- 样式：追加在 `app-src/src/ui/components.css`（`.jz-edit*`）

功能：加入片段、上下移动、移除、设裁剪区间、选拼接转场、选音轨模式、
出片并内联播放、另有「剪辑工程」tab 做增删查改。

**裁剪区间在前端夹到 `[0, 片长]`**：后端也会夹，但如果只靠后端，
用户输入 999 秒时界面仍显示 999，看起来像"设置没生效"。

---

## 五、接线清单（新增功能必须同步的五处）

| 位置 | 改动 |
|---|---|
| `app-src/src/router.tsx` | `ROUTES` 加 `edit` |
| `app-src/src/App.tsx` | `NAV` 加 `edit`（工具组首位）+ `RouteView` 加 `case 'edit'` |
| `client.js` | `entries` 加 `edit` |
| `app-src/src/i18n/zh.ts` | `nav.edit` + `edit.*` 文案区 |
| `app-src/src/ui/Icon.tsx` | 新增 `scissors` 图标 |

由 `tools/check-routes.mjs` 守护，现为 **14 条路由三方一致**。

**另有一处容易漏的**：`edit` 必须加进 `host/api/index.js` 里
`SERVABLE_DATA_DIRS` 白名单，否则成片能出、但 `<video>` 内联播放拿到 403，
表现为"出片成功但播放器一片空白"——最容易被误判成前端 bug 的形态。

---

## 六、验证结果

### 6.1 自动化

| 项 | 结果 |
|---|---|
| `npm test`（冒烟，真执行）| **165 / 165 通过** |
| `npm run typecheck` | 无错误 |
| `npm run check:routes` | 三方一致（14 条）|
| `pnpm build` | 成功，产物自洽 |
| `node tools/verify-edit.mjs` | **21 / 21 通过**（真实 DSH HTTP + 真实 ffmpeg）|

### 6.2 真实 ffmpeg 端到端

合成素材（640×360@30）：

| 操作 | 期望 | 实测 |
|---|---|---|
| `trim 1→3s` | 2.000s | **2.000s** |
| `concat` 硬切 5+4s | 9.000s | 9.023s |
| `concat` xfade 0.5s | 8.500s | **8.500s** |
| `audio strip` | 无音轨 | 无 audio 流 |
| `audio bgm` 替换 | 有音轨 | 有 audio 流 |
| `render` 两段+转场+BGM | 4.100s | **4.100s** |
| `render` 默认路径（不设裁剪） | 9.000s | **9.000s** |

真实 H3 产出（**三种不同分辨率**）：

| 判定 | 结果 |
|---|---|
| 分辨率不一致 → 自动 filter 重编码 | ✅ |
| 产物非花屏（ffprobe 可解析、h264）| ✅ |
| 硬切总时长 ≈ 各段之和 | ✅ |
| 同一素材自拼 → 走 copy | ✅ |
| 转场时长精确减去重叠 | ✅ |
| 真实素材裁切 / 换 BGM | ✅ |

**三镜头实拍级演示**（重启后经真实 DSH HTTP 接口跑通）：

```
输入：1472x832@24 (6.58s) + 864x480@24 (5.17s) + 1056x608@24 (5.17s)
参数：首段裁 0.5–3.5s，末段裁 0–4s，转场 0.4s，剥音轨
输出：11.375s / 1472x832 / 24fps / 5.02MB / 无音轨
期望：(3.0 + 5.167 + 4.0) − 0.4×2 = 11.367s  →  误差 0.008s
内联播放：HTTP 200, video/mp4
```

### 6.3 开发中自查发现并修掉的四个缺陷

1. **`Number(null) === 0` 让默认路径全坏**（最严重）。
   `numOrNull(v)` 原实现是 `const n = Number(v); return Number.isFinite(n) ? n : null;` ——
   但 `Number(null)`、`Number('')`、`Number(false)` 都是**有限数字 0**，
   所以"没设裁剪区间"的 `endSec: null` 被读成 `0`，`?? total` 也不回退（0 不是 nullish）。
   于是"整段"被理解成"0 到 0"，`trim` 抛 `EMPTY_RANGE`，**多段 render 直接 500**。
   影响面：这是**默认路径**（用户根本不设裁剪区间就出片），属于主流程全坏。
   修复：先判空再 `Number()`。
   验收脚本新增专项用例「render 默认路径（不设裁剪区间）」—— 原来的用例每段都显式给了
   `endSec`，恰好绕开了它，这就是为什么第一版验收 20/20 全绿却仍有这个 bug。

2. **路径穿越**：`render` 的 `name` 直接当文件名，`{name:'../../x'}` 会写到 dataDir 之外。
   已加 `sanitizeFileName`（剔除 `.`，`..` 无从构造；挡 Windows 保留名 CON/PRN/…）。
   实测 `../../escape` → `escape.mp4`，仍在 dataDir 内。

3. **首次出片必然失败**：`render({id})` 要求工程已存在，而前端主流程是
   "拼好 → 直接出片"，用户可能一次没保存过。已改为不存在就地建工程。

4. **`lastOutputRel` 静默丢失**：`saveProject` 只挑 `name/clips/audio` 三个字段，
   `render` 回写的 `lastOutputRel` 被丢弃，"记住上次成片"实际不存在。已显式接收。

另外验收脚本自身也修了两个缺陷：清理逻辑写在成功路径末尾（中途 throw 就跳过），
以及只清理返回值里的 rel（render 内部的 trim/concat/audio **中间产物**不在返回值里）。
现在改为 `finally` + 运行前目录快照 diff，只删本次新增的文件，
绝不清空目录（用户可能有自己的真实产物）。

---

## 七、已知边界

- 剪辑**只接受 `dataDir` 内的文件**（与 `film/render` 同一条安全边界）。
  外部素材需先经「素材库」上传。
- 转场只提供淡入淡出（`xfade=fade`）。其余转场 FFmpeg 支持，但未在 UI 暴露。
- 不做关键帧、调色、变速、字幕编辑界面（字幕烧录仍走 `/h3/film/render`）。
- 中间产物不自动清理，堆在 `data/edit/outputs/`（用户常要单独取用中间片段）。

---

## 八、重启后验收

新路由需要重启 DSH 才会加载（`/edit/*` 是 `/jiuzhang/api` 这个 handler 内部的分支，
HMR 不会重新解析这部分）。重启后跑：

```powershell
node tools/verify-edit.mjs
```

它做真实验证（15 项）：路由在线、造素材跑通裁切/拼接/转场/音轨/出片、
ffprobe 复核时长、`/file` 可读成片、工程 CRUD 往返，
以及两项安全检查（拒绝 dataDir 外路径、写操作无 token 被拒）。