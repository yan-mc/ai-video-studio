/**
 * 提示词编译的文本工具 —— 帧数、时间戳、运镜、说话人、镜头归一。全部是纯函数。
 * @module prompt/text-utils
 */
import { h3Length } from '../../store/models.js';
import { H3_LIMITS, SUMMARY_TASKS } from './spec.js';
import { resolveLighting, styleLightingConflicts } from './styles.js';

/** 秒 → H3 帧数（`17k+5` 网格）。单一真源在 store/models.js 的 `h3Length()`。 */
export function h3Frames(durationSec, fps = H3_LIMITS.fps) {
  return h3Length(durationSec, fps);
}

/** 秒 → `MM:SS.mmm`（官方时间戳格式，毫秒三位） */
export function timecode(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const ms = Math.round((rest - whole) * 1000);
  return `${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** 时长夹取 + 网格落点提示 */
export function clampDuration(v, warnings) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  const lo = H3_LIMITS.durationSec.min;
  const hi = H3_LIMITS.durationSec.max;
  if (n < lo) {
    warnings.push(`时长 ${n}s 低于本地可用的最短 ${lo}s（124 帧 ≈ 5.17s），已抬到 ${lo}s`);
    return lo;
  }
  if (n > hi) {
    warnings.push(`时长 ${n}s 超过上限 ${hi}s，已截到 ${hi}s`);
    return hi;
  }
  if (n > H3_LIMITS.durationSec.warnAbove) {
    warnings.push(`${n}s 属于高风险时长（>${H3_LIMITS.durationSec.warnAbove}s 易崩），建议拆段`);
  }
  return n;
}

/** 让一句话恰好以一个英文句号结尾（中文句号先剥掉，避免「。.」双句末） */
export function endSentence(s) {
  const t = String(s ?? '').trim().replace(/[。．.，,；;、\s]+$/u, '');
  return t ? `${t}.` : '';
}

/** 中文运镜词 → 英文自然语言句（输出是句子，不是 `[Dolly in]` 标签） */
const CAMERA_MAP = Object.freeze([
  [/推镜|推近|推进|dolly\s*in|push\s*in/i, 'pushes in with small amplitude at slow speed'],
  [/拉镜|拉远|后拉|dolly\s*out|pull\s*out/i, 'pulls back with moderate amplitude at slow speed'],
  [/摇镜|横摇|pan\s*(left|right)?/i, 'pans horizontally at steady speed'],
  [/俯仰|上下摇|tilt/i, 'tilts vertically at steady speed'],
  [/跟拍|跟镜|tracking|follow/i, 'tracks the subject from a fixed distance'],
  [/环绕|旋转|orbit/i, 'orbits around the subject at constant radius'],
  [/升降|摇臂|crane/i, 'cranes vertically with a smooth arc'],
  [/手持|handheld/i, 'moves with a subtle handheld sway'],
  [/固定|静止|不动|static|fixed/i, 'stays locked off on a tripod'],
  [/变焦|zoom/i, 'zooms with small amplitude at slow speed'],
]);

export function cameraPhrase(camera) {
  const c = String(camera ?? '').trim();
  if (!c) return 'stays locked off on a tripod';
  if (!/[\u4e00-\u9fa5]/.test(c)) {
    const bare = c.replace(/^the camera\s+/i, '').replace(/[.。]\s*$/, '');
    // 英文形容词不能直接当动词（"The camera fixed." 是病句）
    if (/^(fixed|static|locked|stationary|still)$/i.test(bare)) {
      return 'stays locked off on a tripod';
    }
    if (/^(slow|fast|smooth|steady)$/i.test(bare)) {
      return 'moves slowly and steadily';
    }
    return bare;
  }
  for (const [re, en] of CAMERA_MAP) {
    if (re.test(c)) return en;
  }
  // 认不出来就退化成"缓慢稳定"，不编造运动
  return 'moves slowly and steadily';
}

/**
 * 解析说话人标签。官方要求 `(S1)` / `(S2)` 按发声顺序编号、全篇不变；
 * 优先用输入里已标好的 speaker，没有就按出场顺序补。
 */
export function resolveSpeaker(sc, subjects) {
  const raw = sc.dialogue?.speaker;
  if (raw) {
    const byId = subjects.find((s) => s.id === raw || s.name === raw);
    if (byId) {
      const idx = subjects.indexOf(byId) + 1;
      return { label: `${byId.name || 'The subject'} (S${idx})`, id: byId.id, index: idx };
    }
    const m = /^S(\d+)$/i.exec(String(raw).trim());
    if (m) {
      const idx = Number(m[1]);
      const name = subjects[idx - 1]?.name || 'The subject';
      return { label: `${name} (S${idx})`, id: raw, index: idx };
    }
    return { label: `${raw} (S1)`, id: raw, index: 1 };
  }
  const first = subjects[0];
  return { label: `${first?.name || 'The subject'} (S1)`, id: first?.id ?? 'S1', index: 1 };
}

/**
 * 返回发声者对应的 subject 下标（0-based），没有则 null。
 * `(Sx)` 只在真正发声时出现，且按首次发声的先后编号。
 */
export function speakerSubjectIndex(dialogue, subjects) {
  const raw = dialogue?.speaker;
  if (!subjects.length) return null;
  if (raw != null && String(raw).trim()) {
    const key = String(raw).trim();
    const byId = subjects.findIndex((s) => s && (s.id === key || s.name === key));
    if (byId >= 0) return byId;
    const m = /^S(\d+)$/i.exec(key);
    if (m) {
      const idx = Number(m[1]) - 1;
      if (idx >= 0 && idx < subjects.length) return idx;
    }
    return null;   // 明确指定了一个不存在的角色：不臆测
  }
  return 0;        // 没写说话人 → 默认第一个角色
}

/** 镜头归一 */
export function fixScene(sc) {
  return {
    index: sc.index ?? 0,
    startSec: Number(sc.startSec) || 0,
    endSec: Number(sc.endSec) || Number(sc.durationSec) || 3,
    durationSec: Number(sc.durationSec) || (Number(sc.endSec) - Number(sc.startSec)) || 3,
    shotSize: String(sc.shotSize ?? sc.size ?? ''),
    action: String(sc.action ?? sc.description ?? ''),
    camera: String(sc.camera ?? ''),
    sound: String(sc.sound ?? ''),
    dialogue: sc.dialogue && sc.dialogue.text
      ? {
        speaker: sc.dialogue.speaker ?? null,
        text: String(sc.dialogue.text),
        lang: sc.dialogue.lang || 'Chinese',
        emotion: sc.dialogue.emotion ?? '',
      }
      : null,
  };
}

export function buildScenesFromShots(shots) {
  if (!Array.isArray(shots) || !shots.length) return [];
  return shots.map((s, i) => fixScene({ ...s, index: i + 1 }));
}

/**
 * 从零散字段推导出"至少一个镜头"。只给 description + camera 的调用也必须补出
 * 一个 [Shot 1]，否则产出的是没有景别、没有运镜、没有台词的自由文本。
 */
export function deriveScenes(input, durationSec) {
  const desc = String(input.description ?? input.sceneLayout ?? input.scene ?? '').trim();
  const camera = String(input.camera ?? '').trim();
  const dialogue = input.dialogue ? String(input.dialogue) : '';
  if (!desc && !camera && !dialogue) return [];
  return [fixScene({
    index: 1,
    startSec: 0,
    endSec: durationSec,
    durationSec,
    shotSize: String(input.shotSize ?? ''),
    action: desc,
    camera,
    sound: String(input.sound ?? ''),
    dialogue: dialogue ? { speaker: input.speaker ?? 'S1', text: dialogue, lang: 'Chinese', emotion: '' } : null,
  })];
}

/**
 * 基础格式的开头定调句。反模式顺序是「主体 → 动作 → 镜头 → 光线 → 声音」，
 * 所以这里只放风格/媒介、不放场景；打光必须显式并进来，否则该通道在关键帧模式下静默失效。
 */
export function styleLeadSentence(style, input, warnings = null) {
  const parts = [];
  const text = String(style?.en ?? '').trim();
  if (text) parts.push(text.replace(/[.\s]+$/, ''));
  const lighting = resolveLighting(input?.lighting ?? input?.lightingId ?? input?.lightId);
  const lightingText = String(lighting?.en ?? '').trim();
  if (lightingText) {
    // 画风 × 打光冲突检测必须两条格式路径都跑
    if (Array.isArray(warnings)) {
      for (const msg of styleLightingConflicts(style, lighting)) warnings.push(msg);
    }
    parts.push(lightingText.replace(/[.\s]+$/, ''));
  }
  const ratio = input?.ratio ? String(input.ratio) : '';
  if (ratio) parts.push(`${ratio} aspect ratio`);
  const joined = parts.filter(Boolean).join('. ').replace(/\.\.+/g, '.');
  // 结尾必须有句号：调用方把这段和 `[Shot 1] …` 直接拼接
  return joined ? `${joined}.` : '';
}

export function normalizeRefs(refs) {
  const raw = refs && typeof refs === 'object' ? refs : {};
  return {
    images: Array.isArray(raw.images) ? raw.images : [],
    videos: Array.isArray(raw.videos) ? raw.videos : [],
    audios: Array.isArray(raw.audios) ? raw.audios : [],
    videoUses: Array.isArray(raw.videoUses) ? raw.videoUses : [],
    audioModes: Array.isArray(raw.audioModes) ? raw.audioModes : [],
    firstFrame: raw.firstFrame ?? null,
    lastFrame: raw.lastFrame ?? null,
    firstFrameIndex: raw.firstFrameIndex ?? null,
    lastFrameIndex: raw.lastFrameIndex ?? null,
  };
}

/** summary 的任务类型前缀（官方 6 枚举，` + ` 连接） */
export function summaryTasks(refs, input) {
  const explicit = input.summaryTasks ?? input.summary_tasks;
  if (Array.isArray(explicit) && explicit.length) {
    const valid = explicit.filter((t) => SUMMARY_TASKS.includes(t));
    if (valid.length) return [...new Set(valid)].join(' + ');
  }
  const tasks = [];
  if (refs.firstFrame || refs.lastFrame) tasks.push('keyframe completion');
  if (refs.images.length) tasks.push('reference generation');
  // 单挂角色卡、refs.images 为空时，图是以 <Picture N> 形式由 subjects 声明进来的
  if (!refs.images.length) {
    const declaredPics = (Array.isArray(input.subjects) ? input.subjects : [])
      .filter((s) => s && Number.isFinite(Number(s.pictureIndex)) && Number(s.pictureIndex) > 0);
    if (declaredPics.length) tasks.push('reference generation');
  }
  if (refs.videos.some((_, i) => refs.videoUses[i] === 'continuation')) tasks.push('video continuation');
  if (refs.audios.length) tasks.push('audio reference');
  return [...new Set(tasks)].join(' + ');
}

export function deriveSummary(subjects, scenes) {
  const names = subjects.map((s) => s.name).filter(Boolean).join(' and ') || 'The subject';
  // 不截断：summary 没有长度上限，切半句比长句有害
  const first = scenes?.[0]?.action ? String(scenes[0].action).trim() : '';
  return `${names} in a short scene. ${first}`.trim();
}

export function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/** 是否含中日韩字符 */
export const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export function isAsciiText(s) {
  return !CJK_RE.test(String(s ?? ''));
}