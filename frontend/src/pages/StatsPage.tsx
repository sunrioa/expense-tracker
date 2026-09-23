import { useEffect, useMemo, useRef, useState } from 'react';
import { Segmented } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  currentPeriod,
  normalizePeriod,
  shiftPeriod,
  type Granularity,
  type NameStat,
  type Period,
  type PeriodStat,
  type StatsResponse
} from '@ledger/shared';
import * as api from '../api';
import { useLedger } from '../state/ledger';
import { useIsNarrow } from '../hooks/useMediaQuery';
import { errMsg } from '../utils/error';
import { compact, money, monthLabel, monthSmart, percent, rangeLabel, yuan } from '../utils/format';
import { cls } from '../utils/cls';
import BarChart from '../components/BarChart';
import CompositionBar, { slotColor } from '../components/CompositionBar';
import { MonthField } from '../components/MonthGrid';
import Money from '../components/Money';
import Icon from '../components/Icon';

type Preset = '6m' | '12m' | 'ytd' | 'ly' | 'all' | 'custom';

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: '6m', label: '近 6 个月' },
  { key: '12m', label: '近 12 个月' },
  { key: 'ytd', label: '今年' },
  { key: 'ly', label: '去年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' }
];

function presetRange(p: Preset, now: Period): { from?: Period; to?: Period } {
  const year = Number(now.slice(0, 4));
  switch (p) {
    case '6m':
      return { from: shiftPeriod(now, -5), to: now };
    case '12m':
      return { from: shiftPeriod(now, -11), to: now };
    case 'ytd':
      return { from: `${year}-01`, to: now };
    case 'ly':
      return { from: `${year - 1}-01`, to: `${year - 1}-12` };
    default:
      return {};
  }
}

function safePeriod(raw: string | null): Period | undefined {
  try {
    return normalizePeriod(raw);
  } catch {
    return undefined;
  }
}

function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="tile">
      <p className="tile-label">{label}</p>
      <p className="tile-value">
        <Money value={value} />
      </p>
      <p className="tile-sub">{sub || ' '}</p>
    </div>
  );
}

interface RankItem {
  key: string;
  name: string;
  total: number;
  count: number;
  /** 类别有自己的颜色；名称没有，统一用强调色 */
  color: string;
  dot: boolean;
}

/** 排行：金额、占比、笔数都直接写出来，横条只是辅助比较长短 */
function RankList({ items, total }: { items: RankItem[]; total: number }) {
  const [all, setAll] = useState(false);
  const max = Math.max(0, ...items.map((i) => i.total));
  const shown = all ? items : items.slice(0, 8);
  return (
    <>
      <ol className="rank">
        {shown.map((it) => (
          <li key={it.key} className="rank-row">
            {it.dot && <span className="dot" style={{ background: it.color }} />}
            <span className="rank-name">{it.name}</span>
            <span className="rank-count">{it.count} 笔</span>
            <span className="rank-amount">{money(it.total)}</span>
            <span className="rank-pct">{percent(it.total, total)}</span>
            <span className="rank-track">
              <span className="rank-fill" style={{ width: `${max ? (it.total / max) * 100 : 0}%`, background: it.color }} />
            </span>
          </li>
        ))}
      </ol>
      {items.length > 8 && (
        <button type="button" className="text-btn rank-more" onClick={() => setAll((v) => !v)}>
          {all ? '收起' : `显示全部 ${items.length} 项`}
        </button>
      )}
    </>
  );
}

export default function StatsPage() {
  const { version, slots } = useLedger();
  const navigate = useNavigate();
  const narrow = useIsNarrow();
  const [params, setParams] = useSearchParams();
  const now = currentPeriod();

  /* ---------------- 筛选条件（放在地址栏里，刷新不丢） ---------------- */

  const preset: Preset = PRESETS.some((p) => p.key === params.get('r')) ? (params.get('r') as Preset) : '12m';
  const granularity: Granularity = params.get('g') === 'year' ? 'year' : 'month';
  const isYear = granularity === 'year';
  const customFrom = safePeriod(params.get('from')) ?? shiftPeriod(now, -5);
  const customTo = safePeriod(params.get('to')) ?? now;
  const range =
    preset === 'custom'
      ? { from: customFrom < customTo ? customFrom : customTo, to: customFrom < customTo ? customTo : customFrom }
      : presetRange(preset, now);

  const update = (change: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(change)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true }
    );

  const choosePreset = (p: Preset) =>
    update(p === 'custom' ? { r: p, from: range.from ?? customFrom, to: range.to ?? customTo } : { r: p, from: null, to: null });

  /* ---------------- 数据 ---------------- */

  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    api
      .fetchStats({ from: range.from, to: range.to, granularity })
      .then((res) => {
        if (mine !== seq.current) return;
        setData(res);
        setError(null);
      })
      .catch((e: unknown) => {
        if (mine === seq.current) setError(errMsg(e, '加载失败'));
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
    // version：账本里记了新账，统计跟着刷新
  }, [range.from, range.to, granularity, version]);

  const periods: PeriodStat[] = data?.byPeriod ?? [];
  const total = data?.total ?? 0;
  const filled = periods.filter((p) => p.total > 0);
  const average = filled.length ? total / filled.length : 0;
  const peak = filled.reduce<PeriodStat | undefined>((best, p) => (!best || p.total > best.total ? p : best), undefined);
  const periodName = (key: string) => (isYear ? `${key}年` : monthLabel(key));

  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [by, setBy] = useState<'category' | 'name'>('category');

  const rankItems = useMemo<RankItem[]>(() => {
    if (!data) return [];
    const source: NameStat[] = by === 'category' ? data.byCategory : data.byName;
    return source.map((s) => ({
      key: s.name,
      name: s.name,
      total: s.total,
      count: s.count,
      // 类别用和账本一致的颜色；名称太多、颜色分不过来，统一用强调色比长短
      color: by === 'category' ? slotColor(slots.get(s.name) ?? 0) : 'var(--accent)',
      dot: by === 'category'
    }));
  }, [data, by, slots]);

  const hasData = !!data && data.recordCount > 0;

  /* ---------------- 渲染 ---------------- */

  const filters = (
    <div className="filters">
      <div className="filter-chips" role="group" aria-label="时间范围">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            className={cls('chip', preset === p.key && 'is-on')}
            onClick={() => choosePreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="range-row">
          <MonthField value={customFrom} onChange={(p) => update({ from: p })}>
            <button type="button" className="field-btn">
              {monthLabel(customFrom)}
              <Icon name="chevronDown" size={14} />
            </button>
          </MonthField>
          <span className="range-sep">到</span>
          <MonthField value={customTo} onChange={(p) => update({ to: p })}>
            <button type="button" className="field-btn">
              {monthLabel(customTo)}
              <Icon name="chevronDown" size={14} />
            </button>
          </MonthField>
        </div>
      )}
      <Segmented<Granularity>
        className="filter-gran"
        size="small"
        value={granularity}
        onChange={(g) => update({ g: g === 'year' ? 'year' : null })}
        options={[
          { label: '按月', value: 'month' },
          { label: '按年', value: 'year' }
        ]}
      />
    </div>
  );

  if (error && !data) {
    return (
      <div className="page stats">
        {filters}
        <div className="card empty">
          <p className="empty-title">加载失败</p>
          <p className="empty-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page stats">
      {filters}

      <div className={cls('stats-body', loading && 'is-refreshing')} aria-busy={loading}>
        <p className="stats-range">
          {data?.fromPeriod && data.toPeriod ? rangeLabel(data.fromPeriod, data.toPeriod) : ' '}
        </p>

        <div className="tiles">
          <StatTile label="支出合计" value={total} sub={hasData ? `${data.recordCount} 笔` : '没有记录'} />
          <StatTile
            label={isYear ? '年均' : '月均'}
            value={average}
            sub={filled.length ? `按 ${filled.length} 个有记录的${isYear ? '年份' : '月份'}` : undefined}
          />
          <StatTile label={isYear ? '最高的一年' : '最高的月份'} value={peak?.total ?? 0} sub={peak ? periodName(peak.key) : undefined} />
          <StatTile
            label="最大一笔"
            value={data?.maxAmount ?? 0}
            sub={data?.maxAmountName ? `${data.maxAmountName} · ${data.maxAmountPeriod ? monthSmart(data.maxAmountPeriod) : ''}` : undefined}
          />
        </div>

        {!hasData && !loading ? (
          <div className="card empty">
            <p className="empty-title">这段时间没有记录</p>
            <p className="empty-text">换个时间范围看看。</p>
          </div>
        ) : (
          <>
            <section className="card">
              <div className="card-head">
                <div className="card-title-row">
                  <h2 className="card-title">{isYear ? '每年支出' : '每月支出'}</h2>
                  {view === 'chart' && average > 0 && (
                    <span className="legend-avg">
                      <i aria-hidden="true" />
                      {isYear ? '年均' : '月均'} {compact(average)}
                    </span>
                  )}
                </div>
                <Segmented
                  size="small"
                  value={view}
                  onChange={(v) => setView(v as 'chart' | 'table')}
                  options={[
                    { label: '图表', value: 'chart' },
                    { label: '列表', value: 'table' }
                  ]}
                />
              </div>

              {view === 'chart' ? (
                <>
                  <BarChart
                    height={narrow ? 180 : 240}
                    data={periods.map((p) => ({
                      key: p.key,
                      label: periodName(p.key),
                      short: isYear ? p.key : `${Number(p.key.slice(5))}月`,
                      value: p.total
                    }))}
                    average={average}
                    tip={(d) => (
                      <span className="tip">
                        <b>{yuan(d.value)}</b>
                        <span>{d.label}</span>
                      </span>
                    )}
                    onSelect={(d) =>
                      isYear
                        ? update({ r: 'custom', from: `${d.key}-01`, to: `${d.key}-12`, g: null })
                        : navigate(d.key === now ? '/' : `/?m=${d.key}`)
                    }
                  />
                  <p className="card-hint">{isYear ? '点柱子查看那一年的每个月' : '点柱子打开那个月的账本'}</p>
                </>
              ) : (
                <div className="table-wrap">
                  <table className="ptable">
                    <thead>
                      <tr>
                        <th>{isYear ? '年份' : '月份'}</th>
                        <th className="num">支出</th>
                        <th className="num">占比</th>
                        <th className="num">笔数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p) => (
                        <tr key={p.key} className={p.total ? undefined : 'is-empty'}>
                          <td>{periodName(p.key)}</td>
                          <td className="num">{p.total ? money(p.total) : '—'}</td>
                          <td className="num">{p.total ? percent(p.total, total) : '—'}</td>
                          <td className="num">{p.count || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>合计</td>
                        <td className="num">{money(total)}</td>
                        <td className="num">100%</td>
                        <td className="num">{data?.recordCount ?? 0}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2 className="card-title">花在哪里</h2>
                <Segmented
                  size="small"
                  value={by}
                  onChange={(v) => setBy(v as 'category' | 'name')}
                  options={[
                    { label: '按类别', value: 'category' },
                    { label: '按名称', value: 'name' }
                  ]}
                />
              </div>
              {by === 'category' && (
                <CompositionBar
                  segments={rankItems.map((r) => ({ key: r.key, label: r.name, value: r.total, slot: slots.get(r.name) ?? 0 }))}
                  total={total}
                />
              )}
              <RankList key={by} items={rankItems} total={total} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
