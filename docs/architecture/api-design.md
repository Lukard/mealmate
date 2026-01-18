# Meal Automation System - API Design

## Overview

This document defines the RESTful API endpoints for the meal automation system. The API follows REST conventions with JSON request/response bodies, uses JWT authentication, and implements proper error handling.

---

## Base Configuration

### Base URL
```
Production: https://api.mealplanner.app/v1
Staging:    https://staging-api.mealplanner.app/v1
Development: http://localhost:3000/api/v1
```

### Authentication
All authenticated endpoints require a Bearer token:
```http
Authorization: Bearer <jwt_token>
```

### Response Format
```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    timing?: { duration: number };
  };
}

// Error response
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: unknown;      // Additional error context
    requestId: string;      // For debugging/support
  };
}

// Pagination metadata
interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful deletion) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Authentication Endpoints

### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2024-01-22T10:30:00Z"
  }
}
```

### POST /auth/logout
Invalidate current session.

**Response (204):** No content

### POST /auth/refresh
Refresh JWT token.

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

### POST /auth/google
OAuth2 authentication with Google.

**Request:**
```json
{
  "idToken": "google_id_token"
}
```

### POST /auth/forgot-password
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password
Reset password with token.

**Request:**
```json
{
  "token": "reset_token",
  "newPassword": "newSecurePassword123!"
}
```

---

## User Profile Endpoints

### GET /users/me
Get current user profile.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "profile": {
      "householdSize": 4,
      "budgetWeekly": 15000,
      "preferredStores": ["uuid-mercadona", "uuid-carrefour"],
      "cookingSkill": "intermediate",
      "maxPrepTime": 60,
      "cuisinePreferences": ["mediterranean", "asian"],
      "dislikedIngredients": ["cilantro", "liver"]
    },
    "restrictions": [
      { "id": "uuid", "name": "Gluten-Free", "severity": "strict" },
      { "id": "uuid", "name": "Low-Sodium", "severity": "prefer" }
    ]
  }
}
```

### PATCH /users/me
Update user profile.

**Request:**
```json
{
  "name": "John Smith",
  "profile": {
    "householdSize": 3,
    "budgetWeekly": 12000
  }
}
```

### PUT /users/me/restrictions
Update dietary restrictions.

**Request:**
```json
{
  "restrictions": [
    { "restrictionId": "uuid", "severity": "strict" },
    { "restrictionId": "uuid", "severity": "avoid" }
  ]
}
```

### DELETE /users/me
Delete user account.

**Request:**
```json
{
  "password": "currentPassword123!"
}
```

---

## Recipe Endpoints

### GET /recipes
List recipes with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| cuisine | string | Filter by cuisine |
| difficulty | string | easy, medium, hard |
| maxPrepTime | number | Maximum prep time (minutes) |
| maxCookTime | number | Maximum cook time (minutes) |
| dietary | string[] | Dietary restriction IDs |
| tags | string[] | Recipe tags |
| page | number | Page number (default: 1) |
| pageSize | number | Items per page (default: 20, max: 100) |
| sort | string | createdAt, prepTime, rating |
| order | string | asc, desc |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Paella Valenciana",
      "description": "Traditional Spanish rice dish...",
      "prepTime": 30,
      "cookTime": 45,
      "servings": 4,
      "difficulty": "medium",
      "cuisine": "spanish",
      "imageUrl": "https://...",
      "tags": ["rice", "seafood", "traditional"],
      "rating": 4.5,
      "reviewCount": 128
    }
  ],
  "meta": {
    "pagination": {
      "total": 156,
      "page": 1,
      "pageSize": 20,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

### GET /recipes/:id
Get recipe details with ingredients.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Paella Valenciana",
    "description": "...",
    "instructions": [
      "Heat olive oil in a large paella pan...",
      "Add the chicken and rabbit pieces...",
      "..."
    ],
    "prepTime": 30,
    "cookTime": 45,
    "servings": 4,
    "difficulty": "medium",
    "cuisine": "spanish",
    "imageUrl": "https://...",
    "sourceUrl": "https://...",
    "nutritionData": {
      "calories": 520,
      "protein": 28,
      "carbohydrates": 65,
      "fat": 15,
      "fiber": 4,
      "sodium": 890,
      "sugar": 3
    },
    "ingredients": [
      {
        "id": "uuid",
        "name": "Bomba rice",
        "quantity": 400,
        "unit": "g",
        "notes": null,
        "isOptional": false
      },
      {
        "id": "uuid",
        "name": "Chicken thighs",
        "quantity": 500,
        "unit": "g",
        "notes": "cut into pieces",
        "isOptional": false
      }
    ],
    "tags": ["rice", "seafood", "traditional"],
    "author": {
      "id": "uuid",
      "name": "Chef Maria"
    },
    "createdAt": "2024-01-10T08:00:00Z"
  }
}
```

### POST /recipes
Create a new recipe (authenticated users).

**Request:**
```json
{
  "name": "My Special Tortilla",
  "description": "Family recipe for Spanish tortilla",
  "instructions": ["...", "..."],
  "prepTime": 15,
  "cookTime": 25,
  "servings": 6,
  "difficulty": "easy",
  "cuisine": "spanish",
  "ingredients": [
    { "ingredientId": "uuid", "quantity": 6, "unit": "units", "notes": "medium size" },
    { "ingredientId": "uuid", "quantity": 500, "unit": "g" }
  ],
  "tags": ["eggs", "potatoes", "traditional"],
  "isPublic": true
}
```

### PUT /recipes/:id
Update a recipe (owner only).

### DELETE /recipes/:id
Delete a recipe (owner only).

### POST /recipes/:id/scale
Get recipe scaled to different servings.

**Request:**
```json
{
  "targetServings": 8
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "originalServings": 4,
    "targetServings": 8,
    "scaleFactor": 2,
    "ingredients": [
      { "name": "Bomba rice", "quantity": 800, "unit": "g" },
      { "name": "Chicken thighs", "quantity": 1000, "unit": "g" }
    ]
  }
}
```

---

## Meal Plan Endpoints

### GET /meal-plans
List user's meal plans.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | draft, active, completed, archived |
| startDate | string | Filter by start date (ISO 8601) |
| endDate | string | Filter by end date (ISO 8601) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Week of Jan 15",
      "startDate": "2024-01-15",
      "endDate": "2024-01-21",
      "status": "active",
      "mealCount": 21,
      "estimatedCost": 8500,
      "createdAt": "2024-01-14T10:00:00Z"
    }
  ]
}
```

### GET /meal-plans/:id
Get meal plan with all entries.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Week of Jan 15",
    "startDate": "2024-01-15",
    "endDate": "2024-01-21",
    "status": "active",
    "entries": [
      {
        "date": "2024-01-15",
        "meals": {
          "breakfast": {
            "id": "uuid",
            "recipe": { "id": "uuid", "name": "Tostadas con tomate", "imageUrl": "..." },
            "servings": 2
          },
          "lunch": { ... },
          "dinner": { ... },
          "snacks": [{ ... }]
        }
      }
    ],
    "summary": {
      "totalMeals": 21,
      "totalIngredients": 45,
      "estimatedCost": 8500,
      "nutritionAverage": {
        "calories": 2100,
        "protein": 80,
        "carbohydrates": 250,
        "fat": 70
      }
    }
  }
}
```

### POST /meal-plans
Create a new meal plan.

**Request:**
```json
{
  "name": "Week of Jan 22",
  "startDate": "2024-01-22",
  "endDate": "2024-01-28"
}
```

### POST /meal-plans/generate
Generate meal plan with AI assistance.

**Request:**
```json
{
  "startDate": "2024-01-22",
  "endDate": "2024-01-28",
  "preferences": {
    "includeBreakfast": true,
    "includeLunch": true,
    "includeDinner": true,
    "includeSnacks": false,
    "variety": "high",
    "preferQuickMeals": true,
    "maxPrepTime": 45,
    "budgetLimit": 10000
  }
}
```

### PUT /meal-plans/:id/entries
Batch update meal plan entries.

**Request:**
```json
{
  "entries": [
    {
      "date": "2024-01-22",
      "mealType": "lunch",
      "recipeId": "uuid",
      "servings": 4
    }
  ]
}
```

### DELETE /meal-plans/:id/entries/:entryId
Remove a meal from the plan.

### POST /meal-plans/:id/duplicate
Duplicate a meal plan to new dates.

**Request:**
```json
{
  "newStartDate": "2024-01-29"
}
```

---

## Product & Supermarket Endpoints

### GET /supermarkets
List available supermarkets.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Mercadona",
      "slug": "mercadona",
      "domain": "mercadona.es",
      "logoUrl": "https://...",
      "color": "#00A650",
      "productCount": 12500,
      "lastUpdated": "2024-01-15T06:00:00Z"
    }
  ]
}
```

### GET /products
Search products across supermarkets.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query (required, min 2 chars) |
| supermarketId | string | Filter by supermarket |
| category | string | Product category |
| minPrice | number | Minimum price (cents) |
| maxPrice | number | Maximum price (cents) |
| inStock | boolean | Only show in-stock items |
| onSale | boolean | Only show items on sale |
| organic | boolean | Only show organic items |
| page | number | Page number |
| pageSize | number | Items per page (max 100) |
| sort | string | price, pricePerUnit, name, relevance |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "supermarket": {
        "id": "uuid",
        "name": "Mercadona",
        "color": "#00A650"
      },
      "name": "Tomate pera",
      "brand": "Hacendado",
      "price": 189,
      "priceFormatted": "1,89 EUR",
      "pricePerUnit": 189,
      "pricePerUnitFormatted": "1,89 EUR/kg",
      "unit": "kg",
      "unitQuantity": 1,
      "category": "Frutas y verduras",
      "imageUrl": "https://...",
      "availability": "in_stock",
      "isOnSale": true,
      "salePrice": 149,
      "salePriceFormatted": "1,49 EUR"
    }
  ]
}
```

### GET /products/:id
Get product details.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "supermarket": { ... },
    "name": "Tomate pera",
    "brand": "Hacendado",
    "description": "Tomates pera frescos de agricultura nacional...",
    "price": 189,
    "pricePerUnit": 189,
    "unit": "kg",
    "category": "Frutas y verduras",
    "subcategory": "Tomates",
    "imageUrl": "https://...",
    "productUrl": "https://...",
    "availability": "in_stock",
    "isOrganic": false,
    "nutritionData": {
      "servingSize": "100g",
      "calories": 18,
      "protein": 0.9,
      "carbohydrates": 3.9,
      "fat": 0.2,
      "allergens": []
    },
    "priceHistory": [
      { "date": "2024-01-15", "price": 189 },
      { "date": "2024-01-08", "price": 199 },
      { "date": "2024-01-01", "price": 209 }
    ]
  }
}
```

### GET /products/:id/price-history
Get detailed price history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| days | number | Number of days (default: 30, max: 365) |

### GET /products/compare
Compare prices across supermarkets.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| ingredientId | string | Ingredient to match |
| q | string | Product search query |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "query": "leche entera",
    "bestMatch": {
      "supermarket": "Mercadona",
      "product": { ... },
      "price": 89
    },
    "comparisons": [
      {
        "supermarket": { "id": "uuid", "name": "Mercadona" },
        "product": { ... },
        "price": 89,
        "pricePerUnit": 89,
        "savingsVsBest": 0
      },
      {
        "supermarket": { "id": "uuid", "name": "Carrefour" },
        "product": { ... },
        "price": 95,
        "pricePerUnit": 95,
        "savingsVsBest": -6
      }
    ]
  }
}
```

---

## Ingredient Matching Endpoints

### POST /matching/ingredients
Match ingredients to products.

**Request:**
```json
{
  "ingredients": [
    { "id": "uuid", "name": "Tomates", "quantity": 500, "unit": "g" },
    { "id": "uuid", "name": "Arroz", "quantity": 400, "unit": "g" }
  ],
  "supermarketId": "uuid",
  "preferences": {
    "preferOrganic": false,
    "preferCheapest": true,
    "brandPreferences": {}
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "ingredient": { "id": "uuid", "name": "Tomates" },
        "matches": [
          {
            "product": { ... },
            "confidence": 0.95,
            "matchType": "exact",
            "quantityNeeded": 1,
            "totalPrice": 189
          },
          {
            "product": { ... },
            "confidence": 0.82,
            "matchType": "fuzzy",
            "quantityNeeded": 1,
            "totalPrice": 229
          }
        ],
        "selectedMatch": 0
      }
    ],
    "summary": {
      "totalMatched": 2,
      "totalUnmatched": 0,
      "estimatedTotal": 589
    }
  }
}
```

### POST /matching/approve
Approve or reject a product match (for learning).

**Request:**
```json
{
  "ingredientId": "uuid",
  "productId": "uuid",
  "approved": true
}
```

---

## Grocery List Endpoints

### GET /grocery-lists
List user's grocery lists.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Week of Jan 15",
      "mealPlanId": "uuid",
      "status": "ready",
      "itemCount": 24,
      "totalPrice": 8500,
      "totalPriceFormatted": "85,00 EUR",
      "supermarket": { "id": "uuid", "name": "Mercadona" },
      "createdAt": "2024-01-14T12:00:00Z"
    }
  ]
}
```

### GET /grocery-lists/:id
Get grocery list with items.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Week of Jan 15",
    "status": "ready",
    "supermarket": { ... },
    "items": [
      {
        "id": "uuid",
        "displayName": "Tomate pera",
        "ingredient": { "id": "uuid", "name": "Tomates" },
        "product": { ... },
        "quantity": 2,
        "unit": "kg",
        "price": 378,
        "isChecked": false,
        "isSubstituted": false,
        "category": "Frutas y verduras",
        "sortOrder": 1
      }
    ],
    "summary": {
      "totalItems": 24,
      "checkedItems": 0,
      "totalPrice": 8500,
      "byCategory": {
        "Frutas y verduras": { "items": 8, "price": 2100 },
        "Carnes": { "items": 4, "price": 3200 }
      }
    }
  }
}
```

### POST /grocery-lists
Create a new grocery list.

**Request:**
```json
{
  "name": "Week of Jan 22",
  "mealPlanId": "uuid",
  "supermarketId": "uuid"
}
```

### POST /grocery-lists/from-meal-plan/:mealPlanId
Generate grocery list from meal plan.

**Request:**
```json
{
  "supermarketId": "uuid",
  "name": "Shopping for Week of Jan 15",
  "optimizationStrategy": "single_store",
  "consolidateQuantities": true
}
```

### PATCH /grocery-lists/:id/items/:itemId
Update a grocery list item.

**Request:**
```json
{
  "isChecked": true,
  "quantity": 3
}
```

### POST /grocery-lists/:id/items/:itemId/substitute
Substitute a product.

**Request:**
```json
{
  "newProductId": "uuid"
}
```

### DELETE /grocery-lists/:id/items/:itemId
Remove an item from the list.

### POST /grocery-lists/:id/optimize
Re-optimize the grocery list.

**Request:**
```json
{
  "strategy": "multi_store",
  "maxStores": 2
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "originalTotal": 8500,
    "optimizedTotal": 7800,
    "savings": 700,
    "savingsPercent": 8.2,
    "stores": [
      {
        "supermarket": { ... },
        "items": [...],
        "subtotal": 4200
      }
    ]
  }
}
```

---

## Browser Extension Endpoints

### GET /extension/status
Check extension connection status.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "lastSync": "2024-01-15T14:30:00Z",
    "version": "1.2.0",
    "capabilities": ["mercadona", "carrefour", "dia"]
  }
}
```

### GET /extension/grocery-list
Get current grocery list for extension.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "groceryListId": "uuid",
    "supermarket": {
      "id": "uuid",
      "slug": "mercadona",
      "domain": "mercadona.es"
    },
    "items": [
      {
        "id": "uuid",
        "productId": "external-product-id",
        "productUrl": "https://tienda.mercadona.es/...",
        "name": "Tomate pera",
        "quantity": 2
      }
    ]
  }
}
```

### POST /extension/cart/start
Start automated cart filling.

**Request:**
```json
{
  "groceryListId": "uuid",
  "supermarketId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "cartSessionId": "uuid",
    "status": "in_progress",
    "items": [...]
  }
}
```

### POST /extension/cart/item-added
Report item successfully added to cart.

**Request:**
```json
{
  "cartSessionId": "uuid",
  "groceryListItemId": "uuid",
  "success": true,
  "actualPrice": 189
}
```

### POST /extension/cart/complete
Report cart filling complete.

**Request:**
```json
{
  "cartSessionId": "uuid",
  "totalItems": 24,
  "successfulItems": 22,
  "failedItems": 2,
  "totalPrice": 8320
}
```

### POST /extension/cart/error
Report error during cart filling.

**Request:**
```json
{
  "cartSessionId": "uuid",
  "groceryListItemId": "uuid",
  "error": "Product not found",
  "errorCode": "PRODUCT_NOT_FOUND"
}
```

---

## Webhook Endpoints

### POST /webhooks/scraper
Webhook for scraper job completion (internal).

**Headers:**
```http
X-Webhook-Secret: <shared_secret>
```

**Request:**
```json
{
  "event": "scrape_complete",
  "supermarketId": "uuid",
  "productsUpdated": 1250,
  "productsAdded": 45,
  "productsRemoved": 12,
  "duration": 3600,
  "timestamp": "2024-01-15T06:00:00Z"
}
```

---

## Rate Limiting

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1705326000
```

### Limits by Endpoint Group

| Endpoint Group | Authenticated | Unauthenticated |
|---------------|---------------|-----------------|
| /auth/* | 20/min | 10/min |
| /recipes/* | 100/min | 30/min |
| /products/* | 200/min | 50/min |
| /meal-plans/* | 100/min | N/A |
| /grocery-lists/* | 100/min | N/A |
| /extension/* | 60/min | N/A |
| /matching/* | 50/min | N/A |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_INVALID_CREDENTIALS | 401 | Invalid email or password |
| AUTH_TOKEN_EXPIRED | 401 | JWT token has expired |
| AUTH_TOKEN_INVALID | 401 | JWT token is malformed |
| AUTH_INSUFFICIENT_PERMISSIONS | 403 | User lacks required permissions |
| RESOURCE_NOT_FOUND | 404 | Requested resource not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| DUPLICATE_RESOURCE | 409 | Resource already exists |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| SCRAPER_UNAVAILABLE | 503 | Product data temporarily unavailable |
| SUPERMARKET_NOT_SUPPORTED | 400 | Requested supermarket not supported |
| PRODUCT_NOT_FOUND | 404 | Product not found in supermarket |
| MATCHING_FAILED | 422 | Could not match ingredient to product |
| CART_SESSION_EXPIRED | 400 | Cart filling session has expired |

---

## Versioning

API versions are included in the URL path (`/v1/`, `/v2/`).

### Deprecation Policy
- New versions announced 6 months in advance
- Old versions supported for 12 months after new version release
- Deprecation warnings in response headers:
  ```http
  Deprecation: true
  Sunset: Sat, 01 Jan 2025 00:00:00 GMT
  Link: <https://api.mealplanner.app/v2/recipes>; rel="successor-version"
  ```

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
- Production: `https://api.mealplanner.app/v1/openapi.json`
- Swagger UI: `https://api.mealplanner.app/docs`
