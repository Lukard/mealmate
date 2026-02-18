/**
 * Prompt Builder
 * Constructs prompts for AI meal plan generation
 */

import type {
  MealPlanGenerationContext,
  RecipeForAI,
  GeneratedMealPlan,
} from './types.js';

// ============================================
// System Prompts
// ============================================

const MEAL_PLAN_SYSTEM_PROMPT = `Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas. Tu tarea es crear planes de comida semanales personalizados.

## Tus capacidades:
- Conocimiento profundo de la cocina española y mediterránea
- Comprensión de nutrición y balance alimentario
- Sensibilidad a restricciones dietéticas y alergias
- Optimización de ingredientes para reducir desperdicio

## Reglas estrictas:
1. SOLO puedes usar recetas del pool proporcionado (IDs válidos)
2. NUNCA inventes recetas o IDs
3. Respeta TODAS las restricciones dietéticas como críticas
4. El output DEBE ser JSON válido siguiendo el schema exacto
5. Cada receta debe usarse máximo 2 veces en la semana

## Criterios de selección:
1. **Variedad proteica**: Alterna entre carne, pescado, huevos, legumbres a lo largo de la semana
2. **Reutilización inteligente**: Si usas pechuga de pollo el lunes, considera usar sobras para ensalada el martes
3. **Balance semanal**: No más de 2 platos fritos por semana
4. **Dificultad adaptada**: Recetas más simples entre semana (lunes-jueves), más elaboradas el fin de semana
5. **Temporada**: Prioriza ingredientes de temporada cuando estén disponibles

## Formato de respuesta JSON:
{
  "explanation": "Breve explicación de la filosofía del plan (2-3 frases en español)",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": { "recipeId": "uuid-aqui", "servings": 4, "notes": "opcional" },
        "lunch": { "recipeId": "uuid-aqui", "servings": 4 },
        "dinner": { "recipeId": "uuid-aqui", "servings": 4 }
      }
    }
  ],
  "shoppingTips": ["consejo1 en español", "consejo2"],
  "mealPrepSuggestions": ["sugerencia de meal prep en español"]
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional antes o después.`;

// ============================================
// Prompt Builder Class
// ============================================

export class PromptBuilder {
  /**
   * Build the complete prompt for meal plan generation
   */
  buildMealPlanPrompt(
    context: MealPlanGenerationContext,
    availableRecipes: RecipeForAI[]
  ): { systemPrompt: string; userPrompt: string } {
    const userPrompt = this.buildUserPrompt(context, availableRecipes);

    return {
      systemPrompt: MEAL_PLAN_SYSTEM_PROMPT,
      userPrompt,
    };
  }

  /**
   * Build the user prompt with context
   */
  private buildUserPrompt(
    context: MealPlanGenerationContext,
    availableRecipes: RecipeForAI[]
  ): string {
    const sections: string[] = [];

    // User profile section
    sections.push(this.buildProfileSection(context.user));

    // Temporal context section
    sections.push(this.buildTemporalSection(context.temporal));

    // Behavioral context section
    if (context.behavioral.recentRecipeIds.length > 0 || 
        context.behavioral.favoriteRecipeIds.length > 0) {
      sections.push(this.buildBehavioralSection(context.behavioral, availableRecipes));
    }

    // Available recipes section (the pool)
    sections.push(this.buildRecipesSection(availableRecipes));

    // Task section
    sections.push(this.buildTaskSection(context.constraints, context.temporal));

    return sections.join('\n\n');
  }

  private buildProfileSection(user: MealPlanGenerationContext['user']): string {
    const lines = [
      '## Contexto del usuario',
      '',
      '**Perfil:**',
      `- Tamaño del hogar: ${user.householdSize} personas`,
      `- Nivel de cocina: ${this.translateSkillLevel(user.skillLevel)}`,
    ];

    if (user.weeklyBudgetCents) {
      lines.push(`- Presupuesto semanal: ${(user.weeklyBudgetCents / 100).toFixed(0)}€`);
    }

    if (user.maxPrepTimeMinutes) {
      lines.push(`- Tiempo máximo de preparación: ${user.maxPrepTimeMinutes} minutos`);
    }

    // Dietary restrictions
    if (user.dietaryRestrictions.length > 0) {
      lines.push('', '**Restricciones dietéticas (CRÍTICAS - respetar siempre):**');
      user.dietaryRestrictions.forEach((r) => lines.push(`- ${r}`));
    }

    // Cuisine preferences
    if (user.cuisinePreferences.length > 0) {
      lines.push('', '**Preferencias de cocina:**');
      user.cuisinePreferences.forEach((c) => lines.push(`- ${c}`));
    }

    // Disliked ingredients
    if (user.dislikedIngredients.length > 0) {
      lines.push('', '**Ingredientes a evitar:**');
      user.dislikedIngredients.forEach((i) => lines.push(`- ${i}`));
    }

    return lines.join('\n');
  }

  private buildTemporalSection(temporal: MealPlanGenerationContext['temporal']): string {
    const lines = [
      '## Contexto temporal',
      '',
      `- Semana del: ${temporal.weekStart} al ${temporal.weekEnd}`,
      `- Estación: ${this.translateSeason(temporal.season)}`,
    ];

    if (temporal.holidays.length > 0) {
      lines.push(`- Festividades: ${temporal.holidays.join(', ')}`);
    }

    if (temporal.specialEvents.length > 0) {
      lines.push(`- Eventos especiales: ${temporal.specialEvents.join(', ')}`);
    }

    return lines.join('\n');
  }

  private buildBehavioralSection(
    behavioral: MealPlanGenerationContext['behavioral'],
    recipes: RecipeForAI[]
  ): string {
    const lines = ['## Historial y preferencias', ''];

    // Recent recipes to avoid
    if (behavioral.recentRecipeIds.length > 0) {
      lines.push('**Recetas usadas recientemente (evitar repetir):**');
      const recentRecipes = recipes.filter((r) =>
        behavioral.recentRecipeIds.includes(r.id)
      );
      recentRecipes.forEach((r) => lines.push(`- ${r.name} (${r.id})`));
      lines.push('');
    }

    // Favorite recipes to prioritize
    if (behavioral.favoriteRecipeIds.length > 0) {
      lines.push('**Recetas favoritas (priorizar si encajan):**');
      const favorites = recipes.filter((r) =>
        behavioral.favoriteRecipeIds.includes(r.id)
      );
      favorites.forEach((r) => lines.push(`- ${r.name} (${r.id})`));
      lines.push('');
    }

    // Completion rate context
    if (behavioral.completionRate < 0.5) {
      lines.push('**Nota:** El usuario tiene baja tasa de completado de planes. Sugerir recetas más simples y rápidas.');
    }

    return lines.join('\n');
  }

  private buildRecipesSection(recipes: RecipeForAI[]): string {
    const lines = [
      '## Pool de recetas disponibles',
      '',
      'IMPORTANTE: Solo puedes usar IDs de esta lista.',
      '',
    ];

    recipes.forEach((recipe, index) => {
      lines.push(`### ${index + 1}. ${recipe.name}`);
      lines.push(`- **ID:** \`${recipe.id}\``);
      lines.push(`- Tiempo: ${recipe.prepTime} prep + ${recipe.cookTime} cocción min`);
      lines.push(`- Dificultad: ${this.translateDifficulty(recipe.difficulty)}`);
      
      if (recipe.cuisine) {
        lines.push(`- Cocina: ${recipe.cuisine}`);
      }
      
      if (recipe.tags.length > 0) {
        lines.push(`- Tags: ${recipe.tags.join(', ')}`);
      }
      
      lines.push(`- Ingredientes principales: ${recipe.mainIngredients.join(', ')}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private buildTaskSection(
    constraints: MealPlanGenerationContext['constraints'],
    temporal: MealPlanGenerationContext['temporal']
  ): string {
    const mealTypes = constraints.mealsPerDay.map((m) => this.translateMealType(m));
    
    const lines = [
      '## Tu tarea',
      '',
      `Genera un plan de comidas para los días ${temporal.weekStart} a ${temporal.weekEnd} con:`,
      `- Comidas por día: ${mealTypes.join(', ')}`,
      `- Nivel de variedad: ${this.translateVariety(constraints.varietyLevel)}`,
    ];

    if (constraints.includeMealPrep) {
      lines.push('- Incluir sugerencias de meal prep para el domingo');
    }

    if (constraints.budgetLimit) {
      lines.push(`- Ajustado al presupuesto de ${(constraints.budgetLimit / 100).toFixed(0)}€`);
    }

    lines.push('');
    lines.push('Responde SOLO con el JSON estructurado según el formato especificado.');

    return lines.join('\n');
  }

  // Translation helpers
  private translateSkillLevel(level: string): string {
    const map: Record<string, string> = {
      beginner: 'principiante',
      intermediate: 'intermedio',
      advanced: 'avanzado',
      expert: 'experto',
    };
    return map[level] || level;
  }

  private translateSeason(season: string): string {
    const map: Record<string, string> = {
      spring: 'primavera',
      summer: 'verano',
      fall: 'otoño',
      winter: 'invierno',
    };
    return map[season] || season;
  }

  private translateDifficulty(difficulty: string): string {
    const map: Record<string, string> = {
      easy: 'fácil',
      medium: 'media',
      hard: 'difícil',
    };
    return map[difficulty] || difficulty;
  }

  private translateMealType(meal: string): string {
    const map: Record<string, string> = {
      breakfast: 'desayuno',
      lunch: 'comida',
      dinner: 'cena',
      snack: 'snack',
    };
    return map[meal] || meal;
  }

  private translateVariety(level: string): string {
    const map: Record<string, string> = {
      low: 'bajo (repetir recetas está bien)',
      medium: 'medio (algo de variedad)',
      high: 'alto (máxima variedad)',
    };
    return map[level] || level;
  }
}

// ============================================
// Response Parser
// ============================================

export class ResponseParser {
  /**
   * Parse and validate AI response
   */
  parseResponse(
    rawResponse: string,
    validRecipeIds: Set<string>
  ): { success: true; data: GeneratedMealPlan } | { success: false; error: string } {
    try {
      // Clean response (remove markdown code blocks if present)
      let cleaned = rawResponse.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.explanation || typeof parsed.explanation !== 'string') {
        return { success: false, error: 'Missing or invalid explanation field' };
      }

      if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
        return { success: false, error: 'Missing or empty days array' };
      }

      // Validate each day
      const invalidRecipes: string[] = [];
      
      for (const day of parsed.days) {
        if (!day.date || !day.meals) {
          return { success: false, error: 'Invalid day structure' };
        }

        // Check each meal
        for (const [mealType, meal] of Object.entries(day.meals)) {
          if (!meal) continue;
          
          const mealData = meal as { recipeId?: string; servings?: number };
          
          if (!mealData.recipeId) {
            return { success: false, error: `Missing recipeId for ${mealType} on ${day.date}` };
          }

          // Validate recipe ID exists
          if (!validRecipeIds.has(mealData.recipeId)) {
            invalidRecipes.push(mealData.recipeId);
          }

          // Validate servings
          if (typeof mealData.servings !== 'number' || mealData.servings < 1) {
            return { success: false, error: `Invalid servings for ${mealType} on ${day.date}` };
          }
        }
      }

      // Report invalid recipe IDs
      if (invalidRecipes.length > 0) {
        return {
          success: false,
          error: `Invalid recipe IDs not in pool: ${invalidRecipes.join(', ')}`,
        };
      }

      // Build validated result
      const result: GeneratedMealPlan = {
        explanation: parsed.explanation,
        days: parsed.days,
        shoppingTips: Array.isArray(parsed.shoppingTips) ? parsed.shoppingTips : [],
        mealPrepSuggestions: Array.isArray(parsed.mealPrepSuggestions)
          ? parsed.mealPrepSuggestions
          : [],
      };

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// ============================================
// Exports
// ============================================

export const promptBuilder = new PromptBuilder();
export const responseParser = new ResponseParser();
