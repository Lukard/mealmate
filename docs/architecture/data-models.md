# Meal Automation System - Data Models

## Overview

This document defines the database schemas, relationships, and data structures used throughout the meal automation system. We use PostgreSQL with Drizzle ORM for type-safe database access.

---

## Entity Relationship Diagram

```
+------------------+       +------------------+       +------------------+
|      Users       |       |   UserProfiles   |       | DietaryRestrictions|
+------------------+       +------------------+       +------------------+
| id (PK)          |<----->| userId (FK)      |       | id (PK)          |
| email            |       | householdSize    |       | name             |
| passwordHash     |       | budgetWeekly     |       | description      |
| createdAt        |       | preferredStores  |       +--------+---------+
| updatedAt        |       | cookingSkill     |                |
+--------+---------+       +------------------+                |
         |                                                     |
         |                 +------------------+                |
         |                 |UserRestrictions  |<---------------+
         |                 +------------------+
         |                 | userId (FK)      |
         |                 | restrictionId(FK)|
         |                 +------------------+
         |
         |         +------------------+       +------------------+
         |         |    MealPlans     |       |   MealPlanDays   |
         +-------->+------------------+       +------------------+
                   | id (PK)          |<----->| id (PK)          |
                   | userId (FK)      |       | mealPlanId (FK)  |
                   | name             |       | date             |
                   | startDate        |       | breakfast (FK)   |
                   | endDate          |       | lunch (FK)       |
                   | status           |       | dinner (FK)      |
                   +------------------+       | snacks (FK[])    |
                                              +--------+---------+
                                                       |
+------------------+       +------------------+        |
|     Recipes      |       | RecipeIngredients|<-------+
+------------------+       +------------------+
| id (PK)          |<----->| id (PK)          |
| name             |       | recipeId (FK)    |
| description      |       | ingredientId(FK) |
| instructions     |       | quantity         |
| prepTime         |       | unit             |
| cookTime         |       | notes            |
| servings         |       +--------+---------+
| difficulty       |                |
| cuisine          |                |
| imageUrl         |                v
| nutritionData    |       +------------------+
| sourceUrl        |       |   Ingredients    |
+------------------+       +------------------+
                           | id (PK)          |
                           | name             |
                           | category         |
                           | standardUnit     |
                           | aliases          |
                           +--------+---------+
                                    |
                                    |
         +--------------------------+
         |
         v
+------------------+       +------------------+       +------------------+
|    Products      |       |   Supermarkets   |       |  PriceHistory    |
+------------------+       +------------------+       +------------------+
| id (PK)          |<----->| id (PK)          |       | id (PK)          |
| supermarketId(FK)|       | name             |       | productId (FK)   |
| name             |       | domain           |       | price            |
| brand            |       | logoUrl          |       | currency         |
| price            |       | scrapingEnabled  |       | recordedAt       |
| pricePerUnit     |       | lastScrapedAt    |       | promotion        |
| unit             |       +------------------+       +------------------+
| category         |
| imageUrl         |
| url              |
| availability     |
| lastUpdated      |
+------------------+
         |
         v
+------------------+       +------------------+       +------------------+
| ProductMatches   |       |  GroceryLists    |       | GroceryListItems |
+------------------+       +------------------+       +------------------+
| id (PK)          |       | id (PK)          |<----->| id (PK)          |
| ingredientId(FK) |       | userId (FK)      |       | groceryListId(FK)|
| productId (FK)   |       | mealPlanId (FK)  |       | productId (FK)   |
| confidence       |       | name             |       | ingredientId(FK) |
| userApproved     |       | status           |       | quantity         |
+------------------+       | totalPrice       |       | checked          |
                           | createdAt        |       | substituted      |
                           +------------------+       +------------------+
```

---

## Schema Definitions (Drizzle ORM)

### Users & Authentication

```typescript
// schema/users.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  googleId: varchar('google_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### User Profiles & Preferences

```typescript
// schema/profiles.ts
import { pgTable, uuid, integer, varchar, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const cookingSkillEnum = pgEnum('cooking_skill', ['beginner', 'intermediate', 'advanced', 'expert']);

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  householdSize: integer('household_size').default(2).notNull(),
  budgetWeekly: integer('budget_weekly'), // In cents
  preferredStores: jsonb('preferred_stores').$type<string[]>().default([]),
  cookingSkill: cookingSkillEnum('cooking_skill').default('intermediate'),
  maxPrepTime: integer('max_prep_time'), // In minutes
  cuisinePreferences: jsonb('cuisine_preferences').$type<string[]>().default([]),
  dislikedIngredients: jsonb('disliked_ingredients').$type<string[]>().default([]),
});

export const dietaryRestrictions = pgTable('dietary_restrictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  icon: varchar('icon', { length: 50 }),
});

// Built-in restrictions: vegan, vegetarian, gluten-free, dairy-free, nut-free,
// halal, kosher, low-sodium, low-carb, keto, paleo

export const userRestrictions = pgTable('user_restrictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  restrictionId: uuid('restriction_id').references(() => dietaryRestrictions.id).notNull(),
  severity: varchar('severity', { length: 20 }).default('strict'), // strict, prefer, avoid
});
```

### Recipes & Ingredients

```typescript
// schema/recipes.ts
import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  instructions: jsonb('instructions').$type<string[]>().notNull(),
  prepTime: integer('prep_time').notNull(), // In minutes
  cookTime: integer('cook_time').notNull(), // In minutes
  servings: integer('servings').default(4).notNull(),
  difficulty: difficultyEnum('difficulty').default('medium'),
  cuisine: varchar('cuisine', { length: 100 }),
  imageUrl: varchar('image_url', { length: 500 }),
  sourceUrl: varchar('source_url', { length: 500 }),
  sourceAttribution: varchar('source_attribution', { length: 255 }),
  nutritionData: jsonb('nutrition_data').$type<NutritionData>(),
  tags: jsonb('tags').$type<string[]>().default([]),
  isPublic: boolean('is_public').default(true),
  authorId: uuid('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('recipes_name_idx').on(table.name),
  cuisineIdx: index('recipes_cuisine_idx').on(table.cuisine),
}));

// Type for nutrition data
interface NutritionData {
  calories: number;
  protein: number;      // grams
  carbohydrates: number;// grams
  fat: number;          // grams
  fiber: number;        // grams
  sodium: number;       // mg
  sugar: number;        // grams
}

export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  standardUnit: varchar('standard_unit', { length: 50 }).notNull(),
  aliases: jsonb('aliases').$type<string[]>().default([]),
  isCommon: boolean('is_common').default(false),
}, (table) => ({
  nameIdx: index('ingredients_name_idx').on(table.name),
  categoryIdx: index('ingredients_category_idx').on(table.category),
}));

// Categories: produce, dairy, meat, seafood, pantry, frozen, bakery, beverages, spices

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'cascade' }).notNull(),
  ingredientId: uuid('ingredient_id').references(() => ingredients.id).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  notes: varchar('notes', { length: 255 }), // e.g., "finely chopped", "optional"
  isOptional: boolean('is_optional').default(false),
});
```

### Meal Plans

```typescript
// schema/meal-plans.ts
import { pgTable, uuid, varchar, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const mealPlanStatusEnum = pgEnum('meal_plan_status', ['draft', 'active', 'completed', 'archived']);
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack']);

export const mealPlans = pgTable('meal_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: mealPlanStatusEnum('status').default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  mealPlanId: uuid('meal_plan_id').references(() => mealPlans.id, { onDelete: 'cascade' }).notNull(),
  recipeId: uuid('recipe_id').references(() => recipes.id).notNull(),
  date: date('date').notNull(),
  mealType: mealTypeEnum('meal_type').notNull(),
  servings: integer('servings').notNull(),
  notes: varchar('notes', { length: 255 }),
});
```

### Supermarkets & Products

```typescript
// schema/products.ts
import { pgTable, uuid, varchar, integer, decimal, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const supermarkets = pgTable('supermarkets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  domain: varchar('domain', { length: 255 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  color: varchar('color', { length: 7 }), // Hex color for UI
  scrapingEnabled: boolean('scraping_enabled').default(true),
  scrapingConfig: jsonb('scraping_config').$type<ScrapingConfig>(),
  lastScrapedAt: timestamp('last_scraped_at'),
  productCount: integer('product_count').default(0),
});

interface ScrapingConfig {
  baseUrl: string;
  searchEndpoint: string;
  rateLimit: number;        // requests per minute
  selectors: {
    productList: string;
    productName: string;
    productPrice: string;
    productImage: string;
    productUnit: string;
  };
  headers?: Record<string, string>;
}

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  supermarketId: uuid('supermarket_id').references(() => supermarkets.id).notNull(),
  externalId: varchar('external_id', { length: 100 }).notNull(), // Supermarket's product ID
  name: varchar('name', { length: 500 }).notNull(),
  brand: varchar('brand', { length: 255 }),
  description: text('description'),
  price: integer('price').notNull(), // In cents
  pricePerUnit: integer('price_per_unit'), // In cents
  unit: varchar('unit', { length: 50 }), // e.g., "kg", "L", "unit"
  unitQuantity: decimal('unit_quantity', { precision: 10, scale: 3 }),
  category: varchar('category', { length: 100 }),
  subcategory: varchar('subcategory', { length: 100 }),
  imageUrl: varchar('image_url', { length: 500 }),
  productUrl: varchar('product_url', { length: 500 }),
  availability: varchar('availability', { length: 50 }).default('in_stock'),
  isOrganic: boolean('is_organic').default(false),
  isOnSale: boolean('is_on_sale').default(false),
  salePrice: integer('sale_price'), // In cents
  saleEndDate: timestamp('sale_end_date'),
  nutritionData: jsonb('nutrition_data').$type<ProductNutrition>(),
  lastScrapedAt: timestamp('last_scraped_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  supermarketExternalIdx: index('products_supermarket_external_idx').on(table.supermarketId, table.externalId),
  nameIdx: index('products_name_idx').on(table.name),
  categoryIdx: index('products_category_idx').on(table.category),
  priceIdx: index('products_price_idx').on(table.price),
}));

interface ProductNutrition {
  servingSize: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  allergens?: string[];
}

export const priceHistory = pgTable('price_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  price: integer('price').notNull(), // In cents
  pricePerUnit: integer('price_per_unit'),
  currency: varchar('currency', { length: 3 }).default('EUR'),
  isPromotion: boolean('is_promotion').default(false),
  promotionName: varchar('promotion_name', { length: 255 }),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => ({
  productDateIdx: index('price_history_product_date_idx').on(table.productId, table.recordedAt),
}));
```

### Product Matching

```typescript
// schema/matching.ts
import { pgTable, uuid, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const productMatches = pgTable('product_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').references(() => ingredients.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  matchType: varchar('match_type', { length: 50 }).notNull(), // exact, fuzzy, category, ml
  userApproved: boolean('user_approved'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ingredientProductIdx: index('product_matches_ingredient_product_idx').on(table.ingredientId, table.productId),
  confidenceIdx: index('product_matches_confidence_idx').on(table.confidence),
}));

// User-specific product preferences (for learning)
export const userProductPreferences = pgTable('user_product_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ingredientId: uuid('ingredient_id').references(() => ingredients.id).notNull(),
  preferredProductId: uuid('preferred_product_id').references(() => products.id),
  excludedProductIds: jsonb('excluded_product_ids').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Grocery Lists

```typescript
// schema/grocery-lists.ts
import { pgTable, uuid, varchar, integer, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const groceryListStatusEnum = pgEnum('grocery_list_status', ['draft', 'ready', 'shopping', 'completed']);

export const groceryLists = pgTable('grocery_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mealPlanId: uuid('meal_plan_id').references(() => mealPlans.id),
  name: varchar('name', { length: 255 }).notNull(),
  status: groceryListStatusEnum('status').default('draft'),
  totalPrice: integer('total_price'), // In cents
  selectedSupermarket: uuid('selected_supermarket').references(() => supermarkets.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('grocery_lists_user_idx').on(table.userId),
  statusIdx: index('grocery_lists_status_idx').on(table.status),
}));

export const groceryListItems = pgTable('grocery_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  groceryListId: uuid('grocery_list_id').references(() => groceryLists.id, { onDelete: 'cascade' }).notNull(),
  ingredientId: uuid('ingredient_id').references(() => ingredients.id),
  productId: uuid('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  price: integer('price'), // In cents
  isChecked: boolean('is_checked').default(false),
  isSubstituted: boolean('is_substituted').default(false),
  originalProductId: uuid('original_product_id').references(() => products.id),
  notes: varchar('notes', { length: 255 }),
  sortOrder: integer('sort_order').default(0),
});

// Cart state for browser extension
export const extensionCarts = pgTable('extension_carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groceryListId: uuid('grocery_list_id').references(() => groceryLists.id).notNull(),
  supermarketId: uuid('supermarket_id').references(() => supermarkets.id).notNull(),
  status: varchar('status', { length: 50 }).default('pending'), // pending, in_progress, completed, failed
  itemsAdded: integer('items_added').default(0),
  itemsFailed: integer('items_failed').default(0),
  errorLog: jsonb('error_log').$type<CartError[]>().default([]),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

interface CartError {
  productId: string;
  productName: string;
  error: string;
  timestamp: string;
}
```

---

## Indexes & Performance

### Full-Text Search (PostgreSQL)

```sql
-- Recipe search
CREATE INDEX recipes_search_idx ON recipes
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

-- Product search
CREATE INDEX products_search_idx ON products
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(brand, '')));

-- Ingredient search with aliases
CREATE INDEX ingredients_search_idx ON ingredients
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(array_to_string(aliases::text[], ' '), '')));
```

### Fuzzy Matching (pg_trgm)

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fuzzy matching
CREATE INDEX products_name_trgm_idx ON products USING gin(name gin_trgm_ops);
CREATE INDEX ingredients_name_trgm_idx ON ingredients USING gin(name gin_trgm_ops);

-- Example fuzzy search query
SELECT * FROM products
WHERE similarity(name, 'tomate') > 0.3
ORDER BY similarity(name, 'tomate') DESC
LIMIT 10;
```

---

## Data Validation (Zod Schemas)

```typescript
// validation/schemas.ts
import { z } from 'zod';

export const userProfileSchema = z.object({
  householdSize: z.number().min(1).max(20),
  budgetWeekly: z.number().min(0).optional(),
  preferredStores: z.array(z.string().uuid()).max(10),
  cookingSkill: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  maxPrepTime: z.number().min(5).max(480).optional(),
  cuisinePreferences: z.array(z.string()).max(20),
  dislikedIngredients: z.array(z.string()).max(100),
});

export const mealPlanEntrySchema = z.object({
  recipeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  servings: z.number().min(1).max(50),
  notes: z.string().max(255).optional(),
});

export const groceryListItemSchema = z.object({
  ingredientId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  unit: z.string().max(50),
  displayName: z.string().max(255),
  notes: z.string().max(255).optional(),
});

export const productSearchSchema = z.object({
  query: z.string().min(2).max(255),
  supermarketId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  inStock: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});
```

---

## Caching Strategy (Redis)

```typescript
// cache/keys.ts
export const cacheKeys = {
  // Product cache (per supermarket)
  product: (productId: string) => `product:${productId}`,
  productsBySupermarket: (supermarketId: string, page: number) =>
    `products:supermarket:${supermarketId}:page:${page}`,

  // Price cache
  currentPrice: (productId: string) => `price:current:${productId}`,
  priceHistory: (productId: string) => `price:history:${productId}`,

  // Search results
  searchResults: (query: string, supermarketId: string) =>
    `search:${supermarketId}:${Buffer.from(query).toString('base64')}`,

  // User data
  userProfile: (userId: string) => `user:profile:${userId}`,
  userGroceryList: (userId: string) => `user:grocery:${userId}`,

  // Matching cache
  ingredientMatches: (ingredientId: string, supermarketId: string) =>
    `match:${ingredientId}:${supermarketId}`,
};

// TTL configuration (in seconds)
export const cacheTTL = {
  product: 6 * 60 * 60,        // 6 hours
  price: 60 * 60,              // 1 hour
  searchResults: 15 * 60,      // 15 minutes
  userProfile: 24 * 60 * 60,   // 24 hours
  groceryList: 60 * 60,        // 1 hour
  ingredientMatch: 12 * 60 * 60, // 12 hours
};
```

---

## Migration Strategy

### Initial Migration

```typescript
// drizzle/migrations/0001_initial.ts
import { sql } from 'drizzle-orm';

export async function up(db) {
  // Enable extensions
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

  // Create enums
  await db.execute(sql`
    CREATE TYPE cooking_skill AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
    CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
    CREATE TYPE meal_plan_status AS ENUM ('draft', 'active', 'completed', 'archived');
    CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
    CREATE TYPE grocery_list_status AS ENUM ('draft', 'ready', 'shopping', 'completed');
  `);

  // Create tables (Drizzle handles this automatically)
}

export async function down(db) {
  // Drop in reverse order
}
```

### Seeding Data

```typescript
// drizzle/seed.ts
import { db } from './client';
import { dietaryRestrictions, supermarkets, ingredients } from './schema';

const restrictions = [
  { name: 'Vegan', description: 'No animal products', icon: 'leaf' },
  { name: 'Vegetarian', description: 'No meat or fish', icon: 'carrot' },
  { name: 'Gluten-Free', description: 'No gluten-containing grains', icon: 'wheat-off' },
  { name: 'Dairy-Free', description: 'No milk or dairy products', icon: 'milk-off' },
  { name: 'Nut-Free', description: 'No tree nuts or peanuts', icon: 'nut-off' },
  { name: 'Halal', description: 'Prepared according to Islamic law', icon: 'star' },
  { name: 'Kosher', description: 'Prepared according to Jewish law', icon: 'badge-check' },
  { name: 'Low-Sodium', description: 'Limited sodium intake', icon: 'salt' },
  { name: 'Low-Carb', description: 'Limited carbohydrate intake', icon: 'bread-slice' },
  { name: 'Keto', description: 'Very low carb, high fat', icon: 'flame' },
];

const spanishSupermarkets = [
  { name: 'Mercadona', slug: 'mercadona', domain: 'mercadona.es', color: '#00A650' },
  { name: 'Carrefour', slug: 'carrefour', domain: 'carrefour.es', color: '#004E9F' },
  { name: 'Dia', slug: 'dia', domain: 'dia.es', color: '#E30613' },
  { name: 'Alcampo', slug: 'alcampo', domain: 'alcampo.es', color: '#E4002B' },
  { name: 'Lidl', slug: 'lidl', domain: 'lidl.es', color: '#0050AA' },
  { name: 'Eroski', slug: 'eroski', domain: 'eroski.es', color: '#FF6600' },
];

export async function seed() {
  await db.insert(dietaryRestrictions).values(restrictions);
  await db.insert(supermarkets).values(spanishSupermarkets);
  // ... more seeding
}
```

---

## Data Retention & Cleanup

| Data Type | Retention | Cleanup Strategy |
|-----------|-----------|-----------------|
| Price history | 1 year | Monthly archival to cold storage |
| User sessions | 30 days | Daily cleanup job |
| Scraping logs | 7 days | Daily cleanup |
| Completed grocery lists | 90 days | Weekly cleanup |
| Product matches (unapproved) | 30 days | Daily cleanup |
| Extension cart state | 7 days | Daily cleanup |
