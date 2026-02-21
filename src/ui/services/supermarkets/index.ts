/**
 * Supermarket Integration Service
 * Public exports for the supermarket integration module
 */

import { SupermarketFactory as Factory } from './factory';

// Types
export type {
  SupermarketId,
  ProductUnit,
  NormalizedProduct,
  NutritionInfo,
  Category,
  SearchOptions,
  SearchResult,
  SupermarketAdapter,
  AdapterConfig,
  IngredientPriceResult,
  CacheEntry,
  CacheConfig,
  SupermarketErrorCode,
} from './types';

export { SupermarketError } from './types';

// Factory
export { SupermarketFactory, getFactory } from './factory';

// Cache
export {
  CacheService,
  CacheKeys,
  withCache,
  createCachedAdapter,
  getCache,
  resetCache,
} from './cache';

// Base adapter (for extending)
export { BaseAdapter } from './adapters/base.adapter';

// Re-export adapters as they're created
// export { MercadonaAdapter } from './adapters/mercadona.adapter';

/**
 * Initialize the supermarket service with default configuration
 * Call this once at app startup
 */
export function initializeSupermarketService(config?: {
  postalCode?: string;
  cacheConfig?: Partial<import('./types').CacheConfig>;
}): void {
  const factory = Factory.getInstance();
  
  if (config?.postalCode) {
    factory.setDefaultConfig({ postalCode: config.postalCode });
  }

  // Register adapters here as they're created
  // Example:
  // import { MercadonaAdapter } from './adapters/mercadona.adapter';
  // factory.registerAdapter('mercadona', MercadonaAdapter);
  
  console.log('[Supermarket Service] Initialized');
}
