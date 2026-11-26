/**
 * 局部重绘的执行与元信息 —— 提交、轮询、产物取回、meta 回报。
 *
 * meta 必须回报**实际生效值**（羽化 blur、grow、steps、采样画布），
 * 而不是基准常量：按基准常量反推"这次接缝为什么硬"必然得出错误结论。
 * 真实值来自 `buildInpaintWorkflow` 的 `applied` 旁路字段。
 *
 * @module services/inpaint-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import * as comfy from './comfy-client.js';
import {
  IMAGE_PROMPT_MAX_CHARS, IMAGE_MAX_LORAS, checkImageModels, effectiveMaxMP, effectiveImageSteps,
} from './h3-image.js';
import {
  INPAINT_DENOISE, INPAINT_STRENGTHS, INPAINT_RESOLUTION_PRESETS, INPAINT_AUTO_SCALE,
  INPAINT_CROP_DEFAULTS, INPAINT_GROW, INPAINT_BLUR_BASE, INPAINT_BLUR_REF_RES,
  VENDOR_NODES, blurForResolution,
} from './inpaint-params.js';
import { buildInpaintWorkflow } from './inpaint-graph.js';

/* ============================================================ 能力探测 */

const PROBE_TTL_MS = 60_000;
const PROBE_CACHE = { key: '', at: 0, value: null };

/**
 * 探测 crop&stitch 依赖的 vendor 节点是否可用。
 *
 * 必须在**提交前**探测，不能让错误到 ComfyUI 里才出现 ——
 * 那时的信息是 `Node 'JZImageCropByMaskAndResize' not found`，
 * 用户完全不知道要去部署 vendor 包。
 *
 * 探测带 TTL 缓存：`inpaintMeta()` 在面板挂载与 Agent 查询时都会调，
 * 无缓存时每次都是 2 次 `/object_info` × 6s 超时，UI 打开就是十几秒白等。
 * 缓存**只缓存成功结果**；失败即时重试（否则 ComfyUI 刚起好时会被判死一分钟）。
 *
 * @returns {Promise<{ok:boolean, missing:string[], reason:string, cached?:boolean}>}
 */
export async function probeInpaintNodes(cfg = loadConfig(), opts = {}) {
  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : PROBE_TTL_MS;
  const force = opts.force === true;

  if (!force && PROBE_CACHE.value?.ok && Date.now() - PROBE_CACHE.at < ttl) {
    return { ...PROBE_CACHE.value, cached: true };
  }

  const missing = [];
  let reason = '';
  try {
    const base = await comfy.resolveComfyUrl(cfg);
    if (!base) return { ok: false, missing: Object.values(VENDOR_NODES), reason: 'ComfyUI 地址不可达' };

    for (const node of Object.values(VENDOR_NODES)) {
      try {
        const r = await fetch(`${base}/object_info/${node}`, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) { missing.push(node); continue; }
        const j = await r.json();
        if (!j?.[node]) missing.push(node);
      } catch {
        missing.push(node);
      }
    }
    if (missing.length) {
      reason = `缺少节点 ${missing.join(', ')}。`
        + '请执行 vendor/inpaint-nodes/deploy-vendor.ps1 部署后重启 ComfyUI。';
    }
    const value = { ok: missing.length === 0, missing, reason };
    if (value.ok) { PROBE_CACHE.value = value; PROBE_CACHE.at = Date.now(); }
    return value;
  } catch (e) {
    const value = { ok: false, missing: Object.values(VENDOR_NODES), reason: String(e?.message ?? e) };
    PROBE_CACHE.value = null;
    PROBE_CACHE.at = 0;
    return value;
  }
}

/** 清探测缓存（部署 vendor 节点后 / 配置变更后调用） */
export function resetInpaintProbeCache() {
  PROBE_CACHE.value = null;
  PROBE_CACHE.at = 0;
}

/* ============================================================ tmp-inline 回收 */

/**
 * `tmp-inline` 里落盘的临时图存活时长。
 *
 * mask 从前端是 dataURL 传上来的，`ref-images.js` 会把它落盘到
 * `data/tmp-inline/<hash>.<ext>`。这个目录以前**只进不出** ——
 * 素材库的 orphan 扫描只看 `assets/`，于是每涂一次就永久多一张 PNG。
 * 同名同内容会命中 hash 复用，所以按 mtime 过期回收是安全的。
 */
const TMP_INLINE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 回收 `tmp-inline` 的临时图。
 *
 * 只删两类：本次任务自己落盘那份（已进 ComfyUI input，本地副本无用）、
 * 以及早于 TTL 的残留（崩溃/取消留下的）。
 *
 * @param {object} cfg
 * @param {{keepAbs?:string|null, ttlMs?:number}} [opts]
 * @returns {{removed:number, bytes:number}}
 */
export function cleanTmpInline(cfg = loadConfig(), opts = {}) {
  const dir = path.join(cfg.dataDir, 'tmp-inline');
  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : TMP_INLINE_TTL_MS;
  const keepAbs = opts.keepAbs ? path.resolve(opts.keepAbs) : '';
  let removed = 0;
  let bytes = 0;
  let names = [];
  try {
    if (!fs.existsSync(dir)) return { removed, bytes };
    names = fs.readdirSync(dir);
  } catch { return { removed, bytes }; }

  const now = Date.now();
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      const mine = keepAbs && path.resolve(full) === keepAbs;
      if (!mine && now - st.mtimeMs < ttl) continue;
      fs.unlinkSync(full);
      removed += 1;
      bytes += st.size;
    } catch { /* 单个文件失败不影响其余 */ }
  }
  return { removed, bytes };
}

/* ============================================================ 执行 */

/**
 * 执行一次局部重绘。
 *
 * @param {object} o
 * @param {object} o.baseWorkflow
 * @param {object} o.job
 * @param {object} o.req              validateInpaintRequest 的结果
 * @param {string} o.sourceAbs        源图绝对路径
 * @param {string} o.maskAbs          mask 绝对路径
 * @param {object} [o.cfg]
 * @param {Function} [o.onSubmitted]
 * @param {Function} [o.onProgress]
 */
export async function runH3Inpaint({
  baseWorkflow, job, req, sourceAbs, maskAbs,
  cfg = loadConfig(), onSubmitted, onProgress,
}) {
  if (!baseWorkflow) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');

  const models = checkImageModels(cfg);
  if (!models.ready) throw new Error(`IMAGE_MODEL_MISSING: 缺少 ${models.missing.join(', ')}`);

  if (!sourceAbs || !fs.existsSync(sourceAbs)) {
    const e = new Error(`SOURCE_NOT_FOUND: 源图不存在 ${sourceAbs || '(空)'}`);
    e.code = 'SOURCE_NOT_FOUND';
    throw e;
  }
  if (!maskAbs || !fs.existsSync(maskAbs)) {
    const e = new Error(`MASK_NOT_FOUND: mask 不存在 ${maskAbs || '(空)'}`);
    e.code = 'MASK_NOT_FOUND';
    throw e;
  }

  // crop 模式必须先确认 vendor 节点在位（full 模式不需要）
  if (req.mode === 'crop') {
    const probe = await probeInpaintNodes(cfg);
    if (!probe.ok) {
      const e = new Error(`INPAINT_NODES_MISSING: ${probe.reason}`);
      e.code = 'INPAINT_NODES_MISSING';
      e.detail = { missing: probe.missing };
      throw e;
    }
  }

  // staging（源图 + mask 一起送，共用一套文件名哈希防中文名塌缩）
  const staged = await comfy.stageToComfyInput(
    cfg, { '{{INPAINT_SRC}}': sourceAbs, '{{INPAINT_MASK}}': maskAbs }, job.id,
  );
  const sourceName = staged['{{INPAINT_SRC}}'];
  const maskName = staged['{{INPAINT_MASK}}'];
  if (!sourceName || !maskName) {
    throw new Error(`IMAGE_STAGE_INCOMPLETE: 源图=${sourceName || '失败'} mask=${maskName || '失败'}`);
  }

  // 图已经进 ComfyUI 了，落盘的临时 mask 可以回收（含超期残留）。
  // 失败不影响出图 —— 这只是磁盘卫生。
  try { cleanTmpInline(cfg, { keepAbs: maskAbs }); } catch { /* 清理失败不阻断 */ }

  const { workflow: wf, applied } = await buildInpaintWorkflow({
    baseWorkflow, req, sourceName, maskName,
    unetName: models.unet, vaeName: models.vae, clipName: models.clip,
    cfg,
  });

  const outputsDir = path.join(cfg.dataDir, 'outputs');
  const result = await comfy.runWorkflow({
    cfg, workflow: wf, map: {}, job, outputsDir, onSubmitted, onProgress,
    progressHint: `局部重绘 · ${req.mode === 'crop' ? 'crop&stitch' : '全图'} · ${req.strength.label}`,
  });

  return {
    ...result,
    meta: {
      mode: req.mode,
      strength: req.strengthId,
      splitAt: req.strength.splitAt,
      denoise: applied.denoise,
      steps: applied.steps,
      seed: req.seed,
      loraCount: applied.loraCount,
      loraMode: applied.loraMode,
      loraStack: applied.loraStack,
      crop: req.mode === 'crop' ? req.crop : null,
      /** 以下四项是**实际提交给节点的值**，不是基准常量 */
      grow: applied.grow,
      blur: applied.blur,
      featherRes: applied.featherRes,
      sampleEdge: applied.sampleEdge,
      sampleCanvas: applied.sampleCanvas,
    },
  };
}

/* ============================================================ 元信息 */

/**
 * 元信息（供 `/image/inpaint/meta` 与 `studio_image action=meta` 用）。
 *
 * `blur` / `grow` 在这里是**基准值**（1024² 画布），实际生效值随分辨率变化；
 * 前端要显示"这次会用多少"请看 `blurForResolution` 的语义：按 cropDefaults.baseResolution 折算。
 * `cropAvailable` 来自带缓存的探测，面板刷新不再每次都等十几秒。
 */
export async function inpaintMeta(cfg = loadConfig()) {
  const probe = await probeInpaintNodes(cfg);
  const defaultBlur = blurForResolution(INPAINT_CROP_DEFAULTS.baseResolution);

  return {
    denoise: INPAINT_DENOISE,
    denoiseLocked: true,
    denoiseReason: 'PDD 只有 6 个预测头；denoise<1 会让 int(6/denoise) 错配网格，'
      + '实测 0.5 时只剩 3 个头工作，表现为"区域被抹平"。改动强弱请用 strength。',
    steps: effectiveImageSteps(cfg, { forInpaint: true }),
    stepsLocked: true,
    stepsReason: '与 denoise 同源：BasicScheduler 的步数决定 PDD 网格怎么被切，'
      + '6 步 = 每步用一个预测头 = 训练态。inpaint 忽略 cfg.imageSteps；'
      + `配置里的值（若改过）在局部重绘上不生效，仅影响普通出图。`,
    strengths: INPAINT_STRENGTHS,
    resolutions: INPAINT_RESOLUTION_PRESETS,
    autoScale: INPAINT_AUTO_SCALE,
    /** 「分辨率稀释」说明 —— 前端据此显示 hint（auto 按 bbox **长边**算，不是面积） */
    resolutionHint: 'crop 模式按 mask 外接框裁剪；bbox 远大于笔画本身时有效分辨率会被稀释。'
      + `auto 档按 bbox 长边 × ${INPAINT_AUTO_SCALE} 给分辨率，保证笔画不被缩小。`,
    /** 基准羽化（1024² 档）；实际生效值按采样分辨率缩放 */
    grow: INPAINT_GROW,
    blur: INPAINT_BLUR_BASE,
    blurRefRes: INPAINT_BLUR_REF_RES,
    blurForDefaultRes: defaultBlur,
    cropDefaults: INPAINT_CROP_DEFAULTS,
    /** 用 effectiveMaxMP(cfg) 而不是常量：常量只是**默认值**，不是对外声明值 */
    maxMP: effectiveMaxMP(cfg),
    maxLoras: IMAGE_MAX_LORAS,
    promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
    vendorNodes: VENDOR_NODES,
    cropAvailable: probe.ok,
    ...(probe.ok ? { probeCached: Boolean(probe.cached) } : { vendorHint: probe.reason }),
  };
}