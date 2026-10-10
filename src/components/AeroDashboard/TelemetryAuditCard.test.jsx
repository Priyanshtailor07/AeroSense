/**
 * The component that threw in production.
 *
 * In AWS Live the API publishes no fan speed, filter health, pressure drop or
 * cumulative energy/cost, so App passes null. These tests render with exactly
 * that shape, which is what the original code could not survive.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TelemetryAuditCard from './TelemetryAuditCard';
import ErrorBoundary from '../ErrorBoundary';

/** The real AWS Live prop shape: published values present, the rest null. */
const AWS_LIVE_PROPS = {
  damperPct: 12.77,
  recommendedDamperPct: 35,
  fanSpeedPct: null,
  cumulativeCostUsd: null,
  cumulativeEnergyKwh: null,
  rationale: 'Elevated CO2: improve ventilation',
  mode: 'aws_live',
  recommendationOnly: true,
  selectedZone: 'zone-01',
};

describe('AWS Live rendering', () => {
  it('renders without throwing when unpublished metrics are null', () => {
    expect(() => render(<TelemetryAuditCard {...AWS_LIVE_PROPS} />)).not.toThrow();
  });

  it('shows N/A for metrics the API does not publish', () => {
    render(<TelemetryAuditCard {...AWS_LIVE_PROPS} />);
    // Fan speed, cost and energy are all unavailable.
    expect(screen.getAllByText(/N\/A/).length).toBeGreaterThanOrEqual(3);
  });

  it('still shows the readings the API does publish', () => {
    render(<TelemetryAuditCard {...AWS_LIVE_PROPS} />);
    expect(screen.getByText('12.8%')).toBeInTheDocument();
    expect(screen.getByText('35.0%')).toBeInTheDocument();
  });

  it('does not claim a fan operating mode when fan speed is unavailable', () => {
    render(<TelemetryAuditCard {...AWS_LIVE_PROPS} />);
    expect(screen.getByText(/NOT PUBLISHED BY API/i)).toBeInTheDocument();
    expect(screen.queryByText(/MAX SCRUBBING/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ECO MODE/i)).not.toBeInTheDocument();
  });

  it('survives every malformed shape for every numeric prop', () => {
    for (const bad of [null, undefined, NaN, Infinity, 'abc', '', {}, [], true]) {
      expect(() =>
        render(
          <TelemetryAuditCard
            {...AWS_LIVE_PROPS}
            damperPct={bad}
            recommendedDamperPct={bad}
            fanSpeedPct={bad}
            cumulativeCostUsd={bad}
            cumulativeEnergyKwh={bad}
          />
        ),
        `value ${String(bad)} must not crash the card`
      ).not.toThrow();
    }
  });

  it('accepts numeric strings', () => {
    render(<TelemetryAuditCard {...AWS_LIVE_PROPS} fanSpeedPct="47.5" />);
    expect(screen.getByText('47.5%')).toBeInTheDocument();
  });

  it('treats zero as a real reading, not a missing one', () => {
    render(
      <TelemetryAuditCard
        {...AWS_LIVE_PROPS}
        damperPct={0}
        fanSpeedPct={0}
        cumulativeCostUsd={0}
        cumulativeEnergyKwh={0}
      />
    );
    expect(screen.getAllByText('0.0%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText(/Energy: 0\.00 kWh/)).toBeInTheDocument();
  });
});

describe('error containment', () => {
  it('keeps sibling content alive when a child throws', () => {
    const Boom = () => {
      throw new Error('synthetic render failure');
    };

    render(
      <div>
        <span>sibling-content</span>
        <ErrorBoundary label="The telemetry audit panel">
          <Boom />
        </ErrorBoundary>
      </div>
    );

    expect(screen.getByText('sibling-content')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be displayed/i);
    // The failure is surfaced, not silently swallowed.
    expect(screen.getByText(/synthetic render failure/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
