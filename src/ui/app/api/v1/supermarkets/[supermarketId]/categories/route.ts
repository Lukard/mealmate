/**
 * GET /api/v1/supermarkets/[supermarketId]/categories
 * Returns all categories for a supermarket
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SupermarketId,
  SupermarketError,
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

    const adapter = factory.getAdapter(supermarketId as SupermarketId);
    const categories = await adapter.getCategories();

    return NextResponse.json({
      supermarket: supermarketId,
      categories,
      count: categories.length,
    });
  } catch (error) {
    console.error('[API] Error fetching categories:', error);

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
