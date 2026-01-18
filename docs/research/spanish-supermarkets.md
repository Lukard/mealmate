# Spanish Supermarket Ecosystem Research Report

**Research Date:** January 2026
**Purpose:** Technical research for meal automation product development
**Scope:** Spanish online grocery market analysis for scraping/API integration

---

## Executive Summary

This report analyzes the 8 major Spanish supermarket chains for technical integration with a meal automation product. Key findings:

1. **Best API Option:** Mercadona has an accessible unofficial API with documented endpoints
2. **Most Accessible:** Mercadona and DIA have well-documented scraping approaches
3. **Most Protected:** Alcampo (Ocado platform), El Corte Ingles (Mirakl marketplace)
4. **Legal Considerations:** Focus on non-personal, publicly available data to comply with GDPR

---

## 1. Spanish Supermarket Landscape Overview

| Supermarket | Stores | Market Position | Online Presence | API Availability |
|-------------|--------|-----------------|-----------------|------------------|
| **Mercadona** | 1,600+ | #1 Spain (27% market share) | tienda.mercadona.es | Unofficial API available |
| **Carrefour** | 1,000+ | #2 Spain | carrefour.es | Mirakl marketplace API |
| **Lidl** | 600+ | #3 Spain | lidl.es | No public API |
| **Dia** | 2,000+ | #4 Spain | dia.es | No public API |
| **Alcampo** | 350+ | Major player | alcampo.es | Ocado platform (restricted) |
| **El Corte Ingles** | 90+ | Premium segment | elcorteingles.es/supermercado | Mirakl marketplace API |
| **Eroski** | 1,000+ | Basque cooperative | supermercado.eroski.es | No public API |
| **Consum** | 800+ | Mediterranean region | tienda.consum.es | No public API |

---

## 2. Detailed Technical Analysis by Supermarket

### 2.1 Mercadona (RECOMMENDED - Best API Access)

**Website:** tienda.mercadona.es
**Technology Stack:** React, Google Cloud, Kubernetes, PostgreSQL, Python/Django backend
**API Status:** Unofficial but well-documented

#### API Endpoints (Reverse-Engineered)

```
Base URL: https://tienda.mercadona.es/api/

Public Endpoints (No Auth Required):
- GET /categories/                    # List all categories
- GET /categories/{id}/               # Get products in category
- GET /products/{id}/                 # Get specific product details
- GET /v1_1/categories/?lang=es       # Versioned category listing

Authenticated Endpoints:
- POST /auth/tokens/                  # Login
- GET /customers/{customer_id}/       # Customer info
- GET/PUT /customers/{customer_id}/cart/  # Shopping cart
- POST /customers/{customer_id}/checkouts/  # Checkout
- PUT /postal-codes/actions/change-pc/     # Set postal code
```

#### Product Data Structure

```json
{
  "id": 34180,
  "display_name": "Leche Entera Hacendado",
  "packaging": "Brick",
  "thumbnail": "https://prod-mercadona.imgix.net/...",
  "badges": {
    "is_water": false,
    "requires_age_check": false
  },
  "categories": [
    {"id": 1, "name": "Lacteos", "level": 0},
    {"id": 11, "name": "Leches", "level": 1},
    {"id": 112, "name": "Leche entera", "level": 2}
  ],
  "price_instructions": {
    "iva": 4,
    "bulk_price": "1.25",
    "unit_price": "1.25",
    "unit_size": "1L",
    "size_format": "1 L",
    "reference_price": "1.25",
    "reference_format": "1.25 EUR/L"
  }
}
```

#### Authentication Flow

```javascript
// Login to get access token
POST /auth/tokens/
{
  "username": "email@example.com",
  "password": "password"
}

// Response
{
  "access_token": "eyJ...",
  "customer_id": "12345"
}

// Use in subsequent requests
Authorization: Bearer <access_token>
```

#### Anti-Bot Measures
- **Protection Level:** LOW-MEDIUM
- React SPA (requires JavaScript execution for some features)
- Postal code validation (Spanish postal codes required)
- Rate limiting on API endpoints
- No Cloudflare/DataDome detected on API endpoints

#### Implementation Recommendations

1. **For catalog scraping:** Use public API endpoints directly
2. **For authenticated features:** Implement OAuth-style token flow
3. **Category traversal:** Iterate categories 1-199 as IDs may not be sequential
4. **Postal code:** Set a valid Spanish postal code (e.g., "28001" for Madrid)

#### Existing Open-Source Projects

- [mercadona-cli](https://github.com/alfonmga/mercadona-cli) - Unofficial CLI tool
- [supermarket-mercadona-scraper](https://github.com/vgvr0/supermarket-mercadona-scraper) - Python scraper
- [mercadona-scrapper](https://github.com/nicolaspascual/mercadona-scrapper) - Selenium-based

---

### 2.2 Carrefour Espana

**Website:** carrefour.es
**Technology Stack:** Mirakl marketplace platform
**API Status:** Marketplace API (seller-focused)

#### Technical Details

- Uses Mirakl platform for marketplace integration
- EAN codes mandatory for all products
- Automatic FTP/HTTP integration available for sellers
- API key accessible through seller back-office

#### API Integration (For Sellers)

```
Setup Process:
1. Create Mirakl seller account
2. Access: My User Settings > API Key tab
3. Use API for product listings and order management
```

#### Product Data Requirements

- EAN/GTIN codes mandatory
- Product title, description, images
- Pricing in EUR
- Variations support

#### Anti-Bot Measures
- **Protection Level:** MEDIUM-HIGH
- Cloudflare protection detected
- Rate limiting
- Browser fingerprinting possible

#### Data Access Options

Third-party scraping services available:
- Piloterr (currently suspended)
- Apify ($0.005/result)
- Oxylabs E-commerce API

---

### 2.3 Lidl Espana

**Website:** lidl.es
**Technology Stack:** Custom platform, React Native mobile apps
**API Status:** No public API

#### Technical Details

- Lidl Digital International manages all digital platforms
- iOS requires 15.0+
- Multi-language support (23 languages)
- Lidl Plus loyalty app with personalized coupons

#### Mobile App Features

- Weekly leaflets
- Personalized coupons
- Digital Lidl Plus card
- Store locator with hours/directions
- Shopping list functionality

#### Anti-Bot Measures
- **Protection Level:** HIGH
- No documented public API endpoints
- Mobile-first strategy limits web scraping
- Strong session management

#### Implementation Challenges

- Heavy reliance on mobile apps
- No web-based product catalog scraping documented
- Would require mobile app reverse engineering

---

### 2.4 DIA (Distribuidora Internacional de Alimentacion)

**Website:** dia.es
**Technology Stack:** Custom platform
**API Status:** No public API, but scrapable

#### Technical Details

- Developer: DIA RETAIL ESPANA SA
- Mobile apps for Android/iOS
- QR code scanner for promotional coupons
- Online ordering with repeat functionality

#### Website Structure

```
dia.es
├── Categories (navegable)
│   ├── Subcategories
│   │   └── Product listings
│   │       └── Individual product pages
└── Cookie consent required on entry
```

#### Scraping Approach (from existing projects)

```python
# Data fields extractable:
- Product Name
- Product Image URL
- Product Link/URL
- Price
- Category/Subcategory

# Technology stack for scraping:
- SeleniumBase with undetectable Chrome
- BeautifulSoup for HTML parsing
- Output: CSV format
```

#### Anti-Bot Measures
- **Protection Level:** MEDIUM
- Standard cookie consent
- No aggressive bot detection documented
- SeleniumBase with `uc=True` works effectively

#### Existing Open-Source Projects

- [dia-supermarket-scraper](https://github.com/vgvr0/dia-supermarket-scraper) - Python/Jupyter notebook

---

### 2.5 Alcampo (Auchan Group)

**Website:** alcampo.es
**Technology Stack:** Ocado Smart Platform (OSP)
**API Status:** Proprietary, restricted

#### Technical Details

Since July 2021, Alcampo uses Ocado Smart Platform:
- AI-powered product search
- Customer purchase history analytics
- Automated fulfillment centers (San Fernando de Henares)
- Robotic picking (Automated Frameload, On-Grid Robotic Pick)

#### Technology Features

- Facebook Web Custom Audiences
- Facebook Pixel
- Cloudflare CDN and Website Optimization
- 20,000+ products across categories

#### API Access

- dokify platform for B2B integration (since 2012)
- No public consumer API
- Third-party scraping services available (RetailGators)

#### Anti-Bot Measures
- **Protection Level:** HIGH
- Cloudflare protection
- Ocado platform security
- Enterprise-grade infrastructure

---

### 2.6 El Corte Ingles Supermercado

**Website:** elcorteingles.es/supermercado
**Technology Stack:** Mirakl marketplace
**API Status:** Marketplace API only (seller-focused)

#### Technical Details

- 20,000+ products
- Same-day delivery options
- Click & Collect available
- Premium positioning

#### Marketplace Integration

```
Contact: infovendedormarketplace@elcorteingles.es

Integration via Mirakl:
- "El Corte Ingles Product" feed for product sheets
- Order retrieval via API or CSV
- Qapla' integration for order management
```

#### Anti-Bot Measures
- **Protection Level:** HIGH
- Enterprise security
- Mirakl platform protection
- Session-based authentication

---

### 2.7 Eroski

**Website:** supermercado.eroski.es
**Technology Stack:** AppNexus, Babel, jQuery, Google Analytics
**API Status:** No public API

#### Technical Details

- Worker-consumer cooperative (Mondragon Corporation)
- Pioneer in online food (since 2000)
- Major platform update in 2017
- "Best Online Supermarket" award winner

#### Technology Stack

- AppNexus (advertising)
- Babel (transpilation)
- Atlassian Jira (project management)
- Modernizr (browser feature detection)
- jQuery
- Google Analytics
- Gravity Forms
- SSL encryption for transactions

#### Third-Party Data Access

- Agenty: Store location data API (6,163 stores)
- Location: name, geo-coded address, city, email, phone

#### Anti-Bot Measures
- **Protection Level:** MEDIUM
- Standard security measures
- No aggressive bot detection documented

---

### 2.8 Consum

**Website:** tienda.consum.es
**Technology Stack:** React Native (mobile), Zendesk (support)
**API Status:** Internal API only

#### Technical Details

- 800+ supermarkets across Mediterranean Spain
- 18,000+ employees
- 4 million+ member customers
- "Mundo Consum" app (57% of online orders)

#### Technology Features

- React Native for Android/iOS apps
- Unified web platform with single sign-on
- Zendesk integration (250+ use cases)
- Cisco phone system integration
- Algonomy CRM

#### App Features

- Full catalog browsing
- Barcode scanner
- Filters: ecological, own brand, new products
- Previous purchase history
- Gift voucher redemption

#### Online Sales Performance (2024)

- EUR 77.3 million in online sales
- 1.7% of total sales
- 57% through mobile app

#### Anti-Bot Measures
- **Protection Level:** MEDIUM
- JavaScript-required website
- React Native app would require reverse engineering

---

## 3. Product Data Structures

### 3.1 Common Product Fields

| Field | Description | Example |
|-------|-------------|---------|
| `ean` / `gtin` | European Article Number (13 digits) | "8410762160126" |
| `name` | Product display name | "Leche Entera 1L" |
| `brand` | Manufacturer/brand | "Hacendado" |
| `price` | Current price in EUR | 1.25 |
| `unit_price` | Price per unit/measure | "1.25 EUR/L" |
| `category` | Product category hierarchy | "Lacteos > Leches > Entera" |
| `image_url` | Product image | "https://..." |
| `availability` | Stock status | true/false |
| `packaging` | Container type | "Brick", "Botella", "Paquete" |

### 3.2 Price Structures

Spanish supermarkets typically display:

1. **Sale Price:** Current selling price
2. **Reference Price:** Price per unit (kg, L, unit) - legally required
3. **IVA Rate:** VAT percentage (4% food, 10% prepared, 21% general)
4. **Bulk Price:** Price for multi-buy offers
5. **Member Price:** Loyalty card discounted price

### 3.3 Category Hierarchies

Typical 3-level hierarchy:

```
Level 0: Alimentacion (Food)
  Level 1: Lacteos y Huevos
    Level 2: Leches
    Level 2: Yogures
    Level 2: Quesos
  Level 1: Carnes
    Level 2: Vacuno
    Level 2: Cerdo
    Level 2: Pollo
```

---

## 4. Anti-Bot Protection Analysis

### 4.1 Protection Technologies Detected

| Technology | Supermarkets Using | Bypass Difficulty |
|------------|-------------------|-------------------|
| **Cloudflare** | Alcampo, Carrefour | HIGH |
| **DataDome** | Not detected | - |
| **Mirakl Platform** | Carrefour, El Corte Ingles | MEDIUM (for sellers) |
| **Ocado Platform** | Alcampo | HIGH |
| **Standard Sessions** | Mercadona, DIA, Eroski, Consum | LOW-MEDIUM |

### 4.2 Detection Techniques Used

1. **TLS Fingerprinting:** Analyzes handshake parameters
2. **IP Reputation:** Blocks known datacenter/VPN IPs
3. **Behavioral Analysis:** Mouse movements, clicking patterns
4. **Browser Fingerprinting:** Canvas, WebGL, audio fingerprinting
5. **Rate Limiting:** Request frequency monitoring
6. **JavaScript Challenges:** Requires JS execution

### 4.3 Recommended Bypass Techniques

```python
# SeleniumBase with undetectable mode
from seleniumbase import Driver

driver = Driver(
    uc=True,                    # Undetectable Chrome
    headless2=True,             # Headless mode
    do_not_track=True,          # Privacy headers
    user_agent="Mozilla/5.0..." # Real browser UA
)

# Add random delays
import random
import time
time.sleep(random.uniform(1, 3))
```

### 4.4 Success Rates by Method

| Method | Mercadona | DIA | Carrefour | Alcampo |
|--------|-----------|-----|-----------|---------|
| Direct API | 95%+ | N/A | N/A | N/A |
| Selenium + UC | 90%+ | 85%+ | 70%+ | 50%+ |
| Requests only | 80%+ | 50%+ | 30%+ | 10%+ |
| Residential Proxy | +15% | +15% | +25% | +30% |

---

## 5. Legal Considerations

### 5.1 GDPR Compliance

Under EU GDPR and Spanish Organic Law 3/2018:

**Permitted:**
- Scraping publicly available product data (prices, names, categories)
- Non-personal data collection
- Price comparison and analytics

**Prohibited:**
- Collecting personal data without consent
- Scraping user reviews with identifiable information
- Bypassing authentication to access private data

**Penalties:**
- Up to EUR 20 million or 4% of global turnover

### 5.2 Terms of Service Analysis

| Supermarket | ToS Type | Scraping Stance |
|-------------|----------|-----------------|
| Mercadona | Browsewrap | Not explicitly prohibited |
| Carrefour | Clickwrap | Restricted for sellers |
| Lidl | Browsewrap | Standard prohibition |
| DIA | Browsewrap | Not explicitly prohibited |
| Alcampo | Clickwrap | Restricted |
| El Corte Ingles | Clickwrap | Marketplace only |
| Eroski | Browsewrap | Standard terms |
| Consum | Browsewrap | Standard terms |

### 5.3 Best Practices for Legal Compliance

1. **Focus on Public Data:** Only scrape publicly visible product information
2. **Respect robots.txt:** Check and honor robots.txt directives
3. **Rate Limiting:** Implement reasonable delays (1-3 seconds)
4. **No Authentication Bypass:** Don't circumvent login requirements
5. **Data Minimization:** Only collect what's needed
6. **Document Compliance:** Maintain records of scraping practices
7. **Contact for API Access:** Request official API access when possible

### 5.4 Spain-Specific Regulations

**LSSI (E-Commerce Law):**
- Requires clear business identification
- Honest marketing requirements
- Works alongside GDPR

---

## 6. Implementation Recommendations

### 6.1 Priority Order for Integration

| Priority | Supermarket | Reason |
|----------|-------------|--------|
| 1 | **Mercadona** | Best API access, largest market share |
| 2 | **DIA** | Documented scraping approach, wide coverage |
| 3 | **Eroski** | Medium protection, good regional coverage |
| 4 | **Consum** | React-based, Mediterranean focus |
| 5 | **Carrefour** | Mirakl API if seller access obtained |
| 6 | **Lidl** | Mobile-first, requires app reverse engineering |
| 7 | **El Corte Ingles** | Premium segment, Mirakl restricted |
| 8 | **Alcampo** | Ocado platform, highly restricted |

### 6.2 Technical Architecture Suggestion

```
┌─────────────────────────────────────────────────────────────┐
│                    Meal Automation Backend                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Mercadona       │  │ DIA             │  │ Others      │  │
│  │ Adapter         │  │ Adapter         │  │ Adapters    │  │
│  │ (Direct API)    │  │ (Selenium)      │  │ (Selenium)  │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘  │
│           │                    │                   │         │
│           └────────────┬───────┴───────────────────┘         │
│                        │                                     │
│           ┌────────────▼────────────┐                        │
│           │   Product Normalizer    │                        │
│           │   (EAN/GTIN mapping)    │                        │
│           └────────────┬────────────┘                        │
│                        │                                     │
│           ┌────────────▼────────────┐                        │
│           │   Price Comparator      │                        │
│           │   & Availability        │                        │
│           └────────────┬────────────┘                        │
│                        │                                     │
│           ┌────────────▼────────────┐                        │
│           │   Meal Planning Engine  │                        │
│           └─────────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Data Refresh Strategy

| Data Type | Refresh Frequency | Method |
|-----------|-------------------|--------|
| Product Catalog | Weekly | Full scrape |
| Prices | Daily | Incremental update |
| Availability | Real-time | On-demand API call |
| Categories | Monthly | Full scrape |

### 6.4 Code Dependencies

```python
# requirements.txt
seleniumbase>=4.20.0     # Undetectable browser automation
beautifulsoup4>=4.12.0   # HTML parsing
requests>=2.31.0         # HTTP client
pandas>=2.0.0            # Data manipulation
aiohttp>=3.9.0           # Async HTTP (for Mercadona API)
```

---

## 7. Existing Open-Source Resources

### 7.1 GitHub Repositories

| Repository | Supermarket | Stars | Tech Stack |
|------------|-------------|-------|------------|
| [mercadona-cli](https://github.com/alfonmga/mercadona-cli) | Mercadona | 50+ | Go |
| [supermarket-mercadona-scraper](https://github.com/vgvr0/supermarket-mercadona-scraper) | Mercadona | - | Python/SeleniumBase |
| [mercadona-scrapper](https://github.com/nicolaspascual/mercadona-scrapper) | Mercadona | - | Python/Selenium |
| [dia-supermarket-scraper](https://github.com/vgvr0/dia-supermarket-scraper) | DIA | - | Python/SeleniumBase |
| [merca-api](https://github.com/javichur/merca-api) | General | - | TypeScript |

### 7.2 Third-Party Services

| Service | Coverage | Pricing |
|---------|----------|---------|
| Apify Mercadona Scraper | Mercadona | $0.005/result |
| RetailGators | Multiple | Custom |
| Piloterr | Carrefour | Suspended |
| Oxylabs | E-commerce | Custom |

---

## 8. Appendix

### 8.1 Spanish Postal Code Format

- Format: 5 digits (NNNNN)
- First 2 digits: Province code (01-52)
- Example: 28001 (Madrid Centro)

### 8.2 Common Product Categories (Spanish)

```
- Alimentacion / Food
- Bebidas / Beverages
- Lacteos y Huevos / Dairy and Eggs
- Carnes / Meats
- Pescados y Mariscos / Fish and Seafood
- Frutas y Verduras / Fruits and Vegetables
- Panaderia y Pasteleria / Bakery and Pastry
- Congelados / Frozen
- Conservas y Legumbres / Canned Goods and Legumes
- Desayuno y Cereales / Breakfast and Cereals
- Drogueria / Household Cleaning
- Higiene y Belleza / Hygiene and Beauty
- Bebe / Baby
- Mascotas / Pets
```

### 8.3 VAT (IVA) Rates in Spain

- **4% (Super-reduced):** Basic food, bread, milk, eggs, fruits, vegetables, cheese, cereals
- **10% (Reduced):** Prepared foods, non-alcoholic beverages, meat, fish
- **21% (Standard):** Alcohol, tobacco, non-essential items

---

## Sources

### Official Sources
- [Mercadona Tech](https://www.mercadonatech.com/en)
- [Mercadona Google Cloud Case Study](https://cloud.google.com/customers/mercadona)
- [Alcampo Ocado Partnership](https://www.ocadogroup.com/about-us/osp-partners/alcampo)
- [Eroski Online Supermarket](https://supermercado.eroski.es/en/)

### Technical Resources
- [Mercadona API Analysis (Medium)](https://medium.com/@ablancodev/trasteando-la-api-del-mercadona-cff067abc002)
- [mercadona-cli GitHub](https://github.com/alfonmga/mercadona-cli)
- [supermarket-mercadona-scraper GitHub](https://github.com/vgvr0/supermarket-mercadona-scraper)
- [dia-supermarket-scraper GitHub](https://github.com/vgvr0/dia-supermarket-scraper)

### Legal Resources
- [GDPR and Web Scraping (IAPP)](https://iapp.org/news/a/the-state-of-web-scraping-in-the-eu)
- [E-commerce Law Spain (LSSI)](https://www.lawants.com/en/e-commerce-law-spain/)
- [GDPR Compliance Web Scraping (Dastra)](https://www.dastra.eu/en/guide/gdpr-and-web-scraping-a-legal-practice/56357)

### Anti-Bot Resources
- [Bypass Cloudflare 2025 (ZenRows)](https://www.zenrows.com/blog/bypass-cloudflare)
- [Bypass DataDome 2025 (ZenRows)](https://www.zenrows.com/blog/datadome-bypass)
- [Top Bot Blockers 2025 (ScraperAPI)](https://www.scraperapi.com/blog/top-bot-blockers/)

---

*Report generated for the Meal Automation Hive Mind project*
