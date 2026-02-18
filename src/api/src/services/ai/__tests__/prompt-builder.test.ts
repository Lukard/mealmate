/**
 * Prompt Builder Tests
 */

import { describe, it, expect } from 'vitest';
import { PromptBuilder, ResponseParser } from '../prompt-builder.js';
import type { MealPlanGenerationContext, RecipeForAI } from '../types.js';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  const mockContext: MealPlanGenerationContext = {
    user: {
      userId: 'user-123',
      householdSize: 4,
      dietaryRestrictions: ['gluten_free'],
      skillLevel: 'intermediate',
      weeklyBudgetCents: 12000,
      maxPrepTimeMinutes: 45,
      cuisinePreferences: ['mediterranean', 'spanish'],
      dislikedIngredients: ['cilantro'],
    },
    temporal: {
      season: 'winter',
      weekStart: '2025-02-17',
      weekEnd: '2025-02-23',
      holidays: [],
      specialEvents: [],
    },
    behavioral: {
      recentRecipeIds: ['recipe-1', 'recipe-2'],
      favoriteRecipeIds: ['recipe-3'],
      completionRate: 0.75,
    },
    constraints: {
      mealsPerDay: ['lunch', 'dinner'],
      includeMealPrep: true,
      varietyLevel: 'high',
      budgetLimit: 12000,
    },
  };

  const mockRecipes: RecipeForAI[] = [
    {
      id: 'recipe-1',
      name: 'Paella Valenciana',
      description: 'Traditional Spanish rice dish',
      prepTime: 20,
      cookTime: 40,
      difficulty: 'medium',
      cuisine: 'Spanish',
      tags: ['main course', 'rice', 'seafood'],
      mainIngredients: ['rice', 'chicken', 'saffron', 'vegetables'],
    },
    {
      id: 'recipe-2',
      name: 'Gazpacho',
      description: 'Cold tomato soup',
      prepTime: 15,
      cookTime: 0,
      difficulty: 'easy',
      cuisine: 'Spanish',
      tags: ['soup', 'cold', 'healthy'],
      mainIngredients: ['tomatoes', 'cucumber', 'pepper', 'olive oil'],
    },
    {
      id: 'recipe-3',
      name: 'Tortilla Española',
      description: 'Spanish omelette',
      prepTime: 10,
      cookTime: 20,
      difficulty: 'medium',
      cuisine: 'Spanish',
      tags: ['eggs', 'vegetarian'],
      mainIngredients: ['eggs', 'potatoes', 'onion', 'olive oil'],
    },
  ];

  describe('buildMealPlanPrompt', () => {
    it('should return system and user prompts', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('userPrompt');
      expect(result.systemPrompt.length).toBeGreaterThan(100);
      expect(result.userPrompt.length).toBeGreaterThan(100);
    });

    it('should include user profile in prompt', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('4 personas');
      expect(result.userPrompt).toContain('intermedio');
      expect(result.userPrompt).toContain('120€');
      expect(result.userPrompt).toContain('45 minutos');
    });

    it('should include dietary restrictions', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('gluten_free');
      expect(result.userPrompt).toContain('CRÍTICAS');
    });

    it('should include cuisine preferences', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('mediterranean');
      expect(result.userPrompt).toContain('spanish');
    });

    it('should include temporal context', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('2025-02-17');
      expect(result.userPrompt).toContain('2025-02-23');
      expect(result.userPrompt).toContain('invierno');
    });

    it('should include recipe pool', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('Paella Valenciana');
      expect(result.userPrompt).toContain('recipe-1');
      expect(result.userPrompt).toContain('Gazpacho');
      expect(result.userPrompt).toContain('Tortilla Española');
    });

    it('should include recent recipes to avoid', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('evitar repetir');
      expect(result.userPrompt).toContain('Paella Valenciana');
    });

    it('should include favorite recipes to prioritize', () => {
      const result = builder.buildMealPlanPrompt(mockContext, mockRecipes);

      expect(result.userPrompt).toContain('priorizar');
      expect(result.userPrompt).toContain('Tortilla Española');
    });

    it('should translate skill levels', () => {
      const contexts = [
        { ...mockContext, user: { ...mockContext.user, skillLevel: 'beginner' as const } },
        { ...mockContext, user: { ...mockContext.user, skillLevel: 'advanced' as const } },
        { ...mockContext, user: { ...mockContext.user, skillLevel: 'expert' as const } },
      ];

      const results = contexts.map(ctx => builder.buildMealPlanPrompt(ctx, mockRecipes));

      expect(results[0].userPrompt).toContain('principiante');
      expect(results[1].userPrompt).toContain('avanzado');
      expect(results[2].userPrompt).toContain('experto');
    });

    it('should translate seasons', () => {
      const seasons: Array<'spring' | 'summer' | 'fall' | 'winter'> = ['spring', 'summer', 'fall', 'winter'];
      const expected = ['primavera', 'verano', 'otoño', 'invierno'];

      seasons.forEach((season, index) => {
        const ctx = { ...mockContext, temporal: { ...mockContext.temporal, season } };
        const result = builder.buildMealPlanPrompt(ctx, mockRecipes);
        expect(result.userPrompt).toContain(expected[index]);
      });
    });
  });
});

describe('ResponseParser', () => {
  const parser = new ResponseParser();
  const validRecipeIds = new Set(['recipe-1', 'recipe-2', 'recipe-3']);

  describe('parseResponse', () => {
    it('should parse valid response', () => {
      const validResponse = JSON.stringify({
        explanation: 'Plan balanceado con variedad mediterránea.',
        days: [
          {
            date: '2025-02-17',
            meals: {
              lunch: { recipeId: 'recipe-1', servings: 4 },
              dinner: { recipeId: 'recipe-2', servings: 4 },
            },
          },
          {
            date: '2025-02-18',
            meals: {
              lunch: { recipeId: 'recipe-3', servings: 4 },
              dinner: { recipeId: 'recipe-1', servings: 4 },
            },
          },
        ],
        shoppingTips: ['Comprar verduras frescas'],
        mealPrepSuggestions: ['Preparar arroz el domingo'],
      });

      const result = parser.parseResponse(validResponse, validRecipeIds);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.explanation).toBe('Plan balanceado con variedad mediterránea.');
        expect(result.data.days).toHaveLength(2);
        expect(result.data.shoppingTips).toHaveLength(1);
      }
    });

    it('should handle markdown code blocks', () => {
      const responseWithCodeBlock = '```json\n{"explanation": "Test", "days": [{"date": "2025-02-17", "meals": {"lunch": {"recipeId": "recipe-1", "servings": 2}}}], "shoppingTips": [], "mealPrepSuggestions": []}\n```';

      const result = parser.parseResponse(responseWithCodeBlock, validRecipeIds);

      expect(result.success).toBe(true);
    });

    it('should reject invalid recipe IDs', () => {
      const invalidResponse = JSON.stringify({
        explanation: 'Test',
        days: [
          {
            date: '2025-02-17',
            meals: {
              lunch: { recipeId: 'invalid-recipe-id', servings: 4 },
            },
          },
        ],
        shoppingTips: [],
        mealPrepSuggestions: [],
      });

      const result = parser.parseResponse(invalidResponse, validRecipeIds);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('invalid-recipe-id');
      }
    });

    it('should reject missing explanation', () => {
      const missingExplanation = JSON.stringify({
        days: [
          {
            date: '2025-02-17',
            meals: {
              lunch: { recipeId: 'recipe-1', servings: 4 },
            },
          },
        ],
      });

      const result = parser.parseResponse(missingExplanation, validRecipeIds);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('explanation');
      }
    });

    it('should reject empty days array', () => {
      const emptyDays = JSON.stringify({
        explanation: 'Test',
        days: [],
      });

      const result = parser.parseResponse(emptyDays, validRecipeIds);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('days');
      }
    });

    it('should reject missing recipeId', () => {
      const missingRecipeId = JSON.stringify({
        explanation: 'Test',
        days: [
          {
            date: '2025-02-17',
            meals: {
              lunch: { servings: 4 },
            },
          },
        ],
      });

      const result = parser.parseResponse(missingRecipeId, validRecipeIds);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('recipeId');
      }
    });

    it('should reject invalid servings', () => {
      const invalidServings = JSON.stringify({
        explanation: 'Test',
        days: [
          {
            date: '2025-02-17',
            meals: {
              lunch: { recipeId: 'recipe-1', servings: 0 },
            },
          },
        ],
      });

      const result = parser.parseResponse(invalidServings, validRecipeIds);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('servings');
      }
    });

    it('should handle malformed JSON', () => {
      const malformedJson = 'not valid json {';

      const result = parser.parseResponse(malformedJson, validRecipeIds);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('parse');
      }
    });

    it('should accept optional notes', () => {
      const withNotes = JSON.stringify({
        explanation: 'Test',
        days: [
          {
            date: '2025-02-17',
            meals: {
              lunch: { 
                recipeId: 'recipe-1', 
                servings: 4, 
                notes: 'Perfecto para el lunes' 
              },
            },
          },
        ],
        shoppingTips: [],
        mealPrepSuggestions: [],
      });

      const result = parser.parseResponse(withNotes, validRecipeIds);

      expect(result.success).toBe(true);
    });
  });
});
