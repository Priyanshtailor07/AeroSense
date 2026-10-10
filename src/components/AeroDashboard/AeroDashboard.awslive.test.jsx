/**
 * Integration cover for the production crash: the real AeroDashboard rendered
 * with the exact prop shape App supplies in AWS Live, where every metric the
 * BuildingTelemetry API does not publish is null.
 *
 * Only the WebGL twin is mocked (jsdom has no WebGL context); every other
 * child — metric cards, telemetry audit, benchmark — is the real component.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./HvacDigitalTwin3D', () => ({ default: () => <div data-testid="twin" /> }));

const AeroDashboard = (await import('./AeroDashboard')).default;
const { getEnvironmentalTheme } = await import('../../utils/themeEngine');

/** Exactly what App passes after a live /telemetry/latest for zone-01. */
function awsLiveProps(overrides = {}) {
  return {
    theme: getEnvironmentalTheme(122, 32, 47.2),
    aqi: 122,
    setAqi: () => {},
    humidity: 32,
    setHumidity: () => {},
    co2: 1298,
    setCo2: () => {},
    pm25: 47.2,
    setPm25: () => {},
    temp: 26.3,
    setTemp: () => {},
    damperPct: 12.77,
    setDamperPct: () => {},
    recommendedDamperPct: 35,
    // Not published by the API:
    fanSpeedPct: null,
    setFanSpeedPct: () => {},
    fanPowerKw: 2.34,
    filterHealthPct: null,
    currentDpPa: null,
    cumulativeEnergyKwh: null,
    cumulativeCostUsd: null,
    rationale: 'Elevated CO2: improve ventilation',
    recommendationOnly: true,
    sparklines: { pm25History: [], co2History: [], powerHistory: [], filterHistory: [], aqiHistory: [] },
    liveAlerts: [],
    outdoorPm25: 192.43,
    unavailableMetrics: ['fanSpeedPct', 'filterHealthPct', 'currentDpPa', 'cumulativeEnergyKwh', 'cumulativeCostUsd'],
    mode: 'aws_live',
    selectedZone: 'zone-01',
    isApiLoading: false,
    isStale: false,
    hasLiveData: true,
    lastUpdated: '02:37:53',
    onRetry: () => {},
    isLiveStreaming: false,
    setIsLiveStreaming: () => {},
    onReset: () => {},
    onOpenHepa: () => {},
    isDarkMode: false,
    ...overrides,
  };
}

describe('AeroDashboard in AWS Live', () => {
  it('renders the full dashboard with null unpublished metrics', () => {
    expect(() => render(<AeroDashboard {...awsLiveProps()} />)).not.toThrow();
    // The page is populated, not blank.
    expect(screen.getByTestId('twin')).toBeInTheDocument();
  });

  it('shows the published readings and N/A for the rest', () => {
    render(<AeroDashboard {...awsLiveProps()} />);
    expect(screen.getByText('12.8%')).toBeInTheDocument();   // damper, published
    expect(screen.getByText('35.0%')).toBeInTheDocument();   // recommendation, published
    expect(screen.getAllByText(/N\/A/).length).toBeGreaterThan(0);
  });

  it('does not render an error boundary fallback', () => {
    render(<AeroDashboard {...awsLiveProps()} />);
    expect(screen.queryByText(/could not be displayed/i)).not.toBeInTheDocument();
  });

  it('survives a record where every numeric field is malformed', () => {
    const broken = {
      aqi: null, pm25: undefined, co2: NaN, temp: 'abc', humidity: Infinity,
      damperPct: {}, recommendedDamperPct: [], fanPowerKw: true,
      fanSpeedPct: null, filterHealthPct: null, currentDpPa: null,
      cumulativeEnergyKwh: null, cumulativeCostUsd: null,
    };
    expect(() => render(<AeroDashboard {...awsLiveProps(broken)} />)).not.toThrow();
  });

  it('treats zero readings as real', () => {
    render(<AeroDashboard {...awsLiveProps({ damperPct: 0, fanPowerKw: 0 })} />);
    expect(screen.getAllByText('0.0%').length).toBeGreaterThan(0);
  });
});
