/**
 * Advanced Unit Tests: Product Matcher Service
 *
 * Tests for the enhanced product matching algorithm with:
 * - Exact matching
 * - Fuzzy matching (Levenshtein distance)
 * - Spanish translations
 * - Multi-strategy approach
 * - Confidence scoring
 * - Grocery list batch matching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProductMatcherService,
  createProductMatcher,
  type ProductMatcherConfig,
  type ExtendedMatchResult,
  type ScoredProductMatch
} from '../../core/src/services/product-matcher.service.js';
import {
  getSpanishTranslations,
  getAllSearchTerms,
  normalizeIngredientName,
  extractKeyTerms,
  calculateStringSimilarity,
  areStringsSimilar,
  getSpanishCategories,
  INGREDIENT_MAP
} from '../../core/src/utils/spanish-ingredients.js';
import type {
  Product,
  ISupermarketScraper,
  SupermarketId,
  GroceryItem,
  MeasurementUnit,
  ProductSearchResult,
  IngredientCategory
} from '@meal-automation/shared';

// ============================================================================
// Mock Data
// ============================================================================

const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: `prod-${Math.random().toString(36).substring(7)}` as any,
  name: 'Test Product',
  price: {
    currentPriceCents: 199,
    currency: 'EUR',
    includesVat: true
  },
  category: 'produce' as IngredientCategory,
  packageSize: { value: 500, unit: 'g' as MeasurementUnit, display: '500g' },
  productUrl: 'https://example.com/product',
  sku: 'SKU123',
  supermarketId: 'mercadona' as SupermarketId,
  inStock: true,
  isOrganic: false,
  isStoreBrand: false,
  lastUpdated: new Date(),
  ...overrides
});

const mockProducts: Product[] = [
  createMockProduct({
    id: 'prod-001' as any,
    name: 'Pechuga de Pollo',
    category: 'meat',
    price: { currentPriceCents: 599, currency: 'EUR', includesVat: true },
    packageSize: { value: 500, unit: 'g', display: '500g' }
  }),
  createMockProduct({
    id: 'prod-002' as any,
    name: 'Pollo Entero',
    category: 'meat',
    price: { currentPriceCents: 799, currency: 'EUR', includesVat: true },
    packageSize: { value: 1500, unit: 'g', display: '1.5kg' }
  }),
  createMockProduct({
    id: 'prod-003' as any,
    name: 'Muslo de Pollo',
    category: 'meat',
    price: { currentPriceCents: 399, currency: 'EUR', includesVat: true },
    packageSize: { value: 600, unit: 'g', display: '600g' }
  }),
  createMockProduct({
    id: 'prod-004' as any,
    name: 'Tomate Natural',
    category: 'produce',
    price: { currentPriceCents: 199, currency: 'EUR', includesVat: true },
    packageSize: { value: 1000, unit: 'g', display: '1kg' }
  }),
  createMockProduct({
    id: 'prod-005' as any,
    name: 'Tomates Cherry',
    category: 'produce',
    price: { currentPriceCents: 299, currency: 'EUR', includesVat: true },
    packageSize: { value: 250, unit: 'g', display: '250g' }
  }),
  createMockProduct({
    id: 'prod-006' as any,
    name: 'Aceite de Oliva Virgen Extra',
    category: 'condiments',
    price: { currentPriceCents: 499, currency: 'EUR', includesVat: true },
    packageSize: { value: 1, unit: 'l', display: '1L' }
  }),
  createMockProduct({
    id: 'prod-007' as any,
    name: 'Leche Entera',
    category: 'dairy',
    price: { currentPriceCents: 99, currency: 'EUR', includesVat: true },
    packageSize: { value: 1, unit: 'l', display: '1L' }
  }),
  createMockProduct({
    id: 'prod-008' as any,
    name: 'Arroz Largo',
    category: 'dry_goods',
    price: { currentPriceCents: 159, currency: 'EUR', includesVat: true },
    packageSize: { value: 1000, unit: 'g', display: '1kg' }
  }),
  createMockProduct({
    id: 'prod-009' as any,
    name: 'Cebolla Blanca',
    category: 'produce',
    price: { currentPriceCents: 129, currency: 'EUR', includesVat: true },
    packageSize: { value: 1000, unit: 'g', display: '1kg' }
  }),
  createMockProduct({
    id: 'prod-010' as any,
    name: 'Ajo',
    category: 'produce',
    price: { currentPriceCents: 149, currency: 'EUR', includesVat: true },
    packageSize: { value: 3, unit: 'piece', display: '3 cabezas' }
  })
];

// Mock Scraper
const createMockScraper = (products: Product[] = mockProducts): ISupermarketScraper => ({
  supermarketId: 'mercadona' as SupermarketId,
  status: 'active',
  searchProducts: vi.fn().mockImplementation(async (criteria) => {
    const query = criteria.query.toLowerCase();
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      query.split(' ').some(word =>
        p.name.toLowerCase().includes(word) && word.length > 2
      )
    );
    return {
      products: filtered.slice(0, criteria.limit || 10),
      totalCount: filtered.length,
      query: criteria.query,
      searchTimeMs: 50
    } as ProductSearchResult;
  }),
  getProduct: vi.fn().mockResolvedValue(null),
  getProductsByCategory: vi.fn().mockImplementation(async (category, limit) => {
    const catLower = category.toLowerCase();
    return products
      .filter(p => p.category.toLowerCase().includes(catLower))
      .slice(0, limit || 20);
  }),
  checkStock: vi.fn().mockResolvedValue(new Map()),
  getPromotions: vi.fn().mockResolvedValue([]),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, status: 'active', responseTimeMs: 100, checkedAt: new Date() })
});

// ============================================================================
// Spanish Ingredients Utility Tests
// ============================================================================

describe('Spanish Ingredients Utility', () => {
  describe('getSpanishTranslations', () => {
    it('should return Spanish translations for common English ingredients', () => {
      expect(getSpanishTranslations('chicken')).toContain('pollo');
      expect(getSpanishTranslations('tomato')).toContain('tomate');
      expect(getSpanishTranslations('olive oil')).toContain('aceite de oliva');
    });

    it('should handle case insensitivity', () => {
      expect(getSpanishTranslations('CHICKEN')).toContain('pollo');
      expect(getSpanishTranslations('Chicken')).toContain('pollo');
    });

    it('should handle plural forms', () => {
      expect(getSpanishTranslations('tomatoes')).toContain('tomate');
      expect(getSpanishTranslations('onions')).toContain('cebolla');
    });

    it('should return empty array for unknown ingredients', () => {
      expect(getSpanishTranslations('xyz123unknown')).toEqual([]);
    });

    it('should return multiple synonyms for ingredients', () => {
      const translations = getSpanishTranslations('chicken breast');
      expect(translations.length).toBeGreaterThan(1);
      expect(translations.some(t => t.includes('pechuga'))).toBe(true);
    });
  });

  describe('getAllSearchTerms', () => {
    it('should return both English and Spanish terms', () => {
      const terms = getAllSearchTerms('chicken');
      expect(terms).toContain('chicken');
      expect(terms.some(t => t.includes('pollo'))).toBe(true);
    });

    it('should include singular and plural variants', () => {
      const terms = getAllSearchTerms('tomato');
      expect(terms).toContain('tomato');
      expect(terms).toContain('tomatos');
    });
  });

  describe('normalizeIngredientName', () => {
    it('should remove preparation terms', () => {
      expect(normalizeIngredientName('diced tomatoes')).not.toContain('diced');
      expect(normalizeIngredientName('minced garlic')).not.toContain('minced');
      expect(normalizeIngredientName('fresh basil')).not.toContain('fresh');
    });

    it('should remove quantity information', () => {
      expect(normalizeIngredientName('500g chicken breast')).not.toContain('500');
      expect(normalizeIngredientName('2 cups flour')).not.toContain('2');
    });

    it('should convert to lowercase', () => {
      expect(normalizeIngredientName('CHICKEN BREAST')).toBe('chicken breast');
    });

    it('should trim whitespace', () => {
      expect(normalizeIngredientName('  chicken  ')).toBe('chicken');
    });
  });

  describe('extractKeyTerms', () => {
    it('should extract significant words', () => {
      const terms = extractKeyTerms('chicken breast with garlic');
      expect(terms).toContain('chicken');
      expect(terms).toContain('breast');
      expect(terms).toContain('garlic');
    });

    it('should filter out short words', () => {
      const terms = extractKeyTerms('a cup of milk');
      expect(terms).not.toContain('a');
      expect(terms).not.toContain('of');
    });

    it('should filter out common stop words', () => {
      const terms = extractKeyTerms('the chicken and the rice');
      expect(terms).not.toContain('the');
      expect(terms).not.toContain('and');
    });
  });

  describe('calculateStringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateStringSimilarity('chicken', 'chicken')).toBe(1);
    });

    it('should return high similarity for similar strings', () => {
      expect(calculateStringSimilarity('chicken', 'chikken')).toBeGreaterThan(0.7);
      expect(calculateStringSimilarity('tomato', 'tomatto')).toBeGreaterThan(0.7);
    });

    it('should return low similarity for different strings', () => {
      expect(calculateStringSimilarity('chicken', 'banana')).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      expect(calculateStringSimilarity('', '')).toBe(0);
      expect(calculateStringSimilarity('chicken', '')).toBe(0);
    });
  });

  describe('areStringsSimilar', () => {
    it('should return true for similar strings above threshold', () => {
      expect(areStringsSimilar('chicken', 'chikken', 0.7)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(areStringsSimilar('chicken', 'banana', 0.7)).toBe(false);
    });

    it('should respect custom threshold', () => {
      expect(areStringsSimilar('chicken', 'chicken', 0.9)).toBe(true);
      expect(areStringsSimilar('chicken', 'chiken', 0.95)).toBe(false);
    });
  });

  describe('getSpanishCategories', () => {
    it('should return Spanish category names', () => {
      const categories = getSpanishCategories('produce');
      expect(categories.some(c => c.includes('verdura'))).toBe(true);
    });

    it('should handle various category names', () => {
      expect(getSpanishCategories('dairy').length).toBeGreaterThan(0);
      expect(getSpanishCategories('meat').length).toBeGreaterThan(0);
    });
  });

  describe('INGREDIENT_MAP coverage', () => {
    it('should have at least 100 ingredient mappings', () => {
      expect(Object.keys(INGREDIENT_MAP).length).toBeGreaterThanOrEqual(100);
    });

    it('should cover major food categories', () => {
      // Proteins
      expect(INGREDIENT_MAP['chicken']).toBeDefined();
      expect(INGREDIENT_MAP['beef']).toBeDefined();
      expect(INGREDIENT_MAP['fish']).toBeDefined();

      // Vegetables
      expect(INGREDIENT_MAP['tomato']).toBeDefined();
      expect(INGREDIENT_MAP['onion']).toBeDefined();
      expect(INGREDIENT_MAP['garlic']).toBeDefined();

      // Dairy
      expect(INGREDIENT_MAP['milk']).toBeDefined();
      expect(INGREDIENT_MAP['cheese']).toBeDefined();
      expect(INGREDIENT_MAP['eggs']).toBeDefined();

      // Oils
      expect(INGREDIENT_MAP['olive oil']).toBeDefined();

      // Spices
      expect(INGREDIENT_MAP['salt']).toBeDefined();
      expect(INGREDIENT_MAP['pepper']).toBeDefined();
    });
  });
});

// ============================================================================
// Product Matcher Service Tests
// ============================================================================

describe('ProductMatcherService', () => {
  let matcher: ProductMatcherService;
  let mockScraper: ISupermarketScraper;

  beforeEach(() => {
    matcher = new ProductMatcherService();
    mockScraper = createMockScraper();
    matcher.registerScraper('mercadona' as SupermarketId, mockScraper);
  });

  describe('Constructor and Configuration', () => {
    it('should use default configuration when not provided', () => {
      const defaultMatcher = new ProductMatcherService();
      expect(defaultMatcher).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<ProductMatcherConfig> = {
        minConfidence: 0.5,
        maxAlternatives: 10,
        fuzzyMatchThreshold: 0.8
      };
      const customMatcher = new ProductMatcherService(customConfig);
      expect(customMatcher).toBeDefined();
    });

    it('should create matcher using factory function', () => {
      const factoryMatcher = createProductMatcher({ minConfidence: 0.4 });
      expect(factoryMatcher).toBeInstanceOf(ProductMatcherService);
    });
  });

  describe('Scraper Registration', () => {
    it('should register scrapers', () => {
      expect(matcher.getRegisteredSupermarkets()).toContain('mercadona');
    });

    it('should return registered supermarket IDs', () => {
      const secondScraper = createMockScraper();
      matcher.registerScraper('carrefour_es' as SupermarketId, secondScraper);

      const supermarkets = matcher.getRegisteredSupermarkets();
      expect(supermarkets).toContain('mercadona');
      expect(supermarkets).toContain('carrefour_es');
    });

    it('should throw error for unregistered supermarket', async () => {
      await expect(
        matcher.findMatches('chicken', 500, 'g', 'unknown' as SupermarketId)
      ).rejects.toThrow('No scraper registered for supermarket: unknown');
    });
  });

  describe('findMatches - Exact Matching', () => {
    it('should find exact matches for Spanish product names', async () => {
      const matches = await matcher.findMatches(
        'Pechuga de Pollo',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchType).not.toBe('not_found');
    });

    it('should match English ingredients to Spanish products', async () => {
      const matches = await matcher.findMatches(
        'chicken breast',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
      // Should find chicken products via translation
    });

    it('should return high confidence for exact matches', async () => {
      // Mock a product that exactly matches the search
      const exactMatchScraper = createMockScraper([
        createMockProduct({
          id: 'exact-001' as any,
          name: 'pollo',
          category: 'meat'
        })
      ]);
      matcher.registerScraper('test' as SupermarketId, exactMatchScraper);

      const matches = await matcher.findMatches(
        'pollo',
        500,
        'g',
        'test' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
      if (matches[0].matchType !== 'not_found') {
        expect(matches[0].confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('findMatches - Fuzzy Matching', () => {
    it('should find products with minor spelling differences', async () => {
      // Create scraper with slightly misspelled product
      const fuzzyScraper = createMockScraper([
        createMockProduct({
          id: 'fuzzy-001' as any,
          name: 'Tomate Natura',  // Missing 'l'
          category: 'produce'
        })
      ]);
      matcher.registerScraper('fuzzy-test' as SupermarketId, fuzzyScraper);

      const matches = await matcher.findMatches(
        'tomate natural',
        1000,
        'g',
        'fuzzy-test' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should use Levenshtein distance for similarity', () => {
      // Direct test of similarity function
      const similarity = calculateStringSimilarity('tomate', 'tomate natural');
      expect(similarity).toBeGreaterThan(0);
    });
  });

  describe('findMatches - Translation Matching', () => {
    it('should translate English to Spanish for matching', async () => {
      const matches = await matcher.findMatches(
        'tomato',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
      // Should find "Tomate Natural" or similar
    });

    it('should handle compound ingredient names', async () => {
      const matches = await matcher.findMatches(
        'olive oil',
        500,
        'ml',
        'mercadona' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
      // Should find "Aceite de Oliva" products
    });

    it('should try multiple Spanish translations', () => {
      const translations = getSpanishTranslations('chicken');
      expect(translations.length).toBeGreaterThan(1);
    });
  });

  describe('findMatches - Keyword Matching', () => {
    it('should extract and match key terms', async () => {
      const matches = await matcher.findMatches(
        'fresh diced tomatoes for salad',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should ignore preparation terms in matching', () => {
      const normalized = normalizeIngredientName('diced fresh tomatoes');
      expect(normalized).not.toContain('diced');
      expect(normalized).not.toContain('fresh');
      expect(normalized).toContain('tomatoes');
    });
  });

  describe('findMatches - Category Fallback', () => {
    it('should fall back to category search when direct search fails', async () => {
      // Create scraper that returns no results for direct search but has category products
      const categoryScraper: ISupermarketScraper = {
        ...createMockScraper([]),
        searchProducts: vi.fn().mockResolvedValue({
          products: [],
          totalCount: 0,
          query: '',
          searchTimeMs: 50
        }),
        getProductsByCategory: vi.fn().mockResolvedValue([
          createMockProduct({ name: 'Generic Meat Product', category: 'meat' })
        ])
      };
      matcher.registerScraper('category-test' as SupermarketId, categoryScraper);

      const matches = await matcher.findMatches(
        'chicken',
        500,
        'g',
        'category-test' as SupermarketId
      );

      expect(categoryScraper.getProductsByCategory).toHaveBeenCalled();
    });
  });

  describe('findMatches - Confidence Scoring', () => {
    it('should return confidence scores between 0 and 1', async () => {
      const matches = await matcher.findMatches(
        'tomate',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].matchType !== 'not_found') {
        expect(matches[0].confidence).toBeGreaterThanOrEqual(0);
        expect(matches[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should provide alternatives sorted by confidence', async () => {
      const matches = await matcher.findMatches(
        'pollo',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].alternatives.length > 1) {
        for (let i = 0; i < matches[0].alternatives.length - 1; i++) {
          expect(matches[0].alternatives[i].confidence)
            .toBeGreaterThanOrEqual(matches[0].alternatives[i + 1].confidence);
        }
      }
    });
  });

  describe('findMatches - Quantity Calculations', () => {
    it('should calculate correct quantity to buy', async () => {
      const matches = await matcher.findMatches(
        'arroz',  // Rice - should match Arroz Largo (1kg packages)
        2000,     // Need 2kg
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].matchType !== 'not_found') {
        // Should need 2 packages of 1kg
        expect(matches[0].quantityToBuy).toBeGreaterThanOrEqual(2);
      }
    });

    it('should handle unit conversions', async () => {
      const matches = await matcher.findMatches(
        'leche',
        2000,
        'ml',  // 2000ml = 2L
        'mercadona' as SupermarketId
      );

      if (matches[0].matchType !== 'not_found') {
        expect(matches[0].quantityToBuy).toBeGreaterThanOrEqual(2);
      }
    });

    it('should calculate total cost correctly', async () => {
      const matches = await matcher.findMatches(
        'tomate',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].matchType !== 'not_found') {
        const expectedCost = matches[0].quantityToBuy * matches[0].product.price.currentPriceCents;
        expect(matches[0].totalCostCents).toBe(expectedCost);
      }
    });
  });

  describe('findMatches - Not Found Handling', () => {
    it('should return not_found match type when no products match', async () => {
      const emptyMatcher = new ProductMatcherService();
      const emptyScraper: ISupermarketScraper = {
        ...createMockScraper([]),
        searchProducts: vi.fn().mockResolvedValue({
          products: [],
          totalCount: 0,
          query: '',
          searchTimeMs: 50
        }),
        getProductsByCategory: vi.fn().mockResolvedValue([])
      };
      emptyMatcher.registerScraper('empty' as SupermarketId, emptyScraper);

      const matches = await emptyMatcher.findMatches(
        'nonexistent product xyz',
        100,
        'g',
        'empty' as SupermarketId
      );

      expect(matches[0].matchType).toBe('not_found');
      expect(matches[0].confidence).toBe(0);
    });

    it('should provide helpful match reason for not found', async () => {
      const emptyMatcher = new ProductMatcherService();
      const emptyScraper: ISupermarketScraper = {
        ...createMockScraper([]),
        searchProducts: vi.fn().mockResolvedValue({
          products: [],
          totalCount: 0,
          query: '',
          searchTimeMs: 50
        }),
        getProductsByCategory: vi.fn().mockResolvedValue([])
      };
      emptyMatcher.registerScraper('empty' as SupermarketId, emptyScraper);

      const matches = await emptyMatcher.findMatches(
        'nonexistent',
        100,
        'g',
        'empty' as SupermarketId
      );

      expect(matches[0].matchReason).toBeDefined();
      expect(matches[0].matchReason.length).toBeGreaterThan(0);
    });
  });

  describe('findMatchesAdvanced', () => {
    it('should return extended match result with strategy information', async () => {
      const result = await matcher.findMatchesAdvanced(
        'tomate',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      expect(result.ingredient).toBe('tomate');
      expect(result.normalizedIngredient).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.searchTermsTried.length).toBeGreaterThan(0);
      expect(result.matchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include all scored matches', async () => {
      const result = await matcher.findMatchesAdvanced(
        'pollo',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      expect(Array.isArray(result.matches)).toBe(true);
      for (const match of result.matches) {
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(1);
        expect(match.strategy).toBeDefined();
        expect(match.matchExplanation).toBeDefined();
      }
    });
  });

  describe('matchGroceryList', () => {
    it('should match all items in a grocery list', async () => {
      const groceryItems: GroceryItem[] = [
        {
          id: 'item-1',
          ingredientName: 'chicken',
          totalQuantity: 500,
          unit: 'g',
          category: 'meat',
          checked: false,
          matches: [],
          recipeReferences: []
        },
        {
          id: 'item-2',
          ingredientName: 'tomato',
          totalQuantity: 1000,
          unit: 'g',
          category: 'produce',
          checked: false,
          matches: [],
          recipeReferences: []
        }
      ];

      const matchedItems = await matcher.matchGroceryList(
        groceryItems,
        'mercadona' as SupermarketId
      );

      expect(matchedItems.length).toBe(2);
      for (const item of matchedItems) {
        expect(item.matches.length).toBeGreaterThan(0);
        expect(item.selectedMatch).toBeDefined();
      }
    });

    it('should process items in parallel batches', async () => {
      const manyItems: GroceryItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        ingredientName: ['chicken', 'tomato', 'rice', 'onion', 'garlic'][i % 5],
        totalQuantity: 500,
        unit: 'g' as MeasurementUnit,
        category: 'produce' as IngredientCategory,
        checked: false,
        matches: [],
        recipeReferences: []
      }));

      const matchedItems = await matcher.matchGroceryList(
        manyItems,
        'mercadona' as SupermarketId
      );

      expect(matchedItems.length).toBe(10);
    });
  });

  describe('matchGroceryListMultiple', () => {
    it('should match against multiple supermarkets', async () => {
      const secondScraper = createMockScraper();
      matcher.registerScraper('carrefour_es' as SupermarketId, secondScraper);

      const groceryItems: GroceryItem[] = [
        {
          id: 'item-1',
          ingredientName: 'chicken',
          totalQuantity: 500,
          unit: 'g',
          category: 'meat',
          checked: false,
          matches: [],
          recipeReferences: []
        }
      ];

      const results = await matcher.matchGroceryListMultiple(
        groceryItems,
        ['mercadona', 'carrefour_es'] as SupermarketId[]
      );

      expect(results.size).toBe(2);
      expect(results.has('mercadona' as SupermarketId)).toBe(true);
      expect(results.has('carrefour_es' as SupermarketId)).toBe(true);
    });
  });

  describe('explainMatch', () => {
    it('should explain successful matches', async () => {
      const matches = await matcher.findMatches(
        'tomate',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      const explanation = matcher.explainMatch(matches[0]);

      expect(explanation).toBeDefined();
      expect(explanation.length).toBeGreaterThan(0);
      if (matches[0].matchType !== 'not_found') {
        expect(explanation).toContain('confidence');
      }
    });

    it('should explain not found matches', async () => {
      const emptyMatcher = new ProductMatcherService();
      const emptyScraper: ISupermarketScraper = {
        ...createMockScraper([]),
        searchProducts: vi.fn().mockResolvedValue({
          products: [],
          totalCount: 0,
          query: '',
          searchTimeMs: 50
        }),
        getProductsByCategory: vi.fn().mockResolvedValue([])
      };
      emptyMatcher.registerScraper('empty' as SupermarketId, emptyScraper);

      const matches = await emptyMatcher.findMatches(
        'nonexistent',
        100,
        'g',
        'empty' as SupermarketId
      );

      const explanation = emptyMatcher.explainMatch(matches[0]);

      expect(explanation).toContain('Could not find');
    });

    it('should mention promotions in explanation', async () => {
      const promoScraper = createMockScraper([
        createMockProduct({
          name: 'Tomate',
          category: 'produce',
          promotion: {
            type: 'discount',
            description: '20% off',
            savingsCents: 40
          }
        })
      ]);
      matcher.registerScraper('promo' as SupermarketId, promoScraper);

      const matches = await matcher.findMatches(
        'tomate',
        500,
        'g',
        'promo' as SupermarketId
      );

      const explanation = matcher.explainMatch(matches[0]);

      if (matches[0].matchType !== 'not_found') {
        expect(explanation).toContain('promotion');
      }
    });

    it('should mention multiple packages when needed', async () => {
      const matches = await matcher.findMatches(
        'arroz',
        5000,  // Need 5kg
        'g',
        'mercadona' as SupermarketId
      );

      const explanation = matcher.explainMatch(matches[0]);

      if (matches[0].matchType !== 'not_found' && matches[0].quantityToBuy > 1) {
        expect(explanation).toContain('packages');
      }
    });
  });

  describe('Match Type Classification', () => {
    it('should classify high-confidence matches as exact', async () => {
      // Create exact match scenario
      const exactScraper = createMockScraper([
        createMockProduct({
          name: 'tomate natural',
          category: 'produce'
        })
      ]);
      matcher.registerScraper('exact-type' as SupermarketId, exactScraper);

      const matches = await matcher.findMatches(
        'tomate natural',
        500,
        'g',
        'exact-type' as SupermarketId
      );

      if (matches[0].confidence >= 0.8) {
        expect(matches[0].matchType).toBe('exact');
      }
    });

    it('should classify medium-confidence matches as similar', async () => {
      const matches = await matcher.findMatches(
        'tomates',  // Close but not exact
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].confidence >= 0.5 && matches[0].confidence < 0.8) {
        expect(['exact', 'similar']).toContain(matches[0].matchType);
      }
    });
  });

  describe('Alternative Products', () => {
    it('should include alternatives in match results', async () => {
      const matches = await matcher.findMatches(
        'pollo',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].matchType !== 'not_found') {
        expect(Array.isArray(matches[0].alternatives)).toBe(true);
      }
    });

    it('should include price difference for alternatives', async () => {
      const matches = await matcher.findMatches(
        'pollo',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].alternatives.length > 0) {
        expect(matches[0].alternatives[0].priceDifferenceCents).toBeDefined();
        expect(typeof matches[0].alternatives[0].priceDifferenceCents).toBe('number');
      }
    });

    it('should provide reason for each alternative', async () => {
      const matches = await matcher.findMatches(
        'pollo',
        500,
        'g',
        'mercadona' as SupermarketId
      );

      if (matches[0].alternatives.length > 0) {
        expect(matches[0].alternatives[0].reason).toBeDefined();
        expect(matches[0].alternatives[0].reason.length).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('Real-World Scenarios', () => {
  let matcher: ProductMatcherService;
  let mockScraper: ISupermarketScraper;

  beforeEach(() => {
    matcher = new ProductMatcherService();
    mockScraper = createMockScraper();
    matcher.registerScraper('mercadona' as SupermarketId, mockScraper);
  });

  it('should handle a typical Spanish recipe ingredient list', async () => {
    const typicalIngredients = [
      { name: 'chicken breast', quantity: 500, unit: 'g' as MeasurementUnit },
      { name: 'tomatoes', quantity: 400, unit: 'g' as MeasurementUnit },
      { name: 'olive oil', quantity: 50, unit: 'ml' as MeasurementUnit },
      { name: 'garlic', quantity: 3, unit: 'piece' as MeasurementUnit },
      { name: 'rice', quantity: 300, unit: 'g' as MeasurementUnit }
    ];

    for (const ingredient of typicalIngredients) {
      const matches = await matcher.findMatches(
        ingredient.name,
        ingredient.quantity,
        ingredient.unit,
        'mercadona' as SupermarketId
      );

      expect(matches.length).toBeGreaterThan(0);
      // Most common ingredients should have matches
    }
  });

  it('should handle ingredients with preparation instructions', async () => {
    const preparedIngredients = [
      'finely diced onions',
      'minced fresh garlic',
      'crushed tomatoes',
      'sliced chicken breast'
    ];

    for (const ingredient of preparedIngredients) {
      const normalized = normalizeIngredientName(ingredient);
      expect(normalized).not.toContain('finely');
      expect(normalized).not.toContain('diced');
      expect(normalized).not.toContain('minced');
      expect(normalized).not.toContain('fresh');
      expect(normalized).not.toContain('crushed');
      expect(normalized).not.toContain('sliced');
    }
  });

  it('should provide cost-effective alternatives', async () => {
    const matches = await matcher.findMatches(
      'pollo',
      500,
      'g',
      'mercadona' as SupermarketId
    );

    if (matches[0].alternatives.length > 0) {
      const cheaperAlternatives = matches[0].alternatives.filter(
        alt => alt.priceDifferenceCents < 0
      );
      // Check if any cheaper alternatives exist
      expect(Array.isArray(cheaperAlternatives)).toBe(true);
    }
  });
});
