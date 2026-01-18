/**
 * Grocery Optimizer Service
 * Optimizes grocery lists for price, availability, and convenience
 */

import type {
  IGroceryOptimizer,
  GroceryItem,
  SupermarketId,
  OptimizationResult,
  SupermarketComparison,
  ISupermarketScraper,
  ProductMatch
} from '@meal-automation/shared';

import { ProductMatcherService } from './product-matcher.service.js';

/**
 * Configuration for the grocery optimizer
 */
export interface GroceryOptimizerConfig {
  /** Product matcher service */
  readonly productMatcher: ProductMatcherService;

  /** Whether to consider delivery costs in optimization */
  readonly includeDeliveryCosts: boolean;

  /** Maximum number of supermarkets to split between */
  readonly maxSupermarkets: number;

  /** Minimum savings to justify split shopping (in cents) */
  readonly minimumSavingsForSplit: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GroceryOptimizerConfig = {
  productMatcher: new ProductMatcherService(),
  includeDeliveryCosts: true,
  maxSupermarkets: 2,
  minimumSavingsForSplit: 500 // 5 EUR minimum savings to justify going to multiple stores
};

/**
 * Service for optimizing grocery shopping
 */
export class GroceryOptimizerService implements IGroceryOptimizer {
  private readonly config: GroceryOptimizerConfig;
  private readonly scrapers = new Map<SupermarketId, ISupermarketScraper>();

  constructor(config: Partial<GroceryOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a scraper for a supermarket
   */
  registerScraper(supermarketId: SupermarketId, scraper: ISupermarketScraper): void {
    this.scrapers.set(supermarketId, scraper);
  }

  /**
   * Optimize grocery list for best prices across supermarkets
   */
  async optimizeForPrice(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<OptimizationResult> {
    // Get prices from all supermarkets
    const pricesByStore = new Map<SupermarketId, Map<string, ProductMatch>>();

    for (const supermarketId of supermarketIds) {
      const matches = new Map<string, ProductMatch>();

      for (const item of items) {
        const itemMatches = await this.config.productMatcher.findMatches(
          item.ingredientName,
          item.totalQuantity,
          item.unit,
          supermarketId
        );

        if (itemMatches.length > 0 && itemMatches[0]!.matchType !== 'not_found') {
          matches.set(item.id, itemMatches[0]!);
        }
      }

      pricesByStore.set(supermarketId, matches);
    }

    // Find the cheapest option for each item
    const optimizedItems: GroceryItem[] = [];
    const usedSupermarkets = new Set<SupermarketId>();
    const unavailableItems: string[] = [];
    let totalCost = 0;

    for (const item of items) {
      let bestMatch: ProductMatch | null = null;
      let bestSupermarket: SupermarketId | null = null;
      let lowestPrice = Infinity;

      for (const supermarketId of supermarketIds) {
        const matches = pricesByStore.get(supermarketId);
        const match = matches?.get(item.id);

        if (match && match.totalCostCents < lowestPrice) {
          lowestPrice = match.totalCostCents;
          bestMatch = match;
          bestSupermarket = supermarketId;
        }
      }

      if (bestMatch && bestSupermarket) {
        optimizedItems.push({
          ...item,
          matches: [bestMatch],
          selectedMatch: bestMatch
        });
        usedSupermarkets.add(bestSupermarket);
        totalCost += bestMatch.totalCostCents;
      } else {
        unavailableItems.push(item.ingredientName);
        optimizedItems.push(item);
      }
    }

    // Calculate average price for comparison
    const averageCost = this.calculateAverageBasketCost(items, pricesByStore);
    const savings = Math.max(0, averageCost - totalCost);

    // Generate suggestions
    const suggestions = this.generateOptimizationSuggestions(
      usedSupermarkets,
      savings,
      unavailableItems
    );

    return {
      items: optimizedItems,
      savingsCents: savings,
      supermarkets: Array.from(usedSupermarkets),
      unavailableItems,
      suggestions
    };
  }

  /**
   * Optimize for availability (maximize in-stock items)
   */
  async optimizeForAvailability(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<OptimizationResult> {
    // Check availability at each supermarket
    const availabilityByStore = new Map<SupermarketId, number>();

    for (const supermarketId of supermarketIds) {
      let availableCount = 0;

      for (const item of items) {
        const matches = await this.config.productMatcher.findMatches(
          item.ingredientName,
          item.totalQuantity,
          item.unit,
          supermarketId
        );

        if (matches.length > 0 && matches[0]!.matchType !== 'not_found') {
          availableCount++;
        }
      }

      availabilityByStore.set(supermarketId, availableCount);
    }

    // Sort supermarkets by availability
    const sortedSupermarkets = Array.from(availabilityByStore.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedSupermarkets.length === 0) {
      return {
        items: [...items],
        savingsCents: 0,
        supermarkets: [],
        unavailableItems: items.map(i => i.ingredientName),
        suggestions: ['No supermarkets available for optimization']
      };
    }

    // Use the supermarket with best availability
    const bestSupermarket = sortedSupermarkets[0]![0];

    // Match all items at the best supermarket
    const optimizedItems: GroceryItem[] = [];
    const unavailableItems: string[] = [];
    let totalCost = 0;

    for (const item of items) {
      const matches = await this.config.productMatcher.findMatches(
        item.ingredientName,
        item.totalQuantity,
        item.unit,
        bestSupermarket
      );

      if (matches.length > 0 && matches[0]!.matchType !== 'not_found') {
        optimizedItems.push({
          ...item,
          matches,
          selectedMatch: matches[0]
        });
        totalCost += matches[0]!.totalCostCents;
      } else {
        unavailableItems.push(item.ingredientName);
        optimizedItems.push(item);
      }
    }

    const suggestions: string[] = [];
    if (unavailableItems.length > 0) {
      suggestions.push(
        `${unavailableItems.length} items not available at ${bestSupermarket}. ` +
        'Consider checking another store for these items.'
      );
    }

    return {
      items: optimizedItems,
      savingsCents: 0,
      supermarkets: [bestSupermarket],
      unavailableItems,
      suggestions
    };
  }

  /**
   * Find the best single supermarket for the entire list
   */
  async findBestSupermarket(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<SupermarketComparison[]> {
    const comparisons: SupermarketComparison[] = [];

    for (const supermarketId of supermarketIds) {
      let totalCost = 0;
      let itemsAvailable = 0;
      let itemsUnavailable = 0;

      for (const item of items) {
        const matches = await this.config.productMatcher.findMatches(
          item.ingredientName,
          item.totalQuantity,
          item.unit,
          supermarketId
        );

        if (matches.length > 0 && matches[0]!.matchType !== 'not_found') {
          totalCost += matches[0]!.totalCostCents;
          itemsAvailable++;
        } else {
          itemsUnavailable++;
        }
      }

      // Get delivery info (would come from supermarket metadata)
      const deliveryInfo = await this.getDeliveryInfo(supermarketId);

      comparisons.push({
        supermarketId,
        totalCostCents: totalCost,
        itemsAvailable,
        itemsUnavailable,
        deliveryAvailable: deliveryInfo.available,
        deliveryCostCents: deliveryInfo.costCents
      });
    }

    // Sort by total cost (including delivery if configured)
    comparisons.sort((a, b) => {
      const costA = a.totalCostCents +
        (this.config.includeDeliveryCosts ? (a.deliveryCostCents ?? 0) : 0);
      const costB = b.totalCostCents +
        (this.config.includeDeliveryCosts ? (b.deliveryCostCents ?? 0) : 0);
      return costA - costB;
    });

    return comparisons;
  }

  /**
   * Calculate average basket cost across all stores
   */
  private calculateAverageBasketCost(
    items: readonly GroceryItem[],
    pricesByStore: Map<SupermarketId, Map<string, ProductMatch>>
  ): number {
    let totalSum = 0;
    let storeCount = 0;

    for (const matches of pricesByStore.values()) {
      let storeCost = 0;
      for (const item of items) {
        const match = matches.get(item.id);
        if (match) {
          storeCost += match.totalCostCents;
        }
      }
      totalSum += storeCost;
      storeCount++;
    }

    return storeCount > 0 ? Math.round(totalSum / storeCount) : 0;
  }

  /**
   * Generate helpful suggestions based on optimization results
   */
  private generateOptimizationSuggestions(
    usedSupermarkets: Set<SupermarketId>,
    savings: number,
    unavailableItems: readonly string[]
  ): string[] {
    const suggestions: string[] = [];

    if (usedSupermarkets.size > 1) {
      suggestions.push(
        `Shopping at ${usedSupermarkets.size} stores saves you ` +
        `${(savings / 100).toFixed(2)} compared to single-store shopping.`
      );
    }

    if (unavailableItems.length > 0 && unavailableItems.length <= 3) {
      suggestions.push(
        `Consider substitutes for: ${unavailableItems.join(', ')}`
      );
    } else if (unavailableItems.length > 3) {
      suggestions.push(
        `${unavailableItems.length} items need substitutes or alternative sourcing.`
      );
    }

    if (savings > 1000) {
      suggestions.push(
        'Great savings! Consider bulk buying frequently used items.'
      );
    }

    return suggestions;
  }

  /**
   * Get delivery information for a supermarket
   */
  private async getDeliveryInfo(
    supermarketId: SupermarketId
  ): Promise<{ available: boolean; costCents?: number }> {
    // In a real implementation, this would fetch from supermarket metadata
    // For now, return default values
    return {
      available: true,
      costCents: 499 // 4.99 EUR default delivery
    };
  }
}
