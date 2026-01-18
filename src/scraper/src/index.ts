/**
 * Meal Automation Scrapers
 * Supermarket web scraping and product fetching
 */

// Re-export base scraper
export { BaseScraper } from './scrapers/base.scraper.js';
export type { BaseScraperConfig } from './scrapers/base.scraper.js';

// Re-export DIA scraper
export { DiaScraper, createDiaScraper } from './scrapers/dia.scraper.js';
export type {
  DiaApiProduct,
  DiaCategory,
  DiaSearchResponse
} from './scrapers/dia.scraper.js';

// Re-export Mercadona scraper
export { MercadonaScraper, createMercadonaScraper } from './scrapers/mercadona.scraper.js';
export type {
  MercadonaScraperConfig,
  MercadonaCategory,
  MercadonaProduct
} from './scrapers/mercadona.scraper.js';

// Re-export scraper registry
export { ScraperRegistry } from './registry.js';

// Re-export types
export type {
  ISupermarketScraper,
  ScraperConfig,
  ScraperStatus,
  ScraperHealthResult,
  Product,
  ProductSearchCriteria,
  ProductSearchResult
} from '@meal-automation/shared';
