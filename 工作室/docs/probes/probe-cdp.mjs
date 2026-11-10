/**
 * CDP 页面探测 + 截图（Edge headless + SwiftShader）
 * 用法: node _tmp-cdp-probe.mjs <url> <outPng> [waitMs] [label]
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2];
const OUT = process.argv[3];
const WAIT = Number(process.argv[4] || 9000);
const LABEL = process.argv[5] || 'probe';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

console.log(`[${LABEL}] EDGE=${EDGE}`);
console.log(`[${LABEL}] url=${URL_}`);
console.log(`[${LABEL}] debugPort=${PORT}  profile=${profile}`);

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1600,1000', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--disable-component-update',
  '--disable-background-networking', '--disable-popup-blocking', '--noerrdialogs',
  '--disable-infobars', '--homepage=about:blank', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws; let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

const result = { label: LABEL, url: URL_, debugPort: PORT, profile, ok: false };

try {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = await getJson('/json/list'); if (targets?.some((t) => t.type === 'page')) break; } catch { /* retry */ }
    await sleep(500);
  }
  const page = targets?.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  // 确认端口确实属于本实例
  const ver = await getJson('/json/version');
  console.log(`[${LABEL}] browser=${ver.Browser}  wsOwned=${page.webSocketDebuggerUrl.includes(':' + PORT)}`);
  result.browser = ver.Browser;
  result.wsOwned = page.webSocketDebuggerUrl.includes(':' + PORT);

  const WS = globalThis.WebSocket;
  ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  // 捕获主文档响应状态
  const docs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.responseReceived' && m.params.type === 'Document') {
      docs.push({ url: m.params.response.url, status: m.params.response.status, mime: m.params.response.mimeType });
    }
  });

  await send('Page.navigate', { url: URL_ });
  await sleep(WAIT);

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.text };
    return r.result?.value;
  };

  const info = await evalJs(`JSON.stringify({
    title: document.title,
    url: location.href,
    readyState: document.readyState,
    rootExists: !!document.getElementById('root'),
    rootChildren: (document.getElementById('root')||{}).children ? document.getElementById('root').children.length : 0,
    bodyChildren: document.body.children.length,
    canvasCount: document.querySelectorAll('canvas').length,
    canvasSizes: Array.from(document.querySelectorAll('canvas')).map(c=>({w:c.width,h:c.height,cw:c.clientWidth,ch:c.clientHeight})),
    iframeCount: document.querySelectorAll('iframe').length,
    iframeSrcs: Array.from(document.querySelectorAll('iframe')).map(f=>f.src),
    webgl: (()=>{try{const c=document.createElement('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 'no-context';return g.getParameter(g.VERSION)+' | '+g.getParameter(g.RENDERER);}catch(e){return 'err:'+e.message}})(),
    textLen: (document.body.innerText||'').length,
    textHead: (document.body.innerText||'').slice(0,400),
    hasDirectorWords: ['导演','分镜','Shot'].filter(w=>(document.body.innerText||'').includes(w))
  })`);
  console.log(`[${LABEL}] PAGE_INFO=` + info);
  result.pageInfo = JSON.parse(info || '{}');
  result.documentResponses = docs;

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  const bytes = fs.statSync(OUT).size;
  console.log(`[${LABEL}] SCREENSHOT=${OUT} bytes=${bytes}`);
  result.screenshot = OUT; result.screenshotBytes = bytes; result.ok = true;
} catch (e) {
  console.error(`[${LABEL}] PROBE_FAILED: ` + (e.message || e));
  result.error = String(e.message || e);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { child.kill(); } catch { /* ignore */ }
  await sleep(600);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  fs.writeFileSync(path.join('F:\\AI视频\\工作室\\docs', `_tmp-cdp-${LABEL}.json`), JSON.stringify(result, null, 2), 'utf8');
  console.log(`[${LABEL}] profileCleaned=${!fs.existsSync(profile)}`);
}
