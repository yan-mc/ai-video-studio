/**
 * 图像侧提示词规格常量 —— 纯数据，无 IO。
 *
 * 与视频侧的区别（改这里前必读）：
 *
 *   · H3-Image **cfg = 1，没有 CFG，也没有负面提示词**。ComfyUI 官方文档原话：
 *     "Write everything you want, including things to avoid, into the positive prompt."
 *     所以图像提示词里写 `no text`、`not 3D` 是**合法且推荐**的；
 *     视频侧"正文禁负面"那条铁律**不能套到图像**上。
 *   · 官方要求**英文**描述；中文能出图但遵循度明显更低。
 *   · 本地没有 prompt expander（官方模板有，我们工作流没有），
 *     所以"把一句话展开成完整描述"必须由编译器自己做。
 *
 * @module services/image-prompt/spec
 */

/**
 * 提示词长度上限（字符）。
 *
 * ⚠️ 必须与 `services/h3-image.js` 的 `IMAGE_PROMPT_MAX_CHARS` 保持一致。
 *    这里**故意不 import** 那个模块：h3-image.js 会拉起 config / comfy-client，
 *    而编译器应当是零副作用的纯函数模块（可被离线调用、可被单独测试）。
 *    一致性由测试断言保证，不靠运行时耦合。
 */
export const IMAGE_PROMPT_MAX_CHARS = 4096;

/** CJK 判定（用于中文检测与未翻译告警） */
export const CJK_RE = /[\u4e00-\u9fff]/;

/**
 * 官方推荐的段落顺序：用途 → 布局 → 主体动作 → 场景 → 光线 → 相机 → 质感 → 文字。
 * 顺序固定，缺段可省。
 */
export const SECTION_ORDER = Object.freeze([
  'purpose', 'layout', 'subject', 'action', 'setting', 'lighting', 'camera', 'texture', 'lettering',
]);

/** 段落元信息（给前端/文档用） */
export const SECTIONS = Object.freeze([
  { id: 'purpose', zh: '用途', en: 'purpose', hint: '这张图是干什么用的：海报 / 头像 / 立绘 / 产品图…' },
  { id: 'layout', zh: '布局', en: 'layout', hint: '画幅方向、构图方式、留白' },
  { id: 'subject', zh: '主体', en: 'subject', hint: '画面里最主要的人/物，以及穿着、外观' },
  { id: 'action', zh: '动作', en: 'action', hint: '主体在做什么：站着、坐着、看书…' },
  { id: 'setting', zh: '场景', en: 'setting', hint: '环境、地点、天气、时间' },
  { id: 'lighting', zh: '光线', en: 'lighting', hint: '光从哪来、软硬、色温、对比' },
  { id: 'camera', zh: '相机', en: 'camera', hint: '景别、机位角度、镜头与景深' },
  { id: 'texture', zh: '质感', en: 'texture', hint: '画法：平涂 / 水彩 / 厚涂 / 像素…' },
  { id: 'lettering', zh: '文字', en: 'lettering', hint: '画面上出现的字，逐字进引号并说明位置' },
]);

/** lint 用：必须覆盖的段落（缺了会显著降低出图质量） */
export const REQUIRED_SECTIONS = Object.freeze(['subject', 'setting', 'lighting']);

/**
 * 无信息量的风格词。
 *
 * 这些词模型无法据此做任何决定，写了等于没写 —— 官方要求"用可见的画法描述风格"。
 * 命中不阻断，只提示换成可观测的画法词。
 */
export const VAGUE_STYLE_WORDS = Object.freeze([
  'masterpiece', 'best quality', 'high quality', 'ultra detailed', 'ultra-detailed',
  'highly detailed', '8k', '4k', 'uhd', 'award winning', 'award-winning',
  'trending on artstation', 'premium', 'cinematic', 'stunning', 'beautiful', 'gorgeous',
  'anime style', 'photorealistic', 'hyperrealistic',
]);

/** 无文字时应当显式声明（官方推荐写法） */
export const NO_TEXT_SENTENCE = 'The image contains no text, letters or numbers.';

/**
 * 强化的无文字声明 —— 用于「场景里天然容易出现字」的题材。
 *
 * 为什么需要强化：实测只要画面里有霓虹、招牌、海报、黑板这类元素，
 * 单写一句 `contains no text` 压不住 —— 模型仍会在招牌上画出假名/汉字乱码。
 * 这里把"哪些东西上不该有字"逐项点出来，并明确要求纯色/几何图形替代。
 *
 * @param {boolean} aggressive 是否使用强化版
 * @returns {string}
 */
export function noTextSentence(aggressive = false) {
  if (!aggressive) return NO_TEXT_SENTENCE;
  return 'The image contains no text, letters, numbers or logos of any kind. '
    + 'Any signage, signboard, poster, label, screen or sign-like surface is plain and unmarked, '
    + 'carrying only solid colour or simple geometric shapes instead of writing. '
    + 'No lettering anywhere in the frame.';
}

/** 提到"图上有字"的线索词（用于 lint：说了文字却没给 lettering） */
export const TEXT_MENTION_RE = /文字|标题|字样|大字|小字|logo|LOGO|Logo|水印|签名|标语|lettering|text on/i;

/** 画风锚的两种借用模式 */
export const ANCHOR_MODES = Object.freeze([
  {
    id: 'style-only',
    name: '只借画法与质感',
    desc: '借它的画法、线条、笔触、上色方式与画面质感；不借它的配色。最不容易被带跑。',
  },
  {
    id: 'style+palette',
    desc: '连配色一起借：色相、饱和度、冷暖关系都跟随参考图。仍然不借主体与构图。',
    name: '画法 + 配色',
  },
]);

/** 画风锚强度档（决定措辞的力度，不是模型参数） */
export const ANCHOR_STRENGTHS = Object.freeze([
  { id: 'light', name: '轻', desc: '只在大感觉上靠拢，允许本来的画法占主导。' },
  { id: 'medium', name: '中', desc: '默认。画法跟随参考图，细节仍按提示词。' },
  { id: 'strong', name: '强', desc: '尽量复刻参考图的画法；容易连它的习惯一起带过来。' },
]);

/** 参考图编号上限（`<Picture 1>` … `<Picture 16>`） */
export const MAX_PICTURES = 16;

/** 图像侧画风 id 的保留值：不指定画风 */
export const STYLE_NONE = 'none';
