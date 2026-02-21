/**
 * Supermarket Integration Types
 * Core interfaces for the multi-supermarket adapter architecture
 */

// Available supermarket identifiers
export type SupermarketId = 'mercadona' | 'carrefour' | 'dia' | 'alcampo' | 'eroski' | 'lidl';

// Unit types for product measurements
export type ProductUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pack';

/**
 * Normalized product structure - unified format across all supermarkets
 */
export interface NormalizedProduct {
  id: string;                     // Internal ID
  externalId: string;             // ID in the original supermarket system
  supermarket: SupermarketId;     // Source supermarket
  name: string;                   // Product name
  description?: string;           // Optional description
  brand?: string;                 // Brand name if available
  price: number;                  // Price in euros
  pricePerUnit: number;           // Price per kg/l/unit
  unit: ProductUnit;              // Unit of measurement
  size: number;                   // Quantity (e.g., 1, 0.5, 500)
  sizeFormat: string;             // Original format string (e.g., "500g", "1L")
  category: string;               // Primary category
  subcategory?: string;           // Optional subcategory
  imageUrl?: string;              // Product image URL
  thumbnailUrl?: string;          // Smaller image for lists
  available: boolean;             // In stock status
  lastUpdated: Date;              // When the data was last fetched
  nutritionInfo?: NutritionInfo;  // Optional nutrition data
  metadata?: Record<string, unknown>; // Extra supermarket-specific data
}

/**
 * Nutrition information per 100g/100ml
 */
export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  salt?: number;
}

/**
 * Product category structure
 */
export interface Category {
  id: string;
  externalId: string;
  name: string;
  supermarket: SupermarketId;
  parentId?: string;              // For subcategories
  imageUrl?: string;
  productCount?: number;
  children?: Category[];          // Nested subcategories
}

/**
 * Search options for product queries
 */
export interface SearchOptions {
  limit?: number;                 // Max results (default: 20)
  offset?: number;                // Pagination offset
  categoryId?: string;            // Filter by category
  minPrice?: number;              // Min price filter
  maxPrice?: number;              // Max price filter
  sortBy?: 'price' | 'name' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result of a search operation with pagination info
 */
export interface SearchResult {
  products: NormalizedProduct[];
  total: number;
  hasMore: boolean;
  query: string;
  options: SearchOptions;
}

/**
 * Supermarket adapter interface - all adapters must implement this
 */
export interface SupermarketAdapter {
  readonly id: SupermarketId;
  readonly name: string;
  readonly baseUrl: string;
  readonly logoUrl?: string;
  
  /**
   * Search products by query string
   */
  searchProducts(query: string, options?: SearchOptions): Promise<SearchResult>;
  
  /**
   * Get a single product by its external ID
   */
  getProduct(externalId: string): Promise<NormalizedProduct | null>;
  
  /**
   * Get all top-level categories
   */
  getCategories(): Promise<Category[]>;
  
  /**
   * Get products within a specific category
   */
  getProductsByCategory(categoryId: string, options?: SearchOptions): Promise<SearchResult>;
  
  /**
   * Check if the adapter/API is currently available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Check if a postal code is covered for delivery
   */
  checkPostalCodeCoverage?(postalCode: string): Promise<boolean>;
}

/**
 * Adapter configuration options
 */
export interface AdapterConfig {
  postalCode?: string;            // User's postal code for availability
  timeout?: number;               // Request timeout in ms (default: 10000)
  maxRetries?: number;            // Max retry attempts (default: 3)
  cacheEnabled?: boolean;         // Enable caching (default: true)
}

/**
 * Price comparison result for an ingredient
 */
export interface IngredientPriceResult {
  ingredientName: string;
  matchedProducts: Array<{
    product: NormalizedProduct;
    confidence: number;           // 0-1 match confidence score
    supermarket: SupermarketId;
  }>;
  bestPrice?: {
    product: NormalizedProduct;
    supermarket: SupermarketId;
  };
  estimatedPrice?: number;        // Fallback estimated price if no matches
  hasRealPrice: boolean;          // True if we have real supermarket prices
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTTL: number;             // Default TTL in milliseconds
  productTTL: number;             // TTL for product data (default: 24h)
  categoryTTL: number;            // TTL for category data (default: 7d)
  searchTTL: number;              // TTL for search results (default: 1h)
}

/**
 * Error types for the supermarket service
 */
export class SupermarketError extends Error {
  constructor(
    message: string,
    public readonly supermarket: SupermarketId,
    public readonly code: SupermarketErrorCode,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SupermarketError';
  }
}

export type SupermarketErrorCode =
  | 'ADAPTER_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_POSTAL_CODE'
  | 'PRODUCT_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'PARSE_ERROR'
  | 'TIMEOUT';
