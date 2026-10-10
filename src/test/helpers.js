/** Shared fixtures: minted JWTs and a scriptable fetch double. */

const POOL_ISSUER = 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_TESTPOOL';
const CLIENT_ID = 'testclientid0000000000000';

/** Makes every minted token unique, as real Cognito tokens are. */
let jtiCounter = 0;

function b64url(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Mint an unsigned JWT with realistic Cognito claims. Signature verification is
 * the API Gateway authorizer's job, so a fake signature is correct here.
 */
export function makeJwt({
  tokenUse = 'access',
  expiresInSeconds = 3600,
  issuer = POOL_ISSUER,
  clientId = CLIENT_ID,
  username = 'operator',
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: 'sub-1234',
    iss: issuer,
    token_use: tokenUse,
    username,
    jti: `jti-${++jtiCounter}`,
    iat: now,
    exp: now + expiresInSeconds,
  };
  if (tokenUse === 'access') claims.client_id = clientId;
  else claims.aud = clientId;
  return `${b64url({ alg: 'RS256', kid: 'test' })}.${b64url(claims)}.c2lnbmF0dXJl`;
}

export function makeSessionPayload(overrides = {}) {
  return {
    // The Lambda returns the pool's internal username plus a human label.
    username: 'operator',
    displayName: 'operator@example.com',
    accessToken: makeJwt({ tokenUse: 'access' }),
    idToken: makeJwt({ tokenUse: 'id' }),
    refreshToken: 'refresh-token-abc',
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: Date.now() + 3600_000,
    ...overrides,
  };
}

export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * A fetch double driven by route matchers. Every call is recorded so tests can
 * assert on headers, order and query strings.
 */
export function createFetchMock() {
  const calls = [];
  const routes = [];

  const impl = async (url, options = {}) => {
    calls.push({ url: String(url), options, headers: options.headers || {} });
    for (const route of routes) {
      if (route.match(String(url), options)) {
        if (typeof route.respond === 'function') return route.respond(String(url), options);
        return route.respond;
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  impl.calls = calls;
  impl.on = (match, respond) => {
    routes.unshift({ match: typeof match === 'string' ? (u) => u.includes(match) : match, respond });
    return impl;
  };
  impl.callsTo = (fragment) => calls.filter((c) => c.url.includes(fragment));
  return impl;
}
