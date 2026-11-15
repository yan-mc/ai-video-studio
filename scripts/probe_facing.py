"""朝向探针：一次渲染看清 rotationDeg 0/90/180/270 分别朝向哪边。

只跑 1 帧，几秒出结果。用来确定"沿海滩向右走"该给多少度。

⚠️ 坐标系：本脚本直接写**已换算好的 Blender 坐标**（x, y=深度, z=高度）。
   镜头卡/前端用的是 (x, y=高度, z=深度)，由 buildSceneSpec 负责换算。
   这里绕过 service 直接喂 render_shot.py，所以必须自己换算，
   否则会渲出一整片纯灰（相机埋在地里）—— 踩过。
"""
import json
import os

OUT = os.path.join(os.environ.get('TEMP', '.'), 'jz-facing')
os.makedirs(OUT, exist_ok=True)

# 镜头卡坐标 → Blender 坐标： (x, y=高度, z=深度) → (x, -z, y)
def b(v):
    return [v[0], -v[2], v[1]]

# 四个人偶排成一排，各自不同朝向，均做 walk 姿态
spec = {
    "name": "facing-probe",
    "width": 960, "height": 540, "fps": 24, "frames": 1,
    "ground": True, "groundSpan": 14,
    "camera": {
        "position": b([0, 1.7, -6.0]),   # 高度 1.7，深度 -6（相机在近侧）
        "target": b([0, 0.95, 0]),       # 看向人物腰部
        "fov": 50,
    },
    "actors": [
        {"name": "R0",   "heightM": 1.7, "color": "#e05252", "position": b([-2.7, 0, 0]),
         "rotationDeg": 0,   "action": "walk", "startFrame": 0, "durationFrames": 1},
        {"name": "R90",  "heightM": 1.7, "color": "#52a0e0", "position": b([-0.9, 0, 0]),
         "rotationDeg": 90,  "action": "walk", "startFrame": 0, "durationFrames": 1},
        {"name": "R180", "heightM": 1.7, "color": "#52c07a", "position": b([0.9, 0, 0]),
         "rotationDeg": 180, "action": "walk", "startFrame": 0, "durationFrames": 1},
        {"name": "R270", "heightM": 1.7, "color": "#c8b040", "position": b([2.7, 0, 0]),
         "rotationDeg": 270, "action": "walk", "startFrame": 0, "durationFrames": 1},
    ],
    "props": [],
}

path = os.path.join(OUT, 'scene.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(spec, f, ensure_ascii=False)

print('SPEC=' + path)
print('从左到右: R0=红(0deg) R90=蓝(90deg) R180=绿(180deg) R270=黄(270deg)')
print('相机位置(blender):', spec['camera']['position'])
