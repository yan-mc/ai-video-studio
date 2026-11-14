/**
 * 角色卡仓库 —— 一个角色 = 拆解图 + 设定文字（+ 可选原立绘）。
 *
 * 解决的问题：角色一致性不该靠"每个镜头手动挂一遍图"。
 * 卡片集中管理，项目选卡，分镜生成时自动注入。
 *
 * 设计要点见 docs/角色卡仓库-设计.md，这里只记实现约束：
 *
 *  1) **图片按槽位存**（sheet / origin / heads / extras），不是散数组 ——
 *     设定卡与原立绘用途不同，分开才能让 refPolicy 有东西可选。
 *  2) **参考图预算必须显式算**。H3 的 ref_images 上限是 9 张，
 *     且是整条提示词共享，不是每角色 9 张。超了要裁剪并**明确告知**。
 *  3) 卡片只存 `rel`（相对 dataDir），不存绝对路径。
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectionStore } from '../store/json-store.js';
import { safeId, safeJoin } from '../security.js';
import { loadConfig } from '../config.js';

/** H3 Ref2VA 的参考图硬上限（来自 ComfyUI nodes_minimax_h3.py 的 max=9） */
export const H3_MAX_REF_IMAGES = 9;
/** 官方另有"参考文件合计 ≤12"的说法，这里按更保守的 9 执行 */
export const H3_MAX_TOTAL_REFS = 12;

/** 图片槽位 */
export const CARD_IMAGE_SLOTS = Object.freeze([
  { id: 'sheet', name: '设定卡/拆解图', desc: '一致性首选：三视图 + 部件拆解，信息密度最高' },
  { id: 'origin', name: '原立绘', desc: '保真补充：真实画面氛围，但只有单一角度' },
  { id: 'heads', name: '头部特写', desc: '表情参考（可选）' },
  { id: 'extras', name: '其他参考', desc: '家具/道具/额外角度（可选）' },
]);

/** 参考图取用策略 */
export const CARD_REF_MODES = Object.freeze([
  { id: 'sheet-first', name: '设定卡优先', desc: '有设定卡就只用设定卡；没有才用原立绘' },
  { id: 'sheet-only', name: '只用设定卡', desc: '没有设定卡就不提供参考图' },
  { id: 'origin-first', name: '原立绘优先', desc: '有原立绘就只用原立绘' },
  { id: 'both', name: '两张都带上', desc: '设定卡 + 原立绘（占 2 个名额）' },
]);

export const DEFAULT_REF_POLICY = Object.freeze({
  mode: 'sheet-first',
  maxImages: 1,      // 单卡默认只占 1 张，给多角色留空间
});

function vaultDir(cfg = loadConfig()) {
  return path.join(cfg.dataDir, 'vault');
}

let store = null;
let storeFile = null;

function cardsStore(cfg = loadConfig()) {
  const f = path.join(vaultDir(cfg), 'cards.json');
  if (!store || storeFile !== f) {
    store = collectionStore(f, { prefix: 'card' });
    storeFile = f;
  }
  return store;
}

/** 重置单例（测试/切 dataDir 用） */
export function resetVaultStore() { store = null; storeFile = null; }

/* ------------------------------------------------------------------ 校验 */

function normalizeStringList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeImages(img = {}) {
  const out = {};
  for (const slot of CARD_IMAGE_SLOTS) {
    const v = img[slot.id];
    if (Array.isArray(v)) out[slot.id] = v.filter(Boolean).map(String);
    else if (typeof v === 'string' && v.trim()) out[slot.id] = [v.trim()];
    else out[slot.id] = [];
  }
  return out;
}

function normalizeRefPolicy(p = {}) {
  const mode = CARD_REF_MODES.some((m) => m.id === p.mode) ? p.mode : DEFAULT_REF_POLICY.mode;
  const n = Number(p.maxImages);
  return {
    mode,
    maxImages: Number.isFinite(n) && n >= 0 ? Math.min(H3_MAX_REF_IMAGES, Math.floor(n)) : DEFAULT_REF_POLICY.maxImages,
  };
}

/**
 * 把一张卡在各个策略下会贡献的图片列表算出来。
 * 返回 [{ slot, rel }]，顺序即优先级。
 */
export function cardImagesFor(card) {
  const mode = card.refPolicy?.mode ?? DEFAULT_REF_POLICY.mode;
  const max = Number.isFinite(card.refPolicy?.maxImages)
    ? card.refPolicy.maxImages
    : DEFAULT_REF_POLICY.maxImages;
  const imgs = card.images ?? {};
  const first = (slot) => (Array.isArray(imgs[slot]) && imgs[slot].length ? imgs[slot][0] : null);

  const sheet = first('sheet');
  const origin = first('origin');
  const heads = Array.isArray(imgs.heads) ? imgs.heads : [];
  const extras = Array.isArray(imgs.extras) ? imgs.extras : [];

  let picked = [];
  switch (mode) {
    case 'sheet-only':
      picked = sheet ? [{ slot: 'sheet', rel: sheet }] : [];
      break;
    case 'origin-first':
      picked = origin ? [{ slot: 'origin', rel: origin }] : [];
      break;
    case 'both':
      if (sheet) picked.push({ slot: 'sheet', rel: sheet });
      if (origin) picked.push({ slot: 'origin', rel: origin });
      if (!picked.length && heads.length) picked.push({ slot: 'heads', rel: heads[0] });
      break;
    case 'sheet-first':
    default:
      if (sheet) picked.push({ slot: 'sheet', rel: sheet });
      else if (origin) picked.push({ slot: 'origin', rel: origin });
      else if (heads.length) picked.push({ slot: 'heads', rel: heads[0] });
      break;
  }

  if (picked.length < max) {
    for (const h of heads) {
      if (picked.length >= max) break;
      if (picked.some((p) => p.rel === h)) continue;
      picked.push({ slot: 'heads', rel: h });
    }
  }
  if (picked.length < max) {
    for (const e of extras) {
      if (picked.length >= max) break;
      if (picked.some((p) => p.rel === e)) continue;
      picked.push({ slot: 'extras', rel: e });
    }
  }
  return picked.slice(0, Math.max(0, max));
}

/* ------------------------------------------------------------------ 服务 */

export function createVaultService({ cfg: injectedCfg } = {}) {
  const getCfg = () => injectedCfg ?? loadConfig();

  function cardFile(card) {
    return { ...card, images: normalizeImages(card.images), refPolicy: normalizeRefPolicy(card.refPolicy) };
  }

  async function list({ q = '' } = {}) {
    const all = await cardsStore(getCfg()).list();
    const kw = String(q).trim().toLowerCase();
    const filtered = kw
      ? all.filter((c) => [c.name, c.description, ...(c.aliases ?? []), ...(c.traits ?? [])]
        .filter(Boolean).join(' ').toLowerCase().includes(kw))
      : all;
    // 按创建时间正序：**创建早的排在前面**。
    //
    // 为什么不用 updatedAt 倒序：这个顺序会直接决定 `cardIds` 的排列，
    // 而 `cardIds` 的顺序又决定参考图提交顺序 → 决定提示词里的 <Picture N>。
    // 用 updatedAt 倒序的后果：
    //   · 后创建的角色卡排在前面，抢到 <Picture 1>
    //   · 用户只要编辑过某张卡，它就会跳到最前，编号**静默改变**
    //     （同一个镜头，改个错别字就可能让两个角色的编号互换）
    // 改为 createdAt 正序后，编号只与创建先后有关，编辑不会打乱。
    return filtered
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(enrich);
  }

  /** 附上"这张卡会用哪几张图"，前端可直接展示 */
  function enrich(card) {
    const picked = cardImagesFor(card);
    return {
      ...card,
      resolvedImages: picked,
      imageCount: picked.length,
    };
  }

  async function get(id) {
    const card = await cardsStore(getCfg()).get(safeId(id, /^card_[A-Za-z0-9]+$/));
    return card ? enrich(card) : null;
  }

  async function upsert(input = {}) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('CARD_NAME_REQUIRED');

    const store = cardsStore(getCfg());
    let existing = null;
    if (input.id) existing = await store.get(safeId(input.id, /^card_[A-Za-z0-9]+$/));

    const now = Date.now();
    const card = cardFile({
      ...(existing ?? {}),
      ...(input.id ? { id: input.id } : {}),
      name,
      aliases: normalizeStringList(input.aliases ?? existing?.aliases),
      description: String(input.description ?? existing?.description ?? '').trim(),
      traits: normalizeStringList(input.traits ?? existing?.traits),
      personality: String(input.personality ?? existing?.personality ?? '').trim(),
      voiceDesc: String(input.voiceDesc ?? existing?.voiceDesc ?? '').trim(),
      images: input.images ?? existing?.images ?? {},
      refPolicy: input.refPolicy ?? existing?.refPolicy ?? DEFAULT_REF_POLICY,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    // 图片必须是 dataDir 内可解析的 rel
    for (const slot of CARD_IMAGE_SLOTS) {
      for (const rel of card.images[slot.id]) {
        try { safeJoin(getCfg().dataDir, rel); } catch { throw new Error(`FORBIDDEN_PATH: ${rel}`); }
      }
    }

    return enrich(await store.upsert(card));
  }

  async function remove(id) {
    const safe = safeId(id, /^card_[A-Za-z0-9]+$/);
    await cardsStore(getCfg()).remove(safe);
    return { ok: true, removed: safe };
  }

  /**
   * 计算某个镜头会带哪些参考图与文字。
   *
   * 这是本模块最关键的函数：**在生成前**就把预算算清楚，
   * 让用户看得到"会传几张、分别是哪张、有没有被裁掉"。
   *
   * @param {object} opts
   * @param {string[]} opts.cardIds    选中的角色卡
   * @param {string[]} [opts.extraImages] 其他参考图（场景/道具/手动）
   * @param {number} [opts.firstLastCount] 首尾帧占用张数（0-2）
   */
  async function plan({ cardIds = [], extraImages = [], firstLastCount = 0 } = {}) {
    const cards = [];
    for (const id of cardIds) {
      const c = await get(id).catch(() => null);
      if (!c) continue;
      cards.push(c);
    }

    const picked = [];       // { source, cardId, cardName, slot, rel }
    const warnings = [];

    for (const c of cards) {
      for (const img of c.resolvedImages) {
        picked.push({ source: 'character-card', cardId: c.id, cardName: c.name, slot: img.slot, rel: img.rel });
      }
    }

    // 首尾帧优先级高于场景/道具
    const reserved = Math.max(0, Math.min(2, Number(firstLastCount) || 0));
    const budget = H3_MAX_REF_IMAGES - reserved;

    if (budget < 0) {
      warnings.push(`首尾帧占用 ${reserved} 张，已超出上限 ${H3_MAX_REF_IMAGES}`);
    }

    // 超限裁剪：先砍多余角色图（保留设定卡），再砍额外图
    let kept = picked.slice();
    if (kept.length > budget) {
      // 设定卡优先保留
      const isSheet = (x) => x.slot === 'sheet';
      kept.sort((a, b) => (isSheet(b) ? 1 : 0) - (isSheet(a) ? 1 : 0));
      const dropped = kept.splice(budget);
      warnings.push(
        `角色参考图超出预算 ${H3_MAX_REF_IMAGES - reserved} 张，已裁剪 ${dropped.length} 张：`
        + dropped.map((d) => `${d.cardName}/${d.slot}`).join('、'),
      );
    }

    const extraKept = [];
    for (const rel of extraImages) {
      if (kept.length + extraKept.length + reserved >= H3_MAX_REF_IMAGES) {
        warnings.push(`额外参考图超出预算，已忽略：${rel}`);
        continue;
      }
      extraKept.push(rel);
    }

    const total = kept.length + extraKept.length + reserved;
    if (total > H3_MAX_REF_IMAGES) {
      warnings.push(`参考图合计 ${total} 张，超过 H3 上限 ${H3_MAX_REF_IMAGES}`);
    }

    return {
      ok: total <= H3_MAX_REF_IMAGES,
      limit: H3_MAX_REF_IMAGES,
      reserved,
      used: kept.length + extraKept.length,
      total,
      characters: kept,
      extras: extraKept,
      warnings,
      cards: cards.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        traits: c.traits,
        imageCount: c.resolvedImages.length,
      })),
    };
  }

  /**
   * 把角色卡的文字设定拼成提示词里的「主体定义」段。
   *
   * ⚠️ 与"拆解提示词不描述图片"不冲突：
   *    拆解时图是待处理的素材，描述它会干扰；
   *    生成时图是权威形象，用文字**指明「这是谁」「看第几张图」**是必要的。
   *    这里只写身份与编号，不复述像素级外观（那已经由图片本身承载）。
   *
   * @param {Array<{card, pictureIndex}>} entries
   */
  function buildSubjectDefinitions(entries = []) {
    const lines = [];
    for (const { card, pictureIndex } of entries) {
      if (!card) continue;
      const bits = [];
      if (card.description) bits.push(card.description);
      if (card.traits?.length) bits.push(card.traits.join('、'));
      if (card.personality) bits.push(`性格：${card.personality}`);
      const ref = pictureIndex ? `外观以 <Picture ${pictureIndex}> 为准` : '';
      lines.push(`${card.name}：${bits.join('；') || '角色'}${ref ? `。${ref}` : ''}`);
    }
    return lines.join('\n');
  }

  function meta() {
    return {
      slots: CARD_IMAGE_SLOTS,
      refModes: CARD_REF_MODES,
      defaultRefPolicy: DEFAULT_REF_POLICY,
      limits: { maxRefImages: H3_MAX_REF_IMAGES, maxTotalRefs: H3_MAX_TOTAL_REFS },
      dir: vaultDir(getCfg()),
    };
  }

  return { list, get, upsert, remove, plan, meta, buildSubjectDefinitions, cardImagesFor };
}

/* --------------------------------------------------------- 项目 ⇄ 角色卡 */

function projectCardsFile(projectId, cfg = loadConfig()) {
  return path.join(cfg.dataDir, 'projects', safeId(projectId), 'cards.json');
}

export function readProjectCards(projectId, cfg = loadConfig()) {
  try {
    const f = projectCardsFile(projectId, cfg);
    if (!fs.existsSync(f)) return [];
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(j) ? j.filter(Boolean) : [];
  } catch { return []; }
}

export function writeProjectCards(projectId, cardIds, cfg = loadConfig()) {
  const f = projectCardsFile(projectId, cfg);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const clean = [...new Set((cardIds ?? []).filter(Boolean).map(String))];
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf8');
  fs.renameSync(tmp, f);
  return clean;
}
