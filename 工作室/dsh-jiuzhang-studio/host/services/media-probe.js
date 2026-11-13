/**
 * 媒体探测 —— 用 ffprobe 读视频/音频的真实流信息。
 *
 * 解决什么问题：
 *   H3 的 Ref2VA 有 `ref_video_audios` 输入，用来接**参考视频自带的音轨**。
 *   如果给一段没有音轨的视频硬接一个空音频槽，模型会收到"有音轨但内容是空"，
 *   效果反而比不接更差 —— 而且**不会报错**，属于静默降级。
 *
 *   所以 `hasAudio` 不能靠调用方拍脑袋，必须探测。
 *
 * 另一个用途：音频段有「2–15 秒」的时长约束（见 H3_LIMITS），
 * 上传后应该能立刻告诉用户「这段 0.8 秒，太短了」。
 */
import { spawn } from 'node:child_process';
import { resolveFfprobe } from './seedance-client.js';

/** 探测超时（ffprobe 通常 <200ms；给足余量） */
const PROBE_TIMEOUT_MS = 8000;

/** 结果缓存：同一文件短时间内不重复探测 */
const cache = new Map();
const CACHE_TTL_MS = 60_000;

function runProbe(exe, args) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    const child = spawn(exe, args, { windowsHide: true });
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      resolve({ ok: false, error: 'PROBE_TIMEOUT' });
    }, PROBE_TIMEOUT_MS);

    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, error: String(e?.message || e) });
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, out, err, code });
    });
  });
}

/**
 * 探测一个媒体文件。
 *
 * @param {string} absPath
 * @param {object} [cfg]
 * @returns {Promise<{
 *   ok: boolean,
 *   kind: 'video'|'audio'|'image'|'unknown',
 *   hasAudio: boolean,
 *   hasVideo: boolean,
 *   durationSec: number|null,
 *   width: number|null, height: number|null,
 *   fps: number|null,
 *   audioCodec: string|null, videoCodec: string|null,
 *   error?: string,
 * }>}
 */
export async function probeMedia(absPath, cfg) {
  const key = String(absPath ?? '');
  if (!key) return failResult('EMPTY_PATH');

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const exe = resolveFfprobe(cfg);
  const r = await runProbe(exe, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    key,
  ]);

  let value;
  if (!r.ok) {
    value = failResult(r.error ?? `PROBE_EXIT_${r.code}`);
  } else {
    try {
      const j = JSON.parse(r.out);
      value = normalize(key, j);
    } catch {
      value = failResult('PROBE_BAD_JSON');
    }
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}

/** 图片容器/编码的特征（ffprobe 对静态图也可能给出 video 流） */
const IMAGE_CODECS = new Set(['png', 'mjpeg', 'jpegls', 'bmp', 'gif', 'webp', 'tiff', 'jpeg2000', 'heif']);
const IMAGE_FORMATS = /^(png_pipe|image2|jpeg_pipe|webp_pipe|bmp_pipe|gif|tiff_pipe|apng)$/i;

function normalize(_path, j) {
  const streams = Array.isArray(j?.streams) ? j.streams : [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');

  const fmtDur = Number(j?.format?.duration);
  const streamDur = Number(v?.duration ?? a?.duration);
  const durationSec = Number.isFinite(fmtDur) && fmtDur > 0
    ? fmtDur
    : (Number.isFinite(streamDur) && streamDur > 0 ? streamDur : null);

  // fps：优先 avg_frame_rate（"24/1"），退化到 r_frame_rate
  let fps = null;
  for (const raw of [v?.avg_frame_rate, v?.r_frame_rate]) {
    if (!raw || raw === '0/0') continue;
    const [n, d] = String(raw).split('/').map(Number);
    if (Number.isFinite(n) && Number.isFinite(d) && d > 0) { fps = n / d; break; }
  }

  const hasVideo = Boolean(v);
  const hasAudio = Boolean(a);

  // 判定图片：ffprobe 对静态图也会给出 video 流（无 duration、单帧）。
  // 三个特征任一命中即认为是图片 —— 单看 nb_frames 不够（PNG 里没有这个字段）。
  const looksLikeImage = hasVideo && !hasAudio && (
    IMAGE_CODECS.has(String(v.codec_name || '').toLowerCase())
    || IMAGE_FORMATS.test(String(j?.format?.format_name || ''))
    || durationSec === null
    || v.nb_frames === '1'
  );

  let kind = 'unknown';
  if (looksLikeImage) kind = 'image';
  else if (hasVideo) kind = 'video';
  else if (hasAudio) kind = 'audio';

  return {
    ok: true,
    kind,
    hasAudio,
    hasVideo,
    durationSec,
    width: v?.width ?? null,
    height: v?.height ?? null,
    fps,
    audioCodec: a?.codec_name ?? null,
    videoCodec: v?.codec_name ?? null,
  };
}

function failResult(error) {
  return {
    ok: false,
    kind: 'unknown',
    hasAudio: false,
    hasVideo: false,
    durationSec: null,
    width: null,
    height: null,
    fps: null,
    audioCodec: null,
    videoCodec: null,
    error,
  };
}

/** 批量探测（并发受限，避免一次拉起太多进程） */
export async function probeMany(absPaths, cfg, concurrency = 4) {
  const list = [...new Set((absPaths ?? []).filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((p) => probeMedia(p, cfg)));
    batch.forEach((p, idx) => out.set(p, results[idx]));
  }
  return out;
}

/** 清缓存（测试用） */
export function resetProbeCache() { cache.clear(); }
