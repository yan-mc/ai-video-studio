/** 诊断 render.html 加载失败原因：抓控制台与异常。用法：node tools/diag-render.mjs [url] */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2] || 'http://127.0.0.1:4318/render.html';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9900 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port, path: p }, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});

const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run',
  '--no-default-browser-check', '--disable-sync', '--disable-features=msEdgeIdentityFeature,msEdgeSync', 'about:blank'],
  { stdio: 'ignore', windowsHide: true });

let ws;
try {
  let page = null;
  for (let i = 0; i < 60 && !page; i++) { try { page = (await httpJson('/json/list')).find((t) => t.type === 'page'); } catch { /* */ } if (!page) await sleep(500); }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[console.' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded') logs.push('[log.' + m.params.entry.level + '] ' + m.params.entry.text + ' @' + (m.params.entry.url || ''));
    if (m.method === 'Network.loadingFailed') logs.push('[netfail] ' + m.params.errorText + ' type=' + m.params.type);
    if (m.method === 'Network.responseReceived') { const r = m.params.response; if (r.status >= 400) logs.push('[http' + r.status + '] ' + r.url); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = Math.floor(Math.random() * 1e6); const h = (ev) => { const m = JSON.parse(ev.data); if (m.id === id) { ws.removeEventListener('message', h); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(9000);
  const st = await send('Runtime.evaluate', { expression: `JSON.stringify({hasPreviz: !!window.__PREVIZ__, ready: window.__PREVIZ__?.ready ?? null, hud: document.getElementById('hud')?.textContent ?? null, canvases: document.querySelectorAll('canvas').length, three: (window.__PREVIZ__?.info?.()?.three) ?? null})`, returnByValue: true });
  console.log('STATE=' + (st.result?.value ?? 'n/a'));
  console.log('--- LOGS ---');
  for (const l of logs.slice(0, 40)) console.log(l);
} catch (e) { console.error('DIAG_FAILED ' + e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch { /* */ } try { child.kill(); } catch { /* */ } await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* */ } }
