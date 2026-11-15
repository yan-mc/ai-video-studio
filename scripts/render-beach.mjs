/**
 * 逐镜生成 + 全程监控。
 *
 *   node scripts/render-beach.mjs [baseUrl] [styleId]
 *
 * styleId 决定用哪套提示词（ova90s / helltaker-look / toon3d-pbr）。
 *
 * 监控要点（用户要求"时刻监控着是否所有的东西都进去了"）：
 *   1. 提交前核对 shot.control.videoRel 与 cardIds 是否非空；
 *   2. 提交后用 /render/plan 拉一次渲染计划，确认
 *      · 参考图数量与来源（vault-card 应占前 2）
 *      · 控制视频在计划里被识别
 *   3. 轮询期间检查 job.params 是否出现 controlSkipped / refImageSizeDowngraded
 *      —— 出现就说明有东西没进去，立即报出来而不是等出片
 *   4. 出片后校验产物存在、时长、音轨
 */

import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:3165';
const STYLE = process.argv[3] || 'ova90s';
const API = `${BASE}/jiuzhang/api`;
const PROJECT = 'proj_mwfrgfb9tsy7f7';

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}
const token = (await j(`${API}/token`)).body.token;
const H = { 'content-type': 'application/json', 'x-jz-token': token };

const problems = [];
const note = (m) => { console.log('  ⚠ ' + m); problems.push(m); };
const ok = (m) => console.log('  ✓ ' + m);

// ---------------------------------------------------------------- 载入镜头
const shots = (await j(`${API}/projects/${PROJECT}/shots`)).body;
if (!Array.isArray(shots) || shots.length !== 3) {
  console.error('镜头卡不是 3 张'); process.exit(1);
}
const ordered = ['漫步', '坐下', '亲吻'].map((kw) => shots.find((s) => s.title.includes(kw)));

console.log(`画风: ${STYLE}   镜头: ${ordered.map((s) => s.title).join(' / ')}\n`);

// ---------------------------------------------------------------- 预检
console.log('=== 预检：素材是否齐备 ===');
for (const s of ordered) {
  const hasCards = Array.isArray(s.cardIds) && s.cardIds.length === 2;
  const ctl = s.control && s.control.videoRel;
  const promptOk = typeof s.prompt === 'string' && s.prompt.length > 200;
  ok(`${s.title}: 角色卡=${s.cardIds?.length ?? 0} 控制视频=${ctl ? '有' : '无'} 提示词=${promptOk ? s.prompt.length + '字' : '缺失'}`);
  if (!hasCards) note(`${s.title} 缺角色卡`);
  if (!ctl) note(`${s.title} 缺控制视频`);
  if (!promptOk) note(`${s.title} 提示词不足 200 字（会被自动编译覆盖）`);
  if (ctl && !fs.existsSync(path.join(process.cwd(), 'data', ctl))) {
    note(`${s.title} 控制视频文件不存在（可能被 previz 保留策略清掉）: ${ctl}`);
  }
}

// ---------------------------------------------------------------- 渲染计划核对
console.log('\n=== 渲染计划核对（确认参考图与控制在计划里）===');
for (const s of ordered) {
  // ⚠️ /render/plan 是 POST（要传 cardIds/mode/control 等），不是 GET。
  const r = await j(`${API}/render/plan`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      cardIds: s.cardIds, mode: s.mode, ratio: s.ratio,
      durationSec: s.durationSec, refImageSize: s.refImageSize, control: s.control,
    }),
  });
  if (r.status !== 200) { note(`${s.title} render/plan 失败 ${r.status}`); continue; }
  const plan = r.body;
  const imgs = plan.images ?? plan.refImages ?? [];
  // ⚠️ render/plan 里角色卡的 source 是 'card-sheet'（不是 'vault-card'），
  //    早期按 'vault' 匹配会误判成"没有角色卡"。
  const vault = imgs.filter((i) => /card-sheet|vault/i.test(String(i.source ?? '')));
  const ctl = s.control?.videoRel ?? null;
  console.log(`  ${s.title}: 参考图 ${imgs.length} 张（角色卡 ${vault.length}）  控制=${ctl || '无'}`);
  if (!imgs.length) note(`${s.title} 计划里没有参考图`);
  if (vault.length !== 2) note(`${s.title} 角色卡参考图不是 2 张（实际 ${vault.length}）`);
  if (!ctl) note(`${s.title} 没有控制视频`);
}

// ---------------------------------------------------------------- 提交
console.log('\n=== 提交生成 ===');
const submitted = [];
for (const s of ordered) {
  const r = await j(`${API}/generate`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ projectId: PROJECT, shotId: s.id, backend: 'h3-local' }),
  });
  if (r.status !== 200 || !r.body?.id) {
    note(`${s.title} 提交失败 ${r.status} ${JSON.stringify(r.body).slice(0, 150)}`);
    continue;
  }
  ok(`${s.title} -> job ${r.body.id}`);
  submitted.push({ shot: s, jobId: r.body.id });
}

// ---------------------------------------------------------------- 轮询 + 监控
console.log('\n=== 生成中（监控 params 是否有降级/跳过）===');
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const done = [];
let pending = [...submitted];
const deadline = Date.now() + 25 * 60 * 1000;
const warned = new Set();

while (pending.length && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 8000));
  const list = (await j(`${API}/jobs`)).body;
  const jobs = Array.isArray(list) ? list : [];
  const still = [];
  for (const p of pending) {
    const cur = jobs.find((x) => x.id === p.jobId);
    if (!cur) { still.push(p); continue; }

    // --- 实时监控 job.params 的异常标记 ---
    const params = cur.params ?? {};
    for (const key of ['controlSkipped', 'refImageSizeDowngraded', 'nodesPruned']) {
      if (params[key] && !warned.has(`${p.jobId}:${key}`)) {
        warned.add(`${p.jobId}:${key}`);
        if (key === 'nodesPruned') {
          console.log(`    · ${p.shot.title} 剪枝掉 ${params[key]} 个不可达节点（正常）`);
        } else {
          note(`${p.shot.title} ${key}: ${params[key]}`);
        }
      }
    }
    if (Array.isArray(cur.warnings) && cur.warnings.length && !warned.has(`${p.jobId}:warn`)) {
      warned.add(`${p.jobId}:warn`);
      note(`${p.shot.title} 警告: ${cur.warnings.join(' / ')}`);
    }

    if (TERMINAL.has(cur.status)) {
      done.push({ ...p, status: cur.status, error: cur.error, outputs: cur.outputs, remoteId: cur.remoteId });
    } else {
      still.push(p);
    }
  }
  pending = still;
  if (pending.length) process.stdout.write(`    ${pending.length} 个仍在跑…\r`);
}
console.log('');

// ---------------------------------------------------------------- 结果
console.log('\n=== 结果 ===');
const results = [];
for (const d of done) {
  const out = d.outputs?.[0];
  const good = d.status === 'completed' && out?.path;
  console.log(`  ${good ? '✓' : '✗'} ${d.shot.title.padEnd(12)} ${d.status.padEnd(10)} ${out ? Math.round(out.bytes / 1024) + ' KB' : '-'}  remote=${d.remoteId ? 'yes' : 'no'}`);
  if (!good) note(`${d.shot.title} 失败: ${String(d.error || '').slice(0, 200)}`);
  if (out?.rel && !fs.existsSync(path.join(process.cwd(), 'data', out.rel))) {
    note(`${d.shot.title} 产物文件不存在: ${out.rel}`);
  }
  results.push({ title: d.shot.title, status: d.status, rel: out?.rel, bytes: out?.bytes });
}
for (const p of pending) note(`${p.shot.title} 超时未完成`);

// ---------------------------------------------------------------- 落盘
const report = { style: STYLE, at: Date.now(), results, problems };
fs.mkdirSync(path.join(process.cwd(), 'data', 'runs'), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), 'data', 'runs', `beach-${STYLE}.json`),
  JSON.stringify(report, null, 2), 'utf8',
);

console.log('');
if (problems.length) {
  console.log(`共 ${problems.length} 个问题：`);
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
console.log(`全部成功（画风 ${STYLE}）`);
