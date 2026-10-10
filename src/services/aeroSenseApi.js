/**
 * AeroSense API client
 * -----------------------------------------------------------------------------
 * Every request to the AeroSense backend goes through this module.
 *
 * Routes (all absolute against VITE_AEROSENSE_API_URL):
 *   GET /health                                          public
 *   GET /zones                                           protected
 *   GET /telemetry/latest?zone_id=...                    protected
 *   GET /telemetry/history?zone_id=...&limit=...         protected
 *   GET /alerts?zone_id=...&limit=...                    protected
 *
 * Behaviour that matters:
 *   * a missing base URL is a hard configuration error, never a relative path.
 *     Relative paths were previously resolved against the Amplify origin, which
 *     the SPA rewrite answered with index.html — the source of the spurious
 *     redirects and 404s.
 *   * 401 triggers exactly one recovery attempt (refresh the session, and retry
 *     with the other Cognito token kind in case the API Gateway authorizer is
 *     configured for id tokens). A second 401 clears the session.
 *   * 403 is an authorization failure, not an authentication failure, and never
 *     logs the user out.
 *   * nothing here ever invents a reading. A failed call throws.
 */

import { getBearerToken, refreshSession, clearLocalSession, markSessionVerified, getAuthConfig } from './auth';
import { parseTelemetryTimestamp } from '../utils/telemetryMapper';

/* ---------------------------------------------------------------- errors --- */

export class ApiError extends Error {
  constructor(message, { kind = 'SERVER', status = 0, url = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    /** One of CONFIG | NETWORK | TIMEOUT | AUTH | FORBIDDEN | NOT_FOUND | SERVER | PARSE */
    this.kind = kind;
    this.status = status;
    this.url = url;
  }

  /** True when the user must re-authenticate. */
  get isAuthFailure() {
    return this.kind === 'AUTH';
  }
}

/* ---------------------------------------------------------------- config --- */

export function getApiBaseUrl() {
  return getAuthConfig().apiBaseUrl;
}

function requireBaseUrl() {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      'The AeroSense API URL is not configured (VITE_AEROSENSE_API_URL).',
      { kind: 'CONFIG' }
    );
  }
  return baseUrl;
}

/**
 * Build an absolute URL with query parameters, dropping empty values so no
 * request ever carries `zone_id=undefined`.
 */
function buildUrl(path, params = {}) {
  const baseUrl = requireBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/* -------------------------------------------------------------- transport -- */

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Which Cognito token kind the API Gateway authorizer actually accepts. Starts
 * at the configured preference and is corrected once by observation, so a
 * misconfigured VITE_COGNITO_TOKEN_TYPE costs one retry rather than a lockout.
 */
let acceptedTokenKind = null;

/** Test seam. */
export function __resetApiForTests() {
  acceptedTokenKind = null;
}

function otherKind(kind) {
  return kind === 'id' ? 'access' : 'id';
}

async function rawRequest(url, { token, signal, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new ApiError('timeout', { kind: 'TIMEOUT' })), timeoutMs);

  try {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return await fetch(url, { method: 'GET', headers, signal: controller.signal });
  } catch (err) {
    // A caller-initiated abort must propagate so stale responses are discarded.
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) {
      throw new ApiError(`The request to ${url} timed out.`, { kind: 'TIMEOUT', url });
    }
    // fetch() rejects identically for DNS failures, offline, and CORS denials;
    // the browser console holds the distinguishing detail.
    throw new ApiError(
      'Could not reach the AeroSense API. This is a network, CORS or DNS failure — no data was received.',
      { kind: 'NETWORK', url }
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

async function readError(response) {
  try {
    const data = await response.json();
    return data?.message || data?.error || JSON.stringify(data);
  } catch {
    return await response.text().catch(() => '');
  }
}

async function parseJson(response, url) {
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      `The response from ${url} was not valid JSON.`,
      { kind: 'PARSE', status: response.status, url }
    );
  }
}

/**
 * Perform a protected GET. Attaches a verified bearer token, recovers once from
 * a 401, and marks the session server-verified on success.
 */
async function protectedGet(path, params = {}, { signal } = {}) {
  const url = buildUrl(path, params);
  const preferredKind = acceptedTokenKind || getAuthConfig().tokenType;

  let token = await getBearerToken(preferredKind);
  if (!token) {
    throw new ApiError('You are not signed in.', { kind: 'AUTH', status: 401, url });
  }

  let response = await rawRequest(url, { token, signal });

  if (response.status === 401) {
    // Attempt 2: the token may simply be stale, or the authorizer may want the
    // other token kind. Try both once, then give up and force re-authentication.
    const refreshed = await refreshSession();
    const retryKinds = refreshed ? [preferredKind, otherKind(preferredKind)] : [otherKind(preferredKind)];
    let recovered = false;

    for (const kind of retryKinds) {
      const retryToken = await getBearerToken(kind);
      if (!retryToken || retryToken === token) continue;
      response = await rawRequest(url, { token: retryToken, signal });
      if (response.status !== 401) {
        acceptedTokenKind = kind;
        recovered = true;
        break;
      }
      token = retryToken;
    }

    if (!recovered && response.status === 401) {
      clearLocalSession();
      throw new ApiError(
        'Your session is no longer valid. Please sign in again.',
        { kind: 'AUTH', status: 401, url }
      );
    }
  }

  if (response.status === 403) {
    // Distinct from authentication: the token is good, the grant is not.
    throw new ApiError(
      `Access denied for ${path}. Your account is authenticated but not permitted to read this resource.`,
      { kind: 'FORBIDDEN', status: 403, url }
    );
  }

  if (response.status === 404) {
    // The telemetry Lambda also returns 404 for "no data for this zone", which
    // is an empty result rather than a missing route.
    const detail = await readError(response);
    const isEmptyZone = /no telemetry found/i.test(detail || '');
    throw new ApiError(
      isEmptyZone
        ? `The API has no telemetry recorded for this zone yet.`
        : `The endpoint ${path} is not deployed on the configured API.`,
      { kind: isEmptyZone ? 'EMPTY' : 'NOT_FOUND', status: 404, url }
    );
  }

  if (!response.ok) {
    const detail = await readError(response);
    throw new ApiError(
      `The AeroSense API returned ${response.status}${detail ? `: ${detail}` : ''}.`,
      { kind: 'SERVER', status: response.status, url }
    );
  }

  const data = await parseJson(response, url);
  // The authorizer accepted this token, which is what makes the session's
  // "verified" state meaningful rather than a local boolean.
  markSessionVerified();
  return data;
}

/* ------------------------------------------------------------ normalizers -- */

function normalizeZone(zone, index) {
  if (typeof zone === 'string') {
    return { zone_id: zone, name: zone, raw: zone };
  }
  const id = zone.zone_id ?? zone.id ?? zone.zoneId ?? `zone-${String(index + 1).padStart(2, '0')}`;
  return {
    zone_id: String(id),
    name: String(zone.name ?? zone.zone_name ?? zone.zoneName ?? id),
    raw: zone,
  };
}

/**
 * Accept the shapes the Lambda may use for a collection — a bare array or a
 * wrapper keyed by name/`items`/`data` — without inventing entries. An
 * unrecognised shape yields an empty list, which the UI surfaces as empty.
 */
function toList(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of [...keys, 'items', 'data', 'Items']) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

/**
 * `GET /alerts` does not return alert objects. It returns whole telemetry
 * records that have a non-empty `alerts` array of strings, e.g.
 *
 *   { "zone_id": "zone-01", "timestamp": "1791665513",
 *     "alerts": ["High indoor CO2: 1555 ppm"], "co2": 1555, ... }
 *
 * So each record is flattened into one entry per alert string, carrying the
 * record's zone and timestamp. Severity is inferred from the text because the
 * API does not supply one.
 */
function inferSeverity(message) {
  const text = message.toLowerCase();
  if (text.includes('severe') || text.includes('critical') || text.includes('hazard')) return 'critical';
  if (text.includes('high') || text.includes('elevated')) return 'warning';
  return 'info';
}

function flattenAlertRecords(records) {
  const out = [];

  records.forEach((record, recordIndex) => {
    if (!record || typeof record !== 'object') return;

    const zoneId = record.zone_id ?? null;
    const rawTimestamp = record.timestamp ?? null;
    const timestampMs = parseTelemetryTimestamp(rawTimestamp);
    const messages = Array.isArray(record.alerts)
      ? record.alerts.filter((a) => typeof a === 'string' && a.trim() !== '')
      : [];

    messages.forEach((message, messageIndex) => {
      out.push({
        // Stable within a response: zone + timestamp + position.
        id: `${zoneId ?? 'zone'}-${rawTimestamp ?? recordIndex}-${messageIndex}`,
        zone_id: zoneId,
        message: message.trim(),
        severity: inferSeverity(message),
        timestampMs,
        timestamp: rawTimestamp,
        // The optimizer's own explanation for the same record, when present.
        reason: typeof record.optimizer_reason === 'string' ? record.optimizer_reason : null,
        raw: record,
      });
    });
  });

  // Newest first.
  return out.sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
}

/* ------------------------------------------------------------ public API --- */

/** Public health probe. Reports exactly what the service returned. */
export async function checkHealth({ signal } = {}) {
  const url = buildUrl('/health');
  const response = await rawRequest(url, { token: null, signal });
  if (!response.ok) {
    const detail = await readError(response);
    throw new ApiError(
      `Health check failed with ${response.status}${detail ? `: ${detail}` : ''}.`,
      { kind: 'SERVER', status: response.status, url }
    );
  }
  const data = await parseJson(response, url);
  return {
    status: data?.status ?? null,
    service: data?.service ?? null,
    healthy: data?.status === 'ok' || data?.status === 'healthy',
    raw: data,
  };
}

export async function fetchZones({ signal } = {}) {
  const data = await protectedGet('/zones', {}, { signal });
  const list = toList(data, 'zones');
  if (list.length === 0 && data && typeof data === 'object' && (data.zone_id || data.id)) {
    return [normalizeZone(data, 0)];
  }
  return list.map(normalizeZone);
}

export async function fetchLatestTelemetry(zoneId, { signal } = {}) {
  if (!zoneId) throw new ApiError('A zone_id is required to fetch telemetry.', { kind: 'CONFIG' });
  const data = await protectedGet('/telemetry/latest', { zone_id: zoneId }, { signal });

  // Unwrap a single-record envelope if the Lambda uses one.
  let record = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.item && typeof data.item === 'object') record = data.item;
    else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) record = data.data;
    else if (Array.isArray(data.items)) record = data.items[0];
  } else if (Array.isArray(data)) {
    record = data[0];
  }

  if (!record || typeof record !== 'object') {
    throw new ApiError(
      `No telemetry is available for ${zoneId}.`,
      { kind: 'SERVER', status: 200, url: buildUrl('/telemetry/latest', { zone_id: zoneId }) }
    );
  }
  return record;
}

/** The API rejects a limit outside 1..100 with a 400, so clamp before sending. */
function clampLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

export async function fetchTelemetryHistory(zoneId, limit = 20, { signal } = {}) {
  if (!zoneId) throw new ApiError('A zone_id is required to fetch history.', { kind: 'CONFIG' });
  const data = await protectedGet('/telemetry/history', { zone_id: zoneId, limit: clampLimit(limit) }, { signal });
  return toList(data, 'history', 'telemetry').filter((r) => r && typeof r === 'object');
}

export async function fetchAlerts(zoneId, limit = 20, { signal } = {}) {
  const data = await protectedGet('/alerts', { zone_id: zoneId, limit: clampLimit(limit) }, { signal });
  return flattenAlertRecords(toList(data, 'alerts'));
}
