# 持久化与工程数据模型（`project.json` / `history.json`）

实现：`artifacts/recovered/app_server_entry_module.js`（仓库类 `cE`、默认工程 `Oz()`、镜头工厂 `Nz()`、校验 `iQ()`）；求值器与模板数据在 `app_director_engine_module.js`。默认工程已由 Lead 运行实测确认：`analysis\dynamic\director-probe\default-project.json`（2 人物 / 4 镜头 / 15 秒 / 16:9）。

## 1. 存储

| 项 | 值 |
| --- | --- |
| 根目录 | `process.env.PREVIZ_HOME`（环境变量名为既有运行时兼容标识符，保留原样）或 `path.join(os.homedir(), ".previs-engine")`（默认目录名已中性化） |
| 工程文件 | `<root>/project.json` |
| 历史文件 | `<root>/history.json` |
| 首次读取 | 文件不存在（ENOENT）→ 用默认工程 `Oz()`，写盘后返回；动态实测：沙箱内首次 `GET /api/project` 生成 12,270 B `project.json` |
| 写盘方式 | 先写 `<path>.<pid>.tmp` 再 `rename()` 原子替换；`project.updatedAt = Date.now()` |
| 历史结构 | `{past:[{label, project, createdAt}], future:[{label, project, createdAt}]}`，`past` 最多 **50** 份完整快照 |
| 撤销/重做 | `undo()`：`past.pop()` → 当前工程进 `future` → 写回该快照；`redo()` 对称；无可撤销 → `{undone:null, message:"Nothing to undo"}` |
| 变更标签 | `"Add stage element"`, `"Update stage element"`, `"Apply action <id>"`, `"Set motion keyframe"`, `"Apply camera <id>"`, `"Set camera keyframe"`, `"add/duplicate/rename/delete/reorder shot"`, `"Lock <target>"/"Unlock <target>"`, `"Delete <target>"`, `"Create project"`（`director_select` 不入历史，`mutate(..., false)`） |
| 打开校验 | `project.version !== 1` → `Cannot open project: Unsupported project version: <v>`；变更后若出现重复元素 ID 等 → `Project mutation rejected: …` |

## 2. 工程 `Project`（version = 1）

```ts
interface Project {
  version: 1
  id: string                 // "project-<8 chars>"
  name: string               // 默认 "Untitled Previs"
  aspect: "16:9" | "9:16" | "4:3" | "1:1"
  elements: Element[]
  plans: Plan[]              // 方案层（每个方案一套镜头），默认 1 个 "Main Plan"
  activePlanId: string
  activeShotId: string
  currentFrame: number       // 全局整数帧（24fps）
  createdAt: number
  updatedAt: number
}

interface Plan {
  id: string                 // "plan-<8>"
  name: string
  summary: string            // 默认 "15 seconds, 4 shots, agent-ready 3D previs"
  createdAt: number
  shots: Shot[]
}

interface Shot {
  id: string                 // "shot-<8>"
  name: string               // "Shot 1"…
  position: Vec3             // 摄影机起始机位
  target: Vec3               // 起始注视点
  fov: number                // 起始 FOV（默认 42 或 50）
  aspect: string             // 继承 project.aspect
  createdAt: number
  startSec: number           // 由 SR() 归一化重排
  durationSec: number        // 最小 1/24 s
  cameraEnd: { position: Vec3; target: Vec3; fov: number; rollDeg?: number }
  cameraMove: string         // 最近一次套用的运镜模板 id（默认 "static"）
  elementStates: Record<elementId, { position: Vec3; rotationDeg: Vec3; scale: Vec3; visible: boolean }>
  actions: Action[]
  cameraKeyframes: CameraKeyframe[]
}

interface Element {
  id: string                 // "el-<8>"
  kind: "mannequin" | "crowd" | "box" | "sphere" | "cylinder" | "wall"
  name: string
  position: Vec3; rotationDeg: Vec3; scale: Vec3
  color: string
  visible: boolean
  groupId: string | null
  // mannequin 专有
  poseId?: string            // "stand"…（姿势库 12 种）
  joints?: Record<string, Vec3>
  heightM?: number           // 默认 1.72；preset 可给 1.9/1.25/1.05/0.55
  identitySource?: "workshop" | "temporary" | "image-analysis"
  characterId?: string       // 默认 = element id
  performanceProfileId?: "neutral"|"restrained"|"confident"|"energetic"|"nervous"|"tired"|"authoritative"|"casual"
  bodyType?: "person" | "animal"
  animalSpecies?: "small" | "quadruped"
  // crowd 专有
  rows?: number; cols?: number; spacing?: number   // 默认 crowd-3: 3×3, crowd-5: 4×5, spacing 0.8
}

interface Action {
  id: string                 // "action-<8>"
  elementId: string
  action: string             // = templateId（动作模板 58 种）
  startSec: number           // 整数帧/24
  durationSec: number
  from: Vec3; to: Vec3       // 位移区间
  templateId: string
  intensity: number          // 默认 1（0.1–3）
  emotion?: "neutral"|"tender"|"intimate"|"tense"|"joyful"|"grief"|"menacing"
  locked: boolean
  source: "agent" | "manual"
  keyframes: MotionKeyframe[]
}

interface MotionKeyframe {
  id: string                 // "kf-<8>"
  timeSec: number
  position?: Vec3
  rotationDeg?: Vec3
  joints?: Record<string, Vec3>
  pathIn?: Vec3              // 贝塞尔进入控制柄（相对位置偏移）
  pathOut?: Vec3             // 贝塞尔离开控制柄
  pathMode?: string
  interpolation: "hold"|"linear"|"smooth"|"ease-in"|"ease-out"
  locked?: boolean; source?: "agent"|"manual"; note?: string
}

interface CameraKeyframe {
  id: string                 // "ckf-<7>"
  timeSec: number
  position: Vec3; target: Vec3
  fov: number                // 5–140（工具层校验）
  rollDeg: number            // ±180
  interpolation: "hold"|"linear"|"smooth"|"ease-in"|"ease-out"
  locked?: boolean; source?: "template"|"agent"|"manual"; note?: string
}
```

通用类型 `Vec3 = {x:number, y:number, z:number}`（米）。

## 3. 默认工程（`Oz()`，与动态实测一致）

```json
{
  "version": 1, "name": "Untitled Previs", "aspect": "16:9",
  "elements": [
    {"kind":"mannequin","name":"Actor 1","position":{"x":-0.7,"y":0,"z":0},"color":"#ff7a66",
     "poseId":"stand","heightM":1.72,"identitySource":"temporary","performanceProfileId":"neutral", ...},
    {"kind":"mannequin","name":"Actor 2","position":{"x":0.7,"y":0,"z":0},"color":"#55c2ff", ...}
  ],
  "plans": [{ "name": "Main Plan", "summary": "15 seconds, 4 shots, agent-ready 3D previs",
    "shots": [
      {"name":"Shot 1","position":{"x":0,"y":2.2,"z":7.2},   "target":{"x":0,"y":1,"z":0},"fov":50,"durationSec":3.75,"cameraMove":"static","startSec":0},
      {"name":"Shot 2","position":{"x":2.6,"y":2.2,"z":6.2}, "target":{"x":0,"y":1,"z":0},"fov":42,"durationSec":3.75,"startSec":3.75},
      {"name":"Shot 3","position":{"x":0,"y":2.2,"z":7.2},   "target":{"x":0,"y":1,"z":0},"fov":50,"durationSec":3.75,"startSec":7.5},
      {"name":"Shot 4","position":{"x":2.6,"y":2.2,"z":6.2}, "target":{"x":0,"y":1,"z":0},"fov":42,"durationSec":3.75,"startSec":11.25}
    ]}],
  "activePlanId":"<plan-id>","activeShotId":"<shot-1-id>","currentFrame":0, ...
}
```
- 每镜头初始 `cameraKeyframes` = 该模板的 2 帧（0s「起始机位」/ 3.75s「结束机位」，static 时两帧相同）。
- 每镜头 `elementStates` = 创建镜头时所有元素的初始状态副本（之后可 per-shot 覆盖 = 分镜调度）。
- `startSec` 由 `SR()/reorder` 按顺序自动累加；`duration_sec` = 方案内所有镜头时长之和（默认 15s）。

## 4. 求值器（`evaluated_frame`，`Iz()`）

```
输入：plan, elements, absoluteTimeSec = currentFrame / 24
1. 定位镜头（startSec ≤ t < startSec+durationSec；超出取最后一镜）
2. localTime = clamp(t - shot.startSec, 0, durationSec)
3. 摄影机：有 cameraKeyframes → 按时间取相邻两帧插值（fov/roll 线性、位置/目标线性+缓动）；
   否则用 shot.position/target/fov → cameraEnd 按 smoothstep 插值；
   cameraMove 为 handheld/handheld-intense 时叠加 sin 抖动（0.025/0.085 m，双轴异频）
4. 元素：elementStates 提供"镜头内基线"；再按 actions 顺序应用（时间片内用关键帧插值；
   无关键帧时用 from→to smoothstep + 程序化关节动作 pl(action, progress, duration)）
5. 跨镜头连续性：dl() 用上一镜头末状态 + 该镜头 actions 推算本镜头起始姿态
输出：{shot, localTimeSec, camera:{position,target,fov,rollDeg}, elements:[{...element, 求值后 position/rotationDeg/poseId/joints}]}
```

## 5. 动作关键帧生成（`lR()`）

- 移动类动作（`v5` 集合：walk/fast-walk/run/follow/pass-by/dodge/enter-car/exit-car/step-forward/step-back）：
  采样数 `max(6, min(47, ceil(durationSec × speedFactor × 4)))`，`speedFactor` = 2.3(run/dodge)/1.8(fast-walk)/1.35(其它)；
  插值 = 首帧 ease-in、末帧 ease-out、中间 linear；note 仅首/末「起势/收势」。
- 非移动类：固定 5 个采样 `t = 0, 0.18, 0.5, 0.82, 1 × duration`，首末 ease-out、中间 smooth；note「起势/动作峰值/收势」。
- 每帧带 `position = lerp(from,to,u)`、`rotationDeg.y = 朝向`、`joints = pl(action, u, duration) × intensity × emotionAmplitude × performanceMotionScale`。

## 6. ID 生成

`l0(prefix) = prefix + "-" + nanoid(8)`；`ckf-` 用 7 位。nanoid 字符表（内嵌原文）：
`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`（64 字符，`crypto.getRandomValues` 批量取随机）。
