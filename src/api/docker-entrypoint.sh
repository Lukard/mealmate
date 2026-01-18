#!/bin/sh
# Don't use set -e so we can continue if db commands fail

echo "=== MealMate API Startup ==="
echo "Current directory: $(pwd)"
echo "DATABASE_URL set: $(if [ -n "$DATABASE_URL" ]; then echo 'yes'; else echo 'no'; fi)"
echo "Listing scripts directory:"
ls -la scripts/

# Step 1: Create database tables using SQL script
echo ""
echo "Step 1: Creating database tables..."
npx tsx scripts/run-init-sql.ts 2>&1
if [ $? -eq 0 ]; then
    echo "Tables created successfully"
else
    echo "Warning: table creation may have failed"
fi

# Wait for tables to be ready
sleep 2

# Step 2: Seed supermarkets
echo ""
echo "Step 2: Seeding supermarkets..."
npx tsx scripts/seed-supermarkets.ts 2>&1
if [ $? -eq 0 ]; then
    echo "Supermarkets seeded"
else
    echo "Warning: supermarket seed may have failed"
fi

# Step 3: Seed dietary restrictions
echo ""
echo "Step 3: Seeding dietary restrictions..."
npx tsx scripts/seed-dietary-restrictions.ts 2>&1
if [ $? -eq 0 ]; then
    echo "Dietary restrictions seeded"
else
    echo "Warning: dietary restrictions seed may have failed"
fi

# Step 4: Seed recipes
echo ""
echo "Step 4: Seeding recipes..."
npx tsx scripts/seed-recipes-db.ts 2>&1
if [ $? -eq 0 ]; then
    echo "Recipes seeded"
else
    echo "Warning: recipes seed may have failed"
fi

echo ""
echo "=== Database setup complete! ==="
echo "Starting API server..."

# Start the application
exec node dist/index.js
