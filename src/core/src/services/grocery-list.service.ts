/**
 * Grocery List Service
 * Manages grocery lists and ingredient aggregation
 */

import type {
  GroceryList,
  GroceryListId,
  GroceryItem,
  GroceryListSummary,
  Meal,
  Recipe,
  RecipeId,
  MealPlanId,
  IngredientCategory,
  RecipeReference
} from '@meal-automation/shared';

import {
  aggregateIngredients,
  generateId,
  inferCategory
} from '@meal-automation/shared/utils';

/**
 * Service for managing grocery lists
 */
export class GroceryListService {
  /** In-memory storage for grocery lists */
  private readonly groceryLists = new Map<GroceryListId, GroceryList>();

  /**
   * Generate a grocery list from meals and recipes
   */
  async generateFromMeals(
    meals: readonly Meal[],
    recipes: Map<RecipeId, Recipe>,
    mealPlanId: MealPlanId
  ): Promise<GroceryList> {
    // Collect all ingredients from all meals
    const ingredientSources: Array<{
      ingredient: Recipe['ingredients'][number];
      recipeName: string;
      recipeId: string;
    }> = [];

    for (const meal of meals) {
      const recipe = recipes.get(meal.recipeId);
      if (!recipe) continue;

      // Scale ingredients based on servings
      const scaleFactor = meal.servings / recipe.servings;

      for (const ingredient of recipe.ingredients) {
        ingredientSources.push({
          ingredient: {
            ...ingredient,
            quantity: ingredient.quantity * scaleFactor,
            category: ingredient.category ?? inferCategory(ingredient.name)
          },
          recipeName: recipe.name,
          recipeId: recipe.id
        });
      }
    }

    // Aggregate ingredients
    const items = aggregateIngredients(ingredientSources);

    // Create the grocery list
    const groceryList: GroceryList = {
      id: this.generateGroceryListId(),
      mealPlanId,
      items,
      totalEstimatedCostCents: 0, // Will be updated when products are matched
      totalItems: items.length,
      checkedItems: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store and return
    this.groceryLists.set(groceryList.id, groceryList);
    return groceryList;
  }

  /**
   * Generate a summary of a grocery list for display
   */
  async generateSummary(
    meals: readonly Meal[],
    recipes: Map<RecipeId, Recipe>
  ): Promise<GroceryListSummary> {
    const itemsByCategory: Record<IngredientCategory, number> = {
      produce: 0,
      dairy: 0,
      meat: 0,
      seafood: 0,
      bakery: 0,
      frozen: 0,
      canned: 0,
      dry_goods: 0,
      condiments: 0,
      spices: 0,
      beverages: 0,
      other: 0
    };

    const uniqueIngredients = new Set<string>();

    for (const meal of meals) {
      const recipe = recipes.get(meal.recipeId);
      if (!recipe) continue;

      for (const ingredient of recipe.ingredients) {
        const normalizedName = ingredient.name.toLowerCase();

        if (!uniqueIngredients.has(normalizedName)) {
          uniqueIngredients.add(normalizedName);
          const category = ingredient.category ?? inferCategory(ingredient.name);
          itemsByCategory[category]++;
        }
      }
    }

    return {
      itemCount: uniqueIngredients.size,
      estimatedCost: 0, // Will be calculated when matched with products
      itemsByCategory
    };
  }

  /**
   * Get a grocery list by ID
   */
  async getGroceryList(id: GroceryListId): Promise<GroceryList | null> {
    return this.groceryLists.get(id) ?? null;
  }

  /**
   * Update a grocery list
   */
  async updateGroceryList(list: GroceryList): Promise<GroceryList> {
    const updatedList: GroceryList = {
      ...list,
      checkedItems: list.items.filter(i => i.checked).length,
      updatedAt: new Date()
    };
    this.groceryLists.set(updatedList.id, updatedList);
    return updatedList;
  }

  /**
   * Toggle an item's checked status
   */
  async toggleItemChecked(
    listId: GroceryListId,
    itemId: string
  ): Promise<GroceryList | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    const updatedItems = list.items.map(item =>
      item.id === itemId
        ? { ...item, checked: !item.checked }
        : item
    );

    return this.updateGroceryList({
      ...list,
      items: updatedItems
    });
  }

  /**
   * Add a custom item to the list
   */
  async addCustomItem(
    listId: GroceryListId,
    item: Omit<GroceryItem, 'id' | 'matches' | 'recipeReferences'>
  ): Promise<GroceryList | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    const newItem: GroceryItem = {
      ...item,
      id: generateId(),
      matches: [],
      recipeReferences: []
    };

    return this.updateGroceryList({
      ...list,
      items: [...list.items, newItem],
      totalItems: list.totalItems + 1
    });
  }

  /**
   * Remove an item from the list
   */
  async removeItem(
    listId: GroceryListId,
    itemId: string
  ): Promise<GroceryList | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    const updatedItems = list.items.filter(item => item.id !== itemId);

    return this.updateGroceryList({
      ...list,
      items: updatedItems,
      totalItems: updatedItems.length
    });
  }

  /**
   * Get items grouped by category
   */
  async getItemsByCategory(
    listId: GroceryListId
  ): Promise<Map<IngredientCategory, readonly GroceryItem[]> | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    const byCategory = new Map<IngredientCategory, GroceryItem[]>();

    for (const item of list.items) {
      const category = item.category;
      const existing = byCategory.get(category) ?? [];
      byCategory.set(category, [...existing, item]);
    }

    return byCategory;
  }

  /**
   * Get all unchecked items
   */
  async getUncheckedItems(listId: GroceryListId): Promise<readonly GroceryItem[] | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    return list.items.filter(item => !item.checked);
  }

  /**
   * Clear all checked items from the list
   */
  async clearCheckedItems(listId: GroceryListId): Promise<GroceryList | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    const uncheckedItems = list.items.filter(item => !item.checked);

    return this.updateGroceryList({
      ...list,
      items: uncheckedItems,
      totalItems: uncheckedItems.length,
      checkedItems: 0
    });
  }

  /**
   * Get shopping progress
   */
  async getProgress(listId: GroceryListId): Promise<ShoppingProgress | null> {
    const list = await this.getGroceryList(listId);
    if (!list) return null;

    const checkedItems = list.items.filter(i => i.checked);
    const totalCostChecked = checkedItems.reduce((sum, item) =>
      sum + (item.selectedMatch?.totalCostCents ?? 0), 0
    );

    return {
      totalItems: list.totalItems,
      checkedItems: list.checkedItems,
      percentComplete: list.totalItems > 0
        ? Math.round((list.checkedItems / list.totalItems) * 100)
        : 0,
      estimatedTotalCostCents: list.totalEstimatedCostCents,
      spentSoFarCents: totalCostChecked
    };
  }

  /**
   * Generate a unique grocery list ID
   */
  private generateGroceryListId(): GroceryListId {
    return `gl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as GroceryListId;
  }
}

/**
 * Shopping progress information
 */
export interface ShoppingProgress {
  readonly totalItems: number;
  readonly checkedItems: number;
  readonly percentComplete: number;
  readonly estimatedTotalCostCents: number;
  readonly spentSoFarCents: number;
}
