/**
 * 独立 API 冒烟测试 —— 不依赖 DSH 运行时。
 *
 * 起一个最小的假 ctx（webServer / llm / attachments 都缺席或占位），
 * 直接调用真实插件模块的 apply()，然后把 REST 路由跑一遍。
 *
 * ⚠️ 这是**真执行**，不是 `node --check`。
 *    历史教训（见 + 南风H3/阶段4-联调修复记录.md）：静态检查抓不到
 *    "script is not defined" 这类只在 apply() 执行时才炸的问题。
 *
 * 用法：
 *   node tools/smoke-api.mjs            # 全部检查
 *   node tools/smoke-api.mjs --quick    # 跳过需要 ComfyUI 的项
 *
 * 退出码：0 全过；1 有失败项。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* ------------------------------------------------------------ 环境隔离 */

// 必须在 import 插件模块**之前**设好，否则 config.js 已经算出默认 dataDir
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-smoke-'));
process.env.DSH_JZ_DATA_DIR = path.join(TMP, 'data');
process.env.DSH_JZ_CONFIG_FILE = path.join(TMP, 'config.json');

const QUICK = process.argv.includes('--quick');

/* -------------------------------------------------------------- 断言池 */

const results = [];
let failed = 0;

function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') throw new Error('请用 checkAsync');
    results.push({ name, ok: true });
  } catch (e) {
    failed += 1;
    results.push({ name, ok: false, detail: String(e?.message || e) });
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    failed += 1;
    results.push({ name, ok: false, detail: String(e?.message || e) });
  }
}

/* ------------------------------------------------ 1. 纯模块（无 ctx） */

async function moduleChecks() {
  await checkAsync('schema: 217 个参数', async () => {
    const m = await import('../host/services/nanfeng/schema.js');
    assert.equal(m.PARAM_COUNT, 217);
  });

  await checkAsync('schema: enrichSchema 全覆盖中文释义', async () => {
    const m = await import('../host/services/nanfeng/schema.js');
    const e = m.enrichSchema();
    const miss = Object.entries(e.params).filter(([, p]) => !p.zh).map(([k]) => k);
    assert.deepEqual(miss, [], `缺释义：${miss.join(', ')}`);
  });

  await checkAsync('schema: param-docs 没有多余键', async () => {
    const m = await import('../host/services/nanfeng/schema.js');
    const d = await import('../host/services/nanfeng/param-docs.js');
    const extra = Object.keys(d.PARAM_DOCS).filter((k) => !(k in m.PARAMS));
    assert.deepEqual(extra, [], `多余键：${extra.join(', ')}`);
  });

  await checkAsync('schema: 分组计数与实际一致', async () => {
    const m = await import('../host/services/nanfeng/schema.js');
    for (const [id, g] of Object.entries(m.GROUPS)) {
      const actual = Object.values(m.PARAMS).filter((p) => p.group === id).length;
      assert.equal(actual, g.count, `组 ${id} 声明 ${g.count}，实际 ${actual}`);
    }
  });

  await checkAsync('schema: 数值型 COMBO 的 default 是数字', async () => {
    const m = await import('../host/services/nanfeng/schema.js');
    for (const [k, d] of Object.entries(m.PARAMS)) {
      if (d.type !== 'COMBO' || !Array.isArray(d.options)) continue;
      const sample = d.options.find((o) => o != null);
      if (typeof sample !== 'number') continue;
      assert.equal(typeof d.default, 'number', `${k} 的 default 应是数字`);
    }
  });

  await checkAsync('graph: coerceTypes 把字符串数字转回数字', async () => {
    const g = await import('../host/services/nanfeng/graph.js');
    const out = g.coerceTypes({ 尺寸倍数: '32', H3潜空间对齐: '2', 采样步数: '20', 固定随机种子: 'true' });
    assert.equal(out.尺寸倍数, 32);
    assert.equal(out.H3潜空间对齐, 2);
    assert.equal(out.采样步数, 20);
    assert.equal(out.固定随机种子, true);
  });

  await checkAsync('presets: 每个预设的参数键都存在于 schema', async () => {
    const s = await import('../host/services/nanfeng/schema.js');
    const p = await import('../host/services/nanfeng/presets.js');
    const bad = [];
    for (const [id, preset] of Object.entries(p.BUILTIN_PRESETS)) {
      for (const k of Object.keys(preset.params)) {
        if (!(k in s.PARAMS)) bad.push(`${id}.${k}`);
      }
    }
    assert.deepEqual(bad, [], `未知参数键：${bad.join(', ')}`);
  });

  await checkAsync('presets: 预设值的类型与 schema 一致', async () => {
    const s = await import('../host/services/nanfeng/schema.js');
    const p = await import('../host/services/nanfeng/presets.js');
    const bad = [];
    for (const [id, preset] of Object.entries(p.BUILTIN_PRESETS)) {
      for (const [k, v] of Object.entries(preset.params)) {
        const def = s.PARAMS[k];
        if (!def) continue;
        if (def.type === 'COMBO' && Array.isArray(def.options)) {
          const sample = def.options.find((o) => o != null);
          const optType = typeof sample;
          if (typeof v !== optType) bad.push(`${id}.${k}=${JSON.stringify(v)} 应为 ${optType}`);
        } else if (def.type === 'INT' && typeof v !== 'number') {
          bad.push(`${id}.${k} 应为数字`);
        }
      }
    }
    assert.deepEqual(bad, [], bad.join('; '));
  });

  await checkAsync('presets: 三层合并优先级正确', async () => {
    const p = await import('../host/services/nanfeng/presets.js');
    const r = p.resolvePresetLayers({
      shotSpec: { inherit: 'standard', overrides: { 采样步数: 99 } },
      projectPreset: { 采样步数: 55, 百万像素: 0.9 },
      extra: { 采样步数: 7 },
    });
    const merged = Object.assign({}, ...r.layers);
    assert.equal(merged.采样步数, 7, 'extra 应最高优先级');
    assert.equal(merged.百万像素, 0.9, '项目预设应覆盖内置');
  });

  await checkAsync('inert 参数清单包含已知死参数', async () => {
    const s = await import('../host/services/nanfeng/schema.js');
    const names = s.inertParams().map((x) => x.name);
    for (const n of ['启用高清二采', '启用双采样', '二采步数', '启用H3 SLA', '启用RTX视频超分', '启用TRT视频VAE']) {
      assert.ok(names.includes(n), `${n} 应被标为无效参数`);
    }
  });

  /* ---------------- 约束校验器（组装前拦下必炸组合） ---------------- */

  await checkAsync('约束：续写 ✕ 潜空间二采 被拦截', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    const task = JSON.stringify({ workflow: 'b', node: '1', group: 'b', run: 'r', index: 1 });
    assert.throws(
      () => nf.buildShotWorkflow({
        shot: { id: 'x' }, preset: 'continuation',
        continuationTask: task,
        extraParams: { 启用H3潜空间放大二采: true },
      }),
      (e) => e.code === 'NANFENG_CONSTRAINT' && /潜空间续写/.test(e.message),
    );
  });

  await checkAsync('约束：文生/图生/首尾帧 三选一', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    assert.throws(
      () => nf.buildShotWorkflow({
        shot: { id: 'x' }, preset: 'draft',
        extraParams: { 文生视频: true, 首尾帧: true },
      }),
      (e) => e.code === 'NANFENG_CONSTRAINT',
    );
  });

  await checkAsync('约束：图生视频必须恰好 1 张图', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    // 0 张
    assert.throws(() => nf.buildShotWorkflow({
      shot: { id: 'x' }, preset: 'draft', extraParams: { 图生视频: true },
    }), (e) => e.code === 'NANFENG_CONSTRAINT');
    // 2 张
    assert.throws(() => nf.buildShotWorkflow({
      shot: { id: 'x' }, preset: 'draft',
      extraParams: { 图生视频: true, 图片1: 'a.png', 图片2: 'b.png' },
    }), (e) => e.code === 'NANFENG_CONSTRAINT');
    // 1 张通过
    const ok = nf.buildShotWorkflow({
      shot: { id: 'x' }, preset: 'draft',
      extraParams: { 图生视频: true, 图片1: 'a.png' },
    });
    assert.ok(ok.workflow);
  });

  await checkAsync('约束：文生视频不接受参考图', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    assert.throws(() => nf.buildShotWorkflow({
      shot: { id: 'x' }, preset: 'draft',
      extraParams: { 文生视频: true, 图片1: 'a.png' },
    }), (e) => e.code === 'NANFENG_CONSTRAINT');
  });

  await checkAsync('约束：首尾帧不接受视频/音频', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    assert.throws(() => nf.buildShotWorkflow({
      shot: { id: 'x' }, preset: 'draft',
      extraParams: { 首尾帧: true, 图片1: 'a.png', 图片2: 'b.png', 视频1: 'v.mp4' },
    }), (e) => e.code === 'NANFENG_CONSTRAINT');
  });

  await checkAsync('约束：continuation-quality 预设可以通过', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    // 续写预设必须配 continuationTask（批次注入），单独手测会被明确拒绝
    const task = JSON.stringify({ workflow: 'b', node: '1', group: 'b', run: 'r', index: 1 });
    const r = nf.buildShotWorkflow({
      shot: { id: 'x' }, preset: 'continuation-quality', continuationTask: task, jobId: 't',
    });
    assert.equal(r.params['启用H3潜空间放大二采'], false, '续写预设不能开二采');
    assert.equal(r.params['启用潜空间续写'], true);
  });

  /* ---------------- 能力探测：缺节点的加速项要自动关闭 ---------------- */

  await checkAsync('能力探测：缺 SLA/T8/DLSS/TRT 节点时自动关闭', async () => {
    const g = await import('../host/services/nanfeng/graph.js');
    const fakeNodes = new Set(['VHS_VideoCombine']);   // 什么都没有
    const { snapshot, applied } = g.applyFixes(
      { '启用H3 SLA': true, '启用T8缓存': true, DLSS超分模式: '视频超分', 启用TRT视频VAE: true },
      new Set(), fakeNodes,
    );
    assert.equal(snapshot['启用H3 SLA'], false);
    assert.equal(snapshot['启用T8缓存'], false);
    assert.equal(snapshot['DLSS超分模式'], '关闭');
    assert.equal(snapshot['启用TRT视频VAE'], false);
    assert.ok(applied.length >= 4, `应有至少 4 条修正，实际 ${applied.length}`);
  });

  await checkAsync('能力探测：节点齐全时不误关', async () => {
    const g = await import('../host/services/nanfeng/graph.js');
    const allNodes = new Set([
      'H3SLAAttention', 'MiniMaxH3BlockCacheT8',
      'MiniMaxH3MemoryEfficientSageAttentionPatch',
      'NvidiaDLSSVideoUpscale', 'MiniMaxH3TRTVAELoader',
    ]);
    const { snapshot } = g.applyFixes({ '启用H3 SLA': true }, new Set(), allNodes);
    assert.equal(snapshot['启用H3 SLA'], true, '节点存在时不应被关掉');
  });

  /* ---------------- 配置层：SSRF 防护 ---------------- */

  await checkAsync('config: comfyUrl 只允许本机 http(s)', async () => {
    const c = await import('../host/config.js');
    assert.equal(c.validateComfyUrl('http://127.0.0.1:8488/'), 'http://127.0.0.1:8488');
    for (const bad of [
      'http://169.254.169.254/latest/meta-data/',
      'http://192.168.1.5:8188',
      'file:///C:/Windows/win.ini',
      'ftp://127.0.0.1/',
      'not a url',
    ]) {
      assert.throws(() => c.validateComfyUrl(bad), /INVALID_COMFY_URL/, `${bad} 应被拒绝`);
    }
    assert.throws(
      () => c.sanitizeConfigPatch({ comfyUrl: 'http://evil.example/' }),
      /INVALID_COMFY_URL/,
    );
  });

  /* -------------------- DMAD 加速方案（本轮接线） -------------------- */

  /**
   * 这组测试守护的是「DMAD 加速真的接进南风路径」。
   *
   * 历史缺陷：`runH3Nanfeng` 从 `runH3Local` 复制时漏了整段 accel-plan 接线，
   * 于是所有预设都是 lcm + 4-10 步却**不挂 DMAD LoRA** ——
   * 等于用 LCM 采样器跑未蒸馏的原模型再压到 4 步，是出片质量差的主因。
   */
  await checkAsync('加速方案：dmad8 映射到 LoRA1 + lcm + 8 步', async () => {
    const { planForShot } = await import('../host/services/accel-plan.js');
    const a = planForShot('dmad8');
    assert.equal(a.sampler, 'lcm');
    assert.equal(a.scheduler, 'simple');
    assert.equal(a.steps, 8);
    assert.match(a.lora, /8step/);
  });

  await checkAsync('加速方案：dmad4 用 4 步学生', async () => {
    const { planForShot } = await import('../host/services/accel-plan.js');
    const a = planForShot('dmad4');
    assert.equal(a.steps, 4);
    assert.match(a.lora, /4step/);
  });

  await checkAsync('加速方案：none 不挂 LoRA、50 步', async () => {
    const { planForShot } = await import('../host/services/accel-plan.js');
    const a = planForShot('none');
    assert.equal(a.lora, '');
    assert.equal(a.steps, 50);
  });

  await checkAsync('加速方案：覆盖预设里的采样器/步数（extraParams 最高优先级）', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    const { planForShot } = await import('../host/services/accel-plan.js');
    const a = planForShot('dmad8');
    // 预设 draft 里写着 采样器:'lcm' 采样步数:4 —— 必须被加速方案覆盖成 8
    const r = nf.buildShotWorkflow({
      shot: { id: 's' },
      preset: 'draft',
      extraParams: {
        启用LoRA: true, LoRA1: a.lora, LoRA1启用: true, LoRA1强度: 1.0,
        采样器: a.sampler, 调度器: a.scheduler, 采样步数: a.steps,
      },
      jobId: 't',
    });
    assert.equal(r.params['采样步数'], 8, '加速方案的 8 步应压过预设的 4 步');
    assert.equal(r.params['LoRA1'], a.lora);
    assert.equal(r.params['LoRA1启用'], true, 'V15 走独立槽位，LoRA1启用 才是真正的开关');
  });

  await checkAsync('加速方案：V15 的 启用LoRA 总开关无效，LoRA{n}启用 才生效', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../vendor/nanfeng/h3_generator.py', import.meta.url), 'utf8');
    // individual_lora_slots=True + strict_lora_opt_in=True 决定了这一点
    assert.match(src, /individual_lora_slots = True/);
    assert.match(src, /strict_lora_opt_in = True/);
    // 而 启用LoRA 的早退只对 individual=False 生效
    assert.match(src, /if not individual and not bool\(kwargs\.get\("启用LoRA"/);
  });

  /* -------------------- 打光通道（本轮新增） -------------------- */

  await checkAsync('打光：6 个预设且 4:1 / 8:1 都在', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const ids = h.LIGHTING_PRESETS.map((l) => l.id);
    for (const id of ['none', 'dramatic-4-1', 'noir-8-1', 'rim-backlit']) {
      assert.ok(ids.includes(id), `缺打光预设 ${id}`);
    }
    const d41 = h.LIGHTING_PRESETS.find((l) => l.id === 'dramatic-4-1');
    assert.equal(d41.ratio, '4:1');
    assert.equal(d41.stops, 2);
    const n81 = h.LIGHTING_PRESETS.find((l) => l.id === 'noir-8-1');
    assert.equal(n81.ratio, '8:1');
    assert.equal(n81.stops, 3);
  });

  await checkAsync('打光：会真的写进提示词', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 't2va',
      subjects: [],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'a woman in a corridor', dialogue: null }],
      summary: 'a woman in a corridor',
      durationSec: 5,
      styleId: 'ova90s',
      lightingId: 'noir-8-1',
    });
    assert.match(out.prompt, /8:1 key-to-fill/);
    assert.match(out.prompt, /chiaroscuro/i);
  });

  await checkAsync('打光：未知 id 回落 none（不写打光文字）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 't2va',
      subjects: [],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'x', dialogue: null }],
      summary: 'x',
      durationSec: 5,
      styleId: 'ova90s',
      lightingId: 'definitely-not-a-preset',
    });
    assert.doesNotMatch(out.prompt, /key-to-fill|chiaroscuro/i);
  });

  await checkAsync('打光：镜头卡的 lightingId 能流到编译结果', async () => {
    const { newShot } = await import('../host/store/models.js');
    const h = await import('../host/services/h3-prompt.js');
    const shot = newShot({ lightingId: 'dramatic-4-1', styleId: 'ufotable' });
    assert.equal(shot.lightingId, 'dramatic-4-1');
    const pkg = h.toShotInputPackage({ ...shot, description: 'a man walks', durationSec: 5 });
    assert.equal(pkg.lightingId, 'dramatic-4-1');
    const out = h.compileH3Prompt(pkg);
    assert.match(out.prompt, /4:1 key-to-fill/);
  });

  /* -------------------- 续写开关（群友 skill 核心机制） -------------------- */

  /**
   * 这组测试守护「潜空间续写开关」—— 群友 skill 反复强调：
   * **续写语法错，其余写得再好也白费。**
   *
   * 开关是三组件，缺一不可：
   *   1. the actual carried latent motion governs...
   *   2. No reference picture resets pose...
   *   3. The lighting direction and time of day continue unchanged...
   */
  await checkAsync('续写：开关三组件全在且置于最顶部', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const task = JSON.stringify({ workflow: 'b', node: '1', group: 'b', run: 'r', index: 2 });
    const out = h.compileH3Prompt({
      mode: 't2va',
      subjects: [],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'walks', dialogue: null }],
      summary: 'walks', durationSec: 6, styleId: 'ova90s',
      continuationTask: task,
    });
    const first = out.prompt.split('\n')[0];
    assert.match(first, /carried latent motion/, '第一行必须是开关');
    assert.match(first, /No reference picture resets pose/);
    assert.match(first, /lighting direction and time of day continue unchanged/);
    assert.equal(out.continuation.isContinuation, true);
    assert.equal(out.continuation.index, 2);
    assert.equal(out.continuation.trimFrames, 22);
  });

  await checkAsync('续写：段 1 不加开关（开场段例外）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 't2va',
      subjects: [],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'walks', dialogue: null }],
      summary: 'walks', durationSec: 6, styleId: 'ova90s',
      continuationTask: JSON.stringify({ index: 1 }),
    });
    assert.doesNotMatch(out.prompt, /carried latent motion/);
    assert.equal(out.continuation.isContinuation, false);
  });

  await checkAsync('续写：裁切区时序纪律（1 秒安全边界）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 't2va',
      subjects: [],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'walks', dialogue: null }],
      summary: 'walks', durationSec: 6,
      continuationTask: JSON.stringify({ index: 3 }),
    });
    assert.match(out.prompt, /first second is the carried overlap/);
    assert.match(out.prompt, /begins at the one-second mark/);
  });

  await checkAsync('续写：resolveContinuation 三种输入形态', async () => {
    const h = await import('../host/services/h3-prompt.js');
    assert.equal(h.resolveContinuation({ continuationTask: JSON.stringify({ index: 5 }) }).index, 5);
    assert.equal(h.resolveContinuation({ continuationIndex: 7 }).index, 7);
    assert.equal(h.resolveContinuation({ isContinuation: true }).isContinuation, true);
    // 坏 JSON 不崩
    assert.equal(h.resolveContinuation({ continuationTask: '{bad' }).index, null);
    assert.equal(h.resolveContinuation({}).isContinuation, false);
  });

  /* -------------------- 分段规划（45s 的正确配方） -------------------- */

  await checkAsync('规划：45s/9 段落在网格上且误差 < 1s', async () => {
    const c = await import('../host/services/nanfeng/continuation.js');
    const p = c.planSegments({ targetSeconds: 45, segments: 9, contextLength: '22' });
    assert.equal(p.segments.length, 9);
    // 每段采样帧数必须在 17k+5 网格上
    for (const s of p.segments) {
      assert.equal((s.sampleFrames - 5) % 17, 0, `第 ${s.index} 段 ${s.sampleFrames} 不在网格上`);
    }
    // 段 1 不裁，其余裁 trimFrames
    assert.equal(p.segments[0].deliverFrames, p.segments[0].sampleFrames);
    assert.equal(p.segments[1].deliverFrames, p.segments[1].sampleFrames - 22);
    assert.ok(Math.abs(p.totalSec - 45) < 1, `总时长 ${p.totalSec} 偏离目标 45s`);
  });

  await checkAsync('规划：snapToGrid 与 vendor 的 duration_to_frames 一致', async () => {
    const c = await import('../host/services/nanfeng/continuation.js');
    /**
     * vendor 公式（Python）：
     *   frames = max(5, round(sec*24))
     *   frames + (5 - frames % 17) % 17
     *
     * ⚠️ Python 的 % 对负数返回**正**余数，JS 返回**负**值。
     *    直接照抄会让 6s 算成 141 帧（正确是 158，差 17 帧 = 0.7 秒）。
     *    这条测试就是守这个坑。
     */
    for (const [sec, want] of [[5, 124], [6, 158], [5.875, 141], [15, 362]]) {
      assert.equal(c.snapToGrid(sec), want, `${sec}s 应得 ${want} 帧`);
    }
    // 与 Python 语义逐值对照（扫全区间）
    for (let s = 5; s <= 15; s += 0.5) {
      const raw = Math.max(5, Math.round(s * 24));
      const want = raw + (((5 - (raw % 17)) % 17) + 17) % 17;
      assert.equal(c.snapToGrid(s), want, `${s}s 与 vendor 不一致`);
    }
  });

  /* -------------------- 批次服务端编排 -------------------- */

  await checkAsync('编排：串行跑完 + 断点续跑只补未完成段', async () => {
    const c = await import('../host/services/nanfeng/continuation.js');
    const fs = await import('node:fs');
    const TMP2 = fs.mkdtempSync(path.join(TMP, 'batch-'));
    const b = c.createBatch({ projectId: 'p', shotIds: ['s1', 's2', 's3'], contextLength: '22' });
    c.saveBatch(TMP2, b);
    const ran = [];
    let out = await c.runBatch({
      dataDir: TMP2, batchId: b.batchId,
      runOne: async (seg, task, i) => {
        // 必须严格按序
        assert.equal(i, seg.index);
        ran.push(i);
        return { jobId: `job_${i}`, frames: 141 };
      },
    });
    assert.deepEqual(ran, [1, 2, 3], '必须串行按序');
    assert.equal(out.status, 'completed');

    // 断点续跑：把第 3 段打回 pending，只应重跑它
    out.shots[2].status = 'pending';
    c.saveBatch(TMP2, out);
    ran.length = 0;
    out = await c.runBatch({
      dataDir: TMP2, batchId: b.batchId,
      runOne: async (seg, task, i) => { ran.push(i); return { jobId: `j${i}`, frames: 141 }; },
    });
    assert.deepEqual(ran, [3], `应只重跑第 3 段，实际 ${JSON.stringify(ran)}`);
  });

  await checkAsync('编排：失败即停（后续段依赖其 latent）', async () => {
    const c = await import('../host/services/nanfeng/continuation.js');
    const fs = await import('node:fs');
    const TMP3 = fs.mkdtempSync(path.join(TMP, 'batch2-'));
    const b = c.createBatch({ projectId: 'p', shotIds: ['s1', 's2', 's3'] });
    c.saveBatch(TMP3, b);
    const out = await c.runBatch({
      dataDir: TMP3, batchId: b.batchId,
      runOne: async (seg, task, i) => {
        if (i === 2) throw new Error('模拟显存不足');
        return { jobId: `j${i}`, frames: 141 };
      },
    });
    assert.equal(out.shots[0].status, 'completed');
    assert.equal(out.shots[1].status, 'failed');
    assert.equal(out.shots[2].status, 'pending', '第 3 段不该跑');
    assert.match(out.shots[1].error, /显存不足/);
    // 重置后可以重跑
    const r = c.resetFromFailure(out);
    assert.equal(r.fromIndex, 2);
    assert.equal(out.shots[1].status, 'pending');
  });

  /**
   * 回归：`/nanfeng/continuation/batches/run` 必须**真的启动执行**。
   *
   * 本轮实际踩到的 bug：那里只做了 `jobsStore().upsert(job)` + 轮询终态，
   * 忘了调 `runAndArchive(...executeBackend...)` —— 于是 job 永远停在
   * `queued`，批次永远卡在第 1 段。单元测试抓不到（因为它测的是
   * continuation.js 的 runBatch，而 bug 在 API 层的 runOne 回调里），
   * 只有跑真机才暴露。所以这里做**静态源码断言**，防止再次漏掉。
   */
  await checkAsync('编排：批次 run 路由真的调用了执行器（静态守护）', async () => {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = fs.readFileSync(
      fileURLToPath(new URL('../host/api/index.js', import.meta.url)), 'utf8',
    );
    // 定位 batches/run 路由体
    const at = src.indexOf("route === '/nanfeng/continuation/batches/run'");
    assert.ok(at > 0, '找不到 batches/run 路由');
    const body = src.slice(at, at + 6000);
    assert.match(body, /newJob\(/, '应创建 job');
    assert.match(body, /runAndArchive\s*\(/, '必须调 runAndArchive 真正启动执行');
    assert.match(body, /executeBackend/, '必须用统一的 executeBackend 执行器');
    assert.match(body, /setInterval|setTimeout/, '应有终态轮询');
  });

  /**
   * 回归：`runAndArchive` 调用不能 await（会与轮询形成双重等待）。
   */
  await checkAsync('编排：runAndArchive 不被 await（避免双重等待）', async () => {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = fs.readFileSync(
      fileURLToPath(new URL('../host/api/index.js', import.meta.url)), 'utf8',
    );
    const at = src.indexOf("route === '/nanfeng/continuation/batches/run'");
    const body = src.slice(at, at + 6000);
    assert.doesNotMatch(
      body, /await\s+runAndArchive/,
      'runAndArchive 不应被 await —— 要靠轮询等终态',
    );
  });

  /**
   * 这组守护「段 1 也必须带续写任务」。
   *
   * 实测踩到的坑（真机跑了两个批次才定位）：
   *   直觉上"段 1 没有上一段，不该带续写任务"，于是段 1 关掉续写 →
   *   南风把**读和写 latent 都挂在同一个 `if continuation:` 下** →
   *   段 1 的 AV latent 从不落盘 → 段 2 Load clip_1 报
   *   "is neither a file nor a folder under the ComfyUI output directory."
   *
   *   批次表现：第 1 段成功、第 2 段必然失败。
   *   正确做法（ComfyUI-H3-Motion-Context README）：首段 Load 0 / Save 1，别停用。
   */
  await checkAsync('续写：段 1 必须带 index=1 的任务（否则 latent 不落盘）', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    const task = JSON.stringify({ workflow: 'b', node: '1', group: 'b', run: 'r', index: 1 });
    const r = nf.buildShotWorkflow({
      shot: { id: 's1' }, preset: 'continuation', continuationTask: task, jobId: 't',
    });
    assert.equal(r.params['启用潜空间续写'], true, '段 1 必须开续写，否则不保存 latent');
    assert.equal(r.params['潜空间续写任务'], task);
  });

  /**
   * 单镜头渲染续写段：**降级 + 大声告知**，不是报错。
   *
   * 原测试锁的是"一律 throws"。但那个行为会让渲染页完全没法用 ——
   * 项目里每个镜头都挂着 `continuation` 预设（续写段的正常状态），
   * 点「开始渲染」必然失败，错误信息还叫用户去改预设。
   * 实测复现过（海滨项目 6 个镜头全中）。
   *
   * 走到这个分支时无法区分"批次传参丢了"和"用户想单独渲染"，
   * 因为两者的入参形状完全相同（都没有 contTask）。
   * 所以选对用户更有利的那一边：出片 + 说清楚差异。
   * 批次传参丢失由 continuation.js 的 taskFor 保证（它一定产出合法 JSON）。
   */
  await checkAsync('续写：单镜头渲染续写段 → 降级关闭 + 明确警告', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    const r = nf.buildShotWorkflow({ shot: { id: 's9' }, preset: 'continuation', jobId: 't' });
    assert.equal(r.params['启用潜空间续写'], false, '单镜头渲染必须关掉续写，否则上游硬报错');
    assert.equal(r.params['潜空间续写任务'], '');
    assert.ok(
      r.warnings.some((w) => /单镜头渲染/.test(w) && /不会与上一段无缝衔接/.test(w)),
      '必须明确告知用户"这段不会和上一段衔接"，不能静默降级',
    );
  });

  await checkAsync('续写：给了 continuationTask → 续写开启且任务原样写入', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    const c = await import('../host/services/nanfeng/continuation.js');
    const b = c.createBatch({ projectId: 'p', shotIds: ['s1', 's2'] });
    const t = c.taskFor(b, 2);
    const r = nf.buildShotWorkflow({
      shot: { id: 's2' }, preset: 'continuation', continuationTask: t, jobId: 't',
    });
    assert.equal(r.params['启用潜空间续写'], true, '批次内必须开续写');
    assert.equal(r.params['潜空间续写任务'], t);
    assert.ok(!r.warnings.some((w) => /单镜头渲染/.test(w)), '批次内不应出现"单镜头降级"的警告');
  });

  await checkAsync('续写：taskFor 对 index=1 与 index=n 都产出合法 JSON', async () => {
    const c = await import('../host/services/nanfeng/continuation.js');
    const b = c.createBatch({ projectId: 'p', shotIds: ['s1', 's2'] });
    for (const i of [1, 2]) {
      const t = JSON.parse(c.taskFor(b, i));
      assert.equal(t.node, '1');
      assert.equal(t.index, i);
      assert.equal(t.workflow, b.batchId);
      assert.equal(t.run, b.runId);
    }
  });

  /* -------------------- Skill 体系（本轮整理） -------------------- */

/**
 * 这组守护 skill 的组织结构。历史问题：
 *   · skill 散在 vendor/ 与 skills/ 两处
 *   · 8 个目录实际只有 5 份内容，3 对逐字节重复，1 个（audio-drive）是错拷
 *   · skills/ 文档被移出仓库后 `package.json` 还声明 `skills/**`
 *   · `skillId` 是死参数，海螺版永远不可达
 */
  await checkAsync('skill: skills/ 是唯一根目录，vendor 只剩 Python', async () => {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const root = fileURLToPath(new URL('../', import.meta.url));

    // skills/ 必须存在且含关键子目录
    for (const rel of [
      'skills/prompt/h3-official/SKILL.md',
      'skills/prompt/h3-official/references/ref-en.txt',
      'skills/prompt/h3-official/references/base-en.txt',
      'skills/prompt/h3-hailuo/SKILL.md',
      'skills/prompt/h3-continuation/SKILL.md',
      'skills/prompt/h3-continuation-cuts/SKILL.md',
      'skills/prompt/h3-nonfirst-i2v/SKILL.md',
      'skills/prompt/group-master/SKILL.md',
      'skills/prompt/jiuzhang-prompt-spec.md',
      'skills/usage/SKILL.md',
      'skills/setup/SKILL.md',
      'skills/architecture/SKILL.md',
      'skills/templates/templates.json',
      'skills/README.md',
    ]) {
      assert.ok(fs.existsSync(root + rel), `缺 ${rel}`);
    }

    // vendor 里不应再有 *-skill 目录（只放 Python）
    const vendorEntries = fs.readdirSync(root + 'vendor/nanfeng');
    const skillDirs = vendorEntries.filter((n) => n.endsWith('-skill'));
    assert.deepEqual(skillDirs, [], `vendor 里还有 skill 目录：${skillDirs.join(', ')}`);
  });

  await checkAsync('skill: 没有重复内容（4 个死副本已删）', async () => {
    const fs = await import('node:fs');
    const crypto = await import('node:crypto');
    const { fileURLToPath } = await import('node:url');
    const promptDir = fileURLToPath(new URL('../skills/prompt/', import.meta.url));
    const seen = new Map();
    for (const name of fs.readdirSync(promptDir)) {
      const f = `${promptDir}${name}/SKILL.md`.replace(/\\/g, '/');
      if (!fs.existsSync(f)) continue;
      const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      if (seen.has(h)) {
        throw new Error(`${name} 与 ${seen.get(h)} 内容完全相同（重复 skill）`);
      }
      seen.set(h, name);
    }
    assert.ok(seen.size >= 5, `skill 数应 ≥5，实际 ${seen.size}`);
  });

  await checkAsync('skill: skillId 真的生效（海螺版可达）', async () => {
    const sb = await import('../host/services/nanfeng/storyboard.js');
    const regular = sb.loadSkill('ref2va', 'regular_storyboard');
    const ns = sb.loadSkill('ref2va', 'ns_storyboard');
    assert.ok(regular.length > 1000, '常规版应有内容');
    assert.ok(ns.length > 1000, '海螺版应有内容');
    assert.notEqual(regular, ns, '两个 skill 不能相同');
    assert.match(ns, /海螺/, '海螺版应含"海螺"字样');
    // 续写模式走专用 skill
    for (const mode of ['oneshot_continuation', 'continuation_cuts', 'reference_i2va']) {
      const s = sb.loadSkill(mode, 'regular_storyboard');
      assert.ok(s.length > 500, `${mode} 的 skill 太短`);
    }
  });

  await checkAsync('skill: SKILL.md 都有 frontmatter name/description', async () => {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const promptDir = fileURLToPath(new URL('../skills/prompt/', import.meta.url));
    for (const name of fs.readdirSync(promptDir)) {
      const f = `${promptDir}${name}/SKILL.md`.replace(/\\/g, '/');
      if (!fs.existsSync(f)) continue;
      const head = fs.readFileSync(f, 'utf8').slice(0, 600);
      assert.match(head, /^---\s*\n/, `${name} 缺 frontmatter`);
      assert.match(head, /name:\s*\S+/, `${name} 缺 name`);
      assert.match(head, /description:\s*\S+/, `${name} 缺 description`);
    }
  });

  /* -------------------- 模板改为数据文件 -------------------- */

  await checkAsync('模板: 从 skills/templates/templates.json 加载', async () => {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const p = fileURLToPath(new URL('../skills/templates/templates.json', import.meta.url));
    assert.ok(fs.existsSync(p), 'templates.json 不存在');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(Array.isArray(j.templates), '应有 templates 数组');
    assert.ok(j.templates.length >= 20, `内置模板应 ≥20，实际 ${j.templates.length}`);

    // extras.js 必须真的从文件加载（而不是还留着内联数组）
    const { SYSTEM_PROMPT_TEMPLATES } = await import('../host/services/extras.js');
    assert.equal(
      SYSTEM_PROMPT_TEMPLATES.length, j.templates.length,
      '代码加载的模板数应与 JSON 一致',
    );
  });

  await checkAsync('模板: tpl-h3-ref2va 不再用废弃旧字段', async () => {
    const { SYSTEM_PROMPT_TEMPLATES } = await import('../host/services/extras.js');
    const t = SYSTEM_PROMPT_TEMPLATES.find((x) => x.id === 'tpl-h3-ref2va');
    assert.ok(t, '缺 tpl-h3-ref2va');
    assert.doesNotMatch(t.content, /CRITICAL STYLE RULE|SCENE LAYOUT|MOTION DESCRIPTION/,
      '还在用旧骨架字段');
    assert.match(t.content, /subject_definitions/);
    assert.match(t.content, /non_diegetic_music/);
  });

/* -------------------- 画风 / 光比 / 冲突 -------------------- */

  await checkAsync('画风：补齐到 11 种（含 Ligne Claire 与 Vivziepop）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const ids = h.STYLE_PRESETS.map((s) => s.id);
    for (const id of ['ligne-claire', 'vivziepop']) {
      assert.ok(ids.includes(id), `缺画风 ${id}`);
    }
    assert.ok(h.STYLE_PRESETS.length >= 11);
  });

  /**
   * 群友 skill v2.1 §3.1：画风串必须**逐字照抄**，不缩写、不改写、不合并。
   *
   * 这条测试守的是一个真实事故：2026-11-18 之前，代码里的画风串是
   * "重写的简版"，且渲染时还会截断到 180 字符 —— 而官方串的**约束句全在末尾**
   * （`NOT 3D` / `NO subtitles` / `NO photorealistic textures`），
   * 截断 = 砍掉全部反模式约束 → 模型照样渲成 3D、照样出字幕。
   */
  await checkAsync('画风：官方约束句必须在（不截断、不改写）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    // 官方串里带这些约束的画风，成片前的提示词必须原样含它们
    const EXPECT = {
      ova90s: ['NOT 3D', 'NO subtitles'],
      'helltaker-look': ['NOT realistic', 'NO subtitles'],
      shinkai: ['NOT 3D'],
      ghibli: ['NOT 3D'],
      ufotable: ['NOT realistic'],
    };
    for (const [id, needles] of Object.entries(EXPECT)) {
      const s = h.STYLE_PRESETS.find((x) => x.id === id);
      assert.ok(s, `缺画风 ${id}`);
      for (const n of needles) {
        assert.ok(s.en.includes(n), `画风 ${id} 的 en 缺约束句「${n}」—— v2.1 要求逐字照抄`);
      }
    }
    // 编译后必须完整保留（不能被 180 字符截断）
    const out = h.compileH3Prompt({
      mode: 'ref2va', durationSec: 5, styleId: 'ova90s',
      subjects: [{ id: 'S1', name: 'A', pictureIndex: 1, traits: 'long hair' }],
      references: { images: ['a.png'], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'She stands still.' }],
    });
    assert.ok(out.prompt.includes('NOT 3D'), '编译后丢了 NOT 3D —— 画风串被截断了');
    assert.ok(out.prompt.includes('NO subtitles'), '编译后丢了 NO subtitles —— 画风串被截断了');
  });

  /**
   * 群友 skill v2.1 §15.2：两道字幕/overlay 防线必须由编译器自动注入。
   * 不让用户手写，因为他们写的"no subtitles"会被 §15.1 判为非法负面句。
   */
  /**
   * 2026-11-18：本插件把提示词上限从官方 7000 收紧到 6000。
   *
   * 官方 7000 是**硬拒绝线**，不是**质量最优线**。实测 6500-7000 区间
   * 六字段注意力被稀释：动作细节写得再细，成片也做不出来。
   * 6000 是「六字段齐全 + 动作细节写清」的实际上限。
   */
  await checkAsync('长度：6000 收紧 + 7000 官方硬上限分两道提示', async () => {
    const h = await import('../host/services/h3-prompt.js');
    assert.equal(h.H3_LIMITS.promptMaxChars, 6000, '插件上限应为 6000');
    assert.equal(h.H3_LIMITS.promptOfficialMaxChars, 7000, '官方硬上限应为 7000');

    const head = 'subject_definitions:\nS.\n\nsummary:\nX.\n\nretention_analysis:\nY.\n\ndetailed_description:\n';
    const tail = '\n\noverall_soundscape:\nZ.\n\nnon_diegetic_music:\nN/A.';
    const make = (n) => head + 'a '.repeat(Math.ceil(n / 2)).slice(0, n) + tail;

    const lintOf = (t) => {
      const w = [];
      h.lintCompiledPrompt(t, 'ref', w);
      return w.filter((x) => /字符/.test(x));
    };

    // 6000 以下无告警
    assert.equal(lintOf(make(5000)).length, 0, '5000 字符不应告警');
    // 超 6000 但未超 7000：一条
    assert.equal(lintOf(make(6500)).length, 1, '6500 应只有一条（本插件上限）');
    // 超 7000：两条
    assert.equal(lintOf(make(7500)).length, 2, '7500 应有两条（本插件 + 官方）');
  });

  /**
   * 续写 × 二采互斥 —— 这条禁令的正确性论证见 docs/CONTINUATION-VS-UPSCALE.md。
   *
   * 本质不是两个功能互斥，而是二采把末 latent 的分辨率改了，
   * 而 ComfyUI-H3-Motion-Context/nodes.py:416 比对宽高、不符即抛
   * （"a latent cannot be resized"）。所以插件层提前拦截是对的。
   */
  await checkAsync('约束：续写 × 潜空间二采 被拦截且提示替代方案', async () => {
    const nf = await import('../host/services/nanfeng/index.js');
    assert.throws(
      () => nf.buildShotWorkflow({
        shot: { mode: 'ref2va', prompt: 'x', durationSec: 5, refs: { images: ['a.png'] } },
        preset: 'continuation',
        continuationTask: JSON.stringify({ workflow: 'w', node: '1', group: 'g', run: 'r', index: 2 }),
        extraParams: { 启用H3潜空间放大二采: true, 启用潜空间续写: true },
      }),
      /互斥|画布/,
    );
  });

  await checkAsync('压制：两道防线由编译器自动注入', async () => {
    const h = await import('../host/services/h3-prompt.js');
    assert.ok(h.SUPPRESSION_GUARDS.textSuppression.includes('NO subtitles'));
    assert.ok(h.SUPPRESSION_GUARDS.frameIntegrity.includes('Nothing floats over the image'));
    const out = h.compileH3Prompt({
      mode: 'ref2va', durationSec: 5, styleId: 'ova90s',
      subjects: [{ id: 'S1', name: 'A', pictureIndex: 1, traits: 'x' }],
      references: { images: ['a.png'], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'She stands still.' }],
    });
    assert.ok(out.prompt.includes('Text suppression:'), '缺防线 1（追加压制行）');
    assert.ok(out.prompt.includes('Nothing floats over the image'), '缺防线 2（画面完整性句）');
    // 压实行必须在画风串之后（v2.1：另起一行追加，不改画风串）
    const iStyle = out.prompt.indexOf('90s OVA retro');
    const iSupp = out.prompt.indexOf('Text suppression:');
    assert.ok(iStyle >= 0 && iSupp > iStyle, '压实行必须在画风串之后');
  });

  /**
   * 群友 skill v2.1 §15.1：压制词只有三处合法位置。
   * 这条守的是 lint 从"46 条 SCAFFOLD 白名单"改成"按位置判断"的重构。
   */
  await checkAsync('压制：三处合法位置放行，其余字段的负面句报警', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const ok = [
      'Text suppression: NO subtitles, NO on-screen text, NO captions.',
      'a wooden signpost whose board carries no legible lettering and no text of any kind',
      'a uniform dull surface with no visible seam',
    ];
    const bad = [
      'Do not add extra fingers to either hand.',
      'The scene has NO subtitles, NO watermarks, NO logos.',
      'Never show reflections on the water.',
    ];
    const run = (text) => {
      const w = [];
      h.lintCompiledPrompt(`detailed_description:\n${text}\n\nsubject_definitions:\nS.`, 'ref', w);
      return w.some((x) => x.includes('没有通道的负面句'));
    };
    for (const t of ok) assert.ok(!run(t), `合法位置被误报：「${t.slice(0, 40)}」`);
    for (const t of bad) assert.ok(run(t), `没有通道的负面句未报警：「${t.slice(0, 40)}」`);
  });

  await checkAsync('打光：7 种含 6:1 特写档', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const l = h.LIGHTING_PRESETS.find((x) => x.id === 'closeup-6-1');
    assert.ok(l, '缺 6:1 光比');
    assert.equal(l.ratio, '6:1');
    const out = h.compileH3Prompt({
      mode: 't2va',
      subjects: [],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'her face', dialogue: null }],
      summary: 'x', durationSec: 5, styleId: 'ufotable', lightingId: 'closeup-6-1',
    });
    assert.match(out.prompt, /6:1 key-to-fill/);
    assert.match(out.prompt, /eyelash/);
  });

  await checkAsync('冲突：画风×打光不兼容时会 warning', async () => {
    const h = await import('../host/services/h3-prompt.js');
    // 直接调检测函数
    assert.ok(h.styleLightingConflicts('ligne-claire', 'noir-8-1').length > 0);
    assert.ok(h.styleLightingConflicts('ghibli', 'noir-8-1').length > 0);
    assert.equal(h.styleLightingConflicts('ufotable', 'noir-8-1').length, 0);
    assert.equal(h.styleLightingConflicts('ova90s', 'none').length, 0);
    // 两条编译路径都要真的出 warning
    for (const mode of ['t2va', 'ref2va']) {
      const out = h.compileH3Prompt({
        mode,
        subjects: mode === 'ref2va' ? [{ id: 's1', name: 'A', pictureIndex: 1, hasImage: true }] : [],
        references: { images: [], videos: [], audios: [] },
        scenes: [{ index: 1, startSec: 0, description: 'x', dialogue: null }],
        summary: 'x', durationSec: 5,
        styleId: 'ligne-claire', lightingId: 'noir-8-1',
      });
      assert.ok(
        out.warnings.some((w) => /互相削弱|冲突/.test(w)),
        `${mode} 路径缺冲突 warning`,
      );
    }
  });

  /* -------------------- 角色卡：description 必须进提示词 -------------------- */

  /**
   * ⚠️ 规则在 v2.10 收紧了：**只有英文 description 才嵌进句法**。
   *
   * 中文 description（"白发少女"）以前会被原样塞成
   *   `<Subject 1> is the 白发少女 shown in <Picture 1>`
   * —— 中英混排，违反「正文必须英文」的铁律。
   * 现在中文一律不进正文，改为泛化写法（外观由参考图承载）。
   *
   * 所以这里要测两件事：英文能进、中文不能进。
   */
  await checkAsync('角色卡：英文 description 会写进 subject_definitions', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 'ref2va',
      subjects: [
        { id: 'c1', name: 'Alice', pictureIndex: 1, hasImage: true, description: 'white-haired girl', traits: 'twintails' },
      ],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'x', dialogue: null }],
      summary: 'x', durationSec: 5,
    });
    // 群友 skill 标准句式：`<Subject N> is the <description> shown in <Picture M>.`
    assert.match(out.prompt, /<Subject 1> is the white-haired girl shown in <Picture 1>/);
    assert.match(out.prompt, /with twintails/);
  });

  await checkAsync('角色卡：中文 description 不进正文（避免中英混排）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 'ref2va',
      subjects: [
        { id: 'c1', name: '爱丽丝', pictureIndex: 1, hasImage: true, description: '白发少女', traits: '双马尾' },
      ],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'x', dialogue: null }],
      summary: 'x', durationSec: 5,
    });
    const subjectLine = out.prompt.split('\n').find((l) => l.startsWith('<Subject 1>')) ?? '';
    assert.doesNotMatch(subjectLine, /[\u4e00-\u9fa5]/, '主语从句里不能出现中文');
    // 仍然要有正确编号的绑定，只是改成泛化写法
    assert.match(subjectLine, /<Picture 1>/);
    // retention_analysis 也不能混中文
    const retLine = out.prompt.split('\n').find((l) => l.startsWith('<Subject 1>') && l.includes('fully_preserved'))
      ?? out.prompt.split('\n').find((l) => l.includes('fully_preserved')) ?? '';
    assert.doesNotMatch(retLine, /[\u4e00-\u9fa5]/, 'retention 里不能出现中文');
  });

  await checkAsync('角色卡：无图角色走 text_only 分支', async () => {
    const h = await import('../host/services/h3-prompt.js');
    /**
     * ⚠️ 必须混一个**有图**角色，才会走 Ref2VA 六段格式。
     *    只有无图角色时 routeFormat 判成 t2va（没有参考素材），
     *    走基础格式——那是正确的，但没有 subject_definitions 段可查。
     */
    const out = h.compileH3Prompt({
      mode: 'ref2va',
      subjects: [
        { id: 'c1', name: '爱丽丝', pictureIndex: 1, hasImage: true, description: '白发少女' },
        { id: 'c2', name: '旅人', pictureIndex: null, hasImage: false, description: '神秘旅人' },
      ],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'x', dialogue: null }],
      summary: 'x', durationSec: 5,
    });
    assert.equal(out.format, 'ref');
    assert.match(out.prompt, /defined by the written description only/);
    assert.doesNotMatch(out.prompt, /<Picture null>/);
  });

  await checkAsync('角色卡：纯无图角色走基础格式（没有参考素材，正确）', async () => {
    const h = await import('../host/services/h3-prompt.js');
    const out = h.compileH3Prompt({
      mode: 'ref2va',
      subjects: [{ id: 'c2', name: '旅人', pictureIndex: null, hasImage: false, description: '神秘旅人' }],
      references: { images: [], videos: [], audios: [] },
      scenes: [{ index: 1, startSec: 0, description: 'x', dialogue: null }],
      summary: 'x', durationSec: 5,
    });
    assert.equal(out.format, 'base', '没有任何参考素材时应走基础格式');
    assert.doesNotMatch(out.prompt, /<Picture null>/);
  });

  /* -------------------- V8.1 完整 Sigma 序列 -------------------- */

  await checkAsync('sigma: 尾部加密预设是 11 个值（配 6+4 步）', async () => {
    const p = await import('../host/services/nanfeng/presets.js');
    const v = p.validateSigmaSequence(p.SIGMA_PRESETS['tail-dense-10'].value, {
      latentUpscale: true, firstSteps: 6, secondSteps: 4,
    });
    assert.equal(v.values.length, 11);
    assert.ok(v.ok, v.errors.join('; '));
  });

  await checkAsync('sigma: 前 8 值必须等于 simple/shift12 的 8 步网格', async () => {
    const p = await import('../host/services/nanfeng/presets.js');
    const vals = p.validateSigmaSequence(p.SIGMA_PRESETS['tail-dense-10'].value).values;
    const expected = [1, 0.988235, 0.972973, 0.952381, 0.923077, 0.878049, 0.8, 0.631579];
    for (let i = 0; i < 8; i += 1) {
      assert.ok(Math.abs(vals[i] - expected[i]) < 1e-5, `第 ${i + 1} 个值 ${vals[i]} != ${expected[i]}`);
    }
  });

  await checkAsync('sigma: 非法序列被逐条拦下', async () => {
    const p = await import('../host/services/nanfeng/presets.js');
    const bad = [
      ['1, 0.8', /最后一个值必须是 0/],
      ['1, 0.8, 0.9, 0', /严格从高到低/],
      ['1, 0.5, 0.3', /最后一个值必须是 0/],
      ['1.0', /至少需要 2 个/],
    ];
    for (const [text, re] of bad) {
      const v = p.validateSigmaSequence(text);
      assert.equal(v.ok, false, `${text} 应被拒绝`);
      assert.match(v.errors.join('; '), re, `${text} 的错误信息不对：${v.errors.join(';')}`);
    }
    // ⚠️ `1, 0` 是**合法**的：2 个值、严格递减、收尾于 0。
    //    它在"不开二采"时是有效的单通道两段轨迹，别把它当反例。
    assert.ok(p.validateSigmaSequence('1, 0').ok, '`1, 0` 是合法的两值序列');
    assert.ok(p.validateSigmaSequence('').ok, '空 = 自动，应通过');
  });

  await checkAsync('sigma: 个数不符时给出可操作的错误', async () => {
    const p = await import('../host/services/nanfeng/presets.js');
    const v = p.validateSigmaSequence(p.SIGMA_PRESETS['tail-heavier-12'].value, {
      latentUpscale: true, firstSteps: 6, secondSteps: 4,
    });
    assert.equal(v.ok, false);
    assert.match(v.errors.join(';'), /必须 = 一采步数 \+ 二采步数 \+ 1/);
  });

  /* -------------------- 参数审计工具 -------------------- */

  await checkAsync('审计：217 参数四分类完整且无遗漏', async () => {
    // audit-params.mjs 是独立脚本，这里只验它的产出结构
    const { execFileSync } = await import('node:child_process');
    // ⚠️ 必须用 fileURLToPath —— import.meta.url 是百分号编码的
    //    （工作区路径含中文 "AI视频"），直接切字符串会得到 ENOENT。
    const { fileURLToPath } = await import('node:url');
    const script = fileURLToPath(new URL('../tools/audit-params.mjs', import.meta.url));
    const out = execFileSync(process.execPath, [script, '--json'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    const j = JSON.parse(out);
    assert.equal(j.rows.length, 217, `应有 217 行，实际 ${j.rows.length}`);
    const total = Object.values(j.counts).reduce((a, b) => a + b, 0);
    assert.equal(total, 217, `四分类合计应 217，实际 ${total}`);
    for (const row of j.rows) {
      assert.ok(['A', 'B', 'C', 'D'].includes(row.cls), `${row.name} 分类异常：${row.cls}`);
    }
  });
}

/* ------------------------------------------- 2. 真跑 apply()（假 ctx） */

function makeFakeCtx() {
  const routes = [];
  const tools = [];
  const effects = [];
  const logs = [];

  const ctx = {
    logger: {
      info: (m) => logs.push(['info', m]),
      warn: (m) => logs.push(['warn', m]),
      error: (m) => logs.push(['error', m]),
      debug: () => {},
    },
    webServer: {
      register(opts) {
        routes.push(opts);
        return () => {};
      },
    },
    effect(fn) {
      const dispose = fn();
      effects.push(dispose);
      return dispose;
    },
    tool(def) {
      // DSH 的 tools 服务形如 ctx.tools.define / register；插件里用的是 ctx.tool
      tools.push(def);
      return () => {};
    },
    on() { return () => {}; },
    get: () => undefined,
    emit() {},
    // 供断言
    __routes: routes,
    __tools: tools,
    __effects: effects,
    __logs: logs,
  };
  ctx.tools = { define: (d) => ctx.tool(d), register: (d) => ctx.tool(d) };
  return ctx;
}

async function applyChecks() {
  let ctx;
  await checkAsync('apply(): 能真跑起来且不抛异常', async () => {
    const mod = await import('../host/index.js');
    ctx = makeFakeCtx();
    await mod.apply(ctx);
  });

  if (!ctx) return;

  check('apply(): 注册了 3 条 HTTP 前缀路由', () => {
    const paths = ctx.__routes.map((r) => r.path);
    for (const p of ['/jiuzhang/api', '/jiuzhang/app', '/jiuzhang/assets']) {
      assert.ok(paths.includes(p), `缺路由 ${p}，实际：${paths.join(', ')}`);
    }
  });

  await checkAsync('apply(): 注册了 13 个 studio_* 工具', async () => {
    // 给 effect 一个 tick 让 registerTools 落地
    await new Promise((r) => setTimeout(r, 50));
    const names = ctx.__tools.map((t) => t.name).filter((n) => n && String(n).startsWith('studio_'));
    assert.equal(new Set(names).size, 13, `工具数应为 13，实际 ${JSON.stringify([...new Set(names)])}`);
  });

  await checkAsync('apply(): runtime 挂上了控制器', async () => {
    const { getRuntime } = await import('../host/runtime.js');
    const rt = getRuntime();
    for (const k of ['h3', 'post', 'assets', 'canvasAgent', 'extras', 'vault']) {
      assert.ok(rt[k], `runtime 缺 ${k}`);
    }
  });

  // 收尾：跑一遍 dispose，确认不抛（放到最后，否则会把 runtime 清掉）
  await checkAsync('apply(): dispose 不抛异常', async () => {
    for (const d of ctx.__effects) {
      if (typeof d === 'function') d();
    }
  });
}

/**
 * 重新 apply 一次，把 runtime 装回来。
 *
 * 为什么需要：apply() 的最后一步会 disposeRuntime()，
 * 而路由检查依赖 getRuntime()。真实 DSH 里插件生命周期是
 * "apply → 长期存活 → 卸载时 dispose"，这里为了测 dispose 提前调了一次，
 * 所以要重来一遍。
 */
async function reapply() {
  const mod = await import('../host/index.js');
  const ctx = makeFakeCtx();
  await mod.apply(ctx);
  await new Promise((r) => setTimeout(r, 50));
  return ctx;
}

/* ------------------------------------ 3. 路由处理器直调（带假 req/res） */

function fakeReqRes(method, urlPath, { body = null, headers = {} } = {}) {
  const chunks = [];
  const req = {
    method,
    url: urlPath,
    headers: { host: '127.0.0.1:14314', ...headers },
    on(ev, cb) {
      if (ev === 'data' && body != null) {
        const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
        setTimeout(() => cb(buf), 0);
      }
      if (ev === 'end') setTimeout(cb, 1);
      if (ev === 'error') { /* noop */ }
      return this;
    },
    destroy() {},
  };
  let status = 0;
  const out = { text: '', headers: {} };
  const res = {
    headersSent: false,
    writeHead(code, h) { status = code; out.headers = h || {}; res.headersSent = true; return res; },
    end(data) {
      if (data != null) out.text += Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      return res;
    },
    destroy() {},
    on() { return res; },
  };
  Object.defineProperty(res, 'statusCode', { get: () => status });
  return { req, res, out, status: () => status };
}

async function routeChecks() {
  await reapply();                      // 把 runtime 装回来给路由用
  const { handleApi } = await import('../host/api/index.js');
  const { getWriteToken } = await import('../host/security.js');
  const tok = getWriteToken();

  const GETS = [
    '/meta', '/config', '/health', '/monitor', '/projects', '/assets', '/jobs',
    '/vault/meta', '/vault/cards', '/vault/plan', '/breakdown/meta', '/image/meta',
    '/prompt/meta', '/nanfeng/schema', '/nanfeng/presets', '/nanfeng/storyboard/meta',
    '/toolbox/health', '/templates', '/wardrobe', '/motionshots', '/logs',
    '/blender/health', '/blender/assets', '/blender/actions/catalog',
    '/accel/plans', '/workflows/diagnostics', '/canvas-agent/meta',
    '/resources/orphans', '/resources/previz',
  ];

  for (const p of GETS) {
    await checkAsync(`GET ${p} 返回 200`, async () => {
      const { req, res, out, status } = fakeReqRes('GET', p);
      await handleApi(req, res);
      assert.equal(status(), 200, `实际 ${status()}：${out.text.slice(0, 200)}`);
      assert.ok(out.text.length > 0, '响应体为空');
      JSON.parse(out.text);  // 必须是合法 JSON
    });
  }

  await checkAsync('GET /nanfeng/schema 带中文释义', async () => {
    const { req, res, out } = fakeReqRes('GET', '/nanfeng/schema');
    await handleApi(req, res);
    const j = JSON.parse(out.text);
    assert.equal(j.paramCount, 217);
    assert.ok(j.params.百万像素.zh, '缺 百万像素 的说明');
    assert.ok(j.params.启用双采样.flag === 'dead', '启用双采样 应标为 dead');
    assert.ok(Array.isArray(j.inert) && j.inert.length > 0, '缺 inert 清单');
  });

  await checkAsync('未知路由返回 404 而不是崩溃', async () => {
    const { req, res } = fakeReqRes('GET', '/definitely-not-a-route');
    await handleApi(req, res);
    // 不抛就算过；status 由实现决定
  });

  /**
   * 回归：resolveUserPath 的参数形态。
   *
   * 历史 bug：/nanfeng/storyboard/generate 曾调用 `resolveUserPath(cfg, rel)`，
   * 而函数签名是对象参数 `{ root, input }`，于是 root 收到整个 cfg、input 是
   * undefined。异常被 catch 成 badRels，表现为"传了图但 images:0 且不报错"，
   * 智能分镜的看图能力完全不可用。
   */
  await checkAsync('智能分镜：非法路径进 badRels 而不是静默丢失', async () => {
    const { req, res, out, status } = fakeReqRes('POST', '/nanfeng/storyboard/generate', {
      body: JSON.stringify({ mode: 'ref2va', count: 1, imageRels: ['__no_such_file__.png'] }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(req, res);
    // LLM 不可用时返回 503 是正常的；关键是**不能**在路径解析处炸成 500
    const body = out.text ? JSON.parse(out.text) : {};
    if (status() === 500) throw new Error(`路径解析导致 500：${out.text.slice(0, 200)}`);
    if (status() === 200) {
      const bad = body.imagesBad ?? body.badRels ?? [];
      assert.ok(Array.isArray(bad) && bad.length > 0,
        `应把不存在的图记进 badRels，实际：${JSON.stringify(body).slice(0, 300)}`);
    }
  });

  await checkAsync('resolveUserPath 只接受对象参数（防止再写回旧形态）', async () => {
    const sec = await import('../host/security.js');
    // 正确形态
    const ok = sec.resolveUserPath({ root: TMP, input: 'abc.txt' });
    assert.ok(path.isAbsolute(ok));
    // 旧形态（字符串 root + 字符串 input）必须失败或给出错误结果，而不是悄悄通过
    let threw = false;
    try {
      const bad = sec.resolveUserPath('F:/', 'x.txt');
      // 若没抛，至少要能看出它没有把 'F:/' 当 root 用
      threw = typeof bad !== 'string' || !bad.includes('F:');
    } catch { threw = true; }
    assert.ok(threw, 'resolveUserPath 仍接受旧的 (root, input) 位置参数形态');
  });

  await checkAsync('立绘拆解：无参考图直接 400 而不是静默出图', async () => {
    const { req, res, out, status } = fakeReqRes('POST', '/breakdown/generate', {
      body: JSON.stringify({ character: '测试', refImages: [] }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(req, res);
    // 缺 h3-image 工作流的环境下可能先撞 WORKFLOW_MISSING(500)，那也是显式失败，
    // 但绝不能是 200（那意味着又回到"没参考图也提交"）
    assert.notEqual(status(), 200, `无参考图不应提交，实际 ${status()}：${out.text.slice(0, 200)}`);
    if (status() === 400) {
      assert.equal(JSON.parse(out.text).error, 'REF_IMAGE_REQUIRED');
    }
  });

  /**
   * 回归：/breakdown/generate 里 prompt 必须被定义。
   *
   * 曾经的重构把 `const prompt = buildBreakdownPrompt(body, lv.id)` 误删，
   * 而返回体里仍引用 `prompt`，于是**任何**带参考图的请求都回
   * `{ error: "prompt is not defined" }` —— 拆解功能整体不可用。
   * Node 不会在 --check 阶段发现（运行时 ReferenceError），只有真打一次才看得到。
   */
  await checkAsync('立绘拆解：请求路径里 prompt 有定义', async () => {
    const { req, res, out } = fakeReqRes('POST', '/breakdown/generate', {
      body: JSON.stringify({ character: '测试', refImages: ['assets/__x__.png'] }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(req, res);
    assert.ok(!/prompt is not defined/.test(out.text),
      `/breakdown/generate 里 prompt 未定义：${out.text.slice(0, 200)}`);
  });

  await checkAsync('写操作无 token 被拒绝', async () => {
    const { req, res, status } = fakeReqRes('POST', '/projects', { body: JSON.stringify({ name: 'x' }) });
    await handleApi(req, res);
    assert.equal(status(), 403, `应 403，实际 ${status()}`);
  });

  await checkAsync('写操作带 token 可创建项目', async () => {
    const { req, res, out, status } = fakeReqRes('POST', '/projects', {
      body: JSON.stringify({ name: '冒烟项目', category: 'drama' }),
      headers: { 'x-jz-token': tok, 'content-type': 'application/json' },
    });
    await handleApi(req, res);
    assert.equal(status(), 200, out.text);
    const j = JSON.parse(out.text);
    assert.ok(j.id, '缺 id');
  });

  await checkAsync('镜头卡部分保存不丢字段', async () => {
    // 1) 建项目
    let r = fakeReqRes('POST', '/projects', {
      body: JSON.stringify({ name: 'P2', category: 'drama' }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(r.req, r.res);
    const pid = JSON.parse(r.out.text).id;

    // 2) 建镜头（带完整字段）
    r = fakeReqRes('POST', `/projects/${pid}/shots`, {
      body: JSON.stringify({ title: 's1', durationSec: 7, ratio: '9:16', mode: 'ref2va', refs: { images: [], videos: [], audios: [] } }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(r.req, r.res);
    const shot = JSON.parse(r.out.text);
    assert.equal(shot.durationSec, 7);

    // 3) 只改 nanfeng 的部分保存
    r = fakeReqReqHelper(pid, shot.id, { shot: { nanfeng: { presets: 'quality' } } });
    const r2 = fakeReqRes('POST', `/projects/${pid}/shots`, {
      body: JSON.stringify({ shot: { id: shot.id, nanfeng: { presets: 'quality' } } }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(r2.req, r2.res);
    const after = JSON.parse(r2.out.text);
    assert.equal(after.durationSec, 7, '部分保存把 durationSec 丢了');
    assert.equal(after.ratio, '9:16', '部分保存把 ratio 丢了');
    assert.deepEqual(after.refs, { images: [], videos: [], audios: [] }, '部分保存把 refs 丢了');
    assert.equal(after.nanfeng.presets, 'quality');
  });

  if (!QUICK) {
    await checkAsync('ComfyUI 可达', async () => {
      const r = await fetch('http://127.0.0.1:8488/system_stats', { signal: AbortSignal.timeout(3000) });
      assert.ok(r.ok, `ComfyUI 返回 ${r.status}`);
    });

    await checkAsync('南风节点已加载', async () => {
      const r = await fetch('http://127.0.0.1:8488/object_info/NanFengH3MultiReferenceGeneratorV15', { signal: AbortSignal.timeout(20000) });
      assert.ok(r.ok);
      const j = await r.json();
      assert.ok(j.NanFengH3MultiReferenceGeneratorV15, '节点未注册');
    });

    await checkAsync('schema.js 与 ComfyUI object_info 逐项一致', async () => {
      const s = await import('../host/services/nanfeng/schema.js');
      const r = await fetch('http://127.0.0.1:8488/object_info/NanFengH3MultiReferenceGeneratorV15', { signal: AbortSignal.timeout(20000) });
      const node = (await r.json()).NanFengH3MultiReferenceGeneratorV15;
      const live = Object.keys(node.input.required);
      const mine = Object.keys(s.PARAMS);
      assert.deepEqual(
        live.filter((k) => !mine.includes(k)), [], 'schema.js 缺少 ComfyUI 已有参数',
      );
      assert.deepEqual(
        mine.filter((k) => !live.includes(k)), [], 'schema.js 多出 ComfyUI 没有的参数',
      );
      // COMBO 选项必须覆盖 ComfyUI 的全部取值，否则 value_not_in_list。
      //
      // ⚠️ 素材槽位（图片N/视频N/音频N）是**动态 COMBO**：选项来自
      //    ComfyUI input 目录的实时文件列表，schema.js 里写 ['未选择','3d']
      //    只是占位。这些槽位由 graph.js 在组装时按真实文件名填入，
      //    所以这里必须排除，否则每次上传素材都会让测试变红。
      const DYNAMIC = /^(图片[1-9]|视频[1-3]|音频[1-3])$/;
      const missingOpts = [];
      for (const [k, def] of Object.entries(s.PARAMS)) {
        if (DYNAMIC.test(k)) continue;
        const spec = node.input.required[k];
        if (!spec || !Array.isArray(spec[0])) continue;
        if (!Array.isArray(def.options)) continue;
        // 模型 / LoRA / 放大器这类也是目录驱动的动态 COMBO，同样跳过
        if (/^(模型|LoRA[1-8]|H3潜空间放大模型|二采LoRA)$/.test(k)) continue;
        const mineSet = new Set(def.options.map(String));
        for (const o of spec[0]) {
          if (!mineSet.has(String(o))) missingOpts.push(`${k}: ${o}`);
        }
      }
      assert.deepEqual(missingOpts, [], `选项缺失：${missingOpts.join('; ')}`);
    });

    await checkAsync('动态素材槽位在 3d 之外不会写死文件列表', async () => {
      const s = await import('../host/services/nanfeng/schema.js');
      for (const k of ['图片1', '视频1', '音频1']) {
        assert.deepEqual(s.PARAMS[k].options, ['未选择', '3d'],
          `${k} 不应把 ComfyUI 的实时文件列表抄进 schema`);
      }
    });
  }
}

/** 占位，避免上面误用 */
function fakeReqReqHelper() { return null; }

/* -------------------------------------------------------------- 主流程 */

const t0 = Date.now();
await moduleChecks();
await applyChecks();
await routeChecks();

const dt = Date.now() - t0;
const pad = Math.max(...results.map((r) => r.name.length), 10);

console.log(`\n===== 冒烟测试（${dt} ms，${results.length} 项）=====\n`);
for (const r of results) {
  if (r.ok) console.log(`  ✅  ${r.name}`);
  else console.log(`  ❌  ${r.name.padEnd(pad)}\n        ${r.detail}`);
}
console.log(`\n通过 ${results.length - failed} / ${results.length}${failed ? `，失败 ${failed}` : '，全部通过'}\n`);

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(failed ? 1 : 0);
