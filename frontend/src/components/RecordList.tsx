import type { RecordNode } from '@ledger/shared';
import { amountOf } from '../lib/ledger';
import { money, percent } from '../utils/format';
import { cls } from '../utils/cls';
import { slotColor } from './CompositionBar';
import Icon from './Icon';

export interface RecordListProps {
  /** 这个月的顶级条目，已按金额排好 */
  items: RecordNode[];
  total: number;
  slots: Map<string, number>;
  /** 展开着的分组（按名称记，换个月份也保持同样的展开状态） */
  expanded: Set<string>;
  onToggle: (name: string) => void;
  onEdit: (node: RecordNode) => void;
  onAddTo: (group: RecordNode) => void;
}

/**
 * 一个月的明细。
 *
 * 每一行的动作都只有一个，不用猜：独立条目和子项点了就是编辑；
 * 分组点了是展开 / 收起，展开后底下才出现「记一笔」「编辑分组」。
 * 行首的圆点和上面占比条同色，这个列表同时就是占比条的图例。
 */
export default function RecordList({ items, total, slots, expanded, onToggle, onEdit, onAddTo }: RecordListProps) {
  return (
    <ul className="rlist">
      {items.map((n) => {
        const amount = amountOf(n);
        const dot = <span className="dot" style={{ background: slotColor(slots.get(n.name) ?? 0) }} />;
        const tail = (
          <span className="rrow-nums">
            <span className="rrow-amount">{money(amount)}</span>
            <span className="rrow-share">{percent(amount, total)}</span>
          </span>
        );

        if (n.children.length === 0) {
          return (
            <li key={n.id} className="rrow">
              <button type="button" className="rrow-btn" onClick={() => onEdit(n)}>
                {dot}
                <span className="rrow-text">
                  <span className="rrow-name">{n.name}</span>
                  {n.detail && <span className="rrow-detail">{n.detail}</span>}
                </span>
                {tail}
              </button>
            </li>
          );
        }

        const open = expanded.has(n.name);
        return (
          <li key={n.id} className={cls('rrow', 'rgroup', open && 'is-open')}>
            <button type="button" className="rrow-btn" aria-expanded={open} onClick={() => onToggle(n.name)}>
              {dot}
              <span className="rrow-text">
                <span className="rrow-name">
                  {n.name}
                  <span className="rrow-count">{n.children.length} 项</span>
                  <Icon name="chevronDown" size={14} className="rrow-caret" />
                </span>
                {open
                  ? n.detail && <span className="rrow-detail">{n.detail}</span>
                  : <span className="rrow-detail">{n.children.map((c) => c.name).join(' · ')}</span>}
              </span>
              {tail}
            </button>

            {open && (
              <ul className="rchildren">
                {n.children.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="rrow-btn rchild" onClick={() => onEdit(c)}>
                      <span className="rrow-text">
                        <span className="rrow-name">{c.name}</span>
                        {c.detail && <span className="rrow-detail">{c.detail}</span>}
                      </span>
                      <span className="rrow-nums">
                        <span className="rrow-amount">{money(c.amount ?? 0)}</span>
                      </span>
                    </button>
                  </li>
                ))}
                <li className="rgroup-actions">
                  <button type="button" className="text-btn" onClick={() => onAddTo(n)}>
                    <Icon name="plus" size={15} />
                    记一笔到「{n.name}」
                  </button>
                  <button type="button" className="text-btn" onClick={() => onEdit(n)}>
                    <Icon name="edit" size={15} />
                    编辑分组
                  </button>
                </li>
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
