import type { ExpenseRow } from '../domain/types';

/**
 * 内存模式的演示数据 —— 只在 DB_DRIVER=memory 且 SEED_DEMO=1 时灌入，
 * 用来在没有 MySQL 的机器上把界面跑起来看效果。
 */
export function demoRows(): ExpenseRow[] {
  const rows: ExpenseRow[] = [];
  let id = 1;
  const push = (
    parentId: number | null,
    name: string,
    detail: string | null,
    amount: number,
    period: string
  ): number => {
    rows.push({ id, parentId, name, detail, amount, period, sortOrder: 0 });
    return id++;
  };

  const now = new Date();
  // 最近 9 个月，每月一套结构相同的记录，金额逐月波动
  for (let back = 8; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const wave = 1 + ((back * 7) % 5) / 10;

    const traffic = push(null, '交通', null, 0, period);
    push(traffic, '单车', '月卡', Math.round(80 * wave), period);
    push(traffic, '公交', '上下班', Math.round(160 * wave), period);
    push(traffic, '地铁', '通勤 + 周末', Math.round(320.5 * wave * 100) / 100, period);

    push(null, '吃', '工作日午餐 + 周末下馆子', Math.round(2480.75 * wave * 100) / 100, period);

    const rent = push(null, '房租', null, 0, period);
    push(rent, '主卧', '含物业', 3200, period);
    push(rent, '水电燃气', `${d.getMonth() + 1} 月账单`, Math.round(268.4 * wave * 100) / 100, period);

    push(null, '话费', '套餐 + 流量包', 99, period);

    const fun = push(null, '娱乐', null, 0, period);
    push(fun, '电影', '看了 3 场', Math.round(186 * wave), period);
    push(fun, '订阅', '音乐 + 视频', 45, period);
  }
  return rows;
}
