/**
 * 镜头卡存储 —— 被 host/tools.js 直接 import 的公共 API。
 *
 * 从 api/index.js 逐字迁出（原 2682-2803 行）。
 *
 * ⚠️ 这里所有写操作都必须走 json-store 的 updateJson（串行队列 + 唯一 tmp 名），
 *    以前裸 writeFileSync+rename 会让两次并发部分保存互相覆盖。
 */
import fs from 'node:fs';
import path from 'node:path';
import { safeId } from '../security.js';
import { readJson, updateJson } from '../store/json-store.js';
import { dirs, newShot, normalizeActors, normalizeCamera3d, normalizeMode, normalizeProps, validateShot } from '../store/models.js';
import { emit } from './events.js';

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
 * ⚠️ projectId 必须过 safeId —— 这里是 `path.join(..., projectId, ...)`，
 *    不校验的话 `../../..` 能跳出 dataDir。REST 路由有校验，但 Agent 工具
 *    （studio_shot / studio_director / studio_generate）是直接调 listShots/upsertShot，
 *    之前完全没校验，`studio_shot { projectId: '../../../../tmp' }` 可写出数据目录。
 */
function shotsFile(projectId) {
  return path.join(dirs().root, 'shots', safeId(projectId), 'shots.json');
}

export function listShots(projectId) {
  let f;
  try { f = shotsFile(projectId); } catch { return []; }   // 非法 id 当作没有镜头，不抛
  if (!fs.existsSync(f)) return [];
  /**
   * ⚠️ 这里**不能** `catch { return [] }`。
   *
   * 历史缺陷（数据丢失级）：shots.json 一旦被截断/断电/手工改坏，这个函数
   * 返回空数组，而 upsertShot 紧接着用这个空数组重建并**覆盖写** ——
   * 用户的全部镜头卡就此消失，且没有 .corrupt 备份。
   *
   * 现在交给 json-store 的 readJson：解析失败会保留 .corrupt 副本并抛
   * `CORRUPT_JSON`，调用方据此报错而不是把数据静默抹掉。
   * `file` 不存在 / 空文件仍是正常情况（返回 []）。
   */
  const arr = readJson(f, []);
  return Array.isArray(arr) ? arr : [];
}

/**
 * 整体写回镜头表（原子写 + 串行队列）。
 *
 * ⚠️ 以前这里是裸 `writeFileSync(tmp) + renameSync`，tmp 名是
 *    `${f}.${pid}.tmp` —— **同进程两次并发写用同一个 tmp 路径**，
 *    后写会覆盖先写的 tmp，再各自 rename，结果一方改动丢失。
 *    网页自动保存（800ms debounce）与 Agent 的 studio_shot save
 *    同时发生就能复现。
 *
 * 现在统一走 json-store 的 updateJson（每文件一条 Promise 队列 + 唯一 tmp 名）。
 */
export function writeShots(projectId, list) {
  const f = shotsFile(projectId);      // 非法 id 在这里抛，调用方必须处理
  return updateJson(f, [], () => list).then(() => list);
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
   * mode 归一化统一放在**落盘口**：
   *   REST 可以直接传 body.shot（绕过 newShot），工具也走这里，
   *   只在 newShot 里归一化覆盖不到这些路径。
   *
   * ⚠️ 只归一化**传了的字段**。以前无条件对 actors/props/camera3d 做
   *    normalize，部分保存（只改 nanfeng/description）会把这些字段
   *    重置成空数组/null，把镜头卡写坏。
   */
  const next = {
    ...shot,
    ...(shot.mode !== undefined
      ? { mode: normalizeMode(shot.mode, { hasRefImages: (shot.refs?.images?.length ?? 0) > 0 }) }
      : {}),
    // 3D 预演结构化数据同样在落盘口收敛 —— 这三个字段决定 Blender 渲什么，
    // 形状错了整镜渲不出来（且错误信息会很难懂）。
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
     * 先合并出**完整记录**，再校验。
     *
     * ⚠️ 顺序很重要：
     *    1) 部分保存时 next 只有几个字段，直接校验必然报"时长缺失"等假错
     *    2) 校验和夹取要作用在合并后的完整记录上，写盘后才是合法的镜头卡
     *
     * 合并语义：显式传 null 表示"清空"，不传（undefined）表示"保持不变"。
     * 直接 `{ ...old, ...next }` 会用 undefined 覆盖旧值 —— 只改 nanfeng
     * 的部分保存会把 durationSec/ratio/refs 全清掉，把镜头卡写坏。
     */
    const mergedShot = idx >= 0 ? { ...list[idx] } : {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined) mergedShot[k] = v;
    }

    // 落到合法区间（避免下游跑炸），警告挂到记录上
    const raw = Number(mergedShot.durationSec);
    if (Number.isFinite(raw)) mergedShot.durationSec = Math.min(15, Math.max(1, raw));
    if (Array.isArray(mergedShot.refs?.images) && mergedShot.refs.images.length > 9) {
      mergedShot.refs = { ...mergedShot.refs, images: mergedShot.refs.images.slice(0, 9) };
    }
    mergedShot.validation = validateShot(mergedShot);

    if (idx >= 0) list[idx] = mergedShot;
    else list.push(mergedShot);
    return list;
  });

  const saved = (Array.isArray(merged) ? merged : []).find((s) => s && s.id === next.id) ?? next;

  // 广播给浏览器：DSH Agent 改了镜头卡 → 网页表单立即可见
  emit({ type: 'shot-updated', projectId, shotId: saved.id });

  // 返回落盘后的完整记录，而不是只含本次改动字段的 next
  return saved;
}
