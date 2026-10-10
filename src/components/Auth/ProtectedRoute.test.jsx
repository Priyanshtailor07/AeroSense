/**
 * Route guard: what an unauthenticated visitor can and cannot reach.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthProvider';
import ProtectedRoute from './ProtectedRoute';
import { __resetAuthForTests } from '../../services/auth';
import { createFetchMock, jsonResponse, makeSessionPayload } from '../../test/helpers';

const DASHBOARD = 'PROTECTED-DASHBOARD-CONTENT';

let fetchMock;

/** Stands in for the dashboard and records whether it was ever mounted. */
let mountCount = 0;
function FakeDashboard() {
  React.useEffect(() => {
    mountCount += 1;
  }, []);
  return <div>{DASHBOARD}</div>;
}

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button type="button" onClick={logout}>
      do-logout
    </button>
  );
}

function renderGuarded(extra = null) {
  return render(
    <AuthProvider>
      <ProtectedRoute>
        <>
          <FakeDashboard />
          {extra}
        </>
      </ProtectedRoute>
    </AuthProvider>
  );
}

beforeEach(() => {
  __resetAuthForTests();
  mountCount = 0;
  fetchMock = createFetchMock();
  vi.stubGlobal('fetch', fetchMock);
});

describe('first-time unauthenticated visitor', () => {
  it('sees the login screen and never the dashboard', async () => {
    renderGuarded();

    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
    // Not merely hidden: never mounted, so no 3D scene or polling started.
    expect(mountCount).toBe(0);
  });

  it('issues no protected API request before authenticating', async () => {
    renderGuarded();
    await screen.findByRole('button', { name: /^sign in$/i });

    expect(fetchMock.callsTo('/zones')).toHaveLength(0);
    expect(fetchMock.callsTo('/telemetry')).toHaveLength(0);
  });
});

describe('invalid credentials', () => {
  it('keeps the dashboard closed and shows the reason', async () => {
    fetchMock.on('/auth/signin', jsonResponse(
      { ok: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' },
      401
    ));
    renderGuarded();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username or email/i), 'operator');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect username or password/i);
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
    expect(mountCount).toBe(0);
  });

  it('does not open the dashboard in a demo mode when auth fails outright', async () => {
    fetchMock.on('/auth/signin', () => {
      throw new TypeError('Failed to fetch');
    });
    renderGuarded();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username or email/i), 'operator');
    await user.type(screen.getByLabelText(/^password$/i), 'pw');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
  });
});

describe('valid credentials', () => {
  it('opens the dashboard', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    renderGuarded();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username or email/i), 'operator');
    await user.type(screen.getByLabelText(/^password$/i), 'Passw0rd!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(DASHBOARD)).toBeInTheDocument();
    expect(mountCount).toBe(1);
  });

  it('holds the dashboard shut while Cognito raises a challenge', async () => {
    fetchMock.on('/auth/signin', jsonResponse({
      ok: true,
      challenge: { challengeName: 'NEW_PASSWORD_REQUIRED', session: 'sess', username: 'operator' },
    }));
    renderGuarded();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username or email/i), 'operator');
    await user.type(screen.getByLabelText(/^password$/i), 'Temp1234!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/additional verification required/i)).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
  });
});

describe('page refresh', () => {
  it('restores a valid session and reopens the dashboard', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));

    renderGuarded();

    expect(await screen.findByText(DASHBOARD)).toBeInTheDocument();
  });

  it('shows the branded loading screen while the session is verified', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
    let release;
    fetchMock.on('/auth/refresh', () => new Promise((resolve) => {
      release = () => resolve(jsonResponse({ ok: true, session: makeSessionPayload() }));
    }));

    renderGuarded();

    expect(await screen.findByText(/verifying secure session/i)).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();

    release();
    expect(await screen.findByText(DASHBOARD)).toBeInTheDocument();
  });

  it('returns to login when the stored session is expired or revoked', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'stale', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: false, code: 'REFRESH_FAILED', message: 'expired' }, 401));

    renderGuarded();

    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
    expect(mountCount).toBe(0);
    // The unusable token is cleared so a reload cannot retry it forever.
    expect(sessionStorage.getItem('aerosense_refresh')).toBeNull();
  });
});

describe('logout', () => {
  it('clears state, returns to login, and unmounts the dashboard', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));
    fetchMock.on('/auth/signout', jsonResponse({ ok: true, revoked: { refreshToken: true } }));

    renderGuarded(<LogoutButton />);
    await screen.findByText(DASHBOARD);

    await userEvent.setup().click(screen.getByRole('button', { name: 'do-logout' }));

    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('aerosense_refresh')).toBeNull();
    expect(fetchMock.callsTo('/auth/signout')).toHaveLength(1);
  });

  it('blocks a back-navigation restore from revealing the dashboard', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));
    fetchMock.on('/auth/signout', jsonResponse({ ok: true, revoked: { refreshToken: true } }));

    renderGuarded(<LogoutButton />);
    await screen.findByText(DASHBOARD);
    await userEvent.setup().click(screen.getByRole('button', { name: 'do-logout' }));
    await screen.findByRole('button', { name: /^sign in$/i });

    // A bfcache restore re-runs validation rather than trusting the old tree.
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    await waitFor(() => {
      expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });
});

describe('misconfiguration', () => {
  it('never opens the dashboard when the session is simply absent', async () => {
    renderGuarded();
    await screen.findByRole('button', { name: /^sign in$/i });
    // No local flag of any kind can substitute for a session.
    localStorage.setItem('aerosense_authenticated', 'true');
    sessionStorage.setItem('authenticated', 'true');
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
  });
});
