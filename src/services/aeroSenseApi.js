/**
 * AeroSense API Service
 * Handles HTTP requests to the AeroSense AWS API Gateway backend
 * Endpoint routes:
 *  - GET /health
 *  - GET /zones
 *  - GET /telemetry/latest?zone_id=...
 *  - GET /telemetry/history?zone_id=...&limit=50
 *  - GET /alerts?zone_id=...&limit=20
 */

import { getAccessToken } from './auth';

/**
 * Get configured API URL from env or fallback
 */
export function getApiBaseUrl(overrideUrl = null) {
  if (overrideUrl && typeof overrideUrl === 'string' && overrideUrl.trim() !== '') {
    return overrideUrl.trim().replace(/\/+$/, '');
  }
  const envUrl = import.meta.env.VITE_AEROSENSE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

/**
 * Build request headers including optional Cognito Bearer Access Token
 */
async function buildHeaders(customToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const token = customToken || await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Internal validated fetch helper
 */
async function fetchWithValidation(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(`Network Error connecting to AeroSense backend (${err.message || 'Connection Refused'})`);
  }

  if (!response.ok) {
    let errorText = '';
    try {
      const errJson = await response.json();
      errorText = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      errorText = await response.text().catch(() => '');
    }

    if (response.status === 401) {
      throw new Error(`Authentication Required (401): ${errorText || 'Invalid or expired Cognito token'}`);
    }
    if (response.status === 403) {
      throw new Error(`Access Forbidden (403): ${errorText || 'Insufficient permissions'}`);
    }
    if (response.status === 404) {
      throw new Error(`Resource Not Found (404): ${errorText || url}`);
    }
    throw new Error(`API Error [${response.status}]: ${errorText || response.statusText || 'Server error'}`);
  }

  try {
    const data = await response.json();
    return data;
  } catch (err) {
    throw new Error(`Invalid JSON payload received from endpoint: ${err.message}`);
  }
}

/**
 * Response Validation Helpers
 */
function validateHealthResponse(data) {
  if (data && typeof data === 'object') {
    return {
      status: data.status || data.health || 'healthy',
      timestamp: data.timestamp || new Date().toISOString(),
      raw: data,
    };
  }
  return { status: 'healthy', timestamp: new Date().toISOString() };
}

function validateZonesResponse(data) {
  if (Array.isArray(data)) {
    return data.map((z, idx) => normalizeZone(z, idx));
  }
  if (data && Array.isArray(data.zones)) {
    return data.zones.map((z, idx) => normalizeZone(z, idx));
  }
  if (data && Array.isArray(data.items)) {
    return data.items.map((z, idx) => normalizeZone(z, idx));
  }
  // Single object fallback
  if (data && typeof data === 'object' && (data.zone_id || data.id)) {
    return [normalizeZone(data, 0)];
  }
  return [];
}

function normalizeZone(z, index) {
  if (typeof z === 'string') {
    return { zone_id: z, name: `Zone ${z}`, description: `Building Zone ${z}` };
  }
  const id = z.zone_id || z.id || z.zoneId || `zone-${index + 1}`;
  const name = z.name || z.zone_name || z.zoneName || `Zone ${id}`;
  return {
    zone_id: String(id),
    name: String(name),
    building: z.building || 'Main Facility',
    floor: z.floor || 1,
    description: z.description || `Zone ${id} HVAC system`,
    raw: z,
  };
}

function validateTelemetryRecord(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Telemetry response is empty or invalid object');
  }
  // Support nested payload wrapper e.g. { data: {...} } or { item: {...} }
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data;
  }
  if (data.item && typeof data.item === 'object') {
    return data.item;
  }
  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items[0];
  }
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  return data;
}

function validateHistoryResponse(data) {
  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && Array.isArray(data.history)) {
    list = data.history;
  } else if (data && Array.isArray(data.items)) {
    list = data.items;
  } else if (data && Array.isArray(data.telemetry)) {
    list = data.telemetry;
  } else if (data && Array.isArray(data.data)) {
    list = data.data;
  }

  return list.filter((item) => item && typeof item === 'object');
}

function validateAlertsResponse(data) {
  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && Array.isArray(data.alerts)) {
    list = data.alerts;
  } else if (data && Array.isArray(data.items)) {
    list = data.items;
  } else if (data && Array.isArray(data.data)) {
    list = data.data;
  }

  return list.map((a, idx) => ({
    id: a.id || a.alert_id || `alert-${idx}`,
    zone_id: a.zone_id || a.zoneId || 'all',
    type: a.type || a.severity || 'warning',
    message: a.message || a.title || 'Telemetry anomaly detected',
    timestamp: a.timestamp || a.created_at || new Date().toISOString(),
    raw: a,
  }));
}

/**
 * Public API Methods
 */

export async function checkHealth(customApiUrl = null) {
  const baseUrl = getApiBaseUrl(customApiUrl);
  if (!baseUrl) throw new Error('API Base URL is not configured (VITE_AEROSENSE_API_URL)');
  
  const headers = await buildHeaders();
  const raw = await fetchWithValidation(`${baseUrl}/health`, { method: 'GET', headers });
  return validateHealthResponse(raw);
}

export async function fetchZones(customApiUrl = null, customToken = null) {
  const baseUrl = getApiBaseUrl(customApiUrl);
  if (!baseUrl) throw new Error('API Base URL is not configured (VITE_AEROSENSE_API_URL)');
  
  const headers = await buildHeaders(customToken);
  const raw = await fetchWithValidation(`${baseUrl}/zones`, { method: 'GET', headers });
  return validateZonesResponse(raw);
}

export async function fetchLatestTelemetry(zoneId, customApiUrl = null, customToken = null) {
  const baseUrl = getApiBaseUrl(customApiUrl);
  if (!baseUrl) throw new Error('API Base URL is not configured (VITE_AEROSENSE_API_URL)');
  if (!zoneId) throw new Error('zone_id parameter is required');

  const headers = await buildHeaders(customToken);
  const url = `${baseUrl}/telemetry/latest?zone_id=${encodeURIComponent(zoneId)}`;
  const raw = await fetchWithValidation(url, { method: 'GET', headers });
  return validateTelemetryRecord(raw);
}

export async function fetchTelemetryHistory(zoneId, limit = 50, customApiUrl = null, customToken = null) {
  const baseUrl = getApiBaseUrl(customApiUrl);
  if (!baseUrl) throw new Error('API Base URL is not configured (VITE_AEROSENSE_API_URL)');
  if (!zoneId) throw new Error('zone_id parameter is required');

  const headers = await buildHeaders(customToken);
  const url = `${baseUrl}/telemetry/history?zone_id=${encodeURIComponent(zoneId)}&limit=${limit}`;
  const raw = await fetchWithValidation(url, { method: 'GET', headers });
  return validateHistoryResponse(raw);
}

export async function fetchAlerts(zoneId = null, limit = 20, customApiUrl = null, customToken = null) {
  const baseUrl = getApiBaseUrl(customApiUrl);
  if (!baseUrl) throw new Error('API Base URL is not configured (VITE_AEROSENSE_API_URL)');

  const headers = await buildHeaders(customToken);
  let url = `${baseUrl}/alerts?limit=${limit}`;
  if (zoneId) {
    url += `&zone_id=${encodeURIComponent(zoneId)}`;
  }
  const raw = await fetchWithValidation(url, { method: 'GET', headers });
  return validateAlertsResponse(raw);
}
