/**
 * hash 路由 —— 不用 React Router 的原因：
 *  1) SPA 由 Host 静态服务托管，hash 路由不需要任何服务端 fallback 配置；
 *  2) 只有 6 个顶级路由，自己解析 20 行就够，少一个依赖。
 *
 * 约定：
 *   地址形如 `#/canvas`、`#/h3`，默认 `#/canvas`。
 *   未知路由回退到 canvas 并在控制台警告（不让用户卡在白屏）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export const ROUTES = ['canvas', 'assets', 'projects', 'h3', 'script', 'comic', 'settings', 'jobs', 'previz'] as const;
export type RouteId = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: RouteId = 'canvas';

export function isRouteId(v: string): v is RouteId {
  return (ROUTES as readonly string[]).includes(v);
}

/** 从 location.hash 解析路由；'#/h3?...' 这类带参形式也支持 */
export function parseHash(hash: string): RouteId {
  const raw = hash.replace(/^#/, '').replace(/^\/+/, '');
  const path = raw.split('?')[0]?.split('/')[0] ?? '';
  return isRouteId(path) ? path : DEFAULT_ROUTE;
}

export function routeToHash(route: RouteId): string {
  return `#/${route}`;
}

export interface RouterApi {
  route: RouteId;
  navigate: (route: RouteId) => void;
}

/** 订阅 hashchange；同 tab 内用 location.hash 赋值触发，跨 tab 也一致 */
export function useRouter(): RouterApi {
  const [route, setRoute] = useState<RouteId>(() =>
    typeof window === 'undefined' ? DEFAULT_ROUTE : parseHash(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    // 首次进入无 hash 时补一个，保证地址栏可复制
    if (!window.location.hash || parseHash(window.location.hash) === DEFAULT_ROUTE) {
      if (window.location.hash !== routeToHash(DEFAULT_ROUTE)) {
        window.history.replaceState(null, '', routeToHash(DEFAULT_ROUTE));
      }
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: RouteId) => {
    const target = routeToHash(next);
    if (window.location.hash === target) return;
    window.location.hash = target;
  }, []);

  return useMemo(() => ({ route, navigate }), [route, navigate]);
}

/** 非 hook 版本：供需要在模块级跳转的地方用 */
export function navigateTo(route: RouteId): void {
  if (typeof window === 'undefined') return;
  window.location.hash = routeToHash(route);
}

