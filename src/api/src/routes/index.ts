/**
 * Route Aggregator
 * Combines all route modules into a single export
 */

import { Hono } from 'hono';
import auth from './auth.routes.js';
import users from './users.routes.js';
import recipes from './recipes.routes.js';
import mealPlans from './meal-plans.routes.js';
import products from './products.routes.js';
import grocery from './grocery.routes.js';
import health from './health.routes.js';

/**
 * Create and configure all API routes
 */
export function createRoutes(): Hono {
  const api = new Hono();

  // Mount route modules
  api.route('/auth', auth);
  api.route('/users', users);
  api.route('/recipes', recipes);
  api.route('/meal-plans', mealPlans);
  api.route('/products', products);
  api.route('/grocery-lists', grocery);
  api.route('/health', health);

  return api;
}

// Export individual route modules for direct access if needed
export { auth, users, recipes, mealPlans, products, grocery, health };
