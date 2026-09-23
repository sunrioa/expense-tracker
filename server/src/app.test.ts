import { describe, expect, test } from 'bun:test';
import { createApp } from './app';
import { createMemoryRepository } from './db/memory';
import type { ExpenseRow } from './domain/types';
import { createExpenseService } from './services/expense.service';
import { createStatsService } from './services/stats.service';

const row = (id: number, parentId: number | null, name: string, amount: number, period: string): ExpenseRow => ({
  id, parentId, name, detail: null, amount, period, sortOrder: 0
});

function makeApp(seed: ExpenseRow[] = []) {
  const repo = createMemoryRepository(seed);
  return createApp({ expense: createExpenseService(repo), stats: createStatsService(repo) });
}

const SEED = [
  row(1, null, '交通', 0, '2026-09'),
  row(2, 1, '单车', 80, '2026-09'),
  row(3, null, '吃', 200, '2026-09')
];

const json = async (res: Response) => (await res.json()) as { success: boolean; message: string; data?: unknown };

describe('HTTP 契约', () => {
  test('健康检查', async () => {
    const res = await makeApp().request('/api/health');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect((body.data as { status: string }).status).toBe('UP');
  });

  test('所有响应都是 { success, message, data } 包装', async () => {
    const body = await json(await makeApp(SEED).request('/api/records/tree'));
    expect(body).toMatchObject({ success: true, message: 'ok' });
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('失败响应不带 data 字段（与原 Jackson non_null 行为一致）', async () => {
    const res = await makeApp().request('/api/records/999', { method: 'DELETE' });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.success).toBe(false);
    expect(body.message).toBe('记录不存在：999');
    expect('data' in body).toBe(false);
  });

  test('响应里缺席的字段直接不出现，而不是 null', async () => {
    const body = await json(await makeApp(SEED).request('/api/records/tree'));
    const first = (body.data as Array<Record<string, unknown>>)[0]!;
    expect('parentId' in first).toBe(false); // 顶级条目没有父项
    expect(first.name).toBe('交通');
  });

  test('校验失败返回 400 和中文文案', async () => {
    const res = await makeApp().request('/api/records', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', amount: -5 })
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.message).toContain('支出名称不能为空');
    expect(body.message).toContain('支出金额不能为负数');
    // 多条错误用「；」连接
    expect(body.message).toContain('；');
  });

  test('月份格式非法返回 400 而不是 500', async () => {
    const res = await makeApp().request('/api/stats?from=2026-13');
    expect(res.status).toBe(400);
    expect((await json(res)).message).toContain('月份不合法');
  });

  test('路径参数不是数字时返回 400', async () => {
    const res = await makeApp().request('/api/records/abc', { method: 'DELETE' });
    expect(res.status).toBe(400);
  });

  test('增改查删走一圈', async () => {
    const app = makeApp(SEED);

    const created = await json(
      await app.request('/api/records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '话费', amount: 99, period: '2026-09' })
      })
    );
    const id = (created.data as { id: number }).id;
    expect(id).toBeGreaterThan(0);

    await app.request(`/api/records/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 120 })
    });

    const tree = await json(await app.request('/api/records/tree'));
    const phone = (tree.data as Array<{ name: string; subtotal: number }>).find((n) => n.name === '话费')!;
    expect(phone.subtotal).toBe(120);

    const del = await json(await app.request(`/api/records/${id}`, { method: 'DELETE' }));
    expect((del.data as { deleted: number }).deleted).toBe(1);
  });

  test('批量生成', async () => {
    const res = await makeApp().request('/api/records/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        parentName: '房租',
        items: [{ name: '主卧', amount: 3200 }],
        fromPeriod: '2026-01',
        toPeriod: '2026-12'
      })
    });
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ months: 12, created: 12, parentCreated: 12, totalAmount: 38400 });
  });

  test('整月复制', async () => {
    const app = makeApp(SEED);
    const post = (body: unknown) =>
      app.request('/api/records/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });

    const first = await json(await post({ from: '2026-09', to: '2026-10' }));
    expect(first).toMatchObject({ success: true, data: { created: 3, skipped: 0, totalAmount: 280 } });

    const again = await json(await post({ from: '2026-09', to: '2026-10' }));
    expect(again.data).toMatchObject({ created: 0, skipped: 2 });

    const same = await post({ from: '2026-09', to: '2026-09' });
    expect(same.status).toBe(400);
    expect((await json(same)).message).toBe('源月份和目标月份相同，不需要复制');

    const missing = await post({ to: '2026-10' });
    expect(missing.status).toBe(400);
    expect((await json(missing)).message).toContain('请选择要复制的月份');
  });

  test('统计接口', async () => {
    const body = await json(await makeApp(SEED).request('/api/stats?from=2026-09&to=2026-09'));
    expect(body.data).toMatchObject({ granularity: 'month', total: 280, recordCount: 2, monthCount: 1 });
  });

  test('未知路由 404', async () => {
    expect((await makeApp().request('/api/不存在')).status).toBe(404);
  });

  test('CORS 预检', async () => {
    const res = await makeApp().request('/api/records/tree', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' }
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
