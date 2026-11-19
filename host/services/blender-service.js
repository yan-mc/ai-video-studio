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
import { safeJoin, safeId } from '../security.js';
import { DEFAULT_CAMERA3D, h3Length } from '../store/models.js';

/**
 * 支持的输出通道 —— 与 render_shot.py 的 MODE 一一对应。
 *
 * 只有两类，别混：
 *
 *  **参考视频通道**（REFERENCE_MODES）：blockout
 *    **社区标准交付物**。Blender 只负责运动与空间，渲一段灰模视频，
 *    直接进 Ref2VA 的 `ref_videos.ref_video_1`，不需要任何额外模型。
 *    实测：180° 环绕用 blockout 参考 6/6 成功，纯文字 0/6 稳定。
 *
 *  **人眼预览**：preview（彩色灰模，不参与任何生成）
 *
 * 历史说明：曾经还有一条「控制塔」路线（depth / pose / canny / gray 四通道 +
 * Fun ControlNet Union 逐帧约束）。它需要额外 4.22 GB 的 control patch 模型，
 * 单镜耗时 +83%，且四通道会互相打架（skip 相加 → 过饱和）。该路线经测试后
 * 放弃，已整条移除。
 */
export const BLENDER_MODES = Object.freeze(['preview', 'blockout']);

/**
 * 参考视频通道（喂给 Ref2VA 的 ref_videos）—— **唯一喂模型的出口**。
 *
 * 为什么把 blockout 单独列出来：它的用途、接法与 preview 完全不同。
 * 以前把它们混成一个"控制视频"概念，用户既分不清该渲哪个，也不知道
 * 渲完该填到镜头卡的哪个字段。
 */
export const REFERENCE_MODES = Object.freeze(['blockout']);

/** 这个人眼预览，不参与生成 */
export const PREVIEW_MODES = Object.freeze(['preview']);

/** 某个 mode 的产物该怎么用 */
export function modeUsage(mode) {
  if (REFERENCE_MODES.includes(mode)) return 'reference';
  if (PREVIEW_MODES.includes(mode)) return 'preview';
  return 'unknown';
}

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
    // 分类给前端：让用户一眼看出"该渲哪个"
    referenceModes: [...REFERENCE_MODES],
    previewModes: [...PREVIEW_MODES],
    script: fs.existsSync(SCRIPT) ? SCRIPT : null,
    detail: available ? '已就绪' : '未找到 Blender（设 DSH_BLENDER 或放入 tools/blender-<版本>）',
    /**
     * Blender 的唯一用途：渲一段灰模参考视频。
     *
     * 为什么不做控制塔：那要多下一个 4.22 GB 模型、单镜耗时 +83%、
     * 还要调 depth/pose 的强度配比；而灰模参考视频**零额外成本**，
     * 且社区实测成功率更高（180° 环绕 6/6 vs 纯文字 0/6）。
     */
    recommended: 'blockout',
    routes: [
      {
        id: 'blockout',
        name: '灰模参考视频（推荐）',
        mode: 'blockout',
        needsExtraModel: false,
        description: 'Blender 只渲一段灰模视频 → 填进镜头「参考视频」→ Ref2VA 的 <Video N> 取运镜与走位。不需要任何额外模型。',
      },
    ],
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
      reject(new BlenderError('BLENDER_TIMEOUT',
        `渲染超过 ${Math.round(timeoutMs / 1000)} 秒未完成（可提高 timeoutMs 或降低帧数/分辨率）`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout = cap(stdout, d); });
    child.stderr.on('data', (d) => { stderr = cap(stderr, d); });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new BlenderError('BLENDER_SPAWN_FAILED', e.message));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      // Blender 无头渲染即使成功也常返回非 0（GPU 警告等），
      // 所以**以产物是否存在**为准，退出码只作附带信息。
      resolve({ code, stdout, stderr });
    });
  });
}

/* --------------------------------------------------------- 产物与清理工具 */

/** 列出 5 位帧号的 PNG（跳过 4 位残留与其它文件）。 */
function listFrames(framesDir) {
  try {
    return fs.readdirSync(framesDir)
      .filter((f) => /^f_\d{5}\.png$/.test(f))
      .sort();
  } catch { return []; }
}

/**
 * 把 Blender 的失败日志翻译成用户能看懂的原因。
 *
 * 历史实现只甩 `BLENDER_NO_OUTPUT: <600 字 stderr>` —— 用户看到一坨 Blender
 * 内部日志，不知道该改什么。这里识别最常见的四类。
 */
function explainBlenderFailure(log, exitCode) {
  const s = String(log || '');
  if (/BLENDER_NO_FRAMES/.test(s)) {
    return { code: 'BLENDER_NO_FRAMES', detail: '场景渲染完成但没写出任何帧（检查 camera / 分辨率）' };
  }
  if (/ModuleNotFoundError|ImportError.*actions/.test(s)) {
    return { code: 'BLENDER_ACTIONS_MISSING', detail: 'actions.py 未随插件分发（host/blender/actions.py）' };
  }
  if (/unknown mode/.test(s)) {
    return { code: 'BLENDER_UNKNOWN_MODE', detail: 'render_shot.py 不认识该输出通道' };
  }
  if (/No camera|no camera/i.test(s)) {
    return { code: 'BLENDER_NO_CAMERA', detail: '场景里没有相机' };
  }
  if (/PermissionError/.test(s)) {
    return { code: 'BLENDER_PERMISSION', detail: '输出目录不可写（检查 dataDir 权限/占用）' };
  }
  if (/FileExistsError|WinError 183/.test(s)) {
    return { code: 'BLENDER_FILE_CONFLICT', detail: '输出目录里有同名残留文件' };
  }
  return {
    code: 'BLENDER_NO_OUTPUT',
    detail: `Blender 未产出帧（exit=${exitCode}）：${s.trim().split(/\r?\n/).slice(-6).join(' | ').slice(0, 400)}`,
  };
}

/**
 * 删掉一次渲染的工作目录。
 *
 * ⚠️ 只在**失败**时调用。成功产物要留着（用户可能要去素材库引用），
 *    由 prunePrevizRuns() 按保留策略统一清理。
 */
function cleanupWorkDir(workDir) {
  try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

/**
 * 按"保留最近 N 次 + 总字节上限"清理 previz 渲染目录。
 *
 * ⚠️ 历史实现完全没有清理：实测 5 次渲染就在 data/previz/blender/ 里留下
 *    452 个文件 / 74 MB，其中还有一次超时失败留下的 176 个半成品帧。
 *    extras.findOrphans 只管 data/assets/ 一层，previz 完全不在视野内。
 *
 * 策略：
 *   · 目录名形如 `<jobId>_<stamp36>`，按 mtime 排序；
 *   · 保留最近 keepRuns 个（默认 8）；
 *   · 再按总字节数从旧到新删，直到低于 maxBytes（默认 2 GB）；
 *   · 永远不删最近 1 个（用户刚渲的那个）。
 *
 * @returns {{removed:number, freedBytes:number}}
 */
/**
 * Collect previz render dir names that are still referenced by shot cards.
 *
 * Scans <dataDir>/shots/<pid>/shots.json and extracts the <stamp> from
 * control.videoRel / previz.firstFramePath / previz.lastFramePath.
 *
 * Rationale (real bug): the retention policy used to delete "old" render
 * dirs by mtime alone, including ones a shot card still pointed at. That made
 * "render control video, come back later, press generate" fail with
 * COMFY_STAGE_FAILED and no hint that auto-cleanup was the cause.
 *
 * Returns an empty set when nothing can be read -- prefer keeping files
 * over deleting something still in use.
 */
function collectReferencedPrevizDirs(cfg, previzRoot) {
  const out = new Set();
  const shotsRoot = path.join(cfg.dataDir, 'shots');
  let dirs = [];
  try {
    dirs = fs.readdirSync(shotsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch { return out; }

  const re = /previz[/\\]blender[/\\]([^/\\]+)/g;
  const scan = (v) => {
    if (typeof v === 'string') {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(v)) !== null) out.add(m[1]);
    } else if (Array.isArray(v)) {
      for (const x of v) scan(x);
    } else if (v && typeof v === 'object') {
      for (const x of Object.values(v)) scan(x);
    }
  };

  for (const d of dirs) {
    try {
      scan(JSON.parse(fs.readFileSync(path.join(shotsRoot, d, 'shots.json'), 'utf8')));
    } catch { /* one broken project must not block the rest */ }
  }
  try {
    for (const name of [...out]) {
      if (!fs.existsSync(path.join(previzRoot, name))) out.delete(name);
    }
  } catch { /* ignore */ }
  return out;
}


export function prunePrevizRuns(cfg = loadConfig(), { keepRuns = 8, maxBytes = 2 * 1024 ** 3 } = {}) {
  const root = path.join(cfg.dataDir, 'previz', 'blender');
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const abs = path.join(root, e.name);
        let bytes = 0;
        let mtime = 0;
        const walk = (dir) => {
          for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, item.name);
            if (item.isDirectory()) walk(p);
            else {
              try {
                const stt = fs.statSync(p);
                bytes += stt.size;
                if (stt.mtimeMs > mtime) mtime = stt.mtimeMs;
              } catch { /* ignore */ }
            }
          }
        };
        try { walk(abs); } catch { /* ignore */ }
        return { name: e.name, abs, bytes, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);     // 新 → 旧
  } catch { return { removed: 0, freedBytes: 0 }; }

  if (!entries.length) return { removed: 0, freedBytes: 0 };

  // Never delete a render dir a shot card still points at.
  const referenced = collectReferencedPrevizDirs(cfg, root);

  const keep = new Set(entries.slice(0, Math.max(1, keepRuns)).map((e) => e.name));
  let total = entries.reduce((s, e) => s + e.bytes, 0);
  let removed = 0;
  let freed = 0;

  for (const e of entries) {
    if (keep.has(e.name)) continue;
    if (e.name === entries[0].name) continue;      // 永不删最新一次
    if (referenced.has(e.name)) continue;          // still referenced by a shot
    const overCount = entries.length - removed > keepRuns;
    const overBytes = total > maxBytes;
    if (!overCount && !overBytes) continue;
    try {
      fs.rmSync(e.abs, { recursive: true, force: true });
      removed += 1;
      freed += e.bytes;
      total -= e.bytes;
    } catch { /* ignore */ }
  }
  return { removed, freedBytes: freed };
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

  /**
   * 帧数必须落在 H3 的 `17k+5` 网格上。
   *
   * ⚠️ 历史缺陷：这里以前写 `frames = round(dur * fps)`，5 秒 → **120 帧**。
   *    而 H3 的长度约束是 17k+5（124 / 141 / … / 362），120 根本不是合法值。
   *    后果：渲出来的控制/参考视频比目标视频**短 4 帧**，尾部的走位没人跟，
   *    模型只能自己编最后 1/6 秒 —— 表现为"最后一下动作突然失真"。
   *    参考视频被裁短这件事，社区已经专门记录过（120 帧 blockout 被裁成 107）。
   *
   *    现在统一按 h3Length() 取网格值，与生成时用的 `{{LENGTH}}` 完全一致。
   *    （h3Length 是 store/models.js 的**单一真源**，不要再在别处重算。）
   *
   * ⚠️ `opts.frames` 也**必须**落回网格。
   *    历史缺陷：`Math.round(opts.frames || h3Length(dur))` 在传入 frames 时
   *    完全绕过网格校验 —— 传 30 就是 30、传 100 就是 100、传 120 就是 120
   *    （注释上面痛骂过的 120 帧缺陷原样回来）。而传入路径是敞开的：
   *    `POST /blender/render` 的 body.frames、`studio_blender` 的 a.frames
   *    （schema 里连 min/max 都没有）。
   *    行为：把请求帧数换算成秒再取最近的网格值，非法值永远不会进 spec。
   */
  const requested = Number(opts.frames);
  const frames = Number.isFinite(requested) && requested > 0
    ? h3Length(requested / fps)
    : h3Length(dur);

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
  /**
   * ⚠️ 兜底值也必须走坐标换算。
   *
   * `toBlenderVec(v, fallback)` 的 `fallback` 是**原样返回**的 —— 它被
   * 假设成"已经是 Blender 坐标"。而 `DEFAULT_CAMERA3D` 是**镜头卡坐标**
   * （x, y=高度, z=深度）。把镜头卡坐标直接当 Blender 坐标用，相机会落在
   * (0, 1.6, -4.2)：Blender 的 Z-up 里那是"高度 1.6 米但深度 -4.2" →
   * 相机紧贴人物、几乎贴在演员身上，渲出来是**一整片纯灰**（实测：帧里
   * 看不到任何演员，只有背景色），而且逐帧完全相同（因为贴太近，
   * 演员的位移完全落在画面外）。
   *
   * 正确做法：先把默认值换算成 Blender 坐标，再把它当作 fallback 传下去。
   * 这样"没配 camera3d"和"配了等价 camera3d"两条路径得到同一个机位。
   */
  const DEFAULT_CAM_BLENDER = toBlenderVec([...DEFAULT_CAMERA3D.position]);
  const DEFAULT_TARGET_BLENDER = toBlenderVec([...DEFAULT_CAMERA3D.target]);

  const camera = {
    // 默认值取 models.DEFAULT_CAMERA3D —— **单一真源**，但要先换算坐标系。
    position: toBlenderVec(cam.position, DEFAULT_CAM_BLENDER),
    target: toBlenderVec(cam.target, DEFAULT_TARGET_BLENDER),
    fov: Math.min(140, Math.max(5, Number(cam.fov) || DEFAULT_CAMERA3D.fov)),
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
    /**
     * `derived: true` = 镜头卡里**没有配 actors**，这些是"两人对峙"占位人偶。
     *
     * ⚠️ 这个标记必须一路传到界面和生成链路。
     *    实测后果：拿一份没配走位的镜头卡渲 blockout，Blender 会按占位人偶
     *    渲出**两个静止的白色人形**；H3 把这两人当参考视频里的主体，
     *    于是输出里真的出现两个棕色人形剪影，而用户以为自己只要求了一个角色。
     *    （详见 docs/probes/ 里那次端到端截图。）
     *
     *    所以：占位人偶渲出来的参考视频**不能直接当参考视频用**。
     */
    derived,
    /** 给人看的警告，空数组表示走位已配置 */
    warnings: derived
      ? ['镜头卡没有配置 3D 走位，已用"两人对峙"占位人偶。这样渲出的参考视频会被模型当成真实主体，请先在「渲染页 → 3D 走位」里配好角色再渲。']
      : [],
  };
}

/* --------------------------------------------------------------- 渲染调度 */

/**
 * 结构化错误：带上机器可读的 code，前端不必从中文串里猜。
 */
export class BlenderError extends Error {
  constructor(code, detail = '', extra = {}) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BlenderError';
    this.code = code;
    this.detail = detail;
    Object.assign(this, extra);
  }
}

/**
 * 渲染一路控制序列，并编码成 mp4。
 *
 * @returns {Promise<{ok:boolean, mode:string, dir:string, mp4:string, rel:string,
 *                    frames:number, seconds:number, spec:string, blender:string, exitCode:number}>}
 */
export async function renderControl({ mode, spec, cfg = loadConfig(), jobId = '', timeoutMs = 600000 }) {
  if (!BLENDER_MODES.includes(mode)) {
    throw new BlenderError('UNKNOWN_MODE', `未知输出通道 ${mode}，可选 ${BLENDER_MODES.join('/')}`);
  }
  const st = blenderStatus();
  if (!st.ok) throw new BlenderError('BLENDER_NOT_FOUND', st.detail);
  if (!st.script) throw new BlenderError('BLENDER_SCRIPT_MISSING', SCRIPT);

  // 把 spec 里引用的资产（glb/fbx）解析成绝对路径。
  // ⚠️ Blender 的 import 需要绝对路径，所以这里把相对路径解析后写回 spec。
  const prepared = prepareAssetPaths(spec, cfg);

  /**
   * ⚠️ jobId 必须先过 safeId 再拼路径。
   *
   * 历史漏洞（安全级）：`jobId` 直接来自请求体
   * （`POST /blender/render {"jobId":"../../../../evil"}`），
   * 拼进 path.join 后 workDir **逃出 dataDir**（实测写到
   * `F:\AI视频\evil_xxx`），随后整个渲染产物与 scene.json 都落在仓库外。
   */
  const stamp = `${safeId(String(jobId || 'shot'))}_${Date.now().toString(36)}`;
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

  // 渲染完成后按保留策略清理旧 run。
  // ⚠️ 只删**更早的**：prunePrevizRuns 永不删最新一次，所以本次产物安全。
  //    历史实现完全没有清理：实测 5 次渲染留下 452 文件 / 74 MB。
  //
  // ⚠️ 调用位置也很关键：必须在**产物判定通过之后**再清理。
  //    放在前面时，一次正在收尾的并发渲染可能因为目录还是 0 文件
  //    （刚创建、尚未写帧）而被排到"最旧"并直接删掉。
  //    见下方 ok 分支末尾的调用。

  const framesDir = path.join(workDir, mode);
  const pngs = listFrames(framesDir);

  /**
   * ⚠️ 产物判定必须同时满足三条，缺一不可：
   *   1. 帧数 > 0
   *   2. 帧数**等于** spec 声明的 frames（部分渲染不能当成功）
   *   3. `_running` 哨兵不存在（render_shot.py 正常收尾才会删它）
   *
   * 历史缺陷：只判 `pngs.length > 0`。Blender 中途被杀 / 显存耗尽 /
   * pad 阶段崩掉时，磁盘上已有几十上百帧 5 位 PNG → 判定成功 →
   * ffmpeg 把残缺序列编成一段**时长错误**的 mp4 交给 H3，
   * 模型把残缺运动当完整参考，而用户看到的是「成功 124 帧」。
   * 这是最难发现的一类失败。
   */
  const wantFrames = Number(spec?.frames) || 0;
  const sentinelPath = path.join(workDir, '_running');
  const sentinelLeft = fs.existsSync(sentinelPath);

  if (!pngs.length || sentinelLeft || (wantFrames > 0 && pngs.length !== wantFrames)) {
    // ⚠️ 无产物时要把**为什么**说清楚，而不是甩 600 字 stderr 给用户。
    //    stdout / stderr 必须**分别**匹配再合并 —— 历史实现用
    //    `String(r.stderr || r.stdout || '')`，stderr 非空就永远不看 stdout，
    //    而 `BLENDER_RENDER_DONE` 等标记恰恰在 stdout。
    const log = `${r.stdout || ''}\n${r.stderr || ''}`;
    let reason = sentinelLeft
      ? {
        code: 'BLENDER_INCOMPLETE',
        detail: `渲染未正常收尾（进程被中断或崩在收尾阶段）：`
          + `已落盘 ${pngs.length} 帧 / 应为 ${wantFrames || '?'} 帧。`
          + '产物不完整，已丢弃，避免把残缺运动当成完整参考。',
      }
      : (wantFrames > 0 && pngs.length && pngs.length !== wantFrames)
        ? {
          code: 'BLENDER_INCOMPLETE_FRAMES',
          detail: `渲染帧数不足：已落盘 ${pngs.length} 帧 / 应为 ${wantFrames} 帧。`
            + '产物不完整，已丢弃。',
        }
        : explainBlenderFailure(log, r.code);
    cleanupWorkDir(workDir);
    throw new BlenderError(reason.code, reason.detail, { exitCode: r.code, log: log.slice(-2000) });
  }

  // PNG 序列 → mp4（H3 的 LoadVideo 吃视频，不吃图片目录）
  const mp4 = path.join(workDir, mode + ".mp4");
  const blendPath = path.join(workDir, "scene.blend");
  const blendRel = path.relative(cfg.dataDir, blendPath).replace(/\\/g, "/");
  const { resolveFfmpeg, runProcess } = await import("./ffmpeg-tools.js");
  const ffmpegExe = resolveFfmpeg(cfg);

  // PNG 序列 → mp4。Blender 的 FFmpeg 输出不可控（编码器参数、色彩管理
  // 都会插一脚），PNG 是"原样像素"，再由已有的 ffmpeg 链路统一编码，
  // 与插件其它后处理保持一致。
  await runProcess(ffmpegExe, [
    "-y", "-v", "error",
    "-framerate", String(spec.fps || 24),
    "-i", path.join(framesDir, "f_%05d.png"),
    "-c:v", "libx264", "-preset", "veryfast",
    "-pix_fmt", "yuv420p", "-crf", "18",
    mp4,
  ], 300000);

  // 产物已确认完整，这时才清理旧渲染目录（见上方"调用位置"注释）
  let pruned = { removed: 0, freedBytes: 0 };
  try {
    pruned = prunePrevizRuns(cfg);
  } catch { /* 清理失败不影响本次渲染 */ }

  return {
    ok: true,
    mode,
    usage: modeUsage(mode),
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
    pruned,
    // 占位人偶警告一路带到 REST 响应，前端才能提示
    derived: Boolean(spec?.derived),
    warnings: Array.isArray(spec?.warnings) ? spec.warnings : [],
    // 直接告诉调用方"这个产物该填到哪"
    hint: modeUsage(mode) === 'reference'
      ? '填进镜头的「参考视频」列表（shot.refs.videos），走 Ref2VA 的 <Video N>'
      : '仅供人眼验收，不要填进镜头卡',
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
  if (!st.ok) throw new BlenderError('BLENDER_NOT_FOUND', st.detail);

  // 未指定时用最近的场景文件
  let file = blendPath || '';
  if (file) {
    // ⚠️ 绝对路径**也要**限制在 dataDir 内 —— 否则 /blender/open 可以用
    //    任意 .blend 启动桌面 Blender，进而执行该文件内嵌的脚本。
    //    历史实现只对相对路径做 safeJoin，绝对路径直接放行。
    try {
      file = resolveInsideDataDir(cfg, file);
    } catch {
      throw new BlenderError('BAD_BLEND_PATH', '只允许打开 dataDir 里的场景文件');
    }
    if (path.extname(file).toLowerCase() !== '.blend') {
      throw new BlenderError('BAD_BLEND_PATH', '只允许打开 .blend 文件');
    }
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
    if (!best) throw new BlenderError('BLEND_NOT_FOUND', '还没有渲染过场景');
    file = best.p;
  }
  if (!fs.existsSync(file)) throw new BlenderError('BLEND_NOT_FOUND', file);

  // 分离式启动：不 await 退出，否则 HTTP 请求会挂到用户关掉 Blender 为止。
  //
  // ⚠️ 必须带 --disable-autoexec：.blend 可以内嵌 Python 自动执行脚本，
  //    以用户完整权限运行。渲染路径一直是加了 --disable-autoexec 的
  //    （见 renderControl），打开路径历史实现漏掉了 —— 不一致且危险。
  const child = spawn(st.exe, ['--disable-autoexec', file], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return { ok: true, pid: child.pid, file, detail: '已启动 Blender' };
}

/**
 * 把（可能是相对的）路径解析到 dataDir 内部，越界抛错。
 *
 * 这是**唯一**的路径解析入口：blend / 资产 / 后处理都走它，
 * 避免每处各写一遍 safeJoin 与 absolute 判断而漏掉某处。
 */
export function resolveInsideDataDir(cfg, p) {
  const raw = String(p ?? '').trim();
  if (!raw) throw new Error('PATH_REQUIRED');
  if (path.isAbsolute(raw)) {
    let real;
    try { real = fs.realpathSync(raw); } catch { real = path.resolve(raw); }
    const base = (() => {
      try { return fs.realpathSync(cfg.dataDir); } catch { return path.resolve(cfg.dataDir); }
    })();
    const rel = path.relative(base, real);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('FORBIDDEN_PATH');
    return real;
  }
  return safeJoin(cfg.dataDir, raw);
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
      const abs = resolveInsideDataDir(cfg, rel);
      if (!fs.existsSync(abs)) { missing.push(rel); return undefined; }
      return abs;
    } catch { missing.push(rel); return undefined; }
  };
  const out = {
    ...spec,
    actors: (spec.actors || []).map((a) => {
      const { assetRel, ...rest } = a;
      const abs = resolveOne(assetRel);
      return abs ? { ...rest, assetPath: abs } : rest;
    }),
    props: (spec.props || []).map((p) => {
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
 * 扫描 `assets/3d/`、`assets/models/` 与 `assets/` 根（**含一层子目录**）。
 *
 * ⚠️ 历史缺陷：只 readdirSync 一层，`assets/3d/<角色>/walk.glb` 这种
 *    按角色分目录存放的模型永远列不出来。实测用户把 fbx 放进 assets/3d/
 *    能看见，再建一个子目录就"消失"了。
 *
 * kind：
 *   actor — .fbx（Mixamo 动作/角色），或文件名含 mixamo/char/rig
 *   prop  — 其余模型
 * 名称用文件名去扩展名 —— 这是**唯一**稳定的标识（模型内部对象名不可靠）。
 */
export function listModelAssets(cfg = loadConfig()) {
  const roots = [
    path.join(cfg.dataDir, 'assets', '3d'),
    path.join(cfg.dataDir, 'assets', 'models'),
    path.join(cfg.dataDir, 'assets'),
  ];
  const seen = new Set();
  const out = [];
  const MAX_DEPTH = 2;

  const scan = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (depth < MAX_DEPTH) scan(abs, depth + 1);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!ASSET_EXTS.includes(ext)) continue;
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      const rel = path.relative(cfg.dataDir, abs).replace(/\\/g, '/');
      if (seen.has(rel)) continue;
      seen.add(rel);
      const stem = path.basename(ent.name, ext);
      const hint = `${stem} ${path.basename(dir)}`.toLowerCase();
      out.push({
        rel,
        name: stem,
        ext,
        bytes: st.size,
        // 粗略分类：fbx 或名字带 mixamo/char/rig 的多半是角色/动作
        kind: (ext === '.fbx' || /mixamo|char|rig|actor/.test(hint)) ? 'actor' : 'prop',
      });
    }
  };

  for (const root of roots) scan(root, 0);
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
  if (!st.ok) throw new BlenderError('BLENDER_NOT_FOUND', st.detail);
  let abs;
  try {
    abs = resolveInsideDataDir(cfg, assetRel);
  } catch {
    throw new BlenderError('BAD_ASSET_PATH', '只允许读取 dataDir 里的模型文件');
  }
  if (!fs.existsSync(abs)) throw new BlenderError('ASSET_NOT_FOUND', String(assetRel));

  const probe = path.join(HERE, '..', 'blender', 'list_actions.py');
  if (!fs.existsSync(probe)) throw new BlenderError('PROBE_SCRIPT_MISSING', probe);
  const r = await runProc(st.exe, [
    '-b', '--factory-startup', '--disable-autoexec', '--python', probe, '--', abs,
  ], timeoutMs);

  /**
   * ⚠️ stdout 与 stderr 必须**拼接**，不能 `stdout || stderr`。
   *
   * 历史缺陷：`String(r.stdout || r.stderr || '')` 在 stderr 非空时只返回 stderr，
   * 而 `JZ_*` 标记全部打在 stdout。Blender 每次运行都会往 stderr 写一条
   * `DeprecationWarning: 'Material.use_nodes' ...`，于是 `out` 恒等于那条警告，
   * 下面的正则永远匹配不到 —— 读模型动作名的功能**从来没成功过**。
   */
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (/JZ_IMPORT_ERR/.test(out)) {
    const m = /JZ_IMPORT_ERR:(.+)/.exec(out);
    throw new BlenderError('ASSET_IMPORT_FAILED', String(m?.[1] || '').trim().slice(0, 300));
  }

  /**
   * ⚠️ 必须行首锚定 + **贪婪**匹配。
   *
   * 历史缺陷：`/JZ_ACTIONS:(\[[\s\S]*?\])/` 的 `*?` 遇到第一个 `]` 就停，
   * 而每条动作自带 `"frames": [1.0, 24.0]` —— 于是截断成
   * `[{"name":"…","frames": [1.0, 24.0]`，`JSON.parse` 必然失败。
   * 实测：任何带动作的模型都会抛 ACTION_LIST_PARSE_FAILED。
   */
  const m = /^JZ_ACTIONS:(\[[\s\S]*\])\s*$/m.exec(out);
  if (!m) {
    throw new BlenderError('ACTION_LIST_FAILED', out.trim().split(/\r?\n/).slice(-4).join(' | ').slice(0, 400));
  }
  let actions;
  try {
    actions = JSON.parse(m[1]);
  } catch {
    throw new BlenderError('ACTION_LIST_PARSE_FAILED', m[1].slice(0, 200));
  }
  if (!Array.isArray(actions)) throw new BlenderError('ACTION_LIST_PARSE_FAILED', '返回不是数组');

  // 顺带把 summary 也拿出来（骨架/网格数），前端可以据此判断"这是角色还是道具"
  let summary = null;
  const sm = /^JZ_SUMMARY:(\{[\s\S]*\})\s*$/m.exec(out);
  if (sm) {
    try { summary = JSON.parse(sm[1]); } catch { /* ignore */ }
  }

  return { rel: assetRel, actions, summary };
}
