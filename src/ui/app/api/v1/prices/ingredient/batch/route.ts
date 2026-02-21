/**
 * POST /api/v1/prices/ingredient/batch
 * Get prices for multiple ingredients at once
 * 
 * Body:
 * - ingredients: string[] - List of ingredient names to search
 * - supermarket?: string - Preferred supermarket (default: mercadona)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFactory,
  registerAllAdapters,
  SupermarketId,
  SupermarketError,
} from '@/services/supermarkets';
import { getIngredientMapper } from '@/services/supermarkets/mapper';

// Register adapters on module load
registerAllAdapters();

interface BatchRequest {
  ingredients: string[];
  supermarket?: SupermarketId;
}

interface PriceResult {
  ingredient: string;
  hasRealPrice: boolean;
  bestPrice: number | null;
  estimatedPrice: number;
  supermarket?: SupermarketId;
  productName?: string;
  productId?: string;
  confidence?: number;
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

    // Limit batch size to prevent abuse
    const maxBatchSize = 50;
    if (body.ingredients.length > maxBatchSize) {
      return NextResponse.json(
        { error: `Maximum batch size is ${maxBatchSize} ingredients` },
        { status: 400 }
      );
    }

    const supermarketId = body.supermarket || 'mercadona';
    const factory = getFactory();

    // Check if adapter is available
    if (!factory.hasAdapter(supermarketId)) {
      return NextResponse.json(
        { error: `Supermarket ${supermarketId} is not yet implemented` },
        { status: 501 }
      );
    }

    const mapper = getIngredientMapper();
    
    const results: Record<string, PriceResult> = {};

    // Process each ingredient
    for (const ingredient of body.ingredients) {
      const trimmedIngredient = ingredient.trim();
      if (!trimmedIngredient) continue;

      try {
        // Try to map ingredient to products
        const mappingResult = await mapper.mapIngredientToProducts(trimmedIngredient, [supermarketId]);
        
        if (mappingResult.hasRealPrice && mappingResult.bestPrice) {
          const bestProduct = mappingResult.bestPrice.product;
          const bestMatch = mappingResult.matchedProducts[0];
          results[trimmedIngredient] = {
            ingredient: trimmedIngredient,
            hasRealPrice: true,
            bestPrice: bestProduct.price,
            estimatedPrice: mappingResult.estimatedPrice ?? estimatePrice(trimmedIngredient),
            supermarket: mappingResult.bestPrice.supermarket,
            productName: bestProduct.name,
            productId: bestProduct.externalId,
            confidence: bestMatch?.confidence ?? 0.5,
          };
        } else {
          results[trimmedIngredient] = {
            ingredient: trimmedIngredient,
            hasRealPrice: false,
            bestPrice: null,
            estimatedPrice: mappingResult.estimatedPrice ?? estimatePrice(trimmedIngredient),
          };
        }
      } catch (error) {
        // If individual ingredient fails, return estimated price
        console.error(`Error mapping ingredient "${trimmedIngredient}":`, error);
        results[trimmedIngredient] = {
          ingredient: trimmedIngredient,
          hasRealPrice: false,
          bestPrice: null,
          estimatedPrice: estimatePrice(trimmedIngredient),
        };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('[API] Error in batch price lookup:', error);

    if (error instanceof SupermarketError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'RATE_LIMITED' ? 429 : 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Simple price estimation based on ingredient category
 */
function estimatePrice(ingredient: string): number {
  const lowercased = ingredient.toLowerCase();
  
  // Proteins tend to be more expensive
  if (/pollo|carne|cerdo|ternera|pescado|salmon|atun|huevo/i.test(lowercased)) {
    return 3 + Math.random() * 5;
  }
  
  // Dairy
  if (/leche|queso|yogur|nata|mantequilla/i.test(lowercased)) {
    return 1.5 + Math.random() * 3;
  }
  
  // Produce
  if (/tomate|lechuga|cebolla|zanahoria|patata|pimiento|ajo/i.test(lowercased)) {
    return 0.8 + Math.random() * 2;
  }
  
  // Grains and pasta
  if (/arroz|pasta|pan|harina|cereal/i.test(lowercased)) {
    return 1 + Math.random() * 2;
  }
  
  // Default
  return 1.5 + Math.random() * 2.5;
}
