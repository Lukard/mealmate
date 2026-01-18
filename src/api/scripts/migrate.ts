/**
 * Database Migration Script
 * Runs Drizzle ORM migrations against the database
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

async function runMigrations(): Promise<void> {
  console.log('Starting database migrations...');
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const migrationClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    console.log('Running migrations from ./drizzle folder...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
