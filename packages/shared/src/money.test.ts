import { describe, expect, test } from 'bun:test';
import { fromCents, parseAmount, percentOf, roundAmount, sumAmounts, toCents, toDecimalString } from './money';

describe('金额用整数分运算，不受浮点误差影响', () => {
  test('经典的 0.1 + 0.2', () => {
    // 直接用 number 相加会得到 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
  });

  test('多笔小数累加不漂移', () => {
    const many = Array.from({ length: 100 }, () => 0.07);
    expect(sumAmounts(many)).toBe(7);
  });

  test('累加真实账目', () => {
    expect(sumAmounts([80, 160, 320.5, 2480.75, 3200, 268.4, 99])).toBe(6608.65);
  });

  test('接受 DECIMAL 字符串（mysql2 默认就是这么返回的）', () => {
    expect(sumAmounts(['80.00', '320.50'])).toBe(400.5);
    expect(parseAmount('3200.00')).toBe(3200);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount('不是数字')).toBe(0);
  });

  test('分与元互转', () => {
    expect(toCents(12.345)).toBe(1235); // 四舍五入到分
    expect(toCents(null)).toBe(0);
    expect(fromCents(1235)).toBe(12.35);
    expect(roundAmount('12.344')).toBe(12.34);
  });

  test('写库用的定点字符串', () => {
    expect(toDecimalString(80)).toBe('80.00');
    expect(toDecimalString(0.1 + 0.2)).toBe('0.30');
    expect(toDecimalString(null)).toBe('0.00');
  });
});

describe('percentOf', () => {
  test('保留两位', () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(1, 3)).toBe(33.33);
  });
  test('分母为 0 返回 0，不抛错', () => {
    expect(percentOf(10, 0)).toBe(0);
  });
  test('各部分之和约等于 100', () => {
    const parts = [3200, 2480.75, 320.5, 268.4];
    const grand = sumAmounts(parts);
    const sum = parts.reduce((s, p) => s + percentOf(p, grand), 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.05);
  });
});
