import { useMemo } from 'react';
import { Tooltip } from 'antd';
import { currentPeriod, shiftPeriod, type Period } from '@ledger/shared';
import { monthLabel, yuan } from '../utils/format';
import { cls } from '../utils/cls';

export interface MonthStripProps {
  /** 最右边一根柱子的月份 */
  end: Period;
  totals: Map<Period, number>;
  selected: Period;
  onSelect: (p: Period) => void;
  count?: number;
}

/**
 * 近 12 个月的迷你柱状图，同时也是月份导航：点哪根柱子就跳到哪个月。
 *
 * 只有一个系列，所以不需要图例；选中的月份用强调色，其余用弱化的灰 ——
 * 重点是「这个月在这一年里算多还是少」，不是每根柱子各自的颜色。
 */
export default function MonthStrip({ end, totals, selected, onSelect, count = 12 }: MonthStripProps) {
  const months = useMemo(
    () => Array.from({ length: count }, (_, i) => shiftPeriod(end, i - count + 1)),
    [end, count]
  );
  const max = Math.max(0, ...months.map((p) => totals.get(p) ?? 0));
  const now = currentPeriod();

  return (
    <div className="strip" role="group" aria-label={`近 ${count} 个月的支出，点击切换月份`}>
      {months.map((p) => {
        const v = totals.get(p) ?? 0;
        // 有数据的月份至少露出一截，别和「没记账」混在一起
        const h = max > 0 && v > 0 ? Math.max(8, (v / max) * 100) : 0;
        const text = `${monthLabel(p)} · ${v ? yuan(v) : '没有记录'}`;
        return (
          <Tooltip key={p} title={text} mouseEnterDelay={0.12}>
            <button
              type="button"
              className={cls('strip-col', p === selected && 'is-selected', p === now && 'is-now', v === 0 && 'is-empty')}
              aria-pressed={p === selected}
              aria-label={text}
              onClick={() => onSelect(p)}
            >
              <span className="strip-track">
                <span className="strip-bar" style={{ height: `${h}%` }} />
              </span>
              <span className="strip-label">{Number(p.slice(5))}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
