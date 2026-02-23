/**
 * Product Embeddings Service
 * 
 * Handles embedding generation and semantic search for supermarket products.
 * Uses HuggingFace's all-MiniLM-L6-v2 model (384 dimensions).
 */

// ============================================
// Types
// ============================================

export interface EmbeddingConfig {
  provider: 'huggingface' | 'openai';
  model: string;
  apiKey?: string;
  dimensions: number;
}

export interface ProductMatch {
  id: string;
  supermarket_id: string;
  external_id: string;
  name: string;
  brand: string | null;
  price: number;
  price_per_unit: number | null;
  unit: string | null;
  size_format: string | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  available: boolean;
  similarity: number;
}

export interface IngredientMatch {
  ingredientName: string;
  products: ProductMatch[];
  bestMatch: ProductMatch | null;
}

// ============================================
// Configuration
// ============================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'huggingface',
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  dimensions: 384,
};

export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER || 'huggingface') as 'huggingface' | 'openai';
  
  if (provider === 'openai') {
    return {
      provider: 'openai',
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
      dimensions: 1536,
    };
  }

  return {
    ...DEFAULT_CONFIG,
    apiKey: process.env.HF_TOKEN,
  };
}

// ============================================
// Embedding Generation
// ============================================

/**
 * Generate embedding for text using HuggingFace
 */
async function generateHuggingFaceEmbedding(
  text: string,
  model: string,
  apiKey?: string
): Promise<number[]> {
  const response = await fetch(
    `https://router.huggingface.co/pipeline/feature-extraction/${model}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status}`);
  }

  const result = await response.json();
  return Array.isArray(result[0]) ? result[0] : result;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateOpenAIEmbedding(
  text: string,
  model: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embedding for text (provider-agnostic)
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingConfig = getEmbeddingConfig()
): Promise<number[]> {
  if (config.provider === 'openai') {
    if (!config.apiKey) throw new Error('OpenAI API key required');
    return generateOpenAIEmbedding(text, config.model, config.apiKey);
  }
  
  return generateHuggingFaceEmbedding(text, config.model, config.apiKey);
}

/**
 * Generate embeddings for multiple texts (with rate limiting)
 */
export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingConfig = getEmbeddingConfig(),
  delayMs = 100
): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text, config);
    embeddings.push(embedding);
    
    // Rate limiting
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return embeddings;
}

// ============================================
// Ingredient Text Processing
// ============================================

/**
 * Normalize ingredient text for embedding
 * Removes quantities, units, and preparation notes
 */
export function normalizeIngredient(ingredient: string): string {
  // Remove quantities (e.g., "200g de", "2 cucharadas de")
  let normalized = ingredient
    .replace(/^\d+\s*(g|kg|ml|l|cucharadas?|cdas?|tazas?|unidades?|ud\.?|piezas?)\s*(de\s+)?/i, '')
    .replace(/\(\d+\s*g\)/g, '')
    .trim();
  
  // Remove preparation notes (e.g., "picado", "en rodajas")
  normalized = normalized
    .replace(/\s*,?\s*(picad[oa]s?|cortad[oa]s?|troceado|en\s+\w+|al\s+gusto|opcional)$/i, '')
    .trim();
  
  // Remove leading "de" if present
  normalized = normalized.replace(/^de\s+/i, '');
  
  return normalized.toLowerCase();
}

/**
 * Extract main ingredients from a recipe's ingredient list
 */
export function extractMainIngredients(ingredients: string[]): string[] {
  return ingredients
    .map(normalizeIngredient)
    .filter(ing => ing.length > 2)
    .slice(0, 10); // Limit to top 10 ingredients
}

// ============================================
// Search Helpers
// ============================================

/**
 * Build search context for an ingredient
 * Adds category hints to improve matching
 */
export function buildIngredientSearchText(ingredient: string): string {
  const normalized = normalizeIngredient(ingredient);
  
  // Add category hints for common ingredients
  const categoryHints: Record<string, string> = {
    'pollo': 'carne aves',
    'ternera': 'carne vacuno',
    'cerdo': 'carne porcino',
    'salmon': 'pescado',
    'merluza': 'pescado',
    'atun': 'pescado conservas',
    'huevos': 'huevos lácteos',
    'leche': 'lácteos',
    'queso': 'lácteos',
    'arroz': 'arroces legumbres',
    'pasta': 'pasta italiana',
    'tomate': 'verduras hortalizas',
    'cebolla': 'verduras hortalizas',
    'aceite': 'aceites oliva',
    'pan': 'panadería',
  };

  const hint = Object.entries(categoryHints).find(([key]) => 
    normalized.includes(key)
  )?.[1];

  return hint ? `${normalized} ${hint}` : normalized;
}

// ============================================
// Export utilities
// ============================================

export const productEmbeddings = {
  generateEmbedding,
  generateEmbeddings,
  normalizeIngredient,
  extractMainIngredients,
  buildIngredientSearchText,
  getConfig: getEmbeddingConfig,
};
