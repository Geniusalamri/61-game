import { defineConfig } from '@playwright/test';

// See https://playwright.dev/docs/test-configuration for full details
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    headless: true,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
  },
});