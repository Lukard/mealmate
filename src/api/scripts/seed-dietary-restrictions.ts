/**
 * Seed Script - Dietary Restrictions
 * Seeds the database with common dietary restrictions
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { dietaryRestrictions } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

interface DietaryRestrictionSeed {
  name: string;
  description: string;
  icon: string;
}

const restrictions: DietaryRestrictionSeed[] = [
  {
    name: 'Vegetarian',
    description: 'Excludes meat and fish, but allows dairy and eggs',
    icon: 'leaf',
  },
  {
    name: 'Vegan',
    description: 'Excludes all animal products including dairy, eggs, and honey',
    icon: 'seedling',
  },
  {
    name: 'Gluten-Free',
    description: 'Excludes wheat, barley, rye, and other gluten-containing grains',
    icon: 'wheat-slash',
  },
  {
    name: 'Dairy-Free',
    description: 'Excludes milk and all dairy products',
    icon: 'glass-water-droplet',
  },
  {
    name: 'Nut-Free',
    description: 'Excludes all tree nuts and peanuts',
    icon: 'nut-slash',
  },
  {
    name: 'Halal',
    description: 'Follows Islamic dietary laws',
    icon: 'star-and-crescent',
  },
  {
    name: 'Kosher',
    description: 'Follows Jewish dietary laws',
    icon: 'star-of-david',
  },
  {
    name: 'Pescatarian',
    description: 'Excludes meat but includes fish and seafood',
    icon: 'fish',
  },
  {
    name: 'Low-Sodium',
    description: 'Limited salt and sodium content',
    icon: 'salt-shaker',
  },
  {
    name: 'Low-Sugar',
    description: 'Limited sugar and sweeteners',
    icon: 'cube-slash',
  },
  {
    name: 'Low-Carb',
    description: 'Reduced carbohydrate intake',
    icon: 'bread-slice-slash',
  },
  {
    name: 'Keto',
    description: 'Very low carb, high fat diet',
    icon: 'bacon',
  },
  {
    name: 'Paleo',
    description: 'Excludes processed foods, grains, legumes, and dairy',
    icon: 'drumstick-bite',
  },
  {
    name: 'Egg-Free',
    description: 'Excludes eggs and egg products',
    icon: 'egg-slash',
  },
  {
    name: 'Soy-Free',
    description: 'Excludes soy and soy products',
    icon: 'bean-slash',
  },
  {
    name: 'Shellfish-Free',
    description: 'Excludes shellfish and crustaceans',
    icon: 'shrimp-slash',
  },
];

async function seedDietaryRestrictions(): Promise<void> {
  console.log('Starting dietary restrictions seeding...');
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const queryClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(queryClient);

  try {
    console.log(`Seeding ${restrictions.length} dietary restrictions...`);

    for (const restriction of restrictions) {
      // Check if restriction already exists
      const existing = await db
        .select()
        .from(dietaryRestrictions)
        .where(eq(dietaryRestrictions.name, restriction.name))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  - ${restriction.name}: Already exists, skipping`);
        continue;
      }

      // Insert restriction
      await db.insert(dietaryRestrictions).values(restriction);
      console.log(`  - ${restriction.name}: Inserted successfully`);
    }

    console.log('Dietary restrictions seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

seedDietaryRestrictions();
