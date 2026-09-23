import { useState } from 'react';
import type { ReactNode } from 'react';
import { Popover } from 'antd';
import { currentPeriod, type Period } from '@ledger/shared';
import { compact } from '../utils/format';
import { cls } from '../utils/cls';
import Icon from './Icon';

export interface MonthGridProps {
  value: Period;
  onChange: (p: Period) => void;
  /** 传了就在格子里显示每月合计，一眼看出哪几个月有账 */
  totals?: Map<Period, number>;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 一年 12 个月的格子。比日历控件好点得多，手机上也不用瞄准小字 */
export default function MonthGrid({ value, onChange, totals }: MonthGridProps) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const now = currentPeriod();

  return (
    <div className="mgrid">
      <div className="mgrid-head">
        <button type="button" className="icon-btn" aria-label="上一年" onClick={() => setYear((y) => y - 1)}>
          <Icon name="chevronLeft" />
        </button>
        <span className="mgrid-year">{year} 年</span>
        <button type="button" className="icon-btn" aria-label="下一年" onClick={() => setYear((y) => y + 1)}>
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="mgrid-cells">
        {Array.from({ length: 12 }, (_, i) => {
          const p = `${year}-${pad(i + 1)}`;
          const total = totals?.get(p);
          return (
            <button
              key={p}
              type="button"
              className={cls('mgrid-cell', p === value && 'is-selected', p === now && 'is-now')}
              aria-pressed={p === value}
              onClick={() => onChange(p)}
            >
              <span className="mgrid-m">{i + 1}月</span>
              {totals && <span className="mgrid-t">{total ? compact(total) : '—'}</span>}
            </button>
          );
        })}
      </div>
      {value !== now && (
        <button type="button" className="text-btn mgrid-now" onClick={() => onChange(now)}>
          回到本月
        </button>
      )}
    </div>
  );
}

export interface MonthFieldProps extends MonthGridProps {
  /** 触发弹出的元素；不传就用默认的字段样式按钮 */
  children: ReactNode;
  placement?: 'bottom' | 'bottomLeft' | 'bottomRight';
}

/** 点一下弹出月份格子 */
export function MonthField({ value, onChange, totals, children, placement = 'bottomLeft' }: MonthFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement={placement}
      arrow={false}
      destroyOnHidden
      rootClassName="month-pop"
      content={
        <MonthGrid
          value={value}
          totals={totals}
          onChange={(p) => {
            onChange(p);
            setOpen(false);
          }}
        />
      }
    >
      {children}
    </Popover>
  );
}
