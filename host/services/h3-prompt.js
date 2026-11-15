/**
 * H3 提示词编译器 —— **唯一权威实现**。
 *
 * ============================================================================
 * 这套格式的出处（务必先读，避免再被"多版方案"带偏）
 * ============================================================================
 *
 * MiniMax H3（海螺 3，2026-07-31 发布 / 08-03 开源权重）官方只提供**两套**
 * 提示词格式，按任务模式二选一，不存在"第三套更好的"：
 *
 *   ① 基础格式（T2VA / I2VA / FL2VA / L2VA）
 *      首行：对齐指令（仅关键帧模式需要）+ 恰好一个空行
 *      然后三字段：integrated_multimodal_description / overall_soundscape /
 *                  non_diegetic_music
 *
 *   ② 全参考格式（Ref2VA）
 *      六字段固定顺序：
 *        subject_definitions → summary → retention_analysis →
 *        detailed_description → overall_soundscape → non_diegetic_music
 *
 * 所以真正缺的**不是"哪个模板对"，而是一层模式路由器**。
 * 本文件的 `routeFormat()` 就是那层路由器：有参考素材走 ②，没有走 ①。
 *
 * 来源：
 *  - 官方 skill `h3-prompt-writing`：references/base-en.txt（基础格式）
 *                                   references/ref-en.txt（六段格式）
 *  - ComfyUI 官方提示词指南 docs.comfy.org/tutorials/video/minimax/
 *  - 取证记录：docs/probes/h3-prompt-research/REPORT.md
 *
 * ============================================================================
 * 本文件的历史包袱（已清理，别再加回来）
 * ============================================================================
 *  - 曾把"三段式"和"六段式"当作互斥的两派方案；其实它们是**同一份官方规范的
 *    两个分支**，混用才出错。
 *  - 曾把 `/^\[(\d+)-(\d+)s\]/` 这种时间区间写进 MOTION DESCRIPTION；官方只接受
 *    单点时间戳 `At 00:05.000,`，区间是非法格式。
 *  - 曾用 `subject_definitions` + `CHARACTER DEFINITION` 两段重复描述同一角色，
 *    后者不存在于官方格式里，纯粹稀释权重。
 *  - 曾在 audio 上套用视觉保留标记（fully_preserved）；音频有独立的一套标记，
 *    两套只有 `weak_reference` 共有。
 *
 * ============================================================================
 * 四条输出铁律
 * ============================================================================
 *  1. **正文英文**。中文只允许出现在 `<d>[Chinese] 台词</d>` 里和画面文字的
 *     双引号内。中文正文不是官方路径，本地还会踩 tokenizer 的坑。
 *  2. **不写负面提示词**。本地 CFG 固定 1.0，采样器没有 negative 分支
 *     （BasicGuider），写"不要 XX"反而把 XX 拉进画面。要排除就写"画面里只有…"。
 *  3. **标签格式严格**：`<Picture 1>` / `<Video 1>` / `<Audio 1>` / `<Subject 1>`，
 *     尖括号 + 半角空格 + 序号，三类各自从 1 开始编号。
 *  4. **先算帧数再写时间戳**。帧数必须在 `17k+5` 网格上（124…362），
 *     所有时间戳 < frames/24。
 */

import { normalizeMode, h3Length } from '../store/models.js';

/* ============================================================ 官方枚举 */

/** 视觉类保留标记（用于 <Subject> / <Picture> / <Video>） */
export const RETENTION_VISUAL = Object.freeze([
  'fully_preserved', 'partially_preserved', 'attribute_transfer', 'weak_reference',
]);

/**
 * 音频类保留标记（用于 <Audio>）。
 *
 * ⚠️ 两套标记**不可混用**。`weak_reference` 是唯一共有的一个。
 *    社区转载最常犯的错就是拿 `fully_preserved` 去描述一段音频。
 */
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

/**
 * 硬约束 —— **全部有官方出处**（见 docs/probes/h3-prompt-research/REPORT.md §三）。
 *
 * ⚠️ `durationSec.min` 是 5 而不是 4：
 *    官方口径写 4–15 秒，但 ComfyUI 节点的帧网格是 `17k+5` 且最短可用 124 帧
 *    （≈5.17 秒）。36 帧以下在这个网格上不可达。**以节点实测为准，别对用户
 *    承诺 4 秒。**
 */
export const H3_LIMITS = Object.freeze({
  durationSec: { min: 5, max: 15, recommend: [5, 10], warnAbove: 14 },
  /** 官方口径（仅作提示，实际以 frames 为准） */
  officialDurationSec: { min: 4, max: 15 },
  fps: 24,
  frames: { grid: '17k+5', min: 124, max: 362, default: 124 },
  refImages: 9,
  refVideos: 3,
  refAudios: 3,
  totalRefs: 12,
  videoClipSec: [2, 15],
  audioClipSec: [2, 15],
  /** 参考视频/音频的**合计**时长上限 */
  mediaTotalSec: 15,
  promptMaxChars: 7000,
  canvasMultiple: 32,
  /** 16:9 原生档 */
  nativeCanvas: [1344, 768],
});

/* ============================================================ 画风库 */

/**
 * 画风预设 —— **本地风格集，非官方**。
 *
 * 检索确认 `OVA90s` / `Helltaker-look` / `toon3d-pbr` 这三个名字没有公开出处，
 * 是本项目自造的标签。保留它们没问题（用户已经在用），但：
 *
 *  ⚠️ 社区反模式 #5：**风格词会与参考素材竞争**。有参考图/参考视频时，
 *     过长的风格块会把画面拽向风格词而不是参考素材。
 *     所以 `styleBlock()` 在 Ref2VA 分支下只取前 `SHORT_STYLE_CHARS` 个字符，
 *     并给出警告。风格 LoRA 强度也建议压到 ~0.5。
 */
export const STYLE_PRESETS = Object.freeze([
  {
    id: 'helltaker-look',
    name: '地狱把妹王（外观版）',
    category: '2D扁平卡通',
    changesAppearance: true,
    en: 'Helltaker game visual aesthetic. High contrast black/white/deep red palette. Flat cartoon character design with thick jagged black outlines and flat cel-shaded block shadows, no gradients.',
    ban: '写实质感、写实皮肤阴影、3D比例、PBR材质、渐变、柔光、模糊、照片级渲染',
    best: '暗黑戏剧、暴力动作、硬核狂野、冲击力亮相',
  },
  {
    id: 'helltaker-style',
    name: '地狱把妹王（画风版）',
    category: '2D扁平卡通',
    changesAppearance: false,
    en: 'Helltaker rendering style. High contrast black/white/deep red palette, flat cel-shaded coloring with block shadows and no gradients, thick jagged black outlines. Keep original character proportions unchanged.',
    ban: '写实质感、写实皮肤阴影、PBR材质、渐变、柔光、比例改变、头部放大、四肢拉长',
    best: '需要 Helltaker 光影但角色比例必须保持',
  },
  {
    id: 'ova90s',
    name: '90年代OVA风',
    category: '2D手绘赛璐珞',
    changesAppearance: false,
    en: '90s OVA animation style. Cel animation look, high saturation colors, hard shadows, film grain texture, natural human proportions, soft gradient blush, thick smooth outlines.',
    ban: '写实质感、实拍质感、3D比例、粗黑锯齿轮廓、块状阴影',
    best: '怀旧日常、喜剧四格、情感戏、轻度复古',
  },
  {
    id: 'shinkai',
    name: '新海诚风',
    category: '2D手绘柔光',
    changesAppearance: false,
    en: 'Makoto Shinkai animation style. Soft atmospheric lighting, shallow depth of field with bokeh background, pale blue sky with translucent clouds, lens flare, water reflections, natural human proportions.',
    ban: '硬阴影、粗黑轮廓、高对比、块状阴影、赛璐珞质感、胶片颗粒',
    best: '治愈系、都市夜景、梦幻场景',
  },
  {
    id: 'ghibli',
    name: '吉卜力风',
    category: '2D手绘柔光',
    changesAppearance: false,
    en: 'Studio Ghibli animation style. Warm atmospheric lighting, hand-painted watercolor texture, soft organic lines on buildings and trees, natural light without overexposure, warm palette with moderate saturation.',
    ban: '硬阴影、高对比、冷色过蓝、过曝、写实质感、数码感',
    best: '田园风光、异世界、奇幻冒险、温馨日常',
  },
  {
    id: 'american-toon',
    name: '经典美式卡通',
    category: '2D扁平弹性',
    changesAppearance: true,
    en: 'Classic American cartoon style. Even outlines with uniform line weight, squash-and-stretch deformation, flat fill colors, minimal shadows, bright saturated palette, 2D flat animation.',
    ban: '锯齿状轮廓、日式腮红、胶片颗粒、赛璐珞质感、高对比阴影',
    best: '喜剧、合家欢、夸张搞笑',
  },
  {
    id: 'ufotable',
    name: '飞碟社风',
    category: '3D背景+2D角色',
    changesAppearance: false,
    en: 'Ufotable animation style. Digital painting with high contrast cinematography, photorealistic detailed backgrounds, 2D cel-shaded characters with large hard shadows, dramatic lighting, particle effects, deep palette with lower saturation.',
    ban: '粗黑轮廓线、平涂无阴影、低对比、浅景深虚化、柔光、水彩质感',
    best: '热血战斗、奇幻史诗、特效炫酷',
  },
  {
    id: 'toon3d-pbr',
    name: '三渲二 + PBR混合',
    category: '3D半写实',
    changesAppearance: false,
    en: '3D cel-shaded animation with PBR rendering. Thin dark outlines, subsurface scattering on soft translucent skin, soft studio lighting with smooth shadow transitions, realistic fabric textures with wrinkles and bump, 3D physical hair strands.',
    ban: '粗黑手绘轮廓线、纯平涂赛璐珞、硬块状阴影、写实人类皮肤质感',
    best: '3D VTuber风格、偶像演出、现代都市',
  },
  {
    id: 'gohands',
    name: 'GoHands 风',
    category: '现代锐利',
    changesAppearance: false,
    en: 'GoHands-inspired aesthetic with high-saturation palette, strong urban contrast, sharp highlights on hair and glass, vibrant sky gradients, modern sleek anime lines.',
    ban: '低饱和、柔光、胶片颗粒、粗黑轮廓',
    best: '现代都市、街头、强光影场景',
  },
]);

/** Ref2VA 分支下风格块的最大字符数（避免与参考素材抢权重） */
const SHORT_STYLE_CHARS = 180;

/* ============================================================ 模式路由 */

/**
 * **唯一**的格式路由器。
 *
 * 输入：镜头/输入包
 * 输出：{ mode, format, reason }
 *
 *   format='base' → 基础格式（对齐指令 + 三字段）
 *   format='ref'  → Ref2VA 六段格式
 *
 * 判定依据（按优先级）：
 *   1. 有参考视频或参考音频 → 一定走 ref（基础格式没有 <Video>/<Audio> 概念）
 *   2. 非关键帧模式且参考图 > 0 → ref
 *   3. 关键帧模式（i2va/fl2va/l2va）即使有图也走 base —— 那些图是**帧锚点**
 *      不是外观参考。这正是社区反模式 #9「把参考图都当关键帧」的镜像错误：
 *      把帧锚点当参考图。
 *   4. 什么都没有 → base（t2va）
 *
 * @param {object} input
 * @returns {{mode: string, format: 'base'|'ref', reason: string}}
 */
export function routeFormat(input = {}) {
  const refs = normalizeRefs(input.references ?? input.refs ?? {});
  const declared = normalizeMode(input.mode ?? 'ref2va');
  const imgCount = refs.images.length;
  const vidCount = refs.videos.length;
  const audCount = refs.audios.length;

  // 关键帧模式是**互斥**的：官方明确 首尾帧 ⊥ 全参考。
  const isKeyframe = declared === 'i2va' || declared === 'fl2va' || declared === 'l2va';
  const hasMedia = vidCount > 0 || audCount > 0;
  const hasAnnouncedFrames = Boolean(refs.firstFrame || refs.lastFrame);
  const wantsFrames = isKeyframe || hasAnnouncedFrames;

  /**
   * "有角色卡引用图"也算有参考素材。
   *
   * ⚠️ 为什么必须算：`/prompt/compile` 之类的入口可能只传 subjects
   *    （每张卡带 pictureIndex），图在 plan 里单独管理。
   *    只看 refs.images 会把这种情况误判成"没有参考素材"→ 走基础格式 →
   *    `<Picture N>` 与 retention_analysis 全部消失，角色一致性表述直接蒸发。
   */
  const subjects = Array.isArray(input.subjects ?? input.characters) ? (input.subjects ?? input.characters) : [];
  const declaredPics = subjects.filter((s) => s && s.pictureIndex != null && s.hasImage !== false).length;

  // 1) 参考视频/音频只能走 Ref2VA
  if (hasMedia) {
    return {
      mode: 'ref2va',
      format: 'ref',
      reason: `有 ${vidCount} 段参考视频 / ${audCount} 段参考音频 —— 基础格式没有 <Video>/<Audio> 概念，必须走 Ref2VA`,
    };
  }

  // 2) 显式声明为 Ref2VA 且有图
  if (declared === 'ref2va' && (imgCount > 0 || declaredPics > 0)) {
    return {
      mode: 'ref2va',
      format: 'ref',
      reason: imgCount > 0
        ? `声明 Ref2VA 且有 ${imgCount} 张参考图`
        : `声明 Ref2VA 且有 ${declaredPics} 个角色声明了参考图编号`,
    };
  }

  // 3) 关键帧模式（图是帧锚点）
  if (wantsFrames) {
    const mode = isKeyframe ? declared : (hasAnnouncedFrames ? 'fl2va' : 't2va');
    return {
      mode,
      format: 'base',
      reason: '关键帧模式：图片是首/尾帧锚点，走基础格式的对齐指令',
    };
  }

  // 4) 有图但没声明模式 → 按全参考处理（用户放了图就是想要一致性）
  if (imgCount > 0 || declaredPics > 0) {
    return {
      mode: 'ref2va',
      format: 'ref',
      reason: imgCount > 0
        ? `有 ${imgCount} 张参考图但未声明模式 —— 按 Ref2VA 处理（图是外观参考，不是帧锚点）`
        : `有 ${declaredPics} 个角色声明了参考图编号但未声明模式 —— 按 Ref2VA 处理`,
    };
  }

  // 5) 纯文本
  return { mode: 't2va', format: 'base', reason: '没有任何参考素材，走基础格式的文生视频' };
}

/* ============================================================ 编译主函数 */

/**
 * 编译 H3 提示词。
 *
 * @param {object} input 镜头输入包（见 toShotInputPackage 的形状）
 * @returns {{
 *   prompt: string, mode: string, format: 'base'|'ref', style: string,
 *   warnings: string[], chars: number, frames: number, durationSec: number,
 *   route: {mode:string, format:string, reason:string}
 * }}
 */
export function compileH3Prompt(input = {}) {
  const warnings = [];
  const route = routeFormat(input);

  const style = resolveStyle(input);
  const subjects = normalizeSubjects(input.subjects ?? input.characters ?? []);
  const refs = normalizeRefs(input.references ?? input.refs ?? {});

  // 先定时长，再定场景 —— 派生出的 [Shot 1] 需要 endSec
  const durationSec = clampDuration(input.durationSec ?? input.duration_s ?? 5, warnings);
  const frames = h3Frames(durationSec);
  const effectiveSec = frames / H3_LIMITS.fps;

  const scenes = Array.isArray(input.scenes) && input.scenes.length
    ? input.scenes.map(fixScene)
    : (Array.isArray(input.shots) && input.shots.length
      ? buildScenesFromShots(input.shots)
      : deriveScenes(input, effectiveSec));

  if (Math.abs(effectiveSec - durationSec) > 0.05) {
    // 不要静默改时长：告诉用户真实落点
    warnings.push(
      `时长 ${durationSec}s 会落到 H3 的 17k+5 帧网格上：实际 ${frames} 帧 ≈ ${effectiveSec.toFixed(2)}s`,
    );
  }

  const soundscape = String(input.overall_soundscape ?? input.soundscape ?? '').trim();
  const music = String(input.non_diegetic_music ?? input.music ?? 'N/A').trim() || 'N/A';

  /* -------------------------------------------------------- 硬约束自查 */

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
  // 官方模型卡要求：音频必须伴随至少一张参考图或一段参考视频。
  // ComfyUI 节点源码没有这道校验（能跑通），但违反官方 API 语义，且实测音色
  // 会漂。这里按官方约束拦，不按节点能力放行。
  if (refs.audios.length && !refs.images.length && !refs.videos.length) {
    warnings.push('参考音频必须配至少 1 张参考图或 1 段参考视频（官方约束；本地节点不拦，但音色会漂）');
  }
  if (!soundscape) {
    warnings.push('overall_soundscape 为空 —— 官方要求这一项不能空，至少写一句环境底噪');
  }
  // 首尾帧与全参考（Ref2VA）互斥
  //
  // ⚠️ 官方明确：`first_frame/last_frame` 与 `ref_images/ref_videos/ref_audios`
  //    不可同请求。以前只在有显式 firstFrame 时才检查，于是"声明 fl2va +
  //    传了参考视频"这种组合会静默通过，到 ComfyUI 才变成诡异的结果。
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
      `声明了关键帧模式但请求里带参考视频/音频 —— 已按 Ref2VA 编译，关键帧对齐被忽略。`
      + '要把这些图当首尾帧，请先去掉参考视频/音频，或改用 AddGuide',
    );
  }

  /* -------------------------------------------------------------- 编译 */

  const ctx = {
    style, subjects, refs, scenes, soundscape, music, input,
    frames, effectiveSec, durationSec, warnings,
  };

  const prompt = route.format === 'ref' ? compileRef2VA(ctx) : compileBase(ctx);

  /* -------------------------------------------------------- 输出后检查 */

  lintCompiledPrompt(prompt, route.format, warnings);

  return {
    prompt,
    mode: route.mode,
    format: route.format,
    style: style.id,
    warnings: dedupe(warnings),
    chars: prompt.length,
    frames,
    durationSec: Number(effectiveSec.toFixed(2)),
    route,
  };
}

/* ============================================================ 基础格式 */

/**
 * 基础格式（T2VA / I2VA / FL2VA / L2VA）。
 *
 * 结构：
 *   [对齐指令 —— 仅关键帧模式，必须是第一行，后接恰好一个空行]
 *   integrated_multimodal_description: ...
 *   <空行>
 *   overall_soundscape: ...
 *   <空行>
 *   non_diegetic_music: ...
 */
function compileBase(ctx) {
  const { refs, scenes, soundscape, music, effectiveSec, input, subjects } = ctx;

  const lines = [];

  // ---- 对齐指令（官方逐字句式，只把时长/镜号替换掉）----
  // declaredMode 必须传进去：i2va/fl2va/l2va 即使没有显式 firstFrame 字段，
  // 也要按"图序列即关键帧序列"生成对齐指令。
  const align = alignmentInstruction(refs, effectiveSec, normalizeMode(input.mode ?? 't2va'));
  if (align) {
    lines.push(align);
    lines.push('');          // 恰好一个空行
  }

  // ---- integrated_multimodal_description ----
  const desc = [];
  const styleLead = styleLeadSentence(ctx.style, input);
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
      desc.push(`${sentence.replace(/\.\./g, '.')}.`.replace(/\.\./g, '.'));

      const speaker = resolveSpeaker(sc, subjects);
      if (sc.dialogue?.text) {
        const lang = sc.dialogue.lang || 'Chinese';
        const emo = sc.dialogue.emotion ? ` (${sc.dialogue.emotion})` : '';
        desc.push(
          `${speaker.label} is visible on screen and says${emo}: <d>[${lang}] ${sc.dialogue.text}</d>`,
        );
      }
      // 画内音效（非配乐）归 soundscape，这里只在有需要时补一句
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

/**
 * 官方三种对齐指令 —— **逐字句式**，不要改写。
 *
 *  I2VA:  For the target video, at 0.00 seconds into the target video,
 *         <Picture 1> (from [Shot 1]) is fully referenced.
 *  FL2VA: How the reference pictures align with the target video —
 *         Picture 1 (from [Shot 1]) aligns with the 0.00-second mark of the
 *         target video; Picture 2 (from [Shot N]) aligns with the S.SS-second
 *         mark of the target video.
 *  L2VA:  How the reference pictures align with the target video —
 *         <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the
 *         target video.
 *
 * 注：三种写法在官方里本来就不完全统一（I2VA 带尖括号，FL2VA 不带），
 *     这是原文如此，**照抄**，不要"顺手统一"，统一了就偏离训练分布。
 */
/**
 * 首/尾帧的 **<Picture N> 编号**。
 *
 * ⚠️ 官方对齐指令里的 `<Picture 1>` 是**参考图序号**，不是文件路径。
 *    以前直接把 `refs.firstFrame`（一个 rel 路径，如 "previz/x.png"）拼进
 *    `<Picture f.png>`，模型收到的是一个不存在的编号 —— 对齐指令整句失效。
 *
 * 编号来源（按优先级）：
 *   1. 显式传入的 firstFrameIndex / lastFrameIndex（generator 知道真实顺序）
 *   2. 声明为关键帧模式时，图序列**就是**关键帧序列 —— i2va 取 Picture 1，
 *      fl2va 取 Picture 1/2，l2va 取 Picture 1
 *   3. 兜底：首帧=1、尾帧=2
 */
function frameIndex(refs, which, declaredMode) {
  const explicit = which === 'first' ? refs.firstFrameIndex : refs.lastFrameIndex;
  if (Number.isFinite(Number(explicit)) && Number(explicit) > 0) return Number(explicit);
  if (declaredMode === 'fl2va') return which === 'first' ? 1 : 2;
  return 1;
}

/**
 * 判断"这个模式是否需要对齐指令"，以及图序列里哪些位置算关键帧。
 *
 * ⚠️ 关键的一层兼容：调用方声明 `mode: 'i2va'` 却没显式给 firstFrame 时，
 *    **不能**当作"没有关键帧"直接退回 T2VA —— 用户选的就是 i2va，
 *    他传进来的第 1 张图显然就是首帧。旧实现只认显式的 firstFrame 字段，
 *    于是"选了 I2VA、图也传了、提示词里却没有对齐指令"，帧锚点整段失效。
 */
function frameSlots(refs, declaredMode) {
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

function alignmentInstruction(refs, effectiveSec, declaredMode) {
  const dur = Number(effectiveSec) || 0;
  const ss = dur.toFixed(2);
  const { hasFirst, hasLast, implicit } = frameSlots(refs, declaredMode);

  if (implicit) {
    // 声明了关键帧模式但没给显式路径：按"图序列即关键帧序列"处理。
    // 这是一个**约定**，不是猜测 —— 用户选 I2VA 就意味着第 1 张图是首帧。
  }

  // I2VA：首帧
  if (hasFirst && !hasLast) {
    return `For the target video, at 0.00 seconds into the target video, <Picture ${frameIndex(refs, 'first', declaredMode)}> (from [Shot 1]) is fully referenced.`;
  }
  // FL2VA：首尾帧
  if (hasFirst && hasLast) {
    return `How the reference pictures align with the target video — Picture ${frameIndex(refs, 'first', declaredMode)} (from [Shot 1]) aligns with the 0.00-second mark of the target video; Picture ${frameIndex(refs, 'last', declaredMode)} (from [Shot 1]) aligns with the ${ss}-second mark of the target video.`;
  }
  // L2VA：只有尾帧
  if (!hasFirst && hasLast) {
    return `How the reference pictures align with the target video — <Picture ${frameIndex(refs, 'last', declaredMode)}> (from [Shot 1]) aligns with the ${ss}-second mark of the target video.`;
  }
  // T2VA：无对齐指令
  return '';
}

/* ============================================================ Ref2VA 六段 */

/**
 * Ref2VA 六段格式。
 *
 * 固定顺序（官方）：
 *   subject_definitions → summary → retention_analysis →
 *   detailed_description → overall_soundscape → non_diegetic_music
 */
function compileRef2VA(ctx) {
  const { style, subjects, refs, scenes, soundscape, music, input, effectiveSec } = ctx;

  const out = [];

  /* ---- 1. subject_definitions ---- */
  out.push('subject_definitions:');
  const defs = [];

  // 调用方提供的素材用途说明（来自 render-plan.buildMediaNotes）优先放在前面：
  // 官方格式要求 <Video N> / <Audio N> 在 subject_definitions 里被定义一次。
  const provided = Array.isArray(input.mediaNotes) ? input.mediaNotes.filter(Boolean) : [];
  if (provided.length) defs.push(...provided.map((s) => String(s).trim()));

  // 每个角色 → 一个 <Subject N>，编号独立从 1 开始
  subjects.forEach((s, i) => {
    const n = i + 1;
    const bits = [];
    if (s.traits) bits.push(s.traits.replace(/[。．.]\s*$/, ''));
    if (s.heightCm) bits.push(`${s.heightCm}cm tall`);
    const where = s.hasImage
      ? `is the character shown in <Picture ${s.pictureIndex}>`
      : 'has no reference picture and is defined by the written description only';
    const tail = bits.length ? `, with ${bits.join(', ')}` : '';
    defs.push(`<Subject ${n}> ${where}${tail}. This subject is the on-screen speaker (S${n}).`);
  });

  // 参考视频
  //
  // ⚠️ 调用方已经通过 mediaNotes 提供过定义就不再重复 —— 同一段参考视频
  //    在 subject_definitions 里出现两次是"同一声明重编号"的变体，
  //    会让模型对编号产生歧义。
  const hasProvidedMediaDefs = provided.some((s) => /<Video \d+>|<Audio \d+>/.test(String(s)));
  if (!hasProvidedMediaDefs) {
    refs.videos.forEach((_, i) => {
      const n = i + 1;
      const use = refs.videoUses[i] ?? 'motion';
      const map = {
        motion: 'is the source for camera movement, blocking and motion timing',
        rhythm: 'is the source for editing rhythm and shot timing',
        mood: 'is the source for atmosphere and lighting only',
        continuation: 'is the immediately preceding clip; the target video continues it directly',
        style: 'is the source for visual style only',
      };
      defs.push(`<Video ${n}> ${map[use] ?? map.motion}. It does not define character appearance.`);
    });

    // 参考音频
    refs.audios.forEach((_, i) => {
      const n = i + 1;
      const owner = subjects.find((s) => s.audioIndex === n);
      const who = owner ? `<Subject ${subjects.indexOf(owner) + 1}>` : 'the speaking subject';
      defs.push(`<Audio ${n}> is the voice-timbre reference for ${who}.`);
    });
  }

  if (!defs.length) {
    defs.push('<Subject 1> is defined by the description below.');
  }
  out.push(...defs);
  out.push('');

  /* ---- 2. summary ---- */
  const taskPrefix = summaryTasks(refs, input);
  const core = String(input.summary ?? '').trim()
    || String(input.description ?? '').trim()
    || deriveSummary(subjects, scenes);
  out.push('summary:');
  out.push(taskPrefix ? `[${taskPrefix}] ${core}` : core);
  out.push('');

  /* ---- 3. retention_analysis ---- */
  out.push('retention_analysis:');
  const ret = [];

  subjects.forEach((s, i) => {
    const n = i + 1;
    if (!s.hasImage) {
      // 没有图的角色不能写 fully_preserved —— 没有任何东西可以"保住"。
      // 明写 `text_only` 让阅读提示词的人（和后续工具）一眼看出这是纯文字定义。
      ret.push(`<Subject ${n}>: weak_reference - text_only; appearance follows the written description because no reference picture was supplied for this subject.`);
      return;
    }
    const what = s.traits ? s.traits.replace(/[。．.]\s*$/, '') : 'face, hairstyle and costume';
    ret.push(`<Subject ${n}> (appears in [Shot 1]): fully_preserved - keep ${what}.`);
  });

  refs.videos.forEach((_, i) => {
    const n = i + 1;
    const use = refs.videoUses[i] ?? 'motion';
    const map = {
      motion: 'attribute_transfer - transfer motion and camera movement only; do not copy characters or set',
      rhythm: 'weak_reference - follow edit rhythm only',
      mood: 'weak_reference - follow atmosphere and lighting only',
      continuation: 'fully_preserved - continue characters, set and camera exactly',
      style: 'attribute_transfer - transfer visual style only',
    };
    ret.push(`<Video ${n}>: ${map[use] ?? map.motion}.`);
  });

  refs.audios.forEach((_, i) => {
    const n = i + 1;
    // ⚠️ 音频用**音频那套**标记。默认借音色 → `reference`（不复制波形）。
    const marker = RETENTION_AUDIO.includes(refs.audioModes[i]) ? refs.audioModes[i] : 'reference';
    ret.push(`<Audio ${n}>: ${marker} - follow timbre and delivery only; do not copy the waveform.`);
  });

  if (!ret.length) {
    ret.push('<Subject 1>: fully_preserved - keep the appearance and costume shown in the reference pictures.');
  }
  out.push(...ret);
  out.push('');

  /* ---- 4. detailed_description ---- */
  out.push('detailed_description:');
  const body = [];

  // 风格定调（Ref2VA 下截短，避免与参考素材抢权重）
  const styleText = String(style.en || '').trim();
  if (styleText) {
    const clipped = styleText.length > SHORT_STYLE_CHARS
      ? `${styleText.slice(0, SHORT_STYLE_CHARS).replace(/[,\s]+\S*$/, '')}.`
      : styleText;
    body.push(clipped);
  }

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
      body.push(`${sentence.replace(/\.\.+/g, '.')}.`);

      const speaker = resolveSpeaker(sc, subjects);
      if (sc.dialogue?.text) {
        const lang = sc.dialogue.lang || 'Chinese';
        const emo = sc.dialogue.emotion ? ` (${sc.dialogue.emotion})` : '';
        body.push(`${speaker.label} is visible on screen and says${emo}: <d>[${lang}] ${sc.dialogue.text}</d>`);
      }
      cursor = Number(sc.endSec) || (cursor + (Number(sc.durationSec) || 3));
    });
  } else {
    const layout = String(input.sceneLayout ?? input.scene ?? '').trim();
    if (layout) body.push(layout);
  }

  // ⚠️ Ref2VA 的 detailed_description 是**主体内容区**，不能只有风格句。
  //    以前在没有 shots/sceneLayout 时会产出"只有一句风格定调"的空壳，
  //    模型拿不到任何"发生什么"，会退化成随机抽卡。
  if (body.length <= 1) {
    const fallback = deriveSummary(subjects, []);
    if (fallback) body.push(fallback);
    ctx.warnings.push(
      'Ref2VA 的 detailed_description 内容过少（缺 description / shots）—— 官方建议 350–500 词，请补画⾯过程说明',
    );
  }

  // 灰模/白模参考视频的防泄漏（社区标准句式）
  if (refs.videos.length && refs.videoUses.includes('motion')) {
    body.push('Deliver a fully rendered frame in the target style; the reference video supplies motion and staging only.');
  }

  out.push(body.join('\n\n'));
  out.push('');

  /* ---- 5/6. 声音两段 ---- */
  out.push(`overall_soundscape: ${soundscape || 'Quiet environmental room tone with soft air movement.'}`);
  out.push('');
  out.push(`non_diegetic_music: ${music}`);

  void effectiveSec;
  return out.join('\n');
}

/** summary 的任务类型前缀（官方 6 枚举，` + ` 连接） */
function summaryTasks(refs, input) {
  const explicit = input.summaryTasks ?? input.summary_tasks;
  if (Array.isArray(explicit) && explicit.length) {
    const valid = explicit.filter((t) => SUMMARY_TASKS.includes(t));
    if (valid.length) return [...new Set(valid)].join(' + ');
  }
  // 自动推断
  const tasks = [];
  if (refs.firstFrame || refs.lastFrame) tasks.push('keyframe completion');
  if (refs.images.length) tasks.push('reference generation');
  if (refs.videos.some((_, i) => refs.videoUses[i] === 'continuation')) tasks.push('video continuation');
  if (refs.audios.length) tasks.push('audio reference');
  return [...new Set(tasks)].join(' + ');
}

/* ============================================================ 输出后检查 */

/**
 * 编译产物自查 —— 官方格式最容易踩的几条，全部做成可见警告。
 *
 * 为什么在"编译之后"还要再查一遍：格式是靠字符串拼出来的，
 * 拼错了编译器不会报错，只有模型表现变差 —— 属于最难查的一类失效。
 */
export function lintCompiledPrompt(prompt, format, warnings = []) {
  const p = String(prompt ?? '');
  const w = warnings;

  // 1) 字符上限
  if (p.length > H3_LIMITS.promptMaxChars) {
    w.push(`提示词 ${p.length} 字符超过官方上限 ${H3_LIMITS.promptMaxChars}`);
  }

  // 2) 时间区间是非法的（官方只接受单点）
  const range = /\[\s*\d+(?:\.\d+)?\s*s?\s*[-–~]\s*\d+(?:\.\d+)?\s*s?\s*\]/.exec(p);
  if (range) {
    w.push(`发现时间区间 ${range[0]} —— 官方只接受单点时间戳（如 At 00:05.000,），区间会被忽略`);
  }

  // 3) 方括号运镜是上一代 video-01-director 的语法，H3 不认
  if (/\[(Pan|Zoom|Tilt|Dolly|Truck|Orbit|Crane)\b/i.test(p)) {
    w.push('发现 [Pan left] 这类方括号运镜标签 —— 那是上一代 video-01-director 的语法，H3 请用自然语言句');
  }

  // 4) 负面提示词在本地 cfg=1 下会反噬
  //
  // ⚠️ 只查"引用风格"的否定块（NO xxx / no xxx），且**排除**模板自己产出的
  //    澄清句（"does not define …" / "do not copy …" / "do not show grey models …"）。
  //    那些是官方六段格式里合法的关系说明，不是 ban list。
  //    历史上一刀切地查 /do not/，把模板自己的句子也报成问题，属于误报。
  const SCAFFOLD = [
    'does not define character appearance',
    'do not copy characters or set',
    'do not copy the waveform',
    'do not follow characters or set',
    'Deliver a fully rendered frame in the target style; the reference video supplies motion and staging only.',
    'It carries no audio.',
    'no reference picture was supplied',
    'no reference picture',
  ];
  let negHay = p;
  for (const s of SCAFFOLD) negHay = negHay.split(s).join(' ');
  const neg = /(\bNO\s+[A-Z][a-z]+|\bno\s+[a-z]{3,}\b|\bwithout\s+[a-z]{3,}\b|不要|禁止|避免)/.exec(negHay);
  if (neg) {
    w.push(
      `发现疑似否定表述「${neg[0]}」—— 本地 CFG 固定 1.0、采样器没有 negative 分支，`
      + '写"不要 X"反而把 X 拉进画面。请改成正向陈述（"画面里只有…"）',
    );
  }

  // 5) 正文非英文（官方 skill 是 English-only；中文只允许出现在 <d> 内）
  const outsideDialogue = p
    .replace(/<d>[\s\S]*?<\/d>/g, '')
    .replace(/"[^"]*"/g, '"..."');
  const cjk = (outsideDialogue.match(/[\u4e00-\u9fa5]/g) || []).length;
  const latin = (outsideDialogue.match(/[A-Za-z]/g) || []).length;
  if (cjk > 10 && cjk > latin * 0.15) {
    w.push(
      `正文里有 ${cjk} 个中文字符 —— 官方提示词规范是 English-only，`
      + '中文只允许出现在 <d>[Chinese] …</d> 台词内。中文正文效果不稳',
    );
  }

  // 6) 结构字段自查
  if (format === 'ref') {
    const order = ['subject_definitions:', 'summary:', 'retention_analysis:', 'detailed_description:', 'overall_soundscape:', 'non_diegetic_music:'];
    let last = -1;
    for (const key of order) {
      const at = p.indexOf(key);
      if (at < 0) {
        w.push(`Ref2VA 缺少官方字段 ${key.replace(':', '')}`);
        continue;
      }
      if (at < last) w.push(`Ref2VA 字段顺序错误：${key.replace(':', '')} 出现在前一个字段之前`);
      last = at;
    }
  } else {
    for (const key of ['integrated_multimodal_description:', 'overall_soundscape:', 'non_diegetic_music:']) {
      if (!p.includes(key)) w.push(`基础格式缺少官方字段 ${key.replace(':', '')}`);
    }
  }

  // 7) 中文冒号（字段必须英文冒号）
  if (/^(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music|integrated_multimodal_description)\s*：/m.test(p)) {
    w.push('字段名后面用了中文冒号 —— 必须是半角英文冒号');
  }

  // 8) 台词标记
  if (/<d>(?!\[)/.test(p)) {
    w.push('<d> 后面缺语言标签，官方写法是 <d>[Chinese] …</d>');
  }

  return w;
}

/* ============================================================ 工具函数 */

function clampDuration(v, warnings) {
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

/**
 * 秒 → H3 帧数（`17k+5` 网格）。
 *
 * ⚠️ 实现委托给 `store/models.js` 的 `h3Length()` —— **单一真源**。
 *
 *    这里原本自己实现了一遍 `Math.ceil((raw-5)/17)`，且只夹了下限 5。
 *    与 `h3Length` 的逻辑漂移过：脚本拆段给出 4.3 秒时算出 107 帧，
 *    而 107 不在训练区间 124–362 内（会出"能动但很怪"的片子）。
 *    现在两边共用同一份实现，任何改动只需要改一处。
 */
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

/**
 * 中文运镜词 → 英文自然语言句。
 *
 * ⚠️ 输出必须是**自然语句**，不是 `[Dolly in]` 这种标签 —— 后者属于上一代
 *    video-01-director，H3 不认。
 */
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
  // 已经是英文句子就直接用
  if (!/[\u4e00-\u9fa5]/.test(c)) {
    const bare = c.replace(/^the camera\s+/i, '').replace(/[.。]\s*$/, '');
    // ⚠️ 英文形容词（fixed/static）不能直接当动词 —— "The camera fixed." 是病句，
    //    模型会当成"相机被固定住了/坏掉了"。补成完整谓语句。
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
  // 认不出来就退化成"缓慢稳定"，不要编造运动
  return 'moves slowly and steadily';
}

/**
 * 解析说话人标签。
 *
 * 官方要求：`(S1)` / `(S2)` 按**发声顺序**编号，全篇不变。
 * 这里优先用输入里已经标好的 speaker；没有就按出场顺序补。
 */
function resolveSpeaker(sc, subjects) {
  const raw = sc.dialogue?.speaker;
  if (raw) {
    const byId = subjects.find((s) => s.id === raw || s.name === raw);
    if (byId) {
      const idx = subjects.indexOf(byId) + 1;
      return { label: `${byId.name || 'The subject'} (S${idx})`, id: byId.id, index: idx };
    }
    // 直接给了 S1 / S2
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

function fixScene(sc) {
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

function buildScenesFromShots(shots) {
  if (!Array.isArray(shots) || !shots.length) return [];
  return shots.map((s, i) => fixScene({ ...s, index: i + 1 }));
}

/**
 * 从零散字段推导出"至少一个镜头"。
 *
 * 为什么需要：`shots` 是可选的，绝大多数调用（渲染页、画布节点、Agent 工具）
 * 只给 `description` + `camera`。以前编译器在没有 shots 时直接把
 * sceneLayout 原样塞进描述段 —— 结果是"一段没有景别、没有运镜、没有台词的
 * 自由文本"，正是官方反模式 #2（只写一段话不分段）。
 *
 * 现在统一补一个 [Shot 1]，把 description / camera / dialogue / sound 都搬进去。
 */
function deriveScenes(input, durationSec) {
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

function resolveStyle(input) {
  if (input.styleEn) {
    return { id: 'custom', name: '自定义', en: String(input.styleEn), ban: '', changesAppearance: false };
  }
  if (input.styleId) {
    const hit = STYLE_PRESETS.find((s) => s.id === input.styleId);
    if (hit) return hit;
  }
  if (input.style) {
    return { id: 'custom', name: String(input.style), en: String(input.style), ban: '', changesAppearance: false };
  }
  return STYLE_PRESETS[2];   // 默认 90 年代 OVA
}

/**
 * 基础格式的开头定调句。
 *
 * 官方反模式 #2 的顺序：**主体 → 动作 → 镜头 → 光线 → 声音**。
 * 所以这里只放"风格/媒介"这一句，不放场景描述 —— 场景属于后面的 shot 内容。
 */
function styleLeadSentence(style, input) {
  const parts = [];
  const text = String(style?.en ?? '').trim();
  if (text) parts.push(text.replace(/[.\s]+$/, ''));
  const ratio = input?.ratio ? String(input.ratio) : '';
  if (ratio) parts.push(`${ratio} aspect ratio`);
  const joined = parts.filter(Boolean).join('. ').replace(/\.\.+/g, '.');
  // ⚠️ 必须留一个结尾句号。
  //    调用方把这一段和 `[Shot 1] …` 直接拼接，没有句号时会出现
  //    `16:9 aspect ratio [Shot 1] A young woman…` —— 两句话粘成一句，
  //    模型会把 "ratio [Shot 1]" 当成同一个短语读。
  return joined ? `${joined}.` : '';
}

function normalizeSubjects(list) {
  if (!Array.isArray(list)) return [];
  return list.map((s, i) => {
    const explicitNull = s.pictureIndex === null;
    // hasImage 的三态：
    //   false      —— 调用方明确说没有图
    //   null 编号  —— 明确说这张卡没图
    //   有编号     —— 有图
    const hasImage = s.hasImage !== false && !explicitNull;
    return {
      id: s.id ?? `S${i + 1}`,
      name: s.name ?? `Subject ${i + 1}`,
      pictureIndex: explicitNull ? null : (s.pictureIndex ?? (hasImage ? i + 1 : null)),
      gender: s.gender ?? '',
      heightCm: s.heightCm ?? null,
      traits: Array.isArray(s.traits) ? s.traits.join(', ') : (s.traits ?? ''),
      personality: s.personality ?? '',
      voiceDesc: s.voiceDesc ?? '',
      audioIndex: s.audioIndex ?? null,
      hasImage,
    };
  });
}

function normalizeRefs(refs) {
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

function deriveSummary(subjects, scenes) {
  const names = subjects.map((s) => s.name).filter(Boolean).join(' and ') || 'The subject';
  const first = scenes?.[0]?.action ? String(scenes[0].action).slice(0, 100) : '';
  return `${names} in a short scene. ${first}`.trim();
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/* ============================================================ 镜头输入包 */

/**
 * 把内部 shot 结构转成 H3 镜头输入包。
 *
 * 这是"本地分镜输入约定"，**不是官方 schema** —— 官方没有 JSON 提示词 schema。
 * 它的唯一职责是把散落在各处的字段收拢成编译器认识的形状。
 */
export function toShotInputPackage(shot = {}, opts = {}) {
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
      // 编号按真实参考图顺序（见 shot-context.resolvePictureIndices），
      // 这里只做占位，最终以 generator 注入的为准。
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
    subjects: opts.subjects ?? cardSubjects,
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
    engine: {
      backend: 'local_comfyui',
      mode: route.mode,
      format: route.format,
      steps: opts.steps ?? 4,
      seed: opts.seed ?? 1101,
      ref_image_size: 'match',
    },
  };
}

export { STYLE_PRESETS as H3_STYLE_PRESETS, H3_MODES as H3_MODE_LIST };
