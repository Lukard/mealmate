/**
 * Ingredient Mapper Service
 * Maps recipe ingredients to supermarket products using fuzzy matching
 */

import {
  NormalizedProduct,
  SupermarketId,
  IngredientPriceResult,
} from './types';
import { SupermarketFactory } from './factory';
import { CacheService, CacheKeys, getCache } from './cache';

/**
 * Mapping confidence thresholds
 */
const CONFIDENCE = {
  EXACT: 1.0,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
  MINIMUM: 0.3,
};

/**
 * Known ingredient to product mappings
 * These are manually curated for common ingredients
 */
const KNOWN_MAPPINGS: Record<string, { query: string; category?: string }[]> = {
  // Lácteos
  'leche': [{ query: 'leche entera' }, { query: 'leche semidesnatada' }],
  'huevos': [{ query: 'huevos camperos' }, { query: 'huevos L' }],
  'mantequilla': [{ query: 'mantequilla' }],
  'yogur': [{ query: 'yogur natural' }],
  'queso': [{ query: 'queso rallado' }, { query: 'queso manchego' }],
  'nata': [{ query: 'nata para cocinar' }, { query: 'nata montada' }],
  
  // Carnes
  'pollo': [{ query: 'pechuga pollo' }, { query: 'muslos pollo' }],
  'ternera': [{ query: 'filete ternera' }, { query: 'carne picada ternera' }],
  'cerdo': [{ query: 'lomo cerdo' }, { query: 'costillas cerdo' }],
  'carne picada': [{ query: 'carne picada mixta' }],
  'bacon': [{ query: 'bacon ahumado' }],
  'jamón': [{ query: 'jamón serrano' }, { query: 'jamón york' }],
  
  // Pescados
  'salmón': [{ query: 'salmón fresco' }, { query: 'salmón ahumado' }],
  'atún': [{ query: 'atún claro' }, { query: 'atún fresco' }],
  'merluza': [{ query: 'merluza' }],
  'gambas': [{ query: 'gambas peladas' }, { query: 'langostinos' }],
  
  // Verduras
  'tomate': [{ query: 'tomate rama' }, { query: 'tomate frito' }],
  'cebolla': [{ query: 'cebolla' }],
  'ajo': [{ query: 'ajo' }],
  'patata': [{ query: 'patata' }],
  'pimiento': [{ query: 'pimiento rojo' }, { query: 'pimiento verde' }],
  'zanahoria': [{ query: 'zanahoria' }],
  'lechuga': [{ query: 'lechuga romana' }, { query: 'lechuga iceberg' }],
  'espinacas': [{ query: 'espinacas' }],
  'calabacín': [{ query: 'calabacín' }],
  'berenjena': [{ query: 'berenjena' }],
  
  // Frutas
  'manzana': [{ query: 'manzana golden' }, { query: 'manzana fuji' }],
  'plátano': [{ query: 'plátano canarias' }],
  'naranja': [{ query: 'naranja zumo' }, { query: 'naranja mesa' }],
  'limón': [{ query: 'limón' }],
  
  // Básicos
  'arroz': [{ query: 'arroz redondo' }, { query: 'arroz basmati' }],
  'pasta': [{ query: 'espagueti' }, { query: 'macarrones' }],
  'pan': [{ query: 'pan de molde' }, { query: 'barra pan' }],
  'harina': [{ query: 'harina trigo' }],
  'aceite': [{ query: 'aceite oliva virgen extra' }],
  'aceite de oliva': [{ query: 'aceite oliva virgen extra' }],
  'sal': [{ query: 'sal' }],
  'azúcar': [{ query: 'azúcar blanco' }],
  'pimienta': [{ query: 'pimienta negra molida' }],
  
  // Legumbres
  'lentejas': [{ query: 'lentejas pardinas' }],
  'garbanzos': [{ query: 'garbanzos cocidos' }],
  'alubias': [{ query: 'alubias blancas' }],
  
  // Conservas
  'tomate triturado': [{ query: 'tomate triturado' }],
  'tomate frito': [{ query: 'tomate frito' }],
};

/**
 * Ingredient Mapper Service
 */
export class IngredientMapper {
  private cache: CacheService;
  private factory: SupermarketFactory;
  private mappingCache: Map<string, IngredientPriceResult> = new Map();

  constructor(cache?: CacheService) {
    this.cache = cache || getCache();
    this.factory = SupermarketFactory.getInstance();
  }

  /**
   * Map an ingredient name to supermarket products
   */
  async mapIngredientToProducts(
    ingredientName: string,
    supermarketIds?: SupermarketId[]
  ): Promise<IngredientPriceResult> {
    const normalizedName = this.normalizeIngredient(ingredientName);
    const cacheKey = `ingredient:${normalizedName}:${supermarketIds?.join(',') || 'all'}`;

    // Check memory cache
    const cached = this.mappingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check persistent cache
    const persistentCached = this.cache.get<IngredientPriceResult>(cacheKey);
    if (persistentCached) {
      this.mappingCache.set(cacheKey, persistentCached);
      return persistentCached;
    }

    // Get adapters to search
    const adapters = supermarketIds
      ? supermarketIds.map(id => this.factory.getAdapter(id))
      : this.factory.getAllAdapters();

    const allMatches: IngredientPriceResult['matchedProducts'] = [];

    // Get search queries for this ingredient
    const searchQueries = this.getSearchQueries(normalizedName);

    // Search in each supermarket
    for (const adapter of adapters) {
      for (const queryInfo of searchQueries) {
        try {
          const result = await adapter.searchProducts(queryInfo.query, { limit: 5 });
          
          for (const product of result.products) {
            const confidence = this.calculateConfidence(
              normalizedName,
              product.name,
              queryInfo.query
            );
            
            if (confidence >= CONFIDENCE.MINIMUM) {
              allMatches.push({
                product,
                confidence,
                supermarket: adapter.id,
              });
            }
          }
        } catch {
          // Skip failed searches
          continue;
        }
      }
    }

    // Sort by confidence (descending) then price (ascending)
    allMatches.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.product.price - b.product.price;
    });

    // Remove duplicates (same product from same supermarket)
    const seen = new Set<string>();
    const uniqueMatches = allMatches.filter(match => {
      const key = `${match.supermarket}:${match.product.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Find best price
    const bestPrice = uniqueMatches.length > 0
      ? {
          product: uniqueMatches[0].product,
          supermarket: uniqueMatches[0].supermarket,
        }
      : undefined;

    const result: IngredientPriceResult = {
      ingredientName,
      matchedProducts: uniqueMatches.slice(0, 10), // Top 10 matches
      bestPrice,
      hasRealPrice: uniqueMatches.length > 0,
      estimatedPrice: this.getEstimatedPrice(normalizedName),
    };

    // Cache the result
    this.mappingCache.set(cacheKey, result);
    this.cache.set(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL

    return result;
  }

  /**
   * Map multiple ingredients at once
   */
  async mapIngredients(
    ingredientNames: string[],
    supermarketIds?: SupermarketId[]
  ): Promise<Map<string, IngredientPriceResult>> {
    const results = new Map<string, IngredientPriceResult>();

    // Process in parallel with concurrency limit
    const batchSize = 3;
    for (let i = 0; i < ingredientNames.length; i += batchSize) {
      const batch = ingredientNames.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(name => this.mapIngredientToProducts(name, supermarketIds))
      );
      
      batch.forEach((name, idx) => {
        results.set(name, batchResults[idx]);
      });
    }

    return results;
  }

  /**
   * Get the best match for an ingredient from a specific supermarket
   */
  async getBestMatch(
    ingredientName: string,
    supermarketId: SupermarketId
  ): Promise<NormalizedProduct | null> {
    const result = await this.mapIngredientToProducts(ingredientName, [supermarketId]);
    
    if (result.matchedProducts.length === 0) {
      return null;
    }

    return result.matchedProducts[0].product;
  }

  /**
   * Clear the mapping cache
   */
  clearCache(): void {
    this.mappingCache.clear();
    this.cache.deleteByPrefix('ingredient:');
  }

  // ==================== Private helper methods ====================

  /**
   * Normalize ingredient name for matching
   */
  private normalizeIngredient(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get search queries for an ingredient
   */
  private getSearchQueries(normalizedName: string): { query: string; category?: string }[] {
    // Check if we have known mappings
    const knownMapping = KNOWN_MAPPINGS[normalizedName];
    if (knownMapping) {
      return knownMapping;
    }

    // Try partial matches
    for (const [key, queries] of Object.entries(KNOWN_MAPPINGS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return queries;
      }
    }

    // Default to searching the ingredient name directly
    return [{ query: normalizedName }];
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(
    ingredientName: string,
    productName: string,
    searchQuery: string
  ): number {
    const normalizedProduct = this.normalizeIngredient(productName);
    const normalizedIngredient = this.normalizeIngredient(ingredientName);
    const normalizedQuery = this.normalizeIngredient(searchQuery);

    // Exact match
    if (normalizedProduct === normalizedIngredient) {
      return CONFIDENCE.EXACT;
    }

    // Product name contains the exact query
    if (normalizedProduct.includes(normalizedQuery)) {
      return CONFIDENCE.HIGH;
    }

    // Calculate word overlap
    const ingredientWords = normalizedIngredient.split(/\s+/);
    const productWords = normalizedProduct.split(/\s+/);
    
    const matchingWords = ingredientWords.filter(word =>
      productWords.some(pw => pw.includes(word) || word.includes(pw))
    );

    const wordOverlapRatio = matchingWords.length / ingredientWords.length;

    if (wordOverlapRatio >= 0.8) {
      return CONFIDENCE.HIGH;
    }
    if (wordOverlapRatio >= 0.5) {
      return CONFIDENCE.MEDIUM;
    }
    if (wordOverlapRatio >= 0.3) {
      return CONFIDENCE.LOW;
    }

    // Use Levenshtein-like similarity
    const similarity = this.calculateSimilarity(normalizedIngredient, normalizedProduct);
    
    return Math.max(similarity, CONFIDENCE.MINIMUM);
  }

  /**
   * Simple similarity calculation (0-1)
   */
  private calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Check if one contains the other
    if (s2.includes(s1)) return 0.8 * (s1.length / s2.length);
    if (s1.includes(s2)) return 0.8 * (s2.length / s1.length);

    // Calculate character overlap
    const chars1 = new Set(s1.split(''));
    const chars2 = new Set(s2.split(''));
    const intersection = new Set([...chars1].filter(c => chars2.has(c)));
    const union = new Set([...chars1, ...chars2]);

    return intersection.size / union.size;
  }

  /**
   * Get estimated price for an ingredient when no real price is found
   */
  private getEstimatedPrice(ingredientName: string): number {
    // Basic estimates by category (price per typical purchase)
    const estimates: Record<string, number> = {
      // Proteins
      pollo: 5.50,
      ternera: 8.00,
      cerdo: 6.00,
      salmon: 9.00,
      atun: 3.50,
      merluza: 7.00,
      gambas: 8.00,
      huevos: 2.50,
      
      // Dairy
      leche: 1.20,
      queso: 3.50,
      yogur: 1.80,
      mantequilla: 2.50,
      nata: 1.50,
      
      // Vegetables
      tomate: 2.00,
      cebolla: 1.00,
      ajo: 0.80,
      patata: 1.50,
      pimiento: 2.00,
      zanahoria: 1.00,
      lechuga: 1.20,
      espinacas: 2.00,
      
      // Fruits
      manzana: 2.00,
      platano: 1.50,
      naranja: 2.00,
      limon: 0.80,
      
      // Basics
      arroz: 1.20,
      pasta: 1.00,
      pan: 1.50,
      harina: 0.80,
      aceite: 5.00,
      sal: 0.50,
      azucar: 1.00,
    };

    // Check for exact or partial match
    for (const [key, price] of Object.entries(estimates)) {
      if (ingredientName.includes(key) || key.includes(ingredientName)) {
        return price;
      }
    }

    // Default estimate
    return 2.50;
  }
}

// Singleton instance
let mapperInstance: IngredientMapper | null = null;

/**
 * Get or create the global mapper instance
 */
export function getIngredientMapper(): IngredientMapper {
  if (!mapperInstance) {
    mapperInstance = new IngredientMapper();
  }
  return mapperInstance;
}

/**
 * Reset the mapper (useful for testing)
 */
export function resetIngredientMapper(): void {
  if (mapperInstance) {
    mapperInstance.clearCache();
    mapperInstance = null;
  }
}
