/**
 * 剩余功能域服务 —— 一次补齐参考实现里剩下的中小域。
 *
 * 覆盖：
 *  - `promptTemplate`（21 键）提示词模板管理
 *  - `wardrobe`（68 键）服化道素材库
 *  - `storyboardImport`（42 键）分镜目录导入 / H3 提示词包导入
 *  - `resourceManager`（23 键）孤儿文件清理
 *  - `motionShot`（24 键）动态提示词条
 *  - `shotDetail`（15 键）镜头详情装配
 *  - `logViewer`（3 键）运行日志
 *  - `batchProgress`（16 键）批量进度
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { configReader } from '../config-reader.js';
import { updateJson, readJson as readJsonCore } from '../store/json-store.js';

/* ------------------------------------------------------- 提示词模板 */

/**
 * 内置提示词模板 —— **从 skills/templates/templates.json 读**。
 *
 * ============================================================================
 * 为什么搬出代码
 * ============================================================================
 *
 * 以前 20 条模板硬编码在本文件里，用户想改一条或加一条必须改代码 + 重新构建。
 * 模板是**数据**不是逻辑，所以搬到 `skills/templates/templates.json`：
 *   · 用户直接编辑 JSON 即可，改完重启 DSH 生效
 *   · 该文件随插件分发（package.json 的 files 里含 skills/**）
 *   · 内置的那份作为**默认值**，用户自定义仍覆盖在 `<dataDir>/extras/prompt-templates.json`
 *
 * ============================================================================
 * 兜底
 * ============================================================================
 *
 * 文件缺失/损坏时回退到空数组（不是崩溃），并在 console 里 warn 一次 ——
 * 模板不是关键路径，不该因为它把整个工具箱弄挂。
 */
const TEMPLATES_FILE = (() => {
  try {
    return path.resolve(import.meta.dirname, '..', '..', 'skills', 'templates', 'templates.json');
  } catch {
    return '';
  }
})();

function loadBuiltinTemplates() {
  try {
    if (!TEMPLATES_FILE || !fs.existsSync(TEMPLATES_FILE)) {
      console.warn('[jiuzhang] 未找到 skills/templates/templates.json，内置模板为空');
      return [];
    }
    const j = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
    const list = Array.isArray(j) ? j : (Array.isArray(j?.templates) ? j.templates : []);
    return list
      .filter((t) => t && t.id && t.content)
      .map((t) => ({
        id: String(t.id),
        name: String(t.name || t.id),
        category: String(t.category || '文字'),
        content: String(t.content),
        ...(t.note ? { note: String(t.note) } : {}),
      }));
  } catch (e) {
    console.warn(`[jiuzhang] 读取 templates.json 失败：${String(e?.message || e)}`);
    return [];
  }
}

/** 内置系统模板（从数据文件加载，见上方说明） */
export const SYSTEM_PROMPT_TEMPLATES = Object.freeze(loadBuiltinTemplates());

/* ------------------------------------------------------- 服化道 */

/** 服化道 4 类（参考实现 wardrobe：服装/饰品/武器/道具） */
export const WARDROBE_KINDS = Object.freeze([
  { id: 'costume', name: '服装', desc: '衣服、鞋帽、制服' },
  { id: 'accessory', name: '饰品', desc: '首饰、发饰、眼镜、包' },
  { id: 'weapon', name: '武器', desc: '刀剑、枪械、法杖' },
  { id: 'prop', name: '道具', desc: '手持物、陈设、机关' },
]);

/* ------------------------------------------------------- 分镜导入 */

/**
 * 可识别的产物类型（参考实现 storyboardImport）。
 *
 * 命名与 `kind` 都保持**后端中立**：导入能力认的是"文件长什么样"，
 * 不是"哪个后端产的"。原本这里的 id/name 挂着一个已删除的云端后端名字，
 * 会让用户以为导入只支持那一家；现在统一叫 `document`（分镜/镜头表/提示词）。
 */
export const IMPORT_SOURCES = Object.freeze([
  { id: 'storyboard', name: '分镜表', pattern: /storyboard.*\.(json|md)$/i, kind: 'document' },
  { id: 'shotlist', name: '镜头表', pattern: /shot.*list.*\.(json|csv)$/i, kind: 'document' },
  { id: 'prompt-text', name: '提示词文本', pattern: /prompt.*\.txt$/i, kind: 'document' },
  { id: 'h3-prompt-pack', name: 'H3 提示词包', pattern: /h3.*prompt.*\.(json|txt|md)$/i, kind: 'h3' },
  { id: 'h3-segments', name: 'H3 分段', pattern: /segment.*\.(json|md)$/i, kind: 'h3' },
  { id: 'h3-assets', name: 'H3 资产表', pattern: /asset.*\.(json|csv)$/i, kind: 'h3' },
  { id: 'h3-film', name: 'H3 成片清单', pattern: /film.*\.(json|md)$/i, kind: 'h3' },
  { id: 'h3-srt', name: 'H3 字幕', pattern: /\.srt$/i, kind: 'h3' },
]);

/* ------------------------------------------------------- 服务 */

export function createExtrasService({ getCfg = loadConfig } = {}) {
  const C = configReader(getCfg);
  function file(name) {
    const d = path.join(C().dataDir, 'extras');
    fs.mkdirSync(d, { recursive: true });
    return path.join(d, name);
  }
  /**
   * 读坏过的文件清单 —— 供 `warnings()` 暴露给前端。
   *
   * 为什么需要：静默 fallback 是最糟的失败方式（用户以为数据没了，
   * 或者以为本来就没数据）。至少让面板上出现一行红字。
   */
  const corruptWarnings = [];

  /**
   * 读 JSON —— 统一走 `store/json-store.js`，不再自己写一份。
   *
   * ⚠️ 历史说明：这里原来有一个**本地实现**（readJson + writeJson 两套），
   *    与 json-store 的语义有微妙差异：
   *      · 本地版本损坏时对"读路径"降级为 fallback 并记 warnings；
   *      · json-store 一律抛 CORRUPT_JSON 并保留 .corrupt。
   *    两条路径并存 = 同一份文件被两种策略处理，最容易出现
   *    "面板能打开但保存时报错"这种自相矛盾的表现。
   *
   *    现在统一：**读一律走 json-store.readJson**（损坏就抛），
   *    需要"降级 + 告警"的展示型调用由本模块自己 try/catch 一次并记 warnings，
   *    把策略收敛到调用点，而不是藏在一个模块私有的第二份实现里。
   */
  const readJson = (f, fallback, opts = {}) => {
    try {
      return readJsonCore(f, fallback);
    } catch (e) {
      if (opts.soft) {
        corruptWarnings.push(`CORRUPT_JSON: ${path.basename(f)} 解析失败（已备份为 .corrupt）`);
        return fallback;
      }
      throw e;
    }
  };

  /**
   * 读-改-写统一走 `updateJson`（同一文件的串行队列）。
   *
   * ⚠️ 不能写成 `readJson() → 改 → writeJson()`：`writeJson` 是**同步裸写**，
   *    完全绕过串行队列，两个并发的 upsert 会互相覆盖（经典 last-write-wins）。
   *    这里的所有集合都是"先读全量再写回全量"，所以必须在 mutator 内完成。
   */
  const mutateList = (f, mutator) => updateJson(f, [], (arr) => {
    const list = Array.isArray(arr) ? arr.slice() : [];
    return mutator(list);
  });

  /* ---------------- 提示词模板 ---------------- */
  const tplFile = () => file('prompt-templates.json');

  function listTemplates() {
    const custom = readJson(tplFile(), [], { soft: true });
    return [...SYSTEM_PROMPT_TEMPLATES, ...custom];
  }
  async function upsertTemplate(t) {
    const next = {
      id: t.id || `tpl-${Date.now().toString(36)}`,
      name: String(t.name || '新模板'),
      category: String(t.category || '文字'),
      content: String(t.content || ''),
      custom: true,
      updatedAt: Date.now(),
    };
    await mutateList(tplFile(), (list) => {
      const at = list.findIndex((x) => x.id === next.id);
      if (at >= 0) list[at] = next; else list.unshift(next);
      return list;
    });
    return next;
  }
  async function deleteTemplate(id) {
    await mutateList(tplFile(), (list) => list.filter((x) => x.id !== id));
    return { removed: id };
  }

  /* ---------------- 服化道 ---------------- */
  const wardFile = () => file('wardrobe.json');

  /* ---------------- 服化道（wardrobe） ---------------- */
  /**
   * 服化道 = 服装 / 饰品 / 武器 / 道具的**图 + 文**素材库。
   *
   * ⚠️ 历史状态：这块以前是**纯陈列柜** —— 只有 CRUD，全仓没有任何
   *    提示词 / 参考图 / 生成链路读取它。界面上摆着「服化道」分区，
   *    用户合理地以为"我在这里录的衣服，做视频时会用上"，实际完全不影响出图。
   *    `imageRel` 字段能存图但 UI 没有选图入口，所以它恒为 null。
   *
   * 现在它真的参与生成：
   *    · UI 可以给每条挂一张参考图（imageRel）
   *    · 渲染页的「服化道」多选把选中条目的
   *        imageRel → 参考图（走 manualImages 通道）
   *        name + desc → 一句正向描述（拼进画面概要）
   *    后端不需要新路由 —— `buildRenderPlan.manualImages` 与
   *    `shot.refs.images` 本来就能吃任意 rel。
   */

  /**
   * 把选中的服化道条目转成"参考图 + 提示词片段"。
   *
   * 这是**唯一**的转换点：前端只传 id 列表，转换在服务端做，
   * 保证渲染页 / Agent 工具 / 将来的入口拿到同一份结果。
   *
   * @param {string[]} ids
   * @returns {{ images: string[], notes: string[], items: object[] }}
   */
  function wardrobeToGeneration(ids) {
    const wanted = new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean));
    if (!wanted.size) return { images: [], notes: [], items: [] };
    const all = readJson(wardFile(), [], { soft: true });
    const picked = all.filter((w) => wanted.has(String(w.id)));
    const images = [];
    const notes = [];
    for (const w of picked) {
      if (w.imageRel) images.push(String(w.imageRel));
      const bits = [w.name, w.desc].filter(Boolean).join('：');
      if (bits) notes.push(bits);
    }
    return { images, notes, items: picked };
  }

  function listWardrobe(kind) {
    const all = readJson(wardFile(), [], { soft: true });
    return kind ? all.filter((w) => w.kind === kind) : all;
  }

  async function upsertWardrobe(item) {
    const next = {
      ...item,
      id: item.id || `wd-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      kind: String(item.kind || 'costume'),
      name: String(item.name || '未命名'),
      desc: String(item.desc || ''),
      imageRel: item.imageRel ?? null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      updatedAt: Date.now(),
      createdAt: item.createdAt ?? Date.now(),
    };
    await mutateList(wardFile(), (list) => {
      const at = list.findIndex((x) => x.id === next.id);
      if (at >= 0) list[at] = next; else list.unshift(next);
      return list;
    });
    return next;
  }
  async function deleteWardrobe(id) {
    await mutateList(wardFile(), (list) => list.filter((x) => x.id !== id));
    return { removed: id };
  }

  /* ---------------- 分镜目录导入 ---------------- */
  /**
   * 扫描目录，识别可导入的产物类型。
   *
   * ⚠️ 这是**唯一**允许访问 dataDir 之外路径的接口（用户要导入外部
   *    分镜目录），所以必须自己把边界说清楚：
   *      - 只扫一层（不递归），只认 IMPORT_SOURCES 里的模式
   *      - 拒绝非常规文件，结果里不返回文件内容
   *    `previewImportFile` 更进一步：只回**已知类型**文件的前 N 个字符。
   *
   * @param {string} dir 绝对路径
   */
  function scanImportDir(dir) {
    const abs = String(dir || '').trim();
    if (!abs) throw new Error('DIR_REQUIRED');
    if (!path.isAbsolute(abs)) throw new Error('DIR_MUST_BE_ABSOLUTE');
    if (!fs.existsSync(abs)) throw new Error('DIR_NOT_FOUND');
    if (!fs.statSync(abs).isDirectory()) throw new Error('NOT_A_DIRECTORY');

    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const full = path.join(abs, e.name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      const matched = IMPORT_SOURCES.filter((s) => s.pattern.test(e.name));
      files.push({
        name: e.name,
        path: full,
        bytes: st.size,
        matched: matched.map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
        kind: matched[0]?.kind ?? null,
      });
    }
    const known = files.filter((f) => f.kind);
    const unknown = files.filter((f) => !f.kind);
    return {
      dir: abs,
      total: files.length,
      known: known.length,
      unknown: unknown.length,
      files: known,
      skipped: unknown.map((f) => f.name),
    };
  }

  /**
   * 读取一个导入文件的预览（前 N 字符）。
   *
   * 安全边界：只允许预览 **scanImportDir 认得的分镜类文件**
   * （`IMPORT_SOURCES` 的模式 + 文本扩展名）。之前无任何限制，
   * 等于给本机 HTTP 开了一个"任意文件读前 2000 字符"的口子。
   */
  function previewImportFile(filePath, limit = 2000) {
    const abs = String(filePath || '').trim();
    if (!abs) throw new Error('FILE_REQUIRED');
    if (!path.isAbsolute(abs)) throw new Error('FILE_MUST_BE_ABSOLUTE');
    if (!fs.existsSync(abs)) throw new Error('FILE_NOT_FOUND');
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new Error('NOT_A_FILE');

    const name = path.basename(abs);
    const recognized = IMPORT_SOURCES.some((s) => s.pattern.test(name));
    const textLike = /\.(json|md|markdown|txt|csv|srt)$/i.test(name);
    if (!recognized || !textLike) {
      throw new Error(`UNSUPPORTED_IMPORT_FILE: ${name}（只允许预览分镜/提示词/字幕类文本文件）`);
    }
    // 大文件只读头部，避免把整个视频/模型读进内存
    const maxBytes = Math.max(1, Math.min(16 * 1024 * 1024, Number(limit) * 8));
    const fd = fs.openSync(abs, 'r');
    try {
      const buf = Buffer.alloc(Math.min(st.size, maxBytes));
      fs.readSync(fd, buf, 0, buf.length, 0);
      const raw = buf.toString('utf8');
      return {
        name,
        bytes: st.size,
        truncated: raw.length > limit || st.size > maxBytes,
        preview: raw.slice(0, limit),
      };
    } finally {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }

  /* ---------------- 资源清理（孤儿文件） ---------------- */
  /**
   * 找出 assets/ 目录里没有被任何资产记录引用的文件。
   */
  /**
   * 找出 `<dataDir>/assets` 里没有被 assets-index 引用的文件。
   *
   * ⚠️ 两个历史缺陷：
   *  ① 只 readdirSync 一层，`assets/3d/xxx.fbx` 这类子目录**永远不参与**统计；
   *  ② 反过来，用户手工放进 assets/ 的文件（不在 index 里）会被判成孤儿，
   *     clean 一次就删 —— 而这恰恰是 3D 预演资产最常见的入口。
   *
   * 现在：递归扫描；`assets/3d`、`assets/models` 是 Blender 直接扫盘的目录，
   * 一律不参与孤儿判定，避免误删。
   */
  function findOrphans(assetList) {
    const assetsDir = path.join(C().dataDir, 'assets');
    if (!fs.existsSync(assetsDir)) return { orphans: [], total: 0, referenced: 0 };

    const referenced = new Set(
      (assetList ?? []).map((a) => String(a.rel ?? '').replace(/^assets\//, '')).filter(Boolean),
    );

    const files = [];
    const walk = (dir, depth) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (depth < 3) walk(full, depth + 1);
          continue;
        }
        if (ent.isFile()) files.push(full);
      }
    };
    walk(assetsDir, 0);

    const PROTECTED_DIRS = new Set(['3d', 'models']);
    const orphans = [];
    let referencedCount = 0;
    let protectedCount = 0;
    let unreadable = 0;
    for (const full of files) {
      const relFromAssets = path.relative(assetsDir, full);
      const top = relFromAssets.split(path.sep)[0];
      /**
       * `assets/3d/**` 与 `assets/models/**` 是 Blender 直接扫盘的目录，
       * 里面的文件**不一定**登记在 assets-index 里。为了不误删，它们一律
       * 跳过清理 —— 但**不能算进"被引用"**：以前把两者混在同一个计数器里，
       * 于是面板上「N 个被引用」里可能绝大多数根本没被任何地方引用，
       * 用户无法理解为什么这些文件永远不会被清理。
       */
      if (PROTECTED_DIRS.has(top)) { protectedCount += 1; continue; }
      const norm = relFromAssets.replace(/\\/g, '/');
      if (referenced.has(norm) || referenced.has(relFromAssets)) {
        referencedCount += 1;
        continue;
      }
      let st;
      try { st = fs.statSync(full); } catch { unreadable += 1; continue; }
      orphans.push({ name: norm, path: full, bytes: st.size, mtime: st.mtimeMs });
    }
    return {
      total: files.length,
      referenced: referencedCount,
      // 受保护目录下的文件数（不参与清理，也不算"被引用"）
      protected: protectedCount,
      // stat 失败而既未计入 referenced 也未计入 orphan 的条目数，
      // 用来让「referenced + protected + orphan + unreadable = total」对得上
      unreadable,
      orphanCount: orphans.length,
      orphanBytes: orphans.reduce((s, o) => s + o.bytes, 0),
      orphans,
    };
  }

  /** 删除孤儿（需显式确认） */
  function cleanOrphans(assetList, { confirm = false } = {}) {
    if (!confirm) throw new Error('CONFIRM_REQUIRED');
    const r = findOrphans(assetList);
    let removed = 0;
    let bytes = 0;
    for (const o of r.orphans) {
      try { fs.unlinkSync(o.path); removed += 1; bytes += o.bytes; } catch { /* ignore */ }
    }
    return { removed, bytes, remaining: r.orphans.length - removed };
  }

  /* ---------------- 动态提示词条（motionShot） ---------------- */
  const motionFile = () => file('motion-shots.json');

  function listMotionShots(projectId) {
    const all = readJson(motionFile(), [], { soft: true });
    return projectId ? all.filter((m) => m.projectId === projectId) : all;
  }
  async function upsertMotionShot(item) {
    const next = {
      ...item,
      id: item.id || `ms-${Date.now().toString(36)}`,
      projectId: item.projectId ?? null,
      name: String(item.name || '动态条'),
      prompt: String(item.prompt || ''),
      images: Array.isArray(item.images) ? item.images : [],
      results: Array.isArray(item.results) ? item.results : [],
      updatedAt: Date.now(),
      createdAt: item.createdAt ?? Date.now(),
    };
    await mutateList(motionFile(), (list) => {
      const at = list.findIndex((x) => x.id === next.id);
      if (at >= 0) list[at] = next; else list.unshift(next);
      return list;
    });
    return next;
  }
  async function deleteMotionShot(id) {
    await mutateList(motionFile(), (list) => list.filter((x) => x.id !== id));
    return { removed: id };
  }

  /* ---------------- 运行日志 ---------------- */
  const LOG_MAX = 500;

  /**
   * 追加一条运行日志。
   *
   * ⚠️ 历史缺陷：这个函数是"读全量 500 条 → unshift → 写全量"，
   *    两次并发写必然丢日志（A 读完 B 读完，A 写 B 写，B 覆盖 A），
   *    而且永远返回 `{ok:true}` —— 用户看不到任何异常。
   *    画布每操作一次都会写日志，所以并发是常态不是边角。
   *
   * 现在改用 json-store 的 updateJson：每文件一条 Promise 队列串行读-改-写。
   */
  async function appendLog(entry) {
    const f = file('logs.json');
    await updateJson(f, [], (cur) => {
      const all = Array.isArray(cur) ? cur : [];
      all.unshift({ ...entry, at: Date.now() });
      return all.slice(0, LOG_MAX);
    });
    return { ok: true };
  }
  function listLogs(limit = 100) {
    return readJson(file('logs.json'), [], { soft: true }).slice(0, Math.max(1, Math.min(LOG_MAX, limit)));
  }

  /* ---------------- 批量进度 ---------------- */
  function batchProgress(jobs) {
    const list = Array.isArray(jobs) ? jobs : [];
    const total = list.length;
    const done = list.filter((j) => j.status === 'completed').length;
    const failed = list.filter((j) => j.status === 'failed').length;
    const running = list.filter((j) => j.status === 'running').length;
    const queued = list.filter((j) => j.status === 'queued').length;
    return {
      total, done, failed, running, queued,
      pending: total - done - failed,
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  }

  return {
    // 模板
    listTemplates, upsertTemplate, deleteTemplate,
    // 服化道
    listWardrobe, upsertWardrobe, deleteWardrobe,
    /** 服化道 → 参考图 + 提示词片段（唯一转换点） */
    wardrobeToGeneration,
    // 导入
    scanImportDir, previewImportFile,
    // 清理
    findOrphans, cleanOrphans,
    // 动态条
    listMotionShots, upsertMotionShot, deleteMotionShot,
    // 日志
    appendLog, listLogs,
    // 批量
    batchProgress,
    /**
     * 数据文件损坏报告。
     *
     * 读路径遇到坏 JSON 会降级为空列表（否则整个工具箱面板打不开），
     * 但必须把这个事实暴露到界面上 —— 静默空列表是最糟的失败方式。
     */
    warnings: () => [...new Set(corruptWarnings)],
  };
}

export { SYSTEM_PROMPT_TEMPLATES as BUILTIN_TEMPLATES, WARDROBE_KINDS as CLOTHING_KINDS };
