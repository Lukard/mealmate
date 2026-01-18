/**
 * Supermarket Types
 * Types for supermarket definitions, scraper configuration, and integration
 */

import type { CurrencyCode, Product, ProductSearchCriteria, ProductSearchResult } from './product.js';

/** Unique identifier for supermarkets */
export type SupermarketId = string & { readonly __brand: 'SupermarketId' };

/**
 * Supported supermarket chains
 */
export type SupermarketChain =
  // Spain
  | 'mercadona'
  | 'carrefour_es'
  | 'dia'
  | 'alcampo'
  | 'lidl_es'
  | 'aldi_es'
  | 'eroski'
  | 'el_corte_ingles'
  // UK
  | 'tesco'
  | 'sainsburys'
  | 'asda'
  | 'morrisons'
  | 'waitrose'
  | 'ocado'
  | 'aldi_uk'
  | 'lidl_uk'
  // Generic
  | 'other';

/**
 * Supermarket configuration and metadata
 */
export interface Supermarket {
  /** Unique identifier */
  readonly id: SupermarketId;

  /** Supermarket chain */
  readonly chain: SupermarketChain;

  /** Display name */
  readonly displayName: string;

  /** Country code (ISO 3166-1 alpha-2) */
  readonly country: CountryCode;

  /** Base URL for the supermarket website */
  readonly baseUrl: string;

  /** Currency used */
  readonly currency: CurrencyCode;

  /** Logo URL */
  readonly logoUrl?: string;

  /** Whether online ordering is supported */
  readonly supportsOnlineOrdering: boolean;

  /** Whether click & collect is supported */
  readonly supportsClickAndCollect: boolean;

  /** Whether home delivery is supported */
  readonly supportsHomeDelivery: boolean;

  /** Delivery fee information */
  readonly deliveryInfo?: DeliveryInfo;

  /** Operating hours for online orders */
  readonly operatingHours?: OperatingHours;

  /** Whether the scraper for this supermarket is active */
  readonly scraperStatus: ScraperStatus;

  /** When this supermarket data was last updated */
  readonly lastUpdated: Date;
}

/**
 * Supported countries
 */
export type CountryCode = 'ES' | 'GB' | 'US';

/**
 * Delivery information
 */
export interface DeliveryInfo {
  /** Minimum order value for delivery in cents */
  readonly minimumOrderCents?: number;

  /** Standard delivery fee in cents */
  readonly standardFeeCents?: number;

  /** Whether free delivery is available */
  readonly freeDeliveryAvailable: boolean;

  /** Minimum order for free delivery in cents */
  readonly freeDeliveryThresholdCents?: number;

  /** Typical delivery window */
  readonly deliveryWindowHours?: number;
}

/**
 * Operating hours
 */
export interface OperatingHours {
  /** Whether orders can be placed 24/7 */
  readonly is24Hours: boolean;

  /** Opening time (HH:MM format) */
  readonly openTime?: string;

  /** Closing time (HH:MM format) */
  readonly closeTime?: string;

  /** Days when the service is unavailable */
  readonly closedDays?: readonly string[];
}

/**
 * Scraper operational status
 */
export type ScraperStatus =
  | 'active'             // Scraper is working normally
  | 'degraded'           // Scraper working but with issues
  | 'maintenance'        // Scraper temporarily disabled
  | 'broken'             // Scraper needs fixing
  | 'development';       // Scraper in development

/**
 * Configuration for a supermarket scraper
 */
export interface ScraperConfig {
  /** Which supermarket this config is for */
  readonly supermarketId: SupermarketId;

  /** Base URL for API calls */
  readonly apiBaseUrl?: string;

  /** Base URL for web scraping */
  readonly webBaseUrl: string;

  /** Required headers for requests */
  readonly headers: Readonly<Record<string, string>>;

  /** Rate limiting configuration */
  readonly rateLimit: RateLimitConfig;

  /** Retry configuration */
  readonly retry: RetryConfig;

  /** Timeout in milliseconds */
  readonly timeoutMs: number;

  /** Whether to use a proxy */
  readonly useProxy: boolean;

  /** CSS selectors or API paths for data extraction */
  readonly selectors: ScraperSelectors;

  /** Authentication configuration if required */
  readonly auth?: ScraperAuthConfig;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per second */
  readonly requestsPerSecond: number;

  /** Maximum concurrent requests */
  readonly maxConcurrent: number;

  /** Delay between batches in milliseconds */
  readonly batchDelayMs: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  readonly maxRetries: number;

  /** Base delay between retries in milliseconds */
  readonly baseDelayMs: number;

  /** Maximum delay between retries in milliseconds */
  readonly maxDelayMs: number;

  /** Whether to use exponential backoff */
  readonly exponentialBackoff: boolean;
}

/**
 * CSS selectors or API paths for data extraction
 */
export interface ScraperSelectors {
  /** How to find product listings */
  readonly productList: string;

  /** How to find product name */
  readonly productName: string;

  /** How to find product price */
  readonly productPrice: string;

  /** How to find product image */
  readonly productImage?: string;

  /** How to find product URL */
  readonly productUrl?: string;

  /** How to find next page link */
  readonly pagination?: string;

  /** How to find stock status */
  readonly stockStatus?: string;

  /** How to find promotional price */
  readonly promotionalPrice?: string;

  /** Custom selectors for this supermarket */
  readonly custom?: Readonly<Record<string, string>>;
}

/**
 * Authentication configuration for scrapers
 */
export interface ScraperAuthConfig {
  /** Authentication type */
  readonly type: 'none' | 'api_key' | 'oauth' | 'session';

  /** API key if applicable */
  readonly apiKey?: string;

  /** OAuth configuration if applicable */
  readonly oauth?: OAuthConfig;

  /** Session configuration if applicable */
  readonly session?: SessionConfig;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tokenUrl: string;
  readonly scopes: readonly string[];
}

/**
 * Session-based authentication configuration
 */
export interface SessionConfig {
  readonly loginUrl: string;
  readonly usernameField: string;
  readonly passwordField: string;
  readonly csrfTokenSelector?: string;
}

/**
 * Interface that all supermarket scrapers must implement
 */
export interface ISupermarketScraper {
  /** The supermarket this scraper is for */
  readonly supermarketId: SupermarketId;

  /** Current status of the scraper */
  readonly status: ScraperStatus;

  /**
   * Search for products matching criteria
   */
  searchProducts(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;

  /**
   * Get a specific product by ID
   */
  getProduct(productId: string): Promise<Product | null>;

  /**
   * Get products by category
   */
  getProductsByCategory(category: string, limit?: number): Promise<readonly Product[]>;

  /**
   * Check if products are in stock
   */
  checkStock(productIds: readonly string[]): Promise<Map<string, boolean>>;

  /**
   * Get current promotions
   */
  getPromotions(): Promise<readonly Product[]>;

  /**
   * Health check for the scraper
   */
  healthCheck(): Promise<ScraperHealthResult>;
}

/**
 * Result of a scraper health check
 */
export interface ScraperHealthResult {
  /** Whether the scraper is healthy */
  readonly healthy: boolean;

  /** Current status */
  readonly status: ScraperStatus;

  /** Response time in milliseconds */
  readonly responseTimeMs: number;

  /** Any error messages */
  readonly errors?: readonly string[];

  /** When the check was performed */
  readonly checkedAt: Date;
}

/**
 * Helper function to create supermarket ID
 */
export function createSupermarketId(id: string): SupermarketId {
  return id as SupermarketId;
}

/**
 * Default scraper configurations by chain
 */
export const DEFAULT_SCRAPER_CONFIGS: Readonly<Partial<Record<SupermarketChain, Partial<ScraperConfig>>>> = {
  mercadona: {
    webBaseUrl: 'https://tienda.mercadona.es',
    rateLimit: {
      requestsPerSecond: 2,
      maxConcurrent: 3,
      batchDelayMs: 1000
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      exponentialBackoff: true
    },
    timeoutMs: 30000,
    useProxy: false
  },
  carrefour_es: {
    webBaseUrl: 'https://www.carrefour.es',
    rateLimit: {
      requestsPerSecond: 1,
      maxConcurrent: 2,
      batchDelayMs: 2000
    },
    retry: {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
      exponentialBackoff: true
    },
    timeoutMs: 45000,
    useProxy: false
  }
} as const;
