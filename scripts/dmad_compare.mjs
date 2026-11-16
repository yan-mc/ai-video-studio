/**
 * DMAD vs LightX2V 对照测试
 *
 * 同一提示词、同一 seed、同一分辨率，只换加速方案：
 *   A) LightX2V turbo 4step  euler / simple / 4 步 / shift 12:3
 *   B) DMAD 8step_full_critic lcm  / simple / 8 步 / shift 12:2
 *   C) DMAD 4step_full_critic lcm  / simple / 4 步 / shift 12:2
 *
 * 走 8488 的 /prompt 直提 API 格式工作流（不经过插件），
 * 这样能先把 DMAD 本身跑通，再谈整合。
 */
import fs from 'node:fs';

const COMFY = process.env.COMFY || 'http://127.0.0.1:8488';
const OUT_DIR = process.env.OUT || 'F:/AI视频/ai-runtime/ComfyUI/output';

// ---------- 固定的通用配置 ----------
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

const VARIANTS = [
  {
    key: 'A-lightx2v-4step',
    label: 'LightX2V turbo 4step (现状)',
    lora: 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
    sampler: 'euler',
    steps: 4,
    shiftV: null,      // 不插 shift 节点，用模型默认 12:3
    shiftA: null,
  },
  {
    key: 'B-dmad-8step',
    label: 'DMAD 8step_full_critic',
    lora: 'dmad_minimax_h3_8step_full_critic_comfyui.safetensors',
    sampler: 'lcm',
    steps: 8,
    shiftV: 12,
    shiftA: 2,
  },
  {
    key: 'C-dmad-4step',
    label: 'DMAD 4step_full_critic',
    lora: 'dmad_minimax_h3_4step_full_critic_comfyui.safetensors',
    sampler: 'lcm',
    steps: 4,
    shiftV: 12,
    shiftA: 2,
  },
];

/** 组装 API 格式工作流 */
function build(v) {
  const g = {
    1: { class_type: 'UNETLoader', inputs: { unet_name: UNET, weight_dtype: 'default' } },
    4: {
      class_type: 'LoraLoaderModelOnly',
      inputs: { model: ["1", 0], lora_name: v.lora, strength_model: 1.0 },
    },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: 'minimax', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: VAE } },
    15: { class_type: 'VAELoader', inputs: { vae_name: AUDIO_VAE } },
    5: { class_type: 'RandomNoise', inputs: { noise_seed: SEED } },
    6: { class_type: 'KSamplerSelect', inputs: { sampler_name: v.sampler } },
    9: {
      class_type: 'MiniMaxH3ImageToVideo',
      inputs: {
        // ⚠️ 这个节点**没有** audio_vae 参数（实测 object_info 只认
        // clip/vae/prompt/width/height/length + 可选 first_frame/last_frame）。
        // 音频 VAE 只在后面的 VAEDecodeAudio 用。
        clip: ["2", 0], vae: ["3", 0],
        prompt: PROMPT, width: W, height: H, length: LEN,
      },
    },
    8: { class_type: 'BasicGuider', inputs: { model: null, conditioning: ["9", 0] } },
    11: {
      class_type: 'SamplerCustomAdvanced',
      inputs: {
        noise: ["5", 0], guider: ["8", 0], sampler: ["6", 0], sigmas: ["7", 0], latent_image: ["9", 1],
      },
    },
    12: { class_type: 'VAEDecode', inputs: { samples: ["11", 0], vae: ["3", 0] } },
    16: { class_type: 'VAEDecodeAudio', inputs: { samples: ["11", 0], vae: ["15", 0] } },
    13: { class_type: 'CreateVideo', inputs: { images: ["12", 0], audio: ["16", 0], fps: 24 } },
    14: {
      class_type: 'SaveVideo',
      inputs: { video: ["13", 0], filename_prefix: `dmad_test/${v.key}`, format: 'mp4', codec: 'h264' },
    },
  };

  // shift 节点（仅 DMAD 需要显式设；LightX2V 用模型默认）
  let modelRef = ["4", 0];
  if (v.shiftV != null) {
    g[3 + 100] = {
      class_type: 'MiniMaxH3SigmaShift',
      inputs: { model: ["4", 0], shift_video: v.shiftV, shift_audio: v.shiftA },
    };
    modelRef = ["103", 0];
  }
  g[8].inputs.model = modelRef;
  g[7] = {
    class_type: 'BasicScheduler',
    inputs: { model: modelRef, scheduler: 'simple', steps: v.steps, denoise: 1.0 },
  };
  return g;
}

async function submit(v) {
  const body = { prompt: build(v), client_id: `dmadtest-${v.key}` };
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${v.key} submit failed: ${JSON.stringify(j).slice(0, 500)}`);
  return j.prompt_id;
}

async function waitDone(id, timeoutMs = 20 * 60 * 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const h = await (await fetch(`${COMFY}/history/${id}`)).json();
    if (h[id]) {
      const st = h[id].status;
      return { done: true, status: st, outputs: h[id].outputs };
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { done: false };
}

async function main() {
  const only = process.env.ONLY;
  const results = [];
  for (const v of VARIANTS) {
    if (only && !v.key.includes(only)) continue;
    console.log(`\n=== ${v.key} :: ${v.label} ===`);
    const t0 = Date.now();
    try {
      const id = await submit(v);
      console.log(`  submitted ${id}`);
      const r = await waitDone(id);
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      if (!r.done) { console.log('  TIMEOUT'); results.push({ ...v, error: 'timeout' }); continue; }
      console.log(`  status=${r.status?.status_str}  ${sec}s`);
      const files = [];
      for (const [nodeId, o] of Object.entries(r.outputs ?? {})) {
        for (const f of (o.gifs ?? o.videos ?? o.images ?? [])) files.push(f);
      }
      console.log('  outputs:', JSON.stringify(files));
      results.push({ key: v.key, label: v.label, seconds: +sec, files, status: r.status?.status_str });
    } catch (e) {
      console.log('  ERROR', e.message);
      results.push({ key: v.key, error: e.message });
    }
  }
  fs.writeFileSync('F:/AI视频/工作室/dsh-jiuzhang-studio/scripts/_dmad_test_result.json', JSON.stringify(results, null, 2));
  console.log('\n=== summary ===');
  for (const r of results) {
    console.log(`${(r.key || '').padEnd(20)} ${r.error ? 'ERR ' + r.error.slice(0, 80) : (r.seconds + 's  ' + (r.status || ''))}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
