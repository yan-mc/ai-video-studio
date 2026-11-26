/**
 * 镜头卡 → 编译器输入包（业务适配层，非官方 schema）。
 * 唯一职责：把散落的镜头卡字段收拢成编译器的输入形状。
 * @module prompt/shot-adapter
 */
import { H3_LIMITS } from './spec.js';
import { h3Frames } from './text-utils.js';
import { routeFormat } from './route.js';

/**
 * 归一化 subjects，并用权威编号映射覆盖陈旧值。
 *
 * `subjects[].pictureIndex` 是写入那一刻的快照：参考图一增删、或 fl2va 开始占
 * 1/2 号槽，它就指向别的素材。所以调用方给了本次 plan 的编号就以 plan 为准，
 * 陈旧值丢弃并进 warnings（不得静默）。
 * @param {Array} list
 * @param {{ pictureIndexMap?: Map<number, number|null>|null, warnings?: string[] }} [opts]
 */
export function normalizeSubjects(list, opts = {}) {
  const warnings = Array.isArray(opts.warnings) ? opts.warnings : [];
  const map = opts.pictureIndexMap instanceof Map ? opts.pictureIndexMap : null;
  if (!Array.isArray(list)) return [];
  return list.map((s, i) => {
    const explicitNull = s.pictureIndex === null;
    const declared = explicitNull ? null : (s.pictureIndex ?? null);
    let pictureIndex = declared;

    if (map) {
      // 权威来源：本次真实 plan 分配的槽位号
      if (map.has(i)) {
        const planned = map.get(i);
        pictureIndex = planned === undefined ? declared : planned;
        if (declared != null && planned != null && Number(declared) !== Number(planned)) {
          warnings.push(
            `镜头卡里 <Subject ${i + 1}> 残留的 pictureIndex=${declared} 与本次参考图规划 ${planned} 不一致，`
            + `已按本次规划改写为 <Picture ${planned}>（旧编号会给错素材）`,
          );
        }
        if (planned == null && declared != null) {
          warnings.push(
            `镜头卡里 <Subject ${i + 1}> 残留的 pictureIndex=${declared}，但本次规划里该图没有分到槽位，`
            + '已丢弃该编号（按"无参考图"处理）',
          );
        }
      } else if (declared != null) {
        warnings.push(
          `镜头卡里 <Subject ${i + 1}> 残留的 pictureIndex=${declared}，但本次规划没有对应槽位，已丢弃该编号`,
        );
        pictureIndex = null;
      }
    } else if (declared == null && !explicitNull && s.hasImage !== false) {
      // 没有权威编号可用，只能按下标兜底 —— 但它不感知首尾帧占槽，
      // 所以必须大声说明，绝不静默（编号真源是 ref-images.planImageSlots）。
      pictureIndex = i + 1;
      warnings.push(
        `<Subject ${i + 1}> 没有 pictureIndex，且调用方未提供本次参考图编号规划 —— `
        + `已按 subject 顺序兜底为 <Picture ${i + 1}>。`
        + '该兜底不感知首/尾帧占用的槽位，可能出现编号偏移，请在调用方传入 pictureIndexMap',
      );
    }

    const hasImage = s.hasImage !== false && pictureIndex !== null;
    return {
      id: s.id ?? `S${i + 1}`,
      name: s.name ?? `Subject ${i + 1}`,
      pictureIndex: hasImage ? pictureIndex : null,
      gender: s.gender ?? '',
      heightCm: s.heightCm ?? null,
      description: String(s.description ?? '').trim(),
      traits: Array.isArray(s.traits) ? s.traits.join(', ') : (s.traits ?? ''),
      personality: s.personality ?? '',
      voiceDesc: s.voiceDesc ?? '',
      audioIndex: s.audioIndex ?? null,
      hasImage,
    };
  });
}

/** 把内部 shot 结构转成 H3 镜头输入包。 */
export function toShotInputPackage(shot = {}, opts = {}) {
  const warnings = Array.isArray(opts.warnings) ? opts.warnings : [];

  const route = routeFormat({
    mode: shot.mode ?? opts.mode,
    references: {
      images: shot.refs?.images ?? [],
      videos: shot.refs?.videos ?? [],
      audios: shot.refs?.audios ?? [],
      firstFrame: opts.firstFrame ?? shot.previz?.firstFramePath ?? null,
      lastFrame: opts.lastFrame ?? shot.previz?.lastFramePath ?? null,
    },
  });

  const cardSubjects = Array.isArray(shot.characterCards)
    ? shot.characterCards.map((c, i) => ({
      id: c.id ?? `C${i + 1}`,
      name: c.name ?? `Subject ${i + 1}`,
      // 编号必须由调用方用 planImageSlots 的真实槽位映射给出；
      // 这里的占位只有在完全没有参考图时才成立。
      pictureIndex: Number(opts.pictureIndexBase ?? 1) + i,
      traits: Array.isArray(c.traits) ? c.traits.join(', ') : (c.traits ?? ''),
      personality: c.personality ?? '',
      voiceDesc: c.voiceDesc ?? '',
      heightCm: null,
    }))
    : [];

  const frames = h3Frames(shot.durationSec ?? 5);
  const dur = frames / H3_LIMITS.fps;

  return {
    shot_id: shot.id ?? opts.shotId ?? 'unknown',
    mode: route.mode,
    duration_s: Math.round(dur * 100) / 100,
    ratio: shot.ratio ?? '16:9',
    style: shot.style ?? '',
    styleId: opts.styleId ?? shot.styleId ?? null,
    /** 打光通道：显式 opts > 镜头卡 lightingId > 镜头卡 lighting（自定义英文描述） */
    lightingId: opts.lightingId ?? shot.lightingId ?? null,
    lighting: opts.lighting ?? shot.lighting ?? null,
    /** 续写上下文：南风的续写任务 JSON 经 opts 透传进来 */
    continuationTask: opts.continuationTask ?? shot.continuationTask ?? null,
    continuationIndex: opts.continuationIndex ?? shot.continuationIndex ?? null,
    contextLength: opts.contextLength ?? shot.nanfeng?.overrides?.context_length ?? '22',
    subjects: opts.subjects ?? cardSubjects,
    /** 权威编号映射（planImageSlots 的 pictureIndexMap）—— 传了就压过陈旧值 */
    pictureIndexMap: opts.pictureIndexMap instanceof Map ? opts.pictureIndexMap : null,
    /** 参考绑定行（角色卡 → 槽位号），编译期写进 subject_definitions 段内 */
    referenceBindings: Array.isArray(opts.referenceBindings) ? opts.referenceBindings : [],
    references: {
      images: shot.refs?.images ?? [],
      videos: shot.refs?.videos ?? [],
      audios: shot.refs?.audios ?? [],
      videoUses: opts.videoUses ?? shot.refs?.videoUses ?? [],
      audioModes: opts.audioModes ?? shot.refs?.audioModes ?? [],
      firstFrame: opts.firstFrame ?? shot.previz?.firstFramePath ?? null,
      lastFrame: opts.lastFrame ?? shot.previz?.lastFramePath ?? null,
    },
    scene: opts.sceneLayout ?? shot.description ?? '',
    sceneLayout: opts.sceneLayout ?? shot.description ?? '',
    shots: opts.scenes ?? [
      {
        startSec: 0,
        endSec: dur,
        durationSec: dur,
        shotSize: '',
        action: shot.description ?? '',
        camera: shot.camera ?? '',
        sound: shot.sound ?? '',
        dialogue: shot.dialogue
          ? { speaker: 'S1', text: String(shot.dialogue), lang: 'Chinese', emotion: '' }
          : null,
      },
    ],
    overall_soundscape: shot.sound ?? '',
    non_diegetic_music: shot.music ?? 'N/A',
    /**
     * 引擎参考信息（不参与编译出正文）。`ref_image_size` 恒为 `'max'`：
     * 上游已硬编码该值，这里是实际发生的事，与参数通道「参考图尺寸」无关。
     */
    engine: {
      backend: 'local_comfyui',
      mode: route.mode,
      format: route.format,
      steps: opts.steps ?? 4,
      seed: opts.seed ?? 1101,
      ref_image_size: 'max',
    },
    warnings,
  };
}