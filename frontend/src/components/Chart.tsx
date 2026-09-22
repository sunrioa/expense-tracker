import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';

export interface ChartProps {
  /** empty 为 true 时不需要传 */
  option?: EChartsOption;
  height?: number;
  empty?: boolean;
  emptyText?: string;
}

/**
 * 轻量 ECharts 包装：选项变化时重绘，容器尺寸变化时自适应。
 */
export default function Chart({
  option,
  height = 300,
  empty = false,
  emptyText = '暂无数据'
}: ChartProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    // 原来这里只判断了 boxRef / empty，option 是否存在靠调用方自觉。
    // 类型收紧后顺手补上，空 option 直接跳过绘制。
    if (!boxRef.current || empty || !option) return undefined;

    if (!chartRef.current) {
      chartRef.current = echarts.init(boxRef.current, null, { renderer: 'canvas' });
    }
    chartRef.current.setOption(option, true);

    if (!observerRef.current) {
      observerRef.current = new ResizeObserver(() => {
        if (chartRef.current) chartRef.current.resize();
      });
      observerRef.current.observe(boxRef.current);
    }
    return undefined;
  }, [option, empty]);

  useEffect(
    () => () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    },
    []
  );

  if (empty) {
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyText}
      </div>
    );
  }
  return <div ref={boxRef} className="chart-box" style={{ width: '100%', height }} />;
}
