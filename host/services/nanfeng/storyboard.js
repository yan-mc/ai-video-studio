/**
 * 智能分镜 —— 接 DSH 内部 LLM（不依赖任何外部 API Key）。
 *
 * ============================================================================
 * 与南风原实现的区别
 * ============================================================================
 *
 * 南风原实现（vendor/nanfeng/_removed/storyboard_api.py）：
 *   · 服务端读 `.env` 里的 NANFENG_VISION_* / NANFENG_TEXT_*
 *   · 用 urllib 直接 POST 到 OpenAI 兼容端点
 *   · 需要用户自己申请 API Key、填 `.env`
 *
 * 我们的实现：
 *   · 调用 DSH 的 `ctx.llm.stream()`，复用用户已登录的模型
 *   · **零凭据**，不写任何 .env
 *   · 提示词资产（SKILL + 模式契约）从南风原样移植
 *
 * ============================================================================
 * 保留的南风资产（这些是精华）
 * ============================================================================
 *
 *   · 8 个 SKILL（H3 官方提示词 / 海螺 / 一镜到底续写…）
 *   · mode_contract()   每种模式的严格输出契约
 *   · vision_messages() 逐图分析的提示词
 *   · parse_storyboard() 输出解析（段号校验 + --- 分隔回退）
 *   · storyboard_output_budget()  token 预算
 *
 * @module nanfeng/storyboard
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Skill 根目录 —— 统一到 `skills/prompt/`。
 *
 * ⚠️ 历史：skill 原来散在 `vendor/nanfeng/*-skill/`，与 Python 节点混在一起。
 *    已全部迁到 `skills/prompt/`，vendor 现在只放 Python。
 *    目录映射见下方 SKILLS / CONTINUATION_SKILL_DIRS。
 */
const SKILL_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', 'skills', 'prompt');

/** 支持的输出模式 */
export const STORYBOARD_MODES = Object.freeze({
  ref2va: 'Ref2VA 多参参考',
  reference_i2va: '非首帧 I2V 图片参考',
  i2va: 'I2VA 图生视频',
  fl2va: 'FL2VA 首尾帧',
  t2va: 'T2VA 文生视频',
  continuation_cuts: '续写·可切镜',
  oneshot_continuation: '续写·一镜到底',
});

/** 可选 SKILL */
export const SKILLS = Object.freeze({
  regular_storyboard: {
    label: '常规提示词分镜（H3 官方）',
    desc: 'H3 官方英文六段/三段格式，含 references 细则。',
    dir: 'h3-official',
    legacyTextKeys: true,
  },
  ns_storyboard: {
    label: 'NS 提示词分镜（海螺）',
    desc: '中文流程 + 本地 ComfyUI 结构，26.7KB 最完整。',
    dir: 'h3-hailuo',
    legacyTextKeys: false,
  },
});

/** 续写模式（走专用 SKILL 目录） */
const CONTINUATION_SKILL_DIRS = Object.freeze({
  continuation_cuts: 'h3-continuation-cuts',
  oneshot_continuation: 'h3-continuation',
  reference_i2va: 'h3-nonfirst-i2v',
});

/**
 * 逐图分析的提示词（原样移植自南风 vision_messages）。
 */
export function visionPrompt(index) {
  return (
    `你现在只分析一张参考图片，固定编号是@图片${index}。严格分类为人物图、场景图、产品或道具图三类之一。`
    + '提取人物身份、外貌、服装、姿态和朝向，或场景空间结构、光线、时间天气，或道具材质、颜色、朝向和状态。'
    + '只分析当前图片，不关联其他图片，不编造。不要自行添加其他@图片编号。'
  );
}

/**
 * 每种模式的输出契约（原样移植自南风 mode_contract）。
 *
 * 这是南风提示词工程的核心资产 —— 它把「模型该输出什么结构」写成了硬约束。
 */
export function modeContract(mode, count) {
  if (mode === 'continuation_cuts') {
    return `输出${count}段，段1起编号、---分隔，参考说明加三段正文。默认连续，`
      + '用户明确说切、切到、反打或硬切即允许指定位置切镜，不要求必须写硬字；不可擅自加切镜。'
      + '每段只说本段分配对白，明确无对白段不加新话。保留身份场景与动作状态，未知段尾软承接。'
      + '整组预算联合分配。此模式仅改提示词，不断开latent或修改分组；'
      + '存在重叠锚定时切镜安排在重叠之后，不声称首帧硬切有保证。';
  }
  if (mode === 'oneshot_continuation') {
    return `严格输出${count}段，标题依次为段1到段${count}，段间用---分隔。`
      + '所有段属于同一个连续长镜头：首段由图片建立可见起始状态，后续段以实际传入的latent动作和机位为准，'
      + '图片只保留身份外观与场景身份，不恢复原图姿势。'
      + '规划时尚未生成后续latent，不得将计划段尾当成已观察事实，不预设精确手位、机位或上段对白已说完；'
      + '只写简洁、可承接实际动作的软轨迹和有限的下一步意图，不无限延续动作，不罗列条件分支。'
      + '不切镜不重置，机位变化只能连续发生。'
      + '每段输出参考职责说明及integrated_multimodal_description、overall_soundscape、non_diegetic_music三段。'
      + '中间段末无需强制停稳。只使用程序提供的名义时长与重叠帧数，不虚构采样时长或精确生成终态。';
  }

  const common = `严格输出${count}段。从段1开始依次编号到段${count}；`
    + `每个标题行只能写对应的'段N'，不得写'段1到段${count}'或其他文字。段之间用---分隔。`
    + '每段必须是可直接复制使用的完整官方提示词。'
    + '相邻两段必须作为一个整体联合设计：先联合规划段N尾镜与段N+1首镜，再分别写入两段。'
    + '下一段首镜继承上一段尾镜的站位关系、前中后景、左右位置、朝向、视线、距离、遮挡、动作阶段、'
    + '道具状态和180度动作轴；切镜只改变观察位置，不改变世界状态。'
    + '跨段边界必须形成可剪辑的镜头变化，优先用动作轴内的正反打、反应镜头，或有动机的景别/机位变化；'
    + '除非用户明确要求连续同镜头，段N尾镜与段N+1首镜不得使用相同景别且相同机位角度。'
    + '不得为了变化而瞬移、越轴、左右互换、重置动作或跳过动作。'
    + '下一段第一帧就必须落在上一段尾镜的状态：不得先闪出默认构图、参考图原始姿势、错误人数或错误机位，'
    + '不得重新建立人物站位或让动作重新起势；换景别或换角度只能发生在状态继承成立之后，'
    + '并保持人物数量、唯一实例、接触点、遮挡、动作相位、光线和轴线连续。';

  if (mode === 'ref2va') {
    return common + '当前模式为Ref2VA多参。Ref2VA多参素材只提供身份、外观、场景、道具、风格或动作参考，'
      + '不锁定任何Picture为0.00秒首帧；不得在段首先闪现或完整展示任一参考素材的原始画面，'
      + '不得轮播、拼贴或从参考图原始构图/姿势起步。'
      + '每段00:00直接生成该段目标剧情构图：第一段直接进入用户要求的开场，'
      + '后续段直接生成承接上一段尾镜世界状态的目标画面；所有素材从第一帧起按各自语义职责融合。'
      + '每段严格依次输出subject_definitions、summary、retention_analysis、detailed_description、'
      + 'overall_soundscape、non_diegetic_music六段，使用<Subject N>/<Picture N>。';
  }
  if (mode === 'reference_i2va') {
    return common + '当前为自定义非首帧I2V图片参考写法。'
      + '每段先用英文声明Picture 1只提供视觉参考，不定义首帧或开场构图；'
      + '然后依次输出integrated_multimodal_description、overall_soundscape、non_diegetic_music。'
      + '只解除参考图的像素级首帧绑定和原始景别构图；'
      + '人物身份、服装、发型、人数、初始姿势、身体朝向、视线、双手位置、接触点、道具、场景布局、'
      + '天气、光线和空间关系默认全部保留，不得因换景别而重置。'
      + '首个可见画面直接使用用户要求的景别；仅用户要求时改变机位，保持轴线与自然透视。'
      + '画外肢体仍保持原状态；后续动作从继承状态自然发展，不是全程冻结。'
      + '禁止首帧对齐句及Ref2VA六段结构。';
  }
  if (mode === 'i2va') {
    return common + '当前模式为I2VA图生视频。'
      + '每段先写@图片1对应Picture 1在0.00秒的官方首帧对齐句，'
      + '再依次输出integrated_multimodal_description、overall_soundscape、non_diegetic_music。';
  }
  if (mode === 'fl2va') {
    return common + '当前模式为FL2VA首尾帧。'
      + '每段先写Picture 1对齐0.00秒、Picture 2对齐该段结束时刻的官方首尾对齐句，'
      + '再依次输出integrated_multimodal_description、overall_soundscape、non_diegetic_music。';
  }
  return common + '当前模式为T2VA文生视频。不得写任何Picture/Video/Audio引用或对齐句；'
    + '每段严格依次输出integrated_multimodal_description、overall_soundscape、non_diegetic_music。';
}

/**
 * 输出 token 预算（原样移植）。
 */
export function outputBudget(segmentCount) {
  const count = Math.max(1, Math.min(12, Number(segmentCount) || 1));
  return Math.min(24000, 4200 + 1800 * count);
}

/**
 * 校验续写 context_length 与时长是否自洽（原样移植）。
 */
export function validateContinuationContext(contextLength, durationSeconds) {
  const ctx = Number(contextLength);
  if (![5, 22, 39, 56].includes(ctx)) {
    throw new Error(`context_length 必须为 5/22/39/56，收到 ${contextLength}`);
  }
  const dur = Number(durationSeconds);
  if (ctx / 24 >= dur) {
    throw new Error(
      `context_length=${ctx} 帧（${(ctx / 24).toFixed(3)} 秒）不小于单段时长 ${dur} 秒，`
      + '续写重叠会吃掉整段内容',
    );
  }
}

/**
 * 读取 SKILL 文本。
 *
 * 与原实现的差异：不再读 `.env`，SKILL 一律从 vendor 目录读。
 * @param {string} mode
 * @param {string} skillId
 */
export function loadSkill(mode, skillId = 'regular_storyboard') {
  const isNs = skillId === 'ns_storyboard';

  /**
   * 续写类模式走专用 SKILL。
   *
   * ⚠️ 以前这里是 `{ regular, ns }` 二分表，而 3 个 ns 目录与 regular
   *    **逐字节相同**（已核实 SHA256），所以那个分支是纯冗余 —— 已删除。
   *    现在续写模式只有一份 skill，与 skillId 无关。
   */
  const contDir = CONTINUATION_SKILL_DIRS[mode];
  if (contDir) return readSkillDir(contDir);

  // NS（海螺）模式
  if (isNs) return readSkillDir(SKILLS.ns_storyboard.dir);

  // 常规模式：H3 官方 skill + references 细则
  const sections = [readSkillDir(SKILLS.regular_storyboard.dir)];
  const refName = String(mode).toLowerCase() === 'ref2va' ? 'ref-en.txt' : 'base-en.txt';
  const refPath = path.join(SKILL_ROOT, SKILLS.regular_storyboard.dir, 'references', refName);
  if (fs.existsSync(refPath)) {
    sections.push(`\n\n---\n\n# Embedded reference: ${refName}\n\n${fs.readFileSync(refPath, 'utf8')}`);
  }
  return sections.join('');
}

function readSkillDir(dirName) {
  const p = path.join(SKILL_ROOT, dirName, 'SKILL.md');
  if (!fs.existsSync(p)) {
    throw new Error(`SKILL_NOT_FOUND: 缺少 skills/prompt/${dirName}/SKILL.md`);
  }
  return fs.readFileSync(p, 'utf8');
}

/**
 * 构造分镜生成的 messages。
 *
 * @param {object} opts
 * @param {string} opts.idea
 * @param {number} opts.count
 * @param {string} opts.mode
 * @param {Array<{index:number,name:string}>} opts.images
 * @param {string} opts.analysis  逐图分析结果的拼接
 * @param {number} [opts.durationSeconds]
 * @param {number} [opts.contextLength]
 * @returns {Array<{role:string, content:string}>}
 */
export function buildStoryboardMessages({
  idea,
  count,
  mode = 'ref2va',
  /**
   * ⚠️ `skillId` 以前是**死参数**：
   *    tools.js 的 schema 里暴露了 `skillId` 枚举，但这里硬编码传
   *    `'regular_storyboard'`，于是用户选「NS 提示词分镜（海螺）」
   *    实际拿到的还是常规版 —— 26.7KB 的海螺 skill **永远不可达**。
   *    现在透传到底。
   */
  skillId = 'regular_storyboard',
  images = [],
  analysis = '',
  durationSeconds = 5,
  contextLength,
}) {
  const skill = loadSkill(mode, skillId);
  const manifest = images.length
    ? images.map((x) => `@图片${x.index}：${x.name}`).join('\n')
    : '无图片';

  const durationLabel = Number(durationSeconds).toString();
  let durationContract = `硬性时长先决条件：每个分镜对应${durationLabel}秒视频。`
    + `必须先按${durationLabel}秒重新规划动作密度、镜头数量、对白长度、动作收束和段尾状态；`
    + '不得按默认5秒或其他时长写作。\n';

  if (mode === 'oneshot_continuation' || mode === 'continuation_cuts') {
    durationContract = `每段名义请求时长：${durationLabel}秒；按此预算动作和对白，`
      + '不代表已验证的采样或交付时长。首段无续写裁切。'
      + '后续段开头重叠跟随实际钉住的运动，不要求停顿或冻结；'
      + '被裁重叠内不安排新的关键事件或新对白，新的动作推进在重叠之后自然衔接。\n';

    const total = count * durationSeconds;
    const windows = Array.from({ length: count }, (_, i) => (
      `段${i + 1}：本组名义进度${i * durationSeconds}–${(i + 1) * durationSeconds}秒`
    )).join('；');

    durationContract += `本次连续组整体预算：${count}段 × 每段${durationLabel}秒 = ${total}秒名义总时长。\n`
      + `分段规划区间：${windows}。\n`
      + '先按本组整体预算联合规划剧情、对白顺序、情绪递进与一次完整运镜，再把不同阶段分配到各段。'
      + '用户说开场、途中、最后，默认指本组开头、全组过程、最后一段结束，不是每段都执行一遍；'
      + '用户明确指定段号时优先遵守。'
      + '不得让第一段提前完成全组终点，不得把全部对白复制到每段，'
      + '也不得为填满总时长编造重复动作或新台词。'
      + '上述区间只是规划进度标签，不是拼接后精确时间码；每段输出仍用从00:00起的本段局部时间，'
      + '后续段须避开本段裁除的上下文窗口。'
      + '实际可交付时长受帧数对齐和重叠裁剪影响，不能声称名义总时长就是最终成片时长。'
      + '阶段目标保持软约束，实际latent决定当前动作和机位，不为赶计划终点跳动作或切镜。\n';

    if (contextLength == null) {
      durationContract += '未提供context_length，数值重叠窗口未知；不得编造默认帧数或秒数。\n';
    } else {
      validateContinuationContext(contextLength, durationSeconds);
      durationContract += `所选context_length=${contextLength}帧；`
        + `仅后续段开头这${contextLength}帧为续写上下文并被裁去。`
        + `按24fps仅换算该帧窗口：${contextLength}/24=${(contextLength / 24).toFixed(6)}秒；`
        + '这不是采样时长量化公式，不据此声称精确交付时长，不修改所选帧数。\n';
    }
  }

  const userContent = `当前官方模式：${STORYBOARD_MODES[mode]}\n`
    + `${durationContract}`
    + `${modeContract(mode, count)}\n\n`
    + `用户想法：\n${idea || '请根据参考素材合理创作。'}\n\n`
    + `固定上传槽位：\n${manifest}\n\n`
    + `逐图看图结果：\n${analysis || '无'}\n\n`
    + '禁止追问。图片编号严格绑定上传槽位，不重排、不编造；'
    + '用户原有对白必须保留说话人、原意和顺序。';

  return [
    { role: 'system', content: `严格执行下面的H3官方提示词Skill和当前模式契约，只输出正式结果，不解释。\n\n${skill}` },
    { role: 'user', content: userContent },
  ];
}

/**
 * 解析模型输出为分镜片段（原样移植自南风 parse_storyboard）。
 *
 * 规则：
 *   · 先剥掉 ``` 围栏
 *   · 找「全局提示词：」段
 *   · 按 `段N` 标题切分，且段号必须从 1 连续
 *   · 段号不连续 → 报错（不静默糊过去）
 *   · 段数不符 → 尝试按 `---` 分隔回退
 *
 * @param {string} text
 * @param {number} count
 * @returns {{ global: string, segments: string[], raw: string }}
 */
export function parseStoryboard(text, count) {
  const raw = String(text ?? '').replace(/```(?:text)?|```/g, '').trim();

  const globalMatch = raw.match(/全局提示词\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:---\s*)?\n?\s*段\s*1\b|$)/);
  const globalPrompt = globalMatch ? globalMatch[1].trim() : '';

  const matches = [...raw.matchAll(/^\s*段\s*(\d+)\s*[:：]?\s*$/gm)];
  if (matches.some((m, i) => Number(m[1]) !== i + 1)) {
    throw new Error('模型返回的段号存在跳号、重复或顺序错误');
  }

  let segments = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    segments.push(raw.slice(start, end).trim().replace(/-+$/, '').trim());
  }

  if (segments.length !== count) {
    if (count === 1 && matches.length === 0 && raw) {
      segments = [raw];
    } else {
      const blocks = raw.split(/^\s*-{3,}\s*$/m).map((x) => x.trim()).filter(Boolean);
      if (blocks.length === count) {
        segments = blocks.map((b, i) => `段${i + 1}\n\n${b}`);
      } else {
        throw new Error(`模型返回${segments.length}段，但要求${count}段；原始完整输出已收到，未重复生成`);
      }
    }
  }

  return { global: globalPrompt, segments, raw };
}

/**
 * 把 DSH LLM 的流式 chunk 拼成完整文本。
 *
 * DSH `ctx.llm.stream()` 返回 `AsyncIterable<StreamChunk>`，chunk 种类见
 * `@deepseek-ai/dsh-llm`：text-delta / reasoning-delta / block-start / block-end / usage / finish。
 * 我们只关心 text 累积。
 *
 * @param {AsyncIterable<object>} stream
 * @returns {Promise<string>}
 */
export async function collectText(stream) {
  let out = '';
  for await (const chunk of stream) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') {
      out += chunk.text;
    }
  }
  return out;
}
