/**
 * H3-Image 客户端 —— 图像生成（文生图 + 参考图编辑）。
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
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import * as comfy from './comfy-client.js';

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

/** 固定采样参数（checkpoint 蒸馏决定，不可调） */
export const IMAGE_SAMPLING = Object.freeze({
  steps: 6,
  guidance: 1.0,
  sampler: 'euler',
  scheduler: 'simple',
});

/**
 * 官方原生尺寸表（宽 × 高）。
 * 模型调优面积约 16 MP；`auto` 走 2048×2048。
 *
 * id 命名约定：`<方向>-<宽>:<高>`，方向 p=竖(portrait) / l=横(landscape) / sq=方 / v=竖屏视频 / h=横屏视频。
 *
 * ⚠️ 历史包袱（不要改 id，会破坏存量数据）：
 *    - `v-16x9` 的实际尺寸是 1440×2560（9:16 竖屏），id 里的 16x9 是**早期笔误**。
 *      几何是对的，只有名字误导；已补 name 说明，并保留 id 兼容。
 *    - `p-3x4-film` 的实际尺寸是 1600×2400（2:3），也不符合 id 里的 3:4。
 *      这里**改名为 `p-2x3-film`**（几何与名字对齐），旧 id 作为别名继续可用。
 */
export const IMAGE_SIZES = Object.freeze([
  { id: 'auto', name: '自动 2048²', w: 0, h: 0, mp: 4.2 },
  { id: 'sq-2048', name: '方图 2048²', w: 2048, h: 2048, mp: 4.2 },
  { id: 'p-4x3', name: '竖图 3:4', w: 1776, h: 2368, mp: 4.2 },
  { id: 'l-4x3', name: '横图 4:3', w: 2368, h: 1776, mp: 4.2 },
  { id: 'p-2x3-film', name: '人物卡 2:3', w: 1600, h: 2400, mp: 3.8 },
  { id: 'v-16x9', name: '视频竖 9:16（id 为历史遗留）', w: 1440, h: 2560, mp: 3.7 },
  { id: 'h-16x9', name: '视频横 16:9', w: 2560, h: 1440, mp: 3.7 },
  { id: 'ecom-sq', name: '电商方图', w: 2048, h: 2048, mp: 4.2 },
  { id: 'ecom-45', name: '电商竖 4:5', w: 1832, h: 2290, mp: 4.2 },
  { id: 'comic-page', name: '漫画页 3:4', w: 1776, h: 2368, mp: 4.2 },
  { id: 'h3-4k-sq', name: '4K 方图 4096²', w: 4096, h: 4096, mp: 16.8 },
  { id: 'h3-4k-169', name: '4K 横 16:9', w: 5472, h: 3072, mp: 16.8 },
]);

/** 旧尺寸 id → 新 id（历史数据兼容） */
export const IMAGE_SIZE_ALIASES = Object.freeze({
  'p-3x4-film': 'p-2x3-film',
});

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
 *    旧实现写死了 `F:\AI视频\ai-runtime\models`，一旦换机器/换盘就必然找不到模型，
 *    而且用户无从得知为什么 —— 属于典型的"在本机能用、发给别人就废"。
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
 */
export function sizeForPurpose(purpose) {
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
  return map[purpose] ?? 'sq-2048';
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
 * 出图提示词 → 最终提交文本（**传输层清洗**，不改写语义）。
 *
 * 这里只做三件事，都是"把文本安全地送进编码器"的必需品：
 *   1. 去掉 Markdown 记号 —— `**粗体**`、`### 标题`、行内 `代码` 是给人看的排版，
 *      送进模型会变成无意义字符，还会挤占 token 预算。
 *   2. 压缩空白 —— 多个空行/行尾空格对生成没有帮助，只会让段落结构变糊。
 *   3. 按 4096 token 的输入上限截断（模型硬约束）。
 *
 * ⚠️ **不做语义改写。**
 *    曾有实现把「不要 X」正则替换成「避免 X」，依据是"H3-Image 无负面提示词"。
 *    这个依据是错的：`MiniMaxH3ImageConditioning` 根本没有 negative 输入通道
 *    （见 /object_info），prompt 是自由文本，编码器正常理解"不要/禁止"。
 *    而且正则 `[^\s，。；,.;]{1,12}` 只能吃到短词，同一句里长词漏改，
 *    结果出现「避免美化、不要改动设计」这种自相矛盾的句子 —— 比不改更糟。
 *
 * @param {string} prompt
 * @param {{maxChars?: number}} [opts]
 */
export function normalizeImagePrompt(prompt, opts = {}) {
  const maxChars = Number.isFinite(opts.maxChars) ? opts.maxChars : 4096;
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

  // 3) 截断（按字符保守取，4096 token 远大于 4096 中文字符）
  return p.slice(0, maxChars);
}

/**
 * 执行一次 H3-Image 生成。
 * @param {object} opts
 * @param {object} opts.workflow  h3-image.json（API 格式）
 * @param {object} opts.job       运行中的 job
 * @param {string} opts.prompt    提示词
 * @param {string} [opts.sizeId]  尺寸 id
 * @param {number} [opts.width]   显式宽（覆盖 sizeId）
 * @param {number} [opts.height]  显式高
 * @param {string[]} [opts.refImages] 参考图绝对路径（编辑模式）
 */
export async function runH3Image({
  workflow, job, prompt, sizeId = 'auto', width, height, refImages = [], cfg = loadConfig(), onSubmitted,
}) {
  if (!workflow) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');

  const models = checkImageModels(cfg);
  if (!models.ready) {
    throw new Error(`IMAGE_MODEL_MISSING: 缺少 ${models.missing.join(', ')}`);
  }

  const size = imageSize(sizeId);
  const W = Number.isFinite(Number(width)) && Number(width) > 0 ? Math.round(Number(width) / 32) * 32 : size.w;
  const H = Number.isFinite(Number(height)) && Number(height) > 0 ? Math.round(Number(height) / 32) * 32 : size.h;

  // 参考图 → ComfyUI（编辑模式）。必须 await：图片没送进去就直接报错，
  // 不能像旧实现那样静默退化成纯文生图。
  const staged = refImages.length
    ? await comfy.stageToComfyInput(
      cfg,
      Object.fromEntries(refImages.map((abs, i) => [`{{IMG_REF_${i + 1}}}`, abs])),
      job.id,
    )
    : {};

  // 采样步数：蒸馏 checkpoint 固定 6 步，但配置项 imageSteps 之前是死字段
  // （读都存在，代码里却硬编码 IMAGE_SAMPLING.steps）。这里让它真正生效，
  // 同时夹到合理区间：少于 4 步画质崩，多于 12 步对蒸馏模型没有收益只有耗时。
  const stepsRaw = Number(cfg?.imageSteps);
  const steps = Number.isFinite(stepsRaw) && stepsRaw >= 1
    ? Math.max(4, Math.min(12, Math.round(stepsRaw)))
    : IMAGE_SAMPLING.steps;

  const map = {
    '{{PROMPT}}': normalizeImagePrompt(prompt),
    '{{WIDTH}}': W,
    '{{HEIGHT}}': H,
    '{{SEED}}': job.params?.seed ?? Math.floor(Math.random() * 2147483647),
    '{{STEPS}}': steps,
    '{{UNET_NAME}}': models.unet,
    '{{VAE_NAME}}': models.vae,
    '{{CLIP_NAME}}': models.clip,
  };

  const wf = structuredClone(workflow);
  // ComfyUI 会把非数字 key 也当节点解析 → `_comment` 必须剔除，否则 500
  for (const k of Object.keys(wf)) {
    if (!/^\d+$/.test(k)) delete wf[k];
  }

  // 参考图接线
  //
  // ⚠️ 关键：`images` 是 AUTOGROW 输入，官方模板里的输入名是 **`images.image_1`**
  //    （带点号的路径形式），不是 `images` 数组、也不是 `image_1`。
  //    实测错误写法（静默失效，参考图完全不生效）：
  //      inputs.images      = [["20", 0]]   ❌ 被当成普通数组忽略
  //      inputs.image_1     = ["20", 0]     ❌ TypeError: unexpected keyword 'image_1'
  //    正确写法：
  //      inputs["images.image_1"] = ["20", 0]   ✅
  //      inputs["images.image_2"] = ["21", 0]   ✅
  const refNames = refImages.map((_, i) => staged[`{{IMG_REF_${i + 1}}}`]).filter(Boolean);
  if (refNames.length) {
    const condNode = wf['4'];
    if (condNode?.class_type === 'MiniMaxH3ImageConditioning') {
      // 清掉任何可能存在的旧形式，避免混淆
      delete condNode.inputs.images;
      for (const k of Object.keys(condNode.inputs)) {
        if (/^image_\d+$/.test(k)) delete condNode.inputs[k];
      }
      for (let i = 0; i < refNames.length; i++) {
        const slot = String(20 + i);
        wf[slot] = {
          class_type: 'LoadImage',
          inputs: { image: refNames[i] },
        };
        condNode.inputs[`images.image_${i + 1}`] = [slot, 0];
      }
    }
  }

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  // SaveImage 走 ComfyUI 的 output 目录，runWorkflow 会负责取回
  return comfy.runWorkflow({ cfg, workflow: wf, map, job, outputsDir, onSubmitted });
}

export { IMAGE_MODELS as H3_IMAGE_MODELS, IMAGE_SIZES as H3_IMAGE_SIZES };