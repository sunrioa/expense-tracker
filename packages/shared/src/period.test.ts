import { describe, expect, test } from 'bun:test';
import {
  InvalidPeriodError,
  inPeriodRange,
  normalizePeriod,
  periodLabelCN,
  periodRange,
  yearOf
} from './period';

describe('normalizePeriod', () => {
  test('各种写法都归一为 yyyy-MM', () => {
    expect(normalizePeriod('2026-09')).toBe('2026-09');
    expect(normalizePeriod('2026-9')).toBe('2026-09');
    expect(normalizePeriod('2026/09')).toBe('2026-09');
    expect(normalizePeriod('2026.9')).toBe('2026-09');
    expect(normalizePeriod('202609')).toBe('2026-09');
    expect(normalizePeriod('2026年9月')).toBe('2026-09');
    expect(normalizePeriod('  2026-09  ')).toBe('2026-09');
  });

  test('空白返回 undefined，而不是抛错', () => {
    expect(normalizePeriod(null)).toBeUndefined();
    expect(normalizePeriod(undefined)).toBeUndefined();
    expect(normalizePeriod('   ')).toBeUndefined();
  });

  test('格式非法抛 InvalidPeriodError', () => {
    expect(() => normalizePeriod('2026-13')).toThrow(InvalidPeriodError);
    expect(() => normalizePeriod('2026-00')).toThrow(InvalidPeriodError);
    expect(() => normalizePeriod('abc')).toThrow(InvalidPeriodError);
    expect(() => normalizePeriod('2026-09-01')).toThrow(InvalidPeriodError);
  });
});

describe('periodRange', () => {
  test('含两端', () => {
    expect(periodRange('2026-01', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
  });
  test('单月', () => {
    expect(periodRange('2026-09', '2026-09')).toEqual(['2026-09']);
  });
  test('跨年', () => {
    expect(periodRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  test('起止颠倒返回空', () => {
    expect(periodRange('2026-03', '2026-01')).toEqual([]);
  });
  test('缺一端返回空', () => {
    expect(periodRange('2026-01', undefined)).toEqual([]);
  });
  test('整年是 12 个月', () => {
    expect(periodRange('2026-01', '2026-12')).toHaveLength(12);
  });
});

describe('inPeriodRange', () => {
  test('闭区间', () => {
    expect(inPeriodRange('2026-05', '2026-01', '2026-12')).toBe(true);
    expect(inPeriodRange('2026-01', '2026-01', '2026-12')).toBe(true);
    expect(inPeriodRange('2026-12', '2026-01', '2026-12')).toBe(true);
    expect(inPeriodRange('2025-12', '2026-01', '2026-12')).toBe(false);
    expect(inPeriodRange('2027-01', '2026-01', '2026-12')).toBe(false);
  });
  test('只给一端', () => {
    expect(inPeriodRange('2026-05', '2026-01', undefined)).toBe(true);
    expect(inPeriodRange('2026-05', undefined, '2026-01')).toBe(false);
  });
  test('空月份永远不落在区间内', () => {
    expect(inPeriodRange('', '2026-01', '2026-12')).toBe(false);
    expect(inPeriodRange(null, undefined, undefined)).toBe(false);
  });
});

describe('periodLabelCN / yearOf', () => {
  test('标签', () => {
    expect(periodLabelCN('2026-09')).toBe('2026年09月');
    expect(periodLabelCN(null)).toBe('未知月份');
    expect(periodLabelCN('乱码')).toBe('乱码');
  });
  test('取年份，取不到给 0', () => {
    expect(yearOf('2026-09')).toBe(2026);
    expect(yearOf('乱码')).toBe(0);
    expect(yearOf(undefined)).toBe(0);
  });
});
