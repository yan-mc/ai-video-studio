/**
 * 海滩三镜 —— 写入**英文**描述并重新生成。
 *
 * ============================ 为什么改成英文 ============================
 * 官方 H3 提示词规范是 **English-only**，中文只允许出现在 `<d>[Chinese] …</d>`
 * 台词内。编译器自检已经报出 "正文里有 N 个中文字符"。
 *
 * 这不是能靠"容忍"绕过的：本轮实跑里三条镜头的正文都是中文，
 * 而官方训练分布是英文。所以这一轮把 description 换成英文，
 * 中文场景描述**保留在镜头卡 title 与 note 里**作为人类可读记录。
 *
 * 同时也验证了：`/prompt/from-shot` 与 `/generate` 现在走同一份入参
 * （都经 withVaultCards），角色卡会真的进 `<Subject N>`。
 */
import fs from 'node:fs';

const BASE = process.env.JZ_BASE || 'http://127.0.0.1:11712';
const PROJ = process.env.JZ_PROJECT || '';
const BEACH = process.env.TEMP + '/jz-beach';

// 三镜英文描述（严格的官方顺序：主体 → 动作 → 镜头 → 光线 → 声音）
const EN = {
  '镜1-牵手漫步':
    'Evening beach. Xiangzi and Chuhua walk side by side along the shoreline from left to right, '
    + 'holding hands. The camera tracks alongside them at walking pace and looks past them out over the sea. '
    + 'Low golden sunlight behind the camera, soft rim light on their hair, fine glitter on the water, '
    + 'wind pushing their hair to one side.',
  '镜2-坐下':
    'Evening beach. The camera faces the shore and a wooden bench that looks out over the sea. '
    + 'Xiangzi and Chuhua walk in from the left, stop in front of the bench, and sit down together, '
    + 'both facing the sea. Warm low sun, long soft shadows on the sand, calm water behind them.',
  '镜3-亲吻':
    'Evening beach. Xiangzi and Chuhua are seated on the bench. Each turns her face toward the other, '
    + 'they lean in slowly, and kiss. Warm golden light on their profiles, sea breeze moving their hair, '
    + 'the sea blurred behind them.',
};

const SOUND =
  'Gentle waves lapping the shore, distant seagulls, soft wind across the sand, faint fabric movement.';

const BLOCKOUTS = {
  '镜1-牵手漫步': process.env.S1_REL,
  '镜2-坐下': process.env.S2_REL,
  '镜3-亲吻': process.env.S3_REL,
};

async function main() {
  const tok = await (await fetch(`${BASE}/jiuzhang/api/token`)).json();
  const H = { 'X-JZ-Token': tok.token, 'Content-Type': 'application/json' };
  const shots = JSON.parse(fs.readFileSync(`${BEACH}/shots.json`, 'utf8'));
  const out = [];

  for (const s of shots) {
    const en = EN[s.title];
    const rel = BLOCKOUTS[s.title];
    if (!en || !rel) { console.error('缺英文描述或 blockout:', s.title); continue; }

    const cur = (await (await fetch(`${BASE}/jiuzhang/api/projects/${PROJ}/shots`)).json())
      .find((x) => x.id === s.id);
    if (!cur) continue;

    const body = {
      shot: {
        id: s.id,
        // title 保留中文，方便人工对照
        title: cur.title,
        durationSec: 5,
        ratio: '16:9',
        profile: 'P12-draft',
        mode: 'ref2va',
        description: en,
        sound: SOUND,
        actors: cur.actors,
        props: cur.props,
        camera3d: cur.camera3d,
        cardIds: cur.cardIds,
        refs: {
          images: [],
          videos: [{ rel, name: 'blockout', hasAudio: false }],
          audios: [],
          videoUses: ['motion'],
        },
      },
    };
    const put = await fetch(`${BASE}/jiuzhang/api/projects/${PROJ}/shots`, {
      method: 'POST', headers: H, body: JSON.stringify(body),
    });
    if (!put.ok) { console.error('更新失败', s.title, await put.text()); continue; }

    // 先确认编译产物
    const comp = await (await fetch(`${BASE}/jiuzhang/api/prompt/from-shot`, {
      method: 'POST', headers: H, body: JSON.stringify({ projectId: PROJ, shotId: s.id }),
    })).json();
    console.log(`\n=== ${s.title} ===`);
    console.log(`  format=${comp.format} frames=${comp.frames} chars=${comp.chars} `
      + `subjects=${comp.subjectCount} fromVault=${comp.fromVault}`);
    if (comp.warnings?.length) console.log('  WARN:', comp.warnings.join(' | '));
    console.log('  --- prompt ---');
    console.log(comp.prompt.split('\n').map((l) => '  ' + l).join('\n'));

    if (comp.warnings?.some((w) => w.includes('中文字符'))) {
      console.error('  ⚠️ 仍有中文，跳过生成');
      continue;
    }

    const gen = await fetch(`${BASE}/jiuzhang/api/generate`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ projectId: PROJ, shotId: s.id, backend: 'h3-local' }),
    });
    const gj = await gen.json();
    if (!gen.ok) { console.error('  生成失败', gj); continue; }
    console.log(`  -> job ${gj.id} (${gj.status})`);
    out.push({ title: s.title, jobId: gj.id });
  }

  fs.writeFileSync(`${BEACH}/jobs2.json`, JSON.stringify(out, null, 2));
  console.log('\nwritten:', `${BEACH}/jobs2.json`);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
