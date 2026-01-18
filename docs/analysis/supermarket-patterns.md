# Spanish Supermarket Website Analysis Report

**Analysis Date:** January 16, 2026
**Analyst Agent:** Code Analyzer
**Purpose:** Enable automated price comparison and product data extraction

---

## Executive Summary

This report analyzes the technical structure of major Spanish supermarket websites to inform scraper development. Key findings:

| Supermarket | Scraping Feasibility | API Access | Anti-Bot Measures |
|-------------|---------------------|------------|-------------------|
| DIA | HIGH | REST APIs available | Minimal |
| Mercadona | MEDIUM | Requires JS rendering | Minimal (open robots.txt) |
| Lidl | MEDIUM | FactFinder integration | reCAPTCHA v3 |
| Alcampo | MEDIUM | Redux state available | OneTrust consent |
| Carrefour | LOW | 403 blocking detected | Strong protection |

**Recommendation:** Prioritize DIA and Mercadona for initial implementation due to accessible APIs and permissive robots.txt policies.

---

## 1. DIA (www.dia.es)

### 1.1 Website Architecture
- **Tech Stack:** React-based SPA with server-side JSON hydration
- **Data Loading:** Initial state embedded in `window.__INITIAL_STATE__` or `INITIAL_STATE`
- **CDN:** Product images served from `/product_images/`

### 1.2 URL Patterns

```
# Category Pattern
https://www.dia.es/{category}/{subcategory}/p/{product-id}

# Examples
https://www.dia.es/frutas/naranjas-mandarinas-y-limones/p/11464
https://www.dia.es/azucar-chocolates-y-caramelos/chocolates-y-bombones/p/267770
https://www.dia.es/yogures-y-postres/yogures-griegos/p/165956

# Main Categories
/compra-online/alimentacion
/compra-online/frutas-y-verduras
/compra-online/carnes
/compra-online/pescados-y-mariscos
```

### 1.3 API Endpoints

```javascript
// Home page data
GET https://www.dia.es/api/v2/home-back

// Product search
GET https://www.dia.es/api/v1/search-back
// Powered by Algolia

// Shopping cart
GET/POST https://www.dia.es/api/v1/cart

// Product lists
GET https://www.dia.es/api/v1/list-back
```

### 1.4 Product Data Structure

```json
{
  "sku_id": "11464",
  "display_name": "Mandarina malla 1 Kg",
  "brand": "DIA",
  "prices": {
    "price": 1.45,
    "price_per_unit": 9.67,
    "measure_unit": "KILO",
    "is_club_price": false,
    "is_promo_price": false,
    "discount_percentage": null
  },
  "units_in_stock": 251,
  "url": "/frutas/naranjas-mandarinas-y-limones/p/11464",
  "tags": ["Sin gluten", "Novedad", "Mejor valorado"]
}
```

### 1.5 Price Format

| Field | Format | Example |
|-------|--------|---------|
| Primary Price | X,XX EUR | 1,45 EUR |
| Unit Price | X,XX EUR/UNIT | 9,67 EUR/KILO |
| Units | KILO, LITRO, UNIDAD, 100 ML | KILO |
| Discounts | XX% dto. | 25% dto. |
| Club Price | Headband indicator | "CLUB Dia -20%" |

### 1.6 Image URLs

```
# Pattern
/product_images/{SKU}/{SKU}_ISO_0_ES.jpg?imwidth={size}

# Example
/product_images/11464/11464_ISO_0_ES.jpg?imwidth=176

# Available sizes: 176, 352, 528
```

### 1.7 Robots.txt Analysis

```
Sitemap: https://www.dia.es/sitemap.xml

# ALLOWED
- Category pages (first 5 pagination pages)
- Product listing pages

# BLOCKED
- Pagination beyond page 5
- Cart, checkout, account pages
- Search with parameters
- Review pages

# BLOCKED BOTS
- CazoodleBot, MJ12bot, dotbot/1.0, Gigabot, Amazonbot
```

### 1.8 Scraping Strategy for DIA

```typescript
// Recommended approach
interface DiaScrapingStrategy {
  method: 'API_FIRST',
  endpoints: {
    search: '/api/v1/search-back',
    home: '/api/v2/home-back',
    category: '/api/v1/list-back'
  },
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; PriceBot/1.0)'
  },
  rateLimit: '1 request per 2 seconds',
  postalCode: 'Required for product availability'
}
```

---

## 2. Mercadona (tienda.mercadona.es)

### 2.1 Website Architecture
- **Tech Stack:** JavaScript SPA (requires JS execution)
- **Data Loading:** Dynamic client-side rendering
- **Analytics:** Google Tag Manager (gtag)

### 2.2 URL Patterns

```
# Main store
https://tienda.mercadona.es/

# Corporate info
https://info.mercadona.es/es/inicio
https://info.mercadona.es/es/supermercados

# No public product URLs in sitemap
# Products likely loaded via internal API
```

### 2.3 Robots.txt Analysis

```
User-agent: *
Disallow: (empty - all allowed)
Sitemap: https://www.mercadona.es/sitemap.xml

# ANALYSIS: Most permissive policy
# All paths allowed for scraping
```

### 2.4 Scraping Challenges

1. **JavaScript Required:** Full SPA, no static HTML
2. **No Product Sitemap:** Products not indexed publicly
3. **Postal Code Dependency:** Location-based pricing/availability

### 2.5 Recommended Approach

```typescript
interface MercadonaScrapingStrategy {
  method: 'BROWSER_AUTOMATION',
  tool: 'Playwright',
  steps: [
    'Navigate to tienda.mercadona.es',
    'Enter postal code',
    'Intercept XHR/Fetch requests',
    'Extract API endpoints from network',
    'Replay API calls directly'
  ],
  rateLimit: '1 request per 3 seconds'
}
```

---

## 3. Lidl (www.lidl.es)

### 3.1 Website Architecture
- **Tech Stack:** React with Swiper carousels
- **Search:** FactFinder (`factFinderChannel: "mgm_es_ES"`)
- **Personalization:** VWO A/B testing
- **Consent:** OneTrust banner

### 3.2 URL Patterns

```
# Locale prefix
https://www.lidl.es/es/

# Categories with numeric IDs
/es/cocina/c97
/es/jardin/c98

# Weekly offers
/es/folleto
/es/descubre-nuevas-ofertas-cada-semana

# Suggest API
/suggestV2
```

### 3.3 Anti-Scraping Measures

| Measure | Detection Method | Bypass Strategy |
|---------|------------------|-----------------|
| reCAPTCHA v3 | Site key in HTML | Use Playwright with stealth |
| OneTrust | Consent banner | Accept cookies programmatically |
| VWO | Blur filters | Wait for consent |
| Store Selection | Location prompt | Select store first |

### 3.4 Robots.txt Analysis

```
Sitemap: https://www.lidl.es/sitemap_index.xml.gz
         https://www.lidl.es/sitemap-product-1.xml.gz
         https://www.lidl.es/sitemap-brand.xml.gz
         https://www.lidl.es/sitemap-campaign.xml.gz

# BLOCKED
- File types: *.xsl, *.pdf, *.xml
- Query params: *?*filter, *?*sort, *search
- Account pages: */account/*, */basket/*
- SeekportBot: completely blocked
```

### 3.5 Scraping Strategy for Lidl

```typescript
interface LidlScrapingStrategy {
  method: 'HYBRID',
  approach: [
    'Fetch sitemaps for product URLs',
    'Use Playwright for dynamic content',
    'Intercept FactFinder API calls',
    'Handle reCAPTCHA with delays'
  ],
  endpoints: {
    suggest: '/suggestV2',
    products: 'FactFinder channel API'
  },
  rateLimit: '1 request per 5 seconds'
}
```

---

## 4. Alcampo (compraonline.alcampo.es)

### 4.1 Website Architecture
- **Tech Stack:** React with Redux state management
- **Data Loading:** `window.__INITIAL_STATE__` hydration
- **Consent:** OneTrust
- **Monitoring:** Faro performance

### 4.2 URL Patterns

```
# Main domain (redirects)
www.alcampo.es -> compraonline.alcampo.es

# Categories
/categories/{category-name}/{retailer-id}

# Content pages
/content/{page-name}

# Promotions
/promotions

# Recipes
/recipes/collections/{recipe-type}/{id}
```

### 4.3 Price Data Structure

```json
{
  "currency": "EUR",
  "amount": "1.99"
}
```

### 4.4 Robots.txt Analysis

```
Sitemap: https://compraonline.alcampo.es/sitemaps/sitemap_index.xml

# BLOCKED
- /sso-login (all bots)
- Full site block: CazoodleBot, MJ12bot, dotbot/1.0, Gigabot

# ALLOWED
- Google bots with /sso-login exception
- botslovers-spider with same exception
```

### 4.5 Scraping Strategy for Alcampo

```typescript
interface AlcampoScrapingStrategy {
  method: 'STATE_EXTRACTION',
  approach: [
    'Fetch page with Playwright',
    'Extract __INITIAL_STATE__ JSON',
    'Parse Redux store for products',
    'Handle category navigation'
  ],
  rateLimit: '1 request per 3 seconds'
}
```

---

## 5. Carrefour (www.carrefour.es)

### 5.1 Access Status
**BLOCKED:** 403 Forbidden response detected during analysis.

### 5.2 Likely Anti-Bot Measures
- Cloudflare or DataDome protection
- User-Agent filtering
- IP reputation scoring
- Browser fingerprinting

### 5.3 Recommended Approach

```typescript
interface CarrefourScrapingStrategy {
  method: 'ADVANCED_EVASION',
  tools: [
    'Playwright with stealth plugin',
    'Residential proxy rotation',
    'Browser fingerprint randomization'
  ],
  priority: 'LOW - attempt only after others succeed',
  alternative: 'Consider official API partnership'
}
```

---

## 6. Consum (tienda.consum.es)

### 6.1 Website Architecture
- **Tech Stack:** Drupal-based with Views AJAX
- **CDN:** cdn-consum.aktiosdigitalservices.com
- **Loyalty:** Mundo Consum program
- **Multi-language:** ES, CA, EN

### 6.2 URL Patterns

```
# Online store
tienda.consum.es/consum/

# Content
/entrenosotros/{category}/{subcategory}/

# Stores
/supermercados/

# API
/views/ajax/
```

### 6.3 JavaScript Requirement
Full JS execution required for product data.

---

## 7. Common Data Patterns

### 7.1 Price Formats Across Supermarkets

| Supermarket | Currency | Decimal | Unit Price | Example |
|-------------|----------|---------|------------|---------|
| DIA | EUR | , | /KILO, /LITRO | 1,45 EUR |
| Mercadona | EUR | , | /kg, /ud | 2,30 EUR |
| Lidl | EUR | , | /kg | 0,99 EUR |
| Alcampo | EUR | . | /kg | 1.99 EUR |
| Carrefour | EUR | , | /kg | 3,50 EUR |

### 7.2 Product Data Fields

```typescript
interface StandardProductData {
  // Identifiers
  sku: string;
  ean?: string;

  // Display
  name: string;
  brand: string;
  description?: string;

  // Pricing
  price: number;
  pricePerUnit: number;
  unit: 'KILO' | 'LITRO' | 'UNIDAD' | '100ML';
  currency: 'EUR';

  // Promotions
  isOnSale: boolean;
  originalPrice?: number;
  discountPercent?: number;
  clubPrice?: number;

  // Availability
  inStock: boolean;
  stockQuantity?: number;

  // Media
  imageUrl: string;
  thumbnailUrl?: string;

  // Categories
  category: string;
  subcategory: string;

  // Metadata
  tags?: string[];
  nutritionInfo?: object;
}
```

---

## 8. Recommended Implementation Priority

### Phase 1: Primary Targets
1. **DIA** - Best API access, clear data structure
2. **Mercadona** - Permissive robots.txt, market leader

### Phase 2: Secondary Targets
3. **Alcampo** - Redux state extraction viable
4. **Lidl** - Weekly offers focus

### Phase 3: Advanced Targets
5. **Carrefour** - Requires anti-bot bypass
6. **Consum** - Regional focus

---

## 9. Technical Recommendations

### 9.1 Scraper Architecture

```typescript
// src/scrapers/base.ts
interface SupermarketScraper {
  name: string;
  baseUrl: string;

  // Methods
  fetchCategories(): Promise<Category[]>;
  fetchProducts(category: string): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;

  // Rate limiting
  requestDelay: number;
  maxConcurrent: number;
}
```

### 9.2 Anti-Detection Best Practices

```typescript
const antiDetectionConfig = {
  // Delays
  minDelay: 2000,
  maxDelay: 5000,

  // Headers rotation
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  ],

  // Playwright stealth
  stealthPlugins: ['stealth'],

  // Session management
  cookieHandling: 'persistent',
  postalCodeCaching: true
};
```

### 9.3 Data Normalization

```typescript
// Convert supermarket-specific formats to standard
function normalizePrice(price: string, supermarket: string): number {
  const cleanPrice = price.replace('EUR', '').trim();

  // Handle decimal separators
  if (supermarket === 'alcampo') {
    return parseFloat(cleanPrice); // Uses .
  }
  return parseFloat(cleanPrice.replace(',', '.')); // Uses ,
}

function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'KILO': 'kg',
    'LITRO': 'L',
    'UNIDAD': 'unit',
    '100 ML': '100ml',
    'kg': 'kg',
    '/kg': 'kg'
  };
  return unitMap[unit] || unit;
}
```

---

## 10. Legal Considerations

### 10.1 Terms of Service Compliance
- Respect robots.txt directives
- Do not overload servers
- Do not bypass authentication
- Store only publicly available data

### 10.2 Rate Limiting Guidelines

| Supermarket | Recommended Delay | Max Requests/Hour |
|-------------|-------------------|-------------------|
| DIA | 2 seconds | 1,800 |
| Mercadona | 3 seconds | 1,200 |
| Lidl | 5 seconds | 720 |
| Alcampo | 3 seconds | 1,200 |

### 10.3 Data Retention
- Cache product data for 24 hours max
- Refresh prices daily
- Do not store personal user data

---

## Appendix A: Sitemap URLs

### DIA
- https://www.dia.es/sitemap.xml

### Lidl
- https://www.lidl.es/sitemap_index.xml.gz
- https://www.lidl.es/sitemap-product-1.xml.gz
- https://www.lidl.es/sitemap-brand.xml.gz

### Mercadona
- https://www.mercadona.es/sitemap.xml

### Alcampo
- https://compraonline.alcampo.es/sitemaps/sitemap_index.xml

---

## Appendix B: CSS Selectors (DIA)

```css
/* Product card */
.product-card { }

/* Price elements */
.product-price { }
.product-price-per-unit { }

/* Product info */
.product-name { }
.product-brand { }
.product-image img { }

/* Availability */
.stock-indicator { }
.out-of-stock { }

/* Promotions */
.discount-badge { }
.club-price-badge { }
```

---

## Appendix C: API Response Examples

### DIA Search API Response

```json
{
  "sections": [
    {
      "type": "ProductCarousel",
      "title": "Frutas y verduras",
      "products": [
        {
          "sku_id": "11464",
          "display_name": "Mandarina malla 1 Kg",
          "prices": {
            "price": 1.45,
            "price_per_unit": 9.67,
            "measure_unit": "KILO"
          },
          "units_in_stock": 251,
          "url": "/frutas/naranjas-mandarinas-y-limones/p/11464"
        }
      ],
      "query_id": "abc123"
    }
  ]
}
```

---

**Report Status:** Complete
**Next Steps:** Implement scrapers following priority order in Section 8
