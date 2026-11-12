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

  /**
   * 切割分镜：把一张图按 rows×cols 切成多张。
   * 洛书对应 `split` 工具（切割结果节点）。
   * @returns {Promise<{ok:boolean, files:{path:string,rel:string,bytes:number,index:number}[]}>}
   */
  async function split({ input, rows = 2, cols = 2 }) {
    const abs = resolveInput(input);
    const r = Math.max(1, Math.min(10, Number(rows) || 2));
    const c = Math.max(1, Math.min(10, Number(cols) || 2));
    const ffprobe = resolveFfprobe(cfg);
    // 取原图尺寸
    const probe = await runProcess(ffprobe, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs,
    ], 30000);
    const [w, h] = String(probe.stdout || '').trim().split(',').map(Number);
    if (!w || !h) throw new Error('SPLIT_PROBE_FAILED: 无法读取图片尺寸');

    const cellW = Math.floor(w / c);
    const cellH = Math.floor(h / r);
    if (cellW < 8 || cellH < 8) throw new Error('SPLIT_TOO_SMALL: 格子尺寸过小');

    const ext = path.extname(abs).toLowerCase() || '.png';
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const files = [];
    const ffmpeg = resolveFfmpeg(cfg);
    let index = 0;
    for (let ry = 0; ry < r; ry++) {
      for (let cx = 0; cx < c; cx++) {
        const out = path.join(outDir(), `split_${stamp}_${index}${ext}`);
        await runProcess(ffmpeg, [
          '-y', '-i', abs,
          '-vf', `crop=${cellW}:${cellH}:${cx * cellW}:${ry * cellH}`,
          '-frames:v', '1', out,
        ], 120000);
        files.push({
          index,
          row: ry, col: cx,
          path: out,
          rel: path.relative(cfg.dataDir, out).replace(/\\/g, '/'),
          bytes: fs.statSync(out).size,
        });
        index += 1;
      }
    }
    return { ok: true, rows: r, cols: c, cellWidth: cellW, cellHeight: cellH, files };
  }

  /**
   * 标注：目前支持 ffmpeg drawtext（文字水印/标注）。
   * 图形标注（画笔/箭头）需前端 Canvas 完成后再上传，这里只做服务端文字合成。
   *
   * ⚠️ 中文必须显式给 fontfile，否则渲染成方块（实测验证）。
   * ffmpeg 的 fontfile 需要把路径里的 ':' 转成 '\:' 并用单引号包住，
   * 形如 fontfile='C\:/Windows/Fonts/msyh.ttc'。
   */
  async function annotate({ input, text = '', fontSize = 28, color = 'white', x = 16, y = 16, fontFile }) {
    const abs = resolveInput(input);
    if (!text) throw new Error('ANNOTATE_TEXT_REQUIRED');
    const ffmpeg = resolveFfmpeg(cfg);
    const ext = path.extname(abs).toLowerCase() || '.png';
    const out = uniqueOut(ext === '.mp4' ? '.mp4' : ext);

    // 文字里的冒号/单引号/反斜杠要转义，否则会破坏 filter 语法
    const escText = String(text)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:');

    // 字体路径：冒号转义 + 单引号包裹（这是 ffmpeg 在 Windows 上的正确写法）
    let fontArg = '';
    const chosen = fontFile && fs.existsSync(fontFile) ? fontFile : defaultFontFile();
    if (chosen && fs.existsSync(chosen)) {
      const p = chosen.replace(/\\/g, '/').replace(/:/g, '\\:');
      fontArg = `:fontfile='${p}'`;
    }

    const vf = `drawtext=text='${escText}':x=${Number(x)}:y=${Number(y)}:fontsize=${Number(fontSize)}:fontcolor=${color}${fontArg}`;

    const args = ['-y', '-i', abs, '-vf', vf];
    if (ext === '.mp4') args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy');
    else args.push('-frames:v', '1');
    args.push(out);
    await runProcess(ffmpeg, args, 300000);
    return { ...result(out), fontFile: chosen || null };
  }

  /** 默认中文字体（Windows 自带的微软雅黑） */
  function defaultFontFile() {
    const candidates = [
      'C:/Windows/Fonts/msyh.ttc',
      'C:/Windows/Fonts/msyhbd.ttc',
      'C:/Windows/Fonts/simhei.ttf',
      'C:/Windows/Fonts/simsun.ttc',
    ];
    return candidates.find((f) => fs.existsSync(f)) ?? null;
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

  return { transcode, scale, extractFrame, crop, extractAudio, split, annotate, qc, resolveInput };
}
