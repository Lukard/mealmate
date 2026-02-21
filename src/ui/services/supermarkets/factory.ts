/**
 * SupermarketFactory - Factory class for managing supermarket adapters
 * Provides centralized access to all registered adapters
 */

import {
  SupermarketAdapter,
  SupermarketId,
  AdapterConfig,
  SupermarketError,
} from './types';

/**
 * Adapter constructor type
 */
type AdapterConstructor = new (config?: AdapterConfig) => SupermarketAdapter;

/**
 * Factory class for creating and managing supermarket adapters
 * Implements singleton pattern for adapter instances
 */
export class SupermarketFactory {
  private static instance: SupermarketFactory;
  private adapterConstructors: Map<SupermarketId, AdapterConstructor> = new Map();
  private adapterInstances: Map<string, SupermarketAdapter> = new Map();
  private defaultConfig: AdapterConfig = {};

  private constructor() {}

  /**
   * Get the singleton instance of the factory
   */
  static getInstance(): SupermarketFactory {
    if (!SupermarketFactory.instance) {
      SupermarketFactory.instance = new SupermarketFactory();
    }
    return SupermarketFactory.instance;
  }

  /**
   * Register an adapter class with the factory
   */
  registerAdapter(id: SupermarketId, AdapterClass: AdapterConstructor): void {
    this.adapterConstructors.set(id, AdapterClass);
  }

  /**
   * Set default configuration for all adapters
   */
  setDefaultConfig(config: AdapterConfig): void {
    this.defaultConfig = config;
    // Clear cached instances so they're recreated with new config
    this.adapterInstances.clear();
  }

  /**
   * Get an adapter instance by supermarket ID
   * Adapters are cached by ID + config hash
   */
  getAdapter(id: SupermarketId, config?: AdapterConfig): SupermarketAdapter {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const cacheKey = `${id}:${JSON.stringify(mergedConfig)}`;

    // Return cached instance if available
    let adapter = this.adapterInstances.get(cacheKey);
    if (adapter) {
      return adapter;
    }

    // Get the constructor
    const AdapterClass = this.adapterConstructors.get(id);
    if (!AdapterClass) {
      throw new SupermarketError(
        `No adapter registered for supermarket: ${id}`,
        id,
        'ADAPTER_NOT_FOUND'
      );
    }

    // Create and cache the instance
    adapter = new AdapterClass(mergedConfig);
    this.adapterInstances.set(cacheKey, adapter);

    return adapter;
  }

  /**
   * Get all registered adapter instances
   */
  getAllAdapters(config?: AdapterConfig): SupermarketAdapter[] {
    const adapters: SupermarketAdapter[] = [];
    
    for (const id of this.adapterConstructors.keys()) {
      adapters.push(this.getAdapter(id, config));
    }
    
    return adapters;
  }

  /**
   * Get all registered supermarket IDs
   */
  getRegisteredIds(): SupermarketId[] {
    return Array.from(this.adapterConstructors.keys());
  }

  /**
   * Check which adapters are available (API working)
   */
  async getAvailableAdapters(config?: AdapterConfig): Promise<SupermarketAdapter[]> {
    const allAdapters = this.getAllAdapters(config);
    const availabilityChecks = await Promise.all(
      allAdapters.map(async (adapter) => ({
        adapter,
        available: await adapter.isAvailable(),
      }))
    );

    return availabilityChecks
      .filter(({ available }) => available)
      .map(({ adapter }) => adapter);
  }

  /**
   * Check if a specific supermarket is registered
   */
  hasAdapter(id: SupermarketId): boolean {
    return this.adapterConstructors.has(id);
  }

  /**
   * Get adapters that cover a specific postal code
   */
  async getAdaptersForPostalCode(
    postalCode: string,
    config?: AdapterConfig
  ): Promise<SupermarketAdapter[]> {
    const allAdapters = this.getAllAdapters({ ...config, postalCode });
    const coverageChecks = await Promise.all(
      allAdapters.map(async (adapter) => {
        if (adapter.checkPostalCodeCoverage) {
          return {
            adapter,
            covers: await adapter.checkPostalCodeCoverage(postalCode),
          };
        }
        // If no coverage check, assume it covers
        return { adapter, covers: true };
      })
    );

    return coverageChecks
      .filter(({ covers }) => covers)
      .map(({ adapter }) => adapter);
  }

  /**
   * Clear all cached adapter instances
   */
  clearCache(): void {
    this.adapterInstances.clear();
  }

  /**
   * Reset the factory (useful for testing)
   */
  reset(): void {
    this.adapterConstructors.clear();
    this.adapterInstances.clear();
    this.defaultConfig = {};
  }
}

// Export singleton getter for convenience
export const getFactory = () => SupermarketFactory.getInstance();
