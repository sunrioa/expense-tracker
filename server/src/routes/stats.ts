import { statsQuerySchema } from '@ledger/shared/schemas';
import { Hono } from 'hono';
import { ok } from '../http/response';
import { validate } from '../http/validate';
import type { StatsService } from '../services/stats.service';

export function statsRoutes(service: StatsService) {
  return new Hono().get('/stats', validate('query', statsQuerySchema), async (c) =>
    c.json(ok(await service.stats(c.req.valid('query'))))
  );
}
