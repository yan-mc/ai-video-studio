/**
 * 用 Edge (CDP) 打开预演导演台并截图，验证前端能否正常渲染。
 * 用法：node tools/probe-web.mjs [url] [outPng]
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2] || 'http://127.0.0.1:4318/';
const OUT = process.argv[3] || path.join(os.tmpdir(), 'previs-stage.png');
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-probe-'));

function getJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
      let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1600,1000', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--disable-features=msEdgeIdentityFeature,msEdgeSync,EdgeCollections',
  '--disable-component-update', '--no-service-autorun', '--password-store=basic',
  '--disable-background-networking', '--disable-client-side-phishing-detection',
  '--disable-default-apps', '--disable-popup-blocking', '--disable-prompt-on-repost',
  '--metrics-recording-only', '--safebrowsing-disable-auto-update',
  '--homepage=about:blank', '--noerrdialogs', '--disable-infobars',
  URL_,
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

try {
  // wait for CDP
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = await getJson('/json/list'); if (targets?.some((t) => t.type === 'page')) break; } catch { /* retry */ }
    await sleep(500);
  }
  const page = targets?.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const WebSocket = (await import('node:worker_threads'), globalThis.WebSocket);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(8000); // let WebGL + React settle

  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

  const info = await evalJs(`JSON.stringify({
    title: document.title,
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    canvases: document.querySelectorAll('canvas').length,
    canvasSize: (()=>{const c=document.querySelector('canvas');return c?c.width+'x'+c.height:null})(),
    textLen: (document.body.innerText||'').length,
    textHead: (document.body.innerText||'').slice(0,400),
    appName: (document.body.innerText||'').includes('预演') || (document.body.innerText||'').includes('导演')
  })`);
  console.log('PAGE_INFO=' + info);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('SCREENSHOT=' + OUT + ' bytes=' + fs.statSync(OUT).size);
} catch (e) {
  console.error('PROBE_FAILED: ' + (e.message || e));
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { child.kill(); } catch { /* ignore */ }
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
