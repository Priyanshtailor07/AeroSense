/**
 * AeroSense AWS Cognito Auth Service
 * Provides lightweight authentication using the AWS Cognito Identity Provider REST API
 * Supports sign-in, token storage, session validation, automatic token refresh, and sign-out.
 * Never embeds AWS secret keys.
 */

const STORAGE_KEY = 'aerosense_cognito_session';
const CONFIG_KEY = 'aerosense_cognito_config';
const listeners = new Set();

/**
 * Retrieve Cognito Pool/Client configuration from env or localStorage overrides
 */
export function getCognitoConfig(customConfig = null) {
  let userPoolId = customConfig?.userPoolId || import.meta.env.VITE_COGNITO_USER_POOL_ID || '';
  let clientId = customConfig?.clientId || import.meta.env.VITE_COGNITO_CLIENT_ID || '';
  let region = customConfig?.region || import.meta.env.VITE_AWS_REGION || 'ap-south-1';

  // Fallback to saved local runtime config if present
  if ((!userPoolId || !clientId) && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!userPoolId) userPoolId = parsed.userPoolId || '';
        if (!clientId) clientId = parsed.clientId || '';
        if (!region) region = parsed.region || 'ap-south-1';
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  return {
    userPoolId: userPoolId.trim(),
    clientId: clientId.trim(),
    region: region.trim() || 'ap-south-1',
  };
}

/**
 * Save custom runtime Cognito configuration
 */
export function saveCognitoConfig(config) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * Get cached session from localStorage
 */
function getStoredSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save session to localStorage
 */
function saveSession(session) {
  if (typeof localStorage === 'undefined') return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  notifyListeners(session);
}

/**
 * Notify subscribers of auth state change
 */
function notifyListeners(session) {
  listeners.forEach((fn) => {
    try {
      fn(session);
    } catch {
      // ignore error
    }
  });
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChanged(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Perform Cognito API request to initiate auth
 */
async function callCognitoAuth(action, target, body, region) {
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Cognito connection failed: ${err.message || 'Network unreachable'}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.message || data.__type || `Cognito Error ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Sign In with Username & Password via Cognito USER_PASSWORD_AUTH
 */
export async function signIn(username, password, customConfig = null) {
  const config = getCognitoConfig(customConfig);

  if (!config.clientId) {
    throw new Error('Cognito Client ID is not configured (VITE_COGNITO_CLIENT_ID)');
  }

  if (customConfig) {
    saveCognitoConfig(config);
  }

  const payload = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  const result = await callCognitoAuth('InitiateAuth', 'InitiateAuth', payload, config.region);

  if (!result || !result.AuthenticationResult) {
    if (result.ChallengeName) {
      throw new Error(`Cognito Challenge Required (${result.ChallengeName}). Please complete setup in AWS console.`);
    }
    throw new Error('Authentication response did not return valid tokens.');
  }

  const authResult = result.AuthenticationResult;
  const expiresIn = authResult.ExpiresIn || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  const session = {
    username,
    accessToken: authResult.AccessToken,
    idToken: authResult.IdToken,
    refreshToken: authResult.RefreshToken || null,
    tokenType: authResult.TokenType || 'Bearer',
    expiresIn,
    expiresAt,
    userPoolId: config.userPoolId,
    clientId: config.clientId,
    region: config.region,
  };

  saveSession(session);
  return session;
}

/**
 * Sign Out - clear local session
 */
export function signOut() {
  saveSession(null);
}

/**
 * Refresh access token using RefreshToken
 */
export async function refreshToken() {
  const session = getStoredSession();
  if (!session || !session.refreshToken) {
    signOut();
    return null;
  }

  const config = getCognitoConfig(session);
  const payload = {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: config.clientId,
    AuthParameters: {
      REFRESH_TOKEN: session.refreshToken,
    },
  };

  try {
    const result = await callCognitoAuth('InitiateAuth', 'InitiateAuth', payload, config.region);
    if (result && result.AuthenticationResult) {
      const authResult = result.AuthenticationResult;
      const expiresIn = authResult.ExpiresIn || 3600;

      const updatedSession = {
        ...session,
        accessToken: authResult.AccessToken || session.accessToken,
        idToken: authResult.IdToken || session.idToken,
        expiresIn,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      saveSession(updatedSession);
      return updatedSession;
    }
  } catch (err) {
    console.warn('Cognito token refresh failed:', err.message);
    signOut();
  }

  return null;
}

/**
 * Retrieve current valid session (auto-refreshing if near expiration)
 */
export async function getSession() {
  const session = getStoredSession();
  if (!session) return null;

  // Refresh if token expires within 2 minutes
  if (session.expiresAt && Date.now() >= session.expiresAt - 120000) {
    if (session.refreshToken) {
      return await refreshToken();
    } else {
      signOut();
      return null;
    }
  }

  return session;
}

/**
 * Helper to get currently active access token
 */
export async function getAccessToken() {
  const session = await getSession();
  return session ? session.accessToken : null;
}
