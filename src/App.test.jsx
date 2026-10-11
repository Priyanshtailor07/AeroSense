/**
 * AWS Live integration: zone resolution, zone switching, stale-response
 * protection, and the guarantee that simulated values never reach AWS Live.
 *
 * The 3D scenes and the Leaflet map are replaced with probes so these tests
 * exercise data flow rather than WebGL.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFetchMock, jsonResponse, makeSessionPayload } from './test/helpers';
import { __resetAuthForTests } from './services/auth';
import { __resetApiForTests } from './services/aeroSenseApi';

/** Surfaces the telemetry App passes down, so assertions read real state. */
vi.mock('./components/AeroDashboard/AeroDashboard', () => ({
  default: (props) => (
    <div data-testid="dashboard">
      <span data-testid="aqi">{String(props.aqi)}</span>
      <span data-testid="pm25">{String(props.pm25)}</span>
      <span data-testid="co2">{String(props.co2)}</span>
      <span data-testid="zone">{String(props.selectedZone)}</span>
      <span data-testid="mode">{props.mode}</span>
      <span data-testid="stale">{String(props.isStale)}</span>
      <span data-testid="alerts">{(props.liveAlerts || []).length}</span>
      <span data-testid="pm25-history">{JSON.stringify(props.sparklines?.pm25History ?? [])}</span>
    </div>
  ),
}));
vi.mock('./components/HepaChamber/HepaChamber', () => ({ default: () => <div /> }));
vi.mock('./components/GlobalMap/GlobalAqiMap', () => ({ default: () => <div /> }));

const { AuthProvider } = await import('./context/AuthProvider');
const ProtectedRoute = (await import('./components/Auth/ProtectedRoute')).default;
const App = (await import('./App')).default;

let fetchMock;

/**
 * A record in the exact shape the deployed `AeroSense-API-Function` returns,
 * including `timestamp` as epoch SECONDS in a string and the real field names.
 */
function telemetry(zoneId, { aqi, pm25, co2, ts = 1791665633 }) {
  return {
    zone_id: zoneId,
    timestamp: String(ts),
    outdoor_aqi: aqi,
    indoor_pm25: pm25,
    outdoor_pm25: 192.43,
    co2,
    temperature: 26.3,
    humidity: 32,
    occupancy: 58,
    damper_pct: 12.77,
    recommended_damper_pct: 35,
    fan_power_kw: 2.34,
    current_fan_power_kw: 2.34,
    alerts: [],
    optimizer_status: 'recommendation_only',
    optimizer_reason: 'Elevated CO2: improve ventilation',
    source: 'simulator',
  };
}

/** `GET /telemetry/latest?zone_id=...` wraps the record as {"item": {...}}. */
function wrapItem(record) {
  return { item: record };
}

async function renderSignedIn() {
  sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
  fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));

  render(
    <AuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </AuthProvider>
  );
  // Anchor on the authenticated shell, not the dashboard: the loading, empty
  // and error states deliberately render in place of the dashboard.
  return screen.findByRole('button', { name: /sign out of aerosense/i });
}

beforeEach(() => {
  __resetAuthForTests();
  __resetApiForTests();
  fetchMock = createFetchMock();
  vi.stubGlobal('fetch', fetchMock);
  // Deterministic: no simulated jitter and no polling timer firing mid-assertion.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AWS Live startup', () => {
  it('loads the real zone list and telemetry for the first zone', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 2, zones: ['zone-01', 'zone-02'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();

    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('61'));
    expect(screen.getByTestId('mode')).toHaveTextContent('aws_live');
    expect(screen.getByTestId('zone')).toHaveTextContent('zone-01');
    expect(screen.getByTestId('pm25')).toHaveTextContent('12.4');
    expect(screen.getByTestId('co2')).toHaveTextContent('702');
  });

  it('holds the dashboard behind a loading state until telemetry arrives', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    let release;
    fetchMock.on('/telemetry/latest', () => new Promise((resolve) => {
      release = () => resolve(jsonResponse(wrapItem(telemetry('zone-01', { aqi: 44, pm25: 9, co2: 600 }))));
    }));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();

    expect(await screen.findByText(/loading aws telemetry/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.callsTo('/telemetry/latest').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('44'));
  });

  it('reports an empty zone list instead of inventing a zone', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 0, zones: [] }));

    await renderSignedIn();

    expect((await screen.findAllByText(/returned no zones/i)).length).toBeGreaterThan(0);
    expect(fetchMock.callsTo('/telemetry/latest')).toHaveLength(0);
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('surfaces an API failure as stale rather than falling back to simulation', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse({ message: 'kaboom' }, 500));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();

    expect(await screen.findByText(/no aws telemetry available/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/returned 500/i)).length).toBeGreaterThan(0);
    // No simulated values stood in for the failed fetch.
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});

describe('API 500 (the live incident)', () => {
  // GET /zones and /alerts returned 500 in production because the API Lambda
  // scanned the whole table and hit its 3s timeout. The dashboard must stay
  // usable and must never substitute simulated values.
  it('shows a recoverable error when /zones returns 500, without crashing', async () => {
    fetchMock.on('/zones', jsonResponse({ message: 'Internal Server Error' }, 500));

    await renderSignedIn();

    expect((await screen.findAllByText(/returned 500/i)).length).toBeGreaterThan(0);
    // The shell survives: navigation and sign-out are still present.
    expect(screen.getByRole('button', { name: /sign out of aerosense/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /global aqi map/i })).toBeInTheDocument();
    // No dashboard populated with invented readings.
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('keeps telemetry visible when only /alerts fails', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ zone_id: 'zone-01', items: [] }));
    fetchMock.on('/alerts', jsonResponse({ message: 'Internal Server Error' }, 500));

    await renderSignedIn();

    // A failing supplementary call must not discard the telemetry we have.
    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('61'));
    expect(screen.getByTestId('alerts')).toHaveTextContent('0');
  });

  it('offers a working retry that refetches', async () => {
    let attempts = 0;
    fetchMock.on('/zones', () => {
      attempts += 1;
      return attempts === 1
        ? jsonResponse({ message: 'Internal Server Error' }, 500)
        : jsonResponse({ count: 1, zones: ['zone-01'] });
    });
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ zone_id: 'zone-01', items: [] }));
    fetchMock.on('/alerts', jsonResponse({ count: 0, items: [] }));

    await renderSignedIn();
    await screen.findAllByText(/returned 500/i);

    await userEvent.setup().click(screen.getByRole('button', { name: /retry connection/i }));
    await waitFor(() => expect(attempts).toBeGreaterThan(1));
  });

  it('never falls back to simulated values on a 500', async () => {
    fetchMock.on('/zones', jsonResponse({ message: 'Internal Server Error' }, 500));
    await renderSignedIn();
    await screen.findAllByText(/returned 500/i);

    // Mode stays AWS Live; it does not silently become a simulation.
    expect(screen.queryByText(/local simulation mode/i)).not.toBeInTheDocument();
  });
});

describe('real zone identifiers', () => {
  it('uses the API zone id verbatim and invents no display name', async () => {
    // The deployed API returns exactly this: ids only, no human-readable names.
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ zone_id: 'zone-01', items: [] }));
    fetchMock.on('/alerts', jsonResponse({ count: 0, items: [] }));

    await renderSignedIn();
    await waitFor(() => expect(screen.getByTestId('zone')).toHaveTextContent('zone-01'));

    const option = screen.getByRole('option', { name: 'zone-01' });
    expect(option).toBeInTheDocument();
    expect(option.value).toBe('zone-01');

    // No fabricated building/room naming anywhere in the rendered output.
    expect(screen.queryByText(/Main HVAC|Main Facility|Zone 1\b|Zone-1/)).not.toBeInTheDocument();
  });

  it('disables the selector when the API returns a single zone', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ zone_id: 'zone-01', items: [] }));
    fetchMock.on('/alerts', jsonResponse({ count: 0, items: [] }));

    await renderSignedIn();
    await waitFor(() => expect(screen.getByTestId('zone')).toHaveTextContent('zone-01'));
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows an explicit empty state when a zone has no telemetry', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    // The telemetry Lambda answers 404 for a zone with no records.
    fetchMock.on('/telemetry/latest', jsonResponse({ error: 'No telemetry found for this zone' }, 404));
    fetchMock.on('/telemetry/history', jsonResponse({ zone_id: 'zone-01', items: [] }));
    fetchMock.on('/alerts', jsonResponse({ count: 0, items: [] }));

    await renderSignedIn();

    expect(await screen.findByText(/no aws telemetry available/i)).toBeInTheDocument();
    // An empty zone must not fall back to simulated readings.
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});

describe('zone selection', () => {
  it('refetches telemetry, history and alerts for the newly selected zone', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 2, zones: ['zone-01', 'zone-02'] }));
    fetchMock.on('/telemetry/latest', (url) =>
      jsonResponse(
        url.includes('zone-02')
          ? telemetry('zone-02', { aqi: 155, pm25: 58.2, co2: 1180 })
          : telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 })
      )
    );
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();
    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('61'));

    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'zone-02');

    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('155'));
    expect(screen.getByTestId('zone')).toHaveTextContent('zone-02');
    expect(screen.getByTestId('pm25')).toHaveTextContent('58.2');

    // Every protected request carried the zone it was for.
    const latestCalls = fetchMock.callsTo('/telemetry/latest');
    expect(latestCalls.some((c) => c.url.includes('zone_id=zone-02'))).toBe(true);
    expect(fetchMock.callsTo('/alerts').some((c) => c.url.includes('zone_id=zone-02'))).toBe(true);
    expect(fetchMock.callsTo('/telemetry/history').some((c) => c.url.includes('zone_id=zone-02'))).toBe(true);
  });

  it('never lets a slow response for the previous zone overwrite the new zone', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 2, zones: ['zone-01', 'zone-02'] }));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    // zone-01's response is held open until after the operator has moved to
    // zone-02, then delivered late — the classic clobbering race.
    let releaseZone01;
    fetchMock.on('/telemetry/latest', (url) => {
      if (url.includes('zone-02')) {
        return jsonResponse(wrapItem(telemetry('zone-02', { aqi: 155, pm25: 58.2, co2: 1180 })));
      }
      return new Promise((resolve) => {
        releaseZone01 = () =>
          resolve(jsonResponse(wrapItem(telemetry('zone-01', { aqi: 9, pm25: 1.1, co2: 320 }))));
      });
    });

    await renderSignedIn();
    await waitFor(() => expect(fetchMock.callsTo('zone_id=zone-01').length).toBeGreaterThan(0));

    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'zone-02');
    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('155'));

    // The late zone-01 payload arrives now and must be discarded.
    await act(async () => {
      releaseZone01?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('aqi')).toHaveTextContent('155');
    expect(screen.getByTestId('pm25')).toHaveTextContent('58.2');
    expect(screen.getByTestId('zone')).toHaveTextContent('zone-02');
  });
});

describe('AWS Live data integrity', () => {
  it('plots only real history, with no placeholder curve when history is empty', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();
    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('61'));

    expect(screen.getByTestId('pm25-history')).toHaveTextContent('[]');
  });

  it('uses the real history series when the API returns one', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    // Newest-first, as the DynamoDB query returns it, with epoch-second strings.
    fetchMock.on('/telemetry/history', jsonResponse({
      zone_id: 'zone-01',
      items: [
        { timestamp: '1791665693', indoor_pm25: 12.4, co2: 702, fan_power_kw: 0.85 },
        { timestamp: '1791665633', indoor_pm25: 11.1, co2: 690, fan_power_kw: 0.8 },
      ],
    }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();

    await waitFor(() => expect(screen.getByTestId('pm25-history')).toHaveTextContent('[11.1,12.4]'));
  });

  it('does not emit simulated readings while AWS Live is the active mode', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.on('/zones', jsonResponse({ count: 1, zones: ['zone-01'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', jsonResponse({ alerts: [] }));

    await renderSignedIn();
    await waitFor(() => expect(screen.getByTestId('aqi')).toHaveTextContent('61'));

    // Run well past the 2s simulation tick. The reading must not drift.
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByTestId('aqi')).toHaveTextContent('61');
    expect(screen.getByTestId('pm25')).toHaveTextContent('12.4');
  });

  it('shows alerts returned by the API and clears them on zone change', async () => {
    fetchMock.on('/zones', jsonResponse({ count: 2, zones: ['zone-01', 'zone-02'] }));
    fetchMock.on('/telemetry/latest', jsonResponse(wrapItem(telemetry('zone-01', { aqi: 61, pm25: 12.4, co2: 702 }))));
    fetchMock.on('/telemetry/history', jsonResponse({ items: [] }));
    fetchMock.on('/alerts', (url) =>
      jsonResponse({
        count: url.includes('zone-01') ? 1 : 0,
        items: url.includes('zone-01')
          ? [{ ...telemetry('zone-01', { aqi: 427, pm25: 25.65, co2: 1555 }), alerts: ['High indoor CO2: 1555 ppm'] }]
          : [],
      })
    );

    await renderSignedIn();
    await waitFor(() => expect(screen.getByTestId('alerts')).toHaveTextContent('1'));

    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'zone-02');
    await waitFor(() => expect(screen.getByTestId('alerts')).toHaveTextContent('0'));
  });
});
