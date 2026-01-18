/**
 * DIA Supermarket Scraper
 *
 * Scraper for DIA supermarket using their REST APIs (Algolia-powered).
 * Implements rate limiting, retry logic, and response caching.
 */

import type {
  Product,
  ProductId,
  ProductSearchCriteria,
  ProductSearchResult,
  PriceInfo,
  PackageSize,
  IngredientCategory,
  Promotion,
  PromotionType
} from '@meal-automation/shared';
import { createProductId, createSupermarketId } from '@meal-automation/shared';
import { BaseScraper, type BaseScraperConfig } from './base.scraper.js';

// ============================================================================
// DIA API Types
// ============================================================================

/**
 * DIA API product response structure
 */
interface DiaApiProduct {
  readonly id: string;
  readonly display_name: string;
  readonly brand?: string;
  readonly description?: string;
  readonly slug: string;
  readonly prices: {
    readonly price: number;
    readonly price_per_unit?: number;
    readonly unit_price?: string;
    readonly strikethrough_price?: number;
    readonly discount_percentage?: number;
  };
  readonly images?: readonly string[];
  readonly categories?: readonly DiaCategory[];
  readonly stock?: {
    readonly available: boolean;
    readonly quantity?: number;
  };
  readonly ean?: string;
  readonly packaging?: {
    readonly size?: string;
    readonly unit?: string;
    readonly quantity?: number;
  };
  readonly is_new?: boolean;
  readonly badges?: readonly string[];
}

/**
 * DIA category structure
 */
interface DiaCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parent_id?: string;
  readonly level?: number;
}

/**
 * DIA API search response
 */
interface DiaSearchResponse {
  readonly hits: readonly DiaApiProduct[];
  readonly nbHits: number;
  readonly page: number;
  readonly nbPages: number;
  readonly hitsPerPage: number;
  readonly processingTimeMS: number;
}

/**
 * DIA API category listing response
 */
interface DiaCategoryResponse {
  readonly products: readonly DiaApiProduct[];
  readonly total: number;
  readonly page: number;
  readonly pages: number;
  readonly category: DiaCategory;
}

/**
 * DIA API home/promotions response
 */
interface DiaHomeResponse {
  readonly carousels?: readonly {
    readonly type: string;
    readonly title: string;
    readonly products: readonly DiaApiProduct[];
  }[];
  readonly promotions?: readonly DiaApiProduct[];
}

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  readonly data: T;
  readonly timestamp: number;
}

/**
 * Simple in-memory cache with TTL
 */
class ResponseCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 3600000) { // Default 1 hour
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// ============================================================================
// DIA Scraper Configuration
// ============================================================================

const DIA_SUPERMARKET_ID = createSupermarketId('dia');

const DIA_BASE_CONFIG: BaseScraperConfig = {
  supermarketId: DIA_SUPERMARKET_ID,
  baseUrl: 'https://www.dia.es',
  rateLimit: {
    requestsPerSecond: 0.5, // 2 second delay between requests
    maxConcurrent: 1,
    batchDelayMs: 2000
  },
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBackoff: true
  },
  timeoutMs: 30000,
  headers: {
    'Accept': 'application/json',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
};

// ============================================================================
// Category Mapping
// ============================================================================

/**
 * Map DIA categories to our IngredientCategory type
 */
const CATEGORY_MAPPING: Record<string, IngredientCategory> = {
  // Produce
  'frutas': 'produce',
  'verduras': 'produce',
  'hortalizas': 'produce',
  'frutas-y-verduras': 'produce',

  // Dairy
  'lacteos': 'dairy',
  'leche': 'dairy',
  'yogures': 'dairy',
  'quesos': 'dairy',
  'mantequilla': 'dairy',
  'huevos': 'dairy',

  // Meat
  'carnes': 'meat',
  'carne': 'meat',
  'embutidos': 'meat',
  'charcuteria': 'meat',
  'pollo': 'meat',
  'cerdo': 'meat',
  'ternera': 'meat',

  // Seafood
  'pescados': 'seafood',
  'mariscos': 'seafood',
  'pescaderia': 'seafood',

  // Bakery
  'panaderia': 'bakery',
  'pan': 'bakery',
  'bolleria': 'bakery',
  'pasteleria': 'bakery',

  // Frozen
  'congelados': 'frozen',
  'helados': 'frozen',

  // Canned
  'conservas': 'canned',
  'latas': 'canned',

  // Dry goods
  'arroz': 'dry_goods',
  'pasta': 'dry_goods',
  'legumbres': 'dry_goods',
  'cereales': 'dry_goods',
  'harinas': 'dry_goods',

  // Condiments
  'salsas': 'condiments',
  'aceites': 'condiments',
  'vinagres': 'condiments',
  'aderezos': 'condiments',

  // Spices
  'especias': 'spices',
  'condimentos': 'spices',

  // Beverages
  'bebidas': 'beverages',
  'refrescos': 'beverages',
  'zumos': 'beverages',
  'agua': 'beverages',
  'cafe': 'beverages',
  'te': 'beverages',
  'vinos': 'beverages',
  'cervezas': 'beverages'
};

// ============================================================================
// DIA Scraper Implementation
// ============================================================================

/**
 * DIA Supermarket Scraper
 *
 * Features:
 * - Rate limiting (2 second delay between requests)
 * - Retry logic with exponential backoff
 * - Response caching (1 hour TTL)
 * - Error handling for network failures
 * - Product data normalization
 */
export class DiaScraper extends BaseScraper {
  private readonly productCache: ResponseCache<Product>;
  private readonly searchCache: ResponseCache<ProductSearchResult>;
  private readonly categoryCache: ResponseCache<readonly Product[]>;

  /** API endpoints */
  private readonly endpoints = {
    search: '/api/v1/search-back/search',
    categories: '/api/v1/list-back/categories',
    categoryProducts: '/api/v1/list-back/products',
    home: '/api/v2/home-back',
    product: '/api/v1/product-back'
  };

  constructor(config?: Partial<BaseScraperConfig>) {
    super({ ...DIA_BASE_CONFIG, ...config });

    // Initialize caches with 1 hour TTL
    this.productCache = new ResponseCache<Product>(3600000);
    this.searchCache = new ResponseCache<ProductSearchResult>(3600000);
    this.categoryCache = new ResponseCache<readonly Product[]>(3600000);
  }

  // ==========================================================================
  // ISupermarketScraper Implementation
  // ==========================================================================

  /**
   * Search for products using DIA's search API
   */
  async searchProducts(criteria: ProductSearchCriteria): Promise<ProductSearchResult> {
    const startTime = Date.now();
    const cacheKey = this.buildSearchCacheKey(criteria);

    // Check cache first
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = new URL(this.endpoints.search, this.baseUrl);
      url.searchParams.set('q', criteria.query);
      url.searchParams.set('page', '0');
      url.searchParams.set('hitsPerPage', String(criteria.limit));

      const response = await this.fetchWithRateLimit(url.toString(), {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`DIA search API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as DiaSearchResponse;

      const products = await this.normalizeProducts(
        data.hits,
        criteria.inStockOnly,
        criteria.organicOnly,
        criteria.maxPriceCents
      );

      const result: ProductSearchResult = {
        products,
        totalCount: data.nbHits,
        query: criteria.query,
        searchTimeMs: Date.now() - startTime
      };

      // Cache the result
      this.searchCache.set(cacheKey, result);

      return result;
    } catch (error) {
      this.logError(`Search failed for query "${criteria.query}"`, error);

      // Return empty result on error
      return {
        products: [],
        totalCount: 0,
        query: criteria.query,
        searchTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get a specific product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    // Check cache first
    const cacheKey = `product:${productId}`;
    const cached = this.productCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = new URL(`${this.endpoints.product}/${productId}`, this.baseUrl);

      const response = await this.fetchWithRateLimit(url.toString(), {
        method: 'GET'
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`DIA product API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as DiaApiProduct;
      const product = this.normalizeProduct(data);

      // Cache the product
      this.productCache.set(cacheKey, product);

      return product;
    } catch (error) {
      this.logError(`Failed to get product ${productId}`, error);
      return null;
    }
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, limit = 50): Promise<readonly Product[]> {
    const cacheKey = `category:${category}:${limit}`;

    // Check cache first
    const cached = this.categoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = new URL(this.endpoints.categoryProducts, this.baseUrl);
      url.searchParams.set('category', category);
      url.searchParams.set('page', '0');
      url.searchParams.set('limit', String(limit));

      const response = await this.fetchWithRateLimit(url.toString(), {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`DIA category API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as DiaCategoryResponse;
      const products = await this.normalizeProducts(data.products);

      // Cache the result
      this.categoryCache.set(cacheKey, products);

      return products;
    } catch (error) {
      this.logError(`Failed to get products for category "${category}"`, error);
      return [];
    }
  }

  /**
   * Get available categories from DIA
   */
  async getCategories(): Promise<readonly DiaCategory[]> {
    try {
      const url = new URL(this.endpoints.categories, this.baseUrl);

      const response = await this.fetchWithRateLimit(url.toString(), {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`DIA categories API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { categories: readonly DiaCategory[] };
      return data.categories;
    } catch (error) {
      this.logError('Failed to get categories', error);
      return [];
    }
  }

  /**
   * Get current promotions from DIA
   */
  override async getPromotions(): Promise<readonly Product[]> {
    try {
      const url = new URL(this.endpoints.home, this.baseUrl);

      const response = await this.fetchWithRateLimit(url.toString(), {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`DIA home API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as DiaHomeResponse;

      // Extract products from promotions
      const promoProducts = data.promotions || [];

      // Also check carousels for promotional content
      const carouselPromos = (data.carousels || [])
        .filter(c => c.type === 'promotion' || c.title.toLowerCase().includes('oferta'))
        .flatMap(c => c.products);

      const allPromos = [...promoProducts, ...carouselPromos];

      // Remove duplicates by ID
      const uniquePromos = Array.from(
        new Map(allPromos.map(p => [p.id, p])).values()
      );

      return this.normalizeProducts(uniquePromos);
    } catch (error) {
      this.logError('Failed to get promotions', error);
      return [];
    }
  }

  // ==========================================================================
  // Data Normalization
  // ==========================================================================

  /**
   * Normalize multiple DIA products to our Product type
   */
  private async normalizeProducts(
    diaProducts: readonly DiaApiProduct[],
    inStockOnly = false,
    organicOnly = false,
    maxPriceCents?: number
  ): Promise<readonly Product[]> {
    let products = diaProducts.map(p => this.normalizeProduct(p));

    // Apply filters
    if (inStockOnly) {
      products = products.filter(p => p.inStock);
    }

    if (organicOnly) {
      products = products.filter(p => p.isOrganic);
    }

    if (maxPriceCents !== undefined) {
      products = products.filter(p => p.price.currentPriceCents <= maxPriceCents);
    }

    return products;
  }

  /**
   * Normalize a single DIA product to our Product type
   */
  private normalizeProduct(diaProduct: DiaApiProduct): Product {
    const price = this.normalizePrice(diaProduct);
    const packageSize = this.normalizePackageSize(diaProduct);
    const category = this.normalizeCategory(diaProduct);
    const promotion = this.normalizePromotion(diaProduct);

    return {
      id: createProductId(`dia-${diaProduct.id}`),
      name: diaProduct.display_name,
      brand: diaProduct.brand,
      description: diaProduct.description,
      price,
      category,
      packageSize,
      imageUrl: diaProduct.images?.[0],
      productUrl: `${this.baseUrl}/compra-online/productos/${diaProduct.slug}`,
      sku: diaProduct.id,
      barcode: diaProduct.ean,
      supermarketId: this.supermarketId,
      inStock: diaProduct.stock?.available ?? true,
      nutrition: undefined, // DIA API doesn't typically include nutrition info
      isOrganic: this.isOrganic(diaProduct),
      isStoreBrand: this.isStoreBrand(diaProduct),
      promotion,
      lastUpdated: new Date()
    };
  }

  /**
   * Normalize price information
   */
  private normalizePrice(diaProduct: DiaApiProduct): PriceInfo {
    const prices = diaProduct.prices;
    const currentPriceCents = Math.round(prices.price * 100);
    const originalPriceCents = prices.strikethrough_price
      ? Math.round(prices.strikethrough_price * 100)
      : undefined;

    return {
      currentPriceCents,
      originalPriceCents,
      currency: 'EUR',
      pricePerUnit: prices.price_per_unit
        ? {
            priceCents: Math.round(prices.price_per_unit * 100),
            unit: this.parseUnit(prices.unit_price || 'kg'),
            display: `${prices.price_per_unit.toFixed(2)}/${prices.unit_price || 'kg'}`
          }
        : undefined,
      includesVat: true
    };
  }

  /**
   * Normalize package size information
   */
  private normalizePackageSize(diaProduct: DiaApiProduct): PackageSize {
    const packaging = diaProduct.packaging;

    if (!packaging) {
      return {
        value: 1,
        unit: 'piece',
        display: '1 ud'
      };
    }

    const value = packaging.quantity || 1;
    const unitStr = packaging.unit || packaging.size || 'ud';
    const unit = this.parseUnit(unitStr);

    return {
      value,
      unit,
      display: `${value}${unitStr}`
    };
  }

  /**
   * Parse unit string to MeasurementUnit
   */
  private parseUnit(unitStr: string): import('@meal-automation/shared').MeasurementUnit {
    const normalized = unitStr.toLowerCase().trim();

    const unitMap: Record<string, import('@meal-automation/shared').MeasurementUnit> = {
      'g': 'g',
      'gr': 'g',
      'gramos': 'g',
      'kg': 'kg',
      'kilo': 'kg',
      'kilos': 'kg',
      'ml': 'ml',
      'cl': 'ml',
      'l': 'l',
      'litro': 'l',
      'litros': 'l',
      'ud': 'piece',
      'uds': 'piece',
      'unidad': 'piece',
      'unidades': 'piece',
      'pieza': 'piece',
      'piezas': 'piece'
    };

    return unitMap[normalized] || 'piece';
  }

  /**
   * Normalize category from DIA categories
   */
  private normalizeCategory(diaProduct: DiaApiProduct): IngredientCategory {
    const categories = diaProduct.categories || [];

    for (const category of categories) {
      const slug = category.slug.toLowerCase();
      const name = category.name.toLowerCase();

      // Check slug first
      if (CATEGORY_MAPPING[slug]) {
        return CATEGORY_MAPPING[slug];
      }

      // Check name
      for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
        if (name.includes(key) || slug.includes(key)) {
          return value;
        }
      }
    }

    return 'other';
  }

  /**
   * Normalize promotion information
   */
  private normalizePromotion(diaProduct: DiaApiProduct): Promotion | undefined {
    const prices = diaProduct.prices;

    if (!prices.strikethrough_price || prices.price >= prices.strikethrough_price) {
      return undefined;
    }

    const savingsCents = Math.round((prices.strikethrough_price - prices.price) * 100);
    const discountPercent = prices.discount_percentage ||
      Math.round((1 - prices.price / prices.strikethrough_price) * 100);

    return {
      type: 'discount' as PromotionType,
      description: `${discountPercent}% de descuento`,
      savingsCents
    };
  }

  /**
   * Check if product is organic
   */
  private isOrganic(diaProduct: DiaApiProduct): boolean {
    const name = diaProduct.display_name.toLowerCase();
    const badges = diaProduct.badges || [];

    return (
      name.includes('eco') ||
      name.includes('bio') ||
      name.includes('ecologico') ||
      name.includes('ecológico') ||
      name.includes('organic') ||
      badges.some(b => b.toLowerCase().includes('eco') || b.toLowerCase().includes('bio'))
    );
  }

  /**
   * Check if product is store brand (DIA brand)
   */
  private isStoreBrand(diaProduct: DiaApiProduct): boolean {
    const brand = (diaProduct.brand || '').toLowerCase();
    const name = diaProduct.display_name.toLowerCase();

    const storeBrands = ['dia', 'dia %', 'basic', 'delicious', 'bonarea'];

    return storeBrands.some(sb => brand.includes(sb) || name.startsWith(sb));
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Build cache key for search criteria
   */
  private buildSearchCacheKey(criteria: ProductSearchCriteria): string {
    return `search:${criteria.query}:${criteria.limit}:${criteria.inStockOnly}:${criteria.organicOnly}:${criteria.maxPriceCents || ''}`;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.productCache.clear();
    this.searchCache.clear();
    this.categoryCache.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new DIA scraper instance
 */
export function createDiaScraper(config?: Partial<BaseScraperConfig>): DiaScraper {
  return new DiaScraper(config);
}

// Export types for consumers
export type { DiaApiProduct, DiaCategory, DiaSearchResponse };
