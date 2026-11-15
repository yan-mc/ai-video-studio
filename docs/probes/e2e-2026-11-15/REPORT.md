# 端到端实机验证 · 2026-11-15

> 环境：ComfyUI **0.45.0**（`--lowvram`，127.0.0.1:8488）· RTX 4080 Laptop 12GB · Blender 5.2.4 LTS
> 目的：这一轮之前所有"验证"都是静态断言 + 模拟，**没有一次真实跑通过生成**。
> 本目录记录首次真机跑通的四项能力，以及其中暴露的一个**新的真 bug**。

---

## 〇、结论

| # | 能力 | 结果 | 耗时 |
|---|---|---|---|
| 1 | H3-Image 文生图（2048²） | ✅ 通 | ~2.5 分钟 |
| 2 | H3 视频 T2VA（124 帧 / 864×480） | ✅ 通，音画同步 | ~3 分钟 |
| 3 | Blender blockout（单角色，124 帧） | ✅ 通 | **6 秒** |
| 4 | H3 视频 Ref2VA（blockout 当参考视频） | ✅ 通，跟随走位 | ~7 分钟 |
| — | **占位人偶泄漏** | ❌ **发现真 bug**，已修 | — |

---

## 一、H3-Image 文生图

**产物**：[`01-h3image-t2i.png`](01-h3image-t2i.png)（2048×2048，4.86 MB）

提示词（本地自造画风 id `ova90s`，但**正文是英文**，符合官方 English-only 规范）：

```text
A cinematic portrait of a young woman with silver hair, 90s OVA animation style,
soft rim light, clean cel shading, pale blue background
```

结果：赛璐珞上色、硬阴影、胶片颗粒、自然人体比例 —— 画风描述确实生效。

**顺带验证的守卫**：同一接口请求 `h3-4k-sq`（4096² = 16.8 MP）被正确拒绝：

```json
{
  "error": "IMAGE_TOO_LARGE: 请求 4096×4096 = 16.8 MP，超过上限 4.3 MP；"
           "该档建议 48 GB 显存。请在设置里改「单张出图面积上限」（imageMaxMP）或选更小的尺寸。"
}
```

> 这个守卫是**本轮新增的**。修之前 12GB 卡选 4K 会直接 OOM，且错误来自 ComfyUI 内部看不懂。

---

## 二、H3 视频 T2VA（基础格式）

**产物**：[`02-h3video-t2va-grid.png`](02-h3video-t2va-grid.png)（第 0/40/80/123 帧）

编译产物（`routeFormat` 正确判定为 `base`）：

```text
integrated_multimodal_description: 90s OVA animation style. Cel animation look, high saturation
colors, hard shadows, film grain texture, natural human proportions, soft gradient blush,
thick smooth outlines. 16:9 aspect ratio. [Shot 1] A young woman with silver hair turns her
head slowly and looks at the camera in a quiet room, warm window light.

overall_soundscape: Quiet room tone, faint traffic outside

non_diegetic_music: N/A
```

**ffprobe 实测**（逐项对上硬约束）：

| 项 | 要求 | 实测 |
|---|---|---|
| 分辨率 | 32 倍数 + 官方档 | **864×480** ✅ |
| 帧数 | `17k+5` 网格 | **124** ✅ |
| 帧率 | 24 | **24/1** ✅ |
| 时长 | frames/24 | **5.1667 s** ✅ |
| 音轨 | 32kHz 立体声 | **aac / 32000 / 2ch** ✅ |

看到的动作：角色从**侧脸**（第 0 帧）转到**正视镜头**（第 123 帧）。提示词里写的
"turns her head slowly and looks at the camera" 确实被遵循。

> **这一张顺带发现一个格式瑕疵**：`16:9 aspect ratio [Shot 1]` —— 风格引导句没有
> 结尾句号，与 `[Shot 1]` 粘成一句。已修（`styleLeadSentence` 现在保证以 `.` 结尾）。

---

## 三、Blender blockout（单角色）

**产物**：[`03-blockout-single-actor.png`](03-blockout-single-actor.png)（第 60 帧）

镜头卡配置：1 个 actor（`Hero`, 1.68m, `#d94a4a`, action=`turn`），机位
`[0,1.55,-3.2] → [0,1.1,0.5]`, fov 42。

**124 帧只用 6 秒**（H3 生成要 3–7 分钟，占比 <2%）。

画面特征全部符合 blockout 规范：
- **平光**（FLAT），无方向性光
- **无阴影、无 AO、无轮廓线、无高光**
- 深色背景 + 可辨身份色（粉红人偶）
- 剪影清晰可读

**帧网格验证**：ffprobe 报 `nb_frames=124` / `r_frame_rate=24/1` / `duration=5.166667`
—— 与目标视频**完全一致**。

> 修之前 `buildSceneSpec` 写的是 `round(dur×24)` = **120 帧**，比目标短 4 帧，
> 尾部走位没人跟。本轮已改为 `h3Length(dur)`。

---

## 四、H3 视频 Ref2VA（blockout 当参考视频）★ 核心链路

**产物**：[`04-h3video-ref2va-blockout-grid.png`](04-h3video-ref2va-blockout-grid.png)

`routeFormat` 因为有参考视频，正确切到 `ref`（六段格式）：

```text
subject_definitions:
<Video 1> is the source for camera movement, blocking and motion timing.
It does not define character appearance.

summary:
The subject in a short scene. A young woman with silver hair stands by a window and
slowly turns her head toward the camera

retention_analysis:
<Video 1>: attribute_transfer - transfer motion and camera movement only;
do not copy characters or set.

detailed_description:
90s OVA animation style. …

[Shot 1] A young woman with silver hair stands by a window and slowly turns her head
toward the camera.

overall_soundscape: Quiet room tone

non_diegetic_music: N/A
```

**结果**：单角色、从背面转到正面、朝向与 blockout 的机位一致、**没有多出人偶**。
灰模被正确"翻译"成了成片风格，而不是照抄灰模。

这就是调研里说的常规路线 —— **Blender 只负责运动与空间，外观交给参考图和提示词**。
零额外模型（不需要 4.22 GB 的 control patch），单镜成本只有 Blender 的 6 秒。

---

## 五、【真 bug】占位人偶泄漏进成片

**产物**：[`05-blockout-DERIVED-two-mannequins.png`](05-blockout-DERIVED-two-mannequins.png)
与 [`06-h3video-ref2va-derived-leak.png`](06-h3video-ref2va-derived-leak.png)

### 现象

先做了一次"没有配走位"的实验：镜头卡只有一段文字描述，没有 `actors`。
Blender 按设计退回**"两人对峙"占位人偶**（`derived: true`）。

H3 把这两个占位人偶当成参考视频里的**真实主体**，于是在成片里画出了
**两个棕色人形剪影**（见 06 的下半两张）——而用户只写了一个角色的描述。

> 06 的上半两张是"两个模糊人形 + 一个转身的角色"，
> 下半两张虽然角色在转身，但那两个棕色影子的位置随镜头一起动，
> 说明它们确实被当成场景主体在跟随。

### 根因

`buildSceneSpec` 早就标了 `derived: true` 并在注释里写"上层据此提示用户"，
**但没有任何上层真的读了它**：

- `renderControl` 的返回体里没有这个字段
- REST 响应里没有
- 前端 `PrevizPage` 不看
- 生成链路也不看

所以用户拿到的是一段"渲染成功"的视频，没有任何提示说这是占位内容。

### 修复

1. `buildSceneSpec` 增加 `warnings[]`，`derived` 时给出可读警告。
2. `renderControl` 把 `derived` 与 `warnings` 一起返回。
3. `PrevizPage` 收到警告时：
   - 在错误区显示警告文字
   - 对非 preview 通道**弹确认框**：仍要用这份占位产物吗？
   - 选"取消"则从结果里移除该通道，避免误选进镜头卡
4. `BlenderRenderResult` 类型补 `derived` / `warnings`。

### 验证

配好 1 个 actor 后重渲 → `derived: false`、`warnings: []`，成片干净（见第四节）。

---

## 六、这一轮暴露的"验证盲区"

前几轮之所以认为"都修好了"，是因为验证手段只有：

- `tests/verify-all.mjs` 静态断言
- `tsc` 类型检查
- 截图确认页面能渲染

这三样都**不会发现**上面这类问题：

| 问题 | 静态断言能看到吗 |
|---|---|
| 渲染出来是纯灰（相机坐标系错） | ❌ |
| 参考视频短 4 帧 | ❌（除非读代码算） |
| 占位人偶被当成真实主体 | ❌（字段标了但没人读） |
| 提示词句子粘连 | ❌（字符串断言只查关键词） |

只有**真的跑一次、真的看一眼产物**才能发现。本目录就是那次"真的跑一次"。

---

## 七、复现

```powershell
# 1. 起 ComfyUI
cd F:\AI视频\ai-runtime
.\venv\Scripts\python.exe main.py --listen 127.0.0.1 --port 8488 --lowvram
# 等 /system_stats 返回 200

# 2. 确认插件看到它
curl http://127.0.0.1:11712/jiuzhang/api/health       # h3.ok 应为 true

# 3. 复跑各项（token 从 /jiuzhang/api/token 取）
#    H3-Image:  POST /jiuzhang/api/image/generate  {prompt, sizeId:"sq-2048"}
#    H3 视频:   POST /jiuzhang/api/generate        {projectId, shotId, backend:"h3-local"}
#    Blender:   POST /jiuzhang/api/blender/render  {mode:"blockout", projectId, shotId}
```

> H3 视频单镜 3–7 分钟（12GB 卡 + `--lowvram`），比 README 里的 130 秒慢，
> 因为那一栏是无参考素材的最快档。
