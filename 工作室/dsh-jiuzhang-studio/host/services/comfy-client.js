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

function baseUrl(cfg = loadConfig()) {
  return String(cfg.comfyUrl || '').replace(/\/+$/, '');
}

async function getJson(url, opts) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`COMFY_HTTP_${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error(`COMFY_BAD_JSON: ${text.slice(0, 200)}`); }
}

/** 健康检查 */
export async function health(cfg = loadConfig()) {
  const url = baseUrl(cfg);
  if (!url) return { ok: false, detail: '未配置 comfyUrl' };
  try {
    const res = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(2500) });
    return { ok: res.ok, detail: `ComfyUI ${res.status}`, url };
  } catch (e) {
    return { ok: false, detail: `不可达（${e.message}）`, url };
  }
}

/**
 * 把预演产物复制进 ComfyUI 的 input 目录。
 * 文件名带 jobId → 多镜头并发不会互相覆盖（修复 H5）。
 */
export function stageToComfyInput(cfg, absPaths, jobId) {
  const out = {};
  const dir = cfg.comfyInputDir;
  if (!dir || !fs.existsSync(dir)) return out;
  const tag = 'jzpreviz';
  for (const [key, abs] of Object.entries(absPaths || {})) {
    if (!abs || !fs.existsSync(abs)) continue;
    try {
      const ext = path.extname(abs) || '.png';
      const stem = path.basename(abs, ext);
      const name = `${tag}_${jobId}_${stem}${ext}`;
      const dst = path.join(dir, name);
      fs.copyFileSync(abs, dst);
      out[key] = name;             // ComfyUI 的 LoadImage 只认 input 目录内的文件名
    } catch { /* 单文件失败不阻断 */ }
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
export async function runWorkflow({ cfg, workflow, map, job, outputsDir }) {
  const wf = deepReplace(workflow, map);
  const url = baseUrl(cfg);
  const submitted = await getJson(`${url}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: wf, client_id: job.id }),
  });
  const remoteId = submitted.prompt_id || submitted.id;
  if (!remoteId) throw new Error('COMFY_NO_PROMPT_ID');

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
        bytes: buf.length,
        mime: ext === '.mp4' ? 'video/mp4' : undefined,
      }],
    };
  }
  throw new Error('COMFY_TIMEOUT');
}

/**
 * 真取消远端任务（修复原实现"取消只停本地轮询"）。
 * ComfyUI 提供 /interrupt（中断当前执行）与 /queue（删除排队项）。
 */
export async function cancelRemote(cfg, remoteId) {
  const url = baseUrl(cfg);
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