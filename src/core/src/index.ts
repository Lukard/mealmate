/**
 * Meal Automation Core
 * Core business logic and services
 */

// Re-export services
export { MealPlannerService } from './services/meal-planner.service.js';
export {
  ProductMatcherService,
  createProductMatcher,
  type ProductMatcherConfig,
  type MatchStrategy,
  type ExtendedMatchResult,
  type ScoredProductMatch
} from './services/product-matcher.service.js';
export { GroceryOptimizerService } from './services/grocery-optimizer.service.js';
export { RecipeService } from './services/recipe.service.js';
export { GroceryListService } from './services/grocery-list.service.js';

// Re-export Spanish ingredients utilities
export {
  getSpanishTranslations,
  getAllSearchTerms,
  normalizeIngredientName,
  extractKeyTerms,
  calculateStringSimilarity,
  areStringsSimilar,
  getSpanishCategories,
  INGREDIENT_MAP,
  CATEGORY_TRANSLATIONS,
  PREPARATION_TERMS,
  QUANTITY_TERMS
} from './utils/spanish-ingredients.js';

// Re-export types from shared
export type {
  IMealPlanner,
  IProductMatcher,
  IGroceryOptimizer,
  MealPlan,
  MealPlanPreferences,
  MealPlanGenerationResult,
  Recipe,
  GroceryList,
  GroceryItem,
  ProductMatch,
  OptimizationResult
} from '@meal-automation/shared';
