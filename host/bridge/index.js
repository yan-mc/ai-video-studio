/**
 * H3 桥接层 —— 统一门面。
 *
 * ============================================================================
 * 为什么要有这一层，以及为什么它不在 services/nanfeng/ 里
 * ============================================================================
 *
 * 改造前，"南风 V15" 的桥接代码散在 `host/services/nanfeng/`，与 28 个业务
 * 服务平铺在一起。结果是三件事混为一谈：
 *
 *   1. **上游厂商耦合**：参数名、节点名、图组装都是「南风这个节点包」的私有
 *      知识，一旦上游改名（历史已发生：`H3LatentUpscalerNodeMegapixels` 被删），
 *      改动面会扩散到业务层。
 *   2. **业务语义耦合**：预设、续写批次、镜头 → 参数的翻译，是本产品的语义，
 *      不该和上游参数表放在一起。
 *   3. **提示词编译**（`h3-prompt.js` 2,142 行）与智能分镜的 LLM 桥接，
 *      实际上也是「H3 模型怎么说话」的知识，却被平铺在 services/ 顶层。
 *
 * 现在的结构把这三件事拆开，并且**每个子目录只承担一种变化原因**：
 *
 *   host/bridge/
 *   ├─ index.js                ← 本文件：对外唯一门面（业务层只 import 这里）
 *   ├─ vendors/nanfeng/        ← 上游节点包的镜像：schema / graph / presets / continuation
 *   │   ├─ schema.js            221 参数机读定义
 *   │   ├─ param-docs.js        参数中文释义 + dead/banned 标记
 *   │   ├─ graph.js             图组装 / 类型强制 / 环境修正 / 能力探测
 *   │   ├─ presets.js           7 内置预设 + 3 层合并 + Sigma 校验
 *   │   ├─ index.js             buildShotWorkflow 等组合入口
 *   │   └─ continuation.js      续写批次规划 + 串行编排
 *   ├─ prompt/                 ← 提示词通道（与参数通道正交）
 *   │   ├─ h3-prompt.js         六段式编译器（模式路由 / 画风 / 打光 / lint）
 *   │   └─ prompt-normalizer.js 换人提示词规则化
 *   └─ llm/                    ← DSH 内部 LLM 桥接
 *       ├─ dsh-llm.js           文本 / 视觉调用 + 模型解析 + 状态报告
 *       └─ storyboard.js        智能分镜（SKILL.md 装配 + 解析）
 *
 * ============================================================================
 * 业务层怎么用
 * ============================================================================
 *
 *   // 单镜生成：拿一个可以直接 POST 给 ComfyUI 的 workflow
 *   import { nanfeng } from '../bridge/index.js';
 *   const { workflow, params, warnings } = nanfeng.buildShotWorkflow({ shot, preset: 'quality', jobId });
 *
 *   // 提示词编译：镜头卡 → 六段式正文
 *   import { prompt } from '../bridge/index.js';
 *   const { prompt: text, warnings } = prompt.compileH3Prompt(pkg);
 *
 *   // 续写批次
 *   import { continuation } from '../bridge/index.js';
 *   const batch = continuation.createBatch({ projectId, shotIds });
 *
 *   // 智能分镜
 *   import { llm } from '../bridge/index.js';
 *   const status = llm.llmStatus(ctx, cfg);
 *
 * ⚠️ 业务层**不要**再直接 import `bridge/vendors/nanfeng/*`。
 *    统一从本门面取，这样上游改名时只需改本文件的 re-export 一行。
 *
 * @module bridge
 */

/* 上游节点包（南风 V15）—— 参数表 / 图组装 / 预设 / 续写 */
export * as nanfeng from './vendors/nanfeng/index.js';
export * as nanfengSchema from './vendors/nanfeng/schema.js';
export * as nanfengGraph from './vendors/nanfeng/graph.js';
export * as nanfengPresets from './vendors/nanfeng/presets.js';
export * as continuation from './vendors/nanfeng/continuation.js';

/* 提示词通道 */
export * as prompt from './prompt/h3-prompt.js';
export * as promptNormalizer from './prompt/prompt-normalizer.js';

/* DSH LLM 桥接 + 智能分镜 */
export * as llm from './llm/dsh-llm.js';
export * as storyboard from './llm/storyboard.js';

/* ---------------------------------------------------------------------------
 * 常用符号的直出（业务层最常引用的那几个，省一层解构）
 * ------------------------------------------------------------------------- */

export {
  buildShotWorkflow,
  buildShotOverrides,
  checkConstraints,
  CONSTRAINT_RULES,
} from './vendors/nanfeng/index.js';

/**
 * 模式别名归一 —— **唯一实现**在 `store/models.js`。
 *
 * ⚠️ 这里曾经 re-export 的是 `vendors/nanfeng/index.js` 自己那份：
 *    它把 `l2va` 丢掉了（落进最后的 `return 'ref2va'`），
 *    而 models.js 的 `H3_MODE_ALIASES` 认 `l2v`/`l2va`。
 *    两份并存 → 同一个镜头走 `nanfeng.normalizeMode` 被判成 ref2va、
 *    走 `models.normalizeMode` 被判成 l2va，**模式开关完全不同**。
 *
 *    现在只在 models.js 定义一次，这里只是转发。
 */
export { normalizeMode } from '../store/models.js';

export {
  PARAMS,
  GROUPS,
  PARAM_COUNT,
  enrichSchema,
  inertParams,
} from './vendors/nanfeng/schema.js';

export {
  DEFAULT_PRESET,
  builtinPreset,
  listBuiltinPresets,
  parsePresetSpec,
  resolvePresetLayers,
} from './vendors/nanfeng/presets.js';

export {
  compileH3Prompt,
  toShotInputPackage,
  STYLE_PRESETS,
  LIGHTING_PRESETS,
  H3_MODES,
  H3_LIMITS,
  truncatePromptKeepFields,
} from './prompt/h3-prompt.js';

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
  prompt: '提示词通道（六段式编译器 / 换人提示词规则化）',
  llm: 'DSH 内部 LLM 桥接（文本 / 视觉 / 智能分镜）',
});