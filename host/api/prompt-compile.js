/**
 * 提示词编译入口 —— 被 host/tools.js 直接 import。
 *
 * 从 api/index.js 逐字迁出（原 2811-3019 行）。
 *
 * 两条路径：手写成品（>200 字整段采用）与官方结构化编译；
 * 结构化编译失败时退回官方基础格式的三字段兜底。
 */
import { compileH3Prompt, H3_LIMITS, toShotInputPackage, truncatePromptKeepFields } from '../bridge/index.js';
import { planImageSlots, resolveRefImages, resolvePrevizArtifacts } from '../services/ref-images.js';
import { buildMediaNotes, buildRenderPlan } from '../services/render-plan.js';
import { resolvePictureIndices } from '../services/shot-context.js';
import { normalizeMode } from '../store/models.js';

/**
 * 编译提示词。
 *
 * 优先走 **H3 官方六段式/三段式编译器**（services/h3-prompt.js），
 * 它按用户提供的技能书规范生成结构化提示词。
 * 镜头卡没给够字段时（无 subjects / 无 shots）退回简单的段落拼接，
 * 保证旧数据仍能生成。
 */
export function compilePrompt(shot, outWarnings = null) {
  // ⚠️ 手工提示词优先级最高：直接整段使用，不再走编译。
  //
  // 为什么必须放在最前面：用户在渲染页的提示词编辑器里写好的完整六段式，
  // 是**成品**，不是素材。早先的实现在编译后用
  // `pkg.sceneLayout += shot.prompt` 把整段塞进 SCENE LAYOUT 字段，
  // 结果模型收到的是「自动编译的骨架 + 后面挂一坨完整提示词」的畸形文本，
  // 两套 subject_definitions 互相打架。
  //
  // 判据：长度超过 200 字符才认为是"用户手写的完整提示词"，
  // 避免老数据里 `prompt: "一句话描述"` 这类简短备注被误当成成品。
  if (typeof shot.prompt === 'string' && shot.prompt.trim().length > 200) {
    // 手写成品同样要守官方硬上限 —— 但按句末截断，不在单词中间切断
    return truncatePromptKeepFields(shot.prompt.trim(), H3_LIMITS.promptOfficialMaxChars);
  }

  // 走官方结构：需要有 mode 或 styleId，或显式给了 subjects。
  // mode 统一归一化，短名（t2v/i2v/fl2v）也能正确进编译器分支。
  const mode = normalizeMode(shot.mode, { hasRefImages: (shot.refs?.images?.length ?? 0) > 0 });
  const useStructured = Boolean(mode || shot.styleId || shot.subjects?.length || shot.h3mode);
  if (useStructured) {
    try {
      // ⚠️ subjects 优先级：显式 subjects > 角色卡 > 从 description 猜。
      //    早先只看 shot.subjects，导致用角色卡生成的镜头 **summary 里没有角色名**
      //    （deriveSummary 拿不到 subjects，拼出「的一段戏。」这种残句）。
      //
      // ⚠️ pictureIndex 必须来自**真实参考图顺序**（resolvePictureIndices），
      //    不能是"第几张卡"。之前用 i+1：一旦有卡没图 / 有手工图 /
      //    有视频音频占位，编号就整体错位，提示词里的 <Picture N> 指错人。
      //    渲染页展示的编号（/render/plan）与这里必须一致。
      const cardSubjects = Array.isArray(shot.characterCards)
        ? resolvePictureIndices(shot)
        : [];
      const subjects = shot.subjects ?? (cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(shot));

      const pkg = toShotInputPackage(shot, {
        styleId: shot.styleId ?? null,
        subjects,
        scenes: shot.scenes ?? undefined,
        seed: shot.seed,
        /**
         * 续写上下文透传。
         *
         * `continuationTask` 存在 job.params 上（见 executeBackend 的 runH3Nanfeng 调用），
         * 但 compilePrompt 只拿到 shot —— 所以调用方需要先把它挂到 shot 上。
         * 见 executeBackend 里的 `shotForCompile`。
         */
        continuationTask: shot.continuationTask ?? null,
        continuationIndex: shot.continuationIndex ?? null,
        contextLength: shot.nanfeng?.overrides?.context_length ?? '22',
      });
      // 兼容旧字段：description/camera/style 已在 toShotInputPackage 里映射。
      //
      // 短备注（≤200 字）同时写进 `sceneLayout` **和**第一个镜头的 `action`。
      //
      // 为什么必须写两处：`toShotInputPackage` 永远会造一个默认 shots 数组，
      // 于是 `compileRef2VA` 的 `if (scenes.length)` 恒为真、`sceneLayout` 分支
      // 恒不执行 —— 只写 sceneLayout 等于把这段文字扔进死字段。
      // LoRA 触发词通常就是一句短文本，正好落在这个长度区间。
      const shortPrompt = shot.prompt ? String(shot.prompt).trim() : '';
      if (shortPrompt && shortPrompt.length <= 200) {
        const desc = String(pkg.sceneLayout ?? '').trim();
        const dup = desc.includes(shortPrompt)
          || (Array.isArray(pkg.shots) && pkg.shots.some((s) => String(s?.action ?? '').includes(shortPrompt)));
        if (!dup) {
          pkg.sceneLayout = `${pkg.sceneLayout}\n${shortPrompt}`;
          // 真正会被 compileRef2VA 读到的位置
          if (Array.isArray(pkg.shots) && pkg.shots.length) {
            const first = pkg.shots[0];
            first.action = `${String(first.action ?? '').trim()} ${shortPrompt}`.trim();
          }
        }
      }

      // 环境声/配乐要显式带过去：不写就会被 workbench 的默认值
      // （"环境底噪" / "N/A"）覆盖，镜头卡里填的真实值进不了提示词。
      if (shot.sound) pkg.overall_soundscape = shot.sound;
      if (shot.music) pkg.non_diegetic_music = shot.music;

      // 参考视频/音频的**用途说明**必须走 buildMediaNotes。
      //
      // 缺了它，compileRef2VA 会退化到内置默认句：所有参考视频都被写成
      // `transfer motion only`，"续篇 / 节奏 / 氛围"三类用途表达不出来，
      // 参考音频也拿不到"谁的音色"绑定。
      try {
        // ⚠️ buildRenderPlan 是**解构对象**入参，不是 (shot, cfg)。
        //    传错形状会让 cards / manualImages 静默丢失 → mediaNotes 为空。
        const plan = buildRenderPlan({
          cards: shot.characterCards ?? [],
          manualImages: shot.refs?.images ?? [],
          previz: shot.previz ?? null,
          sceneImages: [...(shot.sceneRefs ?? []), ...(shot.itemRefs ?? [])],
          videos: shot.refs?.videos ?? [],
          audios: shot.refs?.audios ?? [],
          refImageSize: shot.refImageSize ?? 'match',
        });
        const notes = buildMediaNotes(plan);
        if (Array.isArray(notes) && notes.length) pkg.mediaNotes = notes;
      } catch { /* 构建计划失败不影响编译 */ }

      const r = compileH3Prompt(pkg);
      // ⚠️ 不能静默 slice(0,7000)。
      //
      //    compileH3Prompt 内部的 lintCompiledPrompt 只**警告**不截断，而这里
      //    硬切会从中间砍断字段：六段格式被切成两段，detailed_description 与
      //    non_diegetic_music 整段消失，模型收到的是结构残缺的提示词，
      //    而且那两条「超过 7000 上游可能拒绝」的警告也随 r.warnings 一起被丢弃。
      //
      //    现在：超长时保留完整字段边界地截断，并把 lint 警告交给调用方
      //    （`outWarnings` 数组，由 generate 写进 job.warnings 让用户看得见）。
      if (Array.isArray(r.warnings) && r.warnings.length && Array.isArray(outWarnings)) {
        outWarnings.push(...r.warnings);
      }
      if (r.prompt && r.prompt.length > 40) {
        return r.prompt.length > H3_LIMITS.promptOfficialMaxChars
          ? truncatePromptKeepFields(r.prompt, H3_LIMITS.promptOfficialMaxChars)
          : r.prompt;
      }
    } catch {
      // 结构化编译失败 → 退回简单拼接，不让生成中断
    }
  }
  // ==========================================================================
  // 兜底：结构化编译抛错时的极简组装
  // ==========================================================================
  //
  // ⚠️ 兜底也必须遵守官方基础格式（至少三字段）。
  //    拼"风格：X / 运镜：Y / 台词：Z"这种自由文本标签串是没有官方格式依据的，
  //    模型拿到的只是一堆冒号标签 —— 宁可少写内容，也不能产出没有结构的东西。
  const fallbackDesc = [
    shot.description,
    shot.camera ? `The camera ${shot.camera}.` : '',
    shot.dialogue ? `The subject is visible on screen and says: <d>[Chinese] ${shot.dialogue}</d>` : '',
  ].filter(Boolean).join(' ').trim();

  const fb = [
    `integrated_multimodal_description: [Shot 1] ${fallbackDesc || 'A short scene.'}`,
    '',
    `overall_soundscape: ${shot.sound || 'Quiet environmental room tone with soft air movement.'}`,
    '',
    `non_diegetic_music: ${shot.music || 'N/A'}`,
  ].join('\n');

  return fb.slice(0, 7000);
}

/**
 * 从镜头卡推断 subjects（参考图 → 角色）。
 * 没有显式 subjects 时用这个兜底，让结构化编译器也能工作。
 *
 * ⚠️ 已导出：`host/tools.js` 的 `studio_prompt(fromShot)` 必须用同一份逻辑，
 *    否则"Agent 编译的提示词"与"REST 预览 / 真实生成"会漂移。
 *    任何新的预览入口都应调用这里，不要自己再写一份。
 */
export function deriveSubjectsFromShot(shot) {
  // 参考图编号的**唯一权威**在 services/ref-images.js：先按真实提交顺序解析，
  // 再由 planImageSlots 分配最终 <Picture N>（首尾帧会占用槽位，所以编号
  // 不等于"手工图数组的第 N 个"）。
  //
  // 历史缺陷（已修）：这里曾经是**第三套**编号实现 ——
  //   const imgs = (shot.refs?.images ?? []).slice(0, 9);
  //   → ① 完全无视角色卡（角色卡优先于手工图，编号会整体错位）；
  //     ② 无视首尾帧占槽（fl2va 时 <Picture 1> 其实指向首帧）；
  //     ③ 名字硬编码成"角色1..N"，与提示词里的人物名对不上。
  const refs = resolveRefImages(shot);
  if (!refs.length) return [];
  /**
   * ⚠️⚠️ 必须把首/尾帧也传进去（历史 P0：这里是**第三套编号实现**）。
   *
   *    planImageSlots 的槽位分配取决于「首尾帧占不占槽」：
   *      · fl2va：首帧占 图片1、尾帧占 图片2 → 参考图从 <Picture 3> 起
   *      · i2va ：首帧占 图片1                → 参考图从 <Picture 2> 起
   *
   *    旧写法传的是空字符串（等于"没有首尾帧"），于是在 fl2va 下
   *    这里算出 <Picture 1>，而真实提交算出的才是 <Picture 3> ——
   *    **同一个镜头，编译出的提示词认为角色是 1 号、实际提交是 3 号**，
   *    相差 2，表现为串脸，且任何日志都不说。
   */
  const previzSlots = resolvePrevizArtifacts(shot);
  const slots = planImageSlots(
    shot?.mode,
    refs.map((r) => r.abs),
    previzSlots['{{FIRST_FRAME}}'] ?? '',
    previzSlots['{{LAST_FRAME}}'] ?? '',
  );
  return refs
    .map((r, i) => ({
      id: `S${i + 1}`,
      name: r.cardName || r.source || `参考图${i + 1}`,
      pictureIndex: slots.pictureIndexMap.get(i) ?? null,
      gender: 'FEMALE',
      traits: '',
    }))
    .filter((s) => s.pictureIndex !== null);
}
