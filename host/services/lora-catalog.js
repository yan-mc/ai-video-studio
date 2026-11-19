/**
 * H3 LoRA 分类目录 —— 单一真源。
 *
 * ============================================================================
 * 为什么需要这一层
 * ============================================================================
 *
 * 南风 V15 有 8 个 LoRA 槽（LoRA1..LoRA8），谁都能往里塞东西。
 * 但 H3 的 LoRA 生态不是"一堆可自由叠加的补丁"，而是**11 个互相约束的功能轴**：
 *
 *   · 加速蒸馏（turbo）—— 全局单选。两条同挂 = 两套互不相容的去噪计划
 *   · 运镜（camera）   —— 每镜单选。两条运镜会给相机两个矛盾目标
 *   · 画风（style）    —— 单选。风格是整体映射，不可加
 *   · 角色一致性（character）—— 单选。两个脸必崩
 *   · 音色（audio）    —— 单选。两条声线会串
 *   · 工具（utility）  —— 多数单选（改变输出格式）
 *   · 动作/物理（motion）—— 可多挂，但同向要衰减
 *   · 滑块（slider）   —— 可多挂，但同一轴只留一个；强度**有符号**
 *   · 画质（quality）  —— 可多挂，但极易过度锐化
 *   · 特效/编辑（vfx）  —— 可多挂（不同目标物）
 *
 * 不做这层约束的后果不是报错，而是"能出片但不对" —— 这正是本项目反复
 * 要消灭的失败模式。所以分类、互斥、强度策略全部**显式建模**，不靠用户自觉。
 *
 * ============================================================================
 * 目录约定（ComfyUI 侧）
 * ============================================================================
 *
 * ComfyUI 的 `folder_paths.recursive_search` 是 `os.walk(followlinks=True)`，
 * 子目录**会被递归扫描**，返回的名字是相对路径（`00_turbo/xxx.safetensors`）。
 * 所以子目录既能在界面上分组，又天然成为"机器可读的分类标签"。
 *
 *   models/loras/
 *   ├─ 00_turbo/          加速蒸馏（DMAD / Turbo / HyperFlow …）  单选
 *   ├─ 10_camera/         运镜                                   单选
 *   ├─ 20_motion/         动作 / 物理 / 表演                      可多挂
 *   ├─ 21_motion_slider/  动作类滑块（速度/幅度/重力）             可多挂，有符号
 *   ├─ 30_style/          画风 / 影调                             单选
 *   ├─ 31_look_slider/    影调类滑块（曝光/昼夜/焦点）             可多挂，有符号
 *   ├─ 32_quality/        画质 / 锐度 / 写实增强                   可多挂
 *   ├─ 40_character/      角色一致性 / 换脸 / 换人                 单选
 *   ├─ 50_audio/          音色 / 人声 / 口型                       单选
 *   ├─ 60_vfx/            特效 / 编辑 / 去人 / 换背景              可多挂
 *   ├─ 70_utility/        360 / VR / 转面 / 字幕 / 年龄            单选
 *   └─ 99_inbox/          未分类（前端标"未分类·请手动归类"）        可多挂
 *
 * 数字前缀保证文件系统排序稳定，前端不必额外维护排序表。
 *
 * @module lora-catalog
 */

/**
 * 分类定义。
 *
 * 字段说明：
 *   folder      目录名（ComfyUI 里的路径前缀）
 *   id          对内标识
 *   label       界面上显示的中文名
 *   mode        'single' 单选 / 'multi' 可多挂
 *   strength    默认与范围。signed=true 表示"0 = 不生效，正负是反方向"
 *   stackDecay  多挂时的逐条衰减系数（1 = 不衰减）
 *   why         为什么是这个 mode —— 这句话会直接显示给用户
 */
export const LORA_CATEGORIES = Object.freeze([
  {
    folder: '00_turbo',
    id: 'turbo',
    label: '加速蒸馏',
    mode: 'single',
    strength: { def: 1.0, min: 0.5, max: 1.2, step: 0.05 },
    stackDecay: 1,
    why: '每条蒸馏 LoRA 绑定一套 sigma 网格 + shift。叠两条 = 两套互不相容的去噪计划，'
      + '采样器无法同时满足。只能挂 1 条。',
  },
  {
    folder: '10_camera',
    id: 'camera',
    label: '运镜',
    mode: 'single',
    /**
     * 默认 0.8 而不是 0.9。
     *
     * 社区给的区间是 0.8–1.0，但"运镜 + 动作"是最常见的组合，
     * 两者都用 0.9/0.8 就超过 1.5 的连贯性阈值。运镜本身是"镜头怎么动"，
     * 0.8 已经足够明确，留出余量给动作类才是正确取舍。
     */
    strength: { def: 0.8, min: 0.4, max: 1.2, step: 0.05 },
    stackDecay: 1,
    why: '两条运镜会给相机两个矛盾的目标，结果是"既不环绕也不推近"，'
      + '且常伴随主体位移失控。每镜只挂 1 条。',
  },
  {
    folder: '20_motion',
    id: 'motion',
    label: '动作 / 物理',
    mode: 'multi',
    strength: { def: 0.7, min: 0.2, max: 1.0, step: 0.05 },
    stackDecay: 0.6,
    why: '动作类可以叠（例如武术 + 物理），但同向叠加会互相抢动态，'
      + '第 2 条起按 0.6 衰减。',
  },
  {
    folder: '21_motion_slider',
    id: 'motion_slider',
    label: '动作滑块',
    mode: 'multi',
    /**
     * 滑块的中性值是 0，但"选了却什么都不发生"是典型静默失败。
     * 所以 `defaultOnSelect` 给一个轻微正向初值（+0.5），
     * 一挂上就能看到方向，用户再自己调正负。手动设 0 仍然有效。
     */
    strength: { def: 0.5, min: -5, max: 5, step: 0.05 },
    stackDecay: 1,
    signed: true,
    defaultOnSelect: 0.5,
    why: '滑块是数值旋钮：0 = 完全不生效，正负对应相反方向（快↔慢、重力↔失重）。'
      + '不同轴可多挂，同一轴只留一个（否则相互抵消）。',
  },
  {
    folder: '30_style',
    id: 'style',
    label: '画风 / 影调',
    mode: 'single',
    strength: { def: 0.7, min: 0.4, max: 1.1, step: 0.05 },
    stackDecay: 1,
    why: '画风是整体美学映射，不是可加的补丁。两个画风会互相拉扯，'
      + '通常产出"两边都不像"的中间态。只能挂 1 条。',
  },
  {
    folder: '31_look_slider',
    id: 'look_slider',
    label: '影调滑块',
    mode: 'multi',
    strength: { def: 0.5, min: -5, max: 5, step: 0.05 },
    stackDecay: 1,
    signed: true,
    defaultOnSelect: 0.5,
    why: '曝光 / 昼夜 / 焦点 / 鲜艳度这类数值旋钮。不同轴可多挂。',
  },
  {
    folder: '32_quality',
    id: 'quality',
    label: '画质增强',
    mode: 'multi',
    strength: { def: 0.7, min: 0.2, max: 1.0, step: 0.05 },
    stackDecay: 0.6,
    why: '锐度 / 细节 / 写实增强可以叠，但极易过度锐化（噪点、塑料感）。'
      + '建议总强度 ≤0.9，第 2 条起按 0.6 衰减。',
  },
  {
    folder: '40_character',
    id: 'character',
    label: '角色一致性',
    mode: 'single',
    strength: { def: 0.9, min: 0.4, max: 1.0, step: 0.05 },
    stackDecay: 1,
    why: '两个身份先验会在同一帧里争夺同一张脸，面部与运动连贯性都会崩。'
      + '只能挂 1 条。多角色请用 Ref2VA 的多张参考图，不是多个角色 LoRA。',
  },
  {
    folder: '50_audio',
    id: 'audio',
    label: '音色 / 人声',
    mode: 'single',
    strength: { def: 0.75, min: 0.3, max: 0.9, step: 0.05 },
    stackDecay: 1,
    why: '两条声线会串音。另外：要保住声线参考时**不要挂加速 LoRA**，'
      + '改用 20–25 步 —— 4 步蒸馏会明显削弱音频表现。',
  },
  {
    folder: '60_vfx',
    id: 'vfx',
    label: '特效 / 编辑',
    mode: 'multi',
    strength: { def: 0.8, min: 0.4, max: 1.0, step: 0.05 },
    stackDecay: 0.8,
    why: '去人 / 换背景 / 粒子特效针对不同目标物，可叠。但都要写指令式触发词。',
  },
  {
    folder: '70_utility',
    id: 'utility',
    label: '工具',
    mode: 'single',
    strength: { def: 1.0, min: 0.5, max: 1.2, step: 0.05 },
    stackDecay: 1,
    why: '360 / VR / 转面 / 字幕这类会**改变输出格式**的工具，多数只能选一个。',
  },
  {
    folder: '99_inbox',
    id: 'inbox',
    label: '未分类',
    mode: 'multi',
    strength: { def: 0.7, min: 0, max: 1.2, step: 0.05 },
    stackDecay: 0.8,
    why: '还没归类的 LoRA。能跑，但强度与互斥关系未知 —— 建议放进对应子目录后重启 ComfyUI 刷新列表。',
  },
]);

/** folder → 分类 */
export const CATEGORY_BY_FOLDER = Object.freeze(
  Object.fromEntries(LORA_CATEGORIES.map((c) => [c.folder, c])),
);

/** id → 分类 */
export const CATEGORY_BY_ID = Object.freeze(
  Object.fromEntries(LORA_CATEGORIES.map((c) => [c.id, c])),
);

/**
 * 按文件名回退推断分类（当文件不在已知子目录里时用）。
 *
 * 顺序很重要：更具体的规则要排在更泛的前面。
 * 例如 `motion_slider` 的 `slider` 要先于 `motion` 判定，
 * `look_slider` 的 `exposure|daynight` 要先于 `quality`。
 */
const NAME_RULES = Object.freeze([
  { id: 'turbo', re: /turbo|acc(?:el)?|step|hyperflow|hyper.?flow|dmd|pdd|lightx2v|taomate|fasth3|vdn|distill|normflow/i },
  { id: 'motion_slider', re: /(?:motion|speed|accel|amplitude|gravity|kinetix).*slider|slider.*(?:motion|speed|amplitude|gravity)/i },
  { id: 'look_slider', re: /(?:exposure|daynight|day.?night|focus|vibrant|saturation|age).*slider|slider.*(?:exposure|focus|vibrant|age)/i },
  { id: 'camera', re: /camera|orbit|dolly|zoom|drone|handheld|shaky|bullet.?time|stabil|yunjing|headbob|turnaround|dutch|telephoto|crossview|orb360/i },
  { id: 'character', re: /character|faceswap|face.?swap|head.?swap|identity|swap|likeness|person.?remov/i },
  { id: 'audio', re: /voice|moan|audio|asmr|speech|whisper|accent|sound/i },
  { id: 'vfx', re: /vfx|edit|remov|replace|background|elemental|explosion|particle/i },
  { id: 'utility', re: /equirect|equi360|vr180|360|five.?view|subtitle|world|i2v|vbvr/i },
  { id: 'motion', re: /wushu|combat|fight|gunfu|motion|dance|bunny|physics|action|repair|prfight/i },
  { id: 'quality', re: /sharp|detail|realism|enhanc|clarity|micro|texture|hdr|icy/i },
  { id: 'style', re: /style|anime|film|cinematic|pixel|claymation|studio|vhs|ink|manga|sketch|ghibli|toon|noir|retro/i },
  { id: 'inbox', re: /slider/i },
]);

/** 从一个 ComfyUI 返回的 LoRA 名（可能是 `dir/file.safetensors`）取目录 */
export function folderOf(loraName) {
  const s = String(loraName ?? '').replace(/\\/g, '/');
  const i = s.lastIndexOf('/');
  return i > 0 ? s.slice(0, i) : '';
}

/** 取纯文件名（去掉目录） */
export function baseNameOf(loraName) {
  const s = String(loraName ?? '').replace(/\\/g, '/');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

/**
 * 转成 ComfyUI 期望的 LoRA 名字形态。
 *
 * ============================================================================
 * 为什么不能统一用正斜杠
 * ============================================================================
 *
 * ComfyUI 的 `folder_paths.recursive_search` 用 `os.path.relpath` 生成名字，
 * 在 **Windows 上返回反斜杠**：
 *   `00_turbo\dmad_minimax_h3_8step_full_critic_comfyui.safetensors`
 *
 * 而 `value_not_in_list` 校验是**严格字符串比较**，不做路径归一。
 * 我们若把 `00_turbo/xxx` 提交上去，即使文件真实存在也会被拒：
 *   `LoRA1: '00_turbo/dmad_...' not in [...]`
 *
 * 所以：内部比对一律用纯文件名（`baseNameOf`），
 * **提交时必须还原成 ComfyUI 原始返回的那一串**。
 *
 * 这里保留原始串（`classifyLora` 的入参本身就是 ComfyUI 返回的原样名字），
 * 这个函数只负责在"用户手填了正斜杠"时把分隔符改回反斜杠。
 */
export function toComfyLoraName(loraName, sep = '\\') {
  const s = String(loraName ?? '');
  return s.replace(/[\\/]+/g, sep);
}

/**
 * 判定一个 LoRA 属于哪一类。
 *
 * 优先级：① 已知子目录 ② 文件名正则 ③ 99_inbox
 *
 * @param {string} loraName  ComfyUI 返回的名字（可含 `dir/` 前缀）
 * @returns {{ category: object, source: 'folder'|'name'|'fallback', folder: string }}
 */
export function classifyLora(loraName) {
  const folder = folderOf(loraName);
  // ① 目录命中（含子目录深层，如 `00_turbo/dmad`）
  if (folder) {
    const top = folder.split('/')[0];
    const byFolder = CATEGORY_BY_FOLDER[top];
    if (byFolder) return { category: byFolder, source: 'folder', folder: top };
  }
  // ② 文件名正则
  const base = baseNameOf(loraName);
  for (const rule of NAME_RULES) {
    if (rule.re.test(base)) {
      return { category: CATEGORY_BY_ID[rule.id], source: 'name', folder: '' };
    }
  }
  // ③ 兜底
  return { category: CATEGORY_BY_ID.inbox, source: 'fallback', folder: '' };
}

/**
 * 把 ComfyUI 的 LoRA 文件列表整理成带分类的目录。
 *
 * @param {string[]} files
 * @returns {Array<{ name: string, base: string, folder: string, categoryId: string,
 *                   categoryLabel: string, mode: string, categorySource: string }>}
 */
export function catalogLoras(files) {
  return (Array.isArray(files) ? files : [])
    .filter((f) => typeof f === 'string' && f)
    .map((name) => {
      const { category, source, folder } = classifyLora(name);
      return {
        name,
        base: baseNameOf(name),
        folder,
        categoryId: category.id,
        categoryLabel: category.label,
        mode: category.mode,
        categorySource: source,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** 总强度软/硬阈值（社区共识：>1.5 动作连贯性开始崩，>1.8 基本不可用） */
export const STRENGTH_LIMITS = Object.freeze({ warn: 1.5, block: 1.8 });

/**
 * 校验一组用户想挂的 LoRA，返回"能挂什么 + 为什么"。
 *
 * ============================================================================
 * 为什么不直接全挂上去
 * ============================================================================
 *
 * 不约束的后果不是报错，而是**能出片但不对**：
 *   · 两个运镜 LoRA → 相机收到两个矛盾目标，既不环绕也不推近
 *   · 两个角色 LoRA → 同一张脸被两个身份先验争夺，面部与运动都崩
 *   · 加速 × 加速   → 两套 sigma 网格，采样器无法同时满足
 *   · 总强度 >1.5   → 动作连贯性开始崩（社区实测阈值）
 *
 * 所以这里做三件事：
 *   1. **单选类只保留一条**（后来的替换先来的，并说明替换了谁）
 *   2. **多挂类按 stackDecay 递减**（第 2 条起 × 0.6 之类）
 *   3. **总强度看门狗**（>1.5 警告，>1.8 直接剔除最弱的那条）
 *
 * 返回里每条都带 `appliedStrength`，前端可直接显示"你填 1.0，实际用 0.6"。
 *
 * ⚠️ `opts.availableFiles` 必须传 **ComfyUI 原始返回的名字列表**。
 *    条目会回填成 `name` 字段（保留原始分隔符），因为 ComfyUI 的
 *    `value_not_in_list` 是严格字符串比较、不做路径归一 ——
 *    在 Windows 上必须是反斜杠形态，否则装了也提交不上去。
 *
 * @param {Array<{name:string, strength?:number}>} requested
 * @param {{ maxSlots?: number, availableFiles?: string[] }} [opts]
 * @returns {{
 *   accepted: Array<object>,
 *   rejected: Array<{ name:string, reason:string }>,
 *   replaced: Array<{ name:string, by:string, category:string }>,
 *   degraded: Array<{ name:string, from:number, to:number, reason:string }>,
 *   totalStrength: number,
 *   warnings: string[],
 * }}
 */
export function solveLoraStack(requested, opts = {}) {
  const maxSlots = Number.isFinite(opts.maxSlots) ? opts.maxSlots : 8;
  const accepted = [];
  const rejected = [];
  const replaced = [];
  const degraded = [];
  const warnings = [];

  /** 纯文件名 → ComfyUI 原始名字（保留分隔符与子目录） */
  const canonicalByBase = new Map();
  for (const f of (Array.isArray(opts.availableFiles) ? opts.availableFiles : [])) {
    if (typeof f === 'string' && f) canonicalByBase.set(baseNameOf(f), f);
  }

  /**
   * 把任意形态的入参归一成 ComfyUI 认识的字符串。
   *
   * 用户可能给：`00_turbo/x.safetensors`（正斜杠）、`x.safetensors`（纯名）、
   * 或 ComfyUI 原始返回的 `00_turbo\x.safetensors`。
   * 统一策略：**按纯文件名去查 ComfyUI 的真实名字**，查不到才原样保留
   * （让 ComfyUI 明确报错，而不是我这里静默丢掉）。
   */
  const canonical = (raw) => {
    const b = baseNameOf(raw);
    return canonicalByBase.get(b) ?? String(raw);
  };

  const list = (Array.isArray(requested) ? requested : [])
    .map((x) => (typeof x === 'string' ? { name: x } : x))
    .filter((x) => x && typeof x.name === 'string' && x.name.trim())
    .map((x) => ({
      name: canonical(x.name.trim()),
      userStrength: Number.isFinite(Number(x.strength)) ? Number(x.strength) : null,
    }));

  /** 每个单选类当前占位者 */
  const singleOwner = new Map();
  /** 每个多选类已接受的条数（用来算衰减） */
  const multiCount = new Map();

  for (const item of list) {
    const { category } = classifyLora(item.name);

    /**
     * ⚠️ 文件必须真的在 ComfyUI 的 loras 目录里。
     *
     * 不检查的后果是**提交阶段才炸**：ComfyUI 的 `value_not_in_list` 校验是
     * 严格字符串比较，会返回 `LoRA2: '30_style/x.safetensors' not in [...]`，
     * 用户只看到一个文件名，完全看不出"是我少装了一个 LoRA"。
     *
     * 这里在**组装期**就拒掉，并说明"不在 loras 目录里"。
     * 只有 `availableFiles` 真的探测到了才做这个检查 ——
     * 探测失败（ComfyUI 不可达）时不能误杀，否则用户会以为 LoRA 全丢了。
     */
    if (canonicalByBase.size > 0 && !canonicalByBase.has(baseNameOf(item.name))) {
      rejected.push({
        name: item.name,
        reason: '不在 ComfyUI 的 loras 目录里（文件缺失或名字拼错），已跳过而不是提交一个不存在的文件',
      });
      continue;
    }

    // 同一个文件重复出现没有意义，只会翻倍强度
    if (accepted.some((a) => a.name === item.name)) {
      rejected.push({ name: item.name, reason: '重复出现，只保留一次' });
      continue;
    }

    // 单选类：替换先来的
    if (category.mode === 'single') {
      const prev = singleOwner.get(category.id);
      if (prev) {
        accepted.splice(accepted.indexOf(prev), 1);
        singleOwner.delete(category.id);
        replaced.push({ name: prev.name, by: item.name, category: category.label });
      }
    }

    // 槽位上限（南风只有 8 个）
    if (accepted.length >= maxSlots) {
      rejected.push({ name: item.name, reason: `LoRA 槽位已满（最多 ${maxSlots} 个）` });
      continue;
    }

    // 多选类：第 2 条起衰减
    const nth = multiCount.get(category.id) ?? 0;

    /**
     * ⚠️ 加速学生的强度**恒为 1.0，且不参与衰减、不接受用户覆盖**。
     *
     * 它是蒸馏后的**学生本体**，不是风格补丁。压到 0.7 等于把蒸馏预测
     * 和 base 预测做线性插值 —— 在 4–8 步这种极短轨迹上误差被放大，
     * 表现为竖条纹、色彩断层、画面抖动。
     *
     * 官方原话："the LoRA is the distilled student, not a style"。
     */
    const isAccel = category.id === 'turbo';
    let strength = isAccel
      ? 1.0
      : (item.userStrength != null
        ? item.userStrength
        : (nth === 0 ? category.strength.def : category.strength.def * (category.stackDecay ** nth)));

    if (isAccel && item.userStrength != null && Number(item.userStrength) !== 1) {
      degraded.push({
        name: item.name,
        from: item.userStrength,
        to: 1.0,
        reason: '加速蒸馏 LoRA 是学生本体，强度必须 1.0（压强度会让低步数去噪不足）',
      });
    }

    if (nth > 0 && category.stackDecay < 1 && item.userStrength == null && !isAccel) {
      strength = Number(strength.toFixed(2));
      degraded.push({
        name: item.name,
        from: category.strength.def,
        to: strength,
        reason: `同类第 ${nth + 1} 条，按 ×${category.stackDecay} 衰减`,
      });
    }

    // 夹到该类的合法区间
    if (!category.signed) {
      const clamped = Math.min(category.strength.max, Math.max(0, strength));
      if (clamped !== strength) {
        degraded.push({ name: item.name, from: strength, to: clamped, reason: `超出 ${category.label} 的合法区间` });
        strength = clamped;
      }
    }

    const entry = {
      name: item.name,
      base: baseNameOf(item.name),
      folder: folderOf(item.name),
      categoryId: category.id,
      categoryLabel: category.label,
      mode: category.mode,
      signed: Boolean(category.signed),
      userStrength: item.userStrength,
      appliedStrength: Number(strength.toFixed(3)),
      role: category.id === 'turbo' ? 'accelerator' : 'semantic',
    };
    accepted.push(entry);
    if (category.mode === 'single') singleOwner.set(category.id, entry);
    else multiCount.set(category.id, nth + 1);
  }

  // ---- 总强度看门狗 ----
  //
  // ⚠️ 加速学生**不计入总和**。它是学生本体（1.0 是"用这个学生"的意思，
  //    不是"叠加一个风格补丁"），把它算进去会让"DMAD + 一个动作 LoRA"
  //    就逼近上限，正常组合反而被误杀。
  const sumAbs = () => accepted
    .filter((a) => a.role !== 'accelerator')
    .reduce((s, a) => s + Math.abs(a.appliedStrength), 0);
  let total = sumAbs();

  if (total > STRENGTH_LIMITS.block) {
    // 硬阈值：按"最弱的先砍"从 semantic 里剔，直到降到 warn 以下
    while (total > STRENGTH_LIMITS.warn) {
      const candidates = accepted.filter((a) => a.role !== 'accelerator');
      if (!candidates.length) break;
      const weakest = candidates.reduce((m, a) => (Math.abs(a.appliedStrength) < Math.abs(m.appliedStrength) ? a : m));
      accepted.splice(accepted.indexOf(weakest), 1);
      if (completionsDeleteIfSingle(singleOwner, weakest)) singleOwner.delete(weakest.categoryId);
      rejected.push({
        name: weakest.name,
        reason: `总强度 ${total.toFixed(2)} 超过硬上限 ${STRENGTH_LIMITS.block}，`
          + '已剔除最弱的一条。动作连贯性会崩，请减少同时挂载的 LoRA。',
      });
      total = sumAbs();
    }
  } else if (total > STRENGTH_LIMITS.warn) {
    warnings.push(
      `总强度 ${total.toFixed(2)} 超过建议上限 ${STRENGTH_LIMITS.warn} —— `
      + '社区实测超过这个值后动作连贯性会明显变差，建议减少同时挂载的数量或降低强度。',
    );
  }

  // ---- 已知硬冲突提示 ----
  const has = (id) => accepted.some((a) => a.categoryId === id);
  if (has('turbo') && has('audio')) {
    warnings.push(
      '同时挂了「加速蒸馏」与「音色」：4–8 步的蒸馏会明显削弱声线参考。'
      + '要保住音色，建议关掉加速、改用 20–25 步。',
    );
  }
  if (has('turbo') && has('character')) {
    warnings.push(
      '同时挂了「加速蒸馏」与「角色一致性」：低步数下参考图/身份的收敛会变差。'
      + '角色要保得住，建议提高步数或降低加速强度。',
    );
  }
  if (has('style') && has('character')) {
    warnings.push(
      '同时挂了「画风」与「角色一致性」：风格会把脸往画风拉，容易产出'
      + '"两边都不像"的混合体。建议只留一个，或把画风降到 0.4 以下。',
    );
  }

  return { accepted, rejected, replaced, degraded, totalStrength: Number(total.toFixed(3)), warnings };
}

/** 被剔除的条目若是某个单选类的占位者，释放该占位 */
function completionsDeleteIfSingle(singleOwner, entry) {
  const owner = singleOwner.get(entry.categoryId);
  return owner && owner.name === entry.name;
}
