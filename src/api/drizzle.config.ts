/**
 * Drizzle Kit Configuration
 * For database migrations and schema management
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation',
  },
  verbose: true,
  strict: true,
});
