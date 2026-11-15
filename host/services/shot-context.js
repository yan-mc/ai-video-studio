/**
 * 生成入参准备 —— **REST 与 Agent 工具的单一真源**。
 *
 * 解决什么问题：
 *   `services/generator.js` 已经把「执行器」统一了（runH3Local / runH3ImageLocal），
 *   但「入参准备」还没统一：
 *     - POST /jiuzhang/api/generate  会调 withVaultCards（解析项目/镜头绑定的角色卡、
 *       探测参考视频音频），然后 compilePrompt
 *     - studio_generate 工具       直接 compilePrompt(shot) → 角色卡完全丢失
 *   结果是同一个镜头，页面点渲染和让 AI 生成，产物不一样。
 *   generator.js 顶部注释骂过"两份实现导致漂移"，执行器修好了，入参没修。
 *
 * 另外 `pictureIndex` 的编号也在这里统一（见 resolvePictureIndices）：
 *   参考图的真实顺序由 `resolveRefImages` 决定（卡图 → 人设卡 → 手工图 → 场景图），
 *   而编译器曾经用"这是第几张卡"当编号。有卡没图 / 有手工图时编号就整体错位，
 *   提示词里的 <Picture N> 指向错误的图 —— 表现为"角色串脸"且不报错。
 *   这里从**真实的参考图清单**反推每张卡占哪些编号，保证两边永远一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { safeJoin } from '../security.js';
import { readProjectCards } from './character-vault.js';
import { resolveRefImages } from './generator.js';
import { probeMedia } from './media-probe.js';

/**
 * 解析请求体里的视频/音频引用（probe 补全 hasAudio / 时长）。
 *
 * ⚠️ `/render/plan`、`/render/compile`、`/generate` 三处都必须用这一份逻辑。
 *    之前 plan/compile 各自直接读 body.videos，没做探测，导致：
 *      - 预览说"有音轨"，实际生成时按探测结果又变成"无音轨"；
 *      - 两个入口对同一份输入给出不同的编号。
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

    // 无论调用方有没有给 hasAudio，都要探测 —— 时长、分辨率这些信息总要拿到，
    // 而且探测结果要回写素材库（见 writeBackProbe）。
    const probe = await probeMedia(abs, cfg).catch(() => null);

    // ⚠️ hasAudio 必须**探测**，不能默认 true。
    //    给无音轨的视频硬接一个空 ref_video_audios，模型会收到"有音轨但是空的"，
    //    效果比不接更差，而且不会报错（静默降级）。
    //    调用方显式指定时以调用方为准（比如用户手动关掉"带上音轨"）。
    const hasAudio = explicit === null
      ? Boolean(probe?.ok && probe.hasAudio)
      : explicit;

    // 外部放进来/归档的素材可能没有探测信息，顺手补上
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
 * 探测结果回写素材库记录。
 *
 * 场景：素材是外部放进来 / 从画布产物归档的，上传时没探测过。
 * 生成时探测到了真实信息，顺手写回，下次读素材库就能直接看到。
 *
 * 只在**有变化**时写，避免每次生成都刷一遍 assets-index.json。
 * 失败静默 —— 探测信息是增强，不是必需。
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
    // 没有实质变化就不写
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
 * 为什么放在一处：这三类都来自「素材库/角色卡仓库」，且**编号互相耦合**
 * （视频自带音轨会占用 <Audio> 序号，见 docs/H3参考输入契约.md）。
 * 由同一处解析，保证编号一致。
 *
 * 输入形态（shot 上的字段，均为 rel 或资产 id）：
 *   cardIds   → 角色卡 id
 *   refs.videos → [{ rel|assetId, name, hasAudio }]
 *   refs.audios → [{ rel|assetId, name }]
 */
export async function withVaultCards(shot, projectId, ctx, cfg = loadConfig()) {
  const out = { ...shot, characterCards: [] };
  try {
    // ---- 角色卡 ----
    const projectCards = readProjectCards(projectId, cfg);
    const shotCards = Array.isArray(shot.cardIds) ? shot.cardIds : [];
    const ids = [...new Set([...shotCards, ...projectCards])];
    if (ids.length) {
      const cards = [];
      for (const id of ids) {
        const c = await ctx.vault.get(id).catch(() => null);
        if (c) cards.push(c);
      }
      out.characterCards = cards;
    }
    // ---- 视频 / 音频 ----
    // 与 /render/plan、/render/compile 共用**同一份**解析逻辑，
    // 否则三个入口会对同一输入给出不同编号（踩过）。
    const media = await resolveMediaRefs(ctx, cfg, shot?.refs?.videos ?? [], shot?.refs?.audios ?? []);
    out.videos = media.videos;
    out.audios = media.audios;
  } catch {
    /* 保底：至少保证字段存在 */
  }
  return out;
}

/**
 * 从**真实的参考图清单**反推每张角色卡占用的 <Picture N>。
 *
 * 为什么必须这样做：
 *   编号的正确依据是「图片在最终提交顺序里的位置」，而提交顺序由
 *   `resolveRefImages()` 决定：
 *      0. 角色卡（按卡序，每卡按其 refPolicy 出图）
 *      1. characterRefs（人设卡）
 *      2. 手工参考图
 *      3. 场景 / 道具
 *   只要某张卡没图、或有手工图插进来，"第几张卡"就不再等于"第几张图"。
 *
 * @param {object} shot   已含 characterCards 的镜头
 * @param {object} cfg
 * @returns {Array<{id,name,pictureIndex,allPictures,traits,personality,voiceDesc,description,hasImage}>}
 */
export function resolvePictureIndices(shot, cfg = loadConfig()) {
  const cards = Array.isArray(shot?.characterCards) ? shot.characterCards : [];
  if (!cards.length) return [];

  // 用与生成时**完全相同**的函数取图，保证顺序一致
  let refs = [];
  try { refs = resolveRefImages({ ...shot, characterRefs: [], sceneRefs: [], itemRefs: [] }, cfg); } catch { refs = []; }

  const byCard = new Map();
  refs.forEach((r, i) => {
    if (!r.cardId) return;
    if (!byCard.has(r.cardId)) byCard.set(r.cardId, []);
    byCard.get(r.cardId).push(i + 1);   // 1-based
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
