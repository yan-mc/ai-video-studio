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
| `depth` | H3 | EEVEE + `View Z Depth` → **逆深度 1/z 归一化**（近白远黑）+ Raw 视图变换；near/far 由**场景几何包络**自动推算 |
| `pose` | H3 | EEVEE + **OpenPose COCO-18 彩色骨架**（黑底；肢体×0.6、关键点满亮度），逐帧驱动 |
| `canny` | H3 | Workbench 灰模 + ffmpeg `edgedetect`（**黑底白线**，极性对齐 cv2.Canny） |
| `gray` | H3 | Workbench SINGLE 色 + studio 光照 |
| `preview` | **人** | Workbench MATERIAL 着色（彩色 + 阴影 + 描边） |

### 2.0 三个通道的语义约定（v1.5.0 校正）

这三条曾经全部与训练分布不符 —— **流程不崩，但控制力显著偏弱**，
而且没有任何报错，属于最难发现的缺陷。

| 通道 | 训练侧事实 | 旧实现 | 现在 |
|---|---|---|---|
| canny | `cv2.Canny()` 原生 = **黑底白线**；ComfyUI `Detect Edges (Canny)` 用 kornia，实测同样黑底白线 | 多做一次 `negate` → 白底黑线（反了） | 去掉 negate；阈值从 0.06/0.18 提到 0.20/0.45（对齐 ComfyUI 的 0.4/0.8 量纲） |
| depth | 近白远黑，但分布是**逆深度 1/z 的 min-max**，不是线性米制 | `MapRange(near,far)` 线性 | 节点链手算 `(1/z - 1/far)/(1/near - 1/far)` |
| pose | **DWPose 彩色骨架**（模型卡原文 "Pose \| DWPose skeleton"） | 纯白剪影 | 按 COCO-18 limbSeq/colors 画真骨架 |

实测（本机某镜，人物 3.5–3.8m，near=3.44 far=14.7）：
```
depth 线性   → 主体落在 144–162/255，与地面糊在一起
depth 逆深度 → 主体 73–88/255，暗剪影清晰，梯度铺满全程
```

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

放进 `<dataDir>/assets/3d/`（**可以按角色建子目录**，扫描深度 2 层）、
`<dataDir>/assets/models/` 或 `<dataDir>/assets/`，
页面「3D 走位」的「模型」下拉会自动列出（`.glb/.gltf/.fbx/.obj`）。

> `assets/3d/` 与 `assets/models/` 是 Blender 直接扫盘的目录，
> **不参与「孤儿清理」判定**，不会被 `resources/clean` 误删。

---

## 10. 动作库（v1.5.0 起为单一真源）

动作名的三份枚举曾经各写各的，漂移到 **57 / 59 / 27**：

| 位置 | 数量 |
|---|---|
| 前端 `RenderPage` 下拉（手抄） | 57 |
| `host/store/models.js` 白名单（手抄） | 59 |
| `render_shot.py` 的 `action_curve` 实现 | **27** |

后果：**32 个动作「前端能选、后端收下、Blender 渲出来人站着不动」**，
而且全程没有任何报错或警告（实测 `point` / `step-forward` 完全静止）。

现在唯一真源是 **`host/blender/actions.py`**（纯 Python，不 import bpy）：

```
host/blender/actions.py
   ├── ACTION_SPECS      59 个动作（名字/中文名/分组/三态 kind/曲线函数）
   ├── catalog()         → JSON（经 GET /blender/actions/catalog 下发前端）
   ├── action_curve()    → render_shot.py 直接调用
   └── tests/test_actions.py  脱离 Blender 单测（6960 项断言）
```

`models.js` 的 `actionCatalog()` 直接**解析 actions.py** 取出名字，
不再手抄；前端从 API 取目录渲染下拉。三份枚举从结构上不可能再漂移。

### 10.1 旋转轴契约（改动作前必读）

Blender 5.2.4 实测标定，`actions.AXIS_CONTRACT` 里也写死了：

```
向下生长的链（肩→肘→手、髋→膝）：
    rot X  前后摆（+X 朝相机）
    rot Y  侧向摆（左右镜像）
    rot Z  ⚠️ 完全无效 —— 手臂沿 -Z 延长，绕 Z 只是绕自身长轴自转，
           在 depth/pose 剪影里几乎看不出来

向上生长的链（hips→spine→neck）：
    rot X  ⚠️ −X 才是前俯（朝相机倾），+X 是后仰
    rot Y  侧倾
    rot Z  yaw（躯干扭转）
```

实测数据（肩关节 ±45°）：绕 Z 时手的世界坐标**完全不动**
`(0.198, 0, 0.74) → (0.198, 0, 0.74)`；绕 X 变成 `(0.198, ±0.407, 0.908)`。
旧实现把 `wave` / `point` / `hug` / `cross-arms` 全写成绕 Z ——
24 帧里只有 72 个像素变化，等于没动。

### 10.2 三态 kind

| kind | 含义 | 例子 |
|---|---|---|
| `animated` | 随时间变化 | walk / wave / bow |
| `hold` | 保持一个**恒定非零**姿态 | sit / stop |
| `static` | 有意静止（零关节） | stand |

前端会在下拉里给后两者加标注（「定格姿态」/「静止」），
避免用户以为"选了没反应"。

### 10.3 加动作的正确姿势

1. 在 `host/blender/actions.py` 里写 `_c_xxx(u, k, dur_s)`，**只用语义化构造器**
   （`arm_lift` / `elbow_bend` / `spine_bend` …），不要手写 `(rx, ry, rz)` 三元组
2. 在 `_SPEC` 里登记 `("中文名", "分组", _c_xxx, "animated")`
3. 跑 `python tests/test_actions.py`
   —— 它会检查"是否真的动"、"是否用错轴"、"是否方向反了"
4. **不需要**改 JS / 前端：目录会自动下发

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
| `host/blender/actions.py` | **动作库唯一真源**（纯 Python，可脱离 Blender 单测） |
| `host/blender/dump_catalog.py` | 把动作清单导出成 JSON（供 JS/前端消费） |
| `tests/test_actions.py` | 动作库单测：真的动 / 轴没选错 / 方向没反 |
| `docs/3D预演-修复记录-v1.5.0.md` | v1.5.0 结构性修复的完整清单与实测数据 |
