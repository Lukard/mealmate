/**
 * Recipe Service
 * Manages recipes and recipe search/filtering
 */

import type {
  Recipe,
  RecipeId,
  DietaryRestrictions,
  DifficultyLevel,
  Ingredient
} from '@meal-automation/shared';

/**
 * Criteria for searching recipes
 */
export interface RecipeSearchCriteria {
  /** Filter by dietary restrictions */
  readonly dietaryRestrictions?: DietaryRestrictions;

  /** Maximum prep time in minutes */
  readonly maxPrepTime?: number;

  /** Filter by difficulty levels */
  readonly difficulty?: readonly DifficultyLevel[];

  /** Filter by cuisines */
  readonly cuisines?: readonly string[];

  /** Ingredients to exclude */
  readonly excludeIngredients?: readonly string[];

  /** Text search query */
  readonly searchQuery?: string;

  /** Maximum results to return */
  readonly limit?: number;
}

/**
 * Service for managing recipes
 */
export class RecipeService {
  /** In-memory recipe storage (would be database in production) */
  private readonly recipes = new Map<RecipeId, Recipe>();

  /**
   * Add a recipe to the service
   */
  addRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  /**
   * Add multiple recipes
   */
  addRecipes(recipes: readonly Recipe[]): void {
    for (const recipe of recipes) {
      this.addRecipe(recipe);
    }
  }

  /**
   * Get a recipe by ID
   */
  async getRecipe(id: RecipeId): Promise<Recipe | null> {
    return this.recipes.get(id) ?? null;
  }

  /**
   * Get all recipes
   */
  async getAllRecipes(): Promise<readonly Recipe[]> {
    return Array.from(this.recipes.values());
  }

  /**
   * Find recipes matching criteria
   */
  async findRecipes(criteria: RecipeSearchCriteria): Promise<readonly Recipe[]> {
    let results = Array.from(this.recipes.values());

    // Filter by dietary restrictions
    if (criteria.dietaryRestrictions) {
      results = results.filter(recipe =>
        this.matchesDietaryRestrictions(recipe, criteria.dietaryRestrictions!)
      );
    }

    // Filter by max prep time
    if (criteria.maxPrepTime !== undefined) {
      results = results.filter(recipe =>
        recipe.prepTimeMinutes + recipe.cookTimeMinutes <= criteria.maxPrepTime!
      );
    }

    // Filter by difficulty
    if (criteria.difficulty && criteria.difficulty.length > 0) {
      results = results.filter(recipe =>
        criteria.difficulty!.includes(recipe.difficulty)
      );
    }

    // Filter by cuisine
    if (criteria.cuisines && criteria.cuisines.length > 0) {
      const cuisinesLower = criteria.cuisines.map(c => c.toLowerCase());
      results = results.filter(recipe =>
        recipe.cuisine && cuisinesLower.includes(recipe.cuisine.toLowerCase())
      );
    }

    // Filter by excluded ingredients
    if (criteria.excludeIngredients && criteria.excludeIngredients.length > 0) {
      const excluded = criteria.excludeIngredients.map(i => i.toLowerCase());
      results = results.filter(recipe =>
        !recipe.ingredients.some(ing =>
          excluded.some(ex => ing.name.toLowerCase().includes(ex))
        )
      );
    }

    // Text search
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase();
      results = results.filter(recipe =>
        recipe.name.toLowerCase().includes(query) ||
        recipe.description.toLowerCase().includes(query) ||
        recipe.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply limit
    if (criteria.limit !== undefined && criteria.limit > 0) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Find recipes that use given ingredients
   */
  async findByIngredients(
    availableIngredients: readonly string[]
  ): Promise<readonly Recipe[]> {
    const normalizedAvailable = availableIngredients.map(i => i.toLowerCase());

    const recipesWithScore = Array.from(this.recipes.values()).map(recipe => {
      const recipeIngredients = recipe.ingredients.map(i => i.name.toLowerCase());

      // Count how many available ingredients are used
      const matchingCount = recipeIngredients.filter(ri =>
        normalizedAvailable.some(ai => ri.includes(ai) || ai.includes(ri))
      ).length;

      // Calculate match score (percentage of recipe ingredients we have)
      const score = recipeIngredients.length > 0
        ? matchingCount / recipeIngredients.length
        : 0;

      return { recipe, score, matchingCount };
    });

    // Sort by score descending, then by matching count
    recipesWithScore.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.matchingCount - a.matchingCount;
    });

    // Return recipes with at least 30% ingredient match
    return recipesWithScore
      .filter(r => r.score >= 0.3)
      .map(r => r.recipe);
  }

  /**
   * Get similar recipes to a given recipe
   */
  async getSimilarRecipes(recipeId: RecipeId, limit: number = 5): Promise<readonly Recipe[]> {
    const sourceRecipe = await this.getRecipe(recipeId);
    if (!sourceRecipe) {
      return [];
    }

    const otherRecipes = Array.from(this.recipes.values())
      .filter(r => r.id !== recipeId);

    const recipesWithScore = otherRecipes.map(recipe => {
      let score = 0;

      // Same cuisine bonus
      if (recipe.cuisine && recipe.cuisine === sourceRecipe.cuisine) {
        score += 3;
      }

      // Similar difficulty
      if (recipe.difficulty === sourceRecipe.difficulty) {
        score += 1;
      }

      // Shared tags
      const sharedTags = recipe.tags.filter(t => sourceRecipe.tags.includes(t));
      score += sharedTags.length;

      // Shared dietary tags
      const sharedDietary = recipe.dietaryTags.filter(t =>
        sourceRecipe.dietaryTags.includes(t)
      );
      score += sharedDietary.length * 2;

      // Similar prep time (within 15 minutes)
      const timeDiff = Math.abs(
        (recipe.prepTimeMinutes + recipe.cookTimeMinutes) -
        (sourceRecipe.prepTimeMinutes + sourceRecipe.cookTimeMinutes)
      );
      if (timeDiff <= 15) {
        score += 1;
      }

      return { recipe, score };
    });

    recipesWithScore.sort((a, b) => b.score - a.score);

    return recipesWithScore.slice(0, limit).map(r => r.recipe);
  }

  /**
   * Check if a recipe matches dietary restrictions
   */
  private matchesDietaryRestrictions(
    recipe: Recipe,
    restrictions: DietaryRestrictions
  ): boolean {
    const tags = recipe.dietaryTags.map(t => t.toLowerCase());

    if (restrictions.vegetarian && !tags.includes('vegetarian') && !tags.includes('vegan')) {
      return false;
    }

    if (restrictions.vegan && !tags.includes('vegan')) {
      return false;
    }

    if (restrictions.glutenFree && !tags.includes('gluten-free') && !tags.includes('gluten free')) {
      return false;
    }

    if (restrictions.dairyFree && !tags.includes('dairy-free') && !tags.includes('dairy free')) {
      return false;
    }

    if (restrictions.nutFree && !tags.includes('nut-free') && !tags.includes('nut free')) {
      return false;
    }

    if (restrictions.halal && !tags.includes('halal')) {
      return false;
    }

    if (restrictions.kosher && !tags.includes('kosher')) {
      return false;
    }

    if (restrictions.lowCarb && !tags.includes('low-carb') && !tags.includes('keto')) {
      return false;
    }

    if (restrictions.keto && !tags.includes('keto')) {
      return false;
    }

    if (restrictions.paleo && !tags.includes('paleo')) {
      return false;
    }

    return true;
  }

  /**
   * Get recipe statistics
   */
  async getStats(): Promise<RecipeStats> {
    const recipes = Array.from(this.recipes.values());

    const cuisines = new Set<string>();
    const tags = new Set<string>();
    let totalPrepTime = 0;

    for (const recipe of recipes) {
      if (recipe.cuisine) {
        cuisines.add(recipe.cuisine);
      }
      recipe.tags.forEach(t => tags.add(t));
      recipe.dietaryTags.forEach(t => tags.add(t));
      totalPrepTime += recipe.prepTimeMinutes + recipe.cookTimeMinutes;
    }

    return {
      totalRecipes: recipes.length,
      cuisineCount: cuisines.size,
      tagCount: tags.size,
      averagePrepTimeMinutes: recipes.length > 0
        ? Math.round(totalPrepTime / recipes.length)
        : 0,
      difficultyDistribution: {
        easy: recipes.filter(r => r.difficulty === 'easy').length,
        medium: recipes.filter(r => r.difficulty === 'medium').length,
        hard: recipes.filter(r => r.difficulty === 'hard').length,
        expert: recipes.filter(r => r.difficulty === 'expert').length
      }
    };
  }
}

/**
 * Recipe collection statistics
 */
export interface RecipeStats {
  readonly totalRecipes: number;
  readonly cuisineCount: number;
  readonly tagCount: number;
  readonly averagePrepTimeMinutes: number;
  readonly difficultyDistribution: Record<DifficultyLevel, number>;
}
