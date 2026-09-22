import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Radio,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip
} from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, RiseOutlined, TagsOutlined, UnorderedListOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { EChartsOption } from 'echarts';
import * as api from '../api';
import Chart from '../components/Chart';
import type { Granularity, PeriodStat, StatsQuery, StatsResponse } from '@ledger/shared';
import { money, periodLabel, periodShort, sumAmounts, yuan } from '../utils/format';
import { errMsg } from '../utils/error';
import { useCountUp } from '../hooks/useCountUp';
import { useColorScheme } from '../hooks/useColorScheme';
import { useIsNarrow } from '../hooks/useMediaQuery';
import { chartTheme } from '../theme/chartTheme';

const { RangePicker } = DatePicker;

type RangePickerProps = ComponentProps<typeof RangePicker>;
type DateRange = [Dayjs, Dayjs];
type PieMode = 'category' | 'name';
type StatTone = 'teal' | 'sage' | 'amber' | 'cyan';

/**
 * ECharts 回调里的 value 类型很宽（number | string | Date，甚至数组），
 * 统一收成数字再交给格式化函数。原来的 JS 版本直接把它丢进 yuan()，
 * 靠运行时的 Number() 兜底 —— 这里把这层转换显式化。
 */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (Array.isArray(v)) return toNum(v[v.length - 1]);
  return 0;
}

const RANGE_PRESETS: RangePickerProps['presets'] = [
  { label: '本月', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: '上月', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { label: '近3个月', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')] },
  { label: '近半年', value: [dayjs().subtract(5, 'month').startOf('month'), dayjs().endOf('month')] },
  { label: '今年', value: [dayjs().startOf('year'), dayjs().endOf('month')] },
  { label: '去年', value: [dayjs().subtract(1, 'year').startOf('year'), dayjs().subtract(1, 'year').endOf('year')] }
];

/** 饼图的数据项：在 ECharts 标准字段之外挂了 count / percent 供 tooltip 使用 */
interface PieDatum {
  name: string;
  value: number;
  count: number;
  percent: number;
  itemStyle: { color: string };
}

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  extra?: ReactNode;
  primary?: boolean;
  tone?: StatTone;
  icon?: ReactNode;
}

function StatCard({ label, value, extra, primary, tone = 'teal', icon }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}${primary ? ' primary' : ''}`}>
      <div className="stat-head">
        {icon ? <span className="stat-ico">{icon}</span> : null}
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {extra ? <div className="stat-extra">{extra}</div> : null}
    </div>
  );
}

export default function StatsPage() {
  const { message } = AntApp.useApp();

  const [granularity, setGranularity] = useState<Granularity>('month');
  const [range, setRange] = useState<DateRange>([dayjs().startOf('year'), dayjs().endOf('month')]);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pieMode, setPieMode] = useState<PieMode>('category');

  /* ECharts 的 option 是纯 JS 对象，读不到 CSS 变量，配色得单独喂一份 */
  const scheme = useColorScheme();
  const ct = useMemo(() => chartTheme(scheme), [scheme]);
  const isNarrow = useIsNarrow();
  /* 手机上图表矮一些，否则一屏只装得下一张图 */
  const chartHeight = isNarrow ? 220 : 300;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: StatsQuery = { granularity };
      if (range && range[0]) params.from = range[0].format('YYYY-MM');
      if (range && range[1]) params.to = range[1].format('YYYY-MM');
      const res = await api.fetchStats(params);
      setData(res);
    } catch (e) {
      message.error(errMsg(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [granularity, range, message]);

  useEffect(() => {
    load();
  }, [load]);

  const periods: PeriodStat[] = (data && data.byPeriod) || [];
  const isYear = granularity === 'year';

  const pieData = useMemo<PieDatum[]>(() => {
    if (!data) return [];
    const src = pieMode === 'category' ? data.byCategory : data.byName;
    return (src || []).map((it) => ({
      name: it.name,
      value: Number(it.total || 0),
      count: it.count,
      percent: it.percent,
      itemStyle: { color: it.color }
    }));
  }, [data, pieMode]);

  const hasData = !!data && data.recordCount > 0;

  /**
   * X 轴标签。窄屏用短标签 —— 「2026年01月」9 个字在 390px 宽里即使斜排也会互相压住，
   * 「01月」则不用旋转就排得下。按年统计时 key 本身就是「2026」，直接用。
   */
  const axisLabels = useMemo(
    () => periods.map((p) => (isNarrow ? (isYear ? p.key : periodShort(p.key)) : p.label)),
    [periods, isNarrow, isYear]
  );

  /* 三个关键指标做数字滚动。hook 必须无条件调用，所以 data 为 null 时传 0 */
  const animatedTotal = useCountUp(data?.total ?? 0);
  const animatedCount = useCountUp(data?.recordCount ?? 0);
  const animatedMax = useCountUp(data?.maxAmount ?? 0);

  const barOption = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => yuan(toNum(v))
      },
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: axisLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: ct.axisLine } },
        axisLabel: {
          color: ct.axisLabel,
          interval: 0,
          rotate: isNarrow ? 0 : periods.length > 8 ? 30 : 0,
          fontSize: isNarrow ? 10 : 11
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: ct.axisLabelMuted, formatter: (v: number) => `¥${v}` },
        splitLine: { lineStyle: { color: ct.splitLine } }
      },
      series: [
        {
          type: 'bar',
          name: '支出',
          barMaxWidth: 40,
          data: periods.map((p) => Number(p.total || 0)),
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            // global:false → 每根柱子内部独立渐变，而不是整组共用一段渐变
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              global: false,
              colorStops: [
                { offset: 0, color: ct.bar[0] },
                { offset: 0.55, color: ct.bar[1] },
                { offset: 1, color: ct.bar[2] }
              ]
            }
          },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                global: false,
                colorStops: [
                  { offset: 0, color: ct.barHover[0] },
                  { offset: 1, color: ct.barHover[1] }
                ]
              }
            }
          },
          label: {
            show: !isNarrow && periods.length <= 14,
            position: 'top',
            color: ct.barLabel,
            fontSize: 10,
            formatter: (p) => money(toNum(p.value))
          }
        }
      ]
    }),
    [periods, axisLabels, isNarrow, ct]
  );

  /** 累计支出趋势：一眼看出这一年花了多少、什么时候被拉高的 */
  const cumulativeOption = useMemo<EChartsOption>(() => {
    let acc = 0;
    const values = periods.map((p) => {
      acc = sumAmounts([acc, p.total]);
      return acc;
    });
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => yuan(toNum(v))
      },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: axisLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: ct.axisLine } },
        axisLabel: {
          color: ct.axisLabel,
          fontSize: isNarrow ? 10 : 11,
          rotate: isNarrow ? 0 : periods.length > 8 ? 30 : 0
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: ct.axisLabelMuted, formatter: (v: number) => `¥${v}` },
        splitLine: { lineStyle: { color: ct.splitLine } }
      },
      series: [
        {
          type: 'line',
          name: '累计支出',
          smooth: true,
          symbolSize: 6,
          data: values,
          itemStyle: { color: ct.lineSymbol, borderColor: ct.pieBorder, borderWidth: 1 },
          lineStyle: { width: 2.5, color: ct.lineStroke },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              global: false,
              colorStops: [
                { offset: 0, color: ct.area[0] },
                { offset: 1, color: ct.area[1] }
              ]
            }
          }
        }
      ]
    };
  }, [periods, axisLabels, isNarrow, ct]);

  const pieOption = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          // trigger:'item' 运行时只会给单个对象，但类型上是「对象或数组」的并集
          const it = Array.isArray(p) ? p[0] : p;
          return `${it.name}<br/>${yuan(toNum(it.value))}<br/>占比 ${it.percent}%`;
        }
      },
      legend: {
        type: 'scroll',
        // 窄屏图例放底部横排：竖排图例会把饼图挤成一条
        orient: isNarrow ? 'horizontal' : 'vertical',
        ...(isNarrow ? { bottom: 0, left: 'center' } : { right: 4, top: 'middle' }),
        textStyle: { color: ct.legendText, fontSize: 12 },
        formatter: (name: string) => (name.length > 10 ? `${name.slice(0, 10)}…` : name)
      },
      series: [
        {
          type: 'pie',
          radius: ['46%', '72%'],
          center: isNarrow ? ['50%', '42%'] : ['36%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderColor: ct.pieBorder, borderWidth: 2 },
          data: pieData
        }
      ]
    }),
    [pieData, isNarrow, ct]
  );

  const periodColumns: TableColumnsType<PeriodStat> = [
    {
      title: isYear ? '年份' : '月份',
      dataIndex: 'label',
      width: isNarrow ? 92 : undefined,
      // 手机上用原始值「2026-01」：中文标签「2026年01月」在窄列里会竖排折成两行
      render: (v: string, row: PeriodStat) =>
        isNarrow ? (
          <span>{row.key}</span>
        ) : (
          <Space size={6}>
            <span>{v}</span>
            {!isYear && row.key && <span className="muted">{row.key}</span>}
          </Space>
        )
    },
    {
      title: '支出金额',
      dataIndex: 'total',
      align: 'right',
      width: isNarrow ? 110 : 160,
      sorter: (a, b) => Number(a.total) - Number(b.total),
      render: (v: number) => <b>{yuan(v)}</b>
    },
    {
      title: '占比',
      dataIndex: 'percent',
      width: isNarrow ? 120 : 220,
      render: (v: number) => (
        <Progress
          percent={Number(v || 0)}
          size="small"
          strokeColor={{ '0%': ct.progress[0], '100%': ct.progress[1] }}
          format={(p) => `${p}%`}
        />
      )
    },
    // 明细条数在手机上是可以牺牲的信息，让出宽度给金额和占比
    ...(isNarrow
      ? []
      : [
          {
            title: '明细条数',
            dataIndex: 'count',
            align: 'right' as const,
            width: 100,
            render: (v: number) => <span>{v} 条</span>
          }
        ])
  ];

  return (
    <div className="page">
      <Card className="section-card" size="small">
        <Row gutter={[12, 12]} align="middle" justify="space-between" className="stats-bar">
          <Col>
            <Space wrap className="stats-range">
              <Segmented<Granularity>
                value={granularity}
                onChange={setGranularity}
                options={[
                  { label: '按月统计', value: 'month' },
                  { label: '按年统计', value: 'year' }
                ]}
              />
              <RangePicker
                picker="month"
                allowClear={false}
                value={range}
                onChange={(v) => {
                  // allowClear={false} 下运行时不会给 null，但类型上两端都可空，这里显式收口
                  if (v && v[0] && v[1]) setRange([v[0], v[1]]);
                }}
                presets={RANGE_PRESETS}
                format="YYYY-MM"
              />
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[12, 12]} className="stat-row">
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            primary
            tone="teal"
            icon={<WalletOutlined />}
            label="区间支出合计"
            value={yuan(animatedTotal)}
            extra={
              data && data.fromPeriod
                ? `${periodLabel(data.fromPeriod)} ~ ${periodLabel(data.toPeriod)}`
                : '暂无数据'
            }
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            tone="sage"
            icon={<UnorderedListOutlined />}
            label="明细条数"
            value={Math.round(animatedCount)}
            extra={data ? `覆盖 ${data.monthCount} 个月 · 平均每月 ${yuan(data.avgPerMonth)}` : '—'}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            tone="amber"
            icon={<RiseOutlined />}
            label="最大单笔"
            value={yuan(animatedMax)}
            extra={
              data && data.maxAmountName
                ? `${data.maxAmountName} · ${periodLabel(data.maxAmountPeriod)}`
                : '—'
            }
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            tone="cyan"
            icon={<TagsOutlined />}
            label="支出名称数 / 分类数"
            value={data ? `${(data.byName || []).length} / ${(data.byCategory || []).length}` : '0 / 0'}
            extra="明细名称 / 顶级分类"
          />
        </Col>
      </Row>

      <Card
        className="section-card bar-teal"
        size="small"
        title={isYear ? '每年支出' : '每月支出'}
        extra={
          <span className="muted">
            共 {periods.length} 个{isYear ? '年份' : '月份'}
          </span>
        }
      >
        {hasData ? (
          <Chart option={barOption} height={chartHeight} />
        ) : (
          <Chart empty height={chartHeight} emptyText="所选区间内暂无支出记录" />
        )}
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card
            className="section-card"
            size="small"
            title="累计支出趋势"
            extra={<span className="muted">看进度，判断后面还能花多少</span>}
          >
            {hasData ? (
              <Chart option={cumulativeOption} height={chartHeight} />
            ) : (
              <Chart empty height={chartHeight} emptyText="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            className="section-card bar-violet"
            size="small"
            title="支出构成"
            extra={
              <Radio.Group
                size="small"
                value={pieMode}
                onChange={(e) => setPieMode(e.target.value as PieMode)}
                optionType="button"
                buttonStyle="solid"
                options={[
                  { label: '按分类', value: 'category' },
                  { label: '按名称', value: 'name' }
                ]}
              />
            }
          >
            {hasData && pieData.length ? (
              <Chart option={pieOption} height={isNarrow ? 280 : chartHeight} />
            ) : (
              <Chart empty height={isNarrow ? 280 : chartHeight} emptyText="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        className="section-card"
        size="small"
        title={isYear ? '按年明细' : '按月明细'}
      >
        <Table<PeriodStat>
          rowKey="key"
          size="small"
          loading={loading}
          dataSource={periods}
          columns={periodColumns}
          scroll={{ x: isNarrow ? 340 : 560 }}
          pagination={periods.length > 12 ? { pageSize: 12, size: 'small' } : false}
          locale={{ emptyText: <Empty description="暂无统计数据" /> }}
          summary={() => {
            if (!periods.length) return null;
            const sum = sumAmounts(periods.map((p) => p.total));
            const count = periods.reduce((s, p) => s + Number(p.count || 0), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <b>合计</b>
                  {/* 窄屏没有「明细条数」列，把条数并进合计单元格，别让它挤出表格 */}
                  {isNarrow && <span className="muted"> · {count} 条</span>}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <b style={{ color: ct.summaryText }}>{yuan(sum)}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Tag bordered={false}>100%</Tag>
                </Table.Summary.Cell>
                {!isNarrow && (
                  <Table.Summary.Cell index={3} align="right">
                    <Tooltip title="区间内所有明细条数">
                      <span>{count} 条</span>
                    </Tooltip>
                  </Table.Summary.Cell>
                )}
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      <Card className="section-card bar-teal" size="small" title="支出名称排行">
        {data && (data.byName || []).length ? (
          <Row gutter={[12, 12]}>
            {(data.byName || []).slice(0, 12).map((it) => (
              <Col xs={24} sm={12} lg={8} key={it.name}>
                <div style={{ padding: '4px 0' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space size={6}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: it.color,
                          display: 'inline-block'
                        }}
                      />
                      <span>{it.name}</span>
                      <span className="muted">{it.count} 条</span>
                    </Space>
                    <Space size={6}>
                      <b>{yuan(it.total)}</b>
                      <span className="muted">{it.percent}%</span>
                    </Space>
                  </Space>
                  <Progress
                    percent={Number(it.percent || 0)}
                    showInfo={false}
                    size="small"
                    strokeColor={it.color}
                  />
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>
    </div>
  );
}
