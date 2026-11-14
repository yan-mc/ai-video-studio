/**
 * Blender 预演渲染服务 —— 把镜头卡渲成 H3 能吃的控制序列。
 *
 * ============================================================================
 * 为什么是子进程而不是 addon
 * ============================================================================
 *
 * Blender 本体是 GPL；但**以子进程方式调用**（`blender -b --python xxx.py`）
 * 是两个独立程序通过命令行通信，不构成衍生作品 —— 插件本体（本文件及 JS 侧）
 * 可以继续用自己的许可，只有 host/blender/*.py 那几个脚本按 GPL 释放。
 *
 * 写成 addon（`import bpy` 的常驻扩展）才会把整个插件拖进 GPL 传染范围。
 *
 * ============================================================================
 * 坐标系（最容易搞错的地方）
 * ============================================================================
 *
 *   镜头卡 / 预演引擎：**(x, y=高度, z=深度)**  ← 参考产品约定
 *   Blender：          **(x, y=深度, z=高度)**  ← Z-up
 *
 * `toBlenderVec()` 是**唯一**换算点。任何新增的坐标入口都必须走它，
 * 否则会出现"人偶躺平"（实测踩过：身高长在深度轴上，渲染只剩几个球）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config.js';
import { safeJoin } from '../security.js';

/** 支持的输出通道 —— 与 render_shot.py 的 MODE 一一对应 */
export const BLENDER_MODES = Object.freeze(['depth', 'pose', 'canny', 'gray', 'preview']);

/** 控制通道（喂给 H3 的）；preview 只给人看，不参与控制 */
export const CONTROL_MODES = Object.freeze(['depth', 'pose', 'canny', 'gray']);

const HERE = import.meta.dirname;
const SCRIPT = path.join(HERE, '..', 'blender', 'render_shot.py');

/* --------------------------------------------------------------- 工具定位 */

/**
 * 定位 Blender 可执行文件。
 *
 * 优先级与 ffmpeg 一致（可执行路径**不接受配置注入**，避免 RCE）：
 *   1) 环境变量 DSH_BLENDER / BLENDER_EXE
 *   2) 插件自带 `<插件根>/../tools/blender-<版本>/blender.exe`（本地开发布局）
 *   3) 环境变量 DSH_BLENDER_DIR 指向的目录
 *   4) PATH
 */
export function resolveBlender() {
  const exe = process.platform === 'win32' ? 'blender.exe' : 'blender';

  for (const key of ['DSH_BLENDER', 'BLENDER_EXE', 'BLENDER_PATH']) {
    const v = process.env[key];
    if (v) { try { if (fs.existsSync(v)) return v; } catch { /* ignore */ } }
  }

  // 显式目录
  const explicitDir = process.env.DSH_BLENDER_DIR;
  if (explicitDir) {
    const p = path.join(explicitDir, exe);
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }

  // 插件在 <workspace>/工作室/dsh-jiuzhang-studio，tools 在 <workspace>/工作室/tools
  const toolRoots = [
    path.resolve(HERE, '..', '..', '..', 'tools'),
    path.resolve(HERE, '..', '..', 'tools'),
  ];
  for (const root of toolRoots) {
    try {
      if (!fs.existsSync(root)) continue;
      for (const name of fs.readdirSync(root)) {
        if (!name.startsWith('blender-')) continue;
        const p = path.join(root, name, exe);
        if (fs.existsSync(p)) return p;
      }
    } catch { /* ignore */ }
  }
  return exe;
}

/** Blender 是否可用（health 用） */
export function blenderStatus() {
  const exe = resolveBlender();
  const available = exe !== 'blender' && exe !== 'blender.exe';
  return {
    ok: available,
    exe,
    available,
    modes: [...BLENDER_MODES],
    script: fs.existsSync(SCRIPT) ? SCRIPT : null,
    detail: available ? '已就绪' : '未找到 Blender（设 DSH_BLENDER 或放入 tools/blender-<版本>）',
  };
}

function runProc(exe, args, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const cap = (s, chunk) => {
      const next = s + chunk.toString();
      return next.length > 100000 ? next.slice(-100000) : next;
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error('BLENDER_TIMEOUT: ' + timeoutMs + 'ms'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout = cap(stdout, d); });
    child.stderr.on('data', (d) => { stderr = cap(stderr, d); });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('BLENDER_SPAWN_FAILED: ' + e.message)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      // Blender 无头渲染即使成功也常返回非 0（插件/GPU 警告），
      // 所以**以产物是否存在**为准，退出码只作附带信息。
      resolve({ code, stdout, stderr });
    });
  });
}

/* --------------------------------------------------------------- 坐标换算 */

/**
 * 镜头卡坐标 → Blender 坐标。
 *
 * 镜头卡用 (x, y=高度, z=深度)；Blender 用 (x, y=深度, z=高度)。
 * ⚠️ 深度取负：镜头卡的 +z 是"朝观众"，Blender 的 -y 才是"朝观众"
 *    （相机默认放在 -y 侧朝 +y 看），这样两边语义一致。
 */
export function toBlenderVec(v, fallback = [0, 0, 0]) {
  if (!Array.isArray(v) || v.length < 3) return [...fallback];
  const n = v.map((x) => Number(x));
  if (!n.every((x) => Number.isFinite(x))) return [...fallback];
  return [n[0], -n[2], n[1]];
}

/* --------------------------------------------------------------- 场景构建 */

/** 按画幅算渲染尺寸（32 倍数，像素预算） */
export function sizeForRatio(ratio, pixels = 0.4 * 1024 * 1024) {
  const [rw, rh] = String(ratio || '16:9').split(':').map(Number);
  let w = 864;
  let h = 480;
  if (Number.isFinite(rw) && Number.isFinite(rh) && rw > 0 && rh > 0) {
    const r = rw / rh;
    h = Math.round(Math.sqrt(pixels / r));
    w = Math.round(h * r);
  }
  return {
    width: Math.max(64, Math.round(w / 32) * 32),
    height: Math.max(64, Math.round(h / 32) * 32),
  };
}

/**
 * 把镜头卡转成 render_shot.py 的场景 spec。
 *
 * 字段映射（镜头卡 → spec）：
 *   durationSec → frames = round(durationSec × 24)
 *   ratio       → width/height（按像素预算，32 倍数）
 *   actors[]    → 人偶（含 assetRel 时可换成导入模型）
 *   props[]     → 灰盒道具
 *   camera3d    → 机位 + 关键帧（有 keys 才能渲运镜）
 *
 * 没有 `actors` 时退回"默认两人对峙"，并在返回体标 `derived: true` ——
 * 上层据此提示用户"这只是占位，真实走位需要配 actors"。
 */
export function buildSceneSpec(shot, opts = {}) {
  const fps = 24;
  const dur = Math.min(15, Math.max(1, Number(shot?.durationSec) || 5));
  const frames = Math.max(5, Math.round(opts.frames || dur * fps));
  const { width, height } = sizeForRatio(shot?.ratio, opts.pixels);

  const derived = !Array.isArray(shot?.actors) || shot.actors.length === 0;
  const actorSrc = derived
    ? [
      { name: 'A', heightM: 1.72, color: '#ffffff', position: [-0.6, 0, 0], action: 'stand' },
      { name: 'B', heightM: 1.70, color: '#ffffff', position: [0.6, 0, 0], action: 'stand' },
    ]
    : shot.actors;

  const actors = actorSrc.map((a, i) => ({
    name: String(a.name || `Actor${i + 1}`),
    heightM: Number(a.heightM) || 1.72,
    color: a.color || '#ffffff',
    position: toBlenderVec(a.position ?? a.from),
    rotationDeg: Number(a.rotationDeg) || 0,
    action: String(a.action || 'stand'),
    startFrame: Math.max(0, Math.round(Number(a.startFrame) || 0)),
    durationFrames: Math.max(1, Math.round(Number(a.durationFrames) || frames)),
    ...(Array.isArray(a.from) ? { from: toBlenderVec(a.from) } : {}),
    ...(Array.isArray(a.to) ? { to: toBlenderVec(a.to) } : {}),
    emotion: a.emotion || 'neutral',
    intensity: Number(a.intensity) || 1,
    ...(a.assetRel ? { assetRel: String(a.assetRel) } : {}),
  }));

  const props = (Array.isArray(shot?.props) ? shot.props : []).map((p, i) => ({
    kind: String(p.kind || 'box'),
    name: String(p.name || `Prop${i + 1}`),
    position: toBlenderVec(p.position),
    rotationDeg: Number(p.rotationDeg) || 0,
    scale: Array.isArray(p.scale) && p.scale.length >= 3
      ? p.scale.slice(0, 3).map((v) => Number(v) || 1)
      : [1, 1, 1],
    color: p.color || '#9aa0a6',
    ...(p.assetRel ? { assetRel: String(p.assetRel) } : {}),
  }));

  const cam = shot?.camera3d || {};
  const camera = {
    // 默认机位用**镜头卡语义**：(x=0, y=1.6 高度, z=-4.2 深度)
    // 换算成 Blender 后是 (0, 4.2, 1.6) —— 相机在人物 +z 侧往里看
    position: toBlenderVec(cam.position, [0, 1.6, -4.2]),
    target: toBlenderVec(cam.target, [0, 0.95, 0]),
    fov: Math.min(140, Math.max(5, Number(cam.fov) || 45)),
  };
  if (Array.isArray(cam.keys) && cam.keys.length >= 2) {
    camera.keys = cam.keys.map((k) => ({
      frame: Math.max(0, Math.round(Number(k.frame) || 0)),
      ...(Array.isArray(k.position) ? { position: toBlenderVec(k.position, camera.position) } : {}),
      ...(Array.isArray(k.target) ? { target: toBlenderVec(k.target, camera.target) } : {}),
      ...(Number.isFinite(Number(k.fov)) ? { fov: Number(k.fov) } : {}),
      ...(Number.isFinite(Number(k.rollDeg)) ? { rollDeg: Number(k.rollDeg) } : {}),
    }));
  }

  return {
    name: String(shot?.title || 'shot'),
    width,
    height,
    fps,
    frames,
    ground: shot?.ground !== false,
    groundSpan: Number(shot?.groundSpan) || 14,
    camera,
    actors,
    props,
    derived,
  };
}

/* --------------------------------------------------------------- 渲染调度 */

/**
 * 渲染一路控制序列，并编码成 mp4。
 *
 * @returns {Promise<{ok:boolean, mode:string, dir:string, mp4:string, rel:string,
 *                    frames:number, seconds:number, spec:string, blender:string, exitCode:number}>}
 */
export async function renderControl({ mode, spec, cfg = loadConfig(), jobId = '', timeoutMs = 600000 }) {
  if (!BLENDER_MODES.includes(mode)) throw new Error(`UNKNOWN_MODE: ${mode}`);
  const st = blenderStatus();
  if (!st.ok) throw new Error('BLENDER_NOT_FOUND: ' + st.detail);
  if (!st.script) throw new Error('BLENDER_SCRIPT_MISSING: ' + SCRIPT);

  // 把 spec 里引用的资产（glb/fbx）复制到 ComfyUI/Blender 都能读的位置。
  // ⚠️ Blender 的 import 需要**绝对路径**，所以这里把相对路径解析成绝对路径后
  //    直接写回 spec（render_shot.py 读的就是这个字段）。
  const prepared = prepareAssetPaths(spec, cfg);

  const stamp = (jobId || 'shot') + '_' + Date.now().toString(36);
  const workDir = path.join(cfg.dataDir, 'previz', 'blender', stamp);
  fs.mkdirSync(workDir, { recursive: true });

  const specPath = path.join(workDir, 'scene.json');
  fs.writeFileSync(specPath, JSON.stringify(prepared.spec, null, 2), 'utf8');

  const t0 = Date.now();
  const r = await runProc(st.exe, [
    '-b',
    '--factory-startup',        // 不加载用户配置/插件：结果可复现，也不受用户环境干扰
    '--disable-autoexec',       // 不跑自动执行脚本
    '--python', st.script,
    '--', mode, specPath, workDir,
  ], timeoutMs);

  const framesDir = path.join(workDir, mode);
  const pngs = fs.existsSync(framesDir)
    ? fs.readdirSync(framesDir).filter((f) => /^f_\d+\.png$/.test(f)).sort()
    : [];
  if (!pngs.length) {
    throw new Error('BLENDER_NO_OUTPUT: ' + String(r.stderr || r.stdout).slice(-600));
  }

  // PNG 序列 → mp4（H3 的 LoadVideo 吃视频，不吃图片目录）
  const mp4 = path.join(workDir, mode + ".mp4");
  const blendPath = path.join(workDir, "scene.blend");
  const blendRel = path.relative(cfg.dataDir, blendPath).replace(/\\\\/g, "/");
  const { resolveFfmpeg, runProcess } = await import("./seedance-client.js");
  const ffmpegExe = resolveFfmpeg(cfg);

  // canny 通道：Blender 只负责渲"干净灰模"，边缘检测交给 ffmpeg。
  //
  // ⚠️ 为什么不在 Blender 里做：
  //    ① Freestyle 在无头模式下要额外配 line set，渲染慢很多；
  //    ② 早期实现**漏了这一步**，导致 canny 与 gray 产物完全一样
  //       （实测两路 mp4 逐像素相同）—— 用户以为在控制边缘，其实喂的是灰模。
  const needEdges = mode === "canny";
  const rawMp4 = needEdges ? path.join(workDir, "canny_raw.mp4") : mp4;

  await runProcess(ffmpegExe, [
    "-y", "-v", "error",
    "-framerate", String(spec.fps || 24),
    "-i", path.join(framesDir, "f_%05d.png"),
    ...(needEdges ? ["-vf", "edgedetect=low=0.06:high=0.18"] : []),
    "-c:v", "libx264", "-preset", "veryfast",
    "-pix_fmt", "yuv420p", "-crf", "18",
    rawMp4,
  ], 300000);

  // edgedetect 出的是"黑底白线"；H3 的 canny 条件训练用"白底黑线"，再取反一次。
  if (needEdges) {
    await runProcess(ffmpegExe, [
      "-y", "-v", "error", "-i", rawMp4,
      "-vf", "negate",
      "-c:v", "libx264", "-preset", "veryfast",
      "-pix_fmt", "yuv420p", "-crf", "18",
      mp4,
    ], 300000);
  }

  return {
    ok: true,
    mode,
    dir: framesDir,
    mp4,
    rel: path.relative(cfg.dataDir, mp4).replace(/\\/g, '/'),
    frames: pngs.length,
    seconds: Math.round((Date.now() - t0) / 100) / 10,
    spec: path.relative(cfg.dataDir, specPath).replace(/\\/g, '/'),
    // .blend 由 render_shot.py 顺手保存；有它用户就能在桌面 Blender 里继续调
    blend: blendPath,
    blendRel: blendRel,
    blender: st.exe,
    exitCode: r.code,
    missingAssets: prepared.missing,
  };
}

/**
 * 用桌面 Blender 打开某个场景的 .blend。
 *
 * 为什么不做内嵌 3D 编辑器：浏览器里跑 WASM Blender 需要 COOP/COEP 隔离头
 * （会影响整个 SPA 的跨源资源），且它在 12GB 笔记本上的编辑流畅度未验证。
 * 装了桌面 Blender 的用户，直接开原生窗口体验最好、也真能随便调。
 * 页面上的「预览」负责"看"，这个负责"改"。
 *
 * @returns {Promise<{ok:boolean, pid?:number, file?:string, detail?:string}>}
 */
export async function openInBlender({ blendPath, cfg = loadConfig() } = {}) {
  const st = blenderStatus();
  if (!st.ok) throw new Error('BLENDER_NOT_FOUND: ' + st.detail);

  // 未指定时用最近的场景文件
  let file = blendPath || '';
  if (file && !path.isAbsolute(file)) {
    try { file = safeJoin(cfg.dataDir, file); } catch { throw new Error('BAD_BLEND_PATH'); }
  }
  if (!file) {
    const root = path.join(cfg.dataDir, 'previz', 'blender');
    let best = null;
    try {
      for (const d of fs.readdirSync(root)) {
        const p = path.join(root, d, 'scene.blend');
        try {
          const stt = fs.statSync(p);
          if (!best || stt.mtimeMs > best.mtimeMs) best = { p, mtimeMs: stt.mtimeMs };
        } catch { /* 没有就跳过 */ }
      }
    } catch { /* 目录不存在 */ }
    if (!best) throw new Error('BLEND_NOT_FOUND: 还没有渲染过场景');
    file = best.p;
  }
  if (!fs.existsSync(file)) throw new Error('BLEND_NOT_FOUND: ' + file);

  // 分离式启动：不 await 退出，否则 HTTP 请求会挂到用户关掉 Blender 为止
  const child = spawn(st.exe, [file], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  return { ok: true, pid: child.pid, file, detail: '已启动 Blender' };
}


/**
 * 把 spec 里 actor/prop 的 assetRel 解析成绝对路径。
 *
 * 找不到的资产**不静默丢弃**：记进 `missing` 返回给上层，
 * 同时退回程序化人偶（否则整镜渲不出来）。
 */
export function prepareAssetPaths(spec, cfg = loadConfig()) {
  const missing = [];
  const resolveOne = (rel) => {
    if (!rel) return undefined;
    try {
      const abs = path.isAbsolute(rel) ? rel : safeJoin(cfg.dataDir, rel);
      if (!fs.existsSync(abs)) { missing.push(rel); return undefined; }
      return abs;
    } catch { missing.push(rel); return undefined; }
  };
  const out = {
    ...spec,
    actors: spec.actors.map((a) => {
      const { assetRel, ...rest } = a;
      const abs = resolveOne(assetRel);
      return abs ? { ...rest, assetPath: abs } : rest;
    }),
    props: spec.props.map((p) => {
      const { assetRel, ...rest } = p;
      const abs = resolveOne(assetRel);
      return abs ? { ...rest, assetPath: abs } : rest;
    }),
  };
  return { spec: out, missing };
}

/* --------------------------------------------------------------- 动作库 */

/** 支持导入的 3D 资产格式 */
export const ASSET_EXTS = Object.freeze(['.glb', '.gltf', '.fbx', '.obj']);

/**
 * 扫描 dataDir 下的资产库，列出可用作 3D 模型的文件。
 *
 * 扫描 `assets/3d/` 与 `assets/` 根，返回 `{rel, name, kind, bytes}`。
 * kind：
 *   actor — .fbx 且有骨架（Mixamo 动作/角色），或文件名含 mixamo/char
 *   prop  — 其余模型
 * 名称用文件名去扩展名 —— 这是**唯一**稳定的标识（模型内部对象名不可靠）。
 */
export function listModelAssets(cfg = loadConfig()) {
  const roots = [
    path.join(cfg.dataDir, 'assets', '3d'),
    path.join(cfg.dataDir, 'assets'),
  ];
  const seen = new Set();
  const out = [];
  for (const root of roots) {
    let names = [];
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const n of names) {
      const ext = path.extname(n).toLowerCase();
      if (!ASSET_EXTS.includes(ext)) continue;
      const abs = path.join(root, n);
      let st;
      try { st = fs.statSync(abs); } catch { continue }
      if (!st.isFile()) continue;
      const rel = path.relative(cfg.dataDir, abs).replace(/\\/g, '/');
      if (seen.has(rel)) continue;
      seen.add(rel);
      out.push({
        rel,
        name: path.basename(n, ext),
        ext,
        bytes: st.size,
        // 粗略分类：fbx 多半是 Mixamo 角色/动作，glb/gltf 多是场景与道具
        kind: ext === '.fbx' ? 'actor' : 'prop',
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 列出某个 FBX/GLB 内部的动作（Action）名字。
 *
 * 为什么需要：Mixamo 导出的 Action 名是 `"mixamo.com"` 或
 * `"Armature|Armature|walk"` 这种，用户根本猜不到。
 * 这个函数**真的启动一次 Blender** 把动作名读出来 —— 比让用户猜靠谱。
 */
export async function listAssetActions({ assetRel, cfg = loadConfig(), timeoutMs = 120000 }) {
  const st = blenderStatus();
  if (!st.ok) throw new Error('BLENDER_NOT_FOUND: ' + st.detail);
  let abs;
  try {
    abs = path.isAbsolute(assetRel) ? assetRel : safeJoin(cfg.dataDir, assetRel);
  } catch { throw new Error('BAD_ASSET_PATH'); }
  if (!fs.existsSync(abs)) throw new Error('ASSET_NOT_FOUND: ' + assetRel);

  const probe = path.join(HERE, '..', 'blender', 'list_actions.py');
  if (!fs.existsSync(probe)) throw new Error('PROBE_SCRIPT_MISSING');
  const r = await runProc(st.exe, [
    '-b', '--factory-startup', '--disable-autoexec', '--python', probe, '--', abs,
  ], timeoutMs);
  const out = String(r.stdout || r.stderr || '');
  const m = /JZ_ACTIONS:(\[.*\])/s.exec(out);
  if (!m) throw new Error('ACTION_LIST_FAILED: ' + out.slice(-400));
  try {
    return { rel: assetRel, actions: JSON.parse(m[1]) };
  } catch { throw new Error('ACTION_LIST_PARSE_FAILED'); }
}
