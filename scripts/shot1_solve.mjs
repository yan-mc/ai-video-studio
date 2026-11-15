// 镜1 机位求解：既要"越过背影望向大海"，又要两人不遮挡
//
// 几何事实：
//   相机朝 -z 看（正后方），人物沿 +x 并排走。
//   "并排"意味着两人只在 z（深度）上略有差别 —— 而深度方向正对相机，
//   所以**正后方机位必然前后遮挡**。这是几何必然，不是参数没调好。
//
// 两条出路：
//   A) 相机偏转 15–25 度（仍是"从背后看"），两人在画面上分开
//   B) 两人在 x 上错开半个身位（自然步态），相机纯正后方
//
// 选 A 为主：保住"背影朝海"语义。给出 0/15/20/25 度的相机坐标。

const FOV = 46;
const R = 3.2;            // 相机到人物中心的地面距离
const actorCenterZ = -0.2; // 两人深度中点（镜头卡坐标）
const camY = 1.50;

function cam(deg) {
  const rad = (deg * Math.PI) / 180;
  // 相机在人物"背后偏"位置：z 比人物大（岸侧），x 侧偏
  const x = -Math.sin(rad) * R;
  const z = actorCenterZ + Math.cos(rad) * R;
  return { deg, x: +x.toFixed(2), z: +z.toFixed(2) };
}

console.log('镜头卡坐标（相机在岸侧、偏角）:');
for (const d of [0, 12, 18, 24, 30]) {
  const c = cam(d);
  console.log(`  偏 ${String(d).padStart(2)}° → 相机 (x=${String(c.x).padStart(6)}, y=${camY}, z=${c.z.toFixed(2)})`);
}

// 屏幕横向分离估算：两人深度差 dz，偏角 deg
// 横向屏幕位移 ≈ (dz * sin(deg) + dx * cos(deg)) / 距离
function separation(deg, dz, dx) {
  const rad = (deg * Math.PI) / 180;
  return (Math.abs(dz * Math.sin(rad) + dx * Math.cos(rad)) / R).toFixed(3);
}
console.log('\n两人屏幕横向分离（相对值，>0.15 基本可分辨）:');
console.log('  两人深度差 dz=0.7, 横向差 dx=0.0');
for (const d of [0, 12, 18, 24, 30]) {
  console.log(`    偏 ${String(d).padStart(2)}° → 分离 ${separation(d, 0.7, 0)}`);
}

console.log('\n推荐：偏 18–24°，配合两人 0.7m 深度差 + 0.2m 横向差');
for (const d of [18, 24]) {
  console.log(`    偏 ${d}° → 分离 ${separation(d, 0.7, 0.2)}`);
}
