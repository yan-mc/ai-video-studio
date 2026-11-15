/**
 * 为《海滩三镜》写 H3 Ref2VA 六段式提示词（主画风：90年代OVA）。
 *
 *   node scripts/write-beach-prompts.mjs [baseUrl]
 *
 * 依据：skills/jiuzhang-studio-prompt/SKILL.md
 *   · 五条铁律：画风英文、其余中文、音色只绑一次、三字段音效不空、无负面提示词
 *   · 六段式：STYLE / REFERENCE / subject_definitions / CHARACTER DEFINITION /
 *              summary / retention_analysis / non_diegetic_music /
 *              SCENE LAYOUT / overall_soundscape / MOTION DESCRIPTION
 *   · <Picture N> 编号必须与 resolveRefImages 的真实提交顺序一致
 *     （角色卡按 cardIds 顺序 → 初华=1、祥子=2）
 *
 * 三个画风变体：
 *   ova90s     90 年代 OVA（主版）
 *   helltaker-look  地狱把妹王（外观版，会改比例 —— 本片是暗黑戏剧向，适合）
 *   toon3d-pbr 三渲二 + PBR 混合
 */

import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:3165';
const FORCE_STYLE = process.argv[3] || '';   // 强制统一画风（三镜都用它）
const API = `${BASE}/jiuzhang/api`;
const PROJECT = 'proj_mwfrgfb9tsy7f7';

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}
const token = (await j(`${API}/token`)).body.token;
const H = { 'content-type': 'application/json', 'x-jz-token': token };

/* ---------------------------------------------------------------- 画风片段
 * 直接取自 skill 的 9 种画风库原文（英文，不改写）。
 */
const STYLE = {
  'ova90s': {
    name: '90年代OVA',
    en: '90s OVA animation style. Cel animation look. High saturation colors. Hard shadows (not block shadows). Film grain texture. Natural human proportions. Soft gradient blush. Thick but not jagged outlines. 4K.',
    forbid: '写实质感、实拍质感、3D比例、粗黑锯齿轮廓、块状阴影',
  },
  'helltaker-look': {
    name: '地狱把妹王（外观版）',
    en: 'Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cartoon character design — slightly larger head, slender limbs, flat torso, simplified geometric shapes. Thick jagged black outlines. Flat cel-shaded coloring with block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. NO photorealistic textures, NO realistic skin shading, NO 3D proportions, NO PBR materials.',
    forbid: '写实质感、写实皮肤阴影、3D比例、PBR材质、渐变、柔光、模糊、照片级渲染',
  },
  'toon3d-pbr': {
    name: '三渲二+PBR混合',
    en: '3D cel-shaded animation with PBR rendering. Thin dark outlines (not thick hand-drawn lines). Subsurface scattering on skin — soft, translucent, delicate. Soft studio lighting. Smooth shadow transitions, soft diffused shadows. Realistic fabric textures with wrinkles and bump. 3D physical hair strands with clear groups. Clean render, smooth surfaces.',
    forbid: '粗黑手绘轮廓线、纯平涂赛璐珞、硬块状阴影、写实人类皮肤质感',
  },
};

/* ------------------------------------------------------------ 角色（只写一次外观）
 * ⚠️ 外观只在这两个块里绑定一次，分镜里不再重复（skill 的"结构铁律"）。
 */
const CHARS = {
  tokiwa: {
    name: '三角初华',
    s: 'S1',
    picture: 1,
    heightCm: 168,
    look: '金色短发、金色眼瞳、白色礼帽、黑色露肩上衣与黑色长裙、黑色长靴',
    traits: '沉静、温柔、习惯照顾对方',
    voice: '中低音女声，语调平缓，气声偏多',
  },
  sakiko: {
    name: '丰川祥子',
    s: 'S2',
    picture: 2,
    heightCm: 166,
    look: '淡紫色长发、紫色眼瞳、深色发饰、黑色礼裙与紫色披肩、黑色长靴',
    traits: '清冷、克制、情绪不外露',
    voice: '偏高而清亮的女声，尾音干脆',
  },
};

/** 三个镜头的内容描述（与 Blender 场景一一对应）。 */
const SHOTS = [
  {
    title: '镜1·牵手漫步',
    styleId: 'ova90s',
    dur: 3.75,
    shotSize: '中景',
    scene: '黄昏的海滩。海岸线沿画面横向延伸，海面在人物身后远处，天空是落日余晖的橙红色渐变，海面浮着细碎的金色波光。沙滩占画面下方三分之一。',
    action: '三角初华与丰川祥子并肩、手牵手沿着海岸线行走，两人都侧向对着镜头，步伐一致，手臂自然交握。',
    camera: '镜头从海面一侧横向平移跟拍，与两人保持固定距离同速移动，视线垂直于海岸线。',
    soundscape: '海浪缓慢拍岸的连续白噪，脚下沙地被踩实的细碎声响，远处一两声海鸟啼叫。',
    music: 'N/A',
    dialogue: null,
  },
  {
    title: '镜2·坐下',
    styleId: 'ova90s',
    dur: 3.75,
    shotSize: '全景',
    scene: '同一片黄昏海滩，摄影机此时位于岸的一侧、朝向海面。一张木制长椅立在沙滩上，椅面朝向大海。天空的橙红落在海平面上，长椅与沙地投下长长的暖色影子。',
    action: '两人走到长椅前，并肩坐下。动作是缓慢下坐、膝盖弯曲、上身微微前倾，坐定后肩膀自然靠在一起。',
    camera: '固定机位，镜头极缓慢地向前推进，视点略高于椅背。',
    soundscape: '海浪持续拍岸，木头在承重时发出轻微吱呀声，衣料与椅面摩擦的细响。',
    music: 'N/A',
    dialogue: null,
  },
  {
    title: '镜3·亲吻',
    styleId: 'ova90s',
    dur: 3.0,
    shotSize: '近景特写',
    scene: '紧接上一镜。两人并坐在长椅上，机位在她们侧面，背景是虚化的橙色海面与夕阳光斑。',
    action: '两人分别缓缓转头面向对方，视线相触，随即闭眼、上身倾近，双唇轻触后停留。手臂抬起环向对方肩背。',
    camera: '镜头极缓慢推进至双人侧脸近景，焦点落在两人面部。',
    soundscape: '海浪退成远景底噪，呼吸声变得清晰，衣料轻微的窸窣声。',
    music: 'N/A',
    dialogue: null,
  },
];

/* ---------------------------------------------------------------- 编译 */
function buildPrompt(shot, style) {
  const T = CHARS.tokiwa;
  const S = CHARS.sakiko;

  const lines = [];
  lines.push('CRITICAL STYLE RULE:');
  lines.push(style.en);
  lines.push(`禁止：${style.forbid}。`);
  lines.push('NO subtitles, NO on-screen text.');
  lines.push('');

  lines.push('CRITICAL REFERENCE RULE:');
  lines.push(`- <Picture 1> 是 ${T.name} 的外观参考 — 面部、发型、服装全部保持一致。`);
  lines.push(`- <Picture 2> 是 ${S.name} 的外观参考 — 面部、发型、服装全部保持一致。`);
  lines.push('');

  lines.push('subject_definitions:');
  lines.push(`${T.name} = 外观来自 <Picture 1> — ${T.look}。身高 ${T.heightCm}cm。此角色为说话人 (${T.s})。`);
  lines.push(`${S.name} = 外观来自 <Picture 2> — ${S.look}。身高 ${S.heightCm}cm。此角色为说话人 (${S.s})。`);
  lines.push('');

  for (const c of [T, S]) {
    lines.push(`CHARACTER DEFINITION — ${c.name} (${c.s}):`);
    lines.push(`- 性别：FEMALE`);
    lines.push(`- 身高：${c.heightCm}cm`);
    lines.push(`- 关键特征：${c.look}`);
    lines.push(`- 性格：${c.traits}`);
    lines.push(`- 声音：${c.voice}（本镜无台词）`);
    lines.push('');
  }

  lines.push('summary:');
  lines.push(
    shot.title.includes('漫步') ? `${T.name}与${S.name}在黄昏海滩牵手散步，随后走向长椅坐下，最终相向亲吻。`
      : shot.title.includes('坐下') ? `${T.name}与${S.name}走到海边的长椅前并肩坐下，面朝大海。`
        : `${T.name}与${S.name}坐在长椅上，转头相向并亲吻。`,
  );
  lines.push('');

  lines.push('retention_analysis:');
  lines.push(`${T.name}（出现在 <Picture 1>）：fully_preserved — 保持金发、礼帽、黑裙、长靴一致。`);
  lines.push(`${S.name}（出现在 <Picture 2>）：fully_preserved — 保持紫发、发饰、黑礼裙、紫披肩一致。`);
  lines.push('');

  lines.push(`non_diegetic_music: ${shot.music}`);
  lines.push('');

  lines.push('SCENE LAYOUT:');
  lines.push(shot.scene);
  lines.push('');

  lines.push(`overall_soundscape: ${shot.soundscape}`);
  lines.push('');

  lines.push('MOTION DESCRIPTION:');
  const t = shot.dur;
  lines.push(`[0.0s-${t.toFixed(1)}s] ${shot.shotSize}。${shot.action} 运镜：${shot.camera}`);
  lines.push(`音效：${shot.soundscape.split('，')[0]}（叙事内）。`);

  return lines.join('\n');
}

/* ---------------------------------------------------------------- 写入 */
const shots = (await j(`${API}/projects/${PROJECT}/shots`)).body;
if (!Array.isArray(shots) || shots.length !== 3) {
  console.error(`期望 3 张镜头卡，实际 ${Array.isArray(shots) ? shots.length : '读取失败'}`);
  process.exit(1);
}

const byTitle = (kw) => shots.find((s) => s.title.includes(kw));

const plan = [
  { shot: byTitle('漫步'), cfg: SHOTS[0] },
  { shot: byTitle('坐下'), cfg: SHOTS[1] },
  { shot: byTitle('亲吻'), cfg: SHOTS[2] },
];

for (const p of plan) {
  if (!p.shot) { console.error('找不到镜头卡'); process.exit(1); }
  const styleId = FORCE_STYLE || p.cfg.styleId;
  const style = STYLE[styleId];
  if (!style) { console.error(`未知画风 ${styleId}`); process.exit(1); }
  const prompt = buildPrompt(p.cfg, style);
  const r = await j(`${API}/projects/${PROJECT}/shots`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      shot: {
        ...p.shot,
        // 手工提示词优先（compilePrompt 里 >200 字符直接整段使用）
        prompt,
        styleId: styleId,
      },
    }),
  });
  if (r.status !== 200) { console.error(`✗ ${p.cfg.title} 保存失败 ${r.status}`); process.exit(1); }
  console.log(`✓ ${p.cfg.title.padEnd(12)} prompt ${prompt.length} 字  style=${style.name}(${styleId})`);
}

// 落一份到磁盘便于审阅
const outDir = path.join(process.cwd(), 'data', 'prompts');
fs.mkdirSync(outDir, { recursive: true });
for (const p of plan) {
  const styleId = FORCE_STYLE || p.cfg.styleId;
  const style = STYLE[styleId];
  fs.writeFileSync(path.join(outDir, `${p.cfg.title}.${styleId}.txt`),
    buildPrompt(p.cfg, style), 'utf8');
}
fs.writeFileSync(path.join(outDir, 'styles.json'), JSON.stringify(STYLE, null, 2), 'utf8');
console.log(`\n提示词已落盘：${path.relative(process.cwd(), outDir)}`);
