/**
 * SSE 事件订阅 —— 让网页实时反映 DSH Agent 的改动。
 *
 * ============================================================================
 * 为什么用 SSE 而不是轮询
 * ============================================================================
 *
 * 轮询（2-3 秒一次）的问题是：
 *   · 批量续写进行中，进度条卡顿
 *   · 每次轮询都要拉全量 shots.json（实测单次 321 KB）
 *
 * SSE 只需一条长连接，服务端主动推。EventSource 浏览器原生支持，断线自动重连。
 *
 * ============================================================================
 * 连接状态必须可订阅（历史 P1）
 * ============================================================================
 *
 * 旧实现导出 `eventsConnected(): boolean`，但它读的是 `source.readyState`——
 * **不是响应式状态**。RenderPage 在渲染期调一次拿到 false（连接还没建立），
 * 之后连接建立了也没有任何 setState 触发重渲染，于是「实时同步」徽章
 * **永远显示离线**，用户以为实时功能坏了。
 *
 * 现在：连接状态放在一个可订阅的 store 里，用 `useSyncExternalStore` 消费。
 * 同时修了另外两个问题：
 *   · 退避重连（旧实现固定 3 秒 + 无上限，Host 挂掉时刷屏）；
 *   · 清理时 `handlers.clear()` 会误删**刚刚注册**的 handler
 *     （StrictMode 双挂载 / 快速切页会撞上）。
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
 *   // 连接状态（响应式）
 *   const connected = useStudioEventsConnected();
 *
 * @module api/events
 */
import { useSyncExternalStore } from 'react';

/** 后端事件 */
export type StudioEvent =
  | { type: 'hello'; clients: number }
  | { type: 'shot-updated'; projectId: string; shotId: string; patch?: unknown }
  | { type: 'batch-progress'; batchId: string; current: number; total: number; status: string }
  | { type: 'replace-progress'; taskId: string; current: number; total: number; status: string }
  | { type: 'ping' };

export type EventHandler = (e: StudioEvent) => void;

/* --------------------------------------------------------------- 状态 */

type Status = 'idle' | 'connecting' | 'open' | 'closed';

let status: Status = 'idle';
const statusListeners = new Set<() => void>();

function setStatus(next: Status) {
  if (status === next) return;
  status = next;
  for (const l of statusListeners) {
    try { l(); } catch { /* ignore */ }
  }
}

/* --------------------------------------------------------------- 连接 */

/** 单例连接（多个组件共用一个 EventSource） */
let source: EventSource | null = null;
const handlers = new Set<EventHandler>();
let refCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 1000;

/** 重连退避上限（避免 Host 长期离线时每 3 秒打一次） */
const MAX_BACKOFF_MS = 30000;

function scheduleReconnect() {
  if (reconnectTimer || refCount <= 0) return;
  const delay = retryDelay;
  retryDelay = Math.min(MAX_BACKOFF_MS, Math.round(retryDelay * 1.7));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (refCount > 0) ensureSource();
  }, delay);
}

/**
 * 建立到后端的 SSE 连接。
 * 路径用相对路径（同源自动适配 DSH 的随机端口），与 api/client.ts 的 API_BASE 一致。
 */
function ensureSource() {
  if (source) return;
  if (typeof window === 'undefined') return;

  setStatus('connecting');
  try {
    source = new EventSource('/jiuzhang/api/events');
  } catch {
    source = null;
    setStatus('closed');
    scheduleReconnect();
    return;
  }

  source.onopen = () => {
    retryDelay = 1000;          // 连上就重置退避
    setStatus('open');
  };

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
    setStatus('closed');
    // EventSource 自带重连，但连接彻底失效时要重建
    if (source && source.readyState === EventSource.CLOSED) {
      try { source.close(); } catch { /* ignore */ }
      source = null;
      scheduleReconnect();
    }
  };
}

/* --------------------------------------------------------------- 订阅 */

/**
 * 订阅事件。返回取消订阅函数。
 */
export function subscribeEvents(handler: EventHandler): () => void {
  handlers.add(handler);
  refCount++;
  ensureSource();

  return () => {
    // ⚠️ 只删自己这一个。旧实现在 refCount 归零时 `handlers.clear()`，
    //    而 StrictMode 的双挂载 / 快速切页会出现「旧的先清理、新的已注册」
    //    的交错顺序 —— clear() 会把新注册的 handler 一起删掉，事件静默丢失。
    handlers.delete(handler);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      if (source) { try { source.close(); } catch { /* ignore */ } source = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      setStatus('idle');
    }
  };
}

/* --------------------------------------------------------------- 状态订阅 */

function subscribeStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => { statusListeners.delete(cb); };
}

/** 当前是否已连接（**非响应式**，仅供调试与非渲染逻辑） */
export function eventsConnected(): boolean {
  return status === 'open';
}

/** 当前连接状态字符串 */
export function eventsStatus(): Status {
  return status;
}

/**
 * 响应式连接状态 —— 组件里用这个，不要用 eventsConnected()。
 *
 * 用 `useSyncExternalStore` 而不是 useState + useEffect：
 * 前者在首次渲染就能拿到正确的服务端快照，不会闪一帧"离线"。
 */
export function useStudioEventsConnected(): boolean {
  return useSyncExternalStore(
    subscribeStatus,
    () => status === 'open',
    () => false,
  );
}