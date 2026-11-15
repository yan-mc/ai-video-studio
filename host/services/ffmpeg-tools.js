/**
 * ffmpeg / ffprobe 工具解析与进程运行。
 *
 * 从 seedance-client.js 拆出：工具解析是被 h3-workshop / media-probe / post /
 * api 共用的基础设施，不该寄生在某个云客户端模块里。
 *
 * 解析顺序（与运行时一致）：
 *   1) 环境变量 DSH_FFMPEG_DIR / FFMPEG_DIR
 *   2) 插件配置 cfg.ffmpegDir
 *   3) 插件自身位置向上找 tools/ffmpeg
 *   4) PATH（裸名回退）
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config.js';

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
