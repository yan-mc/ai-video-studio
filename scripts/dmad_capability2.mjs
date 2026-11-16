/**
 * DMAD 下的参考视频 / 参考音频 / 混合参考 能力验证。
 *
 * 这些是 H3 的 ref2va 能力，DMAD 只是 LoRA，理论上不该改变，
 * 但必须实测确认接线仍然合法。
 */
const COMFY = 'http://127.0.0.1:8488';
const UNET_REF = 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors';
const CLIP = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
const VAE = 'minimax_h3_video_vae_fp16.safetensors';
const AUDIO_VAE = 'minimax_h3_audio_vae_fp32.safetensors';
const DMAD = 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors';

const P = 'subject_definitions:\n<Subject 1> from <Picture 1>.\n<Video 1> supplies motion.\n\nsummary:\n[reference generation] A woman walks.\n\nretention_analysis:\n<Subject 1>: fully_preserved\n<Video 1>: attribute_transfer\n\ndetailed_description:\n[Shot 1] A woman walks.\n\noverall_soundscape: Wind.\n\nnon_diegetic_music: N/A';

function base(extra = {}) {
  const g = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: UNET_REF, weight_dtype: 'default' } },
    '4': { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: DMAD, strength_model: 1.0 } },
    '103': { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['4', 0], shift_video: 12, shift_audio: 2 } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: 'minimax', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: VAE } },
    '15': { class_type: 'VAELoader', inputs: { vae_name: AUDIO_VAE } },
    '5': { class_type: 'RandomNoise', inputs: { noise_seed: 7 } },
    '6': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'lcm' } },
    '8': { class_type: 'BasicGuider', inputs: { model: ['103', 0], conditioning: ['9', 0] } },
    '11': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['5', 0], guider: ['8', 0], sampler: ['6', 0], sigmas: ['7', 0], latent_image: ['9', 1] } },
    '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    '16': { class_type: 'VAEDecodeAudio', inputs: { samples: ['11', 0], vae: ['15', 0] } },
    '13': { class_type: 'CreateVideo', inputs: { images: ['12', 0], audio: ['16', 0], fps: 24 } },
    '14': { class_type: 'SaveVideo', inputs: { video: ['13', 0], filename_prefix: 'dmadcap/probe2', format: 'mp4' } },
    '7': { class_type: 'BasicScheduler', inputs: { model: ['103', 0], scheduler: 'simple', steps: 8, denoise: 1.0 } },
  };
  Object.assign(g, extra);
  return g;
}

const refNode = (extraRefs = {}) => ({
  '9': {
    class_type: 'MiniMaxH3ReferenceToVideo',
    inputs: {
      clip: ['2', 0], vae: ['3', 0], audio_vae: ['15', 0], prompt: P,
      width: 864, height: 480, length: 124, ref_image_size: 'match',
      ...extraRefs,
    },
  },
});

const CASES = [];

// Q2: 参考视频
CASES.push({
  id: 'Q2-refvideo',
  desc: '参考视频 1 条（LoadVideo → GetVideoComponents）',
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '40': { class_type: 'LoadVideo', inputs: { file: 'ref_test_video.mp4' } },
    '41': { class_type: 'GetVideoComponents', inputs: { video: ['40', 0] } },
    ...refNode({
      ref_images: { ref_image_1: ['20', 0] },
      ref_videos: { ref_video_1: ['41', 0] },
    }),
  }),
});

// Q3: 参考音频
CASES.push({
  id: 'Q3-refaudio',
  desc: '参考音频 1 条（LoadAudio）',
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '50': { class_type: 'LoadAudio', inputs: { audio: 'ref_test_audio.wav' } },
    ...refNode({
      ref_images: { ref_image_1: ['20', 0] },
      ref_audios: { ref_audio_1: ['50', 0] },
    }),
  }),
});

// Q7: 混合（图 + 视频 + 音频）
CASES.push({
  id: 'Q7-mixed',
  desc: '图 + 视频 + 音频 混合参考',
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '40': { class_type: 'LoadVideo', inputs: { file: 'ref_test_video.mp4' } },
    '41': { class_type: 'GetVideoComponents', inputs: { video: ['40', 0] } },
    '50': { class_type: 'LoadAudio', inputs: { audio: 'ref_test_audio.wav' } },
    ...refNode({
      ref_images: { ref_image_1: ['20', 0] },
      ref_videos: { ref_video_1: ['41', 0] },
      ref_audios: { ref_audio_1: ['50', 0] },
    }),
  }),
});

async function submit(g) {
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: g, client_id: `cap2-${Date.now()}` }),
  });
  return { ok: r.ok, body: await r.json() };
}

const results = [];
for (const c of CASES) {
  console.log(`\n=== ${c.id} :: ${c.desc} ===`);
  const r = await submit(c.build());
  if (r.ok) {
    console.log(`  接受 (${r.body.prompt_id})`);
    await fetch(`${COMFY}/queue`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: [r.body.prompt_id] }),
    });
    await fetch(`${COMFY}/interrupt`, { method: 'POST' }).catch(() => {});
    results.push({ id: c.id, accepted: true });
  } else {
    console.log(`  拒绝: ${JSON.stringify(r.body).slice(0, 400)}`);
    results.push({ id: c.id, accepted: false, err: JSON.stringify(r.body).slice(0, 400) });
  }
}

console.log('\n=== 汇总 ===');
for (const r of results) console.log(`${r.id.padEnd(14)} ${r.accepted ? '接受' : '拒绝'}`);
