/**
 * Product Routes
 * Product search, comparison, and supermarket data
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { eq, and, sql, ilike, asc, desc } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const products = new Hono();

// ============================================
// Validation Schemas
// ============================================

const productSearchSchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters'),
  supermarketId: z.string().uuid().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  onSale: z.coerce.boolean().optional(),
  organic: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['price', 'pricePerUnit', 'name', 'relevance']).default('relevance'),
});

const compareProductsSchema = z.object({
  ids: z.string().optional(),
  ingredientId: z.string().uuid().optional(),
  q: z.string().optional(),
});

const priceHistorySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

// ============================================
// Routes
// ============================================

/**
 * GET /products/supermarkets
 * List available supermarkets
 */
products.get('/supermarkets', optionalAuthMiddleware, rateLimiters.public, async (c) => {
  const supermarkets = await db.query.supermarkets.findMany({
    where: eq(schema.supermarkets.scrapingEnabled, true),
    orderBy: [asc(schema.supermarkets.name)],
  });

  return c.json({
    success: true,
    data: supermarkets.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      domain: s.domain,
      logoUrl: s.logoUrl,
      color: s.color,
      productCount: s.productCount,
      lastUpdated: s.lastScrapedAt,
    })),
  });
});

/**
 * GET /products/search
 * Search products across supermarkets
 */
products.get(
  '/search',
  optionalAuthMiddleware,
  rateLimiters.productSearch,
  async (c) => {
    const query = c.req.query();
    const params = productSearchSchema.parse(query);

    const {
      q,
      supermarketId,
      category,
      minPrice,
      maxPrice,
      inStock,
      onSale,
      organic,
      page,
      pageSize,
      sort,
    } = params;

    // Build conditions
    const conditions = [ilike(schema.products.name, `%${q}%`)];

    if (supermarketId) {
      conditions.push(eq(schema.products.supermarketId, supermarketId));
    }

    if (category) {
      conditions.push(eq(schema.products.category, category));
    }

    if (minPrice !== undefined) {
      conditions.push(sql`${schema.products.price} >= ${minPrice}`);
    }

    if (maxPrice !== undefined) {
      conditions.push(sql`${schema.products.price} <= ${maxPrice}`);
    }

    if (inStock) {
      conditions.push(eq(schema.products.availability, 'in_stock'));
    }

    if (onSale) {
      conditions.push(eq(schema.products.isOnSale, true));
    }

    if (organic) {
      conditions.push(eq(schema.products.isOrganic, true));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // Determine sort order
    let orderBy;
    switch (sort) {
      case 'price':
        orderBy = [asc(schema.products.price)];
        break;
      case 'pricePerUnit':
        orderBy = [asc(schema.products.pricePerUnit)];
        break;
      case 'name':
        orderBy = [asc(schema.products.name)];
        break;
      default:
        // Relevance - would ideally use full-text search ranking
        orderBy = [asc(schema.products.name)];
    }

    // Get products
    const offset = (page - 1) * pageSize;
    const productList = await db.query.products.findMany({
      where: and(...conditions),
      orderBy,
      limit: pageSize,
      offset,
      with: {
        supermarket: {
          columns: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      data: productList.map((p) => ({
        id: p.id,
        supermarket: p.supermarket,
        name: p.name,
        brand: p.brand,
        price: p.price,
        priceFormatted: formatPrice(p.price),
        pricePerUnit: p.pricePerUnit,
        pricePerUnitFormatted: p.pricePerUnit
          ? `${formatPrice(p.pricePerUnit)}/${p.unit}`
          : null,
        unit: p.unit,
        unitQuantity: p.unitQuantity,
        category: p.category,
        imageUrl: p.imageUrl,
        availability: p.availability,
        isOnSale: p.isOnSale,
        salePrice: p.salePrice,
        salePriceFormatted: p.salePrice ? formatPrice(p.salePrice) : null,
        isOrganic: p.isOrganic,
      })),
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
  }
);

/**
 * GET /products/:id
 * Get product details
 */
products.get('/:id', optionalAuthMiddleware, rateLimiters.public, async (c) => {
  const id = c.req.param('id');

  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, id),
    with: {
      supermarket: true,
      priceHistory: {
        orderBy: [desc(schema.priceHistory.recordedAt)],
        limit: 30,
      },
    },
  });

  if (!product) {
    throw new HTTPException(404, {
      message: 'Product not found',
      cause: { code: 'PRODUCT_NOT_FOUND' },
    });
  }

  return c.json({
    success: true,
    data: {
      id: product.id,
      supermarket: {
        id: product.supermarket.id,
        name: product.supermarket.name,
        domain: product.supermarket.domain,
        color: product.supermarket.color,
      },
      name: product.name,
      brand: product.brand,
      description: product.description,
      price: product.price,
      priceFormatted: formatPrice(product.price),
      pricePerUnit: product.pricePerUnit,
      pricePerUnitFormatted: product.pricePerUnit
        ? `${formatPrice(product.pricePerUnit)}/${product.unit}`
        : null,
      unit: product.unit,
      unitQuantity: product.unitQuantity,
      category: product.category,
      subcategory: product.subcategory,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      availability: product.availability,
      isOrganic: product.isOrganic,
      isOnSale: product.isOnSale,
      salePrice: product.salePrice,
      salePriceFormatted: product.salePrice ? formatPrice(product.salePrice) : null,
      saleEndDate: product.saleEndDate,
      nutritionData: product.nutritionData,
      priceHistory: product.priceHistory.map((ph) => ({
        date: ph.recordedAt,
        price: ph.price,
        isPromotion: ph.isPromotion,
        promotionName: ph.promotionName,
      })),
      lastUpdated: product.lastScrapedAt,
    },
  });
});

/**
 * GET /products/:id/price-history
 * Get detailed price history
 */
products.get(
  '/:id/price-history',
  optionalAuthMiddleware,
  rateLimiters.public,
  async (c) => {
    const id = c.req.param('id');
    const query = c.req.query();
    const { days } = priceHistorySchema.parse(query);

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = await db.query.priceHistory.findMany({
      where: and(
        eq(schema.priceHistory.productId, id),
        sql`${schema.priceHistory.recordedAt} >= ${cutoffDate}`
      ),
      orderBy: [desc(schema.priceHistory.recordedAt)],
    });

    if (history.length === 0) {
      // Check if product exists
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, id),
        columns: { id: true },
      });

      if (!product) {
        throw new HTTPException(404, {
          message: 'Product not found',
          cause: { code: 'PRODUCT_NOT_FOUND' },
        });
      }
    }

    // Calculate statistics
    const prices = history.map((h) => h.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : 0;

    return c.json({
      success: true,
      data: {
        productId: id,
        days,
        history: history.map((h) => ({
          date: h.recordedAt,
          price: h.price,
          pricePerUnit: h.pricePerUnit,
          isPromotion: h.isPromotion,
          promotionName: h.promotionName,
        })),
        statistics: {
          minPrice,
          maxPrice,
          avgPrice,
          priceChange: prices.length >= 2 ? prices[0] - prices[prices.length - 1] : 0,
          dataPoints: history.length,
        },
      },
    });
  }
);

/**
 * GET /products/compare
 * Compare prices across supermarkets
 */
products.get(
  '/compare',
  optionalAuthMiddleware,
  rateLimiters.public,
  async (c) => {
    const query = c.req.query();
    const params = compareProductsSchema.parse(query);

    if (!params.ids && !params.ingredientId && !params.q) {
      throw new HTTPException(400, {
        message: 'Either ids, ingredientId, or q parameter is required',
        cause: { code: 'VALIDATION_ERROR' },
      });
    }

    let searchQuery = params.q || '';

    // If ingredientId provided, get ingredient name
    if (params.ingredientId) {
      const ingredient = await db.query.ingredients.findFirst({
        where: eq(schema.ingredients.id, params.ingredientId),
      });

      if (!ingredient) {
        throw new HTTPException(404, {
          message: 'Ingredient not found',
          cause: { code: 'RESOURCE_NOT_FOUND' },
        });
      }

      searchQuery = ingredient.name;
    }

    // If product IDs provided, get those specific products
    if (params.ids) {
      const productIds = params.ids.split(',').map((id) => id.trim());

      const productList = await db.query.products.findMany({
        where: sql`${schema.products.id} IN ${productIds}`,
        with: {
          supermarket: {
            columns: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Sort by price
      productList.sort((a, b) => a.price - b.price);
      const bestMatch = productList[0];

      return c.json({
        success: true,
        data: {
          query: 'Product comparison',
          bestMatch: bestMatch
            ? {
                supermarket: bestMatch.supermarket.name,
                product: {
                  id: bestMatch.id,
                  name: bestMatch.name,
                  brand: bestMatch.brand,
                },
                price: bestMatch.price,
              }
            : null,
          comparisons: productList.map((p) => ({
            supermarket: p.supermarket,
            product: {
              id: p.id,
              name: p.name,
              brand: p.brand,
              imageUrl: p.imageUrl,
            },
            price: p.price,
            pricePerUnit: p.pricePerUnit,
            savingsVsBest: bestMatch ? p.price - bestMatch.price : 0,
          })),
        },
      });
    }

    // Search products by query across supermarkets
    const productList = await db.query.products.findMany({
      where: ilike(schema.products.name, `%${searchQuery}%`),
      orderBy: [asc(schema.products.price)],
      limit: 20,
      with: {
        supermarket: {
          columns: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // Group by supermarket and get best price from each
    const bySupermarket = new Map<
      string,
      (typeof productList)[0]
    >();

    for (const product of productList) {
      const existing = bySupermarket.get(product.supermarketId);
      if (!existing || product.price < existing.price) {
        bySupermarket.set(product.supermarketId, product);
      }
    }

    const comparisons = Array.from(bySupermarket.values()).sort(
      (a, b) => a.price - b.price
    );

    const bestMatch = comparisons[0];

    return c.json({
      success: true,
      data: {
        query: searchQuery,
        bestMatch: bestMatch
          ? {
              supermarket: bestMatch.supermarket.name,
              product: {
                id: bestMatch.id,
                name: bestMatch.name,
                brand: bestMatch.brand,
              },
              price: bestMatch.price,
            }
          : null,
        comparisons: comparisons.map((p) => ({
          supermarket: p.supermarket,
          product: {
            id: p.id,
            name: p.name,
            brand: p.brand,
            imageUrl: p.imageUrl,
          },
          price: p.price,
          pricePerUnit: p.pricePerUnit,
          savingsVsBest: bestMatch ? p.price - bestMatch.price : 0,
        })),
      },
    });
  }
);

/**
 * GET /products/categories
 * List product categories
 */
products.get(
  '/categories',
  optionalAuthMiddleware,
  rateLimiters.public,
  async (c) => {
    const supermarketId = c.req.query('supermarketId');

    let query = db
      .select({
        category: schema.products.category,
        count: sql<number>`count(*)`,
      })
      .from(schema.products)
      .groupBy(schema.products.category)
      .orderBy(asc(schema.products.category));

    if (supermarketId) {
      query = query.where(eq(schema.products.supermarketId, supermarketId)) as typeof query;
    }

    const categories = await query;

    return c.json({
      success: true,
      data: categories
        .filter((c) => c.category)
        .map((c) => ({
          name: c.category,
          productCount: Number(c.count),
        })),
    });
  }
);

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

export default products;
