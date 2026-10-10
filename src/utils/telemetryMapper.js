/**
 * Telemetry mapping for the AeroSense BuildingTelemetry API.
 * -----------------------------------------------------------------------------
 * Field names here were taken from the deployed `AeroSense-API-Function` and
 * verified against live `GET /telemetry/latest` responses. A real record looks
 * like this (all numbers, `timestamp` is epoch SECONDS as a string):
 *
 *   {
 *     "zone_id": "zone-01",            "timestamp": "1791665633",
 *     "outdoor_aqi": 122,              "outdoor_pm25": 192.43,
 *     "indoor_pm25": 47.2,             "temperature": 26.3,
 *     "humidity": 32.35,               "co2": 1298,
 *     "occupancy": 58,                 "damper_pct": 12.77,
 *     "recommended_damper_pct": 35,    "fan_power_kw": 2.34,
 *     "current_fan_power_kw": 2.34,    "alerts": [],
 *     "optimizer_status": "recommendation_only",
 *     "optimizer_reason": "Elevated CO2: improve ventilation",
 *     "source": "simulator"
 *   }
 *
 * The API does NOT provide fan speed %, filter health, pressure drop, or
 * cumulative energy/cost. Those are reported as `null` and listed in `missing`
 * so the UI can show "n/a" instead of presenting a default as a live reading.
 */

/** Parse a value that must be numeric. Returns null when absent or unusable. */
function num(value, { min = null, max = null, decimals = null } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  let result = parsed;
  if (min !== null && result < min) result = min;
  if (max !== null && result > max) result = max;
  if (decimals !== null) result = Number(result.toFixed(decimals));
  return result;
}

/**
 * The API returns `timestamp` as epoch seconds in a string ("1791665633").
 * `new Date("1791665633")` is an Invalid Date, which silently broke chronological
 * sorting, so parse it explicitly. ISO strings are still accepted.
 */
export function parseTelemetryTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000;
  }
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    // Values past ~1e12 are already milliseconds.
    return seconds > 1e12 ? seconds : seconds * 1000;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Metrics the dashboard shows that this API does not currently publish. */
export const UNPUBLISHED_METRICS = Object.freeze([
  { key: 'fanSpeedPct', label: 'Fan speed %' },
  { key: 'filterHealthPct', label: 'Filter health %' },
  { key: 'currentDpPa', label: 'Filter pressure drop' },
  { key: 'cumulativeEnergyKwh', label: 'Cumulative energy' },
  { key: 'cumulativeCostUsd', label: 'Cumulative cost' },
]);

/**
 * Map one raw API record to dashboard state.
 *
 * Values the API did not supply come back as `null` rather than inheriting a
 * previous or default reading, so AWS Live can never display a number that AWS
 * did not actually send.
 */
export function mapBackendTelemetry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const aqi = num(raw.outdoor_aqi, { min: 0, max: 500, decimals: 0 });
  const pm25 = num(raw.indoor_pm25, { min: 0, max: 500, decimals: 1 });
  const outdoorPm25 = num(raw.outdoor_pm25, { min: 0, max: 1000, decimals: 2 });
  const temp = num(raw.temperature, { min: -20, max: 60, decimals: 1 });
  const humidity = num(raw.humidity, { min: 0, max: 100, decimals: 0 });
  const co2 = num(raw.co2, { min: 0, max: 5000, decimals: 0 });
  const occupancy = num(raw.occupancy, { min: 0, decimals: 0 });

  // Current position and the optimizer's recommendation are distinct readings
  // and must never collapse into each other: live data routinely differs
  // (e.g. damper_pct 12.77 vs recommended_damper_pct 35).
  const damperPct = num(raw.damper_pct, { min: 0, max: 100, decimals: 2 });
  const recommendedDamperPct = num(raw.recommended_damper_pct, { min: 0, max: 100, decimals: 2 });

  const fanPowerKw = num(raw.fan_power_kw ?? raw.current_fan_power_kw, { min: 0, max: 100, decimals: 2 });

  // `optimizer_reason` is the human-readable rationale. `optimizer_status` is a
  // machine status ("recommendation_only") and must not be shown as prose.
  const optimizerStatus = typeof raw.optimizer_status === 'string' ? raw.optimizer_status : null;
  const rationale =
    typeof raw.optimizer_reason === 'string' && raw.optimizer_reason.trim() !== ''
      ? raw.optimizer_reason.trim()
      : null;

  // Advisory mode is derived from the real status field.
  const recommendationOnly = optimizerStatus === null ? true : optimizerStatus === 'recommendation_only';

  const alerts = Array.isArray(raw.alerts)
    ? raw.alerts.filter((a) => typeof a === 'string' && a.trim() !== '')
    : [];

  const mapped = {
    aqi,
    pm25,
    outdoorPm25,
    temp,
    humidity,
    co2,
    occupancy,
    damperPct,
    recommendedDamperPct,
    fanPowerKw,
    optimizerStatus,
    recommendationOnly,
    rationale,
    alerts,
    // Not published by this API. Explicitly null, never a stand-in value.
    fanSpeedPct: null,
    filterHealthPct: null,
    currentDpPa: null,
    cumulativeEnergyKwh: null,
    cumulativeCostUsd: null,
    source: typeof raw.source === 'string' ? raw.source : null,
    timestampMs: parseTelemetryTimestamp(raw.timestamp),
    zoneId: raw.zone_id ?? null,
    raw,
  };

  // Anything the record genuinely lacked, so the UI can disclose it.
  mapped.missing = [
    ...UNPUBLISHED_METRICS.map((m) => m.key),
    ...['aqi', 'pm25', 'temp', 'humidity', 'co2', 'damperPct', 'recommendedDamperPct', 'fanPowerKw'].filter(
      (k) => mapped[k] === null
    ),
  ];

  return mapped;
}

/**
 * Build sparkline series from `GET /telemetry/history`.
 *
 * The API returns newest-first (DynamoDB query with ScanIndexForward=false), so
 * records are re-sorted oldest-first for display. Records missing a field are
 * skipped for that series rather than contributing an invented point.
 */
export function extractHistorySparklines(historyRecords) {
  const empty = { pm25History: [], co2History: [], powerHistory: [], filterHistory: [], aqiHistory: [] };
  if (!Array.isArray(historyRecords) || historyRecords.length === 0) return empty;

  const sorted = [...historyRecords].sort(
    (a, b) => (parseTelemetryTimestamp(a.timestamp) ?? 0) - (parseTelemetryTimestamp(b.timestamp) ?? 0)
  );

  const series = (pick, opts) =>
    sorted.map(pick).map((v) => num(v, opts)).filter((v) => v !== null);

  return {
    pm25History: series((r) => r.indoor_pm25, { min: 0, max: 500, decimals: 1 }).slice(-15),
    co2History: series((r) => r.co2, { min: 0, max: 5000, decimals: 0 }).slice(-15),
    powerHistory: series((r) => r.fan_power_kw ?? r.current_fan_power_kw, { min: 0, max: 100, decimals: 2 }).slice(-15),
    aqiHistory: series((r) => r.outdoor_aqi, { min: 0, max: 500, decimals: 0 }).slice(-15),
    // Filter health is not published by the API, so there is no series for it.
    filterHistory: [],
  };
}
