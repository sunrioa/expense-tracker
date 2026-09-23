import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currentPeriod, normalizePeriod, type Period } from '@ledger/shared';

function parse(raw: string | null): Period {
  try {
    return normalizePeriod(raw) ?? currentPeriod();
  } catch {
    return currentPeriod();
  }
}

/**
 * 账本正在看的月份，存在地址栏的 ?m= 里 —— 刷新不丢，也能从统计页的柱子直接跳过来。
 * 本月不写参数，地址保持干净。切月份用 replace，不往浏览历史里塞一串月份。
 */
export function useViewMonth(): [Period, (p: Period) => void] {
  const [params, setParams] = useSearchParams();
  const month = parse(params.get('m'));

  const setMonth = useCallback(
    (p: Period) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (p === currentPeriod()) next.delete('m');
          else next.set('m', p);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  return [month, setMonth];
}
