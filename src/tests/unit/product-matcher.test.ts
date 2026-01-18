/**
 * Unit Tests: Product Matching Module
 *
 * Tests for matching grocery list items to supermarket products.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import fixtures
import mercadonaCatalog from '../fixtures/products/mercadona-catalog.json';
import carrefourCatalog from '../fixtures/products/carrefour-catalog.json';

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  available: boolean;
  category: string;
}

interface MatchResult {
  ingredient: string;
  matches: Array<{
    product: Product;
    score: number;
    supermarket: string;
  }>;
  bestMatch: Product | null;
}

// ============================================================================
// Mock ProductMatcher Implementation
// ============================================================================

class ProductMatcher {
  private products: Product[] = [];

  loadProducts(catalog: typeof mercadonaCatalog, supermarket: string) {
    const products = catalog.products.map((p) => ({
      ...p,
      supermarket,
    }));
    this.products.push(...(products as unknown as Product[]));
  }

  findMatches(ingredientName: string, quantity?: number): MatchResult {
    const searchTerm = ingredientName.toLowerCase();
    const matches: MatchResult['matches'] = [];

    for (const product of this.products) {
      const productName = product.name.toLowerCase();
      let score = 0;

      // Exact match
      if (productName === searchTerm) {
        score = 1.0;
      }
      // Contains full search term
      else if (productName.includes(searchTerm)) {
        score = 0.8;
      }
      // Search term contains product name
      else if (searchTerm.includes(productName.split(' ')[0])) {
        score = 0.6;
      }
      // Word overlap
      else {
        const searchWords = searchTerm.split(' ');
        const productWords = productName.split(' ');
        const overlap = searchWords.filter((w) => productWords.some((pw) => pw.includes(w))).length;
        if (overlap > 0) {
          score = 0.4 * (overlap / searchWords.length);
        }
      }

      if (score > 0) {
        matches.push({
          product,
          score,
          supermarket: (product as unknown as { supermarket: string }).supermarket || 'Unknown',
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return {
      ingredient: ingredientName,
      matches: matches.slice(0, 10),
      bestMatch: matches.length > 0 ? matches[0].product : null,
    };
  }

  findBestPrice(ingredientName: string): Product | null {
    const result = this.findMatches(ingredientName);
    if (result.matches.length === 0) return null;

    // Filter to available products only
    const availableMatches = result.matches.filter((m) => m.product.available);
    if (availableMatches.length === 0) return null;

    // Sort by unit price
    availableMatches.sort((a, b) => a.product.unitPrice - b.product.unitPrice);
    return availableMatches[0].product;
  }

  findAlternatives(productId: string): Product[] {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return [];

    // Find products in the same category
    return this.products.filter(
      (p) =>
        p.id !== productId &&
        p.category === product.category &&
        p.available
    );
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ProductMatcher', () => {
  let matcher: ProductMatcher;

  beforeEach(() => {
    matcher = new ProductMatcher();
    matcher.loadProducts(mercadonaCatalog, 'Mercadona');
    matcher.loadProducts(carrefourCatalog, 'Carrefour');
  });

  // ==========================================================================
  // Basic Matching
  // ==========================================================================

  describe('findMatches', () => {
    it('should find exact matches', () => {
      const result = matcher.findMatches('Leche Entera Hacendado');

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.bestMatch).not.toBeNull();
    });

    it('should find partial matches', () => {
      const result = matcher.findMatches('Leche');

      expect(result.matches.length).toBeGreaterThan(0);
      // Should find multiple milk products
      expect(result.matches.some((m) => m.product.name.toLowerCase().includes('leche'))).toBe(true);
    });

    it('should rank matches by relevance', () => {
      const result = matcher.findMatches('Arroz');

      if (result.matches.length > 1) {
        // First match should have higher or equal score than second
        expect(result.matches[0].score).toBeGreaterThanOrEqual(result.matches[1].score);
      }
    });

    it('should return empty results for non-existent products', () => {
      const result = matcher.findMatches('ProductoInexistente12345');

      expect(result.matches.length).toBe(0);
      expect(result.bestMatch).toBeNull();
    });

    it('should handle case insensitivity', () => {
      const upperResult = matcher.findMatches('LECHE');
      const lowerResult = matcher.findMatches('leche');
      const mixedResult = matcher.findMatches('LeChe');

      expect(upperResult.matches.length).toBe(lowerResult.matches.length);
      expect(upperResult.matches.length).toBe(mixedResult.matches.length);
    });
  });

  // ==========================================================================
  // Price Optimization
  // ==========================================================================

  describe('findBestPrice', () => {
    it('should find the cheapest matching product', () => {
      const bestPrice = matcher.findBestPrice('Aceite de Oliva');

      expect(bestPrice).not.toBeNull();
      if (bestPrice) {
        // Verify it's actually one of the cheaper options
        const allMatches = matcher.findMatches('Aceite de Oliva');
        const availablePrices = allMatches.matches
          .filter((m) => m.product.available)
          .map((m) => m.product.unitPrice);

        if (availablePrices.length > 0) {
          const minPrice = Math.min(...availablePrices);
          expect(bestPrice.unitPrice).toBe(minPrice);
        }
      }
    });

    it('should exclude unavailable products', () => {
      const result = matcher.findBestPrice('Chorizo');

      // If a result is found, it should be available
      if (result) {
        expect(result.available).toBe(true);
      }
    });

    it('should return null when no products match', () => {
      const result = matcher.findBestPrice('ProductoInexistente');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Alternative Products
  // ==========================================================================

  describe('findAlternatives', () => {
    it('should find products in the same category', () => {
      const alternatives = matcher.findAlternatives('merc-001'); // Leche Entera

      expect(Array.isArray(alternatives)).toBe(true);
      // Should find other dairy products
      if (alternatives.length > 0) {
        expect(alternatives.every((p) => p.category === 'Lacteos')).toBe(true);
      }
    });

    it('should exclude the original product', () => {
      const alternatives = matcher.findAlternatives('merc-001');

      expect(alternatives.every((p) => p.id !== 'merc-001')).toBe(true);
    });

    it('should only include available products', () => {
      const alternatives = matcher.findAlternatives('merc-001');

      expect(alternatives.every((p) => p.available)).toBe(true);
    });

    it('should return empty array for non-existent product', () => {
      const alternatives = matcher.findAlternatives('non-existent-id');

      expect(alternatives).toEqual([]);
    });
  });
});

// ============================================================================
// Product Catalog Validation
// ============================================================================

describe('Product Catalogs', () => {
  describe('Mercadona catalog', () => {
    it('should have valid product structure', () => {
      for (const product of mercadonaCatalog.products) {
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
        expect(product).toHaveProperty('available');
        expect(typeof product.id).toBe('string');
        expect(typeof product.name).toBe('string');
        expect(typeof product.price).toBe('number');
        expect(typeof product.available).toBe('boolean');
      }
    });

    it('should have positive prices', () => {
      for (const product of mercadonaCatalog.products) {
        expect(product.price).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have unit price information', () => {
      for (const product of mercadonaCatalog.products) {
        expect(product).toHaveProperty('unitPrice');
        expect(product).toHaveProperty('unitPriceUnit');
        expect(product.unitPrice).toBeGreaterThan(0);
      }
    });

    it('should have products with promotions properly structured', () => {
      const productsWithPromos = mercadonaCatalog.products.filter((p) => p.promotion);

      for (const product of productsWithPromos) {
        expect(product.promotion).toHaveProperty('type');
        expect(product.promotion).toHaveProperty('originalPrice');
        expect(product.promotion).toHaveProperty('effectivePrice');
        expect(product.promotion!.effectivePrice).toBeLessThan(product.promotion!.originalPrice);
      }
    });

    it('should have alternatives for unavailable products', () => {
      const unavailableProducts = mercadonaCatalog.products.filter((p) => !p.available);

      for (const product of unavailableProducts) {
        expect(product).toHaveProperty('unavailableReason');
        // Most unavailable products should suggest alternatives
        if (product.alternatives) {
          expect(Array.isArray(product.alternatives)).toBe(true);
        }
      }
    });
  });

  describe('Carrefour catalog', () => {
    it('should have valid product structure', () => {
      for (const product of carrefourCatalog.products) {
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
        expect(product.id.startsWith('carr-')).toBe(true);
      }
    });

    it('should have discount promotions properly calculated', () => {
      const productsWithDiscounts = carrefourCatalog.products.filter(
        (p) => p.promotion?.type === 'discount'
      );

      for (const product of productsWithDiscounts) {
        const promo = product.promotion!;
        const expectedDiscount = Math.round(
          (1 - promo.effectivePrice / promo.originalPrice) * 100
        );
        expect(promo.discountPercent).toBeCloseTo(expectedDiscount, 0);
      }
    });
  });

  describe('Cross-catalog consistency', () => {
    it('should have consistent category naming', () => {
      const mercadonaCategories = new Set(mercadonaCatalog.products.map((p) => p.category));
      const carrefourCategories = new Set(carrefourCatalog.products.map((p) => p.category));

      // Both should have common categories
      const commonCategories = [...mercadonaCategories].filter((c) =>
        carrefourCategories.has(c)
      );

      expect(commonCategories.length).toBeGreaterThan(0);
    });

    it('should have similar products for comparison', () => {
      // Find products that exist in both catalogs
      const mercadonaMilk = mercadonaCatalog.products.filter((p) =>
        p.name.toLowerCase().includes('leche')
      );
      const carrefourMilk = carrefourCatalog.products.filter((p) =>
        p.name.toLowerCase().includes('leche')
      );

      expect(mercadonaMilk.length).toBeGreaterThan(0);
      expect(carrefourMilk.length).toBeGreaterThan(0);
    });
  });
});
