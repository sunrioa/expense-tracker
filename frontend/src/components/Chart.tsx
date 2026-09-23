import { useEffect, useRef, useState } from 'react';
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
 *
 * 容器用「回调 ref + state」而不是 useRef ——
 * 空态和有数据态渲染的是两个不同的 div，用 useRef 的话实例会一直绑在
 * 先挂载的那个节点上：切到空态时那个节点被卸载，再切回来 setOption 就画进了
 * 一个脱离文档的 canvas，图表区域一片空白，且不会自行恢复。
 * 改成 state 之后，节点变化会触发 effect 重跑，旧实例 dispose、新节点重新 init。
 */
export default function Chart({
  option,
  height = 300,
  empty = false,
  emptyText = '暂无数据'
}: ChartProps) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  // 实例的生命周期严格跟着容器节点走
  useEffect(() => {
    if (!box) return undefined;
    const chart = echarts.init(box, null, { renderer: 'canvas' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(box);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [box]);

  // box 也要进依赖：重新 init 之后必须把选项再喂一次
  useEffect(() => {
    if (chartRef.current && option) chartRef.current.setOption(option, true);
  }, [option, box]);

  if (empty) {
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyText}
      </div>
    );
  }
  return <div ref={setBox} className="chart-box" style={{ width: '100%', height }} />;
}
