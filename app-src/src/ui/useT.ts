/**
 * 翻译 hook —— 组件统一通过它取中文文案。
 *
 * 当前只有 zh 一种语言，但保留 locale 参数以便后续加 en 时不用改组件。
 */
import { useCallback } from 'react';
import { DEFAULT_LOCALE, translate } from '../i18n';
import type { LocaleId } from '../i18n';

export interface TFn {
  (path: string, params?: Record<string, string | number>): string;
}

export function useT(locale: LocaleId = DEFAULT_LOCALE): TFn {
  return useCallback<TFn>((path, params) => translate(locale, path, params), [locale]);
}

export default useT;