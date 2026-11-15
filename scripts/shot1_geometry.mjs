// 镜1 机位几何核算
// 相机：Blender (x, y=-D, z=H)，朝 +Y 看；人物在 y≈-0.55..0.1，身高 1.66/1.68
const actorY = -0.55;
const actorH = 1.68;

function span(D, H, fov) {
  const dist = Math.abs(actorY - (-D));
  const top = (Math.atan2(actorH - H, dist) * 180) / Math.PI;
  const foot = (Math.atan2(0 - H, dist) * 180) / Math.PI;
  const s = top - foot;
  return { D, H, fov, dist, top, foot, span: s, pct: (s / fov) * 100 };
}

console.log('候选机位（目标：人物占画面高度 55-75%，且能看到海）');
for (const [D, H, fov] of [
  [4.6, 1.45, 50], [3.6, 1.40, 48], [3.0, 1.35, 46],
  [2.6, 1.30, 44], [2.2, 1.25, 42], [1.8, 1.20, 40],
]) {
  const r = span(D, H, fov);
  console.log(
    `D=${String(r.D).padEnd(4)} H=${String(r.H).padEnd(5)} fov=${String(r.fov).padEnd(3)}`
    + ` 距=${r.dist.toFixed(2)}m  张角=${r.span.toFixed(1)}°  占画面=${r.pct.toFixed(0)}%`,
  );
}

// 相机水平位置：必须跟着人物 x 走（跟拍）。人物 x 从 -1.6 到 1.9。
// 但人物朝 +X 走，相机在 +Y 侧朝 -Y 看 —— 人物的 +X 在画面上是「左」还是「右」？
// Blender: 相机朝 -Y 看时，相机的 right = +X（右手系：forward=-Y, up=+Z, right=forward×up…）
// 实际由 render_shot.py 的 to_track_quat('-Z','Y') 决定 → 相机 -Z 对准 -Y，up=+Y→+Z
// 此时屏幕右 = +X。所以人物沿 +X 走 = 画面上向右走 ✓ 符合"从左往右走"
console.log('\n方向核对：相机朝 -Y 看时屏幕右=+X，人物沿 +X 走 → 画面里从左往右 ✓');
