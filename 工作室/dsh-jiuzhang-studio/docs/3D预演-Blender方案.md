# 3D 预演 · Blender 方案

> 本文说明插件里「3D 预演」子系统的架构、能力边界与关键决策。
> 是评审与新功能接入的入口文档。
>
> **旧方案已下线**：这里曾经托管一套第三方 three.js 预演引擎（六个「导演台」、
> 58 动作 / 28 运镜 / 浏览器白模）。那套东西**渲不出 depth/pose/canny**，
> 只能出 RGB，对 H3 的控制力远不如 ControlNet。相关 4 个 service、
> 20 条路由、2 个工具已于 1.3.0 全部移除。

---

## 1. 整体架构

```
镜头卡（shot JSON：actors / props / camera3d）
   ↓  buildSceneSpec()          ← 唯一坐标换算点（镜头卡 → Blender Z-up）
scene.json
   ↓  blender -b --python host/blender/render_shot.py -- <mode> <spec> <outDir>
PNG 序列 f_00000.png …
   ↓  ffmpeg（canny 额外做 edgedetect + negate）
control.mp4（depth / pose / canny / gray）     ← 喂给 H3
   ↑
preview.mp4（彩色灰模）                        ← 给人看，不进 H3
```

**为什么用 PNG 序列而不是 Blender 直接出 mp4**：Blender 的 FFmpeg 输出不可控
（编码器参数、色彩管理都会插一脚）。PNG 是"原样像素"，再由已有的 ffmpeg 链路
统一编码，与插件其它后处理保持一致。

---

## 2. 五个输出通道

| mode | 给谁看 | 实现要点 |
|---|---|---|
| `depth` | H3 | EEVEE + `ShaderNodeCameraData.View Z Depth` + MapRange（near/far 显式米制）+ Raw 视图变换 |
| `pose` | H3 | EEVEE + 纯白 Emission，**只给人偶**；地面与道具纯黑 |
| `canny` | H3 | Workbench 灰模 + ffmpeg `edgedetect` + `negate`（白底黑线） |
| `gray` | H3 | Workbench SINGLE 色 + studio 光照 |
| `preview` | **人** | Workbench MATERIAL 着色（彩色 + 阴影 + 描边） |

### 2.1 深度的三条死路（别再试）

1. `Normalize` 节点把**场景最远点**映射到 1.0 —— 地面一铺开，人物几米的深度差
   被压进不到一档灰度。
2. `world.mist_settings` + Mist pass 在 **Workbench 下不产生输出**
   （`RLayers.outputs` 里根本没有 `"Mist"`）。
3. Workbench 的 Depth 通道按**相机 clip 范围**归一化，且不完全随 `clip_start/clip_end`
   线性响应（收紧到 0.5–24 仍是"一片白"，实测值域只有 219–229 共 7 个灰阶）。

**正解**：EEVEE + `ShaderNodeCameraData.View Z Depth` + MapRange。

### 2.2 必须用 Raw 视图变换

`Standard` 会把线性深度再走一遍 sRGB 编码，值域被压到 50–90/255。
`Raw` 直接输出线性值，深度差能完整映射到 0–255。

### 2.3 Blender 5.2 合成器 API 大改

| 4.x | 5.2 现状 |
|---|---|
| `scene.node_tree` | `scene.compositing_node_group`（需先 `bpy.data.node_groups.new(type="CompositorNodeTree")`） |
| `CompositorNodeComposite` | 不存在 → `NodeGroupOutput` + `group.interface.new_socket(...)` |
| `CompositorNodeMapRange` | 不存在 |
| `CompositorNodeColorRamp` | 不存在 |

---

## 3. 坐标系（最容易错的地方）

```
镜头卡 / 预演引擎： (x, y=高度, z=深度)   ← 参考产品约定
Blender：           (x, y=深度, z=高度)   ← Z-up
```

`toBlenderVec()` 是**唯一**换算点，演员、道具、机位**全部**走它。

实测踩过两次：

| 事故 | 原因 |
|---|---|
| **人偶躺平** | 照抄 `(x, y=高度, z)` 喂 Blender，身高长在深度轴上，渲染只剩几个球 |
| **整张图全黑** | 机位没换算，相机落在人物反侧 |

---

## 4. 人偶与动作

11 关节层级（hips / spine / neck / shoulder{L,R} / elbow{L,R} / hip{L,R} / knee{L,R}），
胶囊 + 球拼装，身高归一。

动作由 `action_curve()` 程序化生成（`Math.sin` 组合的关节曲线），目标是让
depth/pose 带上可信的**运动节奏**，不是解剖级正确。

支持 58 种动作名（walk / run / sit / hug / fall / bow …），完整清单见
`host/store/models.js` 的 `ACTIONS` 白名单。

### 4.1 导入外部模型（glb / gltf / fbx / obj）

```python
def import_model(path):      # 三种 Blender io 操作符
def fit_imported(objs, target_height, origin):
    # 按包围盒高度归一化 —— Mixamo/Sketchfab 单位五花八门（cm/inch/无单位）
    # ⚠️ 只重挂顶层对象，保住骨架父子关系，否则动画断掉
def apply_fbx_action(objs, action_name):
    # Mixamo 的 Action 必须显式挂 animation_data.action，且要设 action_slot
```

失败降级：导入失败 → 退回程序化人偶，打 `ASSET_FIT_FAIL` 日志，不炸整镜。

### 4.2 动作名探测

Mixamo 导出的 Action 名是 `Armature|Armature|walk` 或 `mixamo.com`，用户猜不到。
`host/blender/list_actions.py` **真的启一次 Blender** 把名字读出来（1—3 秒），
前端选中模型后自动加载动作列表。

---

## 5. 页面职责（`#/previz`）

| 能力 | 实现 |
|---|---|
| **看** | 渲 `preview`（彩色灰模），页面直接 `<video>` 播放。72 帧 **4 秒** |
| **渲** | depth / pose / canny / gray 四通道，返回 `rel` 可直接填进 `shot.control.videoRel` |
| **改** | `POST /blender/open` 用桌面 Blender 打开渲染时保存的 `.blend` |

### 5.1 为什么不做内嵌 WASM Blender

浏览器里跑 WASM Blender（如 `@knervous/blender-web`，66.7 MB）需要
**COOP/COEP 跨源隔离头** —— 会影响整个 SPA 的跨源资源；12 GB 笔记本上的
编辑流畅度未验证；且它与「打开原生 Blender」功能重叠。

**当前决策**：页面负责"看"与"渲"，桌面 Blender 负责"改"。

---

## 6. 性能（实测，RTX 4080 Laptop 12 GB）

| 任务 | 分辨率 | 耗时 |
|---|---|---|
| depth 124 帧 | 864×480 | **20.7 秒** |
| pose 124 帧 | 864×480 | **20.8 秒** |
| preview 72 帧 | 864×480 | **4 秒** |
| H3 单镜（含控制） | 864×480 | 217–259 秒 |

Blender 占比 **< 10%**，不构成瓶颈。

---

## 7. 许可证边界

| 内容 | 许可 | 说明 |
|---|---|---|
| Blender 本体 | GPL-2.0-or-later | **子进程调用**（`blender -b --python`），不作为库链接 |
| `host/blender/*.py` | **GPL-3.0-or-later** | 它们 `import bpy`，属 Blender 衍生脚本 |
| 插件本体（JS 侧） | 保持现有许可 | 与 Blender 只通过命令行/文件通信 |
| 产出的 .blend / 渲染图 / mp4 | **完全归用户** | GPL 不传染产出物 |

`tests/verify-all.mjs` 有断言专门锁住"必须是 `-b --python` 子进程"，
防止有人改成 addon 形态后把整个插件拖进 GPL。

---

## 8. 接入新动作 / 新资产

### 加一个程序化动作

1. 在 `host/blender/render_shot.py` 的 `action_curve()` 里加分支
2. 在 `host/store/models.js` 的 `ACTIONS` 白名单里加名字
3. 在 `app-src/src/pages/RenderPage.tsx` 的 `ACTOR_ACTIONS` 里加同一名字
   （三处必须一致，否则前端能选、后端静默改成 `stand`）

### 加一个外部模型

放进 `<dataDir>/assets/3d/` 或 `<dataDir>/assets/`，页面「3D 走位」的
「模型」下拉会自动列出（`.glb/.gltf/.fbx/.obj`）。

---

## 9. 相关文件

| 文件 | 作用 |
|---|---|
| `host/blender/render_shot.py` | 场景构建 + 五通道渲染（GPL-3.0-or-later） |
| `host/blender/list_actions.py` | 动作名探测（GPL-3.0-or-later） |
| `host/services/blender-service.js` | 定位 / 场景 spec / 渲染调度 / 资产库 / 动作探测 |
| `host/store/models.js` | `normalizeActors/Props/Camera3d`、`ACTIONS` 白名单 |
| `app-src/src/pages/PrevizPage.tsx` | 预演页（预览 + 通道渲染 + 打开 Blender） |
| `app-src/src/pages/RenderPage.tsx` | 渲染页的「3D 走位」面板 |
| `docs/probes/blender-previz-2026-11-14/` | 实施报告 + 审查 + 三段实机纪实 |
