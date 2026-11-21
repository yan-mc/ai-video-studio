/**
 * 剪辑功能验收脚本 —— 重启 DSH 之后跑这一个文件即可。
 *
 * 用法：
 *   node tools/verify-edit.mjs
 *   node tools/verify-edit.mjs --base http://127.0.0.1:2150
 *
 * 它做真实验证，不是静态检查：
 *   1) 探测 7 条 /edit/* 路由是否在线
 *   2) 造一段测试视频 → 裁切 → 拼接 → 换 BGM → 出片
 *   3) 校验产物时长/音轨确实符合预期（ffprobe 复核）
 *   4) 工程 CRUD 往返
 *   5) 安全边界：dataDir 之外的路径必须被拒
 *
 * 退出码：0 全过；1 有失败项。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return i >= 0 ? process.argv[i + 1] : 'http://127.0.0.1:2150';
})();
const API = `${BASE}/jiuzhang/api`;

const results = [];
let failed = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  const mark = ok ? '✅' : '❌';
  console.log(`  ${mark}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`);
}

/* ------------------------------------------------------------ 工具 */

let TOKEN = '';

async function call(method, p, body) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-JZ-Token'] = TOKEN;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${p}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}

function resolveFfmpeg() {
  const dirs = [process.env.DSH_FFMPEG_DIR, process.env.FFMPEG_DIR, 'F:\\AI视频\\tools\\ffmpeg'];
  for (const d of dirs) {
    if (!d) continue;
    for (const cand of [path.join(d, 'bin', 'ffmpeg.exe'), path.join(d, 'ffmpeg.exe')]) {
      if (fs.existsSync(cand)) return cand;
    }
  }
  return 'ffmpeg';
}

function resolveFfprobe() {
  const ff = resolveFfmpeg();
  const p = ff.replace(/ffmpeg\.exe$/i, 'ffprobe.exe');
  return fs.existsSync(p) ? p : 'ffprobe';
}

function run(exe, args) {
  return spawnSync(exe, args, { encoding: 'utf8', windowsHide: true });
}

/** 造测试素材（纯合成，不需要外部文件） */
function makeFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ff = resolveFfmpeg();
  const a = path.join(dir, 'va.mp4');
  const b = path.join(dir, 'vb.mp4');
  const bgm = path.join(dir, 'bgm.m4a');
  if (!fs.existsSync(a)) {
    run(ff, ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=5',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', a]);
  }
  if (!fs.existsSync(b)) {
    run(ff, ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=4',
      '-f', 'lavfi', '-i', 'sine=frequency=880:duration=4',
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', b]);
  }
  if (!fs.existsSync(bgm)) {
    run(ff, ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=220:duration=8',
      '-c:a', 'aac', bgm]);
  }
  return { a, b, bgm };
}

function probeDuration(abs) {
  const r = run(resolveFfprobe(), [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', abs,
  ]);
  return Number(String(r.stdout || '').trim()) || null;
}

function probeAudioStreams(abs) {
  const r = run(resolveFfprobe(), [
    '-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', abs,
  ]);
  return String(r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 测试素材目录 —— 提到模块级是为了让 finally 能清场。
 * 旧实现定义在 main() 内部，清理也写在 main() 末尾，
 * 中途 throw 就直接跳过清理，留下产物污染素材池。
 *
 * ⚠️ DATA_DIR 必须在 absFromRel 使用之前就位：`const` 不提升，
 *    虽然函数体运行时才读它，但为了可读性仍放在主流程块之前。
 */
const DATA_DIR = process.env.DSH_JZ_DATA_DIR || 'F:\\AI视频\\dsh-jiuzhang-studio\\data';
const fixturesDirRel = '_verifytmp';
const fixturesDirAbs = path.join(DATA_DIR, fixturesDirRel);

/** rel → dataDir 下的绝对路径（脚本与 Host 同机，直接拼） */
function absFromRel(rel) {
  return path.join(DATA_DIR, rel.replace(/\//g, path.sep));
}

/* ------------------------------------------------------------ 主流程 */

/** 本次运行产生的所有产物 rel —— 无论成功失败都要清掉 */
const produced = [];
function track(rel) {
  if (rel) produced.push(rel);
  return rel;
}

/**
 * 运行前的产物快照。
 *
 * ⚠️ 只靠 track() 登记是不够的：`/edit/render` 内部会串行调用
 * trim → concat → audio，每一步都产出中间文件，而这些中间产物
 * **不出现在** render 的返回值里。实测跑完会剩 4 个 trim_/concat_/audio_ 文件。
 *
 * 所以用快照 diff：运行前记下 outputs 里已有的文件名，清理时只删**新增**的。
 * 绝不整个清空目录 —— 用户可能有自己真实的剪辑产物在里面。
 */
function snapshotOutputs() {
  const dir = path.join(DATA_DIR, 'edit', 'outputs');
  try { return new Set(fs.readdirSync(dir)); } catch { return new Set(); }
}

function cleanOutputsSince(before) {
  const dir = path.join(DATA_DIR, 'edit', 'outputs');
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (before.has(n)) continue;         // 运行前就有 → 是用户的，不动
    try { fs.unlinkSync(path.join(dir, n)); } catch { /* ignore */ }
  }
  // 目录空了就删掉（下次首次使用时服务会自己 mkdir）
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch { /* ignore */ }
  try {
    const parent = path.join(DATA_DIR, 'edit');
    if (fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
  } catch { /* ignore */ }
}

async function main() {
  console.log('\n===== 剪辑功能验收 =====\n');
  console.log(`  目标：${BASE}\n`);

  /* 1. token */
  const tr = await fetch(`${API}/token`, { cache: 'no-store' });
  if (!tr.ok) {
    console.log(`❌ 取不到 token（HTTP ${tr.status}）—— DSH 是否在运行？`);
    process.exit(1);
  }
  const tj = await tr.json();
  TOKEN = tj.token;
  record('GET /token 可取写令牌', Boolean(TOKEN));

  /* 2. 路由在线 */
  const clips = await call('GET', '/edit/clips');
  record('GET /edit/clips 在线', clips.status === 200 && Array.isArray(clips.json?.clips),
    `status=${clips.status} body=${clips.text.slice(0, 200)}`);

  const projList = await call('GET', '/edit/projects');
  record('GET /edit/projects 在线', projList.status === 200 && Array.isArray(projList.json?.projects),
    `status=${projList.status} body=${projList.text.slice(0, 200)}`);

  if (clips.status !== 200) {
    console.log('\n⚠️  /edit/* 路由未挂载 —— 请确认已重启 DSH。\n');
    return;
  }

  /* 3. 造素材并放进 dataDir（剪辑只能读 dataDir 内的文件） */
  const fx = makeFixtures(fixturesDirAbs);
  const relA = `${fixturesDirRel}/va.mp4`;
  const relB = `${fixturesDirRel}/vb.mp4`;
  const relBgm = `${fixturesDirRel}/bgm.m4a`;
  record('测试素材就绪', fs.existsSync(fx.a) && fs.existsSync(fx.b) && fs.existsSync(fx.bgm));

  /* 4. probe */
  const pr = await call('POST', '/edit/probe', { input: relA });
  const durA = pr.json?.durationSec;
  record('POST /edit/probe 读出时长≈5s', pr.status === 200 && Math.abs((durA ?? 0) - 5) < 0.2,
    `status=${pr.status} duration=${durA}`);
  record('probe 能识别音轨', pr.json?.hasAudio === true);

  /* 5. trim：取 1→3 秒，应为 ~2s */
  const trm = await call('POST', '/edit/trim', { input: relA, startSec: 1, endSec: 3 });
  const trimRel = track(trm.json?.rel);
  const trimDur = trimRel ? probeDuration(absFromRel(trimRel)) : null;
  record('POST /edit/trim 裁出≈2s', trm.status === 200 && Math.abs((trimDur ?? 0) - 2) < 0.25,
    `status=${trm.status} dur=${trimDur}`);

  /* 6. concat 硬切：5 + 4 = 9s */
  const cc = await call('POST', '/edit/concat', { inputs: [relA, relB] });
  const ccRel = track(cc.json?.rel);
  const ccDur = ccRel ? probeDuration(absFromRel(ccRel)) : null;
  record('POST /edit/concat 硬切 ≈9s', cc.status === 200 && Math.abs((ccDur ?? 0) - 9) < 0.3,
    `status=${cc.status} dur=${ccDur} mode=${cc.json?.mode}`);

  /* 7. concat 转场：5 + 4 - 0.5 = 8.5s */
  const cx = await call('POST', '/edit/concat', { inputs: [relA, relB], transitionSec: 0.5 });
  const cxRel = track(cx.json?.rel);
  const cxDur = cxRel ? probeDuration(absFromRel(cxRel)) : null;
  record('POST /edit/concat 带 0.5s 转场 ≈8.5s', cx.status === 200 && Math.abs((cxDur ?? 0) - 8.5) < 0.3,
    `status=${cx.status} dur=${cxDur} mode=${cx.json?.mode}`);

  /* 8. audio strip */
  const st = await call('POST', '/edit/audio', { input: relA, op: 'strip' });
  const stRel = track(st.json?.rel);
  const stStreams = stRel ? probeAudioStreams(absFromRel(stRel)) : [];
  record('POST /edit/audio strip 后无音轨', st.status === 200 && !stStreams.includes('audio'),
    `status=${st.status} streams=${stStreams.join(',')}`);

  /* 9. audio bgm */
  const bg = await call('POST', '/edit/audio', {
    input: relA, op: 'bgm', bgmInput: relBgm, replaceOriginal: true, bgmVolume: 0.6,
  });
  const bgRel = track(bg.json?.rel);
  const bgStreams = bgRel ? probeAudioStreams(absFromRel(bgRel)) : [];
  record('POST /edit/audio bgm 后有音轨', bg.status === 200 && bgStreams.includes('audio'),
    `status=${bg.status} streams=${bgStreams.join(',')}`);

  /* 10. render：2 段裁切 + 转场 + BGM → 预期 (2 + 2.5) - 0.4 = 4.1s */
  const rd = await call('POST', '/edit/render', {
    clips: [
      { rel: relA, startSec: 0, endSec: 2 },
      { rel: relB, startSec: 1, endSec: 3.5 },
    ],
    audio: { mode: 'bgm', bgmRel: relBgm, bgmVolume: 0.4, replaceOriginal: true },
    transitionSec: 0.4,
  });
  const rdRel = track(rd.json?.rel);
  const rdDur = rdRel ? probeDuration(absFromRel(rdRel)) : null;
  const rdStreams = rdRel ? probeAudioStreams(absFromRel(rdRel)) : [];
  record('POST /edit/render 出片 ≈4.1s', rd.status === 200 && Math.abs((rdDur ?? 0) - 4.1) < 0.35,
    `status=${rd.status} dur=${rdDur}`);
  record('成片含音轨', rdStreams.includes('audio'), `streams=${rdStreams.join(',')}`);

  /**
   * 10b. 默认路径：片段**不设任何裁剪区间**。
   *
   * ⚠️ 这一项专门守护一个曾经让默认路径全坏的 bug：
   *    `numOrNull(null)` 因为 `Number(null) === 0` 返回了 0 而不是 null，
   *    于是 `numOrNull(c.endSec) ?? total` 得到 0，
   *    "整段"被理解成"0 到 0"，trim 抛 EMPTY_RANGE，render 直接 500。
   *
   * 上面第 10 项每段都显式给了 endSec，恰好绕开了它 ——
   * 所以必须单独测"什么都不设"的形态，那才是用户最常用的路径。
   */
  const rd2 = await call('POST', '/edit/render', {
    clips: [{ rel: relA }, { rel: relB }],
  });
  const rd2Rel = track(rd2.json?.rel);
  const rd2Dur = rd2Rel ? probeDuration(absFromRel(rd2Rel)) : null;
  // 两段都不裁剪时总长 = 5 + 4 = 9s
  record('render 默认路径（不设裁剪区间）≈9s',
    rd2.status === 200 && Math.abs((rd2Dur ?? 0) - 9) < 0.3,
    `status=${rd2.status} dur=${rd2Dur} body=${rd2.status === 200 ? '' : String(rd2.text).slice(0, 160)}`);

  /* 11. /file 能读到成片（剪辑页内联播放依赖它） */
  if (rdRel) {
    const fr = await fetch(`${API}/file?path=${encodeURIComponent(rdRel)}`, { method: 'HEAD' });
    record('/file 可读成片（内联播放依赖）', fr.status === 200, `status=${fr.status}`);
  }

  /* 12. 工程 CRUD */
  const pid = `verify_${Date.now().toString(36)}`;
  const sp = await call('POST', `/edit/projects/${pid}`, {
    name: '验收工程',
    clips: [{ rel: relA, startSec: 0, endSec: 3 }],
    audio: { mode: 'strip' },
  });
  record('POST /edit/projects/:id 保存', sp.status === 200 && sp.json?.project?.clips?.length === 1,
    `status=${sp.status}`);

  const gp = await call('GET', `/edit/projects/${pid}`);
  record('GET /edit/projects/:id 读回', gp.status === 200 && gp.json?.project?.name === '验收工程',
    `status=${gp.status}`);

  const dl = await call('DELETE', `/edit/projects/${pid}`);
  record('DELETE /edit/projects/:id', dl.status === 200 && dl.json?.ok === true, `status=${dl.status}`);

  const gp2 = await call('GET', `/edit/projects/${pid}`);
  record('删除后确认不存在', gp2.status !== 200, `status=${gp2.status}`);

  /* 13. 安全边界：dataDir 之外必须拒绝 */
  const evil = await call('POST', '/edit/probe', { input: 'C:/Windows/System32/drivers/etc/hosts' });
  record('拒绝 dataDir 之外的路径', evil.status >= 400,
    `status=${evil.status} body=${evil.text.slice(0, 160)}`);

  /* 14. 无 token 的写操作必须拒绝 */
  {
    const res = await fetch(`${API}/edit/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: [{ rel: relA }] }),
    });
    record('写操作无 token 被拒', res.status === 403, `status=${res.status}`);
  }

  /* 清理临时素材（产物在 finally 里统一清） */
}

/**
 * 无论成功失败都要清场。
 *
 * ⚠️ 旧实现把清理写在 main() 末尾：
 *   1) 中途任一步 throw 就跳过清理，data/edit/outputs 里留一堆 trim_/concat_ 产物；
 *   2) 那些产物会被 /edit/clips 扫进素材池，下次打开剪辑页看到一堆垃圾；
 *   3) 更糟的是它们占着 dataDir，用户可能误以为是自己的片子。
 * 现在改为 finally + 按本脚本登记过的 rel 逐个删，只删自己造的东西。
 */
const outputsBefore = snapshotOutputs();
try {
  await main();
} finally {
  for (const rel of produced) {
    try { fs.unlinkSync(absFromRel(rel)); } catch { /* 可能已被删或不存在 */ }
  }
  cleanOutputsSince(outputsBefore);
  try { fs.rmSync(fixturesDirAbs, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log('\n----------------------------------------');
if (failed === 0) {
  console.log(`\n✅ 全部通过（${results.length} 项）\n`);
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} / ${results.length} 项失败\n`);
  process.exit(1);
}