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
  LORA_REF: 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors',
  LORA_FL2V: 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
  // Fun ControlNet Union 2.0（int8 剪枝版）。未安装时控制视频通道自动关闭，
  // 生成退回纯 Ref2VA（不报错、不影响其它功能）。
  // 实测：4.22 GB，12GB 显存可跑，单镜 +83% 耗时。
  CONTROL_PATCH: 'minimax_h3_fun_controlnet_union_2.0_pruned_int8_convrot.safetensors',
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

/** 控制视频默认参数（实测起始值，见 docs/probes/h3-controlnet-2026-11-14/REPORT.md） */
const CONTROL_DEFAULTS = Object.freeze({ strength: 1.0, startPercent: 0.0, endPercent: 0.8 });
const CONTROL_PATCH_NAME = MODEL_DEFAULTS.CONTROL_PATCH;

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
 * 解析镜头卡上的控制视频配置。
 *
 * 支持两处写法（后者优先）：
 *   1. `shot.control`  —— 新字段，结构化
 *   2. `shot.previz.controlVideoPath` —— 历史写法，只有路径
 *
 * 返回 null 表示不启用控制视频通道。**这是唯一判定入口**，
 * generator 里不要再各自判断一遍，避免"预览说有控制、实际没接"的漂移。
 */
export function resolveControl(shot) {
  const c = shot?.control;
  const legacyPath = shot?.previz?.controlVideoPath;
  const rel = (c && typeof c.videoRel === 'string' && c.videoRel) || legacyPath || '';
  if (!rel) return null;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const start = clamp01(num(c?.startPercent, CONTROL_DEFAULTS.startPercent));
  const end = clamp01(num(c?.endPercent, CONTROL_DEFAULTS.endPercent));
  return {
    videoRel: rel,
    // 实测：<1 时控制偏弱；画面发僵就往下调，漂移就往上调
    strength: Math.min(10, Math.max(0, num(c?.strength, CONTROL_DEFAULTS.strength))),
    startPercent: Math.min(start, end),
    endPercent: Math.max(start, end),
    // 仅用于展示/提示词，不参与引擎分派（Union 模型不区分类型）
    type: typeof c?.type === 'string' ? c.type : '',
  };
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
  const control = resolveControl(shot);
  // 控制视频路径 → 绝对路径（不存在就当没配，不炸整镜）
  const controlAbs = control
    ? (() => {
      try {
        const a = path.isAbsolute(control.videoRel)
          ? control.videoRel
          : safeJoin(cfg.dataDir, control.videoRel);
        return fs.existsSync(a) ? a : '';
      } catch { return ''; }
    })()
    : '';

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
    ...(control ? { '{{CONTROL_VIDEO}}': controlAbs } : {}),
    ...Object.fromEntries(videoEntries.map((v) => [v.key, v.abs])),
    ...Object.fromEntries(audioEntries.map((a) => [a.key, a.abs])),
  };
  const staged = await comfy.stageToComfyInput(cfg, toStage, job.id);

  const useRef = refList.length > 0
    || videoEntries.length > 0
    || audioEntries.length > 0;
  const useFirstLast = Boolean(staged['{{FIRST_FRAME}}'] || staged['{{LAST_FRAME}}']);   // 供日志/计划展示
  // 控制视频必须真的 stage 成功才接线；否则模板里的 60/61/62/63 会被下面的清理删掉
  const useControl = Boolean(control && staged['{{CONTROL_VIDEO}}']);

  // 模型名：优先用 ComfyUI 实际可用的文件（用户可能装的是 int8 而非 fp8）。
  // 拿不到列表（ComfyUI 不可达）时退回默认名，行为与旧实现一致。
  const available = await comfy.listModelFiles(cfg).catch(() => ({}));
  const NAMES = resolveModelNames(cfg, {
    UNET_REF: available.diffusion_models,
    UNET_FL2V: available.diffusion_models,
    CLIP: available.text_encoders,
    VAE: available.vae,
    AUDIO_VAE: available.vae,
    LORA_REF: available.loras,
    LORA_FL2V: available.loras,
    CONTROL_PATCH: available.model_patches,
  });
  // 控制模型缺失时不要撒谎说"已启用"——Quietly 关掉，让上层走纯 Ref2VA
  const controlPatchOk = !useControl
    || !available.model_patches?.length
    || available.model_patches.includes(NAMES.CONTROL_PATCH);

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
    '{{UNET_NAME}}': useRef ? NAMES.UNET_REF : NAMES.UNET_FL2V,
    '{{CLIP_NAME}}': NAMES.CLIP,
    '{{VAE_NAME}}': NAMES.VAE,
    '{{AUDIO_VAE_NAME}}': NAMES.AUDIO_VAE,
    '{{LORA_NAME}}': useRef ? NAMES.LORA_REF : NAMES.LORA_FL2V,
    '{{LORA_STRENGTH}}': Number(prof.steps) <= 8 ? 1.0 : 0.0,
    // 控制视频通道（Fun ControlNet Union）。未启用时这些占位符不会被引用，
    // 对应节点在下面被整体删除。
    '{{CONTROL_VIDEO}}': useControl ? staged['{{CONTROL_VIDEO}}'] : '',
    '{{CONTROL_PATCH_NAME}}': NAMES.CONTROL_PATCH,
    '{{CONTROL_STRENGTH}}': control?.strength ?? CONTROL_DEFAULTS.strength,
    '{{CONTROL_START}}': control?.startPercent ?? CONTROL_DEFAULTS.startPercent,
    '{{CONTROL_END}}': control?.endPercent ?? CONTROL_DEFAULTS.endPercent,
  };
  // 控制模型不在 ComfyUI 的列表里 → 关掉控制通道（否则工作流提交时报 Value not in list）
  if (!controlPatchOk) {
    job.params = { ...(job.params ?? {}), controlSkipped: `缺少控制模型 ${NAMES.CONTROL_PATCH}` };
  }

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
      // 首尾帧走 LoadImage 节点 20/21：节点必须**真的建出来并填上 staged 文件名**，
      // 只写 inputs.first_frame = ['20',0] 而模板里 20 还挂着 {{REF_IMAGE_1}}
      // 占位符（无对应 map 项）→ ComfyUI 拿到字面量 "{{REF_IMAGE_1}}" 直接报 Invalid file。
      if (staged['{{FIRST_FRAME}}']) {
        wfCopy['20'] = { class_type: 'LoadImage', inputs: { image: staged['{{FIRST_FRAME}}'] } };
        inputs.first_frame = ['20', 0];
      }
      if (staged['{{LAST_FRAME}}']) {
        wfCopy['21'] = { class_type: 'LoadImage', inputs: { image: staged['{{LAST_FRAME}}'] } };
        inputs.last_frame = ['21', 0];
      }
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

      // ---- 首尾帧（Ref2VA 分支）----
      //
      // ⚠️ Ref2VA 节点**没有** first_frame / last_frame 输入口 —— 那两个只属于
      //    MiniMaxH3ImageToVideo（FL2VA 分支）。所以有参考图时想锚首尾帧，
      //    唯一正确的通道是 MiniMaxH3AddGuide：它在任意帧上锚一张图。
      //
      // ⚠️ 实测（见 docs/probes/h3-controlnet-2026-11-14/）：AddGuide 的锚定
      //    强度非常高——锚白模首帧，整段输出都会是白模。所以首尾帧应当是
      //    **成片风格**的图（例如 H3-Image 白模转成片后的产物），不要直接塞白模。
      //
      // ⚠️ 引导图**不能**复用 20/21 槽位：那两个已经被参考图占用（ref_image_1/2），
      //    复用会互相覆盖，表现为"参考图或首帧其中一张莫名消失"。这里用 70/71。
      //
      // ⚠️ AddGuide 节点的编号必须从 **80** 起，不能从 70：
      //    70/71 是 LoadImage 的槽位，若 AddGuide 也从 70 开始编号，
      //    会**覆盖掉刚建好的 LoadImage** —— ComfyUI 报
      //    "image, received_type(CONDITIONING)"（把 conditioning 当图用了）。
      let guideNode = 80;
      let prevGuideId = null;
      const addGuide = (imageId, frameIdx) => {
        const id = String(guideNode++);
        wfCopy[id] = {
          class_type: 'MiniMaxH3AddGuide',
          inputs: {
            positive: [prevGuideId ?? '9', 0],
            latent: ['9', 1],
            vae: ['3', 0],
            frame_idx: frameIdx,
            image: [imageId, 0],
          },
        };
        prevGuideId = id;
        return id;
      };

      if (staged['{{FIRST_FRAME}}']) {
        wfCopy['70'] = { class_type: 'LoadImage', inputs: { image: staged['{{FIRST_FRAME}}'] } };
        addGuide('70', 0);
      }
      if (staged['{{LAST_FRAME}}']) {
        wfCopy['71'] = { class_type: 'LoadImage', inputs: { image: staged['{{LAST_FRAME}}'] } };
        addGuide('71', -1);   // 负值 = 从末尾数，正好是最后一帧
      }
      if (prevGuideId) {
        // 引导链末端才是最终 conditioning
        wfCopy['8'] = { ...wfCopy['8'], inputs: { ...wfCopy['8'].inputs, conditioning: [prevGuideId, 0] } };
      }
    }
  }

  // 多余的 LoadImage 节点必须删掉（未接线会报错）
  //
  // ⚠️ 模板里的 20/21 挂着 {{REF_IMAGE_1}} / {{REF_IMAGE_2}} 占位符，而 map 里
  //    并没有这两个 key —— 未被 ref_images 复用时必须删掉，否则 ComfyUI 收到
  //    字面量 "{{REF_IMAGE_1}}" 会报 Invalid file。
  //    FL2VA 分支已经在上面重建过 20/21（填的是真实 staged 文件名），所以
  //    这里只按「是否被 ref_images 使用」判断，不再给首尾帧开后门。
  const usedLoadImages = new Set(names.map((_, i) => String(20 + i)));
  for (let i = 0; i < 9; i++) {
    const id = String(20 + i);
    if (!usedLoadImages.has(id)) delete wfCopy[id];
  }

  // ---- 控制视频通道 ----
  //
  // 模板里带 60/61/62/63 四个节点（LoadVideo / GetVideoComponents /
  // ModelPatchLoader / FunControlNetApply）。未启用控制视频时**必须整组删掉**，
  // 否则 ComfyUI 会因为「未接线的 LoadVideo 引用了空文件名」直接报错。
  //
  // 启用时还要把 BasicScheduler(7) 和 BasicGuider(8) 的 model 从 4 改指向 63
  // —— 控制分支必须包在采样链路**上游**才生效，仅挂一个孤立节点是没有用的。
  if (useControl && controlPatchOk) {
    wfCopy['7'] = { ...wfCopy['7'], inputs: { ...wfCopy['7'].inputs, model: ['63', 0] } };
    wfCopy['8'] = { ...wfCopy['8'], inputs: { ...wfCopy['8'].inputs, model: ['63', 0] } };
  } else {
    // 未启用、或控制模型不在 ComfyUI 列表里 → 整组删掉
    for (const id of ['60', '61', '62', '63']) delete wfCopy[id];
  }

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