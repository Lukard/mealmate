/**
 * AI Schema - Drizzle ORM
 * Database schema for AI-powered meal planning features
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, recipes, mealPlans } from './schema.js';

// ============================================
// Custom Types
// ============================================

/**
 * Custom vector type for pgvector extension
 * Supports 384 dimensions for gte-small or 1536 for OpenAI
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 384})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Parse PostgreSQL vector format: [0.1,0.2,0.3]
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => parseFloat(v));
  },
});

// ============================================
// Signal Types
// ============================================

export type SignalType =
  | 'recipe_completed'
  | 'recipe_skipped'
  | 'rating'
  | 'favorite'
  | 'dislike'
  | 'time_feedback'
  | 'difficulty_feedback';

export type RequestType =
  | 'meal_plan'
  | 'recipe_recommend'
  | 'optimization'
  | 'similar_recipes';

export type GeneratedBy = 'manual' | 'ai' | 'template';

// ============================================
// AI Tables
// ============================================

/**
 * Recipe Embeddings - For semantic search
 * Stores vector representations of recipes for similarity matching
 */
export const recipeEmbeddings = pgTable(
  'recipe_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .references(() => recipes.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    embeddingModel: varchar('embedding_model', { length: 100 })
      .default('gte-small')
      .notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    recipeIdx: index('recipe_embeddings_recipe_idx').on(table.recipeId),
  })
);

/**
 * User Preference Signals - For learning user preferences
 * Captures feedback and interactions to improve recommendations
 */
export const userPreferenceSignals = pgTable(
  'user_preference_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    signalType: varchar('signal_type', { length: 50 }).$type<SignalType>().notNull(),
    recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    mealPlanId: uuid('meal_plan_id').references(() => mealPlans.id, { onDelete: 'set null' }),
    signalValue: decimal('signal_value', { precision: 3, scale: 2 }),
    context: jsonb('context').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('user_pref_signals_user_idx').on(table.userId),
    recipeIdx: index('user_pref_signals_recipe_idx').on(table.recipeId),
    typeIdx: index('user_pref_signals_type_idx').on(table.signalType),
    dateIdx: index('user_pref_signals_date_idx').on(table.createdAt),
  })
);

/**
 * AI Generation Logs - For analytics and debugging
 * Tracks all AI generation requests for monitoring and improvement
 */
export const aiGenerationLogs = pgTable(
  'ai_generation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    requestType: varchar('request_type', { length: 50 }).$type<RequestType>().notNull(),
    inputContext: jsonb('input_context').$type<Record<string, unknown>>().notNull(),
    modelUsed: varchar('model_used', { length: 100 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    errorCode: varchar('error_code', { length: 50 }),
    outputMealPlanId: uuid('output_meal_plan_id').references(() => mealPlans.id, {
      onDelete: 'set null',
    }),
    rawResponse: text('raw_response'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('ai_logs_user_idx').on(table.userId),
    typeIdx: index('ai_logs_type_idx').on(table.requestType),
    dateIdx: index('ai_logs_date_idx').on(table.createdAt),
    successIdx: index('ai_logs_success_idx').on(table.success),
  })
);

/**
 * AI Prompt Templates - For A/B testing and versioning
 * Allows testing different prompts and tracking performance
 */
export const aiPromptTemplates = pgTable(
  'ai_prompt_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    version: integer('version').notNull().default(1),
    templateType: varchar('template_type', { length: 50 }).notNull(),
    content: text('content').notNull(),
    isActive: boolean('is_active').default(false),
    performanceMetrics: jsonb('performance_metrics').$type<{
      usageCount?: number;
      successRate?: number;
      avgSatisfaction?: number;
      avgLatencyMs?: number;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameVersionIdx: index('ai_prompt_templates_name_version_idx').on(
      table.name,
      table.version
    ),
    activeIdx: index('ai_prompt_templates_active_idx').on(table.isActive),
  })
);

// ============================================
// Extended Fields for Existing Tables
// ============================================

/**
 * Type definitions for AI-extended fields on existing tables
 * These should be added via ALTER TABLE migrations
 */

// user_profiles extensions:
// - ai_personalization_enabled: boolean DEFAULT TRUE
// - preferred_ai_creativity: decimal(2,1) DEFAULT 0.7
// - meal_plan_feedback_count: integer DEFAULT 0

// recipes extensions:
// - semantic_tags: jsonb DEFAULT '[]'
// - complexity_score: decimal(3,2)
// - seasonal_months: integer[] DEFAULT '{}'

// meal_plans extensions:
// - generated_by: varchar(50) DEFAULT 'manual'
// - ai_explanation: text
// - user_satisfaction_score: decimal(2,1)

/**
 * SQL for pgvector extension and index (run in migration)
 */
export const pgvectorSetupSQL = sql`
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create IVFFlat index for fast similarity search (run after data is populated)
-- Note: Only create this after you have some embeddings, otherwise it may fail
-- CREATE INDEX IF NOT EXISTS recipe_embeddings_vector_idx 
-- ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
`;

/**
 * SQL for adding AI fields to existing tables
 */
export const alterTablesSQLuserProfiles = sql`
-- Add AI fields to user_profiles
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS ai_personalization_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_ai_creativity DECIMAL(2,1) DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS meal_plan_feedback_count INTEGER DEFAULT 0;
`;

export const alterTablesSQLrecipes = sql`
-- Add AI fields to recipes
ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS semantic_tags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS complexity_score DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS seasonal_months INTEGER[] DEFAULT '{}';
`;

export const alterTablesSQLmealPlans = sql`
-- Add AI fields to meal_plans
ALTER TABLE meal_plans 
  ADD COLUMN IF NOT EXISTS generated_by VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
  ADD COLUMN IF NOT EXISTS user_satisfaction_score DECIMAL(2,1);
`;
