/**
 * AI Video Studio — DSH Host 插件（P0 骨架）
 * 项目 / 镜头卡 / H3 提示词编译 / 生成任务（mock、h3-local、seedance-cloud）/ 资产包挂载 / 后处理计划
 *
 * 配置（env 可覆盖）：
 *   DSH_VIDEO_STUDIO_HOME   数据目录（默认 F:\AI视频\工作室\data）
 *   DSH_VIDEO_ASSET_ROOT    资产包根目录（默认 F:\AI视频\资产包）
 *   DSH_VIDEO_COMFY_URL     ComfyUI 地址（默认 http://127.0.0.1:8188）
 *   DSH_VIDEO_SGLANG_URL    SGLang 地址（可选）
 *   DSH_VIDEO_SEEDANCE_URL  Seedance 火山方舟 endpoint（默认官方）
 *   DSH_VIDEO_FFMPEG        ffmpeg 可执行文件（默认 ffmpeg）
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const inject = ['tools', 'webServer'];

const DEFAULTS = {
  dataDir: process.env.DSH_VIDEO_STUDIO_HOME || 'F:\\AI视频\\工作室\\data',
  assetRoot: process.env.DSH_VIDEO_ASSET_ROOT || 'F:\\AI视频\\资产包',
  comfyUrl: process.env.DSH_VIDEO_COMFY_URL || 'http://127.0.0.1:8188',
  // ComfyUI 的 input 目录：LoadImage 只认这里的文件名，预演帧需先复制进去。
  comfyInputDir: process.env.DSH_VIDEO_COMFY_INPUT || 'F:\\AI视频\\ai-runtime\\ComfyUI\\input',
  sglangUrl: process.env.DSH_VIDEO_SGLANG_URL || '',
  seedanceEndpoint: process.env.DSH_VIDEO_SEEDANCE_URL || 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
  seedanceModel: process.env.DSH_VIDEO_SEEDANCE_MODEL || '',
  seedanceApiKey: process.env.DSH_VIDEO_SEEDANCE_KEY || '',
  ffmpeg: process.env.DSH_VIDEO_FFMPEG || 'ffmpeg',
  defaultBackend: process.env.DSH_VIDEO_BACKEND || 'mock',
  defaultProfile: process.env.DSH_VIDEO_PROFILE || 'P12-draft',
  maxConcurrentLocal: 1,
  // 外部引擎可执行文件为**可选项**：默认留空，仅在内置 port 服务不可用且用户显式配置时才启用。
  // 内置 port 服务（services/previz/server.mjs）是首选且唯一默认路径，不需要任何外部二进制。
  previzExe: process.env.DSH_VIDEO_PREVIZ_EXE || '',
  previzPort: Number(process.env.DSH_VIDEO_PREVIZ_PORT || 4318),
  previzAutoStart: process.env.DSH_VIDEO_PREVIZ_AUTOSTART !== '0',
  ffmpegDir: process.env.DSH_VIDEO_FFMPEG_DIR || 'F:\\AI视频\\工作室\\tools\\ffmpeg',
};

const now = () => Date.now();
const uid = (p) => `${p}_${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 生成档位（本地 H3 / 云端 Seedance 共用）。
 * width/height 为 16:9 基准；竖屏 9:16 由 ratio 换算。
 */
const PROFILES = {
  // H3 本地档位。分辨率必须落在官方 32 倍数档位上（见 H3_CANVAS_16x9），
  // 否则 latent 形状不匹配会 RuntimeError（实测 832x480 / 854x480 均报错）。
  // 耗时基线来自 4080 Laptop 12G 实测（5 秒片，4 步 Turbo）：
  //   480p 约 140s / 544p 约 170s / 608p 约 211s / 768p 约 336s
  'P12-draft':   { backend: 'h3-local', mp: 0.4,  steps: 4, cfg: 1.0, label: '12G 草稿 480p（864x480，约 2.3 分钟/5秒）' },
  'P16-std':     { backend: 'h3-local', mp: 0.5,  steps: 4, cfg: 1.0, label: '12G 标准 544p（960x544，约 2.8 分钟/5秒）' },
  'P24-quality': { backend: 'h3-local', mp: 0.6,  steps: 4, cfg: 1.0, label: '12G 高质 608p（1056x608，约 3.5 分钟/5秒）' },
  'P768-quality': { backend: 'h3-local', mp: 0.98, steps: 4, cfg: 1.0, label: '768p 官方档（1344x768，约 5.6 分钟/5秒，显存吃紧）' },
  'cloud-fallback': { backend: 'seedance-cloud', mp: 0.7, steps: 0, cfg: 0, label: '云端兜底（Seedance 1280x720）' },
};
/**
 * H3 官方合法画布表（来自 ComfyUI 模板 "Size Settings Reference"）。
 * 键为 16:9 下的 megapixels；宽高必须是 32 的倍数且符合 H3 的 latent 网格。
 */
const H3_CANVAS_16x9 = {
  0.2: [608, 352], 0.3: [736, 416], 0.4: [864, 480], 0.5: [960, 544],
  0.6: [1056, 608], 0.7: [1152, 640], 0.8: [1216, 672], 0.9: [1280, 736],
  0.98: [1344, 768],
};
function profileOf(name) { return PROFILES[name] || PROFILES['P12-draft']; }
/**
 * 按画面比例换算实际分辨率。
 * H3 对画布极其敏感：必须 32 倍数，且总像素接近官方档位，否则 sampling 会崩。
 * 做法：取档位 16:9 基准 -> 按比例换算出候选 -> 对齐 32 -> 校验像素偏差，超阈值则回退基准。
 */
function resolutionFor(profileName, ratio) {
  const p = profileOf(profileName);
  const mp = Number(p.mp) || 0.4;
  // 找最接近的官方 16:9 档位作基准
  const keys = Object.keys(H3_CANVAS_16x9).map(Number).sort((a, b) => a - b);
  let baseKey = keys[0];
  for (const k of keys) if (Math.abs(k - mp) < Math.abs(baseKey - mp)) baseKey = k;
  const [baseW, baseH] = H3_CANVAS_16x9[baseKey];

  const [rw, rh] = String(ratio || '16:9').split(':').map(Number);
  if (!rw || !rh) return { width: baseW, height: baseH };

  const targetArea = baseW * baseH;
  const k = Math.sqrt(targetArea / (rw * rh));
  const round32 = (v) => Math.max(64, Math.round(v / 32) * 32);
  let w = round32(rw * k);
  let h = round32(rh * k);
  // H3 上限：短边 768、长边 1344
  const clamp = (a, b) => {
    let [x, y] = [a, b];
    if (Math.min(x, y) > 768) { const s = 768 / Math.min(x, y); x = round32(x * s); y = round32(y * s); }
    if (Math.max(x, y) > 1344) { const s = 1344 / Math.max(x, y); x = round32(x * s); y = round32(y * s); }
    return [x, y];
  };
  [w, h] = clamp(w, h);
  // 像素偏差超过 25% 说明该比例下没有稳妥档位 → 回退到 16:9 基准（H3 支持最好）
  if (Math.abs((w * h) - targetArea) / targetArea > 0.25) return { width: baseW, height: baseH };
  return { width: w, height: h };
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/* ------------------------------ 资产类型体系 ------------------------------ */
/**
 * 统一资产类别。所有上传/自建资产都归到其中一类，落在 data/assets/<kind>/。
 * 覆盖 H3 支持的全部模态：参考图、参考视频、参考音频、3D 模型、字体等。
 */
const ASSET_KINDS = ['image', 'video', 'audio', 'model3d', 'font', 'doc', 'other'];
const KIND_EXT = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tga'],
  video: ['.mp4', '.webm', '.mov', '.mkv', '.avi'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'],
  model3d: ['.glb', '.gltf', '.fbx', '.obj', '.dae', '.stl', '.ply'],
  font: ['.ttf', '.otf', '.woff', '.woff2'],
  doc: ['.txt', '.md', '.json', '.csv', '.yaml', '.yml'],
};
const EXT_TO_KIND = (() => {
  const m = {};
  for (const k of Object.keys(KIND_EXT)) for (const e of KIND_EXT[k]) m[e] = k;
  return m;
})();
function kindOfExt(ext) { return EXT_TO_KIND[String(ext || '').toLowerCase()] || 'other'; }

/** 资产索引：data/assets/index.json -> { items: Asset[] } */
function readAssetIndex() { return readJson(DIRS.assetsIndex(), { version: 1, items: [] }); }
function saveAssetIndex(idx) { writeJson(DIRS.assetsIndex(), idx); }
function listAssets(filter = {}) {
  const idx = readAssetIndex();
  let items = Array.isArray(idx.items) ? idx.items : [];
  if (filter.kind) items = items.filter((x) => x.kind === filter.kind);
  if (filter.q) {
    const q = String(filter.q).toLowerCase();
    items = items.filter((x) => String(x.name || '').toLowerCase().includes(q)
      || String(x.tag || '').toLowerCase().includes(q));
  }
  return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
function getAsset(id) { return listAssets().find((x) => x.id === id) || null; }
function addAsset(item) {
  const idx = readAssetIndex();
  const list = Array.isArray(idx.items) ? idx.items : [];
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
  idx.items = list;
  idx.version = 1;
  saveAssetIndex(idx);
  return item;
}
function removeAsset(id) {
  const idx = readAssetIndex();
  const list = Array.isArray(idx.items) ? idx.items : [];
  const item = list.find((x) => x.id === id);
  if (!item) return { ok: false, error: 'ASSET_NOT_FOUND' };
  idx.items = list.filter((x) => x.id !== id);
  saveAssetIndex(idx);
  // 删文件（仅限 assets 目录内，防越界）
  try {
    const abs = safeResolve(DIRS.assets(), item.rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) fs.unlinkSync(abs);
  } catch { /* 文件不存在或越界就跳过 */ }
  return { ok: true, removed: id };
}

/**
 * 保存上传资产。data 为 Buffer。
 * kind 省略时按扩展名推断；文件名做净化，避免路径穿越。
 */
function saveUploadedAsset(data, opts = {}) {
  if (!data || !data.length) throw new Error('UPLOAD_EMPTY: 空文件');
  const rawName = String(opts.filename || 'upload.bin');
  const base = path.basename(rawName).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'upload.bin';
  const ext = path.extname(base).toLowerCase();
  const kind = ASSET_KINDS.includes(opts.kind) ? opts.kind : kindOfExt(ext);
  const dir = path.join(DIRS.assets(), kind);
  ensureDir(dir);
  const id = uid('asset');
  const stored = `${id}${ext}`;
  const abs = path.join(dir, stored);
  fs.writeFileSync(abs, data);
  const item = {
    id, kind,
    name: String(opts.name || base),
    rel: path.relative(DIRS.assets(), abs).replace(/\\/g, '/'),
    bytes: data.length,
    ext,
    mime: MIME_KIND[ext] || 'application/octet-stream',
    tag: String(opts.tag || ''),
    note: String(opts.note || ''),
    source: 'upload',
    createdAt: now(),
  };
  return addAsset(item);
}

/** 从资产库解析到绝对路径（供生成/渲染使用） */
function resolveAssetPath(id) {
  const item = getAsset(id);
  if (!item) throw new Error(`ASSET_NOT_FOUND: ${id}`);
  const abs = safeResolve(DIRS.assets(), item.rel);
  if (!fs.existsSync(abs)) throw new Error(`ASSET_FILE_MISSING: ${item.rel}`);
  return { ...item, absPath: abs };
}

const MIME_KIND = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2',
  '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/markdown',
};

/* ------------------------------ 角色卡 ------------------------------ */
/**
 * 角色卡：把「一个角色的外观/参考图/参考音频/画风/描述」打包成一套可复用。
 * 存储：data/characters/<id>/card.json + refs/（图片等）
 */
function listCharacters() {
  const dir = DIRS.characters();
  ensureDir(dir);
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const f = path.join(dir, name, 'card.json');
    if (fs.existsSync(f)) {
      const c = readJson(f, null);
      if (c) out.push(c);
    }
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
function getCharacter(id) {
  const f = path.join(DIRS.characters(), String(id), 'card.json');
  if (!fs.existsSync(f)) return null;
  return readJson(f, null);
}
function saveCharacter(card) {
  const id = card.id || uid('char');
  const dir = path.join(DIRS.characters(), id);
  ensureDir(path.join(dir, 'refs'));
  const prev = getCharacter(id) || {};
  const out = {
    ...prev,
    ...card,
    id,
    createdAt: prev.createdAt || now(),
    updatedAt: now(),
  };
  writeJson(path.join(dir, 'card.json'), out);
  return out;
}
function deleteCharacter(id) {
  const dir = path.join(DIRS.characters(), String(id));
  if (!fs.existsSync(dir)) return { ok: false, error: 'CHARACTER_NOT_FOUND' };
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true, removed: id };
}
/**
 * 把角色卡展开成「可注入提示词/工作流」的形态：
 * - prompt: 拼好的外观描述（喂给 H3 的文本）
 * - images/videos/audios: 绝对路径数组（喂给 R2V / 参考素材）
 */
function expandCharacter(id) {
  const card = getCharacter(id);
  if (!card) throw new Error(`CHARACTER_NOT_FOUND: ${id}`);
  const dir = path.join(DIRS.characters(), card.id);
  const abs = (rel) => {
    const p = path.join(dir, rel);
    return fs.existsSync(p) ? p : null;
  };
  const refs = (card.refs || []).map((r) => ({ ...r, absPath: abs(r.rel) })).filter((r) => r.absPath);
  return {
    id: card.id,
    name: card.name,
    prompt: String(card.appearance || '').trim(),
    style: String(card.style || '').trim(),
    seedPrompt: String(card.seedPrompt || '').trim(),
    images: refs.filter((r) => r.kind === 'image').map((r) => r.absPath),
    videos: refs.filter((r) => r.kind === 'video').map((r) => r.absPath),
    audios: refs.filter((r) => r.kind === 'audio').map((r) => r.absPath),
  };
}
function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function readText(file, fallback = '') {
  try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; }
}
function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opts });
    let out = '', err = '';
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`))));
  });
}

/* ------------------------------ 配置 ------------------------------ */
const CONFIG_FILE = path.join(DEFAULTS.dataDir, 'config.json');
function loadConfig() {
  const saved = readJson(CONFIG_FILE, {});
  return { ...DEFAULTS, ...saved };
}
function saveConfig(cfg) { writeJson(CONFIG_FILE, cfg); }
function cfg() { return loadConfig(); }

/**
 * BUG-8：配置密钥掩码。GET / POST /config 与 studio_config 工具统一走这里，
 * 口径与原有 GET 掩码一致（有密钥 → '***'，无 → ''）。
 */
const SECRET_FIELDS = ['seedanceApiKey'];
function maskConfig(c) {
  const out = { ...c };
  for (const k of SECRET_FIELDS) out[k] = typeof out[k] === 'string' && out[k] ? '***' : '';
  return out;
}
/**
 * BUG-8 配套：写配置时剔除掩码/占位口令，避免把 '***' 或前端占位文案当成新密钥存下来。
 * 空串保留（表示用户显式清空）。
 */
function sanitizeConfigPatch(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (SECRET_FIELDS.includes(k)) {
      const s = String(v ?? '');
      if (s === '***' || s.includes('***') || s.includes('保持不变')) continue;
    }
    out[k] = v;
  }
  return out;
}

const DIRS = {
  // 上传资产库：所有临时/自建资产按类别落到 data/assets/<kind>/
  assets: () => path.join(cfg().dataDir, 'assets'),
  assetsIndex: () => path.join(cfg().dataDir, 'assets', 'index.json'),
  characters: () => path.join(cfg().dataDir, 'characters'),
  projects: () => path.join(cfg().dataDir, 'projects'),
  shots: () => path.join(cfg().dataDir, 'shots'),
  jobs: () => path.join(cfg().dataDir, 'jobs'),
  outputs: () => path.join(cfg().dataDir, 'outputs'),
  post: () => path.join(cfg().dataDir, 'post'),
  prompts: () => path.join(cfg().dataDir, 'prompts'),
  workflows: () => path.join(cfg().dataDir, 'workflows'),
  mounts: () => path.join(cfg().dataDir, 'mounts.json'),
  jobsFile: () => path.join(cfg().dataDir, 'jobs.json'),
  projectsFile: () => path.join(cfg().dataDir, 'projects.json'),
  // 上传资产库：所有临时/自建资产按类别落到 data/assets/<kind>/
  assets: () => path.join(cfg().dataDir, 'assets'),
  assetsIndex: () => path.join(cfg().dataDir, 'assets', 'index.json'),
  characters: () => path.join(cfg().dataDir, 'characters'),
};
function initDirs() {
  for (const d of [cfg().dataDir, DIRS.projects(), DIRS.shots(), DIRS.outputs(), DIRS.post(), DIRS.prompts(), DIRS.workflows(), cfg().assetRoot, DIRS.assets(), DIRS.characters()]) ensureDir(d);
  for (const k of ASSET_KINDS) ensureDir(path.join(DIRS.assets(), k));
}
initDirs();

/* ------------------------------ 项目/镜头 ------------------------------ */
function listProjects() { return readJson(DIRS.projectsFile(), []); }
function saveProjects(list) { writeJson(DIRS.projectsFile(), list); }
function createProject({ name, description, category }) {
  const list = listProjects();
  const p = { id: uid('proj'), name: name || '未命名项目', description: description || '', category: category || 'free', createdAt: now(), updatedAt: now() };
  list.push(p); saveProjects(list);
  ensureDir(path.join(DIRS.shots(), p.id));
  return p;
}
function getProject(id) { return listProjects().find((p) => p.id === id); }
function shotsFile(projectId) { return path.join(DIRS.shots(), projectId, 'shots.json'); }
function listShots(projectId) { return readJson(shotsFile(projectId), []); }
function saveShots(projectId, list) { writeJson(shotsFile(projectId), list); }
function newShot(partial = {}) {
  return {
    id: uid('shot'), title: partial.title || '新镜头', mode: partial.mode || 'ref2v',
    durationSec: partial.durationSec || 5, ratio: partial.ratio || '16:9',
    style: partial.style || 'cinematic live-action, soft natural light',
    description: partial.description || '', camera: partial.camera || '',
    dialogue: partial.dialogue || '', soundscape: partial.soundscape || '',
    music: partial.music || 'N/A', subjects: partial.subjects || [],
    refs: partial.refs || { images: [], videos: [], audios: [] },
    keyframes: partial.keyframes || { first: null, last: null },
    control: partial.control || null, previz: partial.previz || null,
    backend: partial.backend || cfg().defaultBackend, profile: partial.profile || cfg().defaultProfile,
    promptOverride: partial.promptOverride || '', status: 'draft', version: 1,
    createdAt: now(), updatedAt: now(),
  };
}
function upsertShot(projectId, shot) {
  const list = listShots(projectId);
  const i = list.findIndex((s) => s.id === shot.id);
  shot.updatedAt = now();
  if (i >= 0) list[i] = shot; else list.push(shot);
  saveShots(projectId, list);
  return shot;
}

/* ------------------------------ 提示词编译 ------------------------------ */
const MODES = ['t2v', 'i2v', 'fl2v', 'ref2v'];
function compilePrompt(shot) {
  if (shot.promptOverride && String(shot.promptOverride).trim()) return String(shot.promptOverride).trim();
  const dur = Math.max(4, Math.min(15, Number(shot.durationSec) || 5));
  const style = String(shot.style || 'cinematic live-action').trim();
  const desc = String(shot.description || '').trim();
  const camera = String(shot.camera || '').trim();
  const dialogue = String(shot.dialogue || '').trim();
  const sound = String(shot.soundscape || 'Ambient room tone and natural action sounds.').trim();
  const music = String(shot.music || 'N/A').trim();
  const subjects = Array.isArray(shot.subjects) ? shot.subjects : [];
  const defs = subjects.map((s, i) => `<Subject ${i + 1}> is the ${s.kind || 'person'} ${s.name || `主体${i + 1}`} in <Picture ${i + 1}>; preserve ${s.preserve || s.description || 'facial identity, hairstyle and outfit'}.`).join('\n');
  const retention = subjects.map((s, i) => `<Subject ${i + 1}> (appears in [Shot 1]): ${s.retention || 'fully_preserved'} - preserve ${s.preserve || 'identity and outfit'}.`).join('\n');
  let detail = `[Shot 1] ${style}. ${desc}`;
  if (camera) detail += ` The camera ${camera}.`;
  if (dialogue) detail += ` The character (S1) says: <d>[Chinese] ${dialogue}</d>`;
  detail = detail.replace(/\s+/g, ' ').trim();

  if ((shot.mode || 'ref2v') === 'ref2v') {
    return [
      'subject_definitions:', defs || '<Subject 1> is the main character in <Picture 1>; preserve facial identity and outfit.', '',
      'summary:', `[reference generation] Generate ${detail}`, '',
      'retention_analysis:', retention || '<Subject 1> (appears in [Shot 1]): fully_preserved - preserve identity and outfit.', '',
      'detailed_description:', detail, '',
      'overall_soundscape:', sound, '',
      'non_diegetic_music:', music,
    ].join('\n');
  }
  let align = '';
  if (shot.mode === 'fl2v') align = `# FL2VA\nHow the reference pictures align with the target video — Picture 1 aligns with the 0.00-second mark; Picture 2 aligns with the ${dur.toFixed(2)}-second mark.\n\n`;
  else if (shot.mode === 'i2v') align = '# I2VA\nFor the target video, at 0.00 seconds, <Picture 1> is fully referenced.\n\n';
  return [`${align}integrated_multimodal_description: ${detail}`, '', `overall_soundscape: ${sound}`, '', `non_diegetic_music: ${music}`].join('\n');
}
function validateShot(shot) {
  const warnings = [];
  const mode = shot.mode || 't2v';
  if (!MODES.includes(mode)) warnings.push(`未知模式：${mode}`);
  const dur = Number(shot.durationSec);
  if (!Number.isFinite(dur) || dur < 4 || dur > 15) warnings.push('时长需为 4—15 秒整数');
  const imgs = shot.refs?.images?.length || 0, vids = shot.refs?.videos?.length || 0, auds = shot.refs?.audios?.length || 0;
  if (imgs > 9) warnings.push('参考图超过 9 张');
  if (vids > 3) warnings.push('参考视频超过 3 个');
  if (auds > 3) warnings.push('参考音频超过 3 个');
  if (imgs + vids + auds > 12) warnings.push('混合参考文件超过 12 个');
  if (mode === 'i2v' && imgs < 1) warnings.push('首帧模式需要 1 张参考图');
  if (mode === 'fl2v' && imgs < 2) warnings.push('首尾帧模式需要 2 张参考图');
  const prompt = compilePrompt(shot);
  if (prompt.length > 7000) warnings.push(`提示词 ${prompt.length} 字符，超过 7000`);
  return { ok: warnings.length === 0, warnings, chars: prompt.length };
}

/* ------------------------------ 资产包挂载 ------------------------------ */
function listMounts() { return readJson(DIRS.mounts(), {}); }
function saveMounts(m) { writeJson(DIRS.mounts(), m); }
function readManifest(root) {
  const f = path.join(root, 'manifest.json');
  if (!fs.existsSync(f)) throw new Error(`manifest.json 不存在：${f}`);
  const m = readJson(f, null);
  if (!m || !m.id || !Array.isArray(m.entries)) throw new Error('manifest.json 缺少 id/entries');
  return m;
}
function mountPack(packId, root, opts = {}) {
  const abs = path.resolve(root);
  if (!fs.existsSync(abs)) throw new Error(`目录不存在：${abs}`);
  const manifest = readManifest(abs);
  const mounts = listMounts();
  mounts[packId || manifest.id] = { packId: packId || manifest.id, root: abs, enabled: true, mountedAt: now(), entries: manifest.entries.length, license: manifest.license || null, readonly: opts.readonly !== false };
  saveMounts(mounts);
  return { packId: packId || manifest.id, root: abs, manifest };
}
function unmountPack(packId) {
  const mounts = listMounts();
  if (!mounts[packId]) return { ok: false, error: '未挂载' };
  delete mounts[packId]; saveMounts(mounts);
  return { ok: true };
}
function verifyPack(packId) {
  const mounts = listMounts();
  const m = mounts[packId];
  if (!m) return { ok: false, error: 'ASSET_PACK_NOT_MOUNTED' };
  const manifest = readManifest(m.root);
  const missing = [];
  for (const e of manifest.entries || []) {
    if (!e.path) continue;
    const p = path.isAbsolute(e.path) ? e.path : path.join(m.root, e.path);
    if (!fs.existsSync(p)) missing.push(e.id || e.path);
  }
  return { ok: missing.length === 0, packId, entries: (manifest.entries || []).length, missing, license: manifest.license || null };
}
function resolveAsset(ref) {
  const [packId, entryId] = String(ref).split(':');
  const mounts = listMounts();
  const m = mounts[packId];
  if (!m) throw new Error(`ASSET_PACK_NOT_MOUNTED: ${packId}`);
  const manifest = readManifest(m.root);
  const e = (manifest.entries || []).find((x) => x.id === entryId);
  if (!e) throw new Error(`ASSET_ENTRY_NOT_FOUND: ${ref}`);
  const abs = path.isAbsolute(e.path) ? e.path : path.join(m.root, e.path);
  if (!fs.existsSync(abs)) throw new Error(`ASSET_FILE_MISSING: ${ref}`);
  return { packId, entryId, absPath: abs, type: e.type, sha256: e.sha256 || null, meta: e.meta || null };
}
function listPacks() {
  const mounts = listMounts();
  return Object.values(mounts).map((m) => {
    let manifest = null, error = null;
    try { manifest = readManifest(m.root); } catch (e) { error = String(e.message || e); }
    const liveEntries = manifest ? (manifest.entries || []).length : null;
    return {
      // entries 为挂载时缓存；entryCount 为清单实时值（权威）。两者不一致说明清单已更新，需重新挂载。
      ...m,
      entries: liveEntries === null ? m.entries : liveEntries,
      cachedEntries: m.entries ?? null,
      stale: liveEntries !== null && m.entries !== undefined && m.entries !== liveEntries,
      manifest: manifest ? { id: manifest.id, name: manifest.name, kind: manifest.kind, version: manifest.version, license: manifest.license, entries: liveEntries } : null,
      error,
    };
  });
}

/* ------------------------------ 任务 ------------------------------ */
function listJobs() { return readJson(DIRS.jobsFile(), []).sort((a, b) => b.createdAt - a.createdAt); }
function saveJobs(list) { writeJson(DIRS.jobsFile(), list); }
function getJob(id) { return listJobs().find((j) => j.id === id); }
function updateJob(job) {
  const list = readJson(DIRS.jobsFile(), []);
  const i = list.findIndex((j) => j.id === job.id);
  job.updatedAt = now();
  if (i >= 0) list[i] = job; else list.push(job);
  saveJobs(list);
}

/* ---------- BUG-5：取消信号（进程内） ---------- */
// 只改 JSON 无法终止执行中的适配器；取消时登记到集合，轮询循环每轮开头检查。
const cancelledJobs = new Set();
function markCancelled(jobId) { cancelledJobs.add(jobId); }
function isCancelled(jobId) { return cancelledJobs.has(jobId); }
function clearCancelled(jobId) { cancelledJobs.delete(jobId); }
const CANCELLED_MSG = 'CANCELLED: 用户取消';
/**
 * BUG-5：统一取消入口（工具 / Web API 共用）。
 * 1) 登记进程内取消标记并写穿到磁盘；执行中的适配器在下一轮轮询开头看到标记即中止。
 * 2) 排队中（尚未拿到本地槽位）的任务：直接从等待队列摘除并唤醒，不必等前一个任务结束。
 * 3) 已是终态（completed/failed/cancelled）：幂等返回，不抛错、不改盘，附 cancelResult 说明，
 *    保持旧的「cancel 总是 200」契约，避免 UI 在竞态下弹错误横幅。
 * 返回最新任务快照，避免调用方拿到尚未刷新的旧对象。
 */
function cancelJob(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error('任务不存在');
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { ...job, cancelResult: 'ALREADY_TERMINAL' };
  }
  markCancelled(jobId);
  job.status = 'cancelled';
  job.error = CANCELLED_MSG;
  updateJob(job);
  // 把等待槽位的排队者摘掉，使其立刻走取消分支而不是傻等前一个任务
  const qi = pendingJobGates.findIndex((g) => g.jobId === jobId);
  if (qi >= 0) {
    const [g] = pendingJobGates.splice(qi, 1);
    g.resolve();
  }
  return job;
}
/** 所有后端轮询循环的取消检查点：命中则落盘并抛出可识别的取消错误 */
function throwIfCancelled(job) {
  if (!isCancelled(job.id)) return;
  job.status = 'cancelled';
  job.error = CANCELLED_MSG;
  updateJob(job);
  throw new Error(CANCELLED_MSG);
}
function isCancelledError(e) { return String((e && e.message) || e).includes('CANCELLED'); }
/**
 * 可被取消打断的睡眠：把长轮询间隔切成 ≤250ms 的片，取消时最多等 250ms 就能抛出，
 * 而不是傻等满 3s / 10s（seedance 一轮 10s，体验上差别很大）。
 */
const CANCEL_TICK_MS = 250;
async function cancellableSleep(job, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    throwIfCancelled(job);
    const left = deadline - Date.now();
    if (left <= 0) return;
    await sleep(Math.min(CANCEL_TICK_MS, left));
  }
}

/* ---------- BUG-6：本地后端并发闸门 ---------- */
// mock / h3-local 吃本机 GPU/CPU，统一受 maxConcurrentLocal 限制；seedance-cloud 在远端，不占用本地槽位。
// 注意：槽位按 **jobId** 记账、按 **backendId** 判定是否限流，两者不可混用。
const LOCAL_BACKENDS = new Set(['mock', 'h3-local']);
const activeLocalJobs = new Set();
const pendingJobGates = []; // [{ jobId, backendId, resolve }]
function isLocalBackend(backendId) { return LOCAL_BACKENDS.has(String(backendId || '')); }
function maxLocal() {
  const n = Number(cfg().maxConcurrentLocal);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
/** 申请本地执行槽位；满额时排队等待（远端后端直接放行） */
function acquireSlot(jobId, backendId) {
  if (!isLocalBackend(backendId)) return Promise.resolve();
  if (activeLocalJobs.size < maxLocal()) { activeLocalJobs.add(jobId); return Promise.resolve(); }
  return new Promise((resolve) => pendingJobGates.push({ jobId, backendId, resolve }));
}
/** 释放槽位并把名额直接移交给队首（避免竞态下多占或少算；被取消的排队者由 cancelJob 摘除） */
function releaseSlot(jobId) {
  if (!activeLocalJobs.delete(jobId)) return;
  while (pendingJobGates.length && activeLocalJobs.size < maxLocal()) {
    const next = pendingJobGates.shift();
    activeLocalJobs.add(next.jobId);
    next.resolve();
  }
}

const INTERRUPTED_MSG = 'INTERRUPTED: 插件重启，任务未完成，可重试';
/**
 * BUG-7：崩溃恢复。启动时把残留的 running/queued 标记为 interrupted。
 * 只标记、不自动重跑（避免对远端算力重复计费），由用户显式 retry。
 */
function recoverInterruptedJobs() {
  const list = readJson(DIRS.jobsFile(), []);
  if (!Array.isArray(list) || !list.length) return { recovered: 0, jobs: [] };
  const names = [];
  for (const j of list) {
    if (j && (j.status === 'running' || j.status === 'queued')) {
      j.status = 'interrupted';
      j.error = INTERRUPTED_MSG;
      j.updatedAt = now();
      names.push({ id: j.id, backendId: j.backendId, remoteId: j.remoteId ?? null, from: 'running/queued' });
    }
  }
  if (names.length) saveJobs(list);
  return { recovered: names.length, jobs: names };
}
// BUG-7：模块加载时执行一次恢复扫描（此时 jobs.json 可读、且尚无任务在跑）。
// 注意：放在函数定义之后调用，避免 TDZ；只标记不重跑。
const bootRecovery = recoverInterruptedJobs();

function paramsHash(shot) {
  return JSON.stringify({ mode: shot.mode, d: shot.durationSec, p: compilePrompt(shot).slice(0, 2000), b: shot.backend, pr: shot.profile });
}
function createJob(projectId, shot, backendId) {
  const backend = backendId || shot.backend || cfg().defaultBackend;
  const job = {
    id: uid('job'), projectId, shotId: shot.id, shotTitle: shot.title,
    backendId: backend, mode: shot.mode, status: 'queued', remoteId: null,
    paramsHash: paramsHash(shot), prompt: compilePrompt(shot), promptPath: null,
    outputs: [], cost: null, error: null, note: null, createdAt: now(), updatedAt: now(),
    params: { durationSec: shot.durationSec, ratio: shot.ratio, profile: shot.profile || cfg().defaultProfile, seed: 1101 },
  };
  const pf = path.join(DIRS.prompts(), `${job.id}.txt`);
  fs.writeFileSync(pf, job.prompt, 'utf8');
  job.promptPath = path.relative(cfg().dataDir, pf);
  updateJob(job);
  runJob(job, shot).catch((e) => {
    // runJob 内部已落盘终态；这里只兜底未捕获的异常，取消不降级为 failed
    if (isCancelledError(e)) { job.status = 'cancelled'; job.error = CANCELLED_MSG; } else { job.status = 'failed'; job.error = String(e.message || e); }
    updateJob(job);
  });
  return job;
}
/**
 * 统一执行器。
 * BUG-6：本地后端（mock / h3-local）先申请并发槽位，满额时排队；seedance-cloud 直接执行。
 * BUG-5：取消后不再把状态改写为 completed / failed，保持 cancelled。
 */
async function runJob(job, shot) {
  const backendId = job.backendId;
  const local = isLocalBackend(backendId);
  try {
    if (local) {
      if (job.status !== 'queued') { job.status = 'queued'; updateJob(job); }
      await acquireSlot(job.id, backendId);
      // 排队期间可能已被取消（cancelJob 会摘队列并唤醒）：此时直接落终态，不再执行
      if (isCancelled(job.id)) {
        job.status = 'cancelled'; job.error = CANCELLED_MSG;
        updateJob(job);
        return;
      }
    } else if (isCancelled(job.id)) {
      job.status = 'cancelled'; job.error = CANCELLED_MSG;
      updateJob(job);
      return;
    }
    job.status = 'running'; updateJob(job);
    try {
      if (backendId === 'mock') await runMock(job, shot);
      else if (backendId === 'h3-local') await runH3Local(job, shot);
      else if (backendId === 'seedance-cloud') await runSeedance(job, shot);
      else throw new Error(`未知后端：${backendId}`);
      if (isCancelled(job.id)) throw new Error(CANCELLED_MSG);
      job.status = 'completed';
      job.error = null;
    } catch (e) {
      if (isCancelledError(e) || isCancelled(job.id)) {
        job.status = 'cancelled'; job.error = CANCELLED_MSG;
      } else {
        job.status = 'failed'; job.error = String(e.message || e);
      }
    }
    updateJob(job);
  } finally {
    clearCancelled(job.id);
    if (local) releaseSlot(job.id);
  }
}
async function runMock(job, shot) {
  const c = cfg();
  const dur = Math.max(1, Math.min(30, Number(shot.durationSec) || 5));
  const out = path.join(DIRS.outputs(), `${job.id}.mp4`);
  const placeholder = path.join(c.dataDir, '..', 'assets', 'placeholder.mp4');
  try {
    await runCommand(resolveFfmpeg(c), ['-y', '-f', 'lavfi', '-i', `color=c=0x102a4c:s=1344x768:d=${dur}:r=24`, '-f', 'lavfi', '-i', 'anullsrc=r=32000:cl=stereo', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-c:a', 'aac', '-t', String(dur), out]);
    job.outputs = [{ role: 'video', path: path.relative(c.dataDir, out), bytes: fs.statSync(out).size }];
    job.note = 'mock 占位视频（ffmpeg 合成）';
  } catch (e) {
    if (fs.existsSync(placeholder)) {
      fs.copyFileSync(placeholder, out);
      job.outputs = [{ role: 'video', path: path.relative(c.dataDir, out), bytes: fs.statSync(out).size }];
      job.note = 'mock 占位视频（本地 5 秒样片；ffmpeg 不可用）';
    } else {
      job.note = `mock 生成失败（ffmpeg 不可用且无占位样片）：${String(e.message || e)}`;
    }
  }
}
function backendHeaders(c) {
  const h = { 'Content-Type': 'application/json' };
  if (c.seedanceApiKey) h.Authorization = `Bearer ${c.seedanceApiKey}`;
  return h;
}
/** 解析镜头卡上的预演产物，映射为 ComfyUI 工作流占位符 */
function resolvePrevizArtifacts(shot) {
  const out = {};
  const p = shot?.previz;
  if (!p) return out;
  const base = cfg().dataDir;
  const abs = (rel) => {
    if (!rel) return '';
    const a = path.isAbsolute(rel) ? rel : path.join(base, rel);
    return fs.existsSync(a) ? a : '';
  };
  if (p.firstFramePath) out['{{FIRST_FRAME}}'] = abs(p.firstFramePath);
  if (p.lastFramePath) out['{{LAST_FRAME}}'] = abs(p.lastFramePath);
  if (p.controlVideoPath) out['{{CONTROL_VIDEO}}'] = abs(p.controlVideoPath);
  if (p.packagePath) out['{{PREVIZ_PACKAGE}}'] = abs(p.packagePath);
  return out;
}

/**
 * 把预演产物同步进 ComfyUI 的 input 目录。
 * ComfyUI 的 LoadImage / VHS_LoadVideo 只认 input 目录内的**文件名**，
 * 传绝对路径会报 "Invalid image file"。这里复制过去并返回文件名。
 */
function stageToComfyInput(absPaths) {
  const out = {};
  if (!absPaths || !Object.keys(absPaths).length) return out;
  // ComfyUI 的 input 目录 = <ComfyUI 根>/input；从 comfyUrl 推断不了，
  // 因此走配置项 comfyInputDir，未配置则跳过（调用方会回退到绝对路径尝试）。
  const dir = cfg().comfyInputDir;
  if (!dir || !fs.existsSync(dir)) return out;
  const tag = 'dshpreviz';
  for (const [k, abs] of Object.entries(absPaths)) {
    if (!abs) continue;
    try {
      const ext = path.extname(abs) || '.png';
      const name = `${tag}_${path.basename(abs, ext)}${ext}`;
      const dst = path.join(dir, name);
      if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(abs).mtimeMs) {
        fs.copyFileSync(abs, dst);
      }
      out[k] = name; // ComfyUI 要的是文件名，不是绝对路径
    } catch { /* 单文件失败不阻断 */ }
  }
  return out;
}

async function runH3Local(job, shot) {
  const c = cfg();
  if (!c.comfyUrl) throw new Error('CONFIG_MISSING: comfyUrl');
  const wfFile = path.join(DIRS.workflows(), 'h3.json');
  if (!fs.existsSync(wfFile)) throw new Error(`MODEL_MISSING: 缺少 ComfyUI 工作流模板 ${wfFile}（可先用 mock 后端）`);
  const prof = profileOf(job.params.profile);
  const res = resolutionFor(job.params.profile, shot.ratio || '16:9');
  const map = {
    '{{PROMPT}}': job.prompt, '{{DURATION}}': job.params.durationSec, '{{SEED}}': job.params.seed,
    '{{WIDTH}}': res.width, '{{HEIGHT}}': res.height,
    '{{STEPS}}': prof.steps, '{{CFG}}': prof.cfg, '{{FPS}}': 24,
    '{{PROFILE}}': job.params.profile, '{{RATIO}}': shot.ratio || '16:9',
  };
  // H3 的 length 必须是 17k+5 网格上的帧数（124 ≈ 5 秒 @24fps）。
  // 直接算好塞进 map，避免把 "5x24" 之类的表达式交给工作流去解析。
  const fps = 24;
  const rawFrames = Math.max(5, Math.round((Number(job.params.durationSec) || 5) * fps));
  const kBlocks = Math.max(0, Math.ceil((rawFrames - 5) / 17));
  map['{{LENGTH}}'] = Math.min(3600, 5 + kBlocks * 17);
  // H3 模型选择：ref2v 用 Ref2VA，其余（t2v/i2v/fl2v）用 FL2VA —— 两个模型不通用。
  const isRef = (job.mode || shot.mode) === 'ref2v';
  map['{{UNET_NAME}}'] = isRef
    ? 'minimax_h3_ref2va_pruned_fp8_scaled.safetensors'
    : 'minimax_h3_fl2va_pruned_fp8_scaled.safetensors';
  map['{{CLIP_NAME}}'] = 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors';
  map['{{VAE_NAME}}'] = 'minimax_h3_video_vae_fp16.safetensors';
  // Turbo LoRA：4 步用 fl2v_turbo_4step（768p，flow_shift=6）；ref2v 用 ref2v_turbo_4step。
  // 步数 >8 时不应挂 Turbo（它是时间步蒸馏，仅适用于 4/8 步）。
  const useTurbo = Number(prof.steps) <= 8;
  map['{{LORA_NAME}}'] = useTurbo
    ? (isRef ? 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors'
             : 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors')
    : 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors';
  map['{{LORA_STRENGTH}}'] = useTurbo ? 1.0 : 0.0;
  // 预演联动：把镜头卡上的 previz 包（首帧/尾帧/控制视频）映射进工作流占位符
  const previzAbs = resolvePrevizArtifacts(shot);
  // ComfyUI 的 LoadImage 只认 input 目录内的文件名 → 先同步过去
  const staged = stageToComfyInput({
    '{{FIRST_FRAME}}': previzAbs['{{FIRST_FRAME}}'],
    '{{LAST_FRAME}}': previzAbs['{{LAST_FRAME}}'],
  });
  const previzPaths = Object.assign({}, previzAbs, staged);
  Object.assign(map, previzPaths);
  const wfRaw = JSON.parse(readText(wfFile, '{}'));
  const wfSrc = Object.assign({}, wfRaw);
  // 首帧/尾帧节点（20/21）：有产物就接线，没有就整节点剔除，
  // 否则 ComfyUI 会因 image 为空字符串而报错。
  const hasFirst = Boolean(previzPaths['{{FIRST_FRAME}}']);
  const hasLast = Boolean(previzPaths['{{LAST_FRAME}}']);
  if (hasFirst) {
    wfSrc['6'].inputs.first_frame = ['20', 0];
  } else {
    delete wfSrc['20'];
  }
  if (hasLast) {
    wfSrc['6'].inputs.last_frame = ['21', 0];
  } else {
    delete wfSrc['21'];
  }
  const wf = deepReplace(wfSrc, map);
  const r = await fetch(`${c.comfyUrl.replace(/\/$/, '')}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf, client_id: job.id }) });
  const text = await r.text();
  if (!r.ok) throw new Error(`BACKEND_ERROR: ComfyUI ${r.status} ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  job.remoteId = data.prompt_id || data.id; updateJob(job);
  for (let i = 0; i < 600; i++) {
    // BUG-5：可中断睡眠 —— 取消后最多 250ms 即中止，不必等满 3s
    await cancellableSleep(job, 3000);
    const hr = await fetch(`${c.comfyUrl.replace(/\/$/, '')}/history/${encodeURIComponent(job.remoteId)}`);
    if (!hr.ok) continue;
    const hist = await hr.json();
    const entry = hist[job.remoteId];
    if (!entry) continue;
    // ComfyUI 会在 status 里报告执行错误：必须优先识别，否则会误报为"没有输出文件"。
    const st = entry.status || {};
    if (st.status_str === 'error' || st.completed === false && st.status_str === 'error') {
      const msgs = Array.isArray(st.messages) ? st.messages : [];
      const errMsg = msgs.find((m) => m[0] === 'execution_error');
      const detail = errMsg?.[1] || {};
      throw new Error(`BACKEND_ERROR: ComfyUI 执行失败 @${detail.node_type || '?'} — ${String(detail.exception_message || st.status_str).slice(0, 400)}`);
    }
    const files = [];
    for (const node of Object.values(entry.outputs || {})) for (const key of ['videos', 'gifs', 'images']) if (Array.isArray(node[key])) files.push(...node[key]);
    const media = files.find((f) => /\.(mp4|webm|mov|gif)$/i.test(f.filename || '')) || files[0];
    if (!media) throw new Error(`BACKEND_ERROR: ComfyUI 完成但没有输出文件（status=${st.status_str || '?'}）`);
    const q = new URLSearchParams({ filename: media.filename, subfolder: media.subfolder || '', type: media.type || 'output' });
    const fr = await fetch(`${c.comfyUrl.replace(/\/$/, '')}/view?${q}`);
    if (!fr.ok) throw new Error(`DOWNLOAD_FAILED: ${fr.status}`);
    const buf = Buffer.from(await fr.arrayBuffer());
    const ext = (path.extname(media.filename || '') || '.mp4').toLowerCase();
    const out = path.join(DIRS.outputs(), `${job.id}${ext}`);
    fs.writeFileSync(out, buf);
    job.outputs = [{ role: 'video', path: path.relative(c.dataDir, out), bytes: buf.length }];
    return;
  }
  throw new Error('TIMEOUT: ComfyUI 任务超时');
}
async function runSeedance(job, shot) {
  const c = cfg();
  if (!c.seedanceApiKey) throw new Error('AUTH_REQUIRED: 未配置 Seedance API Key（测试阶段再配）');
  if (!c.seedanceModel) throw new Error('CONFIG_MISSING: 未配置 Seedance 模型 ID');
  const content = [{ type: 'text', text: job.prompt }];
  // 预演联动：把首帧/尾帧作为 image_url 参考图提交，使 3D 预演真正约束云端生成。
  // 有本地绝对路径时按 base64 data URL 内联，避免依赖 ComfyUI 的文件服务。
  const cond = resolvePrevizArtifacts(shot);
  const asDataUrl = (abs) => {
    try {
      if (!abs || !fs.existsSync(abs)) return null;
      const ext = path.extname(abs).toLowerCase();
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
    } catch { return null; }
  };
  const firstUrl = asDataUrl(cond['{{FIRST_FRAME}}']);
  const lastUrl = asDataUrl(cond['{{LAST_FRAME}}']);
  if (firstUrl) content.push({ type: 'image_url', image_url: { url: firstUrl }, role: 'first_frame' });
  if (lastUrl) content.push({ type: 'image_url', image_url: { url: lastUrl }, role: 'last_frame' });
  const body = { model: c.seedanceModel, content, resolution: job.params.profile === 'P24-quality' ? '1080p' : '720p', ratio: shot.ratio || '16:9', duration: Math.min(30, job.params.durationSec || 5), seed: job.params.seed, watermark: false };
  if (firstUrl) body.first_frame_image = firstUrl;
  if (lastUrl) body.last_frame_image = lastUrl;
  const r = await fetch(c.seedanceEndpoint, { method: 'POST', headers: backendHeaders(c), body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`BACKEND_ERROR: Seedance ${r.status} ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  job.remoteId = data.id || data.task_id; updateJob(job);
  for (let i = 0; i < 240; i++) {
    // BUG-5：可中断睡眠 —— 取消后最多 250ms 即中止，不必等满 10s
    await cancellableSleep(job, 10000);
    const pr = await fetch(`${c.seedanceEndpoint.replace(/\/$/, '')}/${encodeURIComponent(job.remoteId)}`, { headers: backendHeaders(c) });
    if (!pr.ok) continue;
    const st = await pr.json();
    const state = String(st.status || '');
    if (state === 'succeeded' || state === 'completed' || state === 'success') {
      const url = st.content?.video_url || st.video_url;
      if (!url) throw new Error('BACKEND_ERROR: 无 video_url');
      const dr = await fetch(url);
      if (!dr.ok) throw new Error(`DOWNLOAD_FAILED: ${dr.status}`);
      const buf = Buffer.from(await dr.arrayBuffer());
      const out = path.join(DIRS.outputs(), `${job.id}.mp4`);
      fs.writeFileSync(out, buf);
      job.outputs = [{ role: 'video', path: path.relative(c.dataDir, out), bytes: buf.length }];
      job.cost = { model: st.model || c.seedanceModel, usage: st.usage || null };
      return;
    }
    if (state === 'failed' || state === 'error' || state === 'expired' || state === 'cancelled' || state === 'canceled') throw new Error(`BACKEND_ERROR: ${JSON.stringify(st).slice(0, 300)}`);
    updateJob(job);
  }
  throw new Error('TIMEOUT: Seedance 任务超时');
}
/** 替换 `{{NAME}}`；纯数字表达式（如 `{{DURATION}}x{{FPS}}` → 5*24）会求值为数字 */
function deepReplace(v, map) {
  if (typeof v === 'string') {
    if (map[v] !== undefined) return map[v];
    if (!v.includes('{{')) return v;
    const substituted = v.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (map[`{{${k}}}`] !== undefined ? String(map[`{{${k}}}`]) : m));
    if (substituted === v) return v;
    // 形如 "5x24" / "5*24" / "1344/2" 的数字表达式 → 求值
    if (/^[\d\s.*x/+\-()]+$/.test(substituted)) {
      try {
        const expr = substituted.replace(/x/gi, '*');
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict";return (${expr});`)();
        if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
      } catch { /* 保留字符串 */ }
    }
    return substituted;
  }
  if (Array.isArray(v)) return v.map((x) => deepReplace(x, map));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = deepReplace(x, map); return o; }
  return v;
}

/* ------------------------------ 后端能力 ------------------------------ */
async function backendHealth() {
  const c = cfg();
  const out = [];
  out.push({ id: 'mock', ok: true, detail: 'ffmpeg 占位视频' });
  try {
    const r = await fetch(`${c.comfyUrl.replace(/\/$/, '')}/system_stats`, { signal: AbortSignal.timeout(2500) });
    out.push({ id: 'h3-local', ok: r.ok, detail: `ComfyUI ${r.status}`, url: c.comfyUrl });
  } catch (e) { out.push({ id: 'h3-local', ok: false, detail: String(e.message || e), url: c.comfyUrl }); }
  out.push({ id: 'seedance-cloud', ok: Boolean(c.seedanceApiKey && c.seedanceModel), detail: c.seedanceApiKey ? (c.seedanceModel ? '已配置' : '缺少模型 ID') : 'AUTH_REQUIRED（测试阶段配置）' });
  return out;
}
function backendCapabilities() {
  return [
    { id: 'mock', maxDurationSec: 30, nativeAudio: false, refImages: 0, refVideos: 0, refAudios: 0, firstFrame: false, lastFrame: false, resolutions: ['1344x768'] },
    { id: 'h3-local', maxDurationSec: 15, nativeAudio: true, refImages: 9, refVideos: 3, refAudios: 3, firstFrame: true, lastFrame: true, resolutions: ['480p', '768p'] },
    { id: 'seedance-cloud', maxDurationSec: 30, nativeAudio: true, refImages: 30, refVideos: 10, refAudios: 10, firstFrame: true, lastFrame: true, resolutions: ['720p', '1080p'] },
  ];
}

/* ------------------------------ 预演服务（预演引擎：内置 port 优先，外部可执行文件兜底） ------------------------------ */
let previzChild = null;
let previzMode = null; // 'port' | 'exe'
function previzHome() { return path.join(cfg().dataDir, 'previz'); }
function previzPortServer() { return path.join('F:\\AI视频\\工作室\\services\\previz', 'server.mjs'); }
async function previzHealth() {
  const c = cfg();
  try {
    const r = await fetch(`http://127.0.0.1:${c.previzPort}/api/health`, { signal: AbortSignal.timeout(2500) });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, running: true, url: `http://127.0.0.1:${c.previzPort}`, status: r.status, mode: body.engine || 'exe', detail: body };
  } catch (e) {
    return { ok: false, running: Boolean(previzChild), url: `http://127.0.0.1:${c.previzPort}`, mode: previzMode, detail: String(e.message || e) };
  }
}
async function previzStart() {
  const c = cfg();
  if (previzChild) return { ok: true, already: true, pid: previzChild.pid, mode: previzMode };
  ensureDir(previzHome());
  const portServer = previzPortServer();
  const usePort = fs.existsSync(portServer) && path.join(path.dirname(portServer), 'engine.mjs') && fs.existsSync(path.join(path.dirname(portServer), 'engine.mjs'));
  if (usePort) {
    previzChild = spawn(process.execPath, [portServer], {
      windowsHide: true,
      env: { ...process.env, PREVIZ_HOME: previzHome(), PREVIZ_HOST: '127.0.0.1', PREVIZ_PORT: String(c.previzPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    previzMode = 'port';
  } else {
    if (!fs.existsSync(c.previzExe)) throw new Error(`PREVIZ_EXE_MISSING: ${c.previzExe}（也没有 port 版服务）`);
    previzChild = spawn(c.previzExe, ['--http', String(c.previzPort)], {
      windowsHide: true,
      env: { ...process.env, PREVIZ_ENGINE_HOME: previzHome(), PREVIZ_ENGINE_HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    previzMode = 'exe';
  }
  previzChild.on('exit', () => { previzChild = null; });
  previzChild.stdout?.on('data', () => {});
  previzChild.stderr?.on('data', () => {});
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    const h = await previzHealth();
    if (h.ok) return { ok: true, pid: previzChild.pid, url: h.url, mode: previzMode };
  }
  return { ok: false, pid: previzChild.pid, mode: previzMode, note: '已启动但健康检查未通过（可能仍在初始化）' };
}
function previzStop() {
  if (!previzChild) return { ok: true, already: true };
  try { previzChild.kill(); } catch { /* ignore */ }
  previzChild = null; previzMode = null;
  return { ok: true };
}
async function previzState() {
  const c = cfg();
  const r = await fetch(`http://127.0.0.1:${c.previzPort}/api/project`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`PREVIZ_UNREACHABLE: ${r.status}`);
  return r.json();
}
async function previzCommand(name, args) {
  const c = cfg();
  const r = await fetch(`http://127.0.0.1:${c.previzPort}/api/command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: args || {} }), signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`PREVIZ_COMMAND_FAILED: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function previzFrame(timeSec) {
  const c = cfg();
  const q = timeSec === undefined || timeSec === null ? '' : `?timeSec=${encodeURIComponent(timeSec)}`;
  const r = await fetch(`http://127.0.0.1:${c.previzPort}/api/frame${q}`, { signal: AbortSignal.timeout(8000) });
  const text = await r.text();
  if (!r.ok) throw new Error(`PREVIZ_FRAME_FAILED: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function previzPackage(shotId, samples) {
  const c = cfg();
  const r = await fetch(`http://127.0.0.1:${c.previzPort}/api/previz-package`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shotId, samples }), signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`PREVIZ_PACKAGE_FAILED: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
/** 把预演包写入镜头卡，供生成任务使用 */
async function attachPrevizToShot(projectId, shotId, samples) {
  const shots = listShots(projectId);
  const shot = shots.find((s) => s.id === shotId);
  if (!shot) throw new Error('镜头不存在');
  const pkg = await previzPackage(shot.previz?.engineShotId || undefined, samples);
  const res = pkg.result ?? pkg;
  const dir = path.join(cfg().dataDir, 'previz', shotId);
  ensureDir(dir);
  const file = path.join(dir, 'previz-package.json');
  fs.writeFileSync(file, JSON.stringify(res, null, 2), 'utf8');
  // 预演产出的首尾帧图片/控制视频目录（渲染后由 renderPreviz 写入产物）
  const renderRel = path.join('previz', 'render', shotId).replace(/\\/g, '/');
  const renderAbs = path.join(cfg().dataDir, 'previz', 'render', shotId);
  const has = (rel) => { const a = path.join(cfg().dataDir, rel); return fs.existsSync(a) ? rel : null; };
  shot.previz = {
    ...(shot.previz || {}),
    engine: 'previs-port',
    packagePath: path.relative(cfg().dataDir, file).replace(/\\/g, '/'),
    // 关键：绑定到引擎镜头的 id，否则 previzPackage 永远回退到第一个镜头
    engineShotId: res.shot?.id || shot.previz?.engineShotId || null,
    shotId: res.shot?.id || null,
    firstFrameTimeSec: res.firstFrame?.timeSec ?? null,
    lastFrameTimeSec: res.lastFrame?.timeSec ?? null,
    frames: res.frames?.length || 0,
    attachedAt: now(),
  };
  // 打通「预演 → 生成」：把可用的条件帧/控制视频登记为绝对路径，
  // resolvePrevizArtifacts() 正是按这三个字段注入 {{FIRST_FRAME}}/{{LAST_FRAME}}/{{CONTROL_VIDEO}}。
  const firstRel = has(renderRel + '/first.png');
  const lastRel = has(renderRel + '/last.png');
  const controlRel = has(renderRel + '/control.mp4');
  if (firstRel) shot.previz.firstFramePath = path.join(renderAbs, 'first.png');
  if (lastRel) shot.previz.lastFramePath = path.join(renderAbs, 'last.png');
  if (controlRel) shot.previz.controlVideoPath = path.join(renderAbs, 'control.mp4');
  upsertShot(projectId, shot);
  return { shot, package: res };
}

/**
 * 渲染预演包为真实像素（CDP 驱动预演导演台渲染核心）。
 * 产出：first.png / last.png / frame_*.png / control.mp4 / render.json
 * 依赖：渲染服务 tools/render-previz.mjs + Edge（headless WebGL/SwiftShader）。
 */
function previzRenderScript() {
  return path.join(path.dirname(cfg().dataDir), 'services', 'previz', 'tools', 'render-previz.mjs');
}
async function renderPreviz(shotId, opts = {}) {
  const c = cfg();
  const script = previzRenderScript();
  if (!fs.existsSync(script)) throw new Error(`PREVIZ_RENDER_SCRIPT_MISSING: ${script}`);
  const shots = listShots(opts.projectId);
  const shot = shots.find((s) => s.id === shotId);
  const dir = path.join(c.dataDir, 'previz', 'render', shotId);
  ensureDir(dir);
  // 清空上一批次的帧与产物：否则 samples 变小后旧 frame_*.png 会残留，
  // 下游按 frame_*.png 通配消费会得到混杂帧数的视频。
  for (const name of fs.readdirSync(dir)) {
    if (/^frame_\d+\.(png|jpg)$/i.test(name) || /^(first|last)\.png$/i.test(name) || /^control\.(mp4|webm)$/i.test(name) || name === 'render.json') {
      try { fs.unlinkSync(path.join(dir, name)); } catch { /* 忽略单个删除失败 */ }
    }
  }
  const args = [script, '--base', `http://127.0.0.1:${c.previzPort}`, '--out', dir,
    '--samples', String(opts.samples || 12), '--long', String(opts.longSide || 1600), '--fps', String(opts.fps || 24)];
  // 指定引擎镜头 id：否则 render-previz 只能回退到 activeShotId，多镜头项目会渲染错镜。
  const engineShotId = shot?.previz?.engineShotId;
  if (engineShotId) args.push('--shot', String(engineShotId));
  const ff = resolveFfmpeg(c);
  if (opts.video !== false && ff !== 'ffmpeg') { args.push('--video', '--ffmpeg', ff); }
  const r = await runProc(process.execPath, args, opts.timeoutMs || 300000);
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'render.json'), 'utf8')); } catch { /* ignore */ }
  const okFlag = r.code === 0 && !!meta;
  if (shot) {
    const renderDirAbs = dir;
    const prev = shot.previz || {};
    upsertShot(opts.projectId, {
      ...shot,
      previz: {
        ...prev,
        render: {
          dir: path.relative(c.dataDir, dir).replace(/\\/g, '/'),
          frames: meta?.frameCount || 0,
          aspect: meta?.aspect || null,
          longSide: meta?.longSide || null,
          firstFrame: meta ? 'first.png' : null,
          lastFrame: meta ? 'last.png' : null,
          controlVideo: meta?.controlVideo || null,
          elapsedMs: meta?.elapsedMs || null,
          renderedAt: now(),
        },
        // 打通「预演 → 生成」：渲染出一批产物后立即登记为生成侧可用的绝对路径，
        // 使 {{FIRST_FRAME}}/{{LAST_FRAME}}/{{CONTROL_VIDEO}} 能真正注入工作流，
        // 无需用户再手动点一次「导出预演包并绑定」。
        ...(meta
          ? {
            firstFramePath: path.join(renderDirAbs, 'first.png'),
            lastFramePath: path.join(renderDirAbs, 'last.png'),
            ...(meta.controlVideo ? { controlVideoPath: path.join(renderDirAbs, 'control.mp4') } : {}),
          }
          : {}),
      },
    });
  }
  return {
    ok: okFlag, dir, code: r.code,
    frameCount: meta?.frameCount || 0,
    firstFrame: meta ? 'first.png' : null,
    lastFrame: meta ? 'last.png' : null,
    controlVideo: meta?.controlVideo || null,
    aspect: meta?.aspect || null, longSide: meta?.longSide || null,
    elapsedMs: meta?.elapsedMs || null,
    renderer: meta?.renderer || null,
    stderr: r.code === 0 ? null : String(r.stderr || '').slice(-1200),
  };
}

function resolveFfprobe(c) {
  const ff = resolveFfmpeg(c);
  if (ff === 'ffmpeg') return 'ffprobe';
  return path.join(path.dirname(ff), 'ffprobe.exe');
}
function resolveFfmpeg(c) {
  if (c.ffmpeg && c.ffmpeg !== 'ffmpeg') return c.ffmpeg;
  const candidates = [
    path.join(c.ffmpegDir || '', 'ffmpeg.exe'),
    path.join(c.ffmpegDir || '', 'bin', 'ffmpeg.exe'),
    'ffmpeg',
  ].filter(Boolean);
  for (const p of candidates) {
    if (p === 'ffmpeg') return p;
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return 'ffmpeg';
}
function runProc(exe, args, timeoutMs = 600000) {
  return new Promise((resolve) => {
    const ch = spawn(exe, args, { windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { try { ch.kill(); } catch { /* ignore */ } }, timeoutMs);
    ch.stdout?.on('data', (d) => { out += d; if (out.length > 4_000_000) out = out.slice(-2_000_000); });
    ch.stderr?.on('data', (d) => { err += d; if (err.length > 4_000_000) err = err.slice(-2_000_000); });
    ch.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out, err: String(e.message || e) }); });
    ch.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}
/** 用 ffmpeg/ffprobe 探测媒体信息（时长/分辨率/音频轨/编码） */
async function probeMedia(absPath) {
  const c = cfg();
  const probe = resolveFfprobe(c);
  const r = await runProc(probe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', absPath], 60000);
  if (r.code !== 0) return { ok: false, error: r.err.slice(0, 400) || `ffprobe exit ${r.code}` };
  try {
    const j = JSON.parse(r.out);
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    const a = (j.streams || []).find((s) => s.codec_type === 'audio');
    return {
      ok: true,
      durationSec: Number(j.format?.duration || v?.duration || 0),
      sizeBytes: Number(j.format?.size || 0),
      width: v?.width || null, height: v?.height || null, fps: v?.r_frame_rate || null,
      videoCodec: v?.codec_name || null, audioCodec: a?.codec_name || null, hasAudio: Boolean(a),
      bitrate: Number(j.format?.bit_rate || 0),
    };
  } catch (e) { return { ok: false, error: `ffprobe 输出解析失败：${String(e.message || e)}` }; }
}
/** 后处理：转码/缩放/超分占位/补帧占位/拼接/字幕/混音 */
async function postProcess(spec) {
  const c = cfg();
  const ffmpeg = resolveFfmpeg(c);
  const op = spec.op;
  const resolveIn = (rel) => (path.isAbsolute(rel) ? rel : safeResolve(c.dataDir, rel));
  const inputs = (spec.inputs || []).map(resolveIn);
  if (!inputs.length) throw new Error('CONFIG_MISSING: inputs');
  for (const p of inputs) if (!fs.existsSync(p)) throw new Error(`NOT_FOUND: ${p}`);
  ensureDir(DIRS.post());
  const outName = spec.output || `${uid('post')}.mp4`;
  const outAbs = path.join(DIRS.post(), path.basename(outName));
  let args;
  if (op === 'transcode') {
    args = ['-y', '-i', inputs[0], '-c:v', spec.videoCodec || 'libx264', '-crf', String(spec.crf ?? 18),
      '-preset', spec.preset || 'medium', '-c:a', spec.audioCodec || 'aac', '-b:a', spec.audioBitrate || '192k', outAbs];
  } else if (op === 'scale') {
    args = ['-y', '-i', inputs[0], '-vf', `scale=${Number(spec.width) || 1280}:${Number(spec.height) || 720}:flags=lanczos`, '-c:a', 'copy', outAbs];
  } else if (op === 'fps' || op === 'interpolate') {
    // 补帧：优先 minterpolate；若配置了 RIFE 可替换为专用滤镜链
    const target = Number(spec.fps) || 48;
    args = ['-y', '-i', inputs[0], '-vf', `minterpolate=fps=${target}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`, '-c:a', 'copy', outAbs];
  } else if (op === 'concat') {
    const listFile = path.join(DIRS.post(), `${uid('concat')}.txt`);
    fs.writeFileSync(listFile, inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outAbs];
  } else if (op === 'subtitle') {
    if (!spec.subtitleFile) throw new Error('CONFIG_MISSING: subtitleFile');
    const sub = path.isAbsolute(spec.subtitleFile) ? spec.subtitleFile : safeResolve(c.dataDir, spec.subtitleFile);
    if (!fs.existsSync(sub)) throw new Error(`NOT_FOUND: ${sub}`);
    const esc = sub.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    args = ['-y', '-i', inputs[0], '-vf', `subtitles='${esc}'`, '-c:a', 'copy', outAbs];
  } else if (op === 'extract-frame') {
    const t = Number(spec.timeSec) || 0;
    const png = outAbs.replace(/\.mp4$/i, '.png');
    args = ['-y', '-ss', String(t), '-i', inputs[0], '-frames:v', '1', '-update', '1', png];
    const r0 = await runProc(ffmpeg, args);
    return { ok: r0.code === 0, op, output: path.relative(c.dataDir, png), code: r0.code, stderr: r0.err.slice(-600) };
  } else if (op === 'mix') {
    if (inputs.length < 2) throw new Error('CONFIG_MISSING: mix 需要至少 2 个输入（视频 + 音频）');
    args = ['-y', '-i', inputs[0], '-i', inputs[1], '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-shortest', outAbs];
  } else {
    throw new Error(`UNSUPPORTED_OP: ${op}（支持 transcode/scale/fps/interpolate/concat/subtitle/extract-frame/mix）`);
  }
  const r = await runProc(ffmpeg, args);
  const result = { ok: r.code === 0, op, output: r.code === 0 ? path.relative(c.dataDir, outAbs) : null, code: r.code, stderr: r.err.slice(-800) };
  if (r.code === 0) result.probe = await probeMedia(outAbs);
  return result;
}
/** 质检：文件/时长/分辨率/音频轨/首帧可解码 */
async function qualityCheck(relPath) {
  const c = cfg();
  const abs = path.isAbsolute(relPath) ? relPath : safeResolve(c.dataDir, relPath);
  const issues = [];
  if (!fs.existsSync(abs)) return { ok: false, path: relPath, issues: [{ severity: 'error', code: 'NOT_FOUND', message: `文件不存在：${abs}` }] };
  const st = fs.statSync(abs);
  if (st.size === 0) issues.push({ severity: 'error', code: 'EMPTY_FILE', message: '文件为空' });
  const probe = await probeMedia(abs);
  if (!probe.ok) {
    issues.push({ severity: 'error', code: 'PROBE_FAILED', message: probe.error || '无法解析媒体' });
    return { ok: false, path: relPath, sizeBytes: st.size, probe, issues };
  }
  if (!probe.durationSec || probe.durationSec < 0.5) issues.push({ severity: 'error', code: 'TOO_SHORT', message: `时长异常：${probe.durationSec}s` });
  if (!probe.width || !probe.height) issues.push({ severity: 'error', code: 'NO_VIDEO', message: '没有视频轨' });
  if (probe.hasAudio === false) issues.push({ severity: 'warn', code: 'NO_AUDIO', message: '没有音频轨（H3 原生音频应存在）' });
  if (probe.durationSec > 30) issues.push({ severity: 'warn', code: 'OVER_LIMIT', message: `超过 30s（${probe.durationSec.toFixed(2)}s），H3/Seedance 单镜上限` });
  return { ok: issues.every((i) => i.severity !== 'error'), path: relPath, sizeBytes: st.size, probe, issues };
}

/* ------------------------------ 自检 ------------------------------ */
async function selfCheck() {
  const c = cfg();
  const checks = [];
  const push = (name, ok, detail) => checks.push({ name, ok, detail });
  try { ensureDir(c.dataDir); push('dataDir', true, c.dataDir); } catch (e) { push('dataDir', false, String(e.message || e)); }
  try { ensureDir(c.assetRoot); push('assetRoot', true, c.assetRoot); } catch (e) { push('assetRoot', false, String(e.message || e)); }
  const ff = resolveFfmpeg(c);
  const ffRun = await runProc(ff, ['-version'], 15000);
  const ffVer = (ffRun.out.split('\n')[0] || '').trim();
  push('ffmpeg', ffRun.code === 0, ffRun.code === 0 ? `${ff} · ${ffVer.slice(0, 80)}` : `不可用：${ff}`);
  const fpRun = await runProc(resolveFfprobe(c), ['-version'], 15000);
  push('ffprobe', fpRun.code === 0, fpRun.code === 0 ? resolveFfprobe(c) : `不可用：${fpRun.err.slice(0, 120)}`);
  push('placeholder', fs.existsSync(path.join(c.dataDir, '..', 'assets', 'placeholder.mp4')), 'mock 回退样片');
  // 外部引擎为可选项：内置 port 服务可用即视为通过；仅在两者皆不可用时才失败。
  const portServerPath = previzPortServer();
  const portOk = fs.existsSync(portServerPath) && fs.existsSync(path.join(path.dirname(portServerPath), 'engine.mjs'));
  push('previzExe', portOk || Boolean(c.previzExe && fs.existsSync(c.previzExe)),
    portOk ? '使用内置 port 服务（无需外部可执行文件）' : (c.previzExe || '未配置（可选）'));
  push('previzPortSrc', portOk, portServerPath);
  try { const h = await previzHealth(); push('previz', h.ok, h.ok ? `运行中 ${h.url}` : `未运行（${h.detail}）`); } catch (e) { push('previz', false, String(e.message || e)); }
  try {
    const r = await fetch(`${String(c.comfyUrl).replace(/\/$/, '')}/system_stats`, { signal: AbortSignal.timeout(2500) });
    push('comfyui', r.ok, `HTTP ${r.status}`);
  } catch (e) { push('comfyui', false, '不可达（H3 本地待环境）'); }
  push('seedance', Boolean(c.seedanceApiKey && c.seedanceModel), c.seedanceApiKey ? (c.seedanceModel ? '已配置' : '缺少模型 ID') : 'AUTH_REQUIRED（测试阶段配置）');
  const packs = listPacks();
  const bad = packs.filter((p) => p.error);
  push('assetPacks', bad.length === 0, `${packs.length} 个挂载，${bad.length} 个异常`);
  const jobs = listJobs();
  push('jobs', true, `共 ${jobs.length} 个任务（运行中 ${jobs.filter((j) => j.status === 'running' || j.status === 'queued').length}，中断 ${jobs.filter((j) => j.status === 'interrupted').length}）`);
  // BUG-5/6/7 可观测项：启动恢复结果 + 本地并发闸门实时占用
  push('jobRuntime', true, `恢复扫描标记 ${bootRecovery.recovered} 个中断任务；本地并发上限 ${maxLocal()}，占用 ${activeLocalJobs.size}，排队 ${pendingJobGates.length}`);
  return { ok: checks.every((x) => x.ok || x.name === 'comfyui' || x.name === 'seedance' || x.name === 'ffmpeg' || x.name === 'previz'), checks };
}

/* ------------------------------ 工具 ------------------------------ */
function renderText(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }]; }
function ok(value) { return { value, content: renderText(null, value) }; }
function tool(name, description, parameters, execute) {
  return { name, description, parameters, output: { schema: { type: 'object' }, render: renderText }, async execute(args) { return execute(args || {}); } };
}
const toolDefs = [
  tool('studio_config', '读取或修改工作室配置（dataDir/assetRoot/comfyUrl/seedance 等）。action=get|set|selfcheck。',
    { type: 'object', properties: { action: { type: 'string', enum: ['get', 'set', 'selfcheck'] }, patch: { type: 'object' } }, required: ['action'], additionalProperties: false },
    async (a) => {
      // BUG-8：工具侧同样掩码回传。Agent 无需看到明文 Key（它只需要知道"已配置/未配置"），
      // 但 set 时 patch 里的 '***' 会被剔除，不会覆盖真实密钥。
      if (a.action === 'set') { const c = { ...cfg(), ...sanitizeConfigPatch(a.patch) }; saveConfig(c); initDirs(); return ok(maskConfig(c)); }
      if (a.action === 'selfcheck') return ok(await selfCheck());
      return ok(maskConfig(cfg()));
    }),
  tool('studio_project', '项目 CRUD。action=list|create|get|update|delete。',
    { type: 'object', properties: { action: { type: 'string', enum: ['list', 'create', 'get', 'update', 'delete'] }, projectId: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' } }, required: ['action'], additionalProperties: false },
    async (a) => {
      if (a.action === 'list') return ok(listProjects());
      if (a.action === 'create') return ok(createProject(a));
      if (a.action === 'get') return ok(getProject(a.projectId));
      if (a.action === 'delete') { saveProjects(listProjects().filter((p) => p.id !== a.projectId)); return ok({ ok: true }); }
      const list = listProjects(); const p = list.find((x) => x.id === a.projectId); if (!p) throw new Error('项目不存在');
      Object.assign(p, { name: a.name ?? p.name, description: a.description ?? p.description, category: a.category ?? p.category, updatedAt: now() });
      saveProjects(list); return ok(p);
    }),
  tool('studio_shot', '镜头卡 CRUD。action=list|get|create|save|delete。',
    { type: 'object', properties: { action: { type: 'string', enum: ['list', 'get', 'create', 'save', 'delete'] }, projectId: { type: 'string' }, shotId: { type: 'string' }, shot: { type: 'object' }, title: { type: 'string' } }, required: ['action', 'projectId'], additionalProperties: false },
    async (a) => {
      if (!getProject(a.projectId)) throw new Error('项目不存在');
      if (a.action === 'list') return ok(listShots(a.projectId));
      if (a.action === 'create') { const s = newShot({ title: a.title }); upsertShot(a.projectId, s); return ok(s); }
      if (a.action === 'get') { const s = listShots(a.projectId).find((x) => x.id === a.shotId); if (!s) throw new Error('镜头不存在'); return ok(s); }
      if (a.action === 'delete') { saveShots(a.projectId, listShots(a.projectId).filter((x) => x.id !== a.shotId)); return ok({ ok: true }); }
      const s = a.shot || {}; if (!s.id) s.id = a.shotId || uid('shot'); return ok(upsertShot(a.projectId, s));
    }),
  tool('studio_prompt', '编译/校验 H3 提示词。action=compile|validate|save。',
    { type: 'object', properties: { action: { type: 'string', enum: ['compile', 'validate', 'save'] }, projectId: { type: 'string' }, shotId: { type: 'string' } }, required: ['action', 'projectId', 'shotId'], additionalProperties: false },
    async (a) => {
      const s = listShots(a.projectId).find((x) => x.id === a.shotId); if (!s) throw new Error('镜头不存在');
      const prompt = compilePrompt(s);
      if (a.action === 'validate') return ok(validateShot(s));
      if (a.action === 'save') { s.promptOverride = prompt; upsertShot(a.projectId, s); return ok({ saved: true, prompt }); }
      return ok({ prompt, chars: prompt.length, validation: validateShot(s) });
    }),
  tool('studio_generate', '提交生成任务。backend=mock|h3-local|seedance-cloud；返回 job。',
    { type: 'object', properties: { projectId: { type: 'string' }, shotId: { type: 'string' }, backend: { type: 'string' } }, required: ['projectId', 'shotId'], additionalProperties: false },
    async (a) => { const s = listShots(a.projectId).find((x) => x.id === a.shotId); if (!s) throw new Error('镜头不存在'); return ok(createJob(a.projectId, s, a.backend)); }),
  tool('studio_jobs', '任务查询/重试/取消。action=list|get|retry|cancel。',
    { type: 'object', properties: { action: { type: 'string', enum: ['list', 'get', 'retry', 'cancel'] }, jobId: { type: 'string' }, limit: { type: 'number' } }, required: ['action'], additionalProperties: false },
    async (a) => {
      if (a.action === 'list') return ok(listJobs().slice(0, Math.max(1, Math.min(100, a.limit || 20))));
      const job = getJob(a.jobId); if (!job) throw new Error('任务不存在');
      if (a.action === 'cancel') { cancelJob(job.id); return ok(getJob(job.id) || job); }
      if (a.action === 'retry') { const s = listShots(job.projectId).find((x) => x.id === job.shotId); if (!s) throw new Error('镜头不存在'); return ok(createJob(job.projectId, s, job.backendId)); }
      return ok(job);
    }),
  tool('studio_assets', '资产包挂载/校验/解析 + 上传资产库。action=list|mount|unmount|verify|resolve|items|kinds。items=列出上传资产（可按 kind 过滤）。',
    { type: 'object', properties: { action: { type: 'string', enum: ['list', 'mount', 'unmount', 'verify', 'resolve', 'items', 'kinds'] }, packId: { type: 'string' }, root: { type: 'string' }, ref: { type: 'string' }, kind: { type: 'string' } }, required: ['action'], additionalProperties: false },
    async (a) => {
      if (a.action === 'list') return ok(listPacks());
      if (a.action === 'mount') return ok(mountPack(a.packId, a.root));
      if (a.action === 'unmount') return ok(unmountPack(a.packId));
      if (a.action === 'verify') return ok(verifyPack(a.packId));
      if (a.action === 'items') return ok({ items: listAssets({ kind: a.kind }), kinds: ASSET_KINDS });
      if (a.action === 'kinds') return ok({ kinds: ASSET_KINDS, extMap: KIND_EXT });
      return ok(resolveAsset(a.ref));
    }),
  tool('studio_character', '角色卡：把角色的外观描述/参考图/参考音频/画风打包复用。action=list|get|save|delete|expand。expand=展开成 prompt + 参考素材绝对路径，可直接注入生成。',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'save', 'delete', 'expand'] },
        id: { type: 'string' },
        card: { type: 'object' },
      },
      required: ['action'], additionalProperties: false,
    },
    async (a) => {
      if (a.action === 'list') return ok(listCharacters());
      if (a.action === 'get') { const c = getCharacter(a.id); if (!c) throw new Error('CHARACTER_NOT_FOUND'); return ok(c); }
      if (a.action === 'save') return ok(saveCharacter(a.card || {}));
      if (a.action === 'delete') return ok(deleteCharacter(a.id));
      return ok(expandCharacter(a.id));
    }),
  tool('studio_backend', '查看后端健康/能力。action=health|capabilities。',
    { type: 'object', properties: { action: { type: 'string', enum: ['health', 'capabilities'] } }, required: ['action'], additionalProperties: false },
    async (a) => (a.action === 'health' ? ok(await backendHealth()) : ok(backendCapabilities()))),
  tool('studio_previz', '3D 预演服务（内置预演引擎 port）。action=start|stop|health|state|command|catalog|tools|frame|package|attach|render|url。frame=按秒求值；package=导出首尾帧/采样帧 JSON；attach=绑定预演包到镜头卡；render=渲染真实像素（首尾帧 PNG + 控制视频）；url=导演台 UI 地址。',
    { type: 'object', properties: { action: { type: 'string', enum: ['start', 'stop', 'health', 'state', 'command', 'catalog', 'tools', 'frame', 'package', 'attach', 'render', 'url'] }, name: { type: 'string' }, args: { type: 'object' }, timeSec: { type: 'number' }, shotId: { type: 'string' }, projectId: { type: 'string' }, samples: { type: 'number' }, longSide: { type: 'number' }, fps: { type: 'number' }, video: { type: 'boolean' } }, required: ['action'], additionalProperties: false },
    async (a) => {
      if (a.action === 'start') return ok(await previzStart());
      if (a.action === 'stop') return ok(previzStop());
      if (a.action === 'health') return ok(await previzHealth());
      if (a.action === 'state') return ok(await previzState());
      if (a.action === 'url') return ok({ url: `http://127.0.0.1:${cfg().previzPort}/`, note: '预演导演台 UI（由本插件静态托管，数据来自 port 引擎）' });
      if (a.action === 'catalog') { const st = await previzState(); return ok({ catalog: st.catalog, health: st.health }); }
      if (a.action === 'tools') { const st = await previzState(); return ok({ agent_rules: st.agent_rules, note: '15 个 director_* 工具由预演引擎提供；本工具用 action=command 代理' }); }
      if (a.action === 'frame') return ok(await previzFrame(a.timeSec));
      if (a.action === 'package') return ok(await previzPackage(a.shotId, a.samples));
      if (a.action === 'render') {
        if (!a.shotId) throw new Error('render 需要 shotId');
        return ok(await renderPreviz(a.shotId, { projectId: a.projectId, samples: a.samples, longSide: a.longSide, fps: a.fps, video: a.video }));
      }
      if (a.action === 'attach') {
        if (!a.projectId || !a.shotId) throw new Error('attach 需要 projectId 与 shotId');
        const r = await attachPrevizToShot(a.projectId, a.shotId, a.samples);
        return ok({ shot: r.shot, package: { schema: r.package.schema, frames: r.package.frames?.length, first: r.package.firstFrame?.timeSec, last: r.package.lastFrame?.timeSec } });
      }
      if (!a.name) throw new Error('缺少 command name（如 director_get_state / director_add_element）');
      return ok(await previzCommand(a.name, a.args));
    }),
  tool('studio_post', '后处理（ffmpeg）。op=transcode|scale|fps|interpolate|concat|subtitle|extract-frame|mix。inputs 为 dataDir 相对或绝对路径。',
    {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['transcode', 'scale', 'fps', 'interpolate', 'concat', 'subtitle', 'extract-frame', 'mix'] },
        inputs: { type: 'array', items: { type: 'string' } },
        output: { type: 'string' },
        width: { type: 'number' }, height: { type: 'number' }, fps: { type: 'number' },
        crf: { type: 'number' }, preset: { type: 'string' }, videoCodec: { type: 'string' },
        audioCodec: { type: 'string' }, audioBitrate: { type: 'string' },
        timeSec: { type: 'number' }, subtitleFile: { type: 'string' },
      },
      required: ['op', 'inputs'], additionalProperties: false,
    },
    async (a) => ok(await postProcess(a))),
  tool('studio_qc', '质检：时长/分辨率/编码/音频轨/首帧可解码（ffprobe）。输入为 dataDir 相对或绝对路径。',
    { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
    async (a) => ok(await qualityCheck(a.path))),
];

/* ------------------------------ Web API ------------------------------ */
async function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; if (d.length > 16 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}
/** 读原始二进制 body（上传用）。上限可配，默认 512MB。 */
function readRawBody(req, limit = 512 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error(`UPLOAD_TOO_LARGE: 超过 ${Math.round(limit / 1024 / 1024)}MB`)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
/**
 * 极简 multipart/form-data 解析器：只取文件部分 + 文本字段。
 * 不依赖第三方库；够用即可（单文件、边界匹配）。
 */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  const boundary = m ? (m[1] || m[2]).trim() : null;
  if (!boundary) throw new Error('UPLOAD_BAD_FORM: 缺少 multipart boundary');
  const delim = Buffer.from('--' + boundary);
  const parts = [];
  let idx = buf.indexOf(delim);
  if (idx < 0) throw new Error('UPLOAD_BAD_FORM: 找不到 boundary');
  while (idx >= 0) {
    const start = idx + delim.length;
    // 结束标记 "--"
    if (buf.slice(start, start + 2).toString() === '--') break;
    const next = buf.indexOf(delim, start);
    if (next < 0) break;
    const part = buf.slice(start, next);
    // 去掉首尾 CRLF
    const body = part.slice(part.indexOf('\r\n\r\n') + 4, part.length - 2);
    const head = part.slice(0, part.indexOf('\r\n\r\n')).toString('utf8');
    const nameM = /name="([^"]*)"/i.exec(head);
    const fileM = /filename="([^"]*)"/i.exec(head);
    const ctM = /content-type:\s*([^\r\n]+)/i.exec(head);
    if (nameM) {
      parts.push({
        name: nameM[1],
        filename: fileM ? fileM[1] : null,
        contentType: ctM ? ctM[1].trim() : null,
        data: body,
      });
    }
    idx = next;
  }
  return parts;
}
function sendJson(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
const MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8' };
function safeResolve(base, rel) {
  const abs = path.resolve(base, rel || '');
  const root = path.resolve(base);
  if (!abs.startsWith(root + path.sep) && abs !== root) throw new Error('路径越界');
  return abs;
}
/**
 * 解析 `Range: bytes=start-end`（单区间）。
 * 返回 null 表示无 Range 或不可满足的语法 → 回退 200 全量（RFC 7233 允许忽略畸形 Range）。
 * 返回 { unsatisfiable: true } 表示区间不落在文件内 → 416。
 */
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (!rawStart && !rawEnd) return null;
  let start, end;
  if (!rawStart) {
    // bytes=-N：最后 N 字节
    const n = Number(rawEnd);
    if (!Number.isFinite(n) || n <= 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (end >= size) end = size - 1;
  }
  if (start >= size || start > end) return { unsatisfiable: true };
  return { start, end, length: end - start + 1 };
}
/** `Content-Range: bytes 0-99/12345` */
function contentRange(start, end, size) { return `bytes ${start}-${end}/${size}`; }
/**
 * BUG-9 / BUG-10：静态文件服务。
 * - GET / HEAD：同一套响应头；HEAD 只回头不发 body
 * - Range：单区间返回 206 + Content-Range + 精确 Content-Length；不可满足返回 416
 * - 缺文件 / 目录 / 越界路径：JSON 404（{error:'NOT_FOUND', path}），与其它路由一致
 * - 保持原有 safeResolve 越界防护不变
 */
/**
 * 安全地把文件流接到响应：stat 与读取之间文件可能被删/被占用，
 * 必须吞掉流的 error，否则 Node 会抛未处理异常并打断整个请求处理链。
 */
function pipeFile(res, abs, opts) {
  const stream = fs.createReadStream(abs, opts);
  stream.on('error', () => {
    // 头已发出时无法再改状态码，只能断开；未发出则补一个 500 JSON
    if (!res.headersSent) sendJson(res, 500, { error: 'READ_FAILED' });
    else try { res.destroy(); } catch { /* ignore */ }
  });
  stream.pipe(res);
}
function serveFile(req, res, baseDir, rel) {
  let abs;
  try {
    abs = safeResolve(baseDir, rel);
  } catch (e) {
    // 越界属于客户端错误：保持 JSON，但不暴露真实路径
    return sendJson(res, 400, { error: 'FORBIDDEN_PATH', path: rel });
  }
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return sendJson(res, 404, { error: 'NOT_FOUND', path: rel });
  }
  if (!st.isFile()) return sendJson(res, 404, { error: 'NOT_FOUND', path: rel });
  const size = st.size;
  const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const baseHeaders = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  const isHead = req.method === 'HEAD';
  // 用 mtime 生成弱 ETag，便于浏览器/播放器做条件缓存；不影响客户端既有行为
  const etag = `W/"${size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;

  const range = parseRange(req.headers?.range, size);
  if (range && range.unsatisfiable) {
    res.writeHead(416, { ...baseHeaders, 'Content-Range': contentRange(0, 0, size), 'Content-Length': '0' });
    return res.end();
  }
  if (range) {
    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': contentRange(range.start, range.end, size),
      'Content-Length': String(range.length),
      ETag: etag,
    });
    if (isHead) return res.end();
    return pipeFile(res, abs, { start: range.start, end: range.end });
  }
  res.writeHead(200, { ...baseHeaders, 'Content-Length': String(size), ETag: etag });
  if (isHead) return res.end();
  return pipeFile(res, abs);
}
async function handleApi(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = url.pathname.replace(/^\/ai-video-studio\/api/, '') || '/';
  try {
    const c = cfg();
    if (req.method === 'GET' && route === '/selfcheck') return sendJson(res, 200, await selfCheck());
    if (req.method === 'GET' && route === '/config') return sendJson(res, 200, maskConfig(c));
    // BUG-8：POST 同样只回掩码；写盘前剔除 '***' 等占位值，避免把哨兵存成真实密钥
    if (req.method === 'POST' && route === '/config') {
      const b = await readBody(req);
      saveConfig({ ...c, ...sanitizeConfigPatch(b) });
      initDirs();
      return sendJson(res, 200, maskConfig(cfg()));
    }
    if (req.method === 'GET' && route === '/projects') return sendJson(res, 200, listProjects());
    if (req.method === 'POST' && route === '/projects') return sendJson(res, 200, createProject(await readBody(req)));
    const shotsM = route.match(/^\/projects\/([^/]+)\/shots$/);
    if (req.method === 'GET' && shotsM) return sendJson(res, 200, listShots(decodeURIComponent(shotsM[1])));
    if (req.method === 'POST' && route === '/shots') { const b = await readBody(req); const s = b.shot || newShot(b); if (!s.id) s.id = uid('shot'); return sendJson(res, 200, upsertShot(b.projectId, s)); }
    if (req.method === 'POST' && route === '/compile') { const b = await readBody(req); const s = listShots(b.projectId).find((x) => x.id === b.shotId); if (!s) throw new Error('镜头不存在'); return sendJson(res, 200, { prompt: compilePrompt(s), validation: validateShot(s) }); }
    if (req.method === 'POST' && route === '/generate') { const b = await readBody(req); const s = listShots(b.projectId).find((x) => x.id === b.shotId); if (!s) throw new Error('镜头不存在'); return sendJson(res, 200, createJob(b.projectId, s, b.backend)); }
    if (req.method === 'GET' && route === '/jobs') return sendJson(res, 200, listJobs());
    if (req.method === 'POST' && route === '/jobs') {
      const b = await readBody(req);
      const job = getJob(b.jobId);
      if (!job) throw new Error('任务不存在');
      if (b.action === 'cancel') { return sendJson(res, 200, cancelJob(job.id)); }
      if (b.action === 'retry') { const s = listShots(job.projectId).find((x) => x.id === job.shotId); if (!s) throw new Error('镜头不存在'); return sendJson(res, 200, createJob(job.projectId, s, job.backendId)); }
      return sendJson(res, 200, job);
    }
    if (req.method === 'GET' && route === '/backends') return sendJson(res, 200, { health: await backendHealth(), capabilities: backendCapabilities() });
    if (req.method === 'GET' && route === '/previz') return sendJson(res, 200, { health: await previzHealth(), home: previzHome(), exe: c.previzExe, port: c.previzPort });
    if (req.method === 'POST' && route === '/previz/start') return sendJson(res, 200, await previzStart());
    if (req.method === 'POST' && route === '/previz/stop') return sendJson(res, 200, previzStop());
    if (req.method === 'GET' && route === '/previz/state') return sendJson(res, 200, await previzState());
    if (req.method === 'POST' && route === '/previz/command') { const b = await readBody(req); return sendJson(res, 200, await previzCommand(b.name, b.args)); }
    if (req.method === 'GET' && route === '/previz/frame') return sendJson(res, 200, await previzFrame(url.searchParams.get('timeSec')));
    if (req.method === 'POST' && route === '/previz/package') { const b = await readBody(req).catch(() => ({})); return sendJson(res, 200, await previzPackage(b.shotId, b.samples)); }
    if (req.method === 'POST' && route === '/previz/attach') { const b = await readBody(req); const r = await attachPrevizToShot(b.projectId, b.shotId, b.samples); return sendJson(res, 200, { shot: r.shot, package: { schema: r.package.schema, frames: r.package.frames?.length } }); }
    if (req.method === 'POST' && route === '/previz/render') { const b = await readBody(req).catch(() => ({})); return sendJson(res, 200, await renderPreviz(b.shotId, b)); }
    if (req.method === 'GET' && route === '/previz/url') return sendJson(res, 200, { url: `http://127.0.0.1:${cfg().previzPort}/` });
    if (req.method === 'POST' && route === '/post') { const b = await readBody(req); return sendJson(res, 200, await postProcess(b)); }
    if (req.method === 'POST' && route === '/qc') { const b = await readBody(req); return sendJson(res, 200, await qualityCheck(b.path)); }
    if (req.method === 'GET' && route === '/profiles') return sendJson(res, 200, { profiles: PROFILES, default: cfg().defaultProfile, ffmpeg: resolveFfmpeg(c) });
    if (req.method === 'GET' && route === '/assets') return sendJson(res, 200, listPacks());
    /* ---------- 上传资产库（图片/视频/音频/3D/字体） ---------- */
    if (req.method === 'GET' && route === '/assets/items') {
      return sendJson(res, 200, {
        items: listAssets({ kind: url.searchParams.get('kind') || undefined, q: url.searchParams.get('q') || undefined }),
        kinds: ASSET_KINDS,
      });
    }
    if (req.method === 'POST' && route === '/assets/upload') {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data')) {
        const raw = await readRawBody(req);
        const parts = parseMultipart(raw, ct);
        const saved = [];
        // 文本字段
        const fields = {};
        for (const p of parts) if (!p.filename) fields[p.name] = p.data.toString('utf8');
        // 文件字段（可多文件）
        for (const p of parts) {
          if (!p.filename) continue;
          saved.push(saveUploadedAsset(p.data, {
            filename: p.filename,
            kind: fields.kind || undefined,
            name: fields.name || p.filename,
            tag: fields.tag, note: fields.note,
          }));
        }
        if (!saved.length) return sendJson(res, 400, { error: 'UPLOAD_EMPTY: 没有收到文件' });
        return sendJson(res, 200, { ok: true, saved, count: saved.length });
      }
      // 也支持 raw body + 查询参数（便于脚本 curl --data-binary）
      const raw = await readRawBody(req);
      const item = saveUploadedAsset(raw, {
        filename: url.searchParams.get('name') || 'upload.bin',
        kind: url.searchParams.get('kind') || undefined,
        tag: url.searchParams.get('tag') || '',
        note: url.searchParams.get('note') || '',
      });
      return sendJson(res, 200, { ok: true, saved: [item], count: 1 });
    }
    if (req.method === 'POST' && route === '/assets/delete') {
      const b = await readBody(req);
      return sendJson(res, 200, removeAsset(b.id));
    }
    /* ---------- 角色卡 ---------- */
    if (req.method === 'GET' && route === '/characters') return sendJson(res, 200, listCharacters());
    if (req.method === 'GET' && route === '/characters/get') {
      const c = getCharacter(url.searchParams.get('id'));
      return sendJson(res, c ? 200 : 404, c || { error: 'CHARACTER_NOT_FOUND' });
    }
    if (req.method === 'POST' && route === '/characters/save') {
      const b = await readBody(req);
      return sendJson(res, 200, saveCharacter(b.card || b));
    }
    if (req.method === 'POST' && route === '/characters/delete') {
      const b = await readBody(req);
      return sendJson(res, 200, deleteCharacter(b.id));
    }
    if (req.method === 'POST' && route === '/characters/ref') {
      // 给角色卡上传参考素材
      const ct = String(req.headers['content-type'] || '');
      if (!ct.includes('multipart/form-data')) return sendJson(res, 400, { error: 'UPLOAD_BAD_FORM: 需要 multipart' });
      const raw = await readRawBody(req);
      const parts = parseMultipart(raw, ct);
      const fields = {};
      for (const p of parts) if (!p.filename) fields[p.name] = p.data.toString('utf8');
      const charId = fields.id;
      const card = getCharacter(charId);
      if (!card) return sendJson(res, 404, { error: 'CHARACTER_NOT_FOUND' });
      const dir = path.join(DIRS.characters(), charId, 'refs');
      ensureDir(dir);
      const added = [];
      for (const p of parts) {
        if (!p.filename) continue;
        const ext = path.extname(p.filename).toLowerCase();
        const kind = kindOfExt(ext);
        const name = `${uid('ref')}${ext}`;
        const abs = path.join(dir, name);
        fs.writeFileSync(abs, p.data);
        const ref = {
          id: uid('cref'), kind, name: p.filename,
          rel: path.relative(path.join(DIRS.characters(), charId), abs).replace(/\\/g, '/'),
          bytes: p.data.length, createdAt: now(),
        };
        card.refs = Array.isArray(card.refs) ? card.refs : [];
        card.refs.push(ref);
        added.push(ref);
      }
      saveCharacter(card);
      return sendJson(res, 200, { ok: true, added, card: getCharacter(charId) });
    }
    if (req.method === 'GET' && route === '/characters/expand') {
      try {
        return sendJson(res, 200, expandCharacter(url.searchParams.get('id')));
      } catch (e) { return sendJson(res, 404, { error: String(e.message || e) }); }
    }
    if (req.method === 'GET' && route === '/characters/asset') {
      // 角色卡参考素材的静态服务
      const id = url.searchParams.get('id');
      const rel = url.searchParams.get('rel');
      const card = getCharacter(id);
      if (!card) return sendJson(res, 404, { error: 'CHARACTER_NOT_FOUND' });
      try {
        const base = path.join(DIRS.characters(), String(id));
        const abs = safeResolve(base, rel);
        if (!fs.existsSync(abs)) return sendJson(res, 404, { error: 'NOT_FOUND', path: rel });
        res.writeHead(200, {
          'Content-Type': MIME_KIND[path.extname(abs).toLowerCase()] || 'application/octet-stream',
          'Content-Length': fs.statSync(abs).size,
          'Cache-Control': 'no-store',
        });
        return fs.createReadStream(abs).pipe(res);
      } catch (e) { return sendJson(res, 400, { error: 'FORBIDDEN_PATH', path: rel }); }
    }
    if (req.method === 'GET' && route === '/assets/item') {
      // 资产库文件的静态服务
      const id = url.searchParams.get('id');
      try {
        const a = resolveAssetPath(id);
        res.writeHead(200, {
          'Content-Type': a.mime || 'application/octet-stream',
          'Content-Length': fs.statSync(a.absPath).size,
          'Cache-Control': 'no-store',
        });
        return fs.createReadStream(a.absPath).pipe(res);
      } catch (e) { return sendJson(res, 404, { error: String(e.message || e) }); }
    }
    if (req.method === 'POST' && route === '/assets/mount') { const b = await readBody(req); return sendJson(res, 200, mountPack(b.packId, b.root)); }
    if (req.method === 'POST' && route === '/assets/unmount') { const b = await readBody(req); return sendJson(res, 200, unmountPack(b.packId)); }
    if (req.method === 'POST' && route === '/assets/verify') { const b = await readBody(req); return sendJson(res, 200, verifyPack(b.packId)); }
    if (route === '/file' && (req.method === 'GET' || req.method === 'HEAD')) {
      // BUG-9：GET/HEAD 共用一套头（含 Accept-Ranges），HEAD 不发 body
      // BUG-10：缺文件/目录一律 JSON 404（与其它路由错误格式一致）
      return serveFile(req, res, c.dataDir, url.searchParams.get('path') || '');
    }
    return sendJson(res, 404, { error: `unknown route: ${route}` });
  } catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
}

/* ------------------------------ 入口 ------------------------------ */
export function apply(ctx) {
  ctx.effect(() => {
    const disposers = toolDefs.map((t) => ctx.tools.register(t));
    return () => disposers.forEach((d) => d && d());
  });
  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: '/ai-video-studio/api', handler: handleApi });
    return () => dispose();
  });
  ctx.effect(() => {
    const c = cfg();
    if (c.previzAutoStart) {
      (async () => {
        try {
          const h = await previzHealth();
          if (!h.ok) await previzStart();
        } catch { /* 自动启动失败不阻塞插件 */ }
      })();
    }
    return () => { try { previzStop(); } catch { /* ignore */ } };
  });
}
