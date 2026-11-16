/**
 * 验证 DMAD 是否改变 H3 的**输入格式与数量要求**。
 *
 * 官方 README 只说 LoRA + lcm/simple + shift 12:2，
 * 没有提任何输入格式/数量限制的变化。但必须实测确认：
 *
 *   Q1 参考图数量上限（H3 是 ≤9）在 DMAD 下是否不变？
 *   Q2 参考视频（≤3，2-15s）在 DMAD 下是否可用？
 *   Q3 参考音频（≤3）在 DMAD 下是否可用？
 *   Q4 首尾帧（ImageToVideo 的 first_frame/last_frame）在 DMAD 下是否可用？
 *   Q5 帧数网格 17k+5 在 DMAD 下是否不变？
 *   Q6 分辨率 32 倍数是否不变？
 *
 * 做法：对每个问题提交一个**最小验证请求**，只看 ComfyUI 是否接受并跑完前几步，
 * 不需要全部跑完（跑通前 2-3 步就能证明接线正确）。
 * 为省时间用 124 帧、864x480、低步数。
 */
import fs from 'node:fs';

const COMFY = 'http://127.0.0.1:8488';
const UNET_REF = 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors';
const CLIP = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
const VAE = 'minimax_h3_video_vae_fp16.safetensors';
const AUDIO_VAE = 'minimax_h3_audio_vae_fp32.safetensors';
const DMAD = 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors';

const P = 'subject_definitions:\n<Subject 1> is referenced from <Picture 1>.\n\nsummary:\n[reference generation] A woman walks.\n\nretention_analysis:\n<Subject 1>: fully_preserved\n\ndetailed_description:\n[Shot 1] A woman walks forward.\n\noverall_soundscape: Wind.\n\nnon_diegetic_music: N/A';

/** 公共骨架：DMAD + lcm + shift 12:2 */
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
    '14': { class_type: 'SaveVideo', inputs: { video: ['13', 0], filename_prefix: 'dmadcap/probe', format: 'mp4' } },
    '7': { class_type: 'BasicScheduler', inputs: { model: ['103', 0], scheduler: 'simple', steps: 8, denoise: 1.0 } },
  };
  Object.assign(g, extra);
  return g;
}

const CASES = [];

// Q1a: 参考图 1 张
CASES.push({
  id: 'Q1a-1img',
  desc: '参考图 1 张',
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '9': {
      class_type: 'MiniMaxH3ReferenceToVideo',
      inputs: {
        clip: ['2', 0], vae: ['3', 0], audio_vae: ['15', 0], prompt: P,
        width: 864, height: 480, length: 124, ref_image_size: 'match',
        ref_images: { ref_image_1: ['20', 0] },
      },
    },
  }),
});

// Q1b: 参考图 2 张
CASES.push({
  id: 'Q1b-2img',
  desc: '参考图 2 张',
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '21': { class_type: 'LoadImage', inputs: { image: 'kanade_back.png' } },
    '9': {
      class_type: 'MiniMaxH3ReferenceToVideo',
      inputs: {
        clip: ['2', 0], vae: ['3', 0], audio_vae: ['15', 0], prompt: P,
        width: 864, height: 480, length: 124, ref_image_size: 'match',
        ref_images: { ref_image_1: ['20', 0], ref_image_2: ['21', 0] },
      },
    },
  }),
});

// Q4: 首尾帧（ImageToVideo）
CASES.push({
  id: 'Q4-firstlast',
  desc: '首帧 + 尾帧（ImageToVideo）',
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '21': { class_type: 'LoadImage', inputs: { image: 'kanade_back.png' } },
    '9': {
      class_type: 'MiniMaxH3ImageToVideo',
      inputs: {
        clip: ['2', 0], vae: ['3', 0], prompt: P,
        width: 864, height: 480, length: 124,
        first_frame: ['20', 0], last_frame: ['21', 0],
      },
    },
  }),
});

// Q5: 非法帧数（应为 124 -> 拒绝 130）
CASES.push({
  id: 'Q5-badlen',
  desc: '非法帧数 130（应被 grid 拒绝或报错）',
  expectFail: true,
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '9': {
      class_type: 'MiniMaxH3ReferenceToVideo',
      inputs: {
        clip: ['2', 0], vae: ['3', 0], audio_vae: ['15', 0], prompt: P,
        width: 864, height: 480, length: 130, ref_image_size: 'match',
        ref_images: { ref_image_1: ['20', 0] },
      },
    },
  }),
});

// Q6: 非法分辨率（1000 不是 32 倍数）
CASES.push({
  id: 'Q6-badres',
  desc: '非法分辨率 1000（32 倍数约束）',
  expectFail: true,
  build: () => base({
    '20': { class_type: 'LoadImage', inputs: { image: 'kanade_front.png' } },
    '9': {
      class_type: 'MiniMaxH3ReferenceToVideo',
      inputs: {
        clip: ['2', 0], vae: ['3', 0], audio_vae: ['15', 0], prompt: P,
        width: 1000, height: 480, length: 124, ref_image_size: 'match',
        ref_images: { ref_image_1: ['20', 0] },
      },
    },
  }),
});

async function submit(g) {
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: g, client_id: `cap-${Date.now()}` }),
  });
  return { ok: r.ok, status: r.status, body: await r.json() };
}

const only = process.env.ONLY;
const results = [];
for (const c of CASES) {
  if (only && !c.id.startsWith(only)) continue;
  console.log(`\n=== ${c.id} :: ${c.desc} ===`);
  const r = await submit(c.build());
  if (r.ok) {
    console.log(`  接受 (prompt_id=${r.body.prompt_id})`);
    // 立刻取消，不真的跑完（只要证明接线合法）
    await fetch(`${COMFY}/queue`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: [r.body.prompt_id] }),
    });
    // 若已在跑则打断
    await fetch(`${COMFY}/interrupt`, { method: 'POST' }).catch(() => {});
    results.push({ id: c.id, accepted: true });
  } else {
    const err = JSON.stringify(r.body).slice(0, 400);
    console.log(`  拒绝: ${err}`);
    results.push({ id: c.id, accepted: false, err });
  }
}

fs.writeFileSync('F:/AI视频/工作室/dsh-jiuzhang-studio/scripts/_dmad_capability.json',
  JSON.stringify(results, null, 2));
console.log('\n=== 汇总 ===');
for (const r of results) console.log(`${r.id.padEnd(16)} ${r.accepted ? '接受' : '拒绝'}`);
