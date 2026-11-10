/**
 * API 全量实测探针（只读 + 允许的少数写操作）
 * 用法: node _tmp-api-probe.mjs
 */
const BASE = 'http://127.0.0.1:12616';
const P = '/ai-video-studio/api';

const out = [];
function rec(name, method, path, status, ct, bytes, fields, note) {
  out.push({ name, method, path, status, ct, bytes, fields, note });
  console.log(`\n### ${name}  ${method} ${path}`);
  console.log(`HTTP ${status}  ct=${ct}  bytes=${bytes}`);
  if (fields) console.log('FIELDS=' + JSON.stringify(fields, null, 2).slice(0, 3000));
  if (note) console.log('NOTE=' + note);
}

function summarize(v, depth = 0) {
  if (v === null) return null;
  if (Array.isArray(v)) return { __array: v.length, sample: v.length ? summarize(v[0], depth + 1) : null };
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 14)) o[k] = summarize(v[k], depth + 1);
    return o;
  }
  if (typeof v === 'string' && v.length > 180) return v.slice(0, 180) + `…(${v.length})`;
  return v;
}

async function hit(name, method, path, body) {
  const started = Date.now();
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opt.body = JSON.stringify(body);
  let status = 0, ct = '', buf = Buffer.alloc(0);
  try {
    const r = await fetch(BASE + P + path, opt);
    status = r.status;
    ct = r.headers.get('content-type') || '';
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    rec(name, method, path, 0, '', 0, null, 'FETCH_ERROR: ' + (e.message || e));
    return null;
  }
  let json = null;
  try { json = JSON.parse(buf.toString('utf8')); } catch { /* not json */ }
  rec(name, method, path, status, ct, buf.length, json ? summarize(json) : buf.toString('utf8').slice(0, 200),
      `${Date.now() - started}ms`);
  return json;
}

const GETS = ['/config', '/selfcheck', '/projects', '/jobs', '/assets', '/backends', '/previz', '/previz/state', '/previz/url', '/profiles'];
const results = {};

for (const g of GETS) results[g] = await hit('GET ' + g, 'GET', g);

results.compile = await hit('POST /compile', 'POST', '/compile', { projectId: 'proj_mw3cyjed10x18', shotId: 'shot_mw3d03scusykq' });
results.frame = await hit('POST /previz/frame?timeSec=1.5', 'POST', '/previz/frame?timeSec=1.5');

console.log('\n=== RENDER START (可能 7-30s) ===');
results.render = await hit('POST /previz/render', 'POST', '/previz/render', { shotId: 'shot_mw3d03scusykq', projectId: 'proj_mw3cyjed10x18', samples: 12, longSide: 1600, fps: 24, video: true });

console.log('\n=== RENDER KEY FIELDS ===');
const R = results.render || {};
console.log(JSON.stringify({ ok: R.ok, frameCount: R.frameCount, firstFrame: R.firstFrame, lastFrame: R.lastFrame,
  controlVideo: R.controlVideo, elapsedMs: R.elapsedMs, error: R.error, dir: R.dir, outDir: R.outDir, keys: Object.keys(R) }, null, 2));

// 附加：客户端实际用到的 /projects/:id/shots 与 /file（不计入主表但记录）
results.shots = await hit('GET /projects/:id/shots', 'GET', '/projects/proj_mw3cyjed10x18/shots');

const fs = await import('node:fs');
fs.writeFileSync('F:\\AI视频\\工作室\\docs\\_tmp-api-results.json', JSON.stringify({ results, table: out }, null, 2), 'utf8');
console.log('\nSAVED docs/_tmp-api-results.json');
