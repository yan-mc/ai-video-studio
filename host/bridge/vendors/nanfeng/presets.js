/**
 * 南风预设体系 —— 四层合并（schema 默认 → 内置预设 → 项目/镜头 overrides → 调用方 extra）。
 *
 * ============================================================================
 * 为什么需要预设
 * ============================================================================
 *
 * 南风节点有 221 个参数。让人逐个调是不现实的，让 DSH Agent 每次传 221 个
 * 字段更是灾难。预设把它们压缩成「档位 + 少量覆盖」。
 *
 * ============================================================================
 * 三层结构
 * ============================================================================
 *
 *   ① 内置预设（本文件）：随插件分发，只读，覆盖 90% 场景
 *   ② 项目预设：<dataDir>/projects/<id>/presets/*.json，用户可改
 *   ③ 镜头覆盖：镜头卡里的 nanfeng.overrides，单镜生效
 *
 * 合并顺序：schema 默认 → 内置预设 → 项目预设 → 镜头覆盖
 *
 * @module nanfeng/presets
 */

/**
 * 内置预设。
 *
 * 设计原则：只覆盖**与档位强相关**的参数，其余走 schema 默认。
 * 这样南风节点升级（新增参数）时，预设不需要跟着改。
 */
export const BUILTIN_PRESETS = Object.freeze({
  /**
   * 草稿 —— 最快出片，用于试提示词、试走位。
   * 480p / 4 步 / 无二采。
   */
  draft: {
    label: '草稿（480p / 4步）',
    desc: '最快，约 2 分钟。试提示词和走位用，不追求画质。',
    params: {
      百万像素: 0.4,
      采样步数: 4,
      采样器: 'lcm',
      调度器: 'simple',
      启用H3潜空间放大二采: false,
      启用实时预览: false,
    },
  },

  /**
   * 标准 —— 日常主力。480p 一采 + 二采放大到 0.8MP。
   * 阶段 1 实测：约 5 分钟。
   */
  standard: {
    label: '标准（480p→0.8MP 二采）',
    desc: '日常主力，约 5 分钟。一采 6 步后放大二采 4 步。',
    params: {
      百万像素: 0.4,
      采样步数: 10,
      采样器: 'lcm',
      调度器: 'simple',
      启用H3潜空间放大二采: true,
      H3一采步数: 6,
      H3二采步数: 4,
      H3潜空间目标百万像素: 0.8,
      H3潜空间对齐: 2,
      H3潜空间精度: 'fp16',
      启用实时预览: false,
    },
  },

  /**
   * 高质量 —— 480p 一采 + 二采放大到 1.2MP。
   * 阶段 1 实测：1472×832，约 8.5 分钟。
   */
  quality: {
    label: '高质量（480p→1.2MP 二采）',
    desc: '成片用，约 8.5 分钟。二采输出 1472×832。',
    params: {
      百万像素: 0.4,
      采样步数: 10,
      采样器: 'lcm',
      调度器: 'simple',
      启用H3潜空间放大二采: true,
      H3一采步数: 6,
      H3二采步数: 4,
      H3潜空间目标百万像素: 1.2,
      H3潜空间对齐: 2,
      H3潜空间精度: 'fp16',
      启用实时预览: false,
    },
  },

  /**
   * 高质量+预览 —— 同 quality，但开启实时预览（调试用）。
   */
  'quality-preview': {
    label: '高质量 + 实时预览',
    desc: '同高质量，额外开启采样过程预览。调试构图时用，会略慢。',
    params: {
      百万像素: 0.4,
      采样步数: 10,
      采样器: 'lcm',
      调度器: 'simple',
      启用H3潜空间放大二采: true,
      H3一采步数: 6,
      H3二采步数: 4,
      H3潜空间目标百万像素: 1.2,
      H3潜空间对齐: 2,
      H3潜空间精度: 'fp16',
      启用实时预览: true,
      实时预览最长边: 512,
      实时预览帧数: 12,
      实时预览帧率: 8,
      实时预览JPEG质量: 75,
    },
  },

  /**
   * 续写段 —— 配合 continuation 批次使用。
   * 关键：启用潜空间续写 + context_length。
   */
  continuation: {
    label: '续写段（480p / 4步）',
    desc: '连续组中的单段。自动读取上一段的 AV latent。',
    params: {
      百万像素: 0.4,
      采样步数: 4,
      采样器: 'lcm',
      调度器: 'simple',
      启用H3潜空间放大二采: false,
      启用潜空间续写: true,
      context_length: '22',
      audio_context_length: 24,
      启用实时预览: false,
    },
  },

  /**
   * 续写段 + 二采 —— 续写但要高清。
   *
   * ⚠️ 上游硬约束（h3_generator.py:1322-1323）：
   *     「V15 潜空间续写要求前后采样画布相同，请关闭潜空间放大二采」
   *    启用潜空间续写 与 启用H3潜空间放大二采 **互斥**，同时开会直接抛错。
   *
   * 所以这个预设不能真的开二采 —— 它历史上开着，导致「用续写+高清预设
   * 跑续写批次，每一段都失败」。现在改为：续写为主，画质靠一采参数提。
   */
  'continuation-quality': {
    label: '续写段 + 高画质一采',
    desc: '连续组中的单段。续写模式不能开潜空间二采（上游硬互斥），'
      + '所以画质靠把一采面积和步数提上去。',
    params: {
      // 续写要求前后画布一致，一采面积就是最终面积，适度抬高
      百万像素: 0.5,
      采样步数: 10,
      采样器: 'lcm',
      调度器: 'simple',
      // 必须关：与续写互斥
      启用H3潜空间放大二采: false,
      启用潜空间续写: true,
      context_length: '22',
      audio_context_length: 24,
      启用续写音频精修: true,
      启用实时预览: false,
    },
  },

  /**
   * 低显存 —— 12GB 的保守配置。
   * 关闭所有加速补丁，开启运行时预留显存。
   *
   * ⚠️ 注意：`分块处理（节约显存）` 目前的选项只有「关闭」
   *    （上游没实现其它档位），所以这里不设它，只调预留显存。
   */
  'low-vram': {
    label: '低显存（12GB 保守）',
    desc: '关闭所有加速补丁，加大运行时预留显存。最慢但最稳。',
    params: {
      百万像素: 0.3,
      采样步数: 4,
      采样器: 'lcm',
      调度器: 'simple',
      启用H3潜空间放大二采: false,
      启用运行时预留显存: true,
      运行时预留显存GB: 2.0,
      启用实时预览: false,
    },
  },
});

/**
 * V8.1 完整 Sigma 序列预设。
 *
 * ============================================================================
 * 这是什么
 * ============================================================================
 *
 * `H3完整Sigma序列` 用于**潜空间放大二采**时手动指定整条采样轨迹。
 * 值的个数必须 = 一采步数 + 二采步数 + 1，必须严格递减，且以 0 收尾。
 *
 * ============================================================================
 * 标准 8 步网格是怎么来的
 * ============================================================================
 *
 * 复刻 ComfyUI `simple` scheduler + shift=12：
 *
 *   sigma(t) = shift * t / (1 + (shift-1) * t)，t 从 1 线性降到 0
 *
 * 8 步得到：
 *   1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579, 0
 *
 * 末值不是 0.42 而是直接被压到 0 —— 这就是"标准网格"的结尾。
 *
 * ============================================================================
 * 尾部加密版为什么更有用
 * ============================================================================
 *
 * 在 0.631579 → 0 之间插 0.42、0.18 两档，等于在**低 sigma 段**多给模型
 * 两次精修机会。低 sigma 决定细节与噪点纹理，所以典型效果是：
 *   · 细节更实（尤其是布料纹理、发丝）
 *   · 暗部噪点更干净
 *
 * 代价是每段多 2 步的时间。
 */
export const SIGMA_PRESETS = Object.freeze({
  /** 自动：留空，由 ComfyUI 按 simple/shift12 生成（与 6+4 步匹配） */
  auto: { label: '自动（simple/shift12）', value: '' },

  /** 尾部加密 10 步（6 一采 + 4 二采）—— 社区常用的"8.1 完整 Sigma" */
  'tail-dense-10': {
    label: '尾部加密 10 步（6+4，推荐）',
    value: '1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579, 0.42, 0.18, 0',
  },

  /** 标准 10 步（不加密）—— 想看"加密到底带来多少差异"时对照用 */
  'plain-10': {
    label: '标准 10 步（不加密）',
    value: '1, 0.990826, 0.979592, 0.965517, 0.947368, 0.923077, 0.888889, 0.837209, 0.75, 0.571429, 0',
  },

  /**
   * 尾部强加密 11 步（7 一采 + 3 二采）—— 追求极致细节。
   *
   * ⚠️ 值的个数必须 = 一采 + 二采 + 1。这条是 12 个值，
   *    所以配套步数必须是 7+4 或 8+3，**不能**用默认的 6+4。
   */
  'tail-heavier-12': {
    label: '尾部强加密 12 值（配 8+3 或 7+4 步）',
    value: '1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579, 0.52, 0.42, 0.18, 0',
    // 用这条序列时必须同时改步数，否则个数校验不过
    requiredSteps: { first: 8, second: 3 },
    warning: '这条序列有 12 个值，必须把「H3一采步数 + H3二采步数」调到 11（如 8+3 或 7+4），否则会报个数不符。',
  },
});

/**
 * 校验一条完整 Sigma 序列是否合法。
 *
 * 规则（对照 vendor/nanfeng/h3_generator.py 的 _parse_manual_sigmas
 * 与 V8.1 的个数校验）：
 *   1. 至少 2 个值
 *   2. 全部为有限非负数
 *   3. **严格**从高到低（不能重复、不能回升）
 *   4. 末值必须是 0
 *   5. 开二采时，个数必须 = 一采步数 + 二采步数 + 1
 *
 * @param {string} text
 * @param {{ firstSteps?: number, secondSteps?: number, latentUpscale?: boolean }} [opts]
 * @returns {{ ok: boolean, values: number[], errors: string[] }}
 */
export function validateSigmaSequence(text, opts = {}) {
  const errors = [];
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: true, values: [], errors: [] };   // 空 = 自动

  const values = (raw.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g) ?? []).map(Number);

  if (values.length < 2) {
    errors.push('至少需要 2 个数值，例如：1, 0.8, 0');
    return { ok: false, values, errors };
  }
  if (values.some((v) => !Number.isFinite(v) || v < 0)) {
    errors.push('只能填有限的非负数');
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] >= values[i - 1]) {
      errors.push(`必须严格从高到低排列：第 ${i} 个值 ${values[i]} 不小于前一个 ${values[i - 1]}`);
      break;
    }
  }
  if (Math.abs(values[values.length - 1]) > 1e-8) {
    errors.push('最后一个值必须是 0');
  }

  // 个数校验（只在这个序列真的会被用到时才检查）
  if (opts.latentUpscale) {
    const first = Number(opts.firstSteps ?? 6);
    const second = Number(opts.secondSteps ?? 4);
    const expected = first + second + 1;
    if (values.length !== expected) {
      errors.push(
        `开潜空间二采时，值的个数必须 = 一采步数 + 二采步数 + 1 = ${first} + ${second} + 1 = ${expected}，`
        + `当前 ${values.length} 个`,
      );
    }
  }

  return { ok: errors.length === 0, values, errors };
}

/** 默认预设 id */
export const DEFAULT_PRESET = 'standard';

/**
 * 取内置预设的参数部分。
 *
 * ⚠️ 未知预设 id 必须**抛错**，不能返回 `{ params: {} }`。
 *
 * 旧行为是静默给空参数层 —— 用户/Agent 传了一个拼错的 preset（例如
 * `P12-draft` 之于 `draft`），系统会用"没有任何预设覆盖"的默认值跑一次
 * 与意图无关的生成：不报错、不警告，出来的片子参数全错。
 *
 * @param {string} id
 * @returns {{ params: Record<string, unknown>, meta: { id: string, label: string, desc: string } | null }}
 * @throws {Error} UNKNOWN_PRESET
 */
export function builtinPreset(id) {
  const key = String(id ?? '').trim();
  if (!key) return { params: {}, meta: null };      // 空 = 不套预设，是合法语义
  const p = BUILTIN_PRESETS[key];
  if (!p) {
    throw new Error(
      `UNKNOWN_PRESET: 没有名为 ${JSON.stringify(key)} 的内置预设。`
      + `可用：${Object.keys(BUILTIN_PRESETS).join(' / ')}`,
    );
  }
  return {
    params: { ...p.params },
    meta: { id: key, label: p.label, desc: p.desc },
  };
}

/**
 * 列出所有内置预设（给前端下拉用）。
 */
export function listBuiltinPresets() {
  return Object.entries(BUILTIN_PRESETS).map(([id, p]) => ({
    id,
    label: p.label,
    desc: p.desc,
    isDefault: id === DEFAULT_PRESET,
  }));
}

/**
 * 解析镜头卡的预设引用。
 *
 * 支持三种写法：
 *   presets: 'quality'                                    → 直接用内置
 *   presets: { inherit: 'quality', overrides: {...} }     → 继承 + 覆盖
 *   presets: { chain: ['quality', 'low-vram'] }           → 依次叠加
 *
 * @param {string|object|undefined} spec
 * @returns {{ presetIds: string[], overrides: Record<string, unknown> }}
 */
export function parsePresetSpec(spec) {
  if (!spec) return { presetIds: [DEFAULT_PRESET], overrides: {} };
  if (typeof spec === 'string') return { presetIds: [spec], overrides: {} };

  const presetIds = [];
  if (Array.isArray(spec.chain)) {
    presetIds.push(...spec.chain.map(String));
  } else if (spec.inherit) {
    presetIds.push(String(spec.inherit));
  } else {
    presetIds.push(DEFAULT_PRESET);
  }
  return {
    presetIds,
    overrides: spec.overrides && typeof spec.overrides === 'object' ? spec.overrides : {},
  };
}

/**
 * 合并多层预设 + 覆盖，得到参数层列表（供 graph.mergeParams 使用）。
 *
 * @param {object} opts
 * @param {string|object} [opts.shotSpec]     镜头卡的 nanfeng.presets
 * @param {Record<string, unknown>} [opts.projectPreset]  项目级预设参数
 * @param {Record<string, unknown>} [opts.extra]          额外覆盖（如模式、素材）
 * @returns {{ layers: Record<string, unknown>[], meta: { presetIds: string[] } }}
 */
export function resolvePresetLayers({ shotSpec, projectPreset, extra } = {}) {
  const { presetIds, overrides } = parsePresetSpec(shotSpec);
  const layers = [];

  // 内置预设按 chain 顺序叠加
  for (const id of presetIds) {
    const { params } = builtinPreset(id);
    layers.push(params);
  }
  // 项目级预设
  if (projectPreset && typeof projectPreset === 'object') layers.push(projectPreset);
  // 镜头覆盖
  if (Object.keys(overrides).length) layers.push(overrides);
  // 额外（模式、素材等，最高优先级）
  if (extra && typeof extra === 'object') layers.push(extra);

  return { layers, meta: { presetIds } };
}
