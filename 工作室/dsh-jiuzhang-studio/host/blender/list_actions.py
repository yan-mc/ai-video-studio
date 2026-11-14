"""
列出 3D 资产内部的动作名（Action）。

被 `blender -b --factory-startup --python list_actions.py -- <asset>` 调用。

为什么单独一个脚本：Mixamo 导出的 Action 名字形如
`"Armature|Armature|walk"` 或 `"mixamo.com"`，用户猜不到；
与其让人试错，不如真的启一次 Blender 把名字读出来。

输出：`JZ_ACTIONS:[...]`（单行 JSON，供 JS 侧正则提取）
"""
import bpy
import json
import os
import sys


def main():
    argv = sys.argv
    if "--" not in argv:
        print("JZ_ACTIONS:[]")
        return
    rest = argv[argv.index("--") + 1:]
    if not rest:
        print("JZ_ACTIONS:[]")
        return
    path = rest[0]
    if not os.path.isfile(path):
        print("JZ_ACTIONS:[]")
        return

    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        elif ext == ".obj":
            # OBJ 没有动画，但也要能列出（返回空）
            bpy.ops.wm.obj_import(filepath=path)
        else:
            print("JZ_ACTIONS:[]")
            return
    except Exception as e:
        print(f"JZ_IMPORT_ERR:{e}")
        print("JZ_ACTIONS:[]")
        return

    actions = []
    for act in bpy.data.actions:
        # frame_range 是 (start, end)；Mixamo 常从 1 帧开始
        try:
            fr = act.frame_range
            start, end = float(fr[0]), float(fr[1])
        except Exception:
            start, end = 0.0, 0.0
        actions.append({
            "name": act.name,
            "frames": [round(start, 2), round(end, 2)],
            "durationFrames": round(max(0.0, end - start), 2),
        })

    # 同时报告骨架与网格数量，便于判断"这是角色还是道具"
    armatures = [o.name for o in bpy.data.objects if o.type == "ARMATURE"]
    meshes = [o.name for o in bpy.data.objects if o.type == "MESH"]
    print("JZ_SUMMARY:" + json.dumps({
        "armatures": armatures,
        "meshCount": len(meshes),
        "hasSkin": any(m.type == "ARMATURE" for o in bpy.data.objects for m in o.modifiers),
    }, ensure_ascii=False))
    print("JZ_ACTIONS:" + json.dumps(actions, ensure_ascii=False))


main()
