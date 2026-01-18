#!/bin/sh
# Don't use set -e so we can continue if db commands fail

echo "=== MealMate API Startup ==="
echo "Current directory: $(pwd)"
echo "DATABASE_URL set: $(if [ -n "$DATABASE_URL" ]; then echo 'yes'; else echo 'no'; fi)"

# Push schema to database (creates/updates tables)
echo "Step 1: Pushing database schema with drizzle-kit..."
npx drizzle-kit push --verbose 2>&1 || echo "Warning: db:push may have failed"

# Wait a moment for tables to be ready
sleep 2

# Seed the database with initial data
echo "Step 2: Seeding supermarkets..."
npx tsx scripts/seed-supermarkets.ts 2>&1 || echo "Warning: supermarket seed may have failed"

echo "Step 3: Seeding dietary restrictions..."
npx tsx scripts/seed-dietary-restrictions.ts 2>&1 || echo "Warning: dietary restrictions seed may have failed"

echo "Step 4: Seeding recipes..."
npx tsx scripts/seed-recipes-db.ts 2>&1 || echo "Warning: recipes seed may have failed"

echo "Database setup complete!"
echo "Starting API server..."

# Start the application
exec node dist/index.js
