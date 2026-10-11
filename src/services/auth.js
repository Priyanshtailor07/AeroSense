/**
 * AeroSense authentication service
 * -----------------------------------------------------------------------------
 * The Cognito app client for this deployment is a *confidential* client: it has
 * a client secret, so Cognito requires a SECRET_HASH on InitiateAuth and
 * friends. That secret cannot live in a browser bundle, so this module never
 * talks to cognito-idp directly. Every credential operation goes to the
 * AeroSense auth Lambda (POST {API}/auth/*), which holds the secret in Secrets
 * Manager and computes SECRET_HASH server-side.
 *
 * Token handling
 *   * access + id tokens live in module memory only — they are never written to
 *     localStorage, so they cannot be read back by a later page load or by any
 *     script that runs after a logout.
 *   * the refresh token lives in sessionStorage, which is what lets a page
 *     refresh restore the session while still clearing when the tab closes.
 *     Exchanging it requires the Lambda (only it knows the client secret).
 *   * a session is only ever reported as authenticated after a token has been
 *     parsed and its issuer, audience and expiry checked. A stored string on
 *     its own never counts as proof of authentication.
 */

const REFRESH_STORAGE_KEY = 'aerosense_refresh';
const listeners = new Set();

/** Skew applied to expiry checks so a token is renewed before it dies. */
const EXPIRY_SKEW_MS = 120_000;

/* --------------------------------------------------------------- config --- */

export function getAuthConfig() {
  const region = (import.meta.env.VITE_AWS_REGION || 'ap-south-1').trim();
  const userPoolId = (import.meta.env.VITE_COGNITO_USER_POOL_ID || '').trim();
  const clientId = (import.meta.env.VITE_COGNITO_CLIENT_ID || '').trim();
  const apiBaseUrl = (import.meta.env.VITE_AEROSENSE_API_URL || '').trim().replace(/\/+$/, '');
  const tokenType = (import.meta.env.VITE_COGNITO_TOKEN_TYPE || 'access').trim().toLowerCase();

  // Registration policy. This mirrors ALLOW_SELF_SIGNUP on the auth Lambda,
  // which is the real gate: the browser flag only decides whether to offer the
  // form, and a disabled backend still answers SIGNUP_DISABLED.
  const allowSelfSignup = String(import.meta.env.VITE_ALLOW_SELF_SIGNUP ?? 'true').trim() !== 'false';

  return {
    region,
    userPoolId,
    clientId,
    apiBaseUrl,
    tokenType: tokenType === 'id' ? 'id' : 'access',
    allowSelfSignup,
    issuer: userPoolId ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}` : '',
  };
}

/**
 * The Cognito password policy for this pool, used to tell the user the rules
 * before they submit rather than after Cognito rejects the password.
 */
export const PASSWORD_POLICY = Object.freeze({
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
});

/** Check a candidate password against the pool policy. */
export function checkPassword(password) {
  const value = typeof password === 'string' ? password : '';
  const rules = [
    { id: 'length', label: `At least ${PASSWORD_POLICY.minLength} characters`, met: value.length >= PASSWORD_POLICY.minLength },
    { id: 'upper', label: 'An uppercase letter', met: /[A-Z]/.test(value) },
    { id: 'lower', label: 'A lowercase letter', met: /[a-z]/.test(value) },
    { id: 'number', label: 'A number', met: /[0-9]/.test(value) },
    { id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(value) },
  ];
  return { rules, valid: rules.every((r) => r.met) };
}

/** Pragmatic email check; Cognito performs the authoritative validation. */
export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Mask an email for display: "operator@example.com" -> "op\u2022\u2022\u2022\u2022or@example.com". */
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || ''}\u2022\u2022\u2022@${domain}`;
  if (local.length <= 4) return `${local[0]}\u2022\u2022\u2022${local.slice(-1)}@${domain}`;
  return `${local.slice(0, 2)}\u2022\u2022\u2022\u2022${local.slice(-2)}@${domain}`;
}

/**
 * Report configuration that would make authentication impossible, so the UI can
 * say so plainly instead of failing with a confusing network error.
 */
export function getConfigError() {
  const { apiBaseUrl, userPoolId, clientId } = getAuthConfig();
  const missing = [];
  if (!apiBaseUrl) missing.push('VITE_AEROSENSE_API_URL');
  if (!userPoolId) missing.push('VITE_COGNITO_USER_POOL_ID');
  if (!clientId) missing.push('VITE_COGNITO_CLIENT_ID');
  if (missing.length === 0) return null;
  return `AeroSense is not configured. Missing build-time variables: ${missing.join(', ')}.`;
}

/* ---------------------------------------------------------------- errors --- */

export class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR', status = 0, extra = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

/* -------------------------------------------------------------- jwt utils -- */

/** Decode a JWT payload without verifying it. Signature checks are the API Gateway authorizer's job. */
export function decodeJwt(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    // Handle any multi-byte characters in claims such as `name`.
    const decoded = decodeURIComponent(
      Array.from(json, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    );
    const payload = JSON.parse(decoded);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Validate a token's claims against the configured pool. This is a correctness
 * guard against pointing the app at the wrong pool or replaying a foreign
 * token — not a security boundary, since it does not verify the signature.
 */
export function inspectToken(token, { expectedUse = null } = {}) {
  const claims = decodeJwt(token);
  if (!claims) return { valid: false, reason: 'MALFORMED', claims: null, expiresAt: 0 };

  const { issuer, clientId } = getAuthConfig();
  const expiresAt = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;

  if (issuer && claims.iss && claims.iss !== issuer) {
    return { valid: false, reason: 'ISSUER_MISMATCH', claims, expiresAt };
  }

  // Access tokens carry `client_id`; id tokens carry `aud`. Either must match
  // the app client this build is configured for.
  const audience = claims.aud || claims.client_id;
  const audiences = Array.isArray(audience) ? audience : [audience].filter(Boolean);
  if (clientId && audiences.length > 0 && !audiences.includes(clientId)) {
    return { valid: false, reason: 'AUDIENCE_MISMATCH', claims, expiresAt };
  }

  if (expectedUse && claims.token_use && claims.token_use !== expectedUse) {
    return { valid: false, reason: 'TOKEN_USE_MISMATCH', claims, expiresAt };
  }

  if (!expiresAt || Date.now() >= expiresAt) {
    return { valid: false, reason: 'EXPIRED', claims, expiresAt };
  }

  return { valid: true, reason: null, claims, expiresAt };
}

/* ----------------------------------------------------------- memory state -- */

/**
 * In-memory session. Deliberately not persisted: a reload rebuilds it from the
 * refresh token via the Lambda, which re-proves the session against Cognito.
 */
let current = null;

function readStoredRefresh() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(REFRESH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.refreshToken !== 'string' || typeof parsed.username !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredRefresh(session) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (session?.refreshToken && session?.username) {
      sessionStorage.setItem(
        REFRESH_STORAGE_KEY,
        JSON.stringify({
          refreshToken: session.refreshToken,
          username: session.username,
          displayName: session.displayName || session.username,
        })
      );
    } else {
      sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The session
    // still works for this page view; it just will not survive a reload.
  }
}

function clearStoredRefresh() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Public view of the session. Never exposes the refresh token. */
function publicSession(session) {
  if (!session) return null;
  return {
    /** The pool's internal username (a UUID for this alias pool). */
    username: session.username,
    /** What to show a human: their email. */
    displayName: session.displayName || session.username,
    expiresAt: session.expiresAt,
    tokenType: session.tokenType,
    claims: session.claims || null,
    verifiedAt: session.verifiedAt || null,
  };
}

function notify() {
  const snapshot = publicSession(current);
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // a broken subscriber must not break the others
    }
  });
}

export function onAuthStateChanged(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Does a restorable refresh token exist? Not proof of authentication. */
export function hasRestorableSession() {
  return Boolean(readStoredRefresh());
}

export function getCurrentSession() {
  return publicSession(current);
}

/**
 * Record that a protected API call was accepted by the API Gateway authorizer.
 * This is what makes the "Authenticated Session Active" indicator meaningful:
 * it reflects a server-verified session rather than a local flag.
 */
export function markSessionVerified() {
  if (!current) return;
  current.verifiedAt = Date.now();
  notify();
}

/* ------------------------------------------------------------ transport --- */

async function postAuth(action, payload, { signal } = {}) {
  const configError = getConfigError();
  if (configError) throw new AuthError(configError, 'CONFIG_ERROR');

  const { apiBaseUrl } = getAuthConfig();
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new AuthError(
      'Could not reach the AeroSense authentication service. Check your connection and try again.',
      'NETWORK_ERROR'
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 404) {
    throw new AuthError(
      `The authentication endpoint /auth/${action} is not deployed on the configured API.`,
      'ENDPOINT_MISSING',
      404
    );
  }

  if (!response.ok || !data || data.ok !== true) {
    throw new AuthError(
      data?.message || `Authentication failed (HTTP ${response.status}).`,
      data?.code || 'AUTH_ERROR',
      response.status,
      { challenge: data?.challenge || null }
    );
  }

  return data;
}

/**
 * Accept a token set from the Lambda, validate it, and install it as current.
 * Rejects anything whose claims do not check out, so a malformed or foreign
 * token can never be mistaken for a working session.
 */
function adoptSession(raw) {
  if (!raw || typeof raw.accessToken !== 'string') {
    throw new AuthError('The authentication service returned no usable tokens.', 'NO_TOKENS');
  }

  const inspection = inspectToken(raw.accessToken, { expectedUse: 'access' });
  if (!inspection.valid) {
    throw new AuthError(
      `The authentication service returned a token that failed validation (${inspection.reason}).`,
      'TOKEN_INVALID'
    );
  }

  const { tokenType } = getAuthConfig();
  // The internal username is what REFRESH_TOKEN_AUTH's SECRET_HASH is computed
  // over, so it is the one that must be stored and replayed on refresh — not
  // the email the user typed.
  const internalUsername =
    inspection.claims?.username || inspection.claims?.['cognito:username'] || raw.username || 'operator';
  current = {
    username: internalUsername,
    displayName: raw.displayName || internalUsername,
    accessToken: raw.accessToken,
    idToken: typeof raw.idToken === 'string' ? raw.idToken : null,
    refreshToken: typeof raw.refreshToken === 'string' ? raw.refreshToken : current?.refreshToken || null,
    tokenType,
    // Trust the token's own exp over any server-reported expiry.
    expiresAt: inspection.expiresAt,
    claims: inspection.claims,
    verifiedAt: null,
  };

  writeStoredRefresh(current);
  notify();
  return publicSession(current);
}

/* ---------------------------------------------------------------- actions -- */

export async function signIn(username, password, { signal } = {}) {
  if (!username || !password) {
    throw new AuthError('Enter both a username and a password.', 'INVALID_INPUT');
  }

  const data = await postAuth('signin', { username, password }, { signal });

  // Cognito can demand a challenge instead of issuing tokens. Surface it so the
  // UI can prompt; crucially, do not report success.
  if (data.challenge) {
    return { status: 'challenge', challenge: data.challenge };
  }

  return { status: 'authenticated', session: adoptSession(data.session) };
}

export async function respondToChallenge(payload, { signal } = {}) {
  const data = await postAuth('respond-challenge', payload, { signal });
  if (data.challenge) {
    return { status: 'challenge', challenge: data.challenge };
  }
  return { status: 'authenticated', session: adoptSession(data.session) };
}

/**
 * Exchange the stored refresh token for fresh tokens. Concurrent callers share
 * a single in-flight request so a burst of 401s cannot stampede the Lambda.
 */
let refreshInFlight = null;

export function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  const stored = current?.refreshToken
    ? {
        refreshToken: current.refreshToken,
        username: current.username,
        displayName: current.displayName,
      }
    : readStoredRefresh();

  if (!stored) {
    return Promise.resolve(null);
  }

  refreshInFlight = (async () => {
    try {
      const data = await postAuth('refresh', {
        username: stored.username,
        refreshToken: stored.refreshToken,
      });
      return adoptSession({
        ...data.session,
        username: stored.username,
        displayName: data.session?.displayName || stored.displayName,
      });
    } catch (err) {
      // A refresh token that Cognito rejects is unrecoverable: drop everything
      // and let the guard send the user back to login.
      if (err?.name !== 'AbortError') {
        clearLocalSession();
      }
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Return a valid session, restoring from the refresh token and renewing a
 * near-expiry token as needed. Returns null when no valid session exists.
 */
export async function getSession() {
  if (!current) {
    // Nothing in memory: this is either a fresh load or a post-logout state.
    return readStoredRefresh() ? await refreshSession() : null;
  }

  if (!current.expiresAt || Date.now() >= current.expiresAt - EXPIRY_SKEW_MS) {
    return await refreshSession();
  }

  return publicSession(current);
}

/**
 * The bearer token for protected API calls, or null when unauthenticated.
 * `preferred` lets the API client retry with the other token kind if the
 * API Gateway authorizer turns out to be configured for id tokens.
 */
export async function getBearerToken(preferred = null) {
  const session = await getSession();
  if (!session || !current) return null;

  const kind = preferred || current.tokenType || 'access';
  if (kind === 'id' && current.idToken) return current.idToken;
  return current.accessToken;
}

/** Drop all client-side authentication state without contacting the network. */
export function clearLocalSession() {
  current = null;
  clearStoredRefresh();
  notify();
}

/**
 * Sign out. Asks the Lambda to revoke the refresh token and globally sign the
 * user out of the pool, then clears local state regardless of the outcome — a
 * failed revocation must never leave the user stuck in a signed-in UI.
 */
export async function signOut() {
  const refreshToken = current?.refreshToken || readStoredRefresh()?.refreshToken || null;
  const accessToken = current?.accessToken || null;

  // Clear locally first so the UI can never keep showing protected content.
  clearLocalSession();

  if (!refreshToken && !accessToken) return { revoked: false };

  try {
    const data = await postAuth('signout', { refreshToken, accessToken });
    return { revoked: Boolean(data?.revoked?.refreshToken || data?.revoked?.global) };
  } catch {
    // Best effort: the local session is already gone.
    return { revoked: false };
  }
}

export async function forgotPassword(username) {
  const data = await postAuth('forgot-password', { username });
  return data.message || 'If an account exists for that username, a reset code has been sent.';
}

export async function confirmForgotPassword(username, code, newPassword) {
  const data = await postAuth('confirm-forgot-password', { username, code, newPassword });
  return data.message || 'Password updated. You can now sign in.';
}

/**
 * Confirm an account with the emailed code. On success the account is usable,
 * but the user is NOT signed in: confirmation is not authentication.
 */
export async function confirmSignUp(username, code) {
  const data = await postAuth('confirm-signup', { username, code });
  return {
    status: 'CONFIRMED',
    message: data.message || 'Account confirmed. You can now sign in.',
  };
}

export async function resendConfirmationCode(username) {
  const data = await postAuth('resend-confirmation', { username });
  return data.message || 'A new confirmation code has been sent.';
}

/**
 * Register a new account.
 *
 * Returns an explicit status so the UI never has to infer one:
 *   PENDING_CONFIRMATION - created, awaiting the emailed code
 *   CONFIRMED            - created and already usable (auto-confirmed pool)
 *
 * Neither status means the user is authenticated. A sign-in must still happen.
 */
export async function signUp(username, password, email) {
  const data = await postAuth('signup', { username, password, email });
  const userConfirmed = Boolean(data.userConfirmed);
  return {
    status: userConfirmed ? 'CONFIRMED' : 'PENDING_CONFIRMATION',
    userConfirmed,
    message: data.message,
  };
}

/** Test seam: reset all module state between tests. */
export function __resetAuthForTests() {
  current = null;
  refreshInFlight = null;
  listeners.clear();
  clearStoredRefresh();
}
