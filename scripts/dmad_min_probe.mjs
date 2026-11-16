// 只提交一个最小工作流，打印完整错误
const COMFY = 'http://127.0.0.1:8488';

const UNET = 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors';
const CLIP = 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors';
const VAE = 'minimax_h3_video_vae_fp16.safetensors';
const AUDIO_VAE = 'minimax_h3_audio_vae_fp32.safetensors';

const PROMPT = 'integrated_multimodal_description: A quiet beach at sunset.\n\noverall_soundscape: Waves.\n\nnon_diegetic_music: N/A';

const g = {
  1: { class_type: 'UNETLoader', inputs: { unet_name: UNET, weight_dtype: 'default' } },
  2: { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: 'minimax', device: 'default' } },
  3: { class_type: 'VAELoader', inputs: { vae_name: VAE } },
  15: { class_type: 'VAELoader', inputs: { vae_name: AUDIO_VAE } },
  5: { class_type: 'RandomNoise', inputs: { noise_seed: 1 } },
  6: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
  9: {
    class_type: 'MiniMaxH3ImageToVideo',
    inputs: { clip: [2, 0], vae: [3, 0], prompt: PROMPT, width: 864, height: 480, length: 124 },
  },
  8: { class_type: 'BasicGuider', inputs: { model: [1, 0], conditioning: [9, 0] } },
  7: { class_type: 'BasicScheduler', inputs: { model: [1, 0], scheduler: 'simple', steps: 4, denoise: 1.0 } },
  11: {
    class_type: 'SamplerCustomAdvanced',
    inputs: { noise: [5, 0], guider: [8, 0], sampler: [6, 0], sigmas: [7, 0], latent_image: [9, 1] },
  },
  12: { class_type: 'VAEDecode', inputs: { samples: [11, 0], vae: [3, 0] } },
  13: { class_type: 'CreateVideo', inputs: { images: [12, 0], fps: 24 } },
  14: { class_type: 'SaveVideo', inputs: { video: [13, 0], filename_prefix: 'dmad_test/min', format: 'mp4' } },
};

const r = await fetch(`${COMFY}/prompt`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: g, client_id: 'minimal' }),
});
console.log('status', r.status);
console.log(JSON.stringify(await r.json(), null, 2));
