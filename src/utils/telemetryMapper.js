/**
 * Telemetry Mapping Utility for AeroSense
 * Converts raw AWS backend DynamoDB / API Gateway JSON payloads into typed frontend state.
 * Preserves strict distinction between current damper position and recommended damper position.
 */

/**
 * Safely parse a numeric value with bounds checking and fallback
 */
function parseNum(value, fallback = 0, min = null, max = null, decimals = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return fallback;
  }
  let result = parsed;
  if (min !== null && result < min) result = min;
  if (max !== null && result > max) result = max;
  if (decimals !== null) {
    result = Number(result.toFixed(decimals));
  }
  return result;
}

/**
 * Map raw telemetry item from AWS API into normalized state object
 */
export function mapBackendTelemetry(raw, fallbackState = {}) {
  if (!raw || typeof raw !== 'object') {
    return fallbackState;
  }

  // 1. Mandatory Field Mappings as specified in requirements:
  // - outdoor_aqi -> AQI
  // - indoor_pm25 -> PM2.5
  // - temperature -> temperature
  const aqi = parseNum(
    raw.outdoor_aqi ?? raw.outdoorAQI ?? raw.aqi ?? raw.ambient_aqi,
    fallbackState.aqi ?? 32,
    0,
    500,
    0
  );

  const pm25 = parseNum(
    raw.indoor_pm25 ?? raw.indoorPM25 ?? raw.pm25 ?? raw.pm2_5,
    fallbackState.pm25 ?? 8.0,
    0,
    500,
    1
  );

  const temp = parseNum(
    raw.temperature ?? raw.temp ?? raw.indoor_temperature ?? raw.temp_c,
    fallbackState.temp ?? 22.0,
    -20,
    60,
    1
  );

  const humidity = parseNum(
    raw.humidity ?? raw.indoor_humidity ?? raw.rh_pct,
    fallbackState.humidity ?? 48,
    0,
    100,
    0
  );

  const co2 = parseNum(
    raw.co2 ?? raw.indoor_co2 ?? raw.co2_ppm,
    fallbackState.co2 ?? 415,
    300,
    3000,
    0
  );

  // 2. Current Damper Position vs Recommended Damper Position
  const damperPct = parseNum(
    raw.damper_position ?? raw.current_damper ?? raw.damper_pct ?? raw.damper,
    fallbackState.damperPct ?? 20.0,
    0,
    100,
    1
  );

  const recommendedDamperPct = parseNum(
    raw.recommended_damper_position ??
      raw.recommended_damper ??
      raw.optimizer_recommended_damper ??
      raw.target_damper ??
      damperPct,
    damperPct,
    0,
    100,
    1
  );

  // 3. Fan Speed, Power & Physical Fields
  const fanSpeedPct = parseNum(
    raw.fan_speed ?? raw.vfd_fan_speed ?? raw.fan_speed_pct ?? raw.fan_pct,
    fallbackState.fanSpeedPct ?? 28.0,
    0,
    100,
    1
  );

  const fanPowerKw = parseNum(
    raw.power ?? raw.fan_power_kw ?? raw.power_kw ?? raw.kw,
    fallbackState.fanPowerKw ?? 0.85,
    0,
    50,
    2
  );

  // 4. HEPA & Economic Metrics (Derived/Provided)
  const filterHealthPct = parseNum(
    raw.filter_health ?? raw.filter_health_pct ?? raw.hepa_health,
    fallbackState.filterHealthPct ?? 97.2,
    0,
    100,
    1
  );

  const currentDpPa = parseNum(
    raw.current_dp_pa ?? raw.pressure_drop ?? raw.dp_pa,
    fallbackState.currentDpPa ?? 130,
    0,
    1000,
    0
  );

  const cumulativeEnergyKwh = parseNum(
    raw.cumulative_energy_kwh ?? raw.energy_kwh,
    fallbackState.cumulativeEnergyKwh ?? 0.08,
    0,
    10000,
    2
  );

  const cumulativeCostUsd = parseNum(
    raw.cumulative_cost_usd ?? raw.cost_usd,
    fallbackState.cumulativeCostUsd ?? 0.04,
    0,
    10000,
    2
  );

  // 5. Advisory / Rationale & Operational Metadata
  const recommendationOnly = Boolean(
    raw.recommendation_only ?? raw.is_recommendation ?? raw.advisory_mode ?? true
  );

  const rationale =
    typeof raw.rationale === 'string' && raw.rationale.trim() !== ''
      ? raw.rationale
      : typeof raw.optimizer_status === 'string' && raw.optimizer_status.trim() !== ''
      ? raw.optimizer_status
      : typeof raw.recommendation_reason === 'string' && raw.recommendation_reason.trim() !== ''
      ? raw.recommendation_reason
      : 'AWS Live Optimizer Active: Live stream from DynamoDB BuildingTelemetry.';

  const timestamp = raw.timestamp || raw.updated_at || raw.created_at || new Date().toISOString();
  const zoneId = raw.zone_id || raw.zoneId || fallbackState.selectedZone || 'Zone-1';

  return {
    aqi,
    pm25,
    temp,
    humidity,
    co2,
    damperPct,
    recommendedDamperPct,
    fanSpeedPct,
    fanPowerKw,
    filterHealthPct,
    currentDpPa,
    cumulativeEnergyKwh,
    cumulativeCostUsd,
    recommendationOnly,
    rationale,
    timestamp,
    zoneId,
    raw,
  };
}

/**
 * Convert raw historical telemetry array from /telemetry/history into sparkline arrays
 */
export function extractHistorySparklines(historyRecords, defaultSparklines = {}) {
  if (!Array.isArray(historyRecords) || historyRecords.length === 0) {
    return {
      pm25History: defaultSparklines.pm25History || [8.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5],
      co2History: defaultSparklines.co2History || [640, 645, 652, 648, 655, 650, 650],
      powerHistory: defaultSparklines.powerHistory || [0.82, 0.84, 0.85, 0.83, 0.86, 0.85, 0.85],
      filterHistory: defaultSparklines.filterHistory || [98.0, 97.8, 97.6, 97.5, 97.4, 97.3, 97.2],
    };
  }

  // Sort chronological (oldest to newest) if timestamp is present
  const sorted = [...historyRecords].sort((a, b) => {
    const tA = new Date(a.timestamp || a.created_at || 0).getTime();
    const tB = new Date(b.timestamp || b.created_at || 0).getTime();
    return tA - tB;
  });

  const pm25History = sorted.map((rec) =>
    parseNum(rec.indoor_pm25 ?? rec.pm25, 10.0, 0, 500, 1)
  );

  const co2History = sorted.map((rec) =>
    parseNum(rec.co2 ?? rec.indoor_co2, 500, 300, 3000, 0)
  );

  const powerHistory = sorted.map((rec) =>
    parseNum(rec.power ?? rec.fan_power_kw, 0.85, 0, 50, 2)
  );

  const filterHistory = sorted.map((rec) =>
    parseNum(rec.filter_health, 95.0, 0, 100, 1)
  );

  return {
    pm25History: pm25History.slice(-15),
    co2History: co2History.slice(-15),
    powerHistory: powerHistory.slice(-15),
    filterHistory: filterHistory.slice(-15),
  };
}
