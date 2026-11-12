/**
 * node 加载 .ts 源码的解析钩子。
 *
 * 为什么需要它：
 *   源码里用的是 bundler 风格的**无扩展名相对导入**（`from './portTypes'`），
 *   这是 Vite/TS 的约定，但 node 的 ESM 解析要求写全扩展名。
 *   node 24 自带 type-stripping（能直接跑 .ts），但不会替你补扩展名，
 *   所以这里加一层 resolve 钩子：只在相对导入且无扩展名时补 `.ts` / `.mjs`。
 *
 * 副作用范围：仅测试进程；生产构建完全走 Vite，与此无关。
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HAS_EXT = /\.(?:m?js|cjs|json|ts|mts|cts|tsx)$/;

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !HAS_EXT.test(specifier)
  ) {
    const base = new URL(specifier, context.parentURL);
    const candidates = [`${base.href}.ts`, `${base.href}.mjs`, `${base.href}/index.ts`];
    for (const candidate of candidates) {
      try {
        if (existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate, context);
        }
      } catch {
        /* 非法 URL，忽略 */
      }
    }
  }
  return nextResolve(specifier, context);
}