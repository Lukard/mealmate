# Meal Automation Product - Test Cases

## Table of Contents

1. [Meal Planning Module](#1-meal-planning-module)
2. [Product Scraping Module](#2-product-scraping-module)
3. [Grocery List Generation](#3-grocery-list-generation)
4. [Price Comparison Engine](#4-price-comparison-engine)
5. [Browser Extension](#5-browser-extension)
6. [API Endpoints](#6-api-endpoints)
7. [Edge Cases and Error Handling](#7-edge-cases-and-error-handling)

---

## 1. Meal Planning Module

### 1.1 User Questionnaire

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| MP-001 | Accept valid dietary preferences | `{ diet: 'vegetarian', allergies: ['nuts'] }` | Preferences saved successfully | High |
| MP-002 | Reject invalid calorie target | `{ calories: -500 }` | Validation error: calories must be positive | High |
| MP-003 | Handle multiple dietary restrictions | `{ diet: 'vegan', allergies: ['soy', 'gluten'], intolerance: ['lactose'] }` | All restrictions combined correctly | High |
| MP-004 | Default values for optional fields | `{ diet: 'standard' }` | Uses default calories (2000), no restrictions | Medium |
| MP-005 | Validate meal count per day | `{ mealsPerDay: 6 }` | Accepts 1-6 meals per day | Medium |
| MP-006 | Reject invalid meal count | `{ mealsPerDay: 10 }` | Validation error: max 6 meals | Low |

### 1.2 Meal Plan Generation

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| MP-010 | Generate 7-day standard plan | Standard user profile | 7 days with 3 meals each, meets nutrition targets | Critical |
| MP-011 | Respect vegetarian diet | Vegetarian user profile | No meat products in any meal | Critical |
| MP-012 | Respect vegan diet | Vegan user profile | No animal products in any meal | Critical |
| MP-013 | Respect allergies | User with nut allergy | No recipes containing nuts | Critical |
| MP-014 | Meet calorie target +/-10% | `{ targetCalories: 1800 }` | Daily average between 1620-1980 | High |
| MP-015 | Balance macronutrients | Standard profile | Protein 20-30%, Carbs 45-55%, Fat 25-35% | High |
| MP-016 | Avoid repetition | 7-day plan | No recipe repeated within 3 days | Medium |
| MP-017 | Consider cooking skill | `{ cookingSkill: 'beginner' }` | Only simple recipes (< 30min, < 5 ingredients) | Medium |
| MP-018 | Budget-conscious planning | `{ budget: 'low' }` | Prioritizes affordable ingredients | Medium |
| MP-019 | Seasonal ingredients | Summer period | Prioritizes seasonal produce | Low |

### 1.3 Nutrition Calculation

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| MP-020 | Calculate meal macros | Single meal | Accurate protein, carbs, fat values | High |
| MP-021 | Handle missing nutrition data | Recipe with incomplete data | Uses estimates, flags incomplete | High |
| MP-022 | Calculate daily totals | Full day meals | Sum matches individual meals | High |
| MP-023 | Calculate weekly averages | 7-day plan | Correct average calculations | Medium |

---

## 2. Product Scraping Module

### 2.1 Mercadona Scraper

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| SC-001 | Scrape product search results | Search: "leche" | List of milk products with name, price, unit | Critical |
| SC-002 | Extract product details | Product URL | Full details: name, price, unit, nutrition, image | Critical |
| SC-003 | Handle pagination | Search with 100+ results | All results across pages | High |
| SC-004 | Parse price formats | "2,49 EUR", "2.49 EUR" | Numeric value 2.49 | High |
| SC-005 | Extract unit price | "3,50 EUR/kg" | Unit price 3.50, unit "kg" | High |
| SC-006 | Handle promotions | "2x1 offer" | Original price, offer price, promotion type | High |
| SC-007 | Handle product unavailable | Out of stock product | Status: unavailable, alternatives suggested | Medium |
| SC-008 | Respect rate limits | Rapid consecutive requests | Proper delay between requests | Medium |
| SC-009 | Handle network errors | Timeout/connection error | Retry with backoff, then error | Medium |
| SC-010 | Handle changed page structure | Modified HTML | Detection alert, graceful degradation | Medium |

### 2.2 Carrefour Scraper

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| SC-020 | Scrape search results | Search: "pan" | List of bread products | Critical |
| SC-021 | Extract product details | Product URL | Full product information | Critical |
| SC-022 | Handle dynamic loading | JavaScript-rendered content | Content correctly extracted | High |
| SC-023 | Parse Carrefour price format | Various formats | Consistent numeric values | High |

### 2.3 DIA Scraper

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| SC-030 | Scrape search results | Search: "arroz" | List of rice products | Critical |
| SC-031 | Extract product details | Product URL | Full product information | Critical |
| SC-032 | Handle store-specific pricing | Different store zones | Correct regional pricing | Medium |

### 2.4 Scraper Resilience

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| SC-040 | Retry on 5xx errors | Server returns 503 | Retry 3 times with exponential backoff | High |
| SC-041 | Handle CAPTCHA detection | CAPTCHA page returned | Log warning, skip product, alert | High |
| SC-042 | Rate limit detection | 429 response | Pause scraping, resume after delay | High |
| SC-043 | Session management | Session expired | Renew session automatically | Medium |
| SC-044 | Concurrent scraping | 10 parallel requests | All complete without errors | Medium |

---

## 3. Grocery List Generation

### 3.1 Ingredient Aggregation

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| GL-001 | Aggregate same ingredients | 2 recipes with "eggs" | Single entry with combined quantity | Critical |
| GL-002 | Handle different units | "500g flour" + "2 cups flour" | Converted and combined | Critical |
| GL-003 | Round to purchasable units | 1.3 eggs needed | 2 eggs | High |
| GL-004 | Category grouping | Mixed ingredients | Grouped by: Produce, Dairy, Meat, etc. | High |
| GL-005 | Handle pantry items | Common spices | Optional inclusion, marked as "likely available" | Medium |
| GL-006 | Quantity adjustment | Servings multiplier | Correct proportional scaling | Medium |

### 3.2 Product Matching

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| GL-010 | Exact name match | "Leche Pascual" | Exact product found | High |
| GL-011 | Fuzzy name match | "leche" (generic) | Top relevant products | High |
| GL-012 | Match with quantity | "500g chicken breast" | Products closest to 500g | High |
| GL-013 | Brand preference | User prefers "Hacendado" | Hacendado products ranked higher | Medium |
| GL-014 | Handle no matches | "exotic rare ingredient" | "Not found" status, manual entry option | Medium |
| GL-015 | Substitute suggestions | Unavailable product | Similar alternatives suggested | Medium |

### 3.3 List Management

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| GL-020 | Save grocery list | Complete list | List persisted with timestamp | High |
| GL-021 | Edit list item | Change quantity | List updated, total recalculated | High |
| GL-022 | Remove list item | Delete item | Item removed, totals updated | High |
| GL-023 | Add custom item | Manual entry | Item added to list | Medium |
| GL-024 | Mark item as purchased | Check off item | Item marked, progress updated | Medium |
| GL-025 | Share list | Export request | Shareable link or export format | Low |

---

## 4. Price Comparison Engine

### 4.1 Price Calculation

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| PC-001 | Compare unit prices | Same product, different stores | Correct ranking by value | Critical |
| PC-002 | Handle different pack sizes | 1L vs 6x200ml milk | Per-unit comparison | Critical |
| PC-003 | Apply promotions | Product with 2x1 offer | Promotion reflected in comparison | High |
| PC-004 | Calculate total basket | Full grocery list | Total per supermarket | High |
| PC-005 | Factor delivery costs | Comparison with delivery | Total including delivery | Medium |
| PC-006 | Historical price tracking | Product over time | Price trend information | Low |

### 4.2 Optimization

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| PC-010 | Single store optimization | "Best single store" | Store with lowest total | High |
| PC-011 | Multi-store optimization | "Optimize across stores" | Split recommendation per store | Medium |
| PC-012 | Balance price vs convenience | User preference weight | Adjusted recommendations | Medium |

---

## 5. Browser Extension

### 5.1 Installation and Setup

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| BE-001 | Chrome installation | Install from store | Extension installed, icon visible | Critical |
| BE-002 | Firefox installation | Install from store | Extension installed, icon visible | High |
| BE-003 | Initial configuration | First launch | Setup wizard displayed | High |
| BE-004 | Login to account | Valid credentials | Authenticated, synced | High |
| BE-005 | Permission request | Enable permissions | Correct permissions granted | High |

### 5.2 Site Detection

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| BE-010 | Detect Mercadona site | Navigate to mercadona.es | Extension activates, UI shown | Critical |
| BE-011 | Detect Carrefour site | Navigate to carrefour.es | Extension activates, UI shown | Critical |
| BE-012 | Detect DIA site | Navigate to dia.es | Extension activates, UI shown | Critical |
| BE-013 | Non-supermarket site | Navigate to google.com | Extension inactive | Medium |
| BE-014 | Handle subdomain variations | www.mercadona.es vs mercadona.es | Both detected correctly | Medium |

### 5.3 Cart Operations

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| BE-020 | Add single product | Product from list | Product added to cart | Critical |
| BE-021 | Add multiple products | 10-item list | All products added | Critical |
| BE-022 | Handle quantity | "3x milk" | Quantity set to 3 | High |
| BE-023 | Handle unavailable | Product out of stock | Notification, skip or substitute | High |
| BE-024 | Detect existing cart items | Cart already has items | Warn about duplicates | Medium |
| BE-025 | Clear cart before fill | User option | Cart cleared, then filled | Medium |
| BE-026 | Partial fill recovery | Process interrupted | Resume from last item | Medium |

### 5.4 Synchronization

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| BE-030 | Sync grocery list | List updated on server | Extension shows updated list | High |
| BE-031 | Offline mode | No internet | Cached list available, sync pending | Medium |
| BE-032 | Conflict resolution | List changed on both ends | User prompted to resolve | Medium |
| BE-033 | Real-time updates | List changed elsewhere | Live update in extension | Low |

### 5.5 UI/UX

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| BE-040 | Popup displays list | Click extension icon | Current grocery list shown | High |
| BE-041 | Progress indicator | During cart fill | Progress bar, item count | High |
| BE-042 | Error notification | Add to cart fails | Clear error message | High |
| BE-043 | Settings access | Open settings | Settings panel displayed | Medium |
| BE-044 | Dark mode support | System dark mode | UI adapts to dark theme | Low |

---

## 6. API Endpoints

### 6.1 Authentication

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| API-001 | Register new user | Valid registration data | User created, token returned | Critical |
| API-002 | Login with valid credentials | Correct email/password | JWT token returned | Critical |
| API-003 | Reject invalid credentials | Wrong password | 401 Unauthorized | Critical |
| API-004 | Token refresh | Valid refresh token | New access token | High |
| API-005 | Reject expired token | Expired JWT | 401, prompt re-login | High |
| API-006 | Password reset flow | Valid email | Reset email sent | Medium |

### 6.2 Meal Plan API

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| API-010 | Create meal plan | Valid plan request | Plan generated and saved | Critical |
| API-011 | Get user's meal plans | GET /meal-plans | List of user's plans | Critical |
| API-012 | Update meal plan | PUT with changes | Plan updated | High |
| API-013 | Delete meal plan | DELETE /meal-plans/:id | Plan deleted | High |
| API-014 | Unauthorized access | No token | 401 Unauthorized | High |
| API-015 | Access other user's plan | Wrong user's plan ID | 403 Forbidden | High |

### 6.3 Product API

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| API-020 | Search products | GET /products?q=leche | Product list | Critical |
| API-021 | Get product details | GET /products/:id | Full product info | Critical |
| API-022 | Filter by supermarket | GET /products?store=mercadona | Filtered results | High |
| API-023 | Pagination | GET /products?page=2&limit=20 | Correct page of results | High |
| API-024 | Empty search results | Obscure search term | Empty array, 200 OK | Medium |

### 6.4 Grocery List API

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| API-030 | Create grocery list | POST with items | List created | Critical |
| API-031 | Get grocery list | GET /lists/:id | List with items | Critical |
| API-032 | Update list item | PUT /lists/:id/items/:itemId | Item updated | High |
| API-033 | Delete list | DELETE /lists/:id | List deleted | High |
| API-034 | Generate from meal plan | POST /lists/from-plan/:planId | List generated | High |

---

## 7. Edge Cases and Error Handling

### 7.1 Network Failures

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| EC-001 | API timeout | Server unresponsive | Timeout error, retry option | High |
| EC-002 | Partial network failure | Some requests fail | Graceful degradation | High |
| EC-003 | Complete offline | No connection | Offline mode, cached data | High |
| EC-004 | Slow connection | High latency | Progress indication, no timeout | Medium |

### 7.2 Data Validation

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| EC-010 | Malformed JSON | Invalid JSON body | 400 Bad Request, clear error | High |
| EC-011 | XSS attempt | `<script>alert('xss')</script>` | Input sanitized | Critical |
| EC-012 | SQL injection | `'; DROP TABLE users;--` | Input escaped, no SQL execution | Critical |
| EC-013 | Oversized payload | 100MB request body | 413 Payload Too Large | High |
| EC-014 | Missing required fields | Incomplete request | 400 with field list | High |

### 7.3 Concurrency

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| EC-020 | Concurrent list edits | Two users edit same list | Conflict resolution | Medium |
| EC-021 | Double submission | Submit clicked twice | Idempotent handling | High |
| EC-022 | Race condition in cart | Parallel add operations | All items added correctly | High |

### 7.4 Product Availability

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| EC-030 | Product discontinued | Product no longer exists | Remove from list, notify | High |
| EC-031 | Price changed | Significant price increase | Alert user before cart | High |
| EC-032 | Temporary stockout | Product temporarily unavailable | Offer to wait or substitute | Medium |
| EC-033 | Regional unavailability | Product not in user's area | Show availability by region | Medium |

### 7.5 Browser Extension Edge Cases

| ID | Test Case | Input | Expected Output | Priority |
|----|-----------|-------|-----------------|----------|
| EC-040 | Site redesign | Supermarket changes DOM | Graceful failure, alert | High |
| EC-041 | Cart page changed | New cart implementation | Detection and adaptation | High |
| EC-042 | Extension conflict | Other extension interferes | Detection and warning | Medium |
| EC-043 | Browser update | Browser updated | Compatibility maintained | Medium |
| EC-044 | Multiple tabs | Same site in multiple tabs | Synchronized state | Medium |

---

## Test Execution Priority

### P0 - Critical (Must pass for release)
- All Critical priority tests
- Security tests (XSS, SQL injection)
- Core user flows

### P1 - High (Should pass, workarounds acceptable)
- All High priority tests
- Integration tests
- Performance benchmarks

### P2 - Medium (Nice to have)
- All Medium priority tests
- Edge cases
- UI/UX tests

### P3 - Low (Can defer)
- All Low priority tests
- Non-essential features
- Rare edge cases

---

## Appendix: Test Data Requirements

### Required Fixtures

1. **User Profiles**: 10 variations (standard, vegetarian, vegan, allergies, etc.)
2. **Product Catalogs**: 100 products per supermarket minimum
3. **Recipe Database**: 50 recipes with full nutritional data
4. **HTML Snapshots**: Saved pages from each supermarket for scraper tests
5. **API Response Mocks**: All endpoint responses in JSON format
