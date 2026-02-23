/**
 * RAG Validator - Post-processing validation for meal plan responses
 * Ensures generated plans reference real products
 */

import { ProductMatch } from './product-embeddings';

interface MealData {
  name: string;
  prepTime: number;
  description: string;
  ingredients: string[];
  instructions: string[];
}

interface DayData {
  date: string;
  meals: Record<string, MealData>;
}

interface MealPlanResponse {
  mealPlan: {
    explanation: string;
    days: DayData[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  matchedProducts: number;
  totalIngredients: number;
  matchRate: number;
}

/**
 * Validate that a meal plan response uses real products
 */
export function validateMealPlan(
  response: MealPlanResponse,
  availableProducts: ProductMatch[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let matchedProducts = 0;
  let totalIngredients = 0;

  const productNames = new Set(
    availableProducts.map(p => p.name.toLowerCase())
  );

  if (!response?.mealPlan?.days?.length) {
    errors.push('No days in meal plan');
    return { valid: false, errors, warnings, matchedProducts: 0, totalIngredients: 0, matchRate: 0 };
  }

  for (const day of response.mealPlan.days) {
    if (!day.date) errors.push('Missing date in day');
    
    for (const [mealType, meal] of Object.entries(day.meals || {})) {
      if (!meal?.name) {
        errors.push(`Missing name for ${mealType} on ${day.date}`);
        continue;
      }
      if (!meal.ingredients?.length) {
        warnings.push(`No ingredients for ${meal.name}`);
        continue;
      }

      for (const ingredient of meal.ingredients) {
        totalIngredients++;
        const ingLower = ingredient.toLowerCase();
        
        // Check if any product name is contained in the ingredient
        const hasMatch = availableProducts.some(p => {
          const pName = p.name.toLowerCase();
          return ingLower.includes(pName) || pName.includes(ingLower.replace(/^\d+\s*(g|ml|kg|l|ud)?\s*/i, '').trim());
        });
        
        if (hasMatch) {
          matchedProducts++;
        }
        // Don't warn for basic staples
        else if (!isBasicStaple(ingredient)) {
          warnings.push(`Unmatched ingredient: "${ingredient}" in ${meal.name}`);
        }
      }
    }
  }

  const matchRate = totalIngredients > 0 ? matchedProducts / totalIngredients : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    matchedProducts,
    totalIngredients,
    matchRate,
  };
}

/**
 * Check if ingredient is a basic staple (salt, water, etc.)
 */
function isBasicStaple(ingredient: string): boolean {
  const staples = [
    'sal', 'agua', 'pimienta', 'aceite de oliva', 'vinagre',
    'ajo', 'perejil', 'orégano', 'comino', 'pimentón',
    'laurel', 'tomillo', 'romero', 'canela', 'azúcar',
  ];
  const lower = ingredient.toLowerCase();
  return staples.some(s => lower.includes(s));
}

/**
 * Parse and clean the LLM JSON response
 */
export function parseMealPlanResponse(raw: string): MealPlanResponse | null {
  try {
    // Try direct parse
    return JSON.parse(raw);
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        return null;
      }
    }
    // Try finding JSON object
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
