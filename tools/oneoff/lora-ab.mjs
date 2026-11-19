/**
 * LoRA 对照实验脚本 —— 同一提示词，换不同 LoRA 组合。
 *
 * 用法：node tools/oneoff/lora-ab.mjs <variant>
 *   variant: nolora | dmad | dmad+style
 *
 * 产出：data/outputs/ 下的 mp4 + 一条 JSON 记录实际提交的 LoRA 栈。
 */
import { loadConfig } from '../../host/config.js';
import { newJob, jobs as jobsStore } from '../../host/services/job-store.js';
import { runJob } from '../../host/services/job-runner.js';
import { runH3Nanfeng } from '../../host/services/generator.js';
import { compilePrompt } from '../../host/api/index.js';
import { readWorkflowCached } from '../../host/services/workflow-paths.js';
import { resolvePictureIndices } from '../../host/services/shot-context.js';
import fs from 'node:fs';
import path from 'node:path';

const VARIANT = process.argv[2] || 'dmad';
const PROJECT = 'proj_mwmz7hth111rew';

const cfg = loadConfig();

/** 两个角色卡的完整设定（从 vault 读） */
const CARDS = [
  {
    id: 'card_mwlu86snlnn1ki',
    name: '丰川祥子',
    resolvedImages: [{ slot: 'sheet', rel: 'assets/asset_mwlu78jg8foxfi.png' }],
    description: '银蓝色长发及腰、发梢淡紫渐变；两侧长而弯曲的黑色羊角（角身有棱纹），额前细小银蓝独角；淡紫色眼睛，皮肤苍白；黑色蕾丝露肩短上衣配蓝色丝带蝴蝶结与蕾丝荷叶袖；黑色多层薄纱长裙，外层金色与紫色小花刺绣；黑色半透明连裤袜带金色点状花纹，黑色短靴带金属扣；蓝宝石金链项饰、蓝宝石耳坠；黑色蕾丝开叉长披风。',
    traits: ['银蓝长发', '黑色弯羊角', '额前独角', '淡紫眼', '黑色蕾丝短上衣', '多层薄纱长裙', '黑披风'],
  },
  {
    id: 'card_mwlu86s6pzcvmq',
    name: '三角初华',
    resolvedImages: [{ slot: 'sheet', rel: 'assets/asset_mwltxdhel1xxg6.png' }],
    description: '金色齐肩短发，黑色高顶礼帽（帽檐金色藤蔓纹、蓝宝石帽饰）；紫罗兰色眼睛；黑色露肩束腰短上衣配金色盘扣与黑蝴蝶结祖母绿胸针，白色蕾丝荷叶边袖口；黑色及踝长裙，外层硬挺面料带金色刺绣，内衬鲜红丝缎，裙摆高开叉；黑色及膝交叉绑带高跟长靴；金色细项圈配蓝宝石吊坠、金色耳坠、腰间金色装饰链。',
    traits: ['金色齐肩短发', '黑色高顶礼帽', '紫罗兰眼', '黑色束腰短上衣', '黑色及踝长裙', '红色丝缎内衬', '交叉绑带长靴'],
  },
];

/**
 * 双角色近身格斗的提示词（Ref2VA 六段式）。
 *
 * 要点：
 *  · 两个 Subject 分别绑 <Picture 1> / <Picture 2>
 *  · 场景用第三个参考图或纯文字（这里纯文字，避免第三张图抢注意力）
 *  · 动作写成分解式：接近 → 出拳 → 格挡 → 反击 → 拉开距离
 *  · 强调"两人始终同框可见"，否则 H3 容易丢一个人
 */
function buildPrompt() {
  return `subject_definitions:
<Subject 1> is the horned woman shown in <Picture 1>. Silver-blue waist-length hair fading to pale violet at the tips; two long curved black horns with ridged shafts on both sides of her head, plus a small silver-blue horn at the front hairline; pale violet eyes, pale skin; black lace off-shoulder cropped top with blue ribbon bow and lace ruffled sleeves; layered black gauze long skirt with gold and violet floral embroidery and black lace trim; black sheer tights with gold dotted pattern; black ankle boots with metal buckles; sapphire-and-gold necklace and sapphire drop earrings; black lace slitted long cape.
<Subject 2> is the woman in the top hat shown in <Picture 2>. Golden shoulder-length hair; black tall top hat with gold vine tracery along the brim and a sapphire hat ornament; violet eyes; black off-shoulder corset cropped top with gold frog closures and a black bow brooch set with an emerald; white lace ruffled cuffs; black ankle-length skirt with stiff outer fabric, gold embroidery, crimson silk lining, and a high slit; black knee-high cross-laced heeled boots; gold choker with sapphire pendant, gold drop earrings, gold waist chain.

summary:
[reference generation] Two women, the horned one and the top-hatted one, meet in a ruined stone courtyard at dusk and immediately fall into a close-range martial exchange — the horned woman presses forward with a straight punch, the top-hatted woman slips aside and counters with an elbow, they grapple, break apart, and reset into a guarded stance. Both remain visible in every frame.

retention_analysis:
<Subject 1>: fully_preserved - horns, hair, face, outfit and cape from <Picture 1>.
<Subject 2>: fully_preserved - top hat, hair, face and outfit from <Picture 2>. The hat stays on her head through the entire exchange.

detailed_description:
[Shot 1] A medium wide shot at eye level, both women framed from head to boot, standing three paces apart in a ruined stone courtyard at dusk. Loose ivy climbs a collapsed arch behind them, broken flagstones underfoot, dry leaves scattered across the ground. The horned woman (<Subject 1>) drops into a forward stance, her cape swinging out behind her; the top-hatted woman (<Subject 2>) angles her body side-on, weight on her back foot, hat brim shading her eyes. Dust drifts in the low light.

[Shot 2] At 00:01.200, the horned woman steps in and throws a straight right punch toward the top-hatted woman's chest. The top-hatted woman twists her torso away, the punch grazing past her shoulder, and her hat stays firm on her head. Her off-shoulder top shifts with the rotation.

[Shot 3] At 00:02.400, the top-hatted woman answers with a short elbow strike up into the horned woman's guard. The horned woman catches it on her forearm, the impact pushing both of them half a step back, her black lace cape flaring from the recoil.

[Shot 4] At 00:03.600, they close into a grapple — the horned woman's hand clamped on the top-hatted woman's wrist, the top-hatted woman's other hand braced against the horned woman's shoulder. Both strain, boots skidding on the flagstones, hair whipping across their faces.

[Shot 5] At 00:04.800, they break apart and reset. The horned woman lands back into her forward stance, breathing hard; the top-hatted woman straightens her hat brim with two fingers and settles into her side-on guard. Dust settles slowly between them. Both remain fully visible in frame.

The camera moves in one continuous slow arc from screen-left to screen-right around the pair at a constant distance, keeping both figures in frame the entire time; it does not cut, zoom, or change height.

overall_soundscape:
A ruined stone courtyard at dusk: dry leaves scraping across flagstones, a low wind through the broken arch, and the sharp impact sounds of the exchange — a scuff of boots, a slap of forearm against elbow, cloth twisting, two people breathing hard at close range. All sounds are diegetic.

non_diegetic_music: N/A`;
}

/**
 * variant → LoRA 配置。
 *
 * 每个 variant 都带 DMAD 加速学生（除了 nolora），
 * 差异只在语义 LoRA —— 这样对比出来的就是"语义 LoRA 到底有没有用"。
 */
const VARIANTS = {
  /** 基线：不加速、无语义 LoRA（最慢，仅对照） */
  nolora: { accelPlan: 'none', loras: [] },

  /** 只用 DMAD（当前默认） */
  dmad: { accelPlan: 'dmad8', loras: [] },

  /**
   * DMAD + 打斗双件套。
   *
   * Combat BASE（触发词 `prfight2`）+ Motion Continuity Repair（无触发词）
   * 是社区给的标准配方：
   *   · Combat 负责"打击感 / 动作幅度 / 戏剧张力"
   *   · Repair 负责"别在快动作处掉帧、突变慢放"
   *   · Repair 单独用 0.9，配 Combat 时降到 0.5–0.7（官方原文）
   * 这里用 0.6 / 0.5，总强度 1.1（低于 1.5 阈值）。
   */
  fight: {
    accelPlan: 'dmad8',
    loras: [
      { name: '20_motion\\H3_Combat_V2.safetensors', strength: 0.6 },
      { name: '20_motion\\Motion_Repair_V2.safetensors', strength: 0.5 },
    ],
  },

  /**
   * DMAD + 打斗 + 运镜。
   *
   * 运镜是**单选类**，这里只挂一个 camera_motion。
   * 但注意：camera LoRA 有自己的触发词要求（`camera motion` 放开头），
   * 而我们的提示词已经写了"In one continuous slow arc…"，
   * 所以这里主要看它会不会强化运镜、以及总强度是否超限。
   */
  'fight+cam': {
    accelPlan: 'dmad8',
    loras: [
      { name: '20_motion\\H3_Combat_V2.safetensors', strength: 0.6 },
      { name: '20_motion\\Motion_Repair_V2.safetensors', strength: 0.5 },
      { name: '10_camera\\camera_motion_h3_v1.safetensors', strength: 0.5 },
    ],
  },

  /**
   * 故意提交一个**不存在的** LoRA —— 验证"不静默降级"。
   *
   * 期望：被 solveLoraStack 拒绝 + 写 warning + 任务仍然成功。
   */
  'dmad+missing': {
    accelPlan: 'dmad8',
    loras: [{ name: '30_style/does_not_exist.safetensors', strength: 0.7 }],
  },
};

const v = VARIANTS[VARIANT];
if (!v) {
  console.error(`未知 variant: ${VARIANT}（可选 ${Object.keys(VARIANTS).join(' / ')}）`);
  process.exit(1);
}

const shot = {
  id: `shot_${VARIANT.replace(/\W/g, '_')}`,
  title: `打架·${VARIANT}`,
  mode: 'ref2va',
  durationSec: 5,
  ratio: '16:9',
  profile: 'P12-draft',
  accelPlan: v.accelPlan,
  description: '丰川祥子 vs 三角初华，碎石庭院近身格斗',
  /**
   * ⚠️ 手工写好的完整六段式必须放 `prompt`，不能只放 `description`。
   *
   * `compilePrompt()` 的分支是：
   *   · `shot.prompt` 长度 > 200  → **整段直接使用**（成品，不再编译）
   *   · 否则                       → 从 `description` 拼三/六段格式
   *
   * 之前这里把 prompt 留空、只给了 description（一句话），
   * 于是那 5 个 [Shot N] 的动作分解**全部被丢弃**，
   * 出片就是"两个人站着不动"。
   */
  prompt: buildPrompt(),
  refs: { images: [], videos: [], audios: [] },
  characterCards: CARDS,
  nanfeng: {
    presets: 'draft',
    overrides: {},
    ...(v.loras.length ? { loras: v.loras } : {}),
  },
};

const cfg2 = cfg;
const shotForCompile = shot;
const warnings = [];
const compiled = compilePrompt(shotForCompile, warnings);

const job = newJob({
  projectId: PROJECT,
  shotId: shot.id,
  backendId: 'h3-nanfeng',
  mode: 'ref2va',
  prompt: compiled,
  params: { accelPlan: v.accelPlan, seed: 20241119, variant: VARIANT },
});

await jobsStore().upsert(job);
console.log(`[${VARIANT}] job=${job.id} 提示词 ${compiled.length} 字`);

const wf = readWorkflowCached('image', cfg2);   // 仅确保 workflow 目录可读
void wf;

const result = await runJob(job, async (running, hooks) => runH3Nanfeng({
  job: running,
  shot,
  prompt: compiled,
  cfg: cfg2,
  mode: 'ref2va',
  preset: 'draft',
  onSubmitted: hooks?.onSubmitted,
}));

const out = {
  variant: VARIANT,
  jobId: job.id,
  status: result?.status ?? job.status,
  loraStack: job.params?.loraStack,
  loraTotalStrength: job.params?.loraTotalStrength,
  accel: job.params?.accelPlan,
  shiftApplied: job.params?.shiftApplied,
  shift: job.params?.shift,
  outputs: job.outputs,
  warnings: job.warnings,
  params: job.params?.nanfengParams,
};
console.log(JSON.stringify(out, null, 2));

const recPath = path.join(cfg2.dataDir, 'outputs', `lora-ab-${VARIANT}.json`);
fs.mkdirSync(path.dirname(recPath), { recursive: true });
fs.writeFileSync(recPath, JSON.stringify(out, null, 2));
console.log(`记录写入 ${recPath}`);
