"""读三镜 .blend，打印人偶朝向向量与关键关节高度，判定：
  - 人偶到底面朝哪一侧（海 -z / 岸 +z）
  - sit 姿态下髋部高度、是否与长椅座面匹配
  - 相机在镜头卡坐标里的位置
"""
import bpy
import os

def w(ob):
    t = ob.matrix_world.translation
    return (round(t.x, 3), round(t.y, 3), round(t.z, 3))

root = os.path.join(r'F:\AI视频\工作室\dsh-jiuzhang-studio\data\previz\blender')
dirs = sorted([d for d in os.listdir(root) if d.startswith('shot_mwhus')])
print('runs:', dirs)

for d in dirs:
    print('\n' + '=' * 60)
    print('RUN', d)
    scene = bpy.context.scene
    for pre in ['Xiangzi', 'Chuhua']:
        hips = bpy.data.objects.get(f'{pre}_hips')
        neck = bpy.data.objects.get(f'{pre}_neck')
        knee = bpy.data.objects.get(f'{pre}_kneeL')
        ankle = bpy.data.objects.get(f'{pre}_ankleL')
        head = bpy.data.objects.get(f'{pre}_head')
        rootob = bpy.data.objects.get(pre)
        if not hips:
            print(f'  {pre}: NOT FOUND')
            continue
        print(f'  --- {pre} ---')
        print(f'    root  {w(rootob)}  rotDeg={round(rootob.rotation_euler.z*57.2958,1)}')
        for nm, ob in [('hips', hips), ('neck', neck), ('head', head), ('kneeL', knee), ('ankleL', ankle)]:
            if ob:
                print(f'    {nm:7s} {w(ob)}')
        if hips and knee:
            h, k = hips.matrix_world.translation, knee.matrix_world.translation
            print(f'    FACING(hips->kneeL) = ({round(k.x-h.x,3)}, {round(k.y-h.y,3)})   '
                  f'[+Y=away from cam if cam at -Y]')
    cam = bpy.data.objects.get('shotcam')
    if cam:
        print(f'  CAMERA blender-space loc = {w(cam)}')
