// asar 内文本搜索：在指定路径前缀下查找匹配字符串（只读）
import fs from 'node:fs';

const file = process.argv[2];
const needle = process.argv[3];
const pathFilter = process.argv[4] || '';
const maxHits = Number(process.argv[5] || 60);

const fd = fs.openSync(file, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(12);
const hbuf = Buffer.alloc(headerSize);
fs.readSync(fd, hbuf, 0, headerSize, 16);
const header = JSON.parse(hbuf.toString('utf8'));
const baseOffset = 8 + headerSize;

const out = [];
(function walk(node, prefix) {
  for (const [name, v] of Object.entries(node.files || {})) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (v.files) walk(v, p);
    else out.push({ path: p, size: v.size, abs: baseOffset + Number(v.offset) });
  }
})(header, '');

let hits = 0;
for (const f of out) {
  if (pathFilter && !f.path.includes(pathFilter)) continue;
  if (f.size > 12 * 1024 * 1024) continue;
  if (!/\.(js|mjs|cjs|ts|tsx|json|md|yml|yaml)$/i.test(f.path)) continue;
  const buf = Buffer.alloc(f.size);
  fs.readSync(fd, buf, 0, f.size, f.abs);
  const text = buf.toString('utf8');
  if (!text.includes(needle)) continue;
  // 打印每个命中行（最多 3 行/文件）
  const lines = text.split('\n');
  let printed = 0;
  for (let i = 0; i < lines.length && printed < 3; i++) {
    if (!lines[i].includes(needle)) continue;
    console.log(`${f.path}:${i + 1}: ${lines[i].trim().slice(0, 260)}`);
    printed++;
    hits++;
  }
  if (hits >= maxHits) break;
}
console.log(`\n--- ${hits} hit lines ---`);
fs.closeSync(fd);
