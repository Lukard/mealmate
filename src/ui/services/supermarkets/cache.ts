/**
 * Cache Service - In-memory cache with TTL support
 * MVP implementation using Map, can be upgraded to Redis later
 */

import {
  CacheEntry,
  CacheConfig,
  NormalizedProduct,
  Category,
  SearchResult,
} from './types';

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 60 * 60 * 1000,           // 1 hour
  productTTL: 24 * 60 * 60 * 1000,      // 24 hours
  categoryTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  searchTTL: 60 * 60 * 1000,            // 1 hour
};

/**
 * Cache key types for automatic TTL selection
 */
export type CacheKeyType = 'product' | 'category' | 'search' | 'default';

/**
 * In-memory cache service with TTL support
 */
export class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.config.defaultTTL);

    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt,
    });
  }

  /**
   * Set with automatic TTL based on key type
   */
  setWithType<T>(key: string, data: T, type: CacheKeyType): void {
    const ttl = this.getTTLForType(type);
    this.set(key, data, ttl);
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern (prefix)
   */
  deleteByPrefix(prefix: string): number {
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    this.cleanup(); // Clean expired entries first
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Get TTL for a cache key type
   */
  private getTTLForType(type: CacheKeyType): number {
    switch (type) {
      case 'product':
        return this.config.productTTL;
      case 'category':
        return this.config.categoryTTL;
      case 'search':
        return this.config.searchTTL;
      default:
        return this.config.defaultTTL;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the cleanup timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Cache key generators for consistent key formats
 */
export const CacheKeys = {
  product: (supermarket: string, productId: string) =>
    `product:${supermarket}:${productId}`,
  
  category: (supermarket: string, categoryId?: string) =>
    categoryId ? `category:${supermarket}:${categoryId}` : `categories:${supermarket}`,
  
  search: (supermarket: string, query: string, options?: Record<string, unknown>) =>
    `search:${supermarket}:${query}:${options ? JSON.stringify(options) : ''}`,
  
  categoryProducts: (supermarket: string, categoryId: string, options?: Record<string, unknown>) =>
    `catprods:${supermarket}:${categoryId}:${options ? JSON.stringify(options) : ''}`,
};

/**
 * Higher-order function to wrap adapter methods with caching
 */
export function withCache<T extends unknown[], R>(
  cache: CacheService,
  keyFn: (...args: T) => string,
  type: CacheKeyType,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const key = keyFn(...args);
    
    // Try to get from cache
    const cached = cache.get<R>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Execute the function
    const result = await fn(...args);
    
    // Store in cache
    cache.setWithType(key, result, type);
    
    return result;
  };
}

/**
 * Create a cached version of an adapter
 */
export function createCachedAdapter<T extends object>(
  adapter: T,
  cache: CacheService,
  supermarketId: string
): T {
  // We'll implement this when we have the actual adapter
  // For now, return the adapter as-is
  return adapter;
}

// Singleton cache instance
let globalCache: CacheService | null = null;

/**
 * Get or create the global cache instance
 */
export function getCache(config?: Partial<CacheConfig>): CacheService {
  if (!globalCache) {
    globalCache = new CacheService(config);
  }
  return globalCache;
}

/**
 * Reset the global cache (useful for testing)
 */
export function resetCache(): void {
  if (globalCache) {
    globalCache.destroy();
    globalCache = null;
  }
}
