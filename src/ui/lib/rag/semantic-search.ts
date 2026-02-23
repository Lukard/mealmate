/**
 * Semantic Search Service
 * 
 * Provides semantic search functionality for supermarket products using
 * vector embeddings stored in Supabase.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  generateEmbedding,
  getEmbeddingConfig,
  buildIngredientSearchText,
  normalizeIngredient,
  type ProductMatch,
  type IngredientMatch,
} from './product-embeddings';

// ============================================
// Types
// ============================================

export interface SearchOptions {
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Maximum results per ingredient */
  limit?: number;
  /** Filter by supermarket */
  supermarket?: string;
  /** Filter by category */
  category?: string;
  /** Only available products */
  availableOnly?: boolean;
  /** Use hybrid search (semantic + text) */
  hybrid?: boolean;
  /** Semantic weight for hybrid search (0-1) */
  semanticWeight?: number;
}

export interface SearchResult {
  products: ProductMatch[];
  query: string;
  embedding?: number[];
  searchTimeMs: number;
}

export interface BatchSearchResult {
  ingredients: IngredientMatch[];
  totalProducts: number;
  searchTimeMs: number;
}

// ============================================
// Supabase Client
// ============================================

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || 
                process.env.SUPABASE_ANON_KEY || 
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase configuration missing');
    }
    
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ============================================
// Search Functions
// ============================================

/**
 * Search products by semantic similarity
 */
export async function searchProductsSemantic(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const startTime = Date.now();
  const supabase = getSupabase();
  const config = getEmbeddingConfig();

  // Generate embedding for query
  const searchText = buildIngredientSearchText(query);
  const embedding = await generateEmbedding(searchText, config);

  // Call Supabase RPC function
  const { data, error } = await supabase.rpc('search_products_semantic', {
    query_embedding: JSON.stringify(embedding),
    match_threshold: options.threshold ?? 0.5,
    match_count: options.limit ?? 10,
    filter_supermarket: options.supermarket ?? null,
    filter_category: options.category ?? null,
    filter_available: options.availableOnly ?? true,
  });

  if (error) {
    console.error('Semantic search error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  return {
    products: data || [],
    query,
    embedding,
    searchTimeMs: Date.now() - startTime,
  };
}

/**
 * Search products using hybrid approach (semantic + full-text)
 */
export async function searchProductsHybrid(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const startTime = Date.now();
  const supabase = getSupabase();
  const config = getEmbeddingConfig();

  // Generate embedding for query
  const searchText = buildIngredientSearchText(query);
  const embedding = await generateEmbedding(searchText, config);

  // Call Supabase RPC function
  const { data, error } = await supabase.rpc('search_products_hybrid', {
    search_text: query,
    query_embedding: JSON.stringify(embedding),
    semantic_weight: options.semanticWeight ?? 0.7,
    match_count: options.limit ?? 10,
    filter_supermarket: options.supermarket ?? null,
    filter_available: options.availableOnly ?? true,
  });

  if (error) {
    console.error('Hybrid search error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  // Map combined_score to similarity for consistency
  const products = (data || []).map((p: ProductMatch & { combined_score: number }) => ({
    ...p,
    similarity: p.combined_score ?? p.similarity,
  }));

  return {
    products,
    query,
    embedding,
    searchTimeMs: Date.now() - startTime,
  };
}

/**
 * Search for multiple ingredients at once (optimized batch)
 */
export async function searchIngredientsBatch(
  ingredients: string[],
  options: SearchOptions = {}
): Promise<BatchSearchResult> {
  const startTime = Date.now();
  const supabase = getSupabase();
  const config = getEmbeddingConfig();

  // Normalize and dedupe ingredients
  const normalizedIngredients = [...new Set(
    ingredients.map(normalizeIngredient).filter(i => i.length > 2)
  )];

  // Generate embeddings for all ingredients
  const ingredientData = await Promise.all(
    normalizedIngredients.map(async (name) => {
      const searchText = buildIngredientSearchText(name);
      const embedding = await generateEmbedding(searchText, config);
      return { name, embedding };
    })
  );

  // Call batch search RPC
  const { data, error } = await supabase.rpc('search_products_batch', {
    ingredients: JSON.stringify(ingredientData),
    match_threshold: options.threshold ?? 0.5,
    matches_per_ingredient: options.limit ?? 3,
    filter_supermarket: options.supermarket ?? null,
  });

  if (error) {
    console.error('Batch search error:', error);
    throw new Error(`Batch search failed: ${error.message}`);
  }

  // Group results by ingredient
  const resultMap = new Map<string, ProductMatch[]>();
  
  for (const row of data || []) {
    const products = resultMap.get(row.ingredient_name) || [];
    products.push({
      id: row.product_id,
      supermarket_id: 'mercadona', // TODO: get from result
      external_id: '',
      name: row.product_name,
      brand: row.brand,
      price: row.price,
      price_per_unit: row.price_per_unit,
      unit: row.unit,
      size_format: row.size_format,
      category: row.category,
      subcategory: null,
      image_url: row.image_url,
      available: true,
      similarity: row.similarity,
    });
    resultMap.set(row.ingredient_name, products);
  }

  // Build result structure
  const ingredientMatches: IngredientMatch[] = normalizedIngredients.map(name => {
    const products = resultMap.get(name) || [];
    return {
      ingredientName: name,
      products,
      bestMatch: products.length > 0 ? products[0] : null,
    };
  });

  return {
    ingredients: ingredientMatches,
    totalProducts: ingredientMatches.reduce((sum, im) => sum + im.products.length, 0),
    searchTimeMs: Date.now() - startTime,
  };
}

/**
 * Simple search wrapper - uses semantic or hybrid based on options
 */
export async function searchProducts(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  if (options.hybrid) {
    return searchProductsHybrid(query, options);
  }
  return searchProductsSemantic(query, options);
}

// ============================================
// Shopping List Generation
// ============================================

export interface ShoppingItem {
  ingredientName: string;
  product: ProductMatch | null;
  estimatedPrice: number;
  hasMatch: boolean;
  alternatives: ProductMatch[];
}

export interface ShoppingList {
  items: ShoppingItem[];
  totalEstimatedCost: number;
  matchedCount: number;
  unmatchedCount: number;
}

/**
 * Generate a shopping list from recipe ingredients
 */
export async function generateShoppingList(
  ingredients: string[],
  options: SearchOptions = {}
): Promise<ShoppingList> {
  const searchResult = await searchIngredientsBatch(ingredients, {
    ...options,
    limit: 3, // Get top 3 matches per ingredient
  });

  const items: ShoppingItem[] = searchResult.ingredients.map(match => ({
    ingredientName: match.ingredientName,
    product: match.bestMatch,
    estimatedPrice: match.bestMatch?.price ?? estimatePrice(match.ingredientName),
    hasMatch: match.bestMatch !== null,
    alternatives: match.products.slice(1),
  }));

  return {
    items,
    totalEstimatedCost: items.reduce((sum, item) => sum + item.estimatedPrice, 0),
    matchedCount: items.filter(i => i.hasMatch).length,
    unmatchedCount: items.filter(i => !i.hasMatch).length,
  };
}

/**
 * Fallback price estimation for unmatched ingredients
 */
function estimatePrice(ingredient: string): number {
  // Simple heuristic based on ingredient type
  const priceMap: Record<string, number> = {
    'carne': 8.0,
    'pollo': 6.0,
    'pescado': 10.0,
    'verdura': 2.0,
    'fruta': 2.5,
    'lácteo': 3.0,
    'pasta': 1.5,
    'arroz': 2.0,
    'aceite': 4.0,
    'especia': 2.0,
  };

  for (const [keyword, price] of Object.entries(priceMap)) {
    if (ingredient.toLowerCase().includes(keyword)) {
      return price;
    }
  }

  return 3.0; // Default estimate
}

// ============================================
// Export
// ============================================

export const semanticSearch = {
  searchProducts,
  searchProductsSemantic,
  searchProductsHybrid,
  searchIngredientsBatch,
  generateShoppingList,
};
