/**
 * Tests for MercadonaAdapter
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MercadonaAdapter } from '../adapters/mercadona.adapter';
import { SupermarketError } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MercadonaAdapter', () => {
  let adapter: MercadonaAdapter;

  beforeEach(() => {
    adapter = new MercadonaAdapter({ postalCode: '28001' });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with correct id and name', () => {
      expect(adapter.id).toBe('mercadona');
      expect(adapter.name).toBe('Mercadona');
      expect(adapter.baseUrl).toBe('https://tienda.mercadona.es/api');
    });
  });

  describe('getCategories', () => {
    it('should fetch and normalize categories', async () => {
      const mockResponse = {
        results: [
          { id: 1, name: 'Frutas', categories: [] },
          { id: 2, name: 'Lácteos', categories: [
            { id: 21, name: 'Leche' },
            { id: 22, name: 'Yogur' },
          ]},
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const categories = await adapter.getCategories();

      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('Frutas');
      expect(categories[0].supermarket).toBe('mercadona');
      expect(categories[1].children).toHaveLength(2);
    });

    it('should throw SupermarketError on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(adapter.getCategories()).rejects.toThrow(SupermarketError);
    });
  });

  describe('getProduct', () => {
    it('should fetch and normalize a single product', async () => {
      const mockProduct = {
        id: '12345',
        display_name: 'Leche Entera',
        packaging: '1L',
        price_instructions: {
          unit_price: 1.25,
          reference_price: 1.25,
        },
        photos: [
          { zoom: 'http://example.com/zoom.jpg', thumbnail: 'http://example.com/thumb.jpg' }
        ],
        published: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProduct,
      });

      const product = await adapter.getProduct('12345');

      expect(product).not.toBeNull();
      expect(product!.externalId).toBe('12345');
      expect(product!.name).toBe('Leche Entera');
      expect(product!.price).toBe(1.25);
      expect(product!.sizeFormat).toBe('1L');
      expect(product!.available).toBe(true);
    });

    it('should return null for non-existent product', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const product = await adapter.getProduct('99999');
      expect(product).toBeNull();
    });
  });

  describe('getProductsByCategory', () => {
    it('should fetch products for a category', async () => {
      const mockCategory = {
        id: 112,
        name: 'Leche',
        products: [
          {
            id: '1001',
            display_name: 'Leche Entera Hacendado',
            packaging: '1L',
            price_instructions: { unit_price: 0.95 },
            published: true,
          },
          {
            id: '1002',
            display_name: 'Leche Desnatada Hacendado',
            packaging: '1L',
            price_instructions: { unit_price: 0.89 },
            published: true,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategory,
      });

      const result = await adapter.getProductsByCategory('112', { limit: 10 });

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.products[0].name).toBe('Leche Entera Hacendado');
    });

    it('should apply pagination', async () => {
      const mockCategory = {
        id: 112,
        name: 'Leche',
        products: Array.from({ length: 30 }, (_, i) => ({
          id: `${1000 + i}`,
          display_name: `Producto ${i}`,
          packaging: '1L',
          price_instructions: { unit_price: 1.00 + i * 0.1 },
          published: true,
        })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategory,
      });

      const result = await adapter.getProductsByCategory('112', { limit: 10, offset: 5 });

      expect(result.products).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.products[0].name).toBe('Producto 5');
    });
  });

  describe('searchProducts', () => {
    it('should search and return matching products', async () => {
      // First call: getCategories for caching
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: 1, name: 'Lácteos', categories: [] },
          ],
        }),
      });

      // Second call: category products
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          name: 'Lácteos',
          products: [
            {
              id: '1001',
              display_name: 'Leche Entera',
              packaging: '1L',
              price_instructions: { unit_price: 1.25 },
              published: true,
            },
            {
              id: '1002',
              display_name: 'Yogur Natural',
              packaging: '500g',
              price_instructions: { unit_price: 2.50 },
              published: true,
            },
          ],
        }),
      });

      const result = await adapter.searchProducts('leche');

      expect(result.products.length).toBeGreaterThan(0);
      expect(result.query).toBe('leche');
    });
  });

  describe('parsePackaging', () => {
    it('should correctly parse various packaging formats', async () => {
      const testCases = [
        { packaging: '1L', expectedUnit: 'l', expectedSize: 1 },
        { packaging: '500g', expectedUnit: 'g', expectedSize: 500 },
        { packaging: '1kg', expectedUnit: 'kg', expectedSize: 1 },
        { packaging: '250ml', expectedUnit: 'ml', expectedSize: 250 },
        { packaging: '6 unidades', expectedUnit: 'unit', expectedSize: 6 },
        { packaging: 'pack de 4', expectedUnit: 'pack', expectedSize: 4 },
      ];

      for (const testCase of testCases) {
        const mockProduct = {
          id: 'test',
          display_name: 'Test Product',
          packaging: testCase.packaging,
          price_instructions: { unit_price: 1.00 },
          published: true,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockProduct,
        });

        const product = await adapter.getProduct('test');
        
        expect(product!.unit).toBe(testCase.expectedUnit);
        expect(product!.size).toBe(testCase.expectedSize);
      }
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limiting between requests', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ results: [] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const startTime = Date.now();
      
      // Make 3 rapid requests
      await adapter.getCategories();
      await adapter.getCategories();
      await adapter.getCategories();

      const elapsed = Date.now() - startTime;
      
      // Should take at least 2 seconds (3 requests with 1s minimum between each)
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('checkPostalCodeCoverage', () => {
    it('should return true for valid Spanish postal codes', async () => {
      expect(await adapter.checkPostalCodeCoverage('28001')).toBe(true);
      expect(await adapter.checkPostalCodeCoverage('46001')).toBe(true);
      expect(await adapter.checkPostalCodeCoverage('08001')).toBe(true);
    });

    it('should return false for invalid postal codes', async () => {
      expect(await adapter.checkPostalCodeCoverage('99999')).toBe(false);
      expect(await adapter.checkPostalCodeCoverage('abc')).toBe(false);
      expect(await adapter.checkPostalCodeCoverage('')).toBe(false);
    });
  });
});
