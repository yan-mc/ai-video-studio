"""
Blender 预演渲染器 —— 把镜头场景 JSON 渲成 H3 能吃的控制序列。

被 `blender -b --factory-startup --python render_shot.py -- <mode> <spec.json>` 调用。
**不使用 addon**：这里是一次性脚本，不 import 任何注册型扩展，
所以本插件（JS 侧）不必受 GPL 传染；只有这个文件本身按 GPL-3.0-or-later 释放。

输入 spec（由 host/services/blender-scene.js 生成）：
  {
    "name": "...",
    "width": 864, "height": 480, "fps": 24, "frames": 124,
    "camera": {
      "position": [x,y,z], "target": [x,y,z], "fov": 50, "rollDeg": 0,
      "keys": [ {"frame":0, ...}, {"frame":123, ...} ]      # 可选，机位关键帧
    },
    "actors": [ {"name","heightM","position":[x,y,z],"rotationDeg":y,"color":"#rrggbb",
                 "action":"walk","startFrame":0,"durationFrames":60,
                 "from":[x,y,z],"to":[x,y,z],"emotion":"neutral","intensity":1} ],
    "props":  [ {"kind":"box|cylinder|sphere|wall","position":[...],"scale":[...],"color":"#..."} ],
    "ground": true
  }

输出模式：
  depth  —— 灰度深度序列（近白远黑），对应 H3 Fun ControlNet 的 depth 条件
  pose   —— 骨架火柴人序列，对应 pose 条件
  canny  —— 硬边缘序列，对应 canny 条件
  gray   —— 灰模整体渲染，对应 gray 条件
  preview —— 给人看的彩色灰模（不走控制通道）
  blockout —— **灰模参考视频**（社区标准交付物，见下）

关于 `blockout`（常规替代方案，推荐默认）
--------------------------------------------------------------------------
社区主流做法不是"渲四条控制通道喂进控制塔"，而是：

    Blender 白模（只管运动与空间） → 一段灰模参考视频
      → H3 `MiniMaxH3ReferenceToVideo.ref_videos.ref_video_1`
      → 六段式提示词里用 `<Video 1>` 声明"只取运镜/走位/节奏"

区别：
  · depth/pose/canny/gray 是**控制塔（Fun ControlNet）**的输入，
    需要额外的 control patch 模型，且通道间会互相打架（skip 相加会过饱和）。
  · blockout 是**参考视频**，不需要额外模型，直接吃 Ref2VA。
    实测：180° 环绕用 blockout 参考 6/6 成功，纯文字 0/6 稳定。

blockout 的渲染要求（与 preview 的差别，都是有理由的）：
  · **平光 + 无阴影 + 无 AO + 无轮廓线**：任何方向性光影都会被模型
    当成"要生成的光照"，从而与提示词里的光影描述打架。
  · **可辨色（MATERIAL）而不是纯灰**：多角色时必须靠颜色区分身份
    （研究原话："an all-gray playblast has lost identity"）。
    单角色时反而建议单色，避免模型把色号当成服装配色。
  · **不高光、无景深、无运动模糊**：这些是"成片特征"，会被参考视频带进输出。
  · 帧数必须等于目标模型的帧数（H3 是 17k+5，5 秒 = 124 帧）。

产物写到 <outDir>/<mode>/f_%05d.png 与 <outDir>/<mode>/control.mp4（ffmpeg 由 JS 侧调）。
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Euler

# 动作库是**独立纯 Python 模块**（不 import bpy），JS 侧与前端都从它取清单，
# 从根上杜绝「白名单 / 实现 / 下拉」三份枚举漂移。
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import actions as jz_actions

# ----------------------------------------------------------------- 参数解析

def parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("usage: blender -b -P render_shot.py -- <mode> <spec.json> <outDir>")
    rest = argv[argv.index("--") + 1:]
    if len(rest) < 3:
        raise SystemExit("need 3 args: <mode> <spec.json> <outDir>")
    return rest[0], rest[1], rest[2]


MODE, SPEC_PATH, OUT_DIR = parse_args()

with open(SPEC_PATH, "r", encoding="utf-8") as f:
    SPEC = json.load(f)

WIDTH = int(SPEC.get("width") or 864)
HEIGHT = int(SPEC.get("height") or 480)
FPS = int(SPEC.get("fps") or 24)
FRAMES = int(SPEC.get("frames") or 124)


# ----------------------------------------------------------------- 场景清理

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.resolution_x = WIDTH
    sc.render.resolution_y = HEIGHT
    sc.render.resolution_percentage = 100
    sc.render.fps = FPS
    sc.frame_start = 0
    sc.frame_end = max(0, FRAMES - 1)
    return sc


def hex_to_rgba(h, default=(0.8, 0.8, 0.8, 1.0)):
    s = str(h or "").strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        return default
    try:
        return (int(s[0:2], 16) / 255.0, int(s[2:4], 16) / 255.0, int(s[4:6], 16) / 255.0, 1.0)
    except ValueError:
        return default


def make_material(name, color):
    """
    建一个材质，**同时**设置两套颜色。

    ⚠️ Workbench 与 EEVEE 读的不是同一个字段：
      · EEVEE（depth/pose 模式）：Principled BSDF 的 Base Color
      · Workbench（preview 模式）：material.diffuse_color（视口显示色）
    只设其中一个的后果：preview 渲出来全是灰的 —— 用户以为"颜色没生效"。
    """
    m = bpy.data.materials.new(name)
    # Workbench 的 MATERIAL 模式（preview）读这个
    m.diffuse_color = color
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.85
    return m


# ----------------------------------------------------------------- 人偶

# 关节层级：名字 → (父节点, 局部位置系数, 半径系数, 长度系数)
# 尺寸全部按身高 n 归一，与参考产品的 11 关节白模保持同构，
# 这样同一套动作语义（走/跑/挥手…）在两边的观感一致。
def build_mannequin(name, height_m, color):
    n = float(height_m or 1.72)
    mat = make_material(f"{name}_mat", hex_to_rgba(color))
    root = bpy.data.objects.new(name, None)      # Empty 作根
    bpy.context.collection.objects.link(root)

    joints = {}

    def joint(jname, parent, x, y, z):
        e = bpy.data.objects.new(f"{name}_{jname}", None)
        e.empty_display_size = 0.05
        e.parent = parent
        e.location = (x, y, z)
        bpy.context.collection.objects.link(e)
        joints[jname] = e
        return e

    def limb(jname, parent, radius, length, offset_z=0.0):
        """在关节处挂一段胶囊形肢体（用圆柱+两端球近似）"""
        me = bpy.data.meshes.new(f"{name}_{jname}_mesh")
        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm, cap_ends=True, segments=8,
            radius1=radius, radius2=radius * 0.85, depth=length,
        )
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"{name}_{jname}_limb", me)
        ob.data.materials.append(mat)
        ob.parent = parent
        ob.location = (0, 0, -length / 2 + offset_z)   # 从关节向下长
        bpy.context.collection.objects.link(ob)
        return ob

    def blob(jname, parent, radius, sx=1.0, sy=1.0, sz=1.0):
        me = bpy.data.meshes.new(f"{name}_{jname}_mesh")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=radius)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"{name}_{jname}", me)
        ob.data.materials.append(mat)
        ob.parent = parent
        ob.scale = (sx, sy, sz)
        bpy.context.collection.objects.link(ob)
        return ob

    # 髋 → 脊柱 → 颈 → 头
    # ⚠️ Blender 坐标系：+Z 是上方向，+Y 是"进入屏幕的深度"。
    #    第一版照抄参考产品的 (x, y=高度, z) 语义，结果整个人偶是**躺着**的
    #    （身高长在深度轴上），渲染出来只剩几个球。这里统一改成 Z=高度。
    hips = joint("hips", root, 0, 0, 0.53 * n)
    blob("pelvis", hips, 0.075 * n, 1.25, 0.75, 0.9)

    spine = joint("spine", hips, 0, 0, 0.02 * n)
    torso = limb("spine", spine, 0.085 * n, 0.16 * n)
    torso.location = (0, 0, 0.13 * n)

    neck = joint("neck", spine, 0, 0, 0.245 * n)
    blob("head", neck, 0.068 * n)
    bpy.data.objects[f"{name}_head"].location = (0, 0, 0.075 * n)

    # 手臂
    for side, sign in (("L", -1), ("R", 1)):
        sh = joint(f"shoulder{side}", spine, sign * 0.115 * n, 0, 0.215 * n)
        limb(f"shoulder{side}", sh, 0.030 * n, 0.165 * n)
        el = joint(f"elbow{side}", sh, 0, 0, -0.165 * n)
        limb(f"elbow{side}", el, 0.026 * n, 0.150 * n)
        hand = blob(f"hand{side}", el, 0.030 * n)
        hand.location = (0, 0, -0.170 * n)
    # 腿
    for side, sign in (("L", -1), ("R", 1)):
        hp = joint(f"hip{side}", hips, sign * 0.06 * n, 0, -0.02 * n)
        limb(f"hip{side}", hp, 0.042 * n, 0.245 * n)
        kn = joint(f"knee{side}", hp, 0, 0, -0.245 * n)
        limb(f"knee{side}", kn, 0.036 * n, 0.235 * n)
        # 踝关节：pose 骨架需要它（OpenPose 的 18 点里有脚踝）。
        # 只是一个空物体锚点，不加网格，不影响 depth/preview 的观感。
        an = bpy.data.objects.new(f"{name}_ankle{side}", None)
        an.empty_display_size = 0.03
        an.parent = kn
        an.location = (0, 0, -0.235 * n)
        bpy.context.collection.objects.link(an)
        joints[f"ankle{side}"] = an

    root["joints"] = list(joints.keys())
    return root, joints


# ----------------------------------------------------------------- 动作曲线

# 动作实现**全部**在 actions.py（纯 Python，可脱离 Blender 单测）。
# 这里只保留一个薄适配层：把 (u, 时长, 强度, 情绪) 转发过去，
# 并保证「未知动作名」不会炸整镜 —— 返回空 dict 即静止。
def action_curve(action, u, duration_s, intensity=1.0, emotion_amp=1.0):
    """程序化关节动作。返回 {joint: (rx, ry, rz)}（角度制）。

    见 actions.AXIS_CONTRACT：手臂沿 -Z 生长，绕 Z 旋转是自转、剪影不可见；
    向上链的 +X 是后仰不是前俯。这些坑都在 actions.py 里用语义化构造器锁死了。
    """
    return jz_actions.action_curve(action, u, duration_s, intensity, emotion_amp)


# ----------------------------------------------------------------- 道具

def build_prop(p, idx):
    kind = str(p.get("kind") or "box")
    pos = p.get("position") or [0, 0, 0]
    scale = p.get("scale") or [1, 1, 1]
    mat = make_material(f"prop{idx}_mat", hex_to_rgba(p.get("color") or "#9aa0a6"))

    me = bpy.data.meshes.new(f"prop{idx}_mesh")
    bm = bmesh.new()
    if kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=0.5)
    elif kind == "cylinder":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.5, radius2=0.5, depth=1.0)
    elif kind == "wall":
        bmesh.ops.create_cube(bm, size=1.0)
        scale = [float(scale[0]) * 3.0, float(scale[1]) * 0.12, float(scale[2]) * 2.4]
    else:
        bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()

    ob = bpy.data.objects.new(f"prop{idx}", me)
    ob.data.materials.append(mat)
    ob.location = (float(pos[0]), float(pos[1]), float(pos[2]))
    ob.scale = (float(scale[0]), float(scale[1]), float(scale[2]))
    bpy.context.collection.objects.link(ob)
    return ob


# ----------------------------------------------------------------- 导入模型

def import_model(path):
    """
    导入外部模型（glb / gltf / fbx / obj）。

    ⚠️ 用 `bpy.ops.import_scene.gltf()` 等操作符，它们在 `-b` 无头模式下
      也能用（只要 `--factory-startup` 且没有禁用相应 addon）。
      glTF / FBX / OBJ 都是 Blender 自带 io 插件，factory-startup 下默认启用。

    返回新导入的所有对象（顶层 Object 列表）。
    """
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects.keys())
    try:
        if ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        elif ext == ".obj":
            bpy.ops.wm.obj_import(filepath=path)
        else:
            raise RuntimeError(f"unsupported model format: {ext}")
    except Exception as e:
        print(f"IMPORT_FAIL {path}: {e}")
        return []
    after = set(bpy.data.objects.keys())
    return [bpy.data.objects[k] for k in (after - before)]


def fit_imported(obj_list, target_height, origin=(0.0, 0.0, 0.0)):
    """
    把导入的模型缩放/平移到"站在 origin、身高 = target_height"。

    为什么要做这一步：Mixamo / Sketchfab 下载的模型单位五花八门
    （cm / inch / 无单位），直接放进场景会大得看不见或小得没有。
    这里按**包围盒高度**统一归一化，是唯一稳的做法。

    ⚠️ 不能随便改父级：对有骨架（Armature）的模型，网格的 parent 必须保持
       原样（通常是 Armature 或骨骼），否则骨架变形就断了 —— 表现为
       "模型站着不动"。这里只对**顶层对象**（parent 为空者）挂到新 root 上。
    """
    if not obj_list:
        return None
    bpy.context.view_layer.update()

    mn = [1e9, 1e9, 1e9]
    mx = [-1e9, -1e9, -1e9]
    for ob in obj_list:
        if ob.type != "MESH":
            continue
        for corner in ob.bound_box:
            world = ob.matrix_world @ Vector(corner)
            for i in range(3):
                mn[i] = min(mn[i], world[i])
                mx[i] = max(mx[i], world[i])
    height = mx[2] - mn[2]
    if height <= 1e-6:
        return None

    scale = float(target_height) / height
    cx = (mn[0] + mx[0]) / 2.0
    cy = (mn[1] + mx[1]) / 2.0

    root = bpy.data.objects.new("imported_root", None)
    bpy.context.collection.objects.link(root)
    root.location = (origin[0], origin[1], origin[2])
    root.scale = (scale, scale, scale)

    # 只重挂**顶层**对象；骨架内部的父子关系保持原样，否则动画失效
    for ob in obj_list:
        if ob.parent is None:
            ob.parent = root
    # 脚底对齐到 z=0、水平居中（用局部偏移实现，不改骨架）
    for ob in obj_list:
        if ob.parent is root:
            ob.location = (ob.location[0] - cx, ob.location[1] - cy, ob.location[2] - mn[2])
    return root


def apply_fbx_action(obj_list, action_name):
    """
    给导入的骨架套用 Blender 里已有的 Action（Mixamo FBX 自带动作时用）。

    Mixamo 导出的 FBX 通常附带 Action（名字形如 "mixamo.com" 或
    "Armature|Armature|mixamo.com"），导入后需要显式挂到 Armature 的
    animation_data.action 上才会动。

    返回实际挂上的 Action 名（没挂上返回 None），便于上层日志。
    """
    armatures = [o for o in obj_list if o.type == "ARMATURE"]
    if not armatures:
        return None

    # 优先按名字模糊匹配（用户可能只写 "walk"），否则退回导入的第一个动作
    target = None
    if action_name:
        needle = action_name.lower()
        for act in bpy.data.actions:
            if needle in act.name.lower():
                target = act
                break
    if target is None and bpy.data.actions:
        target = bpy.data.actions[0]
    if target is None:
        return None

    for arm in armatures:
        if arm.animation_data is None:
            arm.animation_data_create()
        arm.animation_data.action = target
        # Blender 4.4+ 的 slotted actions：不设 slot 的话动作不会播
        try:
            slots = getattr(target, "slots", None)
            if slots and hasattr(arm.animation_data, "action_slot"):
                if arm.animation_data.action_slot is None and len(slots) > 0:
                    arm.animation_data.action_slot = slots[0]
        except Exception as e:
            print(f"ACTION_SLOT_SKIP {arm.name}: {e}")
    return target.name


def setup_camera(spec):
    cam_data = bpy.data.cameras.new("shotcam")
    cam = bpy.data.objects.new("shotcam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    c = spec.get("camera") or {}
    cam_data.angle = math.radians(_fov_to_angle(c.get("fov")))

    def place(pos, target, roll=0.0):
        cam.location = Vector((float(pos[0]), float(pos[1]), float(pos[2])))
        t = Vector((float(target[0]), float(target[1]), float(target[2])))
        direction = t - cam.location
        if direction.length < 1e-6:
            direction = Vector((0, 0, -1))
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        if roll:
            cam.rotation_euler.rotate_axis("Z", math.radians(float(roll)))

    pos = c.get("position") or [0, 1.6, 5]
    tgt = c.get("target") or [0, 1.0, 0]
    place(pos, tgt, c.get("rollDeg") or 0)

    keys = c.get("keys") or []
    if len(keys) >= 2:
        for k in sorted(keys, key=lambda x: float(x.get("frame") or 0)):
            f = int(float(k.get("frame") or 0))
            bpy.context.scene.frame_set(f)
            place(
                k.get("position") or pos,
                k.get("target") or tgt,
                k.get("rollDeg") or 0,
            )
            cam.keyframe_insert("location", frame=f)
            cam.keyframe_insert("rotation_euler", frame=f)
        # 机位关键帧：线性插值，避免默认贝塞尔在起止处"顿一下"
        if cam.animation_data and cam.animation_data.action:
            for fc in _fcurves(cam.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"

    bpy.context.scene.frame_set(0)
    return cam


def _fcurves(action):
    """兼容 Blender 4.4+ 的 slotted actions 与旧版 action.fcurves。"""
    if hasattr(action, "fcurves") and len(getattr(action, "fcurves", [])) > 0:
        return action.fcurves
    out = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out


def _fov_to_angle(fov_deg):
    """
    H3 / 预演引擎的 fov 是**水平视场角**；Blender 的 camera.angle 默认按
    传感器适配方向（横向）解释，两者语义一致，直接取用即可。
    保留这个函数是为了把这个假设写死在代码里，避免后续有人"顺手修正"。
    """
    v = float(fov_deg or 50)
    return max(5.0, min(140.0, v))


# ----------------------------------------------------------------- 元素动画

# 情绪 → 动作幅度系数。必须定义在 apply_actor_actions **之前**：
# Python 在模块级按名字查找，函数体执行时该名字必须已绑定，
# 原来它定义在函数之后，属于潜伏的 NameError 炸弹。
EMOTION_AMP = {
    "neutral": 1.0, "tender": 0.72, "intimate": 0.62, "tense": 1.15,
    "joyful": 1.22, "grief": 0.60, "menacing": 1.30,
}


def _actor_timeline(actor, total_frames):
    """算出一个演员的 (起始帧, 结束帧, 动作时长秒)。

    三个历史缺陷集中在这里，按语义重新定义：

    1. **结束帧**：原来是 `start + durationFrames`，当 durationFrames 缺省成
       `FRAMES - start` 时 end 会等于 FRAMES，边界判断 `start <= f <= end`
       把越界帧也算进动作里。现在用**半开区间** [start, end)。

    2. **动作时长**：durationFrames 被写成 1 时，动作会在 1/24 秒内走完全程
       —— 表现为一次瞬移式的抽搐。强制至少 6 帧的可见时长。

    3. **区间外**：原来 in_range 为假就给零角度，动作前后会「啪」地归零。
       现在区间外**保持端点姿态**，多段拼接时不会跳。
    """
    total = max(1, int(total_frames))
    start = max(0, int(actor.get("startFrame") or 0))
    start = min(start, total - 1)

    raw_dur = actor.get("durationFrames")
    try:
        dur = int(float(raw_dur)) if raw_dur is not None else 0
    except (TypeError, ValueError):
        dur = 0
    if dur <= 0:
        dur = total - start
    dur = max(6, min(dur, total - start))
    end = start + dur

    return start, end, dur / float(max(1, FPS))


def apply_actor_actions(spec, actor_objs):
    for actor, (root, joints) in actor_objs:
        action = str(actor.get("action") or "stand")
        start, end, dur_sec = _actor_timeline(actor, FRAMES)
        frm = actor.get("from") or actor.get("position") or [0, 0, 0]
        to = actor.get("to") or frm
        try:
            intensity = float(actor.get("intensity") or 1.0)
        except (TypeError, ValueError):
            intensity = 1.0
        emo = float(EMOTION_AMP.get(str(actor.get("emotion") or "neutral"), 1.0))
        yaw = math.radians(float(actor.get("rotationDeg") or 0))
        # 导入的模型（glb/fbx）自带骨架，不能按程序化关节驱动 ——
        # 只做整体位移，动作交给它自己的 Action（见 apply_fbx_action）。
        has_joints = bool(joints)

        for f in range(FRAMES):
            if f < start:
                u = 0.0
            elif f >= end:
                u = 1.0
            else:
                u = (f - start) / float(max(1, end - start))
                u = 0.0 if u < 0.0 else (1.0 if u > 1.0 else u)

            bpy.context.scene.frame_set(f)

            # 位移：from → to 平滑推进（与 u 同步，动作走完人也到位）
            #
            # ⚠️ 这里的 frm/to 已经是 **Blender 坐标**（buildSceneSpec 调过
            #    toBlenderVec）：X=左右、Y=深度、Z=高度。
            #    所以第 3 个分量就是高度，直接写 location.z 是对的。
            t = u * u * (3 - 2 * u)      # smoothstep
            px = float(frm[0]) + (float(to[0]) - float(frm[0])) * t
            py = float(frm[1]) + (float(to[1]) - float(frm[1])) * t
            pz = float(frm[2]) + (float(to[2]) - float(frm[2])) * t

            # 动作自带的根节点下沉（坐下/蹲下/跪姿）。
            # 髋关节点在骨架里固定在 0.53×身高，只转髋关节腿会前伸、
            # 屁股悬空 —— 必须把整个人降下来才像"坐着"。
            pose = action_curve(action, u, dur_sec, intensity, emo) if has_joints else {}
            drop = pose.pop(jz_actions.ROOT_DROP_KEY, None) if isinstance(pose, dict) else None
            if drop:
                try:
                    pz += float(drop[0])
                except (TypeError, ValueError, IndexError):
                    pass

            root.location = (px, py, pz)
            root.keyframe_insert("location", frame=f)

            # 朝向：整段恒定。原来只在 in_range 或 u>0 时写，
            # 导致首帧没有朝向关键帧，会回落到 root 的默认旋转。
            root.rotation_euler = Euler((0, 0, yaw), "XYZ")
            root.keyframe_insert("rotation_euler", frame=f)

            # 关节（仅程序化人偶；导入模型自带骨架，跳过）
            if not has_joints:
                continue
            for jname, jt in joints.items():
                r = pose.get(jname)
                if r:
                    jt.rotation_euler = Euler(
                        (math.radians(r[0]), math.radians(r[1]), math.radians(r[2])), "XYZ")
                else:
                    jt.rotation_euler = Euler((0, 0, 0), "XYZ")
                jt.keyframe_insert("rotation_euler", frame=f)


# ----------------------------------------------------------------- 预览（人看的）

def setup_preview(scene):
    """
    预览模式 —— 给用户**看**的彩色灰模，不是控制信号。

    ⚠️ 与 depth/pose/canny 的区别：
      那三个是喂给 H3 ControlNet 的通道，要求高对比、去纹理；
      这个是给人眼看的，要有材质色、要有光照阴影，才看得出"摆得对不对"。

    用 Workbench 而不是 EEVEE：Workbench 在无头模式下不需要 GPU 编译着色器，
    124 帧只要几秒（EEVEE 要 20 秒+），预览就该快。
    """
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    # MATERIAL 模式：用物体自己的材质颜色（演员按 color 字段上色）
    sh.color_type = "MATERIAL"
    sh.show_shadows = True
    sh.shadow_intensity = 0.35
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.curvature_ridge_factor = 1.0
    sh.curvature_valley_factor = 1.0
    sh.show_object_outline = True
    sh.object_outline_color = (0.05, 0.05, 0.06)
    scene.display.render_aa = "8"
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("JZ_World")
    scene.world.color = (0.06, 0.07, 0.09)
    # 预览要"所见即所得"，不要胶片调色
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


# ----------------------------------------------------------------- 各通道输出

def setup_workbench_gray():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "SINGLE"
    sh.single_color = (0.78, 0.78, 0.78)
    sh.show_shadows = True
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sc.display.render_aa = "8"
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("W") if not sc.world else sc.world
    sc.world.color = (0.05, 0.055, 0.06)


def setup_blockout(scene, colored=True):
    """灰模**参考视频**模式 —— 社区标准交付物（不是控制塔通道）。

    与 setup_preview 的差别都是刻意的：

    | 项 | preview（给人看） | blockout（给模型当参考） |
    |---|---|---|
    | 光照 | STUDIO 带方向，有阴影 | **FLAT 平光**，关阴影、关 AO |
    | 颜色 | MATERIAL 彩色 | 多角色 MATTER 彩色 / 单角色 SINGLE 灰 |
    | 轮廓线 | 有 | **无**（轮廓线会变成画面里的墨线） |
    | 高光/腔体 | 有 | **关**（会被当成材质高光） |

    为什么关阴影/AO：参考视频会被 H3 整段 24fps VAE 编码进同一序列，
    光影与材质会被一起复刻（社区为此专门做了 ReferenceVideoFade patch）。
    平光 + 无阴影是"纯结构说明书"，模型只会拿到运动与空间。

    为什么多角色要上色：全灰 playblast 会让模型丢失身份区分，
    实测多人同框时左右会互换。色号也在提示词里被引用
    （"<Subject 1> 的走位对应画面里那个红色高个胶囊体"）。
    """
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    # FLAT = 无方向性光照。STUDIO 会引入固定主光方向，模型会照抄。
    sh.light = "FLAT"
    if colored:
        # MATERIAL：用材质色（演员按 color 字段上色），身份靠颜色区分
        sh.color_type = "MATERIAL"
    else:
        # SINGLE：单色灰 —— 单角色场景避免模型把灰当配色
        sh.color_type = "SINGLE"
        sh.single_color = (0.72, 0.72, 0.72)
    # 下面四项全部关掉：任何"成片特征"都会被参考视频带进输出
    sh.show_shadows = False
    sh.show_cavity = False
    sh.show_object_outline = False
    sh.show_specular_highlight = False
    scene.display.render_aa = "8"
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("JZ_Blockout_World")
    scene.world.color = (0.12, 0.12, 0.13)
    # 不做胶片调色：blockout 要的是"原样"的结构，不是好看的画面
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    # 参考视频会被 H3 按 24fps 读取，帧率必须与目标模型一致
    scene.render.fps = int(SPEC.get("fps") or 24)


def compute_depth_range(spec, dmin_allowed=0.05):
    """按**场景内容的实际几何包络**算近/远平面。

    ⚠️ 历史缺陷：near = dist*0.55 / far = dist*1.8，dist 是"相机到 target"。
       这个值比主体本身还近，逆深度归一化后主体的动态范围被大量浪费：
       实测某镜 near=2.34 far=7.67，人物只落在 93/255 的中灰里。

    正确做法：拿 actors / props 的包围盒投影到相机朝向，取实测 z 范围再留余量。
    地面在 depth 通道里单独处理（见 setup_depth），所以不会被"铺到 14 米"拉爆。

    返回 (near, far)。
    """
    cam = spec.get("camera") or {}
    cpos = cam.get("position") or [0, 1.6, -4.2]
    ctgt = cam.get("target") or [0, 0.95, 0]
    try:
        eye = Vector((float(cpos[0]), float(cpos[1]), float(cpos[2])))
        look = Vector((float(ctgt[0]), float(ctgt[1]), float(ctgt[2])))
    except (TypeError, ValueError, IndexError):
        eye, look = Vector((0.0, 4.2, 1.6)), Vector((0.0, 0.0, 0.95))

    fwd = look - eye
    if fwd.length < 1e-6:
        fwd = Vector((0.0, -1.0, 0.0))
    fwd.normalize()

    def view_z(p):
        """点在相机朝向上的投影深度（与 ShaderNodeCameraData.View Z Depth 同义）。"""
        return (p - eye).dot(fwd)

    depths = []
    for a in spec.get("actors") or []:
        pos = a.get("position") or [0, 0, 0]
        try:
            h = float(a.get("heightM") or 1.72)
            px, py, pz = float(pos[0]), float(pos[1]), float(pos[2])
        except (TypeError, ValueError, IndexError):
            continue
        rx, ry = h * 0.35, h * 0.30
        for dx in (-rx, rx):
            for dy in (-ry, ry):
                for dz in (0.0, h):
                    depths.append(view_z(Vector((px + dx, py + dy, pz + dz))))

    for p in spec.get("props") or []:
        pos = p.get("position") or [0, 0, 0]
        sc = p.get("scale") or [1, 1, 1]
        try:
            px, py, pz = float(pos[0]), float(pos[1]), float(pos[2])
            sx = abs(float(sc[0])) * 0.5
            sy = abs(float(sc[1])) * 0.5
            sz = abs(float(sc[2])) * 0.5
        except (TypeError, ValueError, IndexError):
            continue
        if str(p.get("kind") or "") == "wall":     # 墙的 scale 在 build_prop 里被放大过
            sx, sy, sz = sx * 3.0, sy * 0.12, sz * 2.4
        for dx in (-sx, sx):
            for dy in (-sy, sy):
                for dz in (-sz, sz):
                    depths.append(view_z(Vector((px + dx, py + dy, pz + dz))))

    depths = [d for d in depths if d > dmin_allowed and math.isfinite(d)]
    if not depths:
        d = max(0.5, (look - eye).length)
        return max(dmin_allowed, d * 0.7), d * 3.0

    near = max(dmin_allowed, min(depths) * 0.95)
    far = max(near * 1.5, max(depths) * 3.0)
    return near, far


def _depth_math_chain(nt, near, far, dim=1.0):
    """建一条 1/z → 归一化 → (可选压暗) 的节点链，返回末端输出 socket。"""
    near = max(1e-3, float(near))
    far = max(near + 1e-3, float(far))

    cam_data = nt.nodes.new("ShaderNodeCameraData")
    cam_data.location = (-900, 0)

    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "DIVIDE"
    inv.location = (-700, 0)
    inv.inputs[0].default_value = 1.0
    nt.links.new(cam_data.outputs["View Z Depth"], inv.inputs[1])

    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    sub.location = (-520, 0)
    sub.inputs[1].default_value = 1.0 / far
    nt.links.new(inv.outputs[0], sub.inputs[0])

    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.location = (-340, 0)
    mul.inputs[1].default_value = 1.0 / (1.0 / near - 1.0 / far)
    nt.links.new(sub.outputs[0], mul.inputs[0])

    clamp = nt.nodes.new("ShaderNodeMath")
    clamp.operation = "ADD"
    clamp.use_clamp = True
    clamp.location = (-160, 0)
    clamp.inputs[1].default_value = 0.0
    nt.links.new(mul.outputs[0], clamp.inputs[0])

    tail = clamp
    if abs(dim - 1.0) > 1e-6:
        dm = nt.nodes.new("ShaderNodeMath")
        dm.operation = "MULTIPLY"
        dm.location = (10, 0)
        dm.inputs[1].default_value = float(dim)
        dm.use_clamp = True
        nt.links.new(clamp.outputs[0], dm.inputs[0])
        tail = dm
    return tail


def make_depth_material(near, far):
    """
    深度材质：相机视空间 Z → 灰度（近白远黑，**逆深度分布**）。

    ⚠️ 为什么不用 Workbench 的 Depth pass（走过三条死路，别再试）：
      1) `Normalize` 把场景最远点映射到 1.0，地面一铺开人物就被压成一片灰；
      2) `world.mist_settings` + Mist pass 在 Workbench 下**不产生输出**
         （RLayers.outputs 里没有 "Mist"）；
      3) Workbench 的 Depth 通道按**相机 clip 范围**归一化，且不完全随
         clip_start/clip_end 线性响应（实测收紧到 0.5–24 仍是"一片白"）。

    ⚠️ 为什么不用 MapRange 做线性映射（本次修正的核心）：
      Fun ControlNet 这一族的 depth 分支是拿 VideoX-Fun / VACE 的预处理结果
      训出来的，而它们的预处理是：

        VACE      DepthAnything/MiDaS → min-max 归一化（值是 inverse depth）
        VideoX-Fun ZoeDepth（米制）→ 归一化后 `1.0 - depth` 反相

      两条路径最终**都是"近=白、远=黑"，且分布是逆深度 1/z 而不是线性米制**。
      用线性 (z-near)/(far-near) 会让近景压成一片白、中景几乎全黑，
      与训练分布差得很远 —— 控制力弱、人物数量约束不住。

      实测（本机某镜，人物 3.5–3.8m）：
          线性   → 144–162/255（落到中灰，主体与环境挤在一起）
          逆深度 → 73–88/255（主体是明确的暗剪影，梯度铺满全程）

    ⚠️ 必须用 Raw：Standard 会把线性值再走一遍 sRGB 编码。
    """
    mat = bpy.data.materials.new("JZ_DEPTH")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    tail = _depth_math_chain(nt, near, far, dim=1.0)
    em = nt.nodes.new("ShaderNodeEmission")
    em.location = (200, 0)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(tail.outputs[0], em.inputs["Color"])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (380, 0)
    nt.links.new(em.outputs[0], out.inputs["Surface"])

    mat["jz_depth_near"] = float(near)
    mat["jz_depth_far"] = float(far)
    mat["jz_depth_mode"] = "inverse-z"
    return mat


def setup_depth(scene, near, far):
    """EEVEE + 深度材质。所有网格换成深度材质，世界背景压黑。"""
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = False

    if scene.world is None:
        scene.world = bpy.data.worlds.new("JZ_World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0.0

    depth_mat = make_depth_material(near, far)
    # 地面**也走真实深度映射**，只是整体压暗一档。
    #
    # ⚠️ 历史做法是把地面固定成 0.22 灰。两个问题：
    #    ① 逆深度下主体自己落在 0.3–0.8 区间，固定 0.22 与它亮度太接近，
    #       人和地仍然糊在一起（实测 56 vs 93，只差 37 级）；
    #    ② 地面不随距离变化 = 告诉模型"整个地面同一深度"，
    #       这是错误的空间信息，地平线会被当成垂直于视线的大平面。
    #
    # 现在：地面用同一条逆深度链，再乘 0.45。既保留"越远越黑"的真实梯度，
    # 又保证人永远比地面亮、剪影清晰。
    ground_mat = bpy.data.materials.new("JZ_DEPTH_GROUND")
    ground_mat.use_nodes = True
    gnt = ground_mat.node_tree
    gnt.nodes.clear()
    g_tail = _depth_math_chain(gnt, near, far, dim=0.45)
    g_em = gnt.nodes.new("ShaderNodeEmission")
    g_em.inputs["Strength"].default_value = 1.0
    gnt.links.new(g_tail.outputs[0], g_em.inputs["Color"])
    g_out = gnt.nodes.new("ShaderNodeOutputMaterial")
    gnt.links.new(g_em.outputs[0], g_out.inputs["Surface"])
    ground_mat["jz_ground_dim"] = 0.45

    for ob in scene.objects:
        if ob.type == "MESH":
            ob.data.materials.clear()
            ob.data.materials.append(ground_mat if ob.name == "ground" else depth_mat)

    # ⚠️ 必须用 Raw：Standard 会把线性深度再走一遍 sRGB 编码，
    #    值域被压到 50–90/255 这一小段（实测），灰阶分辨力只剩个位数。
    #    Raw 直接输出线性值，深度差能完整映射到 0–255。
    scene.view_settings.view_transform = "Raw"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0


# ------------------------------------------------------------ OpenPose 骨架
# 与 DWPose / OpenPose COCO-18 对齐：H3 Fun ControlNet 的 pose 分支就是拿
# DWPose 骨架训的（模型卡原文 "Pose | DWPose skeleton"），
# 提供同构的彩色骨架才算"同一个语义"。
#
# 关键配色事实（源码级）：VACE / VideoX-Fun 的 draw_bodypose 画完四肢后执行
#     canvas = (canvas * 0.6).astype(uint8)
# 即**肢体整体压到 60% 亮度、关键点保持满亮度**。只画满亮度线段是对不上的。
#
# limbSeq / colors 顺序固定，不要"顺手优化"。

# COCO-18 的官方 limbSeq（1-based，顺序与 VACE draw_bodypose 一致）：
# 点位定义（1-based）：
#   1 nose  2 neck  3 Rshoulder 4 Relbow 5 Rwrist  6 Lshoulder 7 Lelbow 8 Lwrist
#   9 Rhip  10 Rknee 11 Rankle  12 Lhip 13 Lknee 14 Lankle
#   15 Reye 16 Leye  17 Rear    18 Lear
OPENPOSE_LIMBS = (
    (2, 3), (2, 6), (3, 4), (4, 5), (6, 7), (7, 8), (2, 9), (9, 10),
    (10, 11), (2, 12), (12, 13), (13, 14), (2, 1), (1, 15), (15, 17),
    (1, 16), (16, 18), (3, 17), (6, 18),
)

OPENPOSE_COLORS = (
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0),
    (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255),
    (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255),
    (255, 0, 255), (255, 0, 170), (255, 0, 85),
)

# 骨段粗细按**身高**归一，不按骨长。
# OpenPose / DWPose 的骨架是**全肢体统一线宽**（stickwidth≈4px），
# 按骨长百分比算会让大腿粗、脖子细，与训练分布不符。
# 0.011 × 身高 ≈ 1.9cm，在 480px 画幅（约 100px/m）上约 4px 宽。
BONE_RADIUS_RATIO = 0.011
DOT_RADIUS_RATIO = 0.013


def _solid_emission(r, g, b, name="JZ_EMIT", dim=1.0):
    """纯色自发光材质（无光照、无阴影），同名复用。"""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (r * dim, g * dim, b * dim, 1.0)
    em.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return mat


def _bone_material(color_rgb):
    name = "JZ_POSE_L{}_{}_{}".format(*color_rgb)
    # ×0.6 —— 与训练侧 draw_bodypose 的压暗一致
    return _solid_emission(color_rgb[0] / 255.0, color_rgb[1] / 255.0,
                           color_rgb[2] / 255.0, name=name, dim=0.6)


def _dot_material(color_rgb):
    name = "JZ_POSE_P{}_{}_{}".format(*color_rgb)
    return _solid_emission(color_rgb[0] / 255.0, color_rgb[1] / 255.0,
                           color_rgb[2] / 255.0, name=name, dim=1.0)


def _pose_point_map(joints, actor):
    """人偶关节 → OpenPose COCO-18 点位序号。

    OpenPose 18 点：
      1 颈  2 右肩 3 右肘 4 右腕 5 左肩 6 左肘 7 左腕
      8 右髋 9 右膝 10 右踝 11 左髋 12 左膝 13 左踝
      14 头顶 15 右眼 16 左眼 17 右耳 18 左耳

    ⚠️ head / hand 是**网格（blob）不是关节（joint）**，不在 joints 字典里。
       早期版本把它们写进 need 列表，导致 `all(n in joints)` 恒假、
       整条骨架被跳过（表现为 POSE_SKELETON_FALLBACK）。
       现在：head 用网格对象本身，手腕/脚踝用关节 + 按身高归一的偏移。
    """
    need = ("neck", "spine", "hips",
            "shoulderR", "elbowR", "hipR", "kneeR",
            "shoulderL", "elbowL", "hipL", "kneeL")
    if not all(n in joints for n in need):
        return {}

    # ⚠️ COCO-18 是 1-based，且 **1=nose、2=neck**。
    #    早期版本按"1=neck"编号，limbSeq 连出来的拓扑整个错位
    #    （实测：一堆交叉线段，根本不成人形）。
    m = {
        2: ("j", "neck"),
        3: ("j", "shoulderR"), 4: ("j", "elbowR"),
        6: ("j", "shoulderL"), 7: ("j", "elbowL"),
        9: ("j", "hipR"), 10: ("j", "kneeR"),
        12: ("j", "hipL"), 13: ("j", "kneeL"),
    }

    # 1 = nose：人偶没有五官，用 head 网格略偏前（+Y 朝画面前方）的位置代表
    head_obj = bpy.data.objects.get("{}_head".format(actor.get("name")))
    if head_obj is not None:
        head_h = 0.068 * (float(actor.get("heightM") or 1.72) / 1.72)
        m[1] = ("o", head_obj, (0.0, -head_h * 0.75, -head_h * 0.15))
        m[15] = ("o", head_obj, (0.012, -head_h * 0.85, -0.005))   # 右眼
        m[16] = ("o", head_obj, (-0.012, -head_h * 0.85, -0.005))  # 左眼
        m[17] = ("o", head_obj, (0.030, 0.0, -0.015))              # 右耳
        m[18] = ("o", head_obj, (-0.030, 0.0, -0.015))             # 左耳

    for side, idx in (("R", 5), ("L", 8)):
        if "hand{}".format(side) in joints:
            m[idx] = ("j", "hand{}".format(side))
        else:
            m[idx] = ("j", "elbow{}".format(side), (0.0, 0.0, -0.170))
    for side, idx in (("R", 11), ("L", 14)):
        if "ankle{}".format(side) in joints:
            m[idx] = ("j", "ankle{}".format(side))
        else:
            m[idx] = ("j", "knee{}".format(side), (0.0, 0.0, -0.235))
    return m


def _resolve_point(joints, entry, height=1.72):
    """把 _pose_point_map 的一项解析成世界坐标 Vector；失败返回 None。"""
    if not entry:
        return None
    kind = entry[0]
    scale = float(height or 1.72) / 1.72
    if kind == "j":
        ob = joints.get(entry[1])
        if ob is None:
            return None
        off = entry[2] if len(entry) > 2 else (0.0, 0.0, 0.0)
        return ob.matrix_world.translation + Vector(
            (off[0] * scale, off[1] * scale, off[2] * scale))
    if kind == "o":
        ob = entry[1]
        if ob is None:
            return None
        off = entry[2] if len(entry) > 2 else (0.0, 0.0, 0.0)
        return ob.matrix_world.translation + Vector(
            (off[0] * scale, off[1] * scale, off[2] * scale))
    return None


def _build_pose_rig(scene, joints, mapping, height):
    """按当前帧建出整套骨段 + 关键点，返回绑定关系供逐帧更新。

    骨段用**单位圆柱 + scale.z 拉伸**，每帧只改 transform，不重建 mesh
    （每帧重建 20 个 mesh 在 124 帧上会明显拖慢）。
    """
    pts = {}
    for idx, entry in mapping.items():
        p = _resolve_point(joints, entry, height)
        if p is not None:
            pts[idx] = p
    if len(pts) < 6:
        return None

    me_bone = bpy.data.meshes.new("jz_pose_bone_unit")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=1.0,
                          radius2=1.0, depth=1.0)
    bm.to_mesh(me_bone)
    bm.free()

    me_dot = bpy.data.meshes.new("jz_pose_dot_unit")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=1.0)
    bm.to_mesh(me_dot)
    bm.free()

    bones = []
    for limb_index, (a, b) in enumerate(OPENPOSE_LIMBS):
        if a not in pts or b not in pts:
            continue
        own = me_bone.copy()
        ob = bpy.data.objects.new("jz_bone_{}_{}".format(a, b), own)
        ob.data.materials.append(_bone_material(OPENPOSE_COLORS[limb_index % len(OPENPOSE_COLORS)]))
        ob.rotation_mode = "QUATERNION"
        scene.collection.objects.link(ob)
        bones.append({"a": a, "b": b, "obj": ob})

    dots = []
    for idx in sorted(pts):
        own = me_dot.copy()
        ob = bpy.data.objects.new("jz_dot_{}".format(idx), own)
        ob.data.materials.append(_dot_material(OPENPOSE_COLORS[(idx - 1) % len(OPENPOSE_COLORS)]))
        scene.collection.objects.link(ob)
        dots.append({"idx": idx, "obj": ob})

    return {"points": dict(mapping), "joints": joints, "bones": bones,
            "dots": dots, "height": float(height or 1.72)}


def update_pose_rig(scene, rigs):
    """把骨架更新到**当前帧**。必须在每次 frame_set 之后调用。"""
    if not rigs:
        return
    bpy.context.view_layer.update()
    for rig in rigs:
        joints = rig["joints"]
        height = rig["height"]
        pts = {}
        for idx, entry in rig["points"].items():
            p = _resolve_point(joints, entry, height)
            if p is not None:
                pts[idx] = p
        for bone in rig["bones"]:
            pa, pb = pts.get(bone["a"]), pts.get(bone["b"])
            ob = bone["obj"]
            if pa is None or pb is None:
                continue
            vec = pb - pa
            length = vec.length
            if length < 1e-5:
                continue
            radius = max(0.004, height * BONE_RADIUS_RATIO)
            ob.location = (pa + pb) * 0.5
            ob.rotation_quaternion = vec.to_track_quat("Z", "Y")
            ob.scale = (radius, radius, length)
        dot_r = max(0.008, min(0.030, height * DOT_RADIUS_RATIO))
        for dot in rig["dots"]:
            pos = pts.get(dot["idx"])
            if pos is None:
                continue
            dot["obj"].location = pos
            dot["obj"].scale = (dot_r, dot_r, dot_r)


def setup_pose(scene, actor_objs):
    """姿态通道：黑底 + OpenPose 彩色骨架（COCO-18 / DWPose 同构）。

    ⚠️ 为什么不再画"纯白剪影"
      H3 Fun ControlNet 的 pose 分支是拿 DWPose 骨架训的，ComfyUI 官方模板
      也是先过 SDPose 抽骨架再喂。骨架承载的是**关节拓扑与角度**；
      纯白剪影丢掉这层信息，模型只会把它当成"一张对比度很高的图"。
      所以剪影喂进去，控制力显著偏弱。

    ⚠️ 为什么骨架必须逐帧驱动
      ① apply_actor_actions 结束时场景停在最后一帧，此时读关节世界坐标会把
         骨架冻结在动作终点（实测：整条骨架错位到画面右上）；
      ② 骨段几何按两端点建立，每帧都要更新。
      所以这里只建绑定关系，真正的更新在 render_sequence 的逐帧循环里。

    ⚠️ 人偶网格必须 hide_render，不能只涂黑
      涂黑的话网格会挡住画在它内部的骨架线段，渲染出来只剩几段露在轮廓外的
      彩色碎片（实测就是这个症状）。
    """
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = False

    if scene.world is None:
        scene.world = bpy.data.worlds.new("JZ_World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        # 强度必须为 0：EEVEE 的 world 是环境光，非零会把整个画面照成灰白
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0.0

    black_mat = _solid_emission(0.0, 0.0, 0.0, name="JZ_POSE_BLACK", dim=0.0)

    actor_roots = set()
    for _actor, (root, _joints) in actor_objs:
        if root is None:
            continue
        actor_roots.add(root.name)
        for _child in root.children_recursive:
            if _child.type == "MESH":
                actor_roots.add(_child.name)

    def _is_actor_mesh(ob):
        node = ob
        while node is not None:
            if node.name in actor_roots:
                return True
            node = node.parent
        return False

    for ob in scene.objects:
        if ob.type != "MESH":
            continue
        ob.data.materials.clear()
        ob.data.materials.append(black_mat)
        if _is_actor_mesh(ob):
            ob.hide_render = True

    pose_rigs = []
    for actor, (root, joints) in actor_objs:
        if not joints:
            continue
        mapping = _pose_point_map(joints, actor)
        if not mapping:
            continue
        rig = _build_pose_rig(scene, joints, mapping, actor.get("heightM") or 1.72)
        if rig:
            pose_rigs.append(rig)

    if not pose_rigs:
        # 没有可用关节（例如全是导入模型）→ 退回剪影，保证通道不空
        print("POSE_SKELETON_FALLBACK: 无可用关节，退回剪影")
        white = _solid_emission(1.0, 1.0, 1.0, name="JZ_POSE_WHITE")
        for ob in scene.objects:
            if ob.type == "MESH" and _is_actor_mesh(ob):
                ob.hide_render = False
                ob.data.materials.clear()
                ob.data.materials.append(white)
    else:
        print("POSE_SKELETON_OK rigs={}".format(len(pose_rigs)))

    scene.view_settings.view_transform = "Raw"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    return pose_rigs


def pad_frame_numbers(out_dir):
    """把 Blender 的 4 位帧号补成 5 位，与 JS 侧 ffmpeg 的 `f_%05d.png` 对齐。

    ⚠️ 历史缺陷（一个"看起来成功、其实崩了"的复合 bug）：
        files = [f for f in os.listdir(out_dir) if f.startswith("f_")]
        os.rename(f_0000.png -> f_00000.png)
      1. 直接枚举整个目录，把**上一次渲染留下的 5 位文件**也算进来，
         于是目标已存在 → Windows 上 `FileExistsError: WinError 183`；
      2. 崩溃发生在 render_sequence 尾部，此时 PNG 序列**已完整落盘**，
         JS 侧只按"产物存在"判定成功 → 用户看到成功，Python 实际非零退出。

    现在：只处理恰好 4 位数字的源文件；目标存在就覆盖；单个失败不影响其余帧。
    """
    try:
        names = os.listdir(out_dir)
    except OSError as e:
        print("FRAME_PAD_SKIP: 无法列目录 {}: {}".format(out_dir, e))
        return 0, 0

    renamed, failed = 0, 0
    for name in names:
        if not (name.startswith("f_") and name.endswith(".png")):
            continue
        num = name[2:-4]
        if len(num) != 4 or not num.isdigit():
            continue
        src_path = os.path.join(out_dir, name)
        dst_path = os.path.join(out_dir, "f_0{}.png".format(num))
        try:
            if os.path.exists(dst_path):
                os.remove(dst_path)
            os.replace(src_path, dst_path)
            renamed += 1
        except OSError as e:
            failed += 1
            print("FRAME_PAD_FAIL {}: {}".format(name, e))
    return renamed, failed


def count_frames(out_dir):
    """数 5 位帧号的有效产物。

    "f_00000.png" 长度 11（"f_" 2 + 5 位帧号 + ".png" 4），帧号在 [2:7]。
    """
    try:
        return sum(
            1 for n in os.listdir(out_dir)
            if n.startswith("f_") and n.endswith(".png")
            and len(n) == 11 and n[2:7].isdigit()
        )
    except OSError:
        return 0


def render_sequence(scene, out_dir, pose_rigs=None):
    os.makedirs(out_dir, exist_ok=True)
    # 清掉上一轮残留：目录虽然每次新建，但重新渲染同一 job 时可能复用
    for stale in os.listdir(out_dir):
        if stale.startswith("f_") and stale.endswith(".png"):
            try:
                os.remove(os.path.join(out_dir, stale))
            except OSError:
                pass

    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.use_file_extension = True

    if pose_rigs:
        # pose：骨架必须**每帧**重新贴合关节，否则整段都是同一个姿势。
        # 逐帧手动渲染（而不是 render(animation=True)），因为要在每次
        # frame_set 之后插一次 update_pose_rig。
        for f in range(scene.frame_start, scene.frame_end + 1):
            scene.frame_set(f)
            update_pose_rig(scene, pose_rigs)
            scene.render.filepath = os.path.join(out_dir, "f_{:05d}".format(f))
            bpy.ops.render.render(write_still=True)
        return count_frames(out_dir)

    scene.render.filepath = os.path.join(out_dir, "f_")
    bpy.ops.render.render(animation=True)
    pad_frame_numbers(out_dir)
    return count_frames(out_dir)


# ----------------------------------------------------------------- 主流程

def main():
    scene = reset_scene()

    spec = SPEC
    if spec.get("ground", True):
        # 地面只铺到相机视野附近：铺太远会把 Z pass 的归一化区间拉爆，
        # 人物被压进同一档灰度，depth 控制就退化了（实测踩过）。
        span = float(spec.get("groundSpan") or 14.0)
        me = bpy.data.meshes.new("ground_mesh")
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=span)
        bm.to_mesh(me)
        bm.free()
        g = bpy.data.objects.new("ground", me)
        # 稍微下移：人偶脚底在 y=0，地面正好在 0 时腿会被自身阴影/深度压住
        g.location = (0, -0.01, 0)
        g.data.materials.append(make_material("ground_mat", (0.22, 0.23, 0.25, 1)))
        bpy.context.collection.objects.link(g)

    for i, p in enumerate(spec.get("props") or []):
        # 有 assetPath 时导入真实模型，否则用程序化灰盒
        ap = p.get("assetPath")
        if ap and os.path.isfile(ap):
            objs = import_model(ap)
            root = fit_imported(objs, max(0.2, float(p.get("scale", [1, 1, 1])[2]) or 1.0),
                                origin=(float(p.get("position", [0, 0, 0])[0]),
                                        float(p.get("position", [0, 0, 0])[1]),
                                        float(p.get("position", [0, 0, 0])[2])))
            if root is None:
                build_prop(p, i)      # 导入失败 → 退回灰盒，不炸整镜
        else:
            build_prop(p, i)

    actor_objs = []   # [(actor_dict, (root, joints))]
    for a in spec.get("actors") or []:
        ap = a.get("assetPath")
        if ap and os.path.isfile(ap):
            # 导入真实人物模型（glb / fbx）。可带 Mixamo 动作。
            objs = import_model(ap)
            pos = a.get("position") or [0, 0, 0]
            root = fit_imported(objs, a.get("heightM") or 1.72,
                                origin=(float(pos[0]), float(pos[1]), float(pos[2])))
            if root is not None:
                # Mixamo FBX 自带 Action：显式挂上去才会动
                apply_fbx_action(objs, str(a.get("action") or ""))
                root.rotation_euler = Euler((0, 0, math.radians(float(a.get("rotationDeg") or 0))), "XYZ")
                # 导入模型不再用程序化关节驱动（它有自己的骨架）
                actor_objs.append((a, (root, {})))
                continue
            print(f"ASSET_FIT_FAIL {ap} → 退回程序化人偶")
        root, joints = build_mannequin(
            str(a.get("name") or f"Actor{len(actor_objs) + 1}"),
            a.get("heightM") or 1.72,
            a.get("color") or "#e1e3e7",
        )
        actor_objs.append((a, (root, joints)))

    setup_camera(spec)
    apply_actor_actions(spec, actor_objs)

    pose_rigs = None
    if MODE == "depth":
        # 近/远平面按**场景实际几何**推算（不再用相机到注视点的经验系数）。
        # 允许 spec 显式覆盖：depthNear / depthFar。
        auto_near, auto_far = compute_depth_range(spec)
        near = float(spec.get("depthNear") or auto_near)
        far = float(spec.get("depthFar") or auto_far)
        print("DEPTH_RANGE near={:.3f} far={:.3f} (auto {:.3f}/{:.3f})".format(
            near, far, auto_near, auto_far))
        setup_depth(scene, near, far)
    elif MODE == "pose":
        pose_rigs = setup_pose(scene, actor_objs)
    elif MODE == "canny" or MODE == "gray":
        setup_workbench_gray()
    elif MODE == "blockout":
        # 多角色上色（身份区分），单角色灰（避免灰被当成配色）。
        # 阈值与理由见 setup_blockout 的 docstring。
        n_actors = len(spec.get("actors") or [])
        setup_blockout(scene, colored=(n_actors > 1))
    elif MODE == "preview":
        # 给人看的彩色灰模（不进 H3）
        setup_preview(scene)
    else:
        raise SystemExit(f"unknown mode: {MODE}")

    out_dir = os.path.join(OUT_DIR, MODE)
    # 存 .blend：用户可以拿它到桌面 Blender 里继续调（见 open_in_blender）。
    # ⚠️ 必须回到第 0 帧再存，否则打开 .blend 时停在最后一帧，
    #    用户会以为"动画没做"（实测踩过）。
    try:
        scene.frame_set(scene.frame_start)
        if pose_rigs:
            update_pose_rig(scene, pose_rigs)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "scene.blend"),
                                    check_existing=False)
    except Exception as e:
        print(f"BLEND_SAVE_SKIP: {e}")

    n = render_sequence(scene, out_dir, pose_rigs)
    if n <= 0:
        raise SystemExit("BLENDER_NO_FRAMES: mode={} dir={}".format(MODE, out_dir))
    print(f"BLENDER_RENDER_DONE mode={MODE} frames={n} dir={out_dir}")


main()
