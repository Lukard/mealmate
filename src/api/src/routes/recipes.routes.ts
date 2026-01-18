/**
 * Recipe Routes
 * Recipe CRUD operations and search
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { eq, and, or, like, ilike, sql, asc, desc } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import {
  authMiddleware,
  optionalAuthMiddleware,
  getCurrentUserId,
} from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const recipes = new Hono();

// ============================================
// Validation Schemas
// ============================================

const recipeSearchSchema = z.object({
  q: z.string().optional(),
  cuisine: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  maxPrepTime: z.coerce.number().min(1).optional(),
  maxCookTime: z.coerce.number().min(1).optional(),
  dietary: z.string().optional(), // Comma-separated IDs
  tags: z.string().optional(), // Comma-separated tags
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'prepTime', 'rating', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const createRecipeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  instructions: z.array(z.string()).min(1),
  prepTime: z.number().min(1),
  cookTime: z.number().min(0),
  servings: z.number().min(1).max(100).default(4),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  cuisine: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  ingredients: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().positive(),
      unit: z.string().max(50),
      notes: z.string().max(255).optional(),
      isOptional: z.boolean().default(false),
    })
  ),
  tags: z.array(z.string()).max(20).default([]),
  isPublic: z.boolean().default(true),
});

const updateRecipeSchema = createRecipeSchema.partial();

const scaleRecipeSchema = z.object({
  targetServings: z.number().min(1).max(100),
});

// ============================================
// Routes
// ============================================

/**
 * GET /recipes
 * List recipes with filtering and pagination
 */
recipes.get('/', optionalAuthMiddleware, rateLimiters.public, async (c) => {
  const query = c.req.query();
  const params = recipeSearchSchema.parse(query);

  const {
    q,
    cuisine,
    difficulty,
    maxPrepTime,
    maxCookTime,
    dietary,
    tags,
    page,
    pageSize,
    sort,
    order,
  } = params;

  // Build where conditions
  const conditions = [eq(schema.recipes.isPublic, true)];

  if (q) {
    conditions.push(
      or(
        ilike(schema.recipes.name, `%${q}%`),
        ilike(schema.recipes.description, `%${q}%`)
      )!
    );
  }

  if (cuisine) {
    conditions.push(eq(schema.recipes.cuisine, cuisine));
  }

  if (difficulty) {
    conditions.push(eq(schema.recipes.difficulty, difficulty));
  }

  if (maxPrepTime) {
    conditions.push(sql`${schema.recipes.prepTime} <= ${maxPrepTime}`);
  }

  if (maxCookTime) {
    conditions.push(sql`${schema.recipes.cookTime} <= ${maxCookTime}`);
  }

  if (tags) {
    const tagList = tags.split(',').map((t) => t.trim());
    // Filter recipes that have any of the specified tags
    conditions.push(
      sql`${schema.recipes.tags} ?| array[${sql.raw(tagList.map((t) => `'${t}'`).join(','))}]`
    );
  }

  // Count total
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.recipes)
    .where(and(...conditions));

  const total = Number(countResult[0]?.count || 0);

  // Get sorting
  const sortField =
    sort === 'prepTime'
      ? schema.recipes.prepTime
      : sort === 'rating'
        ? schema.recipes.rating
        : sort === 'name'
          ? schema.recipes.name
          : schema.recipes.createdAt;

  const orderFn = order === 'asc' ? asc : desc;

  // Get recipes
  const offset = (page - 1) * pageSize;
  const recipeList = await db.query.recipes.findMany({
    where: and(...conditions),
    orderBy: [orderFn(sortField)],
    limit: pageSize,
    offset,
    columns: {
      id: true,
      name: true,
      description: true,
      prepTime: true,
      cookTime: true,
      servings: true,
      difficulty: true,
      cuisine: true,
      imageUrl: true,
      tags: true,
      rating: true,
      reviewCount: true,
      createdAt: true,
    },
  });

  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    success: true,
    data: recipeList,
    meta: {
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
    },
  });
});

/**
 * GET /recipes/search
 * Search recipes by query
 */
recipes.get('/search', optionalAuthMiddleware, rateLimiters.public, async (c) => {
  const q = c.req.query('q');

  if (!q || q.length < 2) {
    throw new HTTPException(400, {
      message: 'Search query must be at least 2 characters',
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  const recipeList = await db.query.recipes.findMany({
    where: and(
      eq(schema.recipes.isPublic, true),
      or(
        ilike(schema.recipes.name, `%${q}%`),
        ilike(schema.recipes.description, `%${q}%`)
      )
    ),
    orderBy: [desc(schema.recipes.rating)],
    limit: 20,
    columns: {
      id: true,
      name: true,
      description: true,
      prepTime: true,
      cookTime: true,
      difficulty: true,
      cuisine: true,
      imageUrl: true,
      rating: true,
    },
  });

  return c.json({
    success: true,
    data: recipeList,
  });
});

/**
 * GET /recipes/:id
 * Get recipe details with ingredients
 */
recipes.get('/:id', optionalAuthMiddleware, rateLimiters.public, async (c) => {
  const id = c.req.param('id');

  // Validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HTTPException(400, {
      message: 'Invalid recipe ID format',
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  const recipe = await db.query.recipes.findFirst({
    where: eq(schema.recipes.id, id),
    with: {
      ingredients: {
        with: {
          ingredient: true,
        },
      },
      author: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!recipe) {
    throw new HTTPException(404, {
      message: 'Recipe not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Check if user can view private recipe
  const userId = c.get('userId');
  if (!recipe.isPublic && recipe.authorId !== userId) {
    throw new HTTPException(404, {
      message: 'Recipe not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  return c.json({
    success: true,
    data: {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      imageUrl: recipe.imageUrl,
      sourceUrl: recipe.sourceUrl,
      nutritionData: recipe.nutritionData,
      ingredients: recipe.ingredients.map((ri) => ({
        id: ri.id,
        name: ri.ingredient.name,
        quantity: parseFloat(ri.quantity),
        unit: ri.unit,
        notes: ri.notes,
        isOptional: ri.isOptional,
        category: ri.ingredient.category,
      })),
      tags: recipe.tags,
      rating: recipe.rating ? parseFloat(recipe.rating) : null,
      reviewCount: recipe.reviewCount,
      author: recipe.author,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    },
  });
});

/**
 * POST /recipes
 * Create a new recipe (authenticated users)
 */
recipes.post('/', authMiddleware, rateLimiters.authenticated, async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const data = createRecipeSchema.parse(body);

  // Validate ingredient IDs
  const ingredientIds = data.ingredients.map((i) => i.ingredientId);
  const existingIngredients = await db.query.ingredients.findMany({
    where: sql`${schema.ingredients.id} IN ${ingredientIds}`,
    columns: { id: true },
  });

  const existingIds = new Set(existingIngredients.map((i) => i.id));
  const missingIds = ingredientIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    throw new HTTPException(400, {
      message: `Invalid ingredient IDs: ${missingIds.join(', ')}`,
      cause: { code: 'VALIDATION_ERROR' },
    });
  }

  // Create recipe
  const [newRecipe] = await db
    .insert(schema.recipes)
    .values({
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      prepTime: data.prepTime,
      cookTime: data.cookTime,
      servings: data.servings,
      difficulty: data.difficulty,
      cuisine: data.cuisine,
      imageUrl: data.imageUrl,
      sourceUrl: data.sourceUrl,
      tags: data.tags,
      isPublic: data.isPublic,
      authorId: userId,
    })
    .returning();

  // Create recipe ingredients
  if (data.ingredients.length > 0) {
    await db.insert(schema.recipeIngredients).values(
      data.ingredients.map((ing) => ({
        recipeId: newRecipe.id,
        ingredientId: ing.ingredientId,
        quantity: ing.quantity.toString(),
        unit: ing.unit,
        notes: ing.notes,
        isOptional: ing.isOptional,
      }))
    );
  }

  return c.json(
    {
      success: true,
      data: {
        id: newRecipe.id,
        name: newRecipe.name,
        createdAt: newRecipe.createdAt,
      },
    },
    201
  );
});

/**
 * PUT /recipes/:id
 * Update a recipe (owner only)
 */
recipes.put('/:id', authMiddleware, rateLimiters.authenticated, async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateRecipeSchema.parse(body);

  // Check recipe exists and user owns it
  const recipe = await db.query.recipes.findFirst({
    where: eq(schema.recipes.id, id),
  });

  if (!recipe) {
    throw new HTTPException(404, {
      message: 'Recipe not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  if (recipe.authorId !== userId) {
    throw new HTTPException(403, {
      message: 'You can only edit your own recipes',
      cause: { code: 'AUTH_INSUFFICIENT_PERMISSIONS' },
    });
  }

  // Update recipe
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.instructions !== undefined) updates.instructions = data.instructions;
  if (data.prepTime !== undefined) updates.prepTime = data.prepTime;
  if (data.cookTime !== undefined) updates.cookTime = data.cookTime;
  if (data.servings !== undefined) updates.servings = data.servings;
  if (data.difficulty !== undefined) updates.difficulty = data.difficulty;
  if (data.cuisine !== undefined) updates.cuisine = data.cuisine;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
  if (data.sourceUrl !== undefined) updates.sourceUrl = data.sourceUrl;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.isPublic !== undefined) updates.isPublic = data.isPublic;

  await db.update(schema.recipes).set(updates).where(eq(schema.recipes.id, id));

  // Update ingredients if provided
  if (data.ingredients) {
    // Delete existing ingredients
    await db
      .delete(schema.recipeIngredients)
      .where(eq(schema.recipeIngredients.recipeId, id));

    // Insert new ingredients
    if (data.ingredients.length > 0) {
      await db.insert(schema.recipeIngredients).values(
        data.ingredients.map((ing) => ({
          recipeId: id,
          ingredientId: ing.ingredientId,
          quantity: ing.quantity.toString(),
          unit: ing.unit,
          notes: ing.notes,
          isOptional: ing.isOptional,
        }))
      );
    }
  }

  return c.json({
    success: true,
    data: {
      id,
      message: 'Recipe updated successfully',
    },
  });
});

/**
 * DELETE /recipes/:id
 * Delete a recipe (owner only)
 */
recipes.delete('/:id', authMiddleware, rateLimiters.authenticated, async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');

  // Check recipe exists and user owns it
  const recipe = await db.query.recipes.findFirst({
    where: eq(schema.recipes.id, id),
  });

  if (!recipe) {
    throw new HTTPException(404, {
      message: 'Recipe not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  if (recipe.authorId !== userId) {
    throw new HTTPException(403, {
      message: 'You can only delete your own recipes',
      cause: { code: 'AUTH_INSUFFICIENT_PERMISSIONS' },
    });
  }

  await db.delete(schema.recipes).where(eq(schema.recipes.id, id));

  return c.body(null, 204);
});

/**
 * POST /recipes/:id/scale
 * Get recipe scaled to different servings
 */
recipes.post('/:id/scale', optionalAuthMiddleware, rateLimiters.public, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { targetServings } = scaleRecipeSchema.parse(body);

  // Get recipe with ingredients
  const recipe = await db.query.recipes.findFirst({
    where: eq(schema.recipes.id, id),
    with: {
      ingredients: {
        with: {
          ingredient: true,
        },
      },
    },
  });

  if (!recipe) {
    throw new HTTPException(404, {
      message: 'Recipe not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  const scaleFactor = targetServings / recipe.servings;

  return c.json({
    success: true,
    data: {
      originalServings: recipe.servings,
      targetServings,
      scaleFactor,
      ingredients: recipe.ingredients.map((ri) => ({
        name: ri.ingredient.name,
        quantity: parseFloat(ri.quantity) * scaleFactor,
        unit: ri.unit,
        notes: ri.notes,
      })),
    },
  });
});

export default recipes;
