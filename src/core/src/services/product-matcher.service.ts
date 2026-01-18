/**
 * Product Matcher Service
 * Matches recipe ingredients to supermarket products with intelligent multi-strategy matching
 */

import type {
  IProductMatcher,
  ProductMatch,
  GroceryItem,
  MeasurementUnit,
  ISupermarketScraper,
  Product,
  MatchType,
  ProductMatchAlternative,
  IngredientCategory
} from '@meal-automation/shared';
import type { SupermarketId } from '@meal-automation/shared';

import {
  getSpanishTranslations,
  getAllSearchTerms,
  normalizeIngredientName,
  extractKeyTerms,
  calculateStringSimilarity,
  areStringsSimilar,
  getSpanishCategories
} from '../utils/spanish-ingredients.js';

/**
 * Configuration for the product matcher service
 */
export interface ProductMatcherConfig {
  /** Minimum confidence threshold for matches (0-1) */
  readonly minConfidence: number;

  /** Maximum alternatives to return per match */
  readonly maxAlternatives: number;

  /** Weight for name similarity in matching algorithm */
  readonly nameSimilarityWeight: number;

  /** Weight for category matching in algorithm */
  readonly categoryMatchWeight: number;

  /** Weight for price efficiency in algorithm */
  readonly priceEfficiencyWeight: number;

  /** Fuzzy match threshold (0-1) */
  readonly fuzzyMatchThreshold: number;

  /** Enable Spanish language support */
  readonly enableSpanishSupport: boolean;

  /** Maximum products to fetch per search */
  readonly maxSearchResults: number;
}

/**
 * Strategy used for matching
 */
export type MatchStrategy = 'exact' | 'fuzzy' | 'semantic' | 'keyword' | 'category' | 'translation';

/**
 * Extended match result with strategy information
 */
export interface ExtendedMatchResult {
  /** The original ingredient name */
  ingredient: string;

  /** Normalized ingredient name used for matching */
  normalizedIngredient: string;

  /** All product matches found */
  matches: ScoredProductMatch[];

  /** Overall confidence score */
  confidence: number;

  /** Strategy that produced the best match */
  strategy: MatchStrategy;

  /** Search terms that were tried */
  searchTermsTried: string[];

  /** Time taken in milliseconds */
  matchTimeMs: number;
}

/**
 * Product match with detailed scoring information
 */
export interface ScoredProductMatch {
  /** The matched product */
  product: Product;

  /** Overall match score (0-1) */
  score: number;

  /** Name similarity score */
  nameSimilarity: number;

  /** Category match score */
  categoryMatch: number;

  /** Price efficiency score */
  priceEfficiency: number;

  /** Price per serving for the needed quantity */
  pricePerServing: number;

  /** Strategy used to find this match */
  strategy: MatchStrategy;

  /** Explanation of why this product was matched */
  matchExplanation: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ProductMatcherConfig = {
  minConfidence: 0.3,
  maxAlternatives: 5,
  nameSimilarityWeight: 0.5,
  categoryMatchWeight: 0.3,
  priceEfficiencyWeight: 0.2,
  fuzzyMatchThreshold: 0.7,
  enableSpanishSupport: true,
  maxSearchResults: 30
};

/**
 * Service for matching ingredients to products with multi-strategy approach
 */
export class ProductMatcherService implements IProductMatcher {
  private readonly config: ProductMatcherConfig;
  private readonly scrapers = new Map<SupermarketId, ISupermarketScraper>();

  constructor(config: Partial<ProductMatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a scraper for a supermarket
   */
  registerScraper(supermarketId: SupermarketId, scraper: ISupermarketScraper): void {
    this.scrapers.set(supermarketId, scraper);
  }

  /**
   * Get all registered supermarket IDs
   */
  getRegisteredSupermarkets(): SupermarketId[] {
    return Array.from(this.scrapers.keys());
  }

  /**
   * Find the best product matches for an ingredient using multi-strategy approach
   */
  async findMatches(
    ingredientName: string,
    quantity: number,
    unit: MeasurementUnit,
    supermarketId: SupermarketId
  ): Promise<readonly ProductMatch[]> {
    const startTime = Date.now();

    const scraper = this.scrapers.get(supermarketId);
    if (!scraper) {
      throw new Error(`No scraper registered for supermarket: ${supermarketId}`);
    }

    // Normalize the ingredient name
    const normalizedIngredient = normalizeIngredientName(ingredientName);

    // Get all search terms to try (including translations)
    const searchTerms = this.config.enableSpanishSupport
      ? getAllSearchTerms(normalizedIngredient)
      : [normalizedIngredient];

    const searchTermsTried: string[] = [];
    let allProducts: Product[] = [];

    // Strategy 1: Exact match search
    const exactMatch = await this.tryExactMatch(scraper, searchTerms, supermarketId);
    searchTermsTried.push(...exactMatch.termsTried);
    if (exactMatch.products.length > 0) {
      allProducts.push(...exactMatch.products);
    }

    // Strategy 2: Fuzzy/keyword search if exact match yields few results
    if (allProducts.length < 5) {
      const keyTerms = extractKeyTerms(normalizedIngredient);
      const fuzzyMatch = await this.tryFuzzyMatch(scraper, keyTerms, supermarketId);
      searchTermsTried.push(...fuzzyMatch.termsTried);
      allProducts.push(...fuzzyMatch.products);
    }

    // Strategy 3: Category-based search as fallback
    if (allProducts.length < 3) {
      const category = this.inferCategory(ingredientName);
      if (category) {
        const categoryMatch = await this.tryCategoryMatch(scraper, category, supermarketId);
        allProducts.push(...categoryMatch.products);
      }
    }

    // Remove duplicates by product ID
    allProducts = this.deduplicateProducts(allProducts);

    // If no products found, return not found result
    if (allProducts.length === 0) {
      return [this.createNotFoundMatch(ingredientName, quantity, unit, supermarketId)];
    }

    // Score and rank all products
    const scoredProducts = allProducts.map(product => this.scoreProduct(
      ingredientName,
      normalizedIngredient,
      product,
      quantity,
      unit
    ));

    // Sort by score descending
    scoredProducts.sort((a, b) => b.score - a.score);

    // Filter by minimum confidence
    const viableMatches = scoredProducts.filter(p => p.score >= this.config.minConfidence);

    if (viableMatches.length === 0) {
      return [this.createNotFoundMatch(ingredientName, quantity, unit, supermarketId)];
    }

    // Create the primary match
    const bestMatch = viableMatches[0];
    const quantityToBuy = this.calculateQuantityToBuy(quantity, unit, bestMatch.product);

    // Create alternatives
    const alternatives: ProductMatchAlternative[] = viableMatches
      .slice(1, this.config.maxAlternatives + 1)
      .map(alt => this.createAlternative(alt, bestMatch));

    const match: ProductMatch = {
      id: this.generateMatchId(),
      ingredientName,
      quantityNeeded: quantity,
      unitNeeded: unit,
      product: bestMatch.product,
      confidence: bestMatch.score,
      quantityToBuy,
      totalCostCents: quantityToBuy * bestMatch.product.price.currentPriceCents,
      matchType: this.determineMatchType(bestMatch.score, bestMatch.strategy),
      matchReason: bestMatch.matchExplanation,
      alternatives
    };

    return [match];
  }

  /**
   * Advanced matching with detailed results
   */
  async findMatchesAdvanced(
    ingredientName: string,
    quantity: number,
    unit: MeasurementUnit,
    supermarketId: SupermarketId
  ): Promise<ExtendedMatchResult> {
    const startTime = Date.now();

    const scraper = this.scrapers.get(supermarketId);
    if (!scraper) {
      throw new Error(`No scraper registered for supermarket: ${supermarketId}`);
    }

    const normalizedIngredient = normalizeIngredientName(ingredientName);
    const searchTerms = this.config.enableSpanishSupport
      ? getAllSearchTerms(normalizedIngredient)
      : [normalizedIngredient];

    const searchTermsTried: string[] = [];
    let allProducts: Product[] = [];
    let bestStrategy: MatchStrategy = 'exact';

    // Try all strategies
    const exactMatch = await this.tryExactMatch(scraper, searchTerms, supermarketId);
    searchTermsTried.push(...exactMatch.termsTried);
    if (exactMatch.products.length > 0) {
      allProducts.push(...exactMatch.products);
      bestStrategy = 'exact';
    }

    const keyTerms = extractKeyTerms(normalizedIngredient);
    const fuzzyMatch = await this.tryFuzzyMatch(scraper, keyTerms, supermarketId);
    searchTermsTried.push(...fuzzyMatch.termsTried);
    if (fuzzyMatch.products.length > allProducts.length) {
      allProducts = fuzzyMatch.products;
      bestStrategy = 'fuzzy';
    }

    const category = this.inferCategory(ingredientName);
    if (category && allProducts.length < 3) {
      const categoryMatch = await this.tryCategoryMatch(scraper, category, supermarketId);
      if (categoryMatch.products.length > 0) {
        allProducts.push(...categoryMatch.products);
        if (allProducts.length === categoryMatch.products.length) {
          bestStrategy = 'category';
        }
      }
    }

    allProducts = this.deduplicateProducts(allProducts);

    const scoredProducts = allProducts.map(product => this.scoreProduct(
      ingredientName,
      normalizedIngredient,
      product,
      quantity,
      unit
    ));

    scoredProducts.sort((a, b) => b.score - a.score);

    const matchTimeMs = Date.now() - startTime;

    return {
      ingredient: ingredientName,
      normalizedIngredient,
      matches: scoredProducts,
      confidence: scoredProducts.length > 0 ? scoredProducts[0].score : 0,
      strategy: bestStrategy,
      searchTermsTried,
      matchTimeMs
    };
  }

  /**
   * Match all ingredients in a grocery list with optimization
   */
  async matchGroceryList(
    items: readonly GroceryItem[],
    supermarketId: SupermarketId
  ): Promise<readonly GroceryItem[]> {
    const matchedItems: GroceryItem[] = [];

    // Process items in parallel batches for efficiency
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          const matches = await this.findMatches(
            item.ingredientName,
            item.totalQuantity,
            item.unit,
            supermarketId
          );

          return {
            ...item,
            matches,
            selectedMatch: matches[0] // Auto-select best match
          } as GroceryItem;
        })
      );

      matchedItems.push(...batchResults);
    }

    return matchedItems;
  }

  /**
   * Match grocery list across multiple supermarkets for comparison
   */
  async matchGroceryListMultiple(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<Map<SupermarketId, readonly GroceryItem[]>> {
    const results = new Map<SupermarketId, readonly GroceryItem[]>();

    await Promise.all(
      supermarketIds.map(async (supermarketId) => {
        if (this.scrapers.has(supermarketId)) {
          const matchedItems = await this.matchGroceryList(items, supermarketId);
          results.set(supermarketId, matchedItems);
        }
      })
    );

    return results;
  }

  /**
   * Get a human-readable explanation of a match
   */
  explainMatch(match: ProductMatch): string {
    if (match.matchType === 'not_found') {
      return `Could not find a product matching "${match.ingredientName}". ` +
        'You may need to find this item manually or try a different supermarket.';
    }

    const confidencePercent = Math.round(match.confidence * 100);
    const product = match.product;

    let explanation = `Matched "${match.ingredientName}" to "${product.name}" `;
    explanation += `with ${confidencePercent}% confidence.`;

    if (match.matchType === 'substitute') {
      explanation += ' This is a substitute product that should work for your recipe.';
    } else if (match.matchType === 'similar') {
      explanation += ' This is a similar product from a different brand or size.';
    } else if (match.matchType === 'exact') {
      explanation += ' This is an excellent match for your ingredient.';
    }

    if (match.quantityToBuy > 1) {
      explanation += ` You'll need ${match.quantityToBuy} packages `;
      explanation += `(${product.packageSize.display} each).`;
    } else {
      explanation += ` One package of ${product.packageSize.display} should be sufficient.`;
    }

    if (product.promotion) {
      explanation += ` Currently on promotion: ${product.promotion.description}.`;
    }

    if (match.alternatives.length > 0) {
      const cheaper = match.alternatives.filter(a => a.priceDifferenceCents < 0);
      if (cheaper.length > 0) {
        const savings = Math.abs(cheaper[0].priceDifferenceCents / 100).toFixed(2);
        explanation += ` Cheaper alternative available (save ${savings}).`;
      }
    }

    return explanation;
  }

  // ==================== Private Methods ====================

  /**
   * Try exact match search
   */
  private async tryExactMatch(
    scraper: ISupermarketScraper,
    searchTerms: string[],
    supermarketId: SupermarketId
  ): Promise<{ products: Product[]; termsTried: string[] }> {
    const products: Product[] = [];
    const termsTried: string[] = [];

    for (const term of searchTerms.slice(0, 5)) { // Limit terms to try
      termsTried.push(term);
      try {
        const result = await scraper.searchProducts({
          query: term,
          supermarketId,
          inStockOnly: true,
          organicOnly: false,
          promotionsOnly: false,
          limit: this.config.maxSearchResults,
          sortBy: 'relevance'
        });

        if (result.products.length > 0) {
          products.push(...result.products);
          break; // Found results, stop searching
        }
      } catch (error) {
        // Continue with next term
        console.warn(`Search failed for term "${term}":`, error);
      }
    }

    return { products: [...products], termsTried };
  }

  /**
   * Try fuzzy/keyword match search
   */
  private async tryFuzzyMatch(
    scraper: ISupermarketScraper,
    keyTerms: string[],
    supermarketId: SupermarketId
  ): Promise<{ products: Product[]; termsTried: string[] }> {
    const products: Product[] = [];
    const termsTried: string[] = [];

    // Search with individual key terms
    for (const term of keyTerms.slice(0, 3)) {
      if (term.length < 3) continue;

      // Also try Spanish translations of key terms
      const translatedTerms = this.config.enableSpanishSupport
        ? getSpanishTranslations(term)
        : [];

      for (const searchTerm of [term, ...translatedTerms.slice(0, 2)]) {
        termsTried.push(searchTerm);
        try {
          const result = await scraper.searchProducts({
            query: searchTerm,
            supermarketId,
            inStockOnly: true,
            organicOnly: false,
            promotionsOnly: false,
            limit: 10,
            sortBy: 'relevance'
          });

          products.push(...result.products);
        } catch (error) {
          console.warn(`Fuzzy search failed for term "${searchTerm}":`, error);
        }
      }
    }

    return { products, termsTried };
  }

  /**
   * Try category-based match search
   */
  private async tryCategoryMatch(
    scraper: ISupermarketScraper,
    category: IngredientCategory,
    supermarketId: SupermarketId
  ): Promise<{ products: Product[] }> {
    const products: Product[] = [];

    // Get Spanish category names
    const categoryNames = this.config.enableSpanishSupport
      ? getSpanishCategories(category)
      : [category];

    for (const catName of categoryNames.slice(0, 2)) {
      try {
        const categoryProducts = await scraper.getProductsByCategory(catName, 20);
        products.push(...categoryProducts);
        if (products.length >= 10) break;
      } catch (error) {
        console.warn(`Category search failed for "${catName}":`, error);
      }
    }

    return { products };
  }

  /**
   * Score a product against an ingredient
   */
  private scoreProduct(
    originalIngredient: string,
    normalizedIngredient: string,
    product: Product,
    quantity: number,
    unit: MeasurementUnit
  ): ScoredProductMatch {
    const productName = product.name.toLowerCase();
    let strategy: MatchStrategy = 'semantic';
    let matchExplanation = '';

    // Calculate name similarity score
    let nameSimilarity = 0;

    // Check for exact match
    if (productName === normalizedIngredient || productName.includes(normalizedIngredient)) {
      nameSimilarity = 1.0;
      strategy = 'exact';
      matchExplanation = 'Exact name match';
    }
    // Check for fuzzy match using Levenshtein
    else if (areStringsSimilar(productName, normalizedIngredient, this.config.fuzzyMatchThreshold)) {
      nameSimilarity = calculateStringSimilarity(productName, normalizedIngredient);
      strategy = 'fuzzy';
      matchExplanation = `Fuzzy match (${Math.round(nameSimilarity * 100)}% similar)`;
    }
    // Check for translation match
    else {
      const spanishTerms = getSpanishTranslations(normalizedIngredient);
      for (const spanishTerm of spanishTerms) {
        if (productName.includes(spanishTerm) || areStringsSimilar(productName, spanishTerm, 0.6)) {
          nameSimilarity = 0.9;
          strategy = 'translation';
          matchExplanation = `Spanish translation match: "${spanishTerm}"`;
          break;
        }
      }
    }

    // Keyword-based matching as fallback
    if (nameSimilarity === 0) {
      const ingredientWords = extractKeyTerms(normalizedIngredient);
      const productWords = productName.split(' ').filter(w => w.length > 2);

      const matchingWords = ingredientWords.filter(word =>
        productWords.some(pw =>
          pw.includes(word) || word.includes(pw) || areStringsSimilar(pw, word, 0.7)
        )
      );

      if (matchingWords.length > 0) {
        nameSimilarity = Math.min(0.8, matchingWords.length / Math.max(ingredientWords.length, 1));
        strategy = 'keyword';
        matchExplanation = `Keyword match: "${matchingWords.join(', ')}"`;
      }
    }

    // Category matching score
    const inferredCategory = this.inferCategory(originalIngredient);
    const categoryMatch = inferredCategory && product.category === inferredCategory ? 1.0 : 0.5;

    // Price efficiency score (prefer products with price per unit info and better value)
    let priceEfficiency = 0.8;
    if (product.price.pricePerUnit) {
      // Lower price per unit = higher efficiency
      priceEfficiency = 1.0;
    }
    if (product.promotion) {
      priceEfficiency += 0.1; // Bonus for promotions
    }
    if (product.isStoreBrand) {
      priceEfficiency += 0.05; // Slight bonus for store brands (usually cheaper)
    }
    priceEfficiency = Math.min(1.0, priceEfficiency);

    // Calculate price per serving
    const quantityToBuy = this.calculateQuantityToBuy(quantity, unit, product);
    const totalCost = quantityToBuy * product.price.currentPriceCents;
    const pricePerServing = totalCost / Math.max(quantity, 1);

    // Weighted final score
    const score = Math.min(1.0, Math.max(0,
      nameSimilarity * this.config.nameSimilarityWeight +
      categoryMatch * this.config.categoryMatchWeight +
      priceEfficiency * this.config.priceEfficiencyWeight
    ));

    return {
      product,
      score,
      nameSimilarity,
      categoryMatch,
      priceEfficiency,
      pricePerServing,
      strategy,
      matchExplanation: matchExplanation || 'Low confidence match'
    };
  }

  /**
   * Infer ingredient category from name
   */
  private inferCategory(ingredientName: string): IngredientCategory | null {
    const ingredient = ingredientName.toLowerCase();

    // Category keyword mappings
    const categoryKeywords: Record<IngredientCategory, string[]> = {
      meat: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'rabbit',
        'pollo', 'ternera', 'cerdo', 'cordero', 'pavo', 'carne'],
      seafood: ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'squid',
        'pescado', 'salmon', 'atun', 'bacalao', 'gambas', 'calamar', 'marisco'],
      dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg',
        'leche', 'queso', 'yogur', 'mantequilla', 'nata', 'huevo'],
      produce: ['tomato', 'onion', 'garlic', 'carrot', 'lettuce', 'spinach', 'pepper', 'potato',
        'tomate', 'cebolla', 'ajo', 'zanahoria', 'lechuga', 'espinaca', 'pimiento', 'patata',
        'apple', 'orange', 'lemon', 'banana', 'manzana', 'naranja', 'limon', 'platano'],
      bakery: ['bread', 'baguette', 'roll', 'pan', 'bolleria'],
      frozen: ['frozen', 'congelado'],
      canned: ['canned', 'conserva', 'enlatado'],
      dry_goods: ['rice', 'pasta', 'flour', 'oats', 'quinoa', 'lentils', 'beans',
        'arroz', 'pasta', 'harina', 'avena', 'quinoa', 'lentejas', 'judias'],
      condiments: ['oil', 'vinegar', 'sauce', 'ketchup', 'mayonnaise', 'mustard',
        'aceite', 'vinagre', 'salsa', 'mayonesa', 'mostaza'],
      spices: ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme',
        'sal', 'pimienta', 'comino', 'pimenton', 'oregano', 'albahaca', 'tomillo'],
      beverages: ['water', 'juice', 'coffee', 'tea', 'wine', 'beer',
        'agua', 'zumo', 'cafe', 'te', 'vino', 'cerveza'],
      other: []
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => ingredient.includes(keyword))) {
        return category as IngredientCategory;
      }
    }

    return null;
  }

  /**
   * Remove duplicate products by ID
   */
  private deduplicateProducts(products: Product[]): Product[] {
    const seen = new Set<string>();
    return products.filter(product => {
      const id = product.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  /**
   * Calculate how many packages to buy
   */
  private calculateQuantityToBuy(
    neededQuantity: number,
    neededUnit: MeasurementUnit,
    product: Product
  ): number {
    const packageSize = product.packageSize;

    // If units match, calculate directly
    if (packageSize.unit === neededUnit) {
      return Math.ceil(neededQuantity / packageSize.value);
    }

    // Try to convert
    if (this.canConvertUnits(neededUnit, packageSize.unit)) {
      const convertedNeeded = this.convertQuantity(neededQuantity, neededUnit, packageSize.unit);
      if (convertedNeeded !== null) {
        return Math.max(1, Math.ceil(convertedNeeded / packageSize.value));
      }
    }

    // If units don't match and can't convert, assume 1 package
    return 1;
  }

  /**
   * Check if two units can be converted
   */
  private canConvertUnits(from: MeasurementUnit, to: MeasurementUnit): boolean {
    const weightUnits: MeasurementUnit[] = ['g', 'kg'];
    const volumeUnits: MeasurementUnit[] = ['ml', 'l', 'tsp', 'tbsp', 'cup'];

    return (
      (weightUnits.includes(from) && weightUnits.includes(to)) ||
      (volumeUnits.includes(from) && volumeUnits.includes(to))
    );
  }

  /**
   * Convert quantity between units
   */
  private convertQuantity(
    quantity: number,
    from: MeasurementUnit,
    to: MeasurementUnit
  ): number | null {
    const conversions: Record<string, number> = {
      'g->kg': 0.001,
      'kg->g': 1000,
      'ml->l': 0.001,
      'l->ml': 1000,
      'tsp->ml': 5,
      'tbsp->ml': 15,
      'cup->ml': 240,
      'ml->tsp': 0.2,
      'ml->tbsp': 0.067,
      'ml->cup': 0.0042,
      'tsp->tbsp': 0.333,
      'tbsp->tsp': 3,
      'tbsp->cup': 0.0625,
      'cup->tbsp': 16
    };

    const key = `${from}->${to}`;
    const factor = conversions[key];

    if (factor !== undefined) {
      return quantity * factor;
    }

    // Try two-step conversion through ml for volume units
    if (conversions[`${from}->ml`] && conversions[`ml->${to}`]) {
      return quantity * conversions[`${from}->ml`] * conversions[`ml->${to}`];
    }

    return null;
  }

  /**
   * Determine the type of match based on score and strategy
   */
  private determineMatchType(score: number, strategy: MatchStrategy): MatchType {
    if (strategy === 'exact' && score >= 0.8) return 'exact';
    if (score >= 0.6) return 'similar';
    if (score >= 0.4) return 'substitute';
    return 'partial';
  }

  /**
   * Create an alternative match object
   */
  private createAlternative(
    alt: ScoredProductMatch,
    bestMatch: ScoredProductMatch
  ): ProductMatchAlternative {
    const priceDiff = alt.product.price.currentPriceCents - bestMatch.product.price.currentPriceCents;

    let reason = '';
    if (priceDiff < 0) {
      reason = `Cheaper option (save \u20AC${(Math.abs(priceDiff) / 100).toFixed(2)})`;
    } else if (alt.product.isOrganic && !bestMatch.product.isOrganic) {
      reason = 'Organic option';
    } else if (alt.product.promotion) {
      reason = `On promotion: ${alt.product.promotion.description}`;
    } else if (alt.product.isStoreBrand) {
      reason = 'Store brand - good value';
    } else {
      reason = 'Alternative brand';
    }

    return {
      product: alt.product,
      confidence: alt.score,
      reason,
      priceDifferenceCents: priceDiff
    };
  }

  /**
   * Create a not found match
   */
  private createNotFoundMatch(
    ingredientName: string,
    quantity: number,
    unit: MeasurementUnit,
    supermarketId: SupermarketId
  ): ProductMatch {
    return {
      id: this.generateMatchId(),
      ingredientName,
      quantityNeeded: quantity,
      unitNeeded: unit,
      product: this.createNotFoundProduct(ingredientName, supermarketId),
      confidence: 0,
      quantityToBuy: 0,
      totalCostCents: 0,
      matchType: 'not_found',
      matchReason: 'No products found matching this ingredient. ' +
        'Try searching with different terms or check another supermarket.',
      alternatives: []
    };
  }

  /**
   * Create a placeholder product for not found items
   */
  private createNotFoundProduct(ingredientName: string, supermarketId: SupermarketId): Product {
    return {
      id: `not-found-${Date.now()}` as any,
      name: ingredientName,
      price: {
        currentPriceCents: 0,
        currency: 'EUR',
        includesVat: true
      },
      category: 'other',
      packageSize: { value: 0, unit: 'piece', display: 'N/A' },
      productUrl: '',
      sku: '',
      supermarketId,
      inStock: false,
      isOrganic: false,
      isStoreBrand: false,
      lastUpdated: new Date()
    };
  }

  /**
   * Generate a unique match ID
   */
  private generateMatchId(): string {
    return `match-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as any;
  }
}

/**
 * Factory function to create a configured product matcher
 */
export function createProductMatcher(config?: Partial<ProductMatcherConfig>): ProductMatcherService {
  return new ProductMatcherService(config);
}
