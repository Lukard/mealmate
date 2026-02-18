#!/usr/bin/env tsx
/**
 * AI Schema Migration Script
 * Runs migrations for AI-related tables and extensions
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

async function runMigration() {
  console.log('🚀 Starting AI schema migration...\n');
  
  const sql = postgres(DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
  });

  try {
    // 1. Enable pgvector extension
    console.log('1️⃣  Enabling pgvector extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('   ✅ pgvector enabled\n');

    // 2. Create recipe_embeddings table
    console.log('2️⃣  Creating recipe_embeddings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS recipe_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE UNIQUE,
        embedding vector(384) NOT NULL,
        embedding_model VARCHAR(100) NOT NULL DEFAULT 'gte-small',
        content_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS recipe_embeddings_recipe_idx ON recipe_embeddings(recipe_id)`;
    console.log('   ✅ recipe_embeddings created\n');

    // 3. Create user_preference_signals table
    console.log('3️⃣  Creating user_preference_signals table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_preference_signals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        signal_type VARCHAR(50) NOT NULL,
        recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
        meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
        signal_value DECIMAL(3,2),
        context JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS user_pref_signals_user_idx ON user_preference_signals(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS user_pref_signals_recipe_idx ON user_preference_signals(recipe_id)`;
    await sql`CREATE INDEX IF NOT EXISTS user_pref_signals_type_idx ON user_preference_signals(signal_type)`;
    await sql`CREATE INDEX IF NOT EXISTS user_pref_signals_date_idx ON user_preference_signals(created_at)`;
    console.log('   ✅ user_preference_signals created\n');

    // 4. Create ai_generation_logs table
    console.log('4️⃣  Creating ai_generation_logs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS ai_generation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_type VARCHAR(50) NOT NULL,
        input_context JSONB NOT NULL,
        model_used VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        error_code VARCHAR(50),
        output_meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
        raw_response TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS ai_logs_user_idx ON ai_generation_logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS ai_logs_type_idx ON ai_generation_logs(request_type)`;
    await sql`CREATE INDEX IF NOT EXISTS ai_logs_date_idx ON ai_generation_logs(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS ai_logs_success_idx ON ai_generation_logs(success)`;
    console.log('   ✅ ai_generation_logs created\n');

    // 5. Create ai_prompt_templates table
    console.log('5️⃣  Creating ai_prompt_templates table...');
    await sql`
      CREATE TABLE IF NOT EXISTS ai_prompt_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        template_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        performance_metrics JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS ai_prompt_templates_name_version_idx ON ai_prompt_templates(name, version)`;
    await sql`CREATE INDEX IF NOT EXISTS ai_prompt_templates_active_idx ON ai_prompt_templates(is_active)`;
    console.log('   ✅ ai_prompt_templates created\n');

    // 6. Alter user_profiles table
    console.log('6️⃣  Adding AI fields to user_profiles...');
    await sql`
      ALTER TABLE user_profiles 
        ADD COLUMN IF NOT EXISTS ai_personalization_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS preferred_ai_creativity DECIMAL(2,1) DEFAULT 0.7,
        ADD COLUMN IF NOT EXISTS meal_plan_feedback_count INTEGER DEFAULT 0
    `;
    console.log('   ✅ user_profiles updated\n');

    // 7. Alter recipes table
    console.log('7️⃣  Adding AI fields to recipes...');
    await sql`
      ALTER TABLE recipes 
        ADD COLUMN IF NOT EXISTS semantic_tags JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS complexity_score DECIMAL(3,2),
        ADD COLUMN IF NOT EXISTS seasonal_months INTEGER[] DEFAULT '{}'
    `;
    console.log('   ✅ recipes updated\n');

    // 8. Alter meal_plans table
    console.log('8️⃣  Adding AI fields to meal_plans...');
    await sql`
      ALTER TABLE meal_plans 
        ADD COLUMN IF NOT EXISTS generated_by VARCHAR(50) DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
        ADD COLUMN IF NOT EXISTS user_satisfaction_score DECIMAL(2,1)
    `;
    console.log('   ✅ meal_plans updated\n');

    console.log('✨ AI schema migration completed successfully!\n');
    console.log('Note: After populating embeddings, run:');
    console.log('  CREATE INDEX recipe_embeddings_vector_idx ON recipe_embeddings');
    console.log('  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
