/**
 * 提示词域：/prompt/*、/render/plan、/render/compile。
 */
import { compileH3Prompt, toShotInputPackage, STYLE_PRESETS, LIGHTING_PRESETS, H3_MODES, H3_LIMITS } from '../../bridge/index.js';
import { buildRenderPlan, subjectsForPrompt, buildMediaNotes } from '../../services/render-plan.js';
import { resolveMediaRefs, withVaultCards, resolvePictureIndices } from '../../services/shot-context.js';
import * as comfy from '../../services/comfy-client.js';
import { readJsonBody } from '../http.js';
import { listShots } from '../shots.js';
import { compilePrompt, deriveSubjectsFromShot } from '../prompt-compile.js';

/**
 * 提示词元信息。
 *
 * `styles` 必须前置「不指定」并且可选中 —— 用画风 LoRA 时必须选它，
 * 否则内置画风串（默认 ova90s）会和 LoRA 打架。REST 与 Agent 工具共用本函数。
 */
export function promptMetaPayload() {
  return {
    styles: [
      { id: 'none', name: '不指定（交给 LoRA）', category: '无', changesAppearance: false, en: '' },
      ...STYLE_PRESETS,
    ],
    // 打光通道：南风 221 参数里没有任何打光参数，只能靠 detailed_description 的文字
    lightings: LIGHTING_PRESETS,
    modes: H3_MODES,
    limits: H3_LIMITS,
  };
}

/** 渲染计划：一个镜头"这次要传什么"由这里统一算（编号 / 裁剪 / 角色卡文字） */
export async function computeRenderPlan(body, ctx, cfg) {
  const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter(Boolean) : [];
  const cards = [];
  for (const id of cardIds) {
    const c = await ctx.vault.get(id).catch(() => null);
    if (c) cards.push(c);
  }
  const mediaRefs = await resolveMediaRefs(ctx, cfg, body.videos ?? [], body.audios ?? []);
  return buildRenderPlan({
    cards,
    manualImages: body.manualImages ?? [],
    previz: body.previz ?? null,
    mode: body.mode ?? null,
    sceneImages: body.sceneImages ?? [],
    ...mediaRefs,
    refImageSize: body.refImageSize,
    vram: await comfy.vramStatus(cfg),
  });
}

export async function handlePrompt(req, res, R) {
  const { route, cfg, ctx, json, safeId } = R;

  if (req.method === 'GET' && route === '/prompt/meta') {
    return json(200, promptMetaPayload());
  }

  if (req.method === 'POST' && route === '/prompt/compile') {
    const body = await readJsonBody(req);
    return json(200, compileH3Prompt(body));
  }

  if (req.method === 'POST' && route === '/prompt/from-shot') {
    const body = await readJsonBody(req);
    const pid = safeId(body.projectId || '');
    const shot = body.shot ?? listShots(pid).find((s) => s.id === body.shotId);
    if (!shot) return json(404, { error: 'SHOT_NOT_FOUND' });

    /*
     * 必须走与真实生成相同的入参准备（角色卡优先）。只修 REST 不修这里，
     * 会让"预览里没有 <Subject N>、真正送进模型的却有"。
     */
    let prepared = shot;
    if (pid) prepared = await withVaultCards(shot, pid, ctx, cfg);
    const cardSubjects = Array.isArray(prepared.characterCards)
      ? resolvePictureIndices(prepared, cfg)
      : [];
    const subjects = body.subjects
      ?? (cardSubjects.length ? cardSubjects : deriveSubjectsFromShot(prepared));

    const pkg = toShotInputPackage(prepared, {
      styleId: body.styleId ?? prepared.styleId ?? null,
      subjects,
      scenes: body.scenes,
      seed: body.seed,
    });
    const r = compileH3Prompt(pkg);
    return json(200, {
      ...r,
      package: pkg,
      subjectCount: subjects.length,
      fromVault: cardSubjects.length > 0,
    });
  }

  if (req.method === 'POST' && route === '/prompt/preview') {
    const body = await readJsonBody(req);
    return json(200, compileH3Prompt(body));
  }

  if (req.method === 'POST' && route === '/render/plan') {
    const body = await readJsonBody(req);
    return json(200, await computeRenderPlan(body, ctx, cfg));
  }

  /*
   * 与 /prompt/compile 的区别：这个入口接受 cardIds，**由后端算编号**，
   * 保证提示词里的 <Picture N> 与最终上传顺序一致。
   */
  if (req.method === 'POST' && route === '/render/compile') {
    const body = await readJsonBody(req);
    const plan = await computeRenderPlan(body, ctx, cfg);
    const pkg = toShotInputPackage(
      {
        id: body.shotId ?? 'render',
        mode: body.mode ?? plan.suggestedMode,
        durationSec: body.durationSec ?? 5,
        ratio: body.ratio ?? '16:9',
        styleId: body.styleId ?? null,
        description: body.summary ?? body.description ?? '',
        // images 只用于编译器统计参考图张数；真正的接线在 plan.images 里
        refs: { images: plan.images.map((x) => x.rel) },
      },
      {
        subjects: subjectsForPrompt(plan),
        styleId: body.styleId ?? null,
        sceneLayout: body.sceneLayout ?? '',
      },
    );
    if (body.overall_soundscape) pkg.overall_soundscape = body.overall_soundscape;
    if (body.non_diegetic_music) pkg.non_diegetic_music = body.non_diegetic_music;
    // 自定义英文画风：compileH3Prompt 里 styleEn 优先级最高
    if (body.styleEn) pkg.styleEn = String(body.styleEn);
    if (body.shots) pkg.shots = body.shots;

    // 参考视频/音频的用途说明属于 subject_definitions 段，不能拼在提示词开头
    pkg.mediaNotes = buildMediaNotes(plan);

    return json(200, { ...compileH3Prompt(pkg), plan, package: pkg });
  }

  return false;
}

export { compilePrompt };
