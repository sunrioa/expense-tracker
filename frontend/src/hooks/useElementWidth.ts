import { useEffect, useState } from 'react';

/** 元素的实时宽度。返回回调 ref，节点换了也能跟上（和 Chart 当初踩过的坑一样） */
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return [setEl, width];
}
