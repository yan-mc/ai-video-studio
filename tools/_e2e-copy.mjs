/**
 * 验证立绘拆解页的「复制默认值 / 复制当前」两个按钮真的能把文本写进剪贴板。
 *
 * 验证方式（不是"看按钮存不存在"）：
 *   1) 授予剪贴板读写权限（Browser.grantPermissions）
 *   2) 点按钮
 *   3) 用 `navigator.clipboard.readText()` 把**剪贴板里的内容读回来**
 *   4) 与页面上的默认提示词 / 输入框内容比对
 *
 * ⚠️ 比对必须归一化换行，**不能逐字节比**。
 *
 *    Windows 剪贴板的 text/plain 约定是 CRLF：写进去 `A\n\nB`，
 *    读回来就是 `A\r\n\r\nB`。实测 `navigator.clipboard.writeText` 与
 *    `document.execCommand('copy')` **两条路径都会**做这个转换 ——
 *    这是平台行为，不是缺陷。默认提示词有 14 个空行分隔，正好差 14 个 `\r`，
 *    逐字节比会误报"复制内容不对"。
 *    所以这里统一 `normalize()` 后再比。
 *
 * 只断言"点了没报错"是没用的 —— 复制失败也可以静默成功。
 *
 * 用法：
 *   node tools/_e2e-copy.mjs --target http://127.0.0.1:3180 --cdp 9333
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const TARGET = arg('--target', 'http://127.0.0.1:3180');
const CDP_PORT = Number(arg('--cdp', '9333'));
const OUTDIR = arg('--out', '');

/** 换行归一化：剪贴板会 LF → CRLF，比较前两边都拉平成 LF */
const normalize = (s) => String(s ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${name}`); return; }
  failed += 1;
  console.log(`  ❌ ${name}${detail ? `：${detail}` : ''}`);
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res());
      this.ws.addEventListener('error', (e) => rej(new Error(`WS_ERROR: ${e?.message || e}`)));
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.code} ${msg.error.message}`));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP_TIMEOUT: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(`PAGE_EXCEPTION: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
  return r.result?.value;
}

async function waitFor(cdp, expression, { timeoutMs = 40000, label = expression } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs(cdp, `Boolean(${expression})`)) return true; } catch { /* loading */ }
    await sleep(300);
  }
  throw new Error(`WAIT_TIMEOUT: ${label}`);
}

async function shot(cdp, name) {
  if (!OUTDIR) return;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(`${OUTDIR}\\${name}.png`, Buffer.from(data, 'base64'));
}

async function main() {
  console.log(`目标：${TARGET}/#/breakdown`);
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`${TARGET}/jiuzhang/app/#/breakdown`)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`无法新建标签页：${res.status}`);
  const page = await res.json();
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });

  // 剪贴板权限：不授予的话 navigator.clipboard 会抛 NotAllowedError
  await cdp.send('Browser.grantPermissions', {
    origin: TARGET,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });

  await sleep(1200);
  await waitFor(cdp, `document.querySelector('#root')?.children.length > 0`, { label: 'SPA 挂载' });
  await sleep(1500);

  // 清掉草稿并重载，保证是"默认值"初始态
  await evalJs(cdp, `(() => { try { localStorage.removeItem('jz.breakdown.promptDraft.v1'); } catch {} return true; })()`);
  await evalJs(cdp, `location.reload()`);
  await sleep(2500);
  await waitFor(cdp, `document.querySelector('#root')?.children.length > 0`, { label: 'SPA 重载' });
  await sleep(1800);

  /*
   * 页面现在默认落在「② 改提示词」（见 BreakdownPage 的 step 初值）：
   * 提示词框与复制按钮第一屏就可见。如果哪天有人把初值改回 'source'，
   * 这里会显式点一次，并在最后把这件事故意标出来。
   */
  const landedOn = await evalJs(cdp, `(() => {
    const hasTa = document.querySelectorAll('textarea').length > 0;
    const hasCopy = [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '复制默认值');
    return { hasTa, hasCopy };
  })()`);
  if (!landedOn.hasTa || !landedOn.hasCopy) {
    console.log('  （首屏没有提示词框，点一下「改提示词」）');
    await evalJs(cdp, `(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('改提示词'));
      if (b) b.click(); return true;
    })()`);
    await sleep(900);
  } else {
    console.log('  首屏即显示提示词框与复制按钮');
  }

  /* ---------------------------------------------- 1. 按钮存在 */
  console.log('\n[1] 按钮存在性');
  const btns = await evalJs(cdp, `(() => {
    const all = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
    return {
      copyDefault: all.includes('复制默认值'),
      copyCurrent: all.includes('复制当前'),
      all: all.filter(t => t.includes('复制')),
    };
  })()`);
  check('存在「复制默认值」按钮', btns.copyDefault, JSON.stringify(btns.all));
  check('存在「复制当前」按钮', btns.copyCurrent, JSON.stringify(btns.all));

  const pageDefault = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    return ta.value;
  })()`);
  console.log(`  页面默认提示词 ${pageDefault.length} 字符`);

  /* ---------------------------------------------- 2. 复制默认值 */
  console.log('\n[2] 点「复制默认值」→ 读回剪贴板');
  // 先把剪贴板污染成哨兵值，确保读回来的确实是本次写入
  await evalJs(cdp, `navigator.clipboard.writeText('__SENTINEL__')`);
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '复制默认值');
    b.click(); return true;
  })()`);
  await sleep(900);
  const clipDefault = await evalJs(cdp, `navigator.clipboard.readText()`);
  check('剪贴板内容 = 页面默认提示词（归一化换行后）',
    normalize(clipDefault) === normalize(pageDefault),
    `剪贴板 ${clipDefault?.length} 字符 vs 页面 ${pageDefault.length} 字符`);
  check('剪贴板确实被改写（不再是哨兵）', clipDefault !== '__SENTINEL__');
  check('差异只是 LF→CRLF（平台规范化，非缺陷）',
    clipDefault.length - pageDefault.length === (normalize(pageDefault).match(/\n/g) || []).length,
    `多出 ${clipDefault.length - pageDefault.length} 字符，换行数 ${(normalize(pageDefault).match(/\n/g) || []).length}`);
  check('默认提示词含三视图关键约束',
    clipDefault.includes('正面视图') && clipDefault.includes('背面视图'));
  check('默认提示词含授权句', clipDefault.includes('优先于参考图'));
  await shot(cdp, 'copy-01-default');

  /* ---------------------------------------------- 3. 改内容后「复制当前」 */
  console.log('\n[3] 改提示词后点「复制当前」');
  const MINE = '把服装换成白色高领毛衣、米色长款开襟外套、浅灰色直筒长裤、白色短靴，其余照参考图。';
  await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(MINE)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(600);

  await evalJs(cdp, `navigator.clipboard.writeText('__SENTINEL__')`);
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '复制当前');
    b.click(); return true;
  })()`);
  await sleep(900);
  const clipCurrent = await evalJs(cdp, `navigator.clipboard.readText()`);
  check('剪贴板 = 框里改后的文本', normalize(clipCurrent) === normalize(MINE),
    `剪贴板「${String(clipCurrent).slice(0, 60)}」`);
  check('不再等于默认提示词', normalize(clipCurrent) !== normalize(pageDefault));
  await shot(cdp, 'copy-02-current');

  /* ---------------------------------------------- 4. 清空后「复制当前」回落默认 */
  console.log('\n[4] 清空输入框后点「复制当前」（应回落默认值）');
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '清空');
    b.click(); return true;
  })()`);
  await sleep(700);
  const emptied = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    return ta.value;
  })()`);
  check('输入框已清空', emptied === '', `实际 ${emptied.length} 字符`);

  await evalJs(cdp, `navigator.clipboard.writeText('__SENTINEL__')`);
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '复制当前');
    b.click(); return true;
  })()`);
  await sleep(900);
  const clipEmpty = await evalJs(cdp, `navigator.clipboard.readText()`);
  check('空输入框时复制到的是默认提示词', normalize(clipEmpty) === normalize(pageDefault),
    `剪贴板 ${clipEmpty?.length} 字符`);

  /* ---------------------------------------------- 5. 复制到的默认值能直接提交 */
  console.log('\n[5] 复制出来的默认提示词与后端 meta 一致');
  const meta = await (await fetch(`${TARGET}/jiuzhang/api/breakdown/meta`)).json();
  check('剪贴板默认值 === 后端 meta.defaultPrompt（归一化后）',
    normalize(clipDefault) === normalize(meta.defaultPrompt),
    `剪贴板 ${clipDefault?.length} vs meta ${meta.defaultPrompt?.length}`);
  // 再走一次 preview，确认这段文本能原样被后端接受。
  // 注意：提交的是**归一化后**的 LF 版本（浏览器里的文本框本来就只有 LF）
  const tokenRes = await (await fetch(`${TARGET}/jiuzhang/api/token`)).json();
  const pv = await fetch(`${TARGET}/jiuzhang/api/breakdown/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jz-token': tokenRes.token },
    body: JSON.stringify({ prompt: normalize(clipDefault) }),
  });
  const pvJson = await pv.json();
  check('后端原样接收这段文本', pv.status === 200 && pvJson.prompt === normalize(clipDefault),
    `status=${pv.status}`);
  /*
   * ⚠️ 这里必须是 **isDefault: true**。
   *
   * 复制出来的是默认提示词本身，原样提交时后端按内容判定"这就是默认值"
   * —— 这正是 isDefault 的语义（比对文本，不比对来源）。
   * 之前写成 false 是断言写反了：它想表达"显式传了 prompt 就不是默认"，
   * 但 isDefault 问的是"这段文字是不是默认那段"，答案是"是"。
   */
  check('后端判定为默认值（复制的是默认原文，符合语义）', pvJson.isDefault === true,
    `实际 isDefault=${pvJson.isDefault}`);
  // 换个非默认文本，确认 isDefault 会翻成 false
  const pv2 = await fetch(`${TARGET}/jiuzhang/api/breakdown/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jz-token': tokenRes.token },
    body: JSON.stringify({ prompt: MINE }),
  });
  const pv2Json = await pv2.json();
  check('改写后的文本 isDefault=false', pv2Json.isDefault === false);

  console.log(`\n${'='.repeat(56)}`);
  console.log(failed === 0 ? '复制按钮验证全部通过' : `${failed} 项失败`);
  console.log('='.repeat(56));
  cdp.close();
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(`\n失败：${e?.stack || e?.message || e}`); process.exitCode = 1; });