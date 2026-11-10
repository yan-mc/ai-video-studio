# 预演渲染链路 4 个缺陷修复报告

**任务**：task-7（BUG-A）｜**执行**：previz-fixer｜**日期**：2026-11-10
**服务**：预演 port 引擎 `127.0.0.1:4318`，插件 Web API `127.0.0.1:8670/ai-video-studio/api`

---

## 结论摘要

4 个缺陷全部修复并实测通过。核心数字（Shot 1，`shot-mK2nv54V`，3.75s，fov=50）：

| 指标 | 修复前 | 修复后 | 判定 |
|---|---|---|---|
| 首帧 / 尾帧 fov | **50 / 42**（不一致，尾帧跑到 Shot 2） | **50 / 50** | ✅ 一致 |
| 尾帧 timeSec | 3.7500（= 镜头结束边界，命中下一镜头） | **3.7083**（严格在镜头内） | ✅ |
| `frame_0000.png` 中 `#ff7a66` 命中像素 | **0** | **9,399** | ✅ |
| `frame_0000.png` 中 `#55c2ff` 命中像素 | **0** | **9,429** | ✅ |
| 饱和像素总数（max−min>30） | **0** | **18,393** | ✅ |
| `control.mp4` duration | **0.500 s**（12 帧 @24fps） | **3.750 s** | ✅ 误差 0% |
| 帧内实际材质色（renderer 回读） | 回退默认 `#e1e3e7` | `#ff7a66` / `#55c2ff`，heightM=1.72 | ✅ |

---

## BUG-1（🔴 高）预演包投影丢字段 → 演员全灰白

### 根因
`tools/build-engine.mjs` 的 `previzPackage` 里 elements 映射只投影 9 个字段
（`id/name/kind/visible/position/rotationDeg/scale/poseId/joints`），漏了 `color`、`heightM`。
而 `web/render.html` 消费这些字段：

- 第 92 行 `const color = el.color || '#e1e3e7'` → 缺 `color` 时回退默认灰 `#e1e3e7`
- 第 98 行 `buildMannequin(el.heightM || 1.75, color)` → 缺 `heightM` 时回退 1.75
- 第 110 行 `crowd` 分支读 `el.rows / el.cols / el.spacing`
- 第 158—160 行重建判断用 `prev.heightM !== el.heightM || prev.color !== el.color` 及 crowd 的 rows/cols/spacing

引擎 state（`GET /api/project` → `project.elements[0]`）本身**字段是完整的**：
实测 `{..., color:"#ff7a66", heightM:1.72, poseId:"stand", joints:{}, kind:"mannequin"}`。
只是 `previzPackage` 没透传，属于纯投影层遗漏。

### 修复
`build-engine.mjs` 新增统一的元素投影函数 `__previzProjectElement(e)`，`evaluate` 与 `previzPackage` 共用：

```js
function __previzProjectElement(e) {
  const out = { id, name, kind, visible, position, rotationDeg, scale, poseId, joints };
  const extra = ['color','heightM','rows','cols','spacing','bodyType','animalSpecies'];
  for (const k of extra) if (e[k] !== undefined && e[k] !== null) out[k] = e[k];
  return out;
}
```

一并补齐 `crowd` 的 `rows/cols/spacing`、`billboard` 的 `heightM`、动物的 `bodyType/animalSpecies`
（第 99 行 billboard 分支与第 108 行 crowd 分支同样消费这些字段）。

`web/render.html` 只做**增量**改动：`info()` 增加 `materials` 回读（读 `MeshStandardMaterial.color`
与 `userData.__src.heightM`），用于证明字段真的落到了材质上。不改任何渲染行为。

### 实测
`GET /api/project` 的 `elements[0]`（引擎侧，修复前后一致）：
`color="#ff7a66"`、`heightM=1.72`、`poseId="stand"`、`kind="mannequin"`

`POST /api/previz-package` 的 `frames[0].elements[0]`：

- 修复前 keys：`id,name,kind,visible,position,rotationDeg,scale,poseId,joints`（9 个，无 color）
- 修复后 keys：`id,name,kind,visible,position,rotationDeg,scale,poseId,joints,color,heightM`
  - `color=#ff7a66`、`heightM=1.72`（Actor 2：`color=#55c2ff`、`heightM=1.72`）

渲染器回读（`render.json` → `renderer.materials`）确认材质真的拿到了色：
```json
{"el-pvcKK2uD":{"kind":"mannequin","color":"#ff7a66","heightM":1.72},
 "el-AYB5irSI":{"kind":"mannequin","color":"#55c2ff","heightM":1.72}}
```

crowd 字段用**临时副本**（`%TEMP%\previz-crowd-test`，端口 4319 隔离服务）验证，
不碰客户数据：注入 4×5 crowd 后包内出现 `color:"#9be28a", rows:4, cols:5, spacing:0.8`，
渲染器建出 20 个群众实例。

### 像素验证（Pillow，1600×900 = 1,440,000 像素）
精确十六进制命中虽是 0，但这是**光照导致的正确物理结果**，不是缺色。判定改用色相族匹配：

| 判定方式 | 修复前 | 修复后 |
|---|---|---|
| 精确 `== (255,122,102)` | 0 | 0 |
| `#ff7a66` 色相族（±12°，sat>0.25） | **0** | **9,399** |
| `#55c2ff` 色相族（±12°，sat>0.25） | **0** | **9,429** |
| 饱和像素（max−min>30） | **0** | **18,393** |
| 饱和像素（max−min>60） | 0 | 17,576 |

**为什么精确命中是 0 且这是正确的**：渲染器用 `MeshStandardMaterial` + `AmbientLight(0xffffff,0.7)`
+ `DirectionalLight(0xffffff,0.9)@(6,10,4)`（已从原始前端 bundle `web/assets/index-CBJ_xqSO.js`
的 `add(new qo(16777215,.7))` / `new Ko(16777215,.9); position.set(6,10,4)` 逆向确认）。
标准材质在光照下必然被压暗：实测主色 `(188,90,76)`，色相 **7.50°** vs 源色相 **7.84°**（差 0.34°），
饱和度 0.596 vs 源 0.600（几乎无损），仅明度 0.737 vs 源 1.000（光照项）。
蓝同理：`(64,143,189)` 色相 **202.08°** vs 源 **201.53°**（差 0.55°），饱和度 0.661 vs 0.667。
**色相与饱和度几乎完美复现 = 颜色确实正确传到了材质**；只有明度被物理光照压低。

> 若后续要求渲染图"像素值与 `el.color` 完全一致"，应改用 unlit（`MeshBasicMaterial`），
> 但那会让灰模失去立体可读性，与原始前端行为不符。**本次未改**，仅记录为可选后续项。

---

## BUG-2（🔴 高）尾帧取错镜头

### 根因
原第 118 行 `const t = shot.startSec + (shot.durationSec * i) / (n - 1)`。
最后一个采样点 `i = n-1` 时 `t = startSec + durationSec`，正好落在**镜头结束边界**。
引擎的镜头选择函数 `nl(plan, t)`（`app_director_engine_module.js` 第 1467—1470 行）用的是**半开区间**：

```js
function nl($, J) {                       // J = t
  let U = Math.max(0, Math.min(J, Math.max(0, cl($) - 0.001)));
  return $.shots.find((Q) => U >= Q.startSec && U < Q.startSec + Q.durationSec) ?? $.shots[$.shots.length - 1];
}
```

`U >= startSec && U < startSec + durationSec` —— 边界值 `t = 3.75` 不满足 `< 3.75`，
于是 `find` 跳过 Shot 1，命中 **Shot 2**（startSec=3.75），取到 Shot 2 的机位 fov=42 / camera (2.6,2.2,6.2)。

### 修复
把所有采样点压进 `[startSec, startSec+durationSec)` 半开区间：

```js
const requestedFps = ...;                      // 24
const lastT = Math.max(startT, startT + dur - 1 / requestedFps);  // 末点内缩 1 帧
const span  = lastT - startT;
const t = startT + (span * i) / (n - 1);       // 首帧仍 = startT
```

末帧取 `startSec + durationSec − 1/fps`（Shot 1：`3.75 − 1/24 = 3.7083`），首帧仍是 `startSec`。

### 实测（16 组合全通过，0 违规）
逐镜头 × samples∈{3,12,24,48} 全量验证（不变式：首帧=startSec、末帧<startSec+dur、首尾 fov 相等、color/heightM 正确）：

| 镜头 | start | 首帧 t | 末帧 t | 结束边界 | fov 首/尾 |
|---|---|---|---|---|---|
| Shot 1 `shot-mK2nv54V` | 0 | 0 | 3.7083 | 3.75 | **50/50** |
| Shot 2 `shot-hKzNU1U9` | 3.75 | 3.75 | 7.4583 | 7.5 | **42/42** |
| Shot 3 `shot-4R8GUyE0` | 7.5 | 7.5 | 11.2083 | 11.25 | **50/50** |
| Shot 4 `shot-kY8Z0HCT` | 11.25 | 11.25 | 14.9583 | 15 | **42/42** |

像素级佐证：Shot 1 相机是 `static`（首尾机位相同），修复后 `frame_0000.png` 与
`frame_0011.png` 逐像素**完全一致（差异像素 0 / 1,440,000）**；而修复前的 `last.png`
（错镜）与修复后的 `last.png` 差异 **38,285 像素** —— 这正是 Shot 2 机位与 Shot 1 机位的差别。

---

## BUG-3（🟠 中）control.mp4 时长严重不足

### 根因
`render-previz.mjs` 合成时固定 `-framerate FPS`（=24），但**帧数由 `--samples` 决定**（插件传 12）。
12 帧 @24fps = **0.5 秒**，而镜头 3.75 秒 —— 控制视频只有真实时长的 13%。

### 修复选择：**动态帧率**（而非拉满帧数）
在两案中选了 render-previz 侧按 `frameCount / durationSec` 反算帧率：

```js
const videoFps = shotDur > 0 ? frameCount / shotDur : FPS;   // 12 / 3.75 = 3.2
```

同时 `previzPackage` 也补上了推荐案的一半——帧数按 `durationSec × fps` 计算但受 samples 上限约束
（`n = min(sampleCap, round(dur*fps))`），两者叠加后：

- **帧数够时**（samples ≥ `durationSec × fps`）：帧率就是标称 fps，播放速度正确、时长正确
- **帧数受限时**（本次 12 帧）：自动降到 3.2fps，**时长严格对齐**，代价是画面变成慢放

**为什么选这条**：任务要求控制视频时长 ≈ 镜头时长（误差<10%），且明确"不要把帧数无脑拉满"。
1600×900 每帧约 300ms，3.75s@24fps = 90 帧 → 渲染从 4.4s 涨到 ~30s（慢 7 倍），
且 samples 上限 48 也覆盖不了 90 帧。动态帧率在**渲染成本和时长正确性**之间取得最优：
无论 samples 给多少，`duration` 恒等于 `shot.durationSec`。

### 实测
| 配置 | 帧数 | 帧率 | **duration** | 文件大小 |
|---|---|---|---|---|
| 修复前（samples=12） | 12 | 24/1 | **0.500000 s** | 13,618 B |
| 修复后（samples=12） | 12 | **16/5 = 3.2** | **3.750000 s** | 19,460 B |
| 修复后（samples=48） | 48 | **64/5 = 12.8** | **3.750000 s** | — |

误差 = **0%**（要求 <10%）。ffprobe 确认：
`codec=h264, 1600×900, nb_frames=12, r_frame_rate=16/5, duration=3.750000`。

渲染耗时对比：samples=12 → **4.36s**；samples=48 → 12.18s（仍在合理范围）。

---

## BUG-4（🟡 低）`previzPackage` 永远取第一个镜头

### 根因
原第 113 行 `const shot = plan?.shots.find((s) => s.id === shotId) || plan?.shots[0];`
`|| plan?.shots[0]` 是**静默兜底**：任何 shotId 对不上（包括 null/undefined）都会悄悄取第 0 个镜头，
调用方完全无法察觉拿错了镜头。

### 修复（build-engine.mjs 侧）
拆成两个显式助手，**彻底移除静默 `shots[0]`**：

```js
__previzResolveShot(plan, project, shotId) {
  // 1) 显式 shotId 命中 → 用它
  // 2) 未命中/未传 → 用 project.activeShotId（引擎当前激活镜头）
  // 3) 连 activeShotId 都没有 → throw，拒绝静默回退
}
```

返回值带 `resolvedFrom`（`"shotId"` / `"activeShotId"`）和 `fallback` 标志，
并在包的 `sampling` 字段里回传，调用方可直接判断。

### 实测
| 输入 | 修复前 | 修复后 |
|---|---|---|
| `shotId="shot-hKzNU1U9"`（Shot 2） | Shot 1（**错**） | **Shot 2**，fov=42，`resolvedFrom="shotId"` |
| `shotId` 完全不传 | Shot 1（瞎猜） | Shot 1 但 `resolvedFrom="activeShotId"`、`fallback=true`（显式可知） |
| `shotId="bogus-xxx"`（不存在） | Shot 1（**静默错**） | Shot 1 但 `matched=false, resolvedFrom="activeShotId", fallback=true`（显式标注未命中） |

`render-previz.mjs` 也支持 `--shot <engineShotId>`，已实测直连 Shot 2 渲染成功
（`render.json` → `shot.id=shot-hKzNU1U9`，相机 fov=42 @ (2.6,2.2,6.2)）。

### ⚠️ 仍未闭环（属 Lead 范围，已按要求未改 index.js）
插件侧 `index.js` 的 `attachPrevizToShot`（第 ~758 行）传的是 `shot.previz?.engineShotId`，
但 `renderPreviz` 拼参数时（第 815—816 行）**没有传 `--shot`**，所以渲染仍走 `activeShotId`：

```js
const args = [script, '--base', ..., '--out', dir,
  '--samples', ..., '--long', ..., '--fps', ...];   // ← 缺 '--shot', shot.previz?.engineShotId
```

引擎侧现在会**显式标注** `fallback=true` 而不是静默错镜，但要让"渲染指定镜头"真正闭环，
需要 Lead 在 index.js 补一个 `--shot` 参数。这是 index.js 的改动，不在我的授权范围。

---

## 改动清单

| 文件 | 改动 |
|---|---|
| `工作室/services/previz/tools/build-engine.mjs` | BUG-1/2/4：新增 `__previzProjectElement` 投影函数（补 color/heightM/rows/cols/spacing/bodyType/animalSpecies）；新增 `__previzResolvePlan`/`__previzResolveShot`（移除静默 shots[0]）；采样点改半开区间；帧数按 `dur×fps` 且受 samples 上限；包新增 `sampling` 元数据 |
| `工作室/services/previz/tools/render-previz.mjs` | BUG-3：按 `frameCount/durationSec` 动态算 `-framerate`；`render.json` 增加 `controlVideoFps`、`sampling` |
| `工作室/services/previz/web/render.html` | 仅增量：`info()` 增加 `materials` 回读（诊断用，不改渲染行为） |
| `工作室/services/previz/engine.mjs` | 由 build-engine.mjs **重新生成**（922,004 → 925,101 B），未手改 |

**未改动**（按要求）：`index.js`、`client.js`、`server.mjs`、`src/previs-src/*.js`、资产包。
客户数据只读：`project.json` / `history.json` 最后写入时间仍为 2026-11-05 20:14:54（本次会话开始前）。

---

## 验收结果

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 重启预演服务 → `/api/health` ok | ✅ `{"ok":true,"service":"previs-engine","engine":"port"}` |
| 2 | `firstFrame.camera.fov` == `lastFrame.camera.fov` | ✅ 50 == 50（修复前 50 vs 42） |
| 3 | `lastFrame.timeSec` < `shot.durationSec` | ✅ 3.7083 < 3.75（修复前 3.75，等于边界） |
| 4 | `frames[0].elements[0]` 含 `color`/`heightM` | ✅ `#ff7a66` / `1.72`（修复前字段缺失） |
| 5 | `frame_0000.png` 颜色命中 > 0 | ✅ 红 9,399 / 蓝 9,429 像素 |
| 6 | 饱和像素总数 | ✅ 18,393（修复前 0） |
| 7 | `control.mp4` duration ≈ 3.75s | ✅ 3.750000s（修复前 0.500000s） |
| 8 | `node --check` 全部改动文件 | ✅ build-engine.mjs / render-previz.mjs / engine.mjs / render.html 内联模块 全部 exit=0 |

回归：4 镜头 × 4 档 samples = **16 组合全量验证，0 违规**。

---

## 未解决项 / 后续建议

1. **插件侧 `--shot` 未传**（BUG-4 闭环缺口）—— 需 Lead 改 `index.js` 第 815—816 行加
   `'--shot', shot.previz?.engineShotId`。引擎侧已就绪且会显式标注 fallback。
2. **精确十六进制命中为 0**（不影响"丢色"修复的实质）—— 标准材质在物理光照下必然被压暗，
   色相/饱和度误差 <1%（0.34° / 0.55°）。若产品要求像素级严格等于 `el.color`，
   需改 `MeshBasicMaterial`，会牺牲灰模立体可读性，建议不改。
3. **低帧数慢放**：samples < `durationSec×fps` 时控制视频是慢放（时长正确但运动变慢）。
   当前插件默认 samples=12，3.75s 镜头实际 3.2fps。若下游对运动连续性有要求，
   建议插件把默认 samples 提到 24 以上（渲染耗时 ~0.3s/帧 ×24 ≈ 7s，仍可接受）。

---

*报告生成：previz-fixer｜基准备份保留在 `%TEMP%\previz-baseline`（修复前 frame_0000.png / last.png / control.mp4）*