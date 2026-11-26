/**
 * 工具箱域：模板 / 服化道 / 分镜目录导入 / 资源清理 / 动态条 / 运行日志 /
 * H3 工坊 / 画布内置 Agent / 批量进度。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJsonBody } from '../http.js';
import { listShots } from '../shots.js';
import { prunePrevizRuns } from '../../services/blender-service.js';
import { getCanvasPermissions, setCanvasPermissions, loadCanvasPermissions } from '../../services/canvas-agent.js';
import { safeId } from '../../security.js';

/** 递归统计目录占用（异步，避免长任务期间阻塞事件循环） */
async function dirUsage(dir) {
  let bytes = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = await fs.readdir(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      try { bytes += (await fs.stat(p)).size; files += 1; } catch { /* 并发删除 */ }
    }
  }
  return { bytes, files };
}

/**
 * 3D 预演产物的占用统计。
 *
 * 这块历史没有清理路径：实测 5 次渲染在 data/previz/blender/ 留下
 * 452 文件 / 74 MB，而 extras.findOrphans 只管 data/assets/。
 * 渲染完成后按保留策略自动清理，这里提供手动看/清入口。
 */
export async function previzUsage(cfg) {
  const root = path.join(cfg.dataDir, 'previz', 'blender');
  let runs = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    runs = await Promise.all(entries
      .filter((e) => e.isDirectory())
      .map(async (e) => ({ name: e.name, ...(await dirUsage(path.join(root, e.name))) })));
    runs.sort((a, b) => a.name.localeCompare(b.name));
  } catch { /* 目录不存在 */ }
  return {
    runs,
    count: runs.length,
    totalBytes: runs.reduce((s, r) => s + r.bytes, 0),
    policy: { keepRuns: 8, maxBytes: 2 * 1024 ** 3 },
  };
}

export async function handleToolbox(req, res, R) {
  const { route, url, cfg, ctx, json } = R;

  /* ---------------- H3 工坊 / 成片 ---------------- */

  if (req.method === 'POST' && route === '/h3/workshop/analyze') {
    const body = await readJsonBody(req);
    return json(200, await ctx.h3.analyze(body));
  }
  if (req.method === 'POST' && route === '/h3/workshop/import') {
    const body = await readJsonBody(req);
    return json(200, await ctx.h3.importAssets(body));
  }
  if (req.method === 'GET' && route === '/h3/film/status') {
    return json(200, ctx.h3.filmStatus());
  }
  if (req.method === 'POST' && route === '/h3/film/render') {
    const body = await readJsonBody(req);
    return json(200, await ctx.h3.filmRender(body));
  }

  /* ---------------- 提示词模板 ---------------- */

  if (req.method === 'GET' && route === '/templates') {
    return json(200, ctx.extras.listTemplates());
  }
  if (req.method === 'POST' && route === '/templates/upsert') {
    return json(200, ctx.extras.upsertTemplate(await readJsonBody(req)));
  }
  if (req.method === 'POST' && route === '/templates/delete') {
    const body = await readJsonBody(req);
    return json(200, ctx.extras.deleteTemplate(String(body.id)));
  }

  /* ---------------- 服化道 ---------------- */

  if (req.method === 'GET' && route === '/wardrobe') {
    return json(200, ctx.extras.listWardrobe(url.searchParams.get('kind') || null));
  }
  if (req.method === 'POST' && route === '/wardrobe/upsert') {
    return json(200, ctx.extras.upsertWardrobe(await readJsonBody(req)));
  }
  if (req.method === 'POST' && route === '/wardrobe/delete') {
    const body = await readJsonBody(req);
    return json(200, ctx.extras.deleteWardrobe(String(body.id)));
  }

  /*
   * 服化道 → 生成入参。放在服务端而不是前端拼：渲染页、Agent 工具、
   * 将来任何入口都必须拿到同一份转换结果，否则又是"两处各写一份、慢慢漂移"。
   */
  if (req.method === 'POST' && route === '/wardrobe/resolve') {
    const body = await readJsonBody(req);
    const r = ctx.extras.wardrobeToGeneration(body.ids ?? []);
    return json(200, {
      ok: true,
      images: r.images,
      notes: r.notes,
      count: r.items.length,
      items: r.items.map((w) => ({ id: w.id, kind: w.kind, name: w.name, hasImage: Boolean(w.imageRel) })),
    });
  }

  /* ---------------- 数据健康 ---------------- */

  // extras 读坏 JSON 会降级为空列表（否则整个工具箱打不开），但必须让用户看到
  if (req.method === 'GET' && route === '/toolbox/health') {
    return json(200, { ok: true, warnings: ctx.extras.warnings() });
  }

  /* ---------------- 分镜目录导入 ---------------- */

  if (req.method === 'POST' && route === '/import/scan') {
    const body = await readJsonBody(req);
    return json(200, ctx.extras.scanImportDir(String(body.dir || '')));
  }
  if (req.method === 'POST' && route === '/import/preview') {
    const body = await readJsonBody(req);
    return json(200, ctx.extras.previewImportFile(String(body.path || ''), Number(body.limit) || 2000));
  }

  /* ---------------- 资源清理 ---------------- */

  if (req.method === 'GET' && route === '/resources/orphans') {
    return json(200, ctx.extras.findOrphans(await ctx.assets.list({})));
  }

  if (req.method === 'GET' && route === '/resources/previz') {
    return json(200, await previzUsage(cfg));
  }
  if (req.method === 'POST' && route === '/resources/previz/clean') {
    const body = await readJsonBody(req);
    const result = prunePrevizRuns(cfg, {
      keepRuns: Math.max(1, Math.min(100, Number(body.keepRuns) || 8)),
      maxBytes: Math.max(0, Number(body.maxBytes) || 2 * 1024 ** 3),
    });
    return json(200, { ok: true, ...result });
  }
  if (req.method === 'POST' && route === '/resources/clean') {
    const body = await readJsonBody(req);
    return json(200, ctx.extras.cleanOrphans(await ctx.assets.list({}), { confirm: Boolean(body.confirm) }));
  }

  /* ---------------- 动态提示词条 ---------------- */

  if (req.method === 'GET' && route === '/motionshots') {
    return json(200, ctx.extras.listMotionShots(url.searchParams.get('projectId') || null));
  }
  if (req.method === 'POST' && route === '/motionshots/upsert') {
    return json(200, ctx.extras.upsertMotionShot(await readJsonBody(req)));
  }
  if (req.method === 'POST' && route === '/motionshots/delete') {
    const body = await readJsonBody(req);
    return json(200, ctx.extras.deleteMotionShot(String(body.id)));
  }

  /* ---------------- 运行日志 ---------------- */

  if (req.method === 'GET' && route === '/logs') {
    return json(200, ctx.extras.listLogs(Number(url.searchParams.get('limit')) || 100));
  }
  if (req.method === 'POST' && route === '/logs') {
    return json(200, await ctx.extras.appendLog(await readJsonBody(req)));
  }

  /* ---------------- 画布内置 Agent ---------------- */

  if (route.startsWith('/canvas-agent')) loadCanvasPermissions(cfg);

  /*
   * 键名必须是 `current`：meta() 里的 `permissions` 是**能力清单数组**，
   * 前端用 `meta.permissions.map(...)` 渲染开关。把它覆盖成对象会让面板首次打开即崩。
   */
  if (req.method === 'GET' && route === '/canvas-agent/meta') {
    return json(200, { ...ctx.canvasAgent.meta(), current: getCanvasPermissions() });
  }

  if ((req.method === 'POST' || req.method === 'PUT') && route === '/canvas-agent/permissions') {
    const body = await readJsonBody(req);
    const patch = body?.permissions ?? body ?? {};
    return json(200, { ok: true, permissions: setCanvasPermissions(patch, cfg) });
  }

  if (req.method === 'POST' && route === '/canvas-agent/exec') {
    const body = await readJsonBody(req);
    const name = String(body.name || '');
    const ctxIn = body.context ?? {};
    const rawPid = body.projectId ? safeId(String(body.projectId)) : '';

    // 权限一律用服务端的：请求体里的同名声明必须丢掉，否则调用方能自报 canDelete
    const rest = { ...(ctxIn && typeof ctxIn === 'object' ? ctxIn : {}) };
    delete rest.permissions;
    const enriched = { ...rest, permissions: getCanvasPermissions() };
    if (rawPid) {
      if (!ctxIn.assets) enriched.assets = await ctx.assets.list({ projectId: rawPid });
      if (!ctxIn.shots) enriched.shots = listShots(rawPid);
    }
    return json(200, await ctx.canvasAgent.exec(name, body.arguments ?? {}, enriched));
  }

  return false;
}
