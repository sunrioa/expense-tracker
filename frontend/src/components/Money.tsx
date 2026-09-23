import { money } from '../utils/format';
import { cls } from '../utils/cls';

/**
 * 金额：小数部分和 ¥ 缩小一号，整数部分才是视线落点。
 * 大号数字用比例数字（不加 tabular-nums），列表里的对齐由外层样式负责。
 */
export default function Money({ value, className, symbol = true }: { value: number; className?: string; symbol?: boolean }) {
  const [int, dec = '00'] = money(value).split('.');
  return (
    <span className={cls('money', className)}>
      {symbol && <span className="money-cur">¥</span>}
      {int}
      <span className="money-dec">.{dec}</span>
    </span>
  );
}
