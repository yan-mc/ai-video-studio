/**
 * H3 生成执行器 —— **单一实现**，被 REST 与 Agent 工具共用。
 *
 * 之前 tools.js 与 api/index.js 各写了一份，tools.js 那份漏了 6 个模型/LoRA 占位符
 * 导致 Agent 调用必失败（审查 G7）。现在统一到这里，杜绝再次漂移。
 */
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { loadConfig } from '../config.js';
import { PROFILES, resolutionFor, h3Length } from '../store/models.js';
import { safeJoin } from '../security.js';
import * as comfy from './comfy-client.js';
import { decideRefImageSize } from './render-plan.js';

/** 内联图片落盘用短哈希，同图复用同一文件 */
function hashShort(text) {
  return createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
}

const UNET_REF = 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors';
const UNET_FL2V = 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors';
const CLIP_NAME = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
const VAE_NAME = 'minimax_h3_video_vae_fp16.safetensors';
// H3 是音画同步模型：采样器输出的是 AV latent，音轨要从 audio VAE 解出来。
// 早先工作流只接了视频 VAEDecode，音轨被整个丢弃（产物没有音轨）。
const AUDIO_VAE_NAME = 'minimax_h3_audio_vae_fp32.safetensors';
const LORA_REF = 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors';
const LORA_FL2V = 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors';

/**
 * 解析镜头的参考图绝对路径（**提交顺序即提示词里的 <Picture N> 顺序**）。
 *
 * 顺序与 `render-plan.buildRenderPlan` 保持完全一致，两处必须同步修改：
 *   0. 角色卡仓库（最高优先级，一致性锚点）
 *   1. characterRefs（历史字段，兼容老数据）
 *   2. 手工参考图
 *   3. 场景 / 道具
 * 首尾帧不在此列（它们走 previz 通道，单独接线）。
 *
 * 上限 9 张（H3 Ref2VA 硬约束）。
 */
export function resolveRefImages(shot, cfg = loadConfig(), opts = {}) {
  const out = [];
  const seen = new Set();
  const toAbs = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'string') {
      // 内联 data URL：浏览器端（画布节点、拖拽上传）常常只给这个形态。
      // 旧实现一律丢弃 → 表现就是"图片没进模型"。这里落盘成临时文件后再走 staging。
      if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(ref)) {
        try {
          const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(ref);
          const ext = m[1].replace('jpeg', 'jpg');
          const dir = path.join(cfg.dataDir, 'tmp-inline');
          fs.mkdirSync(dir, { recursive: true });
          const file = path.join(dir, `${hashShort(ref)}.${ext}`);
          if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
          return file;
        } catch { return ''; }
      }
      // ⚠️ win32 上 path.isAbsolute('/luoshu/api/file?path=x') === true，
      //    而画布把上游产物写成同源 URL —— 会被误当绝对路径后 existsSync 失败、
      //    静默丢图（画布串联第二跳断链）。所以 URL 形态必须**先于** isAbsolute 判断。
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) return '';   // 远程 URL 后端取不到
      if (ref.startsWith('/')) {
        try {
          const q = ref.includes('?') ? ref.slice(ref.indexOf('?') + 1) : '';
          const p = new URLSearchParams(q).get('path');
          if (p) {
            const a = safeJoin(cfg.dataDir, p);
            if (fs.existsSync(a)) return a;
          }
        } catch { /* ignore */ }
        return '';
      }
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

  const push = (abs, source, meta = {}) => {
    if (!abs || seen.has(abs)) return false;
    if (out.length >= 9) return false;
    seen.add(abs);
    out.push({ key: `{{REF_${out.length + 1}}}`, abs, source, ...meta });
    return true;
  };

  // 0) 角色卡仓库（最高优先级）—— 项目/镜头选中的卡，按其 refPolicy 取图
  //    这里只处理**已经解析好**的卡对象（含 resolvedImages），避免重复读盘。
  for (const card of (shot.characterCards || [])) {
    if (out.length >= 9) break;
    const imgs = Array.isArray(card.resolvedImages) ? card.resolvedImages : [];
    for (const img of imgs) {
      if (out.length >= 9) break;
      push(toAbs(img.rel), 'vault-card', { cardId: card.id, cardName: card.name, slot: img.slot });
    }
  }

  // 1) 人设卡优先（characterRefs）
  for (const ref of (shot.characterRefs || [])) {
    if (out.length >= 9) break;
    // 人设卡可能是资产 id / rel 路径 / 对象
    if (ref && typeof ref === 'object' && Array.isArray(ref.images)) {
      // 一个人设卡带多张分图（三视图各一张的情况）
      for (const img of ref.images) {
        if (!push(toAbs(img), 'character-sheet')) break;
      }
    } else {
      push(toAbs(ref), 'character-sheet');
    }
  }

  // 2) 手工参考图
  for (const ref of (shot.refs?.images || [])) {
    if (out.length >= 9) break;
    push(toAbs(ref), 'manual');
  }

  // 3) 场景 / 道具
  for (const ref of [...(shot.sceneRefs || []), ...(shot.itemRefs || [])]) {
    if (out.length >= 9) break;
    push(toAbs(ref), 'scene-item');
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
 * 把角色卡的文字设定注入提示词。
 *
 * 为什么需要：参考图只告诉模型"长什么样"，不告诉它"这是谁、叫什么、
 * 在画面里该是什么性格"。多角色同框时更容易串脸。
 *
 * 编号规则（必须与 ComfyUI 的呈现一致）：
 *   Ref2VA 里参考图按 ref_images 的顺序编号为 <Picture 1>..<Picture N>，
 *   我们的 refList 就是提交顺序，所以第 i 张（1-based）对应 <Picture i>。
 *
 * ⚠️ 只写身份与编号，不复述像素级外观：
 *    外观由图片本身承载，文字重复描述反而会与图片冲突。
 */
function injectCardDefinitions(prompt, refList, shot) {
  const text = String(prompt ?? '');
  const cardById = new Map((shot.characterCards ?? []).map((c) => [c.id, c]));

  // ⚠️ 正常情况下 h3-prompt.toShotInputPackage 已经在编译时用 shot.characterCards
  //    生成了 subject_definitions（编号即卡序）。这里只在**编译时没拿到卡**
  //    （提示词里没有卡名）时补一次，避免重复注入把同一段写两遍。
  const already = (shot.characterCards ?? []).some(
    (c) => c?.name && text.includes(String(c.name)),
  );
  if (already) return text;

  // 收集有卡信息的参考图（角色卡来源）
  const cardEntries = [];
  const byCard = new Map();
  refList.forEach((r, i) => {
    if (!r.cardId) return;
    if (!byCard.has(r.cardId)) byCard.set(r.cardId, { name: r.cardName, pictures: [] });
    byCard.get(r.cardId).pictures.push(i + 1); // 1-based picture index
  });
  if (!byCard.size) return text;

  for (const [id, info] of byCard) {
    const card = cardById.get(id) ?? { name: info.name };
    cardEntries.push({ card, pictureIndex: info.pictures[0], allPictures: info.pictures });
  }

  const lines = [];
  for (const { card, pictureIndex, allPictures } of cardEntries) {
    const bits = [];
    if (card.description) bits.push(String(card.description).trim().replace(/[。．.；;]\s*$/, ''));
    if (Array.isArray(card.traits) && card.traits.length) bits.push(card.traits.join('、'));
    if (card.personality) bits.push(`性格：${card.personality}`);
    const pics = allPictures.length > 1
      ? allPictures.map((n) => `<Picture ${n}>`).join(' 与 ')
      : `<Picture ${pictureIndex}>`;
    const head = `${card.name}：外观以 ${pics} 为准`;
    lines.push(bits.length ? `${head}。${bits.join('；')}` : head);
  }
  if (!lines.length) return text;

  const block = `subject_definitions:\n${lines.join('\n')}`;
  // 提示词已有 subject_definitions 段就替换，否则前置
  if (/subject_definitions\s*:/i.test(text)) {
    return text.replace(/subject_definitions\s*:[\s\S]*?(?=\n[a-zA-Z_]+\s*:|$)/i, block);
  }
  return `${block}\n\n${text}`;
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

  // 参考图保真档位（含显存保护）。与实际渲染计划用**同一个**决策函数，
  // 保证"预览说用什么"和"实际用什么"一致。
  const vram = await comfy.vramStatus(cfg).catch(() => null);
  const refSizeDecision = decideRefImageSize(shot.refImageSize, vram);
  if (refSizeDecision.downgraded) {
    job.params = { ...(job.params ?? {}), refImageSizeDowngraded: refSizeDecision.reason };
  }

  const refList = resolveRefImages(shot, cfg);
  const previz = resolvePrevizArtifacts(shot, cfg);

  // 角色卡的文字设定注入提示词。
  // 关键：把"这张卡是第几张参考图"算准，模型才知道该看哪张。
  const finalPrompt = injectCardDefinitions(prompt, refList, shot);

  // 参考图 + 首尾帧 + 视频 + 音频统一 staging（文件名带 jobId，多镜头不互相覆盖）
  //
  // ⚠️ ComfyUI 的 LoadVideo / LoadAudio 和 LoadImage 一样，**只认 input 目录内的文件名**，
  //    传绝对路径会报 Invalid file。所以视频/音频也必须先 stage。
  const videoEntries = (Array.isArray(shot.videos) ? shot.videos : []).map((v, i) => ({
    ...v,
    key: v.key ?? `{{REF_VIDEO_${i + 1}}}`,
  }));
  const audioEntries = (Array.isArray(shot.audios) ? shot.audios : []).map((a, i) => ({
    ...a,
    key: a.key ?? `{{REF_AUDIO_${i + 1}}}`,
  }));

  const toStage = {
    ...Object.fromEntries(refList.map((r) => [r.key, r.abs])),
    ...previz,
    ...Object.fromEntries(videoEntries.map((v) => [v.key, v.abs])),
    ...Object.fromEntries(audioEntries.map((a) => [a.key, a.abs])),
  };
  const staged = await comfy.stageToComfyInput(cfg, toStage, job.id);

  const useRef = refList.length > 0
    || videoEntries.length > 0
    || audioEntries.length > 0;
  const useFirstLast = Boolean(staged['{{FIRST_FRAME}}'] || staged['{{LAST_FRAME}}']);

  const map = {
    '{{PROMPT}}': finalPrompt,
    '{{WIDTH}}': res.width,
    '{{HEIGHT}}': res.height,
    '{{LENGTH}}': h3Length(shot.durationSec),
    '{{STEPS}}': prof.steps,
    '{{FPS}}': 24,
    '{{SEED}}': job.params?.seed ?? 1101,
    // 参考图缩放策略：
    //   match — 缩到生成面积（快，默认）
    //   max   — 短边固定 2048（一致性最好，但明显更慢，官方注明可能慢数倍）
    //
    // 显存不足时自动降级为 match（decideRefImageSize 会把原因写进警告，
    // 上层渲染计划也会展示，不静默）。
    '{{REF_IMAGE_SIZE}}': refSizeDecision.value,
    // 有参考图走 Ref2VA，否则 FL2VA（两模型不通用）
    '{{UNET_NAME}}': useRef ? UNET_REF : UNET_FL2V,
    '{{CLIP_NAME}}': CLIP_NAME,
    '{{VAE_NAME}}': VAE_NAME,
    '{{AUDIO_VAE_NAME}}': AUDIO_VAE_NAME,
    '{{LORA_NAME}}': useRef ? LORA_REF : LORA_FL2V,
    '{{LORA_STRENGTH}}': Number(prof.steps) <= 8 ? 1.0 : 0.0,
  };

  const names = refList.map((r) => staged[r.key]).filter(Boolean);

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
      // ⚠️ ref_images 是 AUTOGROW 输入，prefix = "ref_image_"
      //    正确写法必须带点号：ref_images.ref_image_1 / ref_image_2 ...
      //    错误写法 ref_images = [["20",0], ...] 会被静默忽略，参考图完全不生效
      //    （实测确认：同一 prompt+seed，有无参考图输出哈希完全相同）
      //
      // ⚠️ LoadImage 节点必须**自己建**：模板里只有 20/21 两个，
      //    但 ref_images 支持到 9 张。旧实现只占位 20+i 却不建节点，
      //    第 3 张起指向不存在的节点 → 直接报错或静默丢图。
      delete refNode.inputs.ref_images;
      for (const k of Object.keys(refNode.inputs)) {
        if (/^ref_image_\d+$/.test(k)) delete refNode.inputs[k];
      }
      for (let i = 0; i < names.length; i++) {
        const slot = String(20 + i);
        wfCopy[slot] = {
          class_type: 'LoadImage',
          inputs: { image: names[i] },
        };
        refNode.inputs[`ref_images.ref_image_${i + 1}`] = [slot, 0];
      }

      // ---- 参考视频 + 音轨 + 独立音频 ----
      //
      // 节点图（见 docs/H3参考输入契约.md）：
      //   LoadVideo(file) → GetVideoComponents ─┬─ IMAGE → ref_videos.ref_video_K
      //                                          └─ AUDIO → ref_video_audios.ref_video_audio_K
      //   LoadAudio(audio) ──────────────────────── AUDIO → ref_audios.ref_audio_N
      //
      // ⚠️ 视频与其音轨**必须同号**（源码按编号配对，不按数组顺序）。
      //    没有音轨的视频不要接 ref_video_audios，否则编号会错位。
      //
      // ⚠️ 这里**不能**重新声明 videoEntries/audioEntries ——
      //    外层已经算过（带 .key），重新声明会遮蔽外层变量，
      //    导致 staged[v.key] 取不到值、整段被过滤掉（踩过）。
      const videoStage = videoEntries.map((v) => ({ ...v, fileName: staged[v.key] })).filter((v) => v.fileName);
      const audioStage = audioEntries.map((a) => ({ ...a, fileName: staged[a.key] })).filter((a) => a.fileName);

      let nextNode = 40;   // 40+ 专供视频/音频节点，避开图片的 20..28
      for (const v of videoStage) {
        const loadId = String(nextNode++);
        const splitId = String(nextNode++);
        wfCopy[loadId] = {
          class_type: 'LoadVideo',
          inputs: { file: v.fileName },
        };
        wfCopy[splitId] = {
          class_type: 'GetVideoComponents',
          inputs: { video: [loadId, 0] },
        };
        // GetVideoComponents 输出：0=IMAGE(帧) 1=AUDIO(音轨) 2=fps 3=bit_depth 4=color_space
        refNode.inputs[`ref_videos.ref_video_${v.index}`] = [splitId, 0];
        if (v.hasAudio) {
          refNode.inputs[`ref_video_audios.ref_video_audio_${v.index}`] = [splitId, 1];
        }
      }

      for (const a of audioStage) {
        const loadId = String(nextNode++);
        wfCopy[loadId] = {
          class_type: 'LoadAudio',
          inputs: { audio: a.fileName },
        };
        refNode.inputs[`ref_audios.ref_audio_${a.index}`] = [loadId, 0];
      }
    }
  }

  // 多余的 LoadImage 节点必须删掉（未接线会报错）
  const usedLoadImages = new Set(names.map((_, i) => String(20 + i)));
  for (let i = 0; i < 9; i++) {
    const id = String(20 + i);
    if (!usedLoadImages.has(id) && !(staged['{{FIRST_FRAME}}'] && id === '20') && !(staged['{{LAST_FRAME}}'] && id === '21')) {
      delete wfCopy[id];
    }
  }
  // 参考图模式下：若没有任何 LoadImage 被 ref_images 使用，删掉全部
  if (!useRef && !useFirstLast) {
    for (let i = 0; i < 9; i++) delete wfCopy[String(20 + i)];
  }

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  return comfy.runWorkflow({ cfg, workflow: wfCopy, map, job, outputsDir });
}

export const H3_MODEL_NAMES = { UNET_REF, UNET_FL2V, CLIP_NAME, VAE_NAME, AUDIO_VAE_NAME, LORA_REF, LORA_FL2V };

/* ============================================================ 图像生成 */

/**
 * 执行一次 H3-Image 生成（文生图 / 参考图编辑）。
 * 与视频共用 Qwen3-VL 编码器，只换扩散模型 + 图像 VAE。
 */
export async function runH3ImageLocal({ workflow, job, prompt, shot, cfg = loadConfig() }) {
  const { runH3Image } = await import('./h3-image.js');
  const params = job.params ?? {};
  return runH3Image({
    workflow,
    job,
    prompt,
    cfg,
    sizeId: params.imageSizeId ?? shot?.imageSizeId ?? 'auto',
    width: params.width,
    height: params.height,
    refImages: resolveRefImages(shot ?? {}, cfg).map((r) => r.abs),
  });
}

/** 判断一个 job 是图像还是视频任务 */
export function jobKind(job) {
  return job?.kind === 'image' || job?.params?.kind === 'image' ? 'image' : 'video';
}