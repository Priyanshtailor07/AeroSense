import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import 'leaflet/dist/leaflet.css';
import './index.css';

/**
 * The guard sits above <App>, so the dashboard tree — including its 3D scenes
 * and telemetry polling — is never mounted until Cognito has issued a verified
 * session.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </AuthProvider>
  </React.StrictMode>
);
