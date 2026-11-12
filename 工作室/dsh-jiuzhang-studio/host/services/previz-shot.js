/**
 * 预演截图 → 出图 —— 把 3D 导演台的白模预演当作控制信号。
 *
 * 洛书的核心洞见：预演不该只被当作「一张参考图」，而应该是**控制信号**。
 * 但在 H3 的图生图路径上，最实用的做法是：
 *   1) 从预演引擎截图（headless 浏览器）
 *   2) 裁出 3D 视口
 *   3) 用 H3-Image 的参考图编辑，把白模渲染成成片风格
 *
 * 这样白模提供**构图/站位/机位**，H3-Image 提供**材质/光影/风格**，
 * 比纯文生图更容易控制画面结构。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/** 常见 Edge / Chrome 位置 */
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

export function findBrowser() {
  for (const p of BROWSERS) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

/** 执行一个进程并等它结束 */
function runProc(exe, args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error('PROC_TIMEOUT'));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      // headless 浏览器常有非 0 退出，但只要截图产出就算成功
      resolve({ code, out, err });
    });
  });
}

/**
 * headless 截图预演引擎 UI。
 * @returns {Promise<{ok:boolean, path:string, bytes:number}>}
 */
export async function screenshotPreviz({ cfg, url = 'http://127.0.0.1:4318/', width = 1600, height = 1000, waitMs = 8000 }) {
  const exe = findBrowser();
  if (!exe) throw new Error('BROWSER_NOT_FOUND: 找不到 Edge/Chrome');

  const outDir = path.join(cfg.dataDir, 'previz-shots');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `previz_${Date.now().toString(36)}.png`);

  await runProc(exe, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--disable-extensions',
    `--screenshot=${out}`,
    `--window-size=${width},${height}`,
    `--virtual-time-budget=${waitMs}`,
    url,
  ], 90000);

  if (!fs.existsSync(out)) throw new Error('SCREENSHOT_FAILED');
  const st = fs.statSync(out);
  if (st.size < 5000) throw new Error('SCREENSHOT_EMPTY: 截图过小，页面可能未加载');

  return {
    ok: true,
    path: out,
    rel: path.relative(cfg.dataDir, out).replace(/\\/g, '/'),
    bytes: st.size,
    browser: exe,
  };
}

/**
 * 从整屏截图裁出 3D 视口。
 *
 * 引擎 UI 布局（1600×1000 实测）：
 *   左栏 0..236（分镜列表）
 *   中栏 237..1258（3D 视口）
 *   右栏 1259..1600（属性面板）
 *   顶栏 0..52
 *   底部 时间轴从 ~720 开始
 *
 * 按比例裁剪，适配不同窗口尺寸。
 */
export function cropViewport(src, dst, opts = {}) {
  const W = opts.width ?? 1600;
  const H = opts.height ?? 1000;
  const left = Math.round(W * 0.148);      // 237/1600
  const top = Math.round(H * 0.053);       // 53/1000
  const right = Math.round(W * 0.786);     // 1258/1600
  const bottom = Math.round(H * 0.72);     // 720/1000
  const cw = right - left;
  const ch = bottom - top;
  return { filter: `crop=${cw}:${ch}:${left}:${top}`, box: { left, top, right, bottom, w: cw, h: ch } };
}

/**
 * 用 ffmpeg 执行裁剪。
 */
export async function cropWithFfmpeg(ffmpegExe, src, dst, opts = {}) {
  const { filter } = cropViewport(src, dst, opts);
  await runProc(ffmpegExe, ['-y', '-v', 'error', '-i', src, '-vf', filter, dst], 60000);
  if (!fs.existsSync(dst)) throw new Error('CROP_FAILED');
  return { ok: true, path: dst, bytes: fs.statSync(dst).size };
}

/**
 * 预演白模 → 成片风格的提示词。
 * 关键：告诉模型「这是白模预演，请保留构图/站位，渲染成真实画面」。
 */
export function buildPrevizStylePrompt(basePrompt, opts = {}) {
  const style = String(opts.style ?? '电影感写实风格，柔和自然光，高细节');
  const parts = [];
  parts.push('参考图是一张 3D 白模预演截图。');
  parts.push('请严格保留参考图中的**人物站位、空间布局、机位视角和透视关系**，');
  parts.push('但把灰色的白模人偶替换为真实角色，并把整个场景渲染成成片级别的画面。');
  if (basePrompt) parts.push(`画面内容：${basePrompt}`);
  parts.push(`画面风格：${style}`);
  parts.push('不要保留网格地面、人偶方块标签、UI 元素。');
  parts.push('高质量，细节丰富，光影自然。');
  return parts.join('');
}

export { BROWSERS as KNOWN_BROWSERS };