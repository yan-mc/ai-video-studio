/**
 * 调试：在 harness 页面内直接调用插件 API，确认 fetch 打桩与数据流。
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2] || 'http://127.0.0.1:4477/';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9900 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-dbg-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1400,900',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-sync', '--disable-background-networking', '--noerrdialogs', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __error: JSON.stringify(r.exceptionDetails).slice(0, 500) };
  return r.result && r.result.value;
};

try {
  let t = null;
  for (let i = 0; i < 60; i++) { try { t = await getJson('/json/list'); if (t && t.some((x) => x.type === 'page')) break; } catch {} await sleep(400); }
  const page = t.find((x) => x.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(5000);

  console.log('fetch-same-origin:', JSON.stringify(await ev(`fetch('/ai-video-studio/api/projects').then(r=>r.status+' len:'+r.text().then(t=>t.length))`)));
  console.log('fetch-status:', await ev(`fetch('/ai-video-studio/api/projects').then(r=>r.status).catch(e=>'ERR '+e.message)`));
  console.log('fetch-body:', await ev(`fetch('/ai-video-studio/api/projects').then(r=>r.text()).then(t=>t.slice(0,180)).catch(e=>'ERR '+e.message)`));
  console.log('boot:', await ev(`String(window.__BOOT__)`));
  console.log('errors:', await ev(`JSON.stringify(window.__ERRORS__||[]).slice(0,600)`));
  // 直接调用 client.js 内部 api() 无法访问；改为检查 DOM 中是否有 0/0 徽标与项目列表
  console.log('projectsDom:', await ev(`JSON.stringify({ rows: document.querySelectorAll('.avs-shot-row').length, text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200) })`));
  // 手动触发一次 reload 观察网络
  console.log('netCheck:', await ev(`(async()=>{ const r = await fetch('/ai-video-studio/api/projects'); const j = await r.json(); return JSON.stringify({status:r.status, n: Array.isArray(j)?j.length:'not-array'}); })()`));
} catch (e) {
  console.log('DBG_FAILED=' + e.message);
} finally {
  try { ws && ws.close(); } catch {}
  try { child.kill(); } catch {}
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
