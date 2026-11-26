/**
 * 中文自然语言 → 完整英文图像描述（**规则 + 词典 + 模板**，不调外部 LLM）。
 *
 * ============================================================================
 * 为什么是规则而不是模型
 * ============================================================================
 *
 * 官方两个模板在采样器前都有一个 prompt expander（PE，Qwen3.8-27B FP4 / 模板用 9B），
 * 默认开启，把简短需求改写成详细英文描述。**我们的工作流里没有这一步**。
 *
 * 补齐它有两条路：
 *   ① 部署一个本地小模型做改写 —— 要额外权重与显存，且每次出图多几秒；
 *   ② 规则化展开 —— 无依赖、确定性、可单测、零延迟。
 *
 * 选 ②。它是"够用"而不是"聪明"：覆盖常见图像题材的词汇与句式，
 * 无法映射的词**原样保留中文**并交给 lint 告警，绝不瞎编或丢词。
 *
 * ============================================================================
 * 输出结构（严格按官方顺序）
 * ============================================================================
 *
 *   用途 → 布局 → 主体 → 动作 → 场景 → 光线 → 相机 → 质感 → 文字
 *
 * 每段可缺省；缺了哪些由 lint 提示，不强行编造（编造内容比缺失更糟：
 * 用户没要的东西被写进去，等于替他做了决定）。
 *
 * @module services/image-prompt/expand
 */
import { CJK_RE } from './spec.js';

/* ============================================================================
 * 一、词典
 * ============================================================================
 *
 * 每条：`[中文, 英文, 段落, 词性]`
 *   · 段落：purpose / layout / subject / setting / lighting / camera / texture
 *   · 词性：num 数词 / noun 名词 / adj 形容词 / verb 动词 / prep 介词 /
 *           place 地点 / weather 天气 / time 时间 / shot 景别 / angle 机位 /
 *           lens 镜头 / light 光线 / style 画法 / layout 布局 / drop 丢弃
 */

/** 数词 */
const NUMERALS = [
  ['两个', 'two'], ['两位', 'two'], ['二人', 'two'], ['两只', 'two'],
  ['三个', 'three'], ['三位', 'three'], ['三个', 'three'],
  ['四个', 'four'], ['五个', 'five'], ['六个', 'six'],
  ['七个', 'seven'], ['八个', 'eight'], ['九个', 'nine'], ['十个', 'ten'],
  ['一个', 'a'], ['一位', 'a'], ['一只', 'a'], ['一张', 'a'], ['一名', 'a'],
  ['两', 'two'], ['三', 'three'], ['四', 'four'], ['五', 'five'],
  ['六', 'six'], ['七', 'seven'], ['八', 'eight'], ['九', 'nine'], ['十', 'ten'],
];

/** 主体名词 */
const SUBJECT_NOUNS = [
  ['年轻女人', 'young woman'], ['年轻男子', 'young man'], ['年轻女性', 'young woman'],
  ['少女', 'young woman'], ['少年', 'young man'], ['女孩', 'girl'], ['男孩', 'boy'],
  ['女生', 'schoolgirl'], ['男生', 'schoolboy'], ['女人', 'woman'], ['男人', 'man'],
  ['老爷爷', 'elderly man'], ['老奶奶', 'elderly woman'], ['老人', 'elderly person'],
  ['小孩', 'child'], ['孩子们', 'children'], ['孩子', 'child'], ['婴儿', 'baby'],
  ['女孩儿', 'girl'], ['小姑娘', 'little girl'], ['小姐姐', 'young woman'],
  ['骑士', 'knight'], ['战士', 'warrior'], ['魔法师', 'mage'], ['女巫', 'sorceress'],
  ['机器人', 'robot'], ['机械人', 'android'], ['猫', 'cat'], ['小猫', 'kitten'],
  ['狗', 'dog'], ['小狗', 'puppy'], ['狐狸', 'fox'], ['狼', 'wolf'], ['龙', 'dragon'],
  ['天使', 'angel'], ['恶魔', 'demon'], ['精灵', 'elf'], ['吸血鬼', 'vampire'],
  ['女士', 'woman'], ['男子', 'man'], ['女子', 'woman'],
  ['学生', 'student'], ['白领', 'office worker'], ['厨师', 'chef'], ['画家', 'painter'],
  ['音乐家', 'musician'], ['歌手', 'singer'], ['舞者', 'dancer'], ['运动员', 'athlete'],
  ['芭蕾舞者', 'ballerina'], ['芭蕾', 'ballet'],
  ['宇航员', 'astronaut'], ['侦探', 'detective'], ['士兵', 'soldier'],
  ['花瓶', 'vase'], ['椅子', 'chair'], ['沙发', 'sofa'], ['桌子', 'table'],
  ['一杯咖啡', 'a cup of coffee'], ['咖啡', 'coffee'], ['咖啡杯', 'coffee cup'], ['书', 'book'], ['花', 'flower'], ['花朵', 'blossom'],
  ['玫瑰', 'rose'], ['树', 'tree'], ['山', 'mountain'], ['月亮', 'moon'],
  ['太阳', 'sun'], ['星星', 'stars'], ['云', 'clouds'], ['海浪', 'waves'],
];

/** 外观 / 服饰 */
const APPEARANCE = [
  ['长发', 'long hair'], ['短发', 'short hair'], ['马尾', 'a ponytail'],
  ['卷发', 'curly hair'], ['黑发', 'black hair'], ['银发', 'silver hair'],
  ['金发', 'blonde hair'], ['刘海', 'bangs'], ['双马尾', 'twin tails'],
  ['裙子', 'dress'], ['裙', 'dress'], ['连衣裙', 'dress'], ['婚纱', 'wedding dress'],
  ['西装', 'suit'], ['外套', 'jacket'], ['大衣', 'overcoat'], ['毛衣', 'sweater'],
  ['校服', 'school uniform'], ['制服', 'uniform'], ['衬衫', 'shirt'], ['T恤', 'T-shirt'],
  ['裤子', 'trousers'], ['短裤', 'shorts'], ['帽子', 'hat'], ['草帽', 'straw hat'],
  ['眼镜', 'glasses'], ['围巾', 'scarf'], ['耳环', 'earrings'], ['项链', 'necklace'],
  ['手套', 'gloves'], ['靴子', 'boots'], ['鞋子', 'shoes'], ['披风', 'cloak'],
  ['盔甲', 'armour'], ['和服', 'kimono'], ['旗袍', 'qipao'], ['汉服', 'hanfu'],
  ['胡子', 'a beard'], ['雀斑', 'freckles'], ['马尾辫', 'a ponytail'],
];

/** 颜色 */
const COLORS = [
  ['红色', 'red'], ['蓝色', 'blue'], ['黑色', 'black'], ['白色', 'white'],
  ['金色', 'gold'], ['银色', 'silver'], ['绿色', 'green'], ['紫色', 'purple'],
  ['粉色', 'pink'], ['橙色', 'orange'], ['灰色', 'grey'], ['棕色', 'brown'],
  ['米色', 'beige'], ['深蓝', 'deep blue'], ['浅蓝', 'pale blue'], ['天蓝', 'sky blue'],
  ['暗红', 'dark red'], ['鲜红', 'bright red'], ['纯白', 'pure white'], ['纯黑', 'pure black'],
  ['红', 'red'], ['蓝', 'blue'], ['黑', 'black'], ['白', 'white'],
  ['金', 'gold'], ['银', 'silver'], ['绿', 'green'], ['紫', 'purple'],
  ['粉', 'pink'], ['橙', 'orange'], ['灰', 'grey'],
];

/** 动作 */
const VERBS = [
  ['站在', 'standing'], ['坐着', 'seated'], ['坐在', 'seated on'],
  ['躺着', 'lying down'], ['躺在', 'lying on'], ['走在', 'walking along'],
  ['走在', 'walking along'], ['跑步', 'running'], ['跑', 'running'],
  ['走', 'walking'], ['站', 'standing'], ['坐', 'seated'],
  ['看书', 'reading'], ['读书', 'reading'], ['阅读', 'reading'], ['读', 'reading'],
  ['弹吉他', 'playing guitar'],
  ['弹钢琴', 'playing piano'], ['画画', 'painting'], ['喝茶', 'drinking tea'],
  ['喝咖啡', 'drinking coffee'], ['吃东西', 'eating'], ['挥手', 'waving'],
  ['微笑', 'smiling'], ['大笑', 'laughing'], ['哭', 'crying'], ['闭眼', 'eyes closed'],
  ['看镜头', 'looking at the camera'], ['看向镜头', 'looking at the camera'],
  ['看着', 'looking at'], ['望向', 'looking towards'], ['回头', 'looking over the shoulder'],
  ['拿着', 'holding'], ['抱着', 'holding'], ['举起', 'raising'], ['举起手', 'with a raised hand'],
  ['撑着伞', 'holding an umbrella'], ['撑伞', 'holding an umbrella'],
  ['靠在', 'leaning against'], ['靠在窗边', 'leaning by the window'],
  ['穿', 'wearing'], ['穿着', 'wearing'], ['戴着', 'wearing'], ['戴', 'wearing'],
  ['背着', 'carrying'], ['抱着猫', 'holding a cat'],
];

/** 场景地点 */
const PLACES = [
  ['城市', 'a city'], ['街道', 'a street'], ['街上', 'a street'], ['巷子', 'an alley'],
  ['小巷', 'an alley'], ['森林', 'a forest'], ['树林', 'woods'], ['海边', 'the seaside'],
  ['沙滩', 'a beach'], ['湖边', 'a lakeside'], ['山上', 'a mountainside'],
  ['花园', 'a garden'], ['公园', 'a park'], ['房间', 'a room'], ['卧室', 'a bedroom'],
  ['客厅', 'a living room'], ['厨房', 'a kitchen'], ['教室', 'a classroom'],
  ['学校', 'a school'], ['图书馆', 'a library'], ['咖啡厅', 'a café'],
  ['咖啡馆', 'a café'], ['餐厅', 'a restaurant'], ['车站', 'a station'],
  ['地铁', 'the subway'], ['机场', 'an airport'], ['屋顶', 'a rooftop'],
  ['阳台', 'a balcony'], ['走廊', 'a corridor'], ['教堂', 'a church'],
  ['废墟', 'ruins'], ['城堡', 'a castle'], ['神殿', 'a temple'],
  ['网吧', 'an internet café'], ['便利店', 'a convenience store'],
  ['室内', 'indoors'], ['室外', 'outdoors'], ['窗外', 'outside the window'],
  ['窗边', 'by the window'], ['门口', 'a doorway'],
];

/** 天气 / 时间（这类是"副词短语"，英文自带介词） */
const WEATHER_TIME = [
  ['暴雨', 'in heavy rain'], ['大雨', 'in heavy rain'], ['小雨', 'in light rain'],
  ['雨夜', 'a rainy night'], ['雨中', 'in the rain'], ['下雨', 'in the rain'], ['雨', 'rain'], ['雪中', 'in the snow'],
  ['下雪', 'in the snow'], ['雾中', 'in the mist'], ['大雾', 'in thick mist'],
  ['夜晚', 'at night'], ['夜里', 'at night'], ['晚上', 'at night'],
  ['白天', 'in daylight'], ['黄昏', 'at dusk'], ['日落', 'at sunset'],
  ['日出', 'at sunrise'], ['晨光', 'soft morning light'], ['清晨', 'in the early morning'], ['早晨', 'in the morning'],
  ['午后', 'in the afternoon'], ['正午', 'at midday'], ['深夜', 'late at night'],
  ['晴天', 'on a clear day'], ['阴天', 'under an overcast sky'],
  ['风中', 'in the wind'], ['大风', 'in strong wind'], ['雨后', 'after the rain'],
];

/** 背景 / 底面 */
const BACKDROP = [
  ['无缝背景', 'a seamless backdrop'], ['纯色背景', 'a plain solid-colour backdrop'],
  ['白底', 'a plain white backdrop'], ['黑底', 'a plain black backdrop'],
  ['透明背景', 'a transparent background'], ['背景', 'the background'],
];

/** 光线 */
const LIGHTING = [
  ['柔光', 'soft diffused light'], ['柔光箱', 'soft-box light'],
  ['硬光', 'hard directional light'], ['逆光', 'strong backlight'],
  ['侧光', 'side light'], ['伦勃朗光', 'Rembrandt lighting with a triangular highlight on the shadow side'],
  ['顶光', 'hard overhead top light'], ['底光', 'light from below'],
  // 措辞刻意避开 signage / sign 这类"带字招牌"的意象。
  //
  // 实测两轮：只要提示词里出现 "signage"，模型就会画出带日文假名/汉字乱码的招牌，
  // 即使同时写了 "The image contains no text"。原因是"招牌"这个概念本身
  // 在训练数据里几乎总是带字的，单靠一句否定压不住。
  // 所以改成不带招牌名词的表述：只描述光，不描述发光的东西上有什么。
  ['霓虹', 'neon light in magenta and cyan, glowing along the wet street edges'],
  ['霓虹灯', 'neon light in magenta and cyan, glowing along the wet street edges'],
  ['黄金时刻', 'low golden-hour sunlight'],
  ['蓝调时刻', 'cool blue-hour ambient light'],
  ['自然光', 'natural daylight'], ['日光', 'natural daylight'],
  ['影棚光', 'studio lighting'], ['棚拍光', 'studio lighting'],
  ['烛光', 'candlelight'], ['月光', 'moonlight'],
  ['暖光', 'warm light'], ['冷光', 'cool light'],
  ['高对比', 'strong contrast between highlight and shadow'],
  ['低对比', 'gentle, low-contrast illumination'],
  ['轮廓光', 'a rim light along the silhouette'],
  ['体积光', 'visible light shafts in the air'],
  ['丁达尔', 'visible light shafts in the air'],
  ['反光', 'specular bounce from a nearby surface'],
  ['窗光', 'soft window light from one side'],
  ['阳光', 'direct sunlight'],
  ['背光', 'backlight with a glowing edge'],
  ['平光', 'even, shadowless frontal light'],
];

/** 景别 */
const SHOTS = [
  ['大特写', 'tight close-up'], ['脸部特写', 'a tight close-up on the face'],
  ['特写', 'close-up'], ['近景', 'close shot'], ['中景', 'medium shot'],
  ['全景', 'wide shot'], ['远景', 'extreme wide shot'],
  ['半身', 'half-body framing'], ['全身', 'full-body framing'],
  ['头肩', 'head-and-shoulders framing'],
];

/** 机位角度 */
const ANGLES = [
  ['低机位', 'low angle'], ['高机位', 'high angle'],
  ['俯视', 'high angle'], ['俯拍', 'high angle'], ['鸟瞰', 'a top-down bird’s-eye view'],
  ['仰视', 'low angle'], ['仰拍', 'low angle'], ['平视', 'eye level'],
  ['正面', 'frontal'], ['侧面', 'profile'], ['四分之三侧', 'three-quarter view'],
  ['背影', 'from behind'],
];

/** 镜头 */
const LENSES = [
  ['广角', 'a wide-angle lens'], ['超广角', 'an ultra-wide lens'],
  ['长焦', 'a long lens'], ['微距', 'a macro lens'],
  ['浅景深', 'shallow depth of field'], ['深景深', 'deep focus'],
  ['虚化', 'a blurred background'], ['背景虚化', 'a softly blurred background'],
];

/** 画法 / 质感 */
const STYLE_WORDS = [
  ['平涂', 'flat colour fills'],
  ['赛璐珞', 'cel-shaded colour blocking with crisp shadow edges'],
  ['赛璐璐', 'cel-shaded colour blocking with crisp shadow edges'],
  ['厚涂', 'thick impasto brushwork with visible strokes'],
  ['水彩', 'watercolour washes with soft bleeding edges'],
  ['油画', 'oil painting with visible brushwork'],
  ['铅笔画', 'graphite pencil drawing'],
  ['素描', 'graphite pencil sketch'],
  ['线稿', 'clean line art'],
  ['干净线稿', 'clean, even line art'],
  ['双色阴影', 'two-tone shading using a single shadow colour'],
  ['无渐变', 'no gradients'],
  ['像素', 'pixel art with hard aliased edges'],
  ['像素风', 'pixel art with hard aliased edges'],
  ['黏土', 'a claymation stop-motion look'],
  ['定格', 'a stop-motion animation look'],
  ['3D渲染', 'a 3D render with physically based shading'],
  ['3D', 'a 3D render'],
  ['写实照片', 'photographic realism'],
  ['照片', 'a photograph'],
  ['动漫', 'anime illustration'],
  ['动漫风', 'anime illustration'],
  ['卡通', 'cartoon artwork'],
  ['插画', 'an illustration'],
  ['漫画', 'comic panel art'],
  ['黑白', 'monochrome'],
  ['单色', 'single-colour'],
  ['胶片颗粒', 'fine film grain'],
  ['颗粒', 'visible grain'],
  ['纸纹', 'subtle paper texture'],
  ['粗糙', 'a rough surface'],
  ['光滑', 'a smooth finish'],
  ['扁平', 'flat vector shapes'],
  ['矢量', 'vector graphics'],
];

/** 布局 / 构图 */
const LAYOUTS = [
  ['竖构图', 'vertical'], ['竖版', 'vertical'], ['竖图', 'vertical'],
  ['横构图', 'horizontal'], ['横版', 'horizontal'], ['横图', 'horizontal'],
  ['方图', 'square'], ['正方形', 'square'],
  ['居中', 'centred'], ['对称', 'symmetrical'], ['三分法', 'rule of thirds'],
  ['留白', 'generous empty space'], ['大留白', 'a large area of empty space'],
  ['满版', 'full-bleed'], ['满构图', 'a full frame with no empty margin'],
  ['对角线', 'a diagonal composition'], ['低角度构图', 'a low-slung composition'],
];

/** 用途 */
const PURPOSES = [
  ['海报', 'poster'], ['封面', 'cover'], ['头像', 'profile avatar'],
  ['壁纸', 'wallpaper'], ['表情包', 'sticker sheet'], ['立绘', 'character reference sheet'],
  ['设定卡', 'character reference sheet'], ['概念图', 'concept design'],
  ['概念设计', 'concept design'], ['产品图', 'product shot'],
  ['电商图', 'e-commerce product image'], ['广告图', 'advertisement'],
  ['漫画格', 'comic panel'], ['分镜', 'storyboard frame'],
  ['插画集', 'illustration'], ['宣传图', 'promotional image'],
];

/** 丢弃词（无实义，不翻译也不保留） */
const DROPS = [
  '请', '帮我', '帮忙', '生成', '画一张', '画个', '画一个', '我要', '想要', '希望',
  '风格', '那种', '感觉', '一点', '稍微', '非常', '特别', '很', '挺',
  '的', '了', '着', '地', '得', '是', '有', '和', '与', '及', '以及', '还有',
  '这', '那', '个', '张', '幅', '里', '中', '上', '下', '一座', '一个', '一条', '一片',
  '图片', '图', '画面', '照片里', '背景里', '上', '风',
];

/**
 * 常见"风格形容词 / 题材词"——中文里这类词往往是多字复合，
 * 词典必须整词收录，否则会被逐字拆开（"赛博朋克"→"赛博"+"朋克"）。
 */
const STYLE_MODIFIERS = [
  ['赛博朋克', 'cyberpunk'], ['蒸汽波', 'vaporwave'], ['蒸汽朋克', 'steampunk'],
  ['法西斯', 'fascist'], ['末日', 'post-apocalyptic'], ['废土', 'wasteland'],
  ['中世纪', 'mediaeval'], ['未来', 'futuristic'], ['科幻', 'science fiction'],
  ['奇幻', 'fantasy'], ['恐怖', 'horror'], ['治愈', 'gentle and comforting'],
  ['怀旧', 'nostalgic'], ['复古', 'retro'], ['日式', 'Japanese'], ['和风', 'Japanese'],
  ['中式', 'Chinese'], ['国风', 'Chinese traditional'], ['欧式', 'European'],
  ['极简', 'minimalist'], ['简约', 'minimalist'], ['华丽', 'ornate'],
  ['可爱', 'cute'], ['帅', 'handsome'], ['优雅', 'elegant'], ['冷峻', 'austere'],
  ['热闹', 'bustling'], ['安静', 'quiet'], ['神秘', 'mysterious'],
  ['霓虹感', 'neon-lit'], ['雨天', 'rainy'], ['雪天', 'snowy'],
];

/** 场景补词：夜景、窗台、湿滑路面这类"复合场景词" */
const SETTING_EXTRA = [
  ['城市夜景', 'a city at night'], ['夜景', 'a night scene'],
  ['雨后', 'after the rain'], ['湿滑的路面', 'wet reflective ground'],
  ['湿滑路面', 'wet reflective ground'], ['路面', 'the ground'],
  ['窗台', 'a windowsill'], ['窗边', 'by the window'], ['天花板', 'the ceiling'],
  ['书架', 'a bookshelf'], ['书桌', 'a desk'], ['床上', 'on a bed'],
  ['草地上', 'on the grass'], ['草地', 'grass'], ['花田', 'a flower field'],
  ['水面', 'the water surface'], ['河面', 'a river'], ['湖面', 'a lake'],
  ['天空', 'the sky'], ['星空', 'a starry sky'], ['云层', 'clouds'],
  ['街道上', 'on a street'], ['街上', 'on a street'], ['街头', 'a street corner'],
  ['森林里', 'in a forest'], ['房间里', 'in a room'],
];

/** 动作补词（含结果补语，避免"晒"这类单字被拆） */
const VERB_EXTRA = [
  ['晒太阳', 'basking in the sun'], ['晒', 'basking'], ['奔跑', 'running'],
  ['逛街', 'walking around'], ['发呆', 'staring into space'],
  ['打电话', 'talking on the phone'], ['看手机', 'looking at a phone'],
  ['做饭', 'cooking'], ['洗衣', 'doing laundry'], ['工作', 'working'],
  ['学习', 'studying'], ['睡觉', 'sleeping'], ['跳舞', 'dancing'],
  ['唱歌', 'singing'], ['演奏', 'playing an instrument'],
  ['钓鱼', 'fishing'], ['放风筝', 'flying a kite'], ['放', 'flying'],
  ['骑', 'riding'], ['骑着', 'riding'], ['飞过', 'flying over'],
  ['盘旋', 'circling'], ['对峙', 'facing off'], ['看文件', 'reading a document'],
  ['做菜', 'cooking'], ['旋转', 'spinning'], ['弹钢琴', 'playing the piano'],
  ['盘在', 'coiled on'], ['爬满', 'covering'], ['坐', 'seated'],
];

/** 环境 / 细节名词（场景类） */
const SCENE_NOUNS = [
  ['小木屋', 'a small wooden cabin'], ['木屋', 'a wooden cabin'],
  ['天际线', 'a skyline'], ['剪影', 'silhouettes'],
  ['藤蔓', 'creeping vines'], ['墙壁', 'the wall'], ['墙', 'a wall'],
  ['雾气', 'mist'], ['雾', 'mist'], ['雷电', 'lightning'],
  ['暴风雨', 'a storm'], ['小船', 'a small boat'], ['海面', 'the sea surface'],
  ['木桌', 'a wooden table'], ['陶瓷杯', 'a ceramic mug'], ['杯子', 'a mug'],
  ['沙发', 'a sofa'], ['扫帚', 'a broom'], ['风筝', 'a kite'],
  ['舞台', 'a stage'], ['聚光灯', 'a spotlight'], ['办公室', 'an office'],
  ['厨房', 'a kitchen'], ['教堂', 'a church'], ['满月', 'a full moon'],
  ['山顶', 'a mountaintop'], ['雪地', 'snowy ground'], ['草地', 'grass'],
  ['海边', 'the seaside'], ['码头', 'a pier'], ['沙滩', 'a beach'],
  ['废墟', 'ruins'], ['森林', 'a forest'], ['街道', 'a street'],
];

/** 题材 / 属性补词（adj 类，修饰主体） */
const ADJ_EXTRA = [
  ['废弃', 'abandoned'], ['古老', 'ancient'], ['破旧', 'dilapidated'],
  ['白色', 'white'], ['红色', 'red'], ['银色', 'silver'], ['金色', 'gold'],
  ['透明', 'transparent'], ['陶瓷', 'ceramic'], ['木质', 'wooden'],
  ['穿着西装', 'in a suit'], ['西装', 'a suit'], ['皱纹', 'deep wrinkles'],
  ['抓拍', 'candid'], ['抓拍感', 'a candid snapshot feel'],
  ['细节', 'fine detail'], ['全身', 'full body'], ['半身', 'half body'],
  ['肖像', 'portrait'], ['海报', 'poster'], ['产品图', 'product shot'],
  ['漫画格', 'comic panel'], ['角色', 'character'], ['舞者', 'dancer'],
  ['厨师', 'chef'], ['女巫', 'sorceress'], ['老人', 'elderly person'],
  ['小孩', 'child'], ['柴犬', 'shiba inu'], ['龙', 'dragon'],
  ['猫', 'cat'], ['白猫', 'white cat'], ['小鱼', 'small fish'],
];

/** 颜色补词（单字"橘"在中文里常指橘色） */
const COLOR_EXTRA = [
  ['橘色', 'orange'], ['橘', 'orange'], ['青绿色', 'teal'], ['青色', 'cyan'],
  ['深色', 'dark'], ['浅色', 'pale'], ['彩色的', 'colourful'], ['彩色', 'colourful'],
];

/* ============================================================================
 * 二、构建词表（按长度降序，保证最长匹配）
 * ============================================================================ */

function buildLexicon() {
  const out = [];
  const push = (zh, en, section, pos, role) => {
    if (!zh) return;
    out.push({ zh, en, section, pos, role: role ?? pos });
  };

  for (const [zh, en] of NUMERALS) push(zh, en, 'subject', 'num', 'num');
  for (const [zh, en] of SUBJECT_NOUNS) push(zh, en, 'subject', 'noun', 'being');
  for (const [zh, en] of APPEARANCE) push(zh, en, 'subject', 'noun', /hair|beard|freckles|bangs|ponytail|tails$/i.test(en) ? 'hair' : 'garment');
  for (const [zh, en] of COLOR_EXTRA) push(zh, en, 'subject', 'adj', 'color');
  for (const [zh, en] of COLORS) push(zh, en, 'subject', 'adj', 'color');
  for (const [zh, en] of VERB_EXTRA) push(zh, en, 'subject', 'verb', 'verb');
  for (const [zh, en] of VERBS) push(zh, en, 'subject', 'verb', 'verb');
  for (const [zh, en] of SETTING_EXTRA) push(zh, en, 'setting', 'place');
  for (const [zh, en] of SCENE_NOUNS) push(zh, en, 'setting', 'place');
  for (const [zh, en] of ADJ_EXTRA) push(zh, en, 'subject', 'adj', 'color');
  for (const [zh, en] of PLACES) push(zh, en, 'setting', 'place');
  for (const [zh, en] of WEATHER_TIME) push(zh, en, 'setting', 'time');
  for (const [zh, en] of BACKDROP) push(zh, en, 'setting', 'place');
  for (const [zh, en] of LIGHTING) push(zh, en, 'lighting', 'light');
  for (const [zh, en] of SHOTS) push(zh, en, 'camera', 'shot');
  for (const [zh, en] of ANGLES) push(zh, en, 'camera', 'angle');
  for (const [zh, en] of LENSES) push(zh, en, 'camera', 'lens');
  for (const [zh, en] of STYLE_MODIFIERS) push(zh, en, 'texture', 'style');
  for (const [zh, en] of STYLE_WORDS) push(zh, en, 'texture', 'style');
  for (const [zh, en] of LAYOUTS) push(zh, en, 'layout', 'layout');
  for (const [zh, en] of PURPOSES) push(zh, en, 'purpose', 'purpose');
  for (const zh of DROPS) push(zh, '', 'drop', 'drop');

  // 介词：'在' 单独出现时是定位词，触发"场景"切分
  //
  // ⚠️ 只在**后面紧跟地点/天气**时才有意义。中文的「在」也出现在
  // 「站在」「坐在」这类动词里（已被整词收录），还有「在…上」这种框式结构。
  // 如果无脑把裸「在」翻成 in，会得到 "in the wind"、"in a street" 这种错句子 ——
  // 所以这里先登记为 preposition，由 splitBySetting 决定是否保留。
  push('在', 'in', 'setting', 'prep');
  push('于', 'in', 'setting', 'prep');
  push('从', 'from', 'setting', 'prep');
  push('朝', 'towards', 'setting', 'prep');
  push('向', 'towards', 'setting', 'prep');

  out.sort((a, b) => b.zh.length - a.zh.length);
  return out;
}

const LEXICON = buildLexicon();
/** 首字索引，避免每个位置都扫全部词条 */
const BY_FIRST = (() => {
  const m = new Map();
  for (const e of LEXICON) {
    const k = e.zh[0];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return m;
})();

/* ============================================================================
 * 三、扫描与分句
 * ============================================================================ */

/** 引号内视为「画面文字」，先摘出来，不参与翻译 */
const QUOTED_RE = /[「『“"]([^」』”"]{1,60})[」』”"]/g;

const CLAUSE_SPLIT_RE = /[，,。；;、：:\n\r|｜]+|\.(?=\s|$)/;

/** 找到位置 i 处最长的词典匹配 */
function matchAt(text, i) {
  const bucket = BY_FIRST.get(text[i]);
  if (!bucket) return null;
  for (const e of bucket) {
    if (text.startsWith(e.zh, i)) return e;
  }
  return null;
}

/**
 * 英文片段的段落归属（用户中英混排时，英文部分原样保留）。
 * 只做关键词提示，认不出就归到主体。
 */
const EN_SECTION_HINTS = [
  { re: /close[- ]?up|medium shot|wide shot|full[- ]?body|half[- ]?body|head[- ]?and[- ]?shoulder|shot size/i, section: 'camera' },
  { re: /high angle|low angle|eye level|bird'?s[- ]eye|top[- ]down|three[- ]quarter view|profile view/i, section: 'camera' },
  { re: /\d+\s?mm|wide[- ]angle|telephoto|macro|depth of field|bokeh/i, section: 'camera' },
  { re: /light|lighting|backlit|rim light|golden hour|neon|moonlight|candle|studio|contrast|shadow|glow/i, section: 'lighting' },
  { re: /watercolou?r|oil painting|gouache|pencil|charcoal|pixel art|cel[- ]?shad|flat colou?r|line ?art|illustration|anime|cartoon|3d render|photograph|photoreal|vector|grain|texture/i, section: 'texture' },
  { re: /poster|cover|avatar|wallpaper|sticker|product shot|concept art|reference sheet|storyboard|comic panel/i, section: 'purpose' },
  { re: /vertical|horizontal|square|centred|symmetrical|rule of thirds|composition|frame|aspect/i, section: 'layout' },
  { re: /\b(?:in|on|at|inside|outside|under|near|beside|behind)\b.*\b(?:city|street|room|forest|beach|park|caf|garden|station|night|rain|snow|dusk)\b/i, section: 'setting' },
];

function classifyEnglish(fragment) {
  const t = String(fragment).trim();
  if (!t) return null;
  for (const h of EN_SECTION_HINTS) {
    if (h.re.test(t)) return h.section;
  }
  return 'subject';
}

/**
 * 扫描一句（无引号）→ 原子序列。
 * 原子：`{ en, section, pos, raw }`；unknown 原子的 en 就是原文。
 */
function scanClause(clause) {
  const text = String(clause);
  const atoms = [];
  let unknown = '';
  let i = 0;

  const flush = () => {
    if (!unknown) return;
    atoms.push({ en: unknown, section: null, pos: 'unknown', raw: unknown });
    unknown = '';
  };

  while (i < text.length) {
    const hit = matchAt(text, i);
    if (hit) {
      flush();
      if (hit.pos !== 'drop') {
        atoms.push({ en: hit.en, section: hit.section, pos: hit.pos, role: hit.role, raw: hit.zh });
      }
      i += hit.zh.length;
    } else {
      unknown += text[i];
      i += 1;
    }
  }
  flush();

  // 整句没有中文时按英文片段处理（中英混排的英文部分会落到这里）
  if (atoms.length === 0) {
    const en = text.trim();
    if (en && !CJK_RE.test(en)) {
      const section = classifyEnglish(en);
      return section ? [{ en, section, pos: 'en', raw: en }] : [];
    }
  }
  return atoms;
}

/* ============================================================================
 * 四、语法小工具
 * ============================================================================ */

/** 名词复数（只处理规则变化 + 少量常见不规则） */
const IRREGULAR_PLURAL = {
  woman: 'women', man: 'men', child: 'children', person: 'people',
  girl: 'girls', boy: 'boys', cat: 'cats', dog: 'dogs', elf: 'elves',
};

function pluralize(word) {
  const w = String(word);
  if (!w) return w;
  if (IRREGULAR_PLURAL[w]) return IRREGULAR_PLURAL[w];
  if (/(?:s|x|z|ch|sh)$/.test(w)) return `${w}es`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

/** 需要冠词的名词短语引导词 */
const NEED_DETERMINER_AFTER = new Set(['wearing', 'holding', 'carrying', 'leaning against', 'with', 'on', 'in', 'beside', 'near']);

/**
 * 把原子序列拼成英文短语 —— **按中文语序重排成英文语序**。
 *
 * 中文的修饰语在名词之前："穿红裙的少女"、"橘色的猫"、"窗台上的猫"。
 * 逐字直译会得到 "a wearing red dress young woman" 这种病句，所以这里按角色分类后重排：
 *
 *   数词 → 名词（复数）→ 颜色/修饰 → 穿着 → 姿态动词 → 位置 → 其它
 *   → "a young woman wearing a red dress"
 *   → "an orange cat seated on a windowsill"
 *
 * 冠词 a/an 按后接词的读音选择，避免 "a orange"。
 */
function joinAtoms(atoms) {
  const nums = [];
  const beings = [];
  const colors = [];
  const garments = [];
  const hairs = [];
  const verbs = [];
  const preps = [];
  const places = [];
  const others = [];

  for (const a of atoms) {
    if (!a.en) continue;
    const role = a.role ?? a.pos;
    if (role === 'num') nums.push(a);
    else if (role === 'being') beings.push(a);
    else if (role === 'color') colors.push(a);
    else if (role === 'garment') garments.push(a);
    else if (role === 'hair') hairs.push(a);
    else if (role === 'verb') verbs.push(a);
    else if (role === 'prep') preps.push(a);
    else if (a.pos === 'place') places.push(a);
    else others.push(a);
  }

  const parts = [];

  // ---- 数词 + 主体名词（颜色若修饰主体，要插在名词前："an orange cat"）
  const num = nums[0];
  const being = beings[0];
  const beingColor = colors.length && !garments.length ? colors.map((c) => c.en).join(' and ') : '';
  const beingPhrase = being
    ? [beingColor, being.en].filter(Boolean).join(' ')
    : '';

  if (num && beingPhrase) {
    const plural = num.en !== 'a';
    parts.push(`${num.en === 'a' ? articleFor(beingPhrase) : num.en} ${plural ? pluralize(beingPhrase) : beingPhrase}`);
  } else if (beingPhrase) {
    parts.push(`${articleFor(beingPhrase)} ${beingPhrase}`);
  } else if (num) {
    parts.push(num.en);
  }

  // ---- 颜色 + 穿着：合并成 "a red dress"；无颜色时也要冠词
  const colorsText = colors.map((c) => c.en).join(' and ');
  if (garments.length) {
    // 多件服饰只取第一件（避免 "a dress a hat" 这种堆叠），其余交给 others
    const g = garments[0].en;
    const phrase = colorsText
      ? `${articleFor(colorsText.split(' ')[0])} ${colorsText} ${g}`
      : `${articleFor(g)} ${g}`;
    parts.push(`wearing ${phrase}`);
  } else if (colorsText && !beingColor) {
    parts.push(colorsText);
  }

  // ---- 头发 / 胡须这类外观（不是衣服，不能写成 "wearing hair"）
  for (const h of hairs) {
    parts.push(`with ${h.en}`);
  }

  // ---- 姿态动作（wearing/holding 已由上面的服饰分支处理，跳过避免重复）
  const CLOTHING_VERBS = /^(?:wearing|holding)$/i;
  for (const v of verbs) {
    if (CLOTHING_VERBS.test(v.en)) continue;
    parts.push(v.en);
  }

  // ---- 位置（裸地点不带介词时补 on/in）
  for (const pl of places) {
    const en = pl.en;
    parts.push(needsPreposition(en) ? `on ${en}` : en);
  }

  // ---- 介词 + 其后成分（保持原顺序，避免丢语义）
  if (preps.length) {
    parts.push(preps.map((p) => p.en).join(' '));
  }

  // ---- 其余（未归类/未翻译）
  for (const o of others) parts.push(o.en);

  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/** a / an 按首字母发音选择 */
function articleFor(word) {
  const w = String(word ?? '').trim();
  if (!w) return 'a';
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}

/** 地点是否已自带介词 */
function needsPreposition(en) {
  return !/^(?:in|at|on|under|near|beside|behind|inside|outside|by|from|towards)\b/i.test(String(en));
}

/**
 * 合并重复介词：同一个短语里出现两次及以上 `on/in/at` 时，只保留第一个。
 *
 * 中文是多句并列（"城市夜景，霓虹灯，雨后湿滑路面"），逐段翻译后拼起来会出现
 * "on a city at night on after the rain on wet reflective ground" —— 读不通。
 * 这里只做介词去重，不动其它词。
 */
function dedupePrepositions(phrase) {
  const text = String(phrase ?? '');
  const seen = new Set();
  return text.replace(/\b(in|on|at|under|near|beside|behind)\b/gi, (m, prep) => {
    const k = prep.toLowerCase();
    if (seen.has(k)) return '';
    seen.add(k);
    return m;
  }).replace(/\s{2,}/g, ' ').trim();
}

/** 首字母大写 */
function cap(s) {
  const t = String(s ?? '').trim();
  if (!t) return t;
  return t[0].toUpperCase() + t.slice(1);
}

/** 列表合并成自然语言（a, b and c） */
function joinList(items) {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** 从主体短语猜代词（动作句的主语） */
function pronounFor(subjectPhrase) {
  const s = String(subjectPhrase);
  if (/\b(?:two|three|four|five|six|seven|eight|nine|ten|women|men|children|people|girls|boys)\b/i.test(s)) return 'They';
  if (/\b(?:woman|girl|sorceress|lady|mother|female)\b/i.test(s)) return 'She';
  if (/\b(?:man|boy|knight|warrior|mage|father|male)\b/i.test(s)) return 'He';
  if (/\b(?:cat|dog|fox|wolf|dragon|robot|android|creature)\b/i.test(s)) return 'It';
  return 'It';
}

/* ============================================================================
 * 五、主流程
 * ============================================================================ */

/**
 * 从中文（或中英混排）文本展开成九段。
 *
 * @param {string} input
 * @param {object} [opts]
 * @returns {{
 *   sections: Record<string,string>,
 *   aspect: string|null,
 *   untranslated: string[],
 *   letteringFromQuotes: string[],
 *   notes: string[],
 * }}
 */
export function expandToSections(input, opts = {}) {
  const raw = String(input ?? '');
  const notes = [];

  /* ---- ① 摘出引号内文字（画面文字，不翻译） ---- */
  const letteringFromQuotes = [];
  const withoutQuotes = raw.replace(QUOTED_RE, (_m, inner) => {
    const t = String(inner).trim();
    if (t) letteringFromQuotes.push(t);
    return '，';
  });

  /* ---- ② 画幅比例（数字优先） ---- */
  let aspect = null;
  const aspectMatch = withoutQuotes.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (aspectMatch) aspect = `${aspectMatch[1]}:${aspectMatch[2]}`;

  /* ---- ③ 分句并扫描 ---- */
  const clauses = withoutQuotes.split(CLAUSE_SPLIT_RE).map((c) => c.trim()).filter(Boolean);
  const atoms = [];
  for (const c of clauses) {
    const scanned = scanClause(c);
    if (!scanned.length) continue;

    // 未匹配的中文按「本句的主导段落」归档；没有主导就归主体
    const votes = new Map();
    for (const a of scanned) {
      if (a.section && a.section !== 'drop') votes.set(a.section, (votes.get(a.section) ?? 0) + 1);
    }
    let dominant = 'subject';
    let best = -1;
    for (const [k, v] of votes) {
      if (v > best) { best = v; dominant = k; }
    }
    for (const a of scanned) {
      if (!a.section) a.section = dominant;
      atoms.push(a);
    }
  }

  /* ---- ④ 按段落归桶 ---- */
  const bucket = (section) => atoms.filter((a) => a.section === section);

  // 布局里的"竖向/横向"同时决定画幅
  const layoutAtoms = bucket('layout');
  if (!aspect) {
    if (layoutAtoms.some((a) => a.en === 'vertical')) aspect = '3:4';
    else if (layoutAtoms.some((a) => a.en === 'horizontal')) aspect = '16:9';
    else if (layoutAtoms.some((a) => a.en === 'square')) aspect = '1:1';
  }
  if (opts.aspect) aspect = String(opts.aspect);

  /* ---- ⑤ 主体 / 场景切分 ---- */
  //
  // 内容按原顺序流过主体与场景两段：遇到第一个「实质场景词」（地点/天气/时间/背景）
  // 就在那里切开。裸介词（在/于/从…）本身**不算**场景起点 ——
  // 它必须紧跟着一个场景词才有意义，否则会产出 "in the wind" 这类错句。
  const contentAtoms = atoms.filter((a) => ['subject', 'setting'].includes(a.section));
  const isRealSetting = (a) => a.section === 'setting' && a.pos !== 'prep';

  let splitIdx = contentAtoms.findIndex(isRealSetting);
  if (splitIdx < 0) splitIdx = contentAtoms.length;
  // 把紧邻的裸介词一并划进场景段（"在 + 雨中" → "in the rain"）
  while (splitIdx > 0 && contentAtoms[splitIdx - 1].pos === 'prep') splitIdx -= 1;

  const subjectAtoms = contentAtoms.slice(0, splitIdx).filter((a) => a.pos !== 'prep');
  // 场景段里孤立的介词（后面没有实质场景词）也丢掉，否则会产出 "in" 这种碎片
  const settingAtoms = contentAtoms.slice(splitIdx).filter((a, i, arr) => (
    a.pos !== 'prep' || isRealSetting(arr[i + 1] ?? {})
  ));

  /* ---- ⑥ 组装各段 ---- */
  const sections = {
    purpose: '',
    layout: '',
    subject: '',
    action: '',
    setting: '',
    lighting: '',
    camera: '',
    texture: '',
    lettering: '',
  };

  /* 用途 */
  const purposes = bucket('purpose').map((a) => a.en);
  if (purposes.length) sections.purpose = `A finished ${purposes[0]}.`;

  /* 布局 */
  if (aspect || layoutAtoms.length) {
    const bits = [];
    if (aspect) {
      const vertical = /^(\d+):(\d+)$/.exec(aspect);
      const orient = vertical && Number(vertical[1]) < Number(vertical[2]) ? 'vertical'
        : (vertical && Number(vertical[1]) > Number(vertical[2]) ? 'horizontal' : 'square');
      bits.push(`a ${orient} ${aspect} frame`);
    }
    const layoutWords = [...new Set(layoutAtoms.map((a) => a.en))].filter((w) => !['vertical', 'horizontal', 'square'].includes(w));
    if (layoutWords.length) bits.push(joinList(layoutWords));
    sections.layout = `The frame is ${bits.join(', ')}.`;
  }

  /* 主体 + 动作 */
  let subjectPhrase = joinAtoms(subjectAtoms);
  let actionPhrase = '';

  if (subjectPhrase) {
    // 把结尾的动词（"a girl standing"）拆出来单独成句，读起来才不别扭
    const tokens = subjectPhrase.split(' ');
    const tailVerbs = [];
    while (tokens.length > 1) {
      const last = tokens[tokens.length - 1].replace(/,$/, '');
      if (/(?:standing|walking|running|seated|lying|reading|smiling|laughing|crying|waving|holding|looking|leaning|playing|drinking|eating|painting|raising|carrying)$/i.test(last)) {
        tailVerbs.unshift(tokens.pop().replace(/,$/, ''));
      } else break;
    }
    subjectPhrase = tokens.join(' ').replace(/,\s*$/, '');
    actionPhrase = tailVerbs.join(' ');
  }

  // 去掉句末悬空介词：中文「坐在窗台上」被拆开后可能留下 "seated on"
  subjectPhrase = subjectPhrase.replace(/\s+(?:on|in|at|of|to|by|from)$/i, '').trim();

  if (subjectPhrase) sections.subject = `The main subject is ${subjectPhrase}.`;

  /* 场景 */
  //
  // 场景段里也可能混进动作补语（"在咖啡馆读书" 的 "读书" 被切到场景段里）。
  // 所以这里先把动作原子抽出来并入 actionPhrase，剩下的才是纯场景。
  const settingVerbs = settingAtoms.filter((a) => a.pos === 'verb');
  const settingOnly = settingAtoms.filter((a) => a.pos !== 'verb');
  if (settingVerbs.length) {
    const extra = settingVerbs.map((a) => a.en).join(' ');
    actionPhrase = actionPhrase ? `${actionPhrase} and ${extra}` : extra;
  }

  // 场景短语：去掉悬空的句末介词，并合并重复的介词（"on a city on after the rain on wet"）
  const settingPhrase = dedupePrepositions(joinAtoms(settingOnly))
    .replace(/\s+(?:in|on|at|of|to|by|from)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const settingStartsWithPrep = /^(?:in|at|on|under|near|beside|behind|inside|outside|from|towards|by)\b/i.test(settingPhrase);

  if (actionPhrase) {
    const pron = pronounFor(subjectPhrase);
    // be 动词随人称变位（They are / She is）
    const be = pron === 'They' ? 'are' : 'is';
    if (settingPhrase && settingStartsWithPrep) {
      sections.action = `${pron} ${be} ${actionPhrase} ${settingPhrase}.`;
      sections.setting = '';
    } else {
      sections.action = `${pron} ${be} ${actionPhrase}.`;
      if (settingPhrase) sections.setting = `The setting is ${settingPhrase}.`;
    }
  } else if (settingPhrase) {
    sections.setting = settingStartsWithPrep
      ? `The setting is ${settingPhrase}.`
      : `The setting is ${settingPhrase}.`;
  }

  /* 光线 */
  const lights = [...new Set(bucket('lighting').map((a) => a.en))];
  if (lights.length) sections.lighting = `The lighting is ${joinList(lights)}.`;

  /* 相机 */
  const shot = bucket('camera').find((a) => a.pos === 'shot');
  const angle = bucket('camera').find((a) => a.pos === 'angle');
  const lens = bucket('camera').find((a) => a.pos === 'lens');
  const camBits = [];
  if (shot) camBits.push(`Frame it as a ${shot.en}`);
  if (angle) camBits.push(angle.en === 'eye level' ? 'at eye level' : `from a ${angle.en}`);
  if (lens) camBits.push(`shot on ${lens.en}`);
  if (camBits.length) {
    sections.camera = `${camBits.join(', ')}.`;
    sections.camera = cap(sections.camera);
  }

  /* 质感 */
  const styles = [...new Set(bucket('texture').map((a) => a.en))];
  if (styles.length) sections.texture = `The rendering is ${joinList(styles)}.`;

  /* 文字 */
  const letteringList = [
    ...letteringFromQuotes,
    ...(Array.isArray(opts.lettering) ? opts.lettering : (opts.lettering ? [opts.lettering] : [])),
  ].map((s) => String(s).trim()).filter(Boolean);
  if (letteringList.length) {
    sections.lettering = letteringList.length === 1
      ? `The only lettering in the image is the text "${letteringList[0]}", set clearly and spelled exactly as written.`
      : `The lettering in the image reads ${letteringList.map((t) => `"${t}"`).join(', ')}, each set clearly and spelled exactly as written.`;
  }

  /* ---- ⑦ 未翻译的中文 ---- */
  const untranslated = [...new Set(
    atoms
      .filter((a) => a.pos === 'unknown' && CJK_RE.test(a.en))
      .map((a) => a.en.trim())
      .filter(Boolean),
  )];
  if (untranslated.length) {
    notes.push(`有 ${untranslated.length} 段中文未能映射成英文，已原样保留`);
  }

  return { sections, aspect, untranslated, letteringFromQuotes, notes };
}

/** 供 lint / index 判断"这段文本是否主要是中文" */
export function cjkRatio(text) {
  const s = String(text ?? '');
  if (!s.length) return 0;
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return cjk / s.length;
}
