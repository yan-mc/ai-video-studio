/**
 * 节点 → 画布的动作通道。
 *
 * 为什么用 Context 而不是 props：
 *   React Flow 只把 `NodeProps` 传给节点组件，我们无法在 nodeTypes 映射里额外注入
 *   回调（nodeTypes 是静态对象，且节点组件必须保持"纯展示"）。
 *   用 Context 让 CanvasArea 统一持有动作实现，节点组件只负责调用，
 *   这样单个节点组件可以独立渲染（无 Provider 时自动退化为 no-op），便于单测/预览。
 *
 * 约束：动作实现**全部在 CanvasArea 内**完成（它持有 nodes/edges 真源），
 * 节点组件不得自己 fetch。
 */
import { createContext, useContext } from 'react';
import type { CanvasNodeData } from './types';

/** 文件选择类型 */
export type FilePickKind = 'image' | 'audio' | 'video';

export interface NodeActions {
  /** 合并（浅合并）节点 data */
  patchData: (nodeId: string, patch: Partial<CanvasNodeData>) => void;
  /** 合并节点 data.params */
  patchParams: (nodeId: string, patch: Record<string, unknown>) => void;
  /** 触发该节点的生成/执行 */
  run: (nodeId: string) => void;
  /** 取消正在跑的节点任务 */
  cancel: (nodeId: string) => void;
  /** 打开本地文件选择并回填到节点 */
  pickFile: (nodeId: string, kind: FilePickKind) => void;
  /** 打开关联的子工作台（导演台/预演/姿势台/剧集画布） */
  openStudio: (nodeId: string) => void;
  /** 删除节点 */
  remove: (nodeId: string) => void;
  /** 复制节点（含参数） */
  duplicate: (nodeId: string) => void;
  /** 折叠/展开参数区 */
  toggleCollapsed: (nodeId: string) => void;
  /** 把节点产物下载到本地 */
  download: (nodeId: string) => void;
}

const NOOP: NodeActions = {
  patchData: () => {},
  patchParams: () => {},
  run: () => {},
  cancel: () => {},
  pickFile: () => {},
  openStudio: () => {},
  remove: () => {},
  duplicate: () => {},
  toggleCollapsed: () => {},
  download: () => {},
};

export const NodeActionsContext = createContext<NodeActions>(NOOP);

/** 节点组件内取动作；没有 Provider 时拿到安全的 no-op */
export function useNodeActions(): NodeActions {
  return useContext(NodeActionsContext);
}

export { NOOP as NOOP_NODE_ACTIONS };