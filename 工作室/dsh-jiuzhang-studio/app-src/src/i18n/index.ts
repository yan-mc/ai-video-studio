/**
 * i18n 入口 —— 目前只有中文（zh）。
 *
 * 设计要点：
 *  - 不做复数/插值库依赖，只有一个极小的 {name} 占位替换。
 *  - 新增语言时在 ./en.ts 里按 Zh 的同构结构写一份，再在 LOCALES 里注册。
 *  - 文案取用一律走 useT()，不要在组件里写中文字面量。
 */
import { zh } from './zh';
import type { LocaleDict } from './zh';

export const LOCALES = { zh } as const;
export type LocaleId = keyof typeof LOCALES;

export const DEFAULT_LOCALE: LocaleId = 'zh';

/** 点号路径取字符串，如 t('projects.empty') */
export function resolveMessage(dict: LocaleDict, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** 极简插值：{name} → params.name；缺失键回退到路径本身（便于发现漏配） */
export function translate(
  locale: LocaleId,
  path: string,
  params?: Record<string, string | number>,
): string {
  const dict = LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
  let msg = resolveMessage(dict as LocaleDict, path) ?? path;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.split(`{${k}}`).join(String(v));
    }
  }
  return msg;
}

export { zh };
export type { LocaleDict };