// 图片引用池测试
import {
  packGraph, unpackGraph, looksLikeBase64Image, measureInlineImages, IMG_REF_PREFIX,
} from '../host/store/image-pool.js';

let pass = 0; let fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra ?? ''); }
};

// 造一张 100KB 的假图
function fakeImage(kb = 100, seed = 0) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const len = Math.floor(kb * 1024);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[(i * 7 + seed * 13) % chars.length];
  return 'data:image/png;base64,' + s;
}

console.log('=== 1. 相同图片复用索引 ===');
const img1 = fakeImage(50, 1);
const graph1 = {
  nodes: [
    { id: 'n1', data: { imageUrl: img1 } },
    { id: 'n2', data: { imageUrl: img1 } },
    { id: 'n3', data: { preview: { url: img1 } } },
  ],
  edges: [],
};
const r1 = packGraph(graph1);
check('3 处都变成 __img_ref__:0',
  r1.graph.nodes.every((n) => (n.data.imageUrl ?? n.data.preview?.url) === `${IMG_REF_PREFIX}0`),
  JSON.stringify(r1.graph.nodes.map((n) => n.data.imageUrl ?? n.data.preview?.url)));
check('pool 长度 1', r1.pool.length === 1, r1.pool.length);

console.log('\n=== 2. pack → unpack 往返一致 ===');
const r1back = unpackGraph(r1.graph, r1.pool);
check('往返后与原图相等', JSON.stringify(r1back) === JSON.stringify(graph1));

console.log('\n=== 3. 体积压缩（100 张 100KB 各不相同）===');
// 用随机后缀保证 100 张互不相同（前面的按位模式会碰撞）
const imgs = Array.from({ length: 100 }, (_, i) => {
  const unique = Buffer.from(`${Date.now()}-${i}-${Math.random()}`).toString('base64');
  return fakeImage(100, i) + unique.slice(0, 40);
});
const big = { nodes: imgs.map((u, i) => ({ id: `n${i}`, data: { imageUrl: u } })) };
const rawBytes = JSON.stringify(big).length;
const packed = packGraph(big);
const packedBytes = JSON.stringify(packed.graph).length;
const ratio = packedBytes / rawBytes;
check(`pack 后 < 1%（实际 ${(ratio * 100).toFixed(3)}%）`, ratio < 0.01, `${packedBytes} / ${rawBytes}`);
check('pool 有 100 张（全不同）', packed.pool.length === 100, packed.pool.length);

console.log('\n=== 4. 非图片字段原样保留 ===');
const mixed = {
  name: '项目A',
  count: 42,
  nested: { id: 'x1', ratio: '16:9', nums: [1, 2, 3], flag: true },
  image: fakeImage(30, 9),
  shortString: 'hello',
  nullField: null,
};
const r4 = packGraph(mixed);
check('普通字符串保留', r4.graph.name === '项目A');
check('数字保留', r4.graph.count === 42);
check('嵌套对象保留', JSON.stringify(r4.graph.nested) === JSON.stringify(mixed.nested));
check('短字符串保留', r4.graph.shortString === 'hello');
check('null 保留', r4.graph.nullField === null);
check('图片被转引用', r4.graph.image === `${IMG_REF_PREFIX}0`);

console.log('\n=== 5. 边界情况 ===');
check('空对象不崩', JSON.stringify(packGraph({})) === '{"graph":{},"pool":[]}');
check('null 不崩', packGraph(null).graph === null);
check('无图项目 pool 为空', packGraph({ nodes: [] }).pool.length === 0);
check('解包空 pool 不崩', unpackGraph({ a: `${IMG_REF_PREFIX}0` }, []).a === `${IMG_REF_PREFIX}0`);
check('越界索引原样返回', unpackGraph({ a: `${IMG_REF_PREFIX}99` }, ['x']).a === `${IMG_REF_PREFIX}99`);

console.log('\n=== 6. 判定函数 ===');
check('data URL 判定', looksLikeBase64Image('data:image/png;base64,AAAA') === true);
check('已是引用不重复判定', looksLikeBase64Image(`${IMG_REF_PREFIX}0`) === false);
check('短字符串不判定', looksLikeBase64Image('hello') === false);
check('对象不判定', looksLikeBase64Image({}) === false);

console.log('\n=== 7. 体积测量 ===');
const m = measureInlineImages(mixed);
check('测出 1 张图', m.count === 1, m.count);
check('字节数 > 30KB', m.bytes > 30 * 1024, m.bytes);

console.log(`\n结果：PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);