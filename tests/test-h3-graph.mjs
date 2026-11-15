/**
 * H3 节点图装配的集成测试 —— **不提交 ComfyUI**，只验证装配结果。
 *
 *   node tests/test-h3-graph.mjs
 *
 * 覆盖三个曾经真实发生过的线上故障：
 *   1. 「无参考图 + 首帧」必然失败：FL2VA 分支建的 20/21 被
 *      `usedLoadImages` 硬编码清理误删，first_frame 指向不存在的节点 →
 *      ComfyUI 报 node_errors['9'] details "'20'"。
 *   2. AddGuide 从 70 编号覆盖掉 70/71 的 LoadImage →
 *      "image, received_type(CONDITIONING)"。
 *   3. 模板占位符 {{REF_IMAGE_1}} 未清理 → Invalid file。
 *
 * 做法：用 monkey-patch 掉 comfy-client 的 runWorkflow / listModelFiles /
 * stageToComfyInput，让 runH3Local 跑完整装配但不发网络请求。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/** Windows 上 import() 绝对路径必须转成 file:// URL。 */
const mod = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const FAILS = [];
let checks = 0;
function check(cond, msg) {
  checks += 1;
  if (!cond) FAILS.push(msg);
}

// ---------------------------------------------------------------- 打桩
const comfy = await mod('host/services/comfy-client.js');
let lastWorkflow = null;
comfy.setWorkflowCaptureForTests((wf) => { lastWorkflow = wf; });

const gen = await mod('host/services/generator.js');
const { NodeGraph } = await mod('host/services/h3-graph.js');
const cfgMod = await mod('host/config.js');
const cfg = cfgMod.loadConfig();

const workflow = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/workflows/h3.json'), 'utf8'));

// 造两个真实存在的素材文件供 staging 通过。
//
// ⚠️ 必须放在**系统临时目录**，不能放 data/tmp-inline/ ——
//    放 dataDir 里会：① 每次跑测都在用户的 data/ 里留垃圾；
//    ② 触发 assets-index 的自动创建，污染用户素材库。
//    本项目的 "previz 无清理" 就是同类问题，测试里不能重演。
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-h3graph-'));
const imgA = path.join(tmpDir, 'test-a.png');
const imgB = path.join(tmpDir, 'test-b.png');
const pngStub = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
fs.writeFileSync(imgA, pngStub);
fs.writeFileSync(imgB, pngStub);
process.on('exit', () => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function makeJob() {
  return {
    id: 'job_test_' + Math.random().toString(36).slice(2, 8),
    status: 'running',
    params: {},
    outputs: [],
  };
}

/** 跑一次装配，返回 {workflow, job, error} */
async function assemble(shot) {
  lastWorkflow = null;
  const job = makeJob();
  let error = null;
  try {
    await gen.runH3Local({
      workflow,
      job,
      shot,
      prompt: 'test prompt',
      cfg,
      onSubmitted: async () => {},
    });
  } catch (e) {
    error = e;
  }
  return { workflow: lastWorkflow, job, error };
}

// ---------------------------------------------------------------- 用例
const cases = [
  {
    name: '仅首帧（无参考图）',
    shot: { durationSec: 3, ratio: '16:9', profile: 'P12-draft', mode: 't2va',
      previz: { firstFramePath: imgA }, refs: { images: [] } },
    expectNode9: 'MiniMaxH3ImageToVideo',
    expectFirst: true,
    expectLast: false,
  },
  {
    name: '首+尾帧（无参考图）',
    shot: { durationSec: 3, ratio: '16:9', profile: 'P12-draft', mode: 't2va',
      previz: { firstFramePath: imgA, lastFramePath: imgB }, refs: { images: [] } },
    expectNode9: 'MiniMaxH3ImageToVideo',
    expectFirst: true,
    expectLast: true,
  },
  {
    name: '纯文生（无参考无首尾）',
    shot: { durationSec: 3, ratio: '16:9', profile: 'P12-draft', mode: 't2va',
      refs: { images: [] } },
    expectNode9: 'MiniMaxH3ImageToVideo',
    expectFirst: false,
    expectLast: false,
  },
  {
    name: '单张参考图（Ref2VA）',
    shot: { durationSec: 3, ratio: '16:9', profile: 'P12-draft', mode: 'ref2va',
      refs: { images: [imgA] } },
    expectNode9: 'MiniMaxH3ReferenceToVideo',
    expectRefImages: 1,
  },
  {
    name: '参考图 + 首帧（AddGuide 分支）',
    shot: { durationSec: 3, ratio: '16:9', profile: 'P12-draft', mode: 'ref2va',
      refs: { images: [imgA] }, previz: { firstFramePath: imgB } },
    expectNode9: 'MiniMaxH3ReferenceToVideo',
    expectRefImages: 1,
    expectAddGuide: 1,
  },
];

for (const c of cases) {
  const { workflow: wf, error, job } = await assemble(c.shot);
  if (error) {
    check(false, `[${c.name}] 装配抛错：${error.message}`);
    continue;
  }
  if (!wf) {
    check(false, `[${c.name}] 没有捕获到提交的工作流`);
    continue;
  }

  const node9 = wf['9'];
  check(node9?.class_type === c.expectNode9,
    `[${c.name}] 节点 9 应为 ${c.expectNode9}，实际 ${node9?.class_type}`);

  if (c.expectNode9 === 'MiniMaxH3ImageToVideo') {
    const hasFirst = Boolean(node9.inputs.first_frame);
    const hasLast = Boolean(node9.inputs.last_frame);
    check(hasFirst === c.expectFirst,
      `[${c.name}] first_frame 期望 ${c.expectFirst}，实际 ${hasFirst}`);
    check(hasLast === c.expectLast,
      `[${c.name}] last_frame 期望 ${c.expectLast}，实际 ${hasLast}`);
  }

  if (c.expectRefImages) {
    const keys = Object.keys(node9.inputs).filter((k) => /^ref_images\.ref_image_\d+$/.test(k));
    check(keys.length === c.expectRefImages,
      `[${c.name}] ref_images 应有 ${c.expectRefImages} 个，实际 ${keys.length}`);
  }

  if (c.expectAddGuide) {
    const guides = Object.values(wf).filter((n) => n?.class_type === 'MiniMaxH3AddGuide');
    check(guides.length === c.expectAddGuide,
      `[${c.name}] AddGuide 应有 ${c.expectAddGuide} 个，实际 ${guides.length}`);
    // AddGuide 的 conditioning 必须真的被 Guider 消费
    const guider = wf['8'];
    check(Array.isArray(guider?.inputs?.conditioning) && guides.some((g) => Object.values(wf).includes(g)),
      `[${c.name}] BasicGuider 的 conditioning 未指向 AddGuide`);
  }

  // ---- 通用不变量 ----
  const g = new NodeGraph(wf);
  const links = g.validateLinks();
  check(links.ok, `[${c.name}] 存在悬空连线：${JSON.stringify(links.dangling.slice(0, 3))}`);

  // 不得残留模板占位符
  const raw = JSON.stringify(wf);
  check(!raw.includes('{{REF_IMAGE_1}}') && !raw.includes('{{REF_IMAGE_2}}'),
    `[${c.name}] 工作流里残留 {{REF_IMAGE_*}} 占位符`);
  check(!raw.includes('{{CONTROL_VIDEO}}') || raw.includes('"{{CONTROL_VIDEO}}"') === false,
    `[${c.name}] 工作流里残留 {{CONTROL_VIDEO}} 占位符`);

  // 输出节点必须在
  const hasSave = Object.values(wf).some((n) => n?.class_type === 'SaveVideo');
  check(hasSave, `[${c.name}] 缺少 SaveVideo 输出节点`);

  // 音频解码链路必须在（H3 是音画同步模型）
  const hasAudio = Object.values(wf).some((n) => n?.class_type === 'VAEDecodeAudio');
  check(hasAudio, `[${c.name}] 缺少 VAEDecodeAudio —— 产物会没有音轨`);
}

// ---------------------------------------------------------------- 结果
console.log(`H3 节点图装配测试：${checks} 项检查，${FAILS.length} 项失败`);
if (FAILS.length) {
  console.log('\n失败详情：');
  for (const f of FAILS) console.log('  -', f);
  process.exit(1);
}
console.log('OK');
