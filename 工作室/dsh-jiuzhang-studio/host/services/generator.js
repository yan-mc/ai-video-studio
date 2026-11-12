/**
 * H3 生成执行器 —— **单一实现**，被 REST 与 Agent 工具共用。
 *
 * 之前 tools.js 与 api/index.js 各写了一份，tools.js 那份漏了 6 个模型/LoRA 占位符
 * 导致 Agent 调用必失败（审查 G7）。现在统一到这里，杜绝再次漂移。
 */
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '../config.js';
import { PROFILES, resolutionFor, h3Length } from '../store/models.js';
import { safeJoin } from '../security.js';
import * as comfy from './comfy-client.js';

const UNET_REF = 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors';
const UNET_FL2V = 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors';
const CLIP_NAME = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
const VAE_NAME = 'minimax_h3_video_vae_fp16.safetensors';
const LORA_REF = 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors';
const LORA_FL2V = 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors';

/**
 * 解析镜头的参考图绝对路径。
 * 支持：绝对路径 / dataDir 相对路径（assets/xxx.png）/ {absPath} / {rel}。
 * 上限 9 张（H3 ref_images 上限）。
 */
export function resolveRefImages(shot, cfg = loadConfig()) {
  const out = [];
  const toAbs = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'string') {
      if (path.isAbsolute(ref)) return fs.existsSync(ref) ? ref : '';
      try {
        const a = safeJoin(cfg.dataDir, ref);
        if (fs.existsSync(a)) return a;
      } catch { /* ignore */ }
      return '';
    }
    if (ref && typeof ref === 'object') {
      if (ref.absPath && fs.existsSync(ref.absPath)) return ref.absPath;
      if (ref.rel) {
        try {
          const a = safeJoin(cfg.dataDir, ref.rel);
          if (fs.existsSync(a)) return a;
        } catch { /* ignore */ }
      }
    }
    return '';
  };
  for (const ref of (shot.refs?.images || [])) {
    const a = toAbs(ref);
    if (a) out.push({ key: `{{REF_${out.length + 1}}}`, abs: a });
    if (out.length >= 9) break;
  }
  return out;
}

/** 从镜头卡 previz 绑定解析首尾帧/控制视频 */
export function resolvePrevizArtifacts(shot, cfg = loadConfig()) {
  const out = {};
  const p = shot?.previz;
  if (!p) return out;
  const abs = (rel) => {
    if (!rel) return '';
    try {
      const a = path.isAbsolute(rel) ? rel : safeJoin(cfg.dataDir, rel);
      return fs.existsSync(a) ? a : '';
    } catch { return ''; }
  };
  if (p.firstFramePath) out['{{FIRST_FRAME}}'] = abs(p.firstFramePath);
  if (p.lastFramePath) out['{{LAST_FRAME}}'] = abs(p.lastFramePath);
  if (p.controlVideoPath) out['{{CONTROL_VIDEO}}'] = abs(p.controlVideoPath);
  return out;
}

/**
 * 执行一次 H3 本地生成。
 * @param {object} opts.workflow  已加载的 h3.json（API 格式）
 * @param {object} opts.job       运行中的 job
 * @param {object} opts.shot      镜头卡
 * @param {string} opts.prompt    编译后的提示词
 */
export async function runH3Local({ workflow, job, shot, prompt, cfg = loadConfig() }) {
  if (!workflow) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3.json');

  const res = resolutionFor(shot.profile, shot.ratio);
  const prof = PROFILES[shot.profile] || PROFILES['P12-draft'];

  const refList = resolveRefImages(shot, cfg);
  const previz = resolvePrevizArtifacts(shot, cfg);

  // 参考图 + 首尾帧统一 staging（文件名带 jobId，多镜头不互相覆盖）
  const toStage = {
    ...Object.fromEntries(refList.map((r) => [r.key, r.abs])),
    ...previz,
  };
  const staged = comfy.stageToComfyInput(cfg, toStage, job.id);

  const useRef = refList.length > 0;
  const useFirstLast = Boolean(staged['{{FIRST_FRAME}}'] || staged['{{LAST_FRAME}}']);

  const map = {
    '{{PROMPT}}': prompt,
    '{{WIDTH}}': res.width,
    '{{HEIGHT}}': res.height,
    '{{LENGTH}}': h3Length(shot.durationSec),
    '{{STEPS}}': prof.steps,
    '{{FPS}}': 24,
    '{{SEED}}': job.params?.seed ?? 1101,
    '{{REF_IMAGE_SIZE}}': 'match',
    // 有参考图走 Ref2VA，否则 FL2VA（两模型不通用）
    '{{UNET_NAME}}': useRef ? UNET_REF : UNET_FL2V,
    '{{CLIP_NAME}}': CLIP_NAME,
    '{{VAE_NAME}}': VAE_NAME,
    '{{LORA_NAME}}': useRef ? LORA_REF : LORA_FL2V,
    '{{LORA_STRENGTH}}': Number(prof.steps) <= 8 ? 1.0 : 0.0,
  };

  const names = refList.map((r) => staged[r.key]).filter(Boolean);
  if (names[0]) map['{{REF_IMAGE_1}}'] = names[0];
  if (names[1]) map['{{REF_IMAGE_2}}'] = names[1];

  const wfCopy = structuredClone(workflow);
  const refNode = wfCopy['9'];

  if (refNode?.class_type === 'MiniMaxH3ReferenceToVideo') {
    if (!useRef) {
      // 无参考图 → 退回文生/图生视频节点
      const inputs = {
        clip: ['2', 0], vae: ['3', 0], prompt: '{{PROMPT}}',
        width: '{{WIDTH}}', height: '{{HEIGHT}}', length: '{{LENGTH}}',
      };
      if (staged['{{FIRST_FRAME}}']) inputs.first_frame = ['20', 0];
      if (staged['{{LAST_FRAME}}']) inputs.last_frame = ['21', 0];
      wfCopy['9'] = { class_type: 'MiniMaxH3ImageToVideo', inputs };
    } else {
      refNode.inputs.ref_images = names.map((_, i) => [String(20 + i), 0]);
      // 参考图模式下 LoadImage 已被 ref_images 占用，首尾帧节点需另编号
    }
  }

  // 多余的 LoadImage 节点必须删掉（未接线会报错）
  const usedLoadImages = new Set(names.map((_, i) => String(20 + i)));
  for (let i = 0; i < 2; i++) {
    const id = String(20 + i);
    if (!usedLoadImages.has(id) && !(staged['{{FIRST_FRAME}}'] && id === '20') && !(staged['{{LAST_FRAME}}'] && id === '21')) {
      delete wfCopy[id];
    }
  }
  // 参考图模式下：若没有任何 LoadImage 被 ref_images 使用，删掉全部
  if (!useRef && !useFirstLast) {
    delete wfCopy['20'];
    delete wfCopy['21'];
  }

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  return comfy.runWorkflow({ cfg, workflow: wfCopy, map, job, outputsDir });
}

export const H3_MODEL_NAMES = { UNET_REF, UNET_FL2V, CLIP_NAME, VAE_NAME, LORA_REF, LORA_FL2V };