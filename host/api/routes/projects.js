/**
 * 项目与镜头域：/projects*、/projects/:id/shots、/projects/:id/cards。
 */
import { projects, newProject, newShot } from '../../store/models.js';
import { readJsonBody } from '../http.js';
import { listShots, upsertShot, cleanupProjectArtifacts } from '../shots.js';
import { projectSummary, allowedProjectPatch, packProject, unpackProject } from '../projects.js';
import { readProjectCards, writeProjectCards } from '../../services/character-vault.js';

const PROJECT_ID = /^\/projects\/([^/]+)$/;
const SHOT_ID = /^\/projects\/([^/]+)\/shots$/;
const CARDS_ID = /^\/projects\/([A-Za-z0-9_-]+)\/cards$/;

export async function handleProjects(req, res, R) {
  const { route, cfg, json, safeId } = R;

  if (route === '/projects') {
    if (req.method === 'GET') {
      const list = await projects.list();
      return json(200, list.map(projectSummary));
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const created = newProject(body);
      await projects.upsert(created);
      return json(200, projectSummary(created));
    }
  }

  const m = PROJECT_ID.exec(route);
  if (m) {
    const id = safeId(decodeURIComponent(m[1]));
    if (req.method === 'GET') {
      const p = await projects.get(id);
      if (!p) return json(404, { error: 'PROJECT_NOT_FOUND' });
      return json(200, unpackProject(p));
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const p = await projects.get(id);
      if (!p) return json(404, { error: 'PROJECT_NOT_FOUND' });
      const merged = { ...p, ...allowedProjectPatch(body), updatedAt: Date.now() };
      const packed = packProject(merged, p.imagePool);
      await projects.upsert(packed);
      return json(200, projectSummary(packed));
    }
    if (req.method === 'DELETE') {
      // 先清产物再删记录：反过来的话 cleanup 抛错会留下"记录没了、磁盘还在"
      const cleaned = cleanupProjectArtifacts(cfg, id);
      await projects.remove(id);
      return json(200, { ok: true, removed: id, cleaned });
    }
    return false;
  }

  const ms = SHOT_ID.exec(route);
  if (ms && req.method === 'GET') {
    return json(200, listShots(safeId(decodeURIComponent(ms[1]))));
  }
  if (ms && req.method === 'POST') {
    const pid = safeId(decodeURIComponent(ms[1]));
    const body = await readJsonBody(req);
    const saved = await upsertShot(pid, body.shot || newShot(body));
    return json(200, saved);
  }

  const mc = CARDS_ID.exec(route);
  if (mc) {
    const pid = safeId(mc[1]);
    if (req.method === 'GET') {
      const ids = readProjectCards(pid, cfg);
      const cards = [];
      for (const id of ids) {
        const c = await R.ctx.vault.get(id).catch(() => null);
        if (c) cards.push(c);
      }
      return json(200, { projectId: pid, cardIds: ids, cards });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const ids = writeProjectCards(pid, body.cardIds ?? [], cfg);
      return json(200, { ok: true, projectId: pid, cardIds: ids });
    }
  }

  return false;
}
