/**
 * H3 提示词编译器 —— 门面与编译入口。
 *
 * 两套官方格式按模式二选一：基础格式（三字段 + 对齐指令）/ Ref2VA（六段）。
 * 子模块：spec · styles · route · base · ref2va · lint · text-utils · shot-adapter。
 *
 * 四条输出铁律：正文英文（中文只在 `<d>[Chinese] …</d>` 内）· 不写负面提示词
 * （CFG 固定 1.0，压制词只走 SUPPRESSION_GUARDS 授权位置）· 标签格式严格
 * （`<Picture N>` 半角空格 + 序号，三类各自从 1 起）· 帧数必须在 `17k+5` 网格上。
 *
 * @module prompt/h3-prompt
 */
import { normalizeMode } from '../../store/models.js';
import {
  H3_LIMITS, H3_MODES, RETENTION_VISUAL, RETENTION_AUDIO, SUMMARY_TASKS,
  CONTINUATION_SWITCH, TRIM_DISCIPLINE, SUPPRESSION_GUARDS, resolveContinuation,
} from './spec.js';
import {
  STYLE_PRESETS, LIGHTING_PRESETS, resolveLighting, styleLightingConflicts, resolveStyle,
} from './styles.js';
import { routeFormat } from './route.js';
import { compileBase, frameSlots } from './base.js';
import { compileRef2VA, cardBindingLines } from './ref2va.js';
import { lintCompiledPrompt, truncatePromptKeepFields, bindAuthoredValues } from './lint.js';
import {
  h3Frames, timecode, cameraPhrase, clampDuration,
  fixScene, buildScenesFromShots, deriveScenes, dedupe,
} from './text-utils.js';
import { toShotInputPackage, normalizeSubjects } from './shot-adapter.js';

// 画风/打光串注入 lint 的按值豁免表：官方串自带 "NO subtitles" / "DO NOT change…"
bindAuthoredValues([
  ...STYLE_PRESETS.map((s) => s?.en),
  ...LIGHTING_PRESETS.map((l) => l?.en),
]);

export {
  H3_LIMITS,
  H3_MODES,
  RETENTION_VISUAL,
  RETENTION_AUDIO,
  SUMMARY_TASKS,
  CONTINUATION_SWITCH,
  TRIM_DISCIPLINE,
  SUPPRESSION_GUARDS,
  resolveContinuation,
  STYLE_PRESETS,
  LIGHTING_PRESETS,
  resolveLighting,
  styleLightingConflicts,
  routeFormat,
  lintCompiledPrompt,
  truncatePromptKeepFields,
  h3Frames,
  timecode,
  cameraPhrase,
  toShotInputPackage,
};

/**
 * 编译 H3 提示词。
 *
 * @param {object} input 镜头输入包（见 toShotInputPackage 的形状）
 * @returns {{ prompt: string, truncated: boolean, format: 'base'|'ref', style: string,
 *   warnings: string[], chars: number, frames: number, durationSec: number,
 *   route: object, continuation: { isContinuation: boolean, index: number|null, trimFrames: number } }}
 */
export function compileH3Prompt(input = {}) {
  const warnings = [];
  const route = routeFormat(input);

  const style = resolveStyle(input);
  // pictureIndexMap 是本次真实 plan 的槽位映射，传了就压过镜头卡的陈旧编号
  const subjects = normalizeSubjects(input.subjects ?? input.characters ?? [], {
    pictureIndexMap: input.pictureIndexMap ?? null,
    warnings,
  });

  const r = input.references ?? {};
  const refs = {
    images: Array.isArray(r.images) ? r.images : [],
    videos: Array.isArray(r.videos) ? r.videos : [],
    audios: Array.isArray(r.audios) ? r.audios : [],
    videoUses: Array.isArray(r.videoUses) ? r.videoUses : [],
    audioModes: Array.isArray(r.audioModes) ? r.audioModes : [],
    firstFrame: r.firstFrame ?? null,
    lastFrame: r.lastFrame ?? null,
    firstFrameIndex: r.firstFrameIndex ?? null,
    lastFrameIndex: r.lastFrameIndex ?? null,
  };

  // 先定时长再定场景：派生出的 [Shot 1] 需要 endSec
  const durationSec = clampDuration(input.durationSec ?? input.duration_s ?? 5, warnings);
  const frames = h3Frames(durationSec);
  const effectiveSec = frames / H3_LIMITS.fps;

  const scenes = Array.isArray(input.scenes) && input.scenes.length
    ? input.scenes.map(fixScene)
    : (Array.isArray(input.shots) && input.shots.length
      ? buildScenesFromShots(input.shots)
      : deriveScenes(input, effectiveSec));

  // 不静默改时长：告诉用户真实落点
  if (Math.abs(effectiveSec - durationSec) > 0.05) {
    warnings.push(
      `时长 ${durationSec}s 会落到 H3 的 17k+5 帧网格上：实际 ${frames} 帧 ≈ ${effectiveSec.toFixed(2)}s`,
    );
  }

  const soundscape = String(input.overall_soundscape ?? input.soundscape ?? '').trim();
  const music = String(input.non_diegetic_music ?? input.music ?? 'N/A').trim() || 'N/A';

  if (refs.images.length > H3_LIMITS.refImages) {
    warnings.push(`参考图 ${refs.images.length} 张超过上限 ${H3_LIMITS.refImages}`);
  }
  if (refs.videos.length > H3_LIMITS.refVideos) {
    warnings.push(`参考视频 ${refs.videos.length} 段超过上限 ${H3_LIMITS.refVideos}`);
  }
  if (refs.audios.length > H3_LIMITS.refAudios) {
    warnings.push(`参考音频 ${refs.audios.length} 段超过上限 ${H3_LIMITS.refAudios}`);
  }
  const totalRefs = refs.images.length + refs.videos.length + refs.audios.length;
  if (totalRefs > H3_LIMITS.totalRefs) {
    warnings.push(`参考文件合计 ${totalRefs} 个超过上限 ${H3_LIMITS.totalRefs}`);
  }
  if (refs.audios.length && !refs.images.length && !refs.videos.length) {
    warnings.push('参考音频必须配至少 1 张参考图或 1 段参考视频（官方约束；本地节点不拦，但音色会漂）');
  }
  if (!soundscape) {
    warnings.push('overall_soundscape 为空 —— 官方要求这一项不能空，至少写一句环境底噪');
  }

  // 首尾帧与全参考互斥：官方明确两者不可同请求
  const slots = frameSlots(refs, normalizeMode(input.mode ?? 'ref2va'));
  const wantsFrames = slots.hasFirst || slots.hasLast;
  if (route.format === 'ref' && wantsFrames && !slots.implicit) {
    warnings.push(
      '首尾帧与全参考（Ref2VA）互斥：官方明确两者不可同请求。'
      + '要锁关键帧请改用 Ref2VA + MiniMaxH3AddGuide',
    );
  }
  if (route.format === 'ref' && slots.implicit && wantsFrames) {
    warnings.push(
      '声明了关键帧模式但请求里带参考视频/音频 —— 已按 Ref2VA 编译，关键帧对齐被忽略。'
      + '要把这些图当首尾帧，请先去掉参考视频/音频，或改用 AddGuide',
    );
  }

  const cont = resolveContinuation(input);
  if (cont.isContinuation && cont.index != null && cont.index > 1 && !cont.trimFrames) {
    warnings.push('续写段缺少 contextLength，已按默认 22 帧（0.92s）处理裁切区');
  }

  const ctx = {
    style, subjects, refs, scenes, soundscape, music, input,
    frames, effectiveSec, durationSec, warnings, cont,
  };
  const body = route.format === 'ref' ? compileRef2VA(ctx) : compileBase(ctx);

  // 续写开关必须在最顶部：段 2+ 写承接，段 1 写"这是开场、没有承接"
  let prompt;
  if (cont.isContinuation) {
    prompt = `${CONTINUATION_SWITCH.carried}\n${TRIM_DISCIPLINE.carried}\n\n${body}`;
  } else if (cont.index === 1) {
    prompt = `${CONTINUATION_SWITCH.opening}\n${TRIM_DISCIPLINE.opening}\n\n${body}`;
  } else {
    prompt = body;
  }

  lintCompiledPrompt(prompt, route.format, warnings);

  // 出口统一按字段边界截断，保住六段结构
  const limit = H3_LIMITS.promptMaxChars;
  let finalPrompt = prompt;
  let truncated = false;
  if (prompt.length > limit) {
    finalPrompt = truncatePromptKeepFields(prompt, limit);
    truncated = finalPrompt.length < prompt.length;
    if (truncated) {
      warnings.push(
        `提示词 ${prompt.length} 字符超过上限 ${limit}，已按字段边界截断到 ${finalPrompt.length}`
        + '（六段结构保持不变）。要完整内容请精简描述或拆成两段。',
      );
    }
  }

  return {
    prompt: finalPrompt,
    truncated,
    format: route.format,
    style: style.id,
    warnings: dedupe(warnings),
    chars: finalPrompt.length,
    frames,
    durationSec: Number(effectiveSec.toFixed(2)),
    route,
    continuation: {
      isContinuation: cont.isContinuation,
      index: cont.index,
      trimFrames: cont.trimFrames,
    },
  };
}

export { STYLE_PRESETS as H3_STYLE_PRESETS, H3_MODES as H3_MODE_LIST };