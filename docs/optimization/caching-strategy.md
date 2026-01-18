# Caching Strategy

## Overview

This document details the multi-tier caching architecture for the Meal Automation Platform, optimizing performance across scraping, product matching, API responses, and the browser extension.

---

## 1. Caching Architecture

### 1.1 Multi-Tier Cache Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
├────────────────────────────────────────────────────────────────────────┤
│  Browser Extension    │    Web App      │     Mobile App               │
│  ┌─────────────────┐  │  ┌───────────┐  │  ┌────────────┐              │
│  │ IndexedDB (L0)  │  │  │ Memory    │  │  │ SQLite     │              │
│  │ LocalStorage    │  │  │ React Q   │  │  │ Realm      │              │
│  └─────────────────┘  │  └───────────┘  │  └────────────┘              │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           CDN LAYER (L1)                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                   CloudFlare Edge Cache                         │   │
│  │  • Static assets (images, JS, CSS)                              │   │
│  │  • API responses (GET requests with Cache-Control)              │   │
│  │  • Product images (transformed and optimized)                   │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER (L2)                           │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │   API GW     │    │   In-Memory  │    │    Redis     │             │
│  │   Cache      │    │   LRU Cache  │    │   Cluster    │             │
│  │   (30s TTL)  │    │   (per node) │    │   (shared)   │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER (L3)                              │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │  PostgreSQL  │    │   pgvector   │    │  TimescaleDB │             │
│  │  Query Cache │    │   Index      │    │  Compression │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Cache Layer Specifications

| Layer | Storage | Capacity | TTL Range | Hit Rate Target |
|-------|---------|----------|-----------|-----------------|
| L0 (Client) | IndexedDB/Memory | 50-500MB | 1h-7d | 70-90% |
| L1 (CDN) | CloudFlare Edge | Unlimited | 1m-24h | 80-95% |
| L2 (App) | Redis + Memory | 10-50GB | 5m-24h | 60-80% |
| L3 (DB) | PostgreSQL | N/A | Query-level | 40-60% |

---

## 2. Product Data Caching

### 2.1 Product Catalog Cache

```typescript
interface ProductCacheConfig {
  // Key patterns
  keys: {
    product: 'product:{supermarketId}:{productId}';
    category: 'category:{supermarketId}:{categoryId}:products';
    search: 'search:{supermarketId}:{queryHash}';
    popular: 'popular:{supermarketId}:top100';
  };

  // TTL configuration by data type
  ttl: {
    productDetails: 3600;         // 1 hour
    productPrice: 900;            // 15 minutes (prices change frequently)
    categoryList: 7200;           // 2 hours
    searchResults: 1800;          // 30 minutes
    popularProducts: 3600;        // 1 hour
  };

  // Invalidation triggers
  invalidation: {
    onPriceChange: ['productDetails', 'searchResults'];
    onAvailabilityChange: ['productDetails', 'searchResults', 'categoryList'];
    onNewProduct: ['categoryList', 'popular'];
  };
}
```

### 2.2 Redis Cache Implementation

```typescript
import Redis from 'ioredis';
import { compress, decompress } from 'lz4';

class ProductCacheService {
  private redis: Redis.Cluster;
  private localCache: LRUCache<string, CachedProduct>;

  constructor() {
    // Redis Cluster for high availability
    this.redis = new Redis.Cluster([
      { host: 'redis-1.cache.local', port: 6379 },
      { host: 'redis-2.cache.local', port: 6379 },
      { host: 'redis-3.cache.local', port: 6379 },
    ], {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      },
      scaleReads: 'slave', // Read from replicas
    });

    // Local LRU cache for hot data
    this.localCache = new LRUCache({
      max: 10000,
      ttl: 60000, // 1 minute local TTL
    });
  }

  async getProduct(supermarketId: string, productId: string): Promise<Product | null> {
    const key = `product:${supermarketId}:${productId}`;

    // Check local cache first (L2a)
    const localResult = this.localCache.get(key);
    if (localResult) {
      return localResult.data;
    }

    // Check Redis (L2b)
    const redisResult = await this.redis.getBuffer(key);
    if (redisResult) {
      const decompressed = decompress(redisResult);
      const product = JSON.parse(decompressed.toString());

      // Promote to local cache
      this.localCache.set(key, { data: product, cachedAt: Date.now() });

      return product;
    }

    return null;
  }

  async setProduct(supermarketId: string, product: Product): Promise<void> {
    const key = `product:${supermarketId}:${product.id}`;
    const compressed = compress(Buffer.from(JSON.stringify(product)));

    // Write to Redis with TTL
    await this.redis.setex(key, 3600, compressed);

    // Update local cache
    this.localCache.set(key, { data: product, cachedAt: Date.now() });

    // Update category index
    await this.updateCategoryIndex(supermarketId, product);
  }

  async getProductsBatch(
    supermarketId: string,
    productIds: string[]
  ): Promise<Map<string, Product | null>> {
    const results = new Map<string, Product | null>();
    const missingIds: string[] = [];

    // Check local cache for all
    for (const id of productIds) {
      const key = `product:${supermarketId}:${id}`;
      const localResult = this.localCache.get(key);

      if (localResult) {
        results.set(id, localResult.data);
      } else {
        missingIds.push(id);
      }
    }

    // Batch fetch missing from Redis using MGET
    if (missingIds.length > 0) {
      const keys = missingIds.map(id => `product:${supermarketId}:${id}`);
      const redisResults = await this.redis.mgetBuffer(...keys);

      redisResults.forEach((result, index) => {
        const id = missingIds[index];
        if (result) {
          const product = JSON.parse(decompress(result).toString());
          results.set(id, product);
          this.localCache.set(keys[index], { data: product, cachedAt: Date.now() });
        } else {
          results.set(id, null);
        }
      });
    }

    return results;
  }

  // Cache invalidation
  async invalidateProduct(supermarketId: string, productId: string): Promise<void> {
    const key = `product:${supermarketId}:${productId}`;

    // Remove from both caches
    this.localCache.delete(key);
    await this.redis.del(key);

    // Publish invalidation event for other nodes
    await this.redis.publish('cache:invalidate', JSON.stringify({
      type: 'product',
      key,
      timestamp: Date.now(),
    }));
  }
}
```

### 2.3 Cache Warming Strategy

```typescript
interface CacheWarmingConfig {
  // Warm cache on startup
  startup: {
    popularProducts: true;         // Top 100 per supermarket
    commonSearches: true;          // Top 50 search queries
    categoryLists: true;           // All category hierarchies
  };

  // Predictive warming based on user behavior
  predictive: {
    enabled: true;
    model: 'collaborative-filtering';

    triggers: {
      mealPlanCreated: true;       // Warm ingredients for meal
      categoryViewed: true;        // Warm related products
      searchExecuted: true;        // Warm similar queries
    };
  };

  // Scheduled warming
  schedule: {
    popularProducts: '0 */6 * * *';   // Every 6 hours
    priceUpdates: '0 * * * *';        // Every hour
    newProducts: '0 8 * * *';         // Daily at 8 AM
  };
}

class CacheWarmer {
  async warmOnStartup(): Promise<void> {
    const supermarkets = await this.getSupermarkets();

    await Promise.all(supermarkets.map(async (supermarket) => {
      // Warm popular products
      const popularProducts = await this.db.getPopularProducts(supermarket.id, 100);
      await Promise.all(popularProducts.map(p =>
        this.cache.setProduct(supermarket.id, p)
      ));

      // Warm category hierarchies
      const categories = await this.db.getCategoryTree(supermarket.id);
      await this.cache.setCategoryTree(supermarket.id, categories);

      // Warm common search results
      const commonSearches = await this.analytics.getTopSearches(supermarket.id, 50);
      await Promise.all(commonSearches.map(async (search) => {
        const results = await this.search.execute(supermarket.id, search.query);
        await this.cache.setSearchResults(supermarket.id, search.query, results);
      }));
    }));
  }

  async warmForMealPlan(mealPlanId: string): Promise<void> {
    const mealPlan = await this.db.getMealPlan(mealPlanId);
    const ingredients = this.extractIngredients(mealPlan);
    const supermarkets = await this.userPrefs.getPreferredSupermarkets(mealPlan.userId);

    // Warm product matches for all ingredients across supermarkets
    await Promise.all(supermarkets.map(async (supermarket) => {
      await Promise.all(ingredients.map(async (ingredient) => {
        const matches = await this.matcher.findMatches(supermarket.id, ingredient);
        await this.cache.setMatchResults(supermarket.id, ingredient.name, matches);
      }));
    }));
  }
}
```

---

## 3. Match Results Caching

### 3.1 Fuzzy Match Cache

```typescript
interface MatchCacheConfig {
  // Cache key design
  keyPattern: {
    exactMatch: 'match:exact:{supermarket}:{normalizedQuery}';
    fuzzyMatch: 'match:fuzzy:{supermarket}:{queryHash}:{threshold}';
    semanticMatch: 'match:semantic:{supermarket}:{embeddingHash}';
    crossMatch: 'match:cross:{queryHash}:{supermarkets}';
  };

  // TTL by match type
  ttl: {
    exactMatch: 86400;            // 24 hours
    fuzzyMatch: 7200;             // 2 hours
    semanticMatch: 3600;          // 1 hour
    crossMatch: 1800;             // 30 minutes
  };

  // Bloom filter for negative caching
  bloomFilter: {
    enabled: true;
    expectedItems: 1000000;
    falsePositiveRate: 0.01;
    ttl: 3600;                    // Rebuild hourly
  };
}

class MatchCacheService {
  private redis: Redis;
  private bloomFilter: BloomFilter;
  private localCache: LRUCache<string, MatchResult[]>;

  async getMatchResults(
    supermarket: string,
    query: string,
    options: MatchOptions
  ): Promise<MatchResult[] | null> {
    const normalizedQuery = this.normalize(query);
    const cacheKey = this.buildCacheKey(supermarket, normalizedQuery, options);

    // Check bloom filter for known no-results
    if (this.bloomFilter.mightContain(`no-match:${cacheKey}`)) {
      // Likely no results - but verify in cache
      const cached = await this.redis.get(cacheKey);
      if (cached === 'NO_RESULTS') {
        return [];
      }
    }

    // Check local cache
    const localResult = this.localCache.get(cacheKey);
    if (localResult) {
      this.recordCacheHit('local');
      return localResult;
    }

    // Check Redis
    const redisResult = await this.redis.get(cacheKey);
    if (redisResult) {
      if (redisResult === 'NO_RESULTS') {
        return [];
      }
      const results = JSON.parse(redisResult);
      this.localCache.set(cacheKey, results);
      this.recordCacheHit('redis');
      return results;
    }

    this.recordCacheMiss();
    return null;
  }

  async setMatchResults(
    supermarket: string,
    query: string,
    options: MatchOptions,
    results: MatchResult[]
  ): Promise<void> {
    const normalizedQuery = this.normalize(query);
    const cacheKey = this.buildCacheKey(supermarket, normalizedQuery, options);
    const ttl = this.getTTL(options.matchType);

    if (results.length === 0) {
      // Cache negative result
      await this.redis.setex(cacheKey, ttl, 'NO_RESULTS');
      this.bloomFilter.add(`no-match:${cacheKey}`);
    } else {
      await this.redis.setex(cacheKey, ttl, JSON.stringify(results));
      this.localCache.set(cacheKey, results);
    }
  }

  // Batch cache lookup
  async getMatchResultsBatch(
    supermarket: string,
    queries: string[]
  ): Promise<Map<string, MatchResult[] | null>> {
    const results = new Map<string, MatchResult[] | null>();
    const pipeline = this.redis.pipeline();

    const cacheKeys = queries.map(q => this.buildCacheKey(supermarket, this.normalize(q), {}));

    // Pipeline all lookups
    cacheKeys.forEach(key => pipeline.get(key));
    const redisResults = await pipeline.exec();

    redisResults.forEach(([err, value], index) => {
      const query = queries[index];
      if (value && value !== 'NO_RESULTS') {
        results.set(query, JSON.parse(value as string));
      } else if (value === 'NO_RESULTS') {
        results.set(query, []);
      } else {
        results.set(query, null);
      }
    });

    return results;
  }
}
```

### 3.2 Cross-Supermarket Match Cache

```typescript
// Cache for product equivalencies across supermarkets
interface CrossMatchCache {
  // Find equivalent products across supermarkets
  equivalencies: {
    key: 'equiv:{productId}:{targetSupermarket}';
    ttl: 86400;  // 24 hours - equivalencies are stable
  };

  // Price comparison cache
  priceComparison: {
    key: 'price-compare:{productHash}:{supermarkets}';
    ttl: 900;    // 15 minutes - prices change
  };
}

class CrossMatchCacheService {
  async getCachedEquivalent(
    sourceProductId: string,
    sourceSupermarket: string,
    targetSupermarket: string
  ): Promise<Product | null> {
    const key = `equiv:${sourceProductId}:${targetSupermarket}`;

    // Check cache
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  async setCachedEquivalent(
    sourceProductId: string,
    sourceSupermarket: string,
    targetSupermarket: string,
    equivalentProduct: Product | null
  ): Promise<void> {
    const key = `equiv:${sourceProductId}:${targetSupermarket}`;

    if (equivalentProduct) {
      await this.redis.setex(key, 86400, JSON.stringify(equivalentProduct));
    } else {
      // Cache negative result with shorter TTL
      await this.redis.setex(key, 3600, 'NO_EQUIVALENT');
    }
  }

  // Get price comparison for a product across all supermarkets
  async getPriceComparison(
    productName: string,
    supermarkets: string[]
  ): Promise<PriceComparison[] | null> {
    const hash = this.hashProductName(productName);
    const key = `price-compare:${hash}:${supermarkets.sort().join(',')}`;

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }
}
```

---

## 4. Image Caching

### 4.1 CDN Configuration

```yaml
# CloudFlare configuration for image caching
image_cdn:
  provider: "CloudFlare"

  origins:
    # Original images from supermarket sites
    supermarket_images:
      pattern: "/images/products/*"
      origin: "https://origin.mealapp.com"
      cache_rules:
        ttl: 604800  # 7 days
        stale_while_revalidate: 86400
        stale_if_error: 172800

  transformations:
    enabled: true
    variants:
      thumbnail:
        width: 80
        height: 80
        fit: "cover"
        format: "webp"
        quality: 75

      card:
        width: 200
        height: 200
        fit: "contain"
        format: "webp"
        quality: 80

      detail:
        width: 400
        height: 400
        fit: "contain"
        format: "webp"
        quality: 85

  cache_tags:
    - "product-images"
    - "supermarket:{supermarket_id}"
    - "category:{category_id}"

  purge_rules:
    on_product_update: true
    batch_purge_delay: 300  # 5 min delay to batch purges
```

### 4.2 Image Cache Service

```typescript
interface ImageCacheConfig {
  // Local cache (application server)
  local: {
    enabled: true;
    path: '/tmp/image-cache';
    maxSize: '500MB';
    ttl: 3600;
  };

  // Redis cache for image metadata
  metadata: {
    enabled: true;
    ttl: 86400;
  };

  // Object storage (R2/S3)
  objectStorage: {
    provider: 'cloudflare-r2';
    bucket: 'mealapp-images';
    region: 'eu-west';

    naming: {
      pattern: '{supermarket}/{product_id}/{variant}.{format}';
      example: 'mercadona/12345/card.webp';
    };
  };
}

class ImageCacheService {
  async getImageUrl(
    productId: string,
    supermarket: string,
    variant: 'thumbnail' | 'card' | 'detail'
  ): Promise<string> {
    // Check if transformed image exists
    const cacheKey = `img:${supermarket}:${productId}:${variant}`;
    const cachedUrl = await this.redis.get(cacheKey);

    if (cachedUrl) {
      return cachedUrl;
    }

    // Check if image exists in R2
    const r2Key = `${supermarket}/${productId}/${variant}.webp`;
    const exists = await this.r2.headObject(r2Key);

    if (exists) {
      const url = this.getCdnUrl(r2Key);
      await this.redis.setex(cacheKey, 86400, url);
      return url;
    }

    // Image doesn't exist - queue for processing
    await this.imageQueue.add('transform', {
      productId,
      supermarket,
      variant,
    });

    // Return placeholder or original image
    return this.getPlaceholderUrl(variant);
  }

  // Batch image URL resolution
  async getImageUrls(
    requests: Array<{ productId: string; supermarket: string; variant: string }>
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const pipeline = this.redis.pipeline();

    // Build all cache keys
    const cacheKeys = requests.map(r =>
      `img:${r.supermarket}:${r.productId}:${r.variant}`
    );

    // Pipeline Redis lookups
    cacheKeys.forEach(key => pipeline.get(key));
    const redisResults = await pipeline.exec();

    // Process results
    const missingIndexes: number[] = [];
    redisResults.forEach(([err, url], index) => {
      const request = requests[index];
      const key = `${request.supermarket}:${request.productId}:${request.variant}`;

      if (url) {
        results.set(key, url as string);
      } else {
        missingIndexes.push(index);
      }
    });

    // Queue missing images for processing
    if (missingIndexes.length > 0) {
      const missingRequests = missingIndexes.map(i => requests[i]);
      await this.imageQueue.addBulk(
        missingRequests.map(r => ({
          name: 'transform',
          data: r,
        }))
      );

      // Return placeholders for missing
      missingRequests.forEach(r => {
        const key = `${r.supermarket}:${r.productId}:${r.variant}`;
        results.set(key, this.getPlaceholderUrl(r.variant));
      });
    }

    return results;
  }
}
```

---

## 5. API Response Caching

### 5.1 HTTP Cache Headers

```typescript
interface CacheHeaderConfig {
  // Endpoint-specific caching rules
  endpoints: {
    // Product details - cache in browser and CDN
    'GET /api/products/:id': {
      cacheControl: 'public, max-age=300, stale-while-revalidate=60';
      etag: true;
      vary: ['Accept-Language'];
    };

    // Product search - cache in CDN only
    'GET /api/products/search': {
      cacheControl: 'public, max-age=60, s-maxage=300';
      etag: true;
      vary: ['Accept-Language', 'X-Supermarket'];
    };

    // Price comparison - short cache
    'GET /api/prices/compare': {
      cacheControl: 'public, max-age=60';
      etag: true;
    };

    // User data - private cache
    'GET /api/user/*': {
      cacheControl: 'private, max-age=0, must-revalidate';
      etag: true;
    };

    // Grocery list - no cache
    'POST /api/grocery-list/*': {
      cacheControl: 'no-store';
    };
  };
}

// Express middleware for cache headers
const cacheMiddleware = (config: CacheConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const routeKey = `${req.method} ${req.route?.path}`;
    const cacheConfig = config.endpoints[routeKey];

    if (cacheConfig) {
      res.set('Cache-Control', cacheConfig.cacheControl);

      if (cacheConfig.vary) {
        res.set('Vary', cacheConfig.vary.join(', '));
      }

      if (cacheConfig.etag) {
        // ETag will be set after response body is known
        res.locals.useEtag = true;
      }
    }

    next();
  };
};
```

### 5.2 API Gateway Cache

```typescript
// Kong/Nginx cache configuration
const apiGatewayCache = {
  // Response caching
  proxy_cache: {
    enabled: true;
    methods: ['GET', 'HEAD'];
    response_codes: [200, 301, 404];
    content_types: ['application/json', 'text/html'];
    memory_zone_size: '100m';
    keys_zone: 'api_cache:10m';
    max_size: '1g';

    // Cache key
    key: '$request_method$host$request_uri$http_accept_language$http_x_supermarket';

    // Bypass rules
    bypass: [
      '$http_authorization',      // Authenticated requests
      '$cookie_session',          // Requests with session
      '$arg_nocache',             // Explicit bypass
    ];
  };

  // Rate limiting integration
  rate_limit: {
    cache_status_header: 'X-Cache-Status';

    // Lower rate limits for uncached requests
    limits: {
      cached: '1000r/s';
      uncached: '100r/s';
    };
  };
};
```

---

## 6. Browser Extension Caching

### 6.1 IndexedDB Cache

```typescript
interface ExtensionCacheConfig {
  // IndexedDB stores
  stores: {
    products: {
      keyPath: 'id';
      indexes: ['supermarket', 'category', 'lastAccessed'];
      maxItems: 10000;
      ttl: 86400;  // 24 hours
    };

    searchResults: {
      keyPath: 'queryHash';
      indexes: ['supermarket', 'timestamp'];
      maxItems: 1000;
      ttl: 3600;   // 1 hour
    };

    userPreferences: {
      keyPath: 'key';
      persistent: true;  // No TTL
    };

    groceryList: {
      keyPath: 'id';
      sync: true;  // Sync with server
    };
  };

  // Storage quotas
  quotas: {
    indexedDB: {
      maxSize: 50 * 1024 * 1024;  // 50MB
      warningThreshold: 0.8;
      evictionPolicy: 'lru';
    };

    localStorage: {
      maxSize: 5 * 1024 * 1024;   // 5MB
      reserved: {
        settings: 100 * 1024;     // 100KB for settings
        session: 50 * 1024;       // 50KB for session
      };
    };
  };
}

// IndexedDB cache implementation
class ExtensionCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MealAppCache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Products store
        const productsStore = db.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('supermarket', 'supermarket');
        productsStore.createIndex('category', 'category');
        productsStore.createIndex('lastAccessed', 'lastAccessed');

        // Search results store
        const searchStore = db.createObjectStore('searchResults', { keyPath: 'queryHash' });
        searchStore.createIndex('supermarket', 'supermarket');
        searchStore.createIndex('timestamp', 'timestamp');

        // User preferences
        db.createObjectStore('userPreferences', { keyPath: 'key' });

        // Grocery list
        db.createObjectStore('groceryList', { keyPath: 'id' });
      };
    });
  }

  async getProduct(id: string): Promise<CachedProduct | null> {
    const product = await this.get('products', id);

    if (product) {
      // Update last accessed
      product.lastAccessed = Date.now();
      await this.put('products', product);

      // Check TTL
      if (Date.now() - product.cachedAt < 86400000) {
        return product;
      }

      // Expired - return stale and refresh in background
      this.refreshProduct(id);
      return product;
    }

    return null;
  }

  async searchProducts(
    supermarket: string,
    query: string
  ): Promise<CachedProduct[] | null> {
    const queryHash = this.hashQuery(supermarket, query);
    const cached = await this.get('searchResults', queryHash);

    if (cached && Date.now() - cached.timestamp < 3600000) {
      return cached.products;
    }

    return null;
  }

  // Quota management
  async enforceQuota(): Promise<void> {
    const usage = await this.getStorageUsage();

    if (usage.percentage > 0.8) {
      // Evict least recently accessed products
      const products = await this.getAll('products');
      products.sort((a, b) => a.lastAccessed - b.lastAccessed);

      const toDelete = products.slice(0, Math.floor(products.length * 0.2));
      await Promise.all(toDelete.map(p => this.delete('products', p.id)));
    }
  }
}
```

### 6.2 Service Worker Caching

```typescript
// Service worker cache strategies
const swCacheConfig = {
  // Cache names
  caches: {
    static: 'mealapp-static-v1';
    api: 'mealapp-api-v1';
    images: 'mealapp-images-v1';
  };

  // Caching strategies by route
  strategies: {
    // Static assets - cache first
    static: {
      pattern: /\.(js|css|woff2?)$/;
      strategy: 'cache-first';
      maxAgeSeconds: 604800;  // 7 days
    };

    // API calls - network first with cache fallback
    api: {
      pattern: /\/api\//;
      strategy: 'network-first';
      networkTimeoutSeconds: 3;
      maxEntries: 500;
      maxAgeSeconds: 300;
    };

    // Product images - cache first
    images: {
      pattern: /\/images\/products\//;
      strategy: 'cache-first';
      maxEntries: 1000;
      maxAgeSeconds: 86400;
    };
  };
};

// Service worker implementation
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(event.request, 'mealapp-api-v1'));
    return;
  }

  // Static assets - cache first
  if (url.pathname.match(/\.(js|css|woff2?)$/)) {
    event.respondWith(cacheFirstWithNetwork(event.request, 'mealapp-static-v1'));
    return;
  }

  // Images - cache first
  if (url.pathname.startsWith('/images/')) {
    event.respondWith(cacheFirstWithNetwork(event.request, 'mealapp-images-v1'));
    return;
  }
});

async function networkFirstWithCache(
  request: Request,
  cacheName: string
): Promise<Response> {
  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), 3000)
      ),
    ]);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}
```

---

## 7. Cache Invalidation

### 7.1 Invalidation Patterns

```typescript
interface InvalidationConfig {
  // Event-driven invalidation
  events: {
    'product.price_changed': {
      invalidate: [
        'product:{supermarket}:{productId}',
        'search:{supermarket}:*',
        'price-compare:*',
      ];
      publish: true;  // Publish to other nodes
    };

    'product.availability_changed': {
      invalidate: [
        'product:{supermarket}:{productId}',
        'category:{supermarket}:{categoryId}:products',
        'search:{supermarket}:*',
      ];
    };

    'product.deleted': {
      invalidate: [
        'product:{supermarket}:{productId}',
        'equiv:{productId}:*',
        'img:{supermarket}:{productId}:*',
      ];
      purge_cdn: true;
    };

    'catalog.full_refresh': {
      invalidate: [
        'product:{supermarket}:*',
        'category:{supermarket}:*',
        'search:{supermarket}:*',
        'popular:{supermarket}:*',
      ];
      purge_cdn: true;
    };
  };

  // Time-based invalidation
  ttl_policies: {
    // Different TTLs based on data volatility
    price_data: 900;        // 15 min
    availability: 1800;     // 30 min
    product_details: 3600;  // 1 hour
    category_data: 7200;    // 2 hours
    static_data: 86400;     // 24 hours
  };
}

class CacheInvalidator {
  private redis: Redis;
  private cdnPurger: CDNPurger;

  async invalidateOnEvent(event: CacheEvent): Promise<void> {
    const config = this.config.events[event.type];
    if (!config) return;

    // Build cache keys to invalidate
    const keys = config.invalidate.map(pattern =>
      this.interpolatePattern(pattern, event.data)
    );

    // Invalidate local cache
    keys.forEach(key => this.localCache.delete(key));

    // Invalidate Redis
    await this.invalidateRedisKeys(keys);

    // Publish to other nodes
    if (config.publish) {
      await this.redis.publish('cache:invalidate', JSON.stringify({
        keys,
        timestamp: Date.now(),
        source: this.nodeId,
      }));
    }

    // Purge CDN if needed
    if (config.purge_cdn) {
      await this.cdnPurger.purgeKeys(keys);
    }
  }

  // Pattern-based invalidation with wildcards
  private async invalidateRedisKeys(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Scan and delete matching keys
        let cursor = '0';
        do {
          const [newCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH', pattern,
            'COUNT', 100
          );
          cursor = newCursor;

          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } else {
        await this.redis.del(pattern);
      }
    }
  }
}
```

### 7.2 Pub/Sub Invalidation

```typescript
// Cross-node cache invalidation via Redis Pub/Sub
class CacheInvalidationSubscriber {
  private redis: Redis;
  private localCache: LRUCache<string, any>;

  async subscribe(): Promise<void> {
    const subscriber = this.redis.duplicate();

    await subscriber.subscribe('cache:invalidate');

    subscriber.on('message', (channel, message) => {
      if (channel === 'cache:invalidate') {
        const { keys, source } = JSON.parse(message);

        // Don't process own messages
        if (source === this.nodeId) return;

        // Invalidate local cache
        keys.forEach((key: string) => {
          if (key.includes('*')) {
            // Clear all matching keys from local cache
            for (const cacheKey of this.localCache.keys()) {
              if (this.matchPattern(cacheKey, key)) {
                this.localCache.delete(cacheKey);
              }
            }
          } else {
            this.localCache.delete(key);
          }
        });
      }
    });
  }
}
```

---

## 8. Cache Metrics and Monitoring

### 8.1 Metrics Collection

```typescript
interface CacheMetrics {
  // Hit/miss tracking
  hits: {
    total: Counter;
    byTier: {
      local: Counter;
      redis: Counter;
      database: Counter;
    };
  };

  misses: Counter;

  // Latency histograms
  latency: {
    local: Histogram;
    redis: Histogram;
    database: Histogram;
  };

  // Cache size
  size: {
    local: Gauge;
    redis: Gauge;
  };

  // Eviction tracking
  evictions: Counter;
}

// Prometheus metrics
const cacheMetrics = {
  hitRate: new promClient.Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate',
    labelNames: ['tier', 'cache_name'],
  }),

  latency: new promClient.Histogram({
    name: 'cache_operation_duration_seconds',
    help: 'Cache operation duration',
    labelNames: ['operation', 'tier'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  }),

  size: new promClient.Gauge({
    name: 'cache_size_bytes',
    help: 'Cache size in bytes',
    labelNames: ['tier', 'cache_name'],
  }),

  evictions: new promClient.Counter({
    name: 'cache_evictions_total',
    help: 'Total cache evictions',
    labelNames: ['tier', 'reason'],
  }),
};
```

### 8.2 Cache Dashboard

```yaml
# Grafana dashboard configuration
dashboard:
  title: "Cache Performance"

  panels:
    - title: "Cache Hit Rate"
      type: graph
      queries:
        - expr: "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))"
          legend: "Overall"
        - expr: "rate(cache_hits_total{tier='local'}[5m]) / rate(cache_requests_total{tier='local'}[5m])"
          legend: "Local"
        - expr: "rate(cache_hits_total{tier='redis'}[5m]) / rate(cache_requests_total{tier='redis'}[5m])"
          legend: "Redis"

    - title: "Cache Latency (p99)"
      type: graph
      queries:
        - expr: "histogram_quantile(0.99, rate(cache_operation_duration_seconds_bucket[5m]))"

    - title: "Cache Size"
      type: stat
      queries:
        - expr: "cache_size_bytes{tier='redis'}"

    - title: "Eviction Rate"
      type: graph
      queries:
        - expr: "rate(cache_evictions_total[5m])"

  alerts:
    - name: "LowCacheHitRate"
      expr: "cache_hit_rate < 0.6"
      for: "5m"
      severity: "warning"

    - name: "HighCacheLatency"
      expr: "histogram_quantile(0.99, cache_operation_duration_seconds) > 0.1"
      for: "5m"
      severity: "warning"
```

---

## 9. Implementation Checklist

### Phase 1: Foundation
- [ ] Set up Redis cluster
- [ ] Implement basic product caching
- [ ] Configure HTTP cache headers
- [ ] Set up cache metrics

### Phase 2: Advanced Caching
- [ ] Implement match result caching
- [ ] Set up bloom filters for negative caching
- [ ] Configure CDN for images
- [ ] Implement cache warming

### Phase 3: Extension Caching
- [ ] Set up IndexedDB cache
- [ ] Implement service worker caching
- [ ] Add quota management
- [ ] Implement offline support

### Phase 4: Optimization
- [ ] Implement cache invalidation pub/sub
- [ ] Set up monitoring dashboards
- [ ] Performance tuning
- [ ] Documentation

---

## Next Steps

1. Review [Performance Strategy](./performance-strategy.md) for overall optimization approach
2. Review [Scaling Plan](./scaling-plan.md) for scalability roadmap
3. Set up Redis cluster
4. Begin Phase 1 implementation
