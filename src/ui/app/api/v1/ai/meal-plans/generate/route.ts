import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface MealPlanRequest {
  startDate: string;
  endDate: string;
  preferences?: {
    includeLunch?: boolean;
    includeDinner?: boolean;
    variety?: 'low' | 'medium' | 'high';
    maxPrepTime?: number;
  };
}

const SYSTEM_PROMPT = `Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas.

Tu tarea es crear un plan de comidas semanal personalizado. Debes responder SOLO con JSON válido.

Reglas IMPORTANTES:
1. Genera recetas DIFERENTES cada día - NO repitas platos en la semana
2. SOLO incluye las comidas que el usuario solicite (no añadas extras)
3. Alterna entre carne, pescado, legumbres, huevos y verduras
4. Usa ingredientes de temporada y recetas españolas variadas
5. Respeta el tiempo de preparación máximo indicado
6. Cada plato debe tener un nombre único y específico

Formato de respuesta (JSON estricto):
{
  "mealPlan": {
    "explanation": "Breve explicación del plan (2-3 frases en español)",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "meals": {
          "breakfast": { "name": "Nombre único del plato", "prepTime": 15, "description": "Descripción" },
          "lunch": { "name": "Nombre único del plato", "prepTime": 30, "description": "Descripción" },
          "dinner": { "name": "Nombre único del plato", "prepTime": 25, "description": "Descripción" },
          "snack": { "name": "Nombre único del plato", "prepTime": 10, "description": "Descripción" }
        }
      }
    ]
  },
  "shoppingTips": ["consejo1", "consejo2"],
  "estimatedWeeklyCost": 80
}

IMPORTANTE: Solo incluye en "meals" las comidas solicitadas por el usuario. Si solo pide almuerzo y cena, NO incluyas breakfast ni snack.`;

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

    const userPrompt = `Genera un plan de comidas para ${days} días, del ${startDate} al ${endDate}.

Preferencias del usuario:
- Comidas a incluir: ${mealsText}
- IMPORTANTE: SOLO genera las comidas especificadas arriba, NO añadas otras
- Nivel de variedad: ${preferences?.variety || 'high'} (usa recetas diferentes cada día)
- Tiempo máximo de preparación por plato: ${preferences?.maxPrepTime || 45} minutos
${preferences?.budgetLimit ? `- Presupuesto semanal aproximado: ${preferences.budgetLimit}€` : ''}

Requisitos:
1. Genera recetas DIFERENTES para cada día (no repitas platos)
2. Solo incluye las comidas especificadas (${mealsText})
3. Varía los ingredientes principales entre días
4. Usa nombres de platos en español

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
    const aiPlan = JSON.parse(content);

    // Transform days to entries format expected by frontend
    const entries = aiPlan.mealPlan.days.flatMap((day: { date: string; meals: Record<string, { name: string; prepTime: number; description: string }> }) => {
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
