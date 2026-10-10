/**
 * Regression tests for the crash:
 *   TypeError: Cannot read properties of null (reading 'toFixed')
 */
import { describe, it, expect } from 'vitest';
import {
  toFiniteNumber, isFiniteNumber, formatNumber, formatPercent,
  formatCurrency, numberOr, atLeast, below, NOT_AVAILABLE,
} from './formatNumber';

describe('toFiniteNumber', () => {
  it('accepts real numbers including zero and negatives', () => {
    expect(toFiniteNumber(12.77)).toBe(12.77);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-5.5)).toBe(-5.5);
  });

  it('accepts numeric strings, as DynamoDB numbers can arrive as strings', () => {
    expect(toFiniteNumber('12.77')).toBe(12.77);
    expect(toFiniteNumber('0')).toBe(0);
    expect(toFiniteNumber('  42  ')).toBe(42);
    expect(toFiniteNumber('1e3')).toBe(1000);
  });

  it('rejects every value that cannot be a measurement', () => {
    for (const bad of [null, undefined, NaN, Infinity, -Infinity, '', '   ', 'abc', '12abc', {}, [], [1], true, false]) {
      expect(toFiniteNumber(bad), `${String(bad)} must be rejected`).toBeNull();
    }
  });

  it('does not let booleans or arrays coerce into numbers', () => {
    // Number(true) === 1 and Number([5]) === 5; neither is a reading.
    expect(toFiniteNumber(true)).toBeNull();
    expect(toFiniteNumber([5])).toBeNull();
  });
});

describe('formatNumber', () => {
  it('formats zero rather than treating it as missing', () => {
    expect(formatNumber(0, { digits: 1 })).toBe('0.0');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(isFiniteNumber(0)).toBe(true);
  });

  it('returns N/A instead of formatting an unavailable value as zero', () => {
    for (const bad of [null, undefined, NaN, Infinity, 'abc', '']) {
      expect(formatNumber(bad, { digits: 2 })).toBe(NOT_AVAILABLE);
    }
    expect(formatPercent(null)).toBe('N/A');
    expect(formatCurrency(null)).toBe('N/A');
  });

  it('never emits a bare unit with no number', () => {
    // "N/A" alone, not "$N/A" or "N/A%", unless explicitly asked.
    expect(formatCurrency(null)).not.toContain('$');
    expect(formatPercent(null)).not.toContain('%');
    expect(formatCurrency(null, 2, { affixFallback: true })).toBe('$N/A');
  });

  it('applies digits, prefix and suffix to real values', () => {
    expect(formatNumber(2.345, { digits: 2, suffix: ' kW' })).toBe('2.35 kW');
    expect(formatCurrency(0.3456)).toBe('$0.35');
    expect(formatPercent(12.77)).toBe('12.8%');
    expect(formatPercent('12.77')).toBe('12.8%');
  });

  it('groups large numbers when no digit count is given', () => {
    expect(formatNumber(1298)).toBe((1298).toLocaleString());
  });
});

describe('numeric guards', () => {
  it('numberOr substitutes only for layout maths', () => {
    expect(numberOr(null, 0)).toBe(0);
    expect(numberOr(null, 100)).toBe(100);
    expect(numberOr(0, 100)).toBe(0);
    expect(numberOr('42', 0)).toBe(42);
    expect(numberOr(NaN, 7)).toBe(7);
  });

  it('threshold checks are false for unavailable values', () => {
    // A missing fan speed must not light up a "MAX SCRUBBING" badge, and a
    // missing filter health must not read as critically low.
    expect(atLeast(null, 70)).toBe(false);
    expect(atLeast(NaN, 70)).toBe(false);
    expect(below(null, 30)).toBe(false);
    expect(below(undefined, 30)).toBe(false);

    expect(atLeast(70, 70)).toBe(true);
    expect(atLeast('71', 70)).toBe(true);
    expect(below(29.9, 30)).toBe(true);
    expect(below(0, 30)).toBe(true);
  });
});

describe('the exact production crash', () => {
  it('formats the values that threw, instead of throwing', () => {
    // AWS Live passes null for every metric the API does not publish.
    const unpublished = {
      fanSpeedPct: null,
      filterHealthPct: null,
      currentDpPa: null,
      cumulativeEnergyKwh: null,
      cumulativeCostUsd: null,
    };

    expect(() => formatPercent(unpublished.fanSpeedPct)).not.toThrow();
    expect(() => formatCurrency(unpublished.cumulativeCostUsd)).not.toThrow();
    expect(() => formatNumber(unpublished.cumulativeEnergyKwh, { digits: 2, suffix: ' kWh' })).not.toThrow();

    expect(formatPercent(unpublished.fanSpeedPct)).toBe('N/A');
    expect(formatCurrency(unpublished.cumulativeCostUsd)).toBe('N/A');
  });

  it('a default parameter does not protect against an explicit null', () => {
    // This is why the crash happened: TelemetryAuditCard declared
    // `fanSpeedPct = 28` but was handed null, and defaults apply to
    // `undefined` only.
    const withDefault = (fanSpeedPct = 28) => fanSpeedPct;
    expect(withDefault(undefined)).toBe(28);
    expect(withDefault(null)).toBeNull();
    expect(() => withDefault(null).toFixed(1)).toThrow(TypeError);
    expect(formatPercent(withDefault(null))).toBe('N/A');
  });
});
