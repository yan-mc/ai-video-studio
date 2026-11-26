/**
 * H3-**Image** LoRA 目录与求解 —— 与视频那套**刻意分开**。
 *
 * ============================================================================
 * 为什么不能复用 `lora-catalog.js`
 * ============================================================================
 *
 * 视频那套是围绕**南风 V15 的 8 个槽位**建的，11 个功能轴里有 4 个在图像上
 * 根本不存在：
 *
 *   · `00_turbo`  加速蒸馏 —— H3-Image 的采样步数由 checkpoint 的 PDD 头网格
 *                 决定（`pdd_steps: 6` 写死在 safetensors 元数据里），
 *                 **Civitai 上图像 LoRA 的加速类数量 = 0**。硬套视频的分类
 *                 会让用户以为"能挂个 turbo 变快"，结果只会把 6 步蒸馏搞崩。
 *   · `10_camera` 运镜 —— 单张静图没有运镜。
 *   · `20_motion` 动作 —— 同上。
 *   · `50_audio`  音色 —— H3-Image 没有音频流（`MiniMaxH3ImageModel` 是
 *                 `MiniMaxH3Model` 去掉 audio stream 的子类）。
 *
 * 所以这里只保留**图像真的有的 5 个轴**：画风 / 画质细节 / 角色 / 滑块 / 概念。
 *
 * ============================================================================
 * 目录约定（ComfyUI 侧）
 * ============================================================================
 *
 * ComfyUI 的 `folder_paths.recursive_search` 递归扫描子目录，返回的名字是
 * 相对路径（Windows 用反斜杠）。所以子目录**既能在界面上分组，又天然是
 * 机器可读的分类标签** —— 这也是唯一能把"图像 LoRA"和"视频 LoRA"
 * 分开的可靠办法（两者键集完全相同，光看文件名分不出来）。
 *
 *   models/loras/
 *   ├─ 00_turbo/ … 99_inbox/      ← 现有：H3 视频（不要动）
 *   └─ h3img/                     ← 新增：H3-Image 专用，**只有这个前缀下的文件
 *      ├─ 30_style/                画风（单选）
 *      ├─ 32_quality/              画质 / 细节 / 锐度（可多挂，衰减）
 *      ├─ 40_character/            角色 / 换脸（单选）
 *      ├─ 50_slider/               滑块（有符号：0 = 不生效）
 *      ├─ 60_concept/              概念 / 服装 / 材质（可多挂）
 *      └─ 99_inbox/                未分类（标"请手动归类"）
 *
 * ============================================================================
 * 强度策略（比视频简单，但有两处必须显式建模）
 * ============================================================================
 *
 *   · 画风/角色 单选：两条画风 = 风格互相拉扯，出"两头不到岸"的混合体；
 *     两个角色 = 同一张脸被两个身份先验争夺。
 *   · 总强度看门狗：ComfyUI 链式叠加是**加法**，两个 1.0 叠起来 >1 会过曝。
 *     社区实测 >1.5 开始崩，>1.8 基本不可用 —— 与视频共用同一组阈值常量。
 *   · **图像特有的硬冲突**：画风 × 角色。画风会把脸往风格方向拉，
 *     有参考图（角色卡）时尤其明显 → 必须警告。
 *
 * @module h3-image-lora
 */
import { baseNameOf, folderOf, STRENGTH_LIMITS } from './lora-catalog.js';

/** H3-Image LoRA 的根目录前缀 —— 只有这个前缀之下的文件才会出现在图像页 */
export const IMAGE_LORA_ROOT = 'h3img';

/**
 * 图像 LoRA 分类定义。
 *
 * 字段含义与 `lora-catalog.js` 一致（folder / id / label / mode / strength /
 * stackDecay / signed / why），方便前端复用同一个面板组件。
 */
export const IMAGE_LORA_CATEGORIES = Object.freeze([
  {
    folder: `${IMAGE_LORA_ROOT}/30_style`,
    id: 'img_style',
    label: '画风',
    mode: 'single',
    strength: { def: 0.8, min: 0.3, max: 1.2, step: 0.05 },
    stackDecay: 1,
    why: '两条画风会互相拉扯，产出"既不 A 也不 B"的混合体。只挂 1 条；'
      + '换风格请换 LoRA，不要叠。',
  },
  {
    folder: `${IMAGE_LORA_ROOT}/32_quality`,
    id: 'img_quality',
    label: '画质 / 细节',
    mode: 'multi',
    strength: { def: 0.6, min: 0.2, max: 1.0, step: 0.05 },
    stackDecay: 0.6,
    why: '锐度 / 头发 / 皮肤这类可以叠（各管一件事），但第 2 条起按 0.6 衰减 —— '
      + '叠加会过度锐化，出现"塑料感"与边缘光晕。',
  },
  {
    folder: `${IMAGE_LORA_ROOT}/40_character`,
    id: 'img_character',
    label: '角色 / 换脸',
    mode: 'single',
    strength: { def: 0.85, min: 0.4, max: 1.2, step: 0.05 },
    stackDecay: 1,
    why: '同一张脸被两个身份先验争夺 → 面部崩坏。只挂 1 条；'
      + '要和画风同用时把画风压到 0.4 以下。',
  },
  {
    folder: `${IMAGE_LORA_ROOT}/50_slider`,
    id: 'img_slider',
    label: '滑块',
    mode: 'multi',
    strength: { def: 0.5, min: -5, max: 5, step: 0.05 },
    stackDecay: 1,
    signed: true,
    defaultOnSelect: 0.5,
    why: '数值旋钮：0 = 完全不生效（典型静默失败），正负是相反方向。'
      + '不同轴可多挂，同一轴只留一个（否则互相抵消）。',
  },
  {
    folder: `${IMAGE_LORA_ROOT}/60_concept`,
    id: 'img_concept',
    label: '概念 / 服装 / 材质',
    mode: 'multi',
    strength: { def: 0.7, min: 0.2, max: 1.0, step: 0.05 },
    stackDecay: 0.8,
    why: '服装、材质、道具这类针对不同目标物，可叠。都要写触发词。',
  },
  {
    folder: `${IMAGE_LORA_ROOT}/99_inbox`,
    id: 'img_inbox',
    label: '未分类',
    mode: 'multi',
    strength: { def: 0.7, min: 0, max: 1.2, step: 0.05 },
    stackDecay: 0.8,
    why: '还没归类的 LoRA。能跑，但强度与互斥关系未知 —— '
      + '建议移进对应子目录后重启 ComfyUI 刷新列表。',
  },
]);

/** folder → 分类 */
export const IMAGE_CATEGORY_BY_FOLDER = Object.freeze(
  Object.fromEntries(IMAGE_LORA_CATEGORIES.map((c) => [c.folder, c])),
);

/** id → 分类 */
export const IMAGE_CATEGORY_BY_ID = Object.freeze(
  Object.fromEntries(IMAGE_LORA_CATEGORIES.map((c) => [c.id, c])),
);

/**
 * 文件名回退推断（用户没按目录放时用）。
 *
 * 顺序很重要：**更具体的排前面**。
 *   · `slider` 必须先于 `style`（`anime_style_slider` 是滑块不是画风）
 *   · `hair|skin|sharp|detail` 先于 `style`
 */
const IMAGE_NAME_RULES = Object.freeze([
  { id: 'img_slider', re: /slider|_sl[0-9]|weight[-_]?slider|control[-_]?net/i },
  { id: 'img_quality', re: /sh4rp|sharp|detail|hdr|ha8ir|hair(?![-_ ]?style)|skin|texture[-_]?enh|denoise|upscal|film[-_]?grain|anti[-_]?artifact/i },
  { id: 'img_character', re: /character|face[-_]?swap|faceswap|persona|identity|\boc\b|_char\b|\bchara\b/i },
  { id: 'img_style', re: /style|anime|cel[-_]?shad|graphic[-_]?novel|manga|painting|illust|artwork|cinematic|photo|film|kodachrome|retro|midjourney|realis|realism|toon|pixel/i },
  { id: 'img_concept', re: /outfit|costume|cloth|uniform|armor|armour|material|weapon|camo|bdu|fantasy|concept/i },
]);

/**
 * 是否属于"图像 LoRA"（在 `h3img/` 前缀之下）。
 *
 * 这是**唯一的准入判据**。不要把 `baseModel` 之类的元数据当判据 ——
 * ComfyUI 的 `/object_info` 只给文件名，不给底座信息；
 * 而图像/视频两侧的 LoRA 键集完全同构，靠文件名也分不出来。
 * 所以只能靠**目录约定**：放进 `h3img/` 就是给图像用的。
 */
export function isImageLora(loraName) {
  const folder = folderOf(loraName).replace(/\\/g, '/');
  return folder === IMAGE_LORA_ROOT || folder.startsWith(`${IMAGE_LORA_ROOT}/`);
}

/** 按目录 / 文件名归类；不认识就进 inbox */
export function classifyImageLora(loraName) {
  const folder = folderOf(loraName).replace(/\\/g, '/');
  if (folder) {
    // 先精确匹配完整子目录，再退到只剩一级（`h3img/30_style/deep/x` → `h3img/30_style`）
    const parts = folder.split('/');
    for (let take = parts.length; take >= 2; take -= 1) {
      const candidate = parts.slice(0, take).join('/');
      const byFolder = IMAGE_CATEGORY_BY_FOLDER[candidate];
      if (byFolder) return { category: byFolder, source: 'folder', folder: candidate };
    }
  }
  const base = baseNameOf(loraName);
  for (const rule of IMAGE_NAME_RULES) {
    if (rule.re.test(base)) {
      return { category: IMAGE_CATEGORY_BY_ID[rule.id], source: 'name', folder: '' };
    }
  }
  return { category: IMAGE_CATEGORY_BY_ID.img_inbox, source: 'fallback', folder: '' };
}

/**
 * 把 ComfyUI 的 LoRA 文件列表整理成**只含图像 LoRA** 的目录。
 *
 * @param {string[]} files `listModelFiles().loras`（含子目录前缀、Windows 反斜杠）
 * @returns {Array<{name:string, base:string, folder:string, categoryId:string,
 *                  categoryLabel:string, mode:string, categorySource:string,
 *                  strength:object, signed?:boolean, why:string}>}
 */
export function catalogImageLoras(files) {
  return (Array.isArray(files) ? files : [])
    .filter((f) => typeof f === 'string' && f && isImageLora(f))
    .map((name) => {
      const { category, source, folder } = classifyImageLora(name);
      return {
        name,
        base: baseNameOf(name),
        folder,
        categoryId: category.id,
        categoryLabel: category.label,
        mode: category.mode,
        categorySource: source,
        strength: category.strength,
        ...(category.signed ? { signed: true, defaultOnSelect: category.defaultOnSelect } : {}),
        why: category.why,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/**
 * 校验一组用户想挂的**图像** LoRA，返回"能挂什么 + 为什么"。
 *
 * 与视频版 `solveLoraStack` 的差异：
 *   · 没有 accelerator 角色（图像生态里加速类 = 0，见文件头）；
 *   · 增加**画风 × 角色**这条图像特有的硬冲突；
 *   · 槽位上限 6（模型链式叠加）而不是南风的 8。
 *
 * @param {Array<{name:string, strength?:number}>} requested
 * @param {{maxSlots?:number, availableFiles?:string[], hasRefImages?:boolean}} [opts]
 * @returns {{accepted:Array<object>, rejected:Array<{name:string,reason:string}>,
 *            replaced:Array<{name:string,by:string,category:string}>,
 *            degraded:Array<{name:string,from:number,to:number,reason:string}>,
 *            totalStrength:number, warnings:string[]}}
 */
export function solveImageLoraStack(requested, opts = {}) {
  const maxSlots = Number.isFinite(opts.maxSlots) ? Math.floor(opts.maxSlots) : 6;
  const accepted = [];
  const rejected = [];
  const replaced = [];
  const degraded = [];
  const warnings = [];

  /** 纯文件名 → ComfyUI 原名字（保留分隔符与子目录） */
  const canonicalByBase = new Map();
  for (const f of (Array.isArray(opts.availableFiles) ? opts.availableFiles : [])) {
    if (typeof f === 'string' && f) canonicalByBase.set(baseNameOf(f), f);
  }
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
  /** 每个多选类已接受条数（算衰减） */
  const multiCount = new Map();

  for (const item of list) {
    const { category } = classifyImageLora(item.name);

    /**
     * ⚠️ 文件必须真的在 ComfyUI 的 loras 列表里。
     *
     * 不检查的后果是**提交阶段才炸**：ComfyUI 的 `value_not_in_list` 是严格
     * 字符串比较，会返回 `LoraLoaderModelOnly: 'x.safetensors' not in [...]`，
     * 用户只看到一个文件名，完全看不出"是我没装这个 LoRA"。
     * 这里在**组装期**就拒掉并说明原因。
     *
     * 只在真的探测到了文件列表时才检查 —— ComfyUI 不可达时不能误杀。
     */
    if (canonicalByBase.size > 0 && !canonicalByBase.has(baseNameOf(item.name))) {
      rejected.push({
        name: item.name,
        reason: '不在 ComfyUI 的 loras 目录里（文件缺失或名字拼错），已跳过而不是提交一个不存在的文件',
      });
      continue;
    }

    if (accepted.some((a) => a.name === item.name)) {
      rejected.push({ name: item.name, reason: '重复出现，只保留一次' });
      continue;
    }

    if (category.mode === 'single') {
      const prev = singleOwner.get(category.id);
      if (prev) {
        accepted.splice(accepted.indexOf(prev), 1);
        singleOwner.delete(category.id);
        replaced.push({ name: prev.name, by: item.name, category: category.label });
      }
    }

    if (accepted.length >= maxSlots) {
      rejected.push({ name: item.name, reason: `LoRA 槽位已满（最多 ${maxSlots} 个）` });
      continue;
    }

    const nth = multiCount.get(category.id) ?? 0;
    let strength = item.userStrength;
    if (strength === null) {
      strength = category.signed ? (category.defaultOnSelect ?? 0) : category.strength.def;
    }

    /**
     * ⚠️ 用户强度必须**在这里**夹到分类允许范围，不能等到组装 workflow 时才夹。
     *
     * 若留给 `h3-image.js` 组装时夹，它会被 `Math.max(-2, Math.min(2, strength))`
     * 静默夹到 [-2,2]，而 `appliedStrength` / `loraStack` / `job.params.imageLoras`
     * 报的还是原值 —— 记录与真实行为不一致。
     *
     * 具体场景：传 strength=5 →
     *   · 求解器 appliedStrength=5，无警告（accepted.length<=1 时 break 掉 block 逻辑）
     *   · 提交时被夹成 2.0
     *   · meta.loraStack 却写 x@5
     * 用户看到"强度 5 生效、无警告"，实际是 2 —— 调参完全失去意义。
     */
    const smin = category.strength?.min;
    const smax = category.strength?.max;
    if (Number.isFinite(smin) || Number.isFinite(smax)) {
      const before = strength;
      if (Number.isFinite(smax)) strength = Math.min(strength, smax);
      if (Number.isFinite(smin)) strength = Math.max(strength, smin);
      if (Math.abs(strength - before) > 1e-6) {
        degraded.push({
          name: item.name,
          from: Number(before.toFixed(3)),
          to: Number(strength.toFixed(3)),
          reason: `「${category.label}」允许范围 ${smin ?? '-∞'}~${smax ?? '+∞'}，已夹紧`,
        });
      }
    }
    // 兜底：无论分类有没有声明范围，都不允许超出 ComfyUI 的合法区间 [-2, 2]
    if (Math.abs(strength) > 2) {
      const before = strength;
      strength = Math.max(-2, Math.min(2, strength));
      degraded.push({
        name: item.name,
        from: Number(before.toFixed(3)),
        to: Number(strength.toFixed(3)),
        reason: '模型只接受 [-2, 2] 的强度，已夹紧',
      });
    }
    // 滑块类有符号，衰减要按绝对值算，0 附近不要压成 0
    if (nth > 0 && !category.signed) {
      const before = strength;
      strength *= category.stackDecay;
      if (Math.abs(strength - before) > 1e-6) {
        degraded.push({
          name: item.name,
          from: Number(before.toFixed(3)),
          to: Number(strength.toFixed(3)),
          reason: `「${category.label}」第 ${nth + 1} 条，按 ${category.stackDecay} 衰减`,
        });
      }
    }

    accepted.push({
      name: item.name,
      base: baseNameOf(item.name),
      categoryId: category.id,
      categoryLabel: category.label,
      mode: category.mode,
      signed: Boolean(category.signed),
      appliedStrength: Number(strength.toFixed(3)),
    });
    if (category.mode === 'single') singleOwner.set(category.id, accepted[accepted.length - 1]);
    else multiCount.set(category.id, nth + 1);
  }

  const sumAbs = () => accepted.reduce((s, a) => s + Math.abs(a.appliedStrength), 0);
  let total = sumAbs();

  if (total > STRENGTH_LIMITS.block) {
    while (total > STRENGTH_LIMITS.warn) {
      const weakest = accepted.reduce((m, a) => (Math.abs(a.appliedStrength) < Math.abs(m.appliedStrength) ? a : m), accepted[0]);
      if (!weakest || accepted.length <= 1) break;
      accepted.splice(accepted.indexOf(weakest), 1);
      if (singleOwner.get(weakest.categoryId)?.name === weakest.name) singleOwner.delete(weakest.categoryId);
      rejected.push({
        name: weakest.name,
        reason: `总强度 ${total.toFixed(2)} 超过硬上限 ${STRENGTH_LIMITS.block}，已剔除最弱的一条。`
          + '图像会过曝、细节糊成一片，请减少同时挂载的数量。',
      });
      total = sumAbs();
    }
  } else if (total > STRENGTH_LIMITS.warn) {
    warnings.push(
      `总强度 ${total.toFixed(2)} 超过建议上限 ${STRENGTH_LIMITS.warn} —— `
      + '链式叠加是加法，超过这个值画面会过曝、边缘出现光晕。建议减少数量或降低强度。',
    );
  }

  /* ---------------- 图像特有的硬冲突提示 ---------------- */
  const has = (id) => accepted.some((a) => a.categoryId === id);
  if (has('img_style') && has('img_character')) {
    warnings.push(
      '同时挂了「画风」与「角色」：画风会把脸往风格方向拉，容易产出"两边都不像"的混合体。'
      + '建议只留一个，或把画风降到 0.4 以下。',
    );
  }
  if (has('img_character') && opts.hasRefImages) {
    warnings.push(
      '同时有参考图与「角色」LoRA：两者都在争夺"脸长什么样"。'
      + '若参考图本身就是目标角色，建议先不挂角色 LoRA —— 参考图的约束通常更准。',
    );
  }
  if (has('img_quality') && accepted.filter((a) => a.categoryId === 'img_quality').length >= 2) {
    warnings.push(
      '挂了 2 条以上「画质 / 细节」：叠加会过度锐化，出现塑料感与边缘光晕。建议只留 1 条。',
    );
  }

  return { accepted, rejected, replaced, degraded, totalStrength: Number(total.toFixed(3)), warnings };
}