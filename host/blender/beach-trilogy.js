/**
 * 三段白模场景（《海滩》三镜）—— 供 Blender 渲染控制序列。
 *
 * 剧本：三角初华 + 丰川祥子 在黄昏海滩并肩散步 → 走到长椅前坐下 → 相向亲吻。
 *
 * 坐标系（镜头卡约定）：(x=左右, y=高度, z=深度)。
 *   两个角色都站在 y=0（地面），z 是他们在场景里的进深。
 *   三人称机位统一放在 +z 侧往里看（见 camera.position 的 z 为正）。
 *
 * 为什么把机位/走位写在这里而不是从镜头卡读：
 *   这一轮要验证的是「Blender 白模 → H3 成片」的能力，
 *   需要**可控的、逐段连续的**走位。等验证通过后，这些参数会通过
 *   渲染页的「3D 走位」面板保存进镜头卡（字段结构完全一致）。
 */

/** 角色身高与配色（与角色卡一致：初华金发、祥子紫发） */
const A = { name: 'Tokiwa', heightM: 1.68, color: '#ffb347' };   // 三角初华
const B = { name: 'Sakiko', heightM: 1.66, color: '#a06cff' };    // 丰川祥子

/** 长椅（灰盒）：放在场景中段，两人最终坐在这里 */
const BENCH = {
  kind: 'box',
  name: 'bench',
  position: [0, 0.28, 0.6],   // x=左右, y=高度, z=深度
  scale: [1.5, 0.55, 0.5],
  color: '#8b6f47',
};

/** 三人称机位：站在 +z 侧（也就是"岸侧"），朝 -z 看 */
/** 机位（镜头卡语义：x=左右, y=高度, z=深度；z 为负=机位在人物后方往里看） */
const CAM = {
  /** 镜1 侧向跟拍（与人物同速横移） */
  walk: { position: [0, 1.55, -4.2], target: [0, 0.95, 0.4], fov: 45 },
  /** 镜2 正面略推近（坐下） */
  sit: { position: [0, 1.5, -3.8], target: [0, 0.85, 0.2], fov: 45 },
  /** 镜3 侧前方推近特写（亲吻） */
  kiss: { position: [0.9, 1.45, -3.2], target: [0, 1.0, 0.15], fov: 42 },
};

/**
 * 镜1 · 牵手漫步（3.0 秒 / 72 帧）
 *
 * 两人从画面左右两端并向中心走，最后在长椅前站定。
 * 用 `from`/`to` 驱动整体位移，`walk` 动作驱动腿。
 */
export const SHOT1 = {
  name: '镜1·牵手漫步',
  width: 864, height: 480, fps: 24, frames: 72,
  ground: true,
  camera3d: CAM.walk,
  actors: [
    { ...A, position: [-1.1, 0, 0.85], action: 'walk', rotationDeg: 90,
      startFrame: 0, durationFrames: 72,
      from: [-1.1, 0, 0.85], to: [-0.22, 0, 0.30] },
    { ...B, position: [0.9, 0, 0.85], action: 'walk', rotationDeg: -90,
      startFrame: 0, durationFrames: 72,
      from: [0.9, 0, 0.85], to: [0.20, 0, 0.30] },
  ],
  props: [BENCH],
};

/**
 * 镜2 · 坐下（3.75 秒 / 90 帧）
 *
 * 承接镜1 结束位置（两人站在长椅前），坐下。
 * ⚠️ 起点必须与镜1 的终点**逐字对齐** —— 否则拼起来会瞬移。
 */
export const SHOT2 = {
  name: '镜2·坐下',
  width: 864, height: 480, fps: 24, frames: 90,
  ground: true,
  camera3d: CAM.sit,
  actors: [
    { ...A, position: [-0.22, 0, 0.30], action: 'sit', rotationDeg: 0,
      startFrame: 6, durationFrames: 54,
      from: [-0.22, 0, 0.30], to: [-0.26, 0, 0.16] },
    { ...B, position: [0.20, 0, 0.30], action: 'sit', rotationDeg: 0,
      startFrame: 6, durationFrames: 54,
      from: [0.20, 0, 0.30], to: [0.24, 0, 0.16] },
  ],
  props: [BENCH],
};

/**
 * 镜3 · 亲吻（3.0 秒 / 72 帧）
 *
 * 承接镜2 的坐下位置，两人相向倾身。
 * 用 `hug` 的关节曲线近似"倾身靠近"（手臂环抱）。
 */
export const SHOT3 = {
  name: '镜3·亲吻',
  width: 864, height: 480, fps: 24, frames: 72,
  ground: true,
  camera3d: CAM.kiss,
  actors: [
    { ...A, position: [-0.26, 0, 0.16], action: 'hug', rotationDeg: 90,
      startFrame: 0, durationFrames: 72,
      from: [-0.26, 0, 0.16], to: [-0.12, 0, 0.14] },
    { ...B, position: [0.24, 0, 0.16], action: 'hug', rotationDeg: -90,
      startFrame: 0, durationFrames: 72,
      from: [0.24, 0, 0.16], to: [0.10, 0, 0.14] },
  ],
  props: [BENCH],
};

export const SHOTS = [SHOT1, SHOT2, SHOT3];

/** 相邻两段的接缝检查：上一段终点是否等于下一段起点 */
export function seamIssues(shots = SHOTS) {
  const issues = [];
  const eps = 1e-3;
  for (let i = 0; i < shots.length - 1; i++) {
    const cur = shots[i];
    const next = shots[i + 1];
    const curEnd = new Map(cur.actors.map((a) => [a.name, a.to ?? a.position]));
    for (const a of next.actors) {
      const p = curEnd.get(a.name);
      if (!p) { issues.push(`${next.name}：${a.name} 在上一段里不存在`); continue; }
      const q = a.from ?? a.position;
      const d = Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
      if (d > eps) {
        issues.push(`${cur.name} → ${next.name}：${a.name} 位置跳变 ${d.toFixed(3)}m`
          + ` (${p.map((v) => v.toFixed(2)).join(',')} → ${q.map((v) => v.toFixed(2)).join(',')})`);
      }
    }
  }
  return issues;
}
