/**
 * Tests for IngredientMapper
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IngredientMapper, getIngredientMapper, resetIngredientMapper } from '../mapper';
import { SupermarketFactory } from '../factory';
import { NormalizedProduct, SearchResult } from '../types';

// Mock the factory
vi.mock('../factory', () => ({
  SupermarketFactory: {
    getInstance: vi.fn(),
  },
}));

describe('IngredientMapper', () => {
  let mapper: IngredientMapper;
  let mockAdapter: {
    id: 'mercadona';
    searchProducts: ReturnType<typeof vi.fn>;
  };
  let mockFactory: {
    getAdapter: ReturnType<typeof vi.fn>;
    getAllAdapters: ReturnType<typeof vi.fn>;
  };

  const createMockProduct = (overrides: Partial<NormalizedProduct> = {}): NormalizedProduct => ({
    id: 'mercadona:12345',
    externalId: '12345',
    supermarket: 'mercadona',
    name: 'Test Product',
    price: 2.50,
    pricePerUnit: 2.50,
    unit: 'unit',
    size: 1,
    sizeFormat: '1 ud',
    category: 'Test',
    available: true,
    lastUpdated: new Date(),
    ...overrides,
  });

  const createMockSearchResult = (products: NormalizedProduct[]): SearchResult => ({
    products,
    total: products.length,
    hasMore: false,
    query: 'test',
    options: { limit: 20, offset: 0, categoryId: '', minPrice: 0, maxPrice: Infinity, sortBy: 'relevance', sortOrder: 'asc' },
  });

  beforeEach(() => {
    mockAdapter = {
      id: 'mercadona',
      searchProducts: vi.fn(),
    };

    mockFactory = {
      getAdapter: vi.fn().mockReturnValue(mockAdapter),
      getAllAdapters: vi.fn().mockReturnValue([mockAdapter]),
    };

    (SupermarketFactory.getInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockFactory);

    resetIngredientMapper();
    mapper = new IngredientMapper();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapIngredientToProducts', () => {
    it('should find matching products for common ingredients', async () => {
      const mockProducts = [
        createMockProduct({ name: 'Leche Entera Hacendado', price: 1.25 }),
        createMockProduct({ name: 'Leche Semidesnatada Hacendado', price: 1.20 }),
      ];

      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult(mockProducts));

      const result = await mapper.mapIngredientToProducts('leche');

      expect(result.ingredientName).toBe('leche');
      expect(result.hasRealPrice).toBe(true);
      expect(result.matchedProducts.length).toBeGreaterThan(0);
    });

    it('should return estimated price when no matches found', async () => {
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult([]));

      const result = await mapper.mapIngredientToProducts('ingrediente_raro_inexistente');

      expect(result.hasRealPrice).toBe(false);
      expect(result.matchedProducts).toHaveLength(0);
      expect(result.estimatedPrice).toBeDefined();
      expect(result.estimatedPrice).toBeGreaterThan(0);
    });

    it('should calculate confidence scores correctly', async () => {
      const mockProducts = [
        createMockProduct({ name: 'Pollo', price: 5.50 }), // Exact match
        createMockProduct({ name: 'Pechuga de Pollo', price: 7.00 }), // Contains query
        createMockProduct({ name: 'Muslo de Pollo', price: 4.50 }), // Contains query
      ];

      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult(mockProducts));

      const result = await mapper.mapIngredientToProducts('pollo');

      expect(result.matchedProducts.length).toBeGreaterThan(0);
      // Higher confidence matches should come first
      expect(result.matchedProducts[0].confidence).toBeGreaterThanOrEqual(result.matchedProducts[result.matchedProducts.length - 1].confidence);
    });

    it('should filter by specific supermarket when provided', async () => {
      const result = await mapper.mapIngredientToProducts('leche', ['mercadona']);

      expect(mockFactory.getAdapter).toHaveBeenCalledWith('mercadona');
    });

    it('should cache results for repeated queries', async () => {
      const mockProducts = [createMockProduct({ name: 'Leche Entera', price: 1.25 })];
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult(mockProducts));

      // First call
      await mapper.mapIngredientToProducts('leche');
      
      // Second call - should use cache
      await mapper.mapIngredientToProducts('leche');

      // searchProducts should only be called once due to caching
      expect(mockAdapter.searchProducts).toHaveBeenCalledTimes(1);
    });
  });

  describe('mapIngredients (batch)', () => {
    it('should map multiple ingredients at once', async () => {
      const mockProducts = [createMockProduct({ name: 'Test', price: 1.00 })];
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult(mockProducts));

      const results = await mapper.mapIngredients(['leche', 'huevos', 'pan']);

      expect(results.size).toBe(3);
      expect(results.has('leche')).toBe(true);
      expect(results.has('huevos')).toBe(true);
      expect(results.has('pan')).toBe(true);
    });

    it('should handle errors gracefully for individual ingredients', async () => {
      mockAdapter.searchProducts
        .mockResolvedValueOnce(createMockSearchResult([createMockProduct({ name: 'Leche', price: 1.00 })]))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockSearchResult([createMockProduct({ name: 'Pan', price: 1.50 })]));

      const results = await mapper.mapIngredients(['leche', 'huevos', 'pan']);

      expect(results.size).toBe(3);
      // Even failed ingredients should have a result (with estimated price)
    });
  });

  describe('getBestMatch', () => {
    it('should return the best matching product', async () => {
      const mockProducts = [
        createMockProduct({ name: 'Leche Entera Hacendado 1L', price: 1.25 }),
        createMockProduct({ name: 'Leche Desnatada', price: 1.20 }),
      ];

      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult(mockProducts));

      const bestMatch = await mapper.getBestMatch('leche', 'mercadona');

      expect(bestMatch).not.toBeNull();
    });

    it('should return null when no matches found', async () => {
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult([]));

      const bestMatch = await mapper.getBestMatch('producto_inexistente', 'mercadona');

      expect(bestMatch).toBeNull();
    });
  });

  describe('known mappings', () => {
    it('should use known mappings for common ingredients', async () => {
      const mockProducts = [createMockProduct({ name: 'Leche Entera', price: 1.25 })];
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult(mockProducts));

      await mapper.mapIngredientToProducts('leche');

      // Should search for known queries like 'leche entera'
      const calls = mockAdapter.searchProducts.mock.calls;
      expect(calls.some((call: unknown[]) => (call[0] as string).includes('leche'))).toBe(true);
    });
  });

  describe('getIngredientMapper singleton', () => {
    it('should return the same instance', () => {
      const mapper1 = getIngredientMapper();
      const mapper2 = getIngredientMapper();

      expect(mapper1).toBe(mapper2);
    });

    it('should create new instance after reset', () => {
      const mapper1 = getIngredientMapper();
      resetIngredientMapper();
      const mapper2 = getIngredientMapper();

      expect(mapper1).not.toBe(mapper2);
    });
  });

  describe('estimated prices', () => {
    it('should provide reasonable estimates for common ingredients', async () => {
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult([]));

      const pollo = await mapper.mapIngredientToProducts('pollo');
      const leche = await mapper.mapIngredientToProducts('leche');
      const arroz = await mapper.mapIngredientToProducts('arroz');

      expect(pollo.estimatedPrice).toBeGreaterThan(0);
      expect(leche.estimatedPrice).toBeGreaterThan(0);
      expect(arroz.estimatedPrice).toBeGreaterThan(0);
    });

    it('should use default estimate for unknown ingredients', async () => {
      mockAdapter.searchProducts.mockResolvedValue(createMockSearchResult([]));

      const result = await mapper.mapIngredientToProducts('ingrediente_muy_raro');

      expect(result.estimatedPrice).toBe(2.50); // Default estimate
    });
  });
});
