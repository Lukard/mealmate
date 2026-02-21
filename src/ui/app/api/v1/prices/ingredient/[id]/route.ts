/**
 * GET /api/v1/prices/ingredient/[id]
 * Get real supermarket prices for an ingredient
 * 
 * Query params:
 * - supermarkets: Comma-separated list of supermarket IDs (optional, default: all)
 * 
 * The 'id' parameter can be:
 * - An ingredient name (URL encoded)
 * - An ingredient ID from MealMate's database
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SupermarketId,
  getIngredientMapper,
  registerAllAdapters,
} from '@/services/supermarkets';

// Register adapters on module load
registerAllAdapters();

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Decode the ingredient name/ID
    const ingredientName = decodeURIComponent(id);

    if (!ingredientName || ingredientName.trim() === '') {
      return NextResponse.json(
        { error: 'Ingredient ID/name is required' },
        { status: 400 }
      );
    }

    // Parse supermarket filter
    const supermarketsParam = searchParams.get('supermarkets');
    const validIds: SupermarketId[] = ['mercadona', 'carrefour', 'dia', 'alcampo', 'eroski', 'lidl'];
    
    let supermarketIds: SupermarketId[] | undefined;
    if (supermarketsParam) {
      const requestedIds = supermarketsParam.split(',').map(s => s.trim());
      supermarketIds = requestedIds.filter(id => validIds.includes(id as SupermarketId)) as SupermarketId[];
      
      if (supermarketIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid supermarket IDs provided', validIds },
          { status: 400 }
        );
      }
    }

    // Get the mapper and find products
    const mapper = getIngredientMapper();
    const result = await mapper.mapIngredientToProducts(ingredientName, supermarketIds);

    // Format response
    return NextResponse.json({
      ingredient: ingredientName,
      hasRealPrice: result.hasRealPrice,
      bestPrice: result.bestPrice ? {
        price: result.bestPrice.product.price,
        pricePerUnit: result.bestPrice.product.pricePerUnit,
        unit: result.bestPrice.product.unit,
        supermarket: result.bestPrice.supermarket,
        product: {
          id: result.bestPrice.product.id,
          name: result.bestPrice.product.name,
          imageUrl: result.bestPrice.product.thumbnailUrl || result.bestPrice.product.imageUrl,
        },
      } : null,
      estimatedPrice: result.estimatedPrice,
      matches: result.matchedProducts.map(match => ({
        confidence: match.confidence,
        supermarket: match.supermarket,
        product: {
          id: match.product.id,
          externalId: match.product.externalId,
          name: match.product.name,
          price: match.product.price,
          pricePerUnit: match.product.pricePerUnit,
          unit: match.product.unit,
          sizeFormat: match.product.sizeFormat,
          imageUrl: match.product.thumbnailUrl || match.product.imageUrl,
          available: match.product.available,
        },
      })),
      matchCount: result.matchedProducts.length,
    });
  } catch (error) {
    console.error('[API] Error fetching ingredient price:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/prices/ingredient/[id]
 * Batch get prices for multiple ingredients
 * 
 * Body:
 * {
 *   ingredients: string[], // Array of ingredient names
 *   supermarkets?: string[] // Optional filter
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { ingredients, supermarkets } = body as {
      ingredients?: string[];
      supermarkets?: string[];
    };

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'ingredients array is required in body' },
        { status: 400 }
      );
    }

    if (ingredients.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 ingredients per request' },
        { status: 400 }
      );
    }

    // Validate supermarket IDs
    const validIds: SupermarketId[] = ['mercadona', 'carrefour', 'dia', 'alcampo', 'eroski', 'lidl'];
    let supermarketIds: SupermarketId[] | undefined;
    
    if (supermarkets && Array.isArray(supermarkets)) {
      supermarketIds = supermarkets.filter(id => validIds.includes(id as SupermarketId)) as SupermarketId[];
    }

    const mapper = getIngredientMapper();
    const results = await mapper.mapIngredients(ingredients, supermarketIds);

    // Format response
    const response: Record<string, {
      hasRealPrice: boolean;
      bestPrice: number | null;
      estimatedPrice: number;
      matchCount: number;
    }> = {};

    for (const [name, result] of results) {
      response[name] = {
        hasRealPrice: result.hasRealPrice,
        bestPrice: result.bestPrice?.product.price ?? null,
        estimatedPrice: result.estimatedPrice ?? 0,
        matchCount: result.matchedProducts.length,
      };
    }

    return NextResponse.json({
      ingredients: response,
      totalIngredients: ingredients.length,
      withRealPrices: Object.values(response).filter(r => r.hasRealPrice).length,
    });
  } catch (error) {
    console.error('[API] Error fetching batch ingredient prices:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
