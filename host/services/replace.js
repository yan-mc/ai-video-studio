/**
 * 角色替换（换人）—— 独立业务线，与常规渲染**完全隔离**。
 *
 * ============================================================================
 * 为什么必须独立成一条线，而不是复用 RenderPage + 镜头卡
 * ============================================================================
 *
 * 实测结论（2026-11-19 的 A/B 对照跑出来的）：
 *   常规渲染页有「角色卡」这一层，而 `resolveRefImages` 的优先级是
 *
 *       0. 角色卡（项目级 cards.json + 镜头级 cardIds）
 *       1. 人设卡 characterRefs
 *       2. **手工参考图 refs.images**
 *       3. 场景 / 道具
 *
 *   于是项目里只要绑着角色卡，用户手工挂的参考图就会被**顶到后面去**：
 *   `图片1` 被卡图占掉，用户以为的 `<Picture 1>` 实际是另一张图。
 *   换人任务对此零容忍 —— 换错人整个片子就废了，而且**不报错**。
 *   更麻烦的是这层编号是按 createdAt 排序算出来的，用户完全无法直观控制。
 *
 *   换人任务的语义本来就简单：**谁 → 换成 → 谁**。不需要角色库一致性，
 *   不需要项目、不需要镜头卡、不需要续写链。硬要塞进常规管线，
 *   就是让用户去跟一堆无关概念搏斗。
 *
 * 所以这条线：
 *   · 不读 `projects/` 和 `shots/`
 *   · 不读 `vault/`（角色卡）
 *   · 参考图**只有**用户在本页选的素材，编号 = 选择顺序，所见即所得
 *   · 参数独立成一份 `replace.json`，与 `config.json` 的渲染默认值互不影响
 *
 * ============================================================================
 * 长视频 → 多段
 * ============================================================================
 *
 * 参考视频超过 `segmentSec`（默认 10s）就自动切段，每段独立提交一次 Ref2VA。
 *
 * 为什么不走「潜空间续写」：
 *   续写靠上一段的 **AV latent** 接下文，它要求前后段画布完全一致、
 *   而且**不能用二采**（`continuation-vs-latent-upscale` 硬互斥）。
 *   换人任务的源视频本身是连续的，我们只是把它切开分别重绘，
 *   段与段之间本来就有源素材作为共同锚点，不需要 latent 链。
 *   反过来，用了续写反而会：① 锁死二采 ② 队列串行更久 ③ 段 1 必须带任务号。
 *
 * 所以这里用**独立分段 + 最后 concat**：
 *   · 每段都带同一张目标角色图、同一套提示词、同一套加速参数
 *   · 段间用 ffmpeg concat demuxer 无损拼接（`-c copy`）
 *   · 音频在整条链的最前面就剥掉（换人铁律 1），所以 concat 不需要处理音轨
 *
 * ============================================================================
 * 分段点不要落在关键帧上
 * ============================================================================
 *
 * 用 `-ss` 精确切（输入侧 seek + 重编码）而不是 `-c copy` 切：
 * `-c copy` 只能切在关键帧上，实际段长会漂移（可能 8.3s 或 11.7s），
 * 而 H3 的时长必须是 17k+5 帧网格，漂移会让「请求时长」和「素材时长」
 * 对不上，模型只能拉伸或截断。
 *
 * 因此：切段时**重编码**（crf 16 视觉无损），并且每段按时长精确切。
 *
 * @module replace
 */
import fs from 'node:fs';
import path from 'node:path';
import { runProcess, resolveFfmpeg, resolveFfprobe } from './ffmpeg-tools.js';
import { loadConfig } from '../config.js';
import { safeJoin } from '../security.js';
import { readJson, updateJson } from '../store/json-store.js';
import { probeMedia } from './media-probe.js';

/* ==========================================================================
 * 默认参数 —— 一套"开箱即用且验证过"的组合
 * ========================================================================== */

/**
 * 换人任务的默认参数。
 *
 * 取值依据（2026-11-19 A/B 实测，463s / 461s 两单）：
 *   · `dmad8` + `lcm` + `simple` + 8 步 —— 蒸馏学生与步数成套，出片稳定
 *   · `百万像素 0.6` —— 12GB 卡在二采关闭时的稳妥档
 *   · `降噪 1.0` —— 换人是整体重绘，不能留降噪余量
 *   · 二采**关闭** —— 换人已有源视频做结构锚点，二采收益低、耗时翻倍
 *   · 续写**关闭** —— 见文件头注释
 *   · `lightingId` 默认 none —— 换人 skill 铁律 3：光影 100% 继承源视频，
 *     手写光影会让背景闪烁重绘。但**用户可以在本页显式打开**（比如要改氛围），
 *     打开时走 4:1 戏剧低调（`dramatic-4-1`）。
 */
export const REPLACE_DEFAULTS = Object.freeze({
  accelPlan: 'dmad8',
  preset: 'draft',
  sampler: 'lcm',
  scheduler: 'simple',
  steps: 8,
  megapixels: 0.6,
  denoise: 1,
  secondPass: false,
  /**
   * 续写模式默认**开启**。
   *
   * 实测结论：独立重绘的段间必然跳变 —— 每段首帧都是模型自己推断的，
   * 不可能是上一段的末帧。10 秒段的**后几秒稳定性本就不好**（用户实测），
   * 段间更是硬跳。
   *
   * 续写用真实 AV latent 传状态，是唯一从机制上解决接缝的做法。
   * 代价：严格串行、必须关二采（latent 不可缩放）、单段失败后面全废。
   */
  continuation: true,
  /**
   * 续写重叠窗口。'22' = 0.92s。
   *
   * ⚠️ 早先默认是 '56'（2.33s），理由是「重叠占比越高越稳」。
   *    那个理由**只对"接缝连续性"成立，对"身份稳定性"是反的**：
   *
   *      30s/6 段时，56 帧占目标片段帧数的
   *        段 1（124 帧）：45.2%
   *        段 2-6（175 帧）：32.0%
   *      也就是说三分之一到近一半的画面，被「上一段实际生成的内容」
   *      —— 其中包含源视频角色的残留 —— 作为关键帧条件钉住。
   *      参考图只是 text-encoder 侧的软约束，压不过张量级的关键帧。
   *
   *    窗口越长 → 被钉住的上一段外观越多 → 身份漂移越重。
   *    改成 22（13.9% @158 帧）配合锥形加噪，是这个矛盾的解。
   *    想要更连续的接缝可以手动调大，但要知道代价。
   */
  contextLength: '22',
  lightingId: 'none',
  styleId: 'none',
  /**
   * 续写上下文加噪 —— 换人链路的抗身份漂移开关。
   *
   * 机制与出处见 vendor/nanfeng/context_taper_noise.py。
   * 0.45 / 0.10 / 2 是社区在 H3 换人链上实测的配方：
   * 平坦 0.45 损坏外观，最后 2 个 latent step（约 3 像素帧）降到 0.10
   * —— 因为接缝端点越干净，上一段的外观越容易被抄过去，
   * 这与「漂移常发生在段内前 5 帧」的实测现象直接对应。
   */
  taperAlpha: 0.45,
  taperAlphaEnd: 0.1,
  taperRampSteps: 2,
  /** 默认每段时长（秒）。超过这个长度就切段。 */
  segmentSec: 4,
  /** 单条参考视频的硬上限（秒）—— 超过就拒绝，避免用户误传整集 */
  maxSourceSec: 300,
  /** 分段数上限 —— 每段 8 分钟，30 段就是 4 小时，再长请先剪短 */
  maxSegments: 30,
});

/* ==========================================================================
 * 通用换人提示词模板
 * ========================================================================== */

/**
 * 占位符 → 说明。前端用它渲染「可改字段」表单并做实时预览。
 *
 * 设计原则：**只留必须改的**。原 skill 的四段式结构（总结/身份映射/分镜/防漂移）
 * 是逐字写死的，用户只需要填「原角色长什么样」「目标角色是谁」「第几张图」。
 */
export const PROMPT_FIELDS = Object.freeze([
  {
    key: 'sourceDesc',
    label: '原角色特征',
    hint: '被替换掉的那个人长什么样。写能一眼认出来的特征（发色/发型/服装/配饰），'
      + '不要写名字 —— 模型不认识名字，只认外观。',
    example: '黑发、白色猫耳、红橙紧身战斗服、戴白色骨爪臂甲',
    required: true,
  },
  {
    key: 'targetDesc',
    label: '目标角色特征',
    hint: '换成的那个人长什么样。写关键识别点，与参考图配合。',
    example: '银蓝色及腰长发、淡紫渐变发梢、两侧黑色弯曲羊角、额前银蓝小独角、淡紫眼、全身黑色连体紧身衣',
    required: true,
  },
  {
    key: 'shotBeats',
    label: '分段动作（按时间轴）',
    hint: '每行一个 [Shot N]。不写就自动用一句「完全复刻参考视频内动作」。'
      + '写了就按你写的走，建议每 2 秒一条。',
    example: '[Shot 1] 起始帧：俯视近景。她蹲坐在砂石地面上，抬头向上望。',
    required: false,
    multiline: true,
  },
]);

/**
 * 渲染换人提示词。
 *
 * 结构严格照 `h3-character-replace` skill 的四段式：
 *   1. 总结句（最高注意力）：把 A 换成 B，完全复刻动作
 *   2. 身份映射：<Subject N> = <Picture N>，<Video 1> = 源视频
 *   3. 时间轴动作
 *   4. 防漂移收尾
 *
 * **不写** `overall_soundscape` / `non_diegetic_music`（skill 铁律 2），
 * 不写否定式 Forbidden 列表（铁律 4），不写长篇光影（铁律 3）。
 *
 * 多角色：`roles` 数组里每一项生成一组 `<Subject N>` / `<Picture N>`，
 * N 从 1 开始按顺序递增，与素材选择顺序一致。
 *
 * @param {object} opts
 * @param {Array<{sourceDesc:string, targetDesc:string, pictureIndex?:number}>} opts.roles
 * @param {string} [opts.shotBeats]
 * @param {string} [opts.extraNote]  附加正向约束（用户自定义）
 * @returns {string}
 */
export function buildReplacePrompt({ roles = [], shotBeats = '', extraNote = '' } = {}) {
  const list = (Array.isArray(roles) ? roles : [])
    .map((r, i) => ({
      sourceDesc: String(r?.sourceDesc ?? '').trim(),
      targetDesc: String(r?.targetDesc ?? '').trim(),
      pictureIndex: Number.isFinite(Number(r?.pictureIndex)) ? Number(r.pictureIndex) : i + 1,
    }))
    .filter((r) => r.sourceDesc || r.targetDesc);

  if (!list.length) throw new Error('REPLACE_ROLES_REQUIRED: 至少需要一个「换成谁」');

  /* ---- 第 1 句：总结 + 映射（最高注意力，放最前） ---- */
  const swaps = list.map((r) => {
    const from = r.sourceDesc || '原角色';
    const to = r.targetDesc || '目标角色';
    return `将参考视频1视频中的${from}替换成参考图${r.pictureIndex}中的${to}`;
  });

  const head = list.length === 1
    ? `${swaps[0]}。完全复刻参考视频1内动作。`
    : `${swaps.join('；')}。完全复刻参考视频1内动作。`;

  /* ---- 第 2 句：身份绑定 ---- */
  const defs = list.map((r, i) => {
    const n = i + 1;
    const to = r.targetDesc || '目标角色';
    const from = r.sourceDesc || '原角色';
    return `<Subject ${n}> 是 <Picture ${r.pictureIndex}> 中的${to}，替换原视频中的${from}。`;
  });
  defs.push('<Video 1> 是源视频，保留其完整动作、运镜和剪辑节奏。');

  /* ---- 第 3 句：时间轴动作 ---- */
  const beats = String(shotBeats ?? '').trim();
  const beatBlock = beats
    ? beats
    : '[Shot 1] 全程完全复刻参考视频1内的动作与运镜，逐帧沿用其姿态、位置与节奏。';

  /* ---- 第 4 句：防漂移 ---- */
  const guards = list.map((r, i) => {
    const n = i + 1;
    return `全程保持 <Subject ${n}> 的身份和外观与 <Picture ${r.pictureIndex}> 完全一致。`;
  });
  guards.push('完全复刻 <Video 1> 内动作，不添加新角色。');

  const tail = guards.join('');
  const note = String(extraNote ?? '').trim();

  return [
    head,
    '',
    defs.join('\n'),
    '',
    beatBlock,
    '',
    tail,
    ...(note ? ['', note] : []),
  ].join('\n');
}

/* ==========================================================================
 * 素材与分段
 * ========================================================================== */

/** 换人任务的数据目录 */
function replaceDir(cfg = loadConfig()) {
  const d = path.join(cfg.dataDir, 'replace');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function replaceFile(cfg = loadConfig()) {
  return path.join(replaceDir(cfg), 'replace.json');
}

/**
 * 换人任务的独立存储。
 *
 * 刻意**不复用** jobs.json：换人有多段 + 批次概念，与单镜头 job 形状不同，
 * 混在一起会让 /jobs 页面和保留策略都变得含糊。这里用一个独立集合，
 * 但每一段仍然会被 job-runner 当作普通 job 执行（所以并发闸门、取消、
 * 远端 /interrupt 全部自动继承）。
 */
export function replaceStore(cfg = loadConfig()) {
  const file = replaceFile(cfg);
  return {
    file,
    listSync: () => {
      const arr = readJson(file, []);
      return Array.isArray(arr) ? arr : [];
    },
    list: async () => {
      const arr = readJson(file, []);
      return Array.isArray(arr) ? arr : [];
    },
    get: async (id) => {
      const arr = readJson(file, []);
      return (Array.isArray(arr) ? arr : []).find((x) => x && x.id === id) ?? null;
    },
    /**
     * 写一条记录，**返回写入后的那一条**。
     *
     * ⚠️ 底层 `updateJson` 返回的是**整个数组**（写入后的完整集合）。
     *    早先这里直接 `return updateJson(...)`，于是所有调用方拿到的都是数组：
     *      · `createReplaceTask` 返回给前端 → 前端 `task.id` 是一串 id 拼起来
     *        （实测："rp_xxx rp_yyy rp_zzz ..."），拿去调 `/replace/run/` 必然
     *        INVALID_ID，任务永远起不来。
     *      · `runReplaceBatch` 的 emit 同样中招 → `current.sourceRel` 变 undefined
     *        → 抛 PATH_REQUIRED。
     *    两处是同一个根因。这里统一在 store 层收口，调用方就不必各自回读。
     *
     * @param {object} item
     * @returns {Promise<object|null>} 合并后的单条记录
     */
    upsert: async (item) => {
      let written = null;
      await updateJson(file, [], (arr) => {
        const list = Array.isArray(arr) ? arr.slice() : [];
        const idx = list.findIndex((x) => x && x.id === item.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...item, updatedAt: Date.now() };
        else list.push({ ...item, createdAt: item.createdAt ?? Date.now(), updatedAt: Date.now() });
        written = list.find((x) => x && x.id === item.id) ?? null;
        return list;
      });
      return written;
    },
    remove: (id) => updateJson(file, [], (arr) => (Array.isArray(arr) ? arr : []).filter((x) => !x || x.id !== id)),
  };
}

/** 生成替换任务 id */
export function newReplaceId() {
  return `rp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 探测源视频并算分段。
 *
 * ============================================================================
 * 两种分段模式
 * ============================================================================
 *
 * **独立模式（continuation=false，默认）**
 *   每段独立冷启动。段是「源视频的时间切片」，**互不重叠**。
 *   优点：段与段无依赖，可并行思路、任意段可单独重跑。
 *   缺点：段间必然跳变 —— 每段的首帧都是模型自己推断出来的，
 *        不可能是上一段的末帧。
 *
 * **续写模式（continuation=true）**
 *   段间通过**真实 AV latent** 传递（南风 MiniMaxH3MotionContext）。
 *   段是「链条上的一环」，段 n 的开头会重放段 n-1 的末尾 `trimFrames` 帧，
 *   采完再裁掉。所以段与段之间**在时间轴上是重叠的**。
 *   优点：接缝由 latent 连续性保证，不是靠提示词祈祷。
 *   缺点：严格串行、必须关二采（latent 不可缩放）、任何一段失败后面全废。
 *
 * @param {string} abs  源视频绝对路径
 * @param {object} cfg
 * @param {object} [opts]
 * @param {number} [opts.segmentSec]        独立模式：每段时长
 * @param {number} [opts.maxSourceSec]
 * @param {number} [opts.maxSegments]
 * @param {boolean} [opts.continuation]     是否续写模式
 * @param {string} [opts.contextLength]     续写重叠窗口（'5'|'22'|'39'|'56'）
 * @param {number} [opts.segmentCount]      续写模式：期望段数（不给就按 segmentSec 估）
 * @returns {Promise<{durationSec:number, hasAudio:boolean, width:number, height:number,
 *                    segments:Array<object>, warnings:string[],
 *                    mode:'independent'|'continuation', contextLength?:string,
 *                    trimFrames?:number}>}
 */
export async function planSourceSegments(abs, cfg = loadConfig(), opts = {}) {
  const segmentSec = Number(opts.segmentSec) > 0 ? Number(opts.segmentSec) : REPLACE_DEFAULTS.segmentSec;
  const maxSourceSec = Number(opts.maxSourceSec) > 0 ? Number(opts.maxSourceSec) : REPLACE_DEFAULTS.maxSourceSec;
  const maxSegments = Number(opts.maxSegments) > 0 ? Number(opts.maxSegments) : REPLACE_DEFAULTS.maxSegments;
  const useContinuation = Boolean(opts.continuation);

  const probe = await probeMedia(abs, cfg);
  if (!probe?.ok) throw new Error('PROBE_FAILED: 无法读取源视频信息');
  const durationSec = Number(probe.durationSec) || 0;
  if (durationSec <= 0) throw new Error('SOURCE_EMPTY: 源视频时长为 0');

  const warnings = [];
  if (durationSec > maxSourceSec) {
    throw new Error(
      `SOURCE_TOO_LONG: 源视频 ${durationSec.toFixed(1)}s 超过上限 ${maxSourceSec}s。`
      + '请先剪短 —— 换人是逐段重绘，再长会跑到几个小时。',
    );
  }

  const base = {
    durationSec,
    hasAudio: Boolean(probe.hasAudio),
    width: probe.width ?? 0,
    height: probe.height ?? 0,
    fps: probe.fps ?? 0,
    warnings,
  };

  /* ---------------- 续写模式：从目标时长反推每段 ---------------- */
  if (useContinuation) {
    const CONT = (await import('../bridge/index.js')).continuation;
    const contextLength = String(opts.contextLength ?? REPLACE_DEFAULTS.contextLength);
    if (!CONT.CONTEXT_LENGTHS.includes(contextLength)) {
      throw new Error(`context_length 必须是 ${CONT.CONTEXT_LENGTHS.join('/')}，收到 ${contextLength}`);
    }
    const trimFrames = Number(contextLength);

    /**
     * 段数估算：优先用调用方给的，否则按 segmentSec 估。
     *
     * ⚠️ 续写段和独立段的时长语义不同：续写段「请求时长」包含重叠，
     *    真正新增的时长是 `deliverSec`。所以这里先用 segmentSec 估一个
     *    段数，再交给 planSegments 反推精确帧数。
     */
    const wanted = Number(opts.segmentCount) > 0
      ? Math.round(Number(opts.segmentCount))
      : Math.max(2, Math.ceil(durationSec / Math.max(1, segmentSec)));
    const n = Math.min(maxSegments, Math.max(2, wanted));

    const plan = CONT.planSegments({
      targetSeconds: durationSec,
      segments: n,
      contextLength,
      fps: 24,
      /**
       * 段 1 不裁，所以它的采样帧数就是交付帧数。
       *
       * 给它和后面几段同量级的下限（而不是叙事模式的 124 帧），
       * 否则段 1 会被拉到 6.5-8s —— 换人任务里段 1 只是链条起点，
       * 让它比别的段长一倍多反而更容易漂。
       */
      minFirstFrames: Math.max(5, Math.min(56, trimFrames - 17 > 0 ? trimFrames - 17 : 39)),
    });

    warnings.push(...plan.warnings);

    /**
     * 续写段的 `startSec` 是**源视频上的采样起点**，不是交付起点。
     *
     * 段 1 从 0 开始、不重叠；段 n 从「前面所有段的交付时长之和」开始，
     * 再往前退 `trimFrames/24` 秒作为重叠 —— 这段会被裁掉，不进入成片。
     *
     * 例（trim=56f=2.33s，段2 请求 4.46s 交付 2.13s）：
     *   段1: 源[0, 6.58) 交付 6.58s
     *   段2: 源[6.58-2.33, 6.58-2.33+4.46) = 源[4.25, 8.71) 交付 2.13s
     *        ↑ 其中 [4.25, 6.58) 是重叠，采完裁掉
     */
    const overlapSec = trimFrames / 24;
    let sourceCursor = 0;
    const segments = plan.segments.map((s, i) => {
      const startSec = i === 0
        ? 0
        : Math.max(0, Math.round((sourceCursor - overlapSec) * 1000) / 1000);
      const seg = {
        index: s.index,
        startSec,
        durationSec: s.requestSec,      // 从源里切多少（含重叠）
        requestSec: s.requestSec,
        deliverSec: s.deliverSec,       // 采完裁掉重叠后的真实交付
        sampleFrames: s.sampleFrames,
        deliverFrames: s.deliverFrames,
        overlapSec: i === 0 ? 0 : overlapSec,
      };
      // 游标按**交付**推进：重叠部分是重放的，不推进时间轴
      sourceCursor += s.deliverSec;
      return seg;
    });

    /**
     * 源视频不够长时的兜底：最后一段的采样区间可能超出源末尾。
     * 这不算错 —— 超出部分用源视频最后一帧静态延展，模型只会多采一点，
     * 裁掉重叠后交付的仍是需要的时长。但要告诉用户。
     */
    const lastNeeded = segments.length
      ? segments[segments.length - 1].startSec + segments[segments.length - 1].durationSec
      : 0;
    if (lastNeeded > durationSec + 0.05) {
      warnings.push(
        `续写链条需要源视频约 ${lastNeeded.toFixed(2)}s，实际只有 ${durationSec.toFixed(2)}s；`
        + '末尾缺的部分会用最后一帧静态延展补齐。',
      );
    }

    if (segments.length > maxSegments) {
      throw new Error(`TOO_MANY_SEGMENTS: 将切成 ${segments.length} 段，超过上限 ${maxSegments}`);
    }

    return {
      ...base,
      mode: 'continuation',
      contextLength,
      trimFrames,
      overlapSec,
      plannedTotalSec: plan.totalSec,
      segments,
    };
  }
  // 分段：最后一段可能不足 segmentSec，只要 ≥ 1s 就保留（H3 最短 5s 由调用方夹）
  const segments = [];
  let cursor = 0;
  let guard = 0;
  while (cursor < durationSec - 0.05 && guard < maxSegments + 1) {
    guard += 1;
    const remain = durationSec - cursor;
    const dur = Math.min(segmentSec, remain);
    // 剩余不足 1s 就并入上一段，避免产出 0.x 秒的碎片
    if (dur < 1 && segments.length) {
      segments[segments.length - 1].durationSec = Math.round((segments[segments.length - 1].durationSec + dur) * 1000) / 1000;
      break;
    }
    segments.push({
      index: segments.length + 1,
      startSec: Math.round(cursor * 1000) / 1000,
      durationSec: Math.round(dur * 1000) / 1000,
    });
    cursor += dur;
  }

  if (segments.length > maxSegments) {
    throw new Error(`TOO_MANY_SEGMENTS: 将切成 ${segments.length} 段，超过上限 ${maxSegments}`);
  }
  if (segments.length > 1) {
    warnings.push(
      `源视频 ${durationSec.toFixed(2)}s，按每段 ${segmentSec}s 切成 ${segments.length} 段；`
      + '每段独立重绘后按顺序无损拼接。',
    );
  }
  // 末段过短会浪费一次完整 GPU 时间（最快也要 8 分钟）
  const last = segments[segments.length - 1];
  if (segments.length > 1 && last && last.durationSec < 3) {
    warnings.push(`最后一段只有 ${last.durationSec}s —— 会用完整一次生成时间产出很短的一段。`);
  }

  return {
    ...base,
    mode: 'independent',
    segments,
  };
}

/**
 * 把源视频切成若干段（重编码，精确切点），并逐段剥音轨。
 *
 * 为什么一次做完剥音轨：换人铁律 1 要求源视频**必须没有音轨**，
 * 否则 Ref2VA 会把原声当 `<Audio 1>` 送进条件。在切段这一步顺手 `-an`
 * 比"先整片剥一次再切"少一次全片重编码。
 *
 * @returns {Promise<Array<{index:number, rel:string, abs:string, bytes:number}>>}
 */
export async function cutSegments(abs, segments, cfg = loadConfig(), { onProgress } = {}) {
  const ffmpeg = resolveFfmpeg(cfg);
  const outDir = path.join(replaceDir(cfg), 'segments');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const out = [];

  // 源视频总时长 —— 续写链条的最后一段可能要求超出末尾，需要静态延展
  let sourceDur = 0;
  try {
    const p = await probeMedia(abs, cfg);
    sourceDur = Number(p?.durationSec) || 0;
  } catch { /* 探测失败就按不延展处理 */ }

  for (const seg of segments) {
    const file = path.join(outDir, `seg_${stamp}_${String(seg.index).padStart(2, '0')}.mp4`);
    const want = Number(seg.durationSec) || 0;
    const startAt = Math.max(0, Number(seg.startSec) || 0);

    /**
     * 续写模式：链条需要的源区间可能超出源视频末尾。
     *
     * 处理方式：能切多少切多少，剩下的用**最后一帧静态延展**补齐（tpad）。
     * 为什么不用 `-stream_loop`：那会从头重放，画面会突然跳回开头。
     * 为什么不用重复末段：末段在动，延展出来的画面会抖。静帧最稳。
     *
     * 这段延展出来的内容位于**本段末尾**，而末尾正是「下一段的上下文窗口」，
     * 是链上最需要稳定的部分 —— 静帧比乱猜安全得多。
     */
    const avail = sourceDur > 0 ? Math.max(0, sourceDur - startAt) : want;
    const realDur = Math.min(want, avail);
    const padDur = Math.max(0, want - realDur);

    const args = ['-y', '-ss', String(startAt), '-i', abs];
    if (padDur > 0.02) {
      // tpad 在**滤镜链**里做：先把可切的部分取出来，再在末尾停住最后一帧
      args.push(
        '-vf', `trim=duration=${realDur.toFixed(3)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${padDur.toFixed(3)}`,
      );
    } else if (startAt + want > 0) {
      args.push('-t', String(want));
    }
    args.push(
      '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      // 换人铁律 1：源视频的音轨必须在这一步就去掉
      '-an',
      '-movflags', '+faststart',
      file,
    );
    await runProcess(ffmpeg, args, 1800000);

    const rel = path.relative(cfg.dataDir, file).replace(/\\/g, '/');
    out.push({
      index: seg.index,
      rel,
      abs: file,
      bytes: fs.statSync(file).size,
      ...(padDur > 0.02 ? { paddedSec: Math.round(padDur * 1000) / 1000 } : {}),
    });
    if (typeof onProgress === 'function') {
      onProgress({ done: out.length, total: segments.length, index: seg.index });
    }
  }
  return out;
}

/**
 * 无损拼接（concat demuxer）。
 *
 * 前提：所有段必须同编码/同分辨率/同帧率 —— 我们自己在 cutSegments 里
 * 统一用 libx264 crf16 yuv420p，且全部来自同一个源，所以成立。
 * 全部**无音轨**，所以不需要处理 audio 流映射。
 */
export async function concatSegments(segmentAbsPaths, cfg = loadConfig(), outFile = null) {
  const ffmpeg = resolveFfmpeg(cfg);
  const listFile = path.join(replaceDir(cfg), `concat_${Date.now().toString(36)}.txt`);
  // concat demuxer 的路径语法：单引号包裹，内部单引号写成 '\''
  const body = segmentAbsPaths
    .map((p) => `file '${String(p).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listFile, body + '\n', 'utf8');

  const target = outFile ?? path.join(replaceDir(cfg), `joined_${Date.now().toString(36)}.mp4`);
  try {
    await runProcess(ffmpeg, [
      '-y',
      '-f', 'concat', '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      target,
    ], 1800000);
  } finally {
    try { fs.rmSync(listFile, { force: true }); } catch { /* ignore */ }
  }
  return {
    ok: true,
    abs: target,
    rel: path.relative(cfg.dataDir, target).replace(/\\/g, '/'),
    bytes: fs.statSync(target).size,
  };
}

/**
 * 把用户给的 rel（dataDir 相对）解析成绝对路径，并强制落在 dataDir 内。
 */
export function resolveReplaceInput(rel, cfg = loadConfig(), mustExist = true) {
  const s = String(rel ?? '').trim();
  if (!s) throw new Error('PATH_REQUIRED');
  const abs = safeJoin(cfg.dataDir, s);
  if (mustExist && !fs.existsSync(abs)) throw new Error(`FILE_NOT_FOUND: ${s}`);
  return abs;
}
