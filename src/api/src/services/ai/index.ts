/**
 * AI Services Index
 * Exports all AI-related services and types
 */

// Types
export type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMClient,
  LLMProvider,
  EmbeddingOptions,
  EmbeddingResult,
  SimilarityResult,
  EmbeddingProvider,
  UserContext,
  TemporalContext,
  BehavioralContext,
  MealPlanConstraints,
  MealPlanGenerationContext,
  RecipeForAI,
  GeneratedMealEntry,
  GeneratedDayPlan,
  GeneratedMealPlan,
  MealPlanGenerationResult,
  AIServiceConfig,
} from './types.js';

export { loadAIConfig } from './types.js';

// LLM Client
export { 
  createLLMClient, 
  LLMService, 
  getLLMService, 
  resetLLMService 
} from './llm-client.js';

// Groq Client
export { GroqClient } from './clients/groq.client.js';

// Embeddings Service
export { 
  EmbeddingsService, 
  getEmbeddingsService, 
  resetEmbeddingsService 
} from './embeddings-service.js';

// Prompt Builder
export { 
  PromptBuilder, 
  ResponseParser,
  promptBuilder, 
  responseParser 
} from './prompt-builder.js';

// Meal Plan AI Service
export type { 
  GenerateMealPlanInput, 
  GenerateMealPlanOutput 
} from './meal-plan-ai-service.js';

export { 
  MealPlanAIService, 
  getMealPlanAIService, 
  resetMealPlanAIService 
} from './meal-plan-ai-service.js';
