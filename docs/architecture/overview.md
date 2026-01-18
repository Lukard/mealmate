# Architecture Overview

This document provides a high-level overview of the Meal Automation system architecture.

## System Overview

Meal Automation is built as a modular monorepo with clearly separated concerns across multiple packages.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interfaces                          │
├─────────────────────┬───────────────────────────────────────────┤
│     Web UI (React)  │           Browser Extension               │
└─────────────────────┴───────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                           API Layer                              │
│                    (REST API / Node.js)                         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│      Core Engine      │ │    Scraper      │ │    Database     │
│  (Business Logic)     │ │  (Playwright)   │ │  (PostgreSQL)   │
└───────────────────────┘ └─────────────────┘ └─────────────────┘
```

## Package Architecture

### @meal-automation/shared

Common types, interfaces, and utilities shared across all packages.

**Contents:**
- TypeScript interfaces and types
- Validation schemas (Zod)
- Utility functions
- Constants and enums

```typescript
// Example: Shared types
export interface MealPlan {
  id: string;
  weekStart: Date;
  meals: DailyMeals[];
  userId: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  supermarket: Supermarket;
  category: ProductCategory;
}
```

### @meal-automation/core

Core business logic independent of frameworks or external services.

**Responsibilities:**
- Meal plan generation algorithm
- Ingredient to product matching
- Grocery list optimization
- Nutritional calculations
- Pricing calculations

```
core/
├── meal-planner/        # Meal planning algorithm
├── product-matcher/     # Ingredient matching
├── grocery-optimizer/   # List optimization
├── nutrition/           # Nutritional analysis
└── pricing/             # Price calculations
```

### @meal-automation/scraper

Web scraping engine for extracting product data from supermarket websites.

**Responsibilities:**
- Supermarket-specific scrapers
- Product data extraction
- Price monitoring
- Availability checking
- Anti-bot mitigation

```
scraper/
├── adapters/            # Supermarket-specific adapters
│   ├── mercadona.ts
│   ├── carrefour.ts
│   └── lidl.ts
├── common/              # Shared scraping utilities
├── scheduler/           # Scraping job scheduler
└── storage/             # Product data persistence
```

### @meal-automation/api

REST API server providing endpoints for the frontend and extension.

**Responsibilities:**
- Authentication and authorization
- Meal plan CRUD operations
- User preference management
- Product search and retrieval
- Grocery list management

```
api/
├── routes/              # API route handlers
├── middleware/          # Express middleware
├── services/            # Business service layer
├── models/              # Database models
└── utils/               # API utilities
```

### @meal-automation/ui

React-based web application for meal planning and grocery management.

**Responsibilities:**
- User onboarding flow
- Meal plan visualization
- Recipe browsing and selection
- Grocery list management
- Account settings

```
ui/
├── components/          # Reusable UI components
├── pages/               # Page components
├── hooks/               # Custom React hooks
├── services/            # API client services
├── store/               # State management
└── styles/              # CSS and styling
```

### @meal-automation/extension

Chrome extension for automated supermarket cart filling.

**Responsibilities:**
- Cart automation scripts
- Supermarket website integration
- Product search on store pages
- User session management
- Communication with main app

```
extension/
├── background/          # Service worker
├── content/             # Content scripts
├── popup/               # Extension popup UI
├── utils/               # Shared utilities
└── manifest.json        # Extension manifest
```

## Data Flow

### Meal Planning Flow

```
1. User Input (Preferences)
         │
         ▼
2. Core: Generate Meal Plan
         │
         ▼
3. Core: Match Ingredients to Products
         │
         ▼
4. Scraper: Fetch Current Prices
         │
         ▼
5. Core: Optimize Grocery List
         │
         ▼
6. API: Return Plan + List to UI
```

### Shopping Automation Flow

```
1. UI: User confirms grocery list
         │
         ▼
2. API: Prepare cart data
         │
         ▼
3. Extension: Receive cart data
         │
         ▼
4. Extension: Open supermarket site
         │
         ▼
5. Extension: Search and add products
         │
         ▼
6. Extension: Report completion to UI
```

## Database Schema

### Core Entities

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │────<│  MealPlan    │────<│    Meal      │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Product    │────<│ GroceryItem  │<────│   Recipe     │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Key Tables

| Table | Description |
|-------|-------------|
| users | User accounts and authentication |
| user_preferences | Dietary restrictions, preferences |
| recipes | Recipe database with ingredients |
| products | Supermarket product catalog |
| meal_plans | Generated weekly meal plans |
| grocery_lists | Shopping lists per user |

## Integration Points

### External Services

| Service | Purpose | Integration Type |
|---------|---------|------------------|
| Supermarket websites | Product data, cart API | Web scraping |
| Recipe APIs | Recipe data augmentation | REST API |
| Nutrition APIs | Nutritional information | REST API |
| Email service | User notifications | SMTP/API |

### Internal Communication

| From | To | Method |
|------|-----|--------|
| UI | API | REST over HTTPS |
| Extension | API | REST over HTTPS |
| Extension | UI | Message passing |
| Scraper | Database | Direct connection |

## Security Architecture

### Authentication

- JWT-based authentication
- Refresh token rotation
- Secure cookie storage

### Data Protection

- HTTPS everywhere
- Encrypted credentials storage
- Minimal data collection (GDPR)

### Extension Security

- Content Security Policy
- Manifest V3 compliance
- Scoped permissions

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CDN (Static Assets)                      │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      Load Balancer                               │
└─────────────────────────────────────────────────────────────────┘
                    │               │               │
                    ▼               ▼               ▼
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │   API Node 1  │ │   API Node 2  │ │   API Node N  │
        └───────────────┘ └───────────────┘ └───────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database Cluster                          │
│                    (PostgreSQL Primary/Replica)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Decisions

### Language: TypeScript

**Rationale:**
- Type safety across frontend and backend
- Better developer experience
- Shared types between packages
- Strong ecosystem support

### Scraping: Playwright

**Rationale:**
- Handles dynamic content (JavaScript rendering)
- Multi-browser support
- Better anti-bot handling than HTTP clients
- Active maintenance

### Frontend: React

**Rationale:**
- Large ecosystem
- Component-based architecture
- Strong TypeScript support
- Team familiarity

### Extension: Manifest V3

**Rationale:**
- Required for Chrome Web Store
- Better security model
- Service worker architecture

## Performance Considerations

### Caching Strategy

| Data | Cache Duration | Invalidation |
|------|----------------|--------------|
| Product prices | 24 hours | Daily refresh |
| Recipe data | 7 days | Manual |
| User preferences | Session | User action |
| Meal plans | Until regenerated | User action |

### Optimization Targets

| Operation | Target Latency |
|-----------|----------------|
| Page load | < 2s |
| Meal plan generation | < 5s |
| Product search | < 1s |
| Cart population | < 30s |

## Related Documents

- [Technical Specification](./technical-spec.md)
- [API Documentation](../api/overview.md)
- [Database Schema](./database-schema.md)
- [Deployment Guide](../development/deployment.md)
