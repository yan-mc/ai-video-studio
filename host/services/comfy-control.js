/**
 * ComfyUI 进程管理 —— 启动 / 停止 / 重启。
 *
 * 为什么需要「重启」：本地「取消」只对正在跑的那一单发 `/interrupt`，
 * 已排进 ComfyUI 队列、还没开始的段不会被清掉 —— 用户看到界面停了，
 * ComfyUI 侧仍会依次跑完，下一单提交后看起来就是"前面的续写还在"。
 * 重启能一次性清掉队列、显存碎片与节点缓存。
 *
 * 实现约束：
 *  · 只认 ai-runtime 下的 start-h3.ps1，不自己拼命令行（端口避让、--lowvram 等
 *    参数、端口文件落盘都在脚本里，重复一份必然走样）。
 *  · 停止是 `/interrupt` + 终止进程的组合：只杀进程会让正在写盘的产物留半截。
 *  · 状态以「端口是否在监听」为准，不靠进程名猜（可能同时有多个 python）。
 *  · 停止/重启有**归属判定**（`startedByUs`）：只停本进程拉起的实例。
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
 * 本进程是否**自己拉起**了这个 ComfyUI 实例。
 *
 * 只有 `startComfy()` 成功后才置 true；`stopComfy`/`restartComfy` 在没有
 * `force` 时以此判定归属，避免误杀用户手动起的 ComfyUI（以及它名下别人的任务）。
 *
 * 与 `comfy-lifecycle.js` 的 `startedByUs` 是同一语义的两个作用域：
 * lifecycle 管"批次结束要不要关"，这里管"用户点停止敢不敢杀"。
 * 两边都必须只看自己拉起的实例。
 */
let startedByUs = false;

/** 当前实例是否由本进程拉起（供 API 层做二次确认） */
export function isStartedByUs() { return startedByUs; }

/** 进程内重置归属标记（配置变更 / 测试用） */
export function resetOwnership() { startedByUs = false; }

/**
 * 找 PowerShell 可执行文件。
 *
 * 必须用 PowerShell 7（`pwsh`），不能用 `powershell.exe`：`start-h3.ps1` 是
 * UTF-8 无 BOM 的中文脚本，5.1 会按系统 ANSI 代码页解码，中文全变乱码、
 * 引号被吞，报出看不懂的语法错误。找不到 pwsh 时明确报错，不退回 5.1。
 */
export function findPwsh() {
  const candidates = [];
  if (process.env.DSH_PWSH) candidates.push(process.env.DSH_PWSH);

  // where.exe 能解析出真实路径：Windows Store 版的 WindowsApps\pwsh.exe 是重解析点，
  // stat 它本身 EACCES，而 where 会同时给出可 stat 的 Microsoft.PowerShell_<ver>\pwsh.exe。
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
 * 找出 ComfyUI **实际可达**的端口：端口文件 → 探测到的可达地址 → 0。
 *
 * 不能只用 `.comfy-port`：文件可能缺失/写坏/目录被搬走（`readPort` 返回 0），
 * 而 ComfyUI 完全可能仍在运行（用户的 DSH_COMFY_URL、或脚本挑了个别的端口）。
 * 只认端口文件会让「停止」误报"本来就没在运行"，把 10–14GB 显存留在卡上。
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
 * 顺序：先让 ComfyUI 自己清队列/历史、卸模型，再终止进程 ——
 * 直接杀进程会留下半截 mp4/safetensors，且磁盘上的续写 latent 仍会被新进程使用。
 *
 * **归属判定**：除非 `force: true`，否则只停本进程拉起的实例。用户手动起的 ComfyUI
 * 可能在跑别人的任务，点一下「停止」就 SIGTERM + 清空队列是破坏性操作 ——
 * 那种情况返回 `notOwned: true` 让上层做二次确认。
 *
 * @param {{purge?: boolean, force?: boolean}} [opts]
 *   purge=true 执行清场序列；force=true 跳过归属判定（用户已二次确认）
 * @returns {Promise<{ok:boolean, detail:string, purged?:object, notOwned?:boolean}>}
 */
export async function stopComfy(opts = {}) {
  const purge = opts.purge === true;
  const force = opts.force === true;
  const port = await resolveLivePort();
  if (!port) {
    resetComfyProbe();
    startedByUs = false;
    return { ok: true, alreadyStopped: true, detail: '本来就没在运行' };
  }

  if (!startedByUs && !force) {
    return {
      ok: false,
      notOwned: true,
      port,
      detail: `端口 ${port} 上的 ComfyUI 不是本插件拉起的，已拒绝停止。`
        + '若确认要停（会中断正在跑的任务、清空排队项），请带 force 再试一次。',
    };
  }

  const purged = purge ? await purgeComfyState(port) : null;

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
  if (stopped) startedByUs = false;
  return stopped
    ? { ok: true, pid, port, detail: `已停止（pid ${pid}）`, ...(purged ? { purged } : {}) }
    : { ok: false, detail: `pid ${pid} 仍在监听端口 ${port}，未能停止`, ...(purged ? { purged } : {}) };
}

/* ==========================================================================
 * 清场（purge）—— "把跑一半的东西清干净"
 * ========================================================================== */

/** 轮询 ComfyUI 状态的间隔 */
const PURGE_POLL_MS = 250;
/** 等"队列已空"的上限：正在跑的那一单要 respond 到 interrupt，通常 < 3s */
const PURGE_IDLE_TIMEOUT_MS = 20000;
/** 等"显存真正归还"的上限 */
const PURGE_VRAM_TIMEOUT_MS = 20000;

/** 读 /queue：返回 { running, pending } 两个计数 */
async function queueCounts(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/queue`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      running: Array.isArray(j?.queue_running) ? j.queue_running.length : 0,
      pending: Array.isArray(j?.queue_pending) ? j.queue_pending.length : 0,
    };
  } catch {
    return null;
  }
}

/** 读 /system_stats 的显存占用（字节）；拿不到返回 null */
async function vramUsedBytes(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/system_stats`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const dev = Array.isArray(j?.devices) ? j.devices[0] : null;
    if (!dev) return null;
    const total = Number(dev.vram_total);
    const free = Number(dev.vram_free);
    if (!Number.isFinite(total) || !Number.isFinite(free)) return null;
    return { total, free, used: Math.max(0, total - free) };
  } catch {
    return null;
  }
}

/**
 * 把 ComfyUI 恢复到"刚启动"的干净状态。顺序不可换：
 *
 *  1) interrupt 当前任务 —— worker 只有在一单跑完后才处理 `/queue` 与 `/free`
 *     的 flag；不先让它停，后面两件事都不会被处理。
 *  2) 清队列 `/queue {clear:true}`：pending 全没。
 *  3) 清历史 `/history {clear:true}`：不清的话 `/history/<id>` 仍能查到上次任务的
 *     outputs，调度侧"以为还在跑"的判断会出错。
 *  4) 卸载模型 + 释放显存 `/free {unload_models, free_memory}`。这两个参数**只是设 flag**，
 *     真正执行在 worker 下一轮循环（unload_all_models + reset 节点缓存 + gc），
 *     所以必须轮询等它生效，不能发完就返回。
 *  5) 等显存真的掉下来 —— 只看 flag 没用，读 `vram_free` 比较才知道 11GB 是否归还。
 *
 * @param {number} port
 * @returns {Promise<{
 *   queueBefore:{running:number,pending:number}|null,
 *   idle:boolean, vramBefore:object|null, vramAfter:object|null,
 *   freedMb:number, modelUnloaded:boolean, waitedMs:number,
 * }>}
 */
export async function purgeComfyState(port) {
  const t0 = Date.now();
  const queueBefore = await queueCounts(port);
  const vramBefore = await vramUsedBytes(port);

  // 1) 让当前任务停下来
  try {
    await fetch(`http://127.0.0.1:${port}/interrupt`, {
      method: 'POST', signal: AbortSignal.timeout(5000),
    });
  } catch { /* 尽力而为 */ }

  // 2) 清队列
  try {
    await fetch(`http://127.0.0.1:${port}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* 尽力而为 */ }

  // 3) 清历史
  try {
    await fetch(`http://127.0.0.1:${port}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* 尽力而为 */ }

  // 4) 等队列空 —— worker 必须空闲才会处理下面的 free flag
  let idle = false;
  const idleUntil = Date.now() + PURGE_IDLE_TIMEOUT_MS;
  while (Date.now() < idleUntil) {
    const c = await queueCounts(port);
    if (c && c.running === 0 && c.pending === 0) { idle = true; break; }
    // 队列查询失败（进程可能已经在收尾）也当作已空
    if (c === null) { idle = true; break; }
    await new Promise((r) => setTimeout(r, PURGE_POLL_MS));
  }

  // 队列空之后**再清一次历史**：被 interrupt 打断的任务会在收尾时把自己写进
  // history（0 条变 1 条）。清历史若在 interrupt 之前做，那条"跑一半被掐掉"的
  // 记录会留下 —— 而用户诉求正是"把跑一半的删了"。
  try {
    await fetch(`http://127.0.0.1:${port}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* 尽力而为 */ }

  // 5) 请求卸载模型 + 释放显存（只是设 flag）
  let flagAccepted = false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(5000),
    });
    flagAccepted = res.ok;
  } catch { /* ignore */ }

  // 6) 等显存真的降下来（flag 由 worker 异步消费）
  let vramAfter = vramBefore;
  let modelUnloaded = false;
  if (flagAccepted) {
    const vramUntil = Date.now() + PURGE_VRAM_TIMEOUT_MS;
    const baseline = vramBefore?.used ?? null;
    while (Date.now() < vramUntil) {
      await new Promise((r) => setTimeout(r, PURGE_POLL_MS));
      const v = await vramUsedBytes(port);
      if (!v) { vramAfter = vramAfter ?? null; break; }
      vramAfter = v;
      // 判定"模型已卸载"：占用掉到基线的 60% 以下，或总量已小于 2GB
      if (baseline !== null && baseline > 0) {
        if (v.used <= baseline * 0.6 || v.used <= 2 * 1024 ** 3) { modelUnloaded = true; break; }
      } else if (v.used <= 2 * 1024 ** 3) {
        modelUnloaded = true; break;
      }
    }
  }

  const freedMb = (vramBefore && vramAfter)
    ? Math.round((vramBefore.used - vramAfter.used) / (1024 * 1024))
    : 0;

  return {
    queueBefore,
    idle,
    vramBefore,
    vramAfter,
    freedMb,
    modelUnloaded,
    waitedMs: Date.now() - t0,
  };
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
      // 已经在跑：**不**认领归属（不是我们拉起的，停止时不该杀）
      return { ok: true, alreadyRunning: true, port: p, detail: `已在运行（端口 ${p}）` };
    }
  }

  // 不 detached，只 unref()：Windows 上 detached + stdio:'ignore' 会让 powershell
  // 立刻以 code 0 退出；ComfyUI 是脚本内部 Start-Process 起的独立 python 进程。
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
      startedByUs = true;                 // 这次是我们拉起的 → 允许我们停
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
        startedByUs = true;
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

/**
 * 重启 ComfyUI —— 彻底初始化：停掉跑一半的东西并清干净，再给一个刚启动的 H3。
 *
 * 与单纯 kill + 拉起的差别是**先清场再杀**（purge 序列见 `purgeComfyState`），
 * 并等到显存真的归还才杀进程。
 *
 * 不删 `output/nanfeng_v15_context/`（续写 latent）：那是断点续跑依赖的状态，
 * 删掉会让"跑了 3 段、第 4 段失败想续跑"必须从头再来。
 *
 * 重启本身即用户确认过的操作意图，所以停止阶段跳过归属判定（`force: true`）。
 *
 * @param {{purge?: boolean, force?: boolean}} [opts]
 * @returns {Promise<object>}
 */
export async function restartComfy(opts = {}) {
  const purge = opts.purge !== false;      // 默认执行清场
  const t0 = Date.now();

  const stopped = await stopComfy({ purge, force: true });
  if (!stopped.ok) return { ...stopped, phase: 'stop' };

  const started = await startComfy();
  const totalMs = Date.now() - t0;

  const freedMb = stopped.purged?.freedMb ?? 0;
  const detail = started.ok
    ? `已重启并清场${freedMb > 0 ? `（释放 ${freedMb} MB 显存）` : ''} · 端口 ${started.port} · ${Math.round(totalMs / 1000)}s`
    : started.detail;

  return {
    ...started,
    detail,
    phase: 'start',
    purged: stopped.purged ?? null,
    totalMs,
  };
}

/** 供 API 层做进程内串行，避免两次点击同时启停 */
let busy = false;
export function isBusy() { return busy; }
export async function withLock(fn) {
  if (busy) throw Object.assign(new Error('COMFY_CONTROL_BUSY: 正在启停，请稍候'), { code: 409 });
  busy = true;
  try { return await fn(); } finally { busy = false; }
}
