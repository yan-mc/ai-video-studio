"""精确探针：读 .blend，打印每个人偶的头/髋/膝/脚世界坐标，算出朝向轴。

不靠看图猜，直接用坐标判定 `rotationDeg` 与"面朝方向"的对应关系。
"""
import bpy
import sys

def w(ob):
    t = ob.matrix_world.translation
    return (round(t.x, 3), round(t.y, 3), round(t.z, 3))

print("=== SCENE OBJECTS (actors only) ===")
names = sorted({o.name.split('_')[0] for o in bpy.data.objects
                if o.name and o.name[0] in 'RB' and '_' in o.name})
print("actor prefixes:", names)

for pre in names:
    print("\n---", pre, "---")
    for part in ['hips', 'neck', 'kneeL', 'kneeR', 'ankleL', 'ankleR']:
        ob = bpy.data.objects.get(f"{pre}_{part}")
        if ob:
            print(f"  {part:8s} {w(ob)}")
    root = bpy.data.objects.get(pre)
    if root:
        print(f"  {'ROOT':8s} {w(root)}  rotDeg={round(root.rotation_euler.z * 57.2958, 1)}")

    # 朝向轴 = 髋 → 膝 的水平向量
    hips = bpy.data.objects.get(f"{pre}_hips")
    knee = bpy.data.objects.get(f"{pre}_kneeL")
    if hips and knee:
        h = hips.matrix_world.translation
        k = knee.matrix_world.translation
        dx, dy = round(k.x - h.x, 3), round(k.y - h.y, 3)
        print(f"  FACING_VECTOR (hips->kneeL, horizontal) = ({dx}, {dy})")

print("\n=== axis reference ===")
print("Blender: +X = screen right when camera looks +Y; +Y = away from camera; +Z = up")
