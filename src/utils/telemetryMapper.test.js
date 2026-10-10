/**
 * Mapper tests pinned to the real BuildingTelemetry schema.
 *
 * `LIVE_RECORD` is an unmodified response body captured from
 * GET /telemetry/latest?zone_id=zone-01 on the deployed API.
 */
import { describe, it, expect } from 'vitest';
import {
  mapBackendTelemetry,
  extractHistorySparklines,
  parseTelemetryTimestamp,
  UNPUBLISHED_METRICS,
} from './telemetryMapper';

const LIVE_RECORD = {
  fan_power_kw: 2.34,
  outdoor_aqi: 122,
  co2: 1298,
  optimizer_status: 'recommendation_only',
  source: 'simulator',
  temperature: 26.3,
  zone_id: 'zone-01',
  current_fan_power_kw: 2.34,
  alerts: [],
  damper_pct: 12.77,
  humidity: 32.35,
  outdoor_pm25: 192.43,
  recommended_damper_pct: 35,
  occupancy: 58,
  indoor_pm25: 47.2,
  optimizer_reason: 'Elevated CO2: improve ventilation',
  timestamp: '1791665633',
};

describe('timestamp parsing', () => {
  it('reads the epoch-seconds string the API actually sends', () => {
    // new Date("1791665633") is an Invalid Date, which silently broke sorting.
    expect(parseTelemetryTimestamp('1791665633')).toBe(1791665633000);
  });

  it('still accepts ISO strings and millisecond epochs', () => {
    expect(parseTelemetryTimestamp('2026-10-01T00:00:00Z')).toBe(Date.parse('2026-10-01T00:00:00Z'));
    expect(parseTelemetryTimestamp(1791665633000)).toBe(1791665633000);
  });

  it('returns null for unusable input rather than a bogus date', () => {
    expect(parseTelemetryTimestamp('not-a-date')).toBeNull();
    expect(parseTelemetryTimestamp(null)).toBeNull();
    expect(parseTelemetryTimestamp('')).toBeNull();
  });
});

describe('mapping a live record', () => {
  const mapped = mapBackendTelemetry(LIVE_RECORD);

  it('reads every published reading from its real field name', () => {
    expect(mapped).toMatchObject({
      aqi: 122,
      pm25: 47.2,
      outdoorPm25: 192.43,
      temp: 26.3,
      humidity: 32,
      co2: 1298,
      occupancy: 58,
      fanPowerKw: 2.34,
      zoneId: 'zone-01',
      source: 'simulator',
    });
  });

  it('keeps the current damper position distinct from the recommendation', () => {
    // The live record genuinely differs: 12.77 now vs 35 recommended. Reading
    // `recommended_damper_pct` is what makes the optimizer's advice visible.
    expect(mapped.damperPct).toBe(12.77);
    expect(mapped.recommendedDamperPct).toBe(35);
    expect(mapped.recommendedDamperPct).not.toBe(mapped.damperPct);
  });

  it('uses optimizer_reason as the rationale, not the machine status', () => {
    expect(mapped.rationale).toBe('Elevated CO2: improve ventilation');
    expect(mapped.rationale).not.toContain('recommendation_only');
    expect(mapped.optimizerStatus).toBe('recommendation_only');
  });

  it('derives advisory mode from the real status field', () => {
    expect(mapped.recommendationOnly).toBe(true);
    expect(mapBackendTelemetry({ ...LIVE_RECORD, optimizer_status: 'actuating' }).recommendationOnly).toBe(false);
  });

  it('parses the record timestamp', () => {
    expect(mapped.timestampMs).toBe(1791665633000);
  });

  it('reports metrics the API does not publish as null, never as a default', () => {
    for (const { key } of UNPUBLISHED_METRICS) {
      expect(mapped[key], `${key} must be null`).toBeNull();
      expect(mapped.missing).toContain(key);
    }
  });

  it('does not inherit a previous reading for an absent field', () => {
    const partial = mapBackendTelemetry({ zone_id: 'zone-01', timestamp: '1791665633', co2: 900 });
    expect(partial.co2).toBe(900);
    // Absent, so null — not carried over and not defaulted.
    expect(partial.aqi).toBeNull();
    expect(partial.pm25).toBeNull();
    expect(partial.missing).toContain('aqi');
    expect(partial.missing).toContain('pm25');
  });

  it('returns null for a non-record', () => {
    expect(mapBackendTelemetry(null)).toBeNull();
    expect(mapBackendTelemetry('nope')).toBeNull();
  });
});

describe('history sparklines', () => {
  it('re-sorts the API newest-first ordering into chronological order', () => {
    const newestFirst = [
      { timestamp: '1791665693', indoor_pm25: 12.4, co2: 702, fan_power_kw: 0.85, outdoor_aqi: 120 },
      { timestamp: '1791665633', indoor_pm25: 11.1, co2: 690, fan_power_kw: 0.8, outdoor_aqi: 118 },
      { timestamp: '1791665573', indoor_pm25: 10.2, co2: 680, fan_power_kw: 0.78, outdoor_aqi: 115 },
    ];
    const series = extractHistorySparklines(newestFirst);
    expect(series.pm25History).toEqual([10.2, 11.1, 12.4]);
    expect(series.co2History).toEqual([680, 690, 702]);
    expect(series.aqiHistory).toEqual([115, 118, 120]);
  });

  it('skips records that lack a field instead of inventing a point', () => {
    const series = extractHistorySparklines([
      { timestamp: '1791665633', indoor_pm25: 11.1 },
      { timestamp: '1791665693' },
      { timestamp: '1791665753', indoor_pm25: 12.4 },
    ]);
    expect(series.pm25History).toEqual([11.1, 12.4]);
    expect(series.co2History).toEqual([]);
  });

  it('returns no filter-health series, because the API publishes none', () => {
    const series = extractHistorySparklines([{ timestamp: '1791665633', indoor_pm25: 11.1 }]);
    expect(series.filterHistory).toEqual([]);
  });

  it('returns empty series for empty history', () => {
    expect(extractHistorySparklines([])).toMatchObject({ pm25History: [], co2History: [] });
    expect(extractHistorySparklines(null)).toMatchObject({ pm25History: [] });
  });
});
