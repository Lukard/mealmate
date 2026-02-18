/**
 * AI Service Types
 * Common type definitions for AI services
 */

// ============================================
// LLM Types
// ============================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  /** Model identifier (provider-specific) */
  model?: string;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Expected response format */
  responseFormat?: 'text' | 'json';
  /** Stop sequences */
  stop?: string[];
  /** Request timeout in ms */
  timeoutMs?: number;
}

export interface LLMCompletionResponse {
  /** Generated content */
  content: string;
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Model used for generation */
  model: string;
  /** Reason for completion */
  finishReason: 'stop' | 'length' | 'error';
}

export interface LLMClient {
  /** Provider name for logging */
  readonly provider: string;
  
  /** Complete a prompt and return response */
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse>;
  
  /** Check if client is properly configured */
  healthCheck(): Promise<boolean>;
}

export type LLMProvider = 'groq' | 'google' | 'anthropic' | 'mistral' | 'openrouter';

// ============================================
// Embedding Types
// ============================================

export interface EmbeddingOptions {
  /** Model for embedding generation */
  model?: string;
}

export interface EmbeddingResult {
  /** Vector representation */
  embedding: number[];
  /** Model used */
  model: string;
  /** Tokens used */
  tokensUsed: number;
}

export interface SimilarityResult {
  /** Recipe ID */
  recipeId: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Distance (lower is more similar) */
  distance?: number;
}

export type EmbeddingProvider = 'supabase' | 'huggingface' | 'openai';

// ============================================
// Meal Plan Generation Types
// ============================================

export interface UserContext {
  userId: string;
  householdSize: number;
  dietaryRestrictions: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  weeklyBudgetCents?: number;
  maxPrepTimeMinutes?: number;
  cuisinePreferences: string[];
  dislikedIngredients: string[];
}

export interface TemporalContext {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  weekStart: string; // ISO date
  weekEnd: string;
  holidays: string[];
  specialEvents: string[];
}

export interface BehavioralContext {
  recentRecipeIds: string[];
  favoriteRecipeIds: string[];
  completionRate: number;
}

export interface MealPlanConstraints {
  mealsPerDay: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
  includeMealPrep: boolean;
  varietyLevel: 'low' | 'medium' | 'high';
  budgetLimit?: number;
}

export interface MealPlanGenerationContext {
  user: UserContext;
  temporal: TemporalContext;
  behavioral: BehavioralContext;
  constraints: MealPlanConstraints;
}

export interface RecipeForAI {
  id: string;
  name: string;
  description?: string;
  prepTime: number;
  cookTime: number;
  difficulty: string;
  cuisine?: string;
  tags: string[];
  mainIngredients: string[];
  nutritionSummary?: string;
}

export interface GeneratedMealEntry {
  recipeId: string;
  servings: number;
  notes?: string;
}

export interface GeneratedDayPlan {
  date: string;
  meals: {
    breakfast?: GeneratedMealEntry;
    lunch?: GeneratedMealEntry;
    dinner?: GeneratedMealEntry;
    snack?: GeneratedMealEntry;
  };
}

export interface GeneratedMealPlan {
  explanation: string;
  days: GeneratedDayPlan[];
  shoppingTips: string[];
  mealPrepSuggestions: string[];
}

export interface MealPlanGenerationResult {
  success: boolean;
  mealPlan?: GeneratedMealPlan;
  error?: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
  };
}

// ============================================
// Service Configuration
// ============================================

export interface AIServiceConfig {
  llm: {
    provider: LLMProvider;
    model?: string;
    fallbackProvider?: LLMProvider;
    apiKey: string;
    fallbackApiKey?: string;
  };
  embeddings: {
    provider: EmbeddingProvider;
    model?: string;
    apiKey?: string;
    dimensions: number;
  };
  defaults: {
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
}

export function loadAIConfig(): AIServiceConfig {
  const llmProvider = (process.env.LLM_PROVIDER || 'groq') as LLMProvider;
  const embeddingProvider = (process.env.EMBEDDING_PROVIDER || 'huggingface') as EmbeddingProvider;
  
  // Get API key based on provider
  const apiKeyMap: Record<LLMProvider, string> = {
    groq: process.env.GROQ_API_KEY || '',
    google: process.env.GOOGLE_AI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    mistral: process.env.MISTRAL_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
  };

  const modelMap: Record<LLMProvider, string> = {
    groq: 'llama-3.3-70b-versatile',
    google: 'gemini-1.5-flash',
    anthropic: 'claude-3-5-sonnet-20241022',
    mistral: 'mistral-small-latest',
    openrouter: 'meta-llama/llama-3.1-70b-instruct',
  };

  return {
    llm: {
      provider: llmProvider,
      model: process.env.LLM_MODEL || modelMap[llmProvider],
      fallbackProvider: process.env.LLM_FALLBACK_PROVIDER as LLMProvider | undefined,
      apiKey: apiKeyMap[llmProvider],
      fallbackApiKey: process.env.LLM_FALLBACK_PROVIDER 
        ? apiKeyMap[process.env.LLM_FALLBACK_PROVIDER as LLMProvider] 
        : undefined,
    },
    embeddings: {
      provider: embeddingProvider,
      model: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
      apiKey: process.env.HF_TOKEN || process.env.OPENAI_API_KEY,
      dimensions: embeddingProvider === 'openai' ? 1536 : 384,
    },
    defaults: {
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096', 10),
      timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
    },
  };
}
