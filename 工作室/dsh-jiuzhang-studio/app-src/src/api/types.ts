/**
 * API 类型定义 —— 与 host/api/index.js 的路由契约一一对应。
 *
 * 原则：只描述"后端确实返回/接受"的形状，不做乐观扩展。
 * 后端字段来源：host/store/models.js、host/services/*.js、host/api/index.js。
 */

/* ------------------------------- 通用 ------------------------------- */

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export type BackendId = 'h3-local' | 'seedance-cloud' | 'mock';

export type ProjectCategory = 'drama' | 'comic' | 'ecommerce' | 'free' | 'uncategorized';

export type AssetType =
  | 'general' | 'character' | 'character_sheet' | 'scene' | 'item' | 'reference'
  | 'video_segment' | 'voice_tone' | 'shot' | 'control' | 'motion_shot'
  | 'previz' | 'costume' | 'accessory' | 'weapon';

export type AssetKind = 'image' | 'video' | 'audio' | 'model3d' | 'font' | 'doc' | 'other';

export interface ApiError {
  error: string;
  detail?: string;
}

/* ------------------------------- 配置 ------------------------------- */

export interface AppConfig {
  dataDir?: string;
  assetRoot?: string;
  comfyUrl?: string;
  comfyInputDir?: string;
  seedanceEndpoint?: string;
  seedanceModel?: string;
  /** 掩码后为 '***' */
  seedanceApiKey?: string;
  seedanceMock?: boolean;
  defaultBackend?: BackendId;
  defaultProfile?: string;
  maxConcurrentLocal?: number;
  previzPort?: number;
  previzAutoStart?: boolean;
  theme?: string;
  accent?: string;
  locale?: string;
}

/* ------------------------------- 元信息 ------------------------------- */

export interface ProfileSpec {
  backend: BackendId;
  mp: number;
  steps: number;
  cfg: number;
  label: string;
}

export interface H3ModelSlot {
  slot: string;
  label: string;
}

export interface MetaPayload {
  profiles: Record<string, ProfileSpec>;
  h3Slots: H3ModelSlot[];
  assetTypeLabels: Record<string, string>;
  projectCategories: Record<string, string>;
  defaultBackend: BackendId;
  defaultProfile: string;
}

/* ------------------------------- 项目 ------------------------------- */

export interface ProjectSummary {
  id: string;
  name: string;
  category: ProjectCategory;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  rootPath: string;
  description: string;
}

/** 画布节点/连线由 SPA 维护，后端只透传保存，故用宽松形状 */
export interface CanvasNode extends Record<string, unknown> {
  id: string;
  type?: string;
}

export interface CanvasEdge extends Record<string, unknown> {
  id: string;
  source: string;
  target: string;
}

export interface Project extends ProjectSummary {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Record<string, unknown> | null;
  scriptProjectName: string | null;
  scriptProjectDir: string | null;
  comicProjectName: string | null;
  comicProjectDir: string | null;
}

export interface CreateProjectInput {
  name: string;
  category?: ProjectCategory;
  rootPath?: string;
  description?: string;
}

export type ProjectPatch = Partial<
  Pick<
    Project,
    | 'name' | 'category' | 'rootPath' | 'description'
    | 'nodes' | 'edges' | 'viewport' | 'nodeCount'
    | 'scriptProjectName' | 'scriptProjectDir' | 'comicProjectName' | 'comicProjectDir'
  >
>;

/* ------------------------------- 镜头 ------------------------------- */

export interface ShotRefs {
  images: string[];
  videos: string[];
  audios: string[];
}

export interface Shot {
  id: string;
  title: string;
  episodeName: string;
  episodeIndex: number;
  shotIndex: number;
  suffix: string;
  mode: string;
  durationSec: number;
  ratio: string;
  profile: string;
  backend: BackendId;
  style: string;
  description: string;
  camera: string;
  dialogue: string;
  sound: string;
  music: string;
  prompt: string;
  refs: ShotRefs;
  characterRefs: string[];
  sceneRefs: string[];
  itemRefs: string[];
  materialRefs: string[];
  previz: unknown;
  /** 3D 预演：演员（人偶）—— Blender 渲染的输入，无此字段只能用默认两人 */
  actors?: ShotActor[];
  /** 3D 预演：道具（灰盒或导入模型） */
  props?: ShotProp[];
  /** 3D 预演：机位（含关键帧才能渲运镜） */
  camera3d?: ShotCamera3d;
  /** 控制视频（Fun ControlNet） */
  control?: ShotControl | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 演员（人偶）。
 * 坐标系：**(x, y=高度, z=深度)** —— 与预演引擎一致；
 * 转 Blender 的 Z-up 由后端统一处理，前端不用管。
 */
export interface ShotActor {
  name: string;
  heightM: number;
  color: string;
  position: [number, number, number];
  rotationDeg: number;
  action: string;
  startFrame: number;
  durationFrames?: number;
  from?: [number, number, number];
  to?: [number, number, number];
  emotion: string;
  intensity: number;
  /** 导入的 glb/fbx（dataDir 相对路径）；有值时替换程序化人偶 */
  assetRel?: string;
}

export interface ShotProp {
  kind: 'box' | 'cylinder' | 'sphere' | 'wall';
  name: string;
  position: [number, number, number];
  rotationDeg: number;
  scale: [number, number, number];
  color: string;
  assetRel?: string;
}

export interface ShotCamera3d {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  keys?: Array<{
    frame: number;
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
    rollDeg?: number;
  }>;
}

export interface ShotControl {
  type?: string;
  videoRel: string;
  strength: number;
  startPercent: number;
  endPercent: number;
}

export type ShotInput = Partial<Shot>;

export interface ShotValidation {
  ok: boolean;
  warnings: string[];
}

/* ------------------------------- 任务 ------------------------------- */

export interface JobOutput {
  kind?: string;
  path?: string;
  /** 相对 dataDir 的正斜杠路径；优先用它拼读取地址（path 是绝对路径，跨机无效） */
  rel?: string;
  url?: string;
  bytes?: number;
  [k: string]: unknown;
}

export interface Job {
  id: string;
  projectId: string;
  shotId: string;
  backendId: BackendId;
  mode: string;
  status: JobStatus;
  prompt: string;
  params: {
    durationSec?: number;
    ratio?: string;
    profile?: string;
    seed?: number;
    [k: string]: unknown;
  };
  remoteId: string | null;
  outputs: JobOutput[];
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GenerateInput {
  projectId: string;
  shotId: string;
  backend?: BackendId;
  seed?: number;
}

export interface CancelResult {
  ok?: boolean;
  [k: string]: unknown;
}

/* ------------------------------- 资产 ------------------------------- */

export interface Asset {
  id: string;
  projectId: string | null;
  type: AssetType;
  name: string;
  originalName?: string;
  kind: AssetKind;
  rel: string;
  bytes: number;
  tag: string;
  note: string;
  dataJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface AssetQuery {
  type?: AssetType;
  projectId?: string;
}

/* ------------------------------- 监测 ------------------------------- */

export interface HealthState {
  ok?: boolean | string;
  detail?: string;
}

export interface MonitorPayload {
  jobs: {
    total: number;
    running: number;
    queued: number;
    failed: number;
    [k: string]: unknown;
  };
  h3: HealthState;
  seedance: { mode: 'real' | 'mock' };
  /** Blender 预演引擎状态（旧 three.js 引擎已下线） */
  blender: HealthState;
  disk: { freeBytes: number; totalBytes: number } | null;
  updatedAt: number;
}

export interface HealthPayload {
  ok: boolean;
  h3: HealthState;
  seedance: { ok?: boolean | string; detail?: string };
  /** Blender 预演引擎状态（旧 three.js 引擎已下线） */
  blender: HealthState;
}

/* ------------------------------- H3 工坊 ------------------------------ */

export interface H3Dialogue {
  /** 规则引擎解析出的说话人；无前缀台词为 null */
  speaker: string | null;
  text: string;
}

export interface H3Segment {
  index: number;
  scene: string;
  action: string;
  dialogue: H3Dialogue[];
  durationSec: number;
  h3Length: number;
  style: string;
  language: string;
}

export interface H3PromptItem {
  name: string;
  count: number;
  prompt: string;
}

export interface H3AssetHints {
  characters: H3PromptItem[];
  scenes: H3PromptItem[];
  props: H3PromptItem[];
  voices: Array<{ name: string; prompt: string }>;
}

export interface H3ShotPrompt {
  index: number;
  scene: string;
  prompt: string;
  durationSec: number;
  h3Length: number;
}

export interface H3Analysis {
  ok: boolean;
  episode: number;
  source: 'dir' | 'paste';
  aspect: string;
  resolution: { width: number; height: number; mp: number };
  segments: H3Segment[];
  assets: H3AssetHints;
  shotPrompts: H3ShotPrompt[];
  stats: { chars: number; blocks?: number; totalDuration: number };
  warnings: string[];
}

export interface H3AnalyzeInput {
  source: 'dir' | 'paste';
  file?: string;
  text?: string;
  episode: number;
  title?: string;
  language?: string;
  platform?: string;
  style?: string;
  aspect?: string;
  durationMin?: number;
  durationMax?: number;
  profile?: string;
}

export interface H3ImportInput {
  projectId: string;
  analysis?: H3Analysis;
  /** 传了就按这些参数重新分析（仅当前端未持有 analysis 时用） */
  episode?: number;
  source?: 'dir' | 'paste';
  file?: string;
  text?: string;
  [k: string]: unknown;
}

export interface H3ImportSummary {
  created: number;
  characters: number;
  scenes: number;
  props: number;
  voices: number;
  shots: number;
}

export interface H3ImportResult {
  ok: boolean;
  projectId: string;
  episode: number;
  summary: H3ImportSummary;
  items: Array<{ type: AssetType; name: string; dataJson: string }>;
}

export interface H3FilmStatus {
  status: 'idle' | 'running' | 'done' | 'failed';
  progress: number;
  message: string;
  ffmpeg: 'ready' | 'missing';
  output?: string;
  bytes?: number;
  meta?: unknown;
}

export interface H3FilmRenderInput {
  inputs: string[];
  output?: string;
  subtitleFile?: string;
  timeoutSec?: number;
}

/* ------------------------------- 预演 ------------------------------- */

export interface PrevizState {
  ok?: boolean;
  detail?: string;
  [k: string]: unknown;
}

/* ------------------------------ Blender 预演 ------------------------------ */

export interface BlenderHealth {
  ok: boolean;
  available: boolean;
  exe: string;
  modes: string[];
  script: string | null;
  detail: string;
}

export interface BlenderRenderResult {
  ok: boolean;
  mode: string;
  /** PNG 序列目录 */
  dir: string;
  /** 编码后的 mp4 绝对路径 */
  mp4: string;
  /** dataDir 相对路径 —— 可直接填进 shot.control.videoRel */
  rel: string;
  /** .blend 绝对路径（可在桌面 Blender 打开继续调） */
  blend?: string;
  /** .blend 的 dataDir 相对路径 */
  blendRel?: string;
  frames: number;
  seconds: number;
  spec: string;
  blender: string;
  exitCode: number;
}

/* ------------------------------ 分辨率 ------------------------------ */

export interface ResolutionResult {
  width: number;
  height: number;
  mp: number;
}

export interface H3LengthResult {
  length: number;
}

/* ------------------------------- 后处理 ------------------------------ */

export interface TranscodeInput {
  input?: string;
  inputs?: string[];
  output?: string;
  [k: string]: unknown;
}

export interface QcResult {
  [k: string]: unknown;
}

/* ------------------------------ 令牌 ------------------------------ */

export interface TokenPayload {
  token: string;
  /** client.js 注释说明 Host 会注入 origin；若后端未返回则为 undefined */
  origin?: string;
}
