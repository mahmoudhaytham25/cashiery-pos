/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// POS_API_URL overrides the /api proxy target — same env var the Playwright
// spec reads. Needed on macOS where AirPlay Receiver squats on :5000
// (docker-compose publishes the backend on :5001 there).
const apiTarget = process.env.POS_API_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    // Port 3000 keeps parity with the old CRA dev server and the
    // docker-compose frontend port. /api is proxied to the Express
    // backend's own port (5000), matching the old CRA "proxy" setting.
    port: 3000,
    proxy: {
      '/api': apiTarget,
    },
  },
  // `vite preview` doesn't inherit server.proxy — mirror it so Playwright
  // e2e (running against the preview build) reaches the backend,
  // same as the dev server and the prod nginx proxy.
  preview: {
    port: 4173,
    proxy: {
      '/api': apiTarget,
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    css: false,
    // Playwright specs live in e2e/ — they're run by `playwright test`, not vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
