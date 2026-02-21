/**
 * POST /api/v1/prices/ingredient/batch
 * Get prices for multiple ingredients at once from our cached database
 * 
 * Body:
 * - ingredients: string[] - List of ingredient names to search
 * - supermarket?: string - Preferred supermarket (default: mercadona)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface BatchRequest {
  ingredients: string[];
  supermarket?: string;
}

interface PriceResult {
  ingredient: string;
  hasRealPrice: boolean;
  bestPrice: number | null;
  estimatedPrice: number;
  supermarket?: string;
  productName?: string;
  productId?: string;
  imageUrl?: string;
  confidence?: number;
}

// Create Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/**
 * Search for products matching an ingredient name using full-text search
 */
async function searchProducts(
  supabase: ReturnType<typeof getSupabase>,
  ingredientName: string,
  supermarketId: string
): Promise<{
  product: { id: string; name: string; price: number; image_url: string | null } | null;
  confidence: number;
}> {
  // Normalize ingredient name for search
  const normalized = ingredientName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('supermarket_products')
    .select('external_id, name, price, image_url')
    .eq('supermarket_id', supermarketId)
    .eq('available', true)
    .ilike('name', `%${normalized}%`)
    .order('price', { ascending: true })
    .limit(1);

  if (exactMatch && exactMatch.length > 0) {
    return {
      product: {
        id: exactMatch[0].external_id,
        name: exactMatch[0].name,
        price: exactMatch[0].price,
        image_url: exactMatch[0].image_url,
      },
      confidence: 0.9,
    };
  }

  // Try full-text search
  const { data: ftsMatch } = await supabase
    .from('supermarket_products')
    .select('external_id, name, price, image_url')
    .eq('supermarket_id', supermarketId)
    .eq('available', true)
    .textSearch('name', normalized.split(' ').join(' & '), { type: 'websearch' })
    .order('price', { ascending: true })
    .limit(1);

  if (ftsMatch && ftsMatch.length > 0) {
    return {
      product: {
        id: ftsMatch[0].external_id,
        name: ftsMatch[0].name,
        price: ftsMatch[0].price,
        image_url: ftsMatch[0].image_url,
      },
      confidence: 0.7,
    };
  }

  // Try searching by words
  const words = normalized.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    const { data: wordMatch } = await supabase
      .from('supermarket_products')
      .select('external_id, name, price, image_url')
      .eq('supermarket_id', supermarketId)
      .eq('available', true)
      .ilike('name', `%${words[0]}%`)
      .order('price', { ascending: true })
      .limit(1);

    if (wordMatch && wordMatch.length > 0) {
      return {
        product: {
          id: wordMatch[0].external_id,
          name: wordMatch[0].name,
          price: wordMatch[0].price,
          image_url: wordMatch[0].image_url,
        },
        confidence: 0.5,
      };
    }
  }

  return { product: null, confidence: 0 };
}

/**
 * Simple price estimation based on ingredient category
 */
function estimatePrice(ingredient: string): number {
  const lowercased = ingredient.toLowerCase();
  
  // Proteins tend to be more expensive
  if (/pollo|carne|cerdo|ternera|pescado|salmon|atun|huevo/i.test(lowercased)) {
    return 4.5 + Math.random() * 3;
  }
  
  // Dairy
  if (/leche|queso|yogur|nata|mantequilla/i.test(lowercased)) {
    return 1.5 + Math.random() * 2;
  }
  
  // Produce
  if (/tomate|lechuga|cebolla|zanahoria|patata|pimiento|ajo/i.test(lowercased)) {
    return 1 + Math.random() * 1.5;
  }
  
  // Grains and pasta
  if (/arroz|pasta|pan|harina|cereal/i.test(lowercased)) {
    return 1 + Math.random() * 1.5;
  }
  
  // Default
  return 1.5 + Math.random() * 2;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as BatchRequest;
    
    if (!body.ingredients || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return NextResponse.json(
        { error: 'ingredients array is required' },
        { status: 400 }
      );
    }

    // Limit batch size
    const maxBatchSize = 50;
    if (body.ingredients.length > maxBatchSize) {
      return NextResponse.json(
        { error: `Maximum batch size is ${maxBatchSize} ingredients` },
        { status: 400 }
      );
    }

    const supermarketId = body.supermarket || 'mercadona';
    const supabase = getSupabase();
    
    // Check if we have products in the database
    const { count } = await supabase
      .from('supermarket_products')
      .select('*', { count: 'exact', head: true })
      .eq('supermarket_id', supermarketId);

    const hasProducts = (count ?? 0) > 0;
    
    const results: Record<string, PriceResult> = {};

    for (const ingredient of body.ingredients) {
      const trimmedIngredient = ingredient.trim();
      if (!trimmedIngredient) continue;

      if (hasProducts) {
        // Search in our database
        const { product, confidence } = await searchProducts(
          supabase,
          trimmedIngredient,
          supermarketId
        );

        if (product) {
          results[trimmedIngredient] = {
            ingredient: trimmedIngredient,
            hasRealPrice: true,
            bestPrice: product.price,
            estimatedPrice: product.price,
            supermarket: supermarketId,
            productName: product.name,
            productId: product.id,
            imageUrl: product.image_url || undefined,
            confidence,
          };
        } else {
          results[trimmedIngredient] = {
            ingredient: trimmedIngredient,
            hasRealPrice: false,
            bestPrice: null,
            estimatedPrice: estimatePrice(trimmedIngredient),
          };
        }
      } else {
        // No products in DB - use fallback estimation
        results[trimmedIngredient] = {
          ingredient: trimmedIngredient,
          hasRealPrice: false,
          bestPrice: null,
          estimatedPrice: estimatePrice(trimmedIngredient),
        };
      }
    }

    // Add sync status info
    const { data: syncStatus } = await supabase
      .from('supermarket_sync_status')
      .select('last_sync_completed_at, products_synced')
      .eq('supermarket_id', supermarketId)
      .single();

    return NextResponse.json({
      ...results,
      _meta: {
        supermarket: supermarketId,
        productsInDb: count ?? 0,
        lastSync: syncStatus?.last_sync_completed_at,
        totalProducts: syncStatus?.products_synced,
      },
    });
  } catch (error) {
    console.error('[API] Error in batch price lookup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
