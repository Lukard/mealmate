/**
 * MSW (Mock Service Worker) Handlers
 *
 * Intercepts network requests for testing purposes.
 * Provides consistent mock responses for:
 * - Internal API endpoints
 * - Supermarket scraping endpoints
 * - External services
 */

import { http, HttpResponse, delay } from 'msw';

// Import fixtures
import mercadonaCatalog from '../fixtures/products/mercadona-catalog.json';
import carrefourCatalog from '../fixtures/products/carrefour-catalog.json';
import standardMealPlan from '../fixtures/meal-plans/standard-7-day.json';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = 'http://localhost:3001';

// ============================================================================
// Authentication Handlers
// ============================================================================

const authHandlers = [
  // Login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    const { email, password } = body;

    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        success: true,
        token: 'mock-jwt-token-12345',
        refreshToken: 'mock-refresh-token-67890',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Register
  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string; name: string };
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return HttpResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (email === 'existing@example.com') {
      return HttpResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      success: true,
      user: {
        id: 'new-user-456',
        email,
        name,
      },
      token: 'mock-jwt-token-new-user',
    }, { status: 201 });
  }),

  // Refresh token
  http.post(`${API_BASE}/auth/refresh`, async ({ request }) => {
    const body = await request.json() as { refreshToken: string };
    const { refreshToken } = body;

    if (refreshToken === 'mock-refresh-token-67890') {
      return HttpResponse.json({
        success: true,
        token: 'mock-jwt-token-refreshed',
      });
    }

    return HttpResponse.json(
      { success: false, error: 'Invalid refresh token' },
      { status: 401 }
    );
  }),
];

// ============================================================================
// Meal Plan Handlers
// ============================================================================

const mealPlanHandlers = [
  // Generate meal plan
  http.post(`${API_BASE}/meal-plans/generate`, async ({ request }) => {
    await delay(100); // Simulate processing time

    const body = await request.json() as { dietType?: string };
    const { dietType } = body;

    // Return appropriate plan based on diet type
    const plan = { ...standardMealPlan };
    if (dietType) {
      plan.userProfile.dietType = dietType;
    }

    return HttpResponse.json({
      success: true,
      mealPlan: plan,
    });
  }),

  // Get meal plan by ID
  http.get(`${API_BASE}/meal-plans/:id`, ({ params }) => {
    const { id } = params;

    if (id === 'not-found') {
      return HttpResponse.json(
        { success: false, error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      mealPlan: { ...standardMealPlan, id },
    });
  }),

  // List user's meal plans
  http.get(`${API_BASE}/meal-plans`, () => {
    return HttpResponse.json({
      success: true,
      mealPlans: [
        { ...standardMealPlan, id: 'plan-1' },
        { ...standardMealPlan, id: 'plan-2', name: 'Previous Week' },
      ],
      total: 2,
    });
  }),

  // Update meal plan
  http.put(`${API_BASE}/meal-plans/:id`, async ({ params, request }) => {
    const { id } = params;
    const updates = await request.json();

    return HttpResponse.json({
      success: true,
      mealPlan: { ...standardMealPlan, id, ...updates },
    });
  }),

  // Delete meal plan
  http.delete(`${API_BASE}/meal-plans/:id`, ({ params }) => {
    const { id } = params;

    if (id === 'protected') {
      return HttpResponse.json(
        { success: false, error: 'Cannot delete protected plan' },
        { status: 403 }
      );
    }

    return HttpResponse.json({ success: true });
  }),
];

// ============================================================================
// Product Handlers
// ============================================================================

const productHandlers = [
  // Search products
  http.get(`${API_BASE}/products`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    const store = url.searchParams.get('store');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let products = [...mercadonaCatalog.products, ...carrefourCatalog.products];

    // Filter by store
    if (store) {
      products = products.filter((p) =>
        store.toLowerCase() === 'mercadona'
          ? p.id.startsWith('merc')
          : p.id.startsWith('carr')
      );
    }

    // Filter by search query
    if (query) {
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      );
    }

    // Paginate
    const start = (page - 1) * limit;
    const paginatedProducts = products.slice(start, start + limit);

    return HttpResponse.json({
      success: true,
      products: paginatedProducts,
      total: products.length,
      page,
      limit,
    });
  }),

  // Get product by ID
  http.get(`${API_BASE}/products/:id`, ({ params }) => {
    const { id } = params;

    const allProducts = [
      ...mercadonaCatalog.products,
      ...carrefourCatalog.products,
    ];
    const product = allProducts.find((p) => p.id === id);

    if (!product) {
      return HttpResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      product,
    });
  }),

  // Compare prices
  http.post(`${API_BASE}/products/compare`, async ({ request }) => {
    const body = await request.json() as { productIds: string[] };
    const { productIds } = body;

    const allProducts = [
      ...mercadonaCatalog.products,
      ...carrefourCatalog.products,
    ];
    const products = productIds.map((id: string) => allProducts.find((p) => p.id === id)).filter(Boolean);

    return HttpResponse.json({
      success: true,
      comparison: products,
      cheapest: products.reduce((min, p) =>
        (p?.price || 0) < (min?.price || Infinity) ? p : min
      ),
    });
  }),
];

// ============================================================================
// Grocery List Handlers
// ============================================================================

const groceryListHandlers = [
  // Create grocery list
  http.post(`${API_BASE}/grocery-lists`, async ({ request }) => {
    const body = await request.json() as { name: string; items?: unknown[] };

    return HttpResponse.json({
      success: true,
      groceryList: {
        id: 'list-' + Date.now(),
        name: body.name || 'New List',
        items: body.items || [],
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  }),

  // Generate from meal plan
  http.post(`${API_BASE}/grocery-lists/from-plan/:planId`, async ({ params }) => {
    const { planId } = params;
    await delay(200); // Simulate processing

    return HttpResponse.json({
      success: true,
      groceryList: {
        id: 'list-generated-' + Date.now(),
        name: `Lista de compra - ${planId}`,
        items: [
          { name: 'Leche', quantity: 3, unit: 'L', category: 'Lacteos' },
          { name: 'Huevos', quantity: 12, unit: 'units', category: 'Huevos' },
          { name: 'Pan', quantity: 2, unit: 'units', category: 'Panaderia' },
          { name: 'Pollo', quantity: 1, unit: 'kg', category: 'Carnes' },
          { name: 'Arroz', quantity: 500, unit: 'g', category: 'Arroz y Legumbres' },
        ],
        sourceplanId: planId,
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // Get grocery list
  http.get(`${API_BASE}/grocery-lists/:id`, ({ params }) => {
    const { id } = params;

    if (id === 'not-found') {
      return HttpResponse.json(
        { success: false, error: 'Grocery list not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      groceryList: {
        id,
        name: 'Test List',
        items: [
          { id: 'item-1', name: 'Leche', quantity: 2, unit: 'L', purchased: false },
          { id: 'item-2', name: 'Pan', quantity: 1, unit: 'units', purchased: true },
        ],
      },
    });
  }),

  // Update list item
  http.put(`${API_BASE}/grocery-lists/:listId/items/:itemId`, async ({ params, request }) => {
    const { listId, itemId } = params;
    const updates = await request.json();

    return HttpResponse.json({
      success: true,
      item: {
        id: itemId,
        listId,
        ...updates,
      },
    });
  }),

  // Delete grocery list
  http.delete(`${API_BASE}/grocery-lists/:id`, () => {
    return HttpResponse.json({ success: true });
  }),
];

// ============================================================================
// Supermarket Scraper Mock Handlers
// ============================================================================

const scraperHandlers = [
  // Mercadona search (mocked)
  http.get('https://tienda.mercadona.es/api/search/*', ({ request }) => {
    const url = new URL(request.url);
    const query = url.pathname.split('/').pop() || '';

    const filteredProducts = mercadonaCatalog.products.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    return HttpResponse.json({
      results: filteredProducts.slice(0, 10),
      total: filteredProducts.length,
    });
  }),

  // Carrefour search (mocked)
  http.get('https://www.carrefour.es/search-api/query/v1/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';

    const filteredProducts = carrefourCatalog.products.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    return HttpResponse.json({
      content: {
        docs: filteredProducts.slice(0, 10).map((p) => ({
          ...p,
          display_name: p.name,
          active_price: p.price,
        })),
      },
      totalCount: filteredProducts.length,
    });
  }),

  // Rate limited response (for testing rate limit handling)
  http.get(`${API_BASE}/scrape/rate-limited`, () => {
    return HttpResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      }
    );
  }),

  // Server error (for testing error handling)
  http.get(`${API_BASE}/scrape/error`, () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),
];

// ============================================================================
// Error Simulation Handlers
// ============================================================================

const errorHandlers = [
  // Timeout simulation
  http.get(`${API_BASE}/test/timeout`, async () => {
    await delay(30000); // 30 second delay
    return HttpResponse.json({ success: true });
  }),

  // Network error simulation
  http.get(`${API_BASE}/test/network-error`, () => {
    return HttpResponse.error();
  }),

  // Malformed JSON response
  http.get(`${API_BASE}/test/malformed-json`, () => {
    return new HttpResponse('{ invalid json }', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
];

// ============================================================================
// Export All Handlers
// ============================================================================

export const handlers = [
  ...authHandlers,
  ...mealPlanHandlers,
  ...productHandlers,
  ...groceryListHandlers,
  ...scraperHandlers,
  ...errorHandlers,
];

// Export individual handler groups for selective mocking
export {
  authHandlers,
  mealPlanHandlers,
  productHandlers,
  groceryListHandlers,
  scraperHandlers,
  errorHandlers,
};
