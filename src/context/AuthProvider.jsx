/**
 * AeroSense authentication state
 * -----------------------------------------------------------------------------
 * One authoritative state machine for the whole app:
 *
 *   initializing -> unauthenticated -> authenticating -> authenticated
 *                        ^                   |               |
 *                        |                   v               v
 *                        +------------- error/challenge   loggingOut
 *
 * `status === 'authenticated'` is only ever reached after the auth Lambda
 * returned tokens *and* those tokens passed issuer/audience/expiry validation.
 * `isVerified` additionally requires that API Gateway's JWT authorizer has
 * accepted the token on a real protected request.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  respondToChallenge as cognitoRespondToChallenge,
  getSession,
  onAuthStateChanged,
  hasRestorableSession,
  getConfigError,
  forgotPassword as cognitoForgotPassword,
  confirmForgotPassword as cognitoConfirmForgotPassword,
  confirmSignUp as cognitoConfirmSignUp,
  resendConfirmationCode as cognitoResendConfirmationCode,
  signUp as cognitoSignUp,
} from '../services/auth';

export const AUTH_STATUS = {
  INITIALIZING: 'initializing',
  UNAUTHENTICATED: 'unauthenticated',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  LOGGING_OUT: 'loggingOut',
  ERROR: 'error',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(AUTH_STATUS.INITIALIZING);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [challenge, setChallenge] = useState(null);

  const configError = useMemo(() => getConfigError(), []);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Restore a session on startup. A stored refresh token is only a *candidate*:
   * it must be exchanged with Cognito (via the Lambda) before the user counts
   * as authenticated.
   */
  const initialize = useCallback(async () => {
    if (configError) {
      setStatus(AUTH_STATUS.ERROR);
      setError({ code: 'CONFIG_ERROR', message: configError });
      return;
    }

    setStatus(AUTH_STATUS.INITIALIZING);

    if (!hasRestorableSession()) {
      if (mountedRef.current) setStatus(AUTH_STATUS.UNAUTHENTICATED);
      return;
    }

    try {
      const restored = await getSession();
      if (!mountedRef.current) return;
      if (restored) {
        setSession(restored);
        setStatus(AUTH_STATUS.AUTHENTICATED);
      } else {
        // Expired or revoked refresh token: the service already cleared it.
        setSession(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }
    } catch {
      if (!mountedRef.current) return;
      setSession(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
    }
  }, [configError]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * Keep in step with the service: an API 401 that cannot be recovered clears
   * the session from under us, and the UI must drop to login immediately.
   */
  useEffect(() => {
    return onAuthStateChanged((next) => {
      if (!mountedRef.current) return;
      setSession(next);
      if (!next) {
        setStatus((prev) =>
          prev === AUTH_STATUS.AUTHENTICATING || prev === AUTH_STATUS.INITIALIZING
            ? prev
            : AUTH_STATUS.UNAUTHENTICATED
        );
      }
    });
  }, []);

  /**
   * A page restored from the back/forward cache did not re-run startup, so its
   * session could be stale or already signed out. Re-validate on restore so the
   * back button cannot reveal protected content.
   */
  useEffect(() => {
    const onPageShow = async (event) => {
      if (!event.persisted) return;
      const valid = await getSession().catch(() => null);
      if (!mountedRef.current) return;
      if (valid) {
        setSession(valid);
        setStatus(AUTH_STATUS.AUTHENTICATED);
      } else {
        setSession(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const login = useCallback(async (username, password) => {
    setStatus(AUTH_STATUS.AUTHENTICATING);
    setError(null);
    setChallenge(null);

    try {
      const result = await cognitoSignIn(username, password);
      if (!mountedRef.current) return result;

      if (result.status === 'challenge') {
        // Cognito has not accepted the sign-in yet. Stay out of the dashboard.
        setChallenge(result.challenge);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
        return result;
      }

      setSession(result.session);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      return result;
    } catch (err) {
      if (!mountedRef.current) throw err;
      setSession(null);
      setError({ code: err?.code || 'AUTH_ERROR', message: err?.message || 'Sign-in failed.' });
      // A failed sign-in returns to the login screen — never into the dashboard.
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
      throw err;
    }
  }, []);

  const completeChallenge = useCallback(
    async (payload) => {
      setStatus(AUTH_STATUS.AUTHENTICATING);
      setError(null);
      try {
        const result = await cognitoRespondToChallenge({
          ...payload,
          username: payload.username || challenge?.username,
          session: payload.session || challenge?.session,
          challengeName: payload.challengeName || challenge?.challengeName,
        });
        if (!mountedRef.current) return result;

        if (result.status === 'challenge') {
          setChallenge(result.challenge);
          setStatus(AUTH_STATUS.UNAUTHENTICATED);
          return result;
        }

        setChallenge(null);
        setSession(result.session);
        setStatus(AUTH_STATUS.AUTHENTICATED);
        return result;
      } catch (err) {
        if (!mountedRef.current) throw err;
        setError({ code: err?.code || 'AUTH_ERROR', message: err?.message || 'Could not complete the challenge.' });
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
        throw err;
      }
    },
    [challenge]
  );

  const logout = useCallback(async () => {
    setStatus(AUTH_STATUS.LOGGING_OUT);
    try {
      await cognitoSignOut();
    } finally {
      if (mountedRef.current) {
        setSession(null);
        setChallenge(null);
        setError(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const cancelChallenge = useCallback(() => setChallenge(null), []);

  const value = useMemo(
    () => ({
      status,
      session,
      error,
      challenge,
      configError,
      isAuthenticated: status === AUTH_STATUS.AUTHENTICATED && Boolean(session),
      /** Server-verified: API Gateway's authorizer has accepted this token. */
      isVerified: status === AUTH_STATUS.AUTHENTICATED && Boolean(session?.verifiedAt),
      isBusy: status === AUTH_STATUS.AUTHENTICATING || status === AUTH_STATUS.LOGGING_OUT,
      login,
      logout,
      completeChallenge,
      cancelChallenge,
      clearError,
      retryInitialize: initialize,
      forgotPassword: cognitoForgotPassword,
      confirmForgotPassword: cognitoConfirmForgotPassword,
      confirmSignUp: cognitoConfirmSignUp,
      resendConfirmationCode: cognitoResendConfirmationCode,
      signUp: cognitoSignUp,
    }),
    [status, session, error, challenge, configError, login, logout, completeChallenge, cancelChallenge, clearError, initialize]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return ctx;
}
