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
  SupermarketId,
  SupermarketError,
} from '@/services/supermarkets';

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

/**
 * Known prices from Mercadona (cached/static)
 * This allows instant responses without API calls
 * TODO: Populate this from a background sync job
 */
const KNOWN_PRICES: Record<string, { price: number; productName: string }> = {
  // Verduras
  'tomate': { price: 2.20, productName: 'Tomate rama' },
  'tomates': { price: 2.20, productName: 'Tomate rama' },
  'cebolla': { price: 1.29, productName: 'Cebolla' },
  'cebollas': { price: 1.29, productName: 'Cebolla' },
  'ajo': { price: 0.99, productName: 'Ajo' },
  'ajos': { price: 0.99, productName: 'Ajo' },
  'patata': { price: 1.49, productName: 'Patata' },
  'patatas': { price: 1.49, productName: 'Patata' },
  'zanahoria': { price: 0.99, productName: 'Zanahoria' },
  'zanahorias': { price: 0.99, productName: 'Zanahoria' },
  'lechuga': { price: 0.89, productName: 'Lechuga romana' },
  'pimiento': { price: 2.49, productName: 'Pimiento rojo' },
  'pimiento rojo': { price: 2.49, productName: 'Pimiento rojo' },
  'pimiento verde': { price: 1.99, productName: 'Pimiento verde' },
  'calabacín': { price: 1.79, productName: 'Calabacín' },
  'berenjena': { price: 1.99, productName: 'Berenjena' },
  'espinacas': { price: 1.89, productName: 'Espinacas frescas' },
  'puerro': { price: 1.79, productName: 'Puerro' },
  'puerros': { price: 1.79, productName: 'Puerro' },
  
  // Frutas
  'manzana': { price: 2.29, productName: 'Manzana Golden' },
  'manzanas': { price: 2.29, productName: 'Manzana Golden' },
  'plátano': { price: 1.85, productName: 'Plátano de Canarias' },
  'plátanos': { price: 1.85, productName: 'Plátano de Canarias' },
  'naranja': { price: 1.99, productName: 'Naranja de zumo' },
  'naranjas': { price: 1.99, productName: 'Naranja de zumo' },
  'limón': { price: 1.59, productName: 'Limón' },
  'limones': { price: 1.59, productName: 'Limón' },
  
  // Carnes
  'pollo': { price: 5.99, productName: 'Pechuga de pollo' },
  'pechuga de pollo': { price: 5.99, productName: 'Pechuga de pollo' },
  'muslos de pollo': { price: 3.99, productName: 'Muslos de pollo' },
  'ternera': { price: 8.99, productName: 'Filete de ternera' },
  'carne picada': { price: 4.99, productName: 'Carne picada mixta' },
  'cerdo': { price: 5.49, productName: 'Lomo de cerdo' },
  'lomo de cerdo': { price: 5.49, productName: 'Lomo de cerdo' },
  'bacon': { price: 2.49, productName: 'Bacon ahumado' },
  'jamón': { price: 3.99, productName: 'Jamón serrano' },
  'jamón serrano': { price: 3.99, productName: 'Jamón serrano' },
  'chorizo': { price: 2.79, productName: 'Chorizo' },
  
  // Pescados
  'salmón': { price: 9.99, productName: 'Salmón fresco' },
  'atún': { price: 1.89, productName: 'Atún claro en aceite' },
  'merluza': { price: 7.99, productName: 'Merluza' },
  'gambas': { price: 8.99, productName: 'Gambas peladas' },
  'langostinos': { price: 9.99, productName: 'Langostinos' },
  
  // Lácteos
  'leche': { price: 0.99, productName: 'Leche entera Hacendado' },
  'huevos': { price: 2.45, productName: 'Huevos L (12 uds)' },
  'huevo': { price: 2.45, productName: 'Huevos L (12 uds)' },
  'mantequilla': { price: 2.29, productName: 'Mantequilla' },
  'yogur': { price: 1.20, productName: 'Yogur natural' },
  'queso': { price: 2.99, productName: 'Queso rallado' },
  'queso rallado': { price: 2.99, productName: 'Queso rallado' },
  'nata': { price: 1.25, productName: 'Nata para cocinar' },
  'mozzarella': { price: 1.89, productName: 'Mozzarella' },
  
  // Básicos
  'arroz': { price: 1.29, productName: 'Arroz redondo Hacendado' },
  'arroz bomba': { price: 2.49, productName: 'Arroz bomba' },
  'pasta': { price: 0.89, productName: 'Espaguetis Hacendado' },
  'espaguetis': { price: 0.89, productName: 'Espaguetis Hacendado' },
  'macarrones': { price: 0.85, productName: 'Macarrones Hacendado' },
  'pan': { price: 1.20, productName: 'Pan de molde' },
  'pan de molde': { price: 1.20, productName: 'Pan de molde' },
  'harina': { price: 0.75, productName: 'Harina de trigo' },
  'aceite': { price: 6.99, productName: 'Aceite de oliva virgen extra' },
  'aceite de oliva': { price: 6.99, productName: 'Aceite de oliva virgen extra' },
  'aceite de oliva virgen extra': { price: 6.99, productName: 'Aceite de oliva virgen extra' },
  'sal': { price: 0.35, productName: 'Sal fina' },
  'azúcar': { price: 1.15, productName: 'Azúcar blanco' },
  'pimienta': { price: 1.49, productName: 'Pimienta negra molida' },
  
  // Legumbres
  'lentejas': { price: 1.39, productName: 'Lentejas pardinas' },
  'garbanzos': { price: 1.19, productName: 'Garbanzos cocidos' },
  'alubias': { price: 1.29, productName: 'Alubias blancas' },
  
  // Conservas
  'tomate triturado': { price: 0.99, productName: 'Tomate triturado Hacendado' },
  'tomate frito': { price: 1.15, productName: 'Tomate frito Hacendado' },
  'caldo de pollo': { price: 1.29, productName: 'Caldo de pollo' },
  'caldo de verduras': { price: 1.19, productName: 'Caldo de verduras' },
};

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

    const results: Record<string, PriceResult> = {};

    // For now, return estimated prices immediately
    // Real Mercadona API integration requires background processing
    // due to rate limiting (1 req/sec) and Vercel's 10s timeout
    for (const ingredient of body.ingredients) {
      const trimmedIngredient = ingredient.trim();
      if (!trimmedIngredient) continue;

      // Check if we have a cached/known price for this ingredient
      const knownPrice = KNOWN_PRICES[trimmedIngredient.toLowerCase()];
      
      if (knownPrice) {
        results[trimmedIngredient] = {
          ingredient: trimmedIngredient,
          hasRealPrice: true,
          bestPrice: knownPrice.price,
          estimatedPrice: knownPrice.price,
          supermarket: 'mercadona',
          productName: knownPrice.productName,
          confidence: 0.9,
        };
      } else {
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
