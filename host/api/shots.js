/**
 * 镜头卡存储 —— host/tools.js 直接 import 的公共 API。
 *
 * 所有写操作走 json-store 的 updateJson（串行队列 + 唯一 tmp 名），
 * 裸 writeFileSync+rename 会让两次并发部分保存互相覆盖。
 */
import fs from 'node:fs';
import path from 'node:path';
import { safeId } from '../security.js';
import { readJson, updateJson } from '../store/json-store.js';
import { dirs, newShot, normalizeActors, normalizeCamera3d, normalizeMode, normalizeProps, validateShot } from '../store/models.js';
import { emit } from './events.js';

/** 参考素材硬上限 —— 与 ref-images.js 的槽位上限一致 */
const MAX_REF_IMAGES = 9;
const MAX_REF_VIDEOS = 3;
const MAX_REF_AUDIOS = 3;

/**
 * 删除项目时清理它名下的运行时数据。
 *
 * 只清理**确定由项目派生**的目录/文件，绝不碰 assets/（素材是用户的资产，
 * 可能被多个项目引用；要删素材请走 /assets/delete）。
 *
 * @returns {{removed:string[], failed:string[]}}
 */
export function cleanupProjectArtifacts(cfg, projectId) {
  const removed = [];
  const failed = [];
  const targets = [
    { label: 'shots', abs: path.join(cfg.dataDir, 'shots', projectId) },
    { label: 'cards', abs: path.join(cfg.dataDir, 'projects', projectId) },
    { label: 'script', abs: path.join(cfg.dataDir, 'script', `${projectId}.json`) },
    { label: 'comic', abs: path.join(cfg.dataDir, 'comic', `${projectId}.json`) },
  ];
  for (const t of targets) {
    try {
      if (!fs.existsSync(t.abs)) continue;
      fs.rmSync(t.abs, { recursive: true, force: true });
      removed.push(t.label);
    } catch (e) {
      failed.push(`${t.label}: ${String(e?.message ?? e)}`);
    }
  }
  return { removed, failed };
}
/**
 * 镜头表文件路径。
 *
 * projectId 必须过 safeId：这里是 `path.join(..., projectId, ...)`，
 * 不校验的话 `../../..` 能跳出 dataDir。REST 路由有校验，但 Agent 工具
 * （studio_shot / studio_director / studio_generate）走的是同一批函数。
 */
function shotsFile(projectId) {
  return path.join(dirs().root, 'shots', safeId(projectId), 'shots.json');
}

export function listShots(projectId) {
  let f;
  try { f = shotsFile(projectId); } catch { return []; }   // 非法 id 当作没有镜头，不抛
  if (!fs.existsSync(f)) return [];
  // 不能 `catch { return [] }`：损坏的 shots.json 被当空数组会让下一次 upsertShot
  // 用空数组重建并覆盖写，用户的镜头卡全部消失。交给 readJson 抛 CORRUPT_JSON。
  const arr = readJson(f, []);
  return Array.isArray(arr) ? arr : [];
}

/**
 * 把一张镜头卡收敛到合法区间并补校验结果。
 *
 * 写入路径（`writeShots` / `upsertShot`）与 `newShot` 必须给出同一套约束 ——
 * 超量的参考视频/音频在生成侧会被 `.slice(0, 3)` 静默丢弃，而提示词里仍写着
 * `<Video 4>`；这里在落盘口就裁到 3，让两者永远不会分叉。
 *
 * @param {object} shot
 * @returns {object}
 */
function normalizeShotRecord(shot) {
  const next = { ...shot };
  const raw = Number(next.durationSec);
  if (Number.isFinite(raw)) next.durationSec = Math.min(15, Math.max(1, raw));
  if (Array.isArray(next.refs?.images)) {
    next.refs = { ...next.refs, images: next.refs.images.filter(Boolean).slice(0, MAX_REF_IMAGES) };
  }
  if (Array.isArray(next.refs?.videos)) {
    next.refs = { ...next.refs, videos: next.refs.videos.filter(Boolean).slice(0, MAX_REF_VIDEOS) };
  }
  if (Array.isArray(next.refs?.audios)) {
    next.refs = { ...next.refs, audios: next.refs.audios.filter(Boolean).slice(0, MAX_REF_AUDIOS) };
  }
  next.validation = validateShot(next);
  return next;
}

/**
 * 整体写回镜头表（原子写 + 串行队列 + 逐条校验）。
 *
 * 以前这里零校验直接整体替换：传输中的非法记录（时长 999、参考视频 9 段、
 * mode 是随便一个字符串）会原样落盘，直到生成时才炸或静默失效。
 */
export function writeShots(projectId, list) {
  const f = shotsFile(projectId);      // 非法 id 在这里抛，调用方必须处理
  const rows = (Array.isArray(list) ? list : []).filter((s) => s && typeof s === 'object');
  const normalized = rows.map((s) => normalizeShotRecord({
    ...s,
    ...(s.mode !== undefined
      ? { mode: normalizeMode(s.mode, { hasRefImages: (s.refs?.images?.length ?? 0) > 0 }) }
      : {}),
    ...(s.actors !== undefined ? { actors: normalizeActors(s.actors) } : {}),
    ...(s.props !== undefined ? { props: normalizeProps(s.props) } : {}),
    ...(s.camera3d !== undefined ? { camera3d: normalizeCamera3d(s.camera3d) } : {}),
  }));
  return updateJson(f, [], () => normalized).then(() => normalized);
}

/**
 * 插入或更新一个镜头卡（**串行 + 原子**）。
 *
 * 读-改-写整体在 updateJson 的队列里完成 —— 两个并发的部分保存
 * 不会各读一份旧数组然后互相覆盖。
 *
 * @returns {Promise<object>} 落盘后的完整记录
 */
export async function upsertShot(projectId, shot) {
  const f = shotsFile(projectId);      // 非法 id 在这里抛

  /**
   * mode / 3D 结构化数据在落盘口归一化（REST 可绕过 newShot 直接传 body.shot）。
   *
   * 只归一化**传了的字段**：部分保存（只改 nanfeng/description）若无条件 normalize
   * actors/props/camera3d，会把这些字段重置成空 —— 把镜头卡写坏。
   */
  const next = {
    ...shot,
    ...(shot.mode !== undefined
      ? { mode: normalizeMode(shot.mode, { hasRefImages: (shot.refs?.images?.length ?? 0) > 0 }) }
      : {}),
    ...(shot.actors !== undefined ? { actors: normalizeActors(shot.actors) } : {}),
    ...(shot.props !== undefined ? { props: normalizeProps(shot.props) } : {}),
    ...(shot.camera3d !== undefined ? { camera3d: normalizeCamera3d(shot.camera3d) } : {}),
    updatedAt: Date.now(),
  };
  if (!next.id) next.id = newShot().id;

  const merged = await updateJson(f, [], (cur) => {
    const list = Array.isArray(cur) ? cur.slice() : [];
    const idx = list.findIndex((s) => s && s.id === next.id);

    /**
     * 先合并出完整记录再校验：部分保存时 next 只有几个字段，直接校验会报假错。
     * 合并语义：显式 null = 清空，undefined = 保持不变（`{ ...old, ...next }`
     * 会用 undefined 覆盖旧值，把 durationSec/ratio/refs 清掉）。
     */
    const mergedShot = idx >= 0 ? { ...list[idx] } : {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined) mergedShot[k] = v;
    }

    // 落到合法区间（避免下游跑炸），警告挂到记录上。
    // 裁剪/校验统一走 normalizeShotRecord，与 writeShots 同源。
    const normalized = normalizeShotRecord(mergedShot);

    if (idx >= 0) list[idx] = normalized;
    else list.push(normalized);
    return list;
  });

  const saved = (Array.isArray(merged) ? merged : []).find((s) => s && s.id === next.id) ?? next;

  // 广播给浏览器：DSH Agent 改了镜头卡 → 网页表单立即可见
  emit({ type: 'shot-updated', projectId, shotId: saved.id });

  // 返回落盘后的完整记录，而不是只含本次改动字段的 next
  return saved;
}
