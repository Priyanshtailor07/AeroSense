/**
 * Alert hierarchy.
 *
 * App owns the single primary active-hazard banner. This strip must stay quiet
 * and must never render a second flashing hazard banner or its own alarm state,
 * which is what previously produced two competing red banners.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AmbientAlertBar from './AmbientAlertBar';
import { getEnvironmentalTheme } from '../../utils/themeEngine';

/** Alerts in the shape the API client produces from GET /alerts. */
const ALERTS = [
  {
    id: 'zone-01-1791665513-0',
    zone_id: 'zone-01',
    message: 'High indoor CO2: 1555 ppm',
    severity: 'critical',
    timestampMs: 1791665513000,
    timestamp: '1791665513',
  },
  {
    id: 'zone-01-1791665453-0',
    zone_id: 'zone-01',
    message: 'High indoor PM2.5: 62.1',
    severity: 'warning',
    timestampMs: 1791665453000,
    timestamp: '1791665453',
  },
];

function renderBar(props = {}) {
  return render(
    <AmbientAlertBar
      theme={getEnvironmentalTheme(180, 40, 60)}
      aqi={180}
      humidity={40}
      pm25={60}
      mode="aws_live"
      selectedZone="zone-01"
      liveAlerts={[]}
      onOpenHepa={() => {}}
      {...props}
    />
  );
}

describe('no duplicate hazard banner', () => {
  it('does not render a flashing hazard banner even at hazardous readings', () => {
    const { container } = renderBar();
    // The strobe class belongs to App's single primary banner only.
    expect(container.querySelector('.alert-flash-banner')).toBeNull();
  });

  it('does not render a flashing banner when backend alerts are present', () => {
    const { container } = renderBar({ liveAlerts: ALERTS });
    expect(container.querySelector('.alert-flash-banner')).toBeNull();
  });

  it('offers no alarm mute control of its own', () => {
    renderBar({ liveAlerts: ALERTS });
    expect(screen.queryByRole('button', { name: /mute|alarm|stop alarm/i })).not.toBeInTheDocument();
  });
});

describe('secondary notifications', () => {
  it('lists each backend alert once, with its severity', () => {
    renderBar({ liveAlerts: ALERTS });
    expect(screen.getByText('High indoor CO2: 1555 ppm')).toBeInTheDocument();
    expect(screen.getByText('High indoor PM2.5: 62.1')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getAllByText(/High indoor CO2/)).toHaveLength(1);
  });

  it('shows the notification area only when there are alerts', () => {
    renderBar({ liveAlerts: [] });
    expect(screen.queryByText(/notifications from aws/i)).not.toBeInTheDocument();
  });

  it('omits a timestamp when the record carried none', () => {
    const { container } = renderBar({
      liveAlerts: [{ id: 'a', message: 'No timestamp alert', severity: 'info', timestampMs: null }],
    });
    expect(screen.getByText('No timestamp alert')).toBeInTheDocument();
    expect(container.querySelector('time')).toBeNull();
  });
});

describe('data provenance and honesty', () => {
  it('labels outdoor AQI separately from indoor PM2.5', () => {
    renderBar();
    expect(screen.getByText(/outdoor aqi/i)).toBeInTheDocument();
    expect(screen.getByText(/indoor pm2\.5/i)).toBeInTheDocument();
  });

  it('shows the live mode and zone', () => {
    renderBar();
    expect(screen.getByText(/AWS Live · zone-01/)).toBeInTheDocument();
  });

  it('labels simulation mode unmistakably', () => {
    renderBar({ mode: 'simulation' });
    expect(screen.getByText(/simulated/i)).toBeInTheDocument();
    expect(screen.queryByText(/AWS Live/)).not.toBeInTheDocument();
  });

  it('does not claim to actuate equipment', () => {
    renderBar({ liveAlerts: ALERTS });
    expect(screen.getByRole('button', { name: /open 3d hepa view/i })).toBeInTheDocument();
    expect(screen.queryByText(/engage/i)).not.toBeInTheDocument();
  });

  it('renders N/A rather than a substitute when a reading is missing', () => {
    renderBar({ aqi: null, pm25: null, humidity: null });
    expect(screen.getAllByText(/N\/A/).length).toBeGreaterThanOrEqual(3);
  });
});
