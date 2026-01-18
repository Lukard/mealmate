/**
 * Meal Plan Routes
 * Meal plan generation, CRUD operations
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { authMiddleware, getCurrentUserId } from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const mealPlans = new Hono();

// Apply auth middleware to all routes
mealPlans.use('*', authMiddleware);
mealPlans.use('*', rateLimiters.authenticated);

// ============================================
// Validation Schemas
// ============================================

const mealPlanListSchema = z.object({
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createMealPlanSchema = z.object({
  name: z.string().min(1).max(255),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const generateMealPlanSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferences: z
    .object({
      includeBreakfast: z.boolean().default(true),
      includeLunch: z.boolean().default(true),
      includeDinner: z.boolean().default(true),
      includeSnacks: z.boolean().default(false),
      variety: z.enum(['low', 'medium', 'high']).default('medium'),
      preferQuickMeals: z.boolean().default(false),
      maxPrepTime: z.number().min(5).optional(),
      budgetLimit: z.number().min(0).optional(),
    })
    .optional(),
});

const updateEntriesSchema = z.object({
  entries: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
      recipeId: z.string().uuid(),
      servings: z.number().min(1).max(50),
      notes: z.string().max(255).optional(),
    })
  ),
});

const duplicateMealPlanSchema = z.object({
  newStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ============================================
// Routes
// ============================================

/**
 * GET /meal-plans
 * List user's meal plans
 */
mealPlans.get('/', async (c) => {
  const userId = getCurrentUserId(c);
  const query = c.req.query();
  const params = mealPlanListSchema.parse(query);

  const conditions = [eq(schema.mealPlans.userId, userId)];

  if (params.status) {
    conditions.push(eq(schema.mealPlans.status, params.status));
  }

  if (params.startDate) {
    conditions.push(sql`${schema.mealPlans.startDate} >= ${params.startDate}`);
  }

  if (params.endDate) {
    conditions.push(sql`${schema.mealPlans.endDate} <= ${params.endDate}`);
  }

  const plans = await db.query.mealPlans.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.mealPlans.startDate)],
    with: {
      entries: {
        columns: {
          id: true,
        },
      },
    },
  });

  return c.json({
    success: true,
    data: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
      mealCount: plan.entries.length,
      estimatedCost: plan.estimatedCost,
      createdAt: plan.createdAt,
    })),
  });
});

/**
 * GET /meal-plans/:id
 * Get meal plan with all entries
 */
mealPlans.get('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');

  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.userId, userId)),
    with: {
      entries: {
        with: {
          recipe: {
            columns: {
              id: true,
              name: true,
              imageUrl: true,
              prepTime: true,
              cookTime: true,
              nutritionData: true,
            },
          },
        },
      },
    },
  });

  if (!plan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Group entries by date
  const entriesByDate = new Map<string, typeof plan.entries>();
  for (const entry of plan.entries) {
    const dateKey = entry.date;
    if (!entriesByDate.has(dateKey)) {
      entriesByDate.set(dateKey, []);
    }
    entriesByDate.get(dateKey)!.push(entry);
  }

  // Format entries by date
  const formattedEntries = Array.from(entriesByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => {
      const meals: Record<string, unknown> = {};

      for (const entry of entries) {
        const mealData = {
          id: entry.id,
          recipe: entry.recipe,
          servings: entry.servings,
          notes: entry.notes,
        };

        if (entry.mealType === 'snack') {
          if (!meals.snacks) {
            meals.snacks = [];
          }
          (meals.snacks as unknown[]).push(mealData);
        } else {
          meals[entry.mealType] = mealData;
        }
      }

      return { date, meals };
    });

  // Calculate nutrition summary
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const entry of plan.entries) {
    if (entry.recipe.nutritionData) {
      const nutrition = entry.recipe.nutritionData;
      totalCalories += (nutrition.calories || 0) * entry.servings;
      totalProtein += (nutrition.protein || 0) * entry.servings;
      totalCarbs += (nutrition.carbohydrates || 0) * entry.servings;
      totalFat += (nutrition.fat || 0) * entry.servings;
    }
  }

  const daysCount = formattedEntries.length || 1;

  return c.json({
    success: true,
    data: {
      id: plan.id,
      name: plan.name,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
      entries: formattedEntries,
      summary: {
        totalMeals: plan.entries.length,
        totalIngredients: 0, // Would need to aggregate from recipes
        estimatedCost: plan.estimatedCost,
        nutritionAverage: {
          calories: Math.round(totalCalories / daysCount),
          protein: Math.round(totalProtein / daysCount),
          carbohydrates: Math.round(totalCarbs / daysCount),
          fat: Math.round(totalFat / daysCount),
        },
      },
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    },
  });
});

/**
 * POST /meal-plans
 * Create a new meal plan
 */
mealPlans.post('/', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const data = createMealPlanSchema.parse(body);

  // Validate date range
  if (data.endDate < data.startDate) {
    throw new HTTPException(400, {
      message: 'End date must be after start date',
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  const [newPlan] = await db
    .insert(schema.mealPlans)
    .values({
      userId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'draft',
    })
    .returning();

  return c.json(
    {
      success: true,
      data: {
        id: newPlan.id,
        name: newPlan.name,
        startDate: newPlan.startDate,
        endDate: newPlan.endDate,
        status: newPlan.status,
        createdAt: newPlan.createdAt,
      },
    },
    201
  );
});

/**
 * POST /meal-plans/generate
 * Generate meal plan with AI assistance
 */
mealPlans.post('/generate', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const data = generateMealPlanSchema.parse(body);

  // Validate date range
  if (data.endDate < data.startDate) {
    throw new HTTPException(400, {
      message: 'End date must be after start date',
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  // Get user profile and preferences
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  // Get user dietary restrictions
  const userRestrictions = await db.query.userRestrictions.findMany({
    where: eq(schema.userRestrictions.userId, userId),
    with: {
      // Would need relation set up
    },
  });

  // Calculate days in plan
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Build meal types to include
  const mealTypes: string[] = [];
  if (data.preferences?.includeBreakfast !== false) mealTypes.push('breakfast');
  if (data.preferences?.includeLunch !== false) mealTypes.push('lunch');
  if (data.preferences?.includeDinner !== false) mealTypes.push('dinner');
  if (data.preferences?.includeSnacks) mealTypes.push('snack');

  // Get recipes that match preferences
  const recipeConditions = [eq(schema.recipes.isPublic, true)];

  if (data.preferences?.maxPrepTime) {
    recipeConditions.push(
      sql`${schema.recipes.prepTime} <= ${data.preferences.maxPrepTime}`
    );
  }

  if (userProfile?.maxPrepTime) {
    recipeConditions.push(
      sql`${schema.recipes.prepTime} <= ${userProfile.maxPrepTime}`
    );
  }

  const availableRecipes = await db.query.recipes.findMany({
    where: and(...recipeConditions),
    orderBy: [desc(schema.recipes.rating)],
    limit: 100,
  });

  if (availableRecipes.length === 0) {
    throw new HTTPException(400, {
      message: 'No recipes available matching your preferences',
      cause: { code: 'MATCHING_FAILED' },
    });
  }

  // Create meal plan
  const planName = `Week of ${startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;

  const [newPlan] = await db
    .insert(schema.mealPlans)
    .values({
      userId,
      name: planName,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'draft',
    })
    .returning();

  // Generate meal entries (simple random selection for now)
  // In a real implementation, this would use more sophisticated algorithms
  const entries: {
    mealPlanId: string;
    recipeId: string;
    date: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    servings: number;
  }[] = [];

  const servings = userProfile?.householdSize || 2;

  for (let day = 0; day < daysDiff; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);
    const dateStr = currentDate.toISOString().split('T')[0];

    for (const mealType of mealTypes) {
      // Select a random recipe (in real impl, would be smarter)
      const recipeIndex = Math.floor(Math.random() * availableRecipes.length);
      const recipe = availableRecipes[recipeIndex];

      entries.push({
        mealPlanId: newPlan.id,
        recipeId: recipe.id,
        date: dateStr,
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        servings,
      });
    }
  }

  if (entries.length > 0) {
    await db.insert(schema.mealPlanEntries).values(entries);
  }

  return c.json(
    {
      success: true,
      data: {
        id: newPlan.id,
        name: newPlan.name,
        startDate: newPlan.startDate,
        endDate: newPlan.endDate,
        status: newPlan.status,
        mealCount: entries.length,
        createdAt: newPlan.createdAt,
      },
    },
    201
  );
});

/**
 * PUT /meal-plans/:id
 * Update meal plan metadata
 */
mealPlans.put('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();

  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  });

  const data = updateSchema.parse(body);

  // Verify ownership
  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.userId, userId)),
  });

  if (!plan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.status !== undefined) updates.status = data.status;

  await db
    .update(schema.mealPlans)
    .set(updates)
    .where(eq(schema.mealPlans.id, id));

  return c.json({
    success: true,
    data: {
      id,
      message: 'Meal plan updated successfully',
    },
  });
});

/**
 * PUT /meal-plans/:id/entries
 * Batch update meal plan entries
 */
mealPlans.put('/:id/entries', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateEntriesSchema.parse(body);

  // Verify ownership
  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.userId, userId)),
  });

  if (!plan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Validate recipe IDs
  const recipeIds = data.entries.map((e) => e.recipeId);
  const existingRecipes = await db.query.recipes.findMany({
    where: sql`${schema.recipes.id} IN ${recipeIds}`,
    columns: { id: true },
  });

  const existingIds = new Set(existingRecipes.map((r) => r.id));
  const missingIds = recipeIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    throw new HTTPException(400, {
      message: `Invalid recipe IDs: ${missingIds.join(', ')}`,
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  // Delete existing entries for the dates being updated
  const dates = [...new Set(data.entries.map((e) => e.date))];
  for (const date of dates) {
    await db
      .delete(schema.mealPlanEntries)
      .where(
        and(
          eq(schema.mealPlanEntries.mealPlanId, id),
          eq(schema.mealPlanEntries.date, date)
        )
      );
  }

  // Insert new entries
  if (data.entries.length > 0) {
    await db.insert(schema.mealPlanEntries).values(
      data.entries.map((entry) => ({
        mealPlanId: id,
        recipeId: entry.recipeId,
        date: entry.date,
        mealType: entry.mealType,
        servings: entry.servings,
        notes: entry.notes,
      }))
    );
  }

  // Update meal plan timestamp
  await db
    .update(schema.mealPlans)
    .set({ updatedAt: new Date() })
    .where(eq(schema.mealPlans.id, id));

  return c.json({
    success: true,
    data: {
      id,
      entriesUpdated: data.entries.length,
    },
  });
});

/**
 * DELETE /meal-plans/:id/entries/:entryId
 * Remove a meal from the plan
 */
mealPlans.delete('/:id/entries/:entryId', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const entryId = c.req.param('entryId');

  // Verify ownership
  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.userId, userId)),
  });

  if (!plan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  await db
    .delete(schema.mealPlanEntries)
    .where(
      and(
        eq(schema.mealPlanEntries.id, entryId),
        eq(schema.mealPlanEntries.mealPlanId, id)
      )
    );

  return c.body(null, 204);
});

/**
 * POST /meal-plans/:id/duplicate
 * Duplicate a meal plan to new dates
 */
mealPlans.post('/:id/duplicate', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const { newStartDate } = duplicateMealPlanSchema.parse(body);

  // Get original plan
  const originalPlan = await db.query.mealPlans.findFirst({
    where: and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.userId, userId)),
    with: {
      entries: true,
    },
  });

  if (!originalPlan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Calculate date difference
  const originalStart = new Date(originalPlan.startDate);
  const originalEnd = new Date(originalPlan.endDate);
  const daysDiff = Math.ceil(
    (originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const newStart = new Date(newStartDate);
  const newEnd = new Date(newStart);
  newEnd.setDate(newEnd.getDate() + daysDiff);

  // Create new plan
  const [newPlan] = await db
    .insert(schema.mealPlans)
    .values({
      userId,
      name: `${originalPlan.name} (Copy)`,
      startDate: newStartDate,
      endDate: newEnd.toISOString().split('T')[0],
      status: 'draft',
    })
    .returning();

  // Copy entries with adjusted dates
  if (originalPlan.entries.length > 0) {
    const newEntries = originalPlan.entries.map((entry) => {
      const entryDate = new Date(entry.date);
      const dayOffset = Math.ceil(
        (entryDate.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newEntryDate = new Date(newStart);
      newEntryDate.setDate(newEntryDate.getDate() + dayOffset);

      return {
        mealPlanId: newPlan.id,
        recipeId: entry.recipeId,
        date: newEntryDate.toISOString().split('T')[0],
        mealType: entry.mealType,
        servings: entry.servings,
        notes: entry.notes,
      };
    });

    await db.insert(schema.mealPlanEntries).values(newEntries);
  }

  return c.json(
    {
      success: true,
      data: {
        id: newPlan.id,
        name: newPlan.name,
        startDate: newPlan.startDate,
        endDate: newPlan.endDate,
        status: newPlan.status,
        mealCount: originalPlan.entries.length,
        createdAt: newPlan.createdAt,
      },
    },
    201
  );
});

/**
 * DELETE /meal-plans/:id
 * Delete a meal plan
 */
mealPlans.delete('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');

  // Verify ownership
  const plan = await db.query.mealPlans.findFirst({
    where: and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.userId, userId)),
  });

  if (!plan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  await db.delete(schema.mealPlans).where(eq(schema.mealPlans.id, id));

  return c.body(null, 204);
});

export default mealPlans;
