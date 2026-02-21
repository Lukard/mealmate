/**
 * Tests for CacheService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService, CacheKeys, withCache, getCache, resetCache } from '../cache';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheService();
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', { foo: 'bar' });
      
      const result = cache.get<{ foo: string }>('test-key');
      
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      
      expect(result).toBeNull();
    });

    it('should expire entries after TTL', () => {
      cache.set('test-key', 'test-value', 1000); // 1 second TTL
      
      // Value should exist immediately
      expect(cache.get('test-key')).toBe('test-value');
      
      // Advance time past TTL
      vi.advanceTimersByTime(1500);
      
      // Value should be expired
      expect(cache.get('test-key')).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      cache = new CacheService({ defaultTTL: 5000 });
      cache.set('test-key', 'test-value');
      
      // Value should exist before TTL
      vi.advanceTimersByTime(4000);
      expect(cache.get('test-key')).toBe('test-value');
      
      // Value should be expired after TTL
      vi.advanceTimersByTime(2000);
      expect(cache.get('test-key')).toBeNull();
    });
  });

  describe('setWithType', () => {
    it('should use correct TTL for product type', () => {
      cache.set = vi.fn();
      cache.setWithType('key', 'value', 'product');
      
      expect(cache.set).toHaveBeenCalledWith('key', 'value', 24 * 60 * 60 * 1000);
    });

    it('should use correct TTL for category type', () => {
      cache.set = vi.fn();
      cache.setWithType('key', 'value', 'category');
      
      expect(cache.set).toHaveBeenCalledWith('key', 'value', 7 * 24 * 60 * 60 * 1000);
    });

    it('should use correct TTL for search type', () => {
      cache.set = vi.fn();
      cache.setWithType('key', 'value', 'search');
      
      expect(cache.set).toHaveBeenCalledWith('key', 'value', 60 * 60 * 1000);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('test-key', 'test-value');
      
      const deleted = cache.delete('test-key');
      
      expect(deleted).toBe(true);
      expect(cache.get('test-key')).toBeNull();
    });

    it('should return false for non-existent keys', () => {
      const deleted = cache.delete('non-existent');
      
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByPrefix', () => {
    it('should delete all keys with matching prefix', () => {
      cache.set('product:1', 'value1');
      cache.set('product:2', 'value2');
      cache.set('category:1', 'value3');
      
      const deleted = cache.deleteByPrefix('product:');
      
      expect(deleted).toBe(2);
      expect(cache.get('product:1')).toBeNull();
      expect(cache.get('product:2')).toBeNull();
      expect(cache.get('category:1')).toBe('value3');
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('test-key', 'test-value');
      
      expect(cache.has('test-key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      cache.set('test-key', 'test-value', 1000);
      
      vi.advanceTimersByTime(1500);
      
      expect(cache.has('test-key')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });

    it('should not include expired entries in stats', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 10000);
      
      vi.advanceTimersByTime(1500);
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(1);
      expect(stats.keys).not.toContain('key1');
      expect(stats.keys).toContain('key2');
    });
  });
});

describe('CacheKeys', () => {
  it('should generate correct product keys', () => {
    const key = CacheKeys.product('mercadona', '12345');
    expect(key).toBe('product:mercadona:12345');
  });

  it('should generate correct category keys', () => {
    const key1 = CacheKeys.category('mercadona');
    const key2 = CacheKeys.category('mercadona', '42');
    
    expect(key1).toBe('categories:mercadona');
    expect(key2).toBe('category:mercadona:42');
  });

  it('should generate correct search keys', () => {
    const key1 = CacheKeys.search('mercadona', 'leche');
    const key2 = CacheKeys.search('mercadona', 'leche', { limit: 10 });
    
    expect(key1).toBe('search:mercadona:leche:');
    expect(key2).toBe('search:mercadona:leche:{"limit":10}');
  });

  it('should generate correct categoryProducts keys', () => {
    const key = CacheKeys.categoryProducts('mercadona', '112');
    expect(key).toBe('catprods:mercadona:112:');
  });
});

describe('withCache', () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheService();
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  it('should cache function results', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: 'result' });
    const keyFn = (id: string) => `test:${id}`;
    
    const cachedFn = withCache(cache, keyFn, 'default', mockFn);
    
    // First call - should execute function
    const result1 = await cachedFn('123');
    expect(result1).toEqual({ data: 'result' });
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Second call - should use cache
    const result2 = await cachedFn('123');
    expect(result2).toEqual({ data: 'result' });
    expect(mockFn).toHaveBeenCalledTimes(1); // Still only 1 call
  });

  it('should call function again after cache expires', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: 'result' });
    const keyFn = (id: string) => `test:${id}`;
    
    // Use short TTL for testing
    cache = new CacheService({ defaultTTL: 1000 });
    const cachedFn = withCache(cache, keyFn, 'default', mockFn);
    
    // First call
    await cachedFn('123');
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Expire cache
    vi.advanceTimersByTime(1500);
    
    // Second call - should execute function again
    await cachedFn('123');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('getCache/resetCache', () => {
  afterEach(() => {
    resetCache();
  });

  it('should return singleton cache instance', () => {
    const cache1 = getCache();
    const cache2 = getCache();
    
    expect(cache1).toBe(cache2);
  });

  it('should create new instance after reset', () => {
    const cache1 = getCache();
    resetCache();
    const cache2 = getCache();
    
    expect(cache1).not.toBe(cache2);
  });
});
