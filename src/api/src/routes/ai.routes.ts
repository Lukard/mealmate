/**
 * AI Routes
 * AI-powered meal plan generation endpoints
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authMiddleware, getCurrentUserId } from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';
import { getMealPlanAIService } from '../services/ai/meal-plan-ai-service.js';

const ai = new Hono();

// Apply auth middleware to all routes
ai.use('*', authMiddleware);
ai.use('*', rateLimiters.authenticated);

// ============================================
// Validation Schemas
// ============================================

const generateMealPlanSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  preferences: z
    .object({
      includeBreakfast: z.boolean().optional().default(true),
      includeLunch: z.boolean().optional().default(true),
      includeDinner: z.boolean().optional().default(true),
      includeSnacks: z.boolean().optional().default(false),
      variety: z.enum(['low', 'medium', 'high']).optional().default('medium'),
      preferQuickMeals: z.boolean().optional().default(false),
      maxPrepTime: z.number().min(5).max(180).optional(),
      budgetLimit: z.number().min(0).optional(),
      mealPrepFriendly: z.boolean().optional().default(false),
    })
    .optional(),
  context: z
    .object({
      occasion: z.string().max(100).optional(),
      cuisineFocus: z.array(z.string().max(50)).max(5).optional(),
      excludeRecipes: z.array(z.string().uuid()).max(50).optional(),
      includeRecipes: z.array(z.string().uuid()).max(20).optional(),
    })
    .optional(),
});

// ============================================
// Routes
// ============================================

/**
 * POST /ai/meal-plans/generate
 * Generate a meal plan using AI
 * 
 * Request body:
 * - startDate: string (YYYY-MM-DD)
 * - endDate: string (YYYY-MM-DD)
 * - preferences?: object (meal preferences)
 * - context?: object (additional context like occasion, cuisine focus)
 * 
 * Response:
 * - success: boolean
 * - data: generated meal plan with AI explanation
 * - metadata: AI generation metadata (model, tokens, latency)
 */
ai.post('/meal-plans/generate', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  
  // Validate input
  const validationResult = generateMealPlanSchema.safeParse(body);
  if (!validationResult.success) {
    throw new HTTPException(400, {
      message: 'Validation error',
      cause: { 
        code: 'VALIDATION_ERROR',
        details: validationResult.error.flatten(),
      },
    });
  }
  
  const data = validationResult.data;

  // Validate date range
  if (data.endDate < data.startDate) {
    throw new HTTPException(400, {
      message: 'End date must be after start date',
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  // Calculate days - limit to max 14 days
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  if (daysDiff > 14) {
    throw new HTTPException(400, {
      message: 'Meal plan cannot exceed 14 days',
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  // Get AI service and generate meal plan
  const aiService = getMealPlanAIService();
  
  const result = await aiService.generateMealPlan({
    userId,
    startDate: data.startDate,
    endDate: data.endDate,
    preferences: data.preferences,
    context: data.context,
  });

  if (!result.success) {
    // Return appropriate error based on the error type
    const statusCode = result.error?.includes('Not enough recipes') ? 400 : 500;
    throw new HTTPException(statusCode, {
      message: result.error || 'Failed to generate meal plan',
      cause: { 
        code: statusCode === 400 ? 'INSUFFICIENT_DATA' : 'AI_GENERATION_FAILED',
        metadata: result.metadata,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      mealPlan: result.mealPlan,
      aiExplanation: result.mealPlan?.aiExplanation,
    },
    metadata: result.metadata,
  }, 201);
});

/**
 * GET /ai/status
 * Check AI service status and configuration
 */
ai.get('/status', async (c) => {
  const aiService = getMealPlanAIService();
  
  return c.json({
    success: true,
    data: {
      available: true,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      features: {
        mealPlanGeneration: true,
        recipeRecommendations: false, // Future feature
        ingredientSubstitution: false, // Future feature
      },
    },
  });
});

export default ai;
