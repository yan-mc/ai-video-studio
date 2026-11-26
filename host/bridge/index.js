/**
 * H3 桥接层 —— 对外**唯一**门面。
 *
 * ============================================================================
 * 这一层存在的理由
 * ============================================================================
 *
 * 「南风 V15 节点包长什么样」是上游私有知识：221 个参数名、节点类型名、
 * latent 文件夹哈希规则、上游硬校验。它们会和「我们的产品语义」（镜头卡、
 * 预设、续写批次）与「DSH LLM 接口」以不同节奏变化，所以必须**分开**：
 *
 *   host/bridge/
 *   ├─ index.js                ← 本文件：唯一门面（业务层只 import 这里）
 *   ├─ vendors/nanfeng/        ← 上游节点包镜像
 *   │   ├─ schema.js            221 参数机读定义
 *   │   ├─ param-docs.js        参数中文释义 + dead/banned/advanced 标记
 *   │   ├─ graph.js             图组装 / 类型强制 / 环境修正 / 能力探测
 *   │   ├─ presets.js           内置预设 + 分层合并 + Sigma 序列校验
 *   │   ├─ index.js             buildShotWorkflow / CONSTRAINT_RULES
 *   │   └─ continuation.js      续写批次规划 + 串行编排 + 租约
 *   ├─ prompt/                 ← 提示词通道（与参数通道正交）
 *   │   ├─ h3-prompt.js         门面 + 编译入口（compileH3Prompt）
 *   │   ├─ spec.js              官方枚举 / 硬上限 / 机制句
 *   │   ├─ styles.js            画风库 + 打光库
 *   │   ├─ route.js             模式 → 格式 路由
 *   │   ├─ base.js              基础格式（三字段）
 *   │   ├─ ref2va.js            六段式正文
 *   │   ├─ lint.js              反模式落位 / 自查 / 截断
 *   │   ├─ text-utils.js        纯函数（帧数 / 时间戳 / 运镜 / 说话人）
 *   │   ├─ shot-adapter.js      镜头卡 → 输入包
 *   │   └─ prompt-normalizer.js 换人提示词规则化
 *   └─ llm/                    ← DSH 内部 LLM 桥接
 *       ├─ dsh-llm.js           文本 / 视觉调用 + 模型解析 + 状态
 *       └─ storyboard.js        智能分镜（SKILL.md 装配 + 解析）
 *
 * ============================================================================
 * 业务层怎么用（**只允许**从本门面取）
 * ============================================================================
 *
 *   import { nanfeng, prompt, continuation, llm } from '../bridge/index.js';
 *
 *   const { workflow, params, warnings } = nanfeng.buildShotWorkflow({ shot, preset: 'quality', jobId });
 *   const { prompt: text, warnings } = prompt.compileH3Prompt(pkg);
 *
 * ⚠️ 业务层**不要**直接 import `bridge/vendors/nanfeng/*` 或 `bridge/prompt/*`。
 *    深路径意味着上游改名时要改多处；从门面取，改名只改本文件一行。
 *    `host/tools.js` 的历史深路径已全部收口到本门面。
 *
 * @module bridge
 */

/* ---------------- 命名空间（业务层按需解构） ---------------- */

export * as nanfeng from './vendors/nanfeng/index.js';
export * as nanfengSchema from './vendors/nanfeng/schema.js';
export * as nanfengGraph from './vendors/nanfeng/graph.js';
export * as nanfengPresets from './vendors/nanfeng/presets.js';
export * as nanfengDocs from './vendors/nanfeng/param-docs.js';
export * as continuation from './vendors/nanfeng/continuation.js';

export * as prompt from './prompt/h3-prompt.js';
export * as promptNormalizer from './prompt/prompt-normalizer.js';

export * as llm from './llm/dsh-llm.js';
export * as storyboard from './llm/storyboard.js';

/* ---------------- 高频符号直出（省一层解构） ---------------- */

export {
  buildShotWorkflow,
  buildShotWorkflowAsync,
  buildShotOverrides,
  checkConstraints,
  checkSigmaSequences,
  CONSTRAINT_RULES,
  toComfyFileName,
} from './vendors/nanfeng/index.js';

/**
 * 模式别名归一 —— **唯一实现**在 `store/models.js`。
 *
 * 不要在这里再写一份：`vendors/nanfeng/index.js` 那份会把 `l2va` 丢掉
 * （落进最后的 `return 'ref2va'`），而 `H3_MODE_ALIASES` 认 `l2v`/`l2va`。
 * 两份并存会让同一个镜头在两条路径上被判成不同模式，开关完全不同。
 */
export { normalizeMode } from '../store/models.js';

export {
  PARAMS,
  GROUPS,
  PARAM_COUNT,
  paramsOfGroup,
  defaults,
  enrichSchema,
  inertParams,
} from './vendors/nanfeng/schema.js';

export {
  PARAM_DOCS,
  GROUP_DOCS,
  paramDoc,
  groupDoc,
  deadParamNames,
} from './vendors/nanfeng/param-docs.js';

export {
  DEFAULT_PRESET,
  BUILTIN_PRESETS,
  SIGMA_PRESETS,
  builtinPreset,
  listBuiltinPresets,
  parsePresetSpec,
  resolvePresetLayers,
  validateSigmaSequence,
} from './vendors/nanfeng/presets.js';

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
  DIRECTORY_DRIVEN_PARAMS,
} from './vendors/nanfeng/graph.js';

export {
  /** 续写批次 */
  CONTEXT_ROOT,
  CONTEXT_LENGTHS,
  LEASE_TIMEOUT_MS,
  contextFolder,
  validateSettings,
  createBatch,
  taskFor,
  continuationParamsFor,
  saveBatch,
  loadBatch,
  listBatches,
  batchFile,
  advanceStatus,
  nextPendingIndex,
  completedCount,
  cleanupContext,
  snapToGrid,
  planSegments,
  runBatch,
  resetFromFailure,
  leaseValid,
  leaseHeldByOther,
} from './vendors/nanfeng/continuation.js';

export {
  compileH3Prompt,
  toShotInputPackage,
  routeFormat,
  STYLE_PRESETS,
  LIGHTING_PRESETS,
  H3_MODES,
  H3_LIMITS,
  H3_STYLE_PRESETS,
  H3_MODE_LIST,
  CONTINUATION_SWITCH,
  TRIM_DISCIPLINE,
  SUPPRESSION_GUARDS,
  RETENTION_VISUAL,
  RETENTION_AUDIO,
  SUMMARY_TASKS,
  resolveContinuation,
  resolveLighting,
  styleLightingConflicts,
  truncatePromptKeepFields,
  lintCompiledPrompt,
  h3Frames,
  timecode,
  cameraPhrase,
} from './prompt/h3-prompt.js';

/* 编译期辅助（不挂在 `prompt` 命名空间上，避免改变其既有导出面） */
export {
  /** 权威编号覆盖：plan 给了映射就以 plan 为准，陈旧值丢弃并告警 */
  normalizeSubjects,
} from './prompt/shot-adapter.js';
/** 角色卡 → subject_definitions 段内的参考绑定行（替代"末尾追加第 7 段"） */
export { cardBindingLines } from './prompt/ref2va.js';
export { resolveStyle, SHORT_STYLE_CHARS } from './prompt/styles.js';

export {
  /** 换人提示词规则化（翻译由调用方注入，本层不碰 services） */
  hasCjk,
  splitReplacePrompt,
  joinReplacePrompt,
  normalizeByRules,
  normalizePrompt,
  detectSixFieldMixed,
  SIX_FIELD_NAMES,
} from './prompt/prompt-normalizer.js';

export {
  llmService,
  attachmentsService,
  defaultModelService,
  resolveModel,
  callText,
  callVision,
  guessMediaType,
  llmStatus,
} from './llm/dsh-llm.js';

export {
  STORYBOARD_MODES,
  SKILLS,
  visionPrompt,
  modeContract,
  outputBudget,
  validateContinuationContext,
  loadSkill,
  buildStoryboardMessages,
  parseStoryboard,
} from './llm/storyboard.js';

/* ---------------------------------------------------------------------------
 * 目录约定（自检用）
 * ------------------------------------------------------------------------- */

/**
 * 桥接层各子目录的职责边界。
 *
 * `tools/smoke-api.mjs` 的「桥接层自检」用它做**结构性断言**：
 * 任何文件如果不在这个表里，说明有人往 bridge/ 里塞了不归属这里的东西。
 */
export const BRIDGE_LAYOUT = Object.freeze({
  'vendors/nanfeng': '上游南风 V15 节点包的镜像层（参数表 / 图组装 / 预设 / 续写编排）',
  prompt: '提示词通道（六段式编译器 / 画风库 / lint / 换人提示词规则化）',
  llm: 'DSH 内部 LLM 桥接（文本 / 视觉 / 智能分镜）',
});

/** 门面自检：必须把业务层用到的东西全部直出，不允许业务层再走深路径 */
export const BRIDGE_FACADE_RULE = Object.freeze({
  rule: 'host/services、host/api、host/tools.js 只能 import host/bridge/index.js',
  forbidden: 'host/bridge/**/*.js 内不得出现 ../services/ 或 ../api/',
});