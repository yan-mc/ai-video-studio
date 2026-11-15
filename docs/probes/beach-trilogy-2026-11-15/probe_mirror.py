"""镜像假设验证：用可区分左右的标记物，确认镜头卡 +x 渲染后出现在画面哪一侧。

在镜头卡坐标 x = -2（RED）与 x = +2（BLUE）各放一个盒子，
相机放在 +z（岸侧）朝 -z 看（与镜2 同构），读渲染图里两色块的屏幕位置。

如果镜头卡 +x 出现在画面右侧 → 没有镜像
如果镜头卡 +x 出现在画面左侧 → 有镜像
"""
import json
import os

OUT = os.path.join(os.environ.get('TEMP', '.'), 'jz-mirror')
os.makedirs(OUT, exist_ok=True)


def b(v):
    """镜头卡 (x, y高, z深) → Blender (x, -z, y高)"""
    return [v[0], -v[2], v[1]]


spec = {
    "name": "mirror-probe",
    "width": 800, "height": 450, "fps": 24, "frames": 1,
    "ground": True, "groundSpan": 20,
    "camera": {
        # 与镜2 同构：相机在镜头卡 z=-2.4（海侧），朝 +z（岸侧）看
        "position": b([0, 1.4, -2.4]),
        "target": b([0, 0.9, 4.0]),
        "fov": 50,
    },
    "actors": [],
    "props": [
        # 镜头卡 x = -2 → 期望出现在画面？（红色）
        {"kind": "box", "name": "LEFT_NEGX", "position": b([-2.0, 0.5, 3.0]),
         "scale": [0.5, 0.5, 1.0], "color": "#ff2020"},
        # 镜头卡 x = +2 → 期望出现在画面？（蓝色）
        {"kind": "box", "name": "RIGHT_POSX", "position": b([2.0, 0.5, 3.0]),
         "scale": [0.5, 0.5, 1.0], "color": "#2040ff"},
    ],
}
p = os.path.join(OUT, 'scene.json')
with open(p, 'w', encoding='utf-8') as f:
    json.dump(spec, f, ensure_ascii=False)
print('SPEC=' + p)
print('红色 = 镜头卡 x=-2 ; 蓝色 = 镜头卡 x=+2')
print('相机 = 镜头卡 (0, 1.4, -2.4) 朝 +z 看')
