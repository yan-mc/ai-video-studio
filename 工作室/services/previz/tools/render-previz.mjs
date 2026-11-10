/**
 * 预演渲染器：CDP 驱动 render.html，把预演引擎的求值结果渲染成真实像素。
 *
 * 产出（写入 outDir）：
 *   first.png / last.png  —— 首帧 / 尾帧（供 H3 首尾帧条件）
 *   frame_0000.png ...    —— 全帧序列（供控制视频）
 *   control.mp4           —— 控制视频（ffmpeg 合成，可选）
 *   render.json           —— 渲染元数据（尺寸/帧数/路径/耗时）
 *
 * 用法：
 *   node tools/render-previz.mjs --project <包.json> --out <目录> [--long 1600]
 *                               [--fps 24] [--video] [--edge <msedge.exe>] [--port 4318]
 * 若不传 --project，则从 --base 的 /api/previz-package 拉取。
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

/* ------------------------------ 参数 ------------------------------ */
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
function flag(name) { return process.argv.includes(`--${name}`); }

const OUT = path.resolve(arg('out', path.join(process.cwd(), 'render-out')));
const LONG = Number(arg('long', 1600));
const FPS = Number(arg('fps', 24));
const EDGE = arg('edge', process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
const BASE = arg('base', 'http://127.0.0.1:4318');
const PROJECT = arg('project', '');
const SHOT_ID = arg('shot', '');
const SAMPLES = Number(arg('samples', 0));
const WANT_VIDEO = flag('video');
const FFMPEG = arg('ffmpeg', process.env.FFMPEG_PATH || '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ 取包 ------------------------------ */
async function loadPackage() {
  if (PROJECT) return JSON.parse(fs.readFileSync(path.resolve(PROJECT), 'utf8'));
  const body = JSON.stringify({ shotId: SHOT_ID || undefined, samples: SAMPLES || undefined });
  const r = await fetch(`${BASE.replace(/\/$/, '')}/api/previz-package`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`previz-package 失败：${j.error || r.status}`);
  return j.result;
}

/* ------------------------------ CDP ------------------------------ */
function httpJson(port, p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: p }, (r) => {
      let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); 
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id; this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`页面求值异常：${r.exceptionDetails.text || ''} ${r.exceptionDetails.exception?.description || ''}`);
    return r.result?.value;
  }
}

async function withBrowser(fn) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'previz-render-'));
  const child = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,720', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-component-update',
    '--disable-features=msEdgeIdentityFeature,msEdgeSync', '--password-store=basic',
    '--disable-background-networking', '--disable-default-apps', '--noerrdialogs',
    '--disable-infobars', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let ws;
  try {
    let page = null;
    for (let i = 0; i < 60 && !page; i++) {
      try { const list = await httpJson(port, '/json/list'); page = list.find((t) => t.type === 'page'); } catch { /* retry */ }
      if (!page) await sleep(500);
    }
    if (!page) throw new Error('无法连接 Edge CDP');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP WebSocket 连接失败')); });
    const cdp = new Cdp(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    return await fn(cdp);
  } finally {
    try { ws?.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/* ------------------------------ 主流程 ------------------------------ */
function writePng(dataUrl, file) {
  const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(file, buf);
  return buf.length;
}
function runFfmpeg(args) {
  return new Promise((res) => {
    const p = spawn(FFMPEG, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); });
    p.on('error', (e) => res({ code: -1, err: String(e.message || e) }));
    p.on('close', (code) => res({ code, err }));
  });
}

const t0 = Date.now();
const pkg = await loadPackage();
const frames = Array.isArray(pkg.frames) ? pkg.frames : [];
if (!frames.length) throw new Error('预演包没有帧数据');

const aspect = pkg.shot?.aspect || '16:9';
fs.mkdirSync(OUT, { recursive: true });

const result = await withBrowser(async (cdp) => {
  const harness = `${BASE.replace(/\/$/, '')}/render.html`;
  await cdp.send('Page.navigate', { url: harness });
  // 等待渲染器就绪
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try { ready = await cdp.eval('!!(window.__PREVIZ__ && window.__PREVIZ__.ready)'); } catch { /* not yet */ }
    if (ready) break;
  }
  if (!ready) throw new Error('渲染器未就绪（render.html 未加载或 three.js 失败）');

  const written = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const ok = await cdp.eval(`window.__PREVIZ__.apply(${JSON.stringify(f)})`);
    if (!ok) throw new Error(`第 ${i} 帧载入失败`);
    await sleep(120); // 让 GPU 提交完成
    const dataUrl = await cdp.eval(`window.__PREVIZ__.capture(${JSON.stringify(aspect)}, ${LONG})`);
    const file = path.join(OUT, `frame_${String(i).padStart(4, '0')}.png`);
    const bytes = writePng(dataUrl, file);
    written.push({ index: i, timeSec: f.timeSec, file: path.basename(file), bytes });
  }
  const info = await cdp.eval('JSON.stringify(window.__PREVIZ__.info())');
  return { written, info: JSON.parse(info) };
});

// 首/尾帧别名
const first = result.written[0], last = result.written[result.written.length - 1];
fs.copyFileSync(path.join(OUT, first.file), path.join(OUT, 'first.png'));
fs.copyFileSync(path.join(OUT, last.file), path.join(OUT, 'last.png'));

// 控制视频（可选）
// BUG-3：旧实现固定用 `-framerate FPS`，而帧数由 samples 决定 → 12 帧 @24fps = 0.5s，
// 而镜头 3.75s，控制视频时长严重不足（H3 与时间轴对不上）。
// 修复：按 **帧数 / 镜头时长** 反算实际帧率，使 duration ≈ shot.durationSec。
//   - 帧数充足（≥ duration × FPS）时，等价于原来的 -framerate FPS，播放速度不变；
//   - 帧数被 samples 上限约束时，自动降帧率而不是缩短时长（慢放，但时间轴严格对齐）。
//   - 为什么不用「把帧数拉满到 duration×fps」：每帧约 300ms，3.75s@24fps=90 帧会让渲染慢 7.5 倍；
//     samples 上限 48 也不足以覆盖 24fps。故选择动态帧率这条更稳的路径。
let controlVideo = null;
const frameCount = result.written.length;
const shotDur = Number(pkg.shot?.durationSec) || 0;
const videoFps = shotDur > 0 ? frameCount / shotDur : FPS;
const videoFpsArg = Number(videoFps.toFixed(6)).toString();
if (WANT_VIDEO && FFMPEG) {
  const r = await runFfmpeg([
    '-y', '-framerate', videoFpsArg, '-i', path.join(OUT, 'frame_%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', path.join(OUT, 'control.mp4'),
  ]);
  if (r.code === 0) controlVideo = 'control.mp4';
}

const meta = {
  schema: 'previz.render.v1',
  shot: pkg.shot || null,
  sampling: pkg.sampling || null,
  aspect,
  longSide: LONG,
  fps: FPS,
  controlVideoFps: videoFps,
  frameCount: result.written.length,
  firstFrame: 'first.png',
  lastFrame: 'last.png',
  frames: result.written,
  controlVideo,
  renderer: result.info,
  engine: pkg.engine || pkg.schema || null,
  elapsedMs: Date.now() - t0,
};
fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify(meta, null, 2), 'utf8');
console.log(JSON.stringify({
  ok: true, out: OUT, frames: meta.frameCount, first: 'first.png', last: 'last.png',
  controlVideo, controlVideoFps: meta.controlVideoFps, shotDurationSec: shotDur, renderer: meta.renderer, elapsedMs: meta.elapsedMs,
}, null, 2));
