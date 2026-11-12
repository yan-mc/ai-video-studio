/** UI store —— 导航、侧栏、监测器轮询等纯界面状态（不持久化到后端） */

import { create } from 'zustand';
import { api } from '../api/client';
import type { HealthPayload, MonitorPayload } from '../api/types';

export type NavKey = 'canvas' | 'assets' | 'projects' | 'h3' | 'settings' | 'jobs';

interface UiStore {
  /* 侧栏 */
  navCollapsed: boolean;
  toggleNav: () => void;
  setNavCollapsed: (v: boolean) => void;

  /* 监测器 */
  monitor: MonitorPayload | null;
  health: HealthPayload | null;
  monitorError: string | null;
  monitorLoading: boolean;
  /** 轮询是否启用（页面隐藏时暂停） */
  monitorEnabled: boolean;
  setMonitorEnabled: (v: boolean) => void;
  refreshMonitor: () => Promise<void>;
  refreshHealth: () => Promise<void>;

  /* H3 工坊的临时输入状态放 store，切页不丢（大文本不适合放 URL） */
  h3Draft: {
    source: 'dir' | 'paste';
    dir: string;
    text: string;
    episode: number;
    title: string;
    style: string;
    platform: string;
    language: string;
    aspect: string;
    durationMin: number;
    durationMax: number;
    profile: string;
  };
  patchH3Draft: (patch: Partial<UiStore['h3Draft']>) => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  navCollapsed: false,
  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setNavCollapsed: (v) => set({ navCollapsed: v }),

  monitor: null,
  health: null,
  monitorError: null,
  monitorLoading: false,
  monitorEnabled: true,

  setMonitorEnabled(v) {
    set({ monitorEnabled: v });
  },

  async refreshMonitor() {
    if (get().monitorLoading) return;
    set({ monitorLoading: true });
    try {
      const payload = await api.monitor();
      set({ monitor: payload, monitorError: null, monitorLoading: false });
    } catch (err) {
      set({
        monitorError: err instanceof Error ? err.message : String(err),
        monitorLoading: false,
      });
    }
  },

  async refreshHealth() {
    try {
      const payload = await api.health();
      set({ health: payload });
    } catch {
      set({ health: null });
    }
  },

  h3Draft: {
    source: 'paste',
    dir: '',
    text: '',
    episode: 1,
    title: '',
    style: '',
    platform: '',
    language: 'zh',
    aspect: '16:9',
    durationMin: 4,
    durationMax: 10,
    profile: 'P24-quality',
  },

  patchH3Draft(patch) {
    set((s) => ({ h3Draft: { ...s.h3Draft, ...patch } }));
  },
}));