/**
 * Extension Utilities
 * Common utility functions for the extension
 */

/**
 * Format price from cents to display string
 */
export function formatPrice(cents: number, currency = 'EUR'): string {
  const currencySymbols: Record<string, string> = {
    EUR: '\u20AC',
    GBP: '\u00A3',
    USD: '$'
  };

  const symbol = currencySymbols[currency] ?? currency;
  const price = (cents / 100).toFixed(2);

  return `${symbol}${price}`;
}

/**
 * Format date relative to now
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Check if we're in a content script context
 */
export function isContentScript(): boolean {
  return typeof window !== 'undefined' && !!chrome?.runtime?.id;
}

/**
 * Check if we're in the background service worker
 */
export function isBackgroundWorker(): boolean {
  return typeof window === 'undefined' && !!chrome?.runtime?.id;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Safely parse JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a URL matches a supermarket site
 */
export function detectSupermarket(url: string): 'dia' | 'mercadona' | 'carrefour_es' | null {
  if (url.includes('dia.es')) return 'dia';
  if (url.includes('mercadona.es')) return 'mercadona';
  if (url.includes('carrefour.es')) return 'carrefour_es';
  return null;
}

/**
 * Normalize product name for matching
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate text similarity (simple Levenshtein ratio)
 */
export function textSimilarity(a: string, b: string): number {
  const normalizedA = normalizeProductName(a);
  const normalizedB = normalizeProductName(b);

  if (normalizedA === normalizedB) return 1;
  if (!normalizedA || !normalizedB) return 0;

  const longer = normalizedA.length > normalizedB.length ? normalizedA : normalizedB;
  const shorter = normalizedA.length > normalizedB.length ? normalizedB : normalizedA;

  const longerLength = longer.length;
  if (longerLength === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
