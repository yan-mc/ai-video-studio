/**
 * 生成 engine.mjs —— 把 vendored 的 vendor + engine + server 三个 chunk 合并为可复用模块。
 *
 * 输入（vendored，只读）：
 *   src/previs-src/vendor_mcp_sdk_and_ajv_zod.js    （zod = B$、ajv、JSON-RPC framing = FR 等）
 *   src/previs-src/app_director_engine_module.js    （数据模型/求值/动作/运镜/校验/j5 工具表）
 *   src/previs-src/app_server_entry_module.js       （cE store、iE 执行器、OJ 状态投影、LR agent）
 * 输出：
 *   services/previz/engine.mjs
 *
 * 处理规则：
 *   1. chunk 顺序：vendor → engine → server（后者依赖前者的符号）。
 *   2. engine 文件开头有一段 stdio 传输类残片（其前部 vendor 已提供），从 `import { createReadStream` 起截取。
 *   3. 三个 chunk 的 import 语句统一剥离，改由 deps 注入（fs/os/path/http/child_process）。
 *   4. server 的 stdio MCP 入口（`new Wz(...)` / `connect(...)` / `process.argv` 启动）剥离。
 *   5. 末尾导出 engineSource(deps) → { buildService({home}) }。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const srcDir = join(root, 'src', 'previs-src');

const read = (f) => readFileSync(join(srcDir, f), 'utf8');
const stripImports = (src) => src.replace(/^import[^\n]*\n/gm, '');
const cutFrom = (src, marker) => {
  const i = src.indexOf(marker);
  return i >= 0 ? src.slice(i) : src;
};
const cutAt = (src, marker) => {
  const i = src.indexOf(marker);
  return i >= 0 ? src.slice(0, i) : src;
};

// 1) vendor：保留到 FR（JSON-RPC framing）为止；丢弃其尾部未闭合的 stdio 传输类
let vendor = stripImports(read('vendor_mcp_sdk_and_ajv_zod.js'));
vendor = cutAt(vendor, 'class Xz {');
// 2) engine：从真正的引擎代码起点截取，去掉前面 stdio 传输残片
let engine = stripImports(cutFrom(read('app_director_engine_module.js'), 'import { createReadStream'));
// engine 内部可能仍有 import（上面 cutFrom 以 import 开头，需再次剥离）
engine = stripImports(engine);
// 3) server：保留到 stdio 入口之前
let server = stripImports(cutAt(read('app_server_entry_module.js'), 'var __ = new iE();'));
// 移除对 MCP server 类的构造/注册（传输层，不需要）
server = server
  .replace(/new Wz\([\s\S]*?\);/g, '/* transport removed */')
  .replace(/\.registerTool\([\s\S]*?\}\);/g, '/* registerTool removed */')
  .replace(/await \$\.connect\(new Xz\(\)\);/g, '/* connect removed */');

const out = `/**
 * engine.mjs — 由 tools/build-engine.mjs 从预演引擎源码生成（vendor + engine + server）。
 * 来源：闭源预演软件 1.0.19 拆解（闭源，仅本地自用；见 工作室/vendor/PROVENANCE.md）。
 * 不要手工编辑；改 build-engine.mjs 后重新生成。
 */
export function engineSource(deps) {
  const { mkdir, readFile, rename, writeFile, homedir, dirname, join } = deps;
  // 兼容预演引擎源码里的 import 别名（server 侧）
  const ti = mkdir, ei = readFile, $o = rename, Jo = writeFile, Uo = homedir, Wo = dirname, dE = join;
  // 兼容预演引擎源码里的 import 别名（engine 侧）
  const Al = deps.createReadStream, Ml = deps.access, Rl = deps.stat, Zl = deps.createServer;
  const Pl = deps.extname, Dz = join, _l = deps.normalize, Sl = deps.resolve, Cl = deps.fileURLToPath;
  const Dl = deps.spawn, Hl = deps.access, Gl = deps.mkdtemp, Kl = readFile, Nl = deps.rm, Ol = writeFile;
  const Fl = deps.tmpdir, Yz = join, MR = deps.webcrypto;

/* ================= vendor chunk (zod / ajv / framing) ================= */
${vendor}

/* ================= engine chunk ================= */
${engine}

/* ================= server chunk ================= */
${server}

  /* ---- 元素投影（BUG-1）----
     渲染器 web/render.html 消费字段：kind/position/rotationDeg/scale/poseId/joints，
     以及 color（第 92 行取色）、heightM（第 98/101 行身高）、rows/cols/spacing（第 110 行群众阵列）。
     旧实现只透传 8 个字段，导致 color/heightM 丢失 → buildObject 回退到 #e1e3e7 默认灰，
     演员全灰白、群众阵列退化成 3x3。这里统一投影，evaluate 与 previzPackage 共用。 */
  function __previzProjectElement(e) {
    const out = {
      id: e.id, name: e.name, kind: e.kind, visible: e.visible,
      position: e.position, rotationDeg: e.rotationDeg, scale: e.scale,
      poseId: e.poseId, joints: e.joints || null,
    };
    const extra = ['color', 'heightM', 'rows', 'cols', 'spacing', 'bodyType', 'animalSpecies'];
    for (const k of extra) if (e[k] !== undefined && e[k] !== null) out[k] = e[k];
    return out;
  }

  /* ---- 同一方案/镜头的解析助手（BUG-4）：显式 shotId → activeShotId，绝不静默取 shots[0] ---- */
  function __previzResolvePlan(project) {
    const plan = project.plans.find((p) => p.id === project.activePlanId) || project.plans[0];
    if (!plan || !Array.isArray(plan.shots) || plan.shots.length === 0) throw new Error('预演方案里没有可用镜头');
    return plan;
  }
  function __previzResolveShot(plan, project, shotId) {
    const requested = shotId === undefined || shotId === null || String(shotId).trim() === '' ? null : String(shotId).trim();
    const hit = requested ? plan.shots.find((s) => s.id === requested) : null;
    if (hit) return { shot: hit, requested, matched: true, fallback: false, resolvedFrom: 'shotId' };
    const activeId = project.activeShotId || plan.activeShotId || null;
    const active = activeId ? plan.shots.find((s) => s.id === activeId) : null;
    if (!active) throw new Error('previzPackage: 需要有效 shotId 或 activeShotId；拒绝静默回退到第一个镜头');
    return { shot: active, requested, matched: false, fallback: true, resolvedFrom: 'activeShotId' };
  }

  /* ---- 工厂：注入 home，返回执行面 ---- */
  function buildService(opts = {}) {
    const home = opts.home || process.env.PREVIZ_HOME || process.env.PREVIZ_ENGINE_HOME;
    const repo = new cE(home);
    const exec = new iE(repo);
    return {
      repository: repo,
      execute: (name, args) => exec.execute(name, args),
      agentChat: (messages) => LR(exec, messages),
      state: () => exec.execute('director_get_state', {}),
      tools: () => Object.keys(j5),
      // 预演导出：按秒求值当前帧（镜头/相机/元素位姿），供首尾帧/参考视频生成使用
      evaluate: async (timeSec) => {
        const st = await exec.execute('director_get_state', {});
        const project = st.project;
        const plan = __previzResolvePlan(project);
        const { shot } = __previzResolveShot(plan, project, null);
        const t = Number.isFinite(Number(timeSec)) ? Number(timeSec) : shot.startSec;
        const evaluated = Iz(plan, project.elements, t);
        return {
          timeSec: t,
          shot: { id: shot.id, name: shot.name, startSec: shot.startSec, durationSec: shot.durationSec, aspect: shot.aspect, fov: shot.fov },
          camera: evaluated?.camera || { position: shot.position, target: shot.target, fov: shot.fov, rollDeg: 0 },
          elements: (evaluated?.elements || []).map(__previzProjectElement),
          fps: 24,
        };
      },
      // 预演包：把镜头的时间轴采样成可供 H3 使用的参考序列（首帧/尾帧/中间帧）
      // BUG-2：采样点必须严格落在 [startSec, startSec+durationSec) 半开区间内。
      //   Iz() 内部用 nl() 选镜头，边界 t = startSec+durationSec 会命中**下一个**镜头
      //   （Shot 1 边界 3.75s 会取到 Shot 2 的 fov=42 / 相机 (2.6,2.2,6.2)）。
      //   因此末帧取 lastSampleT = max(startSec, startSec + durationSec - 1/fps)，首帧仍是 startSec。
      // BUG-3：帧数由 durationSec × fps 决定（requestedFps，默认 24），samples 作为上限，
      //   这样 control.mp4 按 -framerate fps 合成后时长 ≈ 镜头时长；仍受 samples ≤ 48 上限约束。
      previzPackage: async (shotId, samples = 3) => {
        const st = await exec.execute('director_get_state', {});
        const project = st.project;
        const plan = __previzResolvePlan(project);
        const resolved = __previzResolveShot(plan, project, shotId);
        const shot = resolved.shot;
        const requestedFps = Math.max(1, Math.min(60, Number(st?.runtime?.fps) || 24));
        const sampleCap = Math.max(2, Math.min(48, Number(samples) || 3));
        const dur = Math.max(1 / requestedFps, Number(shot.durationSec) || 1 / requestedFps);
        // 覆盖整段时长所需的帧数；受 samples 上限约束，同时保持首/尾帧都在镜头内
        const n = Math.max(2, Math.min(sampleCap, Math.max(2, Math.round(dur * requestedFps))));
        const startT = Number(shot.startSec) || 0;
        const lastT = Math.max(startT, startT + dur - 1 / requestedFps);
        const span = lastT - startT;
        const frames = [];
        for (let i = 0; i < n; i++) {
          const t = startT + (span * i) / (n - 1);
          const evaluated = Iz(plan, project.elements, t);
          // 与 evaluate 使用同一套完整投影：渲染器需要 color/heightM/kind/scale/joints 等字段
          frames.push({
            index: i, timeSec: Number(t.toFixed(4)),
            camera: evaluated?.camera || { position: shot.position, target: shot.target, fov: shot.fov, rollDeg: 0 },
            elements: (evaluated?.elements || []).map(__previzProjectElement),
          });
        }
        return {
          schema: 'previz.package.v1',
          project: { id: project.id, name: project.name, aspect: project.aspect },
          shot: { id: shot.id, name: shot.name, startSec: shot.startSec, durationSec: shot.durationSec, aspect: shot.aspect, fov: shot.fov, cameraMove: shot.cameraMove },
          firstFrame: frames[0], lastFrame: frames[frames.length - 1], frames,
          sampling: {
            requestedShotId: resolved.requested, matched: resolved.matched, fallback: resolved.fallback, resolvedFrom: resolved.resolvedFrom,
            fps: requestedFps, samplesRequested: Number(samples) || 3, sampleCap, frameCount: n,
            startT, lastSampleT: Number(lastT.toFixed(4)), insideShot: lastT < startT + dur,
          },
          hints: {
            controlVideo: '用 frames[].camera + elements 渲染序列作为 control video；合成时 -framerate 应取 sampling.fps，使视频时长 ≈ shot.durationSec',
            firstFrameImage: '用 firstFrame 渲染首帧图片 → H3 {{FIRST_FRAME}}',
            lastFrameImage: '用 lastFrame 渲染尾帧图片 → H3 {{LAST_FRAME}}',
          },
        };
      },
    };
  }
  return { buildService };
}
`;

writeFileSync(join(root, 'engine.mjs'), out, 'utf8');
console.log(`engine.mjs written: ${out.length} bytes`);
