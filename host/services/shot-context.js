/**
 * 生成入参准备 —— REST 与 Agent 工具的单一真源。
 *
 * 职责：
 *   1) `withVaultCards`   解析镜头绑定的角色卡 + 参考视频/音频（含探测结果回写）
 *   2) `resolveMediaRefs` 视频/音频解析与编号（> /render/plan、/render/compile、/generate 共用）
 *   3) `resolvePictureIndices` 角色卡 → `<Picture N>` 的**唯一**换算入口，
 *      与真实提交同源（`planImageSlots` 的 `pictureIndexMap`）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { safeJoin } from '../security.js';
import { readProjectCards } from './character-vault.js';
import { resolveRefImages, resolvePrevizArtifacts, planImageSlots } from './ref-images.js';
import { probeMedia } from './media-probe.js';

/**
 * 解析请求体里的视频/音频引用（probe 补全 hasAudio / 时长）。
 *
 * `/render/plan`、`/render/compile`、`/generate` 三处共用这一份，
 * 否则三个入口会对同一输入给出不同编号与不同 hasAudio。
 *
 * @param {object} ctx  插件运行时（需要 ctx.assets 做探测结果回写）
 * @param {object} cfg
 * @param {Array} rawVideos
 * @param {Array} rawAudios
 */
export async function resolveMediaRefs(ctx, cfg, rawVideos = [], rawAudios = []) {
  const resolveRel = (item) => {
    if (!item) return '';
    const rel = typeof item === 'string' ? item : (item.rel ?? '');
    if (!rel) return '';
    try { return safeJoin(cfg.dataDir, rel); } catch { return ''; }
  };

  const videos = [];
  for (const v of (Array.isArray(rawVideos) ? rawVideos : [])) {
    const abs = resolveRel(v);
    if (!abs || !fs.existsSync(abs)) continue;
    const rel = typeof v === 'string' ? v : (v.rel ?? '');
    const explicit = typeof v === 'object' && typeof v.hasAudio === 'boolean' ? v.hasAudio : null;

    const probe = await probeMedia(abs, cfg).catch(() => null);

    // hasAudio 必须靠探测：给无音轨的视频硬接一个空 ref_video_audios，
    // 模型收到的是「有音轨但为空」，比不接更差且不报错。调用方显式指定时以它为准。
    const hasAudio = explicit === null
      ? Boolean(probe?.ok && probe.hasAudio)
      : explicit;

    if (probe?.ok) await writeBackProbe(ctx, cfg, rel, probe);

    videos.push({
      index: videos.length + 1,
      abs,
      rel,
      name: (typeof v === 'object' && v.name) || path.basename(rel),
      hasAudio,
      durationSec: probe?.durationSec ?? null,
    });
  }

  const audios = [];
  for (const a of (Array.isArray(rawAudios) ? rawAudios : [])) {
    const abs = resolveRel(a);
    if (!abs || !fs.existsSync(abs)) continue;
    const rel = typeof a === 'string' ? a : (a.rel ?? '');
    const probe = await probeMedia(abs, cfg).catch(() => null);
    if (probe?.ok) await writeBackProbe(ctx, cfg, rel, probe);
    audios.push({
      index: audios.length + 1,
      abs,
      rel,
      name: (typeof a === 'object' && a.name) || path.basename(rel),
      durationSec: probe?.durationSec ?? null,
    });
  }

  return { videos, audios };
}

/**
 * 探测结果回写素材库记录（外部放入 / 画布归档的素材上传时没探测过）。
 * 只在真有变化时写，失败静默 —— 探测信息是增强，不是生成的前置条件。
 */
export async function writeBackProbe(ctx, cfg, rel, probe) {
  if (!probe?.ok || !rel) return;
  try {
    const all = await ctx.assets.list();
    const hit = all.find((a) => a.rel === rel);
    if (!hit) return;
    const next = {
      ...hit,
      hasAudio: probe.hasAudio,
      durationSec: probe.durationSec,
      mediaWidth: probe.width,
      mediaHeight: probe.height,
      fps: probe.fps,
    };
    const same = hit.hasAudio === next.hasAudio
      && hit.durationSec === next.durationSec
      && hit.mediaWidth === next.mediaWidth
      && hit.mediaHeight === next.mediaHeight
      && hit.fps === next.fps;
    if (same) return;
    await ctx.assets.upsertRaw(next);
  } catch { /* 回写失败不影响生成 */ }
}

/**
 * 把镜头要用的素材解析完整：角色卡 + 参考视频 + 参考音频。
 *
 * 三类素材编号互相耦合（视频自带音轨会占用 `<Audio>` 序号），
 * 必须由同一处解析，否则提示词里的 `<Video N>`/`<Audio J>` 与实物错位。
 *
 * 输入形态（shot 上的字段，均为 rel 或资产 id）：
 *   cardIds     → 角色卡 id
 *   refs.videos → [{ rel|assetId, name, hasAudio }]
 *   refs.audios → [{ rel|assetId, name }]
 */
export async function withVaultCards(shot, projectId, ctx, cfg = loadConfig()) {
  const out = { ...shot, characterCards: [] };
  try {
    const projectCards = readProjectCards(projectId, cfg);
    const shotCards = Array.isArray(shot.cardIds) ? shot.cardIds : [];
    const ids = [...new Set([...shotCards, ...projectCards])];
    if (ids.length) {
      const cards = [];
      for (const id of ids) {
        const c = await ctx.vault.get(id).catch(() => null);
        if (c) cards.push(c);
      }
      // 按 createdAt 正序，与 vault.list() 的展示顺序一致 ——
      // 页面看到的名次与 <Subject N>/<Picture N> 的归属必须对得上，否则排障会误判成编号错位。
      cards.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      out.characterCards = cards;
    }
    const media = await resolveMediaRefs(ctx, cfg, shot?.refs?.videos ?? [], shot?.refs?.audios ?? []);
    out.videos = media.videos;
    out.audios = media.audios;
  } catch {
    /* 保底：至少保证字段存在 */
  }
  return out;
}

/**
 * 角色卡 → `<Picture N>` 的**唯一**换算入口。
 *
 * 编号来自 `planImageSlots` 的 `pictureIndexMap`（与真实提交用的是同一次调用、
 * 同一份参考图清单、同一组首尾帧），因此与
 * `generator.runH3Nanfeng`、`render-plan.buildRenderPlan` 三处永远一致。
 *
 * 参考图清单顺序（`resolveRefImages`）：角色卡 → 人设卡 → 手工图 → 场景/道具；
 * 首尾帧**不在清单里**，它们由 `planImageSlots` 单独占用 `图片1`/`图片2`。
 * 因此绝不能拿"参考图数组下标 +1"当编号 —— i2va/fl2va 下会整体差 1–2，
 * 表现为模型把首帧当角色（串脸，且不报错）。
 *
 * @param {object} shot   已含 characterCards 的镜头（`withVaultCards` 的产物）
 * @param {object} [cfg]
 * @returns {Array<{id,name,pictureIndex,allPictures,traits,personality,voiceDesc,description,hasImage}>}
 */
export function resolvePictureIndices(shot, cfg = loadConfig()) {
  const cards = Array.isArray(shot?.characterCards) ? shot.characterCards : [];
  if (!cards.length) return [];

  let refs = [];
  try { refs = resolveRefImages(shot ?? {}, cfg); } catch { refs = []; }
  if (!refs.length) {
    return cards.map((c) => ({
      id: c.id,
      name: c.name ?? '角色',
      pictureIndex: null,
      allPictures: [],
      traits: Array.isArray(c.traits) ? c.traits.join('、') : (c.traits ?? ''),
      personality: c.personality ?? '',
      voiceDesc: c.voiceDesc ?? '',
      description: c.description ?? '',
      hasImage: false,
    }));
  }

  let previz = {};
  try { previz = resolvePrevizArtifacts(shot ?? {}, cfg); } catch { previz = {}; }
  /** 与提交端同一次槽位规划：首尾帧会占用 图片1/图片2 */
  const slots = planImageSlots(
    shot?.mode,
    refs.map((r) => r.abs),
    previz['{{FIRST_FRAME}}'] ?? '',
    previz['{{LAST_FRAME}}'] ?? '',
  );

  const byCard = new Map();
  refs.forEach((r, i) => {
    if (!r.cardId) return;
    const n = slots.pictureIndexMap.get(i);
    if (n == null) return;                    // 槽位不足被丢弃的图不算编号
    if (!byCard.has(r.cardId)) byCard.set(r.cardId, []);
    byCard.get(r.cardId).push(n);
  });

  return cards.map((c) => {
    const picks = byCard.get(c.id) ?? [];
    return {
      id: c.id,
      name: c.name ?? '角色',
      pictureIndex: picks.length ? picks[0] : null,
      allPictures: picks,
      traits: Array.isArray(c.traits) ? c.traits.join('、') : (c.traits ?? ''),
      personality: c.personality ?? '',
      voiceDesc: c.voiceDesc ?? '',
      description: c.description ?? '',
      hasImage: picks.length > 0,
    };
  });
}
