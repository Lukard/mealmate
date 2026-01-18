/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function */
  keyGenerator?: (c: Context) => string;
  /** Skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store
 * In production, use Redis or similar
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton store instance
const store = new RateLimitStore();

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(c: Context): string {
  // Try to get real IP from headers (for proxied requests)
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = c.req.header('X-Real-IP');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection info or default
  return 'unknown';
}

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    limit,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    skip,
  } = config;

  return async (c: Context, next: Next): Promise<Response | void> => {
    // Check if this request should skip rate limiting
    if (skip && skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();
    const entry = store.get(key);

    let currentEntry: RateLimitEntry;

    if (!entry || entry.resetAt < now) {
      // Create new entry
      currentEntry = {
        count: 1,
        resetAt: now + windowMs,
      };
    } else {
      // Increment existing entry
      currentEntry = {
        count: entry.count + 1,
        resetAt: entry.resetAt,
      };
    }

    store.set(key, currentEntry);

    // Set rate limit headers
    const remaining = Math.max(0, limit - currentEntry.count);
    const resetSeconds = Math.ceil((currentEntry.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetSeconds.toString());

    // Check if rate limit exceeded
    if (currentEntry.count > limit) {
      c.header('Retry-After', resetSeconds.toString());

      throw new HTTPException(429, {
        message: 'Too many requests, please try again later',
        cause: {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: resetSeconds,
        },
      });
    }

    return next();
  };
}

/**
 * Pre-configured rate limiters for different endpoint groups
 */
export const rateLimiters = {
  /**
   * Auth endpoints - strict limits
   */
  auth: rateLimit({
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
  }),

  /**
   * Authenticated API endpoints - moderate limits
   */
  authenticated: rateLimit({
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (c) => {
      // Use user ID if authenticated, otherwise IP
      const userId = c.get('userId');
      return userId || defaultKeyGenerator(c);
    },
  }),

  /**
   * Public API endpoints - lower limits
   */
  public: rateLimit({
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  }),

  /**
   * Product search - higher limits
   */
  productSearch: rateLimit({
    limit: 200,
    windowMs: 60 * 1000, // 1 minute
  }),

  /**
   * Extension endpoints - specific limits
   */
  extension: rateLimit({
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (c) => {
      const userId = c.get('userId');
      return userId ? `ext:${userId}` : `ext:${defaultKeyGenerator(c)}`;
    },
  }),

  /**
   * Matching endpoints - resource intensive
   */
  matching: rateLimit({
    limit: 50,
    windowMs: 60 * 1000, // 1 minute
  }),
};
