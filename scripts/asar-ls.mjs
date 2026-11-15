// 极简 asar 读取器：列出 / 抽取 app.asar 内的文件（只读，不写目标）。
// Electron 的 asar 格式：8 字节 pickle 头 + 4 字节 header 长度 + header JSON(内含文件偏移)
import fs from 'node:fs';

const file = process.argv[2];
const pattern = process.argv[3] || '';

const fd = fs.openSync(file, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(12);
const hbuf = Buffer.alloc(headerSize);
fs.readSync(fd, hbuf, 0, headerSize, 16);
const header = JSON.parse(hbuf.toString('utf8'));
const baseOffset = 8 + headerSize;

const out = [];
function walk(node, prefix) {
  for (const [name, v] of Object.entries(node.files || {})) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (v.files) walk(v, p);
    else {
      const offset = Number(v.offset);
      out.push({ path: p, size: v.size, offset, abs: baseOffset + offset });
    }
  }
}
walk(header, '');

if (!process.argv[3] || !process.argv[3].includes('/')) {
  const hits = pattern ? out.filter((f) => f.path.includes(pattern)) : out;
  console.log(`total ${out.length} files, showing ${Math.min(hits.length, 400)}`);
  for (const f of hits.slice(0, 400)) console.log(`${String(f.size).padStart(9)}  ${f.path}`);
} else {
  // 打印单个文件内容
  const f = out.find((x) => x.path === pattern);
  if (!f) { console.error('not found: ' + pattern); process.exit(1); }
  const buf = Buffer.alloc(f.size);
  fs.readSync(fd, buf, 0, f.size, f.abs);
  process.stdout.write(buf.toString('utf8'));
}
fs.closeSync(fd);
