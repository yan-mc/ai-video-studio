/**
 * 领域数据模型 —— 字段与洛书 1.0.59 实测模型对齐。
 *
 * 来源证据：
 *  - 项目记录字段：1.0.19 报告 §7.1（id/name/createdAt/updatedAt/nodeCount/rootPath/category/
 *    script 与 comic 的绑定指针 + 画布 nodes/history/viewport）
 *  - 资产类型枚举 Ke：§4.3 / §7.2（14 类）
 *  - 资产记录：{id, projectId, type, name, dataJson, createdAt, updatedAt}
 *  - 镜头资产：§7.2 shot → {episodeName, episodeIndex, shotIndex, suffix, shotTitle,
 *    prompt, materialRefs, characterRefs, sceneRefs, itemRefs, duration}
 *  - 模型规格：§7.4 ModelSpec
 *  - H3 工坊参数：1.0.59 h3PromptWorkshop i18n（episode/aspect/duration/language/
 *    style/platform/llmModel/title）
 */
import path from 'node:path';
import { collectionStore } from './json-store.js';
import { loadConfig } from '../config.js';

/* ------------------------------------------------------------------ 常量 */

/** 14 类资产（洛书 Ke 枚举） */
export const ASSET_TYPES = Object.freeze([
  'general', 'character', 'scene', 'item', 'reference',
  'video_segment', 'voice_tone', 'shot', 'control', 'motion_shot',
  'previz', 'costume', 'accessory', 'weapon',
]);

/** 资产类型中文名（供 UI / 工具用） */
export const ASSET_TYPE_LABELS = Object.freeze({
  general: '通用',
  character: '角色',
  scene: '场景',
  item: '道具',
  reference: '参考',
  video_segment: '视频片段',
  voice_tone: '音色',
  shot: '镜头',
  control: '控制图',
  motion_shot: '动态镜头',
  previz: '预演',
  costume: '服装',
  accessory: '配饰',
  weapon: '武器',
});

/** 项目分类（洛书 project.category） */
export const PROJECT_CATEGORIES = Object.freeze(['drama', 'comic', 'ecommerce', 'free', 'uncategorized']);
export const PROJECT_CATEGORY_LABELS = Object.freeze({
  drama: '短剧', comic: '漫剧', ecommerce: '电商', free: '自由创作', uncategorized: '未分类',
});

/** 26 种画布节点 type key（洛书 node-types.json + 报告 §4.1） */
export const NODE_TYPES = Object.freeze([
  'uploadNode', 'audioUploadNode', 'uploadVideoNode',
  'agentGenNode', 'imageNode', 'aiTextNode',
  'aiVoiceGenerationNode', 'extractVoiceNode',
  'extractCharacterNode', 'extractSceneNode', 'extractItemNode',
  'exportImageNode', 'exportVideoNode', 'textAnnotationNode', 'groupNode',
  'storyboardNode', 'storyboardGenNode', 'videoGeneratorNode',
  'vr360PanoramaNode', 'panoramaViewerBNode', 'panoramaNode',
  'episodeSubCanvasNode', 'backgroundMusicNode',
  'blueprintNode', 'previzNode', 'poseStudioNode',
]);

export const NODE_LABELS = Object.freeze({
  uploadNode: '上传图片', audioUploadNode: '上传音频', uploadVideoNode: '上传视频',
  agentGenNode: '智能体生成', imageNode: 'AI 图片', aiTextNode: 'AI 文本',
  aiVoiceGenerationNode: 'AI 音色', extractVoiceNode: '提取音色',
  extractCharacterNode: '角色提取', extractSceneNode: '场景提取', extractItemNode: '道具提取',
  exportImageNode: '结果图片', exportVideoNode: '结果视频', textAnnotationNode: '文本注释',
  groupNode: '分组', storyboardNode: '切割结果', storyboardGenNode: '分镜生成',
  videoGeneratorNode: 'AI 视频', vr360PanoramaNode: '全景图 A · 探索版',
  panoramaViewerBNode: '全景图 B · 查看版', panoramaNode: '全景图生成',
  episodeSubCanvasNode: '剧集画布', backgroundMusicNode: '背景音乐生成',
  blueprintNode: '导演台', previzNode: '白模预演', poseStudioNode: '姿势台',
});

/** 结果节点子类型（洛书 resultKind） */
export const RESULT_KINDS = Object.freeze([
  'generic', 'storyboardGenOutput', 'storyboardSplitExport',
  'storyboardFrameEdit', 'videoGeneratorOutput',
]);

/** 任务状态（洛书任务状态机 + 本地扩展） */
export const JOB_STATUS = Object.freeze([
  'queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted',
]);

/**
 * 生成档位 —— 沿用已实测可用的 H3 画布表。
 * H3 对画布极其敏感：宽高必须 32 倍数且落在官方 latent 网格上，
 * 否则 sampling 会 RuntimeError（832x480 / 854x480 实测均报错）。
 */
export const H3_CANVAS_16x9 = Object.freeze({
  0.2: [608, 352], 0.3: [736, 416], 0.4: [864, 480], 0.5: [960, 544],
  0.6: [1056, 608], 0.7: [1152, 640], 0.8: [1216, 672], 0.9: [1280, 736],
  0.98: [1344, 768],
});

export const PROFILES = Object.freeze({
  'P12-draft':   { backend: 'h3-local', mp: 0.4,  steps: 4, cfg: 1.0, label: '12G 草稿 480p（864×480）' },
  'P16-std':     { backend: 'h3-local', mp: 0.5,  steps: 4, cfg: 1.0, label: '12G 标准 544p（960×544）' },
  'P24-quality': { backend: 'h3-local', mp: 0.6,  steps: 4, cfg: 1.0, label: '12G 高质 608p（1056×608）' },
  'P768-quality':{ backend: 'h3-local', mp: 0.98, steps: 4, cfg: 1.0, label: '768p 官方档（1344×768）' },
  'cloud-fallback': { backend: 'seedance-cloud', mp: 0.7, steps: 0, cfg: 0, label: '云端兜底（Seedance 1280×720）' },
});

export function profileOf(name) {
  return PROFILES[name] || PROFILES['P12-draft'];
}

/**
 * 按画面比例换算分辨率：取档位 16:9 基准 → 按比例换 → 对齐 32 → 像素偏差超阈值则回退基准。
 */
export function resolutionFor(profileName, ratio = '16:9') {
  const p = profileOf(profileName);
  const mp = Number(p.mp) || 0.4;
  const keys = Object.keys(H3_CANVAS_16x9).map(Number).sort((a, b) => a - b);
  let baseKey = keys.reduce((best, k) => (Math.abs(k - mp) < Math.abs(best - mp) ? k : best), keys[0]);
  const [bw, bh] = H3_CANVAS_16x9[baseKey];
  const [rw, rh] = String(ratio).split(':').map(Number);
  if (!rw || !rh) return { width: bw, height: bh, mp: baseKey };
  const targetPixels = bw * bh;
  const aspect = rw / rh;
  let h = Math.sqrt(targetPixels / aspect);
  let w = h * aspect;
  const align32 = (n) => Math.max(32, Math.round(n / 32) * 32);
  w = align32(w); h = align32(h);
  const drift = Math.abs((w * h) / targetPixels - 1);
  if (drift > 0.12) return { width: bw, height: bh, mp: baseKey };
  return { width: w, height: h, mp: baseKey };
}

/** H3 length 必须在 17k+5 网格上（124 ≈ 5 秒 @24fps） */
export function h3Length(durationSec, fps = 24) {
  const raw = Math.max(5, Math.round((Number(durationSec) || 5) * fps));
  const k = Math.max(0, Math.ceil((raw - 5) / 17));
  return Math.min(3600, 5 + k * 17);
}

/** 19 档 H3 模型常量（1.0.59 LUOSHU_COMFY_H3_* 映射，去品牌为 JZ_*） */
export const H3_MODEL_SLOTS = Object.freeze([
  { slot: 'T2V',      label: '文生视频' },
  { slot: 'I2V',      label: '图生视频' },
  { slot: 'FLF',      label: '首尾帧' },
  { slot: '5SEG',     label: '五段流（洛书特色）' },
  { slot: 'U04',      label: '专项 U04' },
  { slot: 'U05',      label: '专项 U05' },
  { slot: 'U07',      label: '专项 U07' },
  { slot: 'U09V3',    label: '专项 U09 v3' },
  { slot: 'U09V4',    label: '专项 U09 v4' },
  { slot: 'U14',      label: '专项 U14' },
  { slot: 'U16',      label: '专项 U16' },
  { slot: 'U17',      label: '专项 U17' },
  { slot: 'U20FIGHT', label: '战斗连续性' },
  { slot: 'U20FL2VA', label: 'FL2VA' },
  { slot: 'U22',      label: '专项 U22' },
  { slot: 'U24V2',    label: '专项 U24 v2' },
  { slot: 'U24V927',  label: '专项 U24 v927' },
  { slot: 'U28',      label: '专项 U28' },
  { slot: 'U32',      label: '专项 U32' },
]);

/* ------------------------------------------------------------- 存储实例 */

function dirs() {
  const cfg = loadConfig();
  const root = cfg.dataDir;
  return {
    root,
    projects: path.join(root, 'projects'),
    shots: (projectId) => path.join(root, 'shots', projectId, 'shots.json'),
    assetsIndex: path.join(root, 'assets-index.json'),
    characters: path.join(root, 'characters'),
    jobs: path.join(root, 'jobs.json'),
    outputs: path.join(root, 'outputs'),
    prompts: path.join(root, 'prompts'),
    previz: path.join(root, 'previz'),
  };
}

export { dirs };

export const projects = collectionStore(path.join(dirs().root, 'projects.json'), { prefix: 'proj' });
// 注意：jobs 的权威实现在 services/job-store.js（惰性单例，跟随 dataDir 变化）。
// 这里不再导出 jobs，避免"模块加载时把路径冻死"的问题。
export const assets = collectionStore(dirs().assetsIndex, { prefix: 'asset' });

export function newProject({ name, category = 'uncategorized', rootPath = '', description = '' } = {}) {
  const now = Date.now();
  return {
    id: projects.newId(),
    name: String(name || '未命名项目'),
    category: PROJECT_CATEGORIES.includes(category) ? category : 'uncategorized',
    rootPath,
    description,
    createdAt: now,
    updatedAt: now,
    nodeCount: 0,
    // 画布数据由 SPA 维护，后端只保存
    nodes: [],
    edges: [],
    viewport: null,
    scriptProjectName: null,
    scriptProjectDir: null,
    comicProjectName: null,
    comicProjectDir: null,
  };
}

export function newShot({ title = '', episodeIndex = 1, shotIndex = 1, ...rest } = {}) {
  return {
    id: `shot_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title: String(title || `镜头 ${shotIndex}`),
    episodeName: rest.episodeName || `第 ${episodeIndex} 集`,
    episodeIndex,
    shotIndex,
    suffix: rest.suffix || '',
    mode: rest.mode || 't2v',
    durationSec: Number(rest.durationSec) || 5,
    ratio: rest.ratio || '16:9',
    profile: rest.profile || 'P12-draft',
    backend: rest.backend || 'h3-local',
    style: rest.style || '',
    description: rest.description || '',
    camera: rest.camera || '',
    dialogue: rest.dialogue || '',
    sound: rest.sound || '',
    music: rest.music || '',
    prompt: rest.prompt || '',
    refs: { images: [], videos: [], audios: [] },
    characterRefs: [], sceneRefs: [], itemRefs: [], materialRefs: [],
    previz: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function validateShot(shot) {
  const warnings = [];
  const dur = Number(shot.durationSec);
  if (!Number.isFinite(dur) || dur < 1 || dur > 15) warnings.push('时长需为 1—15 秒');
  const imgs = shot.refs?.images?.length || 0;
  if (imgs > 9) warnings.push('参考图超过 9 张');
  if (shot.mode === 'i2v' && imgs < 1) warnings.push('首帧模式需要 1 张参考图');
  if (shot.mode === 'fl2v' && imgs < 2) warnings.push('首尾帧模式需要 2 张参考图');
  return { ok: warnings.length === 0, warnings };
}

export { ASSET_TYPES as default };