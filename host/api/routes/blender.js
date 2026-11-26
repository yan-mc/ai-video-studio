/**
 * Blender 预演域：/blender/*。
 *
 * 从镜头卡渲出 H3 的控制序列（depth / pose / canny / gray）——
 * 与 three.js 预演引擎的区别是它能出 ControlNet 真正需要的条件通道。
 */
import { blenderStatus, buildSceneSpec, renderControl, listModelAssets, listAssetActions, openInBlender } from '../../services/blender-service.js';
import { listActionCatalog } from '../../store/models.js';
import { readJsonBody } from '../http.js';
import { listShots } from '../shots.js';

/** 超时夹取：下限 30s（免得太短必然失败），上限 15min（避免长镜头被砍） */
const clampTimeout = (v) => Math.max(30000, Math.min(900000, Number(v) || 600000));

export async function handleBlender(req, res, R) {
  const { route, cfg, json, safeId } = R;

  if (req.method === 'GET' && route === '/blender/health') {
    return json(200, blenderStatus());
  }

  if (req.method === 'GET' && route === '/blender/assets') {
    return json(200, { assets: listModelAssets(cfg) });
  }

  /*
   * 动作目录 —— 单一真源（host/blender/actions.py）下发给前端。
   * 动作名曾经在三处各写各的（前端下拉 / 后端白名单 / Python 实现），
   * 漂移到 57/59/27，32 个动作"能选但不生效"。
   */
  if (req.method === 'GET' && route === '/blender/actions/catalog') {
    const actions = listActionCatalog();
    return json(200, {
      actions,
      groups: [...new Set(actions.map((a) => a.group))].map((g) => ({
        id: g,
        label: actions.find((a) => a.group === g)?.groupLabel ?? g,
      })),
      count: actions.length,
    });
  }

  if (req.method === 'POST' && route === '/blender/open') {
    const body = await readJsonBody(req);
    return json(200, await openInBlender({
      blendPath: body.blendRel ? String(body.blendRel) : '',
      cfg,
    }));
  }

  if (req.method === 'POST' && route === '/blender/actions') {
    const body = await readJsonBody(req);
    const rel = String(body.assetRel || '');
    if (!rel) return json(400, { error: 'ASSET_REQUIRED' });
    return json(200, await listAssetActions({ assetRel: rel, cfg }));
  }

  if (req.method === 'POST' && route === '/blender/render') {
    const body = await readJsonBody(req);
    const mode = String(body.mode || 'blockout');
    const pid = body.projectId ? safeId(body.projectId) : '';
    const shot = body.shot ?? (pid && body.shotId
      ? listShots(pid).find((s) => s.id === body.shotId)
      : null);
    if (!shot) return json(404, { error: 'SHOT_NOT_FOUND' });
    const spec = body.spec ?? buildSceneSpec(shot, { frames: body.frames });
    return json(200, await renderControl({
      mode,
      spec,
      cfg,
      jobId: String(body.jobId || shot.id || ''),
      timeoutMs: clampTimeout(body.timeoutMs),
    }));
  }

  return false;
}

export { clampTimeout };
