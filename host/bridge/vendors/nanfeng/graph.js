/**
 * 南风 V15 工作流组装器 —— 参数快照 → ComfyUI `/prompt`。
 *
 * 南风节点 `NanFengH3MultiReferenceGeneratorV15` 接收 221 个参数，在 ComfyUI
 * 执行器内部用 GraphBuilder 动态展开成约 40 个节点。它的输出必须接输出节点
 * （`VHS_VideoCombine`），否则 ComfyUI 报 `prompt_no_outputs`。
 *
 * 本模块职责：
 *   1. 按 schema 强制类型（数值型 COMBO 必须是数字）
 *   2. 修正"默认值在本机必炸"的参数
 *   3. COMBO 合法性校验
 *   4. 组装成 ComfyUI `/prompt` 可接受的 JSON
 *
 * @module nanfeng/graph
 */
import { PARAMS, defaults as schemaDefaults } from './schema.js';

/** 南风主节点类型名 */
export const NANFENG_NODE = 'NanFengH3MultiReferenceGeneratorV15';

/** 南风节点的输出索引（对应 RETURN_TYPES = IMAGE/AUDIO/FLOAT/VIDEO/STRING） */
export const NANFENG_OUTPUT = Object.freeze({
  IMAGE: 0,
  AUDIO: 1,
  FPS: 2,
  VIDEO: 3,
  REPORT: 4,
});

/**
 * 最近一次 `coerceTypes` 遇到的非法值（供上层转成可读的 400）。
 *
 * ⚠️ 模块级数组意味着并发 build 会互相清空。`buildWorkflow` 是"清空后立刻读"，
 *    窗口极小但存在；新代码请用 `coerceTypesVerbose()` 的返回值。
 */
const invalid = [];
export function coerceIssues() { return [...invalid]; }

/** 按 schema 的数量强制转换参数值，并返回问题清单（不改模块状态） */
export function coerceTypesVerbose(snapshot) {
  const input = { ...snapshot };
  const out = { ...snapshot };
  const problems = [];

  for (const [key, value] of Object.entries(input)) {
    const def = PARAMS[key];
    if (!def) continue;

    /**
     * 数值强转必须**拒绝非法值**，不能变成 NaN / null 之后照原样提交 ——
     * `JSON.stringify(NaN)` 是 `null`，上游只会报一句极难懂的
     * "Value not in list / Required input is missing"。
     */
    if (def.type === 'INT') {
      if (value === '' || value == null) continue;
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = Math.round(n);
      else problems.push(`${key}=${JSON.stringify(value)} 不是整数`);
      continue;
    }
    if (def.type === 'FLOAT') {
      if (value === '' || value == null) continue;
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
      else problems.push(`${key}=${JSON.stringify(value)} 不是数字`);
      continue;
    }
    /**
     * BOOLEAN：只接受**明确的真值形态**。
     *
     * "未提供"不能写成 false —— 那会把预设里没写的开关静默关掉；
     * 但南风 221 个参数**全部是 required**，直接 delete 会让键消失，
     * ComfyUI 报 `required_input_missing`。所以未提供时显式写 schema 默认值
     * （与"显式 false"仍然可区分：只有 null/'' 走这条）。
     */
    if (def.type === 'BOOLEAN') {
      if (value === true || value === 'true' || value === 1 || value === '1') out[key] = true;
      else if (value === false || value === 'false' || value === 0 || value === '0') out[key] = false;
      else if (value === '' || value == null) out[key] = def.default === true;
      else problems.push(`${key}=${JSON.stringify(value)} 不是布尔值`);
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
  return { snapshot: out, problems };
}

/**
 * 按 schema 声明的类型强制转换参数值。
 *
 * 南风有一批**数值型 COMBO**（参考图最长边 / 尺寸倍数 / H3潜空间对齐 …）。
 * ComfyUI 校验做的是严格类型比较：字符串 `'32'` 不等于整数 `32`，
 * 任何经过 JSON 序列化或 HTML 表单的数值都会让整条生成失败。
 *
 * @param {Record<string, unknown>} snapshot
 * @returns {Record<string, unknown>}
 */
export function coerceTypes(snapshot) {
  const { snapshot: out, problems } = coerceTypesVerbose(snapshot);
  invalid.length = 0;
  invalid.push(...problems);
  return out;
}

/**
 * 参数修正规则 —— 把"上游默认值"改成"我们环境的正确值"。
 *
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
    // 第二个独立的注意力开关，与上面那个不是同一个参数：
    // 默认值「H3专用Sage加速」会调用 KJNodes 的 Sage Patch，同样需要 SageAttention。
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
 *  2) 目录驱动型参数 —— 选项来自 ComfyUI 的模型目录扫描，不是固定枚举。
 *     schema.js 里的 options 是导出那一刻的目录快照，用户后装的模型/LoRA
 *     都不在里面；拿它判定会让自定义模型被静默换回默认权重。
 *     这类参数必须交给 ComfyUI 自己校验（它返回 value_not_in_list，明确且不静默出错片）。
 */
const SKIP_SANITIZE = /^(图片|视频|音频)\d+$|^(模型|文本编码器|视频VAE|音频VAE|二采模型|H3潜空间放大模型|LoRA\d|TRT视频解码引擎|TRT视频编码引擎)$/;

/** 目录驱动 / 素材槽位型参数名（不做 COMBO 静态校验） */
export const DIRECTORY_DRIVEN_PARAMS = Object.freeze(
  Object.keys(PARAMS).filter((k) => SKIP_SANITIZE.test(k)),
);

/** 被环境修正处理过的键 —— 这些键的非法值必须报错，不能回退到"必崩的默认值" */
const FIXED_KEYS = new Set(PARAM_FIXES.map((f) => f.key));

/**
 * COMBO 值合法性检查。
 *
 * 南风的下拉选项来自 ComfyUI 的 `_live_combo()`；模型文件被删除/改名后，
 * 用户存的旧值会变成非法项，ComfyUI 报 `Value not in list`（信息很难懂）。
 *
 * ⚠️ 两条豁免：
 *  1) 素材槽位 —— 选项来自 `os.listdir(input/)`，schema 快照绝不能用来判非法
 *  2) 数值型 COMBO —— 选项是数字（[0.2, 0.3 …] / [32]），必须字符串化比较
 *
 * ⚠️ 显式传入的非法值**必须报错**，不能静默回退。
 *    对 `SageAttention` / `H3专用注意力` 这类"回退目标本身就是必崩值"的参数，
 *    静默回退等于把"填错一个枚举"升级成"整单崩"。
 *
 * @param {Record<string, unknown>} snapshot
 * @param {{ explicitKeys?: Set<string>|string[]|null }} [opts]
 * @returns {{ snapshot: Record<string, unknown>, warnings: string[], errors: string[] }}
 */
export function sanitize(snapshot, opts = {}) {
  const out = { ...snapshot };
  const warnings = [];
  const errors = [];
  const explicit = opts.explicitKeys instanceof Set
    ? opts.explicitKeys
    : new Set(Array.isArray(opts.explicitKeys) ? opts.explicitKeys : []);

  for (const [key, value] of Object.entries(out)) {
    const def = PARAMS[key];
    if (!def) continue;
    if (def.type !== 'COMBO') continue;
    if (SKIP_SANITIZE.test(key)) continue;
    const choices = def.options;
    if (!Array.isArray(choices) || choices.length === 0) continue;
    if (value === '' || value == null) continue;
    // 用字符串化比较，兼容「数值型 COMBO」
    const hit = choices.some((o) => String(o) === String(value));
    if (hit) continue;

    const list = choices.map((o) => String(o)).join(' / ');
    if (explicit.has(key) || FIXED_KEYS.has(key)) {
      // 显式传错 / 环境修正键：报错，不静默改值
      errors.push(
        `参数「${key}」的值 ${JSON.stringify(value)} 不在可选项里`
        + `（可选：${list}）。请改正后重新提交 —— 该参数不会自动回退。`,
      );
      continue;
    }
    warnings.push(`参数「${key}」的值 ${JSON.stringify(value)} 不在可选项里，已回退到默认值 ${JSON.stringify(def.default)}`);
    out[key] = def.default;
  }
  return { snapshot: out, warnings, errors };
}

/**
 * 开二采时，把「采样步数」拆成一采/二采两个真正生效的步数。
 *
 * 上游 `scheduler_steps = v81_first + v81_second if latent_upscale else 采样步数`：
 * 开了二采之后「采样步数」**连读都不读**。而所有预设写的都是「采样步数」，
 * 于是声称 8 步的 DMAD 学生实际跑 6+4=10 步、第一段只用 6 步 ——
 * 与蒸馏 LoRA 的训练设定错位，属分布外采样（不报错，只是画质悄悄变差）。
 *
 * ⚠️ 必须幂等：buildShotWorkflow 与 buildWorkflow 都会跑一次，
 *    所以用户显式指定任意一项时直接不进入拆分分支。
 *
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
 * @param {Set<string>|null} [availableNodes]
 *        当前 ComfyUI 实际注册的节点名集合。传了就据此**探测**可选加速，
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
 * 拉取 ComfyUI 当前注册的节点名集合，用于能力探测。缓存 60 秒。
 *
 * ⚠️ 失败必须区分两种语义，不能让调用方用一个 null 兜住：
 *   · `reachable: false` —— ComfyUI 不可达（网络/端口/超时）
 *   · `reachable: true, set` —— 拿到了节点表，缺失的节点才是"真没装"
 * 探测失败时**不得**跳过动态修正（那会让 `H3SLAAttention` 这类缺失节点
 * 在 GraphBuilder 展开期才以 `node not found` 失败，错误与原因完全无关）。
 *
 * @param {object} cfg
 * @param {(cfg?: object) => Promise<string>} resolveUrl
 * @returns {Promise<{set: Set<string>|null, reachable: boolean, reason: string}>}
 */
export async function probeAvailableNodes(cfg, resolveUrl) {
  const now = Date.now();
  if (NODE_CACHE.set && now - NODE_CACHE.at < NODE_CACHE_TTL_MS) {
    return { set: NODE_CACHE.set, reachable: true, reason: '' };
  }
  let base;
  try {
    base = await resolveUrl(cfg);
  } catch (e) {
    return { set: null, reachable: false, reason: `无法解析 ComfyUI 地址：${String(e?.message || e)}` };
  }
  let res;
  try {
    res = await fetch(`${base}/object_info`, { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    return {
      set: null,
      reachable: false,
      reason: `ComfyUI 不可达（${base}/object_info）：${String(e?.message || e)}`,
    };
  }
  if (!res.ok) {
    return {
      set: null,
      reachable: false,
      reason: `ComfyUI /object_info 返回 HTTP ${res.status}（${base}）`,
    };
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    return { set: null, reachable: false, reason: `ComfyUI /object_info 响应不是合法 JSON：${String(e?.message || e)}` };
  }
  const set = new Set(Object.keys(json));
  if (!set.size) {
    return { set: null, reachable: false, reason: 'ComfyUI /object_info 返回了空节点表' };
  }
  NODE_CACHE.set = set;
  NODE_CACHE.at = Date.now();
  return { set, reachable: true, reason: '' };
}

/**
 * 兼容包装：成功返回节点集合，失败返回 null。
 *
 * 新代码请用 `probeAvailableNodes()`，它把"不可达"与"节点缺失"分开。
 */
export async function fetchAvailableNodes(cfg, resolveUrl) {
  const r = await probeAvailableNodes(cfg, resolveUrl);
  return r.reachable ? r.set : null;
}

const NODE_CACHE = { set: null, at: 0 };
const NODE_CACHE_TTL_MS = 60_000;

/** 仅供测试重置 */
export function resetNodeCache() { NODE_CACHE.set = null; NODE_CACHE.at = 0; }

/** 生成三个互斥模式开关的取值 */
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
 * 顺序（不可交换）：
 *   1) 类型强制
 *   2) **COMBO 合法性校验**（显式非法值在此报错，不会先被 applyFixes 修正掉）
 *   3) 环境修正
 *   4) 再校验一次（修正后的值必须也合法）
 *
 * 旧顺序是"applyFixes 在前、sanitize 在后"，于是一个拼错的
 * `SageAttention: 'foo'` 会被 applyFixes 跳过（它在 explicit 里）、
 * 再被 sanitize 回退成 schema 默认 `'auto'` —— 正好是本机必崩的那个值。
 *
 * @param {object} opts
 * @param {Record<string, unknown>} opts.params 221 参数快照
 * @param {string} [opts.jobId] 用于产物文件名
 * @param {number} [opts.frameRate] 默认 24
 * @param {boolean} [opts.saveVideo] 默认 true
 * @param {Set<string>|string[]} [opts.explicitKeys] 调用方显式设置过的参数名
 * @param {Set<string>|null} [opts.availableNodes]
 * @param {boolean} [opts.probeDegraded] 能力探测失败（不可达）—— 转成 warning
 * @param {string} [opts.probeReason]
 * @returns {{ workflow: object, warnings: string[] }}
 */
export function buildWorkflow({
  params, jobId = 'jz', frameRate = 24, saveVideo = true, explicitKeys = null,
  availableNodes = null, probeDegraded = false, probeReason = '',
}) {
  const warnings = [];

  const explicit = explicitKeys instanceof Set
    ? explicitKeys
    : new Set(Array.isArray(explicitKeys) ? explicitKeys : []);

  // 1) 类型强制 —— 强转失败的值不能静默变成 null/NaN 提交上去
  const coerced = coerceTypesVerbose(params);
  if (coerced.problems.length) {
    throw new Error(`INVALID_PARAM_TYPE: ${coerced.problems.join('；')}`);
  }
  let snapshot = coerced.snapshot;

  // 2) COMBO 合法性（先于环境修正）—— 显式非法值必须报错，不允许回退成必崩默认值
  const san1 = sanitize(snapshot, { explicitKeys: explicit });
  if (san1.errors.length) {
    const err = new Error(`INVALID_PARAM_VALUE: ${san1.errors.join(' / ')}`);
    err.code = 'INVALID_PARAM_VALUE';
    throw err;
  }
  snapshot = san1.snapshot;
  warnings.push(...san1.warnings);

  // 3) 环境修正（SageAttention / TRT 引擎名 / 可选加速的能力探测）
  if (probeDegraded) {
    warnings.push(
      `ComfyUI 能力探测失败${probeReason ? `（${probeReason}）` : ''}：`
      + '动态节点修正已跳过，若本机缺 H3SLAAttention / BlockCacheT8 / DLSS / TRT VAE 节点，'
      + '会在展开图时报 node not found。请确认 ComfyUI 已启动后重试。',
    );
  }
  const fixed = applyFixes(snapshot, explicit, availableNodes);
  snapshot = fixed.snapshot;
  if (fixed.applied.length) warnings.push(...fixed.applied);

  // 4) 再校验一次 —— 修正后的值也必须合法（显式键在此同样报错）
  const san2 = sanitize(snapshot, { explicitKeys: explicit });
  if (san2.errors.length) {
    const err = new Error(`INVALID_PARAM_VALUE: ${san2.errors.join(' / ')}`);
    err.code = 'INVALID_PARAM_VALUE';
    throw err;
  }
  snapshot = san2.snapshot;
  warnings.push(...san2.warnings);

  // 参数的键必须与南风 INPUT_TYPES 完全一致，多余键会导致 ComfyUI 报错
  const inputs = {};
  for (const key of Object.keys(PARAMS)) {
    inputs[key] = snapshot[key];
  }

  const workflow = {
    // 节点 ID 固定为 '1' —— 续写的 `unique_id` 必须与它一致
    // （latent_continuation.py: data["node"] != str(node_id) → ValueError）
    '1': {
      class_type: NANFENG_NODE,
      inputs,
    },
  };

  if (saveVideo) {
    // 南风的输出必须接到输出节点，否则 ComfyUI 报 prompt_no_outputs。
    // 用 VHS_VideoCombine 而不是 SaveVideo：后者 format 是动态 combo，
    // 程序化构造麻烦；前者是固定枚举且支持 audio 输入。
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
 * 南风机制（latent_continuation.py）：解析 JSON，校验五个字段；
 * `node` 必须等于 ComfyUI 注入的 `unique_id`；
 * folder = `nanfeng_v15_context/` + sha256(json([workflow, node, group, run]))。
 * 我们把节点 ID 固定为 '1'，所以 `node` 恒为 '1'。
 *
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
 * 合并顺序：schema 默认 → 预设 → 镜头覆盖。
 *
 * ⚠️ 未知键必须**告警**，不能静默丢弃：拼错的字段名会让参数根本没进去，
 *    出片结果与用户意图不符且零提示。需要 warnings 请用 `mergeParamsVerbose`。
 *
 * @param {...Record<string, unknown>} layers 从低优先级到高优先级
 * @returns {Record<string, unknown>}
 */
export function mergeParams(...layers) {
  return mergeParamsVerbose(layers).params;
}

/**
 * 同 `mergeParams`，但把未知键收集出来。
 *
 * @param {Array<Record<string, unknown>>} layers
 * @returns {{ params: Record<string, unknown>, unknownKeys: Array<{key:string, layer:number}> }}
 */
export function mergeParamsVerbose(layers = []) {
  const base = schemaDefaults();
  const unknownKeys = [];
  layers.forEach((layer, layerIndex) => {
    if (!layer || typeof layer !== 'object') return;
    for (const [k, v] of Object.entries(layer)) {
      if (k in base) base[k] = v;
      else unknownKeys.push({ key: k, layer: layerIndex });
    }
  });
  return { params: base, unknownKeys };
}