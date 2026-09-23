import { useMemo, useRef, useState } from 'react';
import { App as AntApp, Dropdown, Input, Tooltip } from 'antd';
import type { InputRef, MenuProps } from 'antd';
import { currentPeriod, monthsBetween, shiftPeriod, type Period, type RecordNode } from '@ledger/shared';
import { useLedger } from '../state/ledger';
import { useViewMonth } from '../hooks/useViewMonth';
import { useStoredSet } from '../hooks/useStoredSet';
import { useHotkeys } from '../hooks/useHotkeys';
import { useCountUp } from '../hooks/useCountUp';
import { amountOf, entryCount, itemsOf, searchRecords } from '../lib/ledger';
import { monthLabel, monthShort, monthSmart, percent, yuan } from '../utils/format';
import { cls } from '../utils/cls';
import Icon from '../components/Icon';
import Money from '../components/Money';
import MonthStrip from '../components/MonthStrip';
import CompositionBar from '../components/CompositionBar';
import RecordList from '../components/RecordList';
import SearchResults from '../components/SearchResults';
import { MonthField } from '../components/MonthGrid';
import { ErrorState, LedgerSkeleton } from '../components/States';

/** 和上个月比：多花了标红、少花了标绿，箭头和文字一起说明，不只靠颜色 */
function Delta({ current, previous, prev }: { current: number; previous?: number; prev: Period }) {
  if (!current) return null;
  if (!previous) return <span className="delta">{monthShort(prev)}没有记录</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) return <span className="delta">和{monthShort(prev)}持平</span>;
  const up = diff > 0;
  return (
    <span className={cls('delta', up ? 'is-up' : 'is-down')}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={14} strokeWidth={2.2} />
      比{monthShort(prev)}
      {up ? '多' : '少'} {yuan(Math.abs(diff))}（{percent(Math.abs(diff), previous)}）
    </span>
  );
}

export default function LedgerPage() {
  const { tree, status, error, reload, totals, slots, openAdd, openEdit, openBatch, copyMonth, sheetOpen } = useLedger();
  const { modal } = AntApp.useApp();
  const [month, setMonth] = useViewMonth();
  const now = currentPeriod();

  const items = useMemo(() => itemsOf(tree, month), [tree, month]);
  const total = totals.get(month) ?? 0;
  const count = entryCount(items);
  const prev = shiftPeriod(month, -1);
  const prevItems = useMemo(() => itemsOf(tree, prev), [tree, prev]);
  const shownTotal = useCountUp(total);

  /* ---------------- 搜索 ---------------- */

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<InputRef>(null);
  const hits = useMemo(() => searchRecords(tree, query), [tree, query]);
  const searching = searchOpen && query.trim().length > 0;

  const openSearch = () => {
    if (searchOpen) searchRef.current?.focus();
    else setSearchOpen(true);
  };
  const closeSearch = () => {
    setQuery('');
    setSearchOpen(false);
  };

  /* ---------------- 分组展开 ---------------- */

  const [expanded, setExpanded] = useStoredSet('ledger.expanded');
  const groupNames = items.filter((n) => n.children.length > 0).map((n) => n.name);
  const allOpen = groupNames.length > 0 && groupNames.every((n) => expanded.has(n));
  const toggle = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpanded(next);
  };
  const toggleAll = () => {
    const next = new Set(expanded);
    for (const n of groupNames) {
      if (allOpen) next.delete(n);
      else next.add(n);
    }
    setExpanded(next);
  };

  /* ---------------- 操作 ---------------- */

  const step = (d: number) => setMonth(shiftPeriod(month, d));

  const copyFromPrev = () => {
    const run = () => copyMonth(prev, month);
    // 空月份直接复制；已经有记录时先说清楚会发生什么
    if (!items.length) {
      void run();
      return;
    }
    modal.confirm({
      title: `把${monthShort(prev)}的记录复制到${monthShort(month)}？`,
      content: `${monthShort(prev)}共 ${entryCount(prevItems)} 笔。${monthShort(month)}已经有的同名条目会跳过，不会重复。`,
      okText: '复制',
      cancelText: '取消',
      onOk: run
    });
  };

  const menu: MenuProps['items'] = [
    {
      key: 'copy',
      icon: <Icon name="copy" size={16} />,
      label: prevItems.length ? `从${monthShort(prev)}复制（${entryCount(prevItems)} 笔）` : `${monthShort(prev)}没有可复制的记录`,
      disabled: !prevItems.length
    },
    { key: 'batch', icon: <Icon name="repeat" size={16} />, label: '批量生成到多个月…' },
    { type: 'divider' },
    { key: 'reload', icon: <Icon name="refresh" size={16} />, label: '刷新' }
  ];
  const onMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'copy') copyFromPrev();
    else if (key === 'batch') openBatch(month);
    else void reload();
  };

  useHotkeys({ ArrowLeft: () => step(-1), ArrowRight: () => step(1), '/': openSearch }, !sheetOpen && !searchOpen);

  /** 从搜索结果跳到某个月：退出搜索，结果所在的分组展开 */
  const jumpTo = (p: Period, group?: RecordNode) => {
    closeSearch();
    setMonth(p);
    if (group && !expanded.has(group.name)) setExpanded(new Set(expanded).add(group.name));
  };

  // 月份条以本月（或更晚的所看月份）收尾；翻到一年以前时，所看月份落在中间偏右
  const latest = month > now ? month : now;
  const stripEnd = monthsBetween(month, latest) > 11 ? shiftPeriod(month, 6) : latest;

  /* ---------------- 渲染 ---------------- */

  const toolbar = (
    <div className={cls('toolbar', searchOpen && 'is-searching')}>
      {searchOpen ? (
        <div className="searchbar">
          <Icon name="search" className="searchbar-icon" />
          <Input
            ref={searchRef}
            autoFocus
            variant="borderless"
            placeholder="搜索全部月份的名称和备注"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch();
            }}
            aria-label="搜索"
          />
          <button type="button" className="text-btn" onClick={closeSearch}>
            取消
          </button>
        </div>
      ) : (
        <>
          <div className="month-switch">
            <Tooltip title="上个月 ←" mouseEnterDelay={0.4}>
              <button type="button" className="icon-btn" aria-label="上个月" onClick={() => step(-1)}>
                <Icon name="chevronLeft" />
              </button>
            </Tooltip>
            <MonthField value={month} onChange={setMonth} totals={totals} placement="bottom">
              <button type="button" className="month-title" aria-label={`${monthLabel(month)}，点击选择月份`}>
                {monthLabel(month)}
                <Icon name="chevronDown" size={16} />
              </button>
            </MonthField>
            <Tooltip title="下个月 →" mouseEnterDelay={0.4}>
              <button type="button" className="icon-btn" aria-label="下个月" onClick={() => step(1)}>
                <Icon name="chevronRight" />
              </button>
            </Tooltip>
            {month !== now && (
              <button type="button" className="chip chip-now" onClick={() => setMonth(now)}>
                回到本月
              </button>
            )}
          </div>
          <div className="toolbar-actions">
            <Tooltip title="搜索 /" mouseEnterDelay={0.4}>
              <button type="button" className="icon-btn" aria-label="搜索" onClick={openSearch}>
                <Icon name="search" />
              </button>
            </Tooltip>
            <Dropdown menu={{ items: menu, onClick: onMenu }} trigger={['click']} placement="bottomRight">
              <button type="button" className="icon-btn" aria-label="更多操作">
                <Icon name="more" />
              </button>
            </Dropdown>
          </div>
        </>
      )}
    </div>
  );

  let body;
  if (status === 'loading' && !tree.length) {
    body = <LedgerSkeleton />;
  } else if (status === 'error' && !tree.length) {
    body = <ErrorState message={error} onRetry={() => void reload()} />;
  } else if (searching) {
    body = (
      <div className="card">
        <SearchResults
          hits={hits}
          keyword={query}
          slots={slots}
          onEdit={openEdit}
          onJump={(p) => jumpTo(p, hits.find((h) => (h.group ?? h.node).period === p)?.group)}
        />
      </div>
    );
  } else if (searchOpen) {
    body = <p className="search-idle">在全部月份里搜名称和备注</p>;
  } else {
    body = (
      <>
        <section className="hero">
          <div className="hero-main">
            <p className="hero-label">{monthSmart(month)}支出</p>
            <p className="hero-figure">
              <Money value={shownTotal} />
            </p>
            <p className="hero-meta">
              <Delta current={total} previous={totals.get(prev)} prev={prev} />
            </p>
          </div>
          <MonthStrip end={stripEnd} totals={totals} selected={month} onSelect={setMonth} />
        </section>

        <section className="card ledger-card" key={month}>
          {items.length ? (
            <>
              <div className="card-head">
                <span className="card-title">
                  {items.length} 类 · {count} 笔
                </span>
                {groupNames.length > 0 && (
                  <button type="button" className="text-btn" onClick={toggleAll}>
                    {allOpen ? '全部收起' : '全部展开'}
                  </button>
                )}
              </div>
              <CompositionBar
                segments={items.map((n) => ({
                  key: String(n.id),
                  label: n.name,
                  value: amountOf(n),
                  slot: slots.get(n.name) ?? 0
                }))}
                total={total}
              />
              <RecordList
                items={items}
                total={total}
                slots={slots}
                expanded={expanded}
                onToggle={toggle}
                onEdit={openEdit}
                onAddTo={(g) => openAdd({ period: g.period, groupId: g.id })}
              />
            </>
          ) : (
            <div className="empty">
              <p className="empty-title">{tree.length ? `${monthLabel(month)}还没有记录` : '开始记第一笔'}</p>
              <p className="empty-text">
                {!tree.length
                  ? '按月记账：每笔支出归到一个月里，同类的可以放进一个分组。'
                  : prevItems.length
                    ? `可以沿用${monthShort(prev)}的条目，再逐项改金额。`
                    : '点「记一笔」开始。'}
              </p>
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => openAdd({ period: month })}>
                  <Icon name="plus" size={16} />
                  记一笔
                </button>
                {prevItems.length > 0 && (
                  <button type="button" className="btn" onClick={copyFromPrev}>
                    <Icon name="copy" size={16} />
                    从{monthShort(prev)}复制 {entryCount(prevItems)} 笔
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <div className="page ledger">
      {toolbar}
      {body}
    </div>
  );
}
