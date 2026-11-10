/**
 * 点击页签验证：资产库 / 资产包 / 角色卡 三个子页签能否正常渲染。
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9650 + Math.floor(Math.random() * 60);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-t-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});
const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1400,1000',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--noerrdialogs', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
const errs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result && r.result.value;
};

const out = [];
try {
  let t = null;
  for (let i = 0; i < 60; i++) { try { t = await getJson('/json/list'); if (t && t.some((x) => x.type === 'page')) break; } catch { /* */ } await sleep(400); }
  ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text);
  };
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4477/?w=1100' });
  await sleep(5500);

  // 1) 切到资产包页签
  await ev(`(function(){ const b=[...document.querySelectorAll('.avs-nav button')].find(x=>(x.innerText||'').trim()==='资产包'); if(b) b.click(); })()`);
  await sleep(1200);
  // 2) 三个子页签
  for (const label of ['资产库（上传）', '资产包（外挂）', '角色卡']) {
    const clicked = await ev(`(function(){
      const b=[...document.querySelectorAll('.avs-nav-chip')].find(x=>(x.innerText||'').trim().indexOf(${JSON.stringify(label)})>=0);
      if(!b) return false; b.click(); return true;
    })()`);
    await sleep(1400);
    const info = await ev(`(function(){
      const txt=(document.body.innerText||'').replace(/\\s+/g,' ');
      return JSON.stringify({
        clicked: ${clicked},
        chips: [...document.querySelectorAll('.avs-nav-chip')].map(x=>(x.innerText||'').trim()),
        assetCards: document.querySelectorAll('.avs-asset-card').length,
        charCards: document.querySelectorAll('.avs-char-card').length,
        packRows: document.querySelectorAll('.avs-list-row').length,
        imgs: document.querySelectorAll('.avs-asset-thumb img, .avs-char-avatar img').length,
        head: txt.slice(0, 260),
      });
    })()`);
    out.push({ label, ...JSON.parse(info) });
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = `F:\\AI视频\\工作室\\docs\\ui-tab-${label.replace(/[（）()]/g, '')}.png`;
    fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
  }
  console.log('RESULTS=' + JSON.stringify(out, null, 1));
  console.log('EXCEPTIONS=' + JSON.stringify(errs.slice(0, 10)));
} catch (e) {
  console.log('FAILED=' + e.message);
} finally {
  try { ws && ws.close(); } catch { /* */ }
  try { child.kill(); } catch { /* */ }
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* */ }
}
