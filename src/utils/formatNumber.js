/**
 * Safe numeric formatting.
 * -----------------------------------------------------------------------------
 * The BuildingTelemetry API publishes only a subset of the readings this
 * dashboard can display, so any metric may legitimately be absent. Calling
 * `.toFixed()` on such a value throws
 *
 *     TypeError: Cannot read properties of null (reading 'toFixed')
 *
 * and, because it happens during render, React unmounts the whole tree and the
 * page goes blank. Note that a default parameter (`fanSpeedPct = 28`) does NOT
 * protect against this: defaults apply to `undefined` only, so an explicit
 * `null` passes straight through.
 *
 * Rules:
 *   * zero is a real reading and is always formatted, never treated as missing;
 *   * numeric strings ("12.77") are accepted, since DynamoDB numbers can arrive
 *     as strings;
 *   * null, undefined, "", NaN, ±Infinity, booleans, arrays and objects are
 *     unavailable and render as "N/A" rather than as 0.
 */

export const NOT_AVAILABLE = 'N/A';

/**
 * Coerce a value to a finite number, or null when it cannot be one.
 * This is the single gate every formatter and numeric comparison goes through.
 */
export function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Number('') and Number('   ') are 0, which would invent a reading.
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Booleans coerce to 0/1 and arrays to their single element; neither is a
  // measurement, so both are rejected rather than silently converted.
  return null;
}

/** True when the value is a usable, finite number (zero included). */
export function isFiniteNumber(value) {
  return toFiniteNumber(value) !== null;
}

/**
 * Format a value for display.
 *
 * @param {*} value                 raw reading of any type
 * @param {object} [options]
 * @param {number} [options.digits] fixed decimal places; omit for locale grouping
 * @param {string} [options.prefix] e.g. '$'
 * @param {string} [options.suffix] e.g. '%' or ' kWh'
 * @param {string} [options.fallback] text for an unavailable value
 * @param {boolean} [options.affixFallback] also wrap the fallback in prefix/suffix
 */
export function formatNumber(value, options = {}) {
  const {
    digits = null,
    prefix = '',
    suffix = '',
    fallback = NOT_AVAILABLE,
    affixFallback = false,
  } = options;

  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return affixFallback ? `${prefix}${fallback}${suffix}` : fallback;
  }

  const body = digits === null ? parsed.toLocaleString() : parsed.toFixed(digits);
  return `${prefix}${body}${suffix}`;
}

/** Percentage, e.g. 12.77 -> "12.8%". */
export function formatPercent(value, digits = 1, options = {}) {
  return formatNumber(value, { digits, suffix: '%', ...options });
}

/** US dollars, e.g. 0.34 -> "$0.34". */
export function formatCurrency(value, digits = 2, options = {}) {
  return formatNumber(value, { digits, prefix: '$', ...options });
}

/**
 * A number safe to hand to layout or geometry maths that cannot accept null
 * (WebGL positions, CSS widths). This is for VISUALS ONLY — never use it for a
 * displayed reading, because it would show a substitute as if it were real.
 */
export function numberOr(value, fallback = 0) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? fallback : parsed;
}

/**
 * Compare a possibly-missing reading against a threshold.
 * Returns false when the value is unavailable, so a missing metric never
 * triggers a severity badge.
 */
export function atLeast(value, threshold) {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed >= threshold;
}

/** Inverse of `atLeast`; false when the value is unavailable. */
export function below(value, threshold) {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed < threshold;
}
