// 集成测试：用真实 http server 挂载 handleApi + serveSpa，验证端到端
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-int-'));
process.env.DSH_JZ_CONFIG_FILE = path.join(tmp, 'config.json');
process.env.DSH_JZ_DATA_DIR = tmp;

const { saveConfig, resetConfigCache, loadConfig } = await import('../host/config.js');
resetConfigCache();
saveConfig({ dataDir: tmp, comfyInputDir: '' });
const cfg = loadConfig();

const { handleApi } = await import('../host/api/index.js');
const { initRuntime } = await import('../host/runtime.js');
const { serveSpa, serveStatic } = await import('../host/static.js');
const { createPrevizController } = await import('../host/services/previz-controller.js');
const { createH3Workshop } = await import('../host/services/h3-workshop.js');
const { createPostService } = await import('../host/services/post.js');
const { createAssetService } = await import('../host/services/asset-service.js');

const appDist = path.join(tmp, 'app-dist');
fs.mkdirSync(appDist, { recursive: true });
fs.writeFileSync(path.join(appDist, 'index.html'), '<!doctype html><title>test</title><div id=root></div>');
fs.writeFileSync(path.join(appDist, 'hello.txt'), 'hello-static');

// 先用一个占位端口启动，再回填真实端口（getOrigin 闭包读的是变量，late-bind 可以）
let port = 0;
initRuntime({ root: path.resolve(import.meta.dirname, '..'), cfg, webServer: { getOrigin: () => `http://127.0.0.1:${port}` } });
{
  const { attachControllers } = await import('../host/runtime.js');
  attachControllers({
    previz: createPrevizController({ root: import.meta.dirname, cfg }),
    h3: createH3Workshop({ root: import.meta.dirname, cfg }),
    post: createPostService({ cfg }),
    assets: createAssetService({ cfg }),
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/luoshu/api')) return handleApi(req, res).catch((e) => { res.writeHead(500); res.end(String(e)); });
  if (u.pathname.startsWith('/luoshu/app')) return serveSpa(req, res, { prefix: '/luoshu/app', distDir: appDist }).catch(() => res.end());
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const portActual = server.address().port;
port = portActual;
const base = `http://127.0.0.1:${port}`;
console.log('server on', base);

async function call(method, p, body, headers = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra ?? ''); }
}

/* 1) token 端点：免 token，返回 origin */
const tok = await call('GET', '/luoshu/api/token');
check('GET /token 200', tok.status === 200, tok.status);
check('token 有值', typeof tok.json?.token === 'string' && tok.json.token.length > 10);
check('origin 注入', tok.json?.origin === base, tok.json?.origin);
const TOKEN = tok.json?.token;

/* 2) 无 token 的写操作被拒 */
const w1 = await call('POST', '/luoshu/api/projects', { name: 'x' });
check('无 token 写被拒 403', w1.status === 403, w1.status + ' ' + w1.text.slice(0, 80));

/* 3) 带 token 的写操作成功 */
const w2 = await call('POST', '/luoshu/api/projects', { name: '测试项目', category: 'drama' }, { 'X-JZ-Token': TOKEN });
check('带 token 写成功', w2.status === 200 && w2.json?.id, w2.text.slice(0, 120));
const projId = w2.json?.id;

/* 4) 读操作免 token */
const r1 = await call('GET', '/luoshu/api/projects');
check('GET /projects 200', r1.status === 200 && Array.isArray(r1.json));
check('项目已持久化', r1.json?.length === 1 && r1.json[0].name === '测试项目');

/* 5) 跨源被拒 */
const x1 = await call('GET', '/luoshu/api/projects', null, { Origin: 'http://evil.example' });
check('跨源 Origin 403', x1.status === 403, x1.status);

/* 6) meta / monitor */
const meta = await call('GET', '/luoshu/api/meta');
check('meta 26 节点', meta.json?.nodeTypes?.length === 26, meta.json?.nodeTypes?.length);
check('meta 19 H3 槽位', meta.json?.h3Slots?.length === 19);
const mon = await call('GET', '/luoshu/api/monitor');
check('monitor 200', mon.status === 200 && mon.json?.jobs, mon.text.slice(0, 100));

/* 7) 镜头 + 提示词编译 */
const sh = await call('POST', `/luoshu/api/projects/${projId}/shots`, {
  shot: { title: '测试镜头', style: '电影感', description: '雨夜街道', durationSec: 5, ratio: '16:9', profile: 'P24-quality' },
}, { 'X-JZ-Token': TOKEN });
check('创建镜头', sh.status === 200 && sh.json?.id, sh.text.slice(0, 100));
const shots = await call('GET', `/luoshu/api/projects/${projId}/shots`);
check('镜头列表', Array.isArray(shots.json) && shots.json.length === 1);

/* 8) 分辨率 / 帧数 */
const rs = await call('POST', '/luoshu/api/resolution', { profile: 'P24-quality', ratio: '9:16' }, { 'X-JZ-Token': TOKEN });
check('分辨率 9:16', rs.json?.width === 608 && rs.json?.height === 1056, JSON.stringify(rs.json));
const ln = await call('POST', '/luoshu/api/h3/length', { durationSec: 5 }, { 'X-JZ-Token': TOKEN });
check('帧数 5s=124', ln.json?.length === 124, JSON.stringify(ln.json));

/* 9) H3 工坊 analyze */
const an = await call('POST', '/luoshu/api/h3/workshop/analyze', {
  action: 'analyze', text: '林晚：我不等了。\n陈默：你没有选择。',
  episode: 1, durationMin: 4, durationMax: 10, style: '冷色调',
}, { 'X-JZ-Token': TOKEN });
check('工坊 analyze 200', an.status === 200, an.text.slice(0, 200));
check('分段产生', (an.json?.segments?.length ?? 0) >= 1, an.json?.segments?.length);
check('角色抽取', (an.json?.assets?.characters?.length ?? 0) === 2, JSON.stringify(an.json?.assets?.characters?.map(c => c.name)));

/* 10) H3 工坊 import */
const im = await call('POST', '/luoshu/api/h3/workshop/import', {
  projectId: projId, analysis: an.json,
}, { 'X-JZ-Token': TOKEN });
check('工坊 import 200', im.status === 200, im.text.slice(0, 150));
check('资产已创建', (im.json?.summary?.created ?? 0) > 0, JSON.stringify(im.json?.summary));

/* 11) 错误路径：坏 episode */
const bad = await call('POST', '/luoshu/api/h3/workshop/analyze', { text: 'x', episode: 0 }, { 'X-JZ-Token': TOKEN });
check('坏集数报错', bad.status === 500 && /badEpisode/.test(bad.text), bad.text.slice(0, 100));

/* 12) 静态 SPA */
const sp = await fetch(base + '/luoshu/app/');
check('SPA index 200', sp.status === 200, sp.status);
const st = await fetch(base + '/luoshu/app/hello.txt');
check('静态文件', st.status === 200 && (await st.text()) === 'hello-static');

/* 13) 路径穿越 */
const trav = await fetch(base + '/luoshu/app/../../../etc/passwd');
check('穿越被挡（不返回 passwd）', !(await trav.text()).includes('root:'), trav.status);

/* 14) 未知路由 */
const un = await call('GET', '/luoshu/api/nope');
check('未知路由 404', un.status === 404, un.status + ' ' + un.text.slice(0, 80));

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n结果：PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);


