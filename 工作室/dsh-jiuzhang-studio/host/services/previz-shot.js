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

/**
 * 常见 Edge / Chrome 安装位置（按平台，程序化构造，不写死盘符）。
 *
 * 这些是**系统安装目录的候选**，不是业务配置 —— 用环境变量派生，
 * 换盘符/换机器都能找到。用户也可用 DSH_BROWSER / CHROME_PATH 显式指定。
 */
function browserCandidates() {
  if (process.platform === 'win32') {
    const roots = [
      process.env['ProgramFiles(x86)'],
      process.env.ProgramFiles,
      process.env.ProgramW6432,
    ].filter(Boolean);
    const out = [];
    for (const r of roots) {
      out.push(path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      out.push(path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    return out;
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
}

/**
 * 找无头浏览器。
 *
 * 优先级：显式环境变量 > 平台常见安装位置 > PATH 查找。
 * 早期实现只硬编码了 Windows 四个绝对路径 —— 换平台或非默认安装就必然失败，
 * 且失败信息只是"找不到浏览器"，用户不知道该怎么修。
 */
export function findBrowser() {
  for (const key of ['DSH_BROWSER', 'CHROME_PATH', 'REA_BROWSER_EXECUTABLE', 'PUPPETEER_EXECUTABLE_PATH']) {
    const v = process.env[key];
    if (v) { try { if (fs.existsSync(v)) return v; } catch { /* ignore */ } }
  }

  for (const p of browserCandidates()) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }

  // PATH 查找
  const names = process.platform === 'win32'
    ? ['msedge.exe', 'chrome.exe']
    : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const n of names) {
      for (const ext of exts) {
        const p = path.join(dir, n + ext);
        try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
      }
    }
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

export { browserCandidates as KNOWN_BROWSERS };