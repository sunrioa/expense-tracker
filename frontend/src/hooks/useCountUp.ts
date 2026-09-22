import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * 数字滚动到目标值。
 *
 * 用 requestAnimationFrame 驱动，缓动曲线是 easeOutCubic —— 和样式里的
 * --ease-out 观感接近，数字和卡片的入场看起来是同一套节奏。
 *
 * 动画中途目标又变了（比如刷新后金额不同），会从**当前显示的值**继续补间，
 * 不会跳回旧值再重来。系统开了「减少动态效果」时直接返回最终值。
 */
export function useCountUp(target: number, duration = 750): number {
  const [value, setValue] = useState(target);
  const shownRef = useRef(target);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target || duration <= 0 || prefersReducedMotion()) {
      shownRef.current = target;
      setValue(target);
      return undefined;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = t >= 1 ? target : from + (target - from) * eased;
      shownRef.current = next;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
