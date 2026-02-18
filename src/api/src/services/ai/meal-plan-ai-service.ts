/**
 * Meal Plan AI Service
 * Main service for AI-powered meal plan generation
 */

import { db } from '../../db/client.js';
import { 
  recipes, 
  recipeIngredients, 
  userProfiles, 
  userRestrictions,
  dietaryRestrictions,
  mealPlans,
  mealPlanEntries,
} from '../../db/schema.js';
import { aiGenerationLogs, userPreferenceSignals } from '../../db/schema-ai.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { LLMService, getLLMService } from './llm-client.js';
import { PromptBuilder, ResponseParser } from './prompt-builder.js';
import type {
  MealPlanGenerationContext,
  RecipeForAI,
  GeneratedMealPlan,
  MealPlanGenerationResult,
  UserContext,
  TemporalContext,
  BehavioralContext,
  MealPlanConstraints,
} from './types.js';

// ============================================
// Types
// ============================================

export interface GenerateMealPlanInput {
  userId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preferences?: {
    includeBreakfast?: boolean;
    includeLunch?: boolean;
    includeDinner?: boolean;
    includeSnacks?: boolean;
    variety?: 'low' | 'medium' | 'high';
    preferQuickMeals?: boolean;
    maxPrepTime?: number;
    budgetLimit?: number;
    mealPrepFriendly?: boolean;
  };
  context?: {
    occasion?: string;
    cuisineFocus?: string[];
    excludeRecipes?: string[];
    includeRecipes?: string[];
  };
}

export interface GenerateMealPlanOutput {
  success: boolean;
  mealPlan?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    aiExplanation: string;
    entries: Array<{
      id: string;
      date: string;
      mealType: string;
      recipeId: string;
      servings: number;
      notes?: string;
    }>;
  };
  error?: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
  };
}

// ============================================
// Service Class
// ============================================

export class MealPlanAIService {
  private llm: LLMService;
  private promptBuilder: PromptBuilder;
  private responseParser: ResponseParser;

  constructor(llmService?: LLMService) {
    this.llm = llmService ?? getLLMService();
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ResponseParser();
  }

  /**
   * Generate a meal plan using AI
   */
  async generateMealPlan(input: GenerateMealPlanInput): Promise<GenerateMealPlanOutput> {
    const startTime = Date.now();
    let tokensUsed = 0;
    let model = '';

    try {
      // 1. Build context
      const context = await this.buildContext(input);

      // 2. Get available recipes (pre-filtered)
      const availableRecipes = await this.getAvailableRecipes(
        input.userId,
        context,
        input.context?.excludeRecipes || []
      );

      if (availableRecipes.length < 10) {
        return {
          success: false,
          error: `Not enough recipes available (${availableRecipes.length}). Need at least 10.`,
          metadata: {
            provider: this.llm.provider,
            model: '',
            tokensUsed: 0,
            latencyMs: Date.now() - startTime,
          },
        };
      }

      // 3. Build prompt
      const { systemPrompt, userPrompt } = this.promptBuilder.buildMealPlanPrompt(
        context,
        availableRecipes
      );

      // 4. Call LLM
      const response = await this.llm.complete(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.7,
          maxTokens: 4000,
          responseFormat: 'json',
        }
      );

      tokensUsed = response.usage.totalTokens;
      model = response.model;

      // 5. Parse and validate response
      const validRecipeIds = new Set(availableRecipes.map((r) => r.id));
      const parseResult = this.responseParser.parseResponse(response.content, validRecipeIds);

      if (!parseResult.success) {
        // Log failure
        await this.logGeneration({
          userId: input.userId,
          success: false,
          error: parseResult.error,
          context: { input, recipesCount: availableRecipes.length },
          model,
          tokensUsed,
          latencyMs: Date.now() - startTime,
          rawResponse: response.content,
        });

        return {
          success: false,
          error: `AI response validation failed: ${parseResult.error}`,
          metadata: {
            provider: this.llm.provider,
            model,
            tokensUsed,
            latencyMs: Date.now() - startTime,
          },
        };
      }

      // 6. Create meal plan in database
      const mealPlan = await this.saveMealPlan(
        input,
        parseResult.data,
        context.user.householdSize
      );

      // 7. Log successful generation
      await this.logGeneration({
        userId: input.userId,
        success: true,
        context: { input, recipesCount: availableRecipes.length },
        model,
        tokensUsed,
        latencyMs: Date.now() - startTime,
        outputMealPlanId: mealPlan.id,
      });

      return {
        success: true,
        mealPlan,
        metadata: {
          provider: this.llm.provider,
          model,
          tokensUsed,
          latencyMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log error
      await this.logGeneration({
        userId: input.userId,
        success: false,
        error: errorMessage,
        context: { input },
        model: model || 'unknown',
        tokensUsed,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: errorMessage,
        metadata: {
          provider: this.llm.provider,
          model: model || 'unknown',
          tokensUsed,
          latencyMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Build generation context from user data
   */
  private async buildContext(input: GenerateMealPlanInput): Promise<MealPlanGenerationContext> {
    // Get user profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, input.userId),
    });

    // Get dietary restrictions
    const restrictions = await db
      .select({ name: dietaryRestrictions.name })
      .from(userRestrictions)
      .innerJoin(dietaryRestrictions, eq(userRestrictions.restrictionId, dietaryRestrictions.id))
      .where(eq(userRestrictions.userId, input.userId));

    // Get recent recipes (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMealPlans = await db
      .select({ recipeId: mealPlanEntries.recipeId })
      .from(mealPlanEntries)
      .innerJoin(mealPlans, eq(mealPlanEntries.mealPlanId, mealPlans.id))
      .where(
        and(
          eq(mealPlans.userId, input.userId),
          gte(mealPlans.createdAt, thirtyDaysAgo)
        )
      );

    // Get favorite recipes from signals
    const favoriteSignals = await db
      .select({ recipeId: userPreferenceSignals.recipeId })
      .from(userPreferenceSignals)
      .where(
        and(
          eq(userPreferenceSignals.userId, input.userId),
          eq(userPreferenceSignals.signalType, 'favorite')
        )
      );

    // Calculate completion rate
    const completedPlans = await db
      .select({ count: sql<number>`count(*)` })
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, input.userId),
          eq(mealPlans.status, 'completed')
        )
      );

    const totalPlans = await db
      .select({ count: sql<number>`count(*)` })
      .from(mealPlans)
      .where(eq(mealPlans.userId, input.userId));

    const completionRate = totalPlans[0]?.count 
      ? Number(completedPlans[0]?.count || 0) / Number(totalPlans[0].count) 
      : 0.5;

    // Build context
    const user: UserContext = {
      userId: input.userId,
      householdSize: profile?.householdSize || 2,
      dietaryRestrictions: restrictions.map((r) => r.name),
      skillLevel: (profile?.cookingSkill as UserContext['skillLevel']) || 'intermediate',
      weeklyBudgetCents: profile?.budgetWeekly ?? undefined,
      maxPrepTimeMinutes: input.preferences?.maxPrepTime ?? profile?.maxPrepTime ?? undefined,
      cuisinePreferences: input.context?.cuisineFocus || profile?.cuisinePreferences || [],
      dislikedIngredients: profile?.dislikedIngredients || [],
    };

    const temporal: TemporalContext = {
      season: this.getSeason(new Date(input.startDate)),
      weekStart: input.startDate,
      weekEnd: input.endDate,
      holidays: this.getHolidays(input.startDate, input.endDate),
      specialEvents: [], // Could be added from user calendar
    };

    const behavioral: BehavioralContext = {
      recentRecipeIds: recentMealPlans.map((r) => r.recipeId).filter(Boolean) as string[],
      favoriteRecipeIds: favoriteSignals
        .map((s) => s.recipeId)
        .filter(Boolean) as string[],
      completionRate,
    };

    const mealsPerDay: ('breakfast' | 'lunch' | 'dinner' | 'snack')[] = [];
    if (input.preferences?.includeBreakfast !== false) mealsPerDay.push('breakfast');
    if (input.preferences?.includeLunch !== false) mealsPerDay.push('lunch');
    if (input.preferences?.includeDinner !== false) mealsPerDay.push('dinner');
    if (input.preferences?.includeSnacks) mealsPerDay.push('snack');

    const constraints: MealPlanConstraints = {
      mealsPerDay: mealsPerDay.length > 0 ? mealsPerDay : ['lunch', 'dinner'],
      includeMealPrep: input.preferences?.mealPrepFriendly || false,
      varietyLevel: input.preferences?.variety || 'medium',
      budgetLimit: input.preferences?.budgetLimit,
    };

    return { user, temporal, behavioral, constraints };
  }

  /**
   * Get filtered available recipes for the pool
   */
  private async getAvailableRecipes(
    userId: string,
    context: MealPlanGenerationContext,
    excludeIds: string[]
  ): Promise<RecipeForAI[]> {
    // Build base query conditions
    const conditions = [eq(recipes.isPublic, true)];

    // Add max prep time filter if specified
    if (context.user.maxPrepTimeMinutes) {
      conditions.push(
        sql`${recipes.prepTime} + ${recipes.cookTime} <= ${context.user.maxPrepTimeMinutes}`
      );
    }

    // Get recipes with ingredients
    const allRecipes = await db.query.recipes.findMany({
      where: and(...conditions),
      with: {
        ingredients: {
          with: {
            ingredient: true,
          },
        },
      },
      limit: 150, // Get more than we need, then filter
    });

    // Filter out excluded recipes
    const excludeSet = new Set(excludeIds);
    
    // Filter by dietary restrictions (basic filter - AI will do detailed check)
    const filtered = allRecipes.filter((recipe) => {
      // Skip excluded
      if (excludeSet.has(recipe.id)) return false;

      // Check ingredient restrictions
      const ingredientNames = recipe.ingredients
        .map((ri) => ri.ingredient?.name?.toLowerCase() || '')
        .filter(Boolean);

      // Skip if contains disliked ingredients
      for (const disliked of context.user.dislikedIngredients) {
        if (ingredientNames.some((name) => name.includes(disliked.toLowerCase()))) {
          return false;
        }
      }

      return true;
    });

    // Convert to AI format
    const result: RecipeForAI[] = filtered.slice(0, 80).map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      description: recipe.description ?? undefined,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      difficulty: recipe.difficulty || 'medium',
      cuisine: recipe.cuisine ?? undefined,
      tags: recipe.tags || [],
      mainIngredients: recipe.ingredients
        .slice(0, 5)
        .map((ri) => ri.ingredient?.name || '')
        .filter(Boolean),
    }));

    return result;
  }

  /**
   * Save generated meal plan to database
   */
  private async saveMealPlan(
    input: GenerateMealPlanInput,
    generated: GeneratedMealPlan,
    servingsDefault: number
  ): Promise<GenerateMealPlanOutput['mealPlan'] & { id: string }> {
    // Create meal plan (AI fields are added via ALTER TABLE migration)
    const [mealPlan] = await db
      .insert(mealPlans)
      .values({
        userId: input.userId,
        name: `Plan IA ${input.startDate} - ${input.endDate}`,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'draft',
      })
      .returning();

    // Update AI-specific fields via raw SQL (added via migration)
    await db.execute(sql`
      UPDATE meal_plans 
      SET generated_by = 'ai', ai_explanation = ${generated.explanation}
      WHERE id = ${mealPlan.id}
    `);

    // Create entries
    const entries: Array<{
      id: string;
      date: string;
      mealType: string;
      recipeId: string;
      servings: number;
      notes?: string;
    }> = [];

    for (const day of generated.days) {
      for (const [mealType, meal] of Object.entries(day.meals)) {
        if (!meal) continue;

        const [entry] = await db
          .insert(mealPlanEntries)
          .values({
            mealPlanId: mealPlan.id,
            recipeId: meal.recipeId,
            date: day.date,
            mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            servings: meal.servings || servingsDefault,
            notes: meal.notes,
          })
          .returning();

        entries.push({
          id: entry.id,
          date: entry.date,
          mealType: entry.mealType,
          recipeId: entry.recipeId,
          servings: entry.servings,
          notes: entry.notes ?? undefined,
        });
      }
    }

    return {
      id: mealPlan.id,
      name: mealPlan.name,
      startDate: mealPlan.startDate,
      endDate: mealPlan.endDate,
      status: mealPlan.status || 'draft',
      aiExplanation: generated.explanation,
      entries,
    };
  }

  /**
   * Log generation for analytics
   */
  private async logGeneration(data: {
    userId: string;
    success: boolean;
    error?: string;
    context: Record<string, unknown>;
    model: string;
    tokensUsed: number;
    latencyMs: number;
    outputMealPlanId?: string;
    rawResponse?: string;
  }): Promise<void> {
    try {
      await db.insert(aiGenerationLogs).values({
        userId: data.userId,
        requestType: 'meal_plan',
        inputContext: data.context,
        modelUsed: data.model,
        provider: this.llm.provider,
        promptTokens: Math.floor(data.tokensUsed * 0.7), // Approximate split
        completionTokens: Math.floor(data.tokensUsed * 0.3),
        latencyMs: data.latencyMs,
        success: data.success,
        errorMessage: data.error,
        outputMealPlanId: data.outputMealPlanId,
        rawResponse: data.rawResponse,
      });
    } catch (error) {
      console.error('[MealPlanAI] Failed to log generation:', error);
    }
  }

  /**
   * Get current season
   */
  private getSeason(date: Date): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Get holidays in date range (Spanish holidays)
   */
  private getHolidays(startDate: string, endDate: string): string[] {
    const holidays: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Simple check for major Spanish holidays
    const spanishHolidays: Record<string, string> = {
      '01-01': 'Año Nuevo',
      '01-06': 'Reyes Magos',
      '05-01': 'Día del Trabajo',
      '08-15': 'Asunción',
      '10-12': 'Día de la Hispanidad',
      '11-01': 'Todos los Santos',
      '12-06': 'Día de la Constitución',
      '12-08': 'Inmaculada Concepción',
      '12-25': 'Navidad',
    };

    for (const [mmdd, name] of Object.entries(spanishHolidays)) {
      const [month, day] = mmdd.split('-').map(Number);
      const holidayDate = new Date(start.getFullYear(), month - 1, day);

      if (holidayDate >= start && holidayDate <= end) {
        holidays.push(name);
      }
    }

    return holidays;
  }
}

// ============================================
// Singleton Instance
// ============================================

let mealPlanAIServiceInstance: MealPlanAIService | null = null;

export function getMealPlanAIService(): MealPlanAIService {
  if (!mealPlanAIServiceInstance) {
    mealPlanAIServiceInstance = new MealPlanAIService();
  }
  return mealPlanAIServiceInstance;
}

export function resetMealPlanAIService(): void {
  mealPlanAIServiceInstance = null;
}
