/**
 * 面板行为验证：点击「打开」按钮，检查它究竟打开了什么 URL。
 *
 * 为什么需要：client.js 的入口按钮用 window.open 打开 SPA。在 Electron 里
 * window.open 可能被拦（返回 null 且不报错），用户看到的现象就是"点了没反应"。
 * 这个脚本把 window.open 换成记录器，从而可验证 URL 拼得对不对。
 *
 * 用法：node verify-panel.mjs <harnessUrl>
 */
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:4478/';
const PORT = Number(process.env.CDP_PORT || 9333);
const cdp = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // CDP 的 /json/new 只接受 PUT（新版 Chrome/Edge 会拒绝 GET）
  let t = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json();
  if (!t?.webSocketDebuggerUrl) {
    const list = await (await fetch(`${cdp}/json/list`)).json();
    t = list.find((x) => x.type === 'page');
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: base });
  await sleep(4000);

  // 安装 window.open 记录器 + 点击所有「打开」区的按钮
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const opened = [];
      const realOpen = window.open;
      window.open = (u) => { opened.push(String(u)); return null; };
      const buttons = [...document.querySelectorAll('.jz-btn')];
      const launches = buttons.filter((b) => /渲染页|剧本|漫画|模特|素材库|角色卡|项目|立绘|3D 预演|画布|图像生成|任务|设置/.test(b.innerText));
      launches.forEach((b) => { try { b.click(); } catch (e) {} });
      window.open = realOpen;
      return JSON.stringify({
        launchCount: launches.length,
        labels: launches.map((b) => b.innerText.split('\\n')[0]),
        opened,
        badUrls: opened.filter((u) => !/^https?:\\/\\/127\\.0\\.0\\.1:\\d+\\/jiuzhang\\/app\\/#\\//.test(u)),
      });
    })()`,
    returnByValue: true,
  });

  const data = JSON.parse(r.result?.result?.value || '{}');
  console.log(JSON.stringify(data, null, 2));

  const bad = (data.badUrls ?? []).length > 0 || (data.launchCount ?? 0) !== 13;
  console.log(bad ? 'FAIL' : 'OK: 13 entries, all URLs well-formed');
  ws.close();
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
