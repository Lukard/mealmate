'use client';

import { useEffect, useRef } from 'react';
import { Button, Card } from '@/components/ui';
import type { MealItem, MealType } from '@/lib/store';
import clsx from 'clsx';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: MealItem | null;
  mealType: MealType | null;
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
};

export function RecipeModal({ isOpen, onClose, meal, mealType }: RecipeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen || !meal || !mealType) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] md:max-h-[80vh] md:rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
        {/* Header with image */}
        {meal.imageUrl && (
          <div className="relative h-48 md:h-64">
            <img
              src={meal.imageUrl}
              alt={meal.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-4 right-4">
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white mb-2">
                {mealTypeLabels[mealType]}
              </span>
              <h2 className="text-2xl font-bold text-white">{meal.name}</h2>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Header without image */}
            {!meal.imageUrl && (
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm mb-2">
                    {mealTypeLabels[mealType]}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900">{meal.name}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Description */}
            <p className="text-gray-600">{meal.description}</p>

            {/* Quick info */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">{meal.prepTimeMinutes} min</p>
                  <p className="text-xs text-gray-400">Tiempo total</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">{meal.servings} personas</p>
                  <p className="text-xs text-gray-400">Raciones</p>
                </div>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Ingredientes</h3>
              <Card className="bg-gray-50 border-gray-100">
                <ul className="space-y-2">
                  {meal.ingredients.map((ingredient, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                      <span className="text-gray-700">{ingredient}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Instrucciones</h3>
              <ol className="space-y-4">
                {meal.instructions.map((instruction, index) => (
                  <li key={index} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 pt-1">{instruction}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Cerrar
            </Button>
            <Button fullWidth>
              Cambiar receta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
