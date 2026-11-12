/**
 * 剩余功能域服务 —— 一次补齐洛书里剩下的中小域。
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

/* ------------------------------------------------------- 提示词模板 */

/** 20 条内置系统模板（洛书 tWe 注册表规模） */
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

/** 服化道 4 类（洛书 wardrobe：服装/饰品/武器/道具） */
export const WARDROBE_KINDS = Object.freeze([
  { id: 'costume', name: '服装', desc: '衣服、鞋帽、制服' },
  { id: 'accessory', name: '饰品', desc: '首饰、发饰、眼镜、包' },
  { id: 'weapon', name: '武器', desc: '刀剑、枪械、法杖' },
  { id: 'prop', name: '道具', desc: '手持物、陈设、机关' },
]);

/* ------------------------------------------------------- 分镜导入 */

/** 可识别的产物类型（洛书 storyboardImport） */
export const IMPORT_SOURCES = Object.freeze([
  { id: 'seedance-meta', name: 'Seedance 元数据', pattern: /seedance.*\.json$/i, kind: 'seedance' },
  { id: 'seedance-storyboard', name: 'Seedance 分镜', pattern: /storyboard.*\.(json|md)$/i, kind: 'seedance' },
  { id: 'seedance-shotlist', name: 'Seedance 镜头表', pattern: /shot.*list.*\.(json|csv)$/i, kind: 'seedance' },
  { id: 'seedance-prompt', name: 'Seedance 提示词', pattern: /prompt.*\.txt$/i, kind: 'seedance' },
  { id: 'h3-prompt-pack', name: 'H3 提示词包', pattern: /h3.*prompt.*\.(json|txt|md)$/i, kind: 'h3' },
  { id: 'h3-segments', name: 'H3 分段', pattern: /segment.*\.(json|md)$/i, kind: 'h3' },
  { id: 'h3-assets', name: 'H3 资产表', pattern: /asset.*\.(json|csv)$/i, kind: 'h3' },
  { id: 'h3-film', name: 'H3 成片清单', pattern: /film.*\.(json|md)$/i, kind: 'h3' },
  { id: 'h3-srt', name: 'H3 字幕', pattern: /\.srt$/i, kind: 'h3' },
]);

/* ------------------------------------------------------- 服务 */

export function createExtrasService({ cfg }) {
  function file(name) {
    const d = path.join(cfg.dataDir, 'extras');
    fs.mkdirSync(d, { recursive: true });
    return path.join(d, name);
  }
  function readJson(f, fallback) {
    if (!fs.existsSync(f)) return fallback;
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
  }
  function writeJson(f, v) {
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(v, null, 2), 'utf8');
    fs.renameSync(tmp, f);
    return v;
  }

  /* ---------------- 提示词模板 ---------------- */
  const tplFile = () => file('prompt-templates.json');

  function listTemplates() {
    const custom = readJson(tplFile(), []);
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

  function listWardrobe(kind) {
    const all = readJson(wardFile(), []);
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
   * @param {string} dir 绝对路径
   */
  function scanImportDir(dir) {
    if (!dir || !fs.existsSync(dir)) throw new Error('DIR_NOT_FOUND');
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const full = path.join(dir, e.name);
      const st = fs.statSync(full);
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
      dir,
      total: files.length,
      known: known.length,
      unknown: unknown.length,
      files: known,
      skipped: unknown.map((f) => f.name),
    };
  }

  /** 读取一个导入文件的预览（前 N 字符） */
  function previewImportFile(filePath, limit = 2000) {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('FILE_NOT_FOUND');
    const raw = fs.readFileSync(filePath, 'utf8');
    return {
      name: path.basename(filePath),
      bytes: Buffer.byteLength(raw, 'utf8'),
      truncated: raw.length > limit,
      preview: raw.slice(0, limit),
    };
  }

  /* ---------------- 资源清理（孤儿文件） ---------------- */
  /**
   * 找出 assets/ 目录里没有被任何资产记录引用的文件。
   */
  function findOrphans(assetList) {
    const assetsDir = path.join(cfg.dataDir, 'assets');
    if (!fs.existsSync(assetsDir)) return { orphans: [], total: 0, referenced: 0 };

    const referenced = new Set(
      (assetList ?? []).map((a) => String(a.rel ?? '').replace(/^assets\//, '')).filter(Boolean),
    );
    const files = fs.readdirSync(assetsDir, { withFileTypes: true }).filter((e) => e.isFile());
    const orphans = [];
    let referencedCount = 0;
    for (const f of files) {
      if (referenced.has(f.name)) { referencedCount += 1; continue; }
      const full = path.join(assetsDir, f.name);
      const st = fs.statSync(full);
      orphans.push({ name: f.name, path: full, bytes: st.size, mtime: st.mtimeMs });
    }
    return {
      total: files.length,
      referenced: referencedCount,
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
    const all = readJson(motionFile(), []);
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
    return readJson(file('logs.json'), []).slice(0, Math.max(1, Math.min(LOG_MAX, limit)));
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
  };
}

export { SYSTEM_PROMPT_TEMPLATES as BUILTIN_TEMPLATES, WARDROBE_KINDS as CLOTHING_KINDS };