/**
 * 官方规范常量：枚举 / 硬上限 / 机制句 / 续写判定。
 * 字符串逐字照抄 `references/base-en.txt` / `ref-en.txt`。
 * @module prompt/spec
 */

/** 视觉类保留标记（用于 <Subject> / <Picture> / <Video>） */
export const RETENTION_VISUAL = Object.freeze([
  'fully_preserved', 'partially_preserved', 'attribute_transfer', 'weak_reference',
]);

/** 音频类保留标记（用于 <Audio>）。两套不可混用，weak_reference 是唯一共有的一个。 */
export const RETENTION_AUDIO = Object.freeze([
  'fully_copy', 'partially_copy', 'reference', 'weak_reference',
]);

/** `summary:` 前缀的任务类型枚举（固定 6 个，用 ` + ` 连接） */
export const SUMMARY_TASKS = Object.freeze([
  'keyframe completion', 'reference generation', 'video editing',
  'video continuation', 'audio reuse', 'audio reference',
]);

/** 五种生成模式 —— 与 store/models.js 的 H3_MODES 同一词表 */
export const H3_MODES = Object.freeze([
  { id: 't2va', name: 'T2VA 文生视频', hint: '纯文本驱动', inputs: 0 },
  { id: 'i2va', name: 'I2VA 图生视频', hint: '1 张首帧图', inputs: 1 },
  { id: 'fl2va', name: 'FL2VA 首尾帧', hint: '0–2 张图（0=文生，1=首帧/尾帧，2=首尾帧）', inputs: 2 },
  { id: 'l2va', name: 'L2VA 尾帧收敛', hint: '1 张尾帧图，推断开头', inputs: 1 },
  { id: 'ref2va', name: 'Ref2VA 全参考', hint: '图≤9 + 视频≤3 + 音频≤3（结构最完整）', inputs: 12 },
]);

/** 硬约束。min 取 5 而非官方 4：节点帧网格 `17k+5` 最短可用 124 帧（≈5.17s）。 */
export const H3_LIMITS = Object.freeze({
  durationSec: { min: 5, max: 15, recommend: [5, 10], warnAbove: 14 },
  officialDurationSec: { min: 4, max: 15 },
  fps: 24,
  frames: { grid: '17k+5', min: 124, max: 362, default: 124 },
  refImages: 9,
  refVideos: 3,
  refAudios: 3,
  totalRefs: 12,
  videoClipSec: [2, 15],
  audioClipSec: [2, 15],
  mediaTotalSec: 15,
  /** 本插件收紧值：超过会稀释 detailed_description 的动作细节注意力 */
  promptMaxChars: 6000,
  /** 官方硬上限（上游会拒） */
  promptOfficialMaxChars: 7000,
  canvasMultiple: 32,
  nativeCanvas: [1344, 768],
});

/**
 * 潜空间续写的开关句 —— 必须拼在最顶部：放中段会被上下文稀释、
 * 字段名又不一定被结构化解析。段 1 反过来声明"这是开场、没有承接"。
 */
export const CONTINUATION_SWITCH = Object.freeze({
  carried: [
    'The actual carried latent motion from the previous segment governs the current action and camera state.',
    'No reference picture resets pose, body position, hand placement, expression, gaze or framing.',
    'The lighting direction and time of day continue unchanged from the previous segment.',
  ].join(' '),

  opening: [
    'This is the opening segment of the film.',
    'No earlier segment exists; nothing is carried in, and both the camera and the figures start fresh.',
  ].join(' '),
});

/** 裁切区时序纪律 —— 段 2+ 必写。实测裁切 0.92s（22 帧 @24fps），边界写 1.0s。 */
export const TRIM_DISCIPLINE = Object.freeze({
  carried: [
    'Timing discipline: the first second is the carried overlap region and carries no new event',
    '— no new gesture, no new head turn, no new line, and no camera move begins inside it.',
    'Every action described below begins at the one-second mark.',
  ].join(' '),

  opening: [
    'This is the opening segment, so there is no carried overlap region and the first second is fully authored.',
    'Every action below may begin at the first frame.',
  ].join(' '),
});

/**
 * 字幕 / overlay 压制 —— 编译器自动追加：本地 CFG 固定 1.0、无 negative 分支，
 * 用户自己写 "no subtitles" 既没通道又被 lint 判非法。
 */
export const SUPPRESSION_GUARDS = Object.freeze({
  /** 防线 1：画风串之后另起一行追加（不得改动画风串原文一字） */
  textSuppression: 'Text suppression: NO subtitles, NO on-screen text, NO captions, '
    + 'NO watermarks, NO logos, NO UI overlays.',

  /** 防线 2：detailed_description 末尾的画面完整性句（正向句法） */
  frameIntegrity: 'Every element inside the frame belongs to the physical scene: '
    + 'paving, railing, sea, sky, foliage and the figures themselves. '
    + 'Nothing floats over the image.',
});

/** 段间机制句 —— lint 必须先整体剥离，否则每个续写段都误报否定词 */
export const MECHANISM_BLOCKS = Object.freeze([
  CONTINUATION_SWITCH.carried,
  CONTINUATION_SWITCH.opening,
  TRIM_DISCIPLINE.carried,
  TRIM_DISCIPLINE.opening,
].filter(Boolean));

/**
 * 解析续写上下文：开场（index===1，南风约定 Load 0 = 不读文件）还是承接。
 * @returns {{ isContinuation: boolean, index: number|null, trimFrames: number }}
 */
export function resolveContinuation(input = {}) {
  let index = null;
  const raw = input.continuationTask ?? input.continuation_task;
  if (raw) {
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (obj && Number.isFinite(Number(obj.index))) index = Number(obj.index);
    } catch { /* 坏 JSON：当作没有 */ }
  }
  if (index == null && Number.isFinite(Number(input.continuationIndex))) {
    index = Number(input.continuationIndex);
  }
  const explicit = input.isContinuation === true || input.is_continuation === true;
  const isContinuation = index != null ? index > 1 : explicit;
  const ctxLen = Number(input.contextLength ?? input.context_length ?? 22);
  return {
    isContinuation,
    index,
    trimFrames: isContinuation ? (Number.isFinite(ctxLen) ? ctxLen : 22) : 0,
  };
}