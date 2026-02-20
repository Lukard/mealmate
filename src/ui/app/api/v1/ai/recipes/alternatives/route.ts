import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface AlternativesRequest {
  currentRecipe: {
    name: string;
    mealType: MealType;
  };
  userPreferences: {
    dietary: string[];
    healthGoals: string[];
    cuisines: string[];
    maxPrepTime: number;
    avoidIngredients: string[];
  };
  count?: number;
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'desayuno',
  lunch: 'almuerzo',
  dinner: 'cena',
  snack: 'merienda/snack',
};

const SYSTEM_PROMPT = `Eres un nutricionista y chef experto especializado en recetas saludables y personalizadas.

Tu tarea es generar alternativas a una receta específica que el usuario quiere cambiar. Debes responder SOLO con JSON válido.

Reglas IMPORTANTES:
1. Genera recetas DIFERENTES a la actual pero del mismo tipo de comida
2. Respeta ESTRICTAMENTE las restricciones dietéticas del usuario
3. Adapta las recetas a los objetivos de salud indicados
4. No uses ingredientes que el usuario quiere evitar
5. Respeta el tiempo máximo de preparación
6. Usa ingredientes accesibles y de temporada
7. Cada alternativa debe tener una razón clara de por qué es recomendada

Formato de respuesta (JSON estricto):
{
  "alternatives": [
    {
      "id": "uuid-único",
      "name": "Nombre del plato en español",
      "description": "Descripción breve y apetitosa (1-2 frases)",
      "prepTimeMinutes": 25,
      "servings": 2,
      "ingredients": ["ingrediente 1 con cantidad", "ingrediente 2 con cantidad"],
      "instructions": ["Paso 1 detallado", "Paso 2 detallado", "Paso 3 detallado"],
      "whyRecommended": "Razón breve de por qué es buena alternativa (ej: 'Más rápido y alto en proteínas')"
    }
  ],
  "aiExplanation": "Explicación general de por qué estas alternativas son buenas opciones (2-3 frases)"
}`;

export async function POST(request: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'AI service not configured' } },
      { status: 503 }
    );
  }

  try {
    const body: AlternativesRequest = await request.json();
    const { currentRecipe, userPreferences, count = 4 } = body;

    // Validate request
    if (!currentRecipe?.name || !currentRecipe?.mealType) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Missing currentRecipe name or mealType' } },
        { status: 400 }
      );
    }

    const mealTypeLabel = mealTypeLabels[currentRecipe.mealType] || currentRecipe.mealType;
    
    // Build preferences text
    const dietaryText = userPreferences.dietary?.length > 0 
      ? userPreferences.dietary.join(', ') 
      : 'Sin restricciones específicas';
    
    const healthGoalsText = userPreferences.healthGoals?.length > 0 
      ? userPreferences.healthGoals.join(', ') 
      : 'Dieta equilibrada general';
    
    const cuisinesText = userPreferences.cuisines?.length > 0 
      ? userPreferences.cuisines.join(', ') 
      : 'Variada (preferencia por cocina española/mediterránea)';
    
    const avoidText = userPreferences.avoidIngredients?.length > 0 
      ? userPreferences.avoidIngredients.join(', ') 
      : 'Ninguno';

    const userPrompt = `El usuario quiere cambiar esta receta de su plan de comidas:
- Receta actual: "${currentRecipe.name}"
- Tipo de comida: ${mealTypeLabel}

Genera ${count} alternativas que:
1. Sean del mismo tipo de comida (${mealTypeLabel})
2. Sean DIFERENTES a "${currentRecipe.name}"
3. Respeten estas restricciones dietéticas: ${dietaryText}
4. Alineen con estos objetivos de salud: ${healthGoalsText}
5. Prefieran estas cocinas/estilos: ${cuisinesText}
6. No superen ${userPreferences.maxPrepTime || 45} minutos de preparación
7. EVITEN estos ingredientes: ${avoidText}

Para cada alternativa, explica brevemente por qué es una buena opción para este usuario.

Genera exactamente ${count} alternativas variadas entre sí, con diferentes ingredientes principales.`;

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
        temperature: 0.8,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqResponse.ok) {
      const error = await groqResponse.json();
      console.error('Groq API error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'AI_ERROR', message: 'AI generation failed' } },
        { status: 500 }
      );
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_RESPONSE', message: 'Empty response from AI' } },
        { status: 500 }
      );
    }

    // Parse AI response
    const aiResponse = JSON.parse(content);

    // Ensure each alternative has a unique ID
    const alternatives = (aiResponse.alternatives || []).map((alt: {
      id?: string;
      name: string;
      description: string;
      prepTimeMinutes: number;
      servings: number;
      ingredients: string[];
      instructions: string[];
      whyRecommended: string;
    }) => ({
      ...alt,
      id: alt.id || crypto.randomUUID(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        alternatives,
        aiExplanation: aiResponse.aiExplanation || 'Estas alternativas han sido seleccionadas según tus preferencias.',
      },
      metadata: {
        modelUsed: GROQ_MODEL,
        tokensUsed: groqData.usage?.total_tokens || 0,
      },
    });
  } catch (error) {
    console.error('Recipe alternatives generation error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate alternatives' } },
      { status: 500 }
    );
  }
}
