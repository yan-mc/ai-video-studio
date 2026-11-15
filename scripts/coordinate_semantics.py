"""把坐标语义一次性钉死，避免继续靠猜。

三镜 .blend 里我已知的事实（探针实测）：
  - 镜2 相机在 Blender y=+2.4，朝 -Y 看
  - 演员在 Blender y=-4.0
  - rotationDeg=0 时，膝盖朝 +Y（knee.y > hips.y）

换算关系（buildSceneSpec.toBlenderVec）：(x, y高, z深) → (x, -z, y高)
  ⇒ 镜头卡 z 深  →  Blender y = -z深
  ⇒ 镜头卡 -z（我设定的"海"） → Blender y = +z… 等等，要小心。

  若镜头卡点为 (0, 0, z)，则 Blender y = -z。
    镜头卡 z = -4（"海侧"） → Blender y = +4
    镜头卡 z = +4（"岸侧"） → Blender y = -4

  镜2 我把长椅放在镜头卡 z=+4（岸侧）→ Blender y=-4 ✓ 与演员 y=-4 一致
  相机放在镜头卡 z=-2.4（海侧） → Blender y=+2.4 ✓ 与实测一致

  所以：**相机在海侧，朝岸看**。演员面朝"海"应该是面朝相机（-Y 方向）。
  而 rot=0 让膝盖朝 +Y = 背离相机 = 面朝岸。**这才是错的**。

  要面朝相机（-Y），需要 rot=180。

但之前 v1 用 180 时截图显示"面朝镜头"，我当时判断"错了"——
其实**那是对的**：面朝海 = 面朝相机（因为相机在海侧）。

故：镜2/镜3 应是 rotationDeg=180。
验证：镜2 rot=180 时 knee.y < hips.y（朝 -Y = 朝相机 = 朝海）。
"""
print(__doc__)
print('结论：镜2/镜3 用 rotationDeg=180（面朝海=面朝相机）')
print('镜1：两人沿 +X 走，面朝 +X → rotationDeg=270')
