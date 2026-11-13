/**
 * hash 路由 —— 不用 React Router 的原因：
 *  1) SPA 由 Host 静态服务托管，hash 路由不需要任何服务端 fallback 配置；
 *  2) 只有 6 个顶级路由，自己解析 20 行就够，少一个依赖。
 *
 * 约定：
 *   地址形如 `#/canvas`、`#/render`，默认 `#/render`。
 *   未知路由回退到 canvas 并在控制台警告（不让用户卡在白屏）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * 路由表 —— 按「制作 / 资源 / 工具 / 系统」组织。
 *
 * 已移除的路由（保留在文件里做 301 回退，避免旧链接白屏）：
 *   h3      → 剧本页的"剧本拆解" tab
 *   prompt  → 渲染页的提示词编辑器
 *   director→ 3D 预演（与 previz 合并）
 *   toolbox → 拆散到设置 / 渲染
 */
export const ROUTES = [
  // 制作
  'render', 'script', 'comic', 'mw',
  // 资源
  'assets', 'vault', 'projects',
  // 工具
  'breakdown', 'previz', 'canvas', 'image',
  // 系统
  'jobs', 'settings',
] as const;
export type RouteId = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: RouteId = 'render';

/** 旧路由 → 新路由（书签兼容） */
const LEGACY_ROUTES: Record<string, RouteId> = {
  h3: 'script',
  prompt: 'render',
  director: 'previz',
  toolbox: 'settings',
};

export function isRouteId(v: string): v is RouteId {
  return (ROUTES as readonly string[]).includes(v);
}

/** 从 location.hash 解析路由；旧路由自动映射到新位置 */
export function parseHash(hash: string): RouteId {
  const raw = hash.replace(/^#/, '').replace(/^\/+/, '');
  const path = raw.split('?')[0]?.split('/')[0] ?? '';
  if (isRouteId(path)) return path;
  if (LEGACY_ROUTES[path]) return LEGACY_ROUTES[path];
  return DEFAULT_ROUTE;
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







