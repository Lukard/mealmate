/**
 * Mock Factory Functions
 * Functions to create test data for different entity types
 */

import type {
  Product,
  ProductId,
  MealPlan,
  MealPlanId,
  Recipe,
  RecipeId,
  UserPreferences,
  UserId,
  GroceryItem,
  IngredientCategory,
  MeasurementUnit,
  SupermarketId,
  DietaryRestrictions
} from '@meal-automation/shared';
import { createProductId, createUserId, createSupermarketId } from '@meal-automation/shared';

let idCounter = 0;

function nextId(): string {
  return `test-${++idCounter}`;
}

/**
 * Create a mock product
 */
export function createMockProduct(overrides: Partial<Product> = {}): Product {
  const id = createProductId(overrides.id?.toString() ?? nextId());

  return {
    id,
    name: 'Test Product',
    brand: 'Test Brand',
    description: 'A test product for testing',
    price: {
      currentPriceCents: 299,
      currency: 'EUR',
      includesVat: true,
      pricePerUnit: {
        priceCents: 299,
        unit: 'piece',
        display: '2.99/ud'
      }
    },
    category: 'pantry_staples',
    packageSize: {
      value: 1,
      unit: 'piece',
      display: '1 ud'
    },
    productUrl: `https://test.com/products/${id}`,
    sku: `SKU-${id}`,
    supermarketId: createSupermarketId('mercadona'),
    inStock: true,
    isOrganic: false,
    isStoreBrand: false,
    lastUpdated: new Date(),
    ...overrides
  } as Product;
}

/**
 * Create a mock recipe
 */
export function createMockRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: (overrides.id ?? nextId()) as RecipeId,
    name: 'Test Recipe',
    description: 'A delicious test recipe',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    totalTimeMinutes: 45,
    difficulty: 'easy',
    cuisine: 'Spanish',
    mealType: 'lunch',
    ingredients: [
      {
        name: 'Test Ingredient',
        quantity: 100,
        unit: 'gram',
        category: 'pantry_staples',
        notes: 'Fresh if possible',
        optional: false
      }
    ],
    instructions: [
      { stepNumber: 1, instruction: 'Prepare ingredients', durationMinutes: 5 },
      { stepNumber: 2, instruction: 'Cook everything', durationMinutes: 25 }
    ],
    tags: ['test', 'easy'],
    imageUrl: 'https://test.com/recipe.jpg',
    sourceUrl: 'https://test.com/recipe',
    dietaryInfo: {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      dairyFree: false,
      nutFree: true
    },
    nutritionPerServing: {
      calories: 350,
      proteinG: 20,
      carbsG: 40,
      fatG: 12
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Recipe;
}

/**
 * Create mock dietary restrictions
 */
export function createMockDietaryRestrictions(overrides: Partial<DietaryRestrictions> = {}): DietaryRestrictions {
  return {
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
    custom: [],
    ...overrides
  };
}

/**
 * Create mock user preferences
 */
export function createMockUserPreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    userId: createUserId(overrides.userId?.toString() ?? nextId()),
    preferredSupermarkets: [createSupermarketId('mercadona')],
    dietaryRestrictions: createMockDietaryRestrictions(),
    defaultServings: 4,
    weeklyBudgetCents: 10000,
    preferredCuisines: ['Spanish', 'Mediterranean'],
    dislikedIngredients: [],
    cookingSkillLevel: 'intermediate',
    maxPrepTimeMinutes: 60,
    uiPreferences: {
      theme: 'system',
      language: 'es',
      currencyDisplay: 'symbol',
      dateFormat: 'DD/MM/YYYY',
      measurementSystem: 'metric'
    },
    notificationPreferences: {
      priceDropAlerts: true,
      mealReminders: true,
      shoppingReminders: true,
      weeklyPlanSuggestions: true
    },
    ...overrides
  } as UserPreferences;
}

/**
 * Create a mock grocery item
 */
export function createMockGroceryItem(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return {
    id: overrides.id ?? nextId(),
    ingredientName: 'Test Ingredient',
    totalQuantity: 500,
    unit: 'gram',
    category: 'pantry_staples',
    checked: false,
    matches: [],
    recipeReferences: [
      {
        recipeId: 'recipe-1',
        recipeName: 'Test Recipe',
        quantity: 500,
        unit: 'gram'
      }
    ],
    ...overrides
  } as GroceryItem;
}

/**
 * Create a batch of mock products
 */
export function createMockProducts(count: number, categoryOrOverrides?: IngredientCategory | Partial<Product>[]): Product[] {
  const products: Product[] = [];

  for (let i = 0; i < count; i++) {
    const overrides = Array.isArray(categoryOrOverrides)
      ? categoryOrOverrides[i] ?? {}
      : { category: categoryOrOverrides ?? 'pantry_staples' };

    products.push(createMockProduct({
      name: `Product ${i + 1}`,
      price: {
        currentPriceCents: 100 + i * 50,
        currency: 'EUR',
        includesVat: true
      },
      ...overrides
    }));
  }

  return products;
}

/**
 * Reset the ID counter (useful between test suites)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}
