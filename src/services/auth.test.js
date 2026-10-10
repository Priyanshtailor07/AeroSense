/**
 * Auth service: token validation, session restoration, refresh and sign-out.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  signIn, signOut, getSession, getBearerToken, refreshSession, inspectToken,
  hasRestorableSession, getCurrentSession, markSessionVerified, onAuthStateChanged,
  clearLocalSession, __resetAuthForTests,
} from './auth';
import { createFetchMock, jsonResponse, makeJwt, makeSessionPayload } from '../test/helpers';

let fetchMock;

beforeEach(() => {
  __resetAuthForTests();
  fetchMock = createFetchMock();
  vi.stubGlobal('fetch', fetchMock);
});

describe('token inspection', () => {
  it('accepts a well-formed access token for the configured pool', () => {
    const result = inspectToken(makeJwt({ tokenUse: 'access' }), { expectedUse: 'access' });
    expect(result.valid).toBe(true);
  });

  it('rejects an expired token', () => {
    const result = inspectToken(makeJwt({ expiresInSeconds: -60 }));
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  it('rejects a token minted by a different user pool', () => {
    const foreign = makeJwt({ issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OTHER' });
    expect(inspectToken(foreign).reason).toBe('ISSUER_MISMATCH');
  });

  it('rejects a token issued to a different app client', () => {
    expect(inspectToken(makeJwt({ clientId: 'someotherclientid' })).reason).toBe('AUDIENCE_MISMATCH');
  });

  it('rejects a malformed token string', () => {
    expect(inspectToken('not-a-jwt').reason).toBe('MALFORMED');
    expect(inspectToken(null).valid).toBe(false);
  });
});

describe('sign-in', () => {
  it('posts credentials to the auth Lambda, never to cognito-idp directly', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));

    await signIn('operator', 'Passw0rd!');

    expect(fetchMock.callsTo('cognito-idp')).toHaveLength(0);
    const call = fetchMock.callsTo('/auth/signin')[0];
    expect(call.url).toBe('https://api.test.invalid/auth/signin');
    expect(call.options.method).toBe('POST');
  });

  it('never transmits or stores a client secret', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    await signIn('operator', 'Passw0rd!');

    const bodies = fetchMock.calls.map((c) => String(c.options.body || '')).join('|');
    expect(bodies.toLowerCase()).not.toContain('secret');
    const stored = JSON.stringify(sessionStorage) + JSON.stringify(localStorage);
    expect(stored.toLowerCase()).not.toContain('secret');
  });

  it('reports a verified session only after tokens validate', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    const result = await signIn('operator', 'Passw0rd!');
    expect(result.status).toBe('authenticated');
    expect(result.session.username).toBe('operator');
  });

  it('surfaces invalid credentials as an error and leaves no session', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' }, 401));

    await expect(signIn('operator', 'wrong')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(getCurrentSession()).toBeNull();
    expect(await getBearerToken()).toBeNull();
  });

  it('refuses a token that fails validation instead of reporting success', async () => {
    fetchMock.on('/auth/signin', jsonResponse({
      ok: true,
      session: makeSessionPayload({ accessToken: makeJwt({ expiresInSeconds: -10 }) }),
    }));

    await expect(signIn('operator', 'Passw0rd!')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(getCurrentSession()).toBeNull();
  });

  it('returns a challenge without authenticating', async () => {
    fetchMock.on('/auth/signin', jsonResponse({
      ok: true,
      challenge: { challengeName: 'NEW_PASSWORD_REQUIRED', session: 'sess-1', username: 'operator' },
    }));

    const result = await signIn('operator', 'Temp1234!');
    expect(result.status).toBe('challenge');
    expect(getCurrentSession()).toBeNull();
    expect(await getBearerToken()).toBeNull();
  });

  it('reports a missing /auth/signin deployment distinctly', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ message: 'Not Found' }, 404));
    await expect(signIn('operator', 'pw')).rejects.toMatchObject({ code: 'ENDPOINT_MISSING' });
  });

  it('reports a network failure without fabricating a session', async () => {
    fetchMock.on('/auth/signin', () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(signIn('operator', 'pw')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(getCurrentSession()).toBeNull();
  });
});

describe('alias-pool username handling', () => {
  it('stores the internal username for refresh, not the email alias', async () => {
    // This pool has UsernameAttributes:[email], so sign-in uses an email while
    // the real username is a UUID. REFRESH_TOKEN_AUTH computes SECRET_HASH over
    // the internal username, so replaying the email makes every refresh fail.
    const internal = '21036dba-c061-70c2-21e6-dc53fbd84b2d';
    fetchMock.on('/auth/signin', jsonResponse({
      ok: true,
      session: makeSessionPayload({
        username: internal,
        displayName: 'operator@example.com',
        accessToken: makeJwt({ tokenUse: 'access', username: internal }),
      }),
    }));

    await signIn('operator@example.com', 'pw');

    const stored = JSON.parse(sessionStorage.getItem('aerosense_refresh'));
    expect(stored.username).toBe(internal);
    expect(stored.username).not.toContain('@');

    fetchMock.on('/auth/refresh', jsonResponse({
      ok: true,
      session: makeSessionPayload({ username: internal, accessToken: makeJwt({ tokenUse: 'access', username: internal }) }),
    }));
    await refreshSession();

    const body = JSON.parse(fetchMock.callsTo('/auth/refresh')[0].options.body);
    expect(body.username).toBe(internal);
  });

  it('shows the email to the user while keeping the internal id for refresh', async () => {
    const internal = '21036dba-c061-70c2-21e6-dc53fbd84b2d';
    fetchMock.on('/auth/signin', jsonResponse({
      ok: true,
      session: makeSessionPayload({
        username: internal,
        displayName: 'operator@example.com',
        accessToken: makeJwt({ tokenUse: 'access', username: internal }),
      }),
    }));

    const result = await signIn('operator@example.com', 'pw');

    expect(result.session.displayName).toBe('operator@example.com');
    expect(result.session.username).toBe(internal);
  });
});

describe('session restoration', () => {
  it('does not treat a stored token string as proof of authentication', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'stale', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: false, code: 'REFRESH_FAILED', message: 'expired' }, 401));

    expect(hasRestorableSession()).toBe(true);
    expect(await getSession()).toBeNull();
    // The unusable token is discarded so it cannot be retried forever.
    expect(hasRestorableSession()).toBe(false);
  });

  it('restores a session by exchanging the stored refresh token', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));

    const restored = await getSession();
    expect(restored).not.toBeNull();
    expect(restored.username).toBe('operator');
  });

  it('renews a near-expiry token before use', async () => {
    fetchMock.on('/auth/signin', jsonResponse({
      ok: true,
      session: makeSessionPayload({ accessToken: makeJwt({ expiresInSeconds: 30 }) }),
    }));
    await signIn('operator', 'pw');

    const renewed = makeJwt({ expiresInSeconds: 3600 });
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload({ accessToken: renewed }) }));

    expect(await getBearerToken()).toBe(renewed);
  });

  it('coalesces concurrent refreshes into one request', async () => {
    sessionStorage.setItem('aerosense_refresh', JSON.stringify({ refreshToken: 'good', username: 'operator' }));
    fetchMock.on('/auth/refresh', jsonResponse({ ok: true, session: makeSessionPayload() }));

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock.callsTo('/auth/refresh')).toHaveLength(1);
  });

  it('keeps access tokens out of localStorage entirely', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    await signIn('operator', 'pw');

    const token = await getBearerToken();
    expect(token).toBeTruthy();
    expect(JSON.stringify(localStorage)).not.toContain(token);
    expect(JSON.stringify(sessionStorage)).not.toContain(token);
  });
});

describe('sign-out', () => {
  beforeEach(async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    await signIn('operator', 'pw');
  });

  it('revokes server-side and clears all local state', async () => {
    fetchMock.on('/auth/signout', jsonResponse({ ok: true, revoked: { refreshToken: true, global: true } }));

    await signOut();

    expect(fetchMock.callsTo('/auth/signout')).toHaveLength(1);
    expect(getCurrentSession()).toBeNull();
    expect(hasRestorableSession()).toBe(false);
    expect(await getBearerToken()).toBeNull();
  });

  it('still clears local state when revocation fails', async () => {
    fetchMock.on('/auth/signout', jsonResponse({ ok: false, message: 'boom' }, 500));

    await signOut();

    expect(getCurrentSession()).toBeNull();
    expect(await getBearerToken()).toBeNull();
  });

  it('notifies subscribers so the UI can drop to the login screen', async () => {
    const seen = [];
    onAuthStateChanged((s) => seen.push(s));
    clearLocalSession();
    expect(seen.at(-1)).toBeNull();
  });
});

describe('verified-session flag', () => {
  it('is unset until a protected call succeeds', async () => {
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    await signIn('operator', 'pw');

    expect(getCurrentSession().verifiedAt).toBeNull();
    markSessionVerified();
    expect(getCurrentSession().verifiedAt).toBeGreaterThan(0);
  });
});
