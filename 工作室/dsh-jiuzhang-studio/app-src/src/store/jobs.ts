/** 任务 store —— 任务中心与顶栏任务数共用的数据源 */

import { create } from 'zustand';
import { api } from '../api/client';
import type { Job } from '../api/types';

interface JobsStore {
  jobs: Job[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  /** 上次刷新时间 */
  lastFetchedAt: number;

  loadJobs: (force?: boolean) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;

  /* 派生统计 */
  runningCount: () => number;
  queuedCount: () => number;
  failedCount: () => number;
  activeJobs: () => Job[];
}

export const useJobsStore = create<JobsStore>((set, get) => ({
  jobs: [],
  loaded: false,
  loading: false,
  error: null,
  lastFetchedAt: 0,

  async loadJobs(force = false) {
    if (get().loading) return;
    // 2 秒内的重复请求直接复用，避免多页同时轮询打爆后端
    if (!force && get().loaded && Date.now() - get().lastFetchedAt < 2000) return;
    set({ loading: true });
    try {
      const raw = await api.listJobs();
      const list = Array.isArray(raw) ? raw : [];
      set({ jobs: list, loaded: true, loading: false, error: null, lastFetchedAt: Date.now() });
    } catch (err) {
      set({
        loading: false,
        loaded: true,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async cancelJob(jobId) {
    await api.cancelJob(jobId);
    await get().loadJobs(true);
  },

  async retryJob(jobId) {
    await api.retryJob(jobId);
    await get().loadJobs(true);
  },

  runningCount() {
    return get().jobs.filter((j) => j.status === 'running').length;
  },

  queuedCount() {
    return get().jobs.filter((j) => j.status === 'queued').length;
  },

  failedCount() {
    return get().jobs.filter((j) => j.status === 'failed').length;
  },

  activeJobs() {
    return get().jobs.filter((j) => j.status === 'running' || j.status === 'queued');
  },
}));