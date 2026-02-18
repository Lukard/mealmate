/**
 * Embeddings Service
 * Handles recipe embedding generation and similarity search
 * 
 * Supports:
 * - HuggingFace Inference API (free tier)
 * - Local processing via Supabase functions
 * - OpenAI (production)
 */

import { db, schemaAI } from '../../db/client.js';
import { recipes } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { EmbeddingProvider, EmbeddingResult, SimilarityResult } from './types.js';

const { recipeEmbeddings } = schemaAI;

// ============================================
// Configuration
// ============================================

interface EmbeddingsConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey?: string;
  dimensions: number;
  batchSize: number;
}

function loadEmbeddingsConfig(): EmbeddingsConfig {
  const provider = (process.env.EMBEDDING_PROVIDER || 'huggingface') as EmbeddingProvider;
  
  const modelMap: Record<EmbeddingProvider, string> = {
    huggingface: 'sentence-transformers/all-MiniLM-L6-v2',
    supabase: 'gte-small',
    openai: 'text-embedding-3-small',
  };

  const dimensionsMap: Record<EmbeddingProvider, number> = {
    huggingface: 384,
    supabase: 384,
    openai: 1536,
  };

  return {
    provider,
    model: process.env.EMBEDDING_MODEL || modelMap[provider],
    apiKey: provider === 'huggingface' 
      ? process.env.HF_TOKEN 
      : process.env.OPENAI_API_KEY,
    dimensions: dimensionsMap[provider],
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '10', 10),
  };
}

// ============================================
// Embedding Generation
// ============================================

/**
 * Generate embedding using HuggingFace Inference API
 */
async function generateHuggingFaceEmbedding(
  text: string,
  model: string,
  apiKey?: string
): Promise<number[]> {
  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error (${response.status}): ${error}`);
  }

  const embedding = (await response.json()) as number[] | number[][];
  
  // HuggingFace returns nested array for single input
  if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
    return embedding[0] as number[];
  }
  
  return embedding as number[];
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * Generate embedding using OpenAI API
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
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as OpenAIEmbeddingResponse;
  return data.data[0].embedding;
}

// ============================================
// Embeddings Service Class
// ============================================

export class EmbeddingsService {
  private config: EmbeddingsConfig;

  constructor() {
    this.config = loadEmbeddingsConfig();
    console.log(
      `[Embeddings] Provider: ${this.config.provider}, Model: ${this.config.model}`
    );
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();
    let embedding: number[];

    switch (this.config.provider) {
      case 'huggingface':
        embedding = await generateHuggingFaceEmbedding(
          text,
          this.config.model,
          this.config.apiKey
        );
        break;

      case 'openai':
        if (!this.config.apiKey) {
          throw new Error('OpenAI API key required for embeddings');
        }
        embedding = await generateOpenAIEmbedding(
          text,
          this.config.model,
          this.config.apiKey
        );
        break;

      case 'supabase':
        // Supabase uses same HuggingFace models via Edge Functions
        embedding = await generateHuggingFaceEmbedding(
          text,
          this.config.model,
          this.config.apiKey
        );
        break;

      default:
        throw new Error(`Unknown embedding provider: ${this.config.provider}`);
    }

    // Ensure correct dimensions
    if (embedding.length !== this.config.dimensions) {
      console.warn(
        `[Embeddings] Dimension mismatch: got ${embedding.length}, expected ${this.config.dimensions}`
      );
    }

    return {
      embedding,
      model: this.config.model,
      tokensUsed: Math.ceil(text.split(/\s+/).length * 1.3), // Rough estimate
    };
  }

  /**
   * Build searchable text from recipe
   */
  buildRecipeText(recipe: {
    name: string;
    description?: string | null;
    cuisine?: string | null;
    tags?: string[] | null;
    ingredients?: string[];
  }): string {
    const parts = [
      recipe.name,
      recipe.description || '',
      recipe.cuisine || '',
      ...(recipe.tags || []),
      ...(recipe.ingredients || []),
    ];

    return parts.filter(Boolean).join(' ').slice(0, 1000); // Limit length
  }

  /**
   * Generate content hash for change detection
   */
  generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 64);
  }

  /**
   * Generate and store embedding for a recipe
   */
  async embedRecipe(recipeId: string): Promise<void> {
    // Fetch recipe with ingredients
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
      with: {
        ingredients: {
          with: {
            ingredient: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    // Build text representation
    const ingredientNames = recipe.ingredients.map(
      (ri) => ri.ingredient?.name || ''
    );
    const text = this.buildRecipeText({
      name: recipe.name,
      description: recipe.description,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
      ingredients: ingredientNames,
    });

    const contentHash = this.generateContentHash(text);

    // Check if embedding already exists and is current
    const [existing] = await db
      .select()
      .from(recipeEmbeddings)
      .where(eq(recipeEmbeddings.recipeId, recipeId))
      .limit(1);

    if (existing?.contentHash === contentHash) {
      console.log(`[Embeddings] Recipe ${recipeId} embedding is current, skipping`);
      return;
    }

    // Generate embedding
    const { embedding } = await this.generateEmbedding(text);

    // Upsert embedding
    if (existing) {
      await db
        .update(recipeEmbeddings)
        .set({
          embedding,
          contentHash,
          embeddingModel: this.config.model,
          updatedAt: new Date(),
        })
        .where(eq(recipeEmbeddings.recipeId, recipeId));
    } else {
      await db.insert(recipeEmbeddings).values({
        recipeId,
        embedding,
        contentHash,
        embeddingModel: this.config.model,
      });
    }

    console.log(`[Embeddings] Embedded recipe: ${recipe.name}`);
  }

  /**
   * Embed all recipes that need updating
   */
  async embedAllRecipes(options?: { forceAll?: boolean }): Promise<{
    processed: number;
    skipped: number;
    errors: number;
  }> {
    const stats = { processed: 0, skipped: 0, errors: 0 };

    // Get all recipes
    const allRecipes = await db.query.recipes.findMany({
      with: {
        ingredients: {
          with: {
            ingredient: true,
          },
        },
      },
    });

    console.log(`[Embeddings] Processing ${allRecipes.length} recipes...`);

    // Process in batches
    for (let i = 0; i < allRecipes.length; i += this.config.batchSize) {
      const batch = allRecipes.slice(i, i + this.config.batchSize);
      
      for (const recipe of batch) {
        try {
          const ingredientNames = recipe.ingredients.map(
            (ri) => ri.ingredient?.name || ''
          );
          const text = this.buildRecipeText({
            name: recipe.name,
            description: recipe.description,
            cuisine: recipe.cuisine,
            tags: recipe.tags,
            ingredients: ingredientNames,
          });

          const contentHash = this.generateContentHash(text);

          // Check existing
          const [existing] = await db
            .select()
            .from(recipeEmbeddings)
            .where(eq(recipeEmbeddings.recipeId, recipe.id))
            .limit(1);

          if (!options?.forceAll && existing?.contentHash === contentHash) {
            stats.skipped++;
            continue;
          }

          // Generate and store
          const { embedding } = await this.generateEmbedding(text);

          if (existing) {
            await db
              .update(recipeEmbeddings)
              .set({
                embedding,
                contentHash,
                embeddingModel: this.config.model,
                updatedAt: new Date(),
              })
              .where(eq(recipeEmbeddings.recipeId, recipe.id));
          } else {
            await db.insert(recipeEmbeddings).values({
              recipeId: recipe.id,
              embedding,
              contentHash,
              embeddingModel: this.config.model,
            });
          }

          stats.processed++;
        } catch (error) {
          console.error(`[Embeddings] Error embedding recipe ${recipe.id}:`, error);
          stats.errors++;
        }
      }

      // Rate limiting between batches
      if (i + this.config.batchSize < allRecipes.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `[Embeddings] Complete: ${stats.processed} processed, ${stats.skipped} skipped, ${stats.errors} errors`
    );

    return stats;
  }

  /**
   * Find similar recipes using vector similarity
   */
  async findSimilarRecipes(
    recipeId: string,
    limit = 5,
    excludeIds: string[] = []
  ): Promise<SimilarityResult[]> {
    // Get the source embedding
    const [sourceEmbedding] = await db
      .select()
      .from(recipeEmbeddings)
      .where(eq(recipeEmbeddings.recipeId, recipeId))
      .limit(1);

    if (!sourceEmbedding) {
      throw new Error(`No embedding found for recipe: ${recipeId}`);
    }

    // Build exclusion list
    const exclusions = [recipeId, ...excludeIds];
    const exclusionList = exclusions.map((id) => `'${id}'`).join(',');
    const embeddingVector = `'[${sourceEmbedding.embedding.join(',')}]'::vector`;

    // Query similar recipes using cosine distance
    const results = await db.execute<{ recipe_id: string; similarity: number }>(sql`
      SELECT 
        recipe_id,
        1 - (embedding <=> ${sql.raw(embeddingVector)}) as similarity
      FROM recipe_embeddings
      WHERE recipe_id NOT IN (${sql.raw(exclusionList)})
      ORDER BY embedding <=> ${sql.raw(embeddingVector)}
      LIMIT ${limit}
    `);

    return results.map((row) => ({
      recipeId: row.recipe_id,
      similarity: Number(row.similarity),
    }));
  }

  /**
   * Search recipes by text query
   */
  async searchRecipes(
    query: string,
    limit = 10,
    excludeIds: string[] = []
  ): Promise<SimilarityResult[]> {
    // Generate embedding for query
    const { embedding } = await this.generateEmbedding(query);
    const embeddingVector = `'[${embedding.join(',')}]'::vector`;

    // Build where clause
    const whereClause = excludeIds.length > 0
      ? `WHERE recipe_id NOT IN (${excludeIds.map((id) => `'${id}'`).join(',')})`
      : '';

    // Query similar recipes
    const results = await db.execute<{ recipe_id: string; similarity: number }>(sql`
      SELECT 
        recipe_id,
        1 - (embedding <=> ${sql.raw(embeddingVector)}) as similarity
      FROM recipe_embeddings
      ${sql.raw(whereClause)}
      ORDER BY embedding <=> ${sql.raw(embeddingVector)}
      LIMIT ${limit}
    `);

    return results.map((row) => ({
      recipeId: row.recipe_id,
      similarity: Number(row.similarity),
    }));
  }

  /**
   * Get embedding statistics
   */
  async getStats(): Promise<{
    totalRecipes: number;
    embeddedRecipes: number;
    provider: string;
    model: string;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(recipes);
    
    const [embeddedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(recipeEmbeddings);

    return {
      totalRecipes: Number(totalResult?.count || 0),
      embeddedRecipes: Number(embeddedResult?.count || 0),
      provider: this.config.provider,
      model: this.config.model,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let embeddingsServiceInstance: EmbeddingsService | null = null;

export function getEmbeddingsService(): EmbeddingsService {
  if (!embeddingsServiceInstance) {
    embeddingsServiceInstance = new EmbeddingsService();
  }
  return embeddingsServiceInstance;
}

export function resetEmbeddingsService(): void {
  embeddingsServiceInstance = null;
}
