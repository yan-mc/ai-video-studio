/**
 * 后处理服务（ffmpeg）—— 图像/视频工具的后端。
 *
 * 覆盖画布"图像工具"里可本地完成的项：裁剪、切割、转码、提帧、抽取音频。
 * 抠图/多角度/打光等需模型能力，走 ComfyUI，不在此处。
 */
import fs from 'node:fs';
import path from 'node:path';
import { runProcess, resolveFfmpeg, resolveFfprobe } from './seedance-client.js';
import { safeJoin } from '../security.js';

export function createPostService({ cfg }) {
  function outDir() {
    const d = path.join(cfg.dataDir, 'post');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function uniqueOut(ext) {
    return path.join(outDir(), `post_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${ext}`);
  }

  /** 转码 / 压缩 */
  async function transcode({ input, crf = 23, preset = 'veryfast', videoCodec = 'libx264', audioCodec = 'aac', audioBitrate = '128k' }) {
    const abs = resolveInput(input);
    const out = uniqueOut('.mp4');
    await runProcess(resolveFfmpeg(cfg), [
      '-y', '-i', abs,
      '-c:v', videoCodec, '-crf', String(crf), '-preset', preset, '-pix_fmt', 'yuv420p',
      '-c:a', audioCodec, '-b:a', audioBitrate,
      out,
    ], 1800000);
    return result(out);
  }

  /** 缩放 */
  async function scale({ input, width = 1280, height = -2 }) {
    const abs = resolveInput(input);
    const out = uniqueOut('.mp4');
    await runProcess(resolveFfmpeg(cfg), [
      '-y', '-i', abs, '-vf', `scale=${Number(width)}:${Number(height)}`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy', out,
    ], 1800000);
    return result(out);
  }

  /** 抽帧（单帧 png） */
  async function extractFrame({ input, timeSec = 0 }) {
    const abs = resolveInput(input);
    const out = uniqueOut('.png');
    await runProcess(resolveFfmpeg(cfg), [
      '-y', '-ss', String(Number(timeSec) || 0), '-i', abs, '-frames:v', '1', out,
    ], 120000);
    return result(out);
  }

  /** 裁剪（图片或视频按矩形裁） */
  async function crop({ input, x = 0, y = 0, width, height }) {
    const abs = resolveInput(input);
    const ext = path.extname(abs).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'].includes(ext);
    if (!isImage && !['.mp4', '.webm', '.mov', '.gif'].includes(ext)) {
      throw new Error(`UNSUPPORTED_FORMAT: ${ext}`);
    }
    const w = Number(width);
    const h = Number(height);
    if (!w || !h) throw new Error('CROP_SIZE_REQUIRED');
    const out = uniqueOut(isImage ? ext : '.mp4');
    const args = ['-y', '-i', abs, '-vf', `crop=${Math.round(w)}:${Math.round(h)}:${Math.round(Number(x))}:${Math.round(Number(y))}`];
    if (isImage) args.push('-frames:v', '1');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy');
    args.push(out);
    await runProcess(resolveFfmpeg(cfg), args, 600000);
    return result(out);
  }

  /** 抽取音频 */
  async function extractAudio({ input }) {
    const abs = resolveInput(input);
    const out = uniqueOut('.m4a');
    await runProcess(resolveFfmpeg(cfg), ['-y', '-i', abs, '-vn', '-c:a', 'aac', '-b:a', '128k', out], 600000);
    return result(out);
  }

  /** 质检（ffprobe） */
  async function qc(input) {
    const abs = resolveInput(input);
    if (!fs.existsSync(abs)) throw new Error('FILE_NOT_FOUND');
    const ffprobe = resolveFfprobe(cfg);
    const r = await runProcess(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration,size,format_name',
      '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels',
      '-of', 'json', abs,
    ], 60000);
    let parsed = null;
    try { parsed = JSON.parse(r.stdout || '{}'); } catch { /* ignore */ }
    return { ok: true, path: abs, size: fs.statSync(abs).size, probe: parsed };
  }

  function resolveInput(input) {
    const s = String(input || '');
    if (!s) throw new Error('INPUT_REQUIRED');
    if (path.isAbsolute(s)) {
      if (!fs.existsSync(s)) throw new Error('FILE_NOT_FOUND');
      return s;
    }
    const abs = safeJoin(cfg.dataDir, s);
    if (!fs.existsSync(abs)) throw new Error('FILE_NOT_FOUND');
    return abs;
  }

  function result(out) {
    const bytes = fs.statSync(out).size;
    return { ok: true, path: out, rel: path.relative(cfg.dataDir, out).replace(/\\/g, '/'), bytes };
  }

  return { transcode, scale, extractFrame, crop, extractAudio, qc, resolveInput };
}