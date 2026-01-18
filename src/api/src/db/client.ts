/**
 * Database Client - Drizzle ORM with PostgreSQL
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

// Create postgres client
const queryClient = postgres(DATABASE_URL, {
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Create drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export schema for use in queries
export { schema };

// Export type for use in other modules
export type Database = typeof db;

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  await queryClient.end();
}

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
