/**
 * API 类型定义 —— 与 host/api/index.js 的路由契约一一对应。
 *
 * 原则：只描述"后端确实返回/接受"的形状，不做乐观扩展。
 * 后端字段来源：host/store/models.js、host/services/*.js、host/api/index.js。
 */

/* ------------------------------- 通用 ------------------------------- */

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

/**
 * 生成后端。
 *
 * ⚠️ 必须与 host 侧的 `VALID_BACKENDS`（host/api/index.js）逐项一致。
 * 历史缺陷：这里漏了 `h3-nanfeng`，而它正是 config 的默认后端 ——
 * 设置页的 <Select value="h3-nanfeng"> 找不到匹配 option，下拉直接显示空白，
 * 用户也无法从 UI 选回默认后端。
 */
export type BackendId = 'h3-nanfeng' | 'h3-local' | 'h3-image' | 'mock';

/** 后端的展示名。新增后端时同步这里与 VALID_BACKENDS。 */
export const BACKEND_LABELS: ReadonlyArray<{ value: BackendId; label: string }> = [
  { value: 'h3-nanfeng', label: '南风 V15（推荐）' },
  { value: 'h3-local', label: 'H3 本地（旧模板路径）' },
  { value: 'h3-image', label: 'H3 图像' },
  { value: 'mock', label: 'Mock（占位片，仅测试）' },
];

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
  defaultBackend?: BackendId;
  defaultProfile?: string;
  maxConcurrentLocal?: number;
  /** H3 加速方案 id（dmad8 / dmad4 / none） */
  accelPlan?: string;
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
  /**
   * 画风 / 打光 id。
   *
   * 这两个是**正交通道**，由提示词编译器消费（不是南风参数）。
   * host/store/models.js 一直在存它们，但这里的类型以前没写，
   * 导致渲染页只能靠 `as never` 硬塞 —— 一旦字段名写错编译器也不报。
   */
  styleId?: string;
  lightingId?: string;
  /**
   * 加速方案 id（dmad8 / dmad4 / none），覆盖全局 config.accelPlan。
   *
   * 注意与 `backend` 区分：backend 是"用哪条出片管线"，
   * accelPlan 是"这条管线里挂哪个蒸馏 LoRA、跑几步"。
   */
  accelPlan?: string;
  /** 南风预设与单镜参数覆盖 */
  nanfeng?: ShotNanfeng;
  /** 3D 预演：演员（人偶）—— Blender 渲染的输入，无此字段只能用默认两人 */
  actors?: ShotActor[];
  /** 3D 预演：道具（灰盒或导入模型） */
  props?: ShotProp[];
  /** 3D 预演：机位（含关键帧才能渲运镜） */
  camera3d?: ShotCamera3d;
  createdAt: number;
  updatedAt: number;
}

/** 镜头卡里的南风 V15 配置 */
export interface ShotNanfeng {
  /** 预设 id，或 { inherit, overrides } / { chain: [...] } */
  presets?: string | { inherit?: string; chain?: string[]; overrides?: Record<string, unknown> };
  /** 单镜参数覆盖（221 个南风参数里的任意子集，最高优先级） */
  overrides?: Record<string, unknown>;
  /**
   * 这个镜头要挂的语义 LoRA（加速学生由 `accelPlan` 决定，不在这里）。
   *
   * 生成时后端会跑 `solveLoraStack`：单选类只留一个、多挂类按 stackDecay 衰减、
   * 总强度超阈值会告警或剔除。所以这里存的是**用户意图**，
   * 实际生效值看 `job.params.loraStack`。
   */
  loras?: Array<{ name: string; strength?: number }>;
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
  /**
   * 加速方案（可选）。留空 = 用镜头卡 / 全局默认。
   * 取值见 AccelPlan.id（dmad8 / dmad4 / none）。
   */
  accelPlan?: string;
  /** 覆盖步数（一般不传；偏离训练步数后端会告警） */
  steps?: number;
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
  /** Blender 预演引擎状态（旧 three.js 引擎已下线） */
  blender: HealthState;
  disk: { freeBytes: number; totalBytes: number } | null;
  updatedAt: number;
}

export interface HealthPayload {
  ok: boolean;
  h3: HealthState;
  /** Blender 预演引擎状态（旧 three.js 引擎已下线） */
  blender: HealthState;
  /** 加速方案（蒸馏 LoRA）。见 host/services/accel-plan.js */
  accel?: {
    current: string;
    plans: AccelPlan[];
  };
}

/**
 * ComfyUI 进程状态（顶栏启停按钮）。
 *
 * `running` 以「端口是否真的能连上」为准，不是靠进程名猜 ——
 * 机器上可能有多个 python，也可能用户在别的终端起了一个。
 */
export interface ComfyStatus {
  ok?: boolean;
  running: boolean;
  port: number;
  url: string;
  /** ai-runtime 目录；为空表示找不到 start-h3.ps1，界面上应禁用启停 */
  runtimeDir: string;
  canControl: boolean;
  detail: string;
}

export interface ComfyControlResult {
  ok: boolean;
  detail: string;
  alreadyRunning?: boolean;
  alreadyStopped?: boolean;
  port?: number;
  pid?: number;
  phase?: 'stop' | 'start';
}

/**
 * 本机 Qwen3-VL（llama.cpp）服务状态。
 *
 * 与 `ComfyStatus` 并列但**独立**：它服务于 DSH 的 `qwen3vl` provider，
 * 不是本插件的生成后端。放在同一个界面只因为两者抢同一张 12GB 显卡。
 */
export interface QwenStatus {
  ok?: boolean;
  running: boolean;
  port: number;
  url: string;
  /** ai-runtime 目录；为空表示找不到 start-qwen3vl.ps1，应禁用启停 */
  runtimeDir: string;
  canControl: boolean;
  /** 主模型文件名（GGUF） */
  model: string | null;
  /** 服务端实际分配的上下文长度 */
  nCtx: number | null;
  /** ComfyUI 是否同时在跑 —— 两者不能共存，用于界面警告 */
  comfyRunning: boolean;
  detail: string;
}

export interface QwenControlResult {
  ok: boolean;
  detail: string;
  status?: QwenStatus;
}

/**
 * 加速方案选项。
 *
 * 每个方案对应一组 (LoRA, 采样器, 调度器, 步数, shift)，
 * 由后端 accel-plan.js 单一真源给出，前端只负责展示与选择。
 */
export interface AccelPlan {
  id: string;
  label: string;
  /** dmad / none */
  family: string;
  steps: number;
  sampler: string;
  scheduler: string;
  /** 例：{ video: '12/2' }；none 方案为 null */
  shift: { video: string } | null;
  hint: string;
  isDefault: boolean;
}

/* -------------------------------- LoRA -------------------------------- */

/**
 * LoRA 分类。
 *
 * `mode` 决定前端的选择器形态：
 *   single → 每类只能选 1 个（换选时自动替换）
 *   multi  → 可多选，但按 `stackDecay` 递减强度
 *
 * `signed` 为真表示滑块类：0 = 不生效，正负是反方向，范围可能是 -5..5。
 */
export interface LoraCategory {
  folder: string;
  id: string;
  label: string;
  mode: 'single' | 'multi';
  strength: { def: number; min: number; max: number; step: number };
  stackDecay: number;
  signed?: boolean;
  defaultOnSelect?: number;
  why: string;
}

/** 一个装在 ComfyUI `models/loras` 里的文件（`name` 含子目录前缀） */
export interface LoraItem {
  name: string;
  base: string;
  folder: string;
  categoryId: string;
  categoryLabel: string;
  mode: 'single' | 'multi';
  /** folder = 按子目录判定；name = 按文件名推断；fallback = 未分类 */
  categorySource: 'folder' | 'name' | 'fallback';
}

/** 一条被接受的 LoRA（含衰减后的实际强度） */
export interface LoraAccepted {
  name: string;
  base: string;
  folder: string;
  categoryId: string;
  categoryLabel: string;
  mode: 'single' | 'multi';
  signed: boolean;
  userStrength: number | null;
  /** 求解后真正提交的强度 */
  appliedStrength: number;
  role: 'accelerator' | 'semantic';
}

export interface LoraSolveResult {
  ok: boolean;
  accepted: LoraAccepted[];
  rejected: Array<{ name: string; reason: string }>;
  replaced: Array<{ name: string; by: string; category: string }>;
  degraded: Array<{ name: string; from: number; to: number; reason: string }>;
  /** 不含加速学生的强度总和 */
  totalStrength: number;
  warnings: string[];
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
  /** 参考视频通道（blockout）—— 喂 Ref2VA 的 ref_videos，无需额外模型 */
  referenceModes?: string[];
  /** 人眼预览（preview）—— 不参与生成 */
  previewModes?: string[];
  /** 推荐路线 id（当前是 'blockout'） */
  recommended?: string;
  /** 两条路线的说明，供 UI 直接渲染 */
  routes?: Array<{
    id: string;
    name: string;
    mode: string;
    needsExtraModel: boolean;
    description: string;
  }>;
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
  /** 产物用途 —— 决定它该填到镜头卡的哪个字段 */
  usage?: 'control' | 'reference' | 'preview' | 'unknown';
  /** 后端给的一句话说明「该填到哪」 */
  hint?: string;
  /**
   * true = 镜头卡没配 actors，渲染用的是"两人对峙"占位人偶。
   *
   * 占位人偶会被 H3 当成参考视频里的真实主体，输出里真的多出两个人。
   * 前端必须警告并阻止直接使用。
   */
  derived?: boolean;
  /** 渲染警告（当前只有占位人偶一种） */
  warnings?: string[];
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
