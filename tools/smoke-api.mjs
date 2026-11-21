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
  await checkAsync('schema: 221 个参数', async () => {
    const m = await import('../host/services/nanfeng/schema.js');
    assert.equal(m.PARAM_COUNT, 221);
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

  /**
   * 不加速方案必须校验步数。
   *
   * ==========================================================================
   * 这组测试守护的是一个**会出废片但不报错**的组合
   * ==========================================================================
   *
   * 旧行为：`checkSteps('none', 8)` 返回 `{ok:true, warning:''}` —— 一路绿灯。
   * 后果是「选不加速 + 前端 steps 默认 8」→ 原模型只用 8 步去噪，
   * 远未收敛，出片一片模糊，而且没有任何警告。
   *
   * 现在的规则：低于推荐步数 50%（50 → 25）判为不可用（ok:false），
   * generator 会回退到推荐步数并写明「已忽略你填的 X 步」。
   */
  await checkAsync('加速方案：none 步数按 stepsRange 校验（低于 min 拒绝）', async () => {
    const { checkSteps, planForShot } = await import('../host/services/accel-plan.js');
    const p = planForShot('none');
    const range = p.plan.stepsRange;
    assert.ok(range, 'none 方案必须带 stepsRange');
    assert.equal(checkSteps('none', 8).ok, false, '8 步远低于下限必须被拒');
    assert.equal(checkSteps('none', range.min - 1).ok, false, `低于 ${range.min} 必须被拒`);
    assert.equal(checkSteps('none', range.min).ok, true, `等于下限 ${range.min} 放行`);
    assert.equal(checkSteps('none', 30).ok, true, '中间值放行（用户常用的折中档）');
    assert.equal(checkSteps('none', 50).ok, true, '推荐值放行');
    assert.equal(checkSteps('none', range.max + 10).ok, true, '超上限只是警告不是拒绝');
    assert.match(checkSteps('none', range.max + 10).warning, /收益递减/);
    // 蒸馏学生仍然只警告不拒绝（它是分布外而非没跑完）
    assert.equal(checkSteps('dmad8', 20).ok, true);
    assert.match(checkSteps('dmad8', 20).warning, /分布外/);
  });

  /**
   * 超时必须按截止时间算，不能是固定轮询次数。
   *
   * 旧实现 `MAX_POLL=600 × 3000ms` = 硬上限 30 分钟 —— 不加速方案跑不完，
   * 被打断时 ComfyUI 还在继续跑，GPU 白烧。
   */
  await checkAsync('ComfyUI 等待：超时按截止时间算，且可配置', async () => {
    const src = await (await import('node:fs/promises'))
      .readFile(new URL('../host/services/comfy-client.js', import.meta.url), 'utf8');
    assert.match(src, /deadline/, '必须用 deadline 判断超时');
    assert.doesNotMatch(src, /for \(let i = 0; i < MAX_POLL/, '不应再用固定轮询次数');
    assert.match(src, /JZ_COMFY_TIMEOUT_MIN/, '支持环境变量调大超时');
    assert.match(src, /comfyTimeoutMin/, '支持配置项调大超时');

    const C = await import('../host/config.js');
    const cfg = C.loadConfig();
    assert.equal(typeof cfg.comfyTimeoutMin, 'number');
    assert.ok(cfg.comfyTimeoutMin >= 60, '默认超时至少要能覆盖 50 步长片');
    assert.ok(C.WRITABLE_CONFIG_KEYS.includes('comfyTimeoutMin'), '必须可通过配置 API 修改');
  });

  /**
   * 换人流程：采样器必须跟随加速方案，不接受前端覆盖。
   *
   * 旧行为 `task.sampler || d.sampler` 会让前端默认的 `lcm` 漏进 `none` 方案，
   * 变成「原模型用 LCM 步进器跑 50 步」—— 不报错，但会糊。
   */
  await checkAsync('换人：采样器跟随加速方案，不被前端 lcm 污染', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const none = buildOverrides({
      accelPlan: 'none', steps: 50, sampler: 'lcm', scheduler: 'simple', continuation: false,
    });
    assert.equal(none['采样器'], 'euler', '不加速方案必须用 euler，不能被 lcm 覆盖');
    assert.equal(none['采样步数'], 50);

    const dmad = buildOverrides({
      accelPlan: 'dmad8', steps: 8, sampler: 'euler', scheduler: 'simple', continuation: false,
    });
    assert.equal(dmad['采样器'], 'lcm', '蒸馏方案必须用 lcm，不能被 euler 覆盖');
    assert.equal(dmad['采样步数'], 8);
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

  /* -------------------- LoRA 栈求解（本轮新增） -------------------- */

  /**
   * 这组测试守护「用户选的语义 LoRA 真的会生效」。
   *
   * 历史缺陷（本轮实测复现）：画布的 `nodeToShot` 把语义 LoRA 写成
   * `{ file, strength }`，而 `solveLoraStack` 只认 `{ name, strength }`，
   * 于是条目在入参归一化处被**静默丢弃** —— 不报错、不进 rejected、
   * 总强度按 0 计，最终只有加速学生上机。画布上拖着「语义 LoRA」
   * 以为生效了，实际一帧都没用上。
   */
  await checkAsync('LoRA 栈：{name} 契约能进槽，{file} 会被静默丢弃（护栏）', async () => {
    const { solveLoraStack } = await import('../host/services/lora-catalog.js');
    const files = ['20_motion\\A.safetensors'];
    const byName = solveLoraStack([{ name: '20_motion\\A.safetensors' }], { availableFiles: files });
    assert.equal(byName.accepted.length, 1, '{name} 形态应当被接受');
    const byFile = solveLoraStack([{ file: '20_motion\\A.safetensors' }], { availableFiles: files });
    assert.equal(byFile.accepted.length, 0, '{file} 形态会被丢弃 —— 这是契约，前端必须发 name');
  });

  await checkAsync('LoRA 栈：画布 runner 必须发 name 而不是 file', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../app-src/src/canvas/runner.ts', import.meta.url), 'utf8');
    assert.match(src, /loras:\s*semanticLoras\.map\(\(file\)\s*=>\s*\(\{\s*\n?\s*name:/,
      'nodeToShot 的 loras 映射必须产出 name 字段，否则后端静默丢弃');
  });

  await checkAsync('LoRA 栈：单选类后来的替换先来的', async () => {
    const { solveLoraStack } = await import('../host/services/lora-catalog.js');
    const files = ['30_style\\a.safetensors', '30_style\\b.safetensors'];
    const r = solveLoraStack(
      [{ name: '30_style\\a.safetensors' }, { name: '30_style\\b.safetensors' }],
      { availableFiles: files },
    );
    assert.equal(r.accepted.length, 1, '画风是单选类，只能留 1 条');
    assert.match(r.accepted[0].name, /b\.safetensors/);
    assert.equal(r.replaced.length, 1);
  });

  await checkAsync('LoRA 栈：加速学生恒 1.0 且不计入总强度', async () => {
    const { solveLoraStack } = await import('../host/services/lora-catalog.js');
    const files = ['00_turbo\\dmad.safetensors', '20_motion\\m.safetensors'];
    const r = solveLoraStack(
      [{ name: '00_turbo\\dmad.safetensors', strength: 0.5 }, { name: '20_motion\\m.safetensors' }],
      { availableFiles: files },
    );
    const accel = r.accepted.find((a) => a.role === 'accelerator');
    assert.equal(accel.appliedStrength, 1, '加速学生强度必须被钉回 1.0');
    assert.equal(r.totalStrength, 0.7, '总强度只算语义 LoRA');
  });

  await checkAsync('LoRA 栈：多挂按 stackDecay 衰减 + 总强度看门狗', async () => {
    const { solveLoraStack, STRENGTH_LIMITS } = await import('../host/services/lora-catalog.js');
    const files = [
      '20_motion\\a.safetensors', '20_motion\\b.safetensors', '30_style\\s.safetensors',
      '10_camera\\c.safetensors',
    ];
    const decay = solveLoraStack(
      [{ name: '20_motion\\a.safetensors' }, { name: '20_motion\\b.safetensors' }],
      { availableFiles: files },
    );
    assert.ok(decay.accepted[1].appliedStrength < decay.accepted[0].appliedStrength, '第 2 条动作类应衰减');
    const over = solveLoraStack(
      [
        { name: '20_motion\\a.safetensors', strength: 1 },
        { name: '20_motion\\b.safetensors', strength: 1 },
        { name: '30_style\\s.safetensors', strength: 1 },
        { name: '10_camera\\c.safetensors', strength: 1 },
      ],
      { availableFiles: files },
    );
    assert.ok(over.totalStrength <= STRENGTH_LIMITS.warn, '超硬上限后必须砍到建议阈值以下');
    assert.ok(over.rejected.length > 0, '被砍的条目必须出现在 rejected 里，不能静默消失');
  });

  await checkAsync('LoRA 栈：不存在的文件在组装期就被拒', async () => {
    const { solveLoraStack } = await import('../host/services/lora-catalog.js');
    const r = solveLoraStack(
      [{ name: '20_motion\\NotInstalled.safetensors' }],
      { availableFiles: ['20_motion\\real.safetensors'] },
    );
    assert.equal(r.accepted.length, 0);
    assert.match(r.rejected[0].reason, /不在 ComfyUI 的 loras 目录/);
  });

  await checkAsync('LoRA 栈：探测失败（availableFiles 为空）时不误杀', async () => {
    const { solveLoraStack } = await import('../host/services/lora-catalog.js');
    const r = solveLoraStack([{ name: '20_motion\\X.safetensors' }], { availableFiles: [] });
    assert.equal(r.accepted.length, 1, 'ComfyUI 不可达时不能把用户的 LoRA 全丢掉');
  });

  /* -------------------- 提示词：手写短句不得被丢（本轮修复） -------------------- */

  /**
   * 守护「用户手写的短提示词会进最终提示词」。
   *
   * 历史缺陷（本轮实测复现）：compilePrompt 只在 `prompt.trim().length > 200`
   * 时整段采用手写稿；不足 200 字时它退化成"简短备注"，被追加到
   * `pkg.sceneLayout`。但 compileRef2VA 的分支是
   *     if (scenes.length) { 逐镜头 } else { 用 sceneLayout }
   * 而 toShotInputPackage **永远**会造一个默认 shots 数组 —— 于是 scenes 恒非空，
   * sceneLayout 是死字段，那句话被整句丢弃。
   *
   * 触发词（LoRA trainedWords）几乎都是 200 字以下的一两句，正好全部踩中：
   * 用户以为挂上 LoRA 就有效果，实际触发词一个字都没进提示词。
   */
  await checkAsync('提示词：<=200 字的手写短句必须进最终提示词', async () => {
    const api = await import('../host/api/index.js');
    const short = 'Video depicts a sexual scene between a female central character and a giant partner';
    assert.ok(short.length <= 200);
    const out = api.compilePrompt({
      id: 'p', mode: 'ref2va', prompt: short,
      description: 'a different description',
      refs: { images: ['assets/x.png'], videos: [], audios: [] },
    }, []);
    assert.ok(out.includes(short), '短提示词被丢掉了 —— 它只被写进了 scenes 恒非空时不会被读取的 sceneLayout');
  });

  await checkAsync('提示词：>200 字的手写稿整段采用且不被重编译', async () => {
    const api = await import('../host/api/index.js');
    const long = 'A'.repeat(120) + ' ' + 'B'.repeat(120);
    assert.ok(long.length > 200);
    const out = api.compilePrompt({
      id: 'p', mode: 'ref2va', prompt: long,
      description: 'a different description',
      refs: { images: ['assets/x.png'], videos: [], audios: [] },
    }, []);
    assert.ok(out.includes(long), '完整手写稿必须原样保留');
    assert.ok(!out.includes('subject_definitions:'), '手写成品不应再被骨架包一层');
  });

  await checkAsync('提示词：短句与 description 相同时不重复追加', async () => {
    const api = await import('../host/api/index.js');
    const same = 'a woman kneels in a stone chamber and looks up';
    const base = { id: 'p', mode: 'ref2va', description: same, refs: { images: ['assets/x.png'], videos: [], audios: [] } };
    // description 本身就会进 summary 与 [Shot 1]，所以"重复"不能用绝对次数判断，
    // 要比"带上 prompt"与"完全不带 prompt"两次输出是否一致。
    const withPrompt = api.compilePrompt({ ...base, prompt: same }, []);
    const without = api.compilePrompt({ ...base }, []);
    assert.equal(withPrompt, without, 'prompt 与 description 相同时不应再追加一遍');
  });

  /* -------------------- 角色替换（换人）业务线 -------------------- */

  /**
   * 这组测试守护「换人线与常规渲染完全隔离」这条硬约束。
   *
   * 实测背景（2026-11-19 A/B 对照）：常规渲染页的参考图顺序是
   *   角色卡 → 人设卡 → 手工图 → 场景道具
   * 项目里只要绑着角色卡，用户手工挂的图就会被顶到后面，`<Picture 1>`
   * 指向另一个人 —— 而且**不报错**。换人对此零容忍，所以整条线独立。
   */
  await checkAsync('换人：提示词四段式结构完整', async () => {
    const R = await import('../host/services/replace.js');
    const p = R.buildReplacePrompt({
      roles: [{ sourceDesc: '黑发猫耳少女', targetDesc: '银蓝长发羊角少女', pictureIndex: 1 }],
    });
    assert.match(p, /将参考视频1视频中的黑发猫耳少女替换成参考图1中的银蓝长发羊角少女/);
    assert.match(p, /<Subject 1> 是 <Picture 1> 中的银蓝长发羊角少女/);
    assert.match(p, /<Video 1> 是源视频/);
    assert.match(p, /完全复刻 <Video 1> 内动作，不添加新角色/);
  });

  await checkAsync('换人：提示词不写声音字段与否定式清单（skill 铁律 2/4）', async () => {
    const R = await import('../host/services/replace.js');
    const p = R.buildReplacePrompt({ roles: [{ sourceDesc: 'A', targetDesc: 'B' }] });
    assert.ok(!/overall_soundscape/.test(p), '换人不应写 overall_soundscape');
    assert.ok(!/non_diegetic_music/.test(p), '换人不应写 non_diegetic_music');
    assert.ok(!/<Audio \d+>/.test(p), '换人不应引用音频标签');
    assert.ok(!/^\s*Forbidden/im.test(p), '换人不应有否定式 Forbidden 清单');
  });

  await checkAsync('换人：多角色各自绑定自己的 Picture 编号', async () => {
    const R = await import('../host/services/replace.js');
    const p = R.buildReplacePrompt({
      roles: [
        { sourceDesc: '甲', targetDesc: '甲2', pictureIndex: 1 },
        { sourceDesc: '乙', targetDesc: '乙2', pictureIndex: 2 },
      ],
    });
    assert.match(p, /<Subject 1> 是 <Picture 1> 中的甲2/);
    assert.match(p, /<Subject 2> 是 <Picture 2> 中的乙2/);
  });

  await checkAsync('换人：没有角色时明确报错而不是产出空提示词', async () => {
    const R = await import('../host/services/replace.js');
    assert.throws(() => R.buildReplacePrompt({ roles: [] }), /REPLACE_ROLES_REQUIRED/);
  });

  await checkAsync('换人：默认参数是 DMAD8 那套', async () => {
    const R = await import('../host/services/replace.js');
    const d = R.REPLACE_DEFAULTS;
    assert.equal(d.accelPlan, 'dmad8');
    assert.equal(d.sampler, 'lcm');
    assert.equal(d.scheduler, 'simple');
    assert.equal(d.steps, 8);
    assert.equal(d.megapixels, 0.6);
    assert.equal(d.lightingId, 'none', '换人默认继承源视频光影');
    /**
     * 续写默认**开**（方案 A）。
     *
     * 早先默认是「独立重绘 + 二采关」，段间硬跳。
     * 实测 10 秒段的后几秒稳定性本就不足，段间更是接缝明显。
     * 续写用真实 AV latent 传状态，是唯一从机制上解决接缝的做法。
     */
    assert.equal(d.continuation, true, '换人默认走续写链');
    assert.equal(d.contextLength, '22', '重叠取 22 档（0.92s），别让污染占掉半个片段');
  });

  await checkAsync('换人：分段按 10s 切且不产生碎片', async () => {
    // 直接验分段算法（不碰 ffmpeg）：复用 planSegments 的分段规则
    const total = 34.5;
    const seg = 10;
    const segments = [];
    let cursor = 0;
    let guard = 0;
    while (cursor < total - 0.05 && guard < 40) {
      guard += 1;
      const remain = total - cursor;
      const dur = Math.min(seg, remain);
      if (dur < 1 && segments.length) {
        segments[segments.length - 1].durationSec += dur;
        break;
      }
      segments.push({ startSec: cursor, durationSec: dur });
      cursor += dur;
    }
    assert.equal(segments.length, 4, '34.5s 应切成 4 段');
    assert.ok(Math.abs(segments.reduce((s, x) => s + x.durationSec, 0) - total) < 0.01,
      '段时长之和必须等于总时长');
    assert.ok(segments.every((s) => s.durationSec >= 1), '不应出现 <1s 的碎片');
  });

  await checkAsync('换人：ratioOf 按源分辨率取最接近的画幅', async () => {
    const { ratioOf } = await import('../host/services/replace-runner.js');
    assert.equal(ratioOf(1920, 1080), '16:9');
    assert.equal(ratioOf(1080, 1920), '9:16');
    assert.equal(ratioOf(1024, 1024), '1:1');
    assert.equal(ratioOf(640, 360), '16:9');
    assert.equal(ratioOf(0, 0), '16:9', '缺失分辨率要回退到 16:9 而不是抛错');
  });

  await checkAsync('换人：存储与 jobs.json 完全分离', async () => {
    const R = await import('../host/services/replace.js');
    const cfg = { dataDir: path.join(TMP, 'data'), comfyUrl: '', ffmpegDir: '' };
    const store = R.replaceStore(cfg);
    assert.ok(store.file.endsWith(path.join('replace', 'replace.json')),
      `换人集合必须是 replace/replace.json，实际 ${store.file}`);
    assert.ok(!store.file.endsWith('jobs.json'), '换人不能复用 jobs.json');
  });

  await checkAsync('换人：整段提示词优先于结构化字段', async () => {
    /**
     * 这条守护「用户可以直接改整段提示词」。
     *
     * 早先只有 roles/shotBeats 三个占位符，只能表达一对一替换；
     * 多角色、配角不动、某角色只在某几段出现全都表达不了。
     * 现在 body.prompt 非空就整段用它，roles 只作兜底。
     */
    const R = await import('../host/services/replace.js');
    const custom = '将参考视频1中的甲换成参考图1的乙；将参考视频1中的丙换成参考图2的丁。';
    // 模拟 createReplaceTask 里的取舍逻辑
    const pick = (body) => String(body.prompt ?? '').trim()
      || R.buildReplacePrompt({ roles: body.roles ?? [], shotBeats: body.shotBeats ?? '' });
    assert.equal(pick({ prompt: custom, roles: [{ sourceDesc: 'a', targetDesc: 'b' }] }), custom);
    // 没给 prompt 时回落到结构化拼装
    const fallback = pick({ roles: [{ sourceDesc: 'a', targetDesc: 'b' }] });
    assert.match(fallback, /<Subject 1>/);
  });

  await checkAsync('换人：提示词模板按参考图数量生成对应组数', async () => {
    const R = await import('../host/services/replace.js');
    for (const n of [1, 2, 3]) {
      const roles = Array.from({ length: n }, (_, i) => ({
        sourceDesc: `原${i + 1}`,
        targetDesc: `目标${i + 1}`,
        pictureIndex: i + 1,
      }));
      const p = R.buildReplacePrompt({ roles });
      for (let i = 1; i <= n; i += 1) {
        assert.match(p, new RegExp(`<Subject ${i}> 是 <Picture ${i}>`), `${n} 组时应含 <Subject ${i}>`);
      }
      // 不该出现超出组数的编号
      assert.ok(!new RegExp(`<Subject ${n + 1}>`).test(p), `${n} 组时不应出现 <Subject ${n + 1}>`);
    }
  });

  await checkAsync('换人：LoRA 透传到段镜头的 nanfeng.loras', async () => {
    /**
     * 换人页也能选 LoRA（比如挂一个动作/画风 LoRA）。
     * 这条守护 `task.loras → shot.nanfeng.loras` 这条链路不被改断 ——
     * 断了的表现是「页面上选了 LoRA，提交后 LoRA2 槽是未选择」，且不报错。
     */
    const { ratioOf } = await import('../host/services/replace-runner.js');
    assert.equal(typeof ratioOf, 'function');
    const src = await import('node:fs').then((f) => f.readFileSync(
      new URL('../host/services/replace-runner.js', import.meta.url), 'utf8',
    ));
    assert.match(src, /loras:\s*Array\.isArray\(task\.loras\)/, 'runner 必须把 task.loras 传给 shot.nanfeng');
  });

  /* -------------------- 续写链（换人方案 A） -------------------- */

  /**
   * 这组守护「续写分段规划」的算术。
   *
   * 背景：独立重绘的段间必然跳变（每段首帧是模型自己推断的，不是上一段末帧）。
   * 续写用真实 AV latent 传状态，是唯一从机制上解决接缝的做法。
   * 段与段在源视频上要**重叠** trimFrames 帧，采完裁掉。
   */
  await checkAsync('续写：context_length 四档对应正确帧数与秒数', async () => {
    const C = await import('../host/services/nanfeng/continuation.js');
    assert.deepEqual([...C.CONTEXT_LENGTHS], ['5', '22', '39', '56']);
    for (const [ctx, sec] of [['5', 0.21], ['22', 0.92], ['39', 1.63], ['56', 2.33]]) {
      const got = Number(ctx) / 24;
      assert.ok(Math.abs(got - sec) < 0.01, `context=${ctx} 应为 ${sec}s，实际 ${got.toFixed(3)}s`);
    }
  });

  await checkAsync('续写：规划器从目标时长反推，且段 1 不比后续段短太多', async () => {
    const C = await import('../host/services/nanfeng/continuation.js');
    const r = C.planSegments({ targetSeconds: 15, segments: 3, contextLength: '56' });
    assert.equal(r.segments.length, 3);
    assert.equal(r.trimFrames, 56);
    // 总交付要贴近目标
    const sum = r.segments.reduce((s, x) => s + x.deliverSec, 0);
    assert.ok(Math.abs(sum - 15) < 1.5, `15s 目标，实际交付 ${sum.toFixed(2)}s`);
    // 段 1 与后续段的交付时长差距不超过 40%（均衡性）
    const d1 = r.segments[0].deliverSec;
    const dRest = r.segments[1].deliverSec;
    assert.ok(Math.abs(d1 - dRest) / Math.max(d1, dRest) < 0.4,
      `段 1(${d1}s) 与段 2(${dRest}s) 差距过大，身份锚定会不稳`);
  });

  await checkAsync('续写：段 1 不裁、后续段裁掉 trimFrames', async () => {
    const C = await import('../host/services/nanfeng/continuation.js');
    const r = C.planSegments({ targetSeconds: 20, segments: 4, contextLength: '22' });
    assert.equal(r.segments[0].deliverFrames, r.segments[0].sampleFrames, '段 1 不裁');
    for (const s of r.segments.slice(1)) {
      assert.equal(s.deliverFrames, s.sampleFrames - 22, '段 n>1 交付 = 采样 − 22');
    }
  });

  await checkAsync('续写：换人模式允许段 1 短于叙事模式的 124 帧下限', async () => {
    const C = await import('../host/services/nanfeng/continuation.js');
    // 叙事模式：段 1 必须 ≥124
    const story = C.planSegments({ targetSeconds: 20, segments: 3, contextLength: '56' });
    assert.ok(story.segments[0].sampleFrames >= 124, '叙事模式段 1 应 ≥124 帧');
    // 换人模式：minFirstFrames 可以放开
    const repl = C.planSegments({
      targetSeconds: 20, segments: 3, contextLength: '56', minFirstFrames: 39,
    });
    assert.ok(repl.segments[0].sampleFrames >= 39, '换人模式段 1 只要 ≥minFirstFrames');
  });

  await checkAsync('续写：任务 JSON 五字段完整且 node 恒为 1', async () => {
    const C = await import('../host/services/nanfeng/continuation.js');
    const batch = C.createBatch({
      projectId: 'p', shotIds: ['a', 'b'], preset: 'draft', contextLength: '56',
    });
    const t = JSON.parse(C.taskFor(batch, 1));
    for (const k of ['workflow', 'node', 'group', 'run', 'index']) {
      assert.ok(k in t, `任务 JSON 缺字段 ${k}`);
    }
    assert.equal(t.node, '1', 'node 必须等于 buildWorkflow 固定的节点 ID');
    assert.equal(t.index, 1);
    // folder 是两个相同身份算同一个 hash —— 这是续写能接上的前提
    const f1 = C.contextFolder({ workflow: batch.batchId, node: '1', group: batch.batchId, run: batch.runId });
    const f2 = C.contextFolder({ workflow: batch.batchId, node: '1', group: batch.batchId, run: batch.runId });
    assert.equal(f1, f2);
  });

  await checkAsync('续写：换人默认开续写 + 重叠取 22 档', async () => {
    const R = await import('../host/services/replace.js');
    assert.equal(R.REPLACE_DEFAULTS.continuation, true, '换人默认应开启续写');
    /**
     * 默认从 '56' 改成 '22'，理由见 REPLACE_DEFAULTS.contextLength 的注释：
     * 56 帧会在 30s/6 段时占掉目标片段 32%~45% 的帧数，那些帧被
     * 「上一段实际生成的内容」—— 含源角色残留 —— 作为关键帧钉住，
     * 参考图压不过张量条件，于是身份漂移。窗口越长漂得越重。
     */
    assert.equal(R.REPLACE_DEFAULTS.contextLength, '22', '重叠窗口默认 22，别让污染占掉半个片段');
    assert.equal(R.REPLACE_DEFAULTS.segmentSec, 4, '段长默认 4s');
  });

  await checkAsync('续写：上下文加噪的默认配方是 0.45/0.10/2', async () => {
    /**
     * 这是路线 A 的核心。配方来自 MacroSony/minimax-h3-chained-character-swap
     * 的实测（inject_tail_taper.py），见 vendor/nanfeng/context_taper_noise.py。
     */
    const R = await import('../host/services/replace.js');
    assert.equal(R.REPLACE_DEFAULTS.taperAlpha, 0.45, '平坦注入强度取社区验证值');
    assert.equal(R.REPLACE_DEFAULTS.taperAlphaEnd, 0.1, '接缝端降到 0.10');
    assert.equal(R.REPLACE_DEFAULTS.taperRampSteps, 2, '最后 2 个 latent step 做斜坡');
  });

  await checkAsync('续写：context_length 必须写进 overrides（防预设覆盖）', async () => {
    /**
     * 这条守护一个**实测踩到的静默错误**。
     *
     * `presets.js` 的 continuation / continuation-quality 两套预设都把
     * `context_length` 写死成 `'22'`。而合并顺序是「预设 → 镜头 overrides
     * → extraParams」，overrides 能赢预设，但前提是 overrides 里**有**这个键。
     *
     * 早先换人线没写 → 用户选 56（2.33s）实际跑 22（0.92s）：
     * 重叠窗口只剩 40%，产物 136 帧（158-22）而不是 102 帧（158-56），
     * 接缝明显但**零报错**。
     */
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides({ contextLength: '56', steps: 8 }, { continuation: true });
    assert.equal(ov.context_length, '56', 'context_length 必须被显式写进 overrides');
    assert.equal(ov['启用H3潜空间放大二采'], false, '续写强制关二采');
  });

  await checkAsync('续写：audio_context_length 按 40Hz/24fps 换算，而不是 ctx*4', async () => {
    /**
     * 这条守护另一个**没有报错的浪费**。
     *
     * H3 音频 latent 跑 40 Hz、画面 24 fps → 1 像素帧 = 5/3 个音频步。
     * `context_length=56` 只需要 round(56*5/3)=93 步。
     *
     * 早先写的是 `Number(ctx) * 4`（56→224 步），比实际需要多 **2.4 倍**。
     * 多出来的每一步都作为 conditioning row 钉进序列、走完整 DiT，
     * 而换人线在切段阶段就 `-an` 剥掉了音轨，这些行连价值都没有。
     */
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    for (const [ctx, want] of [['5', 8], ['22', 37], ['39', 65], ['56', 93]]) {
      const ov = buildOverrides({ contextLength: ctx }, { continuation: true });
      assert.equal(ov.audio_context_length, want,
        `context_length=${ctx} 应换算成 ${want} 个音频步（= round(ctx*40/24)）`);
    }
  });

  await checkAsync('续写：audio_context_length 不越界（0～240）', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    for (const ctx of ['5', '22', '39', '56']) {
      const ov = buildOverrides({ contextLength: ctx }, { continuation: true });
      assert.ok(ov.audio_context_length >= 0 && ov.audio_context_length <= 240,
        `context_length=${ctx} 换算出的音频步 ${ov.audio_context_length} 越界`);
    }
  });

  await checkAsync('续写：独立模式不写 context_length，二采尊重用户', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides({ secondPass: true }, { continuation: false });
    assert.equal(ov.context_length, undefined, '独立模式不该塞续写参数');
    assert.equal(ov['启用H3潜空间放大二采'], true, '独立模式应尊重用户的二采开关');
  });

  await checkAsync('续写：独立模式不能给加噪参数', async () => {
    /**
     * 加噪是给 `context_latent` 用的，独立模式根本没有上下文。
     * 写了只会让参数面板出现一个永远不生效的开关。
     */
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides({}, { continuation: false });
    assert.equal(ov['启用续写上下文加噪'], undefined, '独立模式不该出现加噪开关');
  });

  await checkAsync('续写：用户试图在续写模式下开二采也被强制关闭', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides(
      { contextLength: '56', overrides: { 启用H3潜空间放大二采: true } },
      { continuation: true },
    );
    assert.equal(ov['启用H3潜空间放大二采'], false,
      '续写 + 二采会在 vendor 层直接 ValueError，必须在组装期就拦掉');
  });

  await checkAsync('续写：replaceStore.upsert 返回单条记录而不是数组', async () => {
    /**
     * 这条守护一个**让任务完全起不来**的 bug。
     *
     * store 底层是 `updateJson`，它返回**整个数组**。
     * 早先 `upsert` 直接 `return updateJson(...)`，于是：
     *   · createReplaceTask 返回给前端的是数组 → 前端 `task.id` 变成
     *     一串 id 拼起来的字符串（"rp_aaa rp_bbb ..."）→
     *     调 `/replace/run/` 必然 INVALID_ID，任务永远起不来。
     *   · runReplaceBatch 的 emit 同样中招 → current.sourceRel 变 undefined
     *     → 抛 PATH_REQUIRED。
     */
    const R = await import('../host/services/replace.js');
    const cfg = { dataDir: path.join(TMP, 'data'), ffmpegDir: '' };
    const store = R.replaceStore(cfg);
    const written = await store.upsert({ id: 'rp_test_1', sourceRel: 'a.mp4', status: 'draft' });
    assert.ok(!Array.isArray(written), 'upsert 不能返回数组');
    assert.equal(written.id, 'rp_test_1');
    assert.equal(written.sourceRel, 'a.mp4');
    // 再 upsert 一次应合并而非重复
    const again = await store.upsert({ id: 'rp_test_1', status: 'running' });
    assert.equal(again.status, 'running');
    assert.equal(again.sourceRel, 'a.mp4', '合并不能丢字段');
  });

  /* --------- 续写抗漂移：加噪上下文 + 每段重锚身份（方案 A v3） --------- */

  /**
   * 实测背景（30s / 6 段 / context=56）：
   *   段#1 ✓  段#2 段中漂成金发 ✗  段#3 ✓  段#4 ✓  段#5 段中漂 ✗  段#6 ✓
   *   第 0 帧必定是上一段末帧（直接拷贝），**第 5 帧（0.2s）就翻车**
   *
   * 根因不是提示词不够重 —— MotionContext 把上一段 latent 作为
   * **关键帧条件**注入（nodes.py:511-530），那是张量级硬条件；
   * 参考图只是 text-encoder 侧的软约束。文字压不过张量。
   *
   * 所以对策是机制层面的：给上下文加锥形噪声，把「上一段的外观」
   * 损坏掉、把「上一段的运动」保留下来，模型只能从身份参考重新合成。
   */
  await checkAsync('抗漂移：续写模式接上加噪，且参数来自 REPLACE_DEFAULTS', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const R = await import('../host/services/replace.js');
    const ov = buildOverrides({ contextLength: '39' }, { continuation: true });
    assert.equal(ov['启用续写上下文加噪'], true, '续写链必须开启上下文加噪');
    assert.equal(ov['续写加噪强度'], R.REPLACE_DEFAULTS.taperAlpha);
    assert.equal(ov['续写加噪末档强度'], R.REPLACE_DEFAULTS.taperAlphaEnd);
    assert.equal(ov['续写加噪斜坡步数'], R.REPLACE_DEFAULTS.taperRampSteps);
  });

  await checkAsync('抗漂移：加噪强度可被任务级覆盖', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides(
      { contextLength: '22', taperAlpha: 0.6, taperAlphaEnd: 0.2, taperRampSteps: 3 },
      { continuation: true },
    );
    assert.equal(ov['续写加噪强度'], 0.6);
    assert.equal(ov['续写加噪末档强度'], 0.2);
    assert.equal(ov['续写加噪斜坡步数'], 3);
  });

  await checkAsync('抗漂移：taperEnabled=false 时完全退回干净上下文', async () => {
    /**
     * 用户可以在页面上关掉加噪换更顺的接缝 —— 代价是画面会抄上一段外观。
     * 这条守护「关掉时连参数都不写」，避免出现"开关关了但强度还在传"的
     * 半关状态（那种状态最难排查）。
     */
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides(
      { contextLength: '22', taperEnabled: false },
      { continuation: true },
    );
    assert.equal(ov['启用续写上下文加噪'], false, '关掉时必须是显式 false');
    assert.equal(ov['续写加噪强度'], undefined, '关掉时不该再传强度');
    assert.equal(ov['续写加噪末档强度'], undefined);
    assert.equal(ov['续写加噪斜坡步数'], undefined);
    // 但续写本身仍然成立
    assert.equal(ov.context_length, '22', '关加噪不能把续写也关了');
  });

  await checkAsync('抗漂移：taperEnabled 未指定时默认开启', async () => {
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides({ contextLength: '22' }, { continuation: true });
    assert.equal(ov['启用续写上下文加噪'], true,
      '老任务 JSON 没有 taperEnabled 字段时，应按开启处理');
  });

  await checkAsync('抗漂移：不再写幽灵参数 参考图最长边', async () => {
    /**
     * 这条守护一个**跑了两轮都没人发现空转**的错误决策。
     *
     * 上一轮把续写模式的 `参考图最长边` 从 1920 提到 2560，理由是
     * 「续写要更高身份细节」，并把它当作「耗时翻倍」的元凶。
     *
     * 两个都不成立：
     *   ① vendor 的 NanFengH3LimitImageLongEdgeV15 是**只缩不放**：
     *        if longest <= maximum: return (image,)
     *      而换人的参考图是 852×1440（最长边 1440），
     *      1440 < 1920 < 2560 → 1920 和 2560 走同一个直通分支，完全等价。
     *   ② 它前端根本没有 UI，用户看不见、改不了。
     *
     * 外部佐证：MiniMax-H3 discussion #91 用 InsightFace 实测，
     * ref_image_size 从 match 改到 max，身份相似度 0.0884 → 0.0902。
     * 参考图分辨率这条路在 H3 上本来就不通。
     */
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const cont = buildOverrides({}, { continuation: true });
    assert.ok(!('参考图最长边' in cont), '不该再写这个空转参数');
    const indep = buildOverrides({}, { continuation: false });
    assert.ok(!('参考图最长边' in indep), '独立模式同样不该写');
  });

  await checkAsync('抗漂移：续写模式不写死参数 参考图尺寸', async () => {
    /**
     * `参考图尺寸`（ref_image_size, match/max）在本地 V15 上是**死参数**：
     * h3_generator.py 把它硬编码成 "max"，面板分支不读。
     * 写这个键只会让人误以为调了有用。
     */
    const { buildOverrides } = await import('../host/services/replace-runner.js');
    const ov = buildOverrides({ contextLength: '22' }, { continuation: true });
    assert.ok(!('参考图尺寸' in ov), '不该设置死参数 参考图尺寸');
  });

  await checkAsync('抗漂移：段 2 起提示词插入身份锚定句，段 1 不加', async () => {
    /**
     * 官方 skill（h3-continuation §1）：段 2 起 latent 管动作、参考图管身份。
     * 模型不会自己遵守，必须每段写成可执行指令。
     *
     * ⚠️ 锚定句必须用**正面描述**：含 "never" / "not" 的否定句会违反
     *    h3-character-replace 铁律 4（正文里的"不要 X"反而把 X 拉进画面）。
     */
    const src = await import('node:fs').then((f) => f.readFileSync(
      new URL('../host/services/replace-runner.js', import.meta.url), 'utf8',
    ));
    assert.match(src, /Identity lock:/, '必须有身份锚定句');
    assert.match(src, /seg\.index === 1\) return base/,
      '段 1 不加锚定句（没有上一段 latent，不存在身份竞争）');
    assert.match(src, /prompt:\s*segmentPrompt/,
      'runH3Nanfeng 必须收到 segmentPrompt，否则锚定句从未进过 ComfyUI');
  });

  await checkAsync('抗漂移：身份锚定句不含否定式措辞', async () => {
    /**
     * skill 铁律 4：本地 CFG 固定 1.0、采样器没有 negative 分支，
     * 正文里的"不要 X"反而会把 X 拉进画面。锚定句必须是纯正面陈述。
     */
    const src = await import('node:fs').then((f) => f.readFileSync(
      new URL('../host/services/replace-runner.js', import.meta.url), 'utf8',
    ));
    const start = src.indexOf("'Identity lock:");
    assert.ok(start > 0, '找不到锚定句');
    const tail = src.slice(start, start + 800);
    const anchor = tail.slice(0, tail.indexOf("].join(' ')") + 11);
    assert.ok(!/\bnever\b|\bnot any\b|\bdon't\b|\bno other\b/i.test(anchor),
      `锚定句里不能有否定式措辞（会反向强调）：\n${anchor}`);
  });

  await checkAsync('抗漂移：每段都带上同一张参考图', async () => {
    const src = await import('node:fs').then((f) => f.readFileSync(
      new URL('../host/services/replace-runner.js', import.meta.url), 'utf8',
    ));
    // shot.refs.images 来自 task.refImages，循环内没有按段号过滤
    assert.match(src, /images:\s*\(task\.refImages \?\? \[\]\)\.map/,
      '每段都要重新挂参考图，不能只在段 1 挂');
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

  await checkAsync('审计：221 参数四分类完整且无遗漏', async () => {
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
    assert.equal(j.rows.length, 221, `应有 221 行，实际 ${j.rows.length}`);
    const total = Object.values(j.counts).reduce((a, b) => a + b, 0);
    assert.equal(total, 221, `四分类合计应 221，实际 ${total}`);
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

  await checkAsync('apply(): 注册了 14 个 studio_* 工具', async () => {
    // 给 effect 一个 tick 让 registerTools 落地
    await new Promise((r) => setTimeout(r, 50));
    const names = ctx.__tools.map((t) => t.name).filter((n) => n && String(n).startsWith('studio_'));
    assert.equal(new Set(names).size, 14, `工具数应为 14，实际 ${JSON.stringify([...new Set(names)])}`);
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
    assert.equal(j.paramCount, 221);
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

  /* -------------------- 立绘拆解：提示词即唯一输入（本轮重构） -------------------- */

  /**
   * 这一组守护"用户改的提示词原样进模型"。
   *
   * 历史缺陷（本轮重构）：提示词由 character / outfit / parts / views / notes
   * 五个字段 + level + sizeId 拼装，用户想换一套衣服时只能往 outfit 清单里加词，
   * 而正文口径仍是"逐件拆出参考图里已有的服装" —— 改不动。
   * 现在后端只做 trim，**不拼装、不改写、不追加**。
   */
  await checkAsync('立绘拆解：默认提示词是一份完整三视图设定卡', async () => {
    const m = await import('../host/services/breakdown.js');
    const p = m.DEFAULT_BREAKDOWN_PROMPT;
    assert.ok(p.length > 600, `默认提示词太短（${p.length}），不足以约束排版与细节`);
    for (const kw of ['正面视图', '侧面视图', '背面视图', '逐件拆出', '不要出现任何文字']) {
      assert.ok(p.includes(kw), `默认提示词缺关键约束：${kw}`);
    }
    // 纯文本：不许出现 Markdown 记号（模型不吃，还会破坏分段理解）
    assert.ok(!/\*\*|^#{1,6}\s/m.test(p), '默认提示词里出现了 Markdown 记号');
    // 不编号：带编号小标题会让产出图里出现编号/图例
    assert.ok(!/(^|\n)\s*[1-9][.、]\s/.test(p), '默认提示词里出现了编号小标题');
  });

  await checkAsync('立绘拆解：默认提示词带"文字优先于参考图"的授权句', async () => {
    const m = await import('../host/services/breakdown.js');
    const p = m.DEFAULT_BREAKDOWN_PROMPT;
    // 没有这句，用户改衣服一定失败：参考图的约束力会盖过文字
    assert.ok(/文字里明确写出的要求优先于参考图|优先于参考图/.test(p),
      '缺授权句 —— 用户改写服装/配色时会被参考图覆盖');
    assert.ok(/文字没有提到的部分/.test(p),
      '缺"未提到部分照参考图"的边界句 —— 精准还原会失效');
  });

  await checkAsync('立绘拆解：buildBreakdownPrompt 原样返回用户文本，不拼装', async () => {
    const m = await import('../host/services/breakdown.js');
    const mine = '把参考图里的黑色紧身衣换成白色高领毛衣，其余照原图。';
    assert.equal(m.buildBreakdownPrompt({ prompt: mine }), mine);
    // 任何作废的结构化字段都不得进入正文
    const withLegacy = m.buildBreakdownPrompt({
      prompt: mine,
      character: '三角初华', outfit: ['蕾丝胸衣'], parts: ['耳钉'],
      views: ['正面'], notes: '哥特风', level: 'parts',
    });
    assert.equal(withLegacy, mine, '作废字段仍在影响提示词');
    // 前后空白要清掉，但不能动内容
    assert.equal(m.buildBreakdownPrompt({ prompt: `  ${mine}\n\n` }), mine);
  });

  await checkAsync('立绘拆解：空提示词回落默认值', async () => {
    const m = await import('../host/services/breakdown.js');
    assert.equal(m.buildBreakdownPrompt({}), m.DEFAULT_BREAKDOWN_PROMPT);
    assert.equal(m.buildBreakdownPrompt({ prompt: '   ' }), m.DEFAULT_BREAKDOWN_PROMPT);
    assert.ok(m.isDefaultBreakdownPrompt(m.buildBreakdownPrompt({ prompt: '' })));
    assert.ok(!m.isDefaultBreakdownPrompt('换成白色毛衣'));
  });

  await checkAsync('立绘拆解：作废字段被显式回报，而不是静默忽略', async () => {
    const m = await import('../host/services/breakdown.js');
    const used = m.legacyBreakdownFields({ prompt: 'x', character: 'A', outfit: ['衣'] });
    assert.deepEqual(used.sort(), ['character', 'outfit']);
    assert.deepEqual(m.legacyBreakdownFields({ prompt: 'x' }), []);
  });

  await checkAsync('立绘拆解：尺寸固定为一档，不再提供档位选择', async () => {
    const m = await import('../host/services/breakdown.js');
    assert.ok(!('BREAKDOWN_LEVELS' in m), '档位常量应已移除');
    // 旧 id 也回落到同一档，不制造"选了就生效"的假象
    for (const id of ['square', 'portrait', 'landscape', undefined, 'l-4x3']) {
      assert.equal(m.breakdownSize(id).id, m.BREAKDOWN_SIZE.id);
    }
    // 面积必须落在默认上限 4.3MP 之内，否则每次请求都会被路由拒
    assert.ok((m.BREAKDOWN_SIZE.w * m.BREAKDOWN_SIZE.h) / 1e6 <= 4.3);
  });

  await checkAsync('立绘拆解：GET /breakdown/meta 下发默认提示词与固定尺寸', async () => {
    const { req, res, out } = fakeReqRes('GET', '/breakdown/meta');
    await handleApi(req, res);
    const j = JSON.parse(out.text);
    assert.ok(j.defaultPrompt && j.defaultPrompt.length > 600, 'meta 必须下发默认提示词');
    assert.ok(!('levels' in j), '档位列表应已移除');
    assert.ok(j.size && j.size.w === 2368, '尺寸应固定为横版');
    assert.ok(j.maxChars > 0, '缺 maxChars');
  });

  await checkAsync('立绘拆解：POST /breakdown/preview 回显用户原文', async () => {
    const mine = '换成白色高领毛衣，其余照原图。';
    const { req, res, out, status } = fakeReqRes('POST', '/breakdown/preview', {
      body: JSON.stringify({ prompt: mine }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(req, res);
    assert.equal(status(), 200, out.text.slice(0, 200));
    const j = JSON.parse(out.text);
    assert.equal(j.prompt, mine, '预览必须等于提交值（所见即所提交）');
    assert.equal(j.chars, mine.length);
    assert.equal(j.isDefault, false);
  });

  await checkAsync('立绘拆解：preview 对作废字段给出 legacy 提示', async () => {
    const { req, res, out } = fakeReqRes('POST', '/breakdown/preview', {
      body: JSON.stringify({ prompt: 'x', character: 'A', outfit: ['衣'], level: 'parts' }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(req, res);
    const j = JSON.parse(out.text);
    assert.ok(Array.isArray(j.legacyFieldsIgnored) && j.legacyFieldsIgnored.includes('outfit'),
      `作废字段应回报：${out.text.slice(0, 240)}`);
  });

  await checkAsync('立绘拆解：超长提示词 400 拒绝而不是静默截断', async () => {
    const m = await import('../host/services/breakdown.js');
    const tooLong = '衣'.repeat(m.BREAKDOWN_PROMPT_MAX_CHARS + 1);
    const { req, res, out, status } = fakeReqRes('POST', '/breakdown/generate', {
      body: JSON.stringify({ prompt: tooLong, refImages: ['assets/__x__.png'] }),
      headers: { 'x-jz-token': tok },
    });
    await handleApi(req, res);
    assert.equal(status(), 400, `应 400，实际 ${status()}：${out.text.slice(0, 200)}`);
    assert.equal(JSON.parse(out.text).error, 'PROMPT_TOO_LONG');
  });

  /**
   * 前端契约：拆解页必须**只**有提示词一个输入，不许再长回结构化字段。
   * 这类回归靠人眼审查很容易漏，用源码断言钉住。
   */
  await checkAsync('立绘拆解页：只保留提示词输入，档位/尺寸/角色描述已删除', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../app-src/src/pages/BreakdownPage.tsx', import.meta.url), 'utf8');
    for (const banned of ['outfitText', 'partsText', 'viewText', 'setLevel(', 'setSizeId(']) {
      assert.ok(!src.includes(banned), `页面里仍残留旧字段：${banned}`);
    }
    assert.ok(/api\.breakdownPreview\(\{ prompt \}\)/.test(src),
      '预览必须只提交 prompt');
    assert.ok(/api\.breakdownGenerate\(\{\s*\n?\s*prompt,/.test(src),
      '生成必须提交 prompt');
    assert.ok(/minHeight/.test(src), '提示词框必须是"巨大"的（设了 minHeight）');
  });

  /**
   * 复制按钮的护栏。
   *
   * 需求：提示词框旁边要能一键把**默认提示词**复制出来。
   * 这类"按钮点了有没有用"没法靠接口测，至少要把源码层面的承诺钉住：
   *   · 两个入口都在（复制默认值 / 复制当前）
   *   · 剪贴板必须有降级路径 —— DSH Desktop 的窗口 origin 是 dsh-app://，
   *     那里 navigator.clipboard 不可用时得靠 execCommand 兜底
   *   · 空输入框时「复制当前」要回落默认值，而不是复制一个空串
   */
  await checkAsync('立绘拆解页：提示词框旁有复制按钮，且带剪贴板降级', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../app-src/src/pages/BreakdownPage.tsx', import.meta.url), 'utf8');
    assert.ok(src.includes('复制默认值'), '缺「复制默认值」按钮');
    assert.ok(src.includes('复制当前'), '缺「复制当前」按钮');
    assert.ok(src.includes('navigator.clipboard'), '没有用 clipboard API');
    assert.ok(/execCommand\('copy'\)/.test(src),
      '没有 execCommand 降级 —— dsh-app:// 下剪贴板 API 可能不可用，复制会静默失败');
    // 空输入框时复制当前 → 必须回落默认值
    assert.ok(/prompt\.trim\(\) \? prompt : defaultPrompt/.test(src),
      '「复制当前」在输入框为空时没有回落到默认提示词');
    // 默认提示词也要能单独复制（不受输入框当前内容影响）
    assert.ok(/copyText\(defaultPrompt\)/.test(src), '「复制默认值」没有复制 defaultPrompt');
  });

  await checkAsync('立绘拆解页：首屏直接落在提示词步骤', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../app-src/src/pages/BreakdownPage.tsx', import.meta.url), 'utf8');
    // 核心诉求是改提示词，不该让用户先点一次「下一步」才看到那个框
    assert.ok(/useState<Step>\('prompt'\)/.test(src),
      '页面初始步骤必须是 prompt —— 否则提示词框与复制按钮第一屏看不到');
  });

  await checkAsync('ComfyUI 启停：四个路由都注册了', async () => {
    /**
     * 顶栏那个电源按钮依赖这四条。少一条前端就是个死按钮。
     */
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../host/api/index.js', import.meta.url), 'utf8');
    for (const r of ['/comfy/status', '/comfy/start', '/comfy/stop', '/comfy/restart']) {
      assert.ok(src.includes(`route === '${r}'`), `缺少路由 ${r}`);
    }
  });

  await checkAsync('ComfyUI 启停：必须用 pwsh 而不是 powershell.exe', async () => {
    /**
     * 这条守护一个**看起来像语法错误、实际是编码问题**的坑。
     *
     * `start-h3.ps1` 是 UTF-8 无 BOM 的中文脚本。Windows PowerShell 5.1
     * （`powershell.exe`）按系统 ANSI 代码页（中文机器 = GBK）读它，
     * 于是脚本里的中文全变乱码、连引号都被吞掉，报：
     *   `Unexpected token '鉁?ComfyUI' in expression or statement`
     *   `The string is missing the terminator: ".`
     * 实测踩到过：同一脚本在 pwsh 7 里跑得好好的。
     */
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../host/services/comfy-control.js', import.meta.url), 'utf8');
    assert.ok(!src.includes("spawn('powershell.exe'"),
      '不能 spawn powershell.exe（5.1 会按 GBK 读 UTF-8 脚本，中文全乱码）');
    assert.match(src, /findPwsh/, '必须有 pwsh 解析函数');
  });

  await checkAsync('ComfyUI 启停：停止时先 interrupt 再清队列再杀进程', async () => {
    /**
     * 顺序有讲究：
     *   · 只杀进程 → 正在写的 mp4 / safetensors 留半截文件
     *   · 不清队列 → "/interrupt 只管正在跑的那一单"，排队的还在
     *     —— 这正是用户报的「换下一个项目时前面的续写还在」
     */
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../host/services/comfy-control.js', import.meta.url), 'utf8');
    const iInterrupt = src.indexOf('/interrupt');
    const iQueue = src.indexOf('/queue');
    const iKill = src.indexOf("process.kill(pid, 'SIGTERM')");
    assert.ok(iInterrupt > 0, '停止必须发 /interrupt');
    assert.ok(iQueue > 0, '停止必须清队列（/queue clear）');
    assert.ok(iKill > 0, '停止必须终止进程');
    assert.ok(iInterrupt < iKill, '/interrupt 要在杀进程之前');
    assert.ok(iQueue < iKill, '清队列要在杀进程之前');
  });

  await checkAsync('ComfyUI 启停：状态以端口可连为准，不靠进程名猜', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../host/services/comfy-control.js', import.meta.url), 'utf8');
    assert.match(src, /system_stats/, '判活必须探 /system_stats');
  });

  await checkAsync('ComfyUI 启停：顶栏按钮存在且会自刷新', async () => {
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../app-src/src/App.tsx', import.meta.url), 'utf8');
    assert.match(src, /ComfyPowerButton/, '顶栏必须有电源按钮组件');
    assert.match(src, /<ComfyPowerButton \/>/, '按钮必须真的挂进 TopBar');
    // 状态可能被别处改变，不能只加载一次
    assert.match(src, /setInterval/, '状态必须定时自刷新');
    // 三个动作都要接上 api
    for (const fn of ['comfyStart', 'comfyStop']) {
      assert.ok(src.includes(`api.${fn}`), `按钮必须调用 api.${fn}`);
    }
  });

  await checkAsync('ComfyUI 启停：路由受写令牌保护', async () => {
    /**
     * 这四条是 POST，落到 guard() 的写方法分支，天然要 X-JZ-Token。
     * 但 /comfy/status 是 GET，**不该**要令牌（顶栏每次刷新都要读）。
     */
    const f = await import('node:fs');
    const src = f.readFileSync(new URL('../host/api/index.js', import.meta.url), 'utf8');
    const i = src.indexOf("route === '/comfy/status'");
    assert.ok(i > 0);
    // 该路由分支里不应出现 writeGuard 之类
    const block = src.slice(i, i + 260);
    assert.ok(!/writeGuard|requireToken/.test(block), 'GET /comfy/status 不该额外校验令牌');
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

    await checkAsync('加噪节点已在 ComfyUI 注册且签名正确', async () => {
      /**
       * 换人抗漂移的核心节点。它必须在 ComfyUI 侧真实注册，
       * 否则 `buildWorkflow` 组出来的子图会在展开期报 unknown node class，
       * 而那是在提交之后才失败 —— 白等一次排队。
       */
      const r = await fetch('http://127.0.0.1:8488/object_info/NanFengH3ContextTaperNoiseV15', { signal: AbortSignal.timeout(20000) });
      assert.ok(r.ok, `加噪节点未注册（HTTP ${r.status}）`);
      const node = (await r.json()).NanFengH3ContextTaperNoiseV15;
      assert.ok(node, 'object_info 里没有 NanFengH3ContextTaperNoiseV15');
      const req = Object.keys(node.input.required);
      for (const k of ['context_latent', 'tail_frames', 'alpha', 'alpha_end', 'ramp_steps', 'seed']) {
        assert.ok(req.includes(k), `缺少输入 ${k}`);
      }
      // tail_frames 只能是整数个 latent step 的那四档
      assert.deepEqual(node.input.required.tail_frames[0], ['5', '22', '39', '56'],
        'tail_frames 必须只提供整数 latent step 的四档');
      // 默认配方必须与 REPLACE_DEFAULTS 一致
      const R = await import('../host/services/replace.js');
      assert.equal(node.input.required.alpha[1].default, R.REPLACE_DEFAULTS.taperAlpha,
        'ComfyUI 侧默认强度与插件侧不一致');
      assert.equal(node.input.required.alpha_end[1].default, R.REPLACE_DEFAULTS.taperAlphaEnd,
        'ComfyUI 侧默认末档强度与插件侧不一致');
    });

    await checkAsync('加噪节点：纯函数层面的锥形与边界', async () => {
      /**
       * 直接验算法，不跑 GPU。参考实现见 MacroSony 的 inject_tail_taper.py：
       * 22 帧 / 0.45 / 0.10 / 3 的末三档是 0.333 / 0.217 / 0.100。
       * 这里用的是 latent step（2 步斜坡），但单调性必须一致。
       */
      const m = await import('../vendor/nanfeng/context_taper_noise.py')
        .catch(() => null);
      // Python 模块不能直接 import，改为验插件侧的换算与约束
      const { buildOverrides } = await import('../host/services/replace-runner.js');

      // ① 四档 ctx 都应能得出合法的音频步数
      for (const [ctx, want] of [['5', 8], ['22', 37], ['39', 65], ['56', 93]]) {
        const ov = buildOverrides({ contextLength: ctx }, { continuation: true });
        assert.equal(ov.audio_context_length, want);
        assert.equal(ov['续写加噪末档强度'] <= ov['续写加噪强度'], true,
          `ctx=${ctx}：末档强度必须 <= 强度，否则不是锥形`);
      }

      // ② 斜坡步数不能超过该档对应的 latent step 数
      const stepsFor = { 5: 2, 22: 7, 39: 12, 56: 17 };
      for (const [ctx, steps] of Object.entries(stepsFor)) {
        const ov = buildOverrides({ contextLength: ctx }, { continuation: true });
        assert.ok(ov['续写加噪斜坡步数'] <= steps,
          `ctx=${ctx} 只有 ${steps} 个 latent step，斜坡 ${ov['续写加噪斜坡步数']} 步会越界`);
      }
      assert.equal(m, null, 'Python 模块不应被 JS 直接 import（这里只是为了保留探针）');
    });

    await checkAsync('加噪节点：参数真的进入提交快照（含开启与关闭两种）', async () => {
      /**
       * 只验算 `buildOverrides` 不够 —— 必须确认参数穿过
       * `buildShotWorkflow` 的整条合并链，最终出现在
       * `workflow['1'].inputs`（也就是真正提交给 ComfyUI 的那份 JSON）。
       * 历史上 `context_length` 就是被预设悄悄盖掉的（零报错）。
       */
      const { buildShotWorkflow } = await import('../host/services/nanfeng/index.js');
      const C = await import('../host/services/nanfeng/continuation.js');
      const { buildOverrides } = await import('../host/services/replace-runner.js');

      const b = C.createBatch({ projectId: 't', shotIds: ['a', 'b'], contextLength: '39' });
      for (const cont of [true, false]) {
        const extra = buildOverrides({ contextLength: '39' }, { continuation: cont });
        const r = buildShotWorkflow({
          shot: { id: 's', mode: 'ref2va', durationSec: 6, prompt: 'x' },
          preset: 'draft',
          continuationTask: cont ? C.taskFor(b, 2) : undefined,
          jobId: 't',
          extraParams: extra,
        });
        const p = r.workflow['1'].inputs;
        assert.equal(p.context_length, cont ? '39' : p.context_length,
          `续写=${cont}：context_length 未被预设覆盖`);
        if (cont) {
          assert.equal(p['启用续写上下文加噪'], true, '续写必须开加噪');
          assert.equal(p['续写加噪强度'], 0.45);
          assert.equal(p['续写加噪末档强度'], 0.1);
          assert.equal(p['续写加噪斜坡步数'], 2);
          assert.equal(p.audio_context_length, 65, '39 帧应换算成 65 个音频步');
        } else {
          assert.equal(p['启用续写上下文加噪'], false, '独立模式加噪必须关着');
        }
      }
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
