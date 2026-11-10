# 校验规则（`director_validate` / `health`）

实现：`artifacts/recovered/app_server_entry_module.js` 的 `iQ(project)`（工程级）与 `app_director_engine_module.js` 的 `xR(plan, elements)`（镜头级，16 类）。`director_get_state`（`OJ()`）在 `health` 字段返回两部分：

```json
"health": { "project_issues": [ {…} ], "plan_issues": [ {…} ] }
```

每条 issue 结构：`{ id, severity: "error"|"warning", shotId, message }`；`message` 为中文。`director_validate` 工具 = 重新 `get_state`（把 health 交给模型判断）。

## 1. 工程级（`project_issues`，6 条规则）

| # | 规则 | id 形态 | 严重度 | 文案 |
| --- | --- | --- | --- | --- |
| 1 | 版本不匹配（`version !== 1`） | 字符串 | — | `Unsupported project version: <v>` |
| 2 | 无方案 | 字符串 | — | `Project has no plans` |
| 3 | 无舞台元素 | 字符串 | — | `Project has no stage elements` |
| 4 | 元素 ID 重复 | 字符串 | — | `Duplicate element id: <id>` |
| 5 | 方案无镜头 | 字符串 | — | `Plan <id> has no shots` |
| 6 | 动作引用不存在的元素 | 字符串 | — | `Action <id> references missing element <elementId>` |

> 注：工程级问题是**字符串**数组（不是 `{severity}` 对象）；其中版本/重复 ID 问题会阻止打开/变更（`Cannot open project` / `Project mutation rejected`），其余仅展示。

## 2. 镜头级（`plan_issues`，16 类规则）

| # | 触发条件 | id 形态 | 严重度 | 中文文案 |
| --- | --- | --- | --- | --- |
| 1 | 方案内镜头数 = 0 | `no-shots` | error | `方案里还没有镜头` |
| 2 | 镜头时长 < 0.25 s | `<shotId>-duration` | error | `<镜头名> 时长过短` |
| 3 | 起始或结束机位 `y < 0.05` | `<shotId>-ground` | error | `<镜头名> 摄影机进入地面` |
| 4 | 该镜头无可见元素 | `<shotId>-empty` | warning | `<镜头名> 没有可见主体` |
| 5 | 摄影机与任一可见元素距离 < 0.65 m | `<shotId>-<elId>-camera-collision` | error | `<镜头名> 的摄影机与「<元素名>」发生碰撞` |
| 6 | 两元素水平距离 < 0.42 m | `<shotId>-<elA>-<elB>-overlap` | warning | `<镜头名> 的「<A>」与「<B>」位置重叠` |
| 7 | 与上一镜头视线方向夹角余弦 < -0.45（`(prev.cam-target)` vs `(cur.cam-target)`） | `<shotId>-axis` | warning | `<上镜> 到 <本镜> 可能发生越轴，请检查人物朝向` |
| 8 | 动作区间越出镜头时长（±0.01） | `<shotId>-<actionId>-range` | warning | `<镜头名> 的动作超出镜头时长` |
| 9 | 动作位移速度 > 6 m/s | `<shotId>-<actionId>-speed` | warning | `<镜头名> 的人物移动速度异常` |
| 10 | 移动类动作（`v5`）但位移 < 0.15 m | `<shotId>-<actionId>-no-path` | warning | `<镜头名> 的「<action>」没有设置移动路径` |
| 11 | 动作 from/to 的 y < 0 | `<shotId>-<actionId>-underground` | error | `<镜头名> 的动作路径进入地面` |
| 12 | 人物关键帧 timeSec 越出动作时长（±0.01） | `<shotId>-<actionId>-<kfId>-keyframe-range` | warning | `<镜头名> 的人物关键帧超出动作时长` |
| 13 | 摄影机关键帧 timeSec 越出镜头时长（±0.01） | `<shotId>-<ckfId>-camera-keyframe-range` | warning | `<镜头名> 的摄影机关键帧超出镜头时长` |
| 14 | 摄影机关键帧位置 `y < 0.05` | `<shotId>-<ckfId>-camera-keyframe-ground` | error | `<镜头名> 的摄影机关键帧进入地面` |
| 15 | 同一元素相邻两动作时间重叠（`next.start < prev.start+prev.duration-0.05`） | `<shotId>-<elId>-<actionId>-overlap` | error | `<镜头名> 的「<元素名>」动作时间发生重叠` |
| 16 | 同一元素相邻动作间位置跳变 > 0.8 m | `<shotId>-<elId>-<actionId>-jump` | warning | `<镜头名> 的「<元素名>」动作之间发生位置跳变` |

## 3. 设计观察

- 所有阈值是**硬编码常量**（0.25s / 0.05m / 0.65m / 0.42m / -0.45 / 6m/s / 0.15m / 0.8m / 0.05s / 0.01s），无 UI 可配置项（未观察到配置来源）。
- severity 只有 `error`/`warning` 两级；只有碰撞/入地/时长/重叠/无镜头等 `error` 会"看起来严重"，**不会阻止命令执行**（除工程版本/重复 ID 外，校验仅报告不拦截）。
- 越轴检查只用水平面视线方向，且仅对"上一镜头"；未做 180° 规则/视线匹配的完整实现（观察）。
- 速度检查用 `hypot(to-from)/duration`，不含转向/关节速度。
- 这些规则与前端"导演台"的校验 UI 共用同一 health 数据（前端另有自己的展示逻辑）。
