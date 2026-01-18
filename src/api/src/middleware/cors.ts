/**
 * CORS Middleware Configuration
 * Cross-Origin Resource Sharing for browser extension and web app
 */

import { cors } from 'hono/cors';

// Allowed origins for CORS
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  // Browser extension origins
  'chrome-extension://*',
  'moz-extension://*',
];

// Production origins
const PRODUCTION_ORIGINS = [
  'https://mealplanner.app',
  'https://www.mealplanner.app',
  'https://api.mealplanner.app',
];

/**
 * Create CORS middleware with appropriate configuration
 */
export function createCorsMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';

  return cors({
    origin: (origin) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return '*';
      }

      // Check allowed origins
      const origins = isProduction
        ? [...PRODUCTION_ORIGINS, ...ALLOWED_ORIGINS]
        : ALLOWED_ORIGINS;

      // Check for exact match or wildcard patterns
      for (const allowed of origins) {
        if (allowed === origin) {
          return origin;
        }
        // Handle wildcard patterns for browser extensions
        if (allowed.includes('*')) {
          const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          if (pattern.test(origin)) {
            return origin;
          }
        }
      }

      // In development, allow all origins
      if (!isProduction) {
        return origin;
      }

      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'Accept',
      'Origin',
    ],
    exposeHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  });
}
