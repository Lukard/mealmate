# Performance Optimization Strategy

## Executive Summary

This document outlines the comprehensive performance optimization strategy for the Meal Automation Platform, covering scraping, data storage, matching algorithms, browser extension, and scalability planning.

---

## 1. Scraping Performance Optimization

### 1.1 Parallel Scraping Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Scraping Orchestrator       │
                    │      (Job Queue + Load Balancer)    │
                    └─────────────────┬───────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
    ┌──────▼──────┐           ┌───────▼──────┐          ┌───────▼──────┐
    │  Worker 1   │           │   Worker 2   │          │   Worker N   │
    │ (Mercadona) │           │  (Carrefour) │          │   (Lidl)     │
    └──────┬──────┘           └───────┬──────┘          └───────┬──────┘
           │                          │                          │
    ┌──────▼──────┐           ┌───────▼──────┐          ┌───────▼──────┐
    │Browser Pool │           │Browser Pool  │          │Browser Pool  │
    │  (2-4 tabs) │           │  (2-4 tabs)  │          │  (2-4 tabs)  │
    └─────────────┘           └──────────────┘          └──────────────┘
```

#### Worker Configuration

```typescript
interface ScraperWorkerConfig {
  // Per-supermarket worker settings
  maxConcurrentPages: 4;           // Browser tabs per worker
  maxConcurrentWorkers: 3;         // Workers per supermarket
  requestDelay: {
    min: 500;                      // Minimum ms between requests
    max: 2000;                     // Maximum ms (randomized)
  };
  retryConfig: {
    maxRetries: 3;
    backoffMultiplier: 2;
    initialDelay: 1000;
  };
  timeout: {
    page: 30000;                   // Page load timeout
    element: 10000;                // Element wait timeout
    navigation: 60000;             // Navigation timeout
  };
}
```

### 1.2 Connection Pooling Strategy

```typescript
interface ConnectionPoolConfig {
  // Browser instance pooling
  browser: {
    minInstances: 2;               // Keep-alive instances
    maxInstances: 8;               // Maximum concurrent
    idleTimeout: 300000;           // 5 min idle before dispose
    warmupOnStart: true;           // Pre-warm browsers
  };

  // HTTP client pooling (for API calls)
  http: {
    maxSockets: 100;               // Maximum sockets
    maxFreeSockets: 20;            // Keep-alive sockets
    timeout: 30000;
    keepAlive: true;
    keepAliveMsecs: 1000;
  };

  // Database connection pooling
  database: {
    min: 5;
    max: 50;
    acquireTimeout: 30000;
    idleTimeout: 600000;
  };
}
```

### 1.3 Request Batching Patterns

```typescript
// Batch product requests by category
interface BatchConfig {
  // Category-based batching
  categoryBatch: {
    maxProducts: 50;               // Products per batch
    maxCategories: 5;              // Categories per request cycle
    parallelBatches: 3;            // Concurrent batch processing
  };

  // Price update batching
  priceUpdate: {
    batchSize: 100;                // Products per update batch
    flushInterval: 5000;           // Force flush every 5s
    maxBuffer: 500;                // Max buffered updates
  };
}

// Batch processing implementation
class BatchProcessor<T> {
  private buffer: T[] = [];
  private flushTimer: NodeJS.Timer | null = null;

  constructor(
    private batchSize: number,
    private flushInterval: number,
    private processor: (items: T[]) => Promise<void>
  ) {}

  async add(item: T): Promise<void> {
    this.buffer.push(item);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);
    await this.processor(batch);
  }
}
```

### 1.4 Incremental Updates vs Full Scrapes

| Scenario | Strategy | Frequency | Data Coverage |
|----------|----------|-----------|---------------|
| Initial Load | Full Scrape | Once | 100% catalog |
| Daily Updates | Smart Delta | Every 4h | Changed items only |
| Price Monitoring | Incremental | Every 1h | High-demand items |
| New Products | Targeted Scrape | Daily | New arrivals section |
| Inventory Check | Selective | Real-time | User's grocery list |

```typescript
interface UpdateStrategy {
  // Delta detection
  delta: {
    checksum: 'md5';               // Price/availability hash
    lastModified: true;            // HTTP Last-Modified header
    etag: true;                    // HTTP ETag support
  };

  // Smart scheduling
  schedule: {
    fullScrape: '0 3 * * 0';       // Weekly full scrape (Sunday 3 AM)
    priceDelta: '0 */4 * * *';     // Every 4 hours
    hotItems: '0 * * * *';         // Hourly for popular items
    onDemand: 'triggered';         // User-triggered for specific items
  };

  // Change detection
  changeTracking: {
    priceThreshold: 0.01;          // 1% price change triggers update
    availabilityChange: true;      // Track stock status changes
    newProductDetection: true;     // Detect new catalog items
  };
}
```

---

## 2. Data Storage Optimization

### 2.1 Product Catalog Indexing

```sql
-- Primary product table with optimized indexes
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supermarket_id INTEGER NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500) NOT NULL,
    brand VARCHAR(200),
    category_id INTEGER,
    subcategory_id INTEGER,
    price DECIMAL(10, 2),
    price_per_unit DECIMAL(10, 4),
    unit_type VARCHAR(20),
    unit_value DECIMAL(10, 3),
    image_url TEXT,
    product_url TEXT,
    is_available BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Composite indexes for common queries
    UNIQUE(supermarket_id, external_id)
);

-- Performance-critical indexes
CREATE INDEX idx_products_supermarket_category
    ON products(supermarket_id, category_id, is_available);

CREATE INDEX idx_products_normalized_name_gin
    ON products USING gin(to_tsvector('spanish', normalized_name));

CREATE INDEX idx_products_brand
    ON products(supermarket_id, brand)
    WHERE brand IS NOT NULL;

CREATE INDEX idx_products_price_range
    ON products(supermarket_id, category_id, price)
    WHERE is_available = true;

-- Partial index for available products only
CREATE INDEX idx_products_available
    ON products(supermarket_id, updated_at)
    WHERE is_available = true;
```

### 2.2 Full-Text Search Configuration

```sql
-- Spanish-optimized text search configuration
CREATE TEXT SEARCH CONFIGURATION spanish_unaccent (COPY = spanish);

-- Custom dictionary with product terms
CREATE TEXT SEARCH DICTIONARY spanish_product_syn (
    TEMPLATE = synonym,
    SYNONYMS = product_synonyms
);

-- product_synonyms.syn file contents:
-- leche entera -> leche
-- aceite oliva virgen extra -> aceite oliva
-- pan molde -> pan
-- agua mineral -> agua

-- Add trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Combined full-text + trigram index
CREATE INDEX idx_products_search
    ON products USING gin(
        to_tsvector('spanish_unaccent',
            coalesce(name, '') || ' ' ||
            coalesce(brand, '') || ' ' ||
            coalesce(normalized_name, '')
        )
    );

CREATE INDEX idx_products_trigram
    ON products USING gin(normalized_name gin_trgm_ops);
```

### 2.3 Price History Compression

```sql
-- Price history with time-series optimization
CREATE TABLE price_history (
    id BIGSERIAL,
    product_id UUID NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (product_id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Monthly partitions
CREATE TABLE price_history_2026_01 PARTITION OF price_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- TimescaleDB hypertable for automatic compression (if using TimescaleDB)
-- SELECT create_hypertable('price_history', 'recorded_at');
-- SELECT add_compression_policy('price_history', INTERVAL '7 days');

-- Delta encoding for price storage (application level)
CREATE TABLE price_deltas (
    product_id UUID NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    base_date DATE NOT NULL,
    deltas BYTEA,  -- Compressed array of (day_offset, price_delta) tuples

    PRIMARY KEY (product_id, base_date)
);
```

```typescript
// Delta compression implementation
class PriceHistoryCompressor {
  // Store prices as deltas from base price
  compress(prices: PricePoint[]): CompressedPriceHistory {
    const basePrice = prices[0].price;
    const baseDate = prices[0].date;

    const deltas = prices.slice(1).map((p, idx) => ({
      dayOffset: Math.floor((p.date.getTime() - baseDate.getTime()) / 86400000),
      priceDelta: Math.round((p.price - basePrice) * 100) // Store as cents
    }));

    // Pack into binary format
    const buffer = new ArrayBuffer(deltas.length * 4); // 2 bytes offset, 2 bytes delta
    const view = new DataView(buffer);

    deltas.forEach((d, i) => {
      view.setInt16(i * 4, d.dayOffset);
      view.setInt16(i * 4 + 2, d.priceDelta);
    });

    return {
      productId: prices[0].productId,
      basePrice,
      baseDate,
      deltas: Buffer.from(buffer)
    };
  }
}
```

### 2.4 Image Caching / CDN Strategy

```yaml
image_caching:
  strategy: "lazy-load-with-cdn"

  cdn_config:
    provider: "CloudFlare R2"  # Cost-effective S3-compatible
    regions: ["EU-West"]       # Spain-optimized

  cache_tiers:
    # Tier 1: Hot cache (most viewed products)
    hot:
      storage: "memory"
      max_size: "500MB"
      ttl: "1h"

    # Tier 2: Warm cache (recent products)
    warm:
      storage: "redis"
      max_size: "5GB"
      ttl: "24h"

    # Tier 3: Cold storage (all products)
    cold:
      storage: "r2"
      ttl: "30d"

  image_processing:
    formats: ["webp", "avif", "jpeg"]
    sizes:
      thumbnail: "80x80"
      card: "200x200"
      detail: "400x400"
    quality: 80
    lazy_generation: true  # Generate on first request

  url_pattern: "https://cdn.mealapp.com/products/{supermarket}/{product_id}/{size}.webp"
```

---

## 3. Matching Algorithm Performance

### 3.1 Fuzzy Matching Optimization

```typescript
interface MatchingConfig {
  // Algorithm selection by use case
  algorithms: {
    // Fast prefix matching for autocomplete
    autocomplete: {
      algorithm: 'trie';
      maxResults: 10;
      minChars: 2;
    };

    // Product name matching
    productMatch: {
      algorithm: 'combined';
      weights: {
        exactMatch: 1.0;
        levenshtein: 0.3;
        trigram: 0.4;
        semantic: 0.3;
      };
      threshold: 0.7;
    };

    // Cross-supermarket matching
    crossMatch: {
      algorithm: 'embedding-similarity';
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
      threshold: 0.85;
    };
  };
}

// Optimized Levenshtein with early termination
function levenshteinOptimized(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const m = a.length, n = b.length;

  // Use single row optimization
  let prevRow = Array.from({ length: n + 1 }, (_, i) => i);
  let currRow = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    let minInRow = i;

    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost // substitution
      );
      minInRow = Math.min(minInRow, currRow[j]);
    }

    // Early termination if min distance exceeds threshold
    if (minInRow > maxDistance) return maxDistance + 1;

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}
```

### 3.2 Product Embedding for Semantic Matching

```typescript
interface EmbeddingConfig {
  model: {
    name: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
    dimensions: 384;
    maxTokens: 128;
  };

  indexing: {
    algorithm: 'HNSW';  // Hierarchical Navigable Small World
    parameters: {
      M: 16;            // Number of connections per layer
      efConstruction: 200;
      efSearch: 100;
    };
  };

  storage: {
    backend: 'pgvector';  // PostgreSQL vector extension
    // or 'qdrant' for dedicated vector DB
  };
}

// PostgreSQL with pgvector
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Product embeddings table
CREATE TABLE product_embeddings (
    product_id UUID PRIMARY KEY REFERENCES products(id),
    embedding vector(384) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX idx_product_embeddings_hnsw
    ON product_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- Similarity search query
SELECT p.*, 1 - (pe.embedding <=> $1) as similarity
FROM product_embeddings pe
JOIN products p ON p.id = pe.product_id
WHERE p.supermarket_id = $2
  AND p.is_available = true
ORDER BY pe.embedding <=> $1
LIMIT 10;
```

### 3.3 Match Caching Strategy

```typescript
interface MatchCache {
  // Multi-tier caching
  tiers: {
    // L1: In-memory LRU cache
    memory: {
      maxSize: 10000;        // Cached match results
      ttl: 3600;             // 1 hour

      // Cache key format: "match:{supermarket}:{normalized_query_hash}"
      keyPattern: (supermarket: string, query: string) =>
        `match:${supermarket}:${hashQuery(query)}`;
    };

    // L2: Redis distributed cache
    redis: {
      maxSize: 100000;
      ttl: 86400;            // 24 hours

      // Bloom filter for negative caching
      bloomFilter: {
        enabled: true;
        expectedItems: 1000000;
        falsePositiveRate: 0.01;
      };
    };
  };

  // Cache warming strategy
  warming: {
    // Pre-cache common ingredient matches
    ingredients: [
      'leche', 'huevos', 'pan', 'aceite', 'tomate',
      'pollo', 'arroz', 'pasta', 'cebolla', 'ajo'
    ];

    // Pre-compute cross-supermarket equivalents
    crossSupermarket: true;
  };
}

// Redis caching implementation
class MatchCacheService {
  private memoryCache = new LRUCache<string, MatchResult[]>({ max: 10000 });

  async getMatch(supermarket: string, query: string): Promise<MatchResult[] | null> {
    const key = `match:${supermarket}:${this.hashQuery(query)}`;

    // Check L1 (memory)
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) return memoryResult;

    // Check L2 (Redis)
    const redisResult = await this.redis.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult);
      this.memoryCache.set(key, parsed); // Promote to L1
      return parsed;
    }

    return null;
  }

  async setMatch(supermarket: string, query: string, results: MatchResult[]): Promise<void> {
    const key = `match:${supermarket}:${this.hashQuery(query)}`;

    // Write to both tiers
    this.memoryCache.set(key, results);
    await this.redis.setex(key, 86400, JSON.stringify(results));
  }
}
```

### 3.4 Batch Processing for Matching

```typescript
interface BatchMatchingConfig {
  // Batch configuration
  batch: {
    size: 50;                // Items per batch
    parallelBatches: 4;      // Concurrent batch processing
    timeout: 30000;          // Per-batch timeout
  };

  // Pre-filtering optimization
  preFilter: {
    enabled: true;

    // Quick rejection filters (before expensive matching)
    filters: [
      'categoryMismatch',    // Different categories
      'brandMismatch',       // Different brands (if specified)
      'priceDivergence',     // >200% price difference
      'unitMismatch',        // Different unit types
    ];
  };
}

// Batch matching implementation
class BatchMatcher {
  async matchGroceryList(items: GroceryItem[], supermarkets: string[]): Promise<MatchResults> {
    const results = new Map<string, SupermarketMatches>();

    // Group items by category for better cache hits
    const groupedItems = this.groupByCategory(items);

    // Process each supermarket in parallel
    await Promise.all(supermarkets.map(async (supermarket) => {
      const matches = new Map<string, ProductMatch[]>();

      // Process category groups in batches
      for (const [category, categoryItems] of groupedItems) {
        const batches = this.chunk(categoryItems, 50);

        // Process batches in parallel (limited concurrency)
        const batchResults = await pMap(batches,
          batch => this.matchBatch(supermarket, category, batch),
          { concurrency: 4 }
        );

        // Merge batch results
        batchResults.flat().forEach(result => {
          matches.set(result.itemId, result.matches);
        });
      }

      results.set(supermarket, { supermarket, matches });
    }));

    return results;
  }
}
```

---

## 4. Browser Extension Optimization

### 4.1 Bundle Size Optimization

```javascript
// webpack.config.js for extension
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor chunk for rarely-changing deps
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 10,
        },
        // Common chunk for shared code
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },

    // Minimize bundle size
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        },
      }),
    ],
  },

  // Tree shaking
  sideEffects: false,

  // External dependencies (loaded separately)
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
  },
};
```

**Target Bundle Sizes:**

| Component | Target Size | Max Size |
|-----------|-------------|----------|
| Background script | < 50KB | 100KB |
| Content script | < 30KB | 50KB |
| Popup UI | < 100KB | 200KB |
| Total extension | < 500KB | 1MB |

### 4.2 Lazy Loading Strategy

```typescript
// Lazy load heavy features
const LazyComponents = {
  // Product comparison UI
  ProductComparison: lazy(() => import('./components/ProductComparison')),

  // Price history chart
  PriceHistory: lazy(() => import('./components/PriceHistory')),

  // Settings panel
  Settings: lazy(() => import('./components/Settings')),
};

// Background script: lazy load modules
class BackgroundService {
  private scraperModule: ScraperModule | null = null;
  private matcherModule: MatcherModule | null = null;

  async getScraper(): Promise<ScraperModule> {
    if (!this.scraperModule) {
      this.scraperModule = await import('./modules/scraper');
    }
    return this.scraperModule;
  }

  async getMatcher(): Promise<MatcherModule> {
    if (!this.matcherModule) {
      this.matcherModule = await import('./modules/matcher');
    }
    return this.matcherModule;
  }
}
```

### 4.3 Background Script Efficiency

```typescript
// Efficient background script patterns
class EfficientBackgroundService {
  private alarms = new Map<string, chrome.alarms.Alarm>();

  constructor() {
    // Use alarms instead of setInterval for better resource management
    chrome.alarms.create('price-check', { periodInMinutes: 60 });
    chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));

    // Batch message handling
    this.messageQueue = new BatchQueue<Message>({
      maxSize: 10,
      maxWait: 100, // ms
      processor: this.processBatch.bind(this)
    });
  }

  // Event-driven architecture
  private async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    switch (alarm.name) {
      case 'price-check':
        await this.checkPriceUpdates();
        break;
      case 'sync-data':
        await this.syncWithServer();
        break;
    }
  }

  // Debounced storage writes
  private storageWriteBuffer = new Map<string, any>();
  private storageWriteTimer: number | null = null;

  async setStorage(key: string, value: any): Promise<void> {
    this.storageWriteBuffer.set(key, value);

    if (!this.storageWriteTimer) {
      this.storageWriteTimer = setTimeout(async () => {
        await chrome.storage.local.set(
          Object.fromEntries(this.storageWriteBuffer)
        );
        this.storageWriteBuffer.clear();
        this.storageWriteTimer = null;
      }, 500);
    }
  }
}
```

### 4.4 Storage Quota Management

```typescript
interface StorageQuotaConfig {
  // Chrome extension limits
  limits: {
    local: 5242880;        // 5MB
    sync: 102400;          // 100KB
    session: 1048576;      // 1MB (Manifest V3)
  };

  // Priority-based eviction
  eviction: {
    strategy: 'lru-with-priority';

    priorities: {
      high: ['user_preferences', 'grocery_list', 'saved_meals'];
      medium: ['price_alerts', 'recent_searches'];
      low: ['cached_products', 'image_cache'];
    };

    // Keep high priority items, evict low priority first
    thresholds: {
      warn: 0.8;           // 80% - start evicting low priority
      critical: 0.95;      // 95% - evict medium priority
    };
  };
}

// Storage manager implementation
class StorageManager {
  private readonly QUOTA_LOCAL = 5 * 1024 * 1024; // 5MB

  async getUsage(): Promise<StorageUsage> {
    const usage = await chrome.storage.local.getBytesInUse(null);
    return {
      used: usage,
      total: this.QUOTA_LOCAL,
      percentage: usage / this.QUOTA_LOCAL,
    };
  }

  async enforceQuota(): Promise<void> {
    const usage = await this.getUsage();

    if (usage.percentage > 0.95) {
      // Critical: evict medium and low priority
      await this.evictByPriority(['low', 'medium']);
    } else if (usage.percentage > 0.8) {
      // Warning: evict low priority only
      await this.evictByPriority(['low']);
    }
  }

  private async evictByPriority(priorities: string[]): Promise<void> {
    const items = await chrome.storage.local.get(null);
    const evictKeys: string[] = [];

    for (const [key, value] of Object.entries(items)) {
      const priority = this.getKeyPriority(key);
      if (priorities.includes(priority)) {
        evictKeys.push(key);
      }
    }

    // Sort by last accessed (LRU)
    evictKeys.sort((a, b) =>
      (items[a]._lastAccessed || 0) - (items[b]._lastAccessed || 0)
    );

    // Remove oldest 20%
    const toRemove = evictKeys.slice(0, Math.ceil(evictKeys.length * 0.2));
    await chrome.storage.local.remove(toRemove);
  }
}
```

---

## 5. Performance Metrics and Benchmarks

### 5.1 Key Performance Indicators (KPIs)

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Scraping** | | |
| Products scraped/hour | > 10,000 | < 5,000 |
| Scrape success rate | > 99% | < 95% |
| Average page load time | < 3s | > 10s |
| **Matching** | | |
| Match latency (p50) | < 50ms | > 200ms |
| Match latency (p99) | < 200ms | > 1s |
| Match accuracy | > 95% | < 90% |
| Cache hit rate | > 80% | < 60% |
| **Extension** | | |
| Popup load time | < 200ms | > 500ms |
| Background memory | < 50MB | > 100MB |
| Content script CPU | < 5% | > 15% |
| **API** | | |
| Response time (p50) | < 100ms | > 300ms |
| Response time (p99) | < 500ms | > 2s |
| Throughput | > 1000 req/s | < 500 req/s |

### 5.2 Monitoring and Alerting

```typescript
// Performance monitoring configuration
const monitoringConfig = {
  metrics: {
    // Scraping metrics
    scraping: [
      'scrape_duration_seconds',
      'scrape_products_count',
      'scrape_errors_total',
      'scrape_rate_limit_hits',
    ],

    // Matching metrics
    matching: [
      'match_duration_seconds',
      'match_cache_hits_total',
      'match_cache_misses_total',
      'match_accuracy_score',
    ],

    // Extension metrics
    extension: [
      'extension_popup_load_time',
      'extension_memory_usage_bytes',
      'extension_storage_usage_bytes',
    ],
  },

  alerts: [
    {
      name: 'HighScrapeErrorRate',
      condition: 'rate(scrape_errors_total[5m]) > 0.05',
      severity: 'critical',
    },
    {
      name: 'SlowMatchLatency',
      condition: 'histogram_quantile(0.99, match_duration_seconds) > 0.5',
      severity: 'warning',
    },
    {
      name: 'LowCacheHitRate',
      condition: 'rate(match_cache_hits_total[1h]) / rate(match_cache_requests_total[1h]) < 0.6',
      severity: 'warning',
    },
  ],
};
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up connection pooling for scrapers
- [ ] Implement basic batch processing
- [ ] Configure database indexes
- [ ] Set up monitoring infrastructure

### Phase 2: Caching Layer (Weeks 3-4)
- [ ] Implement Redis caching for matches
- [ ] Set up CDN for product images
- [ ] Add in-memory LRU caches
- [ ] Implement cache warming

### Phase 3: Advanced Matching (Weeks 5-6)
- [ ] Deploy product embeddings
- [ ] Set up vector similarity search
- [ ] Implement cross-supermarket matching
- [ ] Optimize fuzzy matching algorithms

### Phase 4: Extension Optimization (Weeks 7-8)
- [ ] Minimize bundle sizes
- [ ] Implement lazy loading
- [ ] Optimize background scripts
- [ ] Set up storage quota management

### Phase 5: Monitoring & Tuning (Ongoing)
- [ ] Deploy performance dashboards
- [ ] Set up alerting rules
- [ ] Continuous performance testing
- [ ] Regular optimization reviews

---

## Next Steps

1. Review [Caching Strategy](./caching-strategy.md) for detailed caching implementation
2. Review [Scaling Plan](./scaling-plan.md) for scalability roadmap
3. Set up performance monitoring infrastructure
4. Begin Phase 1 implementation
