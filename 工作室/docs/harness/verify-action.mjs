/**
 * 端到端动作验证：在浏览器里点击「渲染预演像素」，确认调用真实后端、
 * 返回帧数、缩略图刷新、无错误。
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

const URL_ = process.argv[2] || 'http://127.0.0.1:4477/';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9750 + Math.floor(Math.random() * 40);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-act-'));
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
const errors = [];
const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result && r.result.value;
};

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
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(5500);

  // 切到右栏「预演」tab
  await ev(`(function(){ const b=Array.from(document.querySelectorAll('.avs-inspector-tabs button')).find(x=>(x.innerText||'').trim()==='预演'); if(b) b.click(); })()`);
  await sleep(1200);

  console.log('before:', await ev(`(function(){
    const txt=(document.body.innerText||'').replace(/\\s+/g,' ');
    const imgs=Array.from(document.querySelectorAll('img')).map(i=>({s:(i.getAttribute('src')||'').slice(-40), w:i.naturalWidth}));
    return JSON.stringify({ imgs, hasToast: !!document.querySelector('.avs-toast'), snippet: txt.slice(0,60) });
  })()`));

  // 点「渲染预演像素」
  const clicked = await ev(`(function(){
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => (x.innerText||'').trim().indexOf('渲染预演像素') >= 0);
    if (!b) return 'not-found:' + btns.map(x=>(x.innerText||'').trim()).filter(Boolean).join('|').slice(0,300);
    if (b.disabled) return 'disabled';
    b.click(); return 'clicked';
  })()`);
  console.log('click:', clicked);

  // 等渲染完成（含真实 ffmpeg 合成，>=40s 余量）
  let toast = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    toast = await ev(`(function(){
      const t = document.querySelector('.avs-toast');
      return t ? (t.innerText||'').trim() : '';
    })()`);
    if (toast && (toast.indexOf('帧') >= 0 || toast.indexOf('失败') >= 0 || toast.indexOf('error') >= 0 || toast.indexOf('code') >= 0)) break;
  }
  console.log('toast:', JSON.stringify(toast));

  const after = await ev(`(function(){
    const imgs=Array.from(document.querySelectorAll('img')).map(i=>({s:(i.getAttribute('src')||'').slice(-42), w:i.naturalWidth, h:i.naturalHeight}));
    return JSON.stringify({
      imgs,
      videos: Array.from(document.querySelectorAll('video')).map(v=>({src:(v.getAttribute('src')||'').slice(-30), rs:v.readyState})),
      stageTab: Array.from(document.querySelectorAll('.avs-segmented button')).map(b=>({t:(b.innerText||'').trim(), a:b.className.indexOf('active')>=0})),
    });
  })()`);
  console.log('after:', after);

  const s = await send('Page.captureScreenshot', { format: 'png' });
  const f = 'F:\\AI视频\\工作室\\docs\\ui-shots\\render-action.png';
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
  console.log('SHOT=' + f + ' bytes=' + fs.statSync(f).size);
  console.log('ERRORS=' + JSON.stringify(errors.slice(0, 15)));
} catch (e) {
  console.log('ACTION_FAILED=' + e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  try { child.kill(); } catch {}
  await sleep(350);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
