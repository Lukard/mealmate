# Scaling Plan

## Overview

This document outlines the scalability roadmap for the Meal Automation Platform, covering horizontal scaling for scrapers, database sharding, CDN configuration, and serverless considerations.

---

## 1. Current State Assessment

### 1.1 Baseline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE (MVP)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   Web App    │    │  Extension   │    │  Mobile App  │               │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘               │
│         │                   │                   │                        │
│         └───────────────────┼───────────────────┘                        │
│                             ▼                                            │
│                    ┌────────────────┐                                    │
│                    │   API Server   │  (Single Node)                     │
│                    │    (Node.js)   │                                    │
│                    └────────┬───────┘                                    │
│                             │                                            │
│              ┌──────────────┼──────────────┐                             │
│              ▼              ▼              ▼                             │
│       ┌──────────┐   ┌──────────┐   ┌──────────┐                        │
│       │PostgreSQL│   │  Redis   │   │ Scraper  │                        │
│       │ (Single) │   │ (Single) │   │ (Single) │                        │
│       └──────────┘   └──────────┘   └──────────┘                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

Capacity:
- Users: ~1,000 concurrent
- Products: ~500,000
- Requests: ~100 req/s
- Scraping: ~1,000 products/hour
```

### 1.2 Scaling Triggers

| Metric | Trigger Threshold | Action |
|--------|-------------------|--------|
| Concurrent users | > 5,000 | Scale API servers |
| Product catalog | > 2M products | Shard database |
| API latency p99 | > 500ms | Add caching/replicas |
| Scrape backlog | > 4 hours | Scale scrapers |
| Storage usage | > 80% | Expand/archive |

---

## 2. Target Architecture

### 2.1 Phase 3: Full Scale Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TARGET ARCHITECTURE (FULL SCALE)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                            CDN LAYER                                 │    │
│  │                         (CloudFlare)                                 │    │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │    │
│  │   │ EU Edge │  │ NA Edge │  │ LATAM   │  │  APAC   │               │    │
│  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘               │    │
│  └─────────────────────────────────┬───────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────┐    │
│  │                         API GATEWAY LAYER                            │    │
│  │                    (Kong / AWS API Gateway)                          │    │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │    │
│  │   │ Rate Limit  │  │   Auth      │  │  Routing    │                │    │
│  │   │   WAF       │  │   JWT       │  │  Load Bal   │                │    │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │    │
│  └─────────────────────────────────┬───────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────┐    │
│  │                         APPLICATION LAYER                            │    │
│  │                     (Kubernetes / ECS / Fly.io)                      │    │
│  │                                                                       │    │
│  │   ┌────────────────────────────────────────────────────────────┐    │    │
│  │   │                    API Services (Auto-scaling)              │    │    │
│  │   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │    │    │
│  │   │   │ API-1   │  │ API-2   │  │ API-3   │  │ API-N   │       │    │    │
│  │   │   │ (Pod)   │  │ (Pod)   │  │ (Pod)   │  │ (Pod)   │       │    │    │
│  │   │   └─────────┘  └─────────┘  └─────────┘  └─────────┘       │    │    │
│  │   └────────────────────────────────────────────────────────────┘    │    │
│  │                                                                       │    │
│  │   ┌────────────────────────────────────────────────────────────┐    │    │
│  │   │               Background Workers (Auto-scaling)             │    │    │
│  │   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │    │    │
│  │   │   │Scraper-1│  │Scraper-2│  │Matcher  │  │ Image   │       │    │    │
│  │   │   │Mercadona│  │Carrefour│  │ Worker  │  │ Worker  │       │    │    │
│  │   │   └─────────┘  └─────────┘  └─────────┘  └─────────┘       │    │    │
│  │   └────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────┐    │
│  │                           DATA LAYER                                 │    │
│  │                                                                       │    │
│  │   ┌──────────────────────┐  ┌──────────────────────┐                │    │
│  │   │  PostgreSQL Cluster  │  │    Redis Cluster     │                │    │
│  │   │  ┌────────────────┐  │  │  ┌────────────────┐  │                │    │
│  │   │  │    Primary     │  │  │  │    Primary     │  │                │    │
│  │   │  └───────┬────────┘  │  │  └───────┬────────┘  │                │    │
│  │   │          │           │  │          │           │                │    │
│  │   │  ┌───────┴────────┐  │  │  ┌───────┴────────┐  │                │    │
│  │   │  │ Read Replicas  │  │  │  │    Replicas    │  │                │    │
│  │   │  │   (3 nodes)    │  │  │  │   (3 nodes)    │  │                │    │
│  │   │  └────────────────┘  │  │  └────────────────┘  │                │    │
│  │   └──────────────────────┘  └──────────────────────┘                │    │
│  │                                                                       │    │
│  │   ┌──────────────────────┐  ┌──────────────────────┐                │    │
│  │   │    Object Storage    │  │   Message Queue      │                │    │
│  │   │   (CloudFlare R2)    │  │   (Redis Streams/    │                │    │
│  │   │    - Images          │  │    RabbitMQ)         │                │    │
│  │   │    - Backups         │  │    - Scrape Jobs     │                │    │
│  │   │    - Exports         │  │    - Match Jobs      │                │    │
│  │   └──────────────────────┘  └──────────────────────┘                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Capacity:
- Users: ~100,000+ concurrent
- Products: ~10M+
- Requests: ~10,000 req/s
- Scraping: ~100,000 products/hour
```

---

## 3. Horizontal Scaling for Scrapers

### 3.1 Scraper Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SCRAPER SCALING ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     SCRAPER ORCHESTRATOR                            │ │
│  │                                                                      │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │   │    Job      │  │   Health    │  │   Metrics   │                │ │
│  │   │  Scheduler  │  │   Monitor   │  │  Collector  │                │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └───────────────────────────┬────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        JOB QUEUE                                    │ │
│  │                   (Redis Streams / BullMQ)                          │ │
│  │                                                                      │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │   │  Mercadona  │  │  Carrefour  │  │    Lidl     │                │ │
│  │   │   Queue     │  │   Queue     │  │   Queue     │                │ │
│  │   │  (priority) │  │  (priority) │  │  (priority) │                │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └───────────────────────────┬────────────────────────────────────────┘ │
│                              │                                           │
│                ┌─────────────┼─────────────┐                            │
│                ▼             ▼             ▼                            │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              │
│  │  Worker Pool   │ │  Worker Pool   │ │  Worker Pool   │              │
│  │   MERCADONA    │ │   CARREFOUR    │ │      LIDL      │              │
│  │                │ │                │ │                │              │
│  │ ┌────┐ ┌────┐ │ │ ┌────┐ ┌────┐ │ │ ┌────┐ ┌────┐ │              │
│  │ │ W1 │ │ W2 │ │ │ │ W1 │ │ W2 │ │ │ │ W1 │ │ W2 │ │              │
│  │ └────┘ └────┘ │ │ └────┘ └────┘ │ │ └────┘ └────┘ │              │
│  │ ┌────┐ ┌────┐ │ │ ┌────┐ ┌────┐ │ │ ┌────┐ ┌────┐ │              │
│  │ │ W3 │ │ W4 │ │ │ │ W3 │ │ W4 │ │ │ │ W3 │ │ W4 │ │              │
│  │ └────┘ └────┘ │ │ └────┘ └────┘ │ │ └────┘ └────┘ │              │
│  └────────────────┘ └────────────────┘ └────────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Worker Configuration

```typescript
interface ScraperScalingConfig {
  // Per-supermarket worker pools
  workerPools: {
    mercadona: {
      minWorkers: 2;
      maxWorkers: 10;
      pagesPerWorker: 4;          // Browser tabs
      scaleUpThreshold: 1000;     // Queued jobs
      scaleDownThreshold: 100;
      cooldownPeriod: 300;        // Seconds
    };

    carrefour: {
      minWorkers: 2;
      maxWorkers: 8;
      pagesPerWorker: 3;
      scaleUpThreshold: 800;
      scaleDownThreshold: 80;
      cooldownPeriod: 300;
    };

    lidl: {
      minWorkers: 1;
      maxWorkers: 6;
      pagesPerWorker: 4;
      scaleUpThreshold: 600;
      scaleDownThreshold: 60;
      cooldownPeriod: 300;
    };
  };

  // Auto-scaling rules
  autoscaling: {
    enabled: true;
    metrics: ['queue_depth', 'worker_cpu', 'scrape_rate'];

    rules: [
      {
        name: 'scale_up_queue_depth';
        condition: 'queue_depth > threshold';
        action: 'add_worker';
        cooldown: 120;
      },
      {
        name: 'scale_down_idle';
        condition: 'worker_idle_time > 300';
        action: 'remove_worker';
        cooldown: 300;
      },
    ];
  };

  // Proxy rotation
  proxy: {
    enabled: true;
    pool: ['residential', 'datacenter'];
    rotationStrategy: 'round-robin';
    failoverThreshold: 3;
  };
}
```

### 3.3 Job Queue Implementation

```typescript
import { Queue, Worker, Job } from 'bullmq';

// Job queue setup
class ScraperJobQueue {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker[]> = new Map();

  async initialize(supermarkets: string[]): Promise<void> {
    for (const supermarket of supermarkets) {
      // Create queue per supermarket
      const queue = new Queue(`scraper:${supermarket}`, {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 3600,      // 1 hour
            count: 1000,
          },
          removeOnFail: {
            age: 86400,     // 24 hours
          },
        },
      });

      this.queues.set(supermarket, queue);
    }
  }

  // Add scrape job
  async addScrapeJob(
    supermarket: string,
    job: ScrapeJob
  ): Promise<Job> {
    const queue = this.queues.get(supermarket);

    return queue.add(job.type, job.data, {
      priority: this.calculatePriority(job),
      delay: job.delay || 0,
      jobId: `${supermarket}:${job.type}:${job.data.id}`,
    });
  }

  // Scale workers dynamically
  async scaleWorkers(supermarket: string, targetCount: number): Promise<void> {
    const currentWorkers = this.workers.get(supermarket) || [];
    const currentCount = currentWorkers.length;

    if (targetCount > currentCount) {
      // Scale up
      for (let i = 0; i < targetCount - currentCount; i++) {
        const worker = await this.createWorker(supermarket);
        currentWorkers.push(worker);
      }
    } else if (targetCount < currentCount) {
      // Scale down
      const toRemove = currentWorkers.splice(targetCount);
      await Promise.all(toRemove.map(w => w.close()));
    }

    this.workers.set(supermarket, currentWorkers);
  }

  private async createWorker(supermarket: string): Promise<Worker> {
    const worker = new Worker(
      `scraper:${supermarket}`,
      async (job: Job) => {
        const scraper = await this.getScraper(supermarket);
        return scraper.processJob(job.data);
      },
      {
        connection: this.redisConnection,
        concurrency: 4,
        limiter: {
          max: 10,
          duration: 1000,  // 10 jobs per second max
        },
      }
    );

    // Worker event handlers
    worker.on('completed', (job) => {
      this.metrics.recordCompletion(supermarket, job);
    });

    worker.on('failed', (job, err) => {
      this.metrics.recordFailure(supermarket, job, err);
    });

    return worker;
  }
}
```

### 3.4 Kubernetes Deployment

```yaml
# scraper-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scraper-mercadona
  labels:
    app: scraper
    supermarket: mercadona
spec:
  replicas: 2
  selector:
    matchLabels:
      app: scraper
      supermarket: mercadona
  template:
    metadata:
      labels:
        app: scraper
        supermarket: mercadona
    spec:
      containers:
      - name: scraper
        image: mealapp/scraper:latest
        env:
        - name: SUPERMARKET
          value: "mercadona"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        # Chromium needs shared memory
        volumeMounts:
        - name: dshm
          mountPath: /dev/shm
      volumes:
      - name: dshm
        emptyDir:
          medium: Memory
          sizeLimit: 2Gi

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: scraper-mercadona-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: scraper-mercadona
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: redis_queue_depth
        selector:
          matchLabels:
            queue: "scraper:mercadona"
      target:
        type: AverageValue
        averageValue: "500"
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 120
```

---

## 4. Database Sharding Strategies

### 4.1 Sharding Approach

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATABASE SHARDING ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        ROUTING LAYER                                │ │
│  │                      (Citus / ProxySQL)                             │ │
│  │                                                                      │ │
│  │   Query: SELECT * FROM products WHERE supermarket_id = 'mercadona'  │ │
│  │                              │                                       │ │
│  │                    ┌─────────▼─────────┐                            │ │
│  │                    │   Shard Router    │                            │ │
│  │                    │ (hash(super_id))  │                            │ │
│  │                    └─────────┬─────────┘                            │ │
│  │                              │                                       │ │
│  └──────────────────────────────┼─────────────────────────────────────┘ │
│                                 │                                        │
│           ┌─────────────────────┼─────────────────────┐                 │
│           │                     │                     │                 │
│           ▼                     ▼                     ▼                 │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
│  │    SHARD 1      │   │    SHARD 2      │   │    SHARD 3      │       │
│  │   (Mercadona,   │   │   (Carrefour,   │   │   (Dia,         │       │
│  │    Alcampo)     │   │    El Corte I.) │   │    Eroski...)   │       │
│  │                 │   │                 │   │                 │       │
│  │  ┌───────────┐  │   │  ┌───────────┐  │   │  ┌───────────┐  │       │
│  │  │  Primary  │  │   │  │  Primary  │  │   │  │  Primary  │  │       │
│  │  └─────┬─────┘  │   │  └─────┬─────┘  │   │  └─────┬─────┘  │       │
│  │        │        │   │        │        │   │        │        │       │
│  │  ┌─────┴─────┐  │   │  ┌─────┴─────┐  │   │  ┌─────┴─────┐  │       │
│  │  │ Replica 1 │  │   │  │ Replica 1 │  │   │  │ Replica 1 │  │       │
│  │  │ Replica 2 │  │   │  │ Replica 2 │  │   │  │ Replica 2 │  │       │
│  │  └───────────┘  │   │  └───────────┘  │   │  └───────────┘  │       │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      REFERENCE TABLES                               │ │
│  │              (Replicated across all shards)                         │ │
│  │                                                                      │ │
│  │   categories  │  supermarkets  │  units  │  user_preferences       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Sharding Key Selection

```typescript
interface ShardingConfig {
  // Sharding key: supermarket_id (hash-based)
  shardKey: 'supermarket_id';

  // Shard mapping
  shards: {
    shard_1: {
      supermarkets: ['mercadona', 'alcampo'];
      connectionString: 'postgresql://shard1.db.local:5432/products';
      readReplicas: 2;
    };

    shard_2: {
      supermarkets: ['carrefour', 'elcorteingles'];
      connectionString: 'postgresql://shard2.db.local:5432/products';
      readReplicas: 2;
    };

    shard_3: {
      supermarkets: ['lidl', 'dia', 'eroski', 'consum'];
      connectionString: 'postgresql://shard3.db.local:5432/products';
      readReplicas: 2;
    };
  };

  // Reference tables (replicated)
  referenceTables: [
    'categories',
    'supermarkets',
    'units',
    'unit_conversions',
  ];

  // Cross-shard queries
  crossShardStrategy: {
    priceComparison: 'scatter-gather';  // Query all shards in parallel
    globalSearch: 'federated-search';    // Use separate search index
  };
}
```

### 4.3 Citus Implementation

```sql
-- Enable Citus extension
CREATE EXTENSION citus;

-- Add coordinator and workers
SELECT citus_add_node('worker1.db.local', 5432);
SELECT citus_add_node('worker2.db.local', 5432);
SELECT citus_add_node('worker3.db.local', 5432);

-- Distribute products table by supermarket_id
SELECT create_distributed_table('products', 'supermarket_id');

-- Create reference tables (replicated to all nodes)
SELECT create_reference_table('categories');
SELECT create_reference_table('supermarkets');
SELECT create_reference_table('units');

-- Collocate related tables
SELECT create_distributed_table('price_history', 'product_id',
  colocate_with => 'products');

SELECT create_distributed_table('product_images', 'product_id',
  colocate_with => 'products');

-- Partition price_history by time
SELECT create_time_partitions(
  table_name => 'price_history',
  partition_interval => '1 month',
  start_from => '2026-01-01',
  end_at => '2027-01-01'
);

-- Enable columnar storage for price history (compression)
SELECT alter_table_set_access_method('price_history', 'columnar');
```

### 4.4 Query Routing

```typescript
class ShardRouter {
  private shardConfig: ShardingConfig;
  private connections: Map<string, Pool>;

  // Route query to correct shard
  async query(sql: string, params: any[], supermarketId?: string): Promise<QueryResult> {
    if (supermarketId) {
      // Direct routing
      const shard = this.getShard(supermarketId);
      return this.connections.get(shard).query(sql, params);
    }

    // Cross-shard query
    return this.scatterGather(sql, params);
  }

  private getShard(supermarketId: string): string {
    for (const [shardName, config] of Object.entries(this.shardConfig.shards)) {
      if (config.supermarkets.includes(supermarketId)) {
        return shardName;
      }
    }
    throw new Error(`Unknown supermarket: ${supermarketId}`);
  }

  // Scatter-gather for cross-shard queries
  private async scatterGather(sql: string, params: any[]): Promise<QueryResult> {
    const shards = Object.keys(this.shardConfig.shards);

    const results = await Promise.all(
      shards.map(shard => this.connections.get(shard).query(sql, params))
    );

    // Merge results
    return this.mergeResults(results);
  }

  // For price comparison - query all shards in parallel
  async comparePrices(productName: string, supermarkets: string[]): Promise<PriceComparison[]> {
    // Group supermarkets by shard
    const shardQueries = this.groupByShards(supermarkets);

    const results = await Promise.all(
      Object.entries(shardQueries).map(async ([shard, markets]) => {
        const sql = `
          SELECT supermarket_id, name, price, price_per_unit
          FROM products
          WHERE supermarket_id = ANY($1)
            AND normalized_name % $2
          ORDER BY similarity(normalized_name, $2) DESC
          LIMIT 5
        `;
        return this.connections.get(shard).query(sql, [markets, productName]);
      })
    );

    return this.aggregatePriceComparison(results);
  }
}
```

---

## 5. CDN for Static Assets

### 5.1 CDN Architecture

```yaml
cdn_configuration:
  provider: "CloudFlare"
  plan: "Pro"  # For image transformation

  zones:
    # Main application
    app:
      domain: "app.mealplanner.es"
      ssl: "full_strict"
      minify: ["javascript", "css", "html"]
      brotli: true

    # API
    api:
      domain: "api.mealplanner.es"
      ssl: "full_strict"
      cache_level: "standard"
      edge_cache_ttl: 60

    # Static assets
    static:
      domain: "static.mealplanner.es"
      ssl: "full_strict"
      cache_level: "aggressive"
      edge_cache_ttl: 2592000  # 30 days

    # Product images
    images:
      domain: "images.mealplanner.es"
      ssl: "full_strict"
      polish: "lossy"
      webp: true
      image_resizing: true

  page_rules:
    # Cache static assets aggressively
    - match: "static.mealplanner.es/*"
      settings:
        cache_level: "cache_everything"
        edge_cache_ttl: 2592000
        browser_cache_ttl: 604800

    # Cache images
    - match: "images.mealplanner.es/*"
      settings:
        cache_level: "cache_everything"
        edge_cache_ttl: 604800
        polish: "lossy"

    # API caching
    - match: "api.mealplanner.es/v1/products/*"
      settings:
        cache_level: "standard"
        edge_cache_ttl: 300
        bypass_cache_on_cookie: "session_token"

  workers:
    # Image transformation worker
    image_transformer:
      route: "images.mealplanner.es/*"
      script: |
        addEventListener('fetch', event => {
          event.respondWith(handleRequest(event.request))
        })

        async function handleRequest(request) {
          const url = new URL(request.url)

          // Parse image options from URL
          const options = parseOptions(url.searchParams)

          // Fetch and transform
          return fetch(request, {
            cf: {
              image: {
                width: options.width,
                height: options.height,
                fit: options.fit || 'contain',
                quality: options.quality || 80,
                format: 'webp'
              }
            }
          })
        }
```

### 5.2 Cache Purging Strategy

```typescript
class CDNPurger {
  private cloudflare: CloudflareAPI;

  // Purge by URL
  async purgeUrls(urls: string[]): Promise<void> {
    await this.cloudflare.zones.purgeCache(this.zoneId, {
      files: urls,
    });
  }

  // Purge by cache tags
  async purgeTags(tags: string[]): Promise<void> {
    await this.cloudflare.zones.purgeCache(this.zoneId, {
      tags: tags,
    });
  }

  // Purge product images
  async purgeProductImages(supermarket: string, productId: string): Promise<void> {
    const tags = [
      `product:${productId}`,
      `supermarket:${supermarket}`,
    ];

    await this.purgeTags(tags);

    // Also purge specific URLs
    const sizes = ['thumbnail', 'card', 'detail'];
    const urls = sizes.map(size =>
      `https://images.mealplanner.es/${supermarket}/${productId}/${size}.webp`
    );

    await this.purgeUrls(urls);
  }

  // Batch purge on catalog update
  async purgeOnCatalogUpdate(supermarket: string): Promise<void> {
    // Purge by supermarket tag
    await this.purgeTags([`supermarket:${supermarket}`]);

    // Purge API cache for this supermarket
    await this.purgeUrls([
      `https://api.mealplanner.es/v1/products?supermarket=${supermarket}*`,
      `https://api.mealplanner.es/v1/categories?supermarket=${supermarket}`,
    ]);
  }
}
```

---

## 6. Serverless Considerations

### 6.1 Serverless Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SERVERLESS ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        API LAYER                                    │ │
│  │                                                                      │ │
│  │   ┌─────────────────────────────────────────────────────────────┐  │ │
│  │   │              CloudFlare Workers / Vercel Edge               │  │ │
│  │   │                                                              │  │ │
│  │   │  /api/products/*     │  /api/search      │  /api/match      │  │ │
│  │   │  (Edge Function)     │  (Edge Function)  │  (Edge Function) │  │ │
│  │   └─────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    COMPUTE LAYER                                    │ │
│  │                                                                      │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │   │   AWS       │  │  CloudFlare │  │   Fly.io    │                │ │
│  │   │   Lambda    │  │   Workers   │  │   Machines  │                │ │
│  │   │             │  │   (Durable  │  │             │                │ │
│  │   │ - Scraping  │  │   Objects)  │  │ - Scrapers  │                │ │
│  │   │ - Matching  │  │             │  │ - Browsers  │                │ │
│  │   │ - Batch     │  │ - Sessions  │  │             │                │ │
│  │   └─────────────┘  │ - Rate Lim  │  └─────────────┘                │ │
│  │                    └─────────────┘                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       DATA LAYER                                    │ │
│  │                                                                      │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │   │   Neon      │  │   Upstash   │  │   R2        │                │ │
│  │   │ (Serverless │  │  (Redis)    │  │  (Objects)  │                │ │
│  │   │  Postgres)  │  │             │  │             │                │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Serverless Trade-offs

| Aspect | Serverless | Container/VM |
|--------|------------|--------------|
| **Cost at Low Scale** | Lower (pay per use) | Higher (always running) |
| **Cost at High Scale** | Higher | Lower |
| **Cold Start** | 50-500ms | None |
| **Max Duration** | 5-30 min | Unlimited |
| **Browser Scraping** | Limited (headless only) | Full support |
| **State Management** | Stateless (external state) | Stateful |
| **Scaling Speed** | Instant | 30s-2min |
| **Complexity** | Lower ops overhead | Higher ops overhead |

### 6.3 Hybrid Approach

```typescript
// Serverless for stateless operations
interface ServerlessConfig {
  // API endpoints (CloudFlare Workers / Vercel Edge)
  api: {
    runtime: 'edge';
    regions: ['cdg', 'mad', 'lhr'];  // Paris, Madrid, London

    routes: {
      '/api/products/:id': 'getProduct';
      '/api/search': 'searchProducts';
      '/api/match': 'matchProducts';
      '/api/prices/compare': 'comparePrices';
    };
  };

  // Background jobs (AWS Lambda)
  jobs: {
    runtime: 'lambda';

    functions: {
      'process-scrape-batch': {
        memory: 1024;
        timeout: 900;  // 15 min
        concurrency: 100;
      };

      'generate-embeddings': {
        memory: 2048;
        timeout: 300;
        concurrency: 50;
      };

      'update-price-history': {
        memory: 512;
        timeout: 60;
        concurrency: 200;
      };
    };
  };

  // Long-running processes (Fly.io Machines)
  persistent: {
    runtime: 'fly-machines';

    services: {
      'scraper-mercadona': {
        image: 'mealapp/scraper:latest';
        memory: '2gb';
        cpu: 2;
        autoStop: true;   // Stop when idle
        autoStart: true;  // Start on request
      };
    };
  };
}
```

### 6.4 Serverless Database (Neon)

```typescript
// Neon serverless PostgreSQL configuration
const neonConfig = {
  // Connection pooling for serverless
  pooling: {
    endpoint: 'ep-xxx.eu-west-1.aws.neon.tech',
    mode: 'transaction';  // Connection pooling mode
  };

  // Branching for development
  branches: {
    production: 'main';
    staging: 'br-staging-xxx';
    development: 'br-dev-xxx';
  };

  // Auto-suspend for cost savings
  compute: {
    minCU: 0.25;        // Minimum compute units
    maxCU: 4;           // Maximum compute units
    suspendTimeout: 300; // Suspend after 5 min idle
  };
};

// Neon client with connection pooling
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Enable WebSocket for serverless environments
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pooling for Lambda
  max: 1,
  idleTimeoutMillis: 1000,
});

// Use in Lambda function
export async function handler(event) {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [event.productId]
  );

  return {
    statusCode: 200,
    body: JSON.stringify(rows[0]),
  };
}
```

---

## 7. Scaling Roadmap

### 7.1 Phase 1: MVP (0-1K Users)

**Timeline: Months 1-3**

```yaml
infrastructure:
  api:
    type: "single-node"
    spec: "2 vCPU, 4GB RAM"
    provider: "Fly.io / Railway"

  database:
    type: "managed-postgres"
    spec: "2 vCPU, 4GB RAM, 50GB storage"
    provider: "Neon / Supabase"

  cache:
    type: "managed-redis"
    spec: "1GB"
    provider: "Upstash"

  scraper:
    type: "single-node"
    spec: "2 vCPU, 4GB RAM"

  cdn:
    type: "cloudflare-free"

capacity:
  concurrent_users: 1000
  products: 500000
  requests_per_second: 100
  scrape_rate: 1000_products_per_hour

estimated_cost: "$50-100/month"
```

### 7.2 Phase 2: Growth (1K-10K Users)

**Timeline: Months 4-6**

```yaml
infrastructure:
  api:
    type: "auto-scaling"
    min_instances: 2
    max_instances: 5
    provider: "Fly.io / Kubernetes"

  database:
    type: "postgres-cluster"
    primary: "4 vCPU, 16GB RAM"
    replicas: 2
    provider: "Neon / RDS"

  cache:
    type: "redis-cluster"
    spec: "3 nodes, 2GB each"
    provider: "Upstash / ElastiCache"

  scraper:
    type: "worker-pool"
    workers_per_supermarket: 2
    total_workers: 16

  cdn:
    type: "cloudflare-pro"
    image_transformation: true

capacity:
  concurrent_users: 10000
  products: 2000000
  requests_per_second: 1000
  scrape_rate: 10000_products_per_hour

estimated_cost: "$300-500/month"
```

### 7.3 Phase 3: Scale (10K-100K Users)

**Timeline: Months 7-12**

```yaml
infrastructure:
  api:
    type: "kubernetes-cluster"
    nodes: 3-10
    auto_scaling: true
    provider: "EKS / GKE"

  database:
    type: "sharded-cluster"
    shards: 3
    replicas_per_shard: 2
    provider: "Citus / RDS"

  cache:
    type: "redis-cluster"
    nodes: 6
    total_memory: "24GB"
    provider: "ElastiCache"

  scraper:
    type: "kubernetes-workers"
    auto_scaling: true
    max_workers: 50

  cdn:
    type: "cloudflare-business"
    edge_workers: true

  search:
    type: "elasticsearch"
    nodes: 3
    provider: "Elastic Cloud"

capacity:
  concurrent_users: 100000
  products: 10000000
  requests_per_second: 10000
  scrape_rate: 100000_products_per_hour

estimated_cost: "$2000-5000/month"
```

### 7.4 Phase 4: Enterprise (100K+ Users)

**Timeline: Year 2+**

```yaml
infrastructure:
  api:
    type: "multi-region-kubernetes"
    regions: ["eu-west", "eu-central"]
    nodes_per_region: 5-20

  database:
    type: "global-distributed"
    regions: ["eu-west", "eu-central"]
    shards_per_region: 3

  cache:
    type: "global-redis"
    regions: ["eu-west", "eu-central"]

  scraper:
    type: "distributed-workers"
    regions: ["eu-west"]
    max_workers: 200

  cdn:
    type: "multi-cdn"
    providers: ["cloudflare", "fastly"]

  search:
    type: "elasticsearch-cluster"
    nodes: 9
    geo_replicated: true

capacity:
  concurrent_users: 500000+
  products: 50000000+
  requests_per_second: 50000+
  scrape_rate: 500000_products_per_hour

estimated_cost: "$10000-20000/month"
```

---

## 8. Scaling Metrics and Alerts

### 8.1 Key Scaling Metrics

```yaml
metrics:
  # Application metrics
  application:
    - name: "request_latency_p99"
      threshold: "500ms"
      action: "scale_api"

    - name: "error_rate"
      threshold: "1%"
      action: "alert_oncall"

    - name: "concurrent_connections"
      threshold: "80% of max"
      action: "scale_api"

  # Database metrics
  database:
    - name: "connection_pool_usage"
      threshold: "80%"
      action: "increase_pool_size"

    - name: "query_latency_p99"
      threshold: "100ms"
      action: "optimize_queries"

    - name: "disk_usage"
      threshold: "80%"
      action: "expand_storage"

  # Scraper metrics
  scraper:
    - name: "queue_depth"
      threshold: "10000 jobs"
      action: "scale_workers"

    - name: "scrape_error_rate"
      threshold: "5%"
      action: "alert_oncall"

    - name: "scrape_latency_p99"
      threshold: "30s"
      action: "investigate"

  # Cache metrics
  cache:
    - name: "hit_rate"
      threshold: "<60%"
      action: "optimize_caching"

    - name: "memory_usage"
      threshold: "80%"
      action: "scale_cache"

    - name: "eviction_rate"
      threshold: "high"
      action: "increase_cache_size"
```

### 8.2 Alerting Configuration

```yaml
# PagerDuty / OpsGenie alerting
alerts:
  critical:
    - name: "api_down"
      condition: "uptime < 99.9%"
      channel: "pagerduty"
      escalation: "immediate"

    - name: "database_unreachable"
      condition: "db_health_check_failed"
      channel: "pagerduty"
      escalation: "immediate"

  high:
    - name: "high_latency"
      condition: "request_latency_p99 > 1s for 5m"
      channel: "slack_alerts"
      escalation: "5m"

    - name: "high_error_rate"
      condition: "error_rate > 5% for 5m"
      channel: "slack_alerts"
      escalation: "5m"

  medium:
    - name: "scaling_event"
      condition: "auto_scale_triggered"
      channel: "slack_ops"
      escalation: "none"

    - name: "cache_hit_rate_low"
      condition: "cache_hit_rate < 60% for 15m"
      channel: "slack_ops"
      escalation: "none"
```

---

## 9. Cost Optimization

### 9.1 Cost Breakdown by Phase

| Phase | Compute | Database | Cache | CDN | Other | Total |
|-------|---------|----------|-------|-----|-------|-------|
| MVP | $30 | $15 | $10 | $0 | $20 | $75/mo |
| Growth | $150 | $100 | $50 | $50 | $50 | $400/mo |
| Scale | $1500 | $1000 | $500 | $200 | $300 | $3500/mo |
| Enterprise | $8000 | $5000 | $2000 | $1000 | $1000 | $17000/mo |

### 9.2 Cost Optimization Strategies

```yaml
cost_optimization:
  compute:
    - spot_instances: "Use for scraper workers (70% savings)"
    - right_sizing: "Monitor and adjust instance sizes"
    - auto_scaling: "Scale down during off-peak"
    - reserved_capacity: "Reserve base capacity (30% savings)"

  database:
    - read_replicas: "Route reads to cheaper replicas"
    - connection_pooling: "Reduce connection overhead"
    - query_optimization: "Reduce compute time"
    - cold_storage: "Archive old price history"

  cache:
    - tiered_caching: "Use memory for hot, Redis for warm"
    - compression: "Compress cached data (LZ4)"
    - ttl_optimization: "Right-size TTLs to reduce memory"

  storage:
    - image_optimization: "Compress images (WebP/AVIF)"
    - cdn_caching: "Maximize CDN cache hits"
    - lifecycle_policies: "Auto-delete old data"

  network:
    - cdn_optimization: "Cache API responses at edge"
    - compression: "Brotli/gzip for all responses"
    - regional_deployment: "Deploy close to users"
```

---

## 10. Implementation Checklist

### Phase 1 (MVP)
- [ ] Deploy single API server
- [ ] Set up managed PostgreSQL
- [ ] Configure Redis caching
- [ ] Deploy single scraper
- [ ] Set up CloudFlare CDN
- [ ] Implement basic monitoring

### Phase 2 (Growth)
- [ ] Add API auto-scaling
- [ ] Set up database replicas
- [ ] Deploy Redis cluster
- [ ] Scale scraper workers
- [ ] Enable image transformation
- [ ] Implement advanced monitoring

### Phase 3 (Scale)
- [ ] Deploy Kubernetes cluster
- [ ] Implement database sharding
- [ ] Set up global Redis
- [ ] Deploy Elasticsearch
- [ ] Multi-region CDN
- [ ] Implement chaos engineering

### Phase 4 (Enterprise)
- [ ] Multi-region deployment
- [ ] Global database distribution
- [ ] Multi-CDN strategy
- [ ] Advanced analytics
- [ ] SLA monitoring
- [ ] Compliance (GDPR)

---

## Next Steps

1. Review [Performance Strategy](./performance-strategy.md) for optimization approach
2. Review [Caching Strategy](./caching-strategy.md) for caching implementation
3. Set up monitoring infrastructure
4. Begin Phase 1 deployment
5. Establish baseline metrics
