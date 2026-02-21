/**
 * Mercadona Catalog Sync Script
 * 
 * Downloads all products from Mercadona's API and stores them in Supabase.
 * Designed to run as a nightly cron job.
 * 
 * Usage:
 *   npx tsx scripts/sync-mercadona.ts
 * 
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key (for writes)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
interface MercadonaCategory {
  id: number;
  name: string;
  order?: number;
  categories?: MercadonaCategory[];
  products?: MercadonaProduct[];
}

interface MercadonaProduct {
  id: string;
  display_name: string;
  ean?: string;
  packaging?: string;
  price_instructions?: {
    unit_price: number;
    unit_size?: number;
    reference_price?: number;
    reference_format?: string;
    is_new?: boolean;
    is_pack?: boolean;
  };
  photos?: Array<{
    zoom?: string;
    regular?: string;
    thumbnail?: string;
  }>;
  details?: {
    brand?: string;
    description?: string;
  };
  categories?: Array<{ id: number; name: string }>;
  published?: boolean;
  share_url?: string;
}

interface SyncStats {
  categoriesProcessed: number;
  productsProcessed: number;
  productsInserted: number;
  productsUpdated: number;
  priceChanges: number;
  errors: string[];
}

// Config
const MERCADONA_API = 'https://tienda.mercadona.es/api';
const RATE_LIMIT_MS = 300; // 300ms between requests (conservative)
const BATCH_SIZE = 100; // Products per upsert batch

// Supabase client
let supabase: SupabaseClient;

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MealMate-Sync/1.0',
        },
      });
      
      if (response.status === 429) {
        // Rate limited - wait longer
        console.log(`  Rate limited, waiting ${(i + 1) * 5} seconds...`);
        await sleep((i + 1) * 5000);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  Retry ${i + 1}/${retries} for ${url}`);
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Parse packaging string to extract unit info
 */
function parsePackaging(packaging?: string): { unit: string; size: number; sizeFormat: string } {
  if (!packaging) {
    return { unit: 'unit', size: 1, sizeFormat: '1 ud' };
  }

  const sizeFormat = packaging;

  // Match patterns
  const kgMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) {
    return { unit: 'kg', size: parseFloat(kgMatch[1].replace(',', '.')), sizeFormat };
  }

  const gMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*g(?:r)?/i);
  if (gMatch) {
    return { unit: 'g', size: parseFloat(gMatch[1].replace(',', '.')), sizeFormat };
  }

  const lMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*l(?:itro)?s?/i);
  if (lMatch) {
    return { unit: 'l', size: parseFloat(lMatch[1].replace(',', '.')), sizeFormat };
  }

  const mlMatch = packaging.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  if (mlMatch) {
    return { unit: 'ml', size: parseFloat(mlMatch[1].replace(',', '.')), sizeFormat };
  }

  const unitMatch = packaging.match(/(\d+)\s*(?:ud|unid|unidades?)/i);
  if (unitMatch) {
    return { unit: 'unit', size: parseInt(unitMatch[1], 10), sizeFormat };
  }

  return { unit: 'unit', size: 1, sizeFormat };
}

/**
 * Update sync status in database
 */
async function updateSyncStatus(
  status: 'in_progress' | 'success' | 'failed',
  stats?: Partial<SyncStats>,
  error?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    last_sync_status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'in_progress') {
    update.last_sync_started_at = new Date().toISOString();
  } else if (status === 'success') {
    update.last_sync_completed_at = new Date().toISOString();
    update.products_synced = stats?.productsProcessed || 0;
    update.categories_synced = stats?.categoriesProcessed || 0;
  } else if (status === 'failed') {
    update.error_message = error;
  }

  await supabase
    .from('supermarket_sync_status')
    .upsert({ supermarket_id: 'mercadona', ...update });
}

/**
 * Fetch all categories from Mercadona
 */
async function fetchCategories(): Promise<MercadonaCategory[]> {
  console.log('Fetching categories...');
  const response = await fetchWithRetry<{ results: MercadonaCategory[] }>(
    `${MERCADONA_API}/categories/`
  );
  return response.results;
}

/**
 * Fetch products for a specific category
 */
async function fetchCategoryProducts(categoryId: number): Promise<MercadonaProduct[]> {
  const category = await fetchWithRetry<MercadonaCategory>(
    `${MERCADONA_API}/categories/${categoryId}/`
  );
  
  const products: MercadonaProduct[] = [];
  
  // Extract products from this category
  if (category.products) {
    products.push(...category.products);
  }
  
  // Extract from subcategories
  if (category.categories) {
    for (const subcat of category.categories) {
      if (subcat.products) {
        products.push(...subcat.products);
      }
    }
  }
  
  return products;
}

/**
 * Sync products to database
 */
async function syncProducts(products: MercadonaProduct[], stats: SyncStats): Promise<void> {
  if (products.length === 0) return;

  // Prepare product records
  const records = products.map(product => {
    const { unit, size, sizeFormat } = parsePackaging(product.packaging);
    
    return {
      supermarket_id: 'mercadona',
      external_id: product.id,
      name: product.display_name,
      description: product.details?.description || null,
      brand: product.details?.brand || null,
      price: product.price_instructions?.unit_price || 0,
      price_per_unit: product.price_instructions?.reference_price || null,
      unit,
      size,
      size_format: sizeFormat,
      category: product.categories?.[0]?.name || null,
      subcategory: product.categories?.[1]?.name || null,
      image_url: product.photos?.[0]?.zoom || product.photos?.[0]?.regular || null,
      thumbnail_url: product.photos?.[0]?.thumbnail || null,
      available: product.published !== false,
      metadata: {
        ean: product.ean,
        share_url: product.share_url,
        is_new: product.price_instructions?.is_new,
        is_pack: product.price_instructions?.is_pack,
      },
      last_synced_at: new Date().toISOString(),
    };
  });

  // Get existing products to check for price changes
  const externalIds = records.map(r => r.external_id);
  const { data: existing } = await supabase
    .from('supermarket_products')
    .select('id, external_id, price')
    .eq('supermarket_id', 'mercadona')
    .in('external_id', externalIds);

  const existingMap = new Map(existing?.map(e => [e.external_id, e]) || []);

  // Track price changes
  const priceChanges: Array<{ product_id: string; old_price: number; new_price: number }> = [];
  
  for (const record of records) {
    const existingProduct = existingMap.get(record.external_id);
    if (existingProduct && existingProduct.price !== record.price) {
      priceChanges.push({
        product_id: existingProduct.id,
        old_price: existingProduct.price,
        new_price: record.price,
      });
    }
  }

  // Upsert products in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from('supermarket_products')
      .upsert(batch, { onConflict: 'supermarket_id,external_id' });
    
    if (error) {
      console.error('  Error upserting batch:', error.message);
      stats.errors.push(`Upsert error: ${error.message}`);
    } else {
      stats.productsProcessed += batch.length;
    }
  }

  // Record price changes
  if (priceChanges.length > 0) {
    const { error } = await supabase
      .from('supermarket_price_history')
      .insert(priceChanges);
    
    if (!error) {
      stats.priceChanges += priceChanges.length;
    }
  }
}

/**
 * Sync categories to database
 */
async function syncCategories(categories: MercadonaCategory[], stats: SyncStats): Promise<void> {
  const flattenCategories = (
    cats: MercadonaCategory[],
    parentId?: string
  ): Array<{ supermarket_id: string; external_id: string; name: string; parent_id: string | null; order_index: number }> => {
    const result: Array<{ supermarket_id: string; external_id: string; name: string; parent_id: string | null; order_index: number }> = [];
    
    for (const cat of cats) {
      result.push({
        supermarket_id: 'mercadona',
        external_id: String(cat.id),
        name: cat.name,
        parent_id: parentId || null,
        order_index: cat.order || 0,
      });
      
      if (cat.categories) {
        result.push(...flattenCategories(cat.categories, String(cat.id)));
      }
    }
    
    return result;
  };

  const records = flattenCategories(categories);
  
  const { error } = await supabase
    .from('supermarket_categories')
    .upsert(records, { onConflict: 'supermarket_id,external_id' });

  if (error) {
    console.error('Error syncing categories:', error.message);
    stats.errors.push(`Categories error: ${error.message}`);
  } else {
    stats.categoriesProcessed = records.length;
  }
}

/**
 * Get all leaf category IDs (categories with products)
 */
function getLeafCategoryIds(categories: MercadonaCategory[]): number[] {
  const ids: number[] = [];
  
  for (const cat of categories) {
    if (cat.categories) {
      // Has subcategories - recurse
      for (const subcat of cat.categories) {
        ids.push(subcat.id);
      }
    } else {
      // Leaf category
      ids.push(cat.id);
    }
  }
  
  return ids;
}

/**
 * Main sync function
 */
async function syncMercadona(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Mercadona Catalog Sync');
  console.log('Started at:', new Date().toISOString());
  console.log('='.repeat(60));

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  supabase = createClient(supabaseUrl, supabaseKey);

  const stats: SyncStats = {
    categoriesProcessed: 0,
    productsProcessed: 0,
    productsInserted: 0,
    productsUpdated: 0,
    priceChanges: 0,
    errors: [],
  };

  try {
    await updateSyncStatus('in_progress');

    // Step 1: Fetch all categories
    const categories = await fetchCategories();
    console.log(`Found ${categories.length} top-level categories`);

    // Step 2: Sync categories to DB
    await syncCategories(categories, stats);
    console.log(`Synced ${stats.categoriesProcessed} categories`);

    // Step 3: Get all leaf category IDs
    const categoryIds = getLeafCategoryIds(categories);
    console.log(`Processing ${categoryIds.length} leaf categories for products...`);

    // Step 4: Fetch and sync products from each category
    for (let i = 0; i < categoryIds.length; i++) {
      const catId = categoryIds[i];
      
      try {
        console.log(`[${i + 1}/${categoryIds.length}] Fetching category ${catId}...`);
        
        const products = await fetchCategoryProducts(catId);
        console.log(`  Found ${products.length} products`);
        
        if (products.length > 0) {
          await syncProducts(products, stats);
        }
        
        // Rate limiting
        await sleep(RATE_LIMIT_MS);
      } catch (error) {
        console.error(`  Error processing category ${catId}:`, error);
        stats.errors.push(`Category ${catId}: ${error}`);
      }
    }

    // Success
    await updateSyncStatus('success', stats);

    console.log('\n' + '='.repeat(60));
    console.log('Sync completed successfully!');
    console.log('='.repeat(60));
    console.log(`Categories: ${stats.categoriesProcessed}`);
    console.log(`Products: ${stats.productsProcessed}`);
    console.log(`Price changes: ${stats.priceChanges}`);
    console.log(`Errors: ${stats.errors.length}`);
    if (stats.errors.length > 0) {
      console.log('Errors:', stats.errors.slice(0, 5));
    }
    console.log('Finished at:', new Date().toISOString());

  } catch (error) {
    console.error('Sync failed:', error);
    await updateSyncStatus('failed', stats, String(error));
    process.exit(1);
  }
}

// Run if called directly
syncMercadona();
