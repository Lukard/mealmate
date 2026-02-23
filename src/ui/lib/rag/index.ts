/**
 * RAG Module - Retrieval-Augmented Generation for MealMate
 * 
 * Provides semantic search and product matching for supermarket products.
 * 
 * @example
 * ```typescript
 * import { searchProducts, generateShoppingList } from '@/lib/rag';
 * 
 * // Search for products
 * const result = await searchProducts('pechuga de pollo', { limit: 5 });
 * 
 * // Generate shopping list from ingredients
 * const shoppingList = await generateShoppingList([
 *   '500g de pechuga de pollo',
 *   '200g de arroz',
 *   '2 tomates',
 * ]);
 * ```
 */

// Product embeddings utilities
export {
  generateEmbedding,
  generateEmbeddings,
  normalizeIngredient,
  extractMainIngredients,
  buildIngredientSearchText,
  getEmbeddingConfig,
  productEmbeddings,
  type EmbeddingConfig,
  type ProductMatch,
  type IngredientMatch,
} from './product-embeddings';

// Semantic search functions
export {
  searchProducts,
  searchProductsSemantic,
  searchProductsHybrid,
  searchIngredientsBatch,
  generateShoppingList,
  semanticSearch,
  type SearchOptions,
  type SearchResult,
  type BatchSearchResult,
  type ShoppingItem,
  type ShoppingList,
} from './semantic-search';

// Prompts and context builders
export {
  buildProductContext,
  buildUserPrompt,
  RAG_SYSTEM_PROMPT,
} from './prompts';

// Validation
export {
  validateMealPlan,
  parseMealPlanResponse,
  type ValidationResult,
} from './validator';
