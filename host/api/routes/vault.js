/**
 * 角色卡仓库域：/vault/*、项目 ⇄ 角色卡绑定。
 */
import { readProjectCards } from '../../services/character-vault.js';
import { readJsonBody } from '../http.js';

const CARD_ID = /^\/vault\/cards\/([A-Za-z0-9_]+)$/;

export async function handleVault(req, res, R) {
  const { route, url, cfg, ctx, json, safeId } = R;

  if (req.method === 'GET' && route === '/vault/meta') {
    return json(200, ctx.vault.meta());
  }
  if (req.method === 'GET' && route === '/vault/cards') {
    return json(200, await ctx.vault.list({ q: url.searchParams.get('q') || '' }));
  }
  if (req.method === 'POST' && route === '/vault/cards') {
    const body = await readJsonBody(req);
    return json(200, await ctx.vault.upsert(body));
  }
  if (req.method === 'POST' && route === '/vault/cards/delete') {
    const body = await readJsonBody(req);
    if (!body.id) return json(400, { error: 'ID_REQUIRED' });
    return json(200, await ctx.vault.remove(String(body.id)));
  }

  const m = CARD_ID.exec(route);
  if (m) {
    const id = safeId(m[1], /^card_[A-Za-z0-9]+$/);
    if (req.method === 'GET') {
      const card = await ctx.vault.get(id);
      if (!card) return json(404, { error: 'CARD_NOT_FOUND' });
      return json(200, card);
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      return json(200, await ctx.vault.upsert({ ...body, id }));
    }
    return false;
  }

  // 项目已绑定的卡也并进计划（前端只传 cardIds 也能拿到完整清单）
  if (req.method === 'GET' && route === '/vault/plan') {
    const projectId = url.searchParams.get('projectId');
    const cardIds = (url.searchParams.get('cardIds') || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const bound = projectId ? readProjectCards(projectId, cfg) : [];
    const merged = [...new Set([...cardIds, ...bound])];
    return json(200, await ctx.vault.plan({
      cardIds: merged,
      extraImages: (url.searchParams.get('extra') || '').split(',').map((s) => s.trim()).filter(Boolean),
      firstLastCount: Number(url.searchParams.get('firstLast') || 0),
    }));
  }

  return false;
}
