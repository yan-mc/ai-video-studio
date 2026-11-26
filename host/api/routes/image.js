/**
 * 图像域：/image/*（元信息 / LoRA / 出图 / 局部重绘 / 进度）、/breakdown/*（立绘拆解）。
 */
import { newJob, jobs as jobsStore } from '../../services/job-store.js';
import {
  H3_IMAGE_MODELS, H3_IMAGE_SIZES, IMAGE_VAE, IMAGE_CLIP, IMAGE_SAMPLING, checkImageModels,
  IMAGE_PROMPT_MAX_CHARS, IMAGE_MAX_REF_IMAGES, IMAGE_MAX_BATCH, IMAGE_MAX_LORAS,
  validateImageRequest, effectiveImageSteps, effectiveMaxMP,
} from '../../services/h3-image.js';
import {
  IMAGE_LORA_ROOT, IMAGE_LORA_CATEGORIES, catalogImageLoras, solveImageLoraStack,
} from '../../services/h3-image-lora.js';
import { inpaintMeta, runH3Inpaint } from '../../services/h3-inpaint.js';
import { prepareInpaint, inpaintSubmitSummary } from '../../services/inpaint-task.js';
import { runH3ImageLocal } from '../../services/generator.js';
import { imageLoraWarnings, submitImageJobs, writeProgress, solveImageLoras } from '../image-task.js';
import {
  BREAKDOWN_PROMPT_MAX_CHARS, BREAKDOWN_SIZE, DEFAULT_BREAKDOWN_PROMPT,
  buildBreakdownPrompt, isDefaultBreakdownPrompt, legacyBreakdownFields, breakdownSize,
} from '../../services/breakdown.js';
import { resolveImageEditRefs, appendStyleAnchors } from '../../services/ref-images.js';
import { compileImagePrompt, imagePromptMeta } from '../../services/image-prompt/index.js';
import { STRENGTH_LIMITS } from '../../services/lora-catalog.js';
import { runAndArchive } from '../archive.js';
import { loadImageWorkflow } from '../backend.js';
import { fireAndLog } from '../errors.js';
import { readJsonBody } from '../http.js';
import { probeLoraFiles, countByCategory } from './meta.js';
import { safeId } from '../../security.js';
import { projectJobForProgress } from './generate.js';


export async function handleImage(req, res, R) {
  const { route, url, cfg, ctx, json, safeId, resolveUserPath } = R;

  /* ---------------- 图像生成（H3-Image） ---------------- */

  if (req.method === 'GET' && route === '/image/meta') {
    // 回**真实生效值**而不是声明值：配置覆盖后前端徽章必须跟着变
    return json(200, {
      models: H3_IMAGE_MODELS,
      vae: IMAGE_VAE,
      clip: IMAGE_CLIP,
      sampling: { ...IMAGE_SAMPLING, steps: effectiveImageSteps(cfg) },
      effective: {
        steps: effectiveImageSteps(cfg),
        declaredSteps: IMAGE_SAMPLING.steps,
        stepsOverridden: effectiveImageSteps(cfg) !== IMAGE_SAMPLING.steps,
        maxMP: effectiveMaxMP(cfg),
        promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
        maxRefImages: IMAGE_MAX_REF_IMAGES,
        maxBatch: IMAGE_MAX_BATCH,
        maxLoras: IMAGE_MAX_LORAS,
        // 采样参数由 checkpoint 的 PDD 头网格决定，不可调 —— UI 据此隐藏滑块
        samplingLocked: true,
      },
      sizes: H3_IMAGE_SIZES,
      status: checkImageModels(cfg),
      loraCategories: IMAGE_LORA_CATEGORIES,
      /** 提示词编译器元信息：画风表 / 段落顺序 / 画风锚说明 / 反 3D 判定 */
      promptCompiler: imagePromptMeta(),
      /**
       * 局部重绘能力（含分级档位）。
       *
       * 前端的分级面板从 `meta.inpaint.gradedLevels` 读档位表 ——
       * 这是**唯一真源**，档位校准值改了前端就跟着变，不在前端写死。
       */
      inpaint: await inpaintMeta(cfg),
    });
  }

  /*
   * 图像 LoRA 目录：只列 `models/loras/h3img/` 下的文件。
   * 不能复用 /lora/catalog —— 视频那套会把 599 个视频 LoRA 混进来，
   * 而两边键集完全相同、光看文件名分不出来。
   */
  if (req.method === 'GET' && route === '/image/lora/catalog') {
    const { probed, probeError } = await probeLoraFiles(cfg);
    const items = catalogImageLoras(probed ?? []);
    return json(200, {
      ok: true,
      probed: probed != null,
      ...(probeError ? { probeError } : {}),
      root: IMAGE_LORA_ROOT,
      categories: IMAGE_LORA_CATEGORIES,
      limits: STRENGTH_LIMITS,
      items,
      byCategory: countByCategory(items),
      total: items.length,
      hint: `把 H3-Image 的 LoRA 放进 models/loras/${IMAGE_LORA_ROOT}/<分类目录>/ 后重启 ComfyUI 即可出现在这里。`
        + '（Civitai 上请用 baseModel = "MiniMax H3 Image" 过滤，视频 LoRA 不要放进这个目录）',
    });
  }

  if (req.method === 'POST' && route === '/image/lora/solve') {
    const body = await readJsonBody(req);
    const requested = Array.isArray(body.items) ? body.items : [];
      const { probed } = await probeLoraFiles(cfg);
    const solved = solveImageLoraStack(requested, {
      maxSlots: Number(body.maxSlots) || IMAGE_MAX_LORAS,
      ...(probed ? { availableFiles: probed } : {}),
      hasRefImages: Boolean(body.hasRefImages),
    });
    return json(200, { ok: true, ...solved });
  }

  /*
   * 提交出图。除 prompt 外全部可选：
   *   refImages ≤16（第 1 张 = 被编辑的原图）| sizeId / width / height | seed |
   *   count 1..4（拆成 N 个独立任务，DiT 拒绝 batch>1）| loras [{name,strength}]
   */
  if (req.method === 'POST' && route === '/image/generate') {
    const body = await readJsonBody(req);
    const wf = loadImageWorkflow(cfg);
    if (!wf) return json(500, { error: 'WORKFLOW_MISSING' });

    /**
     * 提示词编译 —— **默认开启**。
     *
     * 为什么默认开：本地没有官方那个 prompt expander（PE），
     * 用户写一句"画画一个在海边的女孩"时，模型只能照字面理解，
     * 缺场景细节、缺光线、缺质感。编译这一步就是在补 PE 的职责。
     *
     * 三条入口都保留：
     *   · `text`      —— 短需求 / 中文，展开成完整英文描述
     *   · `prompt`    —— 用户直接写的提示词；若已是完整英文长描述则**不重写**
     *   · `compile:false` —— 完全跳过编译器，按原样提交（排障用）
     *
     * ⚠️ 编译器本身不改 `body.prompt` 的语义，只做"补齐 + 加约束 + lint"。
     */
    const compilerOn = body.compile !== false;
    let compiled = null;
    if (compilerOn) {
      try {
        compiled = compileImagePrompt({
          text: body.text ?? '',
          rawPrompt: body.rawPrompt ?? (body.text ? '' : (body.prompt ?? '')),
          styleId: body.styleId ?? 'none',
          styleAnchor: body.styleAnchor
            ? { ...body.styleAnchor, index: Number(body.styleAnchor.index) }
            : null,
          aspect: body.aspect,
          lettering: body.lettering,
          negativeHints: body.negativeHints,
          noText: body.noText,
        });
        if (compiled.prompt) body.prompt = compiled.prompt;
        if (body.styleAnchor && compiled.usedAnchor) {
          body.styleAnchorMode = body.styleAnchor.mode;
        }
      } catch (e) {
        // 编译失败不该阻断出图：回退到原始 prompt，但把原因告诉用户
        compiled = { warnings: [`提示词编译失败，已按原文提交：${String(e?.message || e)}`] };
      }
    }

    // 校验规则集中在 h3-image.js；失败要回**结构化 400**，不能让 code 变成 message
    let req0;
    try {
      req0 = validateImageRequest(body, cfg);
    } catch (e) {
      return json(400, {
        error: String(e?.code || 'IMAGE_BAD_REQUEST'),
        detail: String(e?.message || e).replace(/^[A-Z_]+:\s*/, ''),
        ...(e?.detail ?? {}),
      });
    }

    const refResolved = resolveImageEditRefs(req0.refImages ?? body.refImages ?? [], cfg);
    const refWarnings = [];
    if (refResolved.bad.length || refResolved.dropped) {
      // "传了 3 张实际只用上 2 张"必须在请求期说清楚，否则只会被当成模型不听话
      if (refResolved.bad.length) {
        refWarnings.push(
          `无法解析 ${refResolved.bad.length} 张：${refResolved.bad.map((b) => `${b.input}（${b.reason}）`).join('；')}`,
        );
      }
      if (refResolved.dropped) {
        refWarnings.push(`超出上限 ${refResolved.max} 张，已忽略 ${refResolved.dropped} 张`);
      }
      if (!refResolved.ok.length) {
        return json(400, {
          error: 'REF_IMAGE_UNRESOLVED',
          detail: refWarnings.join('。'),
          badRefs: refResolved.bad,
          maxRefImages: refResolved.max,
        });
      }
    }

    /**
     * 画风锚：**独立通道**，永远追加在参考图末尾，绝不占用 `image_1`。
     *
     * `image_1` 决定输出画布尺寸且是被编辑的原图 —— 画风图若排到第 1 位，
     * 文生图会被它的尺寸带偏、编辑会把画风图当成编辑对象。
     * 详见 services/ref-images.js 的 appendStyleAnchors 注释。
     */
    const styleBody = Array.isArray(body.styleAnchorImages) ? body.styleAnchorImages : [];
    const anchored = appendStyleAnchors(refResolved.ok, styleBody, cfg);
    const refsWithAnchors = anchored.refs;
    if (anchored.warnings.length) refWarnings.push(...anchored.warnings);
    if (anchored.bad.length) {
      refWarnings.push(
        `画风参考图无法解析 ${anchored.bad.length} 张：`
        + anchored.bad.map((b) => `${b.input}（${b.reason}）`).join('；'),
      );
    }

    const solvedLoras = solveImageLoras(req0.loras, {
      availableFiles: (await probeLoraFiles(cfg)).probed,
      hasRefImages: refsWithAnchors.length > 0,
    });
    const warnings = [...refWarnings, ...imageLoraWarnings(solvedLoras)];

    /**
     * 交给提交层的 refResolved 必须是**合并画风锚之后**的列表：
     * 画风图要真正出现在 `images.image_N` 里，否则它只是个 UI 装饰。
     */
    const refResolvedFinal = {
      ...refResolved,
      ok: refsWithAnchors,
      styleAnchors: anchored.anchors,
      firstStyleAnchorIndex: anchored.firstAnchorIndex,
    };

    const { jobs, batchId } = await submitImageJobs({
      body, cfg, ctx, req0, refResolved: refResolvedFinal, solvedLoras, warnings, wf,
    });

    return json(200, {
      ...jobs[0],
      // 单任务时 jobIds 长度为 1 —— 保持形状一致，前端不必判分支
      jobIds: jobs.map((j) => j.id),
      batchId,
      count: jobs.length,
      mode: refResolved.ok.length ? 'edit' : 't2i',
      refCount: refResolvedFinal.ok.length,
      refRels: refResolvedFinal.ok.map((r) => r.rel),
      /** 画风锚单独回报，前端据此提示"哪几张是画风参考" */
      styleAnchorCount: anchored.anchors.length,
      styleAnchors: anchored.anchors.map((a) => ({ index: a.index, rel: a.rel })),
      loraCount: solvedLoras.accepted.length,
      loraStack: solvedLoras.accepted.map((a) => `${a.name}@${a.appliedStrength}`),
      promptChars: req0.promptChars,
      /** 编译器实际做了什么：是否展开、是否注入反 3D、用了哪个画风 */
      ...(compiled ? {
        compiled: {
          used: compiled.prompt !== undefined,
          usedRaw: Boolean(compiled.usedRaw),
          styleId: compiled.styleId ?? 'none',
          anti3dApplied: compiled.anti3dApplied ?? null,
          chars: compiled.chars ?? null,
        },
        promptWarnings: compiled.warnings ?? [],
      } : {}),
      warnings,
    });
  }

  /*
   * 局部重绘元信息。`denoiseLocked: true` + `denoiseReason` 让 UI 不渲染
   * denoise 滑块 —— 这是 PDD 蒸馏模型的硬约束，不是保守设计。
   */
  if (req.method === 'GET' && route === '/image/inpaint/meta') {
    return json(200, await inpaintMeta(cfg));
  }

  if (req.method === 'POST' && route === '/image/inpaint') {
    const body = await readJsonBody(req);
    const wf = loadImageWorkflow(cfg);
    if (!wf) return json(500, { error: 'WORKFLOW_MISSING' });

    // 编排只有一份实现（services/inpaint-task.js）：校验→解析→尺寸→建 job
    let prepared;
    try {
      prepared = await prepareInpaint(body, cfg);
    } catch (e) {
      return json(400, {
        error: String(e?.code || 'INPAINT_BAD_REQUEST'),
        detail: String(e?.message || e).replace(/^[A-Z_]+:\s*/, ''),
        ...(e?.detail ?? {}),
      });
    }

    const { job, req: req0, sourceAbs, maskAbs } = prepared;
    await jobsStore().upsert(job);

    fireAndLog(
      runAndArchive(job, async (running, hooks) => runH3Inpaint({
        baseWorkflow: wf,
        job: running,
        req: req0,
        sourceAbs,
        maskAbs,
        cfg,
        onSubmitted: hooks?.onSubmitted,
        onProgress: (p) => writeProgress(running.id, p),
      }), ctx),
      ctx,
      `inpaint job ${job.id}`,
    );

    return json(200, inpaintSubmitSummary(prepared));
  }

  /*
   * 出图进度（前端 1.5s 轮询）。必须**按 id 逐个取**，
   * 不能 list() 全量再挑 —— 那等于每 1.5 秒读一遍所有历史 job 的 prompt 全文。
   */
  if (req.method === 'GET' && route === '/image/progress') {
    const ids = String(url.searchParams.get('ids') || '')
      .split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { try { return safeId(s, /^job_[A-Za-z0-9]+$/); } catch { return ''; } })
      .filter(Boolean)
      .slice(0, IMAGE_MAX_BATCH * 2);
    const store = jobsStore();
    const picked = await Promise.all(ids.map((id) => store.get(id).catch(() => null)));
    return json(200, { ok: true, jobs: ids.map((id, i) => projectJobForProgress(picked[i], id)) });
  }

  /* ---------------- 立绘拆解 / 角色设定卡 ---------------- */

  if (req.method === 'GET' && route === '/breakdown/meta') {
    return json(200, {
      defaultPrompt: DEFAULT_BREAKDOWN_PROMPT,
      maxChars: BREAKDOWN_PROMPT_MAX_CHARS,
      size: BREAKDOWN_SIZE,
      removedFields: ['character', 'outfit', 'parts', 'views', 'notes', 'level', 'sizeId'],
    });
  }

  if (req.method === 'POST' && route === '/breakdown/preview') {
    const body = await readJsonBody(req);
    const prompt = buildBreakdownPrompt(body);
    const legacyUsed = legacyBreakdownFields(body);
    return json(200, {
      prompt,
      chars: prompt.length,
      maxChars: BREAKDOWN_PROMPT_MAX_CHARS,
      isDefault: isDefaultBreakdownPrompt(prompt),
      size: BREAKDOWN_SIZE,
      ...(legacyUsed.length
        ? {
          legacyFieldsIgnored: legacyUsed,
          note: `字段 ${legacyUsed.join(' / ')} 已不再影响提示词，请直接改写 prompt。`,
        }
        : {}),
    });
  }

  if (req.method === 'POST' && route === '/breakdown/generate') {
    const body = await readJsonBody(req);
    if (!cfg) return json(500, { error: 'CONFIG_MISSING' });
    const wf = loadImageWorkflow(cfg);
    if (!wf) return json(500, { error: 'WORKFLOW_MISSING' });

    const prompt = buildBreakdownPrompt(body);
    const size = breakdownSize();
    const legacyUsed = legacyBreakdownFields(body);

    // 超长在请求期挡住：静默 slice 会让"末尾加的红色礼裙"悄悄消失且无报错可查
    if (prompt.length > BREAKDOWN_PROMPT_MAX_CHARS) {
      return json(400, {
        error: 'PROMPT_TOO_LONG',
        detail: `提示词 ${prompt.length} 字符，超过上限 ${BREAKDOWN_PROMPT_MAX_CHARS}。`
          + '请精简后再提交（不会静默截断，以免你写的要求被悄悄丢掉）。',
        chars: prompt.length,
        maxChars: BREAKDOWN_PROMPT_MAX_CHARS,
      });
    }

    /*
     * 参考图必须是至少一张能解析的本地图：
     * 三种失败（空路径 / 不存在 / 越界）全部静默跳过的话，
     * 一个空输入也会照常提交 t2i，模型被要求"据此绘制"一张不存在的图。
     */
    const refAbs = [];
    const badRels = [];
    for (const r of (Array.isArray(body.refImages) ? body.refImages : [])) {
      const raw = String(r ?? '').trim();
      if (!raw) { badRels.push('（空路径）'); continue; }
      try {
        refAbs.push(resolveUserPath({ root: cfg.dataDir, input: raw, mustExist: true }));
      } catch (e) {
        const msg = String(e?.message || e);
        badRels.push(msg === 'FORBIDDEN_PATH' ? `${raw}（不在 dataDir 内，已拒绝）` : `${raw}（文件不存在）`);
      }
    }
    if (!refAbs.length) {
      return json(400, {
        error: 'REF_IMAGE_REQUIRED',
        detail: '立绘拆解必须提供至少一张参考图（原立绘或设定图）。'
          + '没有参考图时模型会凭空造一个角色，产出不可用。',
        badRels,
      });
    }

    // 尺寸固定，但仍做请求期校验：imageMaxMP 是用户可改的配置
    const mp = (size.w * size.h) / 1e6;
    const maxMp = Number(cfg.imageMaxMP) || 4.3;
    if (mp > maxMp) {
      return json(400, {
        error: 'IMAGE_SIZE_TOO_LARGE',
        detail: `${size.w}×${size.h} ≈ ${mp.toFixed(2)}MP，超过上限 ${maxMp}MP。`
          + '立绘拆解固定用这一档尺寸；要出图请调大设置里的「单张出图面积上限」。',
        size,
        maxMP: maxMp,
      });
    }

    const job = newJob({
      projectId: body.projectId ? safeId(String(body.projectId)) : null,
      shotId: null,
      backendId: 'h3-image',
      prompt,
      params: {
        kind: 'image',
        // 标记立绘拆解任务 —— 图像页「最近任务」要把它排除（两者 backendId 相同）
        breakdown: true,
        imageSizeId: size.id,
        width: size.w,
        height: size.h,
        seed: body.seed ?? Math.floor(Math.random() * 2147483647),
      },
      mode: 'edit',
    });
    job.kind = 'image';
    await jobsStore().upsert(job);

    fireAndLog(
      runAndArchive(job, async (running) => runH3ImageLocal({
        workflow: wf,
        job: running,
        prompt,
        shot: { refs: { images: refAbs }, imageSizeId: size.id },
        cfg,
      }), ctx),
      ctx,
      `breakdown job ${job.id}`,
    );

    return json(200, {
      ...job,
      refCount: refAbs.length,
      chars: prompt.length,
      size,
      badRels,
      ...(legacyUsed.length ? { legacyFieldsIgnored: legacyUsed } : {}),
    });
  }

  return false;
}