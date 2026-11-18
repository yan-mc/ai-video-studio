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
  promptMaxChars: 6000,
  /**
   * 官方硬上限（api.py 侧会拒）——保留它只为区分"我们主动收紧"和"上游会报错"。
   *
   * 为什么本插件收到 6000 而不是 7000（群友 v2.1 之外的本地修正）：
   * 实测 7000 字符时，六字段的注意力分配明显被稀释 ——
   * 尤其 `detailed_description` 里的动作细节会被后段的
   * 光影/声音描述盖过。6000 是"够写清全部六字段 + 动作细节"的上限，
   * 再多就只能靠堆砌形容词，收益为负。
   */
  promptOfficialMaxChars: 7000,
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
    en: 'Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cartoon character design with exaggerated proportions — slightly larger head, slender limbs, flat torso, simplified geometric shapes. Thick, bold, jagged black outlines. Flat cel-shaded coloring with heavy block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. NO photorealistic textures, NO realistic skin shading, NO 3D proportions, NO PBR materials. NO subtitles, NO on-screen text.',
    ban: '写实质感、写实皮肤阴影、3D比例、PBR材质、渐变、柔光、模糊、照片级渲染',
    best: '暗黑戏剧、暴力动作、硬核狂野、冲击力亮相',
  },
  {
    id: 'helltaker-style',
    name: '地狱把妹王（画风版）',
    category: '2D扁平卡通',
    changesAppearance: false,
    en: 'Helltaker game visual aesthetic. High contrast black/white/deep red color palette. Flat cel-shaded coloring with heavy block shadows, no gradients. Render characters as 2D cartoons, NOT realistic. DO NOT change character proportions.',
    ban: '写实质感、写实皮肤阴影、PBR材质、渐变、柔光、比例改变、头部放大、四肢拉长',
    best: '需要 Helltaker 光影但角色比例必须保持',
  },
  {
    id: 'ova90s',
    name: '90年代OVA风',
    category: '2D手绘赛璐珞',
    changesAppearance: false,
    en: '90s OVA retro cel-animation style. High saturation, hard cel-shaded shadows, soft gradient blush on cheeks (blending naturally from pink to warm red), film grain texture. Natural anime facial bone structure. Upper eyelid shadows rendered with natural gradients. Render characters as 2D hand-drawn anime, NOT 3D. NO photorealistic textures. NO subtitles, NO on-screen text.',
    ban: '写实质感、实拍质感、3D比例、粗黑锯齿轮廓、块状阴影',
    best: '怀旧日常、喜剧四格、情感戏、轻度复古',
  },
  {
    id: 'shinkai',
    name: '新海诚风',
    category: '2D手绘柔光',
    changesAppearance: false,
    en: 'Studio Ghibli / Makoto Shinkai inspired cinematic anime style. Soft atmospheric lighting, bokeh depth of field, warm natural sunlight, gentle pastel gradients. Soft cel-shaded character rendering with gentle shadows. Render characters as 2D anime, NOT 3D. NO photorealistic textures. NO subtitles, NO on-screen text.',
    ban: '硬阴影、粗黑轮廓、高对比、块状阴影、赛璐珞质感、胶片颗粒',
    best: '治愈系、都市夜景、梦幻场景',
  },
  {
    id: 'ghibli',
    name: '吉卜力风',
    category: '2D手绘柔光',
    changesAppearance: false,
    en: 'Studio Ghibli / Makoto Shinkai inspired cinematic anime style. Soft atmospheric lighting, bokeh depth of field, warm natural sunlight, gentle pastel gradients. Soft cel-shaded character rendering with gentle shadows. Render characters as 2D anime, NOT 3D. NO photorealistic textures. NO subtitles, NO on-screen text.',
    ban: '硬阴影、高对比、冷色过蓝、过曝、写实质感、数码感',
    best: '田园风光、异世界、奇幻冒险、温馨日常',
  },
  {
    id: 'american-toon',
    name: '经典美式卡通',
    category: '2D扁平弹性',
    changesAppearance: true,
    en: 'Classic American cel-animation style. Confident, evenly weighted outlines defining exaggerated, highly readable proportions. Flat color fill with minimal shading — no gradients, no complex shadows. Elastic, squash-and-stretch sense of form. Cheerful, uncomplicated composition. NO photorealistic textures. NO subtitles, NO on-screen text.',
    ban: '锯齿状轮廓、日式腮红、胶片颗粒、赛璐珞质感、高对比阴影',
    best: '喜剧、合家欢、夸张搞笑',
  },
  {
    id: 'ufotable',
    name: '飞碟社风',
    category: '3D背景+2D角色',
    changesAppearance: false,
    en: 'Ufotable animation style. Digital painting with high contrast cinematography. Photorealistic detailed backgrounds. 2D cel-shaded characters with large hard shadows. Dramatic lighting with strong sunlight and sharp contrast. Particle effects including flames, sparks, exhaust trails. Deep color palette with lower saturation. Render characters and vehicles as 2D cel-shaded, NOT realistic. NO photorealistic textures on characters. NO thick black outlines. NO gradients.',
    ban: '粗黑轮廓线、平涂无阴影、低对比、浅景深虚化、柔光、水彩质感',
    best: '热血战斗、奇幻史诗、特效炫酷',
  },
  {
    id: 'toon3d-pbr',
    name: '三渲二 + PBR混合',
    category: '3D半写实',
    changesAppearance: false,
    en: '3D cel-shaded anime style with PBR physical rendering. Semi-realistic anime style, 3D character rendering with subtle dark thin contour lines (thin, NOT thick hand-drawn lines), soft cel-shaded coloring mixed with realistic material rendering. Subsurface scattering on skin. Soft studio lighting, smooth shadows with gentle transitions, soft diffuse shadows, no harsh blocks. Hair rendered as 3D physical strands. Clean render, delicate materials. NO thick black hand-drawn outlines, NO flat cel-shading only, NO photorealistic human textures.',
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
  {
    /**
     * Ligne Claire（清晰线条 / 欧洲漫画风）。
     *
     * 来源：群友 skill 第 3 批「画风池」的第 8 种。
     * 与丁丁历险记 / Moebius 一脉：等宽线条、平涂、无渐变、构图干净。
     * ⚠️ 坑：这个画风**天然排斥硬阴影与强光比**，
     *    如果同时选 4:1 / 8:1 打光，两者会打架 —— 见下方 note。
     */
    id: 'ligne-claire',
    name: 'Ligne Claire（清晰线条 / 欧洲漫画）',
    category: '2D 平涂线条',
    changesAppearance: false,
    en: 'Ligne claire style, clean line art, flat color fills, minimalist composition, muted pastel palette, whimsical digital illustration, children\'s book art style, painterly texture, dappled sunlight, magical glow, soft grain, floating dust particles, gentle light shifting, high quality, cinematic lighting, 8k, masterpiece.',
    ban: '线宽变化、交叉排线、渐变、写实质感、强投影、硬块阴影、锯齿轮廓',
    best: '欧洲漫画、冒险、清爽叙事',
    note: '与 4:1/8:1 打光冲突：本画风要求平涂无强阴影，选强光比会互相削弱。',
  },
  {
    /**
     * 地狱客栈（Vivziepop）画风。
     *
     * 来源：群友 skill 第 3 批「画风池」的第 9 种（也是他们实际项目用过的那套）。
     * 特征：锯齿状棱角、粗黑轮廓、平涂高对比色块、暗黑色调 + 高饱和点缀。
     * 与原版 helltaker-look 的区别：Helltaker 是黑白红极简，Vivziepop 是多彩。
     */
    id: 'vivziepop',
    name: '地狱客栈（Vivziepop）',
    category: '2D 扁平卡通',
    changesAppearance: true,
    en: 'Vivziepop style, Hazbin Hotel animation style, Jhonen Vasquez influence, jagged angular cartoon illustration, gothic-adjacent proportions, elongated limbs, spiky unstable silhouette, bold high-contrast shading in stark graphic blocks, thick confident black outlines, asymmetrical twitchy posing, darkly quirky kinetic energy, 2000s cult cartoon style, flat color, masterpiece, high quality.',
    ban: '写实质感、柔和渐变、PBR 材质、线宽变化、低对比、萌系圆润比例',
    best: '暗黑喜剧、恶魔角色、强个性、高对比戏剧场面',
  },
]);

/**
 * Ref2VA 分支下画风串的**软上限**（不是硬截断）。
 *
 * ⚠️ 历史教训：以前这里做的是"超过 180 字符就一刀切"，于是官方画风串
 *    全被砍在半句：
 *      `90s OVA retro cel-animation style. High saturation, ... Natural.`
 *    而官方串的**约束句全在末尾**：
 *      `… Render characters as 2D hand-drawn anime, NOT 3D.
 *         NO photorealistic textures. NO subtitles, NO on-screen text.`
 *    砍掉末尾 = 砍掉全部反模式约束 → 模型照样渲成 3D、照样出字幕。
 *
 *    群友 skill v2.1 §3.1 明确要求画风串"**逐字照抄，不缩写、不改写、
 *    不合并**"。所以这里改成：**整串保留**，只用这个常量决定
 *    "是否额外提示可能抢权重"。
 */
const SHORT_STYLE_CHARS = 180;

/* ============================================================ 续写开关 */

/**
 * 潜空间续写的「开关句」—— 必须放在提示词**最顶部**，不放进任何字段内。
 *
 * ============================================================================
 * 为什么是顶部
 * ============================================================================
 *
 * 这是全局指令，不是某个字段的内容。放中段会被上下文稀释；字段名有可能
 * 不被结构化解析；而**顶部无字段文本必然被整体编码**。
 * 实测有效的第三方写法，开关永远在第一行。
 *
 * ============================================================================
 * 三个组件，缺一不可
 * ============================================================================
 *
 * | 组件 | 语义 | 缺了会怎样 |
 * |---|---|---|
 * | the actual carried latent motion governs… | 状态权威交给实帧 | 模型按文字重新推导 → 接缝断裂 |
 * | No reference picture resets pose… | 禁止参考图把姿态拉回图中样子 | 人物摆回立绘姿势 |
 * | The lighting… continue unchanged | 光与时段继承 | 每次切镜色温跳变 |
 *
 * ============================================================================
 * 为什么段 1 要反过来写
 * ============================================================================
 *
 * 段 1 没有前一段可承接。如果不显式声明"这是开场、没有承接"，
 * 模型可能去找不存在的上一段，或者在首帧保守地不敢动作。
 */
export const CONTINUATION_SWITCH = Object.freeze({
  /** 段 2+：承接段 */
  carried: [
    'The actual carried latent motion from the previous segment governs the current action and camera state.',
    'No reference picture resets pose, body position, hand placement, expression, gaze or framing.',
    'The lighting direction and time of day continue unchanged from the previous segment.',
  ].join(' '),

  /** 段 1：开场段 */
  opening: [
    'This is the opening segment of the film.',
    'No earlier segment exists; nothing is carried in, and both the camera and the figures start fresh.',
  ].join(' '),
});

/**
 * 裁切区时序纪律 —— 段 2+ 必写。
 *
 * 实测裁切 0.92s（22 帧 @24fps），安全边界写 1.0s。
 * 前 1 秒写进去的动作/台词/运镜全部落进裁切区，交付画面里不存在。
 */
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
 * 字幕 / overlay 压制 —— 群友 skill v2.1 §15.2 的两道防线。
 *
 * ============================================================================
 * 为什么必须由代码注入，而不是让用户手写
 * ============================================================================
 *
 * 本地 H3 的 CFG 固定 1.0、采样器没有 negative 分支，所以压制词**只能**
 * 出现在 v2.1 §15.1 规定的三处合法位置。让用户自己在提示词里写
 * "no subtitles" 是最常见的误用 —— 它既没有通道（不起作用），
 * 又被 lint 判为非法负面句。
 *
 * 这里把两道实测有效的防线固化成常量，由编译器自动追加：
 *   1. 画风串后的 Text suppression 追加行
 *   2. detailed_description 末尾的画面完整性句
 *
 * 群友实测：画风 10 + 压实行 → 无字幕；完整性句 → overlay 出现率 0。
 *
 * 注：第三道防线是「场景文字属性声明」，它属于场景锚点的一部分
 * （具名物的属性，正向句法），由场景描述自己携带，不需要单独注入。
 */
export const SUPPRESSION_GUARDS = Object.freeze({
  /**
   * 防线 1：追加压制行。位置 = 画风串之后、光影层之前。
   *
   * ⚠️ 必须**另起一行追加**，不能改动画风串原文一字 ——
   *    v2.1 §3.1 规定画风串"逐字照抄，不缩写、不改写、不合并"。
   */
  textSuppression: 'Text suppression: NO subtitles, NO on-screen text, NO captions, '
    + 'NO watermarks, NO logos, NO UI overlays.',

  /**
   * 防线 2：画面完整性句。位置 = detailed_description 末尾、免责句之前。
   *
   * 主语是"画面里的东西"（正向描述），不给 overlay 留位置。
   */
  frameIntegrity: 'Every element inside the frame belongs to the physical scene: '
    + 'paving, railing, sea, sky, foliage and the figures themselves. '
    + 'Nothing floats over the image.',
});

/**
 * 解析续写上下文，判断这一段是"开场"还是"承接"。
 *
 * 输入可以是：
 *   · `continuationTask`（JSON 字符串或对象）：南风的续写任务，含 index
 *   · `continuationIndex`：直接给段号
 *   · `isContinuation`：布尔
 *
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

  // index === 1 是开场（南风约定 Load 0 = 不读文件）
  const isContinuation = index != null ? index > 1 : explicit;
  const ctxLen = Number(input.contextLength ?? input.context_length ?? 22);
  return {
    isContinuation,
    index,
    trimFrames: isContinuation ? (Number.isFinite(ctxLen) ? ctxLen : 22) : 0,
  };
}

/**
 * 打光预设（lighting ratio，光比）。
 *
 * ============================================================================
 * 什么是「光比」
 * ============================================================================
 *
 * 光比 = 主光照度 : 补光照度，表示为「亮面 : 暗面」的亮度比。
 * 因为光是按「档」（1 档 = 2 倍）翻倍的，所以：
 *
 *   光比    相差档数    观感
 *   2:1     1 档       高调、柔和、日系写真
 *   3:1     1.7 档     经典人像
 *   4:1     2 档       低调、戏剧化、明显明暗对比
 *   8:1     3 档       极低调、黑色电影、强戏剧性（明暗差 8 倍）
 *
 * 参考：ASC（美国电影摄影师协会）把光比定义为 (key+fill):fill。
 *
 * ============================================================================
 * 为什么做成"预设通道"而不是模型参数
 * ============================================================================
 *
 * 南风 V217 里**没有任何打光参数** —— H3 是纯提示词驱动的扩散模型，
 * 打光只能靠 `detailed_description` 里的文字。
 * 但「4:1 打光」这种说法机器读不懂，必须翻译成**可观测的视觉描述**：
 * 光源方向、阴影硬度、明暗边界、暗部细节保留程度。
 *
 * 所以这里把「光比」翻译成模型能执行的句子，作为独立通道与画风并列。
 * 顺序上放在风格之后、动作之前 —— 对齐官方「主体→动作→镜头→光线→声音」。
 *
 * ⚠️ 与画风的关系：打光是**正交**的。
 *    `8:1` 可以配任何一个画风；Ref2VA 下两者都会截短，避免抢权重。
 */
export const LIGHTING_PRESETS = Object.freeze([
  {
    id: 'none',
    name: '不指定（跟随画风）',
    ratio: null,
    stops: null,
    en: '',
    zh: '不在提示词里写打光，交给画风与参考图决定。',
    best: '参考图本身光影已足够、或想要"自然"效果时',
  },
  {
    id: 'high-key-2-1',
    name: '2:1 高调柔光',
    ratio: '2:1',
    stops: 1,
    en: 'Even soft key lighting with a gentle 2:1 key-to-fill ratio, bright and low-contrast, '
      + 'shadows barely darker than highlights, no harsh shadow edges, full detail retained in shadow areas.',
    zh: '亮部只比暗部亮一倍，柔和无硬边，暗部细节全保留。',
    best: '日系写真、清新日常、美妆、治愈系、偶像舞台',
  },
  {
    id: 'classic-3-1',
    name: '3:1 经典人像',
    ratio: '3:1',
    stops: 1.7,
    en: 'Classic portrait key lighting with a 3:1 key-to-fill ratio, one soft shadow side, '
      + 'natural face modelling, shadows still hold visible texture.',
    zh: '经典人像布光，一侧有柔和阴影，面部有立体感但暗部仍可见纹理。',
    best: '对话戏、人物特写、常规叙事',
  },
  {
    id: 'dramatic-4-1',
    name: '4:1 戏剧低调',
    ratio: '4:1',
    stops: 2,
    en: 'Dramatic low-key lighting with a 4:1 key-to-fill ratio, two stops between lit and shadow side, '
      + 'strong directional key light from one side, hard shadow boundaries, deep but not crushed shadows, '
      + 'high contrast between highlight and shade.',
    zh: '明暗差 2 档，单侧主光，阴影边界清晰，暗部深沉但保留层次。',
    best: '悬疑、情绪戏、夜间场景、需要明显明暗结构的构图',
  },
  {
    /**
     * 6:1 —— 脸部特写专用档。
     *
     * 来源：群友 skill 第 4 批「四档光比全模板」的 6:1 档。
     * 介于 4:1 与 8:1 之间：暗部大幅压深，但**保留眼睛与睫毛细节**。
     * 用于情绪特写（脸占画面大部分时，8:1 会把五官也吃掉）。
     */
    id: 'closeup-6-1',
    name: '6:1 特写压迫',
    ratio: '6:1',
    stops: 2.6,
    en: 'Close-up key lighting with a 6:1 key-to-fill ratio, a hard-edged highlight along the lit cheekbone, '
      + 'jaw and hair edge, while the front of the face falls into flat block cel shadow whose single hard '
      + 'boundary keeps the eye and eyelash detail clear rather than crushed.',
    zh: '明暗差 2.6 档，暗部压深但眼睛与睫毛仍清晰 —— 脸部特写专用。',
    best: '情绪特写、脸部压迫感、悬疑逼近镜头',
  },
  {
    id: 'noir-8-1',
    name: '8:1 极低调（黑色电影）',
    ratio: '8:1',
    stops: 3,
    en: 'Extreme low-key chiaroscuro lighting with an 8:1 key-to-fill ratio, three stops between lit and '
      + 'shadow side, a single hard directional key light, most of the frame falls into near-black shadow, '
      + 'sharp bright rim on the lit contour, minimal fill, faces half-swallowed by darkness, '
      + 'dramatic theatre-grade contrast.',
    zh: '明暗差 3 档，大部分画面沉入近黑的暗部，只有单侧硬光打亮轮廓，脸一半没入黑暗。',
    best: '母鸡卡/MyGO 剧场版那种强戏剧性、黑色电影、暗黑美学、演唱会顶光',
  },
  {
    id: 'rim-backlit',
    name: '强边缘光（逆光勾边）',
    ratio: '8:1',
    stops: 3,
    en: 'Strong backlit rim lighting: a hard light from behind the subject traces a bright contour along '
      + 'hair, shoulders and silhouette edges, the front of the subject stays in low key, '
      + '8:1 contrast between rim and face, atmospheric haze catching the light.',
    zh: '逆光沿发丝/肩线勾出亮边，正面压暗，反差 8:1，常有光晕气氛。',
    best: '剪影、登场亮相、舞台、神秘感、烟尘/丁达尔效应',
  },
]);

/** 校验并取打光预设；未知 id 回落到 none（不静默变错，调用方可查 warnings） */
export function resolveLighting(idOrObj) {
  if (idOrObj && typeof idOrObj === 'object' && idOrObj.en) {
    return { ...idOrObj, id: idOrObj.id ?? 'custom' };
  }
  const key = String(idOrObj ?? '').trim();
  if (!key) return LIGHTING_PRESETS[0];
  const hit = LIGHTING_PRESETS.find((l) => l.id === key);
  if (hit) return hit;
  return LIGHTING_PRESETS[0];
}

/**
 * 画风 × 打光的冲突检测。
 *
 * ============================================================================
 * 为什么需要
 * ============================================================================
 *
 * 这两条通道是"正交"的（任意组合技术上都能跑），但**语义上会打架**：
 *
 *   · Ligne Claire / Ghibli 这类平涂无阴影的画风，要求"无强投影、无硬块阴影"
 *   · 而 4:1 / 6:1 / 8:1 打光明确要求"硬边边界、深暗部"
 *
 * 同时选会让模型收到互相削弱的指令 —— 实测表现为「打光打了但很淡」，
 * 用户会以为是打光预设没生效。
 *
 * 这不是错误，是**取舍**：所以在 warnings 里提示，而不是报错。
 *
 * 来源：群友 skill 第 3 批「取舍对照」+「画风 8 的坑」。
 */
const STYLE_LIGHTING_CONFLICTS = [
  {
    styleIds: ['ligne-claire'],
    lightingIds: ['dramatic-4-1', 'closeup-6-1', 'noir-8-1', 'rim-backlit'],
    message: 'Ligne Claire 要求平涂无强阴影，与强光比打光互相削弱。'
      + '要么把打光降到 2:1/3:1，要么换一个允许硬阴影的画风。',
  },
  {
    styleIds: ['ghibli', 'shinkai'],
    lightingIds: ['noir-8-1'],
    message: '该画风是柔光水彩调，与 8:1 极低调（沉入近黑）冲突。'
      + '要暗调请改用 ufotable / vivziepop / helltaker-look。',
  },
  {
    styleIds: ['helltaker-look', 'helltaker-style', 'vivziepop'],
    lightingIds: ['high-key-2-1'],
    message: '该画风是高对比扁平块状阴影，与 2:1 高调柔光（阴影几乎不存在）冲突。'
      + '建议 4:1 以上。',
  },
];

/**
 * 检测画风与打光是否冲突。
 *
 * @returns {string[]} 冲突说明（空数组 = 无冲突）
 */
export function styleLightingConflicts(style, lighting) {
  const sid = String(style?.id ?? style ?? '');
  const lid = String(lighting?.id ?? lighting ?? '');
  if (!sid || !lid || lid === 'none') return [];
  const out = [];
  for (const rule of STYLE_LIGHTING_CONFLICTS) {
    if (rule.styleIds.includes(sid) && rule.lightingIds.includes(lid)) out.push(rule.message);
  }
  return out;
}

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

  /**
   * 续写上下文：这几段是"开场"还是"承接上段"？
   *
   * 来自南风的 `continuationTask`（含 index），或显式 `isContinuation`。
   * 段 1（index=1）是开场；段 2+ 是承接。
   */
  const cont = resolveContinuation(input);
  if (cont.isContinuation && cont.index != null && cont.index > 1 && !cont.trimFrames) {
    warnings.push('续写段缺少 contextLength，已按默认 22 帧（0.92s）处理裁切区');
  }

  const ctx = {
    style, subjects, refs, scenes, soundscape, music, input,
    frames, effectiveSec, durationSec, warnings, cont,
  };

  const body = route.format === 'ref' ? compileRef2VA(ctx) : compileBase(ctx);

  /**
   * ⚠️ 续写开关必须拼在**最顶部**，在任何字段之前。
   *
   * 理由（群友 skill 实测 + 官方格式）：
   *   · 它是全局指令，放中段会被上下文稀释
   *   · 字段名可能不被结构化解析，而顶部无字段文本必然被整体编码
   *   · 实测有效的第三方写法，开关永远在第一行
   *
   * 段 1 反过来写"这是开场、没有承接"，防止模型去找不存在的上一段。
   */
  const prompt = cont.isContinuation
    ? `${CONTINUATION_SWITCH.carried}
${TRIM_DISCIPLINE.carried}

${body}`
    : body;

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
    /** 续写上下文（本源是否为承接段）—— 前端/工具可据此展示"段号/裁切" */
    continuation: {
      isContinuation: cont.isContinuation,
      index: cont.index,
      trimFrames: cont.trimFrames,
    },
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
  // `warnings` 必须解构 —— 画风×打光冲突、续写提示都往这里写
  const { refs, scenes, soundscape, music, effectiveSec, input, subjects, warnings } = ctx;

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
  // ⚠️ `warnings` 必须解构出来 —— 打光/画风冲突、续写裁切等提示都往这里写。
  //    以前只有基础格式能出这些 warning，Ref2VA（主力路径）静默丢掉。
  const { style, subjects, refs, scenes, soundscape, music, input, effectiveSec, warnings } = ctx;

  const out = [];

  /* ---- 1. subject_definitions ---- */
  out.push('subject_definitions:');
  const defs = [];

  // 调用方提供的素材用途说明（来自 render-plan.buildMediaNotes）优先放在前面：
  // 官方格式要求 <Video N> / <Audio N> 在 subject_definitions 里被定义一次。
  const provided = Array.isArray(input.mediaNotes) ? input.mediaNotes.filter(Boolean) : [];
  if (provided.length) defs.push(...provided.map((s) => String(s).trim()));

  // 每个角色 → 一个 <Subject N>，编号独立从 1 开始
  //
  // ⚠️ 不要给每个 subject 都写 `(Sx)`。
  //    官方向导 storyboard-skill/references/ref-en.txt:278 明确：
  //      "Assign (Sx) once according to the order of actual vocal events…
  //       Do not write (Sx) in retention_analysis."
  //    旧实现无条件写 `This subject is the on-screen speaker (S${n})`，于是
  //    不说话的角色也拿到 speaker ID，且编号用的是 subject 下标而不是发声顺序，
  //    与 detailed_description 里 resolveSpeaker() 分配的编号直接冲突。
  //    现在只在"这个 subject 真的有台词"时才写，编号按首次发声顺序统一生成。
  const speakerIds = new Map();   // subjectIndex -> Sx
  {
    let next = 1;
    for (const sc of scenes) {
      // `dialogue` 是单个对象（不是数组）：{ speaker, text, lang, emotion }
      const d = sc?.dialogue;
      if (!d || !d.text) continue;
      const idx = speakerSubjectIndex(d, subjects);
      if (idx == null || speakerIds.has(idx)) continue;
      speakerIds.set(idx, next);
      next += 1;
    }
  }

  subjects.forEach((s, i) => {
    const n = i + 1;
    const bits = [];
    if (s.traits) bits.push(s.traits.replace(/[。．.]\s*$/, ''));
    if (s.heightCm) bits.push(`${s.heightCm}cm tall`);
    const tail = bits.length ? `, with ${bits.join(', ')}` : '';
    const sid = speakerIds.get(i);
    const speaker = sid ? ` This subject speaks as (S${sid}).` : '';

    /**
     * 对齐群友 skill 第 2 批「人物标准句式」：
     *   `<Subject N> is the <description> shown in <Picture M>.`
     *
     * ⚠️ 以前写死 `is the character shown in ...` —— 角色卡的 description
     *    （"白发少女"这类身份描述）根本没进提示词，只剩零碎外观词。
     *    模型拿不到"这是谁"，角色卡的身份锚点价值丢失。
     *
     * 有 description 时用 `is the <description> shown in`，
     * 没有才退回泛化写法。description 里自带冠词/人名都能读通。
     */
    const desc = String(s.description ?? '').trim().replace(/[。．.]\s*$/, '');
    let where;
    if (s.hasImage) {
      where = desc
        ? `is the ${desc} shown in <Picture ${s.pictureIndex}>`
        : `is the character shown in <Picture ${s.pictureIndex}>`;
    } else {
      where = desc
        ? `is the ${desc}, defined by the written description only (no reference picture supplied)`
        : 'has no reference picture and is defined by the written description only';
    }
    defs.push(`<Subject ${n}> ${where}${tail}.${speaker}`);
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

  /**
   * 兜底：一个 `<Subject>` 都没有时（没有角色卡、没有显式 subjects）。
   *
   * ⚠️ 必须分清"有没有参考图"两种情况。
   *
   * 旧实现无条件写 `<Subject 1> is defined by the description below.` +
   * `fully_preserved - keep the appearance and costume shown in the reference
   * pictures.` —— 当用户**只挂了服化道/场景图、没有任何角色**时，
   * 提示词里会出现"保住参考图里的外观和服装"，可参考图里根本没有角色。
   * 模型只能猜，实测会把场景图里的物件当成人。
   *
   * 正确做法：
   *   有图 → 明确说明图里是什么参考，由描述决定内容
   *   无图 → 明确写"纯文字定义，没有外观参考图"
   */
  if (!defs.length) {
    defs.push(
      refs.images.length
        ? `<Subject 1> is described in the text below. The ${refs.images.length} reference picture(s) supply setting and costume details only.`
        : '<Subject 1> is defined by the written description only; no appearance reference pictures were supplied.',
    );
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

  /**
   * 每个 subject 实际出现在哪些镜头。
   *
   * ⚠️ 旧实现硬编码 `(appears in [Shot 1])`：无论 1 镜还是 6 镜，
   *    所有 subject 都写"出现在 Shot 1"。多镜时模型拿到的出现位置是错的，
   *    而官方向导（ref-en.txt:173）的格式是
   *    `<Subject 1> (appears in [Shot 1], [Shot 3])`。
   *
   * 判定：镜头正文/对白里出现了这个 subject 的 name 或 id 就算出现；
   * 无法判定时退回"全部镜头"（宁可多写，不可漏写）。
   */
  function shotsForSubject(subject) {
    const keys = [subject?.name, subject?.id].filter(Boolean).map(String);
    if (!keys.length) return scenes.map((s) => s.index ?? 0).filter(Number.isFinite);
    const hits = [];
    for (const sc of scenes) {
      const hay = [
        sc?.description, sc?.camera,
        sc?.dialogue?.text, sc?.dialogue?.speaker,
        Array.isArray(sc?.subjects) ? sc.subjects.join(' ') : '',
      ].filter(Boolean).join(' ');
      if (!hay) continue;
      if (keys.some((k) => hay.includes(k))) hits.push(sc.index ?? 0);
    }
    return hits.length ? hits : scenes.map((s) => s.index ?? 0).filter(Number.isFinite);
  }

  subjects.forEach((s, i) => {
    const n = i + 1;
    if (!s.hasImage) {
      // 没有图的角色不能写 fully_preserved —— 没有任何东西可以"保住"。
      // 明写 `text_only` 让阅读提示词的人（和后续工具）一眼看出这是纯文字定义。
      ret.push(`<Subject ${n}>: weak_reference - text_only; appearance follows the written description because no reference picture was supplied for this subject.`);
      return;
    }
    const what = s.traits ? s.traits.replace(/[。．.]\s*$/, '') : 'face, hairstyle and costume';
    const shots = shotsForSubject(s);
    // 官方向导：retention_analysis 里**不写** (Sx)
    const where = shots.length ? ` (appears in ${shots.map((k) => `[Shot ${k}]`).join(', ')})` : '';
    ret.push(`<Subject ${n}>${where}: fully_preserved - keep ${what}.`);
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
    ret.push(
      refs.images.length
        ? '<Subject 1>: attribute_transfer - take setting and costume details from the reference pictures; appearance follows the description.'
        : '<Subject 1>: weak_reference - text_only; appearance follows the written description because no reference pictures were supplied.',
    );
  }
  out.push(...ret);
  out.push('');

  /* ---- 4. detailed_description ---- */
  out.push('detailed_description:');
  const body = [];

  // 风格定调（**整串保留**，见 SHORT_STYLE_CHARS 的说明）
  const styleText = String(style.en || '').trim();
  if (styleText) {
    body.push(styleText);
    if (styleText.length > SHORT_STYLE_CHARS) {
      warnings.push(
        `画风串 ${styleText.length} 字符（>${SHORT_STYLE_CHARS}）—— 可能与参考素材抢权重。`
        + '已按 v2.1 §3.1「逐字照抄」整串保留，不做截断；若发现角色不贴参考图，'
        + '优先简化 subjects 的描述而不是砍画风串',
      );
    }

    /**
     * 防线 1（群友 v2.1 §15.2）：画风串后**另起一行**追加压制行。
     *
     * ⚠️ 不能改动画风串原文一字 —— v2.1 §3.1 要求"逐字照抄，不缩写、
     *    不改写、不合并"。所以压实行是**独立一行**，不是画风串的一部分。
     *
     * 为什么必须追加：官方的 11 个画风串里只有 3/4/5/7 带 `NO subtitles`，
     * 其余（1/2/6/8/9/10）都没有。不加这一行，那些画风的段会出字幕。
     * 实测（群友）：画风 10 + 压实行 → 无字幕。
     */
    body.push('');
    body.push(SUPPRESSION_GUARDS.textSuppression);
    body.push('');
  }

  /**
   * 打光通道：紧跟画风之后、动作之前。
   *
   * 官方反模式 #2 的顺序是「主体 → 动作 → 镜头 → **光线** → 声音」，
   * 但风格块本身占据开头，光线是风格的直接延伸，
   * 所以放在这里比放到最后更符合"先定调再叙事"。
   *
   * 打光串**同样不截断** —— 理由与画风串一致：我们自己的 LIGHTING_PRESETS
   * 都是短句，没有官方那种"约束句在末尾"的结构；一旦以后有人加了长串，
   * 截断同样会砍掉末尾的光比/暗部行为约束。
   */
  const lighting = resolveLighting(input.lighting ?? input.lightingId ?? input.lightId);
  const lightingText = String(lighting?.en || '').trim();
  if (lightingText) {
    // 画风 × 打光冲突要提示（不是错误，是取舍）
    for (const msg of styleLightingConflicts(style, lighting)) warnings.push(msg);
    body.push(lightingText);
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
      body.push(endSentence(sentence));

      const speaker = resolveSpeaker(sc, subjects);
      if (sc.dialogue?.text) {
        const lang = sc.dialogue.lang || 'Chinese';
        const emo = sc.dialogue.emotion ? ` (${sc.dialogue.emotion})` : '';
        /**
         * ⚠️ `(Sx)` 必须与 subject_definitions 里分配的编号**完全一致**。
         *
         * resolveSpeaker 在没有明确 speaker 字段时会退回 `(S1)`，
         * 而 subject_definitions 里的 S 编号是按"首次发声音序"算的（见上方
         * speakerIds）。两者可能不一致 —— 同一个角色在两段里拿到不同的 S 号，
         * 模型会以为是两个人。这里统一用 speakerIds 的结果覆盖。
         */
        const sid = speakerIds.get(speakerSubjectIndex(sc.dialogue, subjects) ?? -1);
        const label = sid
          ? speaker.label.replace(/\(S\d+\)\s*$/, `(S${sid})`)
          : speaker.label.replace(/\s*\(S\d+\)\s*$/, '');
        body.push(`${label} is visible on screen and says${emo}: <d>[${lang}] ${sc.dialogue.text}</d>`);
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

  /**
   * 防线 2（群友 v2.1 §15.2）：画面完整性句。
   *
   * 位置 = detailed_description **末尾**、免责句之前（免责句在 compile()
   * 里由 route 层追加，所以这里 push 到最后即是正确顺序）。
   *
   * 主语是"画面里的东西"（正向描述），不给 overlay 留位置 ——
   * 属 §15.1 的合法位置，不会被压制词检查判为违规。
   * 群友实测：这句让 overlay 出现率降到 0。
   */
  body.push(SUPPRESSION_GUARDS.frameIntegrity);

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
  // ⚠️ 单挂角色卡、`refs.images` 为空时，图其实是以 `<Picture N>` 形式
  //    由 subjects 声明进来的（见上方的 provided / subjects 逻辑）。
  //    旧实现只看 refs.images，于是"纯角色卡"的 Ref2VA 提示词 summary 前面
  //    没有 `[reference generation]` 前缀 —— 违反 ref-en.txt:126 的格式要求，
  //    而 routeFormat 自己的 reason 却写着"有 N 个角色声明了参考图编号"。
  if (!refs.images.length) {
    const declaredPics = (Array.isArray(input.subjects) ? input.subjects : [])
      .filter((s) => s && Number.isFinite(Number(s.pictureIndex)) && Number(s.pictureIndex) > 0);
    if (declaredPics.length) tasks.push('reference generation');
  }
  if (refs.videos.some((_, i) => refs.videoUses[i] === 'continuation')) tasks.push('video continuation');
  if (refs.audios.length) tasks.push('audio reference');
  return [...new Set(tasks)].join(' + ');
}

/**
 * 让一句话**恰好**以一个英文句号结尾。
 *
 * ⚠️ 为什么需要它：中文输入的描述自带句号「。」，而官方格式要求半角 `.`。
 *    旧实现直接 `sentence + '.'`，于是出现 `…吹向一侧。.` ——
 *    中文句号后面又跟一个英文句号。模型看到的是两个句末符号，
 *    分段边界变模糊（实测这一步在三条镜头上都复现）。
 *
 * 规则：剥掉尾部任意标点（中英文句号/逗号/分号/空白），再补一个 `.`。
 */
function endSentence(s) {
  const t = String(s ?? '').trim().replace(/[。．.，,；;、\s]+$/u, '');
  return t ? `${t}.` : '';
}

/* ============================================================ 压制词落位 */
/**
 * 压制词（"不要什么"）的落位检查 —— 群友 skill v2.1 第十五章。
 *
 * ============================================================================
 * 为什么需要它
 * ============================================================================
 *
 * 官方 H3 本地推理的 CFG 固定 1.0、采样器没有 negative 分支，
 * 所以**写在正文里的"不要 X"反而会把 X 拉进画面**。
 * 但"完全不写否定"又做不到 —— 字幕、水印、冗余肢体确实必须压。
 *
 * v2.1 给的解法是**按位置授权**，不是按词性豁免：
 *
 *   ① 画风串后的追加压制行   Text suppression: NO subtitles, ...
 *   ② 场景板出图负面清单     people, text, subtitles, ...
 *   ③ 具名物的属性声明       whose board carries no legible lettering
 *
 * 这三处之外出现独立负面句，就是"没有通道的负面词"，
 * 既不起作用、又占字数、还稀释注意力。
 *
 * §15.1 的判断口诀：
 *   句子主语是可画的东西 → 正向描述
 *   句子主语是「不要什么」 → 只在上面三处
 *
 * @param {string} prompt
 * @returns {{ violation: string|null }}
 */
function scanSuppressionPlacement(prompt) {
  const p = String(prompt ?? '');

  /**
   * ① 合法的机制句式 —— 整体剥掉，不看。
   *
   * 这些句子里含 no/without，但主语是**时间轴事件**（"本段不引入新事件"），
   * 不是画面元素。按 v2.1 的口诀它们不属压制词。
   */
  const MECHANISMS = [
    CONTINUATION_SWITCH.carried,
    CONTINUATION_SWITCH.opening,
    TRIM_DISCIPLINE.carried,
    TRIM_DISCIPLINE.opening,
  ].filter(Boolean);
  let hay = p;
  for (const b of MECHANISMS) hay = hay.split(b).join(' ');

  /**
   * ② 官方的参考关系说明（"参考视频只提供运动，不提供外观"这类）——
   *    主语是参考素材的**语义边界**，不是画面元素，同样不属压制词。
   */
  const OFFICIAL_RELATIONS = [
    'does not define character appearance',
    'do not copy characters or set',
    'do not copy the waveform',
    'do not follow characters or set',
    'no reference picture was supplied',
    'It carries no audio',
  ];
  for (const s of OFFICIAL_RELATIONS) hay = hay.split(s).join(' ');

  /**
   * ③ 合法位置 1：追加压制行。整行剥掉（它本身就是要检查的"授权处"）。
   */
  hay = hay.replace(/^Text suppression:.*$/gm, ' ');

  /**
   * ④ 合法位置 3：具名物属性声明。形如
   *      "whose board carries no legible lettering and no text of any kind"
   *      "remaining folded and furled throughout"
   *    主语是物，属正向句法。剥掉含 `whose|remaining|carries no` 的分句。
   */
  hay = hay.replace(/\b(?:whose|remaining)\b[^.;]*/g, ' ');
  hay = hay.replace(/\bwith no [a-z]+[^.;]*/gi, ' ');

  /**
   * ⑤ 剩下的：找**独立负面句**。
   *
   * 只认这几种强信号，避免误报：
   *   · 句首的 "Do not ..." / "Never ..." / "Avoid ..."
   *   · 字段内独立成句的 "NO xxx, NO yyy"（连续两个以上大写 NO）
   *   · 中文"不要/禁止/避免"开头
   *
   * 单看一个 "no" 太容易误报（"with no visible seam"是正向物理描述），
   * 所以要求更强的上下文。
   */
  const bad = [
    /(?:^|[.!?;]\s*|\n\s*)Do not\s+[a-z]/i,
    /(?:^|[.!?;]\s*|\n\s*)Never\s+[a-z]/i,
    /(?:^|[.!?;]\s*|\n\s*)Avoid\s+[a-z]/i,
    /\bNO\s+[a-z][\w-]*(?:\s*,\s*NO\s+[a-z][\w-]*)+/,
    /(?:^|[。！？；：\n])\s*(?:不要|禁止|避免)/,
  ].find((re) => re.test(hay));

  if (!bad) return { violation: null };

  const hit = bad.exec(hay)?.[0]?.trim() ?? '';
  return {
    violation:
      `发现没有通道的负面句「${hit.slice(0, 60)}」—— 本地 CFG 固定 1.0、`
      + '采样器没有 negative 分支，写在正文里反而把该元素拉进画面。'
      + '群友 v2.1 §15.1 规定压制词只有三处合法位置：'
      + '①画风串后的 Text suppression 追加行 ②场景板负面清单 ③具名物属性声明。'
      + '其余情况请改成正向陈述（"画面里只有…" / "whose board carries no …"）',
  };
}

/* ============================================================ 输出后检查 */
/**
 * 编译产物自查 —— 官方格式最容易踩的几条，全部做成可见警告。
 *
 * 为什么在"编译之后"还要再查一遍：格式是靠字符串拼出来的，
 * 拼错了编译器不会报错，只有模型表现变差 —— 属于最难查的一类失效。
 */
export function lintCompiledPrompt(prompt, format, warnings = []) {
  let p = String(prompt ?? '');
  const w = warnings;

  /**
   * ⚠️ 先把**插件自己注入的**续写开关整段剥掉再检查。
   *
   * 续写开关（CONTINUATION_SWITCH）与时序纪律（TRIM_DISCIPLINE）是插件
   * 自动拼在最顶部的机制指令，里面天然含 "No reference picture resets pose…"、
   * "carries no new event — no new gesture, no new head turn, no new line…"。
   *
   * 这些是**时间轴约束**，不是"画面里不要出现 X"的负面提示词。
   * 如果在否定检测里扫到它们，会对**每一个**续写段都误报，
   * 用户照提示去改就会把群友 skill 明确要求的机制句删掉。
   *
   * 所以整段剥离，而不是靠 SCAFFOLD 逐句豁免（那样漏一个就误报一次）。
   */
  for (const b of [CONTINUATION_SWITCH.carried, CONTINUATION_SWITCH.opening,
    TRIM_DISCIPLINE.carried, TRIM_DISCIPLINE.opening]) {
    if (b) p = p.split(b).join(' ');
  }

  // 1) 字符上限
  //
  // 分两道：
  //   · 超过 6000（本插件收紧值）→ warning，提示精简
  //   · 超过 7000（官方硬上限）  → 额外 warning，说明上游可能拒
  if (p.length > H3_LIMITS.promptMaxChars) {
    w.push(
      `提示词 ${p.length} 字符超过本插件上限 ${H3_LIMITS.promptMaxChars}`
      + '（官方 7000 过大，实测会稀释动作细节的注意力）。'
      + '建议优先压缩：画风串后的重复描述、光影层里的解释性从句、声音行的重复。',
    );
    if (p.length > H3_LIMITS.promptOfficialMaxChars) {
      w.push(`提示词 ${p.length} 字符也超过了官方硬上限 ${H3_LIMITS.promptOfficialMaxChars}，上游可能拒绝`);
    }
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
  // ⚠️ 这条规则在 2026-11-18 按群友 skill v2.1 第十五章重写。
  //
  // 旧实现是"一张 SCAFFOLD 白名单，把模板自己产出的、以及续写开关里的
  // 所有含 no/without 的短语逐条剥掉，剩下任何否定词就报警"。
  // 那张白名单已经长到 46 条，每加一句模板就要加一条，漏一条就误报一次 ——
  // 这是典型的"用穷举掩盖没有规则"。
  //
  // v2.1 §15.1 给出了**有原则的判据**：压制词（"不要什么"）只有三处合法位置，
  // 其余字段一律不得出现独立负面句。
  //
  //   ① 画风串后的追加压制行（Text suppression: NO subtitles, ...）
  //   ② 场景板出图负面清单
  //   ③ 具名物的属性声明（正向句法：whose board carries no legible lettering）
  //
  // 所以现在的做法不是"逐条豁免"，而是**按字段判断**：
  // 先按字段切开提示词，只有 detailed_description 里的压制句才检查位置合法性，
  // 其它字段出现独立负面句才报警。§15.5 的字段级矩阵就是这么规定的。
  const negScan = scanSuppressionPlacement(p);
  if (negScan.violation) {
    w.push(negScan.violation);
  }

  /**
   * 续写开关 / 时序纪律是**机制指令**，不是画风 ban list（§15.1 判断口诀：
   * 主语是"不要什么"→ 只在三处；主语是时间轴事件 → 不属压制词）。
   * 它们已经被 scanSuppressionPlacement 按"已知机制句式"整体排除，
   * 这里不再需要 SCAFFOLD 白名单。
   */

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

/**
 * 返回**发声者对应的 subject 下标**（0-based），没有则 null。
 *
 * 与 resolveSpeaker 的区别：那个产出人类可读标签，这个只回答"这句台词是
 * 哪个 subject 说的"，用来在 subject_definitions 里按**真实发声顺序**分配
 * `(Sx)`。官方 ref-en.txt:278：`(Sx)` 只在真正发声时才出现，
 * 且按目标视频里首次发声的先后编号。
 */
function speakerSubjectIndex(dialogue, subjects) {
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
function styleLeadSentence(style, input, warnings = null) {
  const parts = [];
  const text = String(style?.en ?? '').trim();
  if (text) parts.push(text.replace(/[.\s]+$/, ''));
  /**
   * 打光也在开头定调句里（与画风并列）。
   *
   * 基础格式（t2va/i2va/fl2va）没有 detailed_description 的段落结构，
   * 全部内容都挤在 `[Shot 1]` 之前那句定调 + 对齐指令里，
   * 所以打光必须显式并进来，否则这条通道在关键帧模式下会静默失效。
   */
  const lighting = resolveLighting(
    input?.lighting ?? input?.lightingId ?? input?.lightId,
  );
  const lightingText = String(lighting?.en ?? '').trim();
  if (lightingText) {
    /**
     * 画风 × 打光冲突检测必须**两条格式路径都跑**。
     *
     * 之前只在 Ref2VA 里做了，基础格式（t2va/i2va/fl2va）静默通过 ——
     * 而那正是关键帧模式，用户最容易忽略画风冲突的场景。
     */
    if (Array.isArray(warnings)) {
      for (const msg of styleLightingConflicts(style, lighting)) warnings.push(msg);
    }
    parts.push(lightingText.replace(/[.\s]+$/, ''));
  }
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
      /**
       * ⚠️ `description` 必须保留。
       *
       * 角色卡的 `description`（"白发少女"这类身份描述）以前在这里被丢掉，
       * 只留 traits。后果：提示词里只剩"双马尾, 红瞳"这种零碎外观词，
       * 模型不知道这是谁、是什么身份 —— 角色卡的核心价值（身份锚点）没了。
       * 群友 skill 第 2 批「人物标准句式」要求
       * `<Subject N> is the <description> shown in <Picture M>.`
       */
      description: String(s.description ?? '').trim(),
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
  /**
   * ⚠️ 不能再截断成 100 字符。
   *
   * 历史缺陷：`scenes[0].action.slice(0, 100)`。而 `action` 通常就是整段
   * `description`（150–300 字符）。截断的后果不是"变短"，而是**句子断在半截**：
   * 实测产物是
   *     summary: … walk side by side along the shoreline from left to right, holding
   * `holding hands` 被切成 `holding`，模型拿到一个未完成的短语。
   *
   * 现在：不切片。`summary` 官方没有长度上限（提示词总长才有 7000 字符限制，
   * 由 lintCompiledPrompt 统一检查）。
   */
  const first = scenes?.[0]?.action ? String(scenes[0].action).trim() : '';
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
    /**
     * 打光通道（光比预设）。
     *
     * 优先级：显式 opts > 镜头卡 lightingId > 镜头卡 lighting（自定义英文描述）。
     * 与画风一样是正交通道，可以任意组合。
     */
    lightingId: opts.lightingId ?? shot.lightingId ?? null,
    lighting: opts.lighting ?? shot.lighting ?? null,
    /**
     * 续写上下文。
     *
     * 南风的续写任务 JSON 存在 job.params.continuationTask，
     * 经 opts 透传进来。`index > 1` 的段会在提示词顶部加续写开关。
     */
    continuationTask: opts.continuationTask ?? shot.continuationTask ?? null,
    continuationIndex: opts.continuationIndex ?? shot.continuationIndex ?? null,
    contextLength: opts.contextLength ?? shot.nanfeng?.overrides?.context_length ?? '22',
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
