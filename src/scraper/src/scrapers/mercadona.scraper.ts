/**
 * Mercadona Scraper
 * Production-ready scraper for Mercadona supermarket using their unofficial API
 */

import type {
  Product,
  ProductId,
  ProductSearchCriteria,
  ProductSearchResult,
  SupermarketId,
  PackageSize,
  PriceInfo,
  IngredientCategory,
  MeasurementUnit
} from '@meal-automation/shared';
import { createProductId, createSupermarketId } from '@meal-automation/shared';
import { BaseScraper, type BaseScraperConfig } from './base.scraper.js';

// ============================================================================
// Types for Mercadona API Responses
// ============================================================================

/**
 * Mercadona category from API
 */
export interface MercadonaCategory {
  readonly id: number;
  readonly name: string;
  readonly categories?: readonly MercadonaCategory[];
}

/**
 * Mercadona product from API
 */
export interface MercadonaProduct {
  readonly id: string;
  readonly slug: string;
  readonly limit: number;
  readonly ean: string;
  readonly display_name: string;
  readonly packaging: string;
  readonly published: boolean;
  readonly share_url: string;
  readonly thumbnail: string;
  readonly price_instructions: MercadonaPriceInstructions;
  readonly photos: readonly MercadonaPhoto[];
  readonly categories: readonly MercadonaCategoryRef[];
  readonly nutrition_information?: MercadonaNutrition;
  readonly origin?: string;
  readonly brand?: string;
  readonly is_variable_weight?: boolean;
  readonly details?: MercadonaProductDetails;
}

interface MercadonaPriceInstructions {
  readonly iva: number;
  readonly is_new: boolean;
  readonly is_pack: boolean;
  readonly pack_size?: number;
  readonly unit_name: string;
  readonly unit_size: number;
  readonly bulk_price: string;
  readonly unit_price: string;
  readonly approx_size: boolean;
  readonly size_format: string;
  readonly total_units?: number;
  readonly unit_selector: boolean;
  readonly bunch_selector: boolean;
  readonly drained_weight?: number;
  readonly selling_method: number;
  readonly price_decreased: boolean;
  readonly reference_price: string;
  readonly min_bunch_amount: number;
  readonly reference_format: string;
  readonly previous_unit_price?: string;
  readonly increment_bunch_amount: number;
}

interface MercadonaPhoto {
  readonly zoom: string;
  readonly regular: string;
  readonly thumbnail: string;
  readonly perspective: number;
}

interface MercadonaCategoryRef {
  readonly id: number;
  readonly name: string;
  readonly level: number;
}

interface MercadonaNutrition {
  readonly per_hundred?: string;
  readonly per_unit?: string;
  readonly allergens?: MercadonaAllergen[];
}

interface MercadonaAllergen {
  readonly name: string;
  readonly value: boolean;
}

interface MercadonaProductDetails {
  readonly counter_info?: string;
  readonly danger_mentions?: string;
  readonly alcohol_by_volume?: number;
}

/**
 * API response for categories listing
 */
interface MercadonaCategoriesResponse {
  readonly results: readonly MercadonaCategory[];
}

/**
 * API response for products in a category
 */
interface MercadonaCategoryProductsResponse {
  readonly id: number;
  readonly name: string;
  readonly categories?: readonly MercadonaSubcategoryWithProducts[];
}

interface MercadonaSubcategoryWithProducts {
  readonly id: number;
  readonly name: string;
  readonly products: readonly MercadonaProduct[];
  readonly categories?: readonly MercadonaSubcategoryWithProducts[];
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
class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 3600000) { // Default 1 hour
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Mercadona Scraper Implementation
// ============================================================================

/**
 * Configuration for Mercadona scraper
 */
export interface MercadonaScraperConfig extends Partial<BaseScraperConfig> {
  /** Warehouse ID for location-specific pricing (default: mad1 for Madrid) */
  readonly warehouseId?: string;

  /** Cache TTL in milliseconds (default: 1 hour) */
  readonly cacheTtlMs?: number;

  /** Postal code for delivery zone */
  readonly postalCode?: string;
}

/**
 * Mercadona scraper using their unofficial REST API
 */
export class MercadonaScraper extends BaseScraper {
  private readonly apiBaseUrl = 'https://tienda.mercadona.es/api';
  private readonly warehouseId: string;
  private readonly cache: ResponseCache;
  private readonly postalCode?: string;
  private categoriesCache: readonly MercadonaCategory[] | null = null;

  constructor(config: MercadonaScraperConfig = {}) {
    super({
      supermarketId: createSupermarketId('mercadona'),
      baseUrl: 'https://tienda.mercadona.es',
      rateLimit: {
        requestsPerSecond: 0.33, // 1 request every 3 seconds
        maxConcurrent: 1,
        batchDelayMs: 3000
      },
      retry: {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        exponentialBackoff: true
      },
      timeoutMs: 30000,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Origin': 'https://tienda.mercadona.es',
        'Referer': 'https://tienda.mercadona.es/',
        ...config.headers
      },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    });

    this.warehouseId = config.warehouseId ?? 'mad1';
    this.cache = new ResponseCache(config.cacheTtlMs ?? 3600000);
    this.postalCode = config.postalCode;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Search for products matching the criteria
   */
  async searchProducts(criteria: ProductSearchCriteria): Promise<ProductSearchResult> {
    const startTime = Date.now();
    const products: Product[] = [];

    try {
      // Mercadona API doesn't have a direct search endpoint
      // We need to search through categories
      const categories = await this.getCategories();

      for (const category of categories) {
        if (products.length >= criteria.limit) break;

        const categoryProducts = await this.getProductsByCategoryId(category.id.toString());

        for (const product of categoryProducts) {
          if (products.length >= criteria.limit) break;

          // Match against query
          if (this.matchesQuery(product, criteria.query)) {
            // Apply filters
            if (this.passesFilters(product, criteria)) {
              products.push(product);
            }
          }
        }
      }

      // Sort results
      const sortedProducts = this.sortProducts(products, criteria.sortBy);

      return {
        products: sortedProducts.slice(0, criteria.limit),
        totalCount: sortedProducts.length,
        query: criteria.query,
        searchTimeMs: Date.now() - startTime
      };
    } catch (error) {
      this.logError('Search failed', error);
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
    const cacheKey = `product:${productId}`;
    const cached = this.cache.get<Product>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.apiBaseUrl}/products/${productId}/?lang=es&wh=${this.warehouseId}`;
      const response = await this.fetchWithRateLimit(url);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as MercadonaProduct;
      const product = this.transformProduct(data);

      this.cache.set(cacheKey, product);
      return product;
    } catch (error) {
      this.logError(`Failed to get product ${productId}`, error);
      return null;
    }
  }

  /**
   * Get products by category name
   */
  async getProductsByCategory(category: string, limit = 50): Promise<readonly Product[]> {
    try {
      const categories = await this.getCategories();

      // Find matching category by name
      const matchingCategory = this.findCategoryByName(categories, category);
      if (!matchingCategory) {
        return [];
      }

      return this.getProductsByCategoryId(matchingCategory.id.toString(), limit);
    } catch (error) {
      this.logError(`Failed to get products for category ${category}`, error);
      return [];
    }
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<readonly MercadonaCategory[]> {
    if (this.categoriesCache) return this.categoriesCache;

    const cacheKey = 'categories';
    const cached = this.cache.get<readonly MercadonaCategory[]>(cacheKey);
    if (cached) {
      this.categoriesCache = cached;
      return cached;
    }

    try {
      const url = `${this.apiBaseUrl}/categories/?lang=es&wh=${this.warehouseId}`;
      const response = await this.fetchWithRateLimit(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as MercadonaCategoriesResponse;
      const categories = data.results;

      this.cache.set(cacheKey, categories);
      this.categoriesCache = categories;
      return categories;
    } catch (error) {
      this.logError('Failed to fetch categories', error);
      return [];
    }
  }

  /**
   * Get current promotions (products with price decrease)
   */
  async getPromotions(): Promise<readonly Product[]> {
    const allProducts: Product[] = [];

    try {
      const categories = await this.getCategories();

      for (const category of categories.slice(0, 5)) { // Limit to avoid excessive requests
        const products = await this.getProductsByCategoryId(category.id.toString());
        allProducts.push(...products);
      }

      // Filter for products with promotions
      return allProducts.filter(p => p.promotion !== undefined);
    } catch (error) {
      this.logError('Failed to fetch promotions', error);
      return [];
    }
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Get products by category ID
   */
  private async getProductsByCategoryId(categoryId: string, limit = 100): Promise<Product[]> {
    const cacheKey = `category:${categoryId}`;
    const cached = this.cache.get<Product[]>(cacheKey);
    if (cached) return cached.slice(0, limit);

    try {
      const url = `${this.apiBaseUrl}/categories/${categoryId}/?lang=es&wh=${this.warehouseId}`;
      const response = await this.fetchWithRateLimit(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as MercadonaCategoryProductsResponse;
      const products = this.extractProductsFromCategory(data);
      const transformedProducts = products.map(p => this.transformProduct(p));

      this.cache.set(cacheKey, transformedProducts);
      return transformedProducts.slice(0, limit);
    } catch (error) {
      this.logError(`Failed to fetch category ${categoryId}`, error);
      return [];
    }
  }

  /**
   * Extract all products from category response (including nested subcategories)
   */
  private extractProductsFromCategory(category: MercadonaCategoryProductsResponse): MercadonaProduct[] {
    const products: MercadonaProduct[] = [];

    const extractFromSubcategories = (subcategories?: readonly MercadonaSubcategoryWithProducts[]) => {
      if (!subcategories) return;

      for (const sub of subcategories) {
        if (sub.products) {
          products.push(...sub.products);
        }
        if (sub.categories) {
          extractFromSubcategories(sub.categories);
        }
      }
    };

    extractFromSubcategories(category.categories);
    return products;
  }

  /**
   * Transform Mercadona API product to our Product type
   */
  private transformProduct(mercadonaProduct: MercadonaProduct): Product {
    const priceInstructions = mercadonaProduct.price_instructions;
    const currentPriceCents = Math.round(parseFloat(priceInstructions.unit_price) * 100);
    const hasPromotion = priceInstructions.price_decreased && priceInstructions.previous_unit_price;

    const originalPriceCents = hasPromotion && priceInstructions.previous_unit_price
      ? Math.round(parseFloat(priceInstructions.previous_unit_price) * 100)
      : undefined;

    // Parse reference price (price per kg/L)
    const referencePrice = parseFloat(priceInstructions.reference_price);
    const referencePriceCents = isNaN(referencePrice) ? undefined : Math.round(referencePrice * 100);

    // Determine category
    const category = this.mapCategory(mercadonaProduct.categories);

    // Parse package size
    const packageSize = this.parsePackageSize(priceInstructions);

    const price: PriceInfo = {
      currentPriceCents,
      originalPriceCents,
      currency: 'EUR',
      pricePerUnit: referencePriceCents ? {
        priceCents: referencePriceCents,
        unit: this.mapReferenceUnit(priceInstructions.reference_format),
        display: `${priceInstructions.reference_price} EUR/${priceInstructions.reference_format}`
      } : undefined,
      includesVat: true // Spanish prices include IVA
    };

    const product: Product = {
      id: createProductId(`merc-${mercadonaProduct.id}`),
      name: mercadonaProduct.display_name,
      brand: this.extractBrand(mercadonaProduct),
      description: mercadonaProduct.packaging,
      price,
      category,
      packageSize,
      imageUrl: mercadonaProduct.photos[0]?.regular ?? mercadonaProduct.thumbnail,
      productUrl: mercadonaProduct.share_url || `https://tienda.mercadona.es/product/${mercadonaProduct.id}`,
      sku: mercadonaProduct.id,
      barcode: mercadonaProduct.ean,
      supermarketId: this.supermarketId,
      inStock: mercadonaProduct.published,
      nutrition: this.transformNutrition(mercadonaProduct.nutrition_information),
      isOrganic: this.isOrganic(mercadonaProduct),
      isStoreBrand: this.isStoreBrand(mercadonaProduct),
      promotion: hasPromotion && originalPriceCents ? {
        type: 'discount',
        description: 'Precio rebajado',
        savingsCents: originalPriceCents - currentPriceCents
      } : undefined,
      lastUpdated: new Date()
    };

    return product;
  }

  /**
   * Parse package size from price instructions
   */
  private parsePackageSize(priceInstructions: MercadonaPriceInstructions): PackageSize {
    const sizeFormat = priceInstructions.size_format;
    const unitSize = priceInstructions.unit_size;
    const unitName = priceInstructions.unit_name.toLowerCase();

    // Parse the size format (e.g., "1 kg", "500 g", "1 L")
    const match = sizeFormat.match(/^([\d.,]+)\s*(\w+)$/);

    if (match) {
      const value = parseFloat(match[1].replace(',', '.'));
      const unit = this.mapUnit(match[2]);

      return {
        value,
        unit,
        display: sizeFormat
      };
    }

    // Fallback to unit_size and unit_name
    return {
      value: unitSize,
      unit: this.mapUnit(unitName),
      display: sizeFormat || `${unitSize} ${unitName}`
    };
  }

  /**
   * Map Mercadona unit to our MeasurementUnit
   */
  private mapUnit(unit: string): MeasurementUnit {
    const unitLower = unit.toLowerCase();
    const unitMap: Record<string, MeasurementUnit> = {
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
      'unidades': 'piece'
    };

    return unitMap[unitLower] ?? 'piece';
  }

  /**
   * Map reference format to MeasurementUnit
   */
  private mapReferenceUnit(format: string): MeasurementUnit {
    const formatLower = format.toLowerCase();
    if (formatLower.includes('kg') || formatLower.includes('kilo')) return 'kg';
    if (formatLower.includes('l') || formatLower.includes('litro')) return 'l';
    if (formatLower.includes('g')) return 'g';
    if (formatLower.includes('ml')) return 'ml';
    return 'piece';
  }

  /**
   * Map Mercadona categories to our IngredientCategory
   */
  private mapCategory(categories: readonly MercadonaCategoryRef[]): IngredientCategory {
    if (categories.length === 0) return 'other';

    const topCategory = categories[0]?.name.toLowerCase() ?? '';
    const categoryMap: Record<string, IngredientCategory> = {
      'frescos': 'produce',
      'frutas': 'produce',
      'verduras': 'produce',
      'hortalizas': 'produce',
      'carniceria': 'meat',
      'carne': 'meat',
      'charcuteria': 'meat',
      'pescaderia': 'seafood',
      'pescado': 'seafood',
      'marisco': 'seafood',
      'lacteos': 'dairy',
      'leche': 'dairy',
      'quesos': 'dairy',
      'yogures': 'dairy',
      'huevos': 'dairy',
      'pan': 'bakery',
      'panaderia': 'bakery',
      'bolleria': 'bakery',
      'pasteleria': 'bakery',
      'congelados': 'frozen',
      'conservas': 'canned',
      'despensa': 'dry_goods',
      'pasta': 'dry_goods',
      'arroz': 'dry_goods',
      'legumbres': 'dry_goods',
      'cereales': 'dry_goods',
      'aceites': 'condiments',
      'salsas': 'condiments',
      'especias': 'spices',
      'condimentos': 'spices',
      'bebidas': 'beverages',
      'agua': 'beverages',
      'refrescos': 'beverages',
      'zumos': 'beverages',
      'vinos': 'beverages',
      'cervezas': 'beverages'
    };

    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (topCategory.includes(keyword)) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Extract brand from product
   */
  private extractBrand(product: MercadonaProduct): string | undefined {
    if (product.brand) return product.brand;

    // Common Mercadona store brands
    const storeBrands = ['hacendado', 'deliplus', 'bosque verde', 'compy'];
    const nameLower = product.display_name.toLowerCase();

    for (const brand of storeBrands) {
      if (nameLower.includes(brand)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }

    return undefined;
  }

  /**
   * Check if product is organic
   */
  private isOrganic(product: MercadonaProduct): boolean {
    const keywords = ['ecologico', 'eco', 'bio', 'organico'];
    const nameLower = product.display_name.toLowerCase();
    return keywords.some(k => nameLower.includes(k));
  }

  /**
   * Check if product is store brand
   */
  private isStoreBrand(product: MercadonaProduct): boolean {
    const storeBrands = ['hacendado', 'deliplus', 'bosque verde', 'compy', 'brillante'];
    const nameLower = product.display_name.toLowerCase();
    return storeBrands.some(b => nameLower.includes(b));
  }

  /**
   * Transform nutrition information
   */
  private transformNutrition(nutrition?: MercadonaNutrition) {
    if (!nutrition) return undefined;

    // Mercadona provides nutrition as free text, parsing would be complex
    // Return undefined for now - could be enhanced with text parsing
    return undefined;
  }

  /**
   * Find category by name (case-insensitive, partial match)
   */
  private findCategoryByName(
    categories: readonly MercadonaCategory[],
    name: string
  ): MercadonaCategory | null {
    const nameLower = name.toLowerCase();

    for (const category of categories) {
      if (category.name.toLowerCase().includes(nameLower)) {
        return category;
      }
      if (category.categories) {
        const found = this.findCategoryByName(category.categories, name);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Check if product matches search query
   */
  private matchesQuery(product: Product, query: string): boolean {
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/);

    const searchableText = [
      product.name,
      product.brand,
      product.description
    ].filter(Boolean).join(' ').toLowerCase();

    // All terms must match
    return terms.every(term => searchableText.includes(term));
  }

  /**
   * Check if product passes search filters
   */
  private passesFilters(product: Product, criteria: ProductSearchCriteria): boolean {
    if (criteria.inStockOnly && !product.inStock) return false;
    if (criteria.organicOnly && !product.isOrganic) return false;
    if (criteria.promotionsOnly && !product.promotion) return false;
    if (criteria.maxPriceCents && product.price.currentPriceCents > criteria.maxPriceCents) return false;
    if (criteria.category && product.category !== criteria.category) return false;

    return true;
  }

  /**
   * Sort products based on sort option
   */
  private sortProducts(products: Product[], sortBy: ProductSearchCriteria['sortBy']): Product[] {
    const sorted = [...products];

    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => a.price.currentPriceCents - b.price.currentPriceCents);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.price.currentPriceCents - a.price.currentPriceCents);
        break;
      case 'price_per_unit_asc':
        sorted.sort((a, b) => {
          const aPrice = a.price.pricePerUnit?.priceCents ?? a.price.currentPriceCents;
          const bPrice = b.price.pricePerUnit?.priceCents ?? b.price.currentPriceCents;
          return aPrice - bPrice;
        });
        break;
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        break;
      case 'relevance':
      default:
        // Keep original order (relevance is determined by search)
        break;
    }

    return sorted;
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
    this.categoriesCache = null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return { size: this.cache.size() };
  }
}

/**
 * Factory function to create a Mercadona scraper with default configuration
 */
export function createMercadonaScraper(config?: MercadonaScraperConfig): MercadonaScraper {
  return new MercadonaScraper(config);
}
