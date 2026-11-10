/**
 * 在指定「面板宽度」下渲染 client.js，验证折叠逻辑与最终布局。
 * 用法：node verify-width.mjs [width] [outPng]
 *   宽度 = 模拟插件面板实际 CSS 宽度（DSH 侧栏会占掉 300+px）
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const W = process.argv[2] || '326';
const OUT = process.argv[3] || `F:\\AI视频\\工作室\\docs\\ui-w${W}.png`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9600 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-w-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

// 外层窗口开大，但 host 限制到目标宽度 —— 模拟 DSH 侧栏挤占
const url = `http://127.0.0.1:4477/?w=${W}`;
const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1600,1000', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--disable-background-networking', '--noerrdialogs',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
const errs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result && r.result.value;
};

try {
  let t = null;
  for (let i = 0; i < 60; i++) { try { t = await getJson('/json/list'); if (t && t.some((x) => x.type === 'page')) break; } catch { /* */ } await sleep(400); }
  const page = t.find((x) => x.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push((d.exception && d.exception.description) || d.text);
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(5500);

  const info = await ev(`(function(){
    const host = document.getElementById('host');
    const root = document.querySelector('.avs-root');
    const main = document.querySelector('.avs-main');
    const q = (s) => document.querySelector(s);
    const rect = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    return JSON.stringify({
      boot: window.__BOOT__ || null,
      errors: (window.__ERRORS__ || []).slice(0, 20),
      hostW: host ? Math.round(host.getBoundingClientRect().width) : null,
      rootW: root ? Math.round(root.getBoundingClientRect().width) : null,
      narrow: root ? root.getAttribute('data-narrow') : null,
      mainCols: main ? getComputedStyle(main).gridTemplateColumns : null,
      leftPane: rect('.avs-shots-panel'),
      stage: rect('.avs-stage-area'),
      rightPane: rect('.avs-inspector'),
      timeline: rect('.avs-timeline'),
      timelineCollapsed: q('.avs-timeline') ? q('.avs-timeline').className.indexOf('is-collapsed') >= 0 : null,
      leftCollapsed: main ? main.className.indexOf('is-left-collapsed') >= 0 : null,
      rightCollapsed: main ? main.className.indexOf('is-right-collapsed') >= 0 : null,
      expandStrips: document.querySelectorAll('.avs-expand-strip').length,
      navButtons: Array.from(document.querySelectorAll('.avs-nav button')).map(b => (b.innerText||'').trim()),
      topButtons: Array.from(document.querySelectorAll('.avs-topbar-right .avs-text-button')).map(b => (b.innerText||'').trim()),
      stageImg: (() => { const i = q('.avs-stage img'); return i ? { w: i.naturalWidth, h: i.naturalHeight } : null; })(),
    });
  })()`);
  const R = JSON.parse(info);
  console.log('REPORT=' + JSON.stringify(R, null, 1));
  console.log('EXCEPTIONS=' + JSON.stringify(errs.slice(0, 10), null, 1));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('SCREENSHOT=' + OUT + ' bytes=' + fs.statSync(OUT).size);
} catch (e) {
  console.log('FAILED=' + (e.message || e));
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch { /* */ }
  try { child.kill(); } catch { /* */ }
  await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* */ }
}
