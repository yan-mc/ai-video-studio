/**
 * 基础格式（T2VA / I2VA / FL2VA / L2VA）：对齐指令（仅关键帧模式，第一行后接恰好
 * 一个空行）+ 三字段 integrated_multimodal_description / overall_soundscape /
 * non_diegetic_music。
 * @module prompt/base
 */
import { normalizeMode } from '../../store/models.js';
import { resolveSpeaker, cameraPhrase, endSentence, styleLeadSentence, timecode } from './text-utils.js';

/** 首/尾帧的 `<Picture N>` 编号（是参考图序号，不是文件路径） */
function frameIndex(refs, which, declaredMode) {
  const explicit = which === 'first' ? refs.firstFrameIndex : refs.lastFrameIndex;
  if (Number.isFinite(Number(explicit)) && Number(explicit) > 0) return Number(explicit);
  if (declaredMode === 'fl2va') return which === 'first' ? 1 : 2;
  return 1;
}

/**
 * 判断该模式是否需要对齐指令，以及哪些位置算关键帧。
 * 声明 `i2va` 却没显式给 firstFrame 时不退回 T2VA —— 用户选的模式即说明第 1 张图是首帧。
 */
export function frameSlots(refs, declaredMode) {
  const explicitFirst = Boolean(refs.firstFrame);
  const explicitLast = Boolean(refs.lastFrame);
  if (explicitFirst || explicitLast) {
    return { hasFirst: explicitFirst, hasLast: explicitLast, implicit: false };
  }
  if (declaredMode === 'i2va') return { hasFirst: true, hasLast: false, implicit: true };
  if (declaredMode === 'fl2va') return { hasFirst: true, hasLast: true, implicit: true };
  if (declaredMode === 'l2va') return { hasFirst: false, hasLast: true, implicit: true };
  return { hasFirst: false, hasLast: false, implicit: false };
}

/** 官方三种对齐指令，逐字句式（I2VA 带尖括号、FL2VA 不带），不要统一 */
export function alignmentInstruction(refs, effectiveSec, declaredMode) {
  const ss = (Number(effectiveSec) || 0).toFixed(2);
  const { hasFirst, hasLast } = frameSlots(refs, declaredMode);

  if (hasFirst && !hasLast) {
    return `For the target video, at 0.00 seconds into the target video, <Picture ${frameIndex(refs, 'first', declaredMode)}> (from [Shot 1]) is fully referenced.`;
  }
  if (hasFirst && hasLast) {
    return `How the reference pictures align with the target video — Picture ${frameIndex(refs, 'first', declaredMode)} (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture ${frameIndex(refs, 'last', declaredMode)} (from [Shot 1]) aligns with the ${ss}-second mark of the target video.`;
  }
  if (!hasFirst && hasLast) {
    return `How the reference pictures align with the target video — <Picture ${frameIndex(refs, 'last', declaredMode)}> (from [Shot 1]) aligns with the ${ss}-second mark of the target video.`;
  }
  return '';
}

/** 拼基础格式正文 */
export function compileBase(ctx) {
  const { refs, scenes, soundscape, music, effectiveSec, input, subjects, warnings } = ctx;

  const lines = [];

  // declaredMode 必须传：i2va/fl2va/l2va 即使没有显式 firstFrame 也要有对齐指令
  const align = alignmentInstruction(refs, effectiveSec, normalizeMode(input.mode ?? 't2va'));
  if (align) {
    lines.push(align);
    lines.push('');
  }

  const desc = [];
  const styleLead = styleLeadSentence(ctx.style, input, warnings);
  if (styleLead) desc.push(styleLead);

  if (Array.isArray(scenes) && scenes.length) {
    let cursor = 0;
    scenes.forEach((sc, i) => {
      const shotNo = i + 1;
      const at = i === 0 ? `[Shot ${shotNo}]` : `[Shot ${shotNo}] At ${timecode(cursor)},`;
      const bits = [];
      if (sc.shotSize) bits.push(sc.shotSize);
      if (sc.action) bits.push(sc.action);
      let sentence = `${at} ${bits.filter(Boolean).join(', ')}`.trim();
      if (sc.camera) sentence += `. The camera ${cameraPhrase(sc.camera)}`;
      desc.push(endSentence(sentence));

      const speaker = resolveSpeaker(sc, subjects);
      if (sc.dialogue?.text) {
        const lang = sc.dialogue.lang || 'Chinese';
        const emo = sc.dialogue.emotion ? ` (${sc.dialogue.emotion})` : '';
        desc.push(
          `${speaker.label} is visible on screen and says${emo}: <d>[${lang}] ${sc.dialogue.text}</d>`,
        );
      }
      cursor = Number(sc.endSec) || (cursor + (Number(sc.durationSec) || 3));
    });
  } else if (String(input.sceneLayout ?? input.scene ?? '').trim()) {
    desc.push(String(input.sceneLayout ?? input.scene).trim());
  }

  lines.push(`integrated_multimodal_description: ${desc.join(' ')}`.trim());
  lines.push('');
  lines.push(`overall_soundscape: ${soundscape || 'Quiet environmental room tone with soft air movement.'}`);
  lines.push('');
  lines.push(`non_diegetic_music: ${music}`);

  return lines.join('\n');
}