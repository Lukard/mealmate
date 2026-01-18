import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Tests
 *
 * Includes configurations for:
 * - Web application testing
 * - Browser extension testing
 * - Cross-browser compatibility
 */

export default defineConfig({
  // Test directory
  testDir: './src/tests/e2e',

  // Test file patterns
  testMatch: '**/*.e2e.ts',

  // Maximum time for each test
  timeout: 30000,

  // Maximum time for expect() assertions
  expect: {
    timeout: 5000,
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the web app
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (useful for local development)
    ignoreHTTPSErrors: true,

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  },

  // Configure projects for different browsers
  projects: [
    // ==========================================================================
    // Desktop Browsers
    // ==========================================================================
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific settings
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // ==========================================================================
    // Mobile Browsers
    // ==========================================================================
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // ==========================================================================
    // Browser Extension Testing (Chrome)
    // ==========================================================================
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Load the extension in Chrome
        launchOptions: {
          args: [
            '--disable-extensions-except=./dist/extension',
            '--load-extension=./dist/extension',
          ],
        },
      },
      testMatch: '**/extension/*.e2e.ts',
    },

    // ==========================================================================
    // Supermarket Site Tests
    // ==========================================================================
    {
      name: 'mercadona',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://tienda.mercadona.es',
      },
      testMatch: '**/supermarkets/mercadona.e2e.ts',
    },
    {
      name: 'carrefour',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://www.carrefour.es',
      },
      testMatch: '**/supermarkets/carrefour.e2e.ts',
    },
    {
      name: 'dia',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://www.dia.es',
      },
      testMatch: '**/supermarkets/dia.e2e.ts',
    },
  ],

  // Web server configuration
  webServer: [
    // Main application server
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    // API server (if separate)
    {
      command: 'npm run dev:api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Global setup and teardown
  globalSetup: './src/tests/e2e/global-setup.ts',
  globalTeardown: './src/tests/e2e/global-teardown.ts',
});
