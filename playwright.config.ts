import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '*.spec.ts', use: { baseURL: 'http://127.0.0.1:3199', headless: true },
  webServer: { command: 'node tests/browser/server.mjs', url: 'http://127.0.0.1:3199', reuseExistingServer: false },
});
