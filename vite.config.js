import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Fixed configuration so tests exercise the real validation paths
    // (issuer/audience checks) rather than skipping them.
    env: {
      VITE_AEROSENSE_API_URL: 'https://api.test.invalid',
      VITE_AWS_REGION: 'ap-south-1',
      VITE_COGNITO_USER_POOL_ID: 'ap-south-1_TESTPOOL',
      VITE_COGNITO_CLIENT_ID: 'testclientid0000000000000',
      VITE_COGNITO_TOKEN_TYPE: 'access'
    }
  }
});
