/**
 * 轻量 Toast —— 没有第三方依赖，全局一个 Provider + 一个 store。
 *
 * 用法：
 *   const toast = useToast();
 *   toast.ok('已保存');
 *   toast.error(err);
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'ok' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  /** 毫秒；0 表示不自动关闭 */
  duration: number;
}

type Listener = (items: ToastItem[]) => void;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = items.slice();
  for (const l of listeners) l(snapshot);
}

function push(tone: ToastTone, message: string, duration: number): number {
  const id = nextId++;
  items = [...items, { id, tone, message, duration }];
  emit();
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: number): void {
  const before = items.length;
  items = items.filter((t) => t.id !== id);
  if (items.length !== before) emit();
}

export interface ToastApi {
  ok: (message: string, duration?: number) => number;
  error: (message: string, duration?: number) => number;
  info: (message: string, duration?: number) => number;
  dismiss: (id: number) => void;
}

const api: ToastApi = {
  ok: (message, duration = 2600) => push('ok', message, duration),
  error: (message, duration = 5000) => push('error', message, duration),
  info: (message, duration = 3000) => push('info', message, duration),
  dismiss,
};

export function useToast(): ToastApi {
  return api;
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>(() => items.slice());

  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  const rendered = useMemo<ReactNode>(
    () =>
      list.map((t) => (
        <div
          key={t.id}
          className={['jz-toast', t.tone !== 'info' ? `jz-toast--${t.tone}` : '']
            .filter(Boolean)
            .join(' ')}
          role="status"
          onClick={() => dismiss(t.id)}
        >
          <span style={{ flex: '1 1 auto' }}>{t.message}</span>
        </div>
      )),
    [list],
  );

  return (
    <div className="jz-toasts" aria-live="polite">
      {rendered}
    </div>
  );
}

export default Toaster;