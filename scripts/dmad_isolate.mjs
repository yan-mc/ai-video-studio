/**
 * 隔离实验：到底是「lcm 采样器」还是「DMAD LoRA」让画质下降？
 *
 * 四组，全部用同一个 fp8_scaled UNET / 同 seed / 同提示词 / 124 帧：
 *   D1  LightX2V LoRA + euler + 4步      （基线，已跑过 = A）
 *   D2  LightX2V LoRA + lcm   + 4步      ← 只换采样器
 *   D3  DMAD LoRA     + euler + 4步      ← 只换 LoRA
 *   D4  DMAD LoRA     + lcm   + 4步      （= C，已跑过）
 *
 * 这样能判断：画质差是 lcm 的锅，还是 DMAD LoRA 的锅。
 */
import fs from 'node:fs';

const COMFY = process.env.COMFY || 'http://127.0.0.1:8488';

const UNET = 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors';
const CLIP = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
const VAE = 'minimax_h3_video_vae_fp16.safetensors';
const AUDIO_VAE = 'minimax_h3_audio_vae_fp32.safetensors';

const PROMPT = [
  'integrated_multimodal_description: 90s OVA animation style, cel animation look, high saturation colors, hard shadows, film grain texture.',
  'Evening beach. A young woman with blonde hair and a black top hat, wearing a black gothic dress, walks slowly along the shoreline from left to right, then turns her head toward the camera and smiles. Low golden sunlight behind her, soft rim light on her hair, fine glitter on the water, sea breeze moving her hair.',
  '',
  'overall_soundscape: Gentle waves lapping the shore, distant seagulls, soft wind across the sand.',
  '',
  'non_diegetic_music: A quiet, warm piano melody.',
].join('\n');

const W = 864;
const H = 480;
const LEN = 124;
const SEED = 1101;

const LX = 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors';
const DM = 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors';

const VARIANTS = [
  { key: 'D2-lx-lcm', lora: LX, sampler: 'lcm', steps: 4, shiftV: null, shiftA: null },
  { key: 'D3-dmad-euler', lora: DM, sampler: 'euler', steps: 4, shiftV: 12, shiftA: 2 },
];

function build(v) {
  const g = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: UNET, weight_dtype: 'default' } },
    '4': { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: v.lora, strength_model: 1.0 } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: 'minimax', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: VAE } },
    '15': { class_type: 'VAELoader', inputs: { vae_name: AUDIO_VAE } },
    '5': { class_type: 'RandomNoise', inputs: { noise_seed: SEED } },
    '6': { class_type: 'KSamplerSelect', inputs: { sampler_name: v.sampler } },
    '9': { class_type: 'MiniMaxH3ImageToVideo', inputs: { clip: ['2', 0], vae: ['3', 0], prompt: PROMPT, width: W, height: H, length: LEN } },
    '8': { class_type: 'BasicGuider', inputs: { model: null, conditioning: ['9', 0] } },
    '11': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['5', 0], guider: ['8', 0], sampler: ['6', 0], sigmas: ['7', 0], latent_image: ['9', 1] } },
    '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    '16': { class_type: 'VAEDecodeAudio', inputs: { samples: ['11', 0], vae: ['15', 0] } },
    '13': { class_type: 'CreateVideo', inputs: { images: ['12', 0], audio: ['16', 0], fps: 24 } },
    '14': { class_type: 'SaveVideo', inputs: { video: ['13', 0], filename_prefix: `dmad_test/${v.key}`, format: 'mp4', codec: 'h264' } },
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
    body: JSON.stringify({ prompt: build(v), client_id: `iso-${v.key}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 400));
  return j.prompt_id;
}

async function waitDone(id, ms = 20 * 60 * 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const h = await (await fetch(`${COMFY}/history/${id}`)).json();
    if (h[id]) return h[id];
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

for (const v of VARIANTS) {
  console.log(`\n=== ${v.key} :: lora=${v.lora.split('_')[1]} sampler=${v.sampler} ===`);
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
