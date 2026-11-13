/**
 * 人设卡 / 角色设定图 —— 把一个立绘转成可复用的**角色设定卡**。
 *
 * 用途：设定卡是角色的"权威形象"，做视频时作为参考图传进去，
 * 保证多镜之间角色外观一致；也是「角色卡仓库」的核心素材。
 *
 * 产出三档：
 *  - **standard**：三视图 + 服装拆解 + 附属部件
 *  - **full**    ：+ 表情集 + 材质细节
 *  - **parts**   ：只拆服装与配件，平铺网格，无人物
 *
 * ============================================================================
 * 提示词设计原则（改之前务必读完）
 * ============================================================================
 *
 * 一、参考图会直接进模型，所以**不要用文字复述图片**
 *
 *    H3-Image 编辑模式下，参考图以 `Picture 1:` 视觉块直接进入编码器
 *    （见 comfy/text_encoders/minimax.py 的 `picture_label="Picture %d: "`）。
 *    模型"看得见"这张图。此时再用文字写「银发蓝眼、黑色夹克…」等于复述它已经
 *    看到的东西：
 *      · 文字与图像稍有出入 → 模型以文字为准 → 角色偏离原图
 *      · 白白占用提示词预算，挤压真正需要的排版指令
 *
 *    所以正文只写**任务**：拆什么、怎么排、什么风格。外观一律交给参考图。
 *    角色名只作称呼。
 *
 * 二、交给模型的必须是**纯文本**
 *
 *    模型不吃 Markdown。`**加粗**`、`## 标题` 这类记号送进去只是噪声，
 *    还会干扰分段理解。构建阶段就不产出 Markdown，而不是靠下游正则去剥。
 *
 * 三、**不要用编号小标题**（一、二、三 / 1. 2. 3. 段落级）
 *
 *    实测：带编号小标题的设定卡提示词，产出图里会出现编号、图例、甚至乱码文字。
 *    模型把"章节编号"理解成了"要在图上画的标签"。
 *    改用自然段落描述，靠空行分隔区块。
 *
 * 四、数量必须与参数一致
 *
 *    用户选几个视角就写几个，不能硬编码"三个视角"。
 *    参数与正文不一致会让模型无所适从。
 *
 * 五、反向约束用「不 / 不要 / 禁止」直接写
 *
 *    曾经的实现把「不要 X」正则改写成「避免 X」，依据是"H3-Image 无负面提示词"。
 *    这是误解：`MiniMaxH3ImageConditioning` 根本没有 negative 输入通道，
 *    prompt 是自由文本，编码器正常理解否定词。
 *    那个正则还只能吃到短词，导致「避免美化、不要改动设计」这种自相矛盾的句子。
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

/* ------------------------------------------------------------------ 内部 */

/** 清掉行尾标点，避免与模板里的标点叠成「。；」 */
function cleanItem(s) {
  return String(s ?? '').trim().replace(/[。．.；;，,、\s]+$/, '');
}

function cleanList(v, limit = 20) {
  if (!Array.isArray(v)) return [];
  return v.map(cleanItem).filter(Boolean).slice(0, limit);
}

/** 中文序数：1→一，2→二…只用于自然语言，不用于图上标签 */
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cn(n) {
  return CN_NUM[n] ?? String(n);
}

/** 把清单渲染成编号行（仅当用户显式给了清单时使用） */
function numbered(list) {
  return list.map((x, i) => `${i + 1}. ${x}`).join('\n');
}

/* ------------------------------------------------------------------ 主函数 */

/**
 * 构建角色设定图提示词。
 *
 * @param {object} input
 * @param {string}   [input.character]   角色名（**仅作称呼**，不写外貌）
 * @param {string[]} [input.outfit]      要拆出的服装清单（留空=让模型自行判断）
 * @param {string[]} [input.parts]       要拆出的附属部件清单
 * @param {string[]} [input.views]       三视图角度
 * @param {string[]} [input.expressions] 表情集（full 档）
 * @param {string}   [input.notes]       任务性补充要求（画风/排版），非外观描述
 * @param {string}   level               档位 id
 */
export function buildBreakdownPrompt(input = {}, level = 'standard') {
  const name = String(input.character ?? '').trim();
  // 只取第一句，避免调用方把整段外貌描述塞进"角色名"
  const shortName = name.split(/[，,。；;\n]/)[0].trim();
  const who = shortName ? `「${shortName}」` : '参考图中的角色';

  const outfit = cleanList(input.outfit, 24);
  const parts = cleanList(input.parts, 24);
  const views = cleanList(input.views, 8).length ? cleanList(input.views, 8) : [...DEFAULT_VIEWS];
  const expressions = cleanList(input.expressions, 12).length
    ? cleanList(input.expressions, 12)
    : [...DEFAULT_EXPRESSIONS];
  const notes = String(input.notes ?? '').trim();

  /* ---------------------------------------------------------- 纯部件档 */
  if (level === 'parts') {
    const body = [];
    body.push(`参考图是${who}的立绘。只做服装与配件拆解，不要画人物。`);

    if (outfit.length) {
      body.push(`需要拆出的服装：\n${numbered(outfit)}`);
    } else {
      body.push('把参考图角色身上的服装逐件拆出：上衣、下装、外层、鞋履，按穿着层次从上到下排列。');
    }

    if (parts.length) {
      body.push(`需要拆出的附属部件：\n${numbered(parts)}`);
    } else {
      body.push('把角色身上的附属部件逐件拆出：发饰、首饰、挂件、武器、披风等。');
    }

    body.push(
      '排版：纯白背景，整齐网格排列，各部件之间留出充足间隙，互不遮挡、不重叠。'
      + '每件部件正面朝上、完整展开、边缘清晰可辨，同一部件只出现一次。',
    );
    body.push(
      '风格：干净的服装设计参考稿，均匀平光，无投影。'
      + '严格照参考图的实际设计与配色拆解，不添加、不改动设计。',
    );
    body.push('画面中不要出现任何文字、标注、编号或水印。');
    if (notes) body.push(`补充要求：${notes}`);

    return body.join('\n\n');
  }

  /* ------------------------------------------------------ 设定卡 / 完整档 */
  const isFull = level === 'full';
  const body = [];

  body.push(
    `参考图是${who}的立绘。据此绘制一份角色设定卡，用于后续动画制作时保持角色形象一致。`,
  );

  // 三视图
  body.push(
    `主体是${cn(views.length)}个全身视角，等高等比例、统一光照、统一背景，并排排列：`
    + `${views.map((v) => (v.endsWith('视图') ? v : `${v}视图`)).join('、')}。`
    + '\n同一角色的不同视角之间，发型、服装、配饰、体型必须完全一致。'
    + '\n自然站立，双臂自然下垂，不做大幅度动作；全身入画，不切头不切脚。',
  );

  // 服装 + 部件
  const wardrobe = [];
  if (outfit.length) {
    wardrobe.push(`把下列服装逐件拆出、单独平铺展示：\n${numbered(outfit)}`);
  } else {
    wardrobe.push('把角色身上的服装逐件拆出、单独平铺展示：上衣、下装、外层、鞋履。');
  }
  if (parts.length) {
    wardrobe.push(`把下列附属部件逐件拆出、单独平铺展示：\n${numbered(parts)}`);
  } else {
    wardrobe.push('把角色身上的附属部件逐件拆出、单独平铺展示：发饰、首饰、挂件、武器、披风等。');
  }
  wardrobe.push(
    '每件要求：正面朝上、完整展开、互不遮挡，且能与三视图中的对应部位明确对应。',
  );
  body.push(wardrobe.join('\n\n'));

  // 表情集 + 材质（仅完整档）
  if (isFull) {
    body.push(
      `另外绘制${cn(expressions.length)}个头部特写，展示这些表情：${expressions.join('、')}。`
      + '\n只改变面部表情，发型、瞳色、头部角度保持一致。',
    );
    body.push('再选取一到两处关键材质做放大特写，例如布料纹理、金属质感、刺绣细节。');
  }

  // 整体风格
  body.push(
    '整体风格：干净的设定稿，线条清晰、色块平整，纯色或浅灰背景。'
    + '\n不要场景、不要投影、不要装饰元素；各区块之间留白充足，排布有序。',
  );

  // 反向约束（直接写否定，不改写）
  body.push('画面中不要出现任何文字、标注、编号、图例或水印。');

  // 一致性（最重要，放最后强化）
  body.push(
    '一致性的要求最高：角色的长相、发型、瞳色、服装设计完全以参考图为准，'
    + '不要美化、不要改动设计、不要替换配色；三视图与拆解出的部件必须能看出是同一个角色。',
  );

  if (notes) body.push(`补充要求：${notes}`);

  return body.join('\n\n');
}

/* ------------------------------------------------------------------ 兜底 */

/**
 * 从角色描述里粗抽服装/部件清单（用户没填时的**输入辅助**）。
 *
 * 注意：这是给"填表"用的提示，抽取结果会作为拆解清单，
 * **不是**要把整段描述塞进提示词。
 */
export function guessOutfitFromDescription(desc) {
  const text = String(desc ?? '');
  return text
    .split(/[，,。；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && /裙|衣|裤|鞋|帽|袜|手套|披风|外套|衬衫|礼服|甲|袍/.test(s))
    .slice(0, 10);
}

/** 从描述里抽附属部件 */
export function guessPartsFromDescription(desc) {
  const text = String(desc ?? '');
  return text
    .split(/[，,。；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && /饰|链|环|带|冠|簪|夹|扣|挂|徽|剑|刀|杖|枪|盾|羽|翅|角/.test(s))
    .slice(0, 10);
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
