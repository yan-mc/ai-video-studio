/**
 * 配置层 —— 单一来源，带缓存与字段白名单。
 *
 * 审查修正的两个缺陷：
 *  1) 原实现每次 cfg() 都同步读盘（热路径 IO 放大）；
 *  2) POST /config 无字段白名单，任意键落盘，可写入 ffmpeg 可执行路径 → RCE。
 *
 * 本实现：可执行路径类字段一律不接受来自配置/接口的覆盖。
 */
import fs from 'node:fs';
import path from 'node:path';

const PLUGIN_ROOT_FOR_CONFIG = path.resolve(import.meta.dirname, '..');
const CONFIG_FILE = process.env.DSH_JZ_CONFIG_FILE
  ? path.resolve(process.env.DSH_JZ_CONFIG_FILE)
  : path.join(PLUGIN_ROOT_FOR_CONFIG, 'data', 'config.json');

/**
 * 插件数据目录的权威默认值：<插件根>/data。
 * 注意：测试时不要通过写真实 config.json 来改 dataDir——那会污染线上实例。
 * 测试请设 DSH_JZ_DATA_DIR 环境变量，或直接调 saveConfig 到临时目录后 resetConfigCache。
 */
const PLUGIN_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_DATA_DIR = process.env.DSH_JZ_DATA_DIR
  ? path.resolve(process.env.DSH_JZ_DATA_DIR)
  : path.join(PLUGIN_ROOT, 'data');

/** 默认配置。可执行程序一律走内置探测，不从配置读。 */
const DEFAULTS = Object.freeze({
  dataDir: DEFAULT_DATA_DIR,
  assetRoot: path.resolve(import.meta.dirname, '..', '..', '资产包'),
  comfyUrl: 'http://127.0.0.1:8188',
  comfyInputDir: '',
  seedanceEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
  seedanceModel: '',
  seedanceApiKey: '',
  seedanceMock: true,           // 无 key 时走 mock，保证全流程可测
  defaultBackend: 'h3-local',
  defaultProfile: 'P12-draft',
  maxConcurrentLocal: 1,
  previzPort: 4318,
  previzAutoStart: true,
  ffmpegDir: path.resolve(import.meta.dirname, '..', '..', 'tools', 'ffmpeg'),
  theme: 'inknight',            // 墨夜
  accent: 'cinnabar',           // 朱砂红
  locale: 'zh',
});

/** 允许通过 API 修改的字段（白名单）。可执行路径类字段刻意不在其中。 */
export const WRITABLE_CONFIG_KEYS = Object.freeze([
  'dataDir', 'assetRoot', 'comfyUrl', 'comfyInputDir',
  'seedanceEndpoint', 'seedanceModel', 'seedanceApiKey', 'seedanceMock',
  'defaultBackend', 'defaultProfile', 'maxConcurrentLocal',
  'previzPort', 'previzAutoStart', 'theme', 'accent', 'locale',
]);

let cache = null;

function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const txt = fs.readFileSync(file, 'utf8');
    if (!txt.trim()) return fallback;
    return JSON.parse(txt);
  } catch {
    // 配置损坏时回退默认值，并保留原文件以便人工修复
    try { fs.copyFileSync(file, file + '.broken'); } catch { /* ignore */ }
    return fallback;
  }
}

export function loadConfig() {
  if (cache) return cache;
  const raw = readJsonSafe(CONFIG_FILE, {});
  const merged = { ...DEFAULTS, ...pick(raw, WRITABLE_CONFIG_KEYS) };
  cache = merged;
  return merged;
}

/** 仅供测试/重载用 */
export function resetConfigCache() { cache = null; }

export function saveConfig(patch) {
  const current = loadConfig();
  const next = { ...current, ...pick(patch, WRITABLE_CONFIG_KEYS) };
  const dir = path.dirname(CONFIG_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = CONFIG_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);        // 原子替换
  cache = next;
  return next;
}

/** 对外输出时掩码敏感字段 */
export function maskConfig(cfg = loadConfig()) {
  const out = { ...cfg };
  for (const key of ['seedanceApiKey']) {
    if (out[key]) out[key] = '***';
  }
  return out;
}

/**
 * 写盘前的清洗：剔除占位符、剔除白名单外字段。
 * 修复原实现"哨兵值被存成真实密钥"与"任意字段落盘"两个缺陷。
 */
export function sanitizeConfigPatch(patch) {
  if (!patch || typeof patch !== 'object') return {};
  const out = {};
  for (const key of WRITABLE_CONFIG_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // 掩码回填：'***' 或含"保持不变"的占位文案不写盘
      if (trimmed === '***' || trimmed.includes('保持不变')) continue;
      out[key] = trimmed;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export function configFile() { return CONFIG_FILE; }
