/**
 * Sync Service
 * Background synchronization of supermarket catalogs
 */

import {
  SupermarketId,
  Category,
  NormalizedProduct,
} from './types';
import { SupermarketFactory } from './factory';
import { CacheService, CacheKeys, getCache } from './cache';

/**
 * Price change event
 */
export interface PriceChange {
  productId: string;
  supermarket: SupermarketId;
  productName: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  timestamp: Date;
}

/**
 * Sync result for a single operation
 */
export interface SyncResult {
  supermarket: SupermarketId;
  operation: 'categories' | 'products';
  success: boolean;
  itemsProcessed: number;
  itemsUpdated: number;
  priceChanges: PriceChange[];
  duration: number;
  error?: string;
}

/**
 * Full sync report
 */
export interface SyncReport {
  startTime: Date;
  endTime: Date;
  duration: number;
  results: SyncResult[];
  totalItemsProcessed: number;
  totalPriceChanges: number;
  success: boolean;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  supermarkets?: SupermarketId[];      // Which supermarkets to sync (default: all)
  syncCategories?: boolean;            // Sync category structure (default: true)
  syncProducts?: boolean;              // Sync product data (default: true)
  maxCategoriesPerRun?: number;        // Limit categories per sync (default: 20)
  priceChangeThreshold?: number;       // Min % change to log (default: 5%)
  onPriceChange?: (change: PriceChange) => void;  // Callback for price changes
  onProgress?: (progress: SyncProgress) => void;  // Progress callback
}

/**
 * Sync progress
 */
export interface SyncProgress {
  supermarket: SupermarketId;
  phase: 'categories' | 'products';
  current: number;
  total: number;
  percent: number;
}

/**
 * Default sync configuration
 */
const DEFAULT_SYNC_CONFIG: Required<Omit<SyncConfig, 'onPriceChange' | 'onProgress'>> = {
  supermarkets: undefined as unknown as SupermarketId[],
  syncCategories: true,
  syncProducts: true,
  maxCategoriesPerRun: 20,
  priceChangeThreshold: 5,
};

/**
 * Sync Service for catalog synchronization
 */
export class SyncService {
  private factory: SupermarketFactory;
  private cache: CacheService;
  private priceHistory: Map<string, number> = new Map();
  private lastSyncTime: Date | null = null;
  private isRunning: boolean = false;

  constructor(cache?: CacheService) {
    this.factory = SupermarketFactory.getInstance();
    this.cache = cache || getCache();
    this.loadPriceHistory();
  }

  /**
   * Run a full sync operation
   */
  async runSync(config?: SyncConfig): Promise<SyncReport> {
    if (this.isRunning) {
      throw new Error('Sync already in progress');
    }

    this.isRunning = true;
    const startTime = new Date();
    const results: SyncResult[] = [];
    
    const cfg = { ...DEFAULT_SYNC_CONFIG, ...config };
    const supermarkets = cfg.supermarkets || this.factory.getRegisteredIds();

    try {
      for (const supermarketId of supermarkets) {
        // Sync categories
        if (cfg.syncCategories) {
          const categoryResult = await this.syncCategories(supermarketId, cfg);
          results.push(categoryResult);
        }

        // Sync products
        if (cfg.syncProducts) {
          const productResult = await this.syncProducts(supermarketId, cfg);
          results.push(productResult);
        }
      }

      const endTime = new Date();
      const report: SyncReport = {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        results,
        totalItemsProcessed: results.reduce((sum, r) => sum + r.itemsProcessed, 0),
        totalPriceChanges: results.reduce((sum, r) => sum + r.priceChanges.length, 0),
        success: results.every(r => r.success),
      };

      this.lastSyncTime = endTime;
      this.savePriceHistory();

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync categories for a supermarket
   */
  async syncCategories(
    supermarketId: SupermarketId,
    config?: SyncConfig
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const priceChanges: PriceChange[] = [];

    try {
      const adapter = this.factory.getAdapter(supermarketId);
      const categories = await adapter.getCategories();

      // Cache the categories
      const cacheKey = CacheKeys.category(supermarketId);
      this.cache.setWithType(cacheKey, categories, 'category');

      return {
        supermarket: supermarketId,
        operation: 'categories',
        success: true,
        itemsProcessed: this.countCategories(categories),
        itemsUpdated: categories.length,
        priceChanges,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        supermarket: supermarketId,
        operation: 'categories',
        success: false,
        itemsProcessed: 0,
        itemsUpdated: 0,
        priceChanges,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync products for a supermarket
   */
  async syncProducts(
    supermarketId: SupermarketId,
    config?: SyncConfig
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const priceChanges: PriceChange[] = [];
    const cfg = { ...DEFAULT_SYNC_CONFIG, ...config };

    try {
      const adapter = this.factory.getAdapter(supermarketId);
      
      // Get categories first
      const categories = await adapter.getCategories();
      const categoriesToSync = categories.slice(0, cfg.maxCategoriesPerRun);
      
      let totalProducts = 0;
      let updatedProducts = 0;

      for (let i = 0; i < categoriesToSync.length; i++) {
        const category = categoriesToSync[i];
        
        // Report progress
        if (cfg.onProgress) {
          cfg.onProgress({
            supermarket: supermarketId,
            phase: 'products',
            current: i + 1,
            total: categoriesToSync.length,
            percent: ((i + 1) / categoriesToSync.length) * 100,
          });
        }

        try {
          const result = await adapter.getProductsByCategory(category.externalId, { limit: 100 });
          
          for (const product of result.products) {
            totalProducts++;
            
            // Check for price changes
            const priceKey = `${supermarketId}:${product.externalId}`;
            const oldPrice = this.priceHistory.get(priceKey);
            
            if (oldPrice !== undefined && oldPrice !== product.price) {
              const changePercent = ((product.price - oldPrice) / oldPrice) * 100;
              
              if (Math.abs(changePercent) >= cfg.priceChangeThreshold) {
                const change: PriceChange = {
                  productId: product.externalId,
                  supermarket: supermarketId,
                  productName: product.name,
                  oldPrice,
                  newPrice: product.price,
                  changePercent,
                  timestamp: new Date(),
                };
                
                priceChanges.push(change);
                
                if (cfg.onPriceChange) {
                  cfg.onPriceChange(change);
                }
              }
            }
            
            // Update price history
            this.priceHistory.set(priceKey, product.price);
            
            // Cache the product
            const productCacheKey = CacheKeys.product(supermarketId, product.externalId);
            this.cache.setWithType(productCacheKey, product, 'product');
            updatedProducts++;
          }

          // Cache category products
          const catCacheKey = CacheKeys.categoryProducts(supermarketId, category.externalId);
          this.cache.setWithType(catCacheKey, result, 'search');
        } catch {
          // Skip failed categories
          continue;
        }
      }

      return {
        supermarket: supermarketId,
        operation: 'products',
        success: true,
        itemsProcessed: totalProducts,
        itemsUpdated: updatedProducts,
        priceChanges,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        supermarket: supermarketId,
        operation: 'products',
        success: false,
        itemsProcessed: 0,
        itemsUpdated: 0,
        priceChanges,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  /**
   * Check if sync is currently running
   */
  isSyncing(): boolean {
    return this.isRunning;
  }

  /**
   * Get price history for a product
   */
  getPriceHistory(supermarketId: SupermarketId, productId: string): number | undefined {
    return this.priceHistory.get(`${supermarketId}:${productId}`);
  }

  /**
   * Get all price changes since last sync
   */
  getRecentPriceChanges(minChangePercent: number = 5): PriceChange[] {
    // This would query stored price changes
    // For MVP, we return empty as changes are only tracked during sync
    return [];
  }

  // ==================== Private methods ====================

  /**
   * Count total categories including nested
   */
  private countCategories(categories: Category[]): number {
    let count = categories.length;
    for (const cat of categories) {
      if (cat.children) {
        count += this.countCategories(cat.children);
      }
    }
    return count;
  }

  /**
   * Load price history from cache
   */
  private loadPriceHistory(): void {
    const cached = this.cache.get<Record<string, number>>('price_history');
    if (cached) {
      this.priceHistory = new Map(Object.entries(cached));
    }
  }

  /**
   * Save price history to cache
   */
  private savePriceHistory(): void {
    const data = Object.fromEntries(this.priceHistory);
    // Long TTL for price history (7 days)
    this.cache.set('price_history', data, 7 * 24 * 60 * 60 * 1000);
  }
}

// Singleton instance
let syncInstance: SyncService | null = null;

/**
 * Get or create the global sync service instance
 */
export function getSyncService(): SyncService {
  if (!syncInstance) {
    syncInstance = new SyncService();
  }
  return syncInstance;
}

/**
 * Reset the sync service (useful for testing)
 */
export function resetSyncService(): void {
  syncInstance = null;
}

/**
 * Schedule a sync to run at a specific time
 * Returns a function to cancel the scheduled sync
 */
export function scheduleSync(
  config: SyncConfig & { runAt: Date }
): () => void {
  const delay = config.runAt.getTime() - Date.now();
  
  if (delay < 0) {
    throw new Error('Cannot schedule sync in the past');
  }

  const service = getSyncService();
  const timeoutId = setTimeout(() => {
    service.runSync(config).catch(console.error);
  }, delay);

  return () => clearTimeout(timeoutId);
}

/**
 * Schedule recurring sync (e.g., daily at 3am)
 * Returns a function to stop the recurring sync
 */
export function scheduleRecurringSync(
  config: SyncConfig & { intervalMs: number }
): () => void {
  const service = getSyncService();
  
  const runSync = async () => {
    if (!service.isSyncing()) {
      await service.runSync(config).catch(console.error);
    }
  };

  const intervalId = setInterval(runSync, config.intervalMs);

  // Also run immediately
  runSync();

  return () => clearInterval(intervalId);
}
