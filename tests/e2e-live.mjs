/**
 * 实机 E2E：把 H3 的所有输入分支都跑一遍（真实提交 ComfyUI）。
 *
 *   node tests/e2e-live.mjs [baseUrl]
 *
 * 覆盖 5 个分支，其中第一个在 v1.4.1 上**必然失败**：
 *   1. 无参考图 + 仅首帧   ← 历史 P0（node_errors['9'] details "'20'"）
 *   2. 无参考图 + 首尾帧
 *   3. 纯文生
 *   4. 单张参考图
 *   5. 参考图 + 控制视频
 *
 * 需要 ComfyUI 在跑。没跑时记 SKIP。
 */

const BASE = process.argv[2] || 'http://127.0.0.1:3165';
const API = `${BASE}/jiuzhang/api`;
const PROJECT = 'proj_mwfrgfb9tsy7f7';

const FAILS = [];
let checks = 0;
const check = (cond, msg) => { checks += 1; if (!cond) FAILS.push(msg); };

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const health = await j(`${API}/health`);
if (!health.body?.h3?.ok) {
  console.log(`SKIP: ComfyUI 不可达（${health.body?.h3?.detail ?? '?'}）`);
  process.exit(0);
}

const token = (await j(`${API}/token`)).body.token;
const H = { 'content-type': 'application/json', 'x-jz-token': token };

// 需要一个可用的控制视频：先渲一路 depth
const shots = await j(`${API}/projects/${PROJECT}/shots`);
const anyShot = Array.isArray(shots.body) ? shots.body.find((s) => s.id) : null;
check(Boolean(anyShot), '找不到可用镜头卡，无法渲控制视频');

let controlRel = '';
if (anyShot) {
  const r = await j(`${API}/blender/render`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ mode: 'depth', projectId: PROJECT, shotId: anyShot.id }),
  });
  if (r.status === 200 && r.body?.rel) controlRel = r.body.rel;
}

const CASES = [
  {
    name: '无参考图 + 仅首帧（历史 P0）',
    shot: {
      title: 'E2E-仅首帧', durationSec: 2, ratio: '16:9', profile: 'P12-draft',
      mode: 't2va', backend: 'h3-local',
      prompt: 'a calm beach at dusk, two figures on a bench',
      previz: { firstFramePath: 'assets/chain_s1_last.png' },
      refs: { images: [] },
    },
  },
  {
    name: '无参考图 + 首尾帧',
    shot: {
      title: 'E2E-首尾', durationSec: 2, ratio: '16:9', profile: 'P12-draft',
      mode: 't2va', backend: 'h3-local',
      prompt: 'a calm beach at dusk',
      previz: { firstFramePath: 'assets/chain_s1_last.png', lastFramePath: 'assets/chain_s2_last.png' },
      refs: { images: [] },
    },
  },
  {
    name: '纯文生',
    shot: {
      title: 'E2E-纯文生', durationSec: 2, ratio: '16:9', profile: 'P12-draft',
      mode: 't2va', backend: 'h3-local',
      prompt: 'a calm beach at dusk', refs: { images: [] },
    },
  },
  {
    name: '单张参考图',
    shot: {
      title: 'E2E-参考图', durationSec: 2, ratio: '16:9', profile: 'P12-draft',
      mode: 'ref2va', backend: 'h3-local',
      prompt: 'a calm beach at dusk',
      refs: { images: ['assets/chain_s1_last.png'] },
    },
  },
  ...(controlRel ? [{
    name: '参考图 + 控制视频',
    shot: {
      title: 'E2E-参考图+控制', durationSec: 2, ratio: '16:9', profile: 'P12-draft',
      mode: 'ref2va', backend: 'h3-local',
      prompt: 'a calm beach at dusk',
      refs: { images: ['assets/chain_s1_last.png'] },
      control: { type: 'depth', videoRel: controlRel, strength: 1.0, startPercent: 0, endPercent: 0.8 },
    },
  }] : []),
];

const created = [];
for (const c of CASES) {
  const saved = await j(`${API}/projects/${PROJECT}/shots`, {
    method: 'POST', headers: H, body: JSON.stringify({ shot: c.shot }),
  });
  if (saved.status !== 200 || !saved.body?.id) {
    check(false, `[${c.name}] 保存镜头卡失败 ${saved.status}`);
    continue;
  }
  const gen = await j(`${API}/generate`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ projectId: PROJECT, shotId: saved.body.id, backend: 'h3-local' }),
  });
  if (gen.status !== 200 || !gen.body?.id) {
    check(false, `[${c.name}] 提交生成失败 ${gen.status} ${JSON.stringify(gen.body).slice(0, 160)}`);
    continue;
  }
  created.push({ name: c.name, shotId: saved.body.id, jobId: gen.body.id });
  console.log(`  已提交 [${c.name}] job=${gen.body.id}`);
}

// 轮询
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const deadline = Date.now() + 12 * 60 * 1000;
let pending = [...created];
const done = [];

while (pending.length && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 6000));
  const list = await j(`${API}/jobs`);
  const jobs = Array.isArray(list.body) ? list.body : [];
  const still = [];
  for (const p of pending) {
    const cur = jobs.find((x) => x.id === p.jobId);
    if (!cur) { still.push(p); continue; }
    if (TERMINAL.has(cur.status)) done.push({ ...p, status: cur.status, error: cur.error, outputs: cur.outputs });
    else still.push(p);
  }
  pending = still;
}

console.log('');
for (const d of done) {
  const ok = d.status === 'completed';
  const size = d.outputs?.[0]?.bytes ? Math.round(d.outputs[0].bytes / 1024) + ' KB' : '-';
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${d.name.padEnd(24)} status=${d.status} ${size}`);
  if (!ok) console.log(`        ${String(d.error || '').slice(0, 220)}`);
  check(ok, `[${d.name}] 生成失败：${d.status} ${String(d.error || '').slice(0, 200)}`);
}
for (const p of pending) {
  check(false, `[${p.name}] 12 分钟内未完成（job=${p.jobId}）`);
}

// 清理本次造的测试镜头与 job
for (const c of created) {
  await j(`${API}/projects/${PROJECT}/shots/delete`, {
    method: 'POST', headers: H, body: JSON.stringify({ shotId: c.shotId }),
  }).catch(() => {});
}

console.log('');
console.log(`E2E 实机测试：${checks} 项检查，${FAILS.length} 项失败`);
if (FAILS.length) {
  console.log('\n失败详情：');
  for (const f of FAILS) console.log('  -', f);
  process.exit(1);
}
console.log('OK');
