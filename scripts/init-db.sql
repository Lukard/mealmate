-- Database initialization script for local development
-- This runs automatically when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: Schema migrations are handled by Drizzle ORM
-- This file is for initial setup and extensions only

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE meal_automation TO postgres;
