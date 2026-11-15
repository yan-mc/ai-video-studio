/**
 * 海滩三镜 —— 把 blockout 挂成参考视频并提交 H3 生成。
 *
 * 走的是「常规替代方案」：Blender 只负责运动与空间，
 * 参考视频进 Ref2VA 的 ref_videos，外观交给提示词 + 角色卡。
 */
import fs from 'node:fs';

const BASE = process.env.JZ_BASE || 'http://127.0.0.1:11712';
const PROJ = process.env.JZ_PROJECT || '';
const BEACH = process.env.TEMP + '/jz-beach';

// 三镜各自的 blockout 相对路径（实测渲染产物）
const BLOCKOUTS = {
  '镜1-牵手漫步': process.env.S1_REL,
  '镜2-坐下': process.env.S2_REL,
  '镜3-亲吻': process.env.S3_REL,
};

// 角色卡 id（已有的两张，用来锁外观）
const CARDS = JSON.parse(process.env.JZ_CARDS || '[]');

async function main() {
  const tok = await (await fetch(`${BASE}/jiuzhang/api/token`)).json();
  const H = { 'X-JZ-Token': tok.token, 'Content-Type': 'application/json' };

  const shots = JSON.parse(fs.readFileSync(`${BEACH}/shots.json`, 'utf8'));
  const started = [];

  for (const s of shots) {
    const rel = BLOCKOUTS[s.title];
    if (!rel) { console.error('缺 blockout:', s.title); continue; }

    // 取当前镜头卡，补上 refs.videos 与 cardIds
    const cur = (await (await fetch(`${BASE}/jiuzhang/api/projects/${PROJ}/shots`)).json())
      .find((x) => x.id === s.id);
    if (!cur) { console.error('镜头不存在:', s.id); continue; }

    const body = {
      shot: {
        id: s.id,
        title: cur.title,
        durationSec: cur.durationSec ?? 5,
        ratio: cur.ratio ?? '16:9',
        profile: cur.profile ?? 'P12-draft',
        mode: 'ref2va',
        description: cur.description,
        sound: cur.sound,
        actors: cur.actors,
        props: cur.props,
        camera3d: cur.camera3d,
        cardIds: CARDS,
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
    const pj = await put.json();
    if (!put.ok) { console.error('更新失败', s.title, pj); continue; }
    console.log(`${s.title}: videos=${pj.refs?.videos?.length} cards=${pj.cardIds?.length}`);

    // 提交生成
    const gen = await fetch(`${BASE}/jiuzhang/api/generate`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ projectId: PROJ, shotId: s.id, backend: 'h3-local' }),
    });
    const gj = await gen.json();
    if (!gen.ok) { console.error('生成提交失败', s.title, gj); continue; }
    console.log(`  -> job ${gj.id} (${gj.status})`);
    started.push({ title: s.title, jobId: gj.id });
  }

  fs.writeFileSync(`${BEACH}/jobs.json`, JSON.stringify(started, null, 2));
  console.log('\njobs written:', `${BEACH}/jobs.json`);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
