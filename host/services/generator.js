/**
 * H3 生成执行器 —— 单一实现，REST 与 Agent 工具共用。
 *
 * 三条路径：
 *   `runH3Nanfeng`     南风 V15（默认视频后端）
 *   `runH3ImageLocal`  H3-Image（文生图 / 参考图编辑 / LoRA）
 *   `runH3Local`       原生节点模板（`workflows/h3.json`），canvas 的 h3-local 后端
 */
import path from 'node:path';
import { loadConfig } from '../config.js';
import { PROFILES, resolutionFor, h3Length } from '../store/models.js';
import {
  resolveRefImages as resolveRefImagesCore,
  resolveMediaEntries as resolveMediaEntriesCore,
  resolvePrevizArtifacts as resolvePrevizArtifactsCore,
  planImageSlots as planImageSlotsCore,
  resolveImageEditRefs,
  MAX_REF_VIDEOS,
  MAX_REF_AUDIOS,
} from './ref-images.js';
import * as comfy from './comfy-client.js';
import { decideRefImageSize } from './render-plan.js';
import { NodeGraph } from './h3-graph.js';
import { planForShot, resolveAccelForFiles, checkSteps, DEFAULT_ACCEL_PLAN } from './accel-plan.js';
import { solveLoraStack, baseNameOf, clampSignedStrength } from './lora-catalog.js';

/**
 * H3 模型文件名。
 *
 * ⚠️ 这些是**默认值**，不是唯一可用的名字。ComfyUI 的模型库里同一功能
 *    常有好几个量化版本（fp8_scaled / int8_convrot / nvfp4_awq …），
 *    用户装哪个取决于显存与偏好。写死一个名字的后果是：
 *    装的是 int8 版 → 生成报 "Value not in list" 且难以理解。
 *
 *    `resolveModelName()` 会按「配置覆盖 → 精确匹配 → 前缀+量化偏好匹配」
 *    的顺序在 ComfyUI 的实际列表里挑一个。全部走配置或探测，不硬依赖文件名。
 */
const MODEL_DEFAULTS = Object.freeze({
  UNET_REF: 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors',
  UNET_FL2V: 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors',
  CLIP: 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors',
  VAE: 'minimax_h3_video_vae_fp16.safetensors',
  // H3 是音画同步模型：采样器输出的是 AV latent，音轨必须从 audio VAE 解出来，
// 只接视频 VAEDecode 会把音轨整个丢掉。
  AUDIO_VAE: 'minimax_h3_audio_vae_fp32.safetensors',
  // LoRA 由加速方案（accel-plan.js）给出，这里只是 ComfyUI 列表探测用的默认名。
  // 实际用哪个见 planForShot() 的返回；这两项保留是为了 resolveModelNames 的键完整。
  LORA_REF: 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors',
  LORA_FL2V: 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors',
});

/** 量化偏好顺序（越靠前越优先）：显存友好 → 精度更高 */
const QUANT_PREFERENCE = ['fp8_scaled', 'int8_convrot', 'fp8', 'int8', 'w4a8', 'nvfp4_awq', 'bf16', 'fp16'];

/**
 * 在候选名列表里挑一个最接近目标前缀的。
 *
 * @param {string} want  期望的完整文件名
 * @param {string[]} available  ComfyUI 实际可用的文件名
 * @returns {string} 选中名；找不到时返回原 want（让 ComfyUI 自己报错，别静默换错模型）
 */
export function pickModelName(want, available) {
  if (!Array.isArray(available) || !available.length) return want;
  if (available.includes(want)) return want;

  // 去掉量化后缀用于前缀匹配：minimax_h3_ref2va_pruned_<quant>.safetensors
  const stem = (n) => String(n).replace(/\.safetensors$/i, '')
    .replace(/[_-](fp8_scaled|fp8_e4m3fn|fp8|int8_convrot|int8|w4a8|nvfp4_awq|bf16|fp16|fp32)$/i, '');
  const wantStem = stem(want);
  const candidates = available.filter((n) => stem(n) === wantStem);
  if (!candidates.length) return want;      // 同名系列都没有 → 交回原值

  for (const q of QUANT_PREFERENCE) {
    const hit = candidates.find((n) => n.toLowerCase().includes(q));
    if (hit) return hit;
  }
  return candidates.sort()[0];
}

/**
 * 解析一组模型名（原始常量 → 实际可用名）。
 *
 * 可用列表由调用方给（通常来自 ComfyUI 的 `object_info`）；拿不到时原样返回默认值。
 */
export function resolveModelNames(cfg = loadConfig(), available = {}) {
  const override = cfg?.modelNames && typeof cfg.modelNames === 'object' ? cfg.modelNames : {};
  const out = {};
  for (const [k, def] of Object.entries(MODEL_DEFAULTS)) {
    const want = typeof override[k] === 'string' && override[k] ? override[k] : def;
    out[k] = pickModelName(want, available[k]);
  }
  return out;
}

/**
 * 参考视频 / 音频解析失败时写一条 job 警告（不静默）。
 *
 * 静默丢素材是最顽固的失败模式：镜头上"已挂上"、提示词里也有 `<Video 1>`，
 * 出片却完全不受它约束，任何日志都不说。
 */
function warnMissingMedia(job, shot, cfg = loadConfig()) {
  const miss = [
    ...resolveMediaEntriesCore(shot.refs?.videos, cfg).filter((v) => v.missing && v.rel).map((v) => `视频 ${v.rel}`),
    ...resolveMediaEntriesCore(shot.refs?.audios, cfg).filter((a) => a.missing && a.rel).map((a) => `音频 ${a.rel}`),
  ];
  if (!miss.length) return;
  job.warnings = [...(job.warnings ?? []),
    `以下参考素材在 dataDir 内找不到，对应槽位会留空（提示词里的 <Video N>/<Audio N> 不会指向其它素材）：${miss.join('、')}`];
}


/**
 * 把角色卡的文字设定注入提示词（参考图只说"长什么样"，不说"这是谁"）。
 *
 * 编号：`refList` 就是提交顺序，但首/尾帧占用槽位，所以第 i 张的 `<Picture N>`
 * 必须经 `pictureIndexMap` 换算，**不能**用 `i + 1`。
 *
 * 铁律：**绝不覆写**已有的 `subject_definitions`。
 *   已有该字段 → 一个字都不动，只在末尾追加英文 `Additional reference bindings`；
 *   完全没有 → 前置一段**英文**定义。所有新增文本一律英文，与 h3-prompt 一致。
 *
 * 覆写会吃掉 `<Video N>` / `<Audio N>` 定义句并产出中文正文；而
 * `lintCompiledPrompt` 跑在编译期、注入在提交期，中文没人检查得到。
 */
function injectCardDefinitions(prompt, refList, shot, pictureIndexMap = null) {
  const text = String(prompt ?? '');
  const cards = Array.isArray(shot.characterCards) ? shot.characterCards : [];
  if (!cards.length) return text;

  // 从**真实参考图清单**算出每张卡占哪几个编号（经槽位规划换算）
  const toPictureNo = (i) => (pictureIndexMap instanceof Map
    ? (pictureIndexMap.get(i) ?? null)
    : i + 1);

  const byCard = new Map();
  refList.forEach((r, i) => {
    if (!r.cardId) return;
    const n = toPictureNo(i);
    if (n == null) return;                    // 该图被槽位规划丢掉了
    if (!byCard.has(r.cardId)) byCard.set(r.cardId, []);
    byCard.get(r.cardId).push(n);
  });

  const hasDefsField = /^\s*subject_definitions\s*:/im.test(text);

  const cardLines = [];
  for (const card of cards) {
    const pics = byCard.get(card.id) ?? [];
    const bits = [];
    // 中文描述转成"英文可读"的形态：原文保留，但不作为句法主结构
    if (card.description) bits.push(String(card.description).trim().replace(/[。．.；;]\s*$/, ''));
    if (Array.isArray(card.traits) && card.traits.length) bits.push(card.traits.join(' / '));
    const where = pics.length === 1
      ? `<Picture ${pics[0]}>`
      : pics.length > 1
        ? pics.map((n) => `<Picture ${n}>`).join(' and ')
        : '';
    const head = where
      ? `<Subject identity: ${card.name}> appearance is carried by ${where}`
      : `<Subject identity: ${card.name}> has no reference picture; appearance follows the written description`;
    cardLines.push(bits.length ? `${head}. ${bits.join('; ')}.` : `${head}.`);
  }
  if (!cardLines.length) return text;

  if (hasDefsField) {
    // 已有定义段 —— 绝不覆写，只在末尾补一段"补充参考"（英文）
    return `${text.trimEnd()}\n\nAdditional reference bindings:\n${cardLines.join('\n')}`;
  }
  return `subject_definitions:\n${cardLines.join('\n')}\n\n${text}`;
}

/**
 * 执行一次 H3 本地生成。
 * @param {object} opts.workflow  已加载的 h3.json（API 格式）
 * @param {object} opts.job       运行中的 job
 * @param {object} opts.shot      镜头卡
 * @param {string} opts.prompt    编译后的提示词
 */
export async function runH3Local({ workflow, job, shot, prompt, cfg = loadConfig(), onSubmitted }) {
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

  const refList = resolveRefImagesCore(shot, cfg);
  const previz = resolvePrevizArtifactsCore(shot, cfg);

  // 角色卡的文字设定注入提示词 —— 必须把"这张卡是第几张参考图"算准
  const finalPrompt = injectCardDefinitions(prompt, refList, shot);

  /**
   * 参考图 + 首尾帧 + 视频 + 音频统一 staging（文件名带 jobId，多镜头不互相覆盖）。
   *
   * ComfyUI 的 LoadVideo / LoadAudio 和 LoadImage 一样只认 input 目录内的文件名。
   * 视频/音频编号 = **挂载顺序的槽位号**（下标 + 1），两条约束：
   *   1) `index` 必须显式赋值 —— 下游按 `ref_videos.ref_video_${v.index}` 拼输入名，
   *      漏赋值会让所有素材塌缩成 `ref_video_undefined`（AUTOGROW 不报错，只静默失效）。
   *   2) 不能先 filter 缺失项再重排 index —— 压缩数组会让第 3 段前移成第 2 位，
   *      而提示词里写的还是 `<Video 3>`。缺失项保留（abs=''）即表示该槽位留空。
   */
  const videoEntries = resolveMediaEntriesCore(shot.refs?.videos, cfg)
    .slice(0, MAX_REF_VIDEOS)
    .map((v, i) => ({ ...v, index: i + 1, key: `{{REF_VIDEO_${i + 1}}}` }));
  const audioEntries = resolveMediaEntriesCore(shot.refs?.audios, cfg)
    .slice(0, MAX_REF_AUDIOS)
    .map((a, i) => ({ ...a, index: i + 1, key: `{{REF_AUDIO_${i + 1}}}` }));
  warnMissingMedia(job, shot, cfg);

  const toStage = {
    ...Object.fromEntries(refList.filter((r) => r.abs).map((r) => [r.key, r.abs])),
    ...previz,
    ...Object.fromEntries(videoEntries.filter((v) => v.abs).map((v) => [v.key, v.abs])),
    ...Object.fromEntries(audioEntries.filter((a) => a.abs).map((a) => [a.key, a.abs])),
  };
  const staged = await comfy.stageToComfyInput(cfg, toStage, job.id);

  // 判定"是否真的接了参考素材"必须看**已落地的** staged 文件名，而不是解析出来的条目数：
  // 条目存在但全部 stage 失败时，挂上 ReferenceToVideo 却零参考会退化成静默纯文生。
  const useRef = refList.length > 0
    || videoEntries.some((v) => staged[v.key])
    || audioEntries.some((a) => staged[a.key]);
  const useFirstLast = Boolean(staged['{{FIRST_FRAME}}'] || staged['{{LAST_FRAME}}']);   // 供日志/计划展示

  // 模型名：优先用 ComfyUI 实际可用的文件（用户可能装的是 int8 而非 fp8）。
  const modelFiles = await comfy.listModelFiles(cfg).catch(() => ({ ok: false }));
  const available = modelFiles ?? {};
  const NAMES = resolveModelNames(cfg, {
    UNET_REF: available.diffusion_models,
    UNET_FL2V: available.diffusion_models,
    CLIP: available.text_encoders,
    VAE: available.vae,
    AUDIO_VAE: available.vae,
    LORA_REF: available.loras,
    LORA_FL2V: available.loras,
  });

  /* ============================================================ 加速方案
   *
   * 详见 services/accel-plan.js 的头注释（为什么必须显式设 shift、
   * 两个方案族的技术差异、以及"DMAD 不改变任何输入约束"的实测结论）。
   *
   * 优先级：job 显式指定 > 镜头卡 > 配置默认 > 内置默认。
   * 这样单镜可以覆盖（比如某镜要快就用 dmad4），
   * 同时全局默认由 config.accelPlan 决定。
   */
  const accelId = job.params?.accelPlan
    ?? shot.accelPlan
    ?? cfg.accelPlan
    ?? DEFAULT_ACCEL_PLAN;
  const accel = planForShot(accelId);

  // 步数：job 传了就以 job 为准（但要校验并记录警告），否则用方案的训练步数
  const wantSteps = job.params?.steps;
  const stepCheck = wantSteps ? checkSteps(accelId, wantSteps) : { ok: true, warning: '' };
  const steps = stepCheck.ok && Number.isFinite(Number(wantSteps))
    ? Number(wantSteps)
    : accel.steps;

  if (accel.warnings.length) {
    job.warnings = [...(job.warnings ?? []), ...accel.warnings];
  }
  if (stepCheck.warning) {
    job.warnings = [...(job.warnings ?? []), stepCheck.warning];
  }
  /**
   * `ok: false` 表示「这个步数不能这么用」，此时已经**静默回退到方案推荐步数**。
   *
   * 必须额外说清「实际跑了多少」—— 否则用户填 8 步、系统跑 50 步，
   * 耗时长 5 倍却没有一句解释，只会以为是卡住了。
   */
  if (!stepCheck.ok && wantSteps != null) {
    job.warnings = [...(job.warnings ?? []),
      `已忽略你填的 ${wantSteps} 步，实际按 ${accel.plan.label} 的推荐值 ${steps} 步执行`];
  }

  job.params = {
    ...(job.params ?? {}),
    accelPlan: accel.plan.id,
    accelLabel: accel.plan.label,
    accelFamily: accel.plan.family,
    sampler: accel.sampler,
    scheduler: accel.scheduler,
    steps,
    shiftVideo: accel.shiftVideo,
    shiftAudio: accel.shiftAudio,
  };

  const map = {
    '{{PROMPT}}': finalPrompt,
    '{{WIDTH}}': res.width,
    '{{HEIGHT}}': res.height,
    '{{LENGTH}}': h3Length(shot.durationSec),
    '{{STEPS}}': steps,
    '{{FPS}}': 24,
    '{{SEED}}': Number.isFinite(Number(job.params?.seed)) ? Number(job.params.seed) : 1101,
    // 参考图缩放策略：
    //   match — 缩到生成面积（快，默认）
    //   max   — 短边固定 2048（一致性最好，但明显更慢，官方注明可能慢数倍）
    //
    // 显存不足时自动降级为 match（decideRefImageSize 会把原因写进警告，
    // 上层渲染计划也会展示，不静默）。
    '{{REF_IMAGE_SIZE}}': refSizeDecision.value,
    // 有参考图走 Ref2VA，否则 FL2VA（两模型不通用）
    '{{UNET_NAME}}': useRef ? NAMES.UNET_REF : NAMES.UNET_FL2V,
    '{{CLIP_NAME}}': NAMES.CLIP,
    '{{VAE_NAME}}': NAMES.VAE,
    '{{AUDIO_VAE_NAME}}': NAMES.AUDIO_VAE,
    /**
     * LoRA：由加速方案决定，不再按 ref/fl2v 硬编码。
     *
     * · dmad 家族 — 一个通用 LoRA，ref 和 fl2v 都用它
     * · none     — 空字符串，下面的装配会把 LoRA 节点整个优化掉
     */
    '{{LORA_NAME}}': accel.lora,
    // 蒸馏学生在 strength=1.0 是满血；降到 0.5 会让低步数去噪不足。
    '{{LORA_STRENGTH}}': accel.lora ? 1.0 : 0.0,
    // 采样器 / 调度器 / shift：全部由方案给出，不写死
    '{{SAMPLER}}': accel.sampler,
    '{{SCHEDULER}}': accel.scheduler,
    '{{SHIFT_VIDEO}}': accel.shiftVideo ?? 12,
    '{{SHIFT_AUDIO}}': accel.shiftAudio ?? 3,
  };

  const names = refList.map((r) => staged[r.key]).filter(Boolean);

  // ========================================================== 节点图装配
  //
  // 用 NodeGraph 统一分配 ID，最后靠**可达性剪枝**而不是"编号白名单"来
  // 清理多余节点。历史实现靠硬编码槽位段互不冲突，炸过两次：
  //   · 首尾帧的 20/21 被 ref_images 的清理逻辑误删（P0，见 h3-graph.js 头注释）
  //   · AddGuide 从 70 编号覆盖了 70/71 的 LoadImage
  // 详见 host/services/h3-graph.js。
  const graph = new NodeGraph(workflow);
  const refNode = graph.get('9');

  if (refNode?.class_type === 'MiniMaxH3ReferenceToVideo') {
    if (!useRef) {
      // ---------- 无参考素材：退回 MiniMaxH3ImageToVideo（t2va / fl2va）----------
      const inputs = {
        clip: ['2', 0], vae: ['3', 0], prompt: '{{PROMPT}}',
        width: '{{WIDTH}}', height: '{{HEIGHT}}', length: '{{LENGTH}}',
      };
      // 首尾帧：LoadImage 必须真的建出来并填 staged 文件名。
      // 这里用 graph.alloc 分配，节点一定登记在案，
      // 后续 pruneUnreachable 会因为它被 first_frame 引用而保留。
      if (staged['{{FIRST_FRAME}}']) {
        const id = graph.alloc('REF_IMAGE', 9);
        graph.set(id, { class_type: 'LoadImage', inputs: { image: staged['{{FIRST_FRAME}}'] } });
        inputs.first_frame = [id, 0];
      }
      if (staged['{{LAST_FRAME}}']) {
        const id = graph.alloc('REF_IMAGE', 9);
        graph.set(id, { class_type: 'LoadImage', inputs: { image: staged['{{LAST_FRAME}}'] } });
        inputs.last_frame = [id, 0];
      }
      graph.set('9', { class_type: 'MiniMaxH3ImageToVideo', inputs });
    } else {
      // ---------- 有参考素材：MiniMaxH3ReferenceToVideo（ref2va）----------
      //
      // ⚠️ ref_images 是 AUTOGROW 输入，prefix = "ref_image_"，
      //    正确写法必须带点号：ref_images.ref_image_1 / ref_image_2 ...
      //    写错成 ref_images = [["20",0], ...] 会被静默忽略（实测：
      //    同 prompt+seed 下有无参考图输出哈希完全相同）。
      delete refNode.inputs.ref_images;
      for (const k of Object.keys(refNode.inputs)) {
        if (/^ref_image_\d+$/.test(k)) delete refNode.inputs[k];
      }
      for (let i = 0; i < names.length; i++) {
        const id = graph.alloc('REF_IMAGE', 9);
        graph.set(id, { class_type: 'LoadImage', inputs: { image: names[i] } });
        refNode.inputs[`ref_images.ref_image_${i + 1}`] = [id, 0];
      }

      // ---- 参考视频 + 音轨 + 独立音频 ----
      //
      //   LoadVideo(file) → GetVideoComponents ─┬─ IMAGE → ref_videos.ref_video_K
      //                                          └─ AUDIO → ref_video_audios.ref_video_audio_K
      //   LoadAudio(audio) ──────────────────────── AUDIO → ref_audios.ref_audio_N
      //
      // ⚠️ 视频与其音轨**必须同号**（ComfyUI 源码按编号配对，不按数组顺序）。
      //    没有音轨的视频不要接 ref_video_audios，否则编号会错位。
      const videoStage = videoEntries.map((v) => ({ ...v, fileName: staged[v.key] })).filter((v) => v.fileName);
      const audioStage = audioEntries.map((a) => ({ ...a, fileName: staged[a.key] })).filter((a) => a.fileName);

      for (const v of videoStage) {
        const loadId = graph.alloc('REF_MEDIA', 20);
        const splitId = graph.alloc('REF_MEDIA', 20);
        graph.set(loadId, { class_type: 'LoadVideo', inputs: { file: v.fileName } });
        graph.set(splitId, { class_type: 'GetVideoComponents', inputs: { video: [loadId, 0] } });
        // GetVideoComponents 输出：0=IMAGE(帧) 1=AUDIO(音轨) 2=fps 3=bit_depth 4=color_space
        refNode.inputs[`ref_videos.ref_video_${v.index}`] = [splitId, 0];
        if (v.hasAudio) {
          refNode.inputs[`ref_video_audios.ref_video_audio_${v.index}`] = [splitId, 1];
        }
      }

      for (const a of audioStage) {
        const loadId = graph.alloc('REF_MEDIA', 20);
        graph.set(loadId, { class_type: 'LoadAudio', inputs: { audio: a.fileName } });
        refNode.inputs[`ref_audios.ref_audio_${a.index}`] = [loadId, 0];
      }

      // ---- 首尾帧（Ref2VA 分支）----
      //
      // ⚠️ Ref2VA 节点**没有** first_frame / last_frame 输入口 ——
      //    那两个只属于 MiniMaxH3ImageToVideo。有参考图时想锚首尾帧，
      //    唯一正确的通道是 MiniMaxH3AddGuide。
      //
      // ⚠️ 实测：AddGuide 的锚定强度非常高 —— 锚白模首帧，整段输出都会是白模。
      //    所以首尾帧应当是**成片风格**的图（例如白模经 H3-Image 转成片后的产物）。
      //
      // ⚠️ AddGuide 的 positive/latent/vae/image 四个输入都要接对：
      //    latent 必须是 Ref2VA 节点(9) 的**第 1 个输出**（AV latent），
      //    不是第 0 个（conditioning）。
      let prevGuideId = null;
      const addGuide = (imageId, frameIdx) => {
        const id = graph.alloc('GUIDE', 20);
        graph.set(id, {
          class_type: 'MiniMaxH3AddGuide',
          inputs: {
            positive: [prevGuideId ?? '9', 0],
            latent: ['9', 1],
            vae: ['3', 0],
            frame_idx: frameIdx,
            image: [imageId, 0],
          },
        });
        prevGuideId = id;
        return id;
      };

      if (staged['{{FIRST_FRAME}}']) {
        const imgId = graph.alloc('GUIDE_IMG', 10);
        graph.set(imgId, { class_type: 'LoadImage', inputs: { image: staged['{{FIRST_FRAME}}'] } });
        addGuide(imgId, 0);
      }
      if (staged['{{LAST_FRAME}}']) {
        const imgId = graph.alloc('GUIDE_IMG', 10);
        graph.set(imgId, { class_type: 'LoadImage', inputs: { image: staged['{{LAST_FRAME}}'] } });
        addGuide(imgId, -1);   // 负值 = 从末尾数，正好是最后一帧
      }
      if (prevGuideId) {
        // 引导链末端才是最终 conditioning
        const guider = graph.get('8');
        if (guider) {
          graph.set('8', { ...guider, inputs: { ...guider.inputs, conditioning: [prevGuideId, 0] } });
        }
      }
    }
  }

  // ======================================================== 模型链路重接
  //
  // 采样链路现在是三段：
  //
  //     1 UNETLoader → 4 LoRA → 103 SigmaShift → 7/8 采样
  //
  // 为什么 SigmaShift 必须在 LoRA **之后**：
  //   LoRA 改的是权重，SigmaShift 改的是 `model_sampling`（sigma 网格）与
  //   transformer_options 里的 shift 值。两者作用对象不同，但顺序上官方
  //   DMAD 工作流就是 LoRA → shift，照抄即可。
  const shiftNodeOk = accel.needShiftNode;
  const baseModelRef = shiftNodeOk ? ['103', 0] : (accel.lora ? ['4', 0] : ['1', 0]);

  // `none` 方案不挂 LoRA：节点 4 没有下游消费者会被 prune 掉，
  // 但它的 lora_name 是空字符串 —— 先把节点 4 本身删掉，避免
  // ComfyUI 拿到空文件名报错。采样链路直接接 UNET(1)。
  if (!accel.lora) {
    graph.remove('4');
  }

  // 模板里 7 / 8 都写死 ["4", 0]，这里统一改到 shift 之后的出口
  for (const id of ['7', '8']) {
    const n = graph.get(id);
    if (n) graph.set(id, { ...n, inputs: { ...n.inputs, model: baseModelRef } });
  }

  // shift 节点在 `none` 方案下不需要（shiftVideo == null）：此时 7/8 直接
  // 指向 LoRA(4)，103 没有下游消费者，pruneUnreachable 会把它删掉。
  // 不需要额外操作。

  // ======================================================== 收尾：剪枝 + 校验
  //
  // ① pruneUnreachable：从输出节点反向遍历，删掉一切不可达节点。
  //    这一步取代了原来那段 `usedLoadImages` 硬编码清理 ——
  //    那个写法正是"首尾帧被误删"的根因。
  // ② validateLinks：提交前检查所有连线目标存在。
  //    历史实现里 first_frame 指向已删除的 '20'，要到 ComfyUI 校验才以
  //    `node_errors['9'] details "'20'"` 这种极难读的形式暴露。
  const pruned = graph.pruneUnreachable();
  const links = graph.validateLinks();
  if (!links.ok) {
    const detail = links.dangling
      .slice(0, 5)
      .map((d) => `${d.path} -> node ${d.to}`)
      .join('; ');
    throw new Error(`WORKFLOW_DANGLING_LINK: 节点图存在悬空连线（${detail}）`);
  }
  if (pruned.removed.length) {
    job.params = { ...(job.params ?? {}), nodesPruned: pruned.removed.length };
  }

  const wfCopy = graph.nodes;

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  return comfy.runWorkflow({ cfg, workflow: wfCopy, map, job, outputsDir, onSubmitted });
}

/* ============================================================ 图像生成 */

/**
 * 执行一次 H3-Image 生成（文生图 / 参考图编辑 / LoRA）。与视频共用 Qwen3-VL 编码器，
 * 只换扩散模型 + 图像 VAE。
 *
 * 参考图来源只有两条，**都走图像语义**（保序、≤16、不去重合并）：
 *   `job.params.imageRefs`（路由层已用 `resolveImageEditRefs` 解析）
 *   `shot.refs.images`（立绘拆解 / 画布 Agent 这类"参考图集合"调用方）
 *
 * 绝不能回退到 `resolveRefImages`：那是视频语义（角色卡优先、≤9），
 * 会把 `image_1`（被编辑原图）换成角色卡立绘，且超过 9 张的部分静默丢失。
 */
export async function runH3ImageLocal({ workflow, job, prompt, shot, cfg = loadConfig(), onSubmitted, onProgress }) {
  const { runH3Image } = await import('./h3-image.js');
  const params = job.params ?? {};

  let refImages = Array.isArray(params.imageRefs) ? params.imageRefs : [];
  if (!refImages.length) {
    const fromShot = Array.isArray(shot?.refs?.images) ? shot.refs.images : [];
    if (fromShot.length) {
      const parsed = resolveImageEditRefs(fromShot, cfg);
      refImages = parsed.ok.map((r) => r.abs);
      if (parsed.bad.length) {
        job.warnings = [...(job.warnings ?? []),
          `有 ${parsed.bad.length} 张参考图解析失败（已跳过，实际使用 ${refImages.length} 张）：`
          + parsed.bad.map((b) => `${b.input}（${b.reason}）`).join('、')];
      }
      if (parsed.dropped > 0) {
        job.warnings = [...(job.warnings ?? []),
          `参考图超出图像编辑上限 ${parsed.max} 张，已丢弃 ${parsed.dropped} 张。`];
      }
    }
  }

  return runH3Image({
    workflow,
    job,
    prompt,
    cfg,
    sizeId: params.imageSizeId ?? shot?.imageSizeId ?? 'auto',
    width: params.width,
    height: params.height,
    refImages,
    count: params.count ?? 1,
    loras: Array.isArray(params.imageLoras) ? params.imageLoras : [],
    onSubmitted,
    onProgress,
  });
}

/** 判断一个 job 是图像还是视频任务 */
export function jobKind(job) {
  return job?.kind === 'image' || job?.params?.kind === 'image' ? 'image' : 'video';
}

/* ====================================================== 南风 V15 生成路径 */

/**
 * 用南风 V15 节点执行一次 H3 视频生成。
 *
 * 与 `runH3Local` 的分工：后者加载 `workflows/h3.json` 模板做占位符替换；
 * 这里把镜头卡翻译成 221 个参数，由南风节点的 GraphBuilder 展开成图。
 * 模型加载、条件编码、采样、放大、解码全封在节点内部，后端只管
 * 选预设 / 传参 / 接输出 / 轮询。
 *
 * 素材槽位（图片1-9 / 视频1-3 / 音频1-3）只认 **ComfyUI input 目录内的文件名**，
 * 所以必须先 stage。
 *
 * @param {object} opts
 * @param {object} opts.job
 * @param {object} opts.shot
 * @param {string} opts.prompt            编译后的提示词
 * @param {object} [opts.cfg]
 * @param {'ref2va'|'t2va'|'i2va'|'fl2va'} [opts.mode]
 * @param {string|object} [opts.preset]   预设 id 或 { inherit, overrides }
 * @param {Record<string, unknown>} [opts.extraParams]
 * @param {string} [opts.continuationTask] 续写任务 JSON
 * @param {Function} [opts.onSubmitted]
 */
export async function runH3Nanfeng({
  job,
  shot,
  prompt,
  cfg = loadConfig(),
  mode,
  preset,
  extraParams,
  continuationTask,
  outputsDir,
  onSubmitted,
}) {
  const nanfeng = (await import('../bridge/index.js')).nanfeng;

  /* ==================================================================
   * 1) 加速方案（DMAD）—— 映射到南风参数
   * ==================================================================
   *
   * 优先级：job 显式 > 镜头卡 > 配置默认 > 内置默认。
   *
   * 南风 V15 的 LoRA 是**独立槽位**语义（`individual_lora_slots=True`）：
   *   · `启用LoRA` 总开关对 V15 无效（早退只对 individual=False 生效）
   *   · 真正生效的是 `LoRA{n}启用` + `LoRA{n}` + `LoRA{n}强度`
   * 所以两套都要写：`启用LoRA` 保持语义一致便于排查，`LoRA1启用` 才是生效的那个。
   */
  const accelId = job.params?.accelPlan
    ?? shot.accelPlan
    ?? cfg.accelPlan
    ?? DEFAULT_ACCEL_PLAN;

  /**
   * 先问 ComfyUI 真实装了哪些 LoRA，再决定加速方案用哪个文件。
   *
   * 方案里的 `lora` 只是导出那一刻的目录快照。用户换机、重命名或只装了一个学生时，
   * 写死的名字在 ComfyUI 里不存在：轻则 `/prompt` 阶段 value_not_in_list
   * （错误信息只有一个文件名），重则 sanitize 把它回退成「未选择」→ 蒸馏栈变空 →
   * 4/8 步跑在未蒸馏原模型上，能出片但质量悄悄崩。
   * 探测失败（不可达）时返回 null，退回按声明名提交并告警。
   */
  let loraFiles = null;
  try {
    const comfyMod = await import('./comfy-client.js');
    const mf = await comfyMod.listModelFiles(cfg);
    loraFiles = mf?.ok && Array.isArray(mf.loras) && mf.loras.length ? mf.loras : null;
  } catch { /* 探测失败不影响主流程 */ }

  const accel = resolveAccelForFiles(accelId, loraFiles);
  const availableFiles = loraFiles;

  const wantSteps = job.params?.steps;
  const stepCheck = wantSteps ? checkSteps(accelId, wantSteps) : { ok: true, warning: '' };
  const steps = stepCheck.ok && Number.isFinite(Number(wantSteps))
    ? Number(wantSteps)
    : accel.steps;

  if (accel.warnings.length) {
    job.warnings = [...(job.warnings ?? []), ...accel.warnings];
  }
  if (stepCheck.warning) {
    job.warnings = [...(job.warnings ?? []), stepCheck.warning];
  }
  /**
   * `ok: false` 表示「这个步数不能这么用」，此时已经**静默回退到方案推荐步数**。
   *
   * 必须额外说清「实际跑了多少」—— 否则用户填 8 步、系统跑 50 步，
   * 耗时长 5 倍却没有一句解释，只会以为是卡住了。
   */
  if (!stepCheck.ok && wantSteps != null) {
    job.warnings = [...(job.warnings ?? []),
      `已忽略你填的 ${wantSteps} 步，实际按 ${accel.plan.label} 的推荐值 ${steps} 步执行`];
  }

  /**
   * 把加速方案翻译成南风参数覆盖。
   *
   * `shiftVideo/shiftAudio` 通过 `视频西格玛偏移` / `音频西格玛偏移` 生效，
   * 必须同时置 `启用西格玛调节` 并显式选「原生轨迹」策略。
   */
  function accelOverrides() {
    const out = {};
    out['采样器'] = accel.sampler;
    out['调度器'] = accel.scheduler;
    out['采样步数'] = steps;
    /**
     * shift 必须真的传下去。
     *
     * DMAD 4step / 8step 都是在 video shift 12 / audio shift 2 上训练的
     * （两个 .safetensors 的 `__metadata__.sampling` 里写着原文，可直接读文件核对），
     * 而 ComfyUI 的 `MiniMaxH3` 模型自带 12 比 3 —— 那是未蒸馏原模型的标定值。
     *
     * 用错 shift 不报错，只是整条采样轨迹落在学生没见过的分布外：
     * 画面能出，但质感与动态会悄悄变差。
     *
     * vendor 的 `启用西格玛调节` 会真的插入 MiniMaxH3SigmaShift，
     * 且 `Sigma策略=原生轨迹` 时只设 shift、不改步网格 —— 正是蒸馏学生要的形态。
     */
    if (accel.shiftVideo != null || accel.shiftAudio != null) {
      out['启用西格玛调节'] = true;
      // 必须显式写「原生轨迹」，否则会走进加密/手动序列分支，把步网格改掉
      out['Sigma策略'] = '原生轨迹（不加步）';
      out['视频西格玛偏移'] = accel.shiftVideo ?? 12;
      out['音频西格玛偏移'] = accel.shiftAudio ?? 3;
    } else {
      // none 方案：不碰 sigma，用模型自带的 12/3
      out['启用西格玛调节'] = false;
    }
    return out;
  }

  const accelParams = accelOverrides();

  /**
   * 种子 —— 必须真正透传到 `随机种子`。
   *
   * 优先级：`job.params.seed`（路由层写入，用户填的）> 镜头卡 `shot.seed`。
   * 都不存在时不写这个键，交给南风 schema 默认值（`470115107471061`）。
   *
   * 写进 `extraParams` 是唯一生效路径：`buildShotWorkflow` 的 `extraParams` 是
   * 最高优先级层，而 `buildShotOverrides` 只读 `shot.seed`（镜头卡模型里没有这个字段）。
   */
  const seedFromJob = Number(job.params?.seed);
  const seedFromShot = Number(shot?.seed);
  const seedValue = Number.isFinite(seedFromJob) && job.params?.seed !== null
    ? seedFromJob
    : (Number.isFinite(seedFromShot) && shot?.seed !== null ? seedFromShot : null);
  if (seedValue != null) {
    accelParams['随机种子'] = seedValue;
    job.params = { ...(job.params ?? {}), seed: seedValue, seedSubmitted: seedValue };
  }

  /**
   * LoRA 栈装配 —— 加速学生占 1 号槽，其余槽位留给语义 LoRA。
   *
   * 南风 V15 有 8 个槽（`LoRA{n}` + `LoRA{n}启用` + `LoRA{n}强度`）；
   * `启用LoRA` 总开关对 V15 无效（早退只对 individual=False 生效）。
   *
   * 强度：加速 LoRA 是**学生本体**，恒 1.0、永不衰减；语义 LoRA 才压强度
   * （链式叠加是加法，两个 1.0 会 >1 过曝），由 stackDecay 与总强度看门狗控制。
   *
   * 加速学生必须放 **LoRA1**：`_enabled_lora_stack()` 按 1→8 顺序串，学生是新的基座，
   * 要对后续所有语义偏移生效；放后面会让语义 LoRA 叠加在未蒸馏权重上再被覆盖。
   */
  const requestedLoras = [
    ...(accel.lora ? [{ name: accel.lora, strength: 1.0 }] : []),
    ...(Array.isArray(shot.nanfeng?.loras) ? shot.nanfeng.loras : []),
  ];
  const solved = solveLoraStack(requestedLoras, { maxSlots: 8, availableFiles });

  // 加速学生钉死在槽 1：它是新的基座，要覆盖后续所有语义 LoRA 的权重偏移
  const ordered = [
    ...solved.accepted.filter((a) => a.role === 'accelerator'),
    ...solved.accepted.filter((a) => a.role !== 'accelerator'),
  ];

  const LORA_STRENGTH_FLOOR = 2;
  for (let i = 1; i <= 8; i += 1) {
    const entry = ordered[i - 1];
    const on = Boolean(entry);
    accelParams[`LoRA${i}`] = on ? entry.name : '未选择';
    accelParams[`LoRA${i}启用`] = on;
    // 视频侧兜底：求解器已按分类夹过，这里再按 [-2,2] 兜一次，
    // 与图像侧（h3-image.js / h3-inpaint.js）的语义对齐。
    accelParams[`LoRA${i}强度`] = on ? clampSignedStrength(entry.appliedStrength, LORA_STRENGTH_FLOOR) : 1.0;
  }
  accelParams['启用LoRA'] = ordered.length > 0;

  // 把求解过程写进 warnings —— 用户必须知道"我填的限制被改了"
  for (const w of solved.warnings) job.warnings = [...(job.warnings ?? []), w];
  for (const rp of solved.replaced) {
    job.warnings = [...(job.warnings ?? []),
      `「${rp.category}」是单选类：「${baseNameOf(rp.name)}」被「${baseNameOf(rp.by)}」替换（同类只能挂 1 个）。`];
  }
  for (const rj of solved.rejected) {
    job.warnings = [...(job.warnings ?? []), `LoRA「${baseNameOf(rj.name)}」未被使用：${rj.reason}`];
  }
  for (const dg of solved.degraded) {
    job.warnings = [...(job.warnings ?? []),
      `LoRA「${baseNameOf(dg.name)}」强度 ${dg.from} → ${dg.to}（${dg.reason}）。`];
  }

  // shift 与学生的训练设定不一致 = 分布外采样：不报错，但画质与动态会变差
  if (accel.needShiftNode && accel.loraMeta?.steps) {
    const drift = Number(accel.shiftVideo) !== 12 || Number(accel.shiftAudio) !== 2;
    if (drift) {
      job.warnings = [...(job.warnings ?? []),
        `加速方案 ${accel.plan.label} 声明 shift ${accel.shiftVideo}/${accel.shiftAudio}，`
        + '不是该学生训练时的 12/2 —— 属于分布外采样，能出片但画质与动态会变差。',
      ];
    }
  }

  job.params = {
    ...(job.params ?? {}),
    accelPlan: accel.plan.id,
    accelLabel: accel.plan.label,
    accelFamily: accel.plan.family,
    accelMatched: accel.matched,
    sampler: accel.sampler,
    scheduler: accel.scheduler,
    steps,
    lora: accel.lora || null,
    // 最终生效的 LoRA 栈（含分类与衰减后的实际强度），排障时看这一项
    loraStack: ordered.map((a) => `${a.categoryId}:${a.name}@${a.appliedStrength}`),
    loraTotalStrength: solved.totalStrength,
    // shift 现在真的会写进 workflow（见 accelOverrides）
    shiftApplied: Boolean(accel.needShiftNode),
    shift: accel.needShiftNode ? { video: accel.shiftVideo, audio: accel.shiftAudio } : null,
  };

  // ---------- 2) 解析参考素材并 stage ----------
  const refList = resolveRefImagesCore(shot, cfg);
  const previz = resolvePrevizArtifactsCore(shot, cfg);

  // 编号 = **挂载顺序的槽位号**（下标 + 1），不能先 filter 缺失项再重排 ——
  // 提示词里的 `<Video N>` 按挂载顺序写，压缩数组会让指令与实物错位。
  const videoEntries = resolveMediaEntriesCore(shot.refs?.videos, cfg)
    .slice(0, MAX_REF_VIDEOS)
    .map((v, i) => ({ ...v, index: i + 1, key: `{{REF_VIDEO_${i + 1}}}` }));
  const audioEntries = resolveMediaEntriesCore(shot.refs?.audios, cfg)
    .slice(0, MAX_REF_AUDIOS)
    .map((a, i) => ({ ...a, index: i + 1, key: `{{REF_AUDIO_${i + 1}}}` }));
  warnMissingMedia(job, shot, cfg);

  const toStage = {
    ...Object.fromEntries(refList.filter((r) => r.abs).map((r) => [r.key, r.abs])),
    ...previz,
    ...Object.fromEntries(videoEntries.filter((v) => v.abs).map((v) => [v.key, v.abs])),
    ...Object.fromEntries(audioEntries.filter((a) => a.abs).map((a) => [a.key, a.abs])),
  };
  const staged = await comfy.stageToComfyInput(cfg, toStage, job.id);

  // ---------- 2) 把 staged 的文件名回填进镜头卡副本 ----------
  //
  // stagedMap: 占位符 key → ComfyUI input 内的文件名
  // 我们要把它翻译成南风的「图片N / 视频N / 音频N」
  //
  // ⚠️ 顺序必须**保位**：南风按 `视频1..3` / `音频1..3` 的槽位号取素材，
  //    而 build_native_prompt 又把 `@视频N` 映射成 `<Video N>`。
  //    用 `.filter(Boolean)` 压缩数组会让"第 2 个 stage 失败"变成
  //    "第 3 个前移成第 2 个"，提示词里的编号与实物错位且不报错。
  const stagedSlot = (entries) => entries.map((e) => staged[e.key] ?? '');
  const stagedImages = stagedSlot(refList);
  const stagedVideos = stagedSlot(videoEntries);
  const stagedAudios = stagedSlot(audioEntries);

  {
    const lost = [
      ...videoEntries.filter((v, i) => !stagedVideos[i]).map((v) => `视频 ${v.rel}`),
      ...audioEntries.filter((a, i) => !stagedAudios[i]).map((a) => `音频 ${a.rel}`),
    ];
    if (lost.length) {
      job.warnings = [...(job.warnings ?? []),
        `以下素材未能上传到 ComfyUI input/，对应槽位会留空：${lost.join('、')}`];
    }
  }

  /**
   * 首尾帧在**南风路径**上的接线。
   *
   * 南风节点 `NanFengH3MultiReferenceGeneratorV15` **没有** first_frame / last_frame
   * 输入口 —— 它的首尾帧就是 `图片1` 和 `图片2` 本身。vendor 的硬校验
   * （h3_generator.py:1378-1381）：图生视频 image_count 必须 == 1，
   * 首尾帧必须 == 2（图片1=首帧，图片2=尾帧）。
   *
   * 所以 `{{FIRST_FRAME}}` / `{{LAST_FRAME}}` 这两个占位符在本路径没有消费者，
   * 必须按 mode 直接把 staged 的首尾帧塞进 图片1 / 图片2，
   * 并且参考图不得占用这两个槽位 —— 见下方 planImageSlots。
   */

  /**
   * 参考图槽位要**避开**被首尾帧占用的编号。
   *
   * `buildShotOverrides` 会把 `refs.images` 按下标填进 `图片1..9`，
   * 而 extraParams 优先级最高 —— 若首尾帧直接写 `图片1`，角色卡图会被顶掉，
   * 但提示词里 `<Picture 1>` 仍写着"这是角色外观"：指令与实物完全对不上，
   * 表现为串脸/丢角色且不报错。南风的 `i2va-needs-one-image` 只检查总数 == 1，
   * 覆盖后仍是 1 张，所以约束也拦不住。
   *
   * 正确做法：首/尾帧占用的编号从参考图里剔除，其余按原顺序补位。
   */
  const slotPlan = planImageSlotsCore(mode ?? shot.mode, stagedImages, staged['{{FIRST_FRAME}}'] ?? '', staged['{{LAST_FRAME}}'] ?? '');
  if (slotPlan.dropped.length) {
    job.warnings = [...(job.warnings ?? []),
      `首/尾帧占用了 图片${slotPlan.reserved.join('、图片') || '—'}，`
      + `参考图被迫减少 ${slotPlan.dropped.length} 张（超出的 ${slotPlan.dropped.length} 张不会进入本次生成）。`
      + `提示词里的 <Picture N> 已按最终槽位重新编号。`];
  }

  const shotForNanfeng = {
    ...shot,
    // 用 staged 文件名覆盖原始 rel 路径；空串表示该槽位不填
    refs: {
      ...(shot.refs ?? {}),
      images: slotPlan.images,
      // 视频/音频必须**保位**，不能 filter(Boolean) 压缩：
      // buildShotOverrides 的写法是 `视频${i+1} = videos[i]`，数组下标就是槽位号。
      // 空串占位由 toComfyFileName 转成「未选择」，是安全且正确的。
      videos: stagedVideos,
      audios: stagedAudios,
    },
  };

  // ---------- 3) 组装 workflow ----------
  //
  // 能力探测：先问 ComfyUI 实际注册了哪些节点，再据此关闭缺依赖的加速项。
  // 没有这一步时，用户勾上「启用H3 SLA」会在 GraphBuilder 展开阶段抛
  // "node H3SLAAttention not found"，整单失败且错误信息极难懂。
  let availableNodes = null;
  try {
    const comfyMod = await import('./comfy-client.js');
    availableNodes = await nanfeng.fetchAvailableNodes(cfg, comfyMod.resolveComfyUrl);
  } catch { /* 探测失败不影响主流程 */ }

  const built = nanfeng.buildShotWorkflow({
    shot: shotForNanfeng,
    mode,
    preset,
    extraParams: {
      ...(extraParams ?? {}),
      // 编译后的提示词优先于镜头卡里的 prompt
      ...(prompt ? { 提示词: injectCardDefinitions(prompt, refList, shot, slotPlan.pictureIndexMap) } : {}),
      // 首/尾帧占用 图片1/图片2（见 planImageSlots），优先级最高
      ...slotPlan.frameSlots,
      // 加速方案必须放**最后**：extraParams 是最高优先级层，而预设里写着
      // `采样器: lcm` —— 先合并会被预设覆盖回 lcm + 步数错配。LoRA 槽位同理。
      ...accelParams,
    },
    jobId: job.id,
    continuationTask,
    frameRate: 24,
    saveVideo: true,
    availableNodes,
  });

  // ---------- 4) 记录参数快照（前端/工具要展示） ----------
  job.params = {
    ...(job.params ?? {}),
    backend: 'h3-nanfeng',
    presetIds: built.presetIds,
    nanfengParams: summariseParams(built.params),
  };
  if (built.warnings.length) {
    job.warnings = [...(job.warnings ?? []), ...built.warnings];
  }

  // ---------- 5) 提交并轮询 ----------
  //
  // 归档目录必须是真实路径：传 null 时 comfy.runWorkflow 里的
  // `fs.mkdirSync(outputsDir)` 会抛类型错误 —— 视频其实已生成，整单却被标 failed。
  const destDir = outputsDir ?? path.join(cfg.dataDir, 'outputs');

  return comfy.runWorkflow({
    cfg,
    workflow: built.workflow,
    map: {},                       // 南风路径不做占位符替换
    job,
    outputsDir: destDir,
    onSubmitted,
  });
}

/**
 * 把 221 个参数收敛成可排障的快照：关键项 + 所有非空素材槽位。
 *
 * 不是"只保留非默认值"——这里没有默认值可比，只是**挑选**。
 * 必须包含 `随机种子`，否则任务记录里看不到实际提交的种子，无法复现。
 *
 * @param {Record<string, unknown>} params
 * @returns {Record<string, unknown>}
 */
function summariseParams(params) {
  const schema = params; // 已是完整快照
  const out = {};
  // 关键项 —— `随机种子` 必须在列：不记的话任务记录里看不到实际提交值，无法复现
  for (const key of [
    '随机种子', '百万像素', '采样步数', '采样器', '调度器', '降噪强度',
    '启用H3潜空间放大二采', 'H3一采步数', 'H3二采步数',
    'H3潜空间目标百万像素', '启用潜空间续写', 'context_length',
    '启用锁音频', '启用实时预览',
  ]) {
    if (key in schema) out[key] = schema[key];
  }
  // 素材槽位只记非空的
  for (const [k, v] of Object.entries(schema)) {
    if (/^(图片|视频|音频)\d+$/.test(k) && v && v !== '未选择') out[k] = v;
  }
  return out;
}
