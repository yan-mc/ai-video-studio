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
  INPAINT_GRADED_STITCH_THRESHOLD,
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

  /**
   * 分级重绘（mask 灰度 = 逐区域去噪强度）。
   *
   * 关键差别只有一处：**跳过 GrowMask**。
   *
   * GrowMask 是 `scipy.ndimage.grey_dilation` 迭代 `expand` 次（见 ComfyUI
   * `comfy_extras/nodes_mask.py`）—— 对二值 mask 是"外扩 16px"，对分级 mask
   * 是"在 33×33 窗口内逐像素取最大值"，也就是**把强档向外吞并、并在档位交界
   * 处改写值域**，分级信息直接失效。所以分级模式不挂它。
   *
   * 那"边界过渡"怎么办？`ImageBlur` 本身就只影响边界：对分段常值场做高斯
   * 模糊时，**远离任何边界的内部像素值原样保留**，只有边界两侧会过渡。
   * 这正是"羽化只作用于边界"要的效果，不需要额外节点。
   *
   * 贴回（stitch）权重则必须**二值化**：uncrop / ImageCompositeMasked 做的是
   * `out = dest*(1-m) + src*m`，若把 0.55 的灰度直接当权重，生成内容会被
   * 原图再混掉 45% —— 强度被算两次（一次在模型里，一次在贴回里）。
   * 所以先用 ThresholdMask 把「选了 / 没选」分开，再叠对称软边。
   */
  const graded = req.graded === true;
  const gradedValue = graded ? Number(req.gradedLevel?.mask ?? 1) : null;

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
  /**
   * 分级模式下羽化再收一档。
   *
   * 二值 mask 的羽化带是"选区外圈的软过渡"，宽一点没关系（外面本来就是 0）。
   * 但分级 mask 的边界可能在**两个档之间**（0.85 挨着 0.55）。宽羽化会把
   * 中间值糊出一大片 0.6–0.8 的过渡带，而那一段正是预测头交界、改动量
   * 不稳定的区间。所以分级模式把半径压到 1/3（仍能消除硬锯齿），
   * 让档位交界处尽量保持"两段常值 + 极窄过渡"。
   */
  const featherScale = graded ? 1 / 3 : 1;
  const blurOpts = {
    radius: Math.max(1, Math.min(31, Math.round(feather.radius * featherScale))),
    sigma: Math.max(0.1, Math.min(10.0, Number((feather.sigma * featherScale).toFixed(1)))),
  };
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
      gradedScale: featherScale,
    },
    /**
     * 分级状态 —— meta 必须**如实**回报。
     *   graded      是否走分级链路
     *   gradedLevel 实际生效档位（id 与 mask 值）
     *   skipGrow    采样 mask 是否跳过 GrowMask
     *   maskPath    采样用的 mask 链路（排障时最关键的一行）
     */
    graded,
    gradedLevel: graded ? { id: req.gradedLevel?.id ?? null, mask: gradedValue } : null,
    skipGrow: graded,
    maskPath: '',
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
    // ⚠️ 这张羽化 mask（分级模式下）或羽化 mask（含 GrowMask 外扩，非分级）
    //    **只能用于采样**，不能用于贴回。
    //    非分级时它比用户选区大一圈，拿它当贴回权重会把生成内容渗到选区外
    //    （实测污染 7–23px 的矩形边缘，视觉上是一圈硬切边）。
    //    贴回用下面独立的 maskFrom。
    if (graded) {
      // 分级：**不挂 GrowMask**（它会按 33×33 邻域取最大值，把档位交界抹平、
      // 把强档往外吞并 —— 见 buildInpaintWorkflow 顶部注释）。
      // ImageBlur 只改边界、内部值原样保留，正好是"羽化只做边界过渡"。
      wf['73'] = { class_type: 'MaskToImage', inputs: { mask: ['70', 1] } };
      wf['74'] = { class_type: 'ImageBlur', inputs: { image: ['73', 0], blur_radius: blurOpts.radius, sigma: blurOpts.sigma } };
      wf['75'] = { class_type: 'ImageToMask', inputs: { image: ['74', 0], channel: 'red' } };
      applied.maskPath = 'crop.mask → MaskToImage → ImageBlur(分级窄羽化) → ImageToMask'
        + '（跳过 GrowMask，灰度值原样进采样）';
    } else {
      wf['72'] = { class_type: 'GrowMask', inputs: { mask: ['70', 1], expand: growPx, tapered_corners: true } };
      wf['73'] = { class_type: 'MaskToImage', inputs: { mask: ['72', 0] } };
      wf['74'] = { class_type: 'ImageBlur', inputs: { image: ['73', 0], blur_radius: blurOpts.radius, sigma: blurOpts.sigma } };
      wf['75'] = { class_type: 'ImageToMask', inputs: { image: ['74', 0], channel: 'red' } };
      applied.maskPath = `crop.mask → GrowMask(+${growPx}) → MaskToImage → ImageBlur → ImageToMask`;
    }

    wf['30'] = { class_type: 'VAEEncode', inputs: { pixels: ['70', 0], vae: ['3', 0] } };
    wf['32'] = { class_type: 'SetLatentNoiseMask', inputs: { samples: ['30', 0], mask: ['75', 0] } };

    latFrom = ['32', 0];

    /**
     * 贴回权重：**用户原始选区**（crop 节点第 1 路输出），再叠加一层
     * **对称**软边（blur 半径取羽化的一半）。
     *
     * 为什么不能用 ['75',0]（采样那张）：分级时它带着 0.55/0.7/0.85 的灰度，
     * 拿它当贴回权重等于把强度**乘第二次**（模型里已经按 0.55 去过噪，
     * 贴回再混 45% 原图 → 实际只有 0.3 的效果）。
     * 非分级时它比用户选区大一圈，以它做权重会渗到选区外 16–22px。
     *
     * 所以贴回权重必须**先二值化**再羽化。分级链路多挂一个
     * ThresholdMask（阈值 0.02，只把"完全没选"的像素剔掉）；
     * **非分级链路的节点与原来一字不差**（crop 输出的 mask 本来就接近二值，
     * 多挂一个阈值节点只会改变边界几像素，没有收益却增加回退风险）。
     *
     * 为什么软边要对称：blur 的 50% 等值线落在原始边界上，向左向右各让
     * radius/2 过渡。这样边界居中柔化，向外溢出只有几个像素且是渐变，
     * 不会形成可见的接缝。
     */
    if (graded) {
      wf['71'] = {
        class_type: 'ThresholdMask',
        inputs: { mask: ['70', 1], value: INPAINT_GRADED_STITCH_THRESHOLD },
      };
      applied.stitchMask = `crop.mask → ThresholdMask(>${INPAINT_GRADED_STITCH_THRESHOLD})`
        + ' → 对称 ImageBlur(半径/2) → ImageToMask（二值化，避免强度被算两次）';
    } else {
      applied.stitchMask = 'crop.mask → 对称 ImageBlur(半径/2) → ImageToMask（原有链路，未改动）';
    }
    wf['76'] = { class_type: 'MaskToImage', inputs: { mask: graded ? ['71', 0] : ['70', 1] } };
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
    if (graded) {
      // 同 crop 分支：分级模式跳过 GrowMask，灰度原样进采样（羽化只做边界过渡）
      wf['73'] = { class_type: 'MaskToImage', inputs: { mask: ['50', 0] } };
      wf['74'] = { class_type: 'ImageBlur', inputs: { image: ['73', 0], blur_radius: blurOpts.radius, sigma: blurOpts.sigma } };
      wf['75'] = { class_type: 'ImageToMask', inputs: { image: ['74', 0], channel: 'red' } };
      applied.maskPath = 'mask → MaskToImage → ImageBlur(分级窄羽化) → ImageToMask'
        + '（跳过 GrowMask，灰度值原样进采样）';
    } else {
      wf['72'] = { class_type: 'GrowMask', inputs: { mask: ['50', 0], expand: growPx, tapered_corners: true } };
      wf['73'] = { class_type: 'MaskToImage', inputs: { mask: ['72', 0] } };
      wf['74'] = { class_type: 'ImageBlur', inputs: { image: ['73', 0], blur_radius: blurOpts.radius, sigma: blurOpts.sigma } };
      wf['75'] = { class_type: 'ImageToMask', inputs: { image: ['74', 0], channel: 'red' } };
      applied.maskPath = `mask → GrowMask(+${growPx}) → MaskToImage → ImageBlur → ImageToMask`;
    }
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
    /**
     * full 模式没有 bbox：用同样的"原始选区 + 对称软边"整幅合成，
     * 选区外逐像素保留原图。
     *
     * 合成权重同样必须二值化（分级时）：`ImageCompositeMasked` 做的是
     * `dest*(1-m) + src*m`，直接拿 0.55 的灰度当权重会把强度乘第二次。
     * 非分级链路保持原样（不挂阈值节点）。
     */
    if (graded) {
      wf['81'] = {
        class_type: 'ThresholdMask',
        inputs: { mask: ['50', 0], value: INPAINT_GRADED_STITCH_THRESHOLD },
      };
      wf['85'] = { class_type: 'MaskToImage', inputs: { mask: ['81', 0] } };
      applied.stitchMask = `mask → ThresholdMask(>${INPAINT_GRADED_STITCH_THRESHOLD})`
        + ' → 对称 ImageBlur(半径/2) → ImageToMask（二值化，避免强度被算两次）';
    } else {
      /**
       * ⚠️ 非分级**沿用节点号 81**（不是 85）：节点号也是可观测行为差异 ——
       * 排障时按旧文档/job 历史对节点号是常规做法，无谓改号会让
       * "为什么这次的 81 不见了"变成一个新问题。
       */
      wf['81'] = { class_type: 'MaskToImage', inputs: { mask: ['50', 0] } };
      applied.stitchMask = 'mask → 对称 ImageBlur(半径/2) → ImageToMask（原有链路，未改动）';
    }
    wf['82'] = {
      class_type: 'ImageBlur',
      inputs: {
        image: [graded ? '85' : '81', 0],
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