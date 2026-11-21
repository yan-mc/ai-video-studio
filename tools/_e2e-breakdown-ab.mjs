/**
 * 立绘拆解 A/B 端到端验证 —— 证明"默认精准还原"与"改了就真的改"同时成立。
 *
 * 做法（全程在真浏览器里点真按钮，走真 ComfyUI）：
 *   A) 选同一张立绘 → **不动**提示词 → 生成
 *   B) 同一张立绘 → 把服装改成白色高领毛衣套装 → 生成
 *   C) 比对两张图：A 应当保留参考图的黑衣，B 应当换掉
 *
 * 为什么必须 A/B：
 *   只跑 B 的话，"出图变了"也可能只是随机种子不同。
 *   只有同一张立绘、同一尺寸，一个不动一个动，才能把变量锁死。
 *
 * 用法：
 *   node tools/_e2e-breakdown-ab.mjs --target http://127.0.0.1:17123 --cdp 9333 \
 *        --ref assets/asset_sakiko_front_ref.png --out %TEMP%\jz-ab
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

const TARGET = arg('--target', 'http://127.0.0.1:17123');
const CDP_PORT = Number(arg('--cdp', '9333'));
const REF = arg('--ref', '');
const OUTDIR = arg('--out', '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** 选一张指定参考图（在「① 选立绘」里点它） */
async function pickReference(cdp, rel) {
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('选立绘'));
    if (b) b.click();
    return true;
  })()`);
  await sleep(600);
  const ok = await evalJs(cdp, `(() => {
    const target = ${JSON.stringify(rel)};
    const cards = [...document.querySelectorAll('button.jz-card')];
    // 卡片上有一行是 rel 路径（"已选：xxx" 在下面，卡片本身显示 name）
    // 这里按缩略图 img 的 alt / 兄弟文本没法拿到 rel，改为调用一次 API 反查 id
    return { cards: cards.length };
  })()`);
  // 用 API 把 rel → name 查出来，再按名字点（卡片上显示的是 name）
  const assets = await (await fetch(`${TARGET}/jiuzhang/api/assets`)).json();
  const hit = (Array.isArray(assets) ? assets : []).find((a) => a.rel === rel);
  if (!hit) throw new Error(`素材库里找不到 ${rel}`);
  await evalJs(cdp, `(() => {
    const name = ${JSON.stringify(hit.name)};
    const cards = [...document.querySelectorAll('button.jz-card')];
    const card = cards.find(c => c.textContent.includes(name));
    if (!card) throw new Error('找不到立绘卡片：' + name);
    card.click();
    return true;
  })()`);
  await sleep(600);
  const picked = await evalJs(cdp, `(() => {
    const m = document.body.innerText.match(/已选：(\\S+)/);
    return m ? m[1] : null;
  })()`);
  if (picked !== rel) throw new Error(`参考图没选上：期望 ${rel}，实际 ${picked}`);
  console.log(`  参考图已选中：${picked}`);
  void ok;
}

/** 设置提示词文本框 */
async function setPrompt(cdp, text) {
  await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (!ta) throw new Error('没有 textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(text)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
}

/** 点生成并等任务跑到终态；返回 {id,status,output,prompt} */
async function generateAndWait(cdp) {
  const before = await (await fetch(`${TARGET}/jiuzhang/api/jobs`)).json();
  const beforeIds = new Set((Array.isArray(before) ? before : []).map((j) => j.id));
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('生成拆解图'));
    if (!b) throw new Error('找不到「生成拆解图」按钮');
    b.click();
    return true;
  })()`);
  await sleep(2500);

  const after = await (await fetch(`${TARGET}/jiuzhang/api/jobs`)).json();
  const created = (Array.isArray(after) ? after : []).filter((j) => !beforeIds.has(j.id));
  if (!created.length) throw new Error('没有新任务产生');
  const job = created[0];
  console.log(`  任务 ${job.id}（${Math.round(job.prompt.length)} 字符）`);

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const jobs = await (await fetch(`${TARGET}/jiuzhang/api/jobs`)).json();
    const cur = (Array.isArray(jobs) ? jobs : []).find((j) => j.id === job.id);
    if (cur && ['completed', 'failed', 'cancelled'].includes(cur.status)) {
      if (cur.status !== 'completed') throw new Error(`生成失败：${cur.error ?? cur.status}`);
      return { id: job.id, status: cur.status, output: cur.outputs?.[0]?.rel ?? cur.outputs?.[0]?.path, prompt: job.prompt };
    }
    await sleep(5000);
    process.stdout.write('.');
  }
  throw new Error('GENERATION_TIMEOUT');
}

/* ------------------------------------------------------------------ 主流程 */

const WHITE = [
  '参考图是本角色的立绘。据此绘制一张角色设定卡，用于后续动画与建模时保持角色形象一致。',
  '',
  '还原优先级：角色的长相、发型、瞳色、肤色、体型、角与整体配色以参考图为唯一依据，精准还原，不美化、不概括。',
  '本提示词中明确写出的要求优先于参考图：服装整体替换为白色高领毛衣、米色长款开襟外套、浅灰色直筒长裤、白色短靴。',
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

async function main() {
  console.log(`目标：${TARGET}  参考图：${REF}`);
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`${TARGET}/jiuzhang/app/#/breakdown`)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`无法新建标签页：${res.status}`);
  const page = await res.json();
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1400, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  await waitFor(cdp, `document.querySelector('#root')?.children.length > 0`, { label: 'SPA 挂载' });
  await sleep(1800);

  // 清掉可能残留的草稿，确保 A 组拿到的是"后端默认值"
  await evalJs(cdp, `(() => { try { localStorage.removeItem('jz.breakdown.promptDraft.v1'); } catch {} return true; })()`);
  await evalJs(cdp, `location.reload()`);
  await sleep(3000);
  await waitFor(cdp, `document.querySelector('#root')?.children.length > 0`, { label: 'SPA 重载' });
  await sleep(1800);

  console.log('\n--- A 组：默认提示词（不动）---');
  await pickReference(cdp, REF);
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('改提示词'));
    if (b) b.click();
    return true;
  })()`);
  await sleep(800);
  const defaultPrompt = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    return ta.value;
  })()`);
  console.log(`  默认提示词 ${defaultPrompt.length} 字符`);
  await shot(cdp, 'A0-default-prompt');
  const a = await generateAndWait(cdp);
  console.log(`  A 完成：${a.output}`);
  await shot(cdp, 'A1-result');

  console.log('\n--- B 组：把服装改成白色高领毛衣套装 ---');
  await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('改提示词再出一张') || x.textContent.includes('改提示词'));
    if (b) b.click();
    return true;
  })()`);
  await sleep(800);
  await setPrompt(cdp, WHITE);
  const bChars = await evalJs(cdp, `(() => {
    const ta = [...document.querySelectorAll('textarea')].sort((a,b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    return { len: ta.value.length, has: ta.value.includes('白色高领毛衣') };
  })()`);
  console.log(`  输入框 ${bChars.len} 字符，含换装要求：${bChars.has}`);
  if (!bChars.has) throw new Error('提示词没写进去');
  await shot(cdp, 'B0-edited-prompt');
  const b = await generateAndWait(cdp);
  console.log(`  B 完成：${b.output}`);
  await shot(cdp, 'B1-result');

  /* ------------------------------------------------ 比对 */
  console.log('\n--- 比对 ---');
  if (a.prompt !== defaultPrompt) throw new Error('A 组提交的提示词与页面默认值不一致');
  if (b.prompt !== WHITE.trim()) throw new Error('B 组提交的提示词与输入框内容不一致');
  if (a.prompt.includes('白色高领毛衣')) throw new Error('A 组默认提示词里不该有换装要求');
  if (!b.prompt.includes('白色高领毛衣')) throw new Error('B 组提示词丢了换装要求');
  if (a.output === b.output) throw new Error('两次产物路径相同，异常');

  const summary = {
    reference: REF,
    a: { jobId: a.id, output: a.output, promptChars: a.prompt.length },
    b: { jobId: b.id, output: b.output, promptChars: b.prompt.length },
    assertions: {
      defaultPromptUntouched: a.prompt === defaultPrompt,
      editedPromptSubmittedVerbatim: b.prompt === WHITE.trim(),
      defaultHasNoOutfitChange: !a.prompt.includes('白色高领毛衣'),
      editedHasOutfitChange: b.prompt.includes('白色高领毛衣'),
      differentOutputs: a.output !== b.output,
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync('tools/_e2e-breakdown-ab.result.json', JSON.stringify(summary, null, 2));
  console.log('\nA/B 提交链路验证通过 —— 两图差异需人眼确认'); 
  cdp.close();
}

main().catch((e) => { console.error(`\nA/B 失败：${e?.stack || e?.message || e}`); process.exitCode = 1; });