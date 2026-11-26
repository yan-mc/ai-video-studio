/**
 * 渲染计划 —— 把「一个镜头这次要传什么」算成一份确定的清单。
 *
 * 渲染一个镜头涉及**参考图**、**参考视频**、**提示词**三类数据，它们强耦合：
 *   · `<Picture N>` 指的是第 N 张参考图，而顺序取决于"勾了哪些角色卡、每卡出几张"；
 *   · ref_images 上限 9 张（整条提示词共享），被裁掉的那张编号就失效；
 *   · 角色卡的文字设定要填进 subject_definitions 并标注引用第几张图。
 *
 * 这三件事必须由**同一份数据**推导，否则编号必然错位。
 * 所以：先算出图片清单 → 按清单位置生成编号 → 最后拼提示词。
 */

import { H3_MAX_REF_IMAGES, H3_MAX_TOTAL_REFS, cardImagesFor } from './character-vault.js';
// 参考图编号的唯一实现 —— 预览与真实提交必须同源
import { planImageSlots } from './ref-images.js';

/** 参考图的来源分类（决定优先级与提示词里的说明方式） */
export const REF_SOURCES = Object.freeze({
  CARD_SHEET: 'card-sheet',      // 角色卡的设定卡
  CARD_ORIGIN: 'card-origin',    // 角色卡的原立绘
  MANUAL: 'manual',              // 手工挂的参考图
  PREVIZ_FIRST: 'previz-first',  // 预演首帧
  PREVIZ_LAST: 'previz-last',    // 预演尾帧
  SCENE: 'scene',                // 场景参考
});

/** H3 的三类视频/音频参考上限（见 docs/H3参考输入契约.md） */
export const H3_MAX_REF_VIDEOS = 3;
export const H3_MAX_REF_AUDIOS = 3;

/**
 * 参考视频 + 参考音频的**合计时长上限**（秒）。
 *
 * H3 的参考输入是"总预算"制 —— 视频和音频共用同一段时间轴，超过后模型开始
 * 截断/降级且**不报错**。15 是理论边界，但探测时长本身有 ±0.1s 误差，
 * 贴着 15 卡容易实际提交时越界，所以留 0.2s 余量取 14.8。
 *
 * 这个限制**只约束参考输入的总时长**，与生成的视频长度（shot.durationSec，1–15s）
 * 是两回事。
 */
export const MAX_REFS_TOTAL_SEC = 14.8;

/**
 * 参考视频/音频的**单段**时长范围（秒），与 `h3-prompt.js` 的 H3_LIMITS 一致。
 *
 * 这里独立定义一份是因为 render-plan 不该依赖提示词编译器；两处数值必须相同。
 */
export const CLIP_SEC_RANGE = Object.freeze([2, 15]);

/**
 * 参考图缩放策略（节点 schema 的 ref_image_size）：
 *   match — 按生成面积等比缩小（快，日常够用）
 *   max   — 短边固定 2048，身份保真最好，但官方注明"可能慢数倍"
 *
 * 这是**质量 vs 速度**的真实取舍，用户该知道并能选。
 */
export const REF_IMAGE_SIZE_MODES = Object.freeze([
  { id: 'match', name: '跟随生成面积（快）', desc: '按输出分辨率等比缩放，日常首选' },
  { id: 'max', name: '最高保真（慢）', desc: '短边固定 2048，身份一致更好；显存紧张时慎用' },
]);

export function normalizeRefImageSize(v) {
  return v === 'max' ? 'max' : 'match';
}

/**
 * `max` 模式的显存门槛：**4GB 空闲**。
 *
 * `max` 把每张参考图缩到短边 2048（约 4.2MP），编码成 latent 后要常驻整个采样过程
 * （官方原话 "reference tokens ride through every sampling step"）。
 * 实测 12GB 卡跑 `max` + 2048² 参考图已接近上限；低于 4GB 空闲时
 * 模型权重加载 + max 参考图很容易 OOM。数字偏保守 —— 宁可提前降级并告知，
 * 也不要跑到一半崩掉。
 */
export const MAX_MODE_MIN_FREE_VRAM_BYTES = 4 * 1024 * 1024 * 1024;

/**
 * 决定这次到底用哪个 ref_image_size。原则：**不静默降级** ——
 * 自动降级本身是好事（避免 OOM），但用户必须知道"你要的 max 没生效、原因是什么"，
 * 所以返回 `{ value, requested, downgraded, reason }` 由调用方展示。
 *
 * 显存信息不可用时**不降级**（宁可按用户要求跑，失败时 ComfyUI 会明确报 OOM）。
 *
 * @param {string} requested   用户要的档位
 * @param {{ok:boolean, freeBytes:number}} [vram] 显存状态
 */
export function decideRefImageSize(requested, vram) {
  const want = normalizeRefImageSize(requested);
  if (want !== 'max') return { value: want, requested: want, downgraded: false, reason: '' };

  // 显存信息拿不到 → 尊重用户选择，不猜
  if (!vram?.ok) {
    return { value: 'max', requested: want, downgraded: false, reason: '' };
  }
  if (vram.freeBytes >= MAX_MODE_MIN_FREE_VRAM_BYTES) {
    return { value: 'max', requested: want, downgraded: false, reason: '' };
  }
  const freeGb = (vram.freeBytes / 1024 / 1024 / 1024).toFixed(1);
  const needGb = (MAX_MODE_MIN_FREE_VRAM_BYTES / 1024 / 1024 / 1024).toFixed(0);
  return {
    value: 'match',
    requested: want,
    downgraded: true,
    reason: `显存不足（空闲 ${freeGb}G，最高保真模式需要 ${needGb}G 以上），已自动降为「跟随生成面积」`,
  };
}

/**
 * 组装渲染计划。
 *
 * H3 的四类参考输入编号规则各不相同：`ref_images → <Picture i>`、
 * `ref_videos → <Video k>`、`ref_video_audios → <Audio j>`（与 Video **同号**）、
 * `ref_audios → <Audio j>`（全局累加，排在所有视频音轨之后）。
 * 最容易错的是**视频自带音轨会占用 <Audio> 编号**：1 个带音轨视频 + 1 个独立音频时，
 * `<Audio 1>` 是视频音轨、`<Audio 2>` 才是独立音频。本函数把四类都算进显式
 * `audioIndex`，避免调用方自己推。
 *
 * @param {object} opts
 * @param {object[]} [opts.cards]        已解析的角色卡（含 resolvedImages）
 * @param {string[]} [opts.manualImages] 手工参考图（rel 或绝对路径）
 * @param {object}   [opts.previz]       { firstFramePath, lastFramePath }
 * @param {string[]} [opts.sceneImages]  场景/道具参考
 * @param {Array<{rel:string,name?:string,hasAudio?:boolean}>} [opts.videos]
 * @param {Array<{rel:string,name?:string}>} [opts.audios]
 */
export function buildRenderPlan({
  cards = [],
  manualImages = [],
  previz = null,
  sceneImages = [],
  videos = [],
  audios = [],
  refImageSize = 'match',
  /** 镜头的真实生成模式。首尾帧占不占槽位取决于它（见 planImageSlots）。 */
  mode = null,
  vram = null,
} = {}) {
  const images = [];
  const warnings = [];

  // ---- 1) 角色卡的图：按卡的顺序，每张卡按 refPolicy 出图 ----
  //      角色卡永远排最前 —— 它们是一致性的锚点，被裁掉的代价最大。
  const cardPlans = [];
  for (const card of cards) {
    const picked = Array.isArray(card.resolvedImages) ? card.resolvedImages : cardImagesFor(card);
    cardPlans.push({ card, picked });
  }

  const pushImage = (rel, source, extra = {}) => {
    if (!rel) return null;
    // 同一张图不重复占位（角色卡常出现 sheet 与 origin 相同的情况）
    if (images.some((x) => x.rel === rel)) return images.find((x) => x.rel === rel);
    const item = { index: images.length + 1, rel, source, ...extra };
    images.push(item);
    return item;
  };

  for (const { card, picked } of cardPlans) {
    for (const img of picked) {
      pushImage(img.rel, img.slot === 'origin' ? REF_SOURCES.CARD_ORIGIN : REF_SOURCES.CARD_SHEET, {
        cardId: card.id,
        cardName: card.name,
        slot: img.slot,
      });
    }
  }

  // ---- 2) 预演首尾帧（优先级仅次于角色卡，它们有明确构图约束）----
  if (previz?.firstFramePath) pushImage(previz.firstFramePath, REF_SOURCES.PREVIZ_FIRST);
  if (previz?.lastFramePath) pushImage(previz.lastFramePath, REF_SOURCES.PREVIZ_LAST);

  // ---- 3) 手工参考图 ----
  for (const rel of manualImages) pushImage(rel, REF_SOURCES.MANUAL);

  // ---- 4) 场景/道具（优先级最低，超限时先砍）----
  for (const rel of sceneImages) pushImage(rel, REF_SOURCES.SCENE);

  // ---- 5) 预算裁剪 ----
  //      超限时从**优先级最低**的开始砍：场景 → 手工 → 原立绘 → 设定卡
  if (images.length > H3_MAX_REF_IMAGES) {
    const dropOrder = [REF_SOURCES.SCENE, REF_SOURCES.MANUAL, REF_SOURCES.PREVIZ_LAST,
      REF_SOURCES.PREVIZ_FIRST, REF_SOURCES.CARD_ORIGIN, REF_SOURCES.CARD_SHEET];
    for (const src of dropOrder) {
      while (images.length > H3_MAX_REF_IMAGES) {
        // 从后往前找该来源的项删掉
        let idx = -1;
        for (let i = images.length - 1; i >= 0; i -= 1) {
          if (images[i].source === src) { idx = i; break; }
        }
        if (idx < 0) break;
        const [gone] = images.splice(idx, 1);
        warnings.push(
          `参考图超出上限 ${H3_MAX_REF_IMAGES} 张，已移除 ${gone.source}：`
          + `${gone.cardName ? `${gone.cardName}/${gone.slot}` : gone.rel}`,
        );
      }
      if (images.length <= H3_MAX_REF_IMAGES) break;
    }
    // 重新编号（裁剪后编号必须连续，提示词才有意义）
    images.forEach((x, i) => { x.index = i + 1; });
  }

  // ---- 5.5) 参考视频 + 音频 ----
  //
  // 编号规则（见 docs/H3参考输入契约.md）：
  //   <Video k>  按视频顺序 1..K
  //   <Audio j>  视频自带音轨先占号，独立音频排在后面继续累加
  //
  // 这里一次算清，避免调用方自己推错。
  const videoList = [];
  for (const v of (videos ?? [])) {
    if (!v?.rel) continue;
    if (videoList.length >= H3_MAX_REF_VIDEOS) {
      warnings.push(`参考视频超出上限 ${H3_MAX_REF_VIDEOS} 段，已忽略：${v.name ?? v.rel}`);
      continue;
    }
    // 时长约束（H3 要求参考视频 2–15 秒）
    const dur = Number(v.durationSec);
    if (Number.isFinite(dur) && dur > 0) {
      const [min, max] = CLIP_SEC_RANGE;
      if (dur < min) {
        warnings.push(`参考视频「${v.name || v.rel}」只有 ${dur.toFixed(2)}s，短于 H3 要求的下限 ${min}s`);
      } else if (dur > max) {
        warnings.push(`参考视频「${v.name || v.rel}」有 ${dur.toFixed(2)}s，超过 H3 上限 ${max}s（会被截断到目标帧数）`);
      }
    }
    videoList.push({
      index: videoList.length + 1,          // <Video k>
      rel: v.rel,
      name: v.name ?? '',
      hasAudio: Boolean(v.hasAudio),
      durationSec: Number.isFinite(dur) ? dur : null,
    });
  }

  // 音频编号：视频音轨先占号
  let audioCounter = 0;
  for (const v of videoList) {
    if (v.hasAudio) {
      audioCounter += 1;
      v.audioIndex = audioCounter;          // 这段视频的音轨是 <Audio j>
    }
  }
  const audioList = [];
  for (const a of (audios ?? [])) {
    if (!a?.rel) continue;
    if (audioList.length >= H3_MAX_REF_AUDIOS) {
      warnings.push(`参考音频超出上限 ${H3_MAX_REF_AUDIOS} 段，已忽略：${a.name ?? a.rel}`);
      continue;
    }
    // 时长约束（H3 要求参考音频 2–15 秒）
    const dur = Number(a.durationSec);
    if (Number.isFinite(dur) && dur > 0) {
      const [min, max] = CLIP_SEC_RANGE;
      if (dur < min) {
        warnings.push(`参考音频「${a.name || a.rel}」只有 ${dur.toFixed(2)}s，短于 H3 要求的下限 ${min}s`);
      } else if (dur > max) {
        warnings.push(`参考音频「${a.name || a.rel}」有 ${dur.toFixed(2)}s，超过 H3 上限 ${max}s（会被截断）`);
      }
    }
    audioCounter += 1;
    audioList.push({
      index: audioList.length + 1,          // 独立音频里的第几段
      audioIndex: audioCounter,             // 提示词里的 <Audio j>
      rel: a.rel,
      name: a.name ?? '',
      durationSec: Number.isFinite(dur) ? dur : null,
    });
  }

  // ---- 参考视频 + 音频的**合计时长**预算（14.8s 硬限制）----
  //
  // 为什么要在这里裁：H3 的参考输入共用一段时间预算，超了模型会静默截断，
  // 用户看到的是"素材都传了但效果不对"，极难排查。
  // 所以宁可**明确拒绝**并说清超了多少、砍掉哪些，也不要静默降级。
  //
  // 裁剪优先级（先保留信息量最大的）：
  //   视频 > 独立音频  —— 视频同时携带动作与音轨，独立音频只是音色参考
  // 同一类内按**提交顺序**保留前面的。
  const totalMediaSec = () => {
    let s = 0;
    for (const v of videoList) if (Number.isFinite(v.durationSec)) s += v.durationSec;
    for (const a of audioList) if (Number.isFinite(a.durationSec)) s += a.durationSec;
    return s;
  };
  // 时长未知的项**不计入**（也无法计入），但它们仍会被提交，
  // 所以给一条提示让用户知道预算可能超。
  const unknownDur = [...videoList, ...audioList].filter((x) => !Number.isFinite(x.durationSec));
  if (unknownDur.length) {
    warnings.push(
      `有 ${unknownDur.length} 个参考文件的时长未知，无法计入 ${MAX_REFS_TOTAL_SEC}s 预算：`
      + unknownDur.map((x) => x.name || x.rel).join('、'),
    );
  }

  {
    let total = totalMediaSec();
    if (total > MAX_REFS_TOTAL_SEC) {
      // 先砍独立音频（从后往前）
      while (total > MAX_REFS_TOTAL_SEC && audioList.length) {
        const gone = audioList.pop();
        if (Number.isFinite(gone.durationSec)) total -= gone.durationSec;
        warnings.push(
          `参考视频+音频合计超出 ${MAX_REFS_TOTAL_SEC}s，已移除音频「${gone.name || gone.rel}」`
          + `（${Number.isFinite(gone.durationSec) ? gone.durationSec.toFixed(2) + 's' : '时长未知'}）`,
        );
      }
      // 还不够就砍视频（从后往前）
      while (total > MAX_REFS_TOTAL_SEC && videoList.length) {
        const gone = videoList.pop();
        if (Number.isFinite(gone.durationSec)) total -= gone.durationSec;
        warnings.push(
          `参考视频+音频合计超出 ${MAX_REFS_TOTAL_SEC}s，已移除视频「${gone.name || gone.rel}」`
          + `（${Number.isFinite(gone.durationSec) ? gone.durationSec.toFixed(2) + 's' : '时长未知'}）`,
        );
      }
      // 重新编号（裁剪后 <Video k> / <Audio j> 必须连续）
      videoList.forEach((v, i) => { v.index = i + 1; delete v.audioIndex; });
      let ac = 0;
      for (const v of videoList) { if (v.hasAudio) { ac += 1; v.audioIndex = ac; } }
      audioList.forEach((a, i) => { a.index = i + 1; ac += 1; a.audioIndex = ac; });
    }
  }

  // ---- 参考图保真档位（含显存保护）----
  const refDecision = decideRefImageSize(refImageSize, vram);
  if (refDecision.downgraded) warnings.push(refDecision.reason);

  // 官方另有"参考文件合计 ≤12"的保守约束
  const totalRefs = images.length + videoList.length + audioList.length;
  if (totalRefs > H3_MAX_TOTAL_REFS) {
    warnings.push(`参考文件合计 ${totalRefs} 个，超过保守上限 ${H3_MAX_TOTAL_REFS}`);
  }


  // ---- 7) 模式推断 ----
  //  Ref2VA 能带全部四类参考（图/视频/音频），是本工程的主力模式。
  //  只要有任何参考就建议 ref2va；纯首尾帧走 FL2VA/I2VA；什么都没有才是 T2VA。
  const hasRefShots = images.some((x) => x.source === REF_SOURCES.CARD_SHEET
    || x.source === REF_SOURCES.CARD_ORIGIN
    || x.source === REF_SOURCES.MANUAL
    || x.source === REF_SOURCES.SCENE);
  const hasFirst = images.some((x) => x.source === REF_SOURCES.PREVIZ_FIRST);
  const hasLast = images.some((x) => x.source === REF_SOURCES.PREVIZ_LAST);
  const hasVideo = videoList.length > 0;
  const hasAudio = audioList.length > 0 || videoList.some((v) => v.hasAudio);
  let suggestedMode = 'ref2va';
  if (hasRefShots || hasVideo || hasAudio) suggestedMode = 'ref2va';
  else if (hasFirst && hasLast) suggestedMode = 'fl2va';
  else if (hasFirst || hasLast) suggestedMode = 'i2va';
  else suggestedMode = 't2va';

  /**
   * 把「预览编号」对齐到「真实提交编号」。
   *
   * 真实提交走 `ref-images.planImageSlots`：**首尾帧会占用 图片1 / 图片2**，
   * 参考图从后面的槽位开始填。所以本函数的 index 必须由 `pictureIndexMap` 给出，
   * 不能是 `i + 1` —— 否则渲染页显示的编号与提示词里的编号整体差 1–2，
   * 用户以为 `<Picture 1>` 是角色、模型看到的却是首帧（串脸且不报错）。
   *
   * 首尾帧单独列出，不再混进 images 数组：它们不是"参考图"，是槽位占用者。
   */
  const refOnly = images.filter((x) => x.source !== REF_SOURCES.PREVIZ_FIRST
    && x.source !== REF_SOURCES.PREVIZ_LAST);
  const firstRel = previz?.firstFramePath ?? '';
  const lastRel = previz?.lastFramePath ?? '';
  /** 用镜头卡的真实 mode；调用方没传时才退回推断值 */
  const slotMode = mode ?? suggestedMode;
  const slotPlan = planImageSlots(
    slotMode,
    refOnly.map((x) => x.rel),
    firstRel,
    lastRel,
  );
  refOnly.forEach((x, i) => {
    // 被槽位规划丢弃的图 index = null（调用方据此判"这张不会提交"）
    x.index = slotPlan.pictureIndexMap.get(i) ?? null;
  });
  // ---- 6) 由图片清单反推 subjects（编号来自实际位置）----
  const subjects = [];
  for (const { card } of cardPlans) {
    // 这张卡实际留下了哪几张图？
    const mine = images.filter((x) => x.cardId === card.id);
    if (!mine.length) {
      // 卡被完全裁掉 → 仍保留文字定义，但标注"无图"
      subjects.push({
        id: card.id,
        name: card.name,
        pictureIndex: null,
        traits: normalizeTraits(card.traits),
        personality: card.personality ?? '',
        voiceDesc: card.voiceDesc ?? '',
        description: card.description ?? '',
        hasImage: false,
      });
      continue;
    }
    // 一号多图时，用第一张作为主引用
    subjects.push({
      id: card.id,
      name: card.name,
      pictureIndex: mine[0].index,
      allPictures: mine.map((x) => x.index),
      traits: normalizeTraits(card.traits),
      personality: card.personality ?? '',
      voiceDesc: card.voiceDesc ?? '',
      description: card.description ?? '',
      hasImage: true,
    });
  }

  return {
    /** 参考图（**index 已是真实 `<Picture N>`**；null = 不会提交） */
    images: refOnly,
    /** 首/尾帧要写的槽位（如 `{ 图片1: first.png }`）—— 它们不是参考图 */
    frameSlots: slotPlan.frameSlots,
    /** 因槽位不足被丢弃的参考图 */
    droppedImages: slotPlan.dropped,
    videos: videoList,
    audios: audioList,
    subjects,
    suggestedMode,
    refImageSize: refDecision.value,
    refImageSizeRequested: refDecision.requested,
    refImageSizeDowngraded: refDecision.downgraded,
    warnings,
    stats: {
      total: images.length,
      limit: H3_MAX_REF_IMAGES,
      remaining: H3_MAX_REF_IMAGES - images.length,
      bySource: countBy(images, 'source'),
      cardsWithImage: subjects.filter((s) => s.hasImage).length,
      cardsWithoutImage: subjects.filter((s) => !s.hasImage).length,
      // 视频/音频统计
      videoCount: videoList.length,
      videoLimit: H3_MAX_REF_VIDEOS,
      audioCount: audioList.length,
      audioLimit: H3_MAX_REF_AUDIOS,
      videoAudioCount: videoList.filter((v) => v.hasAudio).length,
      // 参考视频 + 音频的合计时长预算（14.8s 硬限制）
      mediaSec: Number(totalMediaSec().toFixed(3)),
      mediaSecLimit: MAX_REFS_TOTAL_SEC,
      mediaSecRemaining: Number(Math.max(0, MAX_REFS_TOTAL_SEC - totalMediaSec()).toFixed(3)),
      mediaSecOver: totalMediaSec() > MAX_REFS_TOTAL_SEC,
      totalRefs,
      totalRefsLimit: H3_MAX_TOTAL_REFS,
      hasVideo,
      hasAudio,
    },
  };
}

/**
 * 视频/音频的用途说明 —— **英文，进 subject_definitions**。
 *
 * H3 用 `<Video k>` / `<Audio j>` 标签引用参考素材，但模型不知道"这段是参考什么的"。
 * 一句自然语言指明用途远比只给标签有效。必须英文（正文语言一致），
 * 且必须放在 subject_definitions 段里 —— 官方明确模型对**开头**权重最高，
 * 把说明堆在提示词最前面会与风格定调争权重；`reference_notes` 也不是官方字段。
 *
 * @param {object} plan buildRenderPlan 的返回值
 * @returns {string[]} 每行一句英文定义
 */
export function buildMediaNotes(plan) {
  const notes = [];
  for (const v of (plan?.videos ?? [])) {
    const audioNote = v.hasAudio && v.audioIndex
      ? ` Its soundtrack is <Audio ${v.audioIndex}>.`
      : ' It carries no audio.';
    notes.push(`<Video ${v.index}> supplies camera movement and motion timing only.${audioNote}`);
  }
  for (const a of (plan?.audios ?? [])) {
    notes.push(`<Audio ${a.audioIndex}> supplies voice timbre and ambience only.`);
  }
  return notes;
}

function normalizeTraits(t) {
  if (Array.isArray(t)) return t.join('、');
  return String(t ?? '');
}

function countBy(arr, key) {
  const out = {};
  for (const x of arr) out[x[key]] = (out[x[key]] || 0) + 1;
  return out;
}

/**
 * 把渲染计划里的 subjects 转成 h3-prompt 需要的输入形态。
 * 关键：pictureIndex 直接用计划里的真实编号。
 */
export function subjectsForPrompt(plan) {
  return (plan?.subjects ?? []).map((s, i) => {
    /**
     * 三态语义必须原样传下去：`null` = **这张卡确实没有图**。
     *
     * `??` 对 `null` 也生效，所以不能用 `s.pictureIndex ?? (i + 1)` ——
     * 那会把"卡被裁掉 → pictureIndex: null"改写成"第 i+1 张图"。
     * 下游 h3-prompt 用 `=== null` 判断无图，拿到正整数就判成有图，
     * 于是 subject_definitions 写出指向**别的角色**的 `<Picture N>`。
     * 现在：`null` 就走 `null`，只有 `undefined`（字段缺失）才兜底编号。
     */
    const explicitNull = s.pictureIndex === null;
    const hasImage = s.hasImage !== false && !explicitNull;
    return {
      id: s.id ?? `S${i + 1}`,
      name: s.name ?? `角色${i + 1}`,
      pictureIndex: explicitNull ? null : (s.pictureIndex ?? (hasImage ? i + 1 : null)),
      traits: s.traits ?? '',
      personality: s.personality ?? '',
      voiceDesc: s.voiceDesc ?? '',
      heightCm: null,
      hasImage,
    };
  });
}
