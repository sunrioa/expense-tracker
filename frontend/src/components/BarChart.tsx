import { Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { useElementWidth } from '../hooks/useElementWidth';
import { compact, yuan } from '../utils/format';
import { cls } from '../utils/cls';

export interface BarDatum {
  key: string;
  /** 完整标签，给读屏和提示用 */
  label: string;
  /** 坐标轴上的短标签 */
  short: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /**
   * 平均线：一条实线，不用虚线（虚线读起来像「预测」）。
   * 数值写在图表外的图例里 —— 写在线上会压住刚好比它高的那根柱子。
   */
  average?: number;
  tip: (d: BarDatum) => ReactNode;
  onSelect?: (d: BarDatum) => void;
}

/** 左侧刻度区的宽度，和样式里的 --axis-w 保持一致 */
const AXIS_W = 44;

/** 取整的刻度间隔：1 / 2 / 2.5 / 5 × 10^n */
function niceStep(max: number, count: number): number {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function ticksFor(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const step = niceStep(max, count);
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let i = 0; i * step <= top + step / 2; i++) out.push(i * step);
  return out;
}

/**
 * 柱状图。只有一个系列，自己用 HTML 画 —— 为了一张柱状图引入 ECharts
 * 要多下载近 1MB，还得在 JS 里另维护一套深浅色配色；这里直接吃 CSS 变量。
 *
 * 规格：柱宽不超过 24px、顶端 4px 圆角、1px 实线网格、只标最高的那一根，
 * 其余数值交给悬停提示和旁边的「列表」视图。
 */
export default function BarChart({ data, height = 220, average, tip, onSelect }: BarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = ticksFor(max);
  const top = ticks[ticks.length - 1] || 1;
  const peak = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  // 横轴标签放不下时隔几个显示一个，末尾那个总是显示
  const room = Math.max(1, Math.floor((width - AXIS_W) / 44));
  const every = Math.max(1, Math.ceil(data.length / room));

  return (
    <div className="bars" ref={ref}>
      <div className="bars-plot" style={{ height }}>
        <div className="bars-grid" aria-hidden="true">
          {ticks.map((t) => (
            <div key={t} className={cls('bars-tick', t === 0 && 'is-base')} style={{ bottom: `${(t / top) * 100}%` }}>
              <span className="bars-tick-label">{compact(t)}</span>
            </div>
          ))}
          {average !== undefined && average > 0 && (
            <div className="bars-avg" style={{ bottom: `${(average / top) * 100}%` }} />
          )}
        </div>

        <div className="bars-cols">
          {data.map((d, i) => (
            <Tooltip key={d.key} title={tip(d)} mouseEnterDelay={0.05}>
              <button
                type="button"
                className={cls('bars-col', !onSelect && 'is-static')}
                aria-label={`${d.label} ${yuan(d.value)}`}
                tabIndex={onSelect ? 0 : -1}
                onClick={onSelect ? () => onSelect(d) : undefined}
              >
                <span className="bars-bar" style={{ height: `${(d.value / top) * 100}%` }}>
                  {i === peak && <span className="bars-peak">{compact(d.value)}</span>}
                </span>
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="bars-x" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className="bars-x-label">
            {i % every === 0 || i === data.length - 1 ? d.short : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
