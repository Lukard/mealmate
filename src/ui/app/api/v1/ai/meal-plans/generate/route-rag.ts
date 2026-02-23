/**
 * Meal Plan Generation API - RAG-Enhanced Version
 * 
 * Generates meal plans with real product matching from supermarket data.
 * Uses semantic search to find actual products for ingredients.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchIngredientsBatch,
  generateShoppingList,
  type ShoppingList,
} from '@/lib/rag';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ============================================
// Types
// ============================================

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
  /** Enable RAG-based product matching */
  enableProductMatching?: boolean;
  /** Preferred supermarket for product matching */
  supermarket?: string;
}

interface MealData {
  name: string;
  prepTime: number;
  description: string;
  ingredients?: string[];
  instructions?: string[];
}

interface DayPlan {
  date: string;
  meals: Record<string, MealData>;
}

interface AIMealPlan {
  mealPlan: {
    explanation: string;
    days: DayPlan[];
  };
  shoppingTips: string[];
  estimatedWeeklyCost: number;
}

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas.

Tu tarea es crear un plan de comidas semanal personalizado. Debes responder SOLO con JSON válido.

Reglas IMPORTANTES:
1. Genera recetas DIFERENTES cada día - NO repitas platos en la semana
2. SOLO incluye las comidas que el usuario solicite (no añadas extras)
3. Alterna entre carne, pescado, legumbres, huevos y verduras
4. Usa ingredientes de temporada y recetas españolas variadas
5. Respeta el tiempo de preparación máximo indicado
6. Cada plato debe tener un nombre único y específico
7. RESPETA ESTRICTAMENTE los objetivos de salud del usuario - adapta todas las recetas para cumplirlos
8. Ten en cuenta las observaciones adicionales del usuario sobre su salud o preferencias nutricionales
9. Los ingredientes DEBEN ser específicos y comprables (ej: "pechuga de pollo" NO "pollo")

Formato de respuesta (JSON estricto):
{
  "mealPlan": {
    "explanation": "Breve explicación del plan (2-3 frases en español)",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "meals": {
          "breakfast": { 
            "name": "Nombre único del plato", 
            "prepTime": 15, 
            "description": "Descripción breve",
            "ingredients": ["pechuga de pollo 200g", "arroz basmati 100g", "tomate 2 unidades"],
            "instructions": ["Paso 1", "Paso 2", "Paso 3"]
          }
        }
      }
    ]
  },
  "shoppingTips": ["consejo1", "consejo2"],
  "estimatedWeeklyCost": 80
}

IMPORTANTE: 
- Solo incluye en "meals" las comidas solicitadas por el usuario
- Cada receta DEBE tener ingredients (lista de ingredientes con cantidades específicas)
- Los ingredientes deben ser productos reales de supermercado
- Las cantidades deben ser específicas (ej: "200g de pechuga de pollo", "2 tomates")`;

// ============================================
// Main Handler
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

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build list of meals to include
    const mealsToInclude: string[] = [];
    if (preferences?.includeBreakfast) mealsToInclude.push('desayuno (breakfast)');
    if (preferences?.includeLunch !== false) mealsToInclude.push('almuerzo (lunch)');
    if (preferences?.includeDinner !== false) mealsToInclude.push('cena (dinner)');
    if (preferences?.includeSnacks) mealsToInclude.push('merienda (snack)');
    
    const mealsText = mealsToInclude.length > 0 ? mealsToInclude.join(', ') : 'almuerzo y cena';

    // Build health goals text
    const healthGoals = body.health?.goals || [];
    const healthGoalsText = healthGoals.length > 0
      ? healthGoals.map((g: HealthGoal) => goalLabels[g]).join(', ')
      : 'Sin objetivos específicos';
    const additionalNotes = body.health?.additionalNotes || 'Ninguna';

    const userPrompt = `Genera un plan de comidas para ${days} días, del ${startDate} al ${endDate}.

Preferencias del usuario:
- Comidas a incluir: ${mealsText}
- IMPORTANTE: SOLO genera las comidas especificadas arriba, NO añadas otras
- Nivel de variedad: ${preferences?.variety || 'high'} (usa recetas diferentes cada día)
- Tiempo máximo de preparación por plato: ${preferences?.maxPrepTime || 45} minutos
${preferences?.budgetLimit ? `- Presupuesto semanal aproximado: ${preferences.budgetLimit}€` : ''}

OBJETIVOS DE SALUD:
- ${healthGoalsText}

OBSERVACIONES ADICIONALES DEL USUARIO:
${additionalNotes}

Requisitos:
1. Genera recetas DIFERENTES para cada día (no repitas platos)
2. Solo incluye las comidas especificadas (${mealsText})
3. Varía los ingredientes principales entre días
4. Usa nombres de platos en español
5. ADAPTA todas las recetas para cumplir con los objetivos de salud indicados
6. Los ingredientes deben ser productos reales de supermercado con cantidades específicas

Por favor genera el plan en formato JSON siguiendo exactamente el schema indicado.`;

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
          { role: 'system', content: SYSTEM_PROMPT },
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
    const aiPlan: AIMealPlan = JSON.parse(content);

    // Extract all ingredients from the meal plan
    const allIngredients: string[] = [];
    for (const day of aiPlan.mealPlan.days) {
      for (const meal of Object.values(day.meals)) {
        if (meal?.ingredients) {
          allIngredients.push(...meal.ingredients);
        }
      }
    }

    // ============================================
    // RAG: Product Matching
    // ============================================
    
    let shoppingListData: ShoppingList | null = null;
    let productMatchingStats = {
      enabled: false,
      ingredientsMatched: 0,
      ingredientsTotal: 0,
      matchRate: 0,
    };

    if (body.enableProductMatching !== false && allIngredients.length > 0) {
      try {
        shoppingListData = await generateShoppingList(allIngredients, {
          supermarket: body.supermarket || 'mercadona',
          threshold: 0.5,
          limit: 3,
        });

        productMatchingStats = {
          enabled: true,
          ingredientsMatched: shoppingListData.matchedCount,
          ingredientsTotal: shoppingListData.items.length,
          matchRate: Math.round(
            (shoppingListData.matchedCount / shoppingListData.items.length) * 100
          ),
        };

        console.log(
          `[RAG] Product matching: ${shoppingListData.matchedCount}/${shoppingListData.items.length} ` +
          `(${productMatchingStats.matchRate}%)`
        );
      } catch (ragError) {
        console.error('[RAG] Product matching failed:', ragError);
        // Continue without RAG - graceful degradation
      }
    }

    // Transform days to entries format expected by frontend
    const entries = aiPlan.mealPlan.days.flatMap((day) => {
      const dayEntries = [];
      for (const [mealType, meal] of Object.entries(day.meals)) {
        if (meal) {
          // Find matched products for this meal's ingredients
          const mealProducts = meal.ingredients?.map(ingredient => {
            const match = shoppingListData?.items.find(
              item => item.ingredientName === ingredient || 
                     ingredient.toLowerCase().includes(item.ingredientName)
            );
            return {
              ingredient,
              product: match?.product || null,
              estimatedPrice: match?.estimatedPrice || null,
            };
          }) || [];

          dayEntries.push({
            id: crypto.randomUUID(),
            date: day.date,
            mealType,
            recipeName: meal.name,
            prepTime: meal.prepTime,
            description: meal.description,
            ingredients: meal.ingredients || [],
            instructions: meal.instructions || [],
            // RAG-enhanced fields
            matchedProducts: mealProducts,
          });
        }
      }
      return dayEntries;
    });

    // Build response
    const response = {
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
          estimatedCost: shoppingListData?.totalEstimatedCost ?? aiPlan.estimatedWeeklyCost ?? 80,
          shoppingTips: aiPlan.shoppingTips || [],
        },
        // Shopping list with matched products
        shoppingList: shoppingListData ? {
          items: shoppingListData.items.map(item => ({
            ingredient: item.ingredientName,
            product: item.product ? {
              id: item.product.id,
              name: item.product.name,
              brand: item.product.brand,
              price: item.product.price,
              pricePerUnit: item.product.price_per_unit,
              unit: item.product.unit,
              sizeFormat: item.product.size_format,
              imageUrl: item.product.image_url,
              similarity: item.product.similarity,
            } : null,
            estimatedPrice: item.estimatedPrice,
            hasMatch: item.hasMatch,
            alternatives: item.alternatives.slice(0, 2).map(alt => ({
              id: alt.id,
              name: alt.name,
              brand: alt.brand,
              price: alt.price,
              similarity: alt.similarity,
            })),
          })),
          totalEstimatedCost: shoppingListData.totalEstimatedCost,
          matchedCount: shoppingListData.matchedCount,
          unmatchedCount: shoppingListData.unmatchedCount,
        } : null,
        generationMetadata: {
          modelUsed: GROQ_MODEL,
          tokensUsed: groqData.usage?.total_tokens || 0,
          latencyMs: Date.now(),
          productMatching: productMatchingStats,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Meal plan generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate meal plan' },
      { status: 500 }
    );
  }
}
