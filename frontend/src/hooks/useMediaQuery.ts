import { useEffect, useState } from 'react';

function read(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** 订阅一条媒体查询。布局用 CSS 就够了，这个 hook 是给那些只能在 JS 里判断的地方用的。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => read(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * 手机宽度。
 *
 * 和 styles.css 里那个 640px 断点是同一个数 —— 两边必须一致，
 * 否则会出现「CSS 已经换成单列了、JS 还在按宽屏渲染列」的错位。
 */
export const NARROW_QUERY = '(max-width: 640px)';

export function useIsNarrow(): boolean {
  return useMediaQuery(NARROW_QUERY);
}
