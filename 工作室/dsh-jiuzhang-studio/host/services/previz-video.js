/**
 * 白模预演视频渲染 —— 把预演工程的动画渲染成**真正的视频文件**。
 *
 * ============================================================================
 * 为什么需要这个模块
 * ============================================================================
 *
 * 预演引擎（services/previz）本身只提供：
 *   · `/api/frame?timeSec=`  — 返回某一帧的**数据**（机位/元素/关节）
 *   · `web/render.html`      — three.js 渲染器，暴露 `window.__PREVIZ__.apply(frame)`
 *
 * 缺的是把两者串起来：**逐帧求值 → 喂给渲染器 → 截图 → 编码成 mp4**。
 * 没有这一步，预演就只能是"看看构图"，没法当作 H3 的参考视频输入。
 *
 * ============================================================================
 * 实现路径
 * ============================================================================
 *
 * 1. 起一个无头浏览器加载 `render.html`（这是离线渲染 harness，不是编辑器 UI）
 * 2. 通过 CDP 注入每帧的求值结果，调 `apply(frame)`
 * 3. 逐帧截图（只截 canvas 区域，不要 UI）
 * 4. ffmpeg 把帧序列编码成 mp4
 *
 * 为什么不用编辑器页面（`index.html`）：
 *   编辑器带完整 UI（时间轴/侧栏），截图会混进 UI 元素；
 *   而且它的播放控制是给人用的，没法精确 seek 到任意帧。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './previz-shot.js';
import { resolveFfmpeg } from './seedance-client.js';

/** 渲染默认参数 */
export const RENDER_DEFAULTS = Object.freeze({
  fps: 24,
  width: 1280,
  height: 720,
  /** 每帧等待渲染稳定的时间（ms）。太低会截到半渲染帧 */
  frameSettleMs: 120,
  /** 单帧截图超时 */
  captureTimeoutMs: 20000,
});

/* --------------------------------------------------------------- 进程通信 */

/**
 * 用 CDP（Chrome DevTools Protocol）驱动无头浏览器。
 *
 * 为什么不引 puppeteer：本工程原则是不加依赖。
 * CDP 是 WebSocket + JSON-RPC，Node 24 自带 WebSocket，够用。
 */
function launchHeadless(browserExe, userDataDir) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1600,1000',
    'about:blank',
  ];
  const child = spawn(browserExe, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  child.stderr?.on('data', (d) => { stderr += d.toString(); });
  return { child, getStderr: () => stderr };
}

/** 从 stderr 里解析出 DevTools 端点 */
async function waitForDevtools(getStderr, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() > deadline) throw new Error('BROWSER_DEVTOOLS_TIMEOUT');
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(getStderr());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** 极简 CDP 客户端 */
function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const handlers = new Map();

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', (e) => reject(new Error(`CDP_CONNECT_FAILED: ${e?.message || 'error'}`)));
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'CDP_ERROR'));
      else resolve(msg.result);
      return;
    }
    if (msg.method && handlers.has(msg.method)) {
      for (const h of handlers.get(msg.method)) h(msg.params);
    }
  });

  function send(method, params = {}, sessionId = undefined) {
    const id = nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP_TIMEOUT: ${method}`)); }
      }, 30000);
    });
  }

  return {
    ready,
    send,
    on(method, fn) {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(fn);
    },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}

/* ------------------------------------------------------------- 帧求值 */

/** 从预演引擎取某一时刻的场景状态 */
async function fetchFrame(previzBase, timeSec) {
  const url = `${previzBase.replace(/\/+$/, '')}/api/frame?timeSec=${encodeURIComponent(timeSec)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`PREVIZ_FRAME_${res.status}`);
  const j = await res.json();
  if (!j?.ok) throw new Error(`PREVIZ_FRAME_FAILED: ${j?.error ?? 'unknown'}`);
  return j.result;
}

/**
 * 切到指定镜头。
 *
 * ⚠️ 这一步不能省。预演引擎的 `/api/frame?timeSec=` 只对**当前激活的镜头**
 *    做时间插值，并不会按绝对时间跨镜头查找。
 *    也就是说：想让 t=5.0s 落在镜2，必须先把 activeShotId 切到镜2，
 *    否则拿到的一直是镜3 的数据（甚至位置都是错的）。
 *
 *    这个行为在引擎源码里没有文档，是实测出来的。
 */
async function selectShot(previzBase, shotId) {
  const url = `${previzBase.replace(/\/+$/, '')}/api/command`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'director_select', arguments: { shot_id: shotId } }),
    signal: AbortSignal.timeout(10000),
  });
  const j = await res.json().catch(() => null);
  if (!j?.ok) throw new Error(`PREVIZ_SELECT_FAILED: ${j?.error ?? 'unknown'}`);
  return j.result;
}

/** 取工程总时长 */
async function fetchProjectDuration(previzBase) {
  const res = await fetch(`${previzBase.replace(/\/+$/, '')}/api/project`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`PREVIZ_PROJECT_${res.status}`);
  const j = await res.json();
  const shots = j?.result?.project?.plans?.[0]?.shots ?? j?.project?.plans?.[0]?.shots ?? [];
  let end = 0;
  for (const s of shots) {
    const start = Number(s.startSec) || 0;
    const dur = Number(s.durationSec) || 0;
    end = Math.max(end, start + dur);
  }
  return { durationSec: end, shots };
}

/* ------------------------------------------------------------- 主流程 */

/**
 * 渲染白模预演视频。
 *
 * @param {object} opts
 * @param {string} opts.previzBase   预演引擎地址（默认 http://127.0.0.1:4318）
 * @param {string} opts.outDir       帧与视频的输出目录
 * @param {number} [opts.fps]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {number} [opts.maxSeconds] 只渲染前 N 秒（调试用）
 * @param {(p:{done:number,total:number,phase:string})=>void} [opts.onProgress]
 * @returns {Promise<{ok:boolean, videoPath:string, rel:string, frames:number, seconds:number, fps:number}>}
 */
export async function renderPrevizVideo(opts = {}) {
  const {
    previzBase = 'http://127.0.0.1:4318',
    outDir,
    fps = RENDER_DEFAULTS.fps,
    width = RENDER_DEFAULTS.width,
    height = RENDER_DEFAULTS.height,
    maxSeconds = 0,
    onProgress,
  } = opts;

  if (!outDir) throw new Error('OUT_DIR_REQUIRED');
  const browserExe = findBrowser();
  if (!browserExe) throw new Error('NO_BROWSER: 找不到可用的 Chromium 内核浏览器');

  // 1) 工程信息
  const info = await fetchProjectDuration(previzBase);
  let duration = Number(info.durationSec) || 0;
  if (maxSeconds > 0) duration = Math.min(duration, maxSeconds);
  if (duration <= 0) throw new Error('PREVIZ_EMPTY: 工程没有可用镜头');

  const totalFrames = Math.max(1, Math.round(duration * fps));
  onProgress?.({ done: 0, total: totalFrames, phase: '准备' });

  // 2) 准备目录
  const framesDir = path.join(outDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  // 清掉上一批帧，避免残帧混入
  for (const f of fs.readdirSync(framesDir)) {
    if (/^f_\d+\.png$/.test(f)) { try { fs.unlinkSync(path.join(framesDir, f)); } catch { /* ignore */ } }
  }

  const userDataDir = path.join(outDir, '.browser-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  const { child, getStderr } = launchHeadless(browserExe, userDataDir);
  let cdp = null;
  const frameFiles = [];

  try {
    // 3) 连 CDP
    const wsUrl = await waitForDevtools(getStderr);
    cdp = createCdp(wsUrl);
    await cdp.ready;

    // 找一个 page target
    const { targetInfos } = await cdp.send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error('NO_PAGE_TARGET');
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);

    // 4) 打开渲染 harness
    const renderUrl = `${previzBase.replace(/\/+$/, '')}/render.html`;
    await cdp.send('Page.navigate', { url: renderUrl }, sessionId);

    // 等 harness 就绪
    let ready = false;
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'Boolean(window.__PREVIZ__ && window.__PREVIZ__.ready)',
        returnByValue: true,
      }, sessionId);
      if (r?.result?.value === true) { ready = true; break; }
    }
    if (!ready) throw new Error('RENDER_HARNESS_NOT_READY');

    // 5) 设置画布尺寸
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    }, sessionId);

    // 6) 逐帧渲染
    //    每帧之前先把 activeShotId 切到该时刻所属的镜头（见 selectShot 注释）。
    let currentShotId = '';
    for (let i = 0; i < totalFrames; i += 1) {
      const t = i / fps;

      // 找到这一帧属于哪个镜头
      const shotAt = info.shots.find((s) => {
        const start = Number(s.startSec) || 0;
        const end = start + (Number(s.durationSec) || 0);
        return t >= start && t < end;
      }) ?? info.shots[info.shots.length - 1];

      if (shotAt && shotAt.id !== currentShotId) {
        await selectShot(previzBase, shotAt.id);
        currentShotId = shotAt.id;
      }

      const frame = await fetchFrame(previzBase, t);

      // 喂给渲染器
      await cdp.send('Runtime.evaluate', {
        expression: `window.__PREVIZ__.apply(${JSON.stringify(frame)})`,
        returnByValue: true,
      }, sessionId);

      // 等两帧渲染稳定
      await new Promise((r) => setTimeout(r, RENDER_DEFAULTS.frameSettleMs));

      // 截图
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
      const buf = Buffer.from(shot.data, 'base64');
      const file = path.join(framesDir, `f_${String(i).padStart(5, '0')}.png`);
      fs.writeFileSync(file, buf);
      frameFiles.push(file);

      if (i % 10 === 0) onProgress?.({ done: i + 1, total: totalFrames, phase: '渲染' });
    }
    onProgress?.({ done: totalFrames, total: totalFrames, phase: '编码' });

    // 7) ffmpeg 编码
    const videoPath = path.join(outDir, 'control.mp4');
    await encodeFrames(resolveFfmpeg({}), framesDir, fps, videoPath);

    const stat = fs.statSync(videoPath);
    onProgress?.({ done: totalFrames, total: totalFrames, phase: '完成' });

    return {
      ok: true,
      videoPath,
      frames: frameFiles.length,
      seconds: duration,
      fps,
      bytes: stat.size,
      shots: info.shots.length,
    };
  } finally {
    try { cdp?.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    // 清理浏览器 profile（体积大且无用）
    setTimeout(() => {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }, 1500);
  }
}

/** 帧序列 → mp4 */
function encodeFrames(ffmpegExe, framesDir, fps, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-framerate', String(fps),
      '-i', path.join(framesDir, 'f_%05d.png'),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-crf', '20',
      outPath,
    ];
    const child = spawn(ffmpegExe, args, { windowsHide: true });
    let err = '';
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => reject(new Error(`FFMPEG_SPAWN: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFMPEG_ENCODE_${code}: ${err.slice(-400)}`));
    });
  });
}
