/**
 * ComfyUI 客户端 —— H3 生成的实际执行器。
 *
 * 约束（每条都已实测）：
 *  - 取消时真发 `/interrupt` 与 `/queue` 删除，远端不再空烧 GPU；
 *  - stage 文件名带 jobId + 内容哈希，同 job 内同名文件不会互相覆盖；
 *  - 错误优先识别 ComfyUI 的 status_str=error，不误报"没有输出文件"；
 *  - 轮询按**截止时间**等（见 `COMFY_TIMEOUT_MIN`），不按次数。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadConfig } from '../config.js';
import { cancellableSleep, throwIfCancelled } from './job-runner.js';

const POLL_MS = 3000;

/**
 * 单任务等待上限（分钟）—— **默认 2 小时**。
 *
 * 覆盖 50 步原模型长片（`none` 加速方案）的最坏情况：5 秒片在高分辨率下
 * 跑满 50 步很容易超过 1 小时。
 *
 * 可配置：环境变量 `JZ_COMFY_TIMEOUT_MIN` > 配置 `comfyTimeoutMin` > 本默认值，
 * 上限 24 小时（防手滑写成天文数字把进程挂死）。
 *
 * ⚠️ 批次段等待（续写编排）**必须**引用这里导出的 `resolveComfyTimeoutMs(cfg)`
 *    再加余量，而不是另写一个 1 小时的硬编码 —— 段超时 < 单任务超时的后果是：
 *    任务还在 ComfyUI 里跑、批次已把该段判 failed 并 return，而下一段因为
 *    "前面有非 completed 段"永久卡死，只能手工 reset。
 *    （当前 `host/api/routes/nanfeng.js` 的 `waitSegment` 仍是 1h 硬编码，不归本模块改。）
 */
export const COMFY_TIMEOUT_MIN = 120;

/** 超时硬上限（分钟） */
export const COMFY_TIMEOUT_MAX_MIN = 24 * 60;

/**
 * 解析本次生效的超时（毫秒）。优先级：环境变量 > 配置 > 默认。
 *
 * @param {object} [cfg]
 * @returns {number}
 */
export function resolveComfyTimeoutMs(cfg = loadConfig()) {
  const fromEnv = Number(process.env.JZ_COMFY_TIMEOUT_MIN);
  const fromCfg = Number(cfg?.comfyTimeoutMin);
  const min = Number.isFinite(fromEnv) && fromEnv > 0
    ? fromEnv
    : (Number.isFinite(fromCfg) && fromCfg > 0 ? fromCfg : COMFY_TIMEOUT_MIN);
  return Math.min(min, COMFY_TIMEOUT_MAX_MIN) * 60 * 1000;
}

/**
 * 端口自动发现。
 *
 * Windows 的 Hyper-V / WSL / Docker 会**动态保留**大段 TCP 端口，被保留的端口
 * 绑定直接报 WinError 10013，且保留范围每次重启都可能变 —— 所以 ComfyUI 的端口
 * 不能写死，也不能假设上次那个还能用。
 *
 * 约定：`ai-runtime/start-h3.ps1` 启动成功后把实际端口写进 `ai-runtime/.comfy-port`，
 * 这里读它即可自动跟随。
 * 优先级：显式环境变量 > 端口文件 > 配置里的 comfyUrl（显式指定不该被文件覆盖）。
 */
const PORT_FILE_NAMES = ['.comfy-port'];

/**
 * 候选的 ai-runtime 目录。
 *
 * 不精确计算层级（插件可能被 link 到任意位置），改为从插件根逐层向上找名为
 * `ai-runtime` 的兄弟目录：每层都试 `<dir>/ai-runtime`，插件放在 `工作室/` 下
 * 或直接放在工程根下都能命中。
 */
function portFileCandidates() {
  const out = [];
  const push = (p) => { if (p && !out.includes(p)) out.push(p); };

  if (process.env.DSH_COMFY_HOME) push(process.env.DSH_COMFY_HOME);
  if (process.env.H3_HOME) push(process.env.H3_HOME);

  try {
    let dir = import.meta.dirname;   // <plugin>/host/services
    for (let i = 0; i < 8; i += 1) {
      push(path.join(dir, 'ai-runtime'));
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* ignore */ }
  return out;
}

/** 读 ai-runtime/.comfy-port，返回 `http://127.0.0.1:<port>` 或空串 */
export function discoverComfyUrl() {
  const explicit = process.env.DSH_COMFY_URL || process.env.COMFY_URL;
  if (explicit) return String(explicit).replace(/\/+$/, '');

  for (const dir of portFileCandidates()) {
    for (const name of PORT_FILE_NAMES) {
      try {
        const f = path.join(dir, name);
        if (!fs.existsSync(f)) continue;
        const raw = fs.readFileSync(f, 'utf8').trim();
        const port = Number(raw);
        if (Number.isFinite(port) && port > 0 && port < 65536) {
          return `http://127.0.0.1:${port}`;
        }
      } catch { /* ignore */ }
    }
  }
  return '';
}

/**
 * 拿一个**确认可达**的 ComfyUI 地址。
 *
 * 端口文件可能是上一次运行的残留（服务已停），直接按文件去连会 ECONNREFUSED，
 * 而用户只会看到"ComfyUI 不可达"，想不到是端口文件过期。
 *
 * 顺序：候选地址逐个探 `/system_stats`，第一个通的就用。
 * 候选 = [端口文件, 配置里的 comfyUrl, 常见端口扫描]；全不通时返回首选地址，
 * 让错误信息指向最可能的那个。
 */
const PROBE_CACHE = { url: '', at: 0 };
const PROBE_TTL_MS = 5000;

export async function resolveComfyUrl(cfg = loadConfig()) {
  if (PROBE_CACHE.url && Date.now() - PROBE_CACHE.at < PROBE_TTL_MS) return PROBE_CACHE.url;

  const candidates = [];
  const push = (u) => {
    const s = String(u || '').replace(/\/+$/, '');
    if (s && !candidates.includes(s)) candidates.push(s);
  };
  push(discoverComfyUrl());
  push(configuredUrl(cfg));
  // 常见端口兜底（脚本挑选的候选段）
  for (const p of [8488, 8688, 8888, 9088, 9288, 8388, 8188]) push(`http://127.0.0.1:${p}`);

  for (const u of candidates) {
    try {
      const res = await fetch(`${u}/system_stats`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        PROBE_CACHE.url = u;
        PROBE_CACHE.at = Date.now();
        return u;
      }
    } catch { /* 继续试下一个 */ }
  }
  // 探测失败**不写缓存**：ComfyUI 刚 bind 完或启动脚本还在加载模型时，一次失败
  // 如果被缓存 5 秒，接下来 health()/vramStatus() 全报"不可达"。
  PROBE_CACHE.url = '';
  PROBE_CACHE.at = 0;
  return candidates[0] || '';
}

/** 只取配置值（不经端口文件） */
function configuredUrl(cfg = loadConfig()) {
  return String(cfg.comfyUrl || '').replace(/\/+$/, '');
}

/** 清探测缓存（配置变更后调用） */
export function resetComfyProbe() {
  PROBE_CACHE.url = '';
  PROBE_CACHE.at = 0;
}

async function getJson(url, opts) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`COMFY_HTTP_${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error(`COMFY_BAD_JSON: ${text.slice(0, 200)}`); }
}

/** 健康检查 */
export async function health(cfg = loadConfig()) {
  const url = await resolveComfyUrl(cfg);
  if (!url) return { ok: false, detail: '未配置 comfyUrl' };
  try {
    const res = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(2500) });
    return { ok: res.ok, detail: `ComfyUI ${res.status}`, url };
  } catch (e) {
    return { ok: false, detail: `不可达（${e.message}）`, url };
  }
}

/** 显存信息缓存（避免每次生成都拉一次 system_stats） */
let vramCache = { at: 0, value: null };
const VRAM_TTL_MS = 10_000;

/**
 * 读 ComfyUI 报告的显存状态。
 *
 * 用 ComfyUI 自己的 `/system_stats` 而不是 nvidia-smi：
 *  · 跨平台，不依赖 NVIDIA 驱动工具
 *  · 反映的是**ComfyUI 这个进程**看到的可用显存，比整卡数字更贴近实际
 *
 * @returns {Promise<{ok:boolean, totalBytes:number, freeBytes:number, usedBytes:number, detail?:string}>}
 */
export async function vramStatus(cfg = loadConfig()) {
  if (vramCache.value && Date.now() - vramCache.at < VRAM_TTL_MS) return vramCache.value;

  const fallback = { ok: false, totalBytes: 0, freeBytes: 0, usedBytes: 0, detail: '不可用' };
  const url = await resolveComfyUrl(cfg);
  if (!url) { vramCache = { at: Date.now(), value: fallback }; return fallback; }

  try {
    const res = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const dev = Array.isArray(j?.devices) ? j.devices[0] : null;
    if (!dev) throw new Error('无设备信息');
    const totalBytes = Number(dev.vram_total) || 0;
    const freeBytes = Number(dev.vram_free) || 0;
    const value = {
      ok: totalBytes > 0,
      totalBytes,
      freeBytes,
      usedBytes: Math.max(0, totalBytes - freeBytes),
      device: dev.name ?? '',
    };
    vramCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    const value = { ...fallback, detail: String(e?.message || e) };
    vramCache = { at: Date.now(), value };
    return value;
  }
}

/** 清显存缓存（生成前后可主动调，确保拿到最新值） */
export function resetVramCache() { vramCache = { at: 0, value: null }; }

/**
 * 拉取 ComfyUI 实际可用的模型文件名（按 ComfyUI 的文件夹分类）。
 *
 * 问 ComfyUI 而不是扫磁盘：模型目录可能通过 extra_model_paths.yaml 配到别处，
 * 扫 dataDir 或猜路径都会漏。`object_info` 是唯一权威列表。
 *
 * 返回 `{ diffusion_models, text_encoders, vae, loras, model_patches }`；
 * 拿不到（不可达 / 节点缺失）时返回空数组，调用方自行回退到默认名。
 */
export async function listModelFiles(cfg = loadConfig()) {
  const base = await resolveComfyUrl(cfg).catch(() => '');
  // 三态返回：`ok` 区分"探测成功但没有"与"压根没探到"。合并成一个空对象的话，
  // 调用方无法判断"模型确实没装"还是"ComfyUI 不可达"，只能猜 ——
  // 猜错的后果是硬提交一个不存在的模型名。
  if (!base) return { ok: false, reason: 'ComfyUI 地址不可达', diffusion_models: [], text_encoders: [], vae: [], loras: [], model_patches: [] };
  /**
   * 从 node schema 里取下拉选项。两种形态都存在，必须都处理：
   *   V1 节点：`[ ["a.safetensors","b.safetensors"], {tooltip} ]`  ← 列表在 [0]
   *   V3 节点：`[ "COMBO", {options: [...]} ]`                     ← 列表在 [1].options
   * 只按后者写的话所有 V1 节点都会返回空 —— 模型列表永远为空、静默退回默认名。
   */
  const pick = (info, nodeType, inputName) => {
    const spec = info?.[nodeType]?.input?.required?.[inputName];
    if (!Array.isArray(spec)) return [];
    if (Array.isArray(spec[0])) return spec[0].filter((x) => typeof x === "string");
    const opts = spec[1]?.options;
    if (Array.isArray(opts)) return opts.filter((x) => typeof x === "string");
    return [];
  };
  try {
    const nodes = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly', 'ModelPatchLoader'];
    const infos = await Promise.all(nodes.map(async (n) => {
      try {
        const r = await fetch(`${base}/object_info/${n}`, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) return [n, null];
        return [n, await r.json()];
      } catch { return [n, null]; }
    }));
    const map = Object.fromEntries(infos);
    // 一个节点都没探到 → 视为探测失败，而不是"模型列表为空"
    const anyOk = nodes.some((n) => map[n] != null);
    return {
      ok: anyOk,
      ...(anyOk ? {} : { reason: 'ComfyUI /object_info 全部请求失败' }),
      diffusion_models: pick(map.UNETLoader, 'UNETLoader', 'unet_name'),
      text_encoders: pick(map.CLIPLoader, 'CLIPLoader', 'clip_name'),
      vae: pick(map.VAELoader, 'VAELoader', 'vae_name'),
      loras: pick(map.LoraLoaderModelOnly, 'LoraLoaderModelOnly', 'lora_name'),
      model_patches: pick(map.ModelPatchLoader, 'ModelPatchLoader', 'name'),
    };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e), diffusion_models: [], text_encoders: [], vae: [], loras: [], model_patches: [] };
  }
}


/**
 * 上传名只保留安全字符 + 内容哈希。
 *
 * ComfyUI 把它当文件名落盘，所以必须 ASCII 安全；但哈希必须覆盖
 * **完整源路径 + 文件内容**，不能只哈希 basename —— 否则同一 job 里
 * `角色/正面.png` 与 `场景/正面.png` 会得到同一个名字，后传的覆盖先传的，
 * 两张参考图变成同一张且不报错（LoadImage 找到文件就正常跑）。
 */
function safeStem(text) {
  const base = String(text).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const hash = createHash('sha1').update(String(text)).digest('hex').slice(0, 8);
  return `${(base || 'img').slice(0, 56)}_${hash}`;
}

/**
 * 内容指纹：源绝对路径 + 前 64KB 内容 + 文件大小。
 *
 * 路径进哈希是必需的（不同目录同名文件内容可能恰好相同、但语义不同，
 * 例如同一张图挂在两个不同镜头上用不同用途）；内容进哈希是为了
 * 同一路径的图被替换后不会复用旧的上传名。
 *
 * @param {string} abs
 * @returns {string} 10 位十六进制
 */
function contentFingerprint(abs) {
  const h = createHash('sha1').update(String(abs));
  try {
    const st = fs.statSync(abs);
    h.update(`|${st.size}`);
    const fd = fs.openSync(abs, 'r');
    try {
      const buf = Buffer.alloc(Math.min(65536, st.size));
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      h.update(buf.subarray(0, n));
    } finally { fs.closeSync(fd); }
  } catch { /* 读不到内容也至少有路径，仍然唯一 */ }
  return h.digest('hex').slice(0, 10);
}

/**
 * 把本地图片交给 ComfyUI，返回 `{ 占位符: ComfyUI 里的文件名 }`。
 *
 * 优先走 `POST /upload/image`（不要求插件与 ComfyUI 同机同路径），
 * 失败才退回本地复制到 `cfg.comfyInputDir`。失败一律抛出 ——
 * 静默吞掉的后果是参考图整段不接线、提交给 ComfyUI 的工作流里根本没有图。
 */
export async function stageToComfyInput(cfg, absPaths, jobId) {
  const out = {};
  const entries = Object.entries(absPaths || {}).filter(([, abs]) => abs);
  if (!entries.length) return out;

  const url = await resolveComfyUrl(cfg);
  const dir = cfg.comfyInputDir;
  const tag = 'jzpreviz';
  const failures = [];

  for (const [key, abs] of entries) {
    if (!fs.existsSync(abs)) { failures.push(`${key}: 源文件不存在 ${abs}`); continue; }

    const ext = path.extname(abs) || '.png';
    // 名字 = 占位符键 + jobId + 源路径/basename 可读片段 + 内容指纹。
    // 内容指纹是唯一性保证，其余部分只为排障时可读。
    const name = `${tag}_${jobId}_${safeStem(key)}_${contentFingerprint(abs)}${ext}`;

    let landed = false;
    if (url) {
      try {
        const buf = fs.readFileSync(abs);
        const form = new FormData();
        form.append('image', new Blob([buf]), name);
        form.append('type', 'input');
        // 不写 overwrite：名字已含内容指纹，撞名的概率可忽略。
        // 无条件 overwrite=true 会覆盖掉**别人**（其它 job / 用户手动上传）的同名文件。
        const res = await fetch(`${url}/upload/image`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(60000),
        });
        if (res.ok) {
          const body = await res.json().catch(() => null);
          // 服务端可能改名（去重追加序号），以它返回的为准
          const remote = body?.name ? (body.subfolder ? `${body.subfolder}/${body.name}` : body.name) : '';
          if (remote) { out[key] = remote; landed = true; }
        }
      } catch { /* 落到本地复制回退 */ }
    }

    if (!landed && dir && fs.existsSync(dir)) {
      try {
        fs.copyFileSync(abs, path.join(dir, name));
        out[key] = name;
        landed = true;
      } catch (e) {
        failures.push(`${key}: 复制进 input 目录失败（${e.message}）`);
      }
    }
    if (!landed && !failures.some((f) => f.startsWith(`${key}:`))) {
      failures.push(`${key}: 上传失败（comfyUrl=${url || '未配置'}，comfyInputDir=${dir || '未配置'}）`);
    }
  }

  if (failures.length) {
    throw new Error(`COMFY_STAGE_FAILED: 参考图未能送入 ComfyUI → ${failures.join('; ')}`);
  }
  return out;
}

/** 深度替换工作流里的 {{PLACEHOLDER}} */
export function deepReplace(value, map) {
  if (typeof value === 'string') {
    if (map[value] !== undefined) return map[value];
    if (!value.includes('{{')) return value;
    return value.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (map[`{{${k}}}`] !== undefined ? String(map[`{{${k}}}`]) : m));
  }
  if (Array.isArray(value)) return value.map((v) => deepReplace(v, map));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = deepReplace(v, map);
    return o;
  }
  return value;
}

/**
 * 读 ComfyUI 队列，返回某个 prompt 的位次信息。
 *
 * `/history` 只有**跑完之后**才出现条目（单张 4.2MP 实测约 148 秒），
 * 只轮询 history 时整段时间 UI 只能显示"进行中"，用户不知道是在跑、
 * 在排队还是卡住了。`/queue` 是唯一能回答"现在到哪了"的轻量端点：
 *   queue_running[i][0] = 正在执行的 prompt_id
 *   queue_pending[i][0] = 排队的 prompt_id（按顺序）
 *
 * 拿不到就返回 null —— 进度是锦上添花，不能成为新的失败源。
 *
 * @param {object} cfg
 * @param {string} remoteId
 * @returns {Promise<null|{state:'running'|'pending'|'unknown', ahead:number, runningTotal:number}>}
 */
export async function queueStatus(cfg, remoteId) {
  if (!remoteId) return null;
  try {
    const url = await resolveComfyUrl(cfg);
    if (!url) return null;
    const res = await fetch(`${url}/queue`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const q = await res.json();
    const runningList = Array.isArray(q?.queue_running) ? q.queue_running : [];
    const pendingList = Array.isArray(q?.queue_pending) ? q.queue_pending : [];
    const matches = (entry) => Array.isArray(entry) && String(entry[1]) === String(remoteId);
    if (runningList.some(matches)) {
      return { state: 'running', ahead: 0, runningTotal: runningList.length };
    }
    const idx = pendingList.findIndex(matches);
    if (idx >= 0) {
      return { state: 'pending', ahead: idx, runningTotal: runningList.length };
    }
    return { state: 'unknown', ahead: 0, runningTotal: runningList.length };
  } catch { return null; }
}

/**
 * 提交工作流并轮询，返回产物。
 *
 * @param {object} opts
 * @param {object} opts.cfg
 * @param {object} opts.workflow
 * @param {object} opts.map
 * @param {object} opts.job
 * @param {string} opts.outputsDir
 * @param {(remoteId:string, job:object)=>Promise<void>} [opts.onSubmitted]
 * @param {(p:{pct:number, note:string, queue?:object|null})=>Promise<void>|void} [opts.onProgress]
 * @param {string} [opts.progressHint] 附在进度文案后的补充（例如"2 个样本"）
 */
export async function runWorkflow({ cfg, workflow, map, job, outputsDir, onSubmitted, onProgress, progressHint = '' }) {
  const wf = deepReplace(workflow, map);
  const url = await resolveComfyUrl(cfg);
  const submitted = await getJson(`${url}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: wf, client_id: job.id }),
  });
  const remoteId = submitted.prompt_id || submitted.id;
  if (!remoteId) throw new Error('COMFY_NO_PROMPT_ID');

  // 提交成功后**立刻**把 remoteId 交给上层持久化。
  //
  // 只在 runJob 收尾时才写回的话，"已提交到 ComfyUI、但还没跑完"这一整段窗口里
  // job.remoteId 都是 null：用户点取消 → cancelJob 看到为空 → 不发 /interrupt →
  // 本地显示已取消，但 ComfyUI 继续跑完，GPU 白烧且该 prompt_id 无从清理。
  if (typeof onSubmitted === 'function') {
    try { await onSubmitted(remoteId, job); } catch { /* 记录失败不阻断执行 */ }
  }

  /**
   * 进度上报（**尽力而为，绝不阻断执行**）。
   *
   * 三段：queued（已提交排队中）/ running（正在执行）/ 取回产物。
   * 不接 ComfyUI 的 websocket：那要维持长连接与重连，而我们要的信息量只有三个状态，
   * 每 3 秒一次 `/queue` 对本地 ComfyUI 是可接受成本。
   */
  let lastPhase = '';
  const reportProgress = async (pct, note, queue) => {
    if (typeof onProgress !== 'function') return;
    try { await onProgress({ pct, note, queue: queue ?? null }); } catch { /* 进度失败不影响主流程 */ }
  };

  const deadline = Date.now() + resolveComfyTimeoutMs(cfg);
  const startedAt = Date.now();
  /** 连续多少次"HTTP 层面的硬失败"（区分于网络抖动） */
  let histHardFailures = 0;

  await reportProgress(10, `已提交到 ComfyUI${progressHint ? `（${progressHint}）` : ''}`, null);

  for (;;) {
    if (Date.now() >= deadline) {
      const waitedMin = Math.round((Date.now() - startedAt) / 60000);
      throw new Error(
        `COMFY_TIMEOUT: 已等待 ${waitedMin} 分钟仍未出片（上限 ${Math.round(resolveComfyTimeoutMs(cfg) / 60000)} 分钟）。`
        + '任务可能仍在 ComfyUI 里运行 —— 可到 ComfyUI 队列查看，'
        + '或调大超时（配置 comfyTimeoutMin / 环境变量 JZ_COMFY_TIMEOUT_MIN，单位分钟）后重试。',
      );
    }
    await cancellableSleep(job, POLL_MS);     // 取消后最多 250ms 中断
    throwIfCancelled(job);

    /**
     * 先问队列再问 history。
     *
     * history 只有在**跑完**之后才有条目，单张 4.2MP 要 ~148 秒，
     * 这段时间里只看 history 的话轮询全是 `if (!entry) continue` ——
     * 对外表现就是"进度条一直不动"。`/queue` 能给出"排队第 N 位"与"正在执行"。
     */
    const qs = await queueStatus(cfg, remoteId);
    if (qs && qs.state === 'pending' && lastPhase !== 'queued') {
      lastPhase = 'queued';
      await reportProgress(15, `排队中${qs.ahead > 0 ? `（前面还有 ${qs.ahead} 个）` : ''}`, qs);
    } else if (qs && qs.state === 'running' && lastPhase !== 'running') {
      lastPhase = 'running';
      await reportProgress(35, `GPU 生成中${progressHint ? `（${progressHint}）` : ''}`, qs);
    }

    let hist;
    try {
      hist = await getJson(`${url}/history/${encodeURIComponent(remoteId)}`);
    } catch (e) {
      /**
       * 不能无条件 `continue`：ComfyUI 被 404/500 打挂或 history 返回坏 JSON 时，
       * 无限重试意味着用户要等满超时才拿到错误，而且拿到的是"超时" —— 文案还会
       * 引导用户去调大超时，方向完全相反。
       * 只对**网络类**错误继续等，HTTP 层面明确失败连续 5 次就抛真实错误。
       */
      const code = String(e?.message || '');
      const hard = /^COMFY_HTTP_(4\d\d|5\d\d)/.test(code) || code.startsWith('COMFY_BAD_JSON');
      if (hard) {
        histHardFailures += 1;
        if (histHardFailures >= 5) {
          throw new Error(`COMFY_HISTORY_FAILED: 连续 ${histHardFailures} 次读取任务状态失败 → ${code.slice(0, 300)}`);
        }
      }
      continue;
    }
    histHardFailures = 0;
    const entry = hist[remoteId];
    if (!entry) continue;

    const st = entry.status || {};
    if (st.status_str === 'error' || (st.completed === false && st.status_str === 'error')) {
      const msgs = Array.isArray(st.messages) ? st.messages : [];
      const err = msgs.find((m) => Array.isArray(m) && m[0] === 'execution_error');
      const detail = err?.[1] || {};
      throw new Error(`COMFY_EXEC_ERROR @${detail.node_type || '?'}: ${String(detail.exception_message || st.status_str).slice(0, 400)}`);
    }

    const files = [];
    for (const node of Object.values(entry.outputs || {})) {
      for (const key of ['videos', 'gifs', 'images']) {
        if (Array.isArray(node[key])) files.push(...node[key]);
      }
    }
    // 主产物优先视频；其余产物（二采/续写可能同时产出多份）**全部下载**，
// 不能只取第一个 —— `job.outputs` 只留 1 条会让多出来的产物静默消失。
    const mediaLike = files.filter((f) => f && f.filename);
    if (!mediaLike.length) throw new Error(`COMFY_NO_OUTPUT (status=${st.status_str || '?'})`);
    const primary = mediaLike.find((f) => /\.(mp4|webm|mov|gif)$/i.test(f.filename))
      || mediaLike[0];
    const ordered = [primary, ...mediaLike.filter((f) => f !== primary)];

    fs.mkdirSync(outputsDir, { recursive: true });
    await reportProgress(85, '正在取回产物', qs);
    const outputs = [];
    const downloadFailures = [];
    for (const item of ordered) {
      const q = new URLSearchParams({
        filename: item.filename,
        subfolder: item.subfolder || '',
        type: item.type || 'output',
      });
      try {
        const res = await fetch(`${url}/view?${q}`, { signal: AbortSignal.timeout(120000) });
        if (!res.ok) { downloadFailures.push(`${item.filename}: HTTP ${res.status}`); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = (path.extname(item.filename || '') || '.mp4').toLowerCase();
        // 多产物时按序号区分文件名，避免后写的覆盖先写的
        const suffix = outputs.length === 0 ? '' : `_${outputs.length + 1}`;
        const dest = path.join(outputsDir, `${job.id}${suffix}${ext}`);
        fs.writeFileSync(dest, buf);
        outputs.push({
          role: /\.(mp4|webm|mov)$/i.test(ext) ? 'video' : 'image',
          path: dest,
          // rel 是相对 dataDir 的路径，前端直接拼 /jiuzhang/api/file?path=<rel> 即可。
          rel: toRel(cfg, dest),
          bytes: buf.length,
          mime: ext === '.mp4' ? 'video/mp4' : undefined,
        });
      } catch (e) {
        downloadFailures.push(`${item.filename}: ${e.message}`);
      }
    }
    if (!outputs.length) throw new Error(`COMFY_DOWNLOAD_FAILED: ${downloadFailures.join('; ').slice(0, 400)}`);

    return {
      remoteId,
      outputs,
      warnings: downloadFailures.length
        ? [`有 ${downloadFailures.length} 个产物下载失败：${downloadFailures.join('; ').slice(0, 300)}`]
        : [],
    };
  }
  throw new Error('COMFY_TIMEOUT');
}

/** 绝对路径 → 相对 dataDir 的正斜杠路径（失败则返回空串，不抛） */
export function toRel(cfg, abs) {
  try {
    const base = path.resolve(cfg.dataDir);
    const rel = path.relative(base, path.resolve(abs));
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return '';
    return rel.split(path.sep).join('/');
  } catch { return ''; }
}

/**
 * 真取消远端任务（修复原实现"取消只停本地轮询"）。
 * ComfyUI 提供 /interrupt（中断当前执行）与 /queue（删除排队项）。
 */
export async function cancelRemote(cfg, remoteId) {
  const url = await resolveComfyUrl(cfg);
  if (!url) return;
  const errors = [];
  // 1) 从队列里删掉（还在排队的情况）
  try {
    await fetch(`${url}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: [remoteId] }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) { errors.push(`queue: ${e.message}`); }
  // 2) 中断正在执行的（已经在跑的情况）
  try {
    await fetch(`${url}/interrupt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: remoteId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) { errors.push(`interrupt: ${e.message}`); }
  if (errors.length) throw new Error(errors.join('; '));
}
