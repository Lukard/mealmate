'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Card } from '@/components/ui';
import type { MealItem, MealType, DayOfWeek } from '@/lib/store';
import { useStore } from '@/lib/store';

interface RecipeAlternative {
  id: string;
  name: string;
  description: string;
  prepTimeMinutes: number;
  servings: number;
  ingredients: string[];
  instructions: string[];
  whyRecommended: string;
}

interface SwapRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMeal: MealItem | null;
  mealType: MealType | null;
  day: DayOfWeek | null;
  onSwap: (newMeal: MealItem) => void;
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
};

export function SwapRecipeModal({ 
  isOpen, 
  onClose, 
  currentMeal, 
  mealType, 
  day,
  onSwap 
}: SwapRecipeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { answers } = useStore();
  
  const [alternatives, setAlternatives] = useState<RecipeAlternative[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Fetch alternatives when modal opens
  useEffect(() => {
    if (isOpen && currentMeal && mealType) {
      fetchAlternatives();
    }
    return () => {
      setAlternatives([]);
      setError(null);
      setSelectedId(null);
    };
  }, [isOpen, currentMeal, mealType]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && !isSwapping) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, isSwapping, onClose]);

  const fetchAlternatives = async () => {
    if (!currentMeal || !mealType) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ai/recipes/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRecipe: {
            name: currentMeal.name,
            mealType: mealType,
          },
          userPreferences: {
            dietary: answers?.dietary || [],
            healthGoals: answers?.health?.goals || [],
            cuisines: answers?.preferences?.cuisines || [],
            maxPrepTime: answers?.schedule?.maxPrepTimeMinutes || 45,
            avoidIngredients: answers?.preferences?.avoidIngredients || [],
          },
          count: 4,
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.alternatives) {
        setAlternatives(data.data.alternatives);
      } else {
        throw new Error(data.error?.message || 'No se pudieron cargar las alternativas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar alternativas');
      // Generate mock alternatives as fallback
      generateMockAlternatives();
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockAlternatives = () => {
    // Fallback mock alternatives based on meal type
    const mockAlternatives: RecipeAlternative[] = [
      {
        id: crypto.randomUUID(),
        name: mealType === 'breakfast' ? 'Tostadas con aguacate' : 
              mealType === 'lunch' ? 'Ensalada César' :
              mealType === 'dinner' ? 'Salmón al horno' : 'Yogur con frutas',
        description: 'Una opción saludable y deliciosa',
        prepTimeMinutes: 15,
        servings: 2,
        ingredients: ['Ingrediente 1', 'Ingrediente 2', 'Ingrediente 3'],
        instructions: ['Paso 1', 'Paso 2', 'Paso 3'],
        whyRecommended: 'Rápido y nutritivo',
      },
      {
        id: crypto.randomUUID(),
        name: mealType === 'breakfast' ? 'Smoothie bowl' : 
              mealType === 'lunch' ? 'Wrap de pollo' :
              mealType === 'dinner' ? 'Pasta primavera' : 'Frutos secos',
        description: 'Equilibrado y satisfactorio',
        prepTimeMinutes: 20,
        servings: 2,
        ingredients: ['Ingrediente A', 'Ingrediente B', 'Ingrediente C'],
        instructions: ['Paso 1', 'Paso 2', 'Paso 3'],
        whyRecommended: 'Alto en proteínas',
      },
      {
        id: crypto.randomUUID(),
        name: mealType === 'breakfast' ? 'Huevos revueltos' : 
              mealType === 'lunch' ? 'Buddha bowl' :
              mealType === 'dinner' ? 'Pollo al limón' : 'Hummus con crudités',
        description: 'Clásico renovado',
        prepTimeMinutes: 25,
        servings: 2,
        ingredients: ['Ingrediente X', 'Ingrediente Y', 'Ingrediente Z'],
        instructions: ['Paso 1', 'Paso 2', 'Paso 3'],
        whyRecommended: 'Bajo en calorías',
      },
    ];
    setAlternatives(mockAlternatives);
    setError(null);
  };

  const handleSelectAlternative = (alternative: RecipeAlternative) => {
    setSelectedId(alternative.id);
  };

  const handleConfirmSwap = async () => {
    const selected = alternatives.find(a => a.id === selectedId);
    if (!selected) return;

    setIsSwapping(true);
    
    const newMeal: MealItem = {
      id: selected.id,
      name: selected.name,
      description: selected.description,
      prepTimeMinutes: selected.prepTimeMinutes,
      servings: selected.servings,
      ingredients: selected.ingredients,
      instructions: selected.instructions,
    };

    // Small delay for UX feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    
    onSwap(newMeal);
    setIsSwapping(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isLoading && !isSwapping) {
      onClose();
    }
  };

  if (!isOpen || !currentMeal || !mealType) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl animate-slide-up mx-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Cambiar receta</h2>
                <p className="text-sm text-gray-500">
                  {mealTypeLabels[mealType]} • Actual: {currentMeal.name}
                </p>
              </div>
            </div>
            {!isLoading && !isSwapping && (
              <button 
                onClick={onClose} 
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-6">
          {isLoading && (
            <div className="text-center py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl">🍽️</span>
                </div>
              </div>
              <p className="mt-4 text-gray-600 font-medium">Buscando alternativas...</p>
              <p className="text-sm text-gray-400 mt-1">Analizando tus preferencias</p>
            </div>
          )}

          {error && !isLoading && alternatives.length === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-red-800">Error al cargar alternativas</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={fetchAlternatives}>
                  Reintentar
                </Button>
              </div>
            </div>
          )}

          {!isLoading && alternatives.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Selecciona una alternativa para reemplazar tu receta actual:
              </p>
              
              {alternatives.map((alternative) => (
                <div
                  key={alternative.id}
                  onClick={() => handleSelectAlternative(alternative)}
                  className={`
                    p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${selectedId === alternative.id 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{alternative.name}</h3>
                        {selectedId === alternative.id && (
                          <span className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alternative.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {alternative.prepTimeMinutes} min
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {alternative.servings} personas
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          💡 {alternative.whyRecommended}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              fullWidth 
              onClick={onClose}
              disabled={isLoading || isSwapping}
            >
              Cancelar
            </Button>
            <Button 
              fullWidth 
              onClick={handleConfirmSwap}
              disabled={!selectedId || isLoading || isSwapping}
            >
              {isSwapping ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Cambiando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmar cambio
                </>
              )}
            </Button>
          </div>
          {!isLoading && alternatives.length > 0 && (
            <button 
              onClick={fetchAlternatives}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              disabled={isSwapping}
            >
              🔄 Generar más opciones
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
