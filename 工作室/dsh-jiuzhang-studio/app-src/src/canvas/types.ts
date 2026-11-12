/**
 * 画布数据类型 —— 节点 data / 参数 schema / 节点定义。
 *
 * 设计原则：
 *  1. **节点全部是受控展示组件**：不 fetch、不读全局 store，只认 props。
 *     数据流由 CanvasArea 统一处理（React Flow 的 nodes/edges 就是唯一真源）。
 *  2. 节点参数走 **schema 驱动**（ParamField[]）：参数面板、默认值、序列化三处
 *     复用同一份声明，加一个参数不用改三个地方。
 *  3. `data` 必须能原样 JSON 序列化后存进后端 `projects.json` 的 nodes 字段，
 *     所以只允许 string/number/boolean/数组/普通对象。
 */
import type { Node } from '@xyflow/react';
import type { NodeTypeKey } from './nodeKeys';
import type { PortKind } from './portTypes';

/* ========================================================================== */
/* 一、节点运行时数据                                                          */
/* ========================================================================== */

/** 节点执行状态（与任务中心的状态对齐，但节点粒度更粗） */
export type NodeRunStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';

/** 结果节点子类型 —— 与后端 RESULT_KINDS 对齐 */
export type ResultKind =
  | 'generic'
  | 'storyboardGenOutput'
  | 'storyboardSplitExport'
  | 'storyboardFrameEdit'
  | 'videoGeneratorOutput';

/** 节点产物（结果节点 / 预览区用） */
export interface NodeResult {
  /** 图片/视频/音频 URL（相对或绝对） */
  url?: string;
  /** 文本产物（AI 文本、注释） */
  text?: string;
  /** 本地文件路径（后端产物） */
  path?: string;
  /** 缩略图 */
  thumb?: string;
  /** 视频尾帧（可继承给下一镜） */
  lastFrameUrl?: string;
  /** 远端任务 id（视频/图片异步任务） */
  taskId?: string;
  /** 生成耗时（毫秒） */
  elapsedMs?: number;
}

/**
 * 画布节点 data。
 *
 * 注意必须带 index signature：React Flow 的 `Node<T>` 要求
 * `T extends Record<string, unknown>`。这不是偷懒，是库的类型约束。
 */
export interface CanvasNodeData extends Record<string, unknown> {
  /** 用户自定义标题；空则用节点类型默认名 */
  title?: string;
  /** 一句话备注（节点底部灰字） */
  note?: string;
  /** 执行状态 */
  status?: NodeRunStatus;
  /** 0..1 进度（running 时显示进度条） */
  progress?: number;
  /** 失败原因 */
  error?: string;
  /** 参数（键由 ParamField[] 声明） */
  params?: Record<string, unknown>;
  /** 产物 */
  result?: NodeResult;
  /** 结果节点子类型 */
  resultKind?: ResultKind;
  /** 文本注释节点的 Markdown 正文 */
  markdown?: string;
  /** 分组节点的颜色档（token 名，不存 hex） */
  tone?: CanvasTone;
  /** 折叠参数区 */
  collapsed?: boolean;
  /** 节点宽度/高度是否被用户手动改过（groupNode 用） */
  customSize?: boolean;
}

/** 颜色档 —— 映射到 CSS 变量，**不存 hex**，主题切换自动跟随 */
export type CanvasTone = 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export const CANVAS_TONES: ReadonlyArray<{ value: CanvasTone; label: string }> = [
  { value: 'accent', label: '强调' },
  { value: 'ok', label: '绿' },
  { value: 'warn', label: '黄' },
  { value: 'danger', label: '红' },
  { value: 'info', label: '青' },
  { value: 'neutral', label: '中性' },
];

/** 画布节点（React Flow Node 的窄化别名） */
export type CanvasFlowNode = Node<CanvasNodeData>;

/* ========================================================================== */
/* 二、参数 schema                                                             */
/* ========================================================================== */

interface ParamBase {
  /** 参数键，存在 data.params 里 */
  key: string;
  /** 中文标签 */
  label: string;
  /** 右下角提示 */
  hint?: string;
  /** 该参数是否在折叠时隐藏（默认 true） */
  hideWhenCollapsed?: boolean;
  /** 只读（由上游算出来的值） */
  readOnly?: boolean;
}

export interface TextParam extends ParamBase {
  kind: 'textarea';
  placeholder?: string;
  rows?: number;
  /** 等宽字体（JSON / 路径） */
  mono?: boolean;
  default?: string;
}

export interface InputParam extends ParamBase {
  kind: 'input';
  placeholder?: string;
  mono?: boolean;
  default?: string;
}

export interface NumberParam extends ParamBase {
  kind: 'number';
  min?: number;
  max?: number;
  step?: number;
  /** 单位后缀 */
  suffix?: string;
  default?: number;
}

export interface SelectParam extends ParamBase {
  kind: 'select';
  options: ReadonlyArray<{ value: string; label: string }>;
  default?: string;
}

export interface SwitchParam extends ParamBase {
  kind: 'switch';
  default?: boolean;
}

export interface RangeParam extends ParamBase {
  kind: 'range';
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  default?: number;
}

/** 字符串列表（参考图 URL、四向导出方向等） */
export interface ListParam extends ParamBase {
  kind: 'list';
  placeholder?: string;
  /** 列表项最大数量 */
  max?: number;
  default?: string[];
}

/**
 * 五段流 —— videoGeneratorNode 专属。
 * 段数 = 镜头数 1~5，每段有提示词 + 可选起点图。
 */
export interface SegmentsParam extends ParamBase {
  kind: 'segments';
  /** 最少/最多段数 */
  min: number;
  max: number;
  default?: VideoSegmentParam[];
}

export interface VideoSegmentParam {
  /** 段序号，1 起 */
  index: number;
  /** 本段提示词 */
  prompt: string;
  /** 起点图 URL（第 2 段起可继承上一段尾帧） */
  startImage?: string;
  /** 本段时长（秒） */
  durationSec?: number;
}

export type ParamField =
  | TextParam
  | InputParam
  | NumberParam
  | SelectParam
  | SwitchParam
  | RangeParam
  | ListParam
  | SegmentsParam;

/* ========================================================================== */
/* 三、节点定义                                                                */
/* ========================================================================== */

/** 节点分组（决定调色板与右键菜单的分节顺序） */
export const NODE_CATEGORIES = [
  'upload',
  'generate',
  'extract',
  'storyboard',
  'panorama',
  'studio',
  'result',
  'structure',
] as const;

export type NodeCategory = (typeof NODE_CATEGORIES)[number];

export const NODE_CATEGORY_LABELS: Readonly<Record<NodeCategory, string>> = {
  upload: '上传导入',
  generate: 'AI 生成',
  extract: '结构化提取',
  storyboard: '分镜',
  panorama: '全景',
  studio: '3D 工作台',
  result: '结果',
  structure: '画布辅助',
};

/** 节点定义（注册表条目） */
export interface NodeDefinition {
  /** type key —— 必须与后端 NODE_TYPES 完全一致 */
  type: NodeTypeKey;
  /** 默认标题（= 后端 NODE_LABELS） */
  label: string;
  /** 短标签（窄节点/菜单里用） */
  shortLabel: string;
  /** 图标名（来自设计系统 Icon） */
  icon: SparkIconName;
  /** 分组 */
  category: NodeCategory;
  /** 一句话功能说明（调色板 tooltip / 空节点提示） */
  description: string;
  /** 默认尺寸 */
  size: { width: number; height: number };
  /** 是否允许用户改尺寸（分组节点必须） */
  resizable?: boolean;
  /** 参数面板字段 */
  fields: ParamField[];
  /** 节点主色调（tone token） */
  tone: CanvasTone;
  /** 能力标记：会发起异步任务 / 会产出可预览产物 / 需要外部模型 */
  capabilities?: {
    /** 会调后端生成接口 */
    generative?: boolean;
    /** 有预览区 */
    preview?: boolean;
    /** 依赖外部模型/引擎（未配置时降级提示） */
    needsBackend?: boolean;
    /** 需要上传本地文件 */
    fileInput?: boolean;
  };
}

/** Icon 名联合（避免 types.ts 依赖 ui 组件文件造成循环，这里只声明用到的子集） */
export type SparkIconName =
  | 'canvas'
  | 'assets'
  | 'projects'
  | 'h3'
  | 'settings'
  | 'jobs'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'trash'
  | 'check'
  | 'close'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronLeft'
  | 'play'
  | 'stop'
  | 'upload'
  | 'download'
  | 'folder'
  | 'file'
  | 'image'
  | 'video'
  | 'audio'
  | 'cube'
  | 'text'
  | 'sun'
  | 'moon'
  | 'palette'
  | 'alert'
  | 'info'
  | 'spark'
  | 'layers'
  | 'grid'
  | 'list'
  | 'external'
  | 'copy'
  | 'eye'
  | 'clock'
  | 'zap';

/* ========================================================================== */
/* 四、参数读写辅助（节点组件里高频使用，集中在这里避免各写一份）                 */
/* ========================================================================== */

/** 取字符串参数 */
export function paramStr(params: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const v = params?.[key];
  return typeof v === 'string' ? v : fallback;
}

/** 取数字参数 */
export function paramNum(params: Record<string, unknown> | undefined, key: string, fallback = 0): number {
  const v = params?.[key];
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 取布尔参数 */
export function paramBool(params: Record<string, unknown> | undefined, key: string, fallback = false): boolean {
  const v = params?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

/** 取字符串数组参数 */
export function paramList(params: Record<string, unknown> | undefined, key: string): string[] {
  const v = params?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** 取五段流参数（做结构校验，脏数据不会让组件崩） */
export function paramSegments(
  params: Record<string, unknown> | undefined,
  key: string,
  fallback: VideoSegmentParam[],
): VideoSegmentParam[] {
  const v = params?.[key];
  if (!Array.isArray(v) || v.length === 0) return fallback;
  const out: VideoSegmentParam[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const raw = v[i];
    if (raw === null || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    out.push({
      index: i + 1,
      prompt: typeof rec.prompt === 'string' ? rec.prompt : '',
      startImage: typeof rec.startImage === 'string' ? rec.startImage : undefined,
      durationSec: typeof rec.durationSec === 'number' ? rec.durationSec : undefined,
    });
  }
  return out.length > 0 ? out : fallback;
}

/* ========================================================================== */
/* 五、连线数据结构                                                            */
/* ========================================================================== */

/** 端口类型 → 连线颜色变量名（避免 hex） */
export const PORT_KIND_VARS: Readonly<Record<PortKind, string>> = {
  text: '--jz-info-text',
  image: '--jz-accent-text',
  video: '--jz-warn-text',
  audio: '--jz-ok-text',
  asset: '--jz-text-secondary',
  pose: '--jz-info-text',
  panorama: '--jz-accent-text',
  none: '--jz-text-faint',
};