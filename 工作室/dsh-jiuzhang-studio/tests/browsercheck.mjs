// 用无头 Edge + CDP 验证 SPA 在真实浏览器里能渲染、无 JS 异常、能调通 API
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
/**
 * 浏览器冒烟检查：用无头 Edge/Chrome 打开 SPA，截图并收集控制台错误。
 *
 * 用法：
 *   node tests/browsercheck.mjs [url]
 *   DSH_PORT=7983 node tests/browsercheck.mjs
 *
 * 以前的默认值是写死的 `http://127.0.0.1:7983/jiuzhang/app/`，
 * 但 DSH 默认用 `--port 0` 随机端口 → 换台机器必失败。
 * 现在：命令行参数 > DSH_PORT/DSH_HOST_PORT 环境变量 > 7983 兜底。
 */
const port = process.env.DSH_PORT || process.env.DSH_HOST_PORT || '7983';
const URL_TO_TEST = process.argv[2] || `http://127.0.0.1:${port}/jiuzhang/app/`;
const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-edge-'));

const args = [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--disable-dev-shm-usage',
  '--window-size=1600,1000',
  'about:blank',
];
const child = spawn(EDGE, args, { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTargets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

let ws = null;
let msgId = 0;
const pending = new Map();
const events = [];

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

try {
  // 等 CDP 就绪
  let targets = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try { targets = await getTargets(); if (targets?.length) break; } catch { /* retry */ }
  }
  if (!targets?.length) throw new Error('CDP 未就绪');

  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('没有 page target');

  // Node 24 的全局 WebSocket 可用（实测 typeof === 'function'）
  let WSImpl = globalThis.WebSocket;
  if (typeof WSImpl !== 'function') {
    throw new Error('当前 Node 无全局 WebSocket（需要 Node 22+）');
  }
  ws = new WSImpl(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
    } else if (m.method) {
      events.push(m);
    }
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');

  await send('Page.navigate', { url: URL_TO_TEST });
  await sleep(3500);

  // 收集异常与 console error
  const badUrls=[];
  for (const e of events) {
    if (e.method === 'Network.responseReceived' && e.params?.response?.status >= 400) {
      const u = e.params.response.url;
      if (!u.endsWith('/favicon.ico')) badUrls.push(e.params.response.status + ' ' + u);
    }
  }
  const errors = [];
  for (const e of events) {
    if (e.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION: ' + (e.params?.exceptionDetails?.exception?.description || e.params?.exceptionDetails?.text));
    }
    if (e.method === 'Runtime.consoleAPICalled' && e.params?.type === 'error') {
      errors.push('CONSOLE.ERROR: ' + (e.params.args || []).map((a) => a.value ?? a.description).join(' '));
    }
    if (e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error') {
      const t = e.params.entry.text || '';
      const url = e.params.entry.url || '';
      if (!/favicon/.test(t) && !/favicon/.test(url)) errors.push('LOG.ERROR: ' + t);
    }
  }

  const evalExpr = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description };
    return { value: r.result?.value };
  };

  const title = await evalExpr('document.title');
  const rootLen = await evalExpr('document.getElementById("root")?.innerHTML?.length ?? 0');
  const bodyText = await evalExpr('document.body.innerText.slice(0,400)');
  const theme = await evalExpr('document.documentElement.dataset.theme');
  const accent = await evalExpr('document.documentElement.dataset.accent');
  const navCount = await evalExpr('document.querySelectorAll("nav a, nav button, [class*=\\"nav\\"] a, [class*=\\"nav\\"] button").length');
  const cssVars = await evalExpr(
    'JSON.stringify({accent:getComputedStyle(document.documentElement).getPropertyValue("--jz-accent").trim(),bg:getComputedStyle(document.body).backgroundColor})',
  );

  // 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath = process.argv[3] || path.join(os.tmpdir(), 'jz-spa.png');
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));

  console.log('=== SPA 浏览器验证 ===');
  console.log('URL      :', URL_TO_TEST);
  console.log('title    :', title.value);
  console.log('root DOM :', rootLen.value, '字符');
  console.log('theme    :', theme.value, '/ accent:', accent.value);
  console.log('CSS 变量 :', cssVars.value);
  console.log('nav 项数 :', navCount.value);
  console.log('正文前 400:', JSON.stringify(bodyText.value));
  console.log('404 请求:', badUrls.length); badUrls.forEach(u=>console.log('  ',u));
  console.log('JS 异常数:', errors.length);
  errors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 200)));
  console.log('截图     :', shotPath);

  const ok = !errors.length && (rootLen.value ?? 0) > 500 && title.value?.includes('九章');
  console.log('\n结果:', ok ? 'PASS' : 'FAIL');
  process.exitCode = ok ? 0 : 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { child.kill('SIGKILL'); } catch { /* ignore */ }
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

