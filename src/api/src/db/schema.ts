/**
 * Database Schema - Drizzle ORM
 * Complete database schema for meal automation system
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Enums
// ============================================

export const cookingSkillEnum = pgEnum('cooking_skill', [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);

export const mealPlanStatusEnum = pgEnum('meal_plan_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const mealTypeEnum = pgEnum('meal_type', [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]);

export const groceryListStatusEnum = pgEnum('grocery_list_status', [
  'draft',
  'ready',
  'shopping',
  'completed',
]);

export const productAvailabilityEnum = pgEnum('product_availability', [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'unknown',
]);

// ============================================
// Users & Authentication
// ============================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
    passwordHash: varchar('password_hash', { length: 255 }),
    emailVerified: boolean('email_verified').default(false),
    googleId: varchar('google_id', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

// ============================================
// User Profiles & Preferences
// ============================================

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
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

export const userRestrictions = pgTable('user_restrictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  restrictionId: uuid('restriction_id')
    .references(() => dietaryRestrictions.id)
    .notNull(),
  severity: varchar('severity', { length: 20 }).default('strict'), // strict, prefer, avoid
});

// ============================================
// Recipes & Ingredients
// ============================================

export interface NutritionData {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
}

export const recipes = pgTable(
  'recipes',
  {
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
    rating: decimal('rating', { precision: 3, scale: 2 }),
    reviewCount: integer('review_count').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('recipes_name_idx').on(table.name),
    cuisineIdx: index('recipes_cuisine_idx').on(table.cuisine),
    authorIdx: index('recipes_author_idx').on(table.authorId),
  })
);

export const ingredients = pgTable(
  'ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    standardUnit: varchar('standard_unit', { length: 50 }).notNull(),
    aliases: jsonb('aliases').$type<string[]>().default([]),
    isCommon: boolean('is_common').default(false),
  },
  (table) => ({
    nameIdx: index('ingredients_name_idx').on(table.name),
    categoryIdx: index('ingredients_category_idx').on(table.category),
  })
);

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .references(() => recipes.id, { onDelete: 'cascade' })
    .notNull(),
  ingredientId: uuid('ingredient_id')
    .references(() => ingredients.id)
    .notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  notes: varchar('notes', { length: 255 }),
  isOptional: boolean('is_optional').default(false),
});

// ============================================
// Meal Plans
// ============================================

export const mealPlans = pgTable(
  'meal_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    status: mealPlanStatusEnum('status').default('draft'),
    estimatedCost: integer('estimated_cost'), // In cents
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('meal_plans_user_idx').on(table.userId),
    statusIdx: index('meal_plans_status_idx').on(table.status),
  })
);

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  mealPlanId: uuid('meal_plan_id')
    .references(() => mealPlans.id, { onDelete: 'cascade' })
    .notNull(),
  recipeId: uuid('recipe_id')
    .references(() => recipes.id)
    .notNull(),
  date: date('date').notNull(),
  mealType: mealTypeEnum('meal_type').notNull(),
  servings: integer('servings').notNull(),
  notes: varchar('notes', { length: 255 }),
});

// ============================================
// Supermarkets & Products
// ============================================

export interface ScrapingConfig {
  baseUrl: string;
  searchEndpoint: string;
  rateLimit: number;
  selectors: {
    productList: string;
    productName: string;
    productPrice: string;
    productImage: string;
    productUnit: string;
  };
  headers?: Record<string, string>;
}

export interface ProductNutrition {
  servingSize: string;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  allergens?: string[];
}

export const supermarkets = pgTable('supermarkets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  domain: varchar('domain', { length: 255 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  color: varchar('color', { length: 7 }), // Hex color
  scrapingEnabled: boolean('scraping_enabled').default(true),
  scrapingConfig: jsonb('scraping_config').$type<ScrapingConfig>(),
  lastScrapedAt: timestamp('last_scraped_at'),
  productCount: integer('product_count').default(0),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supermarketId: uuid('supermarket_id')
      .references(() => supermarkets.id)
      .notNull(),
    externalId: varchar('external_id', { length: 100 }).notNull(),
    name: varchar('name', { length: 500 }).notNull(),
    brand: varchar('brand', { length: 255 }),
    description: text('description'),
    price: integer('price').notNull(), // In cents
    pricePerUnit: integer('price_per_unit'),
    unit: varchar('unit', { length: 50 }),
    unitQuantity: decimal('unit_quantity', { precision: 10, scale: 3 }),
    category: varchar('category', { length: 100 }),
    subcategory: varchar('subcategory', { length: 100 }),
    imageUrl: varchar('image_url', { length: 500 }),
    productUrl: varchar('product_url', { length: 500 }),
    availability: productAvailabilityEnum('availability').default('in_stock'),
    isOrganic: boolean('is_organic').default(false),
    isOnSale: boolean('is_on_sale').default(false),
    salePrice: integer('sale_price'),
    saleEndDate: timestamp('sale_end_date'),
    nutritionData: jsonb('nutrition_data').$type<ProductNutrition>(),
    lastScrapedAt: timestamp('last_scraped_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    supermarketExternalIdx: index('products_supermarket_external_idx').on(
      table.supermarketId,
      table.externalId
    ),
    nameIdx: index('products_name_idx').on(table.name),
    categoryIdx: index('products_category_idx').on(table.category),
    priceIdx: index('products_price_idx').on(table.price),
  })
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    price: integer('price').notNull(),
    pricePerUnit: integer('price_per_unit'),
    currency: varchar('currency', { length: 3 }).default('EUR'),
    isPromotion: boolean('is_promotion').default(false),
    promotionName: varchar('promotion_name', { length: 255 }),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => ({
    productDateIdx: index('price_history_product_date_idx').on(
      table.productId,
      table.recordedAt
    ),
  })
);

// ============================================
// Product Matching
// ============================================

export const productMatches = pgTable(
  'product_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ingredientId: uuid('ingredient_id')
      .references(() => ingredients.id)
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(),
    matchType: varchar('match_type', { length: 50 }).notNull(),
    userApproved: boolean('user_approved'),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    ingredientProductIdx: index('product_matches_ingredient_product_idx').on(
      table.ingredientId,
      table.productId
    ),
    confidenceIdx: index('product_matches_confidence_idx').on(table.confidence),
  })
);

// ============================================
// Grocery Lists
// ============================================

export const groceryLists = pgTable(
  'grocery_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mealPlanId: uuid('meal_plan_id').references(() => mealPlans.id),
    name: varchar('name', { length: 255 }).notNull(),
    status: groceryListStatusEnum('status').default('draft'),
    totalPrice: integer('total_price'),
    selectedSupermarket: uuid('selected_supermarket').references(
      () => supermarkets.id
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('grocery_lists_user_idx').on(table.userId),
    statusIdx: index('grocery_lists_status_idx').on(table.status),
  })
);

export const groceryListItems = pgTable('grocery_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  groceryListId: uuid('grocery_list_id')
    .references(() => groceryLists.id, { onDelete: 'cascade' })
    .notNull(),
  ingredientId: uuid('ingredient_id').references(() => ingredients.id),
  productId: uuid('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  price: integer('price'),
  isChecked: boolean('is_checked').default(false),
  isSubstituted: boolean('is_substituted').default(false),
  originalProductId: uuid('original_product_id').references(() => products.id),
  notes: varchar('notes', { length: 255 }),
  sortOrder: integer('sort_order').default(0),
});

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  restrictions: many(userRestrictions),
  recipes: many(recipes),
  mealPlans: many(mealPlans),
  groceryLists: many(groceryLists),
  refreshTokens: many(refreshTokens),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  author: one(users, {
    fields: [recipes.authorId],
    references: [users.id],
  }),
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(
  recipeIngredients,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipeIngredients.recipeId],
      references: [recipes.id],
    }),
    ingredient: one(ingredients, {
      fields: [recipeIngredients.ingredientId],
      references: [ingredients.id],
    }),
  })
);

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [mealPlans.userId],
    references: [users.id],
  }),
  entries: many(mealPlanEntries),
  groceryLists: many(groceryLists),
}));

export const mealPlanEntriesRelations = relations(
  mealPlanEntries,
  ({ one }) => ({
    mealPlan: one(mealPlans, {
      fields: [mealPlanEntries.mealPlanId],
      references: [mealPlans.id],
    }),
    recipe: one(recipes, {
      fields: [mealPlanEntries.recipeId],
      references: [recipes.id],
    }),
  })
);

export const groceryListsRelations = relations(
  groceryLists,
  ({ one, many }) => ({
    user: one(users, {
      fields: [groceryLists.userId],
      references: [users.id],
    }),
    mealPlan: one(mealPlans, {
      fields: [groceryLists.mealPlanId],
      references: [mealPlans.id],
    }),
    supermarket: one(supermarkets, {
      fields: [groceryLists.selectedSupermarket],
      references: [supermarkets.id],
    }),
    items: many(groceryListItems),
  })
);

export const groceryListItemsRelations = relations(
  groceryListItems,
  ({ one }) => ({
    groceryList: one(groceryLists, {
      fields: [groceryListItems.groceryListId],
      references: [groceryLists.id],
    }),
    ingredient: one(ingredients, {
      fields: [groceryListItems.ingredientId],
      references: [ingredients.id],
    }),
    product: one(products, {
      fields: [groceryListItems.productId],
      references: [products.id],
    }),
    originalProduct: one(products, {
      fields: [groceryListItems.originalProductId],
      references: [products.id],
    }),
  })
);

export const productsRelations = relations(products, ({ one, many }) => ({
  supermarket: one(supermarkets, {
    fields: [products.supermarketId],
    references: [supermarkets.id],
  }),
  priceHistory: many(priceHistory),
  matches: many(productMatches),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  product: one(products, {
    fields: [priceHistory.productId],
    references: [products.id],
  }),
}));
