/**
 * ComfyUI 客户端 —— H3 本地生成的实际执行器。
 *
 * 与旧实现的关键差异（审查确认的缺陷）：
 *  - 取消时**真发** `/interrupt` 与 `/queue` 删除，远端不再空烧 GPU；
 *  - 首尾帧 staging 文件名带 jobId，避免多镜头互相覆盖；
 *  - 错误优先识别 ComfyUI 的 status_str=error，不再误报"没有输出文件"。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { cancellableSleep, throwIfCancelled } from './job-runner.js';

const MAX_POLL = 600;
const POLL_MS = 3000;

/**
 * 端口自动发现。
 *
 * 背景：Windows 的 Hyper-V / WSL / Docker 会**动态保留**大段 TCP 端口，
 * 被保留的端口绑定直接报 WinError 10013。而且保留范围每次重启都可能变，
 * 所以 ComfyUI 的端口**不能写死**，也不能假设上次那个还能用。
 *
 * 约定：`ai-runtime/start-h3.ps1` 启动成功后把实际端口写进 `ai-runtime/.comfy-port`。
 * 这里读它 → 插件自动跟随，用户不需要手改配置。
 *
 * 优先级：显式环境变量 > 端口文件 > 配置里的 comfyUrl
 * （显式指定就是显式指定，不该被文件覆盖）
 */
const PORT_FILE_NAMES = ['.comfy-port'];

/**
 * 候选的 ai-runtime 目录。
 *
 * 不精确计算层级（插件可能被 link 到任意位置），改为从插件根向上逐层找
 * 名为 `ai-runtime` 的兄弟目录：
 *   <plugin>/host/services → 逐层向上，每层都试 `<dir>/ai-runtime` 与 `<dir>/../ai-runtime`
 * 这样插件放在 `工作室/` 下、或直接放在工程根下，都能命中。
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

function baseUrl(cfg = loadConfig()) {
  const configured = String(cfg.comfyUrl || '').replace(/\/+$/, '');
  // 端口文件优先于配置：它反映"当前实际在跑哪个端口"
  const discovered = discoverComfyUrl();
  return discovered || configured;
}

/**
 * 拿一个**确认可达**的 ComfyUI 地址。
 *
 * 为什么需要这一步：端口文件可能是上一次运行的残留（服务已停），
 * 直接按文件去连会得到 ECONNREFUSED，而用户只会看到"ComfyUI 不可达"，
 * 根本想不到是端口文件过期。
 *
 * 顺序：候选地址逐个探 /system_stats，第一个通的就用。
 * 候选 = [端口文件, 配置里的 comfyUrl, 常见端口扫描]
 * 全部不通时返回首选地址（让错误信息指向最可能的那个）。
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
  PROBE_CACHE.url = candidates[0] || '';
  PROBE_CACHE.at = Date.now();
  return PROBE_CACHE.url;
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
 * 为什么要问 ComfyUI 而不是扫磁盘：模型目录可能通过 extra_model_paths.yaml
 * 配到别处，扫 dataDir 或猜路径都会漏。object_info 是**唯一权威**列表。
 *
 * 返回 `{ diffusion_models: [...], text_encoders: [...], vae: [...],
 *           loras: [...], model_patches: [...] }`。
 * 拿不到（ComfyUI 不可达 / 节点缺失）时返回空对象，调用方自行回退到默认名。
 */
export async function listModelFiles(cfg = loadConfig()) {
  const base = await resolveComfyUrl(cfg).catch(() => '');
  if (!base) return {};
  /**
   * 从 node schema 里取下拉选项。
   *
   * ⚠️ 两种形态都存在，必须都处理：
   *   V1 节点：[ ["a.safetensors","b.safetensors"], {tooltip} ]   ← 列表在 [0]
   *   V3 节点：[ "COMBO", {options: [...]} ]                      ← 列表在 [1].options
   * 只按后者写的话，所有 V1 节点都会返回空 —— 表现为“模型列表永远为空、
   * 静默退回默认名”，而这正是我们想避免的失败模式。
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
    // 一次请求拿全部节点信息比较重（1000+ 节点），但 object_info 已带 gzip；
    // 只要这几类，分次问具体节点更省。
    const nodes = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly', 'ModelPatchLoader'];
    const infos = await Promise.all(nodes.map(async (n) => {
      try {
        const r = await fetch(`${base}/object_info/${n}`, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) return [n, null];
        return [n, await r.json()];
      } catch { return [n, null]; }
    }));
    const map = Object.fromEntries(infos);
    return {
      diffusion_models: pick(map.UNETLoader, 'UNETLoader', 'unet_name'),
      text_encoders: pick(map.CLIPLoader, 'CLIPLoader', 'clip_name'),
      vae: pick(map.VAELoader, 'VAELoader', 'vae_name'),
      loras: pick(map.LoraLoaderModelOnly, 'LoraLoaderModelOnly', 'lora_name'),
      model_patches: pick(map.ModelPatchLoader, 'ModelPatchLoader', 'name'),
    };
  } catch {
    return {};
  }
}


/** 上传名只保留安全字符 —— ComfyUI 会把它当文件名落盘。 */
function safeStem(text) {
  return String(text).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'img';
}

/**
 * 把本地图片交给 ComfyUI，返回 `{ 占位符: ComfyUI 里的文件名 }`。
 *
 * **为什么不再只靠 cfg.comfyInputDir**（曾经的严重缺陷）：
 *   LoadImage 只认 input 目录里的文件名，所以图片必须先到那里。
 *   旧实现只在 `cfg.comfyInputDir` 非空且存在时做本地复制，否则**直接返回 {}**，
 *   于是调用方拿不到名字 → 参考图接线整段被跳过 → 提交给 ComfyUI 的工作流里
 *   根本没有图（实测：`images.image_1` / `ref_images.ref_image_1` 全缺，
 *   立绘拆解与视频参考图都退化成纯文生图）。
 *   而 `comfyInputDir` 默认就是空字符串，等于开箱即坏的静默失效。
 *
 * 现在改为优先走 ComfyUI 自己的 `POST /upload/image`：
 *   - 不依赖插件与 ComfyUI 同机同路径，也不需要用户先配置 input 目录；
 *   - 上传失败才退回本地复制（保留原有可离线路径）。
 *
 * 失败一律抛出，不再静默吞掉——静默正是这个 bug 难查的原因。
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
    const name = `${tag}_${jobId}_${safeStem(path.basename(abs, ext))}${ext}`;

    let landed = false;
    if (url) {
      try {
        const buf = fs.readFileSync(abs);
        const form = new FormData();
        form.append('image', new Blob([buf]), name);
        form.append('overwrite', 'true');
        form.append('type', 'input');
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

/** 提交工作流并轮询，返回产物 */
export async function runWorkflow({ cfg, workflow, map, job, outputsDir, onSubmitted }) {
  const wf = deepReplace(workflow, map);
  const url = await resolveComfyUrl(cfg);
  const submitted = await getJson(`${url}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: wf, client_id: job.id }),
  });
  const remoteId = submitted.prompt_id || submitted.id;
  if (!remoteId) throw new Error('COMFY_NO_PROMPT_ID');

  // ⚠️ 提交成功后**立刻**把 remoteId 交给上层持久化。
  //
  // 为什么必须这么做：job.remoteId 原先只在 runJob 成功收尾时才写回，
  // 于是"已提交到 ComfyUI、但还没跑完"这一整段窗口里，job.remoteId 都是 null。
  // 用户在这期间点取消 → cancelJob 看到 remoteId 为空 → **不会调用
  // /interrupt** → 本地显示"已取消"，但 ComfyUI 继续把这段视频跑完，
  // GPU 白烧 2 分多钟（实测复现：取消后队列里仍留着一个 running 任务，
  // 且该 prompt_id 与任何 job 都对不上，无从清理）。
  //
  // 这里通过回调上报，让 job-runner/上层在拿到 ID 的第一时间落盘。
  if (typeof onSubmitted === 'function') {
    try { await onSubmitted(remoteId, job); } catch { /* 记录失败不阻断执行 */ }
  }

  for (let i = 0; i < MAX_POLL; i++) {
    await cancellableSleep(job, POLL_MS);     // 取消后最多 250ms 中断
    throwIfCancelled(job);

    let hist;
    try {
      hist = await getJson(`${url}/history/${encodeURIComponent(remoteId)}`);
    } catch { continue; }
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
    const media = files.find((f) => /\.(mp4|webm|mov|gif)$/i.test(f?.filename || '')) || files[0];
    if (!media) throw new Error(`COMFY_NO_OUTPUT (status=${st.status_str || '?'})`);

    const q = new URLSearchParams({
      filename: media.filename,
      subfolder: media.subfolder || '',
      type: media.type || 'output',
    });
    const res = await fetch(`${url}/view?${q}`, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`COMFY_DOWNLOAD_${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (path.extname(media.filename || '') || '.mp4').toLowerCase();
    fs.mkdirSync(outputsDir, { recursive: true });
    const dest = path.join(outputsDir, `${job.id}${ext}`);
    fs.writeFileSync(dest, buf);

    return {
      remoteId,
      outputs: [{
        role: /\.(mp4|webm|mov)$/i.test(ext) ? 'video' : 'image',
        path: dest,
        // rel 是相对 dataDir 的路径，前端直接拼 /jiuzhang/api/file?path=<rel> 即可。
        // 旧实现只给绝对路径，逼前端用正则从 "…/outputs/xxx.png" 里抠 —— 换机器就废。
        rel: toRel(cfg, dest),
        bytes: buf.length,
        mime: ext === '.mp4' ? 'video/mp4' : undefined,
      }],
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
