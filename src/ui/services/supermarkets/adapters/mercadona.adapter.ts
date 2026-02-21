/**
 * Mercadona Adapter
 * Implements SupermarketAdapter for Mercadona's public API
 * 
 * API Base: https://tienda.mercadona.es/api/
 * 
 * Endpoints:
 * - GET /categories/ - List all categories
 * - GET /categories/{id}/ - Category with products
 * - GET /products/{id}/ - Product details
 * 
 * Note: Requires a valid postal code to be set
 */

import { BaseAdapter } from './base.adapter';
import {
  SupermarketId,
  NormalizedProduct,
  Category,
  SearchOptions,
  SearchResult,
  AdapterConfig,
  SupermarketError,
  ProductUnit,
} from '../types';

// Mercadona API response types
interface MercadonaCategory {
  id: number;
  name: string;
  categories?: MercadonaCategory[];
  products?: MercadonaProduct[];
}

interface MercadonaProduct {
  id: string;
  slug?: string;
  display_name: string;
  ean?: string;
  packaging?: string;
  price_instructions?: {
    unit_price: number;
    unit_size: number;
    bulk_price?: number;
    reference_price?: number;
    reference_format?: string;
    is_new?: boolean;
    is_pack?: boolean;
    total_units?: number;
    iva?: number;
  };
  photos?: Array<{
    zoom: string;
    regular: string;
    thumbnail: string;
  }>;
  details?: {
    brand?: string;
    origin?: string;
    description?: string;
    nutrition_information?: {
      energy_value?: string;
      protein?: string;
      carbohydrate?: string;
      fat?: string;
      fiber?: string;
      salt?: string;
      sugar?: string;
    };
  };
  categories?: Array<{
    id: number;
    name: string;
  }>;
  published?: boolean;
  share_url?: string;
}

interface MercadonaCategoriesResponse {
  results: MercadonaCategory[];
}

/**
 * Mercadona Adapter Implementation
 */
export class MercadonaAdapter extends BaseAdapter {
  readonly id: SupermarketId = 'mercadona';
  readonly name = 'Mercadona';
  readonly baseUrl = 'https://tienda.mercadona.es/api';
  readonly logoUrl = 'https://tienda.mercadona.es/static/media/logo.svg';

  // Cache for category hierarchy (to support search)
  private categoryCache: Map<string, MercadonaCategory> = new Map();
  private allProductsCache: MercadonaProduct[] = [];
  private lastCacheTime: number = 0;
  private cacheDuration: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(config?: AdapterConfig) {
    super(config);
  }

  /**
   * Get headers required for Mercadona API
   */
  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
  }

  /**
   * Get all categories from Mercadona
   */
  async getCategories(): Promise<Category[]> {
    try {
      const url = `${this.baseUrl}/categories/`;
      const response = await this.fetchWithRetry<MercadonaCategoriesResponse>(url, {
        headers: this.getHeaders(),
      });

      // Cache categories
      this.cacheCategories(response.results);

      return this.normalizeCategories(response.results);
    } catch (error) {
      if (error instanceof SupermarketError) {
        throw error;
      }
      throw new SupermarketError(
        `Failed to fetch categories: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.id,
        'NETWORK_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a single product by ID
   */
  async getProduct(externalId: string): Promise<NormalizedProduct | null> {
    try {
      const url = `${this.baseUrl}/products/${externalId}/`;
      const product = await this.fetchWithRetry<MercadonaProduct>(url, {
        headers: this.getHeaders(),
      });

      if (!product || !product.id) {
        return null;
      }

      return this.normalizeProduct(product);
    } catch (error) {
      if (error instanceof SupermarketError && error.code === 'NETWORK_ERROR') {
        // Product not found returns 404
        return null;
      }
      throw error;
    }
  }

  /**
   * Get products by category ID
   */
  async getProductsByCategory(categoryId: string, options?: SearchOptions): Promise<SearchResult> {
    try {
      const url = `${this.baseUrl}/categories/${categoryId}/`;
      const category = await this.fetchWithRetry<MercadonaCategory>(url, {
        headers: this.getHeaders(),
      });

      const opts = this.mergeSearchOptions(options);
      const allProducts = this.extractProductsFromCategory(category);
      
      // Apply filters and pagination
      let filtered = allProducts;
      
      if (opts.minPrice > 0) {
        filtered = filtered.filter(p => (p.price_instructions?.unit_price ?? 0) >= opts.minPrice);
      }
      if (opts.maxPrice < Infinity) {
        filtered = filtered.filter(p => (p.price_instructions?.unit_price ?? 0) <= opts.maxPrice);
      }

      // Sort
      filtered = this.sortProducts(filtered, opts.sortBy, opts.sortOrder);

      // Paginate
      const start = opts.offset;
      const end = start + opts.limit;
      const paginated = filtered.slice(start, end);

      return {
        products: paginated.map(p => this.normalizeProduct(p)),
        total: filtered.length,
        hasMore: end < filtered.length,
        query: '',
        options: opts,
      };
    } catch (error) {
      if (error instanceof SupermarketError) {
        throw error;
      }
      throw new SupermarketError(
        `Failed to fetch category products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.id,
        'CATEGORY_NOT_FOUND',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search products by query
   * Note: Mercadona API doesn't have a direct search endpoint,
   * so we fetch categories and search locally
   */
  async searchProducts(query: string, options?: SearchOptions): Promise<SearchResult> {
    const opts = this.mergeSearchOptions(options);
    
    try {
      // Ensure we have products cached
      await this.ensureProductsCached();

      // Normalize query for matching
      const normalizedQuery = this.normalizeSearchQuery(query);
      const queryWords = normalizedQuery.split(/\s+/);

      // Search through cached products
      const matches = this.allProductsCache.filter(product => {
        const productName = this.normalizeSearchQuery(product.display_name);
        const productBrand = this.normalizeSearchQuery(product.details?.brand || '');
        const searchText = `${productName} ${productBrand}`;
        
        // All query words must be present
        return queryWords.every(word => searchText.includes(word));
      });

      // Sort by relevance (exact matches first)
      const scored = matches.map(product => {
        const productName = this.normalizeSearchQuery(product.display_name);
        let score = 0;
        
        // Exact match bonus
        if (productName === normalizedQuery) score += 100;
        // Starts with query bonus
        if (productName.startsWith(normalizedQuery)) score += 50;
        // Word order bonus
        if (productName.includes(normalizedQuery)) score += 25;
        
        return { product, score };
      });

      scored.sort((a, b) => b.score - a.score);

      // Apply price filters
      let filtered = scored.map(s => s.product);
      
      if (opts.minPrice > 0) {
        filtered = filtered.filter(p => (p.price_instructions?.unit_price ?? 0) >= opts.minPrice);
      }
      if (opts.maxPrice < Infinity) {
        filtered = filtered.filter(p => (p.price_instructions?.unit_price ?? 0) <= opts.maxPrice);
      }

      // Paginate
      const start = opts.offset;
      const end = start + opts.limit;
      const paginated = filtered.slice(start, end);

      return {
        products: paginated.map(p => this.normalizeProduct(p)),
        total: filtered.length,
        hasMore: end < filtered.length,
        query,
        options: opts,
      };
    } catch (error) {
      if (error instanceof SupermarketError) {
        throw error;
      }
      throw new SupermarketError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.id,
        'NETWORK_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a postal code is covered
   */
  async checkPostalCodeCoverage(postalCode: string): Promise<boolean> {
    // Mercadona covers most of Spain
    // In a real implementation, we'd check their delivery zone API
    const spanishPostalCodeRegex = /^[0-4][0-9]{4}$/;
    return spanishPostalCodeRegex.test(postalCode);
  }

  // ==================== Private helper methods ====================

  /**
   * Cache categories for later search
   */
  private cacheCategories(categories: MercadonaCategory[]): void {
    for (const cat of categories) {
      this.categoryCache.set(String(cat.id), cat);
      if (cat.categories) {
        this.cacheCategories(cat.categories);
      }
    }
  }

  /**
   * Ensure we have products cached for search
   */
  private async ensureProductsCached(): Promise<void> {
    const now = Date.now();
    if (this.allProductsCache.length > 0 && now - this.lastCacheTime < this.cacheDuration) {
      return; // Cache is still valid
    }

    // Fetch all categories to get products
    const categories = await this.getCategories();
    const products: MercadonaProduct[] = [];

    // Fetch products from each top-level category
    for (const cat of categories.slice(0, 20)) { // Limit to avoid too many requests
      try {
        const url = `${this.baseUrl}/categories/${cat.externalId}/`;
        const catData = await this.fetchWithRetry<MercadonaCategory>(url, {
          headers: this.getHeaders(),
        });
        const catProducts = this.extractProductsFromCategory(catData);
        products.push(...catProducts);
      } catch {
        // Skip categories that fail
        continue;
      }
    }

    this.allProductsCache = products;
    this.lastCacheTime = now;
  }

  /**
   * Extract all products from a category (including nested)
   */
  private extractProductsFromCategory(category: MercadonaCategory): MercadonaProduct[] {
    const products: MercadonaProduct[] = [];
    
    if (category.products) {
      products.push(...category.products);
    }
    
    if (category.categories) {
      for (const subcat of category.categories) {
        products.push(...this.extractProductsFromCategory(subcat));
      }
    }
    
    return products;
  }

  /**
   * Normalize Mercadona categories to our format
   */
  private normalizeCategories(categories: MercadonaCategory[], parentId?: string): Category[] {
    return categories.map(cat => ({
      id: this.generateId(String(cat.id)),
      externalId: String(cat.id),
      name: cat.name,
      supermarket: this.id,
      parentId,
      children: cat.categories 
        ? this.normalizeCategories(cat.categories, String(cat.id))
        : undefined,
    }));
  }

  /**
   * Normalize a Mercadona product to our format
   */
  private normalizeProduct(product: MercadonaProduct): NormalizedProduct {
    const price = product.price_instructions?.unit_price ?? 0;
    const pricePerUnit = product.price_instructions?.reference_price ?? price;
    const { size, unit, sizeFormat } = this.parsePackaging(product.packaging);

    return {
      id: this.generateId(product.id),
      externalId: product.id,
      supermarket: this.id,
      name: product.display_name,
      description: product.details?.description,
      brand: product.details?.brand,
      price,
      pricePerUnit,
      unit,
      size,
      sizeFormat,
      category: product.categories?.[0]?.name || 'Sin categoría',
      subcategory: product.categories?.[1]?.name,
      imageUrl: product.photos?.[0]?.zoom || product.photos?.[0]?.regular,
      thumbnailUrl: product.photos?.[0]?.thumbnail,
      available: product.published !== false,
      lastUpdated: new Date(),
      nutritionInfo: this.parseNutrition(product.details?.nutrition_information),
      metadata: {
        ean: product.ean,
        shareUrl: product.share_url,
        isNew: product.price_instructions?.is_new,
        isPack: product.price_instructions?.is_pack,
        totalUnits: product.price_instructions?.total_units,
      },
    };
  }

  /**
   * Parse packaging string to extract size and unit
   */
  private parsePackaging(packaging?: string): { size: number; unit: ProductUnit; sizeFormat: string } {
    if (!packaging) {
      return { size: 1, unit: 'unit', sizeFormat: '1 ud' };
    }

    const sizeFormat = packaging;

    // Try to match common patterns
    const kgMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
    if (kgMatch) {
      return { size: parseFloat(kgMatch[1].replace(',', '.')), unit: 'kg', sizeFormat };
    }

    const gMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*g(?:r)?/i);
    if (gMatch) {
      return { size: parseFloat(gMatch[1].replace(',', '.')), unit: 'g', sizeFormat };
    }

    const lMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*l(?:itro)?/i);
    if (lMatch) {
      return { size: parseFloat(lMatch[1].replace(',', '.')), unit: 'l', sizeFormat };
    }

    const mlMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
    if (mlMatch) {
      return { size: parseFloat(mlMatch[1].replace(',', '.')), unit: 'ml', sizeFormat };
    }

    const unitMatch = packaging.match(/(\d+)\s*(?:ud|unid|unidades?)/i);
    if (unitMatch) {
      return { size: parseInt(unitMatch[1], 10), unit: 'unit', sizeFormat };
    }

    const packMatch = packaging.match(/pack\s*(?:de\s*)?(\d+)/i);
    if (packMatch) {
      return { size: parseInt(packMatch[1], 10), unit: 'pack', sizeFormat };
    }

    return { size: 1, unit: 'unit', sizeFormat };
  }

  /**
   * Parse nutrition information
   */
  private parseNutrition(nutrition?: {
    energy_value?: string;
    protein?: string;
    carbohydrate?: string;
    fat?: string;
    fiber?: string;
    salt?: string;
    sugar?: string;
  }): NormalizedProduct['nutritionInfo'] {
    if (!nutrition) return undefined;

    const parseValue = (value?: string): number | undefined => {
      if (!value) return undefined;
      const match = value.match(/(\d+(?:[.,]\d+)?)/);
      return match ? parseFloat(match[1].replace(',', '.')) : undefined;
    };

    return {
      calories: parseValue(nutrition.energy_value),
      protein: parseValue(nutrition.protein),
      carbohydrates: parseValue(nutrition.carbohydrate),
      fat: parseValue(nutrition.fat),
      fiber: parseValue(nutrition.fiber),
      sugar: parseValue(nutrition.sugar),
      salt: parseValue(nutrition.salt),
    };
  }

  /**
   * Normalize search query for matching
   */
  private normalizeSearchQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .trim();
  }

  /**
   * Sort products by specified criteria
   */
  private sortProducts(
    products: MercadonaProduct[],
    sortBy: 'price' | 'name' | 'relevance',
    order: 'asc' | 'desc'
  ): MercadonaProduct[] {
    const sorted = [...products];
    const multiplier = order === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'price':
        sorted.sort((a, b) => 
          multiplier * ((a.price_instructions?.unit_price ?? 0) - (b.price_instructions?.unit_price ?? 0))
        );
        break;
      case 'name':
        sorted.sort((a, b) => 
          multiplier * a.display_name.localeCompare(b.display_name)
        );
        break;
      // 'relevance' maintains original order
    }

    return sorted;
  }
}
