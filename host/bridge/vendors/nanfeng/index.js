/**
 * 南风桥接层 —— 对外门面。
 *
 * 这个模块把南风 V15 的 221 个参数、图组装、预设、续写编排统一收口，
 * 让上层（generator.js / api / tools）只需要面对「镜头卡」这一个人话概念。
 *
 * ============================================================================
 * 典型用法
 * ============================================================================
 *
 *   import * as nanfeng from './index.js';
 *
 *   // 1) 单镜生成
 *   const { workflow, params, warnings } = nanfeng.buildShotWorkflow({
 *     shot,              // 镜头卡
 *     mode: 'ref2va',    // 生成模式
 *     preset: 'quality', // 预设
 *     jobId: 'abc',
 *   });
 *   await comfy.submit(workflow);
 *
 *   // 2) 续写批次
 *   const batch = nanfeng.continuation.createBatch({ projectId, shotIds });
 *   for (const seg of batch.shots) {
 *     const task = nanfeng.continuation.taskFor(batch, seg.index);
 *     const wf = nanfeng.buildShotWorkflow({ shot, preset: 'continuation', continuationTask: task, jobId });
 *     ...
 *   }
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
  modeFlags,
  continuationTask,
  mergeParams,
  fetchAvailableNodes,
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
import { buildWorkflow, mergeParams, modeFlags, applyFixes } from './graph.js';
import { resolvePresetLayers } from './presets.js';

/**
 * 从镜头卡组装一次生成的完整 workflow。
 *
 * 这是**上层唯一需要调的入口**。它负责：
 *   1. 从镜头卡读出素材/走位/提示词
 *   2. 套预设 + 覆盖
 *   3. 套模式开关
 *   4. 修正环境必炸项（SageAttention）
 *   5. 组装成 ComfyUI 可提交的 JSON
 *
 * @param {object} opts
 * @param {object} opts.shot            镜头卡
 * @param {'ref2va'|'t2va'|'i2va'|'fl2va'} [opts.mode]  覆盖镜头卡的 mode
 * @param {string|object} [opts.preset] 预设 id 或 { inherit, overrides }
 * @param {Record<string, unknown>} [opts.projectPreset] 项目级预设参数
 * @param {Record<string, unknown>} [opts.extraParams]   额外参数覆盖
 * @param {string} [opts.jobId]
 * @param {string} [opts.continuationTask]  续写任务 JSON
 * @param {number} [opts.frameRate]
 * @param {boolean} [opts.saveVideo]
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
} = {}) {
  const warnings = [];

  // ---------- 1) 解析预设链 ----------
  //
  // 优先级（低 → 高）：
  //   schema 默认 → 内置预设 → 项目预设 → 镜头卡 nanfeng.overrides
  //   → buildShotOverrides（模式/时长/素材）→ extraParams（调用方显式）
  //
  // ⚠️ 镜头卡的 `nanfeng.overrides` 必须在这里合并。历史缺陷：
  //    只合了 extraParams，导致用户在网页上改的单项参数被预设覆盖，
  //    「改了什么」在 UI 上显示着、实际提交却没生效。
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
  let params = mergeParams(...layers);

  // ---------- 3) 额外覆盖（最高优先级） ----------
  if (extraParams && typeof extraParams === 'object') {
    for (const [k, v] of Object.entries(extraParams)) {
      if (k in params) params[k] = v;
    }
  }

  // ---------- 4) 续写任务 ----------
  /**
   * 续写任务 —— **段 1 也必须给**（这是最关键的一点）
   *
   * ============================================================================
   * 为什么段 1 也要 continuationTask
   * ============================================================================
   *
   * 直觉上"段 1 没有上一段，不该带续写任务"，但那是**错的**，会让整条链断掉。
   *
   * 南风 V15 源码（h3_generator.py:1620 / 2043）把**读**和**写**都挂在同一个
   * `if continuation:` 下：
   *
   *     1620: if continuation:
   *     1621:     previous_latent = MiniMaxH3MotionContextLoadLatent(clip_index = index-1)
   *     ...
   *     2043: if continuation:
   *     2049:     committed = NanFengV15CommitContinuation(clip_index = index)
   *
   * 也就是说：**不开续写 → 不读 latent，也不保存 latent。**
   * 如果段 1 关掉续写，它的 AV latent 就永远不落盘，
   * 段 2 去 Load clip_1 就会报：
   *
   *   "nanfeng_v15_context/<hash>' is neither a file nor a folder
   *    under the ComfyUI output directory."
   *
   * 这正是实测踩到的错误。
   *
   * ============================================================================
   * 官方设计：段 1 就带 Load 0 / Save 1
   * ============================================================================
   *
   * ComfyUI-H3-Motion-Context 的 README 原话：
   *   "First clip: Load 0, Save 1. Making clip 2 from clip 1: Load 1, Save 2."
   *   "Load 0 does not read a file. Motion Context then passes the incoming
   *    conditioning through and reports trim_frames 0, so you can leave the
   *    node enabled for the first clip. **Do not mute it.**"
   *
   * 所以段 1 的 task 里 index=1 是**正确且必需的**：
   *   · Load clip_index=0 → 不读文件，直接透传条件（trim_frames=0，不裁）
   *   · Save clip_index=1 → 把这一段的 AV latent 存成 clip_1，供段 2 使用
   *
   * 之前"段 1 关续写"的写法会让批次第 1 段成功、第 2 段必然失败。
   */
  if (contTask) {
    params['启用潜空间续写'] = true;
    params['潜空间续写任务'] = contTask;
  } else if (params['启用潜空间续写'] === true) {
    /**
     * 开了续写但没有任务 JSON → 当作**单镜头渲染**，降级关闭并大声告知。
     *
     * ============================================================================
     * 为什么不再抛错
     * ============================================================================
     *
     * 旧实现一律抛 `NANFENG_CONSTRAINT`。理由是"批次里丢了任务会让段 2 崩"。
     * 但那个理由在这里**无法判定** —— 走到这个分支本身就意味着调用方没给
     * `contTask`，无法区分"批次传参丢了"和"用户就是想单独渲染这个镜头"。
     * 代价却是实打实的：项目里每个镜头都挂着 `continuation` 预设（续写段的
     * 正常状态），于是在渲染页点「开始渲染」**必然失败**，错误信息还叫用户
     * 去改预设 —— 用户完全不知道自己做错了什么。实测复现过（海滨项目 6 个镜头全中）。
     *
     * 现在：关掉续写（本段作为独立片段从冷启动生成），并明确告知
     * "这段不会和上一段无缝衔接、要连续请用续写批次"。
     * 用户拿到了片子，也知道了差异在哪 —— 比一句指令式的报错有用。
     *
     * 批次真正的传参丢失由**编排层**负责（continuation.js 的 taskFor 一定会
     * 产出合法 JSON；api 的批次循环在提交前校验 index）。
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
  // 这里提前拦下，并把冲突项名字直接写进错误信息。
  const violations = checkConstraints(params);
  if (violations.length) {
    const err = new Error(`NANFENG_CONSTRAINT: ${violations.map((v) => v.message).join(' / ')}`);
    err.code = 'NANFENG_CONSTRAINT';
    err.violations = violations;
    throw err;
  }

  // ---------- 5) 环境修正 ----------
  //
  // explicit 的语义：这些键是调用方**明确选择**的，环境修正不能覆盖它们。
  // 以前的缺陷是这里算好了 explicit、传给 applyFixes，然后 buildWorkflow
  // 内部又用 `new Set()` 重跑一遍，把用户显式设置的值无条件冲掉。
  // 现在只在这里修一次，并把 explicit 透传给 buildWorkflow（它不再重复修正）。
  const explicit = new Set([
    ...Object.keys(extraParams ?? {}),
    ...Object.keys(shotOverrides ?? {}),
  ]);
  const { snapshot, applied } = applyFixes(params, explicit, availableNodes);
  params = snapshot;
  if (applied.length) warnings.push(...applied);

  // ---------- 6) 组装 workflow ----------
  const built = buildWorkflow({
    params, jobId, frameRate, saveVideo,
    // 环境修正已经在上面做过一次了。把所有键都声明为 explicit，
    // 让 buildWorkflow 不再重复修正（否则同一理由会出现两条 warning，
    // 且第二次修正会无视 explicit 集合）。
    explicitKeys: new Set(Object.keys(params)),
    availableNodes,
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
 * 把镜头卡的通用字段翻译成南风参数覆盖。
 *
 * 这是「我们的数据模型」与「南风参数」之间的唯一映射点。
 *
 * @param {object} shot
 * @param {string} [modeOverride]
 * @returns {Record<string, unknown>}
 */
/**
 * 从「三件套开关」反推模式。
 *
 * 调用方传 `extraParams: { 图生视频: true }` 时，意图是"选 i2va"，
 * 而不是"在已有模式上追加一个开关"。用这个函数把它识别出来，
 * 避免与 buildShotOverrides 的默认模式互相打架。
 *
 * @param {Record<string, unknown>|null|undefined} flags
 * @returns {'t2va'|'i2va'|'fl2va'|null}
 */
function modeFromFlags(flags) {
  if (!flags || typeof flags !== 'object') return null;
  if (flags['图生视频'] === true) return 'i2va';
  if (flags['首尾帧'] === true) return 'fl2va';
  if (flags['文生视频'] === true) return 't2va';
  return null;
}
export function buildShotOverrides(shot = {}, modeOverride, explicitFlags = null) {
  const out = {};

  /**
   * ---- 模式（三选一）----
   *
   * ⚠️ 必须把「有没有参考图」传给 normalizeMode：
   *    它的兜底规则是「有图 → ref2va，无图 → t2va」。
   *
   *    历史缺陷：这里只传 `shot.mode`，而 nanfeng 自己那份 normalizeMode
   *    对空 mode **恒返回 ref2va** —— 于是一个完全没有参考图的镜头被套上
   *    Ref2VA 的三件套开关（文生/图生/首尾帧全 false），提交后由 ComfyUI
   *    报「请至少拖入一张图片」，用户完全不知道是自己没选图还是模式选错。
   *
   *    models.normalizeMode 的兜底更准确，但需要 hasRefImages 才能生效。
   */
  const hasRefImages = (shot.refs?.images?.length ?? 0) > 0;
  /**
   * 模式的三层优先级（高 → 低）：
   *   ① `extraParams` 里的三件套开关（调用方显式点了某个模式）
   *   ② `modeOverride`（调用方传了模式名）
   *   ③ 镜头卡 `shot.mode` 归一（兜底：有图 ref2va / 无图 t2va）
   *
   * ⚠️ 三件套**必须总是写出去**（且互斥）。历史缺陷是"只写一半"：
   *    `extraParams: { 图生视频: true }` 这种写法会把 `文生视频` 留成预设里的
   *    默认值 true，于是两个开关同时为真 → 触发「三选一不能同时开启」，
   *    而用户看到的错误与他的输入完全对不上。
   */
  const explicitMode = modeFromFlags(explicitFlags);
  const mode = explicitMode ?? modeOverride ?? normalizeMode(shot.mode, { hasRefImages });
  /**
   * ⚠️ 只在**没有**显式模式时才写三件套开关。
   *
   *    历史缺陷：`extraParams: { 图生视频: true }` 这类"调用方只想选模式"
   *    的写法，会被这里的 `modeFlags(t2va)`（文生=true）先写一遍，
   *    再被 extraParams 覆盖成"图生=true 且 文生=true" —— 两个开关同时为真，
   *    触发「三选一，不能同时开启」的约束，用户看到的错误完全对不上他的输入。
   *
   *    现在：如果调用方显式指定了模式（via modeOverride 或 extraParams 的
   *    三个开关之一），这里就不碰模式开关，让调用方的选择原样生效。
   */
  Object.assign(out, modeFlags(mode));

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
 * ⚠️ 南风的素材槽位接受的是 **ComfyUI input 目录内的文件名**，
 *    不是绝对路径也不是 dataDir 相对路径。上层必须先 stage 到 input。
 *
 * 这里只做 basename 提取；真正的 stage 由 comfy-client.stageToComfyInput 做。
 */
export function toComfyFileName(rel) {
  const s = String(rel ?? '').trim();
  if (!s) return '未选择';
  const base = s.replace(/\\/g, '/').split('/').pop() ?? s;
  return base || '未选择';
}

/**
 * 南风 V15 的硬互斥约束 —— 与 vendor 源码逐条对齐的**唯一真源**。
 *
 * 为什么必须在前端/组装期就拦：这些组合在 ComfyUI 执行器内部才会抛
 * `ValueError`，错误信息以 "COMFY_EXEC_ERROR @NanFengH3..." 的形式回传，
 * 用户既看不出是哪两个参数冲突，也已经浪费了一次 GPU 排队。
 *
 * 每一条都标注了 vendor 源码位置，改动前请回去核对。
 */
export const CONSTRAINT_RULES = Object.freeze([
  {
    id: 'continuation-vs-latent-upscale',
    // h3_generator.py:1322-1323
    when: (p) => p['启用潜空间续写'] === true && p['启用H3潜空间放大二采'] === true,
    message: '潜空间续写与「H3潜空间放大二采」互斥：续写要求前后采样画布一致，'
      + '请关闭其中一项。想做高清续写，请提高「百万像素」而不是开二采。',
    keys: ['启用潜空间续写', '启用H3潜空间放大二采'],
  },
  {
    id: 'continuation-vs-audio-lock',
    // h3_generator.py:1318-1321
    when: (p) => p['启用潜空间续写'] === true
      && (p['启用锁音频'] === true || p['开启音频驱动模式'] === true || p['空5分钟时间轴模式'] === true),
    message: '潜空间续写不能与「锁音频 / 音频驱动 / 空5分钟时间轴模式」同时开启'
      + '（重叠裁切会破坏原音轨时间）。',
    keys: ['启用潜空间续写', '启用锁音频', '开启音频驱动模式', '空5分钟时间轴模式'],
  },
  {
    id: 'mode-exclusive',
    // h3_generator.py:1361 —— 三个模式开关只能有一个为真
    when: (p) => [p['文生视频'], p['图生视频'], p['首尾帧']].filter(Boolean).length > 1,
    message: '「文生视频 / 图生视频 / 首尾帧」三选一，不能同时开启。',
    keys: ['文生视频', '图生视频', '首尾帧'],
  },
  {
    id: 'audio-drive-needs-lock',
    // h3_generator.py:1351 —— 音频驱动必须同时锁音频
    when: (p) => p['开启音频驱动模式'] === true && p['启用锁音频'] !== true,
    message: '开启「音频驱动模式」时必须同时开启「启用锁音频」，'
      + '否则驱动用的音频不会被锁进输出音轨。',
    keys: ['开启音频驱动模式', '启用锁音频'],
  },
  {
    id: 'tl2va-needs-two-images',
    // 首尾帧必须有 图片1 + 图片2
    when: (p) => p['首尾帧'] === true
      && (p['图片1'] === '未选择' || !p['图片1'] || p['图片2'] === '未选择' || !p['图片2']),
    message: '「首尾帧」模式需要同时提供 图片1（首帧）与 图片2（尾帧），'
      + '并且模型要切到 fl2va。',
    keys: ['首尾帧', '图片1', '图片2'],
  },
  {
    id: 'i2va-needs-one-image',
    // h3_generator.py:1378-1379 —— 图生视频必须恰好 1 张图
    when: (p) => p['图生视频'] === true && countImages(p) !== 1,
    message: '「图生视频」模式必须恰好提供 1 张图片（图片1 = 首帧）。'
      + '请减少参考图，或改用 Ref2VA 模式。',
    keys: ['图生视频', '图片1'],
  },
  {
    id: 't2va-rejects-images',
    // h3_generator.py:1376-1377 —— 文生视频不能带图
    when: (p) => p['文生视频'] === true && countImages(p) > 0,
    message: '「文生视频」模式不接受任何参考图，请清空 图片1..9 或改用 Ref2VA。',
    keys: ['文生视频'],
  },
  {
    id: 'frame-modes-reject-video-audio',
    // h3_generator.py:1372-1373 —— 图生/首尾帧不接受视频与音频参考
    when: (p) => (p['图生视频'] === true || p['首尾帧'] === true)
      && ([1, 2, 3].some((i) => p[`视频${i}`] && p[`视频${i}`] !== '未选择')
        || [1, 2, 3].some((i) => p[`音频${i}`] && p[`音频${i}`] !== '未选择')),
    message: '「图生视频 / 首尾帧」模式不接受视频或音频参考，请清空对应素材。',
    keys: ['图生视频', '首尾帧', '视频1', '音频1'],
  },
]);

/** 数一数实际填了内容的图片槽位 */
function countImages(p) {
  let n = 0;
  for (let i = 1; i <= 9; i += 1) {
    const v = p[`图片${i}`];
    if (v && v !== '未选择') n += 1;
  }
  return n;
}

/**
 * 检查参数快照是否违反南风的硬约束。
 *
 * @param {Record<string, unknown>} params
 * @returns {Array<{ id: string, message: string, keys: string[] }>} 违规列表
 */
export function checkConstraints(params) {
  const out = [];
  for (const rule of CONSTRAINT_RULES) {
    try {
      if (rule.when(params)) {
        out.push({ id: rule.id, message: rule.message, keys: rule.keys });
      }
    } catch { /* 单条规则异常不影响其它 */ }
  }
  return out;
}
