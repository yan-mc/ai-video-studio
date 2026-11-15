#!/usr/bin/env node
/**
 * 用 CDP 给 SPA 页面截图 / 收集控制台错误。
 *
 * 用途：改完 app-src 后做一次「真的打开并看一眼」的验证，
 * 而不是只靠 tsc + vite build 就说"好了"。
 *
 * 用法：
 *   node scripts/cdp-shot.mjs <url> <out.png> [--width=1440] [--height=900] [--wait=2500]
 *
 * 前置：一个开着 --remote-debugging-port 的 Chromium（Edge/Chrome 都行）。
 * 端口从环境变量 CDP_PORT 取，默认 9333。
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , urlArg, outArg, ...rest] = process.argv;
if (!urlArg || !outArg) {
  console.error('用法: node cdp-shot.mjs <url> <out.png> [--width=1440] [--height=900] [--wait=2500]');
  process.exit(2);
}
const opt = Object.fromEntries(
  rest.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const WIDTH = Number(opt.width || 1440);
const HEIGHT = Number(opt.height || 900);
const WAIT = Number(opt.wait || 2500);
const PORT = Number(process.env.CDP_PORT || opt.port || 9333);

const base = `http://127.0.0.1:${PORT}`;

async function httpJson(p) {
  const r = await fetch(base + p);
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status}`);
  return r.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
        else resolve(msg.result);
        return;
      }
      if (msg.method) {
        const list = this.handlers.get(msg.method);
        if (list) for (const fn of list) { try { fn(msg.params); } catch { /* ignore */ } }
      }
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(new Cdp(ws)));
    ws.addEventListener('error', (e) => reject(new Error('ws error: ' + (e?.message || 'unknown'))));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 建一个匿名 tab（about:blank），再导航到目标，避免 /json/new 的 URL 转义坑
  const target = await httpJson('/json/new?about:blank').catch(async () => {
    const list = await httpJson('/json/list');
    return list.find((t) => t.type === 'page');
  });
  if (!target?.webSocketDebuggerUrl) throw new Error('拿不到 CDP target');

  const cdp = await connect(target.webSocketDebuggerUrl);
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type !== 'error' && p.type !== 'warning') return;
    const text = (p.args || []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? '').join(' ');
    consoleErrors.push(`[${p.type}] ${text}`.slice(0, 600));
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    pageErrors.push(`${d.text || 'exception'} ${d.exception?.description || ''}`.slice(0, 900));
  });
  cdp.on('Network.loadingFailed', (p) => {
    if (p.blockedReason) return;
    failedRequests.push(`${p.errorText || 'failed'}${p.canceled ? ' (canceled)' : ''}`);
  });
  cdp.on('Network.responseReceived', (p) => {
    const r = p.response || {};
    if (r.status >= 400) failedRequests.push(`HTTP ${r.status} ${r.url}`);
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
  });

  await cdp.send('Page.navigate', { url: urlArg });
  await sleep(WAIT);

  // 读取页面可见文本，做一个廉价的可读性断言（不截图也能发现问题）
  const evalRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.getElementById('root');
      const text = (root ? root.innerText : document.body.innerText) || '';
      return JSON.stringify({
        title: document.title,
        hash: location.hash,
        rootChildren: root ? root.children.length : -1,
        textLength: text.length,
        textHead: text.slice(0, 1500),
      });
    })()`,
    returnByValue: true,
  });

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const abs = path.resolve(outArg);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from(shot.data, 'base64'));

  const info = JSON.parse(evalRes.result.value || '{}');
  const report = {
    url: urlArg,
    screenshot: abs,
    bytes: fs.statSync(abs).size,
    ...info,
    consoleErrors: consoleErrors.slice(0, 30),
    pageErrors: pageErrors.slice(0, 30),
    failedRequests: failedRequests.slice(0, 30),
  };
  console.log(JSON.stringify(report, null, 2));

  const bad = pageErrors.length > 0 || info.textLength < 40 || info.rootChildren <= 0;
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error('FAILED:', e?.message || e);
  process.exit(1);
});
