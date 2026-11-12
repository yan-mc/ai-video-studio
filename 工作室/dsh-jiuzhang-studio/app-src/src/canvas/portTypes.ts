/**
 * 端口类型系统 —— 26 种节点的连线语义（本任务的核心）。
 *
 * 为什么需要它：
 *   洛书的官方行为是「从某个输出口拖线到空白处，右键菜单**只列出能连上的节点**」。
 *   要做到这一点，光有 React Flow 的 handle 不够——必须知道每个端口"是什么类型"，
 *   并且有一张明确的兼容矩阵。否则只能全列 26 种，用户体验立刻退化。
 *
 * 设计要点：
 *   1. PortKind 只有 8 个值，刻意保持粗粒度：再细就会变成"模型能力"而不是"数据类型"，
 *      26 个节点之间的组合会爆炸，用户反而看不懂。
 *   2. 兼容关系以 **目标端口** 为主键（ACCEPTS）："image 端口接受哪些来源"是一句人话，
 *      而"image 来源能进哪些端口"要反查，容易写错。反向查询由 compatibleTargetKinds 提供。
 *   3. 兼容 ≠ 可连。同节点自连、环、重复边属于**图结构约束**，由 CanvasArea 层判断；
 *      本模块只回答"类型对不对"，保证纯函数、可在 node 里直接单测。
 *
 * 本文件零依赖（不 import react / @xyflow），所以能被 node 直接 type-strip 后 import 做单测。
 */

/* ========================================================================== */
/* 一、类型                                                                    */
/* ========================================================================== */

/** 端口数据类型 */
export const PORT_KINDS = [
  'text',
  'image',
  'video',
  'audio',
  'asset',
  'pose',
  'panorama',
  'none',
] as const;

export type PortKind = (typeof PORT_KINDS)[number];

/** 单个端口描述 */
export interface PortSpec {
  /** React Flow handle id —— 节点内唯一，跨节点不要求唯一 */
  id: string;
  kind: PortKind;
  /** 端口名（hover 提示 / 连线处的细字） */
  label: string;
  /** 可选：端口在节点上的排布槽位（同槽位的端口竖排） */
  slot?: number;
}

/** 节点端口表 */
export interface NodePortSpec {
  inputs: PortSpec[];
  outputs: PortSpec[];
}

/** 连线方向 */
export type PortDirection = 'in' | 'out';

/* ========================================================================== */
/* 二、兼容矩阵                                                                */
/* ========================================================================== */

/**
 * ACCEPTS[target] = 允许的 source 列表。
 *
 * 读法：「目标端口 target 能接住哪些类型的上游产物」。
 * 所有规则都写了理由，因为这张表是产品行为，不是实现细节。
 */
export const ACCEPTS: Readonly<Record<PortKind, readonly PortKind[]>> = Object.freeze({
  // 文本只能接文本：AI 文本节点吃的是提示词/剧本，不是图片
  text: ['text'],

  // 图片端口接受：
  //   image    —— 常规图片
  //   panorama —— 全景图本身就是一张 equirect 图片，可直接当素材用（洛书里全景图能进图片轨道）
  //   asset    —— 角色/场景/道具提取产出的资产条目**自带代表图**，可当参考图喂下游
  //   pose     —— 姿势台导出的姿势渲染图
  image: ['image', 'panorama', 'asset', 'pose'],

  // 视频端口只接视频。图片→视频要靠 videoGeneratorNode 的「首帧」输入口，
  // 那是显式的模式参数，不做隐式转换（否则用户会以为任何图都能直接进成片轨）。
  video: ['video'],

  // 音频端口只接音频
  audio: ['audio'],

  // 资产端口只接资产：只有提取类节点产出资产，下游是导演台/白模预演的"选角"输入
  asset: ['asset'],

  // 姿势端口只接姿势：姿势是带骨架语义的结构数据，不能把位图当姿势。
  // 「用一张角色图摆姿势」走的是姿势台节点的 in:image（角色图）口，两个口分开，
  // 这样落线语义清晰：图像进 image 口，骨架进 pose 口。
  pose: ['pose'],

  // 全景端口接受：
  //   panorama —— 全景图生成 / 全景图 A 的产物
  //   image    —— 任意 equirect 图片可以直接进查看器（用户自己拼的全景）
  panorama: ['panorama', 'image'],

  // none 是"无端口"的哨兵：标注/分组节点，任何东西都不接
  none: [],
});

/** 端口类型的中文名（UI 上显示，避免英文枚举泄漏到界面） */
export const PORT_KIND_LABELS: Readonly<Record<PortKind, string>> = Object.freeze({
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  asset: '资产',
  pose: '姿势',
  panorama: '全景',
  none: '无',
});

/* ========================================================================== */
/* 三、核心判定                                                                */
/* ========================================================================== */

/**
 * **这是全模块最重要的函数**：源端口类型能否接到目标端口类型。
 *
 * 纯函数、无副作用、无外部依赖 —— 单测直接打这里。
 * 注意：'none' 永远连不上（包括 none→none），因为"无端口"不是一个数据类型。
 */
export function isConnectable(source: PortKind, target: PortKind): boolean {
  if (source === 'none' || target === 'none') return false;
  const allowed = ACCEPTS[target];
  if (!allowed) return false;
  return allowed.includes(source);
}

/** 带原因的判定 —— 用于拖线时的提示文案，比布尔值更好排查 */
export interface ConnectVerdict {
  ok: boolean;
  /** 人话原因；ok 时给出"可连"的简短说明 */
  reason: string;
}

export function explainConnect(source: PortKind, target: PortKind): ConnectVerdict {
  if (source === 'none') return { ok: false, reason: '该节点没有输出端口' };
  if (target === 'none') return { ok: false, reason: '该节点没有输入端口' };
  if (isConnectable(source, target)) {
    return {
      ok: true,
      reason: `${PORT_KIND_LABELS[source]} → ${PORT_KIND_LABELS[target]} 可连接`,
    };
  }
  return {
    ok: false,
    reason: `${PORT_KIND_LABELS[target]} 端口不接受${PORT_KIND_LABELS[source]}`,
  };
}

/** 某个源类型能进哪些目标端口类型（反查矩阵） */
export function compatibleTargetKinds(source: PortKind): PortKind[] {
  if (source === 'none') return [];
  return PORT_KINDS.filter((k) => isConnectable(source, k));
}

/** 某个目标端口类型能接哪些源类型（正查矩阵） */
export function compatibleSourceKinds(target: PortKind): PortKind[] {
  if (target === 'none') return [];
  return (ACCEPTS[target] ?? []).slice();
}

/* ========================================================================== */
/* 四、26 节点的端口声明                                                        */
/* ========================================================================== */

/**
 * 端口 id 命名约定：`in:<语义>` / `out:<语义>`。
 * 用语义而不是序号，是为了让保存下来的画布 JSON 可读、可迁移
 * （将来加端口时不会因为序号位移把老连线接到错的口上）。
 */
function port(id: string, kind: PortKind, label: string, slot?: number): PortSpec {
  return slot === undefined ? { id, kind, label } : { id, kind, label, slot };
}

/** 无端口的节点（标注 / 分组） */
const NO_PORTS: NodePortSpec = { inputs: [], outputs: [] };

export const NODE_PORTS: Readonly<Record<string, NodePortSpec>> = Object.freeze({
  /* ------------------------------ 本地来源 ------------------------------ */
  uploadNode: {
    inputs: [],
    outputs: [port('out:image', 'image', '图片')],
  },
  audioUploadNode: {
    inputs: [],
    outputs: [port('out:audio', 'audio', '音频')],
  },
  uploadVideoNode: {
    inputs: [],
    outputs: [port('out:video', 'video', '视频')],
  },

  /* -------------------------------- 生成 -------------------------------- */
  // 智能体：图片分析 → 提示词 → 生成图/视频（报告 §4.1）
  agentGenNode: {
    inputs: [
      port('in:image', 'image', '参考图', 0),
      port('in:video', 'video', '参考视频', 1),
      port('in:text', 'text', '提示词', 2),
    ],
    outputs: [
      port('out:text', 'text', '提示词', 0),
      port('out:image', 'image', '图片', 1),
      port('out:video', 'video', '视频', 2),
    ],
  },
  // AI 图片：提示词/参考图/模型/尺寸/比例/清晰度
  imageNode: {
    inputs: [
      port('in:text', 'text', '提示词', 0),
      port('in:image', 'image', '参考图', 1),
    ],
    outputs: [port('out:image', 'image', '图片')],
  },
  aiTextNode: {
    inputs: [port('in:text', 'text', '输入')],
    outputs: [port('out:text', 'text', '文本')],
  },

  /* -------------------------------- 音色 -------------------------------- */
  aiVoiceGenerationNode: {
    inputs: [port('in:text', 'text', '台词')],
    outputs: [port('out:audio', 'audio', '音频')],
  },
  extractVoiceNode: {
    inputs: [
      port('in:text', 'text', '剧本', 0),
      port('in:audio', 'audio', '已有音频', 1),
    ],
    outputs: [
      port('out:asset', 'asset', '音色资产', 0),
      port('out:audio', 'audio', '音频', 1),
    ],
  },

  /* ----------------------------- 结构化提取 ----------------------------- */
  extractCharacterNode: {
    inputs: [
      port('in:text', 'text', '剧本', 0),
      port('in:image', 'image', '参考图', 1),
    ],
    outputs: [
      port('out:asset', 'asset', '角色资产', 0),
      port('out:image', 'image', '角色图', 1),
    ],
  },
  extractSceneNode: {
    inputs: [
      port('in:text', 'text', '剧本', 0),
      port('in:image', 'image', '参考图', 1),
    ],
    outputs: [
      port('out:asset', 'asset', '场景资产', 0),
      port('out:image', 'image', '场景图', 1),
    ],
  },
  extractItemNode: {
    inputs: [
      port('in:text', 'text', '剧本', 0),
      port('in:image', 'image', '参考图', 1),
    ],
    outputs: [
      port('out:asset', 'asset', '道具资产', 0),
      port('out:image', 'image', '道具图', 1),
    ],
  },

  /* -------------------------------- 结果 -------------------------------- */
  // 结果节点是回流的：既能显示结果，也能把结果继续往下游递（洛书的"结果回流"）
  exportImageNode: {
    inputs: [port('in:image', 'image', '结果图')],
    outputs: [port('out:image', 'image', '图片')],
  },
  exportVideoNode: {
    inputs: [port('in:video', 'video', '结果视频')],
    outputs: [port('out:video', 'video', '视频')],
  },

  /* ------------------------------ 画布辅助 ------------------------------ */
  textAnnotationNode: NO_PORTS,
  groupNode: NO_PORTS,

  /* -------------------------------- 分镜 -------------------------------- */
  // 切割结果：分镜切割 / 导出分镜 / 合并 / 单格编辑
  storyboardNode: {
    inputs: [port('in:image', 'image', '分镜图')],
    outputs: [port('out:image', 'image', '单格')],
  },
  // 分镜生成：按行×列生成分镜网格
  storyboardGenNode: {
    inputs: [
      port('in:text', 'text', '提示词', 0),
      port('in:image', 'image', '参考图', 1),
    ],
    outputs: [port('out:image', 'image', '分镜图')],
  },

  /* --------------------------- 视频（最复杂） --------------------------- */
  videoGeneratorNode: {
    inputs: [
      port('in:text', 'text', '提示词', 0),
      port('in:firstFrame', 'image', '首帧', 1),
      port('in:lastFrame', 'image', '尾帧', 1),
      port('in:refImage', 'image', '参考图', 2),
      port('in:refVideo', 'video', '参考视频', 3),
      port('in:audio', 'audio', '配音', 4),
    ],
    outputs: [
      port('out:video', 'video', '视频', 0),
      port('out:lastFrame', 'image', '尾帧', 1),
    ],
  },

  /* -------------------------------- 全景 -------------------------------- */
  vr360PanoramaNode: {
    inputs: [port('in:panorama', 'panorama', '全景图')],
    outputs: [
      port('out:panorama', 'panorama', '全景', 0),
      port('out:image', 'image', '四向截图', 1),
    ],
  },
  panoramaViewerBNode: {
    inputs: [port('in:panorama', 'panorama', '全景图')],
    outputs: [port('out:image', 'image', '四视图')],
  },
  panoramaNode: {
    inputs: [
      port('in:image', 'image', '参考图', 0),
      port('in:text', 'text', '提示词', 1),
    ],
    outputs: [port('out:panorama', 'panorama', '全景图')],
  },

  /* ----------------------------- 剧集 / 音乐 ---------------------------- */
  episodeSubCanvasNode: {
    inputs: [
      port('in:text', 'text', '镜头表', 0),
      port('in:image', 'image', '参考图', 1),
      port('in:video', 'video', '尾帧来源', 2),
    ],
    outputs: [
      port('out:video', 'video', '成片', 0),
      port('out:image', 'image', '尾帧', 1),
    ],
  },
  backgroundMusicNode: {
    inputs: [port('in:text', 'text', '剧本')],
    outputs: [port('out:audio', 'audio', '音乐')],
  },

  /* --------------------------------- 3D --------------------------------- */
  blueprintNode: {
    inputs: [
      port('in:asset', 'asset', '角色/场景资产', 0),
      port('in:text', 'text', '走位说明', 1),
    ],
    outputs: [
      port('out:image', 'image', '截图', 0),
      port('out:pose', 'pose', '站位姿势', 1),
    ],
  },
  previzNode: {
    inputs: [
      port('in:asset', 'asset', '资产', 0),
      port('in:pose', 'pose', '姿势', 1),
      port('in:text', 'text', '场景说明', 2),
    ],
    outputs: [
      port('out:image', 'image', '关键帧', 0),
      port('out:video', 'video', '预演视频', 1),
    ],
  },
  poseStudioNode: {
    inputs: [
      port('in:pose', 'pose', '姿势', 0),
      port('in:image', 'image', '角色图', 1),
    ],
    outputs: [
      port('out:pose', 'pose', '姿势', 0),
      port('out:image', 'image', '姿势图', 1),
    ],
  },
});

/* ========================================================================== */
/* 五、查询辅助                                                                */
/* ========================================================================== */

/** 取节点端口表；未知 type 退回"无端口"（脏数据不炸画布） */
export function portsOf(nodeType: string): NodePortSpec {
  return NODE_PORTS[nodeType] ?? NO_PORTS;
}

/** 节点的全部输出类型（去重，保持声明顺序） */
export function outputKindsOf(nodeType: string): PortKind[] {
  return uniqueKinds(portsOf(nodeType).outputs);
}

/** 节点的全部输入类型（去重，保持声明顺序） */
export function inputKindsOf(nodeType: string): PortKind[] {
  return uniqueKinds(portsOf(nodeType).inputs);
}

function uniqueKinds(ports: PortSpec[]): PortKind[] {
  const out: PortKind[] = [];
  for (const p of ports) {
    if (!out.includes(p.kind)) out.push(p.kind);
  }
  return out;
}

/** 按 handle id 找端口；handleId 为空时退回该方向第一个端口（RF 单端口节点会给 null） */
export function findPort(
  nodeType: string,
  handleId: string | null | undefined,
  direction: PortDirection,
): PortSpec | null {
  const spec = portsOf(nodeType);
  const list = direction === 'out' ? spec.outputs : spec.inputs;
  if (list.length === 0) return null;
  if (handleId === null || handleId === undefined || handleId === '') return list[0] ?? null;
  return list.find((p) => p.id === handleId) ?? null;
}

/** 端口类型；找不到返回 'none' */
export function portKindOf(
  nodeType: string,
  handleId: string | null | undefined,
  direction: PortDirection,
): PortKind {
  return findPort(nodeType, handleId, direction)?.kind ?? 'none';
}

/**
 * 两个具体 handle 之间能否连 —— CanvasArea 的 isValidConnection 直接用它。
 * 注意这里同样**不做**图结构校验（自连/环/重复边），那是调用方的事。
 */
export function isConnectableHandles(
  sourceType: string,
  sourceHandleId: string | null | undefined,
  targetType: string,
  targetHandleId: string | null | undefined,
): boolean {
  const a = portKindOf(sourceType, sourceHandleId, 'out');
  const b = portKindOf(targetType, targetHandleId, 'in');
  return isConnectable(a, b);
}

/**
 * 节点对节点：只要存在**任意一对**可连的端口就算可连。
 * 用于右键菜单「这个节点能不能接住我」的粗筛（细筛在真正落线时做）。
 */
export function canConnectNodeTypes(sourceType: string, targetType: string): boolean {
  const outs = portsOf(sourceType).outputs;
  const ins = portsOf(targetType).inputs;
  for (const o of outs) {
    for (const i of ins) {
      if (isConnectable(o.kind, i.kind)) return true;
    }
  }
  return false;
}

/** 给定源类型，列出所有"能接住它"的节点类型 key */
export function targetNodeTypesFor(sourceType: string): string[] {
  return Object.keys(NODE_PORTS).filter((t) => canConnectNodeTypes(sourceType, t));
}

/** 给定目标类型，列出所有"能喂给它"的节点类型 key */
export function sourceNodeTypesFor(targetType: string): string[] {
  return Object.keys(NODE_PORTS).filter((s) => canConnectNodeTypes(s, targetType));
}

/**
 * 给定一个**具体输出端口**，列出「能接住这个端口的节点类型 + 可用的目标端口」。
 *
 * 这就是"拖线到空白处只列出能连上的节点"的数据源：
 * 返回的每一项都带 `handleId`，菜单选中后可以直接建节点并自动落线。
 */
export interface TargetOption {
  nodeType: string;
  handleId: string;
  handleKind: PortKind;
  handleLabel: string;
}

export function targetOptionsForHandle(
  sourceType: string,
  sourceHandleId: string | null | undefined,
): TargetOption[] {
  const srcKind = portKindOf(sourceType, sourceHandleId, 'out');
  if (srcKind === 'none') return [];
  const options: TargetOption[] = [];
  for (const [nodeType, spec] of Object.entries(NODE_PORTS)) {
    for (const inPort of spec.inputs) {
      if (!isConnectable(srcKind, inPort.kind)) continue;
      options.push({
        nodeType,
        handleId: inPort.id,
        handleKind: inPort.kind,
        handleLabel: inPort.label,
      });
    }
  }
  return options;
}

/** 按节点类型分组的版本（同一节点多个口可接时只出现一次，取第一个匹配口） */
export function targetNodeTypesForHandle(
  sourceType: string,
  sourceHandleId: string | null | undefined,
): string[] {
  const seen: string[] = [];
  for (const opt of targetOptionsForHandle(sourceType, sourceHandleId)) {
    if (!seen.includes(opt.nodeType)) seen.push(opt.nodeType);
  }
  return seen;
}

/** 完整 26×26 兼容表（只保留 true），供测试/调试面板使用 */
export function compatibilityMatrix(): Array<{ source: string; targets: string[] }> {
  return Object.keys(NODE_PORTS).map((s) => ({
    source: s,
    targets: targetNodeTypesFor(s),
  }));
}