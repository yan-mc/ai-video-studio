/**
 * 交互验证：逐个点击页签与右栏 tab，确认无崩溃、面板内容正确、
 * 预演渲染产物缩略图可加载、iframe 指向导演台。
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2] || 'http://127.0.0.1:4477/';
const SHOTDIR = process.argv[3] || 'F:\\AI视频\\工作室\\docs\\ui-shots';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9800 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tab-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

fs.mkdirSync(SHOTDIR, { recursive: true });

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1400,900',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-sync', '--disable-background-networking', '--noerrdialogs', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
const errors = [];
const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result && r.result.value;
};
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  const f = path.join(SHOTDIR, name + '.png');
  fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
  return { file: f, bytes: fs.statSync(f).size };
};

const results = [];
try {
  let t = null;
  for (let i = 0; i < 60; i++) { try { t = await getJson('/json/list'); if (t && t.some((x) => x.type === 'page')) break; } catch {} await sleep(400); }
  const page = t.find((x) => x.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + (m.params.args || []).map((a) => a.value || a.description).join(' '));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(5500);

  // 页签：点 topbar 内导航按钮，按文本匹配
  const tabs = ['分镜', '任务', '资产包', '预演', '后端', '设置'];
  for (const label of tabs) {
    const clicked = await ev(`(function(){
      const btns = Array.from(document.querySelectorAll('.avs-nav button, .avs-topbar button'));
      const b = btns.find((x) => (x.innerText||'').trim() === ${JSON.stringify(label)});
      if (!b) return false;
      b.click(); return true;
    })()`);
    await sleep(1200);
    const info = await ev(`(function(){
      const txt = (document.body.innerText||'').replace(/\\s+/g,' ');
      return JSON.stringify({
        clicked: ${clicked},
        active: Array.from(document.querySelectorAll('.avs-nav button')).filter(b=>b.className.indexOf('active')>=0).map(b=>(b.innerText||'').trim()),
        textLen: txt.length,
        head: txt.slice(0,260),
        iframes: Array.from(document.querySelectorAll('iframe')).map(f=>f.getAttribute('src')),
        imgs: Array.from(document.querySelectorAll('img')).map(i=>({s:(i.getAttribute('src')||'').slice(-40), w:i.naturalWidth, h:i.naturalHeight})),
        videos: document.querySelectorAll('video').length,
        panels: document.querySelectorAll('.avs-panel').length,
        empty: document.querySelectorAll('.avs-empty-panel, .avs-empty').length
      });
    })()`);
    const s = await shot('tab-' + (tabs.indexOf(label) + 1));
    results.push({ tab: label, ...JSON.parse(info), shot: s });
  }

  // 右栏 tab：属性/预演/数据
  await ev(`(function(){ const b = Array.from(document.querySelectorAll('.avs-nav button')).find(x=>(x.innerText||'').trim()==='分镜'); if(b) b.click(); })()`);
  await sleep(1000);
  for (const label of ['属性', '预演', '数据']) {
    const ok = await ev(`(function(){
      const b = Array.from(document.querySelectorAll('.avs-inspector-tabs button, .avs-inspector button')).find((x)=>(x.innerText||'').trim()===${JSON.stringify(label)});
      if (!b) return false; b.click(); return true;
    })()`);
    await sleep(1500);
    const info = await ev(`(function(){
      const txt=(document.body.innerText||'').replace(/\\s+/g,' ');
      return JSON.stringify({
        active: Array.from(document.querySelectorAll('.avs-inspector-tabs button')).filter(b=>b.className.indexOf('active')>=0).map(b=>(b.innerText||'').trim()),
        imgs: Array.from(document.querySelectorAll('img')).map(i=>({s:(i.getAttribute('src')||'').slice(-46), w:i.naturalWidth, h:i.naturalHeight})),
        videos: Array.from(document.querySelectorAll('video')).map(v=>({src:(v.getAttribute('src')||'').slice(-40), rs:v.readyState})),
        hasRenderBtn: !!Array.from(document.querySelectorAll('button')).find(b=>(b.innerText||'').indexOf('渲染')>=0),
        snippet: txt.slice(0,300)
      });
    })()`);
    const s = await shot('insp-' + label);
    results.push({ inspectorTab: label, clicked: ok, ...JSON.parse(info), shot: s });
  }

  console.log('RESULTS=' + JSON.stringify(results, null, 1));
  console.log('ERRORS=' + JSON.stringify(errors.slice(0, 25), null, 1));
} catch (e) {
  console.log('TAB_FAILED=' + e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  try { child.kill(); } catch {}
  await sleep(350);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
