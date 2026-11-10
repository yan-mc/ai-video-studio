/**
 * 深度诊断：在 326px 宽度下，逐层检查 DOM 尺寸，定位 stage 宽度为 0 的原因。
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const W = process.argv[2] || '326';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9720 + Math.floor(Math.random() * 100);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-d-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1600,1000',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--noerrdialogs', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws, id = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
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
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  };
  await send('Runtime.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:4477/?w=${W}` });
  await sleep(5000);

  const dump = await ev(`(function(){
    const rows = [];
    function walk(el, depth) {
      if (!el || depth > 6) return;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      rows.push({
        d: depth,
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 46),
        w: Math.round(r.width), h: Math.round(r.height),
        disp: cs.display, flex: cs.flex, gtc: cs.gridTemplateColumns.slice(0, 40),
        pos: cs.position,
      });
      for (const c of el.children) walk(c, depth + 1);
    }
    const host = document.getElementById('host');
    if (host) walk(host, 0);
    return JSON.stringify(rows);
  })()`);
  const rows = JSON.parse(dump);
  console.log('idx | d | tag.class                                     | w x h    | display  | flex');
  rows.forEach((r, i) => {
    if (r.w === 0 || r.h === 0 || i < 24) {
      console.log(`${String(i).padStart(3)} | ${r.d} | ${(r.tag + '.' + r.cls).padEnd(46)} | ${String(r.w).padStart(4)}x${String(r.h).padStart(4)} | ${r.disp.padEnd(8)} | ${r.flex}`);
    }
  });
} catch (e) {
  console.log('FAILED=' + e.message);
} finally {
  try { ws && ws.close(); } catch { /* */ }
  try { child.kill(); } catch { /* */ }
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* */ }
}
