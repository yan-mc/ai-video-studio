/**
 * 自动保存 —— debounce 800ms 后 PATCH `/projects/:id`（实际走后端约定：POST 同路径）。
 *
 * 三个必须处理的坑：
 *  1. **写令牌**：后端 guard() 对写方法强制 X-JZ-Token，由 api/client.ts 自动补，
 *     这里只要走 api 封装就安全，绝不自己 fetch。
 *  2. **并发/乱序**：用户改得快时会有多个保存请求在飞。必须串行化（同一时间只跑一个），
 *     并且"最后一次编辑"必达；否则会出现"后发的请求先到 → 老数据覆盖新数据"。
 *  3. **项目切换/卸载**：切到别的项目时，pending 的保存必须 flush 给**旧**项目 id，
 *     不能把旧画布写进新项目（这是最容易出的数据事故）。
 *
 * 因此实现为一个小状态机 + 队列，而不是裸 setTimeout。
 */

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface SavePayload {
  nodes: unknown[];
  edges: unknown[];
  viewport?: unknown;
  nodeCount: number;
}

export interface AutosaveOptions<T extends SavePayload> {
  /** debounce 毫秒数（默认 800） */
  delayMs?: number;
  /** 实际执行保存的函数（注入以便测试） */
  save: (projectId: string, payload: T) => Promise<void>;
  /** 状态变化回调（驱动状态栏） */
  onState?: (state: SaveState, error?: string) => void;
  /** 保存成功回调 */
  onSaved?: (projectId: string) => void;
}

export const AUTOSAVE_DELAY_MS = 800;

/**
 * 自动保存调度器。
 *
 * 用法：
 *   const saver = new Autosave({ save: (id, p) => api.updateProject(id, p) });
 *   saver.schedule(projectId, payload);   // 每次变更后调
 *   await saver.flush();                  // 切项目/卸载前调
 */
export class Autosave<T extends SavePayload> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { projectId: string; payload: T } | null = null;
  /** 正在飞行的保存（用于串行化） */
  private inFlight: Promise<void> | null = null;
  /** 正在保存的项目 id —— flush 时需要知道该写谁 */
  private inFlightProject: string | null = null;
  private disposed = false;
  private readonly opts: Required<Pick<AutosaveOptions<T>, 'delayMs'>> & AutosaveOptions<T>;

  constructor(options: AutosaveOptions<T>) {
    this.opts = { delayMs: AUTOSAVE_DELAY_MS, ...options };
  }

  /** 收到变更：覆盖 pending 并重置计时器（debounce 语义） */
  schedule(projectId: string, payload: T): void {
    if (this.disposed || !projectId) return;
    // 换了项目：先把旧的存掉，绝不能让旧 payload 被新项目覆盖
    if (this.pending && this.pending.projectId !== projectId) {
      const stale = this.pending;
      this.pending = null;
      void this.runNow(stale.projectId, stale.payload);
    }
    this.pending = { projectId, payload };
    this.opts.onState?.('pending');
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.delayMs);
  }

  /** 立即保存 pending（切项目、卸载、快捷键 Ctrl+S 时调） */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const job = this.pending;
    this.pending = null;
    if (job) await this.runNow(job.projectId, job.payload);
    // 若已有一次保存在飞，等它结束（保证顺序）
    if (this.inFlight) await this.inFlight.catch(() => {});
  }

  private async runNow(projectId: string, payload: T): Promise<void> {
    // 串行化：先等前一次结束
    if (this.inFlight) {
      await this.inFlight.catch(() => {});
    }
    this.inFlightProject = projectId;
    this.opts.onState?.('saving');
    const task = (async () => {
      try {
        await this.opts.save(projectId, payload);
        this.opts.onState?.('saved');
        this.opts.onSaved?.(projectId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.opts.onState?.('error', message);
        throw err;
      }
    })();
    this.inFlight = task.then(
      () => {
        this.inFlight = null;
        this.inFlightProject = null;
      },
      () => {
        this.inFlight = null;
        this.inFlightProject = null;
      },
    );
    await this.inFlight;
  }

  /** 是否有未落盘的变更 */
  hasPending(): boolean {
    return this.pending !== null;
  }

  /** 正在保存的项目（调试/测试用） */
  savingProject(): string | null {
    return this.inFlightProject;
  }

  /** 卸载：flush 后停止接受新任务 */
  async dispose(): Promise<void> {
    await this.flush().catch(() => {});
    this.disposed = true;
  }
}

/**
 * 计算需要写回后端的 payload。
 * nodeCount 由调用方从真实节点数填（后端 projectSummary 会直接用它做列表徽标）。
 */
export function buildPayload(
  nodes: ReadonlyArray<unknown>,
  edges: ReadonlyArray<unknown>,
  viewport: unknown,
): SavePayload {
  return {
    nodes: nodes.slice(),
    edges: edges.slice(),
    viewport: viewport ?? null,
    nodeCount: nodes.length,
  };
}