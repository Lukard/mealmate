/**
 * Meal Automation - Shared Types
 * Central export for all type definitions
 */

// Re-export all types from domain modules
export * from './meal.js';
export * from './product.js';
export * from './supermarket.js';

/**
 * User preferences and dietary restrictions
 */

/** Dietary restriction flags */
export interface DietaryRestrictions {
  readonly vegetarian: boolean;
  readonly vegan: boolean;
  readonly glutenFree: boolean;
  readonly dairyFree: boolean;
  readonly nutFree: boolean;
  readonly halal: boolean;
  readonly kosher: boolean;
  readonly lowSodium: boolean;
  readonly lowSugar: boolean;
  readonly lowCarb: boolean;
  readonly keto: boolean;
  readonly paleo: boolean;
  /** Custom restrictions as free text */
  readonly custom: readonly string[];
}

/** Default dietary restrictions (no restrictions) */
export const DEFAULT_DIETARY_RESTRICTIONS: DietaryRestrictions = {
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  dairyFree: false,
  nutFree: false,
  halal: false,
  kosher: false,
  lowSodium: false,
  lowSugar: false,
  lowCarb: false,
  keto: false,
  paleo: false,
  custom: []
} as const;

/**
 * Nutritional information per serving
 */
export interface NutritionalInfo {
  /** Calories (kcal) */
  readonly calories: number;
  /** Protein in grams */
  readonly proteinG: number;
  /** Carbohydrates in grams */
  readonly carbsG: number;
  /** Fat in grams */
  readonly fatG: number;
  /** Fiber in grams */
  readonly fiberG?: number;
  /** Sodium in milligrams */
  readonly sodiumMg?: number;
  /** Sugar in grams */
  readonly sugarG?: number;
  /** Saturated fat in grams */
  readonly saturatedFatG?: number;
}

/**
 * Grocery list types
 */

import type {
  IngredientCategory,
  MealPlanId,
  MeasurementUnit
} from './meal.js';
import type { ProductMatch } from './product.js';
import type { SupermarketId } from './supermarket.js';

/** Unique identifier for grocery lists */
export type GroceryListId = string & { readonly __brand: 'GroceryListId' };

/**
 * A single item in the grocery list
 */
export interface GroceryItem {
  /** Unique identifier */
  readonly id: string;

  /** Original ingredient name from recipes */
  readonly ingredientName: string;

  /** Aggregated quantity needed */
  readonly totalQuantity: number;

  /** Unit of measurement */
  readonly unit: MeasurementUnit;

  /** Category for organizing the list */
  readonly category: IngredientCategory;

  /** Whether this item has been checked off */
  readonly checked: boolean;

  /** Product matches from supermarkets */
  readonly matches: readonly ProductMatch[];

  /** Selected product match (user's choice) */
  readonly selectedMatch?: ProductMatch;

  /** Notes for this item */
  readonly notes?: string;

  /** Which recipes this ingredient is for */
  readonly recipeReferences: readonly RecipeReference[];
}

/**
 * Reference to a recipe that needs this ingredient
 */
export interface RecipeReference {
  readonly recipeId: string;
  readonly recipeName: string;
  readonly quantity: number;
  readonly unit: MeasurementUnit;
}

/**
 * A complete grocery list
 */
export interface GroceryList {
  /** Unique identifier */
  readonly id: GroceryListId;

  /** Associated meal plan */
  readonly mealPlanId: MealPlanId;

  /** All items in the list */
  readonly items: readonly GroceryItem[];

  /** Selected supermarket for shopping */
  readonly selectedSupermarketId?: SupermarketId;

  /** Total estimated cost in cents */
  readonly totalEstimatedCostCents: number;

  /** Total items count */
  readonly totalItems: number;

  /** Checked off items count */
  readonly checkedItems: number;

  /** When the list was created */
  readonly createdAt: Date;

  /** When the list was last modified */
  readonly updatedAt: Date;
}

/**
 * User preferences
 */

/** Unique identifier for users */
export type UserId = string & { readonly __brand: 'UserId' };

/**
 * User preferences for the application
 */
export interface UserPreferences {
  /** User identifier */
  readonly userId: UserId;

  /** Preferred supermarkets (in order of preference) */
  readonly preferredSupermarkets: readonly SupermarketId[];

  /** Dietary restrictions */
  readonly dietaryRestrictions: DietaryRestrictions;

  /** Default number of servings */
  readonly defaultServings: number;

  /** Weekly budget in cents */
  readonly weeklyBudgetCents?: number;

  /** Preferred cuisines */
  readonly preferredCuisines: readonly string[];

  /** Disliked ingredients */
  readonly dislikedIngredients: readonly string[];

  /** Cooking skill level */
  readonly cookingSkillLevel: 'beginner' | 'intermediate' | 'advanced';

  /** Maximum prep time in minutes */
  readonly maxPrepTimeMinutes?: number;

  /** UI preferences */
  readonly uiPreferences: UIPreferences;

  /** Notification preferences */
  readonly notificationPreferences: NotificationPreferences;
}

/**
 * UI preferences
 */
export interface UIPreferences {
  /** Theme preference */
  readonly theme: 'light' | 'dark' | 'system';

  /** Language preference (ISO 639-1) */
  readonly language: string;

  /** Currency display preference */
  readonly currencyDisplay: 'symbol' | 'code';

  /** Date format preference */
  readonly dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

  /** Measurement system */
  readonly measurementSystem: 'metric' | 'imperial';
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** Enable price drop alerts */
  readonly priceDropAlerts: boolean;

  /** Enable meal reminder notifications */
  readonly mealReminders: boolean;

  /** Enable shopping list reminders */
  readonly shoppingReminders: boolean;

  /** Enable weekly meal plan suggestions */
  readonly weeklyPlanSuggestions: boolean;
}

/**
 * Core service interfaces
 */

import type {
  MealPlan,
  MealPlanGenerationResult,
  MealPlanPreferences,
  Recipe,
  RecipeId
} from './meal.js';

/**
 * Meal planning service interface
 */
export interface IMealPlanner {
  /**
   * Generate a meal plan based on preferences
   */
  generateMealPlan(preferences: MealPlanPreferences): Promise<MealPlanGenerationResult>;

  /**
   * Get a meal plan by ID
   */
  getMealPlan(id: MealPlanId): Promise<MealPlan | null>;

  /**
   * Update an existing meal plan
   */
  updateMealPlan(plan: MealPlan): Promise<MealPlan>;

  /**
   * Swap a meal in the plan with a different recipe
   */
  swapMeal(planId: MealPlanId, mealId: string, newRecipeId: RecipeId): Promise<MealPlan>;

  /**
   * Get recipe suggestions based on available ingredients
   */
  suggestRecipes(availableIngredients: readonly string[]): Promise<readonly Recipe[]>;
}

/**
 * Product matching service interface
 */
export interface IProductMatcher {
  /**
   * Find the best product matches for an ingredient
   */
  findMatches(
    ingredientName: string,
    quantity: number,
    unit: MeasurementUnit,
    supermarketId: SupermarketId
  ): Promise<readonly ProductMatch[]>;

  /**
   * Match all ingredients in a grocery list
   */
  matchGroceryList(
    items: readonly GroceryItem[],
    supermarketId: SupermarketId
  ): Promise<readonly GroceryItem[]>;

  /**
   * Get match confidence explanation
   */
  explainMatch(match: ProductMatch): string;
}

/**
 * Grocery optimization service interface
 */
export interface IGroceryOptimizer {
  /**
   * Optimize grocery list for best prices across supermarkets
   */
  optimizeForPrice(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<OptimizationResult>;

  /**
   * Optimize for availability (in-stock items)
   */
  optimizeForAvailability(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<OptimizationResult>;

  /**
   * Find the best single supermarket for the entire list
   */
  findBestSupermarket(
    items: readonly GroceryItem[],
    supermarketIds: readonly SupermarketId[]
  ): Promise<SupermarketComparison[]>;
}

/**
 * Result of grocery optimization
 */
export interface OptimizationResult {
  /** Optimized items with selected products */
  readonly items: readonly GroceryItem[];

  /** Total savings in cents compared to average */
  readonly savingsCents: number;

  /** Which supermarkets to shop at */
  readonly supermarkets: readonly SupermarketId[];

  /** Any items that couldn't be found */
  readonly unavailableItems: readonly string[];

  /** Optimization notes/suggestions */
  readonly suggestions: readonly string[];
}

/**
 * Comparison of supermarkets for a grocery list
 */
export interface SupermarketComparison {
  /** Supermarket ID */
  readonly supermarketId: SupermarketId;

  /** Total cost in cents */
  readonly totalCostCents: number;

  /** Number of items available */
  readonly itemsAvailable: number;

  /** Number of items unavailable */
  readonly itemsUnavailable: number;

  /** Whether delivery is available */
  readonly deliveryAvailable: boolean;

  /** Estimated delivery cost in cents */
  readonly deliveryCostCents?: number;
}

/**
 * Helper functions
 */

export function createGroceryListId(id: string): GroceryListId {
  return id as GroceryListId;
}

export function createUserId(id: string): UserId {
  return id as UserId;
}

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'userId' | 'weeklyBudgetCents' | 'maxPrepTimeMinutes'> = {
  preferredSupermarkets: [],
  dietaryRestrictions: DEFAULT_DIETARY_RESTRICTIONS,
  defaultServings: 2,
  preferredCuisines: [],
  dislikedIngredients: [],
  cookingSkillLevel: 'intermediate',
  uiPreferences: {
    theme: 'system',
    language: 'en',
    currencyDisplay: 'symbol',
    dateFormat: 'DD/MM/YYYY',
    measurementSystem: 'metric'
  },
  notificationPreferences: {
    priceDropAlerts: true,
    mealReminders: true,
    shoppingReminders: true,
    weeklyPlanSuggestions: true
  }
} as const;
