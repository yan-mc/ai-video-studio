/**
 * i18n 入口 —— **当前只有中文（zh）**。
 *
 * 现状说明（不要被"看起来支持多语言"误导）：
 *  - 实际只注册了 `zh` 一个语言；界面没有语言切换入口。
 *  - 根目录的 `locale/zh.json` / `locale/en.json` 是**DSH 插件元信息**
 *    （插件名与描述），与本文件无关，两者不是同一套机制。
 *  - `translate()` 的 `locale` 参数目前恒为 'zh'，保留它是为了将来加语言
 *    时不用改调用方签名。
 *
 * 设计要点：
 *  - 不做复数/插值库依赖，只有一个极小的 {name} 占位替换。
 *  - 新增语言时在 ./en.ts 里按 Zh 的同构结构写一份，再在 LOCALES 里注册；
 *    无需改动任何组件（组件一律走 useT()）。
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