/**
 * 换人批次执行器 —— 长视频 → 多段 → 逐段重绘 → 无损拼接。
 *
 * ============================================================================
 * 为什么执行器要单独一个文件
 * ============================================================================
 *
 * `replace.js` 是纯函数与素材工具（可测、不碰 GPU），
 * 这个文件负责编排：切段 → 逐段提交 H3 → 收集产物 → 拼接 → 落状态。
 *
 * 分开的好处：编排部分是唯一有副作用、唯一难测的地方，
 * 让它可以被单独读一遍就懂（下面注释按阶段标注）。
 *
 * ============================================================================
 * 串行还是并发
 * ============================================================================
 *
 * **严格串行**。原因不是依赖，而是硬件：12GB 单卡，
 * `job-runner` 的并发闸门 `maxConcurrentLocal=1` 本来就会把并发的第二单排队。
 * 在编排层再并发一次只会让两单都"看起来很快开始"，实际还是排队，
 * 进度数字反而更难读。
 *
 * 顺带好处：段与段之间不会有显存碎片，实测单段 8 分钟很稳。
 *
 * ============================================================================
 * 可恢复
 * ============================================================================
 *
 * 每段状态实时落盘（`replace.json`）。中途失败后再次调用 run 会从
 * 第一段未完成的位置继续 —— 已完成的段不会重跑（那是最贵的东西）。
 *
 * @module replace-runner
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { newJob } from './job-store.js';
import { jobs as jobStore } from './job-store.js';
import { runJob } from './job-runner.js';
import { runH3Nanfeng } from './generator.js';
import {
  REPLACE_DEFAULTS,
  replaceStore,
  planSegments,
  cutSegments,
  concatSegments,
  resolveReplaceInput,
} from './replace.js';
import { planForShot } from './accel-plan.js';

/**
 * 跑一个换人批次。
 *
 * @param {object} opts
 * @param {string} opts.replaceId
 * @param {object} [opts.cfg]
 * @param {(evt:object)=>void} [opts.onProgress]
 * @returns {Promise<object>} 最终任务对象
 */
export async function runReplaceBatch({ replaceId, cfg = loadConfig(), onProgress = () => {} }) {
  const store = replaceStore(cfg);
  const task = await store.get(replaceId);
  if (!task) throw new Error(`REPLACE_NOT_FOUND: ${replaceId}`);
  if (task.status === 'running') throw new Error('REPLACE_ALREADY_RUNNING');

  /**
   * 写状态并返回**单条记录**。
   *
   * ⚠️ 两个都必须做对：
   *
   *  1) **必须回读**，不能用 upsert 的返回值。
   *     `replaceStore().upsert()` 底层是 `updateJson`，它返回的是**整个数组**
   *     （写入后的集合），不是刚写进去的那一条。早先这里直接
   *     `return store.upsert(...)`，于是 `current` 变成了数组，
   *     `current.sourceRel` 恒为 undefined →
   *     `resolveReplaceInput(undefined)` 抛 PATH_REQUIRED →
   *     批次在第一步就 failed，而磁盘上的记录明明是对的。
   *     这类"返回值形状错了但不报错"的 bug 只有真跑一次才会暴露。
   *
   *  2) 基准必须是**最新状态**，不是启动时的 `task` 快照。
   *     早先用 `{...task, ...patch}`：`task` 是函数入口读到的旧对象，
   *     里面 `segments` 还是全 pending。第二段 emit 时把它写回去，
   *     等于把第一段的 completed 覆盖掉 → 断点续跑永远从第 1 段重来。
   */
  let baseline = task;
  const emit = async (patch) => {
    await store.upsert({ ...baseline, ...patch });
    const fresh = await store.get(replaceId);
    if (fresh) baseline = fresh;
    onProgress({ replaceId, ...patch });
    return fresh;
  };

  const warnings = [...(task.warnings ?? [])];
  let current = await emit({ status: 'running', error: null, warnings });

  /**
   * 按需拉起 ComfyUI。
   *
   * 用户常态是「ComfyUI 关着」，只在真要渲染时才需要它。
   * `ensureComfyRunning` 会区分「本来就在跑」（用户自己开的，结束后不动）
   * 和「我们拉起的」（结束后关掉释放显存）。
   *
   * ⚠️ 放在 try 内：启动失败要落成 failed 状态，不能静默。
   */
  const lifecycle = await import('./comfy-lifecycle.js');
  try {
    await lifecycle.ensureComfyRunning(cfg, (m) => onProgress({ replaceId, note: m }));
  } catch (e) {
    return emit({
      status: 'failed',
      error: `无法启动 ComfyUI：${String(e?.message || e).slice(0, 400)}`,
      finishedAt: Date.now(),
      warnings,
    });
  }

  try {
    /* ---------- 阶段 1：规划分段 ---------- */
    const sourceAbs = resolveReplaceInput(current.sourceRel, cfg);
    const plan = await planSegments(sourceAbs, cfg, {
      segmentSec: current.segmentSec,
      maxSourceSec: REPLACE_DEFAULTS.maxSourceSec,
      maxSegments: REPLACE_DEFAULTS.maxSegments,
      // 续写模式：段间靠真实 latent 衔接
      continuation: Boolean(current.continuation),
      contextLength: current.contextLength,
      segmentCount: current.segmentCount,
    });
    warnings.push(...plan.warnings);

    /**
     * 段表：保留已完成的段（重跑时用），新增的段补上。
     *
     * ⚠️ 续写模式下**不能复用已完成段**：链条是强依赖的，
     *    第 n 段的 latent 来自第 n-1 段的实际生成结果。如果第 1 段被复用
     *    （来自上一次运行），它的 clip_1 在新的 batchId 下根本不存在，
     *    第 2 段去 Load 必然失败。所以续写模式一律从头跑。
     *
     * 独立模式的匹配键用 `startSec` 而不是 index —— 用户重跑时如果改了
     * segmentSec，段的切点全变了，靠 index 匹配会把错误的产物当成"已完成"。
     */
    const prevByStart = new Map(
      plan.mode === 'continuation'
        ? []
        : (Array.isArray(current.segments) ? current.segments : [])
          .filter((s) => s && s.status === 'completed' && s.outputRel)
          .map((s) => [Number(s.startSec).toFixed(3), s]),
    );
    const segments = plan.segments.map((s) => {
      const hit = prevByStart.get(Number(s.startSec).toFixed(3));
      return hit
        ? { ...s, status: 'completed', outputRel: hit.outputRel, jobId: hit.jobId, fromCache: true }
        : { ...s, status: 'pending', outputRel: null, jobId: null, fromCache: false };
    });

    current = await emit({
      status: 'running',
      segments,
      durationSec: plan.durationSec,
      sourceHasAudio: plan.hasAudio,
      sourceWidth: plan.width,
      sourceHeight: plan.height,
      warnings,
    });

    if (plan.hasAudio) {
      warnings.push(
        '源视频带音轨 —— 切段时已自动剥除（换人任务必须无音轨，否则原声会被当作 <Audio 1> 送进条件）。',
      );
    }

    /* ---------- 阶段 2：切段（只切还没跑的段，省时间） ---------- */
    const needCut = segments.filter((s) => s.status !== 'completed');
    let cutMap = new Map();
    if (needCut.length) {
      await emit({ status: 'cutting', warnings });
      const cut = await cutSegments(sourceAbs, needCut, cfg, {
        onProgress: (p) => onProgress({ replaceId, stage: 'cutting', ...p }),
      });
      cutMap = new Map(cut.map((c) => [c.index, c]));
    }

    /* ---------- 阶段 2.5：续写链准备 ---------- */
    /**
     * 续写模式下要先建批次对象 —— 它提供 `taskFor()` 生成的
     * 「潜空间续写任务」JSON（workflow/node/group/run/index 五个字段），
     * 以及 latent 落盘目录（folder 由这四个字段的 sha256 决定）。
     *
     * ⚠️ 段 1 也必须带任务号（index=1）。
     *    南风把「读 latent」和「存 latent」都挂在同一个 `if continuation:` 下
     *    （h3_generator.py:1620/2043）。段 1 不给 → 不存 clip_1 →
     *    段 2 去 Load 直接报 "is neither a file nor a folder"。
     */
    const isContinuation = plan.mode === 'continuation';
    let contBatch = null;
    if (isContinuation) {
      const CONT = await import('./nanfeng/continuation.js');
      contBatch = CONT.createBatch({
        projectId: `replace:${replaceId}`,
        // 段数就是批次里的段数 —— createBatch 只用来生成 id 与 folder
        shotIds: segments.map((s) => `seg_${s.index}`),
        preset: task.preset ?? REPLACE_DEFAULTS.preset,
        contextLength: plan.contextLength ?? REPLACE_DEFAULTS.contextLength,
        audioContextLength: 24,
      });
      warnings.push(
        `续写链路已建立：重叠窗口 ${plan.trimFrames} 帧（${(plan.overlapSec ?? 0).toFixed(2)}s），`
        + '段间通过真实 AV latent 传递，不是靠提示词推断。',
      );
      await emit({
        status: 'running',
        segments,
        continuation: {
          batchId: contBatch.batchId,
          contextLength: contBatch.contextLength,
          contextFolder: contBatch.contextFolder,
          trimFrames: plan.trimFrames,
        },
        warnings,
      });
    }

    /* ---------- 阶段 3：逐段生成（严格串行） ---------- */
    const results = [];
    for (const seg of segments) {
      if (seg.status === 'completed' && seg.outputRel) {
        results.push({ index: seg.index, rel: seg.outputRel, fromCache: true });
        continue;
      }
      const cutSeg = cutMap.get(seg.index);
      if (!cutSeg) throw new Error(`SEGMENT_MISSING: 第 ${seg.index} 段素材缺失`);

      seg.status = 'running';
      await emit({ status: 'running', segments, warnings });

      /**
       * 续写段的任务 JSON。
       *
       * 索引必须是本段在**链条里**的序号（1-based），且段 1 也要给。
       * 同一个 replaceId 的整个批次共用 contBatch，所以 folder 一致、
       * clip_<n> 能按顺序接上。
       */
      const contTask = isContinuation && contBatch
        ? (await import('./nanfeng/continuation.js')).taskFor(contBatch, seg.index)
        : null;

      /**
       * 每段构造一张**镜头卡**。
       *
       * ⚠️ 这张卡只存在于内存里，不写 `data/shots/`，也不会出现在任何页面。
       *    它的唯一作用是把「换人任务」翻译成 `runH3Nanfeng` 认得的形状。
       *    这样换人线可以复用已验证的执行器，同时**不污染**常规渲染的数据。
       *
       * `refs.images` 的顺序就是 `<Picture N>` 的编号 —— 与提示词里
       * `buildReplacePrompt` 生成的 pictureIndex 一致，因为两边都直接用
       * 用户选择的顺序，中间没有任何"角色卡优先"的插队逻辑。
       */
      /**
       * 每段重新锚定身份 —— 续写链的**抗漂移**关键。
       *
       * ==================================================================
       * 为什么要这么做
       * ==================================================================
       *
       * 续写的 MotionContext 把上一段的 latent 作为**关键帧条件**注入
       * （`nodes.py:519-529`：每个 latent step 一个 `resolved_frame_index`
       * + latent block）。这些关键帧携带的不只是动作，还有**上一段的
       * 角色外观**。参考图和第 n-1 段的 latent 于是在同一段里竞争身份。
       *
       * 实测（12.25s / 3 段 / context=56）：
       *   段 1 → 段 2 接缝几乎无痕（身份稳定）
       *   段 2 → 段 3 **身份回退成源视频角色**（金发礼帽），参考图输了
       * 也就是污染随链条**累积**，段数越多越明显。
       *
       * ==================================================================
       * 对策：段 2 起在提示词里**显式重述身份优先于上下文**
       * ==================================================================
       *
       * 官方 skill（h3-continuation §1）明确写了这条语义：
       *   "Segment 2 onward: the actual previous latent motion and camera
       *    state take precedence over planned poses and picture poses.
       *    **Pictures retain identity, face, hair, costume**."
       * 即：动作/机位听 latent，**身份/脸/发型/服装听参考图**。
       *
       * 但模型不会自己遵守这段说明 —— 必须在每段的提示词里把它写成
       * 可执行的指令，否则 latent 会连身份一起带过去。
       *
       * 段 1 不加：它没有上一段 latent，不存在竞争，加了只是浪费注意力。
       */
      const segmentPrompt = (() => {
        const base = String(task.prompt ?? '');
        if (!isContinuation || seg.index === 1) return base;

        /**
         * 身份重述句。
         *
         * 刻意写成**英文 + 靠前**：
         *  · 英文是因为 H3 的动作描述区主要吃英文（与 skill 的六字段一致）
         *  · 靠前是因为注意力按位置衰减，放末尾等于没有
         *
         * ⚠️ **不写否定式**（"never" / "not any other person"）。
         *    skill 铁律 4：本地 CFG 固定 1.0、采样器没有 negative 分支，
         *    正文里的"不要 X"反而会把 X 拉进画面。早先的版本写了
         *    `it never supplies appearance` / `not any other person`，
         *    是在反向强调"另一个人"。现在全部改成正面陈述。
         */
        const anchor = [
          'Identity lock: every frame of this clip shows the subject from <Picture 1>',
          'with that exact face, hair, horns, costume and body shape.',
          'The carried motion supplies movement, camera and timing;',
          'appearance is rebuilt each frame from <Picture 1>.',
        ].join(' ');

        // 插在第一个空行之后（即紧跟首句总结句），保证位置靠前
        const idx = base.indexOf('\n\n');
        if (idx < 0) return `${base}\n\n${anchor}`;
        return `${base.slice(0, idx)}\n\n${anchor}${base.slice(idx)}`;
      })();

      const shot = {
        id: `replace_${replaceId}_${seg.index}`,
        title: `${task.title || '换人'} · 第 ${seg.index} 段`,
        mode: 'ref2va',
        durationSec: seg.durationSec,
        ratio: ratioOf(plan.width, plan.height),
        prompt: segmentPrompt,
        styleId: task.styleId ?? REPLACE_DEFAULTS.styleId,
        lightingId: task.lightingId ?? REPLACE_DEFAULTS.lightingId,
        accelPlan: task.accelPlan ?? REPLACE_DEFAULTS.accelPlan,
        refs: {
          images: (task.refImages ?? []).map((r) => r.rel ?? r),
          // 已切段 + 已剥音轨
          videos: [cutSeg.rel],
          audios: [],
        },
        nanfeng: {
          presets: task.preset ?? REPLACE_DEFAULTS.preset,
          overrides: buildOverrides(task, { continuation: isContinuation }),
          loras: Array.isArray(task.loras) ? task.loras : [],
        },
      };

      const job = newJob({
        projectId: null,
        shotId: null,
        backendId: 'h3-nanfeng',
        prompt: segmentPrompt,
        params: {
          replaceId,
          replaceSegment: seg.index,
          durationSec: seg.durationSec,
          ratio: shot.ratio,
          seed: Number.isFinite(Number(task.seed)) ? Number(task.seed) : 1101,
          /**
           * ⚠️ 必须把步数传下去，否则用户设了也没用。
           *
           * ==================================================================
           * 这里漏传过一次，症状是「填 25 步，实际跑 50 步」，而且完全静默
           * ==================================================================
           *
           * `buildOverrides()` 确实算出了 `采样步数: 25` 并写进
           * `nanfeng.overrides`，看起来没问题。但 `generator.js` 的取值是：
           *
           *     const wantSteps = job.params?.steps;   // ← 这里拿到 undefined
           *     const steps = Number.isFinite(Number(wantSteps))
           *       ? Number(wantSteps)
           *       : accel.steps;                       // ← 落到方案默认 50
           *
           * 也就是说 `generator` **根本不看 `shot.nanfeng.overrides.采样步数`**，
           * 它只认 `job.params.steps`。拿不到就退回加速方案的默认步数。
           *
           * 更糟的是 `checkSteps` 也没被调用（`wantSteps` 为空直接走 `{ok:true}`
           * 分支），所以连一条警告都不会有 —— 用户只会觉得「怎么这么慢」。
           *
           * 注意这里**只传用户显式给的值**：`task.steps` 为 undefined 时不写这个键，
           * 让 `generator` 正常走「用方案默认步数」的分支（那是 dmad8=8/none=50 的来源）。
           */
          ...(Number.isFinite(Number(task.steps)) ? { steps: Number(task.steps) } : {}),
        },
        mode: 'ref2va',
      });
      await jobStore().upsert(job);

      const finalJob = await runJob(job, async (running, hooks) => runH3Nanfeng({
        job: running,
        shot,
        // ⚠️ 必须用 segmentPrompt（含身份锚定句），不是 task.prompt ——
        //    runH3Nanfeng 会把 prompt 作为「提示词」参数提交，
        //    用错这里等于身份锚定从来没进过 ComfyUI。
        prompt: segmentPrompt,
        cfg,
        mode: 'ref2va',
        preset: shot.nanfeng.presets,
        extraParams: shot.nanfeng.overrides,
        continuationTask: contTask ?? undefined,
        onSubmitted: hooks?.onSubmitted,
      }));

      if (finalJob.status !== 'completed') {
        throw new Error(
          `第 ${seg.index} 段失败：${finalJob.error || finalJob.status}`,
        );
      }
      const outRel = finalJob.outputs?.[0]?.rel;
      if (!outRel) throw new Error(`第 ${seg.index} 段没有产物`);

      seg.status = 'completed';
      seg.jobId = finalJob.id;
      seg.outputRel = outRel;
      seg.warnings = finalJob.warnings ?? [];
      await emit({ status: 'running', segments, warnings });
      results.push({ index: seg.index, rel: outRel, fromCache: false });
    }

    /* ---------- 阶段 4：拼接 ---------- */
    let finalRel = null;
    let finalAbs = null;
    if (results.length === 1) {
      // 单段不需要拼接，直接引用
      finalRel = results[0].rel;
      finalAbs = resolveReplaceInput(finalRel, cfg);
    } else {
      await emit({ status: 'joining', segments, warnings });
      const absList = results
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((r) => resolveReplaceInput(r.rel, cfg));
      const joined = await concatSegments(absList, cfg);
      finalRel = joined.rel;
      finalAbs = joined.abs;
    }

    /* ---------- 阶段 5：收尾 ---------- */
    const done = await emit({
      status: 'completed',
      segments,
      finalRel,
      finalBytes: finalAbs && fs.existsSync(finalAbs) ? fs.statSync(finalAbs).size : null,
      finishedAt: Date.now(),
      error: null,
      warnings,
    });

    /**
     * 全部段完成 + 拼接完成之后才关 ComfyUI。
     *
     * 位置很重要：必须在 `emit({status:'completed'})` **之后** ——
     * 关进程会让后续任何 ComfyUI 调用失败，先落盘状态再关，
     * 用户刷新页面看到的是「已完成」而不是「卡住」。
     *
     * 失败不影响任务结果：任务已经完成了，关不掉只是显存没释放，
     * 记一条 warning 即可。
     */
    try {
      const r = await lifecycle.releaseComfy((m) => onProgress({ replaceId, note: m }));
      if (!r.stopped && !r.skipped) warnings.push(`ComfyUI 关闭失败：${r.detail}`);
    } catch (e) {
      warnings.push(`ComfyUI 关闭异常：${String(e?.message || e).slice(0, 200)}`);
    }

    return done;
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 800);
    /**
     * 失败路径**也要释放** ComfyUI。
     *
     * 否则一次失败会把 14GB 显存永久占住，用户下次点编译时
     * 翻译模型直接 OOM —— 这个连锁反应比原错误更难排查。
     */
    try {
      await lifecycle.releaseComfy(() => {});
    } catch { /* 失败路径不再叠加错误 */ }
    return emit({ status: 'failed', error: msg, finishedAt: Date.now(), warnings });
  }
}

/**
 * 把任务参数翻译成南风的 217 参数覆盖。
 *
 * ⚠️ 这里刻意**不写** `H3完整Sigma序列` / `V81一采使用手动Sigma`。
 *    实测确认（vendor/nanfeng/h3_generator.py:1687 + param-docs）：
 *    V15 把 `sigma_requested` 硬编码为 False，`sigma_enabled` 由它派生，
 *    于是三个 Sigma 策略里只有「原生轨迹」可达，手动序列**完全不生效**。
 *    钢琴那组镜头里存的这两项就是死参数 —— 复制过来只会误导排障。
 *    真正起作用的 shift 由 DMAD8 学生的训练设定给出（video 12 / audio 2），
 *    由 `generator.js` 的 accel-plan 自动写入。
 *
 * 导出以便单测：这里的每个键都曾经出现过"写错就静默跑错参数"的事故
 * （`context_length` 被预设里的 22 覆盖就是最近一次）。
 *
 * @param {object} task
 * @param {{continuation?:boolean}} [ctx]
 */
/**
 * 采样器 / 调度器 —— **必须跟随加速方案，不接受用户覆盖**。
 *
 * ============================================================================
 * 为什么这两个不能交给前端
 * ============================================================================
 *
 * 采样器是「加速方案的一部分」，不是独立可调项：
 *   dmad8 / dmad4 → `lcm`      （蒸馏学生只在 lcm 网格上训练）
 *   none          → `euler`    （原模型的标准采样器）
 *
 * 早先这里写的是 `task.sampler || d.sampler` —— 前端默认值 `lcm` 会顺带传进来，
 * 于是「选不加速 + 采样器 lcm」这个组合成立：原模型用 LCM 步进器跑 50 步。
 * 它不报错，但 LCM 是为少步数设计的，在正常步数下反而会糊、会丢细节。
 *
 * `generator.js` 的 `accelOverrides()` 之后确实会用 `accel.sampler` 再覆盖一次，
 * 但那是**靠执行顺序兜底** —— 只要有人调整参数合并顺序就会静默失效。
 * 在源头就不写错，比依赖下游补救可靠。
 */
function samplerForPlan(task, d) {
  const plan = planForShot(task.accelPlan || d.accelPlan);
  return plan.sampler || d.sampler;
}

function schedulerForPlan(task, d) {
  const plan = planForShot(task.accelPlan || d.accelPlan);
  return plan.scheduler || d.scheduler;
}

export function buildOverrides(task, ctx = {}) {
  const d = REPLACE_DEFAULTS;
  const steps = Number.isFinite(Number(task.steps)) ? Number(task.steps) : d.steps;
  const mp = Number.isFinite(Number(task.megapixels)) ? Number(task.megapixels) : d.megapixels;
  const isCont = Boolean(ctx.continuation);

  const out = {
    百万像素: mp,
    采样步数: steps,
    采样器: samplerForPlan(task, d),
    调度器: schedulerForPlan(task, d),
    降噪强度: Number.isFinite(Number(task.denoise)) ? Number(task.denoise) : d.denoise,
    /**
     * ⚠️ 续写模式**必须**关二采。
     *
     * `h3_generator.py:1323` 直接抛错：
     *   "V15 潜空间续写要求前后采样画布相同，请关闭潜空间放大二采"
     * 根因是 latent 不可缩放（MotionContext 强制比对宽高，见 docs/CONTINUATION-VS-UPSCALE.md）：
     * 二采把末 latent 放大到目标分辨率，下一段一采画布对不上，第二段必炸。
     *
     * 这里强制覆盖而不是"相信用户没勾"：二采开着跑续写必然失败，
     * 而且是在提交给 GPU 之后才失败，白等一次排队。
     */
    启用H3潜空间放大二采: isCont ? false : Boolean(task.secondPass ?? d.secondPass),
    // 真正的续写开关由 continuationTask 注入（见 nanfeng/index.js），这里只留语义标记
    启用潜空间续写: isCont || Boolean(task.continuation ?? d.continuation),
    启用实时预览: false,
  };

  /**
   * ⚠️ 续写模式的 `context_length` **必须显式写进 overrides**。
   *
   * `presets.js` 的两套续写预设都把 `context_length` 写死成 `'22'`：
   *   continuation:         context_length: '22'
   *   continuation-quality: context_length: '22'
   *
   * 而合并顺序是「预设 → 镜头 overrides → extraParams」，`extraParams` 最高。
   * 早先这里没写，于是用户选了 56（2.33s）实际跑的是 22（0.92s）——
   * 表现是**重叠窗口只有预期的 40%**，产物 136 帧而不是 102 帧，
   * 接缝比预期明显，而且没有任何报错。
   *
   * 实测佐证：设了 contextLength=56 后，段 2/3 产物仍是 158-22=136 帧，
   * 而 158-56=102 才是预期值。
   */
  if (isCont) {
    const ctx = String(task.contextLength ?? d.contextLength ?? '22');
    out.context_length = ctx;

    /**
     * 音频上下文窗口。
     *
     * 换算关系是 H3 自身的时序常数：音频 latent 跑 40 Hz，画面 24 fps，
     * 所以 1 像素帧 = 40/24 = 5/3 个音频步。context_length=56 帧
     * 只需要 round(56*5/3)=93 步。
     *
     * ⚠️ 早先这里写的是 `Number(ctx) * 4`（56→224 步），比实际需要
     *    多出 **2.4 倍**。多出来的每一步都会作为 conditioning row
     *    钉进序列、走完整 DiT，是纯浪费。而换人线在切段阶段就已
     *    剥掉音轨（`-an`），这些音频行对换人任务的价值本来就是零。
     *
     * 节点侧 audio_context_length 允许 0～240；0 表示「跟随画面窗口」，
     * 这里显式给换算后的值，避免依赖节点默认。
     */
    const audioSteps = Math.round((Number(ctx) * 40) / 24);
    out.audio_context_length = Math.min(240, Math.max(0, audioSteps));

    /**
     * 换人续写链的抗身份漂移：给上下文注入锥形噪声。
     *
     * 机制见 vendor/nanfeng/context_taper_noise.py 的模块注释与
     * docs/REPLACE-CONTINUATION.md。一句话：
     * 干净的上下文会让模型原样拷贝上一段的外观，而换人要求外观必须变 ——
     * 加噪把外观损坏掉、把运动留下来，模型只能从身份参考重新合成。
     *
     * 用户可以在页面上关掉它（`taperEnabled=false`）换更顺的接缝，
     * 代价是画面会抄上一段的长相。
     *
     * 段 1 也照样接线：它的 clip_index=0 不读文件，Motion Context 会
     * 直接透传条件（trim_frames=0），加噪节点拿到空上下文不会执行，
     * 所以接线是安全的，也让整条链的参数完全一致。
     */
    const taperOn = task.taperEnabled !== false;
    out.启用续写上下文加噪 = taperOn;
    if (taperOn) {
      out.续写加噪强度 = Number.isFinite(Number(task.taperAlpha))
        ? Number(task.taperAlpha)
        : d.taperAlpha;
      out.续写加噪末档强度 = Number.isFinite(Number(task.taperAlphaEnd))
        ? Number(task.taperAlphaEnd)
        : d.taperAlphaEnd;
      out.续写加噪斜坡步数 = Number.isFinite(Number(task.taperRampSteps))
        ? Number(task.taperRampSteps)
        : d.taperRampSteps;
    }
  }

  // 用户显式选的单项覆盖（前端"高级参数"里改的）
  if (task.overrides && typeof task.overrides === 'object') {
    for (const [k, v] of Object.entries(task.overrides)) {
      if (v === undefined || v === null) continue;
      // 续写模式下不允许用户把二采开回来
      if (isCont && k === '启用H3潜空间放大二采') continue;
      out[k] = v;
    }
  }
  return out;
}

/**
 * 由源视频分辨率推宽高比。
 *
 * H3 的 `ratio` 只认这几档，取最接近的 —— 换人是像素级复刻源构图，
 * 比例选错会让模型重构图，背景直接被重绘掉。
 */
function ratioOf(w, h) {
  const W = Number(w) || 0;
  const H = Number(h) || 0;
  if (!W || !H) return '16:9';
  const r = W / H;
  const candidates = [
    { id: '16:9', v: 16 / 9 },
    { id: '9:16', v: 9 / 16 },
    { id: '4:3', v: 4 / 3 },
    { id: '3:4', v: 3 / 4 },
    { id: '1:1', v: 1 },
    { id: '21:9', v: 21 / 9 },
  ];
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const c of candidates) {
    const diff = Math.abs(c.v - r);
    if (diff < bestDiff) { bestDiff = diff; best = c; }
  }
  return best.id;
}

export { ratioOf };
