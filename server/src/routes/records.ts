import {
  batchFillRequestSchema,
  optionsQuerySchema,
  rangeQuerySchema,
  recordPatchSchema,
  recordRequestSchema
} from '@ledger/shared/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { ExpenseService } from '../services/expense.service';
import { ok } from '../http/response';
import { validate } from '../http/validate';

const idParamSchema = z.object({
  id: z.coerce.number('记录 ID 必须是数字').int('记录 ID 必须是整数')
});

export function recordRoutes(service: ExpenseService) {
  return new Hono()
    /** 树形查询：顶级为支出名称，下挂子项 */
    .get('/tree', validate('query', rangeQuerySchema), async (c) =>
      c.json(ok(await service.tree(c.req.valid('query'))))
    )

    /** 扁平明细，仅叶子节点 */
    .get('/leaves', validate('query', rangeQuerySchema), async (c) =>
      c.json(ok(await service.leaves(c.req.valid('query'))))
    )

    /** 父项下拉：传 period 只看该月 */
    .get('/options', validate('query', optionsQuerySchema), async (c) =>
      c.json(ok(await service.options(c.req.valid('query').period)))
    )

    /** 已有的月份列表（倒序），用于月份快捷切换 */
    .get('/periods', async (c) => c.json(ok(await service.periods())))

    .post('/', validate('json', recordRequestSchema), async (c) =>
      c.json(ok(await service.create(c.req.valid('json'))))
    )

    /** 按月批量生成：若干子项 × 一段月份 */
    .post('/batch', validate('json', batchFillRequestSchema), async (c) =>
      c.json(ok(await service.batchFill(c.req.valid('json'))))
    )

    .put(
      '/:id',
      validate('param', idParamSchema),
      validate('json', recordPatchSchema),
      async (c) => c.json(ok(await service.update(c.req.valid('param').id, c.req.valid('json'))))
    )

    .delete('/:id', validate('param', idParamSchema), async (c) =>
      c.json(ok(await service.remove(c.req.valid('param').id)))
    );
}
