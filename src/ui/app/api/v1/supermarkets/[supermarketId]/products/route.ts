/**
 * GET /api/v1/supermarkets/[supermarketId]/products
 * Returns products for a supermarket, optionally filtered by category
 * 
 * Query params:
 * - categoryId: Filter by category
 * - limit: Max results (default: 20)
 * - offset: Pagination offset (default: 0)
 * - minPrice: Min price filter
 * - maxPrice: Max price filter
 * - sortBy: 'price' | 'name' | 'relevance'
 * - sortOrder: 'asc' | 'desc'
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SupermarketId,
  SupermarketError,
  SearchOptions,
  getFactory,
  registerAllAdapters,
} from '@/services/supermarkets';

// Register adapters on module load
registerAllAdapters();

interface RouteParams {
  params: Promise<{
    supermarketId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { supermarketId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Validate supermarket ID
    const validIds: SupermarketId[] = ['mercadona', 'carrefour', 'dia', 'alcampo', 'eroski', 'lidl'];
    if (!validIds.includes(supermarketId as SupermarketId)) {
      return NextResponse.json(
        { error: 'Invalid supermarket ID', validIds },
        { status: 400 }
      );
    }

    const factory = getFactory();

    // Check if adapter is registered
    if (!factory.hasAdapter(supermarketId as SupermarketId)) {
      return NextResponse.json(
        { error: `Supermarket ${supermarketId} is not yet implemented` },
        { status: 501 }
      );
    }

    // Parse query params
    const categoryId = searchParams.get('categoryId');
    const options: SearchOptions = {
      limit: parseInt(searchParams.get('limit') || '20', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
      sortBy: (searchParams.get('sortBy') as SearchOptions['sortBy']) || 'relevance',
      sortOrder: (searchParams.get('sortOrder') as SearchOptions['sortOrder']) || 'asc',
    };

    // Validate category ID is provided
    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId query parameter is required' },
        { status: 400 }
      );
    }

    const adapter = factory.getAdapter(supermarketId as SupermarketId);
    const result = await adapter.getProductsByCategory(categoryId, options);

    return NextResponse.json({
      supermarket: supermarketId,
      categoryId,
      ...result,
    });
  } catch (error) {
    console.error('[API] Error fetching products:', error);

    if (error instanceof SupermarketError) {
      const status = error.code === 'RATE_LIMITED' ? 429 :
                     error.code === 'CATEGORY_NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
