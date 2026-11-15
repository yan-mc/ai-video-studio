"""
动作库单测 —— **不需要 Blender**，纯 CPython 即可运行。

    python tests/test_actions.py

覆盖三类历史缺陷（每一条都对应一次真实的线上故障）：

  1. **动作静止**：白名单收下了动作名，action_curve 却没有对应分支，
     渲染出来人站着不动且不报错。历史上 59 个动作里有 32 个是这种情况。
     这里对每个动作断言「整段动画的关节角度确有变化」。

  2. **旋转轴选错**：手臂沿 -Z 生长，rotate about Z 只是绕自身长轴自转，
     在剪影里完全不可见。wave / point / hug / cross-arms 曾经全写成绕 Z。
     这里断言「凡是表达横向/上举的关节，Y 或 X 分量必须非零」。

  3. **方向反了**：向上生长的链（hips→spine→neck），+X 是**后仰**不是前俯。
     bow / pick-up 曾经用 +X，人是在往后仰。
     这里断言「前俯类动作的 spine X 分量 <= 0」。

另外校验 catalog() 的自洽性（名字唯一、分组存在、静态项不产生角度）。
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "host", "blender"))

import actions  # noqa: E402

FAILS = []
CHECKS = [0]


def check(cond, msg):
    CHECKS[0] += 1
    if not cond:
        FAILS.append(msg)


def sample(act, n=24, dur=5.0, intensity=1.0, emotion=1.0):
    return [actions.action_curve(act, i / (n - 1), dur, intensity, emotion) for i in range(n)]


def spread(frames, joint, axis):
    vals = [f.get(joint, (0.0, 0.0, 0.0))[axis] for f in frames]
    return max(vals) - min(vals)


def max_abs(frames, joint, axis):
    return max(abs(f.get(joint, (0.0, 0.0, 0.0))[axis]) for f in frames)


# ---------------------------------------------------------------- 1. 目录自洽
cat = actions.catalog()
names = [a["name"] for a in cat["actions"]]
check(len(names) == len(set(names)), "catalog 里动作名重复")
check(len(names) == len(actions.ACTION_NAMES), "catalog 条目数与 ACTION_NAMES 不一致")
check(len(names) >= 55, f"动作数量偏少：{len(names)}")
for a in cat["actions"]:
    check(a["group"] in actions.GROUP_LABELS, f"{a['name']} 的分组 {a['group']} 未登记中文名")
    check(bool(a["label"]), f"{a['name']} 缺中文 label")

# ---------------------------------------------------------------- 2. 每个动作都要动
# 三态模型：
#   static   —— 有意静止（stand），整段零关节
#   hold     —— 保持一个恒定姿态（sit / hold / phone / stop），不能是零，也不能变
#   animated —— 随时间变化，幅度必须肉眼可见
moved, static_ok, hold_ok = [], [], []
for name in actions.ACTION_NAMES:
    spec = actions.ACTION_SPECS[name]
    frames = sample(name)
    total = sum(spread(frames, j, ax) for j in actions.JOINTS for ax in (0, 1, 2))
    level = sum(max_abs(frames, j, ax) for j in actions.JOINTS for ax in (0, 1, 2))

    if spec["kind"] == "static":
        check(total < 1e-9, f"{name} 标记为 static，但产生了 {total:.2f} 度的关节变化")
        check(level < 1e-9, f"{name} 标记为 static，但有 {level:.2f} 度的恒定角度")
        static_ok.append(name)
    elif spec["kind"] == "hold":
        check(total < 1e-6, f"{name} 标记为 hold，但角度在变化（{total:.2f} 度）—— 应保持不变")
        check(level > 20.0, f"❌ {name} 标记为 hold，但姿态幅度只有 {level:.2f} 度（等于没做动作）")
        hold_ok.append(name)
    else:
        # 阈值 3 度：低于这个量级在 864x480 的剪影里基本看不出来
        check(total > 3.0, f"❌ {name} 几乎不动（总变化 {total:.2f} 度）—— 白名单收了但曲线没实现")
        if total > 3.0:
            moved.append(name)

check(len(static_ok) <= 2, f"static 动作过多（{static_ok}），大部分动作应当有实际运动")
check(len(moved) >= len(actions.ACTION_NAMES) - 6,
      f"animated 动作只有 {len(moved)} 个，其余被误标成 static/hold")

# ---------------------------------------------------------------- 3. 轴语义
# 手臂类动作：必须用 Y（侧举/内折）或 X（前后摆），绝不能用 Z 充数
ARM_ACTIONS = {
    "wave": "R", "raise-hand": "R", "point": "R", "reach": "R",
    "hug": "L", "cross-arms": "L", "hands-on-hips": "L",
    "clap": "L", "knock": "R", "phone": "R", "drink": "R",
    "hold": "L", "hand-over": "R", "receive": "L",
    "read": "L", "write": "R", "sew": "L", "push": "L", "pull": "L",
    "open-door": "R", "close-door": "R",
}
# 判据：肩或肘在 X/Y 上必须有实质变化（Z 不计入，因为绕 Z 对 -Z 链无效）
for act, side in ARM_ACTIONS.items():
    frames = sample(act)
    shoulder_xy = max(spread(frames, f"shoulder{side}", 0), spread(frames, f"shoulder{side}", 1))
    elbow_xy = max(spread(frames, f"elbow{side}", 0), spread(frames, f"elbow{side}", 1))
    check(
        max(shoulder_xy, elbow_xy) > 8.0,
        f"❌ {act} 的 {side} 侧手臂在 X/Y 轴上几乎不动"
        f"（肩 XY={shoulder_xy:.1f} 肘 XY={elbow_xy:.1f}）—— 大概率错用了 Z 轴自转",
    )

# 横向/上举类动作：Y 分量必须显著（这是"举起来"的唯一正确轴）
LIFT_ACTIONS = {
    "wave": ("shoulderR", 120.0),
    "raise-hand": ("shoulderR", 130.0),
    "point": ("shoulderR", 60.0),
    "reach": ("shoulderR", 80.0),
    "cross-arms": ("elbowL", 60.0),
    "hands-on-hips": ("elbowL", 60.0),
    "hug": ("elbowL", 45.0),
}
for act, (joint, min_deg) in LIFT_ACTIONS.items():
    frames = sample(act)
    got = max_abs(frames, joint, 1)
    check(got >= min_deg, f"❌ {act} 的 {joint} Y 轴最大 {got:.1f} 度，期望 >= {min_deg}")

# 前俯类：spine X 必须 <= 0（负值才是朝相机倾）
BEND_ACTIONS = ["bow", "pick-up", "put-down", "crouch", "inspect", "push"]
for act in BEND_ACTIONS:
    frames = sample(act)
    lo = min(f.get("spine", (0, 0, 0))[0] for f in frames)
    hi = max(f.get("spine", (0, 0, 0))[0] for f in frames)
    check(lo <= -10.0, f"❌ {act} 的 spine X 最小值只有 {lo:.1f} —— 前俯必须用负 X，正值是后仰")
    check(hi <= 2.0, f"❌ {act} 的 spine X 最大值 {hi:.1f} 为正 —— 该动作不该后仰")

# 后仰类：必须是正 X
for act in ("fall", "step-back", "pull"):
    frames = sample(act)
    hi = max(f.get("spine", (0, 0, 0))[0] for f in frames)
    check(hi > 0.0, f"❌ {act} 应当有后仰（spine X > 0），实际最大 {hi:.1f}")

# ------------------------------------------------------- 3.5 坐/蹲/跪必须有下沉
# 髋关节点在骨架里固定在 0.53×身高，只转关节会"坐在空气里"。
SEATED = {"sit": 0.30, "sit-down": 0.25, "crouch": 0.25, "kneel": 0.30}
for act, min_drop in SEATED.items():
    frames = sample(act)
    drops = [f.get(actions.ROOT_DROP_KEY, (0.0,))[0] for f in frames]
    worst = min(drops)
    check(worst <= -min_drop,
          f"❌ {act} 的根节点下沉只有 {worst:.3f}m，至少需要 -{min_drop}m —— 否则人是悬空的")

# ---------------------------------------------------------------- 4. 数值安全
for name in actions.ACTION_NAMES:
    for u in (0.0, 0.25, 0.5, 0.75, 1.0, -1.0, 2.0):
        try:
            r = actions.action_curve(name, u, 5.0, 1.0, 1.0)
        except Exception as e:  # noqa: BLE001
            check(False, f"{name} 在 u={u} 抛异常：{e!r}")
            continue
        for j, rot in r.items():
            # ROOT_DROP_KEY 是保留键（不是关节），表示"整体下沉多少米"
            if j == actions.ROOT_DROP_KEY:
                check(rot == () or len(rot) == 3, f"{name} 的 root_drop 形状异常：{rot}")
                check(float(rot[0]) <= 0.0, f"{name} 的 root_drop 应为负值（向下）：{rot[0]}")
                continue
            check(j in actions.JOINTS, f"{name} 输出未知关节 {j}")
            check(len(rot) == 3, f"{name} 的 {j} 不是三元组")
            check(all(isinstance(v, (int, float)) and math.isfinite(v) for v in rot),
                  f"{name} 的 {j} 含非有限值：{rot}")

# 非法输入不该炸
for bad in (None, "", "no-such-action", 123, {}, []):
    try:
        r = actions.action_curve(bad, 0.5, 5.0, 1.0, 1.0)
        check(r == {}, f"未知动作 {bad!r} 应返回空 dict，实际 {r}")
    except Exception as e:  # noqa: BLE001
        check(False, f"未知动作 {bad!r} 抛异常：{e!r}")

for bad_k in (0, -1, float("nan"), float("inf"), None, "x"):
    try:
        actions.action_curve("walk", 0.5, 5.0, bad_k, 1.0)
    except Exception as e:  # noqa: BLE001
        check(False, f"intensity={bad_k!r} 抛异常：{e!r}")

# ---------------------------------------------------------------- 5. 循环动作首尾闭合
LOOPING = ["walk", "fast-walk", "run", "idle-breathe", "nod", "shake-head", "nag"]
for act in LOOPING:
    if act not in actions.ACTION_SPECS:
        continue
    a = actions.action_curve(act, 0.0, 5.0)
    b = actions.action_curve(act, 1.0, 5.0)
    worst = 0.0
    for j in set(a) | set(b):
        ra, rb = a.get(j, (0, 0, 0)), b.get(j, (0, 0, 0))
        worst = max(worst, max(abs(ra[i] - rb[i]) for i in range(3)))
    check(worst < 1e-6, f"❌ {act} 首尾不闭合（差 {worst:.4f} 度），循环播放会跳变")

# ---------------------------------------------------------------- 6. 手臂不要穿过躯干
# 举起/摆动时手不应落到对侧（|x| 反向）—— 用一个保守的姿态合理性检查
for act in ARM_ACTIONS:
    frames = sample(act, n=12)
    for f in frames:
        for side, sign in (("L", -1), ("R", 1)):
            lift = f.get(f"shoulder{side}", (0, 0, 0))[1]
            # 侧举超过 180 度会翻到对侧，属于建模错误
            check(abs(lift) <= 190.0, f"❌ {act} 的 shoulder{side} Y={lift:.1f} 超过 190 度，手臂会穿过躯干")

print(f"动作库单测：{CHECKS[0]} 项检查，{len(FAILS)} 项失败")
print(f"  动作总数 {len(names)}：animated {len(moved)} / hold {len(hold_ok)}"
      f"（{', '.join(hold_ok)}）/ static {len(static_ok)}（{', '.join(static_ok)}）")
if FAILS:
    print("\n失败详情：")
    for f in FAILS:
        print("  -", f)
    sys.exit(1)

# 供 JS 侧比对的快照
if "--dump" in sys.argv:
    print(json.dumps(cat, ensure_ascii=False, indent=2))
print("OK")
