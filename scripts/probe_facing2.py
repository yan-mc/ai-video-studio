"""姿态朝向探针：确认默认朝向 + rotationDeg 的偏转方向 + sit 膝盖指向。

渲染 2 个做 sit 动作的人偶（rot 0 / rot 90），从 3/4 俯角看，
膝盖朝向一眼可辨。1 帧，几秒出结果。

坐标：直接写 Blender 坐标 (x, y=深度, z=高度)。
镜头卡 (x, y=高度, z=深度) → Blender (x, -z, y)。
"""
import json
import os

OUT = os.path.join(os.environ.get('TEMP', '.'), 'jz-facing2')
os.makedirs(OUT, exist_ok=True)


def b(v):
    return [v[0], -v[2], v[1]]


spec = {
    "name": "pose-facing-probe",
    "width": 960, "height": 540, "fps": 24, "frames": 1,
    "ground": True, "groundSpan": 14,
    "camera": {
        # 3/4 俯视：高位、偏一侧
        "position": b([3.2, 2.6, 4.6]),
        "target": b([0, 0.7, 0]),
        "fov": 50,
    },
    "actors": [
        # 红 = rot 0；蓝 = rot 90。都做 sit（膝盖前伸）
        {"name": "R0",  "heightM": 1.7, "color": "#e05252",
         "position": b([-1.5, 0, 0]), "rotationDeg": 0,
         "action": "sit", "startFrame": 0, "durationFrames": 1},
        {"name": "R90", "heightM": 1.7, "color": "#4a90e2",
         "position": b([1.5, 0, 0]), "rotationDeg": 90,
         "action": "sit", "startFrame": 0, "durationFrames": 1},
    ],
    "props": [
        # 参考地标：+z 方向（岸边侧）放一个黄盒
        {"kind": "box", "name": "SHORE_MARK", "position": b([0, 0.15, 3.5]),
         "scale": [1.2, 0.3, 0.3], "color": "#d8c040"},
        # -z 方向（海侧）放一个青盒
        {"kind": "box", "name": "SEA_MARK", "position": b([0, 0.15, -3.5]),
         "scale": [1.2, 0.3, 0.3], "color": "#40c0c8"},
    ],
}

path = os.path.join(OUT, 'scene.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(spec, f, ensure_ascii=False)

print('SPEC=' + path)
print('红=R0(rot0) 蓝=R90(rot90)；黄盒在岸边侧(+z)，青盒在海侧(-z)')
