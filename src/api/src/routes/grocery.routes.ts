/**
 * Grocery List Routes
 * Grocery list management and optimization
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { authMiddleware, getCurrentUserId } from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const grocery = new Hono();

// Apply auth middleware to all routes
grocery.use('*', authMiddleware);
grocery.use('*', rateLimiters.authenticated);

// ============================================
// Validation Schemas
// ============================================

const createGroceryListSchema = z.object({
  name: z.string().min(1).max(255),
  mealPlanId: z.string().uuid().optional(),
  supermarketId: z.string().uuid().optional(),
});

const fromMealPlanSchema = z.object({
  supermarketId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  optimizationStrategy: z.enum(['single_store', 'multi_store']).default('single_store'),
  consolidateQuantities: z.boolean().default(true),
});

const updateItemSchema = z.object({
  isChecked: z.boolean().optional(),
  quantity: z.number().positive().optional(),
  notes: z.string().max(255).optional(),
});

const substituteProductSchema = z.object({
  newProductId: z.string().uuid(),
});

const optimizeSchema = z.object({
  strategy: z.enum(['single_store', 'multi_store']).default('single_store'),
  maxStores: z.number().min(1).max(5).default(2),
});

const addItemSchema = z.object({
  displayName: z.string().min(1).max(255),
  quantity: z.number().positive(),
  unit: z.string().max(50),
  productId: z.string().uuid().optional(),
  ingredientId: z.string().uuid().optional(),
  notes: z.string().max(255).optional(),
});

// ============================================
// Routes
// ============================================

/**
 * GET /grocery-lists
 * List user's grocery lists
 */
grocery.get('/', async (c) => {
  const userId = getCurrentUserId(c);

  const lists = await db.query.groceryLists.findMany({
    where: eq(schema.groceryLists.userId, userId),
    orderBy: [desc(schema.groceryLists.createdAt)],
    with: {
      supermarket: {
        columns: {
          id: true,
          name: true,
        },
      },
      items: {
        columns: {
          id: true,
        },
      },
    },
  });

  return c.json({
    success: true,
    data: lists.map((list) => ({
      id: list.id,
      name: list.name,
      mealPlanId: list.mealPlanId,
      status: list.status,
      itemCount: list.items.length,
      totalPrice: list.totalPrice,
      totalPriceFormatted: list.totalPrice ? formatPrice(list.totalPrice) : null,
      supermarket: list.supermarket,
      createdAt: list.createdAt,
    })),
  });
});

/**
 * GET /grocery-lists/:id
 * Get grocery list with items
 */
grocery.get('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');

  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
    with: {
      supermarket: true,
      items: {
        with: {
          product: {
            with: {
              supermarket: {
                columns: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
          ingredient: true,
        },
        orderBy: [schema.groceryListItems.sortOrder],
      },
    },
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Calculate summary by category
  const byCategory: Record<string, { items: number; price: number }> = {};
  let totalPrice = 0;
  let checkedItems = 0;

  for (const item of list.items) {
    const category = item.product?.category || 'Other';
    if (!byCategory[category]) {
      byCategory[category] = { items: 0, price: 0 };
    }
    byCategory[category].items++;
    byCategory[category].price += item.price || 0;
    totalPrice += item.price || 0;
    if (item.isChecked) checkedItems++;
  }

  return c.json({
    success: true,
    data: {
      id: list.id,
      name: list.name,
      status: list.status,
      supermarket: list.supermarket,
      items: list.items.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        ingredient: item.ingredient
          ? {
              id: item.ingredient.id,
              name: item.ingredient.name,
            }
          : null,
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              brand: item.product.brand,
              price: item.product.price,
              imageUrl: item.product.imageUrl,
              supermarket: item.product.supermarket,
            }
          : null,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        price: item.price,
        isChecked: item.isChecked,
        isSubstituted: item.isSubstituted,
        notes: item.notes,
        sortOrder: item.sortOrder,
      })),
      summary: {
        totalItems: list.items.length,
        checkedItems,
        totalPrice,
        totalPriceFormatted: formatPrice(totalPrice),
        byCategory,
      },
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    },
  });
});

/**
 * POST /grocery-lists
 * Create a new grocery list
 */
grocery.post('/', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const data = createGroceryListSchema.parse(body);

  // Validate supermarket if provided
  if (data.supermarketId) {
    const supermarket = await db.query.supermarkets.findFirst({
      where: eq(schema.supermarkets.id, data.supermarketId),
    });

    if (!supermarket) {
      throw new HTTPException(400, {
        message: 'Invalid supermarket ID',
        cause: { code: 'SUPERMARKET_NOT_SUPPORTED' },
      });
    }
  }

  // Validate meal plan if provided
  if (data.mealPlanId) {
    const mealPlan = await db.query.mealPlans.findFirst({
      where: and(
        eq(schema.mealPlans.id, data.mealPlanId),
        eq(schema.mealPlans.userId, userId)
      ),
    });

    if (!mealPlan) {
      throw new HTTPException(400, {
        message: 'Meal plan not found',
        cause: { code: 'RESOURCE_NOT_FOUND' },
      });
    }
  }

  const [newList] = await db
    .insert(schema.groceryLists)
    .values({
      userId,
      name: data.name,
      mealPlanId: data.mealPlanId,
      selectedSupermarket: data.supermarketId,
      status: 'draft',
    })
    .returning();

  return c.json(
    {
      success: true,
      data: {
        id: newList.id,
        name: newList.name,
        status: newList.status,
        createdAt: newList.createdAt,
      },
    },
    201
  );
});

/**
 * POST /grocery-lists/from-meal-plan/:mealPlanId
 * Generate grocery list from meal plan
 */
grocery.post('/from-meal-plan/:mealPlanId', rateLimiters.matching, async (c) => {
  const userId = getCurrentUserId(c);
  const mealPlanId = c.req.param('mealPlanId');
  const body = await c.req.json();
  const data = fromMealPlanSchema.parse(body);

  // Verify meal plan ownership
  const mealPlan = await db.query.mealPlans.findFirst({
    where: and(
      eq(schema.mealPlans.id, mealPlanId),
      eq(schema.mealPlans.userId, userId)
    ),
    with: {
      entries: {
        with: {
          recipe: {
            with: {
              ingredients: {
                with: {
                  ingredient: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!mealPlan) {
    throw new HTTPException(404, {
      message: 'Meal plan not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Verify supermarket
  const supermarket = await db.query.supermarkets.findFirst({
    where: eq(schema.supermarkets.id, data.supermarketId),
  });

  if (!supermarket) {
    throw new HTTPException(400, {
      message: 'Invalid supermarket ID',
      cause: { code: 'SUPERMARKET_NOT_SUPPORTED' },
    });
  }

  // Aggregate ingredients from all meals
  const ingredientMap = new Map<
    string,
    {
      ingredientId: string;
      name: string;
      quantity: number;
      unit: string;
      category: string;
    }
  >();

  for (const entry of mealPlan.entries) {
    const scaleFactor = entry.servings / entry.recipe.servings;

    for (const recipeIng of entry.recipe.ingredients) {
      const key = data.consolidateQuantities
        ? `${recipeIng.ingredientId}-${recipeIng.unit}`
        : `${recipeIng.id}`;

      const quantity = parseFloat(recipeIng.quantity) * scaleFactor;

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.quantity += quantity;
      } else {
        ingredientMap.set(key, {
          ingredientId: recipeIng.ingredientId,
          name: recipeIng.ingredient.name,
          quantity,
          unit: recipeIng.unit,
          category: recipeIng.ingredient.category,
        });
      }
    }
  }

  // Create grocery list
  const listName =
    data.name ||
    `Shopping for ${mealPlan.name}`;

  const [newList] = await db
    .insert(schema.groceryLists)
    .values({
      userId,
      name: listName,
      mealPlanId,
      selectedSupermarket: data.supermarketId,
      status: 'ready',
    })
    .returning();

  // Find product matches for each ingredient
  const items: {
    groceryListId: string;
    ingredientId: string;
    productId: string | null;
    displayName: string;
    quantity: string;
    unit: string;
    price: number | null;
    sortOrder: number;
  }[] = [];

  let sortOrder = 0;
  let totalPrice = 0;

  for (const [, ing] of ingredientMap) {
    // Try to find a matching product
    const match = await db.query.productMatches.findFirst({
      where: eq(schema.productMatches.ingredientId, ing.ingredientId),
      orderBy: [desc(schema.productMatches.confidence)],
    });

    let productId: string | null = null;
    let price: number | null = null;

    if (match) {
      const product = await db.query.products.findFirst({
        where: and(
          eq(schema.products.id, match.productId),
          eq(schema.products.supermarketId, data.supermarketId)
        ),
      });

      if (product) {
        productId = product.id;
        // Calculate price based on quantity needed
        // This is simplified - real implementation would consider package sizes
        price = product.price;
        totalPrice += price;
      }
    }

    items.push({
      groceryListId: newList.id,
      ingredientId: ing.ingredientId,
      productId,
      displayName: ing.name,
      quantity: ing.quantity.toFixed(2),
      unit: ing.unit,
      price,
      sortOrder: sortOrder++,
    });
  }

  // Insert items
  if (items.length > 0) {
    await db.insert(schema.groceryListItems).values(items);
  }

  // Update total price
  await db
    .update(schema.groceryLists)
    .set({ totalPrice })
    .where(eq(schema.groceryLists.id, newList.id));

  return c.json(
    {
      success: true,
      data: {
        id: newList.id,
        name: newList.name,
        status: newList.status,
        itemCount: items.length,
        totalPrice,
        totalPriceFormatted: formatPrice(totalPrice),
        createdAt: newList.createdAt,
      },
    },
    201
  );
});

/**
 * POST /grocery-lists/:id/items
 * Add item to grocery list
 */
grocery.post('/:id/items', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = addItemSchema.parse(body);

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Get max sort order
  const maxOrderResult = await db
    .select({ max: sql<number>`coalesce(max(sort_order), 0)` })
    .from(schema.groceryListItems)
    .where(eq(schema.groceryListItems.groceryListId, id));

  const sortOrder = (maxOrderResult[0]?.max || 0) + 1;

  // Get product price if productId provided
  let price: number | null = null;
  if (data.productId) {
    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, data.productId),
    });
    if (product) {
      price = product.price;
    }
  }

  const [newItem] = await db
    .insert(schema.groceryListItems)
    .values({
      groceryListId: id,
      displayName: data.displayName,
      quantity: data.quantity.toString(),
      unit: data.unit,
      productId: data.productId,
      ingredientId: data.ingredientId,
      price,
      notes: data.notes,
      sortOrder,
    })
    .returning();

  // Update total price
  await updateListTotalPrice(id);

  return c.json(
    {
      success: true,
      data: {
        id: newItem.id,
        displayName: newItem.displayName,
        quantity: parseFloat(newItem.quantity),
        unit: newItem.unit,
      },
    },
    201
  );
});

/**
 * PATCH /grocery-lists/:id/items/:itemId
 * Update a grocery list item
 */
grocery.patch('/:id/items/:itemId', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = await c.req.json();
  const data = updateItemSchema.parse(body);

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  const updates: Record<string, unknown> = {};

  if (data.isChecked !== undefined) {
    updates.isChecked = data.isChecked;
  }

  if (data.quantity !== undefined) {
    updates.quantity = data.quantity.toString();
  }

  if (data.notes !== undefined) {
    updates.notes = data.notes;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(schema.groceryListItems)
      .set(updates)
      .where(
        and(
          eq(schema.groceryListItems.id, itemId),
          eq(schema.groceryListItems.groceryListId, id)
        )
      );
  }

  // Update list timestamp
  await db
    .update(schema.groceryLists)
    .set({ updatedAt: new Date() })
    .where(eq(schema.groceryLists.id, id));

  return c.json({
    success: true,
    data: {
      id: itemId,
      message: 'Item updated successfully',
    },
  });
});

/**
 * POST /grocery-lists/:id/items/:itemId/substitute
 * Substitute a product
 */
grocery.post('/:id/items/:itemId/substitute', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = await c.req.json();
  const { newProductId } = substituteProductSchema.parse(body);

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Get current item
  const item = await db.query.groceryListItems.findFirst({
    where: and(
      eq(schema.groceryListItems.id, itemId),
      eq(schema.groceryListItems.groceryListId, id)
    ),
  });

  if (!item) {
    throw new HTTPException(404, {
      message: 'Item not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Get new product
  const newProduct = await db.query.products.findFirst({
    where: eq(schema.products.id, newProductId),
  });

  if (!newProduct) {
    throw new HTTPException(400, {
      message: 'Invalid product ID',
      cause: { code: 'PRODUCT_NOT_FOUND' },
    });
  }

  // Update item
  await db
    .update(schema.groceryListItems)
    .set({
      originalProductId: item.productId,
      productId: newProductId,
      price: newProduct.price,
      isSubstituted: true,
    })
    .where(eq(schema.groceryListItems.id, itemId));

  // Update total price
  await updateListTotalPrice(id);

  return c.json({
    success: true,
    data: {
      id: itemId,
      newProduct: {
        id: newProduct.id,
        name: newProduct.name,
        price: newProduct.price,
      },
    },
  });
});

/**
 * DELETE /grocery-lists/:id/items/:itemId
 * Remove an item from the list
 */
grocery.delete('/:id/items/:itemId', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  await db
    .delete(schema.groceryListItems)
    .where(
      and(
        eq(schema.groceryListItems.id, itemId),
        eq(schema.groceryListItems.groceryListId, id)
      )
    );

  // Update total price
  await updateListTotalPrice(id);

  return c.body(null, 204);
});

/**
 * POST /grocery-lists/:id/optimize
 * Re-optimize the grocery list
 */
grocery.post('/:id/optimize', rateLimiters.matching, async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = optimizeSchema.parse(body);

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
    with: {
      items: {
        with: {
          ingredient: true,
          product: true,
        },
      },
    },
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  const originalTotal = list.totalPrice || 0;

  if (data.strategy === 'single_store') {
    // Find best supermarket for the entire list
    const supermarkets = await db.query.supermarkets.findMany({
      where: eq(schema.supermarkets.scrapingEnabled, true),
    });

    let bestSupermarket = list.selectedSupermarket;
    let bestTotal = originalTotal;

    for (const supermarket of supermarkets) {
      let total = 0;
      let allFound = true;

      for (const item of list.items) {
        if (item.ingredientId) {
          // Find matching product
          const match = await db.query.productMatches.findFirst({
            where: eq(schema.productMatches.ingredientId, item.ingredientId),
          });

          if (match) {
            const product = await db.query.products.findFirst({
              where: and(
                eq(schema.products.id, match.productId),
                eq(schema.products.supermarketId, supermarket.id)
              ),
            });

            if (product) {
              total += product.price;
            } else {
              allFound = false;
            }
          }
        }
      }

      if (allFound && total < bestTotal) {
        bestTotal = total;
        bestSupermarket = supermarket.id;
      }
    }

    // Update list with optimized supermarket
    if (bestSupermarket !== list.selectedSupermarket) {
      await db
        .update(schema.groceryLists)
        .set({
          selectedSupermarket: bestSupermarket,
          totalPrice: bestTotal,
          updatedAt: new Date(),
        })
        .where(eq(schema.groceryLists.id, id));
    }

    const savings = originalTotal - bestTotal;

    return c.json({
      success: true,
      data: {
        originalTotal,
        optimizedTotal: bestTotal,
        savings,
        savingsPercent: originalTotal > 0 ? (savings / originalTotal) * 100 : 0,
        stores: [
          {
            supermarketId: bestSupermarket,
            itemCount: list.items.length,
            subtotal: bestTotal,
          },
        ],
      },
    });
  }

  // Multi-store optimization (simplified)
  // In real implementation, would use more sophisticated algorithms

  return c.json({
    success: true,
    data: {
      originalTotal,
      optimizedTotal: originalTotal,
      savings: 0,
      savingsPercent: 0,
      stores: [
        {
          supermarketId: list.selectedSupermarket,
          itemCount: list.items.length,
          subtotal: originalTotal,
        },
      ],
      message: 'Multi-store optimization not yet implemented',
    },
  });
});

/**
 * PUT /grocery-lists/:id
 * Update grocery list metadata
 */
grocery.put('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json();

  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    status: z.enum(['draft', 'ready', 'shopping', 'completed']).optional(),
  });

  const data = updateSchema.parse(body);

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.status !== undefined) updates.status = data.status;

  await db
    .update(schema.groceryLists)
    .set(updates)
    .where(eq(schema.groceryLists.id, id));

  return c.json({
    success: true,
    data: {
      id,
      message: 'Grocery list updated successfully',
    },
  });
});

/**
 * DELETE /grocery-lists/:id
 * Delete a grocery list
 */
grocery.delete('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  const id = c.req.param('id');

  // Verify ownership
  const list = await db.query.groceryLists.findFirst({
    where: and(
      eq(schema.groceryLists.id, id),
      eq(schema.groceryLists.userId, userId)
    ),
  });

  if (!list) {
    throw new HTTPException(404, {
      message: 'Grocery list not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  await db.delete(schema.groceryLists).where(eq(schema.groceryLists.id, id));

  return c.body(null, 204);
});

// ============================================
// Helper Functions
// ============================================

/**
 * Format price from cents to EUR string
 */
function formatPrice(priceCents: number): string {
  const euros = (priceCents / 100).toFixed(2);
  return `${euros} EUR`;
}

/**
 * Update grocery list total price
 */
async function updateListTotalPrice(listId: string): Promise<void> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(price), 0)` })
    .from(schema.groceryListItems)
    .where(eq(schema.groceryListItems.groceryListId, listId));

  const totalPrice = result[0]?.total || 0;

  await db
    .update(schema.groceryLists)
    .set({ totalPrice, updatedAt: new Date() })
    .where(eq(schema.groceryLists.id, listId));
}

export default grocery;
