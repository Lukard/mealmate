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

// Adapters
export { MercadonaAdapter } from './adapters/mercadona.adapter';

// Mapper
export {
  IngredientMapper,
  getIngredientMapper,
  resetIngredientMapper,
} from './mapper';

// Sync
export type {
  PriceChange,
  SyncResult,
  SyncReport,
  SyncConfig,
  SyncProgress,
} from './sync';

export {
  SyncService,
  getSyncService,
  resetSyncService,
  scheduleSync,
  scheduleRecurringSync,
} from './sync';

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

  // Register adapters
  // Dynamically import to avoid circular dependencies
  import('./adapters/mercadona.adapter').then(({ MercadonaAdapter }) => {
    factory.registerAdapter('mercadona', MercadonaAdapter);
    console.log('[Supermarket Service] Mercadona adapter registered');
  });
  
  console.log('[Supermarket Service] Initialized');
}

/**
 * Register all adapters synchronously (for SSR/API routes)
 */
export function registerAllAdapters(): void {
  const factory = Factory.getInstance();
  
  // Import synchronously for server-side usage
  const { MercadonaAdapter } = require('./adapters/mercadona.adapter');
  factory.registerAdapter('mercadona', MercadonaAdapter);
}
