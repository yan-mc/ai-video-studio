// 解压 DSH 会话记录（zstd jsonl）并检索关键词。
// 用法: node read-session.mjs <file.zstd> [关键词] [上下文行数]
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const needle = process.argv[3] || '';
const ctx = Number(process.argv[4] || 2);

const raw = fs.readFileSync(file);
let text;
try {
  text = zlib.zstdDecompressSync(raw).toString('utf8');
} catch (e) {
  console.error('zstd decompress failed:', e.message);
  process.exit(1);
}

const lines = text.split('\n').filter((l) => l.trim());
if (!needle) {
  console.log(`lines: ${lines.length}, bytes: ${text.length}`);
  for (const l of lines.slice(0, 5)) {
    try {
      const j = JSON.parse(l);
      console.log(JSON.stringify(j).slice(0, 300));
    } catch { console.log(l.slice(0, 300)); }
  }
  process.exit(0);
}

let hits = 0;
const seen = new Set();
lines.forEach((l, i) => {
  if (!l.includes(needle)) return;
  let j;
  try { j = JSON.parse(l); } catch { return; }
  // 提取可读文本
  const s = JSON.stringify(j);
  const key = s.slice(0, 120);
  if (seen.has(key)) return;
  seen.add(key);
  const start = Math.max(0, i - ctx);
  const end = Math.min(lines.length, i + ctx + 1);
  console.log(`\n===== line ${i} (${j.type || j.role || '?'}) =====`);
  for (let k = start; k < end; k++) {
    try {
      const o = JSON.parse(lines[k]);
      const txt = typeof o.content === 'string' ? o.content
        : Array.isArray(o.content) ? o.content.map((c) => (typeof c === 'string' ? c : c?.text || c?.type || '')).join(' ')
          : JSON.stringify(o);
      console.log(txt.slice(0, 1200));
    } catch { /* ignore */ }
  }
  hits++;
});
console.log(`\n--- ${hits} hits for ${JSON.stringify(needle)} ---`);
