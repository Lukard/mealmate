/**
 * Base Scraper
 * Abstract base class for all supermarket scrapers
 */

import type {
  ISupermarketScraper,
  SupermarketId,
  ScraperStatus,
  ScraperHealthResult,
  Product,
  ProductSearchCriteria,
  ProductSearchResult,
  ScraperConfig,
  RateLimitConfig,
  RetryConfig
} from '@meal-automation/shared';

/**
 * Configuration for base scraper
 */
export interface BaseScraperConfig {
  /** Supermarket ID */
  readonly supermarketId: SupermarketId;

  /** Base URL for the website */
  readonly baseUrl: string;

  /** Rate limiting configuration */
  readonly rateLimit?: Partial<RateLimitConfig>;

  /** Retry configuration */
  readonly retry?: Partial<RetryConfig>;

  /** Request timeout in milliseconds */
  readonly timeoutMs?: number;

  /** Custom headers for requests */
  readonly headers?: Record<string, string>;

  /** User agent string */
  readonly userAgent?: string;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerSecond: 1,
  maxConcurrent: 2,
  batchDelayMs: 1000
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  exponentialBackoff: true
};

/**
 * Abstract base class for supermarket scrapers
 */
export abstract class BaseScraper implements ISupermarketScraper {
  readonly supermarketId: SupermarketId;
  protected _status: ScraperStatus = 'active';

  protected readonly baseUrl: string;
  protected readonly rateLimit: RateLimitConfig;
  protected readonly retryConfig: RetryConfig;
  protected readonly timeoutMs: number;
  protected readonly headers: Record<string, string>;

  /** Request queue for rate limiting */
  private requestQueue: Array<() => Promise<void>> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;

  constructor(config: BaseScraperConfig) {
    this.supermarketId = config.supermarketId;
    this.baseUrl = config.baseUrl;
    this.rateLimit = { ...DEFAULT_RATE_LIMIT, ...config.rateLimit };
    this.retryConfig = { ...DEFAULT_RETRY, ...config.retry };
    this.timeoutMs = config.timeoutMs ?? 30000;

    this.headers = {
      'User-Agent': config.userAgent ??
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      ...config.headers
    };
  }

  get status(): ScraperStatus {
    return this._status;
  }

  /**
   * Search for products - must be implemented by subclasses
   */
  abstract searchProducts(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;

  /**
   * Get a specific product by ID - must be implemented by subclasses
   */
  abstract getProduct(productId: string): Promise<Product | null>;

  /**
   * Get products by category - must be implemented by subclasses
   */
  abstract getProductsByCategory(category: string, limit?: number): Promise<readonly Product[]>;

  /**
   * Check if products are in stock
   */
  async checkStock(productIds: readonly string[]): Promise<Map<string, boolean>> {
    const stockMap = new Map<string, boolean>();

    for (const productId of productIds) {
      const product = await this.getProduct(productId);
      stockMap.set(productId, product?.inStock ?? false);
    }

    return stockMap;
  }

  /**
   * Get current promotions - can be overridden by subclasses
   */
  async getPromotions(): Promise<readonly Product[]> {
    // Default implementation returns empty array
    // Subclasses should override this
    return [];
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<ScraperHealthResult> {
    const startTime = Date.now();

    try {
      // Try to fetch the base URL
      const response = await this.fetchWithRetry(this.baseUrl);

      if (response.ok) {
        return {
          healthy: true,
          status: 'active',
          responseTimeMs: Date.now() - startTime,
          checkedAt: new Date()
        };
      }

      return {
        healthy: false,
        status: 'degraded',
        responseTimeMs: Date.now() - startTime,
        errors: [`HTTP ${response.status}: ${response.statusText}`],
        checkedAt: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'broken',
        responseTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        checkedAt: new Date()
      };
    }
  }

  /**
   * Make a rate-limited HTTP request
   */
  protected async fetchWithRateLimit(url: string, options?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        try {
          // Enforce rate limiting
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          const minInterval = 1000 / this.rateLimit.requestsPerSecond;

          if (timeSinceLastRequest < minInterval) {
            await this.sleep(minInterval - timeSinceLastRequest);
          }

          this.activeRequests++;
          this.lastRequestTime = Date.now();

          const response = await this.fetchWithRetry(url, options);
          resolve(response);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      if (this.activeRequests < this.rateLimit.maxConcurrent) {
        executeRequest();
      } else {
        this.requestQueue.push(executeRequest);
      }
    });
  }

  /**
   * Make an HTTP request with retry logic
   */
  protected async fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          ...options,
          headers: { ...this.headers, ...options?.headers },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Retry on server errors
        if (response.status >= 500 && attempt < this.retryConfig.maxRetries) {
          throw new Error(`Server error: ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Process the request queue
   */
  private processQueue(): void {
    if (this.requestQueue.length > 0 && this.activeRequests < this.rateLimit.maxConcurrent) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }

  /**
   * Calculate delay for retry with optional exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (this.retryConfig.exponentialBackoff) {
      const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
      return Math.min(delay, this.retryConfig.maxDelayMs);
    }
    return this.retryConfig.baseDelayMs;
  }

  /**
   * Sleep for a specified duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse HTML content (subclasses should use a proper HTML parser like cheerio)
   */
  protected parseHtml(html: string): string {
    // This is a placeholder - subclasses should use cheerio or similar
    return html;
  }

  /**
   * Set the scraper status
   */
  protected setStatus(status: ScraperStatus): void {
    this._status = status;
  }

  /**
   * Log an error and optionally update status
   */
  protected logError(message: string, error?: unknown): void {
    console.error(`[${this.supermarketId}] ${message}`, error);

    // Optionally mark as degraded on errors
    if (this._status === 'active') {
      this._status = 'degraded';
    }
  }
}
