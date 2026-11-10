const BASE = 'http://127.0.0.1:12616';
const P = '/ai-video-studio/api';
const fs = await import('node:fs');
const path = await import('node:path');

const r = await fetch(BASE + P + '/projects/proj_mw3cyjed10x18/shots');
const shots = await r.json();
const shot = shots.find((s) => s.id === 'shot_mw3d03scusykq');
console.log('HTTP=' + r.status);
console.log('shot.previz = ' + JSON.stringify(shot?.previz, null, 2));

// 磁盘实际文件
const dir = 'F:\\AI视频\\工作室\\data\\previz\\render\\shot_mw3d03scusykq';
const disk = fs.readdirSync(dir).sort().map((n) => ({ name: n, bytes: fs.statSync(path.join(dir, n)).size }));
console.log('\nDISK FILES (' + disk.length + '):');
for (const f of disk) console.log('  ' + f.name.padEnd(22) + f.bytes);

// render.json 内容
const rj = JSON.parse(fs.readFileSync(path.join(dir, 'render.json'), 'utf8'));
console.log('\nrender.json keys=' + JSON.stringify(Object.keys(rj)));
console.log('render.json (trimmed)=' + JSON.stringify(rj, null, 2).slice(0, 1800));

console.log('\n=== 结论 ===');
console.log('shot.previz 存在? ' + Boolean(shot?.previz));
console.log('shot.previz.render 存在? ' + Boolean(shot?.previz?.render));
