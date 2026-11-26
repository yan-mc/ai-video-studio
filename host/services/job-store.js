/**
 * 任务存储 —— 独立模块，避免 job-runner 与 models 之间的循环依赖。
 * 走 json-store 的串行队列，修掉"并发写丢字段"。
 */
import path from 'node:path';
import { collectionStore, updateJson } from '../store/json-store.js';
import { loadConfig } from '../config.js';

/**
 * 走本地 GPU 的后端 —— **单一真源**。
 *
 * 12GB 显存跑不了并行，所以这些后端必须串行（见 job-runner 的并发闸门）。
 * h3-image / h3-local / h3-nanfeng 共用同一张卡和同一份文本编码器，漏掉任何一个：
 *   · 会绕过并发闸门 → 视频与图像同时上卡 → OOM
 *   · 取消时不被当作本地后端 → 远端 /interrupt 不发出，GPU 继续空烧
 *
 * 新增任何走本地显卡的后端，**必须**同步加到这里。
 */
export const LOCAL_BACKENDS = new Set(['mock', 'h3-local', 'h3-image', 'h3-nanfeng']);

export function isLocalBackendOf(id) { return LOCAL_BACKENDS.has(String(id || '')); }

function jobsFile() {
  return path.join(loadConfig().dataDir, 'jobs.json');
}

let store = null;
let storeFile = null;

/** 惰性单例：dataDir 可能被改，变化时重建 */
export function jobs() {
  const f = jobsFile();
  if (!store || storeFile !== f) {
    store = collectionStore(f, { prefix: 'job' });
    storeFile = f;
  }
  return store;
}

export function newJob({ projectId, shotId, backendId, prompt, params, mode }) {
  const now = Date.now();
  return {
    id: `job_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    shotId,
    backendId,
    mode: mode || 't2v',
    status: 'queued',
    prompt: prompt || '',
    params: params || {},
    remoteId: null,
    outputs: [],
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 保留策略 —— 只在任务终结时触发，不影响进行中的任务。
 *
 * `jobs.json` 只增不减（每次生成追加 prompt 全文 + 参数快照 + outputs），而 `/jobs`
 * 与 `/monitor` 每次都全量读盘。终态保留最近 MAX_FINISHED 条、未终结的**永不**裁剪、
 * 超过 FINISHED_TTL_MS 的终态也裁掉。500 条按单镜 5 分钟算约 40 小时的实际产出。
 */
const MAX_FINISHED = 500;
const FINISHED_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 天
/** 任务终态集合 —— 全仓唯一真源 */
export const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

/**
 * 裁剪终态任务。返回 { removed } —— **没有可删项时绝不写盘**。
 *
 * 读-算-写必须在同一个 `updateJson` mutator 内完成（先 list 再整体替换会覆盖掉
 * 期间并发落盘的记录）。mutator 返回 `undefined` 表示"不要写"，
 * json-store 据此跳过整份重写 —— jobs.json 500KB+，每次终结都重写太浪费。
 *
 * @returns {Promise<{removed:number}>}
 */
export async function pruneJobs() {
  const file = jobsFile();
  let removed = 0;

  await updateJson(file, [], (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    const now = Date.now();

    const live = [];
    const finished = [];
    for (const j of list) {
      if (!j) continue;
      if (TERMINAL.has(j.status)) finished.push(j);
      else live.push(j);
    }
    if (!finished.length) return undefined;   // 没有终态记录 → 不写盘

    // 新的在前
    finished.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
    const keep = finished.filter((j, i) => {
      if (i >= MAX_FINISHED) return false;
      const at = j.updatedAt ?? j.createdAt ?? 0;
      if (at && now - at > FINISHED_TTL_MS) return false;
      return true;
    });

    removed = list.length - (live.length + keep.length);
    if (removed <= 0) return undefined;       // 无可删项 → 不写盘

    const kept = new Set([...live.map((j) => j?.id), ...keep.map((j) => j?.id)]);
    // 保持原顺序：file 里是什么顺序，写回去就是什么顺序
    return list.filter((j) => j && j.id && kept.has(j.id));
  });

  return { removed };
}