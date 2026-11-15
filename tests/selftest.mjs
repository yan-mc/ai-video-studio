// 端到端冒烟测试：不启动 DSH，直接调用 host 模块验证核心逻辑
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-test-'));
// 关键：测试必须隔离配置与数据，绝不碰真实 data/config.json
process.env.DSH_JZ_CONFIG_FILE = path.join(tmp, 'config.json');
process.env.DSH_JZ_DATA_DIR = tmp;
process.env.DSH_JZ_TEST = '1';

// 把 dataDir 指到临时目录
const { saveConfig, loadConfig, sanitizeConfigPatch, WRITABLE_CONFIG_KEYS, resetConfigCache } = await import('../host/config.js');
resetConfigCache();
saveConfig({ dataDir: tmp, comfyInputDir: '' });
const cfg = loadConfig();
console.log('dataDir =', cfg.dataDir);
console.log('白名单字段数 =', WRITABLE_CONFIG_KEYS.length);

// 1) 配置白名单 + 可执行路径不可注入
const injected = sanitizeConfigPatch({ ffmpeg: 'C:\\evil.exe', previzExe: 'x', comfyUrl: 'http://127.0.0.1:8188' });
console.log('\n[1] 配置注入测试');
console.log('  ffmpeg 是否被接受:', 'ffmpeg' in injected, '(应为 false)');
console.log('  previzExe 是否被接受:', 'previzExe' in injected, '(应为 false)');
console.log('  comfyUrl 是否被接受:', 'comfyUrl' in injected, '(应为 true)');
console.log('  掩码回填被丢弃:', JSON.stringify(sanitizeConfigPatch({ seedanceApiKey: '***' })));

// 2) 安全：id 穿越
const { safeId, safeJoin } = await import('../host/security.js');
console.log('\n[2] 路径穿越测试');
for (const bad of ['../../..', '../x', 'a/b', '']) {
  try { safeId(bad); console.log('  BAD ACCEPTED:', JSON.stringify(bad)); }
  catch { console.log('  blocked:', JSON.stringify(bad)); }
}
try { safeJoin(tmp, '../../../Windows'); console.log('  safeJoin LEAK'); }
catch { console.log('  safeJoin blocked: ../../../Windows'); }

// 3) 串行写：并发 50 次 upsert 不丢
const { collectionStore, drainQueues } = await import('../host/store/json-store.js');
const store = collectionStore(path.join(tmp, 'concurrent.json'), { prefix: 'x' });
await Promise.all(Array.from({ length: 50 }, (_, i) => store.upsert({ id: `x_${i}`, n: i })));
await drainQueues();
const after = await store.list();
console.log('\n[3] 并发写测试（期望 50）');
console.log('  实际条目:', after.length);

// 4) 分段引擎
const { segmentScript, extractAssets } = await import('../host/services/h3-workshop.js');
const script = `第一场 夜 街道
夜雨中的街道，霓虹灯反射在积水里。林晚站在路口，握紧手中的伞。

林晚：这次，我不会再等了。
陈默：你以为你还有选择吗？

第二场 室内 办公室
陈默推开门，桌上摆着一份合同。
陈默：签了它，你就能离开。
林晚：我宁愿留在这里。`;
const seg = segmentScript(script, { durationMin: 4, durationMax: 10, style: '电影感冷色调' });
console.log('\n[4] 分段引擎');
console.log('  分段数:', seg.segments.length, '总时长:', seg.stats.totalDuration);
seg.segments.forEach((s) => console.log(`   #${s.index} [${s.scene}] ${s.durationSec}s/${s.h3Length}帧 台词${s.dialogue.length}句`));
const a = extractAssets(seg.segments);
console.log('  角色:', a.characters.map((c) => c.name).join(','), '| 场景:', a.scenes.map((s) => s.name).join(','));
console.log('  音色:', a.voices.map((v) => v.name).join(','));

// 5) 分辨率与帧数
const { resolutionFor, h3Length } = await import('../host/store/models.js');
console.log('\n[5] 分辨率/帧数');
for (const [p, r] of [['P24-quality', '16:9'], ['P24-quality', '9:16'], ['P12-draft', '16:9']]) {
  const x = resolutionFor(p, r);
  console.log(`  ${p} ${r} -> ${x.width}x${x.height}`);
}
console.log('  5s ->', h3Length(5), '帧; 10s ->', h3Length(10), '帧; 15s ->', h3Length(15), '帧');

// 6) post 服务（无 ffmpeg 也应给出明确错误）
const { createPostService } = await import('../host/services/post.js');
const post = createPostService({ cfg });
try { await post.qc('nope.mp4'); } catch (e) { console.log('\n[6] post.qc 缺文件 ->', e.message); }

// 清理
await drainQueues();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nALL DONE');
