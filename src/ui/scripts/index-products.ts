/**
 * Product Embeddings Indexer
 * 
 * Generates embeddings for all supermarket products and stores them in Supabase.
 * Uses HuggingFace's all-MiniLM-L6-v2 model (384 dimensions, free tier compatible).
 * 
 * Usage:
 *   npx tsx scripts/index-products.ts
 *   npx tsx scripts/index-products.ts --force   # Re-index all products
 *   npx tsx scripts/index-products.ts --batch 50   # Custom batch size
 * 
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key
 *   HF_TOKEN (optional) - HuggingFace token for higher rate limits
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// Configuration
// ============================================

interface Config {
  supabaseUrl: string;
  supabaseKey: string;
  hfToken?: string;
  embeddingModel: string;
  batchSize: number;
  rateLimitMs: number;
  forceReindex: boolean;
}

function loadConfig(): Config {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const forceReindex = args.includes('--force');
  const batchSizeIdx = args.indexOf('--batch');
  const batchSize = batchSizeIdx !== -1 ? parseInt(args[batchSizeIdx + 1], 10) : 25;

  return {
    supabaseUrl,
    supabaseKey,
    hfToken: process.env.HF_TOKEN,
    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
    batchSize,
    rateLimitMs: 200, // HuggingFace rate limit
    forceReindex,
  };
}

// ============================================
// Types
// ============================================

interface Product {
  id: string;
  supermarket_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  embedded_at: string | null;
}

interface IndexStats {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
  startTime: number;
}

// ============================================
// Embedding Generation
// ============================================

/**
 * Generate embedding using HuggingFace Inference API
 */
async function generateEmbedding(
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
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
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

  const embedding = await response.json();
  
  // HuggingFace returns nested array for single input
  if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
    return embedding[0] as number[];
  }
  
  return embedding as number[];
}

/**
 * Generate embeddings for a batch of texts (parallel with rate limiting)
 */
async function generateEmbeddingsBatch(
  texts: string[],
  model: string,
  apiKey?: string,
  delayMs = 100
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  
  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text, model, apiKey);
      results.push(embedding);
      await sleep(delayMs);
    } catch (error) {
      console.error(`  Error embedding: "${text.slice(0, 50)}..."`, error);
      results.push(null);
    }
  }
  
  return results;
}

// ============================================
// Text Building
// ============================================

/**
 * Build searchable text representation of a product
 */
function buildProductText(product: Product): string {
  const parts = [
    product.name,
    product.brand,
    product.category,
    product.subcategory,
  ].filter(Boolean);
  
  // Limit to reasonable length (model context)
  return parts.join(' ').slice(0, 512);
}

// ============================================
// Database Operations
// ============================================

/**
 * Get products that need embedding
 */
async function getProductsToEmbed(
  supabase: SupabaseClient,
  forceReindex: boolean,
  limit = 1000
): Promise<Product[]> {
  let query = supabase
    .from('supermarket_products')
    .select('id, supermarket_id, name, brand, category, subcategory, embedded_at')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!forceReindex) {
    query = query.is('embedded_at', null);
  }

  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}

/**
 * Update product embeddings in batch
 */
async function updateProductEmbeddings(
  supabase: SupabaseClient,
  updates: Array<{ id: string; embedding: number[] }>,
  model: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Update one by one (Supabase doesn't support batch vector updates cleanly)
  for (const { id, embedding } of updates) {
    const { error } = await supabase
      .from('supermarket_products')
      .update({
        embedding: JSON.stringify(embedding), // pgvector accepts JSON array
        embedding_model: model,
        embedded_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error(`  Failed to update ${id}: ${error.message}`);
      failed++;
    } else {
      success++;
    }
  }

  return { success, failed };
}

// ============================================
// Utilities
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

function printProgress(stats: IndexStats): void {
  const elapsed = Date.now() - stats.startTime;
  const rate = stats.processed / (elapsed / 1000);
  const eta = (stats.total - stats.processed - stats.skipped) / rate;
  
  process.stdout.write(
    `\r  Progress: ${stats.processed + stats.skipped}/${stats.total} ` +
    `(${rate.toFixed(1)}/s, ETA: ${formatDuration(eta * 1000)})`
  );
}

// ============================================
// Main Process
// ============================================

async function indexProducts(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Product Embeddings Indexer');
  console.log('='.repeat(60));
  
  const config = loadConfig();
  console.log(`Model: ${config.embeddingModel}`);
  console.log(`Batch size: ${config.batchSize}`);
  console.log(`Force reindex: ${config.forceReindex}`);
  console.log(`HuggingFace token: ${config.hfToken ? '✓' : '✗ (using free tier)'}`);
  console.log('');

  // Initialize Supabase
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  // Get total count
  const { count: totalCount } = await supabase
    .from('supermarket_products')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total products in database: ${totalCount}`);

  // Get products needing embedding
  const products = await getProductsToEmbed(supabase, config.forceReindex, 10000);
  console.log(`Products to process: ${products.length}`);
  
  if (products.length === 0) {
    console.log('✓ All products already have embeddings!');
    return;
  }

  const stats: IndexStats = {
    total: products.length,
    processed: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now(),
  };

  console.log('\nStarting indexing...\n');

  // Process in batches
  for (let i = 0; i < products.length; i += config.batchSize) {
    const batch = products.slice(i, i + config.batchSize);
    
    // Build texts
    const texts = batch.map(buildProductText);
    
    // Generate embeddings
    const embeddings = await generateEmbeddingsBatch(
      texts,
      config.embeddingModel,
      config.hfToken,
      config.rateLimitMs
    );

    // Prepare updates
    const updates: Array<{ id: string; embedding: number[] }> = [];
    
    for (let j = 0; j < batch.length; j++) {
      if (embeddings[j]) {
        updates.push({ id: batch[j].id, embedding: embeddings[j]! });
      } else {
        stats.errors++;
      }
    }

    // Save to database
    if (updates.length > 0) {
      const { success, failed } = await updateProductEmbeddings(
        supabase,
        updates,
        config.embeddingModel
      );
      stats.processed += success;
      stats.errors += failed;
    }

    printProgress(stats);

    // Rate limiting between batches
    await sleep(config.rateLimitMs);
  }

  // Final stats
  const totalTime = Date.now() - stats.startTime;
  
  console.log('\n\n' + '='.repeat(60));
  console.log('Indexing Complete!');
  console.log('='.repeat(60));
  console.log(`Total processed: ${stats.processed}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Time: ${formatDuration(totalTime)}`);
  console.log(`Rate: ${(stats.processed / (totalTime / 1000)).toFixed(1)} products/sec`);

  // Verify embedding stats
  const { data: statsData } = await supabase
    .from('product_embedding_stats')
    .select('*');
  
  console.log('\nEmbedding coverage:');
  for (const row of statsData || []) {
    console.log(
      `  ${row.supermarket_id}: ${row.embedded_products}/${row.total_products} ` +
      `(${row.embedded_percentage}%)`
    );
  }
}

// Run
indexProducts().catch(console.error);
