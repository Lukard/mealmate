/**
 * Test Utilities
 * Common helper functions for testing
 */

import type { Product, MealPlan, Recipe, UserPreferences } from '@meal-automation/shared';

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock HTTP response
 */
export function createMockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'Content-Type': 'application/json' }),
    clone: function() { return this; }
  } as Response;
}

/**
 * Create a mock error response
 */
export function createMockErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    statusText: message,
    json: () => Promise.reject(new Error(message)),
    text: () => Promise.resolve(message),
    headers: new Headers({ 'Content-Type': 'text/plain' }),
    clone: function() { return this; }
  } as Response;
}

/**
 * Create a mock network error
 */
export function createNetworkError(message = 'Network error'): Error {
  const error = new Error(message);
  error.name = 'NetworkError';
  return error;
}

/**
 * Generate a random ID
 */
export function generateId(prefix = ''): string {
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}-${random}` : random;
}

/**
 * Deep freeze an object to ensure immutability in tests
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;

  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return obj;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a deferred promise for testing async scenarios
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Assert that a function throws an error
 */
export async function expectThrows<T extends Error>(
  fn: () => Promise<unknown>,
  errorType?: new (...args: unknown[]) => T,
  message?: string
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (errorType && !(error instanceof errorType)) {
      throw new Error(`Expected error of type ${errorType.name}, got ${(error as Error).constructor.name}`);
    }
    if (message && !(error as Error).message.includes(message)) {
      throw new Error(`Expected error message to include "${message}", got "${(error as Error).message}"`);
    }
  }
}
