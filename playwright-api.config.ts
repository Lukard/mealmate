import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './src/tests/e2e',
  testMatch: '**/meal-plan-generation.e2e.ts',
  timeout: 120000,
  use: { ignoreHTTPSErrors: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
