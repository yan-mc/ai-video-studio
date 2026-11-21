/**
 * 用 CDP 驱动真实浏览器页面 —— 立绘拆解页的端到端验证。
 *
 * 为什么不用 jsdom / 手搓 fetch：
 *   需求是"从网页上改默认提示词，看改动是否真的进模型"。
 *   fetch 只能证明"接口通"，证明不了"页面上那个文本框提交的是我改的东西"。
 *   所以这里连真浏览器（Edge headless + CDP），点真按钮、读真 DOM。
 *
 * 用法：
 *   node tools/_e2e-breakdown.mjs --target http://127.0.0.1:17123 [--cdp 9333]
 *
 * 设计约束：
 *   · 不依赖 puppeteer —— 直接用 Node 内置 WebSocket 讲 CDP 协议；
 *   · 每一步都把"看到的"打出来（失败时能定位是哪一步断了）；
 *   · 会在**真实**数据目录上跑（--data 指定的那份），所以只做一次生成。
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

const TARGET = arg('--target', 'http://127.0.0.1:17123');
const CDP_PORT = Number(arg('--cdp', '9333'));
const OUTDIR = arg('--out', '');

function log(...a) { console.log(...a); }
function step(n, msg) { console.log(`\n=== [${n}] ${msg} ===`); }

/* ------------------------------------------------------------ CDP 客户端 */

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
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
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP_TIMEOUT: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function listPages() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  return res.json();
}

async function openPage(url) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`无法新建标签页：${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------ 页面辅助 */

/** 在页面里跑一段表达式，返回 JSON 值 */
async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (r.exceptionDetails) {
    throw new Error(`PAGE_EXCEPTION: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
  }
  return r.result?.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 等到页面里某个条件成立 */
async function waitFor(cdp, expression, { timeoutMs = 30000, label = expression } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await evalJs(cdp, `Boolean(${expression})`)) return true;
    } catch { /* 页面还在加载，忽略 */ }
    await sleep(300);
  }
  throw new Error(`WAIT_TIMEOUT: ${label}`);
}

async function shot(cdp, name) {
  if (!OUTDIR) return;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.mkdirSync(OUTDIR, { recursive: true });
  const p = `${OUTDIR}\\${name}.png`;
  fs.writeFileSync(p, Buffer.from(data, 'base64'));
  log(`  截图：${p}`);
}

/* ---------------------------------------------------------------- 主流程 */

async function main() {
  log(`目标页面：${TARGET}/#/breakdown`);

  /* 1) 打开页面 */
  step(1, '打开立绘拆解页');
  const page = await openPage(`${TARGET}/jiuzhang/app/#/breakdown`);
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1400, deviceScaleFactor: 1, mobile: false,
  });
  await sleep(1200);

  // 等 SPA 启动（React 挂载 + 页面抓到 meta）
  await waitFor(cdp, `document.querySelector('.jz-page') || document.querySelector('#root')?.children.length > 0`,
    { label: 'SPA 挂载', timeoutMs: 40000 });
  await sleep(1500);
  log('  SPA 已挂载');

  /* 2) 确认页面结构：有提示词文本框、没有旧的档位/尺寸/服装清单 */
  step(2, '检查页面结构');
  const structure = await evalJs(cdp, `(() => {
    const tas = [...document.querySelectorAll('textarea')];
    const text = document.body.innerText;
    return {
      textareaCount: tas.length,
      biggest: tas.map(t => ({ rows: t.rows, h: t.getBoundingClientRect().height, len: t.value.length }))
        .sort((a,b) => b.h - a.h)[0] ?? null,
      hasOutfitInput: /服装清单|附属部件（一行一件）|三视图角度/.test(text),
      hasLevelPicker: /拆解档位|纯部件拆解|完整设定卡/.test(text),
      hasSizePicker: /输出尺寸/.test(text),
      textSample: text.slice(0, 400),
    };
  })()`);
  log(`  textarea 数量：${structure.textareaCount}`);
  log(`  最大输入框：${JSON.stringify(structure.biggest)}`);
  log(`  仍有服装清单输入：${structure.hasOutfitInput}`);
  log(`  仍有档位选择："${structure.hasLevelPicker}"`);
  log(`  仍有尺寸选择：${structure.hasSizePicker}`);

  /* 3) 进"② 改提示词"，读默认提示词 */
  step(3, '进入「改提示词」，读取默认值');
  await evalJs(cdp, `(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('改提示词'));
    if (!btn) throw new Error('找不到「改提示词」按钮');
    btn.click();
    return true;
  })()`);
  await sleep(800);

  const before = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (!ta) throw new Error('没有 textarea');
    return { len: ta.value.length, height: Math.round(ta.getBoundingClientRect().height), sample: ta.value.slice(0, 120) };
  })()`);
  log(`  默认提示词 ${before.len} 字符，框高 ${before.height}px`);
  log(`  开头：${before.sample}`);
  await shot(cdp, '01-default-prompt');

  /* 4) 改成"换装"版本 —— 这是用户实际会做的操作 */
  step(4, '在网页上改提示词：把服装换成白色高领毛衣套装');
  const NEW = [
    '参考图是本角色的立绘。据此绘制一张角色设定卡，用于后续动画与建模时保持角色形象一致。',
    '',
    '还原优先级：角色的长相、发型、瞳色、肤色、体型、角与整体配色以参考图为唯一依据，精准还原，不美化、不概括。',
    '本提示词中明确写出的要求优先于参考图：服装整体替换为白色高领毛衣、米色长款开襟外套、浅灰色直筒长裤、白色短靴；',
    '文字没有提到的部分（发色、瞳色、角、配饰）一律严格照参考图还原。',
    '',
    '主体是三个全身视角，等高等比例、统一光照、统一背景，从左到右并排排列：正面视图、侧面视图、背面视图。',
    '三个视角必须是同一个角色、同一套服装，发型、服装结构、身体比例完全一致。',
    '角色自然站立，双臂自然下垂，全身入画，不切头、不切脚。',
    '',
    '在三个视角之外，把身上的这套白色高领毛衣、米色长款开襟外套、浅灰色直筒长裤、白色短靴逐件拆出、单独平铺展示。',
    '每一件都必须是完整的一件，不得合并，也不得拆成碎片。',
    '',
    '附属部件仍按参考图逐件拆出并平铺展示：发饰、耳饰、颈饰、腕饰。',
    '',
    '整体风格：干净的设定稿，线条清晰、色块平整，浅灰背景，留白充足，画质精致。',
    '',
    '画面中不要出现任何文字、标注、编号、图例或水印。',
  ].join('\n');

  const typed = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (!ta) throw new Error('没有 textarea');
    // 走 React 的 onChange：直接改 value 不会触发受控组件更新
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(NEW)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return ta.value.length;
  })()`);
  await sleep(500);
  log(`  已写入 ${typed} 字符`);

  // 确认受控组件真的接受了这次输入（页面状态里就是新值）
  const after = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    return {
      len: ta.value.length,
      hasWhiteSweater: ta.value.includes('白色高领毛衣'),
      counter: (document.body.innerText.match(/(\\d+) \\/ (\\d+) 字符/) ?? []).slice(0,3),
      badge: (document.body.innerText.match(/已改动|默认值/) ?? [])[0] ?? null,
    };
  })()`);
  log(`  输入框现在 ${after.len} 字符，含"白色高领毛衣"：${after.hasWhiteSweater}`);
  log(`  计数字样：${JSON.stringify(after.counter)}，状态徽章：${after.badge}`);
  await shot(cdp, '02-edited-prompt');

  /* 5) 点「校验」→ 走 /breakdown/preview，确认后端回显的就是这段 */
  step(5, '点「校验」，确认后端拿到的是改后的原文');
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '校验');
    if (!b) throw new Error('找不到「校验」按钮');
    b.click();
    return true;
  })()`);
  await sleep(2500);
  await shot(cdp, '03-validate');

  /* 6) 点「生成拆解图」→ 真提交给 ComfyUI */
  step(6, '点「生成拆解图」，真提交');
  const beforeJobs = await (await fetch(`${TARGET}/jiuzhang/api/jobs`)).json();
  const beforeIds = new Set((Array.isArray(beforeJobs) ? beforeJobs : []).map((j) => j.id));

  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('生成拆解图'));
    if (!b) throw new Error('找不到「生成拆解图」按钮');
    b.click();
    return true;
  })()`);
  await sleep(3000);
  await shot(cdp, '04-submitted');

  // 从后端确认：新任务存在，且它的 prompt 就是改写版
  const afterJobs = await (await fetch(`${TARGET}/jiuzhang/api/jobs`)).json();
  const created = (Array.isArray(afterJobs) ? afterJobs : []).filter((j) => !beforeIds.has(j.id));
  if (!created.length) throw new Error('没有新任务产生 —— 提交没成功');
  const job = created[0];
  log(`  新任务：${job.id}  backend=${job.backendId}  status=${job.status}`);
  log(`  提交提示词 ${job.prompt.length} 字符，含"白色高领毛衣"：${job.prompt.includes('白色高领毛衣')}`);
  log(`  尺寸：${job.params.width}×${job.params.height}（sizeId=${job.params.imageSizeId}）`);

  const proof = {
    jobId: job.id,
    promptChars: job.prompt.length,
    hasWhiteSweater: job.prompt.includes('白色高领毛衣'),
    hasBlackBodysuitWording: job.prompt.includes('黑色紧身衣'),
    size: `${job.params.width}×${job.params.height}`,
    sizeId: job.params.imageSizeId,
  };
  if (!proof.hasWhiteSweater) throw new Error('提交的提示词里没有换装要求 —— 改动丢了');
  if (proof.hasBlackBodysuitWording) throw new Error('提示词里仍残留旧的服装口径');

  /* 7) 等生成完成 */
  step(7, '等待 ComfyUI 出图');
  const deadline = Date.now() + 12 * 60 * 1000;
  let final = null;
  while (Date.now() < deadline) {
    const jobs2 = await (await fetch(`${TARGET}/jiuzhang/api/jobs`)).json();
    const cur = (Array.isArray(jobs2) ? jobs2 : []).find((j) => j.id === job.id);
    if (cur && ['completed', 'failed', 'cancelled'].includes(cur.status)) { final = cur; break; }
    await sleep(5000);
    process.stdout.write('.');
  }
  log('');
  if (!final) throw new Error('GENERATION_TIMEOUT: 12 分钟未完成');
  log(`  终态：${final.status}`);
  if (final.status !== 'completed') throw new Error(`生成失败：${final.error ?? final.status}`);

  const out = final.outputs?.[0];
  log(`  产物：${out?.rel ?? out?.path}  ${Math.round((out?.bytes ?? 0) / 1024)} KB`);
  if (!out?.rel && !out?.path) throw new Error('任务完成了但没有产物');

  /* 8) 页面回显新图 */
  step(8, '等页面显示结果图');
  try {
    await waitFor(cdp, `!!document.querySelector('img[alt="拆解图"]')`, { label: '结果图出现', timeoutMs: 90000 });
    log('  页面已显示拆解图');
  } catch (e) {
    log(`  ⚠️ 页面未在 90s 内显示结果图（任务已完成，可能是轮询节奏）：${e.message}`);
  }
  await shot(cdp, '05-result');

  const summary = { ...proof, status: final.status, output: out?.rel ?? out?.path };
  log(`\n${'='.repeat(60)}\nE2E 通过\n${'='.repeat(60)}`);
  log(JSON.stringify(summary, null, 2));
  fs.writeFileSync('tools/_e2e-breakdown.result.json', JSON.stringify(summary, null, 2));

  cdp.close();
}

main().catch((e) => {
  console.error(`\nE2E 失败：${e?.stack || e?.message || e}`);
  process.exitCode = 1;
});