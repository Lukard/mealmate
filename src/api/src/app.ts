/**
 * Hono App Setup
 * Main application configuration and middleware setup
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { createRoutes } from './routes/index.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

/**
 * API version and base path
 */
const API_VERSION = 'v1';
const API_BASE_PATH = `/api/${API_VERSION}`;

/**
 * Create and configure the Hono application
 */
export function createApp(): Hono {
  const app = new Hono();

  // ============================================
  // Global Middleware
  // ============================================

  // Request logging (development only)
  if (process.env.NODE_ENV !== 'production') {
    app.use('*', logger());
  }

  // Request timing headers
  app.use('*', timing());

  // Security headers
  app.use(
    '*',
    secureHeaders({
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      xXssProtection: '1; mode=block',
    })
  );

  // CORS
  app.use('*', createCorsMiddleware());

  // Pretty JSON in development
  if (process.env.NODE_ENV !== 'production') {
    app.use('*', prettyJSON());
  }

  // Global error handler
  app.use('*', errorHandler);

  // ============================================
  // Root Routes
  // ============================================

  // Root endpoint - API info
  app.get('/', (c) => {
    return c.json({
      success: true,
      data: {
        name: 'Meal Automation API',
        version: process.env.npm_package_version || '0.1.0',
        apiVersion: API_VERSION,
        documentation: `${API_BASE_PATH}/docs`,
        health: `${API_BASE_PATH}/health`,
      },
    });
  });

  // Redirect /api to versioned API
  app.get('/api', (c) => {
    return c.redirect(API_BASE_PATH);
  });

  // ============================================
  // API Routes
  // ============================================

  const apiRoutes = createRoutes();
  app.route(API_BASE_PATH, apiRoutes);

  // ============================================
  // OpenAPI Documentation
  // ============================================

  // OpenAPI spec endpoint
  app.get(`${API_BASE_PATH}/openapi.json`, (c) => {
    return c.json(getOpenAPISpec());
  });

  // Simple docs endpoint
  app.get(`${API_BASE_PATH}/docs`, (c) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meal Automation API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${API_BASE_PATH}/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
    `.trim();

    return c.html(html);
  });

  // ============================================
  // 404 Handler
  // ============================================

  app.notFound(notFoundHandler);

  return app;
}

/**
 * Generate OpenAPI specification
 */
function getOpenAPISpec(): object {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Meal Automation API',
      description: 'Backend API for the meal planning and grocery automation system',
      version: process.env.npm_package_version || '0.1.0',
      contact: {
        name: 'API Support',
        email: 'support@mealplanner.app',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://api.mealplanner.app/v1',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Recipes', description: 'Recipe CRUD operations' },
      { name: 'Meal Plans', description: 'Meal planning' },
      { name: 'Products', description: 'Product search and comparison' },
      { name: 'Grocery Lists', description: 'Grocery list management' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'User registered successfully' },
            '409': { description: 'Email already exists' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Login successful' },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          responses: {
            '200': { description: 'Token refreshed' },
            '401': { description: 'Invalid refresh token' },
          },
        },
      },
      '/users/me': {
        get: {
          tags: ['Users'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'User profile' },
          },
        },
        put: {
          tags: ['Users'],
          summary: 'Update user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Profile updated' },
          },
        },
      },
      '/recipes': {
        get: {
          tags: ['Recipes'],
          summary: 'List recipes',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'cuisine', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            '200': { description: 'List of recipes' },
          },
        },
        post: {
          tags: ['Recipes'],
          summary: 'Create a recipe',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Recipe created' },
          },
        },
      },
      '/recipes/{id}': {
        get: {
          tags: ['Recipes'],
          summary: 'Get recipe details',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Recipe details' },
            '404': { description: 'Recipe not found' },
          },
        },
      },
      '/meal-plans': {
        get: {
          tags: ['Meal Plans'],
          summary: 'List meal plans',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'List of meal plans' },
          },
        },
        post: {
          tags: ['Meal Plans'],
          summary: 'Create a meal plan',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Meal plan created' },
          },
        },
      },
      '/meal-plans/generate': {
        post: {
          tags: ['Meal Plans'],
          summary: 'Generate a meal plan',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Meal plan generated' },
          },
        },
      },
      '/products/search': {
        get: {
          tags: ['Products'],
          summary: 'Search products',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
            { name: 'supermarketId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Search results' },
          },
        },
      },
      '/products/compare': {
        get: {
          tags: ['Products'],
          summary: 'Compare product prices',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'ingredientId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Price comparisons' },
          },
        },
      },
      '/grocery-lists': {
        get: {
          tags: ['Grocery Lists'],
          summary: 'List grocery lists',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'List of grocery lists' },
          },
        },
        post: {
          tags: ['Grocery Lists'],
          summary: 'Create a grocery list',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Grocery list created' },
          },
        },
      },
      '/grocery-lists/{id}/optimize': {
        post: {
          tags: ['Grocery Lists'],
          summary: 'Optimize grocery list',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Optimization result' },
          },
        },
      },
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Basic health check',
          responses: {
            '200': { description: 'Service is healthy' },
          },
        },
      },
      '/health/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness check',
          responses: {
            '200': { description: 'Service is ready' },
            '503': { description: 'Service unavailable' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

export { API_BASE_PATH, API_VERSION };
