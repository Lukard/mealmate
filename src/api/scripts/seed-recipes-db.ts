/**
 * Seed Script - Spanish Recipes Database
 * Seeds the database with Spanish recipes, ingredients, and their relationships
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { recipes, ingredients, recipeIngredients, type NutritionData } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { spanishRecipes, type RecipeSeed, type RecipeIngredientSeed } from './seed-recipes.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

// Map of ingredient names to their IDs (cached after first insert/fetch)
const ingredientCache = new Map<string, string>();

async function getOrCreateIngredient(
  db: ReturnType<typeof drizzle>,
  ingredient: RecipeIngredientSeed
): Promise<string> {
  const cacheKey = ingredient.name.toLowerCase();

  // Check cache first
  if (ingredientCache.has(cacheKey)) {
    return ingredientCache.get(cacheKey)!;
  }

  // Check if ingredient exists in database
  const existing = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.name, ingredient.name))
    .limit(1);

  if (existing.length > 0) {
    ingredientCache.set(cacheKey, existing[0].id);
    return existing[0].id;
  }

  // Create new ingredient
  const [newIngredient] = await db
    .insert(ingredients)
    .values({
      name: ingredient.name,
      category: ingredient.category,
      standardUnit: ingredient.unit,
      aliases: [ingredient.nameEs],
      isCommon: true,
    })
    .returning({ id: ingredients.id });

  ingredientCache.set(cacheKey, newIngredient.id);
  return newIngredient.id;
}

async function seedRecipe(
  db: ReturnType<typeof drizzle>,
  recipe: RecipeSeed
): Promise<void> {
  // Check if recipe already exists
  const existing = await db
    .select()
    .from(recipes)
    .where(eq(recipes.name, recipe.name))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  - ${recipe.name}: Already exists, skipping`);
    return;
  }

  // Map difficulty
  const difficultyMap: Record<string, 'easy' | 'medium' | 'hard'> = {
    'easy': 'easy',
    'medium': 'medium',
    'hard': 'hard',
  };

  // Create nutrition data
  const nutritionData: NutritionData = {
    calories: recipe.calories,
    protein: Math.round(recipe.calories * 0.15 / 4), // Estimated 15% protein
    carbohydrates: Math.round(recipe.calories * 0.5 / 4), // Estimated 50% carbs
    fat: Math.round(recipe.calories * 0.35 / 9), // Estimated 35% fat
  };

  // Insert recipe
  const [newRecipe] = await db
    .insert(recipes)
    .values({
      name: recipe.name,
      description: recipe.description,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      difficulty: difficultyMap[recipe.difficulty] || 'medium',
      cuisine: recipe.cuisine,
      nutritionData,
      tags: recipe.tags,
      isPublic: true,
    })
    .returning({ id: recipes.id });

  // Insert recipe ingredients
  for (const ingredient of recipe.ingredients) {
    const ingredientId = await getOrCreateIngredient(db, ingredient);

    await db.insert(recipeIngredients).values({
      recipeId: newRecipe.id,
      ingredientId,
      quantity: ingredient.quantity.toString(),
      unit: ingredient.unit,
      isOptional: false,
    });
  }

  console.log(`  - ${recipe.name}: Inserted with ${recipe.ingredients.length} ingredients`);
}

async function seedRecipes(): Promise<void> {
  console.log('Starting recipe seeding...');
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Total recipes to seed: ${spanishRecipes.length}`);

  const queryClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(queryClient);

  try {
    let seeded = 0;
    let skipped = 0;

    for (const recipe of spanishRecipes) {
      try {
        const existing = await db
          .select()
          .from(recipes)
          .where(eq(recipes.name, recipe.name))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await seedRecipe(db, recipe);
        seeded++;
      } catch (error) {
        console.error(`  - ${recipe.name}: Error - ${(error as Error).message}`);
      }
    }

    console.log('\nRecipe seeding completed!');
    console.log(`  Seeded: ${seeded}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Ingredients cached: ${ingredientCache.size}`);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

seedRecipes();
