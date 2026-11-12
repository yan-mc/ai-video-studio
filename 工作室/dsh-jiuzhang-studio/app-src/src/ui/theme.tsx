/**
 * 主题系统 —— 双主题 + 四强调色 + 密度，全部通过 <html> 的 data-* 属性驱动 CSS 变量。
 *
 * 为什么不用 React Context 传颜色：React Flow 等三方组件要读 CSS 变量，
 * 纯 CSS 变量方案能让它们无需感知 React 也能跟随主题。
 * Context 只负责"当前是什么主题"这一状态本身。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export const THEMES = ['inknight', 'xuanpaper'] as const;
export type ThemeId = (typeof THEMES)[number];

export const ACCENTS = ['cinnabar', 'indigo', 'gold', 'pine'] as const;
export type AccentId = (typeof ACCENTS)[number];

export const DENSITIES = ['comfort', 'compact'] as const;
export type DensityId = (typeof DENSITIES)[number];

export interface ThemeState {
  theme: ThemeId;
  accent: AccentId;
  density: DensityId;
}

export const DEFAULT_THEME: ThemeState = {
  theme: 'inknight',
  accent: 'cinnabar',
  density: 'comfort',
};

const STORAGE_KEY = 'jz.appearance.v1';

function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v);
}
function isAccentId(v: unknown): v is AccentId {
  return typeof v === 'string' && (ACCENTS as readonly string[]).includes(v);
}
function isDensityId(v: unknown): v is DensityId {
  return typeof v === 'string' && (DENSITIES as readonly string[]).includes(v);
}

function loadTheme(): ThemeState {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME.theme,
      accent: isAccentId(parsed.accent) ? parsed.accent : DEFAULT_THEME.accent,
      density: isDensityId(parsed.density) ? parsed.density : DEFAULT_THEME.density,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

let cachedTheme: ThemeState | null = null;

/** 供模块级代码（如 React Flow 的 colorMode）读取当前主题，无需 hook */
export function getThemeSnapshot(): ThemeState {
  if (!cachedTheme) cachedTheme = loadTheme();
  return cachedTheme;
}

/** 把主题写到 <html>，CSS 变量由此生效 */
export function applyThemeToDom(state: ThemeState): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset['theme'] = state.theme;
  el.dataset['accent'] = state.accent;
  el.dataset['density'] = state.density === 'compact' ? 'compact' : '';
  cachedTheme = state;
}

interface ThemeContextValue extends ThemeState {
  setTheme: (t: ThemeId) => void;
  setAccent: (a: AccentId) => void;
  setDensity: (d: DensityId) => void;
  toggleTheme: () => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(() => loadTheme());

  // DOM 同步：首次挂载 + 每次变化
  useEffect(() => {
    applyThemeToDom(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 隐私模式下写失败不影响功能 */
    }
  }, [state]);

  const setTheme = useCallback((theme: ThemeId) => {
    setState((s) => ({ ...s, theme }));
  }, []);

  const setAccent = useCallback((accent: AccentId) => {
    setState((s) => ({ ...s, accent }));
  }, []);

  const setDensity = useCallback((density: DensityId) => {
    setState((s) => ({ ...s, density }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState((s) => ({ ...s, theme: s.theme === 'inknight' ? 'xuanpaper' : 'inknight' }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_THEME), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...state, setTheme, setAccent, setDensity, toggleTheme, reset }),
    [state, setTheme, setAccent, setDensity, toggleTheme, reset],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}