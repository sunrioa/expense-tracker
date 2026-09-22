import { useEffect, useState } from 'react';

export type ColorScheme = 'light' | 'dark';

const QUERY = '(prefers-color-scheme: dark)';

function read(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

/**
 * 跟随系统的浅色 / 深色。
 *
 * CSS 那边靠 @media (prefers-color-scheme) 自动切换，不需要这个 hook；
 * 但 antd 的主题算法和 ECharts 的配色是运行时的 JS 值，必须有人告诉它们现在是哪种模式。
 * 系统设置一改，这里会立刻重渲染，三者保持同步。
 */
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setScheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return scheme;
}
