/**
 * ComfyUI 进程管理 —— 启动 / 停止 / 重启。
 *
 * ============================================================================
 * 为什么要重启
 * ============================================================================
 *
 * 续写链的 latent 存在 ComfyUI 的 output/nanfeng_v15_context/<hash>/ 下，
 * 每个批次一个独立 hash，**folder 本身不会跨任务串味**（这点已经核对过：
 * 换人任务的 createBatch 每次都生成新 UUID，hash 因此必不同）。
 *
 * 真正会残留的是**队列**：本地「取消」只对正在跑的那一单发 `/interrupt`，
 * 已经排进 ComfyUI 队列、还没开始的任务不会被清掉。于是用户点了取消、
 * 界面上显示停了，但 ComfyUI 侧后面还挂着上一单的段 —— 下一单提交后，
 * 那些段仍会依次执行，看起来就是"前面的续写还在"。
 *
 * 另外每段都要冷加载 11GB 模型（日志：`loaded_models 2→0`），进程跑久了
 * 还有显存碎片。重启进程能一次性清掉队列、显存碎片和所有节点缓存。
 *
 * ============================================================================
 * 实现约束
 * ============================================================================
 *
 *  · 只认 ai-runtime 目录下的 start-h3.ps1 —— **不自己拼命令行**。
 *    端口选择（避开 Hyper-V 保留段）、`--lowvram --disable-pinned-memory
 *    --use-ck-attention` 这些参数、端口文件落盘，全在脚本里，重复一份必然走样。
 *
 *  · 停止用 `/interrupt` + 进程终止的组合：
 *    先请 ComfyUI 中断当前任务（尽力而为），再杀进程。
 *    只杀进程会让正在写盘的 mp4/safetensors 留下半截文件。
 *
 *  · 状态以"端口是否在监听"为准，不用进程名猜
 *    （可能有多个 python，也可能用户在别的终端起了一个）。
 *
 * @module comfy-control
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { discoverComfyUrl, resetComfyProbe } from './comfy-client.js';

/** 停止后等待端口释放的上限 */
const STOP_TIMEOUT_MS = 30000;
/** 启动后等待端口就绪的上限（首次加载模型可能很慢） */
const START_TIMEOUT_MS = 180000;

/**
 * 找 PowerShell 可执行文件。
 *
 * ⚠️ **不能用 `powershell.exe`（Windows PowerShell 5.1）**。
 *    `start-h3.ps1` 是 UTF-8 无 BOM 的中文脚本，5.1 会按系统 ANSI
 *    代码页（简体中文机器上是 GBK）去读，于是脚本里的中文全部变成乱码，
 *    连引号都被吞掉 —— 报错是
 *      `Unexpected token '鉁?ComfyUI' in expression or statement`
 *      `The string is missing the terminator: ".`
 *    看起来像脚本语法坏了，实际是编码问题。实测踩到过。
 *
 *     PowerShell 7（`pwsh`）默认按 UTF-8 读脚本，所以必须用它。
 *     找不到 pwsh 时明确报错，不要退回 5.1 制造一个看不懂的语法错误。
 */
export function findPwsh() {
  const candidates = [];
  if (process.env.DSH_PWSH) candidates.push(process.env.DSH_PWSH);

  // ① 用 where.exe 从 PATH 解析出**真实**路径。
  //    Windows Store 版的 `WindowsApps\pwsh.exe` 是重解析点，
  //    stat 它本身 EACCES；但 where 同时会给出
  //    `WindowsApps\Microsoft.PowerShell_<ver>\pwsh.exe`，那个能 stat 到。
  //    另外 `Program Files\WindowsApps` 整个目录 EPERM，扫不了，只能靠 where。
  try {
    const out = execFileSync('where.exe', ['pwsh'], { encoding: 'utf8', timeout: 5000 });
    for (const line of out.split(/\r?\n/)) {
      const p = line.trim();
      if (p) candidates.push(p);
    }
  } catch { /* PATH 里没有就往下走 */ }

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'pwsh.exe'));
  }
  // ② MSI / winget 常规安装位置
  candidates.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'));
  candidates.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7-preview', 'pwsh.exe'));

  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch { /* EACCES / 不存在都继续试下一个 */ }
  }
  // ③ 最后交给 PATH。找不到时 spawn 会 ENOENT，由调用方报明确错误。
  return 'pwsh';
}

/**
 * 找 ai-runtime 目录（里面有 start-h3.ps1 与 .comfy-port）。
 *
 * 与 comfy-client 的 portFileCandidates 同一套推断规则：从插件根逐层向上，
 * 每层试 `<dir>/ai-runtime`。这样插件被 link 到任意位置都能命中。
 */
export function findRuntimeDir() {
  const push = [];
  const seen = new Set();
  const add = (p) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    push.push(p);
  };
  for (const key of ['DSH_COMFY_HOME', 'H3_HOME']) {
    const v = process.env[key];
    if (v) add(v);
  }
  let dir = import.meta.dirname;   // <plugin>/host/services
  for (let i = 0; i < 8; i += 1) {
    add(path.join(dir, 'ai-runtime'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const p of push) {
    try {
      if (fs.existsSync(path.join(p, 'start-h3.ps1'))) return p;
    } catch { /* ignore */ }
  }
  return '';
}

/** 读 .comfy-port（可能为空） */
export function readPort() {
  const dir = findRuntimeDir();
  if (!dir) return 0;
  try {
    const raw = fs.readFileSync(path.join(dir, '.comfy-port'), 'utf8').trim();
    const p = Number(raw);
    return Number.isFinite(p) && p > 0 && p < 65536 ? p : 0;
  } catch {
    return 0;
  }
}

/** 端口是否真的在监听（一次 TCP 探测，不看进程名） */
async function portListening(port) {
  if (!port) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/system_stats`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 当前状态。
 *
 * @returns {Promise<{running:boolean, port:number, url:string,
 *                    runtimeDir:string, canControl:boolean, detail:string}>}
 */
export async function comfyStatus() {
  const runtimeDir = findRuntimeDir();
  const port = readPort();
  const alive = await portListening(port);
  const url = alive ? `http://127.0.0.1:${port}` : (discoverComfyUrl() || '');

  let detail;
  if (!runtimeDir) {
    detail = '找不到 ai-runtime 目录（缺 start-h3.ps1），无法从界面启停';
  } else if (alive) {
    detail = `运行中 · 端口 ${port}`;
  } else {
    detail = '未运行';
  }

  return {
    running: alive,
    port: alive ? port : 0,
    url,
    runtimeDir,
    canControl: Boolean(runtimeDir),
    detail,
  };
}

/** 在 Windows 上找占用端口的进程 pid（拿不到就返回 0） */
function pidOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !port) { resolve(0); return; }
    // 用 pwsh：这条命令本身不含中文，但统一走同一个 shell 少一个变量
    const ps = spawn(findPwsh(), [
      '-NoProfile', '-NonInteractive', '-Command',
      `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`,
    ], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', (c) => { out += String(c); });
    ps.on('error', () => resolve(0));
    ps.on('close', () => {
      const pid = Number(String(out).trim());
      resolve(Number.isFinite(pid) && pid > 0 ? pid : 0);
    });
  });
}

/**
 * 找出 ComfyUI **实际可达**的端口。
 *
 * ⚠️ 不能只用 `.comfy-port`：端口文件可能缺失/写坏/目录被搬走（readPort 返回 0），
 *    而 ComfyUI 完全可能仍在运行（用户的 DSH_COMFY_URL、或脚本挑了个别的端口）。
 *    只认端口文件会让「停止」误报 "本来就没在运行"，把 10–14GB 显存留在卡上。
 *
 * 顺序：端口文件 → 探测得到的可达地址 → 0
 */
async function resolveLivePort() {
  const declared = readPort();
  if (declared && (await portListening(declared))) return declared;

  const url = discoverComfyUrl();
  if (url) {
    try {
      const p = Number(new URL(url).port);
      if (p && (await portListening(p))) return p;
    } catch { /* 非法 URL，忽略 */ }
  }
  return 0;
}

/**
 * 停止 ComfyUI。
 *
 * 顺序很重要：先 `/interrupt` 让当前采样收尾，再终止进程。
 * 直接杀进程可能让正在写的 mp4 / safetensors 变成半截文件。
 */
export async function stopComfy() {
  const port = await resolveLivePort();
  if (!port) {
    resetComfyProbe();
    return { ok: true, alreadyStopped: true, detail: '本来就没在运行' };
  }

  // ① 尽力让当前任务中断（失败不影响后续终止）
  try {
    await fetch(`http://127.0.0.1:${port}/interrupt`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore */ }

  // ② 清空排队项（/interrupt 只管正在跑的那一单）
  try {
    await fetch(`http://127.0.0.1:${port}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore */ }

  // ③ 终止进程
  const pid = await pidOnPort(port);
  if (!pid) {
    return { ok: false, detail: `端口 ${port} 在监听，但查不到占用进程（可能需要管理员权限）` };
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch (e) {
    return { ok: false, detail: `终止进程 ${pid} 失败：${e.message}` };
  }

  // ④ 等端口释放
  const until = Date.now() + STOP_TIMEOUT_MS;
  while (Date.now() < until) {
    if (!(await portListening(port))) break;
    await new Promise((r) => setTimeout(r, 800));
  }

  // ⑤ 超时则强杀
  if (await portListening(port)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
  }

  resetComfyProbe();
  const stopped = !(await portListening(port));
  return stopped
    ? { ok: true, pid, port, detail: `已停止（pid ${pid}）` }
    : { ok: false, detail: `pid ${pid} 仍在监听端口 ${port}，未能停止` };
}

/**
 * 启动 ComfyUI。
 *
 * 交给 `ai-runtime/start-h3.ps1` —— 端口避让、`--lowvram`、
 * 端口文件落盘都在脚本里，这里只负责调用与等待。
 */
export async function startComfy() {
  const runtimeDir = findRuntimeDir();
  if (!runtimeDir) {
    return { ok: false, detail: '找不到 ai-runtime 目录（缺 start-h3.ps1）' };
  }
  const script = path.join(runtimeDir, 'start-h3.ps1');
  if (fs.existsSync(path.join(runtimeDir, '.comfy-port'))) {
    const p = readPort();
    if (await portListening(p)) {
      return { ok: true, alreadyRunning: true, port: p, detail: `已在运行（端口 ${p}）` };
    }
  }

  // 脱离父进程：ComfyUI 要比本次请求活得久。
  //
  // ⚠️ Windows 上 `detached: true` + `stdio:'ignore'` 会让 powershell 进程
  //    立刻以 code 0 退出（实测：spawn 后 4.6 秒报 "脚本已退出"，
  //    而同一脚本在交互终端里跑得好好的）。改成不 detached，
  //    只 unref() 释放事件循环引用 —— ComfyUI 是由脚本内部用
  //    Start-Process 起的独立 python 进程，本进程退出不影响它。
  const shell = findPwsh();
  const child = spawn(shell, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
  ], {
    cwd: runtimeDir,
    stdio: 'ignore',
    windowsHide: true,
  });

  // 子进程秒退 = 脚本自己判断"已在运行"而直接 return，或者 pwsh 根本不存在。
  // 不检测的话会一路干等到 180 秒超时，用户完全不知道发生了什么。
  let spawnError = '';
  let exitedCode = null;
  child.on('error', (e) => {
    spawnError = e.code === 'ENOENT'
      ? `找不到 pwsh（PowerShell 7）。start-h3.ps1 是 UTF-8 脚本，`
        + `用 Windows PowerShell 5.1 会因编码问题解析失败。请安装 PowerShell 7。`
      : `无法启动 ${shell}：${e.message}`;
  });
  child.on('exit', (code) => { exitedCode = code; });
  child.unref();

  // 等端口就绪
  const until = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 1500));
    if (spawnError) return { ok: false, detail: spawnError };
    const p = readPort();
    if (p && (await portListening(p))) {
      resetComfyProbe();
      return { ok: true, port: p, detail: `已启动（端口 ${p}）` };
    }
    // 脚本自己挑端口，端口文件出现得比端口就绪早，所以只按"能连上"判断。
    // 但如果进程已经退出且端口仍未就绪，说明这次启动没成。
    if (exitedCode !== null) {
      // 给脚本挑端口留一点余地：退出后再等一轮
      await new Promise((r) => setTimeout(r, 3000));
      const p2 = readPort();
      if (p2 && (await portListening(p2))) {
        resetComfyProbe();
        return { ok: true, port: p2, detail: `已启动（端口 ${p2}）` };
      }
      // 启动失败必须清掉探测缓存：否则旧端口会被缓存 5 秒，
      // 用户紧接着再点「启动」时，明明已经起来了也可能报"不可达"。
      resetComfyProbe();
      return {
        ok: false,
        detail: `启动脚本已退出（code ${exitedCode}）但端口未就绪。`
          + `请查看 ai-runtime/comfy_err.log 与 comfy_out.log`,
      };
    }
  }

  resetComfyProbe();
  return {
    ok: false,
    detail: '启动超时（180s 内端口未就绪）。请查看 ai-runtime/comfy_err.log',
  };
}

/** 重启 = 先停后起 */
export async function restartComfy() {
  const stopped = await stopComfy();
  if (!stopped.ok) return { ...stopped, phase: 'stop' };
  const started = await startComfy();
  return { ...started, phase: 'start' };
}

/** 供 API 层做进程内串行，避免两次点击同时启停 */
let busy = false;
export function isBusy() { return busy; }
export async function withLock(fn) {
  if (busy) throw Object.assign(new Error('COMFY_CONTROL_BUSY: 正在启停，请稍候'), { code: 409 });
  busy = true;
  try { return await fn(); } finally { busy = false; }
}
