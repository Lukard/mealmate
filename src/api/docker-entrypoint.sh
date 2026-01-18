#!/bin/sh
set -e

echo "=== MealMate API Startup ==="
echo "Running database setup..."

# Push schema to database (creates/updates tables)
echo "Step 1: Pushing database schema..."
npm run db:push || { echo "Warning: db:push failed, tables may already exist"; }

# Seed the database with initial data
echo "Step 2: Seeding database..."
npm run db:seed || { echo "Warning: db:seed failed, data may already exist"; }

echo "Database setup complete!"
echo "Starting API server..."

# Start the application
exec npm run start
