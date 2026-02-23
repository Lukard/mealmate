/**
 * RAG Types - Retrieval-Augmented Generation
 * 
 * Type definitions for the RAG system including product embeddings,
 * semantic search, and shopping list generation.
 */

// ============================================
// Embedding Types
// ============================================

/**
 * Embedding provider configuration
 */
export interface EmbeddingConfig {
  /** Embedding provider (huggingface, openai) */
  provider: 'huggingface' | 'openai';
  /** Model identifier */
  model: string;
  /** API key for the provider */
  apiKey?: string;
  /** Vector dimensions */
  dimensions: number;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Model used */
  model: string;
  /** Estimated tokens used */
  tokensUsed: number;
}

// ============================================
// Product Types
// ============================================

/**
 * Product match from semantic search
 */
export interface ProductMatch {
  id: string;
  supermarket_id: string;
  external_id: string;
  name: string;
  brand: string | null;
  price: number;
  price_per_unit: number | null;
  unit: string | null;
  size: number | null;
  size_format: string | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  thumbnail_url?: string | null;
  available: boolean;
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
}

/**
 * Ingredient match result with products
 */
export interface IngredientMatch {
  /** Original ingredient name (normalized) */
  ingredientName: string;
  /** Matched products sorted by similarity */
  products: ProductMatch[];
  /** Best matching product */
  bestMatch: ProductMatch | null;
}

// ============================================
// Search Types
// ============================================

/**
 * Options for semantic search
 */
export interface SearchOptions {
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Maximum results per query */
  limit?: number;
  /** Filter by supermarket ID */
  supermarket?: string;
  /** Filter by category */
  category?: string;
  /** Only return available products */
  availableOnly?: boolean;
  /** Use hybrid search (semantic + full-text) */
  hybrid?: boolean;
  /** Weight for semantic vs text search (0-1, higher = more semantic) */
  semanticWeight?: number;
}

/**
 * Result of a single product search
 */
export interface SearchResult {
  /** Matched products */
  products: ProductMatch[];
  /** Original query */
  query: string;
  /** Query embedding (if available) */
  embedding?: number[];
  /** Search time in milliseconds */
  searchTimeMs: number;
}

/**
 * Result of batch ingredient search
 */
export interface BatchSearchResult {
  /** Results per ingredient */
  ingredients: IngredientMatch[];
  /** Total products found */
  totalProducts: number;
  /** Total search time in milliseconds */
  searchTimeMs: number;
}

// ============================================
// Shopping List Types
// ============================================

/**
 * Single item in a shopping list
 */
export interface ShoppingItem {
  /** Original ingredient name */
  ingredientName: string;
  /** Matched product (null if no match) */
  product: ProductMatch | null;
  /** Estimated price (real or fallback) */
  estimatedPrice: number;
  /** Whether a real product was matched */
  hasMatch: boolean;
  /** Alternative product options */
  alternatives: ProductMatch[];
}

/**
 * Complete shopping list
 */
export interface ShoppingList {
  /** Shopping items */
  items: ShoppingItem[];
  /** Total estimated cost */
  totalEstimatedCost: number;
  /** Number of ingredients with matches */
  matchedCount: number;
  /** Number of ingredients without matches */
  unmatchedCount: number;
}

// ============================================
// Meal Plan RAG Types
// ============================================

/**
 * Product match for API response (simplified)
 */
export interface ProductMatchResponse {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  pricePerUnit: number | null;
  unit: string | null;
  sizeFormat: string | null;
  imageUrl: string | null;
  similarity: number;
}

/**
 * Ingredient with matched product
 */
export interface IngredientWithProduct {
  ingredient: string;
  product: ProductMatchResponse | null;
  estimatedPrice: number | null;
}

/**
 * Shopping list item for API response
 */
export interface ShoppingListItemResponse {
  ingredient: string;
  product: ProductMatchResponse | null;
  estimatedPrice: number;
  hasMatch: boolean;
  alternatives: Array<{
    id: string;
    name: string;
    brand: string | null;
    price: number;
    similarity: number;
  }>;
}

/**
 * Shopping list for API response
 */
export interface ShoppingListResponse {
  items: ShoppingListItemResponse[];
  totalEstimatedCost: number;
  matchedCount: number;
  unmatchedCount: number;
}

/**
 * Product matching statistics
 */
export interface ProductMatchingStats {
  enabled: boolean;
  ingredientsMatched: number;
  ingredientsTotal: number;
  matchRate: number;
}

/**
 * Generation metadata with RAG stats
 */
export interface GenerationMetadata {
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
  productMatching: ProductMatchingStats;
}

// ============================================
// Database Types (Supabase)
// ============================================

/**
 * Supabase product row with embedding
 */
export interface SupermarketProductRow {
  id: string;
  supermarket_id: string;
  external_id: string;
  name: string;
  description: string | null;
  brand: string | null;
  price: number;
  price_per_unit: number | null;
  unit: string | null;
  size: number | null;
  size_format: string | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  available: boolean;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  embedding_model: string | null;
  embedded_at: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
}

/**
 * Embedding stats view row
 */
export interface ProductEmbeddingStatsRow {
  supermarket_id: string;
  total_products: number;
  embedded_products: number;
  embedded_percentage: number;
  last_embedded_at: string | null;
}

// ============================================
// RPC Function Types
// ============================================

/**
 * Parameters for search_products_semantic RPC
 */
export interface SearchProductsSemanticParams {
  query_embedding: string; // JSON stringified vector
  match_threshold?: number;
  match_count?: number;
  filter_supermarket?: string | null;
  filter_category?: string | null;
  filter_available?: boolean;
}

/**
 * Parameters for search_products_batch RPC
 */
export interface SearchProductsBatchParams {
  ingredients: string; // JSON stringified array of {name, embedding}
  match_threshold?: number;
  matches_per_ingredient?: number;
  filter_supermarket?: string | null;
}

/**
 * Parameters for search_products_hybrid RPC
 */
export interface SearchProductsHybridParams {
  search_text: string;
  query_embedding: string; // JSON stringified vector
  semantic_weight?: number;
  match_count?: number;
  filter_supermarket?: string | null;
  filter_available?: boolean;
}
