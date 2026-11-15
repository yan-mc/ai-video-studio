"""在指定帧读取真实世界坐标：相机 x、人物 x、以及人物在画面中的归一化位置。

直接算投影，避免"看图猜"。
"""
import bpy
import sys

frame = 20
argv = sys.argv
if '--' in argv:
    rest = argv[argv.index('--') + 1:]
    if rest:
        frame = int(rest[0])

sc = bpy.context.scene
sc.frame_set(frame)
dg = bpy.context.evaluated_depsgraph_get()

cam = sc.camera
print(f'=== frame {frame} ===')
print(f'CAM  loc = {tuple(round(v,3) for v in cam.matrix_world.translation)}')
fwd = cam.matrix_world.to_quaternion() @ __import__('mathutils').Vector((0, 0, -1))
print(f'CAM  fwd = {tuple(round(v,3) for v in fwd)}')

# 相机参数
cam_data = cam.data
print(f'CAM  fov(angle) = {round(cam_data.angle*57.2958,2)} deg  sensor_fit={cam_data.sensor_fit}')

from bpy_extras.object_utils import world_to_camera_view

for pre in ['Xiangzi', 'Chuhua']:
    ob = bpy.data.objects.get(f'{pre}_hips')
    if not ob:
        continue
    e = ob.evaluated_get(dg)
    wp = e.matrix_world.translation
    co = world_to_camera_view(sc, cam, wp)
    print(f'{pre:8s} hips world={tuple(round(v,3) for v in wp)}  screen=({co.x:.3f}, {co.y:.3f})  depth={co.z:.2f}')

    head = bpy.data.objects.get(f'{pre}_head')
    if head:
        eh = head.evaluated_get(dg)
        coh = world_to_camera_view(sc, cam, eh.matrix_world.translation)
        print(f'{"":8s} head screen=({coh.x:.3f}, {coh.y:.3f})')
