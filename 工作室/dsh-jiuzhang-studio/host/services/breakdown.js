/**
 * 人设卡 / 角色设定图 —— 把一个立绘转成可复用的**角色设定卡**。
 *
 * 用途：人设卡是角色的"权威形象"，做视频时作为 characterRefs 传进去，
 * 保证多镜之间角色外观一致。
 *
 * 产出结构（三档）：
 *  - **设定卡（standard）**：三视图 + 服装部件 + 附属部件
 *  - **完整设定卡（full）**：+ 表情集 + 材质细节
 *  - **纯部件（parts）**：只拆服装与配件，平铺排列（无人物）
 *
 * 明确**不包含**：内衣、化妆品、随身私人物品等与角色设定无关的内容。
 * 这类内容会稀释提示词、干扰模型、且与作品格调无关。
 */

/** 拆解档位 */
export const BREAKDOWN_LEVELS = Object.freeze([
  {
    id: 'standard',
    name: '角色设定卡',
    desc: '三视图（正/侧/背）+ 服装部件 + 附属部件',
  },
  {
    id: 'full',
    name: '完整设定卡',
    desc: '设定卡 + 表情集 + 材质细节放大',
  },
  {
    id: 'parts',
    name: '纯部件拆解',
    desc: '只拆服装与配件，平铺排列，无人物',
  },
]);

/** 输出尺寸 */
export const BREAKDOWN_SIZES = Object.freeze([
  { id: 'square', name: '方形 2048²', w: 2048, h: 2048 },
  { id: 'portrait', name: '竖版 1776×2368', w: 1776, h: 2368 },
  { id: 'landscape', name: '横版 2368×1776', w: 2368, h: 1776 },
]);

/** 默认三视图角度 */
export const DEFAULT_VIEWS = Object.freeze(['正面', '侧面', '背面']);

/** 默认表情集 */
export const DEFAULT_EXPRESSIONS = Object.freeze(['平静', '微笑', '微怒', '惊讶']);

/**
 * 构建角色设定图提示词。
 *
 * @param {object} input
 * @param {string} input.character    角色名/外貌描述
 * @param {string[]} input.outfit     服装部件清单
 * @param {string[]} input.parts      附属部件清单（发饰/武器/挂件等）
 * @param {string[]} [input.views]    三视图角度，默认 正/侧/背
 * @param {string[]} [input.expressions] 表情集（full 档）
 * @param {string} [input.notes]      补充说明（画风/时代/材质）
 * @param {string} level              档位 id
 */
export function buildBreakdownPrompt(input = {}, level = 'standard') {
  const character = String(input.character ?? '参考图中的角色');
  const outfit = (input.outfit ?? []).filter(Boolean);
  const parts = (input.parts ?? []).filter(Boolean);
  const views = (input.views?.length ? input.views : DEFAULT_VIEWS).filter(Boolean);
  const expressions = (input.expressions?.length ? input.expressions : DEFAULT_EXPRESSIONS).filter(Boolean);
  const notes = String(input.notes ?? '');

  const outfitLines = outfit.length
    ? outfit.map((o, i) => `${i + 1}. ${o}`).join('\n')
    : '把角色身上的服装逐件拆解为可辨认的单品（上衣 / 下装 / 外层 / 鞋履），保持原设计的配色与纹样';

  const partLines = parts.length
    ? parts.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : '把角色身上的附属部件逐一拆出（发饰 / 首饰 / 挂件 / 武器 / 披风等），保持原造型';

  /* ---------------------------------------------------- 纯部件档 */
  if (level === 'parts') {
    return `角色服装与部件拆解图。

把参考图中角色身上所有的服装与附属部件完整拆解出来，单独平铺展示。
参考角色：${character}${notes ? `（${notes}）` : ''}

服装部件（每件单独展示，保持原配色、纹样、材质）：
${outfitLines}

附属部件（每件单独展示，保持原造型）：
${partLines}

排版要求：
纯白背景，整齐网格排列，各部件之间留出充足间隙，互不遮挡、不重叠。
每件部件正面朝上、完整展开，边缘清晰可辨。
同一个部件只出现一次，不要重复。

画面要求：
干净的服装设计参考稿风格，均匀平光、无投影、无人物、无文字标注。
严格还原原图的设计细节，不要自行添加或改动设计。`;
  }

  /* ---------------------------------------------------- 设定卡 / 完整档 */
  const showExpression = level === 'full';
  const showMaterial = level === 'full';

  return `角色设定图（Character Sheet）。

参考图中的角色是：${character}${notes ? `（${notes}）` : ''}
请根据这张参考图，绘制一份完整的角色设定卡，用于后续动画制作时保持角色形象一致。

一、三视图（画面主体）
在画面中央偏左位置，绘制角色的 ${views.length} 个全身视角，等高等比例、并排对齐：
${views.map((v, i) => `${i + 1}. ${v}视图`).join('\n')}

要求：
- 三个视角为同一个角色，发型、服装、配饰、体型完全一致
- 统一为站立姿势，自然站姿，双臂自然下垂，不做大幅度动作
- 统一光照、统一背景，确保可以直接对比
- 全身入画，不切头不切脚

二、服装部件拆解（画面右侧或下方）
把角色身上的服装逐件拆出，单独平铺展示：
${outfitLines}

每件部件要求：
- 保持原设计（配色 / 纹样 / 剪裁 / 材质质感）
- 正面朝上、完整展开、互不遮挡
- 与三视图中的对应部位能明确对应

三、附属部件拆解
把角色的附属部件逐一拆出：
${partLines}

${showExpression ? `四、表情集
绘制 ${expressions.length} 个头部特写，展示以下表情：${expressions.join('、')}
要求：保持发型与瞳色一致，仅改变面部表情。

五、材质细节
选取 1-2 个关键材质做放大特写（如布料纹理、金属质感、刺绣细节）。

` : ''}画面整体要求：
- 干净的设定稿风格，线条清晰，色块平整
- 纯色或浅灰背景，无场景、无投影、无装饰元素
- 各区块之间留白充足，排布有序，便于阅读
- 不要出现文字、标注、水印
- 严格还原参考图的角色形象，不要自行改动设计`;
}

/**
 * 从角色描述里粗抽服装/部件清单（用户没填时的兜底）。
 */
export function guessOutfitFromDescription(desc) {
  const text = String(desc ?? '');
  const parts = text
    .split(/[，,。；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && /裙|衣|裤|鞋|帽|袜|手套|披风|外套|衬衫|礼服|甲|袍/.test(s));
  return parts.slice(0, 10);
}

/** 从描述里抽附属部件 */
export function guessPartsFromDescription(desc) {
  const text = String(desc ?? '');
  const parts = text
    .split(/[，,。；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && /饰|链|环|带|冠|簪|夹|扣|挂|徽|剑|刀|杖|枪|盾|羽|翅|角/.test(s));
  return parts.slice(0, 10);
}

/** 按 id 取档位 */
export function breakdownLevel(id) {
  return BREAKDOWN_LEVELS.find((l) => l.id === id) ?? BREAKDOWN_LEVELS[0];
}

/** 按 id 取尺寸 */
export function breakdownSize(id) {
  return BREAKDOWN_SIZES.find((s) => s.id === id) ?? BREAKDOWN_SIZES[0];
}

export { BREAKDOWN_LEVELS as BREAKDOWN_LEVEL_LIST };