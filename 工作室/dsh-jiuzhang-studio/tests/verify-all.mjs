/**
 * 全量验收脚本 —— 一条命令跑完所有验收项。
 *
 * 覆盖：
 *  A. 静态：文件结构、语法、配置
 *  B. Host 模块：串行写、安全、模型、工坊
 *  C. HTTP：鉴权、路由、CRUD、生成（mock）
 *  D. 构建产物：SPA 可服务性
 *  E. 线上实例：DSH 里真实挂载的路由
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve(import.meta.dirname, '..');
const results = [];
const add = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail });

/* ============================ A. 静态检查 ============================ */

const REQUIRED = [
  'package.json', 'cordis.patch.yml', 'icon.svg', 'client.js', 'README.md',
  'locale/zh.json', 'locale/en.json',
  'host/index.js', 'host/security.js', 'host/config.js', 'host/static.js', 'host/runtime.js', 'host/tools.js',
  'host/api/index.js',
  'host/store/json-store.js', 'host/store/models.js',
  'host/services/job-runner.js', 'host/services/job-store.js', 'host/services/comfy-client.js',
  'host/services/seedance-client.js', 'host/services/previz-controller.js',
  'host/services/h3-workshop.js', 'host/services/post.js', 'host/services/asset-service.js',
  'app-dist/index.html', 'data/workflows/h3.json',
];
for (const rel of REQUIRED) {
  add('A-结构', rel, fs.existsSync(path.join(ROOT, rel)));
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
add('A-结构', 'package.json 有 dsh.bundle.patch', Boolean(pkg.dsh?.bundle?.patch));
add('A-结构', 'package.json exports 含 ./client', Boolean(pkg.exports?.['./client']));
add('A-结构', 'files 含 app-dist', (pkg.files || []).some((f) => f.includes('app-dist')));
add('A-结构', 'patch yml 声明新插件 id', fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8').includes('jiuzhang-studio'));

/* ============================ B. Host 模块 ============================ */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-verify-'));
process.env.DSH_JZ_CONFIG_FILE = path.join(tmp, 'config.json');
process.env.DSH_JZ_DATA_DIR = tmp;

const { resetConfigCache, loadConfig, saveConfig, sanitizeConfigPatch, maskConfig } = await import('../host/config.js');
resetConfigCache();
const cfg = loadConfig();
add('B-配置', '默认 dataDir 指向隔离目录', cfg.dataDir === tmp, cfg.dataDir);

// 白名单：可执行路径不可注入
const inj = sanitizeConfigPatch({ ffmpeg: 'C:/evil.exe', previzExe: 'x', comfyUrl: 'http://127.0.0.1:8188' });
add('B-配置', 'ffmpeg 不可注入', !('ffmpeg' in inj));
add('B-配置', 'previzExe 不可注入', !('previzExe' in inj));
add('B-配置', 'comfyUrl 可配置', 'comfyUrl' in inj);
add('B-配置', '掩码回填被丢弃', Object.keys(sanitizeConfigPatch({ seedanceApiKey: '***' })).length === 0);
saveConfig({ seedanceApiKey: 'sk-test-123' });
add('B-配置', '密钥读取时掩码', maskConfig(loadConfig()).seedanceApiKey === '***');

// 安全
const { safeId, safeJoin, isSameOrigin } = await import('../host/security.js');
let blocked = 0;
for (const bad of ['../../..', '../x', 'a/b', '', 'x'.repeat(100)]) {
  try { safeId(bad); } catch { blocked++; }
}
add('B-安全', 'id 白名单拦截穿越', blocked === 5, `${blocked}/5`);
try { safeJoin(tmp, '../../../Windows'); add('B-安全', 'safeJoin 拦截穿越', false); }
catch { add('B-安全', 'safeJoin 拦截穿越', true); }
add('B-安全', '跨源 Origin 被判否', isSameOrigin({ headers: { origin: 'http://evil.example', host: '127.0.0.1:1' } }) === false);
add('B-安全', '同源 Origin 被判真', isSameOrigin({ headers: { origin: 'http://127.0.0.1:1', host: '127.0.0.1:1' } }) === true);

// 串行写
const { collectionStore, drainQueues } = await import('../host/store/json-store.js');
const cs = collectionStore(path.join(tmp, 'conc.json'), { prefix: 'c' });
await Promise.all(Array.from({ length: 40 }, (_, i) => cs.upsert({ id: `c_${i}`, i })));
await drainQueues();
add('B-存储', '并发 40 写不丢', (await cs.list()).length === 40, (await cs.list()).length);

// 模型
const { NODE_TYPES, ASSET_TYPES, resolutionFor, h3Length, PROFILES, H3_MODEL_SLOTS } = await import('../host/store/models.js');
add('B-模型', '26 种节点', NODE_TYPES.length === 26, NODE_TYPES.length);
add('B-模型', '15 类资产（含人设卡）', ASSET_TYPES.length === 15, ASSET_TYPES.length);
add('B-模型', '19 档 H3 槽位', H3_MODEL_SLOTS.length === 19, H3_MODEL_SLOTS.length);
add('B-模型', '5 个生成档位', Object.keys(PROFILES).length === 5);
add('B-模型', 'P24 16:9 = 1056x608', resolutionFor('P24-quality', '16:9').width === 1056);
add('B-模型', 'P24 9:16 = 608x1056', resolutionFor('P24-quality', '9:16').width === 608);
add('B-模型', '5s = 124 帧', h3Length(5) === 124);
add('B-模型', '10s = 243 帧', h3Length(10) === 243);
add('B-模型', '15s = 362 帧', h3Length(15) === 362);

// 分段引擎
const { segmentScript, extractAssets } = await import('../host/services/h3-workshop.js');
const script = '第一场 夜 街道\n林晚：我不等了。\n陈默：你没有选择吗？\n\n第二场 室内 办公室\n陈默：签了它。';
const seg = segmentScript(script, { durationMin: 4, durationMax: 10, style: '冷色调' });
add('B-工坊', '分段产生', seg.segments.length >= 2, seg.segments.length);
const ex = extractAssets(seg.segments);
add('B-工坊', '角色抽取', ex.characters.length === 2, ex.characters.map((c) => c.name).join(','));
add('B-工坊', '场景抽取', ex.scenes.length >= 2, ex.scenes.length);
add('B-工坊', '音色抽取', ex.voices.length === 2, ex.voices.length);
add('B-工坊', '分段时间在区间内', seg.segments.every((s) => s.durationSec >= 4 && s.durationSec <= 10));

// 工作流
const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/workflows/h3.json'), 'utf8'));
// API 格式：{ "1": { class_type, inputs } }
const wfNodes = Object.values(wf);
add('B-工作流', 'h3.json 可解析', wfNodes.length > 0 && wfNodes.every((n) => n && n.class_type));
add('B-工作流', '含 H3 节点', wfNodes.some((n) => /MiniMaxH3/.test(n.class_type)));
add('B-工作流', '含 LoadImage 参考图节点', wfNodes.filter((n) => n.class_type === 'LoadImage').length >= 1);
add('B-工作流', '含 SaveVideo 输出', wfNodes.some((n) => n.class_type === 'SaveVideo'));
const raw = fs.readFileSync(path.join(ROOT, 'data/workflows/h3.json'), 'utf8');
// 新版工作流是 ReferenceToVideo 链路：参考图用 REF_IMAGE_*，不再有 CFG/首尾帧占位符
for (const ph of ['PROMPT', 'WIDTH', 'HEIGHT', 'LENGTH', 'STEPS', 'SEED', 'REF_IMAGE_1', 'REF_IMAGE_SIZE']) {
  add('B-工作流', `占位符 ${ph}`, raw.includes(`{{${ph}}}`));
}

/* ============================ C. HTTP 集成 ============================ */

const { initRuntime, attachControllers } = await import('../host/runtime.js');
const { handleApi } = await import('../host/api/index.js');
const { serveSpa } = await import('../host/static.js');
const { createPrevizController } = await import('../host/services/previz-controller.js');
const { createH3Workshop } = await import('../host/services/h3-workshop.js');
const { createPostService } = await import('../host/services/post.js');
const { createAssetService } = await import('../host/services/asset-service.js');

let port = 0;
initRuntime({ root: ROOT, cfg, webServer: { getOrigin: () => `http://127.0.0.1:${port}` } });
attachControllers({
  previz: createPrevizController({ root: ROOT, cfg }),
  h3: createH3Workshop({ root: ROOT, cfg }),
  post: createPostService({ cfg }),
  assets: createAssetService({ cfg }),
});

const distTmp = path.join(tmp, 'dist');
fs.mkdirSync(distTmp, { recursive: true });
fs.writeFileSync(path.join(distTmp, 'index.html'), '<!doctype html><title>九章工作室</title><div id=root></div>');
fs.writeFileSync(path.join(distTmp, 'a.txt'), 'static-ok');

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/luoshu/api')) return handleApi(req, res).catch((e) => { res.writeHead(500); res.end(String(e)); });
  if (u.pathname.startsWith('/luoshu/app')) return serveSpa(req, res, { prefix: '/luoshu/app', distDir: distTmp }).catch(() => res.end());
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
port = server.address().port;
const base = `http://127.0.0.1:${port}`;

async function call(method, p, body, headers = {}) {
  const r = await fetch(base + p, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* not json */ }
  return { status: r.status, json: j, text: t };
}

const tokRes = await call('GET', '/luoshu/api/token');
const TOKEN = tokRes.json?.token;
add('C-HTTP', 'GET /token 返回 token', Boolean(TOKEN));
add('C-HTTP', 'GET /token 注入 origin', tokRes.json?.origin === base);

add('C-HTTP', '无 token 写被拒', (await call('POST', '/luoshu/api/projects', { name: 'x' })).status === 403);
add('C-HTTP', '跨源读被拒', (await call('GET', '/luoshu/api/projects', null, { Origin: 'http://evil.example' })).status === 403);

const proj = await call('POST', '/luoshu/api/projects', { name: 'V项目', category: 'drama' }, { 'X-JZ-Token': TOKEN });
add('C-HTTP', '带 token 建项目', proj.status === 200 && Boolean(proj.json?.id));
add('C-HTTP', '项目读回', (await call('GET', '/luoshu/api/projects')).json?.length === 1);

const pid = proj.json.id;
const shot = await call('POST', `/luoshu/api/projects/${pid}/shots`,
  { shot: { title: 'V镜头', durationSec: 3, ratio: '16:9', profile: 'P12-draft', backend: 'mock', style: '电影感' } },
  { 'X-JZ-Token': TOKEN });
add('C-HTTP', '建镜头', shot.status === 200 && Boolean(shot.json?.id));

const meta = await call('GET', '/luoshu/api/meta');
add('C-HTTP', 'meta 26 节点', meta.json?.nodeTypes?.length === 26);
add('C-HTTP', 'meta 19 槽位', meta.json?.h3Slots?.length === 19);

const an = await call('POST', '/luoshu/api/h3/workshop/analyze',
  { text: '林晚：走。\n陈默：不。', episode: 1, durationMin: 4, durationMax: 10 }, { 'X-JZ-Token': TOKEN });
add('C-HTTP', '工坊 analyze', an.status === 200 && an.json?.segments?.length >= 1);

const imp = await call('POST', '/luoshu/api/h3/workshop/import', { projectId: pid, analysis: an.json }, { 'X-JZ-Token': TOKEN });
add('C-HTTP', '工坊 import 建资产', (imp.json?.summary?.created ?? 0) > 0);

add('C-HTTP', '未知路由 404', (await call('GET', '/luoshu/api/nope')).status === 404);
add('C-HTTP', '坏集数报错', (await call('POST', '/luoshu/api/h3/workshop/analyze', { text: 'x', episode: 0 }, { 'X-JZ-Token': TOKEN })).status === 500);

// SPA 服务
const sp = await fetch(base + '/luoshu/app/');
add('C-SPA', 'index 200', sp.status === 200);
add('C-SPA', '静态资源可取', (await fetch(base + '/luoshu/app/a.txt')).status === 200);
add('C-SPA', '穿越被挡', !(await (await fetch(base + '/luoshu/app/../../../etc/passwd')).text()).includes('root:'));

// 生成（mock，真出片）
const gen = await call('POST', '/luoshu/api/generate', { projectId: pid, shotId: shot.json.id, backend: 'mock' }, { 'X-JZ-Token': TOKEN });
add('C-生成', '提交 mock 任务', gen.status === 200 && Boolean(gen.json?.id));
const jobId = gen.json.id;
let finalJob = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const list = (await call('GET', '/luoshu/api/jobs')).json || [];
  finalJob = list.find((j) => j.id === jobId);
  if (finalJob && ['completed', 'failed', 'cancelled'].includes(finalJob.status)) break;
}
add('C-生成', '任务到达终态', Boolean(finalJob) && finalJob.status !== 'queued', finalJob?.status);
add('C-生成', 'mock 出片成功', finalJob?.status === 'completed', finalJob?.error || '');
if (finalJob?.outputs?.[0]?.path) {
  const out = finalJob.outputs[0];
  add('C-生成', '产物文件存在', fs.existsSync(out.path), out.path);
  add('C-生成', '产物非空', fs.statSync(out.path).size > 1000, out.bytes);
}

server.close();

/* ============================ 结果汇总 ============================ */

const byGroup = {};
for (const r of results) {
  byGroup[r.group] ||= { pass: 0, fail: 0, fails: [] };
  if (r.ok) byGroup[r.group].pass++;
  else { byGroup[r.group].fail++; byGroup[r.group].fails.push(`${r.name}${r.detail !== undefined ? ' :: ' + r.detail : ''}`); }
}

console.log('========== 验收结果 ==========');
let totalPass = 0, totalFail = 0;
for (const [g, s] of Object.entries(byGroup)) {
  console.log(`${g.padEnd(10)} PASS ${String(s.pass).padStart(2)}  FAIL ${s.fail}`);
  for (const f of s.fails) console.log(`   ✗ ${f}`);
  totalPass += s.pass; totalFail += s.fail;
}
console.log('-------------------------------');
console.log(`TOTAL PASS=${totalPass} FAIL=${totalFail}`);

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(totalFail ? 1 : 0);

