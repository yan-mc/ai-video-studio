/**
 * Qwen3-VL 本地推理服务控制 —— 启停 / 状态 / 与 ComfyUI 的显存互斥提示。
 *
 * ============================================================================
 * 这是什么
 * ============================================================================
 *
 * `ai-runtime/llama.cpp/llama-server.exe` 跑一个 Qwen3-VL-8B（GGUF），
 * 提供 OpenAI 兼容接口，供 DSH 通过 `llm-pi-ai` 的自定义路由接入（provider=`qwen3vl`）。
 *
 * 它**不是**本插件的后端 —— 插件不依赖它工作。这里提供控制能力纯粹是因为
 * 12GB 单卡上它和 ComfyUI/H3 **不能同时跑**：
 *   · qwen3vl 常驻约 9GB 显存（128k 上下文，KV 放系统内存）
 *   · ComfyUI + H3 出片要 10~14GB
 * 用户需要在一个地方看到两者状态、并一键切换，而不是去翻两个 ps1 脚本。
 *
 * ============================================================================
 * 为什么调 ps1 而不是自己 spawn
 * ============================================================================
 *
 * 启动逻辑（选端口、写 .qwen3vl-port、-nkvo / -c 参数、失败诊断、日志文件）
 * 已经在 `start-qwen3vl.ps1` 里，且**独立于本插件**演进（那是用户自己的运行环境）。
 * 这里再实现一份参数拼装必然走样 —— 只调脚本，保持单一真源。
 *
 * @module services/qwen-server
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config.js';

/** 端口文件由 start-qwen3vl.ps1 写；与 ComfyUI 的 .comfy-port 并列 */
const PORT_FILE = '.qwen3vl-port';

/**
 * 找 ai-runtime 目录（含 llama.cpp 与 start-qwen3vl.ps1）。
 *
 * 与 `comfy-control.findRuntimeDir()` 同一套向上探测策略：
 * 从本文件所在目录往上最多 8 层，逐层试 `<dir>/ai-runtime`。
 * 本仓库布局是 `<workspace>/dsh-jiuzhang-studio/host/services` →
 * 向上 4 层命中 `<workspace>/ai-runtime`。
 *
 * @returns {string} ai-runtime 绝对路径，找不到返回 ''
 */
export function findQwenRuntimeDir() {
  const marks = ['start-qwen3vl.ps1', path.join('llama.cpp', 'llama-server.exe')];
  const hit = (dir) => marks.every((m) => {
    try { return fs.existsSync(path.join(dir, m)); } catch { return false; }
  });

  const push = [];
  // 显式配置优先
  try {
    const cfg = loadConfig();
    if (cfg?.qwenRuntimeDir) push.push(String(cfg.qwenRuntimeDir));
  } catch { /* 配置读不到就走探测 */ }

  let cur = import.meta.dirname;
  for (let i = 0; i < 8; i += 1) {
    push.push(path.join(cur, 'ai-runtime'));
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  for (const p of push) {
    if (p && hit(p)) return p;
  }
  return '';
}

/** 读 .qwen3vl-port（可能为空 → 0） */
export function readQwenPort() {
  const dir = findQwenRuntimeDir();
  if (!dir) return 0;
  try {
    const raw = fs.readFileSync(path.join(dir, PORT_FILE), 'utf8').trim();
    const p = Number(raw);
    return Number.isFinite(p) && p > 0 && p < 65536 ? p : 0;
  } catch {
    return 0;
  }
}

/** 端口是否在监听（一次 HTTP 探测，不看进程名） */
async function portAlive(port) {
  if (!port) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
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
 * @returns {Promise<{
 *   running: boolean, port: number, url: string, runtimeDir: string,
 *   canControl: boolean, model: string|null, nCtx: number|null,
 *   gpuUsedMb: number|null, comfyRunning: boolean, detail: string,
 * }>}
 */
export async function qwenStatus() {
  const runtimeDir = findQwenRuntimeDir();
  const port = readQwenPort();
  const alive = await portAlive(port);

  let model = null;
  let nCtx = null;
  if (alive) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        const j = await r.json();
        const d = Array.isArray(j?.data) ? j.data[0] : null;
        if (d) {
          const name = String(d.id ?? '');
          model = name ? path.basename(name) : null;
          nCtx = Number(d?.meta?.n_ctx) || null;
        }
      }
    } catch { /* 模型信息拿不到不影响存活判定 */ }
  }

  // ComfyUI 是否在跑 —— 只用于"两者不能共存"的提示，不阻塞任何操作
  let comfyRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:8488/health', { signal: AbortSignal.timeout(1500) });
    comfyRunning = res.ok;
  } catch { /* 不可达就是没跑 */ }

  let detail;
  if (!runtimeDir) {
    detail = '找不到 ai-runtime（缺 start-qwen3vl.ps1 或 llama-server.exe）';
  } else if (alive) {
    detail = `运行中 · 端口 ${port}${nCtx ? ` · ${Math.round(nCtx / 1024)}k 上下文` : ''}`;
  } else {
    detail = '未运行';
  }

  return {
    running: alive,
    port: alive ? port : 0,
    url: alive ? `http://127.0.0.1:${port}` : '',
    runtimeDir,
    canControl: Boolean(runtimeDir),
    model,
    nCtx,
    gpuUsedMb: null,
    comfyRunning,
    detail,
  };
}

/** 找 pwsh（PowerShell 7）—— 与 comfy-control 相同的理由：脚本是 UTF-8 中文，5.1 会解析失败 */
function findPwsh() {
  const cands = [];
  for (const key of ['ProgramFiles', 'ProgramFiles(x86)']) {
    const base = process.env[key];
    if (base) {
      cands.push(path.join(base, 'PowerShell', '7', 'pwsh.exe'));
      cands.push(path.join(base, 'PowerShell', '7-preview', 'pwsh.exe'));
    }
  }
  cands.push('pwsh');
  for (const c of cands) {
    if (c === 'pwsh') {
      // 交给 spawn 用 PATH 解析；能不能找到看 exit 事件
      return c;
    }
    try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
  }
  return 'pwsh';
}

/**
 * 跑一个 ps1 并等它结束。
 *
 * ⚠️ 不用 Start-Process 的 -RedirectStandardOutput（会把子进程管道句柄绑到父进程）。
 *    这里用 spawn + 收集 stdout，脚本自己会在就绪后退出（它的轮询有上限）。
 *
 * ⚠️ 必须强制 UTF-8：Windows 上 pwsh 子进程的 stdout 默认按系统 ANSI 代码页
 *    （简体中文机器是 GBK）编码，Node 按 UTF-8 解码会得到乱码
 *    （实测："已释放，显存已归还" 变成 "? �˿� ..."）。
 *    设置 `[Console]::OutputEncoding` 比事后猜编码可靠。
 *
 * @returns {Promise<{code:number, out:string, err:string}>}
 */
function runScript(runtimeDir, scriptName, extraArgs = []) {
  return new Promise((resolve) => {
    const script = path.join(runtimeDir, scriptName);
    if (!fs.existsSync(script)) {
      resolve({ code: -1, out: '', err: `脚本不存在：${scriptName}` });
      return;
    }
    // -Command 包一层，先设 UTF-8 再执行脚本，保证中文按 UTF-8 输出
    const child = spawn(findPwsh(), [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-Command',
      `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); & '${script.replace(/'/g, "''")}' ${extraArgs.map((a) => `'${String(a).replace(/'/g, "''")}'`).join(' ')}`,
    ], { cwd: runtimeDir, windowsHide: true });

    let out = '';
    let err = '';
    child.stdout?.on('data', (c) => { out += c.toString('utf8'); });
    child.stderr?.on('data', (c) => { err += c.toString('utf8'); });
    child.on('error', (e) => {
      resolve({
        code: -1,
        out,
        err: e.code === 'ENOENT'
          ? '找不到 pwsh（PowerShell 7）。脚本是 UTF-8 中文，用 Windows PowerShell 5.1 会解析失败。'
          : `${e.message}`,
      });
    });
    child.on('close', (code) => resolve({ code: code ?? -1, out, err }));
  });
}

/**
 * 从脚本输出里摘一句能给人看的结果。
 *
 * 脚本的约定是最后几行里有一条带 ✅ / ❌ / ⚠️ 的结论行。取**最后一条**结论行
 * （不是第一条）—— start 脚本会先打"启动中…"再打"已就绪"，取第一条会拿到过程文案。
 */
function summarize(out, err, fallback) {
  const lines = String(out || '')
    .split(/\r?\n/)
    .map((s) => s.replace(/\u001b\[[0-9;]*m/g, '').trim())   // 去 ANSI 色码
    .filter(Boolean);
  const marked = lines.filter((l) => /^[✅❌⚠️]/.test(l));
  // 取最后一条带标记的行（结论在过程之后）
  const pick = marked.length ? marked[marked.length - 1] : (lines[lines.length - 1] ?? '');
  if (pick) {
    const cleaned = pick.replace(/^[✅❌⚠️]\s*/u, '').trim();
    if (cleaned) return cleaned;
  }
  return String(err || '').trim().slice(0, 300) || fallback;
}

/**
 * 启动 Qwen3-VL。
 *
 * @param {{contextLength?: number}} [opts]
 * @returns {Promise<{ok:boolean, detail:string, status?:object}>}
 */
export async function startQwen(opts = {}) {
  const runtimeDir = findQwenRuntimeDir();
  if (!runtimeDir) {
    return { ok: false, detail: '找不到 ai-runtime（缺 start-qwen3vl.ps1）' };
  }

  // 已在运行就不重复拉起（脚本自己也会判，这里先挡一次省时间）
  const st0 = await qwenStatus();
  if (st0.running) {
    return { ok: true, detail: `已在运行（端口 ${st0.port}）`, status: st0 };
  }

  const args = [];
  if (Number.isFinite(Number(opts.contextLength)) && Number(opts.contextLength) > 0) {
    args.push('-ContextLength', String(Math.floor(Number(opts.contextLength))));
  }

  const r = await runScript(runtimeDir, 'start-qwen3vl.ps1', args);
  const status = await qwenStatus();
  if (status.running) {
    return { ok: true, detail: summarize(r.out, r.err, `已启动（端口 ${status.port}）`), status };
  }
  return {
    ok: false,
    detail: summarize(r.out, r.err, `启动失败（脚本退出码 ${r.code}）`),
    status,
  };
}

/**
 * 停止 Qwen3-VL。
 *
 * @returns {Promise<{ok:boolean, detail:string, status?:object}>}
 */
export async function stopQwen() {
  const runtimeDir = findQwenRuntimeDir();
  if (!runtimeDir) {
    return { ok: false, detail: '找不到 ai-runtime（缺 stop-qwen3vl.ps1）' };
  }
  const r = await runScript(runtimeDir, 'stop-qwen3vl.ps1');
  const status = await qwenStatus();
  return {
    ok: !status.running,
    detail: summarize(r.out, r.err, status.running ? '停止失败' : '已停止'),
    status,
  };
}

/** 重启 = 先停后起 */
export async function restartQwen(opts = {}) {
  await stopQwen();
  return startQwen(opts);
}

/** 供 API 层做进程内串行，避免两次点击同时启停 */
let busy = false;
export function isQwenBusy() { return busy; }
export async function withQwenLock(fn) {
  if (busy) {
    throw Object.assign(new Error('QWEN_CONTROL_BUSY: 正在启停，请稍候'), { code: 409 });
  }
  busy = true;
  try { return await fn(); } finally { busy = false; }
}