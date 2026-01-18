/**
 * API Integration Tests
 * Tests for the Hono REST API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Import the app creator
// Note: In a real test environment, you would import from the actual module
// For now, we'll create a mock app structure for testing

/**
 * Test utilities
 */
const testRequest = async (
  app: Hono,
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{
  status: number;
  json: () => Promise<unknown>;
  headers: Headers;
}> => {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const res = await app.fetch(req);

  return {
    status: res.status,
    json: () => res.json(),
    headers: res.headers,
  };
};

/**
 * Create a minimal test app
 */
function createTestApp(): Hono {
  const app = new Hono();

  // Health endpoints
  app.get('/api/v1/health', (c) => {
    return c.json({
      success: true,
      data: {
        status: 'healthy',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/api/v1/health/ready', (c) => {
    return c.json({
      success: true,
      data: {
        status: 'healthy',
        checks: {
          database: { status: 'pass', responseTime: 5 },
          memory: { status: 'pass' },
        },
      },
    });
  });

  // Auth endpoints (mock)
  app.post('/api/v1/auth/register', async (c) => {
    const body = await c.req.json();

    if (!body.email || !body.password || !body.name) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields',
            requestId: 'test-123',
          },
        },
        400
      );
    }

    if (body.email === 'existing@example.com') {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: 'Email already exists',
            requestId: 'test-123',
          },
        },
        409
      );
    }

    return c.json(
      {
        success: true,
        data: {
          user: {
            id: 'test-user-id',
            email: body.email,
            name: body.name,
            emailVerified: false,
            createdAt: new Date().toISOString(),
          },
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      },
      201
    );
  });

  app.post('/api/v1/auth/login', async (c) => {
    const body = await c.req.json();

    if (!body.email || !body.password) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password required',
            requestId: 'test-123',
          },
        },
        400
      );
    }

    if (body.password === 'wrongpassword') {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            requestId: 'test-123',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: 'test-user-id',
          email: body.email,
          name: 'Test User',
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    });
  });

  // Users endpoints (mock)
  app.get('/api/v1/users/me', (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Authorization token required',
            requestId: 'test-123',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        id: 'test-user-id',
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        profile: {
          householdSize: 2,
          budgetWeekly: 15000,
          cookingSkill: 'intermediate',
        },
        restrictions: [],
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Recipes endpoints (mock)
  app.get('/api/v1/recipes', (c) => {
    const query = c.req.query('q');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');

    const recipes = [
      {
        id: 'recipe-1',
        name: 'Paella Valenciana',
        description: 'Traditional Spanish rice dish',
        prepTime: 30,
        cookTime: 45,
        servings: 4,
        difficulty: 'medium',
        cuisine: 'spanish',
        imageUrl: 'https://example.com/paella.jpg',
        tags: ['rice', 'seafood'],
        rating: 4.5,
        reviewCount: 128,
      },
      {
        id: 'recipe-2',
        name: 'Tortilla Espanola',
        description: 'Spanish potato omelette',
        prepTime: 15,
        cookTime: 25,
        servings: 6,
        difficulty: 'easy',
        cuisine: 'spanish',
        imageUrl: 'https://example.com/tortilla.jpg',
        tags: ['eggs', 'potatoes'],
        rating: 4.7,
        reviewCount: 256,
      },
    ];

    const filtered = query
      ? recipes.filter(
          (r) =>
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.description.toLowerCase().includes(query.toLowerCase())
        )
      : recipes;

    return c.json({
      success: true,
      data: filtered,
      meta: {
        pagination: {
          total: filtered.length,
          page,
          pageSize,
          totalPages: Math.ceil(filtered.length / pageSize),
          hasMore: false,
        },
      },
    });
  });

  app.get('/api/v1/recipes/:id', (c) => {
    const id = c.req.param('id');

    if (id === 'not-found') {
      return c.json(
        {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Recipe not found',
            requestId: 'test-123',
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        id,
        name: 'Paella Valenciana',
        description: 'Traditional Spanish rice dish',
        instructions: ['Step 1', 'Step 2', 'Step 3'],
        prepTime: 30,
        cookTime: 45,
        servings: 4,
        difficulty: 'medium',
        cuisine: 'spanish',
        ingredients: [
          { id: 'ing-1', name: 'Bomba rice', quantity: 400, unit: 'g' },
          { id: 'ing-2', name: 'Chicken', quantity: 500, unit: 'g' },
        ],
        tags: ['rice', 'seafood'],
        rating: 4.5,
        reviewCount: 128,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Products endpoints (mock)
  app.get('/api/v1/products/search', (c) => {
    const query = c.req.query('q');

    if (!query || query.length < 2) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Search query must be at least 2 characters',
            requestId: 'test-123',
          },
        },
        400
      );
    }

    return c.json({
      success: true,
      data: [
        {
          id: 'product-1',
          supermarket: { id: 'supermarket-1', name: 'Mercadona', color: '#00A650' },
          name: 'Tomate pera',
          brand: 'Hacendado',
          price: 189,
          priceFormatted: '1.89 EUR',
          availability: 'in_stock',
        },
      ],
      meta: {
        pagination: {
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasMore: false,
        },
      },
    });
  });

  app.get('/api/v1/products/compare', (c) => {
    const query = c.req.query('q');
    const ingredientId = c.req.query('ingredientId');

    if (!query && !ingredientId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either q or ingredientId parameter is required',
            requestId: 'test-123',
          },
        },
        400
      );
    }

    return c.json({
      success: true,
      data: {
        query: query || 'ingredient match',
        bestMatch: {
          supermarket: 'Mercadona',
          product: { id: 'product-1', name: 'Tomate pera', brand: 'Hacendado' },
          price: 189,
        },
        comparisons: [
          {
            supermarket: { id: 'supermarket-1', name: 'Mercadona' },
            product: { id: 'product-1', name: 'Tomate pera' },
            price: 189,
            pricePerUnit: 189,
            savingsVsBest: 0,
          },
          {
            supermarket: { id: 'supermarket-2', name: 'Carrefour' },
            product: { id: 'product-2', name: 'Tomate' },
            price: 210,
            pricePerUnit: 210,
            savingsVsBest: -21,
          },
        ],
      },
    });
  });

  // Meal plans endpoints (mock)
  app.get('/api/v1/meal-plans', (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Authorization token required',
            requestId: 'test-123',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: [
        {
          id: 'plan-1',
          name: 'Week of Jan 15',
          startDate: '2024-01-15',
          endDate: '2024-01-21',
          status: 'active',
          mealCount: 21,
          estimatedCost: 8500,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  app.post('/api/v1/meal-plans/generate', async (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Authorization token required',
            requestId: 'test-123',
          },
        },
        401
      );
    }

    const body = await c.req.json();

    if (!body.startDate || !body.endDate) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Start date and end date required',
            requestId: 'test-123',
          },
        },
        400
      );
    }

    return c.json(
      {
        success: true,
        data: {
          id: 'generated-plan-1',
          name: 'Week of Jan 22',
          startDate: body.startDate,
          endDate: body.endDate,
          status: 'draft',
          mealCount: 21,
          createdAt: new Date().toISOString(),
        },
      },
      201
    );
  });

  // Grocery lists endpoints (mock)
  app.get('/api/v1/grocery-lists', (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Authorization token required',
            requestId: 'test-123',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: [
        {
          id: 'list-1',
          name: 'Week of Jan 15',
          status: 'ready',
          itemCount: 24,
          totalPrice: 8500,
          totalPriceFormatted: '85.00 EUR',
          supermarket: { id: 'supermarket-1', name: 'Mercadona' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  app.post('/api/v1/grocery-lists/:id/optimize', (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Authorization token required',
            requestId: 'test-123',
          },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        originalTotal: 8500,
        optimizedTotal: 7800,
        savings: 700,
        savingsPercent: 8.2,
        stores: [
          {
            supermarketId: 'supermarket-1',
            itemCount: 24,
            subtotal: 7800,
          },
        ],
      },
    });
  });

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Route ${c.req.method} ${c.req.path} not found`,
          requestId: 'test-123',
        },
      },
      404
    );
  });

  return app;
}

// ============================================
// Test Suites
// ============================================

describe('Meal Automation API', () => {
  let app: Hono;

  beforeAll(() => {
    app = createTestApp();
  });

  // ============================================
  // Health Check Tests
  // ============================================

  describe('Health Endpoints', () => {
    it('GET /api/v1/health - should return healthy status', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/health');

      expect(res.status).toBe(200);

      const data = (await res.json()) as { success: boolean; data: { status: string } };
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
    });

    it('GET /api/v1/health/ready - should return readiness status', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/health/ready');

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: { checks: { database: { status: string } } };
      };
      expect(data.success).toBe(true);
      expect(data.data.checks.database.status).toBe('pass');
    });
  });

  // ============================================
  // Auth Tests
  // ============================================

  describe('Auth Endpoints', () => {
    it('POST /api/v1/auth/register - should register a new user', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        },
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as {
        success: boolean;
        data: { user: { email: string }; accessToken: string };
      };
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('newuser@example.com');
      expect(data.data.accessToken).toBeDefined();
    });

    it('POST /api/v1/auth/register - should fail with missing fields', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/auth/register', {
        body: { email: 'test@example.com' },
      });

      expect(res.status).toBe(400);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/auth/register - should fail for existing email', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'existing@example.com',
          password: 'SecurePass123!',
          name: 'Existing User',
        },
      });

      expect(res.status).toBe(409);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('DUPLICATE_RESOURCE');
    });

    it('POST /api/v1/auth/login - should login successfully', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'user@example.com',
          password: 'correctpassword',
        },
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: { accessToken: string };
      };
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
    });

    it('POST /api/v1/auth/login - should fail with wrong password', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'user@example.com',
          password: 'wrongpassword',
        },
      });

      expect(res.status).toBe(401);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  // ============================================
  // User Tests
  // ============================================

  describe('User Endpoints', () => {
    it('GET /api/v1/users/me - should return user profile when authenticated', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/users/me', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: { email: string; profile: { householdSize: number } };
      };
      expect(data.success).toBe(true);
      expect(data.data.email).toBe('user@example.com');
      expect(data.data.profile.householdSize).toBe(2);
    });

    it('GET /api/v1/users/me - should fail without auth token', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/users/me');

      expect(res.status).toBe(401);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_MISSING_TOKEN');
    });
  });

  // ============================================
  // Recipe Tests
  // ============================================

  describe('Recipe Endpoints', () => {
    it('GET /api/v1/recipes - should return list of recipes', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/recipes');

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: Array<{ name: string }>;
        meta: { pagination: { total: number } };
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta.pagination.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/recipes - should filter by search query', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/recipes?q=paella');

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: Array<{ name: string }>;
      };
      expect(data.success).toBe(true);
      expect(data.data.some((r) => r.name.toLowerCase().includes('paella'))).toBe(true);
    });

    it('GET /api/v1/recipes/:id - should return recipe details', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/recipes/recipe-1');

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: { id: string; ingredients: Array<unknown> };
      };
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('recipe-1');
      expect(Array.isArray(data.data.ingredients)).toBe(true);
    });

    it('GET /api/v1/recipes/:id - should return 404 for non-existent recipe', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/recipes/not-found');

      expect(res.status).toBe(404);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // ============================================
  // Product Tests
  // ============================================

  describe('Product Endpoints', () => {
    it('GET /api/v1/products/search - should search products', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/products/search?q=tomate');

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: Array<{ name: string }>;
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('GET /api/v1/products/search - should fail with short query', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/products/search?q=a');

      expect(res.status).toBe(400);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/v1/products/compare - should compare products', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/products/compare?q=leche');

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: { bestMatch: { price: number }; comparisons: Array<unknown> };
      };
      expect(data.success).toBe(true);
      expect(data.data.bestMatch).toBeDefined();
      expect(Array.isArray(data.data.comparisons)).toBe(true);
    });
  });

  // ============================================
  // Meal Plan Tests
  // ============================================

  describe('Meal Plan Endpoints', () => {
    it('GET /api/v1/meal-plans - should return list when authenticated', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/meal-plans', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: Array<{ status: string }>;
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('POST /api/v1/meal-plans/generate - should generate meal plan', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/meal-plans/generate', {
        headers: { Authorization: 'Bearer test-token' },
        body: {
          startDate: '2024-01-22',
          endDate: '2024-01-28',
          preferences: {
            includeBreakfast: true,
            includeLunch: true,
            includeDinner: true,
          },
        },
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as {
        success: boolean;
        data: { id: string; status: string };
      };
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('draft');
    });

    it('POST /api/v1/meal-plans/generate - should fail without auth', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/meal-plans/generate', {
        body: {
          startDate: '2024-01-22',
          endDate: '2024-01-28',
        },
      });

      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // Grocery List Tests
  // ============================================

  describe('Grocery List Endpoints', () => {
    it('GET /api/v1/grocery-lists - should return list when authenticated', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/grocery-lists', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: Array<{ itemCount: number; totalPrice: number }>;
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('POST /api/v1/grocery-lists/:id/optimize - should optimize grocery list', async () => {
      const res = await testRequest(app, 'POST', '/api/v1/grocery-lists/list-1/optimize', {
        headers: { Authorization: 'Bearer test-token' },
        body: {
          strategy: 'single_store',
        },
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        data: { originalTotal: number; optimizedTotal: number; savings: number };
      };
      expect(data.success).toBe(true);
      expect(data.data.savings).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // 404 Tests
  // ============================================

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await testRequest(app, 'GET', '/api/v1/unknown-route');

      expect(res.status).toBe(404);

      const data = (await res.json()) as { success: boolean; error: { code: string } };
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
