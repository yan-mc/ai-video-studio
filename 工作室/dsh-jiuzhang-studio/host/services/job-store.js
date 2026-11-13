/**
 * 任务存储 —— 独立模块，避免 job-runner 与 models 之间的循环依赖。
 * 走 json-store 的串行队列，修掉"并发写丢字段"。
 */
import path from 'node:path';
import { collectionStore } from '../store/json-store.js';
import { loadConfig } from '../config.js';

/**
 * 走本地 GPU 的后端 —— **单一真源**。
 *
 * 12GB 显存跑不了并行，所以这些后端必须串行（见 job-runner 的并发闸门）。
 * h3-image 与 h3-local 共用同一张卡和同一份文本编码器，漏掉它会：
 *   · 绕过并发闸门 → 视频与图像同时上卡 → OOM
 *   · 取消时不被当作本地后端 → 远端 /interrupt 不发出
 */
export const LOCAL_BACKENDS = new Set(['mock', 'h3-local', 'h3-image']);

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