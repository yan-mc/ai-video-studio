/**
 * 配置读取约定 —— 消除「配置分裂脑」。
 *
 * ============================================================================
 * 这个文件要解决的问题（历史 P1，已造成用户可见的数据分裂）
 * ============================================================================
 *
 * 改造前，服务工厂同时收到两种东西：
 *
 *   createXService({ cfg, getCfg })      // cfg = 启动那一刻的快照
 *                                        // getCfg = 每次现取
 *
 * 于是同一个进程里有**两套配置**：
 *
 *   · 项目 / 任务 / 素材索引走 `loadConfig()`（新目录）
 *   · 素材库 / 剪辑 / 剧本工坊的某些路径走了闭包里的 `cfg`（旧目录）
 *
 * `POST /config` 改 `dataDir` 之后，用户看到的是「项目还在、内容空了」——
 * 一半数据在新目录、另一半还在旧目录。
 *
 * ============================================================================
 * 现在的规则（只有一条）
 * ============================================================================
 *
 * **服务只允许持有 `getCfg`，不允许持有 `cfg` 快照。**
 *
 *   export function createFooService({ getCfg = loadConfig }) {
 *     const C = configReader(getCfg);    // ← 每次现取
 *     ...
 *     path.join(C().dataDir, 'foo')      // ← 永远用 C()
 *   }
 *
 * 这样「用旧配置」在结构上不可能。`getCfg` 缺失时才退回 `loadConfig`，
 * 且**没有 cfg 形参可以让调用方传快照**——旧写法会被测试抓出来。
 *
 * ============================================================================
 * 测试怎么守这条规则
 * ============================================================================
 *
 * `tools/smoke-api.mjs` 的「配置分裂脑」断言扫描 `host/services/` 下所有 .js
 * 与 `host/bridge/` 下所有 .js，检查是否还有 `cfg.dataDir` 这种**非调用形式**的读取
 * （`C().dataDir` / `config().dataDir` / `loadConfig().dataDir` / `getCfg().dataDir` 都算合规）。
 */
import path from 'node:path';
import { loadConfig, onConfigChange } from './config.js';

/**
 * 把「读配置」包成一个零参函数。
 *
 * 存在的意义是统一写法：服务里写 `const C = configReader(getCfg)`，
 * 之后一律 `C()`。扫描器据此认定「这是合规的现取」。
 *
 * @param {(() => object) | undefined} getCfg
 * @returns {() => object}
 */
export function configReader(getCfg) {
  const read = typeof getCfg === 'function' ? getCfg : loadConfig;
  return function C() {
    return read();
  };
}

/**
 * 路径快捷方式：从「现取配置」得到 dataDir 下的子路径。
 *
 * 用法：
 *   const dir = dirResolver(C);
 *   dir('outputs')                 // <dataDir>/outputs
 *   dir('previz', 'blender')       // <dataDir>/previz/blender
 *
 * @param {() => object} C 配置读取函数（通常是 configReader 的返回值）
 * @returns {(...segments: string[]) => string}
 */
export function dirResolver(C) {
  return function dir(...segments) {
    return path.join(String(C().dataDir || ''), ...segments.map(String));
  };
}

/**
 * 注册「配置变了要重建什么」（服务层版）。
 *
 * `config.js` 的 `wireConfigInvalidation()` 负责模块级缓存（ComfyUI 探活、
 * 工作流目录、模型存储、角色卡）；这里负责**服务实例内部**的派生状态。
 *
 * @param {Array<{name: string, reset: () => void}>} hooks
 * @returns {() => void} 取消订阅
 */
export function wireServiceInvalidation(hooks) {
  return onConfigChange(() => {
    for (const h of hooks) {
      try { h.reset(); } catch { /* 单个失败不影响其它 */ }
    }
  });
}

/**
 * 断言：服务文件里不能用**闭包捕获的** `cfg` 快照读路径。
 *
 * 由测试调用（不在热路径上）。
 *
 * ============================================================================
 * 什么算违规，什么不算
 * ============================================================================
 *
 * ❌ 违规：工厂闭包捕获了启动那一刻的快照
 *        `export function createX({ cfg }) { ... path.join(cfg.dataDir, ...) }`
 *    → 改 dataDir 之后这里永远用旧目录（配置分裂脑）。
 *
 * ✅ 合规 1：现取
 *        `path.join(C().dataDir, ...)`
 *
 * ✅ 合规 2：**函数默认参数**每调用现取
 *        `export function renderControl({ cfg = loadConfig() }) { path.join(cfg.dataDir, ...) }`
 *    这是"可选注入"模式 —— 不传就是每次现取，传了就是调用方负责。
 *    blender-service.js / character-vault.js 用的是这种写法，语义正确。
 *
 * 判据：如果一个函数签名行里出现 `cfg = loadConfig()`，那么该函数体内
 * 对 `cfg.xxx` 的读取都属于合规 2。用简单的括号配平找出函数体范围。
 *
 * @param {string} source 服务源码
 * @param {string} file   用于错误信息
 * @returns {string[]} 违规行（空数组 = 合规）
 */
export function findConfigSnapshotReads(source, file = '<unknown>') {
  const lines = String(source).split(/\r?\n/);
  const violations = [];
  const liveRead = /(\bC\(\)|\bconfig\(\)|\bloadConfig\(\)|\bgetCfg\(\))/;

  /**
   * 收集「函数签名里 cfg = loadConfig()」的函数体行号区间。
   * 用花括号配平：从签名行开始，遇到第一个 `{` 起算，深度归零时结束。
   */
  const safeRanges = [];
  lines.forEach((line, i) => {
    /**
     * 两种「函数级 cfg」都算合规：
     *   · `cfg = loadConfig()`      —— 默认参数，每调用现取
     *   · `function f(cfg, ...)`    —— 显式传参的纯函数，由调用方负责
     * 只排除「工厂闭包捕获」这一种。工厂的特征是签名里有解构：
     *   `export function createX({ cfg }) {` 或 `createX({ cfg, getCfg })`
     */
    const isDefaulted = /cfg\s*=\s*loadConfig\s*\(\s*\)/.test(line);
    const t0 = line.trim();
    const isExplicitParam =
      // `function f(cfg, ...)` —— 位置参数
      /^(export\s+)?(async\s+)?function\s+\w+\s*\(\s*cfg\b/.test(t0)
      // `function f(a, cfg, ...)` —— cfg 在位置参数中间（如 resolveMediaRefs(ctx, cfg, ...)）
      || /^(export\s+)?(async\s+)?function\s+\w+\s*\([^)]*\bcfg\s*[,)]/.test(t0)
      // `const f = (cfg) =>` / `const f = async ({ cfg }) =>`
      || /^(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?\(\s*cfg\b/.test(t0)
      || /^(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?\(\s*\{[^}]*\bcfg\b/.test(t0)
      // `export async function runX({\n  cfg,\n  ...` —— 解构式参数（多行签名）
      || /^(export\s+)?(async\s+)?function\s+\w+\s*\(\s*\{/.test(t0);
    const isFactoryClosure = /create\w+\s*\(\s*\{[^}]*\bcfg\b(?!\s*=)/.test(line) && !/\bcfg\s*=\s*loadConfig/.test(line);
    if (isFactoryClosure) return;          // 工厂闭包：不登记为安全区（由下面的检查判违规）
    if (!isDefaulted && !isExplicitParam) return;
    // 找到函数体的起始大括号
    let start = i;
    let depth = 0;
    let opened = false;
    for (let j = i; j < lines.length; j += 1) {
      const l = lines[j];
      // 去掉字符串/注释里的花括号（近似处理，够用）
      const code = l.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``');
      for (const ch of code) {
        if (ch === '{') { depth += 1; opened = true; } else if (ch === '}') depth -= 1;
      }
      if (opened && depth <= 0) {
        safeRanges.push([start, j]);
        break;
      }
    }
  });

  const inSafeRange = (idx) => safeRanges.some(([a, b]) => idx >= a && idx <= b);

  /** 判断某一行是否处于块注释（/* ... *\/）内部 */
  const inBlockComment = (() => {
    const flags = new Array(lines.length).fill(false);
    let open = false;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // 纯注释行
      if (open) flags[i] = true;
      if (!open && /^\*/.test(trimmed)) flags[i] = true;
      if (!open && /^\/\*/.test(trimmed) && !/\*\//.test(trimmed)) open = true;
      if (open && /\*\//.test(line)) open = false;
    });
    return flags;
  })();

  lines.forEach((line, i) => {
    // 跳过注释行 —— 文档里当然会提到 cfg.xxx，那不是代码
    if (inBlockComment[i]) return;
    const code = line.replace(/\/\/.*$/, '');
    if (/^\s*\*/.test(code)) return;
    if (!/\bcfg\s*\.\s*(dataDir|workflowDir|comfyUrl|comfyInputDir|ffmpegDir)\b/.test(code)) return;
    if (liveRead.test(code)) return;                       // 合规 1
    if (/create\w+Service\s*\(\s*\{/.test(code)) return;    // 工厂签名本身
    if (inSafeRange(i)) return;                            // 合规 2
    violations.push(`${file}:${i + 1}: ${line.trim()}`);
  });
  return violations;
}