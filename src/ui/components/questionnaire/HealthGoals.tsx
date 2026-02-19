'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { useStore, type HealthGoal } from '@/lib/store';
import clsx from 'clsx';

interface HealthGoalOption {
  id: HealthGoal;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const healthGoalOptions: HealthGoalOption[] = [
  {
    id: 'weight-loss',
    label: 'Pérdida de peso',
    description: 'Calorías controladas y porciones equilibradas',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
  {
    id: 'high-protein',
    label: 'Alto en proteína',
    description: 'Para deportistas o ganar masa muscular',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'low-sugar',
    label: 'Bajo en azúcar',
    description: 'Reducir azúcares añadidos',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    id: 'high-fiber',
    label: 'Alto en fibra',
    description: 'Mejorar digestión y saciedad',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    id: 'heart-healthy',
    label: 'Salud cardiovascular',
    description: 'Bajo en grasas saturadas y sodio',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    id: 'low-carb',
    label: 'Bajo en carbohidratos',
    description: 'Dieta keto o low-carb',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'whole-foods',
    label: 'Alimentos naturales',
    description: 'Evitar ultraprocesados',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'balanced',
    label: 'Equilibrio nutricional',
    description: 'Sin objetivo específico, solo comer bien',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

interface HealthGoalsProps {
  onNext: () => void;
}

export function HealthGoals({ onNext }: HealthGoalsProps) {
  const { answers, setHealthAnswers } = useStore();
  const [selected, setSelected] = useState<HealthGoal[]>(answers.health?.goals ?? []);

  useEffect(() => {
    setHealthAnswers({
      goals: selected,
      additionalNotes: answers.health?.additionalNotes ?? '',
    });
  }, [selected, setHealthAnswers, answers.health?.additionalNotes]);

  const toggleOption = (id: HealthGoal) => {
    if (id === 'balanced') {
      setSelected(['balanced']);
      return;
    }

    setSelected((prev) => {
      // Remove 'balanced' if selecting another option
      const filtered = prev.filter((item) => item !== 'balanced');

      if (filtered.includes(id)) {
        return filtered.filter((item) => item !== id);
      } else {
        return [...filtered, id];
      }
    });
  };

  const isSelected = (id: HealthGoal) => selected.includes(id);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Objetivos de salud</h2>
        <p className="text-gray-600 mt-2">
          ¿Qué aspectos de salud te importan más?
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {healthGoalOptions.map((option) => (
          <Card
            key={option.id}
            hoverable
            selected={isSelected(option.id)}
            onClick={() => toggleOption(option.id)}
            className={clsx(
              'p-4 cursor-pointer transition-all duration-200',
              isSelected(option.id) && 'bg-primary-50'
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={clsx(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                  isSelected(option.id)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                )}
              >
                {option.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{option.label}</h3>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
              <div
                className={clsx(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  isSelected(option.id)
                    ? 'bg-primary-600 border-primary-600'
                    : 'border-gray-300'
                )}
              >
                {isSelected(option.id) && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selected.length > 0 && !selected.includes('balanced') && (
        <Card className="bg-green-50 border-green-200 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">
                Objetivos seleccionados: {selected.length}
              </p>
              <p className="text-sm text-green-700 mt-1">
                Priorizaremos recetas que apoyen tus metas de salud
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
