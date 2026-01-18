/**
 * Meal Planner Service
 * Handles meal plan generation, management, and optimization
 */

import type {
  IMealPlanner,
  MealPlan,
  MealPlanId,
  MealPlanGenerationResult,
  MealPlanPreferences,
  Recipe,
  RecipeId,
  Meal,
  MealTime,
  DayOfWeek,
  createMealPlanId,
  createMealId
} from '@meal-automation/shared';

import { RecipeService } from './recipe.service.js';
import { GroceryListService } from './grocery-list.service.js';

/**
 * Configuration for the meal planner service
 */
export interface MealPlannerConfig {
  /** Recipe service for fetching recipes */
  readonly recipeService: RecipeService;

  /** Grocery list service for generating shopping lists */
  readonly groceryListService: GroceryListService;

  /** Maximum recipes to consider when generating a plan */
  readonly maxRecipeCandidates: number;
}

/**
 * Service for generating and managing meal plans
 */
export class MealPlannerService implements IMealPlanner {
  private readonly recipeService: RecipeService;
  private readonly groceryListService: GroceryListService;
  private readonly maxRecipeCandidates: number;

  /** In-memory storage for meal plans (would be database in production) */
  private readonly mealPlans = new Map<MealPlanId, MealPlan>();

  constructor(config: MealPlannerConfig) {
    this.recipeService = config.recipeService;
    this.groceryListService = config.groceryListService;
    this.maxRecipeCandidates = config.maxRecipeCandidates;
  }

  /**
   * Generate a meal plan based on user preferences
   */
  async generateMealPlan(preferences: MealPlanPreferences): Promise<MealPlanGenerationResult> {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Get recipe candidates that match dietary restrictions
    const candidates = await this.recipeService.findRecipes({
      dietaryRestrictions: preferences.dietaryRestrictions,
      maxPrepTime: preferences.maxPrepTimeMinutes,
      difficulty: preferences.difficultyPreference,
      cuisines: preferences.preferredCuisines,
      excludeIngredients: preferences.avoidIngredients,
      limit: this.maxRecipeCandidates
    });

    if (candidates.length === 0) {
      throw new Error('No recipes found matching your preferences');
    }

    if (candidates.length < 7) {
      warnings.push(
        `Only ${candidates.length} recipes match your criteria. Consider relaxing some restrictions.`
      );
    }

    // Calculate how many meals we need
    const daysOfWeek: DayOfWeek[] = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ];
    const mealTimes = preferences.mealTimes;
    const totalMeals = daysOfWeek.length * mealTimes.length;

    // Generate meals with variety
    const meals = this.generateMealsWithVariety(
      candidates,
      daysOfWeek,
      mealTimes,
      preferences.servingsPerMeal
    );

    // Calculate total prep time
    const recipeMap = new Map(candidates.map(r => [r.id, r]));
    const totalPrepTime = meals.reduce((total, meal) => {
      const recipe = recipeMap.get(meal.recipeId);
      return total + (recipe?.prepTimeMinutes ?? 0) + (recipe?.cookTimeMinutes ?? 0);
    }, 0);

    // Create the meal plan
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const mealPlan: MealPlan = {
      id: this.generateMealPlanId(),
      name: `Week of ${this.formatDate(weekStart)}`,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      meals,
      totalPrepTimeMinutes: totalPrepTime,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    // Store the meal plan
    this.mealPlans.set(mealPlan.id, mealPlan);

    // Generate grocery list summary
    const groceryListSummary = await this.groceryListService.generateSummary(
      meals,
      recipeMap
    );

    // Add optimization suggestions
    if (preferences.minimizeWaste) {
      suggestions.push(
        'Consider batch cooking ingredients that appear in multiple recipes'
      );
    }

    if (totalPrepTime > 420) { // More than 7 hours total
      suggestions.push(
        'This plan has significant prep time. Consider meal prepping on weekends.'
      );
    }

    return {
      mealPlan,
      groceryList: groceryListSummary,
      warnings,
      suggestions
    };
  }

  /**
   * Get a meal plan by ID
   */
  async getMealPlan(id: MealPlanId): Promise<MealPlan | null> {
    return this.mealPlans.get(id) ?? null;
  }

  /**
   * Update an existing meal plan
   */
  async updateMealPlan(plan: MealPlan): Promise<MealPlan> {
    const updatedPlan: MealPlan = {
      ...plan,
      updatedAt: new Date()
    };
    this.mealPlans.set(updatedPlan.id, updatedPlan);
    return updatedPlan;
  }

  /**
   * Swap a meal in the plan with a different recipe
   */
  async swapMeal(
    planId: MealPlanId,
    mealId: string,
    newRecipeId: RecipeId
  ): Promise<MealPlan> {
    const plan = await this.getMealPlan(planId);
    if (!plan) {
      throw new Error(`Meal plan ${planId} not found`);
    }

    const newRecipe = await this.recipeService.getRecipe(newRecipeId);
    if (!newRecipe) {
      throw new Error(`Recipe ${newRecipeId} not found`);
    }

    const updatedMeals = plan.meals.map(meal =>
      meal.id === mealId
        ? { ...meal, recipeId: newRecipeId }
        : meal
    );

    return this.updateMealPlan({
      ...plan,
      meals: updatedMeals
    });
  }

  /**
   * Get recipe suggestions based on available ingredients
   */
  async suggestRecipes(availableIngredients: readonly string[]): Promise<readonly Recipe[]> {
    return this.recipeService.findByIngredients(availableIngredients);
  }

  /**
   * Generate meals ensuring variety across the week
   */
  private generateMealsWithVariety(
    recipes: readonly Recipe[],
    days: readonly DayOfWeek[],
    mealTimes: readonly MealTime[],
    servings: number
  ): Meal[] {
    const meals: Meal[] = [];
    const usedRecipeIds = new Set<RecipeId>();
    let recipeIndex = 0;

    for (const day of days) {
      for (const mealTime of mealTimes) {
        // Try to find a recipe we haven't used yet
        let recipe = recipes[recipeIndex % recipes.length];
        let attempts = 0;

        while (usedRecipeIds.has(recipe!.id) && attempts < recipes.length) {
          recipeIndex++;
          recipe = recipes[recipeIndex % recipes.length];
          attempts++;
        }

        const meal: Meal = {
          id: this.generateMealId(),
          recipeId: recipe!.id,
          mealTime,
          dayOfWeek: day,
          servings,
          completed: false
        };

        meals.push(meal);
        usedRecipeIds.add(recipe!.id);
        recipeIndex++;
      }
    }

    return meals;
  }

  /**
   * Generate a unique meal plan ID
   */
  private generateMealPlanId(): MealPlanId {
    return `mp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as MealPlanId;
  }

  /**
   * Generate a unique meal ID
   */
  private generateMealId(): string {
    return `meal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get the Monday of the current week
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}
