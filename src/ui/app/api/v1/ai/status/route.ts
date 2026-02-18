import { NextResponse } from 'next/server';

export async function GET() {
  const groqConfigured = !!process.env.GROQ_API_KEY;
  
  return NextResponse.json({
    success: true,
    data: {
      enabled: groqConfigured,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      features: {
        mealPlanGeneration: groqConfigured,
        recipeRecommendations: false,
        budgetOptimization: false,
      },
    },
  });
}
