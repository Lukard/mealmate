/**
 * Database Setup Script
 * Complete database setup: create database, run migrations, seed data
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { supermarkets, dietaryRestrictions } from '../src/db/schema.js';

// Parse DATABASE_URL to extract components
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

function parseConnectionString(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const regex = /postgres(?:ql)?:\/\/(?:([^:]+):([^@]+)@)?([^:\/]+)(?::(\d+))?\/(.+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: match[1] || 'postgres',
    password: match[2] || '',
    host: match[3] || 'localhost',
    port: parseInt(match[4] || '5432', 10),
    database: match[5] || 'meal_automation',
  };
}

async function checkDatabaseExists(
  client: postgres.Sql,
  dbName: string
): Promise<boolean> {
  const result = await client`
    SELECT 1 FROM pg_database WHERE datname = ${dbName}
  `;
  return result.length > 0;
}

async function createDatabaseIfNotExists(): Promise<void> {
  const config = parseConnectionString(DATABASE_URL);

  // Connect to postgres database to create our database
  const adminUrl = DATABASE_URL.replace(`/${config.database}`, '/postgres');
  const adminClient = postgres(adminUrl, { max: 1 });

  try {
    const exists = await checkDatabaseExists(adminClient, config.database);

    if (!exists) {
      console.log(`Creating database '${config.database}'...`);
      await adminClient.unsafe(`CREATE DATABASE "${config.database}"`);
      console.log(`Database '${config.database}' created successfully!`);
    } else {
      console.log(`Database '${config.database}' already exists.`);
    }
  } finally {
    await adminClient.end();
  }
}

async function runMigrations(): Promise<void> {
  console.log('Running migrations...');
  const migrationClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');
  } finally {
    await migrationClient.end();
  }
}

async function seedData(): Promise<void> {
  console.log('Seeding data...');
  const queryClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(queryClient);

  try {
    // Check if data already exists
    const supermarketCount = await db.select({ count: sql<number>`count(*)` }).from(supermarkets);
    const restrictionCount = await db.select({ count: sql<number>`count(*)` }).from(dietaryRestrictions);

    if (Number(supermarketCount[0].count) === 0) {
      console.log('  Running supermarket seed...');
      // Import and run supermarket seeding inline
      const { spawn } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('npx', ['tsx', 'scripts/seed-supermarkets.ts'], {
          stdio: 'inherit',
          env: process.env,
        });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Supermarket seed exited with code ${code}`));
        });
      });
    } else {
      console.log(`  Supermarkets: ${supermarketCount[0].count} records exist, skipping`);
    }

    if (Number(restrictionCount[0].count) === 0) {
      console.log('  Running dietary restrictions seed...');
      const { spawn } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('npx', ['tsx', 'scripts/seed-dietary-restrictions.ts'], {
          stdio: 'inherit',
          env: process.env,
        });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Dietary restrictions seed exited with code ${code}`));
        });
      });
    } else {
      console.log(`  Dietary restrictions: ${restrictionCount[0].count} records exist, skipping`);
    }
  } finally {
    await queryClient.end();
  }
}

async function verifySetup(): Promise<void> {
  console.log('\nVerifying database setup...');
  const queryClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(queryClient);

  try {
    // Check connection
    await queryClient`SELECT 1`;
    console.log('  Database connection: OK');

    // Count tables
    const tables = await queryClient`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log(`  Tables created: ${tables.length}`);

    // List tables
    tables.forEach((t: { table_name: string }) => {
      console.log(`    - ${t.table_name}`);
    });

    // Check supermarkets
    const supermarketCount = await db.select({ count: sql<number>`count(*)` }).from(supermarkets);
    console.log(`  Supermarkets seeded: ${supermarketCount[0].count}`);

    // Check dietary restrictions
    const restrictionCount = await db.select({ count: sql<number>`count(*)` }).from(dietaryRestrictions);
    console.log(`  Dietary restrictions seeded: ${restrictionCount[0].count}`);

    console.log('\nDatabase setup completed successfully!');
  } finally {
    await queryClient.end();
  }
}

async function setup(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Database Setup Script');
  console.log('='.repeat(60));
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');

  try {
    // Step 1: Create database if not exists
    console.log('Step 1: Creating database if not exists...');
    await createDatabaseIfNotExists();
    console.log('');

    // Step 2: Run migrations
    console.log('Step 2: Running migrations...');
    await runMigrations();
    console.log('');

    // Step 3: Seed data
    console.log('Step 3: Seeding data...');
    await seedData();
    console.log('');

    // Step 4: Verify setup
    console.log('Step 4: Verifying setup...');
    await verifySetup();

  } catch (error) {
    console.error('\nSetup failed:', error);
    process.exit(1);
  }
}

setup();
