'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { useStore, type MealType } from '@/lib/store';
import clsx from 'clsx';

interface MealOption {
  id: MealType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultSelected: boolean;
}

const mealOptions: MealOption[] = [
  {
    id: 'breakfast',
    label: 'Desayuno',
    description: 'Primera comida del dia',
    defaultSelected: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'lunch',
    label: 'Almuerzo',
    description: 'Comida principal del mediodia',
    defaultSelected: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'dinner',
    label: 'Cena',
    description: 'Comida de la noche',
    defaultSelected: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    id: 'snack',
    label: 'Merienda',
    description: 'Tentempie entre comidas',
    defaultSelected: false,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
      </svg>
    ),
  },
];

interface PrepTimeOption {
  id: string;
  label: string;
  minutes: number;
}

const prepTimeOptions: PrepTimeOption[] = [
  { id: 'rapido', label: 'Rapido (15-30 min)', minutes: 30 },
  { id: 'normal', label: 'Normal (30-45 min)', minutes: 45 },
  { id: 'elaborado', label: 'Elaborado (45-60 min)', minutes: 60 },
  { id: 'gourmet', label: 'Sin limite', minutes: 120 },
];

interface MealFrequencyProps {
  onNext: () => void;
}

export function MealFrequency({ onNext }: MealFrequencyProps) {
  const { answers, setScheduleAnswers } = useStore();
  const [selectedMeals, setSelectedMeals] = useState<MealType[]>(
    answers.schedule?.meals ?? ['breakfast', 'lunch', 'dinner']
  );
  const [maxPrepTime, setMaxPrepTime] = useState(answers.schedule?.maxPrepTimeMinutes ?? 45);

  useEffect(() => {
    setScheduleAnswers({ meals: selectedMeals, maxPrepTimeMinutes: maxPrepTime });
  }, [selectedMeals, maxPrepTime, setScheduleAnswers]);

  const toggleMeal = (mealId: MealType) => {
    setSelectedMeals((prev) => {
      if (prev.includes(mealId)) {
        // Don't allow deselecting all meals
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mealId);
      }
      return [...prev, mealId];
    });
  };

  const isSelected = (id: MealType) => selectedMeals.includes(id);

  // Calculate estimated meals per week
  const mealsPerWeek = selectedMeals.length * 7;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Tus comidas</h2>
        <p className="text-gray-600 mt-2">
          Que comidas quieres planificar cada dia?
        </p>
      </div>

      {/* Meal selection */}
      <div className="grid gap-3 md:grid-cols-2">
        {mealOptions.map((meal) => (
          <Card
            key={meal.id}
            hoverable
            selected={isSelected(meal.id)}
            onClick={() => toggleMeal(meal.id)}
            className={clsx(
              'p-4 cursor-pointer transition-all duration-200',
              isSelected(meal.id) && 'bg-primary-50'
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={clsx(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                  isSelected(meal.id)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                )}
              >
                {meal.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{meal.label}</h3>
                <p className="text-sm text-gray-500">{meal.description}</p>
              </div>
              <div
                className={clsx(
                  'w-6 h-6 rounded border-2 flex items-center justify-center transition-all',
                  isSelected(meal.id)
                    ? 'bg-primary-600 border-primary-600'
                    : 'border-gray-300'
                )}
              >
                {isSelected(meal.id) && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card className="bg-primary-50 border-primary-200 p-4">
        <div className="flex items-center justify-center gap-2 text-primary-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-medium">
            {mealsPerWeek} comidas planificadas por semana
          </span>
        </div>
      </Card>

      {/* Prep time selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Tiempo de preparacion maximo</h3>
        <p className="text-sm text-gray-500">
          Cuanto tiempo tienes para cocinar cada comida?
        </p>

        <div className="grid gap-2 md:grid-cols-4">
          {prepTimeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMaxPrepTime(option.minutes)}
              className={clsx(
                'p-3 rounded-lg border-2 text-sm font-medium transition-all',
                maxPrepTime === option.minutes
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
