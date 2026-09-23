import { Fragment } from 'react';
import type { ReactElement } from 'react';
import { sumAmounts, type Period, type RecordNode } from '@ledger/shared';
import type { SearchHit } from '../lib/ledger';
import { money, monthLabel } from '../utils/format';
import { slotColor } from './CompositionBar';
import Money from './Money';
import Icon from './Icon';

/** 把命中的关键词标出来 */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const k = keyword.trim();
  if (!k) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = k.toLowerCase();
  const out: Array<string | ReactElement> = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) out.push(text.slice(from, at));
    out.push(<mark key={at}>{text.slice(at, at + k.length)}</mark>);
    from = at + k.length;
  }
  if (from < text.length) out.push(text.slice(from));
  return <>{out.map((x, i) => (typeof x === 'string' ? <Fragment key={`t${i}`}>{x}</Fragment> : x))}</>;
}

export interface SearchResultsProps {
  hits: SearchHit[];
  keyword: string;
  slots: Map<string, number>;
  onEdit: (node: RecordNode) => void;
  onJump: (period: Period) => void;
}

/** 跨月份的搜索结果，按月分组；顶部给出合计 —— 「今年地铁一共花了多少」一搜就有 */
export default function SearchResults({ hits, keyword, slots, onEdit, onJump }: SearchResultsProps) {
  if (!hits.length) {
    return (
      <div className="empty">
        <p className="empty-title">没有找到「{keyword.trim()}」</p>
        <p className="empty-text">名称和备注都会搜，换个关键词试试。</p>
      </div>
    );
  }

  const months: Array<[Period, SearchHit[]]> = [];
  for (const h of hits) {
    const p = (h.group ?? h.node).period;
    const last = months[months.length - 1];
    if (last && last[0] === p) last[1].push(h);
    else months.push([p, [h]]);
  }
  const total = sumAmounts(hits.map((h) => h.node.amount ?? 0));

  return (
    <div className="search">
      <p className="search-summary">
        {months.length} 个月里找到 {hits.length} 笔，合计 <Money value={total} className="money-inline" />
      </p>
      {months.map(([period, list]) => (
        <section key={period} className="search-month">
          <header className="search-month-head">
            <button type="button" className="text-btn" onClick={() => onJump(period)}>
              {monthLabel(period)}
              <Icon name="chevronRight" size={14} />
            </button>
            <span className="search-month-sum">{money(sumAmounts(list.map((h) => h.node.amount ?? 0)))}</span>
          </header>
          <ul className="rlist">
            {list.map((h) => (
              <li key={h.node.id} className="rrow">
                <button type="button" className="rrow-btn" onClick={() => onEdit(h.node)}>
                  <span className="dot" style={{ background: slotColor(slots.get((h.group ?? h.node).name) ?? 0) }} />
                  <span className="rrow-text">
                    <span className="rrow-name">
                      {h.group && <span className="rrow-path">{h.group.name} / </span>}
                      <Highlight text={h.node.name} keyword={keyword} />
                    </span>
                    {h.node.detail && (
                      <span className="rrow-detail">
                        <Highlight text={h.node.detail} keyword={keyword} />
                      </span>
                    )}
                  </span>
                  <span className="rrow-nums">
                    <span className="rrow-amount">{money(h.node.amount ?? 0)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
