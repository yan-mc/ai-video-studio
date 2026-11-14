/**
 * 漫画工作台服务 —— 对齐洛书 `comic` 域（1120 键 / 19 子域 / 15 站流水线）。
 *
 * 洛书核心设计（已实测确认）：
 *  **本地渲染零费用 + 只有 LLM 抽取与出图花钱。**
 *  15 个站里有 7 个零费用：hints / layout / anchors / prompt / compose /
 *  preflight / exportSpec —— 也就是说**不接任何模型也能产出可交付的 PDF/CBZ**。
 *
 * 本实现优先落地这 7 个零费用站，让工作台先"能用"：
 *   分镜抽取（规则版）→ 分镜板编辑 → 几何排版 → 拼版导出
 *
 * 版式模板（洛书 11 套，已提取）：
 *   splash / split_h / split_v / grid_2x2 / grid_3x1 / grid_2x3 /
 *   grid_3x2 / top_wide / bottom_wide / five_panel / strip_4
 */
import fs from 'node:fs';
import path from 'node:path';
import { safeId } from '../security.js';

/** 11 套版式模板（洛书实测） */
export const LAYOUT_TEMPLATES = Object.freeze([
  { id: 'splash', name: '整页单格', rows: 1, cols: 1 },
  { id: 'split_h', name: '横双格', rows: 2, cols: 1 },
  { id: 'split_v', name: '竖双格', rows: 1, cols: 2 },
  { id: 'grid_2x2', name: '四宫格', rows: 2, cols: 2 },
  { id: 'grid_3x1', name: '三横格', rows: 3, cols: 1 },
  { id: 'grid_2x3', name: '六宫格（2×3）', rows: 2, cols: 3 },
  { id: 'grid_3x2', name: '六宫格（3×2）', rows: 3, cols: 2 },
  { id: 'top_wide', name: '上宽下双', rows: 2, cols: 2, special: 'top_wide' },
  { id: 'bottom_wide', name: '上双下宽', rows: 2, cols: 2, special: 'bottom_wide' },
  { id: 'five_panel', name: '五格分布', rows: 3, cols: 2, special: 'five' },
  { id: 'strip_4', name: '条漫四格', rows: 4, cols: 1 },
]);

/** 15 个「站」（洛书 comic.station.*），标注是否零费用 */
export const STATIONS = Object.freeze([
  { id: 'extract', name: '分镜抽取', cost: 'llm', desc: '文本 → 分镜板' },
  { id: 'hints', name: '表演/越轴提示', cost: 'free', desc: '本地软检测' },
  { id: 'chapterEnd', name: '话末交接', cost: 'llm', desc: '本话末状态 + 未解线头' },
  { id: 'layout', name: '排版出页', cost: 'free', desc: '本地渲染' },
  { id: 'profile', name: '人设提取', cost: 'llm', desc: '11 字段人设' },
  { id: 'anchors', name: '场景/道具归并', cost: 'free', desc: '归并 · 视觉锚' },
  { id: 'anchorDraft', name: '锚草稿', cost: 'llm', desc: '生成视觉锚建议' },
  { id: 'forms', name: '形态', cost: 'image', desc: '换装/状态蒙版' },
  { id: 'prompt', name: '提示词计划', cost: 'free', desc: '逐格拼装提示词' },
  { id: 'qc', name: '质检', cost: 'server', desc: '线稿/上色/语义三路' },
  { id: 'compose', name: '单页重拼', cost: 'free', desc: '只重渲受影响页' },
  { id: 'retouch', name: '修图', cost: 'image', desc: '局部重绘 / 超分' },
  { id: 'preflight', name: '体检', cost: 'free', desc: '发布前 7 项' },
  { id: 'assetDesign', name: '设定图提示词', cost: 'image', desc: '服务端拼装' },
  { id: 'exportSpec', name: '按规格导出', cost: 'free', desc: '页漫/印刷/条漫/屏幕' },
]);

/** 任务六态 */
export const TASK_STATES = Object.freeze(['queued', 'running', 'waiting', 'done', 'failed', 'cancelled']);

/* ------------------------------------------------------- 分镜抽取（规则版） */

/**
 * 把文本抽成分镜板（不依赖 LLM 的规则实现）。
 * 洛书这个站花 LLM，我们用规则先做出可用版本。
 */
export function extractBoardFromText(text, { pages = 1, template = 'grid_2x2' } = {}) {
  const src = String(text || '').trim();
  if (!src) return { pages: [] };

  const tpl = LAYOUT_TEMPLATES.find((t) => t.id === template) ?? LAYOUT_TEMPLATES[3];
  const perPage = tpl.rows * tpl.cols;
  const pageCount = Math.max(1, Math.min(100, Number(pages) || 1));

  // 按段落/句号切分镜
  const rawPanels = src
    .split(/\n{2,}|(?<=[。！？!?])/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const panels = rawPanels.length ? rawPanels : ['（空）'];
  const outPages = [];
  let cursor = 0;
  for (let p = 0; p < pageCount; p++) {
    const pagePanels = [];
    for (let i = 0; i < perPage; i++) {
      const src = panels[cursor % panels.length];
      cursor += 1;
      pagePanels.push({
        index: i + 1,
        text: src,
        bubble: '',
        speaker: '',
        geometry: panelGeometry(tpl, i),
        imageRel: null,
      });
    }
    outPages.push({ index: p + 1, template: tpl.id, panels: pagePanels });
  }
  return { pages: outPages, template: tpl.id, panelCount: pageCount * perPage };
}

/**
 * 计算一格在页面里的归一化几何（0..1）。
 * 洛书有独立的 geom 编辑器，这里给出模板默认几何。
 */
export function panelGeometry(tpl, i) {
  const { rows, cols, special } = tpl;
  const w = 1 / cols;
  const h = 1 / rows;
  let r = Math.floor(i / cols);
  let c = i % cols;

  // 特殊版式：顶/底整宽
  if (special === 'top_wide' && i === 0) return { x: 0, y: 0, w: 1, h: h };
  if (special === 'top_wide' && i > 0) { r = 1; c = i - 1; return { x: c * (1 / 2), y: h, w: 1 / 2, h }; }
  if (special === 'bottom_wide' && i === rows * cols - 1) return { x: 0, y: 1 - h, w: 1, h };
  if (special === 'five' && i === rows * cols - 1) return { x: 0, y: 2 / 3, w: 1, h: 1 / 3 };

  return { x: c * w, y: r * h, w, h };
}

/* --------------------------------------------------------- 拼版导出（本地） */

/**
 * 生成 SVG 拼版图（零费用本地渲染）。
 * SVG 可以直接在浏览器显示，也能转成 PNG/PDF。
 */
export function renderPageSvg(page, { width = 1240, height = 1754, margin = 40, gutter = 8, images = {} } = {}) {
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

  for (const panel of page.panels ?? []) {
    const g = panel.geometry ?? { x: 0, y: 0, w: 1, h: 1 };
    const x = margin + g.x * innerW + gutter / 2;
    const y = margin + g.y * innerH + gutter / 2;
    const w = g.w * innerW - gutter;
    const h = g.h * innerH - gutter;

    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#f2f2f2" stroke="#222" stroke-width="2"/>`);

    const rel = panel.imageRel;
    if (rel && images[rel]) {
      parts.push(`<image x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" href="${escapeXml(images[rel])}" preserveAspectRatio="xMidYMid slice"/>`);
    } else {
      // 无图时显示文字占位（便于排版校对）
      const text = String(panel.text ?? '').slice(0, 40);
      const lines = wrapText(text, Math.max(8, Math.floor(w / 14)));
      lines.slice(0, Math.floor(h / 20)).forEach((line, li) => {
        parts.push(`<text x="${(x + 8).toFixed(1)}" y="${(y + 24 + li * 18).toFixed(1)}" font-size="13" fill="#666" font-family="sans-serif">${escapeXml(line)}</text>`);
      });
    }
  }
  parts.push(`</svg>`);
  return parts.join('\n');
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

function wrapText(s, width) {
  const out = [];
  let cur = '';
  for (const ch of String(s)) {
    if (cur.length >= width) { out.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/* ------------------------------------------------------------ 发布前体检 */

/**
 * 发布前体检 7 项（洛书 comic.preflight，只读零成本）。
 */
export function preflight(doc) {
  const checks = [];
  const pages = doc?.pages ?? [];

  // 1) 有页面
  checks.push({ id: 'has-pages', name: '有页面', ok: pages.length > 0, detail: `${pages.length} 页` });
  // 2) 每页有格
  const emptyPages = pages.filter((p) => !(p.panels?.length));
  checks.push({ id: 'panels', name: '每页有分格', ok: emptyPages.length === 0, detail: emptyPages.length ? `${emptyPages.length} 页为空` : '正常' });
  // 3) 每格有文本或图
  const emptyPanels = [];
  for (const p of pages) for (const pn of p.panels ?? []) if (!pn.text && !pn.imageRel) emptyPanels.push(`${p.index}-${pn.index}`);
  checks.push({ id: 'panel-content', name: '每格有内容', ok: emptyPanels.length === 0, detail: emptyPanels.length ? `空格：${emptyPanels.slice(0, 5).join(',')}` : '正常' });
  // 4) 有台词的格有说话人
  const noSpeaker = [];
  for (const p of pages) for (const pn of p.panels ?? []) if (pn.bubble && !pn.speaker) noSpeaker.push(`${p.index}-${pn.index}`);
  checks.push({ id: 'speaker', name: '气泡有说话人', ok: noSpeaker.length === 0, detail: noSpeaker.length ? `${noSpeaker.length} 处缺失` : '正常' });
  // 5) 几何不越界
  const oob = [];
  for (const p of pages) for (const pn of p.panels ?? []) {
    const g = pn.geometry ?? {};
    if ((g.x ?? 0) < 0 || (g.y ?? 0) < 0 || ((g.x ?? 0) + (g.w ?? 0)) > 1.001 || ((g.y ?? 0) + (g.h ?? 0)) > 1.001) oob.push(`${p.index}-${pn.index}`);
  }
  checks.push({ id: 'geometry', name: '分格不越界', ok: oob.length === 0, detail: oob.length ? `${oob.length} 处越界` : '正常' });
  // 6) 模板已选
  const noTpl = pages.filter((p) => !p.template);
  checks.push({ id: 'template', name: '每页有版式', ok: noTpl.length === 0, detail: noTpl.length ? `${noTpl.length} 页未选版式` : '正常' });
  // 7) 页数合理
  checks.push({ id: 'page-count', name: '页数合理', ok: pages.length > 0 && pages.length <= 200, detail: `${pages.length} 页` });

  const blocking = checks.filter((c) => !c.ok);
  return {
    ok: blocking.length === 0,
    total: checks.length,
    passed: checks.length - blocking.length,
    checks,
    blocking,
  };
}

/* --------------------------------------------------------------- 服务 */

export function createComicService({ cfg }) {
  function dir() {
    const d = path.join(cfg.dataDir, 'comic');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  /**
   * 单个项目的漫画文件。
   *
   * ⚠️ projectId 必须校验：这里直接拼进文件名，不校验的话
   *    `projectId: '../../../x'` 可把文件写到数据目录之外。
   */
  function file(projectId) {
    const id = safeId(projectId);
    return path.join(dir(), `${id}.json`);
  }
  function load(projectId) {
    const f = file(projectId);
    if (!fs.existsSync(f)) return null;
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  }
  function save(projectId, doc) {
    const f = file(projectId);
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ ...doc, projectId, updatedAt: Date.now() }, null, 2), 'utf8');
    fs.renameSync(tmp, f);
    return doc;
  }

  /** 分镜抽取（零费用规则版） */
  async function extract(projectId, body = {}) {
    const cur = load(projectId) ?? {};
    const board = extractBoardFromText(body.text ?? cur.sourceText ?? '', {
      pages: body.pages ?? 1,
      template: body.template ?? 'grid_2x2',
    });
    const next = { ...cur, projectId, sourceText: body.text ?? cur.sourceText, ...board };
    next.preflight = preflight(next);
    save(projectId, next);
    return next;
  }

  /** 单页重拼（零费用）：只改一页 */
  async function relayoutPage(projectId, pageIndex, template) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND: 请先做分镜抽取');
    const tpl = LAYOUT_TEMPLATES.find((t) => t.id === template);
    if (!tpl) throw new Error(`UNKNOWN_TEMPLATE: ${template}`);
    const page = (cur.pages ?? []).find((p) => p.index === pageIndex);
    if (!page) throw new Error('PAGE_NOT_FOUND');

    const perPage = tpl.rows * tpl.cols;
    const panels = Array.from({ length: perPage }, (_, i) => ({
      index: i + 1,
      text: page.panels?.[i]?.text ?? '',
      bubble: page.panels?.[i]?.bubble ?? '',
      speaker: page.panels?.[i]?.speaker ?? '',
      geometry: panelGeometry(tpl, i),
      imageRel: page.panels?.[i]?.imageRel ?? null,
    }));
    const pages = cur.pages.map((p) => (p.index === pageIndex ? { ...p, template: tpl.id, panels } : p));
    const next = { ...cur, pages };
    next.preflight = preflight(next);
    save(projectId, next);
    return next;
  }

  /** 导出单页 SVG（零费用本地渲染） */
  function exportPageSvg(projectId, pageIndex, opts = {}) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND');
    const page = (cur.pages ?? []).find((p) => p.index === pageIndex);
    if (!page) throw new Error('PAGE_NOT_FOUND');
    // 把已出的格图内嵌成 data URI，让 SVG 自包含
    const images = {};
    for (const pn of page.panels ?? []) {
      if (!pn.imageRel) continue;
      try {
        const abs = path.join(cfg.dataDir, pn.imageRel);
        if (fs.existsSync(abs)) {
          const buf = fs.readFileSync(abs);
          const ext = path.extname(abs).toLowerCase();
          const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
          images[pn.imageRel] = `data:${mime};base64,${buf.toString('base64')}`;
        }
      } catch { /* ignore */ }
    }
    const svg = renderPageSvg(page, { ...opts, images });
    const outDir = path.join(cfg.dataDir, 'comic', 'export');
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `page_${pageIndex}_${Date.now().toString(36)}.svg`);
    fs.writeFileSync(out, svg, 'utf8');
    return {
      ok: true,
      path: out,
      rel: path.relative(cfg.dataDir, out).replace(/\\/g, '/'),
      bytes: Buffer.byteLength(svg, 'utf8'),
      svg,
    };
  }

  /** 导出全部页 */
  function exportAllSvg(projectId, opts = {}) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND');
    const outDir = path.join(cfg.dataDir, 'comic', 'export');
    fs.mkdirSync(outDir, { recursive: true });
    const files = [];
    for (const page of cur.pages ?? []) {
      // 内嵌已出的格图
      const images = {};
      for (const pn of page.panels ?? []) {
        if (!pn.imageRel) continue;
        try {
          const abs = path.join(cfg.dataDir, pn.imageRel);
          if (fs.existsSync(abs)) {
            const buf = fs.readFileSync(abs);
            const ext = path.extname(abs).toLowerCase();
            const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
            images[pn.imageRel] = `data:${mime};base64,${buf.toString('base64')}`;
          }
        } catch { /* ignore */ }
      }
      const svg = renderPageSvg(page, { ...opts, images });
      const out = path.join(outDir, `page_${page.index}_${Date.now().toString(36)}.svg`);
      fs.writeFileSync(out, svg, 'utf8');
      files.push({ page: page.index, path: out, rel: path.relative(cfg.dataDir, out).replace(/\\/g, '/'), bytes: Buffer.byteLength(svg, 'utf8') });
    }
    return { ok: true, count: files.length, files };
  }

  /** 体检 */
  function runPreflight(projectId) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND');
    return preflight(cur);
  }

  /* ------------------------------------------------ 提示词计划（零费用） */

  /**
   * 逐格拼装提示词。
   * 洛书 `prompt` 站：本地运算，零费用。
   * 把「画风 + 角色 + 场景 + 每格内容」拼成一致的出图提示词。
   */
  async function planPrompts(projectId, body = {}) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND');

    const styleText = String(body.style ?? cur.style ?? '2D 动画风格，干净线条，赛璐珞上色');
    const charDesc = (cur.characters ?? body.characters ?? []).map((c) =>
      typeof c === 'string' ? c : `${c.name ?? ''}${c.desc ? `（${c.desc}）` : ''}`,
    ).filter(Boolean).join('；');
    const sceneDesc = String(body.scene ?? cur.scene ?? '');

    const plans = [];
    for (const page of cur.pages ?? []) {
      for (const pn of page.panels ?? []) {
        const parts = [];
        // 画风（英文优先，模型对英文画风响应更准）
        parts.push(styleText);
        // 角色
        if (charDesc) parts.push(`角色：${charDesc}`);
        // 场景
        if (sceneDesc) parts.push(`场景：${sceneDesc}`);
        // 本格内容
        if (pn.text) parts.push(`画面内容：${pn.text}`);
        // 构图
        parts.push(`构图：单格漫画分镜，${pn.geometry ? '横向构图' : '方形构图'}，主体居中，留出对白空间`);
        // 台词提示（不要求模型写字，只提示氛围）
        if (pn.bubble) parts.push(`情绪氛围：角色正在说话，${pn.bubble}`);
        // 质量
        parts.push('高质量，细节清晰，线条干净');

        plans.push({
          pageIndex: page.index,
          panelIndex: pn.index,
          key: `p${page.index}_${pn.index}`,
          prompt: parts.join('。'),
          chars: parts.join('。').length,
        });
      }
    }

    const next = { ...cur, planParts: plans, style: styleText };
    save(projectId, next);
    return { ok: true, count: plans.length, plans, style: styleText };
  }

  /** 取某一格的提示词（出图时用） */
  function panelPrompt(projectId, pageIndex, panelIndex) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND');
    const hit = (cur.planParts ?? []).find((p) => p.pageIndex === pageIndex && p.panelIndex === panelIndex);
    if (!hit) throw new Error('PLAN_NOT_FOUND: 请先执行「提示词计划」');
    return hit.prompt;
  }

  /** 记录某格出图结果 */
  function setPanelImage(projectId, pageIndex, panelIndex, result) {
    const cur = load(projectId);
    if (!cur) throw new Error('COMIC_NOT_FOUND');
    const pages = (cur.pages ?? []).map((pg) =>
      pg.index === pageIndex
        ? {
          ...pg,
          panels: pg.panels.map((pn) =>
            pn.index === panelIndex ? { ...pn, imageRel: result.rel, imagePath: result.path, imageAt: Date.now() } : pn,
          ),
        }
        : pg,
    );
    const next = { ...cur, pages };
    next.preflight = preflight(next);
    save(projectId, next);
    return next;
  }

  /** 统计出图进度 */
  function imageProgress(projectId) {
    const cur = load(projectId) ?? {};
    let total = 0;
    let done = 0;
    for (const pg of cur.pages ?? []) {
      for (const pn of pg.panels ?? []) {
        total += 1;
        if (pn.imageRel) done += 1;
      }
    }
    return { total, done, pending: total - done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  return {
    load, save, extract, relayoutPage, exportPageSvg, exportAllSvg, runPreflight, dir, file,
    planPrompts, panelPrompt, setPanelImage, imageProgress,
  };
}

export { LAYOUT_TEMPLATES as COMIC_TEMPLATES, STATIONS as COMIC_STATIONS };

