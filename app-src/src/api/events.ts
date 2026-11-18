/**
 * SSE 事件订阅 —— 让网页实时反映 DSH Agent 的改动。
 *
 * ============================================================================
 * 为什么用 SSE 而不是轮询
 * ============================================================================
 *
 * 轮询（2-3 秒一次）的问题是：
 *   · 批量续写进行中，进度条卡顿
 *   · 每次轮询都要拉全量 shots.json
 *
 * SSE 只需一条长连接，服务端主动推。EventSource 浏览器原生支持，
 * 断线自动重连。
 *
 * ============================================================================
 * 用法
 * ============================================================================
 *
 *   useEffect(() => {
 *     const off = subscribeEvents((e) => {
 *       if (e.type === 'shot-updated') void reload();
 *     });
 *     return off;
 *   }, [reload]);
 *
 * @module api/events
 */

/** 后端事件 */
export type StudioEvent =
  | { type: 'hello'; clients: number }
  | { type: 'shot-updated'; projectId: string; shotId: string; patch?: unknown }
  | { type: 'job-progress'; jobId: string; status: string; percent?: number; output?: string }
  | { type: 'batch-progress'; batchId: string; current: number; total: number; status: string }
  | { type: 'config-updated'; keys: string[] }
  | { type: 'ping' };

export type EventHandler = (e: StudioEvent) => void;

/** 单例连接（多个组件共用一个 EventSource） */
let source: EventSource | null = null;
const handlers = new Set<EventHandler>();
let refCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 建立到后端的 SSE 连接。
 *
 * 注意：路径用相对路径（同源自动适配随机端口），与 api/client.ts 的
 * API_BASE 保持一致。
 */
function ensureSource() {
  if (source) return;
  if (typeof window === 'undefined') return;

  try {
    source = new EventSource('/jiuzhang/api/events');
  } catch {
    source = null;
    return;
  }

  source.onmessage = (ev) => {
    let parsed: StudioEvent | null = null;
    try {
      parsed = JSON.parse(ev.data) as StudioEvent;
    } catch {
      return;
    }
    if (!parsed) return;
    // ping 只用于保活，不打扰订阅者
    if (parsed.type === 'ping') return;
    for (const h of handlers) {
      try { h(parsed); } catch { /* 单个订阅者出错不影响其他 */ }
    }
  };

  source.onerror = () => {
    // EventSource 自带重连，但连接彻底失效时要重建
    if (source && source.readyState === EventSource.CLOSED) {
      source = null;
      if (refCount > 0 && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (refCount > 0) ensureSource();
        }, 3000);
      }
    }
  };
}

/**
 * 订阅事件。返回取消订阅函数。
 */
export function subscribeEvents(handler: EventHandler): () => void {
  handlers.add(handler);
  refCount++;
  ensureSource();

  return () => {
    handlers.delete(handler);
    refCount--;
    if (refCount <= 0) {
      refCount = 0;
      handlers.clear();
      if (source) { source.close(); source = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    }
  };
}

/** 当前是否已连接（供 UI 显示绿点） */
export function eventsConnected(): boolean {
  return Boolean(source && source.readyState === EventSource.OPEN);
}
