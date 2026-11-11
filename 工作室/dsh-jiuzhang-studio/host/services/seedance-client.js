/**
 * Seedance（火山方舟）客户端。
 *
 * 用户当前没有 Seedance API key → seedanceMock 默认 true，
 * 走本地 Mock 保证 UI/流程全可测；填了 key 即自动切真实通道。
 *
 * 接口层与 H3 完全一致，便于在画布节点里一键切换后端。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config.js';
import { cancellableSleep, throwIfCancelled } from './job-runner.js';

const POLL_MS = 10000;
const MAX_POLL = 120;

function headers(cfg) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.seedanceApiKey}`,
  };
}

export function isAvailable(cfg = loadConfig()) {
  return Boolean(cfg.seedanceApiKey) && cfg.seedanceMock !== true;
}

/** Seedance 只支持固定档位（与本地 H3 的画布表不同） */
export const SEEDANCE_RESOLUTIONS = Object.freeze({
  '16:9': [[1280, 720], [1920, 1080], [864, 480]],
  '9:16': [[720, 1280], [1080, 1920], [480, 864]],
  '1:1': [[1024, 1024]],
  '4:3': [[1152, 864]],
  '21:9': [[1680, 720]],
});

export function seedanceResolution(ratio = '16:9', preference = 0) {
  const list = SEEDANCE_RESOLUTIONS[ratio] || SEEDANCE_RESOLUTIONS['16:9'];
  const [w, h] = list[Math.min(preference, list.length - 1)];
  return { width: w, height: h };
}

/**
 * 真实提交：POST {endpoint}  →  task id，然后轮询状态。
 * endpoint 默认为方舟 contents/generations/tasks。
 */
export async function runSeedance({ cfg, job, shot, prompt }) {
  if (!isAvailable(cfg)) return runMock({ cfg, job, shot, prompt });

  const res = await fetch(cfg.seedanceEndpoint, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({
      model: cfg.seedanceModel || 'doubao-seedance-2-0',
      content: [{ type: 'text', text: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SEEDANCE_SUBMIT_${res.status}: ${text.slice(0, 300)}`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`SEEDANCE_BAD_JSON: ${text.slice(0, 200)}`); }
  const taskId = data.id || data.task_id || data.data?.id;
  if (!taskId) throw new Error('SEEDANCE_NO_TASK_ID');

  for (let i = 0; i < MAX_POLL; i++) {
    await cancellableSleep(job, POLL_MS);
    throwIfCancelled(job);
    const q = await fetch(`${cfg.seedanceEndpoint}/${encodeURIComponent(taskId)}`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(30000),
    });
    if (!q.ok) continue;
    const info = await q.json();
    const status = String(info.status || info.data?.status || '').toLowerCase();
    if (['failed', 'expired', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(`SEEDANCE_${status.toUpperCase()}: ${JSON.stringify(info.error || info).slice(0, 300)}`);
    }
    if (status === 'succeeded' || status === 'succeed' || status === 'completed') {
      const url = info.content?.video_url || info.data?.content?.video_url
        || info.output?.video_url || info.result?.video_url;
      if (!url) throw new Error('SEEDANCE_NO_VIDEO_URL');
      return download({ cfg, job, url });
    }
  }
  throw new Error('SEEDANCE_TIMEOUT');
}

async function download({ cfg, job, url }) {
  const res = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`SEEDANCE_DOWNLOAD_${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = path.join(cfg.dataDir, 'outputs');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${job.id}.mp4`);
  fs.writeFileSync(dest, buf);
  return { outputs: [{ role: 'video', path: dest, bytes: buf.length, mime: 'video/mp4' }], remoteId: null };
}

/**
 * Mock 后端：用便携 ffmpeg 生成占位视频，保证无 key 时全流程可测。
 * 与真实链路返回结构一致（outputs[{role,path}]）。
 */
export async function runMock({ cfg, job, shot, prompt }) {
  const dur = Math.max(1, Math.min(15, Number(shot?.durationSec) || 5));
  const dir = path.join(cfg.dataDir, 'outputs');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${job.id}.mp4`);
  const ffmpeg = resolveFfmpeg(cfg);

  const text = String(prompt || 'mock').slice(0, 40).replace(/[:\\/']/g, ' ');
  const args = [
    '-y', '-f', 'lavfi',
    '-i', `color=c=0x101418:s=960x540:d=${dur},drawtext=text='${text}':fontcolor=0xE8E4DC:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2`,
    '-f', 'lavfi', '-i', `anullsrc=r=32000:cl=stereo`,
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '32k',
    '-shortest', dest,
  ];
  await runProcess(ffmpeg, args, 120000);
  const bytes = fs.statSync(dest).size;
  return { outputs: [{ role: 'video', path: dest, bytes, mime: 'video/mp4' }], remoteId: null };
}

export function resolveFfmpeg(cfg = loadConfig()) {
  const candidates = [
    cfg.ffmpegDir ? path.join(cfg.ffmpegDir, 'bin', 'ffmpeg.exe') : null,
    cfg.ffmpegDir ? path.join(cfg.ffmpegDir, 'ffmpeg.exe') : null,
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'ffmpeg';          // 退回 PATH
}

export function resolveFfprobe(cfg = loadConfig()) {
  const candidates = [
    cfg.ffmpegDir ? path.join(cfg.ffmpegDir, 'bin', 'ffprobe.exe') : null,
    cfg.ffmpegDir ? path.join(cfg.ffmpegDir, 'ffprobe.exe') : null,
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'ffprobe';
}

export function runProcess(exe, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error(`PROCESS_TIMEOUT: ${exe}`));
    }, timeoutMs);
    child.stderr.on('data', (d) => { stderr += d.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`PROCESS_SPAWN_FAILED: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ code, stderr });
      else reject(new Error(`PROCESS_EXIT_${code}: ${stderr.slice(-800)}`));
    });
  });
}