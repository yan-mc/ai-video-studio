/**
 * 画布图论逻辑 —— 节点创建 / 连线校验 / 分组关系 / 序列化。
 *
 * 为什么单独成文件：
 *   这些是**纯函数**（输入 nodes/edges，输出新 nodes/edges，不碰 React），
 *   可以在 node 里直接单测，不用起 jsdom。CanvasArea 只做"调用 + setState"。
 *
 * 连线校验分两层，顺序不能反：
 *   ① 类型层：portTypes.isConnectableHandles（这个端口能不能接那个端口）
 *   ② 结构层：自连 / 重复边 / 成环（本文件）
 * 类型层决定了"菜单里列出哪些节点"，结构层决定了"落线时会不会被拒"。
 */
import type { CanvasFlowNode, CanvasNodeData } from './types';
import type { NodeTypeKey } from './nodeKeys';
import { getDefinition, defaultNodeData, nodeDefaultLabel } from './nodeRegistry';
import { isConnectableHandles, portKindOf, findPort, PORT_KIND_LABELS } from './portTypes';
import { paramStr } from './types';

/** 画布连线（比 React Flow 的 Edge 窄，data 存端口类型以便上色） */
export interface CanvasEdgeShape {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  type: string;
  animated?: boolean;
  data?: { sourceKind?: string; targetKind?: string };
  style?: Record<string, string | number>;
  label?: string;
}

/* ========================================================================== */
/* 一、ID 生成                                                                 */
/* ========================================================================== */

let seq = 0;

/** 节点 id：`nd_<type>_<递增>`，可读且不会被后端误判 */
export function newNodeId(type: string): string {
  seq += 1;
  return `nd_${type.replace(/Node$/, '')}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/** 连线 id：`ed_<source>_<target>_<递增>` */
export function newEdgeId(source: string, target: string): string {
  seq += 1;
  return `ed_${source.slice(-6)}_${target.slice(-6)}_${seq.toString(36)}`;
}

/* ========================================================================== */
/* 二、节点创建                                                                */
/* ========================================================================== */

export interface CreateNodeOptions {
  /** 节点类型 */
  type: NodeTypeKey;
  /** 画布坐标（节点左上角） */
  position: { x: number; y: number };
  /** 初始 data 覆盖（例如从连线菜单创建时预填） */
  data?: Partial<CanvasNodeData>;
  /** 父分组 id */
  parentId?: string;
}

/** 按注册表创建节点：默认尺寸 + 默认参数 + 默认标题 */
export function createCanvasNode(options: CreateNodeOptions): CanvasFlowNode {
  const { type, position, data, parentId } = options;
  const def = getDefinition(type);
  const base = defaultNodeData(type) as CanvasNodeData;
  const merged: CanvasNodeData = { ...base, ...(data ?? {}) };
  // 参数是合并而不是替换：调用方只覆盖想改的那几个键
  if (base.params || data?.params) {
    merged.params = { ...(base.params ?? {}), ...(data?.params ?? {}) };
  }
  const node: CanvasFlowNode = {
    id: newNodeId(type),
    type,
    position,
    data: merged,
    width: def?.size.width,
    height: def?.size.height,
    ariaLabel: nodeDefaultLabel(type),
  };
  if (parentId) {
    node.parentId = parentId;
    // 子节点坐标是相对父容器的；限定在父容器内，否则拖出去会飘
    node.extent = 'parent';
    node.expandParent = false;
  }
  if (type === 'groupNode') {
    // 分组节点必须在兄弟节点之下
    node.zIndex = -1;
  }
  return node;
}

/* ========================================================================== */
/* 三、连线校验（结构层）                                                       */
/* ========================================================================== */

export interface ConnectionLike {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export type ConnectCheck =
  | { ok: true }
  | { ok: false; code: 'no-source' | 'no-target' | 'self' | 'duplicate' | 'cycle' | 'type'; reason: string };

/** 从 source 出发能否到达 target（用于成环检测。空端点条目会被忽略） */
export function reaches(
  edges: ReadonlyArray<{ source?: string | null; target?: string | null }>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of edges) {
      if (e.source === cur && typeof e.target === 'string') stack.push(e.target);
    }
  }
  return false;
}

/** 是否已存在同一对 handle 的连线（重复边） */
export function hasDuplicateEdge(
  edges: ReadonlyArray<ConnectionLike>,
  conn: ConnectionLike,
): boolean {
  return edges.some(
    (e) =>
      e.source === conn.source &&
      e.target === conn.target &&
      (e.sourceHandle ?? null) === (conn.sourceHandle ?? null) &&
      (e.targetHandle ?? null) === (conn.targetHandle ?? null),
  );
}

/**
 * 完整连线校验：类型层 + 结构层。
 * `nodes` 用于把 nodeId 还原成 nodeType（React Flow 的 connection 只给 id）。
 */
export function checkConnection(
  nodes: ReadonlyArray<CanvasFlowNode>,
  edges: ReadonlyArray<ConnectionLike>,
  conn: ConnectionLike,
): ConnectCheck {
  const sourceId = conn.source ?? null;
  const targetId = conn.target ?? null;
  if (!sourceId) return { ok: false, code: 'no-source', reason: '没有起点' };
  if (!targetId) return { ok: false, code: 'no-target', reason: '没有终点' };
  if (sourceId === targetId) return { ok: false, code: 'self', reason: '不能连到自己' };

  const srcNode = nodes.find((n) => n.id === sourceId);
  const dstNode = nodes.find((n) => n.id === targetId);
  if (!srcNode || !dstNode) return { ok: false, code: 'no-source', reason: '节点不存在' };

  if (!isConnectableHandles(srcNode.type ?? '', conn.sourceHandle, dstNode.type ?? '', conn.targetHandle)) {
    const a = portKindOf(srcNode.type ?? '', conn.sourceHandle, 'out');
    const b = portKindOf(dstNode.type ?? '', conn.targetHandle, 'in');
    // 原因用中文类型名（音频/图片…），直接可展示给用户
    return {
      ok: false,
      code: 'type',
      reason: `端口类型不兼容（${PORT_KIND_LABELS[a]} ✗ ${PORT_KIND_LABELS[b]}）`,
    };
  }

  if (hasDuplicateEdge(edges, conn)) {
    return { ok: false, code: 'duplicate', reason: '这两个端口已经连过了' };
  }

  // 成环：如果 target 已经能走到 source，再加这条边就成环了
  if (reaches(edges, targetId, sourceId)) {
    return { ok: false, code: 'cycle', reason: '会形成回路，画布不允许有环' };
  }

  return { ok: true };
}

/** 便捷布尔版（React Flow 的 isValidConnection 用） */
export function isValidConnection(
  nodes: ReadonlyArray<CanvasFlowNode>,
  edges: ReadonlyArray<ConnectionLike>,
  conn: ConnectionLike,
): boolean {
  return checkConnection(nodes, edges, conn).ok;
}

/* ========================================================================== */
/* 四、连线创建                                                                */
/* ========================================================================== */

/** 端口类型 → 连线风格（颜色从 CSS 变量取，这里只存变量名） */
const KIND_STYLE: Record<string, { stroke: string; label: string }> = {
  text: { stroke: 'var(--jz-info-text)', label: '文本' },
  image: { stroke: 'var(--jz-accent-text)', label: '图片' },
  video: { stroke: 'var(--jz-warn-text)', label: '视频' },
  audio: { stroke: 'var(--jz-ok-text)', label: '音频' },
  asset: { stroke: 'var(--jz-text-secondary)', label: '资产' },
  pose: { stroke: 'var(--jz-info-text)', label: '姿势' },
  panorama: { stroke: 'var(--jz-accent-text)', label: '全景' },
  none: { stroke: 'var(--jz-border)', label: '' },
};

/** 创建者需要的连线入参（端点必填，handle 可空 = 该方向第一个端口） */
export interface EdgeEndpoints {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function createCanvasEdge(
  nodes: ReadonlyArray<CanvasFlowNode>,
  conn: EdgeEndpoints,
): CanvasEdgeShape {
  const srcNode = nodes.find((n) => n.id === conn.source);
  const dstNode = nodes.find((n) => n.id === conn.target);
  const srcKind = portKindOf(srcNode?.type ?? '', conn.sourceHandle, 'out');
  const dstKind = portKindOf(dstNode?.type ?? '', conn.targetHandle, 'in');
  const style = KIND_STYLE[srcKind] ?? KIND_STYLE.none;
  const srcPort = findPort(srcNode?.type ?? '', conn.sourceHandle, 'out');
  const dstPort = findPort(dstNode?.type ?? '', conn.targetHandle, 'in');
  return {
    id: newEdgeId(conn.source, conn.target),
    source: conn.source,
    target: conn.target,
    sourceHandle: conn.sourceHandle ?? null,
    targetHandle: conn.targetHandle ?? null,
    type: 'smoothstep',
    data: { sourceKind: srcKind, targetKind: dstKind },
    style: { stroke: style.stroke ?? 'var(--jz-border)', strokeWidth: 1.6 },
    label: `${srcPort?.label ?? ''}→${dstPort?.label ?? ''}`,
  };
}

/* ========================================================================== */
/* 五、分组关系                                                                */
/* ========================================================================== */

/** 节点中心点（分组/对齐用；当前未在 UI 里直接使用，保留给后续对齐功能） */
export function centerOf(node: CanvasFlowNode): { x: number; y: number } {
  const w = typeof node.width === 'number' ? node.width : (getDefinition(node.type ?? '')?.size.width ?? 240);
  const h = typeof node.height === 'number' ? node.height : (getDefinition(node.type ?? '')?.size.height ?? 200);
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
}

/** 找出包含给定节点的最小分组（用于 Ctrl+G 时判断能否再包一层） */
export function findParentGroup(nodes: ReadonlyArray<CanvasFlowNode>, nodeIds: ReadonlyArray<string>): string | null {
  for (const id of nodeIds) {
    const n = nodes.find((x) => x.id === id);
    if (n?.parentId) return n.parentId;
  }
  return null;
}

/**
 * 把一批节点合成一组。
 *
 * 返回新的 nodes 数组（不修改入参），会：
 *   · 计算这批节点的包围盒，扩 padding 后作为分组的 position/size；
 *   · 给每个成员设置 parentId + extent:'parent'，并把坐标转成**相对父容器**；
 *   · 跳过已经是别的分组的子节点（不跨组嵌套，与参考实现一致）；
 *   · 跳过 groupNode 自身（不允许组里套组，行为不可预期）。
 */
export function groupSelection(
  nodes: ReadonlyArray<CanvasFlowNode>,
  nodeIds: ReadonlyArray<string>,
  padding = 28,
): { nodes: CanvasFlowNode[]; groupId: string } | null {
  const members = nodes.filter(
    (n) => nodeIds.includes(n.id) && n.type !== 'groupNode' && !n.parentId,
  );
  if (members.length < 2) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of members) {
    const w = typeof n.width === 'number' ? n.width : (getDefinition(n.type ?? '')?.size.width ?? 240);
    const h = typeof n.height === 'number' ? n.height : (getDefinition(n.type ?? '')?.size.height ?? 200);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }

  const groupPos = { x: minX - padding, y: minY - padding - 22 };
  const group = createCanvasNode({
    type: 'groupNode',
    position: groupPos,
    data: {
      title: `分组 ${members.length}`,
      params: { tone: 'neutral' },
    },
  });
  group.style = {
    width: `${maxX - minX + padding * 2}px`,
    height: `${maxY - minY + padding * 2 + 22}px`,
  };
  group.width = maxX - minX + padding * 2;
  group.height = maxY - minY + padding * 2 + 22;

  const memberIds = new Set(members.map((n) => n.id));
  const nextNodes = nodes.map((n) => {
    if (!memberIds.has(n.id)) return n;
    return {
      ...n,
      parentId: group.id,
      extent: 'parent' as const,
      // 转成相对坐标
      position: { x: n.position.x - groupPos.x, y: n.position.y - groupPos.y },
      zIndex: 1,
    };
  });
  nextNodes.push(group);
  return { nodes: nextNodes, groupId: group.id };
}

/** 解组：把 groupId 的所有子节点坐标转回绝对坐标并移除分组 */
export function ungroup(
  nodes: ReadonlyArray<CanvasFlowNode>,
  groupId: string,
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return nodes.slice();
  const gx = group.position.x;
  const gy = group.position.y;
  return nodes
    .filter((n) => n.id !== groupId)
    .map((n) => {
      if (n.parentId !== groupId) return n;
      const { parentId: _parentId, extent: _extent, ...rest } = n;
      return {
        ...rest,
        position: { x: n.position.x + gx, y: n.position.y + gy },
      } as CanvasFlowNode;
    });
}

/** 某分组下的成员节点 id */
export function childrenOf(nodes: ReadonlyArray<CanvasFlowNode>, groupId: string): string[] {
  return nodes.filter((n) => n.parentId === groupId).map((n) => n.id);
}

/** 删除节点（含其子节点 + 相关连线） */
export function removeNodes(
  nodes: ReadonlyArray<CanvasFlowNode>,
  edges: ReadonlyArray<CanvasEdgeShape>,
  ids: ReadonlyArray<string>,
): { nodes: CanvasFlowNode[]; edges: CanvasEdgeShape[] } {
  const idSet = new Set(ids);
  // 分组被删时连带删除子节点（与 React Flow 的默认 parent 行为一致）
  for (const id of ids) {
    for (const child of childrenOf(nodes, id)) idSet.add(child);
  }
  return {
    nodes: nodes.filter((n) => !idSet.has(n.id)),
    edges: edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
  };
}

/* ========================================================================== */
/* 六、序列化（存后端 projects.json 的 nodes / edges 字段）                     */
/* ========================================================================== */

/** React Flow 的运行时字段不该落盘（尺寸缓存、拖拽态等） */
const TRANSIENT_NODE_KEYS = new Set(['measured', 'selected', 'dragging', 'resizing', 'initialWidth', 'initialHeight']);

/** 精简节点用于持久化 */
export function serializeNode(node: CanvasFlowNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (TRANSIENT_NODE_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** 精简连线用于持久化 */
export function serializeEdge(edge: CanvasEdgeShape): Record<string, unknown> {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    type: edge.type,
    data: edge.data ?? {},
  };
}

/** 从后端 JSON 还原节点（字段缺失/类型错误时补默认值，绝不因脏数据崩画布） */
export function deserializeNodes(raw: unknown): CanvasFlowNode[] {
  if (!Array.isArray(raw)) return [];
  const out: CanvasFlowNode[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id) continue;
    const type = typeof rec.type === 'string' ? rec.type : 'uploadNode';
    const def = getDefinition(type);
    const pos = rec.position as { x?: unknown; y?: unknown } | undefined;
    const data = (rec.data && typeof rec.data === 'object' ? rec.data : {}) as CanvasNodeData;
    const node: CanvasFlowNode = {
      id: rec.id,
      type,
      position: {
        x: Number(pos?.x) || 0,
        y: Number(pos?.y) || 0,
      },
      data,
      width: typeof rec.width === 'number' ? rec.width : def?.size.width,
      height: typeof rec.height === 'number' ? rec.height : def?.size.height,
    };
    if (typeof rec.parentId === 'string') {
      node.parentId = rec.parentId;
      node.extent = 'parent';
    }
    const style = rec.style;
    if (style && typeof style === 'object') node.style = style as CanvasFlowNode['style'];
    if (typeof rec.zIndex === 'number') node.zIndex = rec.zIndex;
    out.push(node);
  }
  return out;
}

/** 从后端 JSON 还原连线 */
export function deserializeEdges(raw: unknown, nodes: ReadonlyArray<CanvasFlowNode>): CanvasEdgeShape[] {
  if (!Array.isArray(raw)) return [];
  const out: CanvasEdgeShape[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.source !== 'string' || typeof rec.target !== 'string') continue;
    const srcNode = nodes.find((n) => n.id === rec.source);
    const dstNode = nodes.find((n) => n.id === rec.target);
    if (!srcNode || !dstNode) continue; // 悬空连线直接丢弃
    const srcKind = portKindOf(
      srcNode.type ?? '',
      typeof rec.sourceHandle === 'string' ? rec.sourceHandle : null,
      'out',
    );
    const style = KIND_STYLE[srcKind] ?? KIND_STYLE.none;
    out.push({
      id: typeof rec.id === 'string' && rec.id ? rec.id : newEdgeId(rec.source, rec.target),
      source: rec.source,
      target: rec.target,
      sourceHandle: typeof rec.sourceHandle === 'string' ? rec.sourceHandle : null,
      targetHandle: typeof rec.targetHandle === 'string' ? rec.targetHandle : null,
      type: typeof rec.type === 'string' && rec.type ? rec.type : 'smoothstep',
      data: { sourceKind: srcKind, targetKind: portKindOf(dstNode.type ?? '', typeof rec.targetHandle === 'string' ? rec.targetHandle : null, 'in') },
      style: { stroke: style.stroke ?? 'var(--jz-border)', strokeWidth: 1.6 },
      label: typeof rec.label === 'string' ? rec.label : undefined,
    });
  }
  return out;
}

/* ========================================================================== */
/* 七、其它查询                                                                */
/* ========================================================================== */

/** 节点的上游节点 id 列表（按连线） */
export function upstreamOf(edges: ReadonlyArray<CentralEdgeLike>, nodeId: string): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source);
}

/** 节点的下游节点 id 列表 */
export function downstreamOf(edges: ReadonlyArray<CentralEdgeLike>, nodeId: string): string[] {
  return edges.filter((e) => e.source === nodeId).map((e) => e.target);
}

interface CentralEdgeLike {
  source: string;
  target: string;
}

/** 把上游产物写进节点的 result（"结果回流"的数据流） */
export function collectUpstreamResult(
  nodes: ReadonlyArray<CanvasFlowNode>,
  edges: ReadonlyArray<CentralEdgeLike>,
  nodeId: string,
): Partial<CanvasNodeData> {
  const ups = upstreamOf(edges as CanvasEdgeShape[], nodeId);
  const patch: Partial<CanvasNodeData> = {};
  for (const uid of ups) {
    const up = nodes.find((n) => n.id === uid);
    if (!up || !up.data) continue;
    const upResult = up.data.result;
    if (!upResult) continue;
    if (upResult.url && !patch.result?.url) {
      patch.result = { ...(patch.result ?? {}), url: upResult.url };
    }
    if (upResult.text && !patch.result?.text) {
      patch.result = { ...(patch.result ?? {}), text: upResult.text };
    }
  }
  return patch;
}

/** 节点标题（用于菜单/面包屑） */
export function displayTitle(node: CanvasFlowNode): string {
  const custom = typeof node.data?.title === 'string' ? node.data.title.trim() : '';
  if (custom) return custom;
  return nodeDefaultLabel(node.type ?? '');
}

/** 节点是否有未完成的运行（决定能否重新运行） */
export function isBusy(node: CanvasFlowNode): boolean {
  const s = node.data?.status;
  return s === 'running' || s === 'queued';
}

/** 分组节点的显示名（参数 groupName 优先于 data.title） */
export function groupDisplayName(node: CanvasFlowNode): string {
  const fromParams = paramStr(node.data?.params, 'groupName');
  return fromParams || displayTitle(node);
}