/**
 * 用 Edge headless (CDP) 打开 UI harness，验证 client.js 的真实浏览器渲染结果。
 * 检查：boot 状态、注册槽位、DOM 结构（顶栏/三栏/时间轴）、文本内容、
 *       控制台错误、iframe 目标、以及截图。
 *
 * 用法：node verify-ui.mjs [url] [outPng]
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2] || 'http://127.0.0.1:4477/';
const OUT = process.argv[3] || path.join(os.tmpdir(), 'studio-ui.png');
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9700 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-ui-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1400,900', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--disable-component-update', '--no-service-autorun', '--password-store=basic',
  '--disable-default-apps', '--disable-popup-blocking', '--metrics-recording-only',
  '--noerrdialogs', '--disable-infobars', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result && r.result.value;
};

const consoleErrors = [];
const consoleAll = [];

try {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = await getJson('/json/list'); if (targets && targets.some((t) => t.type === 'page')) break; } catch { /* retry */ }
    await sleep(400);
  }
  const page = targets && targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = (m.params.args || []).map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ');
      consoleAll.push(m.params.type + ': ' + text);
      if (m.params.type === 'error') consoleErrors.push(text);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      consoleErrors.push('exception: ' + (d.exception && (d.exception.description || d.exception.value) || d.text));
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(6000); // React 挂载 + 真实 API 往返

  const report = await evaluate(`(function(){
    const q = (s) => document.querySelector(s);
    const all = (s) => Array.from(document.querySelectorAll(s));
    const txt = (document.body.innerText || '');
    const root = q('.avs-root');
    const cs = root ? getComputedStyle(root) : null;
    return JSON.stringify({
      boot: window.__BOOT__ || null,
      registered: window.__REGISTERED__ || null,
      errors: (window.__ERRORS__ || []).slice(0, 40),
      rootPresent: !!root,
      rootSize: root ? { w: Math.round(root.getBoundingClientRect().width), h: Math.round(root.getBoundingClientRect().height) } : null,
      rootDisplay: cs ? cs.display : null,
      rootHeight: cs ? cs.height : null,
      topbar: !!q('.avs-topbar'),
      topbarH: q('.avs-topbar') ? Math.round(q('.avs-topbar').getBoundingClientRect().height) : null,
      main: !!q('.avs-main'),
      mainCols: q('.avs-main') ? getComputedStyle(q('.avs-main')).gridTemplateColumns : null,
      sidebar: !!q('.avs-shots-panel') || !!q('.avs-sidebar'),
      inspector: !!q('.avs-inspector'),
      stage: !!q('.avs-stage-area') || !!q('.avs-stage-body'),
      timeline: !!q('.avs-timeline'),
      timelineH: q('.avs-timeline') ? Math.round(q('.avs-timeline').getBoundingClientRect().height) : null,
      rulerTicks: all('.avs-ruler span').length,
      shotRows: all('.avs-shot-row').length,
      elementRows: all('.avs-element-row').length,
      keyframeDots: all('.avs-keyframe-dot').length,
      clipBars: all('.avs-clip, .avs-shot-bar').length,
      iframes: all('iframe').map((f) => f.getAttribute('src')),
      navTabs: all('.avs-nav button, .avs-topbar button').map((b) => (b.innerText||'').trim()).filter(Boolean),
      activeNav: all('.avs-nav button').filter((b)=>b.className.indexOf('active')>=0).map((b)=>(b.innerText||'').trim()),
      textLen: txt.length,
      textHead: txt.replace(/\\s+/g,' ').slice(0, 700),
      images: all('img').map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight })),
      videoCount: all('video').length,
      hasEmptyPanel: all('.avs-empty-panel, .avs-empty').length,
      styleInjected: !!document.querySelector('style[data-avs-style]'),
      styleRules: (function(){ const s=document.querySelector('style[data-avs-style]'); if(!s||!s.sheet) return -1; try { return s.sheet.cssRules.length; } catch(e){ return -2; } })(),
    });
  })()`);
  const R = JSON.parse(report);
  console.log('REPORT=' + JSON.stringify(R, null, 1));
  console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleErrors.slice(0, 30), null, 1));
  console.log('CONSOLE_ALL_COUNT=' + consoleAll.length);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('SCREENSHOT=' + OUT + ' bytes=' + fs.statSync(OUT).size);
} catch (e) {
  console.log('VERIFY_FAILED=' + (e.message || e));
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  try { child.kill(); } catch { /* ignore */ }
  await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
