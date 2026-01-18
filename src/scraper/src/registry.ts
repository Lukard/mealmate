/**
 * Scraper Registry
 * Central registry for managing supermarket scrapers
 */

import type {
  ISupermarketScraper,
  SupermarketId,
  SupermarketChain,
  ScraperStatus,
  ScraperHealthResult
} from '@meal-automation/shared';

/**
 * Scraper registration info
 */
interface ScraperRegistration {
  readonly scraper: ISupermarketScraper;
  readonly chain: SupermarketChain;
  readonly registeredAt: Date;
  lastHealthCheck?: ScraperHealthResult;
}

/**
 * Central registry for supermarket scrapers
 */
export class ScraperRegistry {
  private readonly scrapers = new Map<SupermarketId, ScraperRegistration>();

  /**
   * Register a scraper
   */
  register(
    supermarketId: SupermarketId,
    scraper: ISupermarketScraper,
    chain: SupermarketChain
  ): void {
    if (this.scrapers.has(supermarketId)) {
      throw new Error(`Scraper already registered for: ${supermarketId}`);
    }

    this.scrapers.set(supermarketId, {
      scraper,
      chain,
      registeredAt: new Date()
    });
  }

  /**
   * Unregister a scraper
   */
  unregister(supermarketId: SupermarketId): boolean {
    return this.scrapers.delete(supermarketId);
  }

  /**
   * Get a scraper by supermarket ID
   */
  get(supermarketId: SupermarketId): ISupermarketScraper | null {
    return this.scrapers.get(supermarketId)?.scraper ?? null;
  }

  /**
   * Get all registered scrapers
   */
  getAll(): Map<SupermarketId, ISupermarketScraper> {
    const result = new Map<SupermarketId, ISupermarketScraper>();

    for (const [id, registration] of this.scrapers) {
      result.set(id, registration.scraper);
    }

    return result;
  }

  /**
   * Get scrapers by chain
   */
  getByChain(chain: SupermarketChain): ISupermarketScraper[] {
    const result: ISupermarketScraper[] = [];

    for (const registration of this.scrapers.values()) {
      if (registration.chain === chain) {
        result.push(registration.scraper);
      }
    }

    return result;
  }

  /**
   * Get active scrapers only
   */
  getActive(): Map<SupermarketId, ISupermarketScraper> {
    const result = new Map<SupermarketId, ISupermarketScraper>();

    for (const [id, registration] of this.scrapers) {
      if (registration.scraper.status === 'active') {
        result.set(id, registration.scraper);
      }
    }

    return result;
  }

  /**
   * Check if a scraper is registered
   */
  has(supermarketId: SupermarketId): boolean {
    return this.scrapers.has(supermarketId);
  }

  /**
   * Get count of registered scrapers
   */
  get size(): number {
    return this.scrapers.size;
  }

  /**
   * Run health checks on all scrapers
   */
  async healthCheckAll(): Promise<Map<SupermarketId, ScraperHealthResult>> {
    const results = new Map<SupermarketId, ScraperHealthResult>();

    const checks = Array.from(this.scrapers.entries()).map(
      async ([id, registration]) => {
        const result = await registration.scraper.healthCheck();
        registration.lastHealthCheck = result;
        results.set(id, result);
      }
    );

    await Promise.all(checks);
    return results;
  }

  /**
   * Get registry status
   */
  getStatus(): RegistryStatus {
    const statuses: Record<ScraperStatus, number> = {
      active: 0,
      degraded: 0,
      maintenance: 0,
      broken: 0,
      development: 0
    };

    for (const registration of this.scrapers.values()) {
      statuses[registration.scraper.status]++;
    }

    return {
      totalScrapers: this.scrapers.size,
      statusBreakdown: statuses,
      lastHealthCheckAt: this.getLastHealthCheckTime()
    };
  }

  /**
   * Get the most recent health check time across all scrapers
   */
  private getLastHealthCheckTime(): Date | null {
    let latest: Date | null = null;

    for (const registration of this.scrapers.values()) {
      if (registration.lastHealthCheck) {
        const checkTime = registration.lastHealthCheck.checkedAt;
        if (!latest || checkTime > latest) {
          latest = checkTime;
        }
      }
    }

    return latest;
  }
}

/**
 * Registry status information
 */
export interface RegistryStatus {
  readonly totalScrapers: number;
  readonly statusBreakdown: Record<ScraperStatus, number>;
  readonly lastHealthCheckAt: Date | null;
}
