import React from 'react';
import { AUTH_STATUS, useAuth } from '../../context/AuthProvider';
import BootSplash from './BootSplash';
import LoginScreen from './LoginScreen';

/**
 * Top-level route guard. Protected children are not merely hidden — they are
 * never mounted while the session is unverified, so the dashboard's 3D scene,
 * polling and telemetry state cannot come into existence before Cognito has
 * accepted the credentials.
 */
export default function ProtectedRoute({ children }) {
  const { status, isAuthenticated } = useAuth();

  if (status === AUTH_STATUS.INITIALIZING) {
    return <BootSplash />;
  }

  if (status === AUTH_STATUS.LOGGING_OUT) {
    return <BootSplash label="Signing out…" />;
  }

  // `isAuthenticated` requires both the state machine and a live session object,
  // so neither one alone can open the dashboard.
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return children;
}
