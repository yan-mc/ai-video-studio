/**
 * 建立《海滩三镜》的三个 Blender 场景（10 秒 / 3 镜头）。
 *
 *   node scripts/build-beach-shots.mjs [baseUrl]
 *
 * ==========================================================================
 * 空间语义（镜头卡坐标系：x=左右, y=高度, z=深度）
 * ==========================================================================
 *
 * 约定（与 buildSceneSpec 的 toBlenderVec 一致）：
 *   · 海岸线沿 **X 轴**，两人沿 X 走
 *   · **+Z 是海**（远处），**−Z 是岸/摄影机侧**（近处）
 *   · 镜头卡 z 为负 = 机位在主体"前方"，朝 +Z 看
 *
 * 三条要求 → 坐标：
 *   镜1 "镜头方向垂直于海岸线，朝向大海，跟随二人移动"
 *        → 机位在 −Z 侧，看向 +Z（海），沿 X 平移跟拍
 *   镜2 "旋转 180° 朝向岸边"
 *        → 机位翻到 +Z 侧，看向 −Z（岸）
 *        ⚠️ 但这样人背对镜头，看不到"坐下"。
 *           实际影视做法：180° 是**相对上一镜的视线方向**，
 *           即镜1 看海 → 镜2 看岸；人物在画面里由"背对"转"面对"。
 *           本实现取：镜1 朝 +Z 看（海在背景），镜2 朝 −Z 看（岸在背景），
 *           两人在镜2 里正面朝向镜头（面向岸/镜头）。
 *   镜3 "分别转头面向对方并亲吻" → 特写，两人侧向相对
 *
 * 关键教训（本次踩坑）：机位必须离主体 ~4 米。
 *   参考场景 beach-trilogy 的机位都在 z≈-3.2~-4.2；
 *   之前写成 ±3.3 且 target 贴近，导致人偶撑满画面。
 *
 * ==========================================================================
 * 时间分配（10 秒，H3 帧数网格 17k+5）
 * ==========================================================================
 *   镜1  0.00–3.75s   90 帧   牵手漫步（平行海岸线，横向跟拍）
 *   镜2  3.75–7.50s   90 帧   坐下（机位 180° 转向岸）
 *   镜3  7.50–10.0s   72 帧   相向转头亲吻（特写）
 *   合计 252 帧 = 10.5s —— H3 只能出网格帧数，这是最接近 10 秒的合法切分
 */

import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:3165';
const API = `${BASE}/jiuzhang/api`;
const PROJECT = 'proj_mwfrgfb9tsy7f7';

const CARD_TOKIWA = 'card_mwfo40qsf26w5e';   // 三角初华
const CARD_SAKIKO = 'card_mwfo4no7uyrfg5';   // 丰川祥子

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

const token = (await j(`${API}/token`)).body.token;
const H = { 'content-type': 'application/json', 'x-jz-token': token };

/* ---------------------------------------------------------------- 镜头 1
 * 牵手漫步 · 平行海岸线横向跟拍
 *
 * 机位在 −Z（岸侧）1.5m 高，看向 +Z（海）。视线垂直于海岸线，海在背景。
 * 两人沿 +X 走，机位同步沿 +X 平移 —— 横向滑轨跟拍。
 * 两人手牵手：间距 0.45m，朝向 +Z（看海）会有背对镜头的问题，
 * 所以本镜让她们侧身（yaw=90，即面朝 +X 行走方向），
 * 机位在侧前方拍 —— 这是"牵手散步侧跟"的标准构图。
 */
const SHOT1 = {
  title: '镜1·牵手漫步',
  durationSec: 3.75,
  ratio: '16:9',
  profile: 'P12-draft',
  mode: 'ref2va',
  backend: 'h3-local',
  cardIds: [CARD_TOKIWA, CARD_SAKIKO],
  actors: [
    {
      name: 'Tokiwa', heightM: 1.68, color: '#ffb347',
      // 沿 +X 走：yaw=90 让正面朝 +X（行走方向），侧对镜头
      position: [-1.20, 0, 0.62], rotationDeg: 90,
      action: 'walk', startFrame: 0, durationFrames: 90,
      from: [-1.20, 0, 0.62], to: [0.60, 0, 0.62],
      emotion: 'tender', intensity: 1.0,
    },
    {
      name: 'Sakiko', heightM: 1.66, color: '#a06cff',
      position: [-0.78, 0, 0.98], rotationDeg: 90,
      action: 'walk', startFrame: 0, durationFrames: 90,
      from: [-0.78, 0, 0.98], to: [1.02, 0, 0.98],
      emotion: 'tender', intensity: 1.0,
    },
  ],
  props: [],
  camera3d: {
    // −Z 侧、1.5m 高、距离 ~4.5m；朝 +Z 看（海在后方）
    position: [0, 1.50, -4.50],
    target: [0, 0.92, 0.60],
    fov: 45,
    // 跟拍：机位与两人同步沿 +X 平移约 1.8m（正好是她们的位移量）
    keys: [
      { frame: 0, position: [-0.90, 1.50, -4.50], target: [-0.90, 0.92, 0.60] },
      { frame: 89, position: [0.90, 1.50, -4.50], target: [0.90, 0.92, 0.60] },
    ],
  },
  description: '黄昏海滩，三角初华与丰川祥子手牵手沿着海岸线并肩散步，镜头侧向跟拍，海面在她们身后。',
  prompt: '',
};

/* ---------------------------------------------------------------- 镜头 2
 * 坐下 · 机位旋转 180° 朝向岸边
 *
 * 空间关系（Blender: X=左右, Y=深度, Z=高度）：
 *   人坐在长椅上、面朝海（+Y 深度方向）。
 *   椅面在人的**正下方**（Z 0.30~0.46），椅背在人的**身后**（+Y）。
 *   机位在**岸侧**（−Y）、比椅背**更靠后**、且**高于椅背**，
 *   这样视线越过椅背看到坐着的两个人 —— 这是"海边长椅"的标准构图。
 *
 * ⚠️ 踩过的坑（两次）：
 *   ① 把长椅放在人与相机之间 → 整个下半身被椅面横切遮住；
 *   ② 机位低于椅面顶 → 椅面占掉画面下半，人物只剩上半身。
 *   结论：机位 Y 必须比椅背更负（更靠岸），Z 必须高于椅背顶。
 */
const SHOT2 = {
  title: '镜2·坐下',
  durationSec: 3.75,
  ratio: '16:9',
  profile: 'P12-draft',
  mode: 'ref2va',
  backend: 'h3-local',
  cardIds: [CARD_TOKIWA, CARD_SAKIKO],
  actors: [
    {
      name: 'Tokiwa', heightM: 1.68, color: '#ffb347',
      // 坐在椅上、面朝海(+Z)。z 是深度：椅子中心在 0.30，人坐在 0.30 略前
      position: [-0.42, 0, 0.20], rotationDeg: 0,
      action: 'sit-down', startFrame: 6, durationFrames: 78,
      from: [-0.42, 0, 0.60], to: [-0.42, 0, 0.26],
      emotion: 'tender', intensity: 0.9,
    },
    {
      name: 'Sakiko', heightM: 1.66, color: '#a06cff',
      position: [0.42, 0, 0.20], rotationDeg: 0,
      action: 'sit-down', startFrame: 6, durationFrames: 78,
      from: [0.42, 0, 0.60], to: [0.42, 0, 0.26],
      emotion: 'tender', intensity: 0.9,
    },
  ],
  props: [
    // 椅面：宽 1.75m、厚 0.10m（薄板）、深 0.50m，顶面 0.42m
    // （厚 0.42 会变成一整块实心砖，挡住腿 —— 实测踩过）
    { kind: 'box', name: 'bench_seat', position: [0, 0.37, 0.30], rotationDeg: 0,
      scale: [1.75, 0.10, 0.50], color: '#8b6f47' },
    // 椅背：薄板，在椅面后方，顶到 0.98m
    { kind: 'box', name: 'bench_back', position: [0, 0.80, 0.53], rotationDeg: 0,
      scale: [1.75, 0.36, 0.07], color: '#7a5f3c' },
  ],
  camera3d: {
    // 岸侧(−Z)、1.85m 高、距离 5.2m（人物 + 椅子完整入画）
    position: [0, 1.85, -5.20],
    target: [0, 0.90, 0.32],
    fov: 42,
    keys: [
      { frame: 0, position: [0, 1.92, -5.60], target: [0, 0.94, 0.32] },
      { frame: 89, position: [0, 1.78, -4.70], target: [0, 0.86, 0.32] },
    ],
  },
  description: '镜头转到岸边一侧，两人并肩坐在木制长椅上，面朝大海，暮色逆光。',
  prompt: '',
};

/* ---------------------------------------------------------------- 镜头 3
 * 相向转头亲吻 · 特写
 *
 * 两人已坐在长椅上、面对面。本镜是**侧向特写**：
 *   机位放在两人连线的**垂直方向**（+Z 侧，即海那边），
 *   正对她们侧面 —— 这样能同时看到两张脸的靠近，是亲吻镜头的标准机位。
 *
 * ⚠️ 不能放在 -Z（岸侧）：那里有椅背，会横切画面挡住两个人下半身（实测）。
 *    也不能放太近：坐姿人偶总高约 1.2m，机位要拉到 2.6m 才能完整入画。
 */
const SHOT3 = {
  title: '镜3·亲吻',
  durationSec: 3.0,
  ratio: '16:9',
  profile: 'P12-draft',
  mode: 'ref2va',
  backend: 'h3-local',
  cardIds: [CARD_TOKIWA, CARD_SAKIKO],
  actors: [
    {
      name: 'Tokiwa', heightM: 1.68, color: '#ffb347',
      // 坐在椅上（z=0.26），朝 +X 面向祥子；倾身靠近
      position: [-0.32, 0, 0.26], rotationDeg: 90,
      action: 'sit-kiss', startFrame: 0, durationFrames: 72,
      from: [-0.32, 0, 0.26], to: [-0.17, 0, 0.30],
      emotion: 'intimate', intensity: 0.8,
    },
    {
      name: 'Sakiko', heightM: 1.66, color: '#a06cff',
      position: [0.32, 0, 0.26], rotationDeg: -90,
      action: 'sit-kiss', startFrame: 0, durationFrames: 72,
      from: [0.32, 0, 0.26], to: [0.17, 0, 0.30],
      emotion: 'intimate', intensity: 0.8,
    },
  ],
  props: [
    // 只保留椅面（薄板）；不要椅背 —— 本镜是侧面特写，椅背会挡住人脸
    { kind: 'box', name: 'bench_seat', position: [0, 0.37, 0.30], rotationDeg: 0,
      scale: [1.75, 0.10, 0.50], color: '#8b6f47' },
  ],
  camera3d: {
    // 海侧(+Z)、1.25m 高（与坐姿头部齐平）、距离 2.9m —— 正对两人侧面
    position: [0, 1.25, 2.90],
    target: [0, 1.02, 0.30],
    fov: 38,
    keys: [
      { frame: 0, position: [0, 1.30, 3.30], target: [0, 1.05, 0.30] },
      { frame: 71, position: [0, 1.20, 2.50], target: [0, 0.99, 0.30] },
    ],
  },
  description: '特写：两人坐在长椅上，缓缓转头面向对方，闭上眼，倾身亲吻，暮色逆光，浅景深。',
  prompt: '',
};

const SHOTS = [SHOT1, SHOT2, SHOT3];

/* ---------------------------------------------------------------- 写入 */
const cfgMod = await import(pathToFileURL(path.join(process.cwd(), 'host/config.js')).href);
const cfg = cfgMod.loadConfig();
const shotsFile = path.join(cfg.dataDir, 'shots', PROJECT, 'shots.json');
fs.mkdirSync(path.dirname(shotsFile), { recursive: true });
fs.writeFileSync(shotsFile, '[]', 'utf8');
console.log(`已清空 ${path.relative(cfg.dataDir, shotsFile)}`);

const created = [];
for (const s of SHOTS) {
  const r = await j(`${API}/projects/${PROJECT}/shots`, {
    method: 'POST', headers: H, body: JSON.stringify({ shot: s }),
  });
  if (r.status !== 200 || !r.body?.id) {
    console.error(`✗ ${s.title} 保存失败 ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    process.exit(1);
  }
  created.push(r.body);
  const b = r.body;
  console.log(`✓ ${b.title.padEnd(14)} id=${b.id} ${b.durationSec}s actors=${b.actors.length} camKeys=${b.camera3d?.keys?.length ?? 0}`);
}

console.log('\n镜头卡：');
for (const b of created) {
  console.log(`  ${b.id}  ${b.title}`);
  for (const a of b.actors) {
    console.log(`    ${a.name.padEnd(7)} ${a.action.padEnd(10)} yaw=${String(a.rotationDeg).padStart(4)}  ${JSON.stringify(a.from)} -> ${JSON.stringify(a.to)}`);
  }
  console.log(`    cam pos=${JSON.stringify(b.camera3d.position)} tgt=${JSON.stringify(b.camera3d.target)} fov=${b.camera3d.fov}`);
}
fs.writeFileSync(path.join(cfg.dataDir, 'shots', PROJECT, 'shot-ids.json'),
  JSON.stringify(created.map((c) => ({ id: c.id, title: c.title })), null, 2), 'utf8');
