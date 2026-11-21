/**
 * 本地 7B 翻译模型的 Node 侧客户端。
 *
 * ============================================================================
 * 进程模型：按需拉起、用完即退
 * ============================================================================
 *
 * 7B 模型 4bit 量化后仍占 ~5GB 显存，而 H3 本身就要 10GB+。
 * 两者同时驻留会 OOM。所以：
 *
 *   · **不常驻** —— 只在用户点「编译」时拉起
 *   · **编译完就退** —— 翻译是一次性的，没必要留着
 *   · 与 ComfyUI 的启停错开 —— 用户点「编译」时 ComfyUI 是关的
 *
 * 通信走 stdin/stdout 单行 JSON，不开 HTTP 端口 —— 省掉端口冲突，
 * 也让进程生命周期干净（父进程退出子进程跟着死）。
 *
 * @module prompt-llm
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT = path.join(PLUGIN_ROOT, 'tools', 'prompt-llm', 'translate_server.py');

/** 模型加载慢（首次要读 5GB 权重），给足时间 */
const LOAD_TIMEOUT_MS = 10 * 60 * 1000;
/** 单条翻译超时 */
const TRANSLATE_TIMEOUT_MS = 3 * 60 * 1000;

/** 解析 ai-runtime 的 python（与 ComfyUI 共用同一个 venv） */
function resolvePython(cfg) {
  const explicit = process.env.JZ_PYTHON;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates = [
    cfg?.comfyPython,
    'F:\\AI视频\\ai-runtime\\venv\\Scripts\\python.exe',
    path.join(PLUGIN_ROOT, '..', 'ai-runtime', 'venv', 'Scripts', 'python.exe'),
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return 'python';
}

/**
 * 模型权重是否已下载。
 *
 * 只检查 HuggingFace 缓存目录是否存在对应快照 —— 不做网络探测，
 * 因为「没下过」和「网断了」要区分开给不同提示。
 */
export function modelPresent() {
  try {
    const hf = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cache', 'huggingface', 'hub');
    if (!fs.existsSync(hf)) return false;
    return fs.readdirSync(hf).some((d) => /qwen2\.5-7b-instruct/i.test(d));
  } catch { return false; }
}

/**
 * 拉起翻译进程，逐条翻译，然后关掉。
 *
 * @param {object} cfg
 * @param {string[]} texts 待翻译的句子
 * @returns {Promise<Record<string,string>>} 原文 → 译文。**失败的条目不出现在结果里**
 *   （调用方据此保留原文，绝不丢内容）。
 */
export async function translateBatch(cfg, texts) {
  const list = (Array.isArray(texts) ? texts : [])
    .map((t) => String(t ?? '').trim())
    .filter(Boolean);
  if (!list.length) return {};

  const py = resolvePython(cfg);
  if (!fs.existsSync(SCRIPT)) {
    throw new Error(`PROMPT_LLM_SCRIPT_MISSING: ${SCRIPT}`);
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(py, ['-u', SCRIPT], {
      cwd: PLUGIN_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    const results = {};
    let buf = '';
    let ready = false;
    let pending = 0;
    let settled = false;
    let stderr = '';

    const cleanup = () => {
      try { child.stdin.end(); } catch { /* ignore */ }
      try { child.kill(); } catch { /* ignore */ }
    };
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimer);
      cleanup();
      reject(new Error(msg));
    };
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimer);
      cleanup();
      resolve(results);
    };

    const loadTimer = setTimeout(
      () => fail(`PROMPT_LLM_LOAD_TIMEOUT: 模型 ${LOAD_TIMEOUT_MS / 60000} 分钟内未就绪`),
      LOAD_TIMEOUT_MS,
    );

    child.stderr.on('data', (d) => {
      stderr += String(d);
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    child.stdout.on('data', (d) => {
      buf += String(d);
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        // 启动握手
        if (msg.id === null) {
          if (!msg.ok) { fail(`PROMPT_LLM_START_FAILED: ${msg.error}\n${stderr.slice(-600)}`); return; }
          ready = true;
          clearTimeout(loadTimer);
          // 模型就绪 → 一次性把所有句子发过去
          for (let i = 0; i < list.length; i += 1) {
            child.stdin.write(JSON.stringify({ id: String(i), text: list[i] }) + '\n');
          }
          pending = list.length;
          if (!pending) done();
          continue;
        }

        if (msg.ok && typeof msg.text === 'string') {
          results[list[Number(msg.id)]] = msg.text.trim();
        }
        // 单条失败不中断整批 —— 保留原文就好
        pending -= 1;
        if (pending <= 0 && ready) done();
      }
    });

    child.on('error', (e) => fail(`PROMPT_LLM_SPAWN_FAILED: ${e.message}`));
    child.on('exit', (code) => {
      if (!settled) {
        // 已拿到的结果仍然可用，不因为进程退出而丢弃
        if (Object.keys(results).length) { settled = true; resolve(results); return; }
        fail(`PROMPT_LLM_EXIT: code=${code}\n${stderr.slice(-600)}`);
      }
    });

    setTimeout(() => fail(`PROMPT_LLM_TIMEOUT: 翻译超过 ${TRANSLATE_TIMEOUT_MS / 60000} 分钟`), TRANSLATE_TIMEOUT_MS);
  });
}

/** 探测环境是否可用（给前端显示"能不能用模型翻译"） */
export function llmStatus(cfg) {
  const py = resolvePython(cfg);
  const hasScript = fs.existsSync(SCRIPT);
  const hasModel = modelPresent();
  return {
    python: py,
    script: hasScript,
    modelPresent: hasModel,
    /** 三者齐全才算可用 */
    usable: hasScript && hasModel,
    hint: !hasScript
      ? '翻译脚本缺失'
      : !hasModel
        ? '模型未下载（首次使用会自动下载约 15GB）'
        : '可用',
  };
}
