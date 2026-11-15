/**
 * 后处理服务（ffmpeg）—— 图像/视频工具的后端。
 *
 * 覆盖画布"图像工具"里可本地完成的项：裁剪、切割、转码、提帧、抽取音频。
 * 抠图/多角度/打光等需模型能力，走 ComfyUI，不在此处。
 */
import fs from 'node:fs';
import path from 'node:path';
import { runProcess, resolveFfmpeg, resolveFfprobe } from './ffmpeg-tools.js';
import { resolveUserPath } from '../security.js';
import { loadConfig } from '../config.js';

export function createPostService({ cfg, getCfg = loadConfig }) {
  /**
   * 配置访问器。
   *
   * ⚠️ 用函数而不是直接用闭包里的 cfg：saveConfig 是**替换**缓存对象，
   *    闭包里那个 cfg 是启动时的快照。改 dataDir 之后它继续指向旧目录，
   *    而 projects/jobs 每次 loadConfig() 已切到新目录 —— 结果是
   *    "项目列表在、项目内容空"，且没有任何报错。
   *    这里每次现取，保证全进程看到同一份配置。
   */
  const C = () => (typeof getCfg === 'function' ? getCfg() : cfg);
  function outDir() {
    const d = path.join(C().dataDir, 'post');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function uniqueOut(ext) {
    return path.join(outDir(), `post_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${ext}`);
  }

  const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];
  const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.gif'];

  /** 输入是图还是视频 —— 决定输出格式与编码参数 */
  function kindOf(abs) {
    const ext = path.extname(abs).toLowerCase();
    if (IMAGE_EXT.includes(ext)) return 'image';
    if (VIDEO_EXT.includes(ext)) return 'video';
    return 'unknown';
  }

  /** 转码 / 压缩（视频） */
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

  /** 缩放：图片保持图片格式，视频保持视频格式（旧实现一律输出 .mp4） */
  async function scale({ input, width = 1280, height = -2 }) {
    const abs = resolveInput(input);
    const kind = kindOf(abs);
    if (kind === 'unknown') throw new Error(`UNSUPPORTED_FORMAT: ${path.extname(abs)}`);
    const outExt = kind === 'image'
      ? (path.extname(abs).toLowerCase() === '.jpg' ? '.jpg' : '.png')
      : '.mp4';
    const out = uniqueOut(outExt);
    const vf = `scale=${Number(width)}:${Number(height)}`;
    const args = kind === 'image'
      ? ['-y', '-i', abs, '-vf', vf, out]
      : ['-y', '-i', abs, '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy', out];
    await runProcess(resolveFfmpeg(cfg), args, 1800000);
    return result(out);
  }

  /** 抽帧（单帧 png）—— 只对视频有意义 */
  async function extractFrame({ input, timeSec = 0 }) {
    const abs = resolveInput(input);
    const kind = kindOf(abs);
    if (kind !== 'video') {
      // 旧实现直接扔给 ffmpeg，会冒出内部路径的 ENOENT，用户完全看不懂
      throw new Error(
        `NOT_A_VIDEO: 抽帧需要视频输入，当前是 ${kind === 'image' ? '图片' : path.extname(abs)}`,
      );
    }
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
   * 参考实现对应 `split` 工具（切割结果节点）。
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
          rel: path.relative(C().dataDir, out).replace(/\\/g, '/'),
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

    // ⚠️ color / x / y / fontSize 也必须校验：它们是直接拼进 ffmpeg
    //    filtergraph 的，未校验等于允许注入任意滤镜链。
    //    历史实现只转义了 text，color 原样拼接（实测传
    //    `red':x=0:y=0,drawtext=text='pwned` 能破坏语法并追加滤镜）。
    const FONTCOLOR_RE = /^(#?[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}(@[0-9.]+)?)$/;
    const safeColor = FONTCOLOR_RE.test(String(color)) ? String(color) : 'white';

    const clampNum = (v, lo, hi, dflt) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return dflt;
      return Math.min(hi, Math.max(lo, n));
    };
    const safeX = Math.round(clampNum(x, -10000, 10000, 16));
    const safeY = Math.round(clampNum(y, -10000, 10000, 16));
    const safeSize = Math.round(clampNum(fontSize, 6, 500, 28));

    // 字体路径：冒号转义 + 单引号包裹（这是 ffmpeg 在 Windows 上的正确写法）
    let fontArg = '';
    const chosen = fontFile && fs.existsSync(fontFile) ? fontFile : defaultFontFile();
    if (chosen && fs.existsSync(chosen)) {
      const p = chosen.replace(/\\/g, '/').replace(/:/g, '\\:');
      fontArg = `:fontfile='${p}'`;
    }

    const vf = `drawtext=text='${escText}':x=${safeX}:y=${safeY}:fontsize=${safeSize}:fontcolor=${safeColor}${fontArg}`;

    const args = ['-y', '-i', abs, '-vf', vf];
    if (ext === '.mp4') args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy');
    else args.push('-frames:v', '1');
    args.push(out);
    await runProcess(ffmpeg, args, 300000);
    return { ...result(out), fontFile: chosen || null };
  }

  /**
   * 默认中文字体。
   *
   * 用系统字体目录 + 环境变量覆盖，不硬编码盘符 —— 换机器/换平台仍可用。
   * 可用 DSH_POST_FONT 显式指定。
   */
  function defaultFontFile() {
    const names = [
      'msyh.ttc', 'msyhbd.ttc', 'simhei.ttf', 'simsun.ttc',       // Windows
      'PingFang.ttc', 'Hiragino Sans GB.ttc',                      // macOS
      'NotoSansCJK-Regular.ttc', 'wqy-zenhei.ttc',                 // Linux
    ];
    const dirs = [];
    if (process.env.DSH_POST_FONT && fs.existsSync(process.env.DSH_POST_FONT)) return process.env.DSH_POST_FONT;
    if (process.env.SystemRoot) dirs.push(path.join(process.env.SystemRoot, 'Fonts'));
    if (process.env.WINDIR) dirs.push(path.join(process.env.WINDIR, 'Fonts'));
    dirs.push('/System/Library/Fonts', '/Library/Fonts', '/usr/share/fonts', '/usr/share/fonts/truetype');
    for (const d of dirs) {
      for (const n of names) {
        const p = path.join(d, n);
        try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
      }
    }
    return null;
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

  /**
   * 解析后处理输入路径。
   *
   * ⚠️ 历史缺陷：绝对路径**直接放行**（`if (path.isAbsolute(s)) return s`），
   *    于是 /post/qc 可以对任意文件返回 size/format（信息泄露），
   *    transcode / annotate 可以对任意文件跑 ffmpeg。
   *    现在统一走 resolveUserPath，绝对路径也必须在 dataDir 内。
   */
  function resolveInput(input) {
    try {
      return resolveUserPath({ root: C().dataDir, input, mustExist: true });
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg === 'NOT_FOUND') throw new Error('FILE_NOT_FOUND');
      throw e;
    }
  }

  function result(out) {
    const bytes = fs.statSync(out).size;
    return { ok: true, path: out, rel: path.relative(C().dataDir, out).replace(/\\/g, '/'), bytes };
  }

  return { transcode, scale, extractFrame, crop, extractAudio, split, annotate, qc, resolveInput };
}
