/**
 * Shared Utilities
 * Common utility functions used across the application
 */

import type {
  CurrencyCode,
  GroceryItem,
  Ingredient,
  IngredientCategory,
  MeasurementUnit,
  RecipeReference
} from '../types/index.js';

/**
 * Unit conversion utilities
 */

/** Conversion factors to grams for weight units */
const WEIGHT_TO_GRAMS: Partial<Record<MeasurementUnit, number>> = {
  g: 1,
  kg: 1000
};

/** Conversion factors to milliliters for volume units */
const VOLUME_TO_ML: Partial<Record<MeasurementUnit, number>> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240
};

/**
 * Check if a unit is a weight unit
 */
export function isWeightUnit(unit: MeasurementUnit): boolean {
  return unit in WEIGHT_TO_GRAMS;
}

/**
 * Check if a unit is a volume unit
 */
export function isVolumeUnit(unit: MeasurementUnit): boolean {
  return unit in VOLUME_TO_ML;
}

/**
 * Convert a quantity from one unit to another (if compatible)
 */
export function convertUnit(
  quantity: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit
): number | null {
  // Same unit, no conversion needed
  if (fromUnit === toUnit) {
    return quantity;
  }

  // Weight conversion
  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    const grams = quantity * (WEIGHT_TO_GRAMS[fromUnit] ?? 1);
    return grams / (WEIGHT_TO_GRAMS[toUnit] ?? 1);
  }

  // Volume conversion
  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const ml = quantity * (VOLUME_TO_ML[fromUnit] ?? 1);
    return ml / (VOLUME_TO_ML[toUnit] ?? 1);
  }

  // Incompatible units
  return null;
}

/**
 * Format a quantity with its unit for display
 */
export function formatQuantity(quantity: number, unit: MeasurementUnit): string {
  // Round to reasonable precision
  const roundedQuantity = Math.round(quantity * 100) / 100;

  // Handle special cases
  if (unit === 'to_taste') {
    return 'to taste';
  }

  if (unit === 'pinch') {
    return roundedQuantity === 1 ? '1 pinch' : `${roundedQuantity} pinches`;
  }

  if (unit === 'piece') {
    return roundedQuantity === 1 ? '1 piece' : `${roundedQuantity} pieces`;
  }

  return `${roundedQuantity} ${unit}`;
}

/**
 * Price utilities
 */

/**
 * Format price from cents to display string with currency symbol
 */
export function formatPrice(priceCents: number, currency: CurrencyCode): string {
  const currencySymbols: Record<CurrencyCode, string> = {
    EUR: '\u20AC',
    GBP: '\u00A3',
    USD: '$'
  };

  const symbol = currencySymbols[currency];
  const price = (priceCents / 100).toFixed(2);

  return `${symbol}${price}`;
}

/**
 * Calculate price per unit for comparison
 */
export function calculatePricePerUnit(
  priceCents: number,
  packageSize: number,
  packageUnit: MeasurementUnit
): { priceCents: number; unit: MeasurementUnit } | null {
  // Normalize to standard comparison units
  if (isWeightUnit(packageUnit)) {
    const grams = convertUnit(packageSize, packageUnit, 'g');
    if (grams !== null && grams > 0) {
      return {
        priceCents: Math.round((priceCents / grams) * 1000), // per kg
        unit: 'kg'
      };
    }
  }

  if (isVolumeUnit(packageUnit)) {
    const ml = convertUnit(packageSize, packageUnit, 'ml');
    if (ml !== null && ml > 0) {
      return {
        priceCents: Math.round((priceCents / ml) * 1000), // per L
        unit: 'l'
      };
    }
  }

  // For pieces, just return price per piece
  if (packageUnit === 'piece' && packageSize > 0) {
    return {
      priceCents: Math.round(priceCents / packageSize),
      unit: 'piece'
    };
  }

  return null;
}

/**
 * Ingredient aggregation utilities
 */

/**
 * Aggregate ingredients from multiple recipes into grocery items
 */
export function aggregateIngredients(
  ingredients: readonly { ingredient: Ingredient; recipeName: string; recipeId: string }[]
): GroceryItem[] {
  const aggregated = new Map<string, GroceryItem>();

  for (const { ingredient, recipeName, recipeId } of ingredients) {
    const key = normalizeIngredientKey(ingredient.name, ingredient.unit);
    const existing = aggregated.get(key);

    const reference: RecipeReference = {
      recipeId,
      recipeName,
      quantity: ingredient.quantity,
      unit: ingredient.unit
    };

    if (existing) {
      // Aggregate with existing item
      const convertedQuantity = convertUnit(
        ingredient.quantity,
        ingredient.unit,
        existing.unit
      );

      aggregated.set(key, {
        ...existing,
        totalQuantity: existing.totalQuantity + (convertedQuantity ?? ingredient.quantity),
        recipeReferences: [...existing.recipeReferences, reference]
      });
    } else {
      // Create new grocery item
      aggregated.set(key, {
        id: generateId(),
        ingredientName: ingredient.name,
        totalQuantity: ingredient.quantity,
        unit: ingredient.unit,
        category: ingredient.category ?? 'other',
        checked: false,
        matches: [],
        recipeReferences: [reference]
      });
    }
  }

  return Array.from(aggregated.values());
}

/**
 * Normalize ingredient name for matching
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Create a key for aggregating ingredients
 */
function normalizeIngredientKey(name: string, unit: MeasurementUnit): string {
  const normalizedName = normalizeIngredientName(name);

  // Group compatible units together
  let unitGroup: string;
  if (isWeightUnit(unit)) {
    unitGroup = 'weight';
  } else if (isVolumeUnit(unit)) {
    unitGroup = 'volume';
  } else {
    unitGroup = unit;
  }

  return `${normalizedName}:${unitGroup}`;
}

/**
 * ID generation utilities
 */

/**
 * Generate a random ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Category utilities
 */

/**
 * Infer ingredient category from name
 */
export function inferCategory(ingredientName: string): IngredientCategory {
  const name = ingredientName.toLowerCase();

  // Produce
  const produce = [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'tomato', 'potato', 'onion',
    'garlic', 'carrot', 'celery', 'lettuce', 'spinach', 'broccoli', 'pepper',
    'cucumber', 'avocado', 'mushroom', 'zucchini', 'eggplant', 'cabbage',
    'kale', 'berry', 'grape', 'melon', 'mango', 'pineapple', 'peach', 'pear'
  ];
  if (produce.some(p => name.includes(p))) return 'produce';

  // Dairy
  const dairy = [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'margarine',
    'sour cream', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar'
  ];
  if (dairy.some(d => name.includes(d))) return 'dairy';

  // Meat
  const meat = [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage',
    'ham', 'steak', 'ground', 'mince', 'veal', 'duck'
  ];
  if (meat.some(m => name.includes(m))) return 'meat';

  // Seafood
  const seafood = [
    'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'crab', 'lobster',
    'mussel', 'clam', 'oyster', 'cod', 'tilapia', 'halibut', 'sardine'
  ];
  if (seafood.some(s => name.includes(s))) return 'seafood';

  // Bakery
  const bakery = ['bread', 'roll', 'baguette', 'croissant', 'muffin', 'bagel'];
  if (bakery.some(b => name.includes(b))) return 'bakery';

  // Spices
  const spices = [
    'salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme',
    'rosemary', 'cinnamon', 'nutmeg', 'ginger', 'turmeric', 'curry',
    'chili', 'cayenne', 'coriander', 'parsley', 'mint', 'dill'
  ];
  if (spices.some(s => name.includes(s))) return 'spices';

  // Condiments
  const condiments = [
    'sauce', 'ketchup', 'mustard', 'mayonnaise', 'vinegar', 'oil',
    'dressing', 'soy sauce', 'hot sauce', 'worcestershire'
  ];
  if (condiments.some(c => name.includes(c))) return 'condiments';

  // Canned
  const canned = ['canned', 'can of', 'tinned', 'jarred'];
  if (canned.some(c => name.includes(c))) return 'canned';

  // Dry goods
  const dryGoods = [
    'rice', 'pasta', 'flour', 'sugar', 'oat', 'cereal', 'noodle',
    'bean', 'lentil', 'quinoa', 'couscous', 'grain'
  ];
  if (dryGoods.some(d => name.includes(d))) return 'dry_goods';

  // Frozen
  const frozen = ['frozen', 'ice cream'];
  if (frozen.some(f => name.includes(f))) return 'frozen';

  // Beverages
  const beverages = ['juice', 'water', 'soda', 'coffee', 'tea', 'wine', 'beer'];
  if (beverages.some(b => name.includes(b))) return 'beverages';

  return 'other';
}

/**
 * Date utilities
 */

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * Validation utilities
 */

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

/**
 * Check if a value is a valid URL
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
