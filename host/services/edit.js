/**
 * 视频剪辑服务 —— 裁切 / 拼接 / 音轨。
 *
 * ============================================================================
 * 职责边界（为什么这里不做时间轴）
 * ============================================================================
 *
 * 「剪辑」在本插件里被定义为**面向成片的三件事**：
 *   1) 裁切：从一段视频里取出一段（掐头 / 掐尾 / 抠中间）
 *   2) 拼接：把多段按给定顺序接成一条（可带转场）
 *   3) 音轨：剥原声 / 换 BGM / 调音量 / 与原声混音
 *
 * 刻意**不做**多轨时间轴 UI 与逐帧预览。理由：
 *   · 本机已有原生 ffmpeg 9.0.2，处理 GB 级 H3 产出毫无压力；
 *     而浏览器编辑器（WebCodecs + ffmpeg.wasm）要把整个文件读进内存，
 *     H3 的 1–2 GB mp4 在里面必然 OOM。
 *   · 本插件真正的上游是 H3 生成，产出天然就是**顺序片段**，
 *     不是需要自由编排的素材堆。给顺序片段配一条时间轴是过度设计。
 *
 * 所以工程模型是一个**有序片段列表**（clip list），不是自由轨道。
 * 编辑操作全部落成 ffmpeg 命令，前端只负责排序、裁点、音轨选择。
 *
 * ============================================================================
 * 安全
 * ============================================================================
 * 所有输入路径走 resolveUserPath，绝对路径也必须在 dataDir 之内。
 * 这条约束是为了堵住 `POST /edit/render {"inputs":["F:/任意/文件"]}` 能让
 * ffmpeg 读机器上任意文件的口子 —— 与 film/render 同样的历史缺陷。
 */
import fs from 'node:fs';
import path from 'node:path';
import { runProcess, resolveFfmpeg, resolveFfprobe } from './ffmpeg-tools.js';
import { resolveUserPath, safeId } from '../security.js';
import { loadConfig } from '../config.js';

/** 视频扩展名 —— 只认这些，避免把任意文件塞给 ffmpeg */
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);
/** 音频扩展名 */
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']);

/** 工程 id 的允许形态 */
const EDIT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createEditService({ cfg, getCfg = loadConfig }) {
  /**
   * 配置访问器。
   *
   * ⚠️ 与 post.js 同一个理由：saveConfig 是**替换**缓存对象，闭包里的 cfg
   * 是启动时快照。改 dataDir 之后它继续指向旧目录，于是"工程列表在、
   * 内容读到空"。每次现取才能保证全进程看到同一份配置。
   */
  const C = () => (typeof getCfg === 'function' ? getCfg() : cfg);

  function editDir() {
    const d = path.join(C().dataDir, 'edit');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function outDir() {
    const d = path.join(C().dataDir, 'edit', 'outputs');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function projectFile(id) {
    return path.join(editDir(), `${safeId(id, EDIT_ID)}.json`);
  }

  function result(out) {
    const bytes = fs.statSync(out).size;
    return {
      ok: true,
      path: out,
      rel: path.relative(C().dataDir, out).replace(/\\/g, '/'),
      bytes,
    };
  }

  /**
   * 解析输入媒体路径。
   *
   * 与 post.js 的 resolveInput 同一语义：绝对路径也必须在 dataDir 内。
   * 错误信息统一成 FILE_NOT_FOUND，不要把 FORBIDDEN_PATH 直接抛给用户
   * （那是在告诉他"路径存在但我不让读"，会诱导他去猜目录结构）。
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

  /**
   * 台词时间轴探测 —— 一个视频的时长/分辨率/音轨，供前端画剪辑点。
   *
   * 为什么不用既有 media-probe：那个是给素材库做归档用的宽松 probe，
   * 这里是剪辑页每次选中片段都要调，需要**稳定的字段形状**（前端直接绑）。
   * 字段缺失一律给 null，不要给 undefined —— 前端 `x.toFixed()` 会炸。
   */
  async function probe(input) {
    const abs = resolveInput(input);
    const ffprobe = resolveFfprobe(C());
    const { stdout } = await runProcess(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration,size,format_name',
      '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels',
      '-of', 'json', abs,
    ], 60000);

    let j = {};
    try { j = JSON.parse(stdout || '{}'); } catch { /* 保持空对象，下面全给 null */ }
    const streams = Array.isArray(j.streams) ? j.streams : [];
    const v = streams.find((s) => s.codec_type === 'video');
    const a = streams.find((s) => s.codec_type === 'audio');

    return {
      ok: true,
      path: abs,
      rel: path.relative(C().dataDir, abs).replace(/\\/g, '/'),
      durationSec: numOrNull(j?.format?.duration),
      bytes: numOrNull(j?.format?.size) ?? fs.statSync(abs).size,
      format: j?.format?.format_name ?? null,
      video: v ? {
        codec: v.codec_name ?? null,
        width: numOrNull(v.width),
        height: numOrNull(v.height),
        fps: parseRate(v.r_frame_rate),
        frames: numOrNull(v.nb_frames),
      } : null,
      audio: a ? {
        codec: a.codec_name ?? null,
        sampleRate: numOrNull(a.sample_rate),
        channels: numOrNull(a.channels),
      } : null,
      hasAudio: Boolean(a),
    };
  }

  /* ------------------------------------------------------------- 裁切 */

  /**
   * 裁切：从一段视频取出 [start, end) 区间。
   *
   * 关键：`-ss` 放在 `-i` **之前**（输入端 seek），比放在后面快一个数量级 ——
   * 放在后面要解码到该时间点，放在前面直接跳到关键帧。
   *
   * 但输入端 seek 会**吸附到前一个关键帧**，导致起点不准（可能差 1–2 秒）。
   * 所以这里用「输入端粗 seek + 输出端精确 trim」的混合写法：
   *   -ss <start-2s> -i <input> -ss 2 -to <duration> ...
   * 只有当 start < 2s 时才退化为纯输出端 seek。
   *
   * 用 -c copy 还是重编码：copy 快但剪辑点必然落在关键帧上，接缝会跳。
   * 这里默认重编码（H3 产出通常只有几秒到几十秒，重编码代价可接受），
   * 但提供 copy 选项给"只要快、不介意接缝"的场景。
   */
  async function trim({ input, startSec = 0, endSec = null, reencode = true }) {
    const abs = resolveInput(input);
    const info = await probe(abs);
    const total = info.durationSec;
    if (!total || total <= 0) throw new Error('DURATION_UNKNOWN: 读不到时长，无法裁切');

    let start = Math.max(0, Number(startSec) || 0);
    let end = endSec == null || endSec === '' ? total : Number(endSec);
    if (!Number.isFinite(end)) end = total;
    // 夹到片长范围内：end 超长会导致 ffmpeg 静默产出比预期短的片
    end = Math.min(end, total);
    if (end - start < 0.05) throw new Error('EMPTY_RANGE: 起止点重合或区间过短');
    start = Math.min(start, end - 0.05);

    const duration = end - start;
    const out = path.join(outDir(), `trim_${stamp()}${reencode ? '.mp4' : extOf(abs)}`);

    const ffmpeg = resolveFfmpeg(C());
    const args = ['-y'];

    /**
     * 输入端 seek 的代价：会吸附到前一个关键帧。
     * 先粗跳到 start-2s（保证落在目标之前的某个关键帧），
     * 再用输出端 -ss 精确到剩下的 2s。
     */
    const COARSE = 2;
    if (start > COARSE) {
      args.push('-ss', fmt(start - COARSE));
      args.push('-i', abs);
      args.push('-ss', fmt(COARSE));
    } else {
      args.push('-i', abs);
      args.push('-ss', fmt(start));
    }
    args.push('-t', fmt(duration));

    if (reencode) {
      args.push(
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
      );
    } else {
      args.push('-c', 'copy');
    }
    args.push(out);

    await runProcess(ffmpeg, args, 1800000);
    return { ...result(out), startSec: round3(start), endSec: round3(end), durationSec: round3(duration) };
  }

  /* ------------------------------------------------------------- 拼接 */

  /**
   * 拼接：把多段按给定顺序接成一条。
   *
   * 两种实现路径，**必须自动选**，不能只给一种：
   *
   *  · 流复制（-c copy）：秒级完成、无画质损失。但要求所有片段的
   *    编码/分辨率/帧率/像素格式**完全一致**，否则会出花屏或时长错乱。
   *
   *  · 滤镜拼接（concat filter）：任何片段都能接，但必须重编码。
   *
   * 判定方式：先 probe 全部片段，参数全同 → copy；只要有一项不同 → filter。
   * 历史教训：film/render 只实现了 copy 路径，接不同来源的片段时静默产出
   * 坏片，用户看到的是"拼完花屏"，而不是一条可读的错误。
   */
  async function concat({ inputs, reencode = null, transitionSec = 0 }) {
    const list = Array.isArray(inputs) ? inputs.filter(Boolean) : [];
    if (list.length === 0) throw new Error('NO_INPUTS');
    if (list.length === 1) {
      // 单片段拼接退化成复制，别让用户以为出错了
      return trim({ input: list[0], startSec: 0, endSec: null, reencode: true });
    }

    const absPaths = list.map((p) => resolveInput(p));
    const infos = [];
    for (const p of absPaths) infos.push(await probe(p));

    /**
     * 转场（xfade）只能走滤镜路径，且要求每段都有确定时长。
     * 请求了转场就强制重编码 —— copy 路径根本表达不了 xfade。
     */
    const useTransition = Number(transitionSec) > 0;
    /**
     * 三条判定，优先级从高到低：
     *  1) 要转场 → 必然重编码（copy 路径表达不了 xfade）
     *  2) 调用方显式要求（reencode === true / false）→ 听调用方
     *  3) 默认 → 形状一致才敢走 copy
     */
    const doReencode = useTransition
      ? true
      : (reencode === false ? false : (reencode === true ? true : !sameShape(infos)));

    const out = path.join(outDir(), `concat_${stamp()}.mp4`);
    const ffmpeg = resolveFfmpeg(C());

    if (!doReencode) {
      // ---- 流复制路径 ----
      const listFile = path.join(outDir(), `cc_${stamp()}.txt`);
      const lines = absPaths.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
      fs.writeFileSync(listFile, lines.join('\n'), 'utf8');
      try {
        await runProcess(ffmpeg, [
          '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
          '-c', 'copy', '-movflags', '+faststart', out,
        ], 3600000);
      } finally {
        try { fs.unlinkSync(listFile); } catch { /* ignore */ }
      }
      return { ...result(out), mode: 'copy', segments: absPaths.length, transitionSec: 0 };
    }

    // ---- 滤镜路径 ----
    const args = ['-y'];
    for (const p of absPaths) args.push('-i', p);

    if (useTransition) {
      await runConcatWithTransition({ ffmpeg, absPaths, infos, transitionSec, out, args });
    } else {
      /**
       * 纯 filter concat：每段先统一到同一套参数（scale/pad/fps/sar），
       * 否则哪怕分辨率差 2px 都会直接失败。
       */
      const target = firstVideoShape(infos);
      const parts = [];
      const concatInputs = [];
      absPaths.forEach((_, i) => {
        const hasAudio = infos[i]?.hasAudio;
        parts.push(`[${i}:v]` + normalizeChain(target) + `[v${i}]`);
        if (hasAudio) {
          parts.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
        } else {
          // 没有音轨的片段要补一段静音，否则 concat 的 n= 计数对不上
          parts.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${fmt(infos[i]?.durationSec || 1)}[a${i}]`);
        }
        concatInputs.push(`[v${i}][a${i}]`);
      });
      parts.push(`${concatInputs.join('')}concat=n=${absPaths.length}:v=1:a=1[vout][aout]`);
      args.push('-filter_complex', parts.join(';'));
      args.push('-map', '[vout]', '-map', '[aout]');
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
      args.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out);
      await runProcess(ffmpeg, args, 3600000);
    }

    return { ...result(out), mode: 'filter', segments: absPaths.length, transitionSec: useTransition ? Number(transitionSec) : 0 };
  }

  /**
   * 带转场的滤镜拼接。
   *
   * xfade 的 offset 语义：第 i 个 xfade 的 offset 是「前 i 段累计时长减去
   * 已消耗的重叠」。算错就会得到黑帧或者总时长不对，这是 xfade 最常见的坑，
   * 所以这里显式维护 running 累计值。
   */
  async function runConcatWithTransition({ ffmpeg, absPaths, infos, transitionSec, out, args }) {
    const durs = infos.map((x) => Number(x?.durationSec) || 0);
    if (durs.some((d) => d <= 0)) throw new Error('DURATION_UNKNOWN: 转场拼接要求每段时长可读');
    const T = Math.max(0.05, Number(transitionSec));
    // 转场总时长不能超过最短片段的一半，否则 xfade 会直接失败
    if (durs.some((d) => d <= T * 1.01)) throw new Error(`TRANSITION_TOO_LONG: 片段短于转场时长（${T}s）`);

    const target = firstVideoShape(infos);
    const parts = [];
    absPaths.forEach((_, i) => {
      parts.push(`[${i}:v]` + normalizeChain(target) + `,setsar=1[v${i}]`);
      if (infos[i]?.hasAudio) {
        parts.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
      } else {
        parts.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${fmt(durs[i])}[a${i}]`);
      }
    });

    // 视频：串行 xfade
    let curV = 'v0';
    let running = durs[0];
    for (let i = 1; i < absPaths.length; i += 1) {
      const offset = running - T;
      const outLabel = `x${i}`;
      parts.push(`[${curV}][v${i}]xfade=transition=fade:duration=${fmt(T)}:offset=${fmt(Math.max(0, offset))}[${outLabel}]`);
      curV = outLabel;
      running = running + durs[i] - T;
    }

    // 音频：同样串行 acrossfade，保证与视频转场对齐
    let curA = 'a0';
    for (let i = 1; i < absPaths.length; i += 1) {
      const outLabel = `ax${i}`;
      parts.push(`[${curA}][a${i}]acrossfade=d=${fmt(T)}:c1=tri:c2=tri[${outLabel}]`);
      curA = outLabel;
    }

    args.push('-filter_complex', parts.join(';'));
    args.push('-map', `[${curV}]`, '-map', `[${curA}]`);
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out);
    await runProcess(ffmpeg, args, 3600000);
  }

  /* ------------------------------------------------------------- 音轨 */

  /**
   * 音轨操作 —— 剪辑里"声音"这一块的全部。
   *
   * op 语义：
   *   strip   剥掉原声（纯视频输出）
   *   bgm     用一段音频替换原声（或与之混音），可选淡入淡出
   *   volume  只调原声音量（不换音轨）
   *
   * 为什么 bgm 要区分 replace / mix：
   *   换 BGM 时用户通常**不想要**原声（原声是 H3 生成的环境音，会和 BGM 打架）；
   *   但也常有"保留人声、压低当背景"的需求。两种都提供，默认 replace。
   */
  async function audio({ input, op = 'strip', bgmInput = '', replaceOriginal = true, bgmVolume = 0.5, originalVolume = 0.3, fadeInSec = 0, fadeOutSec = 0 }) {
    const abs = resolveInput(input);
    if (!VIDEO_EXT.has(path.extname(abs).toLowerCase())) {
      throw new Error('NOT_A_VIDEO: 音轨操作需要视频输入');
    }
    const info = await probe(abs);
    const duration = Number(info.durationSec) || 0;
    const ffmpeg = resolveFfmpeg(C());
    const out = path.join(outDir(), `audio_${stamp()}.mp4`);

    if (op === 'strip') {
      await runProcess(ffmpeg, [
        '-y', '-i', abs,
        '-c:v', 'copy', '-an', '-movflags', '+faststart', out,
      ], 600000);
      return { ...result(out), op: 'strip', hasAudio: false };
    }

    if (op === 'volume') {
      if (!info.hasAudio) throw new Error('NO_AUDIO_TRACK: 该视频没有音轨，无法调音量');
      const v = clamp(originalVolume, 0, 4, 1);
      await runProcess(ffmpeg, [
        '-y', '-i', abs,
        '-c:v', 'copy',
        '-af', `volume=${fmt(v)}`,
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out,
      ], 1800000);
      return { ...result(out), op: 'volume', originalVolume: v };
    }

    if (op === 'bgm') {
      if (!bgmInput) throw new Error('BGM_REQUIRED: bgm 操作需要 bgmInput');
      const bgmAbs = resolveInput(bgmInput);
      if (!AUDIO_EXT.has(path.extname(bgmAbs).toLowerCase())
        && !VIDEO_EXT.has(path.extname(bgmAbs).toLowerCase())) {
        throw new Error(`UNSUPPORTED_AUDIO: ${path.extname(bgmAbs)}`);
      }

      const bgmVol = clamp(bgmVolume, 0, 4, 0.5);
      const origVol = clamp(originalVolume, 0, 4, 0.3);
      const fadeIn = clamp(fadeInSec, 0, 60, 0);
      const fadeOut = clamp(fadeOutSec, 0, 60, 0);

      // BGM 循环或截断到与视频等长 —— 否则 amix 会用最长轨的时长
      const bgmChain = [`atrim=0:${fmt(duration || 1)}`, 'asetpts=PTS-STARTPTS', `volume=${fmt(bgmVol)}`];
      if (fadeIn > 0) bgmChain.push(`afade=t=in:st=0:d=${fmt(fadeIn)}`);
      if (fadeOut > 0 && duration > fadeOut) {
        bgmChain.push(`afade=t=out:st=${fmt(duration - fadeOut)}:d=${fmt(fadeOut)}`);
      }

      const args = ['-y', '-i', abs, '-stream_loop', '-1', '-i', bgmAbs];
      let filter;
      if (replaceOriginal || !info.hasAudio) {
        // 完全替换：BGM 直接接管音轨
        filter = `[1:a]${bgmChain.join(',')}[aout]`;
        args.push('-filter_complex', filter);
        args.push('-map', '0:v', '-map', '[aout]');
      } else {
        // 混音：原声压低当底，BGM 压在上面
        filter = [
          `[0:a]volume=${fmt(origVol)}[a0]`,
          `[1:a]${bgmChain.join(',')}[a1]`,
          `[a0][a1]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
        ].join(';');
        args.push('-filter_complex', filter);
        args.push('-map', '0:v', '-map', '[aout]');
      }
      args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out);
      await runProcess(ffmpeg, args, 1800000);
      return {
        ...result(out),
        op: 'bgm',
        replaceOriginal: Boolean(replaceOriginal || !info.hasAudio),
        bgmVolume: bgmVol,
        originalVolume: origVol,
      };
    }

    throw new Error(`UNKNOWN_AUDIO_OP: ${op}`);
  }

  /* ----------------------------------------------------------- 工程存储 */

  /**
   * 剪辑工程 —— 一条有序片段列表 + 音轨设置。
   *
   * 存成 data/edit/<id>.json。为什么不用 projects/shots 那套：
   * 那是"生成镜头卡"，字段语义（prompt / 模型 / 参考图）与剪辑完全不同，
   * 硬塞进去会让两边都变脏。
   *
   * 工程里只存**相对路径**，不存绝对路径 —— 换机器/换 dataDir 后仍可用。
   */
  function emptyProject(id, name) {
    const now = new Date().toISOString();
    return {
      id,
      name: name || '未命名剪辑',
      clips: [],
      audio: { mode: 'original', bgmRel: '', bgmVolume: 0.5, originalVolume: 1, fadeInSec: 0, fadeOutSec: 0 },
      createdAt: now,
      updatedAt: now,
    };
  }

  async function listProjects() {
    const dir = editDir();
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return []; }
    const out = [];
    for (const n of names) {
      try {
        const raw = fs.readFileSync(path.join(dir, n), 'utf8');
        const p = JSON.parse(raw);
        out.push({
          id: p.id,
          name: p.name,
          clipCount: Array.isArray(p.clips) ? p.clips.length : 0,
          updatedAt: p.updatedAt ?? null,
        });
      } catch { /* 坏文件跳过，不要让它拖垮整个列表 */ }
    }
    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return { ok: true, projects: out };
  }

  function getProject(id) {
    const f = projectFile(id);
    if (!fs.existsSync(f)) throw new Error('EDIT_NOT_FOUND');
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }

  function saveProject(id, patch = {}) {
    const safe = safeId(id, EDIT_ID);
    const base = fs.existsSync(projectFile(safe)) ? getProject(safe) : emptyProject(safe, patch.name);
    const next = {
      ...base,
      ...('name' in patch ? { name: String(patch.name || base.name) } : {}),
      ...(Array.isArray(patch.clips) ? { clips: normalizeClips(patch.clips) } : {}),
      ...(patch.audio && typeof patch.audio === 'object' ? { audio: { ...base.audio, ...patch.audio } } : {}),
      /**
       * lastOutputRel 由 render() 内部回写，用来记住"这个工程上次出片在哪"。
       * ⚠️ 必须显式接收：旧实现只挑 name/clips/audio 三个字段，
       *    render 里传进来的 lastOutputRel 被静默丢弃，
       *    于是前端永远拿不到上次成片 —— 注释说有的能力实际不存在。
       */
      ...(typeof patch.lastOutputRel === 'string' ? { lastOutputRel: patch.lastOutputRel } : {}),
      id: safe,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(projectFile(safe), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  function deleteProject(id) {
    const f = projectFile(id);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return { ok: true, id };
  }

  /**
   * 片段归一 —— 前端会传一堆额外字段（缩略图、临时状态），
   * 这里只留能落盘、且下次能还原的最小集合。
   */
  function normalizeClips(clips) {
    return clips.map((c, i) => ({
      id: String(c?.id || `clip_${i + 1}`),
      rel: String(c?.rel || ''),
      name: String(c?.name || ''),
      startSec: numOrNull(c?.startSec) ?? 0,
      endSec: numOrNull(c?.endSec),
      order: i,
    })).filter((c) => c.rel);
  }

  /**
   * 出片：把工程渲染成一条 mp4。
   *
   * 流程：逐片段裁切（如有裁剪区间）→ 拼接 → 应用音轨设置。
   * 中间产物统一放 edit/outputs，不清理 —— 用户常常要拿中间片段单独用。
   * 文件名带时间戳，不覆盖上一版。
   */
  async function render({ id, clips: clipsPatch, audio: audioPatch, transitionSec = 0, reencode = null, name }) {
    /**
     * ⚠️ 有 id 但工程文件不存在时**不能直接抛 EDIT_NOT_FOUND**。
     *
     * 前端的主流程是「拼好片段 → 直接点出片」，用户可以一次都没点过保存，
     * 此时 id 是前端刚生成的、磁盘上还没有对应 json。旧实现直接
     * getProject(id) 抛错 —— 表现是"第一次出片必然失败，先存一次再出片才行"，
     * 而这完全不是用户的心智模型。
     *
     * 现在的语义：工程存在 → 在它的基础上改；不存在 → 当成新工程就地建。
     */
    let proj;
    if (id) {
      try {
        proj = getProject(id);
      } catch {
        proj = { id, clips: [], audio: {} };
      }
    } else {
      proj = { clips: [], audio: {} };
    }
    const clips = Array.isArray(clipsPatch) ? normalizeClips(clipsPatch) : proj.clips;
    if (!clips.length) throw new Error('NO_CLIPS: 工程里没有片段');

    const useAudio = { ...(proj.audio || {}), ...(audioPatch || {}) };

    // ---- 第一步：逐片段裁切 ----
    const trimmed = [];
    for (const c of clips) {
      const abs = resolveInput(c.rel);
      const info = await probe(abs);
      const total = Number(info.durationSec) || 0;
      const start = numOrNull(c.startSec) ?? 0;
      const end = numOrNull(c.endSec) ?? total;
      // 裁剪区间与整段一致时跳过重编码，直接接原文件
      const isFull = start <= 0.01 && (!total || end >= total - 0.01);
      if (isFull) {
        trimmed.push(abs);
      } else {
        const t = await trim({ input: abs, startSec: start, endSec: end, reencode: true });
        trimmed.push(t.path);
      }
    }

    // ---- 第二步：拼接 ----
    const joined = await concat({ inputs: trimmed, transitionSec, reencode });

    // ---- 第三步：音轨 ----
    let finalPath = joined.path;
    if (useAudio.mode === 'strip') {
      const r = await audio({ input: finalPath, op: 'strip' });
      finalPath = r.path;
    } else if (useAudio.mode === 'bgm' && useAudio.bgmRel) {
      const r = await audio({
        input: finalPath,
        op: 'bgm',
        bgmInput: useAudio.bgmRel,
        replaceOriginal: useAudio.replaceOriginal !== false,
        bgmVolume: useAudio.bgmVolume,
        originalVolume: useAudio.originalVolume,
        fadeInSec: useAudio.fadeInSec,
        fadeOutSec: useAudio.fadeOutSec,
      });
      finalPath = r.path;
    } else if (useAudio.mode === 'volume') {
      const r = await audio({ input: finalPath, op: 'volume', originalVolume: useAudio.originalVolume });
      finalPath = r.path;
    }

    // ---- 归档 ----
    /**
     * ⚠️ `name` 来自前端/工具入参，**不能直接当文件名**。
     *
     * 不做净化的话，`{name:'../../x'}` 会让 copyFileSync 写到 dataDir 之外
     * （路径穿越）。这里只保留安全字符，并限长；净化后为空就回退到时间戳名。
     */
    const safeName = sanitizeFileName(name);
    const finalName = safeName || (id ? `edit_${id}_${stamp()}` : `edit_${stamp()}`);
    const archived = path.join(outDir(), `${finalName}.mp4`);
    if (path.resolve(finalPath) !== path.resolve(archived)) {
      try { fs.copyFileSync(finalPath, archived); } catch { /* ignore：归档失败不该让出片失败 */ }
    }
    const target = fs.existsSync(archived) ? archived : finalPath;
    const meta = await probe(target);

    // 有工程 id 就顺手记下最后一次产物，便于前端"打开上次成片"
    if (id) {
      try { saveProject(id, { ...proj, lastOutputRel: path.relative(C().dataDir, target).replace(/\\/g, '/') }); } catch { /* ignore */ }
    }

    return {
      ...result(target),
      meta: { durationSec: meta.durationSec, video: meta.video, audio: meta.audio },
      segments: clips.length,
    };
  }

  /* ------------------------------------------------------------- 素材 */

  /**
   * 可剪辑素材列表 —— 扫 data/outputs / data/assets / data/edit/outputs。
   *
   * 剪辑页的素材来源天然是**本插件自己的产出**（H3 生成的成片），
   * 所以不扫整个 dataDir（那会把 vault 里的 png、previz 里的序列一起列出来）。
   */
  function listClips() {
    const root = C().dataDir;
    const dirs = ['outputs', 'assets', path.join('edit', 'outputs')];
    const seen = new Set();
    const clips = [];

    for (const rel of dirs) {
      const d = path.join(root, rel);
      let names = [];
      try { names = fs.readdirSync(d); } catch { continue; }
      for (const n of names) {
        const abs = path.join(d, n);
        let st;
        try { st = fs.statSync(abs); } catch { continue; }
        if (!st.isFile()) continue;
        if (!VIDEO_EXT.has(path.extname(n).toLowerCase()) && !AUDIO_EXT.has(path.extname(n).toLowerCase())) continue;
        const relPath = path.relative(root, abs).replace(/\\/g, '/');
        if (seen.has(relPath)) continue;
        seen.add(relPath);
        clips.push({
          rel: relPath,
          name: n,
          kind: VIDEO_EXT.has(path.extname(n).toLowerCase()) ? 'video' : 'audio',
          bytes: st.size,
          mtime: st.mtimeMs,
        });
      }
    }
    clips.sort((a, b) => b.mtime - a.mtime);
    return { ok: true, clips };
  }

  return {
    probe, trim, concat, audio, render,
    listProjects, getProject, saveProject, deleteProject,
    listClips, resolveInput,
  };
}

/* --------------------------------------------------------------- 工具函数 */

function stamp() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 秒 → ffmpeg 时间参数（固定 3 位小数，避免科学计数法） */
function fmt(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return '0';
  return n.toFixed(3);
}

function round3(n) { return Math.round(Number(n) * 1000) / 1000; }

/**
 * 把用户给的名字净化成安全文件名。
 *
 * 只保留中英文/数字/下划线/短横线/空格，其余（含 `.`、`/`、`\`、`:`）一律剔除 ——
 * 剔除 `.` 是有意的：这样 `..` 根本构造不出来，路径穿越无从谈起。
 * Windows 保留名（CON/PRN/AUX/NUL/COM1…）也挡掉，否则 copyFileSync 会失败。
 */
function sanitizeFileName(raw) {
  if (raw == null) return '';
  let s = String(raw).trim().slice(0, 80);
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[^\w\u4e00-\u9fa5\- ]+/g, '_');
  s = s.replace(/^[_\-\s]+|[_\-\s]+$/g, '');
  if (!s) return '';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) return `_${s}`;
  return s;
}

function clamp(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 数字或 null —— 空值一律返回 null。
 *
 * ⚠️ 必须先判空再 Number()。
 *
 * `Number(null) === 0`、`Number('') === 0`、`Number(false) === 0`，
 * 三者都是**有限数字**，所以旧实现
 *
 *     const n = Number(v); return Number.isFinite(n) ? n : null;
 *
 * 会把 null 返回成 0，而不是 null。后果非常隐蔽且致命：
 *   `const end = numOrNull(c.endSec) ?? total;`
 * 对 `endSec: null`（"整段"）得到 end = 0 —— 因为 0 不是 nullish，
 * `??` 不会回退到 total。于是"整段"被理解成"0 到 0"，
 * trim 报 EMPTY_RANGE，多段 render 直接 500。
 *
 * 这个 bug 只在"片段没设裁剪区间"时出现，而默认就是没设 ——
 * 也就是**默认路径全坏**。已由 tools/verify-edit.mjs 的 render 用例覆盖。
 */
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extOf(p) {
  const e = path.extname(p).toLowerCase();
  return VIDEO_EXT.has(e) ? e : '.mp4';
}

/** "30000/1001" → 29.97；"25/1" → 25 */
function parseRate(r) {
  const s = String(r || '');
  const m = /^(\d+)\/(\d+)$/.exec(s);
  if (!m) return numOrNull(r);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!b) return null;
  return Math.round((a / b) * 1000) / 1000;
}

/**
 * 一组片段是否"形状一致" —— 决定能不能走流复制。
 * 只要有一项不同就必须重编码，否则 concat demuxer 会静默产出坏片。
 */
function sameShape(infos) {
  if (!infos.length) return false;
  const first = infos[0]?.video;
  if (!first) return false;
  for (const info of infos) {
    const v = info?.video;
    if (!v) return false;
    if (String(v.codec) !== String(first.codec)) return false;
    if (Number(v.width) !== Number(first.width)) return false;
    if (Number(v.height) !== Number(first.height)) return false;
    // 帧率允许极小误差（29.97 vs 30 视为不同）
    if (Math.abs(Number(v.fps ?? 0) - Number(first.fps ?? 0)) > 0.01) return false;
  }
  // 音轨存在性也必须一致，否则 concat 的流映射会错位
  const firstAudio = Boolean(infos[0]?.hasAudio);
  for (const info of infos) {
    if (Boolean(info?.hasAudio) !== firstAudio) return false;
  }
  return true;
}

function firstVideoShape(infos) {
  const v = infos.find((x) => x?.video)?.video;
  return {
    width: Number(v?.width) || 1920,
    height: Number(v?.height) || 1080,
    fps: Number(v?.fps) || 30,
  };
}

/**
 * 把任意输入归一成目标形状的滤镜链。
 *
 * scale + pad 而不是 scale 拉伸：拉伸会变比例，pad 加黑边保持画面不变形。
 * setsar=1 必须加 —— 手机竖拍素材常带非 1:1 的 SAR，
 * 不带的话 concat 会直接报 "Input link parameters do not match"。
 */
function normalizeChain({ width, height, fps }) {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    'setsar=1',
    `fps=${fps}`,
    'format=yuv420p',
  ].join(',');
}