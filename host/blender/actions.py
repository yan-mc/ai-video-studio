"""
程序化动作库 —— 关节曲线的**单一真源**。

本模块**不 import bpy**：纯数学，可以用普通 CPython 直接跑单测
（见 tests/test_actions.py），不需要启动 Blender。
`render_shot.py` 与 `dump_catalog.py` 都从这里取，从根上杜绝
「JS 白名单 / Python 实现 / 前端下拉」三份枚举互相漂移。

======================================================================
旋转轴契约（Blender 5.2.4 实测标定，改之前先重跑 tests/test_actions.py）
======================================================================

人偶骨架是 Z-up，每个关节的**链生长方向**决定了哪个轴有意义：

  向下生长的链（肩→肘→手、髋→膝）：
      rot X   前后摆。+X 朝 +Y 世界方向（也就是朝相机）
      rot Y   侧向摆。左右镜像，用 arm_lift / elbow_fold 等封装
      rot Z   **无效**。手臂沿 -Z 延长，绕 Z 只是绕自身长轴自转，
              在 depth/pose 剪影里几乎看不出变化。

      实测（肩关节 ±45°）：绕 Z 时手的世界坐标完全不动
      (0.198, 0, 0.74) → (0.198, 0, 0.74)；
      绕 X 变成 (0.198, ±0.407, 0.908)，绕 Y 变成 (±0.21, 0, 0.908)。
      历史实现把 wave / point / hug / cross-arms 全写成绕 Z，
      实测 24 帧里只有 72 个像素变化 —— 等于没动。

  向上生长的链（hips→spine→neck）：
      rot X   **−X 是前俯**（朝相机倾）。+X 是后仰。
              历史实现把 bow / pick-up 写成 +X，人是在往后仰。
      rot Y   侧倾
      rot Z   yaw（躯干扭转 / 转头）。可行，但球形头颅上纯 yaw 不可见，
              「摇头/点头」请用 neck 的 Y / X。

  根节点 root 只用于位移与 yaw（见 apply_actor_actions）。

======================================================================
动作幅度
======================================================================

所有角度都是**度数**，由 intensity × emotion_amp 统一缩放（k）。
本模块只负责"关节怎么动"，不负责"人往哪走"（那是 from/to 的活）。
"""

import math

#: 人偶骨架里可驱动的关节（与 render_shot.build_mannequin 保持一致）
JOINTS = (
    "hips", "spine", "neck",
    "shoulderL", "shoulderR", "elbowL", "elbowR",
    "hipL", "hipR", "kneeL", "kneeR",
)

AXIS_CONTRACT = (
    "downward chains (shoulder->elbow->hand, hip->knee): "
    "rot X = forward/back swing (+X toward camera), rot Y = lateral (mirrored), "
    "rot Z = INEFFECTIVE (roll about own long axis). "
    "upward chains (hips->spine->neck): rot X = -X leans forward, rot Y = side tilt, "
    "rot Z = yaw."
)


# ------------------------------------------------------------------ 数值工具

def _merge(*parts):
    """把多段关节角度按关节名相加（复合姿势：躯干 + 手臂 + 腿）。"""
    out = {}
    for part in parts:
        if not part:
            continue
        for joint, rot in part.items():
            ox, oy, oz = out.get(joint, (0.0, 0.0, 0.0))
            out[joint] = (ox + rot[0], oy + rot[1], oz + rot[2])
    return out


def _clamp01(v):
    return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)


def _ramp(u, a, b):
    """u 在 [a,b] 区间内的归一化进度，带缓动（smoothstep）。"""
    if b <= a:
        return 1.0 if u >= b else 0.0
    t = _clamp01((u - a) / (b - a))
    return t * t * (3.0 - 2.0 * t)


def _osc(u, cycles):
    """整周期数 cycles 的正弦。

    ⚠️ cycles **必须是整数**，否则 u=1 时相位不等于 u=0，循环播放会跳变
    （实测：walk 用 1.4 周期时首尾差 24.7 度，run 用 2.4 周期差 42.3 度）。
    非整数"步频"改由 durationFrames 控制，或按段重复整周期。
    """
    c = int(round(cycles))
    if c <= 0:
        c = 1
    return math.sin(u * math.pi * 2.0 * c)


# ------------------------------------------------------- 语义化的关节构造器
# 这些封装把"哪个轴、哪个正负"锁死在一处；
# 上层动作只表达"抬手 80 度"，不直接写 (0, 0, -80) 这种易错三元组。

def arm_swing(side, deg):
    """肩关节前后摆。deg > 0 = 朝相机方向摆（走路时手臂前摆）。"""
    return {f"shoulder{side}": (deg, 0.0, 0.0)}


def arm_lift(side, deg):
    """肩关节侧举 / 上举。deg > 0 = 抬起（向外再向上）。左右自动镜像。

    实测：右肩 Y=-90 时手在 (0.774, 0, 1.316)（平举），Y=-140 时到 1.757（过头）；
    左肩镜像取正。deg=170 时手基本在头顶正上方。
    """
    sign = -1.0 if side == "R" else 1.0
    return {f"shoulder{side}": (0.0, sign * deg, 0.0)}


def elbow_bend(side, deg):
    """肘关节前后屈。deg > 0 = 小臂向前收（举手、抱拳）。"""
    return {f"elbow{side}": (deg, 0.0, 0.0)}


def elbow_fold(side, deg):
    """肘关节向身体中线横折（抱臂、环抱用）。deg > 0 = 向内侧收。"""
    sign = 1.0 if side == "R" else -1.0
    return {f"elbow{side}": (0.0, sign * deg, 0.0)}


def leg_swing(side, deg):
    """髋关节前后摆。deg > 0 = 腿向前迈。"""
    return {f"hip{side}": (deg, 0.0, 0.0)}


def knee_bend(side, deg):
    """膝关节屈曲。deg > 0 = 小腿向后折（生理方向，坐下/蹲下用）。"""
    return {f"knee{side}": (-deg, 0.0, 0.0)}


def spine_bend(deg):
    """躯干前俯。deg > 0 = 向前弯（鞠躬、捡东西）。"""
    return {"spine": (-deg, 0.0, 0.0)}


def spine_back(deg):
    """躯干后仰。deg > 0 = 向后。"""
    return {"spine": (deg, 0.0, 0.0)}


def spine_tilt(deg):
    """躯干侧倾。deg > 0 = 向 +X（画面右）倾。"""
    return {"spine": (0.0, deg, 0.0)}


def spine_twist(deg):
    """躯干扭转（yaw）。deg > 0 = 向 +Y 方向转。肩线会随之变窄，剪影可见。"""
    return {"spine": (0.0, 0.0, deg)}


def neck_pitch(deg):
    """点头 / 抬头。deg > 0 = 抬头（后仰），deg < 0 = 低头。"""
    return {"neck": (deg, 0.0, 0.0)}


def neck_tilt(deg):
    """头部侧倾（球形头颅上可见，用于「摇头」的剪影表达）。"""
    return {"neck": (0.0, deg, 0.0)}


#: 根节点高度偏移的保留键。
#: 动作曲线返回的 dict 里，这个键不是关节，而是"整个人往下坐多少米"。
#: render_shot.apply_actor_actions 会把它叠加到 root.location.z 上。
ROOT_DROP_KEY = "__root_drop__"


def root_drop(meters):
    """把整个人偶沿 **Blender Z（高度）** 下移若干米。

    ⚠️ 为什么需要这个：sit / crouch / kneel 这类动作，光转髋关节是不够的 ——
       髋关节点在骨架里固定在 0.53×身高，转腿只会让腿前伸，
       屁股还悬在 0.89m，看起来像"坐在空气里"。
       实测：sit 时 hips_z 仍是 0.89，而椅面只有 0.45。
       必须同时把根节点降下来，才是真的坐下。

    degrees 语义之外再开一个"米"的量，是因为下沉量取决于椅子/地面高度，
    与关节角度无关。
    """
    return {ROOT_DROP_KEY: (-abs(float(meters)), 0.0, 0.0)}


def hips_pitch(deg):
    """整身前后翻（躺下、跌倒）。deg > 0 = 向后倒。"""
    return {"hips": (deg, 0.0, 0.0)}


# ------------------------------------------------------------------ 动作曲线
# 每个曲线签名：(u, k, dur_s) -> {关节: (rx, ry, rz)}，u∈[0,1]
# k = intensity × emotion_amp，dur_s 是动作总时长（秒）。

def _c_stand(u, k, dur_s):
    # 站立 = 不驱动关节。这是**有意为之**，不是漏实现（见 specs 的 static 标记）。
    return {}


def _c_hold_pose_placeholder(u, k, dur_s):
    """占位：仅用于说明「保持姿态类」动作不随时间变化，见 STATIC_POSE_ACTIONS。"""
    return {}


def _c_wait(u, k, dur_s):
    # 等待：极轻微的重心左右转移，避免"完全冻结"看起来像卡住
    return _merge(spine_tilt(_osc(u, 0.5) * 2.0 * k), neck_tilt(_osc(u, 0.5) * 1.5 * k))


def _c_idle_breathe(u, k, dur_s):
    cycles = max(1, int(round(float(dur_s) / 4.0)))
    breathe = _osc(u, cycles)
    return _merge(spine_bend(breathe * 1.6 * k), neck_pitch(breathe * 1.2 * k),
                  arm_lift("L", breathe * 2.0 * k), arm_lift("R", breathe * 2.0 * k))


def _c_stop(u, k, dur_s):
    # 急停：手臂略微外张维持平衡，躯干轻微后仰
    return _merge(arm_lift("L", 18 * k), arm_lift("R", 18 * k),
                  spine_back(6 * k), knee_bend("L", 12 * k), knee_bend("R", 12 * k))


def _c_turn(u, k, dur_s):
    s = _ramp(u, 0.05, 0.85)
    return _merge(spine_twist(45 * s * k), {"hips": (0.0, 0.0, 25 * s * k)},
                  neck_tilt(15 * s * k))


def _walk_like(u, k, dur_s, cycles=1.4, leg_amp=30.0, arm_amp=22.0, lean=6.0, knee_amp=42.0):
    """行走类动作的共用骨架：腿摆 + 反向臂摆 + 前倾 + 膝盖屈伸。"""
    ph = _osc(u, cycles)
    ph2 = _osc(u, cycles * 2.0)          # 双倍频：每步一次膝屈
    return _merge(
        leg_swing("L", ph * leg_amp * k),
        leg_swing("R", -ph * leg_amp * k),
        knee_bend("L", max(0.0, -ph) * knee_amp * k),
        knee_bend("R", max(0.0, ph) * knee_amp * k),
        arm_swing("L", -ph * arm_amp * k),
        arm_swing("R", ph * arm_amp * k),
        spine_bend(lean * k),
        neck_pitch(lean * 0.3 * k),
        spine_tilt(abs(ph2) * 1.5 * k),
    )


def _walk_like(u, k, dur_s, cycles=1, leg_amp=30.0, arm_amp=22.0, lean=6.0, knee_amp=42.0):
    """行走类动作的共用骨架：腿摆 + 反向臂摆 + 前倾 + 膝盖屈伸。

    cycles 必须是整数（见 _osc）；步频的差异用幅度和帧数表达，不靠小数周期。
    """
    ph = _osc(u, cycles)
    return _merge(
        leg_swing("L", ph * leg_amp * k),
        leg_swing("R", -ph * leg_amp * k),
        knee_bend("L", max(0.0, -ph) * knee_amp * k),
        knee_bend("R", max(0.0, ph) * knee_amp * k),
        arm_swing("L", -ph * arm_amp * k),
        arm_swing("R", ph * arm_amp * k),
        spine_bend(lean * k),
        neck_pitch(lean * 0.3 * k),
        spine_tilt(abs(ph) * 1.5 * k),
    )


def _c_walk(u, k, dur_s):
    # 每段至少一个完整步循环；段越长步子越多（整数周期保证首尾闭合）
    cycles = max(1, int(round(float(dur_s) * 0.5)))
    return _walk_like(u, k, dur_s, cycles=cycles)


def _c_fast_walk(u, k, dur_s):
    cycles = max(1, int(round(float(dur_s) * 0.8)))
    return _walk_like(u, k, dur_s, cycles=cycles, leg_amp=40.0, arm_amp=32.0, lean=9.0, knee_amp=52.0)


def _c_run(u, k, dur_s):
    cycles = max(1, int(round(float(dur_s) * 1.2)))
    ph = _osc(u, cycles)
    return _merge(
        leg_swing("L", ph * 52 * k), leg_swing("R", -ph * 52 * k),
        knee_bend("L", (18 + max(0.0, -ph) * 72) * k),
        knee_bend("R", (18 + max(0.0, ph) * 72) * k),
        arm_swing("L", -ph * 42 * k), arm_swing("R", ph * 42 * k),
        elbow_bend("L", 70 * k), elbow_bend("R", 70 * k),
        spine_bend(14 * k), neck_pitch(-4 * k),
    )


def _c_follow(u, k, dur_s):
    cycles = max(1, int(round(float(dur_s) * 0.45)))
    return _walk_like(u, k, dur_s, cycles=cycles, leg_amp=24.0, arm_amp=16.0, lean=4.0, knee_amp=34.0)


def _c_pass_by(u, k, dur_s):
    cycles = max(1, int(round(float(dur_s) * 0.5)))
    base = _walk_like(u, k, dur_s, cycles=cycles, leg_amp=27.0, arm_amp=20.0, lean=5.0, knee_amp=38.0)
    # 横移经过：躯干持续侧倾，配合 from/to 的横向位移
    return _merge(base, spine_tilt(10 * k * math.sin(u * math.pi)))


def _c_dodge(u, k, dur_s):
    s = math.sin(u * math.pi)
    return _merge(spine_tilt(-28 * s * k), leg_swing("L", 20 * s * k),
                  knee_bend("L", 35 * s * k), knee_bend("R", 30 * s * k),
                  arm_lift("L", 35 * s * k), arm_lift("R", 25 * s * k))


def _c_step_forward(u, k, dur_s):
    s = _ramp(u, 0.0, 0.6)
    return _merge(leg_swing("R", 32 * s * k), knee_bend("R", 20 * s * k),
                  leg_swing("L", -12 * s * k), knee_bend("L", 12 * s * k),
                  spine_bend(5 * s * k), arm_swing("L", 12 * s * k))


def _c_step_back(u, k, dur_s):
    s = _ramp(u, 0.0, 0.6)
    return _merge(leg_swing("R", -28 * s * k), knee_bend("R", 24 * s * k),
                  leg_swing("L", 10 * s * k), knee_bend("L", 10 * s * k),
                  spine_back(8 * s * k), arm_lift("L", 15 * s * k), arm_lift("R", 15 * s * k))


def _c_look_up(u, k, dur_s):
    s = _ramp(u, 0.05, 0.55)
    return _merge(neck_pitch(28 * s * k), spine_back(6 * s * k))


def _c_look_down(u, k, dur_s):
    s = _ramp(u, 0.05, 0.55)
    return _merge(neck_pitch(-30 * s * k), spine_bend(9 * s * k))


def _c_look_at(u, k, dur_s):
    s = _ramp(u, 0.05, 0.5)
    return _merge(neck_tilt(16 * s * k), spine_twist(10 * s * k), neck_pitch(2 * s * k))


def _c_look_back(u, k, dur_s):
    s = _ramp(u, 0.1, 0.7)
    return _merge(spine_twist(58 * s * k), neck_tilt(18 * s * k), spine_back(4 * s * k))


def _c_glance(u, k, dur_s):
    s = _ramp(u, 0.0, 0.25) * (1.0 - _ramp(u, 0.55, 0.9))
    return _merge(neck_tilt(24 * s * k), spine_twist(12 * s * k))


def _c_inspect(u, k, dur_s):
    s = _ramp(u, 0.05, 0.5)
    return _merge(spine_bend(22 * s * k), neck_pitch(-16 * s * k),
                  arm_swing("R", 35 * s * k), elbow_bend("R", 55 * s * k))


def _c_speak(u, k, dur_s):
    nod = _osc(u, 4.0)
    return _merge(neck_pitch(nod * 5 * k), spine_bend(3 * k),
                  arm_swing("R", 18 * k), elbow_bend("R", 40 * k),
                  elbow_fold("R", 18 * k), arm_lift("L", 6 * k))


def _c_listen(u, k, dur_s):
    s = _ramp(u, 0.1, 0.6)
    return _merge(spine_bend(5 * s * k), neck_tilt(11 * s * k), neck_pitch(4 * s * k),
                  arm_swing("L", 8 * s * k), elbow_bend("L", 25 * s * k))


def _c_nod(u, k, dur_s):
    return neck_pitch(-_osc(u, 3.0) * 17 * k)


def _c_shake_head(u, k, dur_s):
    # 球形头颅上纯 yaw 不可见，用「头部侧倾 + 躯干微扭」表达摇头
    return _merge(neck_tilt(_osc(u, 3.0) * 20 * k), spine_twist(_osc(u, 3.0) * 5 * k))


def _c_face_to_face(u, k, dur_s):
    s = _ramp(u, 0.05, 0.6)
    return _merge(spine_bend(4 * s * k), neck_pitch(-3 * s * k),
                  arm_swing("L", 14 * s * k), arm_swing("R", 14 * s * k),
                  elbow_bend("L", 20 * s * k), elbow_bend("R", 20 * s * k))


def _c_hand_over(u, k, dur_s):
    s = _ramp(u, 0.1, 0.65)
    return _merge(arm_swing("R", 58 * s * k), arm_lift("R", 22 * s * k),
                  elbow_bend("R", 48 * s * k), elbow_fold("R", 30 * s * k),
                  spine_bend(5 * s * k), neck_pitch(-6 * s * k))


def _c_receive(u, k, dur_s):
    s = _ramp(u, 0.15, 0.7)
    return _merge(arm_swing("L", 52 * s * k), arm_swing("R", 52 * s * k),
                  elbow_bend("L", 40 * s * k), elbow_bend("R", 40 * s * k),
                  arm_lift("L", 12 * s * k), arm_lift("R", 12 * s * k), spine_bend(6 * s * k))


def _c_reach(u, k, dur_s):
    s = _ramp(u, 0.05, 0.55)
    return _merge(arm_swing("R", 20 * s * k), arm_lift("R", 105 * s * k),
                  elbow_bend("R", 12 * s * k), spine_bend(4 * s * k), neck_pitch(8 * s * k))


def _c_hold(u, k, dur_s):
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_swing("L", 45 * s * k), arm_swing("R", 45 * s * k),
                  elbow_bend("L", 55 * s * k), elbow_bend("R", 55 * s * k),
                  elbow_fold("L", 25 * s * k), elbow_fold("R", 25 * s * k))


def _c_pick_up(u, k, dur_s):
    down = _ramp(u, 0.1, 0.5)
    up = _ramp(u, 0.55, 0.95)
    s = down - up
    return _merge(spine_bend(58 * s * k), neck_pitch(-22 * s * k),
                  leg_swing("L", 28 * s * k), leg_swing("R", 28 * s * k),
                  knee_bend("L", 55 * s * k), knee_bend("R", 55 * s * k),
                  arm_swing("R", 40 * s * k), elbow_bend("R", 25 * s * k))


def _c_put_down(u, k, dur_s):
    down = _ramp(u, 0.1, 0.6)
    up = _ramp(u, 0.65, 1.0)
    s = down - up
    return _merge(spine_bend(50 * s * k), neck_pitch(-18 * s * k),
                  knee_bend("L", 45 * s * k), knee_bend("R", 45 * s * k),
                  leg_swing("L", 22 * s * k), leg_swing("R", 22 * s * k),
                  arm_swing("L", 45 * s * k), arm_swing("R", 45 * s * k), elbow_bend("R", 20 * s * k))


def _c_point(u, k, dur_s):
    # ⚠️ 必须用 arm_lift（Y 轴）+ arm_swing（X 轴），不能用 Z 轴自转
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_lift("R", 82 * s * k), arm_swing("R", 30 * s * k),
                  elbow_bend("R", 10 * s * k), spine_twist(-8 * s * k), neck_tilt(-6 * s * k))


def _c_wave(u, k, dur_s):
    # 抬手到侧上方，前臂左右摆动（肘关节 Y 轴），剪影上清晰可见
    raise_ = _ramp(u, 0.0, 0.3)
    wag = _osc(u, 3.0)
    return _merge(arm_lift("R", 148 * raise_ * k), arm_swing("R", 12 * raise_ * k),
                  elbow_fold("R", 26 * raise_ * k),
                  elbow_bend("R", (55 + wag * 26) * raise_ * k),
                  neck_tilt(-5 * raise_ * k), spine_tilt(-4 * raise_ * k))


def _c_raise_hand(u, k, dur_s):
    s = _ramp(u, 0.05, 0.65)
    return _merge(arm_lift("R", 160 * s * k), elbow_bend("R", 12 * s * k),
                  spine_tilt(-4 * s * k), neck_pitch(6 * s * k))


def _c_clap(u, k, dur_s):
    s = _ramp(u, 0.1, 0.45)
    beat = _osc(u, 4.0)
    return _merge(arm_swing("L", 55 * s * k), arm_swing("R", 55 * s * k),
                  arm_lift("L", 30 * s * k), arm_lift("R", 30 * s * k),
                  elbow_bend("L", (60 + beat * 18) * s * k),
                  elbow_bend("R", (60 - beat * 18) * s * k))


def _c_knock(u, k, dur_s):
    s = _ramp(u, 0.1, 0.4)
    beat = _osc(u, 5.0)
    return _merge(arm_swing("R", (58 + beat * 14) * s * k), arm_lift("R", 18 * s * k),
                  elbow_bend("R", 45 * s * k), spine_bend(4 * s * k))


def _c_phone(u, k, dur_s):
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_lift("R", 42 * s * k), elbow_bend("R", 105 * s * k),
                  elbow_fold("R", 35 * s * k), neck_tilt(8 * s * k))


def _c_drink(u, k, dur_s):
    s = _ramp(u, 0.1, 0.45)
    tilt = _ramp(u, 0.45, 0.75)
    return _merge(arm_lift("R", 35 * s * k), elbow_bend("R", 110 * s * k),
                  elbow_fold("R", 40 * s * k), neck_pitch(26 * tilt * k))


def _c_sit(u, k, dur_s):
    # 坐下：髋前屈 90（大腿水平朝前）+ 膝屈 90（小腿竖直向下）
    # 88° 髋屈 + 88° 膝屈 让腿成"椅坐"姿势；
    # 再降 0.38m 让髋落到 0.51m（实测值），正好坐上 0.45m 的椅面。
    return _merge(leg_swing("L", 88 * k), leg_swing("R", 88 * k),
                  knee_bend("L", 88 * k), knee_bend("R", 88 * k),
                  spine_bend(6 * k), arm_swing("L", 10 * k), arm_swing("R", 10 * k),
                  root_drop(0.38))


def _c_sit_down(u, k, dur_s):
    s = _ramp(u, 0.15, 0.9)
    return _merge(leg_swing("L", 88 * s * k), leg_swing("R", 88 * s * k),
                  knee_bend("L", 88 * s * k), knee_bend("R", 88 * s * k),
                  spine_bend(14 * s * k), arm_swing("L", 18 * s * k), arm_swing("R", 18 * s * k),
                  root_drop(0.38 * s))


def _c_stand_up(u, k, dur_s):
    s = 1.0 - _ramp(u, 0.1, 0.85)
    return _merge(leg_swing("L", 88 * s * k), leg_swing("R", 88 * s * k),
                  knee_bend("L", 88 * s * k), knee_bend("R", 88 * s * k),
                  spine_bend(14 * s * k), root_drop(0.38 * s))


def _c_crouch(u, k, dur_s):
    s = _ramp(u, 0.1, 0.6)
    # 蹲：膝屈 90 但髋只屈 45，下沉量按膝屈比例给
    return _merge(leg_swing("L", 45 * s * k), leg_swing("R", 45 * s * k),
                  knee_bend("L", 90 * s * k), knee_bend("R", 90 * s * k),
                  spine_bend(28 * s * k), neck_pitch(-10 * s * k),
                  arm_swing("L", 22 * s * k), arm_swing("R", 22 * s * k),
                  root_drop(0.42 * s))


def _c_kneel(u, k, dur_s):
    s = _ramp(u, 0.1, 0.7)
    return _merge(leg_swing("R", 70 * s * k), knee_bend("R", 95 * s * k),
                  leg_swing("L", 20 * s * k), knee_bend("L", 80 * s * k),
                  spine_bend(12 * s * k), arm_swing("L", 15 * s * k),
                  root_drop(0.48 * s))


def _c_lie_down(u, k, dur_s):
    s = _ramp(u, 0.1, 0.9)
    return _merge(hips_pitch(84 * s * k), spine_bend(6 * s * k),
                  leg_swing("L", 12 * s * k), leg_swing("R", 10 * s * k))


def _c_fall(u, k, dur_s):
    s = _ramp(u, 0.05, 0.7)
    return _merge(hips_pitch(80 * s * k), spine_back(12 * s * k),
                  arm_lift("L", 70 * s * k), arm_lift("R", 70 * s * k),
                  leg_swing("L", 25 * s * k), knee_bend("L", 30 * s * k))


def _c_get_up(u, k, dur_s):
    s = 1.0 - _ramp(u, 0.15, 0.95)
    return _merge(hips_pitch(80 * s * k), spine_bend(15 * s * k),
                  leg_swing("L", 30 * s * k), knee_bend("L", 60 * s * k),
                  knee_bend("R", 55 * s * k), arm_swing("L", 40 * s * k),
                  arm_swing("R", 40 * s * k))


def _c_bow(u, k, dur_s):
    # ⚠️ 前倾必须用负 X；历史实现用的 +45 实际是在后仰
    s = math.sin(u * math.pi)
    return _merge(spine_bend(48 * s * k), neck_pitch(-14 * s * k),
                  arm_swing("L", 8 * s * k), arm_swing("R", 8 * s * k))


def _c_cross_arms(u, k, dur_s):
    # 抱臂：小臂向中线横折 + 略微前抬，靠 Y 轴而不是 Z 轴
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_swing("L", 25 * s * k), arm_swing("R", 25 * s * k),
                  arm_lift("L", 18 * s * k), arm_lift("R", 18 * s * k),
                  elbow_fold("L", 78 * s * k), elbow_fold("R", 78 * s * k),
                  elbow_bend("L", 30 * s * k), elbow_bend("R", 30 * s * k))


def _c_hands_on_hips(u, k, dur_s):
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_lift("L", 42 * s * k), arm_lift("R", 42 * s * k),
                  elbow_fold("L", 85 * s * k), elbow_fold("R", 85 * s * k),
                  elbow_bend("L", 20 * s * k), elbow_bend("R", 20 * s * k),
                  spine_back(3 * s * k))


def _c_hesitate(u, k, dur_s):
    sway = _osc(u, 1.5)
    return _merge(spine_tilt(sway * 7 * k), neck_tilt(-sway * 6 * k),
                  arm_swing("L", 10 * k), arm_swing("R", 12 * k),
                  elbow_bend("L", 25 * k), elbow_bend("R", 30 * k),
                  knee_bend("L", 8 * k))


def _c_sit_kiss(u, k, dur_s):
    """坐着亲吻：保持坐姿（含下沉），上半身转向对方、倾身靠近、手臂抬起环抱。

    这是"坐下之后"的续接姿态 —— 必须带 root_drop，否则人会突然站起来。
    """
    lean = _ramp(u, 0.10, 0.75)          # 倾身进度
    heel = _ramp(u, 0.55, 0.95)          # 后半段微微仰头
    return _merge(
        # ---- 坐姿基座（与 _c_sit 一致）----
        leg_swing("L", 88 * k), leg_swing("R", 88 * k),
        knee_bend("L", 88 * k), knee_bend("R", 88 * k),
        root_drop(0.38),
        # ---- 倾身与转头 ----
        spine_bend(12 * lean * k),
        neck_pitch((6 * lean - 4 * heel) * k),
        spine_twist(8 * lean * k),
        # ---- 手臂：抬起环抱对方 ----
        arm_swing("L", (30 + 26 * lean) * k), arm_swing("R", (30 + 26 * lean) * k),
        arm_lift("L", 22 * lean * k), arm_lift("R", 22 * lean * k),
        elbow_bend("L", (28 + 30 * lean) * k), elbow_bend("R", (28 + 30 * lean) * k),
        elbow_fold("L", 55 * lean * k), elbow_fold("R", 55 * lean * k),
    )


def _c_hug(u, k, dur_s):
    # 环抱：双臂前伸并向中线收，前臂内折
    s = _ramp(u, 0.1, 0.6)
    return _merge(arm_swing("L", 62 * s * k), arm_swing("R", 62 * s * k),
                  arm_lift("L", 26 * s * k), arm_lift("R", 26 * s * k),
                  elbow_fold("L", 62 * s * k), elbow_fold("R", 62 * s * k),
                  elbow_bend("L", 35 * s * k), elbow_bend("R", 35 * s * k),
                  spine_bend(8 * s * k), neck_pitch(-8 * s * k))


def _c_read(u, k, dur_s):
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_swing("L", 48 * s * k), arm_swing("R", 48 * s * k),
                  elbow_bend("L", 62 * s * k), elbow_bend("R", 62 * s * k),
                  elbow_fold("L", 30 * s * k), elbow_fold("R", 30 * s * k),
                  neck_pitch(-14 * s * k), spine_bend(8 * s * k))


def _c_write(u, k, dur_s):
    s = _ramp(u, 0.1, 0.45)
    hand = _osc(u, 6.0)
    return _merge(arm_swing("L", 40 * s * k), arm_swing("R", 45 * s * k),
                  elbow_bend("L", 58 * s * k), elbow_bend("R", (60 + hand * 8) * s * k),
                  elbow_fold("L", 26 * s * k), elbow_fold("R", 26 * s * k),
                  neck_pitch(-18 * s * k), spine_bend(12 * s * k))


def _c_sew(u, k, dur_s):
    s = _ramp(u, 0.1, 0.45)
    beat = _osc(u, 8.0)
    return _merge(arm_swing("L", 42 * s * k), arm_swing("R", 42 * s * k),
                  elbow_bend("L", (58 + beat * 12) * s * k),
                  elbow_bend("R", (58 - beat * 12) * s * k),
                  elbow_fold("L", 24 * s * k), elbow_fold("R", 24 * s * k),
                  neck_pitch(-16 * s * k), spine_bend(10 * s * k))


def _c_open_door(u, k, dur_s):
    push_ = _ramp(u, 0.1, 0.5)
    pull_back = _ramp(u, 0.5, 0.95)
    return _merge(arm_swing("R", 70 * push_ * k), arm_lift("R", (10 + 40 * pull_back) * k),
                  elbow_bend("R", 30 * k), spine_bend(6 * k), neck_pitch(-4 * k))


def _c_close_door(u, k, dur_s):
    pull_ = _ramp(u, 0.1, 0.7)
    return _merge(arm_swing("R", (70 - 45 * pull_) * k), arm_lift("R", (55 - 20 * pull_) * k),
                  elbow_bend("R", 30 * k), spine_bend(4 * k))


def _c_push(u, k, dur_s):
    s = _ramp(u, 0.1, 0.5)
    return _merge(arm_swing("L", 72 * s * k), arm_swing("R", 72 * s * k),
                  arm_lift("L", 14 * s * k), arm_lift("R", 14 * s * k),
                  elbow_bend("L", 22 * s * k), elbow_bend("R", 22 * s * k),
                  spine_bend(18 * s * k), leg_swing("L", 18 * s * k),
                  knee_bend("L", 22 * s * k))


def _c_pull(u, k, dur_s):
    s = _ramp(u, 0.1, 0.45)
    back = _ramp(u, 0.45, 0.9)
    return _merge(arm_swing("L", (70 - 45 * back) * s * k), arm_swing("R", (70 - 45 * back) * s * k),
                  elbow_bend("L", (25 + 55 * back) * s * k),
                  elbow_bend("R", (25 + 55 * back) * s * k),
                  spine_back(16 * back * k), leg_swing("L", 12 * s * k))


def _c_enter_car(u, k, dur_s):
    s = _ramp(u, 0.1, 0.6)
    return _merge(spine_bend(32 * s * k), neck_pitch(-12 * s * k),
                  knee_bend("L", 65 * s * k), knee_bend("R", 55 * s * k),
                  leg_swing("L", 40 * s * k), leg_swing("R", 30 * s * k),
                  arm_swing("L", 35 * s * k), arm_swing("R", 25 * s * k))


def _c_exit_car(u, k, dur_s):
    s = 1.0 - _ramp(u, 0.1, 0.8)
    return _merge(spine_bend(32 * s * k), neck_pitch(-12 * s * k),
                  knee_bend("L", 65 * s * k), knee_bend("R", 55 * s * k),
                  leg_swing("L", 40 * s * k), leg_swing("R", 30 * s * k),
                  arm_swing("L", 35 * s * k), arm_swing("R", 25 * s * k))


# ------------------------------------------------------------------ 注册表
# label 是中文显示名；group 决定前端下拉的分组；static=True 表示"有意静止"。

_SPEC = {
    # 基础
    "stand":           ("站立",     "base",      _c_stand,         "static"),
    "wait":            ("等待",     "base",      _c_wait,          "animated"),
    "idle-breathe":    ("呼吸待机", "base",      _c_idle_breathe,  "animated"),
    "stop":            ("急停",     "base",      _c_stop,          "hold"),
    "turn":            ("转身",     "base",      _c_turn,          "animated"),
    # 移动
    "walk":            ("行走",     "locomotion", _c_walk,         "animated"),
    "fast-walk":       ("快走",     "locomotion", _c_fast_walk,    "animated"),
    "run":             ("奔跑",     "locomotion", _c_run,          "animated"),
    "follow":          ("跟随",     "locomotion", _c_follow,       "animated"),
    "pass-by":         ("经过",     "locomotion", _c_pass_by,      "animated"),
    "dodge":           ("闪避",     "locomotion", _c_dodge,        "animated"),
    "step-forward":    ("上前一步", "locomotion", _c_step_forward, "animated"),
    "step-back":       ("退后一步", "locomotion", _c_step_back,    "animated"),
    # 视线
    "look-up":         ("抬头",     "gaze",      _c_look_up,       "animated"),
    "look-down":       ("低头",     "gaze",      _c_look_down,     "animated"),
    "look-at":         ("注视",     "gaze",      _c_look_at,       "animated"),
    "look-back":       ("回头看",   "gaze",      _c_look_back,     "animated"),
    "glance":          ("瞥一眼",   "gaze",      _c_glance,        "animated"),
    "inspect":         ("端详",     "gaze",      _c_inspect,      "animated"),
    # 交流
    "speak":           ("说话",     "social",    _c_speak,        "animated"),
    "listen":          ("倾听",     "social",    _c_listen,       "animated"),
    "nod":             ("点头",     "social",    _c_nod,          "animated"),
    "shake-head":      ("摇头",     "social",    _c_shake_head,   "animated"),
    "face-to-face":    ("面对面",   "social",    _c_face_to_face, "animated"),
    "hand-over":       ("递物",     "social",    _c_hand_over,    "animated"),
    "receive":         ("接物",     "social",    _c_receive,      "animated"),
    # 手部
    "reach":           ("伸手",     "hands",     _c_reach,        "animated"),
    "hold":            ("持物",     "hands",     _c_hold,         "animated"),
    "pick-up":         ("捡起",     "hands",     _c_pick_up,      "animated"),
    "put-down":        ("放下",     "hands",     _c_put_down,     "animated"),
    "point":           ("指",       "hands",     _c_point,        "animated"),
    "wave":            ("挥手",     "hands",     _c_wave,         "animated"),
    "raise-hand":      ("举手",     "hands",     _c_raise_hand,   "animated"),
    "clap":            ("鼓掌",     "hands",     _c_clap,         "animated"),
    "knock":           ("敲门",     "hands",     _c_knock,        "animated"),
    "phone":           ("打电话",   "hands",     _c_phone,        "animated"),
    "drink":           ("喝东西",   "hands",     _c_drink,        "animated"),
    # 体态
    "sit":             ("坐着",     "posture",   _c_sit,          "hold"),
    "sit-down":        ("坐下",     "posture",   _c_sit_down,     "animated"),
    "stand-up":        ("起身",     "posture",   _c_stand_up,     "animated"),
    "crouch":          ("蹲下",     "posture",   _c_crouch,       "animated"),
    "kneel":           ("单膝跪",   "posture",   _c_kneel,        "animated"),
    "lie-down":        ("躺下",     "posture",   _c_lie_down,     "animated"),
    "fall":            ("跌倒",     "posture",   _c_fall,         "animated"),
    "get-up":          ("爬起",     "posture",   _c_get_up,       "animated"),
    # 姿态语
    "bow":             ("鞠躬",     "gesture",   _c_bow,          "animated"),
    "cross-arms":      ("抱臂",     "gesture",   _c_cross_arms,   "animated"),
    "hands-on-hips":   ("叉腰",     "gesture",   _c_hands_on_hips, "animated"),
    "hesitate":        ("犹豫",     "gesture",   _c_hesitate,     "animated"),
    "hug":             ("拥抱",     "gesture",   _c_hug,          "animated"),
    "sit-kiss":        ("坐姿亲吻", "gesture",   _c_sit_kiss,     "animated"),
    # 劳作
    "read":            ("阅读",     "work",      _c_read,         "animated"),
    "write":           ("书写",     "work",      _c_write,        "animated"),
    "sew":             ("缝纫",     "work",      _c_sew,          "animated"),
    "open-door":       ("开门",     "work",      _c_open_door,    "animated"),
    "close-door":      ("关门",     "work",      _c_close_door,   "animated"),
    "push":            ("推",       "work",      _c_push,         "animated"),
    "pull":            ("拉",       "work",      _c_pull,         "animated"),
    # 载具
    "enter-car":       ("上车",     "vehicle",   _c_enter_car,    "animated"),
    "exit-car":        ("下车",     "vehicle",   _c_exit_car,     "animated"),
}

ACTION_SPECS = {
    name: {"label": label, "group": group, "curve": curve, "kind": kind}
    for name, (label, group, curve, kind) in _SPEC.items()
}

ACTION_NAMES = tuple(_SPEC.keys())

GROUP_LABELS = {
    "base": "基础",
    "locomotion": "移动",
    "gaze": "视线",
    "social": "交流",
    "hands": "手部",
    "posture": "体态",
    "gesture": "姿态语",
    "work": "劳作",
    "vehicle": "载具",
}


# ------------------------------------------------------------------ 对外接口

def is_known(action):
    return str(action or "") in ACTION_SPECS


def action_curve(action, u, duration_s=5.0, intensity=1.0, emotion_amp=1.0):
    """按归一化进度 u 求某一动作的关节角度（度）。

    未知动作返回空 dict（= 静止），**不抛异常** ——
    预演渲染不允许因为一个拼错的动作名就整镜失败。
    intensity / emotion_amp 传垃圾值时回退 1.0，同样不抛。
    """
    spec = ACTION_SPECS.get(str(action or ""))
    if spec is None:
        return {}

    def _safe_num(v, default=1.0):
        try:
            n = float(v)
        except (TypeError, ValueError):
            return default
        if not math.isfinite(n) or n <= 0.0:
            return default
        return n

    k = _safe_num(intensity) * _safe_num(emotion_amp)
    try:
        uu = float(u)
    except (TypeError, ValueError):
        uu = 0.0
    if not math.isfinite(uu):
        uu = 0.0
    try:
        dur = float(duration_s)
    except (TypeError, ValueError):
        dur = 5.0
    if not math.isfinite(dur) or dur <= 0:
        dur = 5.0
    return spec["curve"](_clamp01(uu), k, dur)


def catalog():
    """给 JS / 前端消费的清单（不含函数，可 JSON 序列化）。"""
    return {
        "version": 2,
        "axis_contract": AXIS_CONTRACT,
        "joints": list(JOINTS),
        "group_labels": GROUP_LABELS,
        "kinds": ["static", "hold", "animated"],
        "actions": [
            {
                "name": name,
                "label": spec["label"],
                "group": spec["group"],
                "groupLabel": GROUP_LABELS.get(spec["group"], spec["group"]),
                "kind": spec["kind"],
            }
            for name, spec in ACTION_SPECS.items()
        ],
    }

