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
| 5 | 立绘拆解（三视图 + 细节锁） | ✅ 通 | ~2.5 分钟 |
| 6 | 漫画逐格出图 + SVG 拼版 | ✅ 通 | ~2.5 分钟/格 |
| 7 | 模特套图（6 张串行） | ✅ 通 | ~75 秒/张 |
| 8 | 剧本拆段（H3 工坊） | ✅ 通 | <1 秒 |
| — | **占位人偶泄漏** | ❌ **真 bug**，已修 | — |
| — | **漫画对话框写质量词** | ❌ **真 bug**，已修 | — |
| — | **显存守卫误伤连续出图** | ❌ **真 bug**，已修 | — |
| — | **失败任务永停 queued** | ❌ **真 bug**，已修 | — |
| — | **h3Length 未夹训练区间** | ❌ **真 bug**，已修 | — |

**这一轮一共在真机上抓出 8 个 bug，全部是静态断言看不出来的。**

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

## 六、立绘拆解与漫画（同批实测）

### 立绘拆解

**产物**：[`07-breakdown-三视图.png`](07-breakdown-三视图.png)（2048²，5.54 MB）

输入：一张立绘 + 服装清单（`蕾丝胸衣上身`、`百褶长裙摆`）+ 配件（`蓝色花朵发饰`）。

结果：正/侧/背**三视图**，服装细节（蕾丝边、金色纹样、红色内衬、系带长靴）逐项还原，
蓝色花朵发饰在三个视角都保持位置一致。

> 验证了「细节锁」那五条约束确实生效：没有把多层裙摆合并、没有省掉小配饰、
> 纹样没有退化成色块。

### 漫画逐格出图 ★ 抓到一个提示词 bug

**产物**：[`08-comic-panel-FIXED.png`](08-comic-panel-FIXED.png)

第一版出来的图里，**对话框写着"高质量，细节清晰"** —— 本来是质量提示词，
被模型当成台词画进了画面。

**根因**：旧提示词无条件写「留出对白空间」，但**不给台词时也不说"本格没有对白"**。
模型于是自己补一个对话框，并把提示词里剩下的文字抄进去。

**修复**（`comic-service.js`）：

| 情况 | 旧写法 | 新写法 |
|---|---|---|
| 有台词 | `情绪氛围：角色正在说话，{台词}` | `画面中{说话人}的对话框内写「{台词}」` |
| 无台词 | （留空，但前面说了"留出对白空间"） | `本格没有对白，画面中不要出现任何对话框、文字或标注` |

同时把质量词从**末尾**移到**画风之后** —— 模型对结尾同样敏感，放末尾会被当成画面要求。

修完重渲：画面干净，无对话框无文字，角色确实在"推开门"。

> 顺带修了两个相关缺陷：
> - `plan-prompts` 只返回 `plans`，调用方读的是 `parts` → 拿到 undefined。现在两个键都给。
> - `render-panels` 忽略 `panelIndices`，想重出一格会把整页全渲（5 格 × 75 秒）。
>   现在按格过滤，`queued:1 / total:1` 实测通过。

---

## 七、【真 bug】显存守卫误伤连续出图

修前面的问题时发现：**跑完一单之后，下一单必被拒**。

```text
IMAGE_VRAM_LOW: 空闲显存约 2.5 GB，该尺寸估计需要 12 GB。
```

但此时 ComfyUI 队列是空的、实际能跑 --- 它只是把模型换出了显存。

**根因**：守卫拿"该尺寸建议 12 GB"去比 `vram_free`。
而 `--lowvram` 模式下模型是**分块按需换入**的，常驻只占 2–3 GB，
`vram_free` 自然只有 2.5 GB --- 这个数字**不代表真实可用余量**。

**修复**：阈值改成"只拦真的没救的情况"：

```js
const floorGb = Math.max(1.2, totalGb * 0.12);   // 12GB 卡 → 1.44 GB
if (freeGb < floorGb) throw IMAGE_VRAM_LOW;
```

真正的 OOM 由 ComfyUI 自己报错，那条错误是准确的；插件不该抢在它前面猜。

> 这也是为什么连续出图一直"看起来能跑但总是失败"——之前的错误信息
> 很有道理，所以没人往"阈值本身错了"上想。

---

## 八、【真 bug】失败的任务永远停在 `queued`

漫画逐格、模特套图都是**内联异步循环**（不经过 `runJob`）。它们的 `catch`
只写了一条日志，**没有把 job 记录标成 failed**。

后果：
- 任务列表里永远挂着一个"排队中"的幽灵任务
- `monitor` 的 `queued` 计数永远归不了零
- 用户既看不到失败原因，也没法重试

实测复现：一次失败之后，任务卡在 `queued` 十几分钟，而 ComfyUI 队列早已为空。

**修复**：两处 `catch` 都补上 `jobsStore().upsert({ ...j, status:'failed', error, finishedAt })`。

---

## 九、h3Length 没有夹训练区间（脚本拆段踩到）

脚本拆段对"一个短节拍"会给出 4.0–4.9 秒的场景。`h3Length` 把它算成 **107 帧**
—— 在 `17k+5` 网格上，但**低于官方训练区间 124–362 帧**。

后果不是报错，而是"能动但很怪"的片子（时长太短，模型没进入稳定区）。

更麻烦的是：`store/models.js` 的 `h3Length` 与 `h3-prompt.js` 的 `h3Frames`
**各实现了一遍网格算法**，而且已经漂移了 —— 一个夹 `[5, 3600]`，一个夹 `[124, 362]`。

| 输入 | 旧 h3Length | 旧 h3Frames | 现在（统一） |
|---|---|---|---|
| 4.3 s | 107 ❌ | 124 | **124** ✅ |
| 60 s | 3575 ❌ | 362 | **362** ✅ |

**修复**：`h3Frames` 改为直接委托 `h3Length`（单一真源），两者都夹到 124–362。

**验证**：1–30 秒按 0.5 秒步长逐一比对，结果完全一致、全部在网格上、全部在区间内。
实测 4 秒镜头渲 blockout → **124 帧**（修前是 96 帧）。

---

## 十、这一轮暴露的"验证盲区"

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
| 对话框里写着"高质量，细节清晰" | ❌ |
| 显存阈值误伤连续出图 | ❌（单次跑通根本发现不了） |
| 失败任务停在 queued | ❌（要等它真的失败一次） |
| `h3Length` 落在训练区间外 | ❌（107 确实在网格上，看不出问题） |

只有**真的跑一次、真的看一眼产物、真的连续跑第二单**才能发现。
本目录就是那几次"真的跑一次"。

---

## 十一、复现

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
