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
import { toRel } from './comfy-client.js';

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
  return { outputs: [{ role: 'video', path: dest, rel: toRel(cfg, dest), bytes: buf.length, mime: 'video/mp4' }], remoteId: null };
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
  return { outputs: [{ role: 'video', path: dest, rel: toRel(cfg, dest), bytes, mime: 'video/mp4' }], remoteId: null };
}

/**
 * 解析内置 ffmpeg 工具目录的候选位置。
 *
 * 为什么需要：`cfg.ffmpegDir` 可能为空（比如测试传入 `{}`、或用户没配），
 * 这时旧实现直接回退到裸名 `'ffmpeg'`，而 PATH 里通常没有 → 全部失败。
 * 从插件自身位置向上找 `tools/ffmpeg`，配置缺失时也能用。
 */
function bundledFfmpegDirs() {
  const dirs = [];
  try {
    let dir = import.meta.dirname;   // <plugin>/host/services
    for (let i = 0; i < 6; i += 1) {
      const base = path.join(dir, 'tools', 'ffmpeg');
      // 内置工具有两种布局：<root>/bin/ffmpeg.exe 或 <root>/ffmpeg.exe
      dirs.push(path.join(base, 'bin'));
      dirs.push(base);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* ignore */ }
  return dirs;
}

function resolveTool(cfg, baseName) {
  const exe = process.platform === 'win32' ? `${baseName}.exe` : baseName;

  // 1) 环境变量最优先 —— 单独 clone 插件时没有内置 tools，靠这个指定
  const envDir = process.env.DSH_FFMPEG_DIR || process.env.FFMPEG_DIR || '';
  const dirs = [];
  if (envDir) {
    dirs.push(path.join(envDir, 'bin'));
    dirs.push(envDir);
  }

  // 2) 插件配置
  if (cfg?.ffmpegDir) {
    dirs.push(path.join(cfg.ffmpegDir, 'bin'));
    dirs.push(cfg.ffmpegDir);
  }

  // 3) 插件自身位置向上找内置 tools/ffmpeg
  dirs.push(...bundledFfmpegDirs());

  for (const d of dirs) {
    const p = path.join(d, exe);
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return baseName;   // 最后才退回 PATH
}

export function resolveFfmpeg(cfg = loadConfig()) {
  return resolveTool(cfg, 'ffmpeg');
}

export function resolveFfprobe(cfg = loadConfig()) {
  return resolveTool(cfg, 'ffprobe');
}

export function runProcess(exe, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    let stdout = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error(`PROCESS_TIMEOUT: ${exe}`));
    }, timeoutMs);
    // ffprobe 的 JSON 走 stdout，必须一并收集（否则 QC 解析不到）
    child.stdout.on('data', (d) => { stdout += d.toString(); if (stdout.length > 4 * 1024 * 1024) stdout = stdout.slice(-4 * 1024 * 1024); });
    child.stderr.on('data', (d) => { stderr += d.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`PROCESS_SPAWN_FAILED: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`PROCESS_EXIT_${code}: ${(stderr || stdout).slice(-800)}`));
    });
  });
}