import { Tooltip } from 'antd';
import { percent, yuan } from '../utils/format';

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** 色板槽位，0 = 其他 */
  slot: number;
}

export const slotColor = (slot: number): string => `var(--c${slot})`;

/** 超过 max 段时，尾部合成一段「其他」—— 颜色不够分，硬凑新颜色只会更难分辨 */
function fold(segments: Segment[], max: number): Segment[] {
  const list = segments.filter((s) => s.value > 0);
  if (list.length <= max) return list;
  const head = list.slice(0, max - 1);
  const tail = list.slice(max - 1);
  return [
    ...head,
    { key: '__other', label: `其他 ${tail.length} 项`, value: tail.reduce((s, x) => s + x.value, 0), slot: 0 }
  ];
}

/**
 * 占比条：一条横向堆叠条看清「钱都花在哪」。
 * 段与段之间留 2px 底色缝隙来区分，而不是给每段描边。
 * 图例就是下面的明细列表（每行同色圆点），这里不再重复。
 */
export default function CompositionBar({ segments, total, max = 8 }: { segments: Segment[]; total: number; max?: number }) {
  const list = fold(segments, max);
  if (!list.length || total <= 0) return null;
  return (
    <div className="comp" role="img" aria-label={list.map((s) => `${s.label} ${percent(s.value, total)}`).join('，')}>
      {list.map((s) => (
        <Tooltip key={s.key} title={`${s.label} · ${yuan(s.value)} · ${percent(s.value, total)}`} mouseEnterDelay={0.1}>
          <span className="comp-seg" style={{ flexGrow: s.value, background: slotColor(s.slot) }} />
        </Tooltip>
      ))}
    </div>
  );
}
