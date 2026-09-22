import { DatePicker } from 'antd';
import { LeftOutlined, MoreOutlined, RightOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';

const { MonthPicker } = DatePicker;

export interface MonthBarProps {
  /** null = 查看全部月份 */
  month: Dayjs | null;
  onChange: (month: Dayjs | null) => void;
  onMore: () => void;
  /** 有筛选条件在生效时，给「更多」加个小红点 */
  hasFilter?: boolean;
}

/**
 * 手机上的吸顶月份条。
 *
 * 记账最常做的事是「翻到上个月看看花了多少」。原来月份选择器在页面最顶上，
 * 每次对比都得先滚回顶部；这里把它钉在导航栏下面，左右箭头直接翻月。
 * 其余用得少的筛选（跳转、搜索、批量生成）收进「更多」抽屉。
 */
export default function MonthBar({ month, onChange, onMore, hasFilter = false }: MonthBarProps) {
  const step = (delta: number) => {
    // 当前是「全部月份」时，先落到本月再步进，避免点了没反应
    const base = month ?? undefined;
    onChange(base ? base.add(delta, 'month') : null);
  };

  return (
    <div className="month-bar">
      <button
        type="button"
        className="month-step"
        aria-label="上一个月"
        disabled={!month}
        onClick={() => step(-1)}
      >
        <LeftOutlined />
      </button>

      <MonthPicker
        className="month-current"
        value={month}
        allowClear={false}
        format="YYYY年MM月"
        placeholder="全部月份"
        variant="borderless"
        inputReadOnly
        suffixIcon={null}
        onChange={(d) => onChange(d)}
      />

      <button
        type="button"
        className="month-step"
        aria-label="下一个月"
        disabled={!month}
        onClick={() => step(1)}
      >
        <RightOutlined />
      </button>

      <button
        type="button"
        className={`month-more${hasFilter ? ' has-filter' : ''}`}
        aria-label="更多筛选"
        onClick={onMore}
      >
        <MoreOutlined />
      </button>
    </div>
  );
}
