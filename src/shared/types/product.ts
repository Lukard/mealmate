/**
 * Product Types
 * Types for supermarket products, matching, and pricing
 */

import type { IngredientCategory, MeasurementUnit } from './meal.js';
import type { SupermarketId } from './supermarket.js';

/** Unique identifier for products */
export type ProductId = string & { readonly __brand: 'ProductId' };

/** Unique identifier for product matches */
export type ProductMatchId = string & { readonly __brand: 'ProductMatchId' };

/**
 * A product available at a supermarket
 */
export interface Product {
  /** Unique identifier */
  readonly id: ProductId;

  /** Product name as displayed by the supermarket */
  readonly name: string;

  /** Product brand (if applicable) */
  readonly brand?: string;

  /** Product description */
  readonly description?: string;

  /** Current price */
  readonly price: PriceInfo;

  /** Product category */
  readonly category: IngredientCategory;

  /** Package size/weight */
  readonly packageSize: PackageSize;

  /** URL to product image */
  readonly imageUrl?: string;

  /** URL to product page on supermarket website */
  readonly productUrl: string;

  /** Internal product code/SKU at the supermarket */
  readonly sku: string;

  /** Barcode (EAN/UPC) if available */
  readonly barcode?: string;

  /** Which supermarket this product is from */
  readonly supermarketId: SupermarketId;

  /** Whether the product is currently in stock */
  readonly inStock: boolean;

  /** Nutritional information if available */
  readonly nutrition?: ProductNutrition;

  /** Whether this is an organic product */
  readonly isOrganic: boolean;

  /** Whether this is a store brand product */
  readonly isStoreBrand: boolean;

  /** Any promotional/special offer */
  readonly promotion?: Promotion;

  /** When this product data was last updated */
  readonly lastUpdated: Date;
}

/**
 * Package size information
 */
export interface PackageSize {
  /** Numeric value */
  readonly value: number;

  /** Unit of measurement */
  readonly unit: MeasurementUnit;

  /** Display string (e.g., "500g", "1L") */
  readonly display: string;
}

/**
 * Price information for a product
 */
export interface PriceInfo {
  /** Current price in cents (to avoid floating point issues) */
  readonly currentPriceCents: number;

  /** Original price if on sale */
  readonly originalPriceCents?: number;

  /** Currency code (EUR, GBP, USD, etc.) */
  readonly currency: CurrencyCode;

  /** Price per unit for comparison (e.g., price per kg) */
  readonly pricePerUnit?: PricePerUnit;

  /** Whether this price includes VAT */
  readonly includesVat: boolean;
}

/**
 * Supported currency codes
 */
export type CurrencyCode = 'EUR' | 'GBP' | 'USD';

/**
 * Price per standard unit for comparison shopping
 */
export interface PricePerUnit {
  /** Price in cents */
  readonly priceCents: number;

  /** Unit for comparison (kg, L, piece, etc.) */
  readonly unit: MeasurementUnit;

  /** Display string (e.g., "2.50/kg") */
  readonly display: string;
}

/**
 * Promotional offer on a product
 */
export interface Promotion {
  /** Type of promotion */
  readonly type: PromotionType;

  /** Description of the offer */
  readonly description: string;

  /** When the promotion ends */
  readonly endDate?: Date;

  /** Minimum quantity required (for multi-buy offers) */
  readonly minimumQuantity?: number;

  /** Savings amount in cents */
  readonly savingsCents?: number;
}

/**
 * Types of promotional offers
 */
export type PromotionType =
  | 'discount'           // Simple percentage or fixed discount
  | 'multi_buy'          // Buy X get Y free
  | 'member_price'       // Loyalty card price
  | 'clearance'          // Clearance/reduced to clear
  | 'bundle';            // Bundle deal

/**
 * Nutritional information for a product
 */
export interface ProductNutrition {
  /** Serving size for these values */
  readonly servingSize: string;

  /** Calories per serving */
  readonly calories?: number;

  /** Protein in grams */
  readonly proteinG?: number;

  /** Carbohydrates in grams */
  readonly carbsG?: number;

  /** Fat in grams */
  readonly fatG?: number;

  /** Fiber in grams */
  readonly fiberG?: number;

  /** Sodium in mg */
  readonly sodiumMg?: number;

  /** Sugar in grams */
  readonly sugarG?: number;
}

/**
 * A match between a recipe ingredient and a supermarket product
 */
export interface ProductMatch {
  /** Unique identifier */
  readonly id: ProductMatchId;

  /** The original ingredient being matched */
  readonly ingredientName: string;

  /** Quantity needed from the recipe */
  readonly quantityNeeded: number;

  /** Unit of the needed quantity */
  readonly unitNeeded: MeasurementUnit;

  /** The matched product */
  readonly product: Product;

  /** Confidence score of the match (0-1) */
  readonly confidence: number;

  /** How many of this product to buy */
  readonly quantityToBuy: number;

  /** Total cost for this match in cents */
  readonly totalCostCents: number;

  /** Whether this is an exact match or substitute */
  readonly matchType: MatchType;

  /** Reason for the match/substitution */
  readonly matchReason?: string;

  /** Alternative products that could work */
  readonly alternatives: readonly ProductMatchAlternative[];
}

/**
 * Types of product matches
 */
export type MatchType =
  | 'exact'              // Exact product match
  | 'similar'            // Similar product (different brand/size)
  | 'substitute'         // Different product that works as substitute
  | 'partial'            // Only partially matches (e.g., spice blend vs individual spice)
  | 'not_found';         // No match found

/**
 * An alternative product match
 */
export interface ProductMatchAlternative {
  /** The alternative product */
  readonly product: Product;

  /** Confidence score for this alternative */
  readonly confidence: number;

  /** Why this alternative was suggested */
  readonly reason: string;

  /** Price difference from primary match in cents */
  readonly priceDifferenceCents: number;
}

/**
 * Product search criteria
 */
export interface ProductSearchCriteria {
  /** Search query text */
  readonly query: string;

  /** Filter by category */
  readonly category?: IngredientCategory;

  /** Filter by supermarket */
  readonly supermarketId?: SupermarketId;

  /** Maximum price in cents */
  readonly maxPriceCents?: number;

  /** Only show in-stock items */
  readonly inStockOnly: boolean;

  /** Only show organic products */
  readonly organicOnly: boolean;

  /** Only show products with promotions */
  readonly promotionsOnly: boolean;

  /** Maximum number of results */
  readonly limit: number;

  /** Sort order */
  readonly sortBy: ProductSortOption;
}

/**
 * Product sorting options
 */
export type ProductSortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'price_per_unit_asc'
  | 'name_asc';

/**
 * Result of a product search
 */
export interface ProductSearchResult {
  /** Matching products */
  readonly products: readonly Product[];

  /** Total number of matches (may be more than returned) */
  readonly totalCount: number;

  /** Search query used */
  readonly query: string;

  /** Time taken in milliseconds */
  readonly searchTimeMs: number;
}

/**
 * Helper functions for creating branded IDs
 */
export function createProductId(id: string): ProductId {
  return id as ProductId;
}

export function createProductMatchId(id: string): ProductMatchId {
  return id as ProductMatchId;
}

/**
 * Format price from cents to display string
 */
export function formatPrice(priceCents: number, currency: CurrencyCode): string {
  const currencySymbols: Record<CurrencyCode, string> = {
    EUR: '\u20AC',
    GBP: '\u00A3',
    USD: '$'
  };

  const symbol = currencySymbols[currency];
  const price = (priceCents / 100).toFixed(2);

  return `${symbol}${price}`;
}
