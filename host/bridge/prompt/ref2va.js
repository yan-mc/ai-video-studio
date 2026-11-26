/**
 * Ref2VA 六段正文拼装。固定顺序：subject_definitions → summary → retention_analysis
 * → detailed_description → overall_soundscape → non_diegetic_music。
 * @module prompt/ref2va
 */
import { RETENTION_AUDIO, SUPPRESSION_GUARDS } from './spec.js';
import { resolveLighting, styleLightingConflicts, SHORT_STYLE_CHARS } from './styles.js';
import {
  cameraPhrase, endSentence, isAsciiText, resolveSpeaker, speakerSubjectIndex,
  summaryTasks, deriveSummary, timecode,
} from './text-utils.js';

/**
 * 角色卡文字设定 → subject_definitions 段内的英文行（供 services 层塞进
 * `input.referenceBindings`）。中文 description 不进句法，外观由参考图承载。
 * @param {Array<{name?:string, description?:string, traits?:string|string[]}>} cards
 * @param {Map<number, number|null>|null} pictureIndexMap 卡下标 → 槽位号
 * @returns {string[]}
 */
export function cardBindingLines(cards = [], pictureIndexMap = null) {
  const out = [];
  const list = Array.isArray(cards) ? cards : [];
  list.forEach((card, i) => {
    const name = String(card?.name ?? '').trim();
    if (!name) return;
    const pic = pictureIndexMap instanceof Map ? pictureIndexMap.get(i) : null;
    const rawDesc = String(card?.description ?? '').trim().replace(/[。．.；;\s]+$/u, '');
    const desc = isAsciiText(rawDesc) ? rawDesc : '';
    const traits = Array.isArray(card?.traits) ? card.traits.join(', ') : String(card?.traits ?? '');
    const traitText = isAsciiText(traits) ? String(traits).trim() : '';
    const bits = [desc, traitText].filter(Boolean);
    const head = pic
      ? `${name} is the character shown in <Picture ${pic}>`
      : `${name} is defined by the written description only (no reference picture supplied)`;
    out.push(`${head}${bits.length ? `, ${bits.join(', ')}` : ''}.`);
  });
  return out;
}

/** 拼 Ref2VA 六段。@param ctx 由 compileH3Prompt 组装的上下文 @returns {string} */
export function compileRef2VA(ctx) {
  const { style, subjects, refs, scenes, soundscape, music, input, warnings } = ctx;
  const out = [];

  /* ---- 1. subject_definitions ---- */
  out.push('subject_definitions:');
  const defs = [];

  const provided = Array.isArray(input.mediaNotes) ? input.mediaNotes.filter(Boolean) : [];
  if (provided.length) defs.push(...provided.map((s) => String(s).trim()));

  // 参考绑定（角色卡 → 槽位号）写在本段内，不是末尾追加第 7 段
  const bindings = Array.isArray(input.referenceBindings) ? input.referenceBindings.filter(Boolean) : [];
  if (bindings.length) defs.push(...bindings.map((s) => String(s).trim()));

  // (Sx) 只在真正有台词时才写，按首次发声顺序生成
  const speakerIds = new Map();
  {
    let next = 1;
    for (const sc of scenes) {
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
    // traits 可能是中文标签 —— 中文不进正文，由参考图承载
    const traitsText = String(s.traits ?? '').trim().replace(/[。．.]\s*$/, '');
    if (traitsText !== '' && isAsciiText(traitsText)) bits.push(traitsText);
    if (s.heightCm) bits.push(`${s.heightCm}cm tall`);
    const tail = bits.length ? `, with ${bits.join(', ')}` : '';
    const sid = speakerIds.get(i);
    const speaker = sid ? ` This subject speaks as (S${sid}).` : '';

    // 官方句式 `<Subject N> is the <description> shown in <Picture M>.`；
    // 中文 description 不嵌英文句法，退回泛化写法。
    const rawDesc = String(s.description ?? '').trim().replace(/[。．.]\s*$/, '');
    const desc = isAsciiText(rawDesc) ? rawDesc : '';
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

  // mediaNotes 已定义过 <Video>/<Audio> 就不再重复（重编号会让模型产生歧义）
  const hasProvidedMediaDefs = provided.some((s) => /<Video \d+>|<Audio \d+>/.test(String(s)));
  if (!hasProvidedMediaDefs) {
    refs.videos.forEach((_, i) => {
      const use = refs.videoUses[i] ?? 'motion';
      const map = {
        motion: 'is the source for camera movement, blocking and motion timing',
        rhythm: 'is the source for editing rhythm and shot timing',
        mood: 'is the source for atmosphere and lighting only',
        continuation: 'is the immediately preceding clip; the target video continues it directly',
        style: 'is the source for visual style only',
      };
      defs.push(`<Video ${i + 1}> ${map[use] ?? map.motion}. It does not define character appearance.`);
    });

    refs.audios.forEach((_, i) => {
      const n = i + 1;
      const owner = subjects.find((s) => s.audioIndex === n);
      const who = owner ? `<Subject ${subjects.indexOf(owner) + 1}>` : 'the speaking subject';
      defs.push(`<Audio ${n}> is the voice-timbre reference for ${who}.`);
    });
  }

  /**
   * 兜底：一个 <Subject> 都没有时必须分清"是否有参考图"——只挂场景图时写
   * "保住参考图里的外观和服装"会让模型把物件当成人。
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

  /** 官方向导格式：`<Subject 1> (appears in [Shot 1], [Shot 3])` */
  function shotsForSubject(subject) {
    const all = scenes.map((s) => s.index ?? 0).filter(Number.isFinite);
    const keys = [subject?.name, subject?.id].filter(Boolean).map(String);
    if (!keys.length) return all;
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
    return hits.length ? hits : all;
  }

  subjects.forEach((s, i) => {
    const n = i + 1;
    // 没有图的角色不能写 fully_preserved —— 没有任何东西可以"保住"
    if (!s.hasImage) {
      ret.push(`<Subject ${n}>: weak_reference - text_only; appearance follows the written description because no reference picture was supplied for this subject.`);
      return;
    }
    const rawWhat = String(s.traits ?? '').trim().replace(/[。．.]\s*$/, '');
    const what = (rawWhat !== '' && isAsciiText(rawWhat)) ? rawWhat : 'face, hairstyle and costume';
    const shots = shotsForSubject(s);
    // retention_analysis 里**不写** (Sx)
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
    // 音频用音频那套标记；默认借音色 → reference（不复制波形）
    const marker = RETENTION_AUDIO.includes(refs.audioModes[i]) ? refs.audioModes[i] : 'reference';
    ret.push(`<Audio ${i + 1}>: ${marker} - follow timbre and delivery only; do not copy the waveform.`);
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

  // 风格定调（整串保留：官方串的约束句全在末尾，截断会砍掉反模式约束）
  const styleText = String(style.en || '').trim();
  if (styleText) {
    body.push(styleText);
    if (styleText.length > SHORT_STYLE_CHARS) {
      warnings.push(
        `画风串 ${styleText.length} 字符（>${SHORT_STYLE_CHARS}）—— 可能与参考素材抢权重。`
        + '已整串保留，不做截断；若发现角色不贴参考图，'
        + '优先简化 subjects 的描述而不是砍画风串',
      );
    }
    // 防线 1：画风串后另起一行追加压制行（不改动画风串原文一字）
    body.push('');
    body.push(SUPPRESSION_GUARDS.textSuppression);
    body.push('');
  }

  // 打光通道：紧跟画风之后、动作之前；同样不截断
  const lighting = resolveLighting(input.lighting ?? input.lightingId ?? input.lightId);
  const lightingText = String(lighting?.en || '').trim();
  if (lightingText) {
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
        // (Sx) 必须与 subject_definitions 里分配的编号一致，否则模型以为是两个人
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

  // detailed_description 是主体内容区，不能只有风格句（否则退化成随机抽卡）
  if (body.length <= 1) {
    const fallback = deriveSummary(subjects, []);
    if (fallback) body.push(fallback);
    warnings.push(
      'Ref2VA 的 detailed_description 内容过少（缺 description / shots）—— 官方建议 350–500 词，请补画面过程说明',
    );
  }

  // 灰模/白模参考视频的防泄漏（社区标准句式）
  if (refs.videos.length && refs.videoUses.includes('motion')) {
    body.push('Deliver a fully rendered frame in the target style; the reference video supplies motion and staging only.');
  }

  // 防线 2：画面完整性句（detailed_description 末尾）
  body.push(SUPPRESSION_GUARDS.frameIntegrity);

  out.push(body.join('\n\n'));
  out.push('');

  /* ---- 5/6. 声音两段 ---- */
  out.push(`overall_soundscape: ${soundscape || 'Quiet environmental room tone with soft air movement.'}`);
  out.push('');
  out.push(`non_diegetic_music: ${music}`);

  return out.join('\n');
}