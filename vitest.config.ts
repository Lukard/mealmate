import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Global settings
    globals: true,
    environment: 'node',

    // Setup file
    setupFiles: ['./src/tests/setup.ts'],

    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.idea',
      '.git',
      '.cache',
      '**/e2e/**', // E2E tests run separately with Playwright
    ],

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Coverage thresholds (set to reasonable levels while project is in development)
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50,
        },
        // Higher thresholds for critical modules (relaxed until test coverage improves)
        'src/core/**': {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50,
        },
      },

      // Files to include in coverage
      include: ['src/**/*.ts'],

      // Files to exclude from coverage
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/tests/**',
        'src/types/**',
      ],
    },

    // Reporter configuration
    reporters: ['verbose', 'html'],

    // Timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,

    // Retry configuration for flaky tests
    retry: 1,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Snapshot configuration
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: false,
    },

    // Type checking (optional, can be slow)
    typecheck: {
      enabled: false,
      include: ['src/**/*.{test,spec}-d.ts'],
    },
  },

  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/tests'),
      '@fixtures': path.resolve(__dirname, './src/tests/fixtures'),
    },
  },
});
