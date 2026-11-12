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
 */
export const IMAGE_SIZES = Object.freeze([
  { id: 'auto', name: '自动 2048²', w: 0, h: 0, mp: 4.2 },
  { id: 'sq-2048', name: '方图 2048²', w: 2048, h: 2048, mp: 4.2 },
  { id: 'p-4x3', name: '竖图 3:4', w: 1776, h: 2368, mp: 4.2 },
  { id: 'l-4x3', name: '横图 4:3', w: 2368, h: 1776, mp: 4.2 },
  { id: 'p-3x4-film', name: '人物卡 2:3', w: 1600, h: 2400, mp: 3.8 },
  { id: 'v-16x9', name: '视频竖 9:16', w: 1440, h: 2560, mp: 3.7 },
  { id: 'h-16x9', name: '视频横 16:9', w: 2560, h: 1440, mp: 3.7 },
  { id: 'ecom-sq', name: '电商方图', w: 2048, h: 2048, mp: 4.2 },
  { id: 'ecom-45', name: '电商竖 4:5', w: 1832, h: 2290, mp: 4.2 },
  { id: 'comic-page', name: '漫画页 3:4', w: 1776, h: 2368, mp: 4.2 },
  { id: 'h3-4k-sq', name: '4K 方图 4096²', w: 4096, h: 4096, mp: 16.8 },
  { id: 'h3-4k-169', name: '4K 横 16:9', w: 5472, h: 3072, mp: 16.8 },
]);

/** 按 id 取尺寸；找不到回落 auto */
export function imageSize(id) {
  return IMAGE_SIZES.find((s) => s.id === id) ?? IMAGE_SIZES[0];
}

/**
 * 推导模型根目录。优先级：
 *  1) 配置里的 imageModelRoot（显式指定）
 *  2) 配置的 comfyInputDir 的兄弟目录 models
 *  3) 从 ComfyUI 实际路径推断（通过其 output 目录反推）
 *  4) 环境变量 H3_MODEL_ROOT
 *  5) 几个常见默认位置
 */
export function resolveModelRoot(cfg = loadConfig()) {
  const candidates = [];

  if (cfg.imageModelRoot) candidates.push(cfg.imageModelRoot);

  if (cfg.comfyInputDir) {
    candidates.push(path.resolve(cfg.comfyInputDir, '..', 'models'));
    candidates.push(path.resolve(cfg.comfyInputDir, '..', '..', 'models'));
  }

  if (process.env.H3_MODEL_ROOT) candidates.push(process.env.H3_MODEL_ROOT);

  // 常见布局
  candidates.push('F:\\AI视频\\ai-runtime\\models');

  // 从插件自身位置向上找 ai-runtime/models（插件可能放在任意位置）
  try {
    const here = import.meta.dirname;   // .../host/services
    let dir = here;
    for (let i = 0; i < 6; i++) {
      dir = path.dirname(dir);
      candidates.push(path.join(dir, 'models'));
      candidates.push(path.join(dir, 'ai-runtime', 'models'));
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
    'film-base': 'p-3x4-film',
    'film-turnaround': 'p-3x4-film',
    'film-exp': 'p-3x4-film',
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
 * 出图提示词规整：H3-Image 吃长提示词（最长 4096 token），
 * 且**无负面提示词**——"不要 X" 要改写成正向约束。
 */
export function normalizeImagePrompt(prompt) {
  let p = String(prompt ?? '').trim();
  // 把常见否定句改成正向描述（模型不支持负面提示词）
  p = p.replace(/不要([^\s，。；,.;]{1,12})/g, '避免$1');
  p = p.replace(/禁止([^\s，。；,.;]{1,12})/g, '不出现$1');
  return p.slice(0, 4096);
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
  workflow, job, prompt, sizeId = 'auto', width, height, refImages = [], cfg = loadConfig(),
}) {
  if (!workflow) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');

  const models = checkImageModels(cfg);
  if (!models.ready) {
    throw new Error(`IMAGE_MODEL_MISSING: 缺少 ${models.missing.join(', ')}`);
  }

  const size = imageSize(sizeId);
  const W = Number.isFinite(Number(width)) && Number(width) > 0 ? Math.round(Number(width) / 32) * 32 : size.w;
  const H = Number.isFinite(Number(height)) && Number(height) > 0 ? Math.round(Number(height) / 32) * 32 : size.h;

  // 参考图 → ComfyUI input（编辑模式）
  const staged = refImages.length
    ? comfy.stageToComfyInput(
      cfg,
      Object.fromEntries(refImages.map((abs, i) => [`{{IMG_REF_${i + 1}}}`, abs])),
      job.id,
    )
    : {};

  const map = {
    '{{PROMPT}}': normalizeImagePrompt(prompt),
    '{{WIDTH}}': W,
    '{{HEIGHT}}': H,
    '{{SEED}}': job.params?.seed ?? Math.floor(Math.random() * 2147483647),
    '{{STEPS}}': IMAGE_SAMPLING.steps,
    '{{UNET_NAME}}': models.unet,
    '{{VAE_NAME}}': models.vae,
    '{{CLIP_NAME}}': models.clip,
  };

  const wf = structuredClone(workflow);
  // ComfyUI 会把非数字 key 也当节点解析 → `_comment` 必须剔除，否则 500
  for (const k of Object.keys(wf)) {
    if (!/^\d+$/.test(k)) delete wf[k];
  }

  // 参考图接线：node 4 的 images（AUTOGROW）
  const refNames = refImages.map((_, i) => staged[`{{IMG_REF_${i + 1}}}`]).filter(Boolean);
  if (refNames.length) {
    const condNode = wf['4'];
    if (condNode?.class_type === 'MiniMaxH3ImageConditioning') {
      condNode.inputs.images = refNames.map((_, i) => [String(20 + i), 0]);
      for (let i = 0; i < refNames.length; i++) {
        wf[String(20 + i)] = {
          class_type: 'LoadImage',
          inputs: { image: refNames[i] },
        };
      }
    }
  }

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  // SaveImage 走 ComfyUI 的 output 目录，runWorkflow 会负责取回
  return comfy.runWorkflow({ cfg, workflow: wf, map, job, outputsDir });
}

export { IMAGE_MODELS as H3_IMAGE_MODELS, IMAGE_SIZES as H3_IMAGE_SIZES };