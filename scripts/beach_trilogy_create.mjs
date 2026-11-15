/**
 * 海滩三镜 · 全链路 —— 建立/更新镜头卡（修正版 v2）。
 *
 * ============================ 修正记录（全部来自实测探针）============================
 *
 * 【修正 1】朝向：`rotationDeg` 与"面朝哪边"的对应
 *   读 .blend 关节坐标实测：
 *     rot=0   → 面朝 Blender +Y  → 镜头卡 -z（**海**）
 *     rot=90  → 面朝 Blender -X
 *     rot=180 → 面朝 Blender -Y  → 镜头卡 +z（**岸**）
 *     rot=270 → 面朝 Blender +X
 *   坐标换算 (x, y=高度, z=深度) → (x, -z, y)：镜头卡 +z(岸) 对应 Blender -Y。
 *   所以"面朝大海"要用 **rot=0**，不是 180。
 *   v1 用 180 → 两人面朝镜头（截图已确认），已改 0。
 *
 * 【修正 2】长椅座面高度
 *   `sit` / `sit-kiss` 姿态实测：髋部世界 z = **0.50m**，脚踝 z = 0.06m。
 *   即"坐在约 0.5m 高的座面上、脚着地"。v1 把座面做成 0.16m，
 *   结果椅子穿过大腿。座面高度改为 **0.50m**。
 *
 * 【修正 3】道具 scale 的轴序
 *   `position` 走 toBlenderVec 换算，但 `scale` **不换算** ——
 *   道具 scale 是 Blender 轴序 (X, Y=深度, Z=高度)。
 *   v1 按镜头卡轴序传 [长, 高, 深]，导致宽深互换。
 *   现在明确按 Blender 轴序写。
 *
 * 【已知限制】
 *   - 动作库没有"牵手"动作。两人只能靠**走得很近**表达亲密，
 *     真正的牵手交给提示词（H3 会按文字补）。
 *   - 预览模式的帧数被 `Math.max(5, …)` 夹到最少 5 帧，
 *     传 frames=1 实际渲 5 帧。属可接受的最小值保护。
 */
import fs from 'node:fs';

const BASE = process.env.JZ_BASE || 'http://127.0.0.1:11712';
const PROJ = process.env.JZ_PROJECT || '';

const C_XZ = '#d97757';   // 丰川祥子
const C_CH = '#4a7fc1';   // 三角初华
const FRAMES = 124;       // 17k+5 网格最短合法值 ≈5.17s @24fps

// 长椅（Blender 轴序：X=长, Y=深, Z=高）
const BENCH = {
  seatTop: 0.50,     // 实测 sit 姿态髋高 0.50
  width: 1.80,
  depth: 0.55,
  seatT: 0.10,
  backH: 0.55,
  backT: 0.08,
};
const BENCH_Z = 4.0;   // 镜头卡坐标里的深度（岸侧）

/**
 * 长椅 = 座板 + 靠背 + 四条腿。
 * 位置用**镜头卡坐标**（会被换算），scale 用 **Blender 轴序**（不换算）。
 */
function benchProps() {
  const { seatTop, width, depth, seatT, backH, backT } = BENCH;
  const cz = BENCH_Z;
  const p = [];

  // 座板：中心高度 = seatTop - seatT/2
  p.push({
    kind: 'box', name: 'BenchSeat',
    position: [0, seatTop - seatT / 2, cz],
    scale: [width, depth, seatT],          // X=长 Y=深 Z=高
    color: '#8a7355',
  });

  // 靠背：在 -Y（Blender）一侧 = 镜头卡 +z 一侧 = 人的背后（人面朝海）
  p.push({
    kind: 'box', name: 'BenchBack',
    position: [0, seatTop + backH / 2, cz + depth / 2 - backT / 2],
    scale: [width, backT, backH],
    color: '#7a6448',
  });

  // 四条腿：从地面到座板底
  const legH = seatTop - seatT;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      p.push({
        kind: 'box', name: `BenchLeg${sx}${sz}`,
        position: [
          sx * (width / 2 - 0.10),
          legH / 2,
          cz + sz * (depth / 2 - 0.08),
        ],
        scale: [0.08, 0.08, legH],
        color: '#6b5740',
      });
    }
  }
  return p;
}

const SHOTS = [
  // ------------------------------------------------------------ 镜 1
  // 沿海岸跟随，视线垂直海岸线朝海。
  // 相机在岸侧（+z），越过两人看海；人物沿 +x 走，相机同步平移。
  {
    id: process.env.SHOT1_ID,
    title: '镜1-牵手漫步',
    description:
      '傍晚的海滩，丰川祥子和三角初华手拉着手，并排沿着海岸线从左往右走。'
      + '镜头跟着她们一起平移，越过她们的背影望向大海。'
      + '海面有细碎的波光，风把她们的头发吹向一侧。',
    actors: [
      /**
       * ⚠️ 几何约束（前两版都踩过）：
       *
       * "两人并排走" 意味着两人在**深度轴**（z）上几乎相同。
       * 而"越过背影望向大海"要求相机在正后方 —— 深度轴正对相机。
       * 两者叠加 ⇒ **一定会前后遮挡**（v1 实测：screen x 0.492 vs 0.494）。
       *
       * 纯侧移机位能分开两人，但就变成"正面拍"，丢掉"背影朝海"（v2 实测）。
       * 纯深度错开也没用 —— 那是沿视线方向错，投影后仍重合（v3 实测）。
       *
       * v4 的解法：**横向错开半个身位**（x 差 0.55），
       * 配合轻微纵向错开（z 差 0.25）+ 相机偏 18°。
       * 这是"两人一前一后稍微错开走路"的自然状态，不破坏并排感，
       * 又能在画面上分开（实测分离度 0.13，足够辨认）。
       */
      {
        name: 'Xiangzi', heightM: 1.66, color: C_XZ,
        position: [-1.75, 0, 0.05], rotationDeg: 270,
        action: 'walk', startFrame: 0, durationFrames: FRAMES,
        from: [-1.75, 0, 0.05], to: [1.75, 0, 0.05],
      },
      {
        name: 'Chuhua', heightM: 1.68, color: C_CH,
        // 横向错开 0.55、纵向错开 0.25
        position: [-1.20, 0, -0.20], rotationDeg: 270,
        action: 'walk', startFrame: 0, durationFrames: FRAMES,
        from: [-1.20, 0, -0.20], to: [2.30, 0, -0.20],
      },
    ],
    props: [],
    /**
     * 镜1 机位 v3 —— 满足"越过背影望向大海"。
     *
     * ⚠️ 前两版的问题：
     *   v1 正后方：两人深度几乎相同（z 0.55 / -0.10），屏幕上完全重合
     *      （实测 screen x 0.492 vs 0.494），只看到一个人。
     *   v2 侧移 3/4：两人分开了，但相机变成了**正面拍**，
     *      成片里两人是面对着镜头走，"越过背影望向大海"完全没实现。
     *
     * v3 的做法：**回到正后方，但把两人的深度错开**。
     *   祥子 z=+0.15（靠岸、离相机近）、初华 z=-0.55（靠海、远）。
     *   深度差 0.70m，在 fov 46 / 距 3.2m 下足以让两人不互相遮挡，
     *   同时相机仍在正后方，视线朝海。
     *
     * 坐标核对（实测确认）：相机在镜头卡 +z 朝 -z 看 ⇒ Blender 朝 -Y 看
     *   ⇒ 屏幕右 = +X ⇒ 人物沿 +x 走 = 画面里向右走 ✓
     */
    camera3d: {
      // 偏 18°：相机在岸侧但略偏，视线仍大方向朝海（-z）
      position: [-0.99, 1.50, 2.84],
      target: [0.30, 1.05, -3.5],
      fov: 46,
      keys: [
        { frame: 0, position: [-2.75, 1.50, 2.84], target: [-1.45, 1.05, -3.5] },
        { frame: 25, position: [-2.38, 1.50, 2.84], target: [-1.08, 1.05, -3.5] },
        { frame: 49, position: [-1.53, 1.50, 2.84], target: [-0.23, 1.05, -3.5] },
        { frame: 74, position: [-0.47, 1.50, 2.84], target: [0.83, 1.05, -3.5] },
        { frame: 98, position: [0.38, 1.50, 2.84], target: [1.68, 1.05, -3.5] },
        { frame: 123, position: [0.75, 1.50, 2.84], target: [2.05, 1.05, -3.5] },
      ],
    },
  },

  // ------------------------------------------------------------ 镜 2
  // 朝岸边，正对面朝大海的长椅；两人从左侧走到椅前并肩坐下。
  {
    id: process.env.SHOT2_ID,
    title: '镜2-坐下',
    description:
      '镜头转向岸边，正对一张面朝大海的长椅。丰川祥子和三角初华从画面左侧并肩走来，'
      + '在长椅前停下，一起坐下，并肩望向大海。',
    actors: [
      {
        name: 'Xiangzi', heightM: 1.66, color: C_XZ,
        position: [-1.9, 0, 2.4], rotationDeg: 0,      // 面朝海（-z）
        action: 'sit-down', startFrame: 0, durationFrames: FRAMES,
        from: [-1.9, 0, 2.4], to: [-0.42, 0, BENCH_Z],
      },
      {
        name: 'Chuhua', heightM: 1.68, color: C_CH,
        position: [-2.3, 0, 3.0], rotationDeg: 0,
        action: 'sit-down', startFrame: 0, durationFrames: FRAMES,
        from: [-2.3, 0, 3.0], to: [0.42, 0, BENCH_Z],
      },
    ],
    props: benchProps(),
    camera3d: { position: [0.0, 1.35, -2.4], target: [0.0, 0.80, BENCH_Z], fov: 50 },
  },

  // ------------------------------------------------------------ 镜 3
  // 坐在椅上的两人各自转头相向、亲吻。3/4 侧机位看清两张脸。
  {
    id: process.env.SHOT3_ID,
    title: '镜3-亲吻',
    description:
      '坐在长椅上的两人，各自把脸转向对方，慢慢靠近，最后亲在一起。'
      + '傍晚的天光打在她们侧脸上，头发被海风吹动。',
    actors: [
      {
        name: 'Xiangzi', heightM: 1.66, color: C_XZ,
        position: [-0.34, 0, BENCH_Z], rotationDeg: 0,
        action: 'sit-kiss', startFrame: 0, durationFrames: FRAMES,
      },
      {
        name: 'Chuhua', heightM: 1.68, color: C_CH,
        position: [0.34, 0, BENCH_Z], rotationDeg: 0,
        action: 'sit-kiss', startFrame: 0, durationFrames: FRAMES,
      },
    ],
    props: benchProps(),
    camera3d: { position: [-1.55, 1.15, BENCH_Z - 2.6], target: [0.0, 0.72, BENCH_Z], fov: 46 },
  },
];

async function main() {
  if (!PROJ) throw new Error('need JZ_PROJECT');
  const tok = await (await fetch(`${BASE}/jiuzhang/api/token`)).json();
  const H = { 'X-JZ-Token': tok.token, 'Content-Type': 'application/json' };

  const out = [];
  for (const s of SHOTS) {
    const shot = {
      ...(s.id ? { id: s.id } : {}),
      title: s.title,
      durationSec: 5,
      ratio: '16:9',
      profile: 'P12-draft',
      mode: 'ref2va',
      description: s.description,
      sound: '海浪声，远处海鸥，风吹过沙滩',
      actors: s.actors,
      props: s.props,
      camera3d: s.camera3d,
    };
    const r = await fetch(`${BASE}/jiuzhang/api/projects/${PROJ}/shots`, {
      method: 'POST', headers: H, body: JSON.stringify({ shot }),
    });
    const j = await r.json();
    if (!r.ok) { console.error('FAIL', s.title, j); continue; }
    out.push({ id: j.id, title: j.title });
    console.log(`${s.title} -> ${j.id}  actors=${j.actors?.length} props=${j.props?.length}`);
  }
  fs.writeFileSync(process.env.TEMP + '/jz-beach/shots.json', JSON.stringify(out, null, 2));
  console.log('\nwritten:', process.env.TEMP + '/jz-beach/shots.json');
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
