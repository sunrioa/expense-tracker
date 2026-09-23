import { normalizePeriod } from '@ledger/shared';
import type { StatsQuery, StatsResponse } from '@ledger/shared';
import type { RecordRepository } from '../db/repository';
import { computeStats } from '../domain/stats';

/**
 * 统计服务。
 *
 * 聚合逻辑全在 domain/stats.ts 里，是纯函数；这一层只负责取数和归一化入参。
 */
export function createStatsService(repo: RecordRepository) {
  async function stats(query: StatsQuery): Promise<StatsResponse> {
    return computeStats(await repo.findAll(), {
      // 与原 Java 版一致：统计接口会归一化月份，非法格式直接 400
      from: normalizePeriod(query.from),
      to: normalizePeriod(query.to),
      granularity: query.granularity
    });
  }
  return { stats };
}

export type StatsService = ReturnType<typeof createStatsService>;
