/**
 * API client: bearer attachment, 401/403 handling, error classification and
 * protection against stale responses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchZones, fetchLatestTelemetry, fetchTelemetryHistory, fetchAlerts, checkHealth,
  ApiError, __resetApiForTests,
} from './aeroSenseApi';
import { signIn, getCurrentSession, __resetAuthForTests } from './auth';
import { createFetchMock, jsonResponse, makeJwt, makeSessionPayload } from '../test/helpers';

let fetchMock;

async function authenticate(sessionOverrides = {}) {
  fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload(sessionOverrides) }));
  await signIn('operator', 'pw');
}

function authHeaderOf(call) {
  return call.options.headers?.Authorization || call.options.headers?.authorization;
}

beforeEach(() => {
  __resetAuthForTests();
  __resetApiForTests();
  fetchMock = createFetchMock();
  vi.stubGlobal('fetch', fetchMock);
});

describe('protected requests', () => {
  it('attaches the Cognito access token as a bearer credential', async () => {
    await authenticate();
    fetchMock.on('/zones', jsonResponse({ zones: [{ zone_id: 'zone-01', name: 'Main HVAC' }] }));

    const zones = await fetchZones();

    const call = fetchMock.callsTo('/zones')[0];
    expect(authHeaderOf(call)).toMatch(/^Bearer eyJ/);
    expect(zones).toEqual([expect.objectContaining({ zone_id: 'zone-01', name: 'Main HVAC' })]);
  });

  it('targets the configured absolute API base URL, never a relative path', async () => {
    await authenticate();
    fetchMock.on('/telemetry/latest', jsonResponse({ zone_id: 'zone-01', outdoor_aqi: 61 }));

    await fetchLatestTelemetry('zone-01');

    const call = fetchMock.callsTo('/telemetry/latest')[0];
    expect(call.url.startsWith('https://api.test.invalid/')).toBe(true);
    expect(call.url).not.toContain('//telemetry');
  });

  it('includes the required zone_id and limit query parameters', async () => {
    await authenticate();
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await fetchTelemetryHistory('zone-07', 20);
    await fetchAlerts('zone-07', 20);

    expect(fetchMock.callsTo('/telemetry/history')[0].url).toContain('zone_id=zone-07');
    expect(fetchMock.callsTo('/telemetry/history')[0].url).toContain('limit=20');
    expect(fetchMock.callsTo('/alerts')[0].url).toContain('zone_id=zone-07');
  });

  it('refuses to fetch telemetry without a zone id', async () => {
    await authenticate();
    await expect(fetchLatestTelemetry(undefined)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock.callsTo('/telemetry/latest')).toHaveLength(0);
  });

  it('fails as an auth error when no session exists', async () => {
    await expect(fetchZones()).rejects.toMatchObject({ kind: 'AUTH', status: 401 });
    expect(fetchMock.callsTo('/zones')).toHaveLength(0);
  });
});

describe('401 handling', () => {
  it('refreshes once and retries, then succeeds', async () => {
    await authenticate();
    const freshToken = makeJwt({ tokenUse: 'access' });
    let zoneHits = 0;

    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload({ accessToken: freshToken }) }));
    fetchMock.on('/zones', () => {
      zoneHits += 1;
      return zoneHits === 1
        ? jsonResponse({ message: 'Unauthorized' }, 401)
        : jsonResponse({ zones: [{ zone_id: 'zone-01' }] });
    });

    const zones = await fetchZones();

    expect(zones).toHaveLength(1);
    expect(fetchMock.callsTo('/auth/refresh')).toHaveLength(1);
    expect(authHeaderOf(fetchMock.callsTo('/zones')[1])).toBe(`Bearer ${freshToken}`);
  });

  it('clears the session and reports an auth failure when 401 persists', async () => {
    await authenticate();
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));
    fetchMock.on('/zones', jsonResponse({ message: 'Unauthorized' }, 401));

    await expect(fetchZones()).rejects.toMatchObject({ kind: 'AUTH', status: 401 });
    // The guard relies on this: no session means the login screen renders.
    expect(getCurrentSession()).toBeNull();
  });

  it('retries with the id token when the authorizer rejects the access token', async () => {
    const payload = makeSessionPayload();
    await authenticate(payload);

    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: payload }));
    fetchMock.on('/zones', (url, options) => {
      const header = options.headers?.Authorization || '';
      return header === `Bearer ${payload.idToken}`
        ? jsonResponse({ zones: [{ zone_id: 'zone-01' }] })
        : jsonResponse({ message: 'Unauthorized' }, 401);
    });

    await expect(fetchZones()).resolves.toHaveLength(1);
  });
});

describe('error classification', () => {
  beforeEach(async () => {
    await authenticate();
  });

  it('treats 403 as forbidden, not as an authentication failure', async () => {
    fetchMock.on('/zones', jsonResponse({ message: 'Forbidden' }, 403));

    const error = await fetchZones().catch((e) => e);
    expect(error.kind).toBe('FORBIDDEN');
    expect(error.isAuthFailure).toBe(false);
    // A 403 must not log the operator out.
    expect(getCurrentSession()).not.toBeNull();
    expect(fetchMock.callsTo('/auth/refresh')).toHaveLength(0);
  });

  it('classifies a network or CORS failure without inventing data', async () => {
    fetchMock.on('/zones', () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await fetchZones().catch((e) => e);
    expect(error.kind).toBe('NETWORK');
    expect(error.message).toMatch(/CORS/);
  });

  it('reports a missing endpoint as NOT_FOUND', async () => {
    fetchMock.on('/zones', jsonResponse({ message: 'Not Found' }, 404));
    await expect(fetchZones()).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('reports a server error rather than returning empty data', async () => {
    fetchMock.on('/zones', jsonResponse({ message: 'boom' }, 500));
    await expect(fetchZones()).rejects.toMatchObject({ kind: 'SERVER', status: 500 });
  });

  it('reports unparseable JSON instead of guessing', async () => {
    fetchMock.on('/zones', {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
      text: async () => 'not json',
    });
    await expect(fetchZones()).rejects.toMatchObject({ kind: 'PARSE' });
  });

  it('throws rather than inventing a reading when telemetry is empty', async () => {
    fetchMock.on('/telemetry/latest', jsonResponse({ items: [] }));
    await expect(fetchLatestTelemetry('zone-01')).rejects.toBeInstanceOf(ApiError);
  });

  it('propagates an abort so a stale response is discarded', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchZones({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('health check', () => {
  it('reports exactly what the public endpoint returned', async () => {
    fetchMock.on('/health', jsonResponse({ status: 'ok', service: 'AeroSense API' }));

    const health = await checkHealth();

    expect(health).toMatchObject({ status: 'ok', service: 'AeroSense API', healthy: true });
    // /health is public: it must not carry a credential.
    expect(authHeaderOf(fetchMock.callsTo('/health')[0])).toBeUndefined();
  });

  it('does not claim health when the probe fails', async () => {
    fetchMock.on('/health', jsonResponse({ message: 'down' }, 503));
    await expect(checkHealth()).rejects.toMatchObject({ kind: 'SERVER' });
  });
});
