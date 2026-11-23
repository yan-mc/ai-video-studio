/**
 * 南风 V15 工作流组装器 —— REST 驱动的唯一入口。
 *
 * ============================================================================
 * 为什么需要这一层
 * ============================================================================
 *
 * 南风节点 `NanFengH3MultiReferenceGeneratorV15` 是一个"巨型节点"：它接收 221 个
 * 参数，在 ComfyUI 执行器内部用 `GraphBuilder` 动态展开成约 40 个真实节点。
 *
 * 但**它的输出必须接到输出节点**，ComfyUI 才会执行。南风的前端会自动接
 * `VHS_VideoCombine`，我们用 REST 时必须自己接 —— 这是阶段 1 实测踩到的坑：
 *
 *   {"error": {"type": "prompt_no_outputs", "message": "Prompt has no outputs"}}
 *
 * ============================================================================
 * 本模块的职责
 * ============================================================================
 *
 *   1. 把「镜头卡 + 预设 + 覆盖项」合并成 221 个参数的完整快照
 *   2. 组装成 ComfyUI `/prompt` 可接受的 workflow JSON
 *   3. 修正那些「默认值在我们的环境里必炸」的参数
 *
 * ============================================================================
 * 已知必改项（阶段 1 实测）
 * ============================================================================
 *
 *   · SageAttention 默认 'auto' → 会尝试加载 SageAttention3 加速，本机未装，
 *     报 `sageattention is not new enough version`。必须降为 'disabled'。
 *   · H3专用注意力 默认 '关闭' 是安全的，但用户选了 '自动' 也会触发同样问题。
 *   · SaveVideo 的 format 是动态 combo（COMFY_DYNAMICCOMBO_V3），程序化构造
 *     很麻烦；改用 VHS_VideoCombine 的固定 format 枚举。
 *
 * @module nanfeng/graph
 */
import { PARAMS, defaults as schemaDefaults } from './schema.js';

/** 南风主节点类型名 */
export const NANFENG_NODE = 'NanFengH3MultiReferenceGeneratorV15';

/**
 * 南风节点的输出索引（对应 RETURN_TYPES）
 *
 *   RETURN_TYPES = ("IMAGE", "AUDIO", "FLOAT", "VIDEO", "STRING")
 */
export const NANFENG_OUTPUT = Object.freeze({
  IMAGE: 0,
  AUDIO: 1,
  FPS: 2,
  VIDEO: 3,
  REPORT: 4,
});

/**
 * 最近一次 `coerceTypes` 遇到的非法值（供上层转成可读的 400）。
 * 用模块级数组而不是改返回值，因为 `coerceTypes` 的调用点分布在
 * `buildShotWorkflow` 主流程里，改签名会波及太多调用方。
 */
const invalid = [];
export function coerceIssues() { return [...invalid]; }

/**
 * 按 schema 声明的类型强制转换参数值。
 *
 * ============================================================================
 * 为什么必须做（阶段 2-g 实测踩到的坑）
 * ============================================================================
 *
 * 南风节点里有一批 **数值型 COMBO**：
 *   「参考图最长边」  options = [1280, 1536, 1920, 2560, 3072, 3840]
 *   「尺寸倍数」      options = [32]
 *   「H3潜空间对齐」  options = [2, 4, 8, 16, 32]
 *   「二采百万像素」  options = [0.2, 0.3, ...]
 *   「全局修复倍率」  options = [1.25, 1.5, 1.75, 2.0]
 *
 * ComfyUI 校验时做的是**严格类型比较**，不是字符串比较：
 *
 *   "尺寸倍数: '32' not in [32]"        ← 字符串 '32' 不等于整数 32
 *   "H3潜空间对齐: '2' not in [2, 4...]" ← 字符串 '2' 不等于整数 2
 *
 * 如果参数经过了 JSON 序列化/反序列化、或来自 HTML 表单、或从
 * localStorage 读回，数字会变成字符串，然后**整条生成必然失败**。
 *
 * 这里按 schema 的 options 类型（或数字字符串形态）把它转回数字。
 *
 * @param {Record<string, unknown>} snapshot
 * @returns {Record<string, unknown>}
 */
export function coerceTypes(snapshot) {
  const out = { ...snapshot };
  /** 强转失败的问题清单（上层据此抛可读的 400，而不是让 ComfyUI 报 Value not in list） */
  invalid.length = 0;

  for (const [key, value] of Object.entries(out)) {
    const def = PARAMS[key];
    if (!def) continue;

    /**
     * ⚠️ 数值强转必须**拒绝非法值**，不能变成 NaN / null 之后照原样提交。
     *
     * 旧实现是 `Math.round(Number(value))` / `Number(value)`：用户传
     * `'abc'` 或 `''` 之外的垃圾会得到 `NaN`，而 `JSON.stringify(NaN)` 是 `null` ——
     * 提交给 ComfyUI 的参数变成 `null`，上游报一句极难懂的
     * "Value not in list / Required input is missing"，排查方向完全被打偏。
     * 现在：非法就**保持原值并记为待校验问题**，由上层把它变成可读的 400。
     */
    if (def.type === 'INT') {
      if (value === '' || value == null) continue;
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = Math.round(n);
      else invalid.push(`${key}=${JSON.stringify(value)} 不是整数`);
      continue;
    }
    if (def.type === 'FLOAT') {
      if (value === '' || value == null) continue;
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
      else invalid.push(`${key}=${JSON.stringify(value)} 不是数字`);
      continue;
    }
    /**
     * BOOLEAN：只接受**明确的真值形态**。旧实现把任何其它值（含 `undefined`、
     * 字符串 `'maybe'`）都写成 `false` —— "未提供"与"明确关闭"被混成同一个值，
     * 于是预设里没写的开关会被静默关掉。
     */
    if (def.type === 'BOOLEAN') {
      if (value === true || value === 'true' || value === 1 || value === '1') out[key] = true;
      else if (value === false || value === 'false' || value === 0 || value === '0') out[key] = false;
      else if (value === '' || value == null) delete out[key];   // 未提供 ≠ 关闭
      else invalid.push(`${key}=${JSON.stringify(value)} 不是布尔值`);
      continue;
    }

    // COMBO：看选项本身的类型决定要不要转
    if (def.type === 'COMBO' && Array.isArray(def.options) && def.options.length) {
      const sample = def.options.find((o) => o != null);
      if (typeof sample === 'number' && value !== '' && value != null) {
        const n = Number(value);
        if (Number.isFinite(n)) out[key] = n;
      }
    }
  }
  return out;
}

/**
 * 参数修正规则 —— 把"上游默认值"改成"我们环境的正确值"。
 *
 * 每条规则：{ key, when?, value } 或 { key, when?(snapshot), value }
 * 只在用户**没有显式覆盖**时生效。
 */
const PARAM_FIXES = Object.freeze([
  {
    key: 'SageAttention',
    // 本机未装 SageAttention2/3；auto 会在首次采样时抛 RuntimeError
    value: 'disabled',
    reason: '本机未安装 SageAttention，auto 会报 sageattention is not new enough version',
  },
  {
    // ⚠️ 这是**第二个**独立的注意力开关，和上面那个不是同一个参数。
    //    南风的 V7 逻辑（h3_generator.py 里的 selected_h3_attention）会把它
    //    映射到 SageAttention，默认值 'H3专用Sage加速' 会调用 KJNodes 的
    //    MiniMaxH3MemoryEfficientSageAttentionPatch → 同样需要 SageAttention。
    //    两个都改成「关闭」才真正不触发。
    key: 'H3专用注意力',
    value: '关闭',
    reason: '本机未安装 SageAttention，「H3专用Sage加速」会调用 KJNodes 的 Sage Patch 并失败',
  },
  {
    key: 'TRT视频解码引擎',
    // 空字符串不是合法选项（唯一选项是 'None'）
    value: 'None',
    reason: 'TRT 未启用时引擎名必须是 "None"，空串会被 ComfyUI 拒绝',
  },
  {
    key: 'TRT视频编码引擎',
    value: 'None',
    reason: '同上',
  },
]);

/**
 * 不做 COMBO 合法性检查的参数。
 *
 * 两类：
 *  1) 素材槽位（图片N/视频N/音频N）—— 选项来自 ComfyUI input/ 目录，运行时动态
 *  2) **目录驱动型参数** —— 选项来自 ComfyUI 的模型目录扫描，不是固定枚举：
 *       模型 / 文本编码器 / 视频VAE / 音频VAE      → folder_paths.get_filename_list
 *       二采模型 / H3潜空间放大模型                  → 同上（+ SAME/AUTO）
 *       LoRA1..LoRA8                                 → loras 目录
 *       TRT视频解码引擎 / TRT视频编码引擎            → os.walk(vae 目录)
 *
 * ⚠️ 历史缺陷（P0）：以前只豁免了素材槽。schema.js 里的 options 是**导出那一刻**
 *    的目录快照，用户后装的任何模型/LoRA 都不在里面 —— 于是
 *      · 选了自定义主模型  → 被静默换回默认 fp8 权重
 *      · 选了 DMAD/自定义 LoRA → 被换成「未选择」，蒸馏栈变空，4/8 步采样
 *        跑在未蒸馏原模型上（正是 accel-plan.js 反复警告的"分布外"）
 *      · 选了自定义文本编码器 → 被换回默认 int8
 *    而界面上 job.params 显示的还是用户选的值，用户完全看不出来。
 *
 *    这类参数必须交给 ComfyUI 自己校验（它会在 /prompt 阶段返回
 *    value_not_in_list，信息明确且不会静默出错片）。
 */
const SKIP_SANITIZE = /^(图片|视频|音频)\d+$|^(模型|文本编码器|视频VAE|音频VAE|二采模型|H3潜空间放大模型|LoRA\d|TRT视频解码引擎|TRT视频编码引擎)$/;

/** 把快照里的参数分组：哪些要检查、哪些交给 ComfyUI 自己校验 */
export const DIRECTORY_DRIVEN_PARAMS = Object.freeze(
  Object.keys(PARAMS).filter((k) => SKIP_SANITIZE.test(k)),
);

/**
 * 把参数快照里的 COMBO 值做一次合法性检查。
 *
 * 为什么需要：南风节点的下拉选项来自 ComfyUI 的 `_live_combo()`，如果模型文件
 * 被删除/改名，用户存的旧值会变成非法项，ComfyUI 报 `Value not in list`，
 * 错误信息很难懂。这里提前降级到默认值并给出警告。
 *
 * ⚠️ 注意 1：南风的部分 COMBO 是**数值型**（如「百万像素」的选项是
 *    [0.2, 0.3, ..., 2.0]，「尺寸倍数」是 [32]）。JSON 序列化后数字可能
 *    变成字符串，直接 includes() 会误判。这里用字符串化比较。
 *
 * ⚠️ 注意 2：**素材槽位（图片N/视频N/音频N）必须跳过检查**。
 *    它们的选项来自 `os.listdir(ComfyUI/input/)`，是**运行时动态的**；
 *    schema.js 里的快照只记录了导出那一刻的文件列表，绝不能用来判定
 *    用户 stage 进来的新文件非法。这类参数必须交给 ComfyUI 自己校验。
 *
 * @param {Record<string, unknown>} snapshot
 * @returns {{ snapshot: Record<string, unknown>, warnings: string[] }}
 */
export function sanitize(snapshot) {
  const out = { ...snapshot };
  const warnings = [];

  for (const [key, value] of Object.entries(out)) {
    const def = PARAMS[key];
    if (!def) continue;
    if (def.type !== 'COMBO') continue;
    if (SKIP_SANITIZE.test(key)) continue;
    const opts = def.options;
    if (!Array.isArray(opts) || opts.length === 0) continue;
    if (value === '' || value == null) continue;
    // 用字符串化比较，兼容「数值型 COMBO」
    const hit = opts.some((o) => String(o) === String(value));
    if (!hit) {
      warnings.push(`参数「${key}」的值 ${JSON.stringify(value)} 不在可选项里，已回退到默认值`);
      out[key] = def.default;
    }
  }
  return { snapshot: out, warnings };
}

/**
 * 开二采时，把「采样步数」拆成一采/二采两个**真正生效**的步数。
 *
 * ============================================================================
 * 为什么必须拆
 * ============================================================================
 *
 * vendor/nanfeng/h3_generator.py:1732-1736：
 *
 *   scheduler_steps = (
 *       v81_first_steps + v81_second_steps
 *       if is_v81 and latent_upscale_enabled
 *       else ... int(采样步数)
 *   )
 *
 * 开了二采之后 `采样步数` **连读都不读**，实际步数恒为
 * `H3一采步数 + H3二采步数`。而所有预设（standard / quality / quality-preview）
 * 与所有加速方案（dmad8 / dmad4）写的都是 `采样步数`，从没写过一采/二采步数。
 *
 * 结果：声称 8 步的 DMAD 学生实际跑预设里残留的 6+4=10 步，且第一段只用 6 步 ——
 * 与蒸馏 LoRA 的训练设定错位，属分布外采样：不报错，只是画质悄悄变差。
 *
 * 修法：二采开启时按 `采样步数` 重新拆成一采(60%)/二采(40%)。
 * 用户若显式指定过任意一项，就完全不动，只回一条说明。
 *
 * ⚠️ 必须**幂等**：buildShotWorkflow 里会跑一次，buildWorkflow 里又跑一次
 *    （第二次把所有键标成 explicit）。所以这里不能依赖"已经是正确值就跳过"，
 *    而要在用户显式指定时**直接不进入拆分分支**。
 *
 * @param {Record<string, unknown>} snapshot
 * @param {Set<string>} explicitlySet
 * @param {string[]} applied 追加说明
 * @returns {Record<string, unknown>}
 */
export function splitSecondPassSteps(snapshot, explicitlySet = new Set(), applied = []) {
  const out = { ...snapshot };
  if (out['启用H3潜空间放大二采'] !== true) return out;

  const userSetFirst = explicitlySet.has('H3一采步数');
  const userSetSecond = explicitlySet.has('H3二采步数');

  const f = Math.max(1, Math.round(Number(out['H3一采步数']) || 0));
  const s = Math.max(1, Math.round(Number(out['H3二采步数']) || 0));

  if (userSetFirst || userSetSecond) {
    applied.push(`二采步数：一采 ${f} + 二采 ${s} = ${f + s}（显式指定，未按「采样步数」重拆）`);
    return out;
  }

  const total = Math.max(2, Math.round(Number(out['采样步数']) || 0));
  const first = Math.max(1, Math.round(total * 0.6));
  const second = Math.max(1, total - first);

  if (f === first && s === second) return out;   // 已经是这个形状，幂等返回

  out['H3一采步数'] = first;
  out['H3二采步数'] = second;
  applied.push(
    `二采步数拆分 → 一采 ${first} + 二采 ${second}（目标总步数 ${total}）`
    + '。上游开二采后「采样步数」不生效，只读这两项。',
  );
  return out;
}

/**
 * 应用参数修正（只改用户没显式设置过的项）。
 *
 * @param {Record<string, unknown>} snapshot
 * @param {Set<string>} explicitlySet 用户显式指定的参数名
 * @param {Set<string>} [availableNodes]
 *        当前 ComfyUI 实际注册的节点名集合。传了就会据此**探测**可选加速，
 *        而不是靠硬编码白名单。缺省时不探测（保持纯函数可测）。
 * @returns {{ snapshot: Record<string, unknown>, applied: string[] }}
 */
export function applyFixes(snapshot, explicitlySet = new Set(), availableNodes = null) {
  const out = { ...snapshot };
  const applied = [];

  /** 当前修正规则表：静态部分 + 按节点能力动态生成的部分 */
  const fixes = [...PARAM_FIXES];

  if (availableNodes && availableNodes.size) {
    const need = (node) => !availableNodes.has(node);
    // 依赖缺失 → 必须关掉，否则 GraphBuilder 展开时抛"节点不存在"，整单失败
    if (need('H3SLAAttention')) {
      fixes.push({
        key: '启用H3 SLA',
        value: false,
        reason: '本机 ComfyUI 未注册 H3SLAAttention 节点，开启会在展开图时报错',
      });
    }
    if (need('MiniMaxH3BlockCacheT8')) {
      fixes.push({
        key: '启用T8缓存',
        value: false,
        reason: '本机 ComfyUI 未注册 MiniMaxH3BlockCacheT8 节点（且上游已把该分支写死关闭）',
      });
    }
    if (need('MiniMaxH3MemoryEfficientSageAttentionPatch')) {
      fixes.push({
        key: 'H3专用注意力',
        value: '关闭',
        reason: '本机 ComfyUI 未注册 H3 专用 Sage 注意力补丁节点',
      });
    }
    if (need('NvidiaDLSSVideoUpscale') && need('NvidiaDLSSFrameInterpolation')) {
      fixes.push({ key: 'DLSS超分模式', value: '关闭', reason: '本机未安装 NVIDIA DLSS 节点' });
      fixes.push({ key: '启用DLSS补帧', value: false, reason: '本机未安装 NVIDIA DLSS 节点' });
    }
    if (need('MiniMaxH3TRTVAELoader')) {
      fixes.push({ key: '启用TRT视频VAE', value: false, reason: '本机未安装 TensorRT VAE 节点' });
    }
  }

  for (const fix of fixes) {
    if (explicitlySet.has(fix.key)) continue;
    // 已经是正确值就跳过
    if (out[fix.key] === fix.value) continue;
    out[fix.key] = fix.value;
    applied.push(`${fix.key} → ${fix.value}（${fix.reason}）`);
  }

  return { snapshot: splitSecondPassSteps(out, explicitlySet, applied), applied };
}

/**
 * 拉取 ComfyUI 当前注册的节点名集合，用于能力探测。
 *
 * 结果缓存 60 秒 —— node 列表在运行期基本不变，但装插件后无需重启 DSH 即可
 * 在下一次生成时生效。
 *
 * @param {object} cfg
 * @param {(cfg?: object) => Promise<string>} resolveUrl
 * @returns {Promise<Set<string>|null>} 探测失败返回 null（调用方按"不探测"处理）
 */
export async function fetchAvailableNodes(cfg, resolveUrl) {
  const now = Date.now();
  if (NODE_CACHE.set && now - NODE_CACHE.at < NODE_CACHE_TTL_MS) return NODE_CACHE.set;
  try {
    const base = await resolveUrl(cfg);
    const res = await fetch(`${base}/object_info`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const json = await res.json();
    const set = new Set(Object.keys(json));
    NODE_CACHE.set = set;
    NODE_CACHE.at = Date.now();
    return set;
  } catch {
    return null;
  }
}

const NODE_CACHE = { set: null, at: 0 };
const NODE_CACHE_TTL_MS = 60_000;

/** 仅供测试重置 */
export function resetNodeCache() { NODE_CACHE.set = null; NODE_CACHE.at = 0; }

/**
 * 生成三个互斥模式开关的取值。
 *
 * 南风用三个独立 BOOLEAN 表示模式，且代码里校验"只能开启一个"。
 * 上层只需要传一个 `mode` 字符串，这里做转换。
 *
 * @param {'ref2va'|'t2va'|'i2va'|'fl2va'} mode
 */
export function modeFlags(mode) {
  return {
    文生视频: mode === 't2va',
    图生视频: mode === 'i2va',
    首尾帧: mode === 'fl2va',
  };
}

/**
 * 构造完整的 ComfyUI `/prompt` workflow。
 *
 * @param {object} opts
 * @param {Record<string, unknown>} opts.params  221 参数快照（已含模式/素材）
 * @param {string} [opts.jobId]                  用于产物文件名
 * @param {number} [opts.frameRate]              输出帧率，默认 24
 * @param {boolean} [opts.saveVideo]             是否接输出节点，默认 true
 * @param {Set<string>|string[]} [opts.explicitKeys]
 *        调用方**显式设置**过的参数名。这些键跳过环境修正，
 *        否则用户想覆盖 `SageAttention` 永远做不到。
 * @returns {{ workflow: object, warnings: string[] }}
 */
export function buildWorkflow({
  params, jobId = 'jz', frameRate = 24, saveVideo = true, explicitKeys = null,
  availableNodes = null,
}) {
  const warnings = [];

  // 1) 类型强制（数值型 COMBO 必须是数字，否则 ComfyUI 报 value_not_in_list）
  //    强转失败的值不能静默变成 null/NaN 提交上去 —— 收集起来变成可读的错误。
  let snapshot = coerceTypes(params);
  const coerceBad = coerceIssues();
  if (coerceBad.length) {
    throw new Error(`INVALID_PARAM_TYPE: ${coerceBad.join('；')}`);
  }

  // 2) 环境修正（SageAttention / TRT 引擎名 / 可选加速的能力探测）
  //
  // ⚠️ 这里必须用调用方传进来的 explicit 集合。
  //    以前固定 `new Set()`，会把用户/预设显式设置的值无条件覆盖掉 ——
  //    即使 index.js 算好了 explicit 也白算（同一份逻辑被跑了两遍，第一遍结果丢弃）。
  const explicit = explicitKeys instanceof Set
    ? explicitKeys
    : new Set(Array.isArray(explicitKeys) ? explicitKeys : []);
  const fixed = applyFixes(snapshot, explicit, availableNodes);
  snapshot = fixed.snapshot;
  if (fixed.applied.length) warnings.push(...fixed.applied);

  // 3) 选项合法性（跳过动态素材槽）
  const san = sanitize(snapshot);
  snapshot = san.snapshot;
  warnings.push(...san.warnings);

  // 参数的键必须与南风 INPUT_TYPES 完全一致，多余键会导致 ComfyUI 报错
  const inputs = {};
  for (const key of Object.keys(PARAMS)) {
    inputs[key] = snapshot[key];
  }

  const workflow = {
    // 节点 ID 固定为 '1' —— 续写的 `unique_id` 必须与它一致
    // （见 latent_continuation.py: data["node"] != str(node_id) → ValueError）
    '1': {
      class_type: NANFENG_NODE,
      inputs,
    },
  };

  if (saveVideo) {
    // ⚠️ 关键：南风的输出必须接到输出节点，否则 ComfyUI 报 prompt_no_outputs
    //
    // 用 VHS_VideoCombine 而不是 SaveVideo：
    //   · SaveVideo 的 format 是 COMFY_DYNAMICCOMBO_V3，程序化构造复杂
    //   · VHS_VideoCombine 的 format 是固定枚举，且支持 audio 输入
    workflow['2'] = {
      class_type: 'VHS_VideoCombine',
      inputs: {
        images: ['1', NANFENG_OUTPUT.IMAGE],
        audio: ['1', NANFENG_OUTPUT.AUDIO],
        frame_rate: frameRate,
        loop_count: 0,
        filename_prefix: `jz_${jobId}`,
        format: 'video/h264-mp4',
        pingpong: false,
        save_output: true,
      },
    };
  }

  return { workflow, warnings };
}

/**
 * 构造续写任务描述（填进 `潜空间续写任务` 参数）。
 *
 * 南风的机制（latent_continuation.py）：
 *   1. 解析 JSON，校验 workflow/node/group/run/index 五个字段
 *   2. `data["node"]` 必须等于 ComfyUI 注入的 `unique_id`
 *   3. folder = "nanfeng_v15_context/" + sha256(json([workflow,node,group,run]))
 *   4. 每段采样完把 AV latent 存进该 folder 的 clip_<index>.safetensors
 *
 * 因为我们在 `buildWorkflow` 里固定节点 ID 为 '1'，
 * 所以 `node` 字段恒为 '1' —— 这是我们可以完全由后端掌控的关键。
 *
 * @param {object} opts
 * @param {string} opts.batchId   连续组标识（我们自己生成的 UUID）
 * @param {string} [opts.nodeId]  节点 ID，默认 '1'
 * @param {number} opts.index     第几段（1-based）
 * @param {string} [opts.group]   连续组，默认等于 batchId
 * @param {string} [opts.run]     本次运行标识
 * @returns {string} JSON 字符串
 */
export function continuationTask({ batchId, nodeId = '1', index, group, run }) {
  return JSON.stringify({
    workflow: String(batchId),
    node: String(nodeId),
    group: String(group ?? batchId),
    run: String(run ?? batchId),
    index: Number(index),
  });
}

/**
 * 把一组参数按"预设 + 覆盖"合并出最终快照。
 *
 * 合并顺序：schema 默认 → 预设 → 镜头覆盖
 *
 * @param {...Record<string, unknown>} layers 从低优先级到高优先级
 * @returns {Record<string, unknown>}
 */
export function mergeParams(...layers) {
  const base = schemaDefaults();
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const [k, v] of Object.entries(layer)) {
      if (k in base) base[k] = v;
    }
  }
  return base;
}
