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
import { NodeGraph } from './h3-graph.js';
import { planForShot, accelPlanOf, checkSteps, DEFAULT_ACCEL_PLAN } from './accel-plan.js';

/** 内联图片落盘用短哈希，同图复用同一文件 */
function hashShort(text) {
  return createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
}

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
  // H3 是音画同步模型：采样器输出的是 AV latent，音轨要从 audio VAE 解出来。
  // 早先工作流只接了视频 VAEDecode，音轨被整个丢弃（产物没有音轨）。
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
 * 可用列表由调用方给（通常来自 ComfyUI 的 object_info）；
 * 拿不到列表时原样返回默认值，行为与旧实现一致。
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

/** 兼容旧引用：这些是**默认名**，实际用 resolveModelNames() */
const UNET_REF = MODEL_DEFAULTS.UNET_REF;
const UNET_FL2V = MODEL_DEFAULTS.UNET_FL2V;
const CLIP_NAME = MODEL_DEFAULTS.CLIP;
const VAE_NAME = MODEL_DEFAULTS.VAE;
const AUDIO_VAE_NAME = MODEL_DEFAULTS.AUDIO_VAE;
const LORA_REF = MODEL_DEFAULTS.LORA_REF;
const LORA_FL2V = MODEL_DEFAULTS.LORA_FL2V;

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
      // ⚠️ win32 上 path.isAbsolute('/jiuzhang/api/file?path=x') === true，
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

/** 从镜头卡 previz 绑定解析首尾帧 */
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
 * ⚠️ 编号**只能**来自 refList（真实提交顺序），不能来自"第几张卡"。
 *    之前用 `pictureIndex = 卡序号`：一旦某张卡没有图、或有手工图插进来，
 *    编号就整体错位，提示词里的 <Picture N> 指向别人的图 —— 表现为角色串脸。
 *    现在 refList 里每张图都带 cardId（见 resolveRefImages 的 push(..., 'vault-card', {cardId})），
 *    这里按 cardId 反查它在 refList 中的真实位置。
 *
 * ⚠️ 只写身份与编号，不复述像素级外观：
 *    外观由图片本身承载，文字重复描述反而会与图片冲突。
 */
function injectCardDefinitions(prompt, refList, shot) {
  const text = String(prompt ?? '');
  const cardById = new Map((shot.characterCards ?? []).map((c) => [c.id, c]));
  if (!cardById.size) return text;

  // 从**真实参考图清单**算出每张卡占哪几个编号
  const byCard = new Map();
  refList.forEach((r, i) => {
    if (!r.cardId) return;
    if (!byCard.has(r.cardId)) byCard.set(r.cardId, []);
    byCard.get(r.cardId).push(i + 1);
  });

  // 已经有正确的 subject_definitions 就不重复注入。
  // 判据从"提示词里出现过卡名"改为"卡名 + 正确编号都出现过" ——
  // 旧判据只要名字出现就跳过，于是编译器算错的编号被原样保留下来。
  const definitionsOk = (shot.characterCards ?? []).every((c) => {
    if (!c?.name) return true;
    if (!text.includes(String(c.name))) return false;
    const pics = byCard.get(c.id) ?? [];
    if (!pics.length) return true;            // 这张卡没有图，不需要编号
    return pics.some((n) => text.includes(`<Picture ${n}>`));
  });
  if (definitionsOk) return text;

  const cardEntries = [];
  for (const [id, info] of byCard) {
    const card = cardById.get(id) ?? { id, name: (shot.characterCards ?? []).find((c) => c.id === id)?.name };
    if (!card) continue;
    cardEntries.push({ card, pictureIndex: info[0], allPictures: info });
  }
  if (!cardEntries.length) return text;

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

export const H3_MODEL_NAMES = { UNET_REF, UNET_FL2V, CLIP_NAME, VAE_NAME, AUDIO_VAE_NAME, LORA_REF, LORA_FL2V };

/* ============================================================ 图像生成 */

/**
 * 执行一次 H3-Image 生成（文生图 / 参考图编辑）。
 * 与视频共用 Qwen3-VL 编码器，只换扩散模型 + 图像 VAE。
 */
export async function runH3ImageLocal({ workflow, job, prompt, shot, cfg = loadConfig(), onSubmitted }) {
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
    onSubmitted,
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
 * ============================================================================
 * 与 runH3Local 的区别
 * ============================================================================
 *
 *   runH3Local（旧）  ：加载 data/workflows/h3.json 模板 → {{占位符}} 替换 → 提交
 *   runH3Nanfeng（新）：镜头卡 → 217 参数 → 南风节点内部 GraphBuilder 展开 → 提交
 *
 * 南风节点把所有模型加载、条件编码、采样、放大、解码都封在节点内部，
 * 我们的后端只负责：① 选预设 ② 传参 ③ 接输出节点 ④ 轮询结果。
 *
 * ============================================================================
 * 必须先 stage 素材
 * ============================================================================
 *
 * 南风的素材槽位（图片1-9 / 视频1-3 / 音频1-3）接受的是 **ComfyUI input 目录
 * 内的文件名**，不是绝对路径。所以和旧实现一样，先把文件复制进 input。
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
  const nanfeng = await import('./nanfeng/index.js');

  /* ==================================================================
   * 1) 加速方案（DMAD）—— 映射到南风参数
   * ==================================================================
   *
   * ⚠️ 历史缺陷：这一段**完全缺失**。
   *    `runH3Local` 有完整的 accel-plan 接线，但 `runH3Nanfeng` 是从它复制来的，
   *    复制时漏了这一段（连同 previz 消费端 —— 同一处漏了两个）。
   *
   * 后果很严重但不报错：所有预设都是 `采样器: lcm` + 4-10 步，
   * 却**不挂 DMAD LoRA** —— 等于用 LCM 采样器跑未蒸馏的 50 步原模型再硬压到 4 步。
   * 这正是 accel-plan.js 注释反复警告的「分布外」，也是出片质量差的主因。
   * 实测佐证：历史请求 _baseline-request.json / _final.json / _e2e-seg1.json
   * 全部是 `启用LoRA=False, LoRA1=未选择, 采样器=lcm`。
   *
   * ⚠️ 南风 V15 的 LoRA 是**独立槽位**语义（h3_generator.py:1438-1439
   *    `individual_lora_slots=True, strict_lora_opt_in=True`）：
   *      · `启用LoRA` 总开关**无效**（:2063 的早退只对 individual=False 生效）
   *      · 真正生效的是 `LoRA{n}启用` + `LoRA{n}` + `LoRA{n}强度`
   *    所以必须同时写 `启用LoRA`（语义一致，便于排查）和 `LoRA1启用=true`（真正生效）。
   *
   * 优先级与 runH3Local 一致：job 显式 > 镜头卡 > 配置默认 > 内置默认。
   */
  const accelId = job.params?.accelPlan
    ?? shot.accelPlan
    ?? cfg.accelPlan
    ?? DEFAULT_ACCEL_PLAN;
  const accel = planForShot(accelId);

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
   * 把加速方案翻译成南风参数覆盖。
   *
   * 注意 `shiftVideo/shiftAudio` **没有对应参数** —— 南风 V15 的
   * `视频西格玛偏移` / `音频西格玛偏移` 全部挂在 `sigma_requested` 恒 False
   * 的分支下（h3_generator.py:1687/1706），改了没反应。
   * 这是上游限制，不是本插件能修的；在这里记录一条警告让用户知道。
   */
  function accelOverrides() {
    const out = {};
    if (accel.lora) {
      out['启用LoRA'] = true;
      out['LoRA1'] = accel.lora;
      out['LoRA1启用'] = true;
      // 蒸馏学生在 strength=1.0 是满血；降下来会让低步数去噪不足
      out['LoRA1强度'] = 1.0;
    } else {
      // none 方案：显式关闭，避免沿用镜头上残留的 LoRA
      out['启用LoRA'] = false;
      out['LoRA1'] = '未选择';
      out['LoRA1启用'] = false;
    }
    out['采样器'] = accel.sampler;
    out['调度器'] = accel.scheduler;
    out['采样步数'] = steps;
    return out;
  }

  const accelParams = accelOverrides();

  // shift 无法设置时明确告知（不静默）
  if (accel.needShiftNode) {
    job.warnings = [...(job.warnings ?? []), 
      `加速方案 ${accel.plan.label} 要求 shift ${accel.shiftVideo}/${accel.shiftAudio}，`
      + '但南风 V15 的 SigmaShift 分支被上游硬编码关闭，实际会用模型自带的 12/3。'
      + 'LoRA 本身仍然生效；这是已知上游限制。',
    ];
  }

  job.params = {
    ...(job.params ?? {}),
    accelPlan: accel.plan.id,
    accelLabel: accel.plan.label,
    accelFamily: accel.plan.family,
    sampler: accel.sampler,
    scheduler: accel.scheduler,
    steps,
    lora: accel.lora || null,
    // 记录"shift 设不了"这个事实，前端可据此提示
    shiftApplied: false,
  };

  // ---------- 2) 解析参考素材并 stage ----------
  const refList = resolveRefImages(shot, cfg);
  const previz = resolvePrevizArtifacts(shot, cfg);

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

  // ---------- 2) 把 staged 的文件名回填进镜头卡副本 ----------
  //
  // stagedMap: 占位符 key → ComfyUI input 内的文件名
  // 我们要把它翻译成南风的「图片N / 视频N / 音频N」
  const stagedImages = refList.map((r) => staged[r.key]).filter(Boolean);
  const stagedVideos = videoEntries.map((v) => staged[v.key]).filter(Boolean);
  const stagedAudios = audioEntries.map((a) => staged[a.key]).filter(Boolean);

  /**
   * 首尾帧在**南风路径**上的接线。
   *
   * ⚠️ 这是一个必须单独处理的坑：
   *    南风节点 `NanFengH3MultiReferenceGeneratorV15` **没有** first_frame /
   *    last_frame 输入口 —— 它的首尾帧就是 `图片1` 和 `图片2` 本身。
   *    见 vendor/nanfeng/h3_generator.py:1378-1381 的硬校验：
   *      图生视频：image_count 必须 == 1
   *      首尾帧  ：image_count 必须 == 2（图片1=首帧，图片2=尾帧）
   *
   *    旧实现从 runH3Local 复制而来，把 previz 首尾帧 stage 进了
   *    `{{FIRST_FRAME}}` / `{{LAST_FRAME}}` 两个占位符，但**没有任何消费者**
   *    （那套消费逻辑只在 runH3Local 里）。结果是：
   *      · 文件白传一趟 ComfyUI input
   *      · 图片1/图片2 被角色卡/参考图占满
   *      · 南风报"图生视频模式必须上传1张图片"或"首尾帧模式必须上传2张图片"
   *
   *    正确做法：按 mode 把 staged 的首尾帧直接塞进 图片1 / 图片2，
   *    并且**参考图不得占用这两个槽位**。
   */
  function frameSlotOverrides(m) {
    const first = staged['{{FIRST_FRAME}}'] ?? '';
    const last = staged['{{LAST_FRAME}}'] ?? '';
    const out = {};
    if (m === 'i2va') {
      if (first) out['图片1'] = first;
    } else if (m === 'fl2va') {
      if (first) out['图片1'] = first;
      if (last) out['图片2'] = last;
    }
    return out;
  }

  const shotForNanfeng = {
    ...shot,
    // 用 staged 文件名覆盖原始 rel 路径
    refs: {
      ...(shot.refs ?? {}),
      images: stagedImages,
      videos: stagedVideos.map((n) => ({ rel: n })),
      audios: stagedAudios.map((n) => ({ rel: n })),
    },
  };

  // ---------- 3) 组装 workflow ----------
  //
  // 能力探测：先问 ComfyUI 实际注册了哪些节点，再据此关闭缺依赖的加速项。
  // 没有这一步时，用户勾上「启用H3 SLA」会在 GraphBuilder 展开阶段抛
  // "node H3SLAAttention not found"，整单失败且错误信息极难懂。
  // 探测失败（ComfyUI 不可达）时返回 null，退回纯静态修正。
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
      ...(prompt ? { 提示词: injectCardDefinitions(prompt, refList, shot) } : {}),
      // 首尾帧占用 图片1/图片2，优先级最高（必须在参考图槽位之后合并）
      ...frameSlotOverrides(mode ?? shot.mode),
      /**
       * ⚠️ 加速方案必须放在**最后**。
       *
       * buildShotWorkflow 的 extraParams 是最高优先级层，而预设里写着
       * `采样器: lcm` —— 如果加速方案先合并，就会被预设覆盖回 lcm + 步数错配。
       * LoRA 槽位同理：镜头上可能残留旧值。
       */
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
  // ⚠️ 归档目录必须给真实路径。传 null 时 comfy.runWorkflow 里的
  //    `fs.mkdirSync(outputsDir)` 会抛
  //    "The \"path\" argument must be of type string or ... Received null"
  //    —— 视频其实已经生成好了，但归档阶段崩溃，整单被标记 failed。
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
 * 只保留「非默认值」的参数，避免把 217 个字段全塞进 job.params。
 *
 * @param {Record<string, unknown>} params
 * @returns {Record<string, unknown>}
 */
function summariseParams(params) {
  const schema = params; // 已是完整快照
  const out = {};
  // 动态导入太啰嗦，这里直接内联几个关键项 + 所有非空素材
  for (const key of [
    '百万像素', '采样步数', '采样器', '调度器', '降噪强度',
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
