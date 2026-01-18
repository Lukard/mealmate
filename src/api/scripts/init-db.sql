-- MealMate Database Schema
-- This SQL file creates all tables for the meal automation system

-- Create enums
DO $$ BEGIN
    CREATE TYPE cooking_skill AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE meal_plan_status AS ENUM ('draft', 'active', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE grocery_list_status AS ENUM ('draft', 'ready', 'shopping', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE product_availability AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    google_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    revoked_at TIMESTAMP
);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    household_size INTEGER DEFAULT 2 NOT NULL,
    budget_weekly INTEGER,
    preferred_stores JSONB DEFAULT '[]',
    cooking_skill cooking_skill DEFAULT 'intermediate',
    max_prep_time INTEGER,
    cuisine_preferences JSONB DEFAULT '[]',
    disliked_ingredients JSONB DEFAULT '[]'
);

-- Dietary restrictions
CREATE TABLE IF NOT EXISTS dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    icon VARCHAR(50)
);

-- User restrictions
CREATE TABLE IF NOT EXISTS user_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restriction_id UUID NOT NULL REFERENCES dietary_restrictions(id),
    severity VARCHAR(20) DEFAULT 'strict'
);

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions JSONB NOT NULL,
    prep_time INTEGER NOT NULL,
    cook_time INTEGER NOT NULL,
    servings INTEGER DEFAULT 4 NOT NULL,
    difficulty difficulty DEFAULT 'medium',
    cuisine VARCHAR(100),
    image_url VARCHAR(500),
    source_url VARCHAR(500),
    source_attribution VARCHAR(255),
    nutrition_data JSONB,
    tags JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT true,
    author_id UUID REFERENCES users(id),
    rating DECIMAL(3,2),
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS recipes_name_idx ON recipes(name);
CREATE INDEX IF NOT EXISTS recipes_cuisine_idx ON recipes(cuisine);
CREATE INDEX IF NOT EXISTS recipes_author_idx ON recipes(author_id);

-- Ingredients
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    standard_unit VARCHAR(50) NOT NULL,
    aliases JSONB DEFAULT '[]',
    is_common BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS ingredients_name_idx ON ingredients(name);
CREATE INDEX IF NOT EXISTS ingredients_category_idx ON ingredients(category);

-- Recipe ingredients
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    notes VARCHAR(255),
    is_optional BOOLEAN DEFAULT false
);

-- Meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status meal_plan_status DEFAULT 'draft',
    estimated_cost INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS meal_plans_user_idx ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS meal_plans_status_idx ON meal_plans(status);

-- Meal plan entries
CREATE TABLE IF NOT EXISTS meal_plan_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id),
    date DATE NOT NULL,
    meal_type meal_type NOT NULL,
    servings INTEGER NOT NULL,
    notes VARCHAR(255)
);

-- Supermarkets
CREATE TABLE IF NOT EXISTS supermarkets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    color VARCHAR(7),
    scraping_enabled BOOLEAN DEFAULT true,
    scraping_config JSONB,
    last_scraped_at TIMESTAMP,
    product_count INTEGER DEFAULT 0
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id),
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(255),
    description TEXT,
    price INTEGER NOT NULL,
    price_per_unit INTEGER,
    unit VARCHAR(50),
    unit_quantity DECIMAL(10,3),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    image_url VARCHAR(500),
    product_url VARCHAR(500),
    availability product_availability DEFAULT 'in_stock',
    is_organic BOOLEAN DEFAULT false,
    is_on_sale BOOLEAN DEFAULT false,
    sale_price INTEGER,
    sale_end_date TIMESTAMP,
    nutrition_data JSONB,
    last_scraped_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS products_supermarket_external_idx ON products(supermarket_id, external_id);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_price_idx ON products(price);

-- Price history
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    price_per_unit INTEGER,
    currency VARCHAR(3) DEFAULT 'EUR',
    is_promotion BOOLEAN DEFAULT false,
    promotion_name VARCHAR(255),
    recorded_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS price_history_product_date_idx ON price_history(product_id, recorded_at);

-- Product matches
CREATE TABLE IF NOT EXISTS product_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    product_id UUID NOT NULL REFERENCES products(id),
    confidence DECIMAL(5,4) NOT NULL,
    match_type VARCHAR(50) NOT NULL,
    user_approved BOOLEAN,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS product_matches_ingredient_product_idx ON product_matches(ingredient_id, product_id);
CREATE INDEX IF NOT EXISTS product_matches_confidence_idx ON product_matches(confidence);

-- Grocery lists
CREATE TABLE IF NOT EXISTS grocery_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_plan_id UUID REFERENCES meal_plans(id),
    name VARCHAR(255) NOT NULL,
    status grocery_list_status DEFAULT 'draft',
    total_price INTEGER,
    selected_supermarket UUID REFERENCES supermarkets(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS grocery_lists_user_idx ON grocery_lists(user_id);
CREATE INDEX IF NOT EXISTS grocery_lists_status_idx ON grocery_lists(status);

-- Grocery list items
CREATE TABLE IF NOT EXISTS grocery_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grocery_list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    product_id UUID REFERENCES products(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    price INTEGER,
    is_checked BOOLEAN DEFAULT false,
    is_substituted BOOLEAN DEFAULT false,
    original_product_id UUID REFERENCES products(id),
    notes VARCHAR(255),
    sort_order INTEGER DEFAULT 0
);

-- Done
SELECT 'Schema created successfully' AS result;
