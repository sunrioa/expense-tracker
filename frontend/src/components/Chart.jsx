import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/**
 * 轻量 ECharts 包装：选项变化时重绘，容器尺寸变化时自适应。
 */
export default function Chart({ option, height = 300, empty = false, emptyText = '暂无数据' }) {
  const boxRef = useRef(null);
  const chartRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!boxRef.current || empty) return undefined;

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

  useEffect(() => () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }
  }, []);

  if (empty) {
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyText}
      </div>
    );
  }
  return <div ref={boxRef} style={{ width: '100%', height }} />;
}
