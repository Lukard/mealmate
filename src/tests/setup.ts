/**
 * Global Test Setup
 *
 * This file is loaded before any test files run.
 * It configures the test environment and sets up global utilities.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Environment Configuration
// ============================================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:3001';
process.env.DATABASE_URL = ':memory:';
process.env.LOG_LEVEL = 'silent';

// ============================================================================
// Global Mocks
// ============================================================================

// Mock Date for consistent timestamps in tests
const MOCK_DATE = new Date('2026-01-15T10:00:00.000Z');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_DATE);
});

afterAll(() => {
  vi.useRealTimers();
});

// ============================================================================
// Test Database Setup
// ============================================================================

let testDatabase: unknown = null;

export async function setupTestDatabase() {
  // In a real implementation, this would set up an in-memory SQLite database
  // For now, we'll just return a mock
  testDatabase = {
    isConnected: true,
    query: vi.fn(),
    close: vi.fn(),
  };
  return testDatabase;
}

export async function teardownTestDatabase() {
  if (testDatabase) {
    // Clean up database connection
    testDatabase = null;
  }
}

// ============================================================================
// Browser Extension Mocks
// ============================================================================

export const mockChromeStorage = {
  local: {
    get: vi.fn().mockImplementation((keys, callback) => {
      callback({});
    }),
    set: vi.fn().mockImplementation((items, callback) => {
      callback?.();
    }),
    remove: vi.fn().mockImplementation((keys, callback) => {
      callback?.();
    }),
    clear: vi.fn().mockImplementation((callback) => {
      callback?.();
    }),
  },
  sync: {
    get: vi.fn().mockImplementation((keys, callback) => {
      callback({});
    }),
    set: vi.fn().mockImplementation((items, callback) => {
      callback?.();
    }),
  },
};

export const mockChromeTabs = {
  query: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockResolvedValue({ id: 1 }),
  update: vi.fn().mockResolvedValue(undefined),
};

export const mockChromeRuntime = {
  sendMessage: vi.fn().mockResolvedValue(undefined),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
};

// Setup global chrome mock for browser extension tests
declare global {
  // eslint-disable-next-line no-var
  var chrome: {
    storage: typeof mockChromeStorage;
    tabs: typeof mockChromeTabs;
    runtime: typeof mockChromeRuntime;
  };
}

globalThis.chrome = {
  storage: mockChromeStorage,
  tabs: mockChromeTabs,
  runtime: mockChromeRuntime,
};

// ============================================================================
// Fetch Mock Setup
// ============================================================================

// This will be replaced by MSW in actual tests
export const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ============================================================================
// Console Suppression (Optional)
// ============================================================================

// Suppress console output during tests (comment out for debugging)
const originalConsole = { ...console };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Keep console.error for debugging
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Expose original console for debugging
export { originalConsole };

// ============================================================================
// Custom Matchers
// ============================================================================

// Add custom matchers for domain-specific assertions
expect.extend({
  toBeValidMealPlan(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      Array.isArray(received.days) &&
      received.days.length > 0 &&
      received.days.every(
        (day: { meals: unknown }) =>
          day.meals && typeof day.meals === 'object'
      );

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid meal plan`
          : `Expected ${JSON.stringify(received)} to be a valid meal plan with days and meals`,
    };
  },

  toBeValidProduct(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.price === 'number' &&
      received.price >= 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid product`
          : `Expected ${JSON.stringify(received)} to be a valid product with id, name, and price`,
    };
  },

  toBeValidGroceryList(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      Array.isArray(received.items) &&
      received.items.every(
        (item: { name: string; quantity: number }) =>
          typeof item.name === 'string' && typeof item.quantity === 'number'
      );

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid grocery list`
          : `Expected ${JSON.stringify(received)} to be a valid grocery list with items`,
    };
  },
});

// Type augmentation for custom matchers
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toBeValidMealPlan(): T;
    toBeValidProduct(): T;
    toBeValidGroceryList(): T;
  }
  interface AsymmetricMatchersContaining {
    toBeValidMealPlan(): unknown;
    toBeValidProduct(): unknown;
    toBeValidGroceryList(): unknown;
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random test ID
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deep clone an object (useful for fixture manipulation)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Create a mock API response
 */
export function createMockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  } as Response;
}

console.log('Test setup initialized');
