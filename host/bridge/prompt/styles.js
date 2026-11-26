/**
 * 画风库与打光库 —— 纯数据 + 两条正交通道的解析/冲突检测（无编译逻辑，可单独 import）。
 * @module prompt/styles
 */

/** 画风预设 —— 本地风格集，非官方。`en` 必须整串：规范要求逐字照抄、不缩写改写合并。 */
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
     * Ligne Claire（清晰线条 / 欧洲漫画风）：等宽线条、平涂、无渐变、构图干净。
     * 天然排斥硬阴影与强光比，同时选 4:1 / 8:1 打光会互相削弱（见 note）。
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
     * 地狱客栈（Vivziepop）：锯齿棱角、粗黑轮廓、平涂高对比色块、暗调 + 高饱和点缀。
     * 与 helltaker-look 的区别：Helltaker 是黑白红极简，Vivziepop 是多彩。
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
 * Ref2VA 分支下画风串的软阈值（不是截断点）。官方串的约束句全在末尾，
 * 任何缩短都会砍掉反模式约束，所以这里只决定是否额外提示"可能抢权重"。
 */
export const SHORT_STYLE_CHARS = 180;

/**
 * 打光预设（光比 = 主光照度 : 补光照度）。南风参数表里没有任何打光参数，
 * H3 是纯提示词驱动，所以把「4:1」翻成可观测的视觉描述。打光与画风正交，
 * 顺序放在风格之后、动作之前。
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
    /** 6:1 —— 脸部特写专用档：暗部大幅压深，但保留眼睛与睫毛细节 */
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

/** 取打光预设；未知 id 回落到 none */
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
 * 画风 × 打光冲突表。两条通道技术上正交但语义上会打架（平涂画风要"无强投影"，
 * 而 4:1 以上打光要"硬边边界"），同时选会互相削弱 —— 属取舍，进 warnings 不报错。
 */
export const STYLE_LIGHTING_CONFLICTS = Object.freeze([
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
]);

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

/**
 * 解析画风选择。`styleId: 'none'` 返回空画风（`en: ''`），不注入任何定调句 ——
 * "关掉画风只用 LoRA" 必须真的能做到。
 */
export function resolveStyle(input = {}, defaultIndex = 2) {
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
  if (String(input.styleId ?? '').toLowerCase() === 'none') {
    return { id: 'none', name: '不指定（交给 LoRA）', en: '', ban: '', changesAppearance: false };
  }
  return STYLE_PRESETS[defaultIndex];
}