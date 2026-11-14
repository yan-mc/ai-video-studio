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

产物写到 <outDir>/<mode>/f_%05d.png 与 <outDir>/<mode>/control.mp4（ffmpeg 由 JS 侧调）。
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Euler

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

    root["joints"] = list(joints.keys())
    return root, joints


# ----------------------------------------------------------------- 动作曲线

def action_curve(action, u, duration_s, intensity=1.0, emotion_amp=1.0):
    """
    程序化关节动作。返回 {joint: (rx, ry, rz)}（角度制）。

    ⚠️ 这是**预演级**近似，不是运动捕捉：目标是让 depth/pose 控制序列带上
    可信的运动节奏与关节幅度，而不是追求解剖正确。真正的骨骼动画应当来自
    Blender 内的 Action / Mixamo 资源；这里是「无资产也能出控制信号」的兜底。
    """
    k = float(intensity or 1.0) * float(emotion_amp or 1.0)
    if action in ("walk", "fast-walk", "follow", "pass-by"):
        speed = 2.0 if action == "fast-walk" else 1.35
        phase = math.sin(u * math.pi * 2 * speed)
        amp = (38 if action == "fast-walk" else 28) * k
        return {
            "hipL": (phase * amp, 0, 0), "hipR": (-phase * amp, 0, 0),
            "kneeL": (max(0.0, -phase) * 48 * k, 0, 0),
            "kneeR": (max(0.0, phase) * 48 * k, 0, 0),
            "shoulderL": (-phase * 24 * k, 0, 0),
            "shoulderR": (phase * 24 * k, 0, 0),
            "spine": (4 * k, 0, 0),
        }
    if action in ("run", "dodge"):
        phase = math.sin(u * math.pi * 2 * 2.3)
        return {
            "hipL": (phase * 52 * k, 0, 0), "hipR": (-phase * 52 * k, 0, 0),
            "kneeL": ((18 + max(0.0, -phase) * 75) * k, 0, 0),
            "kneeR": ((18 + max(0.0, phase) * 75) * k, 0, 0),
            "shoulderL": (-phase * 42 * k, 0, 0), "shoulderR": (phase * 42 * k, 0, 0),
            "elbowL": (-75 * k, 0, 0), "elbowR": (-75 * k, 0, 0),
            "spine": (13 * k, 0, 0),
        }
    if action == "wave":
        return {"shoulderR": (0, 0, -145 * k), "elbowR": (0, 0, (-25 + math.sin(u * math.pi * 8) * 28) * k)}
    if action == "raise-hand":
        e = min(1.0, u / 0.35)
        return {"shoulderR": (0, 0, -145 * e * k), "elbowR": (0, 0, -22 * e * k)}
    if action == "turn":
        return {"hips": (0, u * 55 * k, 0), "spine": (0, u * 28 * k, 0), "neck": (0, u * 18 * k, 0)}
    if action == "look-back":
        s = math.sin(u * math.pi)
        return {"spine": (0, s * 22 * k, 0), "neck": (0, s * 55 * k, 0)}
    if action in ("pick-up", "put-down"):
        s = math.sin(u * math.pi)
        return {"spine": (s * 55 * k, 0, 0), "hipL": (s * 40 * k, 0, 0), "hipR": (s * 40 * k, 0, 0),
                "kneeL": (s * 65 * k, 0, 0), "kneeR": (s * 65 * k, 0, 0),
                "shoulderR": (-s * 60 * k, 0, 0)}
    if action in ("sit", "sit-down"):
        s = min(1.0, u / 0.6)
        return {"hipL": (-90 * s * k, 0, 0), "hipR": (-90 * s * k, 0, 0),
                "kneeL": (90 * s * k, 0, 0), "kneeR": (90 * s * k, 0, 0), "spine": (5 * s, 0, 0)}
    if action in ("lie-down", "fall"):
        s = min(1.0, u / 0.8)
        return {"spine": (85 * s * k, 0, 0), "hips": (10 * s * k, 0, 0)}
    if action == "bow":
        s = math.sin(u * math.pi)
        return {"spine": (s * 45 * k, 0, 0)}
    if action == "nod":
        return {"neck": (math.sin(u * math.pi * 4) * 18 * k, 0, 0)}
    if action == "shake-head":
        return {"neck": (0, math.sin(u * math.pi * 4) * 22 * k, 0)}
    if action == "speak":
        return {"neck": (math.sin(u * math.pi * 6) * 5 * k, 0, 0),
                "shoulderR": (0, 0, -18 * k), "elbowR": (-30 * k, 0, 0)}
    if action == "listen":
        return {"spine": (3 * k, 0, 0), "neck": (0, 8 * k, 0)}
    if action == "hug":
        s = min(1.0, u / 0.5)
        return {"shoulderL": (0, 0, 72 * s * k), "shoulderR": (0, 0, -72 * s * k),
                "elbowL": (-40 * s * k, 0, 0), "elbowR": (-40 * s * k, 0, 0)}
    if action in ("point", "reach"):
        return {"shoulderR": (0, 0, -85 * k), "elbowR": (-10 * k, 0, 0)}
    if action == "cross-arms":
        s = min(1.0, u / 0.4)
        return {"shoulderL": (0, 0, 60 * s * k), "shoulderR": (0, 0, -60 * s * k),
                "elbowL": (-75 * s * k, 0, 0), "elbowR": (-75 * s * k, 0, 0)}
    if action == "hands-on-hips":
        return {"shoulderL": (0, 0, 55 * k), "shoulderR": (0, 0, -55 * k),
                "elbowL": (-70 * k, 0, 0), "elbowR": (-70 * k, 0, 0)}
    if action == "idle-breathe":
        s = math.sin(u * math.pi * 2)
        return {"spine": (s * 1.5 * k, 0, 0), "neck": (s * 1.0 * k, 0, 0)}
    return {}   # stand / 未知 → 静止


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

def apply_actor_actions(spec, actor_objs):
    for actor, (root, joints) in actor_objs:
        action = str(actor.get("action") or "stand")
        start = int(float(actor.get("startFrame") or 0))
        dur_frames = int(float(actor.get("durationFrames") or 0))
        if dur_frames <= 0:
            dur_frames = max(1, FRAMES - start)
        end = start + dur_frames
        frm = actor.get("from") or actor.get("position") or [0, 0, 0]
        to = actor.get("to") or frm
        intensity = float(actor.get("intensity") or 1.0)
        emo = float(EMOTION_AMP.get(str(actor.get("emotion") or "neutral"), 1.0))
        # 导入的模型（glb/fbx）自带骨架，不能按程序化关节驱动 ——
        # 只做整体位移，动作交给它自己的 Action（见 apply_fbx_action）。
        has_joints = bool(joints)

        for f in range(FRAMES):
            u = 0.0 if f <= start else min(1.0, (f - start) / float(dur_frames))
            in_range = start <= f <= end
            bpy.context.scene.frame_set(f)

            # 位移：from → to 平滑推进
            t = u * u * (3 - 2 * u)      # smoothstep
            root.location = (
                float(frm[0]) + (float(to[0]) - float(frm[0])) * t,
                float(frm[1]) + (float(to[1]) - float(frm[1])) * t,
                float(frm[2]) + (float(to[2]) - float(frm[2])) * t,
            )
            root.keyframe_insert("location", frame=f)

            # 朝向
            yaw = float(actor.get("rotationDeg") or 0)
            if in_range or u > 0:
                root.rotation_euler = Euler((0, 0, math.radians(yaw)), "XYZ")
                root.keyframe_insert("rotation_euler", frame=f)

            # 关节（仅程序化人偶；导入模型自带骨架，跳过）
            if not has_joints:
                continue
            pose = action_curve(action, u, dur_frames / float(FPS), intensity, emo) if in_range else {}
            for jname, jt in joints.items():
                r = pose.get(jname)
                if r:
                    jt.rotation_euler = Euler(
                        (math.radians(r[0]), math.radians(r[1]), math.radians(r[2])), "XYZ")
                else:
                    jt.rotation_euler = Euler((0, 0, 0), "XYZ")
                jt.keyframe_insert("rotation_euler", frame=f)


EMOTION_AMP = {
    "neutral": 1.0, "tender": 0.72, "intimate": 0.62, "tense": 1.15,
    "joyful": 1.22, "grief": 0.60, "menacing": 1.30,
}


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


def make_depth_material(near, far):
    """
    深度材质：相机视空间 Z → 灰度（近白远黑）。

    ⚠️ 为什么不用 Workbench 的 Depth pass（走过三条死路，别再试）：
      1) `Normalize` 把场景最远点映射到 1.0，地面一铺开人物就被压成一片灰；
      2) `world.mist_settings` + Mist pass 在 Workbench 下**不产生输出**
         （RLayers.outputs 里没有 "Mist"）；
      3) Workbench 的 Depth 通道按**相机 clip 范围**归一化，且不完全随
         clip_start/clip_end 线性响应（实测收紧到 0.5–24 仍是"一片白"）。
    ✅ 正解：EEVEE + `ShaderNodeCameraData.View Z Depth` + `MapRange`。
       near/far 是显式数值（米），映射完全可控，与场景内容无关。
    """
    mat = bpy.data.materials.new("JZ_DEPTH")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    cam_data = nt.nodes.new("ShaderNodeCameraData")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = near
    mr.inputs["From Max"].default_value = far
    mr.inputs["To Min"].default_value = 1.0     # 近 = 白
    mr.inputs["To Max"].default_value = 0.0     # 远 = 黑
    mr.clamp = True
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(cam_data.outputs["View Z Depth"], mr.inputs["Value"])
    nt.links.new(mr.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
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
    # 地面单独一个"压暗"的深度材质：
    #   人站在地面上，腿的深度和它背后那块地面几乎相同，两者会糊成一片。
    #   把地面整体压到深灰（固定值），人物就变成清晰的亮剪影 ——
    #   这正是控制视频要的"主体在哪、多高、腿怎么迈"。
    ground_mat = bpy.data.materials.new("JZ_DEPTH_GROUND")
    ground_mat.use_nodes = True
    gnt = ground_mat.node_tree
    gnt.nodes.clear()
    gem = gnt.nodes.new("ShaderNodeEmission")
    gem.inputs["Color"].default_value = (0.22, 0.22, 0.22, 1)
    gem.inputs["Strength"].default_value = 1.0
    gout = gnt.nodes.new("ShaderNodeOutputMaterial")
    gnt.links.new(gem.outputs[0], gout.inputs["Surface"])

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


def setup_pose(scene, actor_objs):
    """
    姿态：EEVEE + 纯白发光材质 → 深色背景上的白色剪影。

    为什么是"剪影"而不是真正的骨架线：
      H3 的 pose 条件要的是**关节位置与四肢走向**，白色剪影已经完整编码了
      这些信息（哪只手抬起、腿怎么迈）。真正 OpenPose 风格的骨架线需要
      额外做骨段渲染，收益不大而复杂度高。
      需要更严格的骨架时接 SDPose 预处理器即可（ComfyUI 官方模板已有该子图）。

    ⚠️ 用 EEVEE 而不是 Workbench：Workbench 的 SINGLE 色模式仍受 studio
      光照影响，人物与背景对比不够硬；Emission 材质给出真正的纯白。
    """
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = False

    if scene.world is None:
        scene.world = bpy.data.worlds.new("JZ_World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        # 强度必须为 0：EEVEE 的 world 是环境光，只要非零就会把整个画面
        # 照成灰白，白色剪影就完全看不见了（实测踩过：整张图纯白）。
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0.0

    black_mat = bpy.data.materials.new("JZ_POSE_GROUND")
    black_mat.use_nodes = True
    bnt = black_mat.node_tree
    bnt.nodes.clear()
    bem = bnt.nodes.new("ShaderNodeEmission")
    bem.inputs["Color"].default_value = (0, 0, 0, 1)
    bem.inputs["Strength"].default_value = 0.0
    bout = bnt.nodes.new("ShaderNodeOutputMaterial")
    bnt.links.new(bem.outputs[0], bout.inputs["Surface"])

    mat = bpy.data.materials.new("JZ_POSE")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1, 1, 1, 1)
    em.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])

    # ⚠️ 地面必须排除：它占满半个画面，跟着变白的话整张图就是纯白
    #   （实测踩过：pose 输出 mean=254.9，什么都看不见）。
    # ⚠️ 只把**人物**染白，地面与道具一律纯黑。
    #    否则道具盒会渲染成一个和人物同样亮的大白块，把主体吞掉
    #    （实测：中间那块白色方块就是 prop，不是地面）。
    #
    # ⚠️ 判断"是不是人物"不能只看名字前缀：导入的 glb/fbx 里对象名是
    #    Body / Rig / mixamorig:Hips 之类，跟 actor 的 name 毫无关系。
    #    正确做法是看**谱系**：沿 parent 链往上走，能走到某个 actor 的 root 就算。
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
        ob.data.materials.append(mat if _is_actor_mesh(ob) else black_mat)

    # ⚠️ 必须用 Raw：Standard 会把线性深度再走一遍 sRGB 编码，
    #    值域被压到 50–90/255 这一小段（实测），灰阶分辨力只剩个位数。
    #    Raw 直接输出线性值，深度差能完整映射到 0–255。
    scene.view_settings.view_transform = "Raw"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0


def render_sequence(scene, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = os.path.join(out_dir, "f_")
    scene.render.use_file_extension = True
    bpy.ops.render.render(animation=True)
    # Blender 输出 f_0000.png（4 位）；统一补成 5 位，和 JS 侧 ffmpeg 的 %05d 对齐
    files = sorted(f for f in os.listdir(out_dir) if f.startswith("f_") and f.endswith(".png"))
    for f in files:
        num = f[2:-4]
        if len(num) == 4:
            os.rename(os.path.join(out_dir, f), os.path.join(out_dir, f"f_0{num}.png"))
    return len(files)


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

    if MODE == "depth":
        # near/far 按镜头尺度：相机到注视点的距离 × 系数，保证主体落在可分辨区间
        cam_pos = Vector(spec.get("camera", {}).get("position") or [0, 1.6, 5])
        cam_tgt = Vector(spec.get("camera", {}).get("target") or [0, 1.0, 0])
        dist = max(0.5, (cam_tgt - cam_pos).length)
        # 范围要贴着主体：太宽会把人物压成一条窄灰带（实测 dist*3 时
        # 值域只有 182–199，不到 8% 动态范围，完全无法当控制信号）。
        near = float(spec.get("mistStart") or max(0.05, dist * 0.55))
        far = float(spec.get("mistDepth") or dist * 1.8)
        setup_depth(scene, near, far)
    elif MODE == "pose":
        setup_pose(scene, actor_objs)
    elif MODE == "canny" or MODE == "gray":
        setup_workbench_gray()
    elif MODE == "preview":
        # 给人看的彩色灰模（不进 H3）
        setup_preview(scene)
    else:
        raise SystemExit(f"unknown mode: {MODE}")

    out_dir = os.path.join(OUT_DIR, MODE)
    # 顺手存一份 .blend：用户可以拿它到桌面 Blender 里继续调（见 open_in_blender）
    try:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "scene.blend"), check_existing=False)
    except Exception as e:
        print(f"BLEND_SAVE_SKIP: {e}")

    n = render_sequence(scene, out_dir)
    print(f"BLENDER_RENDER_DONE mode={MODE} frames={n} dir={out_dir}")


main()
