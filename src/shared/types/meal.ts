/**
 * Meal Planning Types
 * Core types for meal plans, recipes, and ingredients
 */

import type { DietaryRestrictions, NutritionalInfo } from './index.js';

/** Unique identifier for meals */
export type MealId = string & { readonly __brand: 'MealId' };

/** Unique identifier for recipes */
export type RecipeId = string & { readonly __brand: 'RecipeId' };

/** Unique identifier for meal plans */
export type MealPlanId = string & { readonly __brand: 'MealPlanId' };

/** Time of day for meals */
export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Days of the week */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Cooking difficulty levels */
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

/** Unit of measurement for ingredients */
export type MeasurementUnit =
  | 'g' | 'kg'
  | 'ml' | 'l'
  | 'tsp' | 'tbsp'
  | 'cup' | 'piece'
  | 'slice' | 'bunch'
  | 'pinch' | 'to_taste';

/**
 * Represents a single ingredient in a recipe
 */
export interface Ingredient {
  /** Ingredient name as it appears in recipes */
  readonly name: string;

  /** Amount needed */
  readonly quantity: number;

  /** Unit of measurement */
  readonly unit: MeasurementUnit;

  /** Whether this ingredient is optional */
  readonly optional: boolean;

  /** Alternative ingredients that can be used instead */
  readonly substitutes?: readonly string[];

  /** Preparation notes (e.g., "diced", "minced") */
  readonly preparation?: string;

  /** Category for grouping (e.g., "produce", "dairy") */
  readonly category?: IngredientCategory;
}

/** Categories for organizing ingredients */
export type IngredientCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'frozen'
  | 'canned'
  | 'dry_goods'
  | 'condiments'
  | 'spices'
  | 'beverages'
  | 'other';

/**
 * A complete recipe with all details
 */
export interface Recipe {
  /** Unique identifier */
  readonly id: RecipeId;

  /** Recipe name */
  readonly name: string;

  /** Brief description */
  readonly description: string;

  /** List of ingredients with quantities */
  readonly ingredients: readonly Ingredient[];

  /** Step-by-step cooking instructions */
  readonly instructions: readonly string[];

  /** Preparation time in minutes */
  readonly prepTimeMinutes: number;

  /** Cooking time in minutes */
  readonly cookTimeMinutes: number;

  /** Number of servings this recipe makes */
  readonly servings: number;

  /** Difficulty level */
  readonly difficulty: DifficultyLevel;

  /** Nutritional information per serving */
  readonly nutrition?: NutritionalInfo;

  /** Dietary tags (vegetarian, vegan, gluten-free, etc.) */
  readonly dietaryTags: readonly string[];

  /** Cuisine type (Italian, Mexican, etc.) */
  readonly cuisine?: string;

  /** URL to recipe image */
  readonly imageUrl?: string;

  /** Source URL if imported from external site */
  readonly sourceUrl?: string;

  /** User rating (1-5) */
  readonly rating?: number;

  /** Tags for categorization */
  readonly tags: readonly string[];

  /** When the recipe was created/added */
  readonly createdAt: Date;

  /** When the recipe was last modified */
  readonly updatedAt: Date;
}

/**
 * A single meal in a meal plan
 */
export interface Meal {
  /** Unique identifier */
  readonly id: MealId;

  /** Reference to the recipe */
  readonly recipeId: RecipeId;

  /** When this meal is scheduled */
  readonly mealTime: MealTime;

  /** Day of the week */
  readonly dayOfWeek: DayOfWeek;

  /** Number of servings to prepare (may differ from recipe default) */
  readonly servings: number;

  /** Any notes for this specific meal */
  readonly notes?: string;

  /** Whether this meal has been prepared/completed */
  readonly completed: boolean;
}

/**
 * A weekly meal plan
 */
export interface MealPlan {
  /** Unique identifier */
  readonly id: MealPlanId;

  /** User-defined name for this plan */
  readonly name: string;

  /** Start date of the meal plan week */
  readonly weekStartDate: Date;

  /** End date of the meal plan week */
  readonly weekEndDate: Date;

  /** All meals in this plan */
  readonly meals: readonly Meal[];

  /** Total estimated cost for all ingredients */
  readonly estimatedCost?: number;

  /** Total estimated prep time in minutes */
  readonly totalPrepTimeMinutes: number;

  /** Whether this plan is currently active */
  readonly isActive: boolean;

  /** When the plan was created */
  readonly createdAt: Date;

  /** When the plan was last modified */
  readonly updatedAt: Date;
}

/**
 * Meal plan generation preferences
 */
export interface MealPlanPreferences {
  /** Dietary restrictions to consider */
  readonly dietaryRestrictions: DietaryRestrictions;

  /** Target budget for the week */
  readonly weeklyBudget?: number;

  /** Maximum prep time per meal in minutes */
  readonly maxPrepTimeMinutes?: number;

  /** Number of servings per meal */
  readonly servingsPerMeal: number;

  /** Which meal times to plan for */
  readonly mealTimes: readonly MealTime[];

  /** Preferred cuisines */
  readonly preferredCuisines?: readonly string[];

  /** Ingredients to avoid (allergies, dislikes) */
  readonly avoidIngredients?: readonly string[];

  /** Preferred difficulty levels */
  readonly difficultyPreference?: readonly DifficultyLevel[];

  /** Whether to minimize food waste by reusing ingredients */
  readonly minimizeWaste: boolean;

  /** Whether to batch similar prep tasks */
  readonly enableBatchCooking: boolean;
}

/**
 * Result of meal plan generation
 */
export interface MealPlanGenerationResult {
  /** The generated meal plan */
  readonly mealPlan: MealPlan;

  /** Consolidated grocery list */
  readonly groceryList: GroceryListSummary;

  /** Warnings or notes about the generated plan */
  readonly warnings: readonly string[];

  /** Suggestions for optimization */
  readonly suggestions: readonly string[];
}

/**
 * Summary of grocery list for a meal plan
 */
export interface GroceryListSummary {
  /** Total number of unique items */
  readonly itemCount: number;

  /** Estimated total cost */
  readonly estimatedCost: number;

  /** Items grouped by category */
  readonly itemsByCategory: Record<IngredientCategory, number>;
}

/**
 * Helper functions for creating branded IDs
 */
export function createMealId(id: string): MealId {
  return id as MealId;
}

export function createRecipeId(id: string): RecipeId {
  return id as RecipeId;
}

export function createMealPlanId(id: string): MealPlanId {
  return id as MealPlanId;
}
