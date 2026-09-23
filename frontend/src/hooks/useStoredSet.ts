import { useCallback, useState } from 'react';

/**
 * 记在 localStorage 里的字符串集合（比如「哪些分组是展开的」）。
 * 隐私模式、存储被禁用时读写都会抛错 —— 退化成只在内存里生效，不影响使用。
 */
export function useStoredSet(key: string): [Set<string>, (next: Set<string>) => void] {
  const [value, setValue] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const list: unknown = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  });

  const update = useCallback(
    (next: Set<string>) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        /* 存不下就算了，本次会话里照样生效 */
      }
    },
    [key]
  );

  return [value, update];
}
