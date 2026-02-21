/**
 * Base Adapter - Abstract class implementing common functionality
 * All supermarket adapters should extend this class
 */

import {
  SupermarketAdapter,
  SupermarketId,
  NormalizedProduct,
  Category,
  SearchOptions,
  SearchResult,
  AdapterConfig,
  SupermarketError,
} from '../types';

/**
 * Default configuration for adapters
 */
const DEFAULT_CONFIG: Required<AdapterConfig> = {
  postalCode: '28001', // Madrid default
  timeout: 10000,
  maxRetries: 3,
  cacheEnabled: true,
};

/**
 * Abstract base class for all supermarket adapters
 * Provides common functionality like rate limiting, retries, and error handling
 */
export abstract class BaseAdapter implements SupermarketAdapter {
  abstract readonly id: SupermarketId;
  abstract readonly name: string;
  abstract readonly baseUrl: string;
  readonly logoUrl?: string;

  protected config: Required<AdapterConfig>;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 1 second between requests

  constructor(config: AdapterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Rate limiting - ensures minimum interval between requests
   */
  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Helper to sleep for a given number of milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch with retry logic and error handling
   */
  protected async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    await this.rateLimit();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        // Rate limited - wait and retry
        if (retryCount < this.config.maxRetries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          await this.sleep(retryAfter * 1000);
          return this.fetchWithRetry<T>(url, options, retryCount + 1);
        }
        throw new SupermarketError(
          'Rate limited by API',
          this.id,
          'RATE_LIMITED'
        );
      }

      if (!response.ok) {
        throw new SupermarketError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.id,
          'NETWORK_ERROR'
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof SupermarketError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new SupermarketError(
            'Request timeout',
            this.id,
            'TIMEOUT',
            error
          );
        }

        // Network error - retry if possible
        if (retryCount < this.config.maxRetries) {
          const backoffTime = Math.pow(2, retryCount) * 1000;
          await this.sleep(backoffTime);
          return this.fetchWithRetry<T>(url, options, retryCount + 1);
        }

        throw new SupermarketError(
          error.message,
          this.id,
          'NETWORK_ERROR',
          error
        );
      }

      throw new SupermarketError(
        'Unknown error occurred',
        this.id,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
    const url = new URL(path, this.baseUrl);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
    
    return url.toString();
  }

  /**
   * Generate internal ID from supermarket and external ID
   */
  protected generateId(externalId: string): string {
    return `${this.id}:${externalId}`;
  }

  /**
   * Default implementation of isAvailable - can be overridden
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getCategories();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create default search options
   */
  protected getDefaultSearchOptions(): Required<SearchOptions> {
    return {
      limit: 20,
      offset: 0,
      categoryId: '',
      minPrice: 0,
      maxPrice: Infinity,
      sortBy: 'relevance',
      sortOrder: 'asc',
    };
  }

  /**
   * Merge search options with defaults
   */
  protected mergeSearchOptions(options?: SearchOptions): Required<SearchOptions> {
    return { ...this.getDefaultSearchOptions(), ...options };
  }

  // Abstract methods that must be implemented by each adapter
  abstract searchProducts(query: string, options?: SearchOptions): Promise<SearchResult>;
  abstract getProduct(externalId: string): Promise<NormalizedProduct | null>;
  abstract getCategories(): Promise<Category[]>;
  abstract getProductsByCategory(categoryId: string, options?: SearchOptions): Promise<SearchResult>;
}
