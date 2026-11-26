/**
 * H3-Image 客户端 —— 图像生成（文生图 + 参考图编辑 + 批量 + LoRA）。
 *
 * 模型：MiniMax H3-Image（33.1B 扩散 Transformer，open weights）
 *  - 6 步固定采样，guidance 1.0，无 CFG、无负面提示词
 *  - 与 H3 视频**共用** Qwen3-VL 文本编码器（本地已有 25GB 那个）
 *  - 原生 16 MP，width/height=0 时自动 2048×2048
 *  - 单个 checkpoint 同时覆盖文生图与图像编辑：
 *      不接图 = 文生图；接 image_1..N + VAE = 图像编辑/参考生成
 *
 * 显存策略：12GB 必须用 w4a8 量化版（12.55GB）+ --lowvram 分层加载。
 * 默认出图面积 2048×2048（模型调优的画布面积），大尺寸由用户按需指定。
 *
 * ============================================================================
 * 采样为什么"没有可调项"（写死 6 步是**正确**的，不是偷懒）
 * ============================================================================
 *
 * checkpoint 的 safetensors 元数据里带 `pdd_steps: 6` + `pdd_sigmas`
 * （实测本机 w4a8：`[1.0, 0.9675, 0.8875, 0.75, 0.5328, 0.2320, 0.0]`）。
 * ComfyUI 侧 `MiniMaxH3ImageModelSampling` 把 sigma 的**索引**线性映射到这条
 * 网格上（`comfy/ldm/minimax/sampling.py`），`final_layer` 内置 6 套头、
 * 按当前 sigma 落在哪段区间取对应头（`model.py` 的 `_pdd_head`）。
 *
 * 所以：
 *   · 6 步 = 正好每步跨一个网格区间 = 每步用一个头，这是训练态；
 *   · 4 步 = 一步跨 1.5 个区间，头会被 dt 加权平均 —— 能出图，但已离开训练分布；
 *   · 12 步 = 一个区间用 2 步，同一套头被用两次，纯浪费。
 *
 * → UI 不提供步数滑块。`cfg.imageSteps` 保留为**排障用**（画坏时试 4/8/12 定位
 *   是不是 GAN 头错配），但 `/image/meta` 必须回真实生效值，不能只回常量。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import * as comfy from './comfy-client.js';
// 参考图上限的单一真源在 ref-images.js（它与视频的 9 张上限并列声明，见那边的注释）
import { MAX_IMAGE_EDIT_REFS } from './ref-images.js';

/** 默认模型文件（按显存从优到劣） */
export const IMAGE_MODELS = Object.freeze({
  /** 12GB 显存首选 */
  w4a8: 'minimax_h3_image_pruned_w4a8.safetensors',
  /** 21GB，需 16GB+ 或多卡 */
  int8: 'minimax_h3_image_pruned_int8_convrot.safetensors',
  /** 40GB，需 48GB+ */
  bf16: 'minimax_h3_image_pruned_bf16.safetensors',
});

/** 图像 VAE（与视频 VAE 不同） */
export const IMAGE_VAE = 'minimax_h3_image_vae_fp16.safetensors';

/** 文本编码器（与 H3 视频共用） */
export const IMAGE_CLIP = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';

/** 固定采样参数（checkpoint 蒸馏决定，不可调；见文件头注释） */
export const IMAGE_SAMPLING = Object.freeze({
  steps: 6,
  guidance: 1.0,
  sampler: 'euler',
  scheduler: 'simple',
});

/**
 * 提示词输入上限（字符）。
 *
 * 官方是 4096 **token**；按字符收紧到 4096 是**保守**取值（中文字符 token 更密，
 * 4096 字符远不到 4096 token）。这里改名的原因：以前它是 `normalizeImagePrompt`
 * 的隐式默认值，路由层不知道这个数，于是**超长被静默 slice** —— 用户改的
 * 最后一句（"换成红色礼裙"）如果刚好事被截掉，出图没变化且无任何报错。
 * 现在它是**显式契约**：路由层先校验、超长直接 400。
 */
export const IMAGE_PROMPT_MAX_CHARS = 4096;

/** 单次任务最多出几张（`RepeatLatentBatch` 上限内取一个实用值） */
export const IMAGE_MAX_BATCH = 4;

/** 参考图上限（编辑模式）—— 与 `ref-images.js` 的 `MAX_IMAGE_EDIT_REFS` 同源 */
export const IMAGE_MAX_REF_IMAGES = MAX_IMAGE_EDIT_REFS;

/** LoRA 槽位上限（模型链式叠加，超过 6 条对 6 步蒸馏只有负收益） */
export const IMAGE_MAX_LORAS = 6;

/**
 * 模型可接受的 LoRA 强度绝对值上限。
 *
 * 求解器（`solveImageLoraStack`）按分类范围夹紧后还要过这道兜底；
 * 组装节点图时只做**断言**，不再夹一次 —— 组装期静默夹取会让
 * `job.params` / meta 显示的值与实际提交值不一致（那正是"调参完全失去意义"的来源）。
 */
export const IMAGE_LORA_STRENGTH_LIMIT = 2;

/**
 * 官方原生尺寸表（宽 × 高）。
 * 模型调优面积约 4.2 MP；`auto` 走 2048×2048。
 *
 * id 命名约定：`<方向>-<宽>:<高>`，方向 p=竖(portrait) / l=横(landscape) / sq=方 / v=竖屏视频 / h=横屏视频。
 *
 * ⚠️ `mp` 是**真实生效的显存/面积指标**，不是装饰字段。
 *    `mp` 必须参与判断，不能只用来拼 UI 文案 —— 否则 12GB 卡的用户可以
 *    在下拉里选 4096²（16.8 MP，是 2048² 的 4 倍面积）然后 OOM。
 *    `runH3Image` 会拿它跟 `imageMaxMP` 和实际空闲显存比对。
 *
 * ⚠️⚠️ **宽高必须是 32 的倍数**（`CANVAS_MULTIPLE = 32`）。
 *    节点的 `width/height` 声明是 `step=32`，但**这个 step 只是 UI 元数据，
 *    后端不校验**；真正吃尺寸的是 `latent = zeros([..., height//16, width//16])`
 *    再 `patchify_video(patch_size=(1,2,2))` —— 也就是 **16 的倍数**，
 *    遇到奇数 latent 会被 `pad_to_patch_size` 补到偶数，
 *    产物尺寸因此**比请求的大 16 像素**。
 *
 *    表内所有尺寸都必须对齐 32（曾出现 1776/1832/2290 这类非 32 倍数，
 *    请求 2368×1776 实际产出 2368×1792，用户看到的尺寸是假的）。
 *    由 `assertImageSizes()` 守。
 *
 * ⚠️ 历史包袱（不要改 id，会破坏存量数据）：
 *    - `v-16x9` 的实际尺寸是 1440×2560（9:16 竖屏），id 里的 16x9 是**早期笔误**。
 *      几何是对的，只有名字误导；已补 name 说明，并保留 id 兼容。
 *    - `p-3x4-film` 的实际尺寸是 1600×2400（2:3），也不符合 id 里的 3:4。
 *      这里**改名为 `p-2x3-film`**（几何与名字对齐），旧 id 作为别名继续可用。
 */
export const IMAGE_SIZES = Object.freeze([
  { id: 'auto', name: '自动（有参考图时继承原图 / 否则 2048²）', w: 0, h: 0, mp: 4.2, vramGb: 12 },
  { id: 'sq-2048', name: '方图 2048²', w: 2048, h: 2048, mp: 4.2, vramGb: 12 },
  { id: 'p-4x3', name: '竖图 3:4', w: 1792, h: 2368, mp: 4.24, vramGb: 12 },
  { id: 'l-4x3', name: '横图 4:3', w: 2368, h: 1792, mp: 4.24, vramGb: 12 },
  { id: 'p-2x3-film', name: '人物卡 2:3', w: 1600, h: 2400, mp: 3.84, vramGb: 12 },
  { id: 'v-16x9', name: '视频竖 9:16（id 为历史遗留）', w: 1440, h: 2560, mp: 3.69, vramGb: 12 },
  { id: 'h-16x9', name: '视频横 16:9', w: 2560, h: 1440, mp: 3.69, vramGb: 12 },
  { id: 'ecom-sq', name: '电商方图', w: 2048, h: 2048, mp: 4.19, vramGb: 12 },
  { id: 'ecom-45', name: '电商竖 4:5', w: 1824, h: 2304, mp: 4.2, vramGb: 12 },
  { id: 'comic-page', name: '漫画页 3:4', w: 1792, h: 2368, mp: 4.24, vramGb: 12 },
  // 4K 档：面积是 2048² 的 4 倍，12GB 卡必 OOM（README 实测 2048² 已用 11.4GB）
  { id: 'h3-4k-sq', name: '4K 方图 4096²', w: 4096, h: 4096, mp: 16.78, vramGb: 48 },
  { id: 'h3-4k-169', name: '4K 横 16:9', w: 5472, h: 3072, mp: 16.81, vramGb: 48 },
]);

/**
 * 默认出图面积上限（MP）。
 *
 * 为什么是 4.3：2048² = 4.19 MP 是本机（12GB）实测能跑的最大档，
 * 再大就要 `--lowvram` 反复换页，耗时翻几倍且随时 OOM。
 * 用户可以在配置里调 `imageMaxMP` 覆盖（有 48GB 卡的人应该调大）。
 */
export const DEFAULT_MAX_MP = 4.3;

/** 旧尺寸 id → 新 id（历史数据兼容） */
export const IMAGE_SIZE_ALIASES = Object.freeze({
  'p-3x4-film': 'p-2x3-film',
});

/**
 * 尺寸表自检 —— 宽高必须是 32 的倍数，`mp` 必须与几何一致。
 *
 * 为什么要有：`IMAGE_SIZES` 是手写的常量表，而它直接决定"用户请求的尺寸"
 * 与"实际出图尺寸"是否一致。写错一个数字（1776）在 UI 上完全看不出来，
 * 只有出完图量像素才发现 —— 这种错必须被机器挡在启动期。
 *
 * @param {Array<object>} [sizes] 默认检查 `IMAGE_SIZES`（测试可传自定义表）
 * @returns {string[]} 违规说明（空数组 = 全部合规）
 */
export function assertImageSizes(sizes = IMAGE_SIZES) {
  const bad = [];
  const seen = new Set();
  for (const s of (Array.isArray(sizes) ? sizes : [])) {
    if (!s || typeof s.id !== 'string' || !s.id) { bad.push('存在无 id 的尺寸项'); continue; }
    if (seen.has(s.id)) bad.push(`${s.id}: id 重复`);
    seen.add(s.id);
    if (s.w === 0 && s.h === 0) continue;            // auto
    if (!(s.w > 0) || !(s.h > 0)) { bad.push(`${s.id}: 宽高必须同时为正（或同时为 0 表示自动）`); continue; }
    if (s.w % 32 !== 0 || s.h % 32 !== 0) {
      bad.push(`${s.id}: ${s.w}×${s.h} 不是 32 的倍数（会被节点补边，实际产出尺寸与请求不符）`);
    }
    const realMP = (s.w * s.h) / 1e6;
    if (typeof s.mp === 'number' && Math.abs(s.mp - realMP) > 0.02) {
      bad.push(`${s.id}: mp=${s.mp} 与几何 ${realMP.toFixed(2)} 不一致`);
    }
  }
  return bad;
}

/** 按 id 取尺寸（支持别名）；找不到回落 auto */
export function imageSize(id) {
  const key = String(id ?? '');
  const normalized = IMAGE_SIZE_ALIASES[key] ?? key;
  return IMAGE_SIZES.find((s) => s.id === normalized) ?? IMAGE_SIZES[0];
}

/**
 * 推导模型根目录。优先级：
 *  1) 配置里的 imageModelRoot（显式指定）
 *  2) 配置的 comfyInputDir 的兄弟/祖父目录 models
 *  3) 环境变量 H3_MODEL_ROOT / COMFY_MODEL_ROOT
 *  4) ComfyUI 的 extra_model_paths / 自身目录反推（通过 comfyUrl 的目录结构）
 *  5) 从插件自身位置向上找 models / ai-runtime/models
 *
 * ⚠️ 这里**不允许**出现硬编码盘符路径。
 *    写死 `F:\AI视频\ai-runtime\models` 会让插件"在本机能用、发给别人就废"，
 *    而且用户无从得知原因。
 */
export function resolveModelRoot(cfg = loadConfig()) {
  const candidates = [];

  if (cfg.imageModelRoot) candidates.push(cfg.imageModelRoot);

  if (cfg.comfyInputDir) {
    candidates.push(path.resolve(cfg.comfyInputDir, '..', 'models'));
    candidates.push(path.resolve(cfg.comfyInputDir, '..', '..', 'models'));
  }

  for (const envKey of ['H3_MODEL_ROOT', 'COMFY_MODEL_ROOT', 'COMFYUI_MODEL_ROOT']) {
    const v = process.env[envKey];
    if (v) candidates.push(v);
  }

  // 从 ComfyUI 的 input 目录反推（用户只需配 comfyInputDir 一处）
  if (cfg.comfyInputDir) {
    candidates.push(path.resolve(cfg.comfyInputDir, '..', 'models'));
  }

  // 从插件自身位置向上找（插件可能放在任意位置）
  try {
    const here = import.meta.dirname;   // .../host/services
    let dir = here;
    for (let i = 0; i < 6; i++) {
      dir = path.dirname(dir);
      candidates.push(path.join(dir, 'models'));
      candidates.push(path.join(dir, 'ai-runtime', 'models'));
      candidates.push(path.join(dir, 'ComfyUI', 'models'));
    }
  } catch { /* ignore */ }

  // 取第一个「真的存在 diffusion_models 子目录」的
  for (const c of candidates) {
    if (!c) continue;
    try {
      if (fs.existsSync(path.join(c, 'diffusion_models'))) return c;
    } catch { /* ignore */ }
  }
  return candidates.find(Boolean) ?? '';
}

/**
 * 按用途推荐尺寸（模特/漫画/画布）。
 *
 * **唯一消费者**是画布与拆解侧的"我想要什么形状"语义：
 *   · 画布 AI 图片节点（`purpose: 'canvas'`）
 *   · 立绘拆解的默认档（`purpose: 'film-turnaround'`）
 * 没有它的时候这些调用点各自写死 `sq-2048`，于是"加一个新用途"要改三处。
 *
 * @param {string} purpose
 * @param {object} [cfg] 读 `imageSizeId` 作为全局默认（用户在配置里改过就用他的）
 */
export function sizeForPurpose(purpose, cfg = loadConfig()) {
  const map = {
    'ecom': 'ecom-sq',
    'ecom-detail': 'ecom-sq',
    'ecom-45': 'ecom-45',
    'film-base': 'p-2x3-film',
    'film-turnaround': 'p-2x3-film',
    'film-exp': 'p-2x3-film',
    'comic-page': 'comic-page',
    'comic-panel': 'sq-2048',
    'canvas': 'sq-2048',
    'video-frame': 'h-16x9',
  };
  const fromPurpose = map[String(purpose ?? '')];
  if (fromPurpose) return fromPurpose;
  const fromCfg = String(cfg?.imageSizeId ?? '');
  if (fromCfg && IMAGE_SIZES.some((s) => s.id === fromCfg)) return fromCfg;
  return 'sq-2048';
}

/** 检查本地模型是否就绪 */
export function checkImageModels(cfg = loadConfig()) {
  const root = resolveModelRoot(cfg);
  const unetDir = path.join(root, 'diffusion_models');
  const vaeDir = path.join(root, 'vae');
  const clipDir = path.join(root, 'text_encoders');

  const found = {
    unet: [], vae: [], clip: [],
  };
  const scan = (dir, list) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.safetensors')) list.push(f);
    }
  };
  scan(unetDir, found.unet);
  scan(vaeDir, found.vae);
  scan(clipDir, found.clip);

  const pickUnet = ['w4a8', 'int8', 'bf16']
    .map((k) => IMAGE_MODELS[k])
    .find((f) => found.unet.includes(f)) ?? null;
  const hasVae = found.vae.includes(IMAGE_VAE);
  const hasClip = found.clip.includes(IMAGE_CLIP);

  return {
    ready: Boolean(pickUnet && hasVae && hasClip),
    unet: pickUnet,
    vae: hasVae ? IMAGE_VAE : null,
    clip: hasClip ? IMAGE_CLIP : null,
    missing: [
      !pickUnet ? `diffusion_models/${IMAGE_MODELS.w4a8}` : null,
      !hasVae ? `vae/${IMAGE_VAE}` : null,
      !hasClip ? `text_encoders/${IMAGE_CLIP}` : null,
    ].filter(Boolean),
    root,
    found,
  };
}

/**
 * 实际生效的采样步数（配置夹到 4–12；见文件头"为什么没有可调项"）。
 *
 * `imageSteps` 是**排障开关**：画坏时试 4/8/12 定位是不是 GAN 头错配。
 * 但局部重绘这条链路必须以训练态（6 步）运行 —— `steps≠6` 与 `denoise<1`
 * 是同一个失败模式（`int(6/denoise)` 与步数都决定 PDD 网格怎么被切），
 * 所以传 `{ forInpaint: true }` 时忽略配置，恒用 `IMAGE_SAMPLING.steps`。
 * 要让 inpaint 也离开训练态，必须显式传 `allowOffGridSteps`（并会写进 warnings）。
 *
 * @param {object} [cfg]
 * @param {{forInpaint?:boolean, allowOffGridSteps?:boolean}} [opts]
 */
export function effectiveImageSteps(cfg = loadConfig(), opts = {}) {
  const raw = Number(cfg?.imageSteps);
  const configured = Number.isFinite(raw) && raw >= 1
    ? Math.max(4, Math.min(12, Math.round(raw)))
    : IMAGE_SAMPLING.steps;
  if (opts.forInpaint && !opts.allowOffGridSteps) return IMAGE_SAMPLING.steps;
  return configured;
}

/** 实际生效的面积上限（MP） */
export function effectiveMaxMP(cfg = loadConfig()) {
  const raw = Number(cfg?.imageMaxMP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_MP;
}

/**
 * ComfyUI 是否提供 `LoraLoaderBypassModelOnly`（bypass 式 LoRA 加载）。
 *
 * ============================================================================
 * 为什么必须是探测而不是写死
 * ============================================================================
 *
 * 这个节点在 `comfy_extras/nodes_lora_debug.py` 里，属于**较新版本才有**的
 * 调试节点（名字里带 debug 就是这个意思）。写死 class_type 的后果很直接：
 *
 *   · 节点不存在时 ComfyUI 报 `Node 'LoraLoaderBypassModelOnly' not found`
 *   · 这条错误完全看不出"是 LoRA 加载方式的问题"，用户只会以为插件坏了
 *
 * 而两条路径的**性能差异巨大**（w4a8 量化底座，768² 出图实测）：
 *   改权重式 LoraLoaderModelOnly     123.8 秒（每层 dequantize→加 LoRA→requantize）
 *   bypass 式 LoraLoaderBypassModelOnly 87.8 秒（只挂前向钩子，不碰基座权重）
 * 改权重式还会因**随机重量化**让脸/头发/线稿发糊。
 *
 * 所以策略是：能 bypass 就 bypass，不能就回退并**明确告知用户后果**。
 *
 * 抽成模块级函数是为了让 inpaint 与普通出图**共用同一套探测逻辑** ——
 * 原先 inpaint 直接写死 bypass，在缺节点的环境上 100% 失败。
 *
 * @param {object} cfg
 * @returns {Promise<boolean>}
 */
export async function probeBypassLora(cfg = loadConfig()) {
  try {
    const base = await comfy.resolveComfyUrl(cfg);
    if (!base) return false;
    const r = await fetch(`${base}/object_info/LoraLoaderBypassModelOnly`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j?.LoraLoaderBypassModelOnly);
  } catch { return false; }
}

/** 回退到改权重式 LoRA 时给用户的警告（含实测数据与建议） */
export function bypassLoraFallbackWarning(loraCount) {
  return `挂了 ${loraCount} 条 LoRA，但 ComfyUI 里没有 LoraLoaderBypassModelOnly，`
    + '已回退到改权重式加载。w4a8 量化模型上这条路每层都要反量化→加权→随机重量化：'
    + '实测 768² 出图从约 69 秒变成 124 秒，且随机重量化会让脸/头发/线稿发糊。'
    + '建议升级 ComfyUI（bypass 节点在 comfy_extras/nodes_lora_debug.py）'
    + '或换 int8_convrot / bf16 底座。';
}

/**
 * 出图提示词 → 最终提交文本（**传输层清洗**，不改写语义）。
 *
 * 这里只做两件事，都是"把文本安全地送进编码器"的必需品：
 *   1. 去掉 Markdown 记号 —— `**粗体**`、`### 标题`、行内 `代码` 是给人看的排版，
 *      送进模型会变成无意义字符，还会挤占 token 预算。
 *   2. 压缩空白 —— 多个空行/行尾空格对生成没有帮助，只会让段落结构变糊。
 *
 * ⚠️ **不截断。**
 *    截断是"改了提示词却没生效"最隐蔽的一种：用户在末尾加的
 *    "换成红色礼裙"如果刚好被切掉，出图没变化，没有任何报错可查。
 *    长度校验上移到路由层（超长直接 400 `PROMPT_TOO_LONG`）。
 *    传 `maxChars` 仍会断言而不静默切 —— 给测试与离线批处理用。
 *
 * ⚠️ **不做语义改写。**
 *    曾有实现把「不要 X」正则替换成「避免 X」，依据是"H3-Image 无负面提示词"。
 *    这个依据是错的：`MiniMaxH3ImageConditioning` 根本没有 negative 输入通道
 *    （见 /object_info），prompt 是自由文本，编码器正常理解"不要/禁止"。
 *    而且正则 `[^\s，。；,.;]{1,12}` 只能吃到短词，同一句里长词漏改，
 *    结果出现「避免美化、不要改动设计」这种自相矛盾的句子 —— 比不改更糟。
 *
 * @param {string} prompt
 * @param {{maxChars?: number, assert?: boolean}} [opts]
 * @returns {string}
 */
export function normalizeImagePrompt(prompt, opts = {}) {
  let p = String(prompt ?? '');

  // 1) Markdown → 纯文本
  p = p
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // **bold**
    .replace(/__([^_]+)__/g, '$1')          // __bold__
    .replace(/`([^`]+)`/g, '$1')            // `code`
    .replace(/^#{1,6}\s+/gm, '')            // # 标题
    .replace(/^\s*[-*+]\s+/gm, '- ')        // 统一列表符号
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // 链接留文字

  // 2) 空白
  p = p.replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 3) 只断言、不截断
  if (Number.isFinite(opts.maxChars) && p.length > opts.maxChars && opts.assert !== false) {
    const e = new Error(
      `PROMPT_TOO_LONG: 清洗后 ${p.length} 字符，超过上限 ${opts.maxChars}。`
      + '不会静默截断（那会让你写的要求被悄悄丢掉），请精简后再提交。',
    );
    e.code = 'PROMPT_TOO_LONG';
    throw e;
  }
  return p;
}

/**
 * 校验一次出图请求的入参（路由层与工具层共用，避免两处规则漂移）。
 *
 * @param {object} body 原始请求体
 * @param {object} [cfg]
 * @returns {{prompt:string, promptChars:number, sizeId:string, width:number, height:number,
 *            seed:number, count:number, loras:Array<{name:string,strength:number}>}}
 * @throws 入参不合法时抛带明确错误码的 Error
 */
export function validateImageRequest(body = {}, cfg = loadConfig()) {
  const rawPrompt = String(body.prompt ?? '');
  if (!rawPrompt.trim()) {
    const e = new Error('PROMPT_REQUIRED: 提示词不能为空');
    e.code = 'PROMPT_REQUIRED';
    throw e;
  }
  const prompt = normalizeImagePrompt(rawPrompt, { maxChars: IMAGE_PROMPT_MAX_CHARS });
  const chars = prompt.length;
  if (chars > IMAGE_PROMPT_MAX_CHARS) {
    const e = new Error(
      `PROMPT_TOO_LONG: 提示词 ${chars} 字符，超过上限 ${IMAGE_PROMPT_MAX_CHARS}。`
      + '不会静默截断（以免你写的要求被悄悄丢掉），请精简后再提交。',
    );
    e.code = 'PROMPT_TOO_LONG';
    e.detail = { chars, maxChars: IMAGE_PROMPT_MAX_CHARS };
    throw e;
  }

  // 尺寸：显式宽高优先（32 倍数且 ≥ 32），否则按 sizeId
  let width = Number(body.width);
  let height = Number(body.height);
  const hasW = Number.isFinite(width) && width > 0;
  const hasH = Number.isFinite(height) && height > 0;
  if (hasW !== hasH) {
    const e = new Error('SIZE_INCOMPLETE: 自定义宽高必须同时给出');
    e.code = 'SIZE_INCOMPLETE';
    throw e;
  }
  if (hasW && hasH) {
    width = Math.round(width / 32) * 32;
    height = Math.round(height / 32) * 32;
    if (width < 256 || height < 256) {
      const e = new Error(`SIZE_TOO_SMALL: ${width}×${height}，边长至少 256`);
      e.code = 'SIZE_TOO_SMALL';
      throw e;
    }
  }

  const sizeId = String(body.sizeId ?? body.imageSizeId ?? cfg?.imageSizeId ?? 'auto');

  let seed = Number(body.seed);
  if (!Number.isFinite(seed) || seed < 0) seed = Math.floor(Math.random() * 2147483647);
  seed = Math.floor(seed) % 2147483648;

  const countRaw = Number(body.count);
  const count = Number.isFinite(countRaw) && countRaw >= 1
    ? Math.max(1, Math.min(IMAGE_MAX_BATCH, Math.floor(countRaw)))
    : 1;

  const loras = Array.isArray(body.loras)
    ? body.loras
      .map((x) => (typeof x === 'string' ? { name: x } : x))
      .filter((x) => x && typeof x.name === 'string' && x.name.trim())
      .map((x) => ({ name: x.name.trim(), strength: Number(x.strength) }))
    : [];

  return { prompt, promptChars: chars, sizeId, width: hasW ? width : 0, height: hasH ? height : 0, seed, count, loras };
}

/**
 * 执行一次 H3-Image 生成。
 *
 * @param {object} opts
 * @param {object} opts.workflow  h3-image.json（API 格式，**不改动模板本身**）
 * @param {object} opts.job       运行中的 job
 * @param {string} opts.prompt    提示词
 * @param {string} [opts.sizeId]  尺寸 id
 * @param {number} [opts.width]   显式宽（覆盖 sizeId；32 倍数）
 * @param {number} [opts.height]  显式高
 * @param {string[]} [opts.refImages] 参考图绝对路径（编辑模式；**第 1 张 = 被编辑原图**）
 * @param {number} [opts.count]   出几张（1..IMAGE_MAX_BATCH，走 RepeatLatentBatch）
 * @param {Array<{name:string,strength:number}>} [opts.loras] LoRA 栈（已求解）
 * @param {(remoteId:string, job:object)=>Promise<void>} [opts.onSubmitted]
 * @param {(p:{pct:number, note:string, queue?:object})=>Promise<void>|void} [opts.onProgress]
 * @param {boolean} [opts.allowOversize]
 */
export async function runH3Image({
  workflow, job, prompt, sizeId = 'auto', width, height,
  refImages = [], count = 1, loras = [],
  cfg = loadConfig(), onSubmitted, onProgress,
  // 显式放行面积/显存守卫。只有明确知道自己在做什么的调用方（例如批量
  // 后处理、离线超分）才该传 true；普通出图不要传。
  allowOversize = false,
}) {
  if (!workflow) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');

  const models = checkImageModels(cfg);
  if (!models.ready) {
    throw new Error(`IMAGE_MODEL_MISSING: 缺少 ${models.missing.join(', ')}`);
  }

  const refList = (Array.isArray(refImages) ? refImages : []).filter(Boolean);
  if (refList.length > IMAGE_MAX_REF_IMAGES) {
    throw new Error(
      `IMAGE_TOO_MANY_REFS: 参考图 ${refList.length} 张，超过上限 ${IMAGE_MAX_REF_IMAGES}。`
      + '再多只会稀释每张图的注意力，建议合并成一张拼图或减少参考。',
    );
  }

  const size = imageSize(sizeId);
  const W = Number.isFinite(Number(width)) && Number(width) > 0 ? Math.round(Number(width) / 32) * 32 : size.w;
  const H = Number.isFinite(Number(height)) && Number(height) > 0 ? Math.round(Number(height) / 32) * 32 : size.h;

  /* ---------------------------------------------------- 面积 / 显存守卫 */
  //
  // ⚠️ `IMAGE_SIZES` 必须被面积/显存守卫拦住，不能无条件全放行：
  //    4096² 与 5472×3072 是 16.8 MP，而 README 实测 2048² 已用掉 11.4 GB / 12 GB，
  //    4K 是它的 4 倍面积。
  //    用户在下拉里一点就 OOM，且错误信息来自 ComfyUI 内部（看不懂）。
  //
  //    现在两道闸：
  //      ① 面积上限（默认 4.3 MP，可由 cfg.imageMaxMP 覆盖）
  //      ② 空闲显存（拿得到 VRAM 状态时比对，防"面积合法但卡上没地方"）
  //
  //    两道闸都可**显式放行**：传 `allowOversize: true`（配置层调用方用）。
  //    拒绝时说清楚上限是多少、去哪调，不要让用户猜。
  const maxMP = effectiveMaxMP(cfg);
  const wantMP = ((W || 2048) * (H || 2048)) / 1e6;
  if (!allowOversize && wantMP > maxMP + 1e-6) {
    const hint = size.vramGb ? `；该档建议 ${size.vramGb} GB 显存` : '';
    throw new Error(
      `IMAGE_TOO_LARGE: 请求 ${W || 2048}×${H || 2048} = ${wantMP.toFixed(1)} MP，`
      + `超过上限 ${maxMP} MP${hint}。`
      + `请在设置里改「单张出图面积上限」（imageMaxMP）或选更小的尺寸。`,
    );
  }

  // 显存闸：只在**明显不够**时拦，不做精确预算。
  //
  // ⚠️ 这里的原则是"宁可放过，也不要误伤"。
  //
  //    实测教训：ComfyUI 的 `vram_free` 在 --lowvram 模式下**远低于可用余量** ——
  //    模型是分块按需换入换出的，常驻只占 2–3 GB，此时 vram_free 只有 2.5 GB，
  //    但实际能跑 2048²（需要 staged 30 GB，靠动态换页）。
  //    早期版本拿"该尺寸建议 12 GB"去比 vram_free，于是每次跑完一单之后
  //    下一单必被拒（`IMAGE_VRAM_LOW: 空闲显存约 2.5 GB`），
  //    连续出图完全不可用 —— 而且用户看到的是一个"看起来很有道理"的错误。
  //
  //    正确做法：只拦**真的没救**的情况（空闲低于 ComfyUI 自己都起不来的量）。
  //    真正的 OOM 由 ComfyUI 报错，那条错误是准确的；我们不该抢在它前面猜。
  if (!allowOversize) {
    const vram = await comfy.vramStatus(cfg).catch(() => null);

    /**
     * 必须先用 `vram.ok` 判断**探测是否成功**，再看数值。
     *
     * `vramStatus` 在一切失败路径（ComfyUI 没起、老版本 /system_stats 没有
     * devices、非 NVIDIA、3 秒超时）都返回 `{ ok: false, freeBytes: 0 }`。
     * 若只判 `freeGb >= 0 && freeGb < floorGb`，那个 `0` 会让三个条件全真，
     * 于是每次出图都报「空闲显存仅 0.00 GB」并 400 拒绝。
     *
     * 修法：`ok` 为假 = 探测失败 = **跳过闸门**，让 ComfyUI 自己去报真正的 OOM。
     */
    if (vram?.ok) {
      const freeGb = Number(vram.freeBytes) / (1024 ** 3);
      const totalGb = Number(vram.totalBytes) / (1024 ** 3);
      // 阈值取显存总量的 12%，但至少留 1.2 GB：
      //   12 GB 卡 → 1.44 GB；24 GB 卡 → 2.88 GB
      const floorGb = Math.max(1.2, Number.isFinite(totalGb) ? totalGb * 0.12 : 1.2);
      if (Number.isFinite(freeGb) && freeGb < floorGb) {
        throw new Error(
          `IMAGE_VRAM_LOW: 空闲显存仅 ${freeGb.toFixed(2)} GB（阈值 ${floorGb.toFixed(2)} GB）。`
          + '请先关掉其它占用显卡的程序，或重启 ComfyUI，或换更小的尺寸。',
        );
      }
    }
  }

  // 参考图 → ComfyUI（编辑模式）。必须 await：图片没送进去就直接报错，
  // 绝不能静默退化成纯文生图。
  const staged = refList.length
    ? await comfy.stageToComfyInput(
      cfg,
      Object.fromEntries(refList.map((abs, i) => [`{{IMG_REF_${i + 1}}}`, abs])),
      job.id,
    )
    : {};

  const steps = effectiveImageSteps(cfg);

  const map = {
    '{{PROMPT}}': normalizeImagePrompt(prompt, { maxChars: IMAGE_PROMPT_MAX_CHARS }),
    '{{WIDTH}}': W,
    '{{HEIGHT}}': H,
    '{{SEED}}': job.params?.seed ?? Math.floor(Math.random() * 2147483647),
    '{{STEPS}}': steps,
    '{{UNET_NAME}}': models.unet,
    '{{VAE_NAME}}': models.vae,
    '{{CLIP_NAME}}': models.clip,
    '{{COUNT}}': Math.max(1, Math.min(IMAGE_MAX_BATCH, Math.floor(Number(count) || 1))),
  };

  const wf = structuredClone(workflow);
  // ComfyUI 会把非数字 key 也当节点解析 → `_comment` 必须剔除，否则 500
  for (const k of Object.keys(wf)) {
    if (!/^\d+$/.test(k)) delete wf[k];
  }

  /**
   * 节点号分配（**避开模板已有节点**）。
   *
   * 模板 `h3-image.json` 固定占 1..11：
   *   1 UNETLoader / 2 CLIPLoader / 3 VAELoader / 4 Conditioning / 5 RandomNoise
   *   6 KSamplerSelect / 7 BasicScheduler / 8 BasicGuider / 9 SamplerCustomAdvanced
   *   10 VAEDecode / 11 SaveImage
   *
   * 运行时注入的节点用**两个不重叠的段**，防止参考图与 LoRA 互相踩号：
   *   20..35  LoadImage（参考图，最多 16 张）
   *   40..45  LoraLoaderModelOnly（LoRA，最多 6 条）
   */
  const REF_SLOT_BASE = 20;
  const LORA_SLOT_BASE = 40;

  /** 模型链路出口（会被 LoRA 逐级改写）：1 → [LoRA..] */
  let modelOut = ['1', 0];

  /* ---------------------------------------------------------- LoRA 注入 */
  //
  // ⚠️ 为什么不在 h3-image.json 里预置 LoRA 节点：
  //    模板是**随插件分发**的静态文件，用户自己也可能改过它。把可选链路写进
  //    模板意味着"没有 LoRA 时"要留一堆 disabled 节点或空 lora_name，
  //    而 ComfyUI 对空 lora_name 是**报错**（不是跳过）。
  //    运行时按需注入 + 不注入时链路直接 UNET→采样器，是最不容易坏的做法。
  //
  // ⚠️ 顺序：LoRA 必须在**采样器之前**、且在 UNETLoader 之后。
  //    `BasicScheduler.model` 与 `BasicGuider.model` 两处都要改指向，
  //    只改一处会导致「sigma 网格来自裸模型、去噪来自打了 LoRA 的模型」——
  //    这种不一致不报错，只是画质悄悄变差。
  //
  // ============================================================================
  // ⚠️ 量化底座上应当用 **bypass** 模式，不要用改权重式 LoRA（真机实测）
  // ============================================================================
  //
  // 实测（w4a8 / 768×768 / 6 步 / 1 条 LoRA / 队列独占，三组各跑一次）：
  //   无 LoRA                          69.2 秒   基准
  //   `LoraLoaderModelOnly`（改权重）  123.8 秒  ×1.79
  //   `LoraLoaderBypassModelOnly`       87.8 秒  ×1.27（比改权重快 29%）
  //
  // 根因在 ComfyUI 的补丁路径：改权重式 LoRA 每个被命中的 Linear 都要走
  //   `dequantize → 加 LoRA → requantize_from_float`
  // （`comfy/ops.py` 的 `convert_weight` / `set_weight` + `quant_ops`），
  // 416 个目标张量 × 50 层 × 6 步。而且**随机重量化本身会给权重引入噪声** ——
  // 这是画质问题，比速度更值得在意（Civitai 上 `Artistic Solo Anatomy` 的作者
  // 对 NVFP4 底座给过同样的警告：脸、头发、线稿会糊）。
  //
  // `LoraLoaderBypassModelOnly`（`comfy_extras/nodes_lora_debug.py`）走另一条路：
  //   `output = base_forward(x) + lora_path(x)`
  // 它**不碰基座权重**，把 LoRA 作为前向钩子注入（`comfy/sd.py` 的
  // `load_bypass_lora_for_models` → `BypassInjectionManager`），
  // 所以量化权重不需要反量化再重量化 —— 既省时间，也不引入重量化噪声。
  //
  // ⚠️ 但 bypass ≠ 免费：仍有前向钩子开销，实测 ×1.27 而非 ×1.0。
  //    不要声称"挂了 LoRA 不影响速度"。
  //
  // 所以：量化 checkpoint（w4a8 / int8 / fp8 / nvfp4）走 bypass；
  // 非量化（bf16/fp16）两侧差距更小，仍走 bypass 以保持一致。
  // 但 bypass 是 ComfyUI 标记为 EXPERIMENTAL 的调试节点 —— 节点不存在时**回退**
  // 到普通 LoRA（并在 warnings 里说明代价），而不是让整个出图失败。
  const loraList = (Array.isArray(loras) ? loras : [])
    .filter((l) => l && typeof l.name === 'string' && l.name.trim())
    .slice(0, IMAGE_MAX_LORAS);

  /** bypass 节点是否可用（探测一次；不可用时回退普通 LoRA） —— 见模块级导出 */
  const bypassLoraSupported = () => probeBypassLora(cfg);

  let loraMode = 'none';
  if (loraList.length) {
    const useBypass = await bypassLoraSupported();
    loraMode = useBypass ? 'bypass' : 'patch';
    let prev = modelOut;
    for (let i = 0; i < loraList.length; i += 1) {
      const slot = String(LORA_SLOT_BASE + i);
      const strength = Number.isFinite(Number(loraList[i].strength)) ? Number(loraList[i].strength) : 1.0;
      wf[slot] = {
        class_type: useBypass ? 'LoraLoaderBypassModelOnly' : 'LoraLoaderModelOnly',
        inputs: {
          model: prev,
          lora_name: loraList[i].name.trim(),
          strength_model: Math.max(-2, Math.min(2, strength)),
        },
      };
      prev = [slot, 0];
    }
    modelOut = prev;
    const sched = wf['7'];
    if (sched?.class_type === 'BasicScheduler') sched.inputs.model = modelOut;
    const guider = wf['8'];
    if (guider?.class_type === 'BasicGuider') guider.inputs.model = modelOut;
  }

  /**
   * ⚠️ 回退警告：只有在 ComfyUI 缺 bypass 节点、不得不走改权重模式时才发。
   *
   * 实测（w4a8 / 768² / 6 步 / 1 条 / 队列独占）：
   *   无 LoRA 69.2s → 改权重 123.8s（×1.79）→ bypass 87.8s（×1.27）
   *
   * 所以回退的代价是"多 40% 时间 + 每层随机重量化带来的画质噪声"，
   * 不是"慢 8 倍"（那个数字来自一次受队列竞争污染的测量，已修正）。
   */
  const loraPerfWarning = (
    loraList.length && loraMode === 'patch' ? bypassLoraFallbackWarning(loraList.length) : ''
  );

  //
  // ⚠️ 关键：`images` 是 AUTOGROW 输入，官方模板里的输入名是 **`images.image_1`**
  //    （带点号的路径形式），不是 `images` 数组、也不是 `image_1`。
  //    实测错误写法（静默失效，参考图完全不生效）：
  //      inputs.images      = [["20", 0]]   ❌ 被当成普通数组忽略
  //      inputs.image_1     = ["20", 0]     ❌ TypeError: unexpected keyword 'image_1'
  //    正确写法：
  //      inputs["images.image_1"] = ["20", 0]   ✅
  //      inputs["images.image_2"] = ["21", 0]   ✅
  //
  // ⚠️ `image_1` 语义特殊：节点用它的（缩放后）尺寸决定输出画布（width/height=0 时），
  //    并把它当作"被编辑的原图"。所以**用户给的第 1 张必须原样落在 image_1**，
  //    这里不做任何重排/去重（顺序即语义，与视频槽位规则完全不同）。
  const refNames = refList.map((_, i) => staged[`{{IMG_REF_${i + 1}}}`]).filter(Boolean);
  if (refNames.length !== refList.length) {
    throw new Error(
      `IMAGE_REF_STAGE_INCOMPLETE: 送入 ComfyUI 的参考图 ${refNames.length}/${refList.length} 张。`
      + '（不能静默退化成少几张 —— 那会让你以为参考生效了）',
    );
  }
  if (refNames.length) {
    const condNode = wf['4'];
    if (condNode?.class_type !== 'MiniMaxH3ImageConditioning') {
      throw new Error(`WORKFLOW_SHAPE_CHANGED: 节点 4 应为 MiniMaxH3ImageConditioning，实际 ${condNode?.class_type ?? '缺失'}`);
    }
    // 清掉任何可能存在的旧形式，避免混淆
    delete condNode.inputs.images;
    for (const k of Object.keys(condNode.inputs)) {
      if (/^image_\d+$/.test(k)) delete condNode.inputs[k];
    }
    for (let i = 0; i < refNames.length; i++) {
      const slot = String(REF_SLOT_BASE + i);
      wf[slot] = {
        class_type: 'LoadImage',
        inputs: { image: refNames[i] },
      };
      condNode.inputs[`images.image_${i + 1}`] = [slot, 0];
    }
  }

  /* -------------------------------------------------------- 批量出图 */
  //
  // 用 `RepeatLatentBatch` 复制 latent，而不是"跑 N 次任务"，理由：
  //   · 模型只加载一次（12GB 卡上 profile 加载约 40s，跑 4 次就白烧 2 分钟）
  //   · 每个 batch 元素独立采样（RandomNoise 的 noise 会按 batch 展开），
  //     所以同 seed 不同元素也不会出同一张图
  //
  // ⚠️ 但 H3-Image 的 DiT **不支持 batch>1**：
  //    `comfy/ldm/minimax/model.py` 的 `MiniMaxH3ImageModel._forward` 明确
  //    raise `ValueError("MiniMax H3 supports batch size 1")`。
  //    所以"一次采样出 N 张"在这条链路上是**不可行**的 —— 只能 N 次采样。
  //
  //    这里的做法：count>1 时**不复制 latent**，而是让上层按 count 拆成 N 个
  //    独立任务（见 `splitBatchSeeds`）。本函数保持"一次一个 job"的契约，
  //    `count` 只在返回里回报，真正的展开在路由层。
  //    （保留 `{{COUNT}}` 占位符是为了将来 checkpoint 支持 batch 时能平滑切换。）
  const batchCount = Math.max(1, Math.min(IMAGE_MAX_BATCH, Math.floor(Number(count) || 1)));

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  // SaveImage 走 ComfyUI 的 output 目录，runWorkflow 会负责取回
  const result = await comfy.runWorkflow({
    cfg, workflow: wf, map, job, outputsDir, onSubmitted, onProgress,
    // 单张 4.2MP 实测约 148 秒；批量与 LoRA 会再慢一些，进度回调用于 UI
    progressHint: [
      batchCount > 1 ? `${batchCount} 个样本` : '',
      // ⚠️ 只在**回退到改权重模式**时才提示"更慢"。
      //    bypass 也有开销（实测 ×1.27），但那属于正常范围，没必要在进度条上吓人；
      //    而回退模式是 ×1.79 且会糊，必须让用户在等待时就看见原因。
      loraList.length && loraMode === 'patch' ? `${loraList.length} 条 LoRA（改权重模式，较慢）` : '',
      loraList.length && loraMode === 'bypass' ? `${loraList.length} 条 LoRA` : '',
    ].filter(Boolean).join(' · '),
  });
  return {
    ...result,
    warnings: [...(result?.warnings ?? []), ...(loraPerfWarning ? [loraPerfWarning] : [])],
    meta: {
      /**
       * ⚠️ `width/height` 是**提交给节点的请求值**，不是最终产物尺寸。
       *
       * 实测：传 256×256 参考图 + `sizeId:'auto'` 时，
       * 节点用 `image_1` 缩放后的尺寸（短边 1024）当画布，
       * **产物是 1024×1024，而这里会回 2048×2048**（auto 的默认值）。
       * 所以加了 `sizeResolvedFrom: 'ref'|'default'` 让调用方知道该不该信这个数；
       * 要精确产物尺寸请看产物文件本身（或显式传 width/height）。
       */
      width: W || 2048,
      height: H || 2048,
      sizeResolvedFrom: (W && H) ? 'explicit' : (refNames.length ? 'ref' : 'default'),
      steps,
      batchCount,
      refCount: refNames.length,
      loraCount: loraList.length,
      /**
       * LoRA 生效方式：
       *   'none'   没挂
       *   'bypass' 前向注入（默认；量化底座上唯一正确的做法，不动权重）
       *   'patch'  改权重（回退路径；量化底座上慢且伤画质）
       * 排障时看这一项就知道实际走了哪条路。
       */
      loraMode,
      loraStack: loraList.map((l) => `${l.name}@${l.strength ?? 1.0}`),
    },
  };
}

/**
 * 把"要 N 张"的请求拆成 N 份单张请求（每份换一个 seed）。
 *
 * 为什么在**路由层**拆而不是在 workflow 里复制 latent：
 * 见 `runH3Image` 里"批量出图"那段 —— H3-Image 的 DiT 硬性拒绝 batch>1。
 *
 * 拆法：第 1 份沿用用户给的 seed（可复现"这个 seed 长什么样"），
 * 其余按 `seed + i` 递增。递增而不是随机，是为了让"相邻 seed"有迹可循，
 * 用户想微调时可以只动 count 不动 seed。
 *
 * @param {{seed:number, count:number}} req
 * @returns {number[]} 每份请求应使用的 seed
 */
export function splitBatchSeeds(req) {
  const base = Number(req?.seed);
  const seed = Number.isFinite(base) ? Math.floor(base) % 2147483648 : Math.floor(Math.random() * 2147483647);
  const count = Math.max(1, Math.min(IMAGE_MAX_BATCH, Math.floor(Number(req?.count) || 1)));
  const out = [];
  for (let i = 0; i < count; i += 1) out.push((seed + i) % 2147483648);
  return out;
}

export { IMAGE_MODELS as H3_IMAGE_MODELS, IMAGE_SIZES as H3_IMAGE_SIZES };
