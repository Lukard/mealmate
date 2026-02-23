import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type HealthGoal =
  | 'weight-loss'
  | 'high-protein'
  | 'low-sugar'
  | 'high-fiber'
  | 'heart-healthy'
  | 'low-carb'
  | 'whole-foods'
  | 'balanced';

const goalLabels: Record<HealthGoal, string> = {
  'weight-loss': 'Pérdida de peso (calorías controladas)',
  'high-protein': 'Alto en proteína',
  'low-sugar': 'Bajo en azúcar',
  'high-fiber': 'Alto en fibra',
  'heart-healthy': 'Salud cardiovascular (bajo en grasas saturadas y sodio)',
  'low-carb': 'Bajo en carbohidratos',
  'whole-foods': 'Preferir alimentos naturales, evitar ultraprocesados',
  'balanced': 'Dieta equilibrada general',
};

interface MealPlanRequest {
  startDate: string;
  endDate: string;
  preferences?: {
    includeBreakfast?: boolean;
    includeLunch?: boolean;
    includeDinner?: boolean;
    includeSnacks?: boolean;
    variety?: 'low' | 'medium' | 'high';
    maxPrepTime?: number;
    budgetLimit?: number;
  };
  context?: {
    cuisineFocus?: string[];
  };
  health?: {
    goals: HealthGoal[];
    additionalNotes: string;
  };
}

// ============================================
// Query Expansion - expand meal plan request into product search queries
// ============================================

function expandQueries(meals: string[], healthGoals: string[], days: number): string[] {
  const baseCategories = [
    'pollo', 'ternera', 'cerdo', 'pescado', 'merluza', 'salmón',
    'huevos', 'leche', 'yogur', 'queso',
    'arroz', 'pasta', 'pan', 'legumbres', 'lentejas', 'garbanzos',
    'tomate', 'cebolla', 'pimiento', 'zanahoria', 'patata', 'lechuga',
    'aceite oliva', 'sal', 'especias',
    'fruta', 'manzana', 'plátano', 'naranja',
  ];

  const goalExpansions: Record<string, string[]> = {
    'weight-loss': ['pechuga pollo', 'verduras', 'ensalada', 'pescado blanco'],
    'high-protein': ['pechuga pollo', 'atún', 'huevos', 'ternera', 'proteína'],
    'low-sugar': ['sin azúcar', 'integral', 'natural'],
    'high-fiber': ['integral', 'legumbres', 'avena', 'verduras'],
    'low-carb': ['proteína', 'verduras', 'pescado', 'carne'],
    'whole-foods': ['natural', 'fresco', 'verduras', 'fruta'],
  };

  const queries = [...baseCategories];
  for (const goal of healthGoals) {
    const expansion = goalExpansions[goal];
    if (expansion) queries.push(...expansion);
  }

  if (meals.includes('breakfast')) {
    queries.push('cereales', 'tostadas', 'café', 'zumo', 'galletas', 'mantequilla');
  }
  if (meals.includes('snack')) {
    queries.push('frutos secos', 'yogur', 'fruta', 'barrita');
  }

  return [...new Set(queries)];
}

// ============================================
// FTS Product Search (no embeddings needed at request time)
// ============================================

interface ProductForContext {
  id: string;
  name: string;
  price: number;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  size_format: string | null;
  available: boolean;
}

async function searchProductsFTS(queries: string[]): Promise<ProductForContext[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const allProducts = new Map<string, ProductForContext>();

  // Run FTS for each query
  for (const query of queries) {
    const { data, error } = await supabase
      .from('supermarket_products')
      .select('id, name, price, category, subcategory, brand, size_format, available')
      .textSearch('search_vector', query, { config: 'spanish' })
      .eq('available', true)
      .limit(5);

    if (data && !error) {
      for (const p of data) {
        if (!allProducts.has(p.id)) {
          allProducts.set(p.id, p);
        }
      }
    }
  }

  return Array.from(allProducts.values());
}

// ============================================
// Diversify products across categories
// ============================================

function diversifyProducts(products: ProductForContext[], maxPerCategory: number = 8, totalMax: number = 80): ProductForContext[] {
  const byCategory = new Map<string, ProductForContext[]>();
  
  // Filter out non-food categories
  const excludeCategories = new Set([
    'Limpieza y hogar', 'Higiene y belleza', 'Bebé', 'Mascotas',
    'Maquillaje', 'Perfumería', 'Cuidado facial', 'Cuidado del cabello',
  ]);

  for (const p of products) {
    const cat = p.category || 'Otros';
    if (excludeCategories.has(cat)) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }

  const result: ProductForContext[] = [];
  for (const [, prods] of byCategory) {
    result.push(...prods.slice(0, maxPerCategory));
  }

  return result.slice(0, totalMax);
}

// ============================================
// Build product context string (~1K tokens)
// ============================================

function buildProductContext(products: ProductForContext[]): string {
  const byCategory = new Map<string, ProductForContext[]>();
  for (const p of products) {
    const cat = p.category || 'Otros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }

  const lines: string[] = ['PRODUCTOS DISPONIBLES (Mercadona):'];
  for (const [cat, prods] of byCategory) {
    lines.push(`\n[${cat}]`);
    for (const p of prods) {
      const size = p.size_format ? ` (${p.size_format})` : '';
      lines.push(`- ${p.name}${size}: ${p.price.toFixed(2)}€`);
    }
  }
  return lines.join('\n');
}

// ============================================
// RAG System Prompt
// ============================================

const RAG_SYSTEM_PROMPT = `Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas.

REGLAS CRÍTICAS:
1. USA PREFERENTEMENTE los productos de la lista "PRODUCTOS DISPONIBLES" proporcionada
2. Los ingredientes de cada receta DEBEN corresponder a productos reales de la lista cuando sea posible
3. Para ingredientes básicos (sal, agua, aceite, especias comunes) puedes asumir que están disponibles
4. Genera recetas DIFERENTES cada día - NO repitas platos
5. SOLO incluye las comidas que el usuario solicite
6. Alterna entre carne, pescado, legumbres, huevos y verduras
7. Respeta el tiempo de preparación máximo
8. RESPETA los objetivos de salud del usuario

Formato de respuesta (JSON estricto):
{
  "mealPlan": {
    "explanation": "Breve explicación del plan (2-3 frases)",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "meals": {
          "breakfast": { 
            "name": "Nombre del plato",
            "prepTime": 15,
            "description": "Descripción breve",
            "ingredients": ["ingrediente con cantidad"],
            "instructions": ["Paso 1", "Paso 2"]
          },
          "lunch": { ... },
          "dinner": { ... },
          "snack": { ... }
        }
      }
    ]
  },
  "shoppingTips": ["consejo1"],
  "estimatedWeeklyCost": 80
}

IMPORTANTE: Responde SOLO con JSON válido. Cada receta DEBE tener ingredients e instructions.`;

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI service not configured' },
      { status: 503 }
    );
  }

  try {
    const body: MealPlanRequest = await request.json();
    const { startDate, endDate, preferences } = body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build meals list
    const mealsToInclude: string[] = [];
    const mealKeys: string[] = [];
    if (preferences?.includeBreakfast) { mealsToInclude.push('desayuno (breakfast)'); mealKeys.push('breakfast'); }
    if (preferences?.includeLunch !== false) { mealsToInclude.push('almuerzo (lunch)'); mealKeys.push('lunch'); }
    if (preferences?.includeDinner !== false) { mealsToInclude.push('cena (dinner)'); mealKeys.push('dinner'); }
    if (preferences?.includeSnacks) { mealsToInclude.push('merienda (snack)'); mealKeys.push('snack'); }
    
    const mealsText = mealsToInclude.length > 0 ? mealsToInclude.join(', ') : 'almuerzo y cena';

    // Health goals
    const healthGoals = body.health?.goals || [];
    const healthGoalsText = healthGoals.length > 0
      ? healthGoals.map((g: HealthGoal) => goalLabels[g]).join(', ')
      : 'Sin objetivos específicos';
    const additionalNotes = body.health?.additionalNotes || 'Ninguna';

    // === RAG: Search for relevant products ===
    let productContext = '';
    let productCount = 0;
    
    try {
      const queries = expandQueries(mealKeys, healthGoals, days);
      const rawProducts = await searchProductsFTS(queries);
      const products = diversifyProducts(rawProducts);
      productContext = buildProductContext(products);
      productCount = products.length;
      console.log(`RAG: Found ${productCount} products for context`);
    } catch (ragError) {
      console.error('RAG search failed, proceeding without products:', ragError);
    }

    // Build user prompt with product context
    const userPrompt = `${productContext ? productContext + '\n\n---\n' : ''}Genera un plan de comidas para ${days} días, del ${startDate} al ${endDate}.

Preferencias del usuario:
- Comidas a incluir: ${mealsText}
- IMPORTANTE: SOLO genera las comidas especificadas arriba
- Nivel de variedad: ${preferences?.variety || 'high'}
- Tiempo máximo de preparación por plato: ${preferences?.maxPrepTime || 45} minutos
${preferences?.budgetLimit ? `- Presupuesto semanal aproximado: ${preferences.budgetLimit}€` : ''}

OBJETIVOS DE SALUD:
- ${healthGoalsText}

OBSERVACIONES ADICIONALES:
${additionalNotes}

${productContext ? 'Usa PREFERENTEMENTE los productos de la lista proporcionada arriba.' : ''}
Genera el plan en formato JSON siguiendo exactamente el schema indicado.`;

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: RAG_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqResponse.ok) {
      const error = await groqResponse.json();
      console.error('Groq API error:', error);
      return NextResponse.json(
        { success: false, error: 'AI generation failed' },
        { status: 500 }
      );
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    // Parse AI response
    const aiPlan = JSON.parse(content);

    // Transform to frontend format
    interface MealData {
      name: string;
      prepTime: number;
      description: string;
      ingredients?: string[];
      instructions?: string[];
    }
    
    const entries = aiPlan.mealPlan.days.flatMap((day: { date: string; meals: Record<string, MealData> }) => {
      const dayEntries = [];
      for (const [mealType, meal] of Object.entries(day.meals)) {
        if (meal) {
          dayEntries.push({
            id: crypto.randomUUID(),
            date: day.date,
            mealType,
            recipeName: meal.name,
            prepTime: meal.prepTime,
            description: meal.description,
            ingredients: meal.ingredients || [],
            instructions: meal.instructions || [],
          });
        }
      }
      return dayEntries;
    });

    return NextResponse.json({
      success: true,
      data: {
        mealPlan: {
          id: crypto.randomUUID(),
          name: `Plan ${startDate} - ${endDate}`,
          startDate,
          endDate,
          status: 'draft',
          aiExplanation: aiPlan.mealPlan.explanation,
          entries,
        },
        summary: {
          totalMeals: entries.length,
          estimatedCost: aiPlan.estimatedWeeklyCost || 80,
          shoppingTips: aiPlan.shoppingTips || [],
        },
        generationMetadata: {
          modelUsed: GROQ_MODEL,
          tokensUsed: groqData.usage?.total_tokens || 0,
          latencyMs: Date.now(),
          ragProductCount: productCount,
        },
      },
    });
  } catch (error) {
    console.error('Meal plan generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate meal plan' },
      { status: 500 }
    );
  }
}
