/**
 * 五段续写提示词 —— 按群友 skill（h3-group-master）规范编写。
 *
 * 用法：node tools/build-prompts.mjs
 * 输出：docs/prompts.json（可直接被 test-render.mjs 读取）
 *
 * ============================================================================
 * 写法依据
 * ============================================================================
 *
 * · 段 1：开场段，`opening` 反向声明 + 首秒可自由编写
 * · 段 2-5：承接段，**开关三组件在最顶部**（由插件自动加，这里不重复写）
 * · 段 2-5 的第 0-1 秒是裁切区，所有动作从 1 秒起
 * · 光比递进 4:1 → 5:1 → 6:1（越近越暗）
 * · 每段末尾用「段尾免责句」防止模型声明上一段已精确结束
 */
import fs from 'node:fs';

/* ------------------------------------------------------------ 共用片段 */

/** 场景锚点 —— 每段都要重述（属于「抽象规则」类，latent 不保存） */
const SCENE_ANCHOR = 'The location is the same seaside promenade at sunset: pale stone paving slabs, '
  + 'a white painted-metal railing along the sea side, a row of black lamp posts on the land side, '
  + 'clipped round green shrubs behind them, one folded cream-white parasol, one dark cylindrical bin, '
  + 'and one wooden bench. The sea horizon is dead straight and level with the subjects\u2019 shoulders. '
  + 'A single low cloud band floats just above the waterline. '
  + 'The sky reads as a warm sunset gradient only\u2014pale gold at the horizon through warm orange '
  + 'to muted violet\u2014filling the entire upper frame.';

/** 光照系统 —— 五段式：主光系统 / 体积光 / 材质响应 / 高光纪律 / 天空锁
 *
 * ⚠️ 用正向陈述写。本地 CFG 固定、采样器没有 negative 分支，
 *    "no specular" / "no lens flare" 这类会反而把对应元素拉进画面。
 *    所以改成"某材质呈现某种确定的、平的效果"。
 */
function lightBlock(ratio, ratioWord, extra = '') {
  return `The key light is the low sun over the sea, eight degrees above the horizon. `
    + `It lays a hard-edged warm highlight along the sea-side contour of heads, shoulders and hair, `
    + `while the land side falls into flat block cel shadow at a ${ratioWord} ratio whose boundary with `
    + `the lit zone is a single hard edge, carrying a crisp painted-cel finish. `
    + `Sea haze fills the air, so the backlight reads as visible shafts between the railing balusters, `
    + `with fine motes drifting slowly through the beams. `
    + `Cotton, wool and jacket fabric render as strictly flat matte cel fills with block shadow and a `
    + `uniform dull surface. The white railing returns a soft painted-metal sheen. `
    + `The bench wood keeps a flat matte finish with visible grain. `
    + `The sea carries a hard-edged glitter path built from separate bright strokes. `
    + `Every highlight is a single hard edge that stays inside its own shape, with a clean flat `
    + `cel-painted surface throughout and a uniformly crisp graphic finish. `
    + `The sky is a warm sunset gradient from pale gold at the horizon through warm orange to muted violet, `
    + `with one low dark cloud band just above the waterline. ${extra}`.trim();
}

/** 睦子外观重述（每段必写 —— 属于「抽象规则」类） */
const MUTSUMI = 'the shorter girl on screen-left. Long straight grey-green hair past the waist with a '
  + 'blunt fringe; a single narrow light-green hairpin sits above her left ear against that same '
  + 'grey-green hair, and the right side of her head is bare. Amber eyes, thick lashes. '
  + 'Cream-white blazer over a black top, deep green pleated skirt, black tights, black ankle boots.';

/** 祥子外观重述 */
const SAKIKO = 'the taller girl on screen-right. Long grey-blue hair past the waist with a blunt fringe, '
  + 'the right side gathered into a small braid tied with a black-and-yellow diagonal-striped ribbon. '
  + 'Amber eyes, sharp gaze. Grey tartan long-sleeved dress to the ankle, white shirt collar, '
  + 'thin black neck bow, thin black belt.';

/** 段尾免责句（三段式，按段替换承接物与状态类型） */
function tail(carried, action, detail, stateType) {
  return `The intended new beat is placed after the carried ${carried} overlap: ${action} begins only `
    + `after the first second, and ${detail} follows the carried ${carried} without asserting that the `
    + `previous segment has ended at an exact ${stateType}.`;
}

/* -------------------------------------------------------------- 五段 */

const SEGMENTS = [
  {
    index: 1,
    title: '大全景 · 并肩走向海',
    ratio: '4:1',
    mode: 'ref2va',
    // 段 1 是开场：可以自由摆姿态、第一秒有效
    body: `This is the opening segment, so the first second stands free of any carried overlap and it `
      + `is fully authored. Every action below begins at the first frame.\n\n`
      + `[Shot 1] A static wide shot from behind. Two girls walk side by side away from camera along the `
      + `seaside promenade, heading toward the water, their backs to us, shoulder width about one hand `
      + `apart. ${MUTSUMI} She is on screen-left. ${SAKIKO} She is on screen-right.\n\n`
      + `They walk at an unhurried, even pace — roughly one step per second, arms hanging relaxed, both gazes `
      + `fixed ahead toward the water. Their shadows stretch forward-left across the pale stone `
      + `slabs. The camera stays perfectly static for the whole beat, letting them recede slightly into `
      + `the frame, holding one fixed framing throughout.\n\n`
      + lightBlock('4:1', 'four-to-one') + '\n\n' + SCENE_ANCHOR + '\n\n'
      + `Sound is sea surf breaking in a slow regular cycle about six seconds long, distant gulls, and `
      + `a faint high wind, with the two girls staying silent.`,
    soundscape: 'Sea surf breaking slowly and regularly against the sea wall below, distant gulls '
      + 'calling once or twice, a faint high wind over open water, no voices.',
  },
  {
    index: 2,
    title: '中近景 · 侧脸看海',
    ratio: '5:1',
    mode: 'ref2va',
    body: `[Shot 2] The camera cuts to a medium close two-shot in side view. `
      + `The first second continues the carried walk as pure continuation, and the stop begins at the one-second mark. `
      + `Then both girls stop walking and settle into stillness as one continuous move, holding a `
      + `constant distance and constant side-view angle, settling into stillness at a fixed framing.\n\n`
      + `Both faces are turned toward screen-left, looking out over the water. ${MUTSUMI} `
      + `${SAKIKO} The two stand close, Mutsumi very slightly forward of Sakiko. Their expressions are `
      + `calm and unreadable; both stay silent and both keep facing the water.\n\n`
      + lightBlock('5:1', 'five-to-one',
        'Because the sun is now behind them, a bright rim traces the sea-side contour of both faces while '
        + 'the front planes stay in soft reflected fill; a faint cel-shaded blush sits high on each cheek.') + '\n\n'
      + SCENE_ANCHOR + ' The railing now crosses the lower quarter of frame.\n\n'
      + `Sound thins as the camera comes closer: the surf drops in level, the wind recedes, and the `
      + `remaining bed is a soft low room tone with one distant gull.`,
    soundscape: 'Surf receding into a soft low bed, one distant gull, gentle wind, no voices.',
  },
  {
    index: 3,
    title: '中景 · 睦子坐下',
    ratio: '4:1',
    mode: 'ref2va',
    body: `[Shot 3] The camera cuts to a medium shot, both figures framed knee-up. `
      + `The first second continues the carried standing as pure continuation, and the sit begins at the one-second mark. `
      + `Then Mutsumi lowers herself onto the wooden bench in one continuous motion — she bends at the `
      + `hips, reaches back with her right hand to find the bench edge, and settles her weight down, her `
      + `pleated skirt opening slightly with the movement. Sakiko stays standing beside her and turns `
      + `her upper body a little toward Mutsumi staying planted in place.\n\n`
      + `${MUTSUMI} ${SAKIKO} The dark cylindrical bin and the folded parasol pole sit at frame-left `
      + `behind Mutsumi. The camera holds a static frame; the only movement is the small downward `
      + `reframe that tracks Mutsumi as she sits.\n\n`
      + lightBlock('4:1', 'four-to-one',
        'Sakiko\u2019s body partly occludes the sun, so her hair edge carries a blown-out bright rim while '
        + 'Mutsumi sits just inside the edge of Sakiko\u2019s shadow, half her face lit and half in shade. '
        + 'One narrow orange specular streak runs down the front of Mutsumi\u2019s black tights.') + '\n\n'
      + SCENE_ANCHOR + '\n\n'
      + `Sound adds cloth friction and the small creak of the bench taking weight.`,
    soundscape: 'Cloth rustling, a quiet wooden creak from the bench, sea surf continuing underneath, no voices.',
  },
  {
    index: 4,
    title: '中景 · 并坐',
    ratio: '4:1',
    mode: 'ref2va',
    body: `[Shot 4] The camera cuts back to a medium two-shot, three-quarter side view. `
      + `The first second continues the carried seated hand position as pure continuation, and the settle begins at the one-second mark. `
      + `Then both settle: Mutsumi rests both hands on her own knees and lets her shoulders drop; `
      + `Sakiko folds her hands together in her lap and straightens her back. Both keep their gaze `
      + `toward screen-left, out over the water, and neither turns her head.\n\n`
      + `${MUTSUMI} ${SAKIKO} The parasol canopy forms a flat cream-white backdrop block behind them; `
      + `the bin sits at frame-left of Mutsumi. The railing crosses behind both figures and the sun and `
      + `sea remain visible through its uprights. Mutsumi\u2019s skirt hem falls over the bench edge and a `
      + `soft curved highlight sits across the top of her knee.\n\n`
      + lightBlock('4:1', 'four-to-one',
        'The sun has dropped low enough that its light now enters almost horizontally from screen-right; '
        + 'both figures cast long flat shadows forward across the paving.') + '\n\n'
      + SCENE_ANCHOR + '\n\n'
      + `Sound settles into the slowest version of the surf with faint breathing and cloth movement.`,
    soundscape: 'Slow gentle surf, faint breathing, small cloth movement, no voices.',
  },
  {
    index: 5,
    title: '特写 · 触碰与回应',
    ratio: '6:1',
    mode: 'ref2va',
    body: `[Shot 5] The camera cuts to an extreme close-up of Mutsumi\u2019s black-tight-covered thigh `
      + `filling two thirds of the frame. The first second continues the carried seated state as pure continuation. Then Sakiko\u2019s hand enters from frame-right: first her left hand from above, four `
      + `fingers together, fingertips settling on the upper thigh; then her right hand from the side, `
      + `fingers spreading, the tips coming to rest against the outer curve. Each hand rests with gentle weight, `
      + `presses; both simply arrive and stay.\n\n`
      + `The camera performs one very slow push-in across the whole beat, holding a constant angle and `
      + `holding one continuous framing. A long diagonal specular streak runs across the black fabric and `
      + `narrows where the fingertips meet it.\n\n`
      + `The background is defocused: the horizontal slats of the bench, the vertical uprights of the `
      + `railing, and a scatter of water glints.\n\n`
      + `This beat runs at six-to-one contrast. The key light comes from behind frame-right at sunset `
      + `angle, placing hard-edged warm highlights on the backs of the fingers and along the fabric `
      + `streak, while the undersides of the hands fall into flat deep cel shadow that still holds skin `
      + `texture at the knuckles. Every highlight is a single hard edge that stays inside its own shape, with a clean flat `
      + `cel-painted surface and a uniformly crisp painted finish.\n\n`
      + `Sound thins almost to nothing, leaving only the faintest surf and the smallest brush of `
      + `fabric.`,
    soundscape: 'Almost silence: the faintest surf far away, a single small brush of fabric against fabric, no voices, no music.',
  },
  {
    index: 6,
    title: '特写 · 睦子的笑',
    ratio: '6:1',
    mode: 'ref2va',
    body: `[Shot 6] The camera cuts to an extreme close-up of Mutsumi\u2019s face, filling the frame, `
      + `seen from slightly below in a three-quarter view. The first second continues the carried facial `
      + `pose as pure continuation. Then her expression shifts: the corners of her mouth lift into a small, `
      + `restrained, almost knowing smile, and her eyelids lower very slightly. She does not speak.\n\n`
      + `${MUTSUMI} Her fringe strands fall across her forehead and a few fine hairs lie against her `
      + `cheek. Her amber irises carry a warm orange pinpoint reflection from the low sun. A cel-shaded `
      + `blush spreads across her cheeks and fades toward her jaw. At the lower edge of frame Sakiko\u2019s `
      + `hand enters from outside and hovers near her cheek hovering just off the skin. The edge of the light-green `
      + `hairpin is visible at frame-right.\n\n`
      + `This beat runs at six-to-one contrast. The low sun now strikes from screen-left, so the upper `
      + `half of her face is lit and the lower half falls into flat block cel shadow, with a single hard `
      + `boundary that keeps her eye and eyelash detail clear. Hard-edged highlights sit on the bridge of `
      + `her nose, her cheekbone and her lower lip. Every highlight is a single hard edge that stays inside its own shape, with `
      + `glow overlay.\n\n`
      + `The background is a soft out-of-focus field of the sunset sky in pale gold and warm orange with `
      + `one low dark cloud band filling the entire upper frame with sunset colour only.\n\n`
      + `The camera holds nearly still with only a whisper of push-in. Sound is the surf returning gently `
      + `as the music fades out.`,
    soundscape: 'Surf returning gently, one distant gull, then the ambient music fades to nothing.',
  },
];

/* --------------------------------------------------------------- 输出 */

const out = {
  _source: '逐镜复刻《11月17日 (2).mp4》（海滨黄昏 · 睦子与祥子）',
  _spec: '按 skills/prompt/group-master 规范编写；段 2 起由插件自动加续写开关三组件',
  style: 'ova90s',
  segments: SEGMENTS.map((s) => ({
    index: s.index,
    title: s.title,
    ratio: s.ratio,
    mode: s.mode,
    // 打光由 lightingId 控制（插件会插到风格之后）
    lightingId: s.ratio === '6:1' ? 'closeup-6-1' : 'dramatic-4-1',
    body: s.body,
    soundscape: s.soundscape,
  })),
};

fs.writeFileSync(new URL('../docs/prompts.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log(`写出 ${out.segments.length} 段提示词 -> docs/prompts.json`);
for (const s of out.segments) {
  console.log(`  段 ${s.index}  ${s.title}  ${s.ratio}  ${s.body.length} 字符`);
}
