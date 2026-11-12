/**
 * 人设卡 / 像素级拆解图 —— 把一个立绘转成全景式角色概念分解图。
 *
 * 来源：用户提供的 Nano Banana Pro 像素级拆解提示词（社区爆款玩法）
 * 效果已实测：H3-Image 能完整复刻——中心立绘 + 服装分层 + 表情集 +
 * 材质特写 + 随身物品 + 手绘引导线 + 羊皮纸背景。
 *
 * 设计要点：
 *  - 提示词是**结构化模板**，中间部分（角色特征/服装清单）按输入动态填
 *  - 提供 3 档强度：standard（服装+表情+材质）/ full（+随身物品+美妆）/
 *    wardrobe-only（只拆服装，平铺网格，无人物）
 *  - 参考图自动适配：H3-Image 编辑模式，会保留角色外观
 */

/** 拆解强度档位 */
export const BREAKDOWN_LEVELS = Object.freeze([
  {
    id: 'standard',
    name: '标准人设卡',
    desc: '中心立绘 + 服装分层 + 表情集 + 材质特写',
    needsItems: false,
  },
  {
    id: 'full',
    name: '完整人设卡',
    desc: '标准 + 随身物品 + 美妆护理（Nano Banana 同款）',
    needsItems: true,
  },
  {
    id: 'wardrobe',
    name: '纯服装拆解',
    desc: '只拆服装配件，平铺网格，无人无物',
    needsItems: false,
  },
]);

/** 输出尺寸预设 */
export const BREAKDOWN_SIZES = Object.freeze([
  { id: 'square', name: '方形 2048²', w: 2048, h: 2048 },
  { id: 'portrait', name: '竖版 1776×2368', w: 1776, h: 2368 },
  { id: 'landscape', name: '横版 2368×1776', w: 2368, h: 1776 },
]);

/**
 * 构建拆解图提示词。
 * @param {object} input
 * @param {string} input.character  角色名/描述（如「银发蓝眼的少女」）
 * @param {string[]} input.outfit   服装单品清单
 * @param {string[]} [input.accessories] 配件清单
 * @param {string[]} [input.expressions] 表情清单
 * @param {string[]} [input.items]  随身物品（full 档用）
 * @param {string} [input.notes]    画风/时代等补充
 * @param {string} [level]          档位 id
 */
export function buildBreakdownPrompt(input = {}, level = 'full') {
  const character = String(input.character ?? '图中角色');
  const outfit = (input.outfit ?? []).filter(Boolean);
  const accessories = (input.accessories ?? []).filter(Boolean);
  const expressions = (input.expressions ?? ['平静', '微笑', '微怒', '惊讶']).filter(Boolean);
  const items = (input.items ?? ['随身包袋', '化妆品']).filter(Boolean);
  const notes = String(input.notes ?? '');

  const outfitLines = outfit.length
    ? outfit.map((o, i) => `${i + 1}. ${o}`).join('\n')
    : '将角色的服装逐件拆解为单品（上衣、下装、外套、鞋履）';
  const accLines = accessories.length
    ? accessories.map((a, i) => `${i + 1}. ${a}`).join('\n')
    : '（按图中实际配件拆解）';

  // ---- 纯服装拆解：网格平铺，无人物 ----
  if (level === 'wardrobe') {
    return `Character wardrobe breakdown sheet, flat lay reference chart.

Extract every garment and accessory piece from the reference character separately, and lay them all out on a pure white background. Show ONLY the clothing and accessory items — NO character body, NO person, NO face.

Characters: ${character}.

Garments to show:
${outfitLines}

Accessories to show:
${accLines}

Layout: neat grid, evenly spaced, generous white gaps, every item lying flat facing up, no overlap, no duplicates, each item appearing exactly once.

Style: clean garment design reference sheet, flat even lighting, no cast shadows, no text labels, high detail, preserves original color, fabric texture and pattern exactly.
${notes ? `Note: ${notes}` : ''}`;
  }

  // ---- 标准/完整人设卡：全景式拆解 ----
  const itemBlock = level === 'full'
    ? `
关联物品：
随身包袋与内容物：绘制角色的日常包袋，并将其"打开"，展示散落在一旁的物品，符合其职业与性格：${items.join('、')}。
美妆与护理：展示其常用的化妆品组合（香水瓶、口红、粉盒）。`
    : '';

  return `角色设定
你是一位顶尖的游戏与动漫概念美术设计大师，擅长制作详尽的角色设定图。你具备"像素级拆解"的能力，能够透视角色的穿着层级、捕捉微表情变化，并将与其相关的物品进行具象化还原。

任务目标
根据参考图中的角色形象，生成一张"全景式角色深度概念分解图"。该图片必须包含中心人物全身立绘，并在其周围环绕展示该人物的服装分层、不同表情、核心道具、材质特写${level === 'full' ? '，以及极具生活气息的随身物品展示' : ''}。

参考角色：${character}${notes ? `（${notes}）` : ''}

视觉规范

1. 构图布局:
中心位：放置角色的全身立绘，作为视觉锚点。
环绕位：在中心人物四周空白处，有序排列拆解后的元素。
视觉引导：使用手绘箭头或引导线，将周边的拆解物品与中心人物的对应部位连接起来。

2. 拆解内容:
服装分层：
将角色的服装拆分为单品展示，每件平铺展示，保留原始花纹与材质质感：
${outfitLines}

配件：
${accLines}

表情集：
在角落绘制 ${expressions.length} 个不同的头部特写，展示不同情绪：${expressions.join('、')}。保持角色发型与瞳色特征一致。

材质特写：
选取 1-2 个关键材质进行放大特写，展示花纹与质感细节。
${itemBlock}

3. 风格与注释:
画风：高质量的 2D 插画风格，概念设计草图风格，线条干净利落。
背景：米黄色羊皮纸纹理背景，营造设计手稿的氛围。
文字说明：在每个拆解元素旁模拟手写中文注释，简要说明材质。

使用中文。`;
}

/**
 * 从资产/立绘的描述里粗抽服装清单（当用户没手填时兜底）。
 * 只是简单分词，真正的清单应让用户填或在提示词里描述。
 */
export function guessOutfitFromDescription(desc) {
  const text = String(desc ?? '');
  const parts = text
    .split(/[，,。；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && /裙|衣|裤|鞋|帽|袜|手套|披风|外套|衬衫|礼服|饰|链|环|带|包/.test(s));
  return parts.slice(0, 10);
}

/** 按 id 取档位 */
export function breakdownLevel(id) {
  return BREAKDOWN_LEVELS.find((l) => l.id === id) ?? BREAKDOWN_LEVELS[1];
}

/** 按 id 取尺寸 */
export function breakdownSize(id) {
  return BREAKDOWN_SIZES.find((s) => s.id === id) ?? BREAKDOWN_SIZES[0];
}

export { BREAKDOWN_LEVELS as BREAKDOWN_LEVEL_LIST };