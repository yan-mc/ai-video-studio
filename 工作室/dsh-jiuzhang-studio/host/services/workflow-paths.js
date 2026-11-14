/**
 * ComfyUI 工作流模板的定位 —— **单一真源**。
 *
 * 为什么需要这个模块：
 *   `workflows/*.json` 是**插件自带的模板**（随仓库分发、随插件更新），
 *   不属于运行时数据。而 `cfg.dataDir` 是**用户可改**的运行时数据目录。
 *   把模板定位绑在 dataDir 上，用户一改数据目录，生成就报
 *   `WORKFLOW_MISSING: 缺少 data/workflows/h3.json` —— 指向一个插件里明明
 *   存在的文件，用户无从自查。
 *
 *   之前这个定位逻辑散在四处、三套写法：
 *     - host/index.js                 root/data/workflows/          ✅
 *     - host/api/index.js             dirs().root/workflows/        ❌（dirs().root = dataDir）
 *     - host/tools.js                 `${dirs().root}/workflows/`  ❌（字符串拼接）
 *     - host/services/h3-workshop.js  cfg.dataDir/workflows/       ❌
 *   四处不一致本身就是隐患。这里统一。
 *
 * 定位优先级（先精确、后兜底）：
 *   1) 显式配置 `workflowDir`（新增的白名单键，给"模板放别处"的高级用户）
 *   2) 显式环境变量 `DSH_JZ_WORKFLOW_DIR`（部署/测试用）
 *   3) 插件根 `<plugin>/data/workflows`            ← 正常情况走这条
 *   4) `cfg.dataDir/workflows`                     ← 兼容老版本：用户曾把模板复制过去
 *   5) 从模块位置向上找 `data/workflows`（插件被 link 到任意位置也能命中）
 *
 * 注意：**只有 3) 是随仓库分发的正解**；4) 保留是为了不破坏已经手工复制过
 * 模板的存量用户，找到时会给出提示但继续工作。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';

/** 插件根目录：<plugin>/host/services/workflow-paths.js → <plugin> */
const PLUGIN_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** 随插件分发的工作流文件名 */
export const WORKFLOW_FILES = Object.freeze({
  h3: 'h3.json',
  image: 'h3-image.json',
});

/** 目录缓存：避免每次生成都做 5 次 existsSync */
const dirCache = new Map();

function firstExistingDir(candidates) {
  for (const c of candidates) {
    if (!c) continue;
    try { if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c; } catch { /* ignore */ }
  }
  return '';
}

/**
 * 解析工作流模板目录（绝对路径）。找不到也返回首选路径，让上层报错时能指向人话。
 * @param {object} [cfg]
 * @returns {string}
 */
export function resolveWorkflowDir(cfg = loadConfig()) {
  const key = String(cfg?.dataDir ?? '');
  const cached = dirCache.get(key);
  if (cached) return cached;

  const candidates = [];

  // 1) 配置显式指定
  if (cfg?.workflowDir) candidates.push(path.resolve(String(cfg.workflowDir)));

  // 2) 环境变量
  const env = process.env.DSH_JZ_WORKFLOW_DIR;
  if (env) candidates.push(path.resolve(env));

  // 3) 插件根（正常情况）
  candidates.push(path.join(PLUGIN_ROOT, 'data', 'workflows'));

  // 4) 兼容：用户曾把模板复制进数据目录
  if (cfg?.dataDir) candidates.push(path.join(cfg.dataDir, 'workflows'));

  // 5) 兜底：从模块位置向上逐层找 data/workflows
  try {
    let dir = import.meta.dirname;
    for (let i = 0; i < 6; i += 1) {
      candidates.push(path.join(dir, 'data', 'workflows'));
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* ignore */ }

  const hit = firstExistingDir(candidates) || candidates[0] || '';
  dirCache.set(key, hit);
  return hit;
}

/**
 * 解析单个工作流文件的绝对路径。
 * @param {'h3'|'image'} kind
 * @param {object} [cfg]
 */
export function resolveWorkflowFile(kind, cfg = loadConfig()) {
  const name = WORKFLOW_FILES[kind];
  if (!name) throw new Error(`UNKNOWN_WORKFLOW: ${JSON.stringify(kind)}`);
  return path.join(resolveWorkflowDir(cfg), name);
}

/**
 * 读取并解析工作流。找不到返回 null（调用方负责报错）。
 * @param {'h3'|'image'} kind
 */
export function readWorkflow(kind, cfg = loadConfig()) {
  const file = resolveWorkflowFile(kind, cfg);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return null; }
}

/**
 * 带缓存的读取（模板在进程生命周期内不会变）。
 * @param {'h3'|'image'} kind
 */
const jsonCache = new Map();
export function readWorkflowCached(kind, cfg = loadConfig()) {
  const file = resolveWorkflowFile(kind, cfg);
  if (jsonCache.has(file)) return jsonCache.get(file);
  const value = readWorkflow(kind, cfg);
  if (value) jsonCache.set(file, value);      // 只缓存成功的，缺文件下次还能重试
  return value;
}

/** 配置变更后清缓存（workflowDir / dataDir 可能变了） */
export function resetWorkflowCache() {
  dirCache.clear();
  jsonCache.clear();
}

/**
 * 给用户看的诊断信息：缺的是哪个文件、找过哪些目录。
 * @param {'h3'|'image'} kind
 */
export function workflowDiagnostics(kind, cfg = loadConfig()) {
  const dir = resolveWorkflowDir(cfg);
  const file = resolveWorkflowFile(kind, cfg);
  return {
    kind,
    dir,
    file,
    exists: fs.existsSync(file),
    pluginRoot: PLUGIN_ROOT,
    dataDir: cfg?.dataDir ?? '',
    hint: '工作流模板随插件分发，位于 <插件根>/data/workflows/。'
      + '若确实放到了别处，请设置配置项 workflowDir 或环境变量 DSH_JZ_WORKFLOW_DIR。',
  };
}
