# Meal Automation Product - Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the Meal Automation Product, which includes:
- Meal planning questionnaire and recommendation engine
- Spanish supermarket product scraping system
- Grocery list generation
- Browser extension for automated cart filling

## Testing Philosophy

### Test Pyramid Approach

```
           /\
          /E2E\           <- 10% - Critical user flows
         /------\
        /Integr. \        <- 20% - Component interactions
       /----------\
      /   Unit     \      <- 70% - Business logic
     /--------------\
```

### Coverage Targets

| Category | Target | Priority |
|----------|--------|----------|
| Core Business Logic | 90%+ | Critical |
| API Endpoints | 85%+ | High |
| Scraper Logic | 80%+ | High |
| UI Components | 75%+ | Medium |
| Browser Extension | 70%+ | Medium |
| Utilities | 60%+ | Low |

## Test Framework Selection

### Recommended Stack

```json
{
  "unit": "vitest",
  "integration": "vitest + supertest",
  "e2e": "playwright",
  "browser-extension": "playwright + chrome-extension-testing",
  "coverage": "c8/istanbul",
  "mocking": "msw (Mock Service Worker)"
}
```

### Rationale

- **Vitest**: Fast, ESM-native, excellent TypeScript support
- **Playwright**: Cross-browser E2E testing, excellent for extension testing
- **MSW**: Intercepts network requests at the network level, works in browser and Node.js

## Test Categories

### 1. Unit Tests

#### 1.1 Meal Planning Engine

```typescript
// Example test structure
describe('MealPlanningEngine', () => {
  describe('generateMealPlan', () => {
    it('should generate a 7-day plan for standard preferences')
    it('should respect dietary restrictions')
    it('should balance nutritional requirements')
    it('should handle vegetarian/vegan diets')
    it('should consider calorie targets')
  })

  describe('calculateNutrition', () => {
    it('should calculate macros correctly')
    it('should handle missing nutritional data')
  })
})
```

#### 1.2 Product Matching

```typescript
describe('ProductMatcher', () => {
  describe('findMatchingProducts', () => {
    it('should find exact matches')
    it('should find fuzzy matches')
    it('should rank by relevance score')
    it('should handle missing products gracefully')
    it('should respect brand preferences')
  })
})
```

#### 1.3 Price Comparison

```typescript
describe('PriceComparator', () => {
  describe('comparePrices', () => {
    it('should calculate unit prices correctly')
    it('should handle different units (kg, g, l, ml)')
    it('should identify best value options')
    it('should apply promotions/discounts')
  })
})
```

### 2. Integration Tests

#### 2.1 Scraper Integration

- Test scraper modules with mocked HTTP responses
- Verify data extraction accuracy
- Test error handling for failed requests
- Validate rate limiting compliance

#### 2.2 API Integration

- Test complete request/response cycles
- Verify database operations
- Test authentication flows
- Validate data transformations

#### 2.3 Browser Extension Messaging

- Test content script to background script communication
- Test popup to content script messaging
- Verify storage sync between components

### 3. E2E Tests

#### 3.1 Critical User Flows

1. **Complete Meal Planning Flow**
   - User answers dietary questions
   - System generates meal plan
   - User reviews and modifies plan
   - Grocery list is generated

2. **Product Search and Selection**
   - Search for specific product
   - Compare across supermarkets
   - Select best option
   - Add to cart

3. **Cart Synchronization**
   - Extension detects supermarket site
   - User initiates cart fill
   - Products are added correctly
   - Handle unavailable products

## Mocking Strategy

### External API Mocks

```typescript
// MSW handler example for supermarket API
const handlers = [
  rest.get('https://api.mercadona.es/products/*', (req, res, ctx) => {
    return res(ctx.json(mockMercadonaProduct))
  }),
  rest.get('https://api.carrefour.es/products/*', (req, res, ctx) => {
    return res(ctx.json(mockCarrefourProduct))
  }),
]
```

### Database Mocks

- Use in-memory SQLite for fast tests
- Seed with consistent test data
- Reset between test suites

### Browser Extension Mocks

- Mock Chrome APIs (chrome.storage, chrome.tabs, etc.)
- Use webext-mock or custom implementations
- Simulate different browser states

## Test Data Management

### Fixtures Structure

```
/src/tests/fixtures/
  /meal-plans/
    standard-7-day.json
    vegetarian-7-day.json
    low-calorie-7-day.json
  /products/
    mercadona-catalog.json
    carrefour-catalog.json
    dia-catalog.json
  /users/
    standard-user.json
    dietary-restrictions.json
  /scraped-responses/
    mercadona-search.html
    carrefour-product-page.html
```

### Test Data Principles

1. **Deterministic**: Same input always produces same output
2. **Realistic**: Data resembles production data
3. **Minimal**: Only what's needed for the test
4. **Documented**: Clear description of what each fixture represents

## Performance Testing

### Benchmarks

| Operation | Target | Threshold |
|-----------|--------|-----------|
| Meal plan generation | < 2s | 5s |
| Product search | < 500ms | 1s |
| Price comparison (5 supermarkets) | < 1s | 3s |
| Cart sync (50 items) | < 10s | 30s |

### Load Testing

- Test scraper with concurrent requests
- Verify rate limiting works correctly
- Test database under concurrent writes

## Security Testing

### Areas of Focus

1. **Input Validation**
   - SQL injection prevention
   - XSS in user-generated content
   - Path traversal in file operations

2. **API Security**
   - Authentication bypass attempts
   - Rate limiting enforcement
   - Data leakage in error responses

3. **Browser Extension Security**
   - Content Security Policy validation
   - Cross-origin request validation
   - Secure storage of credentials

## Continuous Integration

### Test Stages

```yaml
stages:
  - lint
  - unit-tests
  - integration-tests
  - e2e-tests
  - security-scan
```

### Quality Gates

- All unit tests must pass
- Coverage must meet targets
- No critical security vulnerabilities
- E2E tests for critical flows must pass

## Test Maintenance

### Guidelines

1. **Keep tests focused**: One behavior per test
2. **Avoid test interdependence**: Each test should be isolated
3. **Update fixtures regularly**: Keep test data current
4. **Review flaky tests**: Fix or quarantine unreliable tests
5. **Document complex tests**: Explain non-obvious test logic

### Test Review Checklist

- [ ] Tests are named descriptively
- [ ] Edge cases are covered
- [ ] Error scenarios are tested
- [ ] Mocks are appropriate and minimal
- [ ] No hardcoded test data outside fixtures
- [ ] Tests can run in any order

## Specific Challenges

### Scraper Testing Challenges

1. **Dynamic Content**: Use snapshot testing with recorded responses
2. **Rate Limits**: Test throttling without actual delays
3. **Site Changes**: Version fixture files, alert on structure changes

### Browser Extension Challenges

1. **Cross-browser**: Test in Chrome, Firefox, Edge
2. **Permission Variations**: Test with different permission sets
3. **Storage Limits**: Test behavior at storage boundaries

## Appendix: Test Configuration Files

See the following files for implementation details:
- `/vitest.config.ts` - Unit test configuration
- `/playwright.config.ts` - E2E test configuration
- `/src/tests/setup.ts` - Global test setup
- `/src/tests/msw/handlers.ts` - API mock handlers
