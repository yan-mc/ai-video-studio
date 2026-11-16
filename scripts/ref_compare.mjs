/**
 * 参考图 + 提示词 对照测试（纯图+文，无视频参考）
 *
 * 同一个 prompt（原封不动，逐字节读取 promote.txt）、同一组参考图、
 * 同 seed / 同分辨率，只换加速方案：
 *
 *   R-LX   LightX2V turbo 4step + euler  （现状）
 *   R-LX2  LightX2V turbo 4step + lcm    （上一轮测出更锐的组合）
 *   R-D8   DMAD 8step_full_critic + lcm
 *   R-D4   DMAD 4step_full_critic + lcm
 *
 * 走 Ref2VA（MiniMaxH3ReferenceToVideo），两张参考图都以 <Picture 1>/<Picture 2> 进入。
 * prompt 里只引用了 <Picture 1>，这是原 prompt 的写法 —— 不改。
 */
import fs from 'node:fs';

const COMFY = 'http://127.0.0.1:8488';
const PROMPT_FILE = 'F:/AI视频/临时/promote.txt';

const UNET_REF = 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors';
const CLIP = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
const VAE = 'minimax_h3_video_vae_fp16.safetensors';
const AUDIO_VAE = 'minimax_h3_audio_vae_fp32.safetensors';

// 原封不动读入（去掉首尾空行之外全部保留）
const PROMPT = fs.readFileSync(PROMPT_FILE, 'utf8').replace(/^\uFEFF/, '').trim();

const W = 864;
const H = 480;
const LEN = 124;
const SEED = 1101;

const LX = 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors';
const D8 = 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors';
const D4 = 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors';

const VARIANTS = [
  { key: 'R1-lx-euler', lora: LX, sampler: 'euler', steps: 4, shiftV: null, shiftA: null },
  { key: 'R2-lx-lcm', lora: LX, sampler: 'lcm', steps: 4, shiftV: null, shiftA: null },
  { key: 'R3-dmad8', lora: D8, sampler: 'lcm', steps: 8, shiftV: 12, shiftA: 2 },
  { key: 'R4-dmad4', lora: D4, sampler: 'lcm', steps: 4, shiftV: 12, shiftA: 2 },
];

function build(v) {
  const g = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: UNET_REF, weight_dtype: 'default' } },
    '4': { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: v.lora, strength_model: 1.0 } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: 'minimax', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: VAE } },
    '15': { class_type: 'VAELoader', inputs: { vae_name: AUDIO_VAE } },
    '5': { class_type: 'RandomNoise', inputs: { noise_seed: SEED } },
    '6': { class_type: 'KSamplerSelect', inputs: { sampler_name: v.sampler } },
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '21': { class_type: 'LoadImage', inputs: { image: 'kanade_back.png' } },
    '9': {
      class_type: 'MiniMaxH3ReferenceToVideo',
      inputs: {
        clip: ['2', 0],
        vae: ['3', 0],
        audio_vae: ['15', 0],
        prompt: PROMPT,
        width: W, height: H, length: LEN,
        ref_image_size: 'match',
        ref_images: { ref_image_1: ['20', 0], ref_image_2: ['21', 0] },
      },
    },
    '8': { class_type: 'BasicGuider', inputs: { model: null, conditioning: ['9', 0] } },
    '11': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['5', 0], guider: ['8', 0], sampler: ['6', 0], sigmas: ['7', 0], latent_image: ['9', 1] } },
    '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    '16': { class_type: 'VAEDecodeAudio', inputs: { samples: ['11', 0], vae: ['15', 0] } },
    '13': { class_type: 'CreateVideo', inputs: { images: ['12', 0], audio: ['16', 0], fps: 24 } },
    '14': { class_type: 'SaveVideo', inputs: { video: ['13', 0], filename_prefix: `refcmp/${v.key}`, format: 'mp4', codec: 'h264' } },
  };
  let modelRef = ['4', 0];
  if (v.shiftV != null) {
    g['103'] = { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['4', 0], shift_video: v.shiftV, shift_audio: v.shiftA } };
    modelRef = ['103', 0];
  }
  g['8'].inputs.model = modelRef;
  g['7'] = { class_type: 'BasicScheduler', inputs: { model: modelRef, scheduler: 'simple', steps: v.steps, denoise: 1.0 } };
  return g;
}

async function submit(v) {
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: build(v), client_id: `refcmp-${v.key}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 700));
  return j.prompt_id;
}

async function waitDone(id, ms = 40 * 60 * 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const h = await (await fetch(`${COMFY}/history/${id}`)).json();
    if (h[id]) return h[id];
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

const only = process.env.ONLY;
console.log('prompt chars:', PROMPT.length);
console.log('prompt first line:', PROMPT.split('\n')[0].slice(0, 80));

for (const v of VARIANTS) {
  if (only && !v.key.includes(only)) continue;
  console.log(`\n=== ${v.key} :: ${v.lora.includes('dmad') ? 'DMAD' : 'LightX2V'} / ${v.sampler} / ${v.steps}步 ===`);
  const t0 = Date.now();
  try {
    const id = await submit(v);
    const h = await waitDone(id);
    if (!h) { console.log('  TIMEOUT'); continue; }
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    const files = [];
    for (const o of Object.values(h.outputs ?? {})) {
      for (const f of (o.gifs ?? o.videos ?? o.images ?? [])) files.push(f.filename);
    }
    console.log(`  ${h.status?.status_str}  ${sec}s  ${files.join(',')}`);
  } catch (e) {
    console.log('  ERR', e.message);
  }
}
