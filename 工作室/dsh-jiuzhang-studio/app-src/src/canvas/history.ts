/**
 * 画布历史栈 —— 撤销/重做，**上限 12 步**（参考实现 titleBar 的 undo/redo 深度）。
 *
 * 为什么不用 zustand：历史是画布局部状态，且快照很大（nodes+edges 整体），
 * 放进全局 store 会让别的页面也持有大对象；用 useRef + 简单类足够。
 *
 * 快照策略：**整图快照**（nodes + edges），不做 diff。
 *   理由：26 种节点 data 结构各异，做 diff 很容易漏字段导致撤销后"参数回退不完整"；
 *   整图快照最坏也就几十 KB × 12 份，完全可接受，换来的是绝对不会错。
 *
 * 合并策略（关键，否则一次拖动会塞满 12 步）：
 *   · position 连续变化（拖节点）→ 同一 key 内合并
 *   · 参数输入连续变化（打字）→ 同一 key 内合并
 *   · 其它（增删节点/连线）→ 每次独立一步
 */

export interface HistorySnapshot<T> {
  nodes: T[];
  edges: unknown[];
  /** 记录时的动作类型，仅用于调试 */
  label: string;
}

export const HISTORY_LIMIT = 12;

export class HistoryStack<T> {
  private past: HistorySnapshot<T>[] = [];
  private future: HistorySnapshot<T>[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;
  /** 同一 key 的合并窗口（毫秒）：打字 400ms 内视为同一次编辑 */
  readonly mergeWindowMs: number;
  readonly limit: number;

  constructor(limit = HISTORY_LIMIT, mergeWindowMs = 400) {
    this.limit = Math.max(1, Math.floor(limit));
    this.mergeWindowMs = Math.max(0, mergeWindowMs);
  }

  /**
   * 压入一份快照。
   *
   * ⚠️ 语义：快照是**这次编辑之前**的状态。
   *   调用方必须在应用新状态之前，把旧状态交进来。
   *   历史实现把"编辑后"的状态压进来，于是 undo 弹出的是当前状态本身
   *   → 第一次撤销画面没有任何变化，第二次才动，且初始状态永久丢失。
   *
   * @param key 合并键；相同 key 且在窗口内不新增条目（保留最早的撤销目标）
   */
  push(snapshot: HistorySnapshot<T>, key: string | null = null): void {
    const now = Date.now();
    const canMerge =
      key !== null && key === this.lastKey && now - this.lastAt <= this.mergeWindowMs && this.past.length > 0;

    this.lastKey = key;
    this.lastAt = now;

    if (canMerge) {
      // 合并：**保留栈顶**（连续编辑期间最早的撤销目标不能丢），只让重做失效
      this.future = [];
      return;
    }

    this.past.push(snapshot);
    if (this.past.length > this.limit) {
      this.past.splice(0, this.past.length - this.limit);
    }
    this.future = [];
  }

  /** 撤销：返回上一份快照；把"当前状态"交给调用方压进 future */
  undo(current: HistorySnapshot<T>): HistorySnapshot<T> | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    if (this.future.length > this.limit) this.future.splice(0, this.future.length - this.limit);
    this.lastKey = null;
    this.lastAt = 0;
    return prev;
  }

  /** 重做 */
  redo(current: HistorySnapshot<T>): HistorySnapshot<T> | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    if (this.past.length > this.limit) this.past.splice(0, this.past.length - this.limit);
    this.lastKey = null;
    this.lastAt = 0;
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  /** 当前可撤销步数（状态栏显示） */
  undoDepth(): number {
    return this.past.length;
  }

  redoDepth(): number {
    return this.future.length;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastKey = null;
    this.lastAt = 0;
  }

  /** 供调试/测试 */
  snapshot(): { past: number; future: number } {
    return { past: this.past.length, future: this.future.length };
  }
}

/** 深拷贝 nodes/edges（结构化克隆，保证快照不被后续 mutate 污染） */
export function cloneGraph<N, E>(nodes: N[], edges: E[]): { nodes: N[]; edges: E[] } {
  if (typeof structuredClone === 'function') {
    return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
  }
  return {
    nodes: JSON.parse(JSON.stringify(nodes)) as N[],
    edges: JSON.parse(JSON.stringify(edges)) as E[],
  };
}

/** 从 React Flow 的 change 列表里提炼出"是否值得记历史" */
export function historyKeyOf(changes: ReadonlyArray<{ type: string }>): string | null {
  if (changes.length === 0) return null;
  const types = new Set(changes.map((c) => c.type));
  if (types.size === 1 && types.has('select')) return null; // 纯选择不记历史
  if (types.size === 1 && types.has('position')) return 'position';
  if (types.size === 1 && types.has('dimensions')) return 'dimensions';
  return null; // 增删等结构性变更 → 独立一步
}