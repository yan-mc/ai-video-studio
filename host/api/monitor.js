/**
 * 监控快照 —— /monitor 路由的数据源。
 *
 * 从 api/index.js 逐字迁出（原 3021-3044 行）。
 */
import fs from 'node:fs';
import { loadConfig } from '../config.js';
import { blenderStatus } from '../services/blender-service.js';
import * as comfy from '../services/comfy-client.js';
import { runtimeStats } from '../services/job-runner.js';
import { jobs as jobsStore } from '../services/job-store.js';


export async function monitorPayload(ctx) {
  const stats = runtimeStats();
  const allJobs = await jobsStore().list();
  const running = allJobs.filter((j) => j.status === 'running').length;
  const queued = allJobs.filter((j) => j.status === 'queued').length;
  const failed = allJobs.filter((j) => j.status === 'failed').length;
  const cfg = loadConfig();
  const [h3] = await Promise.all([comfy.health(cfg)]);
  return {
    jobs: { total: allJobs.length, running, queued, failed, ...stats },
    h3,
    blender: blenderStatus(),
    disk: diskFree(cfg.dataDir),
    updatedAt: Date.now(),
  };
}

export function diskFree(dir) {
  try {
    const st = fs.statfsSync ? fs.statfsSync(dir) : null;
    if (!st) return null;
    return { freeBytes: Number(st.bfree) * Number(st.bsize), totalBytes: Number(st.blocks) * Number(st.bsize) };
  } catch { return null; }
}
