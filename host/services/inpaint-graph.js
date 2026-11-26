/**
 * 局部重绘的节点图组装。
 *
 * 与普通出图的结构完全不同，所以各自组图：普通出图把
 * `MiniMaxH3ImageConditioning[1]` 的 zeros latent 直接喂采样器；局部重绘必须用
 * **VAEEncode(源图)** 的 latent 替换它，再挂 noise_mask 指明"哪块重绘、哪块保留"。
 * 两条分支（全图 / crop&stitch）结构不同，混在一个函数里会让"哪几个节点被改了"
 * 难以追踪，而这类错误表现为"出图了但重绘区域不对"，最难查。
 *
 * @module services/inpaint-graph
 */
import { loadConfig } from '../config.js';
import {
  probeBypassLora, bypassLoraFallbackWarning, effectiveImageSteps,
  IMAGE_LORA_STRENGTH_LIMIT,
} from './h3-image.js';
import {
  VENDOR_NODES, INPAINT_DENOISE, INPAINT_GROW, INPAINT_BLUR_REF_RES,
  featherFor, blurForResolution, cropSampleEdge, sampleCanvasFor,
} from './inpaint-params.js';

/**
 * 组装局部重绘的 workflow。
 *
 * 节点号（避开模板已有的 1..11）：20/21 LoadImage，30 VAEEncode，
 * 32 SetLatentNoiseMask，40..45 LoRA，50 ImageToMask，61 SplitSigmas，
 * 70 crop 节点（仅 crop），72 GrowMask，73 MaskToImage，74 ImageBlur，
 * 75 ImageToMask，80 uncrop 节点（仅 crop）。
 *
 * 返回值除节点图外还带 `applied` —— **实际生效的羽化/采样参数**。
 * meta 必须回这些值而不是基准常量，否则排障时按 meta 反推会得出错误结论。
 *
 * @param {object} o
 * @param {object} o.baseWorkflow
 * @param {object} o.req            validateInpaintRequest 的结果
 * @param {string} o.sourceName     staging 后的源图文件名
 * @param {string} o.maskName
 * @returns {Promise<{workflow:object, applied:object}>}
 */
export async function buildInpaintWorkflow({
  baseWorkflow, req, sourceName, maskName, unetName, vaeName, clipName, cfg = loadConfig(),
}) {
  const wf = structuredClone(baseWorkflow);

  // ComfyUI 会把非数字 key 当节点解析 → 模板里的 `_comment` 必须剔除，否则 500
  for (const k of Object.keys(wf)) {
    if (!/^\d+$/.test(k)) delete wf[k];
  }

  /**
   * 模型文件名必须**直接写进节点**，不能指望 `{{VAE_NAME}}` 占位符：
   * inpaint 这条链路走 `runWorkflow({ map: {} })`，占位符没人替换，
   * 提交到 ComfyUI 会报 `value_not_in_list: '{{VAE_NAME}}' not in [...]`。
   */
  const n1 = wf['1'];
  if (n1?.class_type === 'UNETLoader') n1.inputs.unet_name = unetName;
  const n2 = wf['2'];
  if (n2?.class_type === 'CLIPLoader') n2.inputs.clip_name = clipName;
  const n3 = wf['3'];
  if (n3?.class_type === 'VAELoader') n3.inputs.vae_name = vaeName;

  const isCrop = req.mode === 'crop';
  const cropRes = req.crop.baseResolution;
  const steps = effectiveImageSteps(cfg, { forInpaint: true });

  /* ---------------- 模型链 + LoRA ---------------- */
  let modelOut = ['1', 0];
  let loraMode = 'none';
  if (req.loras.length) {
    /**
     * LoRA 加载方式必须**探测后决定**，不能写死 bypass 节点：
     * `LoraLoaderBypassModelOnly` 属于 `comfy_extras/nodes_lora_debug.py`，
     * 老版本 ComfyUI 没有，缺节点时报的 `Node not found` 完全看不出是加载方式的问题。
     */
    const useBypass = await probeBypassLora(cfg);
    loraMode = useBypass ? 'bypass' : 'patch';
    const loraNodeType = useBypass ? 'LoraLoaderBypassModelOnly' : 'LoraLoaderModelOnly';
    let prev = modelOut;
    for (let i = 0; i < req.loras.length; i += 1) {
      const slot = String(40 + i);
      const strength = Number(req.loras[i].strength);
      /**
       * 不在这里做范围夹取：`solveImageLoraStack` 已经按分类范围 + ±2 兜底夹过了，
       * 再夹一次只会掩盖求解器的 bug（那正是"job.params 显示 5、实际跑 2"的来源）。
       * 组装期只做最后一道**报错式**断言。
       */
      if (!Number.isFinite(strength) || Math.abs(strength) > IMAGE_LORA_STRENGTH_LIMIT + 1e-6) {
        const e = new Error(
          `INPAINT_LORA_STRENGTH: LoRA「${req.loras[i].name}」强度 ${req.loras[i].strength} 非法。`
          + `必须先过 solveImageLoraStack（合法区间 ±${IMAGE_LORA_STRENGTH_LIMIT}）。`,
        );
        e.code = 'INPAINT_LORA_STRENGTH';
        throw e;
      }
      wf[slot] = {
        class_type: loraNodeType,
        inputs: { model: prev, lora_name: req.loras[i].name, strength_model: strength },
      };
      prev = [slot, 0];
    }
    modelOut = prev;

    if (!useBypass) {
      req.warnings = Array.isArray(req.warnings) ? req.warnings : [];
      req.warnings.push(bypassLoraFallbackWarning(req.loras.length));
    }
  }

  /* ---------------- 源图 + mask ---------------- */
  wf['20'] = { class_type: 'LoadImage', inputs: { image: sourceName } };
  wf['21'] = { class_type: 'LoadImage', inputs: { image: maskName } };
  wf['50'] = { class_type: 'ImageToMask', inputs: { image: ['21', 0], channel: 'red' } };

  /**
   * 羽化只按**blur**缩放，不按 grow 缩放：
   * GrowMask 作用在已经缩放到裁剪块分辨率的 mask 上，1 latent 格恒为 16px，
   * 所以 expand 是网格常数；而 blur 是像素空间的视觉宽度，必须按画布缩放
   * （否则 448² 档羽化带占画布 6.9%，贴边选区能看到一圈矩形过渡带）。
   *
   * 此外 blur 还要按**笔画宽度封顶**：固定半径对细线是灾难 —— 实测一条
   * 14869 px 的笔画在 radius=28 下膨胀到 131051 px、平均强度只剩 0.37，
   * 模型的 noise mask 近乎半透明，重绘结果几乎不可见。
   */
  const featherRes = isCrop ? cropRes : (req.sourceDims?.w ?? INPAINT_BLUR_REF_RES);
  const feather = featherFor(
    featherRes,
    isCrop ? { strokePixels: req.crop?.strokePixels, bbox: req.crop?.bbox } : null,
    isCrop ? (req.crop?.sampleCanvas ?? null) : null,
  );
  const blurOpts = { radius: feather.radius, sigma: feather.sigma };
  const growPx = INPAINT_GROW;

  let modelOutForScheduler = modelOut;
  let latFrom;
  let maskFrom;
  let condW;
  let condH;
  const applied = {
    mode: req.mode,
    steps,
    denoise: INPAINT_DENOISE,
    loraMode,
    featherRes,
    blur: blurOpts,
    /** 羽化是否被笔画宽度封顶（排障时要能看出"为什么半径这么小"） */
    feather: {
      baseRadius: blurForResolution(featherRes).radius,
      capBy: feather.capBy,
      strokeWidth: feather.strokeWidth == null ? null : Number(feather.strokeWidth.toFixed(1)),
    },
    grow: growPx,
    /** crop：采样画布长边与（估算的）实际画布；full：就是源图画布 */
    sampleEdge: null,
    sampleCanvas: null,
  };

  if (isCrop) {
    /* ---------- crop & stitch ---------- */
    wf['70'] = {
      class_type: VENDOR_NODES.crop,
      inputs: {
        image: ['20', 0],
        mask: ['50', 0],
        base_resolution: cropRes,
        padding: req.crop.padding,
        min_crop_resolution: req.crop.minCrop,
        max_crop_resolution: req.crop.maxCrop,
      },
    };
    // 羽化链路（全核心节点，不依赖 kornia / scipy）
    //
    // ⚠️ 这张羽化 mask（含 GrowMask 外扩）**只能用于采样**，不能用于贴回。
    //    它比用户选区大一圈，拿它当贴回权重会把生成内容渗到选区外
    //    （实测污染 7–23px 的矩形边缘，视觉上是一圈硬切边）。
    //    贴回用下面独立的 maskFrom（未外扩、未羽化）。
    wf['72'] = { class_type: 'GrowMask', inputs: { mask: ['70', 1], expand: growPx, tapered_corners: true } };
    wf['73'] = { class_type: 'MaskToImage', inputs: { mask: ['72', 0] } };
    wf['74'] = { class_type: 'ImageBlur', inputs: { image: ['73', 0], blur_radius: blurOpts.radius, sigma: blurOpts.sigma } };
    wf['75'] = { class_type: 'ImageToMask', inputs: { image: ['74', 0], channel: 'red' } };

    wf['30'] = { class_type: 'VAEEncode', inputs: { pixels: ['70', 0], vae: ['3', 0] } };
    wf['32'] = { class_type: 'SetLatentNoiseMask', inputs: { samples: ['30', 0], mask: ['75', 0] } };

    latFrom = ['32', 0];

    /**
     * 贴回权重：**用户原始选区**（crop 节点第 1 路输出），再叠加一层
     * **对称**软边（blur 半径取羽化的一半）。
     *
     * 为什么不能用 ['75',0]（外扩 16 + 羽化 22 那张）：它整体比用户选区大一圈，
     * 以它做权重会把生成内容渗到选区外 16–22px —— 视觉上是一圈矩形硬边。
     *
     * 为什么软边要对称：blur 的 50% 等值线落在原始边界上，向左向右各让
     * radius/2 过渡。这样边界居中柔化，向外溢出只有几个像素且是渐变，
     * 不会形成可见的接缝。
     */
    wf['76'] = { class_type: 'MaskToImage', inputs: { mask: ['70', 1] } };
    wf['77'] = {
      class_type: 'ImageBlur',
      inputs: {
        image: ['76', 0],
        blur_radius: Math.max(1, Math.round(blurOpts.radius / 2)),
        sigma: Math.max(0.1, Number((blurOpts.sigma / 2).toFixed(1))),
      },
    };
    wf['78'] = { class_type: 'ImageToMask', inputs: { image: ['77', 0], channel: 'red' } };
    maskFrom = ['78', 0];

    /**
     * 这里的 condW/condH **不控制采样尺寸**：inpaint 的
     * `SamplerCustomAdvanced.latent_image` 来自 SetLatentNoiseMask[0]（VAEEncode
     * 的真实图像 latent），conditioning 的 latent 输出（['4',1]）**没有任何消费者**。
     * 它只影响 `minimax_refs` 的参考缩放，而这里 images 是空的。
     * 真正决定采样尺寸的是裁剪节点的 `base_resolution`。
     */
    condW = cropRes;
    condH = cropRes;

    const sampleEdge = cropSampleEdge(cropRes, req.crop.maxCrop);
    applied.sampleEdge = sampleEdge;
    applied.sampleCanvas = sampleCanvasFor(req.crop.bbox ?? req.crop.sampleBlock ?? {}, sampleEdge);
  } else {
    /* ---------- 全图 latent 混合 ---------- */
    wf['30'] = { class_type: 'VAEEncode', inputs: { pixels: ['20', 0], vae: ['3', 0] } };
    wf['72'] = { class_type: 'GrowMask', inputs: { mask: ['50', 0], expand: growPx, tapered_corners: true } };
    wf['73'] = { class_type: 'MaskToImage', inputs: { mask: ['72', 0] } };
    wf['74'] = { class_type: 'ImageBlur', inputs: { image: ['73', 0], blur_radius: blurOpts.radius, sigma: blurOpts.sigma } };
    wf['75'] = { class_type: 'ImageToMask', inputs: { image: ['74', 0], channel: 'red' } };
    wf['32'] = { class_type: 'SetLatentNoiseMask', inputs: { samples: ['30', 0], mask: ['75', 0] } };

    latFrom = ['32', 0];
    maskFrom = ['75', 0];
    condW = 0;   // 0 = 沿用源图尺寸
    condH = 0;
    if (req.sourceDims) applied.sampleCanvas = { ...req.sourceDims };
  }

  /* ---------------- 条件 ---------------- */
  wf['4'] = {
    class_type: 'MiniMaxH3ImageConditioning',
    inputs: {
      clip: ['2', 0], prompt: req.prompt, width: condW, height: condH, vae: ['3', 0],
    },
  };

  /* ---------------- 采样 ---------------- */
  wf['5'] = { class_type: 'RandomNoise', inputs: { noise_seed: req.seed } };
  wf['6'] = { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } };
  wf['7'] = {
    class_type: 'BasicScheduler',
    inputs: {
      model: modelOutForScheduler, scheduler: 'simple', steps, denoise: INPAINT_DENOISE,
    },
  };

  // SplitSigmas：强度档（切点必须落在 6 头网格上，见 inpaint-params 文件头 ①）
  let sigmasFrom = ['7', 0];
  if (req.strength.splitAt > 0) {
    wf['61'] = { class_type: 'SplitSigmas', inputs: { sigmas: ['7', 0], step: req.strength.splitAt } };
    sigmasFrom = ['61', 1];   // [0]=high, [1]=low（我们用 low）
  }

  wf['8'] = { class_type: 'BasicGuider', inputs: { model: modelOutForScheduler, conditioning: ['4', 0] } };
  wf['9'] = {
    class_type: 'SamplerCustomAdvanced',
    inputs: {
      noise: ['5', 0], guider: ['8', 0], sampler: ['6', 0],
      sigmas: sigmasFrom, latent_image: latFrom,
    },
  };
  wf['10'] = { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['3', 0] } };

  /* ---------------- 输出 ---------------- */
  if (isCrop) {
    // 贴回：按 bbox 把重绘结果写回原图，权重是"原始选区 + 对称软边"（见 maskFrom）
    wf['80'] = {
      class_type: VENDOR_NODES.uncrop,
      inputs: { destination: ['20', 0], source: ['10', 0], mask: maskFrom, bbox: ['70', 2] },
    };
    wf['11'] = { class_type: 'SaveImage', inputs: { images: ['80', 0], filename_prefix: 'h3inpaint' } };
  } else {
    // full 模式没有 bbox：用同样的"原始选区 + 对称软边"整幅合成，
    // 选区外逐像素保留原图。
    wf['81'] = {
      class_type: 'MaskToImage', inputs: { mask: ['50', 0] },
    };
    wf['82'] = {
      class_type: 'ImageBlur',
      inputs: {
        image: ['81', 0],
        blur_radius: Math.max(1, Math.round(blurOpts.radius / 2)),
        sigma: Math.max(0.1, Number((blurOpts.sigma / 2).toFixed(1))),
      },
    };
    wf['83'] = { class_type: 'ImageToMask', inputs: { image: ['82', 0], channel: 'red' } };
    wf['84'] = {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['20', 0], source: ['10', 0], x: 0, y: 0, resize_source: false, mask: ['83', 0],
      },
    };
    wf['11'] = { class_type: 'SaveImage', inputs: { images: ['84', 0], filename_prefix: 'h3inpaint' } };
  }

  applied.loraStack = req.loras.map((l) => `${l.name}@${l.strength}`);
  applied.loraCount = req.loras.length;

  return { workflow: wf, applied };
}