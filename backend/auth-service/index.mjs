/**
 * AeroSense Cognito Auth Lambda
 * -----------------------------------------------------------------------------
 * Purpose
 *   The AeroSense Cognito app client is a *confidential* client (it has a client
 *   secret). Cognito therefore rejects InitiateAuth / ForgotPassword / SignUp etc.
 *   unless the caller supplies
 *
 *       SECRET_HASH = Base64( HMAC-SHA256( key = clientSecret,
 *                                          msg = username + clientId ) )
 *
 *   That secret must never reach a browser, so this Lambda sits in front of
 *   Cognito: it loads the secret from Secrets Manager, computes SECRET_HASH
 *   server-side, and returns only the resulting tokens to the SPA.
 *
 * Contract
 *   POST /auth/signin                  { username, password }
 *   POST /auth/refresh                 { username, refreshToken }
 *   POST /auth/signout                 { refreshToken }
 *   POST /auth/respond-challenge       { challengeName, session, username, ... }
 *   POST /auth/forgot-password         { username }
 *   POST /auth/confirm-forgot-password { username, code, newPassword }
 *   POST /auth/confirm-signup          { username, code }
 *   POST /auth/resend-confirmation     { username }
 *   POST /auth/signup                  { username, password, email }   (if enabled)
 *
 * Every response is { ok: boolean, ... }. Failures carry a stable machine
 * `code` plus a human `message` that never leaks secrets or account existence.
 */

import { createHmac } from 'node:crypto';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
  GlobalSignOutCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
const SECRET_ID = process.env.COGNITO_CLIENT_SECRET_ID || '';
/** Literal secret via env is supported only for local `sam local` runs. */
const SECRET_INLINE = process.env.COGNITO_CLIENT_SECRET || '';
const SIGNUP_ENABLED = String(process.env.ALLOW_SELF_SIGNUP || 'false') === 'true';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const secrets = new SecretsManagerClient({ region: REGION });

/* ---------------------------------------------------------------- secrets -- */

let cachedSecret = null;

/**
 * Resolve the Cognito client secret. Cached in module scope so a warm
 * container performs at most one Secrets Manager call.
 */
async function getClientSecret() {
  if (cachedSecret) return cachedSecret;
  if (SECRET_INLINE) {
    cachedSecret = SECRET_INLINE;
    return cachedSecret;
  }
  if (!SECRET_ID) {
    throw httpError(500, 'CONFIG_ERROR', 'Auth service is not configured.');
  }

  const res = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const raw = res.SecretString || '';

  // Accept either a bare string secret or a JSON blob holding it.
  let value = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      value = parsed.clientSecret || parsed.client_secret || parsed.COGNITO_CLIENT_SECRET || '';
    }
  } catch {
    // raw was not JSON; treat it as the secret itself
  }

  if (!value) {
    throw httpError(500, 'CONFIG_ERROR', 'Auth service is not configured.');
  }
  cachedSecret = value;
  return cachedSecret;
}

/**
 * SECRET_HASH as defined by Cognito: HMAC-SHA256 over (username + clientId)
 * keyed with the client secret, Base64 encoded.
 */
function secretHash(username, clientSecret) {
  return createHmac('sha256', clientSecret).update(`${username}${CLIENT_ID}`).digest('base64');
}

/* ------------------------------------------------------------------- http -- */

function httpError(status, code, message, extra = {}) {
  const err = new Error(message);
  err.statusCode = status;
  err.code = code;
  err.extra = extra;
  return err;
}

function corsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const normalized = (origin || '').replace(/\/+$/, '');
  if (normalized && ALLOWED_ORIGINS.includes(normalized)) {
    headers['Access-Control-Allow-Origin'] = normalized;
    headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'content-type';
    headers['Access-Control-Max-Age'] = '300';
  }
  return headers;
}

function reply(status, body, origin) {
  return { statusCode: status, headers: corsHeaders(origin), body: JSON.stringify(body) };
}

/* --------------------------------------------------------- rate limiting -- */

/**
 * Best-effort per-identity throttle. This is per-container state, so it is a
 * speed bump rather than a guarantee — Cognito's own throttling and (if
 * configured) an API Gateway usage plan / WAF rule are the real controls.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateBuckets = new Map();

function enforceRateLimit(key) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    throw httpError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a minute and try again.');
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  if (rateBuckets.size > 5000) rateBuckets.clear();
}

/* --------------------------------------------------------- input helpers -- */

function requireString(body, field, { max = 512, min = 1 } = {}) {
  const value = body?.[field];
  if (typeof value !== 'string' || value.trim().length < min) {
    throw httpError(400, 'INVALID_INPUT', `Missing or invalid field: ${field}`);
  }
  if (value.length > max) {
    throw httpError(400, 'INVALID_INPUT', `Field too long: ${field}`);
  }
  return value.trim();
}

/**
 * Usernames are echoed into SECRET_HASH, so keep them to a sane charset. This
 * must accept both an email alias (sign-in) and the pool's internal UUID
 * username (refresh).
 */
function requireUsername(body) {
  const username = requireString(body, 'username', { max: 256 });
  if (!/^[\w.@+\-]+$/.test(username)) {
    throw httpError(400, 'INVALID_INPUT', 'Username contains unsupported characters.');
  }
  return username;
}

/** Passwords are passed through verbatim and never trimmed or logged. */
function requirePassword(body, field = 'password') {
  const value = body?.[field];
  if (typeof value !== 'string' || value.length < 1) {
    throw httpError(400, 'INVALID_INPUT', `Missing or invalid field: ${field}`);
  }
  if (value.length > 256) {
    throw httpError(400, 'INVALID_INPUT', `Field too long: ${field}`);
  }
  return value;
}

/* -------------------------------------------------------- token shaping --- */

/**
 * Read a JWT's claims. No signature check: these tokens come straight from
 * Cognito over TLS in the same request, so this is parsing, not verification.
 */
function decodeClaims(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Shape an AuthenticationResult for the browser. `expiresAt` is absolute so the
 * SPA never has to trust its own clock drift against a relative ExpiresIn.
 *
 * `username` is deliberately the pool's INTERNAL username taken from the token
 * claims, not whatever the caller typed. This pool has `UsernameAttributes:
 * [email]`, so users sign in with an email alias while the real username is a
 * UUID. REFRESH_TOKEN_AUTH computes SECRET_HASH over the internal username, so
 * echoing the email back here would make every refresh fail with
 * NotAuthorizedException. `displayName` carries the email for the UI.
 */
function shapeTokens(authResult, suppliedUsername) {
  const expiresIn = Number(authResult.ExpiresIn) || 3600;
  const accessClaims = decodeClaims(authResult.AccessToken) || {};
  const idClaims = decodeClaims(authResult.IdToken) || {};

  const internalUsername =
    accessClaims.username || idClaims['cognito:username'] || suppliedUsername;
  const displayName =
    idClaims.email || (suppliedUsername.includes('@') ? suppliedUsername : internalUsername);

  return {
    username: internalUsername,
    displayName,
    accessToken: authResult.AccessToken,
    idToken: authResult.IdToken,
    refreshToken: authResult.RefreshToken || null,
    tokenType: authResult.TokenType || 'Bearer',
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Translate a Cognito SDK exception into a safe client-facing error.
 * Credential-related failures are deliberately collapsed so the response
 * cannot be used to enumerate accounts.
 */
function mapCognitoError(err) {
  const name = err?.name || err?.__type || '';
  switch (name) {
    case 'NotAuthorizedException': {
      // The SECRET_HASH misconfiguration surfaces under this same name; keep it
      // distinguishable in logs (server-side) but opaque to the client.
      if (/SECRET_HASH/i.test(err?.message || '')) {
        return httpError(500, 'CONFIG_ERROR', 'Auth service is misconfigured.');
      }
      return httpError(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.');
    }
    case 'UserNotFoundException':
      return httpError(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.');
    case 'UserNotConfirmedException':
      return httpError(403, 'USER_NOT_CONFIRMED', 'This account is not confirmed. Check your email for a verification code.');
    case 'PasswordResetRequiredException':
      return httpError(403, 'PASSWORD_RESET_REQUIRED', 'A password reset is required before you can sign in.');
    case 'CodeMismatchException':
      return httpError(400, 'CODE_MISMATCH', 'That verification code is not correct.');
    case 'ExpiredCodeException':
      return httpError(400, 'CODE_EXPIRED', 'That verification code has expired. Request a new one.');
    case 'InvalidPasswordException':
      return httpError(400, 'INVALID_PASSWORD', err?.message || 'Password does not meet the pool policy.');
    case 'UsernameExistsException':
      return httpError(409, 'USERNAME_EXISTS', 'An account with that username already exists.');
    case 'TooManyRequestsException':
    case 'LimitExceededException':
    case 'TooManyFailedAttemptsException':
      return httpError(429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.');
    case 'InvalidParameterException':
      return httpError(400, 'INVALID_INPUT', err?.message || 'Invalid request parameters.');
    case 'UserLambdaValidationException':
      return httpError(400, 'VALIDATION_FAILED', 'The directory rejected this request.');
    default:
      return httpError(502, 'UPSTREAM_ERROR', 'The identity provider could not complete this request.');
  }
}

async function callCognito(command) {
  try {
    return await cognito.send(command);
  } catch (err) {
    // Log the real provider error for operators; never return it verbatim.
    console.error('cognito_error', { name: err?.name, message: err?.message });
    throw mapCognitoError(err);
  }
}

/* ----------------------------------------------------------------- routes -- */

async function handleSignin(body, hash) {
  const username = requireUsername(body);
  const password = requirePassword(body);

  const res = await callCognito(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: hash(username),
      },
    })
  );

  // Cognito may demand a challenge (NEW_PASSWORD_REQUIRED, MFA, ...) instead of
  // issuing tokens. Surface it rather than reporting a false success.
  if (!res.AuthenticationResult) {
    if (res.ChallengeName) {
      return {
        status: 200,
        body: {
          ok: true,
          challenge: {
            challengeName: res.ChallengeName,
            session: res.Session,
            username,
            parameters: res.ChallengeParameters || {},
          },
        },
      };
    }
    throw httpError(502, 'NO_TOKENS', 'The identity provider returned no tokens.');
  }

  return { status: 200, body: { ok: true, session: shapeTokens(res.AuthenticationResult, username) } };
}

async function handleRespondChallenge(body, hash) {
  const username = requireUsername(body);
  const challengeName = requireString(body, 'challengeName', { max: 64 });
  const session = requireString(body, 'session', { max: 8192 });

  const responses = { USERNAME: username, SECRET_HASH: hash(username) };

  if (challengeName === 'NEW_PASSWORD_REQUIRED') {
    responses.NEW_PASSWORD = requirePassword(body, 'newPassword');
  } else if (challengeName === 'SMS_MFA' || challengeName === 'SOFTWARE_TOKEN_MFA') {
    const code = requireString(body, 'code', { max: 16 });
    responses[challengeName === 'SMS_MFA' ? 'SMS_MFA_CODE' : 'SOFTWARE_TOKEN_MFA_CODE'] = code;
  } else {
    throw httpError(400, 'UNSUPPORTED_CHALLENGE', `Unsupported challenge: ${challengeName}`);
  }

  const res = await callCognito(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: challengeName,
      Session: session,
      ChallengeResponses: responses,
    })
  );

  if (!res.AuthenticationResult) {
    if (res.ChallengeName) {
      return {
        status: 200,
        body: {
          ok: true,
          challenge: {
            challengeName: res.ChallengeName,
            session: res.Session,
            username,
            parameters: res.ChallengeParameters || {},
          },
        },
      };
    }
    throw httpError(502, 'NO_TOKENS', 'The identity provider returned no tokens.');
  }

  return { status: 200, body: { ok: true, session: shapeTokens(res.AuthenticationResult, username) } };
}

async function handleRefresh(body, hash) {
  const username = requireUsername(body);
  const refreshToken = requireString(body, 'refreshToken', { max: 4096 });

  let res;
  try {
    res = await callCognito(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: hash(username),
        },
      })
    );
  } catch (err) {
    // An expired or revoked refresh token is a dead session, not a bad
    // password, so report it distinctly from a sign-in failure.
    if (err?.code === 'INVALID_CREDENTIALS') {
      throw httpError(401, 'REFRESH_FAILED', 'Your session has expired. Please sign in again.');
    }
    throw err;
  }

  if (!res.AuthenticationResult) {
    throw httpError(401, 'REFRESH_FAILED', 'Your session could not be renewed. Please sign in again.');
  }

  const shaped = shapeTokens(res.AuthenticationResult, username);
  // REFRESH_TOKEN_AUTH does not re-issue a refresh token; keep the current one.
  shaped.refreshToken = shaped.refreshToken || refreshToken;
  return { status: 200, body: { ok: true, session: shaped } };
}

/**
 * Revoke the refresh token (invalidating the whole chain) and, when an access
 * token is supplied, globally sign the user out of the pool.
 */
async function handleSignout(body) {
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken.trim() : '';
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
  const clientSecret = await getClientSecret();
  const revoked = { refreshToken: false, global: false };

  // Order matters: RevokeToken invalidates every access token issued from that
  // refresh token, so GlobalSignOut has to run first or it fails with
  // NotAuthorizedException against an already-dead access token.
  if (accessToken) {
    try {
      await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
      revoked.global = true;
    } catch (err) {
      console.warn('global_signout_failed', { name: err?.name });
    }
  }

  if (refreshToken) {
    try {
      await cognito.send(
        new RevokeTokenCommand({ Token: refreshToken, ClientId: CLIENT_ID, ClientSecret: clientSecret })
      );
      revoked.refreshToken = true;
    } catch (err) {
      // An already-invalid token is a successful logout from the user's view.
      console.warn('revoke_token_failed', { name: err?.name });
    }
  }

  return { status: 200, body: { ok: true, revoked } };
}

async function handleForgotPassword(body, hash) {
  const username = requireUsername(body);
  try {
    await cognito.send(
      new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: username, SecretHash: hash(username) })
    );
  } catch (err) {
    console.error('forgot_password_error', { name: err?.name });
    // Rate limiting and pool policy still need to surface; everything else is
    // collapsed into a generic success so this cannot enumerate accounts.
    const mapped = mapCognitoError(err);
    if (mapped.code === 'RATE_LIMITED' || mapped.code === 'CONFIG_ERROR') throw mapped;
  }
  return {
    status: 200,
    body: { ok: true, message: 'If an account exists for that username, a reset code has been sent.' },
  };
}

async function handleConfirmForgotPassword(body, hash) {
  const username = requireUsername(body);
  const code = requireString(body, 'code', { max: 16 });
  const newPassword = requirePassword(body, 'newPassword');

  await callCognito(
    new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
      Password: newPassword,
      SecretHash: hash(username),
    })
  );
  return { status: 200, body: { ok: true, message: 'Password updated. You can now sign in.' } };
}

async function handleConfirmSignup(body, hash) {
  const username = requireUsername(body);
  const code = requireString(body, 'code', { max: 16 });

  await callCognito(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
      SecretHash: hash(username),
    })
  );
  return { status: 200, body: { ok: true, message: 'Account confirmed. You can now sign in.' } };
}

async function handleResendConfirmation(body, hash) {
  const username = requireUsername(body);
  await callCognito(
    new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: username,
      SecretHash: hash(username),
    })
  );
  return { status: 200, body: { ok: true, message: 'A new confirmation code has been sent.' } };
}

async function handleSignup(body, hash) {
  if (!SIGNUP_ENABLED) {
    throw httpError(403, 'SIGNUP_DISABLED', 'Self sign-up is disabled for this deployment.');
  }
  const username = requireUsername(body);
  const password = requirePassword(body);
  const email = requireString(body, 'email', { max: 256 });

  const res = await callCognito(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      Password: password,
      SecretHash: hash(username),
      UserAttributes: [{ Name: 'email', Value: email }],
    })
  );

  return {
    status: 200,
    body: {
      ok: true,
      userConfirmed: Boolean(res.UserConfirmed),
      message: res.UserConfirmed
        ? 'Account created. You can now sign in.'
        : 'Account created. Check your email for a confirmation code.',
    },
  };
}

const ROUTES = {
  signin: handleSignin,
  'respond-challenge': handleRespondChallenge,
  refresh: handleRefresh,
  signout: handleSignout,
  'forgot-password': handleForgotPassword,
  'confirm-forgot-password': handleConfirmForgotPassword,
  'confirm-signup': handleConfirmSignup,
  'resend-confirmation': handleResendConfirmation,
  signup: handleSignup,
};

/* ---------------------------------------------------------------- handler -- */

export async function handler(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const method = event?.requestContext?.http?.method || event?.httpMethod || 'POST';
  const rawPath = event?.rawPath || event?.path || '';
  const action = rawPath.replace(/\/+$/, '').split('/').pop();

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  try {
    if (!CLIENT_ID || !USER_POOL_ID) {
      throw httpError(500, 'CONFIG_ERROR', 'Auth service is not configured.');
    }
    if (method !== 'POST') {
      throw httpError(405, 'METHOD_NOT_ALLOWED', 'This endpoint accepts POST only.');
    }

    const route = ROUTES[action];
    if (!route) {
      throw httpError(404, 'UNKNOWN_ACTION', `Unknown auth action: ${action}`);
    }

    let body;
    try {
      const raw = event?.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : event?.body || '{}';
      body = JSON.parse(raw || '{}');
    } catch {
      throw httpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw httpError(400, 'INVALID_JSON', 'Request body must be a JSON object.');
    }

    const sourceIp = event?.requestContext?.http?.sourceIp || 'unknown';
    enforceRateLimit(`${sourceIp}:${action}`);

    const clientSecret = await getClientSecret();
    const hash = (username) => secretHash(username, clientSecret);

    const { status, body: responseBody } = await route(body, hash);
    return reply(status, responseBody, origin);
  } catch (err) {
    const status = err?.statusCode || 500;
    const code = err?.code || 'INTERNAL_ERROR';
    if (status >= 500) {
      console.error('auth_handler_error', { action, code, message: err?.message });
    }
    return reply(status, {
      ok: false,
      code,
      message: err?.message || 'Unexpected error.',
      ...(err?.extra || {}),
    }, origin);
  }
}
