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
import { isLoopbackHostname } from './security.js';

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
  // ComfyUI 工作流模板目录。空 = 自动推导为 <插件根>/data/workflows
  // （模板随插件分发，**不跟随 dataDir**；见 services/workflow-paths.js）
  workflowDir: '',
  /**
   * ComfyUI 地址。
   *
   * ⚠️ 真正决定连哪个端口的是 `ai-runtime/.comfy-port`（由 `start-h3.ps1` 启动后写入），
   *    `resolveComfyUrl()` 的优先级是：环境变量 > 端口文件 > 本配置 > 常见端口探测。
   *    所以这里只是**兜底默认值**，必须与 `start-h3.ps1` 的默认端口一致（8488），
   *    否则用户会看到"配置写 8188、实际跑 8488"这种改了没反应的僵尸设置。
   */
  comfyUrl: 'http://127.0.0.1:8488',
  /**
   * 单任务等待超时（分钟）。默认 120 = 2 小时。
   *
   * 为什么不再用「固定轮询次数」：早先是 600 次 × 3 秒 = 硬上限 30 分钟，
   * 不加速方案（原模型 50 步）跑 5 秒片很容易超过，于是被 COMFY_TIMEOUT 打断 ——
   * 而那时 ComfyUI **还在继续跑**，GPU 白烧、产物也拿不到。
   *
   * 现在按截止时间等，并用这个值控制上限。环境变量
   * `JZ_COMFY_TIMEOUT_MIN` 优先级更高（临时调大不用改配置）。
   */
  comfyTimeoutMin: 120,
  comfyInputDir: '',
  // 南风 V15 是默认视频后端（支持二采/续写）；h3-local 为旧的模板替换路径，保留作回退
  defaultBackend: 'h3-nanfeng',
  defaultProfile: 'P12-draft',
  /**
   * H3 加速方案（蒸馏 LoRA）。
   *
   * 可选值见 services/accel-plan.js 的 ACCEL_PLANS：
   *   dmad8     DMAD 8 步学生（默认，音画质量优先）
   *   dmad4     DMAD 4 步学生（最快）
   *   none      不加速，50 步原模型
   *
   * 为什么默认 dmad8：实测（docs/probes/dmad-2026-11-16/）在复杂提示词下
   * DMAD 对角色形态、动作连续性、音频起伏明显更准。
   */
  accelPlan: 'dmad8',
  maxConcurrentLocal: 1,
  ffmpegDir: path.resolve(import.meta.dirname, '..', '..', 'tools', 'ffmpeg'),
  theme: 'inknight',            // 墨夜
  accent: 'cinnabar',           // 朱砂红
  locale: 'zh',
  // 图像生成（H3-Image）
  imageModelRoot: '',               // 空 = 自动推导为 comfyInputDir 的兄弟目录 models
  imageSizeId: 'auto',              // auto = 2048x2048
  imageSteps: 6,                    // 采样步数（蒸馏 checkpoint 默认 6；夹在 4–12）
  // 单张出图面积上限（MP）。2048² = 4.19 MP 是 12GB 卡实测能跑的最大档，
  // 4K 档（16.8 MP）需要 48GB 以上。调大之前先确认显存，否则必 OOM。
  imageMaxMP: 4.3,
  // 模型文件名覆盖（key 见 generator.js 的 MODEL_DEFAULTS）。
  // 空 = 自动从 ComfyUI 的实际列表里挑（见 resolveModelNames），
  // 所以**不需要**为了换个量化版本去改代码。
  modelNames: {},
});

/**
 * 已废弃的配置键 —— 保留只为**兼容存量 config.json**，不再对外声明。
 *
 * `assetRoot`：曾经想用"外部资产包目录"，但 asset-service 实际只读写
 *   `<dataDir>/assets`，全仓库无人读取这个键，默认值还指向不存在的
 *   `<workspace>/工作室/资产包/`。现已移除；存量配置里的该字段会在
 *   下次 saveConfig 时自然丢弃（sanitizeConfigPatch 只取白名单键）。
 * `imageBackend`：同上，路由始终走 'h3-image'，没有第二实现可选。
 * `seedanceEndpoint` / `seedanceModel` / `seedanceApiKey` / `seedanceMock`：
 *   Seedance（火山方舟）云端后端已整体删除 —— 它从来没有过 API key，
 *   是一条永远走占位产物的死链路。这四个键列入此处有**两个**目的：
 *     1) 存量 config.json 里残留的值不会被 `pick(WRITABLE_CONFIG_KEYS)`
 *        重新捞回运行时配置（否则老用户升级后 `cfg.seedanceApiKey` 还在，
 *        肉眼看不出后端已经没了）；
 *     2) 声明式记录"这些键曾经存在、为什么消失"，避免以后又被加回来。
 *   注意它们**不在** `WRITABLE_CONFIG_KEYS` 内，因此不会再被写盘。
 */
export const DEPRECATED_CONFIG_KEYS = Object.freeze([
  'assetRoot', 'imageBackend',
  'seedanceEndpoint', 'seedanceModel', 'seedanceApiKey', 'seedanceMock',
]);

/** 允许通过 API 修改的字段（白名单）。可执行路径类字段刻意不在其中。 */
export const WRITABLE_CONFIG_KEYS = Object.freeze([
  'dataDir', 'workflowDir', 'comfyUrl', 'comfyInputDir',
  // 任务等待超时（分钟）—— 长任务（不加速跑 50 步）需要调大
  'comfyTimeoutMin',
  'defaultBackend', 'defaultProfile', 'maxConcurrentLocal', 'accelPlan',
  'theme', 'accent', 'locale',
  // 图像生成（H3-Image）
  'imageModelRoot', 'imageSizeId', 'imageSteps', 'imageMaxMP', 'modelNames',
]);

let cache = null;

/**
 * 配置变更订阅者。
 *
 * 为什么需要：`dataDir` / `workflowDir` / `comfyUrl` 变了之后，多个模块的
 * 缓存与单例必须跟着重建（工作流目录、ComfyUI 探活、项目/素材存储句柄）。
 * 以前这些都不刷新，改完配置要么继续用旧路径、要么要等进程重启。
 *
 * 用订阅者模式而不是让 config.js 直接 import 那些模块，是为了避免循环依赖
 * （那些模块本身要 import config.js 拿 loadConfig）。
 */
const listeners = new Set();

/** 注册一个配置变更回调，返回取消订阅函数 */
export function onConfigChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyConfigChange(next) {
  for (const fn of listeners) {
    try { fn(next); } catch { /* 单个订阅者失败不影响其它 */ }
  }
}

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
  cache = loadConfigDefaults(raw);
  return cache;
}

/**
 * 把落盘的（只含白名单键的）对象合并成运行时配置（含 DEFAULTS 与可移植性修正）。
 *
 * ⚠️ `dataDir` 的**可移植性**修正只发生在内存里：
 *
 * `data/config.json` 会被写进实际路径（本机是 `F:\AI视频\dsh-jiuzhang-studio\data`）。
 * 仓库克隆到别的机器、或整个目录被搬走之后，那个绝对路径就指向一个
 * 不存在的盘 —— 启动时 `fs.mkdirSync(c.dataDir, { recursive: true })` 会
 * 试图在别的盘上建目录，或者直接 ENOENT，用户完全看不出原因。
 *
 * 规则：只有当配置里的 dataDir **确实存在**时才采用它；否则回退到
 * `<插件根>/data`。这样"搬家/clone 后开箱即用"，而用户显式指定一个
 * 已存在的自定义目录仍然被尊重。
 *
 * ⚠️ 这个回落**绝不能写回文件**（`saveConfig` 只写白名单键 + 文件里的原始 dataDir），
 *    否则一次无关的 `POST /config {theme}` 就会把用户的自定义目录永久覆盖掉。
 */
function loadConfigDefaults(raw) {
  const merged = { ...DEFAULTS, ...pick(raw, WRITABLE_CONFIG_KEYS) };
  const configuredDir = merged.dataDir;
  if (configuredDir && path.resolve(configuredDir) !== path.resolve(DEFAULT_DATA_DIR)) {
    let ok = false;
    try { ok = fs.existsSync(configuredDir) && fs.statSync(configuredDir).isDirectory(); } catch { ok = false; }
    if (!ok) merged.dataDir = DEFAULT_DATA_DIR;
  }

  /**
   * `comfyUrl` 的 SSRF 校验必须在**读路径**也做一次。
   *
   * 只在 `sanitizeConfigPatch`（写路径）上校验是不够的：手改 data/config.json、
   * 或任何不经过 `POST /config` 的落盘途径，都能把任意 URL 直接送进运行时配置，
   * 而后端会拿它主动发请求（health / vram / submit / upload）。
   * 校验失败时回落到默认值并 warn —— 让"读入的配置一定合法"成为不变量。
   */
  try {
    merged.comfyUrl = validateComfyUrl(merged.comfyUrl) || DEFAULTS.comfyUrl;
  } catch (e) {
    console.warn(`[jiuzhang] config.json 里的 comfyUrl 不合法，已回落到默认值：${e.message}`);
    merged.comfyUrl = DEFAULTS.comfyUrl;
  }

  return merged;
}

/** 仅供测试/重载用 */
export function resetConfigCache() { cache = null; }

export function saveConfig(patch) {
  const current = loadConfig();
  const merged = { ...current, ...sanitizeConfigPatch(patch) };
  /**
   * ⚠️ 只写**白名单键**，不写 `current` 里的推导/回落值。
   *
   * 两个真实事故都来自"全量写盘"：
   *   1) `dataDir` 在 loadConfig 里做「不存在就回落到 <插件根>/data」的**内存**修正，
   *      一旦被全量写盘，用户原来的自定义目录就**永久丢失**（重启也不会回来，
   *      因为文件里已经是回落值）。用户可能只是改了个主题色。
   *   2) `ffmpegDir` / `workflowDir` 等不可写键会出现在 config.json 里，
   *      用户照文件改却不生效（读取时被白名单过滤），形成"改了没反应"的诱饵。
   *
   * 现在文件里出现的键 == 可改的键，`dataDir` 的回落永远只活在内存里。
   */
  const next = {};
  for (const key of WRITABLE_CONFIG_KEYS) {
    if (key in merged) next[key] = merged[key];
  }
  // 保留原始（未被回落）的 dataDir：它不在 patch 里时，必须继续用文件里的原值
  if (!('dataDir' in patch && patch.dataDir !== undefined)) {
    const raw = readJsonSafe(CONFIG_FILE, {});
    const rawDir = typeof raw?.dataDir === 'string' ? raw.dataDir.trim() : '';
    if (rawDir) next.dataDir = rawDir;
    else delete next.dataDir;
  }
  const dir = path.dirname(CONFIG_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = CONFIG_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);        // 原子替换
  cache = { ...loadConfigDefaults(next) };
  notifyConfigChange(cache);
  return cache;
}

/**
 * 需要对外掩码的敏感配置键 —— 目前**为空**。
 *
 * 原本这里只有 `seedanceApiKey`，而 Seedance 后端已整体删除（其配置键见
 * `DEPRECATED_CONFIG_KEYS`）。常量与下面的掩码循环刻意保留：`/config` 的
 * 对外契约里"读回来的密钥一律是 `***`"这一条不能因为暂时没有密钥类配置就
 * 失传，以后再加任何密钥键只需往这里加一项，所有调用点自动生效。
 */
const SENSITIVE_CONFIG_KEYS = Object.freeze([]);

/** 对外输出时掩码敏感字段（当前无敏感键，等价于浅拷贝） */
export function maskConfig(cfg = loadConfig()) {
  const out = { ...cfg };
  for (const key of SENSITIVE_CONFIG_KEYS) {
    if (out[key]) out[key] = '***';
  }
  return out;
}

/**
 * 校验 comfyUrl —— 只允许指向本机的 http(s) 地址。
 *
 * 为什么必须校验：`comfyUrl` 在 WRITABLE_CONFIG_KEYS 内，任何能过
 * guard() 的写请求都能改它。而后端会用这个 URL **主动发请求**
 * （health / vram / submit / cancel / upload）。不校验等于给了一个
 * 完全开放的 SSRF 出口：
 *   · http://169.254.169.254/latest/meta-data/   云元数据
 *   · http://127.0.0.1:<别的端口>/...             内网端口探测
 *   · file:///... 之类非 http 协议（取决于 fetch 实现）
 *
 * 允许的主机：localhost / 127.0.0.0/8 / ::1。
 * ComfyUI 本来就是本机服务，限制到 loopback 不影响任何正常用法；
 * 确实需要远程跑 ComfyUI 的场景，请用环境变量 DSH_COMFY_URL 覆盖
 * （那条路径不经过本函数，属于部署者显式选择）。
 *
 * @returns {string} 规范化后的 URL（去掉尾部斜杠）
 * @throws {string} 不合法时抛出配置错误码
 */
export function validateComfyUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`INVALID_COMFY_URL: ${JSON.stringify(s)} 不是合法 URL`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`INVALID_COMFY_URL: 只支持 http/https，收到 ${u.protocol}`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  // ⚠️ 必须用 security.js 的**严格四段**判定（全仓唯一实现）。
  //    这里曾用 `/^127\./`，于是 `127.0.0.1.evil.com` / `127.evil.com` 都能通过，
  //    后端随后拿这个 URL 主动发请求 → SSRF 出口。
  //    也不接受 `0.0.0.0`（"任意地址"不是本机）。
  if (!isLoopbackHostname(host)) {
    throw new Error(
      `INVALID_COMFY_URL: 只允许本机地址（localhost / 127.x.x.x / ::1），收到 ${host}。`
      + '需要连远程 ComfyUI 请用环境变量 DSH_COMFY_URL 指定。',
    );
  }
  return s.replace(/\/+$/, '');
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
      // SSRF 防护：comfyUrl 必须是本机 http(s) 地址
      if (key === 'comfyUrl') {
        out[key] = validateComfyUrl(trimmed);
        continue;
      }
      out[key] = trimmed;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (key === 'modelNames' && value && typeof value === 'object' && !Array.isArray(value)) {
      // 只收 string 值，避免塞进奇怪结构
      const clean = {};
      for (const [mk, mv] of Object.entries(value)) {
        if (typeof mv === 'string' && mv.trim() && !/[\r\n]/.test(mv)) clean[mk] = mv.trim();
      }
      if (Object.keys(clean).length) out[key] = clean;
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

/**
 * 把"配置变更 → 重建缓存"的订阅集中注册在一处。
 *
 * 由 host/index.js 在启动时调用一次。
 * 为什么不在各模块自己订阅：模块加载顺序不确定，且测试会反复 resetConfigCache，
 * 集中注册更容易保证幂等（重复调用只会多挂几个同样的回调，不影响正确性）。
 */
export async function wireConfigInvalidation() {
  const { resetComfyProbe, resetVramCache } = await import('./services/comfy-client.js');
  const { resetWorkflowCache } = await import('./services/workflow-paths.js');
  const { resetModelStores } = await import('./store/models.js');
  const { resetVaultStore } = await import('./services/character-vault.js');
  return onConfigChange(() => {
    try { resetComfyProbe(); } catch { /* ignore */ }
    try { resetVramCache(); } catch { /* ignore */ }
    try { resetWorkflowCache(); } catch { /* ignore */ }
    try { resetModelStores(); } catch { /* ignore */ }
    try { resetVaultStore(); } catch { /* ignore */ }
  });
}
