# Meal Automation System - Architecture Overview

## Executive Summary

This document describes the high-level architecture for an automated meal planning and grocery shopping system. The system enables users to plan weekly meals based on preferences and dietary restrictions, automatically matches ingredients to supermarket products, optimizes for price and availability, and facilitates automated purchasing through a browser extension.

---

## Technology Stack Decisions

### Frontend: **Next.js 14+ (App Router)**

**Justification:**
- Server-side rendering for SEO and initial load performance
- React Server Components reduce client bundle size
- Built-in API routes eliminate need for separate backend deployment
- Excellent TypeScript support
- Strong ecosystem for authentication (NextAuth.js)
- Edge runtime support for global low-latency responses

**Alternatives Considered:**
- Vue/Nuxt: Smaller ecosystem, less enterprise adoption
- Remix: Newer, smaller community, less mature

### Backend: **Node.js with Hono**

**Justification:**
- Hono is ultrafast (faster than Express by 4x)
- Edge-ready, works on Cloudflare Workers, Vercel Edge, Deno
- TypeScript-first design
- Middleware ecosystem compatible with Express patterns
- Lightweight (~14KB) vs Express (~200KB)

**Alternatives Considered:**
- Express: Slower, older patterns, but more middleware
- Deno/Fresh: Smaller ecosystem, deployment complexity
- Python/FastAPI: Different runtime, team skill mismatch

### Scraping: **Playwright**

**Justification:**
- Full browser automation (handles JavaScript-rendered content)
- Multi-browser support (Chromium, Firefox, WebKit)
- Better than Puppeteer for stealth (less detection)
- Built-in waiting mechanisms reduce flakiness
- Screenshot and trace debugging
- API interception for faster data extraction when possible

**Alternatives Considered:**
- Puppeteer: Chrome-only, more detectable
- Cheerio: No JavaScript rendering, limited to static HTML
- Selenium: Slower, more complex setup

### Database: **PostgreSQL with Drizzle ORM**

**Justification:**
- ACID compliance for transaction integrity (orders, payments)
- JSON/JSONB support for flexible product data
- Full-text search for recipe/product matching
- pg_trgm for fuzzy ingredient matching
- Excellent scalability (read replicas, partitioning)
- Drizzle: Type-safe, SQL-like syntax, excellent DX

**Alternatives Considered:**
- SQLite: No concurrent writes, single-file limitations
- MongoDB: Overkill for relational data, weaker transactions
- Prisma: Slower queries, larger bundle

### Caching: **Redis (Upstash for serverless)**

**Justification:**
- Sub-millisecond reads for product price cache
- TTL support for automatic cache expiration
- Pub/sub for real-time price alerts
- Sorted sets for price ranking
- Serverless-friendly with Upstash

### Browser Extension: **Manifest V3 + Plasmo Framework**

**Justification:**
- Manifest V3 required for Chrome Web Store (2024+)
- Plasmo: React-based, hot reload, TypeScript
- Handles cross-browser builds (Chrome, Firefox, Edge)
- Built-in message passing abstractions

---

## System Architecture Diagram

```
+------------------------------------------------------------------+
|                         CLIENT LAYER                              |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------------+    +-------------------+    +------------+ |
|  |    Next.js Web    |    | Browser Extension |    | Mobile PWA | |
|  |    Application    |    |   (Plasmo/MV3)    |    |  (Future)  | |
|  +--------+----------+    +--------+----------+    +-----+------+ |
|           |                        |                     |        |
+-----------+------------------------+---------------------+--------+
            |                        |                     |
            v                        v                     v
+------------------------------------------------------------------+
|                         API GATEWAY                               |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------------------------------------------+  |
|  |              Hono API (Edge-Compatible)                     |  |
|  |  +----------+  +----------+  +----------+  +-------------+  |  |
|  |  |   Auth   |  |   Rate   |  |   CORS   |  |   Logging   |  |  |
|  |  |Middleware|  |  Limiter |  |  Handler |  |   Tracer    |  |  |
|  |  +----------+  +----------+  +----------+  +-------------+  |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
            |
            v
+------------------------------------------------------------------+
|                      SERVICE LAYER                                |
+------------------------------------------------------------------+
|                                                                   |
|  +----------------+  +----------------+  +--------------------+   |
|  |  Meal Planning |  |    Recipe      |  |   User Profile     |   |
|  |    Service     |  |    Service     |  |     Service        |   |
|  +-------+--------+  +-------+--------+  +---------+----------+   |
|          |                   |                     |              |
|  +-------v--------+  +-------v--------+  +--------v-----------+   |
|  |   Ingredient   |  |    Product     |  |    Supermarket     |   |
|  |   Extractor    |  |    Matcher     |  |  Scraper Service   |   |
|  +-------+--------+  +-------+--------+  +---------+----------+   |
|          |                   |                     |              |
|  +-------v--------+  +-------v--------+  +--------v-----------+   |
|  |     Price      |  |   Grocery List |  |    Purchase        |   |
|  |   Optimizer    |  |   Generator    |  |   Automation       |   |
|  +----------------+  +----------------+  +--------------------+   |
|                                                                   |
+------------------------------------------------------------------+
            |
            v
+------------------------------------------------------------------+
|                       DATA LAYER                                  |
+------------------------------------------------------------------+
|                                                                   |
|  +----------------+  +----------------+  +--------------------+   |
|  |   PostgreSQL   |  |     Redis      |  |   Blob Storage     |   |
|  | (Primary Data) |  |    (Cache)     |  | (Images/Recipes)   |   |
|  +----------------+  +----------------+  +--------------------+   |
|                                                                   |
+------------------------------------------------------------------+
            |
            v
+------------------------------------------------------------------+
|                   EXTERNAL INTEGRATIONS                           |
+------------------------------------------------------------------+
|                                                                   |
|  +----------------+  +----------------+  +--------------------+   |
|  |  Supermarket   |  |    Recipe      |  |    Payment         |   |
|  |     APIs       |  |     APIs       |  |   Gateways         |   |
|  | (Mercadona,    |  |  (Spoonacular, |  |   (Stripe,         |   |
|  |  Carrefour...) |  |   Edamam)      |  |    PayPal)         |   |
|  +----------------+  +----------------+  +--------------------+   |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Core Components

### 1. Meal Planning UI

**Responsibilities:**
- Collect user dietary preferences and restrictions
- Display weekly/monthly meal calendar
- Allow meal customization and swapping
- Show nutritional summaries

**Key Features:**
- Multi-step questionnaire wizard
- Drag-and-drop meal scheduling
- Dietary restriction filters (vegan, gluten-free, allergies)
- Serving size adjustment
- Budget constraints

### 2. Recipe Database/Integration

**Responsibilities:**
- Store and index recipes
- Integrate with external recipe APIs
- Parse ingredients into structured data
- Calculate nutritional information

**Data Sources:**
- Primary: Self-hosted recipe database
- Secondary: Spoonacular API (backup/enrichment)
- Tertiary: User-submitted recipes

### 3. Supermarket Scraper Service

**Responsibilities:**
- Scrape product catalogs from target supermarkets
- Handle JavaScript-rendered pages
- Manage rate limiting and anti-bot detection
- Keep product data fresh (scheduled updates)

**Target Supermarkets (Spain):**
- Mercadona
- Carrefour
- Dia
- Alcampo
- Lidl

**Anti-Detection Strategies:**
- Rotating residential proxies
- Human-like interaction patterns
- Request throttling (2-5 second delays)
- Browser fingerprint randomization

### 4. Product Matching Engine

**Responsibilities:**
- Match recipe ingredients to supermarket products
- Handle synonyms and variations (e.g., "tomatoes" = "tomate pera")
- Rank matches by relevance
- Learn from user selections

**Matching Algorithm:**
```
1. Exact match on product name
2. Fuzzy match using pg_trgm (similarity > 0.3)
3. Category-based fallback
4. ML embeddings for semantic matching (future)
```

### 5. Price Comparison Module

**Responsibilities:**
- Compare prices across supermarkets
- Track price history
- Calculate total basket cost
- Identify deals and promotions

**Optimization Strategies:**
- Single-store optimization (minimize total at one store)
- Multi-store optimization (minimize total across stores)
- Availability-weighted scoring

### 6. Grocery List Optimizer

**Responsibilities:**
- Consolidate ingredients across meals
- Suggest quantity adjustments (buy 1kg instead of 800g)
- Group by store section for efficient shopping
- Handle substitutions for out-of-stock items

### 7. Browser Extension

**Responsibilities:**
- Auto-fill shopping carts on supermarket websites
- Handle authentication to supermarket accounts
- Manage checkout flow
- Provide real-time price updates

**Security Considerations:**
- Credentials stored in browser's secure storage
- No credentials transmitted to our servers
- Content scripts isolated per supermarket

### 8. Backend API

**Core Endpoints:**
- `/api/auth/*` - Authentication (NextAuth.js)
- `/api/meals/*` - Meal planning CRUD
- `/api/recipes/*` - Recipe management
- `/api/products/*` - Product search and matching
- `/api/lists/*` - Grocery list management
- `/api/prices/*` - Price comparison
- `/api/extension/*` - Browser extension sync

---

## Data Flow

### Flow 1: Meal Planning to Grocery List

```
User Preferences     Recipe Selection      Ingredient Extraction
      |                    |                       |
      v                    v                       v
+----------+         +----------+           +-------------+
|Questionnaire| ---> |  Meal    | -------> |  Ingredient |
|  Results   |       | Calendar |          |   Parser    |
+----------+         +----------+           +-------------+
                                                   |
                                                   v
                                           +-------------+
                                           |  Normalized |
                                           | Ingredients |
                                           +-------------+
                                                   |
            +--------------------------------------+
            |
            v
+--------------------+     +------------------+     +----------------+
|  Product Matching  | --> | Price Comparison | --> | Optimized List |
+--------------------+     +------------------+     +----------------+
            |                                              |
            v                                              v
+--------------------+                            +----------------+
| User Confirmation  |                            | Browser        |
| (Swap products)    |                            | Extension Cart |
+--------------------+                            +----------------+
```

### Flow 2: Scraper Update Cycle

```
+-------------+     +---------------+     +----------------+
|  Scheduler  | --> |  Playwright   | --> |  Data Parser   |
|  (Cron)     |     |  Scraper Pool |     |  & Validator   |
+-------------+     +---------------+     +----------------+
                                                  |
                                                  v
                          +---------------------------------------+
                          |           PostgreSQL                   |
                          |  +-------------+  +----------------+   |
                          |  |  Products   |  |  Price History |   |
                          |  +-------------+  +----------------+   |
                          +---------------------------------------+
                                                  |
                                                  v
                          +---------------------------------------+
                          |             Redis Cache                |
                          |   (Hot products, recent prices)        |
                          +---------------------------------------+
```

---

## Scalability Considerations

### 1. Caching Strategy

| Data Type | Cache Location | TTL | Invalidation |
|-----------|---------------|-----|--------------|
| Product catalog | Redis | 6 hours | On scrape |
| Prices | Redis | 1 hour | On scrape |
| Recipes | Edge CDN | 24 hours | On update |
| User sessions | Redis | 7 days | On logout |
| Search results | Redis | 15 min | LRU |

### 2. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Public API | 100 | 1 min |
| Authenticated | 1000 | 1 min |
| Scraper (per domain) | 10 | 1 min |
| Extension sync | 60 | 1 min |

### 3. Scraping Architecture

```
                    +------------------+
                    |   Job Scheduler  |
                    |    (BullMQ)      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
        +---------+    +---------+    +---------+
        | Worker 1|    | Worker 2|    | Worker N|
        |Mercadona|    |Carrefour|    |   Dia   |
        +---------+    +---------+    +---------+
              |              |              |
              v              v              v
        +---------+    +---------+    +---------+
        | Proxy 1 |    | Proxy 2 |    | Proxy N |
        +---------+    +---------+    +---------+
```

### 4. Offline Capability

- Service Worker caches:
  - Recipe data
  - Last known product prices
  - Grocery list (IndexedDB)
- Sync queue for offline modifications
- Conflict resolution: Last-write-wins with user notification

### 5. Multi-Supermarket Support

**Plugin Architecture:**
```typescript
interface SupermarketAdapter {
  id: string;
  name: string;
  scrape(): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  addToCart(product: Product, quantity: number): Promise<void>;
  checkout(): Promise<Order>;
}
```

Each supermarket implements this interface, allowing:
- Independent scraping schedules
- Custom anti-detection per site
- Graceful degradation if one fails

---

## Security Architecture

### Authentication Flow

```
+--------+     +--------+     +---------+     +----------+
|  User  | --> | NextAuth| --> | OAuth   | --> | Provider |
|        |     | (JWT)   |     | Handler |     | (Google) |
+--------+     +--------+     +---------+     +----------+
                   |
                   v
              +----------+
              |  Session |
              |  (Redis) |
              +----------+
```

### Data Protection

- Passwords: bcrypt (cost factor 12)
- API tokens: HMAC-SHA256
- Sensitive data: AES-256-GCM encryption at rest
- Supermarket credentials: Browser-only, never server-stored

### Extension Security

- Content Security Policy (strict)
- No remote code execution
- Permissions: Minimal required per supermarket domain
- Communication: Signed messages between content/background scripts

---

## Deployment Architecture

### Production Environment

```
                     +----------------+
                     |   Cloudflare   |
                     |     (CDN)      |
                     +-------+--------+
                             |
                             v
                     +----------------+
                     |   Vercel Edge  |
                     |  (Next.js App) |
                     +-------+--------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
     +----------------+            +----------------+
     |   Neon DB      |            |    Upstash     |
     | (PostgreSQL)   |            |    (Redis)     |
     +----------------+            +----------------+
              |
              v
     +----------------+
     |   Railway      |
     | (Scraper Jobs) |
     +----------------+
```

### Environment Separation

| Environment | Database | Cache | Purpose |
|-------------|----------|-------|---------|
| Development | Local PG | Local Redis | Feature development |
| Staging | Neon (branch) | Upstash (dev) | Integration testing |
| Production | Neon (main) | Upstash (prod) | Live users |

---

## Monitoring & Observability

### Metrics (Prometheus/Grafana)

- API latency (p50, p95, p99)
- Scraper success rate per supermarket
- Cache hit ratio
- Product match accuracy
- Conversion rate (list to purchase)

### Logging (Axiom/Betterstack)

- Structured JSON logs
- Correlation IDs across services
- Scraper error tracking
- User action audit trail

### Alerting

| Condition | Severity | Action |
|-----------|----------|--------|
| API latency > 2s | Warning | Slack notification |
| Scraper failure > 3 consecutive | Critical | PagerDuty |
| Error rate > 5% | Critical | Auto-scale + alert |
| Database connections > 80% | Warning | Slack notification |

---

## Future Considerations

1. **Mobile App**: React Native with shared business logic
2. **ML Recommendations**: Collaborative filtering for meal suggestions
3. **Voice Integration**: Alexa/Google Home skills
4. **Social Features**: Share meal plans, family accounts
5. **Delivery Integration**: Direct API with supermarket delivery services

---

## Decision Log

| Decision | Date | Rationale | Status |
|----------|------|-----------|--------|
| Next.js over Remix | 2024-01 | Larger ecosystem, team familiarity | Approved |
| PostgreSQL over MongoDB | 2024-01 | Relational data, transactions | Approved |
| Playwright over Puppeteer | 2024-01 | Better stealth, multi-browser | Approved |
| Hono over Express | 2024-01 | Performance, edge compatibility | Approved |
| Plasmo for extension | 2024-01 | React DX, MV3 support | Approved |
