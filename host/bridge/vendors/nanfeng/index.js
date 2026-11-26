/**
 * 南风桥接层 —— 对外门面。
 *
 * 把南风 V15 的 221 个参数、图组装、预设、续写编排统一收口，
 * 让上层（generator.js / api / tools）只需要面对「镜头卡」这一个人话概念。
 *
 * @module nanfeng
 */
export {
  PARAMS,
  GROUPS,
  PARAM_COUNT,
  paramsOfGroup,
  defaults,
  enrichSchema,
  inertParams,
} from './schema.js';

export {
  NANFENG_NODE,
  NANFENG_OUTPUT,
  buildWorkflow,
  sanitize,
  applyFixes,
  splitSecondPassSteps,
  coerceTypes,
  coerceTypesVerbose,
  coerceIssues,
  modeFlags,
  continuationTask,
  mergeParams,
  mergeParamsVerbose,
  fetchAvailableNodes,
  probeAvailableNodes,
  resetNodeCache,
} from './graph.js';

export {
  BUILTIN_PRESETS,
  DEFAULT_PRESET,
  builtinPreset,
  listBuiltinPresets,
  parsePresetSpec,
  resolvePresetLayers,
} from './presets.js';

export * as continuation from './continuation.js';

import { normalizeMode } from '../../../store/models.js';
import {
  buildWorkflow, mergeParamsVerbose, applyFixes, probeAvailableNodes,
} from './graph.js';
import { resolvePresetLayers, validateSigmaSequence } from './presets.js';

/**
 * 从镜头卡组装一次生成的完整 workflow。
 *
 * 这是**上层唯一需要调的入口**。它负责：
 *   1. 从镜头卡读出素材/走位/提示词
 *   2. 套预设 + 覆盖（未知键进 warnings，不静默丢弃）
 *   3. 套模式开关
 *   4. 修正环境必炸项
 *   5. 组装成 ComfyUI 可提交的 JSON
 *
 * @param {object} opts
 * @param {object} opts.shot 镜头卡
 * @param {'ref2va'|'t2va'|'i2va'|'fl2va'} [opts.mode] 覆盖镜头卡的 mode
 * @param {string|object} [opts.preset] 预设 id 或 { inherit, overrides }
 * @param {Record<string, unknown>} [opts.projectPreset] 项目级预设参数
 * @param {Record<string, unknown>} [opts.extraParams] 额外参数覆盖
 * @param {string} [opts.jobId]
 * @param {string} [opts.continuationTask] 续写任务 JSON
 * @param {number} [opts.frameRate]
 * @param {boolean} [opts.saveVideo]
 * @param {Set<string>|null} [opts.availableNodes]
 * @returns {{
 *   workflow: object,
 *   params: Record<string, unknown>,
 *   warnings: string[],
 *   presetIds: string[],
 * }}
 */
export function buildShotWorkflow({
  shot = {},
  mode,
  preset,
  projectPreset,
  extraParams,
  jobId = 'jz',
  continuationTask: contTask,
  frameRate = 24,
  saveVideo = true,
  /** ComfyUI 当前注册的节点名集合（能力探测用）。null = 不探测。 */
  availableNodes = null,
  /** 能力探测失败原因（不可达）。传了就把降级事实写进 warnings。 */
  probeDegraded = false,
  probeReason = '',
} = {}) {
  const warnings = [];

  // ---------- 1) 解析预设链 ----------
  //
  // 优先级（低 → 高）：
  //   schema 默认 → 内置预设 → 项目预设 → 镜头卡 nanfeng.overrides
  //   → buildShotOverrides（模式/时长/素材）→ extraParams（调用方显式）
  const shotSpec = preset ?? shot?.nanfeng?.presets ?? shot?.nanfeng?.preset;
  const shotOverrides =
    shot?.nanfeng?.overrides && typeof shot.nanfeng.overrides === 'object'
      ? shot.nanfeng.overrides
      : {};

  const { layers, meta } = resolvePresetLayers({
    shotSpec,
    projectPreset,
    // 把 extraParams 里的模式开关也传进去 —— 它们代表调用方的显式选择
    extra: { ...shotOverrides, ...buildShotOverrides(shot, mode, extraParams) },
  });

  // ---------- 2) 合并出参数快照 ----------
  const merged = mergeParamsVerbose(layers);
  let params = merged.params;
  if (merged.unknownKeys.length) {
    const names = [...new Set(merged.unknownKeys.map((u) => u.key))];
    warnings.push(
      `以下参数名不在南风 221 参数表里，已被忽略（请检查拼写）：${names.join('、')}。`
      + '它们不会进入 job.params，也不会影响出片。',
    );
  }

  // ---------- 3) 额外覆盖（最高优先级） ----------
  if (extraParams && typeof extraParams === 'object') {
    const unknown = [];
    for (const [k, v] of Object.entries(extraParams)) {
      if (k in params) params[k] = v;
      else unknown.push(k);
    }
    if (unknown.length) {
      warnings.push(
        `extraParams 里以下键不是南风参数，已被忽略：${unknown.join('、')}`,
      );
    }
  }

  // ---------- 4) 续写任务 ----------
  /**
   * 续写任务 —— **段 1 也必须给**。
   *
   * 南风把「读 latent」和「保存 latent」都挂在同一个 `if continuation:` 下，
   * 段 1 不给任务 → 不保存 latent → 段 2 Load clip_1 直接报
   * "is neither a file nor a folder"。官方设计就是首段 Load 0 / Save 1
   * （"Load 0 does not read a file… Do not mute it."）。
   */
  if (contTask) {
    params['启用潜空间续写'] = true;
    params['潜空间续写任务'] = contTask;
  } else if (params['启用潜空间续写'] === true) {
    /**
     * 开了续写但没有任务 JSON → 当作**单镜头渲染**，降级关闭并大声告知。
     *
     * 走到这个分支就意味着调用方没给 contTask，无法区分"批次传参丢了"
     * 和"用户就是想单独渲染这个镜头"；但项目里每个续写镜头都挂着
     * `continuation` 预设，抛错会让渲染页点「开始渲染」必然失败。
     * 所以关掉续写（本段从冷启动生成）并明确告知差异。
     * 批次真正的传参丢失由编排层负责（continuation.taskFor 一定产出合法 JSON）。
     */
    params['启用潜空间续写'] = false;
    params['潜空间续写任务'] = '';
    warnings.push(
      '该镜头的预设是「续写段」，但本次是**单镜头渲染**，没有上一段的 AV latent。'
      + '已自动关闭潜空间续写，本段将作为独立片段从冷启动生成 —— '
      + '画面不会与上一段无缝衔接。'
      + '要得到连续效果，请用「续写批次」面板按顺序提交整组镜头。',
    );
  }

  // ---------- 4.5) 硬互斥约束校验（在浪费 GPU 之前就失败） ----------
  //
  // 这些组合进了 ComfyUI 才会抛 ValueError，错误信息是
  // "COMFY_EXEC_ERROR @NanFengH3..."，用户看不出是哪两个参数冲突。
  const violations = checkConstraints(params);
  if (violations.length) {
    const err = new Error(`NANFENG_CONSTRAINT: ${violations.map((v) => v.message).join(' / ')}`);
    err.code = 'NANFENG_CONSTRAINT';
    err.violations = violations;
    throw err;
  }

  // ---------- 4.6) Sigma 序列校验（生产链路唯一调用点） ----------
  //
  // 格式错本来只能等 vendor 的 `_parse_manual_sigmas` 在**展开图时**抛错 ——
  // 那时 GPU 已经排上队了。这里提前校验并提供可读的错误。
  const sigmaChecks = checkSigmaSequences(params);
  if (sigmaChecks.errors.length) {
    const err = new Error(`NANFENG_CONSTRAINT: ${sigmaChecks.errors.join(' / ')}`);
    err.code = 'NANFENG_CONSTRAINT';
    err.violations = sigmaChecks.errors.map((message) => ({ id: 'sigma-sequence', message, keys: [] }));
    throw err;
  }
  if (sigmaChecks.warnings.length) warnings.push(...sigmaChecks.warnings);

  // ---------- 5) 能力探测（区分"不可达"与"节点缺失"） ----------
  let nodes = availableNodes;
  let degraded = probeDegraded;
  let degradedReason = probeReason;
  if (!nodes && !degraded) {
    // 调用方没传就自己探一次（同步入口不能 await，这里只做缓存命中查询）
    nodes = null;
  }

  // ---------- 6) 环境修正 ----------
  //
  // explicit 的语义：这些键是调用方**明确选择**的，环境修正不能覆盖它们。
  const explicit = new Set([
    ...Object.keys(extraParams ?? {}),
    ...Object.keys(shotOverrides ?? {}),
  ]);
  const { snapshot, applied } = applyFixes(params, explicit, nodes);
  params = snapshot;
  if (applied.length) warnings.push(...applied);

  // ---------- 7) 组装 workflow ----------
  const built = buildWorkflow({
    params, jobId, frameRate, saveVideo,
    // 环境修正已经在上面做过一次。把所有键声明为 explicit，
    // 让 buildWorkflow 不再重复修正（否则同一理由会出现两条 warning）。
    explicitKeys: new Set(Object.keys(params)),
    availableNodes: nodes,
    probeDegraded: degraded,
    probeReason: degradedReason,
  });
  warnings.push(...built.warnings);

  return {
    workflow: built.workflow,
    params,
    warnings,
    presetIds: meta.presetIds,
  };
}

/**
 * 异步版本：自己完成能力探测，并把降级事实写进 warnings。
 *
 * 上层（generator.js）应当用这个入口，这样"ComfyUI 不可达"不会再被
 * 一个 `catch {}` 吞掉，也不会让动态修正静默全部跳过。
 *
 * @returns {Promise<ReturnType<typeof buildShotWorkflow>>}
 */
export async function buildShotWorkflowAsync(opts = {}) {
  const { cfg, resolveUrl } = opts;
  let availableNodes = null;
  let probeDegraded = false;
  let probeReason = '';
  if (cfg && typeof resolveUrl === 'function') {
    const probe = await probeAvailableNodes(cfg, resolveUrl);
    availableNodes = probe.set;
    probeDegraded = !probe.reachable;
    probeReason = probe.reason;
  }
  return buildShotWorkflow({ ...opts, availableNodes, probeDegraded, probeReason });
}

/**
 * 从「三件套开关」反推模式。
 *
 * 调用方传 `extraParams: { 图生视频: true }` 时，意图是"选 i2va"，
 * 而不是"在已有模式上追加一个开关"。
 */
function modeFromFlags(flags) {
  if (!flags || typeof flags !== 'object') return null;
  if (flags['图生视频'] === true) return 'i2va';
  if (flags['首尾帧'] === true) return 'fl2va';
  if (flags['文生视频'] === true) return 't2va';
  return null;
}

/**
 * 把镜头卡的通用字段翻译成南风参数覆盖。
 *
 * 这是「我们的数据模型」与「南风参数」之间的唯一映射点。
 *
 * 模式的三层优先级（高 → 低）：
 *   ① `extraParams` 里的三件套开关（调用方显式点了某个模式）
 *   ② `modeOverride`（调用方传了模式名）
 *   ③ 镜头卡 `shot.mode` 归一（兜底：有图 ref2va / 无图 t2va）
 *
 * @param {object} shot
 * @param {string} [modeOverride]
 * @returns {Record<string, unknown>}
 */
export function buildShotOverrides(shot = {}, modeOverride, explicitFlags = null) {
  const out = {};

  // normalizeMode 的兜底规则是「有图 → ref2va，无图 → t2va」，必须传 hasRefImages，
  // 否则一个完全没有参考图的镜头会被套上 Ref2VA 的三件套开关。
  const hasRefImages = (shot.refs?.images?.length ?? 0) > 0;
  const explicitMode = modeFromFlags(explicitFlags);
  const mode = explicitMode ?? modeOverride ?? normalizeMode(shot.mode, { hasRefImages });

  // 三件套**必须总是写出去**（且互斥）—— 只写一半会让预设里的默认 true 残留，
  // 于是两个开关同时为真，触发"三选一不能同时开启"。
  Object.assign(out, {
    文生视频: mode === 't2va',
    图生视频: mode === 'i2va',
    首尾帧: mode === 'fl2va',
  });

  // ---- 时长 ----
  if (shot.durationSec != null) out['时长秒'] = Number(shot.durationSec);

  // ---- 提示词 ----
  if (shot.prompt) out['提示词'] = String(shot.prompt);

  // ---- 种子 ----
  if (shot.seed != null && Number.isFinite(Number(shot.seed))) {
    out['随机种子'] = Number(shot.seed);
  }

  // ---- 参考图（最多 9）----
  const images = Array.isArray(shot.refs?.images) ? shot.refs.images : [];
  images.slice(0, 9).forEach((rel, i) => {
    out[`图片${i + 1}`] = toComfyFileName(rel);
  });

  // ---- 参考视频（最多 3）----
  const videos = Array.isArray(shot.refs?.videos) ? shot.refs.videos : [];
  videos.slice(0, 3).forEach((v, i) => {
    out[`视频${i + 1}`] = toComfyFileName(v?.rel ?? v);
  });

  // ---- 参考音频（最多 3）----
  const audios = Array.isArray(shot.refs?.audios) ? shot.refs.audios : [];
  audios.slice(0, 3).forEach((a, i) => {
    out[`音频${i + 1}`] = toComfyFileName(a?.rel ?? a);
  });

  return out;
}

/**
 * 把 dataDir 相对路径转成 ComfyUI `input/` 内的文件名。
 *
 * 南风的素材槽位接受的是 **ComfyUI input 目录内的文件名**，不是绝对路径
 * 也不是 dataDir 相对路径；这里只做 basename 提取，真正的 stage 由
 * comfy-client.stageToComfyInput 做。
 *
 * 空值返回 `'未选择'` —— 这是保位用的哨兵（槽位按下标写，不能压缩）。
 */
export function toComfyFileName(rel) {
  const s = String(rel ?? '').trim();
  if (!s) return '未选择';
  const base = s.replace(/\\/g, '/').split('/').pop() ?? s;
  return base || '未选择';
}

/** 槽位是否"真的填了东西"（'未选择' 是保位哨兵，不算素材） */
function slotFilled(v) {
  return Boolean(v) && String(v) !== '未选择';
}

/** 某个槽位族的**内容序列**（保留空位，用于连续性检查） */
function slotSequence(p, label, max) {
  const out = [];
  for (let i = 1; i <= max; i += 1) out.push({ index: i, value: p[`${label}${i}`], filled: slotFilled(p[`${label}${i}`]) });
  return out;
}

/** 第一个填充槽位**之后**是否还有空位（前缀留空不算跳号） */
function gapsAfterFirstFill(seq) {
  let seenGap = false;
  for (const s of seq) {
    if (!s.filled) seenGap = true;
    else if (seenGap) return true;
  }
  return false;
}

/** 数一数实际填了内容的图片槽位 */
function countImages(p) {
  let n = 0;
  for (let i = 1; i <= 9; i += 1) {
    if (slotFilled(p[`图片${i}`])) n += 1;
  }
  return n;
}

/**
 * 南风 V15 的硬互斥约束 —— 与 vendor `raise ValueError` 清单逐条对齐。
 *
 * 这些组合在 ComfyUI 执行器内部才会抛错，且错误是
 * "COMFY_EXEC_ERROR @NanFengH3..." 这种形式 —— 用户看不出是哪两个参数冲突，
 * GPU 排队也已经白费。所以必须在组装期拦下。
 *
 * 每一条都标注 vendor 位置（vendor/nanfeng/h3_generator.py），改动前请回去核对。
 */
export const CONSTRAINT_RULES = Object.freeze([
  {
    id: 'continuation-vs-latent-upscale',
    // h3_generator.py:1339-1340
    when: (p) => p['启用潜空间续写'] === true && p['启用H3潜空间放大二采'] === true,
    message: '潜空间续写与「H3潜空间放大二采」互斥：续写要求前后采样画布一致，'
      + '请关闭其中一项。想做高清续写，请提高「百万像素」而不是开二采。',
    keys: ['启用潜空间续写', '启用H3潜空间放大二采'],
  },
  {
    id: 'continuation-vs-audio-lock',
    // h3_generator.py:1335-1338
    when: (p) => p['启用潜空间续写'] === true
      && (p['启用锁音频'] === true || p['开启音频驱动模式'] === true || p['空5分钟时间轴模式'] === true),
    message: '潜空间续写不能与「锁音频 / 音频驱动 / 空5分钟时间轴模式」同时开启'
      + '（重叠裁切会破坏原音轨时间）。',
    keys: ['启用潜空间续写', '启用锁音频', '开启音频驱动模式', '空5分钟时间轴模式'],
  },
  {
    id: 'mode-exclusive',
    // h3_generator.py:1377-1378 —— 三个模式开关只能有一个为真
    when: (p) => [p['文生视频'], p['图生视频'], p['首尾帧']].filter(Boolean).length > 1,
    message: '「文生视频 / 图生视频 / 首尾帧」三选一，不能同时开启。',
    keys: ['文生视频', '图生视频', '首尾帧'],
  },
  {
    id: 'audio-drive-needs-lock',
    // h3_generator.py:1366-1368 —— 音频驱动必须同时锁音频
    when: (p) => p['开启音频驱动模式'] === true
      && p['空5分钟时间轴模式'] !== true
      && p['启用锁音频'] !== true,
    message: '开启「音频驱动模式」时必须同时开启「启用锁音频」，'
      + '否则驱动用的音频不会被锁进输出音轨。',
    keys: ['开启音频驱动模式', '启用锁音频'],
  },
  {
    id: 'tl2va-needs-two-images',
    // h3_generator.py:1397-1398 —— 首尾帧必须恰好 2 张图
    when: (p) => p['首尾帧'] === true && countImages(p) !== 2,
    message: '「首尾帧」模式必须恰好提供 2 张图片：图片1 = 首帧、图片2 = 尾帧。',
    keys: ['首尾帧', '图片1', '图片2'],
  },
  {
    id: 'i2va-needs-one-image',
    // h3_generator.py:1395-1396 —— 图生视频必须恰好 1 张图
    when: (p) => p['图生视频'] === true && countImages(p) !== 1,
    message: '「图生视频」模式必须恰好提供 1 张图片（图片1 = 首帧）。'
      + '请减少参考图，或改用 Ref2VA 模式。',
    keys: ['图生视频', '图片1'],
  },
  {
    id: 't2va-rejects-images',
    // h3_generator.py:1393-1394 —— 文生视频不能带图
    when: (p) => p['文生视频'] === true && countImages(p) > 0,
    message: '「文生视频」模式不接受任何参考图，请清空 图片1..9 或改用 Ref2VA。',
    keys: ['文生视频'],
  },
  {
    id: 'frame-modes-reject-video-audio',
    // h3_generator.py:1389-1390 —— 图生/首尾帧不接受视频与音频参考
    when: (p) => (p['图生视频'] === true || p['首尾帧'] === true)
      && ([1, 2, 3].some((i) => slotFilled(p[`视频${i}`]))
        || [1, 2, 3].some((i) => slotFilled(p[`音频${i}`]))),
    message: '「图生视频 / 首尾帧」模式不接受视频或音频参考，请清空对应素材。',
    keys: ['图生视频', '首尾帧', '视频1', '音频1'],
  },
  {
    /**
     * 槽位连续性 —— 图片按"保位语义"、视频/音频按"严格连续"分别判定。
     *
     * vendor 对三类槽位都要求"从 1 连续、不能跳号"
     * （h3_generator.py:1381-1387）。但插件内两族的真实语义不同：
     *   · **图片槽位**：planImageSlots 会把首/尾帧写进 图片1/图片2 并**保位**，
     *     于是参考图可能从 图片3 起（前缀留空）。前缀留空是**合法**的。
     *     但图片族中间出现空位仍然是跳号 —— 那是 staging 漏了一张。
     *   · **视频/音频槽位**：没有任何保位场景，第一个填的位置必须是 1，
     *     中间也不能有空 —— 空串就是上传失败或漏填，vendor 会直接抛错。
     */
    id: 'slots-must-be-contiguous',
    when: (p) => {
      // 图片：允许**前缀留空**（planImageSlots 把图片1/2 留给首尾帧，属保位）
      if (gapsAfterFirstFill(slotSequence(p, '图片', 9))) return true;
      // 视频/音频：没有任何保位场景，第一个填的位置必须是 1，且中间不能有空
      for (const label of ['视频', '音频']) {
        const seq = slotSequence(p, label, 3);
        const firstFilled = seq.find((s) => s.filled);
        if (!firstFilled) continue;
        if (firstFilled.index !== 1) return true;
        if (gapsAfterFirstFill(seq)) return true;
      }
      return false;
    },
    message: (p) => reportGaps(p),
    keys: ['图片1', '图片2', '视频1', '视频2', '视频3', '音频1', '音频2', '音频3'],
  },
  {
    id: 'ref2va-needs-one-reference',
    // h3_generator.py:1399-1401 —— 全参考模式至少要有一张图/一段视频/一段音频
    when: (p) => p['文生视频'] !== true && p['图生视频'] !== true && p['首尾帧'] !== true
      && countImages(p) === 0
      && !slotFilled(p['视频1']) && !slotFilled(p['视频2']) && !slotFilled(p['视频3'])
      && !slotFilled(p['音频1']) && !slotFilled(p['音频2']) && !slotFilled(p['音频3'])
      && !slotFilled(p['音频驱动文件']),
    message: 'Ref2VA（全参考）模式至少要拖入一张图片、一段视频或一段音频 —— '
      + '当前三个素材族全空，上游会直接拒绝。纯文本请改用文生视频模式。',
    keys: ['图片1', '视频1', '音频1'],
  },
  {
    id: 'audio-drive-needs-file',
    // h3_generator.py:1374-1375 —— 音频驱动必须给驱动文件
    when: (p) => p['开启音频驱动模式'] === true
      && p['空5分钟时间轴模式'] !== true
      && !slotFilled(p['音频驱动文件']),
    message: '「音频驱动模式」已开启，但没有提供「音频驱动文件」—— '
      + '上游会抛"没有可用于锁定的音频驱动文件"。',
    keys: ['开启音频驱动模式', '音频驱动文件'],
  },
  {
    id: 'audio-lock-only-ref2va',
    // h3_generator.py:1402-1403 —— 锁音频只适用全参考模式
    when: (p) => p['启用锁音频'] === true
      && (p['文生视频'] === true || p['图生视频'] === true || p['首尾帧'] === true),
    message: '「锁音频」只适用于多参 Ref2VA 模式；文生、图生和首尾帧模式不接受音频输入。',
    keys: ['启用锁音频', '文生视频', '图生视频', '首尾帧'],
  },
  {
    id: 'audio-lock-needs-audio1',
    // h3_generator.py:1404-1405 —— 锁音频必须给音频1
    when: (p) => p['启用锁音频'] === true
      && !slotFilled(p['开启音频驱动模式'] === true ? p['音频驱动文件'] : p['音频1']),
    message: '开启「锁音频」后必须提供要锁定的完整源音轨（音频1，或音频驱动模式下的专属音频）。',
    keys: ['启用锁音频', '音频1', '音频驱动文件'],
  },
  {
    id: 'audio-lock-only-audio1',
    // h3_generator.py:1406-1407 —— 普通锁音频只能有音频1
    when: (p) => p['启用锁音频'] === true
      && p['开启音频驱动模式'] !== true
      && (slotFilled(p['音频2']) || slotFilled(p['音频3'])),
    message: '普通锁音频模式只锁定音频1；请清空音频2和音频3，避免最终音轨含义不明确。',
    keys: ['启用锁音频', '音频2', '音频3'],
  },
  {
    id: 'original-ratio-only-frame-modes',
    // h3_generator.py:1408-1410 —— 原图比例只适用图生/首尾帧
    when: (p) => String(p['画面比例'] ?? '') === '原图比例'
      && p['图生视频'] !== true && p['首尾帧'] !== true,
    message: '「原图比例」只适用于图生视频或首尾帧模式；当前模式会按其它比例档位采样。',
    keys: ['画面比例', '图生视频', '首尾帧'],
  },
]);

/** 生成槽位跳号的可读说明（供一条规则复用） */
export function reportGaps(params) {
  const parts = [];
  const check = (label, max, allowPrefixGap) => {
    const seq = slotSequence(params ?? {}, label, max);
    const firstFilled = seq.find((s) => s.filled);
    if (!firstFilled) return;
    if (!allowPrefixGap && firstFilled.index !== 1) {
      parts.push(`${label}槽位从 ${label}${firstFilled.index} 开始（前面有空位）`);
      return;
    }
    let seenGap = false;
    const bad = [];
    for (const s of seq) {
      if (!s.filled) seenGap = true;
      else if (seenGap) bad.push(`${label}${s.index}`);
    }
    if (bad.length) parts.push(`${label}槽位跳号（${bad.join('、')} 之前有空位）`);
  };
  // 图片允许前缀留空（首/尾帧保位），但中间不能跳
  check('图片', 9, true);
  check('视频', 3, false);
  check('音频', 3, false);

  if (!parts.length) return '槽位必须从 1 开始连续添加，不能跳号。';
  return `${parts.join('；')}。上游要求槽位连续、不能跳号 —— `
    + '请重新按顺序填满，或删掉后面的素材（空槽不能留在中间）。';
}

/**
 * Sigma 序列校验 —— 生产链路唯一调用点。
 *
 * 两个字段会被 vendor 消费：
 *   · `H3完整Sigma序列`（开二采，或一采显式使用手动序列时）
 *   · `V81一采使用手动Sigma` 决定"不开二采时是否用完整序列"
 * 两者格式错都会在**展开图时**才抛错（`_parse_manual_sigmas`），
 * 而那时 GPU 已经排队。这里提前拦。
 *
 * @param {Record<string, unknown>} params
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkSigmaSequences(params) {
  const errors = [];
  const warnings = [];
  const latentUpscale = params['启用H3潜空间放大二采'] === true;
  const first = Number(params['H3一采步数'] ?? 6);
  const second = Number(params['H3二采步数'] ?? 4);

  const full = String(params['H3完整Sigma序列'] ?? '').trim();
  if (full) {
    const singlePass = !latentUpscale && params['V81一采使用手动Sigma'] === true;
    if (latentUpscale || singlePass) {
      const r = validateSigmaSequence(full, { latentUpscale, firstSteps: first, secondSteps: second });
      if (!r.ok) {
        errors.push(`「H3完整Sigma序列」不合法：${r.errors.join('；')}`);
      }
    } else {
      warnings.push(
        '「H3完整Sigma序列」已填写，但既没开「H3潜空间放大二采」也没开「V81一采使用手动Sigma」—— '
        + '上游不会读它，序列不会生效。',
      );
    }
  } else if (latentUpscale) {
    // 留空 = 自动轨迹，这是合法且推荐的做法，不必提示
  }

  // H3二采Sigma 只在开二采时被读（vendor: _build_h3_four_step_refine_sigmas）
  if (latentUpscale) {
    const two = String(params['H3二采Sigma'] ?? '').trim();
    if (two) {
      const r = validateSigmaSequence(two, {});
      if (!r.ok) errors.push(`「H3二采Sigma」不合法：${r.errors.join('；')}`);
    }
  }

  // 步数本身必须为正（拆分/校验的共同前提）
  if (latentUpscale && (!(first > 0) || !(second > 0))) {
    errors.push(`开二采时一采/二采步数必须为正数（当前 ${first} / ${second}）`);
  }

  return { errors, warnings };
}

/**
 * 检查参数快照是否违反南风的硬约束。
 *
 * 规则里的 `message` 可以是字符串或函数（需要现场生成说明时用函数）。
 *
 * @param {Record<string, unknown>} params
 * @returns {Array<{ id: string, message: string, keys: string[] }>} 违规列表
 */
export function checkConstraints(params) {
  const out = [];
  for (const rule of CONSTRAINT_RULES) {
    try {
      if (!rule.when(params)) continue;
      const message = typeof rule.message === 'function' ? rule.message(params) : rule.message;
      out.push({ id: rule.id, message, keys: rule.keys });
    } catch { /* 单条规则异常不影响其它 */ }
  }
  return out;
}