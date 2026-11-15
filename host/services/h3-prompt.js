/**
 * H3 提示词编译器 —— 按官方六段式 / 三段式规范生成提示词。
 * 来源：用户提供的 H3 提示词工程体系（4 份技能书 + schema）
 *  - 《MiniMax H3 中文提示词技能》v3.1：六段式 Ref2VA 结构
 *  - 《完整工作流 Skill 2.3》：字段铁律 + 稳定性对策
 *  - 《H3提示词模板》：三段式 T2VA / 关键帧对齐指令
 *  - 《H3镜头输入包.schema.json》：可复现的镜头输入包
 *
 * 核心规则：
 *  1. 画风必须英文（视觉模型对英文风格词响应更精准），其余全中文
 *  2. 结构固定顺序：STYLE → REFERENCE RULE → subject_definitions →
 *     CHARACTER DEFINITION → summary → retention_analysis →
 *     SCENE LAYOUT → MOTION DESCRIPTION
 *  3. 音色只在 CHARACTER DEFINITION 绑定一次，分镜只写 (S1) + 情绪
 *  4. 三个声音字段（overall_soundscape / non_diegetic_music / 音效）不能空
 *  5. 参考视频必须声明用途，否则模型会照抄视频角色
 */

import { normalizeMode } from '../store/models.js';

/** 8 种画风（英文，直接复制用）—— 来自 seedance2.5技能书 + H3 中文提示词技能 */
export const STYLE_PRESETS = Object.freeze([
  {
    id: 'helltaker-look',
    name: '地狱把妹王（外观版）',
    category: '2D扁平卡通',
    changesAppearance: true,
    en: 'Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cartoon character design — slightly larger head, slender limbs, flat torso, simplified geometric shapes. Thick jagged black outlines. Flat cel-shaded coloring with block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. NO photorealistic textures, NO realistic skin shading, NO 3D proportions, NO PBR materials. NO subtitles, NO on-screen text.',
    ban: '写实质感、写实皮肤阴影、3D比例、PBR材质、渐变、柔光、模糊、照片级渲染',
    best: '暗黑戏剧、暴力动作、硬核狂野、冲击力亮相',
  },
  {
    id: 'helltaker-style',
    name: '地狱把妹王（画风版）',
    category: '2D扁平卡通',
    changesAppearance: false,
    en: 'Helltaker rendering style. High contrast black/white/deep red color palette. Flat cel-shaded coloring with block shadows, no gradients. Thick jagged black outlines. Render characters as 2D cartoons, NOT realistic. CRITICAL: Keep original character proportions unchanged. DO NOT exaggerate head size or limb length.',
    ban: '写实质感、写实皮肤阴影、PBR材质、渐变、柔光、比例改变、头部放大、四肢拉长',
    best: '需要 Helltaker 光影但角色比例必须保持',
  },
  {
    id: 'ova90s',
    name: '90年代OVA风',
    category: '2D手绘赛璐珞',
    changesAppearance: false,
    en: '90s OVA animation style. Cel animation look. High saturation colors. Hard shadows (not block shadows). Film grain texture. Natural human proportions. Soft gradient blush. Thick but not jagged outlines. 4K.',
    ban: '写实质感、实拍质感、3D比例、粗黑锯齿轮廓、块状阴影',
    best: '怀旧日常、喜剧四格、情感戏、轻度复古',
  },
  {
    id: 'shinkai',
    name: '新海诚风',
    category: '2D手绘柔光',
    changesAppearance: false,
    en: 'Makoto Shinkai animation style. Soft atmospheric lighting. Shallow depth of field with bokeh background. Pale blue sky with translucent clouds. Lens flare. Water reflections. Natural human proportions. 4K.',
    ban: '硬阴影、粗黑轮廓、高对比、块状阴影、赛璐珞质感、胶片颗粒',
    best: '治愈系、都市夜景、梦幻场景',
  },
  {
    id: 'ghibli',
    name: '吉卜力风',
    category: '2D手绘柔光',
    changesAppearance: false,
    en: 'Studio Ghibli animation style. Warm atmospheric lighting. Hand-painted watercolor texture. Soft organic lines on buildings and trees. Natural light without overexposure. Warm color palette, moderate saturation. Natural proportions. 4K.',
    ban: '硬阴影、高对比、冷色过蓝、过曝、写实质感、数码感',
    best: '田园风光、异世界、奇幻冒险、温馨日常',
  },
  {
    id: 'american-toon',
    name: '经典美式卡通',
    category: '2D扁平弹性',
    changesAppearance: true,
    en: 'Classic American cartoon style. Even outlines (no jagged lines). Squash-and-stretch deformation. Flat fill colors. Minimal shadows. Bright saturated color palette. 2D flat animation.',
    ban: '锯齿状轮廓、日式腮红、胶片颗粒、赛璐珞质感、高对比阴影',
    best: '喜剧、合家欢、夸张搞笑',
  },
  {
    id: 'ufotable',
    name: '飞碟社风',
    category: '3D背景+2D角色',
    changesAppearance: false,
    en: 'Ufotable animation style. Digital painting with high contrast cinematography. Photorealistic detailed backgrounds. 2D cel-shaded characters with large hard shadows. Dramatic lighting. Particle effects. Deep color palette with lower saturation. 4K.',
    ban: '粗黑轮廓线、平涂无阴影、低对比、浅景深虚化、柔光、水彩质感',
    best: '热血战斗、奇幻史诗、特效炫酷',
  },
  {
    id: 'toon3d-pbr',
    name: '三渲二 + PBR混合',
    category: '3D半写实',
    changesAppearance: false,
    en: '3D cel-shaded animation with PBR rendering. Thin dark outlines (not thick hand-drawn lines). Subsurface scattering on skin — soft, translucent, delicate. Soft studio lighting. Smooth shadow transitions, soft diffused shadows. Realistic fabric textures with wrinkles and bump. 3D physical hair strands with clear groups. Clean render, smooth surfaces.',
    ban: '粗黑手绘轮廓线、纯平涂赛璐珞、硬块状阴影、写实人类皮肤质感',
    best: '3D VTuber风格、偶像演出、现代都市',
  },
  {
    id: 'gohands',
    name: 'GoHands 风',
    category: '现代锐利',
    changesAppearance: false,
    en: 'GoHands-inspired aesthetic, high-saturation color palette, strong urban contrast, sharp highlights on hair and glass, vibrant sky gradients, modern sleek anime lines.',
    ban: '低饱和、柔光、胶片颗粒、粗黑轮廓',
    best: '现代都市、街头、强光影场景',
  },
]);

/** 五种生成模式 */
export const H3_MODES = Object.freeze([
  { id: 't2va', name: 'T2VA 文生视频', hint: '纯文本驱动', inputs: 0 },
  { id: 'i2va', name: 'I2VA 图生视频', hint: '1 张首帧图', inputs: 1 },
  { id: 'fl2va', name: 'FL2VA 首尾帧', hint: '0-2 张图（0=文生，1=首帧/尾帧，2=首尾帧）', inputs: 2 },
  { id: 'l2va', name: 'L2VA 尾帧收敛', hint: '1 张尾帧图，推断开头', inputs: 1 },
  { id: 'ref2va', name: 'Ref2VA 全参考', hint: '图≤9 + 视频≤3 + 音频≤3（结构最完整）', inputs: 12 },
]);

/** H3 硬约束（来自技能书 + 我们实测） */
export const H3_LIMITS = Object.freeze({
  durationSec: { min: 4, max: 15, recommend: [6, 10], warnAbove: 14 },
  fps: 24,
  refImages: 9,
  refVideos: 3,
  refAudios: 3,
  totalRefs: 12,
  videoClipSec: [2, 15],
  audioClipSec: [2, 15],
  promptMaxChars: 7000,
  canvasMultiple: 32,
});

/* ------------------------------------------------------------ 编译主函数 */

/**
 * 编译 H3 提示词。
 * @param {object} input 镜头输入包（见 schema）
 * @returns {{ prompt: string, mode: string, warnings: string[], chars: number }}
 */
export function compileH3Prompt(input = {}) {
  // ⚠️ 归一化模式名：短名（t2v/i2v/fl2v/ref2v）与长名（t2va/…）都要能进编译器。
  //    之前直接 String(input.mode ?? 'ref2va').toLowerCase()，
  //    't2v' 落到 else 分支 → 被当成关键帧模式，生成一段没有对齐指令的提示词。
  const mode = normalizeMode(input.mode ?? 'ref2va');
  const warnings = [];

  const style = resolveStyle(input);
  const subjects = normalizeSubjects(input.subjects ?? input.characters ?? []);
  const refs = normalizeRefs(input.references ?? input.refs ?? {});
  const scenes = Array.isArray(input.scenes) ? input.scenes : buildScenesFromShots(input.shots);
  const soundscape = input.overall_soundscape || input.soundscape || '';
  const music = input.non_diegetic_music ?? input.music ?? 'N/A';

  // 硬约束检查
  if (refs.images.length > H3_LIMITS.refImages) warnings.push(`参考图 ${refs.images.length} 张超过上限 ${H3_LIMITS.refImages}`);
  if (refs.videos.length > H3_LIMITS.refVideos) warnings.push(`参考视频 ${refs.videos.length} 段超过上限 ${H3_LIMITS.refVideos}`);
  if (refs.audios.length > H3_LIMITS.refAudios) warnings.push(`参考音频 ${refs.audios.length} 段超过上限 ${H3_LIMITS.refAudios}`);
  const totalRefs = refs.images.length + refs.videos.length + refs.audios.length;
  if (totalRefs > H3_LIMITS.totalRefs) warnings.push(`参考文件合计 ${totalRefs} 个超过上限 ${H3_LIMITS.totalRefs}`);
  if (refs.audios.length && !refs.images.length && !refs.videos.length) {
    warnings.push('音频参考不能单独使用，至少要配 1 张图或 1 段视频');
  }
  const dur = Number(input.durationSec ?? input.duration_s ?? 5);
  if (dur < H3_LIMITS.durationSec.min || dur > H3_LIMITS.durationSec.max) {
    warnings.push(`时长 ${dur}s 超出 H3 范围 ${H3_LIMITS.durationSec.min}-${H3_LIMITS.durationSec.max}s`);
  }
  if (dur > H3_LIMITS.durationSec.warnAbove) warnings.push(`${dur}s 属于高风险时长，14s 以上易崩溃`);
  if (!soundscape) warnings.push('overall_soundscape 为空（规范要求不能空）');

  let prompt;
  if (mode === 'ref2va') {
    prompt = compileRef2VA({ style, subjects, refs, scenes, soundscape, music, input });
  } else if (mode === 't2va') {
    prompt = compileT2VA({ style, subjects, scenes, soundscape, music, input });
  } else {
    prompt = compileKeyframe({ style, subjects, scenes, soundscape, music, input, mode });
  }

  if (prompt.length > H3_LIMITS.promptMaxChars) {
    warnings.push(`提示词 ${prompt.length} 字符超过 ${H3_LIMITS.promptMaxChars}，可能被截断`);
  }

  return { prompt, mode, style: style.id, warnings, chars: prompt.length };
}

/* ------------------------------------------------------------ 内部实现 */

function resolveStyle(input) {
  if (input.styleEn) return { id: 'custom', name: '自定义', en: String(input.styleEn), ban: '', changesAppearance: false };
  if (input.styleId) {
    const hit = STYLE_PRESETS.find((s) => s.id === input.styleId);
    if (hit) return hit;
  }
  // 兼容旧的自由文本 style 字段
  if (input.style) return { id: 'custom', name: String(input.style), en: String(input.style), ban: '', changesAppearance: false };
  return STYLE_PRESETS[2]; // 默认 90年代OVA
}

function normalizeSubjects(list) {
  return (list ?? []).map((s, i) => ({
    id: s.id ?? `S${i + 1}`,
    name: s.name ?? `角色${i + 1}`,
    // pictureIndex 为 null 表示"这张卡没有参考图"（被预算裁掉 / 本身没图）。
    // ⚠️ 不能回建成 i+1 —— 那会指向别的角色的图，比不写更糟。
    pictureIndex: s.pictureIndex === null ? null : (s.pictureIndex ?? (i + 1)),
    gender: s.gender ?? 'FEMALE',
    heightCm: s.heightCm ?? null,
    traits: s.traits ?? '',
    personality: s.personality ?? '',
    voiceDesc: s.voiceDesc ?? '',
    audioIndex: s.audioIndex ?? null,
    hasImage: s.hasImage !== false && s.pictureIndex !== null,
  }));
}

function normalizeRefs(refs) {
  return {
    images: refs.images ?? [],
    videos: refs.videos ?? [],
    audios: refs.audios ?? [],
    videoUses: refs.videoUses ?? [],   // ['motion','rhythm','mood']
    firstFrame: refs.firstFrame ?? null,
    lastFrame: refs.lastFrame ?? null,
  };
}

function buildScenesFromShots(shots) {
  if (!Array.isArray(shots)) return [];
  return shots.map((s, i) => ({
    index: i + 1,
    startSec: s.startSec ?? 0,
    endSec: s.endSec ?? s.durationSec ?? 3,
    shotSize: s.shotSize ?? s.size ?? '中景',
    action: s.action ?? s.description ?? '',
    camera: s.camera ?? '',
    sound: s.sound ?? '',
    dialogue: s.dialogue ?? null,   // { speaker:'S1', text:'', lang:'中文', emotion:'' }
  }));
}

function styleBlock(style) {
  // 画风必须英文；禁止词用中文
  const parts = ['CRITICAL STYLE RULE:', style.en];
  if (style.ban) parts.push(`禁止：${style.ban}。`);
  parts.push('NO subtitles, NO on-screen text.');
  return parts.join('\n');
}

function referenceRuleBlock(refs, subjects) {
  const lines = ['CRITICAL REFERENCE RULE:'];
  for (const s of subjects) {
    // 没有参考图的角色只声明身份，不写 <Picture N>（写了就是指向别人的图）
    if (s.pictureIndex === null || s.hasImage === false) {
      lines.push(`- ${s.name} 没有参考图，外观按文字描述。`);
      continue;
    }
    lines.push(`- <Picture ${s.pictureIndex}> 是 ${s.name} 的外观参考 — 面部、发型、服装全部保持一致。`);
  }
  // 参考视频必须声明用途（否则模型会照抄）
  refs.videos.forEach((_, i) => {
    const use = refs.videoUses[i] ?? 'motion';
    const map = {
      motion: '仅用于动作路径与镜头运动 — 不复制其中的角色外观或场景',
      rhythm: '仅用于剪辑节奏与切镜时机 — 不复制内容',
      mood: '仅用于氛围与光线 — 不用于角色设计',
      continuation: '是上一段视频 — 本次生成它的直接续篇，角色/场景/运镜全部延续',
    };
    lines.push(`- <Video ${i + 1}> ${map[use] ?? map.motion}。`);
  });
  // 音频
  refs.audios.forEach((_, i) => {
    const owner = subjects.find((s) => s.audioIndex === i + 1);
    lines.push(`- <Audio ${i + 1}> 是 ${owner?.name ?? '角色'} 的声音参考${owner?.voiceDesc ? ` — ${owner.voiceDesc}` : ''}，仅用于音色。`);
  });
  // 首尾帧
  if (refs.firstFrame) lines.push(`- <Picture ${refs.firstFrame}> 是**首帧图** — 起点的场景与角色状态。`);
  if (refs.lastFrame) lines.push(`- <Picture ${refs.lastFrame}> 是**尾帧图** — 终点的场景与角色状态。`);
  return lines.join('\n');
}

function subjectDefinitionsBlock(subjects) {
  const lines = ['subject_definitions:'];
  for (const s of subjects) {
    const bits = [];
    if (s.traits) bits.push(s.traits);
    if (s.heightCm) bits.push(`身高${s.heightCm}cm`);
    const look = (s.pictureIndex === null || s.hasImage === false)
      ? (bits.join('，') || '按文字描述')
      : `外观来自 <Picture ${s.pictureIndex}> — ${bits.join('，') || '保持一致'}`;
    lines.push(`${s.name} = ${look}。此角色为说话人 (${s.id})。`);
  }
  return lines.join('\n');
}

function characterDefinitionBlock(subjects) {
  const blocks = [];
  for (const s of subjects) {
    const lines = [`CHARACTER DEFINITION — ${s.name} (${s.id}):`];
    lines.push(`- 性别：${s.gender}`);
    if (s.heightCm) lines.push(`- 身高：${s.heightCm}cm`);
    if (s.traits) lines.push(`- 关键特征：${s.traits}`);
    if (s.personality) lines.push(`- 性格：${s.personality}`);
    // 音色只在这里绑定一次
    if (s.audioIndex) lines.push(`- 声音：锁定 <Audio ${s.audioIndex}>${s.voiceDesc ? `，${s.voiceDesc}` : ''}`);
    else if (s.voiceDesc) lines.push(`- 声音：${s.voiceDesc}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

function motionBlock(scenes) {
  const lines = ['MOTION DESCRIPTION:'];
  for (const sc of scenes) {
    const head = `[${fmt(sc.startSec)}s-${fmt(sc.endSec)}s] ${sc.shotSize}。`;
    let line = head + (sc.action || '');
    if (sc.camera) line += ` 运镜：${sc.camera}。`;
    lines.push(line);

    // 音效（画内）
    if (sc.sound) lines.push(`音效：${sc.sound}（叙事内）。`);

    // 台词：(S1) —— <d>[中文] 内容</d>（情绪）
    if (sc.dialogue?.text) {
      const spk = sc.dialogue.speaker ?? 'S1';
      const lang = sc.dialogue.lang ?? '中文';
      const emo = sc.dialogue.emotion ? `（${sc.dialogue.emotion}）` : '';
      lines.push(`音效：(${spk}) —— <d>[${lang}] ${sc.dialogue.text}</d>${emo}。`);
    }
  }
  return lines.join('\n');
}

function fmt(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? `${v}.0` : v.toFixed(1);
}

function sceneLayoutBlock(input, refs) {
  const lines = ['SCENE LAYOUT:'];
  lines.push(input.sceneLayout || input.scene || '（未指定场景）');
  if (refs.firstFrame) lines.push(`起始画面对齐 <Picture ${refs.firstFrame}>。`);
  if (refs.lastFrame) lines.push(`结束画面对齐 <Picture ${refs.lastFrame}>。`);
  return lines.join('\n');
}

/** Ref2VA 六段式 */
function compileRef2VA({ style, subjects, refs, scenes, soundscape, music, input }) {
  // 空字符串也要走兜底：`input.description` 为空时旧写法会生成 "summary:\n\n"，
  // 等于告诉模型"没有概要"，实测会让角色定义段失去上下文。
  const summary = (String(input.summary ?? '').trim())
    || (String(input.description ?? '').trim())
    || deriveSummary(subjects, scenes);
  const retention = input.retention_analysis || deriveRetention(subjects, refs);
  return [
    styleBlock(style),
    '',
    referenceRuleBlock(refs, subjects),
    '',
    subjectDefinitionsBlock(subjects),
    '',
    characterDefinitionBlock(subjects),
    '',
    'summary:',
    summary,
    '',
    'retention_analysis:',
    retention,
    '',
    `non_diegetic_music: ${music || 'N/A'}`,
    '',
    sceneLayoutBlock(input, refs),
    '',
    `overall_soundscape: ${soundscape || '环境底噪，轻柔空气声。'}`,
    '',
    motionBlock(scenes),
  ].join('\n');
}

/** T2VA 三段式 */
function compileT2VA({ style, subjects, scenes, soundscape, music, input }) {
  // 三段式：integrated_multimodal_description / overall_soundscape / non_diegetic_music
  const desc = [];
  desc.push(`[Shot 1] ${style.name}风格。`);
  if (input.sceneLayout || input.scene) desc.push(`${input.sceneLayout ?? input.scene}。`);
  for (const sc of scenes) {
    desc.push(`${sc.shotSize}，${sc.action || ''}${sc.camera ? ` 运镜：${sc.camera}。` : ''}`);
    if (sc.dialogue?.text) {
      const spk = sc.dialogue.speaker ?? 'S1';
      const lang = sc.dialogue.lang ?? '中文';
      desc.push(`${subjects.find((s) => s.id === spk)?.name ?? spk} (${spk}) says: <d>[${lang}] ${sc.dialogue.text}</d>。`);
    }
  }
  return [
    styleBlock(style),
    '',
    'integrated_multimodal_description:',
    desc.join(''),
    '',
    `overall_soundscape: ${soundscape || '环境底噪，轻柔空气声。'}`,
    '',
    `non_diegetic_music: ${music || 'N/A'}`,
  ].join('\n');
}

/** 关键帧模式（i2va / fl2va / l2va） */
function compileKeyframe({ style, subjects, scenes, soundscape, music, input, mode }) {
  const dur = Number(input.durationSec ?? input.duration_s ?? 5);
  const align = [];
  if (mode === 'i2va') {
    align.push(`How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video.`);
  } else if (mode === 'fl2va') {
    align.push(`How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture 2 (from [Shot 1]) aligns with the ${dur.toFixed(2)}-second mark of the target video.`);
  } else if (mode === 'l2va') {
    align.push(`How the reference pictures align with the target video — Picture 1 (from [Shot 1]) aligns with the ${dur.toFixed(2)}-second mark of the target video (ending frame).`);
  }

  const desc = [];
  desc.push(`[Shot 1] ${style.name}风格。`);
  if (input.sceneLayout || input.scene) desc.push(`${input.sceneLayout ?? input.scene}。`);
  for (const sc of scenes) {
    desc.push(`${sc.shotSize}，${sc.action || ''}${sc.camera ? ` 运镜：${sc.camera}。` : ''}`);
  }

  return [
    styleBlock(style),
    '',
    ...align,
    '',
    'integrated_multimodal_description:',
    desc.join(''),
    '',
    `overall_soundscape: ${soundscape || '环境底噪，轻柔空气声。'}`,
    '',
    `non_diegetic_music: ${music || 'N/A'}`,
  ].join('\n');
}

function deriveSummary(subjects, scenes) {
  const names = subjects.map((s) => s.name).join('与');
  const first = scenes[0]?.action ?? '';
  return `${names}的一段戏。${first}`.slice(0, 120);
}

function deriveRetention(subjects, refs) {
  const lines = [];
  for (const s of subjects) {
    if (s.pictureIndex === null || s.hasImage === false) {
      lines.push(`${s.name}：text_only — 没有参考图，按文字设定呈现。`);
      continue;
    }
    lines.push(`${s.name}（出现在 <Picture ${s.pictureIndex}>）：fully_preserved — 保持${s.traits || '面部、发型、服装'}一致。`);
  }
  refs.videos.forEach((_, i) => {
    const use = refs.videoUses[i] ?? 'motion';
    const map = {
      motion: 'attribute_transfer — 仅迁移动作与运镜，不复制角色',
      rhythm: 'weak_reference — 仅跟随剪辑节奏',
      mood: 'weak_reference — 仅跟随氛围光线',
      continuation: 'fully_preserved — 角色、场景、运镜全部延续',
    };
    lines.push(`<Video ${i + 1}>：${map[use] ?? map.motion}。`);
  });
  refs.audios.forEach((_, i) => {
    lines.push(`<Audio ${i + 1}>：reference — 仅跟随音色与语气，不复制波形。`);
  });
  return lines.join('\n');
}

/* ------------------------------------------------------- 镜头输入包（可复现） */

/** 把内部 shot 结构转成 H3 镜头输入包（对齐 schema） */
export function toShotInputPackage(shot, opts = {}) {
  const mode = normalizeMode(shot.mode ?? opts.mode ?? 'ref2va');
  // 角色卡 → subjects：让 subject_definitions 自动带上卡的文字设定。
  // pictureIndex 按卡在 refList 里的实际位置算（见 generator.js 的编号规则），
  // 这里用卡自身的 resolvedImages 顺序占位，最终以 generator 注入的为准。
  const cardSubjects = Array.isArray(shot.characterCards)
    ? shot.characterCards.map((c, i) => ({
      id: c.id ?? `C${i + 1}`,
      name: c.name ?? `角色${i + 1}`,
      pictureIndex: Number(opts.pictureIndexBase ?? 1) + i,
      traits: Array.isArray(c.traits) ? c.traits.join('、') : (c.traits ?? ''),
      personality: c.personality ?? '',
      voiceDesc: c.voiceDesc ?? '',
      heightCm: null,
    }))
    : [];
  return {
    shot_id: shot.id ?? opts.shotId ?? 'unknown',
    mode,
    duration_s: Math.max(4, Math.min(15, Math.round(Number(shot.durationSec) || 5))),
    ratio: shot.ratio ?? '16:9',
    canvas: opts.canvas ?? [864, 480],
    style: shot.style ?? '',
    styleId: opts.styleId ?? shot.styleId ?? null,
    subjects: opts.subjects ?? cardSubjects,
    references: {
      images: shot.refs?.images ?? [],
      videos: shot.refs?.videos ?? [],
      audios: shot.refs?.audios ?? [],
    },
    ...(mode === 'ref2va' ? {} : {
      keyframes: {
        first: shot.previz?.firstFramePath ?? null,
        last: shot.previz?.lastFramePath ?? null,
      },
    }),
    scene: shot.description ?? '',
    sceneLayout: opts.sceneLayout ?? shot.description ?? '',
    shots: opts.scenes ?? [
      {
        startSec: 0,
        endSec: Number(shot.durationSec) || 5,
        shotSize: '中景',
        action: shot.description ?? '',
        camera: shot.camera ?? '',
        sound: shot.sound ?? '',
        dialogue: shot.dialogue ? { speaker: 'S1', text: String(shot.dialogue), lang: '中文', emotion: '' } : null,
      },
    ],
    overall_soundscape: shot.sound ?? '',
    non_diegetic_music: shot.music ?? 'N/A',
    engine: {
      backend: 'local_comfyui',
      model: opts.model ?? 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors',
      mode,
      steps: opts.steps ?? 4,
      sampler: 'resample_multistep',
      scheduler: 'simple',
      seed: opts.seed ?? 1101,
      ref_image_size: 'match',
    },
  };
}

export { STYLE_PRESETS as H3_STYLE_PRESETS, H3_MODES as H3_MODE_LIST };