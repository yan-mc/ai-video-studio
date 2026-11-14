/** 项目 + 元信息 store —— 全站共享的"当前项目"与后端下发的常量表 */

import { create } from 'zustand';
import { api } from '../api/client';
import type {
  AppConfig,
  Asset,
  AssetType,
  BackendId,
  CreateProjectInput,
  H3ModelSlot,
  MetaPayload,
  ProfileSpec,
  ProjectPatch,
  ProjectSummary,
} from '../api/types';

export interface MetaState {
  profiles: Record<string, ProfileSpec>;
  h3Slots: H3ModelSlot[];
  assetTypeLabels: Record<string, string>;
  projectCategories: Record<string, string>;
  defaultBackend: BackendId;
  defaultProfile: string;
}

interface ProjectStore {
  /* 元信息 */
  meta: MetaState | null;
  metaLoaded: boolean;
  metaError: string | null;

  /* 配置 */
  config: AppConfig | null;
  configLoaded: boolean;
  configError: string | null;

  /* 项目 */
  projects: ProjectSummary[];
  projectsLoaded: boolean;
  projectsLoading: boolean;
  projectsError: string | null;
  currentProjectId: string | null;

  /* 资产（素材库页共用，避免每页各拉一次） */
  assets: Asset[];
  assetsLoaded: boolean;
  assetsLoading: boolean;
  assetsError: string | null;

  /* actions */
  loadMeta: () => Promise<void>;
  loadConfig: () => Promise<void>;
  saveConfig: (patch: Partial<AppConfig>) => Promise<AppConfig>;
  loadProjects: (force?: boolean) => Promise<void>;
  selectProject: (id: string | null) => void;
  createProject: (input: CreateProjectInput) => Promise<ProjectSummary>;
  updateProject: (id: string, patch: ProjectPatch) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadAssets: (query?: { type?: AssetType; projectId?: string }) => Promise<void>;

  /* 派生工具 */
  currentProject: () => ProjectSummary | null;
  profileOptions: () => Array<{ value: string; label: string }>;
  assetTypeOptions: () => Array<{ value: string; label: string }>;
  categoryOptions: () => Array<{ value: string; label: string }>;
}

const EMPTY_META: MetaState = {
  profiles: {},
  h3Slots: [],
  assetTypeLabels: {},
  projectCategories: {},
  defaultBackend: 'h3-local',
  defaultProfile: 'P12-draft',
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  meta: null,
  metaLoaded: false,
  metaError: null,

  config: null,
  configLoaded: false,
  configError: null,

  projects: [],
  projectsLoaded: false,
  projectsLoading: false,
  projectsError: null,
  currentProjectId: null,

  assets: [],
  assetsLoaded: false,
  assetsLoading: false,
  assetsError: null,

  async loadMeta() {
    if (get().metaLoaded) return;
    try {
      const payload: MetaPayload = await api.meta();
      if (!payload || typeof payload !== 'object') throw new Error('meta 响应格式不正确');
      set({
        meta: {
          profiles: payload.profiles ?? {},
          h3Slots: payload.h3Slots ?? [],
          assetTypeLabels: payload.assetTypeLabels ?? {},
          projectCategories: payload.projectCategories ?? {},
          defaultBackend: payload.defaultBackend ?? 'h3-local',
          defaultProfile: payload.defaultProfile ?? 'P12-draft',
        },
        metaLoaded: true,
        metaError: null,
      });
    } catch (err) {
      set({ metaLoaded: true, metaError: err instanceof Error ? err.message : String(err) });
    }
  },

  async loadConfig() {
    try {
      const cfg = await api.getConfig();
      set({ config: cfg, configLoaded: true, configError: null });
    } catch (err) {
      set({
        configLoaded: true,
        configError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async saveConfig(patch) {
    const next = await api.saveConfig(patch);
    set({ config: next, configLoaded: true, configError: null });
    return next;
  },

  async loadProjects(force = false) {
    if (get().projectsLoading) return;
    if (get().projectsLoaded && !force) return;
    set({ projectsLoading: true });
    try {
      const raw = await api.listProjects();
      const list = Array.isArray(raw) ? raw : [];
      set((state) => {
        // 选择规则：
        //  1) 当前项目仍存在 → 保持；
        //  2) 当前选择为空 → 自动选最近更新的项目（与参考实现"打开即有画布"一致）；
        //  3) 当前项目已被删除 → 退回自动选择。
        const stillExists =
          state.currentProjectId !== null && list.some((p) => p.id === state.currentProjectId);
        const fallback = list.length > 0 ? list[0]?.id ?? null : null;
        return {
          projects: list,
          projectsLoaded: true,
          projectsLoading: false,
          projectsError: null,
          currentProjectId: stillExists ? state.currentProjectId : fallback,
        };
      });
    } catch (err) {
      set({
        projectsLoading: false,
        projectsLoaded: true,
        projectsError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  selectProject(id) {
    set({ currentProjectId: id });
  },

  async createProject(input) {
    const created = await api.createProject(input);
    set((state) => ({
      projects: [created, ...state.projects],
      projectsLoaded: true,
      currentProjectId: created.id,
    }));
    return created;
  },

  async updateProject(id, patch) {
    const updated = await api.updateProject(id, patch);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    }));
  },

  async deleteProject(id) {
    await api.deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
    }));
  },

  async loadAssets(query) {
    set({ assetsLoading: true });
    try {
      const rawList = await api.listAssets(query ?? {});
      const list = Array.isArray(rawList) ? rawList : [];
      set({ assets: list, assetsLoaded: true, assetsLoading: false, assetsError: null });
    } catch (err) {
      set({
        assetsLoading: false,
        assetsLoaded: true,
        assetsError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  currentProject() {
    const { projects, currentProjectId } = get();
    if (!currentProjectId) return null;
    return projects.find((p) => p.id === currentProjectId) ?? null;
  },

  profileOptions() {
    const profiles = get().meta?.profiles ?? {};
    return Object.entries(profiles).map(([value, spec]) => ({
      value,
      label: spec.label ? `${value} · ${spec.label}` : value,
    }));
  },

  assetTypeOptions() {
    const labels = get().meta?.assetTypeLabels ?? {};
    return Object.entries(labels).map(([value, label]) => ({ value, label }));
  },

  categoryOptions() {
    const labels = get().meta?.projectCategories ?? {};
    return Object.entries(labels).map(([value, label]) => ({ value, label }));
  },
}));

export { EMPTY_META };