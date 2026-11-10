const fs = await import('node:fs');
const { execFileSync } = await import('node:child_process');

function pngSize(p) {
  const b = fs.readFileSync(p);
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  // IHDR at offset 8: len(4) type(4) w(4) h(4)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

const dir = 'F:\\AI视频\\工作室\\data\\previz\\render\\shot_mw3d03scusykq';
for (const f of ['first.png', 'last.png', 'frame_0000.png', 'frame_0005.png', 'frame_0011.png', 'frame_0012.png', 'frame_0023.png']) {
  const s = pngSize(dir + '\\' + f);
  console.log(f.padEnd(16) + (s ? `${s.w}x${s.h}  ratio=${(s.w / s.h).toFixed(3)}  bytes=${s.bytes}` : 'NOT_PNG'));
}

console.log('\n=== control.mp4 via ffprobe ===');
const ffprobe = 'F:\\AI视频\\工作室\\tools\\ffmpeg\\bin\\ffprobe.exe';
try {
  const o = execFileSync(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', dir + '\\control.mp4'], { encoding: 'utf8' });
  const j = JSON.parse(o);
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  console.log(JSON.stringify({ codec: v.codec_name, w: v.width, h: v.height, r_frame_rate: v.r_frame_rate, nb_frames: v.nb_frames, duration: v.duration, format_duration: j.format?.duration, bytes: j.format?.size, bit_rate: j.format?.bit_rate }, null, 2));
  const nf = Number(v.nb_frames || 0);
  const dur = Number(v.duration || j.format?.duration || 0);
  console.log(`=> 帧数=${nf} 时长=${dur}s 实际平均fps=${nf && dur ? (nf / dur).toFixed(2) : '?'}`);
} catch (e) {
  console.log('FFPROBE_FAILED: ' + (e.message || e));
}

console.log('\n=== 陈旧文件判定 ===');
const files = fs.readdirSync(dir);
const stale = files.filter((f) => /^frame_\d{4}\.png$/.test(f) && Number(f.slice(6, 10)) >= 12);
console.log('本次渲染写出的 frame 数 = 12 (frame_0000..frame_0011)');
console.log('磁盘上超出本次范围的孤儿文件 (' + stale.length + '): ' + stale.sort().join(', '));
console.log('render.json frameCount=12，但磁盘 png frame_* 共 ' + files.filter((f) => /^frame_\d{4}\.png$/.test(f)).length + ' 个');
