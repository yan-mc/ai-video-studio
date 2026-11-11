/**
 * 画布工作台 —— 26 节点画布的宿主组件。
 *
 * 接口契约（不可破坏，App.tsx / CanvasPage.tsx 依赖它）：
 *   import CanvasArea from './canvas/CanvasArea';
 *   <CanvasArea />            // 默认导出、零必需 props、自己铺满父容器
 *
 * 组件职责（全部集中在这里，节点组件保持纯展示）：
 *   1. React Flow 画布：缩放/平移/框选/多选/吸附/小地图/控件
 *   2. 工具条：新建节点（按 8 个分组）、撤销/重做（12 步）、缩放、适配、锁定
 *   3. 右键菜单：空白处 = 新建节点 / 粘贴 / 全选 / 清空；
 *      节点上 = 运行/删除/复制/成组/解组/打开工作台
 *   4. **拖线到空白处 → 只列出能接住的节点**（本任务核心行为，靠 portTypes）
 *   5. 撤销 12 步（history.ts）+ 自动保存 debounce 800ms（autosave.ts）
 *   6. 数据流：从 useProjectStore 读当前项目 → GET /projects/:id → 还原 nodes/edges
 *      变更 → 写回 nodes/edges（受控 state）→ autosave 串行落盘
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStartParams,
  type Viewport,
} from '@xyflow/react';

import { Badge, Button, Icon, IconButton, Spinner, useToast, useT } from '../ui';
import { useProjectStore } from '../store';
import { api, describeError } from '../api/client';

import { allNodeTypes } from './nodes';
import { NODE_TYPE_KEYS, type NodeTypeKey } from './nodeKeys';
import {
  NODE_REGISTRY,
  definitionsByCategory,
  getDefinition,
  nodeDefaultLabel,
  NODE_CATEGORY_LABELS,
} from './nodeRegistry';
import type { CanvasNodeData } from './types';
import type { PortKind } from './portTypes';
import { targetOptionsForHandle, targetNodeTypesForHandle, PORT_KIND_LABELS } from './portTypes';
import { NodeActionsContext, type NodeActions, type FilePickKind } from './nodeActions';
import { HistoryStack, cloneGraph, HISTORY_LIMIT } from './history';
import { Autosave, AUTOSAVE_DELAY_MS, buildPayload, type SaveState } from './autosave';
import {
  checkConnection,
  createCanvasEdge,
  createCanvasNode,
  deserializeEdges,
  deserializeNodes,
  groupSelection,
  removeNodes,
  serializeEdge,
  serializeNode,
  ungroup,
  displayTitle,
  type CanvasEdgeShape,
  type ConnectionLike,
} from './graph';
import type { CanvasFlowNode } from './types';

import './canvas.css';

/* ========================================================================== */
/* 常量                                                                        */
/* ========================================================================== */

/** 从某个具体输出端口拖线到空白处时，最多列多少个候选节点 */
const MAX_QUICK_TARGETS = 12;

const CATEGORY_ORDER = [
  'upload',
  'generate',
  'extract',
  'storyboard',
  'panorama',
  'studio',
  'result',
  'structure',
] as const;

/* ========================================================================== */
/* 子组件：右键菜单 / 下拉菜单（纯展示，动作由父组件传入）                       */
/* ========================================================================== */

interface MenuPosition {
  x: number;
  y: number;
}

interface QuickTarget {
  nodeType: string;
  label: string;
  kind: PortKind;
}

/** 从连线菜单里选一个节点类型 → 创建节点并自动连线 */
interface PendingConnect {
  sourceNodeId: string;
  sourceHandleId: string | null;
  /** 落点（flow 坐标，用于创建节点位置） */
  flow: { x: number; y: number };
  /** 落点（屏幕坐标，用于菜单定位） */
  screen: { x: number; y: number };
  targets: QuickTarget[];
}

/* ========================================================================== */
/* 子组件：新建节点下拉                                                         */
/* ========================================================================== */

function AddNodeMenu({
  onPick,
  onClose,
}: {
  onPick: (type: NodeTypeKey) => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => definitionsByCategory(), []);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="jz-canvas__addmenu" ref={ref} role="menu" aria-label="新建节点">
      {groups.map((g) => (
        <div key={g.category}>
          <div className="jz-canvas__addmenu-section">{NODE_CATEGORY_LABELS[g.category]}</div>
          {g.items.map((def) => (
            <button
              key={def.type}
              type="button"
              role="menuitem"
              className="jz-canvas__addmenu-item"
              onClick={() => onPick(def.type)}
            >
              <Icon name={def.icon} size={13} />
              <span>{def.label}</span>
              <span className="jz-canvas__addmenu-desc">{def.description}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* 子组件：节点右键菜单                                                        */
/* ========================================================================== */

function NodeContextMenu({
  node,
  canGroup,
  canUngroup,
  at,
  onAction,
  onClose,
}: {
  node: CanvasFlowNode;
  canGroup: boolean;
  canUngroup: boolean;
  at: MenuPosition;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const def = getDefinition(node.type ?? '');
  const items: Array<{ key: string; label: string; icon: 'play' | 'copy' | 'trash' | 'layers' | 'external'; danger?: boolean; disabled?: boolean }> = [
    { key: 'run', label: '运行此节点', icon: 'play', disabled: !def?.capabilities?.generative },
    { key: 'duplicate', label: '复制节点', icon: 'copy' },
    { key: 'group', label: '成组（Ctrl+G）', icon: 'layers', disabled: !canGroup },
    { key: 'ungroup', label: '解组', icon: 'layers', disabled: !canUngroup },
    { key: 'external', label: '打开关联工作台', icon: 'external', disabled: !['blueprintNode', 'previzNode', 'poseStudioNode', 'episodeSubCanvasNode', 'vr360PanoramaNode', 'panoramaViewerBNode'].includes(node.type ?? '') },
  ];

  return (
    <div
      className="jz-ctxmenu"
      ref={ref}
      style={{ left: at.x, top: at.y }}
      role="menu"
      aria-label="节点菜单"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="jz-ctxmenu__title">
        <Icon name={def?.icon ?? 'alert'} size={11} />
        {displayTitle(node)}
        <span className="jz-ctxmenu__hint">{node.type}</span>
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className="jz-ctxmenu__item"
          disabled={item.disabled}
          onClick={() => onAction(item.key)}
        >
          <Icon name={item.icon} size={12} />
          {item.label}
        </button>
      ))}
      <div className="jz-ctxmenu__sep" />
      <button
        type="button"
        role="menuitem"
        className="jz-ctxmenu__item jz-ctxmenu__item--danger"
        onClick={() => onAction('delete')}
      >
        <Icon name="trash" size={12} />
        删除节点
      </button>
    </div>
  );
}

/* ========================================================================== */
/* 子组件：空白处右键菜单                                                      */
/* ========================================================================== */

function PaneContextMenu({
  at,
  hasSelection,
  canGroup,
  canUngroup,
  hasClipboard,
  onAction,
  onClose,
}: {
  at: MenuPosition;
  hasSelection: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  hasClipboard: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="jz-ctxmenu"
      ref={ref}
      style={{ left: at.x, top: at.y }}
      role="menu"
      aria-label="画布菜单"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" className="jz-ctxmenu__item" onClick={() => onAction('add')}>
        <Icon name="plus" size={12} />
        新建节点
      </button>
      <button
        type="button"
        role="menuitem"
        className="jz-ctxmenu__item"
        disabled={!hasClipboard}
        onClick={() => onAction('paste')}
      >
        <Icon name="copy" size={12} />
        粘贴
      </button>
      <div className="jz-ctxmenu__sep" />
      <button type="button" role="menuitem" className="jz-ctxmenu__item" onClick={() => onAction('selectAll')}>
        <Icon name="layers" size={12} />
        全选
        <span className="jz-ctxmenu__hint">Ctrl+A</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="jz-ctxmenu__item"
        disabled={!canGroup}
        onClick={() => onAction('group')}
      >
        <Icon name="grid" size={12} />
        成组
        <span className="jz-ctxmenu__hint">Ctrl+G</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="jz-ctxmenu__item"
        disabled={!canUngroup}
        onClick={() => onAction('ungroup')}
      >
        <Icon name="grid" size={12} />
        解组
      </button>
      <div className="jz-ctxmenu__sep" />
      <button type="button" role="menuitem" className="jz-ctxmenu__item" onClick={() => onAction('fit')}>
        <Icon name="eye" size={12} />
        适配视图
      </button>
      <button
        type="button"
        role="menuitem"
        className="jz-ctxmenu__item jz-ctxmenu__item--danger"
        disabled={!hasSelection}
        onClick={() => onAction('deleteSelection')}
      >
        <Icon name="trash" size={12} />
        删除选中
      </button>
    </div>
  );
}

/* ========================================================================== */
/* 主组件内部实现（需要 ReactFlowProvider 包裹才能用 useReactFlow）             */
/* ========================================================================== */

function CanvasInner() {
  const t = useT();
  const toast = useToast();
  const rf = useReactFlow();

  /* ------------------------------ 项目上下文 ------------------------------ */
  const projectId = useProjectStore((s) => s.currentProjectId);
  const projectsError = useProjectStore((s) => s.projectsError);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  /* -------------------------------- 状态 --------------------------------- */
  const [nodes, setNodes] = useState<CanvasFlowNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdgeShape[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [zoomLabel, setZoomLabel] = useState(100);
  const [locked, setLocked] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [nodeMenu, setNodeMenu] = useState<{ node: CanvasFlowNode; at: MenuPosition } | null>(null);
  const [paneMenu, setPaneMenu] = useState<MenuPosition | null>(null);
  const [paneMenuPos, setPaneMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [quickConnect, setQuickConnect] = useState<PendingConnect | null>(null);

  const [clipboard, setClipboard] = useState<CanvasFlowNode[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  /* ------------------------------- 引用 ---------------------------------- */
  const historyRef = useRef(new HistoryStack<CanvasFlowNode>());
  const saverRef = useRef<Autosave<ReturnType<typeof buildPayload>> | null>(null);
  /**
   * 图状态的真源（refs）。
   *
   * 为什么不用 `nodesRef.current = nodes`（渲染期赋值）+ setState(updater) 里带副作用：
   * React StrictMode 会把 updater 调两次，侧效应（压历史、排保存）就会被执行两次，
   * 表现为"撤销一次跳两格""保存两次"。所以这里改成：
   *   · refs 是唯一真源，**只有 commitGraph 写它**；
   *   · setState 只用于触发重渲染，不含任何副作用；
   *   · 所有读写都走 refs，保证同一 tick 内多次变更也看到最新值。
   */
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  const edgesRef = useRef<CanvasEdgeShape[]>([]);
  const viewportRef = useRef(viewport);
  const projectIdRef = useRef(projectId);
  const loadedProjectRef = useRef<string | null>(null);
  /** 远端加载期间禁止 autosave 触发（否则会把空画布存回去） */
  const hydratingRef = useRef(false);

  viewportRef.current = viewport;
  projectIdRef.current = projectId;

  const bumpHistory = useCallback(() => setHistoryTick((n) => n + 1), []);

  /* ------------------------------ autosave ------------------------------- */
  useEffect(() => {
    const saver = new Autosave<ReturnType<typeof buildPayload>>({
      delayMs: AUTOSAVE_DELAY_MS,
      save: async (pid, payload) => {
        await api.updateProject(pid, {
          nodes: payload.nodes as never,
          edges: payload.edges as never,
          viewport: payload.viewport as never,
          nodeCount: payload.nodeCount,
        });
      },
      onState: (state, err) => {
        setSaveState(state);
        setSaveError(err ?? null);
        if (state === 'saved') setLastSavedAt(Date.now());
      },
    });
    saverRef.current = saver;
    return () => {
      saverRef.current = null;
      void saver.dispose();
    };
  }, []);

  /** 每次图变更后调度保存（hydrating 期间跳过） */
  const scheduleSave = useCallback((nextNodes: CanvasFlowNode[], nextEdges: CanvasEdgeShape[]) => {
    if (hydratingRef.current) return;
    const pid = projectIdRef.current;
    if (!pid) return;
    const payload = buildPayload(
      nextNodes.map(serializeNode),
      nextEdges.map(serializeEdge),
      viewportRef.current,
    );
    saverRef.current?.schedule(pid, payload);
  }, []);

  /* ------------------------------- 加载项目 ------------------------------ */
  useEffect(() => {
    if (!projectId) {
      nodesRef.current = [];
      edgesRef.current = [];
      setNodes([]);
      setEdges([]);
      loadedProjectRef.current = null;
      return;
    }
    if (loadedProjectRef.current === projectId) return;

    let cancelled = false;
    hydratingRef.current = true;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const project = await api.getProject(projectId);
        if (cancelled) return;
        const restoredNodes = deserializeNodes(project.nodes);
        const restoredEdges = deserializeEdges(project.edges, restoredNodes);
        const vp = project.viewport as Partial<Viewport> | null;
        const restoredViewport: Viewport = {
          x: Number(vp?.x) || 0,
          y: Number(vp?.y) || 0,
          zoom: Number(vp?.zoom) || 1,
        };

        historyRef.current.clear();
        bumpHistory();
        nodesRef.current = restoredNodes;
        edgesRef.current = restoredEdges;
        setNodes(restoredNodes);
        setEdges(restoredEdges);
        setViewport(restoredViewport);
        setZoomLabel(Math.round(restoredViewport.zoom * 100));
        loadedProjectRef.current = projectId;

        // 首帧定位：有 viewport 用 viewport，没有则 fitView
        window.setTimeout(() => {
          if (cancelled) return;
          if (restoredNodes.length === 0) return;
          void rf.setViewport(restoredViewport, { duration: 0 });
          if (restoredViewport.zoom === 1 && restoredViewport.x === 0 && restoredViewport.y === 0) {
            void rf.fitView({ padding: 0.22, duration: 260 });
          }
        }, 40);
      } catch (err) {
        if (cancelled) return;
        setLoadError(describeError(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          // 延后解除 hydration 保护，避免加载完立刻触发保存
          window.setTimeout(() => {
            hydratingRef.current = false;
          }, 120);
        }
      }
    })();

    return () => {
      cancelled = true;
      hydratingRef.current = false;
    };
  }, [projectId, rf, bumpHistory]);

  /* ---------------------------- 历史记录辅助 ----------------------------- */
  const pushHistory = useCallback(
    (nextNodes: CanvasFlowNode[], nextEdges: CanvasEdgeShape[], key: string | null, label: string) => {
      if (hydratingRef.current) return;
      const snap = cloneGraph(nextNodes, nextEdges);
      historyRef.current.push({ nodes: snap.nodes, edges: snap.edges, label }, key);
      bumpHistory();
    },
    [bumpHistory],
  );

  /**
   * 提交一次图变更（**唯一写 refs + setState 的地方**）。
   * 所有 mutation 都走它，保证 refs/渲染/历史/存盘四者一致。
   */
  const commitGraph = useCallback(
    (
      nextNodes: CanvasFlowNode[],
      nextEdges: CanvasEdgeShape[],
      opts?: { historyKey?: string | null; label?: string; skipHistory?: boolean; skipSave?: boolean },
    ) => {
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (!opts?.skipHistory) {
        pushHistory(nextNodes, nextEdges, opts?.historyKey ?? null, opts?.label ?? 'edit');
      }
      if (!opts?.skipSave) scheduleSave(nextNodes, nextEdges);
    },
    [pushHistory, scheduleSave],
  );

  /* ------------------------------ 节点变更 ------------------------------- */
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const next = applyNodeChanges(changes, nodesRef.current);
      // 只对"有实质变化"的变更记历史/存盘（纯选中不记）
      const meaningful = changes.some((c) => c.type !== 'select' && c.type !== 'dimensions');
      if (!meaningful) {
        nodesRef.current = next;
        setNodes(next);
        return;
      }
      const isPositionOnly = changes.every((c) => c.type === 'position' || c.type === 'select');
      commitGraph(next, edgesRef.current, {
        historyKey: isPositionOnly ? 'position' : null,
        label: 'node-change',
      });
    },
    [commitGraph],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasEdgeShape>[]) => {
      const next = applyEdgeChanges(changes, edgesRef.current);
      if (!changes.some((c) => c.type !== 'select')) {
        edgesRef.current = next;
        setEdges(next);
        return;
      }
      commitGraph(nodesRef.current, next, { label: 'edge-change' });
    },
    [commitGraph],
  );

  /* -------------------------------- 连线 --------------------------------- */
  const isValidConnection = useCallback(
    (conn: Connection | CanvasEdgeShape): boolean => {
      const c: ConnectionLike = {
        source: 'source' in conn ? conn.source : null,
        target: 'target' in conn ? conn.target : null,
        sourceHandle: conn.sourceHandle ?? null,
        targetHandle: conn.targetHandle ?? null,
      };
      return checkConnection(nodesRef.current, edgesRef.current, c).ok;
    },
    [],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      const check = checkConnection(nodesRef.current, edgesRef.current, {
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? null,
        targetHandle: conn.targetHandle ?? null,
      });
      if (!check.ok) {
        toast.error(check.reason);
        return;
      }
      const edge = createCanvasEdge(nodesRef.current, {
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? null,
        targetHandle: conn.targetHandle ?? null,
      });
      const nextEdges = addEdge(edge, edgesRef.current) as CanvasEdgeShape[];
      commitGraph(nodesRef.current, nextEdges, { label: 'connect' });
      toast.ok(`已连接 ${edge.label ?? ''}`);
    },
    [commitGraph, toast],
  );

  /* ------------------- 拖线到空白处 → 只列出能接住的节点 ------------------- */
  const onConnectStart = useCallback((_e: unknown, params: OnConnectStartParams) => {
    // 只关心从 source 口出发；target 口出发是反向连接，不做菜单
    if (params.handleType !== 'source' || !params.nodeId) return;
    const srcNode = nodesRef.current.find((n) => n.id === params.nodeId);
    if (!srcNode) return;
    const kinds = targetOptionsForHandle(srcNode.type ?? '', params.handleId ?? null);
    if (kinds.length === 0) return;
    pendingStartRef.current = { nodeId: params.nodeId, handleId: params.handleId ?? null };
  }, []);

  const pendingStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);

  const onConnectEnd = useCallback<OnConnectEnd>((event, connectionState) => {
    const start = pendingStartRef.current;
    pendingStartRef.current = null;
    if (!start) return;
    // 落在某个 handle 上 → 正常连接流程已处理（或 isValidConnection 已拒绝）
    if (connectionState.toHandle) return;

    const srcNode = nodesRef.current.find((n) => n.id === start.nodeId);
    if (!srcNode) return;

    const candidateNodeTypes = targetNodeTypesForHandle(srcNode.type ?? '', start.handleId);
    if (candidateNodeTypes.length === 0) {
      toast.info('这个输出口没有可接的目标节点');
      return;
    }

    // 菜单落点：屏幕坐标用于定位，flow 坐标用于创建节点
    const evt = event as MouseEvent;
    const flowPos = rf.screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
    const options = targetOptionsForHandle(srcNode.type ?? '', start.handleId).slice(0, MAX_QUICK_TARGETS);
    const seen = new Set<string>();
    const targets: QuickTarget[] = [];
    for (const opt of options) {
      if (seen.has(opt.nodeType)) continue;
      seen.add(opt.nodeType);
      targets.push({
        nodeType: opt.nodeType,
        label: nodeDefaultLabel(opt.nodeType),
        kind: opt.handleKind,
      });
    }

    setQuickConnect({
      sourceNodeId: start.nodeId,
      sourceHandleId: start.handleId,
      flow: { x: flowPos.x, y: flowPos.y },
      screen: { x: evt.clientX, y: evt.clientY },
      targets,
    });
  }, [rf, toast]);

  /* --------------------------- 从菜单选目标节点 -------------------------- */
  const pickQuickTarget = useCallback(
    (target: QuickTarget) => {
      const pending = quickConnect;
      setQuickConnect(null);
      if (!pending) return;
      const type = target.nodeType as NodeTypeKey;
      if (!NODE_REGISTRY[type]) return;

      // 找到该类型上第一个能接住源端口的输入口（菜单可能给出多个，取匹配的）
      const srcNode = nodesRef.current.find((n) => n.id === pending.sourceNodeId);
      if (!srcNode) return;
      const options = targetOptionsForHandle(srcNode.type ?? '', pending.sourceHandleId);
      const match = options.find((o) => o.nodeType === type);
      if (!match) {
        toast.error('该节点接不住这个端口');
        return;
      }

      const node = createCanvasNode({ type, position: pending.flow });
      const conn: ConnectionLike = {
        source: pending.sourceNodeId,
        target: node.id,
        sourceHandle: pending.sourceHandleId,
        targetHandle: match.handleId,
      };
      const check = checkConnection(nodesRef.current, edgesRef.current, conn);
      if (!check.ok) {
        toast.error(check.reason);
        return;
      }
      const edge = createCanvasEdge(nodesRef.current, {
        source: conn.source as string,
        target: conn.target as string,
        sourceHandle: conn.sourceHandle ?? null,
        targetHandle: conn.targetHandle ?? null,
      });
      commitGraph([...nodesRef.current, node], [...edgesRef.current, edge], { label: 'quick-connect' });
      toast.ok(`已创建「${nodeDefaultLabel(type)}」并连接`);
    },
    [commitGraph, quickConnect, toast],
  );

  /* ------------------------------ 新建节点 ------------------------------- */
  const addNodeAt = useCallback(
    (type: NodeTypeKey, at?: { x: number; y: number }) => {
      const center = at ?? rf.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      // 稍微错开，避免连续新建完全重叠
      const offset = (nodesRef.current.length % 6) * 12;
      const node = createCanvasNode({
        type,
        position: { x: center.x - (getDefinition(type)?.size.width ?? 240) / 2 + offset, y: center.y - 60 + offset },
      });
      commitGraph([...nodesRef.current, node], edgesRef.current, { label: 'add-node' });
      setAddOpen(false);
      toast.ok(`已新建「${nodeDefaultLabel(type)}」`);
    },
    [commitGraph, rf, toast],
  );

  /* ------------------------------ 撤销/重做 ----------------------------- */
  const doUndo = useCallback(() => {
    const snap = historyRef.current.undo({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      label: 'undo-target',
    });
    if (!snap) {
      toast.info('没有可撤销的操作');
      return;
    }
    // 撤销本身不再压历史（否则会互相打架），但仍要存盘 + 刷新深度
    commitGraph(snap.nodes, snap.edges as CanvasEdgeShape[], {
      skipHistory: true,
      label: 'undo',
    });
    bumpHistory();
  }, [bumpHistory, commitGraph, toast]);

  const doRedo = useCallback(() => {
    const snap = historyRef.current.redo({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      label: 'redo-target',
    });
    if (!snap) {
      toast.info('没有可重做的操作');
      return;
    }
    commitGraph(snap.nodes, snap.edges as CanvasEdgeShape[], {
      skipHistory: true,
      label: 'redo',
    });
    bumpHistory();
  }, [bumpHistory, commitGraph, toast]);

  /* -------------------------------- 分组 --------------------------------- */
  const selectedIds = useMemo(() => nodes.filter((n) => n.selected).map((n) => n.id), [nodes]);
  const selectedGroupId = useMemo(() => {
    const groups = nodes.filter((n) => n.type === 'groupNode' && n.selected);
    return groups.length === 1 ? (groups[0]?.id ?? null) : null;
  }, [nodes]);

  const doGroup = useCallback(() => {
    // 直接从真源取选中项（不依赖渲染期算出的 selectedIds，避免闭包拿到旧值）
    const ids = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
    const result = groupSelection(nodesRef.current, ids);
    if (!result) {
      toast.info('至少选中 2 个不在分组内的节点');
      return;
    }
    commitGraph(result.nodes, edgesRef.current, { label: 'group' });
    toast.ok('已成组');
  }, [commitGraph, toast]);

  const doUngroup = useCallback(
    (groupId?: string) => {
      const gid =
        groupId ??
        selectedGroupId ??
        nodesRef.current.find((n) => n.selected && n.type === 'groupNode')?.id ??
        null;
      if (!gid) {
        toast.info('请先选中一个分组');
        return;
      }
      const next = ungroup(nodesRef.current, gid);
      commitGraph(next, edgesRef.current.slice(), { label: 'ungroup' });
      toast.ok('已解组');
    },
    [commitGraph, selectedGroupId, toast],
  );

  /* --------------------------- 节点动作（Context） ----------------------- */
  /** 合并节点的 data（不改 params 之外的既有键） */
  const patchData = useCallback((nodeId: string, patch: Partial<CanvasNodeData>) => {
    const next = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
    );
    commitGraph(next, edgesRef.current, {
      historyKey: `data:${nodeId}`,
      label: 'patch-data',
    });
  }, [commitGraph]);

  /** 合并节点的 data.params（只覆盖传入的键） */
  const patchParams = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    const next = nodesRef.current.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, params: { ...(n.data.params ?? {}), ...patch } } }
        : n,
    );
    commitGraph(next, edgesRef.current, {
      historyKey: `params:${nodeId}`,
      label: 'patch-params',
    });
  }, [commitGraph]);

  /** 一次性改 data + params（上传回填用它，避免两次 commit 各记一步历史） */
  const patchNodeFile = useCallback(
    (nodeId: string, result: NonNullable<CanvasNodeData['result']>, params: Record<string, unknown>) => {
      const next = nodesRef.current.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, result, params: { ...(n.data.params ?? {}), ...params } } }
          : n,
      );
      commitGraph(next, edgesRef.current, {
        historyKey: `data:${nodeId}`,
        label: 'patch-file',
      });
    },
    [commitGraph],
  );

  const removeNode = useCallback((nodeId: string) => {
    const result = removeNodes(nodesRef.current, edgesRef.current, [nodeId]);
    commitGraph(result.nodes, result.edges, { label: 'remove-node' });
  }, [commitGraph]);

  const runNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      const def = getDefinition(node.type ?? '');
      if (!def?.capabilities?.generative) {
        toast.info('这个节点不发起生成（本地节点或结果节点）');
        return;
      }
      // 生成本身由任务中心/后端负责；画布这里只做状态流转 + 汇总上游输入
      const upstreamPatch: Partial<CanvasNodeData> = {};
      const upstreamIds = edgesRef.current.filter((e) => e.target === nodeId).map((e) => e.source);
      const upNodes = nodesRef.current.filter((n) => upstreamIds.includes(n.id));
      const firstImg = upNodes.find((n) => n.data?.result?.url)?.data?.result?.url;
      if (firstImg && node.type === 'videoGeneratorNode' && !node.data?.params?.firstFrameUrl) {
        upstreamPatch.params = { ...(node.data?.params ?? {}), firstFrameUrl: firstImg };
      }
      const next = nodesRef.current.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                ...upstreamPatch,
                status: 'running' as const,
                progress: 0,
                error: undefined,
              },
            }
          : n,
      );
      // 状态流转不记历史（撤销一次运行状态没有意义，且会挤掉真正的操作）
      commitGraph(next, edgesRef.current, { skipHistory: true, label: 'run-node' });
      toast.info(`已提交「${displayTitle(node)}」的生成任务（任务中心可查进度）`);
    },
    [commitGraph, toast],
  );

  const cancelNode = useCallback((nodeId: string) => {
    const next = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status: 'idle' as const, progress: 0 } } : n,
    );
    commitGraph(next, edgesRef.current, { skipHistory: true, label: 'cancel-node' });
    toast.info('已取消（若任务已提交，请在任务中心取消）');
  }, [commitGraph, toast]);

  const pickFile = useCallback(
    (nodeId: string, kind: FilePickKind) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = kind === 'image' ? 'image/*' : kind === 'audio' ? 'audio/*' : 'video/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        // 关键：一次提交里同时写 result 与 params。
        // 早期版本分两次 patch 且其中一次把 params 设成 undefined，会把用户已填的
        // 参数（提示词/模型档位）整片清掉 —— 这是最难查的数据丢失，故合并成一次。
        patchNodeFile(nodeId, { url, path: file.name }, { sourcePath: file.name });
        toast.ok(`已载入 ${file.name}`);
      };
      input.click();
    },
    [patchNodeFile, toast],
  );

  const openStudio = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      const type = node.type ?? '';
      const label = displayTitle(node);
      // 独立工作台在 SPA 的路由里尚未落地，这里给出明确的可达反馈，不静默失败。
      toast.info(`「${label}」的独立工作台入口待接入（${type}）`);
    },
    [toast],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodesRef.current.find((n) => n.id === nodeId);
      if (!source) return;
      const type = (source.type ?? 'uploadNode') as NodeTypeKey;
      const node = createCanvasNode({
        type,
        position: { x: source.position.x + 36, y: source.position.y + 36 },
        data: {
          title: source.data?.title,
          params: source.data?.params ? { ...source.data.params } : undefined,
          collapsed: source.data?.collapsed,
        },
      });
      commitGraph([...nodesRef.current, node], edgesRef.current, { label: 'duplicate-node' });
      toast.ok('已复制节点');
    },
    [commitGraph, toast],
  );

  const toggleCollapsed = useCallback((nodeId: string) => {
    const next = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, collapsed: !n.data?.collapsed } } : n,
    );
    commitGraph(next, edgesRef.current, {
      historyKey: `collapse:${nodeId}`,
      label: 'toggle-collapse',
    });
  }, [commitGraph]);

  const downloadNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      const url = node?.data?.result?.url;
      if (!url) {
        toast.info('没有可下载的产物');
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = node?.data?.result?.path ?? `${nodeId}.bin`;
      a.target = '_blank';
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.ok('已开始下载');
    },
    [toast],
  );

  const nodeActions = useMemo<NodeActions>(
    () => ({
      patchData,
      patchParams,
      run: runNode,
      cancel: cancelNode,
      pickFile,
      openStudio,
      remove: removeNode,
      duplicate: duplicateNode,
      toggleCollapsed,
      download: downloadNode,
    }),
    [
      patchData,
      patchParams,
      runNode,
      cancelNode,
      pickFile,
      openStudio,
      removeNode,
      duplicateNode,
      toggleCollapsed,
      downloadNode,
    ],
  );

  /* ------------------------------- 复制粘贴 ------------------------------ */
  /** 只改选中态：写 refs + state，但不记历史、不存盘 */
  const setSelection = useCallback((nextNodes: CanvasFlowNode[]) => {
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
  }, []);

  const selectAll = useCallback(() => {
    setSelection(nodesRef.current.map((n) => ({ ...n, selected: true })));
  }, [setSelection]);

  const doCopy = useCallback(() => {
    const sel = nodesRef.current.filter((n) => n.selected && n.type !== 'groupNode');
    if (sel.length === 0) return;
    setClipboard(sel.map((n) => structuredCloneSafe(n)));
  }, []);

  const doPaste = useCallback(() => {
    if (clipboard.length === 0) return;
    const created: CanvasFlowNode[] = [];
    for (const src of clipboard) {
      const type = (src.type ?? 'uploadNode') as NodeTypeKey;
      const node = createCanvasNode({
        type,
        position: { x: src.position.x + 48, y: src.position.y + 48 },
        data: {
          title: src.data?.title,
          params: src.data?.params ? { ...src.data.params } : undefined,
        },
      });
      node.selected = true;
      created.push(node);
    }
    const nextNodes = [...nodesRef.current.map((n) => ({ ...n, selected: false })), ...created];
    commitGraph(nextNodes, edgesRef.current, { label: 'paste' });
    toast.ok(`已粘贴 ${created.length} 个节点`);
  }, [commitGraph, clipboard, toast]);

  /* ------------------------------ 键盘快捷键 ----------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? '';
      const isEditing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable === true;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z' && !isEditing) {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !isEditing) {
        e.preventDefault();
        doRedo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a' && !isEditing) {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c' && !isEditing) {
        e.preventDefault();
        doCopy();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v' && !isEditing) {
        e.preventDefault();
        doPaste();
        return;
      }
      if (mod && e.key.toLowerCase() === 'g' && !isEditing) {
        e.preventDefault();
        if (e.shiftKey) doUngroup();
        else doGroup();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saverRef.current?.flush();
        return;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [doCopy, doGroup, doPaste, doRedo, doUndo, doUngroup, selectAll]);

  /* -------------------------------- 视图 --------------------------------- */
  const onMoveEnd = useCallback(
    (_e: unknown, vp: Viewport) => {
      setViewport(vp);
      setZoomLabel(Math.round(vp.zoom * 100));
      scheduleSave(nodesRef.current, edgesRef.current);
    },
    [scheduleSave],
  );

  const zoomIn = useCallback(() => void rf.zoomIn({ duration: 160 }), [rf]);
  const zoomOut = useCallback(() => void rf.zoomOut({ duration: 160 }), [rf]);
  const fitView = useCallback(() => void rf.fitView({ padding: 0.22, duration: 220 }), [rf]);
  const resetView = useCallback(() => {
    void rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
  }, [rf]);

  /* ----------------------------- 右键菜单动作 ---------------------------- */
  const handleNodeMenuAction = useCallback(
    (action: string) => {
      const menu = nodeMenu;
      setNodeMenu(null);
      if (!menu) return;
      const id = menu.node.id;
      switch (action) {
        case 'run':
          runNode(id);
          break;
        case 'duplicate':
          duplicateNode(id);
          break;
        case 'group':
          doGroup();
          break;
        case 'ungroup':
          doUngroup(id);
          break;
        case 'external':
          openStudio(id);
          break;
        case 'delete':
          removeNode(id);
          break;
        default:
          break;
      }
    },
    [doGroup, doUngroup, duplicateNode, nodeMenu, openStudio, removeNode, runNode],
  );

  const handlePaneMenuAction = useCallback(
    (action: string) => {
      const pos = paneMenu;
      setPaneMenu(null);
      if (!pos) return;
      switch (action) {
        case 'add':
          setAddOpen(true);
          break;
        case 'paste':
          doPaste();
          break;
        case 'selectAll':
          selectAll();
          break;
        case 'group':
          doGroup();
          break;
        case 'ungroup':
          doUngroup();
          break;
        case 'fit':
          fitView();
          break;
        case 'deleteSelection': {
          const ids = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
          if (ids.length === 0) return;
          const result = removeNodes(nodesRef.current, edgesRef.current, ids);
          commitGraph(result.nodes, result.edges, { label: 'remove-selection' });
          break;
        }
        default:
          break;
      }
    },
    [commitGraph, doGroup, doPaste, doUngroup, fitView, paneMenu, selectAll],
  );

  /* -------------------------------- 渲染 --------------------------------- */
  const undoDepth = historyRef.current.undoDepth();
  const redoDepth = historyRef.current.redoDepth();
  // historyTick 只是为了触发重渲染，让深度数字刷新（引用本身不触发渲染）
  void historyTick;

  const scrollMenu = useCallback((e: ReactMouseEvent | MouseEvent) => {
    const x = Math.min((e as MouseEvent).clientX, window.innerWidth - 340);
    const y = Math.min((e as MouseEvent).clientY, window.innerHeight - 320);
    setPaneMenuPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, []);

  const onPaneContextMenu = useCallback(
    (e: ReactMouseEvent | MouseEvent) => {
      e.preventDefault();
      scrollMenu(e);
      setNodeMenu(null);
      setPaneMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
      setPaneMenuPos({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
    },
    [scrollMenu],
  );

  const onNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: CanvasFlowNode) => {
      e.preventDefault();
      e.stopPropagation();
      const x = Math.min(e.clientX, window.innerWidth - 300);
      const y = Math.min(e.clientY, window.innerHeight - 320);
      setPaneMenu(null);
      setNodeMenu({ node, at: { x: Math.max(8, x), y: Math.max(8, y) } });
    },
    [],
  );

  /* 画布为空时的引导 */
  const isEmpty = nodes.length === 0 && !loading;

  const canGroup = selectedIds.length >= 2;
  const canUngroup = Boolean(selectedGroupId) || selectedIds.some((id) => {
    const n = nodes.find((x) => x.id === id);
    return Boolean(n?.parentId);
  });

  const saveBadge =
    saveState === 'saving' ? (
      <span className="jz-canvas__status-item">
        <Spinner size={10} /> {t('app.saving')}
      </span>
    ) : saveState === 'pending' ? (
      <span className="jz-canvas__status-item jz-canvas__status-dirty">待保存…</span>
    ) : saveState === 'error' ? (
      <span className="jz-canvas__status-item" style={{ color: 'var(--jz-danger-text)' }}>
        <Icon name="alert" size={10} /> 保存失败{saveError ? ` · ${saveError}` : ''}
      </span>
    ) : saveState === 'saved' ? (
      <span className="jz-canvas__status-item jz-canvas__status-saved">
        <Icon name="check" size={10} /> 已保存
        {lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : ''}
      </span>
    ) : null;

  return (
    <NodeActionsContext.Provider value={nodeActions}>
      <div className="jz-canvas">
        {/* ------------------------------ 工具条 ------------------------------ */}
        <div className="jz-canvas__bar">
          <div className="jz-canvas__bar-group">
            <div className="jz-canvas__add">
              <Button
                size="sm"
                variant="primary"
                icon={<Icon name="plus" size={13} />}
                onClick={() => setAddOpen((v) => !v)}
                aria-expanded={addOpen}
              >
                新建节点
              </Button>
              {addOpen ? <AddNodeMenu onPick={addNodeAt} onClose={() => setAddOpen(false)} /> : null}
            </div>
          </div>

          <div className="jz-canvas__bar-group">
            <IconButton label="撤销（Ctrl+Z）" size={16} disabled={undoDepth === 0} onClick={doUndo}>
              <Icon name="refresh" size={15} style={{ transform: 'scaleX(-1)' }} />
            </IconButton>
            <IconButton label="重做（Ctrl+Shift+Z）" size={16} disabled={redoDepth === 0} onClick={doRedo}>
              <Icon name="refresh" size={15} />
            </IconButton>
            <span className="jz-canvas__bar-label" title={`撤销深度上限 ${HISTORY_LIMIT} 步`}>
              {undoDepth}/{HISTORY_LIMIT}
            </span>
          </div>

          <div className="jz-canvas__bar-group">
            <IconButton label="缩小" size={16} onClick={zoomOut}>
              <Icon name="chevronDown" size={15} style={{ transform: 'rotate(-90deg)' }} />
            </IconButton>
            <span className="jz-canvas__zoom">{zoomLabel}%</span>
            <IconButton label="放大" size={16} onClick={zoomIn}>
              <Icon name="chevronDown" size={15} style={{ transform: 'rotate(90deg)' }} />
            </IconButton>
            <IconButton label="适配视图" size={16} onClick={fitView}>
              <Icon name="eye" size={15} />
            </IconButton>
            <IconButton label="重置缩放（100%）" size={16} onClick={resetView}>
              <Icon name="grid" size={15} />
            </IconButton>
          </div>

          <div className="jz-canvas__bar-group">
            <IconButton
              label={locked ? '解锁画布' : '锁定画布'}
              size={16}
              aria-pressed={locked}
              onClick={() => setLocked((v) => !v)}
            >
              <Icon name={locked ? 'stop' : 'play'} size={15} />
            </IconButton>
          </div>

          <div className="jz-canvas__bar-group">
            <IconButton
              label="成组（Ctrl+G）"
              size={16}
              disabled={!canGroup}
              onClick={doGroup}
            >
              <Icon name="layers" size={15} />
            </IconButton>
            <IconButton
              label="解组（Ctrl+Shift+G）"
              size={16}
              disabled={!canUngroup}
              onClick={() => doUngroup()}
            >
              <Icon name="grid" size={15} />
            </IconButton>
          </div>

          <div className="jz-canvas__bar-group">
            <IconButton label="复制（Ctrl+C）" size={16} disabled={selectedIds.length === 0} onClick={doCopy}>
              <Icon name="copy" size={15} />
            </IconButton>
            <IconButton label="粘贴（Ctrl+V）" size={16} disabled={clipboard.length === 0} onClick={doPaste}>
              <Icon name="file" size={15} />
            </IconButton>
            <IconButton
              label="删除选中（Delete）"
              size={16}
              disabled={selectedIds.length === 0}
              onClick={() => {
                const ids = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
                const result = removeNodes(nodesRef.current, edgesRef.current, ids);
                commitGraph(result.nodes, result.edges, { label: 'remove-selection' });
              }}
            >
              <Icon name="trash" size={15} />
            </IconButton>
          </div>

          <div className="jz-canvas__bar-group">
            <IconButton label="保存（Ctrl+S）" size={16} onClick={() => void saverRef.current?.flush()}>
              <Icon name="download" size={15} />
            </IconButton>
          </div>

          <div className="jz-canvas__bar-group" style={{ marginLeft: 'auto', borderRight: 'none' }}>
            {selectedIds.length > 0 ? (
              <Badge tone="accent">已选 {selectedIds.length}</Badge>
            ) : null}
            <Badge>{nodes.length} 节点</Badge>
            <Badge>{edges.length} 连线</Badge>
          </div>
        </div>

        {/* ------------------------------- 画布 ------------------------------- */}
        <div className="jz-canvas__flow">
          {loadError ? (
            <div className="jz-canvas__empty">
              <div className="jz-canvas__empty-title">画布加载失败</div>
              <div className="jz-canvas__empty-hint">{loadError}</div>
              <div className="jz-canvas__empty-actions">
                <Button size="sm" onClick={() => void loadProjects(true)}>
                  重新载入项目
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    loadedProjectRef.current = null;
                    setLoadError(null);
                    void loadProjects(true);
                  }}
                >
                  重试
                </Button>
              </div>
            </div>
          ) : projectsError && !projectId ? (
            <div className="jz-canvas__empty">
              <div className="jz-canvas__empty-title">项目列表不可用</div>
              <div className="jz-canvas__empty-hint">{projectsError}</div>
            </div>
          ) : (
            <>
              <ReactFlow
                nodes={nodes}
                edges={edges as never}
                nodeTypes={allNodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                isValidConnection={isValidConnection}
                onPaneClick={() => {
                  setPaneMenu(null);
                  setQuickConnect(null);
                }}
                onPaneContextMenu={onPaneContextMenu}
                onNodeContextMenu={onNodeContextMenu}
                onMoveEnd={onMoveEnd}
                defaultViewport={viewport}
                nodesDraggable={!locked}
                nodesConnectable={!locked}
                elementsSelectable={!locked}
                panOnDrag={locked ? false : [1, 2]}
                selectionOnDrag
                multiSelectionKeyCode="Shift"
                deleteKeyCode={null}
                snapToGrid
                snapGrid={[8, 8]}
                minZoom={0.2}
                maxZoom={2.5}
                proOptions={{ hideAttribution: false }}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                connectionRadius={28}
                fitView={false}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={22}
                  size={1}
                  color="var(--jz-grid-dot)"
                  bgColor="transparent"
                />
                <Controls showInteractive={false} position="bottom-left" />
                <MiniMap
                  pannable
                  zoomable
                  position="bottom-right"
                  nodeColor={() => 'var(--jz-bg-layer-3)'}
                  nodeStrokeColor={() => 'var(--jz-border-strong)'}
                  maskColor="var(--jz-scrim)"
                />
                <Panel position="top-right">
                  <div className="jz-canvas__zoom-panel">
                    {locked ? <Badge tone="warn">已锁定</Badge> : null}
                  </div>
                </Panel>
              </ReactFlow>

              {/* 空画布引导 */}
              {isEmpty ? (
                <div className="jz-canvas__empty">
                  {loading ? (
                    <>
                      <Spinner />
                      <div className="jz-canvas__empty-hint">{t('canvas.loading')}</div>
                    </>
                  ) : (
                    <>
                      <div className="jz-canvas__empty-title">画布是空的</div>
                      <div className="jz-canvas__empty-hint">
                        从「新建节点」开始，或从右侧拖出一条线：只有端口类型兼容的节点会被列出来。
                      </div>
                      <div className="jz-canvas__empty-actions">
                        <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
                          新建节点
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setLocked(false)}>
                          解锁画布
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* ------------------------------ 状态栏 ------------------------------ */}
        <div className="jz-canvas__status">
          <span className="jz-canvas__status-item">
            <Icon name="canvas" size={11} /> {nodes.length} 节点 · {edges.length} 连线
          </span>
          <span className="jz-canvas__status-item">缩放 {zoomLabel}%</span>
          {selectedIds.length > 0 ? (
            <span className="jz-canvas__status-item">已选 {selectedIds.length}</span>
          ) : null}
          {locked ? <span className="jz-canvas__status-item">画布已锁定</span> : null}
          <span className="jz-canvas__status-spacer" />
          {loading ? (
            <span className="jz-canvas__status-item">
              <Spinner size={10} /> {t('canvas.loading')}
            </span>
          ) : null}
          {saveBadge}
          <span className="jz-canvas__status-item">自动保存 800ms · 撤销 {HISTORY_LIMIT} 步</span>
        </div>

        {/* ---------------------------- 浮动菜单 ----------------------------- */}
        {paneMenu ? (
          <PaneContextMenu
            at={paneMenuPos}
            hasSelection={selectedIds.length > 0}
            canGroup={canGroup}
            canUngroup={canUngroup}
            hasClipboard={clipboard.length > 0}
            onAction={handlePaneMenuAction}
            onClose={() => setPaneMenu(null)}
          />
        ) : null}

        {nodeMenu ? (
          <NodeContextMenu
            node={nodeMenu.node}
            canGroup={canGroup}
            canUngroup={canUngroup || nodeMenu.node.type === 'groupNode'}
            at={nodeMenu.at}
            onAction={handleNodeMenuAction}
            onClose={() => setNodeMenu(null)}
          />
        ) : null}

        {/* ---------------- 拖线到空白处：只列能接住的节点 ---------------- */}
        {quickConnect ? (
          <QuickConnectMenu
            at={quickConnect.screen}
            targets={quickConnect.targets}
            onPick={pickQuickTarget}
            onClose={() => setQuickConnect(null)}
          />
        ) : null}
      </div>
    </NodeActionsContext.Provider>
  );
}

/* ========================================================================== */
/* 子组件：拖线到空白处的候选菜单                                               */
/* ========================================================================== */

function QuickConnectMenu({
  at,
  targets,
  onPick,
  onClose,
}: {
  at: { x: number; y: number };
  targets: QuickTarget[];
  onPick: (t: QuickTarget) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (targets.length === 0) return null;

  return (
    <div
      className="jz-ctxmenu"
      ref={ref}
      style={{ left: Math.min(at.x, window.innerWidth - 340), top: Math.min(at.y, window.innerHeight - 360) }}
      role="menu"
      aria-label="可连接的节点"
    >
      <div className="jz-ctxmenu__title">
        <Icon name="zap" size={11} />
        可连接的节点（{targets.length}）
      </div>
      {targets.map((t) => (
        <button
          key={t.nodeType}
          type="button"
          role="menuitem"
          className="jz-ctxmenu__item"
          onClick={() => onPick(t)}
        >
          <Icon name={getDefinition(t.nodeType)?.icon ?? 'plus'} size={12} />
          {t.label}
          <span className="jz-ctxmenu__kind">{PORT_KIND_LABELS[t.kind]}</span>
        </button>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* 辅助                                                                        */
/* ========================================================================== */

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/* ========================================================================== */
/* 对外默认导出                                                                */
/* ========================================================================== */

/**
 * 画布区域。默认导出、零必填 props、自己铺满父容器 —— 与占位实现契约一致。
 */
export default function CanvasArea() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

/** 供测试/调试：注册表 type 列表与端口矩阵的快速导出 */
export { NODE_TYPE_KEYS, CATEGORY_ORDER };