const BASE = 'http://127.0.0.1:12616';
const P = '/ai-video-studio/api';

async function head(name, method, path, opts) {
  const t0 = Date.now();
  const r = await fetch(BASE + P + path, Object.assign({ method }, opts || {}));
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  const cl = r.headers.get('content-length') || '';
  console.log(`${name}\n  ${method} ${path}\n  HTTP ${r.status}  CT=${ct}  CL=${cl}  bytes=${buf.length}  ${Date.now() - t0}ms`);
  const txt = buf.toString('utf8');
  if (!ct.includes('image') && !ct.includes('video') && buf.length < 1200) console.log('  BODY=' + txt.slice(0, 600).replace(/\s+/g, ' '));
  if (ct.includes('image/png')) console.log('  PNG_MAGIC=' + buf.subarray(0, 8).toString('hex') + '  (89504e47...=valid)');
  if (ct.includes('video')) console.log('  MP4_MAGIC=' + buf.subarray(0, 12).toString('hex') + ' (' + buf.subarray(4, 8).toString('ascii') + ')');
  return { status: r.status, ct, bytes: buf.length };
}

console.log('=== 客户端实际调用方式（GET）测 /previz/frame ===');
const f1 = await head('frame GET default timeSec', 'GET', '/previz/frame');
const f2 = await head('frame GET timeSec=1.5', 'GET', '/previz/frame?timeSec=1.5');
console.log('  f2 keys=' + JSON.stringify(Object.keys(f2 || {})));

console.log('\n=== 产物可访问性 ===');
const A = await head('artifact first.png', 'GET', '/file?path=' + encodeURIComponent('previz/render/shot_mw3d03scusykq/first.png'));
const B = await head('artifact control.mp4', 'GET', '/file?path=' + encodeURIComponent('previz/render/shot_mw3d03scusykq/control.mp4'));
const C = await head('artifact job output mp4', 'GET', '/file?path=' + encodeURIComponent('outputs/job_mw3d1gbj952ft.mp4'));

console.log('\n=== 附加: 越界 & 不存在路径（安全边界）===');
await head('path traversal', 'GET', '/file?path=' + encodeURIComponent('../../../../Windows/win.ini'));
await head('missing file', 'GET', '/file?path=' + encodeURIComponent('previz/render/nope/none.png'));

console.log('\n=== 附加: 未知路由 404 语义 ===');
await head('unknown route', 'GET', '/nosuchroute');

console.log('\nSUMMARY=' + JSON.stringify({ f1, f2, A, B, C }));
