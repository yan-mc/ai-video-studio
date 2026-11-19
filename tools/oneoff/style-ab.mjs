/**
 * 画风 LoRA 对照实验 —— 关掉提示词画风串，只靠 LoRA 决定风格。
 *
 * 用法：node tools/oneoff/style-ab.mjs <variant>
 *   variant: none | baseline | claymation | studio1939 | vhs | pixel16 | anime2d | anime2real
 *
 * 与 lora-ab.mjs 的区别：
 *   · styleId 一律设成 'none'（关掉内置画风串）
 *   · 每个 variant 只换 30_style/ 里的一个 LoRA
 *   · 提示词内容固定（同一段打架戏），这样差异只能来自画风
 */
import fs from 'node:fs';
import path from 'node:path';

import { loadConfig } from '../../host/config.js';
import { newJob, jobs as jobsStore } from '../../host/services/job-store.js';
import { runJob } from '../../host/services/job-runner.js';
import { runH3Nanfeng } from '../../host/services/generator.js';
import { compilePrompt } from '../../host/api/index.js';

const VARIANT = process.argv[2] || 'baseline';
const PROJECT = 'proj_mwmz7hth111rew';

const cfg = loadConfig();

const CARDS = [
  {
    id: 'card_mwlu86snlnn1ki',
    name: '丰川祥子',
    resolvedImages: [{ slot: 'sheet', rel: 'assets/asset_mwlu78jg8foxfi.png' }],
    description: '',
    traits: [],
  },
  {
    id: 'card_mwlu86s6pzcvmq',
    name: '三角初华',
    resolvedImages: [{ slot: 'sheet', rel: 'assets/asset_mwltxdhel1xxg6.png' }],
    description: '',
    traits: [],
  },
];

/**
 * 固定提示词：两个角色近身格斗。
 *
 * ⚠️ 刻意**不写任何画风/媒介描述** —— 这一轮的变量只有画风 LoRA。
 *    如果这里残留 "cel-animation" 之类，就等于在用提示词抢 LoRA 的活。
 */
function buildPrompt() {
  return `subject_definitions:
<Subject 1> is the horned woman shown in <Picture 1>.
<Subject 2> is the woman in the top hat shown in <Picture 2>.

summary:
[reference generation] Two women meet in a ruined stone courtyard at dusk and fall into a close-range martial exchange. Both remain visible in every frame.

retention_analysis:
<Subject 1>: fully_preserved - horns, hair, face and costume from <Picture 1>.
<Subject 2>: fully_preserved - top hat, hair, face and costume from <Picture 2>. The hat stays on her head.

detailed_description:
[Shot 1] A medium wide shot at eye level, both women framed head to boot, standing three paces apart in a ruined stone courtyard at dusk. Loose ivy climbs a collapsed arch behind them, broken flagstones underfoot, dry leaves scattered across the ground. The horned woman drops into a forward stance, cape swinging out behind her; the top-hatted woman angles her body side-on, hat brim shading her eyes.

[Shot 2] At 00:01.200, the horned woman steps in and throws a straight right punch. The top-hatted woman twists her torso away, the punch grazing her shoulder, hat firm on her head.

[Shot 3] At 00:02.400, the top-hatted woman answers with a short elbow strike. The horned woman catches it on her forearm, the impact pushing both half a step back, her cape flaring.

[Shot 4] At 00:03.600, they close into a grapple — hand clamped on wrist, the other braced against a shoulder. Both strain, boots skidding on flagstones.

[Shot 5] At 00:04.800, they break apart and reset. The horned woman lands back into her forward stance; the top-hatted woman straightens her hat brim with two fingers and settles into her guard. Both remain fully visible.

The camera moves in one continuous slow arc from screen-left to screen-right around the pair at a constant distance, keeping both figures in frame; it does not cut, zoom, or change height.

overall_soundscape:
A ruined stone courtyard at dusk: dry leaves scraping on flagstones, low wind through the broken arch, boots scuffing, cloth twisting, two people breathing hard. All sounds are diegetic.

non_diegetic_music: N/A`;
}

/** variant → 画风 LoRA（null = 不挂任何画风 LoRA，纯基线） */
const STYLE_LORAS = {
  claymation: { file: '30_style\\claymation_style.safetensors', strength: 0.85, note: '黏土定格' },
  studio1939: { file: '30_style\\studio1939_old_animation.safetensors', strength: 0.85, note: '1939 老动画' },
  vhs: { file: '30_style\\vh5tape_vhs.safetensors', strength: 0.85, note: 'VHS 录像带' },
  pixel16: { file: '30_style\\16bit_pixel.safetensors', strength: 0.9, note: '16bit 像素' },
  anime2d: { file: '30_style\\anime_2d_style.safetensors', strength: 0.85, note: '2D 动画平涂' },
  anime2real: { file: '30_style\\anime_to_realism.safetensors', strength: 0.8, note: '动画转写实' },
};

const VARIANTS = {
  /** 基线甲：不挂画风 LoRA + 不注入画风串（纯模型原生风格） */
  baseline: { styleId: 'none', style: null },
  /** 基线乙：不挂画风 LoRA + 保持默认 OVA 画风串（对照"提示词 vs LoRA"） */
  'baseline-ova': { styleId: 'ova90s', style: null },
};
for (const [id, s] of Object.entries(STYLE_LORAS)) {
  VARIANTS[id] = { styleId: 'none', style: s };
}

const v = VARIANTS[VARIANT];
if (!v) {
  console.error(`未知 variant: ${VARIANT}\n可选: ${Object.keys(VARIANTS).join(' / ')}`);
  process.exit(1);
}

const shot = {
  id: `shot_style_${VARIANT.replace(/\W/g, '_')}`,
  title: `画风·${VARIANT}`,
  mode: 'ref2va',
  durationSec: 5,
  ratio: '16:9',
  profile: 'P12-draft',
  accelPlan: 'dmad8',
  styleId: v.styleId,
  description: '碎石庭院近身格斗',
  prompt: buildPrompt(),
  refs: { images: [], videos: [], audios: [] },
  characterCards: CARDS,
  nanfeng: {
    presets: 'draft',
    overrides: {},
    ...(v.style ? { loras: [{ name: v.style.file, strength: v.style.strength }] } : {}),
  },
};

const warnings = [];
const compiled = compilePrompt(shot, warnings);

const job = newJob({
  projectId: PROJECT,
  shotId: shot.id,
  backendId: 'h3-nanfeng',
  mode: 'ref2va',
  prompt: compiled,
  params: { accelPlan: 'dmad8', seed: 20241119, variant: `style:${VARIANT}` },
});

await jobsStore().upsert(job);
console.log(`[style:${VARIANT}] job=${job.id} 提示词 ${compiled.length} 字 | styleId=${v.styleId} | LoRA=${v.style ? v.style.file : '无'}`);

await runJob(job, async (running, hooks) => runH3Nanfeng({
  job: running,
  shot,
  prompt: compiled,
  cfg,
  mode: 'ref2va',
  preset: 'draft',
  onSubmitted: hooks?.onSubmitted,
}));

/**
 * ⚠️ `runJob` 会把任务丢进队列后立刻返回，job 对象上的 status 可能还停在
 * `queued`。这里主动轮询 jobs store 直到终态，避免"记录里写着 queued、
 * 实际早就跑完"这种误导性输出。
 */
async function waitTerminal(jobId, timeoutMs = 40 * 60 * 1000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const all = await jobsStore().list();
    const cur = all.find((x) => x.id === jobId);
    if (cur && ['completed', 'failed', 'cancelled'].includes(cur.status)) return cur;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`TIMEOUT: ${jobId} 未在 ${timeoutMs / 60000} 分钟内完成`);
}
const finalJob = await waitTerminal(job.id);

const out = {
  variant: VARIANT,
  styleId: v.styleId,
  styleLora: v.style ? v.style.file : null,
  styleNote: v.style?.note ?? null,
  jobId: job.id,
  status: finalJob.status,
  ...(finalJob.error ? { error: finalJob.error } : {}),
  promptChars: compiled.length,
  loraStack: finalJob.params?.loraStack,
  outputs: finalJob.outputs,
  warnings: finalJob.warnings,
};
console.log(JSON.stringify(out, null, 2));

const recPath = path.join(cfg.dataDir, 'outputs', `style-ab-${VARIANT}.json`);
fs.mkdirSync(path.dirname(recPath), { recursive: true });
fs.writeFileSync(recPath, JSON.stringify(out, null, 2));
console.log(`记录写入 ${recPath}`);
