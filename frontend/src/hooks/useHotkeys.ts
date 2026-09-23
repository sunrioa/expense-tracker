import { useEffect, useRef } from 'react';

/**
 * 焦点在输入框里时，单键快捷键不能生效 —— 否则在名称里打个 n 就弹出了记账面板。
 * 下拉菜单、弹出层里的方向键也留给它们自己用。
 */
function isBusy(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return true;
  return target.closest('[role="menu"], .ant-dropdown, .ant-popover') !== null;
}

/**
 * 单键快捷键：{ n: 打开记账, ArrowLeft: 上个月 }。
 * 字母键不分大小写；带 ⌘ / Ctrl / Alt 的组合键一律放行给浏览器。
 */
export function useHotkeys(bindings: Record<string, () => void>, enabled = true): void {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || isBusy(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const fn = ref.current[key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
