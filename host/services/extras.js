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

/* ------------------------------------------------------- 提示词模板 */

/** 20 条内置系统模板（参考实现 tWe 注册表规模） */
export const SYSTEM_PROMPT_TEMPLATES = Object.freeze([
  { id: 'tpl-cinematic-shot', name: '电影感镜头描述', category: '文字', content: '描述一个电影感镜头的画面、光线、构图与情绪。要求：明确景别、主体动作、光线方向、色调倾向。' },
  { id: 'tpl-char-lock', name: '角色外观固化', category: '角色', content: '把角色外观写成可复用的英文提示词：发色、发型、瞳色、服装、配饰、身高、体态。' },
  { id: 'tpl-storyboard-split', name: '分镜拆分', category: '分镜', content: '把一段剧本拆成 N 个可拍摄的镜头，每镜含：景别、动作、台词、运镜。' },
  { id: 'tpl-scene-consistency', name: '场景一致化', category: '场景', content: '为同一场景生成稳定的环境描述，保证多镜之间视觉连续：地点、时间、光线、道具布局。' },
  { id: 'tpl-emotion-map', name: '情绪曲线', category: '剧本', content: '为每一集标注情绪值（-5 到 +5），确保全剧有起伏而非平铺。' },
  { id: 'tpl-dialogue-polish', name: '台词润色', category: '剧本', content: '把台词改得更口语化、更符合角色身份，去掉书面语与解释性台词。' },
  { id: 'tpl-shot-rhythm', name: '镜头节奏', category: '分镜', content: '按 2-3 秒一镜规划节奏，紧张段落缩短、抒情段落拉长。' },
  { id: 'tpl-continuity', name: '连戏检查', category: '质检', content: '检查角色服装、道具位置、光线方向、时间连续性是否跨镜一致。' },
  { id: 'tpl-h3-ref2va', name: 'H3 Ref2VA 提示词', category: 'H3', content: '按六段式生成：CRITICAL STYLE RULE / CRITICAL REFERENCE RULE / subject_definitions / CHARACTER DEFINITION / summary / retention_analysis / SCENE LAYOUT / MOTION DESCRIPTION。' },
  { id: 'tpl-h3-i2va', name: 'H3 I2VA 提示词', category: 'H3', content: '首帧图对齐 0.00 秒，描述从首帧开始向前发展的动态。' },
  { id: 'tpl-h3-fl2va', name: 'H3 FL2VA 首尾帧', category: 'H3', content: '首帧对齐 0.00 秒、尾帧对齐实际时长，重点描述中间演变过程。' },
  { id: 'tpl-h3-style-en', name: 'H3 画风英文', category: 'H3', content: '画风描述必须用英文，其余中文；写明禁止项（NO photorealistic / NO subtitles）。' },
  { id: 'tpl-h3-audio', name: 'H3 音频三字段', category: 'H3', content: 'overall_soundscape（画内音）/ non_diegetic_music（画外配乐）/ 音效（分镜内）三个字段都必须写满。' },
  { id: 'tpl-ecom-front', name: '电商主图', category: '电商', content: '正面平视中景，主品完整呈现，纯净背景，柔和顶光。' },
  { id: 'tpl-ecom-detail', name: '电商细节', category: '电商', content: '微距近景，突出面料纹理、缝线、五金细节。' },
  { id: 'tpl-film-base', name: '影视定妆照', category: '影视', content: '正面半身中景，最干净的一张，用于锁定身份。' },
  { id: 'tpl-film-turnaround', name: '三视图', category: '影视', content: '正/侧/背/45° 四张，统一光位与白底，便于建模参考。' },
  { id: 'tpl-comic-panel', name: '漫画分格描述', category: '漫画', content: '描述一格漫画：画面内容、角色站位、表情、气泡位置与台词。' },
  { id: 'tpl-camera-move', name: '运镜描述', category: '分镜', content: '用一句中文描述运镜：推/拉/摇/移/跟/升降/环绕 + 幅度 + 速度。' },
  { id: 'tpl-safe-frame', name: '安全构图', category: '质检', content: '检查主体是否落在安全框内，避免切头、切手、关键信息出画。' },
]);

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

export function createExtrasService({ cfg, getCfg = loadConfig }) {
  const C = () => (typeof getCfg === 'function' ? getCfg() : cfg);
  function file(name) {
    const d = path.join(C().dataDir, 'extras');
    fs.mkdirSync(d, { recursive: true });
    return path.join(d, name);
  }
  /**
   * 读 JSON —— **损坏时抛错，不静默清空**。
   *
   * ⚠️ 历史缺陷：原来是 `catch { return fallback; }`。一旦文件损坏
   *    （断电 / 杀进程 / 磁盘满 / 手工编辑出错），readJson 返回 `[]`，
   *    紧接着 `upsertTemplate` 把**只含新条目的数组**写回去 ——
   *    用户的自定义模板/服化道**全部消失，且没有任何提示**。
   *
   *    这与 `store/json-store.js` 的处理正好相反：那个模块专门修过
   *    同样的问题（读出错就抛 CORRUPT_JSON 并保留 .corrupt 副本）。
   *    这里对齐它。
   *
   * 文件不存在仍然返回 fallback（这是正常情况，不是损坏）。
   */
  function readJson(f, fallback, opts = {}) {
    if (!fs.existsSync(f)) return fallback;
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { return fallback; }
    if (!text.trim()) return fallback;
    try {
      return JSON.parse(text);
    } catch (e) {
      // 保留坏文件供人工修复
      try { fs.copyFileSync(f, `${f}.corrupt`); } catch { /* ignore */ }
      /**
       * 写路径必须抛（否则覆盖掉用户数据）；
       * 读路径（列表展示）**降级为 fallback**，否则一个坏文件会让整个工具箱
       * 面板打不开 —— 但要把原因记进 warnings 让用户在界面上看到，
       * 不能像以前那样"空列表 + 什么也不说"。
       */
      const msg = `CORRUPT_JSON: ${path.basename(f)} 解析失败（已备份为 .corrupt）`;
      if (opts.soft) {
        corruptWarnings.push(msg);
        return fallback;
      }
      const err = new Error(`${msg}：${e.message}`);
      err.code = 'CORRUPT_JSON';
      throw err;
    }
  }

  /**
   * 读坏过的文件清单 —— 供 `warnings()` 暴露给前端。
   *
   * 为什么需要：静默 fallback 是最糟的失败方式（用户以为数据没了，
   * 或者以为本来就没数据）。至少让面板上出现一行红字。
   */
  const corruptWarnings = [];

  /**
   * 原子写 JSON。
   *
   * Windows 上 rename 覆盖已存在文件可能因杀软扫描/句柄占用抛
   * EPERM/EBUSY/EACCES —— `json-store.js` 有专门的重试，这里补齐，
   * 否则用户在 Windows 上会遇到随机写入失败。
   */
  function writeJson(f, v) {
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(v, null, 2), 'utf8');
    const RETRY = [0, 10, 30, 80, 150];
    for (let i = 0; i < RETRY.length; i += 1) {
      if (RETRY[i]) {
        const until = Date.now() + RETRY[i];
        while (Date.now() < until) { /* 短自旋：这个模块的写入频率极低 */ }
      }
      try {
        fs.renameSync(tmp, f);
        return v;
      } catch (e) {
        const code = String(e?.code || '');
        const retriable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
        if (!retriable || i === RETRY.length - 1) {
          try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
          throw e;
        }
      }
    }
    return v;
  }

  /* ---------------- 提示词模板 ---------------- */
  const tplFile = () => file('prompt-templates.json');

  function listTemplates() {
    const custom = readJson(tplFile(), [], { soft: true });
    return [...SYSTEM_PROMPT_TEMPLATES, ...custom];
  }
  function upsertTemplate(t) {
    const custom = readJson(tplFile(), []);
    const at = custom.findIndex((x) => x.id === t.id);
    const next = {
      id: t.id || `tpl-${Date.now().toString(36)}`,
      name: String(t.name || '新模板'),
      category: String(t.category || '文字'),
      content: String(t.content || ''),
      custom: true,
      updatedAt: Date.now(),
    };
    if (at >= 0) custom[at] = next; else custom.unshift(next);
    writeJson(tplFile(), custom);
    return next;
  }
  function deleteTemplate(id) {
    const custom = readJson(tplFile(), []).filter((x) => x.id !== id);
    writeJson(tplFile(), custom);
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

  function upsertWardrobe(item) {
    const all = readJson(wardFile(), []);
    const at = all.findIndex((x) => x.id === item.id);
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
    if (at >= 0) all[at] = next; else all.unshift(next);
    writeJson(wardFile(), all);
    return next;
  }
  function deleteWardrobe(id) {
    const all = readJson(wardFile(), []).filter((x) => x.id !== id);
    writeJson(wardFile(), all);
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
  function upsertMotionShot(item) {
    const all = readJson(motionFile(), []);
    const at = all.findIndex((x) => x.id === item.id);
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
    if (at >= 0) all[at] = next; else all.unshift(next);
    writeJson(motionFile(), all);
    return next;
  }
  function deleteMotionShot(id) {
    const all = readJson(motionFile(), []).filter((x) => x.id !== id);
    writeJson(motionFile(), all);
    return { removed: id };
  }

  /* ---------------- 运行日志 ---------------- */
  const LOG_MAX = 500;

  function appendLog(entry) {
    const all = readJson(file('logs.json'), []);
    all.unshift({ ...entry, at: Date.now() });
    writeJson(file('logs.json'), all.slice(0, LOG_MAX));
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