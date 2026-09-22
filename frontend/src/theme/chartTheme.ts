import type { ColorScheme } from '../hooks/useColorScheme';

/**
 * ECharts 配色。
 *
 * ECharts 的 option 是纯 JS 对象，读不到 CSS 变量，所以配色必须在这里单独维护一份。
 * 取值和 styles.css 的 token 对齐：浅色用深青绿，深色提亮到 teal-300/400 一档，
 * 否则近黑背景上柱子几乎看不见。
 */
export interface ChartTheme {
  axisLine: string;
  axisLabel: string;
  axisLabelMuted: string;
  splitLine: string;
  /** 柱状图的纵向渐变，从顶到底 */
  bar: [string, string, string];
  barHover: [string, string];
  barLabel: string;
  lineStroke: string;
  lineSymbol: string;
  /** 折线下方面积的渐变，从顶到底 */
  area: [string, string];
  pieBorder: string;
  legendText: string;
  progress: [string, string];
  summaryText: string;
}

const LIGHT: ChartTheme = {
  axisLine: '#dfe9e6',
  axisLabel: '#4a5c56',
  axisLabelMuted: '#7a8d87',
  splitLine: '#e8f1ee',
  bar: ['#14b8a6', '#0d9488', '#0e7490'],
  barHover: ['#5eead4', '#0f766e'],
  barLabel: '#115e59',
  lineStroke: '#65a30d',
  lineSymbol: '#4d7c0f',
  area: ['rgba(101,163,13,0.28)', 'rgba(13,148,136,0.04)'],
  pieBorder: '#ffffff',
  legendText: '#4a5c56',
  progress: ['#0f766e', '#0891b2'],
  summaryText: '#115e59'
};

const DARK: ChartTheme = {
  axisLine: '#24352f',
  axisLabel: '#9fb3ac',
  axisLabelMuted: '#7a908a',
  splitLine: '#1c2b27',
  bar: ['#7de3d4', '#2dd4bf', '#0e7490'],
  barHover: ['#99f6e4', '#0891b2'],
  barLabel: '#5eead4',
  lineStroke: '#a3e635',
  lineSymbol: '#bef264',
  area: ['rgba(163,230,53,0.24)', 'rgba(45,212,191,0.03)'],
  pieBorder: '#101d1a',
  legendText: '#9fb3ac',
  progress: ['#2dd4bf', '#38bdf8'],
  summaryText: '#5eead4'
};

export function chartTheme(scheme: ColorScheme): ChartTheme {
  return scheme === 'dark' ? DARK : LIGHT;
}
