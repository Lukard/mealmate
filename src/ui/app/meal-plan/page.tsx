'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import { WeeklyCalendar, RecipeModal } from '@/components/meal-plan';
import { useStore, type MealItem, type MealType } from '@/lib/store';
import { aiApi, getWeekDateRange, type GeneratedMealPlan, AIApiError } from '@/lib/api/ai';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// AI Generation Modal Component
function AIGenerationModal({
  isOpen,
  onClose,
  isLoading,
  error,
  result,
  onAccept,
  onRegenerate,
}: {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  result: GeneratedMealPlan | null;
  onAccept: () => void;
  onRegenerate: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={!isLoading ? onClose : undefined} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Generación con IA</h2>
            </div>
            {!isLoading && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Content */}
          <div className="space-y-4">
            {isLoading && (
              <div className="text-center py-8">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">Generando tu plan personalizado...</p>
                <p className="text-sm text-gray-400 mt-2">La IA está analizando tus preferencias</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-red-800">Error al generar</h3>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button variant="secondary" size="sm" onClick={onRegenerate}>
                    Reintentar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}

            {result && !isLoading && !error && (
              <>
                {/* AI Explanation */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Explicación de la IA</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.aiExplanation}</p>
                    </div>
                  </div>
                </div>

                {/* Plan Summary */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Resumen del plan</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Período:</span>
                      <p className="font-medium">{result.startDate} - {result.endDate}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Comidas:</span>
                      <p className="font-medium">{result.entries.length} recetas</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button onClick={onAccept} fullWidth>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Aceptar plan
                  </Button>
                  <Button variant="secondary" onClick={onRegenerate}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MealPlanPage() {
  const router = useRouter();
  const { currentMealPlan, isQuestionnaireComplete, groceryList, setMealPlan } = useStore();
  const [selectedMeal, setSelectedMeal] = useState<{
    meal: MealItem;
    mealType: MealType;
    day: DayOfWeek;
  } | null>(null);

  // AI Generation state
  const [showAIModal, setShowAIModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedMealPlan | null>(null);

  // Redirect to onboarding if not complete
  useEffect(() => {
    if (!isQuestionnaireComplete) {
      router.push('/onboarding');
    }
  }, [isQuestionnaireComplete, router]);

  // AI Generation handlers
  const handleGenerateWithAI = async () => {
    setShowAIModal(true);
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedPlan(null);

    try {
      // Get next week's date range
      const { startDate, endDate } = getWeekDateRange(0);
      
      const response = await aiApi.generateMealPlan({
        startDate,
        endDate,
        preferences: {
          includeBreakfast: true,
          includeLunch: true,
          includeDinner: true,
          includeSnacks: false,
          variety: 'medium',
        },
      });

      if (response.success && response.data) {
        setGeneratedPlan(response.data.mealPlan);
      } else {
        throw new Error('No se pudo generar el plan');
      }
    } catch (error) {
      if (error instanceof AIApiError) {
        setGenerationError(error.message);
      } else if (error instanceof Error) {
        setGenerationError(error.message);
      } else {
        setGenerationError('Error desconocido al generar el plan');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptPlan = () => {
    if (generatedPlan) {
      // Transform AI plan to store format
      const dayNames: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      // Create empty days structure
      const days: Record<DayOfWeek, { breakfast?: MealItem; lunch?: MealItem; dinner?: MealItem; snack?: MealItem }> = {
        monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}, sunday: {}
      };
      
      // Map entries to days
      generatedPlan.entries.forEach((entry) => {
        const entryDate = new Date(entry.date);
        const dayIndex = (entryDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
        const dayName = dayNames[dayIndex];
        
        const mealItem: MealItem = {
          id: entry.id || crypto.randomUUID(),
          name: (entry as unknown as { recipeName?: string }).recipeName || 'Receta',
          description: (entry as unknown as { description?: string }).description || '',
          prepTimeMinutes: (entry as unknown as { prepTime?: number }).prepTime || 30,
          servings: entry.servings || 4,
          ingredients: [],
          instructions: [],
        };
        
        const mealType = entry.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack';
        if (days[dayName] && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
          days[dayName][mealType] = mealItem;
        }
      });
      
      // Create the weekly plan
      const weeklyPlan = {
        id: generatedPlan.id,
        weekStartDate: generatedPlan.startDate,
        days,
        estimatedCost: 80, // Default estimate
      };
      
      // Save to store
      setMealPlan(weeklyPlan);
      
      // Close modal
      setShowAIModal(false);
      setGeneratedPlan(null);
    }
  };

  const handleRegenerate = () => {
    handleGenerateWithAI();
  };

  const handleCloseAIModal = () => {
    if (!isGenerating) {
      setShowAIModal(false);
      setGeneratedPlan(null);
      setGenerationError(null);
    }
  };

  if (!currentMealPlan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No tienes un plan activo</h2>
          <p className="text-gray-600 mb-6">Genera tu primer plan semanal con la ayuda de nuestra IA</p>
          <Button onClick={handleGenerateWithAI} size="lg">
            <span className="mr-2">✨</span>
            Generar con IA
          </Button>
          
          {/* AI Modal */}
          <AIGenerationModal
            isOpen={showAIModal}
            onClose={handleCloseAIModal}
            isLoading={isGenerating}
            error={generationError}
            result={generatedPlan}
            onAccept={handleAcceptPlan}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>
    );
  }

  const handleMealClick = (day: DayOfWeek, mealType: MealType) => {
    const meal = currentMealPlan.days[day][mealType];
    if (meal) {
      setSelectedMeal({ meal, mealType, day });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-gray-900 hidden sm:block">PlanificaMenu</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/grocery-list">
                <Button variant="secondary" size="sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Lista de compra
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Tu plan semanal</h1>
              <p className="text-gray-600 mt-1">
                Semana del {formatDate(currentMealPlan.weekStartDate)}
              </p>
            </div>
            <div className="flex gap-3">
              {/* AI Generate Button - NEW */}
              <Button 
                onClick={handleGenerateWithAI}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
                size="sm"
              >
                <span className="mr-2">✨</span>
                Generar con IA
              </Button>
              <Button variant="secondary" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerar
              </Button>
              <Button variant="secondary" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Compartir
              </Button>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Coste estimado</p>
                <p className="text-lg font-bold text-gray-900">{currentMealPlan.estimatedCost.toFixed(0)} EUR</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Recetas</p>
                <p className="text-lg font-bold text-gray-900">21 comidas</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ingredientes</p>
                <p className="text-lg font-bold text-gray-900">{groceryList?.items.length ?? 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tiempo medio</p>
                <p className="text-lg font-bold text-gray-900">35 min</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Weekly calendar */}
        <WeeklyCalendar mealPlan={currentMealPlan} onMealClick={handleMealClick} />

        {/* Action buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link href="/grocery-list" className="flex-1">
            <Button fullWidth size="lg">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Ver lista de compra
            </Button>
          </Link>
          <Button variant="secondary" size="lg" className="flex-1">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar PDF
          </Button>
        </div>
      </main>

      {/* Recipe modal */}
      <RecipeModal
        isOpen={!!selectedMeal}
        onClose={() => setSelectedMeal(null)}
        meal={selectedMeal?.meal ?? null}
        mealType={selectedMeal?.mealType ?? null}
      />

      {/* AI Generation Modal */}
      <AIGenerationModal
        isOpen={showAIModal}
        onClose={handleCloseAIModal}
        isLoading={isGenerating}
        error={generationError}
        result={generatedPlan}
        onAccept={handleAcceptPlan}
        onRegenerate={handleRegenerate}
      />
    </div>
  );
}
